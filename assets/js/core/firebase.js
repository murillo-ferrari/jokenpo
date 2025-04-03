/**
 * Firebase configuration and core database functions
 * Handles all Firebase initialization and basic database operations
 */

// Firebase configuration from environment
const firebaseConfig = JSON.parse(atob("@@FIREBASE_CONFIG@@"));

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

/**
 * Generate a unique player ID
 * @returns {string} Unique player ID
 */
function generatePlayerId() {
  return "player_" + Math.random().toString(36).slice(2, 11);
}

/**
 * Get a reference to a room
 * @param {string} roomId
 * @returns {firebase.database.Reference} Room reference
 */
function getRoomRef(roomId) {
  return database.ref(`rooms/${roomId}`);
}

export { database, generatePlayerId, getRoomRef };
