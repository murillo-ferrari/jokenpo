import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { en } from './en';
import type { Messages } from './messages';
import { ptBR } from './pt-BR';

export type Language = 'pt-BR' | 'en';

export const LANGUAGES: readonly { id: Language; short: string; name: string }[] = [
  { id: 'pt-BR', short: 'PT', name: 'Português' },
  { id: 'en', short: 'EN', name: 'English' },
];

const DICTIONARIES: Record<Language, Messages> = { 'pt-BR': ptBR, en };
const STORAGE_KEY = 'jokenpo:language';

function isLanguage(value: unknown): value is Language {
  return value === 'pt-BR' || value === 'en';
}

/** pt-BR é o padrão; a escolha do usuário fica salva no navegador. */
export function loadLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLanguage(saved) ? saved : 'pt-BR';
  } catch {
    return 'pt-BR';
  }
}

function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Sem armazenamento: vale só nesta visita.
  }
}

interface I18nValue {
  t: Messages;
  language: Language;
  setLanguage: (language: Language) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initial, children }: { initial: Language; children: ComponentChildren }) {
  const [language, setLanguage] = useState(initial);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = DICTIONARIES[language].appTitle;
    saveLanguage(language);
  }, [language]);

  const value = useMemo(() => ({ t: DICTIONARIES[language], language, setLanguage }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n precisa estar dentro de <I18nProvider>.');
  return value;
}
