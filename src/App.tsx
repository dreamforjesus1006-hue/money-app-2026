import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Calculator, DollarSign, Wallet, Activity, Save, Upload, Download, RotateCcw, Settings, Globe, Cloud, Loader2, Target, Zap, TrendingUp, RefreshCw, Gift, PieChart as PieIcon, Banknote, Flame, Share2, Scale, ShieldCheck, Swords, Coins, Skull, Gem, Scroll, Sparkles, Lock, Aperture, List, Trash2, X, Tag, ShoppingCart, Coffee, Layers, Crown, Trophy, Calendar, Lightbulb, CheckCircle2, HelpCircle, Edit3, ArrowRightLeft, Plus } from 'lucide-react';

// ==========================================
// 1. 核心定義 (Original Full Version)
// ==========================================

const BROKERAGE_RATE = 0.001425;
const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#a855f7', cash: '#334155' };

const MortgageType = {
  PrincipalAndInterest: 'PrincipalAndInterest',
  Principal: 'Principal'
};

// 介面定義
interface Lot { id: string; date: string; shares: number; price: number; fee?: number; margin?: number; }
interface ETF { id: string; code?: string; name: string; shares: number; costPrice: number; currentPrice: number; dividendPerShare: number; dividendType?: 'annual' | 'per_period'; payMonths?: number[]; category: 'dividend' | 'hedging' | 'active'; marginLoanAmount?: number; marginInterestRate?: number; lots?: Lot[]; }
interface Loan { id: string; name: string; principal: number; rate1: number; rate1Months: number; rate2: number; totalMonths: number; paidMonths: number; gracePeriod: number; startDate?: string; type: string; }
interface StockLoan { principal: number; rate: number; maintenanceLimit?: number; }
interface CreditLoan { principal: number; rate: number; totalMonths: number; paidMonths: number; }
interface TaxStatus { salaryIncome: number; livingExpenses: number; dependents: number; hasSpouse: boolean; isDisabled: boolean; }
interface AllocationConfig { totalFunds: number; dividendRatio: number; hedgingRatio: number; activeRatio: number; }
interface CloudConfig { apiKey: string; projectId: string; syncId: string; enabled: boolean; priceSourceUrl?: string; }
interface AppState { etfs: ETF[]; loans: Loan[]; stockLoan: StockLoan; globalMarginLoan: StockLoan; creditLoan: CreditLoan; taxStatus: TaxStatus; allocation: AllocationConfig; collection?: {id:string, count:number}[]; tokens?: number; }

// 預設資料
const INITIAL_ETFS: ETF[] = [
  { id: '1', code: '0056', name: '元大高股息', shares: 0, costPrice: 0, currentPrice: 38.5, dividendPerShare: 2.8, dividendType: 'per_period', payMonths: [1, 4, 7, 10], category: 'dividend', marginLoanAmount: 0 },
  { id: '2', code: '00919', name: '群益精選高息', shares: 0, costPrice: 0, currentPrice: 26.2, dividendPerShare: 2.4, dividendType: 'per_period', payMonths: [3, 6, 9, 12], category: 'dividend', marginLoanAmount: 0 },
];
const INITIAL_LOANS: Loan[] = [{ id: 'l1', name: '房貸一', principal: 0, rate1: 2.06, rate1Months: 24, rate2: 2.15, totalMonths: 360, paidMonths: 0, gracePeriod: 36, type: 'PrincipalAndInterest' }];
const INITIAL_STOCK_LOAN: StockLoan = { principal: 0, rate: 2.5, maintenanceLimit: 130 };
const INITIAL_GLOBAL_MARGIN_LOAN: StockLoan = { principal: 0, rate: 6.5 };
const INITIAL_CREDIT_LOAN: CreditLoan = { principal: 0, rate: 2.8, totalMonths: 84, paidMonths: 0 };
const INITIAL_TAX_STATUS: TaxStatus = { salaryIncome: 0, livingExpenses: 30000, dependents: 0, hasSpouse: false, isDisabled: false };
const INITIAL_ALLOCATION: AllocationConfig = { totalFunds: 0, dividendRatio: 70, hedgingRatio: 20, activeRatio: 10 };

const THEMES = {
    default: { name: '冒險者', color: 'emerald', bg: 'from-emerald-900', border: 'border-emerald-500', text: 'text-emerald-400', icon: <Zap className="w-4 h-4"/> },
};

