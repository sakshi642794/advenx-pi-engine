const WebSocket = require("ws");

let ws;

function connect() {
  ws = new WebSocket("ws://<BACKEND_IP>:8000/ws");

  ws.on("open", () => {
    console.log("BACKEND CONNECTED");
  });

  ws.on("close", () => {
    console.log("BACKEND DISCONNECTED");
    setTimeout(connect, 2000);
  });

  ws.on("error", () => {
    console.log("BACKEND ERROR");
  });
}

function send(event) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

module.exports = { connect, send };
