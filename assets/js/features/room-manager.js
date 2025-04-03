/**
 * Handles room creation, joining, and player management
 */

import { getRoomRef } from '../core/firebase.js';
import { roomId, playerId, isPlayer1 } from '../core/game-state.js';
import { elements } from '../core/dom-manager.js';
import { setupRoomListener } from './ui-controller.js';

/**
 * Create a new game room
 */
export function createRoom() {
  roomId = Math.random().toString(36).slice(2, 6).toUpperCase();
  elements.roomIdInput.value = roomId;
  joinRoom();
}

/**
 * Join an existing room or create if doesn't exist
 */
export function joinRoom() {
  roomId = elements.roomIdInput.value.trim().toUpperCase();
  if (!roomId || roomId.length !== 4) {
    alert("Please enter a valid 4-character room ID");
    return;
  }

  elements.setup.style.display = "none";
  elements.waiting.style.display = "block";

  const roomRef = getRoomRef(roomId);

  roomRef.transaction((currentData) => {
    if (!currentData) {
      isPlayer1 = true;
      return createNewRoomData();
    }
    return joinExistingRoom(currentData);
  }, handleTransactionResult);
}

function createNewRoomData() {
  return {
    player1: {
      id: playerId,
      move: null,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    },
    player2: { id: null, move: null, timestamp: null },
    round: 0,
    scores: { player1: 0, player2: 0 },
    resetRequest: null,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
  };
}

function joinExistingRoom(currentData) {
  if (currentData.player2?.id) {
    throw new Error("Room is full! Please try another room.");
  }
  if (currentData.player1.id === playerId) {
    isPlayer1 = true;
    return;
  }
  currentData.player2 = {
    id: playerId,
    move: null,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
  };
  currentData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;
  return currentData;
}

function handleTransactionResult(error, committed) {
  if (error) {
    handleRoomError(error);
    return;
  }
  if (!committed) {
    handleRoomError(new Error("Failed to join room"));
    return;
  }
  setupRoomListener();
}

function handleRoomError(error) {
  console.error("Room error:", error);
  elements.setup.style.display = "block";
  elements.waiting.style.display = "none";
  alert(error.message || "Error joining room. Please try again.");
}