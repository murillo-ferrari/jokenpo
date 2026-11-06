import { isAlone, type Room } from '../domain/room';
import type { PlayerSlot } from '../domain/types';
import type { RoomGateway } from './ports';

/** Sai da sala. O último a sair apaga a sala, liberando o código. */
export async function leaveRoom(deps: { gateway: RoomGateway }, room: Room, slot: PlayerSlot): Promise<void> {
  if (isAlone(room, slot)) await deps.gateway.deleteRoom(room.code);
  else await deps.gateway.releaseSlot(room.code, slot);
}
