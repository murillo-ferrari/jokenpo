import type { Clock, NewRoom, PendingMove, RoomGateway, SessionStore, Unsubscribe } from '../../application/ports';
import type { PlayerPresence, ResetRequest, Room } from '../../domain/room';
import type { BestOf, ChoiceSeconds, MatchId, Move, PlayerId, PlayerSlot, RoomCode, RoundRecord } from '../../domain/types';

/*
 * Salas em memória, com o mesmo comportamento que o jogo espera do Realtime Database:
 * notificações assíncronas, horário de servidor e queda de conexão (onDisconnect).
 * Usadas no modo contra o computador (sem rede) e nos testes.
 * Algumas regras do banco são imitadas (commit e reveal únicos), para o fluxo se comportar igual.
 */

/** Presença como guardada: uma lista de conexões (uma por aba); "conectado" = alguma conexão ativa. */
type StoredPresence = Omit<PlayerPresence, 'connected'> & { connections: string[] };

interface StoredRoom {
  createdAt: number;
  bestOf: BestOf;
  choiceSeconds: ChoiceSeconds;
  currentMatch: MatchId;
  players: Partial<Record<PlayerSlot, StoredPresence>>;
  matches: Record<string, (RoundRecord | undefined)[]>;
  resetRequest: ResetRequest | null;
}

type Listener = (room: Room | null) => void;

export class MemoryRoomServer {
  readonly rooms = new Map<RoomCode, StoredRoom>();
  private readonly listeners = new Map<RoomCode, Set<Listener>>();
  private readonly globalListeners = new Set<(code: RoomCode) => void>();
  /** Presenças rastreadas por jogador, para simular a queda de conexão. */
  private readonly presences = new Map<PlayerId, Set<string>>();

  constructor(readonly clock: Clock) {}

  snapshot(code: RoomCode): Room | null {
    const stored = this.rooms.get(code);
    if (!stored) return null;
    const players: Room['players'] = {};
    for (const [slot, presence] of Object.entries(stored.players) as [PlayerSlot, StoredPresence][]) {
      const { connections, ...rest } = presence;
      players[slot] = { ...rest, connected: connections.length > 0 };
    }
    return structuredClone({
      code,
      createdAt: stored.createdAt,
      bestOf: stored.bestOf,
      choiceSeconds: stored.choiceSeconds,
      players,
      currentMatch: stored.currentMatch,
      rounds: stored.matches[stored.currentMatch] ?? [],
      resetRequest: stored.resetRequest,
    });
  }

  /** Aplica uma mudança e avisa quem observa a sala. `null` apaga; `undefined` não muda nada. */
  mutate(code: RoomCode, change: (room: StoredRoom | undefined) => StoredRoom | null | undefined): void {
    this.store(code, change(this.rooms.get(code)));
    this.notify(code);
  }

  private store(code: RoomCode, result: StoredRoom | null | undefined): void {
    if (result === null) {
      this.rooms.delete(code);
      return;
    }
    if (result) this.rooms.set(code, result);
  }

  watch(code: RoomCode, listener: Listener): Unsubscribe {
    const set = this.listeners.get(code) ?? new Set();
    set.add(listener);
    this.listeners.set(code, set);
    queueMicrotask(() => set.has(listener) && listener(this.snapshot(code)));
    return () => set.delete(listener);
  }

  /** Avisa qualquer mudança em qualquer sala (o computador usa para achar a sala nova). */
  observeAll(listener: (code: RoomCode) => void): Unsubscribe {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  trackPresence(player: PlayerId, key: string): Unsubscribe {
    const set = this.presences.get(player) ?? new Set();
    set.add(key);
    this.presences.set(player, set);
    return () => set.delete(key);
  }

  /** Todas as conexões do jogador caem: executa o equivalente aos onDisconnect registrados. */
  disconnect(player: PlayerId): void {
    for (const key of this.presences.get(player) ?? []) {
      const [code, slot, connection] = key.split('/') as [RoomCode, PlayerSlot, string];
      this.dropConnection(code, slot, connection);
    }
    this.presences.delete(player);
  }

  addConnection(code: RoomCode, slot: PlayerSlot, player: PlayerId, connection: string): void {
    this.mutate(code, (room) => {
      const presence = room?.players[slot];
      if (!room || !presence || presence.id !== player || presence.connections.includes(connection)) return undefined;
      presence.connections.push(connection);
      presence.seenAt = this.clock.now();
      return room;
    });
  }

  dropConnection(code: RoomCode, slot: PlayerSlot, connection: string): void {
    this.mutate(code, (room) => {
      const presence = room?.players[slot];
      if (!room || !presence || !presence.connections.includes(connection)) return undefined;
      presence.connections = presence.connections.filter((id) => id !== connection);
      presence.seenAt = this.clock.now();
      return room;
    });
  }

  private notify(code: RoomCode): void {
    const snapshot = this.snapshot(code);
    for (const listener of this.listeners.get(code) ?? []) {
      queueMicrotask(() => listener(structuredClone(snapshot)));
    }
    for (const listener of this.globalListeners) queueMicrotask(() => listener(code));
  }
}

/** `RoomGateway` de um jogador sobre o `MemoryRoomServer`. */
export class MemoryRoomGateway implements RoomGateway {
  private static connections = 0;

