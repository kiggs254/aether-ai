import React, { useEffect, useState } from 'react';
import { useNotification } from './Notification';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAdminStatus } from '../lib/useAdminStatus';

interface PaymentCallbackProps {
  onComplete: () => void;
}

const PaymentCallback: React.FC<PaymentCallbackProps> = ({ onComplete }) => {
  const { showSuccess, showError } = useNotification();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Verifying payment...');
  const { isAdmin } = useAdminStatus();

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Get reference from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const reference = urlParams.get('reference') || urlParams.get('trxref');

        if (!reference) {
          setStatus('error');
          setMessage('No payment reference found in URL');
          showError('Payment verification failed', 'No reference found');
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
          return;
        }

        // Verify payment with Paystack via our edge function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus('error');
          setMessage('Please sign in to verify your payment');
          showError('Authentication required', 'Please sign in first');
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
          return;
        }

        // Verify payment by checking transaction in our database
        // The webhook should have already processed the payment
        const { data: transaction, error: transactionError } = await supabase
          .from('payment_transactions')
          .select('*, subscription_plans(name)')
          .eq('paystack_reference', reference)
          .single();

        if (transactionError || !transaction) {
          setStatus('error');
          setMessage('Payment transaction not found. The webhook may still be processing.');
          showError('Payment verification', 'Transaction not found. Please wait a moment and check your subscription status.');
          setTimeout(() => {
            window.location.href = '/';
          }, 5000);
          return;
        }

        // Check transaction status
        if (transaction.status === 'success') {
          setStatus('success');
          setMessage(`Payment successful! Your subscription to ${transaction.subscription_plans?.name || 'the plan'} is now active.`);
          showSuccess('Payment successful!', 'Your subscription has been activated.');
          
          // Redirect to dashboard after 3 seconds
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        } else if (transaction.status === 'failed') {
          setStatus('error');
          setMessage('Payment failed. Please try again.');
          showError('Payment failed', 'Your payment could not be processed. Please try again.');
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        } else {
          // Still pending - webhook may still be processing
          setStatus('loading');
          setMessage('Payment is being processed. Please wait...');
          
          // Wait a bit and check again
          setTimeout(async () => {
            const { data: updatedTransaction } = await supabase
              .from('payment_transactions')
              .select('*, subscription_plans(name)')
              .eq('paystack_reference', reference)
              .single();

            if (updatedTransaction?.status === 'success') {
              setStatus('success');
              setMessage(`Payment successful! Your subscription is now active.`);
              showSuccess('Payment successful!', 'Your subscription has been activated.');
              setTimeout(() => {
                window.location.href = '/';
              }, 3000);
            } else {
              setStatus('error');
              setMessage('Payment is still being processed. Please check your subscription status in a few moments.');
              showError('Payment processing', 'Your payment is being processed. Please check back in a few moments.');
              setTimeout(() => {
                window.location.href = '/';
              }, 5000);
            }
          }, 3000);
        }
      } catch (error: any) {
        console.error('Payment verification error:', error);
        setStatus('error');
        setMessage('An error occurred while verifying your payment. Please contact support.');
        showError('Verification error', error.message || 'Please contact support if the issue persists.');
        setTimeout(() => {
          window.location.href = '/';
        }, 5000);
      }
    };

    verifyPayment();
  }, [showSuccess, showError]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="glass-card p-8 sm:p-12 rounded-3xl max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Processing Payment</h2>
            <p className="text-slate-400">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
            <p className="text-slate-400 mb-6">{message}</p>
            <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Payment Verification Failed</h2>
            <p className="text-slate-400 mb-6">{message}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;

