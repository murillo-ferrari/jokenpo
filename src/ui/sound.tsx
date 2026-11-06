import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';

/*
 * Sons do jogo, gerados com Web Audio (sem arquivos de áudio: funciona offline e não pesa no download).
 * Navegadores só liberam áudio depois de uma interação do usuário; o primeiro toque na página
 * "destrava" o contexto de áudio (necessário no iOS).
 */

const STORAGE_KEY = 'jokenpo:sound';

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    if (!context && typeof AudioContext === 'function') context = new AudioContext();
    if (context?.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Bipe curto de alerta. `final`: mais agudo, para os últimos segundos. */
export function playAlertBeep(final = false): void {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    const start = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = final ? 1320 : 880;
    // Envelope rápido: sobe e desce em ~150 ms, sem estalo.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (final ? 0.3 : 0.15));
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + (final ? 0.32 : 0.17));
  } catch {
    // Sem áudio disponível: o alerta visual (contagem em vermelho) continua.
  }
}

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

interface SoundValue {
  enabled: boolean;
  toggle: () => void;
  /** Toca o alerta, se o som estiver ligado. */
  alert: (final: boolean) => void;
}

const SoundContext = createContext<SoundValue | null>(null);

export function SoundProvider({ children }: { children: ComponentChildren }) {
  const [enabled, setEnabled] = useState(loadEnabled);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      // Sem armazenamento: vale só nesta visita.
    }
  }, [enabled]);

  // Destrava o áudio no primeiro toque/clique (exigência dos navegadores, principalmente no iOS).
  useEffect(() => {
    const unlock = () => audioContext();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const toggle = useCallback(() => setEnabled((on) => !on), []);
  const alert = useCallback((final: boolean) => enabled && playAlertBeep(final), [enabled]);
  const value = useMemo(() => ({ enabled, toggle, alert }), [enabled, toggle, alert]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundValue {
  const value = useContext(SoundContext);
  if (!value) throw new Error('useSound precisa estar dentro de <SoundProvider>.');
  return value;
}
