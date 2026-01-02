/**
 * Netlify Serverless Function - Proxy for Supabase Edge Function
 * 
 * This function acts as a proxy between the widget and Supabase,
 * keeping Supabase credentials hidden from the embed script.
 */

exports.handler = async (event, context) => {
  // Base CORS headers - ALWAYS include these in every response
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, apikey',
  };

  // Wrap everything in try-catch to ensure CORS headers are always returned
  try {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: '',
      };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    // Get Supabase credentials from environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase credentials in environment variables');
      return {
        statusCode: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Server configuration error',
          message: 'Supabase credentials not configured'
        }),
      };
    }

    // Forward request to Supabase edge function
    const supabaseFunctionUrl = `${supabaseUrl}/functions/v1/proxy-ai`;

    // Parse request body
    let body;
    try {
      if (!event.body) {
        throw new Error('Request body is empty');
      }
      body = JSON.parse(event.body);
      
      // Validate required fields
      if (!body.action) {
        throw new Error('Missing required field: action');
      }
      if (!body.bot) {
        throw new Error('Missing required field: bot');
      }
      if (!body.bot.id) {
        throw new Error('Missing required field: bot.id');
      }
    } catch (parseError) {
      console.error('Failed to parse or validate request body:', parseError);
      console.error('Request body:', event.body?.substring(0, 500));
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Invalid request body',
          message: parseError.message,
          details: 'Check server logs for more information'
        }),
      };
    }

    // Forward request to Supabase
    let response;
    try {
      console.log('Forwarding request to Supabase:', {
        url: supabaseFunctionUrl,
        action: body.action,
        botId: body.bot?.id,
        provider: body.bot?.provider,
        hasHistory: !!body.history,
        hasMessage: !!body.message
      });
      
      response = await fetch(supabaseFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (fetchError) {
      console.error('Failed to fetch from Supabase:', fetchError);
      return {
        statusCode: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Failed to connect to Supabase',
          message: fetchError.message 
        }),
      };
    }

    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Supabase returned error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: supabaseFunctionUrl
      });
      return {
        statusCode: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: errorText || JSON.stringify({ error: 'Supabase function error' }),
      };
    }

    // Get response content type
    const contentType = response.headers.get('Content-Type') || 'application/json';
    
    // For streaming responses, buffer the entire stream
    // Netlify functions have issues with ReadableStream, so we buffer instead
    // This still works with SSE - the client will receive all chunks at once
    if (contentType.includes('text/event-stream') && response.body) {
      // Buffer the entire stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bufferedText = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bufferedText += decoder.decode(value, { stream: true });
        }
      } catch (streamError) {
        console.error('Error reading stream:', streamError);
        return {
          statusCode: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            error: 'Stream read error', 
            message: streamError.message 
          }),
        };
      }
      
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: bufferedText,
      };
    } else {
      // Non-streaming response
      const responseText = await response.text();
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        },
        body: responseText,
      };
    }
  } catch (unexpectedError) {
    // Catch any unexpected errors (syntax errors, etc.) and ensure CORS headers are returned
    console.error('Unexpected error in handler:', unexpectedError);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: unexpectedError.message || 'An unexpected error occurred'
      }),
    };
  }
};

