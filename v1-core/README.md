# v1-core — WekezaGlobal Sandbox & Developer API

`v1-core` is the sandbox API layer that exposes WekezaGlobal Infrastructure (WGI) core banking functionality to external developers, integration partners, and QA engineers. It provides a safe, isolated environment where you can simulate deposits, FX conversions, and third-party payouts without touching real funds or production settlement rails.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication Methods](#authentication-methods)
3. [Sandbox Endpoints](#sandbox-endpoints)
4. [Core Banking APIs](#core-banking-apis)
5. [Rate Limits](#rate-limits)
6. [Test Accounts](#test-accounts)
7. [Code Examples](#code-examples)
8. [Webhook Events](#webhook-events)

---

## Getting Started

### Step 1 — Register an account

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Developer",
    "email": "jane@example.com",
    "password": "YourPassword123!",
    "phone_number": "+254700000099"
  }'
```

**Response:**
```json
{
  "user_id": "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx",
  "email": "jane@example.com",
  "token": "<jwt_bearer_token>"
}
```

### Step 2 — Create an API key

Use the JWT from Step 1:

```bash
curl -X POST http://localhost:3001/v1/api-keys \
  -H "Authorization: Bearer <jwt_bearer_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Sandbox Key"}'
```

**Response:**
```json
{
  "api_key_id": "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx",
  "api_key": "wgi_sandbox_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "name": "My Sandbox Key",
  "status": "active"
}
```

> ⚠️ Store your API key securely — it will only be shown once.

### Step 3 — Call sandbox endpoints

Include the `X-API-Key` header on every sandbox request:

```bash
curl http://localhost:3001/v1/sandbox/health \
  -H "X-API-Key: wgi_sandbox_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## Authentication Methods

### 1. JWT Bearer Token (user-facing endpoints)

Issued on login or registration. Include in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens expire after **3600 seconds** (1 hour) by default.

### 2. API Key (sandbox / partner endpoints)

Generated via `POST /v1/api-keys`. Include in the `X-API-Key` header:

```
X-API-Key: wgi_sandbox_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. OAuth2 Client Credentials

For server-to-server integrations. Exchange client credentials for a short-lived access token:

```bash
curl -X POST http://localhost:3001/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=wgi-client&client_secret=wgi-client-secret"
```

**Response:**
```json
{
  "access_token": "<jwt_token>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Use the returned `access_token` as a Bearer token in subsequent requests.

---

## Sandbox Endpoints

All sandbox endpoints are prefixed with `/v1/sandbox/`. They simulate real banking operations in an isolated environment — no real funds move.

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/v1/sandbox/health` | None | Sandbox health check |

```bash
curl http://localhost:3001/v1/sandbox/health
```

**Response:**
```json
{ "status": "ok", "env": "sandbox", "timestamp": "2024-01-01T00:00:00.000Z" }
```

---

### Wallet

#### Simulate a Deposit

| Method | Endpoint | Auth |
|--------|----------|------|
| `POST` | `/v1/sandbox/wallet/deposit` | API Key |

```bash
curl -X POST http://localhost:3001/v1/sandbox/wallet/deposit \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_id": "<wallet_uuid>",
    "amount": 500.00,
    "currency": "USD",
    "reference": "sandbox-test-001"
  }'
```

**Response:**
```json
{
  "transaction_id": "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx",
  "status": "completed",
  "amount": 500.00,
  "currency": "USD",
  "balance_after": 5500.00
}
```

---

### FX Conversion

#### Simulate an FX Conversion

| Method | Endpoint | Auth |
|--------|----------|------|
| `POST` | `/v1/sandbox/fx/convert` | API Key |

```bash
curl -X POST http://localhost:3001/v1/sandbox/fx/convert \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "from_currency": "USD",
    "to_currency": "KES",
    "amount": 100.00,
    "wallet_id": "<wallet_uuid>"
  }'
```

**Response:**
```json
{
  "fx_transaction_id": "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx",
  "from_currency": "USD",
  "to_currency": "KES",
  "from_amount": 100.00,
  "to_amount": 13450.00,
  "rate": 134.50,
  "status": "completed"
}
```

---

### Third-Party Integrations

#### PayPal Payout

| Method | Endpoint | Auth |
|--------|----------|------|
| `POST` | `/v1/sandbox/integrations/paypal/payout` | API Key |

```bash
curl -X POST http://localhost:3001/v1/sandbox/integrations/paypal/payout \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "recipient@example.com",
    "amount": 50.00,
    "currency": "USD",
    "note": "Test payout"
  }'
```

#### Stripe Transfer

| Method | Endpoint | Auth |
|--------|----------|------|
| `POST` | `/v1/sandbox/integrations/stripe/transfer` | API Key |

```bash
curl -X POST http://localhost:3001/v1/sandbox/integrations/stripe/transfer \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "destination_account": "acct_sandbox_example",
    "amount": 200.00,
    "currency": "USD"
  }'
```

#### Wise Transfer

| Method | Endpoint | Auth |
|--------|----------|------|
| `POST` | `/v1/sandbox/integrations/wise/transfer` | API Key |

```bash
curl -X POST http://localhost:3001/v1/sandbox/integrations/wise/transfer \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "target_account_id": "wise_sandbox_account_001",
    "amount": 75.00,
    "currency": "GBP",
    "reference": "invoice-2024-001"
  }'
```

---

## Core Banking APIs

These endpoints require **JWT Bearer token** authentication and operate on real (or seeded) account data.

### Wallets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/wallets` | List all wallets for the authenticated user |
| `GET` | `/v1/wallets/:id` | Get wallet details and balance |
| `POST` | `/v1/wallets` | Create a new wallet |
| `GET` | `/v1/wallets/:id/transactions` | Get wallet transaction history |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/transactions` | List transactions (paginated) |
| `GET` | `/v1/transactions/:id` | Get transaction details |
| `POST` | `/v1/transactions/transfer` | Internal wallet-to-wallet transfer |

### FX

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/fx/rates` | Get live FX rates |
| `POST` | `/v1/fx/convert` | Convert currency (live) |
| `GET` | `/v1/fx/history` | FX transaction history |

### Settlements

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/settlements` | Initiate a bank settlement |
| `GET` | `/v1/settlements/:id` | Get settlement status |
| `GET` | `/v1/settlements` | List settlements |

### Banks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/banks` | List supported partner banks |
| `GET` | `/v1/banks/:id` | Get bank details |

### Cards

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/cards` | List user cards |
| `POST` | `/v1/cards` | Issue a new virtual/physical card |
| `PUT` | `/v1/cards/:id/freeze` | Freeze a card |
| `PUT` | `/v1/cards/:id/unfreeze` | Unfreeze a card |

### KYC

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/kyc/documents` | Upload a KYC document |
| `GET` | `/v1/kyc/status` | Get KYC verification status |

### Credit

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/credit/score` | Retrieve credit score |
| `POST` | `/v1/credit/apply` | Apply for credit |

### API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/api-keys` | Create a new API key |
| `GET` | `/v1/api-keys` | List all API keys for the user |
| `DELETE` | `/v1/api-keys/:id` | Revoke an API key |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/webhooks` | Register a webhook endpoint |
| `GET` | `/v1/webhooks` | List registered webhooks |
| `DELETE` | `/v1/webhooks/:id` | Delete a webhook |

---

## Rate Limits

| Tier | Limit | Window |
|------|-------|--------|
| Default (API key) | 1,000 requests | 1 hour |
| Partner (elevated) | 10,000 requests | 1 hour |
| OAuth2 client | 5,000 requests | 1 hour |

Rate limit headers are included in every response:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1704067200
```

When a limit is exceeded, the API returns `429 Too Many Requests`.

---

## Test Accounts

All test accounts use the password **`Test@1234`**.

| Email | Role | Notes |
|-------|------|-------|
| `demo.user@wekeza.test` | `user` | USD wallet pre-funded with $5,000 |
| `demo.ops@wekeza.test` | `operations` | Operations staff access |
| `demo.admin@wekeza.test` | `admin` | Full platform administration |
| `sandbox.partner@wekeza.test` | `partner` | Active sandbox API key pre-provisioned |
| `compliance@wekeza.test` | `compliance` | Compliance officer — AML/KYC views |
| `developer1@wekeza.test` | `user` | Developer account — API key: `wgi_sandbox_dev1_key_abc123` |
| `developer2@wekeza.test` | `user` | Developer account — API key: `wgi_sandbox_dev2_key_def456` |

> ⚠️ These accounts exist only in local/development environments. Never seed them into production.

---

## Code Examples

### Register a new user

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Developer",
    "email": "jane@example.com",
    "password": "YourPassword123!",
    "phone_number": "+254700000099"
  }'
