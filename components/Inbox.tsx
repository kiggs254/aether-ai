import React, { useState, useEffect } from 'react';
import { Conversation, Bot, Product } from '../types';
import { Search, Mail, Phone, Calendar, MessageSquare, Clock, User, ChevronRight, Download, Filter, Trash2, Archive, Zap, ExternalLink, MessageCircle, Users, ArrowLeft, Image, Video, Music, File, ShoppingBag, X } from 'lucide-react';
import { useNotification } from './Notification';
import { queryProducts } from '../services/productQuery';

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
  
  // Mobile view state: true = showing detail, false = showing list
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false);
  
  // Product recommendation modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalProducts, setModalProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  
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
    // On mobile, show detail view
    setShowDetailOnMobile(true);
    // Reset unread count when conversation is opened
    if (onConversationRead && unreadConversations.has(conv.id)) {
      onConversationRead(conv.id);
    }
    // Notify parent that this conversation is now being viewed
    if (onConversationViewChange) {
      onConversationViewChange(conv.id);
    }
  };
  
  // Handle back button on mobile
  const handleBackToList = () => {
    setShowDetailOnMobile(false);
    setSelectedConversationId(null);
    if (onConversationViewChange) {
      onConversationViewChange(null);
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

  // Sort conversations by most recent message timestamp (newest first)
  const sortedConversations = [...conversations].sort((a, b) => {
    // Get the most recent message timestamp for each conversation
    const aLastMessage = a.messages.length > 0 
      ? Math.max(...a.messages.map(m => m.timestamp))
      : a.startedAt;
    const bLastMessage = b.messages.length > 0
      ? Math.max(...b.messages.map(m => m.timestamp))
      : b.startedAt;
    
    // Sort by most recent message (descending)
    return bLastMessage - aLastMessage;
  });

  const filteredConversations = sortedConversations.filter(c => {
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] gap-4 sm:gap-6 max-w-[1600px] mx-auto animate-fade-in">
      
      {/* Left List Panel */}
      <div className={`w-full lg:w-96 glass-card rounded-3xl flex flex-col overflow-hidden ${showDetailOnMobile ? 'hidden lg:flex' : 'flex'}`}>
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
                        className={`group w-full p-3 sm:p-4 text-left border-b border-white/5 transition-colors hover:bg-white/5 relative ${
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
                                    <span className={`font-semibold text-xs sm:text-sm block truncate ${isUnread ? 'text-white' : 'text-slate-200'}`}>
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
                        {(() => {
                           const lastMsg = conv.messages[conv.messages.length - 1];
                           if (!lastMsg) return 'No messages';
                           let previewText = lastMsg.text || '';
                           // Remove product recommendation marker from preview
                           const markerStart = previewText.indexOf('[PRODUCT_RECOMMENDATION:');
                           if (markerStart !== -1) {
                              let bracketCount = 0;
                              const jsonStart = markerStart + '[PRODUCT_RECOMMENDATION:'.length;
                              let jsonEnd = -1;
                              for (let k = jsonStart; k < previewText.length; k++) {
                                 if (previewText[k] === '[') bracketCount++;
                                 else if (previewText[k] === ']') {
                                    if (bracketCount === 0) {
                                       jsonEnd = k;
                                       break;
                                    }
                                    bracketCount--;
                                 }
                              }
                              if (jsonEnd !== -1) {
                                 previewText = (previewText.substring(0, markerStart) + previewText.substring(jsonEnd + 1)).trim();
                                 if (!previewText || !previewText.trim()) {
                                    previewText = 'Product recommendations';
                                 }
                              }
                           }
                           return previewText;
                        })()}
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
               <div className="min-h-20 sm:min-h-24 border-b border-white/5 bg-black/20 px-4 sm:px-6 py-4 sm:py-5 flex justify-between items-start">
                  <div className="flex items-start gap-3 sm:gap-5 flex-1 min-w-0">
                     {/* Back button for mobile */}
                     <button
                        onClick={handleBackToList}
                        className="lg:hidden p-2 -ml-2 mr-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors flex-shrink-0"
                        aria-label="Back to list"
                     >
                        <ArrowLeft className="w-5 h-5" />
                     </button>
                     <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
                        {selectedConversation.userPhone 
                           ? selectedConversation.userPhone.slice(-1).toUpperCase() 
                           : selectedConversation.userEmail 
                              ? selectedConversation.userEmail[0].toUpperCase() 
                              : <User className="w-5 h-5 sm:w-6 sm:h-6" />}
                     </div>
                     <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-lg sm:text-xl mb-1 sm:mb-2 truncate">{selectedConversation.userPhone || selectedConversation.userEmail || 'Anonymous User'}</h3>
                        <div className="flex flex-col gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-400">
                           {selectedConversation.userEmail && (
                              <span className="flex items-center gap-2 sm:gap-2.5">
                                 <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-slate-500" />
                                 <span className="text-slate-300 truncate">{selectedConversation.userEmail}</span>
                              </span>
                           )}
                           {selectedConversation.userPhone && (
                              <span className="flex items-center gap-2 sm:gap-2.5">
                                 <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-slate-500" />
                                 <span className="text-slate-300">{selectedConversation.userPhone}</span>
                              </span>
                           )}
                           <span className="flex items-center gap-2 sm:gap-2.5">
                              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-slate-500" />
                              <span>{new Date(selectedConversation.startedAt).toLocaleString()}</span>
                           </span>
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2 sm:ml-4">
                     {onDeleteConversation && (
                        <button 
                           onClick={() => handleDeleteConversation(selectedConversation.id)}
                           className="p-2 sm:p-2.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                           title="Delete conversation"
                        >
                           <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                     )}
                  <button className="p-2 sm:p-2.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                     <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  </div>
               </div>

               {/* Chat History */}
               <div id="messages-container" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 bg-black/10">
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
                                 {(() => {
                                    // Extract and remove product recommendation marker from text
                                    let displayText = msg.text || '';
                                    const markerStart = displayText.indexOf('[PRODUCT_RECOMMENDATION:');
                                    if (markerStart !== -1) {
                                       // Find the matching closing bracket
                                       let bracketCount = 0;
                                       const jsonStart = markerStart + '[PRODUCT_RECOMMENDATION:'.length;
                                       let jsonEnd = -1;
                                       
                                       for (let k = jsonStart; k < displayText.length; k++) {
                                          if (displayText[k] === '[') bracketCount++;
                                          else if (displayText[k] === ']') {
                                             if (bracketCount === 0) {
                                                jsonEnd = k;
                                                break;
                                             }
                                             bracketCount--;
                                          }
                                       }
                                       
                                       if (jsonEnd !== -1) {
                                          // Remove the marker from display text
                                          displayText = (displayText.substring(0, markerStart) + displayText.substring(jsonEnd + 1)).trim();
                                          // If text is empty after removing marker, show default message
                                          if (!displayText || !displayText.trim()) {
                                             displayText = 'Here are some products I found for you:';
                                          }
                                       }
                                    }
                                    return displayText;
                                 })()}
                                 {(() => {
                                    // Check if message contains product recommendation marker
                                    const text = msg.text || '';
                                    const hasProductRecommendation = text.includes('[PRODUCT_RECOMMENDATION:');
                                    if (hasProductRecommendation && !isUser) {
                                       // Parse the recommendation marker to extract filters
                                       const parseRecommendationMarker = (messageText: string) => {
                                          const markerStart = messageText.indexOf('[PRODUCT_RECOMMENDATION:');
                                          if (markerStart === -1) return null;
                                          
                                          let bracketCount = 0;
                                          const jsonStart = markerStart + '[PRODUCT_RECOMMENDATION:'.length;
                                          let jsonEnd = -1;
                                          
                                          for (let k = jsonStart; k < messageText.length; k++) {
                                             if (messageText[k] === '[') bracketCount++;
                                             else if (messageText[k] === ']') {
                                                if (bracketCount === 0) {
                                                   jsonEnd = k;
                                                   break;
                                                }
                                                bracketCount--;
                                             }
                                          }
                                          
                                          if (jsonEnd !== -1) {
                                             try {
                                                const jsonStr = messageText.substring(jsonStart, jsonEnd);
                                                return JSON.parse(jsonStr);
                                             } catch (e) {
                                                console.error('Failed to parse product recommendation args:', e);
                                                return null;
                                             }
                                          }
                                          return null;
                                       };
                                       
                                       const recommendationArgs = parseRecommendationMarker(text);
                                       const bot = selectedConversation ? bots.find(b => b.id === selectedConversation.botId) : null;
                                       
                                       const handleViewProducts = async () => {
                                          if (!bot || !recommendationArgs) return;
                                          
                                          setIsLoadingProducts(true);
                                          setShowProductModal(true);
                                          
                                          try {
                                             // Query products using the filters from the recommendation
                                             const products = await queryProducts(bot.id, {
                                                category: recommendationArgs.category,
                                                priceMin: recommendationArgs.price_min,
                                                priceMax: recommendationArgs.price_max,
                                                keywords: recommendationArgs.keywords,
                                                maxResults: recommendationArgs.max_results || 10,
                                                inStock: true,
                                             });
                                             
                                             // Convert ProductSummary to Product format for display
                                             // We need to fetch full product details
                                             const { getProductCatalog } = await import('../services/productQuery');
                                             const fullCatalog = await getProductCatalog(bot.id);
                                             
                                             // Match products by productId
                                             const matchedProducts = products
                                                .map(summary => fullCatalog.find(p => p.productId === summary.productId))
                                                .filter((p): p is Product => p !== undefined);
                                             
                                             setModalProducts(matchedProducts);
                                          } catch (error: any) {
                                             showError('Failed to load products', error.message || 'Error loading product recommendations');
                                             setModalProducts([]);
                                          } finally {
                                             setIsLoadingProducts(false);
                                          }
                                       };
                                       
                                       return (
                                          <div className="mt-3 pt-3 border-t border-white/10">
                                             <button
                                                onClick={handleViewProducts}
                                                className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                                             >
                                                <ShoppingBag className="w-3 h-3" />
                                                <span>View recommended products ({recommendationArgs?.max_results || '?'})</span>
                                                <ChevronRight className="w-3 h-3" />
                                             </button>
                                          </div>
                                       );
                                    }
                                    return null;
                                 })()}
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
                                                {action.type === 'media' && (
                                                  action.mediaType === 'image' ? <Image className="w-4 h-4 text-purple-400" /> :
                                                  action.mediaType === 'video' ? <Video className="w-4 h-4 text-purple-400" /> :
                                                  action.mediaType === 'audio' ? <Music className="w-4 h-4 text-purple-400" /> :
                                                  <File className="w-4 h-4 text-purple-400" />
                                                )}
                                                {action.type === 'products' && (
                                                  <ShoppingBag className="w-4 h-4 text-indigo-400" />
                                                )}
                                                <span className="text-slate-300 font-medium">{action.label}</span>
                                                {action.type === 'media' && action.mediaType && (
                                                  <span className="text-xs text-slate-500 ml-auto uppercase">
                                                     {action.mediaType}
                                                  </span>
                                                )}
                                                {action.type !== 'media' && action.payload && (
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
         
         {/* Product Recommendations Modal */}
         {showProductModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowProductModal(false)}>
               <div className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-6 border-b border-white/10">
                     <div className="flex items-center gap-3">
                        <ShoppingBag className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-white font-semibold text-lg">Recommended Products</h2>
                     </div>
                     <button
                        onClick={() => setShowProductModal(false)}
                        className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                     >
                        <X className="w-5 h-5" />
                     </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                     {isLoadingProducts ? (
                        <div className="flex items-center justify-center py-12">
                           <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                     ) : modalProducts.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                           <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                           <p>No products found</p>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                           {modalProducts.map((product) => {
                              const priceDisplay = product.price
                                 ? `${product.currency || 'USD'} ${product.price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
                                 : 'Price not available';
                              
                              return (
                                 <a
                                    key={product.id}
                                    href={product.productUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-indigo-500/50 transition-all group"
                                 >
                                    <div className="aspect-square bg-slate-800 flex items-center justify-center overflow-hidden">
                                       {product.imageUrl ? (
                                          <img
                                             src={product.imageUrl}
                                             alt={product.name}
                                             className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                             onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                                if (placeholder) placeholder.classList.remove('hidden');
                                             }}
                                          />
                                       ) : null}
                                       <div className={`${product.imageUrl ? 'hidden' : ''} text-slate-500 text-sm`}>No Image</div>
                                    </div>
                                    <div className="p-4">
                                       <h3 className="text-white font-medium text-sm mb-2 line-clamp-2">{product.name}</h3>
                                       {product.category && (
                                          <p className="text-xs text-slate-400 mb-2">{product.category}</p>
                                       )}
                                       <p className="text-indigo-400 font-semibold text-sm">{priceDisplay}</p>
                                    </div>
                                 </a>
                              );
                           })}
                        </div>
                     )}
                  </div>
               </div>
            </div>
         )}
      </div>

    </div>
  );
};

export default Inbox;