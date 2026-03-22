#!/usr/bin/env bash
# =============================================================================
#  teardown.sh — Stop and clean up the WekezaGlobal developer ecosystem stack
#
#  Usage:
#    ./scripts/teardown.sh [--clean]
#
#  Options:
#    --clean    Also remove all Docker volumes (deletes all data)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

CLEAN=false
for arg in "$@"; do
  [[ "$arg" == "--clean" ]] && CLEAN=true
done

cd "$REPO_ROOT"

echo "============================================================"
echo "  WekezaGlobal Developer Ecosystem — Stack Teardown"
echo "============================================================"

if $CLEAN; then
  echo "[INFO] Stopping containers and removing volumes (--clean flag set)..."
  docker-compose --profile logging down -v --remove-orphans 2>/dev/null || \
  docker-compose down -v --remove-orphans
  echo "[DONE] All containers stopped and volumes removed."
else
  echo "[INFO] Stopping containers (data volumes preserved)..."
  docker-compose --profile logging down --remove-orphans 2>/dev/null || \
  docker-compose down --remove-orphans
  echo "[DONE] All containers stopped. Run with --clean to also remove volumes."
fi

echo "============================================================"
