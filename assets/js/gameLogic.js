import { database } from "./firebaseConfig.js";
import elements from "./elements.js";
import { state, resetScores, resetRoundTracking } from "./state.js";

const emojis = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

const winConditions = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

let lastProcessedMovesSignature = null;

/**
 * Updates the UI to reflect the current scores of the players.
 * @param {HTMLElement} elements.playerScore - The element to display the player's score.
 * @param {HTMLElement} elements.opponentScore - The element to display the opponent's score.
 */
function updateScores() {
  if (elements.playerScore) {
    elements.playerScore.textContent = state.playerScore;
  }

  if (elements.opponentScore) {
    elements.opponentScore.textContent = state.opponentScore;
  }
}

/**
 * Updates the UI to reflect the current total rounds and ties in the game.
 *
 * @function updateGameStats
 * @memberof gameLogic
 * @returns {undefined}
 */
function updateGameStats() {
  if (elements.totalRounds) {
    elements.totalRounds.textContent = state.currentRound;
  }

  const ties = state.currentRound - (state.playerScore + state.opponentScore);
  if (elements.totalTies) {
    elements.totalTies.textContent = ties > 0 ? ties : 0;
  }
}

/**
 * Updates the UI to reflect the current enabled state of the move buttons.
 * Disables the buttons if either the current player has already made a move this round or if a move is being processed.
 *
 * @param {boolean|null} currentPlayerMove - Whether the current player has made a move this round.
 * @returns {undefined}
 */
