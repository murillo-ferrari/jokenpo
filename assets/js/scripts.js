// Enhanced Firebase Initialization with Robust Error Handling
function initializeFirebase() {
  try {
    // 1. Load and validate Firebase config
    const rawConfig = "@@FIREBASE_CONFIG@@";
    if (rawConfig === "@@FIREBASE_CONFIG@@") {
      throw new Error("Firebase configuration not injected properly");
    }

    const firebaseConfig = JSON.parse(atob(rawConfig.trim()));
    console.log("Firebase config loaded:", firebaseConfig);

    // 2. Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    console.log("Firebase initialized successfully");

    // 3. Connection monitoring
    const connectedRef = database.ref(".info/connected");
    connectedRef.on("value", (snap) => {
      const status = snap.val() ? "CONNECTED" : "DISCONNECTED";
      console.log("Firebase connection:", status);
      document.getElementById("connection-status").textContent = status;
    });

    return database;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    document.getElementById("firebase-error").innerHTML = `
      <strong>Configuration Error</strong><br>
      ${error.message}<br><br>
      Please refresh the page or contact support.
    `;
    document.getElementById("firebase-error").style.display = "block";
    throw error;
  }
}

// Main Game Implementation
try {
  // Initialize Firebase
  const database = initializeFirebase();

  // Game State
  let roomId;
  let playerId = 'player_' + Math.random().toString(36).substr(2, 9);
  let playerScore = 0;
  let opponentScore = 0;
  let isPlayer1 = false;
  let roomRef;
  let currentRound = 0;

  // UI Elements
  const elements = {
    setup: document.getElementById("setup"),
    waiting: document.getElementById("waiting"),
    game: document.getElementById("game"),
    roomIdInput: document.getElementById("roomId"),
    playerScore: document.getElementById("player-score"),
    opponentScore: document.getElementById("opponent-score"),
    playerChoice: document.getElementById("player-choice"),
    opponentChoice: document.getElementById("opponent-choice"),
    result: document.getElementById("result")
  };

  // Emoji mappings
  const emojis = {
    rock: "✊",
    paper: "✋",
    scissors: "✌️"
  };

  // Room Management
  function createRoom() {
    roomId = Math.random().toString(36).substr(2, 4).toUpperCase();
    elements.roomIdInput.value = roomId;
    joinRoom();
  }

  function joinRoom() {
    roomId = elements.roomIdInput.value.trim().toUpperCase();
    if (!roomId || roomId.length !== 4) {
      alert("Please enter a valid 4-character room ID");
      return;
    }

    // UI State
    elements.setup.style.display = "none";
    elements.waiting.style.display = "block";

    // Database Reference
    roomRef = database.ref(`rooms/${roomId}`);

    // Room transaction
    roomRef.transaction((currentData) => {
      if (currentData === null) {
        // Create new room as player1
        isPlayer1 = true;
        return {
          player1: {
            id: playerId,
            move: null,
            timestamp: firebase.database.ServerValue.TIMESTAMP
          },
          player2: null,
          round: 0,
          scores: { player1: 0, player2: 0 },
          lastUpdated: firebase.database.ServerValue.TIMESTAMP
        };
      } else {
        // Join existing room
        if (currentData.player2 && currentData.player2.id) {
          throw new Error("Room is full! Try another room.");
        }
        if (currentData.player1.id === playerId) {
          isPlayer1 = true;
          return; // Already in room
        }
        currentData.player2 = {
          id: playerId,
          move: null,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        currentData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;
        return currentData;
      }
    }, (error, committed) => {
      if (error) {
        handleRoomError(error);
      } else if (!committed) {
        handleRoomError(new Error("Failed to join room"));
      } else {
        setupRoomListener();
      }
    });
  }

  function setupRoomListener() {
    roomRef.on("value", (snapshot) => {
      const room = snapshot.val();
      if (!room) {
        alert("Room was deleted");
        location.reload();
        return;
      }

      // Check if both players are present
      if (room.player1 && room.player2) {
        elements.waiting.style.display = "none";
        elements.game.style.display = "block";

        // Update scores
        playerScore = isPlayer1 ? room.scores.player1 : room.scores.player2;
        opponentScore = isPlayer1 ? room.scores.player2 : room.scores.player1;
        updateScores();

        // Handle moves
        if (room.player1.move && room.player2.move && room.round > currentRound) {
          currentRound = room.round;
          showResults(room.player1.move, room.player2.move);
        } else {
          elements.playerChoice.textContent = 
            (isPlayer1 ? room.player1.move : room.player2.move) ? "✓" : "?";
          elements.opponentChoice.textContent = "?";
        }
      }
    });
  }

  // Game Logic
  function playMove(move) {
    const path = isPlayer1 ? "player1/move" : "player2/move";
    roomRef.update({
      [path]: move,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });

    elements.playerChoice.textContent = "✓";

    // Start new round if both players moved
    roomRef.once("value").then((snapshot) => {
      const room = snapshot.val();
      if (room.player1.move && room.player2.move && room.round === currentRound) {
        roomRef.update({
          round: currentRound + 1,
          lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });
      }
    });
  }

  function showResults(p1Move, p2Move) {
    elements.playerChoice.textContent = emojis[p1Move];
    elements.opponentChoice.textContent = emojis[p2Move];

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
        player2: isPlayer1 ? opponentScore : playerScore
      },
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });

    // Reset moves after 3 seconds
    setTimeout(() => {
      roomRef.update({
        "player1/move": null,
        "player2/move": null,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP
      });
      elements.result.textContent = "";
    }, 3000);
  }

  function updateScores() {
    elements.playerScore.textContent = playerScore;
    elements.opponentScore.textContent = opponentScore;
  }

  function handleRoomError(error) {
    console.error("Room error:", error);
    elements.setup.style.display = "block";
    elements.waiting.style.display = "none";
    alert(error.message || "Error accessing room. Please try again.");
  }

  // Expose functions to HTML
  window.createRoom = createRoom;
  window.joinRoom = joinRoom;
  window.playMove = playMove;

} catch (error) {
  console.error("Game initialization failed:", error);
  document.getElementById("firebase-error").innerHTML = `
    <strong>Fatal Error</strong><br>
    ${error.message}<br><br>
    Please refresh the page. If the problem persists, contact support.
  `;
  document.getElementById("firebase-error").style.display = "block";
}