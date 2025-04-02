// Firebase Initialization
const firebaseConfig = JSON.parse(atob("@@FIREBASE_CONFIG@@"));
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Game State Variables
let roomId;
let playerId = "player_" + Math.random().toString(36).slice(2, 11);
let isPlayer1 = false;
let roomRef;
let currentRound = 0;
let playerScore = 0;
let opponentScore = 0;
let buttonsDisabled = false;

// DOM Elements
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

// Emoji Mapping
const emojis = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

// Room Management
function createRoom() {
  roomId = Math.random().toString(36).slice(2, 6).toUpperCase();
  elements.roomIdInput.value = roomId;
  joinRoom();
}

function joinRoom() {
  roomId = elements.roomIdInput.value.trim().toUpperCase();
  if (!roomId || roomId.length !== 4) {
    alert("Please enter a valid 4-character room ID");
    return;
  }

  elements.setup.style.display = "none";
  elements.waiting.style.display = "block";
  elements.resetConfirm.style.display = "none";

  roomRef = database.ref(`rooms/${roomId}`);

  roomRef.transaction(
    (currentData) => {
      if (!currentData) {
        // Create new room as player1
        isPlayer1 = true;
        return {
          player1: {
            id: playerId,
            move: null,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
          },
          player2: {
            id: null,
            move: null,
            timestamp: null,
          },
          round: 0,
          scores: { player1: 0, player2: 0 },
          resetRequest: null,
          lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        };
      } else {
        // Join existing room
        if (currentData.player2 && currentData.player2.id) {
          throw new Error("Room is full! Please try another room.");
        }
        if (currentData.player1.id === playerId) {
          isPlayer1 = true;
          return; // Already in room as player1
        }
        currentData.player2 = {
          id: playerId,
          move: null,
          timestamp: firebase.database.ServerValue.TIMESTAMP,
        };
        currentData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;
        return currentData;
      }
    },
    (error, committed) => {
      if (error) {
        handleRoomError(error);
      } else if (!committed) {
        handleRoomError(new Error("Failed to join room"));
      } else {
        setupRoomListener();
      }
    }
  );
}

function handleRoomError(error) {
  console.error("Room error:", error);
  elements.setup.style.display = "block";
  elements.waiting.style.display = "none";
  elements.game.style.display = "none";
  alert(error.message || "Error joining room. Please try again.");
}

// Real-time Game Listener
function setupRoomListener() {
  roomRef.on("value", (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      alert("Room was deleted by the host");
      location.reload();
      return;
    }

    // Check if both players are present
    if (room.player1.id && room.player2 && room.player2.id) {
      elements.waiting.style.display = "none";
      elements.game.style.display = "block";

      // Update scores display
      playerScore = isPlayer1 ? room.scores.player1 : room.scores.player2;
      opponentScore = isPlayer1 ? room.scores.player2 : room.scores.player1;
      updateScores();

      // Update moves display
      updateMoveDisplay(room);

      // Handle reset requests
      if (room.resetRequest) {
        if (room.resetRequest.playerId !== playerId) {
          elements.resetConfirm.style.display = "block";
        } else {
          elements.resetConfirm.style.display = "none";
        }
      } else {
        elements.resetConfirm.style.display = "none";
      }

      // Handle button state
      const myMove = isPlayer1 ? room.player1.move : room.player2.move;
      const theirMove = isPlayer1 ? room.player2.move : room.player1.move;
      updateButtonState(myMove, theirMove);

      // Handle completed round
      if (room.player1.move && room.player2.move && room.round > currentRound) {
        currentRound = room.round;
        showResults(room.player1.move, room.player2.move);
      }
    }
  });
}

function updateMoveDisplay(room) {
  const myMove = isPlayer1 ? room.player1.move : room.player2.move;
  const theirMove = isPlayer1 ? room.player2.move : room.player1.move;

  elements.playerChoice.textContent = myMove ? "✓" : "?";
  elements.opponentChoice.textContent = theirMove ? "✓" : "?";
}

function updateScores() {
  elements.playerScore.textContent = playerScore;
  elements.opponentScore.textContent = opponentScore;
}

