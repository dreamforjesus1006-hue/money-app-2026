import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';
import { INITIAL_ETFS, INITIAL_LOANS, INITIAL_STOCK_LOAN, INITIAL_CREDIT_LOAN, INITIAL_TAX_STATUS, INITIAL_GLOBAL_MARGIN_LOAN } from './constants';
import { ETF, Loan, StockLoan, CreditLoan, TaxStatus, MortgageType, AppState, Lot, CloudConfig } from './types';
// ↓↓↓ 修正重點：改成大寫開頭，符合 Vercel (Linux) 檔案系統要求 ↓↓↓
import { PortfolioCalculator } from './services/PortfolioCalculator';
import { StorageService } from './services/Storage';
// ↑↑↑ 修正結束 ↑↑↑
import { formatMoney } from './utils/decimal';
import { Calculator, AlertTriangle, TrendingDown, DollarSign, Wallet, Activity, Save, Upload, Download, RotateCcw, List, Plus, Trash2, X, ChevronDown, ChevronUp, Clock, Calendar, Repeat, ArrowRightLeft, Info, Banknote, Coins, ShoppingCart, CheckCircle2, Cloud, Loader2, Layers, HelpCircle, Smartphone, Monitor, HardDrive, Database, Link as LinkIcon, Settings, Globe, Code, ExternalLink, CheckSquare } from 'lucide-react';
import Decimal from 'decimal.js';

const BROKERAGE_RATE = 0.001425; // 0.1425% standard TW rate

