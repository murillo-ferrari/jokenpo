/**
 * UI Module
 * Handles user interface states and visual updates
 */
const UIModule = (() => {
  // UI State
  let currentState = 'setup'; // setup, waiting, game
  let isRoomCreator = false;

  // UI States
  const UI_STATES = {
    SETUP: 'setup',
    WAITING: 'waiting',
    GAME: 'game'
  };

  /**
   * Initialize UI module
   */
  const initialize = () => {
    console.log('UI module initialized');
    showSetupScreen();
  };

  /**
   * Show setup screen
   */
  const showSetupScreen = () => {
    currentState = UI_STATES.SETUP;
    DOMModule.showElement('setup');
    DOMModule.hideElement('waiting');
    DOMModule.hideElement('game');
    DOMModule.hideElement('shareRoom');
    DOMModule.hideElement('resetConfirm');
  };

  /**
   * Show waiting screen
   */
  const showWaitingScreen = (roomId, isCreator = false) => {
    currentState = UI_STATES.WAITING;
    isRoomCreator = isCreator;
    
    DOMModule.hideElement('setup');
    DOMModule.showElement('waiting');
    DOMModule.hideElement('game');
    DOMModule.hideElement('resetConfirm');
    
    // Show share room section only for room creator
    if (isCreator) {
      DOMModule.showElement('shareRoom');
      DOMModule.setElementText('roomIdDisplay', roomId);
    } else {
      DOMModule.hideElement('shareRoom');
    }
  };

  /**
   * Show game screen
   */
  const showGameScreen = () => {
    currentState = UI_STATES.GAME;
    DOMModule.hideElement('setup');
    DOMModule.hideElement('waiting');
    DOMModule.showElement('game');
    DOMModule.hideElement('shareRoom'); // Hide share room when game starts
    
    // Reset game display
    resetGameDisplay();
  };

  /**
   * Reset game display
   */
  const resetGameDisplay = () => {
    DOMModule.setElementText('playerChoice', '?');
    DOMModule.setElementText('opponentChoice', '?');
    DOMModule.setElementText('result', '');
    enableGameButtons();
  };

  /**
   * Update player choices display
   */
  const updateChoicesDisplay = (playerChoice, opponentChoice) => {
    DOMModule.setElementText('playerChoice', playerChoice || '?');
    DOMModule.setElementText('opponentChoice', opponentChoice || '?');
  };

  /**
   * Update game result display
   */
  const updateResultDisplay = (message) => {
    DOMModule.setElementText('result', message);
  };

  /**
   * Update scores display
   */
  const updateScoresDisplay = (playerScore, opponentScore) => {
    DOMModule.setElementText('playerScore', playerScore.toString());
    DOMModule.setElementText('opponentScore', opponentScore.toString());
  };

  /**
   * Update game statistics
   */
  const updateStatsDisplay = (totalRounds, totalTies) => {
    DOMModule.setElementText('totalRounds', totalRounds.toString());
    DOMModule.setElementText('totalTies', totalTies.toString());
  };

  /**
   * Enable game buttons
   */
  const enableGameButtons = () => {
    const buttons = ['rockBtn', 'paperBtn', 'scissorsBtn'];
    buttons.forEach(buttonName => {
      DOMModule.setButtonDisabled(buttonName, false);
      DOMModule.setButtonStyle(buttonName, {
        opacity: '1',
        cursor: 'pointer'
      });
    });
  };

  /**
   * Disable game buttons
   */
  const disableGameButtons = () => {
    const buttons = ['rockBtn', 'paperBtn', 'scissorsBtn'];
    buttons.forEach(buttonName => {
      DOMModule.setButtonDisabled(buttonName, true);
      DOMModule.setButtonStyle(buttonName, {
        opacity: '0.5',
        cursor: 'not-allowed'
      });
    });
  };

  /**
   * Update button states based on moves
   */
  const updateButtonStates = (playerHasMoved, opponentHasMoved) => {
    if (playerHasMoved) {
      disableGameButtons();
      DOMModule.setElementText('playerChoice', '✓');
    } else {
      enableGameButtons();
      DOMModule.setElementText('playerChoice', '?');
    }
    
    DOMModule.setElementText('opponentChoice', opponentHasMoved ? '✓' : '?');
  };

  /**
   * Show reset confirmation
   */
  const showResetConfirmation = () => {
    DOMModule.showElement('resetConfirm');
  };

  /**
   * Hide reset confirmation
   */
  const hideResetConfirmation = () => {
    DOMModule.hideElement('resetConfirm');
  };

  /**
   * Show error message
   */
  const showError = (message) => {
    alert(message); // For now, using alert. Could be improved with custom modal
  };

  /**
   * Show success message
   */
  const showSuccess = (message) => {
    // Could implement a toast notification system
    console.log('Success:', message);
  };

  /**
   * Update copy button state
   */
  const updateCopyButton = (copied = false) => {
    if (copied) {
      DOMModule.setElementText('copyBtn', 'Copied!');
      setTimeout(() => {
        DOMModule.setElementText('copyBtn', 'Copy Room ID');
      }, 2000);
    } else {
      DOMModule.setElementText('copyBtn', 'Copy Room ID');
    }
  };

  /**
   * Handle room ID input
   */
  const getRoomIdInput = () => {
    return DOMModule.getElementValue('roomIdInput');
  };

  /**
   * Set room ID input
   */
  const setRoomIdInput = (roomId) => {
    DOMModule.setElementValue('roomIdInput', roomId);
  };

  /**
   * Show calculating state
   */
  const showCalculating = () => {
    DOMModule.setElementText('result', 'Calculating...');
  };

  /**
   * Handle game result animation
   */
  const animateGameResult = (result) => {
    // Update choices with emojis
    updateChoicesDisplay(result.playerEmoji, result.opponentEmoji);
    
    // Show result
    updateResultDisplay(result.message);
    
    // Could add more animations here (CSS classes, etc.)
    if (result.type === 'win') {
      // Add win animation/styling
      console.log('Player wins!');
    } else if (result.type === 'lose') {
      // Add lose animation/styling
      console.log('Player loses!');
    } else {
      // Add tie animation/styling
      console.log('It\'s a tie!');
    }
  };

  /**
   * Reset round display after delay
   */
  const scheduleRoundReset = (delay = 3000) => {
    setTimeout(() => {
      // Only reset if we're still in game state and not showing a tie
      if (currentState === UI_STATES.GAME) {
        const currentResult = DOMModule.getElementText('result');
        if (currentResult !== "It's a tie!") {
          DOMModule.setElementText('result', '');
        }
        resetGameDisplay();
      }
    }, delay);
  };

  /**
   * Get current UI state
   */
  const getCurrentState = () => {
    return currentState;
  };

  /**
   * Check if user is room creator
   */
  const getIsRoomCreator = () => {
    return isRoomCreator;
  };

  /**
   * Handle Firebase error display
   */
  const showFirebaseError = (error) => {
    const errorElement = DOMModule.getElement('firebaseError');
    if (errorElement) {
      DOMModule.setElementText('firebaseError', `Firebase Error: ${error.message}`);
      DOMModule.showElement('firebaseError');
    }
  };

  /**
   * Hide Firebase error
   */
  const hideFirebaseError = () => {
    DOMModule.hideElement('firebaseError');
  };

  /**
   * Copy room ID to clipboard
   */
  const copyRoomIdToClipboard = async (roomId) => {
    try {
      await navigator.clipboard.writeText(roomId);
      updateCopyButton(true);
      return true;
    } catch (error) {
      console.error('Failed to copy room ID:', error);
      showError('Failed to copy room ID');
      return false;
    }
  };

  // Public API
  return {
    UI_STATES,
    initialize,
    showSetupScreen,
    showWaitingScreen,
    showGameScreen,
    resetGameDisplay,
    updateChoicesDisplay,
    updateResultDisplay,
    updateScoresDisplay,
    updateStatsDisplay,
    enableGameButtons,
    disableGameButtons,
    updateButtonStates,
    showResetConfirmation,
    hideResetConfirmation,
    showError,
    showSuccess,
    updateCopyButton,
    getRoomIdInput,
    setRoomIdInput,
    showCalculating,
    animateGameResult,
    scheduleRoundReset,
    getCurrentState,
    getIsRoomCreator,
    showFirebaseError,
    hideFirebaseError,
    copyRoomIdToClipboard
  };
})();