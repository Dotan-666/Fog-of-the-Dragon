/**
 * Images for adventures and homebrew (Supabase Storage bucket "content-images", migration 20261111120100).
 *
 * The bucket is private: images belong to their author and are shown through signed URLs that expire after an hour.
 * Files live at  <user id>/<adventures|homebrew>/<entry id>/<random>.jpg  and Storage policies only let you touch
 * your own folder. Pictures are resized in the browser before upload (JPEG, longest side at most 1600 px, under
 * about 1.5 MB), so a 12 MB phone photo becomes a few hundred KB.
 *
 * FogContentImages.prepare(file)                 → Promise<{ blob, width, height }> (or rejects with a readable message)
 * FogContentImages.upload(scope, entryId, file)  → { ok, path } | { ok:false, message }
 * FogContentImages.urls(paths)                   → { ok, urls: { path: url } }  (cached until shortly before expiry)
 * FogContentImages.remove(paths)                 → { ok }
 * FogContentImages.removeFolder(scope, entryId)  → { ok }
 * FogContentImages.copy(paths, scope, entryId)   → { ok, map: { oldPath: newPath } }  (for duplicates)
 * FogContentImages.isPath(path)                  → true for a well-formed image path
 *
 * Tests can replace the storage calls with window.FogContentImagesBackend (see tests/ui/mock-images.js).
 */
