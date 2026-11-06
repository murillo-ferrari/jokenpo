import type { PlayerId } from '../domain/types';

/**
 * Portas: o que os casos de uso precisam do mundo externo.
 * Implementações concretas ficam em `infrastructure/` e são ligadas em `main.tsx`.
 */

/** Quem é o jogador neste navegador. */
export interface Identity {
  /** Garante uma identidade (criando-a na primeira vez) e devolve o id. */
  ensurePlayer(): Promise<PlayerId>;
}
