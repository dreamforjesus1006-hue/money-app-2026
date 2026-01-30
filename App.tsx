import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area } from 'recharts';
import { INITIAL_ETFS, INITIAL_LOANS, INITIAL_STOCK_LOAN, INITIAL_CREDIT_LOAN, INITIAL_TAX_STATUS, INITIAL_GLOBAL_MARGIN_LOAN, INITIAL_ALLOCATION } from './constants';
import { ETF, Loan, StockLoan, CreditLoan, TaxStatus, AppState, CloudConfig, AllocationConfig } from './types';
import { PortfolioCalculator } from './PortfolioCalculator';
import { StorageService } from './storage';
import { formatMoney } from './decimal';
import { Calculator, DollarSign, Wallet, Activity, Save, Upload, Download, RotateCcw, Settings, Globe, Cloud, Loader2, Target, Lightbulb, Zap, TrendingUp, RefreshCw, Gift, PieChart as PieIcon, Banknote, Flame } from 'lucide-react';

// ★★★ Import Components ★★★
import { FinanceControl } from './components/FinanceControl';
import { AssetList } from './components/AssetList';
import { GameHUD } from './components/GameHUD';

interface ExtendedCloudConfig extends CloudConfig {
    priceSourceUrl?: string;
}

const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#8b5cf6', cash: '#334155' };
const QUOTES = ["「別人恐懼我貪婪。」— 巴菲特", "「長期而言，股市是稱重機。」", "「不要虧損。」", "「複利是世界第八大奇蹟。」"];

