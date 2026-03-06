import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import {
  Calculator,
  Activity,
  Upload,
  Download,
  RotateCcw,
  Settings,
  Loader2,
  TrendingUp,
  RefreshCw,
  PieChart as PieIcon,
  ShieldCheck,
  List,
  Trash2,
  X,
  ShoppingCart,
  ArrowUp,
  ArrowDown,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Calendar,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trophy,
  Crown,
  Zap,
  Target,
  Swords,
  Coins
} from 'lucide-react';

// --- Firebase SDK ---
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// ==========================================
// 1. Firebase 設定
// ==========================================
const YOUR_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCM42AelwEWTC4R_V0sgF0FbomkoXdE4T0',
  authDomain: 'baozutang-finance.firebaseapp.com',
  projectId: 'baozutang-finance',
  storageBucket: 'baozutang-finance.firebasestorage.app',
  messagingSenderId: '674257527078',
  appId: '1:674257527078:web:80018b440a826c2ef061e7',
};

const COLLECTION_NAME = 'portfolios';
const DOCUMENT_ID = 'tony1006';

// ==========================================
// 2. 定義介面
// ==========================================
interface Lot { id: string; date: string; shares: number; price: number; fee?: number; margin?: number; }
interface DividendEvent { id: string; year: number; name: string; exDate: string; payDate: string; amount: number; isActual: boolean; }
interface ETF {
  id: string; code?: string; name: string; shares: number; costPrice: number; currentPrice: number;
  dividendPerShare: number; dividendType?: 'annual' | 'per_period'; payMonths?: number[];
  category: 'dividend' | 'hedging' | 'active'; marginLoanAmount?: number; marginInterestRate?: number;
  lots?: Lot[]; schedule?: DividendEvent[];
}
interface Loan { id: string; name: string; principal: number; rate1: number; rate1Months: number; rate2: number; totalMonths: number; paidMonths: number; gracePeriod: number; startDate?: string; type: string; }
interface StockLoan { principal: number; rate: number; maintenanceLimit?: number; }
interface CreditLoan { principal: number; rate: number; totalMonths: number; paidMonths: number; }
interface TaxStatus { salaryIncome: number; livingExpenses: number; dependents: number; hasSpouse: boolean; isDisabled: boolean; disabilityCount: number; }
interface AllocationConfig { totalFunds: number; dividendRatio: number; hedgingRatio: number; activeRatio: number; }
interface CloudConfig { priceSourceUrl: string; enabled: boolean; }
interface ActualDetails { [key: string]: number; }

type PersistedPayload = {
  etfs: ETF[]; loans: Loan[]; stockLoan: StockLoan; creditLoan: CreditLoan; globalMarginLoan: StockLoan;
  taxStatus: TaxStatus; allocation: AllocationConfig; cloudConfig: CloudConfig; actualDetails: ActualDetails;
  _meta?: { schema: number; updatedAt: number };
};

// ==========================================
// 3. 預設資料與常數
// ==========================================
const APP_SCHEMA_VERSION = 81;
const LOCAL_KEY = 'baozutang_local';

const TONY_DEFAULT_ETFS: ETF[] = []; // 初始化留空，由 Firebase 或 LocalStorage 載入

const DEFAULT_STOCK_LOAN: StockLoan = { rate: 2.56, principal: 0 };
const DEFAULT_GLOBAL_MARGIN: StockLoan = { rate: 4.5, principal: 0 };
const DEFAULT_CREDIT: CreditLoan = { rate: 4.05, totalMonths: 84, principal: 0, paidMonths: 0 };
const DEFAULT_TAX: TaxStatus = { salaryIncome: 589200, livingExpenses: 0, hasSpouse: true, isDisabled: true, dependents: 0, disabilityCount: 1 };
const DEFAULT_ALLOC: AllocationConfig = { activeRatio: 5, hedgingRatio: 15, dividendRatio: 80, totalFunds: 14500000 };
const DEFAULT_CLOUD: CloudConfig = { priceSourceUrl: '', enabled: true };

const BROKERAGE_RATE = 0.001425;
const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#a855f7' };

const fmtTwd0 = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const formatMoney = (val: any) => `$${fmtTwd0.format(Math.round(Number(val) || 0))}`;