(function (global) {
  'use strict';

  var BUCKET = 'content-images';
  var MAX_SIDE = 1600;
  var MAX_BYTES = 1500000;
  var MAX_INPUT_BYTES = 25 * 1024 * 1024;
  var URL_SECONDS = 3600;
  // Shape check only; who may read a file is decided by the Storage policies (own folder only).
  var PATH_RE = /^[\w-]{1,64}\/(adventures|homebrew)\/[\w-]{1,64}\/[\w-]{1,64}\.(jpg|png|webp)$/;
  var cache = {}; // path → { url, until }

  function sb() { return global.FogSupabase && global.FogSupabase.client; }
  function me() {
    var acc = global.FogAccount && global.FogAccount.getAccount && global.FogAccount.getAccount();
    return acc ? acc.id : null;
  }
  function randomName() {
    var a = new Uint8Array(9);
    global.crypto.getRandomValues(a);
    return Date.now().toString(36) + Array.prototype.map.call(a, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function fail(error, fallback) {
    var msg = (error && error.message) || fallback;
    if (/Failed to fetch|NetworkError/i.test(msg || '')) msg = 'Can\'t reach the server. Check your connection and try again.';
    if (/Bucket not found/i.test(msg || '')) msg = 'Image storage isn\'t set up yet. The site owner needs to run supabase/migrations/20261111120100_content_images.sql in Supabase → SQL Editor.';
    if (/exceeded the maximum allowed size|Payload too large/i.test(msg || '')) msg = 'That image is too large to store.';
    return { ok: false, message: msg || 'Something went wrong with the image.' };
  }

  // ---------------------------------------------------------------------------
  // Real storage (Supabase)
  // ---------------------------------------------------------------------------
  var supabaseBackend = {
    put: async function (path, blob) {
      var res = await sb().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
      return res.error ? fail(res.error, 'Could not upload the image.') : { ok: true };
    },
    sign: async function (paths) {
      var res = await sb().storage.from(BUCKET).createSignedUrls(paths, URL_SECONDS);
      if (res.error) return fail(res.error, 'Could not load the images.');
      var urls = {};
      (res.data || []).forEach(function (d) { if (d && d.signedUrl && !d.error) urls[d.path] = d.signedUrl; });
      return { ok: true, urls: urls };
    },
    del: async function (paths) {
      var res = await sb().storage.from(BUCKET).remove(paths);
      return res.error ? fail(res.error, 'Could not delete the images.') : { ok: true };
    },
    list: async function (folder) {
      var res = await sb().storage.from(BUCKET).list(folder, { limit: 1000 });
      if (res.error) return fail(res.error, 'Could not list the images.');
      return { ok: true, paths: (res.data || []).filter(function (f) { return f && f.name && f.id; }).map(function (f) { return folder + '/' + f.name; }) };
    },
    copy: async function (from, to) {
      var res = await sb().storage.from(BUCKET).copy(from, to);
      return res.error ? fail(res.error, 'Could not copy the image.') : { ok: true };
    },
  };
  function backend() { return global.FogContentImagesBackend || supabaseBackend; }
  function notReady() {
    if (!global.FogContentImagesBackend && !sb()) return { ok: false, message: (global.FogSupabase && global.FogSupabase.configError) || 'Supabase is not available, so images cannot be stored.' };
    if (!me()) return { ok: false, message: 'Sign in to add images.' };
    return null;
  }

  // ---------------------------------------------------------------------------
  // Resizing in the browser
  // ---------------------------------------------------------------------------
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('"' + file.name + '" is not a readable image.')); };
      img.src = url;
    });
  }
  function toBlob(canvas, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', quality); });
  }

  async function prepare(file) {
    if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('"' + ((file && file.name) || 'That file') + '" isn\'t a PNG, JPG, WEBP or GIF image.');
    if (file.size > MAX_INPUT_BYTES) throw new Error('"' + file.name + '" is larger than 25 MB. Choose a smaller image.');
    var loaded = await loadImage(file);
    try {
      var img = loaded.img;
      var side = MAX_SIDE;
      var blob = null;
      var w = 0;
      var h = 0;
      for (var attempt = 0; attempt < 4 && (!blob || blob.size > MAX_BYTES); attempt++) {
        var scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        w = Math.max(1, Math.round(img.naturalWidth * scale));
        h = Math.max(1, Math.round(img.naturalHeight * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // transparent parts of PNG maps become white, not black
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        blob = await toBlob(canvas, attempt === 0 ? 0.86 : 0.78);
        side = Math.round(side * 0.8);
      }
      if (!blob || blob.size > MAX_BYTES) throw new Error('"' + file.name + '" is too large even after resizing.');
      return { blob: blob, width: w, height: h };
    } finally {
      URL.revokeObjectURL(loaded.url);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  function isPath(p) { return typeof p === 'string' && PATH_RE.test(p); }
  function folder(scope, entryId) {
    if (['adventures', 'homebrew'].indexOf(scope) < 0 || !/^[\w-]{1,64}$/.test(String(entryId || ''))) return null;
    return me() + '/' + scope + '/' + entryId;
  }

  async function upload(scope, entryId, file) {
    var nr = notReady();
    if (nr) return nr;
    var dir = folder(scope, entryId);
    if (!dir) return { ok: false, message: 'Save the entry before adding images.' };
    var prepared;
    try {
      prepared = await prepare(file);
    } catch (e) {
      return { ok: false, message: e.message };
    }
    var path = dir + '/' + randomName() + '.jpg';
    var res = await backend().put(path, prepared.blob);
    if (!res.ok) return res;
    return { ok: true, path: path, width: prepared.width, height: prepared.height, bytes: prepared.blob.size };
  }

  async function urls(paths) {
    var want = (paths || []).filter(isPath);
    var out = {};
    var now = Date.now();
    var missing = want.filter(function (p) {
      var c = cache[p];
      if (c && c.until > now) { out[p] = c.url; return false; }
      return true;
    });
    if (!missing.length) return { ok: true, urls: out };
    var nr = notReady();
    if (nr) return Object.assign(nr, { urls: out });
    var res = await backend().sign(missing);
    if (!res.ok) return Object.assign(res, { urls: out });
    Object.keys(res.urls).forEach(function (p) {
      cache[p] = { url: res.urls[p], until: now + (URL_SECONDS - 300) * 1000 };
      out[p] = res.urls[p];
    });
    return { ok: true, urls: out };
  }

  async function remove(paths) {
    var list = (paths || []).filter(isPath);
    if (!list.length) return { ok: true };
    var nr = notReady();
    if (nr) return nr;
    list.forEach(function (p) { delete cache[p]; });
    return backend().del(list);
  }

  async function removeFolder(scope, entryId) {
    var nr = notReady();
    if (nr) return nr;
    var dir = folder(scope, entryId);
    if (!dir) return { ok: true };
    var listed = await backend().list(dir);
    if (!listed.ok) return listed;
    return remove(listed.paths);
  }

  async function copy(paths, scope, entryId) {
    var nr = notReady();
    if (nr) return nr;
    var dir = folder(scope, entryId);
    var map = {};
    if (!dir) return { ok: false, message: 'Unknown destination.', map: map };
    for (var i = 0; i < (paths || []).length; i++) {
      var from = paths[i];
      if (!isPath(from) || map[from]) continue;
      var to = dir + '/' + randomName() + '.jpg';
      var res = await backend().copy(from, to);
      if (res.ok) map[from] = to;
    }
    return { ok: true, map: map };
  }

  global.FogContentImages = { prepare: prepare, upload: upload, urls: urls, remove: remove, removeFolder: removeFolder, copy: copy, isPath: isPath, PATH_RE: PATH_RE };
})(window);
