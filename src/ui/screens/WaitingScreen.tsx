import type { GameSession } from '../../application/gameSession';
import type { GameView } from '../../application/view';
import { useToast } from '../components/Toasts';
import { useI18n } from '../i18n';
import { canShareNatively, copyText, inviteUrl, shareInvite } from '../invite';

type WaitingView = Extract<GameView, { screen: 'waiting' }>;

export function WaitingScreen({ view, session }: { view: WaitingView; session: GameSession }) {
  const { t } = useI18n();
  const toast = useToast();
  const url = inviteUrl(view.code);

  async function share() {
    const outcome = await shareInvite({ title: t.share.title, text: t.share.text(view.code), url });
    if (outcome === 'copied') toast(t.share.linkCopied);
    if (outcome === 'failed') toast(t.share.copyFailed);
  }

  async function copyCode() {
    toast((await copyText(view.code)) ? t.share.codeCopied : t.share.copyFailed);
  }

  return (
    <div class="screen waiting">
      <h2>{t.waiting.title}</h2>

      <div class="room-code-box">
        <span class="room-code-label" id="room-code-label">
          {t.waiting.codeLabel}
        </span>
        <output class="room-code" aria-labelledby="room-code-label">
          {view.code}
        </output>
      </div>

      <p class="hint">{t.waiting.shareHint}</p>

      <div class="actions">
        <button type="button" class="button button-primary" onClick={share}>
          {canShareNatively() ? t.waiting.share : t.waiting.copyLink}
        </button>
        <button type="button" class="button button-secondary" onClick={copyCode}>
          {t.waiting.copyCode}
        </button>
      </div>

      <p class="waiting-status" role="status">
        <span class="spinner" aria-hidden="true" /> {t.waiting.waitingForOpponent}
      </p>

      <button type="button" class="button button-ghost" onClick={() => session.leave()}>
        {t.leave.button}
      </button>
    </div>
  );
}
