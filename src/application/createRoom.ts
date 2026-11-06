import { generateMatchId } from '../domain/match';
import { generateRoomCode } from '../domain/roomCode';
import type { BestOf, PlayerId, RoomCode } from '../domain/types';
import type { Random, RoomGateway } from './ports';

/** Com 31⁴ ≈ 923 mil códigos, repetir 5 vezes seguidas só acontece se algo estiver errado. */
const MAX_ATTEMPTS = 5;

/**
 * Cria uma sala com código livre. Se o código sorteado já existir, sorteia outro:
 * nunca entra na sala de outra pessoa (bug B5 do app antigo).
 */
export async function createRoom(
  deps: { gateway: RoomGateway; random: Random },
  host: PlayerId,
  options: { hostName: string | null; bestOf: BestOf },
): Promise<RoomCode> {
  const random = () => deps.random.next();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode(random);
    if (await deps.gateway.create({ code, host, matchId: generateMatchId(random), ...options })) return code;
  }
  throw new Error(`Nenhum código de sala livre em ${MAX_ATTEMPTS} tentativas.`);
}
