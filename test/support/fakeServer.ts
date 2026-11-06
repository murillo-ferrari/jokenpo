import { randomBytes } from 'node:crypto';
import { GameSession } from '../../src/application/gameSession';
import type {
  Clock,
  NewRoom,
  PendingMove,
  Random,
  RoomGateway,
  SessionStore,
  Unsubscribe,
} from '../../src/application/ports';
import type { GameView, Notice } from '../../src/application/view';
import type { PlayerPresence, ResetRequest, Room } from '../../src/domain/room';
import {
  toPlayerId,
  type MatchId,
  type Move,
  type PlayerId,
  type PlayerSlot,
  type RoomCode,
  type RoundRecord,
} from '../../src/domain/types';

/*
 * Servidor em memória que imita o comportamento do Realtime Database que o jogo usa:
 * horário do servidor controlável, notificações assíncronas e queda de conexão.
 * Algumas regras do banco são imitadas (commit e reveal únicos), para pegar bugs de fluxo;
 * as regras de verdade são testadas no emulador.
 */

interface StoredRoom {
  createdAt: number;
  currentMatch: MatchId;
  players: Partial<Record<PlayerSlot, PlayerPresence>>;
  matches: Record<string, (RoundRecord | undefined)[]>;
  resetRequest: ResetRequest | null;
}

type Watcher = { onChange: (room: Room | null) => void };

export class FakeServer {
  time = 1_000_000;
  readonly clock: Clock = { now: () => this.time };
  readonly rooms = new Map<RoomCode, StoredRoom>();
  private readonly watchers = new Map<RoomCode, Set<Watcher>>();
  /** Presenças rastreadas por jogador, para simular a queda de conexão (onDisconnect). */
  private readonly presences = new Map<PlayerId, Set<string>>();

  snapshot(code: RoomCode): Room | null {
    const stored = this.rooms.get(code);
    if (!stored) return null;
    return structuredClone({
      code,
      createdAt: stored.createdAt,
      players: stored.players,
      currentMatch: stored.currentMatch,
      rounds: stored.matches[stored.currentMatch] ?? [],
      resetRequest: stored.resetRequest,
    });
  }

  mutate(code: RoomCode, change: (room: StoredRoom | undefined) => StoredRoom | null | undefined): void {
    const result = change(this.rooms.get(code));
    if (result === null) this.rooms.delete(code);
    else if (result) this.rooms.set(code, result);
    this.notify(code);
  }

  watch(code: RoomCode, watcher: Watcher): Unsubscribe {
    const set = this.watchers.get(code) ?? new Set();
    set.add(watcher);
    this.watchers.set(code, set);
    queueMicrotask(() => set.has(watcher) && watcher.onChange(this.snapshot(code)));
    return () => set.delete(watcher);
  }

  trackPresence(player: PlayerId, key: string): Unsubscribe {
    const set = this.presences.get(player) ?? new Set();
    set.add(key);
    this.presences.set(player, set);
    return () => set.delete(key);
  }

  /** A conexão do jogador cai: o servidor executa os onDisconnect registrados. */
  disconnect(player: PlayerId): void {
    for (const key of this.presences.get(player) ?? []) {
      const [code, slot] = key.split('/') as [RoomCode, PlayerSlot];
      this.mutate(code, (room) => {
        const presence = room?.players[slot];
        if (!room || !presence || presence.id !== player) return undefined;
        presence.connected = false;
        presence.seenAt = this.time;
        return room;
      });
    }
    this.presences.delete(player);
  }

  private notify(code: RoomCode): void {
    const snapshot = this.snapshot(code);
    for (const watcher of this.watchers.get(code) ?? []) {
      queueMicrotask(() => watcher.onChange(structuredClone(snapshot)));
    }
  }
}

export class FakeGateway implements RoomGateway {
  constructor(
    private readonly server: FakeServer,
    private readonly player: PlayerId,
  ) {}

  private presence(): PlayerPresence {
    return { id: this.player, connected: true, seenAt: this.server.time, joinedAt: this.server.time };
  }

  async create({ code, host, matchId }: NewRoom): Promise<boolean> {
    if (this.server.rooms.has(code)) return false;
    this.server.mutate(code, () => ({
      createdAt: this.server.time,
      currentMatch: matchId,
      players: { player1: { ...this.presence(), id: host } },
      matches: {},
      resetRequest: null,
    }));
    return true;
  }

  async get(code: RoomCode): Promise<Room | null> {
    return this.server.snapshot(code);
  }

