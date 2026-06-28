#!/bin/sh
set -eu

cat > /app/config.js <<EOF
window.__SDB_AUTH_URL = '';
window.__SDB_DATA_URL = '';
window.__SDB_MAIL_URL = '';
window.__VAPID_PUBLIC_KEY = '${VAPID_PUBLIC_KEY:-}';
EOF

exec "$@"