  constructor(
    private readonly server: MemoryRoomServer,
    private readonly player: PlayerId,
  ) {}

  private presence(id: PlayerId, name: string | null): StoredPresence {
    const now = this.server.clock.now();
    return { id, name, connections: [], seenAt: now, joinedAt: now };
  }

  async create({ code, host, hostName, matchId, bestOf, choiceSeconds }: NewRoom): Promise<boolean> {
    if (this.server.rooms.has(code)) return false;
    this.server.mutate(code, () => ({
      createdAt: this.server.clock.now(),
      bestOf,
      choiceSeconds,
      currentMatch: matchId,
      players: { player1: this.presence(host, hostName) },
      matches: {},
      resetRequest: null,
    }));
    return true;
  }

  async get(code: RoomCode): Promise<Room | null> {
    return this.server.snapshot(code);
  }

  async claimSlot(code: RoomCode, slot: PlayerSlot, player: PlayerId, name: string | null): Promise<boolean> {
    const room = this.server.rooms.get(code);
    if (!room || room.players[slot]) return false;
    this.server.mutate(code, (current) => {
      if (!current) return undefined;
      current.players[slot] = this.presence(player, name);
      return current;
    });
    return true;
  }

  async setName(code: RoomCode, slot: PlayerSlot, name: string | null): Promise<void> {
    this.server.mutate(code, (room) => {
      const presence = room?.players[slot];
      if (!room || !presence || presence.id !== this.player) return undefined;
      presence.name = name;
      return room;
    });
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
    return this.server.watch(code, onChange);
  }

  /** Uma conexão por chamada (uma por aba), como no Firebase. */
  trackPresence(code: RoomCode, slot: PlayerSlot): Unsubscribe {
    MemoryRoomGateway.connections += 1;
    const connection = `c${MemoryRoomGateway.connections}`;
    this.server.addConnection(code, slot, this.player, connection);
    const untrack = this.server.trackPresence(this.player, `${code}/${slot}/${connection}`);
    return () => {
      untrack();
      this.server.dropConnection(code, slot, connection);
    };
  }

  async commit(code: RoomCode, matchId: MatchId, round: number, slot: PlayerSlot, commit: string): Promise<void> {
    this.writeRound(code, matchId, round, (record) => {
      if (record[slot]) throw new Error('permission_denied: commit já existe');
      record[slot] = { commit, committedAt: this.server.clock.now() };
    });
  }

  async reveal(code: RoomCode, matchId: MatchId, round: number, slot: PlayerSlot, move: Move, nonce: string): Promise<void> {
    this.writeRound(code, matchId, round, (record) => {
      const entry = record[slot];
      if (!entry || entry.reveal || !record.player1 || !record.player2) {
        throw new Error('permission_denied: reveal fora de hora');
      }
      entry.reveal = { move, nonce, at: this.server.clock.now() };
    });
  }

  async requestReset(code: RoomCode, by: PlayerId): Promise<void> {
    this.server.mutate(code, (room) => room && { ...room, resetRequest: { by, at: this.server.clock.now() } });
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

/** `SessionStore` sem persistência: o modo contra o computador não sobrevive a um F5, e nem precisa. */
export class MemorySessionStore implements SessionStore {
  room: RoomCode | null = null;
  pending: PendingMove | null = null;
  nickname: string | null = null;

  loadRoom = () => this.room;
  saveRoom = (code: RoomCode | null) => void (this.room = code);
  loadPendingMove = () => (this.pending ? structuredClone(this.pending) : null);
  savePendingMove = (move: PendingMove | null) => void (this.pending = move);
  loadNickname = () => this.nickname;
  saveNickname = (name: string | null) => void (this.nickname = name);
}
