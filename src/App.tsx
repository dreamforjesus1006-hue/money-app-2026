import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area } from 'recharts';
// 👇 修正：這裡補齊了之前缺少的 Crown, Trophy, Calendar
import { Calculator, DollarSign, Wallet, Activity, Save, Upload, Download, RotateCcw, Settings, Globe, Cloud, Loader2, Target, Zap, TrendingUp, RefreshCw, Gift, PieChart as PieIcon, Banknote, Flame, Share2, Scale, ShieldCheck, Swords, Coins, Skull, Gem, Scroll, Sparkles, Lock, Aperture, List, Trash2, X, Tag, ShoppingCart, Coffee, Layers, Crown, Trophy, Calendar } from 'lucide-react';

// ==========================================
// 1. 核心定義 (全部內建)
// ==========================================

const BROKERAGE_RATE = 0.001425;
const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#8b5cf6', cash: '#334155' };
const QUOTES = ["「別人恐懼我貪婪。」— 巴菲特", "「長期而言，股市是稱重機。」", "「不要虧損。」", "「複利是世界第八大奇蹟。」"];

const MortgageType = {
  PrincipalAndInterest: 'PrincipalAndInterest',
  Principal: 'Principal'
};

// 👇 修正：補上之前遺漏的 AppState 定義
interface AppState { 
    etfs: ETF[]; 
    loans: Loan[]; 
    stockLoan: StockLoan; 
    globalMarginLoan: StockLoan; 
    creditLoan: CreditLoan; 
    taxStatus: TaxStatus; 
    allocation: AllocationConfig; 
    collection?: {id:string, count:number}[]; 
    tokens?: number; 
}

interface Lot { id: string; date: string; shares: number; price: number; fee?: number; margin?: number; }
interface ETF { id: string; code?: string; name: string; shares: number; costPrice: number; currentPrice: number; dividendPerShare: number; dividendType?: 'annual' | 'per_period'; payMonths?: number[]; category: 'dividend' | 'hedging' | 'active'; marginLoanAmount?: number; marginInterestRate?: number; lots?: Lot[]; }
interface Loan { id: string; name: string; principal: number; rate1: number; rate1Months: number; rate2: number; totalMonths: number; paidMonths: number; gracePeriod: number; startDate?: string; type: string; }
interface StockLoan { principal: number; rate: number; maintenanceLimit?: number; }
interface CreditLoan { principal: number; rate: number; totalMonths: number; paidMonths: number; }
interface TaxStatus { salaryIncome: number; livingExpenses: number; dependents: number; hasSpouse: boolean; isDisabled: boolean; }
interface AllocationConfig { totalFunds: number; dividendRatio: number; hedgingRatio: number; activeRatio: number; }
interface CloudConfig { apiKey: string; projectId: string; syncId: string; enabled: boolean; priceSourceUrl?: string; }

// 預設資料
const INITIAL_ETFS: ETF[] = [
  { id: '1', code: '0056', name: '元大高股息', shares: 0, costPrice: 0, currentPrice: 38.5, dividendPerShare: 2.8, dividendType: 'per_period', payMonths: [1, 4, 7, 10], category: 'dividend', marginLoanAmount: 0 },
  { id: '2', code: '00919', name: '群益精選高息', shares: 0, costPrice: 0, currentPrice: 26.2, dividendPerShare: 2.4, dividendType: 'per_period', payMonths: [3, 6, 9, 12], category: 'dividend', marginLoanAmount: 0 },
];
const INITIAL_LOANS: Loan[] = [{ id: 'l1', name: '房貸一', principal: 0, rate1: 2.06, rate1Months: 24, rate2: 2.15, totalMonths: 360, paidMonths: 0, gracePeriod: 36, type: 'PrincipalAndInterest' }];
const INITIAL_STOCK_LOAN: StockLoan = { principal: 0, rate: 2.5, maintenanceLimit: 130 };
const INITIAL_GLOBAL_MARGIN_LOAN: StockLoan = { principal: 0, rate: 6.5 };
const INITIAL_CREDIT_LOAN: CreditLoan = { principal: 0, rate: 2.8, totalMonths: 84, paidMonths: 0 };
const INITIAL_TAX_STATUS: TaxStatus = { salaryIncome: 0, livingExpenses: 30000, dependents: 0, hasSpouse: false, isDisabled: false };
const INITIAL_ALLOCATION: AllocationConfig = { totalFunds: 0, dividendRatio: 70, hedgingRatio: 20, activeRatio: 10 };

const THEMES = {
    default: { name: '冒險者', color: 'emerald', bg: 'from-emerald-900', border: 'border-emerald-500', text: 'text-emerald-400', icon: <Zap className="w-4 h-4"/> },
    paladin: { name: '聖騎士', color: 'yellow', bg: 'from-yellow-900', border: 'border-yellow-500', text: 'text-yellow-400', icon: <ShieldCheck className="w-4 h-4"/> }, 
    berserker: { name: '狂戰士', color: 'red', bg: 'from-red-900', border: 'border-red-500', text: 'text-red-400', icon: <Swords className="w-4 h-4"/> }, 
    assassin: { name: '刺客', color: 'purple', bg: 'from-purple-900', border: 'border-purple-500', text: 'text-purple-400', icon: <Zap className="w-4 h-4"/> }, 
    merchant: { name: '大商賈', color: 'blue', bg: 'from-blue-900', border: 'border-blue-500', text: 'text-blue-400', icon: <Coins className="w-4 h-4"/> }, 
};

// ==========================================
// 2. 工具函數
// ==========================================

const formatMoney = (val: any) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '$0';
  return `$${Math.floor(Number(val)).toLocaleString()}`;
};

const safeVal = (v: any): number => {
  return Number(v) || 0;
};

// ==========================================
// 3. 內建計算邏輯
// ==========================================

const calculateLoanPayment = (loan: Loan) => {
    if (loan.paidMonths < loan.gracePeriod) {
        return Math.floor(loan.principal * (loan.rate1 / 100 / 12));
    }
    const rate = (loan.paidMonths < loan.rate1Months ? loan.rate1 : loan.rate2) / 100 / 12;
    const remainingMonths = loan.totalMonths - loan.paidMonths;
    if (remainingMonths <= 0) return 0;
    return Math.floor((loan.principal * rate * Math.pow(1 + rate, remainingMonths)) / (Math.pow(1 + rate, remainingMonths) - 1));
};

const generateCashFlow = (etfs: ETF[], loans: Loan[], stockLoan: StockLoan, creditLoan: CreditLoan, globalMarginLoan: StockLoan, taxStatus: TaxStatus) => {
    const monthlyFlows = [];
    let totalDividendYear = 0;
    
    for (let m = 1; m <= 12; m++) {
        let dividendInflow = 0;
        (etfs || []).forEach(etf => {
            if (etf.payMonths?.includes(m)) {
                dividendInflow += (etf.shares * etf.dividendPerShare);
            }
        });
        
        let loanOutflow = 0;
        (loans || []).forEach(l => loanOutflow += calculateLoanPayment(l));
        
        const creditRate = creditLoan.rate / 100 / 12;
        const creditOutflow = creditLoan.principal > 0 ? Math.floor((creditLoan.principal * creditRate * Math.pow(1 + creditRate, creditLoan.totalMonths)) / (Math.pow(1 + creditRate, creditLoan.totalMonths) - 1)) : 0;
        
        const stockInterest = Math.floor((stockLoan.principal * (stockLoan.rate/100)/12) + (globalMarginLoan.principal * (globalMarginLoan.rate/100)/12));
        const marginInterest = (etfs || []).reduce((acc, e) => acc + ((e.marginLoanAmount||0) * ((e.marginInterestRate||6.5)/100)/12), 0);

        const taxWithheld = Math.floor(dividendInflow * 0.0211);
        
        totalDividendYear += dividendInflow;

        monthlyFlows.push({
            month: m,
            dividendInflow: dividendInflow,
            loanOutflow,
            creditLoanOutflow: creditOutflow,
            stockLoanInterest: stockInterest + marginInterest,
            livingExpenses: taxStatus.livingExpenses,
            taxWithheld,
            netFlow: dividendInflow - loanOutflow - creditOutflow - (stockInterest + marginInterest) - taxStatus.livingExpenses - taxWithheld
        });
    }
    
    const yearlyNetPosition = monthlyFlows.reduce((acc, cur) => acc + cur.netFlow, 0);
    return { monthlyFlows, yearlyNetPosition, healthInsuranceTotal: totalDividendYear * 0.0211, incomeTaxTotal: 0 };
};

