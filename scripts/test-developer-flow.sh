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

# Color output
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

# ── Step 16: Create a second API key and check both appear ────────────────────

echo ""
echo -e "${YELLOW}Step 16: Create second API key + list both${NC}"

KEY2_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/v1/api-keys" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "E2E Test Key #2"}')

KEY2_STATUS=$(echo "$KEY2_RESPONSE" | tail -n 1)
KEY2_BODY=$(echo "$KEY2_RESPONSE" | head -n -1)
check_status "Create second API key" "201" "$KEY2_STATUS"
API_KEY2=$(echo "$KEY2_BODY" | jq -r '.raw_key // empty')
API_KEY2_ID=$(echo "$KEY2_BODY" | jq -r '.api_key_id // empty')

LIST2_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" "${BASE_URL}/v1/api-keys")
LIST2_STATUS=$(echo "$LIST2_RESPONSE" | tail -n 1)
LIST2_COUNT=$(echo "$LIST2_RESPONSE" | head -n -1 | jq -r '.api_keys | length')
check_status "List keys shows both" "200" "$LIST2_STATUS"
if [[ "$LIST2_COUNT" -ge 2 ]]; then
  pass "Two API keys visible in list (count: ${LIST2_COUNT})"
else
  fail "Expected >=2 keys" "got ${LIST2_COUNT}"
fi

# ── Step 17: API key usage tracking ──────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 17: Check API key usage tracking${NC}"

USAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  "${BASE_URL}/v1/api-keys/${API_KEY2_ID}/usage")
check_status "API key usage endpoint" "200" "$USAGE_STATUS"

# ── Step 18: Account statement ────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 18: Account statement${NC}"

STMT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: ${API_KEY2}" \
  "${BASE_URL}/v1/sandbox/core-banking/accounts/${SANDBOX_ACCT}/statement")
check_status "Account statement" "200" "$STMT_STATUS"

# ── Step 19: Register webhook ─────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 19: Register a webhook${NC}"

WH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/v1/webhooks" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/e2e-test",
    "events": ["deposit", "settlement_completed", "kyc_approved"]
  }')
WH_STATUS=$(echo "$WH_RESPONSE" | tail -n 1)
WH_BODY=$(echo "$WH_RESPONSE" | head -n -1)
check_status "Register webhook" "201" "$WH_STATUS"
WH_ID=$(echo "$WH_BODY" | jq -r '.webhook_id // empty')

# ── Step 20: List webhooks ────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 20: List webhooks${NC}"

WH_LIST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" "${BASE_URL}/v1/webhooks")
check_status "List webhooks" "200" "$WH_LIST_STATUS"

# ── Step 21: Developer analytics ─────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 21: Developer analytics${NC}"

ANALYTICS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" "${BASE_URL}/v1/developer/analytics")
check_status "Developer analytics" "200" "$ANALYTICS_STATUS"

# ── Step 22: Developer event stream ──────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 22: Developer event stream${NC}"

EVENTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" "${BASE_URL}/v1/developer/events")
check_status "Developer event stream" "200" "$EVENTS_STATUS"

# ── Step 23: API changelog ────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 23: API changelog${NC}"

CHANGELOG_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" "${BASE_URL}/v1/developer/changelog")
CHANGELOG_STATUS=$(echo "$CHANGELOG_RESPONSE" | tail -n 1)
CHANGELOG_COUNT=$(echo "$CHANGELOG_RESPONSE" | head -n -1 | jq -r '.changelog | length')
check_status "API changelog" "200" "$CHANGELOG_STATUS"
if [[ "$CHANGELOG_COUNT" -gt 0 ]]; then
  pass "Changelog has ${CHANGELOG_COUNT} release entries"
else
  fail "Changelog entries missing" "got ${CHANGELOG_COUNT}"
fi

# ── Step 24: Partner Risk Assessment ─────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 24: Partner Risk Assessment${NC}"

RISK_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/v1/partner/risk/assess" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"account_id": "ACC-001", "amount": 500, "currency": "KES", "transaction_type": "transfer"}')
RISK_STATUS=$(echo "$RISK_RESPONSE" | tail -n 1)
RISK_LEVEL=$(echo "$RISK_RESPONSE" | head -n -1 | jq -r '.risk_level // "unknown"')
check_status "Partner Risk Assessment" "200" "$RISK_STATUS"
echo "  Risk level for KES 500: ${RISK_LEVEL}"

