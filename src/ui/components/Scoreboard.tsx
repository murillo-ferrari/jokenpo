import type { PlayingView } from '../../application/view';
import { useI18n } from '../i18n';

/** Nomes exibidos: apelido, "Computador" ou o genérico "Você"/"Adversário". */
export function usePlayerNames(view: PlayingView): { me: string; opponent: string } {
  const { t } = useI18n();
  return {
    me: view.myName ?? t.game.you,
    opponent: view.vsComputer ? t.game.computer : (view.opponentName ?? t.game.opponent),
  };
}

/** Placar com nomes, indicador de presença do adversário e o formato da partida. */
export function Scoreboard({ view }: { view: PlayingView }) {
  const { t } = useI18n();
  const { me: myName, opponent: opponentName } = usePlayerNames(view);
  const online = view.opponent === 'connected';

  return (
    <section class="scoreboard-wrapper" aria-label={t.game.scoreSummary(view.scores.me, view.scores.opponent, view.ties)}>
      <div class="scoreboard" aria-hidden="true">
        <div class="score score-me">
          <span class="score-label" title={myName}>
            {myName}
          </span>
          <span class="score-value">{view.scores.me}</span>
        </div>
        <div class="score-middle">
          <span class="round-label">{view.phase === 'finished' ? t.game.matchOver : t.game.round(view.roundNumber)}</span>
          <span class="ties-label">
            {t.game.ties}: {view.ties}
          </span>
        </div>
        <div class="score score-opponent">
          <span class="score-label" title={opponentName}>
            {opponentName}
          </span>
          <span class="score-value">{view.scores.opponent}</span>
          {!view.vsComputer && (
            <span class={`presence ${online ? 'presence-online' : 'presence-offline'}`}>
              <span class="presence-dot" />
              {online ? t.game.online : t.game.offline}
            </span>
          )}
        </div>
      </div>
      <FormatLine view={view} />
    </section>
  );
}

/** "Melhor de 3 · vence quem fizer 2 · 10 s para escolher" (só o que se aplica à partida). */
function FormatLine({ view }: { view: PlayingView }) {
  const { t } = useI18n();
  const parts = [
    view.winsNeeded !== null ? t.format.summary(view.bestOf, view.winsNeeded) : null,
    view.vsComputer ? null : t.choice.summary(view.choiceSeconds),
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return <p class="format-line">{parts.join(' · ')}</p>;
}
