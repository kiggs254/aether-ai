import { supabase } from './supabase';
import { isSuperAdmin } from './admin';

export interface SubscriptionInfo {
  planName: string;
  isFree: boolean;
  canCreateMultipleIntegrations: boolean;
  canUseDepartmentalBots: boolean;
  canCollectLeads: boolean;
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
      return {
        planName: 'Free',
        isFree: true,
        canCreateMultipleIntegrations: false,
        canUseDepartmentalBots: false,
        canCollectLeads: false,
      };
    }

    // Check if user is super admin - super admins get unlimited access
    const adminStatus = await isSuperAdmin();
    if (adminStatus) {
      return {
        planName: 'Super Admin',
        isFree: false,
        canCreateMultipleIntegrations: true,
        canUseDepartmentalBots: true,
        canCollectLeads: true,
      };
    }

    // Get active subscription
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          id,
          name,
          price_monthly,
          price_yearly
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.error('Error fetching subscription:', error);
      // Default to free plan on error
      return {
        planName: 'Free',
        isFree: true,
        canCreateMultipleIntegrations: false,
        canUseDepartmentalBots: false,
        canCollectLeads: false,
      };
    }

    // If no subscription, user is on free plan
    if (!subscription || !subscription.subscription_plans) {
      return {
        planName: 'Free',
        isFree: true,
        canCreateMultipleIntegrations: false,
        canUseDepartmentalBots: false,
        canCollectLeads: false,
      };
    }

    const planName = subscription.subscription_plans.name;
    const isFree = planName.toLowerCase() === 'free' || 
                   (subscription.subscription_plans.price_monthly === 0 && 
                    subscription.subscription_plans.price_yearly === 0);

    return {
      planName,
      isFree,
      canCreateMultipleIntegrations: !isFree,
      canUseDepartmentalBots: !isFree,
      canCollectLeads: !isFree,
    };
  } catch (error) {
    console.error('Error getting subscription info:', error);
    // Default to free plan on error
    return {
      planName: 'Free',
      isFree: true,
      canCreateMultipleIntegrations: false,
      canUseDepartmentalBots: false,
      canCollectLeads: false,
    };
  }
}

