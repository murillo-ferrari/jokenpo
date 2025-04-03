/**
 * Handles all UI updates and user interactions
 */

import { elements } from "../core/dom-manager.js";
import { calculateResults } from "./game-logic.js";
import { roomId, isPlayer1, currentRound } from "../core/game-state.js";
import { getRoomRef } from "../core/firebase.js";

let buttonsDisabled = false;

/**
 * Set disabled state for all game buttons
 * @param {boolean} disabled - Whether buttons should be disabled
 */
export function setButtonsDisabled(disabled) {
  buttonsDisabled = disabled;
  if (elements.rockBtn) {
      elements.rockBtn.disabled = disabled;
      console.log(`Rock button disabled: ${disabled}`); // Debug log
  }
  if (elements.paperBtn) {
      elements.paperBtn.disabled = disabled;
      console.log(`Paper button disabled: ${disabled}`); // Debug log
  }
  if (elements.scissorsBtn) {
      elements.scissorsBtn.disabled = disabled;
      console.log(`Scissors button disabled: ${disabled}`); // Debug log
  }
}

/**
 * Update button states based on game progress
 * @param {string|null} myMove - Current player's move
 * @param {string|null} theirMove - Opponent's move
 */
export function updateButtonState(myMove, theirMove) {
  const shouldDisable = !!myMove; // Only disable if player has made a move
  setButtonsDisabled(shouldDisable);

  const buttons = [elements.rockBtn, elements.paperBtn, elements.scissorsBtn];
  buttons.forEach((btn) => {
      if (!btn) return;
      
      btn.style.opacity = shouldDisable ? "0.5" : "1";
      btn.style.cursor = shouldDisable ? "not-allowed" : "pointer";
  });
}

/**
 * Setup real-time listener for room updates
 */
export function setupRoomListener() {
  const roomRef = getRoomRef(roomId);

  roomRef.on("value", (snapshot) => {
    try {
      const room = snapshot.val();
      if (!room) {
        elements.waiting.style.display = "none";
        elements.game.style.display = "none";
        elements.setup.style.display = "block";
        alert("Room no longer exists");
        return;
      }

      if (!room.player1?.id || !room.player2?.id) {
        elements.waiting.style.display = "block";
        elements.game.style.display = "none";
        return;
      }

      // Update game UI
      updateGameUI(room);

      // Handle moves and results
      handleGameProgress(room);
    } catch (error) {
      console.error("Room listener error:", error);
    }
  });
}

function updateGameUI(room) {
  elements.waiting.style.display = "none";
  elements.game.style.display = "block";

  // Update scores
  const myScore = isPlayer1 ? room.scores.player1 : room.scores.player2;
  const theirScore = isPlayer1 ? room.scores.player2 : room.scores.player1;
  elements.playerScore.textContent = myScore;
  elements.opponentScore.textContent = theirScore;

  // Handle reset requests
  if (room.resetRequest) {
    elements.resetConfirm.style.display =
      room.resetRequest.playerId !== playerId ? "block" : "none";
  } else {
    elements.resetConfirm.style.display = "none";
  }
}

function handleGameProgress(room) {
  const myMove = isPlayer1 ? room.player1.move : room.player2.move;
  const theirMove = isPlayer1 ? room.player2.move : room.player1.move;

  updateButtonState(myMove, theirMove);

  if (room.player1.move && room.player2.move) {
    if (room.round > currentRound) {
      currentRound = room.round;
      calculateResults(room.player1.move, room.player2.move);
    } else {
      elements.result.textContent = "Calculating...";
    }
  } else {
    elements.playerChoice.textContent = myMove ? "✓" : "?";
    elements.opponentChoice.textContent = theirMove ? "✓" : "?";
  }
}

/**
 * Handle reset confirmation
 * @param {boolean} accept - Whether to accept the reset
 */
export function confirmReset(accept) {
  const roomRef = getRoomRef(roomId);

  if (accept) {
    resetGameState();
    roomRef.update({
      scores: { player1: 0, player2: 0 },
      resetRequest: null,
      "player1/move": null,
      "player2/move": null,
      round: 0,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });
  } else {
    roomRef.update({
      resetRequest: null,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });
  }
  elements.resetConfirm.style.display = "none";
}

/**
 * Request a game reset
 */
export function requestReset() {
  const roomRef = getRoomRef(roomId);
  roomRef.update({
    resetRequest: {
      playerId: playerId,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    },
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
  });
}
