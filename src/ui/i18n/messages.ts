import type { HomeError, Notice, RoundResult } from '../../application/view';
import type { Move } from '../../domain/types';

/** Todos os textos da interface. Cada idioma implementa este tipo inteiro. */
export interface Messages {
  appTitle: string;
  tagline: string;
  loading: string;
  configError: string;
  language: { label: string };

  moves: Record<Move, string>;

  home: {
    create: string;
    or: string;
    joinLabel: string;
    joinHint: string;
    joinButton: string;
    busy: string;
    errors: Record<HomeError, string>;
  };

  waiting: {
    title: string;
    codeLabel: string;
    shareHint: string;
    share: string;
    copyLink: string;
    copyCode: string;
    waitingForOpponent: string;
  };

  game: {
    roomLabel: (code: string) => string;
    round: (n: number) => string;
    you: string;
    opponent: string;
    ties: string;
    scoreSummary: (me: number, opponent: number, ties: number) => string;
    movesLabel: string;
    chooseMove: string;
    youChose: (move: string) => string;
    waitingOpponent: string;
    opponentChose: string;
    revealing: string;
    opponentDisconnected: string;
    countdown: [string, string, string];
    results: Record<RoundResult, string>;
    endings: { 'reveal-timeout': Record<'win' | 'loss', string>; 'invalid-reveal': Record<'win' | 'loss', string>; void: string };
    noMove: string;
    roundSummary: (n: number, me: string, opponent: string, result: string) => string;
    history: (count: number) => string;
  };

  reset: {
    request: string;
    waitingAnswer: string;
    cancel: string;
    incomingTitle: string;
    incomingBody: string;
    accept: string;
    decline: string;
  };

  leave: {
    button: string;
    confirmTitle: string;
    confirmBody: string;
    confirm: string;
    stay: string;
  };

  share: {
    title: string;
    text: (code: string) => string;
    linkCopied: string;
    codeCopied: string;
    copyFailed: string;
  };

  notices: Record<Notice, string>;
}
