import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Calculator, DollarSign, Wallet, Activity, Save, Upload, Download, RotateCcw, Settings, Globe, Cloud, Loader2, Target, Zap, TrendingUp, RefreshCw, Gift, PieChart as PieIcon, Banknote, Flame, Share2, Scale, ShieldCheck, Swords, Coins, Skull, Gem, Scroll, Sparkles, Lock, Aperture, List, Trash2, X, Tag, ShoppingCart, Coffee, Layers, Crown, Trophy, Calendar, Lightbulb, CheckCircle2, HelpCircle, Edit3, ArrowRightLeft, Plus, ArrowUp, ArrowDown } from 'lucide-react';

// ==========================================
// 1. 您的專屬備份資料
// ==========================================
const USER_BACKUP_DATA = {
  "etfs": [
    {
      "payMonths": [2, 5, 8, 11], "costPrice": 36.1, "marginInterestRate": 4.5, "code": "0056", "name": "元大高股息", "currentPrice": 38.26, "category": "dividend", "shares": 101000, "dividendPerShare": 0.866, "dividendType": "per_period", "marginLoanAmount": 0, "id": "0056",
      "lots": [
        { "id": "1767668577363", "date": "2025-12-15", "price": 36.2, "fee": 515, "shares": 10000 },
        { "id": "1767668601748", "shares": 1000, "fee": 51, "date": "2025-12-16", "price": 36.09 },
        { "shares": 5000, "fee": 257, "price": 36.11, "date": "2025-12-16", "id": "1767668616332" },
        { "fee": 1027, "date": "2025-12-18", "id": "1767668634444", "shares": 20000, "price": 36.04 },
        { "shares": 20000, "fee": 1025, "id": "1767668652774", "date": "2025-12-18", "price": 35.99 },
        { "date": "2025-12-18", "id": "1767668681930", "fee": 1232, "shares": 24000, "price": 36.03 },
        { "shares": 10000, "fee": 513, "date": "2025-12-18", "price": 36.02, "id": "1767668702185" },
        { "id": "1767668714220", "price": 36.01, "shares": 10000, "fee": 513, "date": "2025-12-18" },
        { "fee": 52, "price": 36.54, "shares": 1000, "id": "1767668734602", "date": "2025-12-23" }
      ]
    },
    {
      "marginLoanAmount": 143000, "id": "00919", "marginInterestRate": 4.5, "code": "00919", "costPrice": 22.82, "payMonths": [1, 4, 7, 10], "currentPrice": 23.99, "shares": 20000, "name": "群益精選", "dividendPerShare": 2.52, "dividendType": "annual", "category": "dividend",
      "lots": [
        { "price": 21.63, "shares": 10000, "date": "2025-12-16", "fee": 308, "id": "1767668450497" },
        { "date": "2026-01-29", "price": 23.94, "shares": 10000, "margin": 143000, "fee": 341, "id": "1769707306295" }
      ]
    },
    {
      "dividendType": "per_period", "costPrice": 13.55, "currentPrice": 14.97, "name": "群益主動強棒", "shares": 130000, "dividendPerShare": 0.285, "marginLoanAmount": 0, "marginInterestRate": 4.5, "category": "dividend", "id": "00929", "payMonths": [3, 6, 9, 12], "code": "00929",
      "lots": [
        { "date": "2025-12-03", "fee": 1075, "price": 13.48, "shares": 56000, "id": "1767668316456" },
        { "shares": 20000, "price": 13.6, "fee": 387, "id": "1767668343588", "date": "2025-12-18" },
        { "fee": 193, "id": "1767668363264", "price": 13.55, "shares": 10000, "date": "2025-12-18" },
        { "price": 13.56, "fee": 850, "id": "1767668387710", "date": "2025-12-18", "shares": 44000 }
      ]
    },
    {
      "name": "實體黃金 (克)", "payMonths": [], "dividendPerShare": 0, "category": "hedging", "id": "GOLD", "code": "GOLD", "marginInterestRate": 0, "dividendType": "annual", "marginLoanAmount": 0, "currentPrice": 5429, "costPrice": 4806.1, "shares": 72.2,
      "lots": [
        { "shares": 62.2, "date": "2026-01-13", "id": "1769369259569", "fee": 422, "price": 4767 },
        { "shares": 10, "id": "1769369323398", "fee": 71, "date": "2026-01-17", "price": 5000 }
      ]
    },
    {
      "name": "主動群益科技創新", "costPrice": 11.5, "id": "1769705642386", "currentPrice": 11.64, "marginLoanAmount": 137000, "marginInterestRate": 0, "dividendType": "per_period", "category": "dividend", "code": "00992A", "shares": 20000, "dividendPerShare": 0.2, "payMonths": [2, 5, 8, 11],
      "lots": [
        { "margin": 68000, "shares": 10000, "fee": 161, "price": 11.36, "date": "2026-01-26", "id": "1769707124128" },
        { "date": "2026-01-27", "price": 11.61, "id": "1769707159845", "margin": 69000, "shares": 10000, "fee": 165 }
      ]
    },
    {
      "shares": 10000, "marginInterestRate": 0, "costPrice": 18.43, "dividendType": "per_period", "marginLoanAmount": 108000, "code": "00981A", "dividendPerShare": 0.2, "payMonths": [1, 4, 7, 10], "currentPrice": 18.2, "id": "1769705935074", "category": "dividend", "name": "主動統一台股增長",
      "lots": [
        { "shares": 10000, "date": "2026-01-27", "fee": 262, "margin": 108000, "id": "1769707050037", "price": 18.4 }
      ]
    }
  ],
  "loans": [
    { "id": "loan-1", "paidMonths": 1, "startDate": "2025-12-02", "rate1": 1.775, "rate1Months": 10, "totalMonths": 480, "rate2": 2.275, "name": "新青安房貸", "principal": 8340000, "gracePeriod": 60, "type": "PrincipalAndInterest" },
    { "startDate": "2022-12-19", "id": "loan-2", "rate1": 2.327, "paidMonths": 37, "rate2": 2.327, "rate1Months": 240, "type": "PrincipalAndInterest", "principal": 9000000, "totalMonths": 240, "gracePeriod": 60, "name": "理財型房貸" }
  ],
  "stockLoan": { "rate": 2.56, "principal": 0, "maintenanceLimit": 130 },
  "creditLoan": { "rate": 4.05, "totalMonths": 84, "principal": 3040000, "paidMonths": 0 },
  "globalMarginLoan": { "rate": 4.5, "maintenanceLimit": 130, "principal": 0 },
  "taxStatus": { "salaryIncome": 589200, "dependents": 0, "hasSpouse": true, "isDisabled": true, "livingExpenses": 0 },
  "allocation": { "activeRatio": 5, "hedgingRatio": 15, "dividendRatio": 80, "totalFunds": 14500000 }
};

// ==========================================
// 2. 核心定義
// ==========================================

const BROKERAGE_RATE = 0.001425;
const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#a855f7', cash: '#334155' };

const MortgageType = { PrincipalAndInterest: 'PrincipalAndInterest', Principal: 'Principal' };

