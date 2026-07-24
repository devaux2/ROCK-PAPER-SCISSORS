// Extends app.json. WEB_BASE_URL lets CI build the web client for a
// subpath host like GitHub Pages (e.g. /ROCK-PAPER-SCISSORS); unset for
// the normal root-path build served by the game server.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.WEB_BASE_URL ? { baseUrl: process.env.WEB_BASE_URL } : {}),
  },
});
