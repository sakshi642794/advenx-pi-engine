module.exports = function reconnect(connectFn, interval) {
  setInterval(() => {
    connectFn();
  }, interval);
};
