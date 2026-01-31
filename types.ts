export interface Lot {
  id: string;
  date: string;
  shares: number;
  price: number;
  fee?: number;
  margin?: number; // 融資金額
}

export interface ETF {
  id: string;
  code?: string; // 代號
  name: string;
  shares: number;
  costPrice: number;
  currentPrice: number;
  dividendPerShare: number;
  dividendType?: 'annual' | 'per_period';
  payMonths?: number[];
  category: 'dividend' | 'hedging' | 'active';
  marginLoanAmount?: number; // 融資總額
  marginInterestRate?: number;
  lots?: Lot[];
}

export interface Loan {
  id: string;
  name: string;
  principal: number;
  rate1: number;
  rate1Months: number;
  rate2: number;
  totalMonths: number;
  paidMonths: number;
  gracePeriod: number;
  startDate?: string;
  type: string;
}

export interface StockLoan {
  principal: number;
  rate: number;
  maintenanceLimit?: number;
}

export interface CreditLoan {
  principal: number;
  rate: number;
  totalMonths: number;
  paidMonths: number;
}

export interface TaxStatus {
  salaryIncome: number;
  livingExpenses: number;
  dependents: number;
  hasSpouse: boolean;
  isDisabled: boolean;
}

export interface AllocationConfig {
  totalFunds: number;
  dividendRatio: number;
  hedgingRatio: number;
  activeRatio: number;
}

export interface CloudConfig {
  apiKey: string;
  projectId: string;
  syncId: string;
  enabled: boolean;
  priceSourceUrl?: string;
}

export interface AppState {
  etfs: ETF[];
  loans: Loan[];
  stockLoan: StockLoan;
  globalMarginLoan: StockLoan;
  creditLoan: CreditLoan;
  taxStatus: TaxStatus;
  allocation: AllocationConfig;
  collection?: { id: string; count: number }[];
  tokens?: number;
}

export const MortgageType = {
  PrincipalAndInterest: 'PrincipalAndInterest',
  Principal: 'Principal'
};
