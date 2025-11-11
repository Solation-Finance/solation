export type AssetSymbol = 'SOL' | 'JUPSOL' | 'JITOSOL' | 'cbBTC' | 'ETH' | 'mSOL';

export type Strategy = 'covered-call' | 'cash-secured-put';

export interface Asset {
  symbol: AssetSymbol;
  name: string;
  logo: string;
  price: number;
  mintAddress?: string;
  decimals: number;
}

export interface StrikePrice {
  price: number;
  apr: number;
  premium: number;
}

export interface ExpirationDate {
  date: string;
  daysUntil: number;
  timestamp: number;
}

export interface Position {
  id: string;
  asset: AssetSymbol;
  strategy: Strategy;
  amount: number;
  strikePrice: number;
  expirationDate: string;
  premiumEarned: number;
  status: 'active' | 'expired' | 'exercised';
  createdAt: string;
}

export interface IncomeData {
  date: string;
  amount: number;
}

export interface DashboardMetrics {
  totalIncome: number;
  activePositions: number;
  totalEarnings: number;
  realizedProfits: number;
}
