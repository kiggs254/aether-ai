import { Conversation, Bot } from '../types';

export interface DashboardStatistics {
  totalConversations: number;
  newConversationsToday: number;
  newConversationsThisWeek: number;
  totalMessages: number;
  activeBots: number;
  conversationsOverTime: Array<{ name: string; value: number }>;
  botConversationStats: Array<{ name: string; value: number }>;
  leadsCollected: number;
  unreadMessages: number;
  averageResponseTime: number; // in seconds
  averageMessagesPerConversation: number;
  activeConversations: number;
  archivedConversations: number;
  mostActiveBot: { name: string; count: number } | null;
  averageConversationDuration: number; // in minutes
}

/**
 * Calculate total number of conversations (excluding archived)
 */
export function getTotalConversations(conversations: Conversation[]): number {
  return conversations.filter(c => !c.archivedAt).length;
}

/**
 * Calculate new conversations created today (excluding archived)
 */
export function getNewConversationsToday(conversations: Conversation[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  return conversations.filter(conv => {
    if (conv.archivedAt) return false; // Exclude archived
    const convDate = new Date(conv.startedAt);
    convDate.setHours(0, 0, 0, 0);
    return convDate.getTime() >= todayStart;
  }).length;
}

/**
 * Calculate new conversations created this week (last 7 days, excluding archived)
 */
export function getNewConversationsThisWeek(conversations: Conversation[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = today.getTime() - (7 * 24 * 60 * 60 * 1000);

  return conversations.filter(conv => !conv.archivedAt && conv.startedAt >= weekAgo).length;
}

/**
 * Calculate total messages across all conversations (excluding archived)
 * Uses actual messages array length for accuracy
 */
export function getTotalMessages(conversations: Conversation[]): number {
  return conversations
    .filter(conv => !conv.archivedAt)
    .reduce((total, conv) => {
      // Use actual messages array length if available, fallback to messageCount field
      const count = conv.messages?.length || conv.messageCount || 0;
      return total + count;
    }, 0);
}

/**
 * Calculate number of active bots
 */
export function getActiveBots(bots: Bot[]): number {
  return bots.filter(bot => bot.status === 'active').length;
}

/**
 * Get conversations grouped by day for chart visualization
 * Returns data for the last 7 days (excluding archived)
 */
export function getConversationsOverTime(conversations: Conversation[]): Array<{ name: string; value: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Create array for last 7 days
  const days: Array<{ name: string; value: number; date: Date }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    days.push({ name: dayName, value: 0, date });
  }

  // Count conversations per day (excluding archived)
  conversations
    .filter(conv => !conv.archivedAt)
    .forEach(conv => {
      const convDate = new Date(conv.startedAt);
      convDate.setHours(0, 0, 0, 0);
      
      const dayIndex = days.findIndex(d => {
        const dDate = new Date(d.date);
        dDate.setHours(0, 0, 0, 0);
        return dDate.getTime() === convDate.getTime();
      });
      
      if (dayIndex !== -1) {
        days[dayIndex].value++;
      }
    });

  return days.map(d => ({ name: d.name, value: d.value }));
}

/**
 * Get conversation distribution by bot for pie chart (excluding archived)
 */
export function getBotConversationStats(conversations: Conversation[], bots: Bot[]): Array<{ name: string; value: number }> {
  const botStats = new Map<string, number>();

  // Initialize all bots with 0
  bots.forEach(bot => {
    botStats.set(bot.id, 0);
  });

  // Count conversations per bot (excluding archived)
  conversations
    .filter(conv => !conv.archivedAt)
    .forEach(conv => {
      const current = botStats.get(conv.botId) || 0;
      botStats.set(conv.botId, current + 1);
    });

  // Convert to array and get bot names
  return Array.from(botStats.entries())
    .map(([botId, count]) => {
      const bot = bots.find(b => b.id === botId);
      return {
        name: bot ? bot.name : 'Unknown Bot',
        value: count,
      };
    })
    .filter(stat => stat.value > 0) // Only include bots with conversations
    .sort((a, b) => b.value - a.value); // Sort by count descending
}

/**
 * Get recent conversations (last 5, excluding archived)
 */
export function getRecentConversations(conversations: Conversation[], bots: Bot[]): Array<{
  id: string;
  user: string;
  botName: string;
  timeAgo: string;
  preview: string;
}> {
  // Sort by startedAt descending and take first 5 (excluding archived)
  const recent = [...conversations]
    .filter(conv => !conv.archivedAt)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 5);

  return recent.map(conv => {
    const bot = bots.find(b => b.id === conv.botId);
    const user = conv.userPhone || conv.userEmail || 'Anonymous';
    const lastMessage = conv.messages[conv.messages.length - 1];
    const preview = lastMessage?.text?.substring(0, 50) || 'No messages';
    
    // Calculate time ago
    const now = Date.now();
    const diff = now - conv.startedAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    let timeAgo = '';
    if (days > 0) {
      timeAgo = `${days}d ago`;
    } else if (hours > 0) {
      timeAgo = `${hours}h ago`;
    } else if (minutes > 0) {
      timeAgo = `${minutes}m ago`;
    } else {
      timeAgo = 'Just now';
    }

    return {
      id: conv.id,
      user,
      botName: bot?.name || 'Unknown Bot',
      timeAgo,
      preview: preview.length > 50 ? preview + '...' : preview,
    };
  });
}

/**
 * Count conversations with email or phone number (leads collected)
 */
export function getLeadsCollected(conversations: Conversation[]): number {
  return conversations.filter(conv => {
    if (conv.archivedAt) return false; // Exclude archived
    return (conv.userEmail && conv.userEmail.trim() !== '') || 
           (conv.userPhone && conv.userPhone.trim() !== '');
  }).length;
}

