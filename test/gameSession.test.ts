import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayingView } from '../src/application/view';
import { DEFAULT_CHOICE_TIMEOUT_MS, DEFAULT_REVEAL_TIMEOUT_MS } from '../src/domain/match';
import { STALE_PLAYER_MS } from '../src/domain/room';
import type { BestOf, Move, RoomCode } from '../src/domain/types';
import { GameSession } from '../src/application/gameSession';
import { FakeServer, OfflineableGateway, createPlayer, nodeRandom, settle, type TestPlayer } from './support/fakeServer';

let server: FakeServer;

beforeEach(() => {
  server = new FakeServer();
});

afterEach(() => {
  vi.useRealTimers();
});

function playing(player: TestPlayer): PlayingView {
  const view = player.view();
  if (view.screen !== 'playing') throw new Error(`${player.id} está em "${view.screen}", não em "playing"`);
  return view;
}

function codeOf(player: TestPlayer): RoomCode {
  const view = player.view();
  if (view.screen !== 'waiting' && view.screen !== 'playing') throw new Error(`${player.id} não está numa sala`);
  return view.code;
}

/** Alice cria a sala e Bob entra pelo código. */
async function startGame(bestOf: BestOf = 0) {
  const alice = createPlayer(server, 'alice');
  const bob = createPlayer(server, 'bob');
  await alice.session.start();
  await alice.session.createRoom(bestOf);
  await settle();
  await bob.session.start();
  await bob.session.joinRoom(codeOf(alice).toLowerCase());
  await settle();
  return { alice, bob, code: codeOf(alice) };
}

describe('entrar na sala', () => {
  it('quem cria a sala espera o adversário com o código à mostra', async () => {
    const alice = createPlayer(server, 'alice');
    await alice.session.start();
    expect(alice.view()).toEqual({ screen: 'home', busy: false, error: null, nickname: null });

    await alice.session.createRoom();
    await settle();
    expect(alice.view()).toMatchObject({ screen: 'waiting' });
    expect(codeOf(alice)).toMatch(/^[A-HJKMNP-Z2-9]{4}$/);
  });

  it('com o adversário na sala, os dois vão para o jogo, e quem criou é avisado', async () => {
    const { alice, bob } = await startGame();
    expect(playing(alice)).toMatchObject({ roundNumber: 1, canPlay: true, scores: { me: 0, opponent: 0 } });
    expect(playing(bob)).toMatchObject({ roundNumber: 1, canPlay: true });
    expect(alice.notices).toEqual(['opponent-joined']);
  });

  it('código sorteado já em uso: sorteia outro em vez de entrar na sala alheia', async () => {
    const carol = createPlayer(server, 'carol', { random: { next: () => 0, hex: nodeRandom.hex } });
    await carol.session.start();
    await carol.session.createRoom(); // código AAAA
    await settle();

    let calls = 0;
    const alice = createPlayer(server, 'alice', {
      random: { next: () => (calls++ < 14 ? 0 : 0.5), hex: nodeRandom.hex }, // 1ª tentativa repete AAAA
    });
    await alice.session.start();
    await alice.session.createRoom();
    await settle();
    expect(codeOf(alice)).not.toBe('AAAA');
    expect(alice.view().screen).toBe('waiting');
  });

  it.each([
    ['', 'empty'],
    ['AB', 'length'],
    ['AB.C', 'characters'],
  ])('código digitado "%s" → erro "%s", sem sair da tela inicial', async (input, error) => {
    const alice = createPlayer(server, 'alice');
    await alice.session.start();
    await alice.session.joinRoom(input);
    expect(alice.view()).toEqual({ screen: 'home', busy: false, error, nickname: null });
  });

  it('sala inexistente', async () => {
    const alice = createPlayer(server, 'alice');
    await alice.session.start();
    await alice.session.joinRoom('ZZZZ');
    expect(alice.view()).toEqual({ screen: 'home', busy: false, error: 'not-found', nickname: null });
  });

  it('sala cheia', async () => {
    const { code } = await startGame();
    const carol = createPlayer(server, 'carol');
    await carol.session.start();
    await carol.session.joinRoom(code);
    expect(carol.view()).toEqual({ screen: 'home', busy: false, error: 'full', nickname: null });
  });

  it('link de convite entra direto na sala', async () => {
    const alice = createPlayer(server, 'alice');
    await alice.session.start();
    await alice.session.createRoom();
    await settle();

    const bob = createPlayer(server, 'bob');
    await bob.session.start(codeOf(alice));
    await settle();
    expect(bob.view().screen).toBe('playing');
  });
});

