import { verifyReveal } from './commitment';
import { resolveRound } from './rules';
import {
  SLOTS,
  opponentOf,
  type MatchId,
  type Move,
  type PlayerSlot,
  type RandomSource,
  type RoundOutcome,
  type RoundRecord,
} from './types';

/*
 * O placar não é gravado em lugar nenhum: é sempre calculado a partir das rodadas.
 * Os dois jogadores leem os mesmos dados e chegam ao mesmo placar, sem um "dono"
 * que possa alterá-lo e sem corrida entre quem atualiza o quê.
 */

/** Prazo para revelar a jogada depois que o adversário revelou a dele. */
export const DEFAULT_REVEAL_TIMEOUT_MS = 15_000;

/** Como a rodada terminou. */
export type RoundEnding =
  /** As duas jogadas foram reveladas e conferem com os commits. */
  | 'played'
  /** Um jogador revelou algo que não confere com o commit dele. */
  | 'invalid-reveal'
  /** Um jogador não revelou dentro do prazo. */
  | 'reveal-timeout'
  /** Nenhum dos dois revelou algo válido: conta como empate. */
  | 'void';

export interface CompletedRound {
  index: number;
  outcome: RoundOutcome;
  ending: RoundEnding;
  /** Jogadas válidas reveladas (pode faltar a de quem perdeu por W.O.). */
  moves: Partial<Record<PlayerSlot, Move>>;
}

export type PendingRound =
  | { index: number; phase: 'choosing'; committed: Record<PlayerSlot, boolean> }
  | {
      index: number;
      phase: 'revealing';
      revealed: Record<PlayerSlot, boolean>;
      /** Até quando o atrasado pode revelar; `null` enquanto ninguém revelou. */
      deadline: number | null;
    };

export type RoundEvaluation = { status: 'complete'; round: CompletedRound } | { status: 'pending'; round: PendingRound };

export interface MatchSummary {
  scores: Record<PlayerSlot, number>;
  ties: number;
  history: CompletedRound[];
  /** A rodada em andamento: sempre existe, já que a partida não tem fim (por enquanto). */
  current: PendingRound;
}

export interface EvaluateOptions {
  /** Horário atual do servidor (ms). Só influencia rodadas ainda abertas. */
  now: number;
  revealTimeoutMs?: number;
}

function complete(index: number, outcome: RoundOutcome, ending: RoundEnding, moves: CompletedRound['moves']): RoundEvaluation {
  return { status: 'complete', round: { index, outcome, ending, moves } };
}

/**
 * Avalia uma rodada. O resultado de uma rodada concluída depende só dos dados gravados
 * (inclusive dos horários dos reveals), nunca de `now`: um resultado mostrado não muda depois.
 */
export function evaluateRound(record: RoundRecord | undefined, index: number, options: EvaluateOptions): RoundEvaluation {
  const timeout = options.revealTimeoutMs ?? DEFAULT_REVEAL_TIMEOUT_MS;
  const entry = (slot: PlayerSlot) => record?.[slot];

  const committed = { player1: Boolean(entry('player1')?.commit), player2: Boolean(entry('player2')?.commit) };
  if (!committed.player1 || !committed.player2) {
    return { status: 'pending', round: { index, phase: 'choosing', committed } };
  }

  // Reveals que conferem com o commit; `false` = revelou algo inválido; `undefined` = não revelou.
  const validity = {} as Record<PlayerSlot, boolean | undefined>;
  const moves: Partial<Record<PlayerSlot, Move>> = {};
  for (const slot of SLOTS) {
    const slotEntry = entry(slot);
    const reveal = slotEntry?.reveal;
    if (!slotEntry || !reveal) continue;
    validity[slot] = verifyReveal(slotEntry.commit, reveal);
    if (validity[slot]) moves[slot] = reveal.move;
  }

  // Reveal inválido decide na hora, a favor do adversário (se o adversário não trapaceou também).
  const invalid = SLOTS.filter((slot) => validity[slot] === false);
  if (invalid.length === 2) return complete(index, 'tie', 'void', moves);
  const [cheater] = invalid;
  if (cheater) return complete(index, opponentOf(cheater), 'invalid-reveal', moves);

  const revealAt = (slot: PlayerSlot) => entry(slot)?.reveal?.at;
  const p1At = revealAt('player1');
  const p2At = revealAt('player2');

  if (p1At !== undefined && p2At !== undefined) {
    // Os dois revelaram, mas um pode ter revelado depois do prazo.
    if (p2At > p1At + timeout) return complete(index, 'player1', 'reveal-timeout', moves);
    if (p1At > p2At + timeout) return complete(index, 'player2', 'reveal-timeout', moves);
    return complete(index, resolveRound(moves.player1 as Move, moves.player2 as Move), 'played', moves);
  }

  const firstAt = p1At ?? p2At;
  if (firstAt === undefined) {
    return {
      status: 'pending',
      round: { index, phase: 'revealing', revealed: { player1: false, player2: false }, deadline: null },
    };
  }

  const revealer: PlayerSlot = p1At !== undefined ? 'player1' : 'player2';
  const deadline = firstAt + timeout;
  if (options.now > deadline) return complete(index, revealer, 'reveal-timeout', moves);

  return {
    status: 'pending',
    round: {
      index,
      phase: 'revealing',
      revealed: { player1: revealer === 'player1', player2: revealer === 'player2' },
      deadline,
    },
  };
}

/**
 * Calcula o estado da partida a partir das rodadas gravadas, em ordem (índice = número da rodada).
 * Rodadas depois da primeira em aberto são ignoradas.
 */
export function summarize(rounds: readonly (RoundRecord | undefined)[], options: EvaluateOptions): MatchSummary {
  const scores: Record<PlayerSlot, number> = { player1: 0, player2: 0 };
  const history: CompletedRound[] = [];
  let ties = 0;

  for (let index = 0; ; index += 1) {
    const evaluation = evaluateRound(rounds[index], index, options);
    if (evaluation.status === 'pending') {
      return { scores, ties, history, current: evaluation.round };
    }
    const { round } = evaluation;
    history.push(round);
    if (round.outcome === 'tie') ties += 1;
    else scores[round.outcome] += 1;
  }
}

const MATCH_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const MATCH_ID_LENGTH = 10;

/** Sorteia o id de uma nova partida (compatível com a regex de `$matchId` nas regras). */
export function generateMatchId(random: RandomSource): MatchId {
  let id = '';
  for (let i = 0; i < MATCH_ID_LENGTH; i += 1) {
    id += MATCH_ID_ALPHABET[Math.floor(random() * MATCH_ID_ALPHABET.length)];
  }
  return id as MatchId;
}
