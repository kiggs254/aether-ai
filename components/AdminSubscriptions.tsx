import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, Edit2, X, Check, Calendar, CreditCard, Loader2, AlertCircle, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from './Notification';
import { useAdminStatus } from '../lib/useAdminStatus';

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  subscription_plans?: {
    id: string;
    name: string;
    description: string;
    price_monthly: number;
    price_yearly: number;
  };
  auth?: {
    users?: {
      id: string;
      email: string;
    };
  };
}

const AdminSubscriptions: React.FC = () => {
  const { isAdmin, loading: adminLoading } = useAdminStatus();
  const { showError, showSuccess } = useNotification();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    plan_id: '',
    search: '',
  });
  const [plans, setPlans] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Subscription>>({});
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      loadSubscriptions();
      loadPlans();
    }
  }, [isAdmin, adminLoading, filters]);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      console.error('Error loading plans:', error);
    }
  };

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Authentication required', 'Please sign in to continue');
        return;
      }

      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.plan_id) params.append('plan_id', filters.plan_id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-subscriptions?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Subscription fetch error:', errorData);
        throw new Error(errorData.message || `Failed to load subscriptions: ${response.status}`);
      }

      const result = await response.json();
      console.log('Subscriptions response:', result);
      let data = result.data || result;
      
      // Handle case where data might be an array directly
      if (Array.isArray(result) && !result.data) {
        data = result;
      }

      // Apply search filter client-side
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        data = data.filter((sub: Subscription) => {
          const email = sub.auth?.users?.email || '';
          const planName = sub.subscription_plans?.name || '';
          return email.toLowerCase().includes(searchLower) || planName.toLowerCase().includes(searchLower);
        });
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.log('No subscriptions data returned');
      }
      
      setSubscriptions(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error loading subscriptions:', error);
      showError('Failed to load subscriptions', error.message || 'Please check the console for details');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (subscriptionId: string) => {
    try {
      setLoadingTransactions(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-subscriptions/${subscriptionId}/transactions`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to load transactions');

      const data = await response.json();
      setTransactions(data || []);
    } catch (error: any) {
      showError('Failed to load transactions', error.message);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Authentication required', 'Please sign in to continue');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-subscriptions/${id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update subscription');
      }

      showSuccess('Subscription updated', 'The subscription has been updated successfully');
      setEditingId(null);
      setEditData({});
      loadSubscriptions();
    } catch (error: any) {
      showError('Failed to update subscription', error.message);
    }
  };

  const startEdit = (subscription: Subscription) => {
    setEditingId(subscription.id);
    setEditData({
      status: subscription.status,
      plan_id: subscription.plan_id,
      billing_cycle: subscription.billing_cycle,
      cancel_at_period_end: subscription.cancel_at_period_end,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
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
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400';
      case 'past_due':
        return 'bg-orange-500/20 text-orange-400';
      case 'expired':
        return 'bg-slate-500/20 text-slate-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
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
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">User Subscriptions</h1>
        <p className="text-slate-400">Manage all user subscriptions and billing</p>
      </div>

      {/* Filters */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by email or plan..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="past_due">Past Due</option>
            <option value="expired">Expired</option>
          </select>
          <select
            value={filters.plan_id}
            onChange={(e) => setFilters({ ...filters, plan_id: e.target.value })}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Plans</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Subscriptions Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Billing</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {subscription.user_email || subscription.user_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {subscription.subscription_plans?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {subscription.billing_cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                        {subscription.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {formatCurrency(
                          subscription.billing_cycle === 'monthly'
                            ? subscription.subscription_plans?.price_monthly || 0
                            : subscription.subscription_plans?.price_yearly || 0
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">
                        {formatDate(subscription.current_period_end)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedSubscription(subscription);
                            loadTransactions(subscription.id);
                          }}
                          className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                          title="View transactions"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {editingId === subscription.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(subscription.id)}
                              className="p-2 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEdit(subscription)}
                            className="p-2 hover:bg-indigo-500/20 rounded-lg text-indigo-400 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {subscriptions.length === 0 && !loading && (
              <div className="text-center py-12 text-slate-400">
                <p className="mb-2">No subscriptions found</p>
                <p className="text-sm text-slate-500">
                  {isAdmin ? 'There are no subscriptions in the system yet.' : 'You do not have access to view subscriptions.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Edit Subscription</h2>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
              <select
                value={editData.status || ''}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="past_due">Past Due</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Plan</label>
              <select
                value={editData.plan_id || ''}
                onChange={(e) => setEditData({ ...editData, plan_id: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Billing Cycle</label>
              <select
                value={editData.billing_cycle || ''}
                onChange={(e) => setEditData({ ...editData, billing_cycle: e.target.value as 'monthly' | 'yearly' })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cancel_at_period_end"
                checked={editData.cancel_at_period_end || false}
                onChange={(e) => setEditData({ ...editData, cancel_at_period_end: e.target.checked })}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-600"
              />
              <label htmlFor="cancel_at_period_end" className="text-sm text-slate-300">
                Cancel at period end
              </label>
            </div>
            <div className="flex gap-2 pt-4">
              <button
                onClick={() => handleUpdate(editingId)}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Modal */}
      {selectedSubscription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Transaction History</h2>
              <button
                onClick={() => {
                  setSelectedSubscription(null);
                  setTransactions([]);
                }}
                className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No transactions found</div>
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
                      <p className="text-slate-400 text-sm">{formatDate(transaction.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">{formatCurrency(transaction.amount)}</p>
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
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptions;

