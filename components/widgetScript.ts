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
          // Parse department_bots JSON
          let departmentBots = null;
          if (integration.department_bots) {
            try {
              departmentBots = typeof integration.department_bots === 'string' 
                ? JSON.parse(integration.department_bots) 
                : integration.department_bots;
            } catch (e) {
              console.warn('Failed to parse department_bots:', e);
            }
          }

          return {
            botId: integration.bot_id,
            theme: integration.theme || 'dark',
            position: integration.position || 'right',
            brandColor: integration.brand_color || '#6366f1',
            welcomeMessage: integration.welcome_message || null,
            collectLeads: integration.collect_leads || false,
            departmentBots: departmentBots || null
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
                description: action.description || '',
                triggerMessage: action.trigger_message || undefined,
                mediaType: action.media_type || undefined,
                fileSize: action.file_size || undefined
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
      
      // Query bot with bot_actions - using proper PostgREST syntax
      const queryUrl = supabaseUrl + '/rest/v1/bots?id=eq.' + botId + '&select=*,bot_actions(*)';
      console.log('Fetching bot config from URL:', queryUrl);
      const response = await fetch(queryUrl, {
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
                description: action.description || '',
                triggerMessage: action.trigger_message || undefined,
                mediaType: action.media_type || undefined,
                fileSize: action.file_size || undefined
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
    // Ensure brandingText exists (for old format)
    if (!bot.brandingText) {
      bot.brandingText = undefined;
    }
    // Ensure headerImageUrl exists (for old format)
    if (!bot.headerImageUrl) {
      bot.headerImageUrl = undefined;
    }
    // Ensure e-commerce fields exist (for old format)
    if (!bot.ecommerceEnabled) {
      bot.ecommerceEnabled = false;
    }
    if (!bot.ecommerceSettings) {
      bot.ecommerceSettings = undefined;
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
    const departmentBots = integrationConfig.departmentBots || null;
    
    // Store department bots in config for later use
    config.departmentBots = departmentBots;
    
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
          description: action.description || '',
          triggerMessage: action.trigger_message || undefined,
          mediaType: action.media_type || undefined,
          fileSize: action.file_size || undefined
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
      collectLeads: collectLeads, // Use collectLeads from integration config
      brandingText: fetchedBot.branding_text || fetchedBot.brandingText || undefined,
      headerImageUrl: fetchedBot.header_image_url || fetchedBot.headerImageUrl || undefined,
      ecommerceEnabled: fetchedBot.ecommerce_enabled || fetchedBot.ecommerceEnabled || false,
      ecommerceSettings: fetchedBot.ecommerce_settings || fetchedBot.ecommerceSettings || undefined
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
          description: action.description || '',
          triggerMessage: action.trigger_message || undefined,
          mediaType: action.media_type || undefined,
          fileSize: action.file_size || undefined
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
      collectLeads: collectLeads,
      brandingText: fetchedBot.branding_text || fetchedBot.brandingText || undefined,
      headerImageUrl: fetchedBot.header_image_url || fetchedBot.headerImageUrl || undefined,
      ecommerceEnabled: fetchedBot.ecommerce_enabled || fetchedBot.ecommerceEnabled || false,
      ecommerceSettings: fetchedBot.ecommerce_settings || fetchedBot.ecommerceSettings || undefined
    };
    
    console.log('Bot config loaded and merged with UI overrides');
    console.log('Bot actions loaded:', actions.length, 'actions:', actions);
  } else {
    console.error('No bot configuration found. Please provide config.bot, config.botId, or config.integrationId');
    return;
  }

  // Determine branding text - use custom if provided, otherwise default to "Powered by Aether AI"
  const brandingText = bot.brandingText || 'Powered by Aether AI';
  
  // Get header image URL if available
  const headerImageUrl = bot.headerImageUrl || null;

  // Inject HTML
  const container = document.createElement('div');
  container.id = 'aether-widget-container';
  container.setAttribute('data-position', position);
  // Set CSS custom properties for theme colors
  container.style.setProperty('--aether-brand-color', brandColor);
  
  // Determine initial view (Chat or Form)
  const showForm = collectLeads;

  // Build header icon/image section
  let headerIconSection = '';
  if (headerImageUrl) {
    // Use data attribute to avoid string escaping issues, will set style after element creation
    headerIconSection = '<div class="aether-header-image" data-header-image-url style="background-size: cover; background-position: center; width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;"></div>';
  } else {
    headerIconSection = '<div class="aether-header-icon">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>' +
    '</div>';
  }

  const windowHTML = '<div id="aether-window">' +
    '<div class="aether-header">' +
      headerIconSection +
      '<div class="aether-header-content">' +
        '<div class="aether-title">' + (config.name || bot.name || 'Chat Assistant').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</div>' +
        '<div class="aether-subtitle" data-branding-text></div>' +
      '</div>' +
      '<button class="aether-close-window-btn" id="aether-close-window-btn" type="button">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
      '</button>' +
    '</div>' +
    '<div class="aether-content">' +
      (showForm ? '<div id="aether-lead-form">' +
        '<div id="aether-lead-form-step1">' +
          '<div>' +
            '<div class="aether-form-title">Start Conversation</div>' +
            '<div class="aether-form-desc">Please share your details to connect with us.</div>' +
          '</div>' +
          '<div class="aether-form-group" id="aether-email-group">' +
            '<label>Email Address</label>' +
            '<input type="text" class="aether-input" id="aether-email" placeholder="you@company.com" autocomplete="email" />' +
            '<div class="aether-form-error" id="aether-email-error" style="display:none; color: #ef4444; font-size: 12px; margin-top: 4px;"></div>' +
          '</div>' +
          '<div class="aether-form-group" id="aether-phone-group">' +
            '<label>Phone Number</label>' +
            '<input type="tel" class="aether-input" id="aether-phone" placeholder="+1 (555) 000-0000" required />' +
            '<div class="aether-form-error" id="aether-phone-error" style="display:none; color: #ef4444; font-size: 12px; margin-top: 4px;"></div>' +
          '</div>' +
          '<button class="aether-btn" id="aether-next-btn">Next</button>' +
          '<button class="aether-btn" id="aether-start-btn" style="display:none;">Start Chatting</button>' +
        '</div>' +
        '<div id="aether-lead-form-step2" style="display:none;">' +
          '<div>' +
            '<div class="aether-form-title">Select Department</div>' +
            '<div class="aether-form-desc">Choose the department you would like to chat with.</div>' +
          '</div>' +
          '<div class="aether-form-group" id="aether-department-group">' +
            '<label>Select Department</label>' +
            '<div id="aether-department-options" class="aether-department-options"></div>' +
            '<div class="aether-form-error" id="aether-department-error" style="display:none; color: #ef4444; font-size: 12px; margin-top: 4px;"></div>' +
          '</div>' +
          '<button class="aether-btn" id="aether-submit-lead">Start Chatting</button>' +
        '</div>' +
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
  
  // Set branding text safely (avoid string escaping issues)
  const brandingTextEl = container.querySelector('.aether-subtitle[data-branding-text]');
  if (brandingTextEl) {
    brandingTextEl.textContent = brandingText;
  }
  
  // Set header image background if header image URL exists
  if (headerImageUrl) {
    const headerImageEl = container.querySelector('.aether-header-image[data-header-image-url]');
    if (headerImageEl) {
      // Use split/join to avoid regex escaping issues in template strings
      let escapedUrl = String(headerImageUrl);
      // Replace backslashes (using split/join to avoid regex)
      escapedUrl = escapedUrl.split(String.fromCharCode(92)).join(String.fromCharCode(92, 92));
      // Replace double quotes
      escapedUrl = escapedUrl.split('"').join('\\"');
      headerImageEl.style.backgroundImage = 'url("' + escapedUrl + '")';
    }
  }
  
  // Hide step 2 (department selection) if no departments exist
  if (showForm) {
    const departmentBots = config.departmentBots;
    if (!departmentBots || !Array.isArray(departmentBots) || departmentBots.length === 0) {
      // No departments - hide step 2, show start button instead of next
      const formStep2El = container.querySelector('#aether-lead-form-step2');
      const nextBtnEl = container.querySelector('#aether-next-btn');
      const startBtnEl = container.querySelector('#aether-start-btn');
      if (formStep2El) formStep2El.style.display = 'none';
      if (nextBtnEl) nextBtnEl.style.display = 'none';
      if (startBtnEl) startBtnEl.style.display = 'block';
    }
  }
  
  // Create lightbox separately and append directly to body (outside container for full-screen)
  const lightboxContainer = document.createElement('div');
  lightboxContainer.id = 'aether-lightbox';
  lightboxContainer.className = 'aether-lightbox';
  lightboxContainer.style.display = 'none';
  lightboxContainer.innerHTML = 
    '<div class="aether-lightbox-backdrop"></div>' +
    '<div class="aether-lightbox-content">' +
      '<button class="aether-lightbox-close" id="aether-lightbox-close" type="button">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '</button>' +
      '<img id="aether-lightbox-image" src="" alt="Full size image" />' +
    '</div>';
  document.body.appendChild(lightboxContainer);
  
  // Create launcher button separately and append directly to body (outside container)
  const launcherBtn = document.createElement('button');
  launcherBtn.id = 'aether-launcher';
  launcherBtn.innerHTML = '<svg id="aether-launcher-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  // Set position and brand color directly
  launcherBtn.style.position = 'fixed';
  launcherBtn.style.bottom = '24px';
  launcherBtn.style[position] = '24px';
  launcherBtn.style.zIndex = '99999';
  launcherBtn.style.display = 'flex';
  launcherBtn.style.visibility = 'visible';
  launcherBtn.style.opacity = '1';
  // Set brand color on launcher button
  launcherBtn.style.setProperty('--aether-brand-color', brandColor);
  launcherBtn.style.background = 'linear-gradient(135deg, ' + brandColor + ', ' + brandColor + 'dd)';
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
  const nextBtn = document.getElementById('aether-next-btn');
  const startBtn = document.getElementById('aether-start-btn');
  const formStep1 = document.getElementById('aether-lead-form-step1');
  const formStep2 = document.getElementById('aether-lead-form-step2');
  const launcherIcon = document.getElementById('aether-launcher-icon');
  const closeWindowBtn = document.getElementById('aether-close-window-btn');
  const emailGroup = document.getElementById('aether-email-group');
  const departmentGroup = document.getElementById('aether-department-group');
  const phoneGroup = document.getElementById('aether-phone-group');
  const departmentOptions = document.getElementById('aether-department-options');
  
  let isOpen = false;
  let messageHistory = [];
  let isStreaming = false;
  let selectedImage = null;
  let conversationId = null;
  let leadData = { email: null, phone: null };
  let selectedDepartmentBot = null;
  let currentBot = bot; // Track current bot (may change when department is selected)
  
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
  
  // Check for existing session - if found and departments exist, skip to department selection
  if (showForm) {
    const departmentBots = config.departmentBots;
    // Check all possible bot IDs for sessions (default bot + department bots)
    let existingSession = null;
    let sessionBotId = bot.id;
    
    // Try to find session for default bot
    existingSession = loadSession(bot.id);
    
    // If no session for default bot and departments exist, check department bots
    if (!existingSession && departmentBots && Array.isArray(departmentBots) && departmentBots.length > 0) {
      for (let i = 0; i < departmentBots.length; i++) {
        const deptBot = departmentBots[i];
        if (deptBot.botId) {
          const deptSession = loadSession(deptBot.botId);
          if (deptSession) {
            existingSession = deptSession;
            sessionBotId = deptBot.botId;
            break;
          }
        }
      }
    }
    
    // If session exists and has lead data, skip to department selection (only if departments exist)
    if (existingSession && existingSession.leadData && (existingSession.leadData.email || existingSession.leadData.phone)) {
      leadData = existingSession.leadData;
      conversationId = existingSession.conversationId;
      
      // Check if departments exist
      if (departmentBots && Array.isArray(departmentBots) && departmentBots.length > 0) {
        // Hide step 1, show step 2 (department selection)
        const formStep1El = container.querySelector('#aether-lead-form-step1');
        const formStep2El = container.querySelector('#aether-lead-form-step2');
        if (formStep1El) formStep1El.style.display = 'none';
        if (formStep2El) {
          formStep2El.style.display = 'block';
          // Wait a bit for DOM to be ready and function to be defined, then show departments
          setTimeout(function() {
            if (typeof showDepartmentSelection === 'function') {
              showDepartmentSelection();
            }
          }, 300);
        }
      } else {
        // No departments, start chatting directly
        if (leadForm) leadForm.style.display = 'none';
        if (messages) messages.style.display = 'flex';
        if (inputArea) inputArea.style.display = 'block';
      }
    } else {
      // No session - ensure step 2 is hidden if no departments
      if (!departmentBots || !Array.isArray(departmentBots) || departmentBots.length === 0) {
        const formStep2El = container.querySelector('#aether-lead-form-step2');
        if (formStep2El) formStep2El.style.display = 'none';
      }
    }
  }
  
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
  const createConversation = async (email = null, phone = null, botToUse = bot) => {
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
        bot_id: botToUse.id,
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
        saveSession(botToUse.id, conv.id, email || phone ? { email: email || null, phone: phone || null } : null);
        
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
  const findExistingConversation = async (email, phone, botToUse = bot) => {
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
      let queryUrl = supabaseUrl + '/rest/v1/conversations?bot_id=eq.' + botToUse.id + '&user_id=is.null';
      
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
          saveSession(botToUse.id, existingConvId, email || phone ? { email: email || null, phone: phone || null } : null);
          
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
  const saveLeadAndCreateConversation = async (email, phone, botToUse = bot) => {
    if (!email || !phone) return null;
    
    // First, try to find existing conversation
    const existingConvId = await findExistingConversation(email, phone, botToUse);
    if (existingConvId) {
      console.log('Using existing conversation:', existingConvId);
      return existingConvId;
    }
    
    // No existing conversation found, create new one
    console.log('No existing conversation found, creating new one');
    return await createConversation(email, phone, botToUse);
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
  const saveMessage = async (convId, role, text, actionId = null) => {
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
      
      const messageData = {
        conversation_id: convId,
        role: role,
        text: text,
        timestamp: new Date().toISOString(),
      };
      
      // Add action_invoked if actionId is provided
      if (actionId) {
        messageData.action_invoked = actionId;
      }
      
      const response = await fetch(supabaseUrl + '/rest/v1/messages', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(messageData),
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
  
  // Start button handler (when no departments) - validates email/phone and starts chatting
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      const emailEl = document.getElementById('aether-email');
      const phoneEl = document.getElementById('aether-phone');
      if (emailEl && phoneEl) {
        const email = emailEl.value ? emailEl.value.trim() : '';
        const phone = phoneEl.value ? phoneEl.value.trim() : '';
        
        // Clear previous errors
        clearError('aether-email', 'aether-email-error');
        clearError('aether-phone', 'aether-phone-error');
        
        let hasError = false;
        
        // Validate email
        if (!email) {
          showError('aether-email', 'aether-email-error', 'Email is required');
          hasError = true;
        } else if (!validateEmail(email)) {
          showError('aether-email', 'aether-email-error', 'Please enter a valid email address');
          hasError = true;
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
          return;
        }
        
        // Store lead data
        leadData = { email: email, phone: phone };
        
        // No departments, create conversation and start chatting directly
        const convId = await saveLeadAndCreateConversation(email, phone, bot);
        if (convId) {
          conversationId = convId;
          // Show chat interface
          if (leadForm) leadForm.style.display = 'none';
          if (messages) messages.style.display = 'flex';
          if (inputArea) inputArea.style.display = 'block';
          if (input) input.focus();
        } else {
          showError('aether-email', 'aether-email-error', 'Failed to start conversation. Please try again.');
        }
      }
    });
  }

  // Next button handler - validates email/phone and moves to department selection
  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      const emailEl = document.getElementById('aether-email');
      const phoneEl = document.getElementById('aether-phone');
      if (emailEl && phoneEl) {
        const email = emailEl.value ? emailEl.value.trim() : '';
        const phone = phoneEl.value ? phoneEl.value.trim() : '';
        
        // Clear previous errors
        clearError('aether-email', 'aether-email-error');
        clearError('aether-phone', 'aether-phone-error');
        
        let hasError = false;
        
        // Validate email
        if (!email) {
          showError('aether-email', 'aether-email-error', 'Email is required');
          hasError = true;
        } else if (!validateEmail(email)) {
          showError('aether-email', 'aether-email-error', 'Please enter a valid email address');
          hasError = true;
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
          return;
        }
        
        // Store lead data
        leadData = { email: email, phone: phone };
        
        // Check if departments exist
        const departmentBots = config.departmentBots;
        if (departmentBots && Array.isArray(departmentBots) && departmentBots.length > 0) {
          // Show step 2 (department selection)
          if (formStep1) formStep1.style.display = 'none';
          if (formStep2) {
            formStep2.style.display = 'block';
            showDepartmentSelection();
          }
        } else {
          // No departments, create conversation and start chatting directly
          const convId = await saveLeadAndCreateConversation(email, phone, bot);
          if (convId) {
            conversationId = convId;
            // Show chat interface
            if (leadForm) leadForm.style.display = 'none';
            if (messages) messages.style.display = 'flex';
            if (inputArea) inputArea.style.display = 'block';
            if (input) input.focus();
          } else {
            showError('aether-email', 'aether-email-error', 'Failed to start conversation. Please try again.');
          }
        }
      }
    });
  }

  // Submit button handler - starts chatting after department selection (or directly if no departments)
  if (submitLead) {
    submitLead.addEventListener('click', async () => {
      // Check if department is required and selected
      const departmentBots = config.departmentBots;
      if (departmentBots && Array.isArray(departmentBots) && departmentBots.length > 0) {
        if (!selectedDepartmentBot) {
          showError('aether-department', 'aether-department-error', 'Please select a department');
          return;
        }
      }
      
      // Use selected bot if department was chosen, otherwise use default bot
      const botToUse = selectedDepartmentBot ? currentBot : bot;
      const email = leadData.email;
      const phone = leadData.phone;
      
      if (!email || !phone) {
        showError('aether-department', 'aether-department-error', 'Email and phone are required');
        return;
      }
      
      // Save lead and create or find existing conversation
      const convId = await saveLeadAndCreateConversation(email, phone, botToUse);
      if (convId) {
        conversationId = convId;
        // Update bot reference for the rest of the session
        bot = botToUse;
        console.log('Conversation created/found:', convId, 'with bot:', botToUse.name);
      } else {
        console.error('Failed to create/find conversation');
        showError('aether-department', 'aether-department-error', 'Failed to start conversation. Please try again.');
        return;
      }
      
      // Show chat interface
      if (leadForm) leadForm.style.display = 'none';
      if (messages) messages.style.display = 'flex';
      if (inputArea) inputArea.style.display = 'block';
      if (input) input.focus();
    });
  }
  
  // Add real-time validation on input
  const emailInput = document.getElementById('aether-email');
  const phoneInput = document.getElementById('aether-phone');
  
  // Function to show department selection
  const showDepartmentSelection = async () => {
    const departmentBots = config.departmentBots;
    if (!departmentBots || !Array.isArray(departmentBots) || departmentBots.length === 0) {
      return;
    }

    // Show department selection
    if (departmentGroup && departmentOptions) {
      departmentGroup.style.display = 'block';
      departmentOptions.innerHTML = '';
      
      departmentBots.forEach((dept) => {
        if (!dept.botId || !dept.departmentLabel) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aether-department-btn';
        btn.textContent = dept.departmentLabel;
        btn.dataset.botId = dept.botId;
        btn.dataset.departmentName = dept.departmentName || dept.departmentLabel.toLowerCase();
        
        // Theme-aware styling
        const isDark = theme === 'dark';
        const bgColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const textColor = isDark ? 'white' : '#18181b';
        const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
        const selectedBg = isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)';
        const selectedBorder = 'rgba(99,102,241,0.5)';
        
        btn.style.cssText = 'width: 100%; padding: 12px 16px; margin-bottom: 8px; background: ' + bgColor + '; border: 1px solid ' + borderColor + '; border-radius: 8px; color: ' + textColor + '; text-align: left; cursor: pointer; transition: all 0.2s; font-size: 14px; font-weight: 500;';
        btn.addEventListener('mouseenter', () => {
          if (btn.dataset.selected !== 'true') {
            btn.style.background = hoverBg;
            btn.style.borderColor = selectedBorder;
          }
        });
        btn.addEventListener('mouseleave', () => {
          if (btn.dataset.selected !== 'true') {
            btn.style.background = bgColor;
            btn.style.borderColor = borderColor;
          }
        });
        btn.addEventListener('click', async () => {
          // Mark as selected
          const isDark = theme === 'dark';
          const bgColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
          const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
          const selectedBg = isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)';
          const selectedBorder = 'rgba(99,102,241,0.5)';
          
          Array.from(departmentOptions.children).forEach(function(child) {
            child.dataset.selected = 'false';
            child.style.background = bgColor;
            child.style.borderColor = borderColor;
          });
          btn.dataset.selected = 'true';
          btn.style.background = selectedBg;
          btn.style.borderColor = selectedBorder;
          btn.style.boxShadow = '0 0 0 2px rgba(99,102,241,0.1)';
          
          // Store selected department bot
          selectedDepartmentBot = dept;
          
          // Fetch the selected bot config
          const selectedBotConfig = await fetchBotConfig(dept.botId, config.supabaseUrl, config.supabaseAnonKey);
          if (selectedBotConfig) {
            // Map bot_actions to actions
            let actions = [];
            if (selectedBotConfig.actions && Array.isArray(selectedBotConfig.actions)) {
              actions = selectedBotConfig.actions;
            } else if (selectedBotConfig.bot_actions && Array.isArray(selectedBotConfig.bot_actions)) {
              actions = selectedBotConfig.bot_actions.map(function(action) {
                return {
                  id: action.id,
                  type: action.type,
                  label: action.label,
                  payload: action.payload,
                  description: action.description || '',
                  triggerMessage: action.trigger_message || undefined,
                  mediaType: action.media_type || undefined,
                  fileSize: action.file_size || undefined
                };
              });
            }
            
            // Update current bot
            currentBot = {
              id: selectedBotConfig.id || dept.botId,
              name: selectedBotConfig.name || 'Chat Assistant',
              systemInstruction: selectedBotConfig.system_instruction || selectedBotConfig.systemInstruction || 'You are a helpful AI assistant.',
              knowledgeBase: selectedBotConfig.knowledge_base || selectedBotConfig.knowledgeBase || '',
              provider: selectedBotConfig.provider || 'gemini',
              model: selectedBotConfig.model || (selectedBotConfig.provider === 'openai' ? 'gpt-4' : 'gemini-3-flash-preview'),
              temperature: selectedBotConfig.temperature ?? 0.7,
              actions: actions,
              collectLeads: collectLeads,
              brandingText: selectedBotConfig.branding_text || selectedBotConfig.brandingText || undefined,
              headerImageUrl: selectedBotConfig.header_image_url || selectedBotConfig.headerImageUrl || undefined,
              ecommerceEnabled: selectedBotConfig.ecommerce_enabled || selectedBotConfig.ecommerceEnabled || false,
              ecommerceSettings: selectedBotConfig.ecommerce_settings || selectedBotConfig.ecommerceSettings || undefined
            };
            
            console.log('Switched to department bot:', dept.departmentLabel, currentBot);
          }
          
          // Show submit button (phone/email already collected in step 1)
          if (submitLead) submitLead.style.display = 'block';
          clearError('aether-department', 'aether-department-error');
        });
        departmentOptions.appendChild(btn);
      });
    }
  };

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

  // Query products from Supabase
  const queryProducts = async (botId, filters) => {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      console.error('Supabase config missing for product queries');
      return [];
    }

    try {
      let queryUrl = config.supabaseUrl + '/rest/v1/product_catalog?bot_id=eq.' + botId;
      
      // Add filters
      if (filters.category) {
        queryUrl += '&category=eq.' + encodeURIComponent(filters.category);
      }
      if (filters.price_min !== undefined) {
        queryUrl += '&price=gte.' + filters.price_min;
      }
      if (filters.price_max !== undefined) {
        queryUrl += '&price=lte.' + filters.price_max;
      }
      if (filters.keywords && filters.keywords.length > 0) {
        // Use array overlap for keywords
        queryUrl += '&keywords=ov.' + encodeURIComponent('{' + filters.keywords.join(',') + '}');
      }
      queryUrl += '&in_stock=eq.true';
      queryUrl += '&order=name.asc';
      queryUrl += '&limit=' + (filters.max_results || 10);

      const headers = {
        'Content-Type': 'application/json',
        'apikey': config.supabaseAnonKey,
        'Authorization': 'Bearer ' + config.supabaseAnonKey,
      };

      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        throw new Error('Failed to query products: ' + response.status);
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error querying products:', error);
      return [];
    }
  };

  // Render product carousel
  const renderProductCarousel = (products, container) => {
    if (!products || products.length === 0) return;

    const carousel = document.createElement('div');
    carousel.className = 'aether-product-carousel';
    carousel.innerHTML = '<div class="aether-product-carousel-inner">' +
      products.map(function(p) {
        // Format price with currency
        let priceDisplay = '';
        if (p.price) {
          const currency = p.currency || 'USD';
          const priceValue = parseFloat(p.price);
          // Format based on currency (some currencies don't use decimal places)
          if (currency === 'JPY' || currency === 'KRW' || currency === 'VND') {
            priceDisplay = currency + ' ' + Math.round(priceValue).toLocaleString();
          } else {
            priceDisplay = currency + ' ' + priceValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          }
        }
        
        const image = p.image_url ? '<img src="' + p.image_url + '" alt="' + (p.name || 'Product') + '" class="aether-product-image" />' : '<div class="aether-product-image-placeholder"></div>';
        return '<div class="aether-product-card">' +
          '<a href="' + (p.product_url || '#') + '" target="_blank" rel="noopener noreferrer" class="aether-product-link">' +
            image +
            '<div class="aether-product-info">' +
              '<div class="aether-product-name">' + (p.name || 'Product') + '</div>' +
              (priceDisplay ? '<div class="aether-product-price">' + priceDisplay + '</div>' : '') +
            '</div>' +
          '</a>' +
        '</div>';
      }).join('') +
      '</div>';

    container.appendChild(carousel);
  };

  // Handle product recommendation function call
  const handleProductRecommendation = async (args, botMsg, bot) => {
    if (!bot || !bot.id) {
      console.error('Bot ID missing for product recommendation');
      return;
    }

    const products = await queryProducts(bot.id, {
      category: args.category,
      price_min: args.price_min,
      price_max: args.price_max,
      keywords: args.keywords,
      max_results: args.max_results || (bot.ecommerceSettings?.maxProductsToRecommend || 10),
    });

    if (products.length > 0) {
      // Insert carousel after bot message
      const carouselContainer = document.createElement('div');
      carouselContainer.className = 'aether-product-carousel-container';
      renderProductCarousel(products, carouselContainer);
      
      if (botMsg && botMsg.parentNode) {
        botMsg.parentNode.insertBefore(carouselContainer, botMsg.nextSibling);
      } else if (messages) {
        messages.appendChild(carouselContainer);
      }
    }
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
    
    // Create message bubble only if there's text or image content
    // If there's only an actionId with no text/image, skip the bubble and only show action card
    const hasTextOrImage = (text && text.trim()) || imageUrl;
    let msg = null;
    
    if (hasTextOrImage) {
      msg = document.createElement('div');
      msg.className = 'aether-msg ' + type;
      msg.dataset.timestamp = currentMessageDate.getTime().toString();
      
      let content = '';
      if (imageUrl) {
        content += '<img src="' + imageUrl + '" alt="Uploaded image" class="aether-clickable-image" data-image-src="' + imageUrl + '" style="max-width: 100%; border-radius: 12px; margin-bottom: 8px; display: block; cursor: pointer; -webkit-tap-highlight-color: rgba(255,255,255,0.1); touch-action: manipulation;" />';
      }
      if (text && text.trim()) {
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
      
      // Add direct event listeners to images for better mobile support
      const images = msg.querySelectorAll('.aether-clickable-image');
      images.forEach(function(img) {
        const imageSrc = img.getAttribute('data-image-src');
        if (imageSrc) {
          const handleImageOpen = function(e) {
            e.preventDefault();
            e.stopPropagation();
            openLightbox(imageSrc);
          };
          img.addEventListener('click', handleImageOpen);
          img.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openLightbox(imageSrc);
          }, { passive: false });
        }
      });
    }
    
    if (actionId && bot.actions) {
      const action = bot.actions.find(a => a.id === actionId);
      if (action) {
        const actionCard = document.createElement('div');
        actionCard.className = 'aether-action-card';
        
        // Get trigger message to show in action card (replaces "Click below to proceed:")
        const triggerMessage = action.triggerMessage || (action.type === 'handoff' ? 'Transferring you to an agent...' : "I've triggered the requested action for you.");
        
        // Handle media actions differently - display inline or as download
        if (action.type === 'media') {
          const mediaType = action.mediaType || 'image';
          let mediaHTML = '';
          
          if (mediaType === 'image') {
            mediaHTML = '<img src="' + action.payload + '" alt="' + (action.label || 'Media') + '" class="aether-clickable-image" data-image-src="' + action.payload + '" style="max-width: 100%; border-radius: 12px; margin-top: 8px; display: block; cursor: pointer; -webkit-tap-highlight-color: rgba(255,255,255,0.1); touch-action: manipulation;" />';
          } else if (mediaType === 'video') {
            mediaHTML = '<video src="' + action.payload + '" controls style="max-width: 100%; border-radius: 12px; margin-top: 8px; display: block;" />';
          } else if (mediaType === 'audio') {
            mediaHTML = '<audio src="' + action.payload + '" controls style="width: 100%; margin-top: 8px; display: block;" />';
          } else if (mediaType === 'pdf') {
            // PDF as download link
            const pdfIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
            mediaHTML = '<a href="' + action.payload + '" target="_blank" rel="noopener noreferrer" class="aether-action-btn bg-red-600" style="background: var(--aether-brand-color); margin-top: 8px; display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 12px; text-decoration: none; color: white; font-weight: 500; font-size: 14px;">' +
              pdfIcon +
              '<span>' + action.label + '</span>' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: auto; opacity: 0.7;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' +
            '</a>';
          }
          
          actionCard.innerHTML = '<div style="font-size: 13px; color: var(--aether-text-color); opacity: 0.8; margin-bottom: 8px;">' +
            triggerMessage +
            '</div>' +
            mediaHTML;
        } else {
          // Non-media actions - use button
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
            triggerMessage +
            '</div>' +
            '<a href="' + action.payload + '" target="_blank" rel="noopener noreferrer" class="aether-action-btn ' + btnClass + '" style="background: var(--aether-brand-color);">' +
              iconSvg +
              '<span>' + action.label + '</span>' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: auto; opacity: 0.7;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' +
            '</a>';
        }
        // Insert action card - after message if it exists, otherwise append to messages
        if (msg && msg.parentNode) {
          msg.parentNode.insertBefore(actionCard, msg.nextSibling);
        } else if (messages) {
          messages.appendChild(actionCard);
        }
        
        // Add direct event listeners to images in action cards for better mobile support
        const actionImages = actionCard.querySelectorAll('.aether-clickable-image');
        actionImages.forEach(function(img) {
          const imageSrc = img.getAttribute('data-image-src');
          if (imageSrc) {
            const handleImageOpen = function(e) {
              e.preventDefault();
              e.stopPropagation();
              openLightbox(imageSrc);
            };
            img.addEventListener('click', handleImageOpen);
            img.addEventListener('touchend', function(e) {
              e.preventDefault();
              e.stopPropagation();
              openLightbox(imageSrc);
            }, { passive: false });
          }
        });
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
      let productRecommendationCall = null;

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
                } else if (call.name === 'recommend_products') {
                  productRecommendationCall = call.args || {};
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
                  if (part.functionCall) {
                    functionCallFound = true;
                    if (part.functionCall.name === 'trigger_action') {
                      actionId = part.functionCall.args?.action_id || null;
                      // Clean any accumulated text that contains triggeraction patterns
                      fullText = cleanTriggerActionText(fullText);
                      if (fullText) {
                        updateMessage(fullText);
                      }
                    } else if (part.functionCall.name === 'recommend_products') {
                      productRecommendationCall = part.functionCall.args || {};
                      // Clean any accumulated text that contains triggeraction patterns
                      fullText = cleanTriggerActionText(fullText);
                      if (fullText) {
                        updateMessage(fullText);
                      }
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

      // Handle product recommendations
      if (productRecommendationCall) {
        try {
          await handleProductRecommendation(productRecommendationCall, botMsg, bot);
        } catch (error) {
          console.error('Error handling product recommendation:', error);
        }
      }

      // Clean and finalize message text when function call is found
      if (functionCallFound || actionId || productRecommendationCall) {
        fullText = cleanTriggerActionText(fullText);
        
        // For actions, don't show message in bubble - it will be shown in the action card
        // Only show text if there's actual content (not just the trigger)
        if (fullText && fullText.trim()) {
          updateMessage(fullText);
          messageHistory.push({ role: 'model', text: fullText });
          
          // Save bot message if we have a conversation
          if (conversationId) {
            saveMessage(conversationId, 'model', fullText);
          }
        } else {
          // No text content, just the action - remove the empty message bubble
          if (botMsg && botMsg.parentNode) {
            botMsg.parentNode.removeChild(botMsg);
          }
          // The action card will show the trigger message
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
        const action = bot.actions.find(a => a.id === actionId);
        if (action) {
          // Get trigger message to save as message text
          const triggerMessage = action.triggerMessage || (action.type === 'handoff' ? 'Transferring you to an agent...' : "I've triggered the requested action for you.");
          
          // Save action as a message with action_invoked field
          if (conversationId) {
            saveMessage(conversationId, 'model', triggerMessage, actionId);
          }
          
          // Create and display action card
          const actionCard = document.createElement('div');
          actionCard.className = 'aether-action-card';
          
          // Handle media actions differently - display inline or as download
          if (action.type === 'media') {
            const mediaType = action.mediaType || 'image';
            let mediaHTML = '';
            
            if (mediaType === 'image') {
              mediaHTML = '<img src="' + action.payload + '" alt="' + (action.label || 'Media') + '" class="aether-clickable-image" data-image-src="' + action.payload + '" style="max-width: 100%; border-radius: 12px; margin-top: 8px; display: block; cursor: pointer; -webkit-tap-highlight-color: rgba(255,255,255,0.1); touch-action: manipulation;" />';
            } else if (mediaType === 'video') {
              mediaHTML = '<video src="' + action.payload + '" controls style="max-width: 100%; border-radius: 12px; margin-top: 8px; display: block;" />';
            } else if (mediaType === 'audio') {
              mediaHTML = '<audio src="' + action.payload + '" controls style="width: 100%; margin-top: 8px; display: block;" />';
            } else if (mediaType === 'pdf') {
              // PDF as download link
              const pdfIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
              mediaHTML = '<a href="' + action.payload + '" target="_blank" rel="noopener noreferrer" class="aether-action-btn bg-red-600" style="background: var(--aether-brand-color); margin-top: 8px; display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 12px; text-decoration: none; color: white; font-weight: 500; font-size: 14px;">' +
                pdfIcon +
                '<span>' + action.label + '</span>' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: auto; opacity: 0.7;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' +
              '</a>';
            }
            
            actionCard.innerHTML = '<div style="font-size: 13px; color: var(--aether-text-color); opacity: 0.8; margin-bottom: 8px;">' +
              triggerMessage +
              '</div>' +
              mediaHTML;
          } else {
            // Non-media actions - use button
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
              triggerMessage +
              '</div>' +
              '<a href="' + action.payload + '" target="_blank" rel="noopener noreferrer" class="aether-action-btn ' + btnClass + '" style="background: var(--aether-brand-color);">' +
                iconSvg +
                '<span>' + action.label + '</span>' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: auto; opacity: 0.7;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' +
              '</a>';
          }
          // Insert action card - if botMsg was removed, append to messages container
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

  // Lightbox functionality
  const lightbox = document.getElementById('aether-lightbox');
  const lightboxImage = document.getElementById('aether-lightbox-image');
  const lightboxClose = document.getElementById('aether-lightbox-close');
  const lightboxBackdrop = lightbox ? lightbox.querySelector('.aether-lightbox-backdrop') : null;

  const openLightbox = (imageSrc) => {
    if (lightbox && lightboxImage && imageSrc) {
      lightboxImage.src = imageSrc;
      
      // Get viewport dimensions
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      
      // Force full screen positioning - use explicit pixel values for mobile
      lightbox.style.setProperty('display', 'flex', 'important');
      lightbox.style.setProperty('position', 'fixed', 'important');
      lightbox.style.setProperty('top', '0px', 'important');
      lightbox.style.setProperty('left', '0px', 'important');
      lightbox.style.setProperty('right', '0px', 'important');
      lightbox.style.setProperty('bottom', '0px', 'important');
      lightbox.style.setProperty('width', vw + 'px', 'important');
      lightbox.style.setProperty('height', vh + 'px', 'important');
      lightbox.style.setProperty('min-width', vw + 'px', 'important');
      lightbox.style.setProperty('min-height', vh + 'px', 'important');
      lightbox.style.setProperty('max-width', vw + 'px', 'important');
      lightbox.style.setProperty('max-height', vh + 'px', 'important');
      lightbox.style.setProperty('z-index', '999999', 'important');
      lightbox.style.setProperty('margin', '0', 'important');
      lightbox.style.setProperty('padding', '0', 'important');
      
      // Prevent body scroll on mobile
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + scrollY + 'px';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      // Also prevent scrolling on html element
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.position = 'fixed';
      document.documentElement.style.width = '100%';
      document.documentElement.style.height = '100%';
    }
  };

  const closeLightbox = () => {
    if (lightbox) {
      lightbox.style.setProperty('display', 'none', 'important');
      
      // Restore body scroll
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.height = '';
      
      // Restore html scroll
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';
      
      // Restore scroll position
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
  };

  // Add click handlers to all clickable images (delegated event listener)
  // Support both click and touch events for mobile
  if (messages) {
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchTarget = null;
    
    // Track touch start for tap detection
    messages.addEventListener('touchstart', function(e) {
      const img = e.target.closest('.aether-clickable-image');
      if (img && img.dataset.imageSrc) {
        touchStartTime = Date.now();
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchTarget = img;
      } else {
        touchTarget = null;
      }
    }, { passive: true });
    
    // Handle touch end - only if it was a tap (not a scroll)
    messages.addEventListener('touchend', function(e) {
      if (!touchTarget || !touchTarget.dataset.imageSrc) return;
      
      const touchEndTime = Date.now();
      const touchDuration = touchEndTime - touchStartTime;
      const touch = e.changedTouches[0];
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const deltaY = Math.abs(touch.clientY - touchStartY);
      const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Consider it a tap if:
      // - Duration is short (< 300ms)
      // - Movement is small (< 10px)
      if (touchDuration < 300 && delta < 10) {
        e.preventDefault();
        e.stopPropagation();
        openLightbox(touchTarget.dataset.imageSrc);
      }
      
      touchTarget = null;
    }, { passive: false });
    
    // Also handle regular click events (for desktop and mobile fallback)
    messages.addEventListener('click', function(e) {
      const img = e.target.closest('.aether-clickable-image');
      if (img && img.dataset.imageSrc) {
        // Only prevent default if it's actually an image click
        // This allows other elements to work normally
        if (e.target.tagName === 'IMG' || e.target.closest('.aether-clickable-image') === img) {
          e.preventDefault();
          e.stopPropagation();
          openLightbox(img.dataset.imageSrc);
        }
      }
    });
  }

  // Close lightbox handlers - support both click and touch
  if (lightboxClose) {
    const handleClose = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeLightbox();
    };
    lightboxClose.addEventListener('click', handleClose);
    lightboxClose.addEventListener('touchend', handleClose, { passive: false });
  }

  if (lightboxBackdrop) {
    const handleBackdropClose = (e) => {
      // Only close if clicking directly on backdrop, not on content
      if (e.target === lightboxBackdrop) {
        e.preventDefault();
        e.stopPropagation();
        closeLightbox();
      }
    };
    lightboxBackdrop.addEventListener('click', handleBackdropClose);
    lightboxBackdrop.addEventListener('touchend', handleBackdropClose, { passive: false });
  }

  // Close lightbox on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && lightbox.style.display !== 'none') {
      closeLightbox();
    }
  });

  // Ensure lightbox is hidden on initialization
  if (lightbox) {
    lightbox.style.setProperty('display', 'none', 'important');
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
  
  // Check for existing session and load conversation history (only if not in lead form flow or already handled)
  if (!showForm || (leadData && leadData.email && conversationId)) {
    // Only check session if we're not in the lead collection flow, or if we already have lead data and conversation
    const session = loadSession(bot.id);
    if (session && session.conversationId && !conversationId) {
      // Only load if we don't already have a conversationId (from initialization)
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
          if (collectLeads && leadData && leadData.email && leadData.phone) {
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
          var actionId = msg.action_invoked || null;
          
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
          
          // If this is an action message, don't show the text bubble - just the action card
          if (actionId) {
            // Only add the action card, no message bubble
            addMessage('', role, actionId);
          } else {
            // Regular message - show both text and any action
            addMessage(msg.text || '', role, actionId);
          }
          
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
    }
  }
  
  // Start initialization
  initWidget();
})();`;
};


