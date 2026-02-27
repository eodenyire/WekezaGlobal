-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Analytics Schema
--  MySQL Analytics & Reporting Database
--  Tech Stack §3 — Analytics & Reporting DB: MySQL
--  Purpose: OLAP workloads, regulatory reporting, BI dashboards
-- ============================================================

-- ─── FX Rate History ─────────────────────────────────────────────────────────
-- Append-only copy of every FX rate snapshot for trend analysis and reporting.
CREATE TABLE IF NOT EXISTS fx_rate_history (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  currency_from VARCHAR(5) NOT NULL,
  currency_to   VARCHAR(5) NOT NULL,
  rate          DECIMAL(20,6) NOT NULL,
  provider      VARCHAR(255) DEFAULT 'WGI',
  recorded_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fx_pair         (currency_from, currency_to),
  INDEX idx_fx_recorded_at  (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Transaction Analytics ───────────────────────────────────────────────────
-- Denormalized snapshot of completed transactions for OLAP queries.
-- Populated by ETL / CDC from the PostgreSQL transactional DB.
CREATE TABLE IF NOT EXISTS transaction_analytics (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  transaction_id CHAR(36)    NOT NULL UNIQUE,
  wallet_id      CHAR(36)    NOT NULL,
  user_id        CHAR(36)    NOT NULL,
  type           VARCHAR(20) NOT NULL,
  amount         DECIMAL(20,4) NOT NULL,
  currency       VARCHAR(5)  NOT NULL,
  status         VARCHAR(20) NOT NULL,
  country        VARCHAR(5),
  created_at     DATETIME    NOT NULL,
  settled_at     DATETIME,
  INDEX idx_ta_wallet_id   (wallet_id),
  INDEX idx_ta_user_id     (user_id),
  INDEX idx_ta_type        (type),
  INDEX idx_ta_currency    (currency),
  INDEX idx_ta_created_at  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Settlement Analytics ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlement_analytics (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  settlement_id   CHAR(36)    NOT NULL UNIQUE,
  wallet_id       CHAR(36)    NOT NULL,
  bank_id         CHAR(36)    NOT NULL,
  bank_country    VARCHAR(5),
  amount          DECIMAL(20,4) NOT NULL,
  currency        VARCHAR(5)  NOT NULL,
  status          VARCHAR(20) NOT NULL,
  created_at      DATETIME    NOT NULL,
  completed_at    DATETIME,
  INDEX idx_sa_wallet_id   (wallet_id),
  INDEX idx_sa_bank_id     (bank_id),
  INDEX idx_sa_status      (status),
  INDEX idx_sa_created_at  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── KYC & Compliance Analytics ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyc_analytics (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     CHAR(36)    NOT NULL,
  doc_type    VARCHAR(50),
  status      VARCHAR(20) NOT NULL,
  country     VARCHAR(5),
  submitted_at DATETIME   NOT NULL,
  reviewed_at  DATETIME,
  INDEX idx_kyc_user_id    (user_id),
  INDEX idx_kyc_status     (status),
  INDEX idx_kyc_country    (country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── AML Alert Analytics ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aml_alert_analytics (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  alert_id       CHAR(36)    NOT NULL UNIQUE,
  transaction_id CHAR(36)    NOT NULL,
  alert_type     VARCHAR(50) NOT NULL,
  severity       VARCHAR(20) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'open',
  resolved_at    DATETIME,
  created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_aml_tx_id      (transaction_id),
  INDEX idx_aml_severity   (severity),
  INDEX idx_aml_status     (status),
  INDEX idx_aml_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Daily Summary Aggregates ─────────────────────────────────────────────────
-- Pre-aggregated daily totals for fast dashboard queries.
CREATE TABLE IF NOT EXISTS daily_transaction_summary (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  summary_date    DATE        NOT NULL,
  currency        VARCHAR(5)  NOT NULL,
  tx_type         VARCHAR(20) NOT NULL,
  tx_count        INT         NOT NULL DEFAULT 0,
  total_amount    DECIMAL(20,4) NOT NULL DEFAULT 0,
  avg_amount      DECIMAL(20,4),
  generated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_summary (summary_date, currency, tx_type),
  INDEX idx_ds_date     (summary_date),
  INDEX idx_ds_currency (currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Regulatory Report Summaries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regulatory_report_summaries (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_period   VARCHAR(20) NOT NULL,
  report_type     VARCHAR(50) NOT NULL,
  country         VARCHAR(5),
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  submitted_at    DATETIME,
  generated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rrs_period  (report_period),
  INDEX idx_rrs_country (country),
  INDEX idx_rrs_type    (report_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
