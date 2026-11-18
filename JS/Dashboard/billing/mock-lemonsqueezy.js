/**
 * MOCK Lemon Squeezy store — DEMO DATA ONLY.
 *
 * Everything in this file is invented sample data for the billing screens while no real Lemon Squeezy account is
 * connected. It never talks to the network, never touches Supabase, never calls FogPayments, and nothing it does can
 * grant a plan or a purchase: entitlements only ever come from the signed webhook (supabase/functions/payments-webhook)
 * writing account_plans / campaign_entitlements on the server.
 *
 * The records use Lemon Squeezy's own JSON:API shape (type, id, attributes with the same field names as their API:
 * status, status_formatted, total, currency, card_brand, renews_at, ends_at, test_mode, …) so the real adapter
 * (server side, later) can return the same structure and the screens won't change. Amounts are in cents, USD.
 * Prices match the pricing page (Adventurer $3.99/month or $39.99/year, Dungeon Master $5.99/month or
 * $59.99/year, One-Shot $3.99 once). The campaign book has no price on the pricing page; the demo uses $4.99 and says so.
 * Names and e-mail addresses are fictional and use example.com.
 *
 * FogMockLemonSqueezy.create(now?) → a store object:
 *   .customer()                 the demo customer (the signed-in person in the demo, not a real one)
 *   .subscriptions() .orders() .invoices() .customers() .campaignUpgrades()
 *   .simulate(kind)             adds a demo order or event IN MEMORY ONLY: { ok, record, note }
 *   .summary()                  revenue / transaction totals computed from the records above
 */
