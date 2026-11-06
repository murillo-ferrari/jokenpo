/**
 * Apelido opcional do jogador. Deve bater com a regra `players/$slot/name` em database.rules.json.
 */
export const NICKNAME_MAX_LENGTH = 20;

/**
 * Limpa o que o usuário digitou: tira caracteres de controle, junta espaços repetidos
 * e corta no tamanho máximo (sem quebrar emojis ao meio). Vazio vira `null`.
 */
export function normalizeNickname(input: string): string | null {
  const cleaned = input
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const characters = [...cleaned].slice(0, NICKNAME_MAX_LENGTH);
  const result = characters.join('').trim();
  return result === '' ? null : result;
}
