import { LANGUAGES, useI18n } from '../i18n';

export function LanguageSwitcher() {
  const { t, language, setLanguage } = useI18n();
  return (
    <div class="language-switcher" role="group" aria-label={t.language.label}>
      {LANGUAGES.map((option) => (
        <button
          key={option.id}
          type="button"
          lang={option.id}
          aria-label={option.name}
          aria-pressed={language === option.id}
          onClick={() => setLanguage(option.id)}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}