interface Lot { id: string; date: string; shares: number; price: number; fee?: number; margin?: number; }
interface ETF { id: string; code?: string; name: string; shares: number; costPrice: number; currentPrice: number; dividendPerShare: number; dividendType?: 'annual' | 'per_period'; payMonths?: number[]; category: 'dividend' | 'hedging' | 'active'; marginLoanAmount?: number; marginInterestRate?: number; lots?: Lot[]; }
interface Loan { id: string; name: string; principal: number; rate1: number; rate1Months: number; rate2: number; totalMonths: number; paidMonths: number; gracePeriod: number; startDate?: string; type: string; }
interface StockLoan { principal: number; rate: number; maintenanceLimit?: number; }
interface CreditLoan { principal: number; rate: number; totalMonths: number; paidMonths: number; }
interface TaxStatus { salaryIncome: number; livingExpenses: number; dependents: number; hasSpouse: boolean; isDisabled: boolean; }
interface AllocationConfig { totalFunds: number; dividendRatio: number; hedgingRatio: number; activeRatio: number; }
interface CloudConfig { apiKey: string; projectId: string; syncId: string; enabled: boolean; priceSourceUrl?: string; }
interface AppState { etfs: ETF[]; loans: Loan[]; stockLoan: StockLoan; globalMarginLoan: StockLoan; creditLoan: CreditLoan; taxStatus: TaxStatus; allocation: AllocationConfig; collection?: {id:string, count:number}[]; tokens?: number; }

const THEMES = { default: { name: '冒險者', color: 'emerald', bg: 'from-emerald-900', border: 'border-emerald-500', text: 'text-emerald-400', icon: <Zap className="w-4 h-4"/> } };

const GACHA_ITEMS = [
    { id: 'g1', name: '巴菲特的眼鏡', rarity: 'SR', icon: '👓', desc: '看透市場本質' },
    { id: 'g2', name: '蒙格的格柵', rarity: 'SSR', icon: '🏗️', desc: '多元思維模型' },
    { id: 'g3', name: '科斯托蘭尼之狗', rarity: 'R', icon: '🐕', desc: '主人與狗的牽絆' },
    { id: 'g4', name: '約翰伯格的方舟', rarity: 'UR', icon: '⛵', desc: '指數投資終極載具' },
    { id: 'g5', name: '索羅斯的煉金石', rarity: 'SSR', icon: '🔮', desc: '反身性理論' },
    { id: 'g6', name: '存錢小豬', rarity: 'N', icon: '🐷', desc: '積少成多' },
];

const INITIAL_ETFS = USER_BACKUP_DATA.etfs as any[];
const INITIAL_LOANS = USER_BACKUP_DATA.loans as any[];
const INITIAL_STOCK_LOAN = USER_BACKUP_DATA.stockLoan;
const INITIAL_GLOBAL_MARGIN_LOAN = USER_BACKUP_DATA.globalMarginLoan;
const INITIAL_CREDIT_LOAN = USER_BACKUP_DATA.creditLoan;
const INITIAL_TAX_STATUS = USER_BACKUP_DATA.taxStatus;
const INITIAL_ALLOCATION = USER_BACKUP_DATA.allocation;

// ==========================================
// 3. 工具與計算函數
// ==========================================

const formatMoney = (val: any) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '$0';
  return `$${Math.floor(Number(val)).toLocaleString()}`;
};

// ★★★ 核心計算：自動加總明細中的融資金額 ★★★
const recalculateEtfStats = (etf: ETF): ETF => {
    if (!etf.lots || etf.lots.length === 0) return etf;
    
    // 1. 總股數
    const totalShares = etf.lots.reduce((acc, lot) => acc + Number(lot.shares), 0);
    // 2. 總成本 (含手續費)
    const totalCost = etf.lots.reduce((acc, lot) => acc + (Number(lot.shares) * Number(lot.price)) + (Number(lot.fee) || 0), 0);
    // 3. 總融資 (這是您要的功能：自動加總每一筆的融資)
    const totalMargin = etf.lots.reduce((acc, lot) => acc + (Number(lot.margin) || 0), 0);

    return {
        ...etf,
        shares: totalShares,
        costPrice: totalShares > 0 ? Number((totalCost / totalShares).toFixed(2)) : 0,
        marginLoanAmount: totalMargin // 自動更新總融資額
    };
};

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
        (etfs || []).forEach(etf => { 
            if (etf.payMonths?.includes(m)) {
                let payoutPerShare = etf.dividendPerShare;
                if (etf.dividendType === 'annual' && etf.payMonths && etf.payMonths.length > 0) {
                    payoutPerShare = etf.dividendPerShare / etf.payMonths.length;
                }
                dividendInflow += (etf.shares * payoutPerShare); 
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
        monthlyFlows.push({ month: m, dividendInflow, loanOutflow, creditLoanOutflow: creditOutflow, stockLoanInterest: stockInterest + marginInterest, livingExpenses: taxStatus.livingExpenses, taxWithheld, netFlow: dividendInflow - loanOutflow - creditOutflow - (stockInterest + marginInterest) - taxStatus.livingExpenses - taxWithheld });
    }
    const yearlyNetPosition = monthlyFlows.reduce((acc, cur) => acc + cur.netFlow, 0);
    return { monthlyFlows, yearlyNetPosition, healthInsuranceTotal: totalDividendYear * 0.0211, incomeTaxTotal: 0 }; 
};

// 儲存服務
const STORAGE_KEY = 'baozutang_data_v44_final'; 
const CONFIG_KEY = 'baozutang_config';

const StorageService = {
    saveData: async (data: any) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; } },
    loadData: async () => { 
        try { 
            const local = localStorage.getItem(STORAGE_KEY); 
            if (local) return { data: JSON.parse(local), source: 'local' };
            return { data: USER_BACKUP_DATA, source: 'backup' }; 
        } catch (e) { return { data: USER_BACKUP_DATA, source: 'backup' }; } 
    },
    saveConfig: (config: any) => localStorage.setItem(CONFIG_KEY, JSON.stringify(config)),
    loadConfig: () => { try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch { return {}; } },
    exportToFile: (data: any) => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `baozutang_backup.json`; a.click(); }
};