```

### Login and get a JWT

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "developer1@wekeza.test", "password": "Test@1234"}'
```

### Create an API key

```bash
curl -X POST http://localhost:3001/v1/api-keys \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Integration Key"}'
```

### Sandbox deposit

```bash
curl -X POST http://localhost:3001/v1/sandbox/wallet/deposit \
  -H "X-API-Key: wgi_sandbox_dev1_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_id": "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "amount": 250.00,
    "currency": "USD"
  }'
```

### FX conversion (sandbox)

```bash
curl -X POST http://localhost:3001/v1/sandbox/fx/convert \
  -H "X-API-Key: wgi_sandbox_dev1_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "from_currency": "USD",
    "to_currency": "KES",
    "amount": 100.00,
    "wallet_id": "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
  }'
```

### Get live FX rates (JWT required)

```bash
curl http://localhost:3001/v1/fx/rates \
  -H "Authorization: Bearer <jwt_token>"
```

### Register a webhook

```bash
curl -X POST http://localhost:3001/v1/webhooks \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.example.com/webhooks/wgi",
    "events": ["transaction.completed", "settlement.completed", "kyc.verified"]
  }'
```

### OAuth2 client credentials flow

```bash
curl -X POST http://localhost:3001/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=wgi-client&client_secret=wgi-client-secret"
```

