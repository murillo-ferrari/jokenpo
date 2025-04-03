/**
 * Jokenpo (Rock-Paper-Scissors) Online Game
 *
 * This script implements a multiplayer Jokenpo game using Firebase Realtime Database.
 * Players can create rooms, join existing rooms, and play against each other in real-time.
 */

/* ==================== FIREBASE INITIALIZATION ==================== */

/**
 * Firebase configuration and initialization
 * Note: @@FIREBASE_CONFIG@@ should be replaced with your actual Firebase config
 * encoded in base64 during deployment
 */
const firebaseConfig = JSON.parse(atob("@@FIREBASE_CONFIG@@"));
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

/* ==================== GAME STATE VARIABLES ==================== */

// Current room ID (4-character uppercase string)
let roomId;

// Unique player ID (randomly generated)
let playerId = "player_" + Math.random().toString(36).slice(2, 11);

// Flag indicating if this player is the room creator
let isRoomCreator = false;

// Reference to the current room in Firebase
let roomRef;

// Current round number
let currentRound = 0;

// Player and opponent scores
let playerScore = 0;
let opponentScore = 0;

// Flag to track if buttons should be disabled
let buttonsDisabled = false;

/* ==================== DOM ELEMENTS ==================== */

/**
 * Object containing references to all required DOM elements
 */
const elements = {
  setup: document.getElementById("setup"), // Setup screen
  waiting: document.getElementById("waiting"), // Waiting for player screen
  shareRoom: document.getElementById("share-room"), // Room sharing section
  roomIdDisplay: document.getElementById("room-id-display"), // Room ID display
  copyBtn: document.getElementById("copy-btn"), // Copy room ID button
  game: document.getElementById("game"), // Game screen
  roomIdInput: document.getElementById("roomId"), // Room ID input field
  playerChoice: document.getElementById("player-choice"), // Player's choice display
  opponentChoice: document.getElementById("opponent-choice"), // Opponent's choice display
  result: document.getElementById("result"), // Result display
  playerScore: document.getElementById("player-score"), // Player score display
  opponentScore: document.getElementById("opponent-score"), // Opponent score display
  resetConfirm: document.getElementById("reset-confirm"), // Reset confirmation dialog
  rockBtn: document.getElementById("rock-btn"), // Rock button
  paperBtn: document.getElementById("paper-btn"), // Paper button
  scissorsBtn: document.getElementById("scissors-btn"), // Scissors button
};

/* ==================== UTILITY FUNCTIONS ==================== */

/**
 * Verifies that all required DOM elements exist
 * @returns {boolean} True if all elements exist, false otherwise
 */
function verifyElements() {
  for (const [key, element] of Object.entries(elements)) {
    if (!element) {
      console.error(`Missing DOM element: ${key}`);
      return false;
    }
  }
  return true;
}

// Verify elements on load and show alert if any are missing
if (!verifyElements()) {
  alert(
    "Critical error: Missing required game elements. Please refresh the page."
  );
}

/**
 * Emoji mapping for game choices
 */
const emojis = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

/* ==================== GAME INITIALIZATION ==================== */

/**
 * Initializes button event listeners
 */
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

/* ==================== ROOM MANAGEMENT ==================== */

/**
 * Copies the current room ID to clipboard
 */
function copyRoomId() {
  navigator.clipboard
    .writeText(roomId)
    .then(() => {
      elements.copyBtn.textContent = "Copied!";
      setTimeout(() => {
        elements.copyBtn.textContent = "Copy Room ID";
      }, 1000);
    })
    .catch((err) => {
      console.error("Failed to copy room ID: ", err);
    });
}

/**
 * Creates a new game room with a random ID
 */
function createRoom() {
  // Generate a 4-character room ID
  roomId = Math.random().toString(36).slice(2, 6).toUpperCase();
  elements.roomIdInput.value = roomId;
  
  // Show the room ID display for sharing
  elements.shareRoom.style.display = "block";
  elements.roomIdDisplay.textContent = roomId;
  joinRoom();
}

/**
 * Joins an existing game room or creates one if it doesn't exist
 */
