// Backend connection settings.
//
// Version B is served by the same FastAPI process that serves the API (it is
// mounted under /v2/ by the existing StaticFiles mount), so the same origin is
// the right default and it keeps working on any host or port. The hardcoded
// address is only the fallback for opening the file directly off disk.
//
// The API key is fetched from the backend at load time rather than written in
// here. It ends up fully visible to the browser either way — see README
// "Security Notes" — this just avoids keeping two copies of it in sync.
const CONFIG = {
  API_BASE:
    window.location.protocol.startsWith('http')
      ? window.location.origin
      : 'http://127.0.0.1:8000',
  API_KEY: null,
};

CONFIG.ready = fetch(`${CONFIG.API_BASE}/client-key`)
  .then((res) => res.json())
  .then((data) => {
    CONFIG.API_KEY = data.api_key;
  })
  .catch(() => {
    /* leave API_KEY null; protected requests then fail with a clear 401 */
  });
