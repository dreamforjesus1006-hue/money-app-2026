import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, CartesianGrid, XAxis, YAxis, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { Calculator, Activity, Upload, Download, RotateCcw, Settings, Loader2, TrendingUp, RefreshCw, PieChart as PieIcon, ShieldCheck, List, Trash2, X, ShoppingCart, ArrowUp, ArrowDown, Wifi, WifiOff, ChevronDown, ChevronUp, Calendar, CalendarDays, CheckCircle2, AlertTriangle, Plus, Trophy, Crown, Zap, Target, Swords, Coins, Wallet, MessageSquareText, BellRing, Search, LogIn, LogOut, Lock } from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';

// --- Firebase ---
const YOUR_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCM42AelwEWTC4R_V0sgF0FbomkoXdE4T0',
  authDomain: 'baozutang-finance.firebaseapp.com',
  projectId: 'baozutang-finance',
  storageBucket: 'baozutang-finance.firebasestorage.app',
  messagingSenderId: '674257527078',
  appId: '1:674257527078:web:80018b440a826c2ef061e7',
};
const COLLECTION_NAME = 'portfolios'; const DOCUMENT_ID = 'tony1006';
let app: any = null; let db: any = null;
try { app = getApps().length ? getApps()[0] : initializeApp(YOUR_FIREBASE_CONFIG); db = getFirestore(app); } catch (e) {}

// --- Interfaces ---
interface Lot { id: string; date: string; shares: number; price: number; fee?: number; margin?: number; type?: 'buy' | 'sell'; }
interface DividendEvent { id: string; year: number; name: string; exDate: string; payDate: string; amount: number; isActual: boolean; }
interface ETF { id: string; code?: string; name: string; shares: number; costPrice: number; currentPrice: number; dividendPerShare: number; dividendType?: 'annual' | 'per_period'; payMonths?: number[]; category: 'dividend' | 'hedging' | 'active'; marginLoanAmount?: number; marginInterestRate?: number; lots?: Lot[]; schedule?: DividendEvent[]; }
interface Loan { id: string; name: string; principal: number; rate1: number; rate1Months: number; rate2: number; totalMonths: number; paidMonths: number; gracePeriod: number; startDate?: string; type: string; }
interface StockLoan { principal: number; rate: number; maintenanceLimit?: number; }
interface CreditLoan { principal: number; rate: number; totalMonths: number; paidMonths: number; }
interface TaxStatus { salaryIncome: number; livingExpenses: number; dependents: number; hasSpouse: boolean; isDisabled: boolean; disabilityCount: number; dividendTaxableRatio: number; }
interface AllocationConfig { totalFunds: number; dividendRatio: number; hedgingRatio: number; activeRatio: number; }
type MonthlyRecords = Record<string, { livingExpense?: number; otherIncome?: number; isTaxable?: boolean; }>;

// --- Defaults ---
const APP_SCHEMA_VERSION = 95; const LOCAL_KEY = 'baozutang_local';
const DEFAULT_STOCK_LOAN: StockLoan = { rate: 2.56, principal: 0 };
const DEFAULT_GLOBAL_MARGIN: StockLoan = { rate: 4.5, principal: 0 };
const DEFAULT_CREDIT: CreditLoan = { rate: 4.05, totalMonths: 84, principal: 0, paidMonths: 0 };
const DEFAULT_TAX: TaxStatus = { salaryIncome: 589200, livingExpenses: 70000, hasSpouse: true, isDisabled: true, dependents: 0, disabilityCount: 1, dividendTaxableRatio: 30 };
const DEFAULT_ALLOC: AllocationConfig = { activeRatio: 5, hedgingRatio: 15, dividendRatio: 80, totalFunds: 14500000 };
const BROKERAGE_RATE = 0.001425; const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#a855f7' };
const fmtTwd0 = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const formatMoney = (val: any) => `$${fmtTwd0.format(Math.round(Number(val) || 0))}`;
const safeNum = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;

// --- Utils ---
const calculateIncomeTax = (salary: number, dividend: number, otherTaxable: number, status: TaxStatus) => {
  const exemption = 97000 * (1 + (status.hasSpouse ? 1 : 0) + status.dependents);
  const stdDed = status.hasSpouse ? 262000 : 131000;
  const totalDeductions = exemption + stdDed + Math.min(salary, 218000) + (218000 * (status.disabilityCount || (status.isDisabled ? 1 : 0)));
  const taxableDividend = Math.floor(dividend * ((status.dividendTaxableRatio ?? 30) / 100));
  const netTaxableIncome = Math.max(0, salary + taxableDividend + otherTaxable - totalDeductions);
  let grossTax = netTaxableIncome <= 610000 ? netTaxableIncome * 0.05 : netTaxableIncome <= 1380000 ? netTaxableIncome * 0.12 - 42700 : netTaxableIncome <= 2660000 ? netTaxableIncome * 0.2 - 153100 : netTaxableIncome * 0.3 - 419100;
  return Math.max(0, Math.floor(grossTax - Math.min(80000, taxableDividend * 0.085)));
};

