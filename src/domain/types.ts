/**
 * Identificador estável de um jogador. Sobrevive a recarregamentos da página,
 * para que quem der F5 continue no mesmo lugar da sala.
 */
export type PlayerId = string & { readonly __brand: 'PlayerId' };

export function toPlayerId(value: string): PlayerId {
  if (value.trim() === '') throw new Error('PlayerId não pode ser vazio.');
  return value as PlayerId;
}
