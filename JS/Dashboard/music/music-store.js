/**
 * Music tab data, kept in this browser and separately for each signed-in user:
 *
 * - localStorage "fog_music_v1" (swapped per user by fog-account.js): playlists, favorites, play history, preferences.
 * - IndexedDB "fog_music_uploads_<userId>": your uploaded audio files (the file itself plus name/category/tags).
 *   Uploads never leave this browser; they are not sent to Supabase.
 *
 * Track references: "rec:<id>" (licensed recording, Assets/Audio/catalog.json) or "up:<id>" (an upload).
 * References to the removed browser-generated tracks ("lib:<id>") are dropped when the data is read, so playlists,
 * favorites and history never show tracks that no longer exist.
 */
(function (global) {
  'use strict';

  var KEY = 'fog_music_v1';
  var MAX_HISTORY = 100;
  var MAX_PLAYLISTS = 50;
  var MAX_PLAYLIST_ITEMS = 200;
  var MAX_FILE_BYTES = 50 * 1024 * 1024;
  var MAX_TOTAL_BYTES = 500 * 1024 * 1024;
  var AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/x-flac'];
  var AUDIO_EXT = /\.(mp3|ogg|oga|opus|wav|webm|m4a|mp4|aac|flac)$/i;

  var DEFAULTS = { playlists: [], favorites: [], history: [], prefs: { musicVolume: 70, sfxVolume: 80, generatedMinutes: 3, shuffle: false, repeat: 'all' } };

  function uid() {
    var acc = global.FogAccount && global.FogAccount.getAccount && global.FogAccount.getAccount();
    return acc ? acc.id : 'local';
  }
  function newId(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function clip(s, n) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  }

  // ---------------------------------------------------------------------------
  // localStorage part
  // ---------------------------------------------------------------------------
  function read() {
    var data;
    try { data = JSON.parse(global.localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }
    data = data && typeof data === 'object' ? data : {};
    return {
      playlists: Array.isArray(data.playlists) ? data.playlists.filter(function (p) { return p && p.id && Array.isArray(p.items); }).map(function (p) { return Object.assign({}, p, { items: p.items.filter(isRef) }); }) : [],
      favorites: Array.isArray(data.favorites) ? data.favorites.filter(isRef) : [],
      history: Array.isArray(data.history) ? data.history.filter(function (h) { return h && isRef(h.ref); }) : [],
      prefs: Object.assign({}, DEFAULTS.prefs, data.prefs || {}),
    };
  }
  function write(data) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(data));
      return { ok: true };
    } catch (e) {
      return { ok: false, message: 'This browser’s storage is full, so the change wasn’t saved.' };
    }
  }
  function isRef(r) {
    return typeof r === 'string' && /^(up|rec):[\w-]{1,80}$/.test(r);
  }

  var listeners = [];
  function changed() {
    listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }

  function prefs() { return read().prefs; }
  function setPrefs(patch) {
    var d = read();
    var p = Object.assign({}, d.prefs, patch);
    p.musicVolume = Math.max(0, Math.min(100, Number(p.musicVolume) || 0));
    p.sfxVolume = Math.max(0, Math.min(100, Number(p.sfxVolume) || 0));
    p.generatedMinutes = Math.max(1, Math.min(30, Math.round(Number(p.generatedMinutes) || 3)));
    p.repeat = ['off', 'all', 'one'].indexOf(p.repeat) >= 0 ? p.repeat : 'all';
    p.shuffle = !!p.shuffle;
    d.prefs = p;
    write(d);
    return p;
  }

  function favorites() { return read().favorites; }
  function toggleFavorite(ref) {
    if (!isRef(ref)) return false;
    var d = read();
    var i = d.favorites.indexOf(ref);
    if (i >= 0) d.favorites.splice(i, 1);
    else d.favorites.unshift(ref);
    write(d);
    changed();
    return i < 0;
  }

  function history() { return read().history; }
  function addHistory(entry) {
    if (!entry || !isRef(entry.ref)) return;
    var d = read();
    d.history.unshift({ ref: entry.ref, title: clip(entry.title, 120), kind: entry.kind || '', playlistId: entry.playlistId || null, at: new Date().toISOString() });
    d.history = d.history.slice(0, MAX_HISTORY);
    write(d);
    changed();
  }
  function clearHistory() {
    var d = read();
    d.history = [];
    write(d);
    changed();
  }

  function playlists() { return read().playlists; }
  function getPlaylist(id) { return read().playlists.filter(function (p) { return p.id === id; })[0] || null; }
  function createPlaylist(name) {
    var n = clip(name, 60);
    if (!n) return { ok: false, message: 'Give the playlist a name.' };
    var d = read();
    if (d.playlists.length >= MAX_PLAYLISTS) return { ok: false, message: 'You can have up to ' + MAX_PLAYLISTS + ' playlists.' };
    var p = { id: newId('pl_'), name: n, items: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    d.playlists.push(p);
    var res = write(d);
    changed();
    return res.ok ? { ok: true, playlist: p } : res;
  }
  function updatePlaylist(id, fn) {
    var d = read();
    var p = d.playlists.filter(function (x) { return x.id === id; })[0];
    if (!p) return { ok: false, message: 'That playlist no longer exists.' };
    var err = fn(p);
    if (err) return { ok: false, message: err };
    p.items = p.items.filter(isRef).slice(0, MAX_PLAYLIST_ITEMS);
    p.updatedAt = new Date().toISOString();
    var res = write(d);
    changed();
    return res.ok ? { ok: true, playlist: p } : res;
  }
  function renamePlaylist(id, name) {
    var n = clip(name, 60);
    if (!n) return { ok: false, message: 'Give the playlist a name.' };
    return updatePlaylist(id, function (p) { p.name = n; });
  }
  function addToPlaylist(id, ref) {
    if (!isRef(ref)) return { ok: false, message: 'Unknown track.' };
    return updatePlaylist(id, function (p) {
      if (p.items.length >= MAX_PLAYLIST_ITEMS) return 'A playlist can hold up to ' + MAX_PLAYLIST_ITEMS + ' tracks.';
      p.items.push(ref);
    });
  }
  function removeFromPlaylist(id, index) {
    return updatePlaylist(id, function (p) { p.items.splice(index, 1); });
  }
  function moveInPlaylist(id, index, delta) {
    return updatePlaylist(id, function (p) {
      var j = index + delta;
      if (j < 0 || j >= p.items.length) return null;
      var x = p.items[index];
      p.items[index] = p.items[j];
      p.items[j] = x;
    });
  }
  function deletePlaylist(id) {
    var d = read();
    d.playlists = d.playlists.filter(function (p) { return p.id !== id; });
    write(d);
    changed();
    return { ok: true };
  }
  /** Removes references to an upload that was deleted. */
  function forgetRef(ref) {
    var d = read();
    d.favorites = d.favorites.filter(function (r) { return r !== ref; });
    d.playlists.forEach(function (p) { p.items = p.items.filter(function (r) { return r !== ref; }); });
    write(d);
    changed();
  }

  // ---------------------------------------------------------------------------
  // Uploads (IndexedDB)
  // ---------------------------------------------------------------------------
  var dbPromise = null;
  var dbFor = null;
  function db() {
    if (!global.indexedDB) return Promise.reject(new Error('This browser can’t store uploaded music (IndexedDB is not available).'));
    var name = 'fog_music_uploads_' + uid();
    if (dbPromise && dbFor === name) return dbPromise;
    dbFor = name;
    dbPromise = new Promise(function (resolve, reject) {
      var req = global.indexedDB.open(name, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('tracks', { keyPath: 'id' }); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { dbPromise = null; reject(new Error('Could not open the music storage in this browser (private windows may block it).')); };
    });
    return dbPromise;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction('tracks', mode);
        var store = t.objectStore('tracks');
        var result;
        fn(store, function (r) { result = r; });
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error || new Error('Storage error.')); };
        t.onabort = function () { reject(t.error && t.error.name === 'QuotaExceededError' ? new Error('There isn’t enough browser storage for this file.') : (t.error || new Error('Storage error.'))); };
      });
    });
  }

  /** Metadata of every upload (without the file data), newest first. */
  function listUploads() {
    return tx('readonly', function (store, done) {
      var req = store.getAll();
      req.onsuccess = function () {
        done(req.result.map(function (r) {
          return { id: r.id, name: r.name, category: r.category, tags: r.tags || [], mime: r.mime, size: r.size, duration: r.duration, createdAt: r.createdAt };
        }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }));
      };
    });
  }
  function getUploadBlob(id) {
    return tx('readonly', function (store, done) {
      var req = store.get(id);
      req.onsuccess = function () { done(req.result ? req.result.blob : null); };
    });
  }

  function isAudioFile(file) {
    return !!file && (AUDIO_TYPES.indexOf(String(file.type).toLowerCase()) >= 0 || (!file.type && AUDIO_EXT.test(file.name || '')) || (/^audio\//.test(file.type) && AUDIO_EXT.test(file.name || '')));
  }

  /** Checks the browser can actually play the file, and reads its length. */
  function probe(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var a = new Audio();
      var done = false;
      function finish(ok, val) {
        if (done) return;
        done = true;
        URL.revokeObjectURL(url);
        a.removeAttribute('src');
        if (ok) resolve(val); else reject(val);
      }
      a.preload = 'metadata';
      a.onloadedmetadata = function () { finish(true, isFinite(a.duration) ? a.duration : null); };
      a.onerror = function () { finish(false, new Error('“' + file.name + '” isn’t an audio file this browser can play.')); };
      setTimeout(function () { finish(true, null); }, 8000);
      a.src = url;
    });
  }

  function addUpload(file, meta) {
    meta = meta || {};
    if (!isAudioFile(file)) return Promise.resolve({ ok: false, message: '“' + (file && file.name) + '” isn’t a supported audio file (MP3, OGG, WAV, M4A, WEBM or FLAC).' });
    if (file.size > MAX_FILE_BYTES) return Promise.resolve({ ok: false, message: '“' + file.name + '” is larger than 50 MB.' });
    return usage().then(function (u) {
      if (u.bytes + file.size > MAX_TOTAL_BYTES) return { ok: false, message: 'Your uploads would use more than 500 MB. Delete some first.' };
      return probe(file).then(function (duration) {
        var rec = {
          id: newId('u_'),
          name: clip(meta.name || file.name.replace(/\.[^.]+$/, ''), 80) || 'Untitled',
          category: clip(meta.category || 'mine', 30),
          tags: (meta.tags || []).map(function (t) { return clip(t, 24).toLowerCase(); }).filter(Boolean).slice(0, 10),
          mime: file.type || 'audio/mpeg',
          size: file.size,
          duration: duration,
          createdAt: new Date().toISOString(),
          blob: file,
        };
        return tx('readwrite', function (store) { store.put(rec); }).then(function () {
          changed();
          delete rec.blob;
          return { ok: true, upload: rec };
        });
      });
    }).catch(function (e) { return { ok: false, message: e.message || 'The file could not be saved.' }; });
  }

  function updateUpload(id, patch) {
    return tx('readwrite', function (store) {
      var req = store.get(id);
      req.onsuccess = function () {
        var r = req.result;
        if (!r) return;
        if (patch.name != null) r.name = clip(patch.name, 80) || r.name;
        if (patch.category != null) r.category = clip(patch.category, 30) || 'mine';
        if (patch.tags) r.tags = patch.tags.map(function (t) { return clip(t, 24).toLowerCase(); }).filter(Boolean).slice(0, 10);
        store.put(r);
      };
    }).then(function () { changed(); return { ok: true }; }, function (e) { return { ok: false, message: e.message }; });
  }

  function deleteUpload(id) {
    return tx('readwrite', function (store) { store.delete(id); }).then(function () {
      forgetRef('up:' + id);
      return { ok: true };
    }, function (e) { return { ok: false, message: e.message }; });
  }

  function usage() {
    return listUploads().then(function (list) {
      return { count: list.length, bytes: list.reduce(function (s, u) { return s + (u.size || 0); }, 0), maxBytes: MAX_TOTAL_BYTES };
    }, function () { return { count: 0, bytes: 0, maxBytes: MAX_TOTAL_BYTES }; });
  }

  global.FogMusicStore = {
    isRef: isRef,
    prefs: prefs,
    setPrefs: setPrefs,
    favorites: favorites,
    toggleFavorite: toggleFavorite,
    history: history,
    addHistory: addHistory,
    clearHistory: clearHistory,
    playlists: playlists,
    getPlaylist: getPlaylist,
    createPlaylist: createPlaylist,
    renamePlaylist: renamePlaylist,
    addToPlaylist: addToPlaylist,
    removeFromPlaylist: removeFromPlaylist,
    moveInPlaylist: moveInPlaylist,
    deletePlaylist: deletePlaylist,
    listUploads: listUploads,
    getUploadBlob: getUploadBlob,
    addUpload: addUpload,
    updateUpload: updateUpload,
    deleteUpload: deleteUpload,
    usage: usage,
    isAudioFile: isAudioFile,
    onChange: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
    LIMITS: { maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: MAX_TOTAL_BYTES, maxPlaylists: MAX_PLAYLISTS, maxPlaylistItems: MAX_PLAYLIST_ITEMS, maxHistory: MAX_HISTORY },
  };
})(typeof window !== 'undefined' ? window : globalThis);
