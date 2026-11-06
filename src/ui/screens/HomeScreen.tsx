import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { GameSession } from '../../application/gameSession';
import type { HomeView } from '../../application/view';
import { BEST_OF_OPTIONS, type BestOf } from '../../domain/types';
import { useI18n } from '../i18n';

interface HomeScreenProps {
  view: HomeView;
  session: GameSession;
  onPlayComputer: (bestOf: BestOf) => void;
}

const BEST_OF_KEY = 'jokenpo:best-of';

function loadBestOf(): BestOf {
  try {
    const saved = Number(localStorage.getItem(BEST_OF_KEY));
    return (BEST_OF_OPTIONS as readonly number[]).includes(saved) ? (saved as BestOf) : 0;
  } catch {
    return 0;
  }
}

function saveBestOf(bestOf: BestOf): void {
  try {
    localStorage.setItem(BEST_OF_KEY, String(bestOf));
  } catch {
    // Sem armazenamento: vale só nesta visita.
  }
}

export function HomeScreen({ view, session, onPlayComputer }: HomeScreenProps) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState(view.nickname ?? '');
  // Valor mais recente, mesmo antes da próxima renderização (digitar e clicar logo em seguida).
  const latestNickname = useRef(nickname);
  const [bestOf, setBestOf] = useState<BestOf>(loadBestOf);
  const ids = { code: useId(), hint: useId(), error: useId(), nickname: useId(), nicknameHint: useId() };
  const hasError = view.error !== null;

  // O apelido salvo pode mudar por fora (por exemplo, normalizado pela sessão).
  const savedNickname = useRef(view.nickname);
  useEffect(() => {
    if (view.nickname === savedNickname.current) return; // só reage a mudanças, não à montagem
    savedNickname.current = view.nickname;
    setNickname(view.nickname ?? '');
    latestNickname.current = view.nickname ?? '';
  }, [view.nickname]);
  useEffect(() => saveBestOf(bestOf), [bestOf]);

  const commitNickname = () => {
    if ((view.nickname ?? '') !== latestNickname.current) void session.setNickname(latestNickname.current);
  };

  return (
    <div class="screen home">
      <p class="tagline">{t.tagline}</p>

      <div class="field">
        <label for={ids.nickname}>{t.home.nicknameLabel}</label>
        <input
          id={ids.nickname}
          class="text-input"
          type="text"
          autoComplete="nickname"
          maxLength={40}
          value={nickname}
          disabled={view.busy}
          aria-describedby={ids.nicknameHint}
          onInput={(event) => {
            latestNickname.current = event.currentTarget.value;
            setNickname(event.currentTarget.value);
          }}
          onBlur={commitNickname}
        />
        <p id={ids.nicknameHint} class="hint">
          {t.home.nicknameHint}
        </p>
      </div>

      <fieldset class="format-picker" disabled={view.busy}>
        <legend>{t.format.label}</legend>
        <div class="segmented">
          {BEST_OF_OPTIONS.map((option) => (
            <label key={option} class="segment">
              <input
                type="radio"
                name="best-of"
                value={option}
                checked={bestOf === option}
                onChange={() => setBestOf(option)}
              />
              <span>{t.format.options[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div class="actions">
        <button
          type="button"
          class="button button-primary button-large"
          disabled={view.busy}
          onClick={() => {
            commitNickname();
            void session.createRoom(bestOf);
          }}
        >
          {t.home.create}
        </button>
        <button
          type="button"
          class="button button-secondary button-large"
          disabled={view.busy}
          onClick={() => {
            commitNickname();
            onPlayComputer(bestOf);
          }}
        >
          {t.home.playComputer}
        </button>
      </div>

      <p class="divider" aria-hidden="true">
        <span>{t.home.or}</span>
      </p>

      <form
        class="join-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          commitNickname();
          void session.joinRoom(code);
        }}
      >
        <label for={ids.code}>{t.home.joinLabel}</label>
        <div class="join-row">
          <input
            id={ids.code}
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
            aria-describedby={hasError ? `${ids.error} ${ids.hint}` : ids.hint}
            aria-invalid={hasError}
            onInput={(event) => setCode(event.currentTarget.value)}
          />
          <button type="submit" class="button button-secondary" disabled={view.busy}>
            {t.home.joinButton}
          </button>
        </div>
        <p id={ids.hint} class="hint">
          {t.home.joinHint}
        </p>
        {view.error && (
          <p id={ids.error} class="field-error" role="alert">
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
