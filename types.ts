export enum MortgageType {
  PrincipalAndInterest = 'PrincipalAndInterest', // 本息平均攤還
  Principal = 'Principal', // 本金平均攤還
}

export type DividendType = 'annual' | 'per_period';

export interface Lot {
  id: string;
  date: string; // 交易日期
  shares: number; // 股數
  price: number; // 成交單價
  fee?: number; // 手續費 (0.1425%)
}

export interface ETF {
  id: string;
  name: string;
  shares: number; // 股數 (若有明細則自動計算)
  costPrice: number; // 持有成本 (若有明細則自動計算平均成本，含手續費)
  dividendPerShare: number; // 預估股利數值
  dividendType?: DividendType; // 股利計算模式 (年化 or 每期)
  payMonths: number[]; // 配息月份 (1-12)
  currentPrice: number; // 現價 (for stress test)
  lots?: Lot[]; // 交易明細
  
  // 新增：個別股票融資設定
  marginInterestRate?: number; // 融資利率 (%)
  marginLoanAmount?: number;   // 融資本金
}

export interface Loan {
  id: string;
  name: string;
  principal: number; // 本金
  startDate?: string; // 核貸日期 (YYYY-MM-DD)
  totalMonths: number; // 總期數
  paidMonths: number; // 已繳期數 (用於判斷目前利率階段)
  gracePeriod: number; // 寬限期 (月)
  rate1: number;       // 第一段利率 (%)
  rate1Months: number; // 第一段期間 (月)
  rate2: number;       // 第二段利率 (%)
  type: MortgageType;
}

// 新增：信用貸款 (本利攤還型)
export interface CreditLoan {
  name: string;
  principal: number;
  rate: number;
  totalMonths: number;
  paidMonths: number;
}

// 股票相關借貸 (不限用途借貸 / 融資) - 只繳息，有斷頭風險
export interface StockLoan {
  principal: number;
  rate: number; // 年利率 (自行輸入)
  maintenanceLimit: number; // 維持率斷頭線 (%)
}

export interface TaxStatus {
  hasSpouse: boolean;
  dependents: number; // 扶養人數
  isDisabled: boolean; // 身心障礙
  salaryIncome: number; // 薪資所得總額
}

export interface MonthlyCashFlow {
  month: number;
  dividendInflow: number;
  loanOutflow: number; // 房貸
  creditLoanOutflow: number; // 信貸 (新增)
  stockLoanInterest: number; // 股票質押/融資利息
  taxWithheld: number; // 預扣稅 (如二代健保)
  netFlow: number;
  cumulativeBalance: number; // 儲水池水位
}

export interface StressTestRow {
  dropRate: number; // 0% to 40%
  stockPricePercentage: number;
  totalMarketValue: number;
  maintenanceRate: number;
  isMarginCall: boolean;
  marginCallAmount: number;
}

export interface AppState {
  etfs: ETF[];
  loans: Loan[];
  creditLoan: CreditLoan;
  stockLoan: StockLoan; // 不限用途 (Collateral)
  globalMarginLoan?: StockLoan; // 全域融資 (Global Margin) - Optional for backward compatibility
  taxStatus: TaxStatus;
}

// Cloud Settings
export interface CloudConfig {
  apiKey: string;
  projectId: string;
  syncId: string; // The user's unique document ID (password)
  enabled: boolean;
}