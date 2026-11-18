/**
 * Billing (#billing) and the owner's Revenue view (#billing/revenue).
 *
 * Two clearly separate things on one page:
 *   1. YOUR ACCOUNT — real: your plan as the database knows it (FogAccount, from account_plans), whether payments are
 *      switched on, and the provider's customer portal when Lemon Squeezy has sent one. Nothing invented.
 *   2. DEMO — only when FOG_DEMO_BILLING=true (config.demoBilling): sample data from FogMockLemonSqueezy so the billing
 *      screens can be designed and tested before a real store is connected. Every demo block is labelled, uses
 *      example.com customers and "(demo)" names, and the "try it" buttons only change this page's sample data.
 *      They never call FogPayments, Supabase or any server, so they cannot charge anyone or unlock anything.
 *
 * The Revenue view is for the site owner only: config.demoBillingOwner must be the signed-in user's id. There is no
 * admin role in the database yet, so this is a convenience gate for a page that shows sample data only; real revenue
 * will come from a server function that checks the owner on the server (see README → Payments → Billing screens).
 *
 * Provider interface (what a real adapter must return so the screens stay the same): see FogBillingProviders below.
 */
(function (global) {
  'use strict';

  function esc(s) { return global.FogAccount.escapeHtml(s); }
  function cfg() { return global.FOG_SUPABASE_CONFIG || {}; }
  var money = function (cents, currency) {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format((cents || 0) / 100); } catch (e) { return '$' + ((cents || 0) / 100).toFixed(2); }
  };
  function day(isoStr) { return isoStr ? new Date(isoStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

  /**
   * Billing data sources. Only 'demo' exists today. A future 'lemonsqueezy' source must run on the server (an Edge
   * Function using the LS API key stored as a Supabase secret) and return the same shapes as FogMockLemonSqueezy:
   * subscriptions(), orders(), invoices(), campaignUpgrades(), transactions(), summary().
   */
  var FogBillingProviders = {
    demoEnabled: function () { return cfg().demoBilling === true && !!global.FogMockLemonSqueezy; },
    isOwner: function () {
      var acc = global.FogAccount.getAccount && global.FogAccount.getAccount();
      var owner = cfg().demoBillingOwner;
      return !!(acc && owner && acc.id === owner);
    },
    demo: null,
    getDemo: function () {
      if (!FogBillingProviders.demoEnabled()) return null;
      if (!FogBillingProviders.demo) FogBillingProviders.demo = global.FogMockLemonSqueezy.create();
      return FogBillingProviders.demo;
    },
  };

  var PLAN_NAMES = { free: 'Free', adventurer: 'Adventurer', 'dungeon-master': 'Dungeon Master', warlord: 'Free', 'fogger-of-the-dragons': 'Dungeon Master' };

  function statusPill(status, text) {
    var tone = { active: 'ok', paid: 'ok', on_trial: 'ok', cancelled: 'warn', past_due: 'bad', unpaid: 'bad', failed: 'bad', pending: 'warn', refunded: 'muted', expired: 'muted', partial_refund: 'muted' }[status] || 'muted';
    return '<span class="bl-pill is-' + tone + '">' + esc(text || global.FogMockLemonSqueezy.STATUS_TEXT[status] || status) + '</span>';
  }

  function demoTag() { return '<span class="bl-demo-tag" title="Sample data from the mock Lemon Squeezy store">Demo</span>'; }

  function realAccount(t) {
    var plan = global.FogAccount.getPlan ? global.FogAccount.getPlan() : null;
    var info = global.FogAccount.getPlanInfo ? global.FogAccount.getPlanInfo() : null;
    var payments = !!(global.FogPayments && global.FogPayments.enabled && global.FogPayments.enabled());
    var planName = plan ? (PLAN_NAMES[plan.id] || plan.name) : 'Warlord (free)';
    var rows = '<dl class="bl-facts"><div><dt>Plan</dt><dd><strong id="bl-real-plan">' + esc(planName) + '</strong></dd></div>' +
      (info ? '<div><dt>Status</dt><dd>' + esc(info.status) + '</dd></div><div><dt>' + (info.status === 'active' ? 'Renews or ends' : 'Paid until') + '</dt><dd>' + day(info.periodEnd) + '</dd></div>' : '') +
      '<div><dt>Payments</dt><dd>' + (payments ? 'Switched on (Lemon Squeezy)' : t && t.demoPayments ? 'Demo payments (simulated with test cards; no money moves)' : 'Not set up yet: no payment can be taken') + '</dd></div></dl>';
    var actions = '<div class="bl-actions">' + (info && info.portalUrl ? '<a class="btn btn-secondary btn-sm" href="' + esc(info.portalUrl) + '" target="_blank" rel="noopener">Manage subscription (Lemon Squeezy)</a>' : '') +
      '<button type="button" class="btn btn-primary btn-sm" data-bl-go="#upgrade">See the plans</button><button type="button" class="btn btn-secondary btn-sm" data-bl-go="#marketplace/orders">Order history</button></div>';
    return '<section class="bl-card bl-real" aria-labelledby="bl-real-h"><h2 class="bl-h" id="bl-real-h">Your account</h2>' +
      '<p class="bl-muted">This is real: your plan as our server records it. Purchases you make for a campaign (like its book) are shown in that campaign\'s Logbook.</p>' + rows + actions + '</section>';
  }

  // What each existing plan includes, as the app enforces it (no new tiers; prices unchanged).
  var TIER_ROWS = [
    ['Characters', 'Unlimited', 'Unlimited', 'Unlimited'],
    ['Active campaigns you run', '2', '5', 'Unlimited'],
    ['People per campaign', '5', '10', 'Unlimited'],
    ['Voice (audio)', 'Unlimited', 'Unlimited', 'Unlimited'],
    ['Video quality', 'Basic', 'Extended', 'Full HD'],
    ['Logbook', 'Manual quotes', 'AI-assisted chapters', 'Full auto + print-ready PDF'],
    ['Homebrew creation', '—', '✓', '✓'],
    ['Foggy AI assistant', '—', 'Dashboard only', 'Full (Dashboard + Campaign)'],
    ['Content sharing', '—', '—', "Party gets DM's content"],
  ];
  function tierSimulator(t) {
    if (!t || !t.testOwner) return '';
    var names = [['free', 'Free'], ['adventurer', 'Adventurer'], ['dungeon-master', 'Dungeon Master']];
    var real = t.planProvider && t.planProvider !== 'demo';
    return '<section class="bl-card bl-demo" id="bl-tiers" aria-labelledby="bl-ti-h"><h2 class="bl-h" id="bl-ti-h">Test tiers ' + demoTag() + '</h2>' +
      '<p class="bl-muted">You are a configured test owner. Switching sets your plan in the real plan table, labelled "demo", so every limit and server check behaves exactly as for a subscriber. Nobody else can do this' + (t.demoPayments ? '' : ', and it only works while demo payments are switched on') + '.</p>' +
      (t.planProvider === 'demo' ? '<p class="bl-demo-active" role="status"><strong>Demo tier active:</strong> ' + esc(PLAN_NAMES[t.plan] || t.plan) + '. Switch back to Free to end it.</p>' : '') +
      (real ? '<p class="bl-muted">You have a real paid plan, so the simulator is off.</p>' : '<div class="bl-actions" role="group" aria-label="Switch plan">' + names.map(function (n) { return '<button type="button" class="btn btn-sm ' + (t.plan === n[0] ? 'btn-primary' : 'btn-secondary') + '" data-bl-tier="' + n[0] + '"' + (t.demoPayments ? '' : ' disabled') + ' aria-pressed="' + (t.plan === n[0]) + '">' + esc(n[1]) + '</button>'; }).join('') + '</div>') +
      '<div class="bl-table-wrap"><table class="bl-table bl-tier-table"><thead><tr><th scope="col">Feature</th>' + names.map(function (n) { return '<th scope="col"' + (t.plan === n[0] ? ' class="is-current"' : '') + '>' + esc(n[1]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      TIER_ROWS.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th>' + r.slice(1).map(function (c, i) { return '<td' + (t.plan === names[i][0] ? ' class="is-current"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="bl-sim-note" id="bl-tier-note" role="status" aria-live="polite"></p></section>';
  }

  function demoBanner(extra) {
    return '<div class="bl-demo-banner" role="note"><strong>Demo mode — sample data.</strong> Everything below comes from a mock Lemon Squeezy store. ' +
      'No real account is connected, no money moves, no subscription exists, and nothing here unlocks or changes your plan.' + (extra || '') + '</div>';
  }

  function table(cols, rows, empty) {
    if (!rows.length) return '<p class="bl-muted">' + esc(empty) + '</p>';
    return '<div class="bl-table-wrap"><table class="bl-table"><thead><tr>' + cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  function demoCustomerView(store) {
    var subs = store.subscriptions();
    var oneTime = store.orders().filter(function (o) { return !store.variants[o.meta.variant].interval; });
    var history = store.transactions().filter(function (t) { return t.who === store.customer().attributes.name; });
    var subHtml = subs.length ? subs.map(function (s) {
      var a = s.attributes;
      return '<article class="bl-sub"><div><h4>' + esc(a.product_name) + ' <span class="bl-muted">· ' + esc(a.variant_name) + '</span> ' + statusPill(a.status) + '</h4>' +
        '<p class="bl-muted">' + money(s.meta.price) + ' / ' + esc(s.meta.interval) + ' · ' + esc(a.card_brand) + ' ending ' + esc(a.card_last_four) + ' · started ' + day(a.created_at) + '</p>' +
        '<p>' + (a.renews_at ? 'Renews ' + day(a.renews_at) : a.ends_at ? 'Ends ' + day(a.ends_at) + ' (cancelled: the plan stays until then)' : 'Ended') + '</p></div></article>';
    }).join('') : '<p class="bl-muted">No demo subscriptions.</p>';
    return demoBanner() +
      '<section class="bl-card bl-demo" aria-labelledby="bl-ds-h"><h2 class="bl-h" id="bl-ds-h">Subscriptions ' + demoTag() + '</h2><p class="bl-muted">Demo customer: ' + esc(store.customer().attributes.name) + ' · ' + esc(store.customer().attributes.email) + '</p>' + subHtml + '</section>' +
      '<section class="bl-card bl-demo" aria-labelledby="bl-do-h"><h2 class="bl-h" id="bl-do-h">One-time purchases &amp; campaign upgrades ' + demoTag() + '</h2>' +
      table(['Date', 'Purchase', 'Campaign', 'Amount', 'Status'], oneTime.map(function (o) {
        var a = o.attributes;
        return [day(a.created_at), esc(a.first_order_item.product_name), a.campaign ? esc(a.campaign.name) : '—', money(a.total) + (o.meta.demoPrice ? ' <span class="bl-muted" title="The pricing page has no price for the campaign book; this is a sample price">(sample price)</span>' : ''), statusPill(a.status)];
      }), 'No one-time purchases.') + '</section>' +
      '<section class="bl-card bl-demo" aria-labelledby="bl-dh-h"><h2 class="bl-h" id="bl-dh-h">Payment history ' + demoTag() + '</h2>' +
      table(['Date', 'What', 'Amount', 'Result'], history.map(function (t) {
        return [day(t.at), esc(t.what), '<span class="' + (t.amount < 0 ? 'bl-neg' : '') + '">' + money(t.amount) + '</span>', statusPill(t.status, t.status === 'failed' ? 'Failed' : t.status === 'refunded' ? 'Refunded' : 'Paid')];
      }), 'No payments yet.') + '</section>' +
      '<section class="bl-card bl-demo bl-try" aria-labelledby="bl-dt-h"><h2 class="bl-h" id="bl-dt-h">Try the flows ' + demoTag() + '</h2>' +
      '<p class="bl-muted">These buttons change the sample data on this page only (it resets when you reload). They do not open a checkout, call our server, or change your plan.</p>' +
      '<div class="bl-actions"><button type="button" class="btn btn-secondary btn-sm" data-bl-sim="one_shot">Demo: buy a One-Shot</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-bl-sim="campaign_book">Demo: buy a campaign book</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-bl-sim="failed_payment">Demo: a failed payment</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-bl-sim="refund">Demo: refund the last order</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-bl-sim="cancel">Demo: cancel the subscription</button></div>' +
      '<p class="bl-sim-note" id="bl-sim-note" role="status" aria-live="polite"></p></section>' +
      (FogBillingProviders.isOwner() ? '<p><a href="#billing/revenue" class="bl-link">Open the Revenue view (owner, demo data) →</a></p>' : '');
  }

  function revenueView(store) {
    var s = store.summary();
    var tiles = [
      ['Net revenue (all time)', money(s.net), 'after ' + money(s.refunds) + ' in refunds'],
      ['Last 30 days', money(s.gross30), 'orders and renewals'],
      ['Monthly recurring', money(s.mrr), 'yearly plans counted per month'],
      ['Active subscriptions', String(s.activeSubscriptions), s.cancelled + ' cancelled, still running'],
      ['Failed payments', String(s.failedPayments), 'being retried or abandoned'],
      ['One-time purchases', String(s.oneTime), s.refundedOrders + ' refunded'],
    ];
    var plans = Object.keys(s.byPlan).map(function (k) { var p = s.byPlan[k]; return [esc(k), String(p.active), String(p.pastDue), String(p.cancelled), String(p.expired)]; });
    var tx = store.transactions();
    return demoBanner(' This Revenue view is visible only to the site owner set in FOG_DEMO_BILLING_OWNER.') +
      '<section class="bl-card bl-demo" aria-labelledby="bl-rs-h"><h2 class="bl-h" id="bl-rs-h">Summary ' + demoTag() + '</h2><div class="bl-tiles">' +
      tiles.map(function (t) { return '<div class="bl-tile"><span class="bl-tile-l">' + esc(t[0]) + '</span><strong class="bl-tile-v">' + esc(t[1]) + '</strong><span class="bl-muted">' + esc(t[2]) + '</span></div>'; }).join('') + '</div></section>' +
      '<section class="bl-card bl-demo" aria-labelledby="bl-rp-h"><h2 class="bl-h" id="bl-rp-h">Subscriptions by plan ' + demoTag() + '</h2>' + table(['Plan', 'Active', 'Past due', 'Cancelled', 'Expired'], plans, 'No subscriptions.') + '</section>' +
      '<section class="bl-card bl-demo" aria-labelledby="bl-rt-h"><h2 class="bl-h" id="bl-rt-h">Transactions ' + demoTag() + '</h2>' +
      '<div class="bl-filter" role="group" aria-label="Show">' + ['all', 'paid', 'failed', 'refunded'].map(function (f, i) { return '<button type="button" class="bl-chip' + (i === 0 ? ' is-on' : '') + '" data-bl-filter="' + f + '" aria-pressed="' + (i === 0) + '">' + f.charAt(0).toUpperCase() + f.slice(1) + '</button>'; }).join('') + '</div>' +
      '<div id="bl-tx">' + txTable(tx, 'all') + '</div></section>' +
      '<section class="bl-card bl-demo" aria-labelledby="bl-rc-h"><h2 class="bl-h" id="bl-rc-h">Customers &amp; campaigns ' + demoTag() + '</h2>' +
      table(['Customer', 'Country', 'Subscriptions', 'Campaign purchases'], store.customers().map(function (c) {
        var subs = store.subscriptions(true).filter(function (x) { return x.attributes.customer_id === c.id; });
        var camp = store.campaignUpgrades(true).filter(function (o) { return o.attributes.customer_id === c.id; });
        return [esc(c.attributes.name) + '<br><span class="bl-muted">' + esc(c.attributes.email) + '</span>', esc(c.attributes.country),
          subs.map(function (x) { return esc(x.attributes.product_name) + ' ' + statusPill(x.attributes.status); }).join('<br>') || '—',
          camp.map(function (o) { return esc(o.attributes.first_order_item.product_name) + ' · ' + esc(o.attributes.campaign.name) + ' ' + statusPill(o.attributes.status); }).join('<br>') || '—'];
      }), 'No customers.') + '</section>';
  }

  function txTable(tx, filter) {
    var rows = tx.filter(function (t) { return filter === 'all' || t.status === filter; });
    return table(['Date', 'Type', 'What', 'Customer', 'Campaign', 'Amount', 'Result'], rows.map(function (t) {
      return [day(t.at), esc(t.kind), esc(t.what), esc(t.who), t.campaign ? esc(t.campaign.name) : '—', '<span class="' + (t.amount < 0 ? 'bl-neg' : '') + '">' + money(t.amount) + '</span>', statusPill(t.status, t.status === 'failed' ? 'Failed' : t.status === 'refunded' ? 'Refunded' : 'Paid')];
    }), 'Nothing matches.');
  }

  function init(container, params) {
    var revenue = !!(params && params.revenue);
    var head = container.querySelector('#bl-head-sub');
    var body = container.querySelector('#bl-body');
    var demoOn = FogBillingProviders.demoEnabled();
    container.querySelector('#bl-title').textContent = revenue ? 'Revenue' : 'Billing';

    function draw() {
      if (revenue) {
        head.textContent = 'Sales, subscriptions and payments across the store.';
        if (!demoOn || !FogBillingProviders.isOwner()) {
          body.innerHTML = '<section class="bl-card"><h2 class="bl-h">Not available</h2><p>The Revenue view is only for the site owner, and only with demo billing switched on. Real revenue needs the Lemon Squeezy connection, which isn\'t set up yet.</p><button type="button" class="btn btn-secondary btn-sm" data-bl-go="#billing">Back to Billing</button></section>';
          return;
        }
        body.innerHTML = revenueView(FogBillingProviders.getDemo());
        return;
      }
      head.textContent = 'Your plan and payments.';
      body.innerHTML = realAccount(tierInfo) + tierSimulator(tierInfo) + (demoOn ? demoCustomerView(FogBillingProviders.getDemo())
        : '<section class="bl-card"><h2 class="bl-h">Payment history</h2><p class="bl-muted">Your invoices and receipts will appear here once payments are connected. Until then there is nothing to show (and nothing has been charged).</p></section>');
    }

    var tierInfo = null;
    async function loadTiers() {
      var client = global.FogSupabase && global.FogSupabase.client;
      if (!client || typeof client.rpc !== 'function') return;
      var r = await client.rpc('marketplace_access');
      if (r.error || !r.data) return;
      tierInfo = r.data;
      if (!revenue) draw();
    }
    async function switchTier(plan) {
      var r = await global.FogSupabase.client.rpc('demo_set_plan', { p_plan: plan });
      var msg = r.error ? r.error.message : 'Your plan is now ' + (PLAN_NAMES[r.data] || r.data) + ' (demo).';
      if (!r.error && global.FogAccount.refreshPlan) await global.FogAccount.refreshPlan();
      await loadTiers();
      var n = container.querySelector('#bl-tier-note');
      if (n) n.textContent = msg;
    }

    function onClick(e) {
      var tier = e.target.closest('[data-bl-tier]');
      if (tier) { switchTier(tier.getAttribute('data-bl-tier')); return; }
      var go = e.target.closest('[data-bl-go]');
      if (go) { global.FogDashboardRouter.navigateTo(go.getAttribute('data-bl-go')); return; }
      var sim = e.target.closest('[data-bl-sim]');
      if (sim && demoOn) {
        var res = FogBillingProviders.getDemo().simulate(sim.getAttribute('data-bl-sim'));
        draw();
        var note = container.querySelector('#bl-sim-note');
        if (note) note.textContent = (res.ok ? 'Done. ' : '') + res.note;
        return;
      }
      var f = e.target.closest('[data-bl-filter]');
      if (f) {
        container.querySelectorAll('[data-bl-filter]').forEach(function (b) { var on = b === f; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
        container.querySelector('#bl-tx').innerHTML = txTable(FogBillingProviders.getDemo().transactions(), f.getAttribute('data-bl-filter'));
      }
    }
    container.addEventListener('click', onClick);
    var onPlan = function () { draw(); };
    global.addEventListener('fog:account', onPlan);
    draw();
    loadTiers();
    return function cleanup() { container.removeEventListener('click', onClick); global.removeEventListener('fog:account', onPlan); };
  }

  global.FogBillingProviders = FogBillingProviders;
  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.billing = init;
})(window);
