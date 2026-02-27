/**
 * Create React App development proxy (react-scripts 5 / http-proxy-middleware v2).
 *
 * Proxies all /api/* requests from the CRA dev server (port 3000) to the
 * backend (port 3001) and strips the /api prefix, mirroring the nginx
 * `location /api/` block used in the Docker / Codespaces setup.
 *
 * This file is only used during `npm start` (local development).
 * In Docker and GitHub Codespaces the nginx reverse proxy performs the
 * same job.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    })
  );
};
