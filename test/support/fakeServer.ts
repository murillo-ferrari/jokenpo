import { randomBytes } from 'node:crypto';
import { GameSession } from '../../src/application/gameSession';
import type { Clock, Random } from '../../src/application/ports';
import type { GameView, Notice } from '../../src/application/view';
import { toPlayerId, type PlayerId } from '../../src/domain/types';
import { MemoryRoomGateway, MemoryRoomServer, MemorySessionStore } from '../../src/infrastructure/local/memoryRooms';

/*
 * Apoio dos testes: o servidor em memória de produção (o mesmo do modo contra o computador),
 * com o horário controlado pelo teste.
 */

export class FakeServer extends MemoryRoomServer {
  time = 1_000_000;

  constructor() {
    const clock: Clock = { now: () => this.time };
    super(clock);
  }
}

export { MemoryRoomGateway as FakeGateway, MemorySessionStore as MemoryStore };

/** Gateway que "fica sem rede": enquanto `offline` for true, buscar e criar salas nunca respondem. */
export class OfflineableGateway extends MemoryRoomGateway {
  offline = true;
  private readonly never = new Promise<never>(() => undefined);

  override get(...args: Parameters<MemoryRoomGateway['get']>) {
    return this.offline ? this.never : super.get(...args);
  }

  override create(...args: Parameters<MemoryRoomGateway['create']>) {
    return this.offline ? this.never : super.create(...args);
  }
}

export const nodeRandom: Random = {
  next: () => Math.random(),
  hex: (length) => randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length),
};

/** Um jogador: sessão + o que ele guarda no navegador + avisos recebidos. */
export interface TestPlayer {
  id: PlayerId;
  session: GameSession;
  store: MemorySessionStore;
  gateway: MemoryRoomGateway;
  notices: Notice[];
  view(): GameView;
}

export function createPlayer(
  server: MemoryRoomServer,
  name: string,
  options: {
    store?: MemorySessionStore;
    random?: Random;
    vsComputer?: boolean;
    choiceTimeoutMs?: number | null;
    gateway?: MemoryRoomGateway;
    connectTimeoutMs?: number;
  } = {},
): TestPlayer {
  const id = toPlayerId(name);
  const store = options.store ?? new MemorySessionStore();
  const gateway = options.gateway ?? new MemoryRoomGateway(server, id);
  const session = new GameSession({
    identity: { ensurePlayer: async () => id },
    gateway,
    clock: server.clock,
    random: options.random ?? nodeRandom,
    store,
    vsComputer: options.vsComputer ?? false,
    choiceTimeoutMs: options.choiceTimeoutMs,
    connectTimeoutMs: options.connectTimeoutMs,
  });
  const notices: Notice[] = [];
  session.onNotice((notice) => notices.push(notice));
  return { id, session, store, gateway, notices, view: () => session.getView() };
}

/** Deixa rodar todas as promessas e notificações pendentes. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 50; i += 1) await Promise.resolve();
}
