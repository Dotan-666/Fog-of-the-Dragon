/**
 * Test-only stand-in for the Supabase homebrew store, used by tests/ui/characters-harness.html?mock=homebrew.
 * It follows the same rules as the database (version bump on every save, stale-version conflicts, kind fixed after
 * creation) and keeps its data in localStorage under "__mock_homebrew" so reloads can be tested.
 * Test hooks: window.__hbMock.failNextSave(message), .bumpVersion(id) (another tab saved), .reset(), .rows().
 */
(function (global) {
  'use strict';

  var KEY = '__mock_homebrew';
  var M = function () { return global.FogHomebrewModel; };
  var nextFail = null;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function persist(rows) { localStorage.setItem(KEY, JSON.stringify(rows)); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function now() { return new Date().toISOString(); }
  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 60); }); }
  function newId() { return 'hb-' + Math.random().toString(36).slice(2, 10); }

  if (!global.FogAccount) {
    global.FogAccount = {
      getAccount: function () { return { id: 'u-test', profile: { displayName: 'Test DM' } }; },
      relativeTime: function (iso) { return new Date(iso).toLocaleString(); },
    };
  }

  function insert(e) {
    var row = M().normalize(e);
    row.id = newId();
    row.version = 1;
    row.createdAt = row.updatedAt = now();
    var rows = load();
    rows.push(row);
    persist(rows);
    return row;
  }

  global.FogHomebrewStore = {
    list: function (kinds) {
      var rows = load().filter(function (r) { return !kinds || !kinds.length || kinds.indexOf(r.kind) >= 0; });
      return delay({ ok: true, entries: rows.map(M().normalize).sort(function (x, y) { return String(y.updatedAt).localeCompare(String(x.updatedAt)); }) });
    },
    get: function (id) {
      var r = load().filter(function (x) { return x.id === id; })[0];
      return delay(r ? { ok: true, entry: M().normalize(r) } : { ok: false, notFound: true, message: 'This homebrew entry doesn’t exist or isn’t yours.' });
    },
    create: function (kind, name) {
      var e = M().newEntry(kind, name);
      var errs = M().validate(e);
      if (errs.length) return delay({ ok: false, message: errs[0] });
      return delay({ ok: true, entry: clone(insert(e)) });
    },
    save: function (entry) {
      if (nextFail) { var m = nextFail; nextFail = null; return delay({ ok: false, message: m }); }
      var e = M().normalize(entry);
      var errs = M().validate(e);
      if (errs.length) return delay({ ok: false, message: errs[0] });
      var rows = load();
      var i = rows.findIndex(function (x) { return x.id === entry.id; });
      if (i < 0) return delay({ ok: false, message: 'This entry no longer exists (it may have been deleted).' });
      if (rows[i].version !== entry.version) return delay({ ok: false, conflict: true, message: 'This entry was saved somewhere else (another tab or device) after you opened it. Reload to get the newest version.' });
      rows[i] = Object.assign(rows[i], { name: e.name, summary: e.summary, data: e.data, version: rows[i].version + 1, updatedAt: now() }); // kind never changes
      persist(rows);
      return delay({ ok: true, version: rows[i].version, updatedAt: rows[i].updatedAt });
    },
    duplicate: function (id) {
      var r = load().filter(function (x) { return x.id === id; })[0];
      if (!r) return delay({ ok: false, message: 'This homebrew entry doesn’t exist or isn’t yours.' });
      var copy = M().duplicate(r);
      var picture = copy.data.image && copy.data.image.path;
      copy.data.image = null;
      var made = insert(copy);
      if (!picture || !global.FogContentImages) return delay({ ok: true, entry: clone(made) });
      // Same as the real store: the copy gets its own picture file.
      return global.FogContentImages.copy([picture], 'homebrew', made.id).then(function (cp) {
        if (cp.map && cp.map[picture]) {
          var rows = load();
          var row = rows.filter(function (x) { return x.id === made.id; })[0];
          row.data.image = { path: cp.map[picture] };
          row.version += 1;
          persist(rows);
          made = row;
        }
        return { ok: true, entry: clone(made) };
      });
    },
    remove: function (id) {
      var rows = load();
      var n = rows.length;
      rows = rows.filter(function (x) { return x.id !== id; });
      persist(rows);
      if (rows.length < n && global.FogContentImages) return global.FogContentImages.removeFolder('homebrew', id).then(function () { return { ok: true }; });
      return delay(rows.length < n ? { ok: true } : { ok: false, message: 'This homebrew entry doesn’t exist or isn’t yours.' });
    },
  };

  global.__hbMock = {
    failNextSave: function (msg) { nextFail = msg || 'Can’t reach the server. Check your connection and try again.'; },
    bumpVersion: function (id) {
      var rows = load();
      var r = rows.filter(function (x) { return x.id === id; })[0];
      if (r) { r.version += 1; r.updatedAt = now(); persist(rows); }
    },
    reset: function () { localStorage.removeItem(KEY); },
    rows: function () { return load(); },
  };
})(window);
