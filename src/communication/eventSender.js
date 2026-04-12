const logger = require("../utils/logger");
const { broadcast } = require("./wsServer");
const backendClient = require("./backendClient"); // ← ADD

function sendEvent(type, payload = {}) {
  const event = {
    event: type,
    payload,
    timestamp: Date.now(),
  };

  logger.info("[EVENT]", event);
  broadcast(event);             // local kiosk still gets it
  backendClient.send(event);    // ← ADD: backend gets it → all other PCs
}

module.exports = { sendEvent };