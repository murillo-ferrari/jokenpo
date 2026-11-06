import { describe, expect, it } from 'vitest';
import type { RoomCode } from '../src/domain/types';
import { toRoom, toRounds } from '../src/infrastructure/firebase/roomMapper';

const CODE = 'AB23' as RoomCode;
const HASH = 'a'.repeat(64);
const NONCE = 'b'.repeat(32);
const presence = (uid: string) => ({ uid, connected: true, seenAt: 5, joinedAt: 1 });

describe('toRoom', () => {
  it('converte a sala e pega só as rodadas da partida atual', () => {
    const room = toRoom(CODE, {
      createdAt: 1,
      currentMatch: 'm2',
      players: { player1: presence('alice'), player2: presence('bob') },
      matches: {
        m1: { rounds: [{ player1: { commit: HASH } }] },
        m2: { rounds: [{ player1: { commit: HASH, reveal: { move: 'rock', nonce: NONCE, at: 9 } } }] },
      },
      resetRequest: { by: 'bob', at: 7 },
    });
    expect(room).toEqual({
      code: CODE,
      createdAt: 1,
      currentMatch: 'm2',
      players: {
        player1: { id: 'alice', connected: true, seenAt: 5, joinedAt: 1 },
        player2: { id: 'bob', connected: true, seenAt: 5, joinedAt: 1 },
      },
      rounds: [{ player1: { commit: HASH, reveal: { move: 'rock', nonce: NONCE, at: 9 } } }],
      resetRequest: { by: 'bob', at: 7 },
    });
  });

  it('sala inexistente ou sem os campos obrigatórios vira null', () => {
    expect(toRoom(CODE, null)).toBeNull();
    expect(toRoom(CODE, { createdAt: 1 })).toBeNull();
  });

  it('jogador malformado é tratado como vaga vazia', () => {
    const room = toRoom(CODE, { createdAt: 1, currentMatch: 'm1', players: { player1: { uid: 'alice' } } });
    expect(room?.players).toEqual({});
  });

  it('partida sem rodadas e sem pedido de reset', () => {
    const room = toRoom(CODE, { createdAt: 1, currentMatch: 'm1', players: { player1: presence('alice') } });
    expect(room?.rounds).toEqual([]);
    expect(room?.resetRequest).toBeNull();
  });
});

describe('toRounds', () => {
  const round = { player1: { commit: HASH } };

  it('aceita rodadas em array (chaves sequenciais)', () => {
    expect(toRounds([round, round])).toEqual([round, round]);
  });

  it('aceita rodadas em objeto (chaves esparsas), deixando buracos', () => {
    const rounds = toRounds({ '0': round, '2': round });
    expect(rounds).toHaveLength(3);
    expect(rounds[1]).toBeUndefined();
    expect(rounds[2]).toEqual(round);
  });

  it('ignora chaves que não são números de rodada', () => {
    expect(toRounds({ abc: round, '-1': round })).toEqual([]);
  });

  it('descarta reveal com jogada inválida, mantendo o commit', () => {
    expect(toRounds([{ player1: { commit: HASH, reveal: { move: 'lizard', nonce: NONCE, at: 1 } } }])).toEqual([
      { player1: { commit: HASH } },
    ]);
  });
});
