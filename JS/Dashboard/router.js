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
  var scriptPromises = Object.create(null); // src -> Promise
  var currentRouteKey = null;
  var currentHash = null;
  var currentCleanup = null;
  var loadToken = 0;

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
      return { name: 'character-view', params: { id: id } };
    }
    return { name: parts[0], params: {} };
  }

  function routeKey(route) {
    if (route.name === 'character-view' || route.name === 'character-edit') {
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
  }

  /** Keep stylesheets the next route also needs; add missing ones; remove the rest. */
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

  function showError(container, title, message) {
    container.innerHTML =
      '<div class="dashboard-fragment page-error-panel">' +
      '<h2>' + escapeHtml(title) + '</h2>' +
      '<p>' + escapeHtml(message) + '</p>' +
      '<button type="button" class="btn btn-primary" data-fog-nav="#campaigns">Return to Campaigns</button>' +
      '</div>';
    bindNavControls(container);
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
      global.location.href = config.external;
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
      if (token !== loadToken) return;
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
        'The content failed to load. Check your connection or try again.'
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
