/**
 * Test-only stand-in for the marketplace database (tests/ui/characters-harness.html?…&market=1), so the real Marketplace
 * page can be driven in a browser without a server. It follows the rules of supabase/migrations/20261117120000_marketplace.sql
 * (those rules are tested for real in tests/db/rls.test.mjs): moderation states, ownership, server prices, the 10% fee,
 * the library, demo payments only while the flag is on, and test-owner tier switching.
 *
 * ?as=creator|buyer|mod|tester  who is signed in (tester is a configured test owner)
 * ?demopay=0                    demo payments switched off
 * ?mreset=1                     start over (state is kept in localStorage "__mock_market")
 * Test hooks: window.__market.state(), window.__market.calls (every rpc name called)
 */
(function (global) {
  'use strict';

  var q = new URLSearchParams(location.search);
  var KEY = '__mock_market';
  var USERS = {
    creator: { id: 'u-creator-0000-4000-8000-000000000001', name: 'Mira Quill' },
    buyer: { id: 'u-buyer-00000-4000-8000-000000000002', name: 'Bo Brandt' },
    mod: { id: 'u-moder-00000-4000-8000-000000000003', name: 'Morgan Hale' },
    tester: { id: 'u-tester-0000-4000-8000-000000000004', name: 'Tess Owner' },
  };
  var who = USERS[q.get('as')] || USERS.buyer;
  var MODS = [USERS.mod.id];
  var TESTERS = [USERS.tester.id];
  var PLAN_NAMES = { warlord: 'Warlord', 'dungeon-master': 'Dungeon Master', 'fogger-of-the-dragons': 'Fogger of the Dragons' };
  var PLAN_PRICE = { plan_dm_monthly: 399, plan_dm_yearly: 4549, plan_fogger_monthly: 599, plan_fogger_yearly: 6829 };
  var PRODUCTS = [
    ['d20-nat1-resin', 'dice', 'The Betrayer D20', 'A single translucent crimson D20. We regret to inform you it remembers every natural 1.', { material: 'Resin', options: ['Crimson', 'Smoke'] }, 'd20', 1299],
    ['dice-set-mimic', 'dice', 'Mimic Dice Set', 'Seven dice in a tiny treasure chest that might be hungry.', { pieces: 7 }, 'chest', 3499],
    ['dice-tower-keep', 'accessories', 'The Keep Dice Tower', 'Fold-flat wooden tower. Dice go in, fate comes out.', { height: '24 cm' }, 'tower', 4499],
    ['dm-screen-fog', 'accessories', 'DM Screen: Behind the Fog', 'Four-panel screen with SRD 5.2.1 reference tables.', { panels: 4 }, 'screen', 3999],
    ['tee-nat1-club', 'clothing', 'T-Shirt: Nat 1 Club', '"Founding member. Lifetime dues: my dignity."', { sizes: ['S', 'M', 'L', 'XL'] }, 'tee:NAT 1 CLUB', 2799],
    ['hoodie-fog', 'clothing', 'Hoodie: Lost in the Fog', 'Heavy hoodie with the FOD dragon on the back.', { sizes: ['S', 'M', 'L', 'XL'] }, 'hoodie', 5499],
    ['mug-tavern', 'everyday', 'Mug: The Tavern Keeper', '"I cast Coffee. It is super effective."', { volume: '350 ml' }, 'mug:I CAST COFFEE', 1699],
    ['stickers-crit-fails', 'everyday', 'Sticker Pack: Critical Failures', 'Twelve vinyl stickers of spells gone wrong.', { pieces: 12 }, 'stickers', 899],
  ].map(function (p, i) { return { sku: p[0], category: p[1], name: p[2], summary: p[3], details: p[4], art: p[5], price_cents: p[6], sort: i * 10, active: true,
    photo: p[0] === 'stickers-crit-fails' ? null : 'Assets/Pictures/store/' + p[0] + '.jpg', photo_credit: 'Photo: Test Photographer, CC BY 4.0, via Wikimedia Commons', photo_source: 'https://commons.wikimedia.org/wiki/File:Example.jpg' }; });

  function uid() { return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function () { return (Math.random() * 16 | 0).toString(16); }); }
  function now() { return new Date().toISOString(); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  var S;
  try { S = q.get('mreset') ? null : JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
  if (!S) S = { listings: [], library: [], orders: [], items: [], reports: [], plans: {}, notifs: [], objects: [] };
  S.flagDemo = q.get('demopay') !== '0';
  // Review mode (marketplace_settings.review_mode) and the stand-in AI reviewer: &review=manual|ai_assist|ai_auto (default ai_assist),
  // &aikey=0 → the server has no Gemini key. The verdict depends on the title: "copy" → reject/high, "unsure" → needs_human, else approve/low.
  S.reviewMode = q.get('review') || S.reviewMode || 'ai_assist';
  S.aiKey = q.get('aikey') !== '0';
  S.aiReviews = S.aiReviews || [];
  function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
  save();
  var calls = [];

  global.FogAccount = Object.assign({}, global.FogAccount || {}, {
    getAccount: function () { return { id: who.id, profile: { displayName: who.name, email: who.name.split(' ')[0].toLowerCase() + '@example.com' } }; },
    getPlan: function () { var id = plan(who.id); return { id: id, name: PLAN_NAMES[id], activeCampaigns: 1, maxPeople: 5 }; },
    getPlanInfo: function () { return null; },
    refreshPlan: function () { return Promise.resolve(global.FogAccount.getPlan()); },
    escapeHtml: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    compressImage: function () { return Promise.reject(new Error('not in tests')); },
    isSafeImageUrl: function () { return true; },
  });
  function plan(u) { return (S.plans[u] && S.plans[u].plan) || 'warlord'; }
  var isMod = function (u) { return MODS.indexOf(u) >= 0; };
  function err(message) { return { data: null, error: { message: message } }; }
  function ok(data) { return { data: data === undefined ? null : data, error: null }; }
  function listing(id) { return S.listings.filter(function (l) { return l.id === id; })[0]; }
  function notify(u, title, body) { S.notifs.push({ user: u, title: title, body: body, at: now() }); }
  function canDownload(u, id) { var l = listing(id); return !!l && (l.creator_id === u || isMod(u) || S.library.some(function (b) { return b.user_id === u && b.listing_id === id; })); }

  var EDITABLE = ['kind', 'title', 'summary', 'description', 'price_cents', 'edition', 'origin', 'license', 'attribution', 'rights_confirmed', 'level_min', 'level_max', 'genre', 'theme', 'tags', 'cover_path', 'preview_paths', 'files', 'content', 'content_kind'];
  function guard(row, old) {
    var prefix = row.creator_id + '/' + row.id + '/';
    if (old && old.status === 'removed') throw new Error('This listing was removed and can no longer be edited.');
    if (row.cover_path && row.cover_path.indexOf(prefix + 'media/') !== 0) throw new Error('Images must be uploaded for this listing.');
    (row.preview_paths || []).forEach(function (p) { if (p.indexOf(prefix + 'media/') !== 0) throw new Error('Images must be uploaded for this listing.'); });
    (row.files || []).forEach(function (f) { if (String(f.path).indexOf(prefix + 'files/') !== 0 || !/^[^/\\]{1,120}\.(pdf|png|jpe?g|webp|json|txt|md)$/.test(f.name || '')) throw new Error('Files must be PDF, image, JSON, text or Markdown files uploaded for this listing.'); });
    if (!row.title || row.title.trim().length < 3) throw new Error('new row violates check constraint "marketplace_listings_title_check"');
    if (row.price_cents && (row.price_cents < 99 || row.price_cents > 50000)) throw new Error('new row violates check constraint (price)');
    if (old && (old.status === 'published' || old.status === 'pending_review')) {
      var changed = ['title', 'summary', 'description', 'price_cents', 'kind', 'files', 'content', 'cover_path', 'preview_paths', 'license', 'origin', 'attribution'].some(function (k) { return JSON.stringify(row[k]) !== JSON.stringify(old[k]); });
      if (changed) { row.status = 'pending_review'; row.submitted_at = now(); }
    }
    row.tags = (row.tags || []).map(function (t) { return String(t).trim().toLowerCase().slice(0, 30); }).filter(Boolean).filter(function (t, i, a) { return a.indexOf(t) === i; });
    row.creator_name = row.creator_id === USERS.creator.id ? USERS.creator.name : (Object.keys(USERS).map(function (k) { return USERS[k]; }).filter(function (x) { return x.id === row.creator_id; })[0] || {}).name || '';
    row.updated_at = now();
  }

  // ---- RPC functions ----------------------------------------------------------------------------------------------
  var RPC = {
    marketplace_access: function () { return ok({ moderator: isMod(who.id), testOwner: TESTERS.indexOf(who.id) >= 0, demoPayments: S.flagDemo, feeBps: 1000, reviewMode: S.reviewMode, plan: plan(who.id), planProvider: S.plans[who.id] ? S.plans[who.id].provider : null }); },
    submit_listing: function (a) {
      var l = listing(a.p_id);
      if (!l || l.creator_id !== who.id) return err('Only the creator can submit this listing.');
      if (['draft', 'rejected'].indexOf(l.status) < 0) return err('This listing is already submitted or published.');
      if (!l.rights_confirmed) return err('Confirm that you own this content or have the right to share it.');
      if ((l.description || '').trim().length < 20) return err('Describe what is included (at least a sentence).');
      if (!l.content && !(l.files || []).length) return err('Add something to download: a file, or content from your library.');
      if (l.origin === 'srd-based' && (l.attribution || '').trim().length < 10) return err('SRD-based content needs the SRD 5.2.1 attribution (CC-BY-4.0).');
      l.status = 'pending_review'; l.submitted_at = now(); l.moderation_note = '';
      return ok('pending_review');
    },
    withdraw_listing: function (a) { var l = listing(a.p_id); if (!l || l.creator_id !== who.id || l.status !== 'pending_review') return err('Only a pending listing of yours can be taken back to draft.'); l.status = 'draft'; return ok('draft'); },
    remove_listing: function (a) { var l = listing(a.p_id); if (!l || (l.creator_id !== who.id && !isMod(who.id))) return err('Only the creator or a moderator can remove this listing.'); l.status = 'removed'; l.moderation_note = a.p_reason || ''; if (l.creator_id !== who.id) notify(l.creator_id, 'Your listing was removed: ' + l.title, a.p_reason); return ok('removed'); },
    moderate_listing: function (a) {
      if (!isMod(who.id)) return err('Only marketplace moderators can review listings.');
      var l = listing(a.p_id);
      if (a.p_decision === 'approve') { if (l.status !== 'pending_review') return err('Only listings waiting for review can be approved.'); l.status = 'published'; l.published_at = l.published_at || now(); notify(l.creator_id, 'Published: ' + l.title, ''); return ok('published'); }
      if (a.p_decision === 'reject') { if ((a.p_note || '').trim().length < 5) return err('Tell the creator why (a short reason).'); l.status = 'rejected'; l.moderation_note = a.p_note; notify(l.creator_id, 'Changes needed: ' + l.title, a.p_note); return ok('rejected'); }
      if (a.p_decision === 'remove') { l.status = 'removed'; l.moderation_note = a.p_note || ''; return ok('removed'); }
      return err('Unknown decision.');
    },
    report_listing: function (a) {
      var l = listing(a.p_id);
      if (!l || l.status !== 'published') return err('Only published listings can be reported.');
      if (l.creator_id === who.id) return err('You can’t report your own listing.');
      S.reports = S.reports.filter(function (r) { return !(r.listing_id === l.id && r.reporter_id === who.id); });
      S.reports.push({ id: uid(), listing_id: l.id, reporter_id: who.id, reason: a.p_reason, details: a.p_details || '', status: 'open', created_at: now() });
      if (S.reports.filter(function (r) { return r.listing_id === l.id && r.status === 'open'; }).length >= 3) l.status = 'pending_review';
      return ok('reported');
    },
    listing_content: function (a) { if (!canDownload(who.id, a.p_id)) return err('Get this listing first to open its content.'); var l = listing(a.p_id); return ok({ kind: l.content_kind, content: l.content }); },
    claim_free_listing: function (a) {
      var l = listing(a.p_id);
      if (!l || l.status !== 'published') return err('This listing isn’t available.');
      if (l.price_cents > 0) return err('This listing isn’t free: buy it at checkout.');
      if (!S.library.some(function (b) { return b.user_id === who.id && b.listing_id === l.id; })) { S.library.push({ user_id: who.id, listing_id: l.id, source: l.creator_id === who.id ? 'own' : 'free', order_id: null, acquired_at: now() }); if (l.creator_id !== who.id) l.downloads += 1; }
      return ok('in_library');
    },
    create_order: function (a) {
      var items = a.p_items || [];
      if (!items.length) return err('Your cart is empty.');
      var o = { id: uid(), buyer_id: who.id, reference: 'FOD-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(), status: 'pending', provider: null, subtotal_cents: 0, total_cents: 0, currency: 'usd', customer: clone(a.p_customer || {}), has_physical: false, fulfilment: null, last_error: null, created_at: now(), paid_at: null };
      delete o.customer.cardNumber; delete o.customer.card; delete o.customer.cvc;
      var rows = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var qn = Math.max(1, Math.min(10, it.quantity || 1));
        if (it.type === 'listing') {
          var l = listing(it.ref);
          if (!l || l.status !== 'published') return err('A listing in your cart is no longer available.');
          if (!l.price_cents) return err('“' + l.title + '” is free: get it from its page instead.');
          if (l.creator_id === who.id) return err('You can’t buy your own listing.');
          if (S.library.some(function (b) { return b.user_id === who.id && b.listing_id === l.id; })) return err('You already have “' + l.title + '”.');
          var fee = Math.round(l.price_cents * 1000 / 10000);
          rows.push({ order_id: o.id, item_type: 'listing', ref: l.id, title: l.title, unit_cents: l.price_cents, quantity: 1, options: {}, creator_id: l.creator_id, fee_cents: fee, creator_cents: l.price_cents - fee });
          o.subtotal_cents += l.price_cents;
        } else if (it.type === 'store') {
          var p = PRODUCTS.filter(function (x) { return x.sku === it.ref; })[0];
          if (!p) return err('A product in your cart is no longer available.');
          rows.push({ order_id: o.id, item_type: 'store', ref: p.sku, title: p.name, unit_cents: p.price_cents, quantity: qn, options: it.options || {} });
          o.subtotal_cents += p.price_cents * qn; o.has_physical = true;
        } else if (it.type === 'plan') {
          if (!PLAN_PRICE[it.ref]) return err('Unknown plan.');
          if (!(S.flagDemo && TESTERS.indexOf(who.id) >= 0)) return err('Plans can’t be bought here yet.');
          rows.push({ order_id: o.id, item_type: 'plan', ref: it.ref, title: (it.ref.indexOf('plan_dm') === 0 ? 'Dungeon Master' : 'Fogger of the Dragons') + (/yearly/.test(it.ref) ? ' (yearly)' : ' (monthly)'), unit_cents: PLAN_PRICE[it.ref], quantity: 1, options: {} });
          o.subtotal_cents += PLAN_PRICE[it.ref];
        } else return err('Unknown item in the cart.');
      }
      o.total_cents = o.subtotal_cents;
      S.orders.push(o);
      rows.forEach(function (r) { r.id = uid(); S.items.push(r); });
      return ok({ id: o.id, reference: o.reference, total: o.total_cents, currency: 'usd' });
    },
    pay_order_demo: function (a) {
      if (!S.flagDemo) return err('Demo payments are switched off.');
      var o = S.orders.filter(function (x) { return x.id === a.p_order; })[0];
      if (!o || o.buyer_id !== who.id) return err('Order not found.');
      if (o.status === 'paid') return ok({ status: 'paid', reference: o.reference });
      if (a.p_outcome === 'decline') { o.status = 'declined'; o.provider = 'demo'; o.last_error = 'The (simulated) card was declined.'; return ok({ status: 'declined', reference: o.reference }); }
      o.status = 'paid'; o.provider = 'demo'; o.paid_at = now();
      S.items.filter(function (i) { return i.order_id === o.id; }).forEach(function (i) {
        if (i.item_type === 'listing' && !S.library.some(function (b) { return b.user_id === who.id && b.listing_id === i.ref; })) { S.library.push({ user_id: who.id, listing_id: i.ref, source: 'purchase', order_id: o.id, acquired_at: now() }); listing(i.ref).downloads += 1; }
        if (i.item_type === 'plan') S.plans[who.id] = { plan: i.ref.indexOf('plan_dm') === 0 ? 'dungeon-master' : 'fogger-of-the-dragons', provider: 'demo' };
      });
      if (o.has_physical) o.fulfilment = 'not_fulfilled_demo';
      return ok({ status: 'paid', reference: o.reference });
    },
    demo_set_plan: function (a) {
      if (!(S.flagDemo && TESTERS.indexOf(who.id) >= 0)) return err('The tier simulator is only for configured test owners while demo payments are on.');
      if (a.p_plan === 'warlord') delete S.plans[who.id]; else S.plans[who.id] = { plan: a.p_plan, provider: 'demo' };
      return ok(plan(who.id));
    },
    creator_stats: function () {
      return ok(S.listings.filter(function (l) { return l.creator_id === who.id; }).map(function (l) {
        var sold = S.items.filter(function (i) { return i.item_type === 'listing' && i.ref === l.id && S.orders.some(function (o) { return o.id === i.order_id && o.status === 'paid'; }); });
        return { listing: l.id, downloads: l.downloads, sales: sold.length, demoSales: sold.length, gross: sold.reduce(function (n, i) { return n + i.unit_cents; }, 0), net: sold.reduce(function (n, i) { return n + i.creator_cents; }, 0) };
      }));
    },
  };

  // ---- Table access with the row-level rules ----------------------------------------------------------------------
  function visible(table) {
    if (table === 'marketplace_store_products') return PRODUCTS.slice();
    if (table === 'marketplace_listings') return S.listings.filter(function (l) { return l.status === 'published' || l.creator_id === who.id || isMod(who.id) || S.library.some(function (b) { return b.listing_id === l.id && b.user_id === who.id; }); });
    if (table === 'marketplace_library') return S.library.filter(function (b) { return b.user_id === who.id; });
    if (table === 'marketplace_orders') return S.orders.filter(function (o) { return o.buyer_id === who.id; }).map(function (o) { return Object.assign(clone(o), { marketplace_order_items: S.items.filter(function (i) { return i.order_id === o.id; }).map(clone) }); });
    if (table === 'marketplace_ai_reviews') return isMod(who.id) ? S.aiReviews.slice() : [];
    if (table === 'marketplace_reports') return S.reports.filter(function (r) { return r.reporter_id === who.id || isMod(who.id); });
    return [];
  }
  function query(table) {
    var filters = [];
    var op = 'select';
    var payload = null;
    var sorter = null;
    var max = 1000;
    var b = {
      select: function () { return b; },
      eq: function (k, v) { filters.push(function (r) { return r[k] === v; }); return b; },
      neq: function (k, v) { filters.push(function (r) { return r[k] !== v; }); return b; },
      in: function (k, vs) { filters.push(function (r) { return vs.indexOf(r[k]) >= 0; }); return b; },
      order: function (k, o) { var asc = !o || o.ascending !== false; sorter = function (x, y) { return (String(x[k]) < String(y[k]) ? -1 : String(x[k]) > String(y[k]) ? 1 : 0) * (asc ? 1 : -1); }; return b; },
      limit: function (n) { max = n; return b; },
      insert: function (row) { op = 'insert'; payload = row; return b; },
      update: function (row) { op = 'update'; payload = row; return b; },
      delete: function () { op = 'delete'; return b; },
      maybeSingle: function () { return run().then(function (r) { return r.error ? r : ok(r.data[0] || null); }); },
      single: function () { return run().then(function (r) { return r.error ? r : r.data[0] ? ok(r.data[0]) : err('no rows'); }); },
      then: function (res, rej) { return run().then(res, rej); },
    };
    function match(rows) { return rows.filter(function (r) { return filters.every(function (f) { return f(r); }); }); }
    function run() {
      calls.push(table + ':' + op);
      try {
        var out;
        if (op === 'select') { out = match(visible(table)); if (sorter) out.sort(sorter); out = out.slice(0, max).map(clone); }
        else if (table !== 'marketplace_listings') return Promise.resolve(err('permission denied for table ' + table));
        else if (op === 'insert') {
          var row = { id: uid(), creator_id: who.id, status: 'draft', summary: '', description: '', price_cents: 0, edition: '5e-2024', origin: 'original', license: 'personal-use', attribution: '', rights_confirmed: false, level_min: null, level_max: null, genre: '', theme: '', tags: [], cover_path: null, preview_paths: [], files: [], content: null, content_kind: null, moderation_note: '', downloads: 0, created_at: now(), submitted_at: null, published_at: null };
          Object.keys(payload).forEach(function (k) { if (EDITABLE.indexOf(k) < 0) throw new Error('permission denied for column ' + k); row[k] = payload[k]; });
          guard(row, null);
          S.listings.push(row); out = [clone(row)];
        } else if (op === 'update') {
          Object.keys(payload).forEach(function (k) { if (EDITABLE.indexOf(k) < 0) throw new Error('permission denied for column ' + k); });
          out = [];
          match(S.listings.filter(function (l) { return l.creator_id === who.id; })).forEach(function (l) { var next = Object.assign(clone(l), payload); guard(next, l); Object.assign(l, next); out.push(clone(l)); });
        } else {
          out = [];
          S.listings = S.listings.filter(function (l) {
            var del = l.creator_id === who.id && ['draft', 'rejected'].indexOf(l.status) >= 0 && filters.every(function (f) { return f(l); }) && !S.library.some(function (b) { return b.listing_id === l.id && b.source !== 'own'; });
            if (del) out.push({ id: l.id });
            return !del;
          });
        }
        save();
        return Promise.resolve(ok(out));
      } catch (e) { return Promise.resolve(err(e.message)); }
    }
    return b;
  }

  var pixel = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#5b1424"/><text x="200" y="160" font-size="40" text-anchor="middle" fill="#fff">Preview</text></svg>');
  global.FogSupabase = { client: {
    rpc: function (fn, args) {
      calls.push('rpc:' + fn);
      var f = RPC[fn];
      var r = f ? f(args || {}) : err('Could not find the function public.' + fn);
      save();
      return Promise.resolve(r);
    },
    from: query,
    functions: { invoke: function (fn, o) {
      calls.push('fn:' + fn);
      if (fn !== 'marketplace-review') return Promise.resolve({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });
      var fail = function (status, body) { return Promise.resolve({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { status: status, json: function () { return Promise.resolve(body); } } } }); };
      var l = listing(o.body.listingId);
      if (!l) return fail(404, { error: 'Listing not found.', code: 'not_found' });
      if (l.creator_id !== who.id && !isMod(who.id)) return fail(403, { error: 'Only the creator or a moderator can ask for a review.', code: 'forbidden' });
      if (l.status !== 'pending_review') return fail(409, { error: 'This listing isn’t waiting for review.', code: 'not_pending' });
      if (S.reviewMode === 'manual') return Promise.resolve({ data: { reviewed: false, mode: 'manual' }, error: null });
      var existing = S.aiReviews.filter(function (r) { return r.listing_id === l.id; })[0];
      if (existing && existing.listing_version === l.updated_at && !(isMod(who.id) && o.body.force)) return Promise.resolve({ data: { reviewed: true, cached: true, mode: S.reviewMode, autoPublished: existing.auto_published }, error: null });
      if (!S.aiKey) return fail(503, { error: 'The AI reviewer has no Gemini key on the server yet; a moderator will review this listing.', code: 'not_configured' });
      var t = l.title.toLowerCase();
      var v = /copy/.test(t) ? { decision: 'reject', risk: 'high', summary: 'Large parts look copied from a published adventure.', reasons: ['Read-aloud text matches a published book', 'Uses non-SRD monster names'], suggested_note: 'Please replace the copied read-aloud text with your own words.' }
        : /unsure/.test(t) ? { decision: 'needs_human', risk: 'medium', summary: 'The PDF could not be checked.', reasons: ['Large PDF not inspected'], suggested_note: '' }
          : { decision: 'approve', risk: 'low', summary: 'Original content with a clear description.', reasons: [], suggested_note: '' };
      var row = Object.assign({ listing_id: l.id, listing_version: l.updated_at, inspected: { complete: !/unsure/.test(t), skipped: /unsure/.test(t) ? ['big.pdf'] : [], images: l.cover_path ? 1 : 0, pdfs: 0, textFiles: 0 }, model: 'gemini-2.5-flash (mock)', auto_published: false, requested_by: who.id, created_at: now() }, v);
      S.aiReviews = S.aiReviews.filter(function (r) { return r.listing_id !== l.id; }).concat([row]);
      var auto = S.reviewMode === 'ai_auto' && v.decision === 'approve' && v.risk === 'low' && row.inspected.complete && !S.reports.some(function (x) { return x.listing_id === l.id && x.status === 'open'; });
      if (auto) { l.status = 'published'; l.published_at = l.published_at || now(); l.moderation_note = 'Approved by the automatic review.'; row.auto_published = true; notify(l.creator_id, 'Published: ' + l.title, 'Your listing passed the automatic review.'); }
      save();
      return new Promise(function (ok2) { setTimeout(function () { ok2({ data: isMod(who.id) ? { reviewed: true, mode: S.reviewMode, autoPublished: auto, review: row } : { reviewed: true, mode: S.reviewMode, autoPublished: auto }, error: null }); }, 150); });
    } },
    storage: { from: function () { return {
      upload: function (path, file) {
        var parts = path.split('/');
        var l = listing(parts[1]);
        if (parts[0] !== who.id || !l || l.creator_id !== who.id || ['media', 'files'].indexOf(parts[2]) < 0 || !/\.(jpe?g|png|webp|pdf|json|txt|md)$/i.test(path)) return Promise.resolve(err('new row violates row-level security policy'));
        S.objects.push({ path: path, size: file.size }); save();
        return Promise.resolve(ok({ path: path }));
      },
      createSignedUrls: function (paths) {
        return Promise.resolve(ok(paths.map(function (p) {
          var parts = p.split('/');
          var allowed = parts[0] === who.id || (parts[2] === 'media' && listing(parts[1]) && (listing(parts[1]).status === 'published' || canDownload(who.id, parts[1]))) || (parts[2] === 'files' && canDownload(who.id, parts[1]));
          return allowed ? { path: p, signedUrl: parts[2] === 'media' ? pixel : 'data:text/plain,demo%20file' } : { path: p, error: 'not allowed', signedUrl: null };
        })));
      },
    }; } },
  } };

  global.__market = { state: function () { return S; }, calls: calls, users: USERS, setFlag: function (on) { S.flagDemo = on; save(); }, setReviewMode: function (m) { S.reviewMode = m; save(); } };
})(window);
