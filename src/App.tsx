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
  Coins,
  Wallet
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

// V82 新增: 每月動態收支紀錄
interface MonthlyRecord {
  livingExpense?: number;
  otherIncome?: number;
  isTaxable?: boolean;
}
type MonthlyRecords = Record<string, MonthlyRecord>;

type PersistedPayload = {
  etfs: ETF[]; loans: Loan[]; stockLoan: StockLoan; creditLoan: CreditLoan; globalMarginLoan: StockLoan;
  taxStatus: TaxStatus; allocation: AllocationConfig; cloudConfig: CloudConfig; actualDetails: ActualDetails;
  monthlyRecords?: MonthlyRecords; // V82 新增欄位
  _meta?: { schema: number; updatedAt: number };
};

// ==========================================
// 3. 預設資料與常數
// ==========================================
const APP_SCHEMA_VERSION = 82;
const LOCAL_KEY = 'baozutang_local';

const TONY_DEFAULT_ETFS: ETF[] = []; 

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
// 4. 計算工具
// ==========================================
// V82 修復: 稅務引擎加入「其他應稅收入 (otherTaxable)」
const calculateIncomeTax = (salary: number, dividend: number, otherTaxable: number, status: TaxStatus) => {
  const exemption = 97000 * (1 + (status.hasSpouse ? 1 : 0) + status.dependents);
  const stdDed = status.hasSpouse ? 262000 : 131000;
  const salaryDed = Math.min(salary, 218000 * (1 + (status.hasSpouse ? 1 : 0)));
  const disabilityDed = 218000 * (status.disabilityCount || (status.isDisabled ? 1 : 0));
  const totalDeductions = exemption + stdDed + salaryDed + disabilityDed;
  
  const grossIncome = salary + dividend + otherTaxable; // 加入應稅的其他收入
  const netTaxableIncome = Math.max(0, grossIncome - totalDeductions);

  let grossTax = 0;
  if (netTaxableIncome <= 610000) grossTax = netTaxableIncome * 0.05;
  else if (netTaxableIncome <= 1380000) grossTax = netTaxableIncome * 0.12 - 42700;
  else if (netTaxableIncome <= 2660000) grossTax = netTaxableIncome * 0.2 - 153100;
  else grossTax = netTaxableIncome * 0.3 - 419100;

  const dividendCredit = Math.min(80000, dividend * 0.085);
  return Math.floor(grossTax - dividendCredit);
};

