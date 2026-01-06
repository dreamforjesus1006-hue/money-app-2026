import { ETF, Loan, StockLoan, CreditLoan, TaxStatus, MortgageType } from './types';

export const INITIAL_ETFS: ETF[] = [
  { 
    id: '0056', 
    name: '0056 (高股息)', 
    shares: 0, 
    costPrice: 0, 
    currentPrice: 38.5, 
    dividendPerShare: 2.8, 
    dividendType: 'annual', 
    payMonths: [1, 4, 7, 10],
    marginLoanAmount: 0,
    marginInterestRate: 2.2
  },
  { 
    id: '00919', 
    name: '00919 (群益精選)', 
    shares: 0, 
    costPrice: 0, 
    currentPrice: 25.8, 
    dividendPerShare: 2.4, 
    dividendType: 'annual', 
    payMonths: [3, 6, 9, 12],
    marginLoanAmount: 0,
    marginInterestRate: 2.2
  },
  { 
    id: '00929', 
    name: '00929 (復華科技)', 
    shares: 0, 
    costPrice: 0, 
    currentPrice: 19.5, 
    dividendPerShare: 1.8, 
    dividendType: 'annual', 
    payMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    marginLoanAmount: 0,
    marginInterestRate: 2.2
  },
];

// ↓↓↓ 修改重點：這裡現在有兩筆房貸了 ↓↓↓
export const INITIAL_LOANS: Loan[] = [
  {
    id: 'loan-1',
    name: '新青安房貸',
    principal: 8340000,
    totalMonths: 480, // 40年
    paidMonths: 0,
    rate1: 1.775,
    rate1Months: 480, // 一段式
    rate2: 1.775,
    gracePeriod: 60, // 5年寬限
    type: MortgageType.PrincipalAndInterest,
    startDate: '2025-12-01' // 預設日期
  },
  {
    id: 'loan-2',
    name: '理財型房貸', // 第二筆
    principal: 0,     // 預設 0，你可以進 APP 再改
    totalMonths: 360, // 30年
    paidMonths: 0,
    rate1: 2.5,       // 理財型利率通常稍高
    rate1Months: 360,
    rate2: 2.5,
    gracePeriod: 0,   // 理財型通常隨借隨還，或無寬限
    type: MortgageType.PrincipalAndInterest,
    startDate: ''
  }
];
// ↑↑↑ 修改結束 ↑↑↑

export const INITIAL_STOCK_LOAN: StockLoan = {
  principal: 0,
  rate: 2.2, // 質押利率
  maintenanceLimit: 130 // 維持率斷頭線
};

export const INITIAL_GLOBAL_MARGIN_LOAN: StockLoan = {
  principal: 0,
  rate: 6.5, // 融資利率通常較高
  maintenanceLimit: 130
};

export const INITIAL_CREDIT_LOAN: CreditLoan = {
  principal: 0,
  rate: 2.8,
  totalMonths: 84,
  paidMonths: 0
};

export const INITIAL_TAX_STATUS: TaxStatus = {
  salaryIncome: 600000,
  dependents: 0,
  hasSpouse: false,
  isDisabled: false
};
