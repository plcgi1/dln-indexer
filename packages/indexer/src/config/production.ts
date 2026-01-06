module.exports = {
  logging: {
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
  },
};
