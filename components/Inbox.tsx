import React, { useState, useEffect } from 'react';
import { Conversation, Bot } from '../types';
import { Search, Mail, Phone, Calendar, MessageSquare, Clock, User, ChevronRight, Download, Filter, Trash2, Archive, Zap, ExternalLink, MessageCircle, Users } from 'lucide-react';
import { useNotification } from './Notification';

interface InboxProps {
  conversations: Conversation[];
  bots: Bot[];
  unreadConversations?: Map<string, number>;
  viewedConversationId?: string | null;
  onConversationRead?: (conversationId: string) => void;
  onConversationViewChange?: (conversationId: string | null) => void;
  onDeleteConversation?: (conversationId: string) => void;
}

const Inbox: React.FC<InboxProps> = ({ conversations, bots, unreadConversations = new Map(), viewedConversationId, onConversationRead, onConversationViewChange, onDeleteConversation }) => {
  const { showError } = useNotification();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBotId, setSelectedBotId] = useState<string>('all');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  
  // Find the selected conversation from the conversations prop (always up-to-date)
  const selectedConversation = selectedConversationId 
    ? conversations.find(c => c.id === selectedConversationId) || null
    : null;

  // Clear selected conversation if it no longer exists (was deleted)
  useEffect(() => {
    if (selectedConversationId && !selectedConversation) {
      setSelectedConversationId(null);
    }
  }, [selectedConversationId, selectedConversation]);

  // Handle delete with confirmation and clear selection
  const handleDeleteConversation = async (conversationId: string) => {
    if (onDeleteConversation) {
      await onDeleteConversation(conversationId);
      // Clear selection if the deleted conversation was selected
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }
    }
  };
  
  // Mark conversation as read when selected
  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversationId(conv.id);
    // Reset unread count when conversation is opened
    if (onConversationRead && unreadConversations.has(conv.id)) {
      onConversationRead(conv.id);
    }
    // Notify parent that this conversation is now being viewed
    if (onConversationViewChange) {
      onConversationViewChange(conv.id);
    }
  };
  
  // Clear viewed conversation when user navigates away or closes the detail panel
  useEffect(() => {
    if (!selectedConversationId && onConversationViewChange) {
      onConversationViewChange(null);
    }
  }, [selectedConversationId, onConversationViewChange]);
  
  // Auto-scroll to bottom when new messages arrive in selected conversation
  // Trigger on both message count and the last message timestamp to catch all updates
  const lastMessageTimestamp = selectedConversation?.messages.length > 0 
    ? selectedConversation.messages[selectedConversation.messages.length - 1]?.timestamp 
    : null;
  
  useEffect(() => {
    if (selectedConversation && selectedConversation.messages.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
    }
  }, [selectedConversation?.messages.length, lastMessageTimestamp]);

  const filteredConversations = conversations.filter(c => {
    // Filter by archive status
    if (showArchived && !c.archivedAt) {
      return false; // Show only archived when filter is on
    }
    if (!showArchived && c.archivedAt) {
      return false; // Hide archived when filter is off
    }
    
    // Filter by bot if selected
    // Check both botId and archivedBotId to handle conversations from deleted bots
    if (selectedBotId !== 'all') {
      const matchesBot = c.botId === selectedBotId || c.archivedBotId === selectedBotId;
      if (!matchesBot) {
        return false;
      }
    }
    
    // Filter by search term
    if (searchTerm) {
      const matchesSearch = 
    c.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.userPhone?.includes(searchTerm) ||
        c.id.includes(searchTerm);
      if (!matchesSearch) {
        return false;
      }
    }
    
    return true;
  });
  
  // Debug logging for archive filter
  useEffect(() => {
    const archivedInList = conversations.filter(c => c.archivedAt).length;
    const filteredArchived = filteredConversations.filter(c => c.archivedAt).length;
    console.log(`Inbox filter: showArchived=${showArchived}, total conversations=${conversations.length}, archived in list=${archivedInList}, filtered archived=${filteredArchived}, filtered total=${filteredConversations.length}`);
  }, [showArchived, conversations.length, filteredConversations.length]);

  const getBotName = (botId: string | null | undefined) => {
    if (!botId) return 'Deleted Bot';
    return bots.find(b => b.id === botId)?.name || 'Unknown Bot';
  };

  // Export leads to CSV (conversations with both email and phone)
  const exportLeadsToCSV = () => {
    // Filter conversations that have both email and phone
    const leads = filteredConversations.filter(conv => conv.userEmail && conv.userPhone);
    
    if (leads.length === 0) {
      showError('No leads to export', 'Leads must have both email and phone number.');
      return;
    }

    // Create CSV content
    const headers = ['Email', 'Phone', 'Bot Name', 'Started At', 'Message Count', 'Last Message'];
    const rows = leads.map(conv => {
      const lastMessage = conv.messages.length > 0 
        ? conv.messages[conv.messages.length - 1]?.text || ''
        : '';
      // Escape CSV values (handle commas and quotes)
      const escapeCSV = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      return [
        escapeCSV(conv.userEmail || ''),
        escapeCSV(conv.userPhone || ''),
        escapeCSV(getBotName(conv.botId)),
        new Date(conv.startedAt).toLocaleString(),
        conv.messageCount.toString(),
        escapeCSV(lastMessage.substring(0, 100)) // Limit message preview to 100 chars
      ].join(',');
    });

    const csvContent = [
      headers.join(','),
      ...rows
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6 max-w-[1600px] mx-auto animate-fade-in">
      
      {/* Left List Panel */}
      <div className="w-full md:w-96 glass-card rounded-3xl flex flex-col overflow-hidden">
         <div className="p-4 border-b border-white/5">
            <div className="flex justify-between items-center gap-2">
               <div className="flex items-center gap-2 flex-1">
                  <button
                     onClick={exportLeadsToCSV}
                     className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 transition-colors"
                     title="Export leads (email + phone) to CSV"
                  >
                     <Download className="w-3.5 h-3.5" />
                     <span className="whitespace-nowrap">Export Leads</span>
                  </button>
                  <button
                     onClick={() => setShowArchived(!showArchived)}
                     className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        showArchived 
                           ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                           : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300 border border-white/10'
                     }`}
                     title={showArchived ? 'Show active conversations' : 'Show archived conversations'}
                  >
                     <Archive className="w-3.5 h-3.5" />
                     <span className="whitespace-nowrap">{showArchived ? 'Show Active' : 'Show Archived'}</span>
                  </button>
               </div>
            </div>
            
            {/* Bot Filter */}
            <div className="mb-3 mt-4">
               <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <label className="text-xs text-slate-400 font-medium">Filter by Bot</label>
               </div>
               <select
                  value={selectedBotId}
                  onChange={(e) => setSelectedBotId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/20 border border-white/10 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
               >
                  <option value="all">All Bots</option>
                  {bots.map(bot => (
                     <option key={bot.id} value={bot.id}>{bot.name}</option>
                  ))}
               </select>
            </div>
            
            {/* Search */}
            <div className="relative">
               <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
               <input 
                 type="text" 
                 placeholder="Search email or phone..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/20 border border-white/10 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 outline-none"
               />
            </div>
         </div>
         
         <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredConversations.length === 0 ? (
               <div className="p-8 text-center text-slate-500 text-sm">
                  No conversations found.
               </div>
            ) : (
               filteredConversations.map(conv => {
                  const unreadCount = unreadConversations.get(conv.id) || 0;
                  const isUnread = unreadCount > 0;
                  const isCurrentlyViewed = viewedConversationId === conv.id;
                  return (
                     <div
                        key={conv.id}
                        className={`group w-full p-4 text-left border-b border-white/5 transition-colors hover:bg-white/5 relative ${
                           selectedConversation?.id === conv.id 
                              ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' 
                              : isUnread 
                                 ? 'bg-indigo-500/5 border-l-2 border-l-indigo-400/50' 
                                 : ''
                        }`}
                     >
                        {isUnread && (
                           <div className="absolute top-4 right-4 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-indigo-500 text-white text-xs font-semibold rounded-full">
                              {unreadCount > 99 ? '99+' : unreadCount}
                           </div>
                        )}
                        <div className="flex items-start gap-2">
                  <button
                              onClick={() => handleSelectConversation(conv)}
                              className="flex-1 text-left"
                  >
                     <div className="flex justify-between items-start mb-2">
                                 <div className="flex-1 min-w-0">
                                    <span className={`font-semibold text-sm block truncate ${isUnread ? 'text-white' : 'text-slate-200'}`}>
                                       {conv.userPhone || conv.userEmail || 'Anonymous Visitor'}
                                    </span>
                                    {(conv.userEmail || conv.userPhone) && (
                                       <div className="flex flex-col gap-1 mt-1">
                                          {conv.userEmail && (
                                             <span className="flex items-center gap-1.5 text-xs text-slate-400">
                                                <Mail className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{conv.userEmail}</span>
                                             </span>
                                          )}
                                          {conv.userPhone && (
                                             <span className="flex items-center gap-1.5 text-xs text-slate-400">
                                                <Phone className="w-3 h-3 flex-shrink-0" />
                                                <span>{conv.userPhone}</span>
                                             </span>
                                          )}
                                       </div>
                                    )}
                                 </div>
                        <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">
                           {new Date(conv.startedAt).toLocaleDateString()}
                        </span>
                     </div>
                     <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">{getBotName(conv.botId)}</span>
                        <span>•</span>
                        <span>{conv.messageCount} msgs</span>
                     </div>
                              <p className={`text-xs line-clamp-1 italic opacity-70 ${isUnread ? 'text-slate-300' : 'text-slate-400'}`}>
                        {conv.messages[conv.messages.length - 1]?.text || 'No messages'}
                     </p>
                  </button>
                     {onDeleteConversation && (
                        <button
                           onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conv.id);
                           }}
                           className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                           title="Delete conversation"
                        >
                           <Trash2 className="w-4 h-4" />
                        </button>
                     )}
                        </div>
                     </div>
                  );
               })
            )}
         </div>
      </div>

      {/* Right Detail Panel */}
      <div className="flex-1 glass-card rounded-3xl overflow-hidden flex flex-col relative">
         {selectedConversation ? (
            <>
               {/* Detail Header */}
               <div className="min-h-24 border-b border-white/5 bg-black/20 px-6 py-5 flex justify-between items-start">
                  <div className="flex items-start gap-5 flex-1 min-w-0">
                     <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {selectedConversation.userPhone 
                           ? selectedConversation.userPhone.slice(-1).toUpperCase() 
                           : selectedConversation.userEmail 
                              ? selectedConversation.userEmail[0].toUpperCase() 
                              : <User className="w-6 h-6" />}
                     </div>
                     <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-xl mb-2 truncate">{selectedConversation.userPhone || selectedConversation.userEmail || 'Anonymous User'}</h3>
                        <div className="flex flex-col gap-2 text-sm text-slate-400">
                           {selectedConversation.userEmail && (
                              <span className="flex items-center gap-2.5">
                                 <Mail className="w-4 h-4 flex-shrink-0 text-slate-500" />
                                 <span className="text-slate-300 truncate">{selectedConversation.userEmail}</span>
                              </span>
                           )}
                           {selectedConversation.userPhone && (
                              <span className="flex items-center gap-2.5">
                                 <Phone className="w-4 h-4 flex-shrink-0 text-slate-500" />
                                 <span className="text-slate-300">{selectedConversation.userPhone}</span>
                              </span>
                           )}
                           <span className="flex items-center gap-2.5">
                              <Clock className="w-4 h-4 flex-shrink-0 text-slate-500" />
                              <span>{new Date(selectedConversation.startedAt).toLocaleString()}</span>
                           </span>
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                     {onDeleteConversation && (
                        <button 
                           onClick={() => handleDeleteConversation(selectedConversation.id)}
                           className="p-2.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                           title="Delete conversation"
                        >
                           <Trash2 className="w-5 h-5" />
                        </button>
                     )}
                  <button className="p-2.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                     <Download className="w-5 h-5" />
                  </button>
                  </div>
               </div>

               {/* Chat History */}
               <div id="messages-container" className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/10">
                  {selectedConversation.messages.map((msg, idx) => {
                     const isUser = msg.role === 'user';
                     const msgDate = new Date(msg.timestamp);
                     const prevMsgDate = idx > 0 ? new Date(selectedConversation.messages[idx - 1].timestamp) : null;
                     
                     // Check if we need to show a date separator
                     const showDateSeparator = !prevMsgDate || 
                        msgDate.toDateString() !== prevMsgDate.toDateString();
                     
                     const formatDate = (date) => {
                        const today = new Date();
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);
                        
                        if (date.toDateString() === today.toDateString()) {
                           return 'Today';
                        } else if (date.toDateString() === yesterday.toDateString()) {
                           return 'Yesterday';
                        } else {
                           return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
                        }
                     };
                     
                     return (
                        <React.Fragment key={idx}>
                           {showDateSeparator && (
                              <div className="flex items-center justify-center my-6">
                                 <div className="flex items-center gap-3 w-full">
                                    <div className="flex-1 h-px bg-white/10"></div>
                                    <span className="text-xs text-slate-500 font-medium px-3 py-1 bg-black/20 rounded-full">
                                       {formatDate(msgDate)}
                                    </span>
                                    <div className="flex-1 h-px bg-white/10"></div>
                                 </div>
                              </div>
                           )}
                           <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                           <div className={`flex items-end gap-3 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${isUser ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                                 {isUser ? 'U' : 'AI'}
                              </div>
                              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                                 isUser 
                                    ? 'bg-indigo-600 text-white rounded-br-none' 
                                    : 'bg-[#1e1e24] text-slate-200 rounded-bl-none border border-white/5'
                              }`}>
                                 {msg.text}
                                 {msg.actionInvoked && !isUser && (
                                    <div className="mt-3 pt-3 border-t border-white/10">
                                       <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                          <Zap className="w-3 h-3" />
                                          <span>Action triggered:</span>
                                       </div>
                                       {(() => {
                                          const bot = bots.find(b => b.id === selectedConversation.botId);
                                          const action = bot?.actions?.find(a => a.id === msg.actionInvoked);
                                          return action ? (
                                             <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                                                {action.type === 'link' && <ExternalLink className="w-4 h-4 text-indigo-400" />}
                                                {action.type === 'phone' && <Phone className="w-4 h-4 text-blue-400" />}
                                                {action.type === 'whatsapp' && <MessageCircle className="w-4 h-4 text-green-400" />}
                                                {action.type === 'handoff' && <Users className="w-4 h-4 text-orange-400" />}
                                                <span className="text-slate-300 font-medium">{action.label}</span>
                                                {action.payload && (
                                                   <span className="text-xs text-slate-500 ml-auto truncate max-w-[200px]">
                                                      {action.payload}
                                                   </span>
                                                )}
                                             </div>
                                          ) : (
                                             <div className="text-xs text-slate-500 italic">Action ID: {msg.actionInvoked}</div>
                                          );
                                       })()}
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                        </React.Fragment>
                     )
                  })}
               </div>
            </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
               <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6">
                  <MessageSquare className="w-10 h-10 opacity-50" />
               </div>
               <p className="text-lg font-medium text-slate-400">Select a conversation</p>
               <p className="text-sm opacity-60">View captured leads and chat history.</p>
            </div>
         )}
      </div>

    </div>
  );
};

export default Inbox;