import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';

const TOAST_DURATION_MS = 4000;

interface Toast {
  id: number;
  message: string;
}

const ToastContext = createContext<((message: string) => void) | null>(null);

/**
 * Avisos curtos no rodapé. A região `aria-live` fica sempre no DOM, para leitores de tela
 * anunciarem cada aviso novo (substitui os `alert()` do app antigo).
 */
export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const show = useCallback((message: string) => {
    const id = (nextId.current += 1);
    setToasts((current) => [...current.filter((toast) => toast.message !== message), { id, message }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
    timers.current.add(timer);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div class="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <p key={toast.id} class="toast">
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return show;
}
