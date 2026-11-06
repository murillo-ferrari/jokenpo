import type { MatchSummary, RoundEnding } from '../domain/match';
import { opponentStatus, type Room } from '../domain/room';
import { opponentOf, type Move, type PlayerId, type PlayerSlot, type RoomCode } from '../domain/types';
import type { JoinError } from './joinRoom';

/*
 * O que a interface precisa para desenhar a tela. Tudo do ponto de vista de quem
 * está jogando ("eu" e "adversário"); a UI nunca lida com player1/player2.
 */

export type HomeError = JoinError | 'unexpected';

export type ResetState = 'none' | 'requested-by-me' | 'requested-by-opponent';

export type RoundResult = 'win' | 'loss' | 'tie';

export interface LastRoundView {
  /** Número da rodada, começando em 1. */
  number: number;
  result: RoundResult;
  ending: RoundEnding;
  myMove: Move | null;
  opponentMove: Move | null;
}

export interface PlayingView {
  screen: 'playing';
  code: RoomCode;
  /** Número da rodada em andamento, começando em 1. */
  roundNumber: number;
  scores: { me: number; opponent: number };
  ties: number;
  phase: 'choosing' | 'revealing';
  /** A jogada que escolhi nesta rodada (se escolhi neste navegador). */
  myMove: Move | null;
  iHaveChosen: boolean;
  opponentHasChosen: boolean;
  canPlay: boolean;
  opponent: 'connected' | 'disconnected';
  /** Horário (servidor) até quando o adversário pode revelar; `null` se não há prazo correndo. */
  revealDeadline: number | null;
  lastRound: LastRoundView | null;
  history: LastRoundView[];
  reset: ResetState;
}

export type GameView =
  | { screen: 'loading' }
  | { screen: 'home'; busy: boolean; error: HomeError | null }
  | { screen: 'waiting'; code: RoomCode }
  | PlayingView;

/** Avisos pontuais (toasts). A UI traduz cada um para o idioma escolhido. */
export type Notice =
  | 'opponent-joined'
  | 'opponent-left'
  | 'room-closed'
  | 'removed-from-room'
  | 'reset-accepted'
  | 'reset-declined'
  | 'action-failed'
  | 'connection-lost';

export function toRoundView(
  round: MatchSummary['history'][number],
  mySlot: PlayerSlot,
): LastRoundView {
  const opponent = opponentOf(mySlot);
  const result: RoundResult = round.outcome === 'tie' ? 'tie' : round.outcome === mySlot ? 'win' : 'loss';
  return {
    number: round.index + 1,
    result,
    ending: round.ending,
    myMove: round.moves[mySlot] ?? null,
    opponentMove: round.moves[opponent] ?? null,
  };
}

export interface PlayingViewInput {
  room: Room;
  mySlot: PlayerSlot;
  me: PlayerId;
  summary: MatchSummary;
  myPendingMove: Move | null;
  now: number;
  /** Uma ação minha está em andamento (bloqueia novos cliques). */
  busy: boolean;
}

export function buildPlayingView({ room, mySlot, me, summary, myPendingMove, now, busy }: PlayingViewInput): PlayingView {
  const opponent = opponentOf(mySlot);
  const { current } = summary;
  const iHaveChosen = current.phase === 'revealing' || current.committed[mySlot];
  const opponentHasChosen = current.phase === 'revealing' || current.committed[opponent];
  const status = opponentStatus(room, mySlot, now);
  const history = summary.history.map((round) => toRoundView(round, mySlot));

  let reset: ResetState = 'none';
  if (room.resetRequest) reset = room.resetRequest.by === me ? 'requested-by-me' : 'requested-by-opponent';

  return {
    screen: 'playing',
    code: room.code,
    roundNumber: current.index + 1,
    scores: { me: summary.scores[mySlot], opponent: summary.scores[opponent] },
    ties: summary.ties,
    phase: current.phase,
    myMove: myPendingMove,
    iHaveChosen,
    opponentHasChosen,
    canPlay: current.phase === 'choosing' && !iHaveChosen && !busy && status === 'connected',
    opponent: status === 'connected' ? 'connected' : 'disconnected',
    revealDeadline: current.phase === 'revealing' ? current.deadline : null,
    lastRound: history.at(-1) ?? null,
    history,
    reset,
  };
}
