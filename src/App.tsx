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
interface Lot {
  id: string;
  date: string;
  shares: number;
  price: number;
  fee?: number;
  margin?: number;
}
interface DividendEvent {
  id: string;
  name: string;
  exDate: string;
  payDate: string;
  amount: number;
  isActual: boolean;
}
interface ETF {
  id: string;
  code?: string;
  name: string;
  shares: number;
  costPrice: number;
  currentPrice: number;
  dividendPerShare: number;
  dividendType?: 'annual' | 'per_period';
  payMonths?: number[];
  category: 'dividend' | 'hedging' | 'active';
  marginLoanAmount?: number;
  marginInterestRate?: number;
  lots?: Lot[];
  schedule?: DividendEvent[];
}
interface Loan {
  id: string;
  name: string;
  principal: number;
  rate1: number;
  rate1Months: number;
  rate2: number;
  totalMonths: number;
  paidMonths: number;
  gracePeriod: number;
  startDate?: string;
  type: string;
}
interface StockLoan {
  principal: number;
  rate: number;
  maintenanceLimit?: number;
}
interface CreditLoan {
  principal: number;
  rate: number;
  totalMonths: number;
  paidMonths: number;
}
interface TaxStatus {
  salaryIncome: number;
  livingExpenses: number;
  dependents: number;
  hasSpouse: boolean;
  isDisabled: boolean;
  disabilityCount: number;
}
interface AllocationConfig {
  totalFunds: number;
  dividendRatio: number;
  hedgingRatio: number;
  activeRatio: number;
}
interface CloudConfig {
  priceSourceUrl: string;
  enabled: boolean;
}
interface ActualDetails {
  [key: string]: number;
}

type PersistedPayload = {
  etfs: ETF[];
  loans: Loan[];
  stockLoan: StockLoan;
  creditLoan: CreditLoan;
  globalMarginLoan: StockLoan;
  taxStatus: TaxStatus;
  allocation: AllocationConfig;
  cloudConfig: CloudConfig;
  actualDetails: ActualDetails;
  _meta?: { schema: number; updatedAt: number };
};

// ==========================================
// 3. 預設資料與常數
// ==========================================
const APP_SCHEMA_VERSION = 76;
const LOCAL_KEY = 'baozutang_local';

const TONY_DEFAULT_ETFS: ETF[] = [
  { id: '0056', code: '0056', name: '元大高股息', shares: 151000, costPrice: 36.61, currentPrice: 38.05, dividendPerShare: 0.866, dividendType: 'per_period', payMonths: [2, 5, 8, 11], category: 'dividend' },
  { id: '00878', code: '00878', name: '國泰永續高股息', shares: 50000, costPrice: 22.85, currentPrice: 23.08, dividendPerShare: 0.42, dividendType: 'per_period', payMonths: [3, 6, 9, 12], category: 'dividend' },
  { id: '00919', code: '00919', name: '群益精選高息', shares: 140000, costPrice: 23.15, currentPrice: 23.54, dividendPerShare: 0.54, dividendType: 'per_period', payMonths: [1, 4, 7, 10], category: 'dividend' },
  { id: '00981A', code: '00981A', name: '主動統一台股增長', shares: 70000, costPrice: 17.96, currentPrice: 18.34, dividendPerShare: 0.4, dividendType: 'per_period', payMonths: [1, 4, 7, 10], category: 'active' },
  { id: '00982A', code: '00982A', name: '群益主動強棒', shares: 450000, costPrice: 14.62, currentPrice: 15.39, dividendPerShare: 0.377, dividendType: 'per_period', payMonths: [3, 6, 9, 12], category: 'active' },
  { id: '00991A', code: '00991A', name: '主動復華未來50', shares: 70000, costPrice: 11.7, currentPrice: 11.61, dividendPerShare: 0.4, dividendType: 'per_period', payMonths: [1, 7], category: 'active' },
  { id: '00992A', code: '00992A', name: '主動群益科技創新', shares: 70000, costPrice: 11.37, currentPrice: 11.54, dividendPerShare: 0.2, dividendType: 'per_period', payMonths: [2, 5, 8, 11], category: 'active' },
  { id: '00635U', code: '00635U', name: '期元大S&P黃金', shares: 1000, costPrice: 51.52, currentPrice: 52.95, dividendPerShare: 0, dividendType: 'annual', payMonths: [], category: 'hedging' },
  { id: '00738U', code: '00738U', name: '期元大道瓊白銀', shares: 1000, costPrice: 62.19, currentPrice: 65.85, dividendPerShare: 0, dividendType: 'annual', payMonths: [], category: 'hedging' },
  { id: 'GOLD', code: 'GOLD', name: '實體黃金 (克)', shares: 72.2, costPrice: 4806.1, currentPrice: 5047, dividendPerShare: 0, dividendType: 'annual', payMonths: [], category: 'hedging' },
];

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

