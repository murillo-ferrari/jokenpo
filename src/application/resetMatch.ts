import { generateMatchId } from '../domain/match';
import type { PlayerId, RoomCode } from '../domain/types';
import type { Random, RoomGateway } from './ports';

/*
 * Reset = começar uma partida nova na mesma sala. A partida anterior fica gravada;
 * o placar zera porque é calculado só a partir das rodadas da partida atual.
 * As regras do banco só deixam trocar de partida quem aceita o pedido do outro
 * (ou quem está sozinho na sala).
 */

export function requestReset(deps: { gateway: RoomGateway }, code: RoomCode, by: PlayerId): Promise<void> {
  return deps.gateway.requestReset(code, by);
}

export function acceptReset(deps: { gateway: RoomGateway; random: Random }, code: RoomCode): Promise<void> {
  return deps.gateway.startNewMatch(code, generateMatchId(() => deps.random.next()));
}

/** Recusar (quem recebeu) e cancelar (quem pediu) apagam o pedido do mesmo jeito. */
export function dismissReset(deps: { gateway: RoomGateway }, code: RoomCode): Promise<void> {
  return deps.gateway.clearResetRequest(code);
}

/** Sozinho na sala (o adversário saiu), o jogador começa uma partida nova para o próximo. */
export const startFreshMatch = acceptReset;