const toTime = (s: string) => { const t = new Date(s).getTime(); return Number.isFinite(t) ? t : NaN; };
const safeNum = (v: any, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

// ==========================================
// 4. 計算工具 (V81 修復核心：動態房貸引擎)
// ==========================================
const calculateIncomeTax = (salary: number, dividend: number, status: TaxStatus) => {
  const exemption = 97000 * (1 + (status.hasSpouse ? 1 : 0) + status.dependents);
  const stdDed = status.hasSpouse ? 262000 : 131000;
  const salaryDed = Math.min(salary, 218000 * (1 + (status.hasSpouse ? 1 : 0)));
  const disabilityDed = 218000 * (status.disabilityCount || (status.isDisabled ? 1 : 0));
  const totalDeductions = exemption + stdDed + salaryDed + disabilityDed;
  const grossIncome = salary + dividend;
  const netTaxableIncome = Math.max(0, grossIncome - totalDeductions);

  let grossTax = 0;
  if (netTaxableIncome <= 610000) grossTax = netTaxableIncome * 0.05;
  else if (netTaxableIncome <= 1380000) grossTax = netTaxableIncome * 0.12 - 42700;
  else if (netTaxableIncome <= 2660000) grossTax = netTaxableIncome * 0.2 - 153100;
  else grossTax = netTaxableIncome * 0.3 - 419100;

  const dividendCredit = Math.min(80000, dividend * 0.085);
  return Math.floor(grossTax - dividendCredit);
};

// V81 修復: 傳入「當下算出的已繳期數(dynamicPaid)」，精準判斷是否過寬限期
const calculateLoanPayment = (loan: Loan, dynamicPaid: number) => {
  const p = safeNum(loan.principal);
  const grace = safeNum(loan.gracePeriod);
  const totalMonths = safeNum(loan.totalMonths);

  if (p <= 0 || dynamicPaid >= totalMonths) return 0;

  // 還在寬限期內：只繳利息
  if (dynamicPaid < grace) {
    const r = safeNum(loan.rate1) / 100 / 12;
    return Math.floor(p * r);
  }

  // 過了寬限期：本息攤還
  const rateAnnual = dynamicPaid < safeNum(loan.rate1Months) ? safeNum(loan.rate1) : safeNum(loan.rate2);
  const r = rateAnnual / 100 / 12;
  
  // 本息攤還的「期數」是：總期數 - 寬限期 (例如 240 - 48 = 192 期攤還)
  const amortizationMonths = Math.max(1, totalMonths - grace);

  if (r === 0) return Math.floor(p / amortizationMonths);
  return Math.floor((p * r * Math.pow(1 + r, amortizationMonths)) / (Math.pow(1 + r, amortizationMonths) - 1));
};

const recalculateEtfStats = (etf: ETF): ETF => {
  const lots = etf.lots || [];
  const totalShares = lots.reduce((acc, lot) => acc + safeNum(lot.shares), 0);
  const totalCost = lots.reduce((acc, lot) => acc + safeNum(lot.shares) * safeNum(lot.price) + safeNum(lot.fee), 0);
  const totalMargin = lots.reduce((acc, lot) => acc + safeNum(lot.margin), 0);
  return { ...etf, shares: totalShares > 0 ? totalShares : safeNum(etf.shares), costPrice: totalShares > 0 ? Number((totalCost / totalShares).toFixed(2)) : safeNum(etf.costPrice), marginLoanAmount: totalMargin > 0 ? totalMargin : safeNum(etf.marginLoanAmount) };
};

const generateCashFlow = (etfs: ETF[], loans: Loan[], stockLoan: StockLoan, creditLoan: CreditLoan, globalMarginLoan: StockLoan, taxStatus: TaxStatus, actualDetails: ActualDetails, selectedYear: number) => {
  const flows: any[] = [];
  const monthlySalary = safeNum(taxStatus.salaryIncome) / 12;

  let annualDividendProjected = 0;
  etfs.forEach((e) => {
    const yearEvents = e.schedule?.filter((ev) => ev.year === selectedYear) || [];
    if (yearEvents.length > 0) {
      yearEvents.forEach((event) => { annualDividendProjected += safeNum(e.shares) * safeNum(event.amount); });
    } else {
      const payout = safeNum(e.dividendPerShare);
      if (e.dividendType === 'annual') annualDividendProjected += safeNum(e.shares) * payout;
      else if (e.payMonths) annualDividendProjected += safeNum(e.shares) * payout * e.payMonths.length;
    }
  });

  const annualIncomeTax = calculateIncomeTax(safeNum(taxStatus.salaryIncome), annualDividendProjected, taxStatus);
  const monthlyIncomeTaxImpact = annualIncomeTax / 12;

  for (let m = 1; m <= 12; m++) {
    let divInProjected = 0;
    let divActualTotal = 0;
    const contributingEtfs: { id: string; name: string; amt: number; qualifiedShares: number; totalShares: number; exDate: string; actual?: number; }[] = [];

    etfs.forEach((e) => {
      const yearEvents = e.schedule?.filter((ev) => ev.year === selectedYear) || [];

      if (yearEvents.length > 0) {
        yearEvents.forEach((event) => {
          if (!event.payDate) return;
          const payMonth = parseInt(event.payDate.split('-')[1] || '', 10);
          if (!Number.isFinite(payMonth) || payMonth !== m) return;

          const exT = toTime(event.exDate);
          let qualifiedShares = 0;

          if (e.lots && e.lots.length > 0) {
            e.lots.forEach((lot) => {
              const lotT = toTime(lot.date);
              if (!Number.isFinite(exT)) { qualifiedShares += safeNum(lot.shares); }
              else if (Number.isFinite(lotT) && lotT < exT) { qualifiedShares += safeNum(lot.shares); }
            });
          } else { qualifiedShares = safeNum(e.shares); }

          const projectedAmt = Math.floor(qualifiedShares * safeNum(event.amount));
          divInProjected += projectedAmt;

          const actualKey = `${selectedYear}_${m}_${e.id}`;
          const actualAmt = actualDetails[actualKey] !== undefined ? safeNum(actualDetails[actualKey]) : 0;
          if (actualAmt > 0) divActualTotal += actualAmt;

          contributingEtfs.push({ id: e.id, name: e.name, amt: projectedAmt, qualifiedShares, totalShares: safeNum(e.shares), exDate: event.exDate || '未填', actual: actualAmt });
        });
      } else if (e.payMonths?.includes(m)) {
        let payout = safeNum(e.dividendPerShare);
        if (e.dividendType === 'annual' && e.payMonths.length > 0) payout /= e.payMonths.length;

        const projectedAmt = Math.floor(safeNum(e.shares) * payout);
        divInProjected += projectedAmt;
        
        const actualKey = `${selectedYear}_${m}_${e.id}`;
        const actualAmt = actualDetails[actualKey] !== undefined ? safeNum(actualDetails[actualKey]) : 0;
        if (actualAmt > 0) divActualTotal += actualAmt;

        contributingEtfs.push({ id: e.id, name: e.name, amt: projectedAmt, qualifiedShares: safeNum(e.shares), totalShares: safeNum(e.shares), exDate: '預估', actual: actualAmt });
      }
    });

    const healthTaxProjected = Math.floor(divInProjected * 0.0211);
    const divUsed = divActualTotal > 0 ? divActualTotal : divInProjected - healthTaxProjected;

    // V81 修復：動態計算房貸已繳期數 (穿越時空也不會錯)
    let loanOut = 0; 
    loans.forEach((l) => {
      let dynamicPaid = safeNum(l.paidMonths);
      if (l.startDate) {
        const start = new Date(l.startDate);
        if (!isNaN(start.getTime())) {
          // 計算從撥款日到「目標年月」經過了幾個月
          const elapsed = (selectedYear - start.getFullYear()) * 12 + (m - (start.getMonth() + 1));
          dynamicPaid = Math.max(0, elapsed);
        }
      } else {
        // 如果沒填日期，就用現在時間去推算
        const today = new Date();
        const elapsed = (selectedYear - today.getFullYear()) * 12 + (m - (today.getMonth() + 1));
        dynamicPaid = Math.max(0, safeNum(l.paidMonths) + elapsed);
      }
      loanOut += calculateLoanPayment(l, dynamicPaid);
    });

    // V81 修復：動態計算信貸已繳期數
    const today = new Date();
    const dynamicCreditPaid = Math.max(0, safeNum(creditLoan.paidMonths) + (selectedYear - today.getFullYear()) * 12 + (m - (today.getMonth() + 1)));
    const creditPrincipal = safeNum(creditLoan.principal);
    const creditRate = safeNum(creditLoan.rate) / 100 / 12;
    const totalCreditMonths = safeNum(creditLoan.totalMonths);
    let creditOut = 0;
    
    if (creditPrincipal > 0 && dynamicCreditPaid < totalCreditMonths) {
      if (creditRate === 0) creditOut = Math.floor(creditPrincipal / totalCreditMonths);
      else { creditOut = Math.floor((creditPrincipal * creditRate * Math.pow(1 + creditRate, totalCreditMonths)) / (Math.pow(1 + creditRate, totalCreditMonths) - 1)); }
    }

    const stockInt = Math.floor((safeNum(stockLoan.principal) * (safeNum(stockLoan.rate) / 100)) / 12) + Math.floor((safeNum(globalMarginLoan.principal) * (safeNum(globalMarginLoan.rate) / 100)) / 12);
    const marginInt = etfs.reduce((acc, e) => acc + (safeNum(e.marginLoanAmount) * (safeNum(e.marginInterestRate, 6.5) / 100)) / 12, 0);
    const healthTaxReal = divActualTotal > 0 ? 0 : healthTaxProjected;

    flows.push({
      month: m, salary: monthlySalary, divProjected: divInProjected, divActualTotal, 
      loanOut, creditOut, stockInt: stockInt + marginInt, life: safeNum(taxStatus.livingExpenses),
      healthTax: healthTaxReal, incomeTax: monthlyIncomeTaxImpact,
      net: monthlySalary + divUsed - loanOut - creditOut - (stockInt + marginInt) - safeNum(taxStatus.livingExpenses) - healthTaxReal - monthlyIncomeTaxImpact,
      details: contributingEtfs,
    });
  }
  return flows;
};

// ==========================================
// 5. Firebase 初始化
// ==========================================
let db: any = null;
try { const app = getApps().length ? getApps()[0] : initializeApp(YOUR_FIREBASE_CONFIG); db = getFirestore(app); } catch (e) { db = null; }

// ==========================================
// 6. StorageService
// ==========================================
const withMeta = (payload: Omit<PersistedPayload, '_meta'>): PersistedPayload => ({ ...payload, _meta: { schema: APP_SCHEMA_VERSION, updatedAt: Date.now() } });
const getUpdatedAt = (d: any) => safeNum(d?._meta?.updatedAt, 0);
const sanitizePayload = (d: any): PersistedPayload => {
  const etfs: ETF[] = Array.isArray(d?.etfs) && d.etfs.length > 0 ? d.etfs : [];
  const cleanedEtfs = etfs.map((e: any) => ({
    ...e,
    dividendType: e?.dividendType || 'per_period',
    payMonths: Array.isArray(e?.payMonths) ? e.payMonths : [],
    schedule: (Array.isArray(e?.schedule) ? e.schedule : []).map((ev: any) => ({ ...ev, year: ev.year || (ev.payDate ? parseInt(ev.payDate.split('-')[0], 10) : 2026) || 2026 })),
    lots: Array.isArray(e?.lots) ? e.lots : e?.lots ? [] : e?.lots,
  }));
  const oldActuals = d?.actualDetails || d?.actuals || {};
  const newActuals: ActualDetails = {};
  Object.keys(oldActuals).forEach(k => { if (k.split('_').length === 2) { newActuals[`2026_${k}`] = oldActuals[k]; } else { newActuals[k] = oldActuals[k]; } });
  return { etfs: cleanedEtfs, loans: Array.isArray(d?.loans) ? d.loans : [], stockLoan: d?.stockLoan || DEFAULT_STOCK_LOAN, creditLoan: d?.creditLoan || DEFAULT_CREDIT, globalMarginLoan: d?.globalMarginLoan || DEFAULT_GLOBAL_MARGIN, taxStatus: d?.taxStatus || DEFAULT_TAX, allocation: d?.allocation || DEFAULT_ALLOC, cloudConfig: d?.cloudConfig || DEFAULT_CLOUD, actualDetails: newActuals, _meta: d?._meta };
};

const StorageService = {
  saveData: async (data: Omit<PersistedPayload, '_meta'>) => {
    const payload = withMeta(data);
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(payload)); } catch (e) {}
    let cloudOk = false;
    if (db) { try { await setDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID), payload, { merge: true }); cloudOk = true; } catch (e) {} }
    return { localOk: true, cloudOk };
  },
  loadData: async () => {
    const readLocal = () => { try { const raw = localStorage.getItem(LOCAL_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
    const local = readLocal();
    let cloud: any = null;
    if (db) { try { const snap = await getDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID)); cloud = snap.exists() ? snap.data() : null; } catch (e) {} }
    const pickCloud = getUpdatedAt(cloud) >= getUpdatedAt(local);
    const picked = (pickCloud ? cloud : local) || null;
    return { data: picked ? sanitizePayload(picked) : null, source: picked ? (pickCloud ? 'cloud' : 'local') : 'none' };
  },
  exportToFile: (data: Omit<PersistedPayload, '_meta'>) => {
    const payload = withMeta(data);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `baozutang_backup.json`; a.click();
  },
  clearLocal: () => { try { localStorage.removeItem(LOCAL_KEY); } catch {} }
};

