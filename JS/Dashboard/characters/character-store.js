/**
 * Character persistence (localStorage abstraction)
 *
 * All characters live in one localStorage key as an array of documents. Nothing here talks to a
 * server; swapping in account storage later only means re-implementing readAll/writeAll.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'fog_characters_v1';
  var SCHEMA = 2;
  var RULES_SOURCE = 'srd-5.2.1';
  var MAX_PORTRAIT_CHARS = 120000;
  var PORTRAIT_MAX_SIDE = 256;

  function uid() {
    return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function defaultNarrative() {
    return {
      name: '',
      portraitDataUrl: null,
      alignment: '',
      appearance: '',
      backstory: '',
      personalityTraits: '',
      ideals: '',
      bonds: '',
      flaws: '',
      notes: '',
    };
  }

  function createDraft() {
    var now = new Date().toISOString();
    return {
      id: uid(),
      userId: null,
      status: 'draft',
      schemaVersion: SCHEMA,
      rules: { edition: '5e-2024', sourceId: RULES_SOURCE },
      wizard: { currentStepId: 'level', completedStepIds: [] },
      choices: global.FogCharacterOptions.defaultChoices(),
      narrative: defaultNarrative(),
      state: { hpCurrent: null, hpTemp: 0 },
      derived: null,
      meta: { createdAt: now, updatedAt: now },
    };
  }

  /**
   * Schema 1 documents were built on a different rules dataset (SRD 5.1 mix). Their rules choices
   * can't be carried over safely, so they become drafts that keep the story details.
   */
  function migrate(doc) {
    if (!doc || typeof doc !== 'object') return null;
    if (doc.schemaVersion === SCHEMA) return doc;
    var fresh = createDraft();
    fresh.id = doc.id || fresh.id;
    fresh.meta.createdAt = (doc.meta && doc.meta.createdAt) || fresh.meta.createdAt;
    var n = doc.narrative || {};
    Object.keys(fresh.narrative).forEach(function (k) {
      if (typeof n[k] === 'string') fresh.narrative[k] = n[k];
    });
    if (typeof (doc.choices || {}).level === 'number') fresh.choices.level = doc.choices.level;
    fresh.migrationNotice =
      'This character was created with an older rules dataset. Its name and story were kept; please choose its class, origin and abilities again.';
    return fresh;
  }

  function readAll() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data.map(migrate).filter(Boolean) : [];
    } catch (e) {
      console.warn('Character store read failed', e);
      return [];
    }
  }

  function writeAll(list) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return { ok: true };
    } catch (e) {
      console.error('Character store write failed', e);
      return { ok: false, message: 'Could not save: browser storage is full or unavailable. Try a smaller portrait or remove unused characters.' };
    }
  }

  function rederive(doc) {
    doc.derived = global.FogDeriveCharacter(doc);
    return doc;
  }

  /** Saves the document. Returns { ok, doc } or { ok: false, message }. */
  function save(doc) {
    var list = readAll();
    doc.meta.updatedAt = new Date().toISOString();
    doc.schemaVersion = SCHEMA;
    rederive(doc);
    var idx = list.findIndex(function (d) { return d.id === doc.id; });
    // A character this browser doesn't have yet is a NEW character: it needs a slot from the plan's character limit
    // (FogCharacterRegistry, decided by the database). Existing characters can always be saved, edited and deleted.
    var Registry = global.FogCharacterRegistry;
    if (idx < 0 && Registry && !Registry.mayCreate(doc.id)) {
      return { ok: false, code: 'character_limit', message: Registry.blockMessage() };
    }
    if (idx >= 0) list[idx] = doc;
    else list.push(doc);
    var res = writeAll(list);
    return res.ok ? { ok: true, doc: doc } : res;
  }

  function get(id) {
    var doc = readAll().find(function (d) { return d.id === id; }) || null;
    return doc ? rederive(doc) : null;
  }

  function remove(id) {
    return writeAll(readAll().filter(function (d) { return d.id !== id; }));
  }

  function listSummaries() {
    return readAll().map(function (doc) {
      var cls = global.FogRulesApi.getClass(doc.choices.classId);
      var sp = global.FogRulesApi.getSpecies(doc.choices.speciesId);
      var subObj = cls && global.FogRulesApi.getSubclass(cls.id, doc.choices.subclassId);
      var sub = subObj ? subObj.name : null;
      return {
        id: doc.id,
        status: doc.status,
        name: doc.narrative.name || 'Unnamed character',
        level: doc.choices.level || 1,
        className: cls ? cls.name : null,
        subclassName: sub,
        speciesName: sp ? sp.name : null,
        portraitDataUrl: doc.narrative.portraitDataUrl,
        updatedAt: doc.meta.updatedAt,
        migrationNotice: doc.migrationNotice || null,
      };
    }).sort(function (a, b) {
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }

  function setPortrait(doc, dataUrl) {
    if (!dataUrl) {
      doc.narrative.portraitDataUrl = null;
      return { ok: true };
    }
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) {
      return { ok: false, message: 'Portrait must be a PNG, JPEG or WebP image.' };
    }
    if (dataUrl.length > MAX_PORTRAIT_CHARS) {
      return { ok: false, message: 'Portrait is too large to store in this browser. Try a smaller image.' };
    }
    doc.narrative.portraitDataUrl = dataUrl;
    return { ok: true };
  }

  /**
   * Resizes an image File to at most 256px on its longest side and re-encodes it as JPEG, so it can
   * be stored as a data URL (never a temporary object URL). Resolves to a data URL string.
   */
  function compressPortrait(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('Choose an image file.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That file is not a readable image.')); };
        img.onload = function () {
          var scale = Math.min(1, PORTRAIT_MAX_SIDE / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#100a0c';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var quality = 0.85;
          var url = canvas.toDataURL('image/jpeg', quality);
          while (url.length > MAX_PORTRAIT_CHARS && quality > 0.4) {
            quality -= 0.15;
            url = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(url);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  global.FogCharacterStore = {
    SCHEMA: SCHEMA,
    createDraft: createDraft,
    save: save,
    get: get,
    remove: remove,
    listSummaries: listSummaries,
    setPortrait: setPortrait,
    compressPortrait: compressPortrait,
    rederive: rederive,
    migrate: migrate,
  };
})(window);
