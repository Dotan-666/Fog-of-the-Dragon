/**
 * Test-only stand-in for the Supabase adventure store, used by tests/ui/characters-harness.html?mock=adventures.
 * It follows the same rules as the database (version bump on every save, stale-version conflicts, counts, limits)
 * and keeps its data in localStorage under "__mock_adventures" so reloads can be tested.
 * Test hooks: window.__advMock.failNextSave(message), .bumpVersion(id) (simulates another tab saving), .reset().
 */
(function (global) {
  'use strict';

  var KEY = '__mock_adventures';
  var M = function () { return global.FogAdventureModel; };
  var nextFail = null;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function persist(rows) { localStorage.setItem(KEY, JSON.stringify(rows)); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function now() { return new Date().toISOString(); }
  function counts(a) { var st = M().stats(M().normalize(a)); return { chapterCount: st.chapters, sectionCount: st.sections }; }
  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 60); }); }

  if (!global.FogAccount) {
    global.FogAccount = {
      getAccount: function () { return { id: 'u-test', profile: { displayName: 'Test DM' } }; },
      relativeTime: function (iso) { return new Date(iso).toLocaleString(); },
      compressImage: function (file, maxSide) {
        return new Promise(function (resolve, reject) {
          var img = new Image();
          img.onload = function () {
            var s = Math.min(1, maxSide / Math.max(img.width, img.height));
            var c = document.createElement('canvas');
            c.width = Math.round(img.width * s);
            c.height = Math.round(img.height * s);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/jpeg', 0.8));
          };
          img.onerror = function () { reject(new Error('That file is not a readable image.')); };
          img.src = URL.createObjectURL(file);
        });
      },
    };
  }

  global.FogAdventureStore = {
    list: function () {
      return delay({ ok: true, adventures: load().map(function (r) { var a = M().normalize(r); return Object.assign(a, counts(r)); }).sort(function (x, y) { return String(y.updatedAt).localeCompare(String(x.updatedAt)); }) });
    },
    get: function (id) {
      var r = load().filter(function (x) { return x.id === id; })[0];
      if (!r) return delay({ ok: false, notFound: true, message: 'This adventure doesn’t exist or isn’t yours.' });
      return delay({ ok: true, adventure: Object.assign(M().normalize(r), counts(r)), campaigns: [] });
    },
    create: function (fields) {
      var a = M().newAdventure(fields);
      var errs = M().validate(a);
      if (errs.length) return delay({ ok: false, message: errs[0] });
      a.id = 'adv-' + Math.random().toString(36).slice(2, 10);
      a.version = 1;
      a.createdAt = a.updatedAt = now();
      var rows = load();
      rows.push(a);
      persist(rows);
      return delay({ ok: true, adventure: Object.assign(clone(a), counts(a)) });
    },
    save: function (adventure) {
      if (nextFail) { var m = nextFail; nextFail = null; return delay({ ok: false, message: m }); }
      var a = M().normalize(adventure);
      var errs = M().validate(a);
      if (errs.length) return delay({ ok: false, message: errs[0] });
      var rows = load();
      var i = rows.findIndex(function (x) { return x.id === adventure.id; });
      if (i < 0) return delay({ ok: false, message: 'This adventure no longer exists (it may have been deleted).' });
      if (rows[i].version !== adventure.version) return delay({ ok: false, conflict: true, message: 'This adventure was saved somewhere else (another tab or device) after you opened it. Reload to get the newest version; your text here is kept as a backup.' });
      a.id = adventure.id;
      a.version = rows[i].version + 1;
      a.createdAt = rows[i].createdAt;
      a.updatedAt = now();
      rows[i] = a;
      persist(rows);
      return delay({ ok: true, version: a.version, updatedAt: a.updatedAt });
    },
    setStatus: function (id, status) {
      var rows = load();
      var r = rows.filter(function (x) { return x.id === id; })[0];
      if (!r) return delay({ ok: false, message: 'This adventure doesn’t exist or isn’t yours.' });
      r.status = status;
      r.version += 1;
      r.updatedAt = now();
      persist(rows);
      return delay({ ok: true });
    },
    duplicate: function (id) {
      var r = load().filter(function (x) { return x.id === id; })[0];
      if (!r) return delay({ ok: false, message: 'This adventure doesn’t exist or isn’t yours.' });
      var copy = M().duplicate(r);
      copy.id = 'adv-' + Math.random().toString(36).slice(2, 10);
      copy.version = 1;
      copy.createdAt = copy.updatedAt = now();
      // Same as the real store: the copy gets its own image files.
      var paths = M().imagePaths(copy);
      var copied = paths.length && global.FogContentImages ? global.FogContentImages.copy(paths, 'adventures', copy.id) : Promise.resolve({ map: {} });
      return copied.then(function (res) {
        var map = res.map || {};
        var fix = function (list) { return list.filter(function (im) { return map[im.path]; }).map(function (im) { return Object.assign({}, im, { path: map[im.path] }); }); };
        copy.content.chapters.forEach(function (c) { c.images = fix(c.images || []); c.sections.forEach(function (sec) { sec.images = fix(sec.images || []); }); });
        var rows = load();
        rows.push(copy);
        persist(rows);
        return delay({ ok: true, adventure: Object.assign(clone(copy), counts(copy)) });
      });
    },
    remove: function (id) {
      var rows = load();
      var n = rows.length;
      rows = rows.filter(function (x) { return x.id !== id; });
      persist(rows);
      if (rows.length < n && global.FogContentImages) return global.FogContentImages.removeFolder('adventures', id).then(function () { return { ok: true }; });
      return delay(rows.length < n ? { ok: true } : { ok: false, message: 'This adventure doesn’t exist or isn’t yours.' });
    },
  };

  global.__advMock = {
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
