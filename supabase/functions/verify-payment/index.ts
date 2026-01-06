import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Get CORS headers with origin validation
const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
  const env = Deno.env.get('ENVIRONMENT') || 'development';
  const allowAll = env === 'development' || allowedOrigins.length === 0;
  
  const originHeader = allowAll || (origin && allowedOrigins.includes(origin))
    ? (origin || '*')
    : allowedOrigins[0] || '*';
  
  return {
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { reference } = body;

    if (!reference) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'reference is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Paystack secret key
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Server Error', message: 'Paystack configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction with Paystack
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status || !paystackData.data) {
      return new Response(
        JSON.stringify({ 
          error: 'Verification Failed', 
          message: paystackData.message || 'Failed to verify payment',
          verified: false 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transaction = paystackData.data;
    const isSuccessful = transaction.status === 'success';

    // If payment is successful, update our database
    if (isSuccessful) {
      // Get transaction from our database
      const { data: dbTransaction, error: dbError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('paystack_reference', reference)
        .single();

      // If transaction doesn't exist, create it
      if (dbError || !dbTransaction) {
        const metadata = transaction.metadata || {};
        const user_id = metadata.user_id;
        const plan_id = metadata.plan_id;
        
        if (user_id && plan_id) {
          const { error: createError } = await supabase
            .from('payment_transactions')
            .insert({
              user_id: user_id,
              plan_id: plan_id,
              amount: transaction.amount ? transaction.amount / 100 : 0,
              currency: transaction.currency || 'USD',
              paystack_reference: reference,
              paystack_authorization_code: transaction.authorization?.authorization_code,
              payment_method: transaction.channel || 'card',
              status: 'success',
              metadata: metadata,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (createError) {
            console.error('Error creating transaction:', createError);
          }
        }
      }

      // Get transaction again (or use existing one)
      const { data: finalTransaction } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('paystack_reference', reference)
        .single();

      if (finalTransaction && finalTransaction.status !== 'success') {
        // Update transaction status
        await supabase
          .from('payment_transactions')
          .update({
            status: 'success',
            paystack_authorization_code: transaction.authorization?.authorization_code,
            payment_method: transaction.channel || 'card',
            updated_at: new Date().toISOString(),
          })
          .eq('paystack_reference', reference);

        // Get metadata from transaction
        const metadata = transaction.metadata || {};
        const user_id = metadata.user_id || finalTransaction.user_id;
        const plan_id = metadata.plan_id || finalTransaction.plan_id;
        const billing_cycle = metadata.billing_cycle || 'monthly';

        if (user_id && plan_id) {
          // Get plan details
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('id', plan_id)
            .single();

          if (plan) {
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
                paystack_customer_code: transaction.authorization?.customer_code || transaction.customer?.customer_code,
                cancel_at_period_end: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (subError) {
              console.error('Error creating subscription:', subError);
            } else if (subscription) {
            // Update transaction with subscription_id
            if (finalTransaction) {
              await supabase
                .from('payment_transactions')
                .update({
                  subscription_id: subscription.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('paystack_reference', reference);
            }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        verified: true,
        success: isSuccessful,
        status: transaction.status,
        message: isSuccessful ? 'Payment verified successfully' : 'Payment verification failed',
        data: {
          reference: transaction.reference,
          amount: transaction.amount ? transaction.amount / 100 : 0,
          currency: transaction.currency,
          status: transaction.status,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

