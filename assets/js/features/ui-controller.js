/**
 * Handles all UI updates and user interactions
 */

import { elements } from "../core/dom-manager.js";
import { calculateResults } from "./game-logic.js";
import * as GameState from "../core/game-state.js";
import { getRoomRef } from "../core/firebase.js";
import firebase from 'firebase/compat/app';

let buttonsDisabled = false;

/**
 * Set disabled state for all game buttons
 * @param {boolean} disabled - Whether buttons should be disabled
 */
export function setButtonsDisabled(disabled) {
  buttonsDisabled = disabled;
  if (elements.rockBtn) elements.rockBtn.disabled = disabled;
  if (elements.paperBtn) elements.paperBtn.disabled = disabled;
  if (elements.scissorsBtn) elements.scissorsBtn.disabled = disabled;
}

/**
 * Update button states based on game progress
 * @param {string|null} myMove - Current player's move
 * @param {string|null} theirMove - Opponent's move
 */
export function updateButtonState(myMove, theirMove) {
  const shouldDisable = !!myMove; // Disable if player has made a move
  setButtonsDisabled(shouldDisable);

  const buttons = [elements.rockBtn, elements.paperBtn, elements.scissorsBtn];
  buttons.forEach((btn) => {
    if (!btn) return;

    if (myMove) {
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    } else {
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  });
}

/**
 * Setup real-time listener for room updates
 */
export function setupRoomListener() {
  const roomRef = getRoomRef(GameState.roomId);

  roomRef.on("value", (snapshot) => {
    const room = snapshot.val();
    if (!room) return;

    if (!room.player1?.id || !room.player2?.id) return;

    // Update game UI
    updateGameUI(room);

    // Handle moves and results
    handleGameProgress(room);
  });
}

function updateGameUI(room) {
  elements.waiting.style.display = "none";
  elements.game.style.display = "block";

  // Update scores
  const myScore = GameState.isPlayer1 ? room.scores.player1 : room.scores.player2;
  const theirScore = GameState.isPlayer1 ? room.scores.player2 : room.scores.player1;
  elements.playerScore.textContent = myScore;
  elements.opponentScore.textContent = theirScore;

  // Handle reset requests
  if (room.resetRequest) {
    elements.resetConfirm.style.display =
      room.resetRequest.playerId !== GameState.playerId ? "block" : "none";
  } else {
    elements.resetConfirm.style.display = "none";
  }
}

function handleGameProgress(room) {
  const myMove = GameState.isPlayer1 ? room.player1.move : room.player2.move;
  const theirMove = GameState.isPlayer1 ? room.player2.move : room.player1.move;

  updateButtonState(myMove, theirMove);

  if (room.player1.move && room.player2.move) {
    if (room.round > GameState.currentRound) {
      GameState.currentRound = room.round;
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
 * Reset the local game state
 */
function resetGameState() {
  GameState.playerScore = 0;
  GameState.opponentScore = 0;
  GameState.currentRound = 0;
  elements.playerScore.textContent = "0";
  elements.opponentScore.textContent = "0";
  elements.playerChoice.textContent = "?";
  elements.opponentChoice.textContent = "?";
  elements.result.textContent = "";
  setButtonsDisabled(false);
}

/**
 * Request a game reset
 */
export function requestReset() {
  const roomRef = getRoomRef(GameState.roomId);
  roomRef.update({
    resetRequest: {
      playerId: GameState.playerId,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    },
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
  });
}

/**
 * Handle reset confirmation
 * @param {boolean} accept - Whether to accept the reset
 */
export function confirmReset(accept) {
  const roomRef = getRoomRef(GameState.roomId);

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