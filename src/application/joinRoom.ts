import { availableSlot, slotOf } from '../domain/room';
import { parseRoomCode, type RoomCodeError } from '../domain/roomCode';
import type { PlayerId, PlayerSlot, RoomCode } from '../domain/types';
import type { Clock, RoomGateway } from './ports';

export type JoinError = RoomCodeError | 'not-found' | 'full';

export type JoinResult = { ok: true; code: RoomCode; slot: PlayerSlot } | { ok: false; error: JoinError };

/** Uma segunda tentativa cobre a corrida de dois jogadores disputando a mesma vaga. */
const MAX_ATTEMPTS = 2;

/**
 * Entra numa sala pelo código digitado. Quem já está na sala (por exemplo, depois de um F5)
 * volta para a mesma vaga. Vaga abandonada há mais de 60 s é liberada e ocupada.
 */
export async function joinRoom(
  deps: { gateway: RoomGateway; clock: Clock },
  input: string,
  player: PlayerId,
): Promise<JoinResult> {
  const parsed = parseRoomCode(input);
  if (!parsed.ok) return parsed;
  const { code } = parsed;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const room = await deps.gateway.get(code);
    if (!room) return { ok: false, error: 'not-found' };

    const current = slotOf(room, player);
    if (current) return { ok: true, code, slot: current };

    const available = availableSlot(room, deps.clock.now());
    if (!available) return { ok: false, error: 'full' };

    if (available.mustRelease) await deps.gateway.releaseSlot(code, available.slot);
    if (await deps.gateway.claimSlot(code, available.slot, player)) return { ok: true, code, slot: available.slot };
  }
  return { ok: false, error: 'full' };
}
