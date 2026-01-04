import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InitializePaymentRequest {
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  callback_url?: string;
}

serve(async (req) => {
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
    const body: InitializePaymentRequest = await req.json();
    const { plan_id, billing_cycle, callback_url } = body;

    // Validate required fields
    if (!plan_id || !billing_cycle) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'plan_id and billing_cycle are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (billing_cycle !== 'monthly' && billing_cycle !== 'yearly') {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'billing_cycle must be "monthly" or "yearly"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Not Found', message: 'Plan not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate amount based on billing cycle
    const amount = billing_cycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
    
    if (amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Plan is free, no payment required' }),
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

    // Get user email for Paystack
    const { data: { user: userData } } = await supabase.auth.admin.getUserById(user.id);
    const email = userData?.email || user.email;
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'User email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique reference
    const reference = `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Initialize Paystack transaction
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // Convert to kobo (smallest currency unit)
        reference,
        currency: 'NGN',
        callback_url: callback_url || `${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/payment/callback`,
        metadata: {
          user_id: user.id,
          plan_id: plan_id,
          billing_cycle: billing_cycle,
          plan_name: plan.name,
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status || !paystackData.data) {
      console.error('Paystack error:', paystackData);
      return new Response(
        JSON.stringify({ error: 'Payment Error', message: paystackData.message || 'Failed to initialize payment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create pending transaction record
    const { error: transactionError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        plan_id: plan_id,
        amount: amount,
        currency: 'NGN',
        paystack_reference: reference,
        status: 'pending',
        metadata: {
          billing_cycle: billing_cycle,
          paystack_response: paystackData.data,
        },
      });

    if (transactionError) {
      console.error('Database error:', transactionError);
      // Continue anyway, payment was initialized
    }

    // Return authorization URL
    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: reference,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error initializing payment:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

