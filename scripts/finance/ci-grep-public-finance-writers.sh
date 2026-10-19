#!/usr/bin/env bash
# Reject new Finance P3 public.finance_* writers; known allowlisted files are reported as WARN.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
ALLOWLIST_FILE="$ROOT/scripts/finance/public-write-allowlist.txt"
ALLOW_HEADER='FINANCE_PUBLIC_WRITE_ALLOW=1'

is_allowlisted() {
  local f="$1"
  grep -qxF "$f" "$ALLOWLIST_FILE" 2>/dev/null
}

FAIL=0
WARN=0
shopt -s nullglob
for f in test-finance-p3*.js test-finance-ops-closeout.js; do
  [[ -f "$f" ]] || continue
  if grep -nE 'INSERT[[:space:]]+INTO[[:space:]]+public\.finance_|UPDATE[[:space:]]+public\.finance_|DELETE[[:space:]]+FROM[[:space:]]+public\.finance_' "$f" >/tmp/fin-pub-hits.txt 2>/dev/null; then
    if head -n 25 "$f" | grep -qF "$ALLOW_HEADER"; then
      echo "ALLOW  $f (header)"
      continue
    fi
    if is_allowlisted "$f"; then
      echo "WARN   $f (allowlisted historical public seed — remediate)"
      WARN=$((WARN + 1))
      continue
    fi
    echo "FAIL   $f writes public.finance_* without allowlist/$ALLOW_HEADER"
    cat /tmp/fin-pub-hits.txt
    FAIL=1
  else
    echo "CLEAN  $f"
  fi
done

echo "ci-grep-public-finance-writers: FAIL=$FAIL WARN=$WARN"
[[ "$FAIL" -eq 0 ]]