  async claimSlot(code: RoomCode, slot: PlayerSlot, player: PlayerId): Promise<boolean> {
    const room = this.server.rooms.get(code);
    if (!room || room.players[slot]) return false;
    this.server.mutate(code, (current) => {
      if (!current) return undefined;
      current.players[slot] = { ...this.presence(), id: player };
      return current;
    });
    return true;
  }

  async releaseSlot(code: RoomCode, slot: PlayerSlot): Promise<void> {
    this.server.mutate(code, (room) => {
      if (!room) return undefined;
      delete room.players[slot];
      return room;
    });
  }

  async deleteRoom(code: RoomCode): Promise<void> {
    this.server.mutate(code, () => null);
  }

  watch(code: RoomCode, onChange: (room: Room | null) => void): Unsubscribe {
    return this.server.watch(code, { onChange });
  }

  trackPresence(code: RoomCode, slot: PlayerSlot): Unsubscribe {
    this.server.mutate(code, (room) => {
      const presence = room?.players[slot];
      if (!room || !presence || presence.id !== this.player || presence.connected) return undefined;
      presence.connected = true;
      presence.seenAt = this.server.time;
      return room;
    });
    return this.server.trackPresence(this.player, `${code}/${slot}`);
  }

  async commit(code: RoomCode, matchId: MatchId, round: number, slot: PlayerSlot, commit: string): Promise<void> {
    this.writeRound(code, matchId, round, (record) => {
      if (record[slot]) throw new Error('permission_denied: commit já existe');
      record[slot] = { commit };
    });
  }

  async reveal(code: RoomCode, matchId: MatchId, round: number, slot: PlayerSlot, move: Move, nonce: string): Promise<void> {
    this.writeRound(code, matchId, round, (record) => {
      const entry = record[slot];
      if (!entry || entry.reveal || !record.player1 || !record.player2) {
        throw new Error('permission_denied: reveal fora de hora');
      }
      entry.reveal = { move, nonce, at: this.server.time };
    });
  }

  async requestReset(code: RoomCode, by: PlayerId): Promise<void> {
    this.server.mutate(code, (room) => room && { ...room, resetRequest: { by, at: this.server.time } });
  }

  async clearResetRequest(code: RoomCode): Promise<void> {
    this.server.mutate(code, (room) => room && { ...room, resetRequest: null });
  }

  async startNewMatch(code: RoomCode, matchId: MatchId): Promise<void> {
    this.server.mutate(code, (room) => room && { ...room, currentMatch: matchId, resetRequest: null });
  }

  private writeRound(code: RoomCode, matchId: MatchId, round: number, write: (record: RoundRecord) => void): void {
    const room = this.server.rooms.get(code);
    if (!room || room.currentMatch !== matchId) throw new Error('permission_denied: partida errada');
    const rounds = (room.matches[matchId] ??= []);
    const record = (rounds[round] ??= {});
    write(record);
    this.server.mutate(code, (current) => current);
  }
}

export class MemoryStore implements SessionStore {
  room: RoomCode | null = null;
  pending: PendingMove | null = null;
  loadRoom = () => this.room;
  saveRoom = (code: RoomCode | null) => void (this.room = code);
  loadPendingMove = () => (this.pending ? structuredClone(this.pending) : null);
  savePendingMove = (move: PendingMove | null) => void (this.pending = move);
}

export const nodeRandom: Random = {
  next: () => Math.random(),
  hex: (length) => randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length),
};

/** Um jogador: sessão + o que ele guarda no navegador + avisos recebidos. */
export interface TestPlayer {
  id: PlayerId;
  session: GameSession;
  store: MemoryStore;
  gateway: FakeGateway;
  notices: Notice[];
  view(): GameView;
}

export function createPlayer(
  server: FakeServer,
  name: string,
  options: { store?: MemoryStore; random?: Random } = {},
): TestPlayer {
  const id = toPlayerId(name);
  const store = options.store ?? new MemoryStore();
  const gateway = new FakeGateway(server, id);
  const session = new GameSession({
    identity: { ensurePlayer: async () => id },
    gateway,
    clock: server.clock,
    random: options.random ?? nodeRandom,
    store,
  });
  const notices: Notice[] = [];
  session.onNotice((notice) => notices.push(notice));
  return { id, session, store, gateway, notices, view: () => session.getView() };
}

/** Deixa rodar todas as promessas e notificações pendentes. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 50; i += 1) await Promise.resolve();
}
