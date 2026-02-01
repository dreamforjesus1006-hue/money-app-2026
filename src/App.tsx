import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Calculator, DollarSign, Wallet, Activity, Save, Upload, Download, Settings, Cloud, Loader2, Zap, TrendingUp, RefreshCw, Gift, PieChart as PieIcon, Banknote, Flame, Share2, Scale, ShieldCheck, Swords, Coins, Skull, Gem, Sparkles, Lock, Aperture, List, Trash2, X, Tag, ShoppingCart, Coffee, Layers, Crown, Trophy, Calendar } from 'lucide-react';

// ==========================================
// 1. 核心定義 (V26 完整版)
// ==========================================

const BROKERAGE_RATE = 0.001425;
const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#8b5cf6', cash: '#334155' };

// 介面定義
interface Lot { id: string; date: string; shares: number; price: number; fee?: number; margin?: number; }
interface ETF { id: string; code?: string; name: string; shares: number; costPrice: number; currentPrice: number; dividendPerShare: number; dividendType?: 'annual' | 'per_period'; payMonths?: number[]; category: 'dividend' | 'hedging' | 'active'; marginLoanAmount?: number; marginInterestRate?: number; lots?: Lot[]; }
interface Loan { id: string; name: string; principal: number; rate1: number; rate1Months: number; rate2: number; totalMonths: number; paidMonths: number; gracePeriod: number; startDate?: string; type: string; }
interface StockLoan { principal: number; rate: number; maintenanceLimit?: number; }
interface CreditLoan { principal: number; rate: number; totalMonths: number; paidMonths: number; }
interface TaxStatus { salaryIncome: number; livingExpenses: number; dependents: number; hasSpouse: boolean; isDisabled: boolean; }
interface AllocationConfig { totalFunds: number; dividendRatio: number; hedgingRatio: number; activeRatio: number; }
interface CloudConfig { apiKey: string; projectId: string; syncId: string; enabled: boolean; priceSourceUrl?: string; }
interface AppState { etfs: ETF[]; loans: Loan[]; stockLoan: StockLoan; globalMarginLoan: StockLoan; creditLoan: CreditLoan; taxStatus: TaxStatus; allocation: AllocationConfig; collection?: {id:string, count:number}[]; tokens?: number; }

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
};

const GACHA_ITEMS = [
    { id: 'g1', name: '巴菲特的眼鏡', rarity: 'SR', icon: '👓', desc: '看透市場本質' },
    { id: 'g2', name: '蒙格的格柵', rarity: 'SSR', icon: '🏗️', desc: '多元思維模型' },
    { id: 'g3', name: '科斯托蘭尼之狗', rarity: 'R', icon: '🐕', desc: '主人與狗的牽絆' },
    { id: 'g4', name: '約翰伯格的方舟', rarity: 'UR', icon: '⛵', desc: '指數投資終極載具' },
    { id: 'g5', name: '索羅斯的煉金石', rarity: 'SSR', icon: '🔮', desc: '反身性理論' },
    { id: 'g6', name: '存錢小豬', rarity: 'N', icon: '🐷', desc: '積少成多' },
];

// 工具函數
const formatMoney = (val: any) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '$0';
  return `$${Math.floor(Number(val)).toLocaleString()}`;
};
const safeVal = (v: any): number => Number(v) || 0;