const App: React.FC = () => {
  // State
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [showLoot, setShowLoot] = useState(false);
  const [lootQuote, setLootQuote] = useState('');
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [reinvest, setReinvest] = useState(true);
  
  const [cloudConfig, setCloudConfig] = useState<ExtendedCloudConfig>({ apiKey: '', projectId: 'baozutang-finance', syncId: 'tony1006', enabled: true, priceSourceUrl: '' });
  const [etfs, setEtfs] = useState<ETF[]>(INITIAL_ETFS);
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [stockLoan, setStockLoan] = useState<StockLoan>(INITIAL_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(INITIAL_GLOBAL_MARGIN_LOAN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(INITIAL_CREDIT_LOAN);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(INITIAL_TAX_STATUS);
  const [allocation, setAllocation] = useState<AllocationConfig>(INITIAL_ALLOCATION);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Init & Save Effects
  useEffect(() => {
    const initData = async () => {
      try {
        const savedConfig = StorageService.loadCloudConfig();
        if (savedConfig) setCloudConfig(prev => ({ ...prev, ...savedConfig }));
        const result = await StorageService.loadData();
        if (result.data) {
          const { etfs, loans, stockLoan, globalMarginLoan, creditLoan, taxStatus, allocation } = result.data;
          setEtfs((etfs || INITIAL_ETFS).map(e => ({ ...e, category: e.category || 'dividend', code: e.code || e.id })));
          let mergedLoans = loans || INITIAL_LOANS; if (mergedLoans.length < INITIAL_LOANS.length) mergedLoans = [...mergedLoans, INITIAL_LOANS[1]]; setLoans(mergedLoans);
          setStockLoan(stockLoan || INITIAL_STOCK_LOAN); setGlobalMarginLoan(globalMarginLoan || INITIAL_GLOBAL_MARGIN_LOAN);
          setCreditLoan(creditLoan || INITIAL_CREDIT_LOAN); setTaxStatus({ ...INITIAL_TAX_STATUS, ...taxStatus });
          setAllocation(allocation || INITIAL_ALLOCATION);
        }
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

  // Handlers
  const handleUpdatePrices = async () => {
      if (!cloudConfig.priceSourceUrl) { alert('請先設定 Google Sheet 連結！'); setShowSettings(true); return; }
      setIsUpdatingPrices(true);
      try {
          const res = await fetch(cloudConfig.priceSourceUrl);
          const text = await res.text();
          const rows = text.split('\n').map(r => r.split(','));
          const map = new Map<string, number>();
          rows.forEach(r => { if(r.length>=2) { const code=r[0].replace(/['"\r]/g,'').trim(); const p=parseFloat(r[1].replace(/['"\r]/g,'').trim()); if(code&&!isNaN(p)) map.set(code, p); }});
          let count = 0;
          setEtfs(etfs.map(e => { const targetCode = e.code || e.id; const newPrice = map.get(targetCode); if(newPrice!==undefined) { count++; return {...e, currentPrice: newPrice}; } return e; }));
          alert(`更新 ${count} 個標的！`);
      } catch { alert('更新失敗'); } finally { setIsUpdatingPrices(false); }
  };
  const handleSmartMerge = () => { const items = INITIAL_ETFS.filter(e => !new Set(etfs.map(e => e.id)).has(e.id)); if (items.length && confirm(`補入 ${items.length} 個預設？`)) setEtfs([...etfs, ...items]); };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=(ev)=>{ try{ const s=JSON.parse(ev.target?.result as string) as AppState; if(s.etfs){ setEtfs(s.etfs); setLoans(s.loans||[]); setStockLoan(s.stockLoan||INITIAL_STOCK_LOAN); setGlobalMarginLoan(s.globalMarginLoan||INITIAL_GLOBAL_MARGIN_LOAN); setCreditLoan(s.creditLoan||INITIAL_CREDIT_LOAN); setTaxStatus(s.taxStatus||INITIAL_TAX_STATUS); setAllocation(s.allocation||INITIAL_ALLOCATION); alert('成功'); } }catch{alert('錯誤');}}; r.readAsText(f); e.target.value=''; };
  const handleExport = () => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation });
  const handleReset = () => { if(confirm('重置？')) { setEtfs(INITIAL_ETFS); setLoans(INITIAL_LOANS); window.location.reload(); }};
  const openLootBox = () => { setLootQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]); setShowLoot(true); };
  const updateLoan = (i: number, f: keyof Loan, v: any) => { const n = [...loans]; if (f === 'startDate' && v) { const s = new Date(v), now = new Date(); let m = (now.getFullYear() - s.getFullYear()) * 12 - s.getMonth() + now.getMonth(); n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, m) }; } else { n[i] = { ...n[i], [f]: v }; } setLoans(n); };

  // Calculations
  const totalMarketValue = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * etf.currentPrice), 0), [etfs]);
  const totalCost = useMemo(() => etfs.reduce((acc, etf) => acc + (etf.shares * (etf.costPrice || 0)), 0), [etfs]);
  const unrealizedPL = totalMarketValue - totalCost;
  const totalStockDebt = stockLoan.principal + globalMarginLoan.principal + etfs.reduce((acc, e) => acc + (e.marginLoanAmount || 0), 0);
  const totalRealDebt = loans.reduce((acc, l) => acc + l.principal, 0) + creditLoan.principal;
  const currentMaintenance = useMemo(() => totalStockDebt === 0 ? 999 : (totalMarketValue / totalStockDebt) * 100, [totalMarketValue, totalStockDebt]);
  const { monthlyFlows, yearlyNetPosition, healthInsuranceTotal, incomeTaxTotal } = useMemo(() => PortfolioCalculator.generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);
  const fireMetrics = useMemo(() => { const exp = monthlyFlows.reduce((a,c)=>a+c.loanOutflow+c.creditLoanOutflow+c.livingExpenses,0); const inc = monthlyFlows.reduce((a,c)=>a+c.dividendInflow,0); return { ratio: exp>0?(inc/exp)*100:0, annualPassive: inc, annualExpenses: exp }; }, [monthlyFlows]);
  const combatPower = useMemo(() => Math.floor((totalMarketValue/10000) + (fireMetrics.annualPassive/12/100)), [totalMarketValue, fireMetrics]);
  const levelInfo = useMemo(() => { const r = fireMetrics.ratio; if(r>=100) return {title:'財富國王 👑', color:'text-yellow-400', bar:'bg-gradient-to-r from-yellow-400 to-orange-500', next:null}; if(r>=50) return {title:'資產領主 ⚔️', color:'text-purple-400', bar:'bg-gradient-to-r from-purple-500 to-pink-500', next:100}; if(r>=20) return {title:'理財騎士 🛡️', color:'text-blue-400', bar:'bg-gradient-to-r from-blue-400 to-cyan-400', next:50}; return {title:'初心冒險者 🪵', color:'text-slate-400', bar:'bg-slate-600', next:20}; }, [fireMetrics]);
  const skills = useMemo(() => { 
      const actualHedging = etfs.filter(e => e.category === 'hedging').reduce((a,c)=>a+c.shares*c.currentPrice,0);
      return [
        { name: '股息水流斬', level: Math.floor(Math.min(100, (fireMetrics.annualPassive/500000)*100)), icon: <RefreshCw className="w-4 h-4"/>, color:'text-emerald-400', bar:'bg-emerald-500' },
        { name: '絕對防禦', level: Math.floor(Math.min(100, (actualHedging/(totalMarketValue||1))*500)), icon: <ShieldCheck className="w-4 h-4"/>, color:'text-amber-400', bar:'bg-amber-500' },
        { name: '槓桿爆發', level: Math.floor(Math.min(100, (totalStockDebt/5000000)*100)), icon: <Zap className="w-4 h-4"/>, color:'text-blue-400', bar:'bg-blue-500' },
        { name: '資本增幅', level: Math.floor(Math.min(100, (unrealizedPL/1000000)*100)), icon: <TrendingUp className="w-4 h-4"/>, color:'text-purple-400', bar:'bg-purple-500' }
      ];
  }, [fireMetrics, etfs, totalMarketValue, totalStockDebt, unrealizedPL]);
  
  // Charts
  const targetDividend = Math.floor(allocation.totalFunds * (allocation.dividendRatio / 100));
  const targetHedging = Math.floor(allocation.totalFunds * (allocation.hedgingRatio / 100));
  const targetActive = Math.floor(allocation.totalFunds * (allocation.activeRatio / 100));
  const actualDividend = useMemo(() => etfs.filter(e => e.category === 'dividend').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualHedging = useMemo(() => etfs.filter(e => e.category === 'hedging').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const actualActive = useMemo(() => etfs.filter(e => e.category === 'active').reduce((acc, e) => acc + (e.shares * e.currentPrice), 0), [etfs]);
  const pieData = [{ name: '配息型', value: actualDividend, color: COLORS.dividend }, { name: '避險型', value: actualHedging, color: COLORS.hedging }, { name: '主動型', value: actualActive, color: COLORS.active }].filter(d => d.value > 0);
  const remainingFunds = allocation.totalFunds - (actualDividend + actualHedging + actualActive);
  const monthlyChartData = useMemo(() => monthlyFlows.map(f => ({ month: `${f.month}月`, income: f.dividendInflow, expense: f.loanOutflow + f.creditLoanOutflow + f.stockLoanInterest + f.livingExpenses + f.taxWithheld, net: f.netFlow })), [monthlyFlows]);
  const snowballData = useMemo(() => { const avgYield = totalMarketValue > 0 ? fireMetrics.annualPassive / totalMarketValue : 0.05; const annualSavings = yearlyNetPosition.toNumber() > 0 ? yearlyNetPosition.toNumber() : 0; const data = []; let currentWealth = totalMarketValue; let currentIncome = fireMetrics.annualPassive; for (let year = 0; year <= 10; year++) { data.push({ year: `Y${year}`, wealth: Math.floor(currentWealth), income: Math.floor(currentIncome) }); currentWealth = currentWealth * 1.05 + (reinvest ? currentIncome : 0) + annualSavings; currentIncome = currentWealth * avgYield; } return data; }, [monthlyFlows, totalMarketValue, yearlyNetPosition, reinvest, fireMetrics]);

  if (isInitializing) return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /><p className="ml-4 text-slate-400 font-mono">系統啟動中...</p></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Settings Modal */}
      {showSettings && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg p-6"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5"/> 系統設定</h3><div className="space-y-4"><div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-xs flex gap-2"><Cloud className="w-4 h-4 text-emerald-400 shrink-0"/> <div><p className="text-emerald-300 font-bold">雲端同步 Online</p><p className="text-slate-400">數據已安全加密</p></div></div><div><label className="block text-xs text-slate-400 mb-1">行情資料來源 (Google Sheet CSV)</label><input type="text" placeholder="https://docs.google.com/..." value={cloudConfig.priceSourceUrl || ''} onChange={(e) => setCloudConfig({...cloudConfig, priceSourceUrl: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none transition-colors" /></div></div><button onClick={() => setShowSettings(false)} className="w-full py-2 mt-4 bg-slate-800 hover:bg-slate-700 rounded text-white text-sm transition-colors">確認</button></div></div>)}
      {/* Loot Box */}
      {showLoot && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in" onClick={() => setShowLoot(false)}><div className="bg-gradient-to-br from-yellow-900/90 to-slate-900 border-2 border-yellow-500/50 rounded-2xl p-8 max-w-md text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] transform animate-in zoom-in-95 duration-300"><Gift className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-bounce" /><h3 className="text-2xl font-bold text-yellow-100 mb-2">每日寶箱開啟！</h3><p className="text-lg text-yellow-300 font-serif italic">"{lootQuote}"</p><p className="text-xs text-slate-400 mt-6">(點擊任意處關閉)</p></div></div>)}

      {/* Header */}
      <header className="mb-8 border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 flex items-center gap-2 filter drop-shadow-lg tracking-tight"><Calculator className="w-8 h-8 text-emerald-400" /> 資產戰情室 <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">PRO</span></h1><p className="text-slate-400 text-xs mt-1 flex items-center gap-2 font-mono"><Target className="w-3 h-3 text-red-400" /> 目標：財務自由 FIRE</p></div>
        <div className="flex flex-wrap gap-2"><input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" /><button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg text-sm text-slate-300 transition-all"><Settings className="w-4 h-4" /></button><button onClick={openLootBox} className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 hover:from-yellow-800/50 border border-yellow-500/30 rounded-lg text-sm text-yellow-200 transition-all group"><Gift className="w-4 h-4 group-hover:scale-110 transition-transform" /> 每日寶箱</button><button onClick={handleUpdatePrices} disabled={isUpdatingPrices} className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 hover:bg-blue-800/50 border border-blue-500/30 rounded-lg text-sm text-blue-300 transition-all group">{isUpdatingPrices ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />} 更新行情</button><button onClick={handleSmartMerge} className="flex items-center gap-2 px-3 py-2 bg-purple-900/30 hover:bg-purple-800/50 border border-purple-500/30 rounded-lg text-sm text-purple-300 transition-all"><Zap className="w-4 h-4" /> 補全裝備</button><button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg text-sm text-slate-300 transition-all"><Download className="w-4 h-4" /> 存檔</button></div>
      </header>

      {/* Game HUD Component */}
      <GameHUD combatPower={combatPower} levelInfo={levelInfo} fireRatio={fireMetrics.ratio} currentMaintenance={currentMaintenance} totalMarketValue={totalMarketValue} totalDebt={totalStockDebt+totalRealDebt} skills={skills} annualPassiveIncome={fireMetrics.annualPassive} hasHedging={actualHedging>0} hasLeverage={totalStockDebt>0} netWorthPositive={totalMarketValue>(totalStockDebt+totalRealDebt)} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
          {/* Allocation */}
          <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden"><h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><PieIcon className="w-5 h-5 text-blue-400" /> 資源配置</h2><div className="mb-4"><label className="text-xs text-slate-400 block mb-1">總資金 (Total Cap)</label><div className="relative"><DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" /><input type="number" value={allocation.totalFunds} onChange={(e) => setAllocation({...allocation, totalFunds: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xl font-bold text-white focus:border-blue-500 outline-none" placeholder="0"/></div><div className={`text-[10px] mt-1 text-right ${remainingFunds >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{remainingFunds >= 0 ? `尚未配置資金: ${formatMoney(remainingFunds)}` : `⚠️ 超出預算: ${formatMoney(Math.abs(remainingFunds))}`}</div></div><div className="grid grid-cols-1 gap-4"><div className="h-40 flex justify-center items-center bg-slate-950/50 rounded-xl"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}</Pie><Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}/></PieChart></ResponsiveContainer></div><div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800"><div><div className="flex justify-between text-xs mb-1"><span className="text-emerald-400 font-bold">配息型</span><div className="flex items-center gap-1"><input type="number" value={allocation.dividendRatio} onChange={e => setAllocation({...allocation, dividendRatio: Number(e.target.value)})} className="w-8 bg-transparent text-right outline-none text-emerald-400 border-b border-emerald-900" /><span className="text-slate-500">%</span></div></div><div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-emerald-900/50" style={{width: `${allocation.dividendRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-emerald-500" style={{width: `${Math.min(100, (actualDividend/allocation.totalFunds)*100)}%`}}></div></div><div className="flex justify-between text-[10px] text-slate-500"><span>實: {formatMoney(actualDividend)}</span><span className={actualDividend < targetDividend ? 'text-red-400' : 'text-emerald-500'}>{actualDividend < targetDividend ? `缺 ${formatMoney(targetDividend - actualDividend)}` : '已達標'}</span></div></div><div><div className="flex justify-between text-xs mb-1"><span className="text-amber-400 font-bold">避險型</span><div className="flex items-center gap-1"><input type="number" value={allocation.hedgingRatio} onChange={e => setAllocation({...allocation, hedgingRatio: Number(e.target.value)})} className="w-8 bg-transparent text-right outline-none text-amber-400 border-b border-amber-900" /><span className="text-slate-500">%</span></div></div><div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-amber-900/50" style={{width: `${allocation.hedgingRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-amber-500" style={{width: `${Math.min(100, (actualHedging/allocation.totalFunds)*100)}%`}}></div></div><div className="flex justify-between text-[10px] text-slate-500"><span>實: {formatMoney(actualHedging)}</span><span className={actualHedging < targetHedging ? 'text-red-400' : 'text-emerald-500'}>{actualHedging < targetHedging ? `缺 ${formatMoney(targetHedging - actualHedging)}` : '已達標'}</span></div></div><div><div className="flex justify-between text-xs mb-1"><span className="text-purple-400 font-bold">主動型</span><div className="flex items-center gap-1"><input type="number" value={allocation.activeRatio} onChange={e => setAllocation({...allocation, activeRatio: Number(e.target.value)})} className="w-8 bg-transparent text-right outline-none text-purple-400 border-b border-purple-900" /><span className="text-slate-500">%</span></div></div><div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1"><div className="absolute top-0 left-0 h-full bg-purple-900/50" style={{width: `${allocation.activeRatio}%`}}></div><div className="absolute top-0 left-0 h-full bg-purple-500" style={{width: `${Math.min(100, (actualActive/allocation.totalFunds)*100)}%`}}></div></div><div className="flex justify-between text-[10px] text-slate-500"><span>實: {formatMoney(actualActive)}</span><span className={actualActive < targetActive ? 'text-red-400' : 'text-emerald-500'}>{actualActive < targetActive ? `缺 ${formatMoney(targetActive - actualActive)}` : '已達標'}</span></div></div></div></div></section>
          
          {/* Asset List Component */}
          <AssetList etfs={etfs} setEtfs={setEtfs} />
          
          {/* Finance Control Component */}
          <FinanceControl loans={loans} stockLoan={stockLoan} globalMarginLoan={globalMarginLoan} creditLoan={creditLoan} taxStatus={taxStatus} updateLoan={updateLoan} setStockLoan={setStockLoan} setGlobalMarginLoan={setGlobalMarginLoan} setCreditLoan={setCreditLoan} setTaxStatus={setTaxStatus} />
        </div>

        <div className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute right-0 top-0 p-3 opacity-10"><DollarSign className="w-12 h-12"/></div><div className="text-slate-500 text-xs uppercase tracking-wider">年度淨現金流</div><div className={`text-2xl font-black ${yearlyNetPosition.isNegative() ? 'text-red-400' : 'text-emerald-400'}`}>{formatMoney(yearlyNetPosition)}</div></div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute right-0 top-0 p-3 opacity-10"><Banknote className="w-12 h-12"/></div><div className="text-slate-500 text-xs uppercase tracking-wider">總資產市值</div><div className="text-2xl font-black text-blue-400">{formatMoney(totalMarketValue)}</div><div className={`text-[10px] ${unrealizedPL>=0?'text-emerald-500':'text-red-500'}`}>損益 {formatMoney(unrealizedPL)}</div></div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute right-0 top-0 p-3 opacity-10"><Flame className="w-12 h-12"/></div><div className="text-slate-500 text-xs uppercase tracking-wider">FIRE 自由度</div><div className="text-2xl font-black text-orange-400">{fireMetrics.ratio.toFixed(1)}%</div><div className="text-[10px] text-slate-500">被動收入 {formatMoney(fireMetrics.annualPassive)}</div></div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute right-0 top-0 p-3 opacity-10"><Wallet className="w-12 h-12"/></div><div className="text-slate-500 text-xs uppercase tracking-wider">預估稅負</div><div className="text-2xl font-black text-purple-400">{formatMoney(healthInsuranceTotal.plus(incomeTaxTotal))}</div></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg"><h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-400"/> 十年財富滾雪球</h3><div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={snowballData}><defs><linearGradient id="cw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="year" stroke="#475569" tick={{fontSize:10}} /><YAxis stroke="#475569" tick={{fontSize:10}} /><Tooltip formatter={(v:number)=>formatMoney(v)} contentStyle={{backgroundColor:'#0f172a', border:'none'}}/ ><Area type="monotone" dataKey="wealth" stroke="#3b82f6" fill="url(#cw)" /></AreaChart></ResponsiveContainer></div></div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg"><h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-purple-400"/> 月度收支表</h3><div className="h-48"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={monthlyChartData}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="month" stroke="#475569" tick={{fontSize:10}} /><YAxis stroke="#475569" tick={{fontSize:10}} /><Tooltip formatter={(v:number)=>formatMoney(v)} contentStyle={{backgroundColor:'#0f172a', border:'none'}} /><Bar dataKey="income" fill="#10b981" /><Bar dataKey="expense" fill="#ef4444" /><Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div></div>
          </div>
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg overflow-x-auto"><h3 className="text-sm font-bold text-slate-300 mb-4">📜 現金流明細卷軸</h3><table className="w-full text-xs text-left text-slate-400"><thead className="text-[10px] uppercase bg-slate-950 text-slate-500"><tr><th className="p-2">月</th><th className="p-2 text-right">股息</th><th className="p-2 text-right">房貸</th><th className="p-2 text-right">信貸</th><th className="p-2 text-right">股貸</th><th className="p-2 text-right">生活</th><th className="p-2 text-right">稅負</th><th className="p-2 text-right">淨流</th></tr></thead><tbody>{monthlyFlows.map(r=><tr key={r.month} className="border-b border-slate-800 hover:bg-slate-800/50"><td className="p-2">{r.month}</td><td className="p-2 text-right text-emerald-400">{formatMoney(r.dividendInflow)}</td><td className="p-2 text-right text-red-400">{formatMoney(r.loanOutflow)}</td><td className="p-2 text-right text-orange-400">{formatMoney(r.creditLoanOutflow)}</td><td className="p-2 text-right text-blue-400">{formatMoney(r.stockLoanInterest)}</td><td className="p-2 text-right text-slate-400">{formatMoney(r.livingExpenses)}</td><td className="p-2 text-right text-purple-400">{formatMoney(r.taxWithheld)}</td><td className={`p-2 text-right font-bold ${r.netFlow<0?'text-red-500':'text-emerald-500'}`}>{formatMoney(r.netFlow)}</td></tr>)}</tbody></table></div>
          {/* Achievement Hall moved to GameHUD but kept here as fallback or secondary view if needed, but GameHUD handles it */}
        </div>
      </div>
    </div>
  );
};

export default App;
