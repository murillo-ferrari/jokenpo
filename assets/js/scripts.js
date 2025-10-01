// Firebase Initialization
// TODO: Replace with your actual Firebase config
// For production, move these to environment variables or server-side configuration
const firebaseConfig = {
  // Add your Firebase configuration here
  // Do not commit actual credentials to version control
  apiKey: "AIzaSyApmrzJtIDsMpYSjLlP0LeRSAPjH3Ix_rE",
  authDomain: "jokenpo-5525a.firebaseapp.com",
  databaseURL: "https://jokenpo-5525a-default-rtdb.firebaseio.com",
  projectId: "jokenpo-5525a",
  storageBucket: "jokenpo-5525a.firebasestorage.app",
  messagingSenderId: "297875424095",
  appId: "1:297875424095:web:1c44efd898d65b11b76cea",
  measurementId: "G-ZRP932KL1C"
};

// Firebase Initialization
// const firebaseConfig = JSON.parse(atob("@@FIREBASE_CONFIG@@"));
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
let lastProcessedRound = -1; // Track which round we last processed
let isProcessingMove = false; // Prevent duplicate move submissions

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
  totalRounds: document.getElementById("total-rounds"),
  totalTies: document.getElementById("total-ties"),
};

// Verify all required DOM elements exist
function verifyElements() {
  for (const [key, element] of Object.entries(elements)) {
    if (!element) {
      throw new Error(`Missing DOM element: ${key}`);
    }
  }
}

try {
  verifyElements();
} catch (error) {
  alert(error.message);
  throw error;
}

// Emoji Mapping
const emojis = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

