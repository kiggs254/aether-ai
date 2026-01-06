import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

// Get CORS headers with origin validation
// Note: Webhooks typically don't need CORS, but we keep it for consistency
const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
  const env = Deno.env.get('ENVIRONMENT') || 'development';
  const allowAll = env === 'development' || allowedOrigins.length === 0;
  
  const originHeader = allowAll || (origin && allowedOrigins.includes(origin))
    ? (origin || '*')
    : allowedOrigins[0] || '*';
  
  return {
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
};

interface PaystackEvent {
  event: string;
  data: {
    reference?: string;
    authorization?: {
      authorization_code?: string;
      customer_code?: string;
    };
    customer?: {
      customer_code?: string;
      email?: string;
    };
    subscription?: {
      subscription_code?: string;
      customer?: {
        customer_code?: string;
      };
    };
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: {
      user_id?: string;
      plan_id?: string;
      billing_cycle?: string;
    };
    [key: string]: any;
  };
}

// Verify Paystack webhook signature
async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Paystack uses HMAC SHA512 and the signature is hex-encoded
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );

    // Create HMAC signature
    const data = encoder.encode(payload);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
    
    // Convert to hex string
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Compare signatures (constant-time comparison)
    if (signatureHex.length !== signature.length) {
      return false;
    }
    
    let isValid = true;
    for (let i = 0; i < signature.length; i++) {
      if (signatureHex[i] !== signature[i]) {
        isValid = false;
      }
    }
    
    return isValid;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get webhook secret
    const webhookSecret = Deno.env.get('PAYSTACK_WEBHOOK_SECRET') || Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!webhookSecret) {
      console.error('Paystack webhook secret not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get signature from header
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Verify signature
    const isValid = await verifySignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse event data
    const event: PaystackEvent = JSON.parse(rawBody);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);


    // Handle different event types
    switch (event.event) {
      case 'charge.success': {
        await handleChargeSuccess(supabase, event);
        break;
      }
      case 'subscription.create': {
        await handleSubscriptionCreate(supabase, event);
        break;
      }
      case 'subscription.disable': {
        await handleSubscriptionDisable(supabase, event);
        break;
      }
      case 'invoice.create': {
        await handleInvoiceCreate(supabase, event);
        break;
      }
      case 'invoice.payment_failed': {
        await handlePaymentFailed(supabase, event);
        break;
      }
      case 'subscription.not_renew': {
        await handleSubscriptionNotRenew(supabase, event);
        break;
      }
      default: {
        console.log('Unhandled event type:', event.event);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleChargeSuccess(supabase: any, event: PaystackEvent) {
  const { data } = event;
  const reference = data.reference;
  const amount = data.amount ? data.amount / 100 : 0; // Convert from kobo
  const metadata = data.metadata || {};
  const user_id = metadata.user_id;
  const plan_id = metadata.plan_id;
  const billing_cycle = metadata.billing_cycle || 'monthly';
  const subscriptionCode = data.subscription?.subscription_code || metadata.paystack_subscription_code;

  console.log('Processing charge.success event:', {
    reference,
    amount,
    metadata,
    user_id,
    plan_id,
    billing_cycle,
    subscriptionCode,
    isRenewal: !!subscriptionCode,
  });

  if (!reference) {
    console.error('Missing reference in charge.success event');
    return;
  }

  // Check if transaction already processed (idempotency)
  const { data: existingTransaction } = await supabase
    .from('payment_transactions')
    .select('id, status')
    .eq('paystack_reference', reference)
    .single();

  if (existingTransaction && existingTransaction.status === 'success') {
    console.log('Transaction already processed:', reference);
    return;
  }

  // Update transaction status
  const { error: updateError } = await supabase
    .from('payment_transactions')
    .update({
      status: 'success',
      paystack_authorization_code: data.authorization?.authorization_code,
      payment_method: data.channel || 'card',
      updated_at: new Date().toISOString(),
    })
    .eq('paystack_reference', reference);

  if (updateError) {
    console.error('Error updating transaction:', updateError);
  }

  // If this is a subscription renewal, update the existing subscription
  if (subscriptionCode) {
    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('paystack_subscription_code', subscriptionCode)
      .single();

    if (existingSub) {
      // This is a renewal - update period dates
      const now = new Date();
      const periodStart = new Date(existingSub.current_period_end);
      let periodEnd = new Date(periodStart);
      
      if (existingSub.billing_cycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Update subscription period
      const { error: subUpdateError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('paystack_subscription_code', subscriptionCode);

      if (subUpdateError) {
        console.error('Error updating subscription period:', subUpdateError);
      } else {
        console.log('Subscription renewed successfully:', subscriptionCode);
      }

      // Update transaction with subscription_id
      await supabase
        .from('payment_transactions')
        .update({
          subscription_id: existingSub.id,
          updated_at: new Date().toISOString(),
        })
        .eq('paystack_reference', reference);

      return; // Renewal handled, exit early
    }
  }

  // This is a new subscription (initial payment)
  if (!user_id || !plan_id) {
    console.error('Missing required fields in charge.success event for new subscription:', {
      reference: !!reference,
      user_id: !!user_id,
      plan_id: !!plan_id,
      full_metadata: metadata,
      full_data: data,
    });
    return;
  }

  // Get plan details
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', plan_id)
    .single();

  if (!plan) {
    console.error('Plan not found:', plan_id);
    return;
  }

  // Check if we need to create a Paystack subscription
  const shouldCreateSubscription = metadata.is_subscription === true || metadata.create_subscription_after_payment === true;
  const paystackPlanCode = metadata.paystack_plan_code;
  const customerCode = metadata.paystack_customer_code || data.authorization?.customer_code || data.customer?.customer_code;
  const authorizationCode = data.authorization?.authorization_code;

  let paystackSubscriptionCode: string | null = null;

  // Create Paystack subscription if we have the required data
  if (shouldCreateSubscription && paystackPlanCode && customerCode && authorizationCode) {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (paystackSecretKey) {
      try {
        const createSubResponse = await fetch('https://api.paystack.co/subscription', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer: customerCode,
            plan: paystackPlanCode,
            authorization: authorizationCode,
            metadata: {
              user_id: user_id,
              plan_id: plan_id,
              billing_cycle: billing_cycle,
              plan_name: plan.name,
            },
          }),
        });

        const createSubData = await createSubResponse.json();

        if (createSubData.status && createSubData.data) {
          paystackSubscriptionCode = createSubData.data.subscription_code;
          console.log('Paystack subscription created:', paystackSubscriptionCode);
        } else {
          console.error('Failed to create Paystack subscription:', createSubData);
          // Continue anyway - we'll create the database subscription
        }
      } catch (error) {
        console.error('Error creating Paystack subscription:', error);
        // Continue anyway - we'll create the database subscription
      }
    }
  }

  // Calculate period dates
  const now = new Date();
  const periodStart = new Date(now);
  let periodEnd = new Date(now);
  
  if (billing_cycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Cancel existing active subscription
  const { error: cancelError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user_id)
    .eq('status', 'active');

  if (cancelError) {
    console.error('Error cancelling existing subscription:', cancelError);
  }

  // Create new subscription
  const { data: subscription, error: subError } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: user_id,
      plan_id: plan_id,
      status: 'active',
      billing_cycle: billing_cycle,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      paystack_customer_code: customerCode,
      paystack_subscription_code: paystackSubscriptionCode,
      cancel_at_period_end: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (subError) {
    console.error('Error creating subscription:', subError);
    console.error('Subscription data:', {
      user_id,
      plan_id,
      billing_cycle,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
    return;
  }

  if (!subscription || !subscription.id) {
    console.error('Subscription was not created - no ID returned');
    return;
  }

  console.log('Subscription created successfully:', subscription.id);

  // Update transaction with subscription_id
  const { error: updateTransactionError } = await supabase
    .from('payment_transactions')
    .update({
      subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    })
    .eq('paystack_reference', reference);

  if (updateTransactionError) {
    console.error('Error updating transaction with subscription_id:', updateTransactionError);
  } else {
    console.log('Transaction updated with subscription_id:', subscription.id);
  }
}

async function handleSubscriptionCreate(supabase: any, event: PaystackEvent) {
  const { data } = event;
  const subscriptionCode = data.subscription?.subscription_code;
  const customerCode = data.subscription?.customer?.customer_code || data.customer?.customer_code;
  const metadata = data.metadata || {};
  const user_id = metadata.user_id;

  if (!subscriptionCode || !user_id) {
    console.error('Missing required fields in subscription.create event');
    return;
  }

  // Update subscription with Paystack subscription code
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      paystack_subscription_code: subscriptionCode,
      paystack_customer_code: customerCode,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user_id)
    .eq('status', 'active');

  if (error) {
    console.error('Error updating subscription:', error);
  }
}

async function handleSubscriptionDisable(supabase: any, event: PaystackEvent) {
  const { data } = event;
  const subscriptionCode = data.subscription?.subscription_code;

  if (!subscriptionCode) {
    console.error('Missing subscription code in subscription.disable event');
    return;
  }

  // Update subscription status
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('paystack_subscription_code', subscriptionCode);

  if (error) {
    console.error('Error cancelling subscription:', error);
  }
}

async function handleInvoiceCreate(supabase: any, event: PaystackEvent) {
  const { data } = event;
  const subscriptionCode = data.subscription?.subscription_code;
  const invoiceCode = data.invoice?.invoice_code;
  const amount = data.amount ? data.amount / 100 : 0;

  console.log('Processing invoice.create event:', {
    subscriptionCode,
    invoiceCode,
    amount,
  });

  if (!subscriptionCode) {
    console.error('Missing subscription code in invoice.create event');
    return;
  }

  // Find subscription
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('paystack_subscription_code', subscriptionCode)
    .single();

  if (!subscription) {
    console.error('Subscription not found for invoice:', subscriptionCode);
    return;
  }

  // Create transaction record for the invoice
  const { error: transactionError } = await supabase
    .from('payment_transactions')
    .insert({
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      plan_id: subscription.plan_id,
      amount: amount,
      currency: 'USD',
      paystack_reference: invoiceCode || `inv_${Date.now()}`,
      status: 'pending',
      metadata: {
        invoice_code: invoiceCode,
        subscription_code: subscriptionCode,
        is_renewal: true,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (transactionError) {
    console.error('Error creating invoice transaction:', transactionError);
  } else {
    console.log('Invoice transaction created for subscription:', subscriptionCode);
  }
}

async function handlePaymentFailed(supabase: any, event: PaystackEvent) {
  const { data } = event;
  const subscriptionCode = data.subscription?.subscription_code;
  const reference = data.reference || data.invoice?.invoice_code;

  console.log('Processing payment failed event:', {
    subscriptionCode,
    reference,
  });

  // Update transaction status if reference exists
  if (reference) {
    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('paystack_reference', reference);

    if (updateError) {
      console.error('Error updating failed transaction:', updateError);
    }
  }

  // Update subscription status if subscription code exists
  if (subscriptionCode) {
    const { error: subUpdateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('paystack_subscription_code', subscriptionCode);

    if (subUpdateError) {
      console.error('Error updating subscription to past_due:', subUpdateError);
    } else {
      console.log('Subscription marked as past_due:', subscriptionCode);
    }
  }
}

async function handleSubscriptionNotRenew(supabase: any, event: PaystackEvent) {
  const { data } = event;
  const subscriptionCode = data.subscription?.subscription_code;

  console.log('Processing subscription.not_renew event:', {
    subscriptionCode,
  });

  if (!subscriptionCode) {
    console.error('Missing subscription code in subscription.not_renew event');
    return;
  }

  // Update subscription status to expired
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('paystack_subscription_code', subscriptionCode);

  if (error) {
    console.error('Error updating subscription to expired:', error);
  } else {
    console.log('Subscription marked as expired:', subscriptionCode);
  }
}