// 計算邏輯
const calculateLoanPayment = (loan: Loan) => {
    if (loan.paidMonths < loan.gracePeriod) return Math.floor(loan.principal * (loan.rate1 / 100 / 12));
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
        (etfs || []).forEach(etf => { if (etf.payMonths?.includes(m)) dividendInflow += (etf.shares * etf.dividendPerShare); });
        let loanOutflow = 0;
        (loans || []).forEach(l => loanOutflow += calculateLoanPayment(l));
        const creditRate = creditLoan.rate / 100 / 12;
        const creditOutflow = creditLoan.principal > 0 ? Math.floor((creditLoan.principal * creditRate * Math.pow(1 + creditRate, creditLoan.totalMonths)) / (Math.pow(1 + creditRate, creditLoan.totalMonths) - 1)) : 0;
        const stockInterest = Math.floor((stockLoan.principal * (stockLoan.rate/100)/12) + (globalMarginLoan.principal * (globalMarginLoan.rate/100)/12));
        const marginInterest = (etfs || []).reduce((acc, e) => acc + ((e.marginLoanAmount||0) * ((e.marginInterestRate||6.5)/100)/12), 0);
        const taxWithheld = Math.floor(dividendInflow * 0.0211);
        totalDividendYear += dividendInflow;
        monthlyFlows.push({ month: m, dividendInflow, loanOutflow, creditLoanOutflow: creditOutflow, stockLoanInterest: stockInterest + marginInterest, livingExpenses: taxStatus.livingExpenses, taxWithheld, netFlow: dividendInflow - loanOutflow - creditOutflow - (stockInterest + marginInterest) - taxStatus.livingExpenses - taxWithheld });
    }
    const yearlyNetPosition = monthlyFlows.reduce((acc, cur) => acc + cur.netFlow, 0);
    return { monthlyFlows, yearlyNetPosition, healthInsuranceTotal: totalDividendYear * 0.0211, incomeTaxTotal: 0 }; 
};

// 儲存服務
const STORAGE_KEY = 'baozutang_data_v26_complete'; 
const StorageService = {
    saveData: async (data: any) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; } },
    loadData: async () => { try { const local = localStorage.getItem(STORAGE_KEY); return { data: local ? JSON.parse(local) : null }; } catch (e) { return { data: null }; } },
    exportToFile: (data: any) => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `baozutang_backup.json`; a.click(); }
};

// --- 子元件 ---

