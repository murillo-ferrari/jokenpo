// In main.js, update the initialization code:
function initGame() {
  try {
    verifyDOM();
    initPlayer();

    // Create game object
    const game = {
      createRoom: RoomManager.createRoom,
      joinRoom: RoomManager.joinRoom,
      playMove: GameLogic.playMove,
      requestReset: UIController.requestReset,
      confirmReset: UIController.confirmReset,
    };

    // Make game object available globally for debugging
    window.game = game;

    // Add event listeners - make sure elements exist first
    if (elements.createRoomBtn) {
      elements.createRoomBtn.addEventListener("click", game.createRoom);
    }

    if (elements.joinRoomBtn) {
      elements.joinRoomBtn.addEventListener("click", game.joinRoom);
    }

    // Add game button listeners - IMPORTANT: Use the correct IDs
    if (elements.rockBtn) {
      elements.rockBtn.addEventListener("click", () => game.playMove("rock"));
      console.log("Rock button listener added"); // Debug log
    }
    if (elements.paperBtn) {
      elements.paperBtn.addEventListener("click", () => game.playMove("paper"));
      console.log("Paper button listener added"); // Debug log
    }
    if (elements.scissorsBtn) {
      elements.scissorsBtn.addEventListener("click", () =>
        game.playMove("scissors")
      );
      console.log("Scissors button listener added"); // Debug log
    }

    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Initialization error:", error);
  }
}