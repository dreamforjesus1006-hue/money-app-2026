import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Calculator, DollarSign, Wallet, Activity, Save, Upload, Download, RotateCcw, Settings, Globe, Cloud, Loader2, Target, Zap, TrendingUp, RefreshCw, Gift, PieChart as PieIcon, Banknote, Flame, Share2, Scale, ShieldCheck, Swords, Coins, Skull, Gem, Scroll, Sparkles, Lock, Aperture, List, Trash2, X, Tag, ShoppingCart, Coffee, Layers, Crown, Trophy, Calendar, Lightbulb, CheckCircle2, HelpCircle, Edit3, ArrowRightLeft, Plus, ArrowUp, ArrowDown, Wifi, WifiOff } from 'lucide-react';

// ★★★ 填寫您的 Firebase Config ★★★
const YOUR_FIREBASE_CONFIG = {
  apiKey: "請貼上您的_apiKey",
  authDomain: "請貼上您的_authDomain",
  projectId: "請貼上您的_projectId",
  storageBucket: "請貼上您的_storageBucket",
  messagingSenderId: "請貼上您的_messagingSenderId",
  appId: "請貼上您的_appId"
};

// --- Firebase SDK ---
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// ==========================================
// 1. 您的專屬備份資料 (作為離線預設值)
// ==========================================
const USER_BACKUP_DATA = {
  "etfs": [
    { "payMonths": [2, 5, 8, 11], "costPrice": 36.1, "marginInterestRate": 4.5, "code": "0056", "name": "元大高股息", "currentPrice": 38.26, "category": "dividend", "shares": 101000, "dividendPerShare": 0.866, "dividendType": "per_period", "marginLoanAmount": 0, "id": "0056" },
    { "marginLoanAmount": 143000, "id": "00919", "marginInterestRate": 4.5, "code": "00919", "costPrice": 22.82, "payMonths": [1, 4, 7, 10], "currentPrice": 23.99, "shares": 20000, "name": "群益精選", "dividendPerShare": 2.52, "dividendType": "annual", "category": "dividend" },
    { "name": "實體黃金 (克)", "payMonths": [], "dividendPerShare": 0, "category": "hedging", "id": "GOLD", "code": "GOLD", "currentPrice": 5429, "costPrice": 4806.1, "shares": 72.2 }
  ],
  "loans": [
    { "id": "loan-1", "paidMonths": 1, "startDate": "2025-12-02", "rate1": 1.775, "rate1Months": 10, "totalMonths": 480, "rate2": 2.275, "name": "新青安房貸", "principal": 8340000, "gracePeriod": 60, "type": "PrincipalAndInterest" },
    { "startDate": "2022-12-19", "id": "loan-2", "rate1": 2.327, "paidMonths": 37, "rate2": 2.327, "rate1Months": 240, "principal": 9000000, "totalMonths": 240, "gracePeriod": 60, "name": "理財型房貸", "type": "PrincipalAndInterest" }
  ],
  "stockLoan": { "rate": 2.56, "principal": 0, "maintenanceLimit": 130 },
  "creditLoan": { "rate": 4.05, "totalMonths": 84, "principal": 3040000, "paidMonths": 0 },
  "globalMarginLoan": { "rate": 4.5, "maintenanceLimit": 130, "principal": 0 },
  "taxStatus": { "salaryIncome": 589200, "dependents": 0, "hasSpouse": true, "isDisabled": true, "livingExpenses": 0 },
  "allocation": { "activeRatio": 5, "hedgingRatio": 15, "dividendRatio": 80, "totalFunds": 14500000 }
};

// ==========================================
// 2. 核心計算
// ==========================================
const formatMoney = (val: any) => `$${Math.floor(Number(val) || 0).toLocaleString()}`;