function updateButtonState(myMove, theirMove) {
  // Disable buttons ONLY if:
  // - I already made a move (waiting for opponent)
  // - OR the round is being calculated (both moved)
  const shouldDisable = myMove || (myMove && theirMove);
  setButtonsDisabled(shouldDisable);

  // Visual feedback - different states
  const buttons = [elements.rockBtn, elements.paperBtn, elements.scissorsBtn];
  buttons.forEach((btn) => {
    if (myMove && !theirMove) {
      // I made move, waiting for opponent
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    } else if (myMove && theirMove) {
      // Both moved, round in progress
      btn.style.opacity = "0.5";
      btn.style.cursor = "wait";
    } else {
      // Ready to make move
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  });
}

function setButtonsDisabled(disabled) {
  buttonsDisabled = disabled;
  elements.rockBtn.disabled = disabled;
  elements.paperBtn.disabled = disabled;
  elements.scissorsBtn.disabled = disabled;
}

// Game Actions
function playMove(move) {
  if (buttonsDisabled) return;

  // First determine which player we are
  roomRef.once("value").then((snapshot) => {
    const room = snapshot.val();
    if (!room) return;

    let playerPath;
    if (room.player1.id === playerId) {
      playerPath = "player1";
    } else if (room.player2.id === playerId) {
      playerPath = "player2";
    } else {
      console.error("Player ID mismatch!");
      return;
    }

    // Update our move
    const updates = {};
    updates[`${playerPath}/move`] = move;
    updates[`${playerPath}/timestamp`] =
      firebase.database.ServerValue.TIMESTAMP;
    updates["lastUpdated"] = firebase.database.ServerValue.TIMESTAMP;

    roomRef.update(updates).then(() => {
      elements.playerChoice.textContent = "✓";
      setButtonsDisabled(true);

      // Check if both players have moved
      if (
        room.player1.move &&
        room.player2.move &&
        room.round === currentRound
      ) {
        roomRef.update({
          round: currentRound + 1,
          lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        });
      }
    });
  });
}

function showResults(p1Move, p2Move) {
  // Show moves
  elements.playerChoice.textContent = emojis[isPlayer1 ? p1Move : p2Move];
  elements.opponentChoice.textContent = emojis[isPlayer1 ? p2Move : p1Move];

  // Determine winner
  let result;
  if (p1Move === p2Move) {
    result = "It's a tie!";
  } else if (
    (p1Move === "rock" && p2Move === "scissors") ||
    (p1Move === "paper" && p2Move === "rock") ||
    (p1Move === "scissors" && p2Move === "paper")
  ) {
    result = isPlayer1 ? "You win! 🎉" : "Opponent wins!";
    if (isPlayer1) playerScore++;
    else opponentScore++;
  } else {
    result = isPlayer1 ? "Opponent wins!" : "You win! 🎉";
    if (!isPlayer1) playerScore++;
    else opponentScore++;
  }

  elements.result.textContent = result;
  updateScores();

  // Update scores in database
  roomRef.update({
    scores: {
      player1: isPlayer1 ? playerScore : opponentScore,
      player2: isPlayer1 ? opponentScore : playerScore,
    },
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
  });

  // Reset moves after 3 seconds and re-enable buttons
  setTimeout(() => {
    roomRef.update({
      "player1/move": null,
      "player2/move": null,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });
    elements.result.textContent = "";
    setButtonsDisabled(false);
  }, 3000);
}

// Reset Functions
function requestReset() {
  roomRef.update({
    resetRequest: {
      playerId: playerId,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    },
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
  });
}

function confirmReset(accept) {
  if (accept) {
    // Reset scores
    playerScore = 0;
    opponentScore = 0;
    updateScores();

    // Update database
    roomRef.update({
      scores: { player1: 0, player2: 0 },
      resetRequest: null,
      "player1/move": null,
      "player2/move": null,
      round: 0,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });

    // Reset UI
    elements.result.textContent = "";
    elements.playerChoice.textContent = "?";
    elements.opponentChoice.textContent = "?";
    currentRound = 0;
    setButtonsDisabled(false);
  } else {
    // Just clear the reset request
    roomRef.update({
      resetRequest: null,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });
  }
  elements.resetConfirm.style.display = "none";
}

// Expose functions to HTML
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.playMove = playMove;
window.requestReset = requestReset;
window.confirmReset = confirmReset;
