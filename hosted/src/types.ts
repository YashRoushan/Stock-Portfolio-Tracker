export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes: number };
}

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface HostedDatabase {
  prepare(query: string): D1Statement;
  batch<T = Record<string, unknown>>(statements: D1Statement[]): Promise<D1Result<T>[]>;
}

export interface HostedBindings {
  DB: HostedDatabase;
  JWT_SECRET: string;
  STOCK_PRICE_PROVIDER?: string;
  TIINGO_API_TOKEN?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  isDemo: boolean;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  is_demo: number;
  expires_at: string | null;
}

export interface PortfolioRow {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  portfolio_id: string;
  user_id: string;
  ticker: string;
  type: "BUY" | "SELL";
  quantity_micros: number;
  price_cents: number;
  fee_cents: number;
  occurred_at: string;
  created_at: string;
}

export interface DividendRow {
  id: string;
  portfolio_id: string;
  user_id: string;
  ticker: string;
  amount_cents: number;
  occurred_at: string;
  created_at: string;
}
