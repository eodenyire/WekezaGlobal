#!/usr/bin/env bash
# =============================================================================
#  seed-test-data.sh — Seed the developer ecosystem database with test data
#
#  This script:
#    1. Waits for PostgreSQL to be ready
#    2. Runs all migration SQL files in order
#    3. Verifies key tables were created
#    4. Prints a summary of seeded data
#
#  Usage:
#    ./scripts/seed-test-data.sh [DATABASE_URL]
#
#  Arguments:
#    DATABASE_URL (optional)
#      Default: postgresql://wgi_user:wgi_pass@localhost:5432/wgi_db
#
#  Requirements:
#    • psql (PostgreSQL client)
#    • PostgreSQL instance running (via Docker or direct install)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${REPO_ROOT}/backend/src/database/migrations"

DATABASE_URL="${1:-postgresql://wgi_user:wgi_pass@localhost:5432/wgi_db}"

echo "============================================================"
echo "  WekezaGlobal — Database Seeding"
echo "  Database: ${DATABASE_URL}"
echo "============================================================"

# ── Validate prerequisites ────────────────────────────────────────────────────

if ! command -v psql &>/dev/null; then
  echo "[ERROR] psql is not installed. Please install the PostgreSQL client."
  exit 1
fi

# ── Wait for PostgreSQL ───────────────────────────────────────────────────────

echo ""
echo "[WAIT] Checking PostgreSQL connectivity..."
MAX_WAIT=30
ELAPSED=0

until psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1 || [[ $ELAPSED -ge $MAX_WAIT ]]; do
  echo "  Waiting for PostgreSQL… (${ELAPSED}s)"
  sleep 3
  ELAPSED=$((ELAPSED+3))
done

if ! psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
  echo "[ERROR] Cannot connect to PostgreSQL at ${DATABASE_URL}"
  echo "        Please ensure the database is running (./scripts/bring-up.sh)"
  exit 1
fi

echo "[OK] PostgreSQL is reachable."

# ── Run migrations ────────────────────────────────────────────────────────────

echo ""
echo "[STEP] Running database migrations..."

# Run files in sorted order to respect dependencies
for SQL_FILE in $(ls "${MIGRATIONS_DIR}"/*.sql | sort); do
  FILENAME=$(basename "$SQL_FILE")
  echo "  Applying: ${FILENAME}"
  psql "$DATABASE_URL" -f "$SQL_FILE" -q || {
    echo "  [WARN] ${FILENAME} reported errors (may be safe to ignore if tables already exist)"
  }
done

# ── Run analytics schema ──────────────────────────────────────────────────────

ANALYTICS_SCHEMA="${REPO_ROOT}/backend/src/database/analytics_schema.sql"
if [[ -f "$ANALYTICS_SCHEMA" ]]; then
  echo ""
  echo "[STEP] Applying analytics schema..."
  psql "$DATABASE_URL" -f "$ANALYTICS_SCHEMA" -q || {
    echo "  [WARN] analytics_schema.sql reported errors (may be safe to ignore)"
  }
fi

# ── Verify tables ─────────────────────────────────────────────────────────────

echo ""
echo "[STEP] Verifying key tables..."

TABLES=("users" "wallets" "transactions" "api_keys" "webhooks" "subscriptions" "kyc_records" "audit_logs")
ALL_OK=true

for TABLE in "${TABLES[@]}"; do
  COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '${TABLE}' AND table_schema = 'public'" 2>/dev/null | tr -d ' ')
  if [[ "$COUNT" -gt 0 ]]; then
    echo "  ✓ ${TABLE}"
  else
    echo "  ✗ ${TABLE} — TABLE MISSING"
    ALL_OK=false
  fi
done

if ! $ALL_OK; then
  echo ""
  echo "[ERROR] Some tables are missing. Review migration output above."
  exit 1
fi

# ── Print seed data summary ───────────────────────────────────────────────────

echo ""
echo "[INFO] Seed data summary:"
psql "$DATABASE_URL" -c "
  SELECT
    (SELECT COUNT(*) FROM users)         AS users,
    (SELECT COUNT(*) FROM wallets)       AS wallets,
    (SELECT COUNT(*) FROM transactions)  AS transactions,
    (SELECT COUNT(*) FROM api_keys)      AS api_keys,
    (SELECT COUNT(*) FROM subscription_plans) AS subscription_plans
" 2>/dev/null || echo "  (summary query skipped — some tables may not exist yet)"

echo ""
echo "============================================================"
echo "  Database seeding complete."
echo "  You can now start the stack: ./scripts/bring-up.sh"
echo "============================================================"
