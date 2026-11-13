/**
 * Adventures library (#adventures): the DM's written adventures with search, filters, sorting and actions.
 * Data comes from FogAdventureStore; the editor is #adventures/<id>.
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogAdventureModel; };
  var Store = function () { return global.FogAdventureStore; };
  var PREF_KEY = 'fog_adv_library';

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
    var root = container.querySelector('#adventures-root');
    var $ = function (s) { return root.querySelector(s); };
    var router = global.FogDashboardRouter;
    var adventures = [];
    var loaded = false;
    var alive = true;
    var busy = false;
    var pendingDelete = null;
    var lastFocus = null;
    var prefs = Object.assign({ q: '', status: 'active', genre: '', sort: 'updated' }, readPrefs());

    $('#adv-search').value = prefs.q;
    $('#adv-filter-status').value = prefs.status;
    $('#adv-sort').value = prefs.sort;

    // Create form options
    $('#adv-new-genre').innerHTML = '<option value="">Choose later</option>' + M().GENRES.map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('');
    var levels = '<option value="">—</option>' + Array.from({ length: 20 }, function (_, i) { return '<option value="' + (i + 1) + '">' + (i + 1) + '</option>'; }).join('');
    $('#adv-new-min').innerHTML = levels;
    $('#adv-new-max').innerHTML = levels;

    function showStatus(msg) {
      $('#adv-status').textContent = msg || '';
      $('#adv-status').hidden = !msg;
    }

    function filtered() {
      var words = prefs.q.toLowerCase().split(/\s+/).filter(Boolean);
      return adventures.filter(function (a) {
        if (prefs.status === 'active' && a.status === 'archived') return false;
        if (prefs.status !== 'active' && prefs.status !== 'all' && a.status !== prefs.status) return false;
        if (prefs.genre && a.genre !== prefs.genre) return false;
        if (!words.length) return true;
        var hay = (a.title + ' ' + a.description + ' ' + a.genre + ' ' + a.theme).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      }).sort(function (x, y) {
        if (prefs.sort === 'title') return x.title.localeCompare(y.title);
        if (prefs.sort === 'level') {
          var lx = x.levelMin != null ? x.levelMin : x.levelMax != null ? x.levelMax : 99;
          var ly = y.levelMin != null ? y.levelMin : y.levelMax != null ? y.levelMax : 99;
          return lx - ly || x.title.localeCompare(y.title);
        }
        return String(y.updatedAt).localeCompare(String(x.updatedAt));
      });
    }

    function card(a) {
      var lvl = M().levelLabel(a);
      var initial = (a.title || '?').trim().charAt(0).toUpperCase();
      return '<article class="adv-card adv-status-' + esc(a.status) + '" data-id="' + esc(a.id) + '">' +
        '<a class="adv-card-cover" href="#adventures/' + esc(a.id) + '" data-adv-open="' + esc(a.id) + '" aria-label="Open ' + esc(a.title) + '">' +
        (a.coverImage ? '<img src="' + esc(a.coverImage) + '" alt="">' : '<span class="adv-cover-placeholder" aria-hidden="true">' + esc(initial) + '</span>') +
        '<span class="adv-badge adv-badge-' + esc(a.status) + '">' + esc(M().STATUS_LABEL[a.status]) + '</span></a>' +
        '<div class="adv-card-body">' +
        '<h2 class="adv-card-title"><a href="#adventures/' + esc(a.id) + '" data-adv-open="' + esc(a.id) + '">' + esc(a.title) + '</a></h2>' +
        (a.description ? '<p class="adv-card-desc">' + esc(a.description) + '</p>' : '<p class="adv-card-desc adv-muted">No description yet.</p>') +
        '<div class="adv-chips">' +
        (a.genre ? '<span class="adv-chip">' + esc(a.genre) + '</span>' : '') +
        (a.theme ? '<span class="adv-chip">' + esc(a.theme) + '</span>' : '') +
        (lvl ? '<span class="adv-chip">' + esc(lvl) + '</span>' : '') +
        (a.playtime ? '<span class="adv-chip">⏱ ' + esc(a.playtime) + '</span>' : '') + '</div>' +
        '<p class="adv-card-meta"><span>' + a.chapterCount + ' chapter' + (a.chapterCount === 1 ? '' : 's') + ' · ' + a.sectionCount + ' section' + (a.sectionCount === 1 ? '' : 's') + '</span>' +
        '<span title="' + esc(a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '') + '">Edited ' + esc(fmtDate(a.updatedAt)) + '</span></p>' +
        '<div class="adv-card-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-adv-act="edit" data-id="' + esc(a.id) + '">Edit</button>' +
        '<a class="btn btn-secondary btn-sm" href="#adventures/' + esc(a.id) + '/read" data-adv-read="' + esc(a.id) + '">Read</a>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-adv-act="duplicate" data-id="' + esc(a.id) + '">Duplicate</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-adv-act="' + (a.status === 'archived' ? 'restore' : 'archive') + '" data-id="' + esc(a.id) + '">' + (a.status === 'archived' ? 'Restore' : 'Archive') + '</button>' +
        '<button type="button" class="btn btn-outline-crimson btn-sm" data-adv-act="delete" data-id="' + esc(a.id) + '">Delete</button>' +
        '</div></div></article>';
    }

    function render() {
      var hasAny = adventures.length > 0;
      $('#adv-toolbar').hidden = !hasAny;
      $('#adv-empty').hidden = !loaded || hasAny;
      var genres = {};
      adventures.forEach(function (a) { if (a.genre) genres[a.genre] = 1; });
      var gsel = $('#adv-filter-genre');
      gsel.innerHTML = '<option value="">All genres</option>' + Object.keys(genres).sort().map(function (g) { return '<option' + (g === prefs.genre ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('');
      if (prefs.genre && !genres[prefs.genre]) prefs.genre = '';
      var list = filtered();
      $('#adv-count').textContent = hasAny ? list.length + ' of ' + adventures.length + ' adventure' + (adventures.length === 1 ? '' : 's') : '';
      $('#adv-grid').innerHTML = hasAny
        ? (list.length ? list.map(card).join('') : '<div class="adv-no-results">No adventures match. <button type="button" class="link-btn" data-adv-act="clear-filters">Clear the search and filters</button></div>')
        : '';
    }

    async function load() {
      var res = await Store().list();
      if (!alive) return;
      loaded = true;
      if (!res.ok) {
        showStatus(res.message);
        adventures = [];
      } else {
        showStatus('');
        adventures = res.adventures;
      }
      render();
    }

    function openModal(id) {
      lastFocus = document.activeElement;
      var m = $(id);
      m.classList.remove('hidden');
      m.setAttribute('aria-hidden', 'false');
      var f = m.querySelector('input, button.btn-outline-crimson, button');
      setTimeout(function () { if (f) f.focus(); }, 50);
    }
    function closeModals() {
      root.querySelectorAll('.adv-modal').forEach(function (m) { m.classList.add('hidden'); m.setAttribute('aria-hidden', 'true'); });
      pendingDelete = null;
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    }

    async function run(fn, okMsg) {
      if (busy) return null;
      busy = true;
      try {
        var r = await fn();
        if (!alive) return r;
        if (r && !r.ok) showStatus(r.message);
        else if (okMsg) showStatus('');
        return r;
      } finally {
        busy = false;
      }
    }

    async function onClick(e) {
      var open = e.target.closest('[data-adv-open]');
      if (open && root.contains(open)) {
        e.preventDefault();
        router.navigateTo('#adventures/' + open.getAttribute('data-adv-open'));
        return;
      }
      var rd = e.target.closest('[data-adv-read]');
      if (rd && root.contains(rd)) {
        e.preventDefault();
        router.navigateTo('#adventures/' + rd.getAttribute('data-adv-read') + '/read');
        return;
      }
      var t = e.target.closest('[data-adv-act]');
      if (!t || !root.contains(t)) {
        if (e.target.classList && e.target.classList.contains('adv-modal')) closeModals();
        return;
      }
      var act = t.getAttribute('data-adv-act');
      var id = t.getAttribute('data-id');
      var a = adventures.filter(function (x) { return x.id === id; })[0];
      if (act === 'new') {
        $('#adv-create-form').reset();
        $('#adv-create-error').hidden = true;
        openModal('#adv-create-modal');
      } else if (act === 'close-modal') {
        closeModals();
      } else if (act === 'edit') {
        router.navigateTo('#adventures/' + id);
      } else if (act === 'duplicate') {
        var d = await run(function () { return Store().duplicate(id); });
        if (d && d.ok) { adventures.unshift(d.adventure); render(); }
      } else if (act === 'archive' || act === 'restore') {
        var s = await run(function () { return Store().setStatus(id, act === 'archive' ? 'archived' : 'draft'); });
        if (s && s.ok) await load();
      } else if (act === 'delete' && a) {
        pendingDelete = a;
        $('#adv-delete-text').textContent = 'This permanently deletes “' + a.title + '” with its ' + a.chapterCount + ' chapter' + (a.chapterCount === 1 ? '' : 's') + ' and ' + a.sectionCount + ' section' + (a.sectionCount === 1 ? '' : 's') + '. Campaigns that use it keep running but lose the link. This cannot be undone.';
        $('#adv-delete-error').hidden = true;
        openModal('#adv-delete-modal');
      } else if (act === 'confirm-delete' && pendingDelete) {
        var target = pendingDelete;
        var r = await run(function () { return Store().remove(target.id); });
        if (r && r.ok) {
          adventures = adventures.filter(function (x) { return x.id !== target.id; });
          closeModals();
          render();
        } else if (r) {
          $('#adv-delete-error').textContent = r.message;
          $('#adv-delete-error').hidden = false;
        }
      } else if (act === 'clear-filters') {
        prefs = { q: '', status: 'all', genre: '', sort: prefs.sort };
        $('#adv-search').value = '';
        $('#adv-filter-status').value = 'all';
        writePrefs(prefs);
        render();
      }
    }

    function onInput(e) {
      var t = e.target;
      if (t.id === 'adv-search') prefs.q = t.value.trim();
      else if (t.id === 'adv-filter-status') prefs.status = t.value;
      else if (t.id === 'adv-filter-genre') prefs.genre = t.value;
      else if (t.id === 'adv-sort') prefs.sort = t.value;
      else return;
      writePrefs(prefs);
      render();
    }

    async function onCreate(e) {
      e.preventDefault();
      var title = $('#adv-new-title').value.trim();
      var err = $('#adv-create-error');
      if (!title) {
        err.textContent = 'Give the adventure a title.';
        err.hidden = false;
        $('#adv-new-title').focus();
        return;
      }
      var lmin = $('#adv-new-min').value;
      var lmax = $('#adv-new-max').value;
      if (lmin && lmax && Number(lmin) > Number(lmax)) {
        err.textContent = 'The lowest level must not be higher than the highest level.';
        err.hidden = false;
        return;
      }
      var submit = $('#adv-create-form [type=submit]');
      submit.disabled = true;
      submit.textContent = 'Creating…';
      var r = await Store().create({ title: title, genre: $('#adv-new-genre').value, levelMin: lmin, levelMax: lmax });
      if (!alive) return;
      submit.disabled = false;
      submit.textContent = 'Create and open';
      if (!r.ok) {
        err.textContent = r.message;
        err.hidden = false;
        return;
      }
      closeModals();
      router.navigateTo('#adventures/' + r.adventure.id);
    }

    function onKey(e) {
      if (e.key === 'Escape' && root.querySelector('.adv-modal:not(.hidden)')) closeModals();
    }

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onInput);
    $('#adv-create-form').addEventListener('submit', onCreate);
    document.addEventListener('keydown', onKey);
    $('#adv-grid').innerHTML = '<p class="adv-loading">Loading your adventures…</p>';
    load();

    return function cleanup() {
      alive = false;
      document.removeEventListener('keydown', onKey);
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.adventures = init;
})(window);