// ==========================================
// 7. CSV 更新行情
// ==========================================
const normalizeSheetUrl = (url: string) => { if (!url) return url; if (url.includes('/spreadsheets/') && url.includes('/edit')) { return url.replace(/\/edit.*$/, '/export?format=csv'); } return url; };
const parseCsvPriceMap = (text: string) => {
  const rows = text.trim().split(/\r?\n/).map((r) => r.split(',').map((x) => x.trim())).filter((r) => r.length >= 2 && r[0]);
  const map = new Map<string, number>();
  rows.forEach((row) => { const code = row[0]; if (!code || code.toLowerCase() === 'code') return; const price = parseFloat(row[1]); if (Number.isFinite(price)) map.set(code, price); });
  return map;
};

// ==========================================
// 8. App 主程式
// ==========================================
const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dataSrc, setDataSrc] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stockLoan, setStockLoan] = useState<StockLoan>(DEFAULT_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(DEFAULT_GLOBAL_MARGIN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(DEFAULT_CREDIT);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(DEFAULT_TAX);
  const [allocation, setAllocation] = useState<AllocationConfig>(DEFAULT_ALLOC);
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(DEFAULT_CLOUD);
  const [actualDetails, setActualDetails] = useState<ActualDetails>({});
  const [reinvest, setReinvest] = useState(true);

  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState({ shares: '', price: '', date: '', margin: '' });
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [showCalendar, setShowCalendar] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    StorageService.loadData().then((res) => {
      setDataSrc(res.source);
      if (res.data) {
        const d = res.data;
        setEtfs(d.etfs || []);
        setLoans(d.loans || []);
        setStockLoan(d.stockLoan || DEFAULT_STOCK_LOAN);
        setGlobalMarginLoan(d.globalMarginLoan || DEFAULT_GLOBAL_MARGIN);
        setCreditLoan(d.creditLoan || DEFAULT_CREDIT);
        setTaxStatus(d.taxStatus || DEFAULT_TAX);
        setAllocation(d.allocation || DEFAULT_ALLOC);
        setCloudConfig(d.cloudConfig || DEFAULT_CLOUD);
        setActualDetails(d.actualDetails || {});
      }
      setIsInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      try {
        const res = await StorageService.saveData({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, actualDetails });
        setDataSrc(res.cloudOk ? 'cloud' : 'local');
        setSaveStatus(res.cloudOk ? 'saved' : 'error');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) { setSaveStatus('error'); }
    }, 1200);
    return () => clearTimeout(t);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, actualDetails, isInitializing]);

  const monthlyFlows = useMemo(
    () => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, actualDetails, selectedYear),
    [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, actualDetails, selectedYear]
  );

  const totalDividend = monthlyFlows.reduce((a, b) => a + (b.divActualTotal > 0 ? b.divActualTotal : b.divProjected * 0.9789), 0);
  const totalSalary = monthlyFlows.reduce((a, b) => a + b.salary, 0);
  const totalOut = monthlyFlows.reduce((a, b) => a + b.loanOut + b.creditOut + b.stockInt + b.life + b.healthTax + b.incomeTax, 0);
  const totalNet = totalSalary + totalDividend - totalOut;

  const totalValue = etfs.reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice), 0);
  const totalStockDebt = safeNum(stockLoan.principal) + safeNum(globalMarginLoan.principal) + etfs.reduce((a, e) => a + safeNum(e.marginLoanAmount), 0);
  const currentMaintenance = totalStockDebt === 0 ? 999 : (totalValue / totalStockDebt) * 100;

  const actualDiv = etfs.filter((e) => e.category === 'dividend').reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);
  const actualHedge = etfs.filter((e) => e.category === 'hedging').reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);
  const actualAct = etfs.filter((e) => e.category === 'active').reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);

  const combatPower = Math.floor(totalValue / 10000 + totalDividend / 12 / 100);
  const fireRatio = totalOut > 0 ? (totalDividend / totalOut) * 100 : 0;

  // V81: 遊戲化成就系統
  const { currentRank, nextRank, progress, healthGrade, earnedAchievements } = useMemo(() => {
    let cRank = '理財新手 🌱'; let nRank = '築基騎士 ⚔️'; let prog = 0;
    if (fireRatio >= 100) { cRank = '財富神祇 🌟'; nRank = 'MAX'; prog = 100; }
    else if (fireRatio >= 60) { cRank = '財富國王 👑'; nRank = '財富神祇 🌟'; prog = ((fireRatio - 60) / 40) * 100; }
    else if (fireRatio >= 30) { cRank = '資產領主 🏰'; nRank = '財富國王 👑'; prog = ((fireRatio - 30) / 30) * 100; }
    else if (fireRatio >= 10) { cRank = '築基騎士 ⚔️'; nRank = '資產領主 🏰'; prog = ((fireRatio - 10) / 20) * 100; }
    else { prog = (fireRatio / 10) * 100; }

    let grade = 'C';
    if (fireRatio >= 80 && currentMaintenance >= 160 && totalNet > 0) grade = 'SSS';
    else if (fireRatio >= 50 && currentMaintenance >= 140) grade = 'S';
    else if (fireRatio >= 30 && currentMaintenance >= 130) grade = 'A';
    else if (fireRatio >= 10) grade = 'B';

    const ach = [];
    if (totalValue >= 10000000) ach.push({ icon: '💰', title: '千萬俱樂部', desc: '總資產突破一千萬' });
    if (totalValue >= 20000000) ach.push({ icon: '💎', title: '兩千萬霸主', desc: '總資產突破兩千萬' });
    if (totalDividend / 12 >= 100000) ach.push({ icon: '🔥', title: '月入十萬', desc: '平均月被動收入達十萬' });
    if (currentMaintenance >= 200 || currentMaintenance === 999) ach.push({ icon: '🛡️', title: '無敵鐵壁', desc: '維持率極度安全' });
    if (totalOut > 0 && totalNet > 0) ach.push({ icon: '📈', title: '正向循環', desc: '淨現金流為正數' });

    return { currentRank: cRank, nextRank: nRank, progress: Math.min(100, Math.max(0, prog)), healthGrade: grade, earnedAchievements: ach };
  }, [fireRatio, totalValue, totalDividend, currentMaintenance, totalNet]);

  // V81 修復：雪球推算也要包含未來的「寬限期結束」動態計算
  const snowballData = useMemo(() => {
    const avgYield = totalValue > 0 ? totalDividend / totalValue : 0.05;
    const data: any[] = [];
    let curWealth = totalValue;
    
    for (let y = 0; y <= 10; y++) {
      const futureYear = selectedYear + y;
      
      let futureLoanOut = 0;
      loans.forEach((l) => {
        for(let m=1; m<=12; m++) {
          let dynamicPaid = safeNum(l.paidMonths);
          if (l.startDate) {
            const start = new Date(l.startDate);
            if (!isNaN(start.getTime())) dynamicPaid = Math.max(0, (futureYear - start.getFullYear()) * 12 + (m - (start.getMonth() + 1)));
          } else {
            const today = new Date();
            dynamicPaid = Math.max(0, safeNum(l.paidMonths) + (futureYear - today.getFullYear()) * 12 + (m - (today.getMonth() + 1)));
          }
          futureLoanOut += calculateLoanPayment(l, dynamicPaid);
        }
      });

      let futureCreditOut = 0;
      const creditPrincipal = safeNum(creditLoan.principal);
      const creditRate = safeNum(creditLoan.rate) / 100 / 12;
      const totalCreditMonths = safeNum(creditLoan.totalMonths);
      for(let m=1; m<=12; m++) {
          const today = new Date();
          const dynamicCreditPaid = Math.max(0, safeNum(creditLoan.paidMonths) + (futureYear - today.getFullYear()) * 12 + (m - (today.getMonth() + 1)));
          if (creditPrincipal > 0 && dynamicCreditPaid < totalCreditMonths) {
              futureCreditOut += creditRate === 0 ? Math.floor(creditPrincipal / totalCreditMonths) : Math.floor((creditPrincipal * creditRate * Math.pow(1 + creditRate, totalCreditMonths)) / (Math.pow(1 + creditRate, totalCreditMonths) - 1));
          }
      }

      const fStockInt = (Math.floor((safeNum(stockLoan.principal) * (safeNum(stockLoan.rate) / 100)) / 12) + Math.floor((safeNum(globalMarginLoan.principal) * (safeNum(globalMarginLoan.rate) / 100)) / 12)) * 12;
      const fMarginInt = etfs.reduce((acc, e) => acc + (safeNum(e.marginLoanAmount) * (safeNum(e.marginInterestRate, 6.5) / 100)) / 12, 0) * 12;
      const fLife = safeNum(taxStatus.livingExpenses) * 12;
      const fSalary = safeNum(taxStatus.salaryIncome);
      const fDiv = curWealth * avgYield;
      const fHealthTax = Math.floor(fDiv * 0.0211);
      const fIncomeTax = calculateIncomeTax(fSalary, fDiv, taxStatus);
      
      const futureNet = fSalary + fDiv - futureLoanOut - futureCreditOut - fStockInt - fMarginInt - fLife - fHealthTax - fIncomeTax;

      data.push({ year: `Y${y}`, wealth: Math.floor(curWealth) });
      curWealth = curWealth * 1.05 + (reinvest ? fDiv : 0) + (futureNet - fDiv); 
    }
    return data;
  }, [totalValue, totalDividend, reinvest, loans, creditLoan, stockLoan, globalMarginLoan, taxStatus, etfs, selectedYear]);

  const pieData = [{ name: '配息', value: Math.max(1, actualDiv), color: COLORS.dividend }, { name: '避險', value: Math.max(1, actualHedge), color: COLORS.hedging }, { name: '主推', value: Math.max(1, actualAct), color: COLORS.active }];
  const radarData = [{ subject: '現金流', A: Math.min(100, fireRatio) }, { subject: '安全性', A: Math.min(100, (actualHedge / (totalValue - totalStockDebt || 1)) * 500) }, { subject: '維持率', A: Math.min(100, (currentMaintenance - 130) * 2) }, { subject: '成長', A: Math.min(100, (actualAct / (totalValue - totalStockDebt || 1)) * 500) }];

  const moveEtf = (i: number, d: number) => { setEtfs((prev) => { const n = [...prev]; if (i + d < 0 || i + d >= n.length) return prev; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; }); };
  const removeEtf = (id: string) => { if (confirm('確定刪除？')) setEtfs((prev) => prev.filter((e) => e.id !== id)); };
  const updateLoan = (i: number, f: string, v: any) => { setLoans((prev) => { const n = [...prev]; if (!n[i]) return prev; if (f === 'startDate' && v) { const start = new Date(v); const now = new Date(); const dm = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()); n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, dm) }; } else { n[i] = { ...n[i], [f]: v }; } return n; }); };
  const updateDetailActual = (year: number, month: number, etfId: string, val: number) => { setActualDetails((prev) => ({ ...prev, [`${year}_${month}_${etfId}`]: safeNum(val) })); };
  
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
        const evs: DividendEvent[] = [1, 2, 3, 4].map((q) => ({
          id: `${Date.now()}-q${q}`, year: selectedYear, name: `${selectedYear} Q${q}`,
          exDate: '', payDate: '', amount: safeNum(etf.dividendPerShare), isActual: false,
        }));
        return { ...etf, schedule: [...(etf.schedule || []), ...evs] };
    }));
  };

  const handleUpdatePrices = async () => {
    if (!cloudConfig.priceSourceUrl) { alert('請輸入連結！'); setShowSettings(true); return; }
    setIsUpdatingPrices(true);
    try {
      const res = await fetch(normalizeSheetUrl(cloudConfig.priceSourceUrl)); const text = await res.text(); const priceMap = parseCsvPriceMap(text);
      setEtfs((prev) => prev.map((e) => { const key = (e.code || e.id || '').trim(); return priceMap.has(key) ? { ...e, currentPrice: priceMap.get(key)! } : e; }));
      alert('行情更新成功！');
    } catch (e) { alert('更新失敗'); } finally { setIsUpdatingPrices(false); }
  };

  const handleReset = async () => {
    if (!confirm('確定清空並重置為空資料嗎？')) return;
    StorageService.clearLocal();
    setEtfs([]); setLoans([]); setStockLoan(DEFAULT_STOCK_LOAN); setGlobalMarginLoan(DEFAULT_GLOBAL_MARGIN); setCreditLoan(DEFAULT_CREDIT); setTaxStatus(DEFAULT_TAX); setAllocation(DEFAULT_ALLOC); setCloudConfig(DEFAULT_CLOUD); setActualDetails({});
    try { await StorageService.saveData({ etfs: [], loans: [], stockLoan: DEFAULT_STOCK_LOAN, creditLoan: DEFAULT_CREDIT, globalMarginLoan: DEFAULT_GLOBAL_MARGIN, taxStatus: DEFAULT_TAX, allocation: DEFAULT_ALLOC, cloudConfig: DEFAULT_CLOUD, actualDetails: {} }); window.location.reload(); } catch (e) {}
  };

  if (isInitializing) { return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-sans"><Loader2 className="animate-spin mr-2" /> 雲端同步中...</div>; }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-900 text-white font-sans selection:bg-emerald-500/30">
      <header className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2"><Calculator /> 包租唐戰情室 V81</h1>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 flex items-center gap-1">
              {saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin text-amber-400" /> : saveStatus === 'saved' ? <CheckCircle2 size={12} className="text-emerald-400" /> : saveStatus === 'error' ? <AlertTriangle size={12} className="text-red-400" /> : dataSrc === 'cloud' ? <Wifi size={12} className="text-blue-400" /> : <WifiOff size={12} className="text-slate-500" />}
              {dataSrc === 'cloud' ? '雲端連線' : '本機模式'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleUpdatePrices} className="p-2 bg-slate-800 rounded border border-slate-700 text-emerald-400 hover:bg-emerald-900/30 transition-all">{isUpdatingPrices ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}</button>
          <button onClick={() => setShowSettings(true)} className="p-2 bg-slate-800 rounded border border-slate-700 hover:bg-slate-700 transition-all"><Settings size={18} /></button>
          <button onClick={handleReset} className="p-2 bg-slate-800 rounded border border-slate-700 text-red-400 hover:bg-red-900/30 transition-all"><RotateCcw size={18} /></button>
          <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { try { const raw = JSON.parse(ev.target?.result as string); const d = sanitizePayload(raw); setEtfs(d.etfs); setLoans(d.loans || []); setStockLoan(d.stockLoan || DEFAULT_STOCK_LOAN); setGlobalMarginLoan(d.globalMarginLoan || DEFAULT_GLOBAL_MARGIN); setCreditLoan(d.creditLoan || DEFAULT_CREDIT); setTaxStatus(d.taxStatus || DEFAULT_TAX); setAllocation(d.allocation || DEFAULT_ALLOC); setCloudConfig(d.cloudConfig || DEFAULT_CLOUD); setActualDetails(d.actualDetails || {}); alert('匯入成功'); } catch (err) { alert('格式錯誤'); } }; r.readAsText(f); }} className="hidden" accept=".json" />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-slate-800 rounded border border-slate-700 text-blue-400"><Upload size={18} /></button>
          <button onClick={() => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, actualDetails })} className="p-2 bg-slate-800 rounded border border-slate-700 text-amber-400"><Download size={18} /></button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
          
          {/* V81: RPG 角色面板與屬性 */}
          <div className="bg-slate-800 p-6 rounded-2xl border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="absolute -top-4 -right-4 p-4 opacity-5 pointer-events-none"><Crown size={150} /></div>
            
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">主線任務：FIRE 財富自由 <Target size={10}/></div>
                    <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">{currentRank}</div>
                </div>
                <div className="text-right">
                    <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">財商評級</div>
                    <div className={`text-4xl font-black ${healthGrade.includes('S') ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'text-blue-400'}`}>{healthGrade}</div>
                </div>
            </div>

            <div className="mb-6">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>經驗值 (邁向 {nextRank})</span>
                    <span>{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                    <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all duration-1000 ease-out relative" style={{ width: `${progress}%` }}>
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-2 border-t border-slate-700 pt-4">
              <div className="text-center bg-slate-900/50 p-2 rounded-lg">
                  <div className="text-slate-500 text-[9px] flex items-center justify-center gap-1 mb-1"><Swords size={10}/> 攻擊力 (年息)</div>
                  <div className="font-mono font-bold text-emerald-400 text-sm">{formatMoney(totalDividend)}</div>
              </div>
              <div className="text-center bg-slate-900/50 p-2 rounded-lg">
                  <div className="text-slate-500 text-[9px] flex items-center justify-center gap-1 mb-1"><ShieldCheck size={10}/> 防禦力 (維持率)</div>
                  <div className={`font-bold text-sm ${currentMaintenance < 140 ? 'text-red-400' : 'text-blue-400'}`}>{currentMaintenance === 999 ? 'MAX' : currentMaintenance.toFixed(0) + '%'}</div>
              </div>
              <div className="text-center bg-slate-900/50 p-2 rounded-lg">
                  <div className="text-slate-500 text-[9px] flex items-center justify-center gap-1 mb-1"><Activity size={10}/> 回血 (月淨流)</div>
                  <div className={`font-mono font-bold text-sm ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet / 12)}</div>
              </div>
              <div className="text-center bg-slate-900/50 p-2 rounded-lg">
                  <div className="text-slate-500 text-[9px] flex items-center justify-center gap-1 mb-1"><Coins size={10}/> 日產金率</div>
                  <div className="font-mono font-bold text-yellow-400 text-sm">{formatMoney(totalDividend / 365)}</div>
              </div>
            </div>
          </div>

          {/* V80: 成就牆 Trophy Room */}
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-sm font-bold mb-3 text-yellow-400 flex items-center gap-2"><Trophy size={16}/> 成就徽章 (Trophy Room)</h2>
            <div className="grid grid-cols-2 gap-2">
                {earnedAchievements.map((ach, i) => (
                    <div key={i} className="bg-slate-900/80 p-2 rounded-lg border border-yellow-700/30 flex items-center gap-2 hover:bg-slate-800 transition-colors cursor-default group relative">
                        <div className="text-2xl drop-shadow-md">{ach.icon}</div>
                        <div>
                            <div className="text-xs font-bold text-slate-200">{ach.title}</div>
                            <div className="text-[9px] text-slate-500 line-clamp-1">{ach.desc}</div>
                        </div>
                    </div>
                ))}
                {earnedAchievements.length === 0 && <div className="col-span-2 text-center text-xs text-slate-500 py-4 border border-dashed border-slate-700 rounded-lg">持續投資，解鎖更多隱藏成就！</div>}
            </div>
          </div>

          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-cyan-300 flex items-center gap-2"><ShieldCheck /> 資產體質</h2>
            <div className="h-64 -ml-4"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData}><PolarGrid stroke="#334155" /><PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} /><Radar dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.5} /></RadarChart></ResponsiveContainer></div>
          </section>

          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-blue-300 flex items-center gap-2"><PieIcon /> 資金分配 (淨值)</h2>
            <div className="h-48 flex justify-center items-center mb-4"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => (<Cell key={index} fill={(entry as any).color} />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            <div className="space-y-4">
              <div><div className="flex justify-between text-xs mb-1"><span>配息型 ({allocation.dividendRatio}%)</span><span>缺 {formatMoney(Math.max(0, (allocation.totalFunds * allocation.dividendRatio) / 100 - actualDiv))}</span></div><div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (actualDiv / ((allocation.totalFunds * allocation.dividendRatio) / 100 || 1)) * 100)}%` }} /></div></div>
              <div><div className="flex justify-between text-xs mb-1"><span>避險型 ({allocation.hedgingRatio}%)</span><span>缺 {formatMoney(Math.max(0, (allocation.totalFunds * allocation.hedgingRatio) / 100 - actualHedge))}</span></div><div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-amber-500 h-full" style={{ width: `${Math.min(100, (actualHedge / ((allocation.totalFunds * allocation.hedgingRatio) / 100 || 1)) * 100)}%` }} /></div></div>
              <div><div className="flex justify-between text-xs mb-1"><span>主動型 ({allocation.activeRatio}%)</span><span>缺 {formatMoney(Math.max(0, (allocation.totalFunds * allocation.activeRatio) / 100 - actualAct))}</span></div><div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-purple-500 h-full" style={{ width: `${Math.min(100, (actualAct / ((allocation.totalFunds * allocation.activeRatio) / 100 || 1)) * 100)}%` }} /></div></div>
            </div>
          </section>

          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-emerald-300 flex items-center gap-2"><Activity /> 標的清單</h2>
            
            <div className="space-y-4">
              {etfs.map((e, idx) => {
                const yearEvents = e.schedule?.filter(ev => ev.year === selectedYear) || [];
                return (
                <div key={e.id} className="p-4 bg-slate-900 rounded-xl border border-slate-700 shadow-sm relative group hover:border-slate-500 transition-colors">
                  
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1 w-2/3">
                            <input
                              type="text"
                              value={e.code || ''}
                              onChange={(v) => setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, code: v.target.value } : x)))}
                              className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded w-16 outline-none focus:ring-1 focus:ring-emerald-500/50"
                              placeholder="代號"
                            />
                            <input
                              type="text"
                              value={e.name}
                              onChange={(v) => setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, name: v.target.value } : x)))}
                              className="bg-transparent font-bold text-white text-lg outline-none w-full border-b border-transparent focus:border-slate-700"
                            />
                        </div>
                        
                        <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveEtf(idx, -1)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400"><ArrowUp size={14} /></button>
                            <button onClick={() => moveEtf(idx, 1)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400"><ArrowDown size={14} /></button>
                            <button onClick={() => removeEtf(e.id)} className="p-1.5 bg-slate-800 hover:bg-red-900/30 rounded text-red-400"><Trash2 size={14} /></button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-800 pt-2">
                        <select
                          value={e.category || 'dividend'}
                          onChange={(v) => setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, category: v.target.value as any } : x)))}
                          className="bg-slate-800 text-xs text-blue-300 rounded border border-slate-700 px-2 py-1 outline-none focus:border-blue-500"
                        >
                          <option value="dividend">配息型</option>
                          <option value="hedging">避險型</option>
                          <option value="active">主動型</option>
                        </select>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowCalendar(showCalendar === e.id ? null : e.id)}
                                className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${showCalendar === e.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                                title="行事曆"
                            >
                                <CalendarDays size={16} />
                            </button>
                            <button 
                                onClick={() => setActiveBuyId(activeBuyId === e.id ? null : e.id)} 
                                className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${activeBuyId === e.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} 
                                title="新增交易"
                            >
                                <ShoppingCart size={16} />
                            </button>
                            <button 
                                onClick={() => setExpandedEtfId(expandedEtfId === e.id ? null : e.id)} 
                                className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${expandedEtfId === e.id ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} 
                                title="交易紀錄"
                            >
                                <List size={16} />
                            </button>
                        </div>
                    </div>
                  </div>
                  
                  {showCalendar === e.id && (
                    <div className="mb-4 p-3 bg-slate-800 border border-emerald-500/50 rounded-lg animate-in slide-in-from-top-2 shadow-lg">
                      <div className="text-xs font-bold text-emerald-400 mb-3 flex justify-between items-center border-b border-emerald-900/50 pb-2">
                        <span>📅 {e.name} {selectedYear} 配息行事曆</span>
                        <button onClick={() => setShowCalendar(null)} className="text-slate-500 hover:text-white bg-slate-900 p-1 rounded-full"><X size={14} /></button>
                      </div>
                      <div className="space-y-2">
                        {yearEvents.length > 0 ? (
                          yearEvents.map((event) => (
                            <div key={event.id} className="grid grid-cols-7 gap-2 text-[10px] items-center bg-slate-900/50 p-2 rounded">
                              <div className="col-span-2 md:col-span-1 text-slate-400 font-bold">{event.name}</div>
                              <div className="col-span-5 md:col-span-6 grid grid-cols-3 gap-2">
                                <div>
                                  <div className="text-slate-500 mb-0.5 text-[8px]">除息日</div>
                                  <input type="date" value={event.exDate} onChange={(v) => updateSchedule(e.id, event.id, 'exDate', v.target.value)} className="w-full bg-slate-900 rounded p-1 text-slate-300 border border-slate-700 focus:border-emerald-500 outline-none" />
                                </div>
                                <div>
                                  <div className="text-slate-500 mb-0.5 text-[8px]">發放日</div>
                                  <input type="date" value={event.payDate} onChange={(v) => updateSchedule(e.id, event.id, 'payDate', v.target.value)} className="w-full bg-slate-900 rounded p-1 text-emerald-400 border border-slate-700 focus:border-emerald-500 outline-none" />
                                </div>
                                <div>
                                  <div className="text-slate-500 mb-0.5 text-[8px]">金額</div>
                                  <input type="number" step="0.01" value={event.amount} onChange={(v) => updateSchedule(e.id, event.id, 'amount', safeNum(v.target.value))} className="w-full bg-slate-900 rounded p-1 text-right text-yellow-400 font-bold border border-slate-700 focus:border-emerald-500 outline-none" />
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
                            <div className="text-sm text-slate-400 mb-3">此標的在 {selectedYear} 年尚無行事曆設定</div>
                            <button
                              onClick={() => initYearSchedule(e.id)}
                              className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-500 transition-all shadow-[0_0_15px_rgba(5,150,105,0.4)] flex items-center justify-center gap-2 mx-auto"
                            >
                              <Plus size={16} /> 建立 {selectedYear} 年度行事曆
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeBuyId === e.id && (
                    <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-[10px] text-blue-300">股數</label>
                          <input type="number" placeholder="1000" value={buyForm.shares} onChange={(v) => setBuyForm({ ...buyForm, shares: v.target.value })} className="w-full bg-slate-900 p-1.5 rounded text-xs border border-slate-700 outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="text-[10px] text-blue-300">單價</label>
                          <input type="number" placeholder="0.0" value={buyForm.price} onChange={(v) => setBuyForm({ ...buyForm, price: v.target.value })} className="w-full bg-slate-900 p-1.5 rounded text-xs border border-slate-700 outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="text-[10px] text-blue-300">融資額</label>
                          <input type="number" placeholder="0" value={buyForm.margin} onChange={(v) => setBuyForm({ ...buyForm, margin: v.target.value })} className="w-full bg-slate-900 p-1.5 rounded text-xs border border-slate-700 outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="text-[10px] text-blue-300">買進日</label>
                          <input type="date" value={buyForm.date} onChange={(v) => setBuyForm({ ...buyForm, date: v.target.value })} className="w-full bg-slate-900 p-1.5 rounded text-xs border border-slate-700 outline-none focus:border-blue-500" />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const s = safeNum(buyForm.shares); const p = safeNum(buyForm.price); const m = safeNum(buyForm.margin);
                          if (!s || !p) return;
                          setEtfs((prev) => {
                            const nEtfs = [...prev]; const current = nEtfs[idx];
                            const newLot: Lot = { id: Date.now().toString(), date: buyForm.date, shares: s, price: p, fee: Math.floor(s * p * BROKERAGE_RATE), margin: m };
                            nEtfs[idx] = recalculateEtfStats({ ...current, lots: [...(current.lots || []), newLot] });
                            return nEtfs;
                          });
                          setBuyForm({ shares: '', price: '', date: '', margin: '' }); setActiveBuyId(null);
                        }}
                        className="w-full bg-blue-600 text-sm py-2 rounded-lg font-bold hover:bg-blue-500 transition-colors"
                      >
                        確認交易
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 text-xs mb-3 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                    <div>
                      <label className="text-slate-500 text-[10px]">總股數</label>
                      <div className="pt-1 font-mono text-sm">{safeNum(e.shares).toLocaleString()}</div>
                    </div>
                    <div>
                      <label className="text-slate-500 text-[10px]">現價</label>
                      <input
                        type="number"
                        value={safeNum(e.currentPrice)}
                        onChange={(v) => setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, currentPrice: safeNum(v.target.value) } : x)))}
                        className="w-full bg-slate-800 rounded px-2 py-1 border border-slate-700 mt-1 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-[10px]">預估基礎配息</label>
                      <div className="flex gap-1 items-center mt-1">
                        <input
                          type="number"
                          value={safeNum(e.dividendPerShare)}
                          onChange={(v) => setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, dividendPerShare: safeNum(v.target.value) } : x)))}
                          className="w-full bg-slate-800 rounded px-1 py-1 border border-slate-700 outline-none focus:border-emerald-500 text-center transition-colors"
                        />
                        <select
                          value={e.dividendType}
                          onChange={(v) => setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, dividendType: v.target.value as any } : x)))}
                          className="bg-slate-800 text-[10px] text-blue-400 outline-none rounded py-1 border border-slate-700"
                        >
                          <option value="per_period">次</option>
                          <option value="annual">年</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {expandedEtfId === e.id && e.lots && (
                    <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
                      <div className="text-xs text-slate-400 mb-2">📜 交易明細</div>
                      {e.lots.map((l) => (
                        <div key={l.id} className="flex justify-between items-center text-xs bg-slate-900 p-2 rounded border border-slate-700">
                          <span className="text-slate-300">
                            {l.date} <span className="mx-2 text-slate-600">|</span> <span className="font-mono text-emerald-400">{l.shares.toLocaleString()} 股</span>
                          </span>
                          <span className="text-slate-400">
                            ${formatMoney(l.price)} <span className="text-[10px] ml-1">(融:{formatMoney(l.margin || 0)})</span>
                            <button
                              onClick={() => {
                                setEtfs((prev) => {
                                  const n = [...prev]; const cur = n[idx];
                                  const nextLots = (cur.lots || []).filter((x) => x.id !== l.id);
                                  n[idx] = recalculateEtfStats({ ...cur, lots: nextLots }); return n;
                                });
                              }}
                              className="text-red-500 ml-3 hover:bg-red-900/30 p-1 rounded transition-colors"
                            >
                              <X size={14}/>
                            </button>
                          </span>
                        </div>
                      ))}
                      {e.lots.length === 0 && <div className="text-center text-slate-500 text-xs py-2">尚無交易紀錄</div>}
                    </div>
                  )}
                </div>
              )})}
              <button
                onClick={() =>
                  setEtfs((prev) => [
                    ...prev,
                    {
                      id: Date.now().toString(), name: '新標的', code: '', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'annual',
                      payMonths: [1, 4, 7, 10], category: 'dividend', marginLoanAmount: 0, schedule: [], lots: [],
                    },
                  ])
                }
                className="w-full py-3 border border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16}/> 新增標的
              </button>
            </div>
          </section>
        </div>

        <div className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-lg">
              <div className="text-slate-400 text-xs uppercase">年度淨流</div>
              <div className={`text-2xl font-bold ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-blue-500 shadow-lg">
              <div className="text-slate-400 text-xs uppercase">總資產</div>
              <div className="text-2xl font-bold font-mono">{formatMoney(totalValue)}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-red-500 shadow-lg">
              <div className="text-slate-400 text-xs uppercase">總負債</div>
              <div className="text-2xl font-bold font-mono">{formatMoney(totalStockDebt)}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-orange-500 shadow-lg">
              <div className="text-slate-400 text-xs uppercase">股息Cover%</div>
              <div className="text-2xl font-bold font-mono text-orange-400">{totalOut > 0 ? ((totalDividend / totalOut) * 100).toFixed(1) : 0}%</div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                <TrendingUp className="text-indigo-400" /> 十年財富滾雪球 (含寬限期動態推算)
              </h3>
              <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-600">
                <button onClick={() => setReinvest(false)} className={`px-3 py-1 text-xs rounded transition-all ${!reinvest ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>花掉股息</button>
                <button onClick={() => setReinvest(true)} className={`px-3 py-1 text-xs rounded transition-all ${reinvest ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>複利投入</button>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snowballData}>
                  <defs><linearGradient id="cw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} /><stop offset="95%" stopColor="#818cf8" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="year" stroke="#94a3b8" />
                  {/* V81: 萬級單位優化 */}
                  <YAxis stroke="#94a3b8" width={80} tickFormatter={(value) => `$${Math.floor(value / 10000)}萬`} />
                  <Tooltip formatter={(v: any) => formatMoney(v)} />
                  <Area type="monotone" dataKey="wealth" stroke="#818cf8" fill="url(#cw)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl overflow-x-auto">
            
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                <Calendar className="text-blue-400" /> 每月對帳明細 (可填實領)
                </h3>
                <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1 border border-slate-600 shadow-inner">
                    <button onClick={() => setSelectedYear(y => y - 1)} className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors">◀</button>
                    <span className="font-black text-emerald-400 w-12 text-center">{selectedYear}</span>
                    <button onClick={() => setSelectedYear(y => y + 1)} className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors">▶</button>
                </div>
            </div>

            <table className="w-full text-sm text-left">
              <thead className="text-slate-500 bg-slate-900/50">
                <tr>
                  <th className="p-3">月份</th>
                  <th className="p-3">薪資</th>
                  <th className="p-3">預估股息</th>
                  <th className="p-3 bg-emerald-900/30 text-emerald-400">總實領</th>
                  <th className="p-3">差異</th>
                  <th className="p-3">房貸</th>
                  <th className="p-3">信貸</th>
                  <th className="p-3">利息</th>
                  <th className="p-3">生活</th>
                  <th className="p-3">稅金</th>
                  <th className="p-3 text-right">淨流</th>
                </tr>
              </thead>
              <tbody>
                {monthlyFlows.map((r) => (
                  <React.Fragment key={r.month}>
                    <tr
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 font-mono text-xs cursor-pointer transition-colors"
                      onClick={() => setExpandedMonth(expandedMonth === r.month ? null : r.month)}
                    >
                      <td className="p-3 font-bold text-white font-sans flex items-center gap-1">
                        {r.month}月 {expandedMonth === r.month ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </td>
                      <td className="p-3 text-slate-400">{formatMoney(r.salary)}</td>
                      <td className="p-3 text-slate-500">{formatMoney(r.divProjected)}</td>
                      <td className="p-3 text-emerald-400 font-bold bg-emerald-900/10 rounded-l-lg">{r.divActualTotal > 0 ? formatMoney(r.divActualTotal) : '-'}</td>
                      <td className={`p-3 bg-emerald-900/10 rounded-r-lg ${r.divActualTotal > 0 && r.divActualTotal - r.divProjected * 0.9789 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {r.divActualTotal > 0 ? formatMoney(r.divActualTotal - r.divProjected * 0.9789) : '-'}
                      </td>
                      <td className="p-3 text-red-400">{formatMoney(r.loanOut)}</td>
                      <td className="p-3 text-orange-400">{formatMoney(r.creditOut)}</td>
                      <td className="p-3 text-blue-300">{formatMoney(r.stockInt)}</td>
                      <td className="p-3 text-slate-500">{formatMoney(r.life)}</td>
                      <td className="p-3 text-purple-400 text-[10px]">
                        {formatMoney(r.healthTax)}
                        <br />
                        <span className="opacity-50">+{formatMoney(r.incomeTax)}</span>
                      </td>
                      <td className={`p-3 text-right font-bold ${r.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(r.net)}</td>
                    </tr>
                    {expandedMonth === r.month && (
                      <tr className="bg-slate-900/80 animate-in fade-in">
                        <td colSpan={11} className="p-4 border-b border-emerald-900/30">
                          <div className="space-y-3 max-w-3xl">
                            <div className="text-sm text-emerald-400 font-bold flex items-center gap-2 border-b border-slate-700 pb-2">
                              <CalendarDays size={16}/> {selectedYear} 年 {r.month} 月各檔 ETF 實領輸入
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full ml-2 border border-slate-700">自動過濾除息後買進股數</span>
                            </div>
                            {r.details?.map((d: any, i: number) => (
                              <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors gap-3">
                                <div className="flex-1">
                                  <div className="text-white text-sm font-bold flex items-center gap-2">
                                    {d.name} 
                                    {d.exDate !== '未填' && d.exDate !== '預估' && <span className="text-[10px] text-slate-400 font-normal bg-slate-900 px-1.5 rounded">除息 {d.exDate}</span>}
                                  </div>
                                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4">
                                    <span>預估稅前: <span className="font-mono text-slate-300">{formatMoney(d.amt)}</span></span>
                                    <span className={d.qualifiedShares < d.totalShares ? 'text-orange-400 flex items-center gap-1' : 'text-slate-500'}>
                                      {d.qualifiedShares < d.totalShares && <AlertTriangle size={10}/>}
                                      資格股數: {safeNum(d.qualifiedShares).toLocaleString()} / 總: {safeNum(d.totalShares).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto bg-slate-900 p-2 rounded border border-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-emerald-500 font-bold">銀行實領:</span>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1.5 text-emerald-600 text-xs">$</span>
                                        <input
                                        type="number"
                                        placeholder={Math.floor(d.amt * 0.9789).toString()}
                                        value={d.actual || ''}
                                        onChange={(e) => updateDetailActual(selectedYear, r.month, d.id, safeNum(e.target.value))}
                                        className="w-28 bg-slate-800 border border-emerald-600/50 rounded pl-5 pr-2 py-1 text-emerald-400 font-bold text-right outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                  </div>
                                  <div className="text-xs w-20 text-right flex flex-col items-end">
                                      <span className="text-slate-500 mb-0.5">預估落差</span>
                                      <span className={d.actual && (d.actual - Math.floor(d.amt * 0.9789)) < 0 ? "text-red-400 font-mono" : "text-slate-300 font-mono"}>
                                          {d.actual ? formatMoney(d.actual - Math.floor(d.amt * 0.9789)) : '-'}
                                      </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {(!r.details || r.details.length === 0) && <div className="text-slate-500 text-sm py-4 text-center bg-slate-800/30 rounded-lg">本月無配息預估紀錄</div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 font-black text-white">
                  <td className="p-3 font-sans">年度總計</td>
                  <td className="p-3">{formatMoney(monthlyFlows.reduce((a: number, b: any) => a + b.salary, 0))}</td>
                  <td className="p-3">預:{formatMoney(monthlyFlows.reduce((a: number, b: any) => a + b.divProjected, 0))}</td>
                  <td className="p-3 text-emerald-400">實:{formatMoney(totalDividend)}</td>
                  <td />
                  <td className="p-3 text-red-400" colSpan={4}>
                    總支出: {formatMoney(totalOut)}
                  </td>
                  <td className={`p-3 text-right font-mono ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 z-[100]">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
              <Settings /> 財務詳細與稅務設定
            </h3>
            <div className="space-y-6 text-sm">
              <div>
                <label className="text-slate-400 block mb-1 font-bold text-emerald-400">Google Sheet CSV 連結</label>
                <input
                  type="text"
                  value={cloudConfig.priceSourceUrl}
                  onChange={(e) => setCloudConfig({ ...cloudConfig, priceSourceUrl: e.target.value })}
                  className="w-full bg-slate-900 p-2 rounded border border-slate-600 outline-none focus:border-blue-500"
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <div>
                  <label className="text-slate-400">投資預算</label>
                  <input type="number" value={allocation.totalFunds} onChange={(e) => setAllocation({ ...allocation, totalFunds: safeNum(e.target.value) })} className="w-full bg-slate-800 p-1.5 rounded" />
                </div>
                <div>
                  <label className="text-slate-400">配息%</label>
                  <input type="number" value={allocation.dividendRatio} onChange={(e) => setAllocation({ ...allocation, dividendRatio: safeNum(e.target.value) })} className="w-full bg-slate-800 p-1.5 rounded" />
                </div>
                <div>
                  <label className="text-slate-400">避險%</label>
                  <input type="number" value={allocation.hedgingRatio} onChange={(e) => setAllocation({ ...allocation, hedgingRatio: safeNum(e.target.value) })} className="w-full bg-slate-800 p-1.5 rounded" />
                </div>
                <div>
                  <label className="text-slate-400">主動%</label>
                  <input type="number" value={allocation.activeRatio} onChange={(e) => setAllocation({ ...allocation, activeRatio: safeNum(e.target.value) })} className="w-full bg-slate-800 p-1.5 rounded" />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-yellow-400 font-bold mb-2">綜所稅試算參數 (2025)</h4>
                  <div className="space-y-2 p-3 bg-yellow-900/20 rounded-xl border border-yellow-700/50">
                    <div>
                      <label className="text-slate-400">年薪資所得 (含獎金)</label>
                      <input type="number" value={taxStatus.salaryIncome} onChange={(e) => setTaxStatus({ ...taxStatus, salaryIncome: safeNum(e.target.value) })} className="w-full bg-slate-900 p-1.5 rounded border border-slate-700" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={taxStatus.hasSpouse} onChange={(e) => setTaxStatus({ ...taxStatus, hasSpouse: e.target.checked })} />
                      <label className="text-slate-300">有配偶合併申報</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={taxStatus.isDisabled} onChange={(e) => setTaxStatus({ ...taxStatus, isDisabled: e.target.checked })} />
                      <label className="text-slate-300">領有身心障礙手冊</label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-500">扶養人數</label>
                        <input type="number" value={taxStatus.dependents} onChange={(e) => setTaxStatus({ ...taxStatus, dependents: safeNum(e.target.value) })} className="w-full bg-slate-900 p-1 rounded" />
                      </div>
                      <div>
                        <label className="text-slate-500">身障人數</label>
                        <input type="number" value={taxStatus.disabilityCount} onChange={(e) => setTaxStatus({ ...taxStatus, disabilityCount: safeNum(e.target.value) })} className="w-full bg-slate-900 p-1 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-blue-400 font-bold mb-2">信貸/不限用途</h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-500 text-[10px]">信貸本金</label>
                        <input type="number" value={creditLoan.principal} onChange={(e) => setCreditLoan({ ...creditLoan, principal: safeNum(e.target.value) })} className="w-full bg-slate-900 p-1 rounded" />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px]">利率%</label>
                        <input type="number" value={creditLoan.rate} onChange={(e) => setCreditLoan({ ...creditLoan, rate: safeNum(e.target.value) })} className="w-full bg-slate-900 p-1 rounded" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-500 text-[10px]">借貸本金</label>
                        <input type="number" value={stockLoan.principal} onChange={(e) => setStockLoan({ ...stockLoan, principal: safeNum(e.target.value) })} className="w-full bg-slate-900 p-1 rounded" />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px]">利率%</label>
                        <input type="number" value={stockLoan.rate} onChange={(e) => setStockLoan({ ...stockLoan, rate: safeNum(e.target.value) })} className="w-full bg-slate-900 p-1 rounded" />
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-400">每月生活費</label>
                      <input type="number" value={taxStatus.livingExpenses} onChange={(e) => setTaxStatus({ ...taxStatus, livingExpenses: safeNum(e.target.value) })} className="w-full bg-slate-900 p-1.5 rounded border border-slate-700" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-700">
                <h4 className="text-emerald-400 font-bold mb-2">房貸進階設定</h4>
                {loans.map((l, i) => (
                  <div key={l.id} className="mb-4 p-4 bg-slate-900/80 rounded-xl border border-slate-600">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="text-slate-500 text-[10px]">名稱</label>
                        <input type="text" value={l.name} onChange={(e) => updateLoan(i, 'name', e.target.value)} className="w-full bg-slate-800 p-1 rounded" />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px]">本金</label>
                        <input type="number" value={l.principal} onChange={(e) => updateLoan(i, 'principal', safeNum(e.target.value))} className="w-full bg-slate-800 p-1 rounded" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500">利率1%</label>
                        <input type="number" value={l.rate1} onChange={(e) => updateLoan(i, 'rate1', safeNum(e.target.value))} className="w-full bg-slate-800 p-1 rounded" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">月數1</label>
                        <input type="number" value={l.rate1Months} onChange={(e) => updateLoan(i, 'rate1Months', safeNum(e.target.value))} className="w-full bg-slate-800 p-1 rounded" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">利率2%</label>
                        <input type="number" value={l.rate2} onChange={(e) => updateLoan(i, 'rate2', safeNum(e.target.value))} className="w-full bg-slate-800 p-1 rounded" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <label className="text-[10px] text-emerald-400 font-bold">撥款日期</label>
                        <input type="date" value={l.startDate || ''} onChange={(e) => updateLoan(i, 'startDate', e.target.value)} className="w-full bg-slate-800 p-1 rounded border border-emerald-900" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">寬限期</label>
                        <input type="number" value={l.gracePeriod} onChange={(e) => updateLoan(i, 'gracePeriod', safeNum(e.target.value))} className="w-full bg-slate-800 p-1 rounded" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">已繳期數 (系統推算)</label>
                        <input type="number" disabled value={l.paidMonths} className="w-full bg-slate-800/50 p-1 rounded text-slate-500 cursor-not-allowed" />
                      </div>
                    </div>
                    <button onClick={() => setLoans((prev) => prev.filter((x) => x.id !== l.id))} className="text-[10px] text-red-500 mt-2 hover:underline">
                      刪除貸款
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setLoans((prev) => [...prev, { id: Date.now().toString(), name: '新房貸', principal: 0, rate1: 2.1, rate1Months: 36, rate2: 2.3, totalMonths: 360, paidMonths: 0, gracePeriod: 0, type: 'PrincipalAndInterest' }])}
                  className="text-xs text-blue-400 border border-blue-400/30 px-3 py-1 rounded-lg hover:bg-blue-400/10"
                >
                  + 新增房貸
                </button>
              </div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full mt-6 py-3 bg-blue-600 rounded-xl font-bold shadow-lg hover:bg-blue-500 transition-all">
              儲存關閉並同步
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
