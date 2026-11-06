import type { Move, RoundOutcome } from './types';

/** Para cada jogada, a jogada que ela vence. */
const BEATS: Readonly<Record<Move, Move>> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

export function beats(move: Move, other: Move): boolean {
  return BEATS[move] === other;
}

/** Decide a rodada a partir das duas jogadas. */
export function resolveRound(player1: Move, player2: Move): RoundOutcome {
  if (player1 === player2) return 'tie';
  return beats(player1, player2) ? 'player1' : 'player2';
}
