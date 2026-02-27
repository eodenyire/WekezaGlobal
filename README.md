# 🌍 Wekeza Global Infrastructure (WGI)

> **Pan-African, Bank-Agnostic, Multi-Currency Financial Infrastructure Platform**

WGI enables African freelancers, SMEs, exporters, and fintechs to receive global payments, manage multi-currency wallets, perform FX optimization, and settle funds to any African bank — all through a unified, secure, programmable platform.

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 💼 **Multi-Currency Wallets** | USD, EUR, GBP, KES wallets with real-time balances |
| 💱 **FX Engine** | Optimal currency conversion with transparent rates |
| 🏦 **Settlement Engine** | Instant withdrawal to any African bank |
| 💳 **Card Issuance** | Virtual & physical Visa/Mastercard cards |
| 🔐 **KYC & Compliance** | Identity verification, AML monitoring |
| 📊 **Credit Intelligence** | Transaction-based credit scoring |
| 🔌 **Programmable APIs** | RESTful APIs with API-key authentication |
| 📈 **Admin Dashboard** | Real-time monitoring, compliance tools |
| 🔔 **Webhooks & Notifications** | Event-driven outbound notifications |
| 🔒 **MFA & Audit Trail** | OTP-based MFA, tamper-proof audit log |

---

## 🚀 Quick Start — Try It From GitHub in 3 Steps

### Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| **Docker** | 24+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| **Docker Compose** | v2 (bundled with Docker Desktop) | bundled |
| **Git** | any | [git-scm.com](https://git-scm.com) |
| Node.js | 20+ | only needed for local dev (Option 2) |

---

### ⚡ Option 1: One-Command Start (Docker Compose — recommended)

```bash
# 1. Clone
git clone https://github.com/eodenyire/WekezaGlobal.git
cd WekezaGlobal

# 2. Start the core stack (frontend + backend + postgres + redis + prometheus + grafana)
docker compose up -d

# 3. Wait ~30 seconds for services to initialise, then open:
#    Frontend web app  →  http://localhost:3000
#    Backend REST API  →  http://localhost:3001/health
#    Prometheus        →  http://localhost:9090
#    Grafana           →  http://localhost:3003  (admin / admin)
```

> 📋 Follow logs in real time: `docker compose logs -f backend`

#### Optional: Start with ELK centralized logging (requires ~2 GB extra RAM)

```bash
docker compose --profile logging up -d
# Kibana → http://localhost:5601
```

---

### 🛠️ Option 2: Local Development (hot-reload)

```bash
# 1. Start only infrastructure dependencies
docker compose up -d postgres redis

# 2. Backend
cd backend
npm install
cp .env.example .env        # safe defaults included — no edits needed for local dev
npm run dev                 # http://localhost:3001

# 3. Frontend (new terminal)
cd ../frontend
npm install
REACT_APP_API_URL=http://localhost:3001 npm start   # http://localhost:3000
```

---

### 🌐 Service & Port Reference

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | React web app |
| **Backend API** | http://localhost:3001 | REST API |
| **API Health** | http://localhost:3001/health | Health check JSON |
| **API Metrics** | http://localhost:3001/metrics | Prometheus scrape endpoint |
| **PostgreSQL** | localhost:5432 | Transactional DB (user: `wgi_user`, pass: `wgi_pass`) |
| **MySQL** | localhost:3306 | Analytics DB (user: `wgi_analytics_user`) |
| **Redis** | localhost:6379 | Cache |
| **Prometheus** | http://localhost:9090 | Metrics collection |
| **Grafana** | http://localhost:3003 | Dashboards (`admin` / `admin`) |
| **Elasticsearch** *(logging profile)* | http://localhost:9200 | Log storage |
| **Kibana** *(logging profile)* | http://localhost:5601 | Log explorer |

---

## 🎯 Demo Walkthrough

Once services are running, follow these steps to explore the full platform:

### Step 1 — Register a user

```bash
curl -s -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "phone_number": "+254712345678",
    "password": "SecurePass123!"
  }' | jq .
```

### Step 2 — Log in and save your token

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"SecurePass123!"}' \
  | jq -r '.access_token')
