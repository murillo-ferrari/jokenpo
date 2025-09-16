/**
 * Configuration Module
 * Handles Firebase configuration and game constants
 */
const Config = (() => {
  // Game Constants
  const GAME_CONSTANTS = {
    ROOM_ID_LENGTH: 4,
    RESULT_DISPLAY_TIME: 3000,
    MOVES: {
      ROCK: 'rock',
      PAPER: 'paper',
      SCISSORS: 'scissors'
    },
    EMOJIS: {
      rock: '✊',
      paper: '✋',
      scissors: '✌️'
    },
    WIN_CONDITIONS: {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper'
    }
  };

  // Firebase Configuration
  let firebaseConfig;
  let database;
  let isInitialized = false;

  /**
   * Initialize Firebase
   */
  const initializeFirebase = () => {
    try {
      firebaseConfig = JSON.parse(atob("@@FIREBASE_CONFIG@@"));
      firebase.initializeApp(firebaseConfig);
      database = firebase.database();
      isInitialized = true;
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      throw new Error('Failed to initialize Firebase');
    }
  };

  /**
   * Get Firebase database instance
   */
  const getDatabase = () => {
    if (!isInitialized) {
      throw new Error('Firebase not initialized');
    }
    return database;
  };

  /**
   * Get server timestamp
   */
  const getServerTimestamp = () => {
    if (!isInitialized) {
      throw new Error('Firebase not initialized');
    }
    return firebase.database.ServerValue.TIMESTAMP;
  };

  /**
   * Generate unique player ID
   */
  const generatePlayerId = () => {
    return "player_" + Math.random().toString(36).slice(2, 11);
  };

  /**
   * Generate room ID
   */
  const generateRoomId = () => {
    return Math.random().toString(36).slice(2, 6).toUpperCase();
  };

  /**
   * Validate room ID format
   */
  const isValidRoomId = (roomId) => {
    return roomId && 
           typeof roomId === 'string' && 
           roomId.length === GAME_CONSTANTS.ROOM_ID_LENGTH;
  };

  // Public API
  return {
    GAME_CONSTANTS,
    initializeFirebase,
    getDatabase,
    getServerTimestamp,
    generatePlayerId,
    generateRoomId,
    isValidRoomId,
    get isInitialized() { return isInitialized; }
  };
})();