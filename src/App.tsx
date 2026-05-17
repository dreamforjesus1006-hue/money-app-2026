X, ShoppingCart, ArrowUp, ArrowDown, Wifi, WifiOff, ChevronDown,
ChevronUp, Calendar, CalendarDays, CheckCircle2, AlertTriangle, Plus,
Trophy, Crown, Zap, Target, Swords, Coins, Wallet, MessageSquareText,
  BellRing, Search, Database
  BellRing, Search
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
@@ -45,7 +45,7 @@ interface StockLoan { principal: number; rate: number; maintenanceLimit?: number
interface CreditLoan { principal: number; rate: number; totalMonths: number; paidMonths: number; }
interface TaxStatus { salaryIncome: number; livingExpenses: number; dependents: number; hasSpouse: boolean; isDisabled: boolean; disabilityCount: number; dividendTaxableRatio: number; }
interface AllocationConfig { totalFunds: number; dividendRatio: number; hedgingRatio: number; activeRatio: number; }
interface CloudConfig { priceSourceUrl: string; enabled: boolean; finMindToken?: string; }
interface CloudConfig { priceSourceUrl: string; enabled: boolean; }
interface ActualDetails { [key: string]: number; }
interface MonthlyRecord { livingExpense?: number; otherIncome?: number; isTaxable?: boolean; }
type MonthlyRecords = Record<string, MonthlyRecord>;
@@ -67,7 +67,7 @@ const DEFAULT_GLOBAL_MARGIN: StockLoan = { rate: 4.5, principal: 0 };
const DEFAULT_CREDIT: CreditLoan = { rate: 4.05, totalMonths: 84, principal: 0, paidMonths: 0 };
const DEFAULT_TAX: TaxStatus = { salaryIncome: 589200, livingExpenses: 70000, hasSpouse: true, isDisabled: true, dependents: 0, disabilityCount: 1, dividendTaxableRatio: 30 };
const DEFAULT_ALLOC: AllocationConfig = { activeRatio: 5, hedgingRatio: 15, dividendRatio: 80, totalFunds: 14500000 };
const DEFAULT_CLOUD: CloudConfig = { priceSourceUrl: '', enabled: true, finMindToken: '' };
const DEFAULT_CLOUD: CloudConfig = { priceSourceUrl: '', enabled: true };

const BROKERAGE_RATE = 0.001425;
const COLORS = { dividend: '#10b981', hedging: '#f59e0b', active: '#a855f7' };
@@ -78,7 +78,7 @@ const toTime = (s: string) => { const t = new Date(s).getTime(); return Number.i
const safeNum = (v: any, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

// ==========================================
// 4. 計算工具
// 4. 輔助計算函數
// ==========================================
const calculateIncomeTax = (salary: number, dividend: number, otherTaxable: number, status: TaxStatus) => {
const exemption = 97000 * (1 + (status.hasSpouse ? 1 : 0) + status.dependents);
@@ -119,7 +119,12 @@ const recalculateEtfStats = (etf: ETF): ETF => {
const totalShares = lots.reduce((acc, lot) => acc + safeNum(lot.shares), 0);
const totalCost = lots.reduce((acc, lot) => acc + safeNum(lot.shares) * safeNum(lot.price) + safeNum(lot.fee), 0);
const totalMargin = lots.reduce((acc, lot) => acc + safeNum(lot.margin), 0);
  return { ...etf, shares: totalShares > 0 ? totalShares : safeNum(etf.shares), costPrice: totalShares > 0 ? Number((totalCost / totalShares).toFixed(2)) : safeNum(etf.costPrice), marginLoanAmount: totalMargin > 0 ? totalMargin : safeNum(etf.marginLoanAmount) };
  return { 
    ...etf, 
    shares: totalShares > 0 ? totalShares : safeNum(etf.shares), 
    costPrice: totalShares > 0 ? Number((totalCost / totalShares).toFixed(2)) : safeNum(etf.costPrice), 
    marginLoanAmount: totalMargin > 0 ? totalMargin : safeNum(etf.marginLoanAmount) 
  };
};

const generateCashFlow = (etfs: ETF[], loans: Loan[], stockLoan: StockLoan, creditLoan: CreditLoan, globalMarginLoan: StockLoan, taxStatus: TaxStatus, actualDetails: ActualDetails, monthlyRecords: MonthlyRecords, selectedYear: number) => {
@@ -255,14 +260,11 @@ const generateCashFlow = (etfs: ETF[], loans: Loan[], stockLoan: StockLoan, cred
};

// ==========================================
// 5. Firebase Initialization
// 5. Firebase 與 資料服務
// ==========================================
let db: any = null;
try { const app = getApps().length ? getApps()[0] : initializeApp(YOUR_FIREBASE_CONFIG); db = getFirestore(app); } catch (e) { db = null; }

// ==========================================
// 6. StorageService & Data Sanitization
// ==========================================
const sanitizePayload = (d: any): PersistedPayload => {
const etfs: ETF[] = Array.isArray(d?.etfs) && d.etfs.length > 0 ? d.etfs : [];
const cleanedEtfs = etfs.map((e: any) => ({
@@ -284,7 +286,7 @@ const sanitizePayload = (d: any): PersistedPayload => {
globalMarginLoan: d?.globalMarginLoan || DEFAULT_GLOBAL_MARGIN, 
taxStatus: { ...DEFAULT_TAX, ...(d?.taxStatus || {}) }, 
allocation: d?.allocation || DEFAULT_ALLOC, 
      cloudConfig: { ...DEFAULT_CLOUD, ...(d?.cloudConfig || {}) }, 
      cloudConfig: d?.cloudConfig || DEFAULT_CLOUD, 
actualDetails: newActuals, 
monthlyRecords: d?.monthlyRecords || {},
_meta: d?._meta 
@@ -317,10 +319,19 @@ const StorageService = {

const parseCsvPriceMap = (text: string) => {
const map = new Map<string, number>();
  text.trim().split(/\r?\n/).forEach((r) => { const cols = r.split(',').map((x) => x.trim()); if (cols.length >= 2 && cols[0] && cols[0].toLowerCase() !== 'code') { const price = parseFloat(cols[1]); if (Number.isFinite(price)) map.set(cols[0], price); } });
  text.trim().split(/\r?\n/).forEach((r) => { 
      const cols = r.split(',').map((x) => x.trim()); 
      if (cols.length >= 2 && cols[0] && cols[0].toLowerCase() !== 'code') { 
          const price = parseFloat(cols[1]); 
          if (Number.isFinite(price)) map.set(cols[0], price); 
      } 
  });
return map;
};

// ==========================================
// App 主程式開始
// ==========================================
export default function App() {
const [isInitializing, setIsInitializing] = useState(true);
const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
@@ -329,7 +340,7 @@ export default function App() {
const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
const [isScanningTwse, setIsScanningTwse] = useState(false);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState<number>(2026);
const [etfs, setEtfs] = useState<ETF[]>([]);
const [loans, setLoans] = useState<Loan[]>([]);
const [stockLoan, setStockLoan] = useState<StockLoan>(DEFAULT_STOCK_LOAN);
@@ -404,6 +415,7 @@ export default function App() {
const combatPower = Math.floor(totalValue / 10000 + totalDividend / 12 / 100);
const fireRatio = totalOut > 0 ? (totalDividend / totalOut) * 100 : 0;

  // RPG 面板推算
const { currentRank, nextRank, progress, healthGrade, earnedAchievements, avatar, combatLogs } = useMemo(() => {
let cRank = '理財新手 🌱'; let nRank = '築基騎士 ⚔️'; let prog = 0; let av = '🧑‍🌾';
if (fireRatio >= 100) { cRank = '財富神祇 🌟'; nRank = 'MAX'; prog = 100; av = '👑'; }
@@ -427,38 +439,31 @@ export default function App() {
if (totalOut > 0 && totalNet > 0) ach.push({ icon: '📈', title: '正向循環', desc: '淨現金流為正數', rarity: 'R', glow: 'border-emerald-500 text-emerald-400 bg-emerald-900/20' });

const logs = [
        `[系統] 玩家【包租唐】登入戰情室，當前總戰力 ${combatPower.toLocaleString()}。`,
        totalNet > 0 ? `[被動技] 資產護盾發動！預計每月淨回血 ${formatMoney(totalNet/12)}。` : `[警告] 現金流失血中，請注意防禦！`,
        `[裝備] 持有 ${etfs.length} 件神兵利器 (ETF) 持續產出金幣。`,
        currentMaintenance < 140 ? `[Debuff] 維持率過低，防禦力下降，面臨斷頭風險！` : `[Buff] 維持率穩健，防禦力堅不可摧。`
        `[系統] 玩家登入，當前總戰力 ${combatPower.toLocaleString()}。`,
        totalNet > 0 ? `[被動技] 資產護盾發動！預計月回血 ${formatMoney(totalNet/12)}。` : `[警告] 現金流失血中，請注意防禦！`,
        `[裝備] 持有 ${etfs.length} 件神兵持續產出金幣。`,
        currentMaintenance < 140 ? `[Debuff] 維持率過低，面臨斷頭風險！` : `[Buff] 維持率穩健，防禦力堅不可摧。`
];

return { currentRank: cRank, nextRank: nRank, progress: Math.min(100, Math.max(0, prog)), healthGrade: grade, earnedAchievements: ach, avatar: av, combatLogs: logs };
}, [fireRatio, totalValue, totalDividend, currentMaintenance, totalNet, etfs.length, combatPower]);

  // 智能配息雷達
const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
const events: { type: 'ex' | 'pay', dateObj: Date, dateStr: string, etfName: string, amount: number }[] = [];

etfs.forEach(e => {
if (e.schedule) {
e.schedule.forEach(ev => {
          if (ev.exDate) {
            const d = new Date(ev.exDate);
            if (!isNaN(d.getTime()) && d >= today) events.push({ type: 'ex', dateObj: d, dateStr: ev.exDate, etfName: e.name, amount: ev.amount });
          }
          if (ev.payDate) {
            const d = new Date(ev.payDate);
            if (!isNaN(d.getTime()) && d >= today) events.push({ type: 'pay', dateObj: d, dateStr: ev.payDate, etfName: e.name, amount: ev.amount });
          }
          if (ev.exDate) { const d = new Date(ev.exDate); if (!isNaN(d.getTime()) && d >= today) events.push({ type: 'ex', dateObj: d, dateStr: ev.exDate, etfName: e.name, amount: ev.amount }); }
          if (ev.payDate) { const d = new Date(ev.payDate); if (!isNaN(d.getTime()) && d >= today) events.push({ type: 'pay', dateObj: d, dateStr: ev.payDate, etfName: e.name, amount: ev.amount }); }
});
}
});

return events.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()).slice(0, 4);
}, [etfs]);

  // 雪球計算
const snowballData = useMemo(() => {
const avgYield = totalValue > 0 ? totalDividend / totalValue : 0.05;
const data: any[] = []; let curWealth = totalValue;
@@ -496,33 +501,22 @@ export default function App() {
return data;
}, [totalValue, totalDividend, reinvest, loans, creditLoan, stockLoan, globalMarginLoan, taxStatus, etfs, selectedYear]);

  const pieData = [
    { name: '配息', value: Math.max(1, actualDiv), color: COLORS.dividend }, 
    { name: '避險', value: Math.max(1, actualHedge), color: COLORS.hedging }, 
    { name: '主動', value: Math.max(1, actualAct), color: COLORS.active }
  ];
  
  const radarData = [
    { subject: '現金流', A: Math.min(100, fireRatio) }, 
    { subject: '安全性', A: Math.min(100, (actualHedge / (totalValue - totalStockDebt || 1)) * 500) }, 
    { subject: '維持率', A: Math.min(100, (currentMaintenance - 130) * 2) }, 
    { subject: '成長', A: Math.min(100, (actualAct / (totalValue - totalStockDebt || 1)) * 500) }
  ];
  // 圖表資料
  const pieData = [{ name: '配息', value: Math.max(1, actualDiv), color: COLORS.dividend }, { name: '避險', value: Math.max(1, actualHedge), color: COLORS.hedging }, { name: '主動', value: Math.max(1, actualAct), color: COLORS.active }];
  const radarData = [{ subject: '現金流', A: Math.min(100, fireRatio) }, { subject: '安全性', A: Math.min(100, (actualHedge / (totalValue - totalStockDebt || 1)) * 500) }, { subject: '維持率', A: Math.min(100, (currentMaintenance - 130) * 2) }, { subject: '成長', A: Math.min(100, (actualAct / (totalValue - totalStockDebt || 1)) * 500) }];

  // UI 互動函數
const moveEtf = (i: number, d: number) => { setEtfs((prev) => { const n = [...prev]; if (i + d < 0 || i + d >= n.length) return prev; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; }); };
const removeEtf = (id: string) => { if (confirm('確定刪除？')) setEtfs((prev) => prev.filter((e) => e.id !== id)); };

const updateLoan = (i: number, f: string, v: any) => { 
setLoans((prev) => { 
      const n = [...prev]; 
      if (!n[i]) return prev; 
      const n = [...prev]; if (!n[i]) return prev; 
if (f === 'startDate' && v) { 
const start = new Date(v); const now = new Date(); 
const dm = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()); 
n[i] = { ...n[i], startDate: v, paidMonths: Math.max(0, dm) }; 
      } else { 
        n[i] = { ...n[i], [f]: v }; 
      } 
      } else { n[i] = { ...n[i], [f]: v }; } 
return n; 
}); 
};
@@ -541,10 +535,7 @@ export default function App() {
const initYearSchedule = (etfId: string) => {
setEtfs((prev) => prev.map((etf) => {
if (etf.id !== etfId) return etf;
        const evs: DividendEvent[] = [1, 2, 3, 4].map((q) => ({
          id: `${Date.now()}-q${q}`, year: selectedYear, name: `${selectedYear} Q${q}`,
          exDate: '', payDate: '', amount: safeNum(etf.dividendPerShare), isActual: false,
        }));
        const evs: DividendEvent[] = [1, 2, 3, 4].map((q) => ({ id: `${Date.now()}-q${q}`, year: selectedYear, name: `${selectedYear} Q${q}`, exDate: '', payDate: '', amount: safeNum(etf.dividendPerShare), isActual: false }));
return { ...etf, schedule: [...(etf.schedule || []), ...evs] };
}));
};
@@ -554,115 +545,61 @@ export default function App() {
setIsUpdatingPrices(true);
try {
const url = cloudConfig.priceSourceUrl.includes('/edit') ? cloudConfig.priceSourceUrl.replace(/\/edit.*$/, '/export?format=csv') : cloudConfig.priceSourceUrl;
      const res = await fetch(url); 
      const text = await res.text(); 
      
      const priceMap = new Map<string, any>();
      text.trim().split(/\r?\n/).forEach((r) => { 
        const cols = r.split(',').map((x) => x.trim()); 
        if (cols.length >= 2 && cols[0] && cols[0].toLowerCase() !== 'code') { 
          const price = parseFloat(cols[1]); 
          const divAmount = cols[2] ? parseFloat(cols[2]) : undefined;
          const exDate = cols[3] || undefined;
          const payDate = cols[4] || undefined;
          if (Number.isFinite(price)) priceMap.set(cols[0], { price, divAmount, exDate, payDate }); 
        } 
      });

      setEtfs((prev) => prev.map((e) => { 
        const key = (e.code || e.id || '').trim(); 
        const info = priceMap.get(key);
        if (info) {
           let updatedE = { ...e, currentPrice: info.price };
           if (info.divAmount !== undefined && !isNaN(info.divAmount)) updatedE.dividendPerShare = info.divAmount;
           return updatedE;
        }
        return e; 
      }));
      alert('行情與配息資訊更新成功！');
    } catch (e) { alert('更新失敗，請檢查網址或網路狀態。'); } finally { setIsUpdatingPrices(false); }
      const res = await fetch(url); const text = await res.text(); const priceMap = parseCsvPriceMap(text);
      setEtfs((prev) => prev.map((e) => { const key = (e.code || e.id || '').trim(); return priceMap.has(key) ? { ...e, currentPrice: priceMap.get(key)! } : e; }));
      alert('行情更新成功！');
    } catch (e) { alert('更新失敗。'); } finally { setIsUpdatingPrices(false); }
};

  // V92: 終極防護，改用開源 FinMind API 直接抓取
  const handleScanAPI = async () => {
  const handleScanTWSE = async () => {
setIsScanningTwse(true);
    let updatedCount = 0;
    const tokenParam = cloudConfig.finMindToken ? `&token=${cloudConfig.finMindToken}` : '';
    
try {
      const newEtfs = await Promise.all(etfs.map(async (etf) => {
          if (!etf.code || !etf.category || etf.category === 'hedging') return etf; // 跳過避險類
          try {
              // 連線至 FinMind API 抓取特定年份資料
              const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDividendResult&data_id=${etf.code}&start_date=${selectedYear}-01-01${tokenParam}`;
              const res = await fetch(url);
              const data = await res.json();
              
              if (data.status === 200 && data.data && data.data.length > 0) {
                  let currentSchedule = [...(etf.schedule || [])];
                  let modified = false;

                  data.data.forEach((divEvent: any) => {
                      const exDateStr = divEvent.date; // 除息日
                      const payDateStr = divEvent.cash_payout_date || ''; // 發放日
                      const amount = divEvent.cash_dividend;

                      if (!exDateStr || amount === undefined || amount === 0) return;
                      
                      const evYear = parseInt(exDateStr.split('-')[0], 10);
                      if (evYear !== selectedYear) return;

                      const existingIdx = currentSchedule.findIndex(ev => ev.exDate === exDateStr);
                      if (existingIdx >= 0) {
                          if (currentSchedule[existingIdx].amount !== amount || currentSchedule[existingIdx].payDate !== payDateStr) {
                              currentSchedule[existingIdx].amount = amount;
                              if(payDateStr) currentSchedule[existingIdx].payDate = payDateStr;
                              modified = true;
                          }
                      } else {
                          const emptyIdx = currentSchedule.findIndex(ev => ev.year === evYear && !ev.exDate);
                          if (emptyIdx >= 0) {
                              currentSchedule[emptyIdx].exDate = exDateStr;
                              currentSchedule[emptyIdx].payDate = payDateStr;
                              currentSchedule[emptyIdx].amount = amount;
                          } else {
                              currentSchedule.push({
                                  id: `auto-${Date.now()}-${Math.random()}`,
                                  year: evYear,
                                  name: `${evYear} 自動同步`,
                                  exDate: exDateStr,
                                  payDate: payDateStr,
                                  amount: amount,
                                  isActual: false
                              });
                          }
                          modified = true;
                      }
                  });

                  if (modified) {
                      updatedCount++;
                      return { ...etf, schedule: currentSchedule };
                  }
              }
          } catch (err) {
              console.warn(`FinMind fetch error for ${etf.code}:`, err);
      const targetUrl = 'https://openapi.twse.com.tw/v1/exchangeReport/TWT49U';
      const encodedTarget = encodeURIComponent(targetUrl);
      const proxies = [
        { url: `https://api.allorigins.win/get?url=${encodedTarget}`, parse: async (res: Response) => { const d = await res.json(); return JSON.parse(d.contents); } },
        { url: `https://corsproxy.io/?${encodedTarget}`, parse: async (res: Response) => await res.json() },
        { url: `https://api.codetabs.com/v1/proxy?quest=${encodedTarget}`, parse: async (res: Response) => await res.json() }
      ];

      let data = null; let fetchSuccess = false;
      for (const proxy of proxies) {
        try {
          const res = await fetch(proxy.url, { cache: 'no-store' });
          if (res.ok) { data = await proxy.parse(res); if (Array.isArray(data) && data.length > 0) { fetchSuccess = true; break; } }
        } catch (err) {}
      }
      if (!fetchSuccess || !data) throw new Error('證交所防火牆阻擋');

      let updatedCount = 0;
      setEtfs(prev => prev.map(etf => {
          const match = data.find((d: any) => d.Code === etf.code);
          if(!match) return etf;
          const rocStr = match.Date;
          if(!rocStr || rocStr.length !== 7) return etf;
          const year = parseInt(rocStr.substring(0,3)) + 1911;
          const month = rocStr.substring(3,5);
          const day = rocStr.substring(5,7);
          const exDateStr = `${year}-${month}-${day}`;
          const amount = parseFloat(match.Dividend || '0');
          if (amount === 0) return etf;
          const currentSchedule = etf.schedule || [];
          const existingIdx = currentSchedule.findIndex(ev => ev.exDate === exDateStr);
          let newSchedule = [...currentSchedule];
          if (existingIdx >= 0) {
              newSchedule[existingIdx].amount = amount;
          } else {
              const emptyIdx = newSchedule.findIndex(ev => ev.year === year && !ev.exDate);
              if (emptyIdx >= 0) { newSchedule[emptyIdx].exDate = exDateStr; newSchedule[emptyIdx].amount = amount; }
              else { newSchedule.push({ id: `auto-${Date.now()}`, year, name: `${year} 證交所同步`, exDate: exDateStr, payDate: '', amount, isActual: false }); }
}
          return etf;
          updatedCount++;
          return { ...etf, schedule: newSchedule, dividendPerShare: amount };
}));

      setEtfs(newEtfs);
      if (updatedCount > 0) {
          alert(`掃描完成！成功透過 FinMind API 同步 ${updatedCount} 檔 ETF 的「除息日」與「發放日」。`);
      } else {
          alert(`掃描完成！${selectedYear} 年目前沒有新的配息資料。`);
      }
      alert(`掃描完成！成功同步 ${updatedCount} 檔即將除息的 ETF 資料。`);
} catch(e) {
      console.error("API Fetch Error:", e);
      alert('API 連線失敗，請檢查網路或 API Token 狀態。');
    } finally {
      setIsScanningTwse(false);
    }
      alert('所有通道皆被阻擋。\n\n請在 Google Sheet CSV 加入配息資料，點擊右上角「綠色更新按鈕」即可自動匯入行事曆！');
    } finally { setIsScanningTwse(false); }
};

const handleReset = async () => {
@@ -676,6 +613,8 @@ export default function App() {

return (
<div className="min-h-screen p-4 md:p-8 bg-slate-950 text-white font-sans selection:bg-emerald-500/30">
      
      {/* Header */}
<header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-center">
<div>
<h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center gap-2 drop-shadow-md"><Calculator className="text-emerald-400"/> 包租唐戰情室 V92</h1>
@@ -687,37 +626,32 @@ export default function App() {
</div>
</div>
<div className="flex gap-2">
          <button onClick={handleUpdatePrices} className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-emerald-400 hover:bg-emerald-900/50 hover:scale-105 transition-all shadow-md" title="更新行情"><RefreshCw size={18} className={isUpdatingPrices ? "animate-spin" : ""} /></button>
          <button onClick={() => setShowSettings(true)} className="p-2 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 hover:scale-105 transition-all shadow-md" title="設定"><Settings size={18} /></button>
          <button onClick={handleReset} className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-red-400 hover:bg-red-900/50 hover:scale-105 transition-all shadow-md" title="重置"><RotateCcw size={18} /></button>
          <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { try { const raw = JSON.parse(ev.target?.result as string); const d = sanitizePayload(raw); setEtfs(d.etfs); setLoans(d.loans || []); setStockLoan(d.stockLoan || DEFAULT_STOCK_LOAN); setGlobalMarginLoan(d.globalMarginLoan || DEFAULT_GLOBAL_MARGIN); setCreditLoan(d.creditLoan || DEFAULT_CREDIT); setTaxStatus(d.taxStatus || DEFAULT_TAX); setAllocation(d.allocation || DEFAULT_ALLOC); setCloudConfig(d.cloudConfig || DEFAULT_CLOUD); setActualDetails(d.actualDetails || {}); setMonthlyRecords(d.monthlyRecords || {}); alert('匯入成功！戰情室資料已更新。'); } catch (err) { alert('檔案格式錯誤'); } }; r.readAsText(f); }} className="hidden" accept=".json" />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-blue-400 hover:bg-blue-900/50 hover:scale-105 transition-all shadow-md" title="匯入存檔"><Upload size={18} /></button>
          <button onClick={() => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, actualDetails, monthlyRecords })} className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-amber-400 hover:bg-amber-900/50 hover:scale-105 transition-all shadow-md" title="匯出備份"><Download size={18} /></button>
          <button onClick={handleUpdatePrices} className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-emerald-400 hover:bg-emerald-900/50 hover:scale-105 transition-all shadow-md"><RefreshCw size={18} className={isUpdatingPrices ? "animate-spin" : ""} /></button>
          <button onClick={() => setShowSettings(true)} className="p-2 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 hover:scale-105 transition-all shadow-md"><Settings size={18} /></button>
          <button onClick={handleReset} className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-red-400 hover:bg-red-900/50 hover:scale-105 transition-all shadow-md"><RotateCcw size={18} /></button>
          <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { try { const raw = JSON.parse(ev.target?.result as string); const d = sanitizePayload(raw); setEtfs(d.etfs); setLoans(d.loans || []); setStockLoan(d.stockLoan || DEFAULT_STOCK_LOAN); setGlobalMarginLoan(d.globalMarginLoan || DEFAULT_GLOBAL_MARGIN); setCreditLoan(d.creditLoan || DEFAULT_CREDIT); setTaxStatus(d.taxStatus || DEFAULT_TAX); setAllocation(d.allocation || DEFAULT_ALLOC); setCloudConfig(d.cloudConfig || DEFAULT_CLOUD); setActualDetails(d.actualDetails || {}); setMonthlyRecords(d.monthlyRecords || {}); alert('匯入成功！'); } catch (err) { alert('檔案格式錯誤'); } }; r.readAsText(f); }} className="hidden" accept=".json" />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-blue-400 hover:bg-blue-900/50 hover:scale-105 transition-all shadow-md"><Upload size={18} /></button>
          <button onClick={() => StorageService.exportToFile({ etfs, loans, stockLoan, creditLoan, globalMarginLoan, taxStatus, allocation, cloudConfig, actualDetails, monthlyRecords })} className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-amber-400 hover:bg-amber-900/50 hover:scale-105 transition-all shadow-md"><Download size={18} /></button>
</div>
</header>

      {/* V92 智能配息雷達 (FinMind API 直連) */}
      {/* 智能配息雷達 */}
<div className="mb-8">
<div className="bg-slate-900 border border-emerald-900/50 rounded-xl p-4 shadow-lg relative overflow-hidden">
<div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><BellRing size={80} /></div>
            
<div className="flex justify-between items-center mb-3">
<h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2"><BellRing size={16} /> 近期戰情報告 (配息提醒)</h2>
                {/* FinMind API 掃描按鈕 */}
                <button onClick={handleScanAPI} disabled={isScanningTwse} className="px-3 py-1.5 bg-emerald-900/40 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-700/50 hover:bg-emerald-800 hover:text-white transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(5,150,105,0.2)] disabled:opacity-50 disabled:cursor-not-allowed">
                    {isScanningTwse ? <Loader2 size={12} className="animate-spin"/> : <Database size={12}/>} 
                    {isScanningTwse ? '連線 FinMind 同步中...' : '連線 FinMind API 同步'}
                <button onClick={handleScanTWSE} disabled={isScanningTwse} className="px-3 py-1.5 bg-emerald-900/40 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-700/50 hover:bg-emerald-800 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50">
                    {isScanningTwse ? <Loader2 size={12} className="animate-spin"/> : <Search size={12}/>} 
                    {isScanningTwse ? '穿透掃描中...' : '掃描證交所公告'}
</button>
</div>
            
{upcomingEvents.length > 0 ? (
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
{upcomingEvents.map((ev, i) => (
<div key={i} className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex flex-col gap-1 hover:border-emerald-700/50 transition-colors">
<div className="flex items-center justify-between">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${ev.type === 'ex' ? 'bg-orange-900/40 text-orange-400 border border-orange-800/50' : 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50'}`}>
                                    {ev.type === 'ex' ? '即將除息' : '即將發放'}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${ev.type === 'ex' ? 'bg-orange-900/40 text-orange-400 border border-orange-800/50' : 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50'}`}>{ev.type === 'ex' ? '即將除息' : '即將發放'}</span>
<span className="text-xs font-mono text-slate-300">{ev.dateStr}</span>
</div>
<div className="text-sm font-bold text-slate-100 truncate mt-1">{ev.etfName}</div>
@@ -726,13 +660,18 @@ export default function App() {
))}
</div>
) : (
                <div className="text-sm text-slate-500 py-2 relative z-10">目前行事曆沒有即將到來的事件。您可以點擊右上角按鈕，透過 FinMind API 自動同步最新配息公告。</div>
                <div className="text-sm text-slate-500 py-2 relative z-10">目前行事曆無事件。點擊「掃描證交所」自動抓取近期除息資訊。</div>
)}
</div>
</div>

      {/* Main Grid 1: 面板與資產分配 */}
<div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* 左側欄 */}
<div className="xl:col-span-4 space-y-6">
          
          {/* RPG 面板 */}
<div className="bg-slate-900 p-1 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden">
<div className="bg-slate-900 p-5 rounded-xl h-full w-full">
<div className="flex items-center gap-4 mb-4">
@@ -749,23 +688,18 @@ export default function App() {
<div className={`text-4xl font-black italic ${healthGrade.includes('S') ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'text-blue-400'}`}>{healthGrade}</div>
</div>
</div>

<div className="mb-6 relative">
<div className="flex justify-between text-[10px] text-slate-400 mb-1 font-bold"><span>EXP</span><span>{progress.toFixed(1)}%</span></div>
<div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 shadow-inner">
                      <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full relative" style={{ width: `${progress}%` }}>
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                      <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full relative" style={{ width: `${progress}%` }}></div>
</div>
</div>

<div className="grid grid-cols-4 gap-2 border-t border-slate-800 pt-4">
                <div className="text-center bg-slate-800/50 p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-default"><div className="text-slate-500 text-[9px] mb-1 font-bold">攻擊力(年息)</div><div className="font-mono font-bold text-emerald-400 text-sm">{formatMoney(totalDividend)}</div></div>
                <div className="text-center bg-slate-800/50 p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-default"><div className="text-slate-500 text-[9px] mb-1 font-bold">防禦力(維持)</div><div className={`font-bold text-sm ${currentMaintenance < 140 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>{currentMaintenance === 999 ? 'MAX' : currentMaintenance.toFixed(0) + '%'}</div></div>
                <div className="text-center bg-slate-800/50 p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-default"><div className="text-slate-500 text-[9px] mb-1 font-bold">回血(月淨流)</div><div className={`font-mono font-bold text-sm ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-500 animate-pulse'}`}>{formatMoney(totalNet / 12)}</div></div>
                <div className="text-center bg-slate-800/50 p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-default"><div className="text-slate-500 text-[9px] mb-1 font-bold">日產金率</div><div className="font-mono font-bold text-yellow-400 text-sm">{formatMoney(totalDividend / 365)}</div></div>
                <div className="text-center bg-slate-800/50 p-2 rounded-lg"><div className="text-slate-500 text-[9px] mb-1 font-bold">攻擊力(年息)</div><div className="font-mono font-bold text-emerald-400 text-sm">{formatMoney(totalDividend)}</div></div>
                <div className="text-center bg-slate-800/50 p-2 rounded-lg"><div className="text-slate-500 text-[9px] mb-1 font-bold">防禦力(維持)</div><div className={`font-bold text-sm ${currentMaintenance < 140 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>{currentMaintenance === 999 ? 'MAX' : currentMaintenance.toFixed(0) + '%'}</div></div>
                <div className="text-center bg-slate-800/50 p-2 rounded-lg"><div className="text-slate-500 text-[9px] mb-1 font-bold">回血(月淨流)</div><div className={`font-mono font-bold text-sm ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-500 animate-pulse'}`}>{formatMoney(totalNet / 12)}</div></div>
                <div className="text-center bg-slate-800/50 p-2 rounded-lg"><div className="text-slate-500 text-[9px] mb-1 font-bold">日產金率</div><div className="font-mono font-bold text-yellow-400 text-sm">{formatMoney(totalDividend / 365)}</div></div>
</div>

<div className="mt-4 bg-slate-950 rounded-lg p-3 border border-slate-800 text-[10px] font-mono overflow-hidden h-24 relative flex flex-col justify-end">
<div className="absolute top-2 left-2 text-slate-600 flex items-center gap-1"><MessageSquareText size={10}/> 戰鬥日誌</div>
<div className="space-y-1 opacity-80 text-slate-300">
@@ -777,6 +711,7 @@ export default function App() {
</div>
</div>

          {/* 榮譽殿堂 */}
<div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl relative">
<h2 className="text-sm font-bold mb-3 text-yellow-400 flex items-center gap-2"><Trophy size={16}/> 榮譽殿堂 (Trophy Room)</h2>
<div className="grid grid-cols-2 gap-3">
@@ -794,11 +729,13 @@ export default function App() {
</div>
</div>

          {/* 雷達圖 */}
<section className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
<h2 className="text-sm font-bold mb-4 text-cyan-400 flex items-center gap-2"><ShieldCheck size={16}/> 角色屬性雷達</h2>
<div className="h-48 -ml-4"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData}><PolarGrid stroke="#1e293b" /><PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} /><Radar dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} /></RadarChart></ResponsiveContainer></div>
</section>

          {/* 標的清單 */}
<section className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
<h2 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2"><Activity /> 裝備庫 (標的清單)</h2>
<div className="space-y-4">
@@ -849,10 +786,7 @@ export default function App() {
</div>
))
) : (
                          <div className="text-center py-4 bg-slate-950 rounded-lg border border-dashed border-slate-800">
                             <div className="text-xs text-slate-500 mb-3">此裝備尚未設定 {selectedYear} 年配息資料</div>
                             <button onClick={() => initYearSchedule(e.id)} className="px-5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-1 mx-auto"><Plus size={14}/> 初始化行事曆</button>
                          </div>
                          <button onClick={() => initYearSchedule(e.id)} className="w-full px-5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-1 mx-auto"><Plus size={14}/> 初始化行事曆</button>
)}
</div>
</div>
@@ -894,6 +828,7 @@ export default function App() {
</section>
</div>

        {/* 右側欄：對帳與雪球 */}
<div className="xl:col-span-8 space-y-6">
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-slate-900 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-lg relative overflow-hidden group">
@@ -927,7 +862,6 @@ export default function App() {
<button onClick={() => setSelectedYear(y => y + 1)} className="px-3 py-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md transition-colors text-xs">▶</button>
</div>
</div>
            
<div className="h-72 w-full">
<ResponsiveContainer width="100%" height="100%">
<AreaChart data={snowballData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
@@ -940,11 +874,7 @@ export default function App() {
<CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
<XAxis dataKey="year" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
<YAxis stroke="#64748b" width={60} tickFormatter={(value) => `${Math.floor(value / 10000)}W`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip 
                      formatter={(v: any) => [formatMoney(v), '預估資產']} 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
                  />
                  <Tooltip formatter={(v: any) => [formatMoney(v), '預估資產']} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }} />
<Area type="monotone" dataKey="wealth" stroke="#0ea5e9" strokeWidth={3} fill="url(#colorWealth)" animationDuration={1500} />
</AreaChart>
</ResponsiveContainer>
@@ -957,7 +887,6 @@ export default function App() {

<div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl overflow-x-auto">
<h3 className="text-lg font-bold mb-6 text-emerald-400 flex items-center gap-2"><Calendar size={20}/> {selectedYear} 戰術對帳面板</h3>
            
<table className="w-full text-sm text-left border-collapse">
<thead className="text-slate-400 bg-slate-950/80 text-[10px] uppercase tracking-wider">
<tr>
@@ -988,15 +917,13 @@ export default function App() {
<td className="p-3 text-red-400/80">{formatMoney(r.loanOut)}</td>
<td className="p-3 text-orange-400/80">{formatMoney(r.creditOut)}</td>
<td className="p-3 text-blue-300/80">{formatMoney(r.stockInt)}</td>
                      
<td className="p-3">
{r.isActualLife ? (
<div className="text-yellow-400 font-bold" title={`本月預算: ${formatMoney(r.budgetLife)}`}>{formatMoney(r.life)}<br/><span className="text-[8px] text-yellow-600/80 font-sans tracking-widest">(實支)</span></div>
) : (
<div className="text-slate-500">{formatMoney(r.life)}<br/><span className="text-[8px] opacity-40 font-sans tracking-widest">(預算)</span></div>
)}
</td>

<td className="p-3 text-purple-400/70 text-[9px]">{formatMoney(r.healthTax)}<br/><span className="opacity-40">+{formatMoney(r.incomeTax)}</span></td>
<td className={`p-3 text-right font-bold text-sm ${r.net >= 0 ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]' : 'text-red-400'}`}>{formatMoney(r.net)}</td>
</tr>
@@ -1008,12 +935,10 @@ export default function App() {

<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b border-slate-800">
<div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                                      <div className="text-[11px] text-slate-400 mb-3 font-bold uppercase tracking-wider flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div> 本月生活費結算</div>
                                      <div className="text-[11px] text-slate-400 mb-3 font-bold uppercase tracking-wider flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div> 本月生活費設定</div>
<div className="flex items-center gap-3">
                                          <span className="text-slate-500 text-xs whitespace-nowrap">實際支出:</span>
                                          <input type="number" placeholder={`留白則套用預算 ${formatMoney(taxStatus.livingExpenses)}`} value={monthlyRecords[`${selectedYear}_${r.month}`]?.livingExpense ?? ''} onChange={e => updateMonthlyRecord(selectedYear, r.month, 'livingExpense', e.target.value === '' ? undefined : safeNum(e.target.value))} className="w-full bg-slate-950 border border-slate-700 focus:border-yellow-500 rounded-lg px-3 py-2 text-sm text-yellow-400 font-bold outline-none transition-colors" onClick={e => e.stopPropagation()} />
                                          <input type="number" placeholder={`預設值: ${formatMoney(taxStatus.livingExpenses)}`} value={monthlyRecords[`${selectedYear}_${r.month}`]?.livingExpense ?? ''} onChange={e => updateMonthlyRecord(selectedYear, r.month, 'livingExpense', e.target.value === '' ? undefined : safeNum(e.target.value))} className="w-full bg-slate-950 border border-slate-700 focus:border-yellow-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors" onClick={e => e.stopPropagation()} />
</div>
                                      <div className="text-[9px] text-slate-600 mt-2">每月預算設定為 {formatMoney(taxStatus.livingExpenses)}，輸入實際金額以精準計算淨流。</div>
</div>
<div className="bg-blue-950/10 rounded-xl p-4 border border-blue-900/30">
<div className="text-[11px] text-blue-400 mb-3 font-bold uppercase tracking-wider flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> 額外戰利品 (其他收入)</div>
@@ -1101,13 +1026,7 @@ export default function App() {
<div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
<label className="text-slate-400 block mb-2 font-bold text-xs uppercase tracking-wider flex items-center gap-2"><Wifi size={14} className="text-blue-400"/> Google Sheet CSV 行情連結</label>
<input type="text" value={cloudConfig.priceSourceUrl} onChange={(e) => setCloudConfig({ ...cloudConfig, priceSourceUrl: e.target.value })} className="w-full bg-slate-900 p-2.5 rounded-lg border border-slate-700 outline-none focus:border-blue-500 text-xs text-slate-300" placeholder="https://docs.google.com/spreadsheets/..." />
                
                {/* V92: 加入 FinMind Token 欄位 */}
                <div className="mt-4 border-t border-slate-800 pt-4">
                    <label className="text-slate-400 block mb-2 font-bold text-xs uppercase tracking-wider flex items-center gap-2"><Database size={14} className="text-emerald-400"/> FinMind API Token (選填)</label>
                    <input type="text" value={cloudConfig.finMindToken || ''} onChange={(e) => setCloudConfig({ ...cloudConfig, finMindToken: e.target.value })} className="w-full bg-slate-900 p-2.5 rounded-lg border border-slate-700 outline-none focus:border-emerald-500 text-xs text-slate-300" placeholder="若免費額度(300次/時)不夠，可填寫您的專屬 Token" />
                    <div className="text-[10px] text-slate-500 mt-2">系統已自動切換至台灣最大開源金融 API (FinMind)，無 Token 亦可直接使用免費額度自動抓取「除息日」與「發放日」！</div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2">V92: 您可以在 CSV 檔加入「預估配息」、「除息日」、「發放日」欄位，系統將自動同步至行事曆。格式：<span className="font-mono text-emerald-400">代號,現價,配息金額,2026-01-01,2026-02-01</span></div>
</div>

<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
@@ -1144,4 +1063,57 @@ export default function App() {
<div className="space-y-3">
<div><label className="text-slate-400 text-[10px] font-bold block mb-1">全域預設月生活費</label><input type="number" value={taxStatus.livingExpenses} onChange={(e) => setTaxStatus({ ...taxStatus, livingExpenses: safeNum(e.target.value) })} className="w-full bg-slate-900 p-2 rounded-lg outline-none border border-transparent focus:border-blue-500 text-emerald-400 font-mono" /></div>
<div className="flex gap-3 bg-slate-900 p-2 rounded-lg">
                        <div className="flex-1"><label className="text-slate-500 text-[10px] block mb-1">信貸餘額</label><input type="number" value={creditLoan.principal} onChange={(e) => setCreditLoan({ ...creditLoan, principal
                        <div className="flex-1"><label className="text-slate-500 text-[10px] block mb-1">信貸餘額</label><input type="number" value={creditLoan.principal} onChange={(e) => setCreditLoan({ ...creditLoan, principal: safeNum(e.target.value) })} className="w-full bg-slate-950 p-1.5 rounded outline-none border border-transparent focus:border-blue-500" /></div>
                        <div className="w-16"><label className="text-slate-500 text-[10px] block mb-1">利率%</label><input type="number" value={creditLoan.rate} onChange={(e) => setCreditLoan({ ...creditLoan, rate: safeNum(e.target.value) })} className="w-full bg-slate-950 p-1.5 rounded outline-none border border-transparent focus:border-blue-500" /></div>
                    </div>
                    <div className="flex gap-3 bg-slate-900 p-2 rounded-lg">
                        <div className="flex-1"><label className="text-slate-500 text-[10px] block mb-1">借貸本金 (維持率)</label><input type="number" value={stockLoan.principal} onChange={(e) => setStockLoan({ ...stockLoan, principal: safeNum(e.target.value) })} className="w-full bg-slate-950 p-1.5 rounded outline-none border border-transparent focus:border-blue-500" /></div>
                        <div className="w-16"><label className="text-slate-500 text-[10px] block mb-1">利率%</label><input type="number" value={stockLoan.rate} onChange={(e) => setStockLoan({ ...stockLoan, rate: safeNum(e.target.value) })} className="w-full bg-slate-950 p-1.5 rounded outline-none border border-transparent focus:border-blue-500" /></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h4 className="text-red-400 font-bold mb-3 text-xs uppercase tracking-wider flex items-center justify-between">
                    房貸戰線設定
                    <button onClick={() => setLoans((prev) => [...prev, { id: Date.now().toString(), name: '新房貸', principal: 0, rate1: 2.1, rate1Months: 36, rate2: 2.3, totalMonths: 360, paidMonths: 0, gracePeriod: 0, type: 'PrincipalAndInterest' }])} className="text-[10px] bg-red-900/30 text-red-400 px-2 py-1 rounded hover:bg-red-900/50 transition-colors flex items-center gap-1"><Plus size={10}/> 新增房貸</button>
                </h4>
                
                <div className="space-y-3">
                    {loans.map((l, i) => (
                      <div key={l.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                        <div className="flex gap-3 mb-2">
                            <div className="w-1/3"><label className="text-slate-500 text-[9px] block mb-0.5">名稱</label><input type="text" value={l.name} onChange={(e) => updateLoan(i, 'name', e.target.value)} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500 border border-transparent" /></div>
                            <div className="flex-1"><label className="text-slate-500 text-[9px] block mb-0.5">本金</label><input type="number" value={l.principal} onChange={(e) => updateLoan(i, 'principal', safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500 border border-transparent font-mono" /></div>
                            <div className="w-8 flex items-end justify-end"><button onClick={() => setLoans((prev) => prev.filter((x) => x.id !== l.id))} className="p-1.5 text-slate-600 hover:text-red-500 bg-slate-950 rounded mb-0.5"><Trash2 size={12}/></button></div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-2">
                            <div><label className="text-slate-600 text-[8px] block mb-0.5">1段利率%</label><input type="number" step="0.001" value={l.rate1} onChange={(e) => updateLoan(i, 'rate1', safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500 border border-transparent" /></div>
                            <div><label className="text-slate-600 text-[8px] block mb-0.5">1段月數</label><input type="number" value={l.rate1Months} onChange={(e) => updateLoan(i, 'rate1Months', safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500 border border-transparent" /></div>
                            <div><label className="text-slate-600 text-[8px] block mb-0.5">2段利率%</label><input type="number" step="0.001" value={l.rate2} onChange={(e) => updateLoan(i, 'rate2', safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500 border border-transparent" /></div>
                            <div><label className="text-slate-600 text-[8px] block mb-0.5">總期數</label><input type="number" value={l.totalMonths} onChange={(e) => updateLoan(i, 'totalMonths', safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500 border border-transparent" /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div><label className="text-emerald-500/70 text-[8px] font-bold block mb-0.5">撥款日 (動態起算)</label><input type="date" value={l.startDate || ''} onChange={(e) => updateLoan(i, 'startDate', e.target.value)} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none border border-emerald-900/50 focus:border-emerald-500 text-slate-300" /></div>
                            <div><label className="text-slate-600 text-[8px] block mb-0.5">寬限期(月)</label><input type="number" value={l.gracePeriod} onChange={(e) => updateLoan(i, 'gracePeriod', safeNum(e.target.value))} className="w-full bg-slate-950 p-1.5 rounded text-xs outline-none focus:border-red-500 border border-transparent" /></div>
                            <div><label className="text-slate-600 text-[8px] block mb-0.5">已繳</label><input type="number" disabled value={l.paidMonths} className="w-full bg-slate-950/50 p-1.5 rounded text-xs text-slate-600 cursor-not-allowed font-mono" /></div>
                        </div>
                      </div>
                    ))}
                    {loans.length === 0 && <div className="text-center py-4 text-xs text-slate-600 border border-dashed border-slate-800 rounded-lg">目前無房貸負擔</div>}
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex gap-3">
                <button onClick={() => setShowSettings(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-colors">取消 / 返回</button>
                <button onClick={() => setShowSettings(false)} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black shadow-[0_0_15px_rgba(5,150,105,0.4)] hover:bg-emerald-500 transition-all transform hover:scale-[1.02]">儲存設定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
