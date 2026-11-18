/**
 * Meeting Panels — slide-over drawers available during an active Meeting in the Fog.
 *
 * When a meeting is connected the DM (and players where applicable) can open Combat, Music,
 * Bestiary and Map panels without leaving the current campaign page. At most two panels may be
 * open simultaneously (one per side); opening a third closes the oldest.
 *
 *   FogMeetingPanels.init(ctx)          wire up once the meeting session exists
 *   FogMeetingPanels.toggle(panelKey)   open or close a panel
 *   FogMeetingPanels.close(panelKey)    close one panel
 *   FogMeetingPanels.closeAll()         close every panel
 *   FogMeetingPanels.isOpen(panelKey)   boolean
 *   FogMeetingPanels.destroy()          tear down
 */
(function (global) {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var PANELS = {
    combat:   { label: 'Combat',   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>', access: 'dm' },
    music:    { label: 'Music',    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>', access: 'all' },
    bestiary: { label: 'Bestiary', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3c2 5 3 11 2 18M11 2c2 6 3 13 2 20M17 3c2 5 3 11 2 18"/></svg>', access: 'dm' },
    map:      { label: 'Map',      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/><path d="M8 2v16M16 6v16"/></svg>', access: 'all' },
  };
  var ORDER = ['combat', 'music', 'bestiary', 'map'];
  var MAX_OPEN = 2;

  var ctx = null;
  var openPanels = [];
  var panelEls = {};
  var barEl = null;
  var cleanups = {};
  var unsub = null;

  function meetingActive() {
    if (!ctx || !ctx.meeting) return false;
    var st = ctx.meeting.state();
    return st.status === 'connected' || st.status === 'reconnecting' || st.status === 'joining';
  }

  function createBar() {
    if (barEl) return;
    barEl = document.createElement('div');
    barEl.className = 'mp-bar';
    barEl.setAttribute('role', 'toolbar');
    barEl.setAttribute('aria-label', 'Meeting tools');
    barEl.innerHTML = ORDER.filter(function (k) {
      return PANELS[k].access === 'all' || (ctx && ctx.isDm);
    }).map(function (k) {
      var p = PANELS[k];
      return '<button type="button" class="mp-bar-btn" data-mp="' + k + '" aria-pressed="false" title="' + esc(p.label) + '">' + p.icon + '<span>' + esc(p.label) + '</span></button>';
    }).join('');
    barEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-mp]');
      if (btn) toggle(btn.getAttribute('data-mp'));
    });
    document.body.appendChild(barEl);
  }

  function removeBar() {
    if (barEl) { barEl.remove(); barEl = null; }
  }

  function createPanel(key) {
    if (panelEls[key]) return panelEls[key];
    var el = document.createElement('aside');
    el.className = 'mp-panel';
    el.setAttribute('data-mp-panel', key);
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', PANELS[key].label);
    el.innerHTML =
      '<header class="mp-panel-head">' +
        '<h3>' + esc(PANELS[key].label) + '</h3>' +
        '<button type="button" class="mp-panel-close" data-mp-close="' + key + '" aria-label="Close">&times;</button>' +
      '</header>' +
      '<div class="mp-panel-body" id="mp-body-' + key + '"></div>';
    el.querySelector('[data-mp-close]').addEventListener('click', function () { close(key); });
    document.body.appendChild(el);
    panelEls[key] = el;
    return el;
  }

  var PANEL_SCRIPTS = {
    combat: [
      'character-engine/data/srd-5.2.1-core.js', 'character-engine/data/srd-5.2.1-spells.js',
      'Dashboard/compendium/compendium-store.js', 'Dashboard/compendium/compendium-render.js', 'Dashboard/compendium/compendium-page.js',
      'character-engine/data/srd-5.2.1-glossary.js', 'Campaign/combat-model.js', 'Campaign/combat-session.js', 'Campaign/combat-actions.js', 'Campaign/combat-auto.js', 'Campaign/dice.js',
      'Dashboard/foggy/foggy-service.js', 'Dashboard/music/audio-catalog.js',
    ],
    bestiary: [
      'character-engine/data/srd-5.2.1-core.js', 'character-engine/data/srd-5.2.1-spells.js',
      'Dashboard/compendium/compendium-store.js', 'Dashboard/compendium/compendium-render.js', 'Dashboard/compendium/compendium-page.js',
    ],
    music: [
      'Dashboard/music/audio-catalog.js', 'Dashboard/music/music-store.js', 'Dashboard/music/music-player.js',
    ],
  };

  function loadPanelContent(key) {
    var body = panelEls[key].querySelector('.mp-panel-body');
    if (body.dataset.loaded) return;
    body.dataset.loaded = '1';

    var scripts = PANEL_SCRIPTS[key];
    if (scripts && global.FogCampaignRouter && global.FogCampaignRouter.loadScripts) {
      body.innerHTML = '<p class="mp-hint">Loading...</p>';
      global.FogCampaignRouter.loadScripts(scripts).then(function () {
        if (key === 'combat') loadCombatPanel(body);
        else if (key === 'music') loadMusicPanel(body);
        else if (key === 'bestiary') loadBestiaryPanel(body);
      }).catch(function () {
        body.innerHTML = '<p class="mp-hint">Could not load. Try opening the full page first.</p>';
        body.dataset.loaded = '';
      });
    } else {
      if (key === 'combat') loadCombatPanel(body);
      else if (key === 'music') loadMusicPanel(body);
      else if (key === 'bestiary') loadBestiaryPanel(body);
      else if (key === 'map') loadMapPanel(body);
    }
  }

  function loadCombatPanel(body) {
    body.innerHTML = '<p class="mp-hint">Loading combat tools...</p>';
    var CombatSession = global.FogCombatSession;
    var CombatModel = global.FogCombatModel;
    if (!CombatSession || !CombatModel) {
      body.innerHTML = '<p class="mp-hint">Combat scripts are not available. Reload the page and try again.</p>';
      return;
    }
    body.innerHTML =
      '<div class="mp-combat">' +
        '<div class="mp-initiative" id="mp-initiative"></div>' +
        '<div class="mp-combat-actions" id="mp-combat-actions"></div>' +
        '<p class="mp-hint">Use the full Combat page to set up encounters. This panel shows the active combat.</p>' +
      '</div>';
    var draw = function () {
      var sess = CombatSession.current();
      var initEl = body.querySelector('#mp-initiative');
      if (!sess || !sess.combatants || !sess.combatants.length) {
        initEl.innerHTML = '<p class="mp-empty">No active combat. Start one from the Combat page.</p>';
        return;
      }
      initEl.innerHTML = '<h4>Initiative Order</h4><ol class="mp-init-list">' +
        sess.combatants.map(function (c, i) {
          var current = sess.currentIndex === i;
          return '<li class="mp-init-item' + (current ? ' is-current' : '') + (c.hp <= 0 ? ' is-down' : '') + '">' +
            '<span class="mp-init-num">' + (c.initiative != null ? c.initiative : '—') + '</span>' +
            '<span class="mp-init-name">' + esc(c.name) + '</span>' +
            '<span class="mp-init-hp">' + c.hp + '/' + c.hpMax + ' HP</span>' +
          '</li>';
        }).join('') + '</ol>';
    };
    draw();
    var off = ctx.on('combat', draw);
    cleanups[body.id] = function () { off(); };
  }

  function loadMusicPanel(body) {
    body.innerHTML = '<p class="mp-hint">Loading music...</p>';
    var Player = global.FogMusicPlayer;
    if (!Player) {
      body.innerHTML = '<p class="mp-hint">Music player is not available. Reload the page and try again.</p>';
      return;
    }
    body.innerHTML =
      '<div class="mp-music">' +
        '<div class="mp-now-playing" id="mp-now-playing"></div>' +
        '<p class="mp-hint">Browse and control music from the full Music page. This shows what is playing now.</p>' +
      '</div>';
    var draw = function () {
      var st = Player.state ? Player.state() : {};
      var el = body.querySelector('#mp-now-playing');
      if (!st.track) {
        el.innerHTML = '<p class="mp-empty">Nothing playing.</p>';
        return;
      }
      el.innerHTML =
        '<div class="mp-track">' +
          '<p class="mp-track-title">' + esc(st.track.title || 'Unknown') + '</p>' +
          '<p class="mp-track-artist">' + esc(st.track.artist || '') + '</p>' +
          '<div class="mp-transport">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-mp-music="prev">Prev</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-mp-music="toggle">' + (st.playing ? 'Pause' : 'Play') + '</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-mp-music="next">Next</button>' +
          '</div>' +
        '</div>';
    };
    draw();
    body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-mp-music]');
      if (!btn) return;
      var a = btn.getAttribute('data-mp-music');
      if (a === 'toggle') Player.toggle ? Player.toggle() : (Player.play ? Player.play() : null);
      else if (a === 'next') Player.next && Player.next();
      else if (a === 'prev') Player.prev && Player.prev();
      setTimeout(draw, 100);
    });
    var iv = setInterval(draw, 2000);
    cleanups[body.id || 'music'] = function () { clearInterval(iv); };
  }

  function loadBestiaryPanel(body) {
    body.innerHTML =
      '<div class="mp-bestiary">' +
        '<label class="mp-search"><input type="search" class="form-control-dark" placeholder="Search monsters..." data-mp-search></label>' +
        '<div class="mp-results" id="mp-bs-results"></div>' +
      '</div>';
    var Comp = global.FogCompendium || global.FogCompendiumStore;
    if (!Comp) {
      body.querySelector('#mp-bs-results').innerHTML = '<p class="mp-hint">Bestiary data is not available. Reload the page and try again.</p>';
      return;
    }
    var R = global.FogCompendiumRender;
    var results = body.querySelector('#mp-bs-results');
    var input = body.querySelector('[data-mp-search]');
    var monsterList = typeof Comp.monsters === 'function' ? Comp.monsters() : (Comp.listMonsters ? Comp.listMonsters() : []);

    function search() {
      var q = (input.value || '').trim().toLowerCase();
      var items = monsterList.filter(function (m) {
        return !q || m.name.toLowerCase().indexOf(q) >= 0 || (m.type || '').toLowerCase().indexOf(q) >= 0;
      }).slice(0, 30);
      if (!items.length) { results.innerHTML = '<p class="mp-empty">' + (q ? 'No monsters match.' : 'Type to search.') + '</p>'; return; }
      results.innerHTML = items.map(function (m) {
        return '<button type="button" class="mp-bs-row" data-mp-monster="' + esc(m.key || m.id) + '">' +
          '<span class="mp-bs-name">' + esc(m.name) + '</span>' +
          '<span class="mp-bs-meta">' + esc(m.type || '') + ' · CR ' + esc(m.cr != null ? m.cr : '?') + '</span>' +
        '</button>';
      }).join('');
    }
    input.addEventListener('input', search);
    search();

    results.addEventListener('click', function (e) {
      var row = e.target.closest('[data-mp-monster]');
      if (!row) return;
      var key = row.getAttribute('data-mp-monster');
      var m = monsterList.find(function (x) { return (x.key || x.id) === key; });
      if (!m || !R) return;
      results.innerHTML = '<button type="button" class="btn btn-secondary btn-sm mp-back" data-mp-back>Back to list</button>' + R.monster(m);
      results.querySelector('[data-mp-back]').addEventListener('click', search);
    });
  }

  function loadMapPanel(body) {
    body.innerHTML =
      '<div class="mp-map">' +
        '<p class="mp-hint">The shared campaign map is shown on the Map page. During a meeting, the DM can reveal areas and move tokens there. Open the Map page for the full view.</p>' +
        '<button type="button" class="btn btn-primary btn-sm" data-mp-go="map">Open Map Page</button>' +
      '</div>';
    body.addEventListener('click', function (e) {
      if (e.target.closest('[data-mp-go]') && ctx) ctx.go('map');
    });
  }

  function updateBar() {
    if (!barEl) return;
    ORDER.forEach(function (k) {
      var btn = barEl.querySelector('[data-mp="' + k + '"]');
      if (btn) btn.setAttribute('aria-pressed', String(openPanels.indexOf(k) >= 0));
    });
  }

  function layoutPanels() {
    var sides = ['right', 'left'];
    openPanels.forEach(function (k, i) {
      var el = panelEls[k];
      if (!el) return;
      el.classList.add('is-open');
      el.setAttribute('data-side', sides[i] || 'right');
    });
    ORDER.forEach(function (k) {
      if (openPanels.indexOf(k) < 0 && panelEls[k]) {
        panelEls[k].classList.remove('is-open');
        panelEls[k].removeAttribute('data-side');
      }
    });
    document.documentElement.classList.toggle('mp-has-panels', openPanels.length > 0);
    updateBar();
  }

  function toggle(key) {
    if (!PANELS[key]) return;
    if (PANELS[key].access === 'dm' && ctx && !ctx.isDm) return;
    if (openPanels.indexOf(key) >= 0) { close(key); return; }
    if (!meetingActive()) return;
    while (openPanels.length >= MAX_OPEN) close(openPanels[0]);
    createPanel(key);
    openPanels.push(key);
    loadPanelContent(key);
    layoutPanels();
  }

  function close(key) {
    var idx = openPanels.indexOf(key);
    if (idx < 0) return;
    openPanels.splice(idx, 1);
    if (panelEls[key]) panelEls[key].classList.remove('is-open');
    var bodyId = 'mp-body-' + key;
    if (cleanups[bodyId]) { cleanups[bodyId](); delete cleanups[bodyId]; }
    layoutPanels();
  }

  function closeAll() {
    openPanels.slice().forEach(close);
  }

  function onMeetingChange() {
    if (meetingActive()) {
      createBar();
      barEl.classList.add('is-visible');
    } else {
      closeAll();
      if (barEl) barEl.classList.remove('is-visible');
    }
  }

  function init(c) {
    ctx = c;
    if (!ctx.meeting) return;
    unsub = ctx.meeting.subscribe(onMeetingChange);
    onMeetingChange();
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openPanels.length) {
        close(openPanels[openPanels.length - 1]);
        e.stopPropagation();
      }
    });
  }

  function destroy() {
    closeAll();
    removeBar();
    Object.keys(panelEls).forEach(function (k) { panelEls[k].remove(); });
    panelEls = {};
    if (unsub) unsub();
    ctx = null;
  }

  global.FogMeetingPanels = {
    init: init,
    toggle: toggle,
    close: close,
    closeAll: closeAll,
    isOpen: function (key) { return openPanels.indexOf(key) >= 0; },
    destroy: destroy,
  };
})(typeof window !== 'undefined' ? window : globalThis);
