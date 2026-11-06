import { useI18n } from '../i18n';
import { useSound } from '../sound';

/** Liga/desliga os sons do jogo. A escolha fica salva no navegador. */
export function SoundToggle() {
  const { t } = useI18n();
  const { enabled, toggle } = useSound();
  return (
    <button type="button" class="icon-toggle" aria-label={t.sound.label} aria-pressed={enabled} onClick={toggle}>
      <span aria-hidden="true">{enabled ? '🔊' : '🔇'}</span>
    </button>
  );
}
