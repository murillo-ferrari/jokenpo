import { useEffect, useState } from 'preact/hooks';
import type { LastRoundView } from '../../application/view';
import { useI18n } from '../i18n';
import { MOVE_EMOJI } from './moves';

const STEP_MS = 350;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Texto explicativo quando a rodada não terminou do jeito normal. */
function useEndingText(round: LastRoundView): string | null {
  const { t } = useI18n();
  if (round.ending === 'played') return null;
  if (round.ending === 'void') return t.game.endings.void;
  if (round.result === 'tie') return null;
  return t.game.endings[round.ending][round.result];
}

/**
 * Resultado da última rodada. Quando chega uma rodada nova, faz a contagem
 * "Jo… Ken… Pô!" antes de mostrar as jogadas (sem animação se o sistema pedir menos movimento).
 */
export function RoundCard({ round, myLabel, opponentLabel }: { round: LastRoundView; myLabel: string; opponentLabel: string }) {
  const { t } = useI18n();
  const [step, setStep] = useState<number | null>(() => (prefersReducedMotion() ? null : 0));
  const endingText = useEndingText(round);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setStep(null);
      return;
    }
    setStep(0);
    const timers = [1, 2, 3].map((next) => setTimeout(() => setStep(next >= 3 ? null : next), next * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [round.number]);

  const counting = step !== null;
  const moveText = (move: LastRoundView['myMove']) => (move ? `${MOVE_EMOJI[move]} ${t.moves[move]}` : t.game.noMove);
  const summary = t.game.roundSummary(round.number, moveText(round.myMove), moveText(round.opponentMove), t.game.results[round.result]);

  return (
    <section class={`round-card result-${round.result}`} aria-label={t.game.round(round.number)}>
      {/* O resultado completo é anunciado uma vez, depois da contagem. */}
      <p class="visually-hidden" aria-live="polite">
        {counting ? '' : `${summary} ${endingText ?? ''}`}
      </p>
      <div class="round-moves" aria-hidden="true">
        <span class="round-move">
          <span class="round-move-emoji">{counting ? '✊' : round.myMove ? MOVE_EMOJI[round.myMove] : '—'}</span>
          <span class="round-move-owner">{myLabel}</span>
        </span>
        <span class="round-vs">{counting ? t.game.countdown[step] : 'vs'}</span>
        <span class="round-move">
          <span class="round-move-emoji">{counting ? '✊' : round.opponentMove ? MOVE_EMOJI[round.opponentMove] : '—'}</span>
          <span class="round-move-owner">{opponentLabel}</span>
        </span>
      </div>
      {!counting && (
        <div aria-hidden="true">
          <p class="round-result">{t.game.results[round.result]}</p>
          {endingText && <p class="round-ending">{endingText}</p>}
        </div>
      )}
    </section>
  );
}