function joinRoom() {
  roomId = elements.roomIdInput.value.trim().toUpperCase();
  if (!roomId || roomId.length !== 4) {
    alert("Please enter a valid 4-character room ID");
    return;
  }

  // Update UI state
  elements.setup.style.display = "none";
  elements.waiting.style.display = "block";
  elements.resetConfirm.style.display = "none";
  elements.shareRoom.style.display = "none"; // Hide share section initially

  // Get reference to the room in Firebase
  roomRef = database.ref(`rooms/${roomId}`);

  // Transaction ensures atomic updates to room state
  roomRef.transaction(
    (currentData) => {
      // If room doesn't exist, create it (player becomes room creator)
      if (!currentData) {
        isRoomCreator = true;
        
        // Show share section for room creator
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

      // If room already has 2 players, throw error
      if (currentData.player2 && currentData.player2.id) {
        throw new Error("Room is full! Please try another room.");
      }

      // If player is already in the room (player1)
      if (currentData.player1.id === playerId) {
        isRoomCreator = true;
        return; // No changes needed
      }

      // Otherwise, join as player2
      currentData.player2 = {
        id: playerId,
        move: null,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      };
      // Hide share section for room creator
      elements.shareRoom.style.display = "none";
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

      // Successfully joined room, set up listener
      setupRoomListener();
    }
  );
}

/**
 * Handles room joining errors
 * @param {Error} error The error that occurred
 */
function handleRoomError(error) {
  console.error("Room error:", error);
  // Reset UI to setup screen
  elements.setup.style.display = "block";
  elements.waiting.style.display = "none";
  elements.game.style.display = "none";
  elements.shareRoom.style.display = "none";
  alert(error.message || "Error joining room. Please try again.");
}

/* ==================== GAME STATE MANAGEMENT ==================== */

/**
 * Sets up a listener for changes to the room state in Firebase
 */
function setupRoomListener() {
  roomRef.on("value", (snapshot) => {
    try {
      const room = snapshot.val();
      if (!room) {
        alert("Room was deleted by the host");
        location.reload();
        return;
      }

      // If room isn't full yet, wait for second player
      if (!room.player1 || !room.player2 || !room.player2.id) {
        return;
      }

      // Hide share room section when room is full
      elements.shareRoom.style.display = "none";

      // Show game screen
      elements.waiting.style.display = "none";
      elements.game.style.display = "block";

      // Update scores from Firebase
      playerScore = isRoomCreator ? room.scores.player1 : room.scores.player2;
      opponentScore = isRoomCreator ? room.scores.player2 : room.scores.player1;
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
      const myMove = isRoomCreator ? room.player1.move : room.player2.move;
      const theirMove = isRoomCreator ? room.player2.move : room.player1.move;

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

/**
 * Updates the state of the game buttons based on current moves
 * @param {string|null} myMove The current player's move (or null if none)
 * @param {string|null} theirMove The opponent's move (or null if none)
 */
function updateButtonState(myMove, theirMove) {
  try {
    // Only disable buttons if current player has made a move
    const shouldDisable = !!myMove;
    setButtonsDisabled(shouldDisable);

    // Update visual state of buttons
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

/**
 * Enables or disables all game buttons
 * @param {boolean} disabled Whether buttons should be disabled
 */
function setButtonsDisabled(disabled) {
  buttonsDisabled = disabled;
  if (elements.rockBtn) elements.rockBtn.disabled = disabled;
  if (elements.paperBtn) elements.paperBtn.disabled = disabled;
  if (elements.scissorsBtn) elements.scissorsBtn.disabled = disabled;
}

/* ==================== GAME ACTIONS ==================== */

/**
 * Handles a player making a move (rock, paper, or scissors)
 * @param {string} move The move being played ("rock", "paper", or "scissors")
 */
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

      // Prepare updates for Firebase
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

/**
 * Calculates and displays the results of a round
 * @param {string} p1Move Player 1's move
 * @param {string} p2Move Player 2's move
 */
function calculateResults(p1Move, p2Move) {
  // Display moves using emojis
  elements.playerChoice.textContent = emojis[isRoomCreator ? p1Move : p2Move];
  elements.opponentChoice.textContent = emojis[isRoomCreator ? p2Move : p1Move];

  // Determine winner
  let result = "It's a tie!";
  if (p1Move !== p2Move) {
    const winConditions = {
      rock: "scissors",
      paper: "rock",
      scissors: "paper",
    };

    if (winConditions[p1Move] === p2Move) {
      result = isRoomCreator ? "You win! 🎉" : "Opponent wins!";
      if (isRoomCreator) playerScore++;
      else opponentScore++;
    } else {
      result = isRoomCreator ? "Opponent wins!" : "You win! 🎉";
      if (!isRoomCreator) playerScore++;
      else opponentScore++;
    }
  }

  elements.result.textContent = result;
  updateScores();

  // Update scores in database
  roomRef.update({
    scores: {
      player1: isRoomCreator ? playerScore : opponentScore,
      player2: isRoomCreator ? opponentScore : playerScore,
    },
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
  });

  // Reset for next round after 3 seconds
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

/**
 * Updates the score displays in the UI
 */
function updateScores() {
  if (elements.playerScore) elements.playerScore.textContent = playerScore;
  if (elements.opponentScore)
    elements.opponentScore.textContent = opponentScore;
}

/* ==================== GAME RESET FUNCTIONS ==================== */

/**
 * Requests a score reset (needs confirmation from other player)
 */
function requestReset() {
  roomRef.update({
    resetRequest: {
      playerId: playerId,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    },
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
  });
}

/**
 * Confirms or rejects a reset request
 * @param {boolean} accept Whether to accept the reset request
 */
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

  // If reset was rejected
  roomRef.update({
    resetRequest: null,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
  });
  elements.resetConfirm.style.display = "none";
}

/* ==================== EXPOSE FUNCTIONS TO HTML ==================== */

// Make these functions available to be called from HTML
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.playMove = playMove;
window.requestReset = requestReset;
window.confirmReset = confirmReset;
window.copyRoomId = copyRoomId;
