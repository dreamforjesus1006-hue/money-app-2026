import { Decimal, toDecimal } from '../utils/decimal';
import { Loan, MortgageType, CreditLoan } from '../types';

export class LoanCalculator {
  /**
   * Calculate monthly payment for the *current* state of the loan.
   */
  static calculateMonthlyPayment(loan: Loan): Decimal {
    const P = toDecimal(loan.principal);
    const N = toDecimal(loan.totalMonths);
    const grace = toDecimal(loan.gracePeriod);
    
    const currentMonth = toDecimal(loan.paidMonths).plus(1);
    
    const currentRatePercent = currentMonth.lte(loan.rate1Months) ? loan.rate1 : loan.rate2;
    const r = toDecimal(currentRatePercent).div(100).div(12);

    if (currentMonth.lte(grace)) {
      return P.times(r);
    }

    const remainingN = N.minus(grace);

    if (remainingN.lte(0)) return toDecimal(0);

    if (loan.type === MortgageType.PrincipalAndInterest) {
      const numerator = P.times(r).times(toDecimal(1).plus(r).pow(remainingN));
      const denominator = toDecimal(1).plus(r).pow(remainingN).minus(1);
      return numerator.div(denominator);
    } else {
      const monthlyPrincipal = P.div(remainingN);
      const principalPaymentMonths = Decimal.max(0, currentMonth.minus(grace).minus(1));
      const principalPaid = monthlyPrincipal.times(principalPaymentMonths);
      const remainingBalance = Decimal.max(0, P.minus(principalPaid));
      
      const interest = remainingBalance.times(r);
      return monthlyPrincipal.plus(interest);
    }
  }

  /**
   * Calculate Personal Credit Loan Payment (Standard P&I)
   * 信貸通常是本利攤還
   */
  static calculateCreditLoanPayment(loan: CreditLoan): Decimal {
    if (loan.principal <= 0) return toDecimal(0);
    
    // If paid off
    if (loan.paidMonths >= loan.totalMonths) return toDecimal(0);

    const P = toDecimal(loan.principal);
    const r = toDecimal(loan.rate).div(100).div(12);
    const N = toDecimal(loan.totalMonths);

    // PMT Formula: P * r * (1+r)^N / ((1+r)^N - 1)
    const numerator = P.times(r).times(toDecimal(1).plus(r).pow(N));
    const denominator = toDecimal(1).plus(r).pow(N).minus(1);
    
    return numerator.div(denominator);
  }

  static getMonthlyStockLoanInterest(principal: number, rate: number): Decimal {
    const P = toDecimal(principal);
    const r = toDecimal(rate).div(100).div(12);
    return P.times(r);
  }
}