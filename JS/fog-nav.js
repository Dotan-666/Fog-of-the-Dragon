/**
 * FogNav: contextual "← Back to …" for the Dashboard and the Campaign workspace (one shared mechanism, used by both routers).
 *
 * The origin travels IN THE URL: a link made with FogNav.link('#bestiary/monster/goblin', 'the adventure') becomes
 *   #bestiary/monster/goblin?from=content%2Fsec-12&label=the%20adventure
 * so the browser's Back/Forward, a reload, a shared link and a bookmark all keep it, and nothing goes stale. A page reached
 * without "from" (typed address, bookmark, sidebar) gets its route's fallback instead (for example a monster → Monsters &
 * Spells), and top-level sections get no Back bar at all.
 *
 * Going back: if the origin is the previous entry of THIS tab's history, Back is history.back() (so Forward still works and
 * there are no A→B→A loops); otherwise it navigates to the origin. Each hash's scroll position (and any small UI state a page
 * saves with FogNav.state) is kept per tab in sessionStorage and restored when you come back by Back/Forward or the bar.
 *
 *   FogNav.link(target, label, opts?)        → '#target?from=<current>&label=…'   (opts.from overrides the origin)
 *   FogNav.parse(hash)                       → { path, query }
 *   FogNav.strip(hash)                       → hash without ?query
 *   FogNav.configure({ fallback(path) → { hash, label } | null, home })   per app
 *   FogNav.rendered(barHost)                 the router calls this after each page renders: draws the bar, restores scroll
 *   FogNav.state(key, value?)                per-tab UI state for the current page (filters, selection, open panels)
 *   FogNav.back()                            what the bar's link does
 */
(function (global) {
  'use strict';

  var SCROLL_KEY = 'fog_nav_scroll';
  var STATE_KEY = 'fog_nav_state';
  var STACK_KEY = 'fog_nav_stack';
  var conf = { fallback: function () { return null; } };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function readJson(k, dflt) { try { return JSON.parse(global.sessionStorage.getItem(k) || 'null') || dflt; } catch (e) { return dflt; } }
  function writeJson(k, v) { try { global.sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: no restore, still works */ } }

  function parse(hash) {
    var raw = String(hash == null ? global.location.hash : hash).replace(/^#/, '');
    var i = raw.indexOf('?');
    var query = {};
    if (i >= 0) {
      raw.slice(i + 1).split('&').forEach(function (kv) {
        if (!kv) return;
        var j = kv.indexOf('=');
        try { query[decodeURIComponent(j < 0 ? kv : kv.slice(0, j))] = j < 0 ? '' : decodeURIComponent(kv.slice(j + 1).replace(/\+/g, ' ')); } catch (e) { /* malformed: ignored */ }
      });
      raw = raw.slice(0, i);
    }
    return { path: raw, query: query };
  }
  function strip(hash) { return '#' + parse(hash).path; }
  /** An origin must be a plain in-app path (never a URL, never script). */
  function safePath(p) { return typeof p === 'string' && /^[\w%./-]{1,300}$/.test(p) && p.indexOf('//') < 0 ? p : null; }

  function link(target, label, opts) {
    opts = opts || {};
    var t = parse(target);
    var from = safePath(opts.from != null ? String(opts.from).replace(/^#/, '').split('?')[0] : parse().path);
    var q = Object.assign({}, t.query);
    delete q.from; delete q.label;
    var extra = Object.keys(q).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); });
    if (from && from !== t.path) extra.push('from=' + encodeURIComponent(from), 'label=' + encodeURIComponent(String(label || 'where you were').slice(0, 80)));
    return '#' + t.path + (extra.length ? '?' + extra.join('&') : '');
  }

  // ---- this tab's own history (to tell Back/Forward from new navigation, and to avoid loops) ----
  var stack = readJson(STACK_KEY, { list: [], i: -1 });
  var arrival = 'new';
  function track() {
    var h = global.location.hash || '#';
    if (stack.i > 0 && stack.list[stack.i - 1] === h) { stack.i--; arrival = 'back'; }
    else if (stack.list[stack.i + 1] === h) { stack.i++; arrival = 'forward'; }
    else if (stack.list[stack.i] === h) arrival = 'same';
    else { stack.list = stack.list.slice(0, stack.i + 1).concat([h]).slice(-60); stack.i = stack.list.length - 1; arrival = 'new'; }
    writeJson(STACK_KEY, stack);
  }

  // ---- scroll and small UI state per hash ----
  var lastHash = global.location.hash || '#';
  function saveScroll(h) {
    var map = readJson(SCROLL_KEY, {});
    map[h] = global.scrollY || global.pageYOffset || 0;
    var keys = Object.keys(map);
    if (keys.length > 80) delete map[keys[0]];
    writeJson(SCROLL_KEY, map);
  }
  function state(key, value) {
    var map = readJson(STATE_KEY, {});
    var k = strip() + '|' + key;
    if (value === undefined) return map[k] === undefined ? null : map[k];
    map[k] = value;
    var keys = Object.keys(map);
    if (keys.length > 120) delete map[keys[0]];
    writeJson(STATE_KEY, map);
    return value;
  }
  global.addEventListener('hashchange', function (e) {
    // the page we are leaving: remember where it was scrolled to
    var old = e && e.oldURL ? '#' + (e.oldURL.split('#')[1] || '') : lastHash;
    saveScroll(old);
    lastHash = global.location.hash || '#';
    track();
  }, true);
  global.addEventListener('pagehide', function () { saveScroll(global.location.hash || '#'); });
  if (stack.list[stack.i] !== (global.location.hash || '#')) track();

  var pendingRestore = false;
  function back() {
    var cur = parse();
    var dest = safePath(cur.query.from) ? '#' + cur.query.from : (conf.fallback(cur.path) || {}).hash;
    if (!dest) return;
    pendingRestore = true;
    if (stack.i > 0 && strip(stack.list[stack.i - 1]) === strip(dest)) global.history.back();
    else global.location.hash = dest.replace(/^#/, '');
  }

  function rendered(host) {
    var h = global.location.hash || '#';
    if (arrival === 'back' || arrival === 'forward' || pendingRestore) {
      var y = readJson(SCROLL_KEY, {})[h];
      if (y) global.setTimeout(function () { global.scrollTo(0, y); }, 80);
    }
    pendingRestore = false;
    if (!host) return;
    var cur = parse();
    var from = safePath(cur.query.from);
    var fb = from ? null : conf.fallback(cur.path);
    if (!from && !fb) { host.hidden = true; host.innerHTML = ''; return; }
    var label = from ? (cur.query.label || 'where you were') : fb.label;
    var href = from ? '#' + from : fb.hash;
    host.hidden = false;
    host.innerHTML = '<a href="' + esc(href) + '" class="fog-back-link" data-fog-back>← Back to ' + esc(label) + '</a>' +
      (cur.query.tab === '1' ? '<span class="fog-back-hint">Opened in a new tab: you can also just close it.</span>' : '');
    if (!host.__fogBack) {
      host.__fogBack = true;
      host.addEventListener('click', function (e) { if (e.target.closest('[data-fog-back]')) { e.preventDefault(); back(); } });
    }
  }

  global.FogNav = {
    link: link, parse: parse, strip: strip, state: state, back: back, rendered: rendered,
    configure: function (c) { Object.assign(conf, c || {}); },
    arrival: function () { return arrival; },
    _reset: function () { stack = { list: [], i: -1 }; writeJson(STACK_KEY, stack); track(); },
  };
})(window);
