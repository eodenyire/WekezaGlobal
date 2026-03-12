#!/usr/bin/env bash
# =============================================================================
#  test-developer-flow.sh — End-to-end developer flow test against a LIVE stack
#
#  This script exercises the complete developer onboarding journey using
#  real HTTP calls (curl) against a running WekezaGlobal instance:
#
#   Step 1 — Register a developer account (POST /auth/register)
#   Step 2 — Login and capture JWT         (POST /auth/login)
#   Step 3 — Retrieve profile              (GET  /auth/me)
#   Step 4 — Create an API key             (POST /v1/api-keys)
#   Step 5 — List API keys                 (GET  /v1/api-keys)
#   Step 6 — Call sandbox health           (GET  /v1/sandbox/health)
#   Step 7 — List sandbox accounts         (GET  /v1/sandbox/core-banking/accounts)
#   Step 8 — Open a sandbox account        (POST /v1/sandbox/core-banking/accounts/open)
#   Step 9 — Check account balance         (GET  /v1/sandbox/core-banking/accounts/:number/balance)
#   Step 10 — Fund transfer                (POST /v1/sandbox/core-banking/transactions/transfer)
#   Step 11 — Apply for a loan             (POST /v1/sandbox/core-banking/loans/apply)
#   Step 12 — Issue a card                 (POST /v1/sandbox/core-banking/cards/issue)
#   Step 13 — M-Pesa STK push             (POST /v1/sandbox/core-banking/payments/mpesa/stk-push)
#   Step 14 — Revoke API key               (DELETE /v1/api-keys/:id)
#   Step 15 — Verify revoked key is rejected
#
#  Usage:
#    ./scripts/test-developer-flow.sh [BASE_URL]
#
#  Arguments:
#    BASE_URL   (optional) Default: http://localhost:3001
#
#  Requirements:
#    • curl, jq
#    • WekezaGlobal stack running (./scripts/bring-up.sh)
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3001}"
TIMESTAMP=$(date +%s)
TEST_EMAIL="e2e-dev-${TIMESTAMP}@fintech-test.io"
TEST_PASSWORD="E2eTest@Pass123"
TEST_NAME="E2E Developer ${TIMESTAMP}"

# Colour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No colour

PASS=0
FAIL=0

pass() { echo -e "${GREEN}  ✓ PASS${NC} — $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}  ✗ FAIL${NC} — $1: $2"; FAIL=$((FAIL+1)); }

check_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label (HTTP $actual)"
  else
    fail "$label" "expected HTTP $expected, got HTTP $actual"
  fi
}

# ── Validate prerequisites ────────────────────────────────────────────────────

for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "[ERROR] '$cmd' is required but not installed."
    exit 1
  fi
done

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  WekezaGlobal — End-to-End Developer Flow Test${NC}"
echo -e "${CYAN}  Base URL: ${BASE_URL}${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# ── Wait for stack to be ready ────────────────────────────────────────────────

echo "[INFO] Checking API health..."
MAX_WAIT=30
ELAPSED=0
until curl -sf "${BASE_URL}/health" >/dev/null 2>&1 || [[ $ELAPSED -ge $MAX_WAIT ]]; do
  sleep 2
  ELAPSED=$((ELAPSED+2))
done

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
check_status "API health check" "200" "$HEALTH_STATUS"

if [[ "$HEALTH_STATUS" != "200" ]]; then
  echo ""
  echo "[ERROR] API is not reachable at ${BASE_URL}. Please run ./scripts/bring-up.sh first."
  exit 1
fi

# ── Step 1: Register developer account ───────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 1: Register developer account${NC}"

REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"full_name\": \"${TEST_NAME}\",
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"phone_number\": \"+254700000099\",
    \"account_type\": \"startup\"
  }")

REGISTER_BODY=$(echo "$REGISTER_RESPONSE" | head -n -1)
REGISTER_STATUS=$(echo "$REGISTER_RESPONSE" | tail -n 1)

check_status "Developer registration" "201" "$REGISTER_STATUS"
JWT_TOKEN=$(echo "$REGISTER_BODY" | jq -r '.access_token // empty')

if [[ -z "$JWT_TOKEN" ]]; then
  fail "JWT token extraction" "No access_token in response"
  echo "[ERROR] Cannot continue without JWT. Exiting."
  exit 1
fi

# ── Step 2: Login ─────────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 2: Login${NC}"

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${TEST_EMAIL}\", \"password\": \"${TEST_PASSWORD}\"}")

LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)
LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | tail -n 1)

check_status "Login" "200" "$LOGIN_STATUS"
JWT_TOKEN=$(echo "$LOGIN_BODY" | jq -r '.access_token // empty')

if [[ -z "$JWT_TOKEN" ]]; then
  fail "JWT token from login" "No access_token in login response"
  exit 1
fi

# ── Step 3: Profile ───────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 3: Retrieve developer profile${NC}"

PROFILE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  "${BASE_URL}/auth/me")

check_status "Get profile" "200" "$PROFILE_STATUS"

# ── Step 4: Create API key ────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 4: Create API key${NC}"

KEY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/v1/api-keys" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "E2E Test Key"}')

KEY_BODY=$(echo "$KEY_RESPONSE" | head -n -1)
KEY_STATUS=$(echo "$KEY_RESPONSE" | tail -n 1)

check_status "Create API key" "201" "$KEY_STATUS"

