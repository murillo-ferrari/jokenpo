import { SLOTS, opponentOf, type MatchId, type PlayerId, type PlayerSlot, type RoomCode, type RoundRecord } from './types';

/**
 * Tempo desconectado depois do qual a vaga de um jogador pode ser liberada por outra pessoa.
 * Deve bater com o `60000` da regra `players/$slot` em database.rules.json.
 */
export const STALE_PLAYER_MS = 60_000;

export interface PlayerPresence {
  id: PlayerId;
  connected: boolean;
  /** Último horário (servidor, ms) em que a conexão mudou de estado. */
  seenAt: number;
  joinedAt: number;
}

export interface ResetRequest {
  by: PlayerId;
  at: number;
}

/** A sala como o jogo enxerga: só a partida atual importa. */
export interface Room {
  code: RoomCode;
  createdAt: number;
  players: Partial<Record<PlayerSlot, PlayerPresence>>;
  currentMatch: MatchId;
  /** Rodadas da partida atual, em ordem (índice = número da rodada). */
  rounds: (RoundRecord | undefined)[];
  resetRequest: ResetRequest | null;
}

export function slotOf(room: Room, player: PlayerId): PlayerSlot | null {
  return SLOTS.find((slot) => room.players[slot]?.id === player) ?? null;
}

export function isStale(presence: PlayerPresence, now: number): boolean {
  return !presence.connected && now - presence.seenAt > STALE_PLAYER_MS;
}

export type OpponentStatus = 'absent' | 'connected' | 'disconnected' | 'stale';

export function opponentStatus(room: Room, mySlot: PlayerSlot, now: number): OpponentStatus {
  const opponent = room.players[opponentOf(mySlot)];
  if (!opponent) return 'absent';
  if (opponent.connected) return 'connected';
  return isStale(opponent, now) ? 'stale' : 'disconnected';
}

/** Vaga que um novo jogador pode ocupar: livre, ou abandonada há tempo suficiente. */
export type SlotAvailability = { slot: PlayerSlot; mustRelease: boolean } | null;

export function availableSlot(room: Room, now: number): SlotAvailability {
  const free = SLOTS.find((slot) => !room.players[slot]);
  if (free) return { slot: free, mustRelease: false };
  const abandoned = SLOTS.find((slot) => {
    const presence = room.players[slot];
    return presence !== undefined && isStale(presence, now);
  });
  return abandoned ? { slot: abandoned, mustRelease: true } : null;
}

export function isAlone(room: Room, mySlot: PlayerSlot): boolean {
  return !room.players[opponentOf(mySlot)];
}
