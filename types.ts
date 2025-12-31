export type ActionType = 'link' | 'phone' | 'whatsapp' | 'handoff' | 'custom';

export interface BotAction {
  id: string;
  type: ActionType;
  label: string;
  payload: string; // URL, Phone Number, or Function ID
  description: string; // Instruction for the AI on when to use this
  triggerMessage?: string; // Custom message to show when action is triggered
}

export type AIProvider = 'gemini' | 'openai';

export interface Bot {
  id: string;
  name: string;
  description: string;
  website: string; 
  systemInstruction: string;
  knowledgeBase: string; 
  createdAt: number;
  avatarColor: string;
  totalInteractions: number;
  // Advanced Config
  temperature: number; 
  model: string;
  provider: AIProvider; // 'gemini' or 'openai'
  status: 'active' | 'maintenance' | 'training';
  collectLeads?: boolean;
  actions?: BotAction[]; // New field for actions
  userId?: string; // Supabase user ID
  brandingText?: string; // Custom "Powered by" text for premium users
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isStreaming?: boolean;
  actionInvoked?: string; // ID of action triggered by this message
}

export interface Conversation {
  id: string;
  botId: string;
  userEmail?: string;
  userPhone?: string;
  startedAt: number;
  messageCount: number;
  messages: ChatMessage[];
  status: 'active' | 'closed';
  archivedAt?: number;
  archivedBotId?: string;
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  BOT_BUILDER = 'BOT_BUILDER',
  PLAYGROUND = 'PLAYGROUND',
  INTEGRATION = 'INTEGRATION',
  INBOX = 'INBOX',
  SETTINGS = 'SETTINGS',
}

export interface DashboardStats {
  totalBots: number;
  totalMessages: number;
  activeUsers: number;
  growthRate: number;
}

export interface Integration {
  id: string;
  botId: string;
  userId: string;
  name?: string;
  theme: 'dark' | 'light';
  position: 'left' | 'right';
  brandColor: string;
  welcomeMessage?: string;
  collectLeads: boolean;
  createdAt: number;
  updatedAt: number;
}