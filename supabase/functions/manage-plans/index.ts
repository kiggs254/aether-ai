import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Get CORS headers with origin validation
const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
  // Allow all origins in development, restrict in production
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

interface PlanData {
  name: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  features?: any[];
  max_bots?: number | null;
  max_messages?: number | null;
  max_storage_gb?: number | null;
  is_active?: boolean;
}

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
    const planId = pathParts[pathParts.length - 1];

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET': {
        if (planId && planId !== 'manage-plans') {
          // Get single plan
          const { data, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('id', planId)
            .single();

          if (error) {
            return new Response(
              JSON.stringify({ error: 'Not Found', message: 'Plan not found' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify(data),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // List all plans
          const { data, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .order('price_monthly', { ascending: true });

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
        }
      }

      case 'POST': {
        // Create new plan
        const planData: PlanData = await req.json();

        // Validate required fields
        if (!planData.name || planData.price_monthly === undefined || planData.price_yearly === undefined) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'name, price_monthly, and price_yearly are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Sanitize and validate name
        const sanitizedName = planData.name.trim();
        if (sanitizedName.length === 0 || sanitizedName.length > 100) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Name must be between 1 and 100 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate prices
        if (typeof planData.price_monthly !== 'number' || typeof planData.price_yearly !== 'number') {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Prices must be numbers' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (planData.price_monthly < 0 || planData.price_yearly < 0) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Prices must be non-negative' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (planData.price_monthly > 1000000 || planData.price_yearly > 10000000) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Prices exceed maximum allowed value' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate limits
        if (planData.max_bots !== null && planData.max_bots !== undefined) {
          if (typeof planData.max_bots !== 'number' || planData.max_bots < 0 || planData.max_bots > 1000000) {
            return new Response(
              JSON.stringify({ error: 'Bad Request', message: 'max_bots must be a number between 0 and 1,000,000' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        if (planData.max_messages !== null && planData.max_messages !== undefined) {
          if (typeof planData.max_messages !== 'number' || planData.max_messages < 0 || planData.max_messages > 1000000000) {
            return new Response(
              JSON.stringify({ error: 'Bad Request', message: 'max_messages must be a number between 0 and 1,000,000,000' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        if (planData.max_storage_gb !== null && planData.max_storage_gb !== undefined) {
          if (typeof planData.max_storage_gb !== 'number' || planData.max_storage_gb < 0 || planData.max_storage_gb > 100000) {
            return new Response(
              JSON.stringify({ error: 'Bad Request', message: 'max_storage_gb must be a number between 0 and 100,000' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const { data, error } = await supabase
          .from('subscription_plans')
          .insert({
            name: sanitizedName,
            description: planData.description?.trim() || null,
            price_monthly: planData.price_monthly,
            price_yearly: planData.price_yearly,
            features: Array.isArray(planData.features) ? planData.features : [],
            max_bots: planData.max_bots ?? null,
            max_messages: planData.max_messages ?? null,
            max_storage_gb: planData.max_storage_gb ?? null,
            is_active: planData.is_active !== undefined ? Boolean(planData.is_active) : true,
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Database Error', message: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(data),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'PUT': {
        // Update plan
        if (!planId || planId === 'manage-plans') {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Plan ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const planData: Partial<PlanData> = await req.json();

        // Check if plan has active subscriptions
        const { data: activeSubscriptions } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('plan_id', planId)
          .eq('status', 'active')
          .limit(1);

        // If trying to deactivate and has active subscriptions, prevent it
        if (planData.is_active === false && activeSubscriptions && activeSubscriptions.length > 0) {
          return new Response(
            JSON.stringify({ 
              error: 'Bad Request', 
              message: 'Cannot deactivate plan with active subscriptions' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate prices if provided
        if (planData.price_monthly !== undefined && planData.price_monthly < 0) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'price_monthly must be non-negative' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (planData.price_yearly !== undefined && planData.price_yearly < 0) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'price_yearly must be non-negative' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: any = {};
        if (planData.name !== undefined) updateData.name = planData.name;
        if (planData.description !== undefined) updateData.description = planData.description;
        if (planData.price_monthly !== undefined) updateData.price_monthly = planData.price_monthly;
        if (planData.price_yearly !== undefined) updateData.price_yearly = planData.price_yearly;
        if (planData.features !== undefined) updateData.features = planData.features;
        if (planData.max_bots !== undefined) updateData.max_bots = planData.max_bots;
        if (planData.max_messages !== undefined) updateData.max_messages = planData.max_messages;
        if (planData.max_storage_gb !== undefined) updateData.max_storage_gb = planData.max_storage_gb;
        if (planData.is_active !== undefined) updateData.is_active = planData.is_active;

        const { data, error } = await supabase
          .from('subscription_plans')
          .update(updateData)
          .eq('id', planId)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Database Error', message: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!data) {
          return new Response(
            JSON.stringify({ error: 'Not Found', message: 'Plan not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'DELETE': {
        // Soft delete plan (set is_active = false)
        if (!planId || planId === 'manage-plans') {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Plan ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if plan has active subscriptions
        const { data: activeSubscriptions } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('plan_id', planId)
          .eq('status', 'active')
          .limit(1);

        if (activeSubscriptions && activeSubscriptions.length > 0) {
          return new Response(
            JSON.stringify({ 
              error: 'Bad Request', 
              message: 'Cannot delete plan with active subscriptions' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('subscription_plans')
          .update({ is_active: false })
          .eq('id', planId)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Database Error', message: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!data) {
          return new Response(
            JSON.stringify({ error: 'Not Found', message: 'Plan not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ message: 'Plan deactivated successfully', data }),
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
    console.error('Error in manage-plans:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

