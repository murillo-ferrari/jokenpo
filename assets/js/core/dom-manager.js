/**
 * Manages all DOM element references and basic UI operations
 */

const elements = {
  setup: document.getElementById("setup"),
  waiting: document.getElementById("waiting"),
  game: document.getElementById("game"),
  roomIdInput: document.getElementById("roomId"),
  playerChoice: document.getElementById("player-choice"),
  opponentChoice: document.getElementById("opponent-choice"),
  result: document.getElementById("result"),
  playerScore: document.getElementById("player-score"),
  opponentScore: document.getElementById("opponent-score"),
  resetConfirm: document.getElementById("reset-confirm"),
  rockBtn: document.getElementById("rock-btn"),
  paperBtn: document.getElementById("paper-btn"),
  scissorsBtn: document.getElementById("scissors-btn"),
};

/**
 * Verify all required DOM elements exist
 * @throws {Error} If any critical element is missing
 */
function verifyDOM() {
  for (const [name, element] of Object.entries(elements)) {
    if (!element) {
      throw new Error(`Missing required element: ${name}`);
    }
  }
}

export { elements, verifyDOM };
