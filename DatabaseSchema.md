# 📄 DATABASE SCHEMA DESIGN

<<<<<<< copilot/ensure-completion-of-system
**Project:** Wekeza Global Infrastructure (WGI)
**Databases:** PostgreSQL (primary transactional & analytics DB), Redis (caching & rate limiting)

> **Implementation note:** Credit intelligence and analytics are implemented in PostgreSQL (not a separate MySQL instance). A dedicated analytics store can be introduced in a future phase when read replica isolation becomes necessary for horizontal scaling.
=======
**Project:** Wekeza Global Infrastructure (WGI) </br>
**Databases:** PostgreSQL (primary transactional DB), MySQL (analytics & reporting), Redis (caching for performance)</br>
>>>>>>> main

---

## 1️⃣ Core Tables (PostgreSQL)

### 1.1 Users

| Column       | Type                                  | Description             |
| ------------ | ------------------------------------- | ----------------------- |
| user_id      | UUID (PK)                             | Unique user identifier  |
| full_name    | VARCHAR(255)                          | User full name          |
| email        | VARCHAR(255)                          | Unique email            |
| phone_number | VARCHAR(20)                           | User phone              |
| password_hash | VARCHAR(255)                         | Hashed password         |
| kyc_status   | ENUM('pending','verified','rejected') | KYC verification status |
| role         | ENUM('user','admin','compliance','operations','partner') | User role |
| account_type | ENUM('freelancer','sme','exporter','ecommerce','ngo','startup','individual') | Phase 1 segment |
| created_at   | TIMESTAMP                             | User creation time      |
| updated_at   | TIMESTAMP                             | Last update time        |

---

### 1.2 Wallets

| Column     | Type                          | Description              |
| ---------- | ----------------------------- | ------------------------ |
| wallet_id  | UUID (PK)                     | Unique wallet identifier |
| user_id    | UUID (FK)                     | Links to `users`         |
| currency   | ENUM('USD','EUR','GBP','KES') | Wallet currency          |
| balance    | DECIMAL(20,4)                 | Current balance          |
| created_at | TIMESTAMP                     | Wallet creation time     |
| updated_at | TIMESTAMP                     | Last balance update      |

**Redis Caching:** Key = `wallet:{wallet_id}:balance`, TTL = 5 mins or on-transaction update.

---

### 1.3 Transactions

| Column         | Type                                                  | Description                                    |
| -------------- | ----------------------------------------------------- | ---------------------------------------------- |
| transaction_id | UUID (PK)                                             | Unique transaction ID                          |
| wallet_id      | UUID (FK)                                             | Wallet involved                                |
| type           | ENUM('deposit','withdrawal','transfer','fx')          | Transaction type (`fx` lowercase in DB)        |
| amount         | DECIMAL(20,4)                                         | Transaction amount                             |
| currency       | VARCHAR(5)                                            | Transaction currency                           |
| status         | ENUM('pending','completed','failed')                  | Transaction status                             |
| created_at     | TIMESTAMP                                             | Time of transaction                            |
| updated_at     | TIMESTAMP                                             | Last update                                    |
| metadata       | JSONB                                                 | Optional extra info (bank reference, FX route) |

---

### 1.4 Ledger Entries

| Column          | Type          | Description                      |
| --------------- | ------------- | -------------------------------- |
| ledger_entry_id | UUID (PK)     | Ledger entry unique ID           |
| transaction_id  | UUID (FK)     | Linked transaction               |
| wallet_id       | UUID (FK)     | Wallet for fast lookups          |
| debit           | DECIMAL(20,4) | Amount debited                   |
| credit          | DECIMAL(20,4) | Amount credited                  |
| balance_after   | DECIMAL(20,4) | Wallet balance after transaction |
| created_at      | TIMESTAMP     | Entry creation time              |

> `wallet_id` is included for query performance (avoids joining via transactions on every ledger read).

---

### 1.5 FX Rates

| Column        | Type          | Description                |
| ------------- | ------------- | -------------------------- |
| fx_rate_id    | UUID (PK)     | Unique FX rate ID          |
| currency_from | VARCHAR(5)    | Source currency            |
| currency_to   | VARCHAR(5)    | Target currency            |
| rate          | DECIMAL(20,6) | FX conversion rate         |
| provider      | VARCHAR(255)  | Bank or liquidity provider |
| timestamp     | TIMESTAMP     | Rate timestamp             |

