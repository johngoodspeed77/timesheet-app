// Local dev — production VM uses same-origin proxy (empty URLs → window.location.origin)
window.__SDB_AUTH_URL = window.__SDB_AUTH_URL ?? 'http://localhost:3001';
window.__SDB_DATA_URL = window.__SDB_DATA_URL ?? 'http://localhost:3002';
window.__SDB_MAIL_URL = window.__SDB_MAIL_URL ?? 'http://localhost:3004';
