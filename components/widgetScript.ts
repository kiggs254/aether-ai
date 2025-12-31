/**
 * Generates the JavaScript code for the Aether AI widget
 * This code is loaded externally and initializes the widget
 */
export const generateWidgetJS = (): string => {
  return `(function() {
  const config = window.AetherBotConfig;
  if (!config) {
    console.warn('AetherBotConfig not found');
    return;
  }
  
  // Function to fetch integration configuration from Supabase
  const fetchIntegrationConfig = async (integrationId, supabaseUrl, supabaseAnonKey) => {
    if (!integrationId || !supabaseUrl) {
      console.error('Cannot fetch integration config: missing integrationId or supabaseUrl');
      return null;
    }
    
    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (supabaseAnonKey) {
        headers['apikey'] = supabaseAnonKey;
        headers['Authorization'] = 'Bearer ' + supabaseAnonKey;
      }
      
      const response = await fetch(supabaseUrl + '/rest/v1/integrations?id=eq.' + integrationId + '&select=*', {
        method: 'GET',
        headers: headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const integration = data[0];
          console.log('Fetched integration config for:', integrationId);
          return {
            botId: integration.bot_id,
            theme: integration.theme || 'dark',
            position: integration.position || 'right',
            brandColor: integration.brand_color || '#6366f1',
            welcomeMessage: integration.welcome_message || null,
            collectLeads: integration.collect_leads || false
          };
        } else {
          console.error('Integration not found:', integrationId);
          return null;
        }
      } else {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch integration config';
        
        if (response.status === 404) {
          // Check if it's a table not found error or record not found
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.message && errorData.message.includes('relation') && errorData.message.includes('does not exist')) {
              errorMessage = 'Integrations table not found. Please run the database migration first.';
            } else {
              errorMessage = 'Integration not found. Please check your integration ID.';
            }
          } catch (e) {
            // If error text is not JSON, it might be a table not found error
            if (errorText.includes('does not exist') || errorText.includes('relation')) {
              errorMessage = 'Integrations table not found. Please run the database migration first.';
            } else {
              errorMessage = 'Integration not found. Please check your integration ID.';
            }
          }
        }
        
        console.error('Failed to fetch integration config:', response.status, errorMessage, errorText);
        return null;
      }
    } catch (err) {
      console.error('Error fetching integration config:', err);
      return null;
    }
  };
  
  // Function to fetch bot configuration from Supabase
  const fetchBotConfig = async (botId, supabaseUrl, supabaseAnonKey) => {
    if (!botId || !supabaseUrl) {
      console.error('Cannot fetch bot config: missing botId or supabaseUrl');
      return null;
    }
    
    // Check cache first
    const cacheKey = 'aether_bot_config_' + botId;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        const cacheAge = Date.now() - cachedData.timestamp;
        const cacheExpiry = 5 * 60 * 1000; // 5 minutes
        
        // If cached config doesn't have actions or has empty actions, force refresh
        const hasActions = cachedData.config && cachedData.config.actions && Array.isArray(cachedData.config.actions) && cachedData.config.actions.length > 0;
        const hasBotActions = cachedData.config && cachedData.config.bot_actions && Array.isArray(cachedData.config.bot_actions) && cachedData.config.bot_actions.length > 0;
        
        if (cacheAge < cacheExpiry && (hasActions || hasBotActions)) {
          console.log('Using cached bot config for:', botId);
          // Ensure actions are mapped if we have bot_actions but not actions
          if (hasBotActions && !hasActions) {
            cachedData.config.actions = cachedData.config.bot_actions.map(function(action) {
              return {
                id: action.id,
                type: action.type,
                label: action.label,
                payload: action.payload,
                description: action.description || ''
              };
            });
            // Update cache with mapped actions
            sessionStorage.setItem(cacheKey, JSON.stringify(cachedData));
          }
          return cachedData.config;
        } else if (cacheAge < cacheExpiry && !hasActions && !hasBotActions) {
          // Cache exists but no actions - clear it and fetch fresh
          console.log('Cached config has no actions, clearing cache and fetching fresh');
          sessionStorage.removeItem(cacheKey);
        }
      }
    } catch (e) {
      // Cache read failed, continue to fetch
      console.warn('Cache read failed:', e);
    }
    
    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (supabaseAnonKey) {
        headers['apikey'] = supabaseAnonKey;
        headers['Authorization'] = 'Bearer ' + supabaseAnonKey;
      }
      
      const response = await fetch(supabaseUrl + '/rest/v1/bots?id=eq.' + botId + '&select=*,bot_actions(*)', {
        method: 'GET',
        headers: headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const botConfig = data[0];
          console.log('Fetched bot config for:', botId);
          console.log('Raw bot config response:', botConfig);
          console.log('bot_actions in response:', botConfig.bot_actions);
          
          // Map bot_actions to actions format
          if (botConfig.bot_actions && Array.isArray(botConfig.bot_actions) && botConfig.bot_actions.length > 0) {
            console.log('Mapping', botConfig.bot_actions.length, 'bot_actions to actions');
            botConfig.actions = botConfig.bot_actions.map(function(action) {
              return {
                id: action.id,
                type: action.type,
                label: action.label,
                payload: action.payload,
                description: action.description || ''
              };
            });
            console.log('Mapped actions:', botConfig.actions);
          } else {
            console.warn('No bot_actions found in response. bot_actions value:', botConfig.bot_actions);
            botConfig.actions = [];
          }
          
          // Cache the config
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
              config: botConfig,
              timestamp: Date.now()
            }));
          } catch (e) {
            // Cache write failed, continue
          }
          
          return botConfig;
        } else {
          console.error('Bot not found:', botId);
          return null;
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch bot config:', response.status, errorText);
        console.error('Response headers:', Object.fromEntries(response.headers.entries()));
        try {
          const errorJson = JSON.parse(errorText);
          console.error('Error details:', errorJson);
        } catch (e) {
          // Not JSON, already logged as text
        }
        return null;
      }
    } catch (err) {
      console.error('Error fetching bot config:', err);
      return null;
    }
  };
  
  // Wait for DOM to be ready
  const initWidget = async () => {
    if (!document.body) {
      // If body doesn't exist yet, wait for it
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
        return;
      } else {
        // Fallback: wait a bit and try again
        setTimeout(initWidget, 100);
        return;
      }
    }
    
    // Ensure input area is visible on mobile on initial load
    setTimeout(() => {
      const inputArea = document.getElementById('aether-input-area');
      const messages = document.getElementById('aether-messages');
      if (inputArea && messages && window.innerWidth <= 640) {
        // Force input area to be visible by ensuring proper bottom positioning
        const inputAreaHeight = inputArea.offsetHeight || 70;
        messages.style.paddingBottom = (inputAreaHeight + 40) + 'px';
        
        // Scroll to show input area
        if (messages.scrollHeight > messages.clientHeight) {
          messages.scrollTop = messages.scrollHeight;
        }
      }
    }, 500);
  
  // Determine configuration - support multiple formats:
  // 1. Old format: config.bot (full bot object) - backward compatibility
  // 2. New format: config.integrationId (fetch integration + bot configs)
  // 3. Intermediate format: config.botId (fetch bot config only)
  let bot = null;
  let functionUrl = config.apiUrl || (config.supabaseUrl ? config.supabaseUrl + '/functions/v1/proxy-ai' : '/api/chat');
  let theme = 'dark';
  let position = 'right';
  let brandColor = '#6366f1';
  let welcomeMessage = 'Hello! How can I help you?';
  let collectLeads = false;
  
  if (config.bot) {
    // Old format: full bot object in config (backward compatibility)
    bot = config.bot;
    // Ensure actions array exists (for old format)
    if (!bot.actions) {
      bot.actions = [];
    }
    theme = config.theme || 'dark';
    position = config.position || 'right';
    brandColor = config.brandColor || '#6366f1';
    welcomeMessage = config.welcomeMessage || ('Hello! I am ' + bot.name + '. How can I assist you?');
    collectLeads = config.collectLeads !== undefined ? config.collectLeads : bot.collectLeads;
    console.log('Using bot config from embed code (old format)');
    console.log('Bot actions from config:', bot.actions ? bot.actions.length : 0, 'actions:', bot.actions);
  } else if (config.integrationId) {
    // New format: fetch integration config (UI settings) and bot config (AI settings)
    console.log('Fetching integration config from Supabase for integrationId:', config.integrationId);
    const integrationConfig = await fetchIntegrationConfig(config.integrationId, config.supabaseUrl, config.supabaseAnonKey);
    
    if (!integrationConfig) {
      console.error('Failed to fetch integration config. Widget may not work correctly.');
      const errorMsg = document.createElement('div');
      errorMsg.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #ef4444; color: white; padding: 12px 16px; border-radius: 8px; z-index: 100000; font-size: 14px; max-width: 300px;';
      errorMsg.textContent = 'Failed to load integration configuration. Please check your integration ID.';
      document.body.appendChild(errorMsg);
      setTimeout(() => errorMsg.remove(), 5000);
      return;
    }
    
    // Set UI settings from integration config
    theme = integrationConfig.theme;
    position = integrationConfig.position;
    brandColor = integrationConfig.brandColor;
    welcomeMessage = integrationConfig.welcomeMessage || 'Hello! How can I help you?';
    collectLeads = integrationConfig.collectLeads;
    
    // Fetch bot config using botId from integration
    console.log('Fetching bot config from Supabase for botId:', integrationConfig.botId);
    const fetchedBot = await fetchBotConfig(integrationConfig.botId, config.supabaseUrl, config.supabaseAnonKey);
    
    if (!fetchedBot) {
      console.error('Failed to fetch bot config. Widget may not work correctly.');
      const errorMsg = document.createElement('div');
      errorMsg.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #ef4444; color: white; padding: 12px 16px; border-radius: 8px; z-index: 100000; font-size: 14px; max-width: 300px;';
      errorMsg.textContent = 'Failed to load bot configuration. Please check your bot ID.';
      document.body.appendChild(errorMsg);
      setTimeout(() => errorMsg.remove(), 5000);
      return;
    }
    
    // Build bot object from fetched config
    // Map bot_actions to actions if not already mapped
    let actions = [];
    if (fetchedBot.actions && Array.isArray(fetchedBot.actions)) {
      actions = fetchedBot.actions;
    } else if (fetchedBot.bot_actions && Array.isArray(fetchedBot.bot_actions)) {
      actions = fetchedBot.bot_actions.map(function(action) {
        return {
          id: action.id,
          type: action.type,
          label: action.label,
          payload: action.payload,
          description: action.description || ''
        };
      });
    }
    
    bot = {
      id: fetchedBot.id || integrationConfig.botId,
      name: fetchedBot.name || 'Chat Assistant',
      systemInstruction: fetchedBot.system_instruction || fetchedBot.systemInstruction || 'You are a helpful AI assistant.',
      knowledgeBase: fetchedBot.knowledge_base || fetchedBot.knowledgeBase || '',
      provider: fetchedBot.provider || 'gemini',
      model: fetchedBot.model || (fetchedBot.provider === 'openai' ? 'gpt-4' : 'gemini-3-flash-preview'),
      temperature: fetchedBot.temperature ?? 0.7,
      actions: actions,
      collectLeads: collectLeads // Use collectLeads from integration config
    };
    
    console.log('Integration and bot configs loaded successfully');
    console.log('Bot actions loaded:', actions.length, 'actions:', actions);
  } else if (config.botId) {
    // Intermediate format: fetch bot config from Supabase (UI settings from config)
    console.log('Fetching bot config from Supabase for botId:', config.botId);
    const fetchedBot = await fetchBotConfig(config.botId, config.supabaseUrl, config.supabaseAnonKey);
    
    if (!fetchedBot) {
      console.error('Failed to fetch bot config. Widget may not work correctly.');
      const errorMsg = document.createElement('div');
      errorMsg.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #ef4444; color: white; padding: 12px 16px; border-radius: 8px; z-index: 100000; font-size: 14px; max-width: 300px;';
      errorMsg.textContent = 'Failed to load bot configuration. Please check your bot ID.';
      document.body.appendChild(errorMsg);
      setTimeout(() => errorMsg.remove(), 5000);
      return;
    }
    
    // Merge fetched bot config with UI overrides from snippet
    theme = config.theme || 'dark';
    position = config.position || 'right';
    brandColor = config.brandColor || '#6366f1';
    welcomeMessage = config.welcomeMessage || ('Hello! I am ' + (fetchedBot.name || 'Chat Assistant') + '. How can I assist you?');
    collectLeads = config.collectLeads !== undefined ? config.collectLeads : (fetchedBot.collect_leads || fetchedBot.collectLeads || false);
    
    // Map bot_actions to actions if not already mapped
    let actions = [];
    if (fetchedBot.actions && Array.isArray(fetchedBot.actions)) {
      actions = fetchedBot.actions;
    } else if (fetchedBot.bot_actions && Array.isArray(fetchedBot.bot_actions)) {
      actions = fetchedBot.bot_actions.map(function(action) {
        return {
          id: action.id,
          type: action.type,
          label: action.label,
          payload: action.payload,
          description: action.description || ''
        };
      });
    }
    
    bot = {
      id: fetchedBot.id || config.botId,
      name: fetchedBot.name || 'Chat Assistant',
      systemInstruction: fetchedBot.system_instruction || fetchedBot.systemInstruction || 'You are a helpful AI assistant.',
      knowledgeBase: fetchedBot.knowledge_base || fetchedBot.knowledgeBase || '',
      provider: fetchedBot.provider || 'gemini',
      model: fetchedBot.model || (fetchedBot.provider === 'openai' ? 'gpt-4' : 'gemini-3-flash-preview'),
      temperature: fetchedBot.temperature ?? 0.7,
      actions: actions,
      collectLeads: collectLeads
    };
    
    console.log('Bot config loaded and merged with UI overrides');
    console.log('Bot actions loaded:', actions.length, 'actions:', actions);
  } else {
    console.error('No bot configuration found. Please provide config.bot, config.botId, or config.integrationId');
    return;
  }

  // Determine provider text for "Powered by"
  const providerText = bot.provider === 'openai' ? 'OpenAI' : (bot.provider === 'gemini' ? 'Gemini' : 'AI');

  // Inject HTML
  const container = document.createElement('div');
  container.id = 'aether-widget-container';
  container.setAttribute('data-position', position);
  
  // Determine initial view (Chat or Form)
  const showForm = collectLeads;

  const windowHTML = '<div id="aether-window">' +
    '<div class="aether-header">' +
      '<div class="aether-header-icon">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>' +
      '</div>' +
      '<div class="aether-header-content">' +
        '<div class="aether-title">' + (config.name || bot.name || 'Chat Assistant') + '</div>' +
        '<div class="aether-subtitle">Powered by ' + providerText + '</div>' +
      '</div>' +
      '<button class="aether-close-window-btn" id="aether-close-window-btn" type="button">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
      '</button>' +
    '</div>' +
    '<div class="aether-content">' +
      (showForm ? '<div id="aether-lead-form">' +
        '<div>' +
          '<div class="aether-form-title">Start Conversation</div>' +
          '<div class="aether-form-desc">Please share your details to connect with us.</div>' +
        '</div>' +
        '<div class="aether-form-group">' +
          '<label>Email Address</label>' +
          '<input type="text" class="aether-input" id="aether-email" placeholder="you@company.com" autocomplete="email" />' +
          '<div class="aether-form-error" id="aether-email-error" style="display:none; color: #ef4444; font-size: 12px; margin-top: 4px;"></div>' +
        '</div>' +
        '<div class="aether-form-group">' +
          '<label>Phone Number</label>' +
          '<input type="tel" class="aether-input" id="aether-phone" placeholder="+1 (555) 000-0000" required />' +
          '<div class="aether-form-error" id="aether-phone-error" style="display:none; color: #ef4444; font-size: 12px; margin-top: 4px;"></div>' +
        '</div>' +
        '<button class="aether-btn" id="aether-submit-lead">Start Chatting</button>' +
      '</div>' : '') +
      '<div class="aether-messages" id="aether-messages" style="' + (showForm ? 'display:none' : '') + '">' +
        '<div class="aether-welcome-container" id="aether-welcome-container">' +
          '<div class="aether-sparkle-icon">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' +
          '</div>' +
          '<div class="aether-welcome-message">' + welcomeMessage + '</div>' +
          (config.quickActions && config.quickActions.length > 0 ? '<div class="aether-quick-actions" id="aether-quick-actions">' + config.quickActions.map(function(action) { return '<button class="aether-quick-action-btn" data-message="' + (action.message || action.label) + '">' + action.label + '</button>'; }).join('') + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="aether-input-area" id="aether-input-area" style="' + (showForm ? 'display:none' : '') + '">' +
        '<div id="aether-image-preview-container"></div>' +
        '<div class="aether-input-wrapper">' +
          '<label for="aether-image-input" class="aether-image-btn" id="aether-image-btn" type="button">' +
            '<input type="file" id="aether-image-input" class="aether-image-input" accept="image/*" />' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>' +
          '</label>' +
          '<textarea class="aether-input" id="aether-input" placeholder="Type a message..." rows="1"></textarea>' +
          '<button class="aether-send-btn" id="aether-send-btn" type="button">' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
  container.innerHTML = windowHTML;
  document.body.appendChild(container);
  
  // Create launcher button separately and append directly to body (outside container)
  const launcherBtn = document.createElement('button');
  launcherBtn.id = 'aether-launcher';
  launcherBtn.innerHTML = '<svg id="aether-launcher-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  // Set position directly
  launcherBtn.style.position = 'fixed';
  launcherBtn.style.bottom = '24px';
  launcherBtn.style[position] = '24px';
  launcherBtn.style.zIndex = '99999';
  launcherBtn.style.display = 'flex';
  launcherBtn.style.visibility = 'visible';
  launcherBtn.style.opacity = '1';
  document.body.appendChild(launcherBtn);

  // DOM Elements
  const launcher = document.getElementById('aether-launcher');
  const windowEl = document.getElementById('aether-window');
  const input = document.getElementById('aether-input');
  const sendBtn = document.getElementById('aether-send-btn');
  const imageBtn = document.getElementById('aether-image-btn');
  const imageInput = document.getElementById('aether-image-input');
  const imagePreviewContainer = document.getElementById('aether-image-preview-container');
  const messages = document.getElementById('aether-messages');
  const inputArea = document.getElementById('aether-input-area');
  const leadForm = document.getElementById('aether-lead-form');
  const submitLead = document.getElementById('aether-submit-lead');
  const launcherIcon = document.getElementById('aether-launcher-icon');
  const closeWindowBtn = document.getElementById('aether-close-window-btn');
  
  let isOpen = false;
  let messageHistory = [];
  let isStreaming = false;
  let selectedImage = null;
  let conversationId = null;
  let leadData = { email: null, phone: null };
  
  // Session management functions
  const SESSION_EXPIRY_DAYS = 7;
  
  const saveSession = (botId, convId, leadDataToSave) => {
    try {
      const sessionData = {
        conversationId: convId,
        timestamp: Date.now(),
        leadData: leadDataToSave || null
      };
      localStorage.setItem('aether_widget_session_' + botId, JSON.stringify(sessionData));
      console.log('Session saved for bot:', botId, 'conversation:', convId);
    } catch (err) {
      console.warn('Failed to save session to localStorage:', err);
    }
  };
  
  const loadSession = (botId) => {
    try {
      const sessionKey = 'aether_widget_session_' + botId;
      const sessionStr = localStorage.getItem(sessionKey);
      if (!sessionStr) {
        return null;
      }
      
      const sessionData = JSON.parse(sessionStr);
      
      // Check if session is expired
      if (isSessionExpired(sessionData.timestamp)) {
        console.log('Session expired for bot:', botId);
        clearSession(botId);
        return null;
      }
      
      console.log('Session loaded for bot:', botId, 'conversation:', sessionData.conversationId);
      return sessionData;
    } catch (err) {
      console.warn('Failed to load session from localStorage:', err);
      return null;
    }
  };
  
  const clearSession = (botId) => {
    try {
      localStorage.removeItem('aether_widget_session_' + botId);
      console.log('Session cleared for bot:', botId);
    } catch (err) {
      console.warn('Failed to clear session from localStorage:', err);
    }
  };
  
  const isSessionExpired = (timestamp) => {
    const now = Date.now();
    const expiryTime = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    return (now - timestamp) > expiryTime;
  };
  
  // Ensure input area is visible on mobile on initial load and after window resize
  const ensureInputAreaVisible = () => {
    if (window.innerWidth <= 640 && inputArea && messages) {
      // Use visualViewport if available for accurate height
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const windowHeight = window.innerHeight;
      
      // Calculate actual visible height (accounting for browser UI)
      const actualVisibleHeight = Math.min(viewportHeight, windowHeight);
      
      // Get input area height
      const inputAreaHeight = inputArea.offsetHeight || 80;
      
      // Ensure messages container has enough padding so input area is always visible
      // Add extra space for comfort
      const minPadding = inputAreaHeight + 40;
      const currentPadding = parseInt(window.getComputedStyle(messages).paddingBottom) || 0;
      
      if (currentPadding < minPadding) {
        messages.style.paddingBottom = minPadding + 'px';
      }
      
      // Scroll to bottom to show input area
      setTimeout(() => {
        if (messages && messages.scrollHeight > messages.clientHeight) {
          messages.scrollTop = messages.scrollHeight;
        }
      }, 100);
    }
  };
  
  // Run on initial load
  setTimeout(ensureInputAreaVisible, 300);
  setTimeout(ensureInputAreaVisible, 800);
  
  // Also run on window resize and orientation change
  window.addEventListener('resize', ensureInputAreaVisible);
  window.addEventListener('orientationchange', () => {
    setTimeout(ensureInputAreaVisible, 500);
  });
  
  // Use visualViewport if available
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', ensureInputAreaVisible);
  }
  
  // Helper function to show launcher
  const showLauncher = () => {
    if (launcher) {
      launcher.style.setProperty('display', 'flex', 'important');
      launcher.style.setProperty('visibility', 'visible', 'important');
      launcher.style.setProperty('opacity', '1', 'important');
    }
  };
  
  // Helper function to hide launcher
  const hideLauncher = () => {
    if (launcher) {
      launcher.style.setProperty('display', 'none', 'important');
    }
  };
  
  // Ensure launcher is visible initially
  if (launcher) {
    launcher.style.setProperty('display', 'flex', 'important');
    launcher.style.setProperty('visibility', 'visible', 'important');
    launcher.style.setProperty('opacity', '1', 'important');
    launcher.style.setProperty('position', 'fixed', 'important');
    launcher.style.setProperty('z-index', '99999', 'important');
    launcher.style.setProperty('bottom', '24px', 'important');
    launcher.style.setProperty(position, '24px', 'important');
  }
  
  const closeWindow = () => {
    isOpen = false;
    if (windowEl) windowEl.classList.remove('open');
    // Remove class from body to show launcher via CSS
    document.body.classList.remove('aether-chat-open');
    // Show launcher when chat is closed
    showLauncher();
    document.body.style.overflow = '';
  };
  
  if (closeWindowBtn) {
    closeWindowBtn.addEventListener('click', closeWindow);
  }
  
  // Auto-resize textarea
  const autoResize = () => {
    if (input) {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      
      // Show scrollbar only when content exceeds 4 lines (approximately 84px)
      // Font size: 15px, line-height: 1.4, so 4 lines ≈ 15 * 1.4 * 4 = 84px
      const fourLinesHeight = 84;
      if (input.scrollHeight > fourLinesHeight) {
        input.classList.add('show-scrollbar');
      } else {
        input.classList.remove('show-scrollbar');
      }
    }
  };
  
  if (input) {
    input.addEventListener('input', autoResize);
    // Check on initial load
    autoResize();
  }
  
  // Image upload handling
  const showImagePreview = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    
    selectedImage = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (imagePreviewContainer) {
        imagePreviewContainer.innerHTML = '<div class="aether-image-preview">' +
          '<img src="' + e.target.result + '" alt="Preview" />' +
          '<button type="button" id="aether-remove-image">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          '</button>' +
        '</div>';
        const removeBtn = document.getElementById('aether-remove-image');
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            selectedImage = null;
            if (imagePreviewContainer) imagePreviewContainer.innerHTML = '';
            if (imageInput) imageInput.value = '';
            autoResize();
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };
  
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      showImagePreview(file);
    });
  }
  
  // Mobile keyboard handling - ensures input area stays visible above keyboard (Mobile-First)
  let keyboardTimeout = null;
  let isKeyboardOpen = false;
  
  const handleKeyboard = () => {
    // Always handle on mobile (base), desktop will override if needed
    if (inputArea && messages) {
      // Clear any pending timeout
      if (keyboardTimeout) {
        clearTimeout(keyboardTimeout);
      }
      
      // Use visualViewport API if available (modern mobile browsers)
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        const windowHeight = window.innerHeight;
        const viewportHeight = viewport.height;
        const keyboardHeight = windowHeight - viewportHeight;
        
        // Consider keyboard open if height difference is significant (>150px)
        if (keyboardHeight > 150) {
          isKeyboardOpen = true;
          const inputAreaHeight = inputArea.offsetHeight || 70;
          
          // Position input area at the bottom of the visual viewport
          const bottomOffset = windowHeight - viewportHeight;
          inputArea.style.bottom = bottomOffset + 'px';
          inputArea.style.transition = 'bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
          
          // Adjust messages padding to account for input area and keyboard
          const totalPadding = inputAreaHeight + keyboardHeight + 20;
          messages.style.paddingBottom = totalPadding + 'px';
          
          // Scroll messages to bottom smoothly
          keyboardTimeout = setTimeout(() => {
            if (messages) {
              messages.scrollTo({
                top: messages.scrollHeight,
                behavior: 'smooth'
              });
            }
          }, 150);
        } else {
          // Keyboard is closed or not significant
          if (isKeyboardOpen) {
            isKeyboardOpen = false;
            inputArea.style.bottom = '0px';
            inputArea.style.transition = 'bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
            
            // Reset messages padding
            const inputAreaHeight = inputArea.offsetHeight || 70;
            messages.style.paddingBottom = (inputAreaHeight + 20) + 'px';
          }
        }
      } else {
        // Fallback for browsers without visualViewport support
        // Use window resize as indicator
        const currentHeight = window.innerHeight;
        const initialHeight = window.initialHeight || currentHeight;
        
        if (currentHeight < initialHeight * 0.75) {
          // Likely keyboard is open
          isKeyboardOpen = true;
          const inputAreaHeight = inputArea.offsetHeight || 70;
          const estimatedKeyboardHeight = initialHeight - currentHeight;
          messages.style.paddingBottom = (inputAreaHeight + estimatedKeyboardHeight + 20) + 'px';
        } else {
          // Keyboard likely closed
          if (isKeyboardOpen) {
            isKeyboardOpen = false;
            const inputAreaHeight = inputArea.offsetHeight || 70;
            messages.style.paddingBottom = (inputAreaHeight + 20) + 'px';
          }
        }
      }
    }
  };
  
  // Store initial height for fallback
  if (typeof window.initialHeight === 'undefined') {
    window.initialHeight = window.innerHeight;
  }
  
  // Add event listeners for keyboard (Mobile-First - always active)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleKeyboard);
    window.visualViewport.addEventListener('scroll', handleKeyboard);
  }
  
  // Also listen to window resize as fallback
  window.addEventListener('resize', () => {
    window.initialHeight = window.innerHeight;
    handleKeyboard();
  });
  
  if (input) {
    input.addEventListener('focus', () => {
      // Delay to allow keyboard to appear
      setTimeout(handleKeyboard, 100);
      setTimeout(handleKeyboard, 300);
    });
    
    input.addEventListener('blur', () => {
      if (inputArea && messages) {
        // Reset when keyboard closes
        setTimeout(() => {
          isKeyboardOpen = false;
          if (inputArea) {
            inputArea.style.bottom = '0px';
            inputArea.style.transition = 'bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
          }
          if (messages) {
            const inputAreaHeight = inputArea ? inputArea.offsetHeight || 70 : 70;
            messages.style.paddingBottom = (inputAreaHeight + 20) + 'px';
          }
        }, 150);
      }
    });
  }

  if (launcher) {
    launcher.addEventListener('click', () => {
      // Only open the chat, don't close it (use header close button to close)
      if (!isOpen) {
        isOpen = true;
        if (windowEl) windowEl.classList.add('open');
        // Add class to body to hide launcher via CSS
        document.body.classList.add('aether-chat-open');
        // Hide launcher when chat is open (on all screen sizes)
        hideLauncher();
        
        // Ensure input area is visible when opening on mobile
        if (window.innerWidth <= 640) {
          document.body.style.overflow = 'hidden';
          // Force input area visibility
          setTimeout(() => {
            ensureInputAreaVisible();
            // Scroll to show input area
            if (messages) {
              setTimeout(() => {
                messages.scrollTop = messages.scrollHeight;
              }, 200);
            }
          }, 100);
        }
        
        if(!leadForm && input) {
          setTimeout(() => input.focus(), 300);
        }
      }
    });
  }
  
  window.addEventListener('resize', () => {
    if (window.innerWidth > 640) {
      document.body.style.overflow = '';
      // Show launcher only if chat is closed
      if (!isOpen) {
        showLauncher();
      } else {
        // Keep launcher hidden when chat is open
        hideLauncher();
      }
    } else {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
        hideLauncher();
      } else {
        showLauncher();
      }
    }
  });

  // Function to create a conversation (with or without lead data)
  const createConversation = async (email = null, phone = null) => {
    try {
      // Get Supabase URL from config or functionUrl
      const supabaseUrl = config.supabaseUrl || functionUrl.replace('/functions/v1/proxy-ai', '').replace('/.netlify/functions/chat', '');
      
      if (!supabaseUrl) {
        console.error('Cannot create conversation: supabaseUrl is missing from config');
        return null;
      }
      
      // Create conversation via Supabase REST API
      const headers = {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      };
      
      if (config.supabaseAnonKey) {
        headers['apikey'] = config.supabaseAnonKey;
        headers['Authorization'] = 'Bearer ' + config.supabaseAnonKey;
      } else {
        console.warn('Warning: supabaseAnonKey not found in config, conversation creation may fail');
      }
      
      // Build conversation payload
      const payload = {
        bot_id: bot.id,
        // Note: user_id is NOT set, so it will be null (identifying it as a widget conversation)
      };
      
      // Only add email/phone if provided (for collectLeads=true)
      if (email) payload.user_email = email;
      if (phone) payload.user_phone = phone;
      
      console.log('Creating conversation with payload:', payload);
      
      const response = await fetch(supabaseUrl + '/rest/v1/conversations', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Supabase returns array when using Prefer: return=representation
        const conv = Array.isArray(data) ? data[0] : data;
        console.log('Conversation created successfully:', conv.id);
        
        // Save session
        saveSession(bot.id, conv.id, email || phone ? { email: email || null, phone: phone || null } : null);
        
        return conv.id;
      } else {
        const errorText = await response.text();
        console.error('Failed to create conversation:', response.status, errorText);
        return null;
      }
    } catch (err) {
      console.error('Error creating conversation:', err);
      return null;
    }
  };
  
  // Function to find existing conversation by email or phone
  const findExistingConversation = async (email, phone) => {
    if (!email && !phone) return null;
    
    try {
      const supabaseUrl = config.supabaseUrl || functionUrl.replace('/functions/v1/proxy-ai', '').replace('/.netlify/functions/chat', '');
      
      if (!supabaseUrl) {
        console.error('Cannot find conversation: supabaseUrl is missing from config');
        return null;
      }
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (config.supabaseAnonKey) {
        headers['apikey'] = config.supabaseAnonKey;
        headers['Authorization'] = 'Bearer ' + config.supabaseAnonKey;
      }
      
      // Build query: find conversation with same bot_id and (same email OR same phone)
      // Use Supabase OR filter: or=(user_email.eq.email,user_phone.eq.phone)
      let queryUrl = supabaseUrl + '/rest/v1/conversations?bot_id=eq.' + bot.id + '&user_id=is.null';
      
      // Build OR condition for email or phone match
      const orConditions = [];
      if (email) {
        orConditions.push('user_email.eq.' + encodeURIComponent(email));
      }
      if (phone) {
        orConditions.push('user_phone.eq.' + encodeURIComponent(phone));
      }
      
      if (orConditions.length > 0) {
        queryUrl += '&or=(' + orConditions.join(',') + ')';
      }
      
      queryUrl += '&order=started_at.desc&limit=1';
      
      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const existingConvId = data[0].id;
          console.log('Found existing conversation:', existingConvId);
          
          // Save session for existing conversation
          saveSession(bot.id, existingConvId, email || phone ? { email: email || null, phone: phone || null } : null);
          
          return existingConvId;
        }
      } else {
        const errorText = await response.text();
        console.warn('Failed to search for existing conversation:', response.status, errorText);
      }
    } catch (err) {
      console.warn('Error searching for existing conversation:', err);
    }
    
    return null;
  };
  
  // Function to save lead and create conversation (for collectLeads=true)
  // First checks for existing conversation by email/phone, creates new one if not found
  const saveLeadAndCreateConversation = async (email, phone) => {
    if (!email || !phone) return null;
    
    // First, try to find existing conversation
    const existingConvId = await findExistingConversation(email, phone);
    if (existingConvId) {
      console.log('Using existing conversation:', existingConvId);
      return existingConvId;
    }
    
    // No existing conversation found, create new one
    console.log('No existing conversation found, creating new one');
    return await createConversation(email, phone);
  };
  
  // Function to load conversation history from Supabase
  const loadConversationHistory = async (convId) => {
    if (!convId) return [];
    
    try {
      const supabaseUrl = config.supabaseUrl || functionUrl.replace('/functions/v1/proxy-ai', '').replace('/.netlify/functions/chat', '');
      
      if (!supabaseUrl) {
        console.error('Cannot load conversation history: supabaseUrl is missing from config');
        return [];
      }
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (config.supabaseAnonKey) {
        headers['apikey'] = config.supabaseAnonKey;
        headers['Authorization'] = 'Bearer ' + config.supabaseAnonKey;
      }
      
      const response = await fetch(supabaseUrl + '/rest/v1/messages?conversation_id=eq.' + convId + '&order=timestamp.asc', {
        method: 'GET',
        headers: headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded', data.length, 'messages from conversation:', convId);
        return data || [];
      } else {
        const errorText = await response.text();
        console.error('Failed to load conversation history:', response.status, errorText);
        // If conversation doesn't exist (404), clear the session
        if (response.status === 404) {
          clearSession(bot.id);
        }
        return [];
      }
    } catch (err) {
      console.error('Error loading conversation history:', err);
      return [];
    }
  };
  
  // Function to save message to conversation
  const saveMessage = async (convId, role, text) => {
    if (!convId || !text) {
      console.warn('Cannot save message: missing convId or text', { convId, text: text?.substring(0, 50) });
      return;
    }
    
    try {
      const supabaseUrl = config.supabaseUrl || functionUrl.replace('/functions/v1/proxy-ai', '').replace('/.netlify/functions/chat', '');
      
      if (!supabaseUrl) {
        console.error('Cannot save message: supabaseUrl is missing from config');
        return;
      }
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (config.supabaseAnonKey) {
        headers['apikey'] = config.supabaseAnonKey;
        headers['Authorization'] = 'Bearer ' + config.supabaseAnonKey;
      } else {
        console.warn('Warning: supabaseAnonKey not found in config, message save may fail');
      }
      
      const response = await fetch(supabaseUrl + '/rest/v1/messages', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          conversation_id: convId,
          role: role,
          text: text,
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to save message:', response.status, errorText);
      } else {
        console.log('Message saved successfully:', { convId, role, textLength: text.length });
      }
    } catch (err) {
      console.error('Error saving message:', err);
    }
  };

  // Validation functions
  const validateEmail = (email) => {
    if (!email || typeof email !== 'string') {
      console.log('Email validation: invalid input type', typeof email);
      return false;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
      console.log('Email validation: empty after trim');
      return false;
    }
    // Standard email validation - allows most common email formats
    // Use a simple pattern that checks for basic email structure
    // Pattern: has @, has . after @, no spaces
    // This avoids complex regex escaping issues
    // Use String.fromCharCode for whitespace characters to avoid syntax errors in generated code
    const spaceChar = String.fromCharCode(32);
    const tabChar = String.fromCharCode(9);
    const newlineChar = String.fromCharCode(10);
    if (trimmedEmail.includes(spaceChar) || trimmedEmail.includes(tabChar) || trimmedEmail.includes(newlineChar)) {
      console.log('Email validation: contains whitespace');
      return false;
    }
    const atIndex = trimmedEmail.indexOf('@');
    if (atIndex <= 0 || atIndex >= trimmedEmail.length - 1) {
      console.log('Email validation: invalid @ position');
      return false;
    }
    const localPart = trimmedEmail.substring(0, atIndex);
    const domainPart = trimmedEmail.substring(atIndex + 1);
    if (localPart.length === 0 || domainPart.length === 0) {
      console.log('Email validation: empty local or domain part');
      return false;
    }
    if (!domainPart.includes('.')) {
      console.log('Email validation: domain missing dot');
      return false;
    }
    const lastDotIndex = domainPart.lastIndexOf('.');
    if (lastDotIndex === 0 || lastDotIndex === domainPart.length - 1) {
      console.log('Email validation: invalid dot position in domain');
      return false;
    }
    // All validation checks passed
    const result = true;
    console.log('Email validation check:', { 
      original: email, 
      trimmed: trimmedEmail, 
      length: trimmedEmail.length,
      hasAt: trimmedEmail.includes('@'),
      hasDot: trimmedEmail.includes('.'),
      result: result 
    });
    return result;
  };
  
  const validatePhone = (phone) => {
    // Remove all non-digit characters for validation
    const nonDigitPattern = new RegExp('\\D', 'g');
    const digitsOnly = phone.replace(nonDigitPattern, '');
    // Phone should have at least 10 digits (international format)
    return digitsOnly.length >= 10;
  };
  
  const showError = (fieldId, errorId, message) => {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    console.log('showError called:', { fieldId, errorId, message, fieldFound: !!field, errorFound: !!error });
    if (field) {
      field.style.borderColor = '#ef4444';
      field.classList.add('aether-input-error-border');
    }
    if (error) {
      error.textContent = message;
      error.style.display = 'block';
      error.style.visibility = 'visible';
    } else {
      console.warn('Error element not found:', errorId);
    }
  };
  
  const clearError = (fieldId, errorId) => {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (field) {
      field.style.borderColor = '';
      field.classList.remove('aether-input-error-border');
    }
    if (error) {
      error.textContent = '';
      error.style.display = 'none';
      error.style.visibility = 'hidden';
    }
  };
  
  if (submitLead) {
    submitLead.addEventListener('click', async () => {
      const emailEl = document.getElementById('aether-email');
      const phoneEl = document.getElementById('aether-phone');
      if (emailEl && phoneEl) {
        // Get raw values first
        const emailRaw = emailEl.value;
        const phoneRaw = phoneEl.value;
        console.log('Submit clicked - raw values:', { email: emailRaw, phone: phoneRaw, emailType: typeof emailRaw });
        
        const email = emailRaw ? emailRaw.trim() : '';
        const phone = phoneRaw ? phoneRaw.trim() : '';
        
        console.log('Submit clicked - trimmed values:', { email: email, phone: phone, emailLength: email.length });
        
        // Clear previous errors
        clearError('aether-email', 'aether-email-error');
        clearError('aether-phone', 'aether-phone-error');
        
        let hasError = false;
        
        // Validate email
        if (!email) {
          console.log('Email is empty');
          showError('aether-email', 'aether-email-error', 'Email is required');
          hasError = true;
        } else {
          const isValid = validateEmail(email);
          console.log('Submit validation - Email:', email, 'isValid:', isValid);
          if (!isValid) {
            showError('aether-email', 'aether-email-error', 'Please enter a valid email address');
            hasError = true;
          } else {
            // Make sure error is cleared if valid
            clearError('aether-email', 'aether-email-error');
          }
        }
        
        // Validate phone
        if (!phone) {
          showError('aether-phone', 'aether-phone-error', 'Phone number is required');
          hasError = true;
        } else if (!validatePhone(phone)) {
          showError('aether-phone', 'aether-phone-error', 'Please enter a valid phone number (at least 10 digits)');
          hasError = true;
        }
        
        if (hasError) {
          console.log('Validation failed, preventing submission');
          return;
        }
        
        console.log('Validation passed, proceeding with submission');
        
        // Store lead data
        leadData = { email: email, phone: phone };
        
        // Save lead and create or find existing conversation
        const convId = await saveLeadAndCreateConversation(email, phone);
        if (convId) {
          conversationId = convId;
          leadData = { email: email, phone: phone };
          console.log('Conversation created/found:', convId);
        } else {
          console.error('Failed to create/find conversation');
          showError('aether-email', 'aether-email-error', 'Failed to start conversation. Please try again.');
          return;
        }
        
        // Show chat interface
        if (leadForm) leadForm.style.display = 'none';
        if (messages) messages.style.display = 'flex';
        if (inputArea) inputArea.style.display = 'block';
        if (input) input.focus();
      }
    });
  }
  
  // Add real-time validation on input
  const emailInput = document.getElementById('aether-email');
  const phoneInput = document.getElementById('aether-phone');
  
  if (emailInput) {
    emailInput.addEventListener('blur', () => {
      const email = emailInput.value;
      console.log('Email blur event:', { rawValue: email, type: typeof email });
      const trimmedEmail = email ? email.trim() : '';
      if (trimmedEmail) {
        if (!validateEmail(trimmedEmail)) {
          showError('aether-email', 'aether-email-error', 'Please enter a valid email address');
        } else {
          clearError('aether-email', 'aether-email-error');
        }
      } else {
        clearError('aether-email', 'aether-email-error');
      }
    });
    emailInput.addEventListener('input', () => {
      // Clear error as user types if email becomes valid
      const email = emailInput.value;
      const trimmedEmail = email ? email.trim() : '';
      if (trimmedEmail && validateEmail(trimmedEmail)) {
        clearError('aether-email', 'aether-email-error');
      }
    });
  }
  
  if (phoneInput) {
    phoneInput.addEventListener('blur', () => {
      const phone = phoneInput.value.trim();
      if (phone) {
        if (!validatePhone(phone)) {
          showError('aether-phone', 'aether-phone-error', 'Please enter a valid phone number (at least 10 digits)');
        } else {
          clearError('aether-phone', 'aether-phone-error');
        }
      } else {
        clearError('aether-phone', 'aether-phone-error');
      }
    });
    phoneInput.addEventListener('input', () => {
      // Clear error as user types
      const phone = phoneInput.value.trim();
      if (phone && validatePhone(phone)) {
        clearError('aether-phone', 'aether-phone-error');
      } else if (!phone) {
        clearError('aether-phone', 'aether-phone-error');
      }
    });
  }

  // Hide welcome container when first message is sent
  const hideWelcomeContainer = () => {
    const welcomeContainer = document.getElementById('aether-welcome-container');
    if (welcomeContainer) {
      welcomeContainer.style.display = 'none';
    }
  };
  
  // HTML sanitization helper to prevent XSS
  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  // Markdown parser function
  const parseMarkdown = (text) => {
    if (!text) return '';
    
    let html = text;
    
    // Use String.fromCharCode to avoid template string conflicts with backticks and special chars
    const backtick = String.fromCharCode(96);
    const newlineChar = String.fromCharCode(10);
    const asterisk = String.fromCharCode(42);
    const backslash = String.fromCharCode(92);
    const openBracket = String.fromCharCode(91); // [
    const closeBracket = String.fromCharCode(93); // ]
    const openParen = String.fromCharCode(40); // (
    const closeParen = String.fromCharCode(41); // )
    
    // Code blocks (triple backticks) - must be processed first to avoid processing inside code
    const codeBlocks = [];
    const codeBlockPattern = backtick + backtick + backtick + '(\\w+)?' + newlineChar + '?([\\s\\S]*?)' + backtick + backtick + backtick;
    const codeBlockRegex = new RegExp(codeBlockPattern, 'g');
    html = html.replace(codeBlockRegex, function(match, lang, code) {
      const placeholder = '___CODE_BLOCK_' + codeBlocks.length + '___';
      codeBlocks.push(escapeHtml(code.trim()));
      return placeholder;
    });
    
    // Inline code (single backticks) - process after code blocks
    const inlineCodes = [];
    const inlineCodePattern = backtick + '([^' + backtick + newlineChar + ']+)' + backtick;
    const inlineCodeRegex = new RegExp(inlineCodePattern, 'g');
    html = html.replace(inlineCodeRegex, function(match, code) {
      const placeholder = '___INLINE_CODE_' + inlineCodes.length + '___';
      inlineCodes.push(escapeHtml(code));
      return placeholder;
    });
    
    // Horizontal rules (escape * to match literal asterisks)
    // Use RegExp constructor to avoid escaping issues in template string
    // Escape asterisk with backslash: \* (backslash is defined at top of function)
    const hrPattern = new RegExp('^(' + backslash + asterisk + '{3,}|-{3,})$', 'gm');
    html = html.replace(hrPattern, '<hr class="aether-hr">');
    
    // Headings
    const h6Pattern = new RegExp('^###### (.*)$', 'gm');
    const h5Pattern = new RegExp('^##### (.*)$', 'gm');
    const h4Pattern = new RegExp('^#### (.*)$', 'gm');
    const h3Pattern = new RegExp('^### (.*)$', 'gm');
    const h2Pattern = new RegExp('^## (.*)$', 'gm');
    const h1Pattern = new RegExp('^# (.*)$', 'gm');
    html = html.replace(h6Pattern, '<h6 class="aether-h6">$1</h6>');
    html = html.replace(h5Pattern, '<h5 class="aether-h5">$1</h5>');
    html = html.replace(h4Pattern, '<h4 class="aether-h4">$1</h4>');
    html = html.replace(h3Pattern, '<h3 class="aether-h3">$1</h3>');
    html = html.replace(h2Pattern, '<h2 class="aether-h2">$1</h2>');
    html = html.replace(h1Pattern, '<h1 class="aether-h1">$1</h1>');
    
    // Blockquotes
    const blockquotePattern = new RegExp('^> (.+)$', 'gm');
    html = html.replace(blockquotePattern, '<blockquote class="aether-blockquote">$1</blockquote>');
    
    // Bold: **text** or __text__ (process before italic)
    // Escape asterisks with backslash to match literal asterisks in regex
    const boldStarPattern = new RegExp(backslash + asterisk + backslash + asterisk + '([^' + backslash + asterisk + newlineChar + ']+)' + backslash + asterisk + backslash + asterisk, 'g');
    const boldUnderscorePattern = new RegExp('__([^_' + newlineChar + ']+)__', 'g');
    html = html.replace(boldStarPattern, '<strong>$1</strong>');
    html = html.replace(boldUnderscorePattern, '<strong>$1</strong>');
    
    // Italic: *text* or _text_ (but not if it's part of **text**)
    // Use a simpler approach that doesn't require lookbehind (which may not be supported)
    // First, protect already-processed bold text
    const strongTagPattern = new RegExp('<strong>([^<]+)<\\/strong>', 'g');
    html = html.replace(strongTagPattern, '___BOLD_$1___');
    // Then process italic - match single * or _ that aren't part of ** or __
    // Match *text* where * is not preceded or followed by another *
    // Escape asterisks with backslash to match literal asterisks in regex
    const italicStarPattern = new RegExp('(^|[^' + backslash + asterisk + '])' + backslash + asterisk + '([^' + backslash + asterisk + newlineChar + ']+)' + backslash + asterisk + '([^' + backslash + asterisk + ']|$)', 'g');
    const italicUnderscorePattern = new RegExp('(^|[^_])_([^_' + newlineChar + ']+)_([^_]|$)', 'g');
    html = html.replace(italicStarPattern, '$1<em>$2</em>$3');
    html = html.replace(italicUnderscorePattern, '$1<em>$2</em>$3');
    // Restore bold
    const boldRestorePattern = new RegExp('___BOLD_([^_]+)___', 'g');
    html = html.replace(boldRestorePattern, '<strong>$1</strong>');
    
    // Links: [text](url)
    // Use String.fromCharCode for brackets and parentheses to avoid escaping issues
    const linkPattern = new RegExp(backslash + openBracket + '([^' + backslash + closeBracket + ']+)' + backslash + closeBracket + backslash + openParen + '([^' + closeParen + ']+)' + backslash + closeParen, 'g');
    html = html.replace(linkPattern, function(match, text, url) {
      // Sanitize URL
      if (url.startsWith('javascript:') || url.startsWith('data:')) {
        return text; // Return just the text if URL is dangerous
      }
      return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="aether-link">' + escapeHtml(text) + '</a>';
    });
    
    // Process lists line by line
    const lines = html.split(String.fromCharCode(10));
    const processedLines = [];
    let inList = false;
    let listType = null;
    let listItems = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const orderedPattern = new RegExp('^(\\d+)\\. (.+)$');
      const unorderedPattern = new RegExp('^[-*] (.+)$');
      const orderedMatch = line.match(orderedPattern);
      const unorderedMatch = line.match(unorderedPattern);
      
      if (orderedMatch) {
        if (!inList || listType !== 'ol') {
          if (inList && listItems.length > 0) {
            // Close previous list
            processedLines.push('<' + listType + ' class="aether-' + (listType === 'ol' ? 'ordered' : 'unordered') + '-list">' + listItems.join('') + '</' + listType + '>');
            listItems = [];
          }
          inList = true;
          listType = 'ol';
        }
        listItems.push('<li class="aether-list-item">' + orderedMatch[2] + '</li>');
      } else if (unorderedMatch) {
        if (!inList || listType !== 'ul') {
          if (inList && listItems.length > 0) {
            // Close previous list
            processedLines.push('<' + listType + ' class="aether-' + (listType === 'ol' ? 'ordered' : 'unordered') + '-list">' + listItems.join('') + '</' + listType + '>');
            listItems = [];
          }
          inList = true;
          listType = 'ul';
        }
        listItems.push('<li class="aether-list-item">' + unorderedMatch[1] + '</li>');
      } else {
        if (inList && listItems.length > 0) {
          // Close list
          processedLines.push('<' + listType + ' class="aether-' + (listType === 'ol' ? 'ordered' : 'unordered') + '-list">' + listItems.join('') + '</' + listType + '>');
          listItems = [];
          inList = false;
          listType = null;
        }
        processedLines.push(line);
      }
    }
    
    // Close any remaining list
    if (inList && listItems.length > 0) {
      processedLines.push('<' + listType + ' class="aether-' + (listType === 'ol' ? 'ordered' : 'unordered') + '-list">' + listItems.join('') + '</' + listType + '>');
    }
    
    html = processedLines.join(String.fromCharCode(10));
    
    // Convert newlines to <br> (but not inside code blocks, lists, headings, or blockquotes)
    // Note: newlineChar is already defined at the top of the function
    const newlinePattern = new RegExp(newlineChar, 'g');
    html = html.replace(newlinePattern, function(match, offset, str) {
      const before = str.substring(0, offset);
      const after = str.substring(offset + 1);
      
      // Check if we're inside various block elements
      const codeBlockOpenPattern = new RegExp('<pre><code', 'g');
      const codeBlockClosePattern = new RegExp('<\\/code><\\/pre>', 'g');
      const listOpenPattern = new RegExp('<(ul|ol)', 'g');
      const listClosePattern = new RegExp('<\\/(ul|ol)>', 'g');
      const headingOpenPattern = new RegExp('<h[1-6]');
      const blockquoteOpenPattern = new RegExp('<blockquote');
      
      const codeBlockOpen = (before.match(codeBlockOpenPattern) || []).length;
      const codeBlockClose = (before.match(codeBlockClosePattern) || []).length;
      const listOpen = (before.match(listOpenPattern) || []).length;
      const listClose = (before.match(listClosePattern) || []).length;
      const headingOpen = before.match(headingOpenPattern);
      const blockquoteOpen = before.match(blockquoteOpenPattern);
      
      if (codeBlockOpen > codeBlockClose) return newlineChar; // Inside code block
      if (listOpen > listClose) {
        // Inside list - check if next line starts with </li> or <li>
        const liClosePattern = new RegExp('^<\\/li>');
        const liOpenPattern = new RegExp('^<li');
        const listCloseEndPattern = new RegExp('^<\\/(ul|ol)>');
        if (after.match(liClosePattern) || after.match(liOpenPattern) || after.match(listCloseEndPattern)) {
          return newlineChar;
        }
        return '<br>';
      }
      const headingClosePattern = new RegExp('^<\\/h[1-6]>');
      const blockquoteClosePattern = new RegExp('^<\\/blockquote>');
      if (headingOpen && !after.match(headingClosePattern)) return '<br>';
      if (blockquoteOpen && !after.match(blockquoteClosePattern)) return '<br>';
      
      // Check if previous line ended with a block element
      const blockEndPattern = new RegExp('<\\/(h[1-6]|blockquote|hr|pre)>$');
      if (before.match(blockEndPattern)) return '<br>';
      
      // Default: convert to <br>
      return '<br>';
    });
    
    // Restore code blocks
    codeBlocks.forEach(function(code, index) {
      html = html.replace('___CODE_BLOCK_' + index + '___', '<pre><code class="aether-code-block">' + code + '</code></pre>');
    });
    
    // Restore inline code
    inlineCodes.forEach(function(code, index) {
      html = html.replace('___INLINE_CODE_' + index + '___', '<code class="aether-inline-code">' + code + '</code>');
    });
    
    // Basic HTML sanitization
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const allowedTags = ['strong', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'br'];
    
    const sanitizeNode = (node) => {
      if (node.nodeType === 1) { // Element node
        const tagName = node.tagName.toLowerCase();
        if (!allowedTags.includes(tagName)) {
          // Replace with text content
          const textNode = document.createTextNode(node.textContent);
          if (node.parentNode) {
            node.parentNode.replaceChild(textNode, node);
          }
          return;
        }
        // Remove dangerous attributes except href, class, target, rel
        Array.from(node.attributes).forEach(attr => {
          if (attr.name !== 'href' && attr.name !== 'class' && attr.name !== 'target' && attr.name !== 'rel') {
            node.removeAttribute(attr.name);
          }
        });
        // Sanitize href
        if (node.tagName.toLowerCase() === 'a' && node.href) {
          const href = node.getAttribute('href');
          if (href && (href.startsWith('javascript:') || href.startsWith('data:'))) {
            node.removeAttribute('href');
          }
        }
        // Recursively sanitize children
        Array.from(node.childNodes).forEach(child => sanitizeNode(child));
      }
    };
    
    Array.from(tempDiv.childNodes).forEach(child => sanitizeNode(child));
    html = tempDiv.innerHTML;
    
    return html;
  };

  // Helper function to clean triggeraction patterns from text
  const cleanTriggerActionText = (text) => {
    if (!text || typeof text !== 'string') return text || '';
    // Remove [triggeraction: ...] patterns (case insensitive, with optional whitespace)
    const cleaned = text.replace(/\[triggeraction:\s*[^\]]+\]/gi, '').trim();
    return cleaned;
  };

  const addMessage = (text, type, actionId = null, imageUrl = null) => {
    if (!messages) return;
    
    // Date separator logic
    const lastMessage = messages.lastElementChild;
    let lastMessageDate = null;
    if (lastMessage && lastMessage.dataset.timestamp) {
      lastMessageDate = new Date(parseInt(lastMessage.dataset.timestamp));
    }
    const currentMessageDate = new Date();
    
    if (lastMessageDate) {
      const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() &&
                                    d1.getMonth() === d2.getMonth() &&
                                    d1.getDate() === d2.getDate();
      
      if (!isSameDay(lastMessageDate, currentMessageDate)) {
        const separator = document.createElement('div');
        separator.className = 'aether-date-separator';
        let dateText;
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        
        if (isSameDay(currentMessageDate, today)) {
          dateText = 'Today';
        } else if (isSameDay(currentMessageDate, yesterday)) {
          dateText = 'Yesterday';
        } else {
          dateText = currentMessageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        separator.innerHTML = '<span>' + dateText + '</span>';
        messages.appendChild(separator);
      }
    }
    
    // Hide welcome container when first user message is added
    if (type === 'user') {
      hideWelcomeContainer();
    }
    
    const msg = document.createElement('div');
    msg.className = 'aether-msg ' + type;
    msg.dataset.timestamp = currentMessageDate.getTime().toString();
    
    let content = '';
    if (imageUrl) {
      content += '<img src="' + imageUrl + '" alt="Uploaded image" style="max-width: 100%; border-radius: 12px; margin-bottom: 8px; display: block;" />';
    }
    if (text) {
      // Apply markdown parsing for bot messages, plain text for user messages
      if (type === 'bot') {
        content += parseMarkdown(text);
      } else {
        // User messages: just convert newlines and auto-link URLs
        let processedText = text.split(String.fromCharCode(10)).join('<br>');
        const urlRegex = new RegExp('(https?:\\/\\/[^\\s]+)', 'g');
        processedText = processedText.replace(urlRegex, function(match) {
          return '<a href="' + match + '" target="_blank" rel="noopener" style="color: inherit; text-decoration: underline;">' + match + '</a>';
        });
        content += processedText;
      }
    }
    msg.innerHTML = content;
    messages.appendChild(msg);
    
    if (actionId && bot.actions) {
      const action = bot.actions.find(a => a.id === actionId);
      if (action) {
        const actionCard = document.createElement('div');
        actionCard.className = 'aether-action-card';
        
        let iconSvg = '';
        let btnClass = '';
        if (action.type === 'whatsapp') {
          iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';
          btnClass = 'bg-green-600';
        } else if (action.type === 'phone') {
          iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
          btnClass = 'bg-blue-600';
        } else if (action.type === 'handoff') {
          iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
          btnClass = 'bg-orange-600';
        } else {
          iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
          btnClass = 'bg-indigo-600';
        }
        
        actionCard.innerHTML = '<div style="font-size: 13px; color: var(--aether-text-color); opacity: 0.8; margin-bottom: 8px;">' +
          (action.type === 'handoff' ? 'Transferring you to an agent...' : 'Click below to proceed:') +
          '</div>' +
          '<a href="' + action.payload + '" target="_blank" rel="noopener noreferrer" class="aether-action-btn ' + btnClass + '" style="background: var(--aether-brand-color);">' +
            iconSvg +
            '<span>' + action.label + '</span>' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: auto; opacity: 0.7;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' +
          '</a>';
        // Insert action card right after the message element
        if (msg && msg.parentNode) {
          msg.parentNode.insertBefore(actionCard, msg.nextSibling);
        } else if (messages) {
          messages.appendChild(actionCard);
        }
      }
    }
    
    messages.scrollTop = messages.scrollHeight;
  };

  const addTypingIndicator = () => {
    if (!messages) return null;
    const typing = document.createElement('div');
    typing.className = 'aether-typing-indicator';
    typing.id = 'aether-typing';
    typing.innerHTML = '<div class="aether-typing-dot"></div><div class="aether-typing-dot"></div><div class="aether-typing-dot"></div>';
    typing.style.alignSelf = 'flex-start';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    return typing;
  };

  const removeTypingIndicator = () => {
    const typing = document.getElementById('aether-typing');
    if (typing) typing.remove();
  };

  const sendMessage = async () => {
    if (!input || !sendBtn) return;
    
    const text = input.value.trim();
    if ((!text && !selectedImage) || isStreaming) return;
    
    // Create conversation if we don't have one yet
    // If collectLeads is true, use lead data; otherwise create without lead data
    if (!conversationId) {
      if (leadData.email && leadData.phone) {
        // Has lead data (collectLeads=true)
        conversationId = await saveLeadAndCreateConversation(leadData.email, leadData.phone);
      } else {
        // No lead data (collectLeads=false) - create conversation without email/phone
        conversationId = await createConversation();
      }
    }
    
    // Update session timestamp when sending a message
    if (conversationId) {
      saveSession(bot.id, conversationId, leadData.email || leadData.phone ? leadData : null);
    }
    
    let imageDataUrl = null;
    if (selectedImage) {
      const reader = new FileReader();
      imageDataUrl = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(selectedImage);
      });
    }
    
    input.value = '';
    const userMessage = text || '[Image]';
    addMessage(userMessage, 'user', null, imageDataUrl);
    messageHistory.push({ role: 'user', text: userMessage });
    
    // Save user message if we have a conversation
    if (conversationId) {
      saveMessage(conversationId, 'user', userMessage);
    }
    
    selectedImage = null;
    if (imagePreviewContainer) imagePreviewContainer.innerHTML = '';
    if (imageInput) imageInput.value = '';
    autoResize();
    
    const typing = addTypingIndicator();
    isStreaming = true;
    sendBtn.disabled = true;

    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Only send apikey header when calling Supabase directly (not through Netlify)
      // Netlify function handles authentication server-side
      if (functionUrl.includes('netlify')) {
        // Don't send apikey when using Netlify proxy
      } else if (config.supabaseAnonKey) {
        // Supabase edge functions require apikey header for routing
        headers['apikey'] = config.supabaseAnonKey;
      } else if (functionUrl.includes('supabase.co')) {
        console.error('Widget error: Supabase anon key required for direct Supabase calls. Please add supabaseAnonKey to AetherBotConfig or use Netlify proxy.');
      }
      
      // Log bot configuration being sent (for debugging)
      console.log('Sending bot config to API:', {
        id: bot.id,
        name: bot.name,
        provider: bot.provider,
        model: bot.model,
        actionsCount: bot.actions ? bot.actions.length : 0,
        actions: bot.actions
      });
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          action: 'chat-stream',
          bot: bot,
          history: messageHistory.slice(-10),
          message: text || (imageDataUrl ? 'User sent an image' : ''),
          image: imageDataUrl,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
      }

      removeTypingIndicator();
      if (!messages) return;
      
      const botMsg = document.createElement('div');
      botMsg.className = 'aether-msg bot';
      botMsg.id = 'aether-current-msg';
      messages.appendChild(botMsg);
      
      let fullText = '';
      let functionCallFound = false;
      let actionId = null;

      const updateMessage = (text) => {
        if (botMsg) {
          // Apply markdown parsing for bot messages
          const processedText = parseMarkdown(text);
          botMsg.innerHTML = processedText;
          if (messages) messages.scrollTop = messages.scrollHeight;
        }
      };

      // Read the stream (works for both streaming and buffered responses)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(String.fromCharCode(10));
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') break;
              
              const data = JSON.parse(jsonStr);
              
              if (data.text) {
                fullText += data.text;
                // Clean triggeraction patterns from text as it accumulates
                const cleanedText = cleanTriggerActionText(fullText);
                updateMessage(cleanedText || fullText);
              }
              
              if (data.functionCalls && data.functionCalls.length > 0) {
                functionCallFound = true;
                const call = data.functionCalls[0];
                if (call.name === 'trigger_action') {
                  actionId = call.args?.action_id || null;
                  // Clean any accumulated text that contains triggeraction patterns
                  fullText = cleanTriggerActionText(fullText);
                  if (fullText) {
                    updateMessage(fullText);
                  }
                }
              }
              
              if (data.candidates && data.candidates[0]?.content?.parts) {
                const parts = data.candidates[0].content.parts;
                for (const part of parts) {
                  if (part.text) {
                    fullText += part.text;
                    // Clean triggeraction patterns from text as it accumulates
                    const cleanedText = cleanTriggerActionText(fullText);
                    updateMessage(cleanedText || fullText);
                  }
                  if (part.functionCall && part.functionCall.name === 'trigger_action') {
                    functionCallFound = true;
                    actionId = part.functionCall.args?.action_id || null;
                    // Clean any accumulated text that contains triggeraction patterns
                    fullText = cleanTriggerActionText(fullText);
                    if (fullText) {
                      updateMessage(fullText);
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', e, 'Line:', line);
            }
          }
        }
      }
      
      // Process any remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split(String.fromCharCode(10));
        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') break;
              const data = JSON.parse(jsonStr);
              if (data.text) {
                fullText += data.text;
                // Clean triggeraction patterns from text
                const cleanedText = cleanTriggerActionText(fullText);
                updateMessage(cleanedText || fullText);
              }
            } catch (e) {
              console.warn('Failed to parse remaining buffer:', e);
            }
          }
        }
      }

      // Clean and finalize message text when function call is found
      if (functionCallFound || actionId) {
        fullText = cleanTriggerActionText(fullText);
        const finalText = fullText || "I've triggered the requested action for you.";
        updateMessage(finalText);
        messageHistory.push({ role: 'model', text: finalText });
        
        // Save bot message if we have a conversation
        if (conversationId) {
          saveMessage(conversationId, 'model', finalText);
        }
      } else if (fullText) {
        // No function call, just clean and save the text
        fullText = cleanTriggerActionText(fullText);
        updateMessage(fullText);
        messageHistory.push({ role: 'model', text: fullText });
        
        // Save bot message if we have a conversation
        if (conversationId) {
          saveMessage(conversationId, 'model', fullText);
        }
      }
      
      if (actionId) {
        const actionCard = document.createElement('div');
        actionCard.className = 'aether-action-card';
        const action = bot.actions.find(a => a.id === actionId);
        if (action) {
          let iconSvg = '';
          let btnClass = '';
          if (action.type === 'whatsapp') {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';
            btnClass = 'bg-green-600';
          } else if (action.type === 'phone') {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
            btnClass = 'bg-blue-600';
          } else if (action.type === 'handoff') {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
            btnClass = 'bg-orange-600';
          } else {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
            btnClass = 'bg-indigo-600';
          }
          
          actionCard.innerHTML = '<div style="font-size: 13px; color: var(--aether-text-color); opacity: 0.8; margin-bottom: 8px;">' +
            (action.type === 'handoff' ? 'Transferring you to an agent...' : 'Click below to proceed:') +
            '</div>' +
            '<a href="' + action.payload + '" target="_blank" rel="noopener noreferrer" class="aether-action-btn ' + btnClass + '" style="background: var(--aether-brand-color);">' +
              iconSvg +
              '<span>' + action.label + '</span>' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: auto; opacity: 0.7;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' +
            '</a>';
          // Insert action card right after the message bubble
          if (botMsg && botMsg.parentNode) {
            botMsg.parentNode.insertBefore(actionCard, botMsg.nextSibling);
          } else if (messages) {
            messages.appendChild(actionCard);
          }
        }
      }
      
      if (messages) messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      removeTypingIndicator();
      addMessage("Sorry, I'm having trouble connecting right now. Please try again later.", 'bot');
      console.error('Widget error:', err);
    } finally {
      isStreaming = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  // Quick action button handlers
  const quickActionButtons = document.querySelectorAll('.aether-quick-action-btn');
  quickActionButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      const message = this.getAttribute('data-message');
      if (message && input) {
        input.value = message;
        sendMessage();
      }
    });
  });
  
  // Check for existing session and load conversation history
  const session = loadSession(bot.id);
  if (session && session.conversationId) {
    console.log('Found existing session, loading conversation:', session.conversationId);
    conversationId = session.conversationId;
    
    // Restore lead data if present
    if (session.leadData) {
      leadData = session.leadData;
    }
    
    // Load conversation history asynchronously
    loadConversationHistory(session.conversationId).then(function(historyMessages) {
      if (historyMessages && historyMessages.length > 0) {
        // Hide welcome container
        hideWelcomeContainer();
        
        // If collectLeads is true and we have lead data, skip form and show chat
        if (collectLeads && leadData.email && leadData.phone) {
          if (leadForm) leadForm.style.display = 'none';
          if (messages) messages.style.display = 'flex';
          if (inputArea) inputArea.style.display = 'block';
        }
        
        // Display messages and restore messageHistory
        messageHistory = [];
        let lastMessageDate = null;
        
        for (var i = 0; i < historyMessages.length; i++) {
          var msg = historyMessages[i];
          var msgDate = new Date(msg.timestamp);
          
          // Add date separator if needed
          if (lastMessageDate) {
            var isSameDay = function(d1, d2) {
              return d1.getFullYear() === d2.getFullYear() &&
                     d1.getMonth() === d2.getMonth() &&
                     d1.getDate() === d2.getDate();
            };
            
            if (!isSameDay(lastMessageDate, msgDate)) {
              var separator = document.createElement('div');
              separator.className = 'aether-date-separator';
              var dateText;
              var today = new Date();
              var yesterday = new Date(today);
              yesterday.setDate(today.getDate() - 1);
              
              if (isSameDay(msgDate, today)) {
                dateText = 'Today';
              } else if (isSameDay(msgDate, yesterday)) {
                dateText = 'Yesterday';
              } else {
                dateText = msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              }
              separator.innerHTML = '<span>' + dateText + '</span>';
              if (messages) messages.appendChild(separator);
            }
          }
          
          // Add message to UI
          var role = msg.role === 'user' ? 'user' : 'bot';
          addMessage(msg.text || '', role);
          
          // Add to messageHistory for context
          messageHistory.push({ role: msg.role, text: msg.text || '' });
          
          lastMessageDate = msgDate;
        }
        
        // Scroll to bottom
        if (messages) {
          setTimeout(function() {
            messages.scrollTop = messages.scrollHeight;
          }, 100);
        }
        
        console.log('Conversation history loaded:', historyMessages.length, 'messages');
      } else {
        console.log('No messages found in conversation, starting fresh');
      }
    }).catch(function(err) {
      console.error('Error loading conversation history:', err);
      // Clear invalid session if conversation fails to load
      clearSession(bot.id);
      conversationId = null;
    });
  } else {
    console.log('No existing session found, starting fresh');
  }
  };
  
  // Start initialization
  initWidget();
})();`;
};