const toTime = (s: string) => {
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const safeNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// ==========================================
// 4. 計算工具
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

const calculateLoanPayment = (loan: Loan) => {
  const p = safeNum(loan.principal);
  const paid = safeNum(loan.paidMonths);
  const grace = safeNum(loan.gracePeriod);
  const totalMonths = safeNum(loan.totalMonths);

  if (p <= 0) return 0;

  // 寬限期：只繳息
  if (paid < grace) {
    const r = safeNum(loan.rate1) / 100 / 12;
    return Math.floor(p * r);
  }

  const rateAnnual = paid < safeNum(loan.rate1Months) ? safeNum(loan.rate1) : safeNum(loan.rate2);
  const r = rateAnnual / 100 / 12;

  const n = Math.max(0, totalMonths - paid);
  if (n <= 0) return 0;

  // 0利率：直接均攤本金
  if (r === 0) return Math.floor(p / n);

  return Math.floor((p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
};

const recalculateEtfStats = (etf: ETF): ETF => {
  const lots = etf.lots || [];
  const totalShares = lots.reduce((acc, lot) => acc + safeNum(lot.shares), 0);
  const totalCost = lots.reduce((acc, lot) => acc + safeNum(lot.shares) * safeNum(lot.price) + safeNum(lot.fee), 0);
  const totalMargin = lots.reduce((acc, lot) => acc + safeNum(lot.margin), 0);

  return {
    ...etf,
    shares: totalShares > 0 ? totalShares : safeNum(etf.shares),
    costPrice: totalShares > 0 ? Number((totalCost / totalShares).toFixed(2)) : safeNum(etf.costPrice),
    marginLoanAmount: totalMargin > 0 ? totalMargin : safeNum(etf.marginLoanAmount),
  };
};

const generateCashFlow = (
  etfs: ETF[],
  loans: Loan[],
  stockLoan: StockLoan,
  creditLoan: CreditLoan,
  globalMarginLoan: StockLoan,
  taxStatus: TaxStatus,
  actualDetails: ActualDetails
) => {
  const flows: any[] = [];
  const monthlySalary = safeNum(taxStatus.salaryIncome) / 12;

  // 年度預估股利（用 schedule 優先）
  let annualDividendProjected = 0;
  etfs.forEach((e) => {
    if (e.schedule && e.schedule.length > 0) {
      e.schedule.forEach((event) => {
        annualDividendProjected += safeNum(e.shares) * safeNum(event.amount);
      });
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
    let divInActualTotal = 0;

    const contributingEtfs: {
      id: string;
      name: string;
      amt: number;
      qualifiedShares: number;
      totalShares: number;
      exDate: string;
      actual?: number;
    }[] = [];

    etfs.forEach((e) => {
      if (e.schedule && e.schedule.length > 0) {
        e.schedule.forEach((event) => {
          if (!event.payDate) return;
          const payMonth = parseInt(event.payDate.split('-')[1] || '', 10);
          if (!Number.isFinite(payMonth) || payMonth !== m) return;

          // 除息資格：用 Date 比較，避免字串比較踩雷
          const exT = toTime(event.exDate);
          let qualifiedShares = 0;

          if (e.lots && e.lots.length > 0) {
            e.lots.forEach((lot) => {
              const lotT = toTime(lot.date);
              if (!Number.isFinite(exT)) {
                // 沒填除息日：視為都算（避免你還沒填日子就變 0）
                qualifiedShares += safeNum(lot.shares);
              } else if (Number.isFinite(lotT) && lotT < exT) {
                qualifiedShares += safeNum(lot.shares);
              }
            });
          } else {
            qualifiedShares = safeNum(e.shares);
          }

          const projectedAmt = Math.floor(qualifiedShares * safeNum(event.amount));
          divInProjected += projectedAmt;

          const actualKey = `${m}_${e.id}`;
          const actualAmt = actualDetails[actualKey] !== undefined ? safeNum(actualDetails[actualKey]) : 0;
          if (actualAmt > 0) divInActualTotal += actualAmt;

          contributingEtfs.push({
            id: e.id,
            name: e.name,
            amt: projectedAmt,
            qualifiedShares,
            totalShares: safeNum(e.shares),
            exDate: event.exDate || '未填',
            actual: actualAmt,
          });
        });
      } else if (e.payMonths?.includes(m)) {
        let payout = safeNum(e.dividendPerShare);
        if (e.dividendType === 'annual' && e.payMonths.length > 0) payout /= e.payMonths.length;

        const projectedAmt = Math.floor(safeNum(e.shares) * payout);
        divInProjected += projectedAmt;
        contributingEtfs.push({
          id: e.id,
          name: e.name,
          amt: projectedAmt,
          qualifiedShares: safeNum(e.shares),
          totalShares: safeNum(e.shares),
          exDate: '預估',
        });
      }
    });

    const healthTaxProjected = Math.floor(divInProjected * 0.0211);
    const divUsed = divInActualTotal > 0 ? divInActualTotal : divInProjected - healthTaxProjected;

    let loanOut = 0;
    loans.forEach((l) => (loanOut += calculateLoanPayment(l)));

    // 信貸：用剩餘期數（避免 paidMonths > 0 還用 totalMonths 造成怪怪）
    const creditPrincipal = safeNum(creditLoan.principal);
    const creditRate = safeNum(creditLoan.rate) / 100 / 12;
    const creditRemain = Math.max(0, safeNum(creditLoan.totalMonths) - safeNum(creditLoan.paidMonths));
    let creditOut = 0;
    if (creditPrincipal > 0 && creditRemain > 0) {
      if (creditRate === 0) creditOut = Math.floor(creditPrincipal / creditRemain);
      else {
        creditOut = Math.floor(
          (creditPrincipal * creditRate * Math.pow(1 + creditRate, creditRemain)) /
            (Math.pow(1 + creditRate, creditRemain) - 1)
        );
      }
    }

    const stockInt =
      Math.floor((safeNum(stockLoan.principal) * (safeNum(stockLoan.rate) / 100)) / 12) +
      Math.floor((safeNum(globalMarginLoan.principal) * (safeNum(globalMarginLoan.rate) / 100)) / 12);

    const marginInt = etfs.reduce(
      (acc, e) => acc + (safeNum(e.marginLoanAmount) * (safeNum(e.marginInterestRate, 6.5) / 100)) / 12,
      0
    );

    // 實領已填：視為含稅，不再扣補充保費
    const healthTaxReal = divInActualTotal > 0 ? 0 : healthTaxProjected;

    flows.push({
      month: m,
      salary: monthlySalary,
      divProjected: divInProjected,
      divActualTotal,
      loanOut,
      creditOut,
      stockInt: stockInt + marginInt,
      life: safeNum(taxStatus.livingExpenses),
      healthTax: healthTaxReal,
      incomeTax: monthlyIncomeTaxImpact,
      net:
        monthlySalary +
        divUsed -
        loanOut -
        creditOut -
        (stockInt + marginInt) -
        safeNum(taxStatus.livingExpenses) -
        healthTaxReal -
        monthlyIncomeTaxImpact,
      details: contributingEtfs,
    });
  }

  return flows;
};

// ==========================================
// 5. Firebase 初始化（避免 HMR 重複 init）
// ==========================================
let db: any = null;
try {
  const app = getApps().length ? getApps()[0] : initializeApp(YOUR_FIREBASE_CONFIG);
  db = getFirestore(app);
} catch (e) {
  db = null;
}

// ==========================================
// 6. StorageService（穩定版）
// ==========================================
const withMeta = (payload: Omit<PersistedPayload, '_meta'>): PersistedPayload => ({
  ...payload,
  _meta: { schema: APP_SCHEMA_VERSION, updatedAt: Date.now() },
});

const getUpdatedAt = (d: any) => safeNum(d?._meta?.updatedAt, 0);

const sanitizePayload = (d: any): PersistedPayload => {
  const etfs: ETF[] = Array.isArray(d?.etfs) && d.etfs.length > 0 ? d.etfs : TONY_DEFAULT_ETFS;
  const cleanedEtfs = etfs.map((e: any) => ({
    ...e,
    dividendType: e?.dividendType || 'per_period',
    payMonths: Array.isArray(e?.payMonths) ? e.payMonths : [],
    schedule: Array.isArray(e?.schedule) ? e.schedule : [],
    lots: Array.isArray(e?.lots) ? e.lots : e?.lots ? [] : e?.lots,
  }));

  return {
    etfs: cleanedEtfs,
    loans: Array.isArray(d?.loans) ? d.loans : [],
    stockLoan: d?.stockLoan || DEFAULT_STOCK_LOAN,
    creditLoan: d?.creditLoan || DEFAULT_CREDIT,
    globalMarginLoan: d?.globalMarginLoan || DEFAULT_GLOBAL_MARGIN,
    taxStatus: d?.taxStatus || DEFAULT_TAX,
    allocation: d?.allocation || DEFAULT_ALLOC,
    cloudConfig: d?.cloudConfig || DEFAULT_CLOUD,
    actualDetails: d?.actualDetails || d?.actuals || {},
    _meta: d?._meta,
  };
};

const StorageService = {
  saveData: async (data: Omit<PersistedPayload, '_meta'>) => {
    const payload = withMeta(data);

    // 1) 本機先寫，確保至少不丟
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Local save failed:', e);
    }

    // 2) 雲端嘗試寫入（失敗也不炸）
    let cloudOk = false;
    if (db) {
      try {
        await setDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID), payload, { merge: true });
        cloudOk = true;
      } catch (e) {
        console.error('Cloud save failed:', e);
      }
    }
    return { localOk: true, cloudOk };
  },

  loadData: async () => {
    const readLocal = () => {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.error('Local parse failed:', e);
        return null;
      }
    };

    const local = readLocal();

    let cloud: any = null;
    if (db) {
      try {
        const snap = await getDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID));
        cloud = snap.exists() ? snap.data() : null;
      } catch (e) {
        console.error('Cloud load failed:', e);
      }
    }

    // 選最新（updatedAt）
    const pickCloud = getUpdatedAt(cloud) >= getUpdatedAt(local);
    const picked = (pickCloud ? cloud : local) || null;

    return {
      data: picked ? sanitizePayload(picked) : null,
      source: picked ? (pickCloud ? 'cloud' : 'local') : 'none',
    };
  },

  exportToFile: (data: Omit<PersistedPayload, '_meta'>) => {
    const payload = withMeta(data);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baozutang_backup.json`;
    a.click();
  },

  clearLocal: () => {
    try {
      localStorage.removeItem(LOCAL_KEY);
    } catch {}
  },
};

// ==========================================
// 7. CSV 更新行情（容錯）
// ==========================================
const normalizeSheetUrl = (url: string) => {
  if (!url) return url;
  // 若使用者貼的是 /edit 連結，嘗試轉成 export csv（簡化踩雷）
  if (url.includes('/spreadsheets/') && url.includes('/edit')) {
    return url.replace(/\/edit.*$/, '/export?format=csv');
  }
  return url;
};

const parseCsvPriceMap = (text: string) => {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((r) => r.split(',').map((x) => x.trim()))
    .filter((r) => r.length >= 2 && r[0]);

  const map = new Map<string, number>();
  rows.forEach((row) => {
    const code = row[0];
    if (!code || code.toLowerCase() === 'code') return;
    const price = parseFloat(row[1]);
    if (Number.isFinite(price)) map.set(code, price);
  });
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

  // 初始化
  useEffect(() => {
    StorageService.loadData().then((res) => {
      setDataSrc(res.source);

      if (res.data) {
        const d = res.data;
        setEtfs(d.etfs?.length ? d.etfs : TONY_DEFAULT_ETFS);
        setLoans(d.loans || []);
        setStockLoan(d.stockLoan || DEFAULT_STOCK_LOAN);
        setGlobalMarginLoan(d.globalMarginLoan || DEFAULT_GLOBAL_MARGIN);
        setCreditLoan(d.creditLoan || DEFAULT_CREDIT);
        setTaxStatus(d.taxStatus || DEFAULT_TAX);
        setAllocation(d.allocation || DEFAULT_ALLOC);
        setCloudConfig(d.cloudConfig || DEFAULT_CLOUD);
        setActualDetails(d.actualDetails || {});
      } else {
        setEtfs(TONY_DEFAULT_ETFS);
      }

      setIsInitializing(false);
    });
  }, []);

  // 自動存檔（容錯）
  useEffect(() => {
    if (isInitializing) return;

    setSaveStatus('saving');
    const t = setTimeout(async () => {
      try {
        const res = await StorageService.saveData({
          etfs,
          loans,
          stockLoan,
          creditLoan,
          globalMarginLoan,
          taxStatus,
          allocation,
          cloudConfig,
          actualDetails,
        });

        setDataSrc(res.cloudOk ? 'cloud' : 'local');
        setSaveStatus(res.cloudOk ? 'saved' : 'error');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) {
        console.error(e);
        setSaveStatus('error');
      }
    }, 1200);

    return () => clearTimeout(t);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, actualDetails, isInitializing]);

  const monthlyFlows = useMemo(
    () => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, actualDetails),
    [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, actualDetails]
  );

  const totalDividend = monthlyFlows.reduce((a, b) => a + (b.divActualTotal > 0 ? b.divActualTotal : b.divProjected * 0.9789), 0);
  const totalSalary = monthlyFlows.reduce((a, b) => a + b.salary, 0);
  const totalOut = monthlyFlows.reduce((a, b) => a + b.loanOut + b.creditOut + b.stockInt + b.life + b.healthTax + b.incomeTax, 0);
  const totalNet = totalSalary + totalDividend - totalOut;

  const totalValue = etfs.reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice), 0);
  const totalStockDebt =
    safeNum(stockLoan.principal) + safeNum(globalMarginLoan.principal) + etfs.reduce((a, e) => a + safeNum(e.marginLoanAmount), 0);

  const currentMaintenance = totalStockDebt === 0 ? 999 : (totalValue / totalStockDebt) * 100;

  const actualDiv = etfs
    .filter((e) => e.category === 'dividend')
    .reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);

  const actualHedge = etfs
    .filter((e) => e.category === 'hedging')
    .reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);

  const actualAct = etfs
    .filter((e) => e.category === 'active')
    .reduce((a, e) => a + safeNum(e.shares) * safeNum(e.currentPrice) - safeNum(e.marginLoanAmount), 0);

  const combatPower = Math.floor(totalValue / 10000 + totalDividend / 12 / 100);
  const fireRatio = totalOut > 0 ? (totalDividend / totalOut) * 100 : 0;

  const snowballData = useMemo(() => {
    const avgYield = totalValue > 0 ? totalDividend / totalValue : 0.05;
    const annualSavings = totalNet;
    const data: any[] = [];
    let curWealth = totalValue;
    for (let year = 0; year <= 10; year++) {
      data.push({ year: `Y${year}`, wealth: Math.floor(curWealth) });
      curWealth = curWealth * 1.05 + (reinvest ? curWealth * avgYield : 0) + annualSavings;
    }
    return data;
  }, [totalValue, totalDividend, totalNet, reinvest]);

  const pieData = [
    { name: '配息', value: Math.max(1, actualDiv), color: COLORS.dividend },
    { name: '避險', value: Math.max(1, actualHedge), color: COLORS.hedging },
    { name: '主動', value: Math.max(1, actualAct), color: COLORS.active },
  ];

  const radarData = [
    { subject: '現金流', A: Math.min(100, fireRatio) },
    { subject: '安全性', A: Math.min(100, (actualHedge / (totalValue - totalStockDebt || 1)) * 500) },
    { subject: '維持率', A: Math.min(100, (currentMaintenance - 130) * 2) },
    { subject: '成長', A: Math.min(100, (actualAct / (totalValue - totalStockDebt || 1)) * 500) },
  ];

  const moveEtf = (i: number, d: number) => {
    setEtfs((prev) => {
      const n = [...prev];
      if (i + d < 0 || i + d >= n.length) return prev;
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  };

  const removeEtf = (id: string) => {
    if (confirm('確定刪除？')) setEtfs((prev) => prev.filter((e) => e.id !== id));
  };

  const updateLoan = (i: number, f: string, v: any) => {
    setLoans((prev) => {
      const n = [...prev];
      if (!n[i]) return prev;

      if (f === 'startDate' && v) {
        const start = new Date(v);
        const now = new Date();
        const dm = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
        n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, dm) };
      } else {
        n[i] = { ...n[i], [f]: v };
      }
      return n;
    });
  };

  const updateDetailActual = (month: number, etfId: string, val: number) => {
    setActualDetails((prev) => ({ ...prev, [`${month}_${etfId}`]: safeNum(val) }));
  };

  const updateSchedule = (etfIdx: number, eventIdx: number, field: string, val: any) => {
    setEtfs((prev) =>
      prev.map((etf, i) => {
        if (i !== etfIdx) return etf;
        const schedule = (etf.schedule || []).map((ev, j) => (j !== eventIdx ? ev : { ...ev, [field]: val }));
        return { ...etf, schedule };
      })
    );
  };

  const initSchedule = (index: number) => {
    setEtfs((prev) =>
      prev.map((etf, i) => {
        if (i !== index) return etf;
        const schedule: DividendEvent[] = [
          { id: 'q1', name: '2026 Q1', exDate: '', payDate: '', amount: safeNum(etf.dividendPerShare), isActual: false },
          { id: 'q2', name: '2026 Q2', exDate: '', payDate: '', amount: safeNum(etf.dividendPerShare), isActual: false },
          { id: 'q3', name: '2026 Q3', exDate: '', payDate: '', amount: safeNum(etf.dividendPerShare), isActual: false },
          { id: 'q4', name: '2026 Q4', exDate: '', payDate: '', amount: safeNum(etf.dividendPerShare), isActual: false },
        ];
        return { ...etf, schedule };
      })
    );
  };

  const handleUpdatePrices = async () => {
    if (!cloudConfig.priceSourceUrl) {
      alert('請輸入連結！');
      setShowSettings(true);
      return;
    }
    setIsUpdatingPrices(true);
    try {
      const res = await fetch(normalizeSheetUrl(cloudConfig.priceSourceUrl));
      const text = await res.text();
      const priceMap = parseCsvPriceMap(text);

      setEtfs((prev) =>
        prev.map((e) => {
          const key = (e.code || e.id || '').trim();
          return priceMap.has(key) ? { ...e, currentPrice: priceMap.get(key)! } : e;
        })
      );

      alert('行情更新成功！');
    } catch (e) {
      console.error(e);
      alert('更新失敗');
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('確定重置為預設資料？（會清除本機資料，並以預設資料覆蓋儲存）')) return;

    // 清本機 + 回到預設狀態
    StorageService.clearLocal();

    setEtfs(TONY_DEFAULT_ETFS);
    setLoans([]);
    setStockLoan(DEFAULT_STOCK_LOAN);
    setGlobalMarginLoan(DEFAULT_GLOBAL_MARGIN);
    setCreditLoan(DEFAULT_CREDIT);
    setTaxStatus(DEFAULT_TAX);
    setAllocation(DEFAULT_ALLOC);
    setCloudConfig(DEFAULT_CLOUD);
    setActualDetails({});

    // 立刻存一次（避免你下一次開啟又被舊資料蓋回）
    try {
      const res = await StorageService.saveData({
        etfs: TONY_DEFAULT_ETFS,
        loans: [],
        stockLoan: DEFAULT_STOCK_LOAN,
        creditLoan: DEFAULT_CREDIT,
        globalMarginLoan: DEFAULT_GLOBAL_MARGIN,
        taxStatus: DEFAULT_TAX,
        allocation: DEFAULT_ALLOC,
        cloudConfig: DEFAULT_CLOUD,
        actualDetails: {},
      });
      setDataSrc(res.cloudOk ? 'cloud' : 'local');
      setSaveStatus(res.cloudOk ? 'saved' : 'error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-sans">
        <Loader2 className="animate-spin mr-2" /> 雲端同步中...
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-900 text-white font-sans selection:bg-emerald-500/30">
      <header className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2">
            <Calculator /> 包租唐戰情室 V76
          </h1>

          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 flex items-center gap-1">
              {saveStatus === 'saving' ? (
                <Loader2 size={12} className="animate-spin text-amber-400" />
              ) : saveStatus === 'saved' ? (
                <CheckCircle2 size={12} className="text-emerald-400" />
              ) : saveStatus === 'error' ? (
                <AlertTriangle size={12} className="text-red-400" />
              ) : dataSrc === 'cloud' ? (
                <Wifi size={12} className="text-blue-400" />
              ) : (
                <WifiOff size={12} className="text-slate-500" />
              )}
              {dataSrc === 'cloud' ? '雲端連線' : '本機模式'}
              {saveStatus === 'error' ? '（雲端失敗）' : ''}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleUpdatePrices}
            className="p-2 bg-slate-800 rounded border border-slate-700 text-emerald-400 hover:bg-emerald-900/30 transition-all"
            title="更新行情"
          >
            {isUpdatingPrices ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-slate-800 rounded border border-slate-700 hover:bg-slate-700 transition-all"
            title="設定"
          >
            <Settings size={18} />
          </button>

          <button
            onClick={handleReset}
            className="p-2 bg-slate-800 rounded border border-slate-700 text-red-400 hover:bg-red-900/30 transition-all"
            title="重置"
          >
            <RotateCcw size={18} />
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;

              const r = new FileReader();
              r.onload = (ev) => {
                try {
                  const raw = JSON.parse(ev.target?.result as string);
                  const d = sanitizePayload(raw);

                  setEtfs(d.etfs);
                  setLoans(d.loans || []);
                  setStockLoan(d.stockLoan || DEFAULT_STOCK_LOAN);
                  setGlobalMarginLoan(d.globalMarginLoan || DEFAULT_GLOBAL_MARGIN);
                  setCreditLoan(d.creditLoan || DEFAULT_CREDIT);
                  setTaxStatus(d.taxStatus || DEFAULT_TAX);
                  setAllocation(d.allocation || DEFAULT_ALLOC);
                  setCloudConfig(d.cloudConfig || DEFAULT_CLOUD);
                  setActualDetails(d.actualDetails || {});
                  alert('匯入成功');
                } catch (err) {
                  console.error(err);
                  alert('格式錯誤');
                }
              };
              r.readAsText(f);
            }}
            className="hidden"
            accept=".json"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-slate-800 rounded border border-slate-700 text-blue-400"
            title="匯入"
          >
            <Upload size={18} />
          </button>

          <button
            onClick={() =>
              StorageService.exportToFile({
                etfs,
                loans,
                stockLoan,
                creditLoan,
                globalMarginLoan,
                taxStatus,
                allocation,
                cloudConfig,
                actualDetails,
              })
            }
            className="p-2 bg-slate-800 rounded border border-slate-700 text-amber-400"
            title="匯出"
          >
            <Download size={18} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-800 p-6 rounded-2xl border border-emerald-500/50 shadow-xl relative overflow-hidden">
            <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">玩家等級</div>
            <div className="text-3xl font-black mb-2">{fireRatio >= 100 ? '財富國王 👑' : fireRatio >= 50 ? '資產領主 ⚔️' : '理財騎士 🛡️'}</div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, fireRatio)}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <div className="text-slate-500 text-[10px]">戰鬥力</div>
                <div className="font-mono font-bold">{combatPower.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px]">維持率</div>
                <div className={currentMaintenance < 140 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {currentMaintenance === 999 ? 'MAX' : currentMaintenance.toFixed(0) + '%'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px]">FIRE%</div>
                <div className="text-orange-400 font-bold font-mono">{fireRatio.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-cyan-300 flex items-center gap-2">
              <ShieldCheck /> 資產體質
            </h2>
            <div className="h-64 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Radar dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-blue-300 flex items-center gap-2">
              <PieIcon /> 資金分配 (淨值)
            </h2>
            <div className="h-48 flex justify-center items-center mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={(entry as any).color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>配息型 ({allocation.dividendRatio}%)</span>
                  <span>缺 {formatMoney(Math.max(0, (allocation.totalFunds * allocation.dividendRatio) / 100 - actualDiv))}</span>
                </div>
                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{
                      width: `${Math.min(100, (actualDiv / ((allocation.totalFunds * allocation.dividendRatio) / 100 || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>避險型 ({allocation.hedgingRatio}%)</span>
                  <span>缺 {formatMoney(Math.max(0, (allocation.totalFunds * allocation.hedgingRatio) / 100 - actualHedge))}</span>
                </div>
                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full"
                    style={{
                      width: `${Math.min(100, (actualHedge / ((allocation.totalFunds * allocation.hedgingRatio) / 100 || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>主動型 ({allocation.activeRatio}%)</span>
                  <span>缺 {formatMoney(Math.max(0, (allocation.totalFunds * allocation.activeRatio) / 100 - actualAct))}</span>
                </div>
                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full"
                    style={{
                      width: `${Math.min(100, (actualAct / ((allocation.totalFunds * allocation.activeRatio) / 100 || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-emerald-300 flex items-center gap-2">
              <Activity /> 標的清單
            </h2>

            <div className="space-y-4">
              {etfs.map((e, idx) => (
                <div key={e.id} className="p-4 bg-slate-900 rounded-xl border border-slate-700 relative group">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => moveEtf(idx, -1)} className="p-1 hover:bg-slate-700 rounded text-slate-400" title="上移">
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => moveEtf(idx, 1)} className="p-1 hover:bg-slate-700 rounded text-slate-400" title="下移">
                      <ArrowDown size={14} />
                    </button>
                    <button onClick={() => removeEtf(e.id)} className="p-1 hover:bg-slate-700 rounded text-red-400" title="刪除">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={e.code || ''}
                        onChange={(v) =>
                          setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, code: v.target.value } : x)))
                        }
                        className="absolute -top-5 left-0 text-[10px] text-slate-500 bg-slate-800 px-1 rounded w-16"
                        placeholder="代號"
                      />
                      <input
                        type="text"
                        value={e.name}
                        onChange={(v) =>
                          setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, name: v.target.value } : x)))
                        }
                        className="bg-transparent font-bold text-white outline-none w-full"
                      />
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowCalendar(showCalendar === e.id ? null : e.id)}
                        className={`p-1 rounded ${showCalendar === e.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                        title="行事曆"
                      >
                        <CalendarDays size={14} />
                      </button>
                      <button onClick={() => setActiveBuyId(activeBuyId === e.id ? null : e.id)} className="p-1 rounded bg-slate-800" title="新增交易">
                        <ShoppingCart size={14} />
                      </button>
                      <button onClick={() => setExpandedEtfId(expandedEtfId === e.id ? null : e.id)} className="p-1 rounded bg-slate-800" title="交易紀錄">
                        <List size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <select
                      value={e.category || 'dividend'}
                      onChange={(v) =>
                        setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, category: v.target.value as any } : x)))
                      }
                      className="bg-slate-800 text-xs text-blue-300 rounded border border-slate-700 px-1 py-0.5 outline-none"
                    >
                      <option value="dividend">配息型</option>
                      <option value="hedging">避險型</option>
                      <option value="active">主動型</option>
                    </select>
                  </div>

                  {/* 行事曆設定 */}
                  {showCalendar === e.id && (
                    <div className="mb-3 p-3 bg-slate-800 border border-emerald-500/50 rounded-lg animate-in slide-in-from-top-2">
                      <div className="text-xs font-bold text-emerald-400 mb-2 flex justify-between items-center">
                        <span>📅 {e.name} 2026 配息行事曆</span>
                        <button onClick={() => setShowCalendar(null)} className="text-slate-500 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {e.schedule && e.schedule.length > 0 ? (
                          e.schedule.map((event, eventIdx) => (
                            <div key={event.id} className="grid grid-cols-7 gap-1 text-[10px] items-center">
                              <div className="col-span-1 text-slate-400">{event.name}</div>
                              <div className="col-span-2">
                                <input
                                  type="date"
                                  value={event.exDate}
                                  onChange={(v) => updateSchedule(idx, eventIdx, 'exDate', v.target.value)}
                                  className="w-full bg-slate-900 rounded px-1 text-slate-300"
                                />
                              </div>
                              <div className="col-span-2">
                                <input
                                  type="date"
                                  value={event.payDate}
                                  onChange={(v) => updateSchedule(idx, eventIdx, 'payDate', v.target.value)}
                                  className="w-full bg-slate-900 rounded px-1 text-emerald-300"
                                />
                              </div>
                              <div className="col-span-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={event.amount}
                                  onChange={(v) => updateSchedule(idx, eventIdx, 'amount', safeNum(v.target.value))}
                                  className="w-full bg-slate-900 rounded px-1 text-right text-yellow-300"
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4">
                            <div className="text-xs text-slate-500 mb-2">此標的尚無行事曆設定</div>
                            <button
                              onClick={() => initSchedule(idx)}
                              className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500 transition-all shadow-lg"
                            >
                              ➕ 建立 2026 季度行事曆
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 新增交易 */}
                  {activeBuyId === e.id && (
                    <div className="mb-3 p-3 bg-emerald-900/20 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="number"
                          placeholder="股數"
                          value={buyForm.shares}
                          onChange={(v) => setBuyForm({ ...buyForm, shares: v.target.value })}
                          className="bg-slate-900 p-1 rounded text-xs"
                        />
                        <input
                          type="number"
                          placeholder="單價"
                          value={buyForm.price}
                          onChange={(v) => setBuyForm({ ...buyForm, price: v.target.value })}
                          className="bg-slate-900 p-1 rounded text-xs"
                        />
                        <input
                          type="number"
                          placeholder="融資額"
                          value={buyForm.margin}
                          onChange={(v) => setBuyForm({ ...buyForm, margin: v.target.value })}
                          className="bg-slate-900 p-1 rounded text-xs"
                        />
                        <input
                          type="date"
                          value={buyForm.date}
                          onChange={(v) => setBuyForm({ ...buyForm, date: v.target.value })}
                          className="bg-slate-900 p-1 rounded text-xs"
                        />
                      </div>

                      <button
                        onClick={() => {
                          const s = safeNum(buyForm.shares);
                          const p = safeNum(buyForm.price);
                          const m = safeNum(buyForm.margin);

                          if (!s || !p) return;

                          setEtfs((prev) => {
                            const nEtfs = [...prev];
                            const current = nEtfs[idx];
                            const newLot: Lot = {
                              id: Date.now().toString(),
                              date: buyForm.date,
                              shares: s,
                              price: p,
                              fee: Math.floor(s * p * BROKERAGE_RATE),
                              margin: m,
                            };
                            nEtfs[idx] = recalculateEtfStats({ ...current, lots: [...(current.lots || []), newLot] });
                            return nEtfs;
                          });

                          setBuyForm({ shares: '', price: '', date: '', margin: '' });
                          setActiveBuyId(null);
                        }}
                        className="w-full bg-emerald-600 text-xs py-1 rounded font-bold"
                      >
                        確認交易
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div>
                      <label className="text-slate-500">股數</label>
                      <div className="pt-1 font-mono">{safeNum(e.shares).toLocaleString()}</div>
                    </div>

                    <div>
                      <label className="text-slate-500">現價</label>
                      <input
                        type="number"
                        value={safeNum(e.currentPrice)}
                        onChange={(v) =>
                          setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, currentPrice: safeNum(v.target.value) } : x)))
                        }
                        className="w-full bg-slate-800 rounded p-1 border border-slate-700 mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-slate-500">配息(近一期)</label>
                      <div className="flex gap-1 items-center">
                        <input
                          type="number"
                          value={safeNum(e.dividendPerShare)}
                          onChange={(v) =>
                            setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, dividendPerShare: safeNum(v.target.value) } : x)))
                          }
                          className="w-full bg-slate-800 rounded p-1 border border-slate-700 mt-1"
                        />
                        <select
                          value={e.dividendType}
                          onChange={(v) =>
                            setEtfs((prev) => prev.map((x, i) => (i === idx ? { ...x, dividendType: v.target.value as any } : x)))
                          }
                          className="bg-slate-800 text-[10px] text-blue-400 outline-none"
                        >
                          <option value="per_period">次</option>
                          <option value="annual">年</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setEtfs((prev) =>
                            prev.map((x, i) => {
                              if (i !== idx) return x;
                              const payMonths = x.payMonths || [];
                              const ms = payMonths.includes(m) ? payMonths.filter((v) => v !== m) : [...payMonths, m].sort((a, b) => a - b);
                              return { ...x, payMonths: ms };
                            })
                          );
                        }}
                        className={`w-5 h-5 rounded text-[10px] flex items-center justify-center transition-all ${
                          e.payMonths?.includes(m) ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {expandedEtfId === e.id && e.lots && (
                    <div className="mt-3 space-y-1">
                      {e.lots.map((l) => (
                        <div key={l.id} className="flex justify-between text-[10px] bg-slate-800 p-1.5 rounded border border-slate-700">
                          <span>
                            {l.date} | {l.shares}股
                          </span>
                          <span>
                            {formatMoney(l.price)} (融:{formatMoney(l.margin || 0)}){' '}
                            <button
                              onClick={() => {
                                setEtfs((prev) => {
                                  const n = [...prev];
                                  const cur = n[idx];
                                  const nextLots = (cur.lots || []).filter((x) => x.id !== l.id);
                                  n[idx] = recalculateEtfStats({ ...cur, lots: nextLots });
                                  return n;
                                });
                              }}
                              className="text-red-500 ml-1"
                            >
                              ×
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={() =>
                  setEtfs((prev) => [
                    ...prev,
                    {
                      id: Date.now().toString(),
                      name: '新標的',
                      code: '',
                      shares: 0,
                      costPrice: 0,
                      currentPrice: 0,
                      dividendPerShare: 0,
                      dividendType: 'annual',
                      payMonths: [1, 4, 7, 10],
                      category: 'dividend',
                      marginLoanAmount: 0,
                      schedule: [],
                      lots: [],
                    },
                  ])
                }
                className="w-full py-2 border border-dashed border-slate-600 rounded-xl text-slate-500 hover:text-white transition-all"
              >
                + 新增標的
              </button>
            </div>
          </section>
        </div>

        {/* Right Column */}
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
                <TrendingUp className="text-indigo-400" /> 十年財富滾雪球 (含薪資儲蓄)
              </h3>
              <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-600">
                <button onClick={() => setReinvest(false)} className={`px-3 py-1 text-xs rounded transition-all ${!reinvest ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                  花掉股息
                </button>
                <button onClick={() => setReinvest(true)} className={`px-3 py-1 text-xs rounded transition-all ${reinvest ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                  複利投入
                </button>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snowballData}>
                  <defs>
                    <linearGradient id="cw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="year" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip formatter={(v: any) => formatMoney(v)} />
                  <Area type="monotone" dataKey="wealth" stroke="#818cf8" fill="url(#cw)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl overflow-x-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Calendar className="text-blue-400" /> 每月對帳明細 (可填實領)
            </h3>

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
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 font-mono text-xs cursor-pointer"
                      onClick={() => setExpandedMonth(expandedMonth === r.month ? null : r.month)}
                    >
                      <td className="p-3 font-bold text-white font-sans flex items-center gap-1">
                        {r.month}月 {expandedMonth === r.month ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </td>
                      <td className="p-3 text-slate-400">{formatMoney(r.salary)}</td>
                      <td className="p-3 text-slate-500">{formatMoney(r.divProjected)}</td>
                      <td className="p-3 text-emerald-400 font-bold">{r.divActualTotal > 0 ? formatMoney(r.divActualTotal) : '-'}</td>
                      <td
                        className={`p-3 ${
                          r.divActualTotal > 0 && r.divActualTotal - r.divProjected * 0.9789 < 0 ? 'text-red-400' : 'text-slate-500'
                        }`}
                      >
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
                        <td colSpan={11} className="p-3">
                          <div className="space-y-2">
                            <div className="text-xs text-slate-400 mb-2 font-bold flex items-center gap-2">
                              👇 輸入各檔 ETF 實領金額 (含稅)：
                              <span className="text-[10px] bg-slate-700 px-1 rounded text-slate-300">系統自動檢查買進日是否符合除息資格</span>
                            </div>

                            {r.details?.map((d: any, i: number) => (
                              <div key={i} className="flex justify-between items-center border-b border-slate-700 pb-2">
                                <div className="w-1/3">
                                  <span className="text-white text-sm">
                                    {d.name} <span className="text-[10px] text-slate-500">(除息 {d.exDate})</span>
                                  </span>
                                  <div className="text-[10px] text-slate-500">
                                    預估: {formatMoney(d.amt)}
                                    <span className={d.qualifiedShares < d.totalShares ? 'text-orange-400 ml-1' : 'text-slate-600 ml-1'}>
                                      (資格: {safeNum(d.qualifiedShares).toLocaleString()}/{safeNum(d.totalShares).toLocaleString()}股)
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-emerald-400">實領:</span>
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={d.actual || ''}
                                    onChange={(e) => updateDetailActual(r.month, d.id, safeNum(e.target.value))}
                                    className="w-24 bg-slate-800 border border-emerald-500/30 rounded px-2 py-1 text-emerald-400 font-bold text-right"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>

                                <div className="text-xs text-slate-500 w-20 text-right">差: {d.actual ? formatMoney(d.actual - Math.floor(d.amt * 0.9789)) : '-'}</div>
                              </div>
                            ))}

                            {(!r.details || r.details.length === 0) && <span className="text-slate-500 text-xs">本月無配息紀錄</span>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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
                <div className="text-[11px] text-slate-500 mt-1">小提醒：如果你貼的是 Google Sheet /edit 連結，我已自動嘗試轉成 /export?format=csv。</div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <div>
                  <label className="text-slate-400">投資預算</label>
                  <input
                    type="number"
                    value={allocation.totalFunds}
                    onChange={(e) => setAllocation({ ...allocation, totalFunds: safeNum(e.target.value) })}
                    className="w-full bg-slate-800 p-1.5 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-400">配息%</label>
                  <input
                    type="number"
                    value={allocation.dividendRatio}
                    onChange={(e) => setAllocation({ ...allocation, dividendRatio: safeNum(e.target.value) })}
                    className="w-full bg-slate-800 p-1.5 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-400">避險%</label>
                  <input
                    type="number"
                    value={allocation.hedgingRatio}
                    onChange={(e) => setAllocation({ ...allocation, hedgingRatio: safeNum(e.target.value) })}
                    className="w-full bg-slate-800 p-1.5 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-400">主動%</label>
                  <input
                    type="number"
                    value={allocation.activeRatio}
                    onChange={(e) => setAllocation({ ...allocation, activeRatio: safeNum(e.target.value) })}
                    className="w-full bg-slate-800 p-1.5 rounded"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-yellow-400 font-bold mb-2">綜所稅試算參數 (2025)</h4>
                  <div className="space-y-2 p-3 bg-yellow-900/20 rounded-xl border border-yellow-700/50">
                    <div>
                      <label className="text-slate-400">年薪資所得 (含獎金)</label>
                      <input
                        type="number"
                        value={taxStatus.salaryIncome}
                        onChange={(e) => setTaxStatus({ ...taxStatus, salaryIncome: safeNum(e.target.value) })}
                        className="w-full bg-slate-900 p-1.5 rounded border border-slate-700"
                      />
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
                        <input
                          type="number"
                          value={taxStatus.dependents}
                          onChange={(e) => setTaxStatus({ ...taxStatus, dependents: safeNum(e.target.value) })}
                          className="w-full bg-slate-900 p-1 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500">身障人數</label>
                        <input
                          type="number"
                          value={taxStatus.disabilityCount}
                          onChange={(e) => setTaxStatus({ ...taxStatus, disabilityCount: safeNum(e.target.value) })}
                          className="w-full bg-slate-900 p-1 rounded"
                        />
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
                        <input
                          type="number"
                          value={creditLoan.principal}
                          onChange={(e) => setCreditLoan({ ...creditLoan, principal: safeNum(e.target.value) })}
                          className="w-full bg-slate-900 p-1 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px]">利率%</label>
                        <input
                          type="number"
                          value={creditLoan.rate}
                          onChange={(e) => setCreditLoan({ ...creditLoan, rate: safeNum(e.target.value) })}
                          className="w-full bg-slate-900 p-1 rounded"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-500 text-[10px]">借貸本金</label>
                        <input
                          type="number"
                          value={stockLoan.principal}
                          onChange={(e) => setStockLoan({ ...stockLoan, principal: safeNum(e.target.value) })}
                          className="w-full bg-slate-900 p-1 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px]">利率%</label>
                        <input
                          type="number"
                          value={stockLoan.rate}
                          onChange={(e) => setStockLoan({ ...stockLoan, rate: safeNum(e.target.value) })}
                          className="w-full bg-slate-900 p-1 rounded"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400">每月生活費</label>
                      <input
                        type="number"
                        value={taxStatus.livingExpenses}
                        onChange={(e) => setTaxStatus({ ...taxStatus, livingExpenses: safeNum(e.target.value) })}
                        className="w-full bg-slate-900 p-1.5 rounded border border-slate-700"
                      />
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
                        <label className="text-[10px] text-slate-500">已繳期數</label>
                        <input type="number" value={l.paidMonths} onChange={(e) => updateLoan(i, 'paidMonths', safeNum(e.target.value))} className="w-full bg-slate-800 p-1 rounded" />
                      </div>
                    </div>

                    <button onClick={() => setLoans((prev) => prev.filter((x) => x.id !== l.id))} className="text-[10px] text-red-500 mt-2 hover:underline">
                      刪除貸款
                    </button>
                  </div>
                ))}

                <button
                  onClick={() =>
                    setLoans((prev) => [
                      ...prev,
                      {
                        id: Date.now().toString(),
                        name: '新房貸',
                        principal: 0,
                        rate1: 2.1,
                        rate1Months: 36,
                        rate2: 2.3,
                        totalMonths: 360,
                        paidMonths: 0,
                        gracePeriod: 0,
                        type: 'PrincipalAndInterest',
                      },
                    ])
                  }
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