// ==========================================
// 4. 儲存服務 (使用全新 Key: v22_final)
// ==========================================
const STORAGE_KEY = 'baozutang_data_v22_final';
const CLOUD_CONFIG_KEY = 'baozutang_cloud_config';

const StorageService = {
    saveData: async (data: any) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
    },
    loadData: async () => {
        try { const local = localStorage.getItem(STORAGE_KEY); return { data: local ? JSON.parse(local) : null }; } catch (e) { return { data: null }; }
    },
    saveCloudConfig: (config: any) => {
        localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
    },
    loadCloudConfig: () => {
        const c = localStorage.getItem(CLOUD_CONFIG_KEY);
        return c ? JSON.parse(c) : null;
    },
    exportToFile: (data: any) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `baozutang_backup.json`; a.click();
    }
};

// ==========================================
// 5. 內建子元件 (FinanceControl)
// ==========================================

const FinanceControl = ({ loans, stockLoan, globalMarginLoan, creditLoan, taxStatus, updateLoan, setStockLoan, setGlobalMarginLoan, setCreditLoan, setTaxStatus }: any) => {
  return (
    <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><DollarSign className="w-4 h-4" /> 房貸與信貸</h2>
        {(loans || []).map((loan: any, idx: number) => (
          <div key={loan.id || idx} className="mb-4 p-3 bg-slate-950 rounded border border-slate-800">
            <div className="flex justify-between mb-2 items-center">
              <input type="text" value={loan.name} onChange={(e) => updateLoan(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-600 w-1/2 text-sm" />
              <select value={loan.type} onChange={(e) => updateLoan(idx, 'type', e.target.value)} className="bg-slate-900 text-[10px] border border-slate-700 rounded px-1 text-slate-400">
                <option value={MortgageType.PrincipalAndInterest}>本息攤還</option>
                <option value={MortgageType.Principal}>本金攤還</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-slate-500 block">貸款總額</label><input type="number" value={loan.principal} onChange={(e) => updateLoan(idx, 'principal', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" /></div>
              <div><label className="text-[10px] text-emerald-500 block">核貸日期</label><input type="date" value={loan.startDate || ''} onChange={(e) => updateLoan(idx, 'startDate', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" /></div>
              <div><label className="text-[10px] text-slate-500 block">總期數(月)</label><input type="number" value={loan.totalMonths} onChange={(e) => updateLoan(idx, 'totalMonths', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" /></div>
              <div><label className="text-[10px] text-slate-500 block">寬限期(月)</label><input type="number" value={loan.gracePeriod} onChange={(e) => updateLoan(idx, 'gracePeriod', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" /></div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 p-2 bg-slate-900/50 rounded border border-slate-800">
              <div><label className="text-[9px] text-blue-400 block">一段利率 %</label><input type="number" value={loan.rate1} onChange={(e) => updateLoan(idx, 'rate1', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-1 text-xs" /></div>
              <div><label className="text-[9px] text-blue-400 block">一段月數</label><input type="number" value={loan.rate1Months} onChange={(e) => updateLoan(idx, 'rate1Months', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-1 text-xs" /></div>
              <div><label className="text-[9px] text-blue-400 block">二段利率 %</label><input type="number" value={loan.rate2} onChange={(e) => updateLoan(idx, 'rate2', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-1 text-xs" /></div>
            </div>
            <div className="mt-2 text-[10px] text-slate-600 text-right">已繳期數: {loan.paidMonths} 期</div>
          </div>
        ))}
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
      <div className="pt-2 border-t border-slate-800">
        <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Layers className="w-4 h-4" /> 質押與融資 (維持率斷頭線)</h2>
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <label className="text-slate-500 block mb-1">質押 (本金 / 利率%)</label>
            <div className="flex gap-1">
              <input type="number" value={stockLoan.principal} onChange={(e) => setStockLoan({ ...stockLoan, principal: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded px-1" />
              <input type="number" value={stockLoan.rate} onChange={(e) => setStockLoan({ ...stockLoan, rate: Number(e.target.value) })} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-blue-300" />
            </div>
          </div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <label className="text-slate-500 block mb-1">融資 (本金 / 利率%)</label>
            <div className="flex gap-1">
              <input type="number" value={globalMarginLoan.principal} onChange={(e) => setGlobalMarginLoan({ ...globalMarginLoan, principal: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded px-1" />
              <input type="number" value={globalMarginLoan.rate} onChange={(e) => setGlobalMarginLoan({ ...globalMarginLoan, rate: Number(e.target.value) })} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-cyan-300" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-red-400">⚠️ 維持率斷頭線 (%):</label>
          <input type="number" value={stockLoan.maintenanceLimit || 130} onChange={(e) => setStockLoan({ ...stockLoan, maintenanceLimit: Number(e.target.value) })} className="w-16 bg-slate-950 border border-red-900/50 rounded px-1 text-xs text-red-300" />
        </div>
      </div>
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

// --- 6. 內建子元件 (AssetList) ---
const AssetList = ({ etfs, setEtfs }: any) => {
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState<{shares: string, price: string, date: string, margin: string}>({ shares: '', price: '', date: '', margin: '' });
  const [newLot, setNewLot] = useState<{shares: string, price: string, date: string, margin: string}>({ shares: '', price: '', date: '', margin: '' });

  const updateEtf = (i: number, field: keyof ETF, val: any) => { const n = [...etfs]; n[i] = { ...n[i], [field]: val }; setEtfs(n); };
  const addEtf = () => { setEtfs([...etfs, { id: Date.now().toString(), code: '', name: '新標的', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'annual', payMonths: [], marginLoanAmount: 0, marginInterestRate: 0, lots: [], category: 'dividend' }]); };
  const removeEtf = (id: string) => { if (window.confirm('確定刪除？')) setEtfs(etfs.filter((e: any) => e.id !== id)); };
  const toggleLots = (id: string) => { setExpandedEtfId(expandedEtfId === id ? null : id); setActiveBuyId(null); };
  const toggleBuy = (id: string) => { setActiveBuyId(activeBuyId === id ? null : id); setExpandedEtfId(null); };

  const submitBuy = (i: number) => {
    const s = Number(buyForm.shares), p = Number(buyForm.price), m = Number(buyForm.margin); if (!s || !p) return;
    const targetEtf = etfs[i];
    const fee = targetEtf.category === 'hedging' ? 0 : Math.floor(s * p * BROKERAGE_RATE);
    const n = [...etfs]; const l = n[i].lots ? [...n[i].lots!] : [];
    l.push({ id: Date.now().toString(), date: buyForm.date, shares: s, price: p, fee, margin: m });
    const totalShares = l.reduce((a: number, b: any) => a + b.shares, 0);
    const totalCost = l.reduce((a: number, b: any) => a + b.shares * b.price + (b.fee || 0), 0);
    const totalMargin = l.reduce((a: number, b: any) => a + (b.margin || 0), 0);
    n[i] = { ...n[i], lots: l, shares: totalShares, costPrice: Number((totalShares ? totalCost / totalShares : 0).toFixed(2)), marginLoanAmount: totalMargin };
    setEtfs(n); setBuyForm({ ...buyForm, shares: '', price: '', margin: '' }); setActiveBuyId(null);
  };

  const addLot = (i: number) => {
    const s = Number(newLot.shares), p = Number(newLot.price), m = Number(newLot.margin); if (!s || !p) return;
    const targetEtf = etfs[i];
    const fee = targetEtf.category === 'hedging' ? 0 : Math.floor(s * p * BROKERAGE_RATE);
    const n = [...etfs]; const l = n[i].lots ? [...n[i].lots!] : [];
    l.push({ id: Date.now().toString(), date: newLot.date, shares: s, price: p, fee, margin: m });
    const totalShares = l.reduce((a: number, b: any) => a + b.shares, 0);
    const totalCost = l.reduce((a: number, b: any) => a + b.shares * b.price + (b.fee || 0), 0);
    const totalMargin = l.reduce((a: number, b: any) => a + (b.margin || 0), 0);
    n[i] = { ...n[i], lots: l, shares: totalShares, costPrice: Number((totalShares ? totalCost / totalShares : 0).toFixed(2)), marginLoanAmount: totalMargin };
    setEtfs(n); setNewLot({ ...newLot, shares: '', price: '', margin: '' });
  };

  const removeLot = (i: number, lotId: string) => {
    const n = [...etfs]; const l = n[i].lots!.filter((x: any) => x.id !== lotId);
    const totalShares = l.reduce((a: number, b: any) => a + b.shares, 0);
    const totalCost = l.reduce((a: number, b: any) => a + b.shares * b.price + (b.fee || 0), 0);
    const totalMargin = l.reduce((a: number, b: any) => a + (b.margin || 0), 0);
    n[i] = { ...n[i], lots: l, shares: totalShares, costPrice: Number((totalShares ? totalCost / totalShares : 0).toFixed(2)), marginLoanAmount: totalMargin };
    setEtfs(n);
  };

  const toggleEtfPayMonth = (i: number, m: number) => { const e = etfs[i]; const ms = e.payMonths?.includes(m) ? e.payMonths.filter((x: number) => x !== m) : [...(e.payMonths || []), m].sort((a: number, b: number) => a - b); updateEtf(i, 'payMonths', ms); };
  const toggleEtfDividendType = (i: number) => { const n = [...etfs]; n[i].dividendType = n[i].dividendType === 'annual' ? 'per_period' : 'annual'; setEtfs(n); };

  return (
    <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg">
      <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-400" /> 裝備清單</h2>
      <div className="space-y-3">
        {etfs.map((etf: any, idx: number) => {
          const hasLots = etf.lots && etf.lots.length > 0;
          const isExpanded = expandedEtfId === etf.id;
          const isBuying = activeBuyId === etf.id;
          const isHedging = etf.category === 'hedging';
          return (
            <div key={etf.id} className={`p-3 bg-slate-950 rounded-xl border transition-all hover:border-slate-600 ${isHedging ? 'border-amber-900/50' : 'border-slate-800'}`}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex-1 mr-2 flex items-center gap-1">
                  <div className="relative group/code"><Tag className="absolute left-1 top-1.5 w-3 h-3 text-slate-500" /><input type="text" value={etf.code || ''} onChange={(e) => updateEtf(idx, 'code', e.target.value)} className="bg-slate-900 border border-slate-700 rounded pl-5 pr-1 py-0.5 text-xs text-blue-300 w-20 focus:border-blue-500 outline-none" placeholder="代號" /></div>
                  <input type="text" value={etf.name} onChange={(e) => updateEtf(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-600 focus:border-blue-500 outline-none w-full text-sm" />
                </div>
                <div className="flex gap-1"><button onClick={() => toggleBuy(etf.id)} className={`p-1.5 rounded-lg border transition-colors ${isBuying ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-emerald-400'}`}><ShoppingCart className="w-3 h-3" /></button><button onClick={() => toggleLots(etf.id)} className={`p-1.5 rounded-lg border transition-colors ${hasLots ? 'bg-slate-800 border-slate-600 text-slate-300' : 'border-slate-700 text-slate-500'}`}><List className="w-3 h-3" /></button><button onClick={() => removeEtf(etf.id)} className="p-1.5 rounded-lg border border-slate-700 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button></div>
              </div>
              {isBuying && (<div className="mb-2 p-2 bg-emerald-900/20 border border-emerald-500/20 rounded-lg animate-in slide-in-from-top-2"><div className="grid grid-cols-4 gap-1 mb-2"><div className="col-span-1"><label className="text-[9px] text-slate-500">日期</label><input type="date" value={buyForm.date} onChange={e => setBuyForm({...buyForm, date: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div><div><label className="text-[9px] text-slate-500">數量</label><input type="number" placeholder="0" value={buyForm.shares} onChange={e => setBuyForm({...buyForm, shares: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div><div><label className="text-[9px] text-slate-500">單價</label><input type="number" placeholder="0" value={buyForm.price} onChange={e => setBuyForm({...buyForm, price: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div><div><label className="text-[9px] text-blue-400">融資$</label><input type="number" placeholder="0" value={buyForm.margin} onChange={e => setBuyForm({...buyForm, margin: e.target.value})} className="w-full bg-slate-900 border border-blue-900 rounded px-1 py-0.5 text-xs text-white placeholder-blue-900/50" /></div></div><button onClick={() => submitBuy(idx)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1 rounded text-xs font-bold">確認交易</button></div>)}
              <div className="grid grid-cols-3 gap-2 mb-2"><div><label className="text-[9px] text-slate-500 block">數量</label><input type="number" value={etf.shares} onChange={(e) => updateEtf(idx, 'shares', Number(e.target.value))} disabled={hasLots} className={`w-full bg-slate-900 border rounded px-1 py-0.5 text-xs ${hasLots ? 'border-slate-800 text-slate-500' : 'border-slate-700 text-white'}`} /></div><div><label className="text-[9px] text-slate-500 block">成本</label><input type="number" value={etf.costPrice} onChange={(e) => updateEtf(idx, 'costPrice', Number(e.target.value))} disabled={hasLots} className={`w-full bg-slate-900 border rounded px-1 py-0.5 text-xs ${hasLots ? 'border-slate-800 text-slate-500' : 'border-slate-700 text-white'}`} /></div><div><label className="text-[9px] text-slate-500 block">現價</label><input type="number" value={etf.currentPrice} onChange={(e) => updateEtf(idx, 'currentPrice', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div></div>
              <div className="flex gap-1 justify-end"><select value={etf.category} onChange={(e) => updateEtf(idx, 'category', e.target.value)} className="bg-slate-900 text-[9px] border border-slate-700 rounded px-1 text-slate-400"><option value="dividend">配息型</option><option value="hedging">避險型</option><option value="active">主動型</option></select><select value={etf.dividendType||'annual'} onChange={(e) => toggleEtfDividendType(idx)} className="bg-slate-900 text-[9px] border border-slate-700 rounded px-1 text-slate-400" disabled={isHedging}><option value="annual">年配</option><option value="per_period">期配</option></select><div className="flex-1"></div><input type="number" value={etf.dividendPerShare} onChange={(e) => updateEtf(idx, 'dividendPerShare', Number(e.target.value))} className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-right" disabled={isHedging} placeholder="配息"/></div>
              <div className="mt-2 flex gap-1 flex-wrap">{Array.from({length: 12}, (_, i) => i + 1).map(month => (<button key={month} onClick={() => toggleEtfPayMonth(idx, month)} className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center transition-all ${etf.payMonths?.includes(month) ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50 scale-110' : 'bg-slate-800 text-slate-600 hover:bg-slate-700'}`}>{month}</button>))}</div>
              {isExpanded && (<div className="mt-2 pt-2 border-t border-slate-800"><div className="text-[9px] text-slate-500 mb-1">交易明細 (含融資額)</div>{etf.lots?.map((l: any)=><div key={l.id} className="flex justify-between items-center text-[10px] text-slate-400 mb-1 p-1 bg-slate-900/50 rounded border border-slate-800"><span className="w-16">{l.date}</span><span className="flex-1 text-right">{l.shares}股 @ {l.price}</span><span className="w-20 text-right text-blue-400">{l.margin ? `(融:${l.margin})` : ''}</span><button onClick={()=>removeLot(idx, l.id)} className="ml-2 text-red-500 hover:text-red-400"><X className="w-3 h-3"/></button></div>)}<div className="flex gap-1 mt-2 pt-2 border-t border-slate-800"><input type="date" value={newLot.date} onChange={e=>setNewLot({...newLot, date:e.target.value})} className="bg-slate-900 border border-slate-700 rounded text-[9px] w-16"/><input type="number" placeholder="股" value={newLot.shares} onChange={e=>setNewLot({...newLot, shares:e.target.value})} className="bg-slate-900 border border-slate-700 rounded text-[9px] w-12"/><input type="number" placeholder="$" value={newLot.price} onChange={e=>setNewLot({...newLot, price:e.target.value})} className="bg-slate-900 border border-slate-700 rounded text-[9px] w-12"/><input type="number" placeholder="融資" value={newLot.margin} onChange={e=>setNewLot({...newLot, margin:e.target.value})} className="bg-slate-900 border border-blue-900 rounded text-[9px] w-12 text-blue-300"/><button onClick={()=>addLot(idx)} className="bg-slate-800 px-2 rounded text-[10px]">+</button></div></div>)}
            </div>
          );
        })}
        <button onClick={addEtf} className="w-full py-2 bg-slate-900 border border-dashed border-slate-700 rounded-xl text-slate-500 text-xs hover:text-white hover:border-slate-500 transition-all">+ 新增標的</button>
      </div>
    </section>
  );
};

// --- 7. 內建子元件 (GameHUD) ---
const GameHUD = ({ combatPower, levelInfo, fireRatio, currentMaintenance, totalMarketValue, totalDebt, skills, annualPassiveIncome, hasHedging, hasLeverage, netWorthPositive, collection, currentClass }: any) => {
  const achievements = [
      { id: '1', name: '初心冒險者', icon: <Swords className="w-5 h-5"/>, desc: '開始投資旅程', unlocked: totalMarketValue > 0, color: 'text-slate-200 border-slate-500 shadow-slate-500/20' },
      { id: '2', name: '第一桶金', icon: <Coins className="w-5 h-5"/>, desc: '總資產 > 100萬', unlocked: totalMarketValue >= 1000000, color: 'text-emerald-400 border-emerald-500 shadow-emerald-500/20' },
      { id: '3', name: '千萬富翁', icon: <Gem className="w-5 h-5"/>, desc: '總資產 > 1000萬', unlocked: totalMarketValue >= 10000000, color: 'text-purple-400 border-purple-500 shadow-purple-500/20' },
      { id: '4', name: '煉金術士', icon: <Sparkles className="w-5 h-5"/>, desc: '持有黃金等避險資產', unlocked: hasHedging, color: 'text-yellow-400 border-yellow-500 shadow-yellow-500/20' },
      { id: '5', name: '現金流大師', icon: <RefreshCw className="w-5 h-5"/>, desc: '年股息超過 50 萬', unlocked: annualPassiveIncome >= 500000, color: 'text-blue-400 border-blue-500 shadow-blue-500/20' },
      { id: '6', name: '槓桿戰士', icon: <Zap className="w-5 h-5"/>, desc: '使用融資或質押', unlocked: hasLeverage, color: 'text-red-400 border-red-500 shadow-red-500/20' },
      { id: '7', name: '財富國王', icon: <Crown className="w-5 h-5"/>, desc: 'FIRE 自由度達 100%', unlocked: fireRatio >= 100, color: 'text-yellow-500 border-yellow-500 shadow-yellow-500/40' },
      { id: '8', name: '債務殺手', icon: <Skull className="w-5 h-5"/>, desc: '資產大於總負債', unlocked: netWorthPositive, color: 'text-orange-500 border-orange-500 shadow-orange-500/20' },
  ];

  const GACHA_ITEMS_LOCAL = [
    { id: 'g1', name: '巴菲特的眼鏡', rarity: 'SR', icon: '👓', desc: '看透市場本質' },
    { id: 'g2', name: '蒙格的格柵', rarity: 'SSR', icon: '🏗️', desc: '多元思維模型' },
    { id: 'g3', name: '科斯托蘭尼之狗', rarity: 'R', icon: '🐕', desc: '主人與狗的牽絆' },
    { id: 'g4', name: '約翰伯格的方舟', rarity: 'UR', icon: '⛵', desc: '指數投資終極載具' },
    { id: 'g5', name: '索羅斯的煉金石', rarity: 'SSR', icon: '🔮', desc: '反身性理論' },
    { id: 'g6', name: '存錢小豬', rarity: 'N', icon: '🐷', desc: '積少成多' },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        <div className={`md:col-span-4 bg-slate-900/80 p-6 rounded-2xl border ${currentClass.border} shadow-[0_0_20px_rgba(0,0,0,0.3)] relative overflow-hidden backdrop-blur-sm group transition-all duration-500`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">{currentClass.icon}</div>
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><Crown className="w-3 h-3 text-yellow-500" /> 玩家等級</div>
            <div className={`text-3xl font-black ${levelInfo.color} mb-1`}>{levelInfo.title}</div>
            <div className="w-full bg-slate-800 rounded-full h-2 mb-4 border border-slate-700"><div className={`h-full ${levelInfo.bar} rounded-full transition-all duration-1000`} style={{width: `${Math.min(100, fireRatio)}%`}}></div></div>
            <div className="grid grid-cols-2 gap-4 mt-4">
                <div><div className="text-slate-500 text-[10px] uppercase">戰鬥力 (CP)</div><div className="text-2xl font-mono text-white font-bold">{formatMoney(combatPower)}</div></div>
                <div><div className="text-slate-500 text-[10px] uppercase">HP (維持率)</div><div className={`text-2xl font-mono font-bold ${currentMaintenance < 130 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>{currentMaintenance === 999 ? 'MAX' : currentMaintenance.toFixed(0) + '%'}</div></div>
            </div>
        </div>
        <div className="md:col-span-5 bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden backdrop-blur-sm flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2"><div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><Skull className="w-3 h-3 text-red-500" /> BOSS: 負債魔王</div><div className="text-[10px] text-red-400 font-mono">剩餘血量: {formatMoney(Math.max(0, totalDebt - totalMarketValue))}</div></div>
            <div className="relative h-8 w-full bg-slate-950 rounded-lg overflow-hidden border border-red-900/30 shadow-inner">
                <div className="absolute top-0 left-0 h-full bg-gradient-to-b from-red-600 to-red-900 transition-all duration-1000" style={{width: '100%'}}></div>
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500/80 to-blue-500/80 transition-all duration-1000 flex items-center justify-end px-3 border-r-2 border-white/50" style={{width: `${Math.min(100, (totalMarketValue / (totalDebt || 1)) * 100)}%`}}><span className="text-xs font-bold text-white drop-shadow-md">-{((totalMarketValue / (totalDebt || 1)) * 100).toFixed(0)}% 爆擊</span></div>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono"><span>ATK: {formatMoney(totalMarketValue)} (資產)</span><span>HP: {formatMoney(totalDebt)} (負債)</span></div>
        </div>
        <div className="md:col-span-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden backdrop-blur-sm flex flex-col">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Aperture className="w-3 h-3 text-blue-400" /> 收藏庫</div>
            {collection.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                    {collection.slice(0, 8).map((item: any, i: number) => {
                        const gachaItem = GACHA_ITEMS_LOCAL.find(g => g.id === item.id);
                        return <div key={i} className="aspect-square bg-slate-950 rounded border border-slate-700 flex items-center justify-center text-xl cursor-help" title={`${gachaItem?.name} x${item.count}`}>{gachaItem?.icon}</div>;
                    })}
                </div>
            ) : <div className="flex-1 flex items-center justify-center text-slate-600 text-xs italic">尚無寶物</div>}
        </div>
      </div>
      <div className="mt-8 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-500" /> 成就殿堂 (Hall of Fame)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {achievements.map(ach => (
                  <div key={ach.id} className={`relative p-3 rounded-xl border flex items-center gap-3 transition-all duration-500 group ${ach.unlocked ? `bg-slate-950/80 ${ach.color} shadow-lg` : 'bg-slate-950/30 border-slate-800 opacity-60 grayscale'}`}>
                      <div className={`p-2 rounded-full shadow-lg ${ach.unlocked ? 'bg-slate-900 text-white shadow-current/20' : 'bg-slate-800 text-slate-600'}`}>{ach.unlocked ? ach.icon : <Lock className="w-5 h-5" />}</div>
                      <div className="flex-1 min-w-0"><div className={`text-xs font-bold truncate ${ach.unlocked ? 'text-white' : 'text-slate-500'}`}>{ach.name}</div><div className="text-[10px] text-slate-400 truncate">{ach.desc}</div></div>
                      {ach.unlocked && <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />}
                  </div>
              ))}
          </div>
      </div>
    </>
  );
};

// --- 8. 主程式 (App) - 總指揮官 ---
const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [showLoot, setShowLoot] = useState(false);
  const [showRebalance, setShowRebalance] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [showGacha, setShowGacha] = useState(false);
  const [lootQuote, setLootQuote] = useState('');
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [gachaAnimating, setGachaAnimating] = useState(false);
  const [gachaResult, setGachaResult] = useState<any>(null);
  const [reinvest, setReinvest] = useState(true);
  
  const [collection, setCollection] = useState<{id: string, count: number}[]>([]);
  const [tokens, setTokens] = useState(0);

  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({ apiKey: '', projectId: 'baozutang-finance', syncId: 'tony1006', enabled: true, priceSourceUrl: '' });
  const [etfs, setEtfs] = useState<ETF[]>(INITIAL_ETFS);
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [stockLoan, setStockLoan] = useState<StockLoan>(INITIAL_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(INITIAL_GLOBAL_MARGIN_LOAN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(INITIAL_CREDIT_LOAN);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(INITIAL_TAX_STATUS);
  const [allocation, setAllocation] = useState<AllocationConfig>(INITIAL_ALLOCATION);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化
  useEffect(() => {
    const initData = async () => {
      try {
        const savedConfig = StorageService.loadCloudConfig();
        if (savedConfig) setCloudConfig(prev => ({ ...prev, ...savedConfig }));
        const result = await StorageService.loadData();
        if (result.data) {
          const { etfs, loans, stockLoan, globalMarginLoan, creditLoan, taxStatus, allocation, collection: c, tokens: t } = result.data as any;
          setEtfs(Array.isArray(etfs) ? etfs.map((e: any) => ({ ...e, category: e.category || 'dividend', code: e.code || e.id })) : INITIAL_ETFS);
          setLoans(Array.isArray(loans) ? loans : INITIAL_LOANS);
          setStockLoan(stockLoan || INITIAL_STOCK_LOAN); 
          setGlobalMarginLoan(globalMarginLoan || INITIAL_GLOBAL_MARGIN_LOAN);
          setCreditLoan(creditLoan || INITIAL_CREDIT_LOAN); 
          setTaxStatus(taxStatus ? { ...INITIAL_TAX_STATUS, ...taxStatus } : INITIAL_TAX_STATUS);
          setAllocation(allocation || INITIAL_ALLOCATION);
          setCollection(Array.isArray(c) ? c : []); 
          setTokens(typeof t === 'number' ? t : 0);
        }
      } catch (error) { console.error("Init failed", error); } finally { setIsInitializing(false); }
    };
    initData();
  }, []);

  // 自動存檔
  useEffect(() => {
    if (isInitializing) return;
    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try { 
          const stateToSave: AppState = { etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, collection, tokens };
          await StorageService.saveData(stateToSave); 
          StorageService.saveCloudConfig(cloudConfig);
          setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); 
      } catch { setSaveStatus('error'); }
    }, 1000); return () => clearTimeout(timer);
  }, [etfs, loans, stockLoan, creditLoan, taxStatus, globalMarginLoan, allocation, collection, tokens, isInitializing, cloudConfig]);

  // 計算核心
  const totalMarketValue = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * etf.currentPrice), 0), [etfs]);
  const totalCost = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * (etf.costPrice || 0)), 0), [etfs]);
  const unrealizedPL = totalMarketValue - totalCost;
  const totalStockDebt = stockLoan.principal + globalMarginLoan.principal + etfs.reduce((acc, e) => acc + (e.marginLoanAmount || 0), 0);
  const totalRealDebt = loans.reduce((acc, l) => acc + l.principal, 0) + creditLoan.principal;
  const currentMaintenance = useMemo(() => totalStockDebt === 0 ? 999 : (totalMarketValue / totalStockDebt) * 100, [totalMarketValue, totalStockDebt]);

  const actualDividend = useMemo(() => etfs.filter(e => e.category === 'dividend').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualHedging = useMemo(() => etfs.filter(e => e.category === 'hedging').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualActive = useMemo(() => etfs.filter(e => e.category === 'active').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);

  const { monthlyFlows, yearlyNetPosition, healthInsuranceTotal, incomeTaxTotal } = useMemo(() => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);
  
  const fireMetrics = useMemo(() => { 
      const exp = monthlyFlows.reduce((a,c)=>a+c.loanOutflow+c.creditLoanOutflow+c.livingExpenses,0); 
      const inc = monthlyFlows.reduce((a,c)=>a+c.dividendInflow,0); 
      return { ratio: exp>0?(inc/exp)*100:0, annualPassive: inc, annualExpenses: exp }; 
  }, [monthlyFlows]);

  const combatPower = useMemo(() => Math.floor((totalMarketValue/10000) + (fireMetrics.annualPassive/12/100)), [totalMarketValue, fireMetrics]);
  const levelInfo = useMemo(() => { const r = fireMetrics.ratio; if(r>=100) return {title:'財富國王 👑', color:'text-yellow-400', bar:'bg-gradient-to-r from-yellow-400 to-orange-500', next:null}; if(r>=50) return {title:'資產領主 ⚔️', color:'text-purple-400', bar:'bg-gradient-to-r from-purple-500 to-pink-500', next:100}; if(r>=20) return {title:'理財騎士 🛡️', color:'text-blue-400', bar:'bg-gradient-to-r from-blue-400 to-cyan-400', next:50}; return {title:'初心冒險者 🪵', color:'text-slate-400', bar:'bg-slate-600', next:20}; }, [fireMetrics]);
  
  const currentClass = useMemo(() => {
      const total = totalMarketValue || 1;
      if (totalStockDebt > total * 0.4) return THEMES.berserker;
      if (actualHedging > total * 0.3) return THEMES.merchant;
      if (actualActive > total * 0.3) return THEMES.assassin;
      if (actualDividend > total * 0.6) return THEMES.paladin;
      return THEMES.default;
  }, [totalMarketValue, totalStockDebt, actualHedging, actualActive, actualDividend]);

  const skills = useMemo(() => { 
      return [
        { name: '股息水流斬', level: Math.floor(Math.min(100, (fireMetrics.annualPassive/500000)*100)), icon: <RefreshCw className="w-4 h-4"/>, color:'text-emerald-400', bar:'bg-emerald-500' },
        { name: '絕對防禦', level: Math.floor(Math.min(100, (actualHedging/(totalMarketValue||1))*500)), icon: <ShieldCheck className="w-4 h-4"/>, color:'text-amber-400', bar:'bg-amber-500' },
        { name: '槓桿爆發', level: Math.floor(Math.min(100, (totalStockDebt/5000000)*100)), icon: <Zap className="w-4 h-4"/>, color:'text-blue-400', bar:'bg-blue-500' },
        { name: '資本增幅', level: Math.floor(Math.min(100, (unrealizedPL/1000000)*100)), icon: <TrendingUp className="w-4 h-4"/>, color:'text-purple-400', bar:'bg-purple-500' }
      ];
  }, [fireMetrics, etfs, totalMarketValue, totalStockDebt, unrealizedPL, actualHedging]);

  const pieData = [{ name: '配息型', value: actualDividend, color: COLORS.dividend }, { name: '避險型', value: actualHedging, color: COLORS.hedging }, { name: '主動型', value: actualActive, color: COLORS.active }].filter(d => d.value > 0);
  const remainingFunds = allocation.totalFunds - (actualDividend + actualHedging + actualActive);
  const monthlyChartData = useMemo(() => monthlyFlows.map(f => ({ month: `${f.month}月`, income: f.dividendInflow, expense: f.loanOutflow + f.creditLoanOutflow + f.stockLoanInterest + f.livingExpenses + f.taxWithheld, net: f.netFlow })), [monthlyFlows]);
  const snowballData = useMemo(() => { const avgYield = totalMarketValue > 0 ? fireMetrics.annualPassive / totalMarketValue : 0.05; const annualSavings = safeVal(yearlyNetPosition); const data = []; let currentWealth = totalMarketValue; let currentIncome = fireMetrics.annualPassive; for (let year = 0; year <= 10; year++) { data.push({ year: `Y${year}`, wealth: Math.floor(currentWealth), income: Math.floor(currentIncome) }); currentWealth = currentWealth * 1.05 + (reinvest ? currentIncome : 0) + annualSavings; currentIncome = currentWealth * avgYield; } return data; }, [monthlyFlows, totalMarketValue, yearlyNetPosition, reinvest, fireMetrics]);

  // 操作
  const handleUpdatePrices = async () => {
      if (!cloudConfig.priceSourceUrl) { alert('請先設定 Google Sheet 連結！'); setShowSettings(true); return; }
      setIsUpdatingPrices(true);
      try {
          const res = await fetch(cloudConfig.priceSourceUrl);
          const text = await res.text();
          const rows = text.split('\n').map(r => r.split(','));
          const map = new Map<string, number>();
          rows.forEach(r => { if(r.length>=2) { const code=r[0].replace(/['"\r]/g,'').trim(); const p=parseFloat(r[1].replace(/['"\r]/g,'').trim()); if(code&&!isNaN(p)) map.set(code, p); }});
          let count = 0;
          setEtfs(etfs.map(e => { const targetCode = e.code || e.id; const newPrice = map.get(targetCode); if(newPrice!==undefined) { count++; return {...e, currentPrice: newPrice}; } return e; }));
          alert(`更新 ${count} 個標的！`);
      } catch { alert('更新失敗'); } finally { setIsUpdatingPrices(false); }
  };
  const handleSmartMerge = () => { const items = INITIAL_ETFS.filter(e => !new Set(etfs.map(e => e.id)).has(e.id)); if (items.length && confirm(`補入 ${items.length} 個預設？`)) setEtfs([...etfs, ...items]); };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=(ev)=>{ try{ const s=JSON.parse(ev.target?.result as string) as AppState; if(s.etfs){ setEtfs(s.etfs); setLoans(s.loans||[]); setStockLoan(s.stockLoan||INITIAL_STOCK_LOAN); setGlobalMarginLoan(s.globalMarginLoan||INITIAL_GLOBAL_MARGIN_LOAN); setCreditLoan(s.creditLoan||INITIAL_CREDIT_LOAN); setTaxStatus(s.taxStatus||INITIAL_TAX_STATUS); setAllocation(s.allocation||INITIAL_ALLOCATION); alert('成功'); } }catch{alert('錯誤');}}; r.readAsText(f); e.target.value=''; };
  const handleExport = () => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation });
  const openLootBox = () => { setLootQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]); setShowLoot(true); };
  const updateLoan = (i: number, f: keyof Loan, v: any) => { const n = [...loans]; if (f === 'startDate' && v) { const s = new Date(v), now = new Date(); let m = (now.getFullYear() - s.getFullYear()) * 12 - s.getMonth() + now.getMonth(); n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, m) }; } else { n[i] = { ...n[i], [f]: v }; } setLoans(n); };
  const handleGacha = () => { 
      const GACHA_ITEMS_LOCAL = [
        { id: 'g1', name: '巴菲特的眼鏡', rarity: 'SR', icon: '👓', desc: '看透市場本質' },
        { id: 'g2', name: '蒙格的格柵', rarity: 'SSR', icon: '🏗️', desc: '多元思維模型' },
        { id: 'g3', name: '科斯托蘭尼之狗', rarity: 'R', icon: '🐕', desc: '主人與狗的牽絆' },
        { id: 'g4', name: '約翰伯格的方舟', rarity: 'UR', icon: '⛵', desc: '指數投資終極載具' },
        { id: 'g5', name: '索羅斯的煉金石', rarity: 'SSR', icon: '🔮', desc: '反身性理論' },
        { id: 'g6', name: '存錢小豬', rarity: 'N', icon: '🐷', desc: '積少成多' },
      ];
      if (tokens < 1) { alert('代幣不足！'); return; } 
      setTokens(prev => prev - 1); setGachaAnimating(true); setGachaResult(null); 
      setTimeout(() => { const item = GACHA_ITEMS_LOCAL[Math.floor(Math.random() * GACHA_ITEMS_LOCAL.length)]; setGachaResult(item); setGachaAnimating(false); setCollection(prev => { const existing = prev.find(i => i.id === item.id); if (existing) return prev.map(i => i.id === item.id ? { ...i, count: i.count + 1 } : i); return [...prev, { id: item.id, count: 1 }]; }); }, 2000); 
  };
  
  const rebalanceData = useMemo(() => {
      const total = allocation.totalFunds;
      const tDiv = total * (allocation.dividendRatio/100);
      const tHed = total * (allocation.hedgingRatio/100);
      const tAct = total * (allocation.activeRatio/100);
      return [
          { name: '配息型', actual: actualDividend, target: tDiv, diff: actualDividend - tDiv, color: 'text-emerald-400' },
          { name: '避險型', actual: actualHedging, target: tHed, diff: actualHedging - tHed, color: 'text-amber-400' },
          { name: '主動型', actual: actualActive, target: tAct, diff: actualActive - tAct, color: 'text-purple-400' },
      ];
  }, [allocation, actualDividend, actualHedging, actualActive]);

  useEffect(() => { const calculatedTokens = Math.floor(unrealizedPL / 10000); if (calculatedTokens > tokens) setTokens(calculatedTokens > 0 ? calculatedTokens : 0); }, [unrealizedPL]);

  if (isInitializing) return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /><p className="ml-4 text-slate-400 font-mono">系統啟動中...</p></div>;

  return (
    <div className={`min-h-screen p-4 md:p-8 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 bg-gradient-to-br ${currentClass.bg} to-slate-950 transition-colors duration-1000`}>
      {showSettings && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg p-6"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5"/> 系統設定</h3><div className="space-y-4"><div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-xs flex gap-2"><Cloud className="w-4 h-4 text-emerald-400 shrink-0"/> <div><p className="text-emerald-300 font-bold">雲端同步 Online</p><p className="text-slate-400">數據已安全加密</p></div></div><div><label className="block text-xs text-slate-400 mb-1">行情資料來源 (Google Sheet CSV)</label><input type="text" placeholder="https://docs.google.com/..." value={cloudConfig.priceSourceUrl || ''} onChange={(e) => setCloudConfig({...cloudConfig, priceSourceUrl: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none transition-colors" /></div></div><button onClick={() => setShowSettings(false)} className="w-full py-2 mt-4 bg-slate-800 hover:bg-slate-700 rounded text-white text-sm transition-colors">確認</button></div></div>)}
      
      {showRebalance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in" onClick={() => setShowRebalance(false)}>
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white flex items-center gap-2"><Scale className="w-5 h-5 text-blue-400"/> 賈維斯戰術助理</h3><button onClick={() => setShowRebalance(false)}><X className="w-5 h-5 text-slate-500 hover:text-white"/></button></div>
                  <div className="space-y-4">{rebalanceData.map((item, idx) => (<div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800"><div className="flex justify-between text-sm mb-1"><span className={`font-bold ${item.color}`}>{item.name}</span><span className="text-slate-400">目標: {formatMoney(item.target)}</span></div><div className="flex justify-between items-center"><span className="text-xs text-slate-500">現有: {formatMoney(item.actual)}</span><span className={`text-sm font-bold ${item.diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{item.diff > 0 ? `溢出 ${formatMoney(item.diff)}` : `補入 ${formatMoney(Math.abs(item.diff))}`}</span></div></div>))}</div>
              </div>
          </div>
      )}

      {showShareCard && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in" onClick={() => setShowShareCard(false)}>
              <div className={`relative w-[350px] bg-slate-950 rounded-3xl border-2 ${currentClass.border} shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden`} onClick={e => e.stopPropagation()}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${currentClass.bg} to-slate-950 opacity-50`}></div>
                  <div className="relative p-6 text-center">
                      <div className="inline-block p-3 rounded-full bg-slate-900 border border-slate-700 shadow-xl mb-4">{currentClass.icon}</div>
                      <h2 className={`text-3xl font-black ${currentClass.text} mb-1 uppercase tracking-widest`}>{currentClass.name}</h2>
                      <p className="text-slate-400 text-xs font-mono mb-6">包租唐資產戰情室 • LEVEL {Math.floor(combatPower/1000)}</p>
                      <div className="grid grid-cols-2 gap-4 mb-6"><div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800"><div className="text-[10px] text-slate-500">戰鬥力 (CP)</div><div className="text-xl font-mono text-white font-bold">{formatMoney(combatPower)}</div></div><div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800"><div className="text-[10px] text-slate-500">自由度 (FIRE)</div><div className="text-xl font-mono text-white font-bold">{fireMetrics.ratio.toFixed(1)}%</div></div></div>
                      <div className="text-[10px] text-slate-600 font-mono">系統生成於 {new Date().toLocaleDateString()}</div>
                  </div>
              </div>
          </div>
      )}

      {showLoot && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in" onClick={() => setShowLoot(false)}><div className="bg-gradient-to-br from-yellow-900/90 to-slate-900 border-2 border-yellow-500/50 rounded-2xl p-8 max-w-md text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] transform animate-in zoom-in-95 duration-300"><Gift className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-bounce" /><h3 className="text-2xl font-bold text-yellow-100 mb-2">每日寶箱開啟！</h3><p className="text-lg text-yellow-300 font-serif italic">"{lootQuote}"</p><p className="text-xs text-slate-400 mt-6">(點擊任意處關閉)</p></div></div>)}

      {showGacha && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in" onClick={() => setShowGacha(false)}>
              <div className="bg-slate-900 border border-yellow-500/30 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="absolute top-0 right-0 bg-yellow-500/20 text-yellow-400 px-3 py-1 text-xs rounded-bl-xl font-bold">代幣: {tokens}</div>
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center justify-center gap-2"><Gift className="w-5 h-5 text-yellow-400"/> 財富轉蛋機</h3>
                  {gachaAnimating ? (<div className="h-32 flex items-center justify-center"><Loader2 className="w-16 h-16 text-yellow-500 animate-spin"/></div>) : gachaResult ? (<div className="animate-in zoom-in duration-500"><div className="text-6xl mb-4">{gachaResult.icon}</div><div className="text-yellow-400 font-bold text-lg mb-1">{gachaResult.name}</div><div className="inline-block px-2 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400 mb-4">{gachaResult.rarity}</div><button onClick={() => setGachaResult(null)} className="mt-6 w-full py-2 bg-slate-800 hover:bg-slate-700 rounded text-white text-sm">再抽一次</button></div>) : (<div><div className="text-6xl mb-6 animate-bounce">🎁</div><button onClick={handleGacha} disabled={tokens < 1} className={`w-full py-3 rounded text-white font-bold flex items-center justify-center gap-2 ${tokens < 1 ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-600 to-orange-600'}`}>{tokens < 1 ? '代幣不足' : '立即召喚 (-1代幣)'}</button></div>)}
              </div>
          </div>
      )}

      <header className="mb-8 border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${currentClass.bg.replace('bg-', 'from-').replace('900', '400')} to-white flex items-center gap-2 filter drop-shadow-lg tracking-tight`}>{currentClass.icon} 包租唐戰情室 <span className="text-xs bg-white/10 text-white px-2 py-0.5 rounded border border-white/20">PRO</span></h1><p className={`text-sm mt-1 flex items-center gap-2 font-mono ${currentClass.text}`}>職業：{currentClass.name} • 狀態：{currentMaintenance >= 130 ? '安全' : '危險'}</p></div>
        <div className="flex flex-wrap gap-2"><input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" /><button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg text-sm text-slate-300 transition-all"><Settings className="w-4 h-4" /></button><button onClick={() => setShowShareCard(true)} className="flex items-center gap-2 px-3 py-2 bg-pink-900/30 hover:bg-pink-800/50 border border-pink-500/30 rounded-lg text-sm text-pink-300 transition-all"><Share2 className="w-4 h-4" /> 戰報</button><button onClick={() => setShowRebalance(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 hover:bg-blue-800/50 border border-blue-500/30 rounded-lg text-sm text-blue-300 transition-all"><Scale className="w-4 h-4" /> 戰術平衡</button><button onClick={() => setShowGacha(true)} className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 hover:from-yellow-800/50 border border-yellow-500/30 rounded-lg text-sm text-yellow-200 transition-all group"><Gift className="w-4 h-4 group-hover:scale-110 transition-transform" /> 轉蛋機</button><button onClick={handleUpdatePrices} disabled={isUpdatingPrices} className="flex items-center gap-2 px-3 py-2 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-500/30 rounded-lg text-sm text-emerald-300 transition-all group">{isUpdatingPrices ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />} 更新行情</button><button onClick={handleSmartMerge} className="flex items-center gap-2 px-3 py-2 bg-purple-900/30 hover:bg-purple-800/50 border border-purple-500/30 rounded-lg text-sm text-purple-300 transition-all"><Zap className="w-4 h-4" /> 補全裝備</button><button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg text-sm text-slate-300 transition-all"><Download className="w-4 h-4" /> 存檔</button></div>
      </header>

      <GameHUD combatPower={combatPower} levelInfo={levelInfo} fireRatio={fireMetrics.ratio} currentMaintenance={currentMaintenance} totalMarketValue={totalMarketValue} totalDebt={totalStockDebt+totalRealDebt} skills={skills} annualPassiveIncome={fireMetrics.annualPassive} hasHedging={actualHedging>0} hasLeverage={totalStockDebt>0} netWorthPositive={totalMarketValue>(totalStockDebt+totalRealDebt)} collection={collection} currentClass={currentClass} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
          
          {/* 積木 2: 資產清單 (左側) */}
          <AssetList etfs={etfs} setEtfs={setEtfs} />
          
          {/* 積木 3: 財務控制 (左側) */}
          <FinanceControl 
            loans={loans} 
            stockLoan={stockLoan} 
            globalMarginLoan={globalMarginLoan} 
            creditLoan={creditLoan} 
            taxStatus={taxStatus} 
            updateLoan={updateLoan} 
            setStockLoan={setStockLoan} 
            setGlobalMarginLoan={setGlobalMarginLoan} 
            setCreditLoan={setCreditLoan} 
            setTaxStatus={setTaxStatus} 
          />
        </div>

        {/* 右側: 圓餅圖與統計 */}
        <div className="xl:col-span-8 space-y-6">
          <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden"><h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><PieIcon className="w-5 h-5 text-blue-400" /> 資源配置</h2><div className="mb-4"><label className="text-xs text-slate-400 block mb-1">總資金 (Total Cap)</label><div className="relative"><DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" /><input type="number" value={allocation.totalFunds} onChange={(e) => setAllocation({...allocation, totalFunds: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xl font-bold text-white focus:border-blue-500 outline-none" placeholder="0"/></div><div className={`text-[10px] mt-1 text-right ${remainingFunds >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{remainingFunds >= 0 ? `尚未配置資金: ${formatMoney(remainingFunds)}` : `⚠️ 超出預算: ${formatMoney(Math.abs(remainingFunds))}`}</div></div><div className="grid grid-cols-1 gap-4"><div className="h-40 flex justify-center items-center bg-slate-950/50 rounded-xl"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}</Pie><Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}/></PieChart></ResponsiveContainer></div><div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800"><div><div className="flex justify-between text-xs mb-1"><span className="text-emerald-400 font-bold">配息型</span><div className="flex items-center gap-1"><input type="number" value={allocation.dividendRatio} onChange={e => setAllocation({...allocation, dividendRatio: Number(e.target.value)})} className="w-8 bg-transparent text-right outline-none text-emerald-400 border-b border-emerald-900" /><span className="text-slate-500">%</span></div></div><div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-emerald-900/50" style={{width: `${allocation.dividendRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-emerald-500" style={{width: `${Math.min(100, (actualDividend/allocation.totalFunds)*100)}%`}}></div></div></div><div><div className="flex justify-between text-xs mb-1"><span className="text-amber-400 font-bold">避險型</span><div className="flex items-center gap-1"><input type="number" value={allocation.hedgingRatio} onChange={e => setAllocation({...allocation, hedgingRatio: Number(e.target.value)})} className="w-8 bg-transparent text-right outline-none text-amber-400 border-b border-amber-900" /><span className="text-slate-500">%</span></div></div><div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-amber-900/50" style={{width: `${allocation.hedgingRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-amber-500" style={{width: `${Math.min(100, (actualHedging/allocation.totalFunds)*100)}%`}}></div></div></div><div><div className="flex justify-between text-xs mb-1"><span className="text-purple-400 font-bold">主動型</span><div className="flex items-center gap-1"><input type="number" value={allocation.activeRatio} onChange={e => setAllocation({...allocation, activeRatio: Number(e.target.value)})} className="w-8 bg-transparent text-right outline-none text-purple-400 border-b border-purple-900" /><span className="text-slate-500">%</span></div></div><div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-purple-900/50" style={{width: `${allocation.activeRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-purple-500" style={{width: `${Math.min(100, (actualActive/allocation.totalFunds)*100)}%`}}></div></div></div></div></div></section>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute right-0 top-0 p-3 opacity-10"><DollarSign className="w-12 h-12"/></div><div className="text-slate-500 text-xs uppercase tracking-wider">年度淨現金流</div><div className={`text-2xl font-black ${safeVal(yearlyNetPosition) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatMoney(safeVal(yearlyNetPosition))}</div></div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute right-0 top-0 p-3 opacity-10"><Banknote className="w-12 h-12"/></div><div className="text-slate-500 text-xs uppercase tracking-wider">總資產市值</div><div className="text-2xl font-black text-blue-400">{formatMoney(totalMarketValue)}</div><div className={`text-[10px] ${unrealizedPL>=0?'text-emerald-500':'text-red-500'}`}>損益 {formatMoney(unrealizedPL)}</div></div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute right-0 top-0 p-3 opacity-10"><Flame className="w-12 h-12"/></div><div className="text-slate-500 text-xs uppercase tracking-wider">FIRE 自由度</div><div className="text-2xl font-black text-orange-400">{fireMetrics.ratio.toFixed(1)}%</div><div className="text-[10px] text-slate-500">被動收入 {formatMoney(fireMetrics.annualPassive)}</div></div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute right-0 top-0 p-3 opacity-10"><Wallet className="w-12 h-12"/></div><div className="text-slate-500 text-xs uppercase tracking-wider">預估稅負</div><div className="text-2xl font-black text-purple-400">{formatMoney(safeVal(healthInsuranceTotal) + safeVal(incomeTaxTotal))}</div></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg"><h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-400"/> 十年財富滾雪球</h3><div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={snowballData}><defs><linearGradient id="cw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="year" stroke="#475569" tick={{fontSize:10}} /><YAxis stroke="#475569" tick={{fontSize:10}} /><Tooltip formatter={(v:number)=>formatMoney(v)} contentStyle={{backgroundColor:'#0f172a', border:'none'}}/ ><Area type="monotone" dataKey="wealth" stroke="#3b82f6" fill="url(#cw)" /></AreaChart></ResponsiveContainer></div></div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg"><h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-purple-400"/> 月度收支表</h3><div className="h-48"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={monthlyChartData}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="month" stroke="#475569" tick={{fontSize:10}} /><YAxis stroke="#475569" tick={{fontSize:10}} /><Tooltip formatter={(v:number)=>formatMoney(v)} contentStyle={{backgroundColor:'#0f172a', border:'none'}} /><Bar dataKey="income" fill="#10b981" /><Bar dataKey="expense" fill="#ef4444" /><Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div></div>
          </div>
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg overflow-x-auto"><h3 className="text-sm font-bold text-slate-300 mb-4">📜 現金流明細卷軸</h3><table className="w-full text-xs text-left text-slate-400"><thead className="text-[10px] uppercase bg-slate-950 text-slate-500"><tr><th className="p-2">月</th><th className="p-2 text-right">股息</th><th className="p-2 text-right">房貸</th><th className="p-2 text-right">信貸</th><th className="p-2 text-right">股貸</th><th className="p-2 text-right">生活</th><th className="p-2 text-right">稅負</th><th className="p-2 text-right">淨流</th></tr></thead><tbody>{monthlyFlows.map(r=><tr key={r.month} className="border-b border-slate-800 hover:bg-slate-800/50"><td className="p-2">{r.month}</td><td className="p-2 text-right text-emerald-400">{formatMoney(r.dividendInflow)}</td><td className="p-2 text-right text-red-400">{formatMoney(r.loanOutflow)}</td><td className="p-2 text-right text-orange-400">{formatMoney(r.creditLoanOutflow)}</td><td className="p-2 text-right text-blue-400">{formatMoney(r.stockLoanInterest)}</td><td className="p-2 text-right text-slate-400">{formatMoney(r.livingExpenses)}</td><td className="p-2 text-right text-purple-400">{formatMoney(r.taxWithheld)}</td><td className={`p-2 text-right font-bold ${r.netFlow<0?'text-red-500':'text-emerald-500'}`}>{formatMoney(r.netFlow)}</td></tr>)}</tbody></table></div>
        </div>
      </div>
    </div>
  );
};

export default App;
