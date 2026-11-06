import { useCallback, useEffect, useState } from 'preact/hooks';
import type { GameSession } from '../application/gameSession';
import type { Notice } from '../application/view';
import type { BestOf } from '../domain/types';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ToastProvider, useToast } from './components/Toasts';
import { useGameView, useNotices } from './hooks/useGameSession';
import { I18nProvider, useI18n, type Language } from './i18n';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { WaitingScreen } from './screens/WaitingScreen';

/** Partida contra o computador: uma sessão própria, sem rede, descartada ao sair. */
export interface ComputerGame {
  session: GameSession;
  dispose(): void;
}

interface AppProps {
  session: GameSession;
  language: Language;
  startComputerGame: (bestOf: BestOf) => Promise<ComputerGame>;
}

export function App({ session, language, startComputerGame }: AppProps) {
  return (
    <I18nProvider initial={language}>
      <ToastProvider>
        <Shell onlineSession={session} startComputerGame={startComputerGame} />
      </ToastProvider>
    </I18nProvider>
  );
}

function Shell({ onlineSession, startComputerGame }: { onlineSession: GameSession; startComputerGame: AppProps['startComputerGame'] }) {
  const [computerGame, setComputerGame] = useState<ComputerGame | null>(null);

  // Ao sair da partida contra o computador (tela inicial), descarta-a e volta para a sessão online.
  useEffect(() => {
    if (!computerGame) return;
    return computerGame.session.subscribe((view) => {
      if (view.screen !== 'home') return;
      computerGame.dispose();
      setComputerGame(null);
    });
  }, [computerGame]);

  const playComputer = useCallback(
    (bestOf: BestOf) => void startComputerGame(bestOf).then(setComputerGame),
    [startComputerGame],
  );

  // `key` remonta o Layout ao trocar de sessão, sem mostrar um quadro com a tela da sessão anterior.
  return (
    <Layout
      key={computerGame ? 'computer' : 'online'}
      session={computerGame?.session ?? onlineSession}
      vsComputer={computerGame !== null}
      onPlayComputer={playComputer}
    />
  );
}

function Layout({ session, vsComputer, onPlayComputer }: { session: GameSession; vsComputer: boolean; onPlayComputer: (bestOf: BestOf) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const view = useGameView(session);
  useNotices(
    session,
    useCallback(
      (notice: Notice) => {
        // Contra o computador, "o adversário entrou" não faz sentido.
        if (vsComputer && notice === 'opponent-joined') return;
        toast(t.notices[notice]);
      },
      [toast, t, vsComputer],
    ),
  );

  return (
    <>
      <header class="app-header">
        <h1>
          <span aria-hidden="true">✊✋✌️</span> {t.appTitle}
        </h1>
        <LanguageSwitcher />
      </header>
      <main class="card">
        {view.screen === 'loading' && (
          <p class="busy" role="status">
            <span class="spinner" aria-hidden="true" /> {t.loading}
          </p>
        )}
        {view.screen === 'home' && <HomeScreen view={view} session={session} onPlayComputer={onPlayComputer} />}
        {view.screen === 'waiting' && <WaitingScreen view={view} session={session} />}
        {view.screen === 'playing' && <GameScreen view={view} session={session} />}
      </main>
    </>
  );
}

/** Tela mostrada se o jogo nem conseguir iniciar (por exemplo, config do Firebase ausente). */
export function StartupError({ language }: { language: Language }) {
  return (
    <I18nProvider initial={language}>
      <StartupErrorMessage />
    </I18nProvider>
  );
}

function StartupErrorMessage() {
  const { t } = useI18n();
  return (
    <main class="card">
      <h1>{t.appTitle}</h1>
      <p role="alert">{t.configError}</p>
    </main>
  );
}
