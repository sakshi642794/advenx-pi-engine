// CHANGE THIS to your FastAPI backend IP
// Same machine: "http://localhost:8000"
// Different machine on LAN: "http://192.168.1.XXX:8000"
// ngrok: "https://xxxx.ngrok.io"
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// CHANGE THIS if your frontend uses a different room name
// Must match what frontend connects to: ws://BACKEND:8000/ws/ROOM_ID
const ROOM_ID = process.env.ROOM_ID || "arena";
// ────────────────────────────────────────────────────────────────────

async function send(event) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/internal/pi?room_id=${ROOM_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }
    );
    if (!res.ok) console.error("[PI] Backend rejected:", res.status);
  } catch (err) {
    console.error("[PI] Failed to send to backend:", err.message);
  }
}

module.exports = { send };