const GACHA_ITEMS = [
    { id: 'g1', name: '巴菲特的眼鏡', rarity: 'SR', icon: '👓', desc: '看透市場本質' },
    { id: 'g2', name: '蒙格的格柵', rarity: 'SSR', icon: '🏗️', desc: '多元思維模型' },
    { id: 'g3', name: '科斯托蘭尼之狗', rarity: 'R', icon: '🐕', desc: '主人與狗的牽絆' },
    { id: 'g4', name: '約翰伯格的方舟', rarity: 'UR', icon: '⛵', desc: '指數投資終極載具' },
    { id: 'g5', name: '索羅斯的煉金石', rarity: 'SSR', icon: '🔮', desc: '反身性理論' },
    { id: 'g6', name: '存錢小豬', rarity: 'N', icon: '🐷', desc: '積少成多' },
];

// 工具函數
const formatMoney = (val: any) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '$0';
  return `$${Math.floor(Number(val)).toLocaleString()}`;
};

// 計算邏輯
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
        (etfs || []).forEach(etf => { if (etf.payMonths?.includes(m)) dividendInflow += (etf.shares * etf.dividendPerShare); });
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
const STORAGE_KEY = 'baozutang_data_v27_restored'; 
const CLOUD_CONFIG_KEY = 'baozutang_cloud_config';
const StorageService = {
    saveData: async (data: any) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; } },
    loadData: async () => { try { const local = localStorage.getItem(STORAGE_KEY); return { data: local ? JSON.parse(local) : null, source: 'local' }; } catch (e) { return { data: null, source: 'local' }; } },
    saveCloudConfig: (config: any) => { localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config)); },
    loadCloudConfig: () => { const c = localStorage.getItem(CLOUD_CONFIG_KEY); return c ? JSON.parse(c) : null; },
    getStorageUsage: () => ({ used: 0, total: 5242880 }), // Mock
    loadFromLocal: () => null, // Mock
    exportToFile: (data: any) => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `baozutang_backup.json`; a.click(); }
};

