import { supabase } from '../lib/supabase';
import { Bot, BotAction, Conversation, ChatMessage, Integration } from '../types';

// Bot operations
export const botService = {
  // Get all bots for the current user
  async getAllBots(): Promise<Bot[]> {
    const { data, error } = await supabase
      .from('bots')
      .select(`
        *,
        bot_actions (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bots:', error);
      throw error;
    }

    return (data || []).map((bot: any) => ({
      id: bot.id,
      name: bot.name,
      description: bot.description || '',
      website: bot.website || '',
      systemInstruction: bot.system_instruction,
      knowledgeBase: bot.knowledge_base || '',
      createdAt: new Date(bot.created_at).getTime(),
      avatarColor: bot.avatar_color || 'from-blue-500 to-cyan-500',
      totalInteractions: bot.total_interactions || 0,
      temperature: parseFloat(bot.temperature) || 0.7,
      model: bot.model || 'gemini-3-flash-preview',
      provider: (bot.provider || 'gemini') as 'gemini' | 'openai',
      status: bot.status || 'active',
      collectLeads: bot.collect_leads || false,
      actions: (bot.bot_actions || []).map((action: any) => ({
        id: action.id,
        type: action.type,
        label: action.label,
        payload: action.payload,
        description: action.description || '',
      })),
      userId: bot.user_id,
    }));
  },

  // Get a single bot by ID
  async getBotById(id: string): Promise<Bot | null> {
    const { data, error } = await supabase
      .from('bots')
      .select(`
        *,
        bot_actions (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching bot:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      website: data.website || '',
      systemInstruction: data.system_instruction,
      knowledgeBase: data.knowledge_base || '',
      createdAt: new Date(data.created_at).getTime(),
      avatarColor: data.avatar_color || 'from-blue-500 to-cyan-500',
      totalInteractions: data.total_interactions || 0,
      temperature: parseFloat(data.temperature) || 0.7,
      model: data.model || 'gemini-3-flash-preview',
      provider: (data.provider || 'gemini') as 'gemini' | 'openai',
      status: data.status || 'active',
      collectLeads: data.collect_leads || false,
      actions: (data.bot_actions || []).map((action: any) => ({
        id: action.id,
        type: action.type,
        label: action.label,
        payload: action.payload,
        description: action.description || '',
      })),
      userId: data.user_id,
    };
  },

  // Create or update a bot
  async saveBot(bot: Bot): Promise<Bot> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const botData = {
      user_id: user.id,
      name: bot.name,
      description: bot.description,
      website: bot.website,
      system_instruction: bot.systemInstruction,
      knowledge_base: bot.knowledgeBase,
      avatar_color: bot.avatarColor,
      temperature: bot.temperature,
      model: bot.model,
      provider: bot.provider || 'gemini',
      status: bot.status,
      collect_leads: bot.collectLeads || false,
    };

    let savedBot;
    // Check if bot ID is a valid UUID (not a temp ID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bot.id || '');
    
    if (!bot.id || bot.id.startsWith('temp-') || !isUUID) {
      // New bot - create
      const { data, error } = await supabase
        .from('bots')
        .insert(botData)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create bot');
      savedBot = data;
    } else {
      // Update existing bot - first check if it exists
      const { data: existingBot } = await supabase
        .from('bots')
        .select('id')
        .eq('id', bot.id)
        .eq('user_id', user.id)
        .single();

      if (!existingBot) {
        // Bot doesn't exist, create new one
        const { data, error } = await supabase
          .from('bots')
          .insert(botData)
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error('Failed to create bot');
        savedBot = data;
      } else {
        // Update existing bot
        const { data, error } = await supabase
          .from('bots')
          .update(botData)
          .eq('id', bot.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error('Bot not found or update failed');
        savedBot = data;
      }
    }

    // Save actions
    if (bot.actions) {
      // Delete existing actions
      await supabase
        .from('bot_actions')
        .delete()
        .eq('bot_id', savedBot.id);

      // Insert new actions
      if (bot.actions.length > 0) {
        const actionsToInsert = bot.actions.map(action => ({
          bot_id: savedBot.id,
          type: action.type,
          label: action.label,
          payload: action.payload,
          description: action.description,
        }));

        await supabase
          .from('bot_actions')
          .insert(actionsToInsert);
      }
    }

    // Fetch the complete bot with actions
    return this.getBotById(savedBot.id) as Promise<Bot>;
  },

  // Delete a bot (archives all related conversations instead of deleting them)
  // Messages are preserved because conversations are archived, not deleted
  async deleteBot(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Archive all conversations for this bot (instead of deleting)
    // This preserves all messages in the database
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('bot_id', id)
      .is('archived_at', null); // Only archive conversations that aren't already archived

    if (conversations && conversations.length > 0) {
      // Archive conversations by setting archived_at and archived_bot_id
      // bot_id will be set to NULL when bot is deleted (due to ON DELETE SET NULL)
      // but archived_bot_id preserves the original bot_id
      await supabase
        .from('conversations')
        .update({
          archived_at: new Date().toISOString(),
          archived_bot_id: id,
        })
        .eq('bot_id', id)
        .is('archived_at', null);
    }

    // Delete all bot actions
    await supabase
      .from('bot_actions')
      .delete()
      .eq('bot_id', id);

    // Finally, delete the bot itself
    // Due to ON DELETE SET NULL, bot_id in conversations will be set to NULL
    // but archived_bot_id preserves the original bot_id and messages remain intact
    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Ensure user owns the bot

    if (error) throw error;
  },
};

// Conversation operations
export const conversationService = {
  // Get all conversations for a bot
  async getConversationsByBotId(botId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages (*)
      `)
      .eq('bot_id', botId)
      .order('started_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }

    return (data || []).map((conv: any) => {
      const messages = (conv.messages || [])
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((msg: any) => ({
          role: msg.role,
          text: msg.text,
          timestamp: new Date(msg.timestamp).getTime(),
          actionInvoked: msg.action_invoked,
        }));
      
      return {
        id: conv.id,
        botId: conv.bot_id,
        userEmail: conv.user_email,
        userPhone: conv.user_phone,
        startedAt: new Date(conv.started_at).getTime(),
        // Calculate message count from actual messages array, fallback to database field
        messageCount: messages.length || conv.message_count || 0,
        status: conv.status || 'active',
        messages: messages,
      };
    });
  },

  // Get all conversations for the current user
  // Only returns widget conversations (user_id is null) - playground conversations are excluded
  async getAllConversations(includeArchived: boolean = false): Promise<Conversation[]> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No user authenticated, cannot fetch conversations');
      return [];
    }
    
    // Get all bots owned by the user to filter conversations
    const { data: userBots } = await supabase
      .from('bots')
      .select('id')
      .eq('user_id', user.id);
    
    const botIds = userBots?.map(b => b.id) || [];
    
    if (botIds.length === 0) {
      console.log('No bots found for user, returning empty conversations');
      return [];
    }
    
    // Fetch ALL conversations for user's bots first to debug
    const { data: allConvs, error: allError } = await supabase
      .from('conversations')
      .select('id, bot_id, user_id, user_email, user_phone, started_at')
      .in('bot_id', botIds);
    
    if (allError) {
      console.error('Error fetching all conversations:', allError);
    } else {
      console.log(`Total conversations for user's bots: ${allConvs?.length || 0}`);
      const playgroundCount = allConvs?.filter(c => c.user_id === user.id).length || 0;
      const widgetCount = allConvs?.filter(c => !c.user_id || c.user_id === null).length || 0;
      console.log(`  - Playground (user_id = ${user.id}): ${playgroundCount}`);
      console.log(`  - Widget (user_id = null): ${widgetCount}`);
      console.log(`  - Other: ${(allConvs?.length || 0) - playgroundCount - widgetCount}`);
    }
    
    // Build query for widget conversations
    // Include conversations where:
    // 1. bot_id is in user's bots (active bots), OR
    // 2. bot_id is NULL but archived_bot_id is in user's bots (archived conversations from deleted bots)
    // We need to fetch both sets and combine them
    
    const queries: Promise<any>[] = [];
    
    // Query 1: Conversations with active bots (bot_id in user's bots)
    let activeQuery = supabase
      .from('conversations')
      .select(`
        *,
        messages (*),
        bots (id, name)
      `)
      .in('bot_id', botIds)
      .is('user_id', null);
    
    if (!includeArchived) {
      activeQuery = activeQuery.is('archived_at', null);
    }
    
    queries.push(activeQuery.order('started_at', { ascending: false }).limit(100));
    
    // Query 2: Conversations from deleted bots (bot_id is NULL, archived_bot_id in user's bots)
    let archivedQuery = supabase
      .from('conversations')
      .select(`
        *,
        messages (*)
      `)
      .is('bot_id', null)
      .in('archived_bot_id', botIds)
      .is('user_id', null);
    
    if (!includeArchived) {
      archivedQuery = archivedQuery.is('archived_at', null);
    }
    
    queries.push(archivedQuery.order('started_at', { ascending: false }).limit(100));
    
    // Execute both queries
    const results = await Promise.all(queries);
    
    // Combine results and handle errors
    let allData: any[] = [];
    for (const result of results) {
      if (result.error) {
        console.error('Error fetching conversations:', result.error);
        continue;
      }
      if (result.data) {
        allData = allData.concat(result.data);
      }
    }
    
    // Remove duplicates (in case a conversation somehow matches both queries)
    const uniqueData = allData.filter((conv, index, self) => 
      index === self.findIndex(c => c.id === conv.id)
    );
    
    // Debug: Log archived conversations
    const archivedCount = uniqueData.filter(c => c.archived_at).length;
    const activeCount = uniqueData.filter(c => !c.archived_at).length;
    const withBotId = uniqueData.filter(c => c.bot_id).length;
    const withNullBotId = uniqueData.filter(c => !c.bot_id && c.archived_bot_id).length;
    console.log(`getAllConversations: Found ${uniqueData.length} total conversations (${activeCount} active, ${archivedCount} archived), includeArchived=${includeArchived}`);
    console.log(`  - Conversations with bot_id: ${withBotId}`);
    console.log(`  - Conversations with NULL bot_id (from deleted bots): ${withNullBotId}`);
    if (archivedCount > 0) {
      const archivedWithBotId = uniqueData.filter(c => c.archived_at && c.bot_id).length;
      const archivedWithNullBotId = uniqueData.filter(c => c.archived_at && !c.bot_id && c.archived_bot_id).length;
      console.log(`  - Archived with bot_id (manually archived): ${archivedWithBotId}`);
      console.log(`  - Archived with NULL bot_id (from deleted bot): ${archivedWithNullBotId}`);
    }
    
    // Sort by started_at descending
    uniqueData.sort((a, b) => {
      const dateA = new Date(a.started_at || a.created_at).getTime();
      const dateB = new Date(b.started_at || b.created_at).getTime();
      return dateB - dateA;
    });
    
    const data = uniqueData.slice(0, 100); // Limit to 100 total

    // Additional client-side filter to exclude old playground conversations
    // Strategy: Old playground conversations were created before we stopped saving them
    // We'll exclude conversations with user_id = null AND no user_email/user_phone AND created before a cutoff date
    // Cutoff: Conversations created before today (or before we made the change)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const cutoffDate = today.getTime(); // Only show conversations created today or later
    
    const filtered = (data || []).filter((conv: any) => {
      // Exclude if user_id is set (playground conversations)
      if (conv.user_id) {
        console.warn('Filtered out conversation with user_id:', conv.id, 'user_id:', conv.user_id);
        return false;
      }
      
      // For conversations with user_id = null:
      // - If they have user_email OR user_phone → Widget conversation (include)
      // - If they have no user_email AND no user_phone → Could be old playground OR new widget
      //   - If created before today → Old playground (exclude)
      //   - If created today or later → New widget (include)
      const convDate = new Date(conv.started_at || conv.created_at);
      const isOld = convDate.getTime() < cutoffDate;
      
      if (!conv.user_email && !conv.user_phone && isOld) {
        console.warn('Filtered out old playground conversation (no user_email/user_phone, created before today):', conv.id, 'created:', convDate);
        return false;
      }
      
      // Include: has user_email/user_phone OR created today/later
      return true;
    });

    const filteredArchivedCount = filtered.filter(c => c.archived_at).length;
    const filteredActiveCount = filtered.filter(c => !c.archived_at).length;
    console.log(`Loaded ${filtered.length} widget conversations (filtered from ${data?.length || 0} total, excluded ${(data?.length || 0) - filtered.length} playground conversations)`);
    console.log(`  - After filtering: ${filteredActiveCount} active, ${filteredArchivedCount} archived`);

    return filtered.map((conv: any) => {
      const messages = (conv.messages || [])
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((msg: any) => ({
          role: msg.role,
          text: msg.text,
          timestamp: new Date(msg.timestamp).getTime(),
          actionInvoked: msg.action_invoked,
        }));
      
      return {
        id: conv.id,
        // Use archived_bot_id as fallback if bot_id is NULL (for conversations from deleted bots)
        botId: conv.bot_id || conv.archived_bot_id || null,
        userEmail: conv.user_email,
        userPhone: conv.user_phone,
        startedAt: new Date(conv.started_at).getTime(),
        // Calculate message count from actual messages array, fallback to database field
        messageCount: messages.length || conv.message_count || 0,
        status: conv.status || 'active',
        archivedAt: conv.archived_at ? new Date(conv.archived_at).getTime() : undefined,
        archivedBotId: conv.archived_bot_id || undefined,
        messages: messages,
      };
    });
  },

  // Create a new conversation
  // If userId is provided, it's a playground conversation (created by logged-in user)
  // If userId is not provided, it's a widget conversation (external user)
  async createConversation(botId: string, userEmail?: string, userPhone?: string, userId?: string): Promise<Conversation> {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = userId || user?.id || null;
    
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        bot_id: botId,
        user_email: userEmail,
        user_phone: userPhone,
        user_id: currentUserId, // Set user_id for playground conversations
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      botId: data.bot_id,
      userEmail: data.user_email,
      userPhone: data.user_phone,
      startedAt: new Date(data.started_at).getTime(),
      messageCount: 0,
      status: data.status || 'active',
      messages: [],
    };
  },

  // Add a message to a conversation
  async addMessage(conversationId: string, message: ChatMessage): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: message.role,
        text: message.text,
        action_invoked: message.actionInvoked,
        timestamp: new Date(message.timestamp).toISOString(),
      });

    if (error) throw error;

    // Update conversation message count using RPC function
    try {
      const { error: rpcError } = await supabase.rpc('increment_message_count', {
        conv_id: conversationId
      });
      
      if (rpcError) {
        // Fallback: manual count update if RPC doesn't exist
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conversationId);
        
        if (count !== null) {
          await supabase
            .from('conversations')
            .update({ 
              message_count: count,
              updated_at: new Date().toISOString()
            })
            .eq('id', conversationId);
        }
      }
    } catch (err) {
      console.error('Error updating message count:', err);
    }
  },

  // Update conversation status
  async updateConversationStatus(conversationId: string, status: 'active' | 'closed'): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({ status })
      .eq('id', conversationId);

    if (error) throw error;
  },

  // Archive a conversation (instead of deleting it and its messages)
  async deleteConversation(conversationId: string): Promise<void> {
    // Get the conversation to find its bot_id for archived_bot_id
    const { data: conversation } = await supabase
      .from('conversations')
      .select('bot_id')
      .eq('id', conversationId)
      .single();

    // Archive the conversation instead of deleting it
    // Messages remain in the database linked to the archived conversation
    const { error: convError } = await supabase
      .from('conversations')
      .update({
        archived_at: new Date().toISOString(),
        archived_bot_id: conversation?.bot_id || null,
      })
      .eq('id', conversationId)
      .is('archived_at', null); // Only archive if not already archived

    if (convError) throw convError;
  },

  // Archive all conversations for a bot (used when bot is deleted)
  async archiveConversationsByBotId(botId: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({
        archived_at: new Date().toISOString(),
        archived_bot_id: botId,
      })
      .eq('bot_id', botId)
      .is('archived_at', null); // Only archive conversations that aren't already archived

    if (error) throw error;
  },

  // Get archived conversations
  async getArchivedConversations(): Promise<Conversation[]> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No user authenticated, cannot fetch archived conversations');
      return [];
    }
    
    // Get all bots owned by the user to filter conversations
    const { data: userBots } = await supabase
      .from('bots')
      .select('id')
      .eq('user_id', user.id);
    
    const botIds = userBots?.map(b => b.id) || [];
    
    if (botIds.length === 0) {
      return [];
    }
    
    // Get archived conversations
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages (*)
      `)
      .in('bot_id', botIds)
      .not('archived_at', 'is', null) // Only archived conversations
      .order('archived_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching archived conversations:', error);
      return [];
    }

    return (data || []).map((conv: any) => {
      const messages = (conv.messages || [])
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((msg: any) => ({
          role: msg.role,
          text: msg.text,
          timestamp: new Date(msg.timestamp).getTime(),
          actionInvoked: msg.action_invoked,
        }));
      
      return {
        id: conv.id,
        botId: conv.bot_id || conv.archived_bot_id || null,
        userEmail: conv.user_email,
        userPhone: conv.user_phone,
        startedAt: new Date(conv.started_at).getTime(),
        // Calculate message count from actual messages array, fallback to database field
        messageCount: messages.length || conv.message_count || 0,
        status: conv.status || 'active',
        archivedAt: conv.archived_at ? new Date(conv.archived_at).getTime() : undefined,
        archivedBotId: conv.archived_bot_id || undefined,
        messages: messages,
      };
    });
  },

  // Restore archived conversations for a bot (optional, for future use)
  async restoreArchivedConversations(botId: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({
        archived_at: null,
        archived_bot_id: null,
      })
      .eq('archived_bot_id', botId)
      .not('archived_at', 'is', null);

    if (error) throw error;
  },
};

// Integration operations
export const integrationService = {
  // Create a new integration
  async createIntegration(botId: string, settings: {
    name?: string;
    theme?: 'dark' | 'light';
    position?: 'left' | 'right';
    brandColor?: string;
    welcomeMessage?: string;
    collectLeads?: boolean;
  }): Promise<Integration> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('integrations')
      .insert({
        bot_id: botId,
        user_id: user.id,
        name: settings.name || null,
        theme: settings.theme || 'dark',
        position: settings.position || 'right',
        brand_color: settings.brandColor || '#6366f1',
        welcome_message: settings.welcomeMessage || null,
        collect_leads: settings.collectLeads || false,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      botId: data.bot_id,
      userId: data.user_id,
      name: data.name || undefined,
      theme: data.theme,
      position: data.position,
      brandColor: data.brand_color,
      welcomeMessage: data.welcome_message || undefined,
      collectLeads: data.collect_leads,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  },

  // Get integration by ID
  async getIntegrationById(integrationId: string): Promise<Integration | null> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      id: data.id,
      botId: data.bot_id,
      userId: data.user_id,
      name: data.name || undefined,
      theme: data.theme,
      position: data.position,
      brandColor: data.brand_color,
      welcomeMessage: data.welcome_message || undefined,
      collectLeads: data.collect_leads,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  },

  // Get all integrations for a bot
  async getIntegrationsByBotId(botId: string): Promise<Integration[]> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((integration: any) => ({
      id: integration.id,
      botId: integration.bot_id,
      userId: integration.user_id,
      name: integration.name || undefined,
      theme: integration.theme,
      position: integration.position,
      brandColor: integration.brand_color,
      welcomeMessage: integration.welcome_message || undefined,
      collectLeads: integration.collect_leads,
      createdAt: new Date(integration.created_at).getTime(),
      updatedAt: new Date(integration.updated_at).getTime(),
    }));
  },

  // Update an integration
  async updateIntegration(integrationId: string, settings: {
    name?: string;
    theme?: 'dark' | 'light';
    position?: 'left' | 'right';
    brandColor?: string;
    welcomeMessage?: string;
    collectLeads?: boolean;
  }): Promise<Integration> {
    const updateData: any = {};
    if (settings.name !== undefined) updateData.name = settings.name || null;
    if (settings.theme !== undefined) updateData.theme = settings.theme;
    if (settings.position !== undefined) updateData.position = settings.position;
    if (settings.brandColor !== undefined) updateData.brand_color = settings.brandColor;
    if (settings.welcomeMessage !== undefined) updateData.welcome_message = settings.welcomeMessage;
    if (settings.collectLeads !== undefined) updateData.collect_leads = settings.collectLeads;

    const { data, error } = await supabase
      .from('integrations')
      .update(updateData)
      .eq('id', integrationId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      botId: data.bot_id,
      userId: data.user_id,
      name: data.name || undefined,
      theme: data.theme,
      position: data.position,
      brandColor: data.brand_color,
      welcomeMessage: data.welcome_message || undefined,
      collectLeads: data.collect_leads,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  },

  // Delete an integration
  async deleteIntegration(integrationId: string): Promise<void> {
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('id', integrationId);

    if (error) throw error;
  },
};


