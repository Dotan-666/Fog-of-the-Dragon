/**
 * Adventure reader (#adventures/<id>/read): the adventure laid out as pages of an illuminated book on parchment.
 *
 * Page 1 is the title page (cover, pitch, details, contents); every chapter is a page after it. Turn pages with the
 * arrows, the arrow keys or the contents. Two ways to read:
 *   DM view      everything, with private notes in sealed boxes;
 *   Player view  only what the players may see: "For the players" text and images marked as handouts — for showing
 *                on a second screen or in full screen at the table.
 * Print renders every page (or save as PDF from the print dialog). Text is plain text; nothing is read as HTML.
 *
 * The Campaign workspace shows this same reader (Adventures → Reading mode). It passes params.adventure to show a
 * given adventure instead of loading one by id; with params.playersOnly the reader stays in Player view and hides the
 * DM/Player switch (players never get the adventure itself, only what the DM shared, so there is nothing else to show).
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogAdventureModel; };
  var Store = function () { return global.FogAdventureStore; };
  var SIZE_KEY = 'fog_reader_size';
  var MODE_KEY = 'fog_reader_mode';
  var SIZES = [0.9, 1, 1.1, 1.2, 1.35];
  var KIND_GLYPH = { scene: '✦', location: '⌂', npc: '☙', encounter: '⚔', object: '◆', hook: '⚑', clue: '✠', reward: '✪', note: '✎' };
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  /** Plain text → paragraphs (blank line = new paragraph, single line break kept). */
  function paras(text, cls) {
    return String(text || '').trim().split(/\n{2,}/).filter(function (p) { return p.trim(); }).map(function (p) {
      return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(p.trim()).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function roman(n) {
    if (n <= 10) return ROMAN[n];
    var map = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var out = '';
    map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
    return out;
  }
  function pref(key, val) {
    try {
      if (val === undefined) return global.localStorage.getItem(key);
      global.localStorage.setItem(key, val);
    } catch (e) { /* preference only */ }
    return null;
  }
  var DIVIDER = '<div class="rd-divider" aria-hidden="true"><svg viewBox="0 0 240 18" preserveAspectRatio="none"><path d="M0 9 H100" /><path d="M140 9 H240" /><path class="rd-divider-gem" d="M120 1 L128 9 L120 17 L112 9 Z" /><circle cx="104" cy="9" r="2.2" /><circle cx="136" cy="9" r="2.2" /></svg></div>';

  function init(container, params) {
    var root = container.querySelector('#adventure-reader-root');
    var $ = function (s) { return root.querySelector(s); };
    var id = params && params.id;
    var injected = params && params.adventure ? params.adventure : null;
    var playersOnly = !!(params && params.playersOnly);
    var onStartCombat = params && params.onStartCombat || null;
    var PAGE_KEY = 'fog_reader_page_' + id;
    var doc = null;
    var alive = true;
    var page = 0;
    var mode = playersOnly || pref(MODE_KEY) === 'players' ? 'players' : 'dm';
    var size = SIZES.indexOf(Number(pref(SIZE_KEY))) >= 0 ? Number(pref(SIZE_KEY)) : 1;
    var dm = function () { return mode === 'dm'; };

    // -------------------------------------------------------------------------
    // What each view shows
    // -------------------------------------------------------------------------
    function visibleImages(list) {
      return (list || []).filter(function (im) { return dm() || im.handout; });
    }
    var printing = false; // while building the print copy: leave out assets not marked "In the book"
    // Assets (content.assets) appear where they are placed; players see only those marked "Players may see it".
    function assetVisible(x) { return (dm() || x.playerVisible) && (!printing || x.printable !== false); }
    function assetsAt(chapterId, sectionId) {
      return (doc.content.assets || []).filter(function (x) { return x.link && x.link.chapterId === chapterId && (x.link.sectionId || null) === (sectionId || null) && assetVisible(x); });
    }
    function appendixAssets() {
      if (printing && doc.content.book && doc.content.book.appendix === false) return [];
      var ids = {};
      doc.content.chapters.forEach(function (c) { ids[c.id] = c; });
      return (doc.content.assets || []).filter(function (x) {
        var placed = x.link && ids[x.link.chapterId] && (!x.link.sectionId || ids[x.link.chapterId].sections.some(function (sec) { return sec.id === x.link.sectionId; }));
        return !placed && assetVisible(x);
      });
    }
    function sectionVisible(s, ci) {
      if (dm()) return true;
      var c = doc.content.chapters[ci];
      return s.kind !== 'note' && (!!String(s.playerText || '').trim() || visibleImages(s.images).length > 0 || (c && assetsAt(c.id, s.id).length > 0));
    }
    function hasAppendix() { return appendixAssets().length > 0; }
    function pageCount() { return 1 + doc.content.chapters.length + (hasAppendix() ? 1 : 0); }

    // -------------------------------------------------------------------------
    // Building blocks
    // -------------------------------------------------------------------------
    function figure(im, cls) {
      return '<figure class="rd-figure ' + (cls || '') + '"><div class="rd-plate"><img data-img-path="' + esc(im.path) + '" alt="' + esc(im.caption || 'Illustration') + '"><span class="rd-plate-wait" aria-hidden="true"></span></div>' +
        (im.caption || (dm() && im.handout) ? '<figcaption>' + esc(im.caption) + (dm() && im.handout ? ' <span class="rd-handout-tag">Handout</span>' : '') + '</figcaption>' : '') + '</figure>';
    }
    function sealed(title, inner) {
      return '<aside class="rd-dm"><span class="rd-seal" aria-hidden="true">DM</span><h4 class="rd-dm-title">' + esc(title) + '</h4>' + inner + '</aside>';
    }
    // One asset, laid out for its type: maps and locations as wide plates (maps open larger), portraits, NPCs, monsters,
    // items and spells with their picture beside the text, handouts as a separate sheet.
    var WIDE = { map: 1, location: 1 };
    function assetHtml(x) {
      var T = M().ASSET_TYPES[x.type] || { label: x.type, fields: [] };
      var imgs = (x.images || []).slice(0, WIDE[x.type] ? 4 : 1);
      var pics = imgs.map(function (im) {
        var fig = '<figure class="rd-figure rd-asset-fig"><div class="rd-plate"><img data-img-path="' + esc(im.path) + '" alt="' + esc(im.caption || x.title) + '"><span class="rd-plate-wait" aria-hidden="true"></span></div>' +
          (im.caption ? '<figcaption>' + esc(im.caption) + '</figcaption>' : '') + '</figure>';
        return x.type === 'map' ? '<button type="button" class="rd-zoom" data-rd-zoom="' + esc(im.path) + '" aria-label="Open the map larger: ' + esc(im.caption || x.title) + '">' + fig + '<span class="rd-zoom-hint" aria-hidden="true">⤢ Enlarge</span></button>' : fig;
      }).join('');
      var stats = dm() ? T.fields.filter(function (f) { return x.fields && x.fields[f.key]; }).map(function (f) {
        return '<p class="rd-stat"><strong><em>' + esc(f.label) + '.</em></strong> ' + esc(x.fields[f.key]).replace(/\n/g, '<br>') + '</p>';
      }).join('') : '';
      var ref = dm() && x.ref ? '<p class="rd-asset-ref">Rules: <strong>' + esc(x.ref.name) + '</strong> (' + esc(M().REF_SOURCES[x.ref.source] || x.ref.source) + ')</p>' : '';
      var text = (String(x.summary || '').trim() ? (x.type === 'handout' ? '<div class="rd-handout-text">' + paras(x.summary) + '</div>' : paras(x.summary)) : '') +
        (stats ? '<div class="rd-stats">' + stats + '</div>' : '') + ref +
        (dm() && String(x.dmNotes || '').trim() ? sealed('For the Dungeon Master', paras(x.dmNotes)) : '');
      var tag = dm() && !x.playerVisible ? ' <span class="rd-asset-private">DM only</span>' : dm() && x.type === 'handout' ? ' <span class="rd-handout-tag">Handout</span>' : '';
      var layout = WIDE[x.type] ? 'is-wide' : x.type === 'handout' ? 'is-handout' : pics ? 'is-side' : 'is-plain';
      return '<aside class="rd-asset rd-asset-' + esc(x.type) + ' ' + layout + '" id="rd-a-' + esc(x.id) + '"><header class="rd-asset-head"><p class="rd-section-kind">' + esc(T.label) + '</p><h4 class="rd-asset-title">' + esc(x.title) + tag + '</h4></header>' +
        (layout === 'is-side' ? '<div class="rd-asset-body"><div class="rd-asset-pic">' + pics + '</div><div class="rd-asset-text">' + text + '</div></div>' : pics + '<div class="rd-asset-text">' + text + '</div>') + '</aside>';
    }
    function assetsBlock(list) { return list.length ? '<div class="rd-assets">' + list.map(assetHtml).join('') + '</div>' : ''; }

    function fieldsBlock(s) {
      var kind = M().KINDS[s.kind];
      var rows = kind.fields.filter(function (f) { return s.fields[f.key]; }).map(function (f) {
        return '<p class="rd-stat"><strong><em>' + esc(f.label) + '.</em></strong> ' + esc(s.fields[f.key]).replace(/\n/g, '<br>') + '</p>';
      }).join('');
      return rows ? '<div class="rd-stats rd-stats-' + esc(s.kind) + '">' + rows + '</div>' : '';
    }
    function sectionHtml(s, ci, si) {
      var kind = M().KINDS[s.kind];
      var imgs = visibleImages(s.images);
      var body = '';
      if (dm()) body += fieldsBlock(s);
      if (String(s.playerText || '').trim()) {
        body += '<div class="rd-readaloud">' + (dm() ? '<span class="rd-readaloud-label">Read aloud</span>' : '') + paras(s.playerText) + '</div>';
      }
      body += imgs.map(function (im) { return figure(im); }).join('');
      body += assetsBlock(assetsAt(doc.content.chapters[ci].id, s.id));
      if (dm() && String(s.dmNotes || '').trim()) body += sealed(s.kind === 'clue' ? 'The secret' : 'For the Dungeon Master', paras(s.dmNotes));
      if (dm() && s.kind === 'encounter' && onStartCombat && doc) {
        var pe = (doc.content.encounters || []).find(function (x) { return x.sectionId === s.id; });
        if (pe) body += '<div class="rd-combat-launch"><button type="button" class="btn btn-primary btn-sm" data-rd-combat="' + esc(pe.id) + '">⚔ Go to Combat</button></div>';
      }
      if (!body) body = '<p class="rd-empty">Nothing written here yet.</p>';
      return '<section class="rd-section rd-kind-' + esc(s.kind) + '" id="rd-s-' + esc(s.id) + '">' +
        '<header class="rd-section-head"><span class="rd-glyph" aria-hidden="true">' + (KIND_GLYPH[s.kind] || '✦') + '</span>' +
        '<div><p class="rd-section-kind">' + esc(kind.label) + '</p><h3 class="rd-section-title">' + esc(s.title) + '</h3></div></header>' + body + '</section>';
    }

    function titlePage() {
      var a = doc;
      var lvl = M().levelLabel(a);
      var who = lvl ? ' for ' + lvl.toLowerCase().replace(/^levels /, 'characters of levels ').replace(/^level /, 'characters of level ') : '';
      var meta = [(a.genre ? 'A ' + a.genre.toLowerCase() + ' adventure' : 'An adventure') + who, a.playtime ? 'about ' + a.playtime : ''].filter(Boolean);
      var chapters = a.content.chapters;
      return '<div class="rd-title-page">' +
        '<p class="rd-overline">' + (a.theme ? esc(a.theme) : 'Fog of the Dragon') + '</p>' +
        '<h2 class="rd-book-title">' + esc(a.title) + '</h2>' + DIVIDER +
        '<p class="rd-meta">' + esc(meta.join(' · ')) + '</p>' +
        (a.coverImage ? '<figure class="rd-figure rd-cover"><div class="rd-plate is-loaded"><img src="' + esc(a.coverImage) + '" alt="Cover of ' + esc(a.title) + '"></div></figure>' : '') +
        (a.description ? '<div class="rd-pitch">' + paras(a.description) + '</div>' : '') +
        '<section class="rd-contents"><h3 class="rd-contents-title">Contents</h3>' +
        (chapters.length ? '<ol class="rd-contents-list">' + chapters.map(function (c, i) {
          return '<li><button type="button" class="rd-contents-item" data-rd-page="' + (i + 1) + '"><span class="rd-contents-num">' + roman(i + 1) + '</span>' +
            '<span class="rd-contents-name">' + esc(c.title) + '</span><span class="rd-leader" aria-hidden="true"></span><span class="rd-contents-page">' + (i + 2) + '</span></button></li>';
        }).join('') + '</ol>' : '<p class="rd-empty">No chapters yet. Write them in the editor.</p>') + '</section>' +
        (dm() && String(a.notes || '').trim() ? sealed('General notes', paras(a.notes)) : '') +
        '</div>';
    }

    function chapterPage(ci) {
      var c = doc.content.chapters[ci];
      var sections = c.sections.filter(function (s) { return sectionVisible(s, ci); });
      var hidden = c.sections.length - sections.length;
      var chImgs = visibleImages(c.images);
      return '<div class="rd-chapter">' +
        '<header class="rd-chapter-head"><p class="rd-chapter-num">Chapter ' + roman(ci + 1) + '</p><h2 class="rd-chapter-title">' + esc(c.title) + '</h2>' + DIVIDER + '</header>' +
        (String(c.summary || '').trim() ? '<div class="rd-summary">' + paras(c.summary) + '</div>' : '') +
        (chImgs.length ? '<div class="rd-chapter-plates' + (chImgs.length === 1 ? ' is-single' : '') + '">' + chImgs.map(function (im) { return figure(im, 'rd-wide'); }).join('') + '</div>' : '') +
        assetsBlock(assetsAt(c.id, null)) +
        (dm() && String(c.dmNotes || '').trim() ? sealed('Running this chapter', paras(c.dmNotes)) : '') +
        (sections.length ? '<div class="rd-chapter-body">' + sections.map(function (s, si) { return sectionHtml(s, ci, si); }).join('') + '</div>'
          : '<p class="rd-empty">' + (c.sections.length ? 'Nothing in this chapter is for the players yet.' : 'This chapter has no sections yet.') + '</p>') +
        (!dm() && hidden ? '<p class="rd-hidden-note">' + hidden + ' part' + (hidden === 1 ? ' is' : 's are') + ' only for the Dungeon Master.</p>' : '') +
        '</div>';
    }

    function appendixPage() {
      return '<div class="rd-chapter rd-appendix"><header class="rd-chapter-head"><p class="rd-chapter-num">Appendix</p><h2 class="rd-chapter-title">' + (dm() ? 'Other assets' : 'For the players') + '</h2>' + DIVIDER + '</header>' +
        (dm() ? '<p class="rd-hidden-note">These aren\'t placed in a chapter or section yet. Choose "Used in" on each asset in the editor to show it where it belongs.</p>' : '') +
        assetsBlock(appendixAssets()) + '</div>';
    }
    function pageHtml(n) {
      return (n === 0 ? titlePage() : n <= doc.content.chapters.length ? chapterPage(n - 1) : appendixPage()) +
        '<footer class="rd-folio" aria-hidden="true"><span>❦</span> ' + (n + 1) + ' <span>❦</span></footer>';
    }

    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------
    function renderToc() {
      var items = [{ n: 0, label: 'Title page', num: '' }].concat(doc.content.chapters.map(function (c, i) { return { n: i + 1, label: c.title, num: roman(i + 1) }; }));
      if (hasAppendix()) items.push({ n: doc.content.chapters.length + 1, label: 'Appendix', num: '' });
      $('#rd-toc').innerHTML = '<h2 class="rd-toc-title">Contents</h2><ol class="rd-toc-list">' + items.map(function (it) {
        var on = it.n === page;
        var subs = '';
        if (on && it.n > 0 && it.n <= doc.content.chapters.length) {
          var secs = doc.content.chapters[it.n - 1].sections.filter(function (s) { return sectionVisible(s, it.n - 1); });
          if (secs.length) subs = '<ol class="rd-toc-sub">' + secs.map(function (s) { return '<li><a href="#rd-s-' + esc(s.id) + '" data-rd-section="' + esc(s.id) + '">' + esc(s.title) + '</a></li>'; }).join('') + '</ol>';
        }
        return '<li><button type="button" class="rd-toc-item' + (on ? ' is-current' : '') + '" data-rd-page="' + it.n + '"' + (on ? ' aria-current="page"' : '') + '>' +
          (it.num ? '<span class="rd-toc-num">' + it.num + '</span>' : '<span class="rd-toc-num">❧</span>') + '<span class="rd-toc-label">' + esc(it.label) + '</span></button>' + subs + '</li>';
      }).join('') + '</ol>';
      $('#rd-jump').innerHTML = items.map(function (it) { return '<option value="' + it.n + '"' + (it.n === page ? ' selected' : '') + '>' + (it.num ? 'Chapter ' + it.num + ': ' : '') + esc(it.label) + '</option>'; }).join('');
    }

    function renderPage(direction) {
      var el = $('#rd-page');
      el.innerHTML = pageHtml(page);
      el.classList.remove('rd-turn-next', 'rd-turn-prev');
      if (direction) {
        void el.offsetWidth; // restart the animation
        el.classList.add(direction > 0 ? 'rd-turn-next' : 'rd-turn-prev');
      }
      var n = pageCount();
      $('#rd-count').textContent = 'Page ' + (page + 1) + ' of ' + n;
      $('#rd-prev').disabled = page === 0;
      $('#rd-next').disabled = page >= n - 1;
      var label = function (k) { return k === 0 ? 'Title page' : k <= doc.content.chapters.length ? doc.content.chapters[k - 1].title : 'Appendix'; };
      $('#rd-prev-label').textContent = page === 0 ? 'Previous' : label(page - 1);
      $('#rd-next-label').textContent = page >= n - 1 ? 'The end' : label(page + 1);
      renderToc();
      hydrate(el);
      pref(PAGE_KEY, String(page));
    }

    function renderAll() {
      root.classList.toggle('is-players', !dm());
      root.style.setProperty('--rd-scale', String(size));
      root.querySelectorAll('[data-rd-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-rd-mode') === mode)); });
      banner(dm() ? '' : '<strong>Player view.</strong> Only text written "For the players", images marked as handouts and assets the DM made visible to players are shown. Private notes, fields and DM-only sections are hidden.');
      renderPage(0);
    }

    function banner(html) {
      $('#rd-banner').innerHTML = html || '';
      $('#rd-banner').hidden = !html;
    }

    async function hydrate(scope) {
      var imgs = Array.prototype.slice.call(scope.querySelectorAll('img[data-img-path]'));
      if (!imgs.length) return;
      var res = global.FogContentImages ? await global.FogContentImages.urls(imgs.map(function (i) { return i.getAttribute('data-img-path'); })) : { urls: {} };
      if (!alive) return;
      imgs.forEach(function (img) {
        var plate = img.parentNode;
        var url = res.urls && res.urls[img.getAttribute('data-img-path')];
        if (!url) { plate.classList.add('is-missing'); return; }
        img.onload = function () { plate.classList.add('is-loaded'); };
        img.onerror = function () { plate.classList.add('is-missing'); };
        img.src = url;
      });
    }

    function go(n, focus) {
      n = Math.max(0, Math.min(pageCount() - 1, n));
      if (n === page) return;
      var dir = n > page ? 1 : -1;
      page = n;
      renderPage(dir);
      var top = $('#rd-book').getBoundingClientRect().top + global.scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0) - 16;
      if (global.scrollY > top) global.scrollTo({ top: top, behavior: 'instant' });
      if (focus) $('#rd-page').focus({ preventScroll: true });
    }

    function printAll() {
      var out = '';
      printing = true;
      for (var i = 0; i < pageCount(); i++) out += '<article class="rd-page rd-print-page">' + pageHtml(i) + '</article>';
      printing = false;
      $('#rd-print').innerHTML = out;
      return hydrate($('#rd-print'));
    }
    function zoom(path) {
      var src = (root.querySelector('img[data-img-path="' + path + '"]') || {}).src;
      if (!src) return;
      var box = document.createElement('div');
      box.className = 'rd-lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Map');
      box.innerHTML = '<img alt="Map"><button type="button" class="rd-lightbox-close" aria-label="Close">✕</button>';
      box.querySelector('img').src = src;
      var close = function () { box.remove(); document.removeEventListener('keydown', escKey); };
      var escKey = function (e) { if (e.key === 'Escape') close(); };
      box.addEventListener('click', function (e) { if (e.target === box || e.target.closest('.rd-lightbox-close')) close(); });
      document.addEventListener('keydown', escKey);
      root.appendChild(box);
      box.querySelector('.rd-lightbox-close').focus();
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    function onClick(e) {
      var cb = e.target.closest('[data-rd-combat]');
      if (cb && root.contains(cb) && onStartCombat) { onStartCombat(cb.getAttribute('data-rd-combat')); return; }
      var z = e.target.closest('[data-rd-zoom]');
      if (z && root.contains(z)) { zoom(z.getAttribute('data-rd-zoom')); return; }
      var p = e.target.closest('[data-rd-page]');
      if (p && root.contains(p)) { go(Number(p.getAttribute('data-rd-page')), true); return; }
      var sec = e.target.closest('[data-rd-section]');
      if (sec && root.contains(sec)) {
        e.preventDefault();
        var target = root.querySelector('#rd-s-' + CSS.escape(sec.getAttribute('data-rd-section')));
        if (target) { target.scrollIntoView({ block: 'start', behavior: 'smooth' }); target.classList.add('is-flash'); setTimeout(function () { target.classList.remove('is-flash'); }, 1200); }
        return;
      }
      var m = e.target.closest('[data-rd-mode]');
      if (m && root.contains(m) && !playersOnly) {
        mode = m.getAttribute('data-rd-mode');
        pref(MODE_KEY, mode);
        renderAll(); // same page, now in the other view
        return;
      }
      var a = e.target.closest('[data-rd-act]');
      if (!a || !root.contains(a)) return;
      var act = a.getAttribute('data-rd-act');
      if (act === 'prev') go(page - 1, true);
      else if (act === 'next') go(page + 1, true);
      else if (act === 'smaller' || act === 'larger') {
        var i = SIZES.indexOf(size) + (act === 'larger' ? 1 : -1);
        size = SIZES[Math.max(0, Math.min(SIZES.length - 1, i))];
        pref(SIZE_KEY, String(size));
        root.style.setProperty('--rd-scale', String(size));
      } else if (act === 'fullscreen') {
        var book = $('#rd-book');
        if (document.fullscreenElement) document.exitFullscreen();
        else if (book.requestFullscreen) book.requestFullscreen().catch(function () { /* not allowed here */ });
      } else if (act === 'print') {
        printAll().then(function () { global.print(); });
      }
    }
    function onKey(e) {
      if (!doc || e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(page + 1, true); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(page - 1, true); }
      else if (e.key === 'Home') { e.preventDefault(); go(0, true); }
      else if (e.key === 'End') { e.preventDefault(); go(pageCount() - 1, true); }
    }
    function onJump(e) {
      if (e.target.id === 'rd-jump') go(Number(e.target.value), false);
    }
    function onBeforePrint() { if (doc && !$('#rd-print').innerHTML) printAll(); }
    function onAfterPrint() { $('#rd-print').innerHTML = ''; }

    async function load() {
      var res = injected ? { ok: true, adventure: injected } : await Store().get(id);
      if (!alive) return;
      if (!res.ok) {
        $('#rd-title').textContent = res.notFound ? 'Adventure not found' : 'Adventure';
        banner(esc(res.message) + ' <a href="#adventures" data-fog-nav="#adventures">Back to Adventures</a>');
        return;
      }
      doc = res.adventure;
      $('#rd-title').textContent = doc.title;
      $('#rd-back').textContent = '← Back to the editor';
      $('#rd-back').setAttribute('href', '#adventures/' + encodeURIComponent(doc.id));
      if (playersOnly) {
        $('#rd-back').hidden = true;
        var sw = root.querySelector('.rd-mode');
        if (sw) sw.hidden = true;
        $('.rd-kicker').textContent = 'Shared with the party';
      }
      $('#rd-tools').hidden = false;
      $('#rd-stage').hidden = false;
      var saved = Number(pref(PAGE_KEY)); // read before the first render stores page 1
      page = saved > 0 && saved < pageCount() ? saved : 0;
      renderAll();
    }

    root.addEventListener('click', onClick);
    root.addEventListener('change', onJump);
    document.addEventListener('keydown', onKey);
    global.addEventListener('beforeprint', onBeforePrint);
    global.addEventListener('afterprint', onAfterPrint);
    // The back link points to the editor once the adventure is loaded.
    $('#rd-back').addEventListener('click', function (e) {
      e.preventDefault();
      global.FogDashboardRouter.navigateTo($('#rd-back').getAttribute('href'));
    });
    load();

    return function cleanup() {
      alive = false;
      document.removeEventListener('keydown', onKey);
      global.removeEventListener('beforeprint', onBeforePrint);
      global.removeEventListener('afterprint', onAfterPrint);
      if (document.fullscreenElement && root.contains(document.fullscreenElement)) document.exitFullscreen();
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.adventureReader = init;
})(window);
