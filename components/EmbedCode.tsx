import React, { useState, useEffect } from 'react';
import { useNotification } from './Notification';
import { Modal } from './Modal';
import { Bot, Integration } from '../types';
import { Copy, Check, Code, MessageSquare, Palette, Layout, Eye, Globe, Zap, X, Send, User, Plus, Trash2 } from 'lucide-react';
import { integrationService } from '../services/database';

interface EmbedCodeProps {
  bot: Bot;
}

const EmbedCode: React.FC<EmbedCodeProps> = ({ bot }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  
  // Integration Management State
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Widget Customization State (for new integration or editing)
  const [integrationName, setIntegrationName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState(`Hi there! I'm ${bot.name}. How can I help you?`);
  const [brandColor, setBrandColor] = useState('#6366f1');
  const [position, setPosition] = useState<'right' | 'left'>('right');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [collectLeads, setCollectLeads] = useState(bot.collectLeads || false);

  // Preview State
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  // Preview specific state for lead form
  const [hasSubmittedLead, setHasSubmittedLead] = useState(!collectLeads);
  const [previewEmail, setPreviewEmail] = useState('');
  const [previewPhone, setPreviewPhone] = useState('');

  // Load integrations for this bot
  useEffect(() => {
    loadIntegrations();
  }, [bot.id]);

  // Update selected integration when integrations change
  useEffect(() => {
    if (integrations.length > 0 && !selectedIntegration && !isCreating) {
      setSelectedIntegration(integrations[0]);
      loadIntegrationSettings(integrations[0]);
    }
  }, [integrations]);

  // Reset preview state when bot config changes
  useEffect(() => {
    setHasSubmittedLead(!collectLeads);
  }, [collectLeads]);

  const loadIntegrations = async () => {
    try {
      setIsLoading(true);
      const data = await integrationService.getIntegrationsByBotId(bot.id);
      setIntegrations(data);
      if (data.length > 0 && !selectedIntegration) {
        setSelectedIntegration(data[0]);
        loadIntegrationSettings(data[0]);
      }
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadIntegrationSettings = (integration: Integration) => {
    setIntegrationName(integration.name || '');
    setWelcomeMessage(integration.welcomeMessage || `Hi there! I'm ${bot.name}. How can I help you?`);
    setBrandColor(integration.brandColor);
    setPosition(integration.position);
    setTheme(integration.theme);
    setCollectLeads(integration.collectLeads);
    setHasSubmittedLead(!integration.collectLeads);
  };

  const handleCreateIntegration = async () => {
    try {
      const newIntegration = await integrationService.createIntegration(bot.id, {
        name: integrationName.trim() || undefined,
        theme,
        position,
        brandColor,
        welcomeMessage,
        collectLeads,
      });
      await loadIntegrations();
      setSelectedIntegration(newIntegration);
      setIsCreating(false);
      showSuccess('Integration created', 'Your integration has been created successfully.');
    } catch (error) {
      console.error('Failed to create integration:', error);
      showError('Failed to create integration', 'Please try again.');
    }
  };

  const handleUpdateIntegration = async () => {
    if (!selectedIntegration) return;
    try {
      const updated = await integrationService.updateIntegration(selectedIntegration.id, {
        name: integrationName.trim() || undefined,
        theme,
        position,
        brandColor,
        welcomeMessage,
        collectLeads,
      });
      await loadIntegrations();
      setSelectedIntegration(updated);
      showSuccess('Integration updated', 'Your integration has been updated successfully.');
    } catch (error) {
      console.error('Failed to update integration:', error);
      showError('Failed to update integration', 'Please try again.');
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    setModal({
      isOpen: true,
      title: 'Delete Integration',
      message: 'Are you sure you want to delete this integration? This cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await integrationService.deleteIntegration(integrationId);
          await loadIntegrations();
          if (selectedIntegration?.id === integrationId) {
            setSelectedIntegration(null);
          }
          showSuccess('Integration deleted', 'The integration has been deleted successfully.');
        } catch (error) {
          console.error('Failed to delete integration:', error);
          showError('Failed to delete integration', 'Please try again.');
        }
      },
    });
  };

  // Generate the actual functional script
  const generateScript = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    // Extract base URL from environment or use placeholder
    let baseUrl = '';
    try {
      if (supabaseUrl) {
        const url = new URL(supabaseUrl);
        baseUrl = url.origin;
      } else {
        baseUrl = 'YOUR_DOMAIN';
      }
    } catch (e) {
      baseUrl = 'YOUR_DOMAIN';
    }
    
    // Calculate theme colors
    const isDark = theme === 'dark';
    const bgColor = isDark ? '#09090b' : '#ffffff';
    const textColor = isDark ? '#f4f4f5' : '#18181b';
    const secondaryBg = isDark ? '#18181b' : '#f4f4f5';
    const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const botMsgBg = isDark ? '#27272a' : '#f3f4f6';
    const botMsgText = isDark ? '#e4e4e7' : '#1f2937';
    
    // Use Supabase Storage URLs for widget files
    // Update these paths to match your actual bucket and folder structure
    // Format: /storage/v1/object/public/{bucket-name}/{folder-path}/{filename}
    // Add cache-busting parameter to force fresh CSS loads
    const cacheBuster = Date.now();
    const widgetCssUrl = `${baseUrl}/storage/v1/object/public/Assets/public/widget.css?v=${cacheBuster}`;
    const widgetJsUrl = `${baseUrl}/storage/v1/object/public/Assets/public/widget.js?v=${cacheBuster}`;
    
    // API URL: Use Netlify function if NETLIFY_URL is set, otherwise use Supabase edge function directly
    // For Netlify: Set VITE_NETLIFY_URL=https://your-site.netlify.app in your .env file
    const netlifyUrl = import.meta.env.VITE_NETLIFY_URL || '';
    // Remove trailing slash if present to avoid double slashes
    const cleanNetlifyUrl = netlifyUrl.replace(/\/$/, '');
    const apiUrl = netlifyUrl 
      ? `${cleanNetlifyUrl}/.netlify/functions/chat`
      : `${baseUrl}/functions/v1/proxy-ai`;
    
    // Use integrationId if available, otherwise fall back to botId format
    const configObject: any = {
      supabaseUrl: baseUrl,
      apiUrl: apiUrl,
    };

    if (selectedIntegration) {
      // New format: use integrationId (widget will fetch both integration and bot configs)
      configObject.integrationId = selectedIntegration.id;
    } else {
      // Fallback: use botId format (backward compatibility)
      configObject.botId = bot.id;
      configObject.theme = theme;
      configObject.position = position;
      configObject.brandColor = brandColor;
      configObject.welcomeMessage = welcomeMessage;
      configObject.collectLeads = collectLeads;
    }
    
    // Always add supabaseAnonKey - widget needs it for:
    // 1. Fetching bot configuration from Supabase
    // 2. Creating conversations and saving messages via Supabase REST API
    if (supabaseAnonKey) {
      configObject.supabaseAnonKey = supabaseAnonKey;
    } else {
      console.warn('Warning: VITE_SUPABASE_ANON_KEY is not set. Widget will not be able to fetch bot config, create conversations, or save messages.');
    }
    
    const scriptContent = `<!-- Aether AI Widget -->
<link rel="stylesheet" href="${widgetCssUrl}">

<style>
  :root {
    --aether-brand-color: ${brandColor};
    --aether-bg-color: ${bgColor};
    --aether-text-color: ${textColor};
    --aether-secondary-bg: ${secondaryBg};
    --aether-border-color: ${borderColor};
    --aether-bot-msg-bg: ${botMsgBg};
    --aether-bot-msg-text: ${botMsgText};
  }
</style>

<script>
  window.AetherBotConfig = ${JSON.stringify(configObject, null, 2)};
</script>

<script src="${widgetJsUrl}"></script>`;
    return scriptContent.trim();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateScript());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePreviewSubmit = () => {
    if (previewEmail && previewPhone) {
      setHasSubmittedLead(true);
    }
  };

  // Helper to get matching styles for Preview based on theme
  const getPreviewStyles = () => {
    const isDark = theme === 'dark';
    return {
      windowBg: isDark ? '#09090b' : '#ffffff',
      secondaryBg: isDark ? '#18181b' : '#f4f4f5',
      textColor: isDark ? '#f4f4f5' : '#18181b',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      botMsgBg: isDark ? '#27272a' : '#f3f4f6',
      botMsgText: isDark ? '#e4e4e7' : '#1f2937',
    };
  };

  const s = getPreviewStyles();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Deployment & Integration</h1>
          <p className="text-slate-400 mt-1">Customize your widget and generate the installation code.</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setActiveTab('code')}
             className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white bg-white/5'}`}
           >
             <Code className="w-4 h-4" /> Get Code
           </button>
           <button 
             onClick={() => setActiveTab('preview')}
             className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white bg-white/5'}`}
           >
             <Eye className="w-4 h-4" /> Preview
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
        
        {/* Left Column: Configuration */}
        <div className="glass-card p-6 rounded-3xl overflow-y-auto custom-scrollbar space-y-8">
           
           {/* Integration Management */}
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="text-white font-semibold flex items-center gap-2">
                    <Globe className="w-5 h-5 text-indigo-400" /> Integrations
                 </h3>
                 <button
                    onClick={() => {
                      setIsCreating(true);
                      setSelectedIntegration(null);
                      setIntegrationName('');
                      setWelcomeMessage(`Hi there! I'm ${bot.name}. How can I help you?`);
                      setBrandColor('#6366f1');
                      setPosition('right');
                      setTheme('dark');
                      setCollectLeads(bot.collectLeads || false);
                    }}
                    className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
                 >
                    <Plus className="w-4 h-4" />
                 </button>
              </div>
              
              {isLoading ? (
                 <div className="text-slate-400 text-sm">Loading integrations...</div>
              ) : integrations.length === 0 && !isCreating ? (
                 <div className="text-center py-8">
                    <p className="text-slate-400 text-sm mb-4">No integrations yet</p>
                    <button
                       onClick={() => setIsCreating(true)}
                       className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-all"
                    >
                       Create Integration
                    </button>
                 </div>
              ) : (
                 <div className="space-y-2">
                    {integrations.map((integration) => (
                       <div
                          key={integration.id}
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                             selectedIntegration?.id === integration.id
                                ? 'bg-indigo-600/20 border-indigo-500'
                                : 'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                          onClick={() => {
                             setSelectedIntegration(integration);
                             loadIntegrationSettings(integration);
                             setIsCreating(false);
                          }}
                       >
                          <div className="flex items-center justify-between">
                             <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-medium truncate">
                                   {integration.name || `Integration ${integrations.indexOf(integration) + 1}`}
                                </div>
                                <div className="text-slate-400 text-xs mt-0.5">
                                   {integration.theme} • {integration.position}
                                </div>
                             </div>
                             <button
                                onClick={(e) => {
                                   e.stopPropagation();
                                   handleDeleteIntegration(integration.id);
                                }}
                                className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                             >
                                <Trash2 className="w-3.5 h-3.5" />
                             </button>
                          </div>
                       </div>
                    ))}
                 </div>
              )}
           </div>

           {(selectedIntegration || isCreating) && (
              <>
                 <div className="w-full h-px bg-white/5"></div>

                 {/* Integration Name */}
                 <div className="space-y-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                       <Globe className="w-5 h-5 text-indigo-400" /> Integration Name
                    </h3>
                    <div className="space-y-3">
                       <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-400">Name</label>
                          <input 
                             type="text"
                             value={integrationName}
                             onChange={(e) => setIntegrationName(e.target.value)}
                             placeholder="e.g., Main Website, Landing Page, Support Chat"
                             className="w-full p-3 rounded-xl glass-input text-sm placeholder-slate-500"
                          />
                          <p className="text-xs text-slate-500">Give this integration a memorable name</p>
                       </div>
                    </div>
                 </div>

                 <div className="w-full h-px bg-white/5"></div>

                 {/* General Settings */}
                 <div className="space-y-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                       <MessageSquare className="w-5 h-5 text-indigo-400" /> Widget Settings
                    </h3>
                    <div className="space-y-3">
                       <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-400">Welcome Message</label>
                          <textarea 
                             value={welcomeMessage}
                             onChange={(e) => setWelcomeMessage(e.target.value)}
                             className="w-full p-3 rounded-xl glass-input text-sm resize-none h-20 placeholder-slate-500"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-400 flex items-center gap-2">
                             <input
                                type="checkbox"
                                checked={collectLeads}
                                onChange={(e) => setCollectLeads(e.target.checked)}
                                className="rounded"
                             />
                             Collect Leads
                          </label>
                       </div>
                    </div>
                 </div>
              </>
           )}

           {(selectedIntegration || isCreating) && (
              <>
                 <div className="w-full h-px bg-white/5"></div>

                 {/* Appearance */}
                 <div className="space-y-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                       <Palette className="w-5 h-5 text-pink-400" /> Appearance
                    </h3>
              <div className="space-y-3">
                 <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Brand Color</label>
                    <div className="flex gap-3 mt-1">
                       {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#000000'].map(c => (
                         <button 
                           key={c}
                           onClick={() => setBrandColor(c)}
                           className={`w-8 h-8 rounded-full border-2 transition-all ${brandColor === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                           style={{ backgroundColor: c }}
                         />
                       ))}
                       <input 
                         type="color" 
                         value={brandColor} 
                         onChange={(e) => setBrandColor(e.target.value)}
                         className="w-8 h-8 rounded-full bg-transparent border-none cursor-pointer p-0"
                       />
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                       <label className="text-xs font-medium text-slate-400">Theme</label>
                       <div className="flex bg-black/30 p-1 rounded-lg border border-white/5">
                          <button 
                             onClick={() => setTheme('light')}
                             className={`flex-1 py-1.5 text-xs rounded-md transition-all ${theme === 'light' ? 'bg-white text-black font-medium' : 'text-slate-400 hover:text-white'}`}
                          >
                             Light
                          </button>
                          <button 
                             onClick={() => setTheme('dark')}
                             className={`flex-1 py-1.5 text-xs rounded-md transition-all ${theme === 'dark' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                          >
                             Dark
                          </button>
                       </div>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-medium text-slate-400">Position</label>
                       <div className="flex bg-black/30 p-1 rounded-lg border border-white/5">
                          <button 
                             onClick={() => setPosition('left')}
                             className={`flex-1 py-1.5 text-xs rounded-md transition-all ${position === 'left' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                          >
                             Left
                          </button>
                          <button 
                             onClick={() => setPosition('right')}
                             className={`flex-1 py-1.5 text-xs rounded-md transition-all ${position === 'right' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                          >
                             Right
                          </button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {(selectedIntegration || isCreating) && (
              <div className="pt-4">
                 {isCreating ? (
                    <button
                       onClick={handleCreateIntegration}
                       className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all"
                    >
                       Create Integration
                    </button>
                 ) : (
                    <button
                       onClick={handleUpdateIntegration}
                       className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all"
                    >
                       Save Changes
                    </button>
                 )}
              </div>
           )}
              </>
           )}
        </div>

        {/* Right Column: Preview / Code */}
        <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
           {activeTab === 'code' ? (
             <div className="glass-card rounded-3xl p-0 h-full flex flex-col overflow-hidden relative group border-indigo-500/20">
                <div className="p-4 border-b border-white/5 bg-black/40 flex justify-between items-center">
                   <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                   </div>
                   <div className="text-xs text-slate-500 font-mono">embed-script.html</div>
                   <button
                     onClick={handleCopy}
                     className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
                   >
                     {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                     {copied ? 'Copied!' : 'Copy Snippet'}
                   </button>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-[#0B1120] custom-scrollbar">
                   <code className="text-xs md:text-sm font-mono text-indigo-300 leading-relaxed whitespace-pre block">
                      {generateScript()}
                   </code>
                </div>
                {/* Overlay Hint */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/80 to-transparent pointer-events-none">
                   <p className="text-slate-400 text-xs text-center">
                      Copy and paste this into the <span className="text-indigo-400 font-mono">&lt;head&gt;</span> or <span className="text-indigo-400 font-mono">&lt;body&gt;</span> of your website.
                   </p>
                </div>
             </div>
           ) : (
             <div className="glass-card rounded-3xl h-full relative overflow-hidden flex flex-col border-0">
                {/* Simulated Browser Bar */}
                <div className="h-10 bg-[#1e1e24] flex items-center px-4 gap-4 border-b border-white/5">
                   <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                   </div>
                   <div className="flex-1 bg-black/40 h-6 rounded-md flex items-center px-3 text-[10px] text-slate-500 font-mono overflow-hidden">
                      <Globe className="w-3 h-3 mr-2 flex-shrink-0" />
                      <span className="truncate">{bot.website || 'https://your-website.com'}</span>
                   </div>
                </div>

                {/* Mock Website Content */}
                <div className="flex-1 bg-white dark:bg-slate-900 relative overflow-y-auto">
                   {/* Mock Hero Section */}
                   <div className={`w-full h-full p-8 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-slate-50'}`}>
                      <div className="max-w-2xl mx-auto mt-12 space-y-6">
                         <div className={`h-12 w-3/4 rounded-xl ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                         <div className={`h-4 w-full rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                         <div className={`h-4 w-5/6 rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                         <div className="flex gap-4 pt-4">
                            <div className="h-10 w-32 rounded-lg bg-indigo-500/20"></div>
                            <div className={`h-10 w-32 rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                         </div>
                      </div>
                      
                      {/* Widget Simulation (MATCHING THE INJECTED CSS) */}
                      <div 
                         className="absolute flex flex-col items-end gap-5"
                         style={{ 
                            bottom: '24px', 
                            [position]: '24px',
                            alignItems: position === 'right' ? 'flex-end' : 'flex-start'
                         }}
                      >
                         {/* Chat Window */}
                         <div 
                            className={`
                               width-[400px] h-[600px] rounded-[24px] shadow-2xl flex flex-col overflow-hidden transition-all duration-300 origin-bottom border
                               ${isWidgetOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}
                            `}
                            style={{ 
                              backgroundColor: s.windowBg,
                              borderColor: s.borderColor,
                              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5)'
                            }}
                         >
                            <div 
                              className="p-6 text-white relative overflow-hidden" 
                              style={{ 
                                background: `linear-gradient(135deg, ${brandColor}, black)` 
                              }}
                            >
                               <h4 className="font-bold text-lg leading-tight relative z-10">{bot.name}</h4>
                               <p className="text-xs opacity-90 flex items-center gap-1.5 mt-1 relative z-10">
                                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Online
                               </p>
                            </div>
                            
                            <div className="flex-1 relative flex flex-col overflow-hidden" style={{ backgroundColor: s.windowBg }}>
                                {!hasSubmittedLead ? (
                                  <div className="absolute inset-0 z-10 p-10 flex flex-col justify-center gap-6 text-center" style={{ backgroundColor: s.windowBg }}>
                                     <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white" style={{backgroundColor: brandColor}}>
                                        <User className="w-8 h-8" />
                                     </div>
                                     <div>
                                        <h3 className="text-2xl font-bold mb-2" style={{color: s.textColor}}>Start Conversation</h3>
                                        <p className="text-[15px] opacity-70 leading-relaxed" style={{color: s.textColor}}>Please share your details to connect with us.</p>
                                     </div>
                                     <div className="space-y-4 text-left">
                                        <div>
                                          <label className="block text-xs font-bold mb-2 ml-2" style={{color: s.textColor}}>Email Address</label>
                                          <input 
                                            type="email" 
                                            value={previewEmail}
                                            onChange={(e) => setPreviewEmail(e.target.value)}
                                            placeholder="you@company.com"
                                            className="w-full p-4 rounded-2xl border text-[15px] outline-none transition-all focus:ring-2"
                                            style={{ backgroundColor: s.secondaryBg, borderColor: s.borderColor, color: s.textColor, '--tw-ring-color': brandColor } as any}
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-bold mb-2 ml-2" style={{color: s.textColor}}>Phone Number</label>
                                          <input 
                                            type="tel" 
                                            value={previewPhone}
                                            onChange={(e) => setPreviewPhone(e.target.value)}
                                            placeholder="+1 (555) 000-0000"
                                            className="w-full p-4 rounded-2xl border text-[15px] outline-none transition-all focus:ring-2"
                                            style={{ backgroundColor: s.secondaryBg, borderColor: s.borderColor, color: s.textColor, '--tw-ring-color': brandColor } as any}
                                          />
                                        </div>
                                     </div>
                                     <button 
                                       onClick={handlePreviewSubmit}
                                       disabled={!previewEmail || !previewPhone}
                                       className="w-full py-4 rounded-2xl text-white font-bold text-base mt-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-lg active:scale-95"
                                       style={{ backgroundColor: brandColor }}
                                     >
                                       Start Chatting
                                     </button>
                                  </div>
                                ) : (
                                  <div className="h-full flex flex-col">
                                    <div className="flex-1 p-6 overflow-y-auto space-y-4">
                                        <div 
                                          className="p-4 rounded-[20px] rounded-bl-sm text-[15px] leading-relaxed max-w-[85%] shadow-sm self-start"
                                          style={{ backgroundColor: s.botMsgBg, color: s.botMsgText }}
                                        >
                                            {welcomeMessage}
                                        </div>
                                    </div>
                                    <div className="p-5 border-t" style={{ borderColor: s.borderColor, backgroundColor: s.windowBg }}>
                                        <div className="relative flex items-center">
                                          <input 
                                            type="text"
                                            className="w-full p-4 pr-12 rounded-full border text-[15px] outline-none focus:ring-2 transition-all"
                                            placeholder="Type a message..."
                                            style={{ backgroundColor: s.secondaryBg, borderColor: s.borderColor, color: s.textColor, '--tw-ring-color': brandColor } as any}
                                          />
                                          <button className="absolute right-2 w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105" style={{ backgroundColor: brandColor }}>
                                            <Send className="w-4 h-4 ml-[-2px]" />
                                          </button>
                                        </div>
                                    </div>
                                  </div>
                                )}
                            </div>
                         </div>

                         {/* Launcher */}
                         <button
                            onClick={() => setIsWidgetOpen(!isWidgetOpen)}
                            className="w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95"
                            style={{ backgroundColor: brandColor, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
                         >
                            {isWidgetOpen ? (
                               <X className="w-8 h-8" />
                            ) : (
                               <MessageSquare className="w-8 h-8" />
                            )}
                         </button>
                      </div>

                   </div>
                </div>
             </div>
           )}
        </div>

      </div>
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, title: '', message: '' })}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type="confirm"
        variant={modal.variant || 'info'}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default EmbedCode;