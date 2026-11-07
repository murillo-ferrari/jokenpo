import type { Move } from '../../domain/types';

/** Mesma ordem do nome do jogo: jo (pedra), ken (papel), pô (tesoura). */
export const MOVE_ORDER: readonly Move[] = ['rock', 'paper', 'scissors'];

export const MOVE_EMOJI: Record<Move, string> = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
};
