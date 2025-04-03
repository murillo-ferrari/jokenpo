/**
 * Main application entry point
 */

import { initPlayer, getPlayerId } from './core/game-state.js';
import { verifyDOM, elements } from './core/dom-manager.js';
import * as RoomManager from './features/room-manager.js';
import * as GameLogic from './features/game-logic.js';
import * as UIController from './features/ui-controller.js';

// Initialize game
function initGame() {
  try {
    verifyDOM();
    initPlayer(); // This will now work with generatePlayerId defined
    
    // Debug log to verify player ID was created
    console.log('Player initialized with ID:', getPlayerId());
    
    // Create game object
    const game = {
      createRoom: RoomManager.createRoom,
      joinRoom: RoomManager.joinRoom,
      playMove: GameLogic.playMove,
      requestReset: UIController.requestReset,
      confirmReset: UIController.confirmReset
    };
    
    // Add event listeners
    if (elements.createRoomBtn) {
      elements.createRoomBtn.addEventListener('click', game.createRoom);
    }
    
    if (elements.joinRoomBtn) {
      elements.joinRoomBtn.addEventListener('click', game.joinRoom);
    }
    
    // Add game control listeners if elements exist
    if (elements.rockBtn) elements.rockBtn.addEventListener('click', () => game.playMove('rock'));
    if (elements.paperBtn) elements.paperBtn.addEventListener('click', () => game.playMove('paper'));
    if (elements.scissorsBtn) elements.scissorsBtn.addEventListener('click', () => game.playMove('scissors'));
    
    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Initialization error:", error);
    alert(`Game initialization failed: ${error.message}`);
    // You might want to add more recovery options here
  }
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame(); // DOM is already ready
}