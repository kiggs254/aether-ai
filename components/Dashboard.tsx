import React, { useRef, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Bot, TrendingUp, Users, MessageCircle, Plus, Activity, Zap, ArrowUpRight, Clock, Server, Globe, Trash2, Mail, Phone, Archive, Timer } from 'lucide-react';
import { Bot as BotType, Conversation } from '../types';
import { calculateDashboardStats, getRecentConversations } from '../services/statistics';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899'];

interface DashboardProps {
  bots: BotType[];
  conversations: Conversation[];
  onCreateNew: () => void;
  onSelectBot: (bot: BotType) => void;
  onDeleteBot: (botId: string) => void;
  unreadConversations?: Map<string, number>;
}

const Dashboard: React.FC<DashboardProps> = ({ bots, conversations, onCreateNew, onSelectBot, onDeleteBot, unreadConversations }) => {
  // Calculate real statistics
  const stats = calculateDashboardStats(conversations, bots, unreadConversations);
  const recentConversations = getRecentConversations(conversations, bots);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 300, height: 180 });

  useEffect(() => {
    const updateDimensions = () => {
      if (chartContainerRef.current) {
        const { width, height } = chartContainerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          setChartDimensions({ width, height });
        }
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Format response time
  const formatResponseTime = (seconds: number): string => {
    if (seconds === 0) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)} min`;
  };

  // Format conversation duration
  const formatDuration = (minutes: number): string => {
    if (minutes === 0) return 'N/A';
    if (minutes < 60) return `${minutes.toFixed(0)} min`;
    const hours = minutes / 60;
    if (hours < 24) return `${hours.toFixed(1)} hr`;
    const days = hours / 24;
    return `${days.toFixed(1)} day${days !== 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 auto-rows-[minmax(140px,auto)]">
        
        {/* KPI 1 - Total Messages */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover:scale-110 transition-transform duration-300">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Total Messages</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stats.totalMessages.toLocaleString()}</h3>
          </div>
        </div>

        {/* KPI 2 - New Conversations Today */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
           <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-purple-500/10 rounded-2xl text-purple-400 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">New Conversations Today</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stats.newConversationsToday}</h3>
          </div>
        </div>

        {/* KPI 3 - Leads Collected */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform duration-300">
              <Mail className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Leads Collected</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stats.leadsCollected.toLocaleString()}</h3>
          </div>
        </div>

        {/* KPI 4 - Unread Messages */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-orange-500/10 rounded-2xl text-orange-400 group-hover:scale-110 transition-transform duration-300">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Unread Messages</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stats.unreadMessages.toLocaleString()}</h3>
          </div>
        </div>

        {/* Main Chart */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-2 md:row-span-2 relative overflow-hidden">
          <div className="flex justify-between items-center mb-4 sm:mb-6 relative z-10">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Conversations Over Time</h3>
              <p className="text-slate-500 text-xs">New conversations per day (last 7 days)</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-indigo-500/5 to-transparent pointer-events-none"></div>
          <div className="h-[200px] sm:h-[250px] w-full relative z-10 min-h-[200px]">
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

        {/* KPI 5 - Total Conversations */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
           <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-pink-500/10 rounded-2xl text-pink-400 group-hover:scale-110 transition-transform duration-300">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Total Conversations</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stats.totalConversations.toLocaleString()}</h3>
          </div>
        </div>

        {/* KPI 6 - Active Conversations */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-cyan-500/10 rounded-2xl text-cyan-400 group-hover:scale-110 transition-transform duration-300">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Active Conversations</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stats.activeConversations.toLocaleString()}</h3>
          </div>
        </div>

        {/* KPI 7 - Average Response Time */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-yellow-500/10 rounded-2xl text-yellow-400 group-hover:scale-110 transition-transform duration-300">
              <Timer className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Avg Response Time</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{formatResponseTime(stats.averageResponseTime)}</h3>
          </div>
        </div>

        {/* KPI 8 - Average Messages/Conversation */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform duration-300">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Avg Messages/Conv</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stats.averageMessagesPerConversation.toFixed(1)}</h3>
          </div>
        </div>

        {/* KPI 9 - Archived Conversations */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-slate-500/10 rounded-2xl text-slate-400 group-hover:scale-110 transition-transform duration-300">
              <Archive className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Archived</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stats.archivedConversations.toLocaleString()}</h3>
          </div>
        </div>

        {/* KPI 10 - Most Active Bot */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-violet-500/10 rounded-2xl text-violet-400 group-hover:scale-110 transition-transform duration-300">
              <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
             </div>
             </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Most Active Bot</p>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
              {stats.mostActiveBot ? `${stats.mostActiveBot.name} (${stats.mostActiveBot.count})` : 'N/A'}
            </h3>
             </div>
             </div>

        {/* KPI 11 - Average Conversation Duration */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-2 sm:p-3 bg-rose-500/10 rounded-2xl text-rose-400 group-hover:scale-110 transition-transform duration-300">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
             </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Avg Duration</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{formatDuration(stats.averageConversationDuration)}</h3>
          </div>
        </div>

        {/* Conversations by Bot */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-1 md:row-span-2 flex flex-col">
          <h3 className="text-xs sm:text-sm font-bold text-white mb-4">By Bot</h3>
          <div className="flex-1 flex flex-col justify-center items-center" style={{ minHeight: '240px' }}>
            {stats.botConversationStats.length > 0 ? (
              <>
                <div ref={chartContainerRef} className="w-full flex-shrink-0" style={{ height: '180px', width: '100%' }}>
                  <ResponsiveContainer width={chartDimensions.width} height={chartDimensions.height}>
                    <PieChart>
                      <Pie
                        data={stats.botConversationStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
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
                <div className="flex gap-3 sm:gap-4 text-xs text-slate-400 flex-wrap justify-center mt-4 flex-shrink-0">
                  {stats.botConversationStats.slice(0, 3).map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0`} style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="whitespace-nowrap">{entry.name.length > 12 ? entry.name.substring(0, 12) + '...' : entry.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                No bot data available
              </div>
            )}
          </div>
        </div>

        {/* Recent Conversations */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-2">
          <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
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

        {/* Bot List - Spans 2 cols, aligned with Recent Conversations */}
        <div className="glass-card p-4 sm:p-6 rounded-3xl md:col-span-2 md:row-span-2">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
             <h3 className="text-base sm:text-lg font-bold text-white">Your Bots</h3>
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