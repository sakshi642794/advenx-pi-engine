function deriveBackendWsUrl() {
  const envWs = process.env.BACKEND_WS_URL || process.env.WS_URL;
  const envHttp = process.env.BACKEND_URL;

  if (envWs) return envWs;

  if (envHttp) {
    return envHttp.replace(/^http(s)?:\/\//i, (m) =>
      m.toLowerCase() === "https://" ? "wss://" : "ws://"
    );
  }

  return "ws://localhost:8000";
}

module.exports = {
  // All durations are in seconds
  ROUND_TIME: 10 * 60,
  PLANT_TIME: 60,
  SPIKE_TIME: 3 * 60,
  DEFUSE_TIME: 60,
  TOTAL_ROUNDS: 3,

  // Base backend WS URL (without `/ws/<room>`). Prefer env vars over hardcoding.
  // Examples:
  //   BACKEND_WS_URL=ws://192.168.1.50:8000
  //   BACKEND_URL=http://192.168.1.50:8000
  WS_URL: deriveBackendWsUrl(),
};
