#!/usr/bin/env bash
# =============================================================================
#  bring-up.sh — Start the complete WekezaGlobal developer ecosystem stack
#
#  Usage:
#    ./scripts/bring-up.sh [--with-logging]
#
#  Options:
#    --with-logging   Also start Elasticsearch, Logstash, and Kibana (ELK)
#
#  What it starts (core stack):
#    • PostgreSQL   — primary developer-ecosystem database     (port 5432)
#    • Redis        — caching & API-key rate limiting          (port 6379)
#    • Backend API  — Express / Node.js                        (port 3001)
#    • Frontend     — React (nginx)                            (port 3000)
#    • MySQL        — analytics & reporting DB                 (port 3306)
#    • Prometheus   — metrics collection                       (port 9090)
#    • Grafana      — dashboards & alerting                    (port 3003)
#    • node-exporter— host-level metrics                       (port 9100)
#
#  Optional with --with-logging:
#    • Elasticsearch                                           (port 9200)
#    • Logstash                                                (ports 5044, 5000)
#    • Kibana                                                  (port 5601)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

WITH_LOGGING=false
for arg in "$@"; do
  [[ "$arg" == "--with-logging" ]] && WITH_LOGGING=true
done

echo "============================================================"
echo "  WekezaGlobal Developer Ecosystem — Stack Bring-Up"
echo "============================================================"

# ── Validate prerequisites ────────────────────────────────────────────────────

for cmd in docker docker-compose; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "[ERROR] '$cmd' is not installed. Please install Docker and Docker Compose."
    exit 1
  fi
done

# ── Copy .env if it doesn't exist ─────────────────────────────────────────────

if [[ ! -f "${REPO_ROOT}/.env" ]]; then
  echo "[INFO] No .env file found — copying from .env.example"
  cp "${REPO_ROOT}/.env.example" "${REPO_ROOT}/.env"
  echo "[WARN] Review ${REPO_ROOT}/.env and update secrets before deploying to production."
fi

# ── Pull images ───────────────────────────────────────────────────────────────

echo ""
echo "[STEP 1/3] Pulling Docker images..."
if $WITH_LOGGING; then
  docker-compose --profile logging pull --quiet
else
  docker-compose pull --quiet
fi

# ── Build local images ────────────────────────────────────────────────────────

echo ""
echo "[STEP 2/3] Building backend and frontend images..."
docker-compose build --parallel

# ── Start the stack ───────────────────────────────────────────────────────────

echo ""
echo "[STEP 3/3] Starting services..."
if $WITH_LOGGING; then
  docker-compose --profile logging up -d
else
  docker-compose up -d
fi

# ── Wait for health checks ────────────────────────────────────────────────────

echo ""
echo "[WAIT] Waiting for services to become healthy..."

MAX_WAIT=120
ELAPSED=0
INTERVAL=5

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  BACKEND_STATUS=$(docker inspect --format='{{.State.Health.Status}}' wgi_backend 2>/dev/null || echo "not_found")
  POSTGRES_STATUS=$(docker inspect --format='{{.State.Health.Status}}' wgi_postgres 2>/dev/null || echo "not_found")

  if [[ "$BACKEND_STATUS" == "healthy" && "$POSTGRES_STATUS" == "healthy" ]]; then
    break
  fi

  echo "  [${ELAPSED}s] postgres=${POSTGRES_STATUS} backend=${BACKEND_STATUS}…"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

# ── Status summary ────────────────────────────────────────────────────────────

echo ""
echo "============================================================"
echo "  Stack Status"
echo "============================================================"
docker-compose ps

echo ""
echo "============================================================"
echo "  Service Endpoints"
echo "============================================================"
echo "  Developer Portal (Frontend):  http://localhost:3000"
echo "  Backend API:                  http://localhost:3001"
echo "  API Health Check:             http://localhost:3001/health"
echo "  Sandbox Base URL:             http://localhost:3001/v1/sandbox"
echo "  Prometheus Metrics:           http://localhost:9090"
echo "  Grafana Dashboards:           http://localhost:3003  (admin/admin)"
if $WITH_LOGGING; then
  echo "  Kibana Logs UI:               http://localhost:5601"
  echo "  Elasticsearch:                http://localhost:9200"
fi
echo ""
echo "  Next steps:"
echo "    1. Open http://localhost:3000 to access the developer portal"
echo "    2. Register a developer account"
echo "    3. Log in and create an API key"
echo "    4. Use the API key to call the sandbox endpoints:"
echo "       curl -H 'X-API-Key: <your-key>' http://localhost:3001/v1/sandbox/core-banking/accounts"
echo ""
echo "  Run regression tests against the live stack:"
echo "    ./scripts/test-developer-flow.sh"
echo ""
echo "  To bring down the stack:"
echo "    ./scripts/teardown.sh"
echo "============================================================"
