import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { GameSession } from '../../application/gameSession';
import type { HomeView } from '../../application/view';
import {
  BEST_OF_OPTIONS,
  CHOICE_SECONDS_OPTIONS,
  DEFAULT_CHOICE_SECONDS,
  ROOM_CODE_LENGTH,
  type BestOf,
  type ChoiceSeconds,
} from '../../domain/types';
import { useI18n } from '../i18n';

interface HomeScreenProps {
  view: HomeView;
  session: GameSession;
  onPlayComputer: (bestOf: BestOf) => void;
}

const BEST_OF_KEY = 'jokenpo:best-of';
const CHOICE_SECONDS_KEY = 'jokenpo:choice-seconds';

/** Lê uma das opções salvas no navegador, ou o padrão. */
function loadOption<T extends number>(key: string, options: readonly T[], fallback: T): T {
  try {
    const saved = Number(localStorage.getItem(key));
    return (options as readonly number[]).includes(saved) ? (saved as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveOption(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Sem armazenamento: vale só nesta visita.
  }
}

/**
 * Limpa o código enquanto se digita: maiúsculas, sem espaços nem hífens, no máximo 4 caracteres.
 * Colar "ab-23" vira "AB23". (Não dá para usar `maxLength`: ele cortaria o texto colado antes da limpeza.)
 */
function tidyRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '').slice(0, ROOM_CODE_LENGTH);
}

/*
 * Enquanto a sessão online está ocupada (conectando), só "Criar sala" e "Entrar" ficam travados.
 * Apelido, formato e "Jogar contra o computador" não dependem da rede e seguem disponíveis.
 */
export function HomeScreen({ view, session, onPlayComputer }: HomeScreenProps) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState(view.nickname ?? '');
  // Valor mais recente, mesmo antes da próxima renderização (digitar e clicar logo em seguida).
  const latestNickname = useRef(nickname);
  const [bestOf, setBestOf] = useState<BestOf>(() => loadOption(BEST_OF_KEY, BEST_OF_OPTIONS, 0));
  const [choiceSeconds, setChoiceSeconds] = useState<ChoiceSeconds>(() =>
    loadOption(CHOICE_SECONDS_KEY, CHOICE_SECONDS_OPTIONS, DEFAULT_CHOICE_SECONDS),
  );
  const ids = { code: useId(), hint: useId(), error: useId(), nickname: useId(), nicknameHint: useId(), choiceHint: useId() };
  const hasError = view.error !== null;

  // O apelido salvo pode mudar por fora (por exemplo, normalizado pela sessão).
  const savedNickname = useRef(view.nickname);
  useEffect(() => {
    if (view.nickname === savedNickname.current) return; // só reage a mudanças, não à montagem
    savedNickname.current = view.nickname;
    setNickname(view.nickname ?? '');
    latestNickname.current = view.nickname ?? '';
  }, [view.nickname]);
  useEffect(() => saveOption(BEST_OF_KEY, bestOf), [bestOf]);
  useEffect(() => saveOption(CHOICE_SECONDS_KEY, choiceSeconds), [choiceSeconds]);

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

      <fieldset class="format-picker">
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

      <fieldset class="format-picker" aria-describedby={ids.choiceHint}>
        <legend>{t.choice.label}</legend>
        <div class="segmented segmented-3">
          {CHOICE_SECONDS_OPTIONS.map((option) => (
            <label key={option} class="segment">
              <input
                type="radio"
                name="choice-seconds"
                value={option}
                checked={choiceSeconds === option}
                onChange={() => setChoiceSeconds(option)}
              />
              <span>{t.choice.option(option)}</span>
            </label>
          ))}
        </div>
        <p id={ids.choiceHint} class="hint">
          {t.choice.hint}
        </p>
      </fieldset>

      <div class="actions">
        <button
          type="button"
          class="button button-primary button-large"
          disabled={view.busy}
          onClick={() => {
            commitNickname();
            void session.createRoom(bestOf, choiceSeconds);
          }}
        >
          {t.home.create}
        </button>
        <button
          type="button"
          class="button button-secondary button-large"
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
            placeholder="AB23"
            value={code}
            disabled={view.busy}
            aria-describedby={hasError ? `${ids.error} ${ids.hint}` : ids.hint}
            aria-invalid={hasError}
            onInput={(event) => {
              const tidy = tidyRoomCode(event.currentTarget.value);
              // Campo controlado: reescreve o valor na hora, para nunca exibir mais que 4 caracteres.
              if (event.currentTarget.value !== tidy) event.currentTarget.value = tidy;
              setCode(tidy);
            }}
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
