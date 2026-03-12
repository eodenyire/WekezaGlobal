# WekezaGlobal Infrastructure (WGI) — Deployment Guide

This guide covers every supported deployment method: local/manual, Docker Compose, Kubernetes (kubectl + kustomize), and Helm.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Local / Manual Deployment](#local--manual-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Helm Deployment](#helm-deployment)
7. [Database Seeding](#database-seeding)
8. [Sandbox / v1-core Access](#sandbox--v1-core-access)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Node.js | 20+ | https://nodejs.org |
| npm | 10+ | bundled with Node.js |
| Docker | 24+ | https://docs.docker.com/get-docker/ |
| Docker Compose | v2 (plugin) | bundled with Docker Desktop |
| kubectl | 1.28+ | https://kubernetes.io/docs/tasks/tools/ |
| helm | 3+ | https://helm.sh/docs/intro/install/ |
| psql | 15+ | bundled with PostgreSQL client |

Verify installations:

```bash
node --version      # v20.x.x
docker --version    # Docker version 24.x.x
kubectl version     # Client Version: v1.28+
helm version        # version.BuildInfo{Version:"v3.x.x"}
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all required values before any deployment.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `NODE_ENV` | `development` | Yes | Runtime environment (`development`, `production`, `test`) |
| `PORT` | `3001` | Yes | Backend API port |
| `DATABASE_URL` | `postgresql://wgi_user:wgi_pass@localhost:5432/wgi_db` | Yes | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Yes | Redis connection string |
| `JWT_SECRET` | *(none)* | **Yes** | Min 32-char secret for JWT signing — **must change in production** |
| `JWT_EXPIRY` | `3600` | Yes | Token lifetime in seconds |
| `OAUTH_CLIENT_ID` | `wgi-client` | Yes | OAuth2 client ID |
| `OAUTH_CLIENT_SECRET` | *(none)* | **Yes** | OAuth2 client secret — **must change in production** |
| `SETTLEMENT_WEBHOOK_SECRET` | *(none)* | **Yes** | HMAC secret for webhook validation |
| `SANDBOX_ENABLED` | `true` | No | Enable `/v1/sandbox/` endpoints |
| `PAYPAL_CLIENT_ID` | *(none)* | No | PayPal integration |
| `PAYPAL_CLIENT_SECRET` | *(none)* | No | PayPal integration |
| `STRIPE_SECRET_KEY` | *(none)* | No | Stripe integration |
| `WISE_API_KEY` | *(none)* | No | Wise integration |
| `GRAFANA_ADMIN_USER` | `admin` | No | Grafana dashboard admin username |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | No | Grafana dashboard admin password |
| `LOG_LEVEL` | `info` | No | `error`, `warn`, `info`, or `debug` |
| `CORS_ORIGIN` | `http://localhost:3000` | No | Allowed CORS origin(s) |
| `RATE_LIMIT_MAX_REQUESTS` | `1000` | No | Max API requests per hour per key |
| `MYSQL_ANALYTICS_PASSWORD` | `wgi_analytics_pass` | No | MySQL analytics DB password |
| `MYSQL_ROOT_PASSWORD` | `wgi_root_pass` | No | MySQL root password |

---

## Local / Manual Deployment

### 1. Clone the repository

```bash
git clone https://github.com/your-org/WekezaGlobal.git
cd WekezaGlobal
```

### 2. Start PostgreSQL and Redis

```bash
# PostgreSQL (local instance)
psql postgresql://localhost:5432/postgres -c "CREATE DATABASE wgi_db;"
psql postgresql://localhost:5432/postgres -c "CREATE USER wgi_user WITH PASSWORD 'wgi_pass';"
psql postgresql://localhost:5432/postgres -c "GRANT ALL PRIVILEGES ON DATABASE wgi_db TO wgi_user;"

# Redis (local instance — must be running)
redis-server --daemonize yes
```

Connection strings:
```
DATABASE_URL=postgresql://wgi_user:wgi_pass@localhost:5432/wgi_db
REDIS_URL=redis://localhost:6379
```

### 3. Run database migrations

```bash
# Run all migration files in order
for f in backend/src/database/migrations/*.sql; do
  echo "Applying $f..."
  psql "$DATABASE_URL" -f "$f"
done
```

Or individually:

```bash
psql postgresql://wgi_user:wgi_pass@localhost:5432/wgi_db \
  -f backend/src/database/migrations/001_initial_schema.sql
```

### 4. Build and start the backend

```bash
cd backend
cp ../.env.example ../.env   # edit .env with your values
npm install
npm run build
npm start
```

Backend listens on **http://localhost:3001**.

### 5. Start the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm start
```

Frontend listens on **http://localhost:3000** and proxies API requests to `:3001`.

### 6. Verify health

```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"...","uptime":...}
```

---

## Docker Deployment

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET, SETTLEMENT_WEBHOOK_SECRET, and any integration keys
```

### 2. Start all services

```bash
docker compose up -d
```

This starts: **postgres**, **redis**, **backend**, **frontend**, **mysql**, **prometheus**, **grafana**, **node-exporter**.

### 3. Start with logging stack (ELK)

```bash
docker compose --profile logging up -d
```

This additionally starts: **elasticsearch**, **logstash**, **kibana**.

### 4. Service access URLs

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:3000 | React web app |
| Backend API | http://localhost:3001 | REST API + health |
| Grafana | http://localhost:3003 | Dashboards (`admin`/`admin`) |
| Prometheus | http://localhost:9090 | Metrics scraper |
| Kibana | http://localhost:5601 | Logs (logging profile) |
| Elasticsearch | http://localhost:9200 | Search/log index |
| PostgreSQL | localhost:5432 | DB (`wgi_user`/`wgi_pass`) |
| MySQL | localhost:3306 | Analytics DB |
| Redis | localhost:6379 | Cache/sessions |

### 5. View logs

```bash
# Follow backend logs
docker compose logs -f backend

# Follow all services
docker compose logs -f

# Single snapshot
docker compose logs --tail=100 backend
```

### 6. Stop all services

```bash
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v
```

### 7. Rebuild after code changes

```bash
docker compose build backend
docker compose up -d backend
```

---

## Kubernetes Deployment

### 1. Create namespace

```bash
kubectl create namespace wgi
```

### 2. Create secrets

```bash
kubectl create secret generic wgi-secrets \
  -n wgi \
  --from-literal=JWT_SECRET=<your-jwt-secret-min-32-chars> \
  --from-literal=DATABASE_URL=postgresql://wgi_user:<password>@postgres-svc:5432/wgi_db \
  --from-literal=REDIS_URL=redis://redis-svc:6379 \
  --from-literal=SETTLEMENT_WEBHOOK_SECRET=<your-webhook-secret> \
  --from-literal=OAUTH_CLIENT_SECRET=<your-oauth-secret>
```

### 3. Apply manifests

```bash
# Apply all base manifests via kustomize
kubectl apply -k k8s/base/

# Or apply the full overlay (e.g., production)
kubectl apply -k k8s/overlays/production/
```

### 4. Check deployment status

```bash
kubectl get pods -n wgi
kubectl get services -n wgi
kubectl get deployments -n wgi

# Watch rollout
kubectl rollout status deployment/backend -n wgi
```

### 5. View logs in Kubernetes

```bash
kubectl logs -f deployment/backend -n wgi
kubectl logs -f deployment/frontend -n wgi
```

### 6. Port-forward for local access

```bash
# Backend API
kubectl port-forward svc/backend 3001:3001 -n wgi

# Frontend
kubectl port-forward svc/frontend 3000:80 -n wgi

# Grafana
kubectl port-forward svc/grafana 3003:3000 -n wgi
```

### 7. Scale deployments

```bash
kubectl scale deployment backend --replicas=3 -n wgi
```

---

## Helm Deployment

### 1. Install or upgrade the release

```bash
helm upgrade --install wgi ./helm/wgi \
  -n wgi \
  --create-namespace \
  -f helm/wgi/values.yaml
```

### 2. Override values at install time

```bash
helm upgrade --install wgi ./helm/wgi \
  -n wgi \
  --create-namespace \
  --set backend.image.tag=v1.0.0 \
  --set backend.replicaCount=2 \
  --set ingress.enabled=true \
  --set ingress.host=api.wekeza.io
```

### 3. Inspect rendered templates before applying

```bash
helm template wgi ./helm/wgi -f helm/wgi/values.yaml
```

### 4. Check release status

```bash
helm status wgi -n wgi
helm history wgi -n wgi
```

### 5. Rollback

```bash
helm rollback wgi 1 -n wgi   # roll back to revision 1
```

### 6. Uninstall

```bash
helm uninstall wgi -n wgi
```

---

## Database Seeding

Seed files are applied automatically when using Docker Compose (mounted as init scripts). For manual or Kubernetes setups, run them explicitly:

```bash
# Full seed run — all migrations in order
for f in backend/src/database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

### Test account credentials

All test accounts use the password **`Test@1234`**.

| Email | Role | Description |
|-------|------|-------------|
| `demo.user@wekeza.test` | `user` | Standard user with seeded USD wallet ($5,000) |
| `demo.ops@wekeza.test` | `operations` | Operations staff account |
| `demo.admin@wekeza.test` | `admin` | Platform administrator |
| `sandbox.partner@wekeza.test` | `partner` | Sandbox API partner with active API key |
| `compliance@wekeza.test` | `compliance` | Compliance officer account |
| `developer1@wekeza.test` | `user` | Developer sandbox account (API key pre-provisioned) |
| `developer2@wekeza.test` | `user` | Developer sandbox account (API key pre-provisioned) |

> ⚠️ These accounts are for **testing and development only**. Never seed them into a production database.

---

## Sandbox / v1-core Access

The v1-core sandbox exposes WGI core banking functionality to external developers and partners without affecting real funds.

### Authentication

1. Register or use a seeded test account.
2. Obtain a JWT via `POST /auth/login`.
3. Create a sandbox API key via `POST /v1/api-keys` (Bearer token required).
4. Use the `X-API-Key: <your_key>` header for all sandbox endpoints.

### Sandbox base URL

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:3001/v1/sandbox` |
| Docker | `http://localhost:3001/v1/sandbox` |
| Kubernetes (port-forward) | `http://localhost:3001/v1/sandbox` |

### Quick test

```bash
# Health check — no auth required
curl http://localhost:3001/v1/sandbox/health

# Simulate a deposit
curl -X POST http://localhost:3001/v1/sandbox/wallet/deposit \
  -H "X-API-Key: wgi_sandbox_dev1_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{"wallet_id":"<wallet_id>","amount":100,"currency":"USD"}'
```

See [`v1-core/README.md`](v1-core/README.md) for the full API reference.

---

## Wekeza v1-Core Banking System Integration

WekezaGlobal acts as an API gateway between external developers and the Wekeza v1-Core core banking system ([github.com/eodenyire/Wekeza/APIs/v1-Core](https://github.com/eodenyire/Wekeza/tree/main/APIs/v1-Core)).

### Architecture

```
External Developer (API Key / JWT)
         │
         ▼
WekezaGlobal (Node.js / Express)
  /v1/core-banking/*         ← Live proxy routes
  /v1/sandbox/core-banking/* ← Mock routes (no v1-Core needed)
         │
         │ Service JWT (cached in Redis)
         ▼
Wekeza v1-Core (.NET 8)
  http://localhost:5001
  /api/accounts/*, /api/transactions/*, /api/loans/*, /api/cards/*
```

### Step 1 — Start v1-Core

```bash
# Using Docker (recommended)
git clone https://github.com/eodenyire/Wekeza.git
cd Wekeza/APIs/v1-Core
docker compose up -d

# Or manually
dotnet run --project Wekeza.Core.Api
# Swagger UI: http://localhost:5001/swagger
```

### Step 2 — Configure WGI to connect to v1-Core

In your `.env` file:

```env
WEKEZA_CORE_ENABLED=true
WEKEZA_CORE_URL=http://localhost:5001
WEKEZA_CORE_SERVICE_USER=admin
WEKEZA_CORE_SERVICE_PASS=your-v1-core-admin-password
WEKEZA_CORE_TOKEN_TTL=3000
WEKEZA_CORE_TIMEOUT_MS=10000
```

### Step 3 — Verify connectivity

```bash
# Check WGI can reach v1-Core (API key or JWT required)
curl http://localhost:3001/v1/core-banking/health \
  -H "X-API-Key: wgi_sandbox_dev1_key_abc123"

# Expected (v1-Core running):
# { "status": "ok", "message": "WekezaGlobal is connected to Wekeza v1-Core.", ... }

# Expected (v1-Core disabled):
# { "status": "disabled", "message": "Core banking integration is disabled..." }
```

### Step 4 — Call core banking APIs

```bash
# Open a new bank account
curl -X POST http://localhost:3001/v1/core-banking/accounts/open \
  -H "X-API-Key: wgi_sandbox_dev1_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Doe",
    "identification_number": "ID-123456",
    "email": "jane@example.com",
    "phone_number": "+254700000099",
    "account_type": "Savings",
    "currency": "KES",
    "initial_deposit": 5000
  }'

# Apply for a loan
curl -X POST http://localhost:3001/v1/core-banking/loans/apply \
  -H "X-API-Key: wgi_sandbox_dev1_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "account_number": "WKZ-0001-2024",
    "loan_type": "Personal",
    "requested_amount": 100000,
    "currency": "KES",
    "tenure_months": 24,
    "purpose": "Business expansion"
  }'

# M-Pesa STK push
curl -X POST http://localhost:3001/v1/core-banking/payments/mpesa/stk-push \
  -H "X-API-Key: wgi_sandbox_dev1_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "account_number": "WKZ-0001-2024",
    "phone_number": "+254700000001",
    "amount": 2500,
    "reference": "INV-2025-001"
  }'
```

### Using Sandbox When v1-Core Is Unavailable

All live `/v1/core-banking/*` routes have identical sandbox counterparts under `/v1/sandbox/core-banking/*` that return realistic mock responses without requiring a v1-Core instance.

```bash
# Sandbox version — same request shape, same response shape, no v1-Core needed
curl -X POST http://localhost:3001/v1/sandbox/core-banking/loans/apply \
  -H "X-API-Key: wgi_sandbox_dev1_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{ ... same body ... }'
```

---


## Troubleshooting

### Backend fails to start — `ECONNREFUSED` on PostgreSQL

**Cause:** PostgreSQL is not yet healthy when the backend starts.

**Fix (Docker):** The `depends_on` condition is already set to `service_healthy`. If it still fails, increase the `start_period` in the backend healthcheck or run `docker compose restart backend` after PostgreSQL is ready.

**Fix (local):** Verify PostgreSQL is running: `pg_isready -h localhost -U wgi_user`.

---

### `JWT_SECRET` or `SETTLEMENT_WEBHOOK_SECRET` missing

**Symptom:** Backend logs `Error: JWT_SECRET is not set` and exits immediately.

**Fix:** Ensure `.env` exists and contains both values. For Docker: export them or define them in `.env` before running `docker compose up`.

---

### Migration fails with `relation "users" already exists`

**Cause:** Running migrations on a database that was already initialized (e.g., Docker volume persisted from a previous run).

**Fix:** All migration files use `CREATE TABLE IF NOT EXISTS` and `ON CONFLICT DO NOTHING` — they are idempotent. If errors persist, reset the database:

```bash
docker compose down -v   # removes postgres volume
docker compose up -d
```

---

### `kubectl apply -k k8s/base/` — `no such file or directory`

**Cause:** The `k8s/base/kustomization.yaml` file may be missing or the working directory is wrong.

**Fix:** Run from the repository root and verify the directory exists:

```bash
ls k8s/base/
```

---

### Grafana shows "No data" on dashboards

**Cause:** Prometheus is not scraping the backend, or the datasource is not provisioned.

**Fix:**
1. Verify Prometheus can reach the backend: `curl http://localhost:9090/targets`.
2. Check `monitoring/prometheus.yml` for the correct backend scrape target.
3. In Grafana → Configuration → Data Sources, verify the Prometheus URL is `http://prometheus:9090`.

---

### Frontend cannot reach the backend (`Network Error`)

**Cause:** CORS is not configured to allow the frontend origin, or the proxy is misconfigured.

**Fix:**
- Local: Ensure `CORS_ORIGIN=http://localhost:3000` is set in `.env`.
- Docker: The frontend proxies `/api` to the backend via the nginx config. Ensure both containers are on the `wgi_network`.

---

### Redis connection refused

**Cause:** Redis is not running or `REDIS_URL` is incorrect.

**Fix:**
```bash
# Local
redis-cli ping   # should return PONG

# Docker
docker compose ps redis
docker compose restart redis
```

---

### Port conflicts

If a port is already in use, stop the conflicting process or change the host port in `docker-compose.yml`:

```yaml
ports:
  - "3002:3001"   # maps host:3002 → container:3001
```

---

### Viewing all container health states

```bash
docker compose ps
# Check STATUS column — healthy / starting / unhealthy
```
