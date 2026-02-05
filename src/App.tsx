import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Calculator, DollarSign, Wallet, Activity, Save, Upload, Download, RotateCcw, Settings, Globe, Cloud, Loader2, Target, Zap, TrendingUp, RefreshCw, Gift, PieChart as PieIcon, Banknote, Flame, Share2, Scale, ShieldCheck, Swords, Coins, Skull, Gem, Scroll, Sparkles, Lock, Aperture, List, Trash2, X, Tag, ShoppingCart, Coffee, Layers, Crown, Trophy, Calendar, Lightbulb, CheckCircle2, HelpCircle, Edit3, ArrowRightLeft, Plus, ArrowUp, ArrowDown, Wifi, WifiOff } from 'lucide-react';

// ==========================================
// 1. Firebase 設定 (對接 portfolios/tony1006)
// ==========================================
const YOUR_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCM42AelwEWTC4R_V0sgF0FbomkoXdE4T0",
  authDomain: "baozutang-finance.firebaseapp.com",
  projectId: "baozutang-finance",
  storageBucket: "baozutang-finance.firebasestorage.app",
  messagingSenderId: "674257527078",
  appId: "1:674257527078:web:80018b440a826c2ef061e7"
};

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// ==========================================
// 2. 核心定義與介面
// ==========================================
const BROKERAGE_RATE = 0.001425;
const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#a855f7', cash: '#334155' };

interface Lot { id: string; date: string; shares: number; price: number; fee?: number; margin?: number; }
interface ETF { id: string; code?: string; name: string; shares: number; costPrice: number; currentPrice: number; dividendPerShare: number; dividendType?: 'annual' | 'per_period'; payMonths?: number[]; category: 'dividend' | 'hedging' | 'active'; marginLoanAmount?: number; marginInterestRate?: number; lots?: Lot[]; }
interface Loan { id: string; name: string; principal: number; rate1: number; rate1Months: number; rate2: number; totalMonths: number; paidMonths: number; gracePeriod: number; startDate?: string; type: string; }
interface StockLoan { principal: number; rate: number; maintenanceLimit?: number; }
interface CreditLoan { principal: number; rate: number; totalMonths: number; paidMonths: number; }
interface TaxStatus { salaryIncome: number; livingExpenses: number; dependents: number; hasSpouse: boolean; isDisabled: boolean; }
interface AllocationConfig { totalFunds: number; dividendRatio: number; hedgingRatio: number; activeRatio: number; }
interface AppState { etfs: ETF[]; loans: Loan[]; stockLoan: StockLoan; globalMarginLoan: StockLoan; creditLoan: CreditLoan; taxStatus: TaxStatus; allocation: AllocationConfig; collection?: {id:string, count:number}[]; tokens?: number; }

const THEMES = { default: { name: '冒險者', color: 'emerald', bg: 'from-emerald-900', border: 'border-emerald-500', text: 'text-emerald-400', icon: <Zap className="w-4 h-4"/> } };
const GACHA_ITEMS = [
    { id: 'g1', name: '巴菲特的眼鏡', rarity: 'SR', icon: '👓', desc: '看透市場本質' },
    { id: 'g2', name: '蒙格的格柵', rarity: 'SSR', icon: '🏗️', desc: '多元思維模型' },
    { id: 'g6', name: '存錢小豬', rarity: 'N', icon: '🐷', desc: '積少成多' }
];

const USER_BACKUP_DATA = {
  "etfs": [
    { "payMonths": [2, 5, 8, 11], "costPrice": 36.1, "code": "0056", "name": "元大高股息", "currentPrice": 38.26, "category": "dividend", "shares": 101000, "dividendPerShare": 0.866, "dividendType": "per_period", "id": "0056" },
    { "id": "00919", "code": "00919", "costPrice": 22.82, "payMonths": [1, 4, 7, 10], "currentPrice": 23.99, "shares": 20000, "name": "群益精選", "dividendPerShare": 2.52, "dividendType": "annual", "category": "dividend", "marginLoanAmount": 143000 }
  ],
  "loans": [], "stockLoan": { "rate": 2.56, "principal": 0 }, "creditLoan": { "rate": 4.05, "totalMonths": 84, "principal": 0 },
  "globalMarginLoan": { "rate": 4.5, "principal": 0 }, "taxStatus": { "salaryIncome": 589200, "livingExpenses": 0 }, "allocation": { "activeRatio": 5, "hedgingRatio": 15, "dividendRatio": 80, "totalFunds": 14500000 }
};

