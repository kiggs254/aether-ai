import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { checkRateLimit, getRateLimitHeaders } from './rateLimit.ts';

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

interface InitializePaymentRequest {
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  callback_url?: string;
}

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

    // Rate limiting: 10 payment initializations per minute per user
    const rateLimitResult = checkRateLimit(req, user.id, { maxRequests: 10, windowSeconds: 60 });
    
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many payment requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            ...getRateLimitHeaders(rateLimitResult),
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

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

    // Validate UUID format for plan_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(plan_id)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Invalid plan_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate billing cycle
    if (billing_cycle !== 'monthly' && billing_cycle !== 'yearly') {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'billing_cycle must be "monthly" or "yearly"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate callback URL if provided
    if (callback_url) {
      try {
        const url = new URL(callback_url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'callback_url must use http or https protocol' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch {
        return new Response(
          JSON.stringify({ error: 'Bad Request', message: 'Invalid callback_url format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

    // Check if user has existing Paystack customer
    let customerCode: string | null = null;
    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('paystack_customer_code')
      .eq('user_id', user.id)
      .not('paystack_customer_code', 'is', null)
      .limit(1)
      .single();

    if (existingSub?.paystack_customer_code) {
      customerCode = existingSub.paystack_customer_code;
    } else {
      // Check if customer exists in Paystack by email
      const customerCheckResponse = await fetch(`https://api.paystack.co/customer?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      const customerCheckData = await customerCheckResponse.json();
      
      if (customerCheckData.status && customerCheckData.data && customerCheckData.data.length > 0) {
        customerCode = customerCheckData.data[0].customer_code;
      } else {
        // Create new Paystack customer
        const createCustomerResponse = await fetch('https://api.paystack.co/customer', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            first_name: userData?.user_metadata?.first_name || '',
            last_name: userData?.user_metadata?.last_name || '',
            metadata: {
              user_id: user.id,
            },
          }),
        });

        const createCustomerData = await createCustomerResponse.json();
        
        if (!createCustomerData.status || !createCustomerData.data) {
          console.error('Paystack customer creation error:', createCustomerData);
          return new Response(
            JSON.stringify({ error: 'Payment Error', message: 'Failed to create customer account' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        customerCode = createCustomerData.data.customer_code;
      }
    }

    // Create or retrieve Paystack subscription plan
    const planName = plan.name.replace(/\s+/g, '_').toLowerCase();
    const planCode = `${planName}_${billing_cycle}`;
    let paystackPlanCode: string;

    // Check if plan exists
    const planCheckResponse = await fetch(`https://api.paystack.co/plan/${planCode}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const planCheckData = await planCheckResponse.json();

    if (planCheckData.status && planCheckData.data) {
      paystackPlanCode = planCheckData.data.plan_code;
    } else {
      // Create new Paystack plan
      const interval = billing_cycle === 'monthly' ? 'monthly' : 'annually';
      const createPlanResponse = await fetch('https://api.paystack.co/plan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${plan.name} (${billing_cycle})`,
          interval: interval,
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'USD',
          plan_code: planCode,
          description: plan.description || `${plan.name} subscription plan`,
        }),
      });

      const createPlanData = await createPlanResponse.json();

      if (!createPlanData.status || !createPlanData.data) {
        console.error('Paystack plan creation error:', createPlanData);
        return new Response(
          JSON.stringify({ error: 'Payment Error', message: 'Failed to create subscription plan' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      paystackPlanCode = createPlanData.data.plan_code;
    }

    // Create Paystack subscription
    const createSubscriptionResponse = await fetch('https://api.paystack.co/subscription', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: customerCode,
        plan: paystackPlanCode,
        authorization: null, // Will be set after card authorization
        metadata: {
          user_id: user.id,
          plan_id: plan_id,
          billing_cycle: billing_cycle,
          plan_name: plan.name,
        },
      }),
    });

    const subscriptionData = await createSubscriptionResponse.json();

    if (!subscriptionData.status || !subscriptionData.data) {
      console.error('Paystack subscription creation error:', subscriptionData);
      return new Response(
        JSON.stringify({ error: 'Payment Error', message: subscriptionData.message || 'Failed to create subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subscription = subscriptionData.data;
    const subscriptionCode = subscription.subscription_code;
    const authorizationUrl = subscription.authorization_url;

    // Generate unique reference for initial transaction
    const reference = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create pending transaction record with subscription info
    const { error: transactionError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        plan_id: plan_id,
        amount: amount,
        currency: 'USD',
        paystack_reference: reference,
        status: 'pending',
        metadata: {
          billing_cycle: billing_cycle,
          paystack_subscription_code: subscriptionCode,
          paystack_customer_code: customerCode,
          paystack_plan_code: paystackPlanCode,
          is_subscription: true,
        },
      });

    if (transactionError) {
      console.error('Database error:', transactionError);
      // Continue anyway, subscription was created
    }

    // Return subscription authorization URL
    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: authorizationUrl,
        subscription_code: subscriptionCode,
        customer_code: customerCode,
        reference: reference,
      }),
      { status: 200, headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error initializing payment:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

