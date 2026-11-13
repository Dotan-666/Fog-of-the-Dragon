/**
 * Supabase Edge Function: starts a Lemon Squeezy checkout for the signed-in user and returns its URL.
 * Nothing is granted here: the plan or the book unlocks only when Lemon Squeezy's signed webhook (payments-webhook) arrives.
 *
 * Deploy:  supabase functions deploy payments-checkout        (JWT verification stays ON: only signed-in users)
 * Request: POST { "product": "plan_dm_monthly" | "plan_dm_yearly" | "plan_fogger_monthly" | "plan_fogger_yearly" | "campaign_book_digital",
 *                 "campaignId": "<uuid>"   (book only) }
 * Reply:   { "url": "https://…lemonsqueezy.com/checkout/…" }
 *
 * Secrets (supabase secrets set …):
 *   LS_API_KEY     Lemon Squeezy API key (Settings → API). Server-side only.
 *   LS_STORE_ID    numeric store id
 *   LS_VARIANTS    JSON map product → variant id (same value as for the webhook)
 *   SITE_URL       where the site is hosted, e.g. https://fogofthedragon.example (checkout returns here; never taken from the request)
 *   LS_TEST_MODE   "true" to create test-mode checkouts
 * SUPABASE_URL and SUPABASE_ANON_KEY are provided by the Edge runtime.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { PRODUCTS, buildCheckoutBody, isProductKey, parseVariants } from '../_shared/lemonsqueezy.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const recent = new Map<string, number[]>();
function allow(user: string): boolean { // 5 checkouts per user per minute (per instance)
  const now = Date.now();
  const hits = (recent.get(user) || []).filter((t) => now - t < 60_000);
  if (hits.length >= 5) return false;
  hits.push(now);
  recent.set(user, hits);
  return true;
}
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const apiKey = Deno.env.get('LS_API_KEY');
  const storeId = Deno.env.get('LS_STORE_ID');
  const site = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
  const parsed = parseVariants(Deno.env.get('LS_VARIANTS'));
  if (!apiKey || !storeId || !/^https?:\/\//.test(site) || 'error' in parsed) return reply(503, { error: 'Payments are not configured on the server yet.' });

  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Sign in to buy.' });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u, error: ue } = await supabase.auth.getUser(token);
  if (ue || !u?.user) return reply(401, { error: 'Sign in to buy.' });
  if (!allow(u.user.id)) return reply(429, { error: 'Too many attempts. Try again in a minute.' });

  let body: { product?: unknown; campaignId?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'Invalid JSON.' }); }
  if (!isProductKey(body.product)) return reply(400, { error: 'Unknown product.' });
  const product = body.product;
  const variantId = parsed.variants[product];
  if (!variantId) return reply(503, { error: 'That product is not set up yet.' });

  let campaignId: string | null = null;
  let redirectUrl = `${site}/Pages/dashboard.html?checkout=success#upgrade`;
  if (PRODUCTS[product].kind === 'book') {
    campaignId = typeof body.campaignId === 'string' && UUID.test(body.campaignId) ? body.campaignId : null;
    if (!campaignId) return reply(400, { error: 'Choose a campaign.' });
    // The database (row level security through this user's token) decides whether they are in the campaign.
    const { data: access, error } = await supabase.rpc('campaign_feature_access', { target_campaign: campaignId });
    if (error || !access) return reply(403, { error: 'You are not part of that campaign.' });
    if (access.book_unlocked) return reply(409, { error: 'The campaign book is already unlocked for this campaign.' });
    if (!access.memories) return reply(409, { error: 'The campaign book needs the Logbook, which this campaign’s Dungeon Master’s plan does not include.' });
    redirectUrl = `${site}/Pages/campaign.html?c=${campaignId}&checkout=success#logbook/book`;
  }

  const payload = buildCheckoutBody({
    storeId, variantId, userId: u.user.id, email: u.user.email, product, campaignId, redirectUrl,
    testMode: Deno.env.get('LS_TEST_MODE') === 'true', expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
  try {
    const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    const url = json?.data?.attributes?.url;
    if (!res.ok || typeof url !== 'string' || !/^https:\/\//.test(url)) {
      console.error('Lemon Squeezy checkout failed', res.status, JSON.stringify(json?.errors || json));
      return reply(502, { error: 'The payment provider could not start the checkout. Try again in a moment.' });
    }
    return reply(200, { url });
  } catch (e) {
    console.error('Lemon Squeezy unreachable', (e as Error).message);
    return reply(502, { error: 'The payment provider could not be reached. Try again in a moment.' });
  }
});
