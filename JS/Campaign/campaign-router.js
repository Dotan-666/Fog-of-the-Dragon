/**
 * Campaign workspace router. The section is the hash (#overview, #feed, #settings, #content/<section id> …); the
 * campaign is the query string (campaign.html?c=<id>), so a refresh, a bookmark or the back button always lands in
 * the same campaign and the same section. This is a separate page from the Dashboard, with its own routes
 * (campaign-routes.js); it follows the Dashboard router's approach (lazy scripts and styles, cleanup before leaving).
 *
 * Pages: window.FogCampaignPages[name] = { render(host, ctx, params) → cleanup | Promise<cleanup> } (host is a fresh element per render).
 * Every render receives the same ctx (see campaign-shell.js), so a page can never read another campaign's data.
 */
(function (global) {
  'use strict';

  var STYLE_BASE = '../Styles/';
  var SCRIPT_BASE = '../JS/';
  var scriptPromises = Object.create(null);
  var activeStyles = Object.create(null); // file -> <link>
  var token = 0;
  var cleanup = null;
  var current = null; // { name, hash }
  var ctx = null;
  var root = null;
  var listeners = [];
  var rendered = [];

  function routes() { return global.FogCampaignRoutes || {}; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** #section/a/b?from=content%2Fs_1&label=Adventure → { name, rest: [a, b], query: { from, label } } */
  function parseHash() {
    var raw = (global.location.hash || '').replace(/^#/, '');
    var qi = raw.indexOf('?');
    var query = {};
    if (qi >= 0) {
      raw.slice(qi + 1).split('&').forEach(function (kv) {
        var i = kv.indexOf('=');
        if (i <= 0) return;
        try { query[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* ignore a broken pair */ }
      });
      raw = raw.slice(0, qi);
    }
    var parts = raw.split('/').filter(Boolean).map(function (p) {
      try { return decodeURIComponent(p); } catch (e) { return p; }
    });
    var name = parts[0] || global.FogCampaignDefaultRoute || 'overview';
    var alias = global.FogCampaignRouteAliases && global.FogCampaignRouteAliases[name];
    return { name: alias || name, rest: parts.slice(1), query: query };
  }

  function loadScripts(list) {
    return (list || []).reduce(function (chain, file) {
      return chain.then(function () {
        var src = SCRIPT_BASE + file;
        if (!scriptPromises[src]) {
          scriptPromises[src] = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = function () { delete scriptPromises[src]; reject(new Error('Failed to load ' + src)); };
            document.body.appendChild(s);
          });
        }
        return scriptPromises[src];
      });
    }, Promise.resolve());
  }

  /** Adds the route's stylesheets (waiting for them) and removes the ones the previous route needed. */
  function syncStyles(files) {
    var wanted = {};
    (files || []).forEach(function (f) { wanted[f] = true; });
    var pending = [];
    Object.keys(wanted).forEach(function (f) {
      if (activeStyles[f]) return;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = STYLE_BASE + f;
      link.setAttribute('data-cw-style', f);
      pending.push(new Promise(function (resolve) {
        link.onload = resolve;
        link.onerror = resolve;
        setTimeout(resolve, 4000);
      }));
      document.head.appendChild(link);
      activeStyles[f] = link;
    });
    return Promise.all(pending).then(function () {
      Object.keys(activeStyles).forEach(function (f) {
        if (!wanted[f]) {
          activeStyles[f].remove();
          delete activeStyles[f];
        }
      });
    });
  }

  function runCleanup() {
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch (e) { console.error('Page cleanup error:', e); }
    }
    cleanup = null;
  }

  function panel(title, message, extra) {
    root.innerHTML = '<div class="cw-page"><div class="cw-empty cw-empty-lg"><h2>' + esc(title) + '</h2><p>' + esc(message) + '</p>' + (extra || '') + '</div></div>';
  }

  function hrefFor(name, rest) {
    return '#' + [name].concat(rest || []).map(encodeURIComponent).join('/');
  }

  function navigateTo(name, rest) {
    var target = hrefFor(name, rest);
    if (global.location.hash !== target) global.location.hash = target;
    else load(true);
  }

  async function load(force) {
    if (!ctx || !root) return;
    var route = parseHash();
    var hash = global.location.hash;
    if (!force && current && current.hash === hash) return;
    var cfg = routes()[route.name];
    var mine = ++token;
    runCleanup();
    current = { name: route.name, hash: hash };
    listeners.forEach(function (fn) { fn(route.name); });

    if (!cfg) {
      panel('Section not found', 'There is no “' + route.name + '” section in the campaign workspace.', '<a class="btn btn-primary" href="#overview">Go to Overview</a>');
      return;
    }
    if (cfg.access === 'dm' && !ctx.isDm) {
      panel(cfg.label + ' is for the Dungeon Master', 'Only the Dungeon Master of this campaign can use this section.', '<a class="btn btn-primary" href="#overview">Go to Overview</a>');
      return;
    }
    root.innerHTML = '<div class="cw-page"><p class="cw-loading" role="status">Loading…</p></div>';
    try {
      await Promise.all([loadScripts(cfg.scripts), syncStyles(cfg.styles)]);
      if (mine !== token) return;
      var page = global.FogCampaignPages && global.FogCampaignPages[cfg.page];
      if (!page) throw new Error('Missing page: ' + cfg.page);
      // Each render gets its own container, so listeners a page adds to it disappear with it.
      var host = document.createElement('div');
      host.className = 'cw-host';
      root.innerHTML = '';
      root.appendChild(host);
      global.scrollTo(0, 0);
      var result = await page.render(host, ctx, { rest: route.rest, query: route.query });
      if (mine !== token) {
        if (typeof result === 'function') result();
        return;
      }
      cleanup = typeof result === 'function' ? result : null;
      rendered.forEach(function (fn) { try { fn(route); } catch (e) { console.error(e); } });
      try { root.focus({ preventScroll: true }); } catch (e) { /* not focusable in this browser */ }
    } catch (err) {
      if (mine !== token) return;
      console.error('Could not open campaign section', route.name, err);
      panel('Could not open this section', 'Something went wrong while loading it. Check your connection, then try again.', '<button type="button" class="btn btn-primary" data-cw-retry>Try again</button>');
      var retry = root.querySelector('[data-cw-retry]');
      if (retry) retry.addEventListener('click', function () { load(true); });
    }
  }

  function init(context, mount) {
    ctx = context;
    root = mount;
    global.addEventListener('hashchange', function () { load(false); });
    if (!global.location.hash) global.history.replaceState(null, '', hrefFor(global.FogCampaignDefaultRoute || 'overview'));
    return load(true);
  }

  global.FogCampaignRouter = {
    init: init,
    parseHash: parseHash,
    hrefFor: hrefFor,
    navigateTo: navigateTo,
    reload: function () { return load(true); },
    onRoute: function (fn) { listeners.push(fn); },
    onRendered: function (fn) { rendered.push(fn); },
    loadScripts: loadScripts,
  };
})(window);