// --- App 主程式 ---
const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dataSource, setDataSource] = useState<'local' | 'cloud' | 'gas'>('local');
  
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Init
  useEffect(() => {
    const initData = async () => {
      try {
        const result = await StorageService.loadData();
        if (result.data) {
          const { etfs, loans, stockLoan, globalMarginLoan, creditLoan, taxStatus, allocation, collection: c, tokens: t } = result.data as any;
          setEtfs(Array.isArray(etfs) ? etfs : INITIAL_ETFS);
          setLoans(Array.isArray(loans) ? loans : INITIAL_LOANS);
          setStockLoan(stockLoan || INITIAL_STOCK_LOAN); 
          setGlobalMarginLoan(globalMarginLoan || INITIAL_GLOBAL_MARGIN_LOAN);
          setCreditLoan(creditLoan || INITIAL_CREDIT_LOAN); 
          setTaxStatus(taxStatus ? { ...INITIAL_TAX_STATUS, ...taxStatus } : INITIAL_TAX_STATUS);
          setAllocation(allocation || INITIAL_ALLOCATION);
          setCollection(Array.isArray(c) ? c : []); 
          setTokens(typeof t === 'number' ? t : 5);
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
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
      } catch { setSaveStatus('error'); }
    }, 1000); return () => clearTimeout(timer);
  }, [etfs, loans, stockLoan, creditLoan, taxStatus, globalMarginLoan, allocation, collection, tokens, isInitializing]);

  // Calculations
  const totalMarketValue = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * etf.currentPrice), 0), [etfs]);
  const totalStockDebt = stockLoan.principal + globalMarginLoan.principal + etfs.reduce((acc, e) => acc + (e.marginLoanAmount || 0), 0);
  const totalRealDebt = loans.reduce((acc, l) => acc + l.principal, 0) + creditLoan.principal;
  const currentMaintenance = useMemo(() => totalStockDebt === 0 ? 999 : (totalMarketValue / totalStockDebt) * 100, [totalMarketValue, totalStockDebt]);
  const unrealizedPL = totalMarketValue - etfs.reduce((acc, e) => acc + (e.shares * e.costPrice), 0);

  const { monthlyFlows, yearlyNetPosition, healthInsuranceTotal, incomeTaxTotal } = useMemo(() => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);
  const fireMetrics = useMemo(() => { const exp = monthlyFlows.reduce((a,c)=>a+c.loanOutflow+c.creditLoanOutflow+c.livingExpenses,0); const inc = monthlyFlows.reduce((a,c)=>a+c.dividendInflow,0); return { ratio: exp>0?(inc/exp)*100:0, annualPassive: inc, annualExpenses: exp }; }, [monthlyFlows]);
  const combatPower = useMemo(() => Math.floor((totalMarketValue/10000) + (fireMetrics.annualPassive/12/100)), [totalMarketValue, fireMetrics]);
  const levelInfo = useMemo(() => { const r = fireMetrics.ratio; if(r>=100) return {title:'財富國王 👑', color:'text-yellow-400'}; if(r>=50) return {title:'資產領主 ⚔️', color:'text-purple-400'}; if(r>=20) return {title:'理財騎士 🛡️', color:'text-blue-400'}; return {title:'初心冒險者 🪵', color:'text-slate-400'}; }, [fireMetrics]);
  
  // Radar Data
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

  // Allocation Logic
  const actualDividend = useMemo(() => etfs.filter(e => e.category === 'dividend').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualHedging = useMemo(() => etfs.filter(e => e.category === 'hedging').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualActive = useMemo(() => etfs.filter(e => e.category === 'active').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const pieData = [{ name: '配息型', value: actualDividend, color: COLORS.dividend }, { name: '避險型', value: actualHedging, color: COLORS.hedging }, { name: '主動型', value: actualActive, color: COLORS.active }].filter(d => d.value > 0);
  const isAllocationValid = (allocation.dividendRatio + allocation.hedgingRatio + allocation.activeRatio) === 100;

  // Breakeven Tip
  const breakevenTip = useMemo(() => {
     if (yearlyNetPosition >= 0) return null;
     const deficit = Math.abs(yearlyNetPosition);
     const avgYield = 0.06; // Default assumption
     return { deficit, avgYield: avgYield*100, neededCapital: deficit / avgYield };
  }, [yearlyNetPosition]);

  // Snowball Data
  const snowballData = useMemo(() => { 
      const avgYield = totalMarketValue > 0 ? fireMetrics.annualPassive / totalMarketValue : 0.05; 
      const annualSavings = Number(yearlyNetPosition) || 0; 
      const data = []; 
      let currentWealth = totalMarketValue; 
      let currentIncome = fireMetrics.annualPassive; 
      for (let year = 0; year <= 10; year++) { 
          data.push({ year: `Y${year}`, wealth: Math.floor(currentWealth), income: Math.floor(currentIncome) }); 
          currentWealth = currentWealth * 1.05 + currentIncome + annualSavings; 
          currentIncome = currentWealth * avgYield; 
      } 
      return data; 
  }, [monthlyFlows, totalMarketValue, yearlyNetPosition, fireMetrics]);

  // Handlers
  const updateEtf = (i: number, f: keyof ETF, v: any) => { const n = [...etfs]; n[i] = { ...n[i], [f]: v }; setEtfs(n); };
  const addEtf = () => setEtfs([...etfs, { id: Date.now().toString(), name: '自選標的', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'annual', payMonths: [], marginLoanAmount: 0, marginInterestRate: 0, lots: [], category: 'dividend' }]);
  const removeEtf = (id: string) => { if (window.confirm('確定刪除？')) setEtfs(etfs.filter(e => e.id !== id)); };
  const toggleEtfDividendType = (index: number) => { const newEtfs = [...etfs]; newEtfs[index].dividendType = newEtfs[index].dividendType === 'annual' ? 'per_period' : 'annual'; setEtfs(newEtfs); };
  const toggleEtfPayMonth = (index: number, month: number) => { const etf = etfs[index]; const ms = etf.payMonths?.includes(month) ? etf.payMonths.filter(m => m !== month) : [...(etf.payMonths || []), month].sort((a, b) => a - b); updateEtf(index, 'payMonths', ms); };
  
  const updateLoan = (i: number, f: keyof Loan, v: any) => { const n = [...loans]; if (f === 'startDate' && v) { const s = new Date(v), now = new Date(); let m = (now.getFullYear() - s.getFullYear()) * 12 - s.getMonth() + now.getMonth(); n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, m) }; } else { n[i] = { ...n[i], [f]: v }; } setLoans(n); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=(ev)=>{ try{ const s=JSON.parse(ev.target?.result as string) as AppState; if(s.etfs){ setEtfs(s.etfs); setLoans(s.loans||[]); setStockLoan(s.stockLoan||INITIAL_STOCK_LOAN); setGlobalMarginLoan(s.globalMarginLoan||INITIAL_GLOBAL_MARGIN_LOAN); setCreditLoan(s.creditLoan||INITIAL_CREDIT_LOAN); setTaxStatus(s.taxStatus||INITIAL_TAX_STATUS); setAllocation(s.allocation||INITIAL_ALLOCATION); alert('成功'); } }catch{alert('錯誤');}}; r.readAsText(f); e.target.value=''; };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleReset = () => { if(confirm('確定重置?')) { localStorage.clear(); window.location.reload(); }};
  const handleExport = () => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation });

  // Buy Logic
  const toggleBuy = (id: string) => { setActiveBuyId(activeBuyId === id ? null : id); };
  const toggleLots = (id: string) => { setExpandedEtfId(expandedEtfId === id ? null : id); };
  const submitBuy = (i: number) => {
    const s = Number(buyForm.shares), p = Number(buyForm.price), m = Number(buyForm.margin); if (!s || !p) return;
    const n = [...etfs]; const l = n[i].lots ? [...n[i].lots!] : [];
    l.push({ id: Date.now().toString(), date: buyForm.date, shares: s, price: p, fee: Math.floor(s*p*BROKERAGE_RATE), margin: m });
    const ts = l.reduce((a, b) => a + b.shares, 0); const tc = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0);
    n[i] = { ...n[i], lots: l, shares: ts, costPrice: Number((ts ? tc / ts : 0).toFixed(2)) };
    setEtfs(n); setBuyForm({ ...buyForm, shares: '', price: '', margin: '' }); setActiveBuyId(null);
  };
  const removeLot = (i: number, lid: string) => {
    const n = [...etfs]; const l = n[i].lots!.filter(x => x.id !== lid);
    const ts = l.reduce((a, b) => a + b.shares, 0); const tc = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0);
    n[i] = { ...n[i], lots: l, shares: ts, costPrice: Number((ts ? tc / ts : 0).toFixed(2)) };
    setEtfs(n);
  };
  
  // Gacha Logic
  const handleGacha = () => {
    if (tokens < 1) return;
    setTokens(t => t - 1);
    const item = GACHA_ITEMS[Math.floor(Math.random() * GACHA_ITEMS.length)];
    setGachaResult(item);
    setCollection(prev => { const ex = prev.find(p => p.id === item.id); return ex ? prev.map(p => p.id === item.id ? {...p, count: p.count + 1} : p) : [...prev, {id: item.id, count: 1}]; });
  };

  const [reinvest, setReinvest] = useState(true); // Added for Snowball

  if (isInitializing) return <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /><p className="ml-4 text-slate-400">正在同步雲端資料...</p></div>;

  return (
    <div className={`min-h-screen p-4 md:p-8 font-sans bg-slate-900 text-white selection:bg-emerald-500/30`}>
      {/* Modals */}
      {gachaResult && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setGachaResult(null)}><div className="bg-slate-900 border border-yellow-500 p-8 rounded-2xl text-center animate-in zoom-in shadow-[0_0_50px_rgba(234,179,8,0.5)]"><div className="text-6xl mb-4 animate-bounce">{gachaResult.icon}</div><div className="text-2xl font-bold text-yellow-400 mb-2">{gachaResult.name}</div><div className="inline-block px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 border border-slate-700">{gachaResult.rarity}</div><p className="text-slate-500 mt-6 text-sm">(點擊任意處關閉)</p></div></div>)}
      {showSettings && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg p-6"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5"/> 設定</h3><div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-xs mb-4"><p className="text-emerald-300 font-bold">雲端同步已開啟</p></div><button onClick={() => setShowSettings(false)} className="w-full py-2 bg-slate-700 rounded hover:bg-slate-600 text-white">關閉</button></div></div>)}
      {showHelp && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-xl p-6"><h3 className="text-xl font-bold mb-4">功能說明</h3><ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm"><li><strong>資產雷達：</strong> 五維度分析您的投資組合健康度。</li><li><strong>滾雪球預測：</strong> 模擬未來 10 年資產與股息增長。</li></ul><button onClick={() => setShowHelp(false)} className="mt-4 w-full py-2 bg-slate-700 rounded hover:bg-slate-600">關閉</button></div></div>)}

      {/* Header */}
      <header className="mb-8 border-b border-slate-700 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2"><Calculator className="w-8 h-8" /> 包租唐戰情室 <span className="text-xs bg-emerald-900/50 text-emerald-200 px-2 py-0.5 rounded border border-emerald-500/30">V27 Restored</span></h1>
           <div className="flex items-center gap-4 mt-2"><div className="flex gap-2"><div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs shadow-sm">{saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin text-amber-400" /><span className="text-amber-400">儲存中...</span></>}{saveStatus === 'saved' && <><Cloud className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">已同步</span></>}</div></div></div>
        </div>
        <div className="flex flex-wrap gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all"><Settings className="w-4 h-4 text-blue-400" /> 設定</button>
            <button onClick={() => setShowHelp(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all"><HelpCircle className="w-4 h-4 text-amber-400" /> 說明</button>
            <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all"><Upload className="w-4 h-4 text-blue-400" /> 匯入</button>
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all"><Download className="w-4 h-4 text-emerald-400" /> 匯出</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-red-900/30 border border-slate-600 hover:border-red-500 rounded-lg text-sm transition-all group"><RotateCcw className="w-4 h-4 text-red-400 group-hover:rotate-180 transition-transform duration-500" /> 重置</button>
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

            {/* Allocation */}
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
                {/* Allocation Inputs */}
                <div className="space-y-3 bg-slate-900/50 rounded-xl p-3 border border-slate-700/50">
                    <div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-emerald-300 font-bold">配息型</span><input type="number" value={allocation.dividendRatio} onChange={e => setAllocation({...allocation, dividendRatio: Number(e.target.value)})} className="w-10 bg-transparent border-b border-slate-600 text-right focus:border-emerald-500 outline-none" /></div>
                        <div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden"><div className="absolute top-0 left-0 h-full bg-emerald-900/50" style={{width: `${allocation.dividendRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-emerald-500" style={{width: `${Math.min(100, (actualDividend / allocation.totalFunds) * 100)}%`}}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-amber-300 font-bold">避險型</span><input type="number" value={allocation.hedgingRatio} onChange={e => setAllocation({...allocation, hedgingRatio: Number(e.target.value)})} className="w-10 bg-transparent border-b border-slate-600 text-right focus:border-amber-500 outline-none" /></div>
                        <div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden"><div className="absolute top-0 left-0 h-full bg-amber-900/50" style={{width: `${allocation.hedgingRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-amber-500" style={{width: `${Math.min(100, (actualHedging / allocation.totalFunds) * 100)}%`}}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-purple-300 font-bold">主動型</span><input type="number" value={allocation.activeRatio} onChange={e => setAllocation({...allocation, activeRatio: Number(e.target.value)})} className="w-10 bg-transparent border-b border-slate-600 text-right focus:border-purple-500 outline-none" /></div>
                        <div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden"><div className="absolute top-0 left-0 h-full bg-purple-900/50" style={{width: `${allocation.activeRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-purple-500" style={{width: `${Math.min(100, (actualActive / allocation.totalFunds) * 100)}%`}}></div></div>
                    </div>
                    {!isAllocationValid && <div className="text-center text-xs text-red-400 mt-2">⚠️ 比例總和非 100%</div>}
                </div>
            </section>

            {/* Asset List */}
            <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
                <h2 className="text-xl font-semibold mb-4 text-emerald-300 flex items-center gap-2"><Activity className="w-5 h-5" /> 資產配置 (ETF)</h2>
                <div className="space-y-4">
                    {etfs.map((etf, idx) => {
                        const hasLots = etf.lots && etf.lots.length > 0;
                        const isExpanded = expandedEtfId === etf.id;
                        const isBuying = activeBuyId === etf.id;
                        const isPerPeriod = etf.dividendType === 'per_period';
                        const yoc = etf.costPrice > 0 ? (etf.dividendPerShare * (isPerPeriod && etf.payMonths?.length ? etf.payMonths.length : 1)) / etf.costPrice * 100 : 0;
                        return (
                            <div key={etf.id} className="p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-all">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className="relative group/edit"><input type="text" value={etf.name} onChange={(e) => updateEtf(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-500 focus:border-emerald-500 outline-none w-28 transition-all" /><Edit3 className="w-3 h-3 text-slate-600 absolute -right-4 top-1.5 opacity-0 group-hover/edit:opacity-100" /></div>
                                        <select value={etf.category || 'dividend'} onChange={(e) => updateEtf(idx, 'category', e.target.value)} className="text-[10px] bg-slate-800 border border-slate-600 rounded px-1 text-slate-300"><option value="dividend">配息型</option><option value="hedging">避險型</option><option value="active">主動型</option></select>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => toggleBuy(etf.id)} className={`text-xs px-2 py-1 rounded-lg border ${isBuying ? 'bg-emerald-600 text-white' : 'text-slate-400 border-slate-600'}`}><ShoppingCart className="w-3 h-3" /></button>
                                        <button onClick={() => toggleLots(etf.id)} className={`text-xs px-2 py-1 rounded-lg border ${hasLots ? 'bg-slate-700 text-slate-300' : 'text-slate-500 border-slate-700'}`}><List className="w-3 h-3" /></button>
                                        <button onClick={() => removeEtf(etf.id)} className="text-xs px-2 py-1 rounded-lg text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                </div>
                                {isBuying && (<div className="mb-3 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl animate-in slide-in-from-top-2"><div className="grid grid-cols-4 gap-1 mb-2"><div className="col-span-1"><input type="date" value={buyForm.date} onChange={e => setBuyForm({...buyForm, date: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div><div><input type="number" placeholder="股" value={buyForm.shares} onChange={e => setBuyForm({...buyForm, shares: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div><div><input type="number" placeholder="$" value={buyForm.price} onChange={e => setBuyForm({...buyForm, price: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div><div><input type="number" placeholder="融" value={buyForm.margin} onChange={e => setBuyForm({...buyForm, margin: e.target.value})} className="w-full bg-slate-900 border border-blue-900 rounded-lg px-2 py-1 text-xs text-blue-300" /></div></div><button onClick={() => submitBuy(idx)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg text-xs font-bold">確認買入</button></div>)}
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                    <div><label className="text-xs text-slate-500 block">股數</label><input type="number" value={etf.shares} onChange={(e) => updateEtf(idx, 'shares', Number(e.target.value))} disabled={hasLots} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                                    <div><label className="text-xs text-slate-500 block">成本</label><input type="number" value={etf.costPrice} onChange={(e) => updateEtf(idx, 'costPrice', Number(e.target.value))} disabled={hasLots} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" />{etf.costPrice > 0 && <div className="text-[9px] text-amber-400 mt-0.5">YoC: {yoc.toFixed(1)}%</div>}</div>
                                    <div><label className="text-xs text-slate-500 block">配息</label><div className="flex items-center gap-1"><input type="number" value={etf.dividendPerShare} onChange={(e) => updateEtf(idx, 'dividendPerShare', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /><button onClick={() => toggleEtfDividendType(idx)} className="text-blue-400"><ArrowRightLeft className="w-3 h-3"/></button></div></div>
                                    <div><label className="text-xs text-slate-500 block">現價</label><input type="number" value={etf.currentPrice} onChange={(e) => updateEtf(idx, 'currentPrice', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                                </div>
                                <div className="mb-2 flex gap-1 flex-wrap">{Array.from({length: 12}, (_, i) => i + 1).map(m => (<button key={m} onClick={() => toggleEtfPayMonth(idx, m)} className={`w-6 h-6 rounded-full text-[10px] flex items-center justify-center transition-all ${etf.payMonths?.includes(m) ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>{m}</button>))}</div>
                                {isExpanded && etf.lots && (<div className="mt-3 pt-3 border-t border-slate-700 bg-slate-800/50 rounded-xl p-2"><div className="space-y-1">{etf.lots.map(lot => (<div key={lot.id} className="grid grid-cols-4 items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs"><span className="text-slate-300">{lot.date}</span><span className="text-right text-emerald-300">{lot.shares}</span><div className="text-right"><span className="text-amber-300">{lot.price}</span><span className="text-[9px] text-slate-500 block">+{lot.fee}</span></div><div className="text-center"><button onClick={() => removeLot(idx, lot.id)} className="text-red-400"><Trash2 className="w-3 h-3" /></button></div></div>))}</div></div>)}
                            </div>
                        );
                    })}
                    <button onClick={addEtf} className="w-full py-2 bg-slate-800 border border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-white transition-colors">+ 新增標的</button>
                </div>
            </section>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-8 space-y-6">
             {/* HUD */}
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

             <FinanceControl loans={loans} stockLoan={stockLoan} globalMarginLoan={globalMarginLoan} creditLoan={creditLoan} taxStatus={taxStatus} updateLoan={updateLoan} setStockLoan={setStockLoan} setGlobalMarginLoan={setGlobalMarginLoan} setCreditLoan={setCreditLoan} setTaxStatus={setTaxStatus} />
        </div>
      </div>
    </div>
  );
};

export default App;
