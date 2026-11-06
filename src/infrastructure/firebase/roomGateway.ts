import {
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Database,
} from 'firebase/database';
import type { NewRoom, RoomGateway, Unsubscribe } from '../../application/ports';
import type { Room } from '../../domain/room';
import type { MatchId, Move, PlayerId, PlayerSlot, RoomCode } from '../../domain/types';
import { toRoom } from './roomMapper';

/** Implementa `RoomGateway` no Realtime Database. O formato dos dados está em database.rules.json. */
export class FirebaseRoomGateway implements RoomGateway {
  constructor(private readonly db: Database) {}

  async create({ code, host, hostName, matchId, bestOf, choiceSeconds }: NewRoom): Promise<boolean> {
    const result = await runTransaction(
      this.roomRef(code),
      (current: unknown) =>
        current === null
          ? {
              createdAt: serverTimestamp(),
              bestOf,
              choiceSeconds,
              currentMatch: matchId,
              players: { player1: newPresence(host, hostName) },
            }
          : undefined, // código já em uso: aborta
      { applyLocally: false },
    );
    return result.committed;
  }

  async get(code: RoomCode): Promise<Room | null> {
    return new Promise((resolve, reject) => {
      onValue(this.roomRef(code), (snapshot) => resolve(toRoom(code, snapshot.val())), reject, { onlyOnce: true });
    });
  }

  async claimSlot(code: RoomCode, slot: PlayerSlot, player: PlayerId, name: string | null): Promise<boolean> {
    try {
      const result = await runTransaction(
        this.slotRef(code, slot),
        (current: unknown) => (current === null ? newPresence(player, name) : undefined),
        { applyLocally: false },
      );
      return result.committed;
    } catch {
      // As regras recusam se a sala sumiu ou a vaga foi tomada no meio do caminho.
      return false;
    }
  }

  setName(code: RoomCode, slot: PlayerSlot, name: string | null): Promise<void> {
    return set(ref(this.db, `rooms/${code}/players/${slot}/name`), name);
  }

  releaseSlot(code: RoomCode, slot: PlayerSlot): Promise<void> {
    return remove(this.slotRef(code, slot));
  }

  deleteRoom(code: RoomCode): Promise<void> {
    return remove(this.roomRef(code));
  }

  watch(code: RoomCode, onChange: (room: Room | null) => void, onError: (error: unknown) => void): Unsubscribe {
    return onValue(this.roomRef(code), (snapshot) => onChange(toRoom(code, snapshot.val())), onError);
  }

  /**
   * Cada aba registra a própria conexão em `players/{vaga}/connections/{id}`. O jogador está
   * conectado enquanto houver alguma; fechar uma de duas abas não o desconecta.
   */
  trackPresence(code: RoomCode, slot: PlayerSlot): Unsubscribe {
    const slotRef = this.slotRef(code, slot);
    const connectionId = push(ref(this.db, `rooms/${code}/players/${slot}/connections`)).key as string;
    const path = `connections/${connectionId}`;
    // Ao cair, o servidor remove só esta conexão e marca a hora (base do prazo de 60 s da vaga).
    const gone = { [path]: null, seenAt: serverTimestamp() };
    // `.info/connected` volta a `true` a cada reconexão: o onDisconnect é registrado de novo.
    const stop = onValue(ref(this.db, '.info/connected'), (snapshot) => {
      if (snapshot.val() !== true) return;
      void onDisconnect(slotRef)
        .update(gone)
        .then(() => update(slotRef, { [path]: true, seenAt: serverTimestamp() }))
        .catch(() => undefined); // vaga já liberada: nada a marcar
    });
    return () => {
      stop();
      void onDisconnect(slotRef).cancel().catch(() => undefined);
      void update(slotRef, gone).catch(() => undefined); // saída explícita (ou a vaga já não existe)
    };
  }

  commit(code: RoomCode, matchId: MatchId, round: number, slot: PlayerSlot, commit: string): Promise<void> {
    // Hash e horário do servidor numa única escrita: o horário conta o prazo do adversário para escolher.
    return update(ref(this.db, `${this.roundPath(code, matchId, round)}/${slot}`), { commit, at: serverTimestamp() });
  }

  reveal(code: RoomCode, matchId: MatchId, round: number, slot: PlayerSlot, move: Move, nonce: string): Promise<void> {
    return set(ref(this.db, `${this.roundPath(code, matchId, round)}/${slot}/reveal`), {
      move,
      nonce,
      at: serverTimestamp(),
    });
  }

  requestReset(code: RoomCode, by: PlayerId): Promise<void> {
    return set(ref(this.db, `rooms/${code}/resetRequest`), { by, at: serverTimestamp() });
  }

  clearResetRequest(code: RoomCode): Promise<void> {
    return remove(ref(this.db, `rooms/${code}/resetRequest`));
  }

  startNewMatch(code: RoomCode, matchId: MatchId): Promise<void> {
    return update(this.roomRef(code), { currentMatch: matchId, resetRequest: null });
  }

  private roomRef(code: RoomCode) {
    return ref(this.db, `rooms/${code}`);
  }

  private slotRef(code: RoomCode, slot: PlayerSlot) {
    return ref(this.db, `rooms/${code}/players/${slot}`);
  }

  private roundPath(code: RoomCode, matchId: MatchId, round: number): string {
    return `rooms/${code}/matches/${matchId}/rounds/${round}`;
  }
}

/** Vaga recém-ocupada. As conexões entram logo em seguida, por `trackPresence`. */
function newPresence(player: PlayerId, name: string | null) {
  return { uid: player, name, seenAt: serverTimestamp(), joinedAt: serverTimestamp() };
}
