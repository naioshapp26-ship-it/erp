# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

NAIOSH ERP is a Node.js/Express monolith that serves both the REST API and static HTML frontend on a single port (default `3000`). PostgreSQL is the only required external service.

### One-time local setup (not in update script)

1. **PostgreSQL** — Install and start if not already running:
   ```bash
   sudo pg_ctlcluster 16 main start
   ```
   Create a dev database/user (adjust names as needed):
   ```bash
   sudo -u postgres psql -c "CREATE USER nayosh WITH PASSWORD 'devpassword' CREATEDB;"
   sudo -u postgres psql -c "CREATE DATABASE nayosh_erp OWNER nayosh;"
   ```

2. **`.env`** — Copy `.env.example` to `.env` and set at minimum:
   - `DATABASE_URL=postgresql://nayosh:devpassword@127.0.0.1:5432/nayosh_erp`
   - `DATABASE_SSL=false`
   - `NODE_ENV=development`
   - `PORT=3000`
   - `TENANT_DB_ENCRYPTION_KEY` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

3. **Schema + seed data** (fresh DB only):
   ```bash
   node init-db.js
   ```

### Starting the app

```bash
npm start          # production mode
npm run dev        # nodemon (requires global/dev install of nodemon; not in package.json devDependencies)
```

Health check: `curl http://127.0.0.1:3000/api/health`

Main UI: `http://127.0.0.1:3000` → login button redirects to `/dashboard.html`.

### Testing

| Command | Purpose |
|---------|---------|
| `npm test` | PostgreSQL connectivity (`test-pg-connect.js`) |
| `node test-db.js` | Schema + seed data verification |
| `node quick-api-test.js` | Smoke test of key API routes (some hierarchy routes may 500 on a minimal `init-db` schema) |
| `node scripts/verify-startup.js` | Module load check without starting the server |

There is **no ESLint/Prettier** configured and **no frontend build step** (`npm run build` is a no-op).

### Auth note

`auth-api.js` currently uses a **bypass auth** path for login — POST `/api/auth/login` succeeds without real credentials and returns a `Super Admin` session. Useful for local dev/demo; do not rely on this in production.

### Gotchas

- `db.js` uses a custom Client pool (not `pg.Pool`) for cPanel compatibility; `localhost` in `DATABASE_URL` is normalized to `127.0.0.1`.
- `start.sh` exits if `.env` is missing.
- File uploads go to `uploads/` (created automatically).
- Optional SaaS/tenant features need additional SQL migrations under `tenant-migrations/` beyond `init-db.sql`.