const calculateLoanPayment = (loan: Loan, dynamicPaid: number) => {
  const p = safeNum(loan.principal); const grace = safeNum(loan.gracePeriod); const tMonths = safeNum(loan.totalMonths);
  if (p <= 0 || dynamicPaid >= tMonths) return 0;
  if (dynamicPaid < grace) return Math.floor(p * (safeNum(loan.rate1) / 100 / 12));
  const r = (dynamicPaid < safeNum(loan.rate1Months) ? safeNum(loan.rate1) : safeNum(loan.rate2)) / 100 / 12;
  const amort = Math.max(1, tMonths - grace);
  return r === 0 ? Math.floor(p / amort) : Math.floor((p * r * Math.pow(1 + r, amort)) / (Math.pow(1 + r, amort) - 1));
};

const recalculateEtfStats = (etf: ETF): ETF => {
  let [tShares, tCost, tMargin] = [0, 0, 0];
  [...(etf.lots || [])].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(lot => {
    const isSell = lot.type === 'sell' || lot.shares < 0; const absS = Math.abs(lot.shares);
    if (isSell) { const avgCost = tShares > 0 ? (tCost / tShares) : 0; tShares -= absS; tCost -= absS * avgCost; tMargin -= Math.abs(lot.margin || 0); }
    else { tShares += absS; tCost += (absS * lot.price) + (lot.fee || 0); tMargin += Math.abs(lot.margin || 0); }
  });
  return { ...etf, shares: Math.max(0, tShares), costPrice: tShares > 0 ? Number((tCost / tShares).toFixed(2)) : 0, marginLoanAmount: Math.max(0, tMargin) };
};

const StorageService = {
  saveData: async (data: any) => {
    const payload = { ...data, _meta: { schema: APP_SCHEMA_VERSION, updatedAt: Date.now() } };
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(payload)); } catch (e) {}
    let cloudOk = false;
    if (db) { try { await setDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID), payload, { merge: true }); cloudOk = true; } catch (e) {} }
    return { cloudOk };
  },
  loadData: async () => {
    const local = (() => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)||''); } catch(e){return null} })();
    let cloud: any = null;
    if (db) { try { const snap = await getDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID)); cloud = snap.exists() ? snap.data() : null; } catch (e) {} }
    const picked = (safeNum(cloud?._meta?.updatedAt) >= safeNum(local?._meta?.updatedAt) ? cloud : local) || null;
    if (!picked) return { data: null, source: 'none' };
    picked.etfs = (picked.etfs || []).map((e:any)=>({...e, schedule: (e.schedule||[]).map((ev:any)=>({...ev, year: ev.year || parseInt(ev.payDate?.split('-')[0]||'2026')}))}));
    return { data: picked, source: picked === cloud ? 'cloud' : 'local' };
  }
};

