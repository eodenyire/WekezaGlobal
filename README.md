# 🌍 Wekeza Global Infrastructure (WGI)

> **Pan-African, Bank-Agnostic, Multi-Currency Financial Infrastructure Platform**

WGI enables African freelancers, SMEs, exporters, and fintechs to receive global payments, manage multi-currency wallets, perform FX optimization, and settle funds to any African bank — all through a unified, secure, programmable platform.

## ✨ Features

| Module | Description |
|--------|-------------|
| 💼 **Multi-Currency Wallets** | USD, EUR, GBP, KES wallets with real-time balances |
| 💱 **FX Engine** | Optimal currency conversion with transparent rates |
| 🏦 **Settlement Engine** | Instant withdrawal to any African bank |
| 💳 **Card Issuance** | Virtual & physical Visa/Mastercard cards |
| 🔐 **KYC & Compliance** | Identity verification, AML monitoring |
| 📊 **Credit Intelligence** | Transaction-based credit scoring |
| 🔌 **Programmable APIs** | RESTful APIs for fintech integration |
| 📈 **Admin Dashboard** | Real-time monitoring, compliance tools |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                    │
│              http://localhost:3000                    │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Backend API (Node.js/TypeScript)         │
│                 http://localhost:3001                 │
│                                                       │
│  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Wallet  │ │   FX   │ │Settlement│ │   Card   │  │
│  │ Service  │ │ Engine │ │  Engine  │ │ Service  │  │
│  └──────────┘ └────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌────────┐ ┌──────────┐               │
│  │   KYC    │ │ Credit │ │  Admin   │               │
│  │ Service  │ │ Engine │ │   API    │               │
│  └──────────┘ └────────┘ └──────────┘               │
└─────┬──────────────────────────────┬────────────────┘
      │                              │
┌─────▼──────┐                ┌──────▼──────┐
│ PostgreSQL  │                │    Redis    │
│  (Primary  │                │   (Cache)   │
│  Database) │                │             │
└────────────┘                └─────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/eodenyire/WekezaGlobal.git
cd WekezaGlobal

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Access the app
open http://localhost:3000   # Frontend
open http://localhost:3001   # Backend API
```

### Option 2: Local Development

#### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:3001 npm start
```

### Option 3: Backend Only (with Docker for dependencies)
```bash
# Start only dependencies
docker compose up -d postgres redis

# Run backend locally
cd backend
npm install
npm run dev
```

## 🔌 API Documentation

### Authentication
```bash
# Register
POST /auth/register
{
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "phone_number": "+254712345678",
  "password": "SecurePass123!"
}

# Login
POST /auth/login
{ "email": "jane@example.com", "password": "SecurePass123!" }
# Returns: { access_token, token_type, user }
```

### Wallets
```bash
# Create wallet
POST /v1/wallets
Authorization: Bearer <token>
{ "user_id": "<uuid>", "currency": "USD" }

# Get balance
GET /v1/wallets/<wallet_id>/balance
Authorization: Bearer <token>

# Deposit
POST /v1/wallets/<wallet_id>/deposit
Authorization: Bearer <token>
{ "amount": 1000.00, "currency": "USD" }

# Withdraw
POST /v1/wallets/<wallet_id>/withdraw
Authorization: Bearer <token>
{ "amount": 500.00, "currency": "KES", "bank_id": "<bank_uuid>" }
```

### FX Exchange
```bash
# Get all rates
GET /v1/fx/rates

# Convert currency
POST /v1/fx/convert
Authorization: Bearer <token>
{
  "wallet_id": "<uuid>",
  "amount": 100.00,
  "currency_from": "USD",
  "currency_to": "KES"
}
```

### Full API docs available at: `GET /health` shows service status.

## 🏦 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js 20, TypeScript, Express.js |
| **Frontend** | React 18, TypeScript, React Router v6 |
| **Primary DB** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **Auth** | JWT (OAuth2-style) |
| **Containers** | Docker, Docker Compose |
| **CI/CD** | GitHub Actions |
| **Security** | Helmet, CORS, bcrypt, parameterized SQL |

## 🌍 Supported Currencies

| Currency | Symbol | Country |
|----------|--------|---------|
| USD | $ | Global |
| EUR | € | Europe |
| GBP | £ | UK |
| KES | KSh | Kenya |

## 🗺️ Roadmap

- **Phase 1 (Current):** Core infrastructure — wallets, FX, settlements, cards, KYC
- **Phase 2:** Mobile apps (React Native), additional African currencies (NGN, ZAR, GHS, TZS)
- **Phase 3:** Credit/lending products, marketplace integrations
- **Phase 4:** Full pan-African expansion (20+ countries)

## 🔒 Security

- JWT authentication with 1-hour token expiry
- bcrypt password hashing (12 rounds)
- Parameterized SQL queries (no SQL injection)
- Rate limiting (100 req/15min per IP)
- Security headers via Helmet
- TLS 1.3 in production
- AES-256 encryption at rest (database level)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to branch
5. Open a Pull Request

## 📄 License

Proprietary — Wekeza Bank & Wekeza Global Infrastructure

---

**Built with ❤️ for Africa's digital economy**
