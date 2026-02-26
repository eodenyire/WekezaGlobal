export interface User {
  user_id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  kyc_status: 'pending' | 'verified' | 'rejected';
  role: 'user' | 'admin' | 'compliance' | 'operations' | 'partner';
  created_at: string;
}

export interface Wallet {
  wallet_id: string;
  user_id: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'KES';
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  transaction_id: string;
  wallet_id: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'fx';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface FXRate {
  fx_rate_id: string;
  currency_from: string;
  currency_to: string;
  rate: number;
  provider: string;
  timestamp: string;
}

export interface Settlement {
  settlement_id: string;
  wallet_id: string;
  bank_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface Card {
  card_id: string;
  wallet_id: string;
  card_type: 'virtual' | 'physical';
  status: 'active' | 'blocked' | 'expired';
  spending_limit: number;
  created_at: string;
}

export interface KYCDocument {
  kyc_document_id: string;
  user_id: string;
  doc_type: string;
  file_url?: string;
  status: 'pending' | 'verified' | 'rejected';
  verified_at?: string;
}

export interface AMLAlert {
  aml_alert_id: string;
  transaction_id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'resolved';
  created_at: string;
}

export interface CreditScore {
  credit_score_id: string;
  user_id: string;
  score: number;
  factors: Record<string, unknown>;
  last_updated: string;
}

export interface Bank {
  bank_id: string;
  name: string;
  country: string;
  status: string;
}

export interface AdminStats {
  total_users: number;
  total_wallets: number;
  total_transactions: number;
  total_volume_by_currency: Record<string, number>;
  pending_kyc: number;
  pending_aml_alerts: number;
}
