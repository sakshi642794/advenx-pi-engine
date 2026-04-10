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

    const duration = gameState.roundRemaining;
    const endTime = Date.now() + duration * 1000;

    this.emitUpdate();

    timer.start("round", duration, () => {
      console.log("ROUND TIMER FINISHED");
      this.endRound("DEFENDER_WIN_TIME");
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
    this.emitUpdate();

    timer.stop("plant");
  }

  completePlant() {
    console.log("SPIKE PLANTED");

    gameState.state = stateEnum.SPIKE_PLANTED;
    this.emitUpdate();

    const duration = config.SPIKE_TIME;
    const endTime = Date.now() + duration * 1000;

    timer.start("spike", duration, () => {
      this.endRound("ATTACKER_WIN_EXPLODE");
    });

    sendEvent("spike_planted", { endTime });
  }

  // -------------------------
  // DEFUSE FLOW
  // -------------------------
  startDefuse() {
    console.log("DEFUSING STARTED");

    gameState.state = stateEnum.DEFUSING;
    this.emitUpdate();

    const duration = config.DEFUSE_TIME;
    const endTime = Date.now() + duration * 1000;

    timer.start("defuse", duration, () => {
      this.completeDefuse();
    });

    sendEvent("defusing", { endTime });
  }

  cancelDefuse() {
    console.log("DEFUSE CANCELLED");

    gameState.state = stateEnum.SPIKE_PLANTED;
    this.emitUpdate();

    timer.stop("defuse");
  }

  completeDefuse() {
    console.log("SPIKE DEFUSED");

    this.endRound("DEFENDER_WIN_DEFUSE");
  }

  // -------------------------
  // ROUND END
  // -------------------------
  endRound(reason) {
    console.log("ROUND ENDED:", reason);

    gameState.state = stateEnum.ROUND_ENDED;
    this.emitUpdate();

    timer.stopAll();

    sendEvent("round_ended", { reason });
  }
}

module.exports = new GameEngine();
