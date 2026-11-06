import "./firebaseConfig.js";
import elements, { initializeButtons, verifyElements } from "./elements.js";
import {
  copyRoomId,
  createRoom,
  joinRoom,
  playMove,
  requestReset,
  confirmReset,
} from "./gameLogic.js";

verifyElements();
initializeButtons(playMove);

// Expose functions for inline event handlers
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.playMove = playMove;
window.requestReset = requestReset;
window.confirmReset = confirmReset;
window.copyRoomId = copyRoomId;

// Ensure initial UI state is consistent
if (elements.setup) {
  elements.setup.style.display = "block";
}
