import { useEffect, useRef, useState } from 'preact/hooks';
import { useI18n } from '../i18n';
import { useSound } from '../sound';

const TICK_MS = 250;
/** Reta final (vermelho + bipes): metade do prazo, no máximo 5 s. 15 s → 5; 10 s → 5; 5 s → 3. */
const MAX_URGENT_SECONDS = 5;
/** Os últimos segundos com bipe mais agudo. */
const FINAL_SECONDS = 2;

export function urgentSeconds(totalSeconds: number): number {
  return Math.min(MAX_URGENT_SECONDS, Math.ceil(totalSeconds / 2));
}

interface CountdownProps {
  /** Horário (servidor, ms) em que o prazo acaba. */
  deadline: number;
  /** Relógio do servidor (o prazo é contado no horário do servidor, não no do aparelho). */
  now: () => number;
  /** Tocar o alerta sonoro nos últimos segundos (só para quem ainda precisa escolher). */
  audible: boolean;
  /** Prazo total, em segundos (define a reta final). */
  totalSeconds: number;
}

function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * Contagem regressiva do prazo para escolher. Na reta final fica vermelha e, para quem
 * ainda precisa escolher, toca um bipe por segundo (os dois últimos mais agudos).
 * É só visual para leitores de tela (`aria-hidden`): o prazo é anunciado uma vez no status.
 */
export function Countdown({ deadline, now, audible, totalSeconds }: CountdownProps) {
  const { t } = useI18n();
  const sound = useSound();
  const [seconds, setSeconds] = useState(() => secondsLeft(deadline, now()));
  const lastBeep = useRef<number | null>(null);
  const urgent = urgentSeconds(totalSeconds);

  useEffect(() => {
    setSeconds(secondsLeft(deadline, now()));
    const timer = setInterval(() => setSeconds(secondsLeft(deadline, now())), TICK_MS);
    return () => clearInterval(timer);
  }, [deadline, now]);

  // Um bipe por segundo na reta final; nunca dois no mesmo segundo.
  useEffect(() => {
    if (!audible || seconds < 1 || seconds > urgent || lastBeep.current === seconds) return;
    lastBeep.current = seconds;
    sound.alert(seconds <= FINAL_SECONDS);
  }, [audible, seconds, sound, urgent]);

  return (
    <span class={`countdown ${seconds <= urgent ? 'countdown-urgent' : ''}`} aria-hidden="true">
      ⏱ {t.game.secondsLeft(seconds)}
    </span>
  );
}
