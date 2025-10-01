const elements = {
  setup: document.getElementById("setup"),
  waiting: document.getElementById("waiting"),
  shareRoom: document.getElementById("share-room"),
  roomIdDisplay: document.getElementById("room-id-display"),
  copyBtn: document.getElementById("copy-btn"),
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
  totalRounds: document.getElementById("total-rounds"),
  totalTies: document.getElementById("total-ties"),
  toast: document.getElementById("toast"),
};

export function verifyElements() {
  for (const [key, element] of Object.entries(elements)) {
    if (!element) {
      throw new Error(`Missing DOM element: ${key}`);
    }
  }
}

export function initializeButtons(playMove) {
  const buttons = {
    rockBtn: "rock",
    paperBtn: "paper",
    scissorsBtn: "scissors",
  };

  for (const [btnKey, move] of Object.entries(buttons)) {
    const btn = elements[btnKey];
    if (!btn) continue;

    btn.addEventListener("click", () => playMove(move));
    btn.disabled = false;
  }
}

export default elements;
