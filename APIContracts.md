# 📄 API CONTRACTS

**Project:** Wekeza Global Infrastructure (WGI)
**Authentication:** OAuth2 + JWT
**Data Format:** JSON
**Rate Limiting:** Configurable per API key (Redis-backed)
**Versioning:** `v1`

---

## 1️⃣ Authentication API

**Endpoint:** `/auth/token`
**Method:** POST
**Description:** Obtain access token for API usage

**Request:**

```json
{
  "client_id": "string",
  "client_secret": "string",
  "grant_type": "client_credentials"
}
```

**Response:**

```json
{
  "access_token": "string",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Error Response:**

```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed"
}
```

---

## 2️⃣ Wallet APIs

### 2.1 Create Wallet

**Endpoint:** `/v1/wallets`
**Method:** POST

**Request:**

```json
{
  "user_id": "uuid",
  "currency": "USD|EUR|GBP|KES"
}
```

**Response:**

```json
{
  "wallet_id": "uuid",
  "user_id": "uuid",
  "currency": "USD",
  "balance": 0.0
}
```

---

### 2.2 Get Wallet Balance

**Endpoint:** `/v1/wallets/{wallet_id}/balance`
**Method:** GET

**Response:**

```json
{
  "wallet_id": "uuid",
  "balance": 1050.75,
  "currency": "USD",
  "last_updated": "2026-02-26T12:00:00Z"
}
```

**Caching:** Redis key `wallet:{wallet_id}:balance`, TTL = 5 min

---

### 2.3 Deposit to Wallet

**Endpoint:** `/v1/wallets/{wallet_id}/deposit`
**Method:** POST

**Request:**

```json
{
  "amount": 500.0,
  "currency": "USD",
  "reference": "optional_transaction_reference"
}
```

**Response:**

```json
{
  "transaction_id": "uuid",
  "wallet_id": "uuid",
  "amount": 500.0,
  "currency": "USD",
  "status": "completed",
  "timestamp": "2026-02-26T12:05:00Z"
}
```

---

### 2.4 Withdraw from Wallet

**Endpoint:** `/v1/wallets/{wallet_id}/withdraw`
**Method:** POST

**Request:**

```json
{
  "amount": 200.0,
  "currency": "KES",
  "bank_account": {
    "bank_id": "uuid",
    "account_number": "string",
    "account_name": "string"
  }
}
```

**Response:**

```json
{
  "transaction_id": "uuid",
  "wallet_id": "uuid",
  "amount": 200.0,
  "currency": "KES",
  "status": "pending",
  "timestamp": "2026-02-26T12:10:00Z"
}
```

---

## 3️⃣ FX APIs

### 3.1 Convert Currency

**Endpoint:** `/v1/fx/convert`
**Method:** POST

**Request:**

```json
{
  "wallet_id": "uuid",
  "amount": 1000.0,
  "currency_from": "USD",
  "currency_to": "KES"
}
```

**Response:**

```json
{
  "transaction_id": "uuid",
  "wallet_id": "uuid",
  "amount_from": 1000.0,
  "amount_to": 134500.0,
  "currency_from": "USD",
  "currency_to": "KES",
  "fx_rate": 134.5,
  "fee": 100.0,
  "status": "completed",
  "timestamp": "2026-02-26T12:15:00Z"
}
```

---

## 4️⃣ Settlement APIs

### 4.1 Initiate Settlement

**Endpoint:** `/v1/settlements`
**Method:** POST

**Request:**

```json
{
  "wallet_id": "uuid",
  "bank_id": "uuid",
  "amount": 134500.0,
  "currency": "KES"
}
```

**Response:**

```json
{
  "settlement_id": "uuid",
  "wallet_id": "uuid",
  "bank_id": "uuid",
  "amount": 134500.0,
  "currency": "KES",
  "status": "pending",
  "timestamp": "2026-02-26T12:20:00Z"
}
```

---

### 4.2 Check Settlement Status

**Endpoint:** `/v1/settlements/{settlement_id}`
**Method:** GET

**Response:**

```json
{
  "settlement_id": "uuid",
  "wallet_id": "uuid",
  "bank_id": "uuid",
  "amount": 134500.0,
  "currency": "KES",
  "status": "completed",
  "settled_at": "2026-02-26T12:22:00Z"
}
```

---

## 5️⃣ Card APIs

### 5.1 Create Card

**Endpoint:** `/v1/cards`
**Method:** POST

**Request:**

```json
{
  "wallet_id": "uuid",
  "type": "virtual|physical",
  "limit": 5000.0
}
```

**Response:**

```json
{
  "card_id": "uuid",
  "wallet_id": "uuid",
  "type": "virtual",
  "status": "active",
  "limit": 5000.0,
  "created_at": "2026-02-26T12:25:00Z"
}
```

---

### 5.2 Get Card Transactions

**Endpoint:** `/v1/cards/{card_id}/transactions`
**Method:** GET

**Response:**

```json
[
  {
    "transaction_id": "uuid",
    "amount": 200.0,
    "currency": "KES",
    "merchant": "Acme Ltd",
    "timestamp": "2026-02-26T12:30:00Z"
  }
]
```

---

## 6️⃣ KYC & Compliance APIs

### 6.1 Upload KYC Document

**Endpoint:** `/v1/kyc`
**Method:** POST

**Request:**

```json
{
  "user_id": "uuid",
  "doc_type": "passport",
  "file_url": "https://storage.wekeza.com/docs/abc123.pdf"
}
```

**Response:**

```json
{
  "kyc_document_id": "uuid",
  "status": "pending",
  "uploaded_at": "2026-02-26T12:35:00Z"
}
```

---

### 6.2 Get AML Alerts

**Endpoint:** `/v1/aml/alerts`
**Method:** GET

**Query Parameters:** `?status=pending&severity=high`

**Response:**

```json
[
  {
    "alert_id": "uuid",
    "transaction_id": "uuid",
    "type": "suspicious_fx",
    "severity": "high",
    "status": "pending",
    "timestamp": "2026-02-26T12:40:00Z"
  }
]
```

---

## 7️⃣ Analytics / Credit Intelligence APIs

### 7.1 Get Credit Score

**Endpoint:** `/v1/credit/{user_id}`
**Method:** GET

**Response:**

```json
{
  "user_id": "uuid",
  "score": 720,
  "factors": {
    "transaction_history": "good",
    "fx_conversion": "optimal",
    "settlement_timeliness": "excellent"
  },
  "last_updated": "2026-02-26T12:45:00Z"
}
```

---

## 8️⃣ Error Codes (Common)

| Code | Description           |
| ---- | --------------------- |
| 400  | Bad Request           |
| 401  | Unauthorized          |
| 403  | Forbidden             |
| 404  | Resource Not Found    |
| 409  | Conflict              |
| 500  | Internal Server Error |
| 503  | Service Unavailable   |

---

**Redis Usage in API Layer:**

* Wallet balance cache → `/wallets/{wallet_id}/balance`
* FX rates → `/fx/convert`
* Rate limiting / throttling counters

---
