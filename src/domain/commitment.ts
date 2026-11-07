import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { Move, Reveal } from './types';

/*
 * Commit-reveal: cada jogador primeiro publica só o hash da jogada (commit).
 * Quando os dois commits existem, cada um publica a jogada e o nonce (reveal),
 * e o adversário confere que o hash bate. Assim ninguém vê a jogada do outro antes
 * de jogar, e ninguém troca de jogada depois de ver a do outro.
 */

const NONCE_PATTERN = /^[0-9a-f]{32}$/;
const COMMIT_PATTERN = /^[0-9a-f]{64}$/;

export function isNonce(value: string): boolean {
  return NONCE_PATTERN.test(value);
}

export function isCommit(value: string): boolean {
  return COMMIT_PATTERN.test(value);
}

/** Texto que entra no hash. O separador evita ambiguidade entre jogada e nonce. */
export function commitmentPayload(move: Move, nonce: string): string {
  return `${move}:${nonce}`;
}

/** Calcula o commit de uma jogada. */
export function commitFor(move: Move, nonce: string): string {
  if (!isNonce(nonce)) throw new Error('Nonce inválido: esperado 32 caracteres hexadecimais.');
  return bytesToHex(sha256(utf8ToBytes(commitmentPayload(move, nonce))));
}

/** Confere se o reveal corresponde ao commit publicado antes. */
export function verifyReveal(commit: string, reveal: Pick<Reveal, 'move' | 'nonce'>): boolean {
  return isCommit(commit) && isNonce(reveal.nonce) && commitFor(reveal.move, reveal.nonce) === commit;
}
