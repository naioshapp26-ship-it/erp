#!/bin/sh
set -e

if [ "$RUN_DB_RESTORE_ONCE" = "true" ] || [ "$RUN_DB_RESTORE_ONCE" = "1" ]; then
  echo "🔄 RUN_DB_RESTORE_ONCE is set — restoring full database from NaioshERP.sql..."
  node scripts/restore-full-database.js --yes
  echo "✅ One-shot restore finished. Remove RUN_DB_RESTORE_ONCE after verifying production."
fi

exec node server.js
