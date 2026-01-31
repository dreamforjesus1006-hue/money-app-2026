import React, { useState } from 'react';
import { Activity, ShoppingCart, List, Trash2, X, Tag } from 'lucide-react';
// 👇 注意這裡改成了 ../../types
import { ETF } from '../../types';

const BROKERAGE_RATE = 0.001425;

interface AssetListProps {
  etfs: ETF[];
  setEtfs: React.Dispatch<React.SetStateAction<ETF[]>>;
}

export const AssetList: React.FC<AssetListProps> = ({ etfs, setEtfs }) => {
  const [expandedEtfId, setExpandedEtfId] = useState<string | null>(null);
  const [activeBuyId, setActiveBuyId] = useState<string | null>(null);
  const [buyForm, setBuyForm] = useState<{shares: string, price: string, date: string, margin: string}>({ shares: '', price: '', date: '', margin: '' });
  const [newLot, setNewLot] = useState<{shares: string, price: string, date: string, margin: string}>({ shares: '', price: '', date: '', margin: '' });

  const updateEtf = (i: number, field: keyof ETF, val: any) => {
    const n = [...etfs];
    n[i] = { ...n[i], [field]: val };
    setEtfs(n);
  };

  const addEtf = () => {
    setEtfs([...etfs, { 
      id: Date.now().toString(), code: '', name: '新標的', 
      shares: 0, costPrice: 0, currentPrice: 0, 
      dividendPerShare: 0, dividendType: 'annual', payMonths: [], 
      marginLoanAmount: 0, marginInterestRate: 0, lots: [], category: 'dividend' 
    }]);
  };

  const removeEtf = (id: string) => {
    if (window.confirm('確定刪除此標的？')) setEtfs(etfs.filter(e => e.id !== id));
  };

  const toggleLots = (id: string) => { setExpandedEtfId(expandedEtfId === id ? null : id); setActiveBuyId(null); };
  const toggleBuy = (id: string) => { setActiveBuyId(activeBuyId === id ? null : id); setExpandedEtfId(null); };

  const submitBuy = (i: number) => {
    const s = Number(buyForm.shares), p = Number(buyForm.price), m = Number(buyForm.margin); 
    if (!s || !p) return;
    const targetEtf = etfs[i];
    const fee = targetEtf.category === 'hedging' ? 0 : Math.floor(s * p * BROKERAGE_RATE);
    
    const n = [...etfs]; 
    const l = n[i].lots ? [...n[i].lots!] : [];
    l.push({ id: Date.now().toString(), date: buyForm.date, shares: s, price: p, fee, margin: m });
    
    const totalShares = l.reduce((a, b) => a + b.shares, 0);
    const totalCost = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0);
    const totalMargin = l.reduce((a, b) => a + (b.margin || 0), 0);
    
    n[i] = { ...n[i], lots: l, shares: totalShares, costPrice: Number((totalShares ? totalCost / totalShares : 0).toFixed(2)), marginLoanAmount: totalMargin };
    
    setEtfs(n);
    setBuyForm({ ...buyForm, shares: '', price: '', margin: '' });
    setActiveBuyId(null);
  };

  const addLot = (i: number) => {
    const s = Number(newLot.shares), p = Number(newLot.price), m = Number(newLot.margin);
    if (!s || !p) return;
    const targetEtf = etfs[i];
    const fee = targetEtf.category === 'hedging' ? 0 : Math.floor(s * p * BROKERAGE_RATE);
    
    const n = [...etfs];
    const l = n[i].lots ? [...n[i].lots!] : [];
    l.push({ id: Date.now().toString(), date: newLot.date, shares: s, price: p, fee, margin: m });
    
    const totalShares = l.reduce((a, b) => a + b.shares, 0);
    const totalCost = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0);
    const totalMargin = l.reduce((a, b) => a + (b.margin || 0), 0);
    
    n[i] = { ...n[i], lots: l, shares: totalShares, costPrice: Number((totalShares ? totalCost / totalShares : 0).toFixed(2)), marginLoanAmount: totalMargin };
    
    setEtfs(n);
    setNewLot({ ...newLot, shares: '', price: '', margin: '' });
  };

  const removeLot = (i: number, lotId: string) => {
    const n = [...etfs];
    const l = n[i].lots!.filter(x => x.id !== lotId);
    
    const totalShares = l.reduce((a, b) => a + b.shares, 0);
    const totalCost = l.reduce((a, b) => a + b.shares * b.price + (b.fee || 0), 0);
    const totalMargin = l.reduce((a, b) => a + (b.margin || 0), 0);
    
    n[i] = { ...n[i], lots: l, shares: totalShares, costPrice: Number((totalShares ? totalCost / totalShares : 0).toFixed(2)), marginLoanAmount: totalMargin };
    setEtfs(n);
  };

  const toggleEtfPayMonth = (i: number, m: number) => { 
    const e = etfs[i]; 
    const ms = e.payMonths.includes(m) ? e.payMonths.filter(x => x !== m) : [...e.payMonths, m].sort((a, b) => a - b); 
    updateEtf(i, 'payMonths', ms); 
  };

  const toggleEtfDividendType = (i: number) => { 
    const n = [...etfs]; 
    n[i].dividendType = n[i].dividendType === 'annual' ? 'per_period' : 'annual'; 
    setEtfs(n); 
  };

  return (
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
                <div className="flex-1 mr-2 flex items-center gap-1">
                  <div className="relative group/code">
                    <Tag className="absolute left-1 top-1.5 w-3 h-3 text-slate-500" />
                    <input type="text" value={etf.code || ''} onChange={(e) => updateEtf(idx, 'code', e.target.value)} className="bg-slate-900 border border-slate-700 rounded pl-5 pr-1 py-0.5 text-xs text-blue-300 w-20 focus:border-blue-500 outline-none" placeholder="代號" />
                  </div>
                  <input type="text" value={etf.name} onChange={(e) => updateEtf(idx, 'name', e.target.value)} className="bg-transparent font-bold text-white border-b border-transparent hover:border-slate-600 focus:border-blue-500 outline-none w-full text-sm" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleBuy(etf.id)} className={`p-1.5 rounded-lg border transition-colors ${isBuying ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-emerald-400'}`}><ShoppingCart className="w-3 h-3" /></button>
                  <button onClick={() => toggleLots(etf.id)} className={`p-1.5 rounded-lg border transition-colors ${hasLots ? 'bg-slate-800 border-slate-600 text-slate-300' : 'border-slate-700 text-slate-500'}`}><List className="w-3 h-3" /></button>
                  <button onClick={() => removeEtf(etf.id)} className="p-1.5 rounded-lg border border-slate-700 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>

              {isBuying && (<div className="mb-2 p-2 bg-emerald-900/20 border border-emerald-500/20 rounded-lg animate-in slide-in-from-top-2">
                <div className="grid grid-cols-4 gap-1 mb-2">
                  <div className="col-span-1"><label className="text-[9px] text-slate-500">日期</label><input type="date" value={buyForm.date} onChange={e => setBuyForm({...buyForm, date: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div>
                  <div><label className="text-[9px] text-slate-500">數量</label><input type="number" placeholder="0" value={buyForm.shares} onChange={e => setBuyForm({...buyForm, shares: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div>
                  <div><label className="text-[9px] text-slate-500">單價</label><input type="number" placeholder="0" value={buyForm.price} onChange={e => setBuyForm({...buyForm, price: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div>
                  <div><label className="text-[9px] text-blue-400">融資$</label><input type="number" placeholder="0" value={buyForm.margin} onChange={e => setBuyForm({...buyForm, margin: e.target.value})} className="w-full bg-slate-900 border border-blue-900 rounded px-1 py-0.5 text-xs text-white placeholder-blue-900/50" /></div>
                </div>
                <button onClick={() => submitBuy(idx)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1 rounded text-xs font-bold">確認交易</button>
              </div>)}

              <div className="grid grid-cols-3 gap-2 mb-2">
                <div><label className="text-[9px] text-slate-500 block">數量</label><input type="number" value={etf.shares} onChange={(e) => updateEtf(idx, 'shares', Number(e.target.value))} disabled={hasLots} className={`w-full bg-slate-900 border rounded px-1 py-0.5 text-xs ${hasLots ? 'border-slate-800 text-slate-500' : 'border-slate-700 text-white'}`} /></div>
                <div><label className="text-[9px] text-slate-500 block">成本</label><input type="number" value={etf.costPrice} onChange={(e) => updateEtf(idx, 'costPrice', Number(e.target.value))} disabled={hasLots} className={`w-full bg-slate-900 border rounded px-1 py-0.5 text-xs ${hasLots ? 'border-slate-800 text-slate-500' : 'border-slate-700 text-white'}`} /></div>
                <div><label className="text-[9px] text-slate-500 block">現價</label><input type="number" value={etf.currentPrice} onChange={(e) => updateEtf(idx, 'currentPrice', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></div>
              </div>

              <div className="flex gap-1 justify-end">
                <select value={etf.category} onChange={(e) => updateEtf(idx, 'category', e.target.value)} className="bg-slate-900 text-[9px] border border-slate-700 rounded px-1 text-slate-400"><option value="dividend">配息型</option><option value="hedging">避險型</option><option value="active">主動型</option></select>
                <select value={etf.dividendType||'annual'} onChange={(e) => toggleEtfDividendType(idx)} className="bg-slate-900 text-[9px] border border-slate-700 rounded px-1 text-slate-400" disabled={isHedging}><option value="annual">年配</option><option value="per_period">期配</option></select>
                <div className="flex-1"></div>
                <input type="number" value={etf.dividendPerShare} onChange={(e) => updateEtf(idx, 'dividendPerShare', Number(e.target.value))} className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-right" disabled={isHedging} placeholder="配息"/>
              </div>

              <div className="mt-2 flex gap-1 flex-wrap">
                {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                  <button key={month} onClick={() => toggleEtfPayMonth(idx, month)} className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center transition-all ${etf.payMonths?.includes(month) ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50 scale-110' : 'bg-slate-800 text-slate-600 hover:bg-slate-700'}`}>
                    {month}
                  </button>
                ))}
              </div>

              {isExpanded && (<div className="mt-2 pt-2 border-t border-slate-800">
                <div className="text-[9px] text-slate-500 mb-1">交易明細 (含融資額)</div>
                {etf.lots?.map(l=>(
                  <div key={l.id} className="flex justify-between items-center text-[10px] text-slate-400 mb-1 p-1 bg-slate-900/50 rounded border border-slate-800">
                    <span className="w-16">{l.date}</span>
                    <span className="flex-1 text-right">{l.shares}股 @ {l.price}</span>
                    <span className="w-20 text-right text-blue-400">{l.margin ? `(融:${l.margin})` : ''}</span>
                    <button onClick={()=>removeLot(idx, l.id)} className="ml-2 text-red-500 hover:text-red-400"><X className="w-3 h-3"/></button>
                  </div>
                ))}
                <div className="flex gap-1 mt-2 pt-2 border-t border-slate-800">
                  <input type="date" value={newLot.date} onChange={e=>setNewLot({...newLot, date:e.target.value})} className="bg-slate-900 border border-slate-700 rounded text-[9px] w-16"/>
                  <input type="number" placeholder="股" value={newLot.shares} onChange={e=>setNewLot({...newLot, shares:e.target.value})} className="bg-slate-900 border border-slate-700 rounded text-[9px] w-12"/>
                  <input type="number" placeholder="$" value={newLot.price} onChange={e=>setNewLot({...newLot, price:e.target.value})} className="bg-slate-900 border border-slate-700 rounded text-[9px] w-12"/>
                  <input type="number" placeholder="融資" value={newLot.margin} onChange={e=>setNewLot({...newLot, margin:e.target.value})} className="bg-slate-900 border border-blue-900 rounded text-[9px] w-12 text-blue-300"/>
                  <button onClick={()=>addLot(idx)} className="bg-slate-800 px-2 rounded text-[10px]">+</button>
                </div>
              </div>)}
            </div>
          );
        })}
        <button onClick={addEtf} className="w-full py-2 bg-slate-900 border border-dashed border-slate-700 rounded-xl text-slate-500 text-xs hover:text-white hover:border-slate-500 transition-all">+ 新增標的</button>
      </div>
    </section>
  );
};
