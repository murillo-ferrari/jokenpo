/**
 * Tipos do domínio do Jokenpô. Nada aqui conhece Firebase, DOM ou relógio:
 * o que vem de fora (horário, aleatoriedade) entra por parâmetro.
 */

/** Identificador estável de um jogador. Sobrevive a recarregamentos da página. */
export type PlayerId = string & { readonly __brand: 'PlayerId' };

export function toPlayerId(value: string): PlayerId {
  if (value.trim() === '') throw new Error('PlayerId não pode ser vazio.');
  return value as PlayerId;
}

export const MOVES = ['rock', 'paper', 'scissors'] as const;
export type Move = (typeof MOVES)[number];

export function isMove(value: unknown): value is Move {
  return typeof value === 'string' && (MOVES as readonly string[]).includes(value);
}

export const SLOTS = ['player1', 'player2'] as const;
export type PlayerSlot = (typeof SLOTS)[number];

export function opponentOf(slot: PlayerSlot): PlayerSlot {
  return slot === 'player1' ? 'player2' : 'player1';
}

/** Resultado de uma rodada do ponto de vista neutro: quem venceu, ou empate. */
export type RoundOutcome = PlayerSlot | 'tie';

/** Código de sala já validado (ver `roomCode.ts`). */
export type RoomCode = string & { readonly __brand: 'RoomCode' };

/** Identificador de uma partida dentro da sala. Um reset aceito cria uma partida nova. */
export type MatchId = string & { readonly __brand: 'MatchId' };

/** Fonte de aleatoriedade injetada: devolve um número em [0, 1). */
export type RandomSource = () => number;

/** A jogada aberta, que só é publicada depois dos dois commits. */
export interface Reveal {
  move: Move;
  /** 32 caracteres hexadecimais, sorteados por jogada. Impede adivinhar a jogada pelo hash. */
  nonce: string;
  /** Horário do servidor (ms) em que a jogada foi revelada. */
  at: number;
}

/** O que um jogador gravou em uma rodada. */
export interface SlotEntry {
  /** SHA-256 em hexadecimal de `commitmentPayload(move, nonce)`. */
  commit: string;
  reveal?: Reveal;
}

/** Uma rodada como está gravada: cada jogador pode ainda não ter jogado. */
export type RoundRecord = Partial<Record<PlayerSlot, SlotEntry>>;
