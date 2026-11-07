import { useCallback, useState } from 'preact/hooks';
import type { GameSession } from '../../application/gameSession';
import type { PlayingView } from '../../application/view';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Countdown } from '../components/Countdown';
import { MOVE_EMOJI, MOVE_ORDER } from '../components/moves';
import { RoundCard } from '../components/RoundCard';
import { Scoreboard, usePlayerNames } from '../components/Scoreboard';
import { useRevealSequence, type CardStage } from '../hooks/useRevealSequence';
import { useI18n } from '../i18n';

function useStatusText(view: PlayingView, stage: CardStage): string {
  const { t } = useI18n();
  if (view.opponent === 'disconnected') return t.game.opponentDisconnected;
  if (view.phase === 'revealing') return t.game.revealing;
  // Enquanto o cartão mostra o resultado, o status não fala da rodada nova (que o cartão ainda não mostra).
  if (stage.kind === 'result' && !view.iHaveChosen) return t.game.nextRound;
  if (view.iHaveChosen) {
    const chosen = view.myMove ? t.game.youChose(t.moves[view.myMove]) : '';
    return `${chosen} ${t.game.waitingOpponent}`.trim();
  }
  return view.opponentHasChosen ? t.game.opponentChose : t.game.chooseMove;
}

/*
 * Layout estável: placar, cartão da rodada e área de jogada têm sempre a mesma altura,
 * para nada pular na tela quando a rodada termina ou a partida acaba.
 * Tudo é desenhado a partir de `shown`, que segura o placar durante a contagem "Jo… Ken… Pô!".
 */
export function GameScreen({ view, session }: { view: PlayingView; session: GameSession }) {
  const { t } = useI18n();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const { shown, stage } = useRevealSequence(view);
  const names = usePlayerNames(shown);
  // O cartão mostra a rodada atual; as concluídas ficam todas no histórico, da mais recente para a mais antiga.
  const previousRounds = [...shown.history].reverse();

  return (
    <div class="screen game">
      <p class="room-tag">{shown.vsComputer ? t.game.vsComputerLabel : t.game.roomLabel(shown.code)}</p>

      <Scoreboard view={shown} />

      <RoundCard view={shown} stage={stage} myLabel={names.me} opponentLabel={names.opponent} />

      <div class="play-area">
        {shown.phase === 'finished' ? <MatchOver view={shown} session={session} /> : <PlayControls view={shown} stage={stage} session={session} />}
      </div>

      {/* Sempre na tela (mesmo vazio), para não empurrar o rodapé quando a primeira rodada termina. */}
      <History rounds={previousRounds} />

      <div class="actions actions-footer">
        {shown.phase !== 'finished' && <ResetControl view={shown} session={session} />}
        <button type="button" class="button button-ghost" onClick={() => setConfirmingLeave(true)}>
          {t.leave.button}
        </button>
      </div>

      <ConfirmDialog
        open={shown.reset === 'requested-by-opponent' && shown.phase !== 'finished'}
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

function PlayControls({ view, stage, session }: { view: PlayingView; stage: CardStage; session: GameSession }) {
  const { t } = useI18n();
  const status = useStatusText(view, stage);
  const now = useCallback(() => session.serverNow(), [session]);
  // Prazo correndo para quem ainda não escolheu (eu ou o adversário), com o adversário presente.
  const deadline = view.opponent === 'connected' ? view.choiceDeadline : null;
  const mustChoose = deadline !== null && !view.iHaveChosen;
  return (
    <>
      <div class={`status ${view.opponent === 'disconnected' ? 'status-warning' : ''}`}>
        <p role="status">
          {status}
          {/* Anunciado uma vez para leitores de tela; a contagem ao lado é só visual. */}
          {mustChoose && (
            <span class="visually-hidden"> {t.game.choiceDeadlineNotice(Math.max(0, Math.ceil((deadline - now()) / 1000)))}</span>
          )}
        </p>
        {deadline !== null && (
          <Countdown deadline={deadline} now={now} audible={mustChoose} totalSeconds={view.choiceSeconds} />
        )}
      </div>
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
    </>
  );
}

/** Fim de partida no formato "melhor de N": vencedor, placar final e revanche. */
function MatchOver({ view, session }: { view: PlayingView; session: GameSession }) {
  const { t } = useI18n();
  const won = view.matchResult === 'win';
  const names = usePlayerNames(view);
  return (
    <section class={`match-over ${won ? 'result-win' : 'result-loss'}`} role="status">
      <p class="match-over-title">{won ? t.game.matchWon : t.game.matchLost(names.opponent)}</p>
      <p class="match-over-score">{t.game.finalScore(view.scores.me, view.scores.opponent)}</p>
      {view.reset === 'requested-by-opponent' && <p class="match-over-offer">{t.game.rematchOffered}</p>}
      {view.reset === 'requested-by-me' ? (
        <>
          <p>{t.game.rematchWaiting}</p>
          <button type="button" class="button button-ghost" onClick={() => session.cancelReset()}>
            {t.reset.cancel}
          </button>
        </>
      ) : (
        <button type="button" class="button button-primary button-large" onClick={() => session.rematch()}>
          {t.game.rematch}
        </button>
      )}
    </section>
  );
}

/** Botão de recomeçar, que vira o aviso "esperando resposta" no mesmo lugar (sem empurrar a tela). */
function ResetControl({ view, session }: { view: PlayingView; session: GameSession }) {
  const { t } = useI18n();
  if (view.reset === 'requested-by-me') {
    return (
      <div class="reset-pending" role="status">
        <p>{t.reset.waitingAnswer}</p>
        <button type="button" class="button button-ghost" onClick={() => session.cancelReset()}>
          {t.reset.cancel}
        </button>
      </div>
    );
  }
  return (
    <button type="button" class="button button-secondary" disabled={view.reset !== 'none'} onClick={() => session.requestReset()}>
      {t.reset.request}
    </button>
  );
}

function History({ rounds }: { rounds: PlayingView['history'] }) {
  const { t } = useI18n();
  return (
    <details class="history">
      <summary>{t.game.history(rounds.length)}</summary>
      {rounds.length === 0 && <p class="history-empty">{t.game.noRoundsYet}</p>}
      <ol>
        {rounds.map((round) => (
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
  );
}
