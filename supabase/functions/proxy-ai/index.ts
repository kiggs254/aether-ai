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

    // Validate and log bot structure
    console.log('Bot configuration:', {
      id: bot.id,
      name: bot.name,
      provider: bot.provider,
      actionsCount: Array.isArray(bot.actions) ? bot.actions.length : 0,
      ecommerceEnabled: !!bot.ecommerceEnabled,
      hasActions: Array.isArray(bot.actions) && bot.actions.length > 0,
      actions: Array.isArray(bot.actions) ? bot.actions.map((a: any) => ({ id: a.id, type: a.type, description: a.description })) : []
    });

    // Validate bot.actions is an array if present
    if (bot.actions !== undefined && !Array.isArray(bot.actions)) {
      console.warn('bot.actions is not an array, converting to empty array');
      bot.actions = [];
    }

    // Validate bot.ecommerceEnabled is a boolean
    if (bot.ecommerceEnabled !== undefined && typeof bot.ecommerceEnabled !== 'boolean') {
      console.warn('bot.ecommerceEnabled is not a boolean, defaulting to false');
      bot.ecommerceEnabled = false;
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
        console.log('DeepSeek tools built:', tools ? `${tools.length} tools` : 'no tools');
        if (tools) {
          console.log('DeepSeek tools structure:', JSON.stringify(tools, null, 2));
        }
        const requestBody: any = {
          model: bot.model || 'deepseek-chat',
          messages: messages,
          temperature: bot.temperature ?? 0.7,
          stream: true,
        };
        if (tools) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
          console.log('Added tools to DeepSeek request with tool_choice: auto');
        } else {
          console.log('No tools to add to DeepSeek request');
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
        console.log('OpenAI streaming tools built:', tools ? `${tools.length} tools` : 'no tools');
        if (tools) {
          console.log('OpenAI streaming tools structure:', JSON.stringify(tools, null, 2));
        }
        const requestBody: any = {
          model: bot.model || 'gpt-4',
          messages: messages,
          temperature: bot.temperature ?? 0.7,
          stream: true,
        };
        if (tools) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
          console.log('Added tools to OpenAI streaming request with tool_choice: auto');
        } else {
          console.log('No tools to add to OpenAI streaming request');
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
        console.log('Gemini tools built:', tools ? `${tools.length} tool groups` : 'no tools');
        if (tools) {
          console.log('Gemini tools structure:', JSON.stringify(tools, null, 2));
        }
        const systemInstructionText = buildSystemInstruction(bot);
        console.log('System instruction length:', systemInstructionText.length, 'chars');
        
        // Validate inputs
        if (!message || typeof message !== 'string' || message.trim() === '') {
          return new Response(
            JSON.stringify({ error: 'Message is required and cannot be empty' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Build request body - use top-level systemInstruction only (no duplication in message)
        const contents: any[] = [
          ...(history || []).map((h: any) => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(h.text || '') }],
          })),
          {
            role: 'user',
            parts: [{ text: message }], // Don't prepend system instruction here
          }
        ];
        
        const requestBody: any = {
          contents: contents,
          generationConfig: {
            temperature: bot.temperature ?? 0.7,
          },
        };
        
        // Add systemInstruction as top-level field only (no duplication)
        if (systemInstructionText) {
          requestBody.systemInstruction = {
            parts: [{ text: systemInstructionText }]
          };
          console.log('Added systemInstruction as top-level field for streaming');
        }
        
        // Only add tools if we have them - some models may not support tools
        // Try adding tools, but if it fails, we'll handle it in error response
        if (tools && tools.length > 0) {
          requestBody.tools = tools;
          // Add toolConfig with AUTO mode (more reliable than ANY)
          // Use snake_case for REST API compliance
          requestBody.tool_config = {
            function_calling_config: {
              mode: 'AUTO', // AUTO mode is more reliable - relies on system instruction to encourage function use
            }
          };
          console.log('Added tools and tool_config to Gemini streaming request. Tools count:', tools.length);
          console.log('ToolConfig:', JSON.stringify(requestBody.tool_config));
          console.log('Full tools structure:', JSON.stringify(tools, null, 2));
        } else {
          console.log('No tools to add to Gemini streaming request');
        }
        
        console.log('Gemini request body (first 2000 chars):', JSON.stringify(requestBody).substring(0, 2000));

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

      // Helper function to parse text-based function calls that Gemini sometimes generates
      // Pattern: ___INLINECODE0___(...) where content is either a string (action ID) or object (function args)
      const parseTextBasedFunctionCall = (text: string): any | null => {
        if (!text) return null;
        
        // Pattern 1: ___INLINECODE0___("action-id") - trigger_action
        const triggerActionPattern = /___INLINECODE\d+___\s*\(\s*"([^"]+)"\s*\)/;
        const triggerMatch = text.match(triggerActionPattern);
        if (triggerMatch) {
          const actionId = triggerMatch[1];
          console.log('Detected trigger_action pattern with action_id:', actionId);
          return {
            name: 'trigger_action',
            args: { action_id: actionId }
          };
        }
        
        // Pattern 2: ___INLINECODE0___({...}) - recommend_products or other functions
        // Use non-greedy match with 's' flag to handle multiline JSON
        const functionCallPattern = /___INLINECODE\d+___\s*\(\s*(\{[\s\S]*?\})\s*\)/;
        const functionMatch = text.match(functionCallPattern);
        if (functionMatch) {
          try {
            const jsonStr = functionMatch[1];
            const args = JSON.parse(jsonStr);
            // Determine function name based on args structure
            if (args.action_id) {
              console.log('✓ Detected trigger_action pattern with args:', args);
              return {
                name: 'trigger_action',
                args: args
              };
            } else if (args.keywords || args.category || args.price_min || args.price_max || args.max_results) {
              console.log('✓ Detected recommend_products pattern with args:', args);
              return {
                name: 'recommend_products',
                args: args
              };
            } else {
              console.log('Function call pattern found but args structure unclear:', args);
            }
          } catch (e) {
            console.warn('Failed to parse function call args from text:', e, 'JSON string:', functionMatch[1].substring(0, 200));
          }
        }
        
        // Also check if the entire text IS a function call pattern (no other text)
        const trimmedText = text.trim();
        if (trimmedText.match(/^___INLINECODE\d+___/)) {
          console.log('Text appears to be a function call pattern:', trimmedText.substring(0, 100));
        }
        
        return null;
      };

      // Transform Gemini SSE stream to include function calls in expected format
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let buffer = '';
            let hasExtractedData = false;
            let totalBytes = 0;
            let lineCount = 0;
            let firstDataLine = true;
            let accumulatedText = ''; // Track all text to check for function calls at the end
            
            console.log('Starting to read Gemini stream...');
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log(`Stream ended. Total bytes: ${totalBytes}, Lines processed: ${lineCount}, Data extracted: ${hasExtractedData}`);
                
                // FINAL CHECK: Check accumulated text for function calls before ending
                if (accumulatedText && !hasExtractedData) {
                  const parsedFunctionCall = parseTextBasedFunctionCall(accumulatedText);
                  if (parsedFunctionCall) {
                    console.log('✓ FINAL CHECK: Parsed function call from accumulated text:', parsedFunctionCall.name, 'args:', JSON.stringify(parsedFunctionCall.args || {}));
                    const functionCalls = [{
                      name: parsedFunctionCall.name,
                      args: parsedFunctionCall.args || {}
                    }];
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                    hasExtractedData = true;
                  }
                }
                
                if (!hasExtractedData) {
                  console.warn('Gemini stream ended without extracting any text or function calls.');
                  console.log('Accumulated text (last 500 chars):', accumulatedText.substring(Math.max(0, accumulatedText.length - 500)));
                }
                break;
              }

              const chunk = decoder.decode(value, { stream: true });
              totalBytes += chunk.length;
              buffer += chunk;
              
              // Log first chunk for debugging
              if (totalBytes === chunk.length) {
                console.log('First chunk from Gemini:', chunk.substring(0, 500));
              }
              
              // Check if buffer is a JSON array (not SSE format)
              // Gemini 2.5/3.0 may return JSON array directly instead of SSE
              const trimmedBuffer = buffer.trim();
              if (trimmedBuffer.startsWith('[')) {
                // Check if it's a complete JSON array (ends with ])
                const isComplete = trimmedBuffer.endsWith(']');
                console.log('Buffer starts with [, attempting JSON array parse. Complete:', isComplete, 'Buffer length:', trimmedBuffer.length);
                
                if (isComplete) {
                  try {
                    // Try to parse as JSON array (complete)
                    const jsonArray = JSON.parse(trimmedBuffer);
                    console.log('✓ Successfully parsed complete JSON array format (not SSE), processing...', jsonArray.length, 'items');
                  
                  // Process each item in the array
                  for (const item of jsonArray) {
                    if (item.candidates && item.candidates[0]) {
                      const candidate = item.candidates[0];
                      if (candidate.content?.parts) {
                        for (const part of candidate.content.parts) {
                          // PRIORITY: Check for function calls FIRST
                          if (part.functionCall) {
                            console.log('✓ Function call detected in JSON array:', part.functionCall.name, 'args:', JSON.stringify(part.functionCall.args || {}));
                            const functionCalls = [{
                              name: part.functionCall.name,
                              args: part.functionCall.args || {}
                            }];
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                            hasExtractedData = true;
                            // DO NOT send text if function call is present
                          } else if (part.text) {
                            // Check if text contains function call patterns
                            const parsedFunctionCall = parseTextBasedFunctionCall(part.text);
                            if (parsedFunctionCall) {
                              console.log('✓ Parsed function call from JSON array text:', parsedFunctionCall.name, 'args:', JSON.stringify(parsedFunctionCall.args || {}));
                              const functionCalls = [{
                                name: parsedFunctionCall.name,
                                args: parsedFunctionCall.args || {}
                              }];
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                              hasExtractedData = true;
                            } else {
                              // Only send text if there's no function call
                              console.log(`Extracting text from JSON array (${part.text.length} chars):`, part.text.substring(0, 100));
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`));
                              hasExtractedData = true;
                            }
                          }
                        }
                      }
                    }
                  }
                  
                    buffer = ''; // Clear buffer after processing
                    continue; // Move to next chunk
                  } catch (e) {
                    // JSON parse failed even though it ends with ]
                    console.warn('Failed to parse complete JSON array (ends with ]), trying SSE format:', e.message);
                    console.log('Buffer preview:', trimmedBuffer.substring(0, 500));
                  }
                } else {
                  // Incomplete JSON array, continue accumulating
                  console.log('JSON array incomplete, continuing to accumulate. Current length:', trimmedBuffer.length);
                  continue; // Don't process yet, wait for more data
                }
              } else {
                // Log if buffer doesn't start with [ (for debugging)
                if (totalBytes === chunk.length && trimmedBuffer.length > 0) {
                  console.log('Buffer does NOT start with [, first 100 chars:', trimmedBuffer.substring(0, 100));
                }
              }
              
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim() === '') continue;
                lineCount++;
                
                // Log first few data lines for debugging
                if (firstDataLine && line.startsWith('data: ')) {
                  console.log('First data line:', line.substring(0, 500));
                  firstDataLine = false;
                }
                
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const jsonStr = line.slice(6);
                    const data = JSON.parse(jsonStr);
                    
                    // Handle Gemini streaming response format
                    // Check multiple possible response structures
                    let textContent = null;
                    let functionCall = null;
                    
                    // Log structure for first response (for debugging)
                    if (!hasExtractedData) {
                      console.log('First Gemini response structure:', JSON.stringify(data).substring(0, 1000));
                    }
                    
                    // Try standard format: candidates[0].content.parts
                    if (data.candidates && data.candidates[0]) {
                      const candidate = data.candidates[0];
                      
                      // Check for content.parts
                      if (candidate.content?.parts) {
                        const parts = candidate.content.parts;
                        for (const part of parts) {
                          if (part.text) {
                            // Check if text contains function call patterns (Gemini sometimes generates function calls as text)
                            const parsedFunctionCall = parseTextBasedFunctionCall(part.text);
                            if (parsedFunctionCall) {
                              functionCall = parsedFunctionCall;
                              console.log('✓ Parsed function call from text:', parsedFunctionCall.name, 'args:', JSON.stringify(parsedFunctionCall.args || {}));
                              // Don't add this text to textContent if it's a function call
                            } else {
                              const textToAdd = part.text;
                              textContent = (textContent || '') + textToAdd;
                              accumulatedText += textToAdd; // Track for final check
                            }
                          }
                          if (part.functionCall) {
                            functionCall = part.functionCall;
                          }
                        }
                      }
                      
                      // Check for delta (incremental updates in streaming)
                      if (candidate.delta?.text) {
                        // Check if delta text contains function call patterns
                        const parsedFunctionCall = parseTextBasedFunctionCall(candidate.delta.text);
                        if (parsedFunctionCall) {
                          functionCall = parsedFunctionCall;
                          console.log('✓ Parsed function call from delta text:', parsedFunctionCall.name, 'args:', JSON.stringify(parsedFunctionCall.args || {}));
                        } else {
                          textContent = (textContent || '') + candidate.delta.text;
                          accumulatedText += candidate.delta.text; // Track for final check
                        }
                      }
                      
                      if (candidate.delta?.functionCall) {
                        functionCall = candidate.delta.functionCall;
                      }
                      
                      // Check for content.text (direct)
                      if (!textContent && candidate.content?.text) {
                        // Check if content text contains function call patterns
                        const parsedFunctionCall = parseTextBasedFunctionCall(candidate.content.text);
                        if (parsedFunctionCall) {
                          functionCall = parsedFunctionCall;
                          console.log('✓ Parsed function call from content text:', parsedFunctionCall.name, 'args:', JSON.stringify(parsedFunctionCall.args || {}));
                        } else {
                          textContent = candidate.content.text;
                          accumulatedText += candidate.content.text; // Track for final check
                        }
                      }
                      
                      // Check for finishReason and empty content
                      if (candidate.finishReason && !textContent && !functionCall) {
                        console.log('Candidate finished with reason:', candidate.finishReason);
                      }
                    }
                    
                    // Try alternative format: direct text field
                    if (!textContent && data.text) {
                      // Check if text contains function call patterns
                      const parsedFunctionCall = parseTextBasedFunctionCall(data.text);
                      if (parsedFunctionCall) {
                        functionCall = parsedFunctionCall;
                        console.log('✓ Parsed function call from data.text:', parsedFunctionCall.name, 'args:', JSON.stringify(parsedFunctionCall.args || {}));
                      } else {
                        textContent = data.text;
                        accumulatedText += data.text; // Track for final check
                      }
                    }
                    
                    // Try functionCall at top level
                    if (!functionCall && data.functionCall) {
                      functionCall = data.functionCall;
                    }
                    
                    // CRITICAL: Also check accumulated textContent for function calls before sending
                    if (!functionCall && textContent) {
                      const parsedFunctionCall = parseTextBasedFunctionCall(textContent);
                      if (parsedFunctionCall) {
                        functionCall = parsedFunctionCall;
                        textContent = null; // Clear text since it's a function call
                        console.log('✓ Parsed function call from accumulated textContent:', parsedFunctionCall.name, 'args:', JSON.stringify(parsedFunctionCall.args || {}));
                      }
                    }
                    
                    // CRITICAL: Also check accumulated textContent for function calls before sending
                    if (!functionCall && textContent) {
                      const parsedFunctionCall = parseTextBasedFunctionCall(textContent);
                      if (parsedFunctionCall) {
                        functionCall = parsedFunctionCall;
                        textContent = null; // Clear text since it's a function call
                        console.log('✓ Parsed function call from accumulated textContent:', parsedFunctionCall.name, 'args:', JSON.stringify(parsedFunctionCall.args || {}));
                      }
                    }
                    
                    // PRIORITY: Send function calls FIRST if found (they take precedence over text)
                    if (functionCall) {
                      const functionName = functionCall.name || functionCall.function?.name;
                      const functionArgs = functionCall.args || functionCall.function?.arguments || {};
                      console.log('✓ Function call detected in SSE stream:', functionName, 'args:', JSON.stringify(functionArgs));
                      const functionCalls = [{
                        name: functionName,
                        args: functionArgs
                      }];
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                      hasExtractedData = true;
                      // DO NOT send text if function call is present - function calls take priority
                      // The widget will show a default message when function call is detected
                    } else if (textContent) {
                      // Only send text if there's no function call
                      console.log(`Extracting text (${textContent.length} chars):`, textContent.substring(0, 100));
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: textContent })}\n\n`));
                      hasExtractedData = true;
                    }
                    
                    // Log if we couldn't parse anything (for debugging)
                    if (!textContent && !functionCall) {
                      console.log('Could not extract text/functionCall from:', JSON.stringify(data).substring(0, 500));
                    }
                  } catch (e) {
                    // Skip invalid JSON
                    console.warn('Failed to parse Gemini SSE data:', e, 'Line:', line.substring(0, 200));
                  }
                }
              }
            }
            
            // Process any remaining buffer
            const finalBuffer = buffer.trim();
            if (finalBuffer) {
              // Check if remaining buffer is a JSON array
              if (finalBuffer.startsWith('[')) {
                try {
                  const jsonArray = JSON.parse(finalBuffer);
                  console.log('Processing final buffer as JSON array:', jsonArray.length, 'items');
                  for (const item of jsonArray) {
                    if (item.candidates && item.candidates[0]) {
                      const candidate = item.candidates[0];
                      if (candidate.content?.parts) {
                        for (const part of candidate.content.parts) {
                          // PRIORITY: Check for function calls FIRST
                          if (part.functionCall) {
                            console.log('✓ Function call detected in final buffer:', part.functionCall.name, 'args:', JSON.stringify(part.functionCall.args || {}));
                            const functionCalls = [{
                              name: part.functionCall.name,
                              args: part.functionCall.args || {}
                            }];
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                            hasExtractedData = true;
                            // DO NOT send text if function call is present
                          } else if (part.text) {
                            // Check if text contains function call patterns
                            const parsedFunctionCall = parseTextBasedFunctionCall(part.text);
                            if (parsedFunctionCall) {
                              console.log('✓ Parsed function call from final buffer text:', parsedFunctionCall.name, 'args:', JSON.stringify(parsedFunctionCall.args || {}));
                              const functionCalls = [{
                                name: parsedFunctionCall.name,
                                args: parsedFunctionCall.args || {}
                              }];
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                              hasExtractedData = true;
                            } else {
                              // Only send text if there's no function call
                              console.log(`Extracting text from final buffer (${part.text.length} chars):`, part.text.substring(0, 100));
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`));
                              hasExtractedData = true;
                            }
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.warn('Failed to parse final buffer as JSON array:', e.message);
                  // Try SSE format
                  const lines = finalBuffer.split('\n');
                  for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                      try {
                        const data = JSON.parse(line.slice(6));
                        if (data.candidates && data.candidates[0]?.content?.parts) {
                          const parts = data.candidates[0].content.parts;
                          for (const part of parts) {
                            // PRIORITY: Check for function calls FIRST
                            if (part.functionCall) {
                              console.log('✓ Function call detected in remaining buffer:', part.functionCall.name, 'args:', JSON.stringify(part.functionCall.args || {}));
                              const functionCalls = [{
                                name: part.functionCall.name,
                                args: part.functionCall.args || {}
                              }];
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                              hasExtractedData = true;
                              // DO NOT send text if function call is present
                            } else if (part.text) {
                              // Check if text contains function call patterns
                              const parsedFunctionCall = parseTextBasedFunctionCall(part.text);
                              if (parsedFunctionCall) {
                                console.log('✓ Parsed function call from remaining buffer text:', parsedFunctionCall.name, 'args:', JSON.stringify(parsedFunctionCall.args || {}));
                                const functionCalls = [{
                                  name: parsedFunctionCall.name,
                                  args: parsedFunctionCall.args || {}
                                }];
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ functionCalls })}\n\n`));
                                hasExtractedData = true;
                              } else {
                                // Only send text if there's no function call
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`));
                                hasExtractedData = true;
                              }
                            }
                          }
                        }
                      } catch (e) {
                        // Skip invalid JSON
                      }
                    }
                  }
                }
              } else {
                // Try SSE format
                const lines = finalBuffer.split('\n');
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
        console.log('OpenAI non-streaming tools built:', tools ? `${tools.length} tools` : 'no tools');
        if (tools) {
          console.log('OpenAI non-streaming tools structure:', JSON.stringify(tools, null, 2));
        }
        const requestBody: any = {
          model: bot.model || 'gpt-4',
          messages: messages,
          temperature: bot.temperature ?? 0.7,
        };
        if (tools) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
          console.log('Added tools to OpenAI non-streaming request with tool_choice: auto');
        } else {
          console.log('No tools to add to OpenAI non-streaming request');
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
        console.log('Gemini non-streaming tools built:', tools ? `${tools.length} tool groups` : 'no tools');
        if (tools) {
          console.log('Gemini non-streaming tools structure:', JSON.stringify(tools, null, 2));
        }
        
        // Validate inputs
        if (!message || typeof message !== 'string' || message.trim() === '') {
          return new Response(
            JSON.stringify({ error: 'Message is required and cannot be empty' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Build request body - use top-level systemInstruction only (no duplication in message)
        const contents: any[] = [
          ...(history || []).map((h: any) => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(h.text || '') }],
          })),
          {
            role: 'user',
            parts: [{ text: message }], // Don't prepend system instruction here
          },
        ];
        
        const requestBody: any = {
          contents: contents,
          generationConfig: {
            temperature: bot.temperature ?? 0.7,
          },
        };
        
        // Add systemInstruction as top-level field only (no duplication)
        if (systemInstruction) {
          requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
          };
          console.log('Added systemInstruction as top-level field for non-streaming');
        }
        
        // Only add tools if we have them - some models may not support tools
        if (tools && tools.length > 0) {
          requestBody.tools = tools;
          // Add toolConfig with AUTO mode (more reliable than ANY)
          // Use snake_case for REST API compliance
          requestBody.tool_config = {
            function_calling_config: {
              mode: 'AUTO', // AUTO mode is more reliable - relies on system instruction to encourage function use
            }
          };
          console.log('Added tools and tool_config to Gemini non-streaming request. Tools count:', tools.length);
          console.log('ToolConfig:', JSON.stringify(requestBody.tool_config));
          console.log('Full tools structure:', JSON.stringify(tools, null, 2));
        } else {
          console.log('No tools to add to Gemini non-streaming request');
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
  // Build action list for system instruction
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
    ${bot.knowledgeBase}
    ---
    
    ⚠️ CRITICAL: YOU HAVE ACCESS TO INTERACTIVE UI TOOLS/ACTIONS. YOU MUST USE THEM WHEN APPROPRIATE. ⚠️
    ${actionListText}
    
    MANDATORY PRIORITY ORDER (DO NOT VIOLATE):
    1. FIRST: Check if user's message matches ANY custom action above - if YES, YOU MUST call trigger_action with that action_id IMMEDIATELY
    2. SECOND: Only if NO custom action matches, then proceed with other functions (like recommend_products)
    3. NEVER skip checking actions - they take ABSOLUTE PRIORITY
    
    EXAMPLES OF WHEN TO CALL trigger_action:
    - User says "milk" and you have a "milk products" action → IMMEDIATELY call trigger_action with that action_id
    - User asks about something that matches an action description → IMMEDIATELY call trigger_action
    - User's intent clearly matches an available action → IMMEDIATELY call trigger_action
    
    ACTION PRIORITY: Custom actions take ABSOLUTE PRECEDENCE over product recommendations. Only recommend products if NO custom action matches the user's intent.
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
    Step 1: User asks about a product (e.g., "do you have yogurt?", "yogurt", "what yogurt do you have?", "milk")
    Step 2: FIRST check if any custom action (trigger_action) matches the user's intent - if YES, YOU MUST call trigger_action IMMEDIATELY and STOP (do not proceed to Step 3)
    Step 3: ONLY if NO custom action matches, IMMEDIATELY call recommend_products function - DO NOT generate ANY text response first
    Step 4: DO NOT say "Let me check" or "I'll help you" or "Okay, I can help you" - just call the function immediately
    Step 5: Wait for the function to return actual products
    Step 6: ONLY THEN respond with the real products from the catalog
    Step 7: If no products found, you MUST respond with a helpful message like "I couldn't find any [product/search term] in our catalog right now. Please try a different search term or browse other categories." - DO NOT make up products, but DO provide a helpful response
    
    CRITICAL EXAMPLES:
    - User says "milk" → Check actions first: If "milk products" action exists → Call trigger_action with that action_id. If no action → Call recommend_products with keywords: ["milk"]
    - User says "yogurt" → Check actions first: If matching action exists → Call trigger_action. If no action → Call recommend_products with keywords: ["yogurt"]
    
    CRITICAL: When user says a product name (like "milk" or "yogurt"), FIRST check for matching actions, THEN if no match, call recommend_products IMMEDIATELY without any preliminary text. Do NOT say "Okay, I can help you" or "Let me check" - just call the appropriate function.
    
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
    ✅ [Call recommend_products] → If no results → "I couldn't find any yogurt in our catalog right now. Please try a different search term or browse other categories."
    
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
  if (bot.actions && Array.isArray(bot.actions) && bot.actions.length > 0) {
    // Build detailed action list for description
    const actionList = bot.actions.map((a: any) => {
      return `- Action ID: "${a.id}" | Type: ${a.type} | Description: "${a.description || 'No description'}" | Use when: ${a.description || 'user intent matches this action'}`;
    }).join('\n');

    tools.push({
      type: 'function',
      function: {
        name: 'trigger_action',
        description: `⚠️ MANDATORY FUNCTION FOR ACTIONS ⚠️ Triggers a custom UI action, button, or redirect for the user. YOU MUST call this function when the user's message matches ANY of the available actions below.

AVAILABLE ACTIONS:
${actionList}

MATCHING LOGIC:
- If the user's message mentions, asks about, or relates to ANY action description above, you MUST call trigger_action with that action's ID
- Examples:
  * User says "milk" and you have a "milk products" action → Call trigger_action with that action_id
  * User asks about something matching an action description → Call trigger_action with that action_id
  * User's intent clearly matches an action → Call trigger_action with that action_id

CRITICAL: Check the action descriptions above FIRST before calling recommend_products. Actions take ABSOLUTE PRIORITY.`,
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

  // Add recommend_products if e-commerce is enabled
  if (bot.ecommerceEnabled) {
    const settings = bot.ecommerceSettings || {};
    const maxResults = settings.maxProductsToRecommend || 10;

    tools.push({
      type: 'function',
      function: {
        name: 'recommend_products',
        description: '⚠️ MANDATORY FUNCTION ⚠️ You MUST call this function to get REAL products from the catalog. DO NOT describe or list products without calling this function first. Call this immediately when: users ask "do you have X?", mention product names, ask "what do you have?", or ask about any products. NEVER make up products - you can only know what products exist by calling this function. Extract category, keywords, and price range from the conversation to filter products. IMPORTANT: If this function returns no products, you MUST respond with a helpful message like "I couldn\'t find any [search term] in our catalog right now. Please try a different search term or browse other categories."',
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
  if (bot.actions && Array.isArray(bot.actions) && bot.actions.length > 0) {
    // Build detailed action list for description
    const actionList = bot.actions.map((a: any) => {
      return `- Action ID: "${a.id}" | Type: ${a.type} | Description: "${a.description || 'No description'}" | Use when: ${a.description || 'user intent matches this action'}`;
    }).join('\n');

    functionDeclarations.push({
      name: 'trigger_action',
      description: `⚠️ MANDATORY FUNCTION FOR ACTIONS ⚠️ Triggers a custom UI action, button, or redirect for the user. YOU MUST call this function when the user's message matches ANY of the available actions below.

AVAILABLE ACTIONS:
${actionList}

MATCHING LOGIC:
- If the user's message mentions, asks about, or relates to ANY action description above, you MUST call trigger_action with that action's ID
- Examples:
  * User says "milk" and you have a "milk products" action → Call trigger_action with that action_id
  * User asks about something matching an action description → Call trigger_action with that action_id
  * User's intent clearly matches an action → Call trigger_action with that action_id

CRITICAL: Check the action descriptions above FIRST before calling recommend_products. Actions take ABSOLUTE PRIORITY.`,
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

  // Gemini API v1 expects tools in format: [{ function_declarations: [...] }]
  // CRITICAL: Must use snake_case 'function_declarations', not camelCase
  if (functionDeclarations.length > 0) {
    const tools = [{ function_declarations: functionDeclarations }];
    console.log('Built Gemini tools:', JSON.stringify(tools, null, 2));
    return tools;
  }
  
  console.log('No Gemini tools to build');
  return undefined;
}

