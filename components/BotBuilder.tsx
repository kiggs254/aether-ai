import React, { useState, useEffect } from 'react';
import { Bot, BotAction, ActionType } from '../types';
import { Save, Brain, Sparkles, Wand2, Sliders, Info, Globe, Plus, ChevronLeft, Check, UserPlus, Zap, Trash2, ExternalLink, Phone, MessageCircle, Users, Image, File, Video, Music } from 'lucide-react';
import { suggestBotDescription, optimizeSystemInstruction } from '../services/geminiService';
import { uploadMediaFile, validateMediaFile, getMediaType, MediaType } from '../services/storage';
import { useNotification } from './Notification';

interface BotBuilderProps {
  bot: Bot | null;
  onSave: (bot: Bot) => void;
  onCreateNew: () => void;
  onBack: () => void;
}

const BotBuilder: React.FC<BotBuilderProps> = ({ bot, onSave, onCreateNew, onBack }) => {
  const { showSuccess, showError } = useNotification();
  const [name, setName] = useState(bot?.name || '');
  const [description, setDescription] = useState(bot?.description || '');
  const [website, setWebsite] = useState(bot?.website || '');
  const [instruction, setInstruction] = useState(bot?.systemInstruction || 'You are a helpful AI assistant.');
  const [knowledge, setKnowledge] = useState(bot?.knowledgeBase || '');
  const [temperature, setTemperature] = useState(bot?.temperature ?? 0.7);
  const [provider, setProvider] = useState<'gemini' | 'openai'>(bot?.provider || 'gemini');
  const [model, setModel] = useState(bot?.model || 'gemini-3-flash-preview');
  const [actions, setActions] = useState<BotAction[]>(bot?.actions || []);
  const [brandingText, setBrandingText] = useState(bot?.brandingText || '');
  const [headerImageUrl, setHeaderImageUrl] = useState(bot?.headerImageUrl || '');
  
  const [activeTab, setActiveTab] = useState<'persona' | 'knowledge' | 'actions'>('persona');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // Action Form State
  const [isEditingAction, setIsEditingAction] = useState(false);
  const [currentAction, setCurrentAction] = useState<BotAction>({
    id: '', type: 'link', label: '', payload: '', description: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Header Image State
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);

  useEffect(() => {
    if (bot) {
      setName(bot.name);
      setDescription(bot.description);
      setWebsite(bot.website || '');
      setInstruction(bot.systemInstruction);
      setKnowledge(bot.knowledgeBase);
      setTemperature(bot.temperature ?? 0.7);
      setProvider(bot.provider || 'gemini');
      setModel(bot.model || 'gemini-3-flash-preview');
      setActions(bot.actions || []);
      setBrandingText(bot.brandingText || '');
      setHeaderImageUrl(bot.headerImageUrl || '');
      setHeaderImagePreview(bot.headerImageUrl || null);
    } else {
      setName('');
      setDescription('');
      setWebsite('');
      setInstruction('You are a helpful AI assistant.');
      setKnowledge('');
      setTemperature(0.7);
      setProvider('gemini');
      setModel('gemini-3-flash-preview');
      setActions([]);
      setBrandingText('');
      setHeaderImageUrl('');
      setHeaderImagePreview(null);
    }
  }, [bot]);

  const handleSave = () => {
    const newBot: Bot = {
      id: bot?.id || crypto.randomUUID(),
      name: name || 'Untitled Bot',
      description,
      website: website || 'https://example.com',
      systemInstruction: instruction,
      knowledgeBase: knowledge,
      createdAt: bot?.createdAt || Date.now(),
      avatarColor: bot?.avatarColor || 'from-indigo-500 to-purple-600',
      totalInteractions: bot?.totalInteractions || 0,
      temperature,
      model,
      provider,
      status: bot?.status || 'active',
      actions,
      brandingText: brandingText.trim() || undefined,
      headerImageUrl: headerImageUrl.trim() || undefined
    };
    onSave(newBot);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleOptimize = async () => {
    if (!instruction || !name) return;
    setIsOptimizing(true);
    const optimized = await optimizeSystemInstruction(instruction, name);
    setInstruction(optimized);
    setIsOptimizing(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateMediaFile(file);
    if (!validation.valid) {
      showError('Invalid file', validation.error || 'Please select a valid media file.');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleHeaderImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only allow images for header
    if (!file.type.startsWith('image/')) {
      showError('Invalid file', 'Please select an image file for the header.');
      e.target.value = '';
      return;
    }

    // Check file size (5MB limit for header images)
    if (file.size > 5 * 1024 * 1024) {
      showError('File too large', 'Header image must be less than 5MB.');
      e.target.value = '';
      return;
    }

    setHeaderImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setHeaderImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Auto-upload if bot exists
    if (bot?.id) {
      setIsUploadingHeader(true);
      try {
        const url = await uploadHeaderImage(bot.id, file);
        setHeaderImageUrl(url);
        setHeaderImagePreview(url);
        showSuccess('Header image uploaded', 'Your header image has been uploaded successfully.');
        setHeaderImageFile(null);
      } catch (error: any) {
        showError('Upload failed', error.message || 'Failed to upload header image.');
        setHeaderImagePreview(null);
        setHeaderImageFile(null);
      } finally {
        setIsUploadingHeader(false);
      }
    }
  };

  const handleRemoveHeaderImage = async () => {
    if (headerImageUrl) {
      try {
        await deleteMediaFile(headerImageUrl);
      } catch (error) {
        console.error('Error deleting header image:', error);
      }
    }
    setHeaderImageUrl('');
    setHeaderImagePreview(null);
    setHeaderImageFile(null);
  };

  const handleSaveAction = async () => {
    if (!currentAction.label) {
      showError('Missing label', 'Please provide a button label for the action.');
      return;
    }

    // For media actions, we need a file
    if (currentAction.type === 'media') {
      if (!selectedFile && !currentAction.payload) {
        showError('Missing file', 'Please select a media file to upload.');
        return;
      }

      // If we have a new file, upload it
      if (selectedFile) {
        if (!bot?.id) {
          showError('No bot ID', 'Please save the bot first before adding media actions.');
          return;
        }

        setIsUploading(true);
        try {
          const fileUrl = await uploadMediaFile(bot.id, selectedFile);
          const mediaType = getMediaType(selectedFile);
          
          const actionToSave: BotAction = {
            ...currentAction,
            payload: fileUrl,
            mediaType: mediaType,
            fileSize: selectedFile.size,
          };

          if (currentAction.id) {
            setActions(prev => prev.map(a => a.id === currentAction.id ? actionToSave : a));
          } else {
            setActions(prev => [...prev, { ...actionToSave, id: crypto.randomUUID() }]);
          }

          setIsEditingAction(false);
          setCurrentAction({ id: '', type: 'link', label: '', payload: '', description: '' });
          setSelectedFile(null);
          setFilePreview(null);
          showSuccess('Media uploaded', 'Media file uploaded successfully.');
        } catch (error: any) {
          showError('Upload failed', error.message || 'Failed to upload media file.');
        } finally {
          setIsUploading(false);
        }
        return;
      }
    } else {
      // For non-media actions, payload is required
      if (!currentAction.payload) {
        showError('Missing payload', `Please provide a ${currentAction.type === 'link' ? 'URL' : currentAction.type === 'phone' || currentAction.type === 'whatsapp' ? 'phone number' : 'value'}.`);
        return;
      }
    }
    
    if (currentAction.id) {
       setActions(prev => prev.map(a => a.id === currentAction.id ? currentAction : a));
    } else {
       setActions(prev => [...prev, { ...currentAction, id: crypto.randomUUID() }]);
    }
    setIsEditingAction(false);
    setCurrentAction({ id: '', type: 'link', label: '', payload: '', description: '' });
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleDeleteAction = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
  };

  const getActionIcon = (type: ActionType, mediaType?: MediaType) => {
    switch (type) {
      case 'whatsapp': return <MessageCircle className="w-4 h-4" />;
      case 'phone': return <Phone className="w-4 h-4" />;
      case 'handoff': return <Users className="w-4 h-4" />;
      case 'media':
        switch (mediaType) {
          case 'image': return <Image className="w-4 h-4" />;
          case 'video': return <Video className="w-4 h-4" />;
          case 'audio': return <Music className="w-4 h-4" />;
          case 'pdf': return <File className="w-4 h-4" />;
          default: return <File className="w-4 h-4" />;
        }
      default: return <ExternalLink className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
             onClick={onBack}
             className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
             title="Back to Dashboard"
          >
             <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{bot ? 'Edit Bot' : 'New Bot'}</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Configure persona, intelligence, and behavior.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
           {bot && (
             <button 
               onClick={onCreateNew}
               className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 rounded-xl font-medium border border-white/5 transition-all text-sm sm:text-base"
             >
               <Plus className="w-4 h-4" />
               Create New
             </button>
           )}
           <button 
            onClick={handleSave}
            className={`flex items-center justify-center gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl font-medium shadow-lg transition-all active:scale-95 text-sm sm:text-base ${saveStatus === 'saved' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]'}`}
           >
             {saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
             {saveStatus === 'saved' ? 'Saved!' : 'Save Bot'}
           </button>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-white/5 rounded-xl w-fit mb-8 border border-white/5">
        <button
          onClick={() => setActiveTab('persona')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'persona' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Persona & Behavior
        </button>
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'knowledge' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Brain className="w-4 h-4" />
          Knowledge Base
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'actions' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Zap className="w-4 h-4" />
          Actions & Tools
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-10 space-y-6 animate-fade-in custom-scrollbar">
        {activeTab === 'persona' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Identity Section */}
              <div className="glass-card p-4 sm:p-6 rounded-2xl space-y-4">
                 <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Info className="w-5 h-5 text-indigo-400" /> Identity
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Bot Name</label>
                        <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Sales Assistant"
                        className="w-full p-3 rounded-xl glass-input placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Target Website</label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://myshop.com"
                            className="w-full p-3 pl-10 rounded-xl glass-input placeholder-slate-500"
                          />
                        </div>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Description</label>
                    <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short tagline for dashboard reference..."
                    className="w-full p-3 rounded-xl glass-input placeholder-slate-500"
                    />
                 </div>
              </div>

              {/* System Instruction */}
              <div className="glass-card p-4 sm:p-6 rounded-2xl space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Brain className="w-5 h-5 text-pink-400" /> Core Instruction
                    </h3>
                    <button 
                       onClick={handleOptimize}
                       disabled={isOptimizing}
                       className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                       <Wand2 className={`w-3 h-3 ${isOptimizing ? 'animate-spin' : ''}`} />
                       {isOptimizing ? 'Optimizing...' : 'Magic Optimize'}
                    </button>
                 </div>
                 <p className="text-sm text-slate-400">The "brain" of your bot. Define personality, constraints, and style here.</p>
                 <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    className="w-full h-80 p-4 rounded-xl glass-input placeholder-slate-500 resize-none font-mono text-sm leading-relaxed"
                    placeholder="You are a helpful customer support agent..."
                 />
              </div>
            </div>

            {/* Sidebar Controls */}
            <div className="space-y-6">
               <div className="glass-card p-6 rounded-2xl space-y-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                     <Sliders className="w-5 h-5 text-emerald-400" /> Controls
                  </h3>
                  
                  <div className="space-y-4">
                     <div>
                        <div className="flex justify-between mb-2">
                           <label className="text-sm text-slate-300">Creativity (Temperature)</label>
                           <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 rounded">{temperature}</span>
                        </div>
                        <input 
                           type="range" 
                           min="0" 
                           max="2" 
                           step="0.1" 
                           value={temperature}
                           onChange={(e) => setTemperature(parseFloat(e.target.value))}
                           className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                           <span>Precise</span>
                           <span>Balanced</span>
                           <span>Creative</span>
                        </div>
                     </div>
                     
                     <div className="pt-4 border-t border-white/5">
                        <label className="text-sm text-slate-300 block mb-2">AI Provider</label>
                        <select
                          value={provider}
                          onChange={(e) => {
                            const newProvider = e.target.value as 'gemini' | 'openai';
                            setProvider(newProvider);
                            // Set default model based on provider
                            if (newProvider === 'openai') {
                              setModel('gpt-4');
                            } else {
                              setModel('gemini-3-flash-preview');
                            }
                          }}
                          className="w-full p-3 rounded-xl glass-input text-white"
                        >
                          <option value="gemini">Google Gemini</option>
                          <option value="openai">OpenAI</option>
                        </select>
                     </div>
                     
                     <div className="pt-4 border-t border-white/5">
                        <label className="text-sm text-slate-300 block mb-2">Model</label>
                        <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full p-3 rounded-xl glass-input text-white"
                        >
                          {provider === 'gemini' ? (
                            <>
                              <option value="gemini-3-flash-preview">Gemini 3 Flash (Preview)</option>
                              <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
                              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                            </>
                          ) : (
                            <>
                              <option value="gpt-4">GPT-4</option>
                              <option value="gpt-4-turbo">GPT-4 Turbo</option>
                              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                            </>
                          )}
                        </select>
                     </div>
                     
                     <div className="pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between mb-2">
                           <label className="text-sm text-slate-300">Branding Text</label>
                           <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded uppercase font-medium">Premium</span>
                        </div>
                        <input
                          type="text"
                          value={brandingText}
                          onChange={(e) => setBrandingText(e.target.value)}
                          placeholder="Powered by Aether AI"
                          className="w-full p-3 rounded-xl glass-input text-white placeholder-slate-500 text-sm"
                        />
                        <p className="text-xs text-slate-500 mt-1.5">Customize the "Powered by" text shown in the widget. Leave empty for default.</p>
                     </div>

                     <div className="pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between mb-2">
                           <label className="text-sm text-slate-300">Header Image</label>
                           <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded uppercase font-medium">Premium</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">Upload a custom header image for the chat widget (max 5MB, JPG/PNG/GIF/WebP)</p>
                        
                        {headerImagePreview ? (
                          <div className="space-y-2">
                            <div className="relative rounded-xl overflow-hidden border border-white/10">
                              <img 
                                src={headerImagePreview} 
                                alt="Header preview" 
                                className="w-full h-32 object-cover"
                              />
                              {isUploadingHeader && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <div className="text-white text-sm">Uploading...</div>
                                </div>
                              )}
                              <button
                                onClick={handleRemoveHeaderImage}
                                disabled={isUploadingHeader}
                                className="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Remove header image"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            {!bot?.id && (
                              <p className="text-xs text-amber-400">Save the bot first to upload the header image.</p>
                            )}
                          </div>
                        ) : (
                          <label className="block">
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                              onChange={handleHeaderImageSelect}
                              className="hidden"
                            />
                            <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-500/50 transition-colors">
                              <Image className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                              <p className="text-sm text-slate-300">Click to upload header image</p>
                              <p className="text-xs text-slate-500 mt-1">JPG, PNG, GIF, or WebP (max 5MB)</p>
                            </div>
                          </label>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        ) : activeTab === 'actions' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
            <div className="lg:col-span-1 space-y-4">
               <div className="glass-card p-4 sm:p-6 rounded-2xl">
                 <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Add New Action</h3>
                 <p className="text-xs text-slate-400 mb-4 sm:mb-6">Create interactive buttons or functions for your bot to use.</p>
                 
                 <div className="space-y-4">
                    <div>
                       <label className="text-xs font-medium text-slate-300 mb-1 block">Action Type</label>
                       <div className="grid grid-cols-2 gap-2">
                          {['link', 'phone', 'whatsapp', 'handoff', 'media'].map((t) => (
                             <button
                                key={t}
                                onClick={() => {
                                  setCurrentAction(prev => ({ 
                                    ...prev, 
                                    type: t as ActionType, 
                                    label: t === 'whatsapp' ? 'Chat on WhatsApp' : t === 'media' ? 'View Media' : prev.label,
                                    payload: t === 'media' ? '' : prev.payload
                                  }));
                                  if (t !== 'media') {
                                    setSelectedFile(null);
                                    setFilePreview(null);
                                  }
                                }}
                                className={`p-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 transition-all ${currentAction.type === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5'}`}
                             >
                                {getActionIcon(t as ActionType)}
                                <span className="capitalize">{t}</span>
                             </button>
                          ))}
                       </div>
                    </div>

                    <div>
                       <label className="text-xs font-medium text-slate-300 mb-1 block">Button Label</label>
                       <input 
                         type="text" 
                         value={currentAction.label}
                         onChange={(e) => setCurrentAction(prev => ({ ...prev, label: e.target.value }))}
                         placeholder={currentAction.type === 'phone' ? 'Call Support' : 'Click Me'}
                         className="w-full p-2.5 rounded-xl glass-input text-sm placeholder-slate-600"
                       />
                    </div>

                    {currentAction.type === 'media' ? (
                       <div>
                          <label className="text-xs font-medium text-slate-300 mb-1 block">Media File</label>
                          <input 
                            type="file" 
                            accept="image/*,audio/*,video/*,application/pdf"
                            onChange={handleFileSelect}
                            className="w-full p-2.5 rounded-xl glass-input text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer"
                          />
                          {filePreview && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                              <img src={filePreview} alt="Preview" className="w-full max-h-48 object-contain" />
                            </div>
                          )}
                          {selectedFile && (
                            <div className="mt-2 text-xs text-slate-400">
                              <p>File: {selectedFile.name}</p>
                              <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              <p>Type: {getMediaType(selectedFile)}</p>
                            </div>
                          )}
                          {currentAction.payload && !selectedFile && (
                            <div className="mt-2 text-xs text-slate-400">
                              <p>Current file: {currentAction.mediaType || 'media'}</p>
                              {currentAction.fileSize && <p>Size: {(currentAction.fileSize / 1024 / 1024).toFixed(2)} MB</p>}
                            </div>
                          )}
                       </div>
                    ) : currentAction.type !== 'handoff' && (
                       <div>
                          <label className="text-xs font-medium text-slate-300 mb-1 block">
                             {currentAction.type === 'link' ? 'URL' : currentAction.type === 'whatsapp' ? 'WhatsApp Number' : 'Phone Number'}
                          </label>
                          <input 
                            type="text" 
                            value={currentAction.payload}
                            onChange={(e) => setCurrentAction(prev => ({ ...prev, payload: e.target.value }))}
                            placeholder={currentAction.type === 'link' ? 'https://...' : '+1...'}
                            className="w-full p-2.5 rounded-xl glass-input text-sm placeholder-slate-600"
                          />
                       </div>
                    )}

                    <div>
                       <label className="text-xs font-medium text-slate-300 mb-1 block">AI Trigger Description</label>
                       <textarea 
                         value={currentAction.description}
                         onChange={(e) => setCurrentAction(prev => ({ ...prev, description: e.target.value }))}
                         placeholder="When user asks to speak to a human..."
                         className="w-full p-2.5 rounded-xl glass-input text-sm h-20 resize-none placeholder-slate-600"
                       />
                    </div>

                    <div>
                       <label className="text-xs font-medium text-slate-300 mb-1 block">
                         Trigger Message <span className="text-slate-500">(optional)</span>
                       </label>
                       <input 
                         type="text" 
                         value={currentAction.triggerMessage || ''}
                         onChange={(e) => setCurrentAction(prev => ({ ...prev, triggerMessage: e.target.value }))}
                         placeholder="e.g., 'Opening the link for you...' or leave empty for default"
                         className="w-full p-2.5 rounded-xl glass-input text-sm placeholder-slate-600"
                       />
                       <p className="text-xs text-slate-500 mt-1">
                         Custom message shown when this action is triggered. Leave empty to use default message.
                       </p>
                    </div>

                    <button 
                       onClick={handleSaveAction}
                       disabled={!currentAction.label || isUploading}
                       className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                       {isUploading ? (
                         <>
                           <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                           Uploading...
                         </>
                       ) : (
                         currentAction.id ? 'Update Action' : 'Add Action'
                       )}
                    </button>
                 </div>
               </div>
            </div>

            <div className="lg:col-span-2">
               <div className="glass-card p-6 rounded-2xl h-full flex flex-col">
                  <h3 className="text-white font-semibold mb-4">Active Actions ({actions.length})</h3>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                     {actions.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-slate-500 border border-dashed border-white/10 rounded-xl">
                           <Zap className="w-8 h-8 mb-2 opacity-50" />
                           <p className="text-sm">No actions defined yet.</p>
                        </div>
                     ) : (
                        actions.map(action => (
                           <div key={action.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center group hover:border-indigo-500/30 transition-all">
                              <div className="flex items-start gap-4">
                                 <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                    {getActionIcon(action.type, action.mediaType)}
                                 </div>
                                 <div>
                                    <h4 className="text-white font-medium text-sm">{action.label}</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">{action.description}</p>
                                    <div className="mt-2 flex gap-2 flex-wrap">
                                       <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-300 uppercase">{action.type}</span>
                                       {action.mediaType && <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300 uppercase">{action.mediaType}</span>}
                                       {action.fileSize && <span className="text-[10px] text-slate-500">{(action.fileSize / 1024 / 1024).toFixed(2)} MB</span>}
                                       {action.type !== 'media' && action.payload && <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{action.payload}</span>}
                                    </div>
                                 </div>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button 
                                    onClick={() => { 
                                      setCurrentAction(action); 
                                      setIsEditingAction(true);
                                      setSelectedFile(null);
                                      setFilePreview(null);
                                    }}
                                    className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                                 >
                                    <Sliders className="w-4 h-4" />
                                 </button>
                                 <button 
                                    onClick={() => handleDeleteAction(action.id)}
                                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
              <Brain className="w-8 h-8 text-indigo-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-medium">Knowledge Injection (RAG-lite)</h3>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Paste your documentation, FAQs, or raw text here. The bot will use this context to ground its answers.
                  For larger datasets, enterprise vector storage is available in the Pro plan.
                </p>
              </div>
            </div>

            <div className="flex-1 min-h-[500px] relative">
               <textarea
                value={knowledge}
                onChange={(e) => setKnowledge(e.target.value)}
                className="w-full h-full p-6 rounded-2xl glass-input placeholder-slate-500 resize-none font-mono text-sm leading-relaxed"
                placeholder="# Company Overview
Aether AI is a..."
              />
              <div className="absolute bottom-4 right-4 text-xs text-slate-500 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                 {knowledge.length} characters
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotBuilder;