import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Get allowed origins from environment or use default
const getAllowedOrigin = (): string => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (allowedOrigins) {
    return allowedOrigins;
  }
  // In production, restrict to specific origins
  // For development, allow all (can be overridden with env var)
  const env = Deno.env.get('ENVIRONMENT') || 'development';
  return env === 'production' ? '' : '*'; // Empty string means no CORS in production without config
};

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = getAllowedOrigin();
  const originHeader = origin && (allowedOrigin === '*' || allowedOrigin.split(',').includes(origin))
    ? origin
    : allowedOrigin === '*' ? '*' : (allowedOrigin.split(',')[0] || '*');
  
  return {
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    ...(originHeader !== '*' ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
  };
};

interface SiteSettings {
  smtp_config?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from_email: string;
    from_name: string;
  };
  site_config?: {
    site_name: string;
    site_url: string;
    support_email: string;
    maintenance_mode: boolean;
    allow_registration: boolean;
    header_scripts?: string;
  };
}

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
  
  // Handle CORS preflight
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

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Verify JWT and get user using anon key (required for user JWT validation)
    const token = authHeader.replace('Bearer ', '').trim();
    
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: authError?.message || 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is super admin
    const admin = await isSuperAdmin(supabase, user.id);
    if (!admin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      // Get all settings
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (req.method === 'PUT') {
      // Update settings
      const body: SiteSettings = await req.json();

      const updates: any[] = [];

      // Validate and sanitize SMTP config
      if (body.smtp_config) {
        // Validate SMTP config structure
        if (typeof body.smtp_config.host !== 'string' || body.smtp_config.host.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: 'Invalid SMTP host' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (typeof body.smtp_config.port !== 'number' || body.smtp_config.port < 1 || body.smtp_config.port > 65535) {
          return new Response(
            JSON.stringify({ error: 'Invalid SMTP port' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (body.smtp_config.from_email && !emailRegex.test(body.smtp_config.from_email)) {
          return new Response(
            JSON.stringify({ error: 'Invalid from_email format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Sanitize string inputs
        updates.push({
          key: 'smtp_config',
          value: {
            ...body.smtp_config,
            host: body.smtp_config.host.trim(),
            from_email: body.smtp_config.from_email?.trim() || '',
            from_name: body.smtp_config.from_name?.trim() || '',
            auth: {
              user: body.smtp_config.auth?.user?.trim() || '',
              pass: body.smtp_config.auth?.pass || '', // Don't trim password
            },
          },
          description: 'SMTP server configuration for sending emails',
          category: 'smtp',
        });
      }

      // Validate and sanitize site config
      if (body.site_config) {
        // Validate email format if provided
        if (body.site_config.support_email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(body.site_config.support_email)) {
            return new Response(
              JSON.stringify({ error: 'Invalid support_email format' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        // Validate URL format if provided
        if (body.site_config.site_url && body.site_config.site_url.trim()) {
          try {
            new URL(body.site_config.site_url);
          } catch {
            return new Response(
              JSON.stringify({ error: 'Invalid site_url format' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        // Limit header_scripts length to prevent abuse
        if (body.site_config.header_scripts && body.site_config.header_scripts.length > 50000) {
          return new Response(
            JSON.stringify({ error: 'Header scripts too long (max 50,000 characters)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Sanitize string inputs
        updates.push({
          key: 'site_config',
          value: {
            ...body.site_config,
            site_name: body.site_config.site_name?.trim() || 'Aether AI',
            site_url: body.site_config.site_url?.trim() || '',
            support_email: body.site_config.support_email?.trim() || '',
            maintenance_mode: Boolean(body.site_config.maintenance_mode),
            allow_registration: Boolean(body.site_config.allow_registration),
            header_scripts: body.site_config.header_scripts || '',
          },
          description: 'General site configuration',
          category: 'general',
        });
      }

      if (updates.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No settings provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Upsert each setting
      for (const update of updates) {
        const { error } = await supabase
          .from('site_settings')
          .upsert(update, { onConflict: 'key' });

        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ message: 'Settings updated successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

