import { GameSession } from './application/gameSession';
import type { Clock } from './application/ports';
import { toPlayerId, type BestOf } from './domain/types';
import { cryptoRandom } from './infrastructure/browser/cryptoRandom';
import { ComputerOpponent, type ComputerOpponentOptions } from './infrastructure/local/computerOpponent';
import { MemoryRoomGateway, MemoryRoomServer, MemorySessionStore } from './infrastructure/local/memoryRooms';
import type { ComputerGame } from './ui/App';

/**
 * Monta uma partida contra o computador, toda em memória (funciona sem internet).
 * Faz parte do composition root: liga a infraestrutura local ao GameSession.
 */
export async function startComputerGame(
  bestOf: BestOf,
  nickname: string | null,
  options: ComputerOpponentOptions = {},
): Promise<ComputerGame> {
  const clock: Clock = { now: () => Date.now() };
  const server = new MemoryRoomServer(clock);
  const human = toPlayerId('human');
  const computer = new ComputerOpponent(server, toPlayerId('computer'), cryptoRandom, options);
  const store = new MemorySessionStore();
  store.saveNickname(nickname);

  const session = new GameSession({
    identity: { ensurePlayer: async () => human },
    gateway: new MemoryRoomGateway(server, human),
    clock,
    random: cryptoRandom,
    store,
    vsComputer: true,
  });
  await session.start();
  await session.createRoom(bestOf);

  return {
    session,
    dispose() {
      session.dispose();
      computer.dispose();
    },
  };
}
