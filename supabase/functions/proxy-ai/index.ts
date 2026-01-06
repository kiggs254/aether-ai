import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, getRateLimitHeaders } from './rateLimit.ts';

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

async function validateBotAccess(
  supabase: any,
  botId: string,
  userId: string | null
): Promise<{ valid: boolean; error?: string }> {
  if (!botId) return { valid: false, error: 'Bot ID is required' };

  try {
    const { data: botData, error: botError } = await supabase
      .from('bots')
      .select('id, user_id')
      .eq('id', botId)
      .single();

    if (botError || !botData) return { valid: false, error: 'Bot not found' };

    if (userId && botData.user_id !== userId) {
      return { valid: false, error: 'Access denied: You do not own this bot' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Error validating bot access' };
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Rate limiting: Check before processing
    // For authenticated users: 100 requests per minute
    // For anonymous users: 30 requests per minute
    // Get user ID first for rate limiting
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '').trim();
        const authClient = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user } } = await authClient.auth.getUser(token);
        if (user) userId = user.id;
      } catch (e) { /* ignore auth errors */ }
    }

    // Apply rate limiting based on authentication status
    const rateLimitOptions = userId
      ? { maxRequests: 100, windowSeconds: 60 } // Authenticated: 100/min
      : { maxRequests: 30, windowSeconds: 60 }; // Anonymous: 30/min
    
    const rateLimitResult = checkRateLimit(req, userId, rateLimitOptions);
    
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
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

    // Store rate limit headers for successful responses
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { action, bot, history = [], message } = body;

    if (!action || !bot?.id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action and bot are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const botValidation = await validateBotAccess(supabase, bot.id, userId);
    if (!botValidation.valid) {
      return new Response(
        JSON.stringify({ error: botValidation.error || 'Invalid bot access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate bot structure
    if (bot.actions !== undefined && !Array.isArray(bot.actions)) {
      bot.actions = [];
    }
    if (bot.ecommerceEnabled !== undefined && typeof bot.ecommerceEnabled !== 'boolean') {
      bot.ecommerceEnabled = false;
    }

    const provider = bot.provider || 'gemini';
    if (provider !== 'gemini' && provider !== 'openai' && provider !== 'deepseek') {
      return new Response(
        JSON.stringify({ error: `Invalid provider: ${provider}. Must be 'gemini', 'openai', or 'deepseek'` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate model access based on subscription plan
    if (userId) {
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            allowed_models,
            max_messages
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (subscription?.subscription_plans) {
        const plan = subscription.subscription_plans;
        const allowedModels = Array.isArray(plan.allowed_models) ? plan.allowed_models : (plan.allowed_models ? JSON.parse(plan.allowed_models as any) : []);
        
        // Map model to identifier
        const getModelIdentifier = (provider: string, model: string): string => {
          if (provider === 'deepseek') {
            if (model.includes('reasoner') || model.includes('reasoning')) return 'deepseek-reasoning';
            return 'deepseek-fast';
          }
          if (provider === 'openai') {
            if (model.includes('o1') || model.includes('o3') || model.includes('reasoning')) return 'openai-reasoning';
            return 'openai-fast';
          }
          if (provider === 'gemini') {
            if (model.includes('thinking') || model.includes('reasoning')) return 'gemini-reasoning';
            return 'gemini-fast';
          }
          return `${provider}-fast`;
        };

        const modelIdentifier = getModelIdentifier(provider, bot.model || '');
        if (allowedModels.length > 0 && !allowedModels.includes(modelIdentifier)) {
          return new Response(
            JSON.stringify({ 
              error: 'Model not available', 
              message: `The selected model is not available in your plan. Please select an allowed model or upgrade your plan.` 
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check message limit (if not unlimited)
        if (plan.max_messages !== null && plan.max_messages !== undefined) {
          // Get current period usage
          const { data: usage } = await supabase
            .from('user_usage')
            .select('messages_count')
            .eq('user_id', userId)
            .eq('subscription_id', subscription.id)
            .gte('period_start', subscription.current_period_start)
            .lte('period_end', subscription.current_period_end)
            .maybeSingle();

          const currentUsage = usage?.messages_count || 0;
          if (currentUsage >= plan.max_messages) {
            return new Response(
              JSON.stringify({ 
                error: 'Message limit exceeded', 
                message: `You've reached your monthly message limit of ${plan.max_messages.toLocaleString()}. Please upgrade your plan or wait for the next billing period.` 
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Increment message count (using the function from migration)
          await supabase.rpc('increment_message_count', { 
            p_user_id: userId, 
            p_count: 1 
          });
        }
      }
    }

    const systemInstruction = buildSystemInstruction(bot);

    if (action === 'chat-stream') {
      if (provider === 'deepseek') {
        const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
        if (!deepseekApiKey) {
          return new Response(
            JSON.stringify({ error: 'DeepSeek API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const messages = [
          { role: 'system', content: systemInstruction },
          ...history.map((h: any) => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
          { role: 'user', content: message }
        ];

        const tools = buildOpenAITools(bot);
        const requestBody: any = {
          model: bot.model || 'deepseek-chat',
          messages,
          stream: true,
          temperature: bot.temperature ?? 0.7,
        };
        if (tools) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
        }

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekApiKey}` },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok || !response.body) {
          const error = await response.text().catch(() => 'Unknown error');
          return new Response(
            JSON.stringify({ error: `DeepSeek API error: ${error}` }),
            { status: response.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Transform DeepSeek SSE to expected format
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              let accumulatedFunctionCalls: any = {};
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  if (Object.keys(accumulatedFunctionCalls).length > 0) {
                    const functionCalls = Object.values(accumulatedFunctionCalls).map((fc: any) => ({
                      name: fc.name,
                      args: fc.args ? JSON.parse(fc.args) : {}
                    }));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                  }
                  break;
                }
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const data = JSON.parse(line.slice(6));
                      const delta = data.choices?.[0]?.delta;
                      if (delta?.content) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`));
                      }
                      if (delta?.tool_calls) {
                        for (const toolCall of delta.tool_calls) {
                          const index = toolCall.index;
                          if (!accumulatedFunctionCalls[index]) {
                            accumulatedFunctionCalls[index] = { name: '', args: '' };
                          }
                          if (toolCall.function?.name) {
                            accumulatedFunctionCalls[index].name = toolCall.function.name;
                          }
                          if (toolCall.function?.arguments) {
                            accumulatedFunctionCalls[index].args += toolCall.function.arguments;
                          }
                        }
                      }
                    } catch (e) { /* skip invalid JSON */ }
                  }
                }
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return new Response(stream, {
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        });

      } else if (provider === 'openai') {
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) {
          return new Response(
            JSON.stringify({ error: 'OpenAI API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const messages = [
          { role: 'system', content: systemInstruction },
          ...history.map((h: any) => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
          { role: 'user', content: message }
        ];

        const tools = buildOpenAITools(bot);
        const requestBody: any = {
          model: bot.model || 'gpt-4',
          messages,
          stream: true,
          temperature: bot.temperature ?? 0.7,
        };
        if (tools) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok || !response.body) {
          const error = await response.text().catch(() => 'Unknown error');
          return new Response(
            JSON.stringify({ error: `OpenAI API error: ${error}` }),
            { status: response.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Transform OpenAI SSE to expected format
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              let accumulatedFunctionCalls: any = {};
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  if (Object.keys(accumulatedFunctionCalls).length > 0) {
                    const functionCalls = Object.values(accumulatedFunctionCalls).map((fc: any) => ({
                      name: fc.name,
                      args: fc.args ? JSON.parse(fc.args) : {}
                    }));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                  }
                  break;
                }
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const data = JSON.parse(line.slice(6));
                      const delta = data.choices?.[0]?.delta;
                      if (delta?.content) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`));
                      }
                      if (delta?.tool_calls) {
                        for (const toolCall of delta.tool_calls) {
                          const index = toolCall.index;
                          if (!accumulatedFunctionCalls[index]) {
                            accumulatedFunctionCalls[index] = { name: '', args: '' };
                          }
                          if (toolCall.function?.name) {
                            accumulatedFunctionCalls[index].name = toolCall.function.name;
                          }
                          if (toolCall.function?.arguments) {
                            accumulatedFunctionCalls[index].args += toolCall.function.arguments;
                          }
                        }
                      }
                    } catch (e) { /* skip invalid JSON */ }
                  }
                }
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return new Response(stream, {
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        });

      } else {
        // GEMINI STREAMING
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
          return new Response(
            JSON.stringify({ error: 'Gemini API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!message || typeof message !== 'string' || message.trim() === '') {
          return new Response(
            JSON.stringify({ error: 'Message is required and cannot be empty' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const tools = buildGeminiTools(bot);
        const requestBody: any = {
          contents: [
            ...history.map((h: any) => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: String(h.text || '') }] })),
            { role: 'user', parts: [{ text: message }] }
          ],
          generationConfig: { temperature: bot.temperature ?? 0.7 },
        };
        
        if (systemInstruction) {
          requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
        }
        
        if (tools && tools.length > 0) {
          requestBody.tools = tools;
          requestBody.tool_config = { function_calling_config: { mode: 'AUTO' } };
        }

        const modelName = bot.model || 'gemini-2.5-flash';
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${modelName}:streamGenerateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
            return new Response(
              JSON.stringify({ error: `Gemini API error: ${errorText}` }),
              { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

      if (!response.body) {
        return new Response(
          JSON.stringify({ error: 'No response body from Gemini API' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

        // Transform Gemini SSE to expected format
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
                if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                      const data = JSON.parse(line.slice(6));
                    if (data.candidates && data.candidates[0]) {
                      const candidate = data.candidates[0];
                      if (candidate.content?.parts) {
                        for (const part of candidate.content.parts) {
                          if (part.functionCall) {
                            const functionCalls = [{
                              name: part.functionCall.name,
                              args: part.functionCall.args || {}
                            }];
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                          } else if (part.text) {
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`));
                            }
                          }
                        }
                        if (candidate.delta?.text) {
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: candidate.delta.text })}\n\n`));
                        }
                        if (candidate.delta?.functionCall) {
                              const functionCalls = [{
                            name: candidate.delta.functionCall.name,
                            args: candidate.delta.functionCall.args || {}
                              }];
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                        }
                      }
                    } catch (e) { /* skip invalid JSON */ }
                  }
                }
              }
              
              // Process remaining buffer
              if (buffer.trim()) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                  if (line.trim() === '') continue;
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const data = JSON.parse(line.slice(6));
                      if (data.candidates && data.candidates[0]?.content?.parts) {
                        for (const part of data.candidates[0].content.parts) {
                          if (part.functionCall) {
                            const functionCalls = [{
                              name: part.functionCall.name,
                              args: part.functionCall.args || {}
                            }];
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                          } else if (part.text) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`));
                          }
                        }
                      }
                    } catch (e) { /* skip invalid JSON */ }
                }
              }
            }
            
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
      }
    } else if (action === 'chat') {
      // NON-STREAMING CHAT
      if (provider === 'openai') {
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) {
          return new Response(
            JSON.stringify({ error: 'OpenAI API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const messages = [
          { role: 'system', content: systemInstruction },
          ...history.map((h: any) => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
          { role: 'user', content: message }
        ];

        const tools = buildOpenAITools(bot);
        const requestBody: any = {
          model: bot.model || 'gpt-4',
          messages,
          temperature: bot.temperature ?? 0.7,
        };
        if (tools) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const error = await response.text().catch(() => 'Unknown error');
          return new Response(
            JSON.stringify({ error: `OpenAI API error: ${error}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: data.choices?.[0]?.message?.content || ''
              }]
            }
          }]
          }),
          { headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Default to Gemini non-streaming
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
          return new Response(
            JSON.stringify({ error: 'Gemini API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!message || typeof message !== 'string' || message.trim() === '') {
          return new Response(
            JSON.stringify({ error: 'Message is required and cannot be empty' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const tools = buildGeminiTools(bot);
        const requestBody: any = {
          contents: [
            ...history.map((h: any) => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: String(h.text || '') }] })),
            { role: 'user', parts: [{ text: message }] }
          ],
          generationConfig: { temperature: bot.temperature ?? 0.7 },
        };
        
        if (systemInstruction) {
          requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
        }
        
        if (tools && tools.length > 0) {
          requestBody.tools = tools;
          requestBody.tool_config = { function_calling_config: { mode: 'AUTO' } };
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${bot.model || 'gemini-2.5-flash'}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
            return new Response(
              JSON.stringify({ error: `Gemini API error: ${errorText}` }),
              { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildSystemInstruction(bot: any): string {
  let actionListText = '';
  if (bot.actions && Array.isArray(bot.actions) && bot.actions.length > 0) {
    actionListText = '\n\nAVAILABLE CUSTOM ACTIONS:\n';
    bot.actions.forEach((a: any) => {
      actionListText += `- Action ID: "${a.id}" | Type: ${a.type} | Description: "${a.description || 'No description'}"\n`;
    });
    actionListText += '\nYOU MUST check if the user\'s message matches ANY of these actions FIRST before doing anything else.\n';
  }

  let instruction = `
    You are ${bot.name}. ${bot.systemInstruction}
    
    Here is your core knowledge base/training data:
    ---
    ${bot.knowledgeBase || ''}
    ---
    
    ⚠️ CRITICAL: YOU HAVE ACCESS TO INTERACTIVE UI TOOLS/ACTIONS. YOU MUST USE THEM WHEN APPROPRIATE. ⚠️
    ${actionListText}
    
    MANDATORY PRIORITY ORDER (DO NOT VIOLATE):
    1. FIRST: Check if user's message matches ANY custom action above - if YES, YOU MUST call trigger_action with that action_id IMMEDIATELY
    2. SECOND: Only if NO custom action matches, then proceed with other functions (like recommend_products)
    3. NEVER skip checking actions - they take ABSOLUTE PRIORITY
  `;

  if (bot.ecommerceEnabled) {
    instruction += `
    
    ⚠️ E-COMMERCE MODE ENABLED ⚠️
    YOU HAVE ACCESS TO A REAL PRODUCT CATALOG. YOU CANNOT KNOW WHAT PRODUCTS EXIST WITHOUT CALLING THE recommend_products FUNCTION.
    
    CRITICAL PRIORITY ORDER:
    1. FIRST: Check if ANY custom action (trigger_action) matches the user's intent - if yes, ALWAYS use that action
    2. SECOND: Only if NO custom action matches, then use recommend_products
    3. NEVER recommend products if a custom action is appropriate
    
    ABSOLUTE RULES:
    1. NEVER describe, list, or mention ANY products by name, price, or details UNLESS you have called recommend_products first
    2. NEVER make up product names, brands, prices, or features
    3. If a user asks about ANY product, you MUST call recommend_products BEFORE responding (but only if no custom action is appropriate)
    `;
  }

  instruction += `\n\nIf the answer is not in the knowledge base, use your general knowledge but mention you are not explicitly trained on that specific detail if it seems obscure. Keep responses concise and helpful.`;

  return instruction;
}

function buildOpenAITools(bot: any): any[] | undefined {
  const tools: any[] = [];

  if (bot.actions && Array.isArray(bot.actions) && bot.actions.length > 0) {
    const actionList = bot.actions.map((a: any) => {
      return `- Action ID: "${a.id}" | Type: ${a.type} | Description: "${a.description || 'No description'}"`;
    }).join('\n');

    tools.push({
      type: 'function',
      function: {
        name: 'trigger_action',
        description: `⚠️ MANDATORY FUNCTION FOR ACTIONS ⚠️ Triggers a custom UI action. YOU MUST call this when the user's message matches ANY of the available actions:\n\n${actionList}\n\nCRITICAL: Check actions FIRST before calling recommend_products. Actions take ABSOLUTE PRIORITY.`,
        parameters: {
          type: 'object',
          properties: {
            action_id: {
              type: 'string',
              description: `The ID of the action to trigger. Must be one of: ${bot.actions.map((a: any) => a.id).join(', ')}`
            }
          },
          required: ['action_id']
        }
      }
    });
  }

  if (bot.ecommerceEnabled) {
    const settings = bot.ecommerceSettings || {};
    const maxResults = settings.maxProductsToRecommend || 10;

    tools.push({
      type: 'function',
      function: {
        name: 'recommend_products',
        description: '⚠️ MANDATORY FUNCTION ⚠️ You MUST call this function to get REAL products from the catalog. DO NOT describe or list products without calling this function first. Call this immediately when users ask about products. NEVER make up products.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Product category to filter by' },
            price_min: { type: 'number', description: 'Minimum price' },
            price_max: { type: 'number', description: 'Maximum price' },
            keywords: { type: 'array', items: { type: 'string' }, description: 'Keywords to search for' },
            max_results: { type: 'number', description: `Maximum number of products (default: ${maxResults}, max: ${maxResults})` }
          },
          required: []
        }
      }
    });
  }

  return tools.length > 0 ? tools : undefined;
}

function buildGeminiTools(bot: any): any[] | undefined {
  const functionDeclarations: any[] = [];

  if (bot.actions && Array.isArray(bot.actions) && bot.actions.length > 0) {
    const actionList = bot.actions.map((a: any) => {
      return `- Action ID: "${a.id}" | Type: ${a.type} | Description: "${a.description || 'No description'}"`;
    }).join('\n');

    functionDeclarations.push({
      name: 'trigger_action',
      description: `⚠️ MANDATORY FUNCTION FOR ACTIONS ⚠️ Triggers a custom UI action. YOU MUST call this when the user's message matches ANY of the available actions:\n\n${actionList}\n\nCRITICAL: Check actions FIRST before calling recommend_products. Actions take ABSOLUTE PRIORITY.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          action_id: {
            type: 'STRING',
            description: `The ID of the action to trigger. Must be one of: ${bot.actions.map((a: any) => a.id).join(', ')}`
          }
        },
        required: ['action_id']
      }
    });
  }

  if (bot.ecommerceEnabled) {
    const settings = bot.ecommerceSettings || {};
    const maxResults = settings.maxProductsToRecommend || 10;

    functionDeclarations.push({
      name: 'recommend_products',
      description: '⚠️ MANDATORY FUNCTION ⚠️ You MUST call this function to get REAL products from the catalog. DO NOT describe or list products without calling this function first. Call this immediately when users ask about products. NEVER make up products.',
      parameters: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', description: 'Product category to filter by' },
          price_min: { type: 'NUMBER', description: 'Minimum price' },
          price_max: { type: 'NUMBER', description: 'Maximum price' },
          keywords: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Keywords to search for' },
          max_results: { type: 'NUMBER', description: `Maximum number of products (default: ${maxResults}, max: ${maxResults})` }
        },
        required: []
      }
    });
  }

  if (functionDeclarations.length > 0) {
    return [{ function_declarations: functionDeclarations }];
  }
  
  return undefined;
}