const FinanceControl = ({ loans, stockLoan, globalMarginLoan, creditLoan, taxStatus, updateLoan, setStockLoan, setGlobalMarginLoan, setCreditLoan, setTaxStatus }: any) => {
  return (
    <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><DollarSign className="w-4 h-4" /> 房貸與信貸</h2>
        {(loans || []).map((loan: any, idx: number) => (
          <div key={loan.id || idx} className="mb-4 p-3 bg-slate-950 rounded border border-slate-800">
            <div className="flex justify-between mb-2 items-center"><input type="text" value={loan.name} onChange={(e) => updateLoan(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-600 w-1/2 text-sm" /><select value={loan.type} onChange={(e) => updateLoan(idx, 'type', e.target.value)} className="bg-slate-900 text-[10px] border border-slate-700 rounded px-1 text-slate-400"><option value="PrincipalAndInterest">本息攤還</option><option value="Principal">本金攤還</option></select></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-slate-500 block">貸款總額</label><input type="number" value={loan.principal} onChange={(e) => updateLoan(idx, 'principal', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" /></div><div><label className="text-[10px] text-emerald-500 block">核貸日期</label><input type="date" value={loan.startDate || ''} onChange={(e) => updateLoan(idx, 'startDate', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" /></div></div>
          </div>
        ))}
        <div className="p-2 bg-slate-950 rounded border border-slate-800 border-l-2 border-l-orange-500">
          <div className="flex justify-between mb-1"><span className="text-xs font-bold text-orange-300">信用貸款</span><input type="number" value={creditLoan.rate} onChange={(e) => setCreditLoan({ ...creditLoan, rate: Number(e.target.value) })} className="bg-slate-900 border border-slate-700 rounded px-1 text-xs text-right w-16 text-orange-300" placeholder="利率%" /></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="text-[9px] text-slate-500">本金</label><input type="number" value={creditLoan.principal} onChange={(e) => setCreditLoan({ ...creditLoan, principal: Number(e.target.value) })} className="bg-slate-900 border border-slate-700 rounded px-1 text-xs w-full" /></div><div><label className="text-[9px] text-slate-500">總期數</label><input type="number" value={creditLoan.totalMonths} onChange={(e) => setCreditLoan({ ...creditLoan, totalMonths: Number(e.target.value) })} className="bg-slate-900 border border-slate-700 rounded px-1 text-xs w-full" /></div></div>
        </div>
      </div>
      <div className="pt-2 border-t border-slate-800">
        <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Layers className="w-4 h-4" /> 質押與融資</h2>
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div className="p-2 bg-slate-950 rounded border border-slate-800"><label className="text-slate-500 block mb-1">質押 (本金 / 利率%)</label><div className="flex gap-1"><input type="number" value={stockLoan.principal} onChange={(e) => setStockLoan({ ...stockLoan, principal: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded px-1" /><input type="number" value={stockLoan.rate} onChange={(e) => setStockLoan({ ...stockLoan, rate: Number(e.target.value) })} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-blue-300" /></div></div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800"><label className="text-slate-500 block mb-1">融資 (本金 / 利率%)</label><div className="flex gap-1"><input type="number" value={globalMarginLoan.principal} onChange={(e) => setGlobalMarginLoan({ ...globalMarginLoan, principal: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded px-1" /><input type="number" value={globalMarginLoan.rate} onChange={(e) => setGlobalMarginLoan({ ...globalMarginLoan, rate: Number(e.target.value) })} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-cyan-300" /></div></div>
        </div>
        <div className="flex items-center gap-2"><label className="text-xs text-red-400">⚠️ 維持率斷頭線 (%):</label><input type="number" value={stockLoan.maintenanceLimit || 130} onChange={(e) => setStockLoan({ ...stockLoan, maintenanceLimit: Number(e.target.value) })} className="w-16 bg-slate-950 border border-red-900/50 rounded px-1 text-xs text-red-300" /></div>
      </div>
      <div className="pt-2 border-t border-slate-800">
        <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Coffee className="w-4 h-4" /> 生活與稅務</h2>
        <div className="grid grid-cols-2 gap-2 text-xs mb-2"><div><label className="text-slate-500">薪資所得</label><input type="number" value={taxStatus.salaryIncome} onChange={(e) => setTaxStatus({ ...taxStatus, salaryIncome: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded px-1" /></div><div><label className="text-slate-500">月生活費</label><input type="number" value={taxStatus.livingExpenses} onChange={(e) => setTaxStatus({ ...taxStatus, livingExpenses: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded px-1" /></div></div>
      </div>
    </section>
  );
};

const AssetList = ({ etfs, setEtfs }: any) => {
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState<{shares: string, price: string, date: string, margin: string}>({ shares: '', price: '', date: '', margin: '' });

  const updateEtf = (i: number, field: keyof ETF, val: any) => { const n = [...etfs]; n[i] = { ...n[i], [field]: val }; setEtfs(n); };
  const addEtf = () => { setEtfs([...etfs, { id: Date.now().toString(), code: '', name: '新標的', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'annual', payMonths: [], marginLoanAmount: 0, marginInterestRate: 0, lots: [], category: 'dividend' }]); };
  const removeEtf = (id: string) => { if (window.confirm('確定刪除？')) setEtfs(etfs.filter((e: any) => e.id !== id)); };
  const toggleBuy = (id: string) => { setActiveBuyId(activeBuyId === id ? null : id); };

  const submitBuy = (i: number) => {
    const s = Number(buyForm.shares), p = Number(buyForm.price), m = Number(buyForm.margin); if (!s || !p) return;
    const n = [...etfs]; const l = n[i].lots ? [...n[i].lots!] : [];
    l.push({ id: Date.now().toString(), date: buyForm.date, shares: s, price: p, fee: 0, margin: m });
    const totalShares = l.reduce((a: number, b: any) => a + b.shares, 0);
    const totalCost = l.reduce((a: number, b: any) => a + b.shares * b.price, 0);
    const totalMargin = l.reduce((a: number, b: any) => a + (b.margin || 0), 0);
    n[i] = { ...n[i], lots: l, shares: totalShares, costPrice: Number((totalShares ? totalCost / totalShares : 0).toFixed(2)), marginLoanAmount: totalMargin };
    setEtfs(n); setBuyForm({ ...buyForm, shares: '', price: '', margin: '' }); setActiveBuyId(null);
  };

  return (
    <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg">
      <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-400" /> 裝備清單</h2>
      <div className="space-y-3">
        {(etfs || []).map((etf: any, idx: number) => {
          const isBuying = activeBuyId === etf.id;
          return (
            <div key={etf.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <input type="text" value={etf.name} onChange={(e) => updateEtf(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white w-full text-sm" />
                <div className="flex gap-1">
                    <button onClick={() => toggleBuy(etf.id)} className={`p-1.5 rounded-lg border ${isBuying ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}><ShoppingCart className="w-3 h-3" /></button>
                    <button onClick={() => removeEtf(etf.id)} className="p-1.5 rounded-lg text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              {isBuying && (<div className="mb-2 p-2 bg-emerald-900/20 border border-emerald-500/20 rounded-lg"><div className="grid grid-cols-4 gap-1 mb-2"><div className="col-span-1"><input type="date" value={buyForm.date} onChange={e => setBuyForm({...buyForm, date: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div><div><input type="number" placeholder="股" value={buyForm.shares} onChange={e => setBuyForm({...buyForm, shares: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div><div><input type="number" placeholder="$" value={buyForm.price} onChange={e => setBuyForm({...buyForm, price: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div><div><input type="number" placeholder="融" value={buyForm.margin} onChange={e => setBuyForm({...buyForm, margin: e.target.value})} className="w-full bg-slate-900 border border-blue-900 rounded px-1 py-0.5 text-xs text-white" /></div></div><button onClick={() => submitBuy(idx)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1 rounded text-xs font-bold">確認交易</button></div>)}
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={etf.shares} onChange={(e) => updateEtf(idx, 'shares', Number(e.target.value))} className="bg-slate-900 border border-slate-700 text-xs text-white" placeholder="股數"/>
                <input type="number" value={etf.costPrice} onChange={(e) => updateEtf(idx, 'costPrice', Number(e.target.value))} className="bg-slate-900 border border-slate-700 text-xs text-white" placeholder="成本"/>
                <input type="number" value={etf.currentPrice} onChange={(e) => updateEtf(idx, 'currentPrice', Number(e.target.value))} className="bg-slate-900 border border-slate-700 text-xs text-white" placeholder="現價"/>
              </div>
            </div>
          );
        })}
        <button onClick={addEtf} className="w-full py-2 bg-slate-900 border border-dashed border-slate-700 rounded-xl text-slate-500 text-xs hover:text-white">+ 新增標的</button>
      </div>
    </section>
  );
};

const GameHUD = ({ combatPower, levelInfo, fireRatio, currentMaintenance, totalMarketValue, totalDebt, collection, currentClass, onGacha, tokens }: any) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        <div className={`md:col-span-4 bg-slate-900/80 p-6 rounded-2xl border ${currentClass.border} relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.3)]`}>
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><Crown className="w-3 h-3 text-yellow-500" /> 玩家等級</div>
            <div className={`text-3xl font-black ${levelInfo.color} mb-1`}>{levelInfo.title}</div>
            <div className="w-full bg-slate-800 rounded-full h-2 mb-4 border border-slate-700"><div className={`h-full bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full`} style={{width: `${Math.min(100, fireRatio)}%`}}></div></div>
            <div className="grid grid-cols-2 gap-4 mt-4">
                <div><div className="text-slate-500 text-[10px] uppercase">戰鬥力 (CP)</div><div className="text-2xl font-mono text-white font-bold">{formatMoney(combatPower)}</div></div>
                <div><div className="text-slate-500 text-[10px] uppercase">HP (維持率)</div><div className={`text-2xl font-mono font-bold ${currentMaintenance < 130 ? 'text-red-500' : 'text-emerald-400'}`}>{currentMaintenance === 999 ? 'MAX' : currentMaintenance.toFixed(0) + '%'}</div></div>
            </div>
        </div>
        <div className="md:col-span-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Gift className="w-3 h-3 text-yellow-400" /> 轉蛋機 (代幣: {tokens})</div>
            <div className="grid grid-cols-4 gap-2 mb-4">
                {collection.slice(0, 8).map((item: any, i: number) => (
                    <div key={i} className="aspect-square bg-slate-950 rounded border border-slate-700 flex items-center justify-center text-xl cursor-help" title={`x${item.count}`}>{GACHA_ITEMS.find(g => g.id === item.id)?.icon}</div>
                ))}
            </div>
            <button onClick={onGacha} disabled={tokens < 1} className={`w-full py-2 rounded text-xs font-bold ${tokens > 0 ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{tokens > 0 ? '立即召喚' : '代幣不足'}</button>
        </div>
    </div>
  );
};

// --- App 主程式 ---
const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [collection, setCollection] = useState<{id: string, count: number}[]>([]);
  const [tokens, setTokens] = useState(0);
  const [showGachaAnim, setShowGachaAnim] = useState(false);
  const [gachaResult, setGachaResult] = useState<any>(null);

  const [etfs, setEtfs] = useState<ETF[]>(INITIAL_ETFS);
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [stockLoan, setStockLoan] = useState<StockLoan>(INITIAL_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(INITIAL_GLOBAL_MARGIN_LOAN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(INITIAL_CREDIT_LOAN);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(INITIAL_TAX_STATUS);
  const [allocation, setAllocation] = useState<AllocationConfig>(INITIAL_ALLOCATION);

  useEffect(() => {
    const initData = async () => {
      try {
        const result = await StorageService.loadData();
        if (result.data) {
          const { etfs, loans, stockLoan, globalMarginLoan, creditLoan, taxStatus, allocation, collection: c, tokens: t } = result.data as any;
          setEtfs(Array.isArray(etfs) ? etfs : INITIAL_ETFS);
          setLoans(Array.isArray(loans) ? loans : INITIAL_LOANS);
          setStockLoan(stockLoan || INITIAL_STOCK_LOAN); 
          setGlobalMarginLoan(globalMarginLoan || INITIAL_GLOBAL_MARGIN_LOAN);
          setCreditLoan(creditLoan || INITIAL_CREDIT_LOAN); 
          setTaxStatus(taxStatus ? { ...INITIAL_TAX_STATUS, ...taxStatus } : INITIAL_TAX_STATUS);
          setAllocation(allocation || INITIAL_ALLOCATION);
          setCollection(Array.isArray(c) ? c : []); 
          setTokens(typeof t === 'number' ? t : 5);
        }
      } catch (error) { console.error("Init failed", error); } finally { setIsInitializing(false); }
    };
    initData();
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    const timer = setTimeout(async () => {
      try { 
          const stateToSave: AppState = { etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, collection, tokens };
          await StorageService.saveData(stateToSave); 
      } catch {}
    }, 1000); return () => clearTimeout(timer);
  }, [etfs, loans, stockLoan, creditLoan, taxStatus, globalMarginLoan, allocation, collection, tokens, isInitializing]);

  const totalMarketValue = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * etf.currentPrice), 0), [etfs]);
  const totalStockDebt = stockLoan.principal + globalMarginLoan.principal + etfs.reduce((acc, e) => acc + (e.marginLoanAmount || 0), 0);
  const totalRealDebt = loans.reduce((acc, l) => acc + l.principal, 0) + creditLoan.principal;
  const currentMaintenance = useMemo(() => totalStockDebt === 0 ? 999 : (totalMarketValue / totalStockDebt) * 100, [totalMarketValue, totalStockDebt]);
  const unrealizedPL = totalMarketValue - etfs.reduce((acc, e) => acc + (e.shares * e.costPrice), 0);

  const { monthlyFlows, yearlyNetPosition, healthInsuranceTotal, incomeTaxTotal } = useMemo(() => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);
  const fireMetrics = useMemo(() => { const exp = monthlyFlows.reduce((a,c)=>a+c.loanOutflow+c.creditLoanOutflow+c.livingExpenses,0); const inc = monthlyFlows.reduce((a,c)=>a+c.dividendInflow,0); return { ratio: exp>0?(inc/exp)*100:0, annualPassive: inc, annualExpenses: exp }; }, [monthlyFlows]);
  const combatPower = useMemo(() => Math.floor((totalMarketValue/10000) + (fireMetrics.annualPassive/12/100)), [totalMarketValue, fireMetrics]);
  const levelInfo = useMemo(() => { const r = fireMetrics.ratio; if(r>=100) return {title:'財富國王 👑', color:'text-yellow-400'}; if(r>=50) return {title:'資產領主 ⚔️', color:'text-purple-400'}; if(r>=20) return {title:'理財騎士 🛡️', color:'text-blue-400'}; return {title:'初心冒險者 🪵', color:'text-slate-400'}; }, [fireMetrics]);
  const currentClass = THEMES.default;

  const updateLoan = (i: number, f: keyof Loan, v: any) => { const n = [...loans]; n[i] = { ...n[i], [f]: v }; setLoans(n); };
  
  const handleGacha = () => {
      if (tokens < 1) return;
      setTokens(t => t - 1);
      setShowGachaAnim(true);
      setTimeout(() => {
          const item = GACHA_ITEMS[Math.floor(Math.random() * GACHA_ITEMS.length)];
          setGachaResult(item);
          setCollection(prev => { const ex = prev.find(p => p.id === item.id); return ex ? prev.map(p => p.id === item.id ? {...p, count: p.count + 1} : p) : [...prev, {id: item.id, count: 1}]; });
          setShowGachaAnim(false);
      }, 1500);
  };

  const snowballData = useMemo(() => { 
      const avgYield = totalMarketValue > 0 ? fireMetrics.annualPassive / totalMarketValue : 0.05; 
      const annualSavings = Number(yearlyNetPosition) || 0; 
      const data = []; 
      let currentWealth = totalMarketValue; 
      let currentIncome = fireMetrics.annualPassive; 
      for (let year = 0; year <= 10; year++) { 
          data.push({ year: `Y${year}`, wealth: Math.floor(currentWealth), income: Math.floor(currentIncome) }); 
          currentWealth = currentWealth * 1.05 + currentIncome + annualSavings; 
          currentIncome = currentWealth * avgYield; 
      } 
      return data; 
  }, [monthlyFlows, totalMarketValue, yearlyNetPosition, fireMetrics]);

  if (isInitializing) return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /><p className="ml-4 text-slate-400 font-mono">系統啟動中...</p></div>;

  return (
    <div className={`min-h-screen p-4 md:p-8 font-sans bg-slate-950 text-white selection:bg-emerald-500/30`}>
      {gachaResult && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setGachaResult(null)}><div className="bg-slate-900 border border-yellow-500 p-8 rounded-2xl text-center animate-in zoom-in"><div className="text-6xl mb-4">{gachaResult.icon}</div><div className="text-2xl font-bold text-yellow-400">{gachaResult.name}</div><p className="text-slate-400 mt-2">點擊關閉</p></div></div>)}
      {showGachaAnim && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"><Loader2 className="w-16 h-16 text-yellow-500 animate-spin"/></div>)}

      <header className="mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-white"><Zap className="text-emerald-400"/> 包租唐戰情室 <span className="text-xs bg-emerald-900/50 text-emerald-200 px-2 py-0.5 rounded border border-emerald-500/30">V26 Ultimate</span></h1>
      </header>

      <GameHUD combatPower={combatPower} levelInfo={levelInfo} fireRatio={fireMetrics.ratio} currentMaintenance={currentMaintenance} totalMarketValue={totalMarketValue} totalDebt={totalStockDebt+totalRealDebt} collection={collection} currentClass={currentClass} onGacha={handleGacha} tokens={tokens} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
          <AssetList etfs={etfs} setEtfs={setEtfs} />
          <FinanceControl loans={loans} stockLoan={stockLoan} globalMarginLoan={globalMarginLoan} creditLoan={creditLoan} taxStatus={taxStatus} updateLoan={updateLoan} setStockLoan={setStockLoan} setGlobalMarginLoan={setGlobalMarginLoan} setCreditLoan={setCreditLoan} setTaxStatus={setTaxStatus} />
        </div>
        <div className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800"><div className="text-slate-500 text-xs uppercase">年度淨現金流</div><div className={`text-2xl font-black ${yearlyNetPosition < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatMoney(yearlyNetPosition)}</div></div>
             <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800"><div className="text-slate-500 text-xs uppercase">總資產市值</div><div className="text-2xl font-black text-blue-400">{formatMoney(totalMarketValue)}</div></div>
             <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800"><div className="text-slate-500 text-xs uppercase">未實現損益</div><div className={`text-2xl font-black ${unrealizedPL >= 0 ? 'text-red-400' : 'text-green-400'}`}>{formatMoney(unrealizedPL)}</div></div>
             <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800"><div className="text-slate-500 text-xs uppercase">預估稅負</div><div className="text-2xl font-black text-purple-400">{formatMoney(healthInsuranceTotal+incomeTaxTotal)}</div></div>
          </div>
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 h-64">
             <div className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> 資產雪球推演</div>
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snowballData}><defs><linearGradient id="cw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="year" stroke="#475569" tick={{fontSize:10}} /><YAxis stroke="#475569" tick={{fontSize:10}} /><Tooltip formatter={(v:number)=>formatMoney(v)} contentStyle={{backgroundColor:'#0f172a', border:'none'}}/ ><Area type="monotone" dataKey="wealth" stroke="#10b981" fill="url(#cw)" /></AreaChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
