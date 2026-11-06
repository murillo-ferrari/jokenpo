import type { PlayerPresence, ResetRequest, Room } from '../../domain/room';
import {
  SLOTS,
  isBestOf,
  isMove,
  toPlayerId,
  type MatchId,
  type PlayerSlot,
  type RoomCode,
  type RoundRecord,
  type SlotEntry,
} from '../../domain/types';

/*
 * Converte o JSON do banco nos tipos do domínio. As regras do banco já validam o formato,
 * mas aqui nada é presumido: dado malformado vira "ausente" em vez de quebrar a tela.
 */

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;
const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const asString = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

export function toRoom(code: RoomCode, value: unknown): Room | null {
  if (!isObject(value)) return null;
  const createdAt = asNumber(value.createdAt);
  const currentMatch = asString(value.currentMatch);
  if (createdAt === null || currentMatch === null) return null;

  const players: Room['players'] = {};
  const rawPlayers = isObject(value.players) ? value.players : {};
  for (const slot of SLOTS) {
    const presence = toPresence(rawPlayers[slot]);
    if (presence) players[slot] = presence;
  }

  const matches = isObject(value.matches) ? value.matches : {};
  const match = isObject(matches[currentMatch]) ? matches[currentMatch] : {};

  return {
    code,
    createdAt,
    // Salas sem formato (ou com valor desconhecido) são partida livre.
    bestOf: isBestOf(value.bestOf) ? value.bestOf : 0,
    players,
    currentMatch: currentMatch as MatchId,
    rounds: toRounds(match.rounds),
    resetRequest: toResetRequest(value.resetRequest),
  };
}

function toPresence(value: unknown): PlayerPresence | null {
  if (!isObject(value)) return null;
  const uid = asString(value.uid);
  const seenAt = asNumber(value.seenAt);
  const joinedAt = asNumber(value.joinedAt);
  if (uid === null || seenAt === null || joinedAt === null || typeof value.connected !== 'boolean') return null;
  return { id: toPlayerId(uid), name: asString(value.name), connected: value.connected, seenAt, joinedAt };
}

function toResetRequest(value: unknown): ResetRequest | null {
  if (!isObject(value)) return null;
  const by = asString(value.by);
  const at = asNumber(value.at);
  return by !== null && at !== null ? { by: toPlayerId(by), at } : null;
}

/**
 * O Realtime Database devolve chaves numéricas sequenciais como array, e esparsas como objeto.
 * Os dois formatos viram um array indexado pelo número da rodada.
 */
export function toRounds(value: unknown): (RoundRecord | undefined)[] {
  if (!isObject(value)) return [];
  const entries: [number, unknown][] = Array.isArray(value)
    ? value.map((round, index) => [index, round])
    : Object.entries(value).map(([key, round]) => [Number(key), round]);

  const rounds: (RoundRecord | undefined)[] = [];
  for (const [index, round] of entries) {
    if (!Number.isInteger(index) || index < 0) continue;
    const record = toRoundRecord(round);
    if (record) rounds[index] = record;
  }
  return Array.from(rounds);
}

function toRoundRecord(value: unknown): RoundRecord | undefined {
  if (!isObject(value)) return undefined;
  const record: RoundRecord = {};
  for (const slot of SLOTS) {
    const entry = toSlotEntry(value[slot]);
    if (entry) record[slot as PlayerSlot] = entry;
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

function toSlotEntry(value: unknown): SlotEntry | null {
  if (!isObject(value)) return null;
  const commit = asString(value.commit);
  if (commit === null) return null;
  const entry: SlotEntry = { commit };
  const reveal = value.reveal;
  if (isObject(reveal)) {
    const nonce = asString(reveal.nonce);
    const at = asNumber(reveal.at);
    if (isMove(reveal.move) && nonce !== null && at !== null) entry.reveal = { move: reveal.move, nonce, at };
  }
  return entry;
}
