# Screenshots — Developer Ecosystem

This directory contains screenshots documenting the WekezaGlobal developer ecosystem in action.

## Directory Structure

```
screenshots/
└── developer-ecosystem/
    ├── 01-registration/          Developer account registration flow
    ├── 02-login/                 Login and JWT token acquisition
    ├── 03-api-key-management/    Creating and managing API keys
    ├── 04-sandbox-testing/       Sandbox API calls (core banking)
    ├── 05-monitoring/            Grafana dashboards and Prometheus metrics
    └── 06-developer-portal/     Frontend developer portal screenshots
```

## How to Take Screenshots

### 1. Start the Stack

```bash
./scripts/bring-up.sh
```

### 2. Open the Developer Portal

Navigate to: **http://localhost:3000**

### 3. Capture the Developer Registration Flow

1. Open the **Register** page at http://localhost:3000/register
2. Fill in:
   - Full Name: your name
   - Email: your@fintech.io
   - Password: (min 8 chars)
   - Account Type: startup / freelancer / sme / etc.
3. Click **Register**
4. Take a screenshot of the registration form and the success response
5. Save as: `01-registration/registration-form.png` and `01-registration/registration-success.png`

### 4. Capture Login

1. Open **http://localhost:3000/login**
2. Enter credentials from step 3
3. Take a screenshot of the login form
4. After login, take a screenshot of the dashboard
5. Save as: `02-login/login-form.png` and `02-login/dashboard.png`

### 5. Capture API Key Creation

1. Navigate to **API Keys** in the developer portal
2. Click **Create New API Key**
3. Enter a name (e.g., "My Fintech App")
4. Take a screenshot showing:
   - The API key creation form
   - The newly created key (showing the raw key before it's hidden)
   - The API keys list
5. Save as: `03-api-key-management/create-key.png`, `03-api-key-management/key-created.png`, `03-api-key-management/keys-list.png`

### 6. Capture Sandbox API Calls

Using curl or Postman/Insomnia with the API key from step 5:

```bash
# List sandbox accounts
curl -H "X-API-Key: wgi_<your-key>" \
  http://localhost:3001/v1/sandbox/core-banking/accounts

# Open a sandbox account
curl -X POST http://localhost:3001/v1/sandbox/core-banking/accounts/open \
  -H "X-API-Key: wgi_<your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Alice Developer",
    "identification_number": "ID-12345",
    "email": "alice@fintech.io",
    "phone_number": "+254700000001",
    "account_type": "Current",
    "currency": "KES",
    "initial_deposit": 5000
  }'

# Check balance
curl -H "X-API-Key: wgi_<your-key>" \
  http://localhost:3001/v1/sandbox/core-banking/accounts/WKZ-0001-2024/balance
```

Take screenshots of:
- The API request and response in a REST client
- The terminal output of curl commands
Save as: `04-sandbox-testing/sandbox-accounts.png`, `04-sandbox-testing/open-account.png`, etc.

### 7. Capture Monitoring Dashboards

1. Open Grafana at **http://localhost:3003** (admin/admin)
2. Navigate to dashboards
3. Take screenshots of:
   - API request rates
   - Error rates
   - Database connection pool
4. Save as: `05-monitoring/grafana-overview.png`, `05-monitoring/grafana-api-metrics.png`

5. Open Prometheus at **http://localhost:9090**
6. Take a screenshot of the targets page: http://localhost:9090/targets
7. Save as: `05-monitoring/prometheus-targets.png`

## Screenshot Naming Convention

```
<module>/<sequence>-<description>.<png|jpg>

Examples:
  01-registration/01-registration-form.png
  03-api-key-management/02-api-key-created.png
  04-sandbox-testing/05-transfer-response.png
```

## Automated Screenshot Script

For automated screenshots using Playwright or Puppeteer, see:
`tests/e2e/take-screenshots.js`

---

> **Note:** Screenshots should be taken with a clean slate (freshly seeded database)
> to ensure consistency. Run `./scripts/teardown.sh --clean && ./scripts/bring-up.sh`
> before capturing screenshots.
