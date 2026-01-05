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

// Check if user is super admin
async function isSuperAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .single();

  return !error && !!data;
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

    // Check if user is super admin
    const adminCheck = await isSuperAdmin(supabase, user.id);
    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const subscriptionId = pathParts[pathParts.length - 1];
    const isTransactionsEndpoint = pathParts[pathParts.length - 1] === 'transactions';

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET': {
        if (isTransactionsEndpoint && pathParts.length >= 2) {
          // Get transaction history for a subscription
          const subId = pathParts[pathParts.length - 2];
          const { data, error } = await supabase
            .from('payment_transactions')
            .select(`
              *,
              subscription_plans (
                id,
                name
              )
            `)
            .eq('subscription_id', subId)
            .order('created_at', { ascending: false });

          if (error) {
            return new Response(
              JSON.stringify({ error: 'Database Error', message: error.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify(data),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (subscriptionId && subscriptionId !== 'manage-subscriptions') {
          // Get single subscription
          const { data, error } = await supabase
            .from('user_subscriptions')
            .select(`
              *,
              subscription_plans (
                id,
                name,
                description,
                price_monthly,
                price_yearly,
                features
              )
            `)
            .eq('id', subscriptionId)
            .single();

          if (error) {
            return new Response(
              JSON.stringify({ error: 'Not Found', message: 'Subscription not found' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Fetch user email separately
          let userEmail = null;
          try {
            const { data: userData } = await supabase.auth.admin.getUserById(data.user_id);
            userEmail = userData?.user?.email || null;
          } catch (err) {
            console.error('Error fetching user:', err);
          }

          return new Response(
            JSON.stringify({ ...data, user_email: userEmail }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // List all subscriptions with filters
          const searchParams = url.searchParams;
          const status = searchParams.get('status');
          const planId = searchParams.get('plan_id');
          const userId = searchParams.get('user_id');
          const limit = parseInt(searchParams.get('limit') || '50');
          const offset = parseInt(searchParams.get('offset') || '0');

          let query = supabase
            .from('user_subscriptions')
            .select(`
              *,
              subscription_plans (
                id,
                name,
                description,
                price_monthly,
                price_yearly
              )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (status) {
            query = query.eq('status', status);
          }
          if (planId) {
            query = query.eq('plan_id', planId);
          }
          if (userId) {
            query = query.eq('user_id', userId);
          }

          const { data, error, count } = await query;

          if (error) {
            console.error('Database error:', error);
            return new Response(
              JSON.stringify({ error: 'Database Error', message: error.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Fetch user emails separately since we can't join auth.users directly
          const subscriptionsWithUsers = await Promise.all(
            (data || []).map(async (sub: any) => {
              try {
                const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
                return {
                  ...sub,
                  user_email: userData?.user?.email || null,
                };
              } catch (err) {
                console.error('Error fetching user:', err);
                return {
                  ...sub,
                  user_email: null,
                };
              }
            })
          );

          return new Response(
            JSON.stringify({ data: subscriptionsWithUsers, count }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'PUT': {
        // Update subscription
        if (!subscriptionId || subscriptionId === 'manage-subscriptions') {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Subscription ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: any = await req.json();
        const allowedFields = ['status', 'plan_id', 'billing_cycle', 'cancel_at_period_end'];
        const filteredData: any = {};

        // Only allow specific fields to be updated
        for (const field of allowedFields) {
          if (updateData[field] !== undefined) {
            filteredData[field] = updateData[field];
          }
        }

        // Validate status if provided
        if (filteredData.status && !['active', 'cancelled', 'expired', 'past_due'].includes(filteredData.status)) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Invalid status' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate billing_cycle if provided
        if (filteredData.billing_cycle && !['monthly', 'yearly'].includes(filteredData.billing_cycle)) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Invalid billing_cycle' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If changing plan, validate plan exists
        if (filteredData.plan_id) {
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('id')
            .eq('id', filteredData.plan_id)
            .single();

          if (!plan) {
            return new Response(
              JSON.stringify({ error: 'Bad Request', message: 'Plan not found' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const { data, error } = await supabase
          .from('user_subscriptions')
          .update({
            ...filteredData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscriptionId)
          .select(`
            *,
            subscription_plans (
              id,
              name,
              description
            )
          `)
          .single();

        if (error) {
          console.error('Database error:', error);
          return new Response(
            JSON.stringify({ error: 'Database Error', message: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!data) {
          return new Response(
            JSON.stringify({ error: 'Not Found', message: 'Subscription not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch user email separately
        let userEmail = null;
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(data.user_id);
          userEmail = userData?.user?.email || null;
        } catch (err) {
          console.error('Error fetching user:', err);
        }

        return new Response(
          JSON.stringify({ ...data, user_email: userEmail }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ error: 'Method Not Allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

  } catch (error) {
    console.error('Error in manage-subscriptions:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

