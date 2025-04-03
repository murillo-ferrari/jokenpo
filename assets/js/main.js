/**
 * Main application entry point
 */

import { initPlayer } from './core/game-state.js';
import { verifyDOM, elements } from './core/dom-manager.js'; // Import elements
import * as RoomManager from './features/room-manager.js';
import * as GameLogic from './features/game-logic.js';
import * as UIController from './features/ui-controller.js';

// Initialize game
function initGame() {
  try {
    verifyDOM();
    initPlayer();
    
    // Create game object
    const game = {
      createRoom: RoomManager.createRoom,
      joinRoom: RoomManager.joinRoom,
      playMove: GameLogic.playMove,
      requestReset: UIController.requestReset,
      confirmReset: UIController.confirmReset
    };
    
    // Make available globally (optional)
    window.game = game;
    
    // Add event listeners for room management
    if (elements.createRoomBtn) {
      elements.createRoomBtn.addEventListener('click', game.createRoom);
    }
    
    if (elements.joinRoomBtn) {
      elements.joinRoomBtn.addEventListener('click', game.joinRoom);
    }
    
    // Add event listener for rock button if it exists
    if (elements.rockBtn) {
      elements.rockBtn.addEventListener('click', () => game.playMove('rock'));
    }
    
    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Failed to initialize game. Please refresh the page.");
  }
}

document.addEventListener("DOMContentLoaded", initGame);