**Redis Caching:** Key = `fx:{currency_from}:{currency_to}`, TTL = 1 min.

---

### 1.6 FX Transactions

| Column            | Type          | Description                   |
| ----------------- | ------------- | ----------------------------- |
| fx_transaction_id | UUID (PK)     | Unique FX transaction ID      |
| transaction_id    | UUID (FK)     | Linked wallet transaction     |
| amount_from       | DECIMAL(20,4) | Amount in source currency     |
| amount_to         | DECIMAL(20,4) | Amount in target currency     |
| currency_from     | VARCHAR(5)    | Source currency code          |
| currency_to       | VARCHAR(5)    | Target currency code          |
| route             | VARCHAR(255)  | Bank/liquidity provider route |
| fee               | DECIMAL(20,4) | FX fee applied                |
| timestamp         | TIMESTAMP     | Execution time                |

> `currency_from` and `currency_to` are included for direct pair analytics without joining fx_rates.

---

### 1.7 Settlements

| Column        | Type                                 | Description          |
| ------------- | ------------------------------------ | -------------------- |
| settlement_id | UUID (PK)                            | Unique settlement ID |
| wallet_id     | UUID (FK)                            | Wallet being settled |
| bank_id       | UUID (FK)                            | Target bank          |
| amount        | DECIMAL(20,4)                        | Settlement amount    |
| currency      | VARCHAR(5)                           | Settlement currency  |
| status        | ENUM('pending','completed','failed') | Settlement status    |
| created_at    | TIMESTAMP                            | Timestamp            |
| updated_at    | TIMESTAMP                            | Last update          |

---

### 1.8 Banks

| Column           | Type                      | Description               |
| ---------------- | ------------------------- | ------------------------- |
| bank_id          | UUID (PK)                 | Bank unique ID            |
| name             | VARCHAR(255)              | Bank name                 |
| country          | VARCHAR(50)               | ISO 3166-1 country code   |
| api_endpoint     | VARCHAR(255)              | Bank API endpoint         |
| settlement_rules | JSONB                     | Per-bank routing rules    |
| status           | ENUM('active','inactive') | Integration status        |

---

### 1.9 Cards

| Column         | Type                               | Description               |
| -------------- | ---------------------------------- | ------------------------- |
| card_id        | UUID (PK)                          | Card unique ID            |
| wallet_id      | UUID (FK)                          | Linked wallet             |
| card_type      | ENUM('virtual','physical')         | Type of card              |
| status         | ENUM('active','blocked','expired') | Card status               |
| spending_limit | DECIMAL(20,4)                      | Card spending limit       |
| created_at     | TIMESTAMP                          | Card creation time        |

> Column is named `spending_limit` (not `limit`) because `LIMIT` is a reserved SQL keyword.

---

### 1.10 KYC & Compliance

| Column          | Type                                  | Description                |
| --------------- | ------------------------------------- | -------------------------- |
| kyc_document_id | UUID (PK)                             | KYC doc ID                 |
| user_id         | UUID (FK)                             | Linked user                |
| doc_type        | VARCHAR(50)                           | Passport, ID, Utility bill |
| file_url        | VARCHAR(500)                          | Document storage URL       |
| status          | ENUM('pending','verified','rejected') | Verification status        |
| verified_at     | TIMESTAMP                             | Time of verification       |

| Column         | Type                        | Description             |
| -------------- | --------------------------- | ----------------------- |
| aml_alert_id   | UUID (PK)                   | AML alert ID            |
| transaction_id | UUID (FK)                   | Linked transaction      |
| type           | VARCHAR(50)                 | Alert type              |
| severity       | ENUM('low','medium','high') | Risk severity           |
| status         | ENUM('pending','resolved')  | Alert resolution status |
| created_at     | TIMESTAMP                   | Timestamp               |

---

### 1.11 Credit Intelligence (PostgreSQL)

