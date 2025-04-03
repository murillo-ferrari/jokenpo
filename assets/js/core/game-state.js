/**
 * Manages the game state and player information
 */

let roomId = null;
let playerId = null;
let isPlayer1 = false;
let currentRound = 0;
let playerScore = 0;
let opponentScore = 0;

/**
 * Initialize player with new ID
 */
function initPlayer() {
  playerId = generatePlayerId();
}

/**
 * Reset all game state for new game
 */
function resetGameState() {
  currentRound = 0;
  playerScore = 0;
  opponentScore = 0;
  isPlayer1 = false;
}

export {
  roomId,
  playerId,
  isPlayer1,
  currentRound,
  playerScore,
  opponentScore,
  initPlayer,
  resetGameState,
};