// ==========================================
// 3. 計算工具
// ==========================================
const formatMoney = (val: any) => `$${Math.floor(Number(val) || 0).toLocaleString()}`;

const recalculateEtfStats = (etf: ETF): ETF => {
    if (!etf.lots || etf.lots.length === 0) return etf;
    const totalShares = etf.lots.reduce((acc, lot) => acc + Number(lot.shares), 0);
    const totalCost = etf.lots.reduce((acc, lot) => acc + (Number(lot.shares) * Number(lot.price)) + (Number(lot.fee) || 0), 0);
    const totalMargin = etf.lots.reduce((acc, lot) => acc + (Number(lot.margin) || 0), 0);
    return { ...etf, shares: totalShares, costPrice: totalShares > 0 ? Number((totalCost / totalShares).toFixed(2)) : 0, marginLoanAmount: totalMargin };
};

const calculateLoanPayment = (loan: any) => {
    const p = loan.principal; const paid = loan.paidMonths; const grace = loan.gracePeriod;
    if (paid < grace) return Math.floor(p * (loan.rate1 / 100 / 12));
    const rate = (paid < loan.rate1Months ? loan.rate1 : loan.rate2) / 100 / 12;
    const n = loan.totalMonths - paid; if (n <= 0) return 0;
    return Math.floor((p * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1));
};

const generateCashFlow = (etfs: ETF[], loans: Loan[], stockLoan: StockLoan, creditLoan: CreditLoan, globalMarginLoan: StockLoan, taxStatus: TaxStatus) => {
    const monthlyFlows = [];
    for (let m = 1; m <= 12; m++) {
        let dividendInflow = 0;
        etfs.forEach(etf => { 
            if (etf.payMonths?.includes(m)) {
                let payout = etf.dividendPerShare;
                if (etf.dividendType === 'annual' && etf.payMonths && etf.payMonths.length > 0) payout /= etf.payMonths.length;
                dividendInflow += (etf.shares * payout); 
            }
        });
        let loanOutflow = 0; loans.forEach(l => loanOutflow += calculateLoanPayment(l));
        const creditRate = creditLoan.rate / 100 / 12;
        const creditOutflow = creditLoan.principal > 0 ? Math.floor((creditLoan.principal * creditRate * Math.pow(1 + creditRate, creditLoan.totalMonths)) / (Math.pow(1 + creditRate, creditLoan.totalMonths) - 1)) : 0;
        const stockInterest = Math.floor((stockLoan.principal * (stockLoan.rate/100)/12) + (globalMarginLoan.principal * (globalMarginLoan.rate/100)/12));
        const marginInterest = etfs.reduce((acc, e) => acc + ((e.marginLoanAmount||0) * ((e.marginInterestRate||6.5)/100)/12), 0);
        const taxWithheld = Math.floor(dividendInflow * 0.0211);
        monthlyFlows.push({ month: m, dividendInflow, loanOutflow, creditLoanOutflow: creditOutflow, stockLoanInterest: stockInterest + marginInterest, livingExpenses: taxStatus.livingExpenses, taxWithheld, netFlow: dividendInflow - loanOutflow - creditOutflow - (stockInterest + marginInterest) - taxStatus.livingExpenses - taxWithheld });
    }
    return monthlyFlows;
};

// ==========================================
// 4. Firebase 初始化 (Match Screenshot)
// ==========================================
let db: any = null;
try { const app = initializeApp(YOUR_FIREBASE_CONFIG); db = getFirestore(app); } catch(e) { console.error(e); }

