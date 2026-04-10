const { startWSServer, broadcast } = require("./communication/wsServer");
const { sendEvent } = require("./communication/eventSender");
const gameEngine = require("./engine/gameEngine");
const gameState = require("./models/gameState");
const stateEnum = require("./engine/state");
const usbWatcher = require("./hardware/usbWatcher");

function handleOperatorMessage(msg) {
  if (!msg || !msg.event) return;

  switch (msg.event) {
    case "attackers_ready":
    case "defenders_ready":
      // Echo to other clients for multi-screen sync
      sendEvent(msg.event, msg.payload || {});
      return;

    case "start_game":
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
console.log("Press 'r' → Start Round");
console.log("Press Ctrl+C → Exit\n");

if (process.stdin && process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (key) => {
    if (key === "r") {
      gameEngine.startRound();
    }

    if (key === "\u0003") {
      process.exit();
    }
  });
} else {
  console.log("Interactive controls disabled (no TTY).");
}
