class GameState {
  constructor() {
    this.state = "IDLE";

    this.roundRemaining = null;
    this.spikeRemaining = null;
    this.defuseRemaining = null;

    this.roundTotal = null;
    this.spikeTotal = null;
    this.defuseTotal = null;
  }
}

module.exports = new GameState();
