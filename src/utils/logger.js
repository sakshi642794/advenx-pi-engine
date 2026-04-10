function log(...args) {
  console.log(...args);
}

function info(...args) {
  console.log(...args);
}

function warn(...args) {
  console.warn(...args);
}

function error(...args) {
  console.error(...args);
}

module.exports = {
  log,
  info,
  warn,
  error,
};
