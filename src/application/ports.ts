import type { Room } from '../domain/room';
import type { BestOf, ChoiceSeconds, MatchId, Move, PlayerId, PlayerSlot, RoomCode } from '../domain/types';

/**
 * Portas: o que os casos de uso precisam do mundo externo.
 * Implementações concretas ficam em `infrastructure/` e são ligadas em `main.tsx`.
 */

export type Unsubscribe = () => void;

/** Quem é o jogador neste navegador. */
export interface Identity {
  /** Garante uma identidade (criando-a na primeira vez) e devolve o id. */
  ensurePlayer(): Promise<PlayerId>;
}

/** Horário do servidor, em ms. Usado para prazos (W.O., vaga abandonada). */
export interface Clock {
  now(): number;
}

export interface Random {
  /** Número em [0, 1). */
  next(): number;
  /** `length` caracteres hexadecimais minúsculos, criptograficamente aleatórios. */
  hex(length: number): string;
}

export interface NewRoom {
  code: RoomCode;
  host: PlayerId;
  hostName: string | null;
  matchId: MatchId;
  bestOf: BestOf;
  choiceSeconds: ChoiceSeconds;
}

/** Acesso às salas no banco. Toda regra de jogo fica fora daqui. */
export interface RoomGateway {
  /** Cria a sala. Devolve `false` se o código já estiver em uso. */
  create(room: NewRoom): Promise<boolean>;
  get(code: RoomCode): Promise<Room | null>;
  /** Ocupa a vaga, se ela ainda estiver livre. Devolve `false` se alguém chegou antes. */
  claimSlot(code: RoomCode, slot: PlayerSlot, player: PlayerId, name: string | null): Promise<boolean>;
  /** Troca o apelido exibido na vaga (`null` remove). */
  setName(code: RoomCode, slot: PlayerSlot, name: string | null): Promise<void>;
  releaseSlot(code: RoomCode, slot: PlayerSlot): Promise<void>;
  deleteRoom(code: RoomCode): Promise<void>;
  /** Avisa a cada mudança na sala; `null` quando ela deixa de existir. */
  watch(code: RoomCode, onChange: (room: Room | null) => void, onError: (error: unknown) => void): Unsubscribe;
  /** Mantém `connected` atualizado, inclusive quando a conexão cai sem aviso. */
  trackPresence(code: RoomCode, slot: PlayerSlot): Unsubscribe;
  commit(code: RoomCode, matchId: MatchId, round: number, slot: PlayerSlot, commit: string): Promise<void>;
  reveal(code: RoomCode, matchId: MatchId, round: number, slot: PlayerSlot, move: Move, nonce: string): Promise<void>;
  requestReset(code: RoomCode, by: PlayerId): Promise<void>;
  clearResetRequest(code: RoomCode): Promise<void>;
  /** Troca a partida atual (e apaga o pedido de reset) numa única escrita. */
  startNewMatch(code: RoomCode, matchId: MatchId): Promise<void>;
}

/** Jogada feita e ainda não revelada. Precisa sobreviver a um F5, senão o jogador perde por W.O. */
export interface PendingMove {
  code: RoomCode;
  matchId: MatchId;
  round: number;
  move: Move;
  nonce: string;
}

/** O que este navegador precisa lembrar entre recarregamentos. */
export interface SessionStore {
  loadRoom(): RoomCode | null;
  saveRoom(code: RoomCode | null): void;
  loadPendingMove(): PendingMove | null;
  savePendingMove(move: PendingMove | null): void;
  loadNickname(): string | null;
  saveNickname(name: string | null): void;
}
