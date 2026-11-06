import type { ComponentChildren } from 'preact';
import type { LastRoundView, PlayingView } from '../../application/view';
import type { CardStage } from '../hooks/useRevealSequence';
import { useI18n } from '../i18n';
import type { Messages } from '../i18n/messages';
import { MOVE_EMOJI } from './moves';

interface RoundCardProps {
  view: PlayingView;
  stage: CardStage;
  myLabel: string;
  opponentLabel: string;
}

/** Texto explicativo quando a rodada não terminou do jeito normal. */
function useEndingText(round: LastRoundView | null): string | null {
  const { t } = useI18n();
  if (!round || round.ending === 'played') return null;
  if (round.ending === 'void') return t.game.endings.void;
  if (round.result === 'tie') return null;
  return t.game.endings[round.ending][round.result];
}

/** Marcador desenhado na cor do tema: "?" (ainda não escolheu) ou "✓" (escolheu, sem revelar). */
function Marker({ symbol, label }: { symbol: '?' | '✓'; label: string }) {
  return (
    <span class={`round-move-placeholder ${symbol === '✓' ? 'is-chosen' : ''}`} title={label}>
      {symbol}
    </span>
  );
}

interface CardContent {
  mine: ComponentChildren;
  theirs: ComponentChildren;
  middle: string;
  resultClass: string;
  title: string;
}

interface CardContentInput {
  view: PlayingView;
  stage: CardStage;
  showingResult: boolean;
  myLabel: string;
  opponentLabel: string;
  t: Messages;
}

/** O que o cartão mostra em cada estado: contagem, rodada em andamento ou resultado. */
function cardContent({ view, stage, showingResult, myLabel, opponentLabel, t }: CardContentInput): CardContent {
  const round = view.lastRound;

  // Contagem "Jo… Ken… Pô!": os dois punhos balançando.
  if (stage.kind === 'countdown') {
    return {
      mine: '✊',
      theirs: '✊',
      middle: t.game.countdown[stage.step] ?? '',
      resultClass: '',
      title: t.game.round(round?.number ?? view.roundNumber),
    };
  }

  // Rodada em andamento: a minha jogada (ou "?"/"✓") e só "?"/"✓" do adversário.
  if (!showingResult || !round) {
    return {
      mine: view.myMove ? MOVE_EMOJI[view.myMove] : <Marker symbol={view.iHaveChosen ? '✓' : '?'} label={myLabel} />,
      theirs: <Marker symbol={view.opponentHasChosen ? '✓' : '?'} label={opponentLabel} />,
      middle: 'vs',
      resultClass: '',
      title: t.game.round(view.roundNumber),
    };
  }

  const result = { middle: 'vs', resultClass: `result-${round.result}`, title: t.game.round(round.number) };

  // W.O. por não escolher: quem escolheu ganhou, mas a jogada dele nunca foi revelada ("✓"); quem não escolheu: "—".
  if (round.ending === 'choice-timeout') {
    return {
      ...result,
      mine: round.result === 'win' ? <Marker symbol="✓" label={myLabel} /> : '—',
      theirs: round.result === 'loss' ? <Marker symbol="✓" label={opponentLabel} /> : '—',
    };
  }

  // Resultado normal: as duas jogadas reveladas ("—" para quem não revelou a tempo).
  return {
    ...result,
    mine: round.myMove ? MOVE_EMOJI[round.myMove] : '—',
    theirs: round.opponentMove ? MOVE_EMOJI[round.opponentMove] : '—',
  };
}

/**
 * O cartão do centro da tela. Mostra sempre uma coisa só:
 * - a rodada em andamento: "?" de quem não escolheu, a SUA jogada quando você escolhe e "✓" quando o adversário escolhe;
 * - a contagem "Jo… Ken… Pô!" quando os dois escolheram;
 * - o resultado, por alguns segundos (ou até a revanche, se a partida acabou).
 * Altura fixa em todos os estados, para nada se mexer na tela.
 */
export function RoundCard({ view, stage, myLabel, opponentLabel }: RoundCardProps) {
  const { t } = useI18n();
  const round = view.lastRound;
  const showingResult = stage.kind === 'result' && round !== null;
  const endingText = useEndingText(showingResult ? round : null);

  const { mine, theirs, middle, resultClass, title } = cardContent({ view, stage, showingResult, myLabel, opponentLabel, t });

  const moveText = (move: LastRoundView['myMove']) => (move ? `${MOVE_EMOJI[move]} ${t.moves[move]}` : t.game.noMove);
  const shaking = stage.kind === 'countdown' ? 'shaking' : '';

  return (
    <section class={`round-card round-card-${showingResult ? 'result' : stage.kind} ${resultClass}`} aria-label={title}>
      {/* O resultado completo é anunciado uma vez, quando aparece. */}
      <p class="visually-hidden" aria-live="polite">
        {showingResult
          ? `${t.game.roundSummary(round.number, moveText(round.myMove), moveText(round.opponentMove), t.game.results[round.result])} ${endingText ?? ''}`
          : ''}
      </p>
      <div class="round-moves" aria-hidden="true">
        <span class="round-move">
          <span class={`round-move-emoji ${shaking}`}>{mine}</span>
          <span class="round-move-owner">{myLabel}</span>
        </span>
        <span class="round-vs">{middle}</span>
        <span class="round-move">
          <span class={`round-move-emoji ${shaking}`}>{theirs}</span>
          <span class="round-move-owner">{opponentLabel}</span>
        </span>
      </div>
      {/* Uma linha sempre reservada para o resultado: a altura não muda. Casos raros (W.O., jogada
          inválida, rodada anulada) ganham uma etiqueta curta na mesma linha; a explicação completa
          fica no tooltip e no texto lido pelo leitor de tela. */}
      <div class="round-outcome" aria-hidden="true">
        <p class="round-result" style={{ visibility: showingResult ? 'visible' : 'hidden' }}>
          {showingResult ? t.game.results[round.result] : '\u00a0'}
          {showingResult && round.ending !== 'played' && (
            <span class="round-ending-tag" title={endingText ?? undefined}>
              {t.game.endingTags[round.ending]}
            </span>
          )}
        </p>
      </div>
    </section>
  );
}
