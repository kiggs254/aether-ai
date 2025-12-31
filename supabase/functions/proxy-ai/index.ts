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
    const body = await req.json();
    
    const { action, bot, history, message, stream } = body;

    const provider = bot.provider || 'gemini';
    const systemInstruction = buildSystemInstruction(bot);

    // Handle different AI actions
    if (action === 'chat-stream') {
      if (provider === 'openai') {
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
        const requestBody: any = {
          contents: [
            ...history.map((h: any) => ({
              role: h.role === 'model' ? 'model' : 'user',
              parts: [{ text: h.text }],
            })),
            {
              role: 'user',
              parts: [{ text: message }],
            },
          ],
          systemInstruction: {
            parts: [{ text: buildSystemInstruction(bot) }],
          },
          generationConfig: {
            temperature: bot.temperature ?? 0.7,
          },
        };
        if (tools) {
          requestBody.tools = tools;
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${bot.model || 'gemini-3-flash-preview'}:streamGenerateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return new Response(
          JSON.stringify({ error: `Gemini API error: ${error}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        const requestBody: any = {
          contents: [
            ...history.map((h: any) => ({
              role: h.role === 'model' ? 'model' : 'user',
              parts: [{ text: h.text }],
            })),
            {
              role: 'user',
              parts: [{ text: message }],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          generationConfig: {
            temperature: bot.temperature ?? 0.7,
          },
        };
        if (tools) {
          requestBody.tools = tools;
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${bot.model || 'gemini-3-flash-preview'}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

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
  return `
    You are ${bot.name}. ${bot.systemInstruction}
    
    Here is your core knowledge base/training data:
    ---
    ${bot.knowledgeBase}
    ---
    
    You have access to interactive UI tools/actions. 
    If a user's request is best served by triggering a UI action (like showing a button, opening a link, or handing off to a human), invoke the "trigger_action" function with the appropriate action_id.
    Do not mention the internal action_id to the user, just trigger it naturally.
    
    If the answer is not in the knowledge base, use your general knowledge but mention you are not explicitly trained on that specific detail if it seems obscure.
    Keep responses concise and helpful.
  `;
}

function buildOpenAITools(bot: any): any[] | undefined {
  if (!bot.actions || bot.actions.length === 0) return undefined;

  const triggerActionFunc = {
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
  };

  return [triggerActionFunc];
}

function buildGeminiTools(bot: any): any[] | undefined {
  if (!bot.actions || bot.actions.length === 0) return undefined;

  const triggerActionFunc = {
    functionDeclarations: [{
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
    }]
  };

  return [triggerActionFunc];
}

