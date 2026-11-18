/**
 * Lemon Squeezy integration logic (supabase/functions/_shared/lemonsqueezy.ts): webhook signature check, checkout request,
 * and how webhook events map to plans and campaign-book purchases. No network and no database: the Edge Functions around
 * this are thin. Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as ls from '../supabase/functions/_shared/lemonsqueezy.ts';

const SECRET = 'whsec_test_secret';
const U = '3b241101-e2bb-4255-8caf-4136c566a962';
const C = '11111111-1111-4111-8111-111111111111';
const variants = { plan_adventurer_monthly: '110', plan_adventurer_yearly: '111', plan_dm_monthly: '112', plan_dm_yearly: '113', one_shot: '114', campaign_book_digital: '115' };
const hmac = (body, secret = SECRET) => crypto.createHmac('sha256', secret).update(body).digest('hex');

test('signature: the lowercase hex HMAC-SHA256 of the raw body is accepted; anything else is not', async () => {
  const raw = JSON.stringify({ meta: { event_name: 'order_created' }, data: { id: '1' } });
  assert.equal(await ls.verifySignature(raw, hmac(raw), SECRET), true);
  assert.equal(await ls.verifySignature(raw, hmac(raw).toUpperCase(), SECRET), true, 'hex case does not matter');
  assert.equal(await ls.verifySignature(raw + ' ', hmac(raw), SECRET), false, 'a changed body fails');
  assert.equal(await ls.verifySignature(raw, hmac(raw, 'other'), SECRET), false, 'a wrong secret fails');
  assert.equal(await ls.verifySignature(raw, null, SECRET), false);
  assert.equal(await ls.verifySignature(raw, '', SECRET), false);
  assert.equal(await ls.verifySignature(raw, 'abc', SECRET), false, 'a short signature fails without throwing');
  assert.equal(await ls.verifySignature(raw, hmac(raw), ''), false, 'no secret configured never verifies');
  assert.equal(await ls.signBody(raw, SECRET), hmac(raw), 'matches Node’s own HMAC');
});

test('variants config: numeric ids for known products only', () => {
  assert.deepEqual({ ...ls.parseVariants(JSON.stringify(variants)).variants }, variants);
  assert.match(ls.parseVariants(undefined).error, /not set/);
  assert.match(ls.parseVariants('{oops').error, /valid JSON/);
  assert.match(ls.parseVariants('{"plan_free":"1"}').error, /unknown key/);
  assert.match(ls.parseVariants('{"plan_dm_monthly":"abc"}').error, /numeric/);
  assert.equal(ls.productForVariant(112, variants), 'plan_dm_monthly');
  assert.equal(ls.productForVariant('999', variants), null);
  assert.equal(ls.isProductKey('plan_dm_monthly'), true);
  assert.equal(ls.isProductKey('__proto__'), false);
  assert.equal(ls.isProductKey('constructor'), false);
});

test('checkout request: JSON:API shape, our ids travel in custom data, return address is ours', () => {
  const body = ls.buildCheckoutBody({ storeId: '42', variantId: '115', userId: U, email: 'a@example.com', product: 'campaign_book_digital', campaignId: C, redirectUrl: 'https://site.example/Pages/campaign.html?c=' + C, testMode: true, expiresAt: '2026-12-01T00:00:00Z' });
  const a = body.data.attributes;
  assert.equal(body.data.type, 'checkouts');
  assert.deepEqual(a.checkout_data.custom, { user_id: U, product: 'campaign_book_digital', campaign_id: C });
  assert.equal(a.checkout_data.email, 'a@example.com');
  assert.deepEqual(a.product_options.enabled_variants, [115]);
  assert.equal(a.product_options.redirect_url, 'https://site.example/Pages/campaign.html?c=' + C);
  assert.equal(a.test_mode, true);
  assert.deepEqual(body.data.relationships, { store: { data: { type: 'stores', id: '42' } }, variant: { data: { type: 'variants', id: '115' } } });
  const plan = ls.buildCheckoutBody({ storeId: '42', variantId: '111', userId: U, product: 'plan_dm_monthly', redirectUrl: 'https://x', testMode: false, expiresAt: 'x' });
  assert.equal('campaign_id' in plan.data.attributes.checkout_data.custom, false);
  assert.equal('email' in plan.data.attributes.checkout_data, false);
});

const sub = (name, attrs = {}, custom = { user_id: U }, extra = {}) => ({ meta: { event_name: name, custom_data: custom, ...extra }, data: { id: '77', type: 'subscriptions', attributes: { variant_id: 112, status: 'active', renews_at: '2026-12-10T00:00:00Z', ends_at: null, customer_id: 9, updated_at: '2026-11-10T00:00:00Z', urls: { customer_portal: 'https://store.lemonsqueezy.com/billing?x' }, ...attrs } } });
const order = (name, attrs = {}, custom = { user_id: U, campaign_id: C }, extra = {}) => ({ meta: { event_name: name, custom_data: custom, ...extra }, data: { id: '555', type: 'orders', attributes: { status: 'paid', total: 999, currency: 'USD', first_order_item: { variant_id: 115 }, ...attrs } } });
const live = { acceptTestMode: false };

test('subscriptions: variant decides the plan; status decides access; end of the paid period is kept', () => {
  const created = ls.interpretEvent(sub('subscription_created'), variants, live);
  assert.deepEqual({ ...created }, { type: 'plan', userId: U, planId: 'dungeon-master', status: 'active', periodEnd: '2026-12-10T00:00:00Z', providerRef: '77', customerId: '9', portalUrl: 'https://store.lemonsqueezy.com/billing?x', updatedAt: '2026-11-10T00:00:00Z' });
  assert.equal(ls.interpretEvent(sub('subscription_updated', { variant_id: 110 }), variants, live).planId, 'adventurer', 'a plan change follows the variant');
  const cancelled = ls.interpretEvent(sub('subscription_cancelled', { status: 'cancelled', ends_at: '2026-12-01T00:00:00Z' }), variants, live);
  assert.equal(cancelled.status, 'canceled');
  assert.equal(cancelled.periodEnd, '2026-12-01T00:00:00Z', 'access runs to the end of the paid period');
  assert.equal(ls.interpretEvent(sub('subscription_expired', { status: 'expired', ends_at: '2026-11-01T00:00:00Z' }), variants, live).status, 'canceled');
  assert.equal(ls.interpretEvent(sub('subscription_updated', { status: 'past_due' }), variants, live).status, 'past_due');
  assert.equal(ls.interpretEvent(sub('subscription_updated', { status: 'on_trial' }), variants, live).status, 'active');
  assert.equal(ls.interpretEvent(sub('subscription_updated', { status: 'paused' }), variants, live).status, 'canceled');
});

test('subscriptions: unknown variants, bad user ids, unknown statuses and payment-only events do nothing', () => {
  assert.equal(ls.interpretEvent(sub('subscription_created', { variant_id: 999 }), variants, live).type, 'ignore');
  assert.equal(ls.interpretEvent(sub('subscription_created', { variant_id: 115 }), variants, live).type, 'ignore', 'the book is not a plan');
  assert.match(ls.interpretEvent(sub('subscription_created', {}, { user_id: 'not-a-uuid' }), variants, live).reason, /user id/);
  assert.match(ls.interpretEvent(sub('subscription_created', {}, {}), variants, live).reason, /user id/);
  assert.match(ls.interpretEvent(sub('subscription_created', { status: 'mystery' }), variants, live).reason, /unknown subscription status/);
  assert.equal(ls.interpretEvent({ ...sub('subscription_payment_success'), data: { id: '1', type: 'subscription-invoices', attributes: {} } }, variants, live).type, 'ignore');
});

test('book orders: only a paid campaign-book order unlocks; refunds are passed on; plan orders are left to their subscription', () => {
  const paid = ls.interpretEvent(order('order_created'), variants, live);
  assert.deepEqual({ ...paid }, { type: 'book', campaignId: C, userId: U, status: 'paid', providerRef: '555', amountCents: 999, currency: 'USD' });
  assert.equal(ls.interpretEvent(order('order_created', { status: 'pending' }), variants, live).status, 'pending');
  assert.equal(ls.interpretEvent(order('order_created', { status: 'failed' }), variants, live).status, 'failed');
  assert.equal(ls.interpretEvent(order('order_refunded', { status: 'refunded' }), variants, live).status, 'refunded');
  assert.equal(ls.interpretEvent(order('order_created', { first_order_item: { variant_id: 112 } }), variants, live).type, 'ignore', 'a subscription’s first order');
  assert.match(ls.interpretEvent(order('order_created', {}, { user_id: U }), variants, live).reason, /campaign/);
  assert.match(ls.interpretEvent(order('order_created', {}, { user_id: U, campaign_id: 'x' }), variants, live).reason, /campaign/);
});

test('test-mode events are ignored unless the server is in test mode, so a test purchase can’t unlock anything in production', () => {
  assert.match(ls.interpretEvent(order('order_created', {}, undefined, { test_mode: true }), variants, live).reason, /test-mode/);
  assert.match(ls.interpretEvent(sub('subscription_created', {}, undefined, { test_mode: true }), variants, live).reason, /test-mode/);
  assert.equal(ls.interpretEvent(order('order_created', {}, undefined, { test_mode: true }), variants, { acceptTestMode: true }).type, 'book');
  assert.equal(ls.interpretEvent(order('order_created', {}, undefined, { test_mode: false }), variants, live).type, 'book');
});

test('unrelated events and junk payloads are ignored, never crash', () => {
  assert.equal(ls.interpretEvent({ meta: { event_name: 'license_key_created' } }, variants, live).type, 'ignore');
  assert.equal(ls.interpretEvent({}, variants, live).type, 'ignore');
  assert.equal(ls.interpretEvent(null, variants, live).type, 'ignore');
});
