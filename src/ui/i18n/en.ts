import type { Messages } from './messages';

export const en: Messages = {
  appTitle: 'Jokenpo Online',
  tagline: 'Rock, paper, scissors with a friend, in real time.',
  loading: 'Loading…',
  configError: "The game couldn't start. Try reloading the page.",
  language: { label: 'Language' },
  sound: { label: 'Game sounds' },

  moves: { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' },

  format: {
    label: 'Match format',
    options: { 0: 'Endless', 3: 'Best of 3', 5: 'Best of 5', 7: 'Best of 7' },
    summary: (bestOf, wins) => `Best of ${bestOf} · first to ${wins}`,
  },

  choice: {
    label: 'Time to pick',
    hint: 'Starts once your opponent picks. Not used against the computer.',
    option: (seconds) => `${seconds}s`,
    summary: (seconds) => `${seconds}s to pick`,
  },

  home: {
    nicknameLabel: 'Your nickname (optional)',
    nicknameHint: 'Shown to your opponent on the scoreboard.',
    playComputer: 'Play against the computer',
    create: 'Create room',
    or: 'or',
    joinLabel: 'Room code',
    joinHint: '4 letters or numbers, e.g. AB23',
    joinButton: 'Join',
    busy: 'Connecting…',
    errors: {
      empty: 'Enter the room code.',
      length: 'The code has 4 characters.',
      characters: 'Use only letters and numbers (codes never contain 0, O, 1, I or L).',
      'not-found': 'Room not found. Check the code.',
      full: 'That room already has two players.',
      unexpected: 'Something went wrong. Please try again.',
    },
  },

  waiting: {
    title: 'Room created',
    codeLabel: 'Room code',
    shareHint: 'Send the link or the code to whoever is playing with you.',
    share: 'Share invite',
    copyLink: 'Copy link',
    copyCode: 'Copy code',
    waitingForOpponent: 'Waiting for your opponent to join…',
  },

  game: {
    roomLabel: (code) => `Room ${code}`,
    vsComputerLabel: 'Against the computer',
    computer: 'Computer',
    online: 'online',
    offline: 'offline',
    matchWon: '🏆 You won the match!',
    matchLost: (name) => `${name} won the match.`,
    finalScore: (me, opponent) => `Final score: ${me} × ${opponent}`,
    matchOver: 'Match over',
    rematch: 'Rematch',
    rematchWaiting: 'Rematch requested. Waiting for your opponent…',
    rematchOffered: 'Your opponent wants a rematch!',
    round: (n) => `Round ${n}`,
    you: 'You',
    opponent: 'Opponent',
    ties: 'Ties',
    scoreSummary: (me, opponent, ties) => `Score: you ${me}, opponent ${opponent}, ${ties} ties.`,
    movesLabel: 'Your move',
    nextRound: 'Pick your move for the next round.',
    noRoundsYet: 'No rounds yet.',
    chooseMove: 'Pick your move.',
    youChose: (move) => `You picked ${move}.`,
    waitingOpponent: 'Waiting for your opponent to pick…',
    opponentChose: 'Your opponent has picked. Your turn!',
    revealing: 'Revealing moves…',
    opponentDisconnected: 'Your opponent lost connection. Waiting for them to come back…',
    countdown: ['Rock…', 'Paper…', 'Scissors!'],
    results: { win: 'You win!', loss: 'You lose.', tie: "It's a tie." },
    endings: {
      'reveal-timeout': {
        win: "Your opponent didn't reveal their move in time.",
        loss: "Your move wasn't revealed in time.",
      },
      'choice-timeout': {
        win: "Your opponent didn't pick a move in time.",
        loss: "You didn't pick a move in time.",
      },
      'invalid-reveal': {
        win: "Your opponent's revealed move didn't match their pick.",
        loss: "Your revealed move didn't match your pick.",
      },
      void: 'Round voided.',
    },
    endingTags: { 'reveal-timeout': 'by forfeit', 'choice-timeout': 'by forfeit', 'invalid-reveal': 'invalid move', void: 'voided' },
    secondsLeft: (seconds) => `${seconds}s`,
    choiceDeadlineNotice: (seconds) => `You have ${seconds} seconds to pick.`,
    noMove: 'no reveal',
    roundSummary: (n, me, opponent, result) => `Round ${n}: you ${me}, opponent ${opponent}. ${result}`,
    history: (count) => `Previous rounds (${count})`,
  },

  reset: {
    request: 'Restart match',
    waitingAnswer: 'Restart request sent. Waiting for your opponent to answer…',
    cancel: 'Cancel request',
    incomingTitle: 'Restart the match?',
    incomingBody: 'Your opponent wants to reset the score and start over.',
    accept: 'Restart',
    decline: 'Keep playing',
  },

  leave: {
    button: 'Leave room',
    confirmTitle: 'Leave the room?',
    confirmBody: 'The match ends for you, and your opponent goes back to waiting for someone else.',
    confirm: 'Leave',
    stay: 'Stay',
  },

  share: {
    title: 'Jokenpo Online',
    text: (code) => `Up for rock, paper, scissors? Room ${code}:`,
    linkCopied: 'Link copied.',
    codeCopied: 'Code copied.',
    copyFailed: "Couldn't copy. Select the code and copy it manually.",
  },

  notices: {
    'opponent-joined': 'Your opponent joined. Good luck!',
    'opponent-left': 'Your opponent left the room.',
    'room-closed': 'The room was closed.',
    'removed-from-room': 'You were disconnected for too long and left the room.',
    'reset-accepted': 'Match restarted. Score reset.',
    'reset-declined': 'Your opponent chose to keep playing.',
    'action-failed': "That didn't work. Check your connection and try again.",
    'connection-lost': 'Lost connection to the room.',
  },
};