function updateButtonState(currentPlayerMove) {
  try {
    const hasCurrentPlayerMoved = Boolean(currentPlayerMove);
    const shouldDisable = hasCurrentPlayerMoved || state.isProcessingMove;
    const buttons = [elements.rockBtn, elements.paperBtn, elements.scissorsBtn];

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

/**
 * Displays the moves made by the current player and their opponent in the game UI.
 *
 * @param {string} player1Move - The move made by Player 1.
 * @param {string} player2Move - The move made by Player 2.
 * @returns {undefined}
 */
function displayMoves(player1Move, player2Move) {
  const playerMoveToShow = state.isPlayer1 ? player1Move : player2Move;
  const opponentMoveToShow = state.isPlayer1 ? player2Move : player1Move;

  elements.playerChoice.textContent = emojis[playerMoveToShow];
  elements.opponentChoice.textContent = emojis[opponentMoveToShow];
}

/**
 * Calculates the results of the current round based on the moves made by the two players.
 * Updates the scores and displays the results in the game UI.
 *
 * @param {string} player1Move - The move made by Player 1.
 * @param {string} player2Move - The move made by Player 2.
 * @param {object} room - The room object from the Firebase Realtime Database.
 * @param {string|null} movesSignature - The signature of the moves made by the two players in this round.
 * @returns {undefined}
 */
function calculateResults(player1Move, player2Move, room, movesSignature) {
  displayMoves(player1Move, player2Move);

  const currentPlayer1Score = room.scores.player1 || 0;
  const currentPlayer2Score = room.scores.player2 || 0;

  const alreadyProcessed = !!room.resultProcessed;
  let result = "It's a tie!";
  let newPlayer1Score = currentPlayer1Score;
  let newPlayer2Score = currentPlayer2Score;

  if (player1Move !== player2Move) {
    const player1Won = winConditions[player1Move] === player2Move;

    if (!alreadyProcessed) {
      if (player1Won) {
        newPlayer1Score = currentPlayer1Score + 1;
      } else {
        newPlayer2Score = currentPlayer2Score + 1;
      }
    }

    if (player1Won) {
      result = state.isPlayer1 ? "You win! 🎉" : "Opponent wins!";
    } else {
      result = state.isPlayer1 ? "Opponent wins!" : "You win! 🎉";
    }
  }

  if (elements.result) {
    elements.result.textContent = "";
  }

  state.playerScore = state.isPlayer1 ? newPlayer1Score : newPlayer2Score;
  state.opponentScore = state.isPlayer1 ? newPlayer2Score : newPlayer1Score;

  setTimeout(() => {
    // Ensure we're still looking at the same round before updating UI
    if (movesSignature && movesSignature !== lastProcessedMovesSignature) {
      return;
    }

    if (elements.result) {
      elements.result.textContent = result;
      updateScores();
      updateGameStats();
    }

  }, 500);

  const shouldUpdateScores = state.isPlayer1 && state.roomRef && !room.resultProcessed;

  if (shouldUpdateScores) {
    state.roomRef
      .update({
        "scores/player1": newPlayer1Score,
        "scores/player2": newPlayer2Score,
        resultProcessed: true,
        lastProcessedSignature: movesSignature || null,
      })
      .then(() => {
        // console.log("Scores updated successfully by Player 1");
      })
      .catch((error) => {
        console.error("Error updating scores:", error);
      });
  } else {
    // console.log("Player 2 - scores will be updated by Player 1");
  }

  setTimeout(() => {
    if (!state.roomRef) {
      return;
    }

    const player1MoveRef = state.roomRef.child("player1/move");
    const player2MoveRef = state.roomRef.child("player2/move");

    Promise.all([
      player1MoveRef.set(null),
      player2MoveRef.set(null),
      state.roomRef.update({
        lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        resultProcessed: false,
        lastProcessedSignature: null,
      }),
    ])
      .then(() => {
        // console.log("Moves reset for next round");
        lastProcessedMovesSignature = null;
      })
      .catch((error) => {
        console.error("Error resetting moves:", error);
      });
  }, 3000);
}

/**
 * Sets up a Firebase Realtime Database listener to monitor changes to the game state in the specified room.
 * Updates the UI to reflect the current game state and handles moves made by the two players.
 * @returns {undefined}
 */
function setupRoomListener() {
  if (!state.roomRef) {
    return;
  }

  state.roomRef.on("value", (snapshot) => {
    try {
      const room = snapshot.val();
      if (!room) {
        // Room was deleted - clean up and return to home
        if (state.roomRef) {
          state.roomRef.off();
          state.roomRef = null;
        }
        
        // Reset UI to home screen
        elements.setup.style.display = "block";
        elements.waiting.style.display = "none";
        elements.game.style.display = "none";
        elements.shareRoom.style.display = "none";
        elements.resetConfirm.style.display = "none";
        elements.resetConfirm.setAttribute("hidden", "");
        
        // Reset state
        state.roomId = "";
        state.pendingResetRequest = false;
        state.lastResetResponseTimestamp = null;
        lastProcessedMovesSignature = null;
        resetScores();
        resetRoundTracking();
        
        // Clear input
        if (elements.roomIdInput) {
          elements.roomIdInput.value = "";
        }
        
        showToast("Room was deleted by the host. Returned to home.");
        return;
      }

      // Check if player 2 left (only player 1 remains)
      if (room.player1 && room.player1.id === state.playerId && (!room.player2 || !room.player2.id)) {
        // Player 1 needs to go back to waiting for opponent
        elements.shareRoom.style.display = "block";
        elements.waiting.style.display = "flex";
        elements.game.style.display = "none";
        elements.roomIdDisplay.textContent = state.roomId;
        
        // Reset local game state
        resetScores();
        resetRoundTracking();
        updateScores();
        updateGameStats();
        elements.result.textContent = "";
        elements.playerChoice.textContent = "?";
        elements.opponentChoice.textContent = "?";
        lastProcessedMovesSignature = null;
        
        showToast("Opponent left the room. Waiting for new player...");
        return;
      }

      if (!room.player1 || !room.player2 || !room.player2.id) {
        return;
      }

      elements.shareRoom.style.display = "none";
      elements.waiting.style.display = "none";
      elements.game.style.display = "flex";

      const viewerIsPlayer1 = room.player1 && room.player1.id === state.playerId;
      const viewerIsPlayer2 = room.player2 && room.player2.id === state.playerId;

      state.isPlayer1 = Boolean(viewerIsPlayer1);

      state.currentRound = room.round || 0;

      if (room.resetRequest) {
        const requesterId = room.resetRequest.playerId;
        const isRequester = requesterId === state.playerId;
        state.pendingResetRequest = isRequester;

        if (!isRequester) {
          elements.resetConfirm.style.display = "flex";
          elements.resetConfirm.removeAttribute("hidden");
        } else {
          elements.resetConfirm.style.display = "none";
          elements.resetConfirm.setAttribute("hidden", "");
        }

      } else {
        elements.resetConfirm.style.display = "none";
        elements.resetConfirm.setAttribute("hidden", "");
        state.pendingResetRequest = false;
      }

      if (room.resetResponse && room.resetResponse.status) {
        const { status, timestamp = 0, for: responseFor } = room.resetResponse;
        const alreadyHandled = timestamp === state.lastResetResponseTimestamp;

        if (!alreadyHandled) {
          state.lastResetResponseTimestamp = timestamp;
          if (status === "declined" && responseFor === state.playerId) {
            state.pendingResetRequest = false;
            showToast("Opponent declined the reset request.");
          } else if (status === "accepted") {
            state.pendingResetRequest = false;
            showToast("Game reset! Scores cleared.");
          }
        }

        if (status === "declined" && responseFor === state.playerId && state.roomRef) {
          state.roomRef
            .child("resetResponse")
            .set(null)
            .catch((error) => {
              console.error("Error clearing reset response:", error);
            });
        }
      }

      const player1Move = room.player1.move;
      const player2Move = room.player2.move;

      let currentPlayerMove;
      let opponentPlayerMove;

      if (state.isPlayer1) {
        currentPlayerMove = player1Move;
        opponentPlayerMove = player2Move;
      } else {
        currentPlayerMove = player2Move;
        opponentPlayerMove = player1Move;
      }

      state.playerScore = state.isPlayer1 ? room.scores.player1 : room.scores.player2;
      state.opponentScore = state.isPlayer1 ? room.scores.player2 : room.scores.player1;
      updateScores();
      updateGameStats();

      if (player1Move && player2Move) {
        const movesSignature = [
          player1Move,
          room.player1.timestamp || 0,
          player2Move,
          room.player2.timestamp || 0,
        ].join("|");

        if (movesSignature !== lastProcessedMovesSignature) {
          lastProcessedMovesSignature = movesSignature;
          state.lastProcessedRound = state.currentRound;
          calculateResults(player1Move, player2Move, room, movesSignature);
        } else {
          displayMoves(player1Move, player2Move);
        }
      } else {
        elements.playerChoice.textContent = currentPlayerMove ? "✓" : "?";
        elements.opponentChoice.textContent = opponentPlayerMove ? "✓" : "?";

        if (!player1Move && !player2Move) {
          elements.result.textContent = "";
          lastProcessedMovesSignature = null;
        }
      }

      updateButtonState(currentPlayerMove);
    } catch (error) {
      console.error("Listener error:", error);
    }
  });
}

/**
 * Handles errors when joining a room.
 * Logs the error to the console, resets the UI to initial state, and displays a toast notification.
 * @param {Error} error The error that occurred when joining the room.
 */
function handleRoomError(error) {
  console.error("Room error:", error);
  
  // Reset UI to initial state
  elements.setup.style.display = "block";
  elements.waiting.style.display = "none";
  elements.game.style.display = "none";
  elements.shareRoom.style.display = "none";
  elements.resetConfirm.style.display = "none";
  elements.resetConfirm.setAttribute("hidden", "");
  
  // Clean up room reference if exists
  if (state.roomRef) {
    state.roomRef.off();
    state.roomRef = null;
  }
  
  // Reset state
  state.roomId = "";
  state.pendingResetRequest = false;
  state.lastResetResponseTimestamp = null;
  
  // Clear input field
  if (elements.roomIdInput) {
    elements.roomIdInput.value = "";
  }
  
  // Show error message via toast
  showToast(error.message || "Error joining room. Please try again.");
}

/**
 * Displays a toast notification with the given message.
 * The notification is displayed for 2.5 seconds and then
 * fades out over 0.3 seconds.
 * If the toast element is not present in the DOM, no
 * action is taken.
 *
 * @param {string} message - The message to display in the toast notification.
 */
function showToast(message) {
  if (!elements.toast) {
    return;
  }

  elements.toast.textContent = message;
  elements.toast.hidden = false;
  elements.toast.classList.add("show");

  setTimeout(() => {
    elements.toast.classList.remove("show");
    setTimeout(() => {
      elements.toast.hidden = true;
      elements.toast.textContent = "";
    }, 300);
  }, 2500);
}

/**
 * Copies the room ID to the user's clipboard.
 *
 * If the browser supports the Clipboard API, it will be used to copy the room ID.
 * Otherwise, a fallback method involving creating a hidden textarea and selecting its contents will be used.
 *
 * If the copy operation fails, an error will be logged to the console.
 * Additionally, a toast notification will be displayed to the user, prompting them to copy the room ID manually if necessary.
 */
export function copyRoomId() {
  if (!state.roomId) {
    return;
  }

  const textToCopy = state.roomId;

/**
 * Handles the success case of copying the room ID to the clipboard.
 * Displays a toast notification with the message "Room ID copied to clipboard.".
 */
  const handleSuccess = () => {
    showToast("Room ID copied to clipboard.");
  };

/**
 * Handles the failure case of copying the room ID to the clipboard.
 * Displays a toast notification with the message "Unable to copy automatically. Please copy it manually.".
 * @param {Error} error - The error that occurred when copying the room ID.
 */
  const handleFailure = (error) => {
    // console.error("Failed to copy room ID:", error);
    showToast("Unable to copy automatically. Please copy it manually.");
  };

/**
 * Fallback method for copying the room ID to the clipboard.
 * Creates a hidden textarea element, sets its value to the room ID, selects its contents, and then uses the document.execCommand("copy") method to copy the room ID to the clipboard.
 * If the copy operation fails, an error will be logged to the console.
 * Additionally, a toast notification will be displayed to the user, prompting them to copy the room ID manually if necessary.
 */
  const fallbackCopy = () => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);

      const selection = document.getSelection();
      const originalRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      textarea.select();
      const succeeded = document.execCommand("copy");

      if (originalRange && selection) {
        selection.removeAllRanges();
        selection.addRange(originalRange);
      }

      document.body.removeChild(textarea);

      if (succeeded) {
        handleSuccess();
      } else {
        handleFailure(new Error("execCommand returned false"));
      }
    } catch (error) {
      handleFailure(error);
    }
  };

  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    navigator.clipboard.writeText(textToCopy).then(handleSuccess).catch((error) => {
      // Some browsers require secure contexts; try fallback if direct copy fails
      fallbackCopy();
      if (error) {
        console.warn("Clipboard API failed, used fallback copy.", error);
      }
    });
  } else {
    fallbackCopy();
  }
}

