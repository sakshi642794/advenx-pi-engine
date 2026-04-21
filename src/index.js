const { startWSServer, broadcast, getClientCount } = require("./communication/wsServer");
const { sendEvent } = require("./communication/eventSender");
const { startBackendWS } = require("./communication/backendWSClient");
const gameEngine = require("./engine/gameEngine");
const gameState = require("./models/gameState");
const stateEnum = require("./engine/state");
const usbWatcher = require("./hardware/usbWatcher");
const config = require("./config/config");
const path = require("path");
const { spawn } = require("child_process");

let attackersReady = false;
let defendersReady = false;
let roundStartTimer = null;
let lastEngineState = gameState.state;
let localStarted = false;
let frontendStarted = false;
let browserStarted = false;
let backendConnected = false;
let backendWsHandle = null;

gameState.totalRounds = config.TOTAL_ROUNDS;

function clearRoundCountdown() {
  if (roundStartTimer) {
    clearTimeout(roundStartTimer);
    roundStartTimer = null;
  }
}

function setReady(team, ready) {
  if (team === "attackers") attackersReady = ready;
  if (team === "defenders") defendersReady = ready;
  if (!ready) clearRoundCountdown();
}

function resetReadyState() {
  attackersReady = false;
  defendersReady = false;
  clearRoundCountdown();
}

function maybeStartRoundCountdown() {
  const bothReady = attackersReady && defendersReady;
  const canStart =
    gameState.state === stateEnum.IDLE || gameState.state === stateEnum.ROUND_ENDED;

  if (!bothReady || !canStart || roundStartTimer) return;

  const seconds = 3;
  const endTime = Date.now() + seconds * 1000;
  sendEvent("round_starting", { seconds, endTime });

  roundStartTimer = setTimeout(() => {
    roundStartTimer = null;
    resetReadyState();
    gameEngine.startRound();
  }, seconds * 1000);
}

function handleReadyEvent(event) {
  if (event === "attackers_ready") setReady("attackers", true);
  if (event === "defenders_ready") setReady("defenders", true);
  if (event === "attackers_not_ready") setReady("attackers", false);
  if (event === "defenders_not_ready") setReady("defenders", false);
  maybeStartRoundCountdown();
}

function handleOperatorMessage(msg) {
  if (!msg || !msg.event) return;

  const sendToBackendWs = (event, payload = {}) => {
    try {
      const ws =
        backendWsHandle && typeof backendWsHandle.getWs === "function"
          ? backendWsHandle.getWs()
          : null;
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ event, payload }));
        return true;
      }
    } catch (_) {
      // ignore and fall back to HTTP ingest
    }
    // Fallback: still broadcast locally + POST to backend ingest.
    // Note: backend fast/slow activation requires WS path, so this
    // fallback won't trigger timer_speed_update unless backend adds support.
    sendEvent(event, payload);
    return false;
  };

  const normalizePlayerId = (raw) => {
    if (typeof raw !== "string") return null;
    const pid = raw.trim().toUpperCase();
    if (pid.length !== 2) return null;
    const team = pid[0];
    const num = pid[1];
    if ((team === "A" || team === "D") && ["1", "2", "3", "4", "5"].includes(num)) return pid;
    return null;
  };

  switch (msg.event) {
    case "attackers_ready":
    case "defenders_ready":
      // Echo to other clients for multi-screen sync
      sendEvent(msg.event, msg.payload || {});
      handleReadyEvent(msg.event);
      return;

    case "fast":
    case "slow":
      sendToBackendWs(msg.event, msg.payload || {});
      return;

    case "kill":
    case "revive": {
      const pid = normalizePlayerId(
        (msg.payload && (msg.payload.playerId || msg.payload.player || msg.payload.id)) || null
      );
      if (!pid) return;
      sendToBackendWs(`${msg.event} ${pid}`);
      return;
    }

    case "start_game":
      resetReadyState();
      gameEngine.startRound();
      return;

    case "start_plant":
      gameEngine.startPlant();
      return;

    case "cancel_plant":
      gameEngine.cancelPlant();
      return;

    case "start_defuse":
      gameEngine.startDefuse();
      return;

    case "cancel_defuse":
      gameEngine.cancelDefuse();
      return;

    case "reset_game":
      resetReadyState();
      gameEngine.resetGame();
      sendEvent("reset_game");
      return;

    default:
      // Allow sending raw string commands like:
      // "kill A1", "revive D3", "A1-killed", "revive-A1"
      if (typeof msg.event === "string") {
        const raw = msg.event.trim();
        const lower = raw.toLowerCase();
        if (lower === "fast" || lower === "slow") {
          sendToBackendWs(lower);
          return;
        }
        if (lower.startsWith("kill ") || lower.startsWith("revive ")) {
          sendToBackendWs(raw);
          return;
        }
        if (/^([ad][1-5])[-_ ]?killed$/i.test(raw) || /^revive-([ad][1-5])$/i.test(raw)) {
          // These are already concrete events; just broadcast through backend ingest too.
          sendEvent(raw);
          return;
        }
      }
      return;
  }
}

function sendInitialState(ws) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(
    JSON.stringify({
      event: "game_update",
      payload: gameState,
    })
  );
  ws.send(
    JSON.stringify({
      event: "backend_status",
      payload: { connected: backendConnected },
    })
  );
}

