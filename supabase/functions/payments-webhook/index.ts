/**
 * Supabase Edge Function: Lemon Squeezy webhook receiver. The ONLY place subscriptions and purchases are recorded.
 *
 * Deploy WITHOUT JWT verification (Lemon Squeezy can't send one; the HMAC signature is the authentication):
 *   supabase functions deploy payments-webhook --no-verify-jwt
 * Webhook URL to enter in Lemon Squeezy:  https://<project-ref>.supabase.co/functions/v1/payments-webhook
 * Events to subscribe to: order_created, order_refunded, subscription_created, subscription_updated, subscription_cancelled,
 *   subscription_resumed, subscription_expired, subscription_paused, subscription_unpaused
 *
 * Secrets (supabase secrets set …; never in the frontend or in Git):
 *   LS_WEBHOOK_SECRET   the signing secret you typed when creating the webhook (required)
 *   LS_VARIANTS         JSON map of our products to Lemon Squeezy variant ids (required), e.g.
 *                       {"plan_dm_monthly":"111","plan_dm_yearly":"112","plan_fogger_monthly":"113","plan_fogger_yearly":"114","campaign_book_digital":"115"}
 *   LS_TEST_MODE        "true" while you test with Lemon Squeezy test mode; leave unset in production so test events are ignored
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the Edge runtime.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { interpretEvent, parseVariants, verifySignature, type WebhookEvent } from '../_shared/lemonsqueezy.ts';

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const secret = Deno.env.get('LS_WEBHOOK_SECRET');
  const parsed = parseVariants(Deno.env.get('LS_VARIANTS'));
  if (!secret || 'error' in parsed) return reply(503, { error: 'Payments are not configured on the server.' });

  // The signature is computed over the exact bytes received, so read the body as text before anything else.
  const raw = await req.text();
  if (raw.length > 1_000_000) return reply(413, { error: 'Request too large.' });
  if (!(await verifySignature(raw, req.headers.get('X-Signature'), secret))) return reply(401, { error: 'Invalid signature.' });

  let event: WebhookEvent;
  try { event = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON.' }); }

  const action = interpretEvent(event, parsed.variants, { acceptTestMode: Deno.env.get('LS_TEST_MODE') === 'true' });
  if (action.type === 'ignore') return reply(200, { ok: true, ignored: action.reason }); // 200: nothing to retry

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  if (action.type === 'plan') {
    const { data, error } = await db.rpc('apply_provider_plan', {
      p_user: action.userId, p_plan: action.planId, p_status: action.status, p_period_end: action.periodEnd, p_provider_ref: action.providerRef,
      p_customer: action.customerId, p_portal_url: action.portalUrl, p_updated_at: action.updatedAt,
    });
    if (error) { console.error('apply_provider_plan failed', error.message); return reply(500, { error: 'Could not record the subscription.' }); } // 5xx: Lemon Squeezy retries
    return reply(200, { ok: true, result: data });
  }
  const { data, error } = await db.rpc('apply_provider_book', {
    p_campaign: action.campaignId, p_user: action.userId, p_status: action.status, p_provider_ref: action.providerRef, p_amount: action.amountCents, p_currency: action.currency || 'usd',
  });
  if (error) { console.error('apply_provider_book failed', error.message); return reply(500, { error: 'Could not record the purchase.' }); }
  if (data === 'duplicate_needs_refund') console.error('Two paid copies of the book for one campaign: refund order', action.providerRef);
  return reply(200, { ok: true, result: data });
});
