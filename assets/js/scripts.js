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
};

// Verify all required DOM elements exist
function verifyElements() {
  for (const [key, element] of Object.entries(elements)) {
    if (!element) {
      console.error(`Missing DOM element: ${key}`);
      return false;
    }
  }
  return true;
}

if (!verifyElements()) {
  alert(
    "Critical error: Missing required game elements. Please refresh the page."
  );
}

// Emoji Mapping
const emojis = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

// Initialize button event listeners
function initializeButtons() {
  if (elements.rockBtn) {
    elements.rockBtn.addEventListener("click", () => playMove("rock"));
    elements.rockBtn.disabled = false;
  }
  if (elements.paperBtn) {
    elements.paperBtn.addEventListener("click", () => playMove("paper"));
    elements.paperBtn.disabled = false;
  }
  if (elements.scissorsBtn) {
    elements.scissorsBtn.addEventListener("click", () => playMove("scissors"));
    elements.scissorsBtn.disabled = false;
  }
}

// Initialize buttons when the script loads
initializeButtons();

// Allow users to copy room ID
function copyRoomId() {
  navigator.clipboard
    .writeText(roomId)
    .then(() => {
      elements.copyBtn.textContent = "Copied!";
      setTimeout(() => {
        elements.copyBtn.textContent = "Copy Room ID";
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy room ID: ", err);
    });
}

// Room Management
function createRoom() {
  roomId = Math.random().toString(36).slice(2, 6).toUpperCase();
  elements.roomIdInput.value = roomId;
  // Show the room ID display
  elements.shareRoom.style.display = "block";
  elements.roomIdDisplay.textContent = roomId;
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
  elements.shareRoom.style.display = "none"; // Ensure share section is hidden initially

  roomRef = database.ref(`rooms/${roomId}`);

  roomRef.transaction(
    (currentData) => {
      if (!currentData) {
        isPlayer1 = true;
        // Show share room section only for the room creator
        elements.shareRoom.style.display = "block";
        elements.roomIdDisplay.textContent = roomId;
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
      }

      if (currentData.player2 && currentData.player2.id) {
        throw new Error("Room is full! Please try another room.");
      }

      if (currentData.player1.id === playerId) {
        isPlayer1 = true;
        return;
      }

      currentData.player2 = {
        id: playerId,
        move: null,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      };
      currentData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;
      return currentData;
    },
    (error, committed) => {
      if (error) {
        handleRoomError(error);
        return;
      }

      if (!committed) {
        handleRoomError(new Error("Failed to join room"));
        return;
      }

      setupRoomListener();
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

// Game State Management
function setupRoomListener() {
  roomRef.on("value", (snapshot) => {
    try {
      const room = snapshot.val();
      if (!room) {
        alert("Room was deleted by the host");
        location.reload();
        return;
      }

      if (!room.player1 || !room.player2 || !room.player2.id) {
        return;
      }

      // Hide share room section when room is full
      elements.shareRoom.style.display = "none";

      elements.waiting.style.display = "none";
      elements.game.style.display = "block";

      // Update scores
      playerScore = isPlayer1 ? room.scores.player1 : room.scores.player2;
      opponentScore = isPlayer1 ? room.scores.player2 : room.scores.player1;
      updateScores();

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

      // Get current player moves
      const myMove = isPlayer1 ? room.player1.move : room.player2.move;
      const theirMove = isPlayer1 ? room.player2.move : room.player1.move;

      // Update UI based on game state
      if (room.player1.move && room.player2.move) {
        if (room.round > currentRound) {
          currentRound = room.round;
          calculateResults(room.player1.move, room.player2.move);
        } else {
          // Only show "Calculating..." if we haven't processed the result yet
          if (elements.result.textContent !== "It's a tie!") {
            elements.result.textContent = "Calculating...";
          }
        }
      } else {
        elements.playerChoice.textContent = myMove ? "✓" : "?";
        elements.opponentChoice.textContent = theirMove ? "✓" : "?";
        // Only clear result if we're not showing a tie
        if (elements.result.textContent !== "It's a tie!") {
          elements.result.textContent = "";
        }
      }

      // Update button states
      updateButtonState(myMove, theirMove);
    } catch (error) {
      console.error("Listener error:", error);
    }
  });
}

function updateButtonState(myMove, theirMove) {
  try {
    const shouldDisable = !!myMove; // Only disable if current player has moved
    setButtonsDisabled(shouldDisable);

    const buttons = [elements.rockBtn, elements.paperBtn, elements.scissorsBtn];
    buttons.forEach((btn) => {
      if (!btn) return;

      if (myMove) {
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
      } else {
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
    });
  } catch (error) {
    console.error("Button state error:", error);
  }
}

function setButtonsDisabled(disabled) {
  buttonsDisabled = disabled;
  if (elements.rockBtn) elements.rockBtn.disabled = disabled;
  if (elements.paperBtn) elements.paperBtn.disabled = disabled;
  if (elements.scissorsBtn) elements.scissorsBtn.disabled = disabled;
}

// Game Actions
function playMove(move) {
  if (buttonsDisabled) {
    console.log("Buttons are disabled - ignoring move");
    return;
  }

  console.log(`Playing move: ${move}`);

  roomRef
    .once("value")
    .then((snapshot) => {
      const room = snapshot.val();
      if (!room) {
        console.error("Room not found");
        return;
      }

      // Verify player is still in the room
      const isStillPlayer1 = room.player1 && room.player1.id === playerId;
      const isStillPlayer2 = room.player2 && room.player2.id === playerId;

      if (!isStillPlayer1 && !isStillPlayer2) {
        console.error("Player not found in room");
        alert("You're no longer in this room. Please refresh.");
        return;
      }

      const updates = {};
      const playerPath = isStillPlayer1 ? "player1" : "player2";
      updates[`${playerPath}/move`] = move;
      updates["lastUpdated"] = firebase.database.ServerValue.TIMESTAMP;

      return roomRef.update(updates);
    })
    .then(() => {
      console.log("Move submitted successfully");
      elements.playerChoice.textContent = "✓";
      setButtonsDisabled(true);

      // Check if both players have moved
      return roomRef.once("value");
    })
    .then((snapshot) => {
      const room = snapshot.val();
      if (
        room.player1.move &&
        room.player2.move &&
        room.round === currentRound
      ) {
        console.log("Both players moved - advancing round");
        return roomRef.update({
          round: currentRound + 1,
          lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        });
      }
    })
    .catch((error) => {
      console.error("Move error:", error);
      alert("Error submitting move. Please try again.");
      setButtonsDisabled(false);
    });
}

function calculateResults(p1Move, p2Move) {
  // Display moves
  elements.playerChoice.textContent = emojis[isPlayer1 ? p1Move : p2Move];
  elements.opponentChoice.textContent = emojis[isPlayer1 ? p2Move : p1Move];

  // Determine winner
  let result = "It's a tie!";
  if (p1Move !== p2Move) {
    const winConditions = {
      rock: "scissors",
      paper: "rock",
      scissors: "paper",
    };

    if (winConditions[p1Move] === p2Move) {
      result = isPlayer1 ? "You win! 🎉" : "Opponent wins!";
      if (isPlayer1) playerScore++;
      else opponentScore++;
    } else {
      result = isPlayer1 ? "Opponent wins!" : "You win! 🎉";
      if (!isPlayer1) playerScore++;
      else opponentScore++;
    }
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

  // Reset for next round
  setTimeout(() => {
    roomRef.update({
      "player1/move": null,
      "player2/move": null,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });
    // Only clear these if we're not showing a tie
    if (elements.result.textContent !== "It's a tie!") {
      elements.result.textContent = "";
    }
    elements.playerChoice.textContent = "?";
    elements.opponentChoice.textContent = "?";
    setButtonsDisabled(false);
  }, 3000);
}

function updateScores() {
  if (elements.playerScore) elements.playerScore.textContent = playerScore;
  if (elements.opponentScore)
    elements.opponentScore.textContent = opponentScore;
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
    playerScore = 0;
    opponentScore = 0;
    updateScores();

    roomRef.update({
      scores: { player1: 0, player2: 0 },
      resetRequest: null,
      "player1/move": null,
      "player2/move": null,
      round: 0,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });

    elements.result.textContent = "";
    elements.playerChoice.textContent = "?";
    elements.opponentChoice.textContent = "?";
    currentRound = 0;
    setButtonsDisabled(false);
    return;
  }

  roomRef.update({
    resetRequest: null,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
  });
  elements.resetConfirm.style.display = "none";
}

// Expose functions to HTML
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.playMove = playMove;
window.requestReset = requestReset;
window.confirmReset = confirmReset;
window.copyRoomId = copyRoomId;
