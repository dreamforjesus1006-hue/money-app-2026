import React from 'react';
import { Swords, Crown, Skull, Scroll, Trophy, Coins, Gem, Sparkles, RefreshCw, Zap, Lock } from 'lucide-react';
import { formatMoney } from '../decimal';

// 定義成就列表
const getAchievements = (marketValue: number, hasHedging: boolean, passiveIncome: number, hasLeverage: boolean, fireRatio: number, netWorthPositive: boolean) => [
  { id: '1', name: '初心冒險者', icon: <Swords className="w-5 h-5"/>, desc: '開始投資旅程', unlocked: marketValue > 0, color: 'text-slate-200 border-slate-500' },
  { id: '2', name: '第一桶金', icon: <Coins className="w-5 h-5"/>, desc: '總資產 > 100萬', unlocked: marketValue >= 1000000, color: 'text-emerald-400 border-emerald-500' },
  { id: '3', name: '千萬富翁', icon: <Gem className="w-5 h-5"/>, desc: '總資產 > 1000萬', unlocked: marketValue >= 10000000, color: 'text-purple-400 border-purple-500' },
  { id: '4', name: '煉金術士', icon: <Sparkles className="w-5 h-5"/>, desc: '持有黃金/避險', unlocked: hasHedging, color: 'text-yellow-400 border-yellow-500' },
  { id: '5', name: '現金流大師', icon: <RefreshCw className="w-5 h-5"/>, desc: '年股息 > 50萬', unlocked: passiveIncome >= 500000, color: 'text-blue-400 border-blue-500' },
  { id: '6', name: '槓桿戰士', icon: <Zap className="w-5 h-5"/>, desc: '使用融資/質押', unlocked: hasLeverage, color: 'text-red-400 border-red-500' },
  { id: '7', name: '財富國王', icon: <Crown className="w-5 h-5"/>, desc: 'FIRE 自由度 100%', unlocked: fireRatio >= 100, color: 'text-yellow-500 border-yellow-500' },
  { id: '8', name: '債務殺手', icon: <Skull className="w-5 h-5"/>, desc: '資產 > 總負債', unlocked: netWorthPositive, color: 'text-orange-500 border-orange-500' },
];

interface GameHUDProps {
  combatPower: number;
  levelInfo: { title: string, color: string, bar: string, next: number | null };
  fireRatio: number;
  currentMaintenance: number;
  totalMarketValue: number;
  totalDebt: number;
  skills: { name: string, level: number, icon: React.ReactNode, color: string, bar: string }[];
  annualPassiveIncome: number;
  hasHedging: boolean;
  hasLeverage: boolean;
  netWorthPositive: boolean;
}

export const GameHUD: React.FC<GameHUDProps> = ({ 
  combatPower, levelInfo, fireRatio, currentMaintenance, totalMarketValue, totalDebt, skills,
  annualPassiveIncome, hasHedging, hasLeverage, netWorthPositive
}) => {
  const achievements = getAchievements(totalMarketValue, hasHedging, annualPassiveIncome, hasLeverage, fireRatio, netWorthPositive);

  return (
    <>
      {/* 上方 HUD */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        
        {/* Player Stats */}
        <div className="md:col-span-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden backdrop-blur-sm group hover:border-slate-600 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Swords className="w-32 h-32" /></div>
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><Crown className="w-3 h-3 text-yellow-500" /> 玩家等級</div>
            <div className={`text-3xl font-black ${levelInfo.color} mb-1`}>{levelInfo.title}</div>
            <div className="w-full bg-slate-800 rounded-full h-2 mb-4 border border-slate-700"><div className={`h-full ${levelInfo.bar} rounded-full transition-all duration-1000`} style={{width: `${Math.min(100, fireRatio)}%`}}></div></div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                    <div className="text-slate-500 text-[10px] uppercase">戰鬥力 (CP)</div>
                    <div className="text-2xl font-mono text-white font-bold">{formatMoney(combatPower)}</div>
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
                <div className="text-[10px] text-red-400 font-mono">剩餘血量: {formatMoney(Math.max(0, totalDebt - totalMarketValue))}</div>
            </div>
            <div className="relative h-8 w-full bg-slate-950 rounded-lg overflow-hidden border border-red-900/30 shadow-inner">
                {/* Boss HP */}
                <div className="absolute top-0 left-0 h-full bg-gradient-to-b from-red-600 to-red-900 transition-all duration-1000" style={{width: '100%'}}></div>
                {/* Player Damage */}
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500/80 to-blue-500/80 transition-all duration-1000 flex items-center justify-end px-3 border-r-2 border-white/50" style={{width: `${Math.min(100, (totalMarketValue / (totalDebt || 1)) * 100)}%`}}>
                    <span className="text-xs font-bold text-white drop-shadow-md">-{((totalMarketValue / (totalDebt || 1)) * 100).toFixed(0)}% 爆擊</span>
                </div>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono">
                <span>ATK: {formatMoney(totalMarketValue)} (資產)</span>
                <span>HP: {formatMoney(totalDebt)} (負債)</span>
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

      {/* 下方成就殿堂 */}
      <div className="mt-8 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-500" /> 成就殿堂 (Hall of Fame)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {achievements.map(ach => (
                  <div key={ach.id} className={`relative p-3 rounded-xl border flex items-center gap-3 transition-all duration-500 group ${ach.unlocked ? `bg-slate-950/80 ${ach.color} shadow-lg` : 'bg-slate-950/30 border-slate-800 opacity-60 grayscale'}`}>
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
    </>
  );
};
