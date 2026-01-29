import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine, PieChart, Pie, Cell, ComposedChart, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area } from 'recharts';
import { INITIAL_ETFS, INITIAL_LOANS, INITIAL_STOCK_LOAN, INITIAL_CREDIT_LOAN, INITIAL_TAX_STATUS, INITIAL_GLOBAL_MARGIN_LOAN, INITIAL_ALLOCATION } from './constants';
import { ETF, Loan, StockLoan, CreditLoan, TaxStatus, MortgageType, AppState, Lot, CloudConfig, AllocationConfig, EtfCategory } from './types';

import { PortfolioCalculator } from './PortfolioCalculator';
import { StorageService } from './storage';
import { formatMoney } from './decimal';

// Import Icons
import { 
  Calculator, AlertTriangle, TrendingDown, DollarSign, Wallet, Activity, Save, Upload, Download, 
  RotateCcw, List, Plus, Trash2, X, ChevronDown, ChevronUp, Clock, Calendar, Repeat, ArrowRightLeft, 
  Info, Banknote, Coins, ShoppingCart, CheckCircle2, Cloud, Loader2, Layers, HelpCircle, Smartphone, 
  Monitor, HardDrive, Database, Link as LinkIcon, Settings, Globe, Code, ExternalLink, CheckSquare, 
  Edit3, PieChart as PieIcon, Target, Lightbulb, Zap, Coffee, TrendingUp, ShieldCheck, Flame, 
  RefreshCw, Trophy, Crown, Swords, Skull, Gem, Scroll, Medal, Sparkles, Heart, Crosshair, Gift, Lock
} from 'lucide-react';
import Decimal from 'decimal.js';

const BROKERAGE_RATE = 0.001425; 

// Colors
const COLORS = {
  dividend: '#10b981', // Emerald
  hedging: '#f59e0b',  // Amber
  active: '#8b5cf6',   // Purple
  cash: '#334155'      // Slate
};

interface ExtendedCloudConfig extends CloudConfig {
    priceSourceUrl?: string;
}

// Loot Box Quotes
const QUOTES = [
    "「別人恐懼我貪婪。」— 巴菲特",
    "「長期而言，股市是稱重機。」— 葛拉漢",
    "「不要虧損。規則二：別忘了規則一。」",
    "「複利是世界第八大奇蹟。」",
    "「風險來自於你不知道自己在做什麼。」",
    "「耐心是投資人最好的朋友。」",
    "「最好的持有期限是永遠。」"
];

// Animation Hook
const useCountUp = (end: number, duration = 2000) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16); 
    let timer: NodeJS.Timeout;
    const animate = () => {
      start += increment;
      if ((increment > 0 && start >= end) || (increment < 0 && start <= end)) {
        setCount(end);
      } else {
        setCount(start);
        timer = setTimeout(animate, 16);
      }
    };
    animate();
    return () => clearTimeout(timer);
  }, [end, duration]);
  return count;
};

const AnimatedNumber: React.FC<{ value: number, prefix?: string, className?: string }> = ({ value, prefix = '', className = '' }) => {
    const animatedValue = useCountUp(value);
    return <span className={className}>{prefix}{formatMoney(animatedValue)}</span>;
};

