export type ActionType = 'link' | 'phone' | 'whatsapp' | 'handoff' | 'custom' | 'media' | 'products';

export interface BotAction {
  id: string;
  type: ActionType;
  label: string;
  payload: string; // URL, Phone Number, Function ID, or Media File URL
  description: string; // Instruction for the AI on when to use this
  triggerMessage?: string; // Custom message to show when action is triggered
  mediaType?: 'image' | 'audio' | 'pdf' | 'video'; // File type for media actions
  fileSize?: number; // File size in bytes for media actions
}

export type AIProvider = 'gemini' | 'openai' | 'deepseek';

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
  headerImageUrl?: string; // Header image URL for chat widget
  // E-commerce
  ecommerceEnabled?: boolean;
  productFeedUrl?: string;
  ecommerceSettings?: EcommerceSettings;
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
  BOTS = 'BOTS',
  PLAYGROUND = 'PLAYGROUND',
  INTEGRATION = 'INTEGRATION',
  INTEGRATIONS = 'INTEGRATIONS',
  INBOX = 'INBOX',
  SETTINGS = 'SETTINGS',
  ADMIN_PLANS = 'ADMIN_PLANS',
  ADMIN_SUBSCRIPTIONS = 'ADMIN_SUBSCRIPTIONS',
}

export interface DashboardStats {
  totalBots: number;
  totalMessages: number;
  activeUsers: number;
  growthRate: number;
}

export interface DepartmentBot {
  botId: string;
  departmentName: string;
  departmentLabel: string; // Display label (e.g., "Sales", "Support", "Billing")
}

export interface Integration {
  id: string;
  botId: string; // Primary/default bot ID (for backward compatibility)
  userId: string;
  name?: string;
  theme: 'dark' | 'light';
  position: 'left' | 'right';
  brandColor: string;
  welcomeMessage?: string;
  collectLeads: boolean;
  departmentBots?: DepartmentBot[]; // Array of department bots for premium users
  createdAt: number;
  updatedAt: number;
}

// E-commerce types
export interface Product {
  id: string;
  botId: string;
  productId: string; // Unique identifier from feed
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  productUrl: string;
  category?: string;
  keywords?: string[];
  inStock?: boolean;
  lastUpdated?: number;
}

export interface ProductSummary {
  id: string;
  productId: string;
  name: string;
  price?: number;
  currency?: string;
  category?: string;
}

export interface ProductFilters {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  keywords?: string[];
  inStock?: boolean;
  maxResults?: number;
}

export interface EcommerceSettings {
  maxProductsToRecommend?: number; // Default: 10
  productsVisibleInCarousel?: number; // Default: 5
  defaultCurrency?: string; // Default currency if not specified in feed (e.g., "KES", "USD")
  categoryFilters?: {
    include?: string[];
    exclude?: string[];
  };
  priceRange?: {
    min?: number;
    max?: number;
  };
}