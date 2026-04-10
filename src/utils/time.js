exports.now = () => Date.now();

exports.getEndTime = (duration) => {
  return Date.now() + duration;
};
