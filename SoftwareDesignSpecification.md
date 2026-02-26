# 📄 SOFTWARE DESIGN SPECIFICATION</br>

**Project:** Wekeza Global Infrastructure (WGI) </br>
**Founding Liquidity Partner:** Wekeza Bank </br>
**Scope:** Pan-African, Full Implementation </br>

---

## 1️⃣ Objective

Provide **technical specifications** for WGI including:

* Module-level design
* Data models & database schema
* API specifications & contracts
* Integration with banks & fintechs
* Security design
* Deployment & infrastructure design

This ensures **consistent, scalable, secure, and maintainable implementation**.

---

## 2️⃣ Module-Level Design

### 2.1 Wallet Service

**Responsibilities:**

* Maintain multi-currency balances (USD, EUR, GBP, KES)
* Ledger for all transactions (immutable & auditable)
* Process deposits, withdrawals, transfers

**Sequence Flow:**

1. User triggers deposit/withdrawal
2. Wallet service validates transaction
3. Updates ledger (ACID transaction)
4. Sends confirmation to user + updates dashboards

**Database Tables:**

* `users` (user_id, name, email, KYC_status)
* `wallets` (wallet_id, user_id, currency, balance)
* `transactions` (transaction_id, wallet_id, type, amount, timestamp, status)
* `ledger_entries` (entry_id, transaction_id, debit, credit, balance_after)

---

### 2.2 FX & Liquidity Engine

**Responsibilities:**

* Convert currencies using optimal bank/liquidity route
* Hedge large transactions
* Log FX decisions for audit

**Sequence Flow:**

1. Wallet transaction triggers FX conversion
2. FX Engine queries multiple banks/liquidity providers
3. Selects route with lowest cost & fastest execution
4. Executes conversion, updates ledger
5. Logs FX details for audit

**Database Tables:**

* `fx_rates` (currency_from, currency_to, rate, timestamp)
* `fx_transactions` (fx_id, transaction_id, amount_from, amount_to, route, fee, timestamp)
* `liquidity_providers` (provider_id, name, rates, availability)

---

### 2.3 Settlement Engine

**Responsibilities:**

* Withdraw funds to local African banks
* Track settlement success/failure
* Generate reconciliation reports

**Sequence Flow:**

1. Withdrawal request triggers settlement
2. Engine selects optimal bank route
3. Processes transfer
4. Updates wallet & ledger
5. Logs settlement for compliance

**Database Tables:**

* `settlements` (settlement_id, wallet_id, bank_id, amount, currency, status, timestamp)
* `banks` (bank_id, name, API_endpoint, country, settlement_rules)
* `reconciliation_logs` (log_id, settlement_id, result, timestamp)

---

### 2.4 Card Issuing Service

**Responsibilities:**

* Issue virtual & physical cards
* Link to wallets
* Monitor spend & alerts

**Sequence Flow:**

1. User requests card
2. Service verifies wallet balance
3. Card is provisioned via Visa/Mastercard API
4. Transactions linked to wallet and ledger
5. Fraud/alert monitoring triggers notifications

**Database Tables:**

* `cards` (card_id, wallet_id, type, status, limit, created_at)
* `card_transactions` (card_tx_id, card_id, amount, merchant, timestamp)

---

### 2.5 KYC & Compliance Service

**Responsibilities:**

* Verify user identity
* Monitor for AML / suspicious activity
* Generate regulatory reports

**Sequence Flow:**

1. User uploads ID & verification documents
2. Service checks against PEP/sanction lists
3. Approves or flags user
4. Continuously monitors transactions for anomalies
5. Logs alerts and reports

**Database Tables:**

* `kyc_documents` (doc_id, user_id, type, status, verified_at)
* `aml_alerts` (alert_id, transaction_id, type, severity, status, timestamp)
* `regulatory_reports` (report_id, period, type, status, generated_at)

---

### 2.6 API Gateway & Integration Service

**Responsibilities:**

* Expose RESTful & Webhook APIs to fintechs / marketplaces
* Authenticate & authorize requests
* Log API usage & errors

**API Examples:**

| Endpoint                | Method | Description                    |
| ----------------------- | ------ | ------------------------------ |
| `/wallet/deposit`       | POST   | Deposit funds into wallet      |
| `/wallet/withdraw`      | POST   | Withdraw funds to local bank   |
| `/fx/convert`           | POST   | Convert currency via FX engine |
| `/card/create`          | POST   | Issue virtual/physical card    |
| `/transactions/history` | GET    | Fetch wallet transactions      |

**Security:**

* OAuth2 / JWT token-based authentication
* Rate limiting & throttling
* Logging & monitoring

---

### 2.7 Credit Intelligence Engine

**Responsibilities:**

* Aggregate wallet, FX, and settlement data
* Prepare analytics for credit scoring & future lending

**Database Tables:**

* `credit_scores` (user_id, score, last_updated, factors)
* `credit_activity_logs` (log_id, user_id, transaction_id, factor, timestamp)

---

## 3️⃣ Database Schema Overview

* **Relational Databases:** PostgreSQL for transactional data
* **Data Warehouse:** Snowflake/Redshift for analytics & credit intelligence
* **Ledger:** Immutable, append-only table for all transactions
* **Indexes:** Optimized for fast reads on balances & transaction history

---

## 4️⃣ Security Design

* **Authentication:** OAuth2, JWT, MFA for users/admins
* **Encryption:** AES-256 at rest, TLS 1.3 in transit
* **Fraud Detection:** AI/ML monitoring of anomalous transactions
* **Access Control:** Role-based access (RBAC) for internal modules
* **Audit Logging:** All transactions, FX, settlements, and API calls logged

---

## 5️⃣ Infrastructure & Deployment

* **Cloud Provider:** Azure / AWS
* **Containerization:** Docker + Kubernetes
* **CI/CD:** Automated build, test, deployment pipelines
* **Monitoring:** Prometheus + Grafana, ELK stack for logs
* **Load Balancing & Scaling:** Horizontal scaling of microservices; multi-region deployment
* **Disaster Recovery:** Multi-AZ replication, hot-standby failover

---

## 6️⃣ Integration Diagram (Conceptual)

**User → Wallet → FX Engine → Settlement → Bank / Card**
**API → Gateway → Wallet / FX / Settlement**
**KYC & Compliance monitors all transactions**
**Credit Intelligence reads all wallet & settlement data**

---