const App: React.FC = () => {
  // --- 1. State Definitions ---
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLoot, setShowLoot] = useState(false);
  const [lootQuote, setLootQuote] = useState('');
  const [storageStats, setStorageStats] = useState({ used: 0, total: 5242880 });
  const [dataSource, setDataSource] = useState<'local' | 'cloud' | 'gas'>('local');
  const [reinvest, setReinvest] = useState(true);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  const [cloudConfig, setCloudConfig] = useState<ExtendedCloudConfig>({ apiKey: 'AIzaSyCM42AelwEWTC4R_V0sgF0FbomkoXdE4T0', projectId: 'baozutang-finance', syncId: 'tony1006', enabled: true, priceSourceUrl: '' });
  const [etfs, setEtfs] = useState<ETF[]>(INITIAL_ETFS);
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [stockLoan, setStockLoan] = useState<StockLoan>(INITIAL_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(INITIAL_GLOBAL_MARGIN_LOAN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(INITIAL_CREDIT_LOAN);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(INITIAL_TAX_STATUS);
  const [allocation, setAllocation] = useState<AllocationConfig>(INITIAL_ALLOCATION);
  
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [newLot, setNewLot] = useState<{shares: string, price: string, date: string}>({ shares: '', price: '', date: '' });
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState<{shares: string, price: string, date: string}>({ shares: '', price: '', date: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 2. Effects (Load & Save) ---
  useEffect(() => {
    const initData = async () => {
      try {
        const savedConfig = StorageService.loadCloudConfig();
        if (savedConfig) setCloudConfig(prev => ({ ...prev, ...savedConfig }));
        else StorageService.saveCloudConfig(cloudConfig);

        const result = await StorageService.loadData();
        if (result.data) {
          const { etfs, loans, stockLoan, globalMarginLoan, creditLoan, taxStatus, allocation } = result.data;
          setEtfs((etfs || INITIAL_ETFS).map(e => ({ ...e, category: e.category || 'dividend' })));
          let mergedLoans = loans || INITIAL_LOANS; if (mergedLoans.length < INITIAL_LOANS.length) mergedLoans = [...mergedLoans, INITIAL_LOANS[1]]; setLoans(mergedLoans);
          setStockLoan(stockLoan || INITIAL_STOCK_LOAN); setGlobalMarginLoan(globalMarginLoan || INITIAL_GLOBAL_MARGIN_LOAN);
          setCreditLoan(creditLoan || INITIAL_CREDIT_LOAN); setTaxStatus({ ...INITIAL_TAX_STATUS, ...taxStatus });
          setAllocation(allocation || INITIAL_ALLOCATION);
        }
        setDataSource(result.source);
        setStorageStats(StorageService.getStorageUsage());
      } catch (error) { console.error("Init failed", error); } finally { setIsInitializing(false); }
    };
    initData();
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try { 
          await StorageService.saveData({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation }); 
          StorageService.saveCloudConfig(cloudConfig);
          setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); 
      } catch { setSaveStatus('error'); }
    }, 1000); return () => clearTimeout(timer);
  }, [etfs, loans, stockLoan, creditLoan, taxStatus, globalMarginLoan, allocation, isInitializing, cloudConfig]);

  // --- 3. Handlers ---
  const handleUpdatePrices = async () => {
      if (!cloudConfig.priceSourceUrl) { alert('請先設定 Google Sheet 連結！'); setShowSettings(true); return; }
      setIsUpdatingPrices(true);
      try {
          const res = await fetch(cloudConfig.priceSourceUrl);
          const text = await res.text();
          const rows = text.split('\n').map(r => r.split(','));
          const map = new Map<string, number>();
          rows.forEach(r => { if(r.length>=2) { const id=r[0].replace(/['"\r]/g,'').trim(); const p=parseFloat(r[1].replace(/['"\r]/g,'').trim()); if(id&&!isNaN(p)) map.set(id, p); }});
          let count = 0;
          setEtfs(etfs.map(e => { const p = map.get(e.id); if(p!==undefined) { count++; return {...e, currentPrice: p}; } return e; }));
          alert(`戰鬥數據更新！同步了 ${count} 個標的。`);
      } catch { alert('更新失敗，請檢查連結。'); } finally { setIsUpdatingPrices(false); }
  };

  const openLootBox = () => {
      const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      setLootQuote(randomQuote);
      setShowLoot(true);
  };

  const updateEtf = (i: number, f: keyof ETF, v: any) => { const n = [...etfs]; n[i] = { ...n[i], [f]: v }; setEtfs(n); };
  const addEtf = () => setEtfs([...etfs, { id: Date.now().toString(), name: '自選標的', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'annual', payMonths: [], marginLoanAmount: 0, marginInterestRate: 0, lots: [], category: 'dividend' }]);
  const removeEtf = (id: string) => { if (window.confirm('確定刪除？')) setEtfs(etfs.filter(e => e.id !== id)); };
  const toggleEtfPayMonth = (i: number, m: number) => { const e = etfs[i]; const ms = e.payMonths.includes(m) ? e.payMonths.filter(x => x !== m) : [...e.payMonths, m].sort((a, b) => a - b); updateEtf(i, 'payMonths', ms); };
  const toggleEtfDividendType = (i: number) => { const n = [...etfs]; n[i].dividendType = n[i].dividendType === 'annual' ? 'per_period' : 'annual'; setEtfs(n); };
  const toggleLots = (id: string) => { setExpandedEtfId(expandedEtfId === id ? null : id); setActiveBuyId(null); };
  const toggleBuy = (id: string) => { setActiveBuyId(activeBuyId === id ? null : id); setExpandedEtfId(null); };
  const handleSmartMerge = () => { const items = INITIAL_ETFS.filter(e => !new Set(etfs.map(e => e.id)).has(e.id)); if (items.length && confirm(`補入 ${items.length} 個預設項目？`)) setEtfs([...etfs, ...items]); else alert('無需補全'); };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=(ev)=>{ try{ const s=JSON.parse(ev.target?.result as string) as AppState; if(s.etfs){ setEtfs(s.etfs); setLoans(s.loans||[]); setStockLoan(s.stockLoan||INITIAL_STOCK_LOAN); setGlobalMarginLoan(s.globalMarginLoan||INITIAL_GLOBAL_MARGIN_LOAN); setCreditLoan(s.creditLoan||INITIAL_CREDIT_LOAN); setTaxStatus(s.taxStatus||INITIAL_TAX_STATUS); setAllocation(s.allocation||INITIAL_ALLOCATION); alert('讀取成功'); } }catch{alert('格式錯誤');}}; r.readAsText(f); e.target.value=''; };
  const handleExport = () => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation });
  const handleReset = () => { if(confirm('重置？')) { setEtfs(INITIAL_ETFS); setLoans(INITIAL_LOANS); window.location.reload(); }};
  
  const submitBuy = (i: number) => {
    const s = Number(buyForm.shares), p = Number(buyForm.price); if (!s || !p) return;
    const targetEtf = etfs[i]; 
    const fee = targetEtf.category === 'hedging' ? 0 : Math.floor(s * p * BROKERAGE_RATE);
    const n = [...etfs]; const l = n[i].lots ? [...n[i].lots!] : []; l.push({ id: Date.now().toString(), date: buyForm.date, shares: s, price: p, fee }); 
    const ts = l.reduce((a, b) => a + b.shares, 0); const tc = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0); 
    n[i] = { ...n[i], lots: l, shares: ts, costPrice: Number((ts ? tc / ts : 0).toFixed(2)) }; setEtfs(n); setBuyForm({ ...buyForm, shares: '', price: '' }); setActiveBuyId(null); 
  };
  const addLot = (i: number) => { 
    const s = Number(newLot.shares), p = Number(newLot.price); if (!s || !p) return; 
    const targetEtf = etfs[i]; 
    const fee = targetEtf.category === 'hedging' ? 0 : Math.floor(s * p * BROKERAGE_RATE);
    const n = [...etfs]; const l = n[i].lots ? [...n[i].lots!] : []; l.push({ id: Date.now().toString(), date: newLot.date, shares: s, price: p, fee }); 
    const ts = l.reduce((a, b) => a + b.shares, 0); const tc = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0); 
    n[i] = { ...n[i], lots: l, shares: ts, costPrice: Number((ts ? tc / ts : 0).toFixed(2)) }; setEtfs(n); setNewLot({ ...newLot, shares: '', price: '' }); 
  };
  const removeLot = (i: number, lid: string) => { const n = [...etfs]; const l = n[i].lots!.filter(x => x.id !== lid); const ts = l.reduce((a, b) => a + b.shares, 0); const tc = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0); n[i] = { ...n[i], lots: l, shares: ts, costPrice: Number((ts ? tc / ts : 0).toFixed(2)) }; setEtfs(n); };
  const updateLoan = (i: number, f: keyof Loan, v: any) => { const n = [...loans]; if (f === 'startDate' && v) { const s = new Date(v), now = new Date(); let m = (now.getFullYear() - s.getFullYear()) * 12 - s.getMonth() + now.getMonth(); n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, m) }; } else { n[i] = { ...n[i], [f]: v }; } setLoans(n); };

  // --- 4. Core Calculations ---
  // A. Basic Totals
  const totalMarketValue = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * etf.currentPrice), 0), [etfs]);
  const totalCost = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * (etf.costPrice || 0)), 0), [etfs]);
  const unrealizedPL = totalMarketValue - totalCost;
  const totalStockDebt = stockLoan.principal + globalMarginLoan.principal + etfs.reduce((acc, e) => acc + (e.marginLoanAmount || 0), 0);
  const totalRealDebt = loans.reduce((acc, l) => acc + l.principal, 0) + creditLoan.principal;
  const currentMaintenance = useMemo(() => totalStockDebt === 0 ? 999 : (totalMarketValue / totalStockDebt) * 100, [totalMarketValue, totalStockDebt]);

  // B. Allocation Calculations
  const targetDividend = Math.floor(allocation.totalFunds * (allocation.dividendRatio / 100));
  const targetHedging = Math.floor(allocation.totalFunds * (allocation.hedgingRatio / 100));
  const targetActive = Math.floor(allocation.totalFunds * (allocation.activeRatio / 100));

  const actualDividend = useMemo(() => etfs.filter(e => e.category === 'dividend').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualHedging = useMemo(() => etfs.filter(e => e.category === 'hedging').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualActive = useMemo(() => etfs.filter(e => e.category === 'active').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const pieData = [{ name: '配息型', value: actualDividend, color: COLORS.dividend }, { name: '避險型', value: actualHedging, color: COLORS.hedging }, { name: '主動型', value: actualActive, color: COLORS.active }].filter(d => d.value > 0);
  
  const totalInvested = actualDividend + actualHedging + actualActive;
  const remainingFunds = allocation.totalFunds - totalInvested;

  // C. Flow Calculations
  const { monthlyFlows, yearlyNetPosition, healthInsuranceTotal, incomeTaxTotal } = useMemo(() => PortfolioCalculator.generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);
  const stressTestResults = useMemo(() => PortfolioCalculator.runStressTest(etfs, stockLoan, globalMarginLoan), [etfs, stockLoan, globalMarginLoan]);

  // D. Derived Metrics
  const fireMetrics = useMemo(() => {
      const annualExpenses = monthlyFlows.reduce((acc, cur) => acc + cur.loanOutflow + cur.creditLoanOutflow + cur.livingExpenses, 0);
      const annualPassive = monthlyFlows.reduce((acc, cur) => acc + cur.dividendInflow, 0);
      const ratio = annualExpenses > 0 ? (annualPassive / annualExpenses) * 100 : 0;
      return { ratio, annualExpenses, annualPassive };
  }, [monthlyFlows]);

  const combatPower = useMemo(() => Math.floor((totalMarketValue / 10000) + (fireMetrics.annualPassive/12/100)), [totalMarketValue, fireMetrics]);
  
  const levelInfo = useMemo(() => {
      const r = fireMetrics.ratio;
      if (r >= 100) return { title: '財富國王 👑', color: 'text-yellow-400', bar: 'bg-gradient-to-r from-yellow-400 to-orange-500', next: null };
      if (r >= 50) return { title: '資產領主 ⚔️', color: 'text-purple-400', bar: 'bg-gradient-to-r from-purple-500 to-pink-500', next: 100 };
      if (r >= 20) return { title: '理財騎士 🛡️', color: 'text-blue-400', bar: 'bg-gradient-to-r from-blue-400 to-cyan-400', next: 50 };
      return { title: '初心冒險者 🪵', color: 'text-slate-400', bar: 'bg-slate-600', next: 20 };
  }, [fireMetrics]);

  const skills = useMemo(() => {
      const divScore = Math.min(100, (fireMetrics.annualPassive / 500000) * 100); 
      const hedgeScore = Math.min(100, (actualHedging / (totalMarketValue||1)) * 500); 
      const leverageScore = Math.min(100, (totalStockDebt / 5000000) * 100); 
      const growthScore = Math.min(100, (unrealizedPL / 1000000) * 100); 
      return [
          { name: '股息水流斬', level: Math.floor(divScore), icon: <RefreshCw className="w-4 h-4"/>, color: 'text-emerald-400', bar: 'bg-emerald-500' },
          { name: '絕對防禦', level: Math.floor(hedgeScore), icon: <ShieldCheck className="w-4 h-4"/>, color: 'text-amber-400', bar: 'bg-amber-500' },
          { name: '槓桿爆發', level: Math.floor(leverageScore), icon: <Zap className="w-4 h-4"/>, color: 'text-blue-400', bar: 'bg-blue-500' },
          { name: '資本增幅', level: Math.floor(growthScore), icon: <TrendingUp className="w-4 h-4"/>, color: 'text-purple-400', bar: 'bg-purple-500' },
      ];
  }, [fireMetrics, actualHedging, totalMarketValue, totalStockDebt, unrealizedPL]);

  const achievements = useMemo(() => [
      { id: '1', name: '初心冒險者', icon: <Swords className="w-5 h-5"/>, desc: '開始您的投資旅程', unlocked: totalMarketValue > 0, color: 'text-slate-200 border-slate-500 shadow-slate-500/20' },
      { id: '2', name: '第一桶金', icon: <Coins className="w-5 h-5"/>, desc: '總資產突破 100 萬', unlocked: totalMarketValue >= 1000000, color: 'text-emerald-400 border-emerald-500 shadow-emerald-500/20' },
      { id: '3', name: '千萬富翁', icon: <Gem className="w-5 h-5"/>, desc: '總資產突破 1000 萬', unlocked: totalMarketValue >= 10000000, color: 'text-purple-400 border-purple-500 shadow-purple-500/20' },
      { id: '4', name: '煉金術士', icon: <Sparkles className="w-5 h-5"/>, desc: '持有黃金等避險資產', unlocked: actualHedging > 0, color: 'text-yellow-400 border-yellow-500 shadow-yellow-500/20' },
      { id: '5', name: '現金流大師', icon: <RefreshCw className="w-5 h-5"/>, desc: '年股息超過 50 萬', unlocked: fireMetrics.annualPassive >= 500000, color: 'text-blue-400 border-blue-500 shadow-blue-500/20' },
      { id: '6', name: '槓桿戰士', icon: <Zap className="w-5 h-5"/>, desc: '使用融資或質押', unlocked: totalStockDebt > 0, color: 'text-red-400 border-red-500 shadow-red-500/20' },
      { id: '7', name: '財富國王', icon: <Crown className="w-5 h-5"/>, desc: 'FIRE 自由度達 100%', unlocked: fireMetrics.ratio >= 100, color: 'text-yellow-500 border-yellow-500 shadow-yellow-500/40' },
      { id: '8', name: '債務殺手', icon: <Skull className="w-5 h-5"/>, desc: '資產大於總負債', unlocked: totalMarketValue > (totalStockDebt + totalRealDebt), color: 'text-orange-500 border-orange-500 shadow-orange-500/20' },
  ], [totalMarketValue, actualHedging, fireMetrics, totalStockDebt, totalRealDebt]);

  // E. Chart Data
  const monthlyChartData = useMemo(() => monthlyFlows.map(f => ({ month: `${f.month}月`, income: f.dividendInflow, expense: f.loanOutflow + f.creditLoanOutflow + f.stockLoanInterest + f.livingExpenses + f.taxWithheld, net: f.netFlow })), [monthlyFlows]);
  
  const snowballData = useMemo(() => {
      const avgYield = totalMarketValue > 0 ? fireMetrics.annualPassive / totalMarketValue : 0.05;
      const annualSavings = yearlyNetPosition.toNumber() > 0 ? yearlyNetPosition.toNumber() : 0;
      const data = []; let currentWealth = totalMarketValue; let currentIncome = fireMetrics.annualPassive;
      for (let year = 0; year <= 10; year++) {
          data.push({ year: `Y${year}`, wealth: Math.floor(currentWealth), income: Math.floor(currentIncome) });
          currentWealth = currentWealth * 1.05 + (reinvest ? currentIncome : 0) + annualSavings;
          currentIncome = currentWealth * avgYield;
      }
      return data;
  }, [monthlyFlows, totalMarketValue, yearlyNetPosition, reinvest, fireMetrics]);
  
  const radarData = useMemo(() => {
     const yieldScore = totalMarketValue > 0 ? Math.min(100, ((fireMetrics.annualPassive / totalMarketValue) / 0.06) * 100) : 0;
     const hedgeScore = Math.min(100, (actualHedging / (totalMarketValue || 1)) * 500);
     const marginScore = currentMaintenance > 200 ? 100 : Math.max(0, (currentMaintenance - 130));
     const activeScore = Math.min(100, (actualActive / (totalMarketValue||1)) * 1000);
     const taxRatio = (healthInsuranceTotal.plus(incomeTaxTotal).toNumber() / (fireMetrics.annualPassive || 1));
     const taxScore = Math.max(0, 100 - (taxRatio * 500)); 
     return [{ subject: '現金流', A: Math.floor(yieldScore), fullMark: 100 }, { subject: '防禦力', A: Math.floor((hedgeScore+marginScore)/2), fullMark: 100 }, { subject: '成長力', A: Math.floor(activeScore), fullMark: 100 }, { subject: '稅務', A: Math.floor(taxScore), fullMark: 100 }, { subject: '抗壓', A: marginScore, fullMark: 100 }];
  }, [monthlyFlows, totalMarketValue, currentMaintenance, actualHedging, actualActive, fireMetrics, healthInsuranceTotal, incomeTaxTotal]);

  const mortgageCoverage = useMemo(() => {
      const totalDividendInflow = monthlyFlows.reduce((acc, curr) => acc + curr.dividendInflow, 0);
      const totalLoanOutflow = monthlyFlows.reduce((acc, curr) => acc + curr.loanOutflow + curr.creditLoanOutflow, 0);
      return totalLoanOutflow === 0 ? 100 : (totalDividendInflow / totalLoanOutflow) * 100;
  }, [monthlyFlows]);

  const breakevenTip = useMemo(() => {
      if (yearlyNetPosition.gte(0)) return null;
      const deficit = yearlyNetPosition.abs().toNumber();
      const divEtfs = etfs.filter(e => e.category === 'dividend' && e.shares > 0);
      let totalInvested = 0; let totalDiv = 0;
      divEtfs.forEach(e => {
          const mkt = e.shares * e.currentPrice; const freq = e.dividendType === 'per_period' && e.payMonths.length > 0 ? e.payMonths.length : 1;
          totalInvested += mkt; totalDiv += e.dividendPerShare * freq * e.shares;
      });
      const avgYield = totalInvested > 0 ? totalDiv / totalInvested : 0.06;
      return { deficit, avgYield: (avgYield * 100).toFixed(1), neededCapital: deficit / avgYield };
  }, [yearlyNetPosition, etfs]);

  if (isInitializing) return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /><p className="ml-4 text-slate-400 font-mono">系統啟動中...</p></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {showLoot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in" onClick={() => setShowLoot(false)}>
              <div className="bg-gradient-to-br from-yellow-900/90 to-slate-900 border-2 border-yellow-500/50 rounded-2xl p-8 max-w-md text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] transform animate-in zoom-in-95 duration-300">
                  <Gift className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-bounce" />
                  <h3 className="text-2xl font-bold text-yellow-100 mb-2">每日寶箱開啟！</h3>
                  <p className="text-lg text-yellow-300 font-serif italic">"{lootQuote}"</p>
                  <p className="text-xs text-slate-400 mt-6">(點擊任意處關閉)</p>
              </div>
          </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
           <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5"/> 系統設定</h3>
              <div className="space-y-4">
                  <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-xs flex gap-2">
                     <Cloud className="w-4 h-4 text-emerald-400 shrink-0"/> <div><p className="text-emerald-300 font-bold">雲端同步 Online</p><p className="text-slate-400">數據已安全加密</p></div>
                  </div>
                  <div>
                      <label className="block text-xs text-slate-400 mb-1">行情資料來源 (Google Sheet CSV)</label>
                      <input type="text" placeholder="https://docs.google.com/..." value={cloudConfig.priceSourceUrl || ''} onChange={(e) => setCloudConfig({...cloudConfig, priceSourceUrl: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none transition-colors" />
                  </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full py-2 mt-4 bg-slate-800 hover:bg-slate-700 rounded text-white text-sm transition-colors">確認</button>
           </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-8 border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 flex items-center gap-2 filter drop-shadow-lg tracking-tight">
            <Calculator className="w-8 h-8 text-emerald-400" /> 資產戰情室 <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">PRO</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1 flex items-center gap-2 font-mono"><Target className="w-3 h-3 text-red-400" /> 目標：財務自由 FIRE</p>
        </div>
        <div className="flex flex-wrap gap-2">
           <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
           <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg text-sm text-slate-300 transition-all"><Settings className="w-4 h-4" /></button>
           <button onClick={openLootBox} className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 hover:from-yellow-800/50 border border-yellow-500/30 rounded-lg text-sm text-yellow-200 transition-all group"><Gift className="w-4 h-4 group-hover:scale-110 transition-transform" /> 每日寶箱</button>
           <button onClick={handleUpdatePrices} disabled={isUpdatingPrices} className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 hover:bg-blue-800/50 border border-blue-500/30 rounded-lg text-sm text-blue-300 transition-all group">
               {isUpdatingPrices ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />} 更新行情
           </button>
           <button onClick={handleSmartMerge} className="flex items-center gap-2 px-3 py-2 bg-purple-900/30 hover:bg-purple-800/50 border border-purple-500/30 rounded-lg text-sm text-purple-300 transition-all"><Zap className="w-4 h-4" /> 補全裝備</button>
           <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg text-sm text-slate-300 transition-all"><Download className="w-4 h-4" /> 存檔</button>
        </div>
      </header>

      {/* ★★★ GAME HUD ★★★ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
          
          {/* Player Stats */}
          <div className="md:col-span-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden backdrop-blur-sm group hover:border-slate-600 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Swords className="w-32 h-32" /></div>
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><Crown className="w-3 h-3 text-yellow-500" /> 玩家等級</div>
              <div className={`text-3xl font-black ${levelInfo.color} mb-1`}>{levelInfo.title}</div>
              <div className="w-full bg-slate-800 rounded-full h-2 mb-4 border border-slate-700"><div className={`h-full ${levelInfo.bar} rounded-full transition-all duration-1000`} style={{width: `${Math.min(100, fireMetrics.ratio)}%`}}></div></div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                      <div className="text-slate-500 text-[10px] uppercase">戰鬥力 (CP)</div>
                      <div className="text-2xl font-mono text-white font-bold"><AnimatedNumber value={combatPower} /></div>
                  </div>
                  <div>
                      <div className="text-slate-500 text-[10px] uppercase">HP (維持率)</div>
                      <div className={`text-2xl font-mono font-bold ${currentMaintenance < 130 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>{currentMaintenance === 999 ? 'MAX' : currentMaintenance.toFixed(0) + '%'}</div>
                  </div>
              </div>
          </div>

          {/* Boss Battle */}
          <div className="md:col-span-5 bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden backdrop-blur-sm flex flex-col justify-center">
              <div className="flex justify-between items-end mb-2">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><Skull className="w-3 h-3 text-red-500" /> BOSS: 負債魔王</div>
                  <div className="text-[10px] text-red-400 font-mono">剩餘血量: {formatMoney(Math.max(0, (totalStockDebt + totalRealDebt) - totalMarketValue))}</div>
              </div>
              <div className="relative h-8 w-full bg-slate-950 rounded-lg overflow-hidden border border-red-900/30 shadow-inner">
                  {/* Boss HP */}
                  <div className="absolute top-0 left-0 h-full bg-gradient-to-b from-red-600 to-red-900 transition-all duration-1000" style={{width: '100%'}}></div>
                  {/* Player Damage */}
                  <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500/80 to-blue-500/80 transition-all duration-1000 flex items-center justify-end px-3 border-r-2 border-white/50" style={{width: `${Math.min(100, (totalMarketValue / ((totalStockDebt + totalRealDebt) || 1)) * 100)}%`}}>
                      <span className="text-xs font-bold text-white drop-shadow-md">-{((totalMarketValue / ((totalStockDebt + totalRealDebt) || 1)) * 100).toFixed(0)}% 爆擊</span>
                  </div>
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono">
                  <span>ATK: {formatMoney(totalMarketValue)} (資產)</span>
                  <span>HP: {formatMoney(totalStockDebt + totalRealDebt)} (負債)</span>
              </div>
          </div>

          {/* Skills */}
          <div className="md:col-span-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden backdrop-blur-sm">
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Scroll className="w-3 h-3 text-blue-400" /> 技能熟練度</div>
              <div className="space-y-3">
                  {skills.map(skill => (
                      <div key={skill.name}>
                          <div className="flex justify-between text-[10px] mb-0.5 text-slate-300">
                              <span className="flex items-center gap-1">{skill.icon} {skill.name}</span>
                              <span className={skill.color}>Lv.{skill.level}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${skill.bar}`} style={{width: `${skill.level}%`}}></div></div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="xl:col-span-4 space-y-6">
          <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden"><h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><PieIcon className="w-5 h-5 text-blue-400" /> 資源配置</h2>
            {/* ★★★ Fixed: Allocation Remaining Funds Display ★★★ */}
            <div className="mb-4">
                <label className="text-xs text-slate-400 block mb-1">總資金 (Total Cap)</label>
                <div className="relative"><DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" /><input type="number" value={allocation.totalFunds} onChange={(e) => setAllocation({...allocation, totalFunds: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xl font-bold text-white focus:border-blue-500 outline-none" placeholder="0"/></div>
                <div className={`text-[10px] mt-1 text-right ${remainingFunds >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {remainingFunds >= 0 ? `尚未配置資金: ${formatMoney(remainingFunds)}` : `⚠️ 超出預算: ${formatMoney(Math.abs(remainingFunds))}`}
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
                <div className="h-40 flex justify-center items-center bg-slate-950/50 rounded-xl">
                    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}</Pie><Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}/></PieChart></ResponsiveContainer>
                </div>
                <div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                    {/* Dividend Allocation */}
                    <div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-emerald-400 font-bold">配息型</span><div className="flex items-center gap-1"><input type="number" value={allocation.dividendRatio} onChange={e => setAllocation({...allocation, dividendRatio: Number(e.target.value)})} className="w-8 bg-transparent text-right outline-none text-emerald-400 border-b border-emerald-900" /><span className="text-slate-500">%</span></div></div>
                        <div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-emerald-900/50" style={{width: `${allocation.dividendRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-emerald-500" style={{width: `${Math.min(100, (actualDividend/allocation.totalFunds)*100)}%`}}></div></div>
                        <div className="flex justify-between text-[10px] text-slate-500"><span>實: {formatMoney(actualDividend)}</span><span className={actualDividend < targetDividend ? 'text-red-400' : 'text-emerald-500'}>{actualDividend < targetDividend ? `缺 ${formatMoney(targetDividend - actualDividend)}` : '已達標'}</span></div>
                    </div>
                    {/* Hedging Allocation */}
                    <div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-amber-400 font-bold">避險型</span><div className="flex items-center gap-1"><input type="number" value={allocation.hedgingRatio} onChange={e => setAllocation({...allocation, hedgingRatio: Number(e.target.value)})} className="w-8 bg-transparent text-right outline-none text-amber-400 border-b border-amber-900" /><span className="text-slate-500">%</span></div></div>
                        <div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-amber-900/50" style={{width: `${allocation.hedgingRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-amber-500" style={{width: `${Math.min(100, (actualHedging/allocation.totalFunds)*100)}%`}}></div></div>
                        <div className="flex justify-between text-[10px] text-slate-500"><span>實: {formatMoney(actualHedging)}</span><span className={actualHedging < targetHedging ? 'text-red-400' : 'text-emerald-500'}>{actualHedging < targetHedging ? `缺 ${formatMoney(targetHedging - actualHedging)}` : '已達標'}</span></div>
                    </div>
                    {/* Active Allocation */}
                    <div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-purple-400 font-bold">主動型</span><div className="flex items-center gap-1"><input type="number" value={allocation.activeRatio} onChange={e => setAllocation({...allocation, activeRatio: Number(e.target.value)})} className="w-8 bg-transparent text-right outline-none text-purple-400 border-b border-purple-900" /><span className="text-slate-500">%</span></div></div>
                        <div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-purple-900/50" style={{width: `${allocation.activeRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-purple-500" style={{width: `${Math.min(100, (actualActive/allocation.totalFunds)*100)}%`}}></div></div>
                        <div className="flex justify-between text-[10px] text-slate-500"><span>實: {formatMoney(actualActive)}</span><span className={actualActive < targetActive ? 'text-red-400' : 'text-emerald-500'}>{actualActive < targetActive ? `缺 ${formatMoney(targetActive - actualActive)}` : '已達標'}</span></div>
                    </div>
                </div>
            </div>
          </section>

          {/* ETF List */}
          <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg">
            <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-400" /> 裝備清單</h2>
             <div className="space-y-3">
              {etfs.map((etf, idx) => {
                const hasLots = etf.lots && etf.lots.length > 0;
                const isExpanded = expandedEtfId === etf.id;
                const isBuying = activeBuyId === etf.id;
                const isHedging = etf.category === 'hedging';
                return (
                  <div key={etf.id} className={`p-3 bg-slate-950 rounded-xl border transition-all hover:border-slate-600 ${isHedging ? 'border-amber-900/50' : 'border-slate-800'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex-1 mr-2"><input type="text" value={etf.name} onChange={(e) => updateEtf(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-600 focus:border-blue-500 outline-none w-full text-sm" /></div>
                      <div className="flex gap-1"><button onClick={() => toggleBuy(etf.id)} className={`p-1.5 rounded-lg border transition-colors ${isBuying ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-emerald-400'}`}><ShoppingCart className="w-3 h-3" /></button><button onClick={() => toggleLots(etf.id)} className={`p-1.5 rounded-lg border transition-colors ${hasLots ? 'bg-slate-800 border-slate-600 text-slate-300' : 'border-slate-700 text-slate-500'}`}><List className="w-3 h-3" /></button><button onClick={() => removeEtf(etf.id)} className="p-1.5 rounded-lg border border-slate-700 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button></div>
                    </div>
                    {isBuying && (<div className="mb-2 p-2 bg-emerald-900/20 border border-emerald-500/20 rounded-lg animate-in slide-in-from-top-2"><div className="grid grid-cols-3 gap-1 mb-2"><div><label className="text-[9px] text-slate-500">日期</label><input type="date" value={buyForm.date} onChange={e => setBuyForm({...buyForm, date: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div><div><label className="text-[9px] text-slate-500">數量</label><input type="number" placeholder="0" value={buyForm.shares} onChange={e => setBuyForm({...buyForm, shares: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div><div><label className="text-[9px] text-slate-500">單價</label><input type="number" placeholder="0" value={buyForm.price} onChange={e => setBuyForm({...buyForm, price: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div></div><button onClick={() => submitBuy(idx)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1 rounded text-xs font-bold">確認交易</button></div>)}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        <div><label className="text-[9px] text-slate-500 block">數量</label><input type="number" value={etf.shares} onChange={(e) => updateEtf(idx, 'shares', Number(e.target.value))} disabled={hasLots} className={`w-full bg-slate-900 border rounded px-1 py-0.5 text-xs ${hasLots ? 'border-slate-800 text-slate-500' : 'border-slate-700 text-white'}`} /></div>
                        <div><label className="text-[9px] text-slate-500 block">成本</label><input type="number" value={etf.costPrice} onChange={(e) => updateEtf(idx, 'costPrice', Number(e.target.value))} disabled={hasLots} className={`w-full bg-slate-900 border rounded px-1 py-0.5 text-xs ${hasLots ? 'border-slate-800 text-slate-500' : 'border-slate-700 text-white'}`} /></div>
                        <div><label className="text-[9px] text-slate-500 block">現價</label><input type="number" value={etf.currentPrice} onChange={(e) => updateEtf(idx, 'currentPrice', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div>
                    </div>
                    {/* Simplified select category for space */}
                    <div className="flex gap-1 justify-end"><select value={etf.category} onChange={(e) => updateEtf(idx, 'category', e.target.value)} className="bg-slate-900 text-[9px] border border-slate-700 rounded px-1 text-slate-400"><option value="dividend">配息型</option><option value="hedging">避險型</option><option value="active">主動型</option></select><select value={etf.dividendType||'annual'} onChange={(e) => {const n=[...etfs];n[idx].dividendType=e.target.value as any;setEtfs(n)}} className="bg-slate-900 text-[9px] border border-slate-700 rounded px-1 text-slate-400" disabled={isHedging}><option value="annual">年配</option><option value="per_period">期配</option></select><div className="flex-1"></div><input type="number" value={etf.dividendPerShare} onChange={(e) => updateEtf(idx, 'dividendPerShare', Number(e.target.value))} className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-right" disabled={isHedging} placeholder="配息"/></div>
                    
                    {/* ★★★ RESTORED: Month Selector ★★★ */}
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                        <button key={month} onClick={() => toggleEtfPayMonth(idx, month)} className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center transition-all ${etf.payMonths?.includes(month) ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50 scale-110' : 'bg-slate-800 text-slate-600 hover:bg-slate-700'}`}>
                          {month}
                        </button>
                      ))}
                    </div>

                    {isExpanded && (<div className="mt-2 pt-2 border-t border-slate-800"><div className="text-[9px] text-slate-500 mb-1">交易明細</div>{etf.lots?.map(l=><div key={l.id} className="flex justify-between text-[10px] text-slate-400 mb-0.5"><span>{l.date}</span><span>{l.shares}股 @ {l.price}</span><button onClick={()=>removeLot(idx, l.id)} className="text-red-500 hover:text-red-400"><X className="w-3 h-3"/></button></div>)}<div className="flex gap-1 mt-1"><input type="date" value={newLot.date} onChange={e=>setNewLot({...newLot, date:e.target.value})} className="bg-slate-900 border border-slate-700 rounded text-[9px] w-16"/><input type="number" placeholder="股" value={newLot.shares} onChange={e=>setNewLot({...newLot, shares:e.target.value})} className="bg-slate-900 border border-slate-700 rounded text-[9px] w-12"/><input type="number" placeholder="$" value={newLot.price} onChange={e=>setNewLot({...newLot, price:e.target.value})} className="bg-slate-900 border border-slate-700 rounded text-[9px] w-12"/><button onClick={()=>addLot(idx)} className="bg-slate-800 px-2 rounded text-[10px]">+</button></div></div>)}
                  </div>
                );
              })}
              <button onClick={addEtf} className="w-full py-2 bg-slate-900 border border-dashed border-slate-700 rounded-xl text-slate-500 text-xs hover:text-white hover:border-slate-500 transition-all">+ 新增標的</button>
            </div>
          </section>

          {/* ★★★ Fixed: Mortgage Details with Two-Stage Rates & Correct Period Unit ★★★ */}
          <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg space-y-4">
             <div>
                 <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><DollarSign className="w-4 h-4" /> 房貸與信貸</h2>
                 {loans.map((loan, idx) => (
                     <div key={loan.id} className="mb-4 p-3 bg-slate-950 rounded border border-slate-800">
                         <div className="flex justify-between mb-2 items-center">
                             <input type="text" value={loan.name} onChange={(e) => updateLoan(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-600 w-1/2 text-sm" />
                             <select value={loan.type} onChange={(e) => updateLoan(idx, 'type', e.target.value)} className="bg-slate-900 text-[10px] border border-slate-700 rounded px-1 text-slate-400"><option value={MortgageType.PrincipalAndInterest}>本息攤還</option><option value={MortgageType.Principal}>本金攤還</option></select>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                             <div><label className="text-[10px] text-slate-500 block">貸款總額</label><input type="number" value={loan.principal} onChange={(e) => updateLoan(idx, 'principal', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" /></div>
                             <div><label className="text-[10px] text-emerald-500 block">核貸日期</label><input type="date" value={loan.startDate || ''} onChange={(e) => updateLoan(idx, 'startDate', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" /></div>
                             <div><label className="text-[10px] text-slate-500 block">總期數(月)</label><input type="number" value={loan.totalMonths} onChange={(e) => updateLoan(idx, 'totalMonths', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" /></div>
                             <div><label className="text-[10px] text-slate-500 block">寬限期(月)</label><input type="number" value={loan.gracePeriod} onChange={(e) => updateLoan(idx, 'gracePeriod', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" /></div>
                         </div>
                         <div className="mt-2 grid grid-cols-3 gap-2 p-2 bg-slate-900/50 rounded border border-slate-800">
                             <div><label className="text-[9px] text-blue-400 block">一段利率 %</label><input type="number" value={loan.rate1} onChange={(e) => updateLoan(idx, 'rate1', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-1 text-xs" /></div>
                             <div><label className="text-[9px] text-blue-400 block">一段月數</label><input type="number" value={loan.rate1Months} onChange={(e) => updateLoan(idx, 'rate1Months', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-1 text-xs" /></div>
                             <div><label className="text-[9px] text-blue-400 block">二段利率 %</label><input type="number" value={loan.rate2} onChange={(e) => updateLoan(idx, 'rate2', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-1 text-xs" /></div>
                         </div>
                         <div className="mt-2 text-[10px] text-slate-600 text-right">已繳期數: {loan.paidMonths} 期</div>
                     </div>
                 ))}
                 <div className="p-2 bg-slate-950 rounded border border-slate-800 border-l-2 border-l-orange-500">
                     <div className="flex justify-between mb-1"><span className="text-xs font-bold text-orange-300">信用貸款</span><span className="text-[10px] text-slate-500">{creditLoan.rate}%</span></div>
                     <div className="grid grid-cols-2 gap-2"><input type="number" value={creditLoan.principal} onChange={(e) => setCreditLoan({...creditLoan, principal: Number(e.target.value)})} className="bg-slate-900 border border-slate-700 rounded px-1 text-xs" /><input type="number" value={creditLoan.totalMonths} onChange={(e) => setCreditLoan({...creditLoan, totalMonths: Number(e.target.value)})} className="bg-slate-900 border border-slate-700 rounded px-1 text-xs" /></div>
                 </div>
             </div>
             
             <div className="pt-2 border-t border-slate-800">
                 <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Layers className="w-4 h-4" /> 質押與融資</h2>
                 <div className="grid grid-cols-2 gap-2 text-xs">
                     <div><label className="text-slate-500">質押本金</label><input type="number" value={stockLoan.principal} onChange={(e) => setStockLoan({...stockLoan, principal: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded px-1" /></div>
                     <div><label className="text-slate-500">融資本金</label><input type="number" value={globalMarginLoan.principal} onChange={(e) => setGlobalMarginLoan({...globalMarginLoan, principal: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded px-1" /></div>
                 </div>
             </div>

             <div className="pt-2 border-t border-slate-800">
                 <h2 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Coffee className="w-4 h-4" /> 生活與稅務</h2>
                 <div className="grid grid-cols-2 gap-2 text-xs">
                     <div><label className="text-slate-500">薪資所得</label><input type="number" value={taxStatus.salaryIncome} onChange={(e) => setTaxStatus({...taxStatus, salaryIncome: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded px-1" /></div>
                     <div><label className="text-slate-500">月生活費</label><input type="number" value={taxStatus.livingExpenses} onChange={(e) => setTaxStatus({...taxStatus, livingExpenses: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded px-1" /></div>
                 </div>
             </div>
          </section>
        </div>

        {/* Right Column: Output */}
        <div className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-3 opacity-10"><DollarSign className="w-12 h-12"/></div>
                <div className="text-slate-500 text-xs uppercase tracking-wider">年度淨現金流</div>
                <div className={`text-2xl font-black ${yearlyNetPosition.isNegative() ? 'text-red-400' : 'text-emerald-400'}`}><AnimatedNumber value={yearlyNetPosition.toNumber()}/></div>
            </div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-3 opacity-10"><Banknote className="w-12 h-12"/></div>
                <div className="text-slate-500 text-xs uppercase tracking-wider">總資產市值</div>
                <div className="text-2xl font-black text-blue-400"><AnimatedNumber value={totalMarketValue}/></div>
                <div className={`text-[10px] ${unrealizedPL>=0?'text-emerald-500':'text-red-500'}`}>損益 {formatMoney(unrealizedPL)}</div>
            </div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-3 opacity-10"><Flame className="w-12 h-12"/></div>
                <div className="text-slate-500 text-xs uppercase tracking-wider">FIRE 自由度</div>
                <div className="text-2xl font-black text-orange-400">{fireMetrics.ratio.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-500">被動收入 {formatMoney(fireMetrics.annualPassive)}</div>
            </div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-3 opacity-10"><Wallet className="w-12 h-12"/></div>
                <div className="text-slate-500 text-xs uppercase tracking-wider">預估稅負</div>
                <div className="text-2xl font-black text-purple-400"><AnimatedNumber value={healthInsuranceTotal.plus(incomeTaxTotal).toNumber()}/></div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-400"/> 十年財富滾雪球</h3>
                  <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={snowballData}><defs><linearGradient id="cw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="year" stroke="#475569" tick={{fontSize:10}} /><YAxis stroke="#475569" tick={{fontSize:10}} /><Tooltip formatter={(v:number)=>formatMoney(v)} contentStyle={{backgroundColor:'#0f172a', border:'none'}}/ ><Area type="monotone" dataKey="wealth" stroke="#3b82f6" fill="url(#cw)" /></AreaChart></ResponsiveContainer></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-purple-400"/> 月度收支表</h3>
                  <div className="h-48"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={monthlyChartData}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="month" stroke="#475569" tick={{fontSize:10}} /><YAxis stroke="#475569" tick={{fontSize:10}} /><Tooltip formatter={(v:number)=>formatMoney(v)} contentStyle={{backgroundColor:'#0f172a', border:'none'}} /><Bar dataKey="income" fill="#10b981" /><Bar dataKey="expense" fill="#ef4444" /><Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div>
              </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg overflow-x-auto">
              <h3 className="text-sm font-bold text-slate-300 mb-4">📜 現金流明細卷軸</h3>
              <table className="w-full text-xs text-left text-slate-400">
                  <thead className="text-[10px] uppercase bg-slate-950 text-slate-500"><tr><th className="p-2">月</th><th className="p-2 text-right">股息</th><th className="p-2 text-right">房貸</th><th className="p-2 text-right">信貸</th><th className="p-2 text-right">股貸</th><th className="p-2 text-right">生活</th><th className="p-2 text-right">稅負</th><th className="p-2 text-right">淨流</th></tr></thead>
                  <tbody>{monthlyFlows.map(r=><tr key={r.month} className="border-b border-slate-800 hover:bg-slate-800/50"><td className="p-2">{r.month}</td><td className="p-2 text-right text-emerald-400">{formatMoney(r.dividendInflow)}</td><td className="p-2 text-right text-red-400">{formatMoney(r.loanOutflow)}</td><td className="p-2 text-right text-orange-400">{formatMoney(r.creditLoanOutflow)}</td><td className="p-2 text-right text-blue-400">{formatMoney(r.stockLoanInterest)}</td><td className="p-2 text-right text-slate-400">{formatMoney(r.livingExpenses)}</td><td className="p-2 text-right text-purple-400">{formatMoney(r.taxWithheld)}</td><td className={`p-2 text-right font-bold ${r.netFlow<0?'text-red-500':'text-emerald-500'}`}>{formatMoney(r.netFlow)}</td></tr>)}</tbody>
              </table>
          </div>
          
          {/* ★★★ Updated: Achievement Hall (Card Grid) ★★★ */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-500" /> 成就殿堂 (Hall of Fame)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {achievements.map(ach => (
                      <div key={ach.id} className={`relative p-3 rounded-xl border flex items-center gap-3 transition-all duration-500 group ${ach.unlocked ? `bg-slate-950/80 ${ach.color}` : 'bg-slate-950/30 border-slate-800 opacity-60 grayscale'}`}>
                          <div className={`p-2 rounded-full shadow-lg ${ach.unlocked ? 'bg-slate-900 text-white shadow-current/20' : 'bg-slate-800 text-slate-600'}`}>
                              {ach.unlocked ? ach.icon : <Lock className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                              <div className={`text-xs font-bold truncate ${ach.unlocked ? 'text-white' : 'text-slate-500'}`}>{ach.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">{ach.desc}</div>
                          </div>
                          {ach.unlocked && <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />}
                      </div>
                  ))}
              </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;
