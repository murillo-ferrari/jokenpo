import { describe, expect, it } from 'vitest';
import { beats, resolveRound } from '../src/domain/rules';
import type { Move, RoundOutcome } from '../src/domain/types';

describe('resolveRound', () => {
  const cases: [Move, Move, RoundOutcome][] = [
    ['rock', 'rock', 'tie'],
    ['rock', 'paper', 'player2'],
    ['rock', 'scissors', 'player1'],
    ['paper', 'rock', 'player1'],
    ['paper', 'paper', 'tie'],
    ['paper', 'scissors', 'player2'],
    ['scissors', 'rock', 'player2'],
    ['scissors', 'paper', 'player1'],
    ['scissors', 'scissors', 'tie'],
  ];

  it.each(cases)('%s × %s → %s', (player1, player2, expected) => {
    expect(resolveRound(player1, player2)).toBe(expected);
  });
});

describe('beats', () => {
  it('pedra quebra tesoura, tesoura corta papel, papel cobre pedra', () => {
    expect(beats('rock', 'scissors')).toBe(true);
    expect(beats('scissors', 'paper')).toBe(true);
    expect(beats('paper', 'rock')).toBe(true);
  });

  it('nenhuma jogada vence a si mesma', () => {
    expect(beats('rock', 'rock')).toBe(false);
  });
});
