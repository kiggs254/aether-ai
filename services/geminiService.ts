import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Tool, Type } from "@google/genai";
import { Bot, ChatMessage } from '../types';
import { supabase } from '../lib/supabase';

// Use edge function for AI calls instead of direct API access
const USE_EDGE_FUNCTION = true;

// Initialize AI client only if not using edge function
let ai: GoogleGenAI | null = null;
if (!USE_EDGE_FUNCTION && process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// Construct the context-aware system prompt
const buildSystemInstruction = (bot: Bot) => {
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
};

// Construct Tools configuration from Bot Actions
const buildTools = (bot: Bot): Tool[] | undefined => {
  if (!bot.actions || bot.actions.length === 0) return undefined;

  // We create a single generic function that can trigger any of the defined actions
  const triggerActionFunc: FunctionDeclaration = {
    name: 'trigger_action',
    description: 'Triggers a UI action, button, or redirect for the user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action_id: {
          type: Type.STRING,
          description: `The ID of the action to trigger. Available IDs: ${bot.actions.map(a => `${a.id} (Use when: ${a.description})`).join(', ')}`
        }
      },
      required: ['action_id']
    }
  };

  return [{ functionDeclarations: [triggerActionFunc] }];
};

/**
 * Creates a chat session and returns a stream iterator for real-time responses
 */
