// Initialize game
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
          confirmReset: UIController.confirmReset
      };
      
      // Make game object available globally for debugging
      window.game = game;
      
      // Add event listeners
      if (elements.createRoomBtn) {
          elements.createRoomBtn.addEventListener('click', game.createRoom);
      }
      
      if (elements.joinRoomBtn) {
          elements.joinRoomBtn.addEventListener('click', game.joinRoom);
      }
      
      // Add game control listeners if elements exist
      if (elements.rockBtn) {
          elements.rockBtn.addEventListener('click', () => game.playMove('rock'));
      }
      if (elements.paperBtn) {
          elements.paperBtn.addEventListener('click', () => game.playMove('paper'));
      }
      if (elements.scissorsBtn) {
          elements.scissorsBtn.addEventListener('click', () => game.playMove('scissors'));
      }
      
      // Hide game sections initially
      elements.waiting.style.display = "none";
      elements.game.style.display = "none";
      elements.resetConfirm.style.display = "none";
      
      console.log("Game initialized successfully");
  } catch (error) {
      console.error("Initialization error:", error);
      alert(`Game initialization failed: ${error.message}`);
  }
}