(function (global) {
  'use strict';

  var DAY = 86400000;
  var STORE = { id: 'demo-store', name: 'Fog of the Dragon (demo store)' };
  var VARIANTS = {
    adventurer_monthly: { product: 'Adventurer', variant: 'Monthly', price: 399, interval: 'month', plan: 'adventurer' },
    adventurer_yearly: { product: 'Adventurer', variant: 'Yearly', price: 3999, interval: 'year', plan: 'adventurer' },
    dm_monthly: { product: 'Dungeon Master', variant: 'Monthly', price: 599, interval: 'month', plan: 'dungeon-master' },
    dm_yearly: { product: 'Dungeon Master', variant: 'Yearly', price: 5999, interval: 'year', plan: 'dungeon-master' },
    one_shot: { product: 'One-Shot', variant: 'Single session', price: 399, interval: null },
    campaign_book: { product: 'Campaign Book (digital)', variant: 'Digital', price: 499, interval: null, demoPrice: true },
  };
  var STATUS_TEXT = { active: 'Active', on_trial: 'On trial', paused: 'Paused', past_due: 'Past due', unpaid: 'Unpaid', cancelled: 'Cancelled', expired: 'Expired', paid: 'Paid', refunded: 'Refunded', partial_refund: 'Partially refunded', failed: 'Failed', pending: 'Pending', void: 'Void' };

  function iso(t) { return new Date(t).toISOString(); }

  function create(nowArg) {
    var now = nowArg ? new Date(nowArg).getTime() : Date.now();
    var seq = 1000;
    function nextId(prefix) { seq += 1; return prefix + '-' + seq; }

    var customers = [
      { name: 'Alex Rivera (demo)', email: 'alex.rivera@example.com', city: 'Lisbon', country: 'PT' },
      { name: 'Sam Okafor (demo)', email: 'sam.okafor@example.com', city: 'Lagos', country: 'NG' },
      { name: 'Riley Brook (demo)', email: 'riley.brook@example.com', city: 'Leeds', country: 'GB' },
      { name: 'Morgan Hale (demo)', email: 'morgan.hale@example.com', city: 'Denver', country: 'US' },
      { name: 'Jun Park (demo)', email: 'jun.park@example.com', city: 'Busan', country: 'KR' },
      { name: 'Noa Levi (demo)', email: 'noa.levi@example.com', city: 'Haifa', country: 'IL' },
    ].map(function (c, i) {
      return { type: 'customers', id: 'cus-' + (101 + i), attributes: { store_id: STORE.id, name: c.name, email: c.email, city: c.city, country: c.country, status: 'subscribed', created_at: iso(now - (200 - i * 25) * DAY), test_mode: true } };
    });
    var campaigns = [
      { id: 'demo-campaign-ashen', name: 'The Ashen Crown (demo)' },
      { id: 'demo-campaign-tides', name: 'Tides of Ember (demo)' },
    ];

    var subscriptions = [];
    var orders = [];
    var invoices = [];

    function order(cust, key, status, ago, extra) {
      var v = VARIANTS[key];
      var o = {
        type: 'orders', id: nextId('ord'),
        attributes: Object.assign({
          store_id: STORE.id, customer_id: cust.id, identifier: 'demo-' + seq, order_number: seq,
          user_name: cust.attributes.name, user_email: cust.attributes.email,
          currency: 'USD', subtotal: v.price, tax: 0, total: v.price, refunded_amount: status === 'refunded' ? v.price : 0,
          status: status, status_formatted: STATUS_TEXT[status],
          first_order_item: { product_name: v.product, variant_name: v.variant, price: v.price },
          created_at: iso(now - ago * DAY), refunded_at: status === 'refunded' ? iso(now - (ago - 2) * DAY) : null, test_mode: true,
        }, extra || {}),
        meta: { variant: key, demoPrice: !!v.demoPrice },
      };
      orders.push(o);
      return o;
    }
    function subscription(cust, key, status, startedAgo, opts) {
      var v = VARIANTS[key];
      opts = opts || {};
      var first = order(cust, key, 'paid', startedAgo);
      var periodMs = (v.interval === 'year' ? 365 : 30) * DAY;
      var cycles = Math.max(1, Math.floor(startedAgo * DAY / periodMs) + 1);
      var s = {
        type: 'subscriptions', id: nextId('sub'),
        attributes: {
          store_id: STORE.id, customer_id: cust.id, order_id: first.id, product_name: v.product, variant_name: v.variant,
          user_name: cust.attributes.name, user_email: cust.attributes.email,
          status: status, status_formatted: STATUS_TEXT[status], cancelled: status === 'cancelled',
          card_brand: opts.card || 'visa', card_last_four: opts.last4 || '4242',
          renews_at: status === 'cancelled' || status === 'expired' ? null : iso(now - startedAgo * DAY + cycles * periodMs),
          ends_at: status === 'cancelled' ? iso(now + (opts.endsIn || 12) * DAY) : status === 'expired' ? iso(now - 3 * DAY) : null,
          created_at: iso(now - startedAgo * DAY), test_mode: true,
        },
        meta: { variant: key, plan: v.plan, price: v.price, interval: v.interval },
      };
      subscriptions.push(s);
      for (var i = 0; i < cycles; i++) {
        var failed = opts.failLast && i === cycles - 1;
        invoices.push({
          type: 'subscription-invoices', id: nextId('inv'),
          attributes: {
            store_id: STORE.id, subscription_id: s.id, customer_id: cust.id, user_name: cust.attributes.name, user_email: cust.attributes.email,
            billing_reason: i === 0 ? 'initial' : 'renewal', card_brand: s.attributes.card_brand, card_last_four: s.attributes.card_last_four,
            currency: 'USD', subtotal: v.price, tax: 0, total: v.price, status: failed ? 'pending' : 'paid', status_formatted: failed ? 'Payment failed (retrying)' : 'Paid',
            created_at: iso(now - startedAgo * DAY + i * periodMs), test_mode: true,
          },
          meta: { failed: !!failed, product: v.product + ' · ' + v.variant },
        });
      }
      return s;
    }

    var C = customers;
    subscription(C[0], 'adventurer_monthly', 'active', 75);
    subscription(C[1], 'dm_yearly', 'active', 140, { card: 'mastercard', last4: '5100' });
    subscription(C[2], 'dm_monthly', 'past_due', 64, { failLast: true, last4: '0341' });
    subscription(C[3], 'adventurer_yearly', 'cancelled', 300, { endsIn: 45, card: 'amex', last4: '8431' });
    subscription(C[4], 'adventurer_monthly', 'expired', 95, { last4: '1881' });
    subscription(C[5], 'dm_monthly', 'active', 20, { last4: '7762' });
    [
      order(C[0], 'one_shot', 'paid', 9, { campaign: campaigns[0] }),
      order(C[3], 'campaign_book', 'paid', 30, { campaign: campaigns[0] }),
      order(C[1], 'campaign_book', 'refunded', 16, { campaign: campaigns[1] }),
      order(C[2], 'one_shot', 'failed', 4, { campaign: campaigns[1] }),
    ];
    var demoCustomer = C[0];

    function summary() {
      var last30 = now - 30 * DAY;
      var paidOrders = orders.filter(function (o) { return o.attributes.status === 'paid' || o.attributes.status === 'refunded'; });
      var renewals = invoices.filter(function (i) { return i.attributes.billing_reason === 'renewal' && i.attributes.status === 'paid'; });
      var gross = paidOrders.reduce(function (n, o) { return n + o.attributes.total; }, 0) + renewals.reduce(function (n, i) { return n + i.attributes.total; }, 0);
      var refunds = orders.reduce(function (n, o) { return n + (o.attributes.refunded_amount || 0); }, 0);
      var inLast30 = function (t) { return new Date(t).getTime() >= last30; };
      var gross30 = paidOrders.filter(function (o) { return inLast30(o.attributes.created_at); }).reduce(function (n, o) { return n + o.attributes.total; }, 0) +
        renewals.filter(function (i) { return inLast30(i.attributes.created_at); }).reduce(function (n, i) { return n + i.attributes.total; }, 0);
      var mrr = subscriptions.filter(function (s) { return s.attributes.status === 'active' || s.attributes.status === 'past_due'; })
        .reduce(function (n, s) { return n + (s.meta.interval === 'year' ? Math.round(s.meta.price / 12) : s.meta.price); }, 0);
      var byPlan = {};
      subscriptions.forEach(function (s) {
        var k = s.attributes.product_name;
        byPlan[k] = byPlan[k] || { active: 0, cancelled: 0, pastDue: 0, expired: 0 };
        var st = s.attributes.status;
        if (st === 'active') byPlan[k].active++; else if (st === 'cancelled') byPlan[k].cancelled++; else if (st === 'past_due') byPlan[k].pastDue++; else if (st === 'expired') byPlan[k].expired++;
      });
      return {
        currency: 'USD', gross: gross, refunds: refunds, net: gross - refunds, gross30: gross30, mrr: mrr,
        activeSubscriptions: subscriptions.filter(function (s) { return s.attributes.status === 'active'; }).length,
        cancelled: subscriptions.filter(function (s) { return s.attributes.status === 'cancelled'; }).length,
        failedPayments: orders.filter(function (o) { return o.attributes.status === 'failed'; }).length + invoices.filter(function (i) { return i.meta.failed; }).length,
        refundedOrders: orders.filter(function (o) { return o.attributes.status === 'refunded'; }).length,
        oneTime: orders.filter(function (o) { return !VARIANTS[o.meta.variant].interval; }).length,
        byPlan: byPlan,
      };
    }

    /** Every money movement, newest first (orders, renewals, refunds, failures). */
    function transactions() {
      var list = [];
      orders.forEach(function (o) {
        var a = o.attributes;
        list.push({ id: o.id, at: a.created_at, kind: VARIANTS[o.meta.variant].interval ? 'subscription' : 'one-time', what: a.first_order_item.product_name + ' · ' + a.first_order_item.variant_name, who: a.user_name, amount: a.total, status: a.status === 'refunded' ? 'paid' : a.status, campaign: a.campaign || null, demoPrice: o.meta.demoPrice });
        if (a.status === 'refunded') list.push({ id: o.id + '-refund', at: a.refunded_at, kind: 'refund', what: 'Refund: ' + a.first_order_item.product_name, who: a.user_name, amount: -a.refunded_amount, status: 'refunded', campaign: a.campaign || null });
      });
      invoices.filter(function (i) { return i.attributes.billing_reason === 'renewal'; }).forEach(function (i) {
        var a = i.attributes;
        list.push({ id: i.id, at: a.created_at, kind: 'renewal', what: 'Renewal: ' + i.meta.product, who: a.user_name, amount: a.total, status: i.meta.failed ? 'failed' : 'paid' });
      });
      return list.sort(function (x, y) { return x.at < y.at ? 1 : -1; });
    }

    function simulate(kind) {
      var cust = demoCustomer;
      if (kind === 'one_shot' || kind === 'campaign_book') {
        var o = order(cust, kind, 'paid', 0, { campaign: campaigns[0] });
        return { ok: true, record: o, note: 'Demo order added to this page only. Nothing was charged and nothing was unlocked.' };
      }
      if (kind === 'failed_payment') {
        var f = order(cust, 'one_shot', 'failed', 0, { campaign: campaigns[0] });
        return { ok: true, record: f, note: 'Demo failed payment added. In a real store the customer would be asked to update their card.' };
      }
      if (kind === 'refund') {
        var target = orders.filter(function (x) { return x.attributes.customer_id === cust.id && x.attributes.status === 'paid'; }).pop();
        if (!target) return { ok: false, note: 'No demo order to refund.' };
        target.attributes.status = 'refunded'; target.attributes.status_formatted = STATUS_TEXT.refunded; target.attributes.refunded_amount = target.attributes.total; target.attributes.refunded_at = iso(Date.now());
        return { ok: true, record: target, note: 'Demo refund recorded on this page only.' };
      }
      if (kind === 'cancel') {
        var sub = subscriptions.find(function (x) { return x.attributes.customer_id === cust.id && x.attributes.status === 'active'; });
        if (!sub) return { ok: false, note: 'No active demo subscription to cancel.' };
        sub.attributes.status = 'cancelled'; sub.attributes.status_formatted = STATUS_TEXT.cancelled; sub.attributes.cancelled = true;
        sub.attributes.ends_at = sub.attributes.renews_at; sub.attributes.renews_at = null;
        return { ok: true, record: sub, note: 'Demo subscription cancelled on this page only. Your real plan did not change.' };
      }
      return { ok: false, note: 'Unknown demo action.' };
    }

    function mine(list) { return list.filter(function (x) { return x.attributes.customer_id === demoCustomer.id; }); }

    return {
      isDemo: true,
      store: STORE,
      customer: function () { return demoCustomer; },
      customers: function () { return customers; },
      subscriptions: function (all) { return all ? subscriptions : mine(subscriptions); },
      orders: function (all) { return all ? orders : mine(orders); },
      invoices: function (all) { return all ? invoices : mine(invoices); },
      campaignUpgrades: function (all) { return (all ? orders : mine(orders)).filter(function (o) { return !!o.attributes.campaign; }); },
      transactions: transactions,
      summary: summary,
      simulate: simulate,
      variants: VARIANTS,
    };
  }

  global.FogMockLemonSqueezy = { create: create, STATUS_TEXT: STATUS_TEXT };
})(typeof window !== 'undefined' ? window : globalThis);
