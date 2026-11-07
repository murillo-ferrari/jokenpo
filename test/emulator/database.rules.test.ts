import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/*
 * Testa database.rules.json no emulador. Rode com `npm run test:emulator` (precisa de Java).
 * O modelo de dados está descrito em docs/plano-melhoria-jokenpo.md, seção 3.
 */

const TIMESTAMP = { '.sv': 'timestamp' };
const ROOM = 'rooms/AB23';
const MATCH = 'm1';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const NONCE = '0'.repeat(32);

let env: RulesTestEnvironment;

const db = (uid?: string) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database();

const newPlayer = (uid: string) => ({ uid, seenAt: TIMESTAMP, joinedAt: TIMESTAMP });

const newRoom = (uid: string) => ({
  createdAt: TIMESTAMP,
  bestOf: 0,
  choiceSeconds: 15,
  currentMatch: MATCH,
  players: { player1: newPlayer(uid) },
});

/** Grava dados sem passar pelas regras, para montar o cenário. */
async function seed(path: string, value: unknown) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref(path).set(value);
  });
}

/** Sala com alice como player1 e bob como player2. */
async function seedFullRoom(extra: Record<string, unknown> = {}) {
  const now = Date.now();
  const player = (uid: string) => ({ uid, connections: { c1: true }, seenAt: now, joinedAt: now });
  await seed(ROOM, {
    createdAt: now,
    bestOf: 0,
    choiceSeconds: 15,
    currentMatch: MATCH,
    players: { player1: player('alice'), player2: player('bob') },
    ...extra,
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-jokenpo',
    database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
});

describe('acesso geral', () => {
  it('sem login, não lê nem cria sala', async () => {
    await seedFullRoom();
    await assertFails(db().ref(ROOM).get());
    await assertFails(db().ref('rooms/ZZ99').set(newRoom('x')));
  });

  it('logado, lê uma sala pelo código mas não lista as salas', async () => {
    await seedFullRoom();
    await assertSucceeds(db('carol').ref(ROOM).get());
    await assertFails(db('carol').ref('rooms').get());
  });

  it('nada fora de rooms/ pode ser escrito', async () => {
    await assertFails(db('alice').ref('outra/coisa').set(1));
  });
});

describe('criar e apagar sala', () => {
  it('cria sala nova como player1', async () => {
    await assertSucceeds(db('alice').ref(ROOM).set(newRoom('alice')));
  });

  it('rejeita código com caractere ambíguo ou formato errado', async () => {
    // "AB.C" nem chega ao banco: o SDK rejeita "." no caminho. Por isso o teste usa "AB-C".
    for (const code of ['AB0C', 'ABCDE', 'ab23', 'AB-C']) {
      await assertFails(db('alice').ref(`rooms/${code}`).set(newRoom('alice')));
    }
  });

  it('não cria sala em nome de outra pessoa', async () => {
    await assertFails(db('alice').ref(ROOM).set(newRoom('bob')));
  });

  it('não sobrescreve uma sala existente (código repetido)', async () => {
    await seedFullRoom();
    await assertFails(db('carol').ref(ROOM).set(newRoom('carol')));
  });

  it('rejeita campos desconhecidos', async () => {
    await assertFails(db('alice').ref(ROOM).set({ ...newRoom('alice'), scores: { player1: 99 } }));
  });

  it('com os dois na sala, ninguém apaga a sala', async () => {
    await seedFullRoom();
    await assertFails(db('alice').ref(ROOM).remove());
    await assertFails(db('bob').ref(ROOM).remove());
  });

  it('o último jogador na sala a apaga, seja player1 ou player2', async () => {
    await seed(ROOM, newRoomSeed('alice'));
    await assertFails(db('carol').ref(ROOM).remove());
    await assertSucceeds(db('alice').ref(ROOM).remove());

    const now = Date.now();
    await seed(ROOM, {
      createdAt: now,
      bestOf: 0,
      choiceSeconds: 15,
      currentMatch: MATCH,
      players: { player2: { uid: 'bob', connections: { c1: true }, seenAt: now, joinedAt: now } },
    });
    await assertSucceeds(db('bob').ref(ROOM).remove());
  });

  it('qualquer um apaga sala com mais de 24 h', async () => {
    await seed(ROOM, { createdAt: Date.now() - 25 * 3600_000, bestOf: 0, choiceSeconds: 15, currentMatch: MATCH });
    await assertSucceeds(db('carol').ref(ROOM).remove());
  });
});

describe('formato da partida (bestOf)', () => {
  it('aceita 0, 3, 5 e 7 na criação', async () => {
    for (const [i, bestOf] of [0, 3, 5, 7].entries()) {
      await assertSucceeds(db('alice').ref(`rooms/AB2${i + 3}`).set({ ...newRoom('alice'), bestOf }));
    }
  });

  it('recusa outros valores e sala sem formato', async () => {
    await assertFails(db('alice').ref(ROOM).set({ ...newRoom('alice'), bestOf: 4 }));
    const { bestOf: _, ...withoutBestOf } = newRoom('alice');
    await assertFails(db('alice').ref(ROOM).set(withoutBestOf));
  });

  it('não muda depois de criada', async () => {
    await seedFullRoom();
    await assertFails(db('alice').ref(`${ROOM}/bestOf`).set(5));
  });
});

describe('tempo para escolher (choiceSeconds)', () => {
  it('aceita 5, 10 e 15 s na criação', async () => {
    for (const [i, choiceSeconds] of [5, 10, 15].entries()) {
      await assertSucceeds(db('alice').ref(`rooms/AB2${i + 3}`).set({ ...newRoom('alice'), choiceSeconds }));
    }
  });

  it('recusa outros valores e sala sem o campo', async () => {
    await assertFails(db('alice').ref(ROOM).set({ ...newRoom('alice'), choiceSeconds: 3 }));
    const { choiceSeconds: _, ...without } = newRoom('alice');
    await assertFails(db('alice').ref(ROOM).set(without));
  });

  it('não muda depois de criada', async () => {
    await seedFullRoom();
    await assertFails(db('alice').ref(`${ROOM}/choiceSeconds`).set(5));
  });
});

describe('apelidos', () => {
  it('cada um define e remove o próprio apelido', async () => {
    await seedFullRoom();
    await assertSucceeds(db('bob').ref(`${ROOM}/players/player2/name`).set('Bob 🎮'));
    await assertSucceeds(db('bob').ref(`${ROOM}/players/player2/name`).remove());
  });

  it('ninguém muda o apelido do outro', async () => {
    await seedFullRoom();
    await assertFails(db('alice').ref(`${ROOM}/players/player2/name`).set('Perdedor'));
  });

  it('recusa apelido vazio ou longo demais', async () => {
    await seedFullRoom();
    await assertFails(db('bob').ref(`${ROOM}/players/player2/name`).set(''));
    await assertFails(db('bob').ref(`${ROOM}/players/player2/name`).set('x'.repeat(41)));
  });

  it('20 emojis (o máximo do domínio) cabem na regra', async () => {
    await seedFullRoom();
    await assertSucceeds(db('bob').ref(`${ROOM}/players/player2/name`).set('😀'.repeat(20)));
  });
});

describe('vagas de jogador', () => {
  it('entra na vaga livre de player2', async () => {
    await seed(ROOM, newRoomSeed('alice'));
    await assertSucceeds(db('bob').ref(`${ROOM}/players/player2`).set(newPlayer('bob')));
  });

  it('não ocupa as duas vagas com o mesmo uid', async () => {
    await seed(ROOM, newRoomSeed('alice'));
    await assertFails(db('alice').ref(`${ROOM}/players/player2`).set(newPlayer('alice')));
  });

  it('não toma vaga ocupada', async () => {
    await seedFullRoom();
    await assertFails(db('carol').ref(`${ROOM}/players/player2`).set(newPlayer('carol')));
  });

  it('não entra em sala que não existe', async () => {
    await assertFails(db('bob').ref(`${ROOM}/players/player2`).set(newPlayer('bob')));
  });

  it('o dono abre e fecha conexões (abas) e sai da sala', async () => {
    await seedFullRoom();
    await assertSucceeds(db('bob').ref(`${ROOM}/players/player2`).update({ 'connections/c2': true, seenAt: TIMESTAMP }));
    await assertSucceeds(db('bob').ref(`${ROOM}/players/player2`).update({ 'connections/c1': null, seenAt: TIMESTAMP }));
    await assertSucceeds(db('bob').ref(`${ROOM}/players/player2`).remove());
  });

  it('ninguém mexe nas conexões de outro jogador', async () => {
    await seedFullRoom();
    await assertFails(db('alice').ref(`${ROOM}/players/player2/connections/x`).set(true));
    await assertFails(db('alice').ref(`${ROOM}/players/player2/connections/c1`).remove());
  });

  it('conexão só aceita o valor true e um id simples', async () => {
    await seedFullRoom();
    await assertFails(db('bob').ref(`${ROOM}/players/player2/connections/c2`).set('sim'));
    await assertFails(db('bob').ref(`${ROOM}/players/player2/connections/${'x'.repeat(41)}`).set(true));
  });

  it('vaga sem conexões há mais de 60 s pode ser liberada por outro', async () => {
    await seedFullRoom();
    await seed(`${ROOM}/players/player2`, { uid: 'bob', seenAt: Date.now() - 61_000, joinedAt: 1 });
    await assertSucceeds(db('carol').ref(`${ROOM}/players/player2`).remove());
  });

  it('vaga sem conexões há pouco tempo não pode ser liberada', async () => {
    await seedFullRoom();
    await seed(`${ROOM}/players/player2`, { uid: 'bob', seenAt: Date.now() - 5_000, joinedAt: 1 });
    await assertFails(db('carol').ref(`${ROOM}/players/player2`).remove());
  });

  it('vaga com alguma conexão ativa nunca é liberada por outro, mesmo com sinal antigo', async () => {
    await seedFullRoom();
    await seed(`${ROOM}/players/player2`, { uid: 'bob', connections: { c9: true }, seenAt: Date.now() - 600_000, joinedAt: 1 });
    await assertFails(db('carol').ref(`${ROOM}/players/player2`).remove());
  });
});

describe('commit-reveal', () => {
  const round = (n: number) => `${ROOM}/matches/${MATCH}/rounds/${n}`;

  const commit = (hash: string) => ({ commit: hash, at: TIMESTAMP });

  it('cada jogador grava o commit só na própria vaga', async () => {
    await seedFullRoom();
    await assertSucceeds(db('alice').ref(`${round(0)}/player1`).update(commit(HASH_A)));
    await assertFails(db('alice').ref(`${round(0)}/player2`).update(commit(HASH_B)));
    await assertFails(db('carol').ref(`${round(0)}/player2`).update(commit(HASH_B)));
  });

  it('o commit não pode ser trocado depois de gravado', async () => {
    await seedFullRoom();
    await assertSucceeds(db('alice').ref(`${round(0)}/player1`).update(commit(HASH_A)));
    await assertFails(db('alice').ref(`${round(0)}/player1/commit`).set(HASH_B));
    await assertFails(db('alice').ref(`${round(0)}/player1/at`).set(TIMESTAMP));
  });

  it('o commit exige o horário, e o horário tem de ser o do servidor', async () => {
    await seedFullRoom();
    await assertFails(db('alice').ref(`${round(0)}/player1/commit`).set(HASH_A));
    await assertFails(db('alice').ref(`${round(0)}/player1`).update({ commit: HASH_A, at: 1 }));
  });

  it('rejeita commit fora do formato SHA-256 hex', async () => {
    await seedFullRoom();
    await assertFails(db('alice').ref(`${round(0)}/player1`).update(commit('rock')));
  });

  it('não revela antes dos dois commits', async () => {
    await seedFullRoom();
    await seed(`${round(0)}/player1`, { commit: HASH_A, at: Date.now() });
    await assertFails(db('alice').ref(`${round(0)}/player1/reveal`).set({ move: 'rock', nonce: NONCE, at: TIMESTAMP }));
  });

  it('revela depois dos dois commits, uma única vez', async () => {
    await seedFullRoom();
    await seed(round(0), { player1: { commit: HASH_A, at: Date.now() }, player2: { commit: HASH_B, at: Date.now() } });
    await assertSucceeds(db('alice').ref(`${round(0)}/player1/reveal`).set({ move: 'rock', nonce: NONCE, at: TIMESTAMP }));
    await assertFails(db('alice').ref(`${round(0)}/player1/reveal`).set({ move: 'paper', nonce: NONCE, at: TIMESTAMP }));
  });

  it('o horário do reveal tem de ser o do servidor', async () => {
    await seedFullRoom();
    await seed(round(0), { player1: { commit: HASH_A, at: Date.now() }, player2: { commit: HASH_B, at: Date.now() } });
    await assertFails(db('alice').ref(`${round(0)}/player1/reveal`).set({ move: 'rock', nonce: NONCE, at: 1 }));
  });

  it('rejeita jogada inválida no reveal', async () => {
    await seedFullRoom();
    await seed(round(0), { player1: { commit: HASH_A, at: Date.now() }, player2: { commit: HASH_B, at: Date.now() } });
    await assertFails(db('alice').ref(`${round(0)}/player1/reveal`).set({ move: 'lizard', nonce: NONCE, at: TIMESTAMP }));
  });

  it('só aceita jogadas na partida atual', async () => {
    await seedFullRoom();
    await assertFails(db('alice').ref(`${ROOM}/matches/antiga/rounds/0/player1`).update(commit(HASH_A)));
  });
});

describe('reset (nova partida)', () => {
  it('jogador pede reset em nome próprio', async () => {
    await seedFullRoom();
    await assertSucceeds(db('alice').ref(`${ROOM}/resetRequest`).set({ by: 'alice', at: TIMESTAMP }));
    await assertFails(db('alice').ref(`${ROOM}/resetRequest`).set({ by: 'bob', at: TIMESTAMP }));
    await assertFails(db('carol').ref(`${ROOM}/resetRequest`).set({ by: 'carol', at: TIMESTAMP }));
  });

  it('quem pediu não troca a partida sozinho; o outro jogador aceita', async () => {
    await seedFullRoom({ resetRequest: { by: 'alice', at: Date.now() } });
    await assertFails(db('alice').ref(`${ROOM}/currentMatch`).set('m2'));
    await assertSucceeds(db('bob').ref(`${ROOM}/currentMatch`).set('m2'));
  });

  it('sem pedido de reset, ninguém troca a partida com os dois na sala', async () => {
    await seedFullRoom();
    await assertFails(db('bob').ref(`${ROOM}/currentMatch`).set('m2'));
  });

  it('sozinho na sala, o jogador começa nova partida', async () => {
    await seed(ROOM, newRoomSeed('alice'));
    await assertSucceeds(db('alice').ref(`${ROOM}/currentMatch`).set('m2'));
  });
});

function newRoomSeed(uid: string) {
  const now = Date.now();
  return {
    createdAt: now,
    bestOf: 0,
    choiceSeconds: 15,
    currentMatch: MATCH,
    players: { player1: { uid, connections: { c1: true }, seenAt: now, joinedAt: now } },
  };
}
