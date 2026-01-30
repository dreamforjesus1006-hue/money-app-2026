import React from 'react';
import { DollarSign, Layers, Coffee, Target } from 'lucide-react'; 
import { Loan, StockLoan, CreditLoan, TaxStatus, MortgageType } from '../types';

interface FinanceControlProps {
  loans: Loan[];
  stockLoan: StockLoan;
  globalMarginLoan: StockLoan;
  creditLoan: CreditLoan;
  taxStatus: TaxStatus;
  updateLoan: (idx: number, field: keyof Loan, value: any) => void;
  setStockLoan: (val: StockLoan) => void;
  setGlobalMarginLoan: (val: StockLoan) => void;
  setCreditLoan: (val: CreditLoan) => void;
  setTaxStatus: (val: TaxStatus) => void;
}

export const FinanceControl: React.FC<FinanceControlProps> = ({
  loans, stockLoan, globalMarginLoan, creditLoan, taxStatus,
  updateLoan, setStockLoan, setGlobalMarginLoan, setCreditLoan, setTaxStatus
}) => {
  return (
    <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg space-y-4">
      {/* 1. 房貸區塊 (完整細節版) */}
      <div>
        <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><DollarSign className="w-4 h-4" /> 房貸與信貸</h2>
        {loans.map((loan, idx) => (
          <div key={loan.id} className="mb-4 p-3 bg-slate-950 rounded border border-slate-800">
            <div className="flex justify-between mb-2 items-center">
              <input type="text" value={loan.name} onChange={(e) => updateLoan(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-600 w-1/2 text-sm" />
              <select value={loan.type} onChange={(e) => updateLoan(idx, 'type', e.target.value)} className="bg-slate-900 text-[10px] border border-slate-700 rounded px-1 text-slate-400">
                <option value={MortgageType.PrincipalAndInterest}>本息攤還</option>
                <option value={MortgageType.Principal}>本金攤還</option>
              </select>
            </div>
            {/* 房貸核心參數 */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-slate-500 block">貸款總額</label><input type="number" value={loan.principal} onChange={(e) => updateLoan(idx, 'principal', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" /></div>
              <div><label className="text-[10px] text-emerald-500 block">核貸日期</label><input type="date" value={loan.startDate || ''} onChange={(e) => updateLoan(idx, 'startDate', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" /></div>
              <div><label className="text-[10px] text-slate-500 block">總期數(月)</label><input type="number" value={loan.totalMonths} onChange={(e) => updateLoan(idx, 'totalMonths', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" /></div>
              <div><label className="text-[10px] text-slate-500 block">寬限期(月)</label><input type="number" value={loan.gracePeriod} onChange={(e) => updateLoan(idx, 'gracePeriod', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" /></div>
            </div>
            {/* 二段式利率設定區 */}
            <div className="mt-2 grid grid-cols-3 gap-2 p-2 bg-slate-900/50 rounded border border-slate-800">
              <div><label className="text-[9px] text-blue-400 block">一段利率 %</label><input type="number" value={loan.rate1} onChange={(e) => updateLoan(idx, 'rate1', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-1 text-xs" /></div>
              <div><label className="text-[9px] text-blue-400 block">一段月數</label><input type="number" value={loan.rate1Months} onChange={(e) => updateLoan(idx, 'rate1Months', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-1 text-xs" /></div>
              <div><label className="text-[9px] text-blue-400 block">二段利率 %</label><input type="number" value={loan.rate2} onChange={(e) => updateLoan(idx, 'rate2', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-1 text-xs" /></div>
            </div>
            <div className="mt-2 text-[10px] text-slate-600 text-right">已繳期數: {loan.paidMonths} 期</div>
          </div>
        ))}
        
        {/* 信貸區塊 (利率解鎖可填) */}
        <div className="p-2 bg-slate-950 rounded border border-slate-800 border-l-2 border-l-orange-500">
          <div className="flex justify-between mb-1">
            <span className="text-xs font-bold text-orange-300">信用貸款</span>
            <input type="number" value={creditLoan.rate} onChange={(e) => setCreditLoan({ ...creditLoan, rate: Number(e.target.value) })} className="bg-slate-900 border border-slate-700 rounded px-1 text-xs text-right w-16 text-orange-300" placeholder="利率%" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[9px] text-slate-500">本金</label><input type="number" value={creditLoan.principal} onChange={(e) => setCreditLoan({ ...creditLoan, principal: Number(e.target.value) })} className="bg-slate-900 border border-slate-700 rounded px-1 text-xs w-full" /></div>
            <div><label className="text-[9px] text-slate-500">總期數</label><input type="number" value={creditLoan.totalMonths} onChange={(e) => setCreditLoan({ ...creditLoan, totalMonths: Number(e.target.value) })} className="bg-slate-900 border border-slate-700 rounded px-1 text-xs w-full" /></div>
          </div>
        </div>
      </div>

      {/* 2. 質押與融資 (包含維持率斷頭線) */}
      <div className="pt-2 border-t border-slate-800">
        <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Layers className="w-4 h-4" /> 質押與融資</h2>
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          {/* 質押 */}
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <label className="text-slate-500 block mb-1">質押 (本金 / 利率%)</label>
            <div className="flex gap-1">
              <input type="number" value={stockLoan.principal} onChange={(e) => setStockLoan({ ...stockLoan, principal: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded px-1" />
              <input type="number" value={stockLoan.rate} onChange={(e) => setStockLoan({ ...stockLoan, rate: Number(e.target.value) })} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-blue-300" />
            </div>
          </div>
          {/* 融資 */}
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <label className="text-slate-500 block mb-1">融資 (本金 / 利率%)</label>
            <div className="flex gap-1">
              <input type="number" value={globalMarginLoan.principal} onChange={(e) => setGlobalMarginLoan({ ...globalMarginLoan, principal: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded px-1" />
              <input type="number" value={globalMarginLoan.rate} onChange={(e) => setGlobalMarginLoan({ ...globalMarginLoan, rate: Number(e.target.value) })} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-cyan-300" />
            </div>
          </div>
        </div>
        {/* 維持率設定 */}
        <div className="flex items-center gap-2 bg-red-900/20 p-2 rounded border border-red-900/30">
          <label className="text-xs text-red-400 font-bold"><Target className="w-3 h-3 inline mr-1"/>維持率斷頭線 (%):</label>
          <input type="number" value={stockLoan.maintenanceLimit || 130} onChange={(e) => setStockLoan({ ...stockLoan, maintenanceLimit: Number(e.target.value) })} className="w-16 bg-slate-950 border border-red-900/50 rounded px-1 text-xs text-red-300 font-bold" />
        </div>
      </div>

      {/* 3. 生活與稅務 (全欄位保留) */}
      <div className="pt-2 border-t border-slate-800">
        <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Coffee className="w-4 h-4" /> 生活與稅務</h2>
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div><label className="text-slate-500">薪資所得</label><input type="number" value={taxStatus.salaryIncome} onChange={(e) => setTaxStatus({ ...taxStatus, salaryIncome: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded px-1" /></div>
          <div><label className="text-slate-500">月生活費</label><input type="number" value={taxStatus.livingExpenses} onChange={(e) => setTaxStatus({ ...taxStatus, livingExpenses: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded px-1" /></div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs items-center p-2 bg-slate-950/50 rounded">
          <div><label className="text-slate-500">扶養人數</label><input type="number" value={taxStatus.dependents} onChange={(e) => setTaxStatus({ ...taxStatus, dependents: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded px-1" /></div>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={taxStatus.hasSpouse} onChange={e => setTaxStatus({ ...taxStatus, hasSpouse: e.target.checked })} className="accent-emerald-500" /> <span className="text-slate-400">有配偶</span></label>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={taxStatus.isDisabled} onChange={e => setTaxStatus({ ...taxStatus, isDisabled: e.target.checked })} className="accent-emerald-500" /> <span className="text-slate-400">身心障礙</span></label>
        </div>
      </div>
    </section>
  );
};
