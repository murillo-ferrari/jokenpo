import { useId, useState } from 'preact/hooks';
import type { GameSession } from '../../application/gameSession';
import type { GameView } from '../../application/view';
import { useI18n } from '../i18n';

type HomeView = Extract<GameView, { screen: 'home' }>;

export function HomeScreen({ view, session }: { view: HomeView; session: GameSession }) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const hasError = view.error !== null;

  return (
    <div class="screen home">
      <p class="tagline">{t.tagline}</p>

      <button type="button" class="button button-primary button-large" disabled={view.busy} onClick={() => session.createRoom()}>
        {t.home.create}
      </button>

      <p class="divider" aria-hidden="true">
        <span>{t.home.or}</span>
      </p>

      <form
        class="join-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void session.joinRoom(code);
        }}
      >
        <label for={inputId}>{t.home.joinLabel}</label>
        <div class="join-row">
          <input
            id={inputId}
            class="code-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellcheck={false}
            maxLength={8}
            placeholder="AB23"
            value={code}
            disabled={view.busy}
            aria-describedby={hasError ? `${errorId} ${hintId}` : hintId}
            aria-invalid={hasError}
            onInput={(event) => setCode(event.currentTarget.value)}
          />
          <button type="submit" class="button button-secondary" disabled={view.busy}>
            {t.home.joinButton}
          </button>
        </div>
        <p id={hintId} class="hint">
          {t.home.joinHint}
        </p>
        {view.error && (
          <p id={errorId} class="field-error" role="alert">
            {t.home.errors[view.error]}
          </p>
        )}
      </form>

      {view.busy && (
        <p class="busy" role="status">
          <span class="spinner" aria-hidden="true" /> {t.home.busy}
        </p>
      )}
    </div>
  );
}
