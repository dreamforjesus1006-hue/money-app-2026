import { Decimal, toDecimal } from '../utils/decimal';
import { ETF, Loan, StockLoan, CreditLoan, MonthlyCashFlow, StressTestRow, TaxStatus } from '../types';
import { LoanCalculator } from './loanCalculator';
import { TaxCalculator } from './taxCalculator';

export class PortfolioCalculator {
  static generateCashFlow(
    etfs: ETF[],
    loans: Loan[],
    stockLoan: StockLoan,
    creditLoan: CreditLoan,
    globalMarginLoan: StockLoan, // Added param
    taxStatus: TaxStatus
  ): { 
    monthlyFlows: MonthlyCashFlow[], 
    yearlyNetPosition: Decimal,
    healthInsuranceTotal: Decimal,
    incomeTaxTotal: Decimal
  } {
    const flows: MonthlyCashFlow[] = [];
    let cumulativeBalance = toDecimal(0);

    // Pre-calculate annual items for tax
    const grossDiv = TaxCalculator.calculateTotalDividend(etfs);
    const healthInsuranceTotal = TaxCalculator.calculateHealthInsurance(etfs);
    const { taxPayable } = TaxCalculator.calculateIncomeTax(taxStatus, grossDiv);

    // 1. 全域股票質押利息 (Global Stock Collateral Loan)
    let monthlyStockLoanInterest = LoanCalculator.getMonthlyStockLoanInterest(stockLoan.principal, stockLoan.rate);

    // 2. 全域股票融資利息 (Global Margin Loan)
    const globalMarginInterest = LoanCalculator.getMonthlyStockLoanInterest(globalMarginLoan.principal, globalMarginLoan.rate);
    monthlyStockLoanInterest = monthlyStockLoanInterest.plus(globalMarginInterest);

    // 3. 加總個別股票的融資利息 (Individual Margin Trading Interest)
    etfs.forEach(etf => {
        if (etf.marginLoanAmount && etf.marginInterestRate) {
            const marginInterest = LoanCalculator.getMonthlyStockLoanInterest(etf.marginLoanAmount, etf.marginInterestRate);
            monthlyStockLoanInterest = monthlyStockLoanInterest.plus(marginInterest);
        }
    });

    const monthlyCreditLoanPayment = LoanCalculator.calculateCreditLoanPayment(creditLoan);

    for (let m = 1; m <= 12; m++) {
      let divInflow = toDecimal(0);
      let taxWithheld = toDecimal(0);

      // Calculate Dividend Inflow for this month
      etfs.forEach(etf => {
        if (etf.payMonths.includes(m)) {
            const shares = toDecimal(etf.shares);
            const val = toDecimal(etf.dividendPerShare);
            const type = etf.dividendType || 'annual';
            let singlePayout = toDecimal(0);

            if (type === 'annual') {
               const payoutCount = etf.payMonths.length;
               if (payoutCount > 0) {
                  const annualTotal = shares.times(val);
                  singlePayout = annualTotal.div(payoutCount);
               }
            } else {
               singlePayout = shares.times(val);
            }
            
            divInflow = divInflow.plus(singlePayout);

            // Health Insurance Check
            if (singlePayout.gt(20000)) {
               taxWithheld = taxWithheld.plus(singlePayout.times(0.0211));
            }
        }
      });

      // Income Tax Hit (May)
      if (m === 5) {
          taxWithheld = taxWithheld.plus(taxPayable);
      }

      // Mortgage Outflows
      let loanOutflow = toDecimal(0);
      loans.forEach(loan => {
         loanOutflow = loanOutflow.plus(LoanCalculator.calculateMonthlyPayment(loan));
      });

      const totalOutflow = loanOutflow
         .plus(monthlyCreditLoanPayment)
         .plus(monthlyStockLoanInterest)
         .plus(taxWithheld);
         
      const net = divInflow.minus(totalOutflow);
      
      cumulativeBalance = cumulativeBalance.plus(net);

      flows.push({
        month: m,
        dividendInflow: divInflow.toNumber(),
        loanOutflow: loanOutflow.toNumber(),
        creditLoanOutflow: monthlyCreditLoanPayment.toNumber(),
        stockLoanInterest: monthlyStockLoanInterest.toNumber(),
        taxWithheld: taxWithheld.toNumber(),
        netFlow: net.toNumber(),
        cumulativeBalance: cumulativeBalance.toNumber()
      });
    }

    return {
        monthlyFlows: flows,
        yearlyNetPosition: cumulativeBalance,
        healthInsuranceTotal,
        incomeTaxTotal: taxPayable
    };
  }

  static runStressTest(
    etfs: ETF[],
    stockLoan: StockLoan,
    globalMarginLoan: StockLoan
  ): StressTestRow[] {
    const results: StressTestRow[] = [];
    const loanPrincipal = toDecimal(stockLoan.principal);
    const globalMarginPrincipal = toDecimal(globalMarginLoan.principal);
    
    // 計算總負債 (質押 + 全域融資 + 所有個別融資)
    let totalDebt = loanPrincipal.plus(globalMarginPrincipal);
    
    etfs.forEach(etf => {
        if (etf.marginLoanAmount) {
            totalDebt = totalDebt.plus(toDecimal(etf.marginLoanAmount));
        }
    });

    // Use the maintenance limit from Stock Loan as the default for the stress test warning
    // (Usually 130% is standard for both)
    const maintenanceLimit = toDecimal(stockLoan.maintenanceLimit); 

    for (let drop = 0; drop <= 40; drop += 5) {
      const dropRate = toDecimal(drop).div(100);
      const remainingRate = toDecimal(1).minus(dropRate);

      let totalMarketValue = toDecimal(0);

      etfs.forEach(etf => {
        const currentMkt = toDecimal(etf.shares).times(etf.currentPrice);
        const stressedMkt = currentMkt.times(remainingRate);
        totalMarketValue = totalMarketValue.plus(stressedMkt);
      });

      let maintenanceRate = toDecimal(0);
      if (!totalDebt.isZero()) {
          maintenanceRate = totalMarketValue.div(totalDebt).times(100);
      } else {
          maintenanceRate = toDecimal(9999); 
      }

      const isMarginCall = maintenanceRate.lt(maintenanceLimit);
      
      let marginCallAmount = toDecimal(0);
      if (isMarginCall) {
          const targetValue = totalDebt.times(maintenanceLimit.div(100));
          marginCallAmount = targetValue.minus(totalMarketValue);
      }

      results.push({
        dropRate: drop,
        stockPricePercentage: remainingRate.times(100).toNumber(),
        totalMarketValue: totalMarketValue.toNumber(),
        maintenanceRate: maintenanceRate.toNumber(),
        isMarginCall,
        marginCallAmount: marginCallAmount.toNumber()
      });
    }
    return results;
  }
}