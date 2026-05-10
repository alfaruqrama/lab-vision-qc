import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeImage } from './gemini.ts';
import { parseGeminiResponse } from './parser.ts';
import { preprocessImage } from './preprocessor.ts';
import { ExtractQCRequest, ExtractQCResponse } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_PER_DAY = 20;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const { data: rateLimitCheck, error: rateLimitError } = await supabaseClient
      .rpc('check_ai_rate_limit', { p_user_id: user.id, p_limit: RATE_LIMIT_PER_DAY });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to check rate limit' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rateLimitCheck) {
      // Get remaining scans for error message
      const { data: remaining } = await supabaseClient
        .rpc('get_remaining_ai_scans', { p_user_id: user.id, p_limit: RATE_LIMIT_PER_DAY });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Rate limit exceeded. You have used all ${RATE_LIMIT_PER_DAY} AI scans for today. Resets at midnight.`,
          remaining_scans: remaining ?? 0
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ExtractQCRequest = await req.json();
    if (!body.imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing imageBase64 in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preprocess image
    const { processedBase64, originalSizeKB } = await preprocessImage(body.imageBase64);

    // Call Gemini API
    const geminiResponse = await analyzeImage(processedBase64);

    // Parse and validate response
    const parseResult = parseGeminiResponse(geminiResponse);

    // Calculate response time
    const responseTimeMs = Date.now() - startTime;

    // Log to database
    await supabaseClient.from('qc_ai_logs').insert({
      user_id: user.id,
      success: parseResult.success,
      error_message: parseResult.error || null,
      tokens_used: parseResult.tokensUsed || null,
      response_time_ms: responseTimeMs,
      extracted_data: parseResult.data || null,
      image_size_kb: originalSizeKB
    });

    // Get remaining scans
    const { data: remainingScans } = await supabaseClient
      .rpc('get_remaining_ai_scans', { p_user_id: user.id, p_limit: RATE_LIMIT_PER_DAY });

    // Return response
    const response: ExtractQCResponse = {
      success: parseResult.success,
      data: parseResult.data,
      error: parseResult.error,
      remaining_scans: remainingScans ?? 0
    };

    return new Response(
      JSON.stringify(response),
      {
        status: parseResult.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
