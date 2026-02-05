import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Calculator, DollarSign, Wallet, Activity, Save, Upload, Download, RotateCcw, Settings, Globe, Cloud, Loader2, Target, Zap, TrendingUp, RefreshCw, Gift, PieChart as PieIcon, Banknote, Flame, Share2, Scale, ShieldCheck, Swords, Coins, Skull, Gem, Scroll, Sparkles, Lock, Aperture, List, Trash2, X, Tag, ShoppingCart, Coffee, Layers, Crown, Trophy, Calendar, Lightbulb, CheckCircle2, HelpCircle, Edit3, ArrowRightLeft, Plus, ArrowUp, ArrowDown, Wifi, WifiOff } from 'lucide-react';

// --- Firebase SDK ---
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// ==========================================
// 1. Firebase 設定
// ==========================================
const YOUR_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCM42AelwEWTC4R_V0sgF0FbomkoXdE4T0",
  authDomain: "baozutang-finance.firebaseapp.com",
  projectId: "baozutang-finance",
  storageBucket: "baozutang-finance.firebasestorage.app",
  messagingSenderId: "674257527078",
  appId: "1:674257527078:web:80018b440a826c2ef061e7"
};

const COLLECTION_NAME = "portfolios";
const DOCUMENT_ID = "tony1006";

// ==========================================
// 2. 定義介面
// ==========================================
interface Lot { id: string; date: string; shares: number; price: number; fee?: number; margin?: number; }
interface ETF { id: string; code?: string; name: string; shares: number; costPrice: number; currentPrice: number; dividendPerShare: number; dividendType?: 'annual' | 'per_period'; payMonths?: number[]; category: 'dividend' | 'hedging' | 'active'; marginLoanAmount?: number; marginInterestRate?: number; lots?: Lot[]; }
interface Loan { id: string; name: string; principal: number; rate1: number; rate1Months: number; rate2: number; totalMonths: number; paidMonths: number; gracePeriod: number; startDate?: string; type: string; }
interface StockLoan { principal: number; rate: number; maintenanceLimit?: number; }
interface CreditLoan { principal: number; rate: number; totalMonths: number; paidMonths: number; }
interface TaxStatus { salaryIncome: number; livingExpenses: number; dependents: number; hasSpouse: boolean; isDisabled: boolean; }
interface AllocationConfig { totalFunds: number; dividendRatio: number; hedgingRatio: number; activeRatio: number; }
interface CloudConfig { priceSourceUrl: string; enabled: boolean; }

const BROKERAGE_RATE = 0.001425;
const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#a855f7', cash: '#334155' };

// ==========================================
// 3. 計算工具
// ==========================================
const formatMoney = (val: any) => `$${Math.floor(Number(val) || 0).toLocaleString()}`;

const calculateLoanPayment = (loan: Loan) => {
    const p = Number(loan.principal); const paid = Number(loan.paidMonths); const grace = Number(loan.gracePeriod);
    if (paid < grace) return Math.floor(p * (Number(loan.rate1) / 100 / 12));
    const rate = (paid < Number(loan.rate1Months) ? Number(loan.rate1) : Number(loan.rate2)) / 100 / 12;
    const n = Number(loan.totalMonths) - paid; if (n <= 0) return 0;
    return Math.floor((p * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1));
};

const recalculateEtfStats = (etf: ETF): ETF => {
    const lots = etf.lots || [];
    const totalShares = lots.reduce((acc, lot) => acc + Number(lot.shares), 0);
    const totalCost = lots.reduce((acc, lot) => acc + (Number(lot.shares) * Number(lot.price)) + (Number(lot.fee) || 0), 0);
    const totalMargin = lots.reduce((acc, lot) => acc + (Number(lot.margin) || 0), 0);
    return { ...etf, shares: totalShares, costPrice: totalShares > 0 ? Number((totalCost / totalShares).toFixed(2)) : 0, marginLoanAmount: totalMargin };
};

