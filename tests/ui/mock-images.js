/**
 * Test-only stand-in for Supabase Storage (bucket "content-images"), used by tests/ui/characters-harness.html with
 * ?mock=adventures or ?mock=homebrew. JS/Dashboard/content-images.js still does the real resizing; only the storage
 * calls go here. Files are kept as data URLs in localStorage under "__mock_images" (so reloads can be tested), and
 * only the signed-in user's own folder can be read, like the Storage policies.
 * Test hooks: window.__imgMock.paths(), .failNextUpload(message), .reset().
 */
(function (global) {
  'use strict';

  var KEY = '__mock_images';
  var nextFail = null;
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function persist(m) { localStorage.setItem(KEY, JSON.stringify(m)); }
  function me() { var a = global.FogAccount && global.FogAccount.getAccount(); return a ? a.id : ''; }
  function mine(path) { return path.indexOf(me() + '/') === 0; }
  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 80); }); }
  function readBlob(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  global.FogContentImagesBackend = {
    put: async function (path, blob) {
      if (nextFail) { var m = nextFail; nextFail = null; return delay({ ok: false, message: m }); }
      if (!mine(path)) return delay({ ok: false, message: 'new row violates row-level security policy' });
      if (blob.size > 2097152) return delay({ ok: false, message: 'That image is too large to store.' });
      var store = load();
      store[path] = { url: await readBlob(blob), bytes: blob.size, type: blob.type };
      persist(store);
      return delay({ ok: true });
    },
    sign: function (paths) {
      var store = load();
      var urls = {};
      paths.forEach(function (p) { if (store[p] && mine(p)) urls[p] = store[p].url; });
      return delay({ ok: true, urls: urls });
    },
    del: function (paths) {
      var store = load();
      paths.forEach(function (p) { if (mine(p)) delete store[p]; });
      persist(store);
      return delay({ ok: true });
    },
    list: function (folder) {
      return delay({ ok: true, paths: Object.keys(load()).filter(function (p) { return p.indexOf(folder + '/') === 0 && mine(p); }) });
    },
    copy: function (from, to) {
      var store = load();
      if (!store[from] || !mine(from) || !mine(to)) return delay({ ok: false, message: 'Object not found' });
      store[to] = Object.assign({}, store[from]);
      persist(store);
      return delay({ ok: true });
    },
  };

  global.__imgMock = {
    paths: function () { return Object.keys(load()); },
    info: function (p) { var s = load()[p]; return s ? { bytes: s.bytes, type: s.type } : null; },
    failNextUpload: function (msg) { nextFail = msg || 'Can’t reach the server. Check your connection and try again.'; },
    reset: function () { localStorage.removeItem(KEY); },
  };
})(window);
