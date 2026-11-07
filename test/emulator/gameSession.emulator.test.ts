import { get, goOffline, ref, set } from 'firebase/database';
import { afterAll, describe, expect, it } from 'vitest';
import { GameSession } from '../../src/application/gameSession';
import type { GameView } from '../../src/application/view';
import { cryptoRandom } from '../../src/infrastructure/browser/cryptoRandom';
import { createFirebaseClient, type FirebaseClient } from '../../src/infrastructure/firebase/client';
import { FirebaseIdentity } from '../../src/infrastructure/firebase/identity';
import { FirebaseRoomGateway } from '../../src/infrastructure/firebase/roomGateway';
import { FirebaseServerClock } from '../../src/infrastructure/firebase/serverClock';
import { generateRoomCode } from '../../src/domain/roomCode';
import { MemoryStore } from '../support/fakeServer';

/*
 * Ponta a ponta no emulador: dois jogadores, cada um com seu login anônimo,
 * usando o gateway real e com database.rules.json valendo.
 * Rode com `npm run test:emulator`.
 */

const ENV = { VITE_USE_EMULATORS: 'true' };

interface Player {
  firebase: FirebaseClient;
  session: GameSession;
  clock: FirebaseServerClock;
}

const players: Player[] = [];

function createPlayer(name: string): Player {
  const firebase = createFirebaseClient(ENV, `${name}-${Date.now()}`);
  const clock = new FirebaseServerClock(firebase.database);
  const session = new GameSession({
    identity: new FirebaseIdentity(firebase.auth),
    gateway: new FirebaseRoomGateway(firebase.database),
    clock,
    random: cryptoRandom,
    store: new MemoryStore(),
  });
  const player = { firebase, session, clock };
  players.push(player);
  return player;
}

/** Espera a tela chegar ao estado esperado (a rede do emulador é assíncrona de verdade). */
async function waitFor<T extends GameView>(player: Player, predicate: (view: GameView) => view is T): Promise<T>;
async function waitFor(player: Player, predicate: (view: GameView) => boolean): Promise<GameView>;
async function waitFor(player: Player, predicate: (view: GameView) => boolean): Promise<GameView> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const view = player.session.getView();
    if (predicate(view)) return view;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Tempo esgotado. Tela atual: ${JSON.stringify(player.session.getView())}`);
}

const isWaiting = (view: GameView): view is Extract<GameView, { screen: 'waiting' }> => view.screen === 'waiting';
const isPlaying = (view: GameView): view is Extract<GameView, { screen: 'playing' }> => view.screen === 'playing';

afterAll(() => {
  for (const player of players) {
    player.session.dispose();
    player.clock.dispose();
  }
});

describe('jogo completo no emulador', () => {
  it('o emulador aplica database.rules.json', async () => {
    const intruder = createPlayer('intruder');
    await new FirebaseIdentity(intruder.firebase.auth).ensurePlayer();
    await expect(set(ref(intruder.firebase.database, 'outra/coisa'), 1)).rejects.toThrow(/permission/i);
  });

  it('criar, entrar, jogar, resetar e sair', async () => {
    const alice = createPlayer('alice');
    const bob = createPlayer('bob');

    await alice.session.start();
    await alice.session.createRoom();
    const { code } = await waitFor(alice, isWaiting);

    await bob.session.start();
    await bob.session.joinRoom(code);
    await waitFor(bob, isPlaying);
    await waitFor(alice, isPlaying);

    await alice.session.play('paper');
    await bob.session.play('rock');
    const afterRound = await waitFor(alice, (view) => isPlaying(view) && view.roundNumber === 2);
    expect(afterRound).toMatchObject({
      scores: { me: 1, opponent: 0 },
      lastRound: { result: 'win', ending: 'played', myMove: 'paper', opponentMove: 'rock' },
    });
    await waitFor(bob, (view) => isPlaying(view) && view.scores.opponent === 1);

    await alice.session.requestReset();
    await waitFor(bob, (view) => isPlaying(view) && view.reset === 'requested-by-opponent');
    await bob.session.respondToReset(true);
    await waitFor(alice, (view) => isPlaying(view) && view.roundNumber === 1 && view.scores.me === 0);

    await bob.session.leave();
    await waitFor(alice, isWaiting);
    await alice.session.leave();

    // A sala foi apagada pelo último a sair: entrar de novo dá "não encontrada".
    const carol = createPlayer('carol');
    await carol.session.start();
    await carol.session.joinRoom(code);
    expect(carol.session.getView()).toEqual({ screen: 'home', busy: false, error: 'not-found', nickname: null });
  });
});

describe('presença com várias conexões (abas)', () => {
  /** Código sorteado a cada execução: o teste pode rodar de novo contra os mesmos emuladores. */
  async function setup(code: string = generateRoomCode(Math.random)) {
    const owner = createPlayer('owner');
    const watcher = createPlayer('watcher');
    const ownerId = await new FirebaseIdentity(owner.firebase.auth).ensurePlayer();
    await new FirebaseIdentity(watcher.firebase.auth).ensurePlayer();
    const gateway = new FirebaseRoomGateway(owner.firebase.database);
    const roomCode = code as Parameters<typeof gateway.get>[0];
    const created = await gateway.create({ code: roomCode, host: ownerId, hostName: null, matchId: 'm1' as never, bestOf: 0, choiceSeconds: 15 });
    expect(created).toBe(true);

    const connections = async () => {
      const snapshot = await get(ref(watcher.firebase.database, `rooms/${code}/players/player1/connections`));
      return Object.keys((snapshot.val() as Record<string, true> | null) ?? {});
    };
    const waitConnections = async (count: number) => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if ((await connections()).length === count) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`esperava ${count} conexões, há ${(await connections()).length}`);
    };
    return { owner, watcher, gateway, roomCode, waitConnections };
  }

  it('fechar uma aba remove só a conexão dela; a outra continua', async () => {
    const { gateway, roomCode, waitConnections, watcher } = await setup();
    const closeFirstTab = gateway.trackPresence(roomCode, 'player1');
    gateway.trackPresence(roomCode, 'player1');
    await waitConnections(2);

    closeFirstTab();
    await waitConnections(1);
    const room = await new FirebaseRoomGateway(watcher.firebase.database).get(roomCode);
    expect(room?.players.player1?.connected).toBe(true);
  });

  it('se a rede cai, o servidor remove a conexão sozinho (onDisconnect) e o jogador fica desconectado', async () => {
    const { owner, gateway, roomCode, waitConnections, watcher } = await setup();
    gateway.trackPresence(roomCode, 'player1');
    await waitConnections(1);

    goOffline(owner.firebase.database);
    await waitConnections(0);
    const room = await new FirebaseRoomGateway(watcher.firebase.database).get(roomCode);
    expect(room?.players.player1?.connected).toBe(false);
  });
});
