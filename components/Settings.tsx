import React, { useState, useEffect } from 'react';
import { User, CreditCard, Shield, Bell, Mail, Key, Trash2, LogOut, Save, Edit2, X, Check, Smartphone, Globe, Lock, Eye, EyeOff, ArrowUpRight, Calendar, Loader2, AlertCircle, Settings as SettingsIcon, Server, Code } from 'lucide-react';
import { useNotification } from './Notification';
import { supabase } from '../lib/supabase';
import PaymentFlow from './PaymentFlow';
import { useAdminStatus } from '../lib/useAdminStatus';

interface SettingsProps {
  user: any;
  onSignOut: () => void;
}

type SettingsSection = 'account' | 'billing' | 'security' | 'notifications' | 'smtp' | 'site';

const Settings: React.FC<SettingsProps> = ({ user, onSignOut }) => {
  const { showSuccess, showError } = useNotification();
  const { isAdmin } = useAdminStatus();
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  
  // Account state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.user_metadata?.name || user?.email?.split('@')[0] || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  
  // Security state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  // Notifications state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [newMessageAlerts, setNewMessageAlerts] = useState(true);
  const [botUpdateAlerts, setBotUpdateAlerts] = useState(false);

  // Subscription state
  const [subscription, setSubscription] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);
  const [usage, setUsage] = useState({ bots: 0, messages: 0, storage: 0 });

  // Admin settings state
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 587,
    secure: false,
    auth: {
      user: '',
      pass: '',
    },
    from_email: '',
    from_name: '',
  });
  const [siteConfig, setSiteConfig] = useState({
    site_name: 'Aether AI',
    site_url: '',
    support_email: '',
    maintenance_mode: false,
    allow_registration: true,
    header_scripts: '',
  });

  useEffect(() => {
    if (user) {
      loadSubscription();
      loadTransactions();
      loadUsage();
      if (isAdmin) {
        loadSettings();
      }
    }
  }, [user, isAdmin]);

  const loadSubscription = async () => {
    try {
      setLoadingSubscription(true);
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            id,
            name,
            description,
            price_monthly,
            price_yearly,
            features,
            max_bots,
            max_messages,
            max_storage_gb
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      setSubscription(data);
    } catch (error: any) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          subscription_plans (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error('Error loading transactions:', error);
    }
  };

  const loadUsage = async () => {
    try {
      // Count bots
      const { count: botCount } = await supabase
        .from('bots')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Count messages (approximate from conversations)
      const { data: conversations } = await supabase
        .from('conversations')
        .select('message_count')
        .eq('user_id', user.id);

      const messageCount = conversations?.reduce((sum, conv) => sum + (conv.message_count || 0), 0) || 0;

      setUsage({
        bots: botCount || 0,
        messages: messageCount,
        storage: 0, // TODO: Calculate actual storage usage
      });
    } catch (error: any) {
      console.error('Error loading usage:', error);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? It will remain active until the end of the current billing period.')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Authentication required', 'Please sign in to continue');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-subscriptions/${subscription.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancel_at_period_end: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel subscription');
      }

      showSuccess('Subscription cancelled', 'Your subscription will remain active until the end of the current billing period.');
      loadSubscription();
    } catch (error: any) {
      showError('Failed to cancel subscription', error.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: profileName }
      });
      
      if (error) throw error;
      
      showSuccess('Profile updated', 'Your profile information has been updated successfully.');
      setIsEditingProfile(false);
    } catch (error: any) {
      showError('Update failed', error.message || 'Failed to update profile.');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showError('Password mismatch', 'New password and confirmation do not match.');
      return;
    }
    
    if (newPassword.length < 6) {
      showError('Password too short', 'Password must be at least 6 characters long.');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      showSuccess('Password changed', 'Your password has been updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showError('Password change failed', error.message || 'Failed to change password.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    try {
      // In a real app, you'd call an API endpoint to handle account deletion
      showError('Account deletion', 'Account deletion is not yet implemented. Please contact support.');
    } catch (error: any) {
      showError('Deletion failed', error.message || 'Failed to delete account.');
    }
  };

  // Helper function to get a fresh session token
  const getFreshSession = async () => {
    // First, get the current session
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !currentSession) {
      throw new Error('Authentication required. Please sign in again.');
    }
    
    // Check if token is expired or about to expire (within 5 minutes)
    const expiresAt = currentSession.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 5 * 60; // 5 minutes buffer
    
    // If token is expired or about to expire, refresh it
    if (expiresAt && (expiresAt - now) < bufferTime) {
      if (currentSession.refresh_token) {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: currentSession.refresh_token
        });
        
        if (refreshError || !refreshedSession) {
          // If refresh fails, try getUser which might trigger auto-refresh
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError || !user) {
            throw new Error('Authentication required. Please sign in again.');
          }
          
          // Get session again after getUser
          const { data: { session: newSession } } = await supabase.auth.getSession();
          if (!newSession) {
            throw new Error('Authentication required. Please sign in again.');
          }
          return newSession;
        }
        
        return refreshedSession;
      }
    }
    
    // Token is still valid, return current session
    return currentSession;
  };

  // Load settings for admin
  const loadSettings = async () => {
    if (!isAdmin) return;
    
    try {
      setLoadingSettings(true);
      
      // Load SMTP config
      const { data: smtpData, error: smtpError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'smtp_config')
        .single();

      if (smtpError && smtpError.code !== 'PGRST116') {
        throw smtpError;
      }

      if (smtpData?.value) {
        setSmtpConfig(smtpData.value as any);
      }

      // Load site config
      const { data: siteData, error: siteError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'site_config')
        .single();

      if (siteError && siteError.code !== 'PGRST116') {
        throw siteError;
      }

      if (siteData?.value) {
        const config = siteData.value as any;
        // Ensure header_scripts exists, default to empty string if not present
        setSiteConfig({
          ...config,
          header_scripts: config.header_scripts || '',
        });
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      showError('Failed to load settings', error.message || 'Could not load site settings.');
    } finally {
      setLoadingSettings(false);
    }
  };

  // Save SMTP config
  const saveSmtpConfig = async () => {
    try {
      setLoadingSettings(true);
      
      const session = await getFreshSession();

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-site-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          smtp_config: smtpConfig,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('SMTP settings save error:', error);
        throw new Error(error.error || error.message || 'Failed to save SMTP settings');
      }

      showSuccess('SMTP settings saved', 'Your SMTP configuration has been updated successfully.');
    } catch (error: any) {
      console.error('Error saving SMTP config:', error);
      showError('Failed to save SMTP settings', error.message || 'Could not save SMTP configuration.');
    } finally {
      setLoadingSettings(false);
    }
  };

  // Save site config
  const saveSiteConfig = async () => {
    try {
      setLoadingSettings(true);
      
      const session = await getFreshSession();

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-site-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_config: siteConfig,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Site settings save error:', error);
        throw new Error(error.error || error.message || 'Failed to save site settings');
      }

      showSuccess('Site settings saved', 'Your site configuration has been updated successfully.');
    } catch (error: any) {
      console.error('Error saving site config:', error);
      showError('Failed to save site settings', error.message || 'Could not save site configuration.');
    } finally {
      setLoadingSettings(false);
    }
  };

  const sections = [
    { id: 'account' as SettingsSection, label: 'Account', icon: User },
    ...(!isAdmin ? [{ id: 'billing' as SettingsSection, label: 'Billing', icon: CreditCard }] : []),
    { id: 'security' as SettingsSection, label: 'Security', icon: Shield },
    { id: 'notifications' as SettingsSection, label: 'Notifications', icon: Bell },
    ...(isAdmin ? [
      { id: 'smtp' as SettingsSection, label: 'SMTP Settings', icon: Mail },
      { id: 'site' as SettingsSection, label: 'Site Settings', icon: SettingsIcon },
    ] : []),
  ];

  const renderAccountSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Account Settings</h2>
        <p className="text-slate-400 text-sm">Manage your account information and preferences.</p>
      </div>

      {/* Profile Information */}
      <div className="glass-card p-6 rounded-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" /> Profile Information
          </h3>
          {!isEditingProfile && (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-semibold">
              {profileName.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              {isEditingProfile ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block">Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl glass-input text-white placeholder-slate-500"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block">Email</label>
                    <input
                      type="email"
                      value={profileEmail}
                      disabled
                      className="w-full px-4 py-2 rounded-xl glass-input text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateProfile}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Save Changes
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileName(user?.user_metadata?.name || user?.email?.split('@')[0] || '');
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-white font-medium">{profileName || 'User'}</p>
                  <p className="text-slate-400 text-sm">{profileEmail}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-indigo-400" /> Change Password
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">New Password</label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 rounded-xl glass-input text-white placeholder-slate-500"
                placeholder="Enter new password"
              />
              <button
                onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Confirm New Password</label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 rounded-xl glass-input text-white placeholder-slate-500"
                placeholder="Confirm new password"
              />
              <button
                onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            onClick={handleChangePassword}
            disabled={!newPassword || !confirmPassword}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Update Password
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <LogOut className="w-5 h-5 text-indigo-400" /> Sign Out
        </h3>
        <p className="text-slate-400 text-sm">Sign out of your account. You can sign back in anytime.</p>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-6 rounded-2xl border border-red-500/20 space-y-4">
        <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
          <Trash2 className="w-5 h-5" /> Danger Zone
        </h3>
        <p className="text-slate-400 text-sm">Once you delete your account, there is no going back. Please be certain.</p>
        <button
          onClick={handleDeleteAccount}
          className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 transition-colors"
        >
          Delete Account
        </button>
      </div>
    </div>
  );

  const renderBillingSection = () => {
    if (showPaymentFlow) {
      return (
        <div>
          <button
            onClick={() => setShowPaymentFlow(false)}
            className="mb-4 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
            Back to Billing
          </button>
          <PaymentFlow
            onSuccess={() => {
              setShowPaymentFlow(false);
              loadSubscription();
            }}
            onCancel={() => setShowPaymentFlow(false)}
          />
        </div>
      );
    }

    const plan = subscription?.subscription_plans;
    const maxBots = plan?.max_bots ?? 'Unlimited';
    const maxMessages = plan?.max_messages ?? 'Unlimited';
    const maxStorage = plan?.max_storage_gb ?? 'Unlimited';

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Billing & Subscription</h2>
          <p className="text-slate-400 text-sm">Manage your subscription and billing information.</p>
        </div>

        {loadingSubscription ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Current Plan */}
            <div className="glass-card p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-400" /> Current Plan
                </h3>
                {subscription && (
                  <button
                    onClick={() => setShowPaymentFlow(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Change Plan
                  </button>
                )}
              </div>
              {subscription ? (
                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-semibold text-lg">{plan?.name || 'Unknown Plan'}</p>
                      <p className="text-slate-400 text-sm">{plan?.description || 'No description'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      subscription.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : subscription.status === 'past_due'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {subscription.billing_cycle === 'monthly' ? 'Monthly' : 'Yearly'} billing
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Renews: {formatDate(subscription.current_period_end)}</span>
                    </div>
                  </div>
                  {subscription.cancel_at_period_end && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-amber-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Subscription will cancel at period end
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-slate-400 mb-4">You don't have an active subscription.</p>
                  <button
                    onClick={() => setShowPaymentFlow(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    Choose a Plan
                  </button>
                </div>
              )}
            </div>

            {/* Usage Statistics */}
            {subscription && (
              <div className="glass-card p-6 rounded-2xl space-y-4">
                <h3 className="text-lg font-semibold text-white">Usage This Month</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-slate-400 text-xs mb-1">Messages</p>
                    <p className="text-white font-bold text-2xl">{usage.messages.toLocaleString()}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {maxMessages === 'Unlimited' ? 'Unlimited' : `of ${maxMessages.toLocaleString()}`}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-slate-400 text-xs mb-1">Bots</p>
                    <p className="text-white font-bold text-2xl">{usage.bots}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {maxBots === 'Unlimited' ? 'Unlimited' : `of ${maxBots}`}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-slate-400 text-xs mb-1">Storage</p>
                    <p className="text-white font-bold text-2xl">{usage.storage.toFixed(1)} GB</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {maxStorage === 'Unlimited' ? 'Unlimited' : `of ${maxStorage} GB`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Plan Features */}
            {subscription && plan?.features && plan.features.length > 0 && (
              <div className="glass-card p-6 rounded-2xl space-y-4">
                <h3 className="text-lg font-semibold text-white">Plan Features</h3>
                <ul className="space-y-2">
                  {plan.features.map((feature: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-300 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cancel Subscription */}
            {subscription && subscription.status === 'active' && !subscription.cancel_at_period_end && (
              <div className="glass-card p-6 rounded-2xl border border-red-500/20 space-y-4">
                <h3 className="text-lg font-semibold text-red-400">Cancel Subscription</h3>
                <p className="text-slate-400 text-sm">
                  Cancel your subscription. You'll continue to have access until the end of your billing period.
                </p>
                <button
                  onClick={handleCancelSubscription}
                  className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 transition-colors"
                >
                  Cancel Subscription
                </button>
              </div>
            )}

            {/* Billing History */}
            <div className="glass-card p-6 rounded-2xl space-y-4">
              <h3 className="text-lg font-semibold text-white">Billing History</h3>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No billing history available yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div>
                        <p className="text-white font-medium">
                          {transaction.subscription_plans?.name || 'Subscription'}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {formatDate(transaction.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">
                          {formatCurrency(transaction.amount)}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          transaction.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : transaction.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {transaction.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderSecuritySection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Security Settings</h2>
        <p className="text-slate-400 text-sm">Manage your account security and authentication.</p>
      </div>

      {/* Two-Factor Authentication */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" /> Two-Factor Authentication
            </h3>
            <p className="text-slate-400 text-sm mt-1">Add an extra layer of security to your account</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={twoFactorEnabled}
              onChange={(e) => setTwoFactorEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-indigo-400" /> Active Sessions
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Current Session</p>
                <p className="text-slate-400 text-xs">Chrome on macOS • Now</p>
              </div>
            </div>
            <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">Active</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Notification Preferences</h2>
        <p className="text-slate-400 text-sm">Control how and when you receive notifications.</p>
      </div>

      <div className="glass-card p-6 rounded-2xl space-y-6">
        {/* Email Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" /> Email Notifications
            </h3>
            <p className="text-slate-400 text-sm mt-1">Receive notifications via email</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* In-App Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-400" /> In-App Notifications
            </h3>
            <p className="text-slate-400 text-sm mt-1">Show notifications within the app</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={inAppNotifications}
              onChange={(e) => setInAppNotifications(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="h-px bg-white/5"></div>

        {/* Specific Notification Types */}
        <div className="space-y-4">
          <h4 className="text-white font-medium">Notification Types</h4>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm">New Messages</p>
              <p className="text-slate-400 text-xs">Get notified when you receive new messages</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={newMessageAlerts}
                onChange={(e) => setNewMessageAlerts(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm">Bot Updates</p>
              <p className="text-slate-400 text-xs">Get notified about bot configuration changes</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={botUpdateAlerts}
                onChange={(e) => setBotUpdateAlerts(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSmtpSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">SMTP Configuration</h2>
        <p className="text-slate-400 text-sm">Configure SMTP server settings for sending emails.</p>
      </div>

      {loadingSettings ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <div className="glass-card p-6 rounded-2xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">SMTP Host</label>
              <input
                type="text"
                value={smtpConfig.host}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                className="w-full px-4 py-2 rounded-xl glass-input text-white placeholder-slate-500"
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">SMTP Port</label>
              <input
                type="number"
                value={smtpConfig.port}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) || 587 })}
                className="w-full px-4 py-2 rounded-xl glass-input text-white placeholder-slate-500"
                placeholder="587"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">SMTP Username</label>
              <input
                type="text"
                value={smtpConfig.auth.user}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, auth: { ...smtpConfig.auth, user: e.target.value } })}
                className="w-full px-4 py-2 rounded-xl glass-input text-white placeholder-slate-500"
                placeholder="your-email@gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">SMTP Password</label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={smtpConfig.auth.pass}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, auth: { ...smtpConfig.auth, pass: e.target.value } })}
                  className="w-full px-4 py-2 pr-10 rounded-xl glass-input text-white placeholder-slate-500"
                  placeholder="Your SMTP password"
                />
                <button
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">From Email</label>
              <input
                type="email"
                value={smtpConfig.from_email}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
                className="w-full px-4 py-2 rounded-xl glass-input text-white placeholder-slate-500"
                placeholder="noreply@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">From Name</label>
              <input
                type="text"
                value={smtpConfig.from_name}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                className="w-full px-4 py-2 rounded-xl glass-input text-white placeholder-slate-500"
                placeholder="Aether AI"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="smtp_secure"
              checked={smtpConfig.secure}
              onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-600"
            />
            <label htmlFor="smtp_secure" className="text-sm text-slate-300">
              Use secure connection (TLS/SSL)
            </label>
          </div>
          <button
            onClick={saveSmtpConfig}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium"
          >
            <Save className="w-5 h-5" />
            Save SMTP Settings
          </button>
        </div>
      )}
    </div>
  );

  const renderSiteSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Site Settings</h2>
        <p className="text-slate-400 text-sm">Configure general site-wide settings.</p>
      </div>

      {loadingSettings ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-400" /> General Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Site Name</label>
                <input
                  type="text"
                  value={siteConfig.site_name}
                  onChange={(e) => setSiteConfig({ ...siteConfig, site_name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl glass-input text-white placeholder-slate-500"
                  placeholder="Aether AI"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Site URL</label>
                <input
                  type="url"
                  value={siteConfig.site_url}
                  onChange={(e) => setSiteConfig({ ...siteConfig, site_url: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl glass-input text-white placeholder-slate-500"
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Support Email</label>
                <input
                  type="email"
                  value={siteConfig.support_email}
                  onChange={(e) => setSiteConfig({ ...siteConfig, support_email: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl glass-input text-white placeholder-slate-500"
                  placeholder="support@example.com"
                />
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-400" /> System Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium">Maintenance Mode</h4>
                  <p className="text-slate-400 text-sm">Enable maintenance mode to restrict access</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siteConfig.maintenance_mode}
                    onChange={(e) => setSiteConfig({ ...siteConfig, maintenance_mode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium">Allow Registration</h4>
                  <p className="text-slate-400 text-sm">Allow new users to sign up</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siteConfig.allow_registration}
                    onChange={(e) => setSiteConfig({ ...siteConfig, allow_registration: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-400" /> Header Scripts
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Custom Header Scripts
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Add custom scripts (e.g., Google Analytics, Facebook Pixel) that will be injected into the &lt;head&gt; section of your site.
                </p>
                <textarea
                  value={siteConfig.header_scripts || ''}
                  onChange={(e) => setSiteConfig({ ...siteConfig, header_scripts: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-slate-500 font-mono text-sm min-h-[200px] resize-y"
                  placeholder='<!-- Example: Google Analytics -->&#10;&lt;script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"&gt;&lt;/script&gt;&#10;&lt;script&gt;&#10;  window.dataLayer = window.dataLayer || [];&#10;  function gtag(){dataLayer.push(arguments);}&#10;  gtag("js", new Date());&#10;  gtag("config", "GA_MEASUREMENT_ID");&#10;&lt;/script&gt;'
                  spellCheck={false}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Paste your script tags here. They will be added to the &lt;head&gt; section of all pages.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={saveSiteConfig}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium"
          >
            <Save className="w-5 h-5" />
            Save Site Settings
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] gap-6 max-w-7xl mx-auto animate-fade-in">
      {/* Settings Sidebar */}
      <div className="w-full lg:w-64 flex-shrink-0">
        <div className="glass-card rounded-3xl p-4 space-y-2">
          <h1 className="text-xl font-bold text-white mb-4 px-2">Settings</h1>
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : ''}`} />
                <span className="font-medium text-sm">{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeSection === 'account' && renderAccountSection()}
        {!isAdmin && activeSection === 'billing' && renderBillingSection()}
        {activeSection === 'security' && renderSecuritySection()}
        {activeSection === 'notifications' && renderNotificationsSection()}
        {isAdmin && activeSection === 'smtp' && renderSmtpSection()}
        {isAdmin && activeSection === 'site' && renderSiteSection()}
      </div>
    </div>
  );
};

export default Settings;

