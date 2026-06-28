#!/bin/sh
set -eu

BASE="${SDB_PUBLIC_URL:-http://192.168.1.19}"

cat > /app/config.js <<EOF
window.__SDB_AUTH_URL = '${SDB_AUTH_URL:-$BASE}';
window.__SDB_DATA_URL = '${SDB_DATA_URL:-$BASE}';
window.__SDB_MAIL_URL = '${SDB_MAIL_URL:-$BASE}';
EOF

exec "$@"
