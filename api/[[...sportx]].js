const app = require('../server.js');

module.exports = (req, res) => {
  // Vercel Serverless Functions in the /api directory automatically strip the '/api' prefix from req.url.
  // Our Express app in server.js expects the routes to start with '/api'.
  // We restore the prefix here before handing the request to Express.
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url === '/' ? '' : req.url);
  }
  return app(req, res);
};
