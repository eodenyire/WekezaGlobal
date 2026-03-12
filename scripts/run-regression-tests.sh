#!/usr/bin/env bash
# =============================================================================
#  run-regression-tests.sh — Run all regression and integration tests
#
#  Usage:
#    ./scripts/run-regression-tests.sh [--coverage]
#
#  Options:
#    --coverage   Generate HTML code-coverage report (saved to backend/coverage/)
#
#  Requirements:
#    • Node.js 20+
#    • npm dependencies installed in ./backend  (npm install)
#    • No live services required — all external deps are mocked in tests
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"

COVERAGE=false
for arg in "$@"; do
  [[ "$arg" == "--coverage" ]] && COVERAGE=true
done

echo "============================================================"
echo "  WekezaGlobal — Regression & Integration Test Suite"
echo "============================================================"

# ── Validate prerequisites ────────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js is not installed."
  exit 1
fi

NODE_VERSION=$(node -e "process.stdout.write(process.version.replace('v',''))")
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [[ $NODE_MAJOR -lt 20 ]]; then
  echo "[WARN] Node.js $NODE_VERSION detected; Node.js 20+ is recommended."
fi

# ── Install dependencies if needed ───────────────────────────────────────────

if [[ ! -d "${BACKEND_DIR}/node_modules" ]]; then
  echo "[INFO] Installing backend dependencies..."
  (cd "$BACKEND_DIR" && npm install --silent)
fi

# ── Run tests ─────────────────────────────────────────────────────────────────

echo ""
echo "[INFO] Running test suite in: ${BACKEND_DIR}"
echo ""

cd "$BACKEND_DIR"

if $COVERAGE; then
  npx jest --coverage --coverageDirectory=coverage --coverageReporters=html,text
  echo ""
  echo "[INFO] Coverage report saved to: ${BACKEND_DIR}/coverage/index.html"
else
  npx jest --no-coverage
fi

echo ""
echo "============================================================"
echo "  All tests completed successfully."
echo "============================================================"
