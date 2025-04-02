// Bulletproof configuration loader
function loadFirebaseConfig() {
  const injectedConfig = "@@FIREBASE_CONFIG@@";

  try {
    console.log("Raw injected config:", injectedConfig);

    // Verify injection occurred
    if (injectedConfig === "@@FIREBASE_CONFIG@@") {
      throw new Error("Configuration not injected - placeholder remains");
    }

    // Clean and decode
    const cleanConfig = injectedConfig.trim();
    const decoded = atob(cleanConfig);
    console.log("Decoded config:", decoded);

    const config = JSON.parse(decoded);

    // Verify required fields with better error messages
    const requiredFields = {
      apiKey: "API Key",
      authDomain: "Auth Domain",
      databaseURL: "Database URL",
      projectId: "Project ID",
    };

    for (const [field, name] of Object.entries(requiredFields)) {
      if (!config[field]) {
        throw new Error(
          `Configuration error: Missing ${name} in Firebase config`
        );
      }
    }

    return config;
  } catch (error) {
    console.error("Configuration Error Details:", {
      error: error.message,
      receivedConfig: injectedConfig,
      decodedConfig:
        injectedConfig !== "@@FIREBASE_CONFIG@@"
          ? atob(injectedConfig.trim())
          : "Not decoded",
      isPlaceholder: injectedConfig === "@@FIREBASE_CONFIG@@",
    });
    throw error;
  }
}

// Main initialization
try {
  // 1. Load config
  const firebaseConfig = loadFirebaseConfig();

  // 2. Initialize Firebase
  const app = firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  console.log("Firebase initialized with config:", {
    apiKey: firebaseConfig.apiKey ? "***REDACTED***" : "MISSING",
    authDomain: firebaseConfig.authDomain,
    databaseURL: firebaseConfig.databaseURL,
  });

  // Game state variables
  let roomId;
  let playerId = Math.random().toString(36).substring(2, 15);
  let playerScore = 0;
  let opponentScore = 0;
  let isPlayer1 = false;
  let roomRef;
  let currentRound = 0;

  // Emoji mappings
  const emojis = {
    rock: "✊",
    paper: "✋",
    scissors: "✌️",
  };

  function createRoom() {
    roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    document.getElementById("roomId").value = roomId;

    const roomDisplay = document.createElement("div");
    roomDisplay.id = "room-display";
    roomDisplay.className = "room-display";
    roomDisplay.textContent = `Room created! Share this ID with your friend: ${roomId}`;

    const setupDiv = document.getElementById("setup");
    setupDiv.appendChild(roomDisplay);

    joinRoom();
  }

  function joinRoom() {
    roomId = document.getElementById("roomId").value.trim();
    if (!roomId) {
      alert("Please enter a room ID");
      return;
    }

    document.getElementById("setup").style.display = "none";
    document.getElementById("waiting").style.display = "block";

    roomRef = database.ref(`rooms/${roomId}`);

    roomRef
      .once("value")
      .then((snapshot) => {
        if (!snapshot.exists()) {
          isPlayer1 = true;
          return roomRef.set({
            player1: { id: playerId, move: null },
            player2: { id: null, move: null },
            round: 0,
            scores: { player1: 0, player2: 0 },
            resetRequest: null,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
          });
        } else {
          const room = snapshot.val();
          if (room.player2 && room.player2.id) {
            const messageContainer = document.getElementById("message-container");
            messageContainer.textContent = "Room is full! Please try another room.";
            messageContainer.style.display = "block";
            return;
          }
          return roomRef.update({
            "player2/id": playerId,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
          });
        }
      })
      .then(() => {
        roomRef.on("value", (snapshot) => {
          const room = snapshot.val();
          if (!room) return;

          if (
            room.player1 &&
            room.player1.id &&
            room.player2 &&
            room.player2.id
          ) {
            document.getElementById("waiting").style.display = "none";
            document.getElementById("game").style.display = "block";

            if (room.scores) {
              playerScore = isPlayer1
                ? room.scores.player1
                : room.scores.player2;
              opponentScore = isPlayer1
                ? room.scores.player2
                : room.scores.player1;
              updateScores();
            }

            if (room.resetRequest) {
              if (room.resetRequest.playerId !== playerId) {
                document.getElementById("reset-confirm").style.display =
                  "block";
              }
            } else {
              document.getElementById("reset-confirm").style.display = "none";
            }

            if (
              room.player1.move &&
              room.player2.move &&
              room.round > currentRound
            ) {
              currentRound = room.round;
              showResults(room.player1, room.player2);
            } else {
              document.getElementById("player-choice").textContent = (
                isPlayer1 ? room.player1.move : room.player2.move
              )
                ? "✓"
                : "?";
              document.getElementById("opponent-choice").textContent = "?";
              document.getElementById("result").textContent =
                room.player1.move && room.player2.move ? "Calculating..." : "";
            }
          }
        });
      })
      .catch((error) => {
        console.error("Database error:", error);
        alert("Error joining room. Please try again.");
        location.reload();
      });
  }

  function playMove(move) {
    const path = isPlayer1 ? "player1/move" : "player2/move";
    roomRef.update({
      [path]: move,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });

    document.getElementById("player-choice").textContent = "✓";

    roomRef.once("value").then((snapshot) => {
      const room = snapshot.val();
      if (room.player1.move && room.player2.move && !room.round) {
        roomRef.update({
          round: 1,
        });
      }
    });
  }

  function showResults(player1, player2) {
    const p1Move = player1.move;
    const p2Move = player2.move;

    document.getElementById("player-choice").textContent = emojis[p1Move];
    document.getElementById("opponent-choice").textContent = emojis[p2Move];

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

    document.getElementById("result").textContent = result;
    updateScores();

    roomRef.update({
      scores: {
        player1: isPlayer1 ? playerScore : opponentScore,
        player2: isPlayer1 ? opponentScore : playerScore,
      },
    });

    setTimeout(() => {
      roomRef.update({
        "player1/move": null,
        "player2/move": null,
        round: 0,
        result: null,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      });
      document.getElementById("result").textContent = "";
      document.getElementById("player-choice").textContent = "?";
      document.getElementById("opponent-choice").textContent = "?";
    }, 3000);
  }

  function updateScores() {
    document.getElementById("player-score").textContent = playerScore;
    document.getElementById("opponent-score").textContent = opponentScore;
  }

  function requestReset() {
    roomRef.update({
      resetRequest: {
        playerId: playerId,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      },
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
        result: null,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      });
    } else {
      roomRef.update({
        resetRequest: null,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      });
    }
    document.getElementById("reset-confirm").style.display = "none";
  }

  // Make functions available globally
  window.createRoom = createRoom;
  window.joinRoom = joinRoom;
  window.playMove = playMove;
  window.requestReset = requestReset;
  window.confirmReset = confirmReset;
} catch (error) {
  console.error("FATAL INIT ERROR:", error);
  document.getElementById("firebase-error").innerHTML = `
            <strong>Configuration Error</strong><br>
            Failed to initialize game services.<br><br>
            <strong>Technical Details:</strong><br>
            ${error.message}<br><br>
            <strong>Please try:</strong><br>
            1. Hard refresh (Ctrl+F5)<br>
            2. Check browser console for details<br>
            3. Contact support if it persists
        `;
  document.getElementById("firebase-error").style.display = "block";
}
