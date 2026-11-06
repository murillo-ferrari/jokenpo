import { useState } from 'preact/hooks';
import type { GameSession } from '../../application/gameSession';
import type { PlayingView } from '../../application/view';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MOVE_EMOJI, MOVE_ORDER } from '../components/moves';
import { RoundCard } from '../components/RoundCard';
import { Scoreboard } from '../components/Scoreboard';
import { useI18n } from '../i18n';

function useStatusText(view: PlayingView): string {
  const { t } = useI18n();
  if (view.opponent === 'disconnected') return t.game.opponentDisconnected;
  if (view.phase === 'revealing') return t.game.revealing;
  if (view.iHaveChosen) {
    const chosen = view.myMove ? t.game.youChose(t.moves[view.myMove]) : '';
    return `${chosen} ${t.game.waitingOpponent}`.trim();
  }
  return view.opponentHasChosen ? t.game.opponentChose : t.game.chooseMove;
}

export function GameScreen({ view, session }: { view: PlayingView; session: GameSession }) {
  const { t } = useI18n();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const status = useStatusText(view);
  const previousRounds = view.history.slice(0, -1).reverse();

  return (
    <div class="screen game">
      <p class="room-tag">{t.game.roomLabel(view.code)}</p>

      <Scoreboard me={view.scores.me} opponent={view.scores.opponent} ties={view.ties} roundNumber={view.roundNumber} />

      {view.lastRound && <RoundCard round={view.lastRound} />}

      <p class={`status ${view.opponent === 'disconnected' ? 'status-warning' : ''}`} role="status">
        {status}
      </p>

      <div class="moves" role="group" aria-label={t.game.movesLabel}>
        {MOVE_ORDER.map((move) => (
          <button
            key={move}
            type="button"
            class="move-button"
            aria-pressed={view.myMove === move}
            disabled={!view.canPlay}
            onClick={() => session.play(move)}
          >
            <span class="move-emoji" aria-hidden="true">
              {MOVE_EMOJI[move]}
            </span>
            <span class="move-label">{t.moves[move]}</span>
          </button>
        ))}
      </div>

      {view.reset === 'requested-by-me' && (
        <div class="reset-pending" role="status">
          <p>{t.reset.waitingAnswer}</p>
          <button type="button" class="button button-ghost" onClick={() => session.cancelReset()}>
            {t.reset.cancel}
          </button>
        </div>
      )}

      {previousRounds.length > 0 && (
        <details class="history">
          <summary>{t.game.history(previousRounds.length)}</summary>
          <ol>
            {previousRounds.map((round) => (
              <li key={round.number} class={`result-${round.result}`}>
                <span class="history-number">{round.number}</span>
                <span aria-hidden="true">
                  {round.myMove ? MOVE_EMOJI[round.myMove] : '—'} × {round.opponentMove ? MOVE_EMOJI[round.opponentMove] : '—'}
                </span>
                <span class="visually-hidden">
                  {t.game.roundSummary(
                    round.number,
                    round.myMove ? t.moves[round.myMove] : t.game.noMove,
                    round.opponentMove ? t.moves[round.opponentMove] : t.game.noMove,
                    '',
                  )}
                </span>
                <span class="history-result">{t.game.results[round.result]}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <div class="actions actions-footer">
        <button
          type="button"
          class="button button-secondary"
          disabled={view.reset !== 'none'}
          onClick={() => session.requestReset()}
        >
          {t.reset.request}
        </button>
        <button type="button" class="button button-ghost" onClick={() => setConfirmingLeave(true)}>
          {t.leave.button}
        </button>
      </div>

      <ConfirmDialog
        open={view.reset === 'requested-by-opponent'}
        title={t.reset.incomingTitle}
        body={t.reset.incomingBody}
        confirmLabel={t.reset.accept}
        cancelLabel={t.reset.decline}
        onConfirm={() => session.respondToReset(true)}
        onCancel={() => session.respondToReset(false)}
      />

      <ConfirmDialog
        open={confirmingLeave}
        title={t.leave.confirmTitle}
        body={t.leave.confirmBody}
        confirmLabel={t.leave.confirm}
        cancelLabel={t.leave.stay}
        tone="danger"
        onConfirm={() => {
          setConfirmingLeave(false);
          void session.leave();
        }}
        onCancel={() => setConfirmingLeave(false)}
      />
    </div>
  );
}