const generateCashFlow = (etfs: ETF[], loans: Loan[], stockLoan: StockLoan, creditLoan: CreditLoan, globalMarginLoan: StockLoan, taxStatus: TaxStatus) => {
    const flows = [];
    for (let m = 1; m <= 12; m++) {
        let divIn = 0;
        etfs.forEach(e => {
            if (e.payMonths?.includes(m)) {
                let payout = Number(e.dividendPerShare);
                if (e.dividendType === 'annual' && e.payMonths.length > 0) payout /= e.payMonths.length;
                divIn += Number(e.shares) * payout;
            }
        });
        let loanOut = 0; loans.forEach(l => loanOut += calculateLoanPayment(l));
        const cRate = Number(creditLoan.rate) / 100 / 12;
        const creditOut = Number(creditLoan.principal) > 0 ? Math.floor((Number(creditLoan.principal) * cRate * Math.pow(1 + cRate, Number(creditLoan.totalMonths))) / (Math.pow(1 + cRate, Number(creditLoan.totalMonths)) - 1)) : 0;
        const stockInt = Math.floor((Number(stockLoan.principal) * (Number(stockLoan.rate)/100)/12) + (Number(globalMarginLoan.principal) * (Number(globalMarginLoan.rate)/100)/12));
        const marginInt = etfs.reduce((acc, e) => acc + (Number(e.marginLoanAmount||0) * (Number(e.marginInterestRate||6.5)/100)/12), 0);
        const tax = Math.floor(divIn * 0.0211);
        flows.push({ month: m, divIn, loanOut, creditOut, stockInt: stockInt + marginInt, life: Number(taxStatus.livingExpenses), tax, net: divIn - loanOut - creditOut - (stockInt + marginInt) - Number(taxStatus.livingExpenses) - tax });
    }
    return flows;
};

// --- Firebase Init ---
let db: any = null;
try { const firebaseApp = initializeApp(YOUR_FIREBASE_CONFIG); db = getFirestore(firebaseApp); } catch(e) { console.error(e); }

const StorageService = {
    saveData: async (data: any) => {
        localStorage.setItem('baozutang_local', JSON.stringify(data));
        if (db) await setDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID), data);
        return true;
    },
    loadData: async () => {
        if (db) {
            const snap = await getDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID));
            if (snap.exists()) return { data: snap.data(), source: 'cloud' };
        }
        const local = localStorage.getItem('baozutang_local');
        return local ? { data: JSON.parse(local), source: 'local' } : { data: null, source: 'none' };
    }
};

