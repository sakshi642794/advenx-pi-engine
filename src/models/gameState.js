class GameState {
  constructor() {
    this.state = "IDLE";

    this.currentRound = 1;
    this.totalRounds = 3;
    this.attackersScore = 0;
    this.defendersScore = 0;

    this.roundRemaining = null;
    this.plantRemaining = null;
    this.spikeRemaining = null;
    this.defuseRemaining = null;

    this.roundTotal = null;
    this.plantTotal = null;
    this.spikeTotal = null;
    this.defuseTotal = null;
  }
}

module.exports = new GameState();
