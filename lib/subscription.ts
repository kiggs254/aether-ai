import { supabase } from './supabase';
import { isSuperAdmin } from './admin';

export interface SubscriptionInfo {
  planName: string;
  isFree: boolean;
  // Legacy fields (kept for backward compatibility)
  canCreateMultipleIntegrations: boolean;
  canUseDepartmentalBots: boolean;
  canCollectLeads: boolean;
  // New feature fields
  allowedModels: string[];
  maxBots: number | null;
  maxIntegrations: number | null;
  maxMessages: number | null;
  maxStorageMB: number | null;
  maxKnowledgeChars: number | null;
  allowActions: boolean;
  allowLeadCollection: boolean;
  allowEcommerce: boolean;
  allowDepartmentalBots: boolean;
  planId?: string;
}

/**
 * Get free plan defaults
 */
function getFreePlanDefaults(): SubscriptionInfo {
  return {
    planName: 'Free',
    isFree: true,
    canCreateMultipleIntegrations: false,
    canUseDepartmentalBots: false,
    canCollectLeads: false,
    allowedModels: ['deepseek-fast'],
    maxBots: 1,
    maxIntegrations: 1,
    maxMessages: 800,
    maxStorageMB: 50,
    maxKnowledgeChars: 3000,
    allowActions: false,
    allowLeadCollection: false,
    allowEcommerce: false,
    allowDepartmentalBots: false,
  };
}

/**
 * Get super admin defaults (unlimited access)
 */
function getSuperAdminDefaults(): SubscriptionInfo {
  return {
    planName: 'Super Admin',
    isFree: false,
    canCreateMultipleIntegrations: true,
    canUseDepartmentalBots: true,
    canCollectLeads: true,
    allowedModels: ['deepseek-fast', 'openai-fast', 'gemini-fast', 'deepseek-reasoning', 'openai-reasoning', 'gemini-reasoning'],
    maxBots: null,
    maxIntegrations: null,
    maxMessages: null,
    maxStorageMB: null,
    maxKnowledgeChars: null,
    allowActions: true,
    allowLeadCollection: true,
    allowEcommerce: true,
    allowDepartmentalBots: true,
  };
}

/**
 * Map model identifiers to actual model names
 */
export function getModelIdentifier(provider: string, model: string): string {
  // DeepSeek models
  if (provider === 'deepseek') {
    if (model.includes('reasoner') || model.includes('reasoning')) {
      return 'deepseek-reasoning';
    }
    return 'deepseek-fast';
  }
  
  // OpenAI models
  if (provider === 'openai') {
    if (model.includes('o1') || model.includes('o3') || model.includes('reasoning')) {
      return 'openai-reasoning';
    }
    return 'openai-fast';
  }
  
  // Gemini models
  if (provider === 'gemini') {
    if (model.includes('thinking') || model.includes('reasoning')) {
      return 'gemini-reasoning';
    }
    return 'gemini-fast';
  }
  
  // Default to fast
  return `${provider}-fast`;
}

/**
 * Get user's subscription information
 * Returns default free plan if no active subscription
 * Super admins get unlimited access regardless of subscription
 */
export async function getUserSubscriptionInfo(): Promise<SubscriptionInfo> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Not authenticated - return free plan limits
      return getFreePlanDefaults();
    }

    // Check if user is super admin - super admins get unlimited access
    const adminStatus = await isSuperAdmin();
    if (adminStatus) {
      return getSuperAdminDefaults();
    }

    // Get active subscription with full plan details
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          id,
          name,
          price_monthly,
          price_yearly,
          allowed_models,
          max_bots,
          max_messages,
          max_integrations,
          max_knowledge_chars,
          max_storage_mb,
          allow_actions,
          allow_lead_collection,
          allow_ecommerce,
          allow_departmental_bots
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.error('Error fetching subscription:', error);
      // Default to free plan on error
      return getFreePlanDefaults();
    }

    // If no subscription, user is on free plan
    if (!subscription || !subscription.subscription_plans) {
      return getFreePlanDefaults();
    }

    const plan = subscription.subscription_plans;
    const planName = plan.name;
    const isFree = planName.toLowerCase() === 'free' || 
                   (plan.price_monthly === 0 && plan.price_yearly === 0);

    // Extract allowed models from JSONB
    const allowedModels = Array.isArray(plan.allowed_models) 
      ? plan.allowed_models 
      : (plan.allowed_models ? JSON.parse(plan.allowed_models as any) : []);

    return {
      planName,
      isFree,
      planId: plan.id,
      // Legacy fields (for backward compatibility)
      canCreateMultipleIntegrations: (plan.max_integrations ?? 0) > 1,
      canUseDepartmentalBots: plan.allow_departmental_bots ?? false,
      canCollectLeads: plan.allow_lead_collection ?? false,
      // New feature fields
      allowedModels: allowedModels || [],
      maxBots: plan.max_bots ?? null,
      maxIntegrations: plan.max_integrations ?? null,
      maxMessages: plan.max_messages ?? null,
      maxStorageMB: plan.max_storage_mb ?? null,
      maxKnowledgeChars: plan.max_knowledge_chars ?? null,
      allowActions: plan.allow_actions ?? false,
      allowLeadCollection: plan.allow_lead_collection ?? false,
      allowEcommerce: plan.allow_ecommerce ?? false,
      allowDepartmentalBots: plan.allow_departmental_bots ?? false,
    };
  } catch (error) {
    console.error('Error getting subscription info:', error);
    // Default to free plan on error
    return getFreePlanDefaults();
  }
}

