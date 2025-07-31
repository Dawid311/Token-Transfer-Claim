const app = require('../server');

// Vercel Handler
module.exports = (req, res) => {
  return app(req, res);
};
