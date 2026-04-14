const { startWSServer, broadcast } = require("./communication/wsServer");
const { sendEvent } = require("./communication/eventSender");
const { startBackendWS } = require("./communication/backendWSClient");
const gameEngine = require("./engine/gameEngine");
const gameState = require("./models/gameState");
const stateEnum = require("./engine/state");
const usbWatcher = require("./hardware/usbWatcher");
const config = require("./config/config");

let attackersReady = false;
let defendersReady = false;
let roundStartTimer = null;
let lastEngineState = gameState.state;

gameState.totalRounds = config.TOTAL_ROUNDS;

function clearRoundCountdown() {
  if (roundStartTimer) {
    clearTimeout(roundStartTimer);
    roundStartTimer = null;
  }
}

function setReady(team, ready) {
  if (team === "attackers") attackersReady = ready;
  if (team === "defenders") defendersReady = ready;
  if (!ready) clearRoundCountdown();
}

function resetReadyState() {
  attackersReady = false;
  defendersReady = false;
  clearRoundCountdown();
}

function maybeStartRoundCountdown() {
  const bothReady = attackersReady && defendersReady;
  const canStart =
    gameState.state === stateEnum.IDLE || gameState.state === stateEnum.ROUND_ENDED;

  if (!bothReady || !canStart || roundStartTimer) return;

  const seconds = 3;
  const endTime = Date.now() + seconds * 1000;
  sendEvent("round_starting", { seconds, endTime });

  roundStartTimer = setTimeout(() => {
    roundStartTimer = null;
    resetReadyState();
    gameEngine.startRound();
  }, seconds * 1000);
}

function handleReadyEvent(event) {
  if (event === "attackers_ready") setReady("attackers", true);
  if (event === "defenders_ready") setReady("defenders", true);
  if (event === "attackers_not_ready") setReady("attackers", false);
  if (event === "defenders_not_ready") setReady("defenders", false);
  maybeStartRoundCountdown();
}

function handleOperatorMessage(msg) {
  if (!msg || !msg.event) return;

  switch (msg.event) {
    case "attackers_ready":
    case "defenders_ready":
      // Echo to other clients for multi-screen sync
      sendEvent(msg.event, msg.payload || {});
      handleReadyEvent(msg.event);
      return;

    case "start_game":
      resetReadyState();
      gameEngine.startRound();
      return;

    case "start_plant":
      gameEngine.startPlant();
      return;

    case "cancel_plant":
      gameEngine.cancelPlant();
      return;

    case "start_defuse":
      gameEngine.startDefuse();
      return;

    case "cancel_defuse":
      gameEngine.cancelDefuse();
      return;

    case "reset_game":
      resetReadyState();
      gameEngine.resetGame();
      sendEvent("reset_game");
      return;

    default:
      return;
  }
}

function sendInitialState(ws) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(
    JSON.stringify({
      event: "game_update",
      payload: gameState,
    })
  );
}

startWSServer(8080, undefined, handleOperatorMessage, sendInitialState);

gameEngine.onUpdate((state) => {
  broadcast({
    event: "game_update",
    payload: state,
  });

  if (state.state !== lastEngineState) {
    lastEngineState = state.state;
    if (state.state === stateEnum.ROUND_ENDED) {
      resetReadyState();
    }
  }
});

startBackendWS((msg) => {
  if (!msg || !msg.event) return;
  console.log("[BACKEND WS] event:", msg.event, "payload:", msg.payload || {});

  switch (msg.event) {
    case "attackers_ready":
    case "defenders_ready":
    case "attackers_not_ready":
    case "defenders_not_ready":
      sendEvent(msg.event, msg.payload || {});
      handleReadyEvent(msg.event);
      break;
    case "both_teams_ready":
      sendEvent("attackers_ready", {});
      sendEvent("defenders_ready", {});
      handleReadyEvent("attackers_ready");
      handleReadyEvent("defenders_ready");
      break;
    case "no_team_ready":
      sendEvent("attackers_not_ready", {});
      sendEvent("defenders_not_ready", {});
      handleReadyEvent("attackers_not_ready");
      handleReadyEvent("defenders_not_ready");
      break;
    case "teams_ready": {
      const aReady = msg.payload?.attackersReady;
      const dReady = msg.payload?.defendersReady;
      if (typeof aReady === "boolean") setReady("attackers", aReady);
      if (typeof dReady === "boolean") setReady("defenders", dReady);
      sendEvent("teams_ready", msg.payload || {});
      maybeStartRoundCountdown();
      break;
    }
    case "reset_game":
      resetReadyState();
      sendEvent("reset_game");
      break;
    default:
      break;
  }
});

usbWatcher.start();
usbWatcher.onInsert(() => {
  if (gameState.state === stateEnum.ROUND_RUNNING) {
    gameEngine.startPlant();
    return;
  }
  if (gameState.state === stateEnum.DEFUSING) {
    gameEngine.cancelDefuse();
  }
});

usbWatcher.onRemove(() => {
  if (gameState.state === stateEnum.PLANTING) {
    gameEngine.cancelPlant();
    return;
  }
  if (gameState.state === stateEnum.SPIKE_PLANTED) {
    gameEngine.startDefuse();
    return;
  }
  // No-op on remove during DEFUSING; spec cancels on insert instead
});

console.log("\n=== CONTROLS ===");
console.log("Press 's' -> Start Round");
console.log("Press Ctrl+C → Exit\n");

if (process.stdin && process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (key) => {
    if (key === "s") {
      gameEngine.startRound();
    }

    if (key === "\u0003") {
      process.exit();
    }
  });
} else {
  console.log("Interactive controls disabled (no TTY).");
}