echo "Token: $TOKEN"
```

### Step 3 — Open the web app

Visit **http://localhost:3000**, click **Register**, and sign up with the same credentials.  
You will land on the **Dashboard** with access to Wallets, FX, Settlements, Cards, KYC, and more.

### Step 4 — Create a wallet and get an FX quote (API)

```bash
# Create a USD wallet
WALLET=$(curl -s -X POST http://localhost:3001/v1/wallets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currency":"USD"}' | jq -r '.id')
echo "Wallet ID: $WALLET"

# Get live FX rates
curl -s http://localhost:3001/v1/fx/rates | jq .
```

### Step 5 — Open Grafana dashboards

Visit **http://localhost:3003** (login: `admin` / `admin`).  
Pre-built dashboards are available under **Dashboards → Browse**:
- **WGI API Overview** — request rates, latencies, error rates
- **WGI Wallet & FX** — wallet operations and FX conversion metrics
- **WGI Settlements** — settlement success/failure rates
- **WGI Compliance** — KYC and AML alert trends

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                    Frontend  (React + TypeScript)                  │
│                       http://localhost:3000                        │
└────────────────────────────┬──────────────────────────────────────┘
                             │ HTTP / REST
┌────────────────────────────▼──────────────────────────────────────┐
│               Backend API  (Node.js 20 + TypeScript)               │
│                       http://localhost:3001                        │
│                                                                    │
│  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Wallet  │  │   FX   │  │Settlement│  │   Card   │            │
│  │ Service  │  │ Engine │  │  Engine  │  │ Service  │            │
│  └──────────┘  └────────┘  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐            │
│  │   KYC /  │  │ Credit │  │  Admin   │  │ Webhooks │            │
│  │   AML    │  │ Engine │  │   API    │  │   API    │            │
│  └──────────┘  └────────┘  └──────────┘  └──────────┘            │
└──────┬───────────────────────────────────┬────────────────────────┘
       │                                   │
┌──────▼──────┐  ┌──────────┐   ┌─────────▼──────────┐
│ PostgreSQL  │  │  MySQL   │   │       Redis         │
│ (Primary DB)│  │(Analytics│   │     (Cache)         │
│  port 5432  │  │  DB)     │   │     port 6379       │
│             │  │ port 3306│   └─────────────────────┘
└─────────────┘  └──────────┘
                                  ┌──────────────────────┐
                                  │  Prometheus  :9090   │
                                  │  Grafana     :3003   │
                                  │  (Monitoring Stack)  │
                                  └──────────────────────┘
                    ┌──────────────────────────────────────┐
                    │  Elasticsearch :9200  (--profile     │
                    │  Logstash      :5044   logging)      │
                    │  Kibana        :5601                 │
                    └──────────────────────────────────────┘
```

---

## 🔌 API Reference

### Authentication

```http
POST /auth/register
Content-Type: application/json

{
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "phone_number": "+254712345678",
  "password": "SecurePass123!"
}
```

```http
POST /auth/login
Content-Type: application/json

{ "email": "jane@example.com", "password": "SecurePass123!" }
```
Returns: `{ "access_token": "...", "token_type": "bearer", "user": { ... } }`

### Wallets

```http
POST   /v1/wallets                         Create wallet (body: {currency})
GET    /v1/wallets                         List my wallets
GET    /v1/wallets/:id/balance             Get balance
POST   /v1/wallets/:id/deposit             Deposit funds
POST   /v1/wallets/:id/withdraw            Withdraw to bank
POST   /v1/wallets/:id/transfer            Transfer to another wallet
```

### FX Engine

```http
GET    /v1/fx/rates                        All live FX rates (public)
POST   /v1/fx/quote                        Get conversion quote
POST   /v1/fx/convert                      Execute FX conversion
```

### Settlements, Cards, KYC, Credit, Admin

```http
GET    /v1/settlements                     List settlements
POST   /v1/settlements                     Initiate settlement
GET/POST /v1/cards                         Card management
GET/POST /v1/kyc                           KYC submission
GET    /v1/credit/score                    Credit score
GET    /v1/admin/users                     Admin: list users (admin role required)
GET    /v1/admin/stats                     Admin: platform statistics
```

Full interactive documentation: visit `GET http://localhost:3001/health` to confirm the service is up, then use the curl examples in the Demo Walkthrough above.

---

## 🏦 Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **API Layer** | Node.js 20 + TypeScript + Express | RESTful API, JWT auth, RBAC |
| **Frontend** | React 18 + TypeScript | React Router v6, responsive UI |
| **Transactional DB** | PostgreSQL 16 | ACID, multi-schema migrations |
| **Analytics DB** | MySQL 8.0 | OLAP reporting, FX history, regulatory summaries |
| **Cache** | Redis 7 | FX rate cache, rate limiting, MFA tokens |
| **Containerisation** | Docker + Docker Compose | Multi-service local stack |
| **Orchestration** | Kubernetes + Helm | Production k8s manifests in `k8s/` and `helm/` |
| **CI/CD** | GitHub Actions | Build, test, security audit, Docker push, Helm deploy |
| **Monitoring** | Prometheus + Grafana | Metrics, alerting rules, 4 pre-built dashboards |
| **Logging** | ELK Stack (Elasticsearch, Logstash, Kibana) | Centralized log aggregation (`--profile logging`) |
| **Authentication** | OAuth2 + JWT + MFA (OTP) | TOTP-style OTP for sensitive operations |
| **Security** | Helmet, bcrypt, AES-256, TLS 1.3, RBAC | Audit trail, rate limiting, parameterised SQL |

---

## 🌍 Supported Currencies

| Currency | Symbol | Region |
|----------|--------|--------|
| USD | $ | Global |
| EUR | € | Europe |
| GBP | £ | UK |
| KES | KSh | Kenya |
| NGN | ₦ | Nigeria *(roadmap)* |
| ZAR | R | South Africa *(roadmap)* |
| GHS | ₵ | Ghana *(roadmap)* |
| TZS | TSh | Tanzania *(roadmap)* |

---

## 🗺️ Roadmap

- **Phase 1 (Current):** Core infrastructure — wallets, FX, settlements, cards, KYC, credit, API keys, webhooks, subscriptions, MFA, audit trail
- **Phase 2:** Mobile apps (React Native), additional African currencies (NGN, ZAR, GHS, TZS)
- **Phase 3:** Credit/lending products, marketplace integrations, Snowflake/Redshift data warehouse
- **Phase 4:** Full pan-African expansion (20+ countries), C# card-issuing microservice, Python ML fraud detection

---

## 🔒 Security

| Control | Implementation |
|---------|---------------|
| Authentication | JWT (1-hour expiry) + OAuth2 flow |
| MFA | OTP tokens stored in Redis, 10-minute TTL, single-use |
| Password hashing | bcrypt (12 rounds) |
| SQL injection | 100% parameterised queries via `pg` driver |
| Rate limiting | 100 req / 15 min per IP (Redis-backed) |
| Security headers | Helmet middleware (CSP, HSTS, etc.) |
| Audit trail | All mutations logged to `audit_logs` table |
| Encryption in transit | TLS 1.3 (enforced at ingress) |
| Encryption at rest | AES-256 at PostgreSQL / disk level |
| RBAC | `user` and `admin` roles enforced on every protected route |

---

## 🐛 Troubleshooting

### Services won't start

```bash
# Check which containers are running
docker compose ps

# See logs for a specific service
docker compose logs backend
docker compose logs postgres
```

### Port already in use

```bash
# Find what is using port 3000 or 3001
lsof -i :3000
lsof -i :3001
```

Change the host port in `docker-compose.yml` if needed, e.g. `"3002:3001"`.

### Database migrations didn't run

```bash
# Destroy the postgres volume and restart (⚠️ deletes all local data)
docker compose down -v
docker compose up -d
```

### Backend exits immediately

```bash
docker compose logs backend
# Most common cause: postgres not ready yet — restart just the backend:
docker compose restart backend
```

### Grafana shows "No data"

Prometheus needs ~30 seconds to start scraping. Reload the dashboard after a minute. Make sure the backend is receiving traffic (use the demo walkthrough curl commands).

### ELK services crash (out of memory)

Elasticsearch requires at least 2 GB of free RAM. On Linux, run:
```bash
sudo sysctl -w vm.max_map_count=262144
```
Or start without the logging profile: `docker compose up -d` (omit `--profile logging`).

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests: `cd backend && npm test`
4. Commit your changes
5. Push to branch and open a Pull Request

---

## 📄 License

Proprietary — Wekeza Bank & Wekeza Global Infrastructure

---

**Built with ❤️ for Africa's digital economy**
