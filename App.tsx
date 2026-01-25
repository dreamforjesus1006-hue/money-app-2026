import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine, PieChart, Pie, Cell, ComposedChart, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area } from 'recharts';
import { INITIAL_ETFS, INITIAL_LOANS, INITIAL_STOCK_LOAN, INITIAL_CREDIT_LOAN, INITIAL_TAX_STATUS, INITIAL_GLOBAL_MARGIN_LOAN, INITIAL_ALLOCATION } from './constants';
import { ETF, Loan, StockLoan, CreditLoan, TaxStatus, MortgageType, AppState, Lot, CloudConfig, AllocationConfig, EtfCategory } from './types';

import { PortfolioCalculator } from './PortfolioCalculator';
import { StorageService } from './storage';
import { formatMoney } from './decimal';

import { Calculator, AlertTriangle, TrendingDown, DollarSign, Wallet, Activity, Save, Upload, Download, RotateCcw, List, Plus, Trash2, X, ChevronDown, ChevronUp, Clock, Calendar, Repeat, ArrowRightLeft, Info, Banknote, Coins, ShoppingCart, CheckCircle2, Cloud, Loader2, Layers, HelpCircle, Smartphone, Monitor, HardDrive, Database, Link as LinkIcon, Settings, Globe, Code, ExternalLink, CheckSquare, Edit3, PieChart as PieIcon, Target, Lightbulb, Zap, Coffee, TrendingUp, ShieldCheck, Flame } from 'lucide-react';
import Decimal from 'decimal.js';

const BROKERAGE_RATE = 0.001425; 

// Colors
const COLORS = {
  dividend: '#10b981', // Emerald
  hedging: '#f59e0b',  // Amber
  active: '#a855f7',   // Purple
  cash: '#334155'      // Slate
};

