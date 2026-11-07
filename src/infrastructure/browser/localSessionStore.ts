import type { PendingMove, SessionStore } from '../../application/ports';
import { isNonce } from '../../domain/commitment';
import { normalizeNickname } from '../../domain/nickname';
import { parseRoomCode } from '../../domain/roomCode';
import { isMove } from '../../domain/types';

const ROOM_KEY = 'jokenpo:room';
const PENDING_MOVE_KEY = 'jokenpo:pending-move';
const NICKNAME_KEY = 'jokenpo:nickname';

/**
 * Guarda a sala atual e a jogada ainda não revelada no `localStorage`, para sobreviverem a um F5.
 * O `localStorage` pode estar bloqueado (aba anônima, permissões): nesse caso nada é lembrado,
 * mas o jogo continua funcionando.
 */
export class LocalSessionStore implements SessionStore {
  constructor(private readonly storage: Storage | null = safeLocalStorage()) {}

  loadRoom() {
    const parsed = parseRoomCode(this.read(ROOM_KEY) ?? '');
    return parsed.ok ? parsed.code : null;
  }

  saveRoom(code: Parameters<SessionStore['saveRoom']>[0]) {
    this.write(ROOM_KEY, code);
  }

  loadPendingMove(): PendingMove | null {
    try {
      const value: unknown = JSON.parse(this.read(PENDING_MOVE_KEY) ?? 'null');
      return isPendingMove(value) ? value : null;
    } catch {
      return null;
    }
  }

  savePendingMove(move: PendingMove | null) {
    this.write(PENDING_MOVE_KEY, move ? JSON.stringify(move) : null);
  }

  loadNickname(): string | null {
    return normalizeNickname(this.read(NICKNAME_KEY) ?? '');
  }

  saveNickname(name: string | null) {
    this.write(NICKNAME_KEY, name);
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string | null): void {
    try {
      if (value === null) this.storage?.removeItem(key);
      else this.storage?.setItem(key, value);
    } catch {
      // Sem armazenamento: segue sem lembrar.
    }
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isPendingMove(value: unknown): value is PendingMove {
  if (typeof value !== 'object' || value === null) return false;
  const move = value as Record<string, unknown>;
  return (
    typeof move.code === 'string' &&
    parseRoomCode(move.code).ok &&
    typeof move.matchId === 'string' &&
    move.matchId !== '' &&
    typeof move.round === 'number' &&
    Number.isInteger(move.round) &&
    isMove(move.move) &&
    typeof move.nonce === 'string' &&
    isNonce(move.nonce)
  );
}
