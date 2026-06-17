#!/usr/bin/env bash
# Restore full NAIOSH ERP data from NaioshERP.sql into local PostgreSQL.
# Usage: bash scripts/restore-local-database.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DUMP_FILE="${1:-$ROOT_DIR/NaioshERP.sql}"
DB_NAME="${DB_NAME:-naiosh_erp}"
DB_USER="${DB_USER:-vendowor_erp_user}"
DB_PASS="${DB_PASS:-erp_local_2026}"
TEMP_DUMP="$ROOT_DIR/.restore-temp.sql"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "❌ Dump file not found: $DUMP_FILE"
  exit 1
fi

echo "🚀 Restoring from: $DUMP_FILE"
echo "   Database: $DB_NAME"

sudo service postgresql start >/dev/null 2>&1 || sudo pg_ctlcluster 16 main start >/dev/null 2>&1 || true

grep -v -E '^\\restrict|^\\unrestrict|^\\connect|^SET transaction_timeout' "$DUMP_FILE" > "$TEMP_DUMP"

sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=0 -f "$TEMP_DUMP" "$DB_NAME"
rm -f "$TEMP_DUMP"

sudo -u postgres psql -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}' SUPERUSER;
  END IF;
END \$\$;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER}; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};"

echo ""
echo "📊 Verification:"
sudo -u postgres psql "$DB_NAME" -c "SELECT COUNT(*) AS entities FROM entities; SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS roles FROM roles;"

ENV_FILE="$ROOT_DIR/.env"
cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
PORT=3000
NODE_ENV=development
EOF

echo ""
echo "✅ Restore complete. Wrote $ENV_FILE"
echo "   Run: npm start"
