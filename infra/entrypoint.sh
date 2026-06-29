#!/bin/sh
set -eu

# Option B (production): browser calls SupaDupaBase on VM106 directly (cross-origin).
# Local dev: leave SDB_PUBLIC_URL unset in repo config.js (localhost ports).

SDB_PUBLIC_URL="${SDB_PUBLIC_URL:-https://supadupabase.whitelynx.co.nz}"
AUTH_URL="${SDB_AUTH_URL:-$SDB_PUBLIC_URL}"
DATA_URL="${SDB_DATA_URL:-$SDB_PUBLIC_URL}"
MAIL_URL="${SDB_MAIL_URL:-$SDB_PUBLIC_URL}"

cat > /app/config.js <<EOF
window.__SDB_AUTH_URL = '${AUTH_URL}';
window.__SDB_DATA_URL = '${DATA_URL}';
window.__SDB_MAIL_URL = '${MAIL_URL}';
window.__VAPID_PUBLIC_KEY = '${VAPID_PUBLIC_KEY:-}';
EOF

exec "$@"
