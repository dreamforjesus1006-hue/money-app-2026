import Decimal from 'decimal.js';

// Configure Decimal for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const toDecimal = (val: number | string | Decimal): Decimal => {
  return new Decimal(val);
};

export const formatMoney = (val: Decimal | number): string => {
  const d = new Decimal(val);
  return d.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const formatPercent = (val: Decimal | number): string => {
  const d = new Decimal(val);
  return `${d.toFixed(2)}%`;
};

export { Decimal };