// Enhanced Firebase configuration loader
function loadFirebaseConfig() {
  try {
    const rawConfig = "@@FIREBASE_CONFIG@@";
    
    if (rawConfig === "@@FIREBASE_CONFIG@@") {
      throw new Error("Firebase config not properly injected");
    }

    const cleanConfig = rawConfig.trim();
    const decoded = atob(cleanConfig);
    const config = JSON.parse(decoded);

    // Verify required fields
    const requiredFields = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required Firebase config field: ${field}`);
      }
    }

    console.log("Firebase config loaded successfully");
    return config;
  } catch (error) {
    console.error("Firebase config error:", error);
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
  console.log("Firebase initialized successfully");

  // Connection monitoring
  const connectedRef = database.ref(".info/connected");
  connectedRef.on("value", (snap) => {
    if (snap.val() === true) {
      console.log("Connected to Firebase");
    } else {
      console.warn("Lost connection to Firebase");
    }
  });

  // Game state variables
  let roomId;
  let playerId = 'player_' + Math.random().toString(36).substr(2, 9);
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
    joinRoom();
  }

  function joinRoom() {
    roomId = document.getElementById("roomId").value.trim().toUpperCase();
    if (!roomId || roomId.length !== 4) {
      alert("Please enter a valid 4-character room ID");
      return;
    }

    document.getElementById("setup").style.display = "none";
    document.getElementById("waiting").style.display = "block";

    roomRef = database.ref(`rooms/${roomId}`);

    roomRef.once("value")
      .then((snapshot) => {
        if (!snapshot.exists()) {
          // Create new room as player1
          isPlayer1 = true;
          return roomRef.set({
            player1: { 
              id: playerId, 
              move: null,
              ready: true,
              timestamp: firebase.database.ServerValue.TIMESTAMP
            },
            player2: { 
              id: null, 
              move: null,
              ready: false,
              timestamp: null 
            },
            round: 0,
            scores: { player1: 0, player2: 0 },
            resetRequest: null,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
            status: "waiting"
          });
        } else {
          // Join existing room
          const room = snapshot.val();
          
          // Check if already in room
          if (room.player1.id === playerId) {
            isPlayer1 = true;
            return roomRef.update({
              "player1/ready": true,
              "player1/timestamp": firebase.database.ServerValue.TIMESTAMP,
              lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
          }
          
          // Check if room is full
          if (room.player2 && room.player2.id) {
            throw new Error("Room is full! Please try another room.");
          }
          
          // Join as player2
          return roomRef.update({
            "player2": {
              id: playerId,
              move: null,
              ready: true,
              timestamp: firebase.database.ServerValue.TIMESTAMP
            },
            status: "ready",
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
          });
        }
      })
      .then(() => {
        setupRoomListener();
      })
      .catch((error) => {
        console.error("Room error:", error);
        document.getElementById("setup").style.display = "block";
        document.getElementById("waiting").style.display = "none";
        alert(error.message || "Error joining room. Please try again.");
      });
  }

  function setupRoomListener() {
    roomRef.on("value", (snapshot) => {
      const room = snapshot.val();
      if (!room) {
        alert("Room was deleted by the host");
        location.reload();
        return;
      }

      // Check player connection status
      const now = Date.now();
      const player1Timeout = now - (room.player1.timestamp || 0) > 30000;
      const player2Timeout = room.player2.id && now - (room.player2.timestamp || 0) > 30000;

      if (player1Timeout || player2Timeout) {
        alert("Opponent disconnected due to timeout");
        location.reload();
        return;
      }

      // Check if both players are ready
      if (room.player1.ready && room.player2 && room.player2.ready) {
        document.getElementById("waiting").style.display = "none";
        document.getElementById("game").style.display = "block";
        
        // Update scores
        if (room.scores) {
          playerScore = isPlayer1 ? room.scores.player1 : room.scores.player2;
          opponentScore = isPlayer1 ? room.scores.player2 : room.scores.player1;
          updateScores();
        }

        // Handle game round logic
        if (room.player1.move && room.player2.move && room.round > currentRound) {
          currentRound = room.round;
          showResults(room.player1, room.player2);
        } else {
          document.getElementById("player-choice").textContent = 
            (isPlayer1 ? room.player1.move : room.player2.move) ? "✓" : "?";
          document.getElementById("opponent-choice").textContent = "?";
        }
      }
    });
  }

  function playMove(move) {
    const path = isPlayer1 ? "player1/move" : "player2/move";
    roomRef.update({
      [path]: move,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });

    document.getElementById("player-choice").textContent = "✓";

    // Check if both players have moved to start a new round
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

    // Update scores in database
    roomRef.update({
      scores: {
        player1: isPlayer1 ? playerScore : opponentScore,
        player2: isPlayer1 ? opponentScore : playerScore,
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
      document.getElementById("result").textContent = "";
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
        timestamp: firebase.database.ServerValue.TIMESTAMP
      },
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
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
        lastUpdated: firebase.database.ServerValue.TIMESTAMP
      });
    } else {
      roomRef.update({
        resetRequest: null,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP
      });
    }
    document.getElementById("reset-confirm").style.display = "none";
  }

  // Expose functions to HTML
  window.createRoom = createRoom;
  window.joinRoom = joinRoom;
  window.playMove = playMove;
  window.requestReset = requestReset;
  window.confirmReset = confirmReset;

} catch (error) {
  console.error("Initialization error:", error);
  document.getElementById("firebase-error").innerHTML = `
    <strong>Initialization Error</strong><br>
    ${error.message}<br><br>
    Please try refreshing the page. If the problem persists, contact support.
  `;
  document.getElementById("firebase-error").style.display = "block";
}