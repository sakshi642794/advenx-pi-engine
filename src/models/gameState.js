class GameState {
  constructor() {
    this.state = "IDLE";

    this.roundRemaining = null;
    this.spikeRemaining = null;
  }
}

module.exports = new GameState();