// ==========================================
// 4. App 主程式
// ==========================================
const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dataSrc, setDataSrc] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // Data States
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stockLoan, setStockLoan] = useState<StockLoan>({rate:2.56, principal:0});
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>({rate:4.5, principal:0});
  const [creditLoan, setCreditLoan] = useState<CreditLoan>({rate:4.05, totalMonths:84, principal:0, paidMonths:0});
  const [taxStatus, setTaxStatus] = useState<TaxStatus>({salaryIncome:0, livingExpenses:0, hasSpouse:true, isDisabled:true, dependents:0});
  const [allocation, setAllocation] = useState<AllocationConfig>({activeRatio:5, hedgingRatio:15, dividendRatio:80, totalFunds:14500000});
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({ priceSourceUrl: '', enabled: true });

  // UI States
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState({ shares: '', price: '', date: '', margin: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    StorageService.loadData().then(res => {
      setDataSrc(res.source);
      if (res.data) {
        const d = res.data;
        if(d.etfs) setEtfs(d.etfs); if(d.loans) setLoans(d.loans); if(d.stockLoan) setStockLoan(d.stockLoan);
        if(d.globalMarginLoan) setGlobalMarginLoan(d.globalMarginLoan); if(d.creditLoan) setCreditLoan(d.creditLoan);
        if(d.taxStatus) setTaxStatus(d.taxStatus); if(d.allocation) setAllocation(d.allocation);
        if(d.cloudConfig) setCloudConfig(d.cloudConfig);
      }
      setIsInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      const state = { etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig };
      await StorageService.saveData(state);
      setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1500);
    return () => clearTimeout(t);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, isInitializing]);

  const monthlyFlows = useMemo(() => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);
  const totalDividend = monthlyFlows.reduce((a, b) => a + b.divIn, 0);
  const totalMortgage = monthlyFlows.reduce((a, b) => a + b.loanOut, 0);
  const totalCredit = monthlyFlows.reduce((a, b) => a + b.creditOut, 0);
  const totalStockInterest = monthlyFlows.reduce((a, b) => a + b.stockInt, 0);
  const totalLiving = monthlyFlows.reduce((a, b) => a + (b.life), 0);
  const totalNet = monthlyFlows.reduce((a, b) => a + b.net, 0);

  const totalMarketValue = etfs.reduce((a, e) => a + (Number(e.shares) * Number(e.currentPrice)), 0);
  const totalDebt = Number(stockLoan.principal) + Number(globalMarginLoan.principal) + etfs.reduce((a, e) => a + (Number(e.marginLoanAmount) || 0), 0);
  const currentMaintenance = totalDebt === 0 ? 999 : (totalMarketValue / totalDebt) * 100;
  
  const actualDiv = etfs.filter(e => e.category === 'dividend').reduce((a, e) => a + (Number(e.shares) * Number(e.currentPrice)) - (Number(e.marginLoanAmount) || 0), 0);
  const actualHedge = etfs.filter(e => e.category === 'hedging').reduce((a, e) => a + (Number(e.shares) * Number(e.currentPrice)) - (Number(e.marginLoanAmount) || 0), 0);
  const actualAct = etfs.filter(e => e.category === 'active').reduce((a, e) => a + (Number(e.shares) * Number(e.currentPrice)) - (Number(e.marginLoanAmount) || 0), 0);

  // Handlers
  const moveEtf = (i: number, d: number) => { const n = [...etfs]; if(i+d < 0 || i+d >= n.length) return; [n[i], n[i+d]] = [n[i+d], n[i]]; setEtfs(n); };
  const removeEtf = (id: string) => { if (confirm('確定刪除？')) setEtfs(etfs.filter(e => e.id !== id)); };
  const updateLoan = (i: number, f: string, v: any) => { const n = [...loans]; (n[i] as any)[f] = v; setLoans(n); };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-900 text-white font-sans">
      <header className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2"><Calculator/> 包租唐戰情室</h1>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 flex items-center gap-1">
              {saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin text-amber-400"/> : dataSrc === 'cloud' ? <Wifi size={12} className="text-blue-400"/> : <WifiOff size={12} className="text-slate-500"/>}
              {dataSrc === 'cloud' ? "雲端連線" : "本機模式"}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 bg-slate-800 rounded border border-slate-700"><Settings size={18}/></button>
            <input type="file" ref={fileInputRef} onChange={(e) => {
                const f = e.target.files?.[0]; if(!f) return;
                const r = new FileReader(); r.onload = (ev) => {
                    try { const d = JSON.parse(ev.target?.result as string); if(d.etfs) { setEtfs(d.etfs); if(d.loans) setLoans(d.loans); setTaxStatus(d.taxStatus); setAllocation(d.allocation); alert('匯入成功'); } } catch(e) { alert('格式錯誤'); }
                }; r.readAsText(f);
            }} className="hidden" accept=".json"/>
            <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-slate-800 rounded border border-slate-700 text-blue-400"><Upload size={18}/></button>
            <button onClick={() => {
                const state = { etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig };
                const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `baozutang_backup.json`; a.click();
            }} className="p-2 bg-slate-800 rounded border border-slate-700 text-amber-400"><Download size={18}/></button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <h2 className="text-lg font-bold mb-4 text-blue-300 flex items-center gap-2"><PieIcon/> 資金分配 (淨值)</h2>
            <div className="space-y-4">
                <div><div className="flex justify-between text-xs mb-1"><span>配息型 ({allocation.dividendRatio}%)</span><span>缺 {formatMoney(Math.max(0, (allocation.totalFunds * allocation.dividendRatio / 100) - actualDiv))}</span></div><div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full" style={{width: `${Math.min(100, (actualDiv / (allocation.totalFunds * allocation.dividendRatio / 100 || 1)) * 100)}%`}}></div></div></div>
                <div><div className="flex justify-between text-xs mb-1"><span>避險型 ({allocation.hedgingRatio}%)</span><span>缺 {formatMoney(Math.max(0, (allocation.totalFunds * allocation.hedgingRatio / 100) - actualHedge))}</span></div><div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-amber-500 h-full" style={{width: `${Math.min(100, (actualHedge / (allocation.totalFunds * allocation.hedgingRatio / 100 || 1)) * 100)}%`}}></div></div></div>
                <div><div className="flex justify-between text-xs mb-1"><span>主動型 ({allocation.activeRatio}%)</span><span>缺 {formatMoney(Math.max(0, (allocation.totalFunds * allocation.activeRatio / 100) - actualAct))}</span></div><div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-purple-500 h-full" style={{width: `${Math.min(100, (actualAct / (allocation.totalFunds * allocation.activeRatio / 100 || 1)) * 100)}%`}}></div></div></div>
            </div>
          </section>

          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-emerald-300 flex items-center gap-2"><Activity/> 標的清單</h2>
            <div className="space-y-4">
              {etfs.map((e, idx) => (
                <div key={e.id} className="p-4 bg-slate-900 rounded-xl border border-slate-700 relative group">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => moveEtf(idx, -1)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><ArrowUp size={14}/></button><button onClick={() => moveEtf(idx, 1)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><ArrowDown size={14}/></button><button onClick={() => removeEtf(e.id)} className="p-1 hover:bg-slate-700 rounded text-red-400"><Trash2 size={14}/></button></div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="relative"><input type="text" value={e.code || ''} onChange={v => { const n=[...etfs]; n[idx].code=v.target.value; setEtfs(n); }} className="absolute -top-5 left-0 text-[10px] text-slate-500 bg-slate-800 px-1 rounded w-16" placeholder="代號"/><input type="text" value={e.name} onChange={v => { const n=[...etfs]; n[idx].name=v.target.value; setEtfs(n); }} className="bg-transparent font-bold text-white outline-none w-full"/></div>
                    <div className="flex gap-1"><button onClick={() => setActiveBuyId(activeBuyId === e.id ? null : e.id)} className="p-1 rounded bg-slate-800"><ShoppingCart size={14}/></button><button onClick={() => setExpandedEtfId(expandedEtfId === e.id ? null : e.id)} className="p-1 rounded bg-slate-800"><List size={14}/></button></div>
                  </div>
                  {activeBuyId === e.id && (<div className="mb-3 p-3 bg-emerald-900/20 rounded-lg"><div className="grid grid-cols-2 gap-2 mb-2"><input type="number" placeholder="股數" value={buyForm.shares} onChange={v => setBuyForm({...buyForm, shares: v.target.value})} className="bg-slate-900 p-1 rounded text-xs"/><input type="number" placeholder="單價" value={buyForm.price} onChange={v => setBuyForm({...buyForm, price: v.target.value})} className="bg-slate-900 p-1 rounded text-xs"/><input type="number" placeholder="融資額" value={buyForm.margin} onChange={v => setBuyForm({...buyForm, margin: v.target.value})} className="bg-slate-900 p-1 rounded text-xs"/><input type="date" value={buyForm.date} onChange={v => setBuyForm({...buyForm, date: v.target.value})} className="bg-slate-900 p-1 rounded text-xs"/></div><button onClick={() => { const s = Number(buyForm.shares), p = Number(buyForm.price), m = Number(buyForm.margin); if (!s || !p) return; const nEtfs = [...etfs]; const current = nEtfs[idx]; const newLot = { id: Date.now().toString(), date: buyForm.date, shares: s, price: p, fee: Math.floor(s*p*BROKERAGE_RATE), margin: m }; const updatedLots = current.lots ? [...current.lots, newLot] : [newLot]; nEtfs[idx] = recalculateEtfStats({ ...current, lots: updatedLots }); setEtfs(nEtfs); setBuyForm({ shares: '', price: '', date: '', margin: '' }); setActiveBuyId(null); }} className="w-full bg-emerald-600 text-xs py-1 rounded font-bold">確認交易</button></div>)}
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div><label className="text-slate-500">股數</label><div className="pt-1 font-mono">{e.shares.toLocaleString()}</div></div>
                    <div><label className="text-slate-500">現價</label><input type="number" value={e.currentPrice} onChange={v => { const n=[...etfs]; n[idx].currentPrice=Number(v.target.value); setEtfs(n); }} className="w-full bg-slate-800 rounded p-1 border border-slate-700 mt-1"/></div>
                    <div><label className="text-slate-500">配息</label><div className="flex gap-1 items-center"><input type="number" value={e.dividendPerShare} onChange={v => { const n=[...etfs]; n[idx].dividendPerShare=Number(v.target.value); setEtfs(n); }} className="w-full bg-slate-800 rounded p-1 border border-slate-700 mt-1"/><select value={e.dividendType} onChange={v => { const n=[...etfs]; n[idx].dividendType=v.target.value as any; setEtfs(n); }} className="bg-slate-800 text-[10px] text-blue-400 outline-none"><option value="per_period">次</option><option value="annual">年</option></select></div></div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">{[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (<button key={m} onClick={() => { const n=[...etfs]; const ms = e.payMonths?.includes(m) ? e.payMonths.filter(x=>x!==m) : [...(e.payMonths||[]), m].sort((a,b)=>a-b); n[idx].payMonths=ms; setEtfs(n); }} className={`w-5 h-5 rounded text-[10px] flex items-center justify-center transition-all ${e.payMonths?.includes(m) ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>{m}</button>))}</div>
                  {expandedEtfId === e.id && e.lots && (<div className="mt-3 space-y-1">{e.lots.map(l => (<div key={l.id} className="flex justify-between text-[10px] bg-slate-800 p-1.5 rounded border border-slate-700"><span>{l.date} | {l.shares}股</span><span>{formatMoney(l.price)} (融:{formatMoney(l.margin||0)}) <button onClick={() => { const n = [...etfs]; n[idx].lots = e.lots?.filter(x => x.id !== l.id); n[idx] = recalculateEtfStats(n[idx]); setEtfs(n); }} className="text-red-500 ml-1">×</button></span></div>))}</div>)}
                </div>
              ))}
              <button onClick={() => setEtfs([...etfs, { id: Date.now().toString(), name: '新標的', code: '', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'annual', payMonths: [1,4,7,10], category: 'dividend', marginLoanAmount: 0 }])} className="w-full py-2 border border-dashed border-slate-600 rounded-xl text-slate-500 hover:text-white transition-all">+ 新增標的</button>
            </div>
          </section>
        </div>

        <div className="xl:col-span-8 space-y-6">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-lg"><div className="text-slate-400 text-xs uppercase">年度淨流</div><div className={`text-2xl font-bold ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-blue-500 shadow-lg"><div className="text-slate-400 text-xs uppercase">總資產市值</div><div className="text-2xl font-bold">{formatMoney(totalMarketValue)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-red-500 shadow-lg"><div className="text-slate-400 text-xs uppercase">總負債</div><div className="text-2xl font-bold">{formatMoney(totalDebt)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-orange-500 shadow-lg"><div className="text-slate-400 text-xs uppercase">維持率</div><div className="text-2xl font-bold">{currentMaintenance === 999 ? "MAX" : currentMaintenance.toFixed(1) + "%"}</div></div>
           </div>

           <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl overflow-x-auto">
             <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white"><Calendar className="text-blue-400"/> 每月現金流明細</h3>
             <table className="w-full text-sm text-left">
               <thead className="text-slate-500 bg-slate-900/50"><tr><th className="p-3">月份</th><th className="p-3">股息</th><th className="p-3">房貸</th><th className="p-3">信貸</th><th className="p-3">利息</th><th className="p-3 text-right">淨流</th></tr></thead>
               <tbody>{monthlyFlows.map(r => (<tr key={r.month} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                     <td className="p-3 font-bold">{r.month}月</td>
                     <td className="p-3 text-emerald-400 font-mono">{formatMoney(r.divIn)}</td>
                     <td className="p-3 text-red-400 font-mono">{formatMoney(r.loanOut)}</td>
                     <td className="p-3 text-orange-400 font-mono">{formatMoney(r.creditOut)}</td>
                     <td className="p-3 text-blue-300 font-mono">{formatMoney(r.stockInt)}</td>
                     <td className={`p-3 text-right font-bold ${r.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(r.net)}</td>
                   </tr>))}</tbody>
               <tfoot><tr className="bg-slate-900 font-black text-white">
                   <td className="p-3">年度總計</td><td className="p-3 text-emerald-400 font-mono">{formatMoney(totalDividend)}</td><td className="p-3 text-red-400 font-mono">{formatMoney(totalMortgage)}</td><td className="p-3 text-orange-400 font-mono">{formatMoney(totalCredit)}</td><td className="p-3 text-blue-300 font-mono">{formatMoney(totalStockInterest)}</td><td className={`p-3 text-right font-mono ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</td>
               </tr></tfoot>
             </table>
           </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><Settings/> 財務設定</h3>
            <div className="space-y-6 text-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><label className="text-slate-400">投資預算</label><input type="number" value={allocation.totalFunds} onChange={e => setAllocation({...allocation, totalFunds: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded border border-slate-600"/></div>
                    <div><label className="text-slate-400">配息%</label><input type="number" value={allocation.dividendRatio} onChange={e => setAllocation({...allocation, dividendRatio: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded border border-slate-600"/></div>
                    <div><label className="text-slate-400">避險%</label><input type="number" value={allocation.hedgingRatio} onChange={e => setAllocation({...allocation, hedgingRatio: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded border border-slate-600"/></div>
                    <div><label className="text-slate-400">主動%</label><input type="number" value={allocation.activeRatio} onChange={e => setAllocation({...allocation, activeRatio: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded border border-slate-600"/></div>
                </div>
                
                <div className="pt-4 border-t border-slate-700"><h4 className="text-emerald-400 font-bold mb-2">房貸細項</h4>
                  {loans.map((l, i) => (
                    <div key={l.id} className="mb-4 p-3 bg-slate-900 rounded-xl border border-slate-700">
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <input type="text" value={l.name} onChange={e => updateLoan(i, 'name', e.target.value)} className="w-full bg-slate-800 p-1 rounded border border-slate-700" placeholder="名稱"/>
                            <input type="number" value={l.principal} onChange={e => updateLoan(i, 'principal', Number(e.target.value))} className="w-full bg-slate-800 p-1 rounded border border-slate-700" placeholder="本金"/>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div><label className="text-[10px] text-slate-500">利率1%</label><input type="number" value={l.rate1} onChange={e => updateLoan(i, 'rate1', Number(e.target.value))} className="w-full bg-slate-800 p-1 rounded"/></div>
                            <div><label className="text-[10px] text-slate-500">利率1月數</label><input type="number" value={l.rate1Months} onChange={e => updateLoan(i, 'rate1Months', Number(e.target.value))} className="w-full bg-slate-800 p-1 rounded"/></div>
                            <div><label className="text-[10px] text-slate-500">利率2%</label><input type="number" value={l.rate2} onChange={e => updateLoan(i, 'rate2', Number(e.target.value))} className="w-full bg-slate-800 p-1 rounded"/></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <div><label className="text-[10px] text-slate-500">總期數</label><input type="number" value={l.totalMonths} onChange={e => updateLoan(idx, 'totalMonths', Number(e.target.value))} className="w-full bg-slate-800 p-1 rounded"/></div>
                            <div><label className="text-[10px] text-slate-500">寬限期</label><input type="number" value={l.gracePeriod} onChange={e => updateLoan(i, 'gracePeriod', Number(e.target.value))} className="w-full bg-slate-800 p-1 rounded"/></div>
                            <div><label className="text-[10px] text-slate-500">已繳</label><input type="number" value={l.paidMonths} onChange={e => updateLoan(i, 'paidMonths', Number(e.target.value))} className="w-full bg-slate-800 p-1 rounded"/></div>
                        </div>
                    </div>
                  ))}
                  <button onClick={() => setLoans([...loans, {id:Date.now().toString(), name:'新房貸', principal:0, rate1:2.1, rate1Months:36, rate2:2.3, totalMonths:360, paidMonths:0, gracePeriod:0, type:'PrincipalAndInterest'}])} className="text-xs text-blue-400">+ 新增房貸</button>
                </div>

                <div className="pt-4 border-t border-slate-700 grid grid-cols-2 gap-4">
                    <div><h4 className="text-blue-400 font-bold mb-2">信貸</h4>
                        <input type="number" value={creditLoan.principal} onChange={e => setCreditLoan({...creditLoan, principal: Number(e.target.value)})} className="w-full bg-slate-900 p-1 rounded border border-slate-700 mb-1" placeholder="本金"/>
                        <input type="number" value={creditLoan.rate} onChange={e => setCreditLoan({...creditLoan, rate: Number(e.target.value)})} className="w-full bg-slate-900 p-1 rounded border border-slate-700" placeholder="利率%"/>
                    </div>
                    <div><h4 className="text-amber-400 font-bold mb-2">不限用途/質押</h4>
                        <input type="number" value={stockLoan.principal} onChange={e => setStockLoan({...stockLoan, principal: Number(e.target.value)})} className="w-full bg-slate-900 p-1 rounded border border-slate-700 mb-1" placeholder="本金"/>
                        <input type="number" value={stockLoan.rate} onChange={e => setStockLoan({...stockLoan, rate: Number(e.target.value)})} className="w-full bg-slate-900 p-1 rounded border border-slate-700" placeholder="利率%"/>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-700"><label className="text-slate-400">生活費</label><input type="number" value={taxStatus.livingExpenses} onChange={e => setTaxStatus({...taxStatus, livingExpenses: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded border border-slate-600"/></div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full mt-6 py-2 bg-blue-600 rounded-lg font-bold">儲存關閉</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
