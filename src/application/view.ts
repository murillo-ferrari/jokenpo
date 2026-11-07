import type { MatchSummary, RoundEnding } from '../domain/match';
import { opponentStatus, type Room } from '../domain/room';
import { opponentOf, winsNeeded, type BestOf, type ChoiceSeconds, type Move, type PlayerId, type PlayerSlot, type RoomCode } from '../domain/types';
import type { JoinError } from './joinRoom';

/*
 * O que a interface precisa para desenhar a tela. Tudo do ponto de vista de quem
 * está jogando ("eu" e "adversário"); a UI nunca lida com player1/player2.
 */

/** `unreachable`: o servidor não respondeu a tempo (sem internet, por exemplo). */
export type HomeError = JoinError | 'unexpected' | 'unreachable';

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
  /** Partida contra o computador (sem rede). */
  vsComputer: boolean;
  bestOf: BestOf;
  /** Vitórias para levar a partida; `null` na partida livre. */
  winsNeeded: number | null;
  myName: string | null;
  opponentName: string | null;
  /** Número da rodada em andamento, começando em 1. */
  roundNumber: number;
  scores: { me: number; opponent: number };
  ties: number;
  /** `finished`: alguém já levou a partida (formato "melhor de N"); só resta a revanche. */
  phase: 'choosing' | 'revealing' | 'finished';
  /** Resultado da partida, quando encerrada. */
  matchResult: Exclude<RoundResult, 'tie'> | null;
  /** A jogada que escolhi nesta rodada (se escolhi neste navegador). */
  myMove: Move | null;
  iHaveChosen: boolean;
  opponentHasChosen: boolean;
  canPlay: boolean;
  opponent: 'connected' | 'disconnected';
  /** Horário (servidor) até quando o adversário pode revelar; `null` se não há prazo correndo. */
  revealDeadline: number | null;
  /** Horário (servidor) até quando o atrasado pode escolher; `null` se não há prazo correndo. */
  choiceDeadline: number | null;
  /** Tempo para escolher definido na sala. */
  choiceSeconds: ChoiceSeconds;
  lastRound: LastRoundView | null;
  history: LastRoundView[];
  reset: ResetState;
}

export interface HomeView {
  screen: 'home';
  busy: boolean;
  error: HomeError | null;
  /** Apelido salvo neste navegador. */
  nickname: string | null;
}

export interface WaitingView {
  screen: 'waiting';
  code: RoomCode;
  bestOf: BestOf;
}

export type GameView = { screen: 'loading' } | HomeView | WaitingView | PlayingView;

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
  vsComputer: boolean;
}

export function buildPlayingView({ room, mySlot, me, summary, myPendingMove, now, busy, vsComputer }: PlayingViewInput): PlayingView {
  const opponent = opponentOf(mySlot);
  const { current, winner } = summary;
  const finished = winner !== null;
  const iHaveChosen = !finished && (current.phase === 'revealing' || current.committed[mySlot]);
  const opponentHasChosen = !finished && (current.phase === 'revealing' || current.committed[opponent]);
  const status = opponentStatus(room, mySlot, now);
  const history = summary.history.map((round) => toRoundView(round, mySlot));

  let reset: ResetState = 'none';
  if (room.resetRequest) reset = room.resetRequest.by === me ? 'requested-by-me' : 'requested-by-opponent';

  return {
    screen: 'playing',
    code: room.code,
    vsComputer,
    bestOf: room.bestOf,
    winsNeeded: winsNeeded(room.bestOf),
    myName: room.players[mySlot]?.name ?? null,
    opponentName: room.players[opponent]?.name ?? null,
    roundNumber: current.index + 1,
    scores: { me: summary.scores[mySlot], opponent: summary.scores[opponent] },
    ties: summary.ties,
    phase: finished ? 'finished' : current.phase,
    matchResult: finished ? (winner === mySlot ? 'win' : 'loss') : null,
    myMove: finished ? null : myPendingMove,
    iHaveChosen,
    opponentHasChosen,
    canPlay: !finished && current.phase === 'choosing' && !iHaveChosen && !busy && status === 'connected',
    opponent: status === 'connected' ? 'connected' : 'disconnected',
    revealDeadline: !finished && current.phase === 'revealing' ? current.deadline : null,
    choiceDeadline: !finished && current.phase === 'choosing' ? current.deadline : null,
    choiceSeconds: room.choiceSeconds,
    lastRound: history.at(-1) ?? null,
    history,
    reset,
  };
}
