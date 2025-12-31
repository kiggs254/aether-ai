import React, { useState } from 'react';
import { User, CreditCard, Shield, Bell, Mail, Key, Trash2, LogOut, Save, Edit2, X, Check, Smartphone, Globe, Lock, Eye, EyeOff } from 'lucide-react';
import { useNotification } from './Notification';
import { supabase } from '../lib/supabase';

interface SettingsProps {
  user: any;
  onSignOut: () => void;
}

type SettingsSection = 'account' | 'billing' | 'security' | 'notifications';

const Settings: React.FC<SettingsProps> = ({ user, onSignOut }) => {
  const { showSuccess, showError } = useNotification();
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

  const sections = [
    { id: 'account' as SettingsSection, label: 'Account', icon: User },
    { id: 'billing' as SettingsSection, label: 'Billing', icon: CreditCard },
    { id: 'security' as SettingsSection, label: 'Security', icon: Shield },
    { id: 'notifications' as SettingsSection, label: 'Notifications', icon: Bell },
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

  const renderBillingSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Billing & Subscription</h2>
        <p className="text-slate-400 text-sm">Manage your subscription and billing information.</p>
      </div>

      {/* Current Plan */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" /> Current Plan
        </h3>
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-lg">Pro Plan</p>
              <p className="text-slate-400 text-sm">Unlimited bots, messages, and features</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">Active</span>
          </div>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-semibold text-white">Usage This Month</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-slate-400 text-xs mb-1">Messages</p>
            <p className="text-white font-bold text-2xl">12,543</p>
            <p className="text-slate-500 text-xs mt-1">Unlimited</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-slate-400 text-xs mb-1">Bots</p>
            <p className="text-white font-bold text-2xl">8</p>
            <p className="text-slate-500 text-xs mt-1">Unlimited</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-slate-400 text-xs mb-1">Storage</p>
            <p className="text-white font-bold text-2xl">2.4 GB</p>
            <p className="text-slate-500 text-xs mt-1">of 100 GB</p>
          </div>
        </div>
      </div>

      {/* Billing History */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-semibold text-white">Billing History</h3>
        <div className="text-center py-8 text-slate-400 text-sm">
          No billing history available yet.
        </div>
      </div>
    </div>
  );

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
        {activeSection === 'billing' && renderBillingSection()}
        {activeSection === 'security' && renderSecuritySection()}
        {activeSection === 'notifications' && renderNotificationsSection()}
      </div>
    </div>
  );
};

export default Settings;

