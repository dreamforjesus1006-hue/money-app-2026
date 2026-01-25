// types.ts 全選貼上
export type EtfCategory = 'dividend' | 'hedging' | 'active';

export interface Lot {
  id: string;
  date: string;
  shares: number;
  price: number;
  fee?: number;
}

export interface ETF {
  id: string;
  name: string;
  shares: number;
  costPrice: number;
  currentPrice: number;
  dividendPerShare: number;
  dividendType?: 'annual' | 'per_period';
  payMonths: number[];
  marginLoanAmount?: number;
  marginInterestRate?: number;
  lots?: Lot[];
  category?: EtfCategory; 
}

export enum MortgageType {
  PrincipalAndInterest = 'PrincipalAndInterest', 
  Principal = 'Principal', 
}

export interface Loan {
  id: string;
  name: string;
  principal: number;
  totalMonths: number;
  paidMonths: number;
  rate1: number;
  rate1Months: number;
  rate2: number;
  gracePeriod: number;
  type: MortgageType;
  startDate?: string;
}

export interface StockLoan {
  principal: number;
  rate: number;
  maintenanceLimit: number;
}

export interface CreditLoan {
  principal: number;
  rate: number;
  totalMonths: number;
  paidMonths: number;
}

export interface TaxStatus {
  salaryIncome: number;
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

export interface AppState {
  etfs: ETF[];
  loans: Loan[];
  stockLoan: StockLoan;
  globalMarginLoan: StockLoan;
  creditLoan: CreditLoan;
  taxStatus: TaxStatus;
  allocation?: AllocationConfig; 
}

export interface MonthlyCashFlow {
  month: number;
  dividendInflow: number;
  loanOutflow: number;
  creditLoanOutflow: number;
  stockLoanInterest: number;
  taxWithheld: number;
  netFlow: number;
  cumulativeBalance: number;
}

export interface StressTestRow {
  dropRate: number;
  stockPricePercentage: number;
  totalMarketValue: number;
  maintenanceRate: number;
  isMarginCall: boolean;
  marginCallAmount: number;
}

export interface CloudConfig {
  apiKey: string;
  projectId: string;
  syncId: string;
  enabled: boolean;
}