describe('jogar uma rodada', () => {
  it('ninguém vê a jogada do outro antes de jogar', async () => {
    const { alice, bob, code } = await startGame();
    await alice.session.play('rock');
    await settle();

    expect(playing(alice)).toMatchObject({ myMove: 'rock', iHaveChosen: true, canPlay: false });
    expect(playing(bob)).toMatchObject({ opponentHasChosen: true, canPlay: true });
    // No banco só existe o hash: "rock" não aparece em lugar nenhum.
    expect(JSON.stringify(server.snapshot(code))).not.toContain('rock');
  });

  it('quando os dois escolhem, as jogadas são reveladas sozinhas e o placar é igual para os dois', async () => {
    const { alice, bob } = await startGame();
    await alice.session.play('rock');
    await bob.session.play('scissors');
    await settle();

    expect(playing(alice)).toMatchObject({
      roundNumber: 2,
      scores: { me: 1, opponent: 0 },
      canPlay: true,
      myMove: null,
      lastRound: { number: 1, result: 'win', ending: 'played', myMove: 'rock', opponentMove: 'scissors' },
    });
    expect(playing(bob)).toMatchObject({
      roundNumber: 2,
      scores: { me: 0, opponent: 1 },
      lastRound: { result: 'loss', myMove: 'scissors', opponentMove: 'rock' },
    });
  });

  it('placar, empates e histórico ao longo de várias rodadas', async () => {
    const { alice, bob } = await startGame();
    const rounds = [
      ['rock', 'scissors'],
      ['paper', 'paper'],
      ['scissors', 'rock'],
      ['paper', 'rock'],
    ] as const;
    for (const [a, b] of rounds) {
      await alice.session.play(a);
      await bob.session.play(b);
      await settle();
    }
    expect(playing(alice)).toMatchObject({ roundNumber: 5, scores: { me: 2, opponent: 1 }, ties: 1 });
    expect(playing(alice).history.map((round) => round.result)).toEqual(['win', 'tie', 'loss', 'win']);
  });

  it('clique repetido não grava duas jogadas', async () => {
    const { alice } = await startGame();
    await Promise.all([alice.session.play('rock'), alice.session.play('paper')]);
    await settle();
    expect(playing(alice).myMove).toBe('rock');
    expect(alice.notices).not.toContain('action-failed');
  });
});

describe('recarregar a página (F5)', () => {
  it('volta para a mesma sala e vaga, e ainda revela a jogada feita antes', async () => {
    const { alice, bob } = await startGame();
    await alice.session.play('paper');
    await settle();

    alice.session.dispose(); // fecha a aba
    const reloaded = createPlayer(server, 'alice', { store: alice.store });
    await reloaded.session.start();
    await settle();
    expect(playing(reloaded)).toMatchObject({ myMove: 'paper', iHaveChosen: true });

    await bob.session.play('rock');
    await settle();
    expect(playing(reloaded)).toMatchObject({ scores: { me: 1, opponent: 0 }, lastRound: { result: 'win' } });
  });

  it('se a sala não existe mais, volta à tela inicial sem mostrar erro', async () => {
    const alice = createPlayer(server, 'alice');
    alice.store.room = 'ZZZZ' as RoomCode;
    await alice.session.start();
    expect(alice.view()).toEqual({ screen: 'home', busy: false, error: null, nickname: null });
    expect(alice.store.room).toBeNull();
  });
});

