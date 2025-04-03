/**
 * Manages the game state and player information
 */

// Game state variables
export let roomId = null;
export let playerId = null;
export let isPlayer1 = false;
export let currentRound = 0;
export let playerScore = 0;
export let opponentScore = 0;

// Use the imported function from firebase.js
import { generatePlayerId } from './firebase.js';

/**
 * Initialize player with unique ID
 */
export function initPlayer() {
    playerId = localStorage.getItem('playerId') || generatePlayerId();
    localStorage.setItem('playerId', playerId);
}

/**
 * Get or create player ID
 */
export function getPlayerId() {
    if (!playerId) {
        initPlayer();
    }
    return playerId;
}
/**
 * Reset the game state to its initial values
 */
export function resetGameState() {
    roomId = null;
    playerId = null;
    isPlayer1 = false;
    currentRound = 0;
    playerScore = 0;
    opponentScore = 0;
}

export { 
  roomId, playerId, isPlayer1, currentRound, 
  playerScore, opponentScore, initPlayer, resetGameState 
};
