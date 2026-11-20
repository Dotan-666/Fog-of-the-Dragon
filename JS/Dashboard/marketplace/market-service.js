/**
 * Marketplace service (browser). All rules live in the database (migration 20261117120000_marketplace.sql): moderation,
 * ownership, prices, fees and access are decided there; this file only calls it.
 *
 * Store:      storeProducts()  (each product: FOD print design `art` + a real photo of the product type with its credit)
 * Community:  browse(), get(id), mine(), create(fields), save(id, fields), remove(id), deleteDraft(id), submit(id), withdraw(id),
 *             report(id, reason, details), upload(listingId, file, 'media'|'files'), urls(paths), stats()
 * Moderation: queue(), moderate(id, decision, note), aiReview(id) (Gemini's verdict, moderators only), requestAiReview(id, force)
 *             (asks the Edge Function marketplace-review; submit() and save() start it in the background for the creator)
 * Library:    library(), claimFree(id), content(id), importContent(id)  (adds a copy to your Adventures or Homebrew)
 * Orders:     createOrder(items, customer), payDemo(orderId, 'success'|'decline'), orders(), order(id)
 * Access:     access() → { moderator, testOwner, demoPayments, feeBps, plan, planProvider }, setTestPlan(plan)
 */
(function (global) {
  'use strict';

  var KINDS = {
    adventure: { label: 'Complete adventure', group: 'adventure' }, chapter: { label: 'Adventure chapter', group: 'adventure' },
    one_shot: { label: 'One-shot', group: 'adventure' }, module: { label: 'Campaign module', group: 'adventure' },
    encounter: { label: 'Encounter', group: 'adventure' }, story_hook: { label: 'Story hook', group: 'adventure' },
    monster: { label: 'Monster', group: 'asset' }, npc: { label: 'NPC', group: 'asset' }, character: { label: 'Character', group: 'asset' },
    map: { label: 'Map', group: 'asset' }, location: { label: 'Location', group: 'asset' }, magic_item: { label: 'Magic item', group: 'asset' },
    spell: { label: 'Spell', group: 'asset' }, equipment: { label: 'Weapons & equipment', group: 'asset' }, puzzle: { label: 'Puzzle', group: 'asset' },
    trap: { label: 'Trap', group: 'asset' }, handout: { label: 'Handout', group: 'asset' }, illustration: { label: 'Illustration', group: 'asset' },
    token: { label: 'Tokens & portraits', group: 'asset' }, other: { label: 'Other', group: 'asset' },
  };
  var EDITIONS = { '5e-2024': '5E (2024 rules)', '5e-2014': '5E (2014 rules)', 'system-neutral': 'System-neutral', other: 'Other system' };
  var LICENSES = { 'personal-use': 'Personal use (creator keeps all rights)', 'cc-by-4.0': 'CC BY 4.0', 'cc-by-sa-4.0': 'CC BY-SA 4.0', cc0: 'CC0 (public domain)' };
  var ORIGINS = { original: 'Original / homebrew', 'srd-based': 'Based on the 2024 rules' };
  var STATUS_LABEL = { draft: 'Draft', pending_review: 'Pending review', published: 'Published', rejected: 'Changes needed', removed: 'Removed' };
  var REPORT_REASONS = { copyright: 'Copied or copyrighted content', offensive: 'Offensive or harmful', spam: 'Spam or scam', misleading: 'Misleading description', not_working: 'Files missing or broken', other: 'Something else' };
  var STORE_CATEGORIES = { dice: 'Dice', accessories: 'Tabletop accessories', books: 'Rulebooks', clothing: 'Clothing', everyday: 'Everyday & fun' };
  var SRD_ATTRIBUTION = 'This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License.';
  var MEDIA = { types: ['image/jpeg', 'image/png', 'image/webp'], ext: /\.(jpe?g|png|webp)$/i, max: 5 * 1024 * 1024 };
  var FILES = { types: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/json', 'text/plain', 'text/markdown', ''], ext: /\.(pdf|jpe?g|png|webp|json|txt|md)$/i, max: 25 * 1024 * 1024 };
  var COLS = 'id, creator_id, creator_name, status, kind, title, summary, description, price_cents, edition, origin, license, attribution, rights_confirmed, level_min, level_max, genre, theme, tags, cover_path, preview_paths, files, content_kind, moderation_note, submitted_at, published_at, downloads, created_at, updated_at';

  function sb() { return global.FogSupabase && global.FogSupabase.client; }
  function me() { var a = global.FogAccount && global.FogAccount.getAccount && global.FogAccount.getAccount(); return a ? a.id : null; }
  function ready() { return sb() ? null : { ok: false, message: 'The marketplace needs the online account service (Supabase), which isn\'t available here.' }; }
  function notSetUp(err) { return /relation .* does not exist|Could not find the (function|table)|schema cache/i.test((err && err.message) || ''); }
  function fail(err, fallback) {
    if (notSetUp(err)) return { ok: false, notSetUp: true, message: 'The marketplace isn\'t set up on the server yet (migration 20261117120000_marketplace.sql).' };
    return { ok: false, message: (err && err.message) || fallback };
  }
  async function rpc(fn, args, fallback) {
    var nr = ready(); if (nr) return nr;
    var res = await sb().rpc(fn, args || {});
    return res.error ? fail(res.error, fallback) : { ok: true, data: res.data };
  }

  function fromRow(r) {
    return {
      id: r.id, creatorId: r.creator_id, creatorName: r.creator_name || 'A creator', status: r.status, kind: r.kind, title: r.title, summary: r.summary || '', description: r.description || '',
      priceCents: r.price_cents || 0, edition: r.edition, origin: r.origin, license: r.license, attribution: r.attribution || '', rightsConfirmed: !!r.rights_confirmed,
      levelMin: r.level_min, levelMax: r.level_max, genre: r.genre || '', theme: r.theme || '', tags: r.tags || [], coverPath: r.cover_path || null,
      previewPaths: r.preview_paths || [], files: r.files || [], contentKind: r.content_kind || null, moderationNote: r.moderation_note || '',
      submittedAt: r.submitted_at, publishedAt: r.published_at, downloads: r.downloads || 0, createdAt: r.created_at, updatedAt: r.updated_at,
      mine: r.creator_id === me(),
    };
  }
  function toRow(f) {
    var row = {};
    var map = { kind: 'kind', title: 'title', summary: 'summary', description: 'description', priceCents: 'price_cents', edition: 'edition', origin: 'origin', license: 'license',
      attribution: 'attribution', rightsConfirmed: 'rights_confirmed', levelMin: 'level_min', levelMax: 'level_max', genre: 'genre', theme: 'theme', tags: 'tags',
      coverPath: 'cover_path', previewPaths: 'preview_paths', files: 'files' };
    Object.keys(map).forEach(function (k) { if (f[k] !== undefined) row[map[k]] = f[k]; });
    if (f.content !== undefined) { row.content = f.content; row.content_kind = f.content ? f.contentKind : null; }
    return row;
  }

  var accessCache = null;
  async function access(force) {
    if (accessCache && !force) return accessCache;
    var r = await rpc('marketplace_access', {}, 'Could not check marketplace access.');
    if (r.ok) {
      var data = r.data;
      if (typeof data.isVerifiedCreator === 'undefined') {
        try {
          var u = (await sb().auth.getUser()).data.user;
          if (u) {
            var p = await sb().from('profiles').select('is_verified_creator').eq('id', u.id).maybeSingle();
            data.isVerifiedCreator = !!(p.data && p.data.is_verified_creator);
          }
        } catch (_) { data.isVerifiedCreator = false; }
      }
      accessCache = { ok: true, access: data };
    } else {
      accessCache = r;
    }
    return accessCache;
  }

  // Site root, from this script's own address (…/JS/Dashboard/marketplace/market-service.js), so store photos stored as
  // 'Assets/Pictures/store/x.jpg' load from Pages/dashboard.html and from the test harness alike.
  var SITE_ROOT = (function () {
    var s = global.document && global.document.currentScript && global.document.currentScript.src;
    return s && /JS\/Dashboard\/marketplace\/market-service\.js/.test(s) ? s.replace(/JS\/Dashboard\/marketplace\/market-service\.js.*$/, '') : '../';
  })();
  function assetUrl(path) { return path && /^Assets\/[\w\/.-]+$/.test(path) ? SITE_ROOT + path : ''; }

  // Fallback photos: when a product has no photo in the database, use a representative image by art key.
  var FALLBACK_PHOTOS = {
    'dice-set': 'Assets/Pictures/store/dice-set-mimic.jpg', d20: 'Assets/Pictures/store/d20-nat1-resin.jpg',
    screen: 'Assets/Pictures/store/dm-screen-fog.jpg', tower: 'Assets/Pictures/store/dice-tower-keep.jpg',
    tray: 'Assets/Pictures/store/dice-tray-fog.jpg', bag: 'Assets/Pictures/store/dice-bag-hoard.jpg',
    chest: 'Assets/Pictures/store/chest-mimic.jpg', book: 'Assets/Pictures/store/notebook-spellbook.jpg',
    tee: 'Assets/Pictures/store/tee-mimic.jpg', cap: 'Assets/Pictures/store/cap-crit.jpg',
    mug: 'Assets/Pictures/store/mug-dm-tears.jpg', minis: 'Assets/Pictures/store/mini-bases-pack.jpg',
    template: 'Assets/Pictures/store/template-aoe.jpg', rings: 'Assets/Pictures/store/condition-rings.jpg',
    mat: 'Assets/Pictures/store/mousepad-initiative.jpg', notebook: 'Assets/Pictures/store/campaign-notebook.jpg',
    hoodie: 'Assets/Pictures/store/hoodie-dark.jpg', beanie: 'Assets/Pictures/store/beanie-dragon.jpg',
    cup: 'Assets/Pictures/store/cup-travel.jpg', poster: 'Assets/Pictures/store/poster-art.jpg',
    stickers: 'Assets/Pictures/store/sticker-sheet.jpg', spellbook: 'Assets/Pictures/store/spellbook-old.jpg',
  };

  async function storeProducts() {
    var nr = ready(); if (nr) return nr;
    var cols = 'sku, category, name, summary, details, art, price_cents, sort';
    var res = await sb().from('marketplace_store_products').select(cols + ', photo, photo_credit, photo_source').order('sort');
    // Before 20261118120000_store_photos.sql is run the photo columns don't exist: show the designs only.
    if (res.error && /photo/.test(res.error.message || '')) res = await sb().from('marketplace_store_products').select(cols).order('sort');
    if (res.error) return fail(res.error, 'Could not load the store.');
    return { ok: true, products: res.data.map(function (p) {
      var artKey = String(p.art || '').split(':')[0];
      var photoPath = p.photo || FALLBACK_PHOTOS[artKey] || '';
      return { sku: p.sku, category: p.category, name: p.name, summary: p.summary, details: p.details || {}, art: p.art, priceCents: p.price_cents,
        photo: assetUrl(photoPath), photoPath: assetUrl(photoPath) ? photoPath : '', photoCredit: p.photo_credit || '', photoSource: /^https:\/\/commons\.wikimedia\.org\//.test(p.photo_source || '') ? p.photo_source : '',
        buyUrl: p.buy_url || '' };
    }) };
  }

  async function browse() {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_listings').select(COLS).eq('status', 'published').order('published_at', { ascending: false }).limit(300);
    return res.error ? fail(res.error, 'Could not load the marketplace.') : { ok: true, listings: res.data.map(fromRow) };
  }
  async function get(id) {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_listings').select(COLS).eq('id', id).maybeSingle();
    if (res.error) return fail(res.error, 'Could not load the listing.');
    if (!res.data) return { ok: false, notFound: true, message: 'This listing doesn\'t exist, isn\'t published yet, or was removed.' };
    return { ok: true, listing: fromRow(res.data) };
  }
  async function mine() {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_listings').select(COLS).eq('creator_id', me()).order('updated_at', { ascending: false });
    return res.error ? fail(res.error, 'Could not load your listings.') : { ok: true, listings: res.data.map(fromRow) };
  }
  async function create(fields) {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_listings').insert(toRow(fields)).select(COLS).single();
    return res.error ? fail(res.error, 'Could not create the listing.') : { ok: true, listing: fromRow(res.data) };
  }
  async function save(id, fields) {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_listings').update(toRow(fields)).eq('id', id).select(COLS).maybeSingle();
    if (res.error) return fail(res.error, 'Could not save the listing.');
    if (!res.data) return { ok: false, message: 'Only the creator can change this listing.' };
    var out = { ok: true, listing: fromRow(res.data) };
    if (out.listing.status === 'pending_review') out.review = requestAiReview(id);
    return out;
  }
  async function deleteDraft(id) {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_listings').delete().eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not delete the listing.');
    if (!res.data.length) return { ok: false, message: 'Only your own drafts or rejected listings that nobody has bought can be deleted. Remove published listings instead.' };
    return { ok: true };
  }
  async function submit(id) {
    var r = await rpc('submit_listing', { p_id: id }, 'Could not submit the listing.');
    if (r.ok) r.review = requestAiReview(id);
    return r;
  }

  /** Asks the server's AI reviewer (Edge Function) for a first opinion. Never throws; resolves to { ok, ... }. */
  async function requestAiReview(id, force) {
    var c = sb();
    if (!c || !c.functions) return { ok: false, code: 'unavailable', message: 'The reviewer can\'t be reached.' };
    try {
      var res = await c.functions.invoke('marketplace-review', { body: { listingId: id, force: !!force } });
      if (res.error) {
        var msg = 'The AI reviewer couldn\'t answer.'; var code = 'error';
        try { if (res.error.context && res.error.context.json) { var j = await res.error.context.json(); msg = j.error || msg; code = j.code || code; } } catch (e) { /* keep generic */ }
        if (code === 'error' && /Failed to send|fetch|network/i.test(String(res.error.message || ''))) { code = 'unavailable'; msg = 'The AI reviewer isn\'t reachable (the marketplace-review function may not be deployed). A moderator will review it.'; }
        return { ok: false, code: code, message: msg };
      }
      return Object.assign({ ok: true }, res.data || {});
    } catch (e) {
      return { ok: false, code: 'unavailable', message: 'The AI reviewer isn\'t reachable.' };
    }
  }
  function reviewFromRow(r) {
    return r ? { listingId: r.listing_id, version: r.listing_version, decision: r.decision, risk: r.risk, summary: r.summary || '', reasons: r.reasons || [], suggestedNote: r.suggested_note || '',
      inspected: r.inspected || {}, model: r.model || '', autoPublished: !!r.auto_published, createdAt: r.created_at } : null;
  }
  async function aiReview(id) {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_ai_reviews').select('*').eq('listing_id', id).maybeSingle();
    if (res.error) return /marketplace_ai_reviews|does not exist|schema cache/i.test(res.error.message || '') ? { ok: true, review: null, notSetUp: true } : fail(res.error, 'Could not load the AI review.');
    return { ok: true, review: reviewFromRow(res.data) };
  }
  var withdraw = function (id) { return rpc('withdraw_listing', { p_id: id }, 'Could not take the listing back.'); };
  var remove = function (id, reason) { return rpc('remove_listing', { p_id: id, p_reason: reason || '' }, 'Could not remove the listing.'); };
  var report = function (id, reason, details) { return rpc('report_listing', { p_id: id, p_reason: reason, p_details: details || '' }, 'Could not send the report.'); };
  var moderate = function (id, decision, note) { return rpc('moderate_listing', { p_id: id, p_decision: decision, p_note: note || '' }, 'Could not record the decision.'); };
  var claimFree = function (id) { return rpc('claim_free_listing', { p_id: id }, 'Could not add it to your library.'); };
  var payDemo = function (orderId, outcome) { return rpc('pay_order_demo', { p_order: orderId, p_outcome: outcome }, 'The payment could not be processed.'); };
  var setTestPlan = function (plan) { return rpc('demo_set_plan', { p_plan: plan }, 'Could not switch the plan.'); };
  async function stats() { var r = await rpc('creator_stats', {}, 'Could not load your numbers.'); return r.ok ? { ok: true, stats: r.data || [] } : r; }

  async function queue() {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_listings').select(COLS).in('status', ['pending_review']).order('submitted_at', { ascending: true });
    if (res.error) return fail(res.error, 'Could not load the review queue.');
    var rep = await sb().from('marketplace_reports').select('id, listing_id, reason, details, status, created_at').eq('status', 'open').order('created_at');
    var reviews = {};
    if (res.data.length) {
      var rv = await sb().from('marketplace_ai_reviews').select('*').in('listing_id', res.data.map(function (x) { return x.id; }));
      (rv.error ? [] : rv.data || []).forEach(function (x) { var v = reviewFromRow(x); var l = res.data.filter(function (y) { return y.id === x.listing_id; })[0]; if (l && new Date(l.updated_at).getTime() === new Date(v.version).getTime()) reviews[x.listing_id] = v; });
    }
    return { ok: true, listings: res.data.map(fromRow), reports: rep.error ? [] : rep.data, reviews: reviews };
  }

  /** Checks a file before it is uploaded (the bucket and its policies check again). */
  function checkFile(file, area) {
    var rule = area === 'media' ? MEDIA : FILES;
    if (!file) return 'No file chosen.';
    if (!rule.ext.test(file.name || '') || rule.types.indexOf(file.type || '') < 0 && !(area === 'files' && /\.md$/i.test(file.name))) {
      return '"' + file.name + '": ' + (area === 'media' ? 'pictures must be JPG, PNG or WEBP.' : 'files must be PDF, JPG, PNG, WEBP, JSON, TXT or Markdown. Programs and archives are not allowed.');
    }
    if (file.size > rule.max) return '"' + file.name + '" is too large (at most ' + Math.round(rule.max / 1048576) + ' MB).';
    return null;
  }
  async function upload(listingId, file, area) {
    var nr = ready(); if (nr) return nr;
    var bad = checkFile(file, area);
    if (bad) return { ok: false, message: bad };
    var ext = (file.name.match(/\.([a-z0-9]+)$/i) || [, 'bin'])[1].toLowerCase();
    var rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    var path = me() + '/' + listingId + '/' + area + '/' + rnd + '.' + ext;
    var type = file.type || (ext === 'md' ? 'text/markdown' : 'text/plain');
    var res = await sb().storage.from('marketplace').upload(path, file, { contentType: type, upsert: false });
    if (res.error) return fail(res.error, 'The upload failed.');
    return { ok: true, path: path, name: String(file.name).replace(/[\\/]/g, '_').slice(0, 120), size: file.size, type: type };
  }
  async function urls(paths) {
    paths = (paths || []).filter(Boolean);
    if (!paths.length || !sb()) return {};
    var res = await sb().storage.from('marketplace').createSignedUrls(paths, 3600);
    var out = {};
    (res.data || []).forEach(function (d) { if (d && d.signedUrl && !d.error) out[d.path] = d.signedUrl; });
    return out;
  }

  async function library() {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_library').select('listing_id, source, order_id, acquired_at').order('acquired_at', { ascending: false });
    if (res.error) return fail(res.error, 'Could not load your library.');
    var ids = res.data.map(function (x) { return x.listing_id; });
    var ls = ids.length ? await sb().from('marketplace_listings').select(COLS).in('id', ids) : { data: [] };
    var byId = {};
    (ls.data || []).forEach(function (r) { byId[r.id] = fromRow(r); });
    return { ok: true, items: res.data.map(function (x) { return { listing: byId[x.listing_id] || null, listingId: x.listing_id, source: x.source, orderId: x.order_id, acquiredAt: x.acquired_at }; }) };
  }
  async function content(id) { var r = await rpc('listing_content', { p_id: id }, 'Could not open the content.'); return r.ok ? { ok: true, kind: r.data.kind, content: r.data.content } : r; }

  /** Adds a copy of bought/claimed content to your own Adventures or Homebrew (images aren't included). */
  async function importContent(id, title) {
    var c = await content(id);
    if (!c.ok) return c;
    if (c.kind === 'adventure' && global.FogAdventureStore && global.FogAdventureModel) {
      var made = await global.FogAdventureStore.create({ title: (c.content.title || title || 'Imported adventure').slice(0, 100) });
      if (!made.ok) return made;
      var a = global.FogAdventureModel.normalize(Object.assign({}, c.content, { id: made.adventure.id, version: made.adventure.version, status: 'draft' }));
      var saved = await global.FogAdventureStore.save(a);
      return saved.ok ? { ok: true, where: '#adventures/' + made.adventure.id, label: 'Adventures' } : saved;
    }
    if (c.kind === 'homebrew' && global.FogHomebrewStore && global.FogHomebrewModel) {
      var e = c.content;
      var hb = await global.FogHomebrewStore.create(e.kind, (e.name || title || 'Imported entry').slice(0, 100));
      if (!hb.ok) return hb;
      var entry = global.FogHomebrewModel.normalize(Object.assign({}, e, { id: hb.entry.id, version: hb.entry.version, data: Object.assign({}, e.data || {}, { image: null }) }));
      var ok = await global.FogHomebrewStore.save(entry);
      return ok.ok ? { ok: true, where: '#grimoire/' + hb.entry.id, label: 'Homebrew' } : ok;
    }
    return { ok: false, message: 'This listing has no content to import; download its files instead.' };
  }

  async function createOrder(items, customer) {
    var r = await rpc('create_order', { p_items: items.map(function (i) { return { type: i.type, ref: i.ref, quantity: i.quantity, options: i.options || {} }; }), p_customer: customer || {} }, 'Could not create the order.');
    return r.ok ? { ok: true, order: r.data } : r;
  }
  function orderFromRow(o) {
    return { id: o.id, reference: o.reference, status: o.status, provider: o.provider, totalCents: o.total_cents, subtotalCents: o.subtotal_cents, currency: o.currency, customer: o.customer || {},
      hasPhysical: o.has_physical, fulfilment: o.fulfilment, lastError: o.last_error, createdAt: o.created_at, paidAt: o.paid_at,
      items: (o.marketplace_order_items || []).map(function (i) { return { type: i.item_type, ref: i.ref, title: i.title, unitCents: i.unit_cents, quantity: i.quantity, options: i.options || {} }; }) };
  }
  async function orders() {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_orders').select('*, marketplace_order_items(*)').order('created_at', { ascending: false }).limit(50);
    return res.error ? fail(res.error, 'Could not load your orders.') : { ok: true, orders: res.data.map(orderFromRow) };
  }
  async function order(id) {
    var nr = ready(); if (nr) return nr;
    var res = await sb().from('marketplace_orders').select('*, marketplace_order_items(*)').eq('id', id).maybeSingle();
    if (res.error) return fail(res.error, 'Could not load the order.');
    return res.data ? { ok: true, order: orderFromRow(res.data) } : { ok: false, message: 'Order not found.' };
  }

  global.FogMarket = {
    KINDS: KINDS, EDITIONS: EDITIONS, LICENSES: LICENSES, ORIGINS: ORIGINS, STATUS_LABEL: STATUS_LABEL, REPORT_REASONS: REPORT_REASONS,
    STORE_CATEGORIES: STORE_CATEGORIES, SRD_ATTRIBUTION: SRD_ATTRIBUTION, MEDIA: MEDIA, FILES: FILES,
    assetUrl: assetUrl, access: access, storeProducts: storeProducts, browse: browse, get: get, mine: mine, create: create, save: save, deleteDraft: deleteDraft,
    submit: submit, requestAiReview: requestAiReview, aiReview: aiReview, withdraw: withdraw, remove: remove, report: report, moderate: moderate, queue: queue, checkFile: checkFile, upload: upload, urls: urls,
    library: library, claimFree: claimFree, content: content, importContent: importContent, stats: stats,
    createOrder: createOrder, payDemo: payDemo, orders: orders, order: order, setTestPlan: setTestPlan, fromRow: fromRow,
  };
})(typeof window !== 'undefined' ? window : globalThis);