describe('W.O. e desconexão', () => {
  it('quem não revela no prazo perde a rodada', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { alice, bob, code } = await startGame();
    // Bob grava um commit sem guardar a jogada no navegador: continua conectado, mas não consegue revelar.
    const matchId = server.snapshot(code)?.currentMatch;
    if (!matchId) throw new Error('sala sumiu');
    await bob.gateway.commit(code, matchId, 0, 'player2', 'b'.repeat(64));
    await alice.session.play('rock');
    await settle();

    expect(playing(alice)).toMatchObject({ phase: 'revealing', revealDeadline: server.time + DEFAULT_REVEAL_TIMEOUT_MS });
    server.time += DEFAULT_REVEAL_TIMEOUT_MS + 1;
    vi.advanceTimersByTime(DEFAULT_REVEAL_TIMEOUT_MS + 100);
    await settle();
    expect(playing(alice)).toMatchObject({
      scores: { me: 1, opponent: 0 },
      lastRound: { result: 'win', ending: 'reveal-timeout', opponentMove: null },
    });
  });

  it('quem não escolhe no prazo depois do adversário perde a rodada', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { alice, bob } = await startGame();
    await alice.session.play('rock');
    await settle();
    expect(playing(bob)).toMatchObject({ opponentHasChosen: true, choiceDeadline: server.time + DEFAULT_CHOICE_TIMEOUT_MS });
    expect(playing(alice).choiceDeadline).toBe(server.time + DEFAULT_CHOICE_TIMEOUT_MS);

    server.time += DEFAULT_CHOICE_TIMEOUT_MS + 1;
    vi.advanceTimersByTime(DEFAULT_CHOICE_TIMEOUT_MS + 100);
    await settle();
    expect(playing(alice)).toMatchObject({
      roundNumber: 2,
      scores: { me: 1, opponent: 0 },
      choiceDeadline: null,
      lastRound: { result: 'win', ending: 'choice-timeout', myMove: null, opponentMove: null },
    });
    expect(playing(bob)).toMatchObject({ scores: { me: 0, opponent: 1 }, lastRound: { result: 'loss', ending: 'choice-timeout' } });
  });

  it('o prazo para escolher é o definido na sala', async () => {
    const alice = createPlayer(server, 'alice');
    const bob = createPlayer(server, 'bob');
    await alice.session.start();
    await alice.session.createRoom(0, 5);
    await settle();
    await bob.session.start();
    await bob.session.joinRoom(codeOf(alice));
    await settle();
    await alice.session.play('rock');
    await settle();
    expect(playing(bob)).toMatchObject({ choiceSeconds: 5, choiceDeadline: server.time + 5_000 });
  });

  it('adversário desconectado aparece como tal e não dá para jogar', async () => {
    const { alice, bob } = await startGame();
    server.disconnect(bob.id);
    await settle();
    expect(playing(alice)).toMatchObject({ opponent: 'disconnected', canPlay: false });
  });

  it('depois de 60 s desconectado, a vaga é liberada e quem ficou volta a esperar', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { alice, bob, code } = await startGame();
    // A aba fecha: o servidor marca a desconexão; nenhum código do Bob roda.
    server.disconnect(bob.id);
    bob.session.dispose();
    await settle();

    server.time += STALE_PLAYER_MS + 1;
    vi.advanceTimersByTime(STALE_PLAYER_MS + 100);
    await settle();
    expect(alice.view()).toEqual({ screen: 'waiting', code, bestOf: 0 });
    expect(alice.notices).toContain('opponent-left');
  });

  it('com duas abas do mesmo jogador, fechar uma não o desconecta', async () => {
    const { alice, bob } = await startGame();
    const secondTab = createPlayer(server, 'bob', { store: bob.store });
    await secondTab.session.start();
    await settle();
    expect(secondTab.view().screen).toBe('playing');

    bob.session.dispose(); // fecha a primeira aba
    await settle();
    expect(playing(alice).opponent).toBe('connected');

    secondTab.session.dispose(); // fecha a última
    await settle();
    expect(playing(alice).opponent).toBe('disconnected');
  });

  it('com duas abas, a queda de uma conexão não derruba a outra', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { alice, bob, code } = await startGame();
    const secondTab = createPlayer(server, 'bob', { store: bob.store });
    await secondTab.session.start();
    await settle();

    bob.session.dispose();
    await settle();
    server.time += STALE_PLAYER_MS + 1;
    vi.advanceTimersByTime(STALE_PLAYER_MS + 100);
    await settle();
    // Passou o prazo de vaga abandonada, mas o Bob segue na sala pela outra aba.
    expect(alice.view()).toMatchObject({ screen: 'playing', opponent: 'connected', code });
  });

  it('reconectar a tempo mantém a vaga', async () => {
    const { alice, bob } = await startGame();
    server.disconnect(bob.id);
    await settle();
    const back = createPlayer(server, 'bob', { store: bob.store });
    await back.session.start();
    await settle();
    expect(playing(alice).opponent).toBe('connected');
    expect(back.view().screen).toBe('playing');
  });
});

