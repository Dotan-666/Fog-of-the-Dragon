/**
 * Supabase Edge Function: optional AI wording for the Character Guide.
 *
 * Secrets (set with the Supabase CLI or dashboard — never in the frontend or in Git):
 *   supabase secrets set GEMINI_API_KEY=...        (required)
 *   supabase secrets set GEMINI_MODEL=...          (optional, defaults below)
 * SUPABASE_URL and SUPABASE_ANON_KEY are provided by the Edge runtime.
 *
 * Deploy:  supabase functions deploy character-guide-ai
 * Only signed-in users can call it (the user's JWT is verified). The model only rephrases verified facts.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { MAX_BODY_BYTES, validateFacts, geminiRequest, parseGeminiResponse, makeRateLimiter, type GuideFacts } from './core.ts';

const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite';
const allow = makeRateLimiter(6, 60_000); // 6 requests per user per minute (per instance)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return reply(503, { error: 'AI guide is not configured on the server.' });

  // Verify the caller is a signed-in user.
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Sign in to use the AI guide.' });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return reply(401, { error: 'Sign in to use the AI guide.' });
  if (!allow(userData.user.id)) return reply(429, { error: 'Too many AI requests. Try again in a minute.' });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { error: 'Request too large.' });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'Invalid JSON.' });
  }
  const invalid = validateFacts(body);
  if (invalid) return reply(400, { error: invalid });
  const facts = (body as { facts: GuideFacts }).facts;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(geminiRequest(facts)),
      signal: AbortSignal.timeout(25_000),
    });
    if (res.status === 429) return reply(429, { error: 'The AI service is busy. Try again later.' });
    if (!res.ok) return reply(502, { error: 'The AI service returned an error.' });
    const sections = parseGeminiResponse(await res.json());
    return reply(200, { hash: facts.hash, model: MODEL, sections });
  } catch (e) {
    console.error('character-guide-ai', e instanceof Error ? e.message : e);
    return reply(502, { error: 'The AI service could not answer.' });
  }
});
