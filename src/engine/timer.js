const timers = {};

function start(name, duration, onEnd, onTick) {
  stop(name);

  let timeLeft = duration;

  timers[name] = setInterval(() => {
    timeLeft--;
    if (onTick) onTick(timeLeft);

    if (timeLeft <= 0) {
      stop(name);
      if (onEnd) onEnd();
    }
  }, 1000);
}

function stop(name) {
  if (timers[name]) {
    clearInterval(timers[name]);
    delete timers[name];
  }
}

function stopAll() {
  Object.keys(timers).forEach(stop);
}

module.exports = {
  start,
  stop,
  stopAll,
};
