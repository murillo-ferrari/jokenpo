/**
 * Main application entry point
 */

import { initPlayer } from './core/game-state.js';
import { verifyDOM } from './core/dom-manager.js';
import * as RoomManager from './features/room-manager.js';
import * as GameLogic from './features/game-logic.js';
import * as UIController from './features/ui-controller.js';

// Initialize game
function initGame() {
  try {
    verifyDOM();
    initPlayer();
    
    // Expose functions to global scope
    window.game = {
      createRoom: RoomManager.createRoom,
      joinRoom: RoomManager.joinRoom,
      playMove: GameLogic.playMove,
      requestReset: UIController.requestReset,
      confirmReset: UIController.confirmReset
    };
    
    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Failed to initialize game. Please refresh the page.");
  }
}

document.addEventListener("DOMContentLoaded", initGame);