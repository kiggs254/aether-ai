import React, { useState, useRef, useEffect } from 'react';
import { Bot, ChatMessage, BotAction } from '../types';
import { Send, User, Bot as BotIcon, RefreshCw, Eraser, AlertTriangle, Sparkles, ExternalLink, Phone, MessageCircle, Users, ArrowRight } from 'lucide-react';
import { createChatStream } from '../services/geminiService';
import { conversationService } from '../services/database';
import { useNotification } from './Notification';

interface ChatPlaygroundProps {
  bot: Bot;
}

const ChatPlayground: React.FC<ChatPlaygroundProps> = ({ bot }) => {
  const { showError } = useNotification();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: `Hello! I am ${bot.name}. How can I assist you today?`, timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  useEffect(() => {
    setMessages([{ role: 'model', text: `Hello! I am ${bot.name}. How can I assist you today?`, timestamp: Date.now() }]);
    setConversationId(null);
    // Create a new conversation when bot changes
    createNewConversation();
  }, [bot.id]);

  const createNewConversation = async () => {
    // Don't create conversations in playground - just use local state
    // Conversations are only saved for widget chats
    setConversationId(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    // Don't save playground conversations - just use local state
    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    
    setInput('');
    setIsStreaming(true);

    try {
      // 1. Create a placeholder message for the bot
      setMessages(prev => [...prev, { role: 'model', text: '', timestamp: Date.now(), isStreaming: true }]);
      
      const history = messages.slice(-10); // Context window
      const stream = await createChatStream(bot, history, userMsg.text);

      let fullText = '';
      let functionCallFound = false;
      
      for await (const chunk of stream) {
        // Check for function calls (tools)
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            functionCallFound = true;
            const call = chunk.functionCalls[0];
            if (call.name === 'trigger_action') {
                const actionId = (call.args as any).action_id;
                
                // Get custom trigger message from action if available
                let triggerMessage = "I've triggered the requested action for you.";
                if (actionId && bot.actions) {
                    const action = bot.actions.find(a => a.id === actionId);
                    if (action && action.triggerMessage) {
                        triggerMessage = action.triggerMessage;
                    }
                }
                
                // Update the placeholder with action data
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    lastMsg.text = triggerMessage;
                    lastMsg.actionInvoked = actionId;
                    return newMessages;
                });
            }
        }

        // If simple text
        const chunkText = chunk.text; // Use property access, not method call
        if (chunkText && !functionCallFound) {
            fullText += chunkText;
            setMessages(prev => {
               const newMessages = [...prev];
               const lastMsg = newMessages[newMessages.length - 1];
               if (lastMsg.role === 'model' && !lastMsg.actionInvoked) {
                  lastMsg.text = fullText;
               }
               return newMessages;
            });
        }
      }
    } catch (error: any) {
       const errorMessage = error.message || 'Failed to get AI response';
       console.error('Chat error:', error);
       
       // Show more specific error messages
       if (errorMessage.includes('Supabase URL not configured')) {
         showError('Configuration Error', 'Supabase URL is not set. Please check your environment variables.');
       } else if (errorMessage.includes('Not authenticated')) {
         showError('Authentication Error', 'Please sign in again to continue.');
       } else if (errorMessage.includes('API key not configured')) {
         showError('API Key Missing', 'Please configure your API keys in Supabase edge function secrets.');
       } else if (errorMessage.includes('Unauthorized')) {
         showError('Access Denied', 'You do not have permission to use this feature.');
       } else {
         showError('Connection Error', errorMessage);
       }
       
       setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting right now. Please try again.", timestamp: Date.now() }]);
    } finally {
      setIsStreaming(false);
      // Remove streaming flag from last message and save it
      setMessages(prev => {
         const newMessages = [...prev];
         const lastMsg = newMessages[newMessages.length - 1];
         if (lastMsg) {
           delete lastMsg.isStreaming;
           // Save bot response to database
           if (conversationId && lastMsg.role === 'model') {
             // Don't save playground messages to database
           }
         }
         return newMessages;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'model', text: `Hello! I am ${bot.name}. How can I assist you today?`, timestamp: Date.now() }]);
  };

  const renderActionCard = (actionId: string) => {
      const action = bot.actions?.find(a => a.id === actionId);
      if (!action) return null;

      let icon = <ExternalLink className="w-5 h-5" />;
      let bgColor = 'bg-indigo-600';

      if (action.type === 'whatsapp') {
          icon = <MessageCircle className="w-5 h-5" />;
          bgColor = 'bg-green-600';
      } else if (action.type === 'phone') {
          icon = <Phone className="w-5 h-5" />;
          bgColor = 'bg-blue-600';
      } else if (action.type === 'handoff') {
          icon = <Users className="w-5 h-5" />;
          bgColor = 'bg-orange-600';
      }

      // Action card - no trigger message here, it's already in the message bubble
      return (
          <div className="mt-3 p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col items-start gap-3 w-fit animate-fade-in">
              <a 
                href={action.payload} 
                target="_blank" 
                rel="noreferrer"
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium transition-all shadow-lg hover:brightness-110 active:scale-95 ${bgColor}`}
              >
                  {icon}
                  {action.label}
                  <ArrowRight className="w-4 h-4 opacity-70" />
              </a>
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      <div className="flex-1 flex flex-col glass-card rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="p-4 px-6 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bot.avatarColor} flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]`}>
              <BotIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg tracking-tight">{bot.name}</h3>
              <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {bot.provider === 'openai' ? 'OpenAI' : 'Gemini'} {bot.model || 'Active'}
              </p>
            </div>
          </div>
          <button 
            onClick={clearChat}
            className="p-2.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95"
            title="Reset Session"
          >
            <Eraser className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/20 scroll-smooth">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`flex items-end gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-md ${isUser ? 'bg-indigo-600' : 'bg-slate-800 border border-white/10'}`}>
                    {isUser ? <User className="w-4 h-4 text-white" /> : <BotIcon className="w-4 h-4 text-white" />}
                  </div>

                  {/* Bubble */}
                  <div 
                    className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-lg ${
                      isUser 
                        ? 'bg-indigo-600 text-white rounded-br-none bg-gradient-to-br from-indigo-600 to-indigo-700' 
                        : 'bg-[#1a1a20] text-slate-200 rounded-bl-none border border-white/5'
                    }`}
                  >
                    {msg.text}
                    {msg.isStreaming && (
                       <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle"></span>
                    )}
                    {/* Render Action if Invoked */}
                    {msg.actionInvoked && renderActionCard(msg.actionInvoked)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/5 border-t border-white/5 backdrop-blur-xl">
          <div className="relative max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message your bot..."
              className="w-full pl-5 pr-14 py-4 bg-black/40 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 resize-none shadow-inner"
              style={{ minHeight: '60px', maxHeight: '150px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="absolute right-3 top-3 p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center"
            >
              {isStreaming ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-3 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" /> Powered by Gemini
          </p>
        </div>
      </div>
      
      {/* Bot Info Sidebar */}
      <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
        <div className="glass-card p-6 rounded-3xl">
          <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider text-indigo-400">Live Context</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-slate-400 text-sm">Temperature</span>
              <span className="text-white font-mono text-sm">{bot.temperature ?? 0.7}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-slate-400 text-sm">Active Tools</span>
              <span className="text-white font-mono text-sm">{bot.actions?.length || 0}</span>
            </div>
            <div>
              <span className="text-slate-400 text-sm block mb-2">System Instruction Preview</span>
              <div className="p-3 bg-black/30 rounded-xl border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                <p className="text-xs text-slate-500 font-mono leading-relaxed">{bot.systemInstruction}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
               <BotIcon className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-400">
               This bot is trained on <span className="text-white font-bold">{bot.knowledgeBase.length}</span> characters of custom knowledge.
            </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPlayground;