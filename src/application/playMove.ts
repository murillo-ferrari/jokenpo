import { commitFor } from '../domain/commitment';
import type { MatchId, Move, PlayerSlot, RoomCode } from '../domain/types';
import type { PendingMove, Random, RoomGateway, SessionStore } from './ports';

export interface RoundContext {
  code: RoomCode;
  matchId: MatchId;
  round: number;
  slot: PlayerSlot;
}

const NONCE_LENGTH = 32;

/**
 * Primeira metade da jogada: publica só o hash. A jogada e o nonce ficam guardados
 * neste navegador (antes de publicar, para sobreviver a um F5) até a hora de revelar.
 */
export async function commitMove(
  deps: { gateway: RoomGateway; random: Random; store: SessionStore },
  context: RoundContext,
  move: Move,
): Promise<void> {
  const nonce = deps.random.hex(NONCE_LENGTH);
  const pending: PendingMove = { code: context.code, matchId: context.matchId, round: context.round, move, nonce };
  deps.store.savePendingMove(pending);
  try {
    await deps.gateway.commit(context.code, context.matchId, context.round, context.slot, commitFor(move, nonce));
  } catch (error) {
    deps.store.savePendingMove(null);
    throw error;
  }
}

/** Segunda metade: publica a jogada e o nonce, depois que os dois commits existem. */
export async function revealMove(deps: { gateway: RoomGateway }, context: RoundContext, pending: PendingMove): Promise<void> {
  await deps.gateway.reveal(context.code, context.matchId, context.round, context.slot, pending.move, pending.nonce);
}

/** A jogada guardada pertence a esta rodada? */
export function isPendingFor(pending: PendingMove | null, context: Omit<RoundContext, 'slot'>): pending is PendingMove {
  return (
    pending !== null &&
    pending.code === context.code &&
    pending.matchId === context.matchId &&
    pending.round === context.round
  );
}
