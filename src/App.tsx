import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, CartesianGrid, XAxis, YAxis, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { Calculator, Activity, Upload, Download, RotateCcw, Settings, Loader2, TrendingUp, RefreshCw, ShieldCheck, List, Trash2, X, ShoppingCart, ArrowUp, ArrowDown, Wifi, WifiOff, ChevronDown, ChevronUp, Calendar, CalendarDays, CheckCircle2, AlertTriangle, Plus, Trophy, Crown, Target, Wallet, MessageSquareText, BellRing, Lock, LogOut } from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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
interface CloudConfig { priceSourceUrl: string; enabled: boolean; }
interface FixedExp { id: string; name: string; amount: number; }
interface MonthlyRecord { livingExpense?: number; otherIncome?: number; isTaxable?: boolean; }
type MonthlyRecords = Record<string, MonthlyRecord>;

type PersistedPayload = {
  etfs: ETF[]; loans: Loan[]; stockLoan: StockLoan; creditLoan: CreditLoan; globalMarginLoan: StockLoan;
  taxStatus: TaxStatus; allocation: AllocationConfig; cloudConfig: CloudConfig; fixedExps: FixedExp[];
  actualDetails: Record<string, number>; monthlyRecords?: MonthlyRecords; _meta?: { schema: number; updatedAt: number };
};

// --- Defaults ---
const APP_SCHEMA_VERSION = 100; const LOCAL_KEY = 'baozutang_local';
const DEFAULT_STOCK_LOAN: StockLoan = { rate: 2.56, principal: 0 };
const DEFAULT_GLOBAL_MARGIN: StockLoan = { rate: 4.5, principal: 0 };
const DEFAULT_CREDIT: CreditLoan = { rate: 4.05, totalMonths: 84, principal: 0, paidMonths: 0 };
const DEFAULT_TAX: TaxStatus = { salaryIncome: 589200, livingExpenses: 70000, hasSpouse: true, isDisabled: true, dependents: 0, disabilityCount: 1, dividendTaxableRatio: 30 };
const DEFAULT_ALLOC: AllocationConfig = { activeRatio: 5, hedgingRatio: 15, dividendRatio: 80, totalFunds: 14500000 };
const DEFAULT_CLOUD: CloudConfig = { priceSourceUrl: '', enabled: true };
const BROKERAGE_RATE = 0.001425; const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#a855f7' };

const fmtTwd0 = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const formatMoney = (val: any) => `$${fmtTwd0.format(Math.round(Number(val) || 0))}`;
const safeNum = (v: any, fallback = 0): number => Number.isFinite(Number(v)) ? Number(v) : fallback;
const toTime = (s: string) => { const t = new Date(s).getTime(); return Number.isFinite(t) ? t : NaN; };

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

const generateCashFlow = (etfs: ETF[], loans: Loan[], stockLoan: StockLoan, creditLoan: CreditLoan, globalMarginLoan: StockLoan, taxStatus: TaxStatus, fixedExps: FixedExp[], actualDetails: Record<string,number>, monthlyRecords: MonthlyRecords, selectedYear: number) => {
  const flows: any[] = [];
  const annualSalaryForTax = safeNum(taxStatus.salaryIncome);
  let annualDividendProjected = 0;

  etfs.forEach(e => {
    const yearEvents = e.schedule?.filter(ev => ev.year === selectedYear) || [];
    if (yearEvents.length > 0) yearEvents.forEach(ev => annualDividendProjected += safeNum(e.shares) * ev.amount);
    else annualDividendProjected += safeNum(e.shares) * safeNum(e.dividendPerShare) * (e.dividendType === 'annual' ? 1 : (e.payMonths?.length || 0));
  });

  let annualOtherTaxable = 0;
  for (let m = 1; m <= 12; m++) {
    const rec = monthlyRecords[`${selectedYear}_${m}`];
    if (rec?.otherIncome && rec?.isTaxable) annualOtherTaxable += rec.otherIncome;
  }

  const annualIncomeTax = calculateIncomeTax(annualSalaryForTax, annualDividendProjected, annualOtherTaxable, taxStatus);
  const monthlyIncomeTaxImpact = annualIncomeTax / 12;
  const globalFixedOut = fixedExps.reduce((sum, f) => sum + safeNum(f.amount), 0);

  for (let m = 1; m <= 12; m++) {
    let divInProjected = 0; let divActualTotal = 0; const details: any[] = [];
    etfs.forEach(e => {
      let evs = e.schedule?.filter(ev => ev.year === selectedYear) || [];
      if (evs.length > 0) {
        evs.forEach(ev => {
          if (parseInt(ev.payDate?.split('-')[1] || '0') === m) {
            const exT = toTime(ev.exDate); let qualS = 0;
            (e.lots||[]).forEach(l => { if (isNaN(exT) || toTime(l.date) < exT) qualS += (l.type==='sell'?-1:1)*Math.abs(l.shares); });
            const proj = Math.floor(Math.max(0, qualS) * ev.amount); divInProjected += proj;
            const act = safeNum(actualDetails[`${selectedYear}_${m}_${e.id}`]); divActualTotal += act;
            details.push({ id: e.id, name: e.name, amt: proj, qualS: Math.max(0,qualS), totS: safeNum(e.shares), ex: ev.exDate||'未填', act });
          }
        });
      } else if (e.payMonths?.includes(m)) {
        const payout = safeNum(e.dividendPerShare) / (e.dividendType==='annual' && e.payMonths.length>0 ? e.payMonths.length : 1);
        let qualS = 0; (e.lots||[]).forEach(l => { const ld = new Date(l.date); if(isNaN(ld.getTime()) || ld.getFullYear()<selectedYear || (ld.getFullYear()===selectedYear && ld.getMonth()+1<=m)) qualS += (l.type==='sell'?-1:1)*Math.abs(l.shares); });
        const proj = Math.floor(Math.max(0,qualS) * payout); divInProjected += proj;
        const act = safeNum(actualDetails[`${selectedYear}_${m}_${e.id}`]); divActualTotal += act;
        details.push({ id: e.id, name: e.name, amt: proj, qualS: Math.max(0,qualS), totS: safeNum(e.shares), ex: '預估', act });
      }
    });

    const healthTaxProjected = Math.floor(divInProjected * 0.0211);
    const divUsed = divActualTotal > 0 ? divActualTotal : divInProjected - healthTaxProjected;

    let loanOut = 0; loans.forEach(l => { const st = l.startDate ? new Date(l.startDate) : new Date(); const dyn = Math.max(0, safeNum(l.paidMonths) + (selectedYear - st.getFullYear())*12 + (m - (st.getMonth()+1))); loanOut += calculateLoanPayment(l, dyn); });
    const dynCred = Math.max(0, safeNum(creditLoan.paidMonths) + (selectedYear - new Date().getFullYear())*12 + (m - (new Date().getMonth()+1)));
    const cRate = safeNum(creditLoan.rate)/100/12; const credOut = cRate===0 ? 0 : (dynCred < safeNum(creditLoan.totalMonths) ? Math.floor((safeNum(creditLoan.principal)*cRate*Math.pow(1+cRate,safeNum(creditLoan.totalMonths)))/(Math.pow(1+cRate,safeNum(creditLoan.totalMonths))-1)) : 0);
    let marginInt = 0; etfs.forEach(e => { let aMargin = 0; (e.lots||[]).forEach(l => { const ld = new Date(l.date); if(isNaN(ld.getTime()) || ld.getFullYear()<selectedYear || (ld.getFullYear()===selectedYear && ld.getMonth()+1<=m)) aMargin += (l.type==='sell'?-1:1)*Math.abs(l.margin||0); }); marginInt += Math.max(0,aMargin) * (safeNum(e.marginInterestRate,6.5)/100)/12; });
    const stockIntTotal = Math.floor((safeNum(stockLoan.principal)*safeNum(stockLoan.rate)/100)/12) + Math.floor((safeNum(globalMarginLoan.principal)*safeNum(globalMarginLoan.rate)/100)/12) + Math.floor(marginInt);
    
    const rec = monthlyRecords[`${selectedYear}_${m}`] || {}; const life = rec.livingExpense !== undefined ? safeNum(rec.livingExpense) : safeNum(taxStatus.livingExpenses);
    const healthTaxReal = divActualTotal > 0 ? 0 : healthTaxProjected;

    flows.push({ month: m, otherInc: safeNum(rec.otherIncome), divProjected: divInProjected, divActualTotal, loanOut, creditOut: credOut, stockInt: stockIntTotal, fixedOut: globalFixedOut, life, isActualLife: rec.livingExpense!==undefined, budgetLife: safeNum(taxStatus.livingExpenses), healthTax: healthTaxReal, incomeTax: monthlyIncomeTaxImpact, net: divUsed + safeNum(rec.otherIncome) - loanOut - credOut - stockIntTotal - globalFixedOut - life - healthTaxReal - monthlyIncomeTaxImpact, details });
  }
  return flows;
};

