/**
 * Core game state management
 */

// Generate a random player ID
function generatePlayerId() {
  return 'player-' + Math.random().toString(36).substr(2, 9);
}

// Game state variables
export let roomId = null;
export let playerId = null;
export let isPlayer1 = false;

/**
 * Initialize player with unique ID
 */
export function initPlayer() {
  playerId = generatePlayerId(); // Now this will work
  localStorage.setItem('playerId', playerId); // Optional: persist across page refreshes
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