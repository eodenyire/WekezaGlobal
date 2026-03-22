# End-to-End Tests

This directory contains end-to-end test scripts and tooling for the WekezaGlobal
developer ecosystem. These tests run against a **live, fully running** stack and
complement the mocked unit/integration tests in `backend/src/tests/`.

## Structure

```
tests/
└── e2e/
    ├── README.md                    This file
    └── take-screenshots.js         Automated screenshot capture (Playwright)
```

## Running E2E Tests

### 1. Start the Stack

```bash
./scripts/bring-up.sh
```

### 2. Run the Developer Flow Test

This script exercises the complete developer journey using curl:

```bash
./scripts/test-developer-flow.sh
```

Expected output:
```
✓ PASS — API health check (HTTP 200)
✓ PASS — Developer registration (HTTP 201)
✓ PASS — Login (HTTP 200)
✓ PASS — Get profile (HTTP 200)
✓ PASS — Create API key (HTTP 201)
✓ PASS — List API keys (HTTP 200)
✓ PASS — Sandbox health (HTTP 200)
✓ PASS — List sandbox accounts (HTTP 200)
✓ PASS — Open sandbox account (HTTP 201)
✓ PASS — Get account balance (HTTP 200)
✓ PASS — Fund transfer (HTTP 201)
✓ PASS — Loan application (HTTP 201)
✓ PASS — Issue debit card (HTTP 201)
✓ PASS — M-Pesa STK push (HTTP 201)
✓ PASS — Revoke API key (HTTP 200)
✓ PASS — Revoked key rejected (HTTP 401)
```

### 3. Take Screenshots (Optional)

```bash
# Install Playwright (one-time)
npm install -D playwright
npx playwright install chromium

# Run screenshot script
node tests/e2e/take-screenshots.js http://localhost:3000 http://localhost:3001
```

Screenshots are saved to `screenshots/developer-ecosystem/`.

## Running Unit & Regression Tests (No Live Stack Required)

All unit and regression tests use mocked infrastructure and run without
any external services:

```bash
# Run all tests
./scripts/run-regression-tests.sh

# With coverage report
./scripts/run-regression-tests.sh --coverage

# Run only regression tests
cd backend
npx jest --testPathPattern="regression"
```

## Test Coverage

| Test Suite | File | Tests |
|-----------|------|-------|
| Integration | `backend/src/tests/integration.test.ts` | 216+ |
| Developer Ecosystem Regression | `backend/src/tests/regression-developer-ecosystem.test.ts` | 53 |
| Middleware tests | `backend/src/middleware/errorHandler.test.ts` | — |
| Service unit tests | `backend/src/services/*.test.ts` | — |

## Developer Ecosystem Flow Coverage

The regression test suite (`regression-developer-ecosystem.test.ts`) covers:

| Step | Description | Endpoint |
|------|-------------|----------|
| 1 | Register developer account | `POST /auth/register` |
| 2 | Login with credentials | `POST /auth/login` |
| 2a | OAuth2 client credentials | `POST /auth/token` |
| 3 | Get/update profile | `GET/PUT /auth/me` |
| 4 | Create API key | `POST /v1/api-keys` |
| 5 | List API keys | `GET /v1/api-keys` |
| 6 | Check API key usage | `GET /v1/api-keys/:id/usage` |
| 7 | Sandbox health | `GET /v1/sandbox/health` |
| 8a | List sandbox accounts | `GET /v1/sandbox/core-banking/accounts` |
| 8b | Get sandbox account | `GET /v1/sandbox/core-banking/accounts/:number` |
| 8c | Open sandbox account | `POST /v1/sandbox/core-banking/accounts/open` |
| 8d | Get account balance | `GET /v1/sandbox/core-banking/accounts/:number/balance` |
| 8e | Get account statement | `GET /v1/sandbox/core-banking/accounts/:number/statement` |
| 8f | Fund transfer | `POST /v1/sandbox/core-banking/transactions/transfer` |
| 8g | M-Pesa deposit | `POST /v1/sandbox/core-banking/transactions/deposit` |
| 8h | Loan application | `POST /v1/sandbox/core-banking/loans/apply` |
| 8i | Loan details & repayment | `GET/POST /v1/sandbox/core-banking/loans/:id` |
| 8j | Card issuance | `POST /v1/sandbox/core-banking/cards/issue` |
| 8k | Cross-bank payment | `POST /v1/sandbox/core-banking/payments/transfer` |
| 8l | M-Pesa STK push | `POST /v1/sandbox/core-banking/payments/mpesa/stk-push` |
| 9 | Revoke API key | `DELETE /v1/api-keys/:id` |
| 10 | Verify revoked key rejected | `GET /v1/sandbox/*` with revoked key |
| 11 | Live core banking disabled | `GET /v1/core-banking/*` → 503 |
| 12 | Webhook registration | `POST /v1/webhooks` |
| 13 | Subscription plans | `GET /v1/subscriptions/plans` |
| 14 | Admin API key overview | `GET /v1/api-keys/all` |
