import React from 'react';
import { LayoutDashboard, Bot, MessageSquare, Code, Settings, Zap, Plus, Layers, Inbox as InboxIcon, X } from 'lucide-react';
import { ViewState, Bot as BotType } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  bots: BotType[];
  activeBotId?: string;
  onSelectBot: (bot: BotType) => void;
  onCreateNew: () => void;
  unreadCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setView, 
  bots, 
  activeBotId, 
  onSelectBot,
  onCreateNew,
  unreadCount = 0,
  isOpen = false,
  onClose
}) => {
  const navItems = [
    { id: ViewState.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
    { id: ViewState.INBOX, icon: InboxIcon, label: 'Inbox & Leads' }, // New Inbox Item
    { id: ViewState.BOT_BUILDER, icon: Bot, label: 'Bot Builder' },
    { id: ViewState.PLAYGROUND, icon: MessageSquare, label: 'Playground' },
    { id: ViewState.INTEGRATION, icon: Code, label: 'Integration' },
  ];

  return (
    <>
      {/* Mobile overlay sidebar */}
      <div className={`fixed inset-y-0 left-0 w-64 flex-shrink-0 flex flex-col glass-panel h-screen border-r border-white/10 z-30 transition-transform duration-300 lg:hidden ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand Header with close button */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap className="text-white w-6 h-6" />
            </div>
            <span className="ml-3 font-bold text-xl tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Aether
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col gap-6 py-6 px-3">
          
          {/* Main Navigation */}
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              const showUnreadBadge = item.id === ViewState.INBOX && unreadCount > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`flex items-center p-3 rounded-xl transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="relative">
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'}`} />
                    {showUnreadBadge && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-[#050505] animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className={`ml-3 font-medium text-sm ${isActive ? 'text-white' : ''}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Your Bots Section */}
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center justify-between px-3 mb-3">
              <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Your Bots</span>
              <button 
                onClick={onCreateNew}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors"
                title="Create New Bot"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {bots.map((bot) => {
                const isActive = activeBotId === bot.id;
                return (
                  <button
                    key={bot.id}
                    onClick={() => onSelectBot(bot)}
                    className={`flex items-center p-2 rounded-xl transition-all duration-200 group w-full ${
                      isActive
                        ? 'bg-white/10 text-white border border-white/10'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 bg-gradient-to-br ${bot.avatarColor} flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}>
                      {bot.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="ml-3 text-left overflow-hidden">
                      <div className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {bot.name}
                      </div>
                      <div className="text-[10px] text-slate-600 truncate flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${bot.status === 'active' ? 'bg-emerald-500' : 'bg-yellow-500'}`}></div>
                        {bot.model.split('-')[1]}
                      </div>
                    </div>
                    {isActive && (
                       <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_white]" />
                    )}
                  </button>
                );
              })}
              
              {bots.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-slate-600 border border-dashed border-white/5 rounded-xl">
                      No bots yet.
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer / User Profile */}
        <div className="p-4 border-t border-white/5 bg-black/20 flex-shrink-0">
          <button className="flex items-center justify-start w-full p-2 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
            <span className="ml-3 font-medium text-sm">Settings</span>
          </button>
          <div className="mt-3 flex items-center gap-3 px-2 pt-3 border-t border-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 border-2 border-white/10 flex-shrink-0" />
            <div className="overflow-hidden min-w-0">
              <p className="text-sm font-semibold text-white truncate">Demo User</p>
              <p className="text-[10px] text-slate-500 truncate uppercase tracking-wide">Pro Plan</p>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-20 lg:w-64 flex-shrink-0 flex flex-col glass-panel h-screen sticky top-0 border-r border-white/10 z-20 transition-all duration-300">
      {/* Brand Header */}
      <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-white/5 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Zap className="text-white w-6 h-6" />
        </div>
        <span className="ml-3 font-bold text-xl tracking-wide hidden lg:block bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          Aether
        </span>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col gap-6 py-6 px-3">
        
        {/* Main Navigation */}
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            const showUnreadBadge = item.id === ViewState.INBOX && unreadCount > 0;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center p-3 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="relative">
                <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'}`} />
                  {showUnreadBadge && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-[#050505] animate-pulse">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={`ml-3 font-medium text-sm hidden lg:block ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-indigo-500 shadow-[0_0_8px_currentColor] lg:hidden" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Your Bots Section */}
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between px-3 mb-3 hidden lg:flex">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Your Bots</span>
            <button 
              onClick={onCreateNew}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors"
              title="Create New Bot"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          
          {/* Mobile "Plus" if lg is hidden */}
          <div className="lg:hidden flex justify-center mb-2">
             <button onClick={onCreateNew} className="p-2 bg-white/5 rounded-lg text-slate-400">
               <Plus className="w-5 h-5" />
             </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {bots.map((bot) => {
              const isActive = activeBotId === bot.id;
              return (
                <button
                  key={bot.id}
                  onClick={() => onSelectBot(bot)}
                  className={`flex items-center p-2 rounded-xl transition-all duration-200 group w-full ${
                    isActive
                      ? 'bg-white/10 text-white border border-white/10'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 bg-gradient-to-br ${bot.avatarColor} flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}>
                    {bot.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="ml-3 text-left overflow-hidden hidden lg:block">
                    <div className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                      {bot.name}
                    </div>
                    <div className="text-[10px] text-slate-600 truncate flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${bot.status === 'active' ? 'bg-emerald-500' : 'bg-yellow-500'}`}></div>
                      {bot.model.split('-')[1]}
                    </div>
                  </div>
                  {isActive && (
                     <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_white] hidden lg:block" />
                  )}
                </button>
              );
            })}
            
            {bots.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-slate-600 border border-dashed border-white/5 rounded-xl hidden lg:block">
                    No bots yet.
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-white/5 bg-black/20 flex-shrink-0">
        <button className="flex items-center justify-center lg:justify-start w-full p-2 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
          <Settings className="w-5 h-5" />
          <span className="ml-3 font-medium text-sm hidden lg:block">Settings</span>
        </button>
        <div className="mt-3 flex items-center gap-3 px-1 lg:px-2 pt-3 border-t border-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 border-2 border-white/10 flex-shrink-0" />
          <div className="hidden lg:block overflow-hidden min-w-0">
            <p className="text-sm font-semibold text-white truncate">Demo User</p>
            <p className="text-[10px] text-slate-500 truncate uppercase tracking-wide">Pro Plan</p>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default Sidebar;