describe('reset', () => {
  async function playOneRound(alice: TestPlayer, bob: TestPlayer) {
    await alice.session.play('rock');
    await bob.session.play('scissors');
    await settle();
  }

  it('pedido aceito: placar zera para os dois e quem pediu é avisado', async () => {
    const { alice, bob } = await startGame();
    await playOneRound(alice, bob);

    await alice.session.requestReset();
    await settle();
    expect(playing(alice).reset).toBe('requested-by-me');
    expect(playing(bob).reset).toBe('requested-by-opponent');

    await bob.session.respondToReset(true);
    await settle();
    expect(playing(alice)).toMatchObject({ reset: 'none', roundNumber: 1, scores: { me: 0, opponent: 0 }, lastRound: null });
    expect(playing(bob)).toMatchObject({ roundNumber: 1, scores: { me: 0, opponent: 0 } });
    expect(alice.notices).toContain('reset-accepted');
  });

  it('pedido recusado: placar mantido e quem pediu é avisado', async () => {
    const { alice, bob } = await startGame();
    await playOneRound(alice, bob);
    await alice.session.requestReset();
    await settle();
    await bob.session.respondToReset(false);
    await settle();
    expect(playing(alice)).toMatchObject({ reset: 'none', scores: { me: 1, opponent: 0 } });
    expect(alice.notices).toContain('reset-declined');
  });

  it('quem pediu pode cancelar, sem receber aviso de recusa', async () => {
    const { alice } = await startGame();
    await alice.session.requestReset();
    await settle();
    await alice.session.cancelReset();
    await settle();
    expect(playing(alice).reset).toBe('none');
    expect(alice.notices).not.toContain('reset-declined');
  });
});

describe('sair da sala', () => {
  it('quem fica volta a esperar, avisado, e o próximo adversário começa do zero', async () => {
    const { alice, bob, code } = await startGame();
    await alice.session.play('rock');
    await bob.session.play('scissors');
    await settle();

    await bob.session.leave();
    await settle();
    expect(bob.view()).toEqual({ screen: 'home', busy: false, error: null, nickname: null });
    expect(bob.store.room).toBeNull();
    expect(alice.view()).toEqual({ screen: 'waiting', code, bestOf: 0 });
    expect(alice.notices).toContain('opponent-left');

    const carol = createPlayer(server, 'carol');
    await carol.session.start();
    await carol.session.joinRoom(code);
    await settle();
    expect(playing(alice)).toMatchObject({ roundNumber: 1, scores: { me: 0, opponent: 0 } });
  });

  it('quem criou a sala pode sair sem derrubar a partida do outro', async () => {
    const { alice, bob, code } = await startGame();
    await alice.session.leave();
    await settle();
    expect(bob.view()).toEqual({ screen: 'waiting', code, bestOf: 0 });
  });

  it('o último a sair apaga a sala', async () => {
    const { alice, bob, code } = await startGame();
    await bob.session.leave();
    await settle();
    await alice.session.leave();
    await settle();
    expect(server.rooms.has(code)).toBe(false);
  });

  it('sala apagada por fora: quem estava nela volta ao início com aviso', async () => {
    const alice = createPlayer(server, 'alice');
    await alice.session.start();
    await alice.session.createRoom();
    await settle();
    server.mutate(codeOf(alice), () => null);
    await settle();
    expect(alice.view()).toEqual({ screen: 'home', busy: false, error: null, nickname: null });
    expect(alice.notices).toEqual(['room-closed']);
  });
});

describe('melhor de N e revanche', () => {
  async function round(alice: TestPlayer, bob: TestPlayer, a: Move, b: Move) {
    await alice.session.play(a);
    await bob.session.play(b);
    await settle();
  }

  it('a partida termina quando alguém faz as vitórias necessárias', async () => {
    const { alice, bob } = await startGame(3);
    expect(playing(alice)).toMatchObject({ bestOf: 3, winsNeeded: 2, phase: 'choosing' });

    await round(alice, bob, 'rock', 'scissors');
    await round(alice, bob, 'rock', 'rock'); // empate não conta
    expect(playing(alice).phase).toBe('choosing');
    await round(alice, bob, 'paper', 'rock');

    expect(playing(alice)).toMatchObject({ phase: 'finished', matchResult: 'win', canPlay: false, scores: { me: 2, opponent: 0 } });
    expect(playing(bob)).toMatchObject({ phase: 'finished', matchResult: 'loss', canPlay: false });
  });

  it('com a partida decidida, não dá para jogar mais', async () => {
    const { alice, bob, code } = await startGame(3);
    await round(alice, bob, 'rock', 'scissors');
    await round(alice, bob, 'rock', 'scissors');
    await alice.session.play('rock');
    await settle();
    expect(server.snapshot(code)?.rounds).toHaveLength(2);
  });

  it('revanche: um pede, o outro aceita clicando também, e começa outra partida no mesmo formato', async () => {
    const { alice, bob } = await startGame(3);
    await round(alice, bob, 'rock', 'scissors');
    await round(alice, bob, 'rock', 'scissors');

    await bob.session.rematch();
    await settle();
    expect(playing(bob).reset).toBe('requested-by-me');
    expect(playing(alice).reset).toBe('requested-by-opponent');

    await alice.session.rematch();
    await settle();
    expect(playing(alice)).toMatchObject({ phase: 'choosing', bestOf: 3, roundNumber: 1, scores: { me: 0, opponent: 0 } });
    expect(playing(bob)).toMatchObject({ phase: 'choosing', canPlay: true });
  });

  it('clicar em revanche de novo, com o pedido já feito, não faz nada', async () => {
    const { alice, bob, code } = await startGame(3);
    await round(alice, bob, 'rock', 'scissors');
    await round(alice, bob, 'rock', 'scissors');

    await bob.session.rematch();
    await settle();
    const request = server.snapshot(code)?.resetRequest;
    server.time += 1000;
    await bob.session.rematch(); // segundo clique
    await settle();

    expect(server.snapshot(code)?.resetRequest).toEqual(request); // mesmo pedido, não renovado
    expect(playing(bob)).toMatchObject({ phase: 'finished', reset: 'requested-by-me' });
  });

  it('a sala de espera mostra o formato', async () => {
    const alice = createPlayer(server, 'alice');
    await alice.session.start();
    await alice.session.createRoom(5);
    await settle();
    expect(alice.view()).toMatchObject({ screen: 'waiting', bestOf: 5 });
  });
});

