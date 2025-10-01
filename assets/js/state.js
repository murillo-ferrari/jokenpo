export const state = {
  roomId: null,
  playerId: "player_" + Math.random().toString(36).slice(2, 11),
  isPlayer1: false,
  roomRef: null,
  currentRound: 0,
  playerScore: 0,
  opponentScore: 0,
  lastProcessedRound: -1,
  isProcessingMove: false,
  pendingResetRequest: false,
  lastResetResponseTimestamp: null,
};

export function resetScores() {
  state.playerScore = 0;
  state.opponentScore = 0;
}

export function resetRoundTracking() {
  state.currentRound = 0;
  state.lastProcessedRound = -1;
  state.pendingResetRequest = false;
  state.lastResetResponseTimestamp = null;
}
