import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Calculator, DollarSign, Wallet, Activity, Save, Upload, Download, RotateCcw, Settings, Globe, Cloud, Loader2, Target, Zap, TrendingUp, RefreshCw, Gift, PieChart as PieIcon, Banknote, Flame, Share2, Scale, ShieldCheck, Swords, Coins, Skull, Gem, Scroll, Sparkles, Lock, Aperture, List, Trash2, X, Tag, ShoppingCart, Coffee, Layers, Crown, Trophy, Calendar, Lightbulb, CheckCircle2, HelpCircle, Edit3, ArrowRightLeft, Plus, ArrowUp, ArrowDown, Wifi, WifiOff } from 'lucide-react';

// ==========================================
// 1. Firebase 設定 (已為您填入正確鑰匙)
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
// 2. 定義介面 (Interfaces)
// ==========================================
interface Lot { id: string; date: string; shares: number; price: number; fee?: number; margin?: number; }
interface ETF { id: string; code?: string; name: string; shares: number; costPrice: number; currentPrice: number; dividendPerShare: number; dividendType?: 'annual' | 'per_period'; payMonths?: number[]; category: 'dividend' | 'hedging' | 'active'; marginLoanAmount?: number; marginInterestRate?: number; lots?: Lot[]; }
interface Loan { id: string; name: string; principal: number; rate1: number; rate1Months: number; rate2: number; totalMonths: number; paidMonths: number; gracePeriod: number; startDate?: string; type: string; }
interface StockLoan { principal: number; rate: number; maintenanceLimit?: number; }
interface CreditLoan { principal: number; rate: number; totalMonths: number; paidMonths: number; }
interface TaxStatus { salaryIncome: number; livingExpenses: number; dependents: number; hasSpouse: boolean; isDisabled: boolean; }
interface AllocationConfig { totalFunds: number; dividendRatio: number; hedgingRatio: number; activeRatio: number; }
interface CloudConfig { priceSourceUrl: string; enabled: boolean; }
interface AppState { etfs: ETF[]; loans: Loan[]; stockLoan: StockLoan; globalMarginLoan: StockLoan; creditLoan: CreditLoan; taxStatus: TaxStatus; allocation: AllocationConfig; collection?: {id:string, count:number}[]; tokens?: number; cloudConfig: CloudConfig; }

const BROKERAGE_RATE = 0.001425;
const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#a855f7', cash: '#334155' };
const GACHA_ITEMS = [{ id: 'g1', name: '巴菲特的眼鏡', rarity: 'SR', icon: '👓' }, { id: 'g2', name: '蒙格的格柵', rarity: 'SSR', icon: '🏗️' }, { id: 'g6', name: '存錢小豬', rarity: 'N', icon: '🐷' }];

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
    const flows = [];
    for (let m = 1; m <= 12; m++) {
        let divIn = 0;
        etfs.forEach(etf => { 
            if (etf.payMonths?.includes(m)) {
                let payout = etf.dividendPerShare;
                if (etf.dividendType === 'annual' && etf.payMonths && etf.payMonths.length > 0) payout /= etf.payMonths.length;
                divIn += (etf.shares * payout); 
            }
        });
        let loanOut = 0; loans.forEach(l => loanOut += calculateLoanPayment(l));
        const cRate = creditLoan.rate / 100 / 12;
        const creditOut = creditLoan.principal > 0 ? Math.floor((creditLoan.principal * cRate * Math.pow(1 + cRate, creditLoan.totalMonths)) / (Math.pow(1 + cRate, creditLoan.totalMonths) - 1)) : 0;
        const stockInt = Math.floor((stockLoan.principal * (stockLoan.rate/100)/12) + (globalMarginLoan.principal * (globalMarginLoan.rate/100)/12));
        const marginInt = etfs.reduce((acc, e) => acc + ((e.marginLoanAmount||0) * ((e.marginInterestRate||6.5)/100)/12), 0);
        const tax = Math.floor(divIn * 0.0211);
        flows.push({ month: m, divIn, loanOut, creditOut, stockInt: stockInt + marginInt, life: taxStatus.livingExpenses, tax, net: divIn - loanOut - creditOut - stockInt - marginInt - taxStatus.livingExpenses - tax });
    }
    return flows;
};

