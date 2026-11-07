import { useEffect, useRef, useState } from 'preact/hooks';
import type { PlayingView } from '../../application/view';

/** Duração de cada palavra da contagem ("Jo…", "Ken…", "Pô!"). */
export const REVEAL_STEP_MS = 350;
/** Quanto tempo o resultado fica no cartão antes de ele voltar para a rodada seguinte. */
export const RESULT_HOLD_MS = 2500;
const STEPS = 3;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Countdown {
  round: number;
  step: number;
  /** A tela como estava antes de a rodada terminar. */
  frozen: PlayingView;
}

/** O que o cartão da rodada deve mostrar. */
export type CardStage =
  /** A rodada em andamento (escolhas de cada um, sem revelar a do adversário). */
  | { kind: 'current' }
  /** Contagem "Jo… Ken… Pô!" da rodada que acabou de terminar. */
  | { kind: 'countdown'; step: number }
  /** Resultado da rodada que terminou (por alguns segundos, ou até o fim se a partida acabou). */
  | { kind: 'result' };

export interface RevealSequence {
  /** O que desenhar: durante a contagem, placar e partida ainda como antes da rodada. */
  shown: PlayingView;
  stage: CardStage;
}

interface SequenceStart {
  /** Rodada cujo resultado fica em exibição (sem contagem). */
  holding: number | null;
  countdown: Countdown | null;
}

/** O que fazer quando muda a última rodada concluída: contar, mostrar o resultado direto, ou nada. */
function sequenceFor({
  roundNumber,
  previous,
  view,
  frozen,
}: {
  roundNumber: number;
  previous: number;
  view: PlayingView;
  frozen: PlayingView;
}): SequenceStart {
  // Voltou a uma rodada anterior (partida nova, revanche): não há resultado novo para mostrar.
  if (roundNumber < previous) return { holding: null, countdown: null };

  // Sem animação no sistema, ou W.O. por não escolher (não houve jogadas para revelar): resultado direto.
  const nothingToReveal = view.lastRound?.ending === 'choice-timeout';
  if (prefersReducedMotion() || nothingToReveal) return { holding: roundNumber, countdown: null };

  return { holding: null, countdown: { round: roundNumber, step: 0, frozen } };
}

/**
 * Sequência de uma rodada que termina:
 * 1. contagem "Jo… Ken… Pô!" com a tela congelada (placar ainda antigo, botões travados);
 * 2. resultado no cartão por RESULT_HOLD_MS, já com o placar novo;
 * 3. o cartão volta para a rodada seguinte (antes, se o jogador já escolher a próxima jogada).
 * Sem animação (prefers-reduced-motion), ou num W.O. por não escolher (nada a revelar), pula a contagem.
 */
export function useRevealSequence(view: PlayingView): RevealSequence {
  const [, rerender] = useState(0);
  const roundNumber = view.lastRound?.number ?? 0;
  const seen = useRef(roundNumber);
  const stable = useRef(view);
  const countdown = useRef<Countdown | null>(null);
  const holding = useRef<number | null>(null);

  // Detecta a rodada nova já na renderização, para nenhum quadro mostrar o placar novo antes da hora.
  if (roundNumber !== seen.current) {
    const next = sequenceFor({ roundNumber, previous: seen.current, view, frozen: stable.current });
    seen.current = roundNumber;
    holding.current = next.holding;
    countdown.current = next.countdown;
  }

  const active = countdown.current;
  useEffect(() => {
    if (!active) return;
    const timers = Array.from({ length: STEPS }, (_, index) =>
      setTimeout(() => {
        const next = index + 1;
        if (countdown.current?.round !== active.round) return;
        if (next >= STEPS) {
          countdown.current = null;
          holding.current = active.round;
        } else {
          countdown.current = { ...countdown.current, step: next };
        }
        rerender((n) => n + 1);
      }, (index + 1) * REVEAL_STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [active?.round]);

  const held = holding.current;
  useEffect(() => {
    if (held === null) return;
    const timer = setTimeout(() => {
      if (holding.current !== held) return;
      holding.current = null;
      rerender((n) => n + 1);
    }, RESULT_HOLD_MS);
    return () => clearTimeout(timer);
  }, [held]);

  if (active) {
    const { frozen } = active;
    return {
      stage: { kind: 'countdown', step: active.step },
      shown: {
        ...frozen,
        // Continuam ao vivo: o que não entrega o resultado.
        lastRound: view.lastRound,
        reset: view.reset,
        opponent: view.opponent,
        myName: view.myName,
        opponentName: view.opponentName,
        // Durante a contagem ninguém joga; a próxima rodada libera ao fim.
        phase: 'revealing',
        canPlay: false,
      },
    };
  }

  stable.current = view;
  // Partida decidida: o resultado final fica no cartão. Escolher a próxima jogada encerra a exibição.
  const showResult = view.lastRound !== null && (view.phase === 'finished' || (held !== null && !view.iHaveChosen));
  return { shown: view, stage: showResult ? { kind: 'result' } : { kind: 'current' } };
}
