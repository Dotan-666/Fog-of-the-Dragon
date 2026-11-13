/**
 * Licensed audio catalog (Assets/Audio/catalog.json): recorded music, ambience and sound effects that ship
 * with Fog of the Dragon. Every entry carries its source, author, license and attribution note.
 *
 * FogAudioCatalog.ready()   → Promise (loads the catalog once)
 * FogAudioCatalog.list()    → entries { id, kind, category, name, author, source, sourceUrl, license, attribution, url, tags, loop }
 * FogAudioCatalog.get(id)
 * FogAudioCatalog.license(id) → license info for a license key
 * FogAudioCatalog.categories() → [{ id, label }]; categoryLabel(id)
 * FogAudioCatalog.moods() / scenes() / intensities() → [{ id, label }] (music and ambience carry moods, scenes, intensity 1–3)
 * FogAudioCatalog.moodLabel(id) / sceneLabel(id) / intensityLabel(n)
 * FogAudioCatalog.error()   → message if the catalog couldn't be loaded (the library then shows only other sources)
 */
(function (global) {
  'use strict';

  var script = typeof document !== 'undefined' && document.currentScript;
  // This file lives in JS/Dashboard/music/, the audio in Assets/Audio/.
  var BASE = script && script.src ? new URL('../../../Assets/Audio/', script.src).href : 'Assets/Audio/';
  var entries = [];
  var byId = {};
  var licenses = {};
  var categories = [];
  var moods = [];
  var scenes = [];
  var intensities = [];
  var loadError = null;
  var loading = null;

  function ready() {
    if (loading) return loading;
    loading = fetch(BASE + 'catalog.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        licenses = data.licenses || {};
        categories = Array.isArray(data.categories) ? data.categories : [];
        moods = Array.isArray(data.moods) ? data.moods : [];
        scenes = Array.isArray(data.scenes) ? data.scenes : [];
        intensities = Array.isArray(data.intensities) ? data.intensities : [];
        entries = (data.tracks || []).filter(function (t) {
          // Only entries with a known license and a local file are offered.
          return t && t.id && t.file && licenses[t.license] && /^[\w./-]+$/.test(t.file) && ['music', 'ambience', 'sfx'].indexOf(t.kind) >= 0;
        }).map(function (t) {
          return Object.assign({}, t, { url: BASE + t.file, tags: t.tags || [], moods: t.moods || [], scenes: t.scenes || [], intensity: t.intensity || null });
        });
        byId = {};
        entries.forEach(function (e) { byId[e.id] = e; });
        loadError = null;
      })
      .catch(function (e) {
        loadError = 'The recorded audio library could not be loaded (' + (e && e.message ? e.message : 'network error') + ').';
        entries = [];
        byId = {};
      });
    return loading;
  }

  global.FogAudioCatalog = {
    ready: ready,
    list: function () { return entries.slice(); },
    get: function (id) { return byId[id] || null; },
    license: function (key) { return licenses[key] || null; },
    categories: function () { return categories.slice(); },
    categoryLabel: function (id) { var c = categories.filter(function (x) { return x.id === id; })[0]; return c ? c.label : id; },
    moods: function () { return moods.slice(); },
    scenes: function () { return scenes.slice(); },
    intensities: function () { return intensities.slice(); },
    moodLabel: function (id) { var m = moods.filter(function (x) { return x.id === id; })[0]; return m ? m.label : id; },
    sceneLabel: function (id) { var m = scenes.filter(function (x) { return x.id === id; })[0]; return m ? m.label : id; },
    intensityLabel: function (n) { var m = intensities.filter(function (x) { return x.id === n; })[0]; return m ? m.label : ''; },
    error: function () { return loadError; },
    base: function () { return BASE; },
  };
  if (typeof fetch === 'function') ready();
})(typeof window !== 'undefined' ? window : globalThis);
