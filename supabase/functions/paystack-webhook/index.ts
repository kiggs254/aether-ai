import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
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

    console.log('Processing Paystack event:', event.event);

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
      case 'invoice.payment_failed': {
        await handlePaymentFailed(supabase, event);
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

  if (!reference || !user_id || !plan_id) {
    console.error('Missing required fields in charge.success event');
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
  await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user_id)
    .eq('status', 'active');

  // Create or update subscription
  const { data: subscription, error: subError } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: user_id,
      plan_id: plan_id,
      status: 'active',
      billing_cycle: billing_cycle,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      paystack_customer_code: data.authorization?.customer_code || data.customer?.customer_code,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,status',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (subError) {
    console.error('Error creating subscription:', subError);
  } else {
    console.log('Subscription created/updated:', subscription?.id);
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

async function handlePaymentFailed(supabase: any, event: PaystackEvent) {
  const { data } = event;
  const subscriptionCode = data.subscription?.subscription_code;
  const reference = data.reference;

  // Update transaction status if reference exists
  if (reference) {
    await supabase
      .from('payment_transactions')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('paystack_reference', reference);
  }

  // Update subscription status if subscription code exists
  if (subscriptionCode) {
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('paystack_subscription_code', subscriptionCode);
  }
}

