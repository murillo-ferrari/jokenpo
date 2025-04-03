/**
 * Main application entry point
 * Initializes the game and connects all modules
 */

import { initPlayer } from "./core/game-state.js";
import { verifyDOM } from "./core/dom-manager.js";
import { createRoom, joinRoom } from "./features/room-manager.js";
import { playMove } from "./features/game-logic.js";
import { confirmReset, requestReset } from "./features/ui-controller.js";

// Expose functions to global scope for HTML access
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.playMove = playMove;
window.requestReset = requestReset;
window.confirmReset = confirmReset;

// Initialize game
function initGame() {
  try {
    verifyDOM();
    initPlayer();
    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Failed to initialize game. Please refresh the page.");
  }
}

// Start the game when DOM is loaded
document.addEventListener("DOMContentLoaded", initGame);