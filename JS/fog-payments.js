/**
 * Payments, browser side (Lemon Squeezy through the Supabase Edge Function payments-checkout).
 *
 * This file can only START a purchase: it asks the server for a checkout address and sends the person to the payment
 * provider's page. It never unlocks anything. Plans and purchases are recorded by the provider's signed webhook
 * (supabase/functions/payments-webhook), and the interface learns about them from the database afterwards.
 *
 * Switched on with FOG_PAYMENTS=true in .env (node tools/write-supabase-config.mjs); off by default, in which case
 * enabled() is false and the pages say that payments aren't set up.
 */
(function (global) {
  'use strict';

  function enabled() {
    var c = global.FOG_SUPABASE_CONFIG;
    return !!(c && c.payments) && !!(global.FogSupabase && global.FogSupabase.client);
  }

  /** product: plan_dm_monthly | plan_dm_yearly | plan_fogger_monthly | plan_fogger_yearly | campaign_book_digital */
  async function checkout(product, campaignId) {
    if (!enabled()) return { ok: false, message: 'Payments are not set up yet.' };
    var res = await global.FogSupabase.client.functions.invoke('payments-checkout', { body: { product: product, campaignId: campaignId || null } });
    if (res.error) {
      var msg = 'The checkout could not be started. Try again in a moment.';
      try {
        if (res.error.context && res.error.context.json) msg = (await res.error.context.json()).error || msg;
      } catch (e) { /* keep the generic message */ }
      return { ok: false, message: msg };
    }
    var url = res.data && res.data.url;
    // Only ever go to the payment provider's own https address.
    if (typeof url !== 'string' || !/^https:\/\/([a-z0-9-]+\.)*lemonsqueezy\.com\//i.test(url)) return { ok: false, message: 'The payment provider returned an unexpected address, so nothing was opened.' };
    return { ok: true, url: url };
  }

  /** checkout + open it. Resolves { ok:false, message } when it could not be started. */
  async function buy(product, campaignId) {
    var res = await checkout(product, campaignId);
    if (res.ok) global.location.href = res.url;
    return res;
  }

  /**
   * Demo checkout (the Marketplace checkout with simulated card payments): available while the owner has switched
   * app_flags 'demo_payments' on. It creates the same orders and access records a real provider will; only the payment
   * step is simulated. Resolves { demoPayments, testOwner } (both false when it can't be checked).
   */
  var demoInfo = null;
  async function demo() {
    if (demoInfo) return demoInfo;
    var client = global.FogSupabase && global.FogSupabase.client;
    if (!client || typeof client.rpc !== 'function') return { demoPayments: false, testOwner: false };
    try {
      var r = await client.rpc('marketplace_access');
      if (r.error) return { demoPayments: false, testOwner: false, notSetUp: /function|schema cache|does not exist/i.test(r.error.message || ''), error: r.error.message };
      demoInfo = { demoPayments: !!r.data.demoPayments, testOwner: !!r.data.testOwner, planProvider: r.data.planProvider || null };
    } catch (e) { return { demoPayments: false, testOwner: false, error: 'no connection' }; }
    return demoInfo;
  }
  /** Sends one item straight to the Marketplace checkout ("Buy now"). dashboardBase: '' on the Dashboard, 'dashboard.html' elsewhere. */
  function buyWithDemoCheckout(item, dashboardBase) {
    if (!global.FogCart) return { ok: false, message: 'The cart isn’t available on this page.' };
    var r = global.FogCart.buyNow(item);
    if (!r.ok) return r;
    if (dashboardBase) global.location.href = dashboardBase + '#marketplace/checkout';
    else if (global.FogDashboardRouter) global.FogDashboardRouter.navigateTo('#marketplace/checkout');
    return { ok: true };
  }

  global.FogPayments = { enabled: enabled, checkout: checkout, buy: buy, demo: demo, buyWithDemoCheckout: buyWithDemoCheckout };
})(window);