// ==========================================
// 4. Firebase & Storage 定位
// ==========================================
let db: any = null;
try { const app = initializeApp(YOUR_FIREBASE_CONFIG); db = getFirestore(app); } catch(e) { console.error(e); }

const COLLECTION_NAME = "portfolios";
const DOCUMENT_ID = "tony1006";

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
    },
    exportToFile: (data: any) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `baozutang_backup.json`; a.click();
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
  const [collection, setCollection] = useState<{id: string, count: number}[]>([]);
  const [tokens, setTokens] = useState(0);
  const [reinvest, setReinvest] = useState(true);

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
        if(d.collection) setCollection(d.collection); if(d.tokens !== undefined) setTokens(d.tokens);
        if(d.cloudConfig) setCloudConfig(d.cloudConfig);
      }
      setIsInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    setSaveStatus('saving');
    const t = setTimeout(() => {
      StorageService.saveData({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, collection, tokens, cloudConfig })
        .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); });
    }, 1500);
    return () => clearTimeout(t);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, collection, tokens, cloudConfig, isInitializing]);

  // Calculations
  const monthlyFlows = useMemo(() => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);
  const totalDividend = useMemo(() => monthlyFlows.reduce((a, b) => a + b.divIn, 0), [monthlyFlows]);
  const totalMortgage = useMemo(() => monthlyFlows.reduce((a, b) => a + b.loanOut, 0), [monthlyFlows]);
  const totalCredit = useMemo(() => monthlyFlows.reduce((a, b) => a + b.creditOut, 0), [monthlyFlows]);
  const totalStockInterest = useMemo(() => monthlyFlows.reduce((a, b) => a + b.stockInt, 0), [monthlyFlows]);
  const totalLiving = useMemo(() => monthlyFlows.reduce((a, b) => a + b.life, 0), [monthlyFlows]);
  const totalNet = useMemo(() => monthlyFlows.reduce((a, b) => a + b.net, 0), [monthlyFlows]);

  const totalValue = etfs.reduce((a, e) => a + (e.shares * e.currentPrice), 0);
  const totalDebt = stockLoan.principal + globalMarginLoan.principal + etfs.reduce((a, e) => a + (e.marginLoanAmount || 0), 0);
  const maintenance = totalDebt === 0 ? 999 : (totalValue / totalDebt) * 100;
  const unrealizedPL = etfs.reduce((a, e) => a + (e.shares * e.currentPrice - e.shares * e.costPrice), 0);

  const fireMetrics = { ratio: (totalMortgage + totalCredit + totalStockInterest + totalLiving) > 0 ? (totalDividend / (totalMortgage + totalCredit + totalStockInterest + totalLiving)) * 100 : 0 };
  const levelInfo = fireMetrics.ratio >= 100 ? {title:'財富國王 👑'} : fireMetrics.ratio >= 50 ? {title:'資產領主 ⚔️'} : {title:'理財騎士 🛡️'};
  const combatPower = Math.floor((totalValue/10000) + (totalDividend/12/100));

  // Allocation Logic (Net)
  const actualDiv = etfs.filter(e => e.category === 'dividend').reduce((a, e) => a + (e.shares * e.currentPrice) - (e.marginLoanAmount || 0), 0);
  const actualHedge = etfs.filter(e => e.category === 'hedging').reduce((a, e) => a + (e.shares * e.currentPrice) - (e.marginLoanAmount || 0), 0);
  const targetDividend = allocation.totalFunds * (allocation.dividendRatio / 100);
  const targetHedging = allocation.totalFunds * (allocation.hedgingRatio / 100);

  // ★★★ Google Sheet Update ★★★
  const handleUpdatePrices = async () => {
      if (!cloudConfig.priceSourceUrl) { alert('請先在設定中輸入 CSV 連結！'); setShowSettings(true); return; }
      setIsUpdatingPrices(true);
      try {
          const res = await fetch(cloudConfig.priceSourceUrl);
          const text = await res.text();
          const rows = text.split('\n').map(r => r.split(','));
          const priceMap = new Map<string, number>();
          rows.forEach(row => { if (row.length >= 2) { const code = row[0].trim(); const price = parseFloat(row[1].trim()); if (code && !isNaN(price)) priceMap.set(code, price); } });
          const newEtfs = etfs.map(e => {
              const code = e.code || e.id;
              return priceMap.has(code) ? { ...e, currentPrice: priceMap.get(code)! } : e;
          });
          setEtfs(newEtfs); alert('行情更新成功！');
      } catch (e) { alert('更新失敗，請檢查連結'); } finally { setIsUpdatingPrices(false); }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const data = JSON.parse(ev.target?.result as string);
              if(data.etfs) { setEtfs(data.etfs); setLoans(data.loans || []); setTaxStatus(data.taxStatus); setAllocation(data.allocation); alert('資料匯入成功！'); }
          } catch(e) { alert('匯入格式錯誤'); }
      };
      reader.readAsText(file);
  };

  const updateEtf = (i: number, f: string, v: any) => { const n = [...etfs]; (n[i] as any)[f] = v; setEtfs(n); };
  const moveEtf = (i: number, d: number) => { const n = [...etfs]; if(i+d < 0 || i+d >= n.length) return; [n[i], n[i+d]] = [n[i+d], n[i]]; setEtfs(n); };

  if (isInitializing) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> 雲端連線中...</div>;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-900 text-white font-sans">
      <header className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2"><Calculator/> 包租唐戰情室 V50</h1>
            <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 flex items-center gap-1">
                    {saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin"/> : dataSrc === 'cloud' ? <Wifi size={12} className="text-blue-400"/> : <WifiOff size={12} className="text-slate-500"/>}
                    {dataSrc === 'cloud' ? "雲端同步中" : "本機模式"}
                </span>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={handleUpdatePrices} disabled={isUpdatingPrices} className="p-2 bg-slate-800 rounded border border-slate-700 text-emerald-400">{isUpdatingPrices ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>}</button>
            <button onClick={() => setShowSettings(true)} className="p-2 bg-slate-800 rounded border border-slate-700"><Settings size={18}/></button>
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json"/>
            <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-slate-800 rounded border border-slate-700 text-blue-400"><Upload size={18}/></button>
            <button onClick={() => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig })} className="p-2 bg-slate-800 rounded border border-slate-700 text-amber-400"><Download size={18}/></button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
            {/* Level HUD */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-emerald-500/50 shadow-xl relative overflow-hidden">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">玩家等級</div>
                <div className="text-3xl font-black mb-2">{levelInfo.title}</div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full" style={{width:`${Math.min(100, fireMetrics.ratio)}%`}}></div></div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div><div className="text-slate-500 text-[10px]">戰鬥力</div><div className="font-mono font-bold">{combatPower.toLocaleString()}</div></div>
                    <div><div className="text-slate-500 text-[10px]">維持率</div><div className={maintenance < 140 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{maintenance === 999 ? 'MAX' : maintenance.toFixed(0)+'%'}</div></div>
                    <div><div className="text-slate-500 text-[10px]">未實現</div><div className={unrealizedPL >=0 ? "text-red-400" : "text-green-400"}>{formatMoney(unrealizedPL)}</div></div>
                </div>
            </div>

            <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h2 className="text-lg font-bold mb-4 text-blue-300 flex items-center gap-2"><PieIcon/> 資金配置 (淨值)</h2>
                <div className="space-y-4">
                    <div><div className="flex justify-between text-xs mb-1"><span>配息型</span><span>缺 {formatMoney(Math.max(0, targetDividend - actualDiv))}</span></div><div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full" style={{width: `${Math.min(100, (actualDiv / (targetDividend || 1)) * 100)}%`}}></div></div></div>
                    <div><div className="flex justify-between text-xs mb-1"><span>避險型</span><span>缺 {formatMoney(Math.max(0, targetHedging - actualHedge))}</span></div><div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-amber-500 h-full" style={{width: `${Math.min(100, (actualHedge / (targetHedging || 1)) * 100)}%`}}></div></div></div>
                </div>
            </section>

            <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h2 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2"><Activity/> 標的清單</h2>
                <div className="space-y-4">
                    {etfs.map((e, i) => (
                        <div key={e.id} className="p-4 bg-slate-900 rounded-xl border border-slate-700 relative group">
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => moveEtf(i, -1)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><ArrowUp size={14}/></button><button onClick={() => moveEtf(i, 1)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><ArrowDown size={14}/></button><button onClick={() => removeEtf(e.id)} className="p-1 hover:bg-slate-700 rounded text-red-400"><Trash2 size={14}/></button></div>
                            <div className="flex justify-between items-center mb-2">
                                <div className="relative"><input type="text" value={e.code || ''} onChange={(v) => updateEtf(i, 'code', v.target.value)} className="absolute -top-5 left-0 text-[10px] bg-slate-800 text-slate-400 px-1 rounded w-16" placeholder="代號"/><input type="text" value={e.name} onChange={v => updateEtf(i, 'name', v.target.value)} className="bg-transparent font-bold text-white outline-none"/></div>
                                <div className="flex gap-1"><button onClick={() => setActiveBuyId(activeBuyId === e.id ? null : e.id)} className="p-1 rounded bg-slate-800"><ShoppingCart size={14}/></button><button onClick={() => setExpandedEtfId(expandedEtfId === e.id ? null : e.id)} className="p-1 rounded bg-slate-800"><List size={14}/></button></div>
                            </div>
                            {activeBuyId === e.id && (<div className="mb-3 p-3 bg-emerald-900/20 rounded-lg"><div className="grid grid-cols-2 gap-2 mb-2"><input type="number" placeholder="股數" value={buyForm.shares} onChange={v => setBuyForm({...buyForm, shares: v.target.value})} className="bg-slate-900 p-1 rounded text-xs"/><input type="number" placeholder="單價" value={buyForm.price} onChange={v => setBuyForm({...buyForm, price: v.target.value})} className="bg-slate-900 p-1 rounded text-xs"/><input type="number" placeholder="融資額" value={buyForm.margin} onChange={v => setBuyForm({...buyForm, margin: v.target.value})} className="bg-slate-900 p-1 rounded text-xs"/><input type="date" value={buyForm.date} onChange={v => setBuyForm({...buyForm, date: v.target.value})} className="bg-slate-900 p-1 rounded text-xs"/></div><button onClick={() => { const s = Number(buyForm.shares), p = Number(buyForm.price), m = Number(buyForm.margin); if (!s || !p) return; const nEtfs = [...etfs]; const current = nEtfs[i]; const newLot = { id: Date.now().toString(), date: buyForm.date, shares: s, price: p, fee: Math.floor(s*p*BROKERAGE_RATE), margin: m }; const updatedLots = current.lots ? [...current.lots, newLot] : [newLot]; nEtfs[i] = recalculateEtfStats({ ...current, lots: updatedLots }); setEtfs(nEtfs); setBuyForm({ shares: '', price: '', date: '', margin: '' }); setActiveBuyId(null); }} className="w-full bg-emerald-600 text-xs py-1 rounded">確認</button></div>)}
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div><label className="text-slate-500">股數</label><div className="pt-1">{e.shares.toLocaleString()}</div></div>
                                <div><label className="text-slate-500">現價</label><input type="number" value={e.currentPrice} onChange={v => updateEtf(i, 'currentPrice', Number(v.target.value))} className="w-full bg-slate-800 rounded p-1 mt-1 border border-slate-700"/></div>
                                <div><label className="text-blue-300">總融資</label><div className="text-blue-300 pt-1">{formatMoney(e.marginLoanAmount)}</div></div>
                            </div>
                            {expandedEtfId === e.id && e.lots && (<div className="mt-3 space-y-1">{e.lots.map(l => (<div key={l.id} className="flex justify-between text-[10px] bg-slate-800 p-1 rounded"><span>{l.date} | {l.shares}股</span><span>{formatMoney(l.price)} (融:{formatMoney(l.margin||0)}) <button onClick={() => { const nEtfs = [...etfs]; const current = nEtfs[i]; if (!current.lots) return; const updatedLots = current.lots.filter(x => x.id !== l.id); nEtfs[i] = recalculateEtfStats({ ...current, lots: updatedLots }); setEtfs(nEtfs); }} className="text-red-500 ml-1">×</button></span></div>))}</div>)}
                        </div>
                    ))}
                    <button onClick={() => setEtfs([...etfs, { id: Date.now().toString(), name: '新標的', code: '', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'annual', payMonths: [1,4,7,10], category: 'dividend', marginLoanAmount: 0 }])} className="w-full py-2 border border-dashed border-slate-600 rounded-xl text-slate-500 hover:text-white transition-all">+ 新增標的</button>
                </div>
            </section>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-8 space-y-6">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-lg"><div className="text-slate-400 text-xs">年度淨流</div><div className={`text-2xl font-bold ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-blue-500 shadow-lg"><div className="text-slate-400 text-xs">總資產市值</div><div className="text-2xl font-bold">{formatMoney(totalValue)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-red-500 shadow-lg"><div className="text-slate-400 text-xs">總負債</div><div className="text-2xl font-bold">{formatMoney(totalDebt)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-orange-500 shadow-lg"><div className="text-slate-400 text-xs">維持率</div><div className="text-2xl font-bold">{maintenance === 999 ? "MAX" : maintenance.toFixed(1) + "%"}</div></div>
           </div>

           <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl overflow-x-auto">
             <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white"><Calendar className="text-blue-400"/> 每月現金流明細</h3>
             <table className="w-full text-sm text-left"><thead className="text-slate-500 bg-slate-900/50"><tr><th className="p-3">月份</th><th className="p-3">股息</th><th className="p-3">房貸</th><th className="p-3">信貸</th><th className="p-3">利息</th><th className="p-3">生活</th><th className="p-3">稅金</th><th className="p-3 text-right">淨流</th></tr></thead>
               <tbody>{monthlyFlows.map(r => (<tr key={r.month} className="border-b border-slate-700/50 hover:bg-slate-700/30"><td className="p-3 font-bold">{r.month}月</td><td className="p-3 text-emerald-400">{formatMoney(r.divIn)}</td><td className="p-3 text-red-400">{formatMoney(r.loanOut)}</td><td className="p-3 text-orange-400">{formatMoney(r.creditOut)}</td><td className="p-3 text-blue-300">{formatMoney(r.stockInt)}</td><td className="p-3 text-slate-400">{formatMoney(r.life)}</td><td className="p-3 text-purple-400">{formatMoney(r.tax)}</td><td className={`p-3 text-right font-bold ${r.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(r.net)}</td></tr>))}</tbody>
               <tfoot><tr className="bg-slate-900 font-black text-white"><td className="p-3">年度總計</td><td className="p-3 text-emerald-400">{formatMoney(totalDividend)}</td><td className="p-3 text-red-400">{formatMoney(totalMortgage)}</td><td className="p-3 text-orange-400">{formatMoney(totalCredit)}</td><td className="p-3 text-blue-300">{formatMoney(totalStockInterest)}</td><td className="p-3 text-slate-400">{formatMoney(totalLiving)}</td><td className="p-3 text-purple-400">{formatMoney(totalTax)}</td><td className={`p-3 text-right ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</td></tr></tfoot>
             </table>
           </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-white">⚙️ 系統設定</h3>
            <div className="space-y-4 text-sm">
                <div><label className="text-slate-400 block mb-1">Google Sheet CSV 連結 (更新行情用)</label><input type="text" value={cloudConfig.priceSourceUrl} onChange={e => setCloudConfig({...cloudConfig, priceSourceUrl: e.target.value})} className="w-full bg-slate-900 p-2 rounded border border-slate-600 outline-none focus:border-emerald-500" placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"/></div>
                <div><label className="text-slate-400">總投資預算</label><input type="number" value={allocation.totalFunds} onChange={e => setAllocation({...allocation, totalFunds: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded border border-slate-600 outline-none"/></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-slate-400">配息比例 %</label><input type="number" value={allocation.dividendRatio} onChange={e => setAllocation({...allocation, dividendRatio: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded border border-slate-600"/></div>
                    <div><label className="text-slate-400">避險比例 %</label><input type="number" value={allocation.hedgingRatio} onChange={e => setAllocation({...allocation, hedgingRatio: Number(e.target.value)})} className="w-full bg-slate-900 p-2 rounded border border-slate-600"/></div>
                </div>
                <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-300"><p>已連線 Firebase: portfolios / tony1006</p></div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full mt-6 py-2 bg-blue-600 rounded-lg font-bold">儲存並關閉</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
