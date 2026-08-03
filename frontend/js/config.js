// Backend connection settings for local development.
// The API key is fetched from the backend at load time instead of being a
// literal in this file — it still ends up fully visible to the browser
// either way (see README "Security Notes"), this just avoids keeping two
// hardcoded copies of the same key in sync.
const CONFIG = {
  API_BASE: 'http://127.0.0.1:8000',
  API_KEY: null,
};

CONFIG.ready = fetch(`${CONFIG.API_BASE}/client-key`)
  .then((res) => res.json())
  .then((data) => {
    CONFIG.API_KEY = data.api_key;
  })
  .catch(() => {
    /* leave API_KEY null; protected requests will fail with a clear 401 */
  });
