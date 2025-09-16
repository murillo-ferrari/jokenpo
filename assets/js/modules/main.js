/**
 * Main Application Module
 * Coordinates all other modules and handles application flow
 */
const JokenpoApp = (() => {
  // Application state
  let isInitialized = false;
  let currentRoomInfo = null;

  /**
   * Initialize the application
   */
  const initialize = async () => {
    try {
      console.log('Initializing Jokenpo App...');
      
      // Initialize Firebase
      Config.initializeFirebase();
      
      // Initialize DOM elements
      if (!DOMModule.initializeElements()) {
        throw new Error('Failed to initialize DOM elements');
      }
      
      // Initialize modules
      RoomModule.initialize();
      GameModule.initialize();
      UIModule.initialize();
      
      // Setup module callbacks
      setupCallbacks();
      
      // Setup event listeners
      setupEventListeners();
      
      isInitialized = true;
      console.log('Jokenpo App initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      UIModule.showFirebaseError(error);
      throw error;
    }
  };

  /**
   * Setup callbacks between modules
   */
  const setupCallbacks = () => {
    // Room module callbacks
    RoomModule.setCallbacks({
      onRoomJoined: handleRoomJoined,
      onRoomFull: handleRoomFull,
      onRoomError: handleRoomError,
      onRoomUpdate: handleRoomUpdate,
      onPlayerDisconnected: handlePlayerDisconnected
    });

    // Game module callbacks
    GameModule.setCallbacks({
      onScoreUpdate: handleScoreUpdate,
      onGameResult: handleGameResult,
      onRoundComplete: handleRoundComplete,
      onStatsUpdate: handleStatsUpdate
    });
  };

  /**
   * Setup DOM event listeners
   */
  const setupEventListeners = () => {
    // Game move buttons
    DOMModule.addEventListener('rockBtn', 'click', () => handleMoveClick('rock'));
    DOMModule.addEventListener('paperBtn', 'click', () => handleMoveClick('paper'));
    DOMModule.addEventListener('scissorsBtn', 'click', () => handleMoveClick('scissors'));
    
    // Copy room ID button
    DOMModule.addEventListener('copyBtn', 'click', handleCopyRoomId);
  };

  /**
   * Handle room joined
   */
  const handleRoomJoined = (roomInfo) => {
    currentRoomInfo = roomInfo;
    UIModule.showWaitingScreen(roomInfo.roomId, roomInfo.isCreator);
  };

  /**
   * Handle room full (game can start)
   */
  const handleRoomFull = () => {
    UIModule.showGameScreen();
  };

  /**
   * Handle room error
   */
  const handleRoomError = (error) => {
    console.error('Room error:', error);
    UIModule.showError(error.message);
    UIModule.showSetupScreen();
  };

  /**
   * Handle room updates from Firebase
   */
  const handleRoomUpdate = (updateData) => {
    const { room, isPlayer1, playerId } = updateData;
    
    // Update game state from room data
    GameModule.updateFromRoomData(room, isPlayer1);
    
    // Handle reset requests
    if (room.resetRequest) {
      if (room.resetRequest.playerId !== playerId) {
        UIModule.showResetConfirmation();
      } else {
        UIModule.hideResetConfirmation();
      }
    } else {
      UIModule.hideResetConfirmation();
    }

    // Get current player moves
    const myMove = isPlayer1 ? room.player1.move : room.player2.move;
    const theirMove = isPlayer1 ? room.player2.move : room.player1.move;

    // Update UI based on game state
    if (room.player1.move && room.player2.move) {
      // Both players have moved
      const gameState = GameModule.getGameState();
      if (room.round > gameState.currentRound) {
        // Process the round result
        const result = GameModule.processRoundCompletion(
          room.player1.move, 
          room.player2.move, 
          isPlayer1
        );
        
        // Update scores in Firebase
        const scores = GameModule.getScoresForUpdate(isPlayer1);
        RoomModule.updateScores(scores.player1, scores.player2);
        
        // Schedule round reset
        setTimeout(() => {
          RoomModule.resetRoundMoves();
          UIModule.scheduleRoundReset(0); // Reset immediately after moves are cleared
        }, Config.GAME_CONSTANTS.RESULT_DISPLAY_TIME);
        
      } else {
        UIModule.showCalculating();
      }
    } else {
      // Update button states and choice indicators
      UIModule.updateButtonStates(!!myMove, !!theirMove);
      
      // Clear result if not showing a tie
      const currentResult = DOMModule.getElementText('result');
      if (currentResult !== "It's a tie!") {
        UIModule.updateResultDisplay('');
      }
    }

    // Update game buttons state
    GameModule.setButtonsDisabled(!!myMove);
  };

  /**
   * Handle player disconnected
   */
  const handlePlayerDisconnected = () => {
    UIModule.showError('Opponent disconnected');
    UIModule.showSetupScreen();
  };

  /**
   * Handle score updates
   */
  const handleScoreUpdate = (playerScore, opponentScore) => {
    UIModule.updateScoresDisplay(playerScore, opponentScore);
  };

  /**
   * Handle game result
   */
  const handleGameResult = (result) => {
    UIModule.animateGameResult(result);
  };

  /**
   * Handle round completion
   */
  const handleRoundComplete = (result) => {
    console.log('Round completed:', result);
    // Additional round completion logic can go here
  };

  /**
   * Handle stats update
   */
  const handleStatsUpdate = (totalRounds, totalTies) => {
    UIModule.updateStatsDisplay(totalRounds, totalTies);
  };

  /**
   * Handle move button clicks
   */
  const handleMoveClick = async (move) => {
    if (GameModule.areButtonsDisabled()) {
      console.log('Buttons are disabled - ignoring move');
      return;
    }

    if (!GameModule.isValidMove(move)) {
      UIModule.showError('Invalid move');
      return;
    }

    try {
      console.log(`Playing move: ${move}`);
      
      // Disable buttons immediately
      GameModule.setButtonsDisabled(true);
      UIModule.disableGameButtons();
      UIModule.updateChoicesDisplay('✓', DOMModule.getElementText('opponentChoice'));
      
      // Submit move to room
      await RoomModule.submitMove(move);
      
    } catch (error) {
      console.error('Move error:', error);
      UIModule.showError('Error submitting move. Please try again.');
      
      // Re-enable buttons on error
      GameModule.setButtonsDisabled(false);
      UIModule.enableGameButtons();
    }
  };

  /**
   * Handle copy room ID
   */
  const handleCopyRoomId = async () => {
    if (currentRoomInfo && currentRoomInfo.roomId) {
      await UIModule.copyRoomIdToClipboard(currentRoomInfo.roomId);
    }
  };

  /**
   * Create a new room
   */
  const createRoom = async () => {
    try {
      const result = await RoomModule.createRoom();
      
      if (result.success) {
        // Set room ID in input and join the room
        UIModule.setRoomIdInput(result.roomId);
        await joinRoom();
      } else {
        UIModule.showError(result.error);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      UIModule.showError('Failed to create room');
    }
  };

  /**
   * Join a room
   */
  const joinRoom = async () => {
    try {
      const roomId = UIModule.getRoomIdInput();
      const result = await RoomModule.joinRoom(roomId);
      
      if (!result.success) {
        UIModule.showError(result.error);
      }
      // Success is handled by the room callbacks
    } catch (error) {
      console.error('Error joining room:', error);
      UIModule.showError('Failed to join room');
    }
  };

  /**
   * Request game reset
   */
  const requestReset = async () => {
    try {
      await RoomModule.requestReset();
    } catch (error) {
      console.error('Error requesting reset:', error);
      UIModule.showError('Failed to request reset');
    }
  };

  /**
   * Confirm or deny reset request
   */
  const confirmReset = async (accept) => {
    try {
      await RoomModule.confirmReset(accept);
      
      if (accept) {
        // Reset local game state
        GameModule.resetGame();
        UIModule.resetGameDisplay();
      }
      
      UIModule.hideResetConfirmation();
    } catch (error) {
      console.error('Error confirming reset:', error);
      UIModule.showError('Failed to process reset');
    }
  };

  /**
   * Leave current room
   */
  const leaveRoom = () => {
    RoomModule.leaveRoom();
    GameModule.resetGame();
    UIModule.showSetupScreen();
    currentRoomInfo = null;
  };

  /**
   * Get application status
   */
  const getStatus = () => {
    return {
      isInitialized,
      currentRoom: currentRoomInfo,
      gameState: GameModule.getGameState(),
      uiState: UIModule.getCurrentState()
    };
  };

  // Expose functions to global scope for HTML onclick handlers
  const exposeGlobalFunctions = () => {
    window.createRoom = createRoom;
    window.joinRoom = joinRoom;
    window.requestReset = requestReset;
    window.confirmReset = confirmReset;
    window.copyRoomId = handleCopyRoomId;
  };

  // Public API
  return {
    initialize,
    createRoom,
    joinRoom,
    requestReset,
    confirmReset,
    leaveRoom,
    getStatus,
    exposeGlobalFunctions
  };
})();

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await JokenpoApp.initialize();
    JokenpoApp.exposeGlobalFunctions();
  } catch (error) {
    console.error('Failed to start application:', error);
    alert('Failed to initialize the game. Please refresh the page.');
  }
});