const WebSocket = require("ws");

let clients = [];

function startWSServer(port = 8080, host = "0.0.0.0") {
  const wss = new WebSocket.Server({ port, host,});

  wss.on("connection", (ws) => {
    console.log("[WS] Frontend connected");
    clients.push(ws);

    ws.on("close", () => {
      clients = clients.filter((c) => c !== ws);
      console.log("[WS] Frontend disconnected");
    });
  });

  console.log(`[WS] Running on ws://localhost:${port}`);
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
