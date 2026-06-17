#!/bin/sh

if [ "$RUN_DB_RESTORE_ONCE" = "true" ] || [ "$RUN_DB_RESTORE_ONCE" = "1" ]; then
  echo "🔄 Starting one-shot database restore (quiet mode)..."
  if node scripts/restore-full-database.js --yes; then
    echo "✅ Database restore finished"
  else
    echo "⚠️ Database restore failed — starting server with existing data"
  fi
  echo "ℹ️ Remove RUN_DB_RESTORE_ONCE from Railway variables after a successful restore"
fi

exec node server.js