/**
 * Feature validation utilities
 */
export class FeatureValidator {
  private subscriptionInfo: SubscriptionInfo;
  private isAdmin: boolean | null = null; // Cache admin status

  constructor(subscriptionInfo: SubscriptionInfo) {
    this.subscriptionInfo = subscriptionInfo;
  }

  /**
   * Check if current user is super admin (synchronous check via plan name)
   */
  private isSuperAdminSync(): boolean {
    return this.subscriptionInfo.planName === 'Super Admin';
  }

  /**
   * Check if current user is super admin (with caching, async)
   */
  private async checkIsSuperAdmin(): Promise<boolean> {
    if (this.isAdmin !== null) {
      return this.isAdmin;
    }
    this.isAdmin = await isSuperAdmin();
    return this.isAdmin;
  }

  /**
   * Check if user can use a specific model
   */
  canUseModel(provider: string, model: string): boolean {
    // Super admins can use any model
    if (this.isSuperAdminSync()) {
      return true;
    }
    const identifier = getModelIdentifier(provider, model);
    return this.subscriptionInfo.allowedModels.includes(identifier);
  }

  /**
   * Check if user can create a new bot
   */
  async canCreateBot(): Promise<{ allowed: boolean; reason?: string }> {
    // Super admins can create unlimited bots
    if (await this.checkIsSuperAdmin()) {
      return { allowed: true };
    }

    if (this.subscriptionInfo.maxBots === null) {
      return { allowed: true };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { allowed: false, reason: 'Not authenticated' };
    }

    const { count } = await supabase
      .from('bots')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count || 0) >= this.subscriptionInfo.maxBots) {
      return { 
        allowed: false, 
        reason: `You've reached the limit of ${this.subscriptionInfo.maxBots} bot(s) for your plan. Please upgrade to create more.` 
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can create a new integration
   */
  async canCreateIntegration(): Promise<{ allowed: boolean; reason?: string }> {
    // Super admins can create unlimited integrations
    if (await this.checkIsSuperAdmin()) {
      return { allowed: true };
    }

    if (this.subscriptionInfo.maxIntegrations === null) {
      return { allowed: true };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { allowed: false, reason: 'Not authenticated' };
    }

    const { count } = await supabase
      .from('integrations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count || 0) >= this.subscriptionInfo.maxIntegrations) {
      return { 
        allowed: false, 
        reason: `You've reached the limit of ${this.subscriptionInfo.maxIntegrations} integration(s) for your plan. Please upgrade to create more.` 
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can use knowledge base with given character count
   */
  canUseKnowledgeChars(chars: number): { allowed: boolean; reason?: string } {
    // Super admins have unlimited knowledge base
    if (this.isSuperAdminSync()) {
      return { allowed: true };
    }

    if (this.subscriptionInfo.maxKnowledgeChars === null) {
      return { allowed: true };
    }

    if (chars > this.subscriptionInfo.maxKnowledgeChars) {
      return { 
        allowed: false, 
        reason: `Knowledge base limit is ${this.subscriptionInfo.maxKnowledgeChars.toLocaleString()} characters. Your current text has ${chars.toLocaleString()} characters. Please upgrade to increase the limit.` 
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can use storage (in MB)
   */
  async canUseStorage(mb: number): Promise<{ allowed: boolean; reason?: string }> {
    // Super admins have unlimited storage
    if (await this.checkIsSuperAdmin()) {
      return { allowed: true };
    }

    if (this.subscriptionInfo.maxStorageMB === null) {
      return { allowed: true };
    }

    // TODO: Calculate actual storage usage from file uploads
    // For now, we'll just check the limit
    if (mb > this.subscriptionInfo.maxStorageMB) {
      return { 
        allowed: false, 
        reason: `Storage limit is ${this.subscriptionInfo.maxStorageMB} MB. Please upgrade to increase the limit.` 
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can use actions
   */
  canUseActions(): boolean {
    // Super admins can use all features
    if (this.isSuperAdminSync()) {
      return true;
    }
    return this.subscriptionInfo.allowActions;
  }

  /**
   * Check if user can collect leads
   */
  canCollectLeads(): boolean {
    // Super admins can use all features
    if (this.isSuperAdminSync()) {
      return true;
    }
    return this.subscriptionInfo.allowLeadCollection;
  }

  /**
   * Check if user can use ecommerce
   */
  canUseEcommerce(): boolean {
    // Super admins can use all features
    if (this.isSuperAdminSync()) {
      return true;
    }
    return this.subscriptionInfo.allowEcommerce;
  }

  /**
   * Check if user can use departmental bots
   */
  canUseDepartmentalBots(): boolean {
    // Super admins can use all features
    if (this.isSuperAdminSync()) {
      return true;
    }
    return this.subscriptionInfo.allowDepartmentalBots;
  }
}

