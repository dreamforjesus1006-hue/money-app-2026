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
}

export enum MortgageType {
  PrincipalAndInterest = 'PrincipalAndInterest', // 本息攤還
  Principal = 'Principal', // 本金攤還 (本金平均攤還)
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

// ↓↓↓ 新增：資金分配的設定 ↓↓↓
export interface AllocationConfig {
  totalFunds: number;    // 總可用資金
  dividendRatio: number; // 配息佔比
  hedgingRatio: number;  // 避險佔比
  activeRatio: number;   // 主動投資佔比
}
// ↑↑↑ 新增結束 ↑↑↑

export interface AppState {
  etfs: ETF[];
  loans: Loan[];
  stockLoan: StockLoan;
  globalMarginLoan: StockLoan;
  creditLoan: CreditLoan;
  taxStatus: TaxStatus;
  allocation?: AllocationConfig; // 加入 AppState
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