const App: React.FC = () => {
  // Loading States
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [storageStats, setStorageStats] = useState({ used: 0, total: 5242880 });
  const [dataSource, setDataSource] = useState<'local' | 'cloud' | 'gas'>('local');
  const [reinvest, setReinvest] = useState(true); // Control for Snowball Chart

  // Cloud Config State
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({ 
    apiKey: 'AIzaSyCM42AelwEWTC4R_V0sgF0FbomkoXdE4T0', 
    projectId: 'baozutang-finance', 
    syncId: 'tony1006', 
    enabled: true 
  });

  // Data States
  const [etfs, setEtfs] = useState<ETF[]>(INITIAL_ETFS);
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [stockLoan, setStockLoan] = useState<StockLoan>(INITIAL_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(INITIAL_GLOBAL_MARGIN_LOAN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(INITIAL_CREDIT_LOAN);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(INITIAL_TAX_STATUS);
  const [allocation, setAllocation] = useState<AllocationConfig>(INITIAL_ALLOCATION);
  
  // UI State
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [newLot, setNewLot] = useState<{shares: string, price: string, date: string}>({ shares: '', price: '', date: '' });
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState<{shares: string, price: string, date: string}>({ shares: '', price: '', date: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Load Effect
  useEffect(() => {
    const initData = async () => {
      try {
        StorageService.saveCloudConfig({ apiKey: 'AIzaSyCM42AelwEWTC4R_V0sgF0FbomkoXdE4T0', projectId: 'baozutang-finance', syncId: 'tony1006', enabled: true });
        const result = await StorageService.loadData();
        const loadedState = result.data;
        setDataSource(result.source);
        if (loadedState) {
          const loadedEtfs = loadedState.etfs || INITIAL_ETFS;
          const sanitizedEtfs = loadedEtfs.map(e => ({ ...e, category: e.category || 'dividend' }));
          setEtfs(sanitizedEtfs);
          let mergedLoans = loadedState.loans || INITIAL_LOANS;
          if (mergedLoans.length < INITIAL_LOANS.length) mergedLoans = [...mergedLoans, INITIAL_LOANS[1]];
          setLoans(mergedLoans);
          setStockLoan(loadedState.stockLoan || INITIAL_STOCK_LOAN);
          setGlobalMarginLoan(loadedState.globalMarginLoan || INITIAL_GLOBAL_MARGIN_LOAN);
          setCreditLoan(loadedState.creditLoan || INITIAL_CREDIT_LOAN);
          setTaxStatus({ ...INITIAL_TAX_STATUS, ...loadedState.taxStatus });
          setAllocation(loadedState.allocation || INITIAL_ALLOCATION);
        }
        setStorageStats(StorageService.getStorageUsage());
      } catch (error) {
        console.error("Failed to load initial data", error);
        const localData = StorageService.loadFromLocal();
        if (localData) { setEtfs(localData.etfs || INITIAL_ETFS); setLoans(localData.loans || INITIAL_LOANS); setAllocation(localData.allocation || INITIAL_ALLOCATION); }
      } finally { setIsInitializing(false); }
    };
    initData();
  }, []);

  // 2. Auto-save Effect
  useEffect(() => {
    if (isInitializing) return;
    setSaveStatus('saving');
    const currentState: AppState = { etfs, loans, stockLoan, creditLoan, taxStatus, globalMarginLoan, allocation };
    const timer = setTimeout(async () => {
      try { await StorageService.saveData(currentState); setStorageStats(StorageService.getStorageUsage()); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); } 
      catch (error) { console.error("Save failed", error); setSaveStatus('error'); }
    }, 1000); 
    return () => clearTimeout(timer);
  }, [etfs, loans, stockLoan, creditLoan, taxStatus, globalMarginLoan, allocation, isInitializing]);

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string; const state = JSON.parse(json) as AppState;
        if (state.etfs && state.loans) {
           const loadedEtfs = state.etfs.map(e => ({...e, category: e.category || 'dividend'}));
           setEtfs(loadedEtfs); setLoans(state.loans); setStockLoan(state.stockLoan || INITIAL_STOCK_LOAN);
           setGlobalMarginLoan(state.globalMarginLoan || INITIAL_GLOBAL_MARGIN_LOAN); setCreditLoan(state.creditLoan || INITIAL_CREDIT_LOAN);
           setTaxStatus(state.taxStatus || INITIAL_TAX_STATUS); setAllocation(state.allocation || INITIAL_ALLOCATION);
           setStorageStats(StorageService.getStorageUsage()); alert('資料匯入成功！');
        } else { alert('檔案格式錯誤'); }
      } catch (error) { console.error(error); alert('無法讀取檔案'); }
    }; reader.readAsText(file); event.target.value = '';
  };
  const handleReset = () => { if (window.confirm('確定要重置所有數據回到預設值嗎？此動作無法復原。')) { setEtfs(INITIAL_ETFS); setLoans(INITIAL_LOANS); setStockLoan(INITIAL_STOCK_LOAN); setGlobalMarginLoan(INITIAL_GLOBAL_MARGIN_LOAN); setCreditLoan(INITIAL_CREDIT_LOAN); setTaxStatus(INITIAL_TAX_STATUS); setAllocation(INITIAL_ALLOCATION); setTimeout(() => { StorageService.saveData({ etfs: INITIAL_ETFS, loans: INITIAL_LOANS, stockLoan: INITIAL_STOCK_LOAN, globalMarginLoan: INITIAL_GLOBAL_MARGIN_LOAN, creditLoan: INITIAL_CREDIT_LOAN, taxStatus: INITIAL_TAX_STATUS, allocation: INITIAL_ALLOCATION }); setStorageStats(StorageService.getStorageUsage()); window.location.reload(); }, 100); } };
  const handleExport = () => { StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation }); };
  const handleSmartMerge = () => {
      const currentIds = new Set(etfs.map(e => e.id)); const missingItems = INITIAL_ETFS.filter(e => !currentIds.has(e.id));
      if (missingItems.length === 0) { alert('您的清單已經很完整了！沒有缺少的預設項目。'); return; }
      if (window.confirm(`發現 ${missingItems.length} 個新的預設項目 (如: 黃金、美債)。\n是否要將它們補入您的清單？\n(您的舊資料絕對安全，不會被刪除)`)) {
          setEtfs([...etfs, ...missingItems]); setTimeout(() => alert('補全完成！請往下滑查看新增的項目。'), 500);
      }
  };

  // --- Calculations & Memo ---
  const { monthlyFlows, yearlyNetPosition, healthInsuranceTotal, incomeTaxTotal } = useMemo(() => {
    return PortfolioCalculator.generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);

  const stressTestResults = useMemo(() => PortfolioCalculator.runStressTest(etfs, stockLoan, globalMarginLoan), [etfs, stockLoan, globalMarginLoan]);
  const totalMarketValue = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * etf.currentPrice), 0), [etfs]);
  const totalCost = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * (etf.costPrice || 0)), 0), [etfs]);
  const unrealizedPL = totalMarketValue - totalCost;
  
  const totalStockDebt = stockLoan.principal + globalMarginLoan.principal + etfs.reduce((acc, e) => acc + (e.marginLoanAmount || 0), 0);
  const currentMaintenance = useMemo(() => totalStockDebt === 0 ? 999 : (totalMarketValue / totalStockDebt) * 100, [totalMarketValue, totalStockDebt]);
  const mortgageCoverage = useMemo(() => {
      const totalDividendInflow = monthlyFlows.reduce((acc, curr) => acc + curr.dividendInflow, 0);
      const totalLoanOutflow = monthlyFlows.reduce((acc, curr) => acc + curr.loanOutflow + curr.creditLoanOutflow, 0);
      return totalLoanOutflow === 0 ? 100 : (totalDividendInflow / totalLoanOutflow) * 100;
  }, [monthlyFlows]);

  // Allocation & Pie Data
  const targetDividend = Math.floor(allocation.totalFunds * (allocation.dividendRatio / 100));
  const targetHedging = Math.floor(allocation.totalFunds * (allocation.hedgingRatio / 100));
  const targetActive = Math.floor(allocation.totalFunds * (allocation.activeRatio / 100));
  const actualDividend = useMemo(() => etfs.filter(e => e.category === 'dividend').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualHedging = useMemo(() => etfs.filter(e => e.category === 'hedging').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualActive = useMemo(() => etfs.filter(e => e.category === 'active').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const pieData = [{ name: '配息型', value: actualDividend, color: COLORS.dividend }, { name: '避險型', value: actualHedging, color: COLORS.hedging }, { name: '主動型', value: actualActive, color: COLORS.active }].filter(d => d.value > 0);

  // Breakeven Logic
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

  // Monthly Chart Data
  const monthlyChartData = useMemo(() => monthlyFlows.map(f => ({ month: `${f.month}月`, income: f.dividendInflow, expense: f.loanOutflow + f.creditLoanOutflow + f.stockLoanInterest + f.livingExpenses + f.taxWithheld, net: f.netFlow })), [monthlyFlows]);

  // ★★★ New Feature 1: Snowball Projection (10 Years) ★★★
  const snowballData = useMemo(() => {
      const annualDivIncome = monthlyFlows.reduce((acc, cur) => acc + cur.dividendInflow, 0);
      const avgYield = totalMarketValue > 0 ? annualDivIncome / totalMarketValue : 0.05;
      const annualSavings = yearlyNetPosition.toNumber() > 0 ? yearlyNetPosition.toNumber() : 0; // Only reinvest positive cash flow
      
      const data = [];
      let currentWealth = totalMarketValue;
      let currentIncome = annualDivIncome;

      for (let year = 0; year <= 10; year++) {
          data.push({
              year: `第${year}年`,
              wealth: Math.floor(currentWealth),
              income: Math.floor(currentIncome)
          });
          // Growth Logic
          if (reinvest) {
              currentWealth = currentWealth * 1.05 + currentIncome + annualSavings; // Assume 5% capital growth + reinvest dividend + savings
          } else {
              currentWealth = currentWealth * 1.05 + annualSavings; // Spend dividend, only savings added
          }
          currentIncome = currentWealth * avgYield;
      }
      return data;
  }, [monthlyFlows, totalMarketValue, yearlyNetPosition, reinvest]);

  // ★★★ New Feature 2: Wealth Radar ★★★
  const radarData = useMemo(() => {
     // 1. Cash Flow (0-100): Based on Yield. Target 6% = 100.
     const annualDiv = monthlyFlows.reduce((acc, cur) => acc + cur.dividendInflow, 0);
     const yieldScore = totalMarketValue > 0 ? Math.min(100, ((annualDiv / totalMarketValue) / 0.06) * 100) : 0;
     
     // 2. Safety (0-100): Based on Hedging Ratio & Margin Safety.
     const hedgeScore = Math.min(100, (actualHedging / (totalMarketValue || 1)) * 500); // 20% hedging = 100
     const marginScore = currentMaintenance > 200 ? 100 : Math.max(0, (currentMaintenance - 130));
     const safetyScore = (hedgeScore * 0.4) + (marginScore * 0.6);

     // 3. Growth (0-100): Based on Active Allocation
     const growthScore = Math.min(100, (actualActive / (totalMarketValue || 1)) * 1000); // 10% active = 100

     // 4. Resilience (0-100): Based on Stress Test (Survival of 30% drop)
     const drop30 = stressTestResults.find(r => r.dropRate === 30);
     const resilienceScore = drop30 && !drop30.isMarginCall ? 100 : 50;

     // 5. Tax Efficiency (0-100): Lower tax is better.
     const taxRatio = (healthInsuranceTotal.plus(incomeTaxTotal).toNumber() / (annualDiv || 1));
     const taxScore = Math.max(0, 100 - (taxRatio * 500)); // 20% tax = 0 score, 0% tax = 100 score

     return [
        { subject: '現金流', A: Math.floor(yieldScore), fullMark: 100 },
        { subject: '安全性', A: Math.floor(safetyScore), fullMark: 100 },
        { subject: '成長性', A: Math.floor(growthScore), fullMark: 100 },
        { subject: '抗壓性', A: Math.floor(resilienceScore), fullMark: 100 },
        { subject: '稅務優勢', A: Math.floor(taxScore), fullMark: 100 },
     ];
  }, [monthlyFlows, totalMarketValue, actualHedging, currentMaintenance, actualActive, stressTestResults, healthInsuranceTotal, incomeTaxTotal]);

  // ★★★ New Feature 3: FIRE Progress ★★★
  const fireMetrics = useMemo(() => {
      const annualExpenses = monthlyFlows.reduce((acc, cur) => acc + cur.loanOutflow + cur.creditLoanOutflow + cur.livingExpenses, 0);
      const annualPassive = monthlyFlows.reduce((acc, cur) => acc + cur.dividendInflow, 0);
      const ratio = annualExpenses > 0 ? (annualPassive / annualExpenses) * 100 : 0;
      return { ratio, annualExpenses, annualPassive };
  }, [monthlyFlows]);

  // Handlers (Condensed)
  const updateEtf = (i: number, f: keyof ETF, v: any) => { const n = [...etfs]; n[i] = { ...n[i], [f]: v }; setEtfs(n); };
  const addEtf = () => setEtfs([...etfs, { id: Date.now().toString(), name: '自選標的', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'annual', payMonths: [], marginLoanAmount: 0, marginInterestRate: 0, lots: [], category: 'dividend' }]);
  const removeEtf = (id: string) => { if (window.confirm('確定刪除？')) setEtfs(etfs.filter(e => e.id !== id)); };
  const toggleEtfPayMonth = (i: number, m: number) => { const e = etfs[i]; const ms = e.payMonths.includes(m) ? e.payMonths.filter(x => x !== m) : [...e.payMonths, m].sort((a, b) => a - b); updateEtf(i, 'payMonths', ms); };
  const toggleEtfDividendType = (i: number) => { const n = [...etfs]; n[i].dividendType = n[i].dividendType === 'annual' ? 'per_period' : 'annual'; setEtfs(n); };
  const toggleLots = (id: string) => { setExpandedEtfId(expandedEtfId === id ? null : id); if(activeBuyId) setActiveBuyId(null); };
  const toggleBuy = (id: string) => { setActiveBuyId(activeBuyId === id ? null : id); if(expandedEtfId) setExpandedEtfId(null); };
  const submitBuy = (i: number) => { const s = Number(buyForm.shares), p = Number(buyForm.price); if (!s || !p) return; const fee = Math.floor(s * p * BROKERAGE_RATE); const n = [...etfs]; const l = n[i].lots ? [...n[i].lots!] : []; l.push({ id: Date.now().toString(), date: buyForm.date, shares: s, price: p, fee }); const ts = l.reduce((a, b) => a + b.shares, 0); const tc = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0); n[i] = { ...n[i], lots: l, shares: ts, costPrice: Number((ts ? tc / ts : 0).toFixed(2)) }; setEtfs(n); setBuyForm({ ...buyForm, shares: '', price: '' }); setActiveBuyId(null); };
  const addLot = (i: number) => { const s = Number(newLot.shares), p = Number(newLot.price); if (!s || !p) return; const fee = Math.floor(s * p * BROKERAGE_RATE); const n = [...etfs]; const l = n[i].lots ? [...n[i].lots!] : []; l.push({ id: Date.now().toString(), date: newLot.date, shares: s, price: p, fee }); const ts = l.reduce((a, b) => a + b.shares, 0); const tc = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0); n[i] = { ...n[i], lots: l, shares: ts, costPrice: Number((ts ? tc / ts : 0).toFixed(2)) }; setEtfs(n); setNewLot({ ...newLot, shares: '', price: '' }); };
  const removeLot = (i: number, lid: string) => { const n = [...etfs]; const l = n[i].lots!.filter(x => x.id !== lid); const ts = l.reduce((a, b) => a + b.shares, 0); const tc = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0); n[i] = { ...n[i], lots: l, shares: ts, costPrice: Number((ts ? tc / ts : 0).toFixed(2)) }; setEtfs(n); };
  const updateLoan = (i: number, f: keyof Loan, v: any) => { const n = [...loans]; if (f === 'startDate' && v) { const s = new Date(v), now = new Date(); let m = (now.getFullYear() - s.getFullYear()) * 12 - s.getMonth() + now.getMonth(); n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, m) }; } else { n[i] = { ...n[i], [f]: v }; } setLoans(n); };

  if (isInitializing) return <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /><p className="ml-4 text-slate-400">正在同步雲端資料...</p></div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      
      {showSettings && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg p-6"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5"/> 設定</h3><div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-xs mb-4"><p className="text-emerald-300 font-bold">雲端同步已開啟</p><p className="text-slate-400">資料安全同步中</p></div><button onClick={() => setShowSettings(false)} className="w-full py-2 bg-slate-700 rounded hover:bg-slate-600 text-white">關閉</button></div></div>)}
      {showHelp && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-xl p-6"><h3 className="text-xl font-bold mb-4">功能說明</h3><ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm"><li><strong>資產雷達：</strong> 五維度分析您的投資組合健康度。</li><li><strong>滾雪球預測：</strong> 模擬未來 10 年資產與股息增長。</li><li><strong>FIRE 進度：</strong> 計算被動收入覆蓋總支出的比例。</li></ul><button onClick={() => setShowHelp(false)} className="mt-4 w-full py-2 bg-slate-700 rounded hover:bg-slate-600">關閉</button></div></div>)}

      <header className="mb-8 border-b border-slate-700 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2"><Calculator className="w-8 h-8" /> 包租唐資產配置模型</h1>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
             <p className="text-slate-400 hidden sm:block">Python 級高精度運算 • 2025 稅務引擎 • 家族辦公室級儀表板</p>
             <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs shadow-sm">{saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin text-amber-400" /><span className="text-amber-400">儲存中...</span></>}{saveStatus === 'saved' && <><Cloud className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">已同步</span></>}{saveStatus === 'error' && <><AlertTriangle className="w-3 h-3 text-red-400" /><span className="text-red-400">同步失敗</span></>}{saveStatus === 'idle' && dataSource === 'cloud' && <><Globe className="w-3 h-3 text-blue-400" /><span className="text-blue-400">雲端模式</span></>}</div>
             </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
           <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
           <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all shadow-sm hover:shadow-md"><Settings className="w-4 h-4 text-blue-400" /> 設定</button>
           <button onClick={() => setShowHelp(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all shadow-sm hover:shadow-md"><HelpCircle className="w-4 h-4 text-amber-400" /> 說明</button>
           <button onClick={handleSmartMerge} className="flex items-center gap-2 px-3 py-2 bg-purple-900/50 hover:bg-purple-800 border border-purple-500/50 rounded-lg text-sm text-purple-300 transition-all shadow-sm hover:shadow-md group"><Zap className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" /> 補全預設</button>
           <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all shadow-sm hover:shadow-md"><Upload className="w-4 h-4 text-blue-400" /> 匯入</button>
           <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all shadow-sm hover:shadow-md"><Download className="w-4 h-4 text-emerald-400" /> 匯出</button>
           <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-red-900/30 border border-slate-600 hover:border-red-500 rounded-lg text-sm transition-all shadow-sm hover:shadow-md group"><RotateCcw className="w-4 h-4 text-red-400 group-hover:rotate-180 transition-transform duration-500" /> 重置</button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* LEFT COLUMN */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* ★★★ NEW: Wealth Radar ★★★ */}
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
             <div className="text-center text-xs text-slate-400">分數越高代表該面向越強健</div>
          </section>

          {/* Allocation Section */}
          <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-purple-500"></div>
             <h2 className="text-xl font-semibold mb-4 text-blue-300 flex items-center gap-2"><PieIcon className="w-5 h-5" /> 資金分配規劃</h2>
             <div className="mb-4"><label className="text-xs text-slate-400 block mb-1">總可用資金 (台幣)</label><div className="relative"><DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" /><input type="number" value={allocation.totalFunds} onChange={(e) => setAllocation({...allocation, totalFunds: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-9 pr-4 py-2 text-xl font-bold text-white focus:border-blue-500 outline-none" placeholder="0"/></div></div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
               <div className="h-40 flex justify-center items-center bg-slate-900/30 rounded-xl">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">
                          {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}/>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (<div className="text-xs text-slate-500">尚無持倉數據</div>)}
               </div>
               <div className="space-y-3 bg-slate-900/50 rounded-xl p-3 border border-slate-700/50">
                 <div><div className="flex justify-between text-xs mb-1"><span className="text-emerald-300 font-bold">配息型</span><input type="number" value={allocation.dividendRatio} onChange={e => setAllocation({...allocation, dividendRatio: Number(e.target.value)})} className="w-10 bg-transparent border-b border-slate-600 text-right focus:border-emerald-500 outline-none" /></div><div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-emerald-900/50" style={{width: `${allocation.dividendRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-emerald-500" style={{width: `${Math.min(100, (actualDividend / allocation.totalFunds) * 100)}%`}}></div></div><div className="flex justify-between text-[10px]"><span className="text-slate-400">實: {formatMoney(actualDividend)}</span><span className={`font-mono ${actualDividend < targetDividend ? 'text-red-400' : 'text-emerald-400'}`}>{actualDividend < targetDividend ? `缺 ${formatMoney(targetDividend - actualDividend)}` : '已達標'}</span></div></div>
                 <div><div className="flex justify-between text-xs mb-1"><span className="text-amber-300 font-bold">避險型</span><input type="number" value={allocation.hedgingRatio} onChange={e => setAllocation({...allocation, hedgingRatio: Number(e.target.value)})} className="w-10 bg-transparent border-b border-slate-600 text-right focus:border-amber-500 outline-none" /></div><div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-amber-900/50" style={{width: `${allocation.hedgingRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-amber-500" style={{width: `${Math.min(100, (actualHedging / allocation.totalFunds) * 100)}%`}}></div></div><div className="flex justify-between text-[10px]"><span className="text-slate-400">實: {formatMoney(actualHedging)}</span><span className={`font-mono ${actualHedging < targetHedging ? 'text-red-400' : 'text-emerald-400'}`}>{actualHedging < targetHedging ? `缺 ${formatMoney(targetHedging - actualHedging)}` : '已達標'}</span></div></div>
                 <div><div className="flex justify-between text-xs mb-1"><span className="text-purple-300 font-bold">主動型</span><input type="number" value={allocation.activeRatio} onChange={e => setAllocation({...allocation, activeRatio: Number(e.target.value)})} className="w-10 bg-transparent border-b border-slate-600 text-right focus:border-purple-500 outline-none" /></div><div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-purple-900/50" style={{width: `${allocation.activeRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-purple-500" style={{width: `${Math.min(100, (actualActive / allocation.totalFunds) * 100)}%`}}></div></div><div className="flex justify-between text-[10px]"><span className="text-slate-400">實: {formatMoney(actualActive)}</span><span className={`font-mono ${actualActive < targetActive ? 'text-red-400' : 'text-emerald-400'}`}>{actualActive < targetActive ? `缺 ${formatMoney(targetActive - actualActive)}` : '已達標'}</span></div></div>
               </div>
             </div>
          </section>

          {/* ETF Input */}
          <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-emerald-300 flex items-center gap-2"><Activity className="w-5 h-5" /> 資產配置 (ETF)</h2>
             <div className="space-y-4">
              {etfs.map((etf, idx) => {
                const hasLots = etf.lots && etf.lots.length > 0;
                const isExpanded = expandedEtfId === etf.id;
                const isBuying = activeBuyId === etf.id;
                const isPerPeriod = etf.dividendType === 'per_period';
                const isHedging = etf.category === 'hedging';
                const yoc = etf.costPrice > 0 ? (etf.dividendPerShare * (isPerPeriod && etf.payMonths.length ? etf.payMonths.length : 1)) / etf.costPrice * 100 : 0;

                return (
                  <div key={etf.id} className={`p-4 bg-slate-900 rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group ${isHedging ? 'border-amber-500/50 hover:shadow-amber-900/20' : 'border-slate-700 hover:shadow-emerald-900/20 hover:border-emerald-500/50'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative group/edit">
                            <input type="text" value={etf.name} onChange={(e) => updateEtf(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-500 focus:border-emerald-500 outline-none w-28 md:w-36 transition-all focus:bg-slate-800/50 px-1 rounded" />
                            <Edit3 className="w-3 h-3 text-slate-600 absolute -right-4 top-1.5 opacity-0 group-hover/edit:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                        <select value={etf.category || 'dividend'} onChange={(e) => updateEtf(idx, 'category', e.target.value)} className={`text-[10px] px-1 py-0.5 rounded border outline-none cursor-pointer appearance-none ${etf.category === 'dividend' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30' : etf.category === 'hedging' ? 'bg-amber-900/30 text-amber-300 border-amber-500/30' : 'bg-purple-900/30 text-purple-300 border-purple-500/30'}`}>
                            <option value="dividend" className="bg-slate-800 text-emerald-400">配息型</option>
                            <option value="hedging" className="bg-slate-800 text-amber-400">避險型</option>
                            <option value="active" className="bg-slate-800 text-purple-400">主動型</option>
                        </select>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => toggleBuy(etf.id)} className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${isBuying ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-emerald-400 hover:bg-slate-700'}`}><ShoppingCart className="w-3 h-3" /> 買入</button>
                        <button onClick={() => toggleLots(etf.id)} className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${hasLots ? 'bg-slate-700 border-slate-500 text-slate-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}><List className="w-3 h-3" /> {isExpanded ? '隱藏' : '明細'}</button>
                        <button onClick={() => removeEtf(etf.id)} className="text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-900 hover:bg-red-900/10 transition-colors"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                    {isBuying && (<div className="mb-3 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl animate-in fade-in slide-in-from-top-2"><h4 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-2"><ShoppingCart className="w-3 h-3" /> 新增買入紀錄</h4><div className="grid grid-cols-3 gap-2 mb-2"><div><label className="text-[10px] text-slate-400 block mb-1">日期</label><input type="date" value={buyForm.date} onChange={e => setBuyForm({...buyForm, date: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div><div><label className="text-[10px] text-slate-400 block mb-1">{isHedging ? '重量 (克/兩)' : '股數'}</label><input type="number" placeholder="0" value={buyForm.shares} onChange={e => setBuyForm({...buyForm, shares: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div><div><label className="text-[10px] text-slate-400 block mb-1">單價</label><input type="number" placeholder="0" value={buyForm.price} onChange={e => setBuyForm({...buyForm, price: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div></div><button onClick={() => submitBuy(idx)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors font-bold"><CheckCircle2 className="w-3 h-3" /> 確認買入</button></div>)}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                      <div><label className="text-xs text-slate-500 block">{isHedging ? '持有重量 (克)' : '持有股數'}</label><input type="number" value={etf.shares} onChange={(e) => updateEtf(idx, 'shares', Number(e.target.value))} disabled={hasLots} className={`w-full bg-slate-800 border rounded-lg px-2 py-1 text-sm ${hasLots ? 'border-slate-700 text-slate-400 cursor-not-allowed' : 'border-slate-600'}`} /></div>
                      <div><label className="text-xs text-slate-500 block">平均成本</label><input type="number" value={etf.costPrice} onChange={(e) => updateEtf(idx, 'costPrice', Number(e.target.value))} disabled={hasLots} className={`w-full bg-slate-800 border rounded-lg px-2 py-1 text-sm ${hasLots ? 'border-slate-700 text-slate-400 cursor-not-allowed' : 'border-slate-600'}`} />{!isHedging && etf.costPrice > 0 && <div className="text-[9px] text-slate-400 mt-0.5">成本殖利率: <span className="text-amber-400 font-bold">{yoc.toFixed(1)}%</span></div>}</div>
                      <div className="relative group/tooltip"><div className="flex justify-between items-center mb-1"><button onClick={() => toggleEtfDividendType(idx)} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 w-full"><ArrowRightLeft className="w-3 h-3" />{isPerPeriod ? '單次配息' : '年化總配息'}</button></div><input type="number" value={etf.dividendPerShare} onChange={(e) => updateEtf(idx, 'dividendPerShare', Number(e.target.value))} disabled={isHedging} className={`w-full bg-slate-800 border rounded-lg px-2 py-1 text-sm ${isHedging ? 'border-slate-700 text-slate-500 cursor-not-allowed' : isPerPeriod ? 'border-blue-500 text-blue-300' : 'border-slate-600'}`} /></div>
                      <div><label className="text-xs text-slate-500 block">現價</label><input type="number" value={etf.currentPrice} onChange={(e) => updateEtf(idx, 'currentPrice', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50"><div><label className="text-[10px] text-blue-300 block flex items-center gap-1"><Layers className="w-3 h-3"/> 融資買進 (Margin)</label><input type="number" value={etf.marginLoanAmount || 0} onChange={(e) => updateEtf(idx, 'marginLoanAmount', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div><div><label className="text-[10px] text-blue-300 block">融資利率 (%)</label><input type="number" value={etf.marginInterestRate || 0} onChange={(e) => updateEtf(idx, 'marginInterestRate', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div></div>
                    <div className="mb-2 mt-1 flex gap-1 flex-wrap">{Array.from({length: 12}, (_, i) => i + 1).map(month => (<button key={month} onClick={() => toggleEtfPayMonth(idx, month)} className={`w-6 h-6 rounded-full text-[10px] flex items-center justify-center transition-all ${etf.payMonths.includes(month) ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/20' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}`}>{month}</button>))}</div>
                    {isExpanded && (<div className="mt-3 pt-3 border-t border-slate-700 bg-slate-800/50 rounded-xl p-2 animate-in fade-in slide-in-from-top-2"><h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-2"><List className="w-3 h-3" /> 交易紀錄</h4>{etf.lots && etf.lots.length > 0 ? (<div className="space-y-1 mb-3"><div className="grid grid-cols-4 text-[10px] text-slate-500 px-1"><span>日期</span><span className="text-right">股數</span><span className="text-right">單價(費)</span><span className="text-center">操作</span></div>{etf.lots.map(lot => (<div key={lot.id} className="grid grid-cols-4 items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs hover:border-slate-500 transition-colors"><span className="text-slate-300">{lot.date}</span><span className="text-right text-emerald-300 font-mono">{lot.shares}</span><div className="text-right"><span className="text-amber-300 font-mono">{lot.price}</span>{lot.fee !== undefined && (<span className="text-[9px] text-slate-500 block">(+{lot.fee})</span>)}</div><div className="text-center"><button onClick={() => removeLot(idx, lot.id)} className="p-1 hover:bg-red-900/50 rounded text-red-400"><Trash2 className="w-3 h-3" /></button></div></div>))}</div>) : (<div className="text-center text-xs text-slate-500 py-2 mb-2 italic">尚無交易紀錄，請於下方新增</div>)}<div className="flex gap-2 items-end bg-slate-900 p-2 rounded-lg border border-slate-700"><div className="flex-1"><label className="text-[10px] text-slate-500 block mb-1">日期</label><input type="date" value={newLot.date} onChange={e => setNewLot({...newLot, date: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs" /></div><div className="flex-1"><label className="text-[10px] text-slate-500 block mb-1">股數</label><input type="number" placeholder="0" value={newLot.shares} onChange={e => setNewLot({...newLot, shares: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs" /></div><div className="flex-1"><label className="text-[10px] text-slate-500 block mb-1">單價</label><input type="number" placeholder="0" value={newLot.price} onChange={e => setNewLot({...newLot, price: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs" /></div><button onClick={() => addLot(idx)} className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded h-[26px] flex items-center justify-center w-8"><Plus className="w-4 h-4" /></button></div></div>)}
                  </div>
                );
              })}
              <button onClick={addEtf} className="w-full py-3 bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-white hover:border-emerald-500 hover:bg-slate-800/80 transition-all flex items-center justify-center gap-2 group"><div className="bg-slate-700 group-hover:bg-emerald-600 rounded-full p-1 transition-colors"><Plus className="w-4 h-4 text-white" /></div><span className="font-bold">新增自選投資標的</span></button>
            </div>
          </section>

          {/* Mortgage & Tax Inputs */}
          <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-red-300 flex items-center gap-2"><DollarSign className="w-5 h-5" /> 房貸配置</h2>
            <div className="space-y-4">{loans.map((loan, idx) => (<div key={loan.id} className="p-4 bg-slate-900 rounded-xl border border-slate-700"><div className="flex justify-between items-center mb-2"><span className="font-bold text-white">{loan.name}</span><select value={loan.type} onChange={(e) => updateLoan(idx, 'type', e.target.value)} className="bg-slate-800 text-xs border border-slate-600 rounded px-1 text-slate-300"><option value={MortgageType.PrincipalAndInterest}>設定: 本息</option><option value={MortgageType.Principal}>設定: 本金</option></select></div><div className="space-y-2"><div className="grid grid-cols-3 gap-2"><div className="col-span-1"><label className="text-xs text-slate-500">本金</label><input type="number" value={loan.principal} onChange={(e) => updateLoan(idx, 'principal', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div><div className="col-span-2"><label className="text-xs text-emerald-400 block flex items-center gap-1 font-bold"><Calendar className="w-3 h-3"/> 核貸日期</label><input type="date" value={loan.startDate || ''} onChange={(e) => updateLoan(idx, 'startDate', e.target.value)} className="w-full bg-slate-800 border border-emerald-600/50 rounded-lg px-2 py-1 text-sm text-white" /></div></div><div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-slate-500">總期數</label><input type="number" value={loan.totalMonths} onChange={(e) => updateLoan(idx, 'totalMonths', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div><div><label className="text-xs text-slate-500">已繳</label><input type="number" value={loan.paidMonths} onChange={(e) => updateLoan(idx, 'paidMonths', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-sm" disabled={!!loan.startDate} /></div></div><div><label className="text-xs text-slate-500">寬限期</label><input type="number" value={loan.gracePeriod} onChange={(e) => updateLoan(idx, 'gracePeriod', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div><div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 grid grid-cols-3 gap-2"><div><label className="text-[10px] text-slate-400">利率1</label><input type="number" value={loan.rate1} onChange={(e) => updateLoan(idx, 'rate1', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div><div><label className="text-[10px] text-slate-400">期間1</label><input type="number" value={loan.rate1Months} onChange={(e) => updateLoan(idx, 'rate1Months', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div><div><label className="text-[10px] text-slate-400">利率2</label><input type="number" value={loan.rate2} onChange={(e) => updateLoan(idx, 'rate2', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div></div></div></div>))}</div>
          </section>

          {/* Tax & Living Section */}
           <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
             <h2 className="text-xl font-semibold mb-4 text-purple-300 flex items-center gap-2"><Wallet className="w-5 h-5" /> 稅務與生活</h2>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-900/20 hover:border-purple-500/50">
               <div className="grid grid-cols-2 gap-3">
                   <div><label className="text-xs text-slate-400">薪資所得</label><input type="number" value={taxStatus.salaryIncome} onChange={(e) => setTaxStatus({...taxStatus, salaryIncome: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                   <div><label className="text-xs text-slate-400">扶養人數</label><input type="number" value={taxStatus.dependents} onChange={(e) => setTaxStatus({...taxStatus, dependents: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
               </div>
               <div className="mt-3"><label className="text-xs text-slate-400 flex items-center gap-1"><Coffee className="w-3 h-3"/> 每月生活費預估 (家庭)</label><input type="number" value={taxStatus.livingExpenses || 0} onChange={(e) => setTaxStatus({...taxStatus, livingExpenses: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white" placeholder="輸入每月生活開銷" /></div>
                <div className="flex gap-4 mt-3 pt-3 border-t border-slate-800"><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={taxStatus.hasSpouse} onChange={(e) => setTaxStatus({...taxStatus, hasSpouse: e.target.checked})} className="accent-emerald-500"/> 配偶</label><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={taxStatus.isDisabled} onChange={(e) => setTaxStatus({...taxStatus, isDisabled: e.target.checked})} className="accent-emerald-500"/> 身心障礙</label></div>
            </div>
           </section>

        </div>

        {/* OUTPUT SECTION (RIGHT COLUMN) */}
        <div className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-xl">
              <div className="text-slate-400 text-xs uppercase tracking-wider">年度淨現金部位</div>
              <div className={`text-2xl font-bold ${yearlyNetPosition.isNegative() ? 'text-red-400' : 'text-emerald-400'}`}>{formatMoney(yearlyNetPosition)}</div>
            </div>
            
            {/* ★★★ NEW: FIRE Progress Card ★★★ */}
            <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-orange-500 shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden group">
              <div className="text-slate-400 text-xs uppercase tracking-wider flex items-center gap-1 z-10 relative"><Flame className="w-3 h-3 text-orange-400"/> FIRE 自由度</div>
              <div className={`text-2xl font-bold z-10 relative ${fireMetrics.ratio >= 100 ? 'text-orange-400' : 'text-white'}`}>{fireMetrics.ratio.toFixed(1)}%</div>
              <div className="text-[10px] text-slate-500 mt-1 z-10 relative">被動: {formatMoney(fireMetrics.annualPassive)} / 支出: {formatMoney(fireMetrics.annualExpenses)}</div>
              {/* Progress Bar Background */}
              <div className="absolute bottom-0 left-0 h-1.5 bg-orange-900/30 w-full">
                  <div className="h-full bg-gradient-to-r from-orange-600 to-yellow-400" style={{width: `${Math.min(100, fireMetrics.ratio)}%`}}></div>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-blue-500 shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-xl">
              <div className="text-slate-400 text-xs uppercase tracking-wider">資產總市值</div>
              <div className="text-2xl font-bold text-blue-400">{formatMoney(totalMarketValue)}</div>
              <div className={`text-xs mt-1 ${unrealizedPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>損益: {unrealizedPL >= 0 ? '+' : ''}{formatMoney(unrealizedPL)}</div>
            </div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-purple-500 shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-xl">
              <div className="text-slate-400 text-xs uppercase tracking-wider">預估稅負</div>
              <div className="text-2xl font-bold text-purple-400">{formatMoney(healthInsuranceTotal.plus(incomeTaxTotal))}</div>
              <div className="text-xs text-slate-500 mt-1">健保: {formatMoney(healthInsuranceTotal)} | 稅: {formatMoney(incomeTaxTotal)}</div>
            </div>
          </div>
          
          {breakevenTip && (<div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-start gap-4 shadow-lg animate-in fade-in slide-in-from-bottom-2"><div className="bg-yellow-500/20 p-2 rounded-full"><Lightbulb className="w-6 h-6 text-yellow-400" /></div><div><h4 className="font-bold text-white mb-1">現金流優化建議 (轉虧為盈)</h4><p className="text-sm text-slate-400 leading-relaxed">目前年度現金流短缺 <span className="text-red-400 font-bold">{formatMoney(breakevenTip.deficit)}</span>。以您目前配息型標的平均殖利率 <span className="text-emerald-400 font-bold">{breakevenTip.avgYield}%</span> 計算，建議再投入本金約 <span className="text-blue-400 font-bold text-lg">{formatMoney(breakevenTip.neededCapital)}</span> 即可達成現金流平衡。</p></div></div>)}

          {/* ★★★ NEW: Snowball Projection Chart ★★★ */}
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-400" /> 十年財富滾雪球預測</h3>
                 <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1 border border-slate-700">
                     <button onClick={() => setReinvest(false)} className={`px-3 py-1 rounded text-xs transition-colors ${!reinvest ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>花掉股息</button>
                     <button onClick={() => setReinvest(true)} className={`px-3 py-1 rounded text-xs transition-colors ${reinvest ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>複利投入</button>
                 </div>
             </div>
             <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={snowballData}>
                    <defs>
                      <linearGradient id="colorWealth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="year" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }} formatter={(val: number) => formatMoney(val)} />
                    <Legend />
                    <Area type="monotone" dataKey="wealth" name="總資產" stroke="#818cf8" fillOpacity={1} fill="url(#colorWealth)" />
                    <Area type="monotone" dataKey="income" name="年被動收入" stroke="#34d399" fillOpacity={1} fill="url(#colorIncome)" />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
             <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-400" /> 每月收支行事曆 (收入 vs 支出)</h3>
             <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }} formatter={(val: number) => formatMoney(val)} />
                    <Legend />
                    <Bar dataKey="income" name="總收入 (股息)" fill="#10b981" barSize={20} />
                    <Bar dataKey="expense" name="總支出 (房貸+生活)" fill="#ef4444" barSize={20} />
                    <Line type="monotone" dataKey="net" name="淨現金流" stroke="#3b82f6" strokeWidth={2} dot={{r:3}} />
                  </ComposedChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg overflow-x-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-blue-400" /> 現金流明細</h3>
             <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900">
                   <tr><th className="px-3 py-3">月</th><th className="px-3 py-3 text-right text-emerald-400">股息</th><th className="px-3 py-3 text-right text-red-400">房貸</th><th className="px-3 py-3 text-right text-orange-400">生活費</th><th className="px-3 py-3 text-right text-purple-400">稅負</th><th className="px-3 py-3 text-right font-bold">淨流</th></tr>
                </thead>
                <tbody>
                   {monthlyFlows.map((row) => (
                      <tr key={row.month} className="border-b border-slate-700 hover:bg-slate-750">
                         <td className="px-3 py-2">{row.month}</td>
                         <td className="px-3 py-2 text-right text-emerald-400">{row.dividendInflow > 0 ? formatMoney(row.dividendInflow) : '-'}</td>
                         <td className="px-3 py-2 text-right text-red-400">{formatMoney(row.loanOutflow)}</td>
                         <td className="px-3 py-2 text-right text-orange-400">{row.livingExpenses > 0 ? formatMoney(row.livingExpenses) : '-'}</td>
                         <td className="px-3 py-2 text-right text-purple-400">{row.taxWithheld > 0 ? formatMoney(row.taxWithheld) : '-'}</td>
                         <td className={`px-3 py-2 text-right font-bold ${row.netFlow < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatMoney(row.netFlow)}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
             <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-400" /> 壓力測試</h3>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-900">
                     <tr><th className="px-4 py-3">跌幅</th><th className="px-4 py-3">股價剩餘%</th><th className="px-4 py-3">剩餘市值</th><th className="px-4 py-3">維持率</th><th className="px-4 py-3">狀態</th><th className="px-4 py-3 text-right">追繳金額</th></tr>
                  </thead>
                  <tbody>
                     {stressTestResults.map((row) => (
                        <tr key={row.dropRate} className={`border-b border-slate-700 ${row.isMarginCall ? 'bg-red-900/20' : ''}`}>
                           <td className="px-4 py-2 font-bold">{row.dropRate}%</td>
                           <td className="px-4 py-2">{row.stockPricePercentage.toFixed(0)}%</td>
                           <td className="px-4 py-2">{formatMoney(row.totalMarketValue)}</td>
                           <td className={`px-4 py-2 font-bold ${row.maintenanceRate < 130 ? 'text-red-500' : 'text-emerald-400'}`}>{row.maintenanceRate.toFixed(2)}%</td>
                           <td className="px-4 py-2">{row.isMarginCall ? (<span className="flex items-center gap-1 text-red-500 font-bold text-xs uppercase"><AlertTriangle className="w-3 h-3" /> 追繳</span>) : (<span className="text-emerald-500 text-xs uppercase">安全</span>)}</td>
                           <td className="px-4 py-2 text-right">{row.isMarginCall ? formatMoney(row.marginCallAmount) : '-'}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
