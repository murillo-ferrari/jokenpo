/**
 * Game Module
 * Handles game logic, rules, and scoring
 */
const GameModule = (() => {
  // Game state
  let currentRound = 0;
  let playerScore = 0;
  let opponentScore = 0;
  let totalTies = 0;
  let buttonsDisabled = false;

  // Game callbacks
  const callbacks = {
    onScoreUpdate: null,
    onGameResult: null,
    onRoundComplete: null,
    onStatsUpdate: null
  };

  /**
   * Initialize game module
   */
  const initialize = () => {
    resetGame();
    console.log('Game module initialized');
  };

  /**
   * Reset game state
   */
  const resetGame = () => {
    currentRound = 0;
    playerScore = 0;
    opponentScore = 0;
    totalTies = 0;
    buttonsDisabled = false;
    
    if (callbacks.onScoreUpdate) {
      callbacks.onScoreUpdate(playerScore, opponentScore);
    }
    
    if (callbacks.onStatsUpdate) {
      callbacks.onStatsUpdate(currentRound, totalTies);
    }
  };

  /**
   * Update game state from room data
   */
  const updateFromRoomData = (roomData, isPlayer1) => {
    // Update scores based on player position
    playerScore = isPlayer1 ? roomData.scores.player1 : roomData.scores.player2;
    opponentScore = isPlayer1 ? roomData.scores.player2 : roomData.scores.player1;
    currentRound = roomData.round;
    
    // Calculate ties
    totalTies = currentRound - (playerScore + opponentScore);
    if (totalTies < 0) totalTies = 0;

    // Notify callbacks
    if (callbacks.onScoreUpdate) {
      callbacks.onScoreUpdate(playerScore, opponentScore);
    }
    
    if (callbacks.onStatsUpdate) {
      callbacks.onStatsUpdate(currentRound, totalTies);
    }
  };

  /**
   * Calculate game result
   */
  const calculateResult = (player1Move, player2Move, isPlayer1) => {
    const myMove = isPlayer1 ? player1Move : player2Move;
    const opponentMove = isPlayer1 ? player2Move : player1Move;
    
    // Check for tie
    if (player1Move === player2Move) {
      const result = {
        type: 'tie',
        message: "It's a tie!",
        playerMove: myMove,
        opponentMove: opponentMove,
        playerEmoji: Config.GAME_CONSTANTS.EMOJIS[myMove],
        opponentEmoji: Config.GAME_CONSTANTS.EMOJIS[opponentMove]
      };
      
      if (callbacks.onGameResult) {
        callbacks.onGameResult(result);
      }
      
      return result;
    }

    // Determine winner
    const winConditions = Config.GAME_CONSTANTS.WIN_CONDITIONS;
    let playerWins = false;
    
    if (isPlayer1) {
      playerWins = winConditions[player1Move] === player2Move;
    } else {
      playerWins = winConditions[player2Move] === player1Move;
    }

    // Update scores
    if (playerWins) {
      playerScore++;
    } else {
      opponentScore++;
    }

    const result = {
      type: playerWins ? 'win' : 'lose',
      message: playerWins ? 'You win! 🎉' : 'Opponent wins!',
      playerMove: myMove,
      opponentMove: opponentMove,
      playerEmoji: Config.GAME_CONSTANTS.EMOJIS[myMove],
      opponentEmoji: Config.GAME_CONSTANTS.EMOJIS[opponentMove],
      playerScore: playerScore,
      opponentScore: opponentScore
    };

    // Notify callbacks
    if (callbacks.onGameResult) {
      callbacks.onGameResult(result);
    }
    
    if (callbacks.onScoreUpdate) {
      callbacks.onScoreUpdate(playerScore, opponentScore);
    }

    return result;
  };

  /**
   * Check if move is valid
   */
  const isValidMove = (move) => {
    const validMoves = Object.values(Config.GAME_CONSTANTS.MOVES);
    return validMoves.includes(move);
  };

  /**
   * Get move emoji
   */
  const getMoveEmoji = (move) => {
    return Config.GAME_CONSTANTS.EMOJIS[move] || '?';
  };

  /**
   * Set buttons disabled state
   */
  const setButtonsDisabled = (disabled) => {
    buttonsDisabled = disabled;
  };

  /**
   * Check if buttons are disabled
   */
  const areButtonsDisabled = () => {
    return buttonsDisabled;
  };

  /**
   * Process round completion
   */
  const processRoundCompletion = (player1Move, player2Move, isPlayer1) => {
    const result = calculateResult(player1Move, player2Move, isPlayer1);
    
    if (callbacks.onRoundComplete) {
      callbacks.onRoundComplete(result);
    }
    
    return result;
  };

  /**
   * Get current game state
   */
  const getGameState = () => {
    return {
      currentRound,
      playerScore,
      opponentScore,
      totalTies,
      buttonsDisabled
    };
  };

  /**
   * Set game callbacks
   */
  const setCallbacks = (newCallbacks) => {
    Object.assign(callbacks, newCallbacks);
  };

  /**
   * Update round number
   */
  const updateRound = (round) => {
    currentRound = round;
    totalTies = currentRound - (playerScore + opponentScore);
    if (totalTies < 0) totalTies = 0;
    
    if (callbacks.onStatsUpdate) {
      callbacks.onStatsUpdate(currentRound, totalTies);
    }
  };

  /**
   * Force score update (for external updates)
   */
  const forceScoreUpdate = (newPlayerScore, newOpponentScore) => {
    playerScore = newPlayerScore;
    opponentScore = newOpponentScore;
    totalTies = currentRound - (playerScore + opponentScore);
    if (totalTies < 0) totalTies = 0;
    
    if (callbacks.onScoreUpdate) {
      callbacks.onScoreUpdate(playerScore, opponentScore);
    }
    
    if (callbacks.onStatsUpdate) {
      callbacks.onStatsUpdate(currentRound, totalTies);
    }
  };

  /**
   * Get scores for database update
   */
  const getScoresForUpdate = (isPlayer1) => {
    return {
      player1: isPlayer1 ? playerScore : opponentScore,
      player2: isPlayer1 ? opponentScore : playerScore
    };
  };

  // Public API
  return {
    initialize,
    resetGame,
    updateFromRoomData,
    calculateResult,
    isValidMove,
    getMoveEmoji,
    setButtonsDisabled,
    areButtonsDisabled,
    processRoundCompletion,
    getGameState,
    setCallbacks,
    updateRound,
    forceScoreUpdate,
    getScoresForUpdate
  };
})();