# ── Step 25: Partner Identity Verification ───────────────────────────────────

echo ""
echo -e "${YELLOW}Step 25: Partner Identity Verification${NC}"

IDENTITY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/v1/partner/identity/verify" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"full_name": "John Kamau", "identification_number": "KE34567890", "id_type": "national_id"}')
check_status "Partner Identity Verify" "201" "$IDENTITY_STATUS"

# ── Step 26: Partner Payment ──────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 26: Partner Payment Initiation${NC}"

PARTNER_PMT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/v1/partner/payments" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "source_account": "WKZ-0001-2024",
    "destination_account": "WKZ-0002-2024",
    "amount": 2500,
    "currency": "KES",
    "payment_rail": "MPESA",
    "narration": "E2E partner payment test"
  }')
check_status "Partner Payment Initiation" "201" "$PARTNER_PMT_STATUS"

# ── Step 27: Core banking health check ───────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 27: Core banking health check${NC}"

CORE_HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  "${BASE_URL}/v1/core-banking/health")
CORE_HEALTH_STATUS=$(echo "$CORE_HEALTH_RESPONSE" | tail -n 1)
CORE_HEALTH_BODY=$(echo "$CORE_HEALTH_RESPONSE" | head -n -1)
check_status "Core banking health check" "200" "$CORE_HEALTH_STATUS"
CORE_STATUS=$(echo "$CORE_HEALTH_BODY" | jq -r '.status // "unknown"')
echo "  v1-Core status: ${CORE_STATUS}"
if [[ "$CORE_STATUS" == "disabled" ]]; then
  echo -e "  ${YELLOW}[INFO] v1-Core is in sandbox/disabled mode (WEKEZA_CORE_ENABLED=false).${NC}"
  echo -e "  ${YELLOW}       Set WEKEZA_CORE_URL and WEKEZA_CORE_ENABLED=true to enable live proxy.${NC}"
elif [[ "$CORE_STATUS" == "ok" ]]; then
  echo -e "  ${GREEN}[INFO] v1-Core is live and reachable!${NC}"
else
  echo -e "  ${RED}[WARN] Unexpected v1-Core status: '${CORE_STATUS}'. Check WEKEZA_CORE_URL and backend logs.${NC}"
fi

# ── Step 28: Sandbox core-banking accounts (with second key) ─────────────────

echo ""
echo -e "${YELLOW}Step 28: Sandbox core-banking account details${NC}"

ACCT_DETAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: ${API_KEY2}" \
  "${BASE_URL}/v1/sandbox/core-banking/accounts/WKZ-0001-2024")
check_status "Sandbox account detail" "200" "$ACCT_DETAIL_STATUS"

# ── Step 29: Delete webhook ───────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 29: Delete webhook${NC}"

if [[ -n "$WH_ID" ]]; then
  DEL_WH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    "${BASE_URL}/v1/webhooks/${WH_ID}")
  check_status "Delete webhook" "204" "$DEL_WH_STATUS"
else
  fail "Delete webhook" "No webhook ID to delete"
fi

# ── Step 30: Verify deleted webhook is gone ───────────────────────────────────

echo ""
echo -e "${YELLOW}Step 30: Verify webhook list is empty after deletion${NC}"

WH_LIST2_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" "${BASE_URL}/v1/webhooks")
WH_LIST2_STATUS=$(echo "$WH_LIST2_RESPONSE" | tail -n 1)
WH_LIST2_COUNT=$(echo "$WH_LIST2_RESPONSE" | head -n -1 | jq -r '.webhooks | length')
check_status "Webhook list" "200" "$WH_LIST2_STATUS"
if [[ "$WH_LIST2_COUNT" -eq 0 ]]; then
  pass "Webhook successfully deleted (list is empty)"
else
  fail "Webhook deletion" "expected 0 webhooks, got ${WH_LIST2_COUNT}"
fi

# ── Step 31: Revoke second API key ────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 31: Revoke second API key${NC}"

if [[ -n "$API_KEY2_ID" ]]; then
  REVOKE2_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    "${BASE_URL}/v1/api-keys/${API_KEY2_ID}")
  check_status "Revoke second API key" "200" "$REVOKE2_STATUS"
fi

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