const sanitizePayload = (d: any): PersistedPayload => {
  const etfs: ETF[] = Array.isArray(d?.etfs) && d.etfs.length > 0 ? d.etfs : [];
  const cleanedEtfs = etfs.map((e: any) => ({
    ...e, dividendType: e?.dividendType || 'per_period', payMonths: Array.isArray(e?.payMonths) ? e.payMonths : [],
    schedule: (Array.isArray(e?.schedule) ? e.schedule : []).map((ev: any) => ({ ...ev, year: ev.year || (ev.payDate ? parseInt(ev.payDate.split('-')[0], 10) : 2026) || 2026 })),
    lots: Array.isArray(e?.lots) ? e.lots : []
  }));
  const oldActuals = d?.actualDetails || d?.actuals || {};
  const newActuals: Record<string,number> = {};
  Object.keys(oldActuals).forEach(k => { if (k.split('_').length === 2) { newActuals[`2026_${k}`] = oldActuals[k]; } else { newActuals[k] = oldActuals[k]; } });
  
  return { 
      etfs: cleanedEtfs, loans: Array.isArray(d?.loans) ? d.loans : [], stockLoan: d?.stockLoan || DEFAULT_STOCK_LOAN, creditLoan: d?.creditLoan || DEFAULT_CREDIT, globalMarginLoan: d?.globalMarginLoan || DEFAULT_GLOBAL_MARGIN, 
      taxStatus: { ...DEFAULT_TAX, ...(d?.taxStatus || {}) }, allocation: d?.allocation || DEFAULT_ALLOC, cloudConfig: d?.cloudConfig || DEFAULT_CLOUD, fixedExps: Array.isArray(d?.fixedExps) ? d.fixedExps : [], actualDetails: newActuals, monthlyRecords: d?.monthlyRecords || {}, _meta: d?._meta 
  };
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
    return { data: sanitizePayload(picked), source: picked === cloud ? 'cloud' : 'local' };
  },
  exportToFile: (data: any) => {
    const payload = { ...data, _meta: { schema: APP_SCHEMA_VERSION, updatedAt: Date.now() } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `baozutang_backup.json`; a.click();
  }
};

