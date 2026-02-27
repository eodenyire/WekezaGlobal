// ============================================================
//  Shared TypeScript interfaces for the WGI platform
// ============================================================

export type KycStatus = 'pending' | 'verified' | 'rejected';
export type UserRole = 'user' | 'admin' | 'compliance' | 'operations' | 'partner';
// Vision: Phase 1 user segments (Executive Vision Document §5)
export type AccountType = 'freelancer' | 'sme' | 'exporter' | 'ecommerce' | 'ngo' | 'startup' | 'individual';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'KES';
export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'fx';
export type TransactionStatus = 'pending' | 'completed' | 'failed';
export type SettlementStatus = 'pending' | 'completed' | 'failed';
export type CardType = 'virtual' | 'physical';
export type CardStatus = 'active' | 'blocked' | 'expired';
export type AlertSeverity = 'low' | 'medium' | 'high';
export type AlertStatus = 'pending' | 'resolved';
export type DocStatus = 'pending' | 'verified' | 'rejected';

// ------ Domain Models -------

export interface User {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  password_hash: string;
  kyc_status: KycStatus;
  role: UserRole;
  account_type: AccountType;
  created_at: Date;
  updated_at: Date;
}

export interface Wallet {
  wallet_id: string;
  user_id: string;
  currency: Currency;
  balance: string; // DECIMAL comes back as string from pg
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  transaction_id: string;
  wallet_id: string;
  type: TransactionType;
  amount: string;
  currency: Currency;
  status: TransactionStatus;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface LedgerEntry {
  ledger_entry_id: string;
  transaction_id: string;
  wallet_id: string;
  debit: string;
  credit: string;
  balance_after: string;
  created_at: Date;
}

export interface FxRate {
  fx_rate_id: string;
  currency_from: Currency;
  currency_to: Currency;
  rate: string;
  provider: string;
  timestamp: Date;
}

export interface FxTransaction {
  fx_transaction_id: string;
  transaction_id: string;
  amount_from: string;
  amount_to: string;
  currency_from: Currency;
  currency_to: Currency;
  route: string | null;
  fee: string;
  timestamp: Date;
}

export interface Bank {
  bank_id: string;
  name: string;
  country: string;
  api_endpoint: string | null;
  settlement_rules: Record<string, unknown>;
  status: 'active' | 'inactive';
}

export interface LiquidityProvider {
  provider_id: string;
  name: string;
  rates: Record<string, unknown>;
  availability: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Settlement {
  settlement_id: string;
  wallet_id: string;
  bank_id: string;
  amount: string;
  currency: Currency;
  status: SettlementStatus;
  created_at: Date;
  updated_at: Date;
}

export interface Card {
  card_id: string;
  wallet_id: string;
  card_type: CardType;
  status: CardStatus;
  spending_limit: string;
  created_at: Date;
}

export interface CardTransaction {
  card_tx_id: string;
  card_id: string;
  amount: string;
  currency: Currency;
  merchant: string | null;
  status: string;
  timestamp: Date;
}

export interface KycDocument {
  kyc_document_id: string;
  user_id: string;
  doc_type: string;
  file_url: string | null;
  status: DocStatus;
  verified_at: Date | null;
}

export interface AmlAlert {
  aml_alert_id: string;
  transaction_id: string;
  type: string;
  severity: AlertSeverity;
  status: AlertStatus;
  created_at: Date;
}

export interface CreditScore {
  credit_score_id: string;
  user_id: string;
  score: string;
  factors: Record<string, unknown>;
  last_updated: Date;
}

export interface CreditActivityLog {
  log_id: string;
  user_id: string;
  transaction_id: string | null;
  factor: string;
  delta: string;
  created_at: Date;
}

export interface ApiKey {
  api_key_id: string;
  user_id: string;
  api_key: string;
  name: string | null;
  status: string;
  created_at: Date;
}

export interface Webhook {
  webhook_id: string;
  user_id: string;
  url: string;
  events: string[];
  secret: string;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

// ------ JWT Payload -------

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ------ Public API response shapes (strip password_hash) -------

export type PublicUser = Omit<User, 'password_hash'>;