---

## Webhook Events

WGI delivers webhook payloads to your registered URL via HTTP POST. Payloads are signed with `HMAC-SHA256` using your `SETTLEMENT_WEBHOOK_SECRET`.

### Supported Events

| Event | Description |
|-------|-------------|
| `transaction.completed` | A transaction has successfully completed |
| `transaction.failed` | A transaction has failed |
| `transaction.pending` | A transaction is awaiting processing |
| `settlement.initiated` | A bank settlement has been initiated |
| `settlement.completed` | A bank settlement has completed |
| `settlement.failed` | A bank settlement has failed |
| `fx.converted` | An FX conversion has completed |
| `wallet.created` | A new wallet has been created |
| `wallet.funded` | A wallet balance has been credited |
| `kyc.submitted` | A KYC document has been submitted |
| `kyc.verified` | KYC verification has passed |
| `kyc.rejected` | KYC verification has been rejected |
| `card.issued` | A new card has been issued |
| `card.frozen` | A card has been frozen |
| `card.transaction` | A card transaction has occurred |
| `aml.alert` | An AML alert has been raised |
| `credit.approved` | A credit application has been approved |
| `credit.rejected` | A credit application has been rejected |
| `api_key.created` | A new API key has been created |
| `api_key.revoked` | An API key has been revoked |

### Example webhook payload

```json
{
  "event": "transaction.completed",
  "webhook_id": "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "transaction_id": "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx",
    "wallet_id": "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx",
    "type": "deposit",
    "amount": 500.00,
    "currency": "USD",
    "status": "completed"
  }
}
```