/**
 * Generates a new room ID and joins the room.
 * This function generates a new 4-character room ID and updates the UI to display the room ID.
 * It then calls the joinRoom function to join the room with the new room ID.
 */
export function createRoom() {
  state.roomId = Math.random().toString(36).slice(2, 6).toUpperCase();
  elements.roomIdInput.value = state.roomId;
  elements.shareRoom.style.display = "block";
  elements.roomIdDisplay.textContent = state.roomId;
  joinRoom();
}

export function joinRoom() {
  state.roomId = elements.roomIdInput.value.trim().toUpperCase();
  if (!state.roomId || state.roomId.length !== 4) {
    alert("Please enter a valid 4-character room ID");
    return;
  }

  elements.setup.style.display = "none";
  elements.waiting.style.display = "flex";
  elements.resetConfirm.style.display = "none";
  elements.resetConfirm.setAttribute("hidden", "");
  elements.shareRoom.style.display = "none";

  state.pendingResetRequest = false;
  state.lastResetResponseTimestamp = null;
  lastProcessedMovesSignature = null;
  state.roomRef = database.ref(`rooms/${state.roomId}`);

  state.roomRef.transaction(
    (currentData) => {
      if (!currentData) {
        state.isPlayer1 = true;
        elements.shareRoom.style.display = "block";
        elements.roomIdDisplay.textContent = state.roomId;
        return {
          player1: {
            id: state.playerId,
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
          resetResponse: null,
          resultProcessed: false,
          lastProcessedSignature: null,
        };
      }

      // Room is full - abort transaction
      if (currentData.player2 && currentData.player2.id) {
        return; // Abort transaction by returning undefined
      }

      if (currentData.player1.id === state.playerId) {
        state.isPlayer1 = true;
        return;
      }

      currentData.player2 = {
        id: state.playerId,
        move: null,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      };
      currentData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;
      return currentData;
    },
    (error, committed, snapshot) => {
      if (error) {
        handleRoomError(error);
        return;
      }

      if (!committed) {
        // Check if room is full
        const data = snapshot.val();
        if (data && data.player2 && data.player2.id) {
          handleRoomError(new Error("Room is full! Please try another room."));
        } else {
          handleRoomError(new Error("Failed to join room. Please try again."));
        }
        return;
      }

      setupRoomListener();
    }
  );
}

export function playMove(move) {
  if (state.isProcessingMove) {
    // console.log("Already processing a move - ignoring");
    return;
  }

  const btn = elements[`${move}Btn`];
  if (btn && btn.disabled) {
    // console.log("Button is disabled - ignoring move");
    return;
  }

  state.isProcessingMove = true;
  updateButtonState(true);
  elements.playerChoice.textContent = "✓";

  if (!state.roomRef) {
    console.error("Room reference is missing");
    state.isProcessingMove = false;
    updateButtonState(false);
    return;
  }

  state.roomRef
    .once("value")
    .then((snapshot) => {
      const room = snapshot.val();
      if (!room) {
        throw new Error("Room not found");
      }

      const isStillPlayer1 = room.player1 && room.player1.id === state.playerId;
      const isStillPlayer2 = room.player2 && room.player2.id === state.playerId;

      if (!isStillPlayer1 && !isStillPlayer2) {
        throw new Error("You're no longer in this room. Please refresh.");
      }

      const playerPath = isStillPlayer1 ? "player1" : "player2";
      if (room[playerPath].move) {
        // console.log("Move already submitted for this round");
        state.isProcessingMove = false;
        return Promise.resolve();
      }

      return state.roomRef.child(playerPath).transaction((playerData) => {
        if (!playerData) return playerData;

        if (!playerData.move) {
          playerData.move = move;
          playerData.timestamp = firebase.database.ServerValue.TIMESTAMP;
        }
        return playerData;
      })
        .then((result) => {
          if (!result.committed) {
            throw new Error("Failed to submit move");
          }

        //   console.log("Move submitted successfully");

          return state.roomRef.update({
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
          });
        })
        .then(() => state.roomRef.once("value"))
        .then((updatedSnapshot) => {
          const updatedRoom = updatedSnapshot.val();
          if (updatedRoom.player1.move && updatedRoom.player2.move) {
            // console.log("Both players moved - attempting to advance round");
            const currentRoundValue = room.round;
            return state.roomRef
              .child("round")
              .transaction((roundValue) => {
                if (typeof roundValue !== "number") {
                  return roundValue;
                }

                if (roundValue === currentRoundValue) {
                  return roundValue + 1;
                }

                return roundValue;
              })
              .then((result) => {
                if (result.committed && result.snapshot.val() === currentRoundValue + 1) {
                  // console.log(`Round advanced to ${result.snapshot.val()}`);
                  return state.roomRef.update({
                    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
                  });
                }

                // console.log("Round already advanced by another client - skipping increment");
                return null;
              });
          }

          return null;
        });
    })
    .finally(() => {
      state.isProcessingMove = false;
    })
    .catch((error) => {
      console.error("Move error:", error);
      alert(error.message || "Error submitting move. Please try again.");
      state.isProcessingMove = false;
      updateButtonState(false);
      elements.playerChoice.textContent = "?";
    });
}

export function requestReset() {
  if (!state.roomRef) {
    return;
  }

  state.pendingResetRequest = true;
  state.lastResetResponseTimestamp = null;

  const resetRequestPayload = {
    playerId: state.playerId,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
  };

  Promise.all([
    state.roomRef.child("resetRequest").set(resetRequestPayload),
    state.roomRef.child("resetResponse").set(null),
  ])
    .then(() =>
      state.roomRef.update({
        lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      })
    )
    .catch((error) => {
      console.error("Error requesting reset:", error);
      alert("Error requesting reset. Please try again.");
      state.pendingResetRequest = false;
    });
}

export function confirmReset(accept) {
  if (!state.roomRef) {
    return;
  }

  elements.resetConfirm.style.display = "none";
  elements.resetConfirm.setAttribute("hidden", "");

  if (accept) {
    resetScores();
    resetRoundTracking();
    updateScores();
    updateGameStats();

    lastProcessedMovesSignature = null;
    state.pendingResetRequest = false;
    state.lastResetResponseTimestamp = null;

    const resetData = {
      scores: { player1: 0, player2: 0 },
      resetRequest: null,
      round: 0,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      resultProcessed: false,
      lastProcessedSignature: null,
      resetResponse: null,
    };

    Promise.all([
      state.roomRef.child("player1/move").set(null),
      state.roomRef.child("player2/move").set(null),
      state.roomRef.update(resetData),
    ])
      .then(() => {
        elements.result.textContent = "";
        elements.playerChoice.textContent = "?";
        elements.opponentChoice.textContent = "?";
        updateButtonState(false);
        return state.roomRef.child("resetResponse").set({
          status: "accepted",
          by: state.playerId,
          timestamp: firebase.database.ServerValue.TIMESTAMP,
        });
      })
      .then(() => {
        setTimeout(() => {
          if (!state.roomRef) {
            return;
          }

          state.roomRef
            .child("resetResponse")
            .set(null)
            .catch((error) => {
              console.error("Error clearing reset response:", error);
            });
        }, 3000);
      })
      .catch((error) => {
        console.error("Error resetting game:", error);
        alert("Error resetting game. Please try again.");
      });

    return;
  }

  state.roomRef
    .child("resetRequest")
    .once("value")
    .then((snapshot) => {
      const currentRequest = snapshot.val();
      const requesterId = currentRequest && currentRequest.playerId ? currentRequest.playerId : null;

      return Promise.all([
        state.roomRef.child("resetRequest").set(null),
        state.roomRef.child("resetResponse").set({
          status: "declined",
          by: state.playerId,
          for: requesterId,
          timestamp: firebase.database.ServerValue.TIMESTAMP,
        }),
        state.roomRef.update({
          lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        }),
      ]);
    })
    .catch((error) => {
      console.error("Error declining reset:", error);
    });
}

/**
 * Removes the current player from the room and resets the opponent to waiting state.
 * This is called when a player leaves/refreshes the page.
 */
async function leaveRoom() {
  if (!state.roomRef || !state.roomId) {
    return;
  }

  try {
    const snapshot = await state.roomRef.once("value");
    const room = snapshot.val();
    
    if (!room) {
      return;
    }

    const isPlayer1 = room.player1 && room.player1.id === state.playerId;
    const isPlayer2 = room.player2 && room.player2.id === state.playerId;

    if (isPlayer1) {
      // Player 1 (host) is leaving - delete the entire room
      await state.roomRef.remove();
      console.log("Player 1 left - room deleted");
    } else if (isPlayer2) {
      // Player 2 is leaving - reset their slot and clear game state
      await Promise.all([
        state.roomRef.child("player2").set({
          id: null,
          move: null,
          timestamp: null,
        }),
        state.roomRef.child("player1/move").set(null),
        state.roomRef.update({
          round: 0,
          scores: { player1: 0, player2: 0 },
          resetRequest: null,
          resetResponse: null,
          resultProcessed: false,
          lastProcessedSignature: null,
          lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        }),
      ]);
      console.log("Player 2 left - room reset for player 1");
    }

    // Clean up local state
    state.roomRef.off();
    state.roomRef = null;
    state.roomId = "";
    state.pendingResetRequest = false;
    state.lastResetResponseTimestamp = null;
    lastProcessedMovesSignature = null;
  } catch (error) {
    console.error("Error leaving room:", error);
  }
}

/**
 * Sets up beforeunload event to confirm if user wants to leave the game.
 */
function setupBeforeUnloadHandler() {
  window.addEventListener("beforeunload", (event) => {
    // Only show confirmation if user is in an active game
    if (state.roomRef && state.roomId && elements.game.style.display === "flex") {
      // Prevent the default behavior
      event.preventDefault();
      // Chrome requires returnValue to be set
      event.returnValue = "";
      // Note: Modern browsers show their own generic message like:
      // "Leave site? Changes you made may not be saved" or
      // "Reload site? Changes that you made may not be saved"
    }
  });

  // Handle actual page unload - synchronous cleanup
  window.addEventListener("unload", () => {
    if (state.roomRef && state.roomId) {
      leaveRoom();
    }
  });

  // Better alternative: use pagehide event (more reliable)
  window.addEventListener("pagehide", () => {
    if (state.roomRef && state.roomId) {
      leaveRoom();
    }
  });
}

// Initialize beforeunload handler
setupBeforeUnloadHandler();