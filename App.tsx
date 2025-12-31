import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import BotBuilder from './components/BotBuilder';
import ChatPlayground from './components/ChatPlayground';
import EmbedCode from './components/EmbedCode';
import Inbox from './components/Inbox';
import Auth from './components/Auth';
import { Bot, ViewState, Conversation } from './types';
import { supabase } from './lib/supabase';
import { botService, conversationService } from './services/database';
import { NotificationProvider, useNotification } from './components/Notification';
import { Modal } from './components/Modal';

// Mock data removed - now loading from Supabase

const AppContent: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [bots, setBots] = useState<Bot[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeBot, setActiveBot] = useState<Bot | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [botsLoading, setBotsLoading] = useState(true);
  // Map of conversationId -> unread message count
  const [unreadConversations, setUnreadConversations] = useState<Map<string, number>>(new Map());
  // Track which conversation is currently being viewed (to prevent incrementing count when viewing)
  const [viewedConversationId, setViewedConversationId] = useState<string | null>(null);
  
  // Initialize ref with current value
  const viewedConversationIdRef = useRef<string | null>(viewedConversationId);
  
  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { showError, showSuccess } = useNotification();

  // Use refs to store latest values for subscriptions
  const botsRef = useRef(bots);
  const conversationsRef = useRef(conversations);
  const showSuccessRef = useRef(showSuccess);
  const loadConversationsRef = useRef<(() => Promise<void>) | null>(null);
  const subscriptionsSetupRef = useRef(false);
  const subscriptionsCleanupRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    botsRef.current = bots;
  }, [bots]);
  
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  
  useEffect(() => {
    showSuccessRef.current = showSuccess;
  }, [showSuccess]);
  
  useEffect(() => {
    viewedConversationIdRef.current = viewedConversationId;
  }, [viewedConversationId]);

  const loadBots = useCallback(async () => {
    try {
      setBotsLoading(true);
      const loadedBots = await botService.getAllBots();
      setBots(loadedBots);
    } catch (error: any) {
      showError('Failed to load bots', error.message || 'Please try refreshing the page');
    } finally {
      setBotsLoading(false);
    }
  }, [showError]);

  // Load last viewed timestamps from localStorage
  const getLastViewedTimestamps = useCallback(() => {
    try {
      const stored = localStorage.getItem('aether_conversation_last_viewed');
      return stored ? new Map<string, number>(JSON.parse(stored)) : new Map<string, number>();
    } catch (err) {
      console.warn('Failed to load last viewed timestamps:', err);
      return new Map<string, number>();
    }
  }, []);

  // Save last viewed timestamp to localStorage
  const saveLastViewedTimestamp = useCallback((conversationId: string) => {
    try {
      const timestamps = getLastViewedTimestamps();
      timestamps.set(conversationId, Date.now());
      localStorage.setItem('aether_conversation_last_viewed', JSON.stringify(Array.from(timestamps.entries())));
    } catch (err) {
      console.warn('Failed to save last viewed timestamp:', err);
    }
  }, [getLastViewedTimestamps]);

  const loadConversations = useCallback(async () => {
    try {
      // Load all conversations including archived so Inbox can filter them
      const loadedConversations = await conversationService.getAllConversations(true);
      setConversations(loadedConversations);
      
      // Calculate unread counts based on last viewed timestamps
      const lastViewedTimestamps = getLastViewedTimestamps();
      const unreadCounts = new Map<string, number>();
      
      loadedConversations.forEach(conv => {
        const lastViewed = lastViewedTimestamps.get(conv.id) || 0;
        // Count messages that came after the last viewed timestamp
        const unreadMessages = conv.messages.filter(msg => 
          msg.timestamp > lastViewed && msg.role === 'user'
        );
        if (unreadMessages.length > 0) {
          unreadCounts.set(conv.id, unreadMessages.length);
        }
      });
      
      setUnreadConversations(unreadCounts);
      console.log('Loaded unread counts:', Array.from(unreadCounts.entries()));
    } catch (error: any) {
      // Silently fail for conversations - not critical
      console.error('Error loading conversations:', error);
    }
  }, [getLastViewedTimestamps]);

  // Update ref when loadConversations changes
  useEffect(() => {
    loadConversationsRef.current = loadConversations;
  }, [loadConversations]);

  // Setup real-time subscriptions for conversations and messages
  // This works from any page and doesn't require bots to be loaded first
  const setupRealtimeSubscriptions = useCallback(() => {
    if (!user) {
      console.log('No user, skipping real-time setup');
      return () => {};
    }
    
    // Get current bot IDs for filtering (use ref to get latest)
    // This will be empty initially but will update when bots load
    const userBotIds = botsRef.current.map(b => b.id);
    console.log('Setting up real-time subscriptions for user:', user.id, 'with', botsRef.current.length, 'bots', 'Bot IDs:', userBotIds);
    
    // Note: Even if userBotIds is empty, subscriptions will be set up
    // When bots load, the ref will update and new events will be processed correctly
    
    // Subscribe to new conversations (filter by bots that belong to user)
    const conversationsChannel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
        },
        async (payload) => {
          console.log('New conversation created:', payload);
          const newConv = payload.new;
          
          // Check if this conversation belongs to one of user's bots
          // If bots aren't loaded yet (userBotIds is empty), we'll check via RLS
          // But to be safe, we'll also verify by fetching the bot
          let belongsToUser = userBotIds.length > 0 ? userBotIds.includes(newConv.bot_id) : false;
          
          // If bots not loaded yet, verify by checking if we can access the bot
          if (!belongsToUser && userBotIds.length === 0) {
            const { data: botData } = await supabase
              .from('bots')
              .select('id')
              .eq('id', newConv.bot_id)
              .single();
            belongsToUser = !!botData; // If RLS allows us to read it, it belongs to us
          }
          
          console.log('Conversation belongs to user?', belongsToUser, 'bot_id:', newConv.bot_id, 'userBotIds:', userBotIds);
          
          if (belongsToUser) {
            // Skip playground conversations (user_id matches current user) - don't save or show them
            const isPlayground = newConv.user_id === user?.id;
            if (isPlayground) {
              console.log('Skipping playground conversation - not saving or displaying');
              return; // Don't process playground conversations at all
            }
            
            // Only process widget conversations (user_id is null)
            // Fetch messages for the new conversation
            const { data: messagesData } = await supabase
              .from('messages')
              .select('*')
              .eq('conversation_id', newConv.id)
              .order('timestamp', { ascending: true });
            
            // Transform to match Conversation interface
            const newConversation: Conversation = {
              id: newConv.id,
              botId: newConv.bot_id,
              userEmail: newConv.user_email,
              userPhone: newConv.user_phone,
              startedAt: new Date(newConv.started_at).getTime(),
              messageCount: newConv.message_count || 0,
              status: newConv.status || 'active',
              messages: (messagesData || []).map((msg: any) => ({
                role: msg.role,
                text: msg.text,
                timestamp: new Date(msg.timestamp).getTime(),
                actionInvoked: msg.action_invoked,
              })),
            };
            
            // Add to conversations list (at the beginning since newest first)
            setConversations(prev => {
              // Check if conversation already exists (avoid duplicates)
              if (prev.find(c => c.id === newConversation.id)) {
                return prev;
              }
              return [newConversation, ...prev];
            });
            
            // Mark as unread and notify for widget conversations
            const hasUserMessage = messagesData && messagesData.some((msg: any) => msg.role === 'user');
            
            // Mark as unread
            const newConvId = newConv.id;
            setUnreadConversations(prev => {
              const next = new Map(prev);
              const currentCount = next.get(newConvId) || 0;
              next.set(newConvId, currentCount + 1);
              console.log('Marked conversation as unread:', newConvId, 'Total unread:', Array.from(next.values()).reduce((sum, count) => sum + count, 0));
              return next;
            });
            
            // Show notification only if conversation has actual user messages
            if (hasUserMessage) {
              console.log('Showing notification for new widget conversation');
              if (showSuccessRef.current) {
                showSuccessRef.current('New conversation started', 'A new lead has started chatting');
              } else {
                console.warn('showSuccessRef.current is not available yet, will retry...');
                // Retry after a short delay
                setTimeout(() => {
                  if (showSuccessRef.current) {
                    showSuccessRef.current('New conversation started', 'A new lead has started chatting');
                  }
                }, 500);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        async (payload) => {
          console.log('Conversation updated:', payload);
          const updatedConv = payload.new;
          
          // Check if this conversation belongs to one of user's bots
          let belongsToUser = userBotIds.length > 0 ? userBotIds.includes(updatedConv.bot_id) : false;
          
          // If bots not loaded yet, verify by checking if we can access the bot
          if (!belongsToUser && userBotIds.length === 0) {
            const { data: botData } = await supabase
              .from('bots')
              .select('id')
              .eq('id', updatedConv.bot_id)
              .single();
            belongsToUser = !!botData;
          }
          
          if (belongsToUser) {
            // Update the conversation in state
            setConversations(prev => {
              const index = prev.findIndex(c => c.id === updatedConv.id);
              if (index === -1) {
                // Conversation not in list, might be new, reload to be safe
                if (loadConversationsRef.current) {
                  loadConversationsRef.current();
                }
                return prev;
              }
              
              // Update the existing conversation
              const updated = [...prev];
              updated[index] = {
                ...updated[index],
                messageCount: updatedConv.message_count || updated[index].messageCount,
                status: updatedConv.status || updated[index].status,
                userEmail: updatedConv.user_email || updated[index].userEmail,
                userPhone: updatedConv.user_phone || updated[index].userPhone,
              };
              return updated;
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Conversations channel subscribed successfully');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Conversations channel error');
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Conversations channel timed out');
        } else {
          console.log('Conversations channel status:', status);
        }
      });
    
    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          console.log('New message received:', payload);
          const message = payload.new;
          
          // First, check if this message belongs to a conversation that belongs to user's bots
          const { data: convData, error } = await supabase
            .from('conversations')
            .select('bot_id, message_count, user_id, user_email, user_phone')
            .eq('id', message.conversation_id)
            .single();
          
          if (error) {
            console.error('Error fetching conversation:', error);
            return;
          }
          
          if (convData) {
            // Check if this message belongs to one of user's bots
            let belongsToUser = userBotIds.length > 0 ? userBotIds.includes(convData.bot_id) : false;
            
            // If bots not loaded yet, verify by checking if we can access the bot
            if (!belongsToUser && userBotIds.length === 0) {
              const { data: botData } = await supabase
                .from('bots')
                .select('id')
                .eq('id', convData.bot_id)
                .single();
              belongsToUser = !!botData;
            }
            
            console.log('Message belongs to user?', belongsToUser, 'bot_id:', convData.bot_id, 'userBotIds:', userBotIds, 'user_id:', convData.user_id, 'current_user_id:', user?.id, 'hasLeadInfo:', !!(convData.user_email || convData.user_phone));
            
            if (belongsToUser) {
              // Skip playground conversations (user_id matches current user)
              const isPlayground = convData.user_id === user?.id;
              if (isPlayground) {
                console.log('Skipping playground message - not processing');
                return; // Don't process playground messages at all
              }
              
              // Only process widget conversations (user_id is null)
              // Transform the message to match ChatMessage interface
              const newMessage: ChatMessage = {
                role: message.role,
                text: message.text,
                timestamp: new Date(message.timestamp).getTime(),
                actionInvoked: message.action_invoked,
              };
              
              // Update conversations state directly - add message to the conversation
              setConversations(prev => {
                const index = prev.findIndex(c => c.id === message.conversation_id);
                if (index === -1) {
                  // Conversation not in list, reload to get it
                  if (loadConversationsRef.current) {
                    loadConversationsRef.current();
                  }
                  return prev;
                }
                
                // Check if message already exists (avoid duplicates)
                // Check by timestamp and text, or by exact match if timestamps are very close
                const conversation = prev[index];
                const messageExists = conversation.messages.some(
                  m => {
                    // Exact match on timestamp and text
                    if (m.timestamp === newMessage.timestamp && m.text === newMessage.text) {
                      return true;
                    }
                    // Also check if same text within 1 second (handles slight timestamp differences)
                    if (m.text === newMessage.text && Math.abs(m.timestamp - newMessage.timestamp) < 1000) {
                      return true;
                    }
                    return false;
                  }
                );
                
                if (messageExists) {
                  console.log('Skipping duplicate message:', newMessage.text.substring(0, 50));
                  return prev;
                }
                
                // Add the new message to the conversation
                const updated = [...prev];
                const updatedConversation = {
                  ...conversation,
                  messages: [...conversation.messages, newMessage].sort(
                    (a, b) => a.timestamp - b.timestamp
                  ),
                  messageCount: convData.message_count || conversation.messageCount + 1,
                };
                
                // Move conversation to the top of the list (most recent message first)
                updated.splice(index, 1); // Remove from current position
                updated.unshift(updatedConversation); // Add to beginning
                
                return updated;
              });
              
              // Increment unread count only if conversation is NOT currently being viewed
              // Use ref to get latest viewedConversationId value
              const currentlyViewed = viewedConversationIdRef.current === message.conversation_id;
              
              if (!currentlyViewed && message.role === 'user') {
                setUnreadConversations(prev => {
                  const next = new Map(prev);
                  const currentCount = next.get(message.conversation_id) || 0;
                  next.set(message.conversation_id, currentCount + 1);
                  console.log('Incremented unread count for conversation:', message.conversation_id, 'New count:', currentCount + 1);
                  return next;
                });
              } else {
                console.log('Message received for currently viewed conversation or bot message, not incrementing unread count');
              }
              
              // Show notification for new messages (only if it's a user message, not bot response)
              if (message.role === 'user') {
                console.log('Showing notification for widget user message');
                if (showSuccessRef.current) {
                  showSuccessRef.current('New message received', 'A user sent a new message');
                } else {
                  console.warn('showSuccessRef.current is not available yet, will retry...');
                  // Retry after a short delay
                  setTimeout(() => {
                    if (showSuccessRef.current) {
                      showSuccessRef.current('New message received', 'A user sent a new message');
                    }
                  }, 500);
                }
              }
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Messages channel subscribed successfully');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Messages channel error');
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Messages channel timed out');
        } else {
          console.log('Messages channel status:', status);
        }
      });
    
    return () => {
      console.log('Unsubscribing from real-time channels...');
      conversationsChannel.unsubscribe();
      messagesChannel.unsubscribe();
    };
  }, [user?.id]); // Only recreate if user ID changes
  
  // Load bots from Supabase when user is authenticated
  useEffect(() => {
    if (user) {
      loadBots();
      loadConversations();
    } else {
      setBots([]);
      setConversations([]);
      setBotsLoading(false);
    }
  }, [user, loadBots, loadConversations]);
  
  // Setup real-time subscriptions as soon as user is logged in
  // Subscriptions will work even if bots aren't loaded yet (they'll use botsRef.current)
  // Notifications will work from any page in the app
  useEffect(() => {
    if (!user) {
      // Clean up if user logs out
      if (subscriptionsSetupRef.current && subscriptionsCleanupRef.current) {
        console.log('User logged out, cleaning up real-time subscriptions...');
        subscriptionsCleanupRef.current();
        subscriptionsCleanupRef.current = null;
        subscriptionsSetupRef.current = false;
      }
      return;
    }
    
    // Only set up once per user session
    if (subscriptionsSetupRef.current) {
      console.log('Subscriptions already set up for user:', user.id);
      return;
    }
    
    console.log('Setting up real-time subscriptions...', { 
      userId: user.id, 
      botCount: botsRef.current.length, 
      botIds: botsRef.current.map(b => b.id) 
    });
    
    subscriptionsSetupRef.current = true;
    const cleanup = setupRealtimeSubscriptions();
    subscriptionsCleanupRef.current = cleanup;
    
    return () => {
      // Only cleanup on unmount or user change
      if (subscriptionsSetupRef.current && subscriptionsCleanupRef.current) {
        console.log('Cleaning up real-time subscriptions...');
        subscriptionsCleanupRef.current();
        subscriptionsCleanupRef.current = null;
        subscriptionsSetupRef.current = false;
      }
    };
  }, [user?.id]); // Only re-setup when user ID changes (setupRealtimeSubscriptions uses refs so it doesn't need to be in deps)

  const handleCreateNew = () => {
    setActiveBot(null);
    setView(ViewState.BOT_BUILDER);
  };

  const handleSelectBot = (bot: Bot) => {
    setActiveBot(bot);
    // If we are in Dashboard, go to Builder to edit the bot.
    // If we are in Playground or Integration, stay there but switch context.
    // If in Inbox, stay in Inbox (optional, but usually users might want to see filtered inbox)
    if (view === ViewState.DASHBOARD) {
      setView(ViewState.BOT_BUILDER);
    }
  };

  const handleSaveBot = async (bot: Bot) => {
    try {
      // Generate temp ID if new bot
      const botToSave = {
        ...bot,
        id: bot.id || `temp-${Date.now()}`,
      };
      
      const savedBot = await botService.saveBot(botToSave);
      await loadBots(); // Reload bots from database
      setActiveBot(savedBot);
      showSuccess('Bot saved successfully', `${bot.name} has been saved`);
    } catch (error: any) {
      showError('Failed to save bot', error.message || 'Please check your connection and try again');
    }
  };

  const handleDeleteBot = async (botId: string) => {
    setModal({
      isOpen: true,
      title: 'Delete Bot',
      message: 'Are you sure you want to delete this bot? This will also delete all conversations and messages associated with it.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await botService.deleteBot(botId);
          await loadBots(); // Reload bots from database
          await loadConversations(); // Reload conversations
          
          // Clear active bot if it was deleted
          if (activeBot?.id === botId) {
            setActiveBot(null);
            if (view === ViewState.BOT_BUILDER || view === ViewState.PLAYGROUND || view === ViewState.INTEGRATION) {
              setView(ViewState.DASHBOARD);
            }
          }
          
          showSuccess('Bot deleted', 'Bot has been deleted. All conversations have been archived.');
        } catch (error: any) {
          showError('Failed to delete bot', error.message || 'Please check your connection and try again');
        }
      },
    });
  };

  const handleDeleteConversation = async (conversationId: string) => {
    setModal({
      isOpen: true,
      title: 'Archive Conversation',
      message: 'Are you sure you want to archive this conversation? It will be hidden but can be viewed in the archive.',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await conversationService.deleteConversation(conversationId);
          await loadConversations(); // Reload conversations from database
          
          showSuccess('Conversation archived', 'Conversation has been archived. You can view it in the archive view.');
        } catch (error: any) {
          showError('Failed to archive conversation', error.message || 'Please check your connection and try again');
        }
      },
    });
  };

  const renderContent = () => {
    switch (view) {
      case ViewState.DASHBOARD:
        return (
          <Dashboard 
            bots={bots} 
            conversations={conversations}
            onCreateNew={handleCreateNew}
            onSelectBot={(bot) => {
              setActiveBot(bot);
              setView(ViewState.BOT_BUILDER);
            }}
            onDeleteBot={handleDeleteBot}
          />
        );
      case ViewState.BOT_BUILDER:
        return (
          <BotBuilder 
            key={activeBot?.id || 'new_bot'} // Force re-mount when switching bots
            bot={activeBot} 
            onSave={handleSaveBot} 
            onCreateNew={handleCreateNew}
            onBack={() => setView(ViewState.DASHBOARD)}
          />
        );
      case ViewState.INBOX:
        return (
          <Inbox 
            conversations={conversations} 
            bots={bots}
            unreadConversations={unreadConversations}
            viewedConversationId={viewedConversationId}
            onConversationRead={(conversationId) => {
              // Save last viewed timestamp to persist across page reloads
              saveLastViewedTimestamp(conversationId);
              
              // Reset unread count when conversation is viewed
              setUnreadConversations(prev => {
                const next = new Map(prev);
                next.delete(conversationId);
                return next;
              });
              // Track which conversation is currently being viewed
              setViewedConversationId(conversationId);
            }}
            onConversationViewChange={(conversationId) => {
              // Update viewed conversation when user selects a different conversation
              setViewedConversationId(conversationId);
            }}
            onDeleteConversation={handleDeleteConversation}
          />
        );
      case ViewState.PLAYGROUND:
        return activeBot ? (
          <ChatPlayground bot={activeBot} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 glass-card rounded-3xl m-8">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
               <span className="text-3xl">🤖</span>
            </div>
            <p className="text-lg font-medium text-white">No Bot Selected</p>
            <p className="text-sm text-slate-500 mt-1">Select a bot from the sidebar to test it.</p>
          </div>
        );
      case ViewState.INTEGRATION:
        return activeBot ? (
          <EmbedCode bot={activeBot} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 glass-card rounded-3xl m-8">
             <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
               <span className="text-3xl">🧩</span>
            </div>
             <p className="text-lg font-medium text-white">No Bot Selected</p>
             <p className="text-sm text-slate-500 mt-1">Select a bot from the sidebar to generate its embed code.</p>
          </div>
        );
      default:
        return <div>Not found</div>;
    }
  };

  const handleAuthSuccess = () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#050505] text-slate-100 items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">🤖</span>
          </div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="flex min-h-screen bg-[#050505] text-slate-100 overflow-hidden relative font-sans selection:bg-indigo-500/30">
      {/* Dynamic Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[150px] animate-pulse" style={{animationDuration: '8s'}} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-900/10 blur-[150px] animate-pulse" style={{animationDuration: '12s'}} />
        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-emerald-900/5 blur-[120px]" />
      </div>

      <Sidebar 
        currentView={view} 
        setView={setView} 
        bots={bots}
        activeBotId={activeBot?.id}
        onSelectBot={handleSelectBot}
        onCreateNew={handleCreateNew}
        unreadCount={Array.from(unreadConversations.values()).reduce((sum, count) => sum + count, 0)}
      />
      
      <main className="flex-1 relative z-10 h-screen overflow-y-auto overflow-x-hidden">
        {/* Top bar mostly for mobile or extra actions */}
        <header className="h-16 flex items-center justify-between px-8 sticky top-0 z-20 bg-[#050505]/80 backdrop-blur-sm border-b border-white/5">
          <div className="pointer-events-auto">
            {/* User info */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm text-slate-400 hidden sm:block">{user.email}</span>
            </div>
          </div>
          <div className="pointer-events-auto">
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              Sign Out
            </button>
          </div>
        </header>
        
        <div className="px-4 lg:px-8 pb-12 max-w-[1600px] mx-auto min-h-[calc(100vh-4rem)]">
          {renderContent()}
        </div>
      </main>
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, title: '', message: '' })}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type="confirm"
        variant={modal.variant || 'info'}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
};

export default App;