describe('apelidos', () => {
  it('o apelido salvo vai junto ao criar e entrar na sala', async () => {
    const alice = createPlayer(server, 'alice');
    const bob = createPlayer(server, 'bob');
    alice.store.saveNickname('Alice');
    bob.store.saveNickname('Bob');
    await alice.session.start();
    expect(alice.view()).toMatchObject({ screen: 'home', nickname: 'Alice' });
    await alice.session.createRoom();
    await settle();
    await bob.session.start();
    await bob.session.joinRoom(codeOf(alice));
    await settle();
    expect(playing(alice)).toMatchObject({ myName: 'Alice', opponentName: 'Bob' });
    expect(playing(bob)).toMatchObject({ myName: 'Bob', opponentName: 'Alice' });
  });

  it('trocar o apelido no meio do jogo atualiza a tela do adversário', async () => {
    const { alice, bob } = await startGame();
    expect(playing(alice).opponentName).toBeNull();
    await bob.session.setNickname('  Bobby   Tables ');
    await settle();
    expect(playing(alice).opponentName).toBe('Bobby Tables');
    expect(bob.store.nickname).toBe('Bobby Tables');
  });

  it('apagar o apelido volta ao nome genérico', async () => {
    const { alice, bob } = await startGame();
    await bob.session.setNickname('Bob');
    await bob.session.setNickname('   ');
    await settle();
    expect(playing(alice).opponentName).toBeNull();
  });
});

describe('sem rede: o servidor não responde', () => {
  const TIMEOUT = 30;
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function offlinePlayer(name: string) {
    const gateway = new OfflineableGateway(server, name as never);
    return { gateway, player: createPlayer(server, name, { gateway, connectTimeoutMs: TIMEOUT }) };
  }

  it('voltar à sala salva desiste a tempo, avisa e NÃO esquece a sala', async () => {
    const { player } = offlinePlayer('alice');
    player.store.room = 'AB23' as RoomCode;
    const starting = player.session.start();
    await settle();
    expect(player.view()).toMatchObject({ screen: 'home', busy: true });

    await wait(TIMEOUT + 20);
    await starting;
    expect(player.view()).toEqual({ screen: 'home', busy: false, error: 'unreachable', nickname: null });
    expect(player.store.room).toBe('AB23'); // volta a ela quando a rede voltar
  });

  it('criar sala sem rede desiste a tempo e avisa', async () => {
    const { player } = offlinePlayer('alice');
    await player.session.start();
    const creating = player.session.createRoom();
    await wait(TIMEOUT + 20);
    await creating;
    expect(player.view()).toMatchObject({ screen: 'home', busy: false, error: 'unreachable' });
  });

  it('quando a rede volta, entrar funciona de novo', async () => {
    const host = createPlayer(server, 'host');
    await host.session.start();
    await host.session.createRoom();
    await settle();

    const { gateway, player } = offlinePlayer('alice');
    await player.session.start();
    const joining = player.session.joinRoom(codeOf(host));
    await wait(TIMEOUT + 20);
    await joining;
    expect(player.view()).toMatchObject({ error: 'unreachable' });

    gateway.offline = false;
    await player.session.joinRoom(codeOf(host));
    await settle();
    expect(player.view().screen).toBe('playing');
  });
});

describe('sem conexão na abertura', () => {
  it('mostra a tela inicial com aviso e tenta o login de novo ao criar a sala', async () => {
    let attempts = 0;
    const alice = createPlayer(server, 'alice');
    const session = new GameSession({
      identity: {
        ensurePlayer: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('offline');
          return alice.id;
        },
      },
      gateway: alice.gateway,
      clock: server.clock,
      random: nodeRandom,
      store: alice.store,
    });
    await session.start();
    expect(session.getView()).toEqual({ screen: 'home', busy: false, error: 'unexpected', nickname: null });

    await session.createRoom();
    await settle();
    expect(session.getView().screen).toBe('waiting');
  });
});