| Column          | Type          | Description                                  |
| --------------- | ------------- | -------------------------------------------- |
| credit_score_id | UUID (PK)     | Unique score ID (UUID for consistency)       |
| user_id         | UUID (FK)     | Linked user (1:1)                            |
| score           | DECIMAL(5,2)  | Credit score (300–850)                       |
| factors         | JSONB         | Transaction/fx/settlement scoring factors    |
| last_updated    | TIMESTAMP     | Last score recalculation                     |

---

### 1.12 Liquidity Providers

| Column              | Type         | Description                             |
| ------------------- | ------------ | --------------------------------------- |
| provider_id         | UUID (PK)    | Unique provider ID                      |
| name                | VARCHAR(255) | Provider name                           |
| rates               | JSONB        | Rate map (e.g. `{"USD_KES": 134.5}`)   |
| availability        | BOOLEAN      | Whether provider is currently active    |
| is_founding_partner | BOOLEAN      | TRUE for Wekeza Bank (founding partner) |
| created_at          | TIMESTAMP    | Creation time                           |
| updated_at          | TIMESTAMP    | Last update                             |

---

### 1.13 Subscription Plans (Revenue Stream 3)

| Column        | Type          | Description                               |
| ------------- | ------------- | ----------------------------------------- |
| plan_id       | UUID (PK)     | Plan unique ID                            |
| name          | VARCHAR(50)   | Plan slug: `standard`, `premium`, `enterprise` |
| display_name  | VARCHAR(100)  | Human-readable name                       |
| price_usd     | DECIMAL(10,2) | Monthly price in USD (0.00 = free)        |
| billing_cycle | VARCHAR(20)   | `monthly` or `annual`                     |
| features      | JSONB         | Array of feature strings                  |
| is_active     | BOOLEAN       | Whether plan is available for subscription |
| created_at    | TIMESTAMP     | Creation time                             |
| updated_at    | TIMESTAMP     | Last update                               |

### 1.14 User Subscriptions

| Column          | Type          | Description                                    |
| --------------- | ------------- | ---------------------------------------------- |
| subscription_id | UUID (PK)     | Subscription unique ID                         |
| user_id         | UUID (FK)     | Linked user                                    |
| plan_id         | UUID (FK)     | Linked subscription plan                       |
| status          | ENUM('active','cancelled','expired','past_due') | Subscription status |
| started_at      | TIMESTAMP     | Subscription start                             |
| expires_at      | TIMESTAMP     | Expiry (NULL for free/ongoing)                 |
| cancelled_at    | TIMESTAMP     | Cancellation time                              |
| created_at      | TIMESTAMP     | Record creation time                           |
| updated_at      | TIMESTAMP     | Last update                                    |

> Partial unique index `WHERE status = 'active'` enforces one active subscription per user.

---

## 2️⃣ Redis Caching Strategy

* **Wallet Balances:** Key = `wallet:{wallet_id}:balance`, TTL = 5 mins or on-transaction update
* **FX Rates:** Key = `fx:{currency_from}:{currency_to}`, TTL = 1 min
* **API Rate Limiting / Throttling (per API key):** Key = `api_key:{api_key_id}:usage`, TTL = 1 hour (rolling window); incremented on each authenticated fintech/sandbox API call via `X-API-Key` header

---

## 3️⃣ Relationships Overview

* **Users → Wallets** (1:N)
* **Wallets → Transactions** (1:N)
* **Transactions → Ledger Entries** (1:1/N)
* **Transactions → FX Transactions** (1:0/1)
* **Wallets → Settlements** (1:N)
* **Wallets → Cards** (1:N)
* **Users → KYC Documents** (1:N)
* **Transactions → AML Alerts** (0:N)
* **Users → Credit Scores** (1:1)
* **Users → User Subscriptions** (1:0/1 active)
* **Subscription Plans → User Subscriptions** (1:N)

---

## 4️⃣ Notes on Scaling

* **PostgreSQL:** Primary ledger, transactional data, credit intelligence, and analytics
* **Redis:** High-frequency reads — wallet balance cache, FX rate cache, per-API-key usage counters
* **Sharding / Partitioning:** Wallets and transactions can be partitioned by region or currency for horizontal scaling in a future phase
* **Read Replicas:** A dedicated analytics/reporting read replica (or a separate MySQL/ClickHouse instance) can be introduced when reporting queries impact OLTP performance

---