// Initialize button event listeners
function initializeButtons() {
  const buttons = {
    rockBtn: "rock",
    paperBtn: "paper",
    scissorsBtn: "scissors",
  };

  for (const [btnKey, move] of Object.entries(buttons)) {
    const btn = elements[btnKey];
    if (btn) {
      btn.addEventListener("click", () => playMove(move));
      btn.disabled = false;
    }
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
  elements.shareRoom.style.display = "none";

  roomRef = database.ref(`rooms/${roomId}`);

  roomRef.transaction(
    (currentData) => {
      if (!currentData) {
        isPlayer1 = true;
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

      // Wait for both players
      if (!room.player1 || !room.player2 || !room.player2.id) {
        return;
      }

      // Hide share room section when room is full
      elements.shareRoom.style.display = "none";
      elements.waiting.style.display = "none";
      elements.game.style.display = "block";

      // Update local round from server
      currentRound = room.round;

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

      // Get player moves - be very explicit about which is which
      const player1Move = room.player1.move;
      const player2Move = room.player2.move;
      
      // Determine THIS player's move based on whether they are player1 or player2
      let currentPlayerMove, opponentPlayerMove;
      if (isPlayer1) {
        currentPlayerMove = player1Move;
        opponentPlayerMove = player2Move;
      } else {
        currentPlayerMove = player2Move;
        opponentPlayerMove = player1Move;
      }

      console.log(`🔄 State update - ${isPlayer1 ? 'PLAYER 1 (HOST)' : 'PLAYER 2 (GUEST)'} - myMove: ${currentPlayerMove}, oppMove: ${opponentPlayerMove}, round: ${currentRound}`);

      // Sync scores from database to prevent discrepancies
      playerScore = isPlayer1 ? room.scores.player1 : room.scores.player2;
      opponentScore = isPlayer1 ? room.scores.player2 : room.scores.player1;
      updateScores();
      updateGameStats();

      // Process round if both players have moved and we haven't processed this round yet
      if (player1Move && player2Move) {
        if (currentRound > lastProcessedRound) {
          lastProcessedRound = currentRound;
          calculateResults(player1Move, player2Move, room);
        } else {
          // Already processed, just show the results
          displayMoves(player1Move, player2Move);
        }
      } else {
        // Waiting for moves
        elements.playerChoice.textContent = currentPlayerMove ? "✓" : "?";
        elements.opponentChoice.textContent = opponentPlayerMove ? "✓" : "?";
        
        // Clear result if we're starting a new round
        if (!player1Move && !player2Move) {
          elements.result.textContent = "";
        }
      }

      // Update button states based ONLY on whether THIS player has moved
      // Only disable buttons for THIS specific player if THEY have moved
      updateButtonState(currentPlayerMove);
    } catch (error) {
      console.error("Listener error:", error);
    }
  });
}

function updateButtonState(currentPlayerMove) {
  try {
    // Only disable if THIS specific player has moved OR we're processing a move
    const hasCurrentPlayerMoved = !!currentPlayerMove;
    const shouldDisable = hasCurrentPlayerMoved || isProcessingMove;
    const buttons = [elements.rockBtn, elements.paperBtn, elements.scissorsBtn];
    
    console.log(`Updating button state for ${isPlayer1 ? 'Player 1' : 'Player 2'} - Player moved: ${hasCurrentPlayerMoved}, Processing: ${isProcessingMove}, Should disable: ${shouldDisable}`);
    
    buttons.forEach((btn) => {
      if (!btn) return;
      
      btn.disabled = shouldDisable;
      btn.style.opacity = shouldDisable ? "0.5" : "1";
      btn.style.cursor = shouldDisable ? "not-allowed" : "pointer";
    });
  } catch (error) {
    console.error("Button state error:", error);
  }
}

// Game Actions
function playMove(move) {
  // Prevent duplicate submissions
  if (isProcessingMove) {
    console.log("Already processing a move - ignoring");
    return;
  }

  // Check if button is disabled
  const btn = elements[`${move}Btn`];
  if (btn && btn.disabled) {
    console.log("Button is disabled - ignoring move");
    return;
  }

  console.log(`Playing move: ${move}`);

  // Set processing flag and immediately disable buttons
  isProcessingMove = true;
  updateButtonState(true);
  elements.playerChoice.textContent = "✓";

  roomRef
    .once("value")
    .then((snapshot) => {
      const room = snapshot.val();
      if (!room) {
        throw new Error("Room not found");
      }

      // Verify player is still in the room
      const isStillPlayer1 = room.player1 && room.player1.id === playerId;
      const isStillPlayer2 = room.player2 && room.player2.id === playerId;

      if (!isStillPlayer1 && !isStillPlayer2) {
        throw new Error("You're no longer in this room. Please refresh.");
      }

      // Check if player already made a move this round
      const playerPath = isStillPlayer1 ? "player1" : "player2";
      if (room[playerPath].move) {
        console.log("Move already submitted for this round");
        isProcessingMove = false;
        return Promise.resolve();
      }

      // Submit move using transaction to prevent race conditions
      return roomRef.child(playerPath).transaction((playerData) => {
        if (!playerData) return playerData;
        
        // Only set move if it's not already set
        if (!playerData.move) {
          playerData.move = move;
          playerData.timestamp = firebase.database.ServerValue.TIMESTAMP;
        }
        return playerData;
      }).then((result) => {
        if (!result.committed) {
          throw new Error("Failed to submit move");
        }
        
        console.log("Move submitted successfully");
        
        // Update last updated timestamp
        return roomRef.update({
          lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        });
      }).then(() => {
        // Check if both players have now moved and advance round
        return roomRef.once("value");
      }).then((updatedSnapshot) => {
        const updatedRoom = updatedSnapshot.val();
        if (updatedRoom.player1.move && updatedRoom.player2.move) {
          // Both players have moved - use transaction to safely advance round
          console.log("Both players moved - attempting to advance round");
          return roomRef.child('round').transaction((roundValue) => {
            if (typeof roundValue !== "number") {
              return roundValue;
            }

            // Only advance if the server-side round still matches this client's view
            if (roundValue === room.round) {
              return roundValue + 1;
            }

            return roundValue;
          }).then((result) => {
            if (result.committed && result.snapshot.val() === room.round + 1) {
              console.log(`Round advanced to ${result.snapshot.val()}`);
              return roomRef.update({
                lastUpdated: firebase.database.ServerValue.TIMESTAMP,
              });
            }

            console.log("Round already advanced by another client - skipping increment");
            return null;
          });
        }
      }).finally(() => {
        isProcessingMove = false;
      });
    })
    .catch((error) => {
      console.error("Move error:", error);
      alert(error.message || "Error submitting move. Please try again.");
      // Re-enable buttons on error
      isProcessingMove = false;
      updateButtonState(false);
      elements.playerChoice.textContent = "?";
    });
}

function displayMoves(player1Move, player2Move) {
  elements.playerChoice.textContent = emojis[isPlayer1 ? player1Move : player2Move];
  elements.opponentChoice.textContent = emojis[isPlayer1 ? player2Move : player1Move];
}

function calculateResults(player1Move, player2Move, room) {
  // Display moves
  displayMoves(player1Move, player2Move);

  // Get current scores from server - this is the source of truth
  const currentPlayer1Score = room.scores.player1 || 0;
  const currentPlayer2Score = room.scores.player2 || 0;
  
  console.log(`Current scores from server - P1: ${currentPlayer1Score}, P2: ${currentPlayer2Score}`);
  
  // Determine winner
  let result = "It's a tie!";
  let newPlayer1Score = currentPlayer1Score;
  let newPlayer2Score = currentPlayer2Score;
  
  if (player1Move !== player2Move) {
    const winConditions = {
      rock: "scissors",
      paper: "rock",
      scissors: "paper",
    };

    const player1Won = winConditions[player1Move] === player2Move;
    
    // Increment the winner's score by 1
    if (player1Won) {
      newPlayer1Score = currentPlayer1Score + 1;
      result = isPlayer1 ? "You win! 🎉" : "Opponent wins!";
    } else {
      newPlayer2Score = currentPlayer2Score + 1;
      result = isPlayer1 ? "Opponent wins!" : "You win! 🎉";
    }
  }

  console.log(`New calculated scores - P1: ${newPlayer1Score}, P2: ${newPlayer2Score}`);

  elements.result.textContent = result;

  // Update LOCAL display scores from THIS player's perspective
  playerScore = isPlayer1 ? newPlayer1Score : newPlayer2Score;
  opponentScore = isPlayer1 ? newPlayer2Score : newPlayer1Score;
  
  updateScores();
  updateGameStats();

  // ONLY Player 1 (host) updates the database to prevent duplicate scoring
  if (isPlayer1) {
    console.log("Player 1 updating scores in database");
    roomRef.update({
      'scores/player1': newPlayer1Score,
      'scores/player2': newPlayer2Score
    }).then(() => {
      console.log("Scores updated successfully by Player 1");
    }).catch((error) => {
      console.error("Error updating scores:", error);
    });
  } else {
    console.log("Player 2 - scores will be updated by Player 1");
  }

  // Reset moves for next round after delay
  setTimeout(() => {
    const player1MoveRef = roomRef.child('player1/move');
    const player2MoveRef = roomRef.child('player2/move');
    
    Promise.all([
      player1MoveRef.set(null),
      player2MoveRef.set(null),
      roomRef.update({ lastUpdated: firebase.database.ServerValue.TIMESTAMP })
    ]).then(() => {
      // UI will be updated by the listener
      console.log("Moves reset for next round");
    }).catch((error) => {
      console.error("Error resetting moves:", error);
    });
  }, 3000);
}

function updateScores() {
  if (elements.playerScore) elements.playerScore.textContent = playerScore;
  if (elements.opponentScore) elements.opponentScore.textContent = opponentScore;
}

function updateGameStats() {
  if (elements.totalRounds) elements.totalRounds.textContent = currentRound;
  const ties = currentRound - (playerScore + opponentScore);
  if (elements.totalTies) elements.totalTies.textContent = ties > 0 ? ties : 0;
}

// Reset Functions
function requestReset() {
  roomRef.child('resetRequest').set({
    playerId: playerId,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
  }).then(() => {
    return roomRef.update({
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });
  }).catch((error) => {
    console.error("Error requesting reset:", error);
    alert("Error requesting reset. Please try again.");
  });
}

function confirmReset(accept) {
  if (accept) {
    playerScore = 0;
    opponentScore = 0;
    currentRound = 0;
    lastProcessedRound = -1;
    updateScores();
    updateGameStats();

    const resetData = {
      scores: { player1: 0, player2: 0 },
      resetRequest: null,
      round: 0,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    };

    Promise.all([
      roomRef.child('player1/move').set(null),
      roomRef.child('player2/move').set(null),
      roomRef.update(resetData)
    ]).then(() => {
      elements.result.textContent = "";
      elements.playerChoice.textContent = "?";
      elements.opponentChoice.textContent = "?";
      updateButtonState(false);
    }).catch((error) => {
      console.error("Error resetting game:", error);
      alert("Error resetting game. Please try again.");
    });
    return;
  }

  roomRef.child('resetRequest').set(null).then(() => {
    return roomRef.update({
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });
  }).catch((error) => {
    console.error("Error declining reset:", error);
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