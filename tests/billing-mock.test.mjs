/**
 * The mock Lemon Squeezy store (JS/Dashboard/billing/mock-lemonsqueezy.js) and the Billing page's isolation rules:
 * demo data only, Lemon Squeezy's record shapes, correct totals, and no path from a demo action to a real payment or an
 * entitlement. Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(new URL('../JS/Dashboard/billing/mock-lemonsqueezy.js', import.meta.url), 'utf8');
const PAGE = fs.readFileSync(new URL('../JS/Dashboard/billing/billing-page.js', import.meta.url), 'utf8');
function load() {
  const window = {};
  vm.runInNewContext(SRC, { window, Intl, Date, Math, JSON });
  return window.FogMockLemonSqueezy;
}
const NOW = '2026-11-11T12:00:00Z';

test('mock store: isolated — no network, no Supabase, no payments, no entitlement writes in its code', () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const bad of ['fetch(', 'XMLHttpRequest', 'FogSupabase', 'FogPayments', 'account_plans', 'campaign_entitlements', 'localStorage', '.rpc(', 'functions.invoke']) {
    assert.ok(!code.includes(bad), 'the mock must not use ' + bad);
  }
  const pageCode = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/FogPayments\.(buy|checkout)\(/.test(pageCode), 'the Billing page never starts a checkout');
  assert.ok(!/\.from\(|functions\.invoke/.test(pageCode), 'the Billing page never writes tables or calls an Edge Function');
  const rpcs = [...pageCode.matchAll(/\.rpc\('([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(rpcs)].sort(), ['demo_set_plan', 'marketplace_access'], 'its only server calls are the test-owner tier simulator (checked on the server), never from the demo store');
});

test('mock store: records use Lemon Squeezy JSON:API shapes and are all marked test mode / demo', () => {
  const s = load().create(NOW);
  for (const [list, type] of [[s.subscriptions(true), 'subscriptions'], [s.orders(true), 'orders'], [s.invoices(true), 'subscription-invoices'], [s.customers(), 'customers']]) {
    assert.ok(list.length > 0, type + ' present');
    for (const r of list) {
      assert.equal(r.type, type);
      assert.equal(typeof r.id, 'string');
      assert.equal(r.attributes.test_mode, true);
    }
  }
  for (const c of s.customers()) { assert.match(c.attributes.email, /@example\.com$/); assert.match(c.attributes.name, /\(demo\)$/); }
  const sub = s.subscriptions(true)[0].attributes;
  for (const k of ['status', 'status_formatted', 'product_name', 'variant_name', 'card_brand', 'card_last_four', 'renews_at', 'ends_at', 'created_at']) assert.ok(k in sub, 'subscription has ' + k);
  const ord = s.orders(true)[0].attributes;
  for (const k of ['total', 'currency', 'status', 'first_order_item', 'refunded_amount']) assert.ok(k in ord, 'order has ' + k);
});

test('mock store: covers the requested cases and uses the pricing page prices', () => {
  const s = load().create(NOW);
  const subStatus = s.subscriptions(true).map((x) => x.attributes.status);
  for (const st of ['active', 'cancelled', 'past_due', 'expired']) assert.ok(subStatus.includes(st), 'a ' + st + ' subscription');
  const ordStatus = s.orders(true).map((x) => x.attributes.status);
  for (const st of ['paid', 'refunded', 'failed']) assert.ok(ordStatus.includes(st), 'a ' + st + ' order');
  assert.ok(s.campaignUpgrades(true).length >= 3 && s.campaignUpgrades(true).every((o) => o.attributes.campaign && /\(demo\)$/.test(o.attributes.campaign.name)), 'campaign upgrades tied to demo campaigns');
  assert.ok(s.invoices(true).some((i) => i.meta.failed), 'a failed renewal');
  assert.deepEqual([s.variants.dm_monthly.price, s.variants.dm_yearly.price, s.variants.fogger_monthly.price, s.variants.fogger_yearly.price, s.variants.one_shot.price], [399, 4549, 599, 6829, 399]);
  assert.equal(s.variants.campaign_book.demoPrice, true, 'the book has no price on the pricing page: marked as a sample price');
});

test('mock store: summary totals add up from the records', () => {
  const s = load().create(NOW);
  const sum = s.summary();
  const tx = s.transactions();
  const paid = tx.filter((t) => t.status === 'paid' || (t.status === 'refunded' && t.kind !== 'refund')).reduce((n, t) => n + t.amount, 0);
  const refunds = -tx.filter((t) => t.kind === 'refund').reduce((n, t) => n + t.amount, 0);
  assert.equal(sum.gross, paid);
  assert.equal(sum.refunds, refunds);
  assert.equal(sum.net, sum.gross - sum.refunds);
  const expectedMrr = s.subscriptions(true).filter((x) => ['active', 'past_due'].includes(x.attributes.status)).reduce((n, x) => n + (x.meta.interval === 'year' ? Math.round(x.meta.price / 12) : x.meta.price), 0);
  assert.equal(sum.mrr, expectedMrr);
  assert.ok(tx.every((t, i) => i === 0 || tx[i - 1].at >= t.at), 'newest first');
});

test('mock store: demo actions change only the in-memory sample data, and each store starts fresh', () => {
  const M = load();
  const s = M.create(NOW);
  const before = s.orders().length;
  const r = s.simulate('one_shot');
  assert.equal(r.ok, true);
  assert.match(r.note, /Nothing was charged and nothing was unlocked/);
  assert.equal(s.orders().length, before + 1);
  assert.equal(s.simulate('cancel').ok, true);
  assert.equal(s.subscriptions()[0].attributes.status, 'cancelled');
  assert.match(s.simulate('cancel').note, /No active demo subscription/);
  assert.equal(s.simulate('refund').ok, true);
  assert.equal(s.simulate('nope').ok, false);
  assert.equal(M.create(NOW).orders().length, before, 'a new store (page reload) has none of those changes');
});
