const logger = require("../utils/logger");
const { broadcast } = require("./wsServer");

// Later this will send to backend WS
function sendEvent(type, payload = {}) {
  const event = {
    type,
    payload,
    timestamp: Date.now(),
  };

  // ✅ For now: just log
  logger.info("[EVENT]", event);
  broadcast(event);
  // 🔮 Future:
  // backendClient.send(event);
}

module.exports = { sendEvent };
