const WebSocket = require("ws");
const config = require("../config/config");
const logger = require("../utils/logger");

const RECONNECT_DELAY_MS = 3000;

function buildWsUrl() {
  const envWs = process.env.BACKEND_WS_URL;
  const envHttp = process.env.BACKEND_URL;
  let base = envWs || config.WS_URL || "ws://localhost:8000";
  if (!envWs && envHttp) {
    base = envHttp.replace(/^http(s)?:\/\//i, (m) => (m.toLowerCase() === "https://" ? "wss://" : "ws://"));
  }
  const roomId = process.env.ROOM_ID || "arena";
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;

  // Accept either a base URL (ws://host:8000) or a full room endpoint (ws://host:8000/ws/arena).
  if (/\/ws\/[^/]+$/i.test(trimmed)) return trimmed;

  return `${trimmed}/ws/${roomId}`;
}

function startBackendWS({ onMessage, onConnect, onDisconnect } = {}) {
  let ws = null;
  let reconnectTimer = null;
  const debug = process.env.RELAY_DEBUG === "1";

  const connect = () => {
    const url = buildWsUrl();

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    logger.info(`[BACKEND WS] Connecting to ${url}`);
    ws = new WebSocket(url);

    ws.on("open", () => {
      logger.info("[BACKEND WS] Connected");
      if (onConnect) onConnect();
    });

    ws.on("message", (data) => {
      if (!onMessage) return;
      try {
        const msg = JSON.parse(data.toString());
        if (debug && msg && msg.event) {
          logger.info(`[BACKEND WS] recv event=${msg.event}`);
        }
        onMessage(msg);
      } catch (err) {
        logger.warn("[BACKEND WS] Failed to parse message");
      }
    });

    ws.on("close", () => {
      logger.warn("[BACKEND WS] Disconnected. Reconnecting...");
      if (onDisconnect) onDisconnect();
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      logger.warn("[BACKEND WS] Error:", err.message || err);
      try {
        ws.close();
      } catch (_) {
        // ignore
      }
    });
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_DELAY_MS);
  };

  connect();

  return {
    getWs: () => ws,
  };
}

module.exports = { startBackendWS };
