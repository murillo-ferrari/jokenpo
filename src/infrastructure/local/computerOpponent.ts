import type { Random, Unsubscribe } from '../../application/ports';
import { commitFor } from '../../domain/commitment';
import { generateMatchId, summarize } from '../../domain/match';
import { slotOf, type Room } from '../../domain/room';
import { MOVES, SLOTS, opponentOf, type Move, type PlayerId, type PlayerSlot, type RoomCode } from '../../domain/types';
import { MemoryRoomGateway, type MemoryRoomServer } from './memoryRooms';

export interface ComputerOpponentOptions {
  /** Tempo "pensando" antes de escolher, em ms: [mínimo, máximo]. */
  thinkingMs?: readonly [number, number];
}

const DEFAULT_THINKING_MS = [500, 1200] as const;
const NONCE_LENGTH = 32;

/**
 * Adversário controlado pelo computador, para jogar sem rede.
 * Joga pelo mesmo protocolo de um jogador remoto (entra na sala, commit, reveal),
 * então o GameSession do jogador humano não sabe a diferença.
 * A jogada é sorteada com aleatoriedade criptográfica: não "lê" a jogada do humano,
 * que de qualquer forma só existe como hash até os dois escolherem.
 */
export class ComputerOpponent {
  private readonly gateway: MemoryRoomGateway;
  private readonly stop: Unsubscribe;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  /** Jogada e nonce por rodada, para revelar depois (chave: partida/rodada). */
  private readonly secrets = new Map<string, { move: Move; nonce: string }>();
  private readonly busy = new Set<string>();

  constructor(
    private readonly server: MemoryRoomServer,
    readonly id: PlayerId,
    private readonly random: Random,
    private readonly options: ComputerOpponentOptions = {},
  ) {
    this.gateway = new MemoryRoomGateway(server, id);
    this.stop = server.observeAll((code) => this.react(code));
  }

  dispose(): void {
    this.stop();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  private react(code: RoomCode): void {
    const room = this.server.snapshot(code);
    if (!room) return;
    const mySlot = slotOf(room, this.id);
    if (!mySlot) return this.join(room);

    // O humano pediu revanche ou recomeço: o computador sempre topa.
    if (room.resetRequest && room.resetRequest.by !== this.id) {
      this.once(`reset:${room.resetRequest.at}`, () =>
        this.gateway.startNewMatch(code, generateMatchId(() => this.random.next())),
      );
      return;
    }

    if (!room.players[opponentOf(mySlot)]) return;
    const summary = summarize(room.rounds, { now: this.server.clock.now(), bestOf: room.bestOf });
    if (summary.winner) return;

    const { current } = summary;
    const key = `${room.currentMatch}/${current.index}`;
    if (current.phase === 'choosing' && !current.committed[mySlot]) {
      this.once(`commit:${key}`, () => this.commitAfterThinking(room, mySlot, current.index, key));
    } else if (current.phase === 'revealing' && !current.revealed[mySlot]) {
      const secret = this.secrets.get(key);
      if (secret) {
        this.once(`reveal:${key}`, () =>
          this.gateway.reveal(code, room.currentMatch, current.index, mySlot, secret.move, secret.nonce),
        );
      }
    }
  }

  private join(room: Room): void {
    const free = SLOTS.find((slot) => !room.players[slot]);
    if (!free) return;
    this.once(`join:${room.code}`, async () => {
      await this.gateway.claimSlot(room.code, free, this.id, null);
      this.gateway.trackPresence(room.code, free);
    });
  }

  private commitAfterThinking(room: Room, slot: PlayerSlot, round: number, key: string): Promise<void> {
    const [min, max] = this.options.thinkingMs ?? DEFAULT_THINKING_MS;
    const delay = min + Math.floor(this.random.next() * (max - min + 1));
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        const move = MOVES[Math.floor(this.random.next() * MOVES.length)] ?? 'rock';
        const nonce = this.random.hex(NONCE_LENGTH);
        this.secrets.set(key, { move, nonce });
        this.gateway
          .commit(room.code, room.currentMatch, round, slot, commitFor(move, nonce))
          .catch(() => this.secrets.delete(key))
          .finally(resolve);
      }, delay);
      this.timers.add(timer);
    });
  }

  /** Executa a ação uma única vez por chave, mesmo com várias notificações seguidas. */
  private once(key: string, action: () => Promise<unknown>): void {
    if (this.busy.has(key)) return;
    this.busy.add(key);
    void action().catch(() => this.busy.delete(key));
  }
}
