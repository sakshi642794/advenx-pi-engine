const stateEnum = require("./state");
const gameState = require("../models/gameState");
const timer = require("./timer");
const config = require("../config/config");
const { sendEvent } = require("../communication/eventSender");

class GameEngine {
  constructor() {
    this.updateCallback = null;
  }

  // -------------------------
  // HOOK
  // -------------------------
  onUpdate(cb) {
    this.updateCallback = cb;
  }

  emitUpdate() {
    if (this.updateCallback) {
      this.updateCallback({ ...gameState });
    }
  }

  // -------------------------
  // ROUND START
  // -------------------------
  startRound() {
    console.log("ROUND STARTED");

    gameState.state = stateEnum.ROUND_RUNNING;
    gameState.roundRemaining = config.ROUND_TIME;
    gameState.roundTotal = config.ROUND_TIME;

    const duration = gameState.roundRemaining;
    const endTime = Date.now() + duration * 1000;

    this.emitUpdate();

    timer.start("round", duration, () => {
      console.log("ROUND TIMER FINISHED");
      this.endRound("DEFENDER_WIN_TIME");
    }, (remaining) => {
      gameState.roundRemaining = remaining;
      this.emitUpdate();
    });

    // send once (frontend calculates timer)
    sendEvent("round_started", { endTime });

    // optional sync (multi-screen accuracy)
    sendEvent("sync", { serverTime: Date.now() });
  }

  // -------------------------
  // PLANT FLOW
  // -------------------------
  startPlant() {
    console.log("PLANTING STARTED");

    gameState.state = stateEnum.PLANTING;
    this.emitUpdate();

    const duration = config.PLANT_TIME;
    const endTime = Date.now() + duration * 1000;

    timer.start("plant", duration, () => {
      this.completePlant();
    });

    sendEvent("spike_planting", { endTime });
  }

  cancelPlant() {
    console.log("PLANTING CANCELLED");

    gameState.state = stateEnum.ROUND_RUNNING;
    gameState.spikeRemaining = null;
    this.emitUpdate();

    timer.stop("plant");

    sendEvent("plant_canceled");
  }

  completePlant() {
    console.log("SPIKE PLANTED");

    gameState.state = stateEnum.SPIKE_PLANTED;
    gameState.spikeRemaining = config.SPIKE_TIME;
    gameState.spikeTotal = config.SPIKE_TIME;
    this.emitUpdate();

    const duration = config.SPIKE_TIME;
    const endTime = Date.now() + duration * 1000;

    timer.start("spike", duration, () => {
      this.endRound("ATTACKER_WIN_EXPLODE");
    }, (remaining) => {
      gameState.spikeRemaining = remaining;
      this.emitUpdate();
    });

    sendEvent("spike_planted", { endTime });
  }

  // -------------------------
  // DEFUSE FLOW
  // -------------------------
  startDefuse() {
    console.log("DEFUSING STARTED");

    gameState.state = stateEnum.DEFUSING;
    gameState.defuseRemaining = config.DEFUSE_TIME;
    gameState.defuseTotal = config.DEFUSE_TIME;
    this.emitUpdate();

    const duration = config.DEFUSE_TIME;
    const endTime = Date.now() + duration * 1000;

    timer.start("defuse", duration, () => {
      this.completeDefuse();
    }, (remaining) => {
      gameState.defuseRemaining = remaining;
      this.emitUpdate();
    });

    sendEvent("defuse_start", { endTime });
  }

  cancelDefuse() {
    console.log("DEFUSE CANCELLED");

    gameState.state = stateEnum.SPIKE_PLANTED;
    gameState.defuseRemaining = null;
    this.emitUpdate();

    timer.stop("defuse");

    sendEvent("defuse_canceled");
  }

  completeDefuse() {
    console.log("SPIKE DEFUSED");

    sendEvent("defuse_success");
    this.endRound("DEFENDER_WIN_DEFUSE");
  }

  // -------------------------
  // ROUND END
  // -------------------------
  endRound(reason) {
    console.log("ROUND ENDED:", reason);

    gameState.state = stateEnum.ROUND_ENDED;
    gameState.roundRemaining = null;
    gameState.spikeRemaining = null;
    gameState.defuseRemaining = null;
    this.emitUpdate();

    timer.stopAll();

    const attackerWins = reason === "ATTACKER_WIN_EXPLODE";
    const defenderWins =
      reason === "DEFENDER_WIN_TIME" || reason === "DEFENDER_WIN_DEFUSE";

    if (attackerWins) {
      sendEvent("attackers_win", { reason });
    } else if (defenderWins) {
      sendEvent("defenders_win", { reason });
    } else {
      sendEvent("round_end", { reason });
    }
  }

  resetGame() {
    console.log("GAME RESET");

    gameState.state = stateEnum.IDLE;
    gameState.roundRemaining = null;
    gameState.spikeRemaining = null;
    gameState.defuseRemaining = null;
    gameState.roundTotal = null;
    gameState.spikeTotal = null;
    gameState.defuseTotal = null;
    this.emitUpdate();
    timer.stopAll();
  }
}

module.exports = new GameEngine();
