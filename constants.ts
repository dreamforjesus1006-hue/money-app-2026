import { ETF, Loan, StockLoan, CreditLoan, TaxStatus, MortgageType } from './types';

export const INITIAL_ETFS: ETF[] = [
  { 
    id: '1', 
    name: '0056 (高股息)', 
    shares: 10000, 
    costPrice: 32.5, 
    dividendPerShare: 2.5, 
    dividendType: 'annual',
    payMonths: [1, 4, 7, 10], 
    currentPrice: 38.5,
    lots: [],
    marginInterestRate: 0,
    marginLoanAmount: 0
  },
  { 
    id: '2', 
    name: '00919 (精選高息)', 
    shares: 10000, 
    costPrice: 22.1, 
    dividendPerShare: 0.6, 
    dividendType: 'per_period',
    payMonths: [3, 6, 9, 12], 
    currentPrice: 25.2,
    lots: [],
    marginInterestRate: 0,
    marginLoanAmount: 0
  },
  { 
    id: '3', 
    name: '00982A (主動式)', 
    shares: 5000, 
    costPrice: 14.8, 
    dividendPerShare: 1.2, 
    dividendType: 'annual',
    payMonths: [2, 5, 8, 11], 
    currentPrice: 15.0,
    lots: [],
    marginInterestRate: 0,
    marginLoanAmount: 0
  },
];

export const INITIAL_LOANS: Loan[] = [
  { 
    id: 'l1', 
    name: '新青安房貸', 
    principal: 8000000, 
    startDate: '2023-08-01',
    totalMonths: 480, // 40年 
    paidMonths: 12, 
    gracePeriod: 60, // 5年寬限
    rate1: 1.775, 
    rate1Months: 36, // 前3年優惠
    rate2: 2.15, 
    type: MortgageType.PrincipalAndInterest 
  }
];

// 新增預設信貸
export const INITIAL_CREDIT_LOAN: CreditLoan = {
  name: '個人信貸',
  principal: 0,
  rate: 2.8, // 讓使用者自己填
  totalMonths: 84, // 7年
  paidMonths: 0
};

// 不限用途 (Collateral)
export const INITIAL_STOCK_LOAN: StockLoan = {
  principal: 2000000,
  rate: 2.5, // 讓使用者自己填 (券商/銀行利率)
  maintenanceLimit: 130
};

// 全域融資 (Global Margin)
export const INITIAL_GLOBAL_MARGIN_LOAN: StockLoan = {
  principal: 0,
  rate: 6.0, // 融資利率通常較高 (約 6% - 7%)
  maintenanceLimit: 130
};

export const INITIAL_TAX_STATUS: TaxStatus = {
  hasSpouse: false,
  dependents: 0,
  isDisabled: false,
  salaryIncome: 800000
};