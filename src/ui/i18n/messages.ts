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

  format: {
    label: string;
    options: Record<0 | 3 | 5 | 7, string>;
    /** Linha do placar, ex.: "Melhor de 5 · vence quem fizer 3". */
    summary: (bestOf: number, wins: number) => string;
  };

  home: {
    nicknameLabel: string;
    nicknameHint: string;
    playComputer: string;
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
    vsComputerLabel: string;
    computer: string;
    online: string;
    offline: string;
    matchWon: string;
    matchLost: (opponent: string) => string;
    matchOver: string;
    finalScore: (me: number, opponent: number) => string;
    rematch: string;
    rematchWaiting: string;
    rematchOffered: string;
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
