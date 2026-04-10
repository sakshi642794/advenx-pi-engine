const { spawn } = require("child_process");
const EventEmitter = require("events");

const emitter = new EventEmitter();

let lastEventTime = 0;

function shouldTrigger() {
  const now = Date.now();
  if (now - lastEventTime < 2000) return false; // debounce
  lastEventTime = now;
  return true;
}

function start() {
  console.log("USB WATCHER STARTED");

  const monitor = spawn("udevadm", [
    "monitor",
    "--udev",
    "--subsystem-match=usb"
  ]);

  monitor.stdout.on("data", (data) => {
    const output = data.toString();

    // console.log("RAW:", output);

    if (output.includes("add") && shouldTrigger()) {
      console.log("USB INSERT DETECTED");
      emitter.emit("insert");
    }

    if (output.includes("remove") && shouldTrigger()) {
      console.log("USB REMOVE DETECTED");
      emitter.emit("remove");
    }
  });

  monitor.stderr.on("data", (err) => {
    console.error("USB MONITOR ERROR:", err.toString());
  });

  monitor.on("close", () => {
    console.error("udevadm monitor stopped!");
  });
}

module.exports = {
  start,
  onInsert: (cb) => emitter.on("insert", cb),
  onRemove: (cb) => emitter.on("remove", cb)
};