### Verifying webhook signatures

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}
```

The signature is delivered in the `X-WGI-Signature` request header.

---

## Wekeza v1-Core Banking System Integration

WekezaGlobal acts as an API **gateway** between your application and the Wekeza v1-Core core banking system (source: [github.com/eodenyire/Wekeza/APIs/v1-Core](https://github.com/eodenyire/Wekeza/tree/main/APIs/v1-Core)).

### What is v1-Core?

Wekeza v1-Core is a .NET 8 core banking system that provides:
- **Account Management** — open, freeze, close accounts; CIF (Customer Information File)
- **Transactions** — internal transfers, M-Pesa STK push / callbacks, cheque clearing
- **Loans** — origination, credit scoring, approval workflow, disbursement, repayment
- **Cards** — debit/credit/prepaid issuance, ATM withdrawals, card controls
- **Payments** — SWIFT, SEPA, ACH, RTGS cross-border payment rails
- **Compliance** — AML/KYC workflows, risk assessment, audit trails
- **General Ledger** — double-entry bookkeeping, COA management, GL postings

### API Gateway Pattern

```
Your Application
     │
     │  X-API-Key: wgi_...
     ▼
WekezaGlobal (WGI)           ← You are here
  /v1/core-banking/*         ← Live routes (proxy to v1-Core)
  /v1/sandbox/core-banking/* ← Sandbox routes (mock responses)
     │
     │  Bearer <service-jwt>
     ▼
Wekeza v1-Core (.NET 8)      ← github.com/eodenyire/Wekeza/APIs/v1-Core
  /api/accounts/*
  /api/transactions/*
  /api/loans/*
  /api/cards/*
  /api/payments/*
```

WGI handles:
- **API key validation & rate limiting** — your key is checked before any request reaches v1-Core
- **Service token management** — WGI authenticates to v1-Core as a service account and caches the JWT in Redis
- **Request translation** — WGI converts WGI-style JSON → v1-Core .NET request shapes
- **Error normalisation** — 404/400/5xx from v1-Core are translated into standard WGI error JSON

### Live Routes (`/v1/core-banking/*`)

These proxy to a running v1-Core instance. Enable by setting `WEKEZA_CORE_ENABLED=true` and `WEKEZA_CORE_URL=http://<v1-core-host>:5001`.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/v1/core-banking/health` | Check v1-Core connectivity |
| `GET`  | `/v1/core-banking/accounts` | List accounts (paginated) |
| `GET`  | `/v1/core-banking/accounts/:accountNumber` | Get account details |
| `POST` | `/v1/core-banking/accounts/open` | Open a new account |
| `GET`  | `/v1/core-banking/accounts/:accountNumber/balance` | Get account balance |
| `GET`  | `/v1/core-banking/accounts/:accountNumber/statement` | Get account statement |
| `POST` | `/v1/core-banking/transactions/transfer` | Transfer between accounts |
| `POST` | `/v1/core-banking/transactions/deposit` | M-Pesa / mobile deposit |
| `POST` | `/v1/core-banking/loans/apply` | Apply for a loan |
| `GET`  | `/v1/core-banking/loans/:loanId` | Get loan details + schedule |
| `POST` | `/v1/core-banking/loans/:loanId/repay` | Make a loan repayment |
| `POST` | `/v1/core-banking/cards/issue` | Issue a debit/credit/prepaid card |
| `POST` | `/v1/core-banking/payments/transfer` | Cross-bank payment (SWIFT/SEPA/ACH/RTGS) |
| `POST` | `/v1/core-banking/payments/mpesa/stk-push` | Trigger M-Pesa STK push |

### Sandbox Routes (`/v1/sandbox/core-banking/*`)

Use these during development — no live v1-Core instance required. All responses include `"sandbox": true` and `"core_banking": true`.

| Method | Path |
|--------|------|
| `GET`  | `/v1/sandbox/core-banking/accounts` |
| `GET`  | `/v1/sandbox/core-banking/accounts/:accountNumber` |
| `POST` | `/v1/sandbox/core-banking/accounts/open` |
| `GET`  | `/v1/sandbox/core-banking/accounts/:accountNumber/balance` |
| `GET`  | `/v1/sandbox/core-banking/accounts/:accountNumber/statement` |
| `POST` | `/v1/sandbox/core-banking/transactions/transfer` |
| `POST` | `/v1/sandbox/core-banking/transactions/deposit` |
| `POST` | `/v1/sandbox/core-banking/loans/apply` |
| `GET`  | `/v1/sandbox/core-banking/loans/:loanId` |
| `POST` | `/v1/sandbox/core-banking/loans/:loanId/repay` |
| `POST` | `/v1/sandbox/core-banking/cards/issue` |
| `POST` | `/v1/sandbox/core-banking/payments/transfer` |
| `POST` | `/v1/sandbox/core-banking/payments/mpesa/stk-push` |

### Code Examples

#### Open a new bank account (sandbox)

```bash
curl -X POST http://localhost:3001/v1/sandbox/core-banking/accounts/open \
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
```

**Response:**
```json
{
  "sandbox": true,
  "core_banking": true,
  "accountId": "uuid",
  "accountNumber": "WKZ-4271-SAND",
  "accountType": "Savings",
  "currency": "KES",
  "status": "Active",
  "createdAt": "2025-03-12T10:00:00.000Z"
}
```

#### Apply for a loan (sandbox)

```bash
curl -X POST http://localhost:3001/v1/sandbox/core-banking/loans/apply \
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
```

**Response:**
```json
{
  "sandbox": true,
  "core_banking": true,
  "loanId": "uuid",
  "loanNumber": "LN-SAND-12345",
  "status": "Approved",
  "requestedAmount": 100000,
  "approvedAmount": 100000,
  "currency": "KES",
  "tenureMonths": 24,
  "interestRate": 13.5,
  "monthlyInstalment": 5052.08,
  "creditScore": 720,
  "message": "Loan application approved. Pending disbursement."
}
```

#### M-Pesa STK Push (sandbox)

```bash
curl -X POST http://localhost:3001/v1/sandbox/core-banking/payments/mpesa/stk-push \
  -H "X-API-Key: wgi_sandbox_dev1_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "account_number": "WKZ-0001-2024",
    "phone_number": "+254700000001",
    "amount": 2500,
    "reference": "INV-2025-001",
    "description": "School fees payment"
  }'
```

**Response:**
```json
{
  "sandbox": true,
  "core_banking": true,
  "checkoutRequestId": "ws_CO_1741773600000",
  "merchantRequestId": "SAND-ABC12345",
  "responseCode": "0",
  "responseDescription": "Success. Request accepted for processing",
  "customerMessage": "Please enter your M-Pesa PIN to complete payment of KES 2500 to INV-2025-001."
}
```

### Running v1-Core Locally

To use the live `/v1/core-banking/*` routes you need a running v1-Core instance:

```bash
# Clone the Wekeza repo
git clone https://github.com/eodenyire/Wekeza.git
cd Wekeza/APIs/v1-Core

# Start with Docker
docker compose up -d

# Or run manually (.NET 8 SDK required)
dotnet run --project Wekeza.Core.Api

# Default URL: http://localhost:5001
# Swagger UI: http://localhost:5001/swagger
```

Then in WGI `.env`:
```env
WEKEZA_CORE_ENABLED=true
WEKEZA_CORE_URL=http://localhost:5001
WEKEZA_CORE_SERVICE_USER=admin          # Or a dedicated service account
WEKEZA_CORE_SERVICE_PASS=your-password
```

### API Key Scopes

API keys have a `scopes` array that controls which v1-Core features a developer can access:

| Scope | Routes unlocked |
|-------|----------------|
| `core_banking` | `/v1/core-banking/*` |
| `fx` | `/v1/fx/*` |
| `payments` | `/v1/core-banking/payments/*` |
| `lending` | `/v1/core-banking/loans/*` |
| `cards` | `/v1/core-banking/cards/*` |
| `compliance` | `/v1/kyc/*`, `/v1/aml/*` |
| `reporting` | `/v1/core-banking/accounts/*/statement` |
| `webhooks` | `/v1/webhooks/*` |

Sandbox API keys (`wgi_sandbox_dev1_key_abc123` / `wgi_sandbox_dev2_key_def456`) are seeded with all scopes.

