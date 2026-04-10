const WebSocket = require("ws");
const logger = require("../utils/logger");

let clients = [];

function startWSServer(port = 8080) {
  const wss = new WebSocket.Server({ port });

  wss.on("connection", (ws) => {
    logger.info("[WS] Frontend connected");

    clients.push(ws);

    ws.on("close", () => {
      clients = clients.filter((c) => c !== ws);
      logger.info("[WS] Frontend disconnected");
    });

    ws.on("error", (err) => {
      logger.error("[WS ERROR]", err);
    });
  });

  logger.info(`[WS] Running on ws://localhost:${port}`);
}

function broadcast(event) {
  const message = JSON.stringify(event);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

module.exports = {
  startWSServer,
  broadcast,
};
