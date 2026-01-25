// PortfolioCalculator.ts 全選貼上
import Decimal from 'decimal.js';
import { ETF, Loan, StockLoan, CreditLoan, TaxStatus, MonthlyCashFlow, StressTestRow, MortgageType } from './types';

// Taiwan Tax Brackets (2024/2025)
const TAX_BRACKETS = [
  { limit: 560000, rate: 0.05, deduction: 0 },
  { limit: 1260000, rate: 0.12, deduction: 39200 },
  { limit: 2520000, rate: 0.20, deduction: 140000 },
  { limit: 4720000, rate: 0.30, deduction: 392000 },
  { limit: Infinity, rate: 0.40, deduction: 864000 },
];

const EXEMPTION_PER_PERSON = 97000; 
const STANDARD_DEDUCTION_SINGLE = 131000;
const STANDARD_DEDUCTION_MARRIED = 262000;
const SALARY_DEDUCTION = 218000;
const DIVIDEND_TAX_FREE_LIMIT = 80000; // Tax credit limit
const DIVIDEND_TAX_CREDIT_RATE = 0.085;
const HEALTH_INSURANCE_THRESHOLD = 20000;
const HEALTH_INSURANCE_RATE = 0.0211;

export class PortfolioCalculator {
  
  static calculateLoanPayment(principal: number, rate: number, totalMonths: number): number {
    if (principal <= 0 || rate <= 0 || totalMonths <= 0) return 0;
    const monthlyRate = rate / 100 / 12;
    return Math.floor((principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1));
  }

  static calculateMortgageFlow(loan: Loan, currentMonthIndex: number): number {
    if (loan.principal <= 0) return 0;

    let loanMonthIndex = currentMonthIndex;
    if (loan.startDate) {
        const start = new Date(loan.startDate);
        const now = new Date(); // Assume simulation starts from "now"
        // Simply use the paidMonths offset. 
        // In a real detailed timeline, we'd calculate date diffs. 
        // For this projection, we assume Month 1 of simulation is Loan Month (paidMonths + 1).
        loanMonthIndex = loan.paidMonths + currentMonthIndex;
    } else {
        loanMonthIndex = loan.paidMonths + currentMonthIndex;
    }

    if (loanMonthIndex > loan.totalMonths) return 0;

    const isGracePeriod = loanMonthIndex <= loan.gracePeriod;
    
    // Rate selection
    const currentRate = loanMonthIndex <= loan.rate1Months ? loan.rate1 : loan.rate2;
    const monthlyRate = currentRate / 100 / 12;

    if (isGracePeriod) {
      return Math.floor(loan.principal * monthlyRate);
    }

    // Principal repayment period
    const remainingMonths = loan.totalMonths - loan.gracePeriod;
    
    if (loan.type === MortgageType.Principal) {
       // 本金攤還 (Principal repayment)
       const monthlyPrincipal = Math.floor(loan.principal / remainingMonths);
       // We need to calculate remaining principal to calculate interest
       // This is complex without a full schedule state. 
       // Approximation: Linear decrease of principal
       const monthsInRepayment = loanMonthIndex - loan.gracePeriod;
       const paidPrincipal = monthlyPrincipal * (monthsInRepayment - 1);
       const remainingPrincipal = Math.max(0, loan.principal - paidPrincipal);
       const interest = Math.floor(remainingPrincipal * monthlyRate);
       return monthlyPrincipal + interest;

    } else {
       // 本息攤還 (Principal and Interest)
       return this.calculateLoanPayment(loan.principal, currentRate, remainingMonths);
    }
  }

