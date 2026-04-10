const WebSocket = require("ws");

let clients = [];

function startWSServer(
  port = 8080,
  host = process.env.WS_HOST || "127.0.0.1",
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

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

module.exports = { startWSServer, broadcast };
