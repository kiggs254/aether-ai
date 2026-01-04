import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Edit2, Trash2, Save, X, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from './Notification';
import { useAdminStatus } from '../lib/useAdminStatus';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: any[];
  max_bots: number | null;
  max_messages: number | null;
  max_storage_gb: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AdminPlans: React.FC = () => {
  const { isAdmin, loading: adminLoading } = useAdminStatus();
  const { showError, showSuccess } = useNotification();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({
    name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    features: [],
    max_bots: null,
    max_messages: null,
    max_storage_gb: null,
    is_active: true,
  });

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      loadPlans();
    }
  }, [isAdmin, adminLoading]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Authentication required', 'Please sign in to continue');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-plans`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load plans');
      }

      const data = await response.json();
      setPlans(data);
    } catch (error: any) {
      showError('Failed to load plans', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Authentication required', 'Please sign in to continue');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create plan');
      }

      showSuccess('Plan created', 'The subscription plan has been created successfully');
      setCreating(false);
      setFormData({
        name: '',
        description: '',
        price_monthly: 0,
        price_yearly: 0,
        features: [],
        max_bots: null,
        max_messages: null,
        max_storage_gb: null,
        is_active: true,
      });
      loadPlans();
    } catch (error: any) {
      showError('Failed to create plan', error.message);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Authentication required', 'Please sign in to continue');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-plans/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update plan');
      }

      showSuccess('Plan updated', 'The subscription plan has been updated successfully');
      setEditingId(null);
      loadPlans();
    } catch (error: any) {
      showError('Failed to update plan', error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this plan? This cannot be undone if there are active subscriptions.')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Authentication required', 'Please sign in to continue');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-plans/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete plan');
      }

      showSuccess('Plan deactivated', 'The subscription plan has been deactivated');
      loadPlans();
    } catch (error: any) {
      showError('Failed to delete plan', error.message);
    }
  };

  const startEdit = (plan: SubscriptionPlan) => {
    setEditingId(plan.id);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      features: plan.features || [],
      max_bots: plan.max_bots,
      max_messages: plan.max_messages,
      max_storage_gb: plan.max_storage_gb,
      is_active: plan.is_active,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCreating(false);
    setFormData({
      name: '',
      description: '',
      price_monthly: 0,
      price_yearly: 0,
      features: [],
      max_bots: null,
      max_messages: null,
      max_storage_gb: null,
      is_active: true,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="glass-card p-8 rounded-2xl text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400">You need super admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Subscription Plans</h1>
          <p className="text-slate-400">Manage subscription plans and pricing</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Plan
          </button>
        )}
      </div>

      {creating && (
        <div className="glass-card p-6 rounded-2xl border border-indigo-500/30">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            Create New Plan
          </h2>
          <PlanForm
            formData={formData}
            setFormData={setFormData}
            onSave={handleCreate}
            onCancel={cancelEdit}
          />
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading plans...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`glass-card p-6 rounded-2xl border ${
                plan.is_active ? 'border-white/10' : 'border-red-500/30 opacity-60'
              }`}
            >
              {editingId === plan.id ? (
                <PlanForm
                  formData={formData}
                  setFormData={setFormData}
                  onSave={() => handleUpdate(plan.id)}
                  onCancel={cancelEdit}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-sm text-slate-400">{plan.description}</p>
                      )}
                    </div>
                    {!plan.is_active && (
                      <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Monthly</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(plan.price_monthly)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Yearly</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(plan.price_yearly)}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 text-sm text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>Max Bots:</span>
                      <span className="font-medium">{plan.max_bots ?? 'Unlimited'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Max Messages:</span>
                      <span className="font-medium">
                        {plan.max_messages ? plan.max_messages.toLocaleString() : 'Unlimited'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Storage:</span>
                      <span className="font-medium">
                        {plan.max_storage_gb ? `${plan.max_storage_gb} GB` : 'Unlimited'}
                      </span>
                    </div>
                  </div>

                  {plan.features && plan.features.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-slate-400 mb-2">Features:</p>
                      <ul className="space-y-1">
                        {plan.features.map((feature: string, idx: number) => (
                          <li key={idx} className="text-sm text-slate-300 flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-400" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-white/5">
                    <button
                      onClick={() => startEdit(plan)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface PlanFormProps {
  formData: Partial<SubscriptionPlan>;
  setFormData: (data: Partial<SubscriptionPlan>) => void;
  onSave: () => void;
  onCancel: () => void;
}

const PlanForm: React.FC<PlanFormProps> = ({ formData, setFormData, onSave, onCancel }) => {
  const [featureInput, setFeatureInput] = useState('');

  const addFeature = () => {
    if (featureInput.trim()) {
      setFormData({
        ...formData,
        features: [...(formData.features || []), featureInput.trim()],
      });
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    const newFeatures = [...(formData.features || [])];
    newFeatures.splice(index, 1);
    setFormData({ ...formData, features: newFeatures });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Plan Name</label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          placeholder="e.g., Pro Plan"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          placeholder="Plan description"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Monthly Price (USD)</label>
          <input
            type="number"
            value={formData.price_monthly || 0}
            onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Yearly Price (USD)</label>
          <input
            type="number"
            value={formData.price_yearly || 0}
            onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Max Bots</label>
          <input
            type="number"
            value={formData.max_bots ?? ''}
            onChange={(e) => setFormData({ ...formData, max_bots: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="Unlimited"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Max Messages</label>
          <input
            type="number"
            value={formData.max_messages ?? ''}
            onChange={(e) => setFormData({ ...formData, max_messages: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="Unlimited"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Storage (GB)</label>
          <input
            type="number"
            value={formData.max_storage_gb ?? ''}
            onChange={(e) => setFormData({ ...formData, max_storage_gb: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="Unlimited"
            min="0"
            step="0.1"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Features</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={featureInput}
            onChange={(e) => setFeatureInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addFeature()}
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="Add a feature"
          />
          <button
            onClick={addFeature}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(formData.features || []).map((feature: string, idx: number) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm"
            >
              {feature}
              <button
                onClick={() => removeFeature(idx)}
                className="hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active ?? true}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="is_active" className="text-sm text-slate-300">Active</label>
      </div>

      <div className="flex gap-2 pt-4">
        <button
          onClick={onSave}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AdminPlans;