// ==========================================
// 4. 主程式 (App)
// ==========================================

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  // Google Sheet Config
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({ apiKey: '', projectId: '', syncId: '', enabled: false, priceSourceUrl: '' });
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // UI State
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [newLot, setNewLot] = useState<{shares: string, price: string, date: string}>({ shares: '', price: '', date: '' });
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState<{shares: string, price: string, date: string, margin: string}>({ shares: '', price: '', date: '', margin: '' });

  // Data State
  const [etfs, setEtfs] = useState<ETF[]>(INITIAL_ETFS);
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [stockLoan, setStockLoan] = useState<StockLoan>(INITIAL_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(INITIAL_GLOBAL_MARGIN_LOAN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(INITIAL_CREDIT_LOAN);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(INITIAL_TAX_STATUS);
  const [allocation, setAllocation] = useState<AllocationConfig>(INITIAL_ALLOCATION);
  
  // Gacha State
  const [collection, setCollection] = useState<{id: string, count: number}[]>([]);
  const [tokens, setTokens] = useState(0);
  const [gachaResult, setGachaResult] = useState<any>(null);
  const [reinvest, setReinvest] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentClass = THEMES.default;

  // Init
  useEffect(() => {
    const initData = async () => {
      try {
        const result = await StorageService.loadData();
        const savedConfig = StorageService.loadConfig(); 
        if (savedConfig) setCloudConfig(prev => ({ ...prev, ...savedConfig }));

        if (result.data) {
          const d = result.data;
          if(d.etfs) setEtfs(d.etfs);
          if(d.loans) setLoans(d.loans);
          if(d.stockLoan) setStockLoan(d.stockLoan);
          if(d.globalMarginLoan) setGlobalMarginLoan(d.globalMarginLoan);
          if(d.creditLoan) setCreditLoan(d.creditLoan);
          if(d.taxStatus) setTaxStatus(d.taxStatus);
          if(d.allocation) setAllocation(d.allocation);
          if(d.collection) setCollection(d.collection);
          if(d.tokens) setTokens(d.tokens);
        }
      } catch (error) { console.error("Init failed", error); } finally { setIsInitializing(false); }
    };
    initData();
  }, []);

  // Auto-save
  useEffect(() => {
    if (isInitializing) return;
    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try { 
          const stateToSave: AppState = { etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, collection, tokens };
          await StorageService.saveData(stateToSave); 
          StorageService.saveConfig(cloudConfig); 
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
      } catch { setSaveStatus('error'); }
    }, 1000); return () => clearTimeout(timer);
  }, [etfs, loans, stockLoan, creditLoan, taxStatus, globalMarginLoan, allocation, collection, tokens, isInitializing, cloudConfig]);

  // Calculations
  const totalMarketValue = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * etf.currentPrice), 0), [etfs]);
  const totalStockDebt = stockLoan.principal + globalMarginLoan.principal + etfs.reduce((acc, e) => acc + (e.marginLoanAmount || 0), 0);
  const totalRealDebt = loans.reduce((acc, l) => acc + l.principal, 0) + creditLoan.principal;
  const currentMaintenance = useMemo(() => totalStockDebt === 0 ? 999 : (totalMarketValue / totalStockDebt) * 100, [totalMarketValue, totalStockDebt]);
  const unrealizedPL = useMemo(() => totalMarketValue - etfs.reduce((acc, e) => acc + (e.shares * e.costPrice), 0), [totalMarketValue, etfs]);

  const { monthlyFlows, yearlyNetPosition, healthInsuranceTotal, incomeTaxTotal } = useMemo(() => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);
  
  const fireMetrics = useMemo(() => { const exp = monthlyFlows.reduce((a,c)=>a+c.loanOutflow+c.creditLoanOutflow+c.livingExpenses,0); const inc = monthlyFlows.reduce((a,c)=>a+c.dividendInflow,0); return { ratio: exp>0?(inc/exp)*100:0, annualPassive: inc, annualExpenses: exp }; }, [monthlyFlows]);
  const combatPower = useMemo(() => Math.floor((totalMarketValue/10000) + (fireMetrics.annualPassive/12/100)), [totalMarketValue, fireMetrics]);
  const levelInfo = useMemo(() => { const r = fireMetrics.ratio; if(r>=100) return {title:'財富國王 👑', color:'text-yellow-400'}; if(r>=50) return {title:'資產領主 ⚔️', color:'text-purple-400'}; if(r>=20) return {title:'理財騎士 🛡️', color:'text-blue-400'}; return {title:'初心冒險者 🪵', color:'text-slate-400'}; }, [fireMetrics]);
  
  const radarData = useMemo(() => {
      const actualHedging = etfs.filter(e => e.category === 'hedging').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0);
      const actualActive = etfs.filter(e => e.category === 'active').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0);
      return [
        { subject: '現金流', A: Math.min(100, (fireMetrics.annualPassive / (fireMetrics.annualExpenses || 1)) * 100), fullMark: 100 },
        { subject: '安全性', A: Math.min(100, (actualHedging / (totalMarketValue || 1)) * 500), fullMark: 100 },
        { subject: '成長性', A: Math.min(100, (actualActive / (totalMarketValue || 1)) * 500), fullMark: 100 },
        { subject: '抗壓性', A: Math.min(100, (currentMaintenance - 130) * 2), fullMark: 100 },
        { subject: '稅務', A: 80, fullMark: 100 },
      ];
  }, [fireMetrics, totalMarketValue, etfs, currentMaintenance]);

  // Allocation Logic (Includes Target Calculations)
  const actualDividend = useMemo(() => etfs.filter(e => e.category === 'dividend').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualHedging = useMemo(() => etfs.filter(e => e.category === 'hedging').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualActive = useMemo(() => etfs.filter(e => e.category === 'active').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  
  const targetDividend = Math.floor(allocation.totalFunds * (allocation.dividendRatio / 100));
  const targetHedging = Math.floor(allocation.totalFunds * (allocation.hedgingRatio / 100));
  const targetActive = Math.floor(allocation.totalFunds * (allocation.activeRatio / 100));

  const pieData = [{ name: '配息型', value: actualDividend, color: COLORS.dividend }, { name: '避險型', value: actualHedging, color: COLORS.hedging }, { name: '主動型', value: actualActive, color: COLORS.active }].filter(d => d.value > 0);
  const isAllocationValid = (allocation.dividendRatio + allocation.hedgingRatio + allocation.activeRatio) === 100;

  const breakevenTip = useMemo(() => {
     if (yearlyNetPosition >= 0) return null;
     const deficit = Math.abs(yearlyNetPosition);
     const avgYield = 0.06; 
     return { deficit, avgYield: avgYield*100, neededCapital: deficit / avgYield };
  }, [yearlyNetPosition]);

  const snowballData = useMemo(() => { 
      const avgYield = totalMarketValue > 0 ? fireMetrics.annualPassive / totalMarketValue : 0.05; 
      const annualSavings = Number(yearlyNetPosition) || 0; 
      const data = []; 
      let currentWealth = totalMarketValue; 
      let currentIncome = fireMetrics.annualPassive; 
      for (let year = 0; year <= 10; year++) { 
          data.push({ year: `Y${year}`, wealth: Math.floor(currentWealth), income: Math.floor(currentIncome) }); 
          currentWealth = currentWealth * 1.05 + (reinvest ? currentIncome : 0) + annualSavings; 
          currentIncome = currentWealth * avgYield; 
      } 
      return data; 
  }, [monthlyFlows, totalMarketValue, yearlyNetPosition, fireMetrics, reinvest]);
  
  // 年度總計
  const totalDividend = useMemo(() => monthlyFlows.reduce((a, b) => a + b.dividendInflow, 0), [monthlyFlows]);
  const totalMortgage = useMemo(() => monthlyFlows.reduce((a, b) => a + b.loanOutflow, 0), [monthlyFlows]);
  const totalCredit = useMemo(() => monthlyFlows.reduce((a, b) => a + b.creditLoanOutflow, 0), [monthlyFlows]);
  const totalStockInterest = useMemo(() => monthlyFlows.reduce((a, b) => a + b.stockLoanInterest, 0), [monthlyFlows]);
  const totalLiving = useMemo(() => monthlyFlows.reduce((a, b) => a + b.livingExpenses, 0), [monthlyFlows]);
  const totalTax = useMemo(() => monthlyFlows.reduce((a, b) => a + b.taxWithheld, 0), [monthlyFlows]);
  const totalNet = useMemo(() => monthlyFlows.reduce((a, b) => a + b.netFlow, 0), [monthlyFlows]);

  // Handlers
  const updateEtf = (i: number, f: keyof ETF, v: any) => { const n = [...etfs]; n[i] = { ...n[i], [f]: v }; setEtfs(n); };
  const addEtf = () => setEtfs([...etfs, { id: Date.now().toString(), name: '新標的', code: '', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'annual', payMonths: [], marginLoanAmount: 0, marginInterestRate: 0, lots: [], category: 'dividend' }]);
  const removeEtf = (id: string) => { if (window.confirm('確定刪除？')) setEtfs(etfs.filter(e => e.id !== id)); };
  const toggleEtfDividendType = (index: number) => { const newEtfs = [...etfs]; newEtfs[index].dividendType = newEtfs[index].dividendType === 'annual' ? 'per_period' : 'annual'; setEtfs(newEtfs); };
  const toggleEtfPayMonth = (index: number, month: number) => { const etf = etfs[index]; const ms = etf.payMonths?.includes(month) ? etf.payMonths.filter(m => m !== month) : [...(etf.payMonths || []), month].sort((a, b) => a - b); updateEtf(index, 'payMonths', ms); };
  
  const updateLoan = (i: number, f: keyof Loan, v: any) => { 
      const n = [...loans]; 
      if (f === 'startDate' && v) { 
          const s = new Date(v), now = new Date(); 
          let m = (now.getFullYear() - s.getFullYear()) * 12 - s.getMonth() + now.getMonth(); 
          n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, m) }; 
      } else { 
          n[i] = { ...n[i], [f]: v }; 
      } 
      setLoans(n); 
  };
  
  // ★★★ V44 功能：移動標的順序 ★★★
  const moveEtf = (index: number, direction: number) => {
      const newEtfs = [...etfs];
      // 邊界檢查
      if (index + direction < 0 || index + direction >= newEtfs.length) return;
      // 交換位置
      const temp = newEtfs[index];
      newEtfs[index] = newEtfs[index + direction];
      newEtfs[index + direction] = temp;
      setEtfs(newEtfs);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=(ev)=>{ try{ const s=JSON.parse(ev.target?.result as string) as AppState; if(s.etfs){ setEtfs(s.etfs); setLoans(s.loans||[]); setStockLoan(s.stockLoan||INITIAL_STOCK_LOAN); setGlobalMarginLoan(s.globalMarginLoan||INITIAL_GLOBAL_MARGIN_LOAN); setCreditLoan(s.creditLoan||INITIAL_CREDIT_LOAN); setTaxStatus(s.taxStatus||INITIAL_TAX_STATUS); setAllocation(s.allocation||INITIAL_ALLOCATION); alert('成功'); } }catch{alert('錯誤');}}; r.readAsText(f); e.target.value=''; };
  const handleImportClick = () => fileInputRef.current?.click();
  
  const handleReset = () => { 
      if(confirm('確定重置？這將會把資料還原到「2026-01-29 備份檔」的狀態。')) { 
          const resetState = {
              etfs: USER_BACKUP_DATA.etfs,
              loans: USER_BACKUP_DATA.loans,
              stockLoan: USER_BACKUP_DATA.stockLoan,
              globalMarginLoan: USER_BACKUP_DATA.globalMarginLoan,
              creditLoan: USER_BACKUP_DATA.creditLoan,
              taxStatus: USER_BACKUP_DATA.taxStatus,
              allocation: USER_BACKUP_DATA.allocation,
              collection: [],
              tokens: 5
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(resetState));
          window.location.reload(); 
      }
  };
  const handleExport = () => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation });

  const handleUpdatePrices = async () => {
      if (!cloudConfig.priceSourceUrl) {
          alert('請先在「設定」中輸入 Google Sheet 的 CSV 連結！\n(格式：A欄代號, B欄現價)');
          setShowSettings(true);
          return;
      }
      setIsUpdatingPrices(true);
      try {
          const res = await fetch(cloudConfig.priceSourceUrl);
          const text = await res.text();
          const rows = text.split('\n').map(r => r.split(','));
          const priceMap = new Map<string, number>();
          rows.forEach(row => { if (row.length >= 2) { const code = row[0].trim(); const price = parseFloat(row[1].trim()); if (code && !isNaN(price)) { priceMap.set(code, price); } } });
          let updatedCount = 0;
          const newEtfs = etfs.map(etf => { const code = etf.code || etf.id; if (priceMap.has(code)) { updatedCount++; return { ...etf, currentPrice: priceMap.get(code)! }; } return etf; });
          if (updatedCount > 0) { setEtfs(newEtfs); alert(`成功更新 ${updatedCount} 檔標的之現價！`); } else { alert('未找到匹配的代號，請確認 Google Sheet 格式'); }
      } catch (e) { console.error(e); alert('更新失敗，請檢查連結是否公開且為 CSV 格式'); } finally { setIsUpdatingPrices(false); }
  };

  // UI Handlers (In Scope)
  const toggleBuy = (id: string) => { setActiveBuyId(activeBuyId === id ? null : id); };
  const toggleLots = (id: string) => { setExpandedEtfId(expandedEtfId === id ? null : id); };
  
  // ★★★ V44 功能：新增買入時自動計算總融資 ★★★
  const submitBuy = (i: number) => {
    const s = Number(buyForm.shares), p = Number(buyForm.price), m = Number(buyForm.margin); if (!s || !p) return;
    
    // 複製現有 etfs
    const newEtfs = [...etfs];
    const currentEtf = newEtfs[i];
    
    // 新增交易紀錄
    const newLot: Lot = { 
        id: Date.now().toString(), 
        date: buyForm.date, 
        shares: s, 
        price: p, 
        fee: Math.floor(s*p*BROKERAGE_RATE), 
        margin: m 
    };
    
    // 更新 lots 陣列
    const updatedLots = currentEtf.lots ? [...currentEtf.lots, newLot] : [newLot];
    
    // 將新 lots 放入 ETF 物件
    const updatedEtf = { ...currentEtf, lots: updatedLots };
    
    // 呼叫自動重算函數 (包含融資總額、成本、股數)
    newEtfs[i] = recalculateEtfStats(updatedEtf);

    setEtfs(newEtfs); 
    setBuyForm({ ...buyForm, shares: '', price: '', margin: '' }); 
    setActiveBuyId(null);
  };

  const removeLot = (i: number, lid: string) => {
    const newEtfs = [...etfs];
    const currentEtf = newEtfs[i];
    if (!currentEtf.lots) return;

    // 移除指定 lot
    const updatedLots = currentEtf.lots.filter(x => x.id !== lid);
    
    // 將更新後的 lots 放入 ETF
    const updatedEtf = { ...currentEtf, lots: updatedLots };

    // 呼叫自動重算函數
    newEtfs[i] = recalculateEtfStats(updatedEtf);

    setEtfs(newEtfs);
  };
  
  const handleGacha = () => {
    if (tokens < 1) return;
    setTokens(t => t - 1);
    const item = GACHA_ITEMS[Math.floor(Math.random() * GACHA_ITEMS.length)];
    setGachaResult(item);
    setCollection(prev => { const ex = prev.find(p => p.id === item.id); return ex ? prev.map(p => p.id === item.id ? {...p, count: p.count + 1} : p) : [...prev, {id: item.id, count: 1}]; });
  };

  if (isInitializing) return <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /><p className="ml-4 text-slate-400">正在同步雲端資料...</p></div>;

  return (
    <div className={`min-h-screen p-4 md:p-8 font-sans bg-slate-900 text-white selection:bg-emerald-500/30`}>
      {/* Modals */}
      {gachaResult && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setGachaResult(null)}><div className="bg-slate-900 border border-yellow-500 p-8 rounded-2xl text-center animate-in zoom-in shadow-[0_0_50px_rgba(234,179,8,0.5)]"><div className="text-6xl mb-4 animate-bounce">{gachaResult.icon}</div><div className="text-2xl font-bold text-yellow-400 mb-2">{gachaResult.name}</div><div className="inline-block px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 border border-slate-700">{gachaResult.rarity}</div><p className="text-slate-500 mt-6 text-sm">(點擊任意處關閉)</p></div></div>)}
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5"/> 設定</h3>
                
                <div className="mb-4">
                    <label className="text-xs text-slate-400 block mb-1">Google Sheet CSV 連結 (用於更新行情)</label>
                    <input 
                        type="text" 
                        value={cloudConfig.priceSourceUrl || ''} 
                        onChange={(e) => setCloudConfig({...cloudConfig, priceSourceUrl: e.target.value})} 
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                        placeholder="https://docs.google.com/.../pub?output=csv"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">請確保試算表已發佈為 CSV 格式 (A欄:代號, B欄:現價)</p>
                </div>

                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-xs mb-4">
                    <p className="text-emerald-300 font-bold">雲端同步已開啟</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="w-full py-2 bg-slate-700 rounded hover:bg-slate-600 text-white">關閉</button>
            </div>
        </div>
      )}
      {showHelp && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-xl p-6"><h3 className="text-xl font-bold mb-4">功能說明</h3><ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm"><li><strong>資產雷達：</strong> 五維度分析您的投資組合健康度。</li><li><strong>滾雪球預測：</strong> 模擬未來 10 年資產與股息增長。</li></ul><button onClick={() => setShowHelp(false)} className="mt-4 w-full py-2 bg-slate-700 rounded hover:bg-slate-600">關閉</button></div></div>)}

      {/* Header */}
      <header className="mb-8 border-b border-slate-700 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2"><Calculator className="w-8 h-8" /> 包租唐戰情室 <span className="text-xs bg-emerald-900/50 text-emerald-200 px-2 py-0.5 rounded border border-emerald-500/30">V44 Final + Sort</span></h1>
           <div className="flex items-center gap-4 mt-2"><div className="flex gap-2"><div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs shadow-sm">{saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin text-amber-400" /><span className="text-amber-400">儲存中...</span></>}{saveStatus === 'saved' && <><Cloud className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">已同步</span></>}</div></div></div>
        </div>
        <div className="flex flex-wrap gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
            <button onClick={handleUpdatePrices} disabled={isUpdatingPrices} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-emerald-900/50 border border-emerald-500/50 rounded-lg text-sm text-emerald-400 transition-all group">
                {isUpdatingPrices ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />} 
                更新行情
            </button>
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all"><Settings className="w-4 h-4 text-blue-400" /> 設定</button>
            <button onClick={() => setShowHelp(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all"><HelpCircle className="w-4 h-4 text-amber-400" /> 說明</button>
            <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all"><Upload className="w-4 h-4 text-blue-400" /> 匯入</button>
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all"><Download className="w-4 h-4 text-emerald-400" /> 匯出</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-red-900/30 border border-slate-600 hover:border-red-500 rounded-lg text-sm transition-all group"><RotateCcw className="w-4 h-4 text-red-400 group-hover:rotate-180 transition-transform duration-500" /> 重置 (還原備份)</button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column */}
        <div className="xl:col-span-4 space-y-6">
            
            {/* Wealth Radar */}
            <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500"></div>
             <h2 className="text-xl font-semibold mb-2 text-cyan-300 flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> 資產體質雷達</h2>
             <div className="h-64 -ml-4">
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                   <PolarGrid stroke="#334155" />
                   <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                   <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                   <Radar name="Portfolio" dataKey="A" stroke="#06b6d4" strokeWidth={2} fill="#06b6d4" fillOpacity={0.4} />
                   <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                 </RadarChart>
               </ResponsiveContainer>
             </div>
            </section>

            {/* Allocation (Updated with Gap Info) */}
            <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-purple-500"></div>
                <h2 className="text-xl font-semibold mb-4 text-blue-300 flex items-center gap-2"><PieIcon className="w-5 h-5" /> 資金分配規劃</h2>
                <div className="mb-4"><label className="text-xs text-slate-400 block mb-1">總可用資金 (台幣)</label><div className="relative"><DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" /><input type="number" value={allocation.totalFunds} onChange={(e) => setAllocation({...allocation, totalFunds: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-9 pr-4 py-2 text-xl font-bold text-white focus:border-blue-500 outline-none" placeholder="0"/></div></div>
                <div className="h-40 flex justify-center items-center bg-slate-900/30 rounded-xl mb-4">
                     <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                         <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">
                           {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}
                         </Pie>
                         <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                       </PieChart>
                     </ResponsiveContainer>
                </div>
                <div className="space-y-3 bg-slate-900/50 rounded-xl p-3 border border-slate-700/50">
                    <div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-emerald-300 font-bold">配息型</span><input type="number" value={allocation.dividendRatio} onChange={e => setAllocation({...allocation, dividendRatio: Number(e.target.value)})} className="w-10 bg-transparent border-b border-slate-600 text-right focus:border-emerald-500 outline-none" /></div>
                        <div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-emerald-900/50" style={{width: `${allocation.dividendRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-emerald-500" style={{width: `${Math.min(100, (actualDividend / allocation.totalFunds) * 100)}%`}}></div></div>
                        <div className="flex justify-between text-[10px]"><span className="text-slate-400">實(淨): {formatMoney(actualDividend)}</span><span className={`font-mono ${actualDividend < targetDividend ? 'text-red-400' : 'text-emerald-400'}`}>{actualDividend < targetDividend ? `缺 ${formatMoney(targetDividend - actualDividend)}` : '已達標'}</span></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-amber-300 font-bold">避險型</span><input type="number" value={allocation.hedgingRatio} onChange={e => setAllocation({...allocation, hedgingRatio: Number(e.target.value)})} className="w-10 bg-transparent border-b border-slate-600 text-right focus:border-amber-500 outline-none" /></div>
                        <div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-amber-900/50" style={{width: `${allocation.hedgingRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-amber-500" style={{width: `${Math.min(100, (actualHedging / allocation.totalFunds) * 100)}%`}}></div></div>
                        <div className="flex justify-between text-[10px]"><span className="text-slate-400">實(淨): {formatMoney(actualHedging)}</span><span className={`font-mono ${actualHedging < targetHedging ? 'text-red-400' : 'text-emerald-400'}`}>{actualHedging < targetHedging ? `缺 ${formatMoney(targetHedging - actualHedging)}` : '已達標'}</span></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-purple-300 font-bold">主動型</span><input type="number" value={allocation.activeRatio} onChange={e => setAllocation({...allocation, activeRatio: Number(e.target.value)})} className="w-10 bg-transparent border-b border-slate-600 text-right focus:border-purple-500 outline-none" /></div>
                        <div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-purple-900/50" style={{width: `${allocation.activeRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-purple-500" style={{width: `${Math.min(100, (actualActive / allocation.totalFunds) * 100)}%`}}></div></div>
                        <div className="flex justify-between text-[10px]"><span className="text-slate-400">實(淨): {formatMoney(actualActive)}</span><span className={`font-mono ${actualActive < targetActive ? 'text-red-400' : 'text-emerald-400'}`}>{actualActive < targetActive ? `缺 ${formatMoney(targetActive - actualActive)}` : '已達標'}</span></div>
                    </div>
                    {!isAllocationValid && <div className="text-center text-xs text-red-400 mt-2">⚠️ 比例總和非 100%</div>}
                </div>
            </section>

            {/* Asset List (INLINE) */}
            <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
                <h2 className="text-xl font-semibold mb-4 text-emerald-300 flex items-center gap-2"><Activity className="w-5 h-5" /> 資產配置 (ETF)</h2>
                <div className="space-y-4">
                    {etfs.map((etf, idx) => {
                        const hasLots = etf.lots && etf.lots.length > 0;
                        const isExpanded = expandedEtfId === etf.id;
                        const isBuying = activeBuyId === etf.id;
                        const isPerPeriod = etf.dividendType === 'per_period';
                        const yoc = etf.costPrice > 0 ? (etf.dividendPerShare * (isPerPeriod && etf.payMonths?.length ? etf.payMonths.length : 1)) / etf.costPrice * 100 : 0;
                        
                        // 計算個股財務數據
                        const marketValue = etf.shares * etf.currentPrice;
                        const totalCost = etf.shares * etf.costPrice;
                        const profit = marketValue - totalCost;
                        const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

                        return (
                            <div key={etf.id} className="p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-all">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className="relative group/edit">
                                            {/* Code Input */}
                                            <input 
                                                type="text" 
                                                value={etf.code || ''} 
                                                onChange={(e) => updateEtf(idx, 'code', e.target.value)} 
                                                className="absolute -top-5 left-0 text-[10px] bg-slate-800 text-slate-400 border border-slate-600 rounded px-1 w-16 focus:w-24 transition-all outline-none" 
                                                placeholder="代號"
                                            />
                                            <input type="text" value={etf.name} onChange={(e) => updateEtf(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-500 focus:border-emerald-500 outline-none w-28 transition-all" />
                                            <Edit3 className="w-3 h-3 text-slate-600 absolute -right-4 top-1.5 opacity-0 group-hover/edit:opacity-100" />
                                        </div>
                                        <select value={etf.category || 'dividend'} onChange={(e) => updateEtf(idx, 'category', e.target.value)} className="text-[10px] bg-slate-800 border border-slate-600 rounded px-1 text-slate-300"><option value="dividend">配息型</option><option value="hedging">避險型</option><option value="active">主動型</option></select>
                                    </div>
                                    <div className="flex gap-1">
                                        {/* ★★★ V44 功能：移動順序按鈕 ★★★ */}
                                        <div className="flex flex-col gap-0.5 mr-1">
                                            <button onClick={() => moveEtf(idx, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-slate-700 text-slate-400 disabled:opacity-30"><ArrowUp className="w-3 h-3"/></button>
                                            <button onClick={() => moveEtf(idx, 1)} disabled={idx === etfs.length - 1} className="p-0.5 rounded hover:bg-slate-700 text-slate-400 disabled:opacity-30"><ArrowDown className="w-3 h-3"/></button>
                                        </div>
                                        
                                        <button onClick={() => toggleBuy(etf.id)} className={`text-xs px-2 py-1 rounded-lg border ${isBuying ? 'bg-emerald-600 text-white' : 'text-slate-400 border-slate-600'}`}><ShoppingCart className="w-3 h-3" /></button>
                                        <button onClick={() => toggleLots(etf.id)} className={`text-xs px-2 py-1 rounded-lg border ${hasLots ? 'bg-slate-700 text-slate-300' : 'text-slate-500 border-slate-700'}`}><List className="w-3 h-3" /></button>
                                        <button onClick={() => removeEtf(etf.id)} className="text-xs px-2 py-1 rounded-lg text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                </div>
                                {isBuying && (<div className="mb-3 p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg animate-in slide-in-from-top-2"><div className="grid grid-cols-4 gap-1 mb-2"><div className="col-span-1"><input type="date" value={buyForm.date} onChange={e => setBuyForm({...buyForm, date: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div><div><input type="number" placeholder="股" value={buyForm.shares} onChange={e => setBuyForm({...buyForm, shares: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div><div><input type="number" placeholder="$" value={buyForm.price} onChange={e => setBuyForm({...buyForm, price: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div><div><input type="number" placeholder="融資金額" value={buyForm.margin} onChange={e => setBuyForm({...buyForm, margin: e.target.value})} className="w-full bg-slate-900 border border-blue-900 rounded-lg px-2 py-1 text-xs text-blue-300" /></div></div><button onClick={() => submitBuy(idx)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg text-xs font-bold">確認買入</button></div>)}
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                    <div><label className="text-xs text-slate-500 block">股數</label><input type="number" value={etf.shares} onChange={(e) => updateEtf(idx, 'shares', Number(e.target.value))} disabled={hasLots} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block">成本</label><input type="number" value={etf.costPrice} onChange={(e) => updateEtf(idx, 'costPrice', Number(e.target.value))} disabled={hasLots} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" />{etf.costPrice > 0 && <div className="text-[9px] text-amber-400 mt-0.5">YoC: {yoc.toFixed(1)}%</div>}</div>
                                    
                                    {/* 配息單位選擇 */}
                                    <div>
                                        <label className="text-xs text-slate-500 block">配息金額</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={etf.dividendPerShare} onChange={(e) => updateEtf(idx, 'dividendPerShare', Number(e.target.value))} className="w-2/3 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white" />
                                            <select value={etf.dividendType || 'per_period'} onChange={(e) => updateEtf(idx, 'dividendType', e.target.value)} className="w-1/3 bg-slate-800 border border-slate-600 rounded-lg px-1 py-1 text-[10px] text-blue-300 outline-none">
                                                <option value="per_period">次</option>
                                                <option value="annual">年</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div><label className="text-xs text-slate-500 block">現價</label><input type="number" value={etf.currentPrice} onChange={(e) => updateEtf(idx, 'currentPrice', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                                </div>
                                
                                {/* 財務資訊第二排 (融資 / 市值 / 損益) */}
                                <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-800/50">
                                    <div>
                                        <label className="text-[10px] text-blue-300 block">融資總額</label>
                                        {/* V44: 這裡改成唯讀，因為已經自動化了 (但保留 onChange 以備不時之需，還是建議不要手動改) */}
                                        <input type="number" value={etf.marginLoanAmount || 0} onChange={(e) => updateEtf(idx, 'marginLoanAmount', Number(e.target.value))} className="w-full bg-slate-900 border border-blue-900/50 rounded px-2 py-1 text-xs text-blue-200" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-blue-300 block">利率%</label>
                                        <input type="number" value={etf.marginInterestRate || 0} onChange={(e) => updateEtf(idx, 'marginInterestRate', Number(e.target.value))} className="w-full bg-slate-900 border border-blue-900/50 rounded px-2 py-1 text-xs text-blue-200" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block">總市值</label>
                                        <div className="text-sm font-mono text-slate-300 pt-1">{formatMoney(marketValue)}</div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block">損益 (P/L)</label>
                                        <div className={`text-sm font-mono pt-1 ${profit >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                           {formatMoney(profit)} <span className="text-[10px] opacity-70">({roi.toFixed(1)}%)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-2 flex gap-1 flex-wrap">{Array.from({length: 12}, (_, i) => i + 1).map(m => (<button key={m} onClick={() => toggleEtfPayMonth(idx, m)} className={`w-5 h-5 rounded text-[9px] flex items-center justify-center transition-all ${etf.payMonths?.includes(m) ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>{m}</button>))}</div>
                                {isExpanded && etf.lots && (<div className="mt-3 pt-3 border-t border-slate-700 bg-slate-800/50 rounded-xl p-2"><div className="space-y-1">{etf.lots.map(lot => (<div key={lot.id} className="grid grid-cols-4 items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs"><span className="text-slate-300">{lot.date}</span><span className="text-right text-emerald-300">{lot.shares}</span><div className="text-right"><span className="text-amber-300">{lot.price}</span><span className="text-[9px] text-slate-500 block">+{lot.fee} / 融:{formatMoney(lot.margin || 0)}</span></div><div className="text-center"><button onClick={() => removeLot(idx, lot.id)} className="text-red-400"><Trash2 className="w-3 h-3" /></button></div></div>))}</div></div>)}
                            </div>
                        );
                    })}
                    <button onClick={addEtf} className="w-full py-2 bg-slate-800 border border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-white transition-colors">+ 新增標的</button>
                </div>
            </section>
        
            {/* Finance Control (UPDATED: V38 Loan Details) */}
            <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg space-y-4">
                <div>
                    <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><DollarSign className="w-4 h-4" /> 房貸與信貸</h2>
                    {(loans || []).map((loan: any, idx: number) => (
                    <div key={loan.id || idx} className="mb-4 p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-emerald-500/30 transition-all">
                        <div className="flex justify-between items-center mb-3">
                            <input type="text" value={loan.name} onChange={(e) => updateLoan(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-600 w-1/2 text-sm" />
                            <select value={loan.type} onChange={(e) => updateLoan(idx, 'type', e.target.value)} className="bg-slate-800 text-[10px] border border-slate-600 rounded px-2 py-1 text-slate-300 outline-none"><option value="PrincipalAndInterest">本息攤還</option><option value="Principal">本金攤還</option></select>
                        </div>
                        <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-1"><label className="text-[10px] text-slate-500 block">貸款總額</label><input type="number" value={loan.principal} onChange={(e) => updateLoan(idx, 'principal', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div>
                                <div className="col-span-2"><label className="text-[10px] text-emerald-500 block flex items-center gap-1"><Calendar className="w-3 h-3"/> 核貸日期 (自動推算已繳期數)</label><input type="date" value={loan.startDate || ''} onChange={(e) => updateLoan(idx, 'startDate', e.target.value)} className="w-full bg-slate-800 border border-emerald-600/50 rounded-lg px-2 py-1 text-xs text-white" /></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div><label className="text-[10px] text-slate-500 block">總期數</label><input type="number" value={loan.totalMonths} onChange={(e) => updateLoan(idx, 'totalMonths', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div>
                                <div><label className="text-[10px] text-slate-500 block">已繳期數</label><input type="number" value={loan.paidMonths} onChange={(e) => updateLoan(idx, 'paidMonths', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div>
                                <div><label className="text-[10px] text-slate-500 block">寬限期(月)</label><input type="number" value={loan.gracePeriod} onChange={(e) => updateLoan(idx, 'gracePeriod', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 grid grid-cols-3 gap-2">
                                <div><label className="text-[10px] text-slate-400 block">一段利率 (%)</label><input type="number" value={loan.rate1} onChange={(e) => updateLoan(idx, 'rate1', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-blue-300" /></div>
                                <div><label className="text-[10px] text-slate-400 block">期間 (月)</label><input type="number" value={loan.rate1Months} onChange={(e) => updateLoan(idx, 'rate1Months', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div>
                                <div><label className="text-[10px] text-slate-400 block">二段利率 (%)</label><input type="number" value={loan.rate2} onChange={(e) => updateLoan(idx, 'rate2', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-purple-300" /></div>
                            </div>
                        </div>
                    </div>
                    ))}
                    <div className="p-2 bg-slate-900 rounded border border-slate-700 border-l-2 border-l-orange-500">
                    <div className="flex justify-between mb-1"><span className="text-xs font-bold text-orange-300">信用貸款</span><input type="number" value={creditLoan.rate} onChange={(e) => setCreditLoan({ ...creditLoan, rate: Number(e.target.value) })} className="bg-slate-800 border border-slate-600 rounded px-1 text-xs text-right w-16 text-orange-300" placeholder="利率%" /></div>
                    <div className="grid grid-cols-2 gap-2"><div><label className="text-[9px] text-slate-500">本金</label><input type="number" value={creditLoan.principal} onChange={(e) => setCreditLoan({ ...creditLoan, principal: Number(e.target.value) })} className="bg-slate-800 border border-slate-600 rounded px-1 text-xs w-full" /></div><div><label className="text-[9px] text-slate-500">總期數</label><input type="number" value={creditLoan.totalMonths} onChange={(e) => setCreditLoan({ ...creditLoan, totalMonths: Number(e.target.value) })} className="bg-slate-800 border border-slate-600 rounded px-1 text-xs w-full" /></div></div>
                    </div>
                </div>
                <div className="pt-2 border-t border-slate-700">
                    <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Layers className="w-4 h-4" /> 質押與融資</h2>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="p-2 bg-slate-900 rounded border border-slate-700"><label className="text-slate-500 block mb-1">質押 (本金 / 利率%)</label><div className="flex gap-1"><input type="number" value={stockLoan.principal} onChange={(e) => setStockLoan({ ...stockLoan, principal: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 rounded px-1" /><input type="number" value={stockLoan.rate} onChange={(e) => setStockLoan({ ...stockLoan, rate: Number(e.target.value) })} className="w-12 bg-slate-800 border border-slate-600 rounded px-1 text-blue-300" /></div></div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-700"><label className="text-slate-500 block mb-1">融資 (本金 / 利率%)</label><div className="flex gap-1"><input type="number" value={globalMarginLoan.principal} onChange={(e) => setGlobalMarginLoan({ ...globalMarginLoan, principal: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 rounded px-1" /><input type="number" value={globalMarginLoan.rate} onChange={(e) => setGlobalMarginLoan({ ...globalMarginLoan, rate: Number(e.target.value) })} className="w-12 bg-slate-800 border border-slate-600 rounded px-1 text-cyan-300" /></div></div>
                    </div>
                    <div className="flex items-center gap-2"><label className="text-xs text-red-400">⚠️ 維持率斷頭線 (%):</label><input type="number" value={stockLoan.maintenanceLimit || 130} onChange={(e) => setStockLoan({ ...stockLoan, maintenanceLimit: Number(e.target.value) })} className="w-16 bg-slate-900 border border-red-900/50 rounded px-1 text-xs text-red-300" /></div>
                </div>
                <div className="pt-2 border-t border-slate-700">
                    <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Coffee className="w-4 h-4" /> 生活與稅務</h2>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2"><div><label className="text-slate-500">薪資所得</label><input type="number" value={taxStatus.salaryIncome} onChange={(e) => setTaxStatus({ ...taxStatus, salaryIncome: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div><div><label className="text-slate-500">月生活費</label><input type="number" value={taxStatus.livingExpenses} onChange={(e) => setTaxStatus({ ...taxStatus, livingExpenses: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div></div>
                </div>
            </section>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-8 space-y-6">
             {/* HUD (Inline) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className={`md:col-span-8 bg-slate-800 p-6 rounded-2xl border ${currentClass.border} relative overflow-hidden shadow-lg`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Crown className="w-24 h-24 text-white" /></div>
                    <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><Crown className="w-3 h-3 text-yellow-500" /> 玩家等級</div>
                    <div className="text-3xl font-black text-white mb-2">{levelInfo.title}</div>
                    <div className="w-full bg-slate-900 rounded-full h-2 mb-4 border border-slate-700 overflow-hidden"><div className={`h-full bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full`} style={{width: `${Math.min(100, fireMetrics.ratio)}%`}}></div></div>
                    <div className="grid grid-cols-3 gap-4 mt-4 relative z-10">
                        <div><div className="text-slate-500 text-[10px] uppercase">戰鬥力 (CP)</div><div className="text-2xl font-mono text-white font-bold">{formatMoney(combatPower)}</div></div>
                        <div><div className="text-slate-500 text-[10px] uppercase">HP (維持率)</div><div className={`text-2xl font-mono font-bold ${currentMaintenance < 130 ? 'text-red-500' : 'text-emerald-400'}`}>{currentMaintenance === 999 ? 'MAX' : currentMaintenance.toFixed(0) + '%'}</div></div>
                        <div><div className="text-slate-500 text-[10px] uppercase">FIRE 進度</div><div className="text-2xl font-mono text-orange-400 font-bold">{fireMetrics.ratio.toFixed(1)}%</div></div>
                    </div>
                </div>
                <div className="md:col-span-4 bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-xl flex flex-col justify-between">
                    <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Gift className="w-3 h-3 text-yellow-400" /> 轉蛋機 (代幣: {tokens})</div>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        {collection.slice(0, 8).map((item: any, i: number) => (
                            <div key={i} className="aspect-square bg-slate-900 rounded border border-slate-600 flex items-center justify-center text-xl cursor-help hover:border-yellow-500 transition-colors" title={`x${item.count}`}>{GACHA_ITEMS.find(g => g.id === item.id)?.icon}</div>
                        ))}
                    </div>
                    <button onClick={handleGacha} disabled={tokens < 1} className={`w-full py-2 rounded text-xs font-bold transition-all ${tokens > 0 ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>{tokens > 0 ? '立即召喚' : '代幣不足'}</button>
                </div>
            </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-lg"><div className="text-slate-400 text-xs uppercase tracking-wider">年度淨現金流</div><div className={`text-2xl font-bold ${yearlyNetPosition < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatMoney(yearlyNetPosition)}</div></div>
                 <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-blue-500 shadow-lg"><div className="text-slate-400 text-xs uppercase tracking-wider">總資產市值</div><div className="text-2xl font-bold text-white">{formatMoney(totalMarketValue)}</div></div>
                 <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-orange-500 shadow-lg"><div className="text-slate-400 text-xs uppercase tracking-wider">未實現損益</div><div className={`text-2xl font-bold ${unrealizedPL >= 0 ? 'text-orange-400' : 'text-green-400'}`}>{formatMoney(unrealizedPL)}</div></div>
                 <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-purple-500 shadow-lg"><div className="text-slate-400 text-xs uppercase tracking-wider">預估稅負</div><div className="text-2xl font-bold text-white">{formatMoney(healthInsuranceTotal+incomeTaxTotal)}</div></div>
             </div>

             <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-lg font-bold flex items-center gap-2 text-white"><TrendingUp className="w-5 h-5 text-indigo-400"/> 十年財富滾雪球</h3>
                   <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-600">
                       <button onClick={()=>setReinvest(false)} className={`px-3 py-1 text-xs rounded transition-colors ${!reinvest ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>花掉股息</button>
                       <button onClick={()=>setReinvest(true)} className={`px-3 py-1 text-xs rounded transition-colors ${reinvest ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>複利投入</button>
                   </div>
                </div>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={snowballData}>
                           <defs><linearGradient id="cw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/><stop offset="95%" stopColor="#818cf8" stopOpacity={0}/></linearGradient></defs>
                           <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                           <XAxis dataKey="year" stroke="#94a3b8" tick={{fontSize:12}} />
                           <YAxis stroke="#94a3b8" tick={{fontSize:12}} />
                           <Tooltip formatter={(v:number)=>formatMoney(v)} contentStyle={{backgroundColor:'#1e293b', border:'none', borderRadius:'8px'}} />
                           <Area type="monotone" dataKey="wealth" stroke="#818cf8" fill="url(#cw)" />
                       </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>

             {breakevenTip && (
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-start gap-4 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-yellow-500/20 p-2 rounded-full"><Lightbulb className="w-6 h-6 text-yellow-400" /></div>
                    <div>
                        <h4 className="font-bold text-white mb-1">現金流優化建議</h4>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            目前年度現金流短缺 <span className="text-red-400 font-bold">{formatMoney(breakevenTip.deficit)}</span>。
                            建議再投入本金約 <span className="text-blue-400 font-bold">{formatMoney(breakevenTip.neededCapital)}</span> (以 {breakevenTip.avgYield.toFixed(1)}% 殖利率計算) 即可達成平衡。
                        </p>
                    </div>
                </div>
             )}

             {/* Monthly Cash Flow Table (Added Total Row) */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg overflow-x-auto">
              <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-400"/> 每月現金流明細</h3>
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">月份</th>
                    <th className="px-4 py-3 text-emerald-400">股息收入</th>
                    <th className="px-4 py-3 text-red-400">房貸支出</th>
                    <th className="px-4 py-3 text-orange-400">信貸支出</th>
                    <th className="px-4 py-3 text-blue-400">質押利息</th>
                    <th className="px-4 py-3 text-slate-400">生活費</th>
                    <th className="px-4 py-3 text-purple-400">稅金</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">淨現金流</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyFlows.map((row) => (
                    <tr key={row.month} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{row.month}月</td>
                      <td className="px-4 py-3 text-emerald-400">{formatMoney(row.dividendInflow)}</td>
                      <td className="px-4 py-3 text-red-400">{formatMoney(row.loanOutflow)}</td>
                      <td className="px-4 py-3 text-orange-400">{formatMoney(row.creditLoanOutflow)}</td>
                      <td className="px-4 py-3 text-blue-400">{formatMoney(row.stockLoanInterest)}</td>
                      <td className="px-4 py-3 text-slate-400">{formatMoney(row.livingExpenses)}</td>
                      <td className="px-4 py-3 text-purple-400">{formatMoney(row.taxWithheld)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${row.netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatMoney(row.netFlow)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* ★★★ 新增：年度總計列 ★★★ */}
                <tfoot>
                  <tr className="font-bold bg-slate-900 border-t-2 border-slate-600">
                      <td className="px-4 py-3 text-white">年度總計</td>
                      <td className="px-4 py-3 text-emerald-400">{formatMoney(totalDividend)}</td>
                      <td className="px-4 py-3 text-red-400">{formatMoney(totalMortgage)}</td>
                      <td className="px-4 py-3 text-orange-400">{formatMoney(totalCredit)}</td>
                      <td className="px-4 py-3 text-blue-400">{formatMoney(totalStockInterest)}</td>
                      <td className="px-4 py-3 text-slate-400">{formatMoney(totalLiving)}</td>
                      <td className="px-4 py-3 text-purple-400">{formatMoney(totalTax)}</td>
                      <td className={`px-4 py-3 text-right ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

        </div>
      </div>
    </div>
  );
};

export default App;