function startLocalServices() {
  if (localStarted) return;
  localStarted = true;

  startWSServer(8080, undefined, handleOperatorMessage, sendInitialState);

  gameEngine.onUpdate((state) => {
    broadcast({
      event: "game_update",
      payload: state,
    });

    if (state.state !== lastEngineState) {
      lastEngineState = state.state;
      if (state.state === stateEnum.ROUND_ENDED) {
        resetReadyState();
      }
    }
  });

  usbWatcher.start();
  usbWatcher.onInsert(() => {
    if (gameState.state === stateEnum.ROUND_RUNNING) {
      gameEngine.startPlant();
      return;
    }
    if (gameState.state === stateEnum.DEFUSING) {
      gameEngine.cancelDefuse();
    }
  });

  usbWatcher.onRemove(() => {
    if (gameState.state === stateEnum.PLANTING) {
      gameEngine.cancelPlant();
      return;
    }
    if (gameState.state === stateEnum.SPIKE_PLANTED) {
      gameEngine.startDefuse();
      return;
    }
    // No-op on remove during DEFUSING; spec cancels on insert instead
  });

  console.log("\n=== CONTROLS ===");
  console.log("Press 's' -> Start Round");
  console.log("Press Ctrl+C → Exit\n");

  if (process.stdin && process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key) => {
      if (key === "s") {
        gameEngine.startRound();
      }

      if (key === "\u0003") {
        process.exit();
      }
    });
  } else {
    console.log("Interactive controls disabled (no TTY).");
  }
}

function startFrontend() {
  if (frontendStarted) return;
  frontendStarted = true;

  const frontendDir =
    process.env.FRONTEND_DIR ||
    path.resolve(__dirname, "..", "..", "advenx-display");

  console.log("[FRONTEND] Starting dev server in", frontendDir);

  const child = spawn("npm", ["run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"], {
    cwd: frontendDir,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => {
    console.warn("[FRONTEND] exited with code", code);
    frontendStarted = false;
  });
}

function startBrowser() {
  if (browserStarted) return;
  browserStarted = true;

  const url = process.env.FRONTEND_URL || "http://localhost:3000";
  const cmd =
    "chromium-browser --kiosk --noerrdialogs --disable-infobars " +
    "--autoplay-policy=no-user-gesture-required " +
    url;

  console.log("[BROWSER] Launching Chromium kiosk:", url);
  const child = spawn(cmd, { stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    console.warn("[BROWSER] exited with code", code);
    browserStarted = false;
    if (backendConnected) {
      setTimeout(startBrowser, 2000);
    }
  });
}

function forwardToFrontend(event, payload = {}) {
  if (!localStarted) return;
  const debug = process.env.RELAY_DEBUG === "1";
  if (debug) {
    console.log(`[RELAY] forward backend->hud event=${event} clients=${getClientCount()}`);
  }
  broadcast({ event, payload });
}

// Start local relay immediately so the HUD can connect right away on boot.
// Also start the frontend + kiosk right away so the display comes up on boot
// even if the backend is still connecting.
startLocalServices();
startFrontend();
forwardToFrontend("backend_status", { connected: false });
setTimeout(startBrowser, 3000);

backendWsHandle = startBackendWS({
  onConnect: () => {
    backendConnected = true;
    forwardToFrontend("backend_status", { connected: true });
    // If the kiosk/browser died earlier, bring it back once backend returns.
    setTimeout(startBrowser, 500);
  },
  onDisconnect: () => {
    backendConnected = false;
    forwardToFrontend("backend_status", { connected: false });
  },
  onMessage: (msg) => {
  if (!msg || !msg.event) return;
  console.log("[BACKEND WS] event:", msg.event, "payload:", msg.payload || {});

  switch (msg.event) {
    case "attackers_ready":
    case "defenders_ready":
    case "attackers_not_ready":
    case "defenders_not_ready":
      forwardToFrontend(msg.event, msg.payload || {});
      handleReadyEvent(msg.event);
      break;
    case "both_teams_ready":
      forwardToFrontend("attackers_ready", {});
      forwardToFrontend("defenders_ready", {});
      handleReadyEvent("attackers_ready");
      handleReadyEvent("defenders_ready");
      break;
    case "no_team_ready":
      forwardToFrontend("attackers_not_ready", {});
      forwardToFrontend("defenders_not_ready", {});
      handleReadyEvent("attackers_not_ready");
      handleReadyEvent("defenders_not_ready");
      break;
    case "teams_ready": {
      const aReady = msg.payload ? msg.payload.attackersReady : undefined;
      const dReady = msg.payload ? msg.payload.defendersReady : undefined;
      if (typeof aReady === "boolean") setReady("attackers", aReady);
      if (typeof dReady === "boolean") setReady("defenders", dReady);
      forwardToFrontend("teams_ready", msg.payload || {});
      maybeStartRoundCountdown();
      break;
    }
    case "reset_game":
      resetReadyState();
      forwardToFrontend("reset_game");
      break;
    default:
      // Forward any other backend events (kill/revive, timer_speed_update, etc.)
      // so local kiosk clients stay in sync with CO/admin actions.
      forwardToFrontend(msg.event, msg.payload || {});
      break;
  }
  },
});