const App: React.FC = () => {
  // Loading States
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [storageStats, setStorageStats] = useState({ used: 0, total: 5242880 });
  const [dataSource, setDataSource] = useState<'local' | 'cloud' | 'gas'>('local');

  // Cloud Config State
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({ apiKey: '', projectId: '', syncId: '', enabled: false });
  const [pastedConfig, setPastedConfig] = useState('');

  // Data States
  const [etfs, setEtfs] = useState<ETF[]>(INITIAL_ETFS);
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [stockLoan, setStockLoan] = useState<StockLoan>(INITIAL_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(INITIAL_GLOBAL_MARGIN_LOAN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(INITIAL_CREDIT_LOAN);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(INITIAL_TAX_STATUS);
  
  // UI State
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [newLot, setNewLot] = useState<{shares: string, price: string, date: string}>({ shares: '', price: '', date: '' });
  
  // Quick Buy State
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState<{shares: string, price: string, date: string}>({ shares: '', price: '', date: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Load Effect
  useEffect(() => {
    const initData = async () => {
      try {
        // Load cloud config first
        const savedCloudConfig = StorageService.loadCloudConfig();
        if (savedCloudConfig) setCloudConfig(savedCloudConfig);

        const result = await StorageService.loadData();
        const loadedState = result.data;
        setDataSource(result.source);

        if (loadedState) {
          setEtfs(loadedState.etfs || INITIAL_ETFS);
          setLoans(loadedState.loans || INITIAL_LOANS);
          setStockLoan(loadedState.stockLoan || INITIAL_STOCK_LOAN);
          setGlobalMarginLoan(loadedState.globalMarginLoan || INITIAL_GLOBAL_MARGIN_LOAN);
          setCreditLoan(loadedState.creditLoan || INITIAL_CREDIT_LOAN);
          setTaxStatus(loadedState.taxStatus || INITIAL_TAX_STATUS);
        }
        // Check storage on load
        setStorageStats(StorageService.getStorageUsage());
      } catch (error) {
        console.error("Failed to load initial data", error);
        // Fallback to local if cloud fails
        const localData = StorageService.loadFromLocal();
        if (localData) {
            setEtfs(localData.etfs || INITIAL_ETFS);
            setLoans(localData.loans || INITIAL_LOANS);
            // ... load other parts
        }
      } finally {
        setIsInitializing(false);
      }
    };
    initData();
  }, []);

  // 2. Auto-save Effect (Debounced)
  useEffect(() => {
    if (isInitializing) return; // Don't save while loading

    setSaveStatus('saving');
    const currentState: AppState = { etfs, loans, stockLoan, creditLoan, taxStatus, globalMarginLoan };
    
    // Debounce save (Reduced to 1000ms for safer UX)
    const timer = setTimeout(async () => {
      try {
        await StorageService.saveData(currentState);
        setStorageStats(StorageService.getStorageUsage()); // Update stats after save
        setSaveStatus('saved');
        // Reset status to idle after a moment
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error("Save failed", error);
        setSaveStatus('error');
      }
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [etfs, loans, stockLoan, creditLoan, taxStatus, globalMarginLoan, isInitializing, cloudConfig]); // Add cloudConfig dependency to save when config changes

 const saveCloudSettings = () => {
    StorageService.saveCloudConfig(cloudConfig);
    // 不要自動重整，改用 alert 通知
    alert("設定已儲存！請手動關閉此視窗，並重新整理頁面以啟用雲端功能。");
    setShowSettings(false); // 順便幫你關掉設定視窗
  };

  const parsePastedConfig = (text: string) => {
    setPastedConfig(text);
    // Basic regex to find apiKey and projectId in standard JS/JSON objects
    const apiKeyMatch = text.match(/apiKey:\s*["']([^"']+)["']/);
    const projectIdMatch = text.match(/projectId:\s*["']([^"']+)["']/);

    let newConfig = { ...cloudConfig, enabled: true };
    let found = false;

    if (apiKeyMatch && apiKeyMatch[1]) {
      newConfig.apiKey = apiKeyMatch[1];
      found = true;
    }
    if (projectIdMatch && projectIdMatch[1]) {
      newConfig.projectId = projectIdMatch[1];
      found = true;
    }

    if (found) {
      setCloudConfig(newConfig);
    }
  };

  // Computed Results
  const { monthlyFlows, yearlyNetPosition, healthInsuranceTotal, incomeTaxTotal } = useMemo(() => {
    return PortfolioCalculator.generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);

  const stressTestResults = useMemo(() => {
    return PortfolioCalculator.runStressTest(etfs, stockLoan, globalMarginLoan);
  }, [etfs, stockLoan, globalMarginLoan]);

  const totalMarketValue = useMemo(() => {
      return etfs.reduce((acc, etf) => acc + (etf.shares * etf.currentPrice), 0);
  }, [etfs]);

  const totalCost = useMemo(() => {
    return etfs.reduce((acc, etf) => acc + (etf.shares * (etf.costPrice || 0)), 0);
  }, [etfs]);

  const unrealizedPL = totalMarketValue - totalCost;

  // Debt Calculations
  const totalCollateralLoan = stockLoan.principal;
  const totalGlobalMargin = globalMarginLoan.principal;
  const totalEtfMargin = useMemo(() => etfs.reduce((acc, e) => acc + (e.marginLoanAmount || 0), 0), [etfs]);
  const totalStockDebt = totalCollateralLoan + totalGlobalMargin + totalEtfMargin;

  const currentMaintenance = useMemo(() => {
     if (totalStockDebt === 0) return 999;
     return (totalMarketValue / totalStockDebt) * 100;
  }, [totalMarketValue, totalStockDebt]);

  // Handlers
  const updateEtf = (index: number, field: keyof ETF, value: any) => {
    const newEtfs = [...etfs];
    newEtfs[index] = { ...newEtfs[index], [field]: value };
    setEtfs(newEtfs);
  };

  const toggleEtfDividendType = (index: number) => {
    const newEtfs = [...etfs];
    const currentType = newEtfs[index].dividendType || 'annual';
    newEtfs[index].dividendType = currentType === 'annual' ? 'per_period' : 'annual';
    setEtfs(newEtfs);
  };

  const toggleEtfPayMonth = (index: number, month: number) => {
    const etf = etfs[index];
    const currentMonths = etf.payMonths || [];
    let newMonths: number[];
    if (currentMonths.includes(month)) {
      newMonths = currentMonths.filter(m => m !== month);
    } else {
      newMonths = [...currentMonths, month].sort((a, b) => a - b);
    }
    updateEtf(index, 'payMonths', newMonths);
  };

  const toggleLots = (id: string) => {
    if (expandedEtfId === id) {
      setExpandedEtfId(null);
    } else {
      setExpandedEtfId(id);
      setNewLot({ shares: '', price: '', date: new Date().toISOString().split('T')[0] });
    }
    if (activeBuyId === id) setActiveBuyId(null);
  };

  const toggleBuy = (id: string) => {
    if (activeBuyId === id) {
      setActiveBuyId(null);
    } else {
      setActiveBuyId(id);
      setBuyForm({ shares: '', price: '', date: new Date().toISOString().split('T')[0] });
    }
    if (expandedEtfId === id) setExpandedEtfId(null);
  };

  const submitBuy = (etfIndex: number) => {
    const s = Number(buyForm.shares);
    const p = Number(buyForm.price);
    if (!s || !p) return;

    const fee = Math.floor(s * p * BROKERAGE_RATE);

    const newEtfs = [...etfs];
    const etf = newEtfs[etfIndex];
    const lots = etf.lots ? [...etf.lots] : [];
    
    lots.push({
      id: Date.now().toString(),
      date: buyForm.date,
      shares: s,
      price: p,
      fee: fee
    });

    const totalShares = lots.reduce((acc, lot) => acc + lot.shares, 0);
    const totalCostWithFee = lots.reduce((acc, lot) => acc + (lot.shares * lot.price) + (lot.fee || 0), 0);
    const avgCost = totalShares > 0 ? totalCostWithFee / totalShares : 0;

    newEtfs[etfIndex] = {
      ...etf,
      lots,
      shares: totalShares,
      costPrice: Number(avgCost.toFixed(2))
    };

    setEtfs(newEtfs);
    setBuyForm({ ...buyForm, shares: '', price: '' });
    setActiveBuyId(null);
  };

  const addLot = (etfIndex: number) => {
    const s = Number(newLot.shares);
    const p = Number(newLot.price);
    if (!s || !p) return;

    const fee = Math.floor(s * p * BROKERAGE_RATE);
    const newEtfs = [...etfs];
    const etf = newEtfs[etfIndex];
    const lots = etf.lots ? [...etf.lots] : [];
    
    lots.push({
      id: Date.now().toString(),
      date: newLot.date,
      shares: s,
      price: p,
      fee: fee
    });

    const totalShares = lots.reduce((acc, lot) => acc + lot.shares, 0);
    const totalCostWithFee = lots.reduce((acc, lot) => acc + (lot.shares * lot.price) + (lot.fee || 0), 0);
    const avgCost = totalShares > 0 ? totalCostWithFee / totalShares : 0;

    newEtfs[etfIndex] = { ...etf, lots, shares: totalShares, costPrice: Number(avgCost.toFixed(2)) };
    setEtfs(newEtfs);
    setNewLot({ ...newLot, shares: '', price: '' });
  };

  const removeLot = (etfIndex: number, lotId: string) => {
    const newEtfs = [...etfs];
    const etf = newEtfs[etfIndex];
    if (!etf.lots) return;
    const lots = etf.lots.filter(l => l.id !== lotId);

    const totalShares = lots.reduce((acc, lot) => acc + lot.shares, 0);
    const totalCostWithFee = lots.reduce((acc, lot) => acc + (lot.shares * lot.price) + (lot.fee || 0), 0);
    const avgCost = totalShares > 0 ? totalCostWithFee / totalShares : 0;

    newEtfs[etfIndex] = { ...etf, lots, shares: totalShares, costPrice: Number(avgCost.toFixed(2)) };
    setEtfs(newEtfs);
  };

  const updateLoan = (index: number, field: keyof Loan, value: any) => {
    const newLoans = [...loans];
    const currentLoan = newLoans[index];

    if (field === 'startDate' && value) {
       const start = new Date(value);
       const now = new Date();
       let months = (now.getFullYear() - start.getFullYear()) * 12;
       months -= start.getMonth();
       months += now.getMonth();
       newLoans[index] = { ...currentLoan, startDate: value, paidMonths: Math.max(0, months) };
    } else {
       newLoans[index] = { ...currentLoan, [field]: value };
    }
    setLoans(newLoans);
  };

  const handleExport = () => {
    StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const state = JSON.parse(json) as AppState;
        
        if (state.etfs && state.loans) {
           setEtfs(state.etfs);
           setLoans(state.loans);
           setStockLoan(state.stockLoan || INITIAL_STOCK_LOAN);
           setGlobalMarginLoan(state.globalMarginLoan || INITIAL_GLOBAL_MARGIN_LOAN);
           setCreditLoan(state.creditLoan || INITIAL_CREDIT_LOAN);
           setTaxStatus(state.taxStatus || INITIAL_TAX_STATUS);
           setStorageStats(StorageService.getStorageUsage());
           alert('資料匯入成功！');
        } else {
           alert('檔案格式錯誤');
        }
      } catch (error) {
        console.error(error);
        alert('無法讀取檔案');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleReset = () => {
    if (window.confirm('確定要重置所有數據回到預設值嗎？此動作無法復原。')) {
      setEtfs(INITIAL_ETFS);
      setLoans(INITIAL_LOANS);
      setStockLoan(INITIAL_STOCK_LOAN);
      setGlobalMarginLoan(INITIAL_GLOBAL_MARGIN_LOAN);
      setCreditLoan(INITIAL_CREDIT_LOAN);
      setTaxStatus(INITIAL_TAX_STATUS);
      // Trigger save immediately to reset storage
      setTimeout(() => {
         StorageService.saveData({ etfs: INITIAL_ETFS, loans: INITIAL_LOANS, stockLoan: INITIAL_STOCK_LOAN, globalMarginLoan: INITIAL_GLOBAL_MARGIN_LOAN, creditLoan: INITIAL_CREDIT_LOAN, taxStatus: INITIAL_TAX_STATUS });
         setStorageStats(StorageService.getStorageUsage());
         window.location.reload();
      }, 100);
    }
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const storagePercentage = (storageStats.used / storageStats.total) * 100;
  const storageColor = storagePercentage > 80 ? 'text-red-400' : storagePercentage > 50 ? 'text-amber-400' : 'text-slate-400';

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          <p className="text-slate-400">正在同步雲端資料...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      
      {/* Settings Modal (Cloud Config) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-400" /> 雲端同步設定 (Firebase)
                 </h3>
                 <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                 {/* 錯誤警告區塊 */}
                 <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 text-xs mb-4">
                     <p className="font-bold text-blue-300 flex items-center gap-2 mb-3 text-sm">
                        <CheckSquare className="w-4 h-4"/> Firebase 啟用 3 步驟 (避免錯誤)
                     </p>
                     <ul className="space-y-2 text-slate-300">
                         <li className="flex items-start gap-2">
                            <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                            <span>建立新專案，點擊 <strong>&lt;/&gt;</strong> (Web) 圖示註冊應用程式，複製設定碼。</span>
                         </li>
                         <li className="flex items-start gap-2">
                            <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                            <span><strong>關鍵步驟：</strong> 左側選單點 <strong>Build &gt; Firestore Database</strong>，然後點 <strong>Create Database</strong>。</span>
                         </li>
                         <li className="flex items-start gap-2">
                            <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                            <span>安全規則選擇 <strong>Test Mode (測試模式)</strong>，地點選 <strong>asia-east1</strong> (台灣)。</span>
                         </li>
                     </ul>
                     <p className="mt-2 text-slate-400 italic">若沒做第 2、3 步，就會出現 "Permission Denied" 錯誤。</p>
                 </div>

                 <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-xs">
                    <label className="flex items-center gap-2 font-bold text-emerald-300 mb-2 cursor-pointer">
                        <Code className="w-4 h-4" /> 快速設定 (推薦)
                    </label>
                    <p className="text-slate-400 mb-2">直接把 Firebase 提供的 <code>const firebaseConfig = ...</code> 整段程式碼貼在下面，系統會自動辨識。</p>
                    <textarea 
                        value={pastedConfig}
                        onChange={(e) => parsePastedConfig(e.target.value)}
                        placeholder="在此貼上 Firebase 設定程式碼..."
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-xs font-mono text-slate-300 h-20 focus:border-emerald-500 outline-none resize-none"
                    />
                 </div>

                 <div className="pt-2 border-t border-slate-700/50">
                    <label className="text-sm font-bold text-slate-300 mb-1 block">手動設定</label>
                    <div className="flex items-center gap-3 mb-3">
                       <button 
                         onClick={() => setCloudConfig({...cloudConfig, enabled: !cloudConfig.enabled})} 
                         className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cloudConfig.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                       >
                         <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cloudConfig.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                       </button>
                       <span className="text-xs text-slate-400">{cloudConfig.enabled ? '已啟用' : '已停用 (僅本機儲存)'}</span>
                    </div>

                    <div className={`space-y-3 transition-all duration-300 ${cloudConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">API Key</label>
                            <input type="text" value={cloudConfig.apiKey} onChange={(e) => setCloudConfig({...cloudConfig, apiKey: e.target.value})} placeholder="AIzaSyD..." className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Project ID</label>
                            <input type="text" value={cloudConfig.projectId} onChange={(e) => setCloudConfig({...cloudConfig, projectId: e.target.value})} placeholder="donberich1" className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none" />
                        </div>
                        <div className="bg-blue-900/10 p-3 rounded-lg border border-blue-500/20">
                            <label className="text-xs font-bold text-blue-300 mb-1 block">同步代碼 (重要！)</label>
                            <input type="text" value={cloudConfig.syncId} onChange={(e) => setCloudConfig({...cloudConfig, syncId: e.target.value})} placeholder="例如: my-money-2025" className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none text-emerald-300 font-bold" />
                            <p className="text-[10px] text-slate-400 mt-1">請自創一組密碼，所有要同步的裝置都必須輸入完全一樣的代碼。</p>
                        </div>
                    </div>
                 </div>
              </div>
              <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end gap-2">
                 <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">取消</button>
                 <button onClick={saveCloudSettings} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center gap-2"><Save className="w-4 h-4" /> 儲存設定</button>
              </div>
           </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-emerald-400" /> 使用說明與同步教學
                 </h3>
                 <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
                 <div className="flex items-start gap-4">
                    <div className="bg-blue-500/20 p-2.5 rounded-xl"><HardDrive className="w-6 h-6 text-blue-400" /></div>
                    <div>
                       <h4 className="font-bold text-white mb-1">資料儲存機制</h4>
                       <p className="text-sm text-slate-400 leading-relaxed">
                          預設情況下，資料儲存在<strong>目前的瀏覽器</strong>中。若您設定了 Firebase 雲端同步，資料將會即時儲存至 Google 雲端。
                          <br/><span className="text-emerald-400 mt-1 block">目前模式：{dataSource === 'cloud' ? 'Google 雲端同步' : '本機瀏覽器儲存'}</span>
                       </p>
                    </div>
                 </div>
                 
                 <div className="w-full h-px bg-slate-700/50" />

                 <div className="flex items-start gap-4">
                    <div className="bg-emerald-500/20 p-2.5 rounded-xl"><Smartphone className="w-6 h-6 text-emerald-400" /></div>
                    <div>
                       <h4 className="font-bold text-white mb-1">跨裝置同步教學</h4>
                       <p className="text-sm text-slate-400 leading-relaxed mb-3">
                          想在手機和電腦間共用設定？
                       </p>
                       <ul className="list-disc list-inside text-sm text-slate-300 space-y-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                          <li><strong>方法一 (推薦)：</strong> 點擊右上角 <Settings className="w-3 h-3 inline text-blue-400"/> 設定，將 Firebase 的設定程式碼貼入「快速設定」框框。</li>
                          <li><strong>方法二 (手動)：</strong> 使用「匯出」下載檔案，再到另一台裝置「匯入」。</li>
                       </ul>
                    </div>
                 </div>
              </div>
              <div className="p-4 bg-slate-900/50 border-t border-slate-700 text-center">
                 <button onClick={() => setShowHelp(false)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg transition-colors">我瞭解了</button>
              </div>
           </div>
        </div>
      )}

      <header className="mb-8 border-b border-slate-700 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2">
            <Calculator className="w-8 h-8" />
            包租唐資產配置模型
          </h1>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
             <p className="text-slate-400 hidden sm:block">
               Python 級高精度運算 • 2025 稅務引擎 • 儲水池現金流
             </p>
             <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs shadow-sm">
                   {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin text-amber-400" /><span className="text-amber-400">儲存中...</span></>}
                   {saveStatus === 'saved' && <><Cloud className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">已同步</span></>}
                   {saveStatus === 'error' && <><AlertTriangle className="w-3 h-3 text-red-400" /><span className="text-red-400">同步失敗</span></>}
                   {saveStatus === 'idle' && dataSource === 'cloud' && <><Globe className="w-3 h-3 text-blue-400" /><span className="text-blue-400">雲端模式</span></>}
                   {saveStatus === 'idle' && dataSource !== 'cloud' && <><HardDrive className="w-3 h-3 text-slate-500" /><span className="text-slate-500">本機模式</span></>}
                </div>
                {dataSource === 'local' && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs shadow-sm">
                     <Database className={`w-3 h-3 ${storageColor}`} />
                     <span className={storageColor}>{formatBytes(storageStats.used)}</span>
                  </div>
                )}
             </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
           <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
           <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all shadow-sm hover:shadow-md"><Settings className="w-4 h-4 text-blue-400" /> 設定</button>
           <button onClick={() => setShowHelp(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all shadow-sm hover:shadow-md"><HelpCircle className="w-4 h-4 text-amber-400" /> 說明</button>
           <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all shadow-sm hover:shadow-md"><Upload className="w-4 h-4 text-blue-400" /> 匯入</button>
           <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg text-sm text-slate-300 transition-all shadow-sm hover:shadow-md"><Download className="w-4 h-4 text-emerald-400" /> 匯出</button>
           <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-red-900/30 border border-slate-600 hover:border-red-500 rounded-lg text-sm transition-all shadow-sm hover:shadow-md group"><RotateCcw className="w-4 h-4 text-red-400 group-hover:rotate-180 transition-transform duration-500" /> 重置</button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
          
          {/* ETF Input */}
          <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-emerald-300 flex items-center gap-2">
              <Activity className="w-5 h-5" /> 資產配置 (ETF)
            </h2>
            <div className="space-y-4">
              {etfs.map((etf, idx) => {
                const hasLots = etf.lots && etf.lots.length > 0;
                const isExpanded = expandedEtfId === etf.id;
                const isBuying = activeBuyId === etf.id;
                const isPerPeriod = etf.dividendType === 'per_period';

                return (
                  <div key={etf.id} className="p-4 bg-slate-900 rounded-xl border border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-900/20 hover:border-emerald-500/50 group">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white group-hover:text-emerald-300 transition-colors">{etf.name}</span>
                        {hasLots && <span className="text-[10px] bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded">自動計算</span>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => toggleBuy(etf.id)} className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${isBuying ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-emerald-400 hover:bg-slate-700'}`}><ShoppingCart className="w-3 h-3" /> 買入</button>
                        <button onClick={() => toggleLots(etf.id)} className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${hasLots ? 'bg-slate-700 border-slate-500 text-slate-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}><List className="w-3 h-3" /> {isExpanded ? '隱藏' : '明細'}</button>
                      </div>
                    </div>

                    {isBuying && (
                      <div className="mb-3 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl animate-in fade-in slide-in-from-top-2">
                          <h4 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-2"><ShoppingCart className="w-3 h-3" /> 新增買入紀錄</h4>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <div><label className="text-[10px] text-slate-400 block mb-1">日期</label><input type="date" value={buyForm.date} onChange={e => setBuyForm({...buyForm, date: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div>
                            <div><label className="text-[10px] text-slate-400 block mb-1">股數</label><input type="number" placeholder="0" value={buyForm.shares} onChange={e => setBuyForm({...buyForm, shares: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div>
                            <div><label className="text-[10px] text-slate-400 block mb-1">單價</label><input type="number" placeholder="0" value={buyForm.price} onChange={e => setBuyForm({...buyForm, price: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white" /></div>
                          </div>
                          <button onClick={() => submitBuy(idx)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors font-bold"><CheckCircle2 className="w-3 h-3" /> 確認買入 (自動計算手續費)</button>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                      <div><label className="text-xs text-slate-500 block">股數</label><input type="number" value={etf.shares} onChange={(e) => updateEtf(idx, 'shares', Number(e.target.value))} disabled={hasLots} className={`w-full bg-slate-800 border rounded-lg px-2 py-1 text-sm ${hasLots ? 'border-slate-700 text-slate-400 cursor-not-allowed' : 'border-slate-600'}`} /></div>
                      <div><label className="text-xs text-slate-500 block">持有成本</label><input type="number" value={etf.costPrice} onChange={(e) => updateEtf(idx, 'costPrice', Number(e.target.value))} disabled={hasLots} className={`w-full bg-slate-800 border rounded-lg px-2 py-1 text-sm ${hasLots ? 'border-slate-700 text-slate-400 cursor-not-allowed' : 'border-slate-600'}`} /></div>
                      <div className="relative group/tooltip">
                        <div className="flex justify-between items-center mb-1"><button onClick={() => toggleEtfDividendType(idx)} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 w-full"><ArrowRightLeft className="w-3 h-3" />{isPerPeriod ? '單次配息' : '年化總配息'}</button></div>
                        <input type="number" value={etf.dividendPerShare} onChange={(e) => updateEtf(idx, 'dividendPerShare', Number(e.target.value))} className={`w-full bg-slate-800 border rounded-lg px-2 py-1 text-sm ${isPerPeriod ? 'border-blue-500 text-blue-300' : 'border-slate-600'}`} />
                      </div>
                      <div><label className="text-xs text-slate-500 block">現價</label><input type="number" value={etf.currentPrice} onChange={(e) => updateEtf(idx, 'currentPrice', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
                        <div><label className="text-[10px] text-blue-300 block flex items-center gap-1"><Layers className="w-3 h-3"/> 融資買進 (Margin)</label><input type="number" value={etf.marginLoanAmount || 0} onChange={(e) => updateEtf(idx, 'marginLoanAmount', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div>
                        <div><label className="text-[10px] text-blue-300 block">融資利率 (%)</label><input type="number" value={etf.marginInterestRate || 0} onChange={(e) => updateEtf(idx, 'marginInterestRate', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div>
                    </div>

                    <div className="mb-2 mt-1 flex gap-1 flex-wrap">
                        {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                            <button key={month} onClick={() => toggleEtfPayMonth(idx, month)} className={`w-6 h-6 rounded-full text-[10px] flex items-center justify-center transition-all ${etf.payMonths.includes(month) ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/20' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}`}>{month}</button>
                        ))}
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-700 bg-slate-800/50 rounded-xl p-2 animate-in fade-in slide-in-from-top-2">
                          <h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-2"><List className="w-3 h-3" /> 交易紀錄</h4>
                          {etf.lots && etf.lots.length > 0 ? (
                            <div className="space-y-1 mb-3">
                              <div className="grid grid-cols-4 text-[10px] text-slate-500 px-1"><span>日期</span><span className="text-right">股數</span><span className="text-right">單價(費)</span><span className="text-center">操作</span></div>
                              {etf.lots.map(lot => (
                                <div key={lot.id} className="grid grid-cols-4 items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs hover:border-slate-500 transition-colors">
                                   <span className="text-slate-300">{lot.date}</span><span className="text-right text-emerald-300 font-mono">{lot.shares}</span>
                                   <div className="text-right"><span className="text-amber-300 font-mono">{lot.price}</span>{lot.fee !== undefined && (<span className="text-[9px] text-slate-500 block">(+{lot.fee})</span>)}</div>
                                   <div className="text-center"><button onClick={() => removeLot(idx, lot.id)} className="p-1 hover:bg-red-900/50 rounded text-red-400"><Trash2 className="w-3 h-3" /></button></div>
                                </div>
                              ))}
                            </div>
                          ) : (<div className="text-center text-xs text-slate-500 py-2 mb-2 italic">尚無交易紀錄，請於下方新增</div>)}
                          <div className="flex gap-2 items-end bg-slate-900 p-2 rounded-lg border border-slate-700">
                             <div className="flex-1"><label className="text-[10px] text-slate-500 block mb-1">日期</label><input type="date" value={newLot.date} onChange={e => setNewLot({...newLot, date: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs" /></div>
                             <div className="flex-1"><label className="text-[10px] text-slate-500 block mb-1">股數</label><input type="number" placeholder="0" value={newLot.shares} onChange={e => setNewLot({...newLot, shares: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs" /></div>
                             <div className="flex-1"><label className="text-[10px] text-slate-500 block mb-1">單價</label><input type="number" placeholder="0" value={newLot.price} onChange={e => setNewLot({...newLot, price: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs" /></div>
                             <button onClick={() => addLot(idx)} className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded h-[26px] flex items-center justify-center w-8"><Plus className="w-4 h-4" /></button>
                          </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Mortgage Input */}
          <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-red-300 flex items-center gap-2">
              <DollarSign className="w-5 h-5" /> 房貸配置 (本利/本金)
            </h2>
            <div className="space-y-4">
              {loans.map((loan, idx) => {
                 const isGracePeriod = loan.paidMonths < loan.gracePeriod;
                 return (
                  <div key={loan.id} className={`p-4 bg-slate-900 rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-900/20 hover:border-red-500/50 ${isGracePeriod ? 'border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'border-slate-700'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{loan.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${
                          loan.type === MortgageType.PrincipalAndInterest 
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                            : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        }`}>
                          {loan.type === MortgageType.PrincipalAndInterest ? '本息攤還' : '本金攤還'}
                        </span>
                      </div>
                      <select value={loan.type} onChange={(e) => updateLoan(idx, 'type', e.target.value)} className="bg-slate-800 text-xs border border-slate-600 rounded px-1 text-slate-300">
                        <option value={MortgageType.PrincipalAndInterest}>設定: 本息</option>
                        <option value={MortgageType.Principal}>設定: 本金</option>
                      </select>
                    </div>
                    {isGracePeriod && (
                      <div className="mb-3 bg-amber-900/20 border border-amber-500/40 rounded-lg p-2 flex items-center gap-2">
                          <div className="bg-amber-500/20 p-1.5 rounded-full"><Clock className="w-4 h-4 text-amber-400 animate-pulse" /></div>
                          <div><div className="text-xs font-bold text-amber-300">目前處於寬限期</div><div className="text-[10px] text-amber-200/70">僅需繳納利息，暫不還本</div></div>
                      </div>
                    )}
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-1"><label className="text-xs text-slate-500">本金</label><input type="number" value={loan.principal} onChange={(e) => updateLoan(idx, 'principal', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                            <div className="col-span-2"><label className="text-xs text-emerald-400 block flex items-center gap-1 font-bold"><Calendar className="w-3 h-3"/> 核貸日期</label><input type="date" value={loan.startDate || ''} onChange={(e) => updateLoan(idx, 'startDate', e.target.value)} className="w-full bg-slate-800 border border-emerald-600/50 rounded-lg px-2 py-1 text-sm text-white" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div><label className="text-xs text-slate-500">總期數</label><input type="number" value={loan.totalMonths} onChange={(e) => updateLoan(idx, 'totalMonths', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                             <div><label className="text-xs text-slate-500">已繳</label><input type="number" value={loan.paidMonths} onChange={(e) => updateLoan(idx, 'paidMonths', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-sm" disabled={!!loan.startDate} /></div>
                        </div>
                        <div><label className="text-xs text-slate-500">寬限期</label><input type="number" value={loan.gracePeriod} onChange={(e) => updateLoan(idx, 'gracePeriod', Number(e.target.value))} className={`w-full bg-slate-800 border rounded-lg px-2 py-1 text-sm ${isGracePeriod ? 'border-amber-500 text-amber-300' : 'border-slate-600'}`} /></div>
                        <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 grid grid-cols-3 gap-2">
                            <div><label className="text-[10px] text-slate-400">利率1</label><input type="number" value={loan.rate1} onChange={(e) => updateLoan(idx, 'rate1', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div>
                            <div><label className="text-[10px] text-slate-400">期間1</label><input type="number" value={loan.rate1Months} onChange={(e) => updateLoan(idx, 'rate1Months', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div>
                            <div><label className="text-[10px] text-slate-400">利率2</label><input type="number" value={loan.rate2} onChange={(e) => updateLoan(idx, 'rate2', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs" /></div>
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Credit Loan Section */}
           <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-orange-300 flex items-center gap-2"><Banknote className="w-5 h-5" /> 信用貸款 (本利攤還)</h2>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-900/20 hover:border-orange-500/50">
               <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="text-xs text-slate-500">貸款金額</label><input type="number" value={creditLoan.principal} onChange={(e) => setCreditLoan({...creditLoan, principal: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                  <div><label className="text-xs text-slate-500">年利率 (%)</label><input type="number" value={creditLoan.rate} onChange={(e) => setCreditLoan({...creditLoan, rate: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-orange-300 font-bold" /></div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-slate-500">總期數</label><input type="number" value={creditLoan.totalMonths} onChange={(e) => setCreditLoan({...creditLoan, totalMonths: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                  <div><label className="text-xs text-slate-500">已繳</label><input type="number" value={creditLoan.paidMonths} onChange={(e) => setCreditLoan({...creditLoan, paidMonths: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
               </div>
            </div>
           </section>

          {/* Global Margin Loan Section */}
          <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
             <h2 className="text-xl font-semibold mb-2 text-cyan-300 flex items-center gap-2"><Layers className="w-5 h-5" /> 股票融資 (Margin Trading)</h2>
            <p className="text-xs text-slate-400 mb-4 ml-1">融資買進專用帳戶 (全域設定)</p>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-900/20 hover:border-cyan-500/50">
              <div className="grid grid-cols-2 gap-3">
                 <div><label className="text-xs text-slate-400">全域融資本金</label><input type="number" value={globalMarginLoan.principal} onChange={(e) => setGlobalMarginLoan({...globalMarginLoan, principal: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                 <div><label className="text-xs text-slate-400">年利率 (%)</label><input type="number" value={globalMarginLoan.rate} onChange={(e) => setGlobalMarginLoan({...globalMarginLoan, rate: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-cyan-300 font-bold" /></div>
              </div>
            </div>
          </section>

          {/* Stock Loan / Collateral Section */}
          <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
             <h2 className="text-xl font-semibold mb-2 text-blue-300 flex items-center gap-2"><Coins className="w-5 h-5" /> 股票質押 (不限用途借貸)</h2>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/20 hover:border-blue-500/50">
              <div className="grid grid-cols-2 gap-3 mb-3">
                 <div><label className="text-xs text-slate-400">全域質押本金</label><input type="number" value={stockLoan.principal} onChange={(e) => setStockLoan({...stockLoan, principal: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                 <div><label className="text-xs text-slate-400">年利率 (%)</label><input type="number" value={stockLoan.rate} onChange={(e) => setStockLoan({...stockLoan, rate: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-blue-300 font-bold" /></div>
              </div>
              <div><label className="text-xs text-slate-400">維持率斷頭線 (%)</label><input type="number" value={stockLoan.maintenanceLimit} onChange={(e) => setStockLoan({...stockLoan, maintenanceLimit: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
            </div>
          </section>

          {/* Tax Section */}
           <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
             <h2 className="text-xl font-semibold mb-4 text-purple-300 flex items-center gap-2"><Wallet className="w-5 h-5" /> 稅務設定</h2>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-900/20 hover:border-purple-500/50">
               <div className="grid grid-cols-2 gap-3">
                   <div><label className="text-xs text-slate-400">薪資所得</label><input type="number" value={taxStatus.salaryIncome} onChange={(e) => setTaxStatus({...taxStatus, salaryIncome: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
                   <div><label className="text-xs text-slate-400">扶養人數</label><input type="number" value={taxStatus.dependents} onChange={(e) => setTaxStatus({...taxStatus, dependents: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm" /></div>
               </div>
                <div className="flex gap-4 mt-3 pt-3 border-t border-slate-800">
                  <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={taxStatus.hasSpouse} onChange={(e) => setTaxStatus({...taxStatus, hasSpouse: e.target.checked})} className="accent-emerald-500"/> 配偶</label>
                  <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={taxStatus.isDisabled} onChange={(e) => setTaxStatus({...taxStatus, isDisabled: e.target.checked})} className="accent-emerald-500"/> 身心障礙</label>
                </div>
            </div>
           </section>
        </div>

        {/* OUTPUT SECTION */}
        <div className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-xl">
              <div className="text-slate-400 text-xs uppercase tracking-wider">年度淨現金部位</div>
              <div className={`text-2xl font-bold ${yearlyNetPosition.isNegative() ? 'text-red-400' : 'text-emerald-400'}`}>{formatMoney(yearlyNetPosition)}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-blue-500 shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-xl">
              <div className="text-slate-400 text-xs uppercase tracking-wider">資產總市值</div>
              <div className="text-2xl font-bold text-blue-400">{formatMoney(totalMarketValue)}</div>
              <div className={`text-xs mt-1 ${unrealizedPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>損益: {unrealizedPL >= 0 ? '+' : ''}{formatMoney(unrealizedPL)}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-amber-500 shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-xl">
              <div className="text-slate-400 text-xs uppercase tracking-wider">整體維持率</div>
              <div className={`text-2xl font-bold ${currentMaintenance < 130 ? 'text-red-500' : 'text-amber-400'}`}>{currentMaintenance.toFixed(2)}%</div>
              <div className="text-[10px] text-slate-500 mt-1 flex flex-col"><span>質押: {formatMoney(totalCollateralLoan)}</span><span>融資: {formatMoney(totalGlobalMargin + totalEtfMargin)}</span></div>
            </div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-purple-500 shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-xl">
              <div className="text-slate-400 text-xs uppercase tracking-wider">預估稅負</div>
              <div className="text-2xl font-bold text-purple-400">{formatMoney(healthInsuranceTotal.plus(incomeTaxTotal))}</div>
              <div className="text-xs text-slate-500 mt-1">健保: {formatMoney(healthInsuranceTotal)} | 稅: {formatMoney(incomeTaxTotal)}</div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
             <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-400" /> 現金流儲水池</h3>
             <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyFlows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }} formatter={(val: number) => new Decimal(val).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} labelFormatter={(l) => `${l} 月`} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="cumulativeBalance" stroke="#10b981" strokeWidth={3} name="累積餘額" dot={{r: 4}} />
                    <Line type="monotone" dataKey="netFlow" stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 5" name="單月淨流" />
                  </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg overflow-x-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-blue-400" /> 現金流明細</h3>
             <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900">
                   <tr><th className="px-3 py-3">月</th><th className="px-3 py-3 text-right text-emerald-400">股息</th><th className="px-3 py-3 text-right text-red-400">房貸</th><th className="px-3 py-3 text-right text-orange-400">信貸</th><th className="px-3 py-3 text-right text-blue-400">股貸</th><th className="px-3 py-3 text-right text-purple-400">稅負</th><th className="px-3 py-3 text-right font-bold">淨流</th></tr>
                </thead>
                <tbody>
                   {monthlyFlows.map((row) => (
                      <tr key={row.month} className="border-b border-slate-700 hover:bg-slate-750">
                         <td className="px-3 py-2">{row.month}</td>
                         <td className="px-3 py-2 text-right text-emerald-400">{row.dividendInflow > 0 ? formatMoney(row.dividendInflow) : '-'}</td>
                         <td className="px-3 py-2 text-right text-red-400">{formatMoney(row.loanOutflow)}</td>
                         <td className="px-3 py-2 text-right text-orange-400">{formatMoney(row.creditLoanOutflow)}</td>
                         <td className="px-3 py-2 text-right text-blue-400">{formatMoney(row.stockLoanInterest)}</td>
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