const calculateLoanPayment = (loan: any) => {
    const p = loan.principal; const paid = loan.paidMonths; const grace = loan.gracePeriod;
    if (paid < grace) return Math.floor(p * (loan.rate1 / 100 / 12));
    const rate = (paid < loan.rate1Months ? loan.rate1 : loan.rate2) / 100 / 12;
    const n = loan.totalMonths - paid; if (n <= 0) return 0;
    return Math.floor((p * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1));
};

const recalculateEtfStats = (etf: ETF): ETF => {
    if (!etf.lots || etf.lots.length === 0) return etf;
    const totalShares = etf.lots.reduce((acc, lot) => acc + Number(lot.shares), 0);
    const totalCost = etf.lots.reduce((acc, lot) => acc + (Number(lot.shares) * Number(lot.price)) + (Number(lot.fee) || 0), 0);
    const totalMargin = etf.lots.reduce((acc, lot) => acc + (Number(lot.margin) || 0), 0);
    return { ...etf, shares: totalShares, costPrice: totalShares > 0 ? Number((totalCost / totalShares).toFixed(2)) : 0, marginLoanAmount: totalMargin };
};

const generateCashFlow = (etfs: ETF[], loans: any[], stockLoan: any, creditLoan: any, globalMarginLoan: any, taxStatus: any) => {
    const monthlyFlows = [];
    for (let m = 1; m <= 12; m++) {
        let divIn = 0;
        etfs.forEach(e => {
            if (e.payMonths?.includes(m)) {
                let payout = e.dividendPerShare;
                if (e.dividendType === 'annual' && e.payMonths.length > 0) payout /= e.payMonths.length;
                divIn += e.shares * payout;
            }
        });
        let loanOut = 0; loans.forEach(l => loanOut += calculateLoanPayment(l));
        const cRate = creditLoan.rate / 100 / 12;
        const creditOut = creditLoan.principal > 0 ? Math.floor((creditLoan.principal * cRate * Math.pow(1 + cRate, creditLoan.totalMonths)) / (Math.pow(1 + cRate, creditLoan.totalMonths) - 1)) : 0;
        const stockInt = Math.floor((stockLoan.principal * (stockLoan.rate/100)/12) + (globalMarginLoan.principal * (globalMarginLoan.rate/100)/12));
        const marginInt = etfs.reduce((acc, e) => acc + ((e.marginLoanAmount||0) * ((e.marginInterestRate||6.5)/100)/12), 0);
        const tax = Math.floor(divIn * 0.0211);
        monthlyFlows.push({ month: m, divIn, loanOut, creditOut, stockInt: stockInt + marginInt, life: taxStatus.livingExpenses, tax, net: divIn - loanOut - creditOut - stockInt - marginInt - taxStatus.livingExpenses - tax });
    }
    return monthlyFlows;
};

// ==========================================
// 3. Firebase 定位修正 (Match Screenshot)
// ==========================================
let db: any = null;
const isFirebaseConfigured = YOUR_FIREBASE_CONFIG.apiKey && !YOUR_FIREBASE_CONFIG.apiKey.includes("請貼上");
if (isFirebaseConfigured) {
    try { const app = initializeApp(YOUR_FIREBASE_CONFIG); db = getFirestore(app); } catch(e) { console.error(e); }
}

const STORAGE_KEY = 'baozutang_v46';
// ★★★ 修正路徑：依照截圖定位為 portfolios / tony1006 ★★★
const COLLECTION_NAME = "portfolios";
const DOCUMENT_ID = "tony1006";

const StorageService = {
    saveData: async (data: any) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        if (isFirebaseConfigured && db) await setDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID), data);
        return true;
    },
    loadData: async () => {
        if (isFirebaseConfigured && db) {
            const snap = await getDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID));
            if (snap.exists()) return { data: snap.data(), source: 'cloud' };
        }
        const local = localStorage.getItem(STORAGE_KEY);
        return local ? { data: JSON.parse(local), source: 'local' } : { data: USER_BACKUP_DATA, source: 'backup' };
    }
};

