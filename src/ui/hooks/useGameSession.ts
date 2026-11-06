import { useEffect, useState } from 'preact/hooks';
import type { GameSession } from '../../application/gameSession';
import type { GameView, Notice } from '../../application/view';

/** Tela atual da sessão, atualizada a cada mudança. */
export function useGameView(session: GameSession): GameView {
  const [view, setView] = useState(() => session.getView());
  useEffect(() => {
    setView(session.getView());
    return session.subscribe(setView);
  }, [session]);
  return view;
}

/** Repassa cada aviso da sessão (para virar toast). */
export function useNotices(session: GameSession, onNotice: (notice: Notice) => void): void {
  useEffect(() => session.onNotice(onNotice), [session, onNotice]);
}
