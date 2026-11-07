import { describe, expect, it } from 'vitest';
import type { RoomCode } from '../src/domain/types';
import { toRoom, toRounds } from '../src/infrastructure/firebase/roomMapper';

const CODE = 'AB23' as RoomCode;
const HASH = 'a'.repeat(64);
const NONCE = 'b'.repeat(32);
const presence = (uid: string) => ({ uid, connections: { c1: true }, seenAt: 5, joinedAt: 1 });

describe('toRoom', () => {
  it('converte a sala e pega só as rodadas da partida atual', () => {
    const room = toRoom(CODE, {
      createdAt: 1,
      currentMatch: 'm2',
      players: { player1: presence('alice'), player2: presence('bob') },
      matches: {
        m1: { rounds: [{ player1: { commit: HASH, at: 3 } }] },
        m2: { rounds: [{ player1: { commit: HASH, at: 3, reveal: { move: 'rock', nonce: NONCE, at: 9 } } }] },
      },
      resetRequest: { by: 'bob', at: 7 },
    });
    expect(room).toEqual({
      code: CODE,
      createdAt: 1,
      bestOf: 0,
      choiceSeconds: 15,
      currentMatch: 'm2',
      players: {
        player1: { id: 'alice', name: null, connected: true, seenAt: 5, joinedAt: 1 },
        player2: { id: 'bob', name: null, connected: true, seenAt: 5, joinedAt: 1 },
      },
      rounds: [{ player1: { commit: HASH, committedAt: 3, reveal: { move: 'rock', nonce: NONCE, at: 9 } } }],
      resetRequest: { by: 'bob', at: 7 },
    });
  });

  it('sala inexistente ou sem os campos obrigatórios vira null', () => {
    expect(toRoom(CODE, null)).toBeNull();
    expect(toRoom(CODE, { createdAt: 1 })).toBeNull();
  });

  it('conectado = alguma conexão ativa; sem conexões, desconectado', () => {
    const room = toRoom(CODE, {
      createdAt: 1,
      currentMatch: 'm1',
      players: {
        player1: { uid: 'alice', connections: { a: true, b: true }, seenAt: 5, joinedAt: 1 },
        player2: { uid: 'bob', seenAt: 5, joinedAt: 1 },
      },
    });
    expect(room?.players.player1?.connected).toBe(true);
    expect(room?.players.player2?.connected).toBe(false);
  });

  it('jogador malformado é tratado como vaga vazia', () => {
    const room = toRoom(CODE, { createdAt: 1, currentMatch: 'm1', players: { player1: { uid: 'alice' } } });
    expect(room?.players).toEqual({});
  });

  it('lê formato e apelidos; formato desconhecido vira partida livre', () => {
    const room = toRoom(CODE, {
      createdAt: 1,
      bestOf: 5,
      currentMatch: 'm1',
      players: { player1: { ...presence('alice'), name: 'Alice' } },
    });
    expect(room?.bestOf).toBe(5);
    expect(room?.players.player1?.name).toBe('Alice');
    expect(toRoom(CODE, { createdAt: 1, bestOf: 4, currentMatch: 'm1' })?.bestOf).toBe(0);
  });

  it('lê o tempo para escolher; valor desconhecido vira o padrão (15 s)', () => {
    expect(toRoom(CODE, { createdAt: 1, choiceSeconds: 5, currentMatch: 'm1' })?.choiceSeconds).toBe(5);
    expect(toRoom(CODE, { createdAt: 1, choiceSeconds: 7, currentMatch: 'm1' })?.choiceSeconds).toBe(15);
  });

  it('partida sem rodadas e sem pedido de reset', () => {
    const room = toRoom(CODE, { createdAt: 1, currentMatch: 'm1', players: { player1: presence('alice') } });
    expect(room?.rounds).toEqual([]);
    expect(room?.resetRequest).toBeNull();
  });
});

describe('toRounds', () => {
  const round = { player1: { commit: HASH, at: 3 } };
  const mapped = { player1: { commit: HASH, committedAt: 3 } };

  it('aceita rodadas em array (chaves sequenciais)', () => {
    expect(toRounds([round, round])).toEqual([mapped, mapped]);
  });

  it('aceita rodadas em objeto (chaves esparsas), deixando buracos', () => {
    const rounds = toRounds({ '0': round, '2': round });
    expect(rounds).toHaveLength(3);
    expect(rounds[1]).toBeUndefined();
    expect(rounds[2]).toEqual(mapped);
  });

  it('ignora chaves que não são números de rodada', () => {
    expect(toRounds({ abc: round, '-1': round })).toEqual([]);
  });

  it('descarta reveal com jogada inválida, mantendo o commit', () => {
    expect(toRounds([{ player1: { commit: HASH, at: 3, reveal: { move: 'lizard', nonce: NONCE, at: 1 } } }])).toEqual([
      { player1: { commit: HASH, committedAt: 3 } },
    ]);
  });

  it('commit sem horário não conta como jogada', () => {
    expect(toRounds([{ player1: { commit: HASH } }])).toEqual([]);
  });
});
