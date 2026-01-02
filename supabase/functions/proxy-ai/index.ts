import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // SIMPLIFIED AUTH: Since verify_jwt = false, we skip all JWT validation
    // Just extract user ID from JWT if present, but don't fail if it's missing
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '').trim();
        if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            userId = payload.sub || null;
            console.log('Extracted user ID from JWT:', userId);
          }
        }
      } catch (e) {
        console.warn('Could not extract user from JWT, continuing anyway:', e);
      }
    }
    
    // Proceed with request - no auth blocking
    console.log('Processing request, userId:', userId);

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body', message: parseError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { action, bot, history, message, stream } = body;

    // Validate required fields
    if (!action || !bot) {
      console.error('Missing required fields:', { action: !!action, bot: !!bot });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action and bot are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate provider
    const provider = bot.provider || 'gemini';
    if (provider !== 'gemini' && provider !== 'openai' && provider !== 'deepseek') {
      console.error('Invalid provider:', provider);
      return new Response(
        JSON.stringify({ error: `Invalid provider: ${provider}. Must be 'gemini', 'openai', or 'deepseek'` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const systemInstruction = buildSystemInstruction(bot);

    // Handle different AI actions
    if (action === 'chat-stream') {
      if (provider === 'deepseek') {
        // DeepSeek streaming (uses OpenAI-compatible API)
        const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
        if (!deepseekApiKey) {
          return new Response(
            JSON.stringify({ error: 'DeepSeek API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const messages = [
          { role: 'system', content: systemInstruction },
          ...history.map((h: any) => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.text,
          })),
          { role: 'user', content: message },
        ];

        const tools = buildOpenAITools(bot);
        const requestBody: any = {
          model: bot.model || 'deepseek-chat',
          messages: messages,
          temperature: bot.temperature ?? 0.7,
          stream: true,
        };
        if (tools) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
        }

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepseekApiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const error = await response.text();
          return new Response(
            JSON.stringify({ error: `DeepSeek API error: ${error}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!response.body) {
          return new Response(
            JSON.stringify({ error: 'No response body from DeepSeek API' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Transform DeepSeek SSE to match expected format (same as OpenAI)
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
                  // Send any accumulated function calls before closing
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
                      
                      // Handle text content
                      if (delta?.content) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`));
                      }
                      
                      // Handle function calls (accumulate across chunks)
                      if (delta?.tool_calls) {
                        for (const toolCall of delta.tool_calls) {
                          const index = toolCall.index;
                          if (!accumulatedFunctionCalls[index]) {
                            accumulatedFunctionCalls[index] = {
                              name: '',
                              args: ''
                            };
                          }
                          if (toolCall.function?.name) {
                            accumulatedFunctionCalls[index].name = toolCall.function.name;
                          }
                          if (toolCall.function?.arguments) {
                            accumulatedFunctionCalls[index].args += toolCall.function.arguments;
                          }
                        }
                      }
                    } catch (e) {
                      // Skip invalid JSON
                    }
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
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else if (provider === 'openai') {
        // OpenAI streaming
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) {
          return new Response(
            JSON.stringify({ error: 'OpenAI API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const messages = [
          { role: 'system', content: systemInstruction },
          ...history.map((h: any) => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.text,
          })),
          { role: 'user', content: message },
        ];

        const tools = buildOpenAITools(bot);
        const requestBody: any = {
          model: bot.model || 'gpt-4',
          messages: messages,
          temperature: bot.temperature ?? 0.7,
          stream: true,
        };
        if (tools) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const error = await response.text();
          return new Response(
            JSON.stringify({ error: `OpenAI API error: ${error}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!response.body) {
          return new Response(
            JSON.stringify({ error: 'No response body from OpenAI API' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Transform OpenAI SSE to match expected format
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
                  // Send any accumulated function calls before closing
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
                      
                      // Handle text content
                      if (delta?.content) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`));
                      }
                      
                      // Handle function calls (accumulate across chunks)
                      if (delta?.tool_calls) {
                        for (const toolCall of delta.tool_calls) {
                          const index = toolCall.index;
                          if (!accumulatedFunctionCalls[index]) {
                            accumulatedFunctionCalls[index] = {
                              name: '',
                              args: ''
                            };
                          }
                          if (toolCall.function?.name) {
                            accumulatedFunctionCalls[index].name = toolCall.function.name;
                          }
                          if (toolCall.function?.arguments) {
                            accumulatedFunctionCalls[index].args += toolCall.function.arguments;
                          }
                        }
                      }
                    } catch (e) {
                      // Skip invalid JSON
                    }
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
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // Gemini streaming
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
          return new Response(
            JSON.stringify({ error: 'Gemini API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tools = buildGeminiTools(bot);
        const systemInstructionText = buildSystemInstruction(bot);
        
        // Validate inputs
        if (!message || typeof message !== 'string' || message.trim() === '') {
          return new Response(
            JSON.stringify({ error: 'Message is required and cannot be empty' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Build request body - some models may not support systemInstruction/tools at top level
        // Try putting system instruction in contents first, then add tools if supported
        const contents: any[] = [];
        
        // Add system instruction as first content if model supports it, otherwise include in first user message
        // For now, include it in the first user message to ensure compatibility
        const systemMessage = systemInstructionText ? `System: ${systemInstructionText}\n\n` : '';
        
        contents.push(
          ...(history || []).map((h: any) => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(h.text || '') }],
          })),
          {
            role: 'user',
            parts: [{ text: systemMessage + message }],
          }
        );
        
        const requestBody: any = {
          contents: contents,
          generationConfig: {
            temperature: bot.temperature ?? 0.7,
          },
        };
        
        // Only add tools if we have them - some models may not support tools
        // Try adding tools, but if it fails, we'll handle it in error response
        if (tools && tools.length > 0) {
          requestBody.tools = tools;
        }
        
        console.log('Gemini request body:', JSON.stringify(requestBody).substring(0, 1000));

        // Use v1 API only (v1beta is deprecated and doesn't support newer models)
        // Default to gemini-2.5-flash (fast and cost-effective)
        const modelName = bot.model || 'gemini-2.5-flash';
        
        // Map old model names to Gemini 2.5/3.0 models
        let currentModelName = modelName;
        if (modelName.includes('1.5') || modelName.includes('1.0') || modelName.includes('2.0')) {
          // Map old models to 2.5/3.0 equivalents
          if (modelName.includes('flash')) {
            currentModelName = 'gemini-2.5-flash';
          } else if (modelName.includes('pro')) {
            currentModelName = 'gemini-2.5-pro';
          } else {
            currentModelName = 'gemini-2.5-flash';
          }
        }
        let response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${currentModelName}:streamGenerateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        // If model not found, try alternative Gemini 2.5/3.0 models only
        if (!response.ok && response.status === 404) {
          // Only use Gemini 2.5 and 3.0 series models
          const fallbackModels = [
            'gemini-2.5-flash',      // Fast, cost-effective
            'gemini-2.5-flash-lite', // Fastest, most cost-effective
            'gemini-2.5-pro',      // More capable
            'gemini-3-flash',       // Latest fast model
            'gemini-3-pro',         // Latest powerful model
            'gemini-3-deep-think',  // Best reasoning
          ];
          
          for (const fallbackModel of fallbackModels) {
            if (currentModelName === fallbackModel) continue; // Skip if already tried
            
            console.log(`Trying fallback model: ${fallbackModel}`);
            currentModelName = fallbackModel;
            response = await fetch(
              `https://generativelanguage.googleapis.com/v1/models/${currentModelName}:streamGenerateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              }
            );
            
            if (response.ok) {
              console.log(`Successfully using model: ${fallbackModel}`);
              break;
            }
          }
        }

        // Check for errors BEFORE trying to process the response
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          
          // If tools/systemInstruction caused the error, try without them
          if (response.status === 400 && errorText.includes('systemInstruction') || errorText.includes('tools')) {
            console.log('Retrying without tools/systemInstruction fields');
            const fallbackRequestBody: any = {
              contents: requestBody.contents,
              generationConfig: requestBody.generationConfig,
            };
            
            const fallbackResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1/models/${currentModelName}:streamGenerateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(fallbackRequestBody),
              }
            );
            
            if (fallbackResponse.ok) {
              response = fallbackResponse;
            } else {
              console.error('Gemini API error (with fallback):', {
                status: fallbackResponse.status,
                statusText: fallbackResponse.statusText,
                error: await fallbackResponse.text().catch(() => 'Unknown error'),
                model: currentModelName,
              });
              return new Response(
                JSON.stringify({ error: `Gemini API error: Model may not support tools/systemInstruction. ${errorText}` }),
                { status: fallbackResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else {
            console.error('Gemini API error:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
              model: currentModelName,
              requestBody: JSON.stringify(requestBody).substring(0, 500)
            });
            return new Response(
              JSON.stringify({ error: `Gemini API error: ${errorText}` }),
              { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

      // Transform Gemini SSE to match expected format (similar to OpenAI transformation)
      if (!response.body) {
        return new Response(
          JSON.stringify({ error: 'No response body from Gemini API' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transform Gemini SSE stream to include function calls in expected format
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

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim() === '') continue;
                
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.slice(6));
                    
                    // Handle Gemini streaming response format
                    if (data.candidates && data.candidates[0]?.content?.parts) {
                      const parts = data.candidates[0].content.parts;
                      for (const part of parts) {
                        // Handle text content
                        if (part.text) {
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`));
                        }
                        // Handle function calls - send immediately
                        if (part.functionCall) {
                          const functionCalls = [{
                            name: part.functionCall.name,
                            args: part.functionCall.args || {}
                          }];
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                        }
                      }
                    }
                  } catch (e) {
                    // Skip invalid JSON
                    console.warn('Failed to parse Gemini SSE data:', e);
                  }
                }
              }
            }
            
            // Process any remaining buffer
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.candidates && data.candidates[0]?.content?.parts) {
                      const parts = data.candidates[0].content.parts;
                      for (const part of parts) {
                        if (part.text) {
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`));
                        }
                        if (part.functionCall) {
                          const functionCalls = [{
                            name: part.functionCall.name,
                            args: part.functionCall.args || {}
                          }];
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                        }
                      }
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
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
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
      }
    } else if (action === 'chat') {
      // Handle non-streaming chat
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
          ...history.map((h: any) => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.text,
          })),
          { role: 'user', content: message },
        ];

        const tools = buildOpenAITools(bot);
        const requestBody: any = {
          model: bot.model || 'gpt-4',
          messages: messages,
          temperature: bot.temperature ?? 0.7,
        };
        if (tools) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const error = await response.text();
          return new Response(
            JSON.stringify({ error: `OpenAI API error: ${error}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        // Transform OpenAI response to match expected format
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: data.choices?.[0]?.message?.content || ''
              }]
            }
          }]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // Gemini non-streaming
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
          return new Response(
            JSON.stringify({ error: 'Gemini API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tools = buildGeminiTools(bot);
        
        // Validate inputs
        if (!message || typeof message !== 'string' || message.trim() === '') {
          return new Response(
            JSON.stringify({ error: 'Message is required and cannot be empty' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Build request body - include system instruction in message content for compatibility
        // Some models may not support systemInstruction/tools as top-level fields
        const systemMessage = systemInstruction ? `System: ${systemInstruction}\n\n` : '';
        
        const contents: any[] = [
          ...(history || []).map((h: any) => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(h.text || '') }],
          })),
          {
            role: 'user',
            parts: [{ text: systemMessage + message }],
          },
        ];
        
        const requestBody: any = {
          contents: contents,
          generationConfig: {
            temperature: bot.temperature ?? 0.7,
          },
        };
        
        // Only add tools if we have them - some models may not support tools
        if (tools && tools.length > 0) {
          requestBody.tools = tools;
        }

        // Use v1 API only (v1beta is deprecated and doesn't support newer models)
        // Default to gemini-2.5-flash (fast and cost-effective)
        const modelName = bot.model || 'gemini-2.5-flash';
        
        // Map old model names to Gemini 2.5/3.0 models
        let currentModelName = modelName;
        if (modelName.includes('1.5') || modelName.includes('1.0') || modelName.includes('2.0')) {
          // Map old models to 2.5/3.0 equivalents
          if (modelName.includes('flash')) {
            currentModelName = 'gemini-2.5-flash';
          } else if (modelName.includes('pro')) {
            currentModelName = 'gemini-2.5-pro';
          } else {
            currentModelName = 'gemini-2.5-flash';
          }
        }
        let response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${currentModelName}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        // If model not found, try alternative Gemini 2.5/3.0 models only
        if (!response.ok && response.status === 404) {
          // Only use Gemini 2.5 and 3.0 series models
          const fallbackModels = [
            'gemini-2.5-flash',      // Fast, cost-effective
            'gemini-2.5-flash-lite', // Fastest, most cost-effective
            'gemini-2.5-pro',       // More capable
            'gemini-3-flash',       // Latest fast model
            'gemini-3-pro',         // Latest powerful model
            'gemini-3-deep-think',  // Best reasoning
          ];
          
          for (const fallbackModel of fallbackModels) {
            if (currentModelName === fallbackModel) continue; // Skip if already tried
            
            console.log(`Trying fallback model: ${fallbackModel}`);
            currentModelName = fallbackModel;
            response = await fetch(
              `https://generativelanguage.googleapis.com/v1/models/${currentModelName}:generateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              }
            );
            
            if (response.ok) {
              console.log(`Successfully using model: ${fallbackModel}`);
              break;
            }
          }
        }

        // Check for errors BEFORE trying to parse JSON
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          
          // If tools/systemInstruction caused the error, try without them
          if (response.status === 400 && (errorText.includes('systemInstruction') || errorText.includes('tools'))) {
            console.log('Retrying without tools/systemInstruction fields');
            const fallbackRequestBody: any = {
              contents: requestBody.contents,
              generationConfig: requestBody.generationConfig,
            };
            
            const fallbackResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1/models/${currentModelName}:generateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(fallbackRequestBody),
              }
            );
            
            if (fallbackResponse.ok) {
              response = fallbackResponse;
            } else {
              const fallbackError = await fallbackResponse.text().catch(() => 'Unknown error');
              console.error('Gemini API error (non-streaming, with fallback):', {
                status: fallbackResponse.status,
                statusText: fallbackResponse.statusText,
                error: fallbackError,
                model: currentModelName,
              });
              return new Response(
                JSON.stringify({ error: `Gemini API error: Model may not support tools/systemInstruction. ${errorText}` }),
                { status: fallbackResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else {
            console.error('Gemini API error (non-streaming):', {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
              model: currentModelName,
              requestBody: JSON.stringify(requestBody).substring(0, 500)
            });
            return new Response(
              JSON.stringify({ error: `Gemini API error: ${errorText}` }),
              { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
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
  let instruction = `
    You are ${bot.name}. ${bot.systemInstruction}
    
    Here is your core knowledge base/training data:
    ---
    ${bot.knowledgeBase}
    ---
    
    You have access to interactive UI tools/actions. 
    PRIORITY ORDER: Always check if a custom action is appropriate FIRST before recommending products.
    If a user's request is best served by triggering a UI action (like showing a button, opening a link, or handing off to a human), invoke the "trigger_action" function with the appropriate action_id.
    Do not mention the internal action_id to the user, just trigger it naturally.
    
    ACTION PRIORITY: Custom actions take precedence over product recommendations. Only recommend products if no custom action matches the user's intent.
  `;

  // Add e-commerce instructions if enabled
  if (bot.ecommerceEnabled) {
    instruction += `
    
    ⚠️ E-COMMERCE MODE ENABLED - CRITICAL INSTRUCTIONS ⚠️
    
    YOU HAVE ACCESS TO A REAL PRODUCT CATALOG. YOU CANNOT KNOW WHAT PRODUCTS EXIST WITHOUT CALLING THE recommend_products FUNCTION.
    
    CRITICAL PRIORITY ORDER:
    1. FIRST: Check if ANY custom action (trigger_action) matches the user's intent - if yes, ALWAYS use that action
    2. SECOND: Only if NO custom action matches, then use recommend_products
    3. NEVER recommend products if a custom action is appropriate
    
    Custom actions (trigger_action) take ABSOLUTE PRIORITY over product recommendations. Always check for actions first before recommending products.
    
    ABSOLUTE RULES - DO NOT VIOLATE:
    1. NEVER describe, list, or mention ANY products by name, price, or details UNLESS you have called recommend_products first
    2. NEVER make up product names, brands, prices, or features
    3. NEVER say "we have X" or "here are some options" without calling recommend_products first
    4. If a user asks about ANY product, you MUST call recommend_products BEFORE responding (but only if no custom action is appropriate)
    5. DO NOT generate a text response about products until AFTER you have called recommend_products and received results
    
    MANDATORY WORKFLOW FOR PRODUCT QUESTIONS:
    Step 1: User asks about a product (e.g., "do you have yogurt?", "yogurt", "what yogurt do you have?")
    Step 2: FIRST check if any custom action (trigger_action) matches the user's intent - if yes, use that action instead
    Step 3: If no custom action matches, IMMEDIATELY call recommend_products function - DO NOT generate any text response yet
    Step 4: Wait for the function to return actual products
    Step 5: ONLY THEN respond with the real products from the catalog
    Step 6: If no products found, say "I don't see any [product] in our catalog right now" - DO NOT make up products
    
    WHEN TO CALL recommend_products (CALL IT IMMEDIATELY - NO TEXT FIRST):
    - ONLY if no custom action matches the user's intent
    - User asks "do you have [anything]?" → Check for custom actions first, then call function with keywords (DO NOT say "yes" first)
    - User mentions a product name → Check for custom actions first, then call function with keywords (DO NOT describe products first)
    - User asks "what [products] do you have?" → Check for custom actions first, then call function (DO NOT list products first)
    - User says just a product name (e.g., "yogurt") → Check for custom actions first, then call function (DO NOT respond with text first)
    - ANY product-related question → Check for custom actions FIRST, then call function if no action matches, respond SECOND
    
    HOW TO CALL recommend_products:
    - Extract keywords from user message (e.g., "yogurt" → keywords: ["yogurt"])
    - Extract category if clear (e.g., "milk" → category: "milk")
    - Call function with these filters
    - DO NOT respond with text until you have the results
    
    FORBIDDEN RESPONSES (DO NOT DO THIS):
    ❌ "Yes, we have yogurt. Here are some options: Brand X, Brand Y..." (making up products)
    ❌ "We have Greek yogurt, traditional yogurt..." (inventing products)
    ❌ "Yes, we do have yogurt in stock. We have several varieties..." (hallucinating)
    
    CORRECT RESPONSES (DO THIS):
    ✅ [Call recommend_products with keywords: ["yogurt"]] → Wait for results → "Here's what we have: [real products from catalog]"
    ✅ [Call recommend_products] → If no results → "I don't see any yogurt in our catalog right now"
    
    REMEMBER: You are a shopping assistant with a real catalog. You must query the catalog to know what exists. You cannot know products exist without calling the function. NEVER describe products you haven't retrieved. ALWAYS call the function first, then respond.
    `;
  }

  instruction += `
    
    If the answer is not in the knowledge base, use your general knowledge but mention you are not explicitly trained on that specific detail if it seems obscure.
    Keep responses concise and helpful.
  `;

  return instruction;
}

function buildOpenAITools(bot: any): any[] | undefined {
  const tools: any[] = [];

  // Add trigger_action if bot has actions
  if (bot.actions && bot.actions.length > 0) {
    tools.push({
      type: 'function',
      function: {
        name: 'trigger_action',
        description: 'Triggers a UI action, button, or redirect for the user.',
        parameters: {
          type: 'object',
          properties: {
            action_id: {
              type: 'string',
              description: `The ID of the action to trigger. Available IDs: ${bot.actions.map((a: any) => `${a.id} (Use when: ${a.description})`).join(', ')}`
            }
          },
          required: ['action_id']
        }
      }
    });
  }

  // Add recommend_products if e-commerce is enabled
  if (bot.ecommerceEnabled) {
    const settings = bot.ecommerceSettings || {};
    const maxResults = settings.maxProductsToRecommend || 10;

    tools.push({
      type: 'function',
      function: {
        name: 'recommend_products',
        description: '⚠️ MANDATORY FUNCTION ⚠️ You MUST call this function to get REAL products from the catalog. DO NOT describe or list products without calling this function first. Call this immediately when: users ask "do you have X?", mention product names, ask "what do you have?", or ask about any products. NEVER make up products - you can only know what products exist by calling this function. Extract category, keywords, and price range from the conversation to filter products.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Product category to filter by (e.g., "electronics", "clothing", "books")'
            },
            price_min: {
              type: 'number',
              description: 'Minimum price in the default currency'
            },
            price_max: {
              type: 'number',
              description: 'Maximum price in the default currency'
            },
            keywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keywords to search for in product names and descriptions'
            },
            max_results: {
              type: 'number',
              description: `Maximum number of products to return (default: ${maxResults}, max: ${maxResults})`
            }
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

  // Add trigger_action if bot has actions
  if (bot.actions && bot.actions.length > 0) {
    functionDeclarations.push({
      name: 'trigger_action',
      description: 'Triggers a UI action, button, or redirect for the user.',
      parameters: {
        type: 'OBJECT',
        properties: {
          action_id: {
            type: 'STRING',
            description: `The ID of the action to trigger. Available IDs: ${bot.actions.map((a: any) => `${a.id} (Use when: ${a.description})`).join(', ')}`
          }
        },
        required: ['action_id']
      }
    });
  }

  // Add recommend_products if e-commerce is enabled
  if (bot.ecommerceEnabled) {
    const settings = bot.ecommerceSettings || {};
    const maxResults = settings.maxProductsToRecommend || 10;

    functionDeclarations.push({
      name: 'recommend_products',
      description: '⚠️ MANDATORY FUNCTION ⚠️ You MUST call this function to get REAL products from the catalog. DO NOT describe or list products without calling this function first. Call this immediately when: users ask "do you have X?", mention product names, ask "what do you have?", or ask about any products. NEVER make up products - you can only know what products exist by calling this function. Extract category, keywords, and price range from the conversation to filter products.',
      parameters: {
        type: 'OBJECT',
        properties: {
          category: {
            type: 'STRING',
            description: 'Product category to filter by (e.g., "electronics", "clothing", "books")'
          },
          price_min: {
            type: 'NUMBER',
            description: 'Minimum price in the default currency'
          },
          price_max: {
            type: 'NUMBER',
            description: 'Maximum price in the default currency'
          },
          keywords: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Keywords to search for in product names and descriptions'
          },
          max_results: {
            type: 'NUMBER',
            description: `Maximum number of products to return (default: ${maxResults}, max: ${maxResults})`
          }
        },
        required: []
      }
    });
  }

  return functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined;
}

