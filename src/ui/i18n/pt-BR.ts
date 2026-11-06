import type { Messages } from './messages';

export const ptBR: Messages = {
  appTitle: 'Jokenpô Online',
  tagline: 'Pedra, papel e tesoura com um amigo, em tempo real.',
  loading: 'Carregando…',
  configError: 'Não foi possível iniciar o jogo. Tente recarregar a página.',
  language: { label: 'Idioma' },

  moves: { rock: 'Pedra', paper: 'Papel', scissors: 'Tesoura' },

  home: {
    create: 'Criar sala',
    or: 'ou',
    joinLabel: 'Código da sala',
    joinHint: '4 letras ou números, por exemplo AB23',
    joinButton: 'Entrar',
    busy: 'Conectando…',
    errors: {
      empty: 'Digite o código da sala.',
      length: 'O código tem 4 caracteres.',
      characters: 'Use só letras e números (o código não tem 0, O, 1, I nem L).',
      'not-found': 'Sala não encontrada. Confira o código.',
      full: 'Essa sala já tem dois jogadores.',
      unexpected: 'Algo deu errado. Tente de novo.',
    },
  },

  waiting: {
    title: 'Sala criada',
    codeLabel: 'Código da sala',
    shareHint: 'Mande o link ou o código para quem vai jogar com você.',
    share: 'Compartilhar convite',
    copyLink: 'Copiar link',
    copyCode: 'Copiar código',
    waitingForOpponent: 'Esperando o adversário entrar…',
  },

  game: {
    roomLabel: (code) => `Sala ${code}`,
    round: (n) => `Rodada ${n}`,
    you: 'Você',
    opponent: 'Adversário',
    ties: 'Empates',
    scoreSummary: (me, opponent, ties) => `Placar: você ${me}, adversário ${opponent}, ${ties} empates.`,
    movesLabel: 'Sua jogada',
    chooseMove: 'Escolha sua jogada.',
    youChose: (move) => `Você escolheu ${move}.`,
    waitingOpponent: 'Esperando o adversário escolher…',
    opponentChose: 'O adversário já escolheu. Sua vez!',
    revealing: 'Revelando as jogadas…',
    opponentDisconnected: 'O adversário perdeu a conexão. Esperando ele voltar…',
    countdown: ['Jo…', 'Ken…', 'Pô!'],
    results: { win: 'Você venceu!', loss: 'Você perdeu.', tie: 'Empate.' },
    endings: {
      'reveal-timeout': {
        win: 'O adversário não revelou a jogada a tempo.',
        loss: 'Sua jogada não foi revelada a tempo.',
      },
      'invalid-reveal': {
        win: 'A jogada revelada pelo adversário não conferia com a escolhida.',
        loss: 'Sua jogada revelada não conferia com a escolhida.',
      },
      void: 'Rodada anulada.',
    },
    noMove: 'não revelou',
    roundSummary: (n, me, opponent, result) => `Rodada ${n}: você ${me}, adversário ${opponent}. ${result}`,
    history: (count) => `Rodadas anteriores (${count})`,
  },

  reset: {
    request: 'Recomeçar partida',
    waitingAnswer: 'Pedido de recomeçar enviado. Esperando o adversário responder…',
    cancel: 'Cancelar pedido',
    incomingTitle: 'Recomeçar a partida?',
    incomingBody: 'O adversário quer zerar o placar e começar de novo.',
    accept: 'Recomeçar',
    decline: 'Continuar como está',
  },

  leave: {
    button: 'Sair da sala',
    confirmTitle: 'Sair da sala?',
    confirmBody: 'A partida termina para você, e o adversário volta a esperar outra pessoa.',
    confirm: 'Sair',
    stay: 'Ficar',
  },

  share: {
    title: 'Jokenpô Online',
    text: (code) => `Bora jogar jokenpô? Sala ${code}:`,
    linkCopied: 'Link copiado.',
    codeCopied: 'Código copiado.',
    copyFailed: 'Não deu para copiar. Selecione o código e copie manualmente.',
  },

  notices: {
    'opponent-joined': 'O adversário entrou. Boa partida!',
    'opponent-left': 'O adversário saiu da sala.',
    'room-closed': 'A sala foi encerrada.',
    'removed-from-room': 'Você ficou tempo demais desconectado e saiu da sala.',
    'reset-accepted': 'Partida recomeçada. Placar zerado.',
    'reset-declined': 'O adversário preferiu continuar a partida.',
    'action-failed': 'Não deu certo. Verifique a conexão e tente de novo.',
    'connection-lost': 'A conexão com a sala caiu.',
  },
};
