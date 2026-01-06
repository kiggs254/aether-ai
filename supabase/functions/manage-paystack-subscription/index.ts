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

    // Get Paystack secret key
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Server Error', message: 'Paystack configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const subscriptionId = pathParts[pathParts.length - 1];

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET': {
        // Get subscription status from Paystack
        if (!subscriptionId || subscriptionId === 'manage-paystack-subscription') {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Subscription ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get subscription from database
        const { data: subscription, error: subError } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('id', subscriptionId)
          .single();

        if (subError || !subscription) {
          return new Response(
            JSON.stringify({ error: 'Not Found', message: 'Subscription not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if user owns this subscription
        if (subscription.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If no Paystack subscription code, return database subscription
        if (!subscription.paystack_subscription_code) {
          return new Response(
            JSON.stringify({
              subscription: subscription,
              paystack_status: null,
              message: 'This subscription does not have auto-renewal enabled',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch subscription status from Paystack
        const paystackResponse = await fetch(
          `https://api.paystack.co/subscription/${subscription.paystack_subscription_code}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const paystackData = await paystackResponse.json();

        if (!paystackData.status || !paystackData.data) {
          return new Response(
            JSON.stringify({
              subscription: subscription,
              paystack_status: null,
              error: paystackData.message || 'Failed to fetch Paystack subscription',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            subscription: subscription,
            paystack_status: paystackData.data,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'PUT': {
        // Cancel or reactivate subscription
        if (!subscriptionId || subscriptionId === 'manage-paystack-subscription') {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Subscription ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const { action } = body; // 'cancel' or 'reactivate'

        // Get subscription from database
        const { data: subscription, error: subError } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('id', subscriptionId)
          .single();

        if (subError || !subscription) {
          return new Response(
            JSON.stringify({ error: 'Not Found', message: 'Subscription not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if user owns this subscription
        if (subscription.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (action === 'cancel') {
          // Cancel Paystack subscription if it exists
          if (subscription.paystack_subscription_code) {
            const cancelResponse = await fetch(
              `https://api.paystack.co/subscription/disable`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${paystackSecretKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  code: subscription.paystack_subscription_code,
                  token: subscription.paystack_subscription_code, // Paystack uses token field
                }),
              }
            );

            const cancelData = await cancelResponse.json();
            
            if (!cancelData.status) {
              console.error('Error cancelling Paystack subscription:', cancelData);
              // Continue to update database anyway
            }
          }

          // Update database subscription
          const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({
              cancel_at_period_end: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscriptionId);

          if (updateError) {
            return new Response(
              JSON.stringify({ error: 'Database Error', message: updateError.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Subscription will be cancelled at the end of the current billing period',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (action === 'reactivate') {
          // Reactivate Paystack subscription if it exists
          if (subscription.paystack_subscription_code) {
            const reactivateResponse = await fetch(
              `https://api.paystack.co/subscription/enable`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${paystackSecretKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  code: subscription.paystack_subscription_code,
                  token: subscription.paystack_subscription_code,
                }),
              }
            );

            const reactivateData = await reactivateResponse.json();
            
            if (!reactivateData.status) {
              console.error('Error reactivating Paystack subscription:', reactivateData);
              return new Response(
                JSON.stringify({ error: 'Paystack Error', message: reactivateData.message || 'Failed to reactivate subscription' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }

          // Update database subscription
          const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({
              cancel_at_period_end: false,
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscriptionId);

          if (updateError) {
            return new Response(
              JSON.stringify({ error: 'Database Error', message: updateError.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Subscription reactivated successfully',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Invalid action. Use "cancel" or "reactivate"' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      default: {
        return new Response(
          JSON.stringify({ error: 'Method Not Allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

  } catch (error) {
    console.error('Error in manage-paystack-subscription:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

