import React, { useState, useEffect } from 'react';
import { CreditCard, Check, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useModal } from './ModalContext';

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
}

interface PaymentFlowProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PaymentFlow: React.FC<PaymentFlowProps> = ({ onSuccess, onCancel }) => {
  const { showError, showSuccess } = useModal();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      showError('Failed to load plans', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedPlan) {
      showError('Please select a plan', 'Choose a subscription plan to continue');
      return;
    }

    try {
      setProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Authentication required', 'Please sign in to continue');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/initialize-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          billing_cycle: billingCycle,
          callback_url: `${window.location.origin}/payment/callback`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initialize payment');
      }

      const data = await response.json();
      
      if (data.authorization_url) {
        // Redirect to Paystack payment page
        window.location.href = data.authorization_url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error: any) {
      showError('Payment initialization failed', error.message);
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getPrice = (plan: SubscriptionPlan) => {
    return billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
  };

  const getSavings = (plan: SubscriptionPlan) => {
    if (billingCycle === 'yearly') {
      const monthlyTotal = plan.price_monthly * 12;
      const savings = monthlyTotal - plan.price_yearly;
      return savings > 0 ? savings : 0;
    }
    return 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Choose Your Plan</h1>
        <p className="text-slate-400">Select a subscription plan that fits your needs</p>
        <div className="mt-3 flex items-center gap-2 text-sm text-indigo-400">
          <CreditCard className="w-4 h-4" />
          <span>Your card will be saved for automatic renewal at the end of each billing period</span>
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            billingCycle === 'monthly'
              ? 'bg-indigo-600 text-white'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingCycle('yearly')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            billingCycle === 'yearly'
              ? 'bg-indigo-600 text-white'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
          }`}
        >
          Yearly
          {billingCycle === 'yearly' && (
            <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
              Save up to 20%
            </span>
          )}
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const price = getPrice(plan);
          const savings = getSavings(plan);
          const isSelected = selectedPlan?.id === plan.id;

          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan)}
              className={`glass-card p-6 rounded-2xl border cursor-pointer transition-all ${
                isSelected
                  ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-105'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-slate-400">{plan.description}</p>
                  )}
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{formatCurrency(price)}</span>
                  <span className="text-slate-400 text-sm">
                    /{billingCycle === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {savings > 0 && (
                  <p className="text-sm text-emerald-400 mt-1">
                    Save {formatCurrency(savings)} per year
                  </p>
                )}
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Bots:</span>
                  <span className="font-medium">{plan.max_bots ?? 'Unlimited'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Messages:</span>
                  <span className="font-medium">
                    {plan.max_messages ? plan.max_messages.toLocaleString() : 'Unlimited'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Storage:</span>
                  <span className="font-medium">
                    {plan.max_storage_gb ? `${plan.max_storage_gb} GB` : 'Unlimited'}
                  </span>
                </div>
              </div>

              {plan.features && plan.features.length > 0 && (
                <div className="mb-4 pt-4 border-t border-white/5">
                  <ul className="space-y-2">
                    {plan.features.map((feature: string, idx: number) => (
                      <li key={idx} className="text-sm text-slate-300 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {price === 0 ? (
                <div className="pt-4 border-t border-white/5">
                  <span className="text-sm text-slate-400">Current Plan</span>
                </div>
              ) : (
                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Auto-renewal enabled</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Payment Button */}
      <div className="flex items-center justify-center gap-4 pt-6">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handlePayment}
          disabled={!selectedPlan || processing || getPrice(selectedPlan) === 0}
          className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors font-medium"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              {selectedPlan && getPrice(selectedPlan) === 0
                ? 'Current Plan'
                : `Subscribe ${formatCurrency(selectedPlan ? getPrice(selectedPlan) : 0)}`}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>

      {!selectedPlan && (
        <div className="flex items-center justify-center gap-2 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Please select a plan to continue</span>
        </div>
      )}
    </div>
  );
};

export default PaymentFlow;