// ==========================================
// 主程式 Component
// ==========================================
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dataSrc, setDataSrc] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [isScanningTwse, setIsScanningTwse] = useState(false);
  
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stockLoan, setStockLoan] = useState<StockLoan>(DEFAULT_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(DEFAULT_GLOBAL_MARGIN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(DEFAULT_CREDIT);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(DEFAULT_TAX);
  const [allocation, setAllocation] = useState<AllocationConfig>(DEFAULT_ALLOC);
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(DEFAULT_CLOUD);
  const [actualDetails, setActualDetails] = useState<Record<string,number>>({});
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecords>({});
  const [reinvest, setReinvest] = useState(true);
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [txForm, setTxForm] = useState({ type: 'buy', shares: '', price: '', date: '', margin: '' });
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [showCalendar, setShowCalendar] = useState<string | null>(null);

  // --- Auth Check ---
  useEffect(() => {
    if (!app) { setIsCheckingAuth(false); return; }
    const _auth = getAuth(app);
    return onAuthStateChanged(_auth, async (u) => {
      if (u) {
        if (u.email !== 'dreamforjesus1006@gmail.com') { alert('未授權存取！'); await signOut(_auth); setUser(null); } 
        else { setUser(u); }
      } else { setUser(null); }
      setIsCheckingAuth(false);
    });
  }, []);

  // --- Load/Save Data ---
  useEffect(() => {
    if (!user) return;
    StorageService.loadData().then((res) => {
      setDataSrc(res.source);
      if (res.data) {
        setEtfs(res.data.etfs || []); setLoans(res.data.loans || []); setStockLoan(res.data.stockLoan || DEFAULT_STOCK_LOAN);
        setGlobalMarginLoan(res.data.globalMarginLoan || DEFAULT_GLOBAL_MARGIN); setCreditLoan(res.data.creditLoan || DEFAULT_CREDIT);
        setTaxStatus(res.data.taxStatus || DEFAULT_TAX); setAllocation(res.data.allocation || DEFAULT_ALLOC);
        setCloudConfig(res.data.cloudConfig || DEFAULT_CLOUD); setActualDetails(res.data.actualDetails || {}); setMonthlyRecords(res.data.monthlyRecords || {});
      }
      setIsInitializing(false);
    });
  }, [user]);

  useEffect(() => {
    if (isInitializing || !user) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      try {
        const res = await StorageService.saveData({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, actualDetails, monthlyRecords });
        setDataSrc(res.cloudOk ? 'cloud' : 'local'); setSaveStatus(res.cloudOk ? 'saved' : 'error'); setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) { setSaveStatus('error'); }
    }, 1200);
    return () => clearTimeout(t);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, actualDetails, monthlyRecords, isInitializing, user]);

  // --- Flow Engine ---
  const monthlyFlows = useMemo(() => {
    const flows = [];
    let annualDivProj = 0;
    etfs.forEach(e => { const evs = e.schedule?.filter(ev => ev.year === selectedYear) || []; if (evs.length > 0) evs.forEach(ev => annualDivProj += safeNum(e.shares) * ev.amount); else annualDivProj += safeNum(e.shares) * safeNum(e.dividendPerShare) * (e.dividendType === 'annual' ? 1 : (e.payMonths?.length || 0)); });
    let annualOtherTaxable = Array.from({length:12}).reduce((acc:number,_,i) => acc + (monthlyRecords[`${selectedYear}_${i+1}`]?.isTaxable ? safeNum(monthlyRecords[`${selectedYear}_${i+1}`]?.otherIncome) : 0), 0);
    const monthlyIncomeTax = calculateIncomeTax(safeNum(taxStatus.salaryIncome), annualDivProj, annualOtherTaxable, taxStatus) / 12;

    for (let m = 1; m <= 12; m++) {
      let [divProj, divActual] = [0, 0]; const details: any[] = [];
      etfs.forEach(e => {
        let evs = e.schedule?.filter(ev => ev.year === selectedYear) || [];
        if (evs.length > 0) {
          evs.forEach(ev => {
            if (parseInt(ev.payDate?.split('-')[1] || '0') === m) {
              const exT = new Date(ev.exDate).getTime(); let qualS = 0;
              (e.lots||[]).forEach(l => { if (isNaN(exT) || new Date(l.date).getTime() < exT) qualS += (l.type==='sell'?-1:1)*Math.abs(l.shares); });
              const proj = Math.floor(Math.max(0, qualS) * ev.amount); divProj += proj;
              const act = safeNum(actualDetails[`${selectedYear}_${m}_${e.id}`]); divActual += act;
              details.push({ id: e.id, name: e.name, amt: proj, qualS: Math.max(0,qualS), totS: safeNum(e.shares), ex: ev.exDate||'未填', act });
            }
          });
        } else if (e.payMonths?.includes(m)) {
          const payout = safeNum(e.dividendPerShare) / (e.dividendType==='annual' && e.payMonths.length>0 ? e.payMonths.length : 1);
          let qualS = 0; (e.lots||[]).forEach(l => { const ld = new Date(l.date); if(isNaN(ld.getTime()) || ld.getFullYear()<selectedYear || (ld.getFullYear()===selectedYear && ld.getMonth()+1<=m)) qualS += (l.type==='sell'?-1:1)*Math.abs(l.shares); });
          const proj = Math.floor(Math.max(0,qualS) * payout); divProj += proj;
          const act = safeNum(actualDetails[`${selectedYear}_${m}_${e.id}`]); divActual += act;
          details.push({ id: e.id, name: e.name, amt: proj, qualS: Math.max(0,qualS), totS: safeNum(e.shares), ex: '預估', act });
        }
      });
      const healthTax = Math.floor(divProj * 0.0211);
      let loanOut = 0; loans.forEach(l => { const st = l.startDate ? new Date(l.startDate) : new Date(); const dyn = Math.max(0, safeNum(l.paidMonths) + (selectedYear - st.getFullYear())*12 + (m - (st.getMonth()+1))); loanOut += calculateLoanPayment(l, dyn); });
      const dynCred = Math.max(0, safeNum(creditLoan.paidMonths) + (selectedYear - new Date().getFullYear())*12 + (m - (new Date().getMonth()+1)));
      const cRate = safeNum(creditLoan.rate)/100/12; const credOut = cRate===0 ? 0 : (dynCred < safeNum(creditLoan.totalMonths) ? Math.floor((safeNum(creditLoan.principal)*cRate*Math.pow(1+cRate,safeNum(creditLoan.totalMonths)))/(Math.pow(1+cRate,safeNum(creditLoan.totalMonths))-1)) : 0);
      let marginInt = 0; etfs.forEach(e => { let aMargin = 0; (e.lots||[]).forEach(l => { const ld = new Date(l.date); if(isNaN(ld.getTime()) || ld.getFullYear()<selectedYear || (ld.getFullYear()===selectedYear && ld.getMonth()+1<=m)) aMargin += (l.type==='sell'?-1:1)*Math.abs(l.margin||0); }); marginInt += Math.max(0,aMargin) * (safeNum(e.marginInterestRate,6.5)/100)/12; });
      const stockIntTotal = Math.floor((safeNum(stockLoan.principal)*safeNum(stockLoan.rate)/100)/12) + Math.floor((safeNum(globalMarginLoan.principal)*safeNum(globalMarginLoan.rate)/100)/12) + Math.floor(marginInt);
      const rec = monthlyRecords[`${selectedYear}_${m}`] || {}; const life = rec.livingExpense !== undefined ? safeNum(rec.livingExpense) : safeNum(taxStatus.livingExpenses);
      flows.push({ month: m, otherInc: safeNum(rec.otherIncome), divProj, divActual, loanOut, creditOut: credOut, stockInt: stockIntTotal, life, isActualLife: rec.livingExpense!==undefined, budgetLife: safeNum(taxStatus.livingExpenses), healthTax: divActual>0?0:healthTax, incomeTax: monthlyIncomeTaxImpact, net: (divActual>0?divActual:divProj-healthTax) + safeNum(rec.otherIncome) - loanOut - credOut - stockIntTotal - life - (divActual>0?0:healthTax) - monthlyIncomeTaxImpact, details });
    }
    return flows;
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, actualDetails, monthlyRecords, selectedYear]);

  // --- UI Variables ---
  const tDiv = monthlyFlows.reduce((a, b) => a + (b.divActual > 0 ? b.divActual : b.divProj * 0.9789), 0);
  const tOut = monthlyFlows.reduce((a, b) => a + b.loanOut + b.creditOut + b.stockInt + b.life + b.healthTax + b.incomeTax, 0);
  const tNet = tDiv + monthlyFlows.reduce((a, b) => a + b.otherInc, 0) - tOut;
  const tVal = etfs.reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice), 0);
  const tDebt = safeNum(stockLoan.principal) + safeNum(globalMarginLoan.principal) + etfs.reduce((a, e) => a + safeNum(e.marginLoanAmount), 0);
  const maint = tDebt === 0 ? 999 : (tVal / tDebt) * 100;
  const fRatio = tOut > 0 ? (tDiv / tOut) * 100 : 0;
  const rank = fRatio>=100?'財富神祇 🌟':fRatio>=60?'財富國王 👑':fRatio>=30?'資產領主 🏰':fRatio>=10?'築基騎士 ⚔️':'理財新手 🌱';
  const grade = fRatio>=80&&maint>=160&&tNet>0?'SSS':fRatio>=50&&maint>=140?'S':fRatio>=30&&maint>=130?'A':fRatio>=10?'B':'C';

  // --- Handlers ---
  const handleUpdatePrices = async () => {
    if (!cloudConfig.priceSourceUrl) return; setIsUpdatingPrices(true);
    try {
      const res = await fetch(cloudConfig.priceSourceUrl.includes('/edit') ? cloudConfig.priceSourceUrl.replace(/\/edit.*$/, '/export?format=csv') : cloudConfig.priceSourceUrl);
      const text = await res.text(); const map = new Map();
      text.split(/\r?\n/).forEach(r => { const c = r.split(',').map(x=>x.trim()); if(c.length>=2&&c[0]!=='code') map.set(c[0],{p:parseFloat(c[1]), d:parseFloat(c[2]), ex:c[3], pay:c[4]}); });
      setEtfs(prev => prev.map(e => { const info = map.get(e.code||e.id); return info ? {...e, currentPrice: info.p, dividendPerShare: isNaN(info.d)?e.dividendPerShare:info.d} : e; }));
      alert('行情更新成功！');
    } catch(e) { alert('更新失敗'); } finally { setIsUpdatingPrices(false); }
  };

  const handleScanTWSE = async () => {
    setIsScanningTwse(true);
    try {
      let data = null;
      for (const p of [{url:`https://openapi.twse.com.tw/v1/exchangeReport/TWT49U`, parse: async(r:any)=>r.json()}, {url:`https://api.allorigins.win/get?url=${encodeURIComponent('https://openapi.twse.com.tw/v1/exchangeReport/TWT49U')}`, parse: async(r:any)=>JSON.parse((await r.json()).contents)}]) {
        try { const res = await fetch(p.url, {cache:'no-store'}); if(res.ok) { data = await p.parse(res); if(Array.isArray(data)) break; } } catch(e){}
      }
      if(!data) throw new Error('API Blocked');
      let c = 0;
      setEtfs(prev => prev.map(e => {
        const m = data.find((d:any)=>d.Code===e.code); if(!m||!m.Date) return e;
        const exD = `${parseInt(m.Date.substring(0,3))+1911}-${m.Date.substring(3,5)}-${m.Date.substring(5,7)}`; const amt = parseFloat(m.Dividend||'0');
        if(amt===0) return e;
        let sch = [...(e.schedule||[])]; const idx = sch.findIndex(x=>x.exDate===exD);
        if(idx>=0) sch[idx].amount = amt; else sch.push({id:`auto-${Date.now()}`, year:parseInt(exD.split('-')[0]), name:'TWSE同步', exDate:exD, payDate:'', amount:amt, isActual:false});
        c++; return {...e, schedule:sch, dividendPerShare:amt};
      }));
      alert(`成功同步 ${c} 檔除息資料。`);
    } catch(e) { alert('連線失敗，請手動更新CSV。'); } finally { setIsScanningTwse(false); }
  };

  if (isCheckingAuth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-400"><Loader2 className="animate-spin mr-2"/> 身份驗證中...</div>;
  if (!user) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900/80 p-10 rounded-3xl shadow-2xl w-full max-w-md text-center border border-slate-800"><Calculator size={56} className="text-emerald-400 mx-auto mb-6"/><h1 className="text-3xl font-black text-emerald-400 mb-8">包租唐戰情室 V95</h1><button onClick={async()=>{try{await signInWithPopup(getAuth(app), new GoogleAuthProvider());}catch(e){}}} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2"><Lock size={18}/> 管理員 Google 登入</button></div>
    </div>
  );
  if (isInitializing) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-400"><Loader2 className="animate-spin mr-2"/> 載入戰情資料...</div>;

  const topCards = [
    { title: '年度淨流', val: formatMoney(tNet), icon: Wallet, color: tNet>=0?'text-emerald-400':'text-red-400', border: 'border-emerald-500' },
    { title: '總資產', val: formatMoney(tVal), icon: Crown, color: 'text-slate-100', border: 'border-blue-500' },
    { title: '總負債', val: formatMoney(tDebt), icon: AlertTriangle, color: 'text-slate-100', border: 'border-red-500' },
    { title: '股息 Cover率', val: `${tOut>0?((tDiv/tOut)*100).toFixed(1):0}%`, icon: ShieldCheck, color: 'text-orange-400', border: 'border-orange-500' }
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-950 text-white font-sans">
      <header className="mb-6 border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-emerald-400 flex items-center gap-2"><Calculator/> 包租唐戰情室 V95</h1>
          <div className="text-xs mt-2 text-slate-500 flex gap-2"><span className="bg-slate-800 px-2 py-1 rounded-full">{saveStatus==='saving'?'儲存中...':saveStatus==='saved'?'已同步':dataSrc}</span></div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleUpdatePrices} className="p-2 bg-slate-800 rounded-lg text-emerald-400 hover:bg-slate-700"><RefreshCw size={18} className={isUpdatingPrices?"animate-spin":""}/></button>
          <button onClick={()=>setShowSettings(true)} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700"><Settings size={18}/></button>
          <button onClick={async()=>{await signOut(getAuth(app));}} className="p-2 bg-slate-800 rounded-lg text-red-400 hover:bg-slate-700 ml-2"><LogOut size={18}/></button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-3xl border border-slate-700">🧑‍🌾</div>
              <div className="flex-1"><div className="text-[10px] text-slate-400">主線任務</div><div className="text-2xl font-black text-emerald-400">{rank}</div></div>
              <div className="text-right"><div className="text-[10px] text-slate-400">評級</div><div className="text-4xl font-black text-yellow-400 italic">{grade}</div></div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div><div className="text-[9px] text-slate-500">年息</div><div className="text-emerald-400 text-xs font-bold">{formatMoney(tDiv)}</div></div>
              <div><div className="text-[9px] text-slate-500">維持率</div><div className="text-blue-400 text-xs font-bold">{maint===999?'MAX':maint.toFixed(0)+'%'}</div></div>
              <div><div className="text-[9px] text-slate-500">月淨流</div><div className="text-emerald-400 text-xs font-bold">{formatMoney(tNet/12)}</div></div>
              <div><div className="text-[9px] text-slate-500">日產金</div><div className="text-yellow-400 text-xs font-bold">{formatMoney(tDiv/365)}</div></div>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <div className="flex justify-between items-center mb-4"><h2 className="font-bold text-emerald-400 flex items-center gap-2"><Activity size={16}/> 裝備庫 (ETF)</h2><button onClick={()=>setEtfs(p=>[...p,{id:Date.now().toString(),name:'新標的',shares:0,costPrice:0,currentPrice:0,dividendPerShare:0,category:'dividend'}])} className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded flex items-center"><Plus size={12}/> 新增</button></div>
            <div className="space-y-4">
              {etfs.map((e, idx) => (
                <div key={e.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 group">
                  <div className="flex justify-between mb-3">
                    <div className="flex gap-2 w-2/3"><input value={e.code||''} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,code:v.target.value}:x))} className="w-16 bg-slate-900 text-xs p-1 rounded outline-none" placeholder="代號"/><input value={e.name} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,name:v.target.value}:x))} className="w-full bg-transparent font-bold text-white outline-none"/></div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={()=>setEtfs(p=>{const n=[...p]; if(idx>0){[n[idx],n[idx-1]]=[n[idx-1],n[idx]]} return n;})}><ArrowUp size={14}/></button><button onClick={()=>setEtfs(p=>p.filter(x=>x.id!==e.id))} className="text-red-500"><Trash2 size={14}/></button></div>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-800 pt-2 mb-2">
                    <select value={e.category} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,category:v.target.value as any}:x))} className="bg-slate-900 text-xs text-blue-400 p-1 rounded outline-none"><option value="dividend">配息型</option><option value="hedging">避險型</option><option value="active">主動型</option></select>
                    <div className="flex gap-1"><button onClick={()=>setShowCalendar(showCalendar===e.id?null:e.id)} className={`p-1.5 rounded ${showCalendar===e.id?'bg-emerald-600':'bg-slate-900'}`}><CalendarDays size={14}/></button><button onClick={()=>setActiveTxId(activeTxId===e.id?null:e.id)} className={`p-1.5 rounded ${activeTxId===e.id?'bg-blue-600':'bg-slate-900'}`}><Wallet size={14}/></button><button onClick={()=>setExpandedEtfId(expandedEtfId===e.id?null:e.id)} className={`p-1.5 rounded ${expandedEtfId===e.id?'bg-purple-600':'bg-slate-900'}`}><List size={14}/></button></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-900 p-2 rounded"><div><div className="text-slate-500 text-[9px]">總股數</div><div>{safeNum(e.shares).toLocaleString()}</div></div><div><div className="text-slate-500 text-[9px]">現價</div><input type="number" value={e.currentPrice} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,currentPrice:safeNum(v.target.value)}:x))} className="w-full bg-slate-950 p-1 rounded outline-none"/></div><div><div className="text-slate-500 text-[9px]">配息</div><input type="number" value={e.dividendPerShare} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,dividendPerShare:safeNum(v.target.value)}:x))} className="w-full bg-slate-950 p-1 rounded outline-none"/></div></div>
                  
                  {activeTxId === e.id && (
                    <div className="mt-3 p-3 bg-slate-900 border border-blue-900/50 rounded-xl">
                      <div className="flex gap-2 mb-2"><button onClick={()=>setTxForm({...txForm, type:'buy'})} className={`flex-1 py-1 text-xs rounded ${txForm.type==='buy'?'bg-blue-600':'bg-slate-950'}`}>買進</button><button onClick={()=>setTxForm({...txForm, type:'sell'})} className={`flex-1 py-1 text-xs rounded ${txForm.type==='sell'?'bg-orange-600':'bg-slate-950'}`}>賣出</button></div>
                      <div className="grid grid-cols-2 gap-2 mb-2"><input type="number" placeholder="股數" value={txForm.shares} onChange={v=>setTxForm({...txForm, shares:v.target.value})} className="bg-slate-950 p-1.5 text-xs rounded outline-none"/><input type="number" placeholder="單價" value={txForm.price} onChange={v=>setTxForm({...txForm, price:v.target.value})} className="bg-slate-950 p-1.5 text-xs rounded outline-none"/><input type="number" placeholder="融資" value={txForm.margin} onChange={v=>setTxForm({...txForm, margin:v.target.value})} className="bg-slate-950 p-1.5 text-xs rounded outline-none"/><input type="date" value={txForm.date} onChange={v=>setTxForm({...txForm, date:v.target.value})} className="bg-slate-950 p-1.5 text-xs rounded outline-none"/></div>
                      <button onClick={()=>{const s=safeNum(txForm.shares),p=safeNum(txForm.price),m=safeNum(txForm.margin); if(!s||!p)return; setEtfs(prev=>{const n=[...prev]; n[idx]=recalculateEtfStats({...n[idx],lots:[...(n[idx].lots||[]), {id:Date.now().toString(),date:txForm.date||new Date().toISOString().split('T')[0],shares:txForm.type==='sell'?-s:s,price:p,margin:txForm.type==='sell'?-m:m,type:txForm.type as any}]}); return n;}); setTxForm({type:'buy',shares:'',price:'',date:'',margin:''}); setActiveTxId(null);}} className="w-full py-1.5 bg-blue-600 text-xs rounded font-bold">確認交易</button>
                    </div>
                  )}

                  {expandedEtfId === e.id && (
                    <div className="mt-2 space-y-1">{e.lots?.map(l=><div key={l.id} className="flex justify-between text-[10px] bg-slate-900 p-1.5 rounded"><span className={l.type==='sell'?'text-orange-400':'text-emerald-400'}>{l.type==='sell'?'賣':'買'} {Math.abs(l.shares)}股</span><span>${l.price} <button onClick={()=>setEtfs(p=>p.map((x,i)=>i===idx?recalculateEtfStats({...x,lots:(x.lots||[]).filter(y=>y.id!==l.id)}):x))} className="text-red-500 ml-2">x</button></span></div>)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {topCards.map((c, i) => (
              <div key={i} className={`bg-slate-900 p-4 rounded-2xl border-l-4 ${c.border} shadow-lg relative overflow-hidden group`}>
                <div className={`absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform ${c.color}`}><c.icon size={64}/></div>
                <div className="text-slate-400 text-[10px] font-bold mb-1">{c.title}</div>
                <div className={`text-2xl font-black font-mono ${c.color}`}>{c.val}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl overflow-x-auto">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-emerald-400 flex items-center gap-2"><Calendar size={18}/> {selectedYear} 戰術對帳面板</h3><div className="flex items-center gap-2 bg-slate-950 rounded-lg p-1 border border-slate-800"><button onClick={()=>setSelectedYear(y=>y-1)} className="px-2 text-slate-500">◀</button><span className="font-black text-emerald-400">{selectedYear}</span><button onClick={()=>setSelectedYear(y=>y+1)} className="px-2 text-slate-500">▶</button></div></div>
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 bg-slate-950/80"><tr><th className="p-3">月份</th><th className="p-3">額外入帳</th><th className="p-3">預估息</th><th className="p-3 text-emerald-400">實領息</th><th className="p-3">落差</th><th className="p-3">房/信貸/維持息</th><th className="p-3">生活費</th><th className="p-3 text-right">結算淨流</th></tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {monthlyFlows.map(r => (
                  <React.Fragment key={r.month}>
                    <tr onClick={()=>setExpandedMonth(expandedMonth===r.month?null:r.month)} className="hover:bg-slate-800/30 font-mono cursor-pointer">
                      <td className="p-3 font-bold">{r.month}月</td>
                      <td className="p-3 text-blue-400">{r.otherInc>0?formatMoney(r.otherInc):'-'}</td>
                      <td className="p-3 text-slate-500">{formatMoney(r.divProj)}</td>
                      <td className="p-3 text-emerald-400 font-bold">{r.divActual>0?formatMoney(r.divActual):'-'}</td>
                      <td className="p-3">{r.divActual>0?formatMoney(r.divActual-r.divProj):'-'}</td>
                      <td className="p-3 text-red-400">{formatMoney(r.loanOut+r.creditOut+r.stockInt)}</td>
                      <td className="p-3">{r.isActualLife?<span className="text-yellow-400">{formatMoney(r.life)}</span>:<span className="text-slate-500">{formatMoney(r.life)}</span>}</td>
                      <td className={`p-3 text-right font-bold ${r.net>=0?'text-emerald-400':'text-red-400'}`}>{formatMoney(r.net)}</td>
                    </tr>
                    {expandedMonth === r.month && (
                      <tr className="bg-slate-950/50"><td colSpan={8} className="p-4"><div className="grid grid-cols-2 gap-4 mb-4"><div><label className="text-[10px] text-yellow-500 block mb-1">實際生活費</label><input type="number" value={monthlyRecords[`${selectedYear}_${r.month}`]?.livingExpense??''} onChange={e=>setMonthlyRecords(p=>({...p, [`${selectedYear}_${r.month}`]:{...(p[`${selectedYear}_${r.month}`]||{}), livingExpense:e.target.value===''?undefined:safeNum(e.target.value)}}))} className="w-full bg-slate-900 p-2 rounded outline-none border border-slate-700 focus:border-yellow-500"/></div><div><label className="text-[10px] text-blue-400 block mb-1">額外收入</label><input type="number" value={monthlyRecords[`${selectedYear}_${r.month}`]?.otherIncome??''} onChange={e=>setMonthlyRecords(p=>({...p, [`${selectedYear}_${r.month}`]:{...(p[`${selectedYear}_${r.month}`]||{}), otherIncome:e.target.value===''?undefined:safeNum(e.target.value)}}))} className="w-full bg-slate-900 p-2 rounded outline-none border border-slate-700 focus:border-blue-500"/></div></div><div className="space-y-2">{r.details.map((d:any,i:number)=><div key={i} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800"><div><span className="text-sm font-bold text-slate-200">{d.name}</span> <span className="text-[9px] text-slate-500 ml-2">預: {formatMoney(d.amt)}</span></div><div className="flex items-center gap-2"><span className="text-[10px] text-emerald-500">實入帳</span><input type="number" value={d.act||''} onChange={e=>setActualDetails(p=>({...p, [`${selectedYear}_${r.month}_${d.id}`]:safeNum(e.target.value)}))} className="w-20 bg-slate-950 border-b border-emerald-900 text-emerald-400 text-right p-1 outline-none font-mono"/></div></div>)}</div></td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <h3 className="text-xl font-bold mb-4 text-emerald-400">系統參數設定</h3>
            <div className="grid grid-cols-2 gap-4 text-xs mb-4">
               <div className="bg-slate-950 p-3 rounded-lg"><label className="text-slate-400 block mb-1">預設生活費</label><input type="number" value={taxStatus.livingExpenses} onChange={e=>setTaxStatus({...taxStatus, livingExpenses:safeNum(e.target.value)})} className="w-full bg-slate-900 p-2 rounded border border-slate-800 outline-none"/></div>
               <div className="bg-slate-950 p-3 rounded-lg"><label className="text-slate-400 block mb-1">ETF 應稅比例(%)</label><input type="number" value={taxStatus.dividendTaxableRatio} onChange={e=>setTaxStatus({...taxStatus, dividendTaxableRatio:safeNum(e.target.value)})} className="w-full bg-slate-900 p-2 rounded border border-slate-800 outline-none"/></div>
            </div>
            <div className="mb-4 bg-slate-950 p-4 rounded-lg">
                <h4 className="text-red-400 font-bold mb-2 flex justify-between">房貸設定 <button onClick={()=>setLoans(p=>[...p,{id:Date.now().toString(),name:'新房貸',principal:0,rate1:2.1,rate1Months:36,rate2:2.3,totalMonths:360,paidMonths:0,gracePeriod:0,type:'PrincipalAndInterest'}])} className="text-[10px] bg-red-900/50 px-2 py-1 rounded">+ 新增</button></h4>
                {loans.map((l,i)=><div key={l.id} className="grid grid-cols-4 gap-2 mb-2 bg-slate-900 p-2 rounded"><input value={l.name} onChange={e=>setLoans(p=>{const n=[...p];n[i].name=e.target.value;return n;})} className="bg-slate-950 p-1 outline-none rounded" placeholder="名稱"/><input type="number" value={l.principal} onChange={e=>setLoans(p=>{const n=[...p];n[i].principal=safeNum(e.target.value);return n;})} className="bg-slate-950 p-1 outline-none rounded" placeholder="本金"/><input type="date" value={l.startDate||''} onChange={e=>setLoans(p=>{const n=[...p];const d=new Date(e.target.value); n[i].startDate=e.target.value; n[i].paidMonths=isNaN(d.getTime())?0:Math.max(0,(new Date().getFullYear()-d.getFullYear())*12+(new Date().getMonth()-d.getMonth()));return n;})} className="bg-slate-950 p-1 outline-none rounded"/><button onClick={()=>setLoans(p=>p.filter(x=>x.id!==l.id))} className="text-red-500">刪除</button></div>)}
            </div>
            <button onClick={()=>setShowSettings(false)} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold">儲存並返回</button>
          </div>
        </div>
      )}
    </div>
  );
}
