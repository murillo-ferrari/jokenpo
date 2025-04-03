/**
 * Manages all DOM element references and basic UI operations
 */

// Critical elements that will throw errors if missing
const requiredElements = {
  setup: "setup",
  waiting: "waiting",
  game: "game",
  roomIdInput: "roomId",
  playerChoice: "player-choice",
  opponentChoice: "opponent-choice"
};

// Optional elements (won't throw errors if missing)
const optionalElements = {
  result: "result",
  playerScore: "player-score",
  opponentScore: "opponent-score",
  resetConfirm: "reset-confirm",
  rockBtn: "rock-btn",
  paperBtn: "paper-btn",
  scissorsBtn: "scissors-btn",
  createRoomBtn: "createRoomBtn",
  joinRoomBtn: "joinRoomBtn",
  resetBtn: "reset-btn",
  confirmResetBtn: "confirm-reset-btn",
  denyResetBtn: "deny-reset-btn"
};

// Combined elements collection
const elements = {};

// Initialize all elements
function initElements() {
  // Load required elements
  for (const [key, id] of Object.entries(requiredElements)) {
    elements[key] = document.getElementById(id);
  }

  // Load optional elements
  for (const [key, id] of Object.entries(optionalElements)) {
    elements[key] = document.getElementById(id);
  }
}

/**
 * Verify all required DOM elements exist
 * @throws {Error} If any critical element is missing
 */
function verifyDOM() {
  let missingElements = [];

  // Check required elements
  for (const [name, element] of Object.entries(elements)) {
    if (requiredElements[name] && !element) {
      missingElements.push(name);
    }
  }

  if (missingElements.length > 0) {
    throw new Error(`Missing required elements: ${missingElements.join(', ')}`);
  }
}

// Initialize elements immediately
initElements();

export { elements, verifyDOM };