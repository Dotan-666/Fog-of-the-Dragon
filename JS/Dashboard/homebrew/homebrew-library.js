/**
 * Homebrew library (#grimoire): your monsters, NPCs, spells, magic items, feats and other rules, with type tabs,
 * search, sorting, create, duplicate and delete. Data comes from FogHomebrewStore; the editor is #grimoire/<id>.
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogHomebrewModel; };
  var Store = function () { return global.FogHomebrewStore; };
  var PREF_KEY = 'fog_hb_library';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    if (global.FogAccount && global.FogAccount.relativeTime) return global.FogAccount.relativeTime(iso);
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function readPrefs() {
    try { return JSON.parse(global.sessionStorage.getItem(PREF_KEY) || '{}'); } catch (e) { return {}; }
  }
  function writePrefs(p) {
    try { global.sessionStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* preference only */ }
  }

  function init(container) {
    var root = container.querySelector('#homebrew-root');
    var $ = function (s) { return root.querySelector(s); };
    var router = global.FogDashboardRouter;
    var entries = [];
    var loaded = false;
    var alive = true;
    var busy = false;
    var pendingDelete = null;
    var lastFocus = null;
    var createKind = 'monster';
    var prefs = Object.assign({ q: '', kind: '', sort: 'updated' }, readPrefs());
    if (prefs.kind && !M().KINDS[prefs.kind]) prefs.kind = '';

    $('#hb-search').value = prefs.q;
    $('#hb-sort').value = prefs.sort;

    function kindTiles(attr) {
      return M().KIND_ORDER.map(function (k) {
        var K = M().KINDS[k];
        return '<button type="button" class="hb-kind-tile" ' + attr + '="' + k + '"' + (attr === 'data-hb-pick' ? ' aria-pressed="' + (k === createKind) + '"' : '') + '>' +
          '<img class="hb-kind-icon" src="' + esc(M().artUrl(k)) + '" alt="" width="48" height="48"><strong>' + esc(K.label) + '</strong><span>' + esc(K.hint) + '</span></button>';
      }).join('');
    }
    $('#hb-empty-kinds').innerHTML = kindTiles('data-hb-new');

    function showStatus(msg) {
      $('#hb-status').textContent = msg || '';
      $('#hb-status').hidden = !msg;
    }

    function searchText(e) {
      var d = e.data;
      // Your own private library: search covers all of your text, including an NPC's personality and secrets.
      return [e.name, e.summary, M().KINDS[e.kind].label, M().subtitle(e), d.description, d.role, d.type, d.typeTags, d.category,
        d.appearance, d.motivation, d.personality, d.secrets, d.baseItem, d.higherLevels].join(' ').toLowerCase();
    }

    function filtered() {
      var words = prefs.q.toLowerCase().split(/\s+/).filter(Boolean);
      return entries.filter(function (e) {
        if (prefs.kind && e.kind !== prefs.kind) return false;
        var hay = searchText(e);
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      }).sort(function (x, y) {
        if (prefs.sort === 'name') return x.name.localeCompare(y.name);
        if (prefs.sort === 'rank') return (M().KIND_ORDER.indexOf(x.kind) - M().KIND_ORDER.indexOf(y.kind)) || (M().rank(x) - M().rank(y)) || x.name.localeCompare(y.name);
        return String(y.updatedAt).localeCompare(String(x.updatedAt));
      });
    }

    function card(e) {
      var K = M().KINDS[e.kind];
      return '<article class="hb-card hb-kind-' + esc(e.kind) + '" data-id="' + esc(e.id) + '">' +
        '<a class="hb-card-main" href="#grimoire/' + esc(e.id) + '" data-hb-open="' + esc(e.id) + '">' +
        '<span class="hb-card-art' + (e.data.image ? ' has-picture' : '') + '">' +
        '<img class="hb-card-type-art" src="' + esc(M().artUrl(e.kind)) + '" alt="" width="72" height="72">' +
        (e.data.image ? '<img class="hb-card-picture" data-img-path="' + esc(e.data.image.path) + '" alt="">' : '') + '</span>' +
        '<span class="hb-card-text"><span class="hb-card-kind">' + esc(K.label) + '</span>' +
        '<strong class="hb-card-title">' + esc(e.name) + '</strong>' +
        '<span class="hb-card-sub">' + esc(M().subtitle(e)) + '</span>' +
        (e.summary ? '<span class="hb-card-summary">' + esc(e.summary) + '</span>' : '') + '</span></a>' +
        '<div class="hb-card-foot"><span class="hb-card-date" title="' + esc(e.updatedAt ? new Date(e.updatedAt).toLocaleString() : '') + '">Edited ' + esc(fmtDate(e.updatedAt)) + '</span>' +
        '<span class="hb-card-actions">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-hb-act="duplicate" data-id="' + esc(e.id) + '">Duplicate</button>' +
        '<button type="button" class="btn btn-outline-crimson btn-sm" data-hb-act="delete" data-id="' + esc(e.id) + '" aria-label="Delete ' + esc(e.name) + '">Delete</button>' +
        '</span></div></article>';
    }

    function renderKinds() {
      var counts = {};
      entries.forEach(function (e) { counts[e.kind] = (counts[e.kind] || 0) + 1; });
      var tab = function (k, label, n) {
        var on = prefs.kind === k;
        return '<button type="button" role="tab" class="hb-kind-tab' + (on ? ' is-active' : '') + '" aria-selected="' + on + '" data-hb-kind="' + k + '">' + esc(label) + ' <span>' + n + '</span></button>';
      };
      $('#hb-kinds').innerHTML = tab('', 'All', entries.length) + M().KIND_ORDER.map(function (k) { return tab(k, M().KINDS[k].plural, counts[k] || 0); }).join('');
    }

    function render() {
      var hasAny = entries.length > 0;
      $('#hb-kinds').hidden = !hasAny;
      $('#hb-toolbar').hidden = !hasAny;
      $('#hb-empty').hidden = !loaded || hasAny;
      if (hasAny) renderKinds();
      var list = filtered();
      $('#hb-count').textContent = hasAny ? list.length + ' of ' + entries.length + ' entr' + (entries.length === 1 ? 'y' : 'ies') : '';
      var grid = $('#hb-grid');
      grid.innerHTML = hasAny
        ? (list.length ? list.map(card).join('') : '<div class="hb-no-results">' + (prefs.q ? 'Nothing matches your search. <button type="button" class="link-btn" data-hb-act="clear-filters">Clear the search</button>' : 'No ' + esc(M().KINDS[prefs.kind].plural.toLowerCase()) + ' yet. <button type="button" class="link-btn" data-hb-new="' + esc(prefs.kind) + '">Create one</button>') + '</div>')
        : '';
      hydratePictures(grid);
    }

    /** Your own pictures (private files) replace the type art on the card once their signed URLs arrive. */
    async function hydratePictures(scope) {
      var imgs = Array.prototype.slice.call(scope.querySelectorAll('img[data-img-path]'));
      if (!imgs.length || !global.FogContentImages) return;
      var res = await global.FogContentImages.urls(imgs.map(function (i) { return i.getAttribute('data-img-path'); }));
      if (!alive) return;
      imgs.forEach(function (img) {
        var url = res.urls && res.urls[img.getAttribute('data-img-path')];
        if (!url) return; // the type art stays
        img.onload = function () { img.parentNode.classList.add('is-loaded'); };
        img.src = url;
      });
    }

    async function load() {
      var res = await Store().list();
      if (!alive) return;
      loaded = true;
      if (!res.ok) {
        showStatus(res.message);
        entries = [];
      } else {
        showStatus('');
        entries = res.entries;
      }
      render();
    }

    function openModal(id) {
      lastFocus = document.activeElement;
      var m = $(id);
      m.classList.remove('hidden');
      m.setAttribute('aria-hidden', 'false');
      var f = m.querySelector('#hb-new-name, .btn-outline-crimson');
      setTimeout(function () { if (f) f.focus(); }, 50);
    }
    function closeModals() {
      root.querySelectorAll('.hb-modal').forEach(function (m) { m.classList.add('hidden'); m.setAttribute('aria-hidden', 'true'); });
      pendingDelete = null;
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    }
    function openCreate(kind) {
      createKind = M().KINDS[kind] ? kind : (prefs.kind || 'monster');
      $('#hb-create-form').reset();
      $('#hb-create-error').hidden = true;
      $('#hb-create-kinds').innerHTML = '<legend class="visually-hidden">Type</legend>' + kindTiles('data-hb-pick');
      $('#hb-new-name').placeholder = 'e.g. ' + { monster: 'Ash Wraith', npc: 'Mother Ilsabet', spell: 'Ember Lash', 'magic-item': 'Lantern of Last Light', feat: 'Shield Breaker', other: 'Gritty Resting' }[createKind];
      openModal('#hb-create-modal');
    }

    async function run(fn) {
      if (busy) return null;
      busy = true;
      try {
        var r = await fn();
        if (alive && r && !r.ok) showStatus(r.message);
        return r;
      } finally {
        busy = false;
      }
    }

    async function onClick(e) {
      var open = e.target.closest('[data-hb-open]');
      if (open && root.contains(open)) {
        e.preventDefault();
        router.navigateTo('#grimoire/' + open.getAttribute('data-hb-open'));
        return;
      }
      var nw = e.target.closest('[data-hb-new]');
      if (nw && root.contains(nw)) { openCreate(nw.getAttribute('data-hb-new')); return; }
      var pk = e.target.closest('[data-hb-pick]');
      if (pk && root.contains(pk)) {
        createKind = pk.getAttribute('data-hb-pick');
        root.querySelectorAll('[data-hb-pick]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === pk)); });
        $('#hb-new-name').focus();
        return;
      }
      var kt = e.target.closest('[data-hb-kind]');
      if (kt && root.contains(kt)) {
        prefs.kind = kt.getAttribute('data-hb-kind');
        writePrefs(prefs);
        render();
        return;
      }
      var t = e.target.closest('[data-hb-act]');
      if (!t || !root.contains(t)) {
        if (e.target.classList && e.target.classList.contains('hb-modal')) closeModals();
        return;
      }
      var act = t.getAttribute('data-hb-act');
      var id = t.getAttribute('data-id');
      var entry = entries.filter(function (x) { return x.id === id; })[0];
      if (act === 'new') {
        openCreate(prefs.kind);
      } else if (act === 'close-modal') {
        closeModals();
      } else if (act === 'duplicate') {
        var d = await run(function () { return Store().duplicate(id); });
        if (d && d.ok) { entries.unshift(d.entry); showStatus(''); render(); }
      } else if (act === 'delete' && entry) {
        pendingDelete = entry;
        $('#hb-delete-text').textContent = 'This permanently deletes the ' + M().KINDS[entry.kind].label.toLowerCase() + ' “' + entry.name + '”. Adventures that mention it by name keep their text. This cannot be undone.';
        $('#hb-delete-error').hidden = true;
        openModal('#hb-delete-modal');
      } else if (act === 'confirm-delete' && pendingDelete) {
        var target = pendingDelete;
        var r = await run(function () { return Store().remove(target.id); });
        if (r && r.ok) {
          entries = entries.filter(function (x) { return x.id !== target.id; });
          closeModals();
          render();
        } else if (r) {
          $('#hb-delete-error').textContent = r.message;
          $('#hb-delete-error').hidden = false;
        }
      } else if (act === 'clear-filters') {
        prefs.q = '';
        $('#hb-search').value = '';
        writePrefs(prefs);
        render();
      }
    }

    function onInput(e) {
      var t = e.target;
      if (t.id === 'hb-search') prefs.q = t.value.trim();
      else if (t.id === 'hb-sort') prefs.sort = t.value;
      else return;
      writePrefs(prefs);
      render();
    }

    async function onCreate(e) {
      e.preventDefault();
      var name = $('#hb-new-name').value.trim();
      var err = $('#hb-create-error');
      if (!name) {
        err.textContent = 'Give it a name.';
        err.hidden = false;
        $('#hb-new-name').focus();
        return;
      }
      var submit = $('#hb-create-form [type=submit]');
      submit.disabled = true;
      submit.textContent = 'Creating…';
      var r = await Store().create(createKind, name);
      if (!alive) return;
      submit.disabled = false;
      submit.textContent = 'Create and open';
      if (!r.ok) {
        err.textContent = r.message;
        err.hidden = false;
        return;
      }
      closeModals();
      router.navigateTo('#grimoire/' + r.entry.id);
    }

    function onKey(e) {
      if (e.key === 'Escape' && root.querySelector('.hb-modal:not(.hidden)')) closeModals();
    }

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onInput);
    $('#hb-create-form').addEventListener('submit', onCreate);
    document.addEventListener('keydown', onKey);
    $('#hb-grid').innerHTML = '<p class="hb-loading">Loading your homebrew…</p>';
    load();

    return function cleanup() {
      alive = false;
      document.removeEventListener('keydown', onKey);
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.homebrew = init;
})(window);
