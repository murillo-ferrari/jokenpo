import type { RandomSource, RoomCode } from './types';

/**
 * Sem 0/O, 1/I/L: caracteres fáceis de confundir ao ditar ou digitar o código.
 * Deve bater com a regex de `$code` em database.rules.json.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;

export type RoomCodeError = 'empty' | 'length' | 'characters';

export type ParsedRoomCode = { ok: true; code: RoomCode } | { ok: false; error: RoomCodeError };

/** Sorteia um código de sala. Sempre tem exatamente 4 caracteres do alfabeto. */
export function generateRoomCode(random: RandomSource): RoomCode {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code as RoomCode;
}

/**
 * Valida o que o usuário digitou. Aceita minúsculas, espaços e hífens
 * (por exemplo, "ab-23" vira "AB23").
 */
export function parseRoomCode(input: string): ParsedRoomCode {
  const normalized = input.toUpperCase().replace(/[\s-]/g, '');
  if (normalized === '') return { ok: false, error: 'empty' };
  if (normalized.length !== ROOM_CODE_LENGTH) return { ok: false, error: 'length' };
  if (![...normalized].every((char) => ROOM_CODE_ALPHABET.includes(char))) {
    return { ok: false, error: 'characters' };
  }
  return { ok: true, code: normalized as RoomCode };
}