/**
 * Count unread messages from conversations
 * Uses unreadConversations Map if provided for accurate count, otherwise estimates
 */
export function getUnreadMessagesCount(conversations: Conversation[], unreadConversations?: Map<string, number>): number {
  // If unreadConversations Map is provided, use it for accurate count
  if (unreadConversations) {
    return Array.from(unreadConversations.values()).reduce((sum, count) => sum + count, 0);
  }
  
  // Fallback: Simple calculation - count user messages from last 24 hours that might be unread
  const now = Date.now();
  const last24Hours = now - (24 * 60 * 60 * 1000);
  
  return conversations
    .filter(conv => !conv.archivedAt)
    .reduce((total, conv) => {
      const recentUserMessages = conv.messages.filter(msg => 
        msg.role === 'user' && msg.timestamp > last24Hours
      );
      return total + recentUserMessages.length;
    }, 0);
}

/**
 * Calculate average response time between user messages and bot responses
 */
export function getAverageResponseTime(conversations: Conversation[]): number {
  const responseTimes: number[] = [];
  
  conversations
    .filter(conv => !conv.archivedAt)
    .forEach(conv => {
      const messages = conv.messages || [];
      for (let i = 0; i < messages.length - 1; i++) {
        const currentMsg = messages[i];
        const nextMsg = messages[i + 1];
        
        // If current is user message and next is bot message
        if (currentMsg.role === 'user' && nextMsg.role === 'model') {
          const responseTime = (nextMsg.timestamp - currentMsg.timestamp) / 1000; // Convert to seconds
          if (responseTime > 0 && responseTime < 3600) { // Only include reasonable response times (< 1 hour)
            responseTimes.push(responseTime);
          }
        }
      }
    });
  
  if (responseTimes.length === 0) return 0;
  const sum = responseTimes.reduce((a, b) => a + b, 0);
  return sum / responseTimes.length;
}

/**
 * Calculate average messages per conversation
 */
export function getAverageMessagesPerConversation(conversations: Conversation[]): number {
  const activeConversations = conversations.filter(conv => !conv.archivedAt);
  if (activeConversations.length === 0) return 0;
  
  const totalMessages = activeConversations.reduce((sum, conv) => {
    return sum + (conv.messages?.length || conv.messageCount || 0);
  }, 0);
  
  return totalMessages / activeConversations.length;
}

/**
 * Count conversations with messages in the last 24 hours
 */
export function getActiveConversations(conversations: Conversation[]): number {
  const now = Date.now();
  const last24Hours = now - (24 * 60 * 60 * 1000);
  
  return conversations.filter(conv => {
    if (conv.archivedAt) return false; // Exclude archived
    const messages = conv.messages || [];
    return messages.some(msg => msg.timestamp > last24Hours);
  }).length;
}

/**
 * Count archived conversations
 */
export function getArchivedConversationsCount(conversations: Conversation[]): number {
  return conversations.filter(conv => conv.archivedAt !== undefined && conv.archivedAt !== null).length;
}

/**
 * Find the bot with the most conversations
 */
export function getMostActiveBot(conversations: Conversation[], bots: Bot[]): { name: string; count: number } | null {
  const botCounts = new Map<string, number>();
  
  conversations
    .filter(conv => !conv.archivedAt)
    .forEach(conv => {
      const current = botCounts.get(conv.botId) || 0;
      botCounts.set(conv.botId, current + 1);
    });
  
  if (botCounts.size === 0) return null;
  
  const sorted = Array.from(botCounts.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const [botId, count] = sorted[0];
  const bot = bots.find(b => b.id === botId);
  
  return {
    name: bot?.name || 'Unknown Bot',
    count: count,
  };
}

/**
 * Calculate average conversation duration (from first to last message)
 */
export function getAverageConversationDuration(conversations: Conversation[]): number {
  const durations: number[] = [];
  
  conversations
    .filter(conv => !conv.archivedAt)
    .forEach(conv => {
      const messages = conv.messages || [];
      if (messages.length >= 2) {
        const firstMessage = messages[0];
        const lastMessage = messages[messages.length - 1];
        const duration = (lastMessage.timestamp - firstMessage.timestamp) / (1000 * 60); // Convert to minutes
        if (duration > 0 && duration < 10080) { // Only include reasonable durations (< 7 days)
          durations.push(duration);
        }
      }
    });
  
  if (durations.length === 0) return 0;
  const sum = durations.reduce((a, b) => a + b, 0);
  return sum / durations.length;
}

/**
 * Calculate all dashboard statistics
 */
export function calculateDashboardStats(
  conversations: Conversation[],
  bots: Bot[],
  unreadConversations?: Map<string, number>
): DashboardStatistics {
  return {
    totalConversations: getTotalConversations(conversations),
    newConversationsToday: getNewConversationsToday(conversations),
    newConversationsThisWeek: getNewConversationsThisWeek(conversations),
    totalMessages: getTotalMessages(conversations),
    activeBots: getActiveBots(bots),
    conversationsOverTime: getConversationsOverTime(conversations),
    botConversationStats: getBotConversationStats(conversations, bots),
    leadsCollected: getLeadsCollected(conversations),
    unreadMessages: getUnreadMessagesCount(conversations, unreadConversations),
    averageResponseTime: getAverageResponseTime(conversations),
    averageMessagesPerConversation: getAverageMessagesPerConversation(conversations),
    activeConversations: getActiveConversations(conversations),
    archivedConversations: getArchivedConversationsCount(conversations),
    mostActiveBot: getMostActiveBot(conversations, bots),
    averageConversationDuration: getAverageConversationDuration(conversations),
  };
}

