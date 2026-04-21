const WebSocket = require("ws");

let clients = [];

function getClientCount() {
  return clients.length;
}

function startWSServer(
  port = 8080,
  host = process.env.WS_HOST || "0.0.0.0",
  onMessage,
  onConnect
) {
  const wss = new WebSocket.Server({ port, host });

  wss.on("connection", (ws) => {
    console.log("[WS] Frontend connected");
    clients.push(ws);

    if (onConnect) onConnect(ws);

    ws.on("message", (data) => {
      if (!onMessage) return;
      try {
        const msg = JSON.parse(data.toString());
        onMessage(msg, ws);
      } catch (err) {
        console.warn("[WS] Failed to parse message:", err);
      }
    });

    ws.on("close", () => {
      clients = clients.filter((c) => c !== ws);
      console.log("[WS] Frontend disconnected");
    });
  });

  console.log(`[WS] Running on ws://${host}:${port}`);
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  const debug = process.env.RELAY_DEBUG === "1";

  if (debug && data && data.event) {
    console.log(`[RELAY] broadcast -> ${data.event} (clients=${clients.length})`);
  }

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

module.exports = { startWSServer, broadcast, getClientCount };
