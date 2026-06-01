#!/bin/bash
# يشغّل من: /home/vendowor/naiosherp.com
set -e
ROOT="${1:-/home/vendowor/naiosherp.com}"
cd "$ROOT"

echo "=== 1) Betacademy files ==="
find "$ROOT" -maxdepth 3 \( -name 'index-BDcwhEVX.js' -o -name 'manifest.webmanifest' \) 2>/dev/null | while read -r f; do
  echo "   FOUND: $f"
done

grep -rl "Betacademy" "$ROOT" --include="*.html" 2>/dev/null | grep -v login-page.html | head -10 || echo "   (no Betacademy SPA index in app root)"

echo ""
echo "=== 2) index.html first lines ==="
head -3 index.html 2>/dev/null || echo "   no index.html"

echo ""
echo "=== 3) Passenger block in .htaccess ==="
grep -n "Passenger\|RewriteRule.*api" .htaccess 2>/dev/null | head -15 || echo "   no .htaccess"

echo ""
echo "=== 4) Suggest rename (run manually if Betacademy found) ==="
echo "   mv index.html index.html.bak 2>/dev/null"
echo "   mv assets assets.bak 2>/dev/null"
echo "   # ثم cPanel Restart Node"

echo ""
echo "=== 5) Test Node locally ==="
if [ -f test-login-local.js ]; then
  PORT=$(grep -oP 'يعمل على \S+:\K[0-9]+' stderr.log 2>/dev/null | tail -1)
  PORT="${PORT:-3000}"
  echo "   PORT=$PORT"
  PORT="$PORT" node test-login-local.js ahmed@nayosh.com test123 || true
fi