const calculateLoanPayment = (loan: Loan, dynamicPaid: number) => {
  const p = safeNum(loan.principal);
  const grace = safeNum(loan.gracePeriod);
  const totalMonths = safeNum(loan.totalMonths);

  if (p <= 0 || dynamicPaid >= totalMonths) return 0;
  if (dynamicPaid < grace) {
    const r = safeNum(loan.rate1) / 100 / 12;
    return Math.floor(p * r);
  }
  const rateAnnual = dynamicPaid < safeNum(loan.rate1Months) ? safeNum(loan.rate1) : safeNum(loan.rate2);
  const r = rateAnnual / 100 / 12;
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

const generateCashFlow = (etfs: ETF[], loans: Loan[], stockLoan: StockLoan, creditLoan: CreditLoan, globalMarginLoan: StockLoan, taxStatus: TaxStatus, actualDetails: ActualDetails, monthlyRecords: MonthlyRecords, selectedYear: number) => {
  const flows: any[] = [];
  
  // V82: 薪資只用來算稅，不列入現金流收入
  const annualSalaryForTax = safeNum(taxStatus.salaryIncome);

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

  // 結算整年的「應稅其他收入」
  let annualOtherTaxable = 0;
  for (let m = 1; m <= 12; m++) {
    const rec = monthlyRecords[`${selectedYear}_${m}`];
    if (rec?.otherIncome && rec?.isTaxable) {
      annualOtherTaxable += rec.otherIncome;
    }
  }

  const annualIncomeTax = calculateIncomeTax(annualSalaryForTax, annualDividendProjected, annualOtherTaxable, taxStatus);
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

    let loanOut = 0; 
    loans.forEach((l) => {
      let dynamicPaid = safeNum(l.paidMonths);
      if (l.startDate) {
        const start = new Date(l.startDate);
        if (!isNaN(start.getTime())) {
          const elapsed = (selectedYear - start.getFullYear()) * 12 + (m - (start.getMonth() + 1));
          dynamicPaid = Math.max(0, elapsed);
        }
      } else {
        const today = new Date();
        const elapsed = (selectedYear - today.getFullYear()) * 12 + (m - (today.getMonth() + 1));
        dynamicPaid = Math.max(0, safeNum(l.paidMonths) + elapsed);
      }
      loanOut += calculateLoanPayment(l, dynamicPaid);
    });

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

    // V82: 讀取該月的獨立設定 (其他收入、生活費)
    const rec = monthlyRecords[`${selectedYear}_${m}`] || {};
    const otherInc = safeNum(rec.otherIncome);
    const lifeExp = rec.livingExpense !== undefined ? safeNum(rec.livingExpense) : safeNum(taxStatus.livingExpenses);

    flows.push({
      month: m, 
      otherInc, // V82 替代了原本的 salary
      divProjected: divInProjected, 
      divActualTotal, 
      loanOut, creditOut, stockInt: stockInt + marginInt, 
      life: lifeExp,
      healthTax: healthTaxReal, incomeTax: monthlyIncomeTaxImpact,
      // 淨流 = 股息 + 其他收入 - 所有支出 (注意：薪資不計入，因為是左手換右手)
      net: divUsed + otherInc - loanOut - creditOut - (stockInt + marginInt) - lifeExp - healthTaxReal - monthlyIncomeTaxImpact,
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
  return { 
      etfs: cleanedEtfs, 
      loans: Array.isArray(d?.loans) ? d.loans : [], 
      stockLoan: d?.stockLoan || DEFAULT_STOCK_LOAN, 
      creditLoan: d?.creditLoan || DEFAULT_CREDIT, 
      globalMarginLoan: d?.globalMarginLoan || DEFAULT_GLOBAL_MARGIN, 
      taxStatus: d?.taxStatus || DEFAULT_TAX, 
      allocation: d?.allocation || DEFAULT_ALLOC, 
      cloudConfig: d?.cloudConfig || DEFAULT_CLOUD, 
      actualDetails: newActuals, 
      monthlyRecords: d?.monthlyRecords || {},
      _meta: d?._meta 
  };
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
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecords>({}); // V82 新增
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
        setMonthlyRecords(d.monthlyRecords || {});
      }
      setIsInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      try {
        const res = await StorageService.saveData({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, actualDetails, monthlyRecords });
        setDataSrc(res.cloudOk ? 'cloud' : 'local');
        setSaveStatus(res.cloudOk ? 'saved' : 'error');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) { setSaveStatus('error'); }
    }, 1200);
    return () => clearTimeout(t);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, actualDetails, monthlyRecords, isInitializing]);

  const monthlyFlows = useMemo(
    () => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, actualDetails, monthlyRecords, selectedYear),
    [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, actualDetails, monthlyRecords, selectedYear]
  );

  const totalDividend = monthlyFlows.reduce((a, b) => a + (b.divActualTotal > 0 ? b.divActualTotal : b.divProjected * 0.9789), 0);
  const totalOtherIncome = monthlyFlows.reduce((a, b) => a + b.otherInc, 0); // V82
  const totalOut = monthlyFlows.reduce((a, b) => a + b.loanOut + b.creditOut + b.stockInt + b.life + b.healthTax + b.incomeTax, 0);
  const totalNet = totalDividend + totalOtherIncome - totalOut; // V82: 淨流不再算入薪資

  const totalValue = etfs.reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice), 0);
  const totalStockDebt = safeNum(stockLoan.principal) + safeNum(globalMarginLoan.principal) + etfs.reduce((a, e) => a + safeNum(e.marginLoanAmount), 0);
  const currentMaintenance = totalStockDebt === 0 ? 999 : (totalValue / totalStockDebt) * 100;

  const actualDiv = etfs.filter((e) => e.category === 'dividend').reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);
  const actualHedge = etfs.filter((e) => e.category === 'hedging').reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);
  const actualAct = etfs.filter((e) => e.category === 'active').reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);

  const combatPower = Math.floor(totalValue / 10000 + totalDividend / 12 / 100);
  const fireRatio = totalOut > 0 ? (totalDividend / totalOut) * 100 : 0;

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
      const fLife = safeNum(taxStatus.livingExpenses) * 12; // 未來推算用預設生活費
      
      const fSalary = safeNum(taxStatus.salaryIncome);
      const fDiv = curWealth * avgYield;
      const fHealthTax = Math.floor(fDiv * 0.0211);
      const fIncomeTax = calculateIncomeTax(fSalary, fDiv, 0, taxStatus); // 未來預估其他收入算0較安全
      
      // V82: 薪資不再加入未來可用現金流(futureNet)
      const futureNet = fDiv - futureLoanOut - futureCreditOut - fStockInt - fMarginInt - fLife - fHealthTax - fIncomeTax;

      data.push({ year: `Y${y}`, wealth: Math.floor(curWealth) });
      curWealth = curWealth * 1.05 + (reinvest ? fDiv : 0) + (futureNet - fDiv); 
    }
    return data;
  }, [totalValue, totalDividend, reinvest, loans, creditLoan, stockLoan, globalMarginLoan, taxStatus, etfs, selectedYear]);

  const pieData = [{ name: '配息', value: Math.max(1, actualDiv), color: COLORS.dividend }, { name: '避險', value: Math.max(1, actualHedge), color: COLORS.hedging }, { name: '主動', value: Math.max(1, actualAct), color: COLORS.active }];
  const radarData = [{ subject: '現金流', A: Math.min(100, fireRatio) }, { subject: '安全性', A: Math.min(100, (actualHedge / (totalValue - totalStockDebt || 1)) * 500) }, { subject: '維持率', A: Math.min(100, (currentMaintenance - 130) * 2) }, { subject: '成長', A: Math.min(100, (actualAct / (totalValue - totalStockDebt || 1)) * 500) }];

  const moveEtf = (i: number, d: number) => { setEtfs((prev) => { const n = [...prev]; if (i + d < 0 || i + d >= n.length) return prev; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; }); };
  const removeEtf = (id: string) => { if (confirm('確定刪除？')) setEtfs((prev) => prev.filter((e) => e.id !== id)); };
  const updateLoan = (i: number, f: string, v: any) => { setLoans((prev) => { const n = [...prev]; if (!n[i]) return prev; if (f === 'startDate' && v) { const start = new Date(v); const now = new Date(); const dm = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()); n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, dm) }; } else { n[i] = { ...n[i], [f]: v }; } return n; }); };
  const updateDetailActual = (year: number, month: number, etfId: string, val: number) => { setActualDetails((prev) => ({ ...prev, [`${year}_${month}_${etfId}`]: safeNum(val) })); };
  
  // V82: 更新每月其他收入/生活費
  const updateMonthlyRecord = (year: number, month: number, field: keyof MonthlyRecord, val: any) => {
    setMonthlyRecords((prev) => {
      const key = `${year}_${month}`;
      const current = prev[key] || {};
      return { ...prev, [key]: { ...current, [field]: val } };
    });
  };

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
    setEtfs([]); setLoans([]); setStockLoan(DEFAULT_STOCK_LOAN); setGlobalMarginLoan(DEFAULT_GLOBAL_MARGIN); setCreditLoan(DEFAULT_CREDIT); setTaxStatus(DEFAULT_TAX); setAllocation(DEFAULT_ALLOC); setCloudConfig(DEFAULT_CLOUD); setActualDetails({}); setMonthlyRecords({});
    try { await StorageService.saveData({ etfs: [], loans: [], stockLoan: DEFAULT_STOCK_LOAN, creditLoan: DEFAULT_CREDIT, globalMarginLoan: DEFAULT_GLOBAL_MARGIN, taxStatus: DEFAULT_TAX, allocation: DEFAULT_ALLOC, cloudConfig: DEFAULT_CLOUD, actualDetails: {}, monthlyRecords: {} }); window.location.reload(); } catch (e) {}
  };

  if (isInitializing) { return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-sans"><Loader2 className="animate-spin mr-2" /> 雲端同步中...</div>; }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-900 text-white font-sans selection:bg-emerald-500/30">
      <header className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2"><Calculator /> 包租唐戰情室 V82</h1>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 flex items-center gap-1">
              {saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin text-amber-400" /> : saveStatus === 'saved' ? <CheckCircle2 size={12} className="text