API_KEY=$(echo "$KEY_BODY" | jq -r '.raw_key // empty')
API_KEY_ID=$(echo "$KEY_BODY" | jq -r '.api_key_id // empty')

if [[ -z "$API_KEY" ]]; then
  fail "API key extraction" "No raw_key in response"
  exit 1
fi

echo "  API Key created: ${API_KEY:0:20}… (id: ${API_KEY_ID})"

# ── Step 5: List API keys ─────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 5: List API keys${NC}"

LIST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  "${BASE_URL}/v1/api-keys")

check_status "List API keys" "200" "$LIST_STATUS"

# ── Step 6: Sandbox health ────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 6: Sandbox health check (no auth)${NC}"

SANDBOX_HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE_URL}/v1/sandbox/health")

check_status "Sandbox health" "200" "$SANDBOX_HEALTH_STATUS"

# ── Step 7: List sandbox accounts (API key) ───────────────────────────────────

echo ""
echo -e "${YELLOW}Step 7: List sandbox accounts (using API key)${NC}"

ACCOUNTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: ${API_KEY}" \
  "${BASE_URL}/v1/sandbox/core-banking/accounts")

check_status "List sandbox accounts" "200" "$ACCOUNTS_STATUS"

# ── Step 8: Open sandbox account ─────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 8: Open a sandbox bank account${NC}"

OPEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${BASE_URL}/v1/sandbox/core-banking/accounts/open" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"full_name\": \"${TEST_NAME}\",
    \"identification_number\": \"ID-E2E-${TIMESTAMP}\",
    \"email\": \"${TEST_EMAIL}\",
    \"phone_number\": \"+254700000099\",
    \"account_type\": \"Current\",
    \"currency\": \"KES\",
    \"initial_deposit\": 5000
  }")

OPEN_BODY=$(echo "$OPEN_RESPONSE" | head -n -1)
OPEN_STATUS=$(echo "$OPEN_RESPONSE" | tail -n 1)

check_status "Open sandbox account" "201" "$OPEN_STATUS"
SANDBOX_ACCT=$(echo "$OPEN_BODY" | jq -r '.accountNumber // "WKZ-0001-2024"')
echo "  Account number: ${SANDBOX_ACCT}"

# ── Step 9: Account balance ───────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 9: Get account balance${NC}"

BALANCE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: ${API_KEY}" \
  "${BASE_URL}/v1/sandbox/core-banking/accounts/${SANDBOX_ACCT}/balance")

check_status "Get account balance" "200" "$BALANCE_STATUS"

# ── Step 10: Fund transfer ────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 10: Fund transfer${NC}"

TRANSFER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/v1/sandbox/core-banking/transactions/transfer" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"source_account_number\": \"WKZ-0001-2024\",
    \"destination_account_number\": \"WKZ-0002-2024\",
    \"amount\": 1000,
    \"currency\": \"KES\",
    \"narration\": \"E2E test transfer\"
  }")

check_status "Fund transfer" "201" "$TRANSFER_STATUS"

# ── Step 11: Loan application ─────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 11: Apply for sandbox loan${NC}"

LOAN_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${BASE_URL}/v1/sandbox/core-banking/loans/apply" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_number": "WKZ-0001-2024",
    "amount": 50000,
    "term_months": 12,
    "purpose": "E2E regression test loan"
  }')

LOAN_STATUS=$(echo "$LOAN_RESPONSE" | tail -n 1)
check_status "Loan application" "201" "$LOAN_STATUS"

# ── Step 12: Issue card ───────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 12: Issue sandbox debit card${NC}"

CARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/v1/sandbox/core-banking/cards/issue" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"account_number\": \"WKZ-0001-2024\",
    \"card_type\": \"Debit\",
    \"cardholder_name\": \"$(echo "$TEST_NAME" | tr '[:lower:]' '[:upper:]')\"
  }")

check_status "Issue debit card" "201" "$CARD_STATUS"

# ── Step 13: M-Pesa STK push ──────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 13: M-Pesa STK push${NC}"

MPESA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/v1/sandbox/core-banking/payments/mpesa/stk-push" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_number": "WKZ-0001-2024",
    "phone_number": "+254700000099",
    "amount": 500,
    "reference": "E2E-MPESA-001"
  }')

check_status "M-Pesa STK push" "201" "$MPESA_STATUS"

# ── Step 14: Revoke API key ───────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 14: Revoke API key${NC}"

REVOKE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  "${BASE_URL}/v1/api-keys/${API_KEY_ID}")

REVOKE_STATUS=$(echo "$REVOKE_RESPONSE" | tail -n 1)
check_status "Revoke API key" "200" "$REVOKE_STATUS"

# ── Step 15: Verify revoked key is rejected ───────────────────────────────────

echo ""
echo -e "${YELLOW}Step 15: Verify revoked key is rejected${NC}"

REVOKED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: ${API_KEY}" \
  "${BASE_URL}/v1/sandbox/core-banking/accounts")

check_status "Revoked key rejected" "401" "$REVOKED_STATUS"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  Test Results${NC}"
echo -e "${CYAN}============================================================${NC}"
echo -e "  ${GREEN}PASS: ${PASS}${NC}"
if [[ $FAIL -gt 0 ]]; then
  echo -e "  ${RED}FAIL: ${FAIL}${NC}"
  echo ""
  echo -e "${RED}[RESULT] Some tests FAILED. Review output above.${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}[RESULT] All ${PASS} tests PASSED. Developer flow is working correctly!${NC}"
fi
echo -e "${CYAN}============================================================${NC}"
