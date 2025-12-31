import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Bot, TrendingUp, Users, MessageCircle, Plus, Activity, Zap, ArrowUpRight, Clock, Server, Globe, Trash2 } from 'lucide-react';
import { Bot as BotType, Conversation } from '../types';
import { calculateDashboardStats, getRecentConversations } from '../services/statistics';

const activityData = [
  { name: '00:00', value: 240 }, { name: '04:00', value: 139 },
  { name: '08:00', value: 980 }, { name: '12:00', value: 1390 },
  { name: '16:00', value: 1890 }, { name: '20:00', value: 1200 },
  { name: '23:59', value: 650 },
];

const sourceData = [
  { name: 'Web', value: 65 },
  { name: 'Mobile', value: 25 },
  { name: 'API', value: 10 },
];

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899'];

interface DashboardProps {
  bots: BotType[];
  conversations: Conversation[];
  onCreateNew: () => void;
  onSelectBot: (bot: BotType) => void;
  onDeleteBot: (botId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ bots, conversations, onCreateNew, onSelectBot, onDeleteBot }) => {
  // Calculate real statistics
  const stats = calculateDashboardStats(conversations, bots);
  const recentConversations = getRecentConversations(conversations, bots);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-slate-400 mt-1">Real-time insights and fleet management.</p>
        </div>
        <div className="flex gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            System Operational
          </div>
          <button 
            onClick={onCreateNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New Bot
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-[minmax(140px,auto)]">
        
        {/* KPI 1 */}
        <div className="glass-card p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover:scale-110 transition-transform duration-300">
              <MessageCircle className="w-6 h-6" />
            </div>
            <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3" /> +12%
            </span>
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Total Messages</p>
            <h3 className="text-3xl font-bold text-white tracking-tight">{stats.totalMessages.toLocaleString()}</h3>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-card p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
           <div className="flex justify-between items-start">
            <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3" /> +5%
            </span>
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">New Conversations Today</p>
            <h3 className="text-3xl font-bold text-white tracking-tight">{stats.newConversationsToday}</h3>
          </div>
        </div>

        {/* Main Chart */}
        <div className="glass-card p-6 rounded-3xl md:col-span-2 md:row-span-2 relative overflow-hidden">
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div>
              <h3 className="text-lg font-bold text-white">Conversations Over Time</h3>
              <p className="text-slate-500 text-xs">New conversations per day (last 7 days)</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-indigo-500/5 to-transparent pointer-events-none"></div>
          <div className="h-[250px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.conversationsOverTime}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(5, 5, 5, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1}}
                />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 3 - Total Conversations */}
        <div className="glass-card p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
           <div className="flex justify-between items-start">
            <div className="p-3 bg-pink-500/10 rounded-2xl text-pink-400 group-hover:scale-110 transition-transform duration-300">
              <MessageCircle className="w-6 h-6" />
            </div>
            <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3" /> {stats.newConversationsThisWeek} this week
            </span>
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Total Conversations</p>
            <h3 className="text-3xl font-bold text-white tracking-tight">{stats.totalConversations.toLocaleString()}</h3>
          </div>
        </div>

        {/* Conversations by Bot */}
        <div className="glass-card p-6 rounded-3xl md:col-span-1 flex flex-col items-center justify-center relative">
          <h3 className="absolute top-6 left-6 text-sm font-bold text-white">By Bot</h3>
          <div className="h-[120px] w-full mt-4">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.botConversationStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.botConversationStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{background: '#000', border:'none', borderRadius: '8px'}} />
                </PieChart>
             </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs text-slate-400 flex-wrap justify-center">
             {stats.botConversationStats.slice(0, 3).map((entry, index) => (
               <div key={index} className="flex items-center gap-1">
                 <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                 {entry.name.length > 10 ? entry.name.substring(0, 10) + '...' : entry.name}
               </div>
             ))}
          </div>
        </div>

        {/* Recent Conversations */}
        <div className="glass-card p-6 rounded-3xl md:col-span-2">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" /> Recent Conversations
          </h3>
          <div className="space-y-4">
             {recentConversations.length > 0 ? (
               recentConversations.map((conv) => (
                 <div key={conv.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors cursor-default">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/5 text-xs text-slate-300">
                          {conv.user[0].toUpperCase()}
                     </div>
                     <div>
                          <p className="text-sm text-white font-medium">{conv.user}</p>
                          <p className="text-xs text-slate-500">{conv.botName} • {conv.timeAgo}</p>
                          <p className="text-xs text-slate-400 mt-1 italic">{conv.preview}</p>
                     </div>
                  </div>
                  <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                       {conv.id.substring(0, 8)}
                    </div>
                  </div>
               ))
             ) : (
               <div className="text-center text-slate-500 text-sm py-8">
                 No conversations yet
               </div>
             )}
          </div>
        </div>

        {/* Bot List - Spans 2 cols */}
        <div className="glass-card p-6 rounded-3xl md:col-span-2 md:row-span-2">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-bold text-white">Deployed Fleet</h3>
             <button onClick={onCreateNew} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Plus className="w-4 h-4 text-slate-400" />
             </button>
          </div>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {bots.map((bot) => (
               <div 
                 key={bot.id} 
                 className="group p-4 rounded-2xl bg-white/5 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/30 transition-all flex items-center gap-4"
               >
                  <div 
                     onClick={() => onSelectBot(bot)}
                     className="flex-1 flex items-center gap-4 cursor-pointer min-w-0"
               >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${bot.avatarColor} flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform`}>
                     <Bot className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start">
                        <h4 className="font-bold text-white truncate">{bot.name}</h4>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${bot.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                           {bot.status}
                        </span>
                     </div>
                     <a href={bot.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-0.5">
                        <Globe className="w-3 h-3" /> {bot.website.replace('https://', '')}
                     </a>
                     <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {bot.model.split('-')[1]}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(bot.createdAt).toLocaleDateString()}</span>
                     </div>
                  </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button
                        onClick={(e) => {
                           e.stopPropagation();
                           onDeleteBot(bot.id);
                        }}
                        className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete bot"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                     <div 
                        onClick={() => onSelectBot(bot)}
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer"
                     >
                        <ArrowUpRight className="w-4 h-4 text-white" />
                     </div>
                  </div>
               </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;