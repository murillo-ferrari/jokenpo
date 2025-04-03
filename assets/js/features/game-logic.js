/**
 * Contains all game rules and calculation logic
 */

import {
  roomId,
  playerId,
  isPlayer1,
  currentRound,
  playerScore,
  opponentScore,
} from "../core/game-state.js";
import { elements } from "../core/dom-manager.js";
import { getRoomRef } from "../core/firebase.js";
import { setButtonsDisabled } from "./ui-controller.js";

const emojis = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

const winConditions = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

/**
 * Make a move in the current game
 * @param {string} move - The player's move (rock/paper/scissors)
 */
export function playMove(move) {
  const roomRef = getRoomRef(roomId);

  roomRef
    .once("value")
    .then((snapshot) => {
      const room = snapshot.val();
      if (!room) return;

      const updates = {};
      const playerPath = room.player1.id === playerId ? "player1" : "player2";
      updates[`${playerPath}/move`] = move;
      updates[`${playerPath}/timestamp`] =
        firebase.database.ServerValue.TIMESTAMP;
      updates["lastUpdated"] = firebase.database.ServerValue.TIMESTAMP;

      return roomRef.update(updates);
    })
    .then(() => {
      elements.playerChoice.textContent = "✓";
      setButtonsDisabled(true);
      checkRoundCompletion();
    })
    .catch(console.error);
}

function checkRoundCompletion() {
  const roomRef = getRoomRef(roomId);

  roomRef.once("value").then((snapshot) => {
    const room = snapshot.val();
    if (room.player1.move && room.player2.move && room.round === currentRound) {
      roomRef.update({
        round: currentRound + 1,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      });
    }
  });
}

/**
 * Calculate and display round results
 * @param {string} p1Move - Player 1's move
 * @param {string} p2Move - Player 2's move
 */
export function calculateResults(p1Move, p2Move) {
  elements.playerChoice.textContent = emojis[isPlayer1 ? p1Move : p2Move];
  elements.opponentChoice.textContent = emojis[isPlayer1 ? p2Move : p1Move];

  const result = determineWinner(p1Move, p2Move);
  updateScores(result);
  displayResults(result);
  prepareNextRound();
}

function determineWinner(p1Move, p2Move) {
  if (p1Move === p2Move) return { message: "It's a tie!", winner: null };

  if (winConditions[p1Move] === p2Move) {
    return {
      message: isPlayer1 ? "You win! 🎉" : "Opponent wins!",
      winner: "player1",
    };
  }

  return {
    message: isPlayer1 ? "Opponent wins!" : "You win! 🎉",
    winner: "player2",
  };
}

function updateScores(result) {
  if (result.winner === "player1") {
    isPlayer1 ? playerScore++ : opponentScore++;
  } else if (result.winner === "player2") {
    isPlayer1 ? opponentScore++ : playerScore++;
  }

  const roomRef = getRoomRef(roomId);
  roomRef.update({
    scores: {
      player1: isPlayer1 ? playerScore : opponentScore,
      player2: isPlayer1 ? opponentScore : playerScore,
    },
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
  });
}

function displayResults(result) {
  elements.result.textContent = result.message;
  elements.playerScore.textContent = playerScore;
  elements.opponentScore.textContent = opponentScore;
}

function prepareNextRound() {
  setTimeout(() => {
    const roomRef = getRoomRef(roomId);
    roomRef.update({
      "player1/move": null,
      "player2/move": null,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });
    elements.result.textContent = "";
    elements.playerChoice.textContent = "?";
    elements.opponentChoice.textContent = "?";
    setButtonsDisabled(false);
  }, 3000);
}
