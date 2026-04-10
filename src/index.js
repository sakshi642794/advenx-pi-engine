const { startWSServer, broadcast } = require("./communication/wsServer");
const gameEngine = require("./engine/gameEngine");
const gameState = require("./models/gameState");

startWSServer(8080);

broadcast({
  type: "GAME_UPDATE",
  payload: gameState,
});

gameEngine.onUpdate((state) => {
  broadcast({
    type: "GAME_UPDATE",
    payload: state,
  });
});

console.log("\n=== CONTROLS ===");
console.log("Press 'r' → Start Round");
console.log("Press Ctrl+C → Exit\n");

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
