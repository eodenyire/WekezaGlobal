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