  static generateCashFlow(
    etfs: ETF[],
    loans: Loan[],
    stockLoan: StockLoan,
    creditLoan: CreditLoan,
    globalMarginLoan: StockLoan,
    taxStatus: TaxStatus
  ): { monthlyFlows: MonthlyCashFlow[], yearlyNetPosition: Decimal, healthInsuranceTotal: Decimal, incomeTaxTotal: Decimal } {
    
    const flows: MonthlyCashFlow[] = [];
    let cumulativeBalance = new Decimal(0);
    let totalDividendIncome = new Decimal(0);

    // 1. Calculate Monthly Flows
    for (let month = 1; month <= 12; month++) {
      let dividendInflow = 0;
      let loanOutflow = 0;
      let creditLoanOutflow = 0;
      let stockLoanInterest = 0;
      let taxWithheld = 0; // 2.11% health insurance withheld at source if > 20k

      // A. Dividends
      etfs.forEach(etf => {
        if (etf.payMonths.includes(month)) {
          let amount = 0;
          if (etf.dividendType === 'per_period') {
             amount = etf.shares * etf.dividendPerShare;
          } else {
             // Annual dividend distributed? Or split?
             // Simplification: If annual, split by payMonths count? 
             // Usually user inputs "Annual Total", but if payMonths has 4 entries, it means it's quarterly.
             // We assume dividendPerShare IS the amount paid per distribution for now if 'per_period'
             // If 'annual', we divide by frequency.
             const freq = etf.payMonths.length || 1;
             amount = (etf.shares * etf.dividendPerShare) / freq;
          }
          
          if (amount >= HEALTH_INSURANCE_THRESHOLD) {
             taxWithheld += Math.floor(amount * HEALTH_INSURANCE_RATE);
          }
          dividendInflow += amount;
        }
      });
      totalDividendIncome = totalDividendIncome.plus(dividendInflow);

      // B. Loans (Mortgage)
      loans.forEach(loan => {
        loanOutflow += this.calculateMortgageFlow(loan, month);
      });

      // C. Credit Loan
      if (creditLoan.principal > 0 && (creditLoan.paidMonths + month) <= creditLoan.totalMonths) {
        creditLoanOutflow += this.calculateLoanPayment(creditLoan.principal, creditLoan.rate, creditLoan.totalMonths);
      }

      // D. Stock Loans (Collateral + Margin)
      // Collateral
      if (stockLoan.principal > 0) {
        stockLoanInterest += Math.floor(stockLoan.principal * (stockLoan.rate / 100 / 12));
      }
      // Global Margin
      if (globalMarginLoan.principal > 0) {
        stockLoanInterest += Math.floor(globalMarginLoan.principal * (globalMarginLoan.rate / 100 / 12));
      }
      // Individual ETF Margin
      etfs.forEach(etf => {
          if (etf.marginLoanAmount && etf.marginLoanAmount > 0) {
              const rate = etf.marginInterestRate || 6;
              stockLoanInterest += Math.floor(etf.marginLoanAmount * (rate / 100 / 12));
          }
      });

      // E. Living Expenses (New Feature)
      const monthlyLiving = taxStatus.livingExpenses || 0;

      const netFlow = new Decimal(dividendInflow)
        .minus(loanOutflow)
        .minus(creditLoanOutflow)
        .minus(stockLoanInterest)
        .minus(taxWithheld)
        .minus(monthlyLiving); // Subtract Living Expenses

      cumulativeBalance = cumulativeBalance.plus(netFlow);

      flows.push({
        month,
        dividendInflow: Math.floor(dividendInflow),
        loanOutflow: Math.floor(loanOutflow),
        creditLoanOutflow: Math.floor(creditLoanOutflow),
        stockLoanInterest: Math.floor(stockLoanInterest),
        taxWithheld: Math.floor(taxWithheld),
        livingExpenses: monthlyLiving, // Record for chart
        netFlow: netFlow.floor().toNumber(),
        cumulativeBalance: cumulativeBalance.floor().toNumber()
      });
    }

    // 2. Calculate Final Income Tax
    const salary = new Decimal(taxStatus.salaryIncome);
    const exemptions = new Decimal(EXEMPTION_PER_PERSON).times(1 + taxStatus.dependents + (taxStatus.hasSpouse ? 1 : 0));
    const stdDeduction = taxStatus.hasSpouse ? STANDARD_DEDUCTION_MARRIED : STANDARD_DEDUCTION_SINGLE;
    const salaryDeduction = new Decimal(Math.min(salary.toNumber(), SALARY_DEDUCTION));
    // Disability deduction could be added here if needed

    // Income Total
    const totalIncome = salary.plus(totalDividendIncome);
    
    // Net Taxable
    let netTaxable = totalIncome.minus(exemptions).minus(stdDeduction).minus(salaryDeduction);
    if (netTaxable.isNegative()) netTaxable = new Decimal(0);

    // Calculate Tax
    let tax = new Decimal(0);
    let remaining = netTaxable;
    let previousLimit = 0;

    for (const bracket of TAX_BRACKETS) {
       const width = bracket.limit - previousLimit;
       const taxableInBracket = Decimal.min(remaining, width);
       
       if (taxableInBracket.lte(0)) break;

       tax = tax.plus(taxableInBracket.times(bracket.rate));
       remaining = remaining.minus(taxableInBracket);
       previousLimit = bracket.limit;
    }

    // Dividend Tax Credit
    const dividendTaxCredit = Decimal.min(totalDividendIncome.times(DIVIDEND_TAX_CREDIT_RATE), DIVIDEND_TAX_FREE_LIMIT);
    
    const finalIncomeTax = tax.minus(dividendTaxCredit);
    const payableTax = finalIncomeTax.isNegative() ? new Decimal(0) : finalIncomeTax; // Can't be negative (no refund logic here)

    // Health Insurance Total (2.11% on all dividends > 20k) - already summed in monthly but let's aggregate for display
    const healthInsuranceTotal = new Decimal(flows.reduce((acc, curr) => acc + curr.taxWithheld, 0));

    return {
      monthlyFlows: flows,
      yearlyNetPosition: cumulativeBalance.minus(payableTax), // Subtract end-of-year tax
      healthInsuranceTotal,
      incomeTaxTotal: payableTax
    };
  }

