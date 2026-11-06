import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayingView } from '../src/application/view';
import { DEFAULT_REVEAL_TIMEOUT_MS } from '../src/domain/match';
import { STALE_PLAYER_MS } from '../src/domain/room';
import type { RoomCode } from '../src/domain/types';
import { FakeServer, createPlayer, nodeRandom, settle, type TestPlayer } from './support/fakeServer';

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
async function startGame() {
  const alice = createPlayer(server, 'alice');
  const bob = createPlayer(server, 'bob');
  await alice.session.start();
  await alice.session.createRoom();
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
    expect(alice.view()).toEqual({ screen: 'home', busy: false, error: null });

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
    expect(alice.view()).toEqual({ screen: 'home', busy: false, error });
  });

  it('sala inexistente', async () => {
    const alice = createPlayer(server, 'alice');
    await alice.session.start();
    await alice.session.joinRoom('ZZZZ');
    expect(alice.view()).toEqual({ screen: 'home', busy: false, error: 'not-found' });
  });

  it('sala cheia', async () => {
    const { code } = await startGame();
    const carol = createPlayer(server, 'carol');
    await carol.session.start();
    await carol.session.joinRoom(code);
    expect(carol.view()).toEqual({ screen: 'home', busy: false, error: 'full' });
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
    expect(alice.view()).toEqual({ screen: 'home', busy: false, error: null });
    expect(alice.store.room).toBeNull();
  });
});

describe('W.O. e desconexão', () => {
  it('quem não revela no prazo perde a rodada', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { alice, bob, code } = await startGame();
    // Bob grava o commit e fecha a aba antes de revelar (sem sessão ativa para revelar sozinha).
    bob.session.dispose();
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
    expect(alice.view()).toEqual({ screen: 'waiting', code });
    expect(alice.notices).toContain('opponent-left');
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
    expect(bob.view()).toEqual({ screen: 'home', busy: false, error: null });
    expect(bob.store.room).toBeNull();
    expect(alice.view()).toEqual({ screen: 'waiting', code });
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
    expect(bob.view()).toEqual({ screen: 'waiting', code });
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
    expect(alice.view()).toEqual({ screen: 'home', busy: false, error: null });
    expect(alice.notices).toEqual(['room-closed']);
  });
});
