/**
 * Fog of the Dragon — Dashboard hash router (fragment loader)
 *
 * Routes live in routes-config.js. Each route names an HTML fragment (Pages/Dashboard/),
 * page stylesheets (Styles/Dashboard/), scripts to load once (JS/), and a FogPageInits entry.
 * An init receives (container, params) and may return a cleanup function, which runs before
 * the next route loads.
 */
(function (global) {
  'use strict';

  var FRAGMENT_BASE = 'Dashboard/';
  var STYLE_BASE = '../Styles/Dashboard/';
  var SCRIPT_BASE = '../JS/';
  var activeStyles = Object.create(null); // href -> <link>
  var preloadedStyles = Object.create(null); // href -> <link media="print"> waiting for its route
  var scriptPromises = Object.create(null); // src -> Promise
  var currentRouteKey = null;
  var currentHash = null;
  var currentCleanup = null;
  var loadToken = 0;
  var leavingPage = false; // loads cancelled because the visitor is leaving aren't errors

  global.addEventListener('pagehide', function () { leavingPage = true; });
  global.addEventListener('pageshow', function () { leavingPage = false; });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseHash() {
    var raw = (global.location.hash || '#campaigns').replace(/^#/, '');
    var parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts.length === 0) {
      return { name: 'campaigns', params: {} };
    }
    if (parts[0] === 'adventures' && parts[1]) {
      if (parts[2] === 'read') return { name: 'adventure-read', params: { id: parts[1] } };
      return { name: 'adventure-edit', params: { id: parts[1] } };
    }
    if (parts[0] === 'marketplace') {
      // #marketplace[/<view>[/<id>]]: store, community, item/<sku>, listing/<id>, creator, new, edit/<id>, moderation, library, cart, checkout, order/<id>, orders
      return { name: 'marketplace', params: { view: parts[1] || 'store', id: parts[2] || null } };
    }
    if (parts[0] === 'billing' && parts[1] === 'revenue') {
      return { name: 'billing-revenue', params: { revenue: true } };
    }
    if (parts[0] === 'grimoire' && parts[1]) {
      return { name: 'homebrew-edit', params: { id: parts[1] } };
    }
    if (parts[0] === 'campaigns' && parts[1]) {
      return { name: 'campaign-view', params: { id: parts[1] } };
    }
    if (parts[0] === 'characters') {
      if (parts.length === 1) {
        return { name: 'characters', params: {} };
      }
      if (parts[1] === 'new') {
        return { name: 'character-create', params: { draftId: parts[2] || null } };
      }
      var id = parts[1];
      if (parts[2] === 'edit') {
        return { name: 'character-edit', params: { id: id } };
      }
      if (parts[2] === 'levelup') {
        return { name: 'character-levelup', params: { id: id } };
      }
      return { name: 'character-view', params: { id: id } };
    }
    return { name: parts[0], params: {} };
  }

  function routeKey(route) {
    if (route.name === 'character-view' || route.name === 'character-edit' || route.name === 'character-levelup' || route.name === 'campaign-view' || route.name === 'adventure-edit' || route.name === 'adventure-read' || route.name === 'homebrew-edit') {
      return route.name + ':' + route.params.id;
    }
    if (route.name === 'character-create') {
      return route.name + ':' + (route.params.draftId || 'new');
    }
    return route.name;
  }

  function getRouteConfig(route) {
    var configs = global.FogDashboardRoutes || {};
    return Object.prototype.hasOwnProperty.call(configs, route.name) ? configs[route.name] : null;
  }

  function setActiveNav(route) {
    var config = getRouteConfig(route);
    var navPage = (config && config.nav) || route.name;
    document.querySelectorAll('.fod-dragon-nav[data-page]').forEach(function (el) {
      el.classList.toggle('nav-item-active', el.getAttribute('data-page') === navPage);
    });
    // The Marketplace and the cart live in the header, not the sidebar.
    var mk = document.getElementById('marketplaceLink');
    var cart = document.getElementById('cartLink');
    var view = route.name === 'marketplace' ? route.params.view : null;
    if (mk) mk.classList.toggle('is-active', !!view && view !== 'cart' && view !== 'checkout');
    if (cart) cart.classList.toggle('is-active', view === 'cart' || view === 'checkout');
  }

  /**
   * Starts downloading the next route's stylesheets without applying them (media="print"), so the new page
   * never appears unstyled and the old page isn't restyled while it's still on screen.
   * Resolves when they have loaded (or failed, or after 4 s).
   */
  function preloadPageStyles(styles) {
    var pending = [];
    (styles || []).forEach(function (file) {
      var href = STYLE_BASE + file;
      if (activeStyles[href] || preloadedStyles[href]) return;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.media = 'print';
      link.setAttribute('data-fog-page-style', file);
      pending.push(new Promise(function (resolve) {
        link.onload = resolve;
        link.onerror = resolve;
        setTimeout(resolve, 4000);
      }));
      document.head.appendChild(link);
      preloadedStyles[href] = link;
    });
    return Promise.all(pending);
  }

  /** Apply the stylesheets the route needs (preloaded ones switch on now); remove the rest. */
  function syncPageStyles(styles) {
    var wanted = Object.create(null);
    (styles || []).forEach(function (file) {
      wanted[STYLE_BASE + file] = file;
    });
    Object.keys(activeStyles).forEach(function (href) {
      if (!wanted[href]) {
        activeStyles[href].remove();
        delete activeStyles[href];
      }
    });
    Object.keys(preloadedStyles).forEach(function (href) {
      if (wanted[href]) {
        preloadedStyles[href].media = 'all';
        activeStyles[href] = preloadedStyles[href];
      } else {
        preloadedStyles[href].remove(); // left over from a navigation that was abandoned
      }
      delete preloadedStyles[href];
    });
    Object.keys(wanted).forEach(function (href) {
      if (activeStyles[href]) return;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-fog-page-style', wanted[href]);
      document.head.appendChild(link);
      activeStyles[href] = link;
    });
  }

  /** Loads each script once, in order. Later calls reuse the same promise. */
  function loadScripts(list) {
    return (list || []).reduce(function (chain, file) {
      return chain.then(function () {
        var src = SCRIPT_BASE + file;
        if (!scriptPromises[src]) {
          scriptPromises[src] = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = function () {
              delete scriptPromises[src];
              reject(new Error('Failed to load ' + src));
            };
            document.body.appendChild(s);
          });
        }
        return scriptPromises[src];
      });
    }, Promise.resolve());
  }

  function showError(container, title, message, retry) {
    container.innerHTML =
      '<div class="dashboard-fragment page-error-panel">' +
      '<h2>' + escapeHtml(title) + '</h2>' +
      '<p>' + escapeHtml(message) + '</p>' +
      (retry ? '<button type="button" class="btn btn-primary" data-fog-retry>Try again</button> ' : '') +
      '<button type="button" class="btn ' + (retry ? 'btn-secondary' : 'btn-primary') + '" data-fog-nav="#campaigns">Return to Campaigns</button>' +
      '</div>';
    bindNavControls(container);
    var retryBtn = container.querySelector('[data-fog-retry]');
    if (retryBtn && retry) retryBtn.addEventListener('click', retry);
  }

  /** Unknown route or missing page: go to the site 404 page. Back returns to the last working page. */
  function showNotFound() {
    global.history.replaceState(null, '', currentHash || '#campaigns');
    global.location.href = global.FogDashboardNotFoundPage || '404.html';
  }

  function bindNavControls(root) {
    if (!root) return;
    root.querySelectorAll('[data-fog-nav]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        navigateTo(el.getAttribute('data-fog-nav'));
      });
    });
  }

  function runCleanup() {
    if (typeof currentCleanup === 'function') {
      try {
        currentCleanup();
      } catch (err) {
        console.error('Page cleanup error:', err);
      }
    }
    currentCleanup = null;
  }

  function navigateTo(hash, replace) {
    var target = hash.charAt(0) === '#' ? hash : '#' + hash;
    if (replace) {
      global.history.replaceState(null, '', target);
    } else if (global.location.hash !== target) {
      global.location.hash = target.slice(1);
      return;
    }
    loadRoute(parseHash(), !!replace);
  }

  async function loadRoute(route, force) {
    var key = routeKey(route);
    var container = document.getElementById('page-content');
    if (!container) return;

    var config = getRouteConfig(route);
    if (config && config.external) {
      // Replace the hash first so Back returns to the previous dashboard page, not to a redirect loop.
      global.history.replaceState(null, '', currentHash || '#campaigns');
      global.location.href = typeof config.external === 'function' ? config.external(route.params) : config.external;
      return;
    }
    if (!config && (global.FogDashboardPlannedPages || []).indexOf(route.name) < 0) {
      showNotFound();
      return;
    }
    if (!force && key === currentRouteKey && container.childElementCount > 0 && !(config && config.alwaysReload)) {
      return;
    }

    var token = ++loadToken;
    runCleanup();
    var previousHash = currentHash;
    currentRouteKey = key;
    currentHash = global.location.hash;
    setActiveNav(route);

    if (!config) {
      syncPageStyles([]);
      showError(
        container,
        'Page not available',
        'This section is not set up yet in the dashboard. Choose another item from the sidebar.'
      );
      return;
    }

    container.innerHTML = '<div class="dashboard-fragment page-loading">Loading…</div>';

    try {
      var results = await Promise.all([
        fetch(FRAGMENT_BASE + config.fragment).then(function (res) {
          if (res.status === 404) {
            var notFound = new Error('Fragment not found: ' + config.fragment);
            notFound.notFound = true;
            throw notFound;
          }
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        }),
        loadScripts(config.scripts),
        preloadPageStyles(config.styles),
      ]);
      if (token !== loadToken) return; // a newer navigation started while this one loaded

      syncPageStyles(config.styles || []);
      container.innerHTML = results[0];
      container.scrollTop = 0;
      global.scrollTo(0, 0);
      bindNavControls(container);

      var init = typeof config.init === 'function'
        ? config.init
        : config.initName && global.FogPageInits && global.FogPageInits[config.initName];
      if (typeof init === 'function') {
        currentCleanup = init(container, route.params) || null;
      }
    } catch (err) {
      // The visitor left the page (or a newer navigation started) while this one was loading: not an error.
      if (token !== loadToken || err.name === 'AbortError' || leavingPage) return;
      if (err.notFound) {
        currentHash = previousHash;
        showNotFound();
        return;
      }
      console.error('Failed to load route', route, err);
      syncPageStyles([]);
      showError(
        container,
        'Could not load page',
        'The page could not be reached. If you are running a local server (for example VS Code Live Server), make sure it is still running, then try again.',
        function () { loadRoute(route, true); }
      );
    }
  }

  function bindSidebarNav() {
    document.querySelectorAll('.fod-dragon-nav[data-page]').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        navigateTo('#' + item.getAttribute('data-page'));
        if (global.innerWidth <= 992 && typeof global.__fogCloseSidebar === 'function') {
          global.__fogCloseSidebar();
        }
      });
    });

    document.querySelectorAll('.dropdown-item[data-page]').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        navigateTo('#' + item.getAttribute('data-page'));
      });
    });
  }

  function init() {
    bindSidebarNav();
    global.addEventListener('hashchange', function () {
      loadRoute(parseHash(), false);
    });
    if (!global.location.hash) {
      global.history.replaceState(null, '', '#campaigns');
    }
    loadRoute(parseHash(), true);
  }

  global.FogDashboardRouter = {
    init: init,
    navigateTo: navigateTo,
    parseHash: parseHash,
    loadScripts: loadScripts,
    escapeHtml: escapeHtml,
  };
})(window);