export const createChatStream = async (
  bot: Bot,
  history: ChatMessage[],
  newMessage: string
) => {
  try {
    if (USE_EDGE_FUNCTION) {
      // Use Supabase edge function to proxy AI calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured. Please set VITE_SUPABASE_URL in your environment variables.');
      }
      
      if (!supabaseAnonKey) {
        throw new Error('Supabase anon key not configured. Please set VITE_SUPABASE_ANON_KEY in your environment variables.');
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/proxy-ai`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey, // Send anon key so edge function can use it without secrets
        },
        body: JSON.stringify({
          action: 'chat-stream',
          bot,
          history,
          message: newMessage,
          stream: true,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to get AI response';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Create an async generator that mimics the Google GenAI SDK format
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      return {
        [Symbol.asyncIterator]: async function* () {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;
              
              // Handle SSE format: "data: {...}"
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6).trim();
                  if (jsonStr === '[DONE]') break;
                  
                  const data = JSON.parse(jsonStr);
                  
                  // Handle OpenAI streaming format (from edge function transformation)
                  if (data.text) {
                    yield { text: data.text, functionCalls: [] };
                  }
                  // Handle OpenAI function calls
                  else if (data.functionCalls && data.functionCalls.length > 0) {
                    yield { 
                      text: '', 
                      functionCalls: data.functionCalls
                    };
                  }
                  // Handle Gemini streaming response format
                  else if (data.candidates && data.candidates[0]?.content?.parts) {
                    const parts = data.candidates[0].content.parts;
                    for (const part of parts) {
                      if (part.text) {
                        yield { text: part.text, functionCalls: [] };
                      }
                      // Handle function calls if present
                      if (part.functionCall) {
                        yield { 
                          text: '', 
                          functionCalls: [{
                            name: part.functionCall.name,
                            args: part.functionCall.args
                          }]
                        };
                      }
                    }
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                  console.warn('Failed to parse SSE data:', line, e);
                }
              }
            }
          }
        },
      } as any;
    } else {
      // Fallback to direct API call (for development)
      if (!ai) {
        throw new Error('AI client not initialized. Set USE_EDGE_FUNCTION=false and provide API_KEY.');
      }
      const tools = buildTools(bot);
      
      const chat = ai.chats.create({
        model: bot.model || 'gemini-3-flash-preview',
        config: {
          systemInstruction: buildSystemInstruction(bot),
          temperature: bot.temperature ?? 0.7,
          tools: tools,
        },
        history: history.map(h => ({
          role: h.role,
          parts: [{ text: h.text }]
        }))
      });

      const result = await chat.sendMessageStream({ message: newMessage });
      return result;
    }
  } catch (error) {
    console.error("AI API Error:", error);
    throw error;
  }
};

/**
 * Standard single-turn response (fallback)
 */
export const generateBotResponse = async (
  bot: Bot,
  history: ChatMessage[],
  newMessage: string
): Promise<string> => {
  try {
    if (USE_EDGE_FUNCTION) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured. Please set VITE_SUPABASE_URL in your environment variables.');
      }
      
      if (!supabaseAnonKey) {
        throw new Error('Supabase anon key not configured. Please set VITE_SUPABASE_ANON_KEY in your environment variables.');
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/proxy-ai`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey, // Send anon key so edge function can use it without secrets
        },
        body: JSON.stringify({
          action: 'chat',
          bot,
          history,
          message: newMessage,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to get AI response';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble thinking right now.";
    } else {
      // Fallback to direct API call
      if (!ai) {
        throw new Error('AI client not initialized. Set USE_EDGE_FUNCTION=false and provide API_KEY.');
      }
      const tools = buildTools(bot);

      const chat = ai.chats.create({
        model: bot.model || 'gemini-3-flash-preview',
        config: {
          systemInstruction: buildSystemInstruction(bot),
          temperature: bot.temperature ?? 0.7,
          tools: tools,
        },
        history: history.map(h => ({
          role: h.role,
          parts: [{ text: h.text }]
        }))
      });

      const result: GenerateContentResponse = await chat.sendMessage({ message: newMessage });
      return result.text || "I'm having trouble thinking right now.";
    }
  } catch (error) {
    console.error("AI API Error:", error);
    return "Sorry, I encountered an error while processing your request.";
  }
};

/**
 * Uses Gemini to improve the user's system instructions
 */
export const optimizeSystemInstruction = async (currentInstruction: string, botName: string): Promise<string> => {
  try {
    if (USE_EDGE_FUNCTION) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return currentInstruction;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/proxy-ai`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey || '', // Send anon key so edge function can use it without secrets
        },
        body: JSON.stringify({
          action: 'chat',
          bot: { model: 'gemini-3-flash-preview', temperature: 0.7 },
          history: [],
          message: `
            Act as an expert prompt engineer. Improve the following system instruction for an AI bot named "${botName}".
            Make it more robust, clear, and effective, while keeping the original intent.
            
            Original Instruction: "${currentInstruction}"
            
            Return ONLY the improved instruction text, nothing else.
          `,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || currentInstruction;
      }
      return currentInstruction;
    } else {
      if (!ai) {
        return currentInstruction;
      }
      const model = ai.models;
      const response = await model.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `
          Act as an expert prompt engineer. Improve the following system instruction for an AI bot named "${botName}".
          Make it more robust, clear, and effective, while keeping the original intent.
          
          Original Instruction: "${currentInstruction}"
          
          Return ONLY the improved instruction text, nothing else.
        `,
      });
      return response.text?.trim() || currentInstruction;
    }
  } catch (e) {
    console.error(e);
    return currentInstruction;
  }
};

export const suggestBotDescription = async (botName: string): Promise<string> => {
  try {
    if (USE_EDGE_FUNCTION) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return "A helpful AI assistant.";
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/proxy-ai`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey || '', // Send anon key so edge function can use it without secrets
        },
        body: JSON.stringify({
          action: 'chat',
          bot: { model: 'gemini-3-flash-preview', temperature: 0.7 },
          history: [],
          message: `Write a short, catchy 1-sentence description for an AI chatbot named "${botName}".`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "A helpful AI assistant.";
      }
      return "A helpful AI assistant.";
    } else {
      if (!ai) {
        return "A helpful AI assistant.";
      }
      const model = ai.models;
      const response = await model.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Write a short, catchy 1-sentence description for an AI chatbot named "${botName}".`,
      });
      return response.text?.trim() || "A helpful AI assistant.";
    }
  } catch (e) {
    return "A custom AI assistant.";
  }
}