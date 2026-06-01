#!/bin/bash
# تشغيل على السيرفر: bash scripts/cpanel-fix.sh
set -e
cd "$(dirname "$0")/.."

echo "=== NAIOSH cPanel fix ==="

if [ -f /home/vendowor/nodevenv/naiosherp.com/20/bin/activate ]; then
  # shellcheck disable=SC1091
  source /home/vendowor/nodevenv/naiosherp.com/20/bin/activate
fi

echo "1) Betacademy files in app root (remove if listed):"
grep -rl "Betacademy" . --include="*.html" 2>/dev/null | head -5 || echo "   (none in html)"

if [ -d assets ] && grep -q "Betacademy" index.html 2>/dev/null; then
  echo "   WARNING: index.html looks like Betacademy SPA — backup and remove:"
  echo "   mv index.html index.html.betacademy.bak"
  echo "   mv assets assets.betacademy.bak"
fi

echo "2) pg test (Client):"
node test-pg-connect.js || true

echo "3) Reinstall pg without optional native bindings:"
npm install pg@8.11.3 --omit=dev --no-optional 2>/dev/null || npm install pg@8.11.3 --omit=dev

echo "4) server.js listen check:"
grep -n "listenPort\|listenHost\|PORT is not" server.js | head -5

echo "=== Done. Restart Node app from cPanel ==="