const STORAGE_KEY = 'baozutang_v49';
const COLLECTION_NAME = "portfolios";
const DOCUMENT_ID = "tony1006";

const StorageService = {
    saveData: async (data: any) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        if (db) await setDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID), data);
        return true;
    },
    loadData: async () => {
        if (db) {
            const snap = await getDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID));
            if (snap.exists()) return { data: snap.data(), source: 'cloud' };
        }
        const local = localStorage.getItem(STORAGE_KEY);
        return local ? { data: JSON.parse(local), source: 'local' } : { data: USER_BACKUP_DATA, source: 'backup' };
    }
};

// ==========================================
// 5. App 主程式
// ==========================================
const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dataSrc, setDataSrc] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Data State
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stockLoan, setStockLoan] = useState<StockLoan>({rate:2.56, principal:0});
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>({rate:4.5, principal:0});
  const [creditLoan, setCreditLoan] = useState<CreditLoan>({rate:4.05, totalMonths:84, principal:0, paidMonths:0});
  const [taxStatus, setTaxStatus] = useState<TaxStatus>({salaryIncome:0, livingExpenses:0, hasSpouse:true, isDisabled:true, dependents:0});
  const [allocation, setAllocation] = useState<AllocationConfig>({activeRatio:5, hedgingRatio:15, dividendRatio:80, totalFunds:14500000});
  const [collection, setCollection] = useState<{id: string, count: number}[]>([]);
  const [tokens, setTokens] = useState(0);
  const [reinvest, setReinvest] = useState(true);

  // UI State
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState({ shares: '', price: '', date: '', margin: '' });

  useEffect(() => {
    StorageService.loadData().then(res => {
      setDataSrc(res.source);
      if (res.data) {
        const d = res.data;
        if(d.etfs) setEtfs(d.etfs); if(d.loans) setLoans(d.loans); if(d.stockLoan) setStockLoan(d.stockLoan);
        if(d.globalMarginLoan) setGlobalMarginLoan(d.globalMarginLoan); if(d.creditLoan) setCreditLoan(d.creditLoan);
        if(d.taxStatus) setTaxStatus(d.taxStatus); if(d.allocation) setAllocation(d.allocation);
        if(d.collection) setCollection(d.collection); if(d.tokens !== undefined) setTokens(d.tokens);
      }
      setIsInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    setSaveStatus('saving');
    const t = setTimeout(() => {
      StorageService.saveData({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, collection, tokens })
        .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); });
    }, 1500);
    return () => clearTimeout(t);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, collection, tokens, isInitializing]);

  // Calculations
  const monthlyFlows = useMemo(() => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);
  const totalDividend = useMemo(() => monthlyFlows.reduce((a, b) => a + b.dividendInflow, 0), [monthlyFlows]);
  const totalMortgage = useMemo(() => monthlyFlows.reduce((a, b) => a + b.loanOutflow, 0), [monthlyFlows]);
  const totalCredit = useMemo(() => monthlyFlows.reduce((a, b) => a + b.creditLoanOutflow, 0), [monthlyFlows]);
  const totalStockInterest = useMemo(() => monthlyFlows.reduce((a, b) => a + b.stockLoanInterest, 0), [monthlyFlows]);
  const totalLiving = useMemo(() => monthlyFlows.reduce((a, b) => a + b.livingExpenses, 0), [monthlyFlows]);
  const totalTax = useMemo(() => monthlyFlows.reduce((a, b) => a + b.taxWithheld, 0), [monthlyFlows]);
  const totalNet = useMemo(() => monthlyFlows.reduce((a, b) => a + b.netFlow, 0), [monthlyFlows]);

  const totalMarketValue = etfs.reduce((a, e) => a + (e.shares * e.currentPrice), 0);
  const totalStockDebt = stockLoan.principal + globalMarginLoan.principal + etfs.reduce((a, e) => a + (e.marginLoanAmount || 0), 0);
  const currentMaintenance = totalStockDebt === 0 ? 999 : (totalMarketValue / totalStockDebt) * 100;
  const unrealizedPL = totalMarketValue - etfs.reduce((a, e) => a + (e.shares * e.costPrice), 0);

  const fireMetrics = useMemo(() => {
      const exp = totalMortgage + totalCredit + totalStockInterest + (taxStatus.livingExpenses * 12);
      return { ratio: exp > 0 ? (totalDividend / exp) * 100 : 0 };
  }, [totalDividend, totalMortgage, totalCredit, totalStockInterest, taxStatus]);

  const combatPower = Math.floor((totalMarketValue/10000) + (totalDividend/12/100));
  const levelInfo = useMemo(() => {
      const r = fireMetrics.ratio;
      if(r>=100) return {title:'財富國王 👑', color:'text-yellow-400'};
      if(r>=50) return {title:'資產領主 ⚔️', color:'text-purple-400'};
      return {title:'理財騎士 🛡️', color:'text-blue-400'};
  }, [fireMetrics]);

  // Allocation Logic (Net Equity)
  const actualDividend = etfs.filter(e => e.category === 'dividend').reduce((a, e) => a + (e.shares * e.currentPrice) - (e.marginLoanAmount || 0), 0);
  const actualHedging = etfs.filter(e => e.category === 'hedging').reduce((a, e) => a + (e.shares * e.currentPrice) - (e.marginLoanAmount || 0), 0);
  const actualActive = etfs.filter(e => e.category === 'active').reduce((a, e) => a + (e.shares * e.currentPrice) - (e.marginLoanAmount || 0), 0);
  const targetDividend = Math.floor(allocation.totalFunds * (allocation.dividendRatio / 100));
  const targetHedging = Math.floor(allocation.totalFunds * (allocation.hedgingRatio / 100));
  const targetActive = Math.floor(allocation.totalFunds * (allocation.activeRatio / 100));
  
  const pieData = [{ name: '配息型', value: Math.max(0, actualDividend), color: COLORS.dividend }, { name: '避險型', value: Math.max(0, actualHedging), color: COLORS.hedging }, { name: '主動型', value: Math.max(0, actualActive), color: COLORS.active }].filter(d => d.value > 0);

  const radarData = [
    { subject: '現金流', A: Math.min(100, fireMetrics.ratio) },
    { subject: '安全性', A: Math.min(100, (actualHedging / (totalMarketValue - totalStockDebt || 1)) * 500) },
    { subject: '抗壓性', A: Math.min(100, (currentMaintenance - 130) * 2) },
    { subject: '成長性', A: Math.min(100, (actualActive / (totalMarketValue - totalStockDebt || 1)) * 500) },
  ];

  const snowballData = useMemo(() => { 
      const avgYield = totalMarketValue > 0 ? totalDividend / totalMarketValue : 0.05; 
      const annualSavings = totalNet; 
      const data = []; let currentWealth = totalMarketValue; let currentIncome = totalDividend; 
      for (let year = 0; year <= 10; year++) { 
          data.push({ year: `Y${year}`, wealth: Math.floor(currentWealth), income: Math.floor(currentIncome) }); 
          currentWealth = currentWealth * 1.05 + (reinvest ? currentIncome : 0) + annualSavings; 
          currentIncome = currentWealth * avgYield; 
      } 
      return data; 
  }, [totalMarketValue, totalDividend, totalNet, reinvest]);

  // Handlers
  const updateEtf = (i: number, f: string, v: any) => { const n = [...etfs]; (n[i] as any)[f] = v; setEtfs(n); };
  const moveEtf = (i: number, d: number) => { const n = [...etfs]; if(i+d < 0 || i+d >= n.length) return; [n[i], n[i+d]] = [n[i+d], n[i]]; setEtfs(n); };
  const removeEtf = (id: string) => { if (confirm('確定刪除？')) setEtfs(etfs.filter(e => e.id !== id)); };
  
  const submitBuy = (i: number) => {
    const s = Number(buyForm.shares), p = Number(buyForm.price), m = Number(buyForm.margin); if (!s || !p) return;
    const newEtfs = [...etfs]; const currentEtf = newEtfs[i];
    const newLot = { id: Date.now().toString(), date: buyForm.date, shares: s, price: p, fee: Math.floor(s*p*BROKERAGE_RATE), margin: m };
    const updatedLots = currentEtf.lots ? [...currentEtf.lots, newLot] : [newLot];
    newEtfs[i] = recalculateEtfStats({ ...currentEtf, lots: updatedLots });
    setEtfs(newEtfs); setBuyForm({ shares: '', price: '', date: '', margin: '' }); setActiveBuyId(null);
  };

  const removeLot = (i: number, lid: string) => {
    const newEtfs = [...etfs]; const currentEtf = newEtfs[i];
    if (!currentEtf.lots) return;
    const updatedLots = currentEtf.lots.filter(x => x.id !== lid);
    newEtfs[i] = recalculateEtfStats({ ...currentEtf, lots: updatedLots });
    setEtfs(newEtfs);
  };

  const handleGacha = () => {
    if (tokens < 1) return;
    setTokens(t => t - 1);
    const item = GACHA_ITEMS[Math.floor(Math.random() * GACHA_ITEMS.length)];
    setCollection(prev => { const ex = prev.find(p => p.id === item.id); return ex ? prev.map(p => p.id === item.id ? {...p, count: p.count + 1} : p) : [...prev, {id: item.id, count: 1}]; });
    alert(`恭喜抽中：${item.name}！`);
  };

  if (isInitializing) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> 雲端同步中...</div>;

  const currentClass = THEMES.default;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-900 text-white font-sans selection:bg-emerald-500/30">
      <header className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2"><Calculator className="w-8 h-8"/> 包租唐戰情室</h1>
             <div className="flex items-center gap-2 mt-2 text-xs"><span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 flex items-center gap-1">{saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin"/> : dataSrc === 'cloud' ? <Wifi size={12} className="text-blue-400"/> : <WifiOff size={12} className="text-slate-500"/>}{dataSrc === 'cloud' ? "雲端同步" : "本機模式"}</span></div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 bg-slate-800 rounded border border-slate-700"><Settings size={18}/></button>
            <button onClick={() => StorageService.saveData({etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation})} className="p-2 bg-slate-800 rounded border border-slate-700 text-blue-400"><Save size={18}/></button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="xl:col-span-4 space-y-6">
            {/* Level HUD */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-emerald-500/50 shadow-lg relative overflow-hidden">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">玩家等級</div>
                <div className="text-3xl font-black text-white mb-2">{levelInfo.title}</div>
                <div className="w-full bg-slate-900 rounded-full h-2 mb-4 border border-slate-700 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{width: `${Math.min(100, fireMetrics.ratio)}%`}}></div></div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div><div className="text-slate-500 text-[10px]">戰鬥力 (CP)</div><div className="text-xl font-mono font-bold text-white">{combatPower.toLocaleString()}</div></div>
                    <div><div className="text-slate-500 text-[10px]">維持率 (HP)</div><div className={`text-xl font-mono font-bold ${currentMaintenance < 130 ? 'text-red-500' : 'text-emerald-400'}`}>{currentMaintenance === 999 ? 'MAX' : currentMaintenance.toFixed(0) + '%'}</div></div>
                    <div><div className="text-slate-500 text-[10px]">FIRE 進度</div><div className="text-xl font-mono text-orange-400 font-bold">{fireMetrics.ratio.toFixed(1)}%</div></div>
                </div>
            </div>

            <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl"><h2 className="text-lg font-bold mb-4 text-cyan-300 flex items-center gap-2"><ShieldCheck/> 資產體質</h2><div className="h-64 -ml-4"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData}><PolarGrid stroke="#334155"/><PolarAngleAxis dataKey="subject" tick={{fill:'#94a3b8', fontSize:12}}/><Radar dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.5}/></RadarChart></ResponsiveContainer></div></section>
            
            <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
                <h2 className="text-lg font-bold mb-4 text-blue-300 flex items-center gap-2"><PieIcon/> 資金分配 (淨值)</h2>
                <div className="h-40 flex justify-center items-center mb-4"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}</Pie><Tooltip/></PieChart></ResponsiveContainer></div>
                <div className="space-y-4">
                    <div><div className="flex justify-between text-xs mb-1"><span>配息型</span><span className={actualDividend < targetDividend ? "text-red-400" : "text-emerald-400"}>缺 {formatMoney(Math.max(0, targetDividend - actualDividend))}</span></div><div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full" style={{width: `${Math.min(100, (actualDividend / (targetDividend || 1)) * 100)}%`}}></div></div></div>
                    <div><div className="flex justify-between text-xs mb-1"><span>避險型</span><span className={actualHedging < targetHedging ? "text-red-400" : "text-emerald-400"}>缺 {formatMoney(Math.max(0, targetHedging - actualHedging))}</span></div><div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-amber-500 h-full" style={{width: `${Math.min(100, (actualHedging / (targetHedging || 1)) * 100)}%`}}></div></div></div>
                </div>
            </section>

            <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
                <h2 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2"><Activity/> 標的清單</h2>
                <div className="space-y-4">
                    {etfs.map((e, i) => (
                        <div key={e.id} className="p-4 bg-slate-900 rounded-xl border border-slate-700 relative group">
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => moveEtf(i, -1)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><ArrowUp size={14}/></button><button onClick={() => moveEtf(i, 1)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><ArrowDown size={14}/></button><button onClick={() => removeEtf(e.id)} className="p-1 hover:bg-slate-700 rounded text-red-400"><Trash2 size={14}/></button></div>
                            <div className="flex justify-between items-center mb-2">
                                <div className="relative group/edit">
                                    <input type="text" value={e.code || ''} onChange={(v) => updateEtf(i, 'code', v.target.value)} className="absolute -top-5 left-0 text-[10px] bg-slate-800 text-slate-400 border border-slate-600 rounded px-1 w-16 outline-none" placeholder="代號" />
                                    <input type="text" value={e.name} onChange={v => updateEtf(i, 'name', v.target.value)} className="bg-transparent font-bold text-white w-full outline-none"/>
                                </div>
                                <div className="flex gap-1"><button onClick={() => setActiveBuyId(activeBuyId === e.id ? null : e.id)} className="p-1 rounded bg-slate-800 hover:bg-emerald-900/50"><ShoppingCart size={14}/></button><button onClick={() => setExpandedEtfId(expandedEtfId === e.id ? null : e.id)} className="p-1 rounded bg-slate-800 hover:bg-slate-700"><List size={14}/></button></div>
                            </div>
                            {activeBuyId === e.id && (<div className="mb-3 p-3 bg-emerald-900/20 rounded-lg animate-in slide-in-from-top-2"><div className="grid grid-cols-2 gap-2 mb-2"><input type="number" placeholder="股數" value={buyForm.shares} onChange={v => setBuyForm({...buyForm, shares: v.target.value})} className="bg-slate-900 p-1 rounded text-xs border border-slate-700"/><input type="number" placeholder="單價" value={buyForm.price} onChange={v => setBuyForm({...buyForm, price: v.target.value})} className="bg-slate-900 p-1 rounded text-xs border border-slate-700"/><input type="number" placeholder="融資額" value={buyForm.margin} onChange={v => setBuyForm({...buyForm, margin: v.target.value})} className="bg-slate-900 p-1 rounded text-xs border border-blue-900"/><input type="date" value={buyForm.date} onChange={v => setBuyForm({...buyForm, date: v.target.value})} className="bg-slate-900 p-1 rounded text-xs border border-slate-700"/></div><button onClick={() => submitBuy(i)} className="w-full bg-emerald-600 text-xs py-1.5 rounded font-bold">確認交易</button></div>)}
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div><label className="text-slate-500 block">股數</label><div className="text-white pt-1">{e.shares.toLocaleString()}</div></div>
                                <div><label className="text-slate-500 block">現價</label><input type="number" value={e.currentPrice} onChange={v => updateEtf(i, 'currentPrice', Number(v.target.value))} className="w-full bg-slate-800 rounded px-1 mt-1 border border-slate-700"/></div>
                                <div><label className="text-blue-300 block">總融資</label><div className="text-blue-300 pt-1">{formatMoney(e.marginLoanAmount)}</div></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[10px] mt-2 pt-2 border-t border-slate-800">
                                <div><label className="text-slate-500 block">成本</label><div className="text-slate-300">{e.costPrice}</div></div>
                                <div><label className="text-slate-500 block">市值</label><div className="text-slate-300">{formatMoney(e.shares * e.currentPrice)}</div></div>
                                <div><label className="text-slate-500 block">損益</label><div className={(e.shares*e.currentPrice - e.shares*e.costPrice) >=0 ? "text-red-400" : "text-green-400"}>{formatMoney(e.shares*e.currentPrice - e.shares*e.costPrice)}</div></div>
                            </div>
                            {expandedEtfId === e.id && e.lots && (<div className="mt-3 space-y-1 animate-in fade-in">{e.lots.map(l => (<div key={l.id} className="flex justify-between text-[10px] bg-slate-800 p-1.5 rounded border border-slate-700"><span>{l.date} | {l.shares}股</span><span>{formatMoney(l.price)} (融:{formatMoney(l.margin||0)}) <button onClick={() => removeLot(i, l.id)} className="text-red-500 ml-1">×</button></span></div>))}</div>)}
                        </div>
                    ))}
                    <button onClick={() => setEtfs([...etfs, { id: Date.now().toString(), name: '新標的', code: '', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'per_period', payMonths: [1,4,7,10], category: 'dividend', marginLoanAmount: 0 }])} className="w-full py-2 border border-dashed border-slate-600 rounded-xl text-slate-500 hover:text-white transition-all">+ 新增標的</button>
                </div>
            </section>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-8 space-y-6">
           {/* Top Stats */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-lg"><div className="text-slate-400 text-xs">年度淨現金流</div><div className={`text-2xl font-bold ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-blue-500 shadow-lg"><div className="text-slate-400 text-xs">總資產市值</div><div className="text-2xl font-bold">{formatMoney(totalMarketValue)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-red-500 shadow-lg"><div className="text-slate-400 text-xs">總負債</div><div className="text-2xl font-bold">{formatMoney(totalStockDebt)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-orange-500 shadow-lg"><div className="text-slate-400 text-xs">維持率</div><div className="text-2xl font-bold">{currentMaintenance === 999 ? "MAX" : currentMaintenance.toFixed(1) + "%"}</div></div>
           </div>

           {/* Snowball Chart */}
           <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold flex items-center gap-2 text-white"><TrendingUp className="w-5 h-5 text-indigo-400"/> 十年財富滾雪球</h3><div className="flex bg-slate-900 rounded-lg p-1 border border-slate-600"><button onClick={()=>setReinvest(false)} className={`px-3 py-1 text-xs rounded transition-colors ${!reinvest ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>花掉股息</button><button onClick={()=>setReinvest(true)} className={`px-3 py-1 text-xs rounded transition-colors ${reinvest ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>複利投入</button></div></div>
                <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={snowballData}><defs><linearGradient id="cw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/><stop offset="95%" stopColor="#818cf8" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="year" stroke="#94a3b8" tick={{fontSize:12}} /><YAxis stroke="#94a3b8" tick={{fontSize:12}} /><Tooltip formatter={(v:number)=>formatMoney(v)}/><Area type="monotone" dataKey="wealth" stroke="#818cf8" fill="url(#cw)" /></AreaChart></ResponsiveContainer></div>
           </div>

           {/* Cash Flow Table */}
           <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl overflow-x-auto">
             <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white"><Calendar className="w-5 h-5 text-blue-400"/> 每月現金流明細</h3>
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
                 <tr><th className="p-3">月份</th><th className="p-3">股息收入</th><th className="p-3">房貸</th><th className="p-3">信貸</th><th className="p-3">利息</th><th className="p-3">生活</th><th className="p-3 text-right">淨流</th></tr>
               </thead>
               <tbody>
                 {monthlyFlows.map(r => (
                   <tr key={r.month} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                     <td className="p-3 font-bold">{r.month}月</td>
                     <td className="p-3 text-emerald-400 font-mono">{formatMoney(r.dividendInflow)}</td>
                     <td className="p-3 text-red-400 font-mono">{formatMoney(r.loanOutflow)}</td>
                     <td className="p-3 text-orange-400 font-mono">{formatMoney(r.creditLoanOutflow)}</td>
                     <td className="p-3 text-blue-300 font-mono">{formatMoney(r.stockLoanInterest)}</td>
                     <td className="p-3 text-slate-400 font-mono">{formatMoney(r.livingExpenses)}</td>
                     <td className={`p-3 text-right font-bold ${r.netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(r.netFlow)}</td>
                   </tr>
                 ))}
               </tbody>
               <tfoot>
                 <tr className="bg-slate-900 font-black text-white">
                   <td className="p-3 rounded-bl-lg">年度總計</td>
                   <td className="p-3 text-emerald-400 font-mono">{formatMoney(totalDividend)}</td>
                   <td className="p-3 text-red-400 font-mono">{formatMoney(totalMortgage)}</td>
                   <td className="p-3 text-orange-400 font-mono">{formatMoney(totalCredit)}</td>
                   <td className="p-3 text-blue-300 font-mono">{formatMoney(totalStockInterest)}</td>
                   <td className="p-3 text-slate-400 font-mono">{formatMoney(totalLiving)}</td>
                   <td className={`p-3 text-right rounded-br-lg font-mono ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</td>
                 </tr>
               </tfoot>
             </table>
           </div>

           {/* Gacha Section */}
           <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-xl flex flex-col justify-between">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-3 flex items-center gap-2"><Gift className="w-3 h-3 text-yellow-400" /> 轉蛋機 (代幣: {tokens})</div>
                <div className="grid grid-cols-6 gap-2 mb-4">
                    {collection.map((item: any, i: number) => (
                        <div key={i} className="aspect-square bg-slate-900 rounded border border-slate-600 flex items-center justify-center text-xl" title={`x${item.count}`}>{GACHA_ITEMS.find(g => g.id === item.id)?.icon}</div>
                    ))}
                </div>
                <button onClick={handleGacha} disabled={tokens < 1} className={`w-full py-2 rounded text-xs font-bold transition-all ${tokens > 0 ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white' : 'bg-slate-700 text-slate-500'}`}>{tokens > 0 ? '立即召喚' : '代幣不足'}</button>
            </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-white">⚙️ 系統設定</h3>
            <div className="space-y-4 text-sm">
                <div><label className="text-slate-400">總投資預算</label><input type="number" value={allocation.totalFunds} onChange={e => setAllocation({...allocation, totalFunds: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded mt-1 border border-slate-600 outline-none focus:border-blue-500"/></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-slate-400">配息比例 %</label><input type="number" value={allocation.dividendRatio} onChange={e => setAllocation({...allocation, dividendRatio: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded mt-1 border border-slate-600"/></div>
                    <div><label className="text-slate-400">避險比例 %</label><input type="number" value={allocation.hedgingRatio} onChange={e => setAllocation({...allocation, hedgingRatio: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded mt-1 border border-slate-600"/></div>
                </div>
                <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
                    <p>已連線 Firebase: portfolios / tony1006</p>
                </div>
                <div className="pt-2 border-t border-slate-700">
                    <label className="text-slate-400">房貸已繳期數 (全域)</label>
                    <input type="number" value={loans[0]?.paidMonths || 0} onChange={e => { const n=[...loans]; if(n[0]) n[0].paidMonths=Number(e.target.value); setLoans(n); }} className="w-full bg-slate-900 p-2 rounded mt-1 border border-slate-600"/>
                </div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full mt-6 py-2 bg-blue-600 rounded-lg font-bold">儲存並關閉</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
