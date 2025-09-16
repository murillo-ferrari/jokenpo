/**
 * Room Module
 * Handles room creation, joining, and Firebase operations
 */
const RoomModule = (() => {
  // Private variables
  let roomId = null;
  let playerId = null;
  let isPlayer1 = false;
  let roomRef = null;
  let roomListener = null;

  // Event callbacks
  const callbacks = {
    onRoomJoined: null,
    onRoomFull: null,
    onRoomError: null,
    onRoomUpdate: null,
    onPlayerDisconnected: null
  };

  /**
   * Initialize room module
   */
  const initialize = () => {
    playerId = Config.generatePlayerId();
    console.log('Room module initialized with player ID:', playerId);
  };

  /**
   * Create a new room
   */
  const createRoom = async () => {
    try {
      roomId = Config.generateRoomId();
      isPlayer1 = true;
      
      console.log('Creating room:', roomId);
      
      // Return room ID for UI to display
      return {
        success: true,
        roomId: roomId,
        isCreator: true
      };
    } catch (error) {
      console.error('Error creating room:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Join an existing room
   */
  const joinRoom = async (inputRoomId) => {
    try {
      const trimmedRoomId = inputRoomId.trim().toUpperCase();
      
      if (!Config.isValidRoomId(trimmedRoomId)) {
        throw new Error('Please enter a valid 4-character room ID');
      }

      roomId = trimmedRoomId;
      roomRef = Config.getDatabase().ref(`rooms/${roomId}`);

      return new Promise((resolve, reject) => {
        roomRef.transaction(
          (currentData) => {
            if (!currentData) {
              // First player creates the room
              isPlayer1 = true;
              return {
                player1: {
                  id: playerId,
                  move: null,
                  timestamp: Config.getServerTimestamp(),
                },
                player2: {
                  id: null,
                  move: null,
                  timestamp: null,
                },
                round: 0,
                scores: { player1: 0, player2: 0 },
                resetRequest: null,
                lastUpdated: Config.getServerTimestamp(),
              };
            }

            // Check if room is full
            if (currentData.player2 && currentData.player2.id) {
              throw new Error('Room is full! Please try another room.');
            }

            // Check if same player rejoining
            if (currentData.player1.id === playerId) {
              isPlayer1 = true;
              return; // No update needed
            }

            // Join as player 2
            isPlayer1 = false;
            currentData.player2 = {
              id: playerId,
              move: null,
              timestamp: Config.getServerTimestamp(),
            };
            currentData.lastUpdated = Config.getServerTimestamp();
            return currentData;
          },
          (error, committed) => {
            if (error) {
              console.error('Transaction error:', error);
              reject(error);
              return;
            }

            if (!committed) {
              reject(new Error('Failed to join room'));
              return;
            }

            // Setup room listener
            setupRoomListener();
            
            resolve({
              success: true,
              roomId: roomId,
              isPlayer1: isPlayer1,
              isCreator: isPlayer1
            });
          }
        );
      });
    } catch (error) {
      console.error('Error joining room:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Setup room listener for real-time updates
   */
  const setupRoomListener = () => {
    if (!roomRef) return;

    // Remove existing listener
    if (roomListener) {
      roomRef.off('value', roomListener);
    }

    roomListener = (snapshot) => {
      try {
        const room = snapshot.val();
        
        if (!room) {
          if (callbacks.onRoomError) {
            callbacks.onRoomError(new Error('Room was deleted by the host'));
          }
          return;
        }

        // Notify about room updates
        if (callbacks.onRoomUpdate) {
          callbacks.onRoomUpdate({
            room: room,
            isPlayer1: isPlayer1,
            playerId: playerId
          });
        }

        // Check if room is full
        if (room.player1 && room.player2 && room.player2.id) {
          if (callbacks.onRoomFull) {
            callbacks.onRoomFull();
          }
        }

      } catch (error) {
        console.error('Room listener error:', error);
        if (callbacks.onRoomError) {
          callbacks.onRoomError(error);
        }
      }
    };

    roomRef.on('value', roomListener);
  };

  /**
   * Submit player move
   */
  const submitMove = async (move) => {
    if (!roomRef) {
      throw new Error('Not connected to a room');
    }

    try {
      const snapshot = await roomRef.once('value');
      const room = snapshot.val();
      
      if (!room) {
        throw new Error('Room not found');
      }

      // Verify player is still in the room
      const isStillPlayer1 = room.player1 && room.player1.id === playerId;
      const isStillPlayer2 = room.player2 && room.player2.id === playerId;

      if (!isStillPlayer1 && !isStillPlayer2) {
        throw new Error('Player not found in room');
      }

      // Submit move
      const updates = {};
      const playerPath = isStillPlayer1 ? 'player1' : 'player2';
      updates[`${playerPath}/move`] = move;
      updates['lastUpdated'] = Config.getServerTimestamp();

      await roomRef.update(updates);

      // Check if both players have moved
      const updatedSnapshot = await roomRef.once('value');
      const updatedRoom = updatedSnapshot.val();
      
      if (updatedRoom.player1.move && updatedRoom.player2.move) {
        // Advance round
        await roomRef.update({
          round: updatedRoom.round + 1,
          lastUpdated: Config.getServerTimestamp(),
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error submitting move:', error);
      throw error;
    }
  };

  /**
   * Update room scores
   */
  const updateScores = async (player1Score, player2Score) => {
    if (!roomRef) return;

    try {
      await roomRef.update({
        scores: {
          player1: player1Score,
          player2: player2Score,
        },
        lastUpdated: Config.getServerTimestamp(),
      });
    } catch (error) {
      console.error('Error updating scores:', error);
      throw error;
    }
  };

  /**
   * Reset round moves
   */
  const resetRoundMoves = async () => {
    if (!roomRef) return;

    try {
      await roomRef.update({
        'player1/move': null,
        'player2/move': null,
        lastUpdated: Config.getServerTimestamp(),
      });
    } catch (error) {
      console.error('Error resetting moves:', error);
      throw error;
    }
  };

  /**
   * Request game reset
   */
  const requestReset = async () => {
    if (!roomRef) return;

    try {
      await roomRef.update({
        resetRequest: {
          playerId: playerId,
          timestamp: Config.getServerTimestamp(),
        },
        lastUpdated: Config.getServerTimestamp(),
      });
    } catch (error) {
      console.error('Error requesting reset:', error);
      throw error;
    }
  };

  /**
   * Confirm or deny reset request
   */
  const confirmReset = async (accept) => {
    if (!roomRef) return;

    try {
      if (accept) {
        await roomRef.update({
          scores: { player1: 0, player2: 0 },
          resetRequest: null,
          'player1/move': null,
          'player2/move': null,
          round: 0,
          lastUpdated: Config.getServerTimestamp(),
        });
      } else {
        await roomRef.update({
          resetRequest: null,
          lastUpdated: Config.getServerTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error confirming reset:', error);
      throw error;
    }
  };

  /**
   * Leave room and cleanup
   */
  const leaveRoom = () => {
    if (roomListener && roomRef) {
      roomRef.off('value', roomListener);
    }
    
    roomId = null;
    roomRef = null;
    roomListener = null;
    isPlayer1 = false;
  };

  /**
   * Set event callbacks
   */
  const setCallbacks = (newCallbacks) => {
    Object.assign(callbacks, newCallbacks);
  };

  /**
   * Get current room info
   */
  const getRoomInfo = () => {
    return {
      roomId,
      playerId,
      isPlayer1,
      isConnected: !!roomRef
    };
  };

  // Public API
  return {
    initialize,
    createRoom,
    joinRoom,
    submitMove,
    updateScores,
    resetRoundMoves,
    requestReset,
    confirmReset,
    leaveRoom,
    setCallbacks,
    getRoomInfo
  };
})();