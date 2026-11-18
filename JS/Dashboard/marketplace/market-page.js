/**
 * Marketplace page (#marketplace/…), opened from the header icon next to the notification bell.
 *
 * Views (route params.view): store · item/<sku> · community · listing/<id> · creator · new · edit/<id> · moderation ·
 * library · cart · checkout · order/<id> · orders. Data and every rule come from FogMarket (the database); the cart is
 * FogCart. The official store is a DEMO (mockup products, nothing is shipped); checkout payments are SIMULATED while the
 * owner has 'demo_payments' switched on, but orders, the library and plans are the real records.
 */
(function (global) {
  'use strict';

  var Mk = function () { return global.FogMarket; };
  var Cart = function () { return global.FogCart; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(c) { return Cart().money(c); }
  function price(c) { return c ? money(c) : 'Free'; }
  function when(iso) { try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
  function levels(l) { return l.levelMin && l.levelMax ? (l.levelMin === l.levelMax ? 'Level ' + l.levelMin : 'Levels ' + l.levelMin + '–' + l.levelMax) : l.levelMin ? 'Level ' + l.levelMin + '+' : l.levelMax ? 'Up to level ' + l.levelMax : ''; }
  function kindLabel(k) { return (Mk().KINDS[k] || { label: k }).label; }
  function size(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((b || 0) / 1024)) + ' KB'; }
  var TABS = [['store', 'Official Store'], ['community', 'Community'], ['library', 'My library'], ['creator', 'Creator'], ['orders', 'Orders']];
  var TEST_CARDS = { '4242424242424242': 'success', '4000000000000002': 'decline' };

  function init(container, params) {
    var root = container.querySelector('#mk-root');
    var view = params.view || 'store';
    var id = params.id;
    var alive = true;
    var acc = null;
    var nav = function (h) { global.FogDashboardRouter.navigateTo(h); };
    var cleanups = [];

    function shell(inner, opts) {
      opts = opts || {};
      var tabs = TABS.concat(acc && acc.moderator ? [['moderation', 'Moderation']] : []);
      var active = { item: 'store', listing: 'community', new: 'creator', edit: 'creator', order: 'orders', checkout: 'cart' }[view] || view;
      var n = Cart().count();
      var isCreator = acc && acc.isVerifiedCreator;
      var studioBtn = isCreator
        ? '<a class="btn btn-primary btn-sm mk-studio-btn" href="#marketplace/creator" data-mk-nav="#marketplace/creator">Creator Studio</a>'
        : '<a class="btn btn-secondary btn-sm mk-studio-btn" href="creators.html" target="_blank">Become a Creator</a>';
      root.innerHTML = '<header class="page-header mk-head"><div class="header-titles"><h1 class="page-title">Marketplace</h1><p class="page-subtitle">' + esc(opts.sub || 'Official Fog of the Dragon goods and adventures, monsters, maps and more from the community.') + '</p></div>' +
        '<div class="header-actions">' + studioBtn + '<a class="btn btn-secondary btn-sm mk-cart-btn" href="#marketplace/cart" data-mk-nav="#marketplace/cart">Cart' + (n ? ' <span class="mk-badge">' + n + '</span>' : '') + '</a></div></header>' +
        '<nav class="mk-tabs" aria-label="Marketplace sections">' + tabs.map(function (t) { return '<a href="#marketplace/' + t[0] + '" data-mk-nav="#marketplace/' + t[0] + '" class="mk-tab' + (t[0] === active ? ' is-active' : '') + '"' + (t[0] === active ? ' aria-current="page"' : '') + '>' + esc(t[1]) + '</a>'; }).join('') + '</nav>' +
        (acc && acc.demoPayments ? '<p class="mk-demo-strip" role="note"><strong>Demo payments are on.</strong> Checkout simulates card payments with test cards; no money moves. Orders and your library are real records.</p>' : '') +
        '<p id="mk-note" role="status" class="mk-note' + (lastNote ? ' is-' + lastNote[1] : '') + '"' + (lastNote ? '' : ' hidden') + '>' + (lastNote ? esc(lastNote[0]) : '') + '</p>' +
        '<div id="mk-view">' + inner + '</div>';
      if (!opts.keepNote) lastNote = null; // a loading screen keeps the message for the view that follows it
    }
    var lastNote = null;
    function loading(msg) { shell('<div class="mk-state"><span class="mk-spin" aria-hidden="true"></span> ' + esc(msg || 'Loading…') + '</div>', { keepNote: true }); }
    function failed(msg, retry) { shell('<div class="mk-state is-error"><p>' + esc(msg) + '</p>' + (retry ? '<button type="button" class="btn btn-secondary btn-sm" data-mk="retry">Try again</button>' : '') + '</div>'); }
    function note(text, kind) {
      lastNote = text ? [text, kind || 'ok'] : null; // shown again if the view re-renders right after
      var el = root.querySelector('#mk-note');
      if (!el) return;
      el.className = 'mk-note' + (kind ? ' is-' + kind : '');
      el.textContent = text;
      el.hidden = !text;
    }
    function modal(html, label) {
      var d = document.createElement('dialog');
      d.className = 'mk-modal';
      d.setAttribute('aria-label', label || 'Details');
      d.innerHTML = '<button type="button" class="mk-modal-x" data-close aria-label="Close">✕</button>' + html;
      root.appendChild(d);
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
      d.addEventListener('close', function () { d.remove(); });
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
      return d;
    }

    // ---------------------------------------------------------------------------------------------------- Store
    var products = [];
    var storeFilter = { cat: '', q: '' };
    function productCard(p) {
      var actions = p.buyUrl
        ? '<a class="btn btn-primary btn-sm" href="' + esc(p.buyUrl) + '" target="_blank" rel="noopener noreferrer">Shop Now ↗</a>'
        : '<button type="button" class="btn btn-secondary btn-sm" data-mk="add-store" data-sku="' + esc(p.sku) + '">Add to cart</button><button type="button" class="btn btn-primary btn-sm" data-mk="buy-store" data-sku="' + esc(p.sku) + '">Buy now</button>';
      return '<article class="mk-card mk-product" data-sku="' + esc(p.sku) + '"><button type="button" class="mk-card-art" data-mk="product" data-sku="' + esc(p.sku) + '" aria-label="Details: ' + esc(p.name) + '">' + productVisual(p) + '</button>' +
        '<div class="mk-card-body"><p class="mk-kind">' + esc(Mk().STORE_CATEGORIES[p.category]) + '</p><h3 class="mk-card-title">' + esc(p.name) + '</h3><p class="mk-card-sum">' + esc(p.summary) + '</p>' +
        '<div class="mk-card-foot"><strong class="mk-price">~' + money(p.priceCents) + '</strong><span class="mk-card-actions">' + actions + '</span></div></div></article>';
    }
    // A real photo of the product type, with the FOD print design as a small inset; the design alone when there is no photo.
    function productVisual(p) {
      if (!p.photo) return global.FogStoreArt.svg(p.art);
      return '<img class="mk-photo" src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async"><span class="mk-print" title="Print design">' + global.FogStoreArt.svg(p.art) + '</span>';
    }
    function drawStoreGrid() {
      var q = storeFilter.q.toLowerCase();
      var list = products.filter(function (p) { return (!storeFilter.cat || p.category === storeFilter.cat) && (!q || (p.name + ' ' + p.summary).toLowerCase().indexOf(q) >= 0); });
      root.querySelector('#mk-store-grid').innerHTML = list.length ? list.map(productCard).join('') : '<p class="mk-empty">No product matches.</p>';
    }
    async function store() {
      loading('Loading the store…');
      var r = await Mk().storeProducts();
      if (!alive) return;
      if (!r.ok) return failed(r.message, true);
      products = r.products;
      shell('<div class="mk-banner"><strong>Curated D&D Gear.</strong> Hand-picked dice, accessories, books and more from trusted sellers. Links open the seller\'s page — prices are approximate.</div>' +
        '<div class="mk-toolbar"><div class="mk-chips" role="group" aria-label="Category"><button type="button" class="mk-chip is-on" data-mk-cat="">All</button>' +
        Object.keys(Mk().STORE_CATEGORIES).map(function (k) { return '<button type="button" class="mk-chip" data-mk-cat="' + k + '">' + esc(Mk().STORE_CATEGORIES[k]) + '</button>'; }).join('') + '</div>' +
        '<input type="search" class="form-control-dark mk-search" id="mk-store-q" placeholder="Search the store…" aria-label="Search the store"></div><div class="mk-grid" id="mk-store-grid"></div>', { sub: 'Curated dice, accessories, books and gear for your table.' });
      drawStoreGrid();
      if (view === 'item' && id) openProduct(id);
    }
    function productItem(p, opts) {
      return { type: 'store', ref: p.sku, title: p.name, unitCents: p.priceCents, quantity: opts.quantity || 1, art: p.art, photo: p.photoPath || null, options: opts.options || {}, kindLabel: Mk().STORE_CATEGORIES[p.category] };
    }
    function openProduct(sku) {
      var p = products.filter(function (x) { return x.sku === sku; })[0];
      if (!p) return note('That product isn\'t in the store anymore.', 'error');
      var d = p.details || {};
      var facts = Object.keys(d).filter(function (k) { return k !== 'sizes' && k !== 'options'; }).map(function (k) { return '<div><dt>' + esc(k.charAt(0).toUpperCase() + k.slice(1)) + '</dt><dd>' + esc(d[k] === true ? 'Yes' : d[k]) + '</dd></div>'; }).join('');
      var isAffiliate = !!p.buyUrl;
      var buyActions = isAffiliate
        ? '<a class="btn btn-primary" href="' + esc(p.buyUrl) + '" target="_blank" rel="noopener noreferrer">Shop Now ↗</a>'
        : (function () {
            var choices = d.sizes ? ['Size', d.sizes] : d.options ? ['Style', d.options] : null;
            return '<form class="mk-buy-form" data-sku="' + esc(p.sku) + '">' + (choices ? '<label class="mk-field"><span>' + choices[0] + '</span><select class="form-control-dark" name="choice">' + choices[1].map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label>' : '') +
              '<label class="mk-field mk-field-sm"><span>Quantity</span><input class="form-control-dark" type="number" name="qty" min="1" max="10" value="1"></label>' +
              '<div class="mk-actions"><button type="submit" class="btn btn-secondary" data-act="add">Add to cart</button><button type="submit" class="btn btn-primary" data-act="buy">Buy now</button></div></form>';
          })();
      var fine = isAffiliate
        ? 'Price is approximate. You will be redirected to the seller\'s page to complete your purchase. Fog of the Dragon is not affiliated with or endorsed by Wizards of the Coast.'
        : (p.photo ? 'The photo shows the kind of item; the print is an original Fog of the Dragon design. ' + (p.photoCredit ? esc(p.photoCredit) + (p.photoSource ? ' (<a href="' + esc(p.photoSource) + '" target="_blank" rel="noopener noreferrer">source</a>)' : '') + '. ' : '') : '') + 'Original Fog of the Dragon design. Not affiliated with or endorsed by Wizards of the Coast.';
      var dlg = modal('<div class="mk-detail"><div class="mk-detail-media"><div class="mk-detail-art">' + global.FogStoreArt.svg(p.art, { large: true }) + '</div></div>' +
        '<div class="mk-detail-body"><p class="mk-kind">' + esc(Mk().STORE_CATEGORIES[p.category]) + '</p><h2>' + esc(p.name) + '</h2><p>' + esc(p.summary) + '</p>' +
        '<p class="mk-price mk-price-lg">~' + money(p.priceCents) + '</p><dl class="mk-facts">' + facts + '</dl>' + buyActions +
        '<p class="mk-fine">' + fine + '</p></div></div>', p.name);
      if (!isAffiliate) {
        var form = dlg.querySelector('form');
        if (form) {
          var act = 'add';
          form.querySelectorAll('[data-act]').forEach(function (b) { b.addEventListener('click', function () { act = b.getAttribute('data-act'); }); });
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var choices = d.sizes ? ['Size', d.sizes] : d.options ? ['Style', d.options] : null;
            var opts = { quantity: Number(form.qty.value) || 1, options: form.choice ? { [choices[0].toLowerCase()]: form.choice.value } : {} };
            if (act === 'buy') { Cart().buyNow(productItem(p, opts)); dlg.close(); nav('#marketplace/checkout'); return; }
            var r = Cart().add(productItem(p, opts));
            dlg.close();
            note(r.ok ? '"' + p.name + '" added to your cart.' : r.message, r.ok ? 'ok' : 'error');
            refreshShellBadge();
          });
        }
      }
    }
    function refreshShellBadge() {
      var b = root.querySelector('.mk-cart-btn');
      var n = Cart().count();
      if (b) b.innerHTML = 'Cart' + (n ? ' <span class="mk-badge">' + n + '</span>' : '');
    }

    // ---------------------------------------------------------------------------------------------------- Community
    var listings = [];
    var lib = {};
    var cf = { q: '', kind: '', paid: '', min: '', max: '', level: '', edition: '', genre: '', creator: '', sort: 'new' };
    function cover(l, cls) {
      var ph = '<span class="mk-ph" aria-hidden="true"><span>' + esc(kindLabel(l.kind)) + '</span></span>';
      return '<span class="mk-cover ' + (cls || '') + '">' + (l.coverPath ? '<img data-mk-img="' + esc(l.coverPath) + '" alt="">' : '') + ph + '</span>';
    }
    function listingCard(l) {
      var owned = !!lib[l.id];
      return '<article class="mk-card mk-listing" data-id="' + esc(l.id) + '"><a class="mk-card-art" href="#marketplace/listing/' + esc(l.id) + '" data-mk-nav="#marketplace/listing/' + esc(l.id) + '" aria-label="' + esc(l.title) + '">' + cover(l) + '</a>' +
        '<div class="mk-card-body"><p class="mk-kind">' + esc(kindLabel(l.kind)) + (levels(l) ? ' · ' + esc(levels(l)) : '') + '</p><h3 class="mk-card-title"><a href="#marketplace/listing/' + esc(l.id) + '" data-mk-nav="#marketplace/listing/' + esc(l.id) + '">' + esc(l.title) + '</a></h3>' +
        '<p class="mk-by">by ' + esc(l.creatorName) + '</p><p class="mk-card-sum">' + esc(l.summary || l.description.slice(0, 140)) + '</p>' +
        (l.tags.length ? '<p class="mk-tags">' + l.tags.slice(0, 4).map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</p>' : '') +
        '<div class="mk-card-foot"><strong class="mk-price' + (l.priceCents ? '' : ' is-free') + '">' + price(l.priceCents) + '</strong><span class="mk-muted">' + l.downloads + ' download' + (l.downloads === 1 ? '' : 's') + '</span>' +
        (owned ? '<span class="mk-pill">In your library</span>' : '') + '</div></div></article>';
    }
    function filtered() {
      var q = cf.q.toLowerCase(), cr = cf.creator.toLowerCase();
      var list = listings.filter(function (l) {
        if (cf.kind && (cf.kind === 'g:adventure' || cf.kind === 'g:asset' ? Mk().KINDS[l.kind].group !== cf.kind.slice(2) : l.kind !== cf.kind)) return false;
        if (cf.paid === 'free' && l.priceCents) return false;
        if (cf.paid === 'paid' && !l.priceCents) return false;
        if (cf.min !== '' && l.priceCents < Number(cf.min) * 100) return false;
        if (cf.max !== '' && l.priceCents > Number(cf.max) * 100) return false;
        if (cf.level && !((l.levelMin || 1) <= Number(cf.level) && Number(cf.level) <= (l.levelMax || 20))) return false;
        if (cf.edition && l.edition !== cf.edition) return false;
        if (cf.genre && (l.genre + ' ' + l.theme).toLowerCase().indexOf(cf.genre.toLowerCase()) < 0) return false;
        if (cr && l.creatorName.toLowerCase().indexOf(cr) < 0) return false;
        return !q || (l.title + ' ' + l.summary + ' ' + l.description + ' ' + l.tags.join(' ') + ' ' + l.creatorName + ' ' + kindLabel(l.kind)).toLowerCase().indexOf(q) >= 0;
      });
      list.sort(function (a, b) {
        if (cf.sort === 'popular') return b.downloads - a.downloads;
        if (cf.sort === 'price-asc') return a.priceCents - b.priceCents;
        if (cf.sort === 'price-desc') return b.priceCents - a.priceCents;
        return String(b.publishedAt).localeCompare(String(a.publishedAt));
      });
      return list;
    }
    async function hydrate() {
      var imgs = [].slice.call(root.querySelectorAll('img[data-mk-img]'));
      if (!imgs.length) return;
      var u = await Mk().urls(imgs.map(function (i) { return i.getAttribute('data-mk-img'); }));
      imgs.forEach(function (i) {
        var src = u[i.getAttribute('data-mk-img')];
        if (src) { i.onload = function () { i.parentNode.classList.add('is-loaded'); }; i.onerror = function () { i.remove(); }; i.src = src; } else i.remove();
      });
    }
    function drawCommunityGrid() {
      var list = filtered();
      root.querySelector('#mk-count').textContent = list.length + ' listing' + (list.length === 1 ? '' : 's');
      root.querySelector('#mk-list-grid').innerHTML = list.length ? list.map(listingCard).join('') :
        '<div class="mk-empty"><p><strong>' + (listings.length ? 'Nothing matches these filters.' : 'No community content yet.') + '</strong></p><p>' + (listings.length ? 'Try fewer filters.' : 'Be the first: publish an adventure, a monster or a map from the Creator tab.') + '</p></div>';
      hydrate();
    }
    async function loadLibraryIds() {
      var r = await Mk().library();
      lib = {};
      if (r.ok) r.items.forEach(function (x) { lib[x.listingId] = x; });
      return r;
    }
    async function community() {
      loading('Loading community content…');
      var r = await Mk().browse();
      if (!alive) return;
      if (!r.ok) return failed(r.message, true);
      listings = r.listings;
      await loadLibraryIds();
      if (!alive) return;
      var kinds = Object.keys(Mk().KINDS);
      var opt = function (o, cur) { return o.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(cur) === String(x[0]) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join(''); };
      shell('<p class="mk-disclaimer">Community content is made and owned by its creators. Listings are reviewed before they appear, but Fog of the Dragon doesn\'t endorse them. Something wrong? Use "Report" on the listing.</p>' +
        '<div class="mk-community"><aside class="mk-filters" aria-label="Filters">' +
        '<label class="mk-field"><span>Search</span><input type="search" class="form-control-dark" data-cf="q" placeholder="Title, tag, creator…"></label>' +
        '<label class="mk-field"><span>Content type</span><select class="form-control-dark" data-cf="kind"><option value="">All types</option><option value="g:adventure">All adventure content</option><option value="g:asset">All game assets</option>' +
        '<optgroup label="Adventure content">' + opt(kinds.filter(function (k) { return Mk().KINDS[k].group === 'adventure'; }).map(function (k) { return [k, Mk().KINDS[k].label]; })) + '</optgroup><optgroup label="Game assets">' + opt(kinds.filter(function (k) { return Mk().KINDS[k].group === 'asset'; }).map(function (k) { return [k, Mk().KINDS[k].label]; })) + '</optgroup></select></label>' +
        '<label class="mk-field"><span>Price</span><select class="form-control-dark" data-cf="paid"><option value="">Free and paid</option><option value="free">Free only</option><option value="paid">Paid only</option></select></label>' +
        '<div class="mk-field"><span>Price range (USD)</span><div class="mk-range"><input class="form-control-dark" type="number" min="0" data-cf="min" placeholder="Min" aria-label="Minimum price"><input class="form-control-dark" type="number" min="0" data-cf="max" placeholder="Max" aria-label="Maximum price"></div></div>' +
        '<label class="mk-field"><span>For party level</span><select class="form-control-dark" data-cf="level"><option value="">Any level</option>' + opt(Array.from({ length: 20 }, function (_, i) { return [i + 1, 'Level ' + (i + 1)]; })) + '</select></label>' +
        '<label class="mk-field"><span>Edition</span><select class="form-control-dark" data-cf="edition"><option value="">Any edition</option>' + opt(Object.keys(Mk().EDITIONS).map(function (k) { return [k, Mk().EDITIONS[k]]; })) + '</select></label>' +
        '<label class="mk-field"><span>Genre or theme</span><input class="form-control-dark" data-cf="genre" placeholder="Horror, heist…"></label>' +
        '<label class="mk-field"><span>Creator</span><input class="form-control-dark" data-cf="creator" placeholder="Creator name"></label>' +
        '<label class="mk-field"><span>Sort</span><select class="form-control-dark" data-cf="sort"><option value="new">Newest</option><option value="popular">Most downloaded</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-mk="cf-clear">Clear filters</button></aside>' +
        '<section class="mk-results"><p class="mk-count" id="mk-count" aria-live="polite"></p><div class="mk-grid" id="mk-list-grid"></div></section></div>', { sub: 'Adventures and game assets shared by players and Dungeon Masters.' });
      drawCommunityGrid();
    }

    // ---------------------------------------------------------------------------------------------------- Listing page
    async function listingPage() {
      loading('Loading the listing…');
      var r = await Mk().get(id);
      if (!alive) return;
      if (!r.ok) return failed(r.message, !r.notFound);
      var l = r.listing;
      await loadLibraryIds();
      if (!alive) return;
      var owned = !!lib[l.id] || l.mine;
      var inCart = Cart().has('listing:' + l.id);
      var canBuy = l.status === 'published' && !owned;
      var pending = l.status !== 'published';
      var actions = l.mine
        ? '<a class="btn btn-secondary" href="#marketplace/edit/' + esc(l.id) + '" data-mk-nav="#marketplace/edit/' + esc(l.id) + '">Edit listing</a>'
        : owned ? '<span class="mk-pill is-ok">In your library</span>'
          : !canBuy ? ''
            : l.priceCents ? '<button type="button" class="btn btn-secondary" data-mk="add-listing"' + (inCart ? ' disabled' : '') + '>' + (inCart ? 'In your cart' : 'Add to cart') + '</button><button type="button" class="btn btn-primary" data-mk="buy-listing">Buy now · ' + money(l.priceCents) + '</button>'
              : '<button type="button" class="btn btn-primary" data-mk="claim">Get it free</button>';
      var included = (l.contentKind ? '<li>' + (l.contentKind === 'adventure' ? 'A complete adventure you can add to your Adventures (text, chapters, sections and assets; pictures not included)' : 'A homebrew entry you can add to your Homebrew') + '</li>' : '') +
        l.files.map(function (f) { return '<li>' + esc(f.name) + ' <span class="mk-muted">(' + size(f.size) + ')</span></li>'; }).join('');
      shell('<a class="btn-back mk-back" href="#marketplace/community" data-mk-nav="#marketplace/community">← Community</a>' +
        (pending ? '<div class="mk-banner is-warn"><strong>' + esc(Mk().STATUS_LABEL[l.status]) + '.</strong> ' + (l.status === 'pending_review' ? 'Only you and moderators can see this until it is approved.' : l.status === 'rejected' ? 'A moderator asked for changes: ' + esc(l.moderationNote) : l.status === 'removed' ? 'This listing was removed. People who already have it keep it.' : 'Only you can see this draft.') + '</div>' : '') +
        '<article class="mk-page"><div class="mk-gallery">' + cover(l, 'mk-cover-lg') + (l.previewPaths.length ? '<div class="mk-previews">' + l.previewPaths.map(function (p) { return '<button type="button" class="mk-prev" data-mk="zoom" data-path="' + esc(p) + '"><img data-mk-img="' + esc(p) + '" alt="Preview"></button>'; }).join('') + '</div>' : '') + '</div>' +
        '<div class="mk-page-body"><p class="mk-kind">' + esc(kindLabel(l.kind)) + ' · ' + esc(Mk().EDITIONS[l.edition]) + '</p><h2 class="mk-page-title">' + esc(l.title) + '</h2><p class="mk-by">by ' + esc(l.creatorName) + (l.publishedAt ? ' · published ' + esc(when(l.publishedAt)) : '') + ' · ' + l.downloads + ' download' + (l.downloads === 1 ? '' : 's') + '</p>' +
        '<p class="mk-price mk-price-lg' + (l.priceCents ? '' : ' is-free') + '">' + price(l.priceCents) + '</p><div class="mk-actions">' + actions + '</div>' +
        (owned && !l.mine ? '<div class="mk-actions"><a class="btn btn-secondary btn-sm" href="#marketplace/library" data-mk-nav="#marketplace/library">Open in My library</a></div>' : '') +
        '<div class="mk-desc">' + esc(l.description).replace(/\n/g, '<br>') + '</div>' +
        '<h3>What\'s included</h3><ul class="mk-included">' + (included || '<li class="mk-muted">Nothing listed.</li>') + '</ul>' +
        '<dl class="mk-facts">' + (levels(l) ? '<div><dt>Levels</dt><dd>' + esc(levels(l)) + '</dd></div>' : '') + (l.genre ? '<div><dt>Genre</dt><dd>' + esc(l.genre) + '</dd></div>' : '') + (l.theme ? '<div><dt>Theme</dt><dd>' + esc(l.theme) + '</dd></div>' : '') +
        '<div><dt>Source</dt><dd>' + esc(Mk().ORIGINS[l.origin]) + '</dd></div><div><dt>License</dt><dd>' + esc(Mk().LICENSES[l.license]) + '</dd></div></dl>' +
        (l.attribution ? '<p class="mk-fine"><strong>Attribution:</strong> ' + esc(l.attribution) + '</p>' : '') +
        (l.tags.length ? '<p class="mk-tags">' + l.tags.map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</p>' : '') +
        '<p class="mk-fine">Made by a community member. Fog of the Dragon reviews listings but does not endorse them.</p>' +
        (!l.mine && l.status === 'published' ? '<button type="button" class="mk-link" data-mk="report">Report this listing</button>' : '') +
        (acc && acc.moderator && l.status === 'pending_review' ? moderationBox(l) : '') + '</div></article>');
      hydrate();
      if (acc && acc.moderator && l.status === 'pending_review') loadAiReview(l);
      cleanups.push(function () { l = null; });
      root.__listing = r.listing;
    }
    var RISK = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' };
    var DECISION = { approve: 'Gemini suggests: publish', reject: 'Gemini suggests: ask for changes', needs_human: 'Gemini isn\'t sure: your call' };
    function aiPanel(l, r, state) {
      if (state === 'loading') return '<p class="mk-muted"><span class="mk-spin" aria-hidden="true"></span> Loading Gemini\'s review…</p>';
      if (state === 'asking') return '<p class="mk-muted"><span class="mk-spin" aria-hidden="true"></span> Asking Gemini… (images and PDFs can take up to a minute)</p>';
      var mode = acc && acc.reviewMode;
      var again = '<button type="button" class="btn btn-secondary btn-sm" data-mk="ai-again" data-id="' + esc(l.id) + '">' + (r && r.review ? 'Ask Gemini again' : 'Ask Gemini') + '</button>';
      if (mode === 'manual') return '<p class="mk-muted">Automatic review is off (review mode "manual"). You review every listing yourself.</p>';
      if (r && r.error) return '<p class="mk-form-error">' + esc(r.error) + '</p>' + again;
      var v = r && r.review;
      if (!v) return '<p class="mk-muted">' + (r && r.notSetUp ? 'The AI reviewer isn\'t set up in the database yet (migration 20261118120200_marketplace_ai_review.sql).' : 'No AI review yet for this listing.') + '</p>' + (r && r.notSetUp ? '' : again);
      var stale = l.updatedAt && v.version && new Date(v.version).getTime() !== new Date(l.updatedAt).getTime();
      var ins = v.inspected || {};
      return '<div class="mk-ai is-' + esc(v.decision) + ' risk-' + esc(v.risk) + '"><p class="mk-ai-head"><strong>' + esc(DECISION[v.decision] || v.decision) + '</strong><span class="mk-pill">' + esc(RISK[v.risk] || v.risk) + '</span></p>' +
        (v.summary ? '<p>' + esc(v.summary) + '</p>' : '') + (v.reasons.length ? '<ul class="mk-ai-reasons">' + v.reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        (v.suggestedNote ? '<p class="mk-fine"><strong>Suggested note:</strong> ' + esc(v.suggestedNote) + ' <button type="button" class="mk-link" data-mk="ai-use-note" data-note="' + esc(v.suggestedNote) + '">Use this note</button></p>' : '') +
        '<p class="mk-fine">Checked: listing text' + (ins.textFiles ? ', ' + ins.textFiles + ' text file(s)' : '') + (ins.images ? ', ' + ins.images + ' image(s)' : '') + (ins.pdfs ? ', ' + ins.pdfs + ' PDF(s)' : '') +
        (ins.skipped && ins.skipped.length ? '. <strong>Not checked:</strong> ' + esc(ins.skipped.join(', ')) : '') + '. ' + esc(when(v.createdAt)) + (v.model ? ' · ' + esc(v.model) : '') + '</p>' +
        (stale ? '<p class="mk-form-error">The listing changed after this review.</p>' : '') + '</div>' + again;
    }
    async function loadAiReview(l, force) {
      var box = root.querySelector('#mk-ai');
      if (!box) return;
      box.innerHTML = aiPanel(l, null, force ? 'asking' : 'loading');
      var r;
      if (force) {
        var asked = await Mk().requestAiReview(l.id, true);
        if (!alive || !root.querySelector('#mk-ai')) return;
        if (asked.ok && asked.autoPublished) { note('Gemini approved it with low risk: published automatically.', 'ok'); render(); return; }
        r = asked.ok ? await Mk().aiReview(l.id) : { error: asked.message };
      } else r = await Mk().aiReview(l.id);
      if (!alive || !root.querySelector('#mk-ai')) return;
      if (r.ok === false) r = { error: r.message };
      root.querySelector('#mk-ai').innerHTML = aiPanel(l, r);
    }
    function moderationBox(l) {
      return '<section class="mk-modbox" aria-label="Moderation"><h3>Moderation</h3><div class="mk-ai-box" aria-label="Gemini\'s first opinion" id="mk-ai"></div><label class="mk-field"><span>Note to the creator (needed to reject)</span><textarea class="form-control-dark" id="mk-mod-note" rows="2" maxlength="1000"></textarea></label>' +
        '<div class="mk-actions"><button type="button" class="btn btn-primary btn-sm" data-mk="mod" data-decision="approve" data-id="' + esc(l.id) + '">Approve and publish</button><button type="button" class="btn btn-secondary btn-sm" data-mk="mod" data-decision="reject" data-id="' + esc(l.id) + '">Ask for changes</button><button type="button" class="btn btn-outline-crimson btn-sm" data-mk="mod" data-decision="remove" data-id="' + esc(l.id) + '">Remove</button></div></section>';
    }
    function listingItem(l) { return { type: 'listing', ref: l.id, title: l.title, unitCents: l.priceCents, quantity: 1, cover: l.coverPath, kindLabel: kindLabel(l.kind) }; }

    // ---------------------------------------------------------------------------------------------------- Creator
    async function creator() {
      loading('Loading your listings…');
      var r = await Mk().mine();
      if (!alive) return;
      if (!r.ok) return failed(r.message, true);
      var st = await Mk().stats();
      var byId = {};
      (st.ok ? st.stats : []).forEach(function (s) { byId[s.listing] = s; });
      var all = r.listings;
      var filter = root.__creatorFilter || 'all';
      var counts = { all: all.length };
      ['draft', 'pending_review', 'published', 'rejected', 'removed'].forEach(function (s) { counts[s] = all.filter(function (l) { return l.status === s; }).length; });
      var tot = all.reduce(function (a, l) { var s = byId[l.id] || {}; a.dl += l.downloads; a.sales += s.sales || 0; a.demo += s.demoSales || 0; a.net += s.net || 0; return a; }, { dl: 0, sales: 0, demo: 0, net: 0 });
      var fee = acc ? acc.feeBps / 100 : 10;
      var list = all.filter(function (l) { return filter === 'all' || l.status === filter; });
      shell('<div class="mk-creator-head"><div class="mk-tiles"><div class="mk-tile"><span>Listings</span><strong>' + all.length + '</strong></div><div class="mk-tile"><span>Published</span><strong>' + counts.published + '</strong></div>' +
        '<div class="mk-tile"><span>Downloads</span><strong>' + tot.dl + '</strong></div><div class="mk-tile"><span>Sales</span><strong>' + tot.sales + '</strong>' + (tot.demo ? '<em>' + tot.demo + ' with demo payments</em>' : '') + '</div>' +
        '<div class="mk-tile"><span>Your share</span><strong>' + money(tot.net) + '</strong><em>after FOD\'s ' + fee + '% fee' + (tot.demo ? ' · demo, not paid out' : '') + '</em></div></div>' +
        '<a class="btn btn-primary" href="#marketplace/new" data-mk-nav="#marketplace/new">+ New listing</a></div>' +
        '<p class="mk-fine">Payouts to creators aren\'t set up yet: sales made with demo payments are shown for testing and are never paid out.</p>' +
        '<div class="mk-chips" role="group" aria-label="Show">' + [['all', 'All'], ['draft', 'Drafts'], ['pending_review', 'Pending review'], ['published', 'Published'], ['rejected', 'Changes needed'], ['removed', 'Removed']].map(function (t) {
          return '<button type="button" class="mk-chip' + (filter === t[0] ? ' is-on' : '') + '" data-mk="cfilter" data-f="' + t[0] + '">' + t[1] + ' <span>' + counts[t[0]] + '</span></button>'; }).join('') + '</div>' +
        (list.length ? '<ul class="mk-mylist">' + list.map(function (l) {
          var s = byId[l.id] || {};
          return '<li class="mk-myrow"><span class="mk-status is-' + l.status + '">' + esc(Mk().STATUS_LABEL[l.status]) + '</span><div class="mk-myrow-main"><strong>' + esc(l.title) + '</strong><span class="mk-muted">' + esc(kindLabel(l.kind)) + ' · ' + price(l.priceCents) + ' · ' + l.downloads + ' downloads · ' + (s.sales || 0) + ' sales · updated ' + esc(when(l.updatedAt)) + '</span>' +
            (l.moderationNote && (l.status === 'rejected' || l.status === 'removed') ? '<span class="mk-modnote">Moderator: ' + esc(l.moderationNote) + '</span>' : '') + '</div><div class="mk-myrow-tools">' +
            '<a class="btn btn-secondary btn-sm" href="#marketplace/listing/' + esc(l.id) + '" data-mk-nav="#marketplace/listing/' + esc(l.id) + '">View</a>' +
            (l.status !== 'removed' ? '<a class="btn btn-secondary btn-sm" href="#marketplace/edit/' + esc(l.id) + '" data-mk-nav="#marketplace/edit/' + esc(l.id) + '">Edit</a>' : '') +
            (l.status === 'draft' || l.status === 'rejected' ? '<button type="button" class="btn btn-primary btn-sm" data-mk="submit" data-id="' + esc(l.id) + '">Submit for review</button>' : '') +
            (l.status === 'pending_review' ? '<button type="button" class="btn btn-secondary btn-sm" data-mk="withdraw" data-id="' + esc(l.id) + '">Back to draft</button>' : '') +
            (l.status === 'published' || l.status === 'pending_review' ? '<button type="button" class="btn btn-outline-crimson btn-sm" data-mk="remove" data-id="' + esc(l.id) + '">Remove</button>' : '') +
            (l.status === 'draft' || l.status === 'rejected' ? '<button type="button" class="btn btn-outline-crimson btn-sm" data-mk="delete" data-id="' + esc(l.id) + '">Delete</button>' : '') + '</div></li>';
        }).join('') + '</ul>' : '<div class="mk-empty"><p><strong>' + (all.length ? 'Nothing here.' : 'You haven\'t listed anything yet.') + '</strong></p><p>Share an adventure, a monster or a map. You choose free or a price; FOD keeps ' + fee + '% of paid sales.</p></div>'), { sub: 'Your listings, their review status and how they are doing.' });
    }

    // ---------------------------------------------------------------------------------------------------- Editor
    async function editor() {
      var l = null;
      if (view === 'edit') {
        loading('Loading the listing…');
        var r = await Mk().get(id);
        if (!alive) return;
        if (!r.ok) return failed(r.message, true);
        if (!r.listing.mine) return failed('Only the creator can edit this listing.');
        l = r.listing;
        if (l.status === 'removed') return failed('This listing was removed and can no longer be edited.');
      }
      var advs = global.FogAdventureStore ? await global.FogAdventureStore.list() : { ok: false };
      var hbs = global.FogHomebrewStore ? await global.FogHomebrewStore.list() : { ok: false };
      if (!alive) return;
      var f = l || { kind: 'adventure', title: '', summary: '', description: '', priceCents: 0, edition: '5e-2024', origin: 'original', license: 'personal-use', attribution: '', rightsConfirmed: false, levelMin: null, levelMax: null, genre: '', theme: '', tags: [], coverPath: null, previewPaths: [], files: [], contentKind: null };
      var opt = function (o, cur) { return o.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(cur == null ? '' : cur) === String(x[0]) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join(''); };
      var lv = [['', '—']].concat(Array.from({ length: 20 }, function (_, i) { return [i + 1, i + 1]; }));
      var srcOpts = [['', f.contentKind ? 'Keep the attached content' : 'No content from my library']].concat(
        (advs.ok ? advs.adventures : []).map(function (a) { return ['adventure:' + a.id, 'Adventure: ' + a.title]; }),
        (hbs.ok ? hbs.entries : []).map(function (e) { return ['homebrew:' + e.id, 'Homebrew: ' + e.name]; }));
      if (f.contentKind) srcOpts.push(['none', 'Remove the attached content']);
      var warn = l && (l.status === 'published' || l.status === 'pending_review') ? '<div class="mk-banner is-warn">Saving changes sends this listing back to review; it stays hidden until a moderator approves it again.</div>' : '';
      shell('<a class="btn-back mk-back" href="#marketplace/creator" data-mk-nav="#marketplace/creator">← Creator</a>' + warn + (l && l.status === 'rejected' && l.moderationNote ? '<div class="mk-banner is-warn"><strong>Moderator:</strong> ' + esc(l.moderationNote) + '</div>' : '') +
        '<form class="mk-editor" id="mk-ed" novalidate><div class="mk-ed-main"><h2>' + (l ? 'Edit listing' : 'New listing') + '</h2>' +
        '<label class="mk-field"><span>Title</span><input class="form-control-dark" name="title" maxlength="100" required value="' + esc(f.title) + '"></label>' +
        '<label class="mk-field"><span>Content type</span><select class="form-control-dark" name="kind">' + opt(Object.keys(Mk().KINDS).map(function (k) { return [k, Mk().KINDS[k].label]; }), f.kind) + '</select></label>' +
        '<label class="mk-field"><span>Short summary <em>shown on the card</em></span><input class="form-control-dark" name="summary" maxlength="280" value="' + esc(f.summary) + '"></label>' +
        '<label class="mk-field"><span>Description <em>what it is and what is included</em></span><textarea class="form-control-dark" name="description" rows="7" maxlength="8000">' + esc(f.description) + '</textarea></label>' +
        '<div class="mk-row"><label class="mk-field"><span>Price</span><select class="form-control-dark" name="pricing"><option value="free"' + (f.priceCents ? '' : ' selected') + '>Free</option><option value="paid"' + (f.priceCents ? ' selected' : '') + '>Paid</option></select></label>' +
        '<label class="mk-field" data-ed="price"><span>Price (USD, 1.99–19.99)</span><input class="form-control-dark" name="price" type="number" min="1.99" max="19.99" step="0.01" value="' + (f.priceCents ? (f.priceCents / 100).toFixed(2) : '4.99') + '"></label></div>' +
        '<p class="mk-fine" data-ed="fee"></p>' +
        '<div class="mk-row"><label class="mk-field"><span>Edition</span><select class="form-control-dark" name="edition">' + opt(Object.keys(Mk().EDITIONS).map(function (k) { return [k, Mk().EDITIONS[k]]; }), f.edition) + '</select></label>' +
        '<label class="mk-field"><span>Lowest level</span><select class="form-control-dark" name="levelMin">' + opt(lv, f.levelMin) + '</select></label><label class="mk-field"><span>Highest level</span><select class="form-control-dark" name="levelMax">' + opt(lv, f.levelMax) + '</select></label></div>' +
        '<div class="mk-row"><label class="mk-field"><span>Genre</span><input class="form-control-dark" name="genre" maxlength="40" value="' + esc(f.genre) + '" placeholder="Horror, heist…"></label><label class="mk-field"><span>Theme</span><input class="form-control-dark" name="theme" maxlength="80" value="' + esc(f.theme) + '"></label></div>' +
        '<label class="mk-field"><span>Tags <em>comma-separated, up to 12</em></span><input class="form-control-dark" name="tags" value="' + esc(f.tags.join(', ')) + '"></label>' +
        '<fieldset class="mk-fieldset"><legend>Source and license</legend><div class="mk-row"><label class="mk-field"><span>Source</span><select class="form-control-dark" name="origin">' + opt(Object.keys(Mk().ORIGINS).map(function (k) { return [k, Mk().ORIGINS[k]]; }), f.origin) + '</select></label>' +
        '<label class="mk-field"><span>License you give buyers</span><select class="form-control-dark" name="license">' + opt(Object.keys(Mk().LICENSES).map(function (k) { return [k, Mk().LICENSES[k]]; }), f.license) + '</select></label></div>' +
        '<label class="mk-field"><span>Attribution <em>required for rules-based content</em></span><textarea class="form-control-dark" name="attribution" rows="2" maxlength="1000">' + esc(f.attribution) + '</textarea></label><button type="button" class="mk-link" data-mk="srd-attr">Insert the rules attribution</button>' +
        '<label class="mk-check"><input type="checkbox" name="rights"' + (f.rightsConfirmed ? ' checked' : '') + '> I created this content or have the right to share it. It contains no copied text or art from published books, official D&amp;D logos or other people\'s work, and no programs.</label></fieldset>' +
        '<fieldset class="mk-fieldset"><legend>What buyers get</legend><label class="mk-field"><span>Content from my library <em>a copy, made when you save</em></span><select class="form-control-dark" name="source">' + opt(srcOpts, '') + '</select></label>' +
        (f.contentKind ? '<p class="mk-fine">Attached: ' + (f.contentKind === 'adventure' ? 'an adventure' : 'a homebrew entry') + '. Pictures from your library are not included; upload them as previews or files.</p>' : '') +
        '<div class="mk-field"><span>Files <em>PDF, images, JSON, text or Markdown; up to 10, 25 MB each; no programs or archives</em></span><ul class="mk-files" id="mk-files"></ul>' +
        (l ? '<label class="btn btn-secondary btn-sm mk-file-btn">Add files<input type="file" multiple hidden data-up="files" accept=".pdf,.png,.jpg,.jpeg,.webp,.json,.txt,.md"></label>' : '<p class="mk-fine">Save the draft first to add files and pictures.</p>') + '</div></fieldset>' +
        '<fieldset class="mk-fieldset"><legend>Pictures</legend><div class="mk-field"><span>Cover</span><div id="mk-cover-ed"></div>' + (l ? '<label class="btn btn-secondary btn-sm mk-file-btn">Choose cover<input type="file" hidden data-up="cover" accept="image/png,image/jpeg,image/webp"></label>' : '') + '</div>' +
        '<div class="mk-field"><span>Previews <em>up to 6</em></span><div class="mk-prev-ed" id="mk-prev-ed"></div>' + (l ? '<label class="btn btn-secondary btn-sm mk-file-btn">Add previews<input type="file" multiple hidden data-up="previews" accept="image/png,image/jpeg,image/webp"></label>' : '') + '</div></fieldset>' +
        '<p class="mk-form-error" role="alert" hidden></p><div class="mk-actions mk-ed-actions"><button type="submit" class="btn btn-secondary" data-act="save">' + (l ? 'Save changes' : 'Save draft') + '</button>' +
        (l && (l.status === 'draft' || l.status === 'rejected') ? '<button type="submit" class="btn btn-primary" data-act="submit">Save and submit for review</button>' : '') + '</div></div>' +
        '<aside class="mk-ed-preview" aria-label="Preview"><h3>Preview</h3><p class="mk-fine">How the card looks in the Community Marketplace.</p><div id="mk-ed-card"></div></aside></form>', { sub: l ? 'Edit your listing. Changes to a published listing are reviewed again.' : 'Describe it, set a price or make it free, then submit it for review.' });
      var form = root.querySelector('#mk-ed');
      var err = form.querySelector('.mk-form-error');
      var files = (f.files || []).slice();
      var coverPath = f.coverPath;
      var previews = (f.previewPaths || []).slice();
      function current() {
        var paid = form.pricing.value === 'paid';
        return {
          title: form.title.value.trim(), kind: form.kind.value, summary: form.summary.value.trim(), description: form.description.value, priceCents: paid ? Math.round(Number(form.price.value) * 100) : 0,
          edition: form.edition.value, levelMin: form.levelMin.value ? Number(form.levelMin.value) : null, levelMax: form.levelMax.value ? Number(form.levelMax.value) : null,
          genre: form.genre.value.trim(), theme: form.theme.value.trim(), tags: form.tags.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 12),
          origin: form.origin.value, license: form.license.value, attribution: form.attribution.value.trim(), rightsConfirmed: form.rights.checked, files: files, coverPath: coverPath, previewPaths: previews,
        };
      }
      function drawSide() {
        var c = current();
        var isPaid = form.pricing.value === 'paid';
        form.querySelector('[data-ed="price"]').hidden = !isPaid;
        var fee = acc ? acc.feeBps : 1000;
        var notVerified = isPaid && !(acc && acc.isVerifiedCreator);
        form.querySelector('[data-ed="fee"]').innerHTML = notVerified
          ? '<strong style="color:var(--status-error,#e85a6a)">Paid listings require a verified Creator account.</strong> <a href="creators.html" target="_blank">Apply here</a>, or set this listing to Free.'
          : c.priceCents ? 'Buyers pay ' + money(c.priceCents) + '. FOD keeps ' + (fee / 100) + '% (' + money(Math.round(c.priceCents * fee / 10000)) + '); your share is ' + money(c.priceCents - Math.round(c.priceCents * fee / 10000)) + '. Payouts are not set up yet.' : 'Free: anyone can add it to their library.';
        form.querySelector('#mk-files').innerHTML = files.length ? files.map(function (x, i) { return '<li>' + esc(x.name) + ' <span class="mk-muted">' + size(x.size) + '</span> <button type="button" class="mk-link" data-mk="rm-file" data-i="' + i + '">Remove</button></li>'; }).join('') : '<li class="mk-muted">No files.</li>';
        form.querySelector('#mk-cover-ed').innerHTML = coverPath ? '<span class="mk-cover mk-cover-sm"><img data-mk-img="' + esc(coverPath) + '" alt="Cover"></span> <button type="button" class="mk-link" data-mk="rm-cover">Remove</button>' : '<span class="mk-muted">No cover: a placeholder is shown.</span>';
        form.querySelector('#mk-prev-ed').innerHTML = previews.map(function (p, i) { return '<span class="mk-prev-thumb"><img data-mk-img="' + esc(p) + '" alt="Preview"><button type="button" class="mk-link" data-mk="rm-prev" data-i="' + i + '">Remove</button></span>'; }).join('') || '<span class="mk-muted">No previews.</span>';
        var card = Object.assign({ id: 'preview', creatorName: (global.FogAccount.getAccount() || { profile: {} }).profile.displayName || 'You', downloads: 0, publishedAt: null }, c);
        form.querySelector('#mk-ed-card').innerHTML = listingCard(card);
        hydrate();
      }
      async function snapshot(sel) {
        if (!sel || sel === 'none') return null;
        var parts = sel.split(':');
        if (parts[0] === 'adventure') {
          var a = await global.FogAdventureStore.get(parts[1]);
          if (!a.ok) throw new Error(a.message);
          var adv = JSON.parse(JSON.stringify(a.adventure));
          ['id', 'version', 'createdAt', 'updatedAt', 'chapterCount', 'sectionCount', 'campaigns'].forEach(function (k) { delete adv[k]; });
          (adv.content.chapters || []).forEach(function (c) { c.images = []; (c.sections || []).forEach(function (s) { s.images = []; }); });
          (adv.content.assets || []).forEach(function (x) { x.images = []; });
          adv.status = 'draft';
          return { kind: 'adventure', content: adv };
        }
        var h = await global.FogHomebrewStore.get(parts[1]);
        if (!h.ok) throw new Error(h.message);
        var e = JSON.parse(JSON.stringify(h.entry));
        ['id', 'version', 'createdAt', 'updatedAt'].forEach(function (k) { delete e[k]; });
        if (e.data) e.data.image = null;
        return { kind: 'homebrew', content: e };
      }
      async function upload(list, area) {
        err.hidden = true;
        var out = [];
        for (var i = 0; i < list.length; i++) {
          var r2 = await Mk().upload(l.id, list[i], area);
          if (!alive) return out;
          if (!r2.ok) { err.textContent = r2.message; err.hidden = false; } else out.push(r2);
        }
        return out;
      }
      form.addEventListener('input', drawSide);
      form.addEventListener('change', async function (e) {
        var t = e.target;
        var up = t.getAttribute && t.getAttribute('data-up');
        if (!up || !t.files || !t.files.length) return drawSide();
        var picked = [].slice.call(t.files);
        t.value = '';
        if (up === 'files') { if (files.length + picked.length > 10) { err.textContent = 'At most 10 files.'; err.hidden = false; return; } (await upload(picked, 'files')).forEach(function (x) { files.push({ path: x.path, name: x.name, size: x.size, type: x.type }); }); }
        else if (up === 'cover') { var c = await upload(picked.slice(0, 1), 'media'); if (c[0]) coverPath = c[0].path; }
        else { if (previews.length + picked.length > 6) { err.textContent = 'At most 6 previews.'; err.hidden = false; return; } (await upload(picked, 'media')).forEach(function (x) { previews.push(x.path); }); }
        drawSide();
        note('Uploaded. Save to keep the change.', 'ok');
      });
      form.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mk]');
        if (!b) return;
        var a = b.getAttribute('data-mk');
        if (a === 'srd-attr') { form.attribution.value = Mk().SRD_ATTRIBUTION; form.origin.value = 'srd-based'; drawSide(); }
        else if (a === 'rm-file') { files.splice(Number(b.getAttribute('data-i')), 1); drawSide(); }
        else if (a === 'rm-cover') { coverPath = null; drawSide(); }
        else if (a === 'rm-prev') { previews.splice(Number(b.getAttribute('data-i')), 1); drawSide(); }
      });
      var act = 'save';
      form.querySelectorAll('[data-act]').forEach(function (b) { b.addEventListener('click', function () { act = b.getAttribute('data-act'); }); });
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        err.hidden = true;
        var c = current();
        if (c.title.length < 3) { err.textContent = 'Give it a title (at least 3 characters).'; err.hidden = false; return; }
        if (form.pricing.value === 'paid' && !(acc && acc.isVerifiedCreator)) { err.textContent = 'Paid listings require a verified Creator account. Apply at the Become a Creator page, or set this listing to Free.'; err.hidden = false; return; }
        if (form.pricing.value === 'paid' && !(c.priceCents >= 199 && c.priceCents <= 1999)) { err.textContent = 'Set a price between $1.99 and $19.99, or make it free.'; err.hidden = false; return; }
        if (c.levelMin && c.levelMax && c.levelMin > c.levelMax) { err.textContent = 'The lowest level can\'t be higher than the highest.'; err.hidden = false; return; }
        try {
          var snap = await snapshot(form.source.value);
          if (snap) { c.content = snap.content; c.contentKind = snap.kind; } else if (form.source.value === 'none') c.content = null;
        } catch (x) { err.textContent = 'Could not copy that content: ' + x.message; err.hidden = false; return; }
        var res = l ? await Mk().save(l.id, c) : await Mk().create(c);
        if (!alive) return;
        if (!res.ok) { err.textContent = res.message; err.hidden = false; return; }
        if (act === 'submit') {
          var s = await Mk().submit(res.listing.id);
          if (!s.ok) { err.textContent = 'Saved, but not submitted: ' + s.message; err.hidden = false; if (!l) nav('#marketplace/edit/' + res.listing.id); return; }
          nav('#marketplace/creator');
          note(submittedText(), 'ok');
          return;
        }
        if (!l) { nav('#marketplace/edit/' + res.listing.id); return; }
        l = res.listing;
        note(l.status === 'pending_review' ? 'Saved and sent to review.' : 'Saved.', 'ok');
      });
      drawSide();
    }

    function submittedText() {
      var m = acc && acc.reviewMode;
      return m === 'ai_auto' ? 'Submitted. An automatic review checks it first; most listings are published within a minute, others go to a moderator. You\'ll get a notification either way.'
        : m === 'ai_assist' ? 'Submitted for review. An automatic check runs first, then a moderator decides. You\'ll get a notification.'
          : 'Submitted for review. You\'ll get a notification when a moderator decides.';
    }

    // ---------------------------------------------------------------------------------------------------- Moderation
    async function moderation() {
      if (!acc || !acc.moderator) return failed('Only marketplace moderators can open the review queue.');
      loading('Loading the review queue…');
      var r = await Mk().queue();
      if (!alive) return;
      if (!r.ok) return failed(r.message, true);
      var reps = {};
      r.reports.forEach(function (x) { (reps[x.listing_id] = reps[x.listing_id] || []).push(x); });
      shell('<p class="mk-fine">Approve only content the creator may share: no copied book text or official art, SRD-based content with its attribution, nothing harmful. Rejecting needs a short reason; the creator is told.</p>' +
        (r.listings.length ? '<ul class="mk-mylist">' + r.listings.map(function (l) {
          return '<li class="mk-myrow"><span class="mk-status is-pending_review">Pending</span><div class="mk-myrow-main"><strong>' + esc(l.title) + '</strong><span class="mk-muted">' + esc(kindLabel(l.kind)) + ' · ' + price(l.priceCents) + ' · by ' + esc(l.creatorName) + ' · ' + esc(Mk().ORIGINS[l.origin]) + ' · ' + esc(Mk().LICENSES[l.license]) + ' · submitted ' + esc(when(l.submittedAt)) + '</span>' +
            (r.reviews && r.reviews[l.id] ? '<span class="mk-ai-tag is-' + esc(r.reviews[l.id].decision) + '">' + esc(DECISION[r.reviews[l.id].decision] || '') + ' · ' + esc(RISK[r.reviews[l.id].risk] || '') + '</span>' : '') +
            (reps[l.id] ? '<span class="mk-modnote">' + reps[l.id].length + ' report(s): ' + reps[l.id].map(function (x) { return esc(Mk().REPORT_REASONS[x.reason]) + (x.details ? ' — ' + esc(x.details) : ''); }).join('; ') + '</span>' : '') + '</div>' +
            '<div class="mk-myrow-tools"><a class="btn btn-secondary btn-sm" href="#marketplace/listing/' + esc(l.id) + '" data-mk-nav="#marketplace/listing/' + esc(l.id) + '">Review</a></div></li>';
        }).join('') + '</ul>' : '<div class="mk-empty"><p><strong>Nothing waiting for review.</strong></p></div>'), { sub: 'Listings waiting for review, and reports.' });
    }

    // ---------------------------------------------------------------------------------------------------- Library
    async function library() {
      loading('Loading your library…');
      var r = await Mk().library();
      if (!alive) return;
      if (!r.ok) return failed(r.message, true);
      shell(r.items.length ? '<ul class="mk-mylist">' + r.items.map(function (x) {
        var l = x.listing;
        if (!l) return '';
        return '<li class="mk-myrow"><span class="mk-status is-published">' + (x.source === 'purchase' ? 'Bought' : x.source === 'own' ? 'Yours' : 'Free') + '</span><div class="mk-myrow-main"><strong>' + esc(l.title) + '</strong><span class="mk-muted">' + esc(kindLabel(l.kind)) + ' · by ' + esc(l.creatorName) + ' · added ' + esc(when(x.acquiredAt)) + (l.status === 'removed' ? ' · no longer listed (you keep it)' : '') + '</span>' +
          (l.files.length ? '<span class="mk-dl">' + l.files.map(function (f) { return '<button type="button" class="mk-link" data-mk="download" data-path="' + esc(f.path) + '" data-name="' + esc(f.name) + '">⬇ ' + esc(f.name) + '</button>'; }).join(' ') + '</span>' : '') + '</div>' +
          '<div class="mk-myrow-tools">' + (l.contentKind ? '<button type="button" class="btn btn-primary btn-sm" data-mk="import" data-id="' + esc(l.id) + '" data-title="' + esc(l.title) + '">Add to my ' + (l.contentKind === 'adventure' ? 'Adventures' : 'Homebrew') + '</button>' : '') +
          '<a class="btn btn-secondary btn-sm" href="#marketplace/listing/' + esc(l.id) + '" data-mk-nav="#marketplace/listing/' + esc(l.id) + '">Listing</a></div></li>';
      }).join('') + '</ul>' : '<div class="mk-empty"><p><strong>Your library is empty.</strong></p><p>Free and bought community content appears here, ready to download or add to your Adventures and Homebrew.</p><a class="btn btn-secondary btn-sm" href="#marketplace/community" data-mk-nav="#marketplace/community">Browse the community</a></div>', { sub: 'Everything you got from the Community Marketplace.' });
    }

    // ---------------------------------------------------------------------------------------------------- Cart
    function itemThumb(it) {
      return '<span class="mk-thumb">' + (it.type === 'store' && it.photo && Mk().assetUrl(it.photo) ? '<img src="' + esc(Mk().assetUrl(it.photo)) + '" alt="">' : it.type === 'store' && it.art ? global.FogStoreArt.svg(it.art) : it.cover ? '<img data-mk-img="' + esc(it.cover) + '" alt="">' : '<span class="mk-ph"><span>' + esc(it.kindLabel || (it.type === 'plan' ? 'Plan' : it.type === 'campaign_book' ? 'Book' : 'Digital')) + '</span></span>') + '</span>';
    }
    function cart() {
      var items = Cart().items();
      shell(items.length ? '<div class="mk-cart"><ul class="mk-cart-list">' + items.map(function (it) {
        var k = Cart().keyOf(it);
        var opts = Object.keys(it.options || {}).map(function (o) { return o + ': ' + it.options[o]; }).join(', ');
        return '<li class="mk-cart-row">' + itemThumb(it) + '<div class="mk-cart-main"><strong>' + esc(it.title) + '</strong><span class="mk-muted">' + esc(it.kindLabel || '') + (opts ? ' · ' + esc(opts) : '') + (it.type === 'store' ? ' · physical (demo, not shipped)' : ' · digital') + '</span></div>' +
          (it.type === 'store' ? '<label class="mk-qty"><span class="mk-vh">Quantity of ' + esc(it.title) + '</span><button type="button" class="mk-qbtn" data-mk="qty" data-k="' + esc(k) + '" data-d="-1" aria-label="One less"' + (it.quantity <= 1 ? ' disabled' : '') + '>−</button><input type="number" min="1" max="10" value="' + it.quantity + '" data-qty="' + esc(k) + '"><button type="button" class="mk-qbtn" data-mk="qty" data-k="' + esc(k) + '" data-d="1" aria-label="One more"' + (it.quantity >= 10 ? ' disabled' : '') + '>+</button></label>' : '<span class="mk-qty-fixed">1</span>') +
          '<strong class="mk-line">' + money(it.unitCents * it.quantity) + '</strong><button type="button" class="mk-link" data-mk="rm-cart" data-k="' + esc(k) + '">Remove</button></li>';
      }).join('') + '</ul><aside class="mk-sum"><h3>Summary</h3><p class="mk-sum-row"><span>Subtotal</span><strong>' + money(Cart().subtotal(items)) + '</strong></p><p class="mk-fine">Prices are confirmed by the server at checkout.</p>' +
        '<a class="btn btn-primary mk-wide" href="#marketplace/checkout" data-mk-nav="#marketplace/checkout">Proceed to checkout</a><a class="btn btn-secondary mk-wide" href="#marketplace/store" data-mk-nav="#marketplace/store">Continue shopping</a></aside></div>'
        : '<div class="mk-empty mk-empty-lg"><p><strong>Your cart is empty.</strong></p><p>Add something from the Official Store or the Community Marketplace.</p><div class="mk-actions"><a class="btn btn-primary btn-sm" href="#marketplace/store" data-mk-nav="#marketplace/store">Official Store</a><a class="btn btn-secondary btn-sm" href="#marketplace/community" data-mk-nav="#marketplace/community">Community</a></div></div>', { sub: 'Your cart is saved on this device while you browse.' });
      hydrate();
    }

    // ---------------------------------------------------------------------------------------------------- Checkout
    var pendingOrder = null;
    async function checkout() {
      var buyNow = Cart().peekBuyNow();
      var items = buyNow || Cart().items();
      if (!items.length) return cart();
      var a = global.FogAccount.getAccount() || { profile: {} };
      var physical = items.some(function (i) { return i.type === 'store'; });
      shell('<a class="btn-back mk-back" href="#marketplace/cart" data-mk-nav="#marketplace/cart">← ' + (buyNow ? 'Back' : 'Cart') + '</a>' +
        '<form class="mk-checkout" id="mk-co" novalidate autocomplete="off"><div class="mk-co-main">' +
        '<section class="mk-co-sec"><h2>Your details</h2><div class="mk-row"><label class="mk-field"><span>Full name</span><input class="form-control-dark" name="name" required maxlength="80" value="' + esc(a.profile.displayName || '') + '"></label><label class="mk-field"><span>Email</span><input class="form-control-dark" type="email" name="email" required maxlength="120" value="' + esc(a.profile.email || '') + '"></label></div>' +
        '<h3>Billing address</h3><div class="mk-row"><label class="mk-field"><span>Country</span><input class="form-control-dark" name="country" maxlength="60" required></label><label class="mk-field"><span>City</span><input class="form-control-dark" name="city" maxlength="60"' + (physical ? ' required' : '') + '></label></div>' +
        '<div class="mk-row"><label class="mk-field"><span>Address' + (physical ? ' (also used for delivery)' : '') + '</span><input class="form-control-dark" name="address" maxlength="160"' + (physical ? ' required' : '') + '></label><label class="mk-field mk-field-sm"><span>Postal code</span><input class="form-control-dark" name="postal" maxlength="20"></label></div>' +
        (physical ? '<p class="mk-fine">Demo store: physical items are not printed or shipped.</p>' : '') + '</section>' +
        '<section class="mk-co-sec mk-demo-pay" aria-labelledby="mk-pay-h"><h2 id="mk-pay-h">Payment <span class="mk-demo-tag">DEMO — NO REAL PAYMENT</span></h2>' +
        '<p>This is a simulated payment. <strong>Never enter a real card.</strong> Only the two test cards below are accepted, and the card number never leaves this page: the server is told only "success" or "declined".</p>' +
        '<div class="mk-testcards"><button type="button" class="mk-testcard" data-mk="testcard" data-n="4242 4242 4242 4242"><strong>Test card — payment succeeds</strong><span>4242 4242 4242 4242</span></button>' +
        '<button type="button" class="mk-testcard is-decline" data-mk="testcard" data-n="4000 0000 0000 0002"><strong>Test card — payment is declined</strong><span>4000 0000 0000 0002</span></button></div>' +
        '<div class="mk-row"><label class="mk-field"><span>Card number (test cards only)</span><input class="form-control-dark" name="cardNumber" inputmode="numeric" maxlength="19" placeholder="Choose a test card above" autocomplete="off"></label></div>' +
        '<div class="mk-row"><label class="mk-field mk-field-sm"><span>Expiry</span><input class="form-control-dark" name="exp" placeholder="12/30" maxlength="5" autocomplete="off"></label><label class="mk-field mk-field-sm"><span>CVC</span><input class="form-control-dark" name="cvc" placeholder="123" maxlength="4" autocomplete="off"></label></div></section></div>' +
        '<aside class="mk-sum"><h3>Order summary</h3><ul class="mk-sum-items">' + items.map(function (it) { return '<li>' + itemThumb(it) + '<span><strong>' + esc(it.title) + '</strong><span class="mk-muted">' + (it.quantity > 1 ? it.quantity + ' × ' + money(it.unitCents) : esc(it.kindLabel || '')) + '</span></span><strong>' + money(it.unitCents * it.quantity) + '</strong></li>'; }).join('') + '</ul>' +
        '<p class="mk-sum-row"><span>Subtotal</span><strong id="mk-sub">' + money(Cart().subtotal(items)) + '</strong></p><p class="mk-sum-row"><span>Shipping</span><strong>' + (physical ? '$0.00 (demo)' : '—') + '</strong></p><p class="mk-sum-row mk-total"><span>Total</span><strong id="mk-total">' + money(Cart().subtotal(items)) + '</strong></p>' +
        '<p class="mk-form-error" role="alert" hidden></p><button type="submit" class="btn btn-primary mk-wide" id="mk-pay">Pay ' + money(Cart().subtotal(items)) + ' (demo)</button>' +
        (acc && !acc.demoPayments ? '<p class="mk-fine mk-warn">Demo payments are switched off on the server, so checkout can\'t complete. (Owner: <code>update public.app_flags set enabled = true where key = \'demo_payments\';</code>)</p>' : '') +
        '<p class="mk-fine">No money moves and nothing is charged.</p></aside></form>', { sub: 'Check your order and complete the demo payment.' });
      hydrate();
      var form = root.querySelector('#mk-co');
      var err = form.querySelector('.mk-form-error');
      form.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mk="testcard"]');
        if (!b) return;
        form.cardNumber.value = b.getAttribute('data-n'); form.exp.value = '12/30'; form.cvc.value = '123';
      });
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        err.hidden = true;
        var digits = form.cardNumber.value.replace(/\D/g, '');
        var outcome = TEST_CARDS[digits];
        if (!form.name.value.trim() || !/^\S+@\S+\.\S+$/.test(form.email.value.trim()) || !form.country.value.trim() || (physical && (!form.city.value.trim() || !form.address.value.trim()))) { err.textContent = 'Fill in your name, a valid email and the billing address' + (physical ? ' (with city and street address)' : '') + '.'; err.hidden = false; return; }
        if (!outcome) { err.textContent = digits.length ? 'Only the demo test cards work here. Don\'t enter a real card.' : 'Choose one of the test cards.'; err.hidden = false; form.cardNumber.value = ''; return; }
        if (!/^\d{2}\/\d{2}$/.test(form.exp.value) || !/^\d{3,4}$/.test(form.cvc.value)) { err.textContent = 'Enter an expiry (MM/YY) and CVC (any test values).'; err.hidden = false; return; }
        var btn = root.querySelector('#mk-pay');
        btn.disabled = true; btn.textContent = 'Processing (demo)…';
        // Only customer details go to the server; the card fields are cleared and never sent.
        var customer = { name: form.name.value.trim(), email: form.email.value.trim(), country: form.country.value.trim(), city: form.city.value.trim(), address: form.address.value.trim(), postal: form.postal.value.trim() };
        form.cardNumber.value = ''; form.cvc.value = '';
        if (!pendingOrder) {
          var o = await Mk().createOrder(items, customer);
          if (!alive) return;
          if (!o.ok) { btn.disabled = false; btn.textContent = 'Pay (demo)'; err.textContent = o.message; err.hidden = false; return; }
          pendingOrder = o.order;
          root.querySelector('#mk-total').textContent = money(o.order.total);
          root.querySelector('#mk-sub').textContent = money(o.order.total);
        }
        var p = await Mk().payDemo(pendingOrder.id, outcome);
        if (!alive) return;
        btn.disabled = false; btn.textContent = 'Pay ' + money(pendingOrder.total) + ' (demo)';
        if (!p.ok) { err.textContent = p.message; err.hidden = false; return; }
        if (p.data.status === 'declined') { err.textContent = 'Payment declined (simulated). Your cart is unchanged: choose the other test card to try again.'; err.hidden = false; return; }
        if (buyNow) Cart().clearBuyNow(); else Cart().clear(items.map(Cart().keyOf));
        if (global.FogAccount.refreshPlan) global.FogAccount.refreshPlan();
        nav('#marketplace/order/' + pendingOrder.id);
      });
    }

    // ---------------------------------------------------------------------------------------------------- Orders
    function orderItemsHtml(o) {
      return '<ul class="mk-sum-items">' + o.items.map(function (it) {
        var link = it.type === 'listing' ? '<a href="#marketplace/library" data-mk-nav="#marketplace/library">In your library</a>' : it.type === 'plan' ? 'Your plan was updated' : it.type === 'campaign_book' ? '<a href="campaign.html?c=' + esc(it.ref) + '#logbook/book">Open the book</a>' : o.provider === 'demo' ? 'Not shipped (demo store)' : '';
        return '<li><span><strong>' + esc(it.title) + '</strong><span class="mk-muted">' + (it.quantity > 1 ? it.quantity + ' × ' + money(it.unitCents) + ' · ' : '') + (o.status === 'paid' ? link : '') + '</span></span><strong>' + money(it.unitCents * it.quantity) + '</strong></li>';
      }).join('') + '</ul>';
    }
    async function orderPage() {
      loading('Loading the order…');
      var r = await Mk().order(id);
      if (!alive) return;
      if (!r.ok) return failed(r.message);
      var o = r.order;
      shell('<section class="mk-confirm' + (o.status === 'paid' ? ' is-ok' : '') + '"><p class="mk-kind">' + (o.provider === 'demo' ? 'Demo payment — no money moved' : 'Order') + '</p><h2>' + (o.status === 'paid' ? 'Thank you! Your order is complete.' : o.status === 'declined' ? 'Payment declined' : 'Order ' + esc(o.status)) + '</h2>' +
        '<p>Order reference <strong class="mk-ref">' + esc(o.reference) + '</strong> · ' + esc(when(o.createdAt)) + '</p>' + orderItemsHtml(o) +
        '<p class="mk-sum-row mk-total"><span>Total</span><strong>' + money(o.totalCents) + '</strong></p>' +
        (o.hasPhysical ? '<p class="mk-fine">Physical items from the demo store are not printed or shipped.</p>' : '') +
        '<div class="mk-actions"><a class="btn btn-primary btn-sm" href="#marketplace/library" data-mk-nav="#marketplace/library">My library</a><a class="btn btn-secondary btn-sm" href="#marketplace/orders" data-mk-nav="#marketplace/orders">Order history</a><a class="btn btn-secondary btn-sm" href="#marketplace/store" data-mk-nav="#marketplace/store">Continue shopping</a></div></section>', { sub: 'Order confirmation.' });
      if (o.status === 'paid') {
        var listingItems = o.items.filter(function (it) { return it.type === 'listing'; });
        listingItems.forEach(function (it) {
          Mk().importContent(it.ref, it.title).then(function (res) {
            if (res.ok) note('Auto-added "' + it.title + '" to your ' + res.label + '.', 'ok');
          });
        });
      }
    }
    async function orders() {
      loading('Loading your orders…');
      var r = await Mk().orders();
      if (!alive) return;
      if (!r.ok) return failed(r.message, true);
      shell(r.orders.length ? '<ul class="mk-mylist">' + r.orders.map(function (o) {
        return '<li class="mk-myrow"><span class="mk-status is-' + (o.status === 'paid' ? 'published' : o.status === 'declined' ? 'rejected' : 'draft') + '">' + esc(o.status.charAt(0).toUpperCase() + o.status.slice(1)) + '</span><div class="mk-myrow-main"><strong>' + esc(o.reference) + '</strong><span class="mk-muted">' + esc(when(o.createdAt)) + ' · ' + o.items.length + ' item' + (o.items.length === 1 ? '' : 's') + ' · ' + money(o.totalCents) + (o.provider === 'demo' ? ' · demo payment' : '') + '</span></div>' +
          '<div class="mk-myrow-tools"><a class="btn btn-secondary btn-sm" href="#marketplace/order/' + esc(o.id) + '" data-mk-nav="#marketplace/order/' + esc(o.id) + '">Details</a></div></li>';
      }).join('') + '</ul>' : '<div class="mk-empty"><p><strong>No orders yet.</strong></p></div>', { sub: 'Your order history.' });
    }

    // ---------------------------------------------------------------------------------------------------- Events
    async function onClick(e) {
      var go = e.target.closest('[data-mk-nav]');
      if (go && root.contains(go)) { e.preventDefault(); nav(go.getAttribute('data-mk-nav')); return; }
      var cat = e.target.closest('[data-mk-cat]');
      if (cat) { storeFilter.cat = cat.getAttribute('data-mk-cat'); root.querySelectorAll('[data-mk-cat]').forEach(function (b) { b.classList.toggle('is-on', b === cat); }); drawStoreGrid(); return; }
      var b = e.target.closest('[data-mk]');
      if (!b || !root.contains(b) || b.closest('#mk-ed')) return;
      var a = b.getAttribute('data-mk');
      var l = root.__listing;
      var res;
      if (a === 'retry') render();
      else if (a === 'product') openProduct(b.getAttribute('data-sku'));
      else if (a === 'add-store' || a === 'buy-store') {
        var p = products.filter(function (x) { return x.sku === b.getAttribute('data-sku'); })[0];
        var d = p.details || {};
        var opts = d.sizes ? { size: d.sizes[Math.min(1, d.sizes.length - 1)] } : d.options ? { style: d.options[0] } : {};
        if (a === 'buy-store') { Cart().buyNow(productItem(p, { options: opts })); nav('#marketplace/checkout'); return; }
        res = Cart().add(productItem(p, { options: opts }));
        note(res.ok ? '"' + p.name + '" added to your cart' + (opts.size ? ' (size ' + opts.size + '; change it in the product details)' : '') + '.' : res.message, res.ok ? 'ok' : 'error');
        refreshShellBadge();
      }
      else if (a === 'add-listing') { res = Cart().add(listingItem(l)); b.disabled = true; b.textContent = 'In your cart'; note('Added to your cart.', 'ok'); refreshShellBadge(); }
      else if (a === 'buy-listing') { Cart().buyNow(listingItem(l)); nav('#marketplace/checkout'); }
      else if (a === 'claim') {
        res = await Mk().claimFree(l.id);
        if (!res.ok) { note(res.message, 'error'); }
        else {
          var imp = await Mk().importContent(l.id, l.title);
          note(imp.ok ? 'Added to your library and your ' + imp.label + '.' : 'Added to your library.', 'ok');
          render();
        }
      }
      else if (a === 'zoom') { var img = b.querySelector('img'); if (img && img.src) modal('<img class="mk-zoom" src="' + esc(img.src) + '" alt="Preview">', 'Preview'); }
      else if (a === 'report') {
        var dlg = modal('<form class="mk-report"><h2>Report this listing</h2><label class="mk-field"><span>Reason</span><select class="form-control-dark" name="reason">' + Object.keys(Mk().REPORT_REASONS).map(function (k) { return '<option value="' + k + '">' + esc(Mk().REPORT_REASONS[k]) + '</option>'; }).join('') + '</select></label>' +
          '<label class="mk-field"><span>Details (optional)</span><textarea class="form-control-dark" name="details" rows="3" maxlength="1000"></textarea></label><p class="mk-form-error" role="alert" hidden></p><div class="mk-actions"><button type="button" class="btn btn-secondary btn-sm" data-close>Cancel</button><button type="submit" class="btn btn-primary btn-sm">Send report</button></div></form>', 'Report');
        dlg.querySelector('form').addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var f = ev.target;
          var rr = await Mk().report(l.id, f.reason.value, f.details.value);
          if (!rr.ok) { var er = f.querySelector('.mk-form-error'); er.textContent = rr.message; er.hidden = false; return; }
          dlg.close(); note('Thanks. A moderator will look at it.', 'ok');
        });
      }
      else if (a === 'ai-again') { if (root.__listing) loadAiReview(root.__listing, true); }
      else if (a === 'ai-use-note') {
        var t = root.querySelector('#mk-mod-note');
        if (t) { t.value = b.getAttribute('data-note') || ''; t.focus(); }
      }
      else if (a === 'mod') {
        var decision = b.getAttribute('data-decision');
        var noteText = (root.querySelector('#mk-mod-note') || {}).value || '';
        if (decision === 'remove' && !global.confirm('Remove this listing? Buyers keep what they have.')) return;
        res = await Mk().moderate(b.getAttribute('data-id'), decision, noteText);
        if (!res.ok) return note(res.message, 'error');
        note(decision === 'approve' ? 'Published.' : decision === 'reject' ? 'Sent back to the creator.' : 'Removed.', 'ok');
        render();
      }
      else if (a === 'cfilter') { root.__creatorFilter = b.getAttribute('data-f'); creator(); }
      else if (a === 'submit' || a === 'withdraw' || a === 'remove' || a === 'delete') {
        var lid = b.getAttribute('data-id');
        if (a === 'remove' && !global.confirm('Remove this listing from the marketplace? People who already have it keep it. This can\'t be undone.')) return;
        if (a === 'delete' && !global.confirm('Delete this listing for good?')) return;
        res = a === 'submit' ? await Mk().submit(lid) : a === 'withdraw' ? await Mk().withdraw(lid) : a === 'remove' ? await Mk().remove(lid, '') : await Mk().deleteDraft(lid);
        if (!res.ok) return note(res.message, 'error');
        note(a === 'submit' ? submittedText() : a === 'withdraw' ? 'Back to draft.' : a === 'remove' ? 'Removed.' : 'Deleted.', 'ok');
        creator();
      }
      else if (a === 'download') {
        var u = await Mk().urls([b.getAttribute('data-path')]);
        var url = u[b.getAttribute('data-path')];
        if (!url) return note('The file could not be opened.', 'error');
        var link = document.createElement('a'); link.href = url; link.download = b.getAttribute('data-name'); link.target = '_blank'; link.rel = 'noopener'; document.body.appendChild(link); link.click(); link.remove();
      }
      else if (a === 'import') {
        b.disabled = true;
        res = await Mk().importContent(b.getAttribute('data-id'), b.getAttribute('data-title'));
        b.disabled = false;
        if (!res.ok) return note(res.message, 'error');
        note('Added to your ' + res.label + '.', 'ok');
        if (global.confirm('Added to your ' + res.label + '. Open it now?')) nav(res.where);
      }
      else if (a === 'rm-cart') { Cart().remove(b.getAttribute('data-k')); cart(); }
      else if (a === 'qty') { var k = b.getAttribute('data-k'); var cur = Cart().items().filter(function (x) { return Cart().keyOf(x) === k; })[0]; if (cur) Cart().setQuantity(k, cur.quantity + Number(b.getAttribute('data-d'))); cart(); }
      else if (a === 'cf-clear') { cf = { q: '', kind: '', paid: '', min: '', max: '', level: '', edition: '', genre: '', creator: '', sort: 'new' }; root.querySelectorAll('[data-cf]').forEach(function (x) { x.value = x.getAttribute('data-cf') === 'sort' ? 'new' : ''; }); drawCommunityGrid(); }
    }
    function onInput(e) {
      var t = e.target;
      if (t.id === 'mk-store-q') { storeFilter.q = t.value; drawStoreGrid(); }
      else if (t.hasAttribute && t.hasAttribute('data-cf')) { cf[t.getAttribute('data-cf')] = t.value; drawCommunityGrid(); }
    }
    function onChange(e) {
      var t = e.target;
      if (t.hasAttribute && t.hasAttribute('data-qty')) { Cart().setQuantity(t.getAttribute('data-qty'), t.value); cart(); }
    }
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);

    async function render() {
      var r = await Mk().access(true);
      if (!alive) return;
      acc = r.ok ? r.access : null;
      if (!r.ok && r.notSetUp) return failed(r.message);
      if (view === 'store' || view === 'item') return store();
      if (view === 'community') return community();
      if (view === 'listing' && id) return listingPage();
      if (view === 'creator') return creator();
      if (view === 'new' || (view === 'edit' && id)) return editor();
      if (view === 'moderation') return moderation();
      if (view === 'library') return library();
      if (view === 'cart') return cart();
      if (view === 'checkout') return checkout();
      if (view === 'order' && id) return orderPage();
      if (view === 'orders') return orders();
      return failed('That part of the Marketplace doesn\'t exist.');
    }
    render();

    return function cleanup() {
      alive = false;
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.removeEventListener('change', onChange);
      cleanups.forEach(function (f) { f(); });
      root.querySelectorAll('dialog').forEach(function (d) { d.remove(); });
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.marketplace = init;
})(window);