// ==========================================
// 4. App 主程式
// ==========================================
const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dataSrc, setDataSrc] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // Data State
  const [etfs, setEtfs] = useState<ETF[]>(INITIAL_ETFS);
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [stockLoan, setStockLoan] = useState<StockLoan>(INITIAL_STOCK_LOAN);
  const [globalMarginLoan, setGlobalMarginLoan] = useState<StockLoan>(INITIAL_GLOBAL_MARGIN_LOAN);
  const [creditLoan, setCreditLoan] = useState<CreditLoan>(INITIAL_CREDIT_LOAN);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(INITIAL_TAX_STATUS);
  const [allocation, setAllocation] = useState<AllocationConfig>(INITIAL_ALLOCATION);
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({ enabled: false, priceSourceUrl: '' });

  // UI State
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState({ shares: '', price: '', date: '', margin: '' });

  // Load Data
  useEffect(() => {
    StorageService.loadData().then(res => {
      setDataSrc(res.source);
      if (res.data) {
        const d = res.data;
        if(d.etfs) setEtfs(d.etfs); if(d.loans) setLoans(d.loans); if(d.stockLoan) setStockLoan(d.stockLoan);
        if(d.globalMarginLoan) setGlobalMarginLoan(d.globalMarginLoan); if(d.creditLoan) setCreditLoan(d.creditLoan);
        if(d.taxStatus) setTaxStatus(d.taxStatus); if(d.allocation) setAllocation(d.allocation);
      }
      setIsInitializing(false);
    });
  }, []);

  // Save Data
  useEffect(() => {
    if (isInitializing) return;
    setSaveStatus('saving');
    const t = setTimeout(() => {
      StorageService.saveData({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation })
        .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); });
    }, 1500);
    return () => clearTimeout(t);
  }, [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation]);

  // Calculations
  const totalValue = etfs.reduce((a, e) => a + (e.shares * e.currentPrice), 0);
  const totalDebt = stockLoan.principal + globalMarginLoan.principal + etfs.reduce((a, e) => a + (e.marginLoanAmount || 0), 0);
  const maintenance = totalDebt === 0 ? 999 : (totalValue / totalDebt) * 100;
  
  const monthlyFlows = useMemo(() => generateCashFlow(etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus), [etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus]);
  const fireMetrics = useMemo(() => {
      const exp = monthlyFlows.reduce((a, c) => a + c.loanOut, 0) + (taxStatus.livingExpenses * 12);
      const inc = monthlyFlows.reduce((a, c) => a + c.divIn, 0);
      return { ratio: exp > 0 ? (inc / exp) * 100 : 0, inc, exp };
  }, [monthlyFlows, taxStatus]);

  // ★★★ 修正：資產分配 (扣除融資) ★★★
  const actualDiv = etfs.filter(e => e.category === 'dividend').reduce((a, e) => a + (e.shares * e.currentPrice) - (e.marginLoanAmount || 0), 0);
  const actualHedge = etfs.filter(e => e.category === 'hedging').reduce((a, e) => a + (e.shares * e.currentPrice) - (e.marginLoanAmount || 0), 0);
  const actualAct = etfs.filter(e => e.category === 'active').reduce((a, e) => a + (e.shares * e.currentPrice) - (e.marginLoanAmount || 0), 0);

  const radarData = [
    { subject: '現金流', A: Math.min(100, fireMetrics.ratio), fullMark: 100 },
    { subject: '安全性', A: Math.min(100, (actualHedge / (totalValue - totalDebt || 1)) * 500), fullMark: 100 },
    { subject: '抗壓性', A: Math.min(100, (maintenance - 130) * 2), fullMark: 100 },
    { subject: '稅務', A: 80, fullMark: 100 },
  ];

  const updateEtf = (i: number, f: string, v: any) => { const n = [...etfs]; (n[i] as any)[f] = v; setEtfs(n); };
  const moveEtf = (i: number, d: number) => { const n = [...etfs]; if(i+d < 0 || i+d >= n.length) return; [n[i], n[i+d]] = [n[i+d], n[i]]; setEtfs(n); };

  if (isInitializing) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> 同步中...</div>;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-900 text-white">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2"><Calculator/> 包租唐戰情室 V46</h1>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 flex items-center gap-1">
              {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin"/> : dataSrc === 'cloud' ? <Wifi className="w-3 h-3 text-blue-400"/> : <WifiOff className="w-3 h-3 text-slate-500"/>}
              {dataSrc === 'cloud' ? "雲端連線" : "本機模式"}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)} className="px-3 py-2 bg-slate-800 rounded-lg text-sm flex items-center gap-2 border border-slate-700"><Settings className="w-4 h-4 text-blue-400"/>設定</button>
            <button onClick={() => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation })} className="px-3 py-2 bg-slate-800 rounded-lg text-sm flex items-center gap-2 border border-slate-700"><Download className="w-4 h-4 text-emerald-400"/>匯出</button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="xl:col-span-4 space-y-6">
          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-cyan-300"><ShieldCheck/> 資產體質</h2>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData}><PolarGrid/><PolarAngleAxis dataKey="subject"/><Radar dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.5}/></RadarChart></ResponsiveContainer></div>
          </section>

          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-blue-300"><PieIcon className="inline mr-2"/>資金分配 (淨值)</h2>
            <div className="space-y-4">
               <div><label className="text-xs text-slate-500">配息型 (缺: {formatMoney(Math.max(0, (allocation.totalFunds * allocation.dividendRatio / 100) - actualDiv))})</label><div className="w-full bg-slate-700 h-2 rounded-full mt-1 overflow-hidden"><div className="bg-emerald-500 h-full" style={{width: `${Math.min(100, (actualDiv / (allocation.totalFunds * allocation.dividendRatio / 100 || 1)) * 100)}%`}}></div></div></div>
               <div><label className="text-xs text-slate-500">避險型 (缺: {formatMoney(Math.max(0, (allocation.totalFunds * allocation.hedgingRatio / 100) - actualHedge))})</label><div className="w-full bg-slate-700 h-2 rounded-full mt-1 overflow-hidden"><div className="bg-amber-500 h-full" style={{width: `${Math.min(100, (actualHedge / (allocation.totalFunds * allocation.hedgingRatio / 100 || 1)) * 100)}%`}}></div></div></div>
            </div>
          </section>

          <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-emerald-400"><Activity className="inline mr-2"/>標的清單</h2>
            <div className="space-y-4">
              {etfs.map((e, i) => (
                <div key={e.id} className="p-4 bg-slate-900 rounded-xl border border-slate-700 relative group">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveEtf(i, -1)} className="p-1 hover:bg-slate-700 rounded"><ArrowUp size={14}/></button>
                    <button onClick={() => moveEtf(i, 1)} className="p-1 hover:bg-slate-700 rounded"><ArrowDown size={14}/></button>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <input type="text" value={e.name} onChange={v => updateEtf(i, 'name', v.target.value)} className="bg-transparent font-bold text-white w-2/3 outline-none border-b border-transparent focus:border-emerald-500"/>
                    <span className="text-[10px] text-slate-500">融資: {formatMoney(e.marginLoanAmount)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div><label className="text-slate-500">股數</label><input type="number" value={e.shares} onChange={v => updateEtf(i, 'shares', Number(v.target.value))} className="w-full bg-slate-800 rounded p-1"/></div>
                    <div><label className="text-slate-500">現價</label><input type="number" value={e.currentPrice} onChange={v => updateEtf(i, 'currentPrice', Number(v.target.value))} className="w-full bg-slate-800 rounded p-1"/></div>
                    <div><label className="text-slate-500">配息</label><input type="number" value={e.dividendPerShare} onChange={v => updateEtf(i, 'dividendPerShare', Number(v.target.value))} className="w-full bg-slate-800 rounded p-1"/></div>
                    <div className="text-center pt-4"><button onClick={() => removeEtf(e.id)} className="text-red-400"><Trash2 size={16}/></button></div>
                  </div>
                </div>
              ))}
              <button onClick={() => setEtfs([...etfs, { id: Date.now().toString(), name: '新標的', code: '', shares: 0, costPrice: 0, currentPrice: 0, dividendPerShare: 0, dividendType: 'annual', payMonths: [1,4,7,10], category: 'dividend', marginLoanAmount: 0 }])} className="w-full py-2 border border-dashed border-slate-600 rounded-xl text-slate-500 hover:text-white">+ 新增標的</button>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-8 space-y-6">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-lg"><div className="text-slate-400 text-xs">年度淨流</div><div className={`text-2xl font-bold ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-blue-500 shadow-lg"><div className="text-slate-400 text-xs">總資產</div><div className="text-2xl font-bold">{formatMoney(totalValue)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-red-500 shadow-lg"><div className="text-slate-400 text-xs">總負債</div><div className="text-2xl font-bold">{formatMoney(totalDebt)}</div></div>
             <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-orange-500 shadow-lg"><div className="text-slate-400 text-xs">維持率</div><div className="text-2xl font-bold">{maintenance === 999 ? "MAX" : maintenance.toFixed(1) + "%"}</div></div>
           </div>

           {/* Cash Flow Table  */}
           <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl overflow-x-auto">
             <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Calendar className="text-blue-400"/> 每月現金流明細</h3>
             <table className="w-full text-sm text-left">
               <thead className="text-slate-500 bg-slate-900/50">
                 <tr><th className="p-3">月份</th><th className="p-3">股息</th><th className="p-3">房貸</th><th className="p-3">信貸</th><th className="p-3">利息</th><th className="p-3">生活</th><th className="p-3">稅金</th><th className="p-3 text-right">淨流</th></tr>
               </thead>
               <tbody>
                 {monthlyFlows.map(r => (
                   <tr key={r.month} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                     <td className="p-3 font-bold">{r.month}月</td>
                     <td className="p-3 text-emerald-400">{formatMoney(r.divIn)}</td>
                     <td className="p-3 text-red-400">{formatMoney(r.loanOut)}</td>
                     <td className="p-3 text-orange-400">{formatMoney(r.creditOut)}</td>
                     <td className="p-3 text-blue-300">{formatMoney(r.stockInt)}</td>
                     <td className="p-3 text-slate-400">{formatMoney(r.life)}</td>
                     <td className="p-3 text-purple-400">{formatMoney(r.tax)}</td>
                     <td className={`p-3 text-right font-bold ${r.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(r.net)}</td>
                   </tr>
                 ))}
               </tbody>
               {/* ★★★ 年度總計列 ★★★ */}
               <tfoot>
                 <tr className="bg-slate-900 font-black text-white">
                   <td className="p-3 rounded-bl-lg">年度總計</td>
                   <td className="p-3 text-emerald-400">{formatMoney(totalDividend)}</td>
                   <td className="p-3 text-red-400">{formatMoney(totalMortgage)}</td>
                   <td className="p-3 text-orange-400">{formatMoney(totalCredit)}</td>
                   <td className="p-3 text-blue-300">{formatMoney(totalStockInterest)}</td>
                   <td className="p-3 text-slate-400">{formatMoney(totalLiving)}</td>
                   <td className="p-3 text-purple-400">{formatMoney(totalTax)}</td>
                   <td className={`p-3 text-right rounded-br-lg ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(totalNet)}</td>
                 </tr>
               </tfoot>
             </table>
           </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-white">⚙️ 系統設定</h3>
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400">Google Sheet CSV 連結</label><input type="text" value={cloudConfig.priceSourceUrl} onChange={e => setCloudConfig({...cloudConfig, priceSourceUrl: e.target.value})} className="w-full bg-slate-900 p-2 rounded mt-1 border border-slate-600"/></div>
              <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
                <p>已連接 Firebase 路徑: portfolios / tony1006</p>
              </div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full mt-6 py-2 bg-blue-600 rounded-lg font-bold">儲存並關閉</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
