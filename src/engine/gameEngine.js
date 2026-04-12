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
    if (gameState.state === stateEnum.ROUND_RUNNING) return;

    if (gameState.state === stateEnum.ROUND_ENDED) {
      gameState.currentRound = Math.min(
        gameState.currentRound + 1,
        gameState.totalRounds
      );
    }

    console.log("ROUND STARTED");

    gameState.state = stateEnum.ROUND_RUNNING;
    gameState.roundRemaining = config.ROUND_TIME;
    gameState.roundTotal = config.ROUND_TIME;
    gameState.totalRounds = config.TOTAL_ROUNDS;

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
    sendEvent("round_started", {
      endTime,
      round: gameState.currentRound,
      total_rounds: gameState.totalRounds,
      attackersScore: gameState.attackersScore,
      defendersScore: gameState.defendersScore,
    });

    // optional sync (multi-screen accuracy)
    sendEvent("sync", { serverTime: Date.now() });
  }

  // -------------------------
  // PLANT FLOW
  // -------------------------
  startPlant() {
    console.log("PLANTING STARTED");

    gameState.state = stateEnum.PLANTING;
    gameState.plantRemaining = config.PLANT_TIME;
    gameState.plantTotal = config.PLANT_TIME;
    this.emitUpdate();

    const duration = config.PLANT_TIME;
    const endTime = Date.now() + duration * 1000;

    timer.start("plant", duration, () => {
      this.completePlant();
    }, (remaining) => {
      gameState.plantRemaining = remaining;
      this.emitUpdate();
    });

    sendEvent("spike_planting", {
      endTime,
      round: gameState.currentRound,
      total_rounds: gameState.totalRounds,
      roundRemaining: gameState.roundRemaining,
      plantRemaining: gameState.plantRemaining,
      plantTotal: gameState.plantTotal,
      attackersScore: gameState.attackersScore,
      defendersScore: gameState.defendersScore,
    });
  }

  cancelPlant() {
    console.log("PLANTING CANCELLED");

    gameState.state = stateEnum.ROUND_RUNNING;
    gameState.spikeRemaining = null;
    gameState.plantRemaining = null;
    gameState.plantTotal = null;
    this.emitUpdate();

    timer.stop("plant");

    sendEvent("plant_canceled", {
      round: gameState.currentRound,
      total_rounds: gameState.totalRounds,
      roundRemaining: gameState.roundRemaining,
      plantRemaining: gameState.plantRemaining,
      plantTotal: gameState.plantTotal,
      attackersScore: gameState.attackersScore,
      defendersScore: gameState.defendersScore,
    });
  }

  startSpikeTimer(duration) {
    timer.start("spike", duration, () => {
      this.endRound("ATTACKER_WIN_EXPLODE");
    }, (remaining) => {
      gameState.spikeRemaining = remaining;
      this.emitUpdate();
    });
  }

  completePlant() {
    console.log("SPIKE PLANTED");

    gameState.state = stateEnum.SPIKE_PLANTED;
    gameState.plantRemaining = null;
    gameState.spikeRemaining = config.SPIKE_TIME;
    gameState.spikeTotal = config.SPIKE_TIME;
    this.emitUpdate();

    const duration = config.SPIKE_TIME;
    const endTime = Date.now() + duration * 1000;

    this.startSpikeTimer(duration);

    sendEvent("spike_planted", {
      endTime,
      round: gameState.currentRound,
      total_rounds: gameState.totalRounds,
      spikeRemaining: gameState.spikeRemaining,
      attackersScore: gameState.attackersScore,
      defendersScore: gameState.defendersScore,
    });
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

    // Pause spike + round timers during defuse attempt
    timer.stop("spike");
    timer.stop("round");

    timer.start("defuse", duration, () => {
      this.completeDefuse();
    }, (remaining) => {
      gameState.defuseRemaining = remaining;
      this.emitUpdate();
    });

    sendEvent("defuse_start", {
      endTime,
      round: gameState.currentRound,
      total_rounds: gameState.totalRounds,
      spikeRemaining: gameState.spikeRemaining,
      defuseRemaining: gameState.defuseRemaining,
      roundRemaining: gameState.roundRemaining,
      attackersScore: gameState.attackersScore,
      defendersScore: gameState.defendersScore,
    });
  }

  cancelDefuse() {
    console.log("DEFUSE CANCELLED");

    gameState.state = stateEnum.SPIKE_PLANTED;
    gameState.defuseRemaining = null;
    this.emitUpdate();

    timer.stop("defuse");

    const remaining = typeof gameState.spikeRemaining === "number"
      ? gameState.spikeRemaining
      : config.SPIKE_TIME;
    const endTime = Date.now() + remaining * 1000;

    this.startSpikeTimer(remaining);

    sendEvent("defuse_canceled", {
      endTime,
      round: gameState.currentRound,
      total_rounds: gameState.totalRounds,
      spikeRemaining: remaining,
      roundRemaining: gameState.roundRemaining,
      attackersScore: gameState.attackersScore,
      defendersScore: gameState.defendersScore,
    });
  }

  completeDefuse() {
    console.log("SPIKE DEFUSED");

    timer.stop("spike");
    sendEvent("defuse_success", {
      round: gameState.currentRound,
      total_rounds: gameState.totalRounds,
      roundRemaining: gameState.roundRemaining,
      spikeRemaining: gameState.spikeRemaining,
      attackersScore: gameState.attackersScore,
      defendersScore: gameState.defendersScore,
    });
    this.endRound("DEFENDER_WIN_DEFUSE");
  }

  // -------------------------
  // ROUND END
  // -------------------------
  endRound(reason) {
    console.log("ROUND ENDED:", reason);

    gameState.state = stateEnum.ROUND_ENDED;
    gameState.roundRemaining = null;
    gameState.plantRemaining = null;
    gameState.spikeRemaining = null;
    gameState.defuseRemaining = null;
    this.emitUpdate();

    timer.stopAll();

    const attackerWins = reason === "ATTACKER_WIN_EXPLODE";
    const defenderWins =
      reason === "DEFENDER_WIN_TIME" || reason === "DEFENDER_WIN_DEFUSE";

    if (attackerWins) {
      gameState.attackersScore += 1;
      sendEvent("attackers_win", {
        reason,
        round: gameState.currentRound,
        total_rounds: gameState.totalRounds,
        attackersScore: gameState.attackersScore,
        defendersScore: gameState.defendersScore,
      });
    } else if (defenderWins) {
      gameState.defendersScore += 1;
      sendEvent("defenders_win", {
        reason,
        round: gameState.currentRound,
        total_rounds: gameState.totalRounds,
        attackersScore: gameState.attackersScore,
        defendersScore: gameState.defendersScore,
      });
    } else {
      sendEvent("round_end", {
        reason,
        round: gameState.currentRound,
        total_rounds: gameState.totalRounds,
        attackersScore: gameState.attackersScore,
        defendersScore: gameState.defendersScore,
      });
    }
  }

  resetGame() {
    console.log("GAME RESET");

    gameState.state = stateEnum.IDLE;
    gameState.currentRound = 1;
    gameState.totalRounds = config.TOTAL_ROUNDS;
    gameState.attackersScore = 0;
    gameState.defendersScore = 0;
    gameState.roundRemaining = null;
    gameState.plantRemaining = null;
    gameState.spikeRemaining = null;
    gameState.defuseRemaining = null;
    gameState.roundTotal = null;
    gameState.plantTotal = null;
    gameState.spikeTotal = null;
    gameState.defuseTotal = null;
    this.emitUpdate();
    timer.stopAll();
  }
}

module.exports = new GameEngine();
