import { useCallback } from 'preact/hooks';
import type { GameSession } from '../application/gameSession';
import type { Notice } from '../application/view';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ToastProvider, useToast } from './components/Toasts';
import { useGameView, useNotices } from './hooks/useGameSession';
import { I18nProvider, useI18n, type Language } from './i18n';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { WaitingScreen } from './screens/WaitingScreen';

interface AppProps {
  session: GameSession;
  language: Language;
}

export function App({ session, language }: AppProps) {
  return (
    <I18nProvider initial={language}>
      <ToastProvider>
        <Shell session={session} />
      </ToastProvider>
    </I18nProvider>
  );
}

function Shell({ session }: { session: GameSession }) {
  const { t } = useI18n();
  const toast = useToast();
  const view = useGameView(session);
  useNotices(
    session,
    useCallback((notice: Notice) => toast(t.notices[notice]), [toast, t]),
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
        {view.screen === 'home' && <HomeScreen view={view} session={session} />}
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
