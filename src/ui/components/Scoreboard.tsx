import { useI18n } from '../i18n';

interface ScoreboardProps {
  me: number;
  opponent: number;
  ties: number;
  roundNumber: number;
}

export function Scoreboard({ me, opponent, ties, roundNumber }: ScoreboardProps) {
  const { t } = useI18n();
  return (
    <section class="scoreboard" aria-label={t.game.scoreSummary(me, opponent, ties)}>
      <div class="score score-me" aria-hidden="true">
        <span class="score-label">{t.game.you}</span>
        <span class="score-value">{me}</span>
      </div>
      <div class="score-middle" aria-hidden="true">
        <span class="round-label">{t.game.round(roundNumber)}</span>
        <span class="ties-label">
          {t.game.ties}: {ties}
        </span>
      </div>
      <div class="score score-opponent" aria-hidden="true">
        <span class="score-label">{t.game.opponent}</span>
        <span class="score-value">{opponent}</span>
      </div>
    </section>
  );
}
