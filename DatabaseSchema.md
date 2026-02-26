# 📄 DATABASE SCHEMA DESIGN

**Project:** Wekeza Global Infrastructure (WGI) </br>
**Databases:** PostgreSQL (primary transactional DB), MySQL (analytics & reporting), Redis (caching for performance)</br>

---

## 1️⃣ Core Tables (PostgreSQL)

### 1.1 Users

| Column       | Type                                  | Description             |
| ------------ | ------------------------------------- | ----------------------- |
| user_id      | UUID (PK)                             | Unique user identifier  |
| full_name    | VARCHAR(255)                          | User full name          |
| email        | VARCHAR(255)                          | Unique email            |
| phone_number | VARCHAR(20)                           | User phone              |
| kyc_status   | ENUM('pending','verified','rejected') | KYC verification status |
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

**Redis Caching:** Store `wallet_id -> balance` mapping for **instant balance retrieval**.

---

### 1.3 Transactions

| Column         | Type                                         | Description                                    |
| -------------- | -------------------------------------------- | ---------------------------------------------- |
| transaction_id | UUID (PK)                                    | Unique transaction ID                          |
| wallet_id      | UUID (FK)                                    | Wallet involved                                |
| type           | ENUM('deposit','withdrawal','transfer','FX') | Transaction type                               |
| amount         | DECIMAL(20,4)                                | Transaction amount                             |
| status         | ENUM('pending','completed','failed')         | Transaction status                             |
| created_at     | TIMESTAMP                                    | Time of transaction                            |
| updated_at     | TIMESTAMP                                    | Last update                                    |
| metadata       | JSONB                                        | Optional extra info (bank reference, FX route) |

---

### 1.4 Ledger Entries

| Column          | Type          | Description                      |
| --------------- | ------------- | -------------------------------- |
| ledger_entry_id | UUID (PK)     | Ledger entry unique ID           |
| transaction_id  | UUID (FK)     | Linked transaction               |
| debit           | DECIMAL(20,4) | Amount debited                   |
| credit          | DECIMAL(20,4) | Amount credited                  |
| balance_after   | DECIMAL(20,4) | Wallet balance after transaction |
| created_at      | TIMESTAMP     | Entry creation time              |

---

### 1.5 FX Rates

| Column        | Type                          | Description                |
| ------------- | ----------------------------- | -------------------------- |
| fx_rate_id    | UUID (PK)                     | Unique FX rate ID          |
| currency_from | ENUM('USD','EUR','GBP','KES') | Source currency            |
| currency_to   | ENUM('USD','EUR','GBP','KES') | Target currency            |
| rate          | DECIMAL(20,6)                 | FX conversion rate         |
| provider      | VARCHAR(255)                  | Bank or liquidity provider |
| timestamp     | TIMESTAMP                     | Rate timestamp             |

---

### 1.6 FX Transactions

| Column            | Type          | Description                   |
| ----------------- | ------------- | ----------------------------- |
| fx_transaction_id | UUID (PK)     | Unique FX transaction ID      |
| transaction_id    | UUID (FK)     | Linked wallet transaction     |
| amount_from       | DECIMAL(20,4) | Amount in source currency     |
| amount_to         | DECIMAL(20,4) | Amount in target currency     |
| route             | VARCHAR(255)  | Bank/liquidity provider route |
| fee               | DECIMAL(20,4) | FX fee applied                |
| timestamp         | TIMESTAMP     | Execution time                |

---

### 1.7 Settlements

| Column        | Type                                 | Description          |
| ------------- | ------------------------------------ | -------------------- |
| settlement_id | UUID (PK)                            | Unique settlement ID |
| wallet_id     | UUID (FK)                            | Wallet being settled |
| bank_id       | UUID (FK)                            | Target bank          |
| amount        | DECIMAL(20,4)                        | Settlement amount    |
| currency      | ENUM('USD','EUR','GBP','KES')        | Settlement currency  |
| status        | ENUM('pending','completed','failed') | Settlement status    |
| created_at    | TIMESTAMP                            | Timestamp            |
| updated_at    | TIMESTAMP                            | Last update          |

---

### 1.8 Banks

| Column       | Type                      | Description        |
| ------------ | ------------------------- | ------------------ |
| bank_id      | UUID (PK)                 | Bank unique ID     |
| name         | VARCHAR(255)              | Bank name          |
| country      | VARCHAR(50)               | Country code       |
| api_endpoint | VARCHAR(255)              | Bank API endpoint  |
| status       | ENUM('active','inactive') | Integration status |

---

### 1.9 Cards

| Column     | Type                               | Description         |
| ---------- | ---------------------------------- | ------------------- |
| card_id    | UUID (PK)                          | Card unique ID      |
| wallet_id  | UUID (FK)                          | Linked wallet       |
| card_type  | ENUM('virtual','physical')         | Type of card        |
| status     | ENUM('active','blocked','expired') | Card status         |
| limit      | DECIMAL(20,4)                      | Card spending limit |
| created_at | TIMESTAMP                          | Card creation time  |

---

### 1.10 KYC & Compliance

| Column          | Type                                  | Description                |
| --------------- | ------------------------------------- | -------------------------- |
| kyc_document_id | UUID (PK)                             | KYC doc ID                 |
| user_id         | UUID (FK)                             | Linked user                |
| doc_type        | VARCHAR(50)                           | Passport, ID, Utility bill |
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

### 1.11 Credit Intelligence (Analytics / MySQL)

| Column          | Type         | Description                       |
| --------------- | ------------ | --------------------------------- |
| credit_score_id | INT (PK)     | Unique score ID                   |
| user_id         | UUID         | Linked user                       |
| score           | DECIMAL(5,2) | Credit score                      |
| factors         | JSON         | Transaction/fx/settlement factors |
| last_updated    | TIMESTAMP    | Last update                       |

---

## 2️⃣ Redis Caching Strategy

* **Wallet Balances:** Key = `wallet:{wallet_id}:balance`, TTL = 5 mins or on-transaction update
* **FX Rates:** Key = `fx:{currency_from}:{currency_to}`, TTL = 1 min
* **API Rate Limiting / Throttling:** Per API key usage count

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

---

## 4️⃣ Notes on Scaling

* **PostgreSQL:** Primary ledger and transactional data
* **MySQL:** Analytics, reporting, credit intelligence
* **Redis:** High-frequency reads, caching balances and FX rates
* **Sharding / Partitioning:** Wallets and transactions partitioned by region or currency for horizontal scaling

---