// ==========================================
// 主程式 Component
// ==========================================
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => { try { return sessionStorage.getItem('baozutang_auth') === 'true'; } catch(e) { return false; } });
  const [pwdInput, setPwdInput] = useState('');

  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dataSrc, setDataSrc] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stockLoan, setStockLoan] = useState<StockLoan>(DEFAULT_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(DEFAULT_GLOBAL_MARGIN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(DEFAULT_CREDIT);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(DEFAULT_TAX);
  const [allocation, setAllocation] = useState<AllocationConfig>(DEFAULT_ALLOC);
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(DEFAULT_CLOUD);
  const [fixedExps, setFixedExps] = useState<FixedExp[]>([]);
  const [actualDetails, setActualDetails] = useState<Record<string,number>>({});
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecords>({});
  const [reinvest, setReinvest] = useState(true);
  
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [txForm, setTxForm] = useState({ type: 'buy', shares: '', price: '', date: '', margin: '' });
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [showCalendar, setShowCalendar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = () => {
    if (pwdInput === '085012') { try { sessionStorage.setItem('baozutang_auth', 'true'); } catch(e) {} setIsAuthenticated(true); } 
    else { alert('密碼錯誤！請重新輸入。'); setPwdInput(''); }
  };

  const handleLogout = () => { try { sessionStorage.removeItem('baozutang_auth'); } catch(e) {} setIsAuthenticated(false); setPwdInput(''); };

  useEffect(() => {
    if (!isAuthenticated) return;
    StorageService.loadData().then((res) => {
      setDataSrc(res.source);
      if (res.data) {
        setEtfs(res.data.etfs || []); setLoans(res.data.loans || []); setStockLoan(res.data.stockLoan || DEFAULT_STOCK_LOAN);
        setGlobalMarginLoan(res.data.globalMarginLoan || DEFAULT_GLOBAL_MARGIN); setCreditLoan(res.data.creditLoan || DEFAULT_CREDIT);
        setTaxStatus(res.data.taxStatus || DEFAULT_TAX); setAllocation(res.data.allocation || DEFAULT_ALLOC);
        setCloudConfig(res.data.cloudConfig || DEFAULT_CLOUD); setFixedExps(res.data.fixedExps || []);
        setActualDetails(res.data.actualDetails || {}); setMonthlyRecords(res.data.monthlyRecords || {});
      }
      setIsInitializing(false);
    });
  }, [isAuthenticated]);

  useEffect(() => {
    if (isInitializing || !isAuthenticated) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      try {
        const res = await StorageService.saveData({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, fixedExps, actualDetails, monthlyRecords });
        setDataSrc(res.cloudOk ? 'cloud' : 'local'); setSaveStatus(res.cloudOk ? 'saved' : 'error'); setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) { setSaveStatus('error'); }
    }, 1200);
    return () => clearTimeout(t);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, fixedExps, actualDetails, monthlyRecords, isInitializing, isAuthenticated]);

  const monthlyFlows = useMemo(() => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, fixedExps, actualDetails, monthlyRecords, selectedYear), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, fixedExps, actualDetails, monthlyRecords, selectedYear]);

  const totalDividend = monthlyFlows.reduce((a, b) => a + (b.divActualTotal > 0 ? b.divActualTotal : b.divProjected * 0.9789), 0);
  const totalOtherIncome = monthlyFlows.reduce((a, b) => a + b.otherInc, 0);
  const totalOut = monthlyFlows.reduce((a, b) => a + b.loanOut + b.creditOut + b.stockInt + b.fixedOut + b.life + b.healthTax + b.incomeTax, 0);
  const totalNet = totalDividend + totalOtherIncome - totalOut;

  const totalValue = etfs.reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice), 0);
  const totalStockDebt = safeNum(stockLoan.principal) + safeNum(globalMarginLoan.principal) + etfs.reduce((a, e) => a + safeNum(e.marginLoanAmount), 0);
  const currentMaintenance = totalStockDebt === 0 ? 999 : (totalValue / totalStockDebt) * 100;

  const actualDiv = etfs.filter((e) => e.category === 'dividend').reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);
  const actualHedge = etfs.filter((e) => e.category === 'hedging').reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);
  const actualAct = etfs.filter((e) => e.category === 'active').reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);

  const combatPower = Math.floor(totalValue / 10000 + totalDividend / 12 / 100);
  const fireRatio = totalOut > 0 ? (totalDividend / totalOut) * 100 : 0;

  const { currentRank, nextRank, progress, healthGrade, earnedAchievements, avatar, combatLogs } = useMemo(() => {
    let cRank = '理財新手 🌱'; let nRank = '築基騎士 ⚔️'; let prog = 0; let av = '🧑‍🌾';
    if (fireRatio >= 100) { cRank = '財富神祇 🌟'; nRank = 'MAX'; prog = 100; av = '👑'; }
    else if (fireRatio >= 60) { cRank = '財富國王 👑'; nRank = '財富神祇 🌟'; prog = ((fireRatio - 60) / 40) * 100; av = '🤴'; }
    else if (fireRatio >= 30) { cRank = '資產領主 🏰'; nRank = '財富國王 👑'; prog = ((fireRatio - 30) / 30) * 100; av = '🧙‍♂️'; }
    else if (fireRatio >= 10) { cRank = '築基騎士 ⚔️'; nRank = '資產領主 🏰'; prog = ((fireRatio - 10) / 20) * 100; av = '🤺'; }
    else { prog = (fireRatio / 10) * 100; av = '🧑‍🌾'; }

    let grade = 'C';
    if (fireRatio >= 80 && currentMaintenance >= 160 && totalNet > 0) grade = 'SSS';
    else if (fireRatio >= 50 && currentMaintenance >= 140) grade = 'S';
    else if (fireRatio >= 30 && currentMaintenance >= 130) grade = 'A';
    else if (fireRatio >= 10) grade = 'B';

    const ach = [];
    if (totalValue >= 20000000) ach.push({ icon: '💎', title: '兩千萬霸主', desc: '總資產突破兩千萬', rarity: 'UR', glow: 'shadow-[0_0_15px_rgba(236,72,153,0.6)] border-pink-500 text-pink-400 bg-pink-900/20' });
    else if (totalValue >= 10000000) ach.push({ icon: '💰', title: '千萬俱樂部', desc: '總資產突破一千萬', rarity: 'SSR', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.6)] border-yellow-500 text-yellow-400 bg-yellow-900/20' });
    if (totalDividend / 12 >= 100000) ach.push({ icon: '🔥', title: '月入十萬', desc: '平均月被動收入達十萬', rarity: 'UR', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.6)] border-orange-500 text-orange-400 bg-orange-900/20' });
    if (currentMaintenance >= 200 || currentMaintenance === 999) ach.push({ icon: '🛡️', title: '無敵鐵壁', desc: '維持率極度安全', rarity: 'SR', glow: 'border-blue-500 text-blue-400 bg-blue-900/20' });
    if (totalOut > 0 && totalNet > 0) ach.push({ icon: '📈', title: '正向循環', desc: '淨現金流為正數', rarity: 'R', glow: 'border-emerald-500 text-emerald-400 bg-emerald-900/20' });

    const logs = [
        `[系統] 玩家登入，當前總戰力 ${combatPower.toLocaleString()}。`,
        totalNet > 0 ? `[被動技] 資產護盾發動！淨回血 ${formatMoney(totalNet/12)}/月。` : `[警告] 現金流失血中，注意防禦！`,
        `[裝備] 持有 ${etfs.length} 件神兵利器持續產出金幣。`,
        currentMaintenance < 140 ? `[Debuff] 維持率過低，防禦力下降！` : `[Buff] 維持率穩健，防禦力堅不可摧。`
    ];

    return { currentRank: cRank, nextRank: nRank, progress: Math.min(100, Math.max(0, prog)), healthGrade: grade, earnedAchievements: ach, avatar: av, combatLogs: logs };
  }, [fireRatio, totalValue, totalDividend, currentMaintenance, totalNet, etfs.length, combatPower]);

  const upcomingEvents = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0); const evs:any[] = [];
    etfs.forEach(e => { (e.schedule||[]).forEach(ev => {
      if(ev.exDate) { const d=new Date(ev.exDate); if(d>=today) evs.push({type:'ex',d,s:ev.exDate,n:e.name,a:ev.amount}); }
      if(ev.payDate) { const d=new Date(ev.payDate); if(d>=today) evs.push({type:'pay',d,s:ev.payDate,n:e.name,a:ev.amount}); }
    })});
    return evs.sort((a,b)=>a.d.getTime()-b.d.getTime()).slice(0,4);
  }, [etfs]);

  const snowballData = useMemo(() => {
    const avgYield = totalValue > 0 ? totalDividend / totalValue : 0.05;
    const data: any[] = []; let curWealth = totalValue;
    for (let y = 0; y <= 10; y++) {
      const futureYear = selectedYear + y;
      let futureLoanOut = 0;
      loans.forEach((l) => { for(let m=1; m<=12; m++) { let dynPaid = safeNum(l.paidMonths); if (l.startDate) { const st = new Date(l.startDate); if (!isNaN(st.getTime())) dynPaid = Math.max(0, (futureYear - st.getFullYear()) * 12 + (m - (st.getMonth() + 1))); } else { dynPaid = Math.max(0, safeNum(l.paidMonths) + (futureYear - new Date().getFullYear()) * 12 + (m - (new Date().getMonth() + 1))); } futureLoanOut += calculateLoanPayment(l, dynPaid); } });
      let futureCreditOut = 0; const cPrin = safeNum(creditLoan.principal); const cRate = safeNum(creditLoan.rate) / 100 / 12; const cTot = safeNum(creditLoan.totalMonths);
      for(let m=1; m<=12; m++) { const dynCPaid = Math.max(0, safeNum(creditLoan.paidMonths) + (futureYear - new Date().getFullYear()) * 12 + (m - (new Date().getMonth() + 1))); if (cPrin > 0 && dynCPaid < cTot) futureCreditOut += cRate === 0 ? Math.floor(cPrin / cTot) : Math.floor((cPrin * cRate * Math.pow(1 + cRate, cTot)) / (Math.pow(1 + cRate, cTot) - 1)); }
      const fStockInt = (Math.floor((safeNum(stockLoan.principal) * (safeNum(stockLoan.rate) / 100)) / 12) + Math.floor((safeNum(globalMarginLoan.principal) * (safeNum(globalMarginLoan.rate) / 100)) / 12)) * 12;
      const fMarginInt = etfs.reduce((acc, e) => acc + (safeNum(e.marginLoanAmount) * (safeNum(e.marginInterestRate, 6.5) / 100)) / 12, 0) * 12;
      const globalFixedOut = fixedExps.reduce((sum, f) => sum + safeNum(f.amount), 0) * 12;
      const fLife = safeNum(taxStatus.livingExpenses) * 12;
      const fDiv = curWealth * avgYield; const fHealthTax = Math.floor(fDiv * 0.0211); const fIncomeTax = calculateIncomeTax(safeNum(taxStatus.salaryIncome), fDiv, 0, taxStatus);
      const futureNet = fDiv - futureLoanOut - futureCreditOut - fStockInt - fMarginInt - globalFixedOut - fLife - fHealthTax - fIncomeTax;
      data.push({ year: `Y${y}`, wealth: Math.floor(curWealth) });
      curWealth = curWealth * 1.05 + (reinvest ? fDiv : 0) + (futureNet - fDiv); 
    }
    return data;
  }, [totalValue, totalDividend, reinvest, loans, creditLoan, stockLoan, globalMarginLoan, taxStatus, fixedExps, etfs, selectedYear]);

  const pieData = [{ name: '配息', value: Math.max(1, actualDiv), color: COLORS.dividend }, { name: '避險', value: Math.max(1, actualHedge), color: COLORS.hedging }, { name: '主動', value: Math.max(1, actualAct), color: COLORS.active }];
  const radarData = [{ subject: '現金流', A: Math.min(100, fireRatio) }, { subject: '安全性', A: Math.min(100, (actualHedge / (totalValue - totalStockDebt || 1)) * 500) }, { subject: '維持率', A: Math.min(100, (currentMaintenance - 130) * 2) }, { subject: '成長', A: Math.min(100, (actualAct / (totalValue - totalStockDebt || 1)) * 500) }];

  const moveEtf = (i: number, d: number) => { setEtfs((prev) => { const n = [...prev]; if (i + d < 0 || i + d >= n.length) return prev; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; }); };
  const removeEtf = (id: string) => { if (confirm('確定刪除？')) setEtfs((prev) => prev.filter((e) => e.id !== id)); };
  
  const updateLoan = (i: number, f: string, v: any) => { 
    setLoans((prev) => { 
      const n = [...prev]; if (!n[i]) return prev; 
      if (f === 'startDate' && v) { 
        const start = new Date(v); const now = new Date(); 
        const dm = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()); 
        n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, dm) }; 
      } else { n[i] = { ...n[i], [f]: v }; } 
      return n; 
    }); 
  };
  
  const updateDetailActual = (y: number, m: number, id: string, val: number) => { setActualDetails((prev) => ({ ...prev, [`${y}_${m}_${id}`]: safeNum(val) })); };
  const updateMonthlyRecord = (y: number, m: number, f: keyof MonthlyRecord, val: any) => { setMonthlyRecords((prev) => ({ ...prev, [`${y}_${m}`]: { ...(prev[`${y}_${m}`] || {}), [f]: val } })); };
  
  const updateSchedule = (etfId: string, eventId: string, field: string, val: any) => {
    setEtfs((prev) => prev.map((etf) => {
        if (etf.id !== etfId) return etf;
        const schedule = (etf.schedule || []).map((ev) => (ev.id !== eventId ? ev : { ...ev, [field]: val }));
        return { ...etf, schedule };
    }));
  };

  const initYearSchedule = (etfId: string) => {
    setEtfs((prev) => prev.map((etf) => {
        if (etf.id !== etfId) return etf;
        const evs: DividendEvent[] = [1, 2, 3, 4].map((q) => ({ id: `${Date.now()}-q${q}`, year: selectedYear, name: `${selectedYear} Q${q}`, exDate: '', payDate: '', amount: safeNum(etf.dividendPerShare), isActual: false }));
        return { ...etf, schedule: [...(etf.schedule || []), ...evs] };
    }));
  };

  const handleUpdatePrices = async () => {
    if (!cloudConfig.priceSourceUrl) return; setIsUpdatingPrices(true);
    try {
      const url = cloudConfig.priceSourceUrl.includes('/edit') ? cloudConfig.priceSourceUrl.replace(/\/edit.*$/, '/export?format=csv') : cloudConfig.priceSourceUrl;
      const res = await fetch(url); const text = await res.text(); const map = new Map();
      text.split(/\r?\n/).forEach(r => { const c = r.split(',').map(x=>x.trim()); if(c.length>=2&&c[0]!=='code') map.set(c[0],{p:parseFloat(c[1]), d:parseFloat(c[2]), ex:c[3], pay:c[4]}); });
      setEtfs(prev => prev.map(e => { const info = map.get(e.code||e.id); return info ? {...e, currentPrice: info.p, dividendPerShare: isNaN(info.d)?e.dividendPerShare:info.d} : e; }));
      alert('行情與配息資訊更新成功！');
    } catch(e) { alert('更新失敗'); } finally { setIsUpdatingPrices(false); }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-emerald-500/30">
        <div className="bg-slate-900/80 p-10 rounded-3xl shadow-2xl w-full max-w-sm text-center border border-slate-800">
          <Calculator size={56} className="text-emerald-400 mx-auto mb-6 drop-shadow-md"/>
          <h1 className="text-3xl font-black text-emerald-400 mb-8 tracking-widest">包租唐戰情室</h1>
          <input type="password" value={pwdInput} onChange={(e) => setPwdInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="請輸入通行密碼" className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-white outline-none mb-6 text-center text-lg tracking-widest transition-colors"/>
          <button onClick={handleLogin} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(5,150,105,0.4)] flex justify-center items-center gap-2"><Lock size={18}/> 解鎖進入</button>
        </div>
      </div>
    );
  }

  if (isInitializing) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-400"><Loader2 className="animate-spin mr-2"/> 載入戰情資料...</div>;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-950 text-white font-sans selection:bg-emerald-500/30">
      
      <header className="mb-6 border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-emerald-400 flex items-center gap-2 drop-shadow-md"><Calculator/> 包租唐戰情室 V100</h1>
          <div className="text-xs mt-2 text-slate-500 flex gap-2"><span className="bg-slate-800 px-2 py-1 rounded-full text-emerald-500 font-bold">{saveStatus==='saving'?'儲存中...':saveStatus==='saved'?'已同步':dataSrc}</span></div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleUpdatePrices} className="p-2 bg-slate-800 rounded-lg text-emerald-400 hover:bg-slate-700 transition-colors shadow-md" title="更新報價"><RefreshCw size={18} className={isUpdatingPrices?"animate-spin":""}/></button>
          <button onClick={()=>setShowSettings(true)} className="p-2 bg-slate-800 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors shadow-md" title="系統設定"><Settings size={18}/></button>
          <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { try { const raw = JSON.parse(ev.target?.result as string); const d = sanitizePayload(raw); setEtfs(d.etfs); setLoans(d.loans || []); setStockLoan(d.stockLoan || DEFAULT_STOCK_LOAN); setGlobalMarginLoan(d.globalMarginLoan || DEFAULT_GLOBAL_MARGIN); setCreditLoan(d.creditLoan || DEFAULT_CREDIT); setTaxStatus(d.taxStatus || DEFAULT_TAX); setAllocation(d.allocation || DEFAULT_ALLOC); setCloudConfig(d.cloudConfig || DEFAULT_CLOUD); setFixedExps(d.fixedExps || []); setActualDetails(d.actualDetails || {}); setMonthlyRecords(d.monthlyRecords || {}); alert('匯入成功！'); } catch (err) { alert('格式錯誤'); } }; r.readAsText(f); }} className="hidden" accept=".json" />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-slate-800 rounded-lg text-blue-400 hover:bg-slate-700 transition-colors shadow-md" title="匯入"><Upload size={18} /></button>
          <button onClick={() => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, fixedExps, actualDetails, monthlyRecords })} className="p-2 bg-slate-800 rounded-lg text-amber-400 hover:bg-slate-700 transition-colors shadow-md" title="匯出"><Download size={18} /></button>
          <button onClick={handleLogout} className="p-2 bg-slate-800 rounded-lg text-red-400 hover:bg-slate-700 transition-colors shadow-md ml-2" title="上鎖登出"><LogOut size={18} /></button>
        </div>
      </header>

      <div className="mb-6 bg-slate-900 border border-emerald-900/50 rounded-xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><BellRing size={80} /></div>
        <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-3"><BellRing size={16}/> 近期戰情報告 (自動追蹤行事曆)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {upcomingEvents.length>0 ? upcomingEvents.map((ev,i)=><div key={i} className="bg-slate-950/80 p-3 rounded-lg border border-slate-800"><div className="flex justify-between"><span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${ev.type==='ex'?'text-orange-400 bg-orange-900/40':'text-emerald-400 bg-emerald-900/40'}`}>{ev.type==='ex'?'即將除息':'即將發放'}</span><span className="text-xs text-slate-400 font-mono">{ev.s}</span></div><div className="text-sm font-bold text-slate-100 truncate mt-2">{ev.n}</div><div className="text-[10px] text-slate-500 mt-1">預估: <span className="text-yellow-400 font-mono">{ev.a}</span> 元/股</div></div>) : <div className="text-xs text-slate-500 relative z-10">目前無即將到來事件。</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-3xl border border-slate-700 shadow-inner">🧑‍🌾</div>
              <div className="flex-1"><div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">主線任務：FIRE <Target size={10}/></div><div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">{rank}</div></div>
              <div className="text-right"><div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">評級</div><div className="text-4xl font-black text-yellow-400 italic drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">{grade}</div></div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center bg-slate-950 p-3 rounded-xl border border-slate-800 shadow-inner">
              <div><div className="text-[9px] text-slate-500 font-bold mb-1">攻擊力(年息)</div><div className="font-mono font-bold text-emerald-400 text-sm">{formatMoney(totalDividend)}</div></div>
              <div><div className="text-[9px] text-slate-500 font-bold mb-1">防禦力(維持)</div><div className={`font-bold text-sm ${currentMaintenance < 140 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>{currentMaintenance===999?'MAX':currentMaintenance.toFixed(0)+'%'}</div></div>
              <div><div className="text-[9px] text-slate-500 font-bold mb-1">回血(月淨流)</div><div className={`font-mono font-bold text-sm ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-500 animate-pulse'}`}>{formatMoney(totalNet/12)}</div></div>
              <div><div className="text-[9px] text-slate-500 font-bold mb-1">日產金率</div><div className="font-mono font-bold text-yellow-400 text-sm">{formatMoney(totalDividend/365)}</div></div>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <div className="flex justify-between items-center mb-4"><h2 className="font-bold text-emerald-400 flex items-center gap-2"><Activity size={16}/> 裝備庫 (ETF)</h2><button onClick={()=>setEtfs(p=>[...p,{id:Date.now().toString(),name:'新標的',shares:0,costPrice:0,currentPrice:0,dividendPerShare:0,category:'dividend'}])} className="text-xs bg-emerald-900/50 hover:bg-emerald-800 text-emerald-400 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors shadow-md"><Plus size={12}/> 新增裝備</button></div>
            <div className="space-y-4">
              {etfs.map((e, idx) => (
                <div key={e.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 group hover:border-slate-600 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col gap-1 w-2/3">
                        <input value={e.code||''} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,code:v.target.value}:x))} className="w-16 bg-slate-900 text-[10px] text-slate-500 px-2 py-0.5 rounded outline-none focus:ring-1 focus:ring-emerald-500/50" placeholder="代號"/>
                        <input value={e.name} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,name:v.target.value}:x))} className="w-full bg-transparent font-bold text-white text-lg outline-none focus:border-b focus:border-slate-700"/>
                    </div>
                    <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={()=>setEtfs(p=>{const n=[...p]; if(idx>0){[n[idx],n[idx-1]]=[n[idx-1],n[idx]]} return n;})} className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded text-slate-500"><ArrowUp size={14}/></button>
                        <button onClick={()=>setEtfs(p=>{const n=[...p]; if(idx<n.length-1){[n[idx],n[idx+1]]=[n[idx+1],n[idx]]} return n;})} className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded text-slate-500"><ArrowDown size={14}/></button>
                        <button onClick={()=>removeEtf(e.id)} className="p-1.5 bg-slate-900 hover:bg-red-900/30 rounded text-red-500/50 hover:text-red-400"><Trash2 size={14}/></button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-slate-800/50 pt-2 mt-1 mb-3">
                    <select value={e.category} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,category:v.target.value as any}:x))} className="bg-slate-900 text-xs text-blue-400 px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500/50 cursor-pointer">
                        <option value="dividend">配息型</option><option value="hedging">避險型</option><option value="active">主動型</option>
                    </select>
                    <div className="flex gap-1">
                        <button onClick={()=>setShowCalendar(showCalendar===e.id?null:e.id)} className={`p-1.5 rounded-lg transition-colors ${showCalendar===e.id?'bg-emerald-600 text-white shadow-[0_0_10px_rgba(5,150,105,0.3)]':'bg-slate-900 text-slate-400 hover:text-white'}`}><CalendarDays size={16}/></button>
                        <button onClick={()=>setActiveTxId(activeTxId===e.id?null:e.id)} className={`p-1.5 rounded-lg transition-colors ${activeTxId===e.id?'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]':'bg-slate-900 text-slate-400 hover:text-white'}`}><Wallet size={16}/></button>
                        <button onClick={()=>setExpandedEtfId(expandedEtfId===e.id?null:e.id)} className={`p-1.5 rounded-lg transition-colors ${expandedEtfId===e.id?'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]':'bg-slate-900 text-slate-400 hover:text-white'}`}><List size={16}/></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs bg-slate-900/50 p-3 rounded-xl border border-slate-800/50 mb-2">
                      <div><div className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">持有總數</div><div className="font-mono text-sm">{safeNum(e.shares).toLocaleString()}</div></div>
                      <div><div className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">即時現價</div><input type="number" value={e.currentPrice} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,currentPrice:safeNum(v.target.value)}:x))} className="w-full bg-slate-900 px-2 py-1 rounded outline-none focus:border-emerald-500 border border-transparent transition-colors"/></div>
                      <div>
                          <div className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">預估配息</div>
                          <div className="flex gap-1">
                              <input type="number" value={e.dividendPerShare} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,dividendPerShare:safeNum(v.target.value)}:x))} className="w-full bg-slate-900 px-1 py-1 text-center rounded outline-none focus:border-emerald-500 border border-transparent transition-colors"/>
                              <select value={e.dividendType} onChange={v=>setEtfs(p=>p.map((x,i)=>i===idx?{...x,dividendType:v.target.value as any}:x))} className="bg-slate-900 text-[9px] text-blue-400 outline-none rounded px-1 cursor-pointer"><option value="per_period">次</option><option value="annual">年</option></select>
                          </div>
                      </div>
                  </div>
                  
                  {activeTxId === e.id && (
                    <div className="mt-3 p-4 bg-slate-900 border border-blue-900/30 rounded-xl shadow-inner animate-in slide-in-from-top-2">
                      <div className="flex gap-2 mb-3">
                          <button onClick={()=>setTxForm({...txForm, type:'buy'})} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${txForm.type==='buy'?'bg-blue-600 text-white':'bg-slate-950 text-slate-500'}`}>買進</button>
                          <button onClick={()=>setTxForm({...txForm, type:'sell'})} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${txForm.type==='sell'?'bg-orange-600 text-white':'bg-slate-950 text-slate-500'}`}>賣出</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                          <div><label className={`text-[9px] ml-1 ${txForm.type==='buy'?'text-blue-400':'text-orange-400'}`}>股數</label><input type="number" placeholder="1000" value={txForm.shares} onChange={v=>setTxForm({...txForm, shares:v.target.value})} className="w-full bg-slate-950 p-2 rounded-lg text-xs outline-none focus:border-blue-500 border border-transparent mt-0.5 text-white"/></div>
                          <div><label className={`text-[9px] ml-1 ${txForm.type==='buy'?'text-blue-400':'text-orange-400'}`}>單價</label><input type="number" placeholder="0.0" value={txForm.price} onChange={v=>setTxForm({...txForm, price:v.target.value})} className="w-full bg-slate-950 p-2 rounded-lg text-xs outline-none focus:border-blue-500 border border-transparent mt-0.5 text-white"/></div>
                          <div><label className={`text-[9px] ml-1 ${txForm.type==='buy'?'text-blue-400':'text-orange-400'}`}>融資增減</label><input type="number" placeholder="0" value={txForm.margin} onChange={v=>setTxForm({...txForm, margin:v.target.value})} className="w-full bg-slate-950 p-2 rounded-lg text-xs outline-none focus:border-blue-500 border border-transparent mt-0.5 text-white"/></div>
                          <div><label className={`text-[9px] ml-1 ${txForm.type==='buy'?'text-blue-400':'text-orange-400'}`}>交易日</label><input type="date" value={txForm.date} onChange={v=>setTxForm({...txForm, date:v.target.value})} className="w-full bg-slate-950 p-2 rounded-lg text-xs outline-none focus:border-blue-500 border border-transparent mt-0.5 text-slate-300"/></div>
                      </div>
                      <button onClick={()=>{const s=safeNum(txForm.shares),p=safeNum(txForm.price),m=safeNum(txForm.margin); if(!s||!p)return; setEtfs(prev=>{const n=[...prev]; n[idx]=recalculateEtfStats({...n[idx],lots:[...(n[idx].lots||[]), {id:Date.now().toString(),date:txForm.date||new Date().toISOString().split('T')[0],shares:txForm.type==='sell'?-Math.abs(s):Math.abs(s),price:p,fee:Math.floor(Math.abs(s)*p*BROKERAGE_RATE),margin:txForm.type==='sell'?-Math.abs(m):Math.abs(m),type:txForm.type as any}]}); return n;}); setTxForm({type:'buy',shares:'',price:'',date:'',margin:''}); setActiveTxId(null);}} className={`w-full py-2 text-sm rounded-lg font-bold text-white shadow-md transition-colors ${txForm.type==='buy'?'bg-blue-600 hover:bg-blue-500':'bg-orange-600 hover:bg-orange-500'}`}>紀錄交易</button>
                    </div>
                  )}

                  {expandedEtfId === e.id && (
                    <div className="mt-3 space-y-2 border-t border-slate-800/50 pt-3">
                      {e.lots?.map(l=>{
                          const isSell = l.type === 'sell' || l.shares < 0;
                          return (
                            <div key={l.id} className="flex justify-between items-center text-[10px] bg-slate-900 p-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                                <span className="font-mono flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded font-bold ${isSell?'bg-orange-900/50 text-orange-500':'bg-emerald-900/50 text-emerald-400'}`}>{isSell?'賣':'買'}</span>
                                    <span className="text-slate-400">{l.date}</span> <span className="opacity-30 text-slate-600">|</span> <span className={isSell?"text-orange-400/90":"text-emerald-400/90"}>{Math.abs(l.shares).toLocaleString()} 股</span>
                                </span>
                                <span className="text-slate-300 font-mono">${formatMoney(l.price)} <span className={`text-[8px] ml-1 ${isSell?'text-orange-500/70':'text-slate-500'}`}>(融:{formatMoney(l.margin||0)})</span> <button onClick={()=>setEtfs(p=>p.map((x,i)=>i===idx?recalculateEtfStats({...x,lots:(x.lots||[]).filter(y=>y.id!==l.id)}):x))} className="text-red-500/50 hover:text-red-400 ml-2 p-1 rounded hover:bg-red-900/20 transition-colors"><X size={12}/></button></span>
                            </div>
                      )})}
                      {(!e.lots || e.lots.length===0) && <div className="text-center text-slate-600 text-[10px] py-2">尚未持有任何數量</div>}
                    </div>
                  )}

                  {showCalendar === e.id && (
                     <div className="mt-3 p-3 bg-slate-900 border border-emerald-500/30 rounded-xl animate-in slide-in-from-top-2 shadow-lg">
                        <div className="text-xs font-bold text-emerald-500 mb-3 flex justify-between items-center border-b border-emerald-900/30 pb-2">
                            <span>📅 {selectedYear} 年度配息排程</span>
                            <button onClick={()=>setShowCalendar(null)} className="text-slate-500 hover:text-white bg-slate-950 p-1 rounded-full"><X size={12}/></button>
                        </div>
                        <div className="space-y-2">
                            {(e.schedule?.filter(ev=>ev.year===selectedYear)||[]).length > 0 ? (
                                (e.schedule?.filter(ev=>ev.year===selectedYear)||[]).map(ev=>(
                                    <div key={ev.id} className="grid grid-cols-7 gap-2 text-[10px] items-center bg-slate-950 p-2 rounded-lg border border-slate-800/50">
                                        <div className="col-span-2 text-slate-400 font-bold">{ev.name}</div>
                                        <div className="col-span-5 grid grid-cols-3 gap-2">
                                            <div><div className="text-slate-600 mb-0.5 text-[8px]">除息日</div><input type="date" value={ev.exDate} onChange={(v)=>updateSchedule(e.id,ev.id,'exDate',v.target.value)} className="w-full bg-slate-900 rounded p-1 text-slate-300 border border-transparent focus:border-emerald-500 outline-none transition-colors"/></div>
                                            <div><div className="text-slate-600 mb-0.5 text-[8px]">發放日</div><input type="date" value={ev.payDate} onChange={(v)=>updateSchedule(e.id,ev.id,'payDate',v.target.value)} className="w-full bg-slate-900 rounded p-1 text-emerald-400 border border-transparent focus:border-emerald-500 outline-none transition-colors"/></div>
                                            <div><div className="text-slate-600 mb-0.5 text-[8px]">金額</div><input type="number" step="0.01" value={ev.amount} onChange={(v)=>updateSchedule(e.id,ev.id,'amount',safeNum(v.target.value))} className="w-full bg-slate-900 rounded p-1 text-right text-yellow-400 font-bold border border-transparent focus:border-emerald-500 outline-none transition-colors"/></div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <button onClick={()=>initYearSchedule(e.id)} className="w-full px-5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg"><Plus size={14} className="inline mr-1"/> 初始化排程</button>
                            )}
                        </div>
                     </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-lg relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 text-emerald-500/10 group-hover:scale-110 transition-transform duration-500"><Wallet size={80}/></div>
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">年度淨流</div>
              <div className={`text-2xl font-black font-mono relative z-10 ${totalNet>=0?'text-emerald-400':'text-red-400'}`}>{formatMoney(totalNet)}</div>
            </div>
            <div className="bg-slate-900 p-4 rounded-2xl border-l-4 border-blue-500 shadow-lg relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 text-blue-500/10 group-hover:scale-110 transition-transform duration-500"><Crown size={80}/></div>
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">總資產</div>
              <div className="text-2xl font-black font-mono text-slate-100 relative z-10">{formatMoney(totalValue)}</div>
            </div>
            <div className="bg-slate-900 p-4 rounded-2xl border-l-4 border-red-500 shadow-lg relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 text-red-500/10 group-hover:scale-110 transition-transform duration-500"><AlertTriangle size={80}/></div>
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">總負債</div>
              <div className="text-2xl font-black font-mono text-slate-100 relative z-10">{formatMoney(totalStockDebt)}</div>
            </div>
            <div className="bg-slate-900 p-4 rounded-2xl border-l-4 border-orange-500 shadow-lg relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 text-orange-500/10 group-hover:scale-110 transition-transform duration-500"><ShieldCheck size={80}/></div>
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">股息 Cover率</div>
              <div className="text-2xl font-black font-mono text-orange-400 relative z-10">{totalOut>0?((totalDividend/totalOut)*100).toFixed(1):0}%</div>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-cyan-400"><TrendingUp size={20}/> 十年財富滾雪球</h3>
                <div className="flex items-center gap-2 bg-slate-950 rounded-lg p-1 border border-slate-800 shadow-inner">
                    <button onClick={()=>setSelectedYear(y=>y-1)} className="px-3 py-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md transition-colors text-xs">◀</button>
                    <span className="font-black text-emerald-400 w-16 text-center text-sm tracking-wider">{selectedYear}</span>
                    <button onClick={()=>setSelectedYear(y=>y+1)} className="px-3 py-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md transition-colors text-xs">▶</button>
                </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snowballData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="colorWealth" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.6}/><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#64748b" width={60} tickFormatter={(value) => `${Math.floor(value / 10000)}W`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip formatter={(v: any) => [formatMoney(v), '預估資產']} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="wealth" stroke="#0ea5e9" strokeWidth={3} fill="url(#colorWealth)" animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <button onClick={()=>setReinvest(false)} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${!reinvest ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-700/50' : 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-slate-300'}`}>純領息(花掉)</button>
                <button onClick={()=>setReinvest(true)} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${reinvest ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.4)]' : 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-slate-300'}`}>股息再投入</button>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl overflow-x-auto">
            <h3 className="text-lg font-bold mb-6 text-emerald-400 flex items-center gap-2"><Calendar size={20}/> {selectedYear} 戰術對帳面板</h3>
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-slate-400 bg-slate-950/80 text-[10px] uppercase tracking-wider">
                <tr>
                    <th className="p-3 font-medium rounded-tl-lg">月</th>
                    <th className="p-3 font-medium">額外入帳</th>
                    <th className="p-3 font-medium">預估息</th>
                    <th className="p-3 font-medium text-emerald-400 bg-emerald-950/30">實領息</th>
                    <th className="p-3 font-medium">落差</th>
                    <th className="p-3 font-medium">房貸出金</th>
                    <th className="p-3 font-medium">信貸出金</th>
                    <th className="p-3 font-medium">維持息</th>
                    <th className="p-3 font-medium text-purple-400 bg-purple-950/20">固定支出</th>
                    <th className="p-3 font-medium">生活消耗</th>
                    <th className="p-3 font-medium">稅金</th>
                    <th className="p-3 font-medium text-right rounded-tr-lg">淨流</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {monthlyFlows.map(r => (
                  <React.Fragment key={r.month}>
                    <tr onClick={()=>setExpandedMonth(expandedMonth===r.month?null:r.month)} className="hover:bg-slate-800/30 font-mono text-[11px] cursor-pointer transition-colors group">
                      <td className="p-3 font-bold text-slate-300 flex items-center gap-1.5 w-16">{r.month}月 <span className="text-slate-600 group-hover:text-emerald-400 transition-colors">{expandedMonth === r.month ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</span></td>
                      <td className="p-3 text-blue-400 font-bold">{r.otherInc>0?formatMoney(r.otherInc):'-'}</td>
                      <td className="p-3 text-slate-500">{formatMoney(r.divProjected)}</td>
                      <td className="p-3 text-emerald-400 font-bold bg-emerald-950/20">{r.divActualTotal>0?formatMoney(r.divActualTotal):'-'}</td>
                      <td className={`p-3 bg-emerald-950/20 ${r.divActualTotal>0 && r.divActualTotal-r.divProjected*0.9789<0 ? 'text-red-400':'text-slate-500'}`}>{r.divActualTotal>0?formatMoney(r.divActualTotal-r.divProjected*0.9789):'-'}</td>
                      <td className="p-3 text-red-400/80">{formatMoney(r.loanOut)}</td>
                      <td className="p-3 text-orange-400/80">{formatMoney(r.creditOut)}</td>
                      <td className="p-3 text-blue-300/80">{formatMoney(r.stockInt)}</td>
                      <td className="p-3 text-purple-400 bg-purple-950/10 font-bold">{formatMoney(r.fixedOut)}</td>
                      <td className="p-3">{r.isActualLife?<div className="text-yellow-400 font-bold" title={`預算: ${formatMoney(r.budgetLife)}`}>{formatMoney(r.life)}<br/><span className="text-[8px] text-yellow-600/80 font-sans tracking-widest">(實支)</span></div>:<div className="text-slate-500">{formatMoney(r.life)}<br/><span className="text-[8px] opacity-40 font-sans tracking-widest">(預算)</span></div>}</td>
                      <td className="p-3 text-purple-400/70 text-[9px]">{formatMoney(r.healthTax)}<br/><span className="opacity-40">+{formatMoney(r.incomeTax)}</span></td>
                      <td className={`p-3 text-right font-bold text-sm ${r.net>=0?'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]':'text-red-400'}`}>{formatMoney(r.net)}</td>
                    </tr>
                    {expandedMonth === r.month && (
                      <tr className="bg-slate-950/50"><td colSpan={12} className="p-0"><div className="p-5 border-l-2 border-emerald-500/50 bg-gradient-to-r from-slate-900 to-transparent m-2 rounded-r-xl animate-in slide-in-from-top-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b border-slate-800">
                            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                                <div className="text-[11px] text-slate-400 mb-3 font-bold uppercase tracking-wider flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div> 本月生活費結算</div>
                                <div className="flex items-center gap-3"><span className="text-slate-500 text-xs whitespace-nowrap">實際支出:</span><input type="number" placeholder={`留白套用預算 ${formatMoney(taxStatus.livingExpenses)}`} value={monthlyRecords[`${selectedYear}_${r.month}`]?.livingExpense??''} onChange={e=>updateMonthlyRecord(selectedYear,r.month,'livingExpense',e.target.value===''?undefined:safeNum(e.target.value))} className="w-full bg-slate-950 border border-slate-700 focus:border-yellow-500 rounded-lg px-3 py-2 text-sm text-yellow-400 font-bold outline-none transition-colors" onClick={e=>e.stopPropagation()}/></div>
                            </div>
                            <div className="bg-blue-950/10 rounded-xl p-4 border border-blue-900/30">
                                <div className="text-[11px] text-blue-400 mb-3 font-bold uppercase tracking-wider flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> 額外戰利品 (其他收入)</div>
                                <div className="flex gap-2 items-center"><input type="number" placeholder="輸入額外金額..." value={monthlyRecords[`${selectedYear}_${r.month}`]?.otherIncome??''} onChange={e=>updateMonthlyRecord(selectedYear,r.month,'otherIncome',e.target.value===''?undefined:safeNum(e.target.value))} className="flex-1 bg-slate-950 border border-blue-900/50 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-blue-300 font-bold outline-none transition-colors" onClick={e=>e.stopPropagation()}/><label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer bg-slate-950 px-3 py-2.5 rounded-lg border border-slate-800 hover:bg-slate-900 transition-colors" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={monthlyRecords[`${selectedYear}_${r.month}`]?.isTaxable??false} onChange={e=>updateMonthlyRecord(selectedYear,r.month,'isTaxable',e.target.checked)} className="accent-blue-500 w-3.5 h-3.5 rounded-sm"/>計入所得</label></div>
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] text-emerald-500/80 mb-3 font-bold uppercase tracking-wider flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> 實領股息對帳單</div>
                            <div className="space-y-2">
                                {r.details.map((d:any,i:number)=>(
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors gap-3">
                                        <div className="flex-1">
                                            <div className="text-slate-200 text-sm font-bold flex items-center gap-2">{d.name} {d.ex!=='未填'&&d.ex!=='預估'&&<span className="text-[9px] font-mono text-emerald-400/70 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/50">除息: {d.ex}</span>}</div>
                                            <div className="text-[10px] text-slate-500 mt-1 flex gap-4"><span>預估(稅前): <span className="font-mono text-slate-400">{formatMoney(d.amt)}</span></span><span className={d.qualS<d.totS?'text-orange-400 flex items-center gap-1':'text-slate-600'}>{d.qualS<d.totS&&<AlertTriangle size={10}/>}資格股: {safeNum(d.qualS).toLocaleString()} / 總: {safeNum(d.totS).toLocaleString()}</span></div>
                                        </div>
                                        <div className="flex items-center gap-4 bg-slate-950 py-1.5 px-3 rounded-lg border border-slate-800 w-full sm:w-auto">
                                            <div className="flex items-center gap-2"><span className="text-[10px] text-emerald-600 font-bold uppercase">入帳</span><div className="relative"><span className="absolute left-2 top-[7px] text-emerald-700 text-[10px] font-bold">$</span><input type="number" placeholder={Math.floor(d.amt*0.9789).toString()} value={d.actual||''} onChange={e=>updateDetailActual(selectedYear,r.month,d.id,safeNum(e.target.value))} className="w-24 bg-transparent border-b border-emerald-900/50 focus:border-emerald-500 pl-5 pr-1 py-1 text-emerald-400 font-mono font-bold text-right outline-none transition-colors text-sm" onClick={e=>e.stopPropagation()}/></div></div>
                                            <div className="w-px h-6 bg-slate-800"></div>
                                            <div className="flex flex-col items-end w-16"><span className="text-[8px] text-slate-600 mb-0.5 uppercase">差額</span><span className={`text-[11px] font-mono ${d.actual&&(d.actual-Math.floor(d.amt*0.9789))<0?"text-red-400":"text-slate-400"}`}>{d.actual?formatMoney(d.actual-Math.floor(d.amt*0.9789)):'-'}</span></div>
                                        </div>
                                    </div>
                                ))}
                                {(!r.details||r.details.length===0) && <div className="text-slate-600 text-[10px] py-4 text-center bg-slate-950 rounded-lg border border-dashed border-slate-800">本月無配息戰役</div>}
                            </div>
                        </div>
                      </div></td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950 font-black text-slate-300 text-xs border-t-2 border-slate-800">
                  <td className="p-4 rounded-bl-lg">年度總計</td>
                  <td className="p-4 text-blue-400">{formatMoney(totalOtherIncome)}</td>
                  <td className="p-4 text-slate-500">預:{formatMoney(monthlyFlows.reduce((a,b)=>a+b.divProjected,0))}</td>
                  <td className="p-4 text-emerald-400 text-base">實:{formatMoney(totalDividend)}</td>
                  <td />
                  <td className="p-4 text-red-500" colSpan={6}>總消耗: {formatMoney(totalOut)}</td>
                  <td className={`p-4 text-right font-mono text-lg rounded-br-lg ${totalNet>=0?'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]':'text-red-500'}`}>{formatMoney(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 w-full max-w-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-3"><h3 className="text-xl font-black text-white flex items-center gap-2"><Settings className="text-emerald-400"/> 系統設定 (後台參數)</h3><button onClick={()=>setShowSettings(false)} className="p-1.5 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"><X size={18}/></button></div>
            <div className="space-y-6 text-sm">
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><label className="text-slate-400 block mb-2 font-bold text-xs uppercase tracking-wider flex items-center gap-2"><Wifi size={14} className="text-blue-400"/> Google Sheet CSV 行情連結</label><input type="text" value={cloudConfig.priceSourceUrl} onChange={e=>setCloudConfig({...cloudConfig, priceSourceUrl:e.target.value})} className="w-full bg-slate-900 p-2.5 rounded-lg border border-slate-700 outline-none focus:border-blue-500 text-xs text-slate-300" placeholder="https://docs.google.com/spreadsheets/..." /><div className="text-[10px] text-slate-500 mt-2">支援加入「除息日」、「發放日」欄位，系統將自動同步。</div></div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div><h4 className="text-yellow-500 font-bold mb-3 text-xs uppercase tracking-wider">稅務防禦力 (所得稅參數)</h4>
                  <div className="space-y-3">
                    <div><div className="flex justify-between mb-1"><label className="text-slate-400 text-[10px] font-bold">ETF 股息應稅比例 (54C)</label><span className="text-yellow-400 font-mono text-xs">{taxStatus.dividendTaxableRatio??30}%</span></div><input type="range" min="0" max="100" value={taxStatus.dividendTaxableRatio??30} onChange={e=>setTaxStatus({...taxStatus, dividendTaxableRatio:safeNum(e.target.value)})} className="w-full accent-yellow-500"/></div>
                    <div><label className="text-slate-400 text-[10px] font-bold mb-1 block">年薪資 (僅做為稅基計算)</label><input type="number" value={taxStatus.salaryIncome} onChange={e=>setTaxStatus({...taxStatus, salaryIncome:safeNum(e.target.value)})} className="w-full bg-slate-900 p-2 rounded-lg outline-none focus:border-yellow-500"/></div>
                    <div className="flex gap-4 bg-slate-900 p-2 rounded-lg"><label className="flex items-center gap-2 text-[10px] text-slate-300"><input type="checkbox" checked={taxStatus.hasSpouse} onChange={e=>setTaxStatus({...taxStatus, hasSpouse:e.target.checked})} className="accent-yellow-500 w-3 h-3"/>合併申報</label><label className="flex items-center gap-2 text-[10px] text-slate-300"><input type="checkbox" checked={taxStatus.isDisabled} onChange={e=>setTaxStatus({...taxStatus, isDisabled:e.target.checked})} className="accent-yellow-500 w-3 h-3"/>身心障礙</label></div>
                    <div className="flex gap-3"><div className="flex-1"><label className="text-slate-500 text-[10px] font-bold block mb-1">扶養人數</label><input type="number" value={taxStatus.dependents} onChange={e=>setTaxStatus({...taxStatus, dependents:safeNum(e.target.value)})} className="w-full bg-slate-900 p-2 rounded-lg outline-none focus:border-yellow-500"/></div><div className="flex-1"><label className="text-slate-500 text-[10px] font-bold block mb-1">身障額度數</label><input type="number" value={taxStatus.disabilityCount} onChange={e=>setTaxStatus({...taxStatus, disabilityCount:safeNum(e.target.value)})} className="w-full bg-slate-900 p-2 rounded-lg outline-none focus:border-yellow-500"/></div></div>
                  </div>
                </div>
                
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div><h4 className="text-blue-400 font-bold mb-3 text-xs uppercase tracking-wider">日常消耗 & 其他借貸</h4>
                  <div className="space-y-3">
                    <div><label className="text-slate-400 text-[10px] font-bold block mb-1">全域預設月生活費</label><input type="number" value={taxStatus.livingExpenses} onChange={e=>setTaxStatus({...taxStatus, livingExpenses:safeNum(e.target.value)})} className="w-full bg-slate-900 p-2 rounded-lg outline-none focus:border-blue-500 text-emerald-400 font-mono"/></div>
                    <div className="flex gap-3 bg-slate-900 p-2 rounded-lg"><div className="flex-1"><label className="text-slate-500 text-[10px] block mb-1">信貸餘額</label><input type="number" value={creditLoan.principal} onChange={e=>setCreditLoan({...creditLoan, principal:safeNum(e.target.value)})} className="w-full bg-slate-950 p-1.5 rounded outline-none focus:border-blue-500"/></div><div className="w-16"><label className="text-slate-500 text-[10px] block mb-1">利率%</label><input type="number" value={creditLoan.rate} onChange={e=>setCreditLoan({...creditLoan, rate:safeNum(e.target.value)})} className="w-full bg-slate-950 p-1.5 rounded outline-none focus:border-blue-500"/></div></div>
                    <div className="flex gap-3 bg-slate-900 p-2 rounded-lg"><div className="flex-1"><label className="text-slate-500 text-[10px] block mb-1">借貸本金 (維持率)</label><input type="number" value={stockLoan.principal} onChange={e=>setStockLoan({...stockLoan, principal:safeNum(e.target.value)})} className="w-full bg-slate-950 p-1.5 rounded outline-none focus:border-blue-500"/></div><div className="w-16"><label className="text-slate-500 text-[10px] block mb-1">利率%</label><input type="number" value={stockLoan.rate} onChange={e=>setStockLoan({...stockLoan, rate:safeNum(e.target.value)})} className="w-full bg-slate-950 p-1.5 rounded outline-none focus:border-blue-500"/></div></div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div><h4 className="text-purple-400 font-bold mb-3 text-xs uppercase tracking-wider flex items-center justify-between">固定支出設定 (車貸、網路費等)<button onClick={()=>setFixedExps(p=>[...p,{id:Date.now().toString(),name:'新支出',amount:0}])} className="text-[10px] bg-purple-900/30 text-purple-400 px-2 py-1 rounded hover:bg-purple-900/50 flex items-center gap-1"><Plus size={10}/> 新增支出</button></h4>
                <div className="space-y-2">
                    {fixedExps.map((f, i) => (
                      <div key={f.id} className="flex gap-2 bg-slate-900 p-2 rounded border border-slate-800">
                        <input type="text" value={f.name} onChange={e=>setFixedExps(p=>{const n=[...p];n[i].name=e.target.value;return n;})} className="w-1/2 bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-purple-500" placeholder="名稱"/>
                        <input type="number" value={f.amount} onChange={e=>setFixedExps(p=>{const n=[...p];n[i].amount=safeNum(e.target.value);return n;})} className="w-1/2 bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-purple-500 font-mono" placeholder="金額"/>
                        <button onClick={()=>setFixedExps(p=>p.filter(x=>x.id!==f.id))} className="p-1.5 text-slate-600 hover:text-red-500 bg-slate-950 rounded"><Trash2 size={12}/></button>
                      </div>
                    ))}
                    {fixedExps.length === 0 && <div className="text-center py-2 text-xs text-slate-600 border border-dashed border-slate-800 rounded-lg">目前無固定支出</div>}
                </div>
              </div>
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div><h4 className="text-red-400 font-bold mb-3 text-xs uppercase tracking-wider flex items-center justify-between">房貸戰線設定<button onClick={()=>setLoans(p=>[...p,{id:Date.now().toString(),name:'新房貸',principal:0,rate1:2.1,rate1Months:36,rate2:2.3,totalMonths:360,paidMonths:0,gracePeriod:0,type:'PrincipalAndInterest'}])} className="text-[10px] bg-red-900/30 text-red-400 px-2 py-1 rounded hover:bg-red-900/50 flex items-center gap-1"><Plus size={10}/> 新增房貸</button></h4>
                <div className="space-y-3">
                    {loans.map((l, i) => (
                      <div key={l.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                        <div className="flex gap-3 mb-2"><div className="w-1/3"><label className="text-slate-500 text-[9px] block mb-0.5">名稱</label><input type="text" value={l.name} onChange={e=>updateLoan(i,'name',e.target.value)} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500"/></div><div className="flex-1"><label className="text-slate-500 text-[9px] block mb-0.5">本金</label><input type="number" value={l.principal} onChange={e=>updateLoan(i,'principal',safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500 font-mono"/></div><div className="w-8 flex items-end justify-end"><button onClick={()=>setLoans(p=>p.filter(x=>x.id!==l.id))} className="p-1.5 text-slate-600 hover:text-red-500 bg-slate-950 rounded mb-0.5"><Trash2 size={12}/></button></div></div>
                        <div className="grid grid-cols-4 gap-2 mb-2"><div><label className="text-slate-600 text-[8px] block mb-0.5">1段利率%</label><input type="number" step="0.001" value={l.rate1} onChange={e=>updateLoan(i,'rate1',safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500"/></div><div><label className="text-slate-600 text-[8px] block mb-0.5">1段月數</label><input type="number" value={l.rate1Months} onChange={e=>updateLoan(i,'rate1Months',safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500"/></div><div><label className="text-slate-600 text-[8px] block mb-0.5">2段利率%</label><input type="number" step="0.001" value={l.rate2} onChange={e=>updateLoan(i,'rate2',safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500"/></div><div><label className="text-slate-600 text-[8px] block mb-0.5">總期數</label><input type="number" value={l.totalMonths} onChange={e=>updateLoan(i,'totalMonths',safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500"/></div></div>
                        <div className="grid grid-cols-3 gap-2"><div><label className="text-emerald-500/70 text-[8px] font-bold block mb-0.5">撥款日 (動態起算)</label><input type="date" value={l.startDate||''} onChange={e=>updateLoan(i,'startDate',e.target.value)} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none border border-emerald-900/50 focus:border-emerald-500 text-slate-300"/></div><div><label className="text-slate-600 text-[8px] block mb-0.5">寬限期(月)</label><input type="number" value={l.gracePeriod} onChange={e=>updateLoan(i,'gracePeriod',safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500"/></div><div><label className="text-slate-600 text-[8px] block mb-0.5">已繳</label><input type="number" disabled value={l.paidMonths} className="w-full bg-slate-950/50 p-1.5 rounded text-xs text-slate-600 font-mono"/></div></div>
                      </div>
                    ))}
                    {loans.length === 0 && <div className="text-center py-4 text-xs text-slate-600 border border-dashed border-slate-800 rounded-lg">目前無房貸負擔</div>}
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex gap-3">
                <button onClick={() => setShowSettings(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-colors">取消 / 返回</button>
                <button onClick={() => setShowSettings(false)} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black shadow-[0_0_15px_rgba(5,150,105,0.4)] hover:bg-emerald-500 transition-all transform hover:scale-[1.02]">儲存設定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
