// ↓↓↓ 修正重點：改成同層目錄 ./decimal 和 ./types ↓↓↓
import { Decimal, toDecimal } from './decimal';
import { TaxStatus, ETF } from './types';
// ↑↑↑ 修正結束 ↑↑↑

// 2025 Parameters (2024 Income)
const TAX_PARAMS = {
  exemption: 97000,
  stdDeductionSingle: 131000,
  stdDeductionMarried: 262000,
  salaryDeduction: 218000,
  disabilityDeduction: 218000,
  basicLiving: 210000,
  healthInsuranceRate: 0.0211,
  healthInsuranceThreshold: 20000,
};

export class TaxCalculator {
  // Helper to get annual dividend per share regardless of input type
  private static getAnnualDividendPerShare(etf: ETF): Decimal {
    let val = toDecimal(etf.dividendPerShare);
    // Default to 'annual' if undefined
    const type = etf.dividendType || 'annual';
    
    if (type === 'per_period') {
       // If per_period, Annual = value * number of pay months
       return val.times(etf.payMonths.length);
    }
    return val;
  }

  static calculateTotalDividend(etfs: ETF[]): Decimal {
    return etfs.reduce((acc, etf) => {
      const annualDPS = this.getAnnualDividendPerShare(etf);
      const annualTotal = toDecimal(etf.shares).times(annualDPS);
      return acc.plus(annualTotal);
    }, toDecimal(0));
  }

  static calculateHealthInsurance(etfs: ETF[]): Decimal {
    let totalSurcharge = toDecimal(0);
    const rate = toDecimal(TAX_PARAMS.healthInsuranceRate);
    const threshold = toDecimal(TAX_PARAMS.healthInsuranceThreshold);

    etfs.forEach(etf => {
      const annualDPS = this.getAnnualDividendPerShare(etf);
      const annualTotal = toDecimal(etf.shares).times(annualDPS);
      
      const payoutCount = etf.payMonths.length; 
      if (payoutCount === 0) return;

      const singlePayout = annualTotal.div(payoutCount);

      if (singlePayout.gt(threshold)) {
        // Surcharge applies to the *entire* amount if over threshold
        totalSurcharge = totalSurcharge.plus(annualTotal.times(rate));
      }
    });

    return totalSurcharge;
  }

  static calculateIncomeTax(status: TaxStatus, grossDividend: Decimal): { 
    taxPayable: Decimal; 
    netIncome: Decimal; 
    taxRate: number 
  } {
    const salary = toDecimal(status.salaryIncome);
    const totalGrossIncome = salary.plus(grossDividend);

    // 1. Calculate Exemptions
    // User + Spouse(optional) + Dependents
    const personCount = 1 + (status.hasSpouse ? 1 : 0) + status.dependents;
    const totalExemption = toDecimal(TAX_PARAMS.exemption).times(personCount);

    // 2. Standard Deduction
    const stdDed = toDecimal(status.hasSpouse ? TAX_PARAMS.stdDeductionMarried : TAX_PARAMS.stdDeductionSingle);

    // 3. Special Deductions
    // Salary Deduction (capped at actual salary or limit)
    const salaryDed = Decimal.min(salary, TAX_PARAMS.salaryDeduction);
    
    // Disability
    const disabilityDed = status.isDisabled ? toDecimal(TAX_PARAMS.disabilityDeduction) : toDecimal(0);

    // 4. Basic Living Expense Difference
    const sumForLivingCheck = totalExemption.plus(stdDed).plus(disabilityDed);
    
    const basicLivingTotal = toDecimal(TAX_PARAMS.basicLiving).times(personCount);
    const basicLivingDiff = Decimal.max(0, basicLivingTotal.minus(sumForLivingCheck));

    // Net Taxable Income
    let netTaxable = totalGrossIncome
      .minus(totalExemption)
      .minus(stdDed)
      .minus(salaryDed)
      .minus(disabilityDed)
      .minus(basicLivingDiff);
    
    if (netTaxable.lt(0)) netTaxable = toDecimal(0);

    // Progressive Tax Calculation
    let tax = toDecimal(0);
    let rate = 0;

    if (netTaxable.lte(590000)) {
        tax = netTaxable.times(0.05);
        rate = 5;
    } else if (netTaxable.lte(1330000)) {
        tax = netTaxable.times(0.12).minus(41300);
        rate = 12;
    } else if (netTaxable.lte(2660000)) {
        tax = netTaxable.times(0.20).minus(147700);
        rate = 20;
    } else if (netTaxable.lte(4980000)) {
        tax = netTaxable.times(0.30).minus(413700);
        rate = 30;
    } else {
        tax = netTaxable.times(0.40).minus(829600);
        rate = 40;
    }

    return { taxPayable: tax, netIncome: netTaxable, taxRate: rate };
  }
}
