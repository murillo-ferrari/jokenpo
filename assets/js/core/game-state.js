/**
 * Core game state management
 */

import { generatePlayerId } from './firebase.js';

// Game state variables
let roomId = null;
let playerId = null;
let isPlayer1 = false;
let currentRound = 0;
let playerScore = 0;
let opponentScore = 0;

/**
 * Initialize player with unique ID
 */
function initPlayer() {
    playerId = localStorage.getItem('playerId') || generatePlayerId();
    localStorage.setItem('playerId', playerId);
}

/**
 * Get or create player ID
 */
function getPlayerId() {
    if (!playerId) {
        initPlayer();
    }
    return playerId;
}

// Export all state variables
export { 
    roomId, 
    playerId, 
    isPlayer1, 
    currentRound,
    playerScore,
    opponentScore,
    initPlayer,
    getPlayerId 
};