  static runStressTest(etfs: ETF[], stockLoan: StockLoan, globalMarginLoan: StockLoan): StressTestRow[] {
    const drops = [0, 10, 20, 30, 40, 50];
    const results: StressTestRow[] = [];

    // Calculate total debt
    const totalCollateralLoan = stockLoan.principal;
    const totalGlobalMargin = globalMarginLoan.principal;
    const totalEtfMargin = etfs.reduce((acc, e) => acc + (e.marginLoanAmount || 0), 0);
    const totalDebt = totalCollateralLoan + totalGlobalMargin + totalEtfMargin;

    // Calculate total initial asset value
    const totalAssetValue = etfs.reduce((acc, e) => acc + (e.shares * e.currentPrice), 0);

    drops.forEach(drop => {
       const remainingPct = 100 - drop;
       const currentAssetValue = totalAssetValue * (remainingPct / 100);
       
       let maintenanceRate = 999;
       if (totalDebt > 0) {
          maintenanceRate = (currentAssetValue / totalDebt) * 100;
       }

       // Check critical levels
       // Collateral Loan limit: usually 130%
       // Margin Loan limit: usually 130%
       // We use the stricter one or a general one defined in StockLoan
       const limit = stockLoan.maintenanceLimit || 130;
       const isMarginCall = maintenanceRate < limit && totalDebt > 0;
       
       let marginCallAmount = 0;
       if (isMarginCall) {
          // How much to pay back to get back to limit?
          // (Asset) / (Debt - X) = Limit%
          // Asset = Limit% * (Debt - X)
          // Asset / Limit% = Debt - X
          // X = Debt - (Asset / Limit%)
          marginCallAmount = totalDebt - (currentAssetValue / (limit / 100));
       }

       results.push({
         dropRate: drop,
         stockPricePercentage: remainingPct,
         totalMarketValue: currentAssetValue,
         maintenanceRate,
         isMarginCall,
         marginCallAmount: Math.max(0, marginCallAmount)
       });
    });

    return results;
  }
}
