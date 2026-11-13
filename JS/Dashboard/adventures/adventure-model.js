/**
 * Adventure data model (no UI code). An adventure is structured data, never one big HTML string:
 *
 *   { id, title, description, coverImage, genre, theme, levelMin, levelMax, playtime, status, notes,
 *     content: { schema: 1, chapters: [ { id, title, summary, dmNotes,
 *                                         images: [...], sections: [ { id, kind, title, playerText, dmNotes, fields: {}, images: [...] } ] } ] },
 *     version, createdAt, updatedAt }
 *
 * Text is plain text (line breaks kept). "playerText" is what the players hear or see; "dmNotes" is private.
 * Section kinds add a few labelled fields of their own (for example an NPC's motivation or an encounter's creatures).
 *
 * Images (chapters and sections): [ { id, path, caption, handout } ] — path points into the private "content-images"
 * bucket (see JS/Dashboard/content-images.js); handout = may be shown to the players in the reader's Player view.
 *
 * Assets (content.assets): the things an adventure carries besides its text, kept apart so they can be reused and,
 * later, printed as the book's appendix:
 *   [ { id, type: npc|portrait|map|location|monster|item|spell|handout, title, summary, dmNotes, fields: {},
 *       images: [...], link: { chapterId, sectionId? } | null, ref: { source: srd|homebrew|other, name } | null,
 *       printable, playerVisible, origin: manual|foggy, createdAt } ]
 *   summary is what players may see (when playerVisible), dmNotes is private. ref names a stat block in Monsters & Spells
 *   (SRD 5.2.1 or your homebrew) instead of copying it. origin "foggy" marks content saved from Foggy.
 * Book layout (content.book): { pageSize: letter|a4, appendix: bool, includeHandouts: bool } — settings for a FUTURE
 *   printable book. There is no PDF export of adventures yet; nothing reads these settings to print.
 */
(function (global) {
  'use strict';

  var IMAGE_PATH = /^[\w-]{1,64}\/adventures\/[\w-]{1,64}\/[\w-]{1,64}\.(jpg|png|webp)$/;
  var LIMITS = { images: 12, caption: 200, title: 100, description: 1000, genre: 40, theme: 80, playtime: 40, notes: 20000, chapterTitle: 100, sectionTitle: 120, text: 50000, field: 4000, chapters: 100, sections: 200, assets: 200, assetImages: 4, summary: 4000 };
  var STATUSES = ['draft', 'ready', 'archived'];
  var STATUS_LABEL = { draft: 'Draft', ready: 'Ready', archived: 'Archived' };
  var GENRES = ['Classic fantasy', 'Dungeon crawl', 'Wilderness & exploration', 'Mystery & investigation', 'Horror', 'Intrigue & politics', 'Heist', 'War & battle', 'Sea & travel', 'Comedy', 'One-shot', 'Other'];

  var KINDS = {
    scene: { label: 'Scene', icon: '✦', hint: 'A moment the players experience.', fields: [] },
    location: { label: 'Location', icon: '⌂', hint: 'A place the players can visit.', fields: [
      { key: 'features', label: 'Notable features', multiline: true, placeholder: 'Exits, hazards, light, what stands out…' },
    ] },
    npc: { label: 'NPC', icon: '☺', hint: 'A character the players meet.', fields: [
      { key: 'role', label: 'Role', placeholder: 'Innkeeper, cult leader, rival…' },
      { key: 'appearance', label: 'Appearance', placeholder: 'What the players notice first' },
      { key: 'motivation', label: 'Wants / motivation', placeholder: 'What drives them' },
      { key: 'voice', label: 'Voice & mannerisms', placeholder: 'How to play them at the table' },
    ] },
    encounter: { label: 'Encounter', icon: '⚔', hint: 'A fight or dangerous challenge.', fields: [
      { key: 'creatures', label: 'Creatures', multiline: true, placeholder: 'e.g. 4 Goblin Warriors, 1 Goblin Boss (see Monsters & Spells)' },
      { key: 'difficulty', label: 'Difficulty', options: ['', 'Low', 'Moderate', 'High'] },
      { key: 'tactics', label: 'Terrain & tactics', multiline: true, placeholder: 'Cover, ambush, what the enemies do' },
    ] },
    object: { label: 'Important object', icon: '◆', hint: 'An item, artifact or clue object.', fields: [
      { key: 'properties', label: 'Properties', multiline: true, placeholder: 'What it does, what it is worth' },
    ] },
    hook: { label: 'Story hook', icon: '⚑', hint: 'A reason for the players to get involved.', fields: [] },
    clue: { label: 'Secret / clue', icon: '?', hint: 'Information the players can discover.', fields: [
      { key: 'reveals', label: 'What it reveals', placeholder: 'The truth behind it' },
      { key: 'foundBy', label: 'How it is found', placeholder: 'Check, location, NPC…' },
    ] },
    reward: { label: 'Reward / treasure', icon: '✪', hint: 'Treasure, items or other rewards.', fields: [
      { key: 'treasure', label: 'Treasure', multiline: true, placeholder: 'Coins, gems, magic items' },
      { key: 'milestone', label: 'Milestone / XP', placeholder: 'e.g. level up after this chapter' },
    ] },
    note: { label: 'DM note', icon: '✎', hint: 'Notes only for you.', fields: [] },
  };
  var KIND_ORDER = ['scene', 'location', 'npc', 'encounter', 'object', 'hook', 'clue', 'reward', 'note'];

  // Attached assets (the appendix of a future printable book). Field lists follow the same rules as section kinds.
  var ASSET_TYPES = {
    npc: { label: 'NPC', plural: 'NPCs', icon: '☺', hint: 'A character with a page of their own.', fields: [
      { key: 'role', label: 'Role', placeholder: 'Innkeeper, cult leader, rival…' },
      { key: 'appearance', label: 'Appearance', placeholder: 'What the players notice first' },
      { key: 'motivation', label: 'Wants / motivation', placeholder: 'What drives them' },
      { key: 'voice', label: 'Voice & mannerisms', placeholder: 'How to play them at the table' },
    ] },
    portrait: { label: 'Portrait', plural: 'Portraits', icon: '◐', hint: 'A picture of a character to show the table.', fields: [
      { key: 'subject', label: 'Who it shows', placeholder: 'Name of the character' },
    ] },
    map: { label: 'Map', plural: 'Maps', icon: '⌖', hint: 'A dungeon, town or region map.', fields: [
      { key: 'scale', label: 'Scale', placeholder: 'e.g. 1 square = 5 feet' },
      { key: 'legend', label: 'Key / legend', multiline: true, placeholder: '1. Gatehouse, 2. Courtyard…' },
    ] },
    location: { label: 'Location', plural: 'Locations', icon: '⌂', hint: 'A place described once, used in many scenes.', fields: [
      { key: 'features', label: 'Notable features', multiline: true, placeholder: 'Exits, hazards, light, what stands out…' },
    ] },
    monster: { label: 'Monster / encounter', plural: 'Monsters & encounters', icon: '⚔', hint: 'A creature or a prepared fight.', fields: [
      { key: 'creatures', label: 'Creatures', multiline: true, placeholder: 'e.g. 4 Goblin Warriors, 1 Goblin Boss' },
      { key: 'difficulty', label: 'Difficulty', options: ['', 'Low', 'Moderate', 'High'] },
      { key: 'tactics', label: 'Terrain & tactics', multiline: true, placeholder: 'Cover, ambush, what the enemies do' },
    ] },
    item: { label: 'Magic item', plural: 'Magic items', icon: '◆', hint: 'An item with rules of its own.', fields: [
      { key: 'rarity', label: 'Rarity', options: ['', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'] },
      { key: 'attunement', label: 'Requires attunement', options: ['', 'No', 'Yes'] },
      { key: 'properties', label: 'What it does', multiline: true, placeholder: 'Its effect, charges, how it is used' },
    ] },
    spell: { label: 'Spell', plural: 'Spells', icon: '✶', hint: 'A spell used or found in the adventure.', fields: [
      { key: 'level', label: 'Level', options: ['', 'Cantrip', '1', '2', '3', '4', '5', '6', '7', '8', '9'] },
      { key: 'school', label: 'School', placeholder: 'e.g. Evocation' },
      { key: 'effect', label: 'Effect', multiline: true, placeholder: 'Casting time, range, what it does' },
    ] },
    handout: { label: 'Handout', plural: 'Handouts', icon: '✉', hint: 'A letter, poster or note to give the players.', fields: [] },
  };
  var ASSET_ORDER = ['npc', 'portrait', 'map', 'location', 'monster', 'item', 'spell', 'handout'];
  var REF_SOURCES = { srd: 'SRD 5.2.1', homebrew: 'My homebrew', other: 'Other book' };
  var PAGE_SIZES = ['letter', 'a4'];

  function uid(prefix) {
    var r = '';
    try {
      var a = new Uint8Array(6);
      (global.crypto || globalThis.crypto).getRandomValues(a);
      r = Array.prototype.map.call(a, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) {
      r = Math.random().toString(16).slice(2, 14);
    }
    return prefix + Date.now().toString(36) + r;
  }

  function text(v, max) {
    return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);
  }
  function line(v, max) {
    return text(v, max).replace(/\n+/g, ' ');
  }
  function level(v) {
    var n = Number(v);
    return v === '' || v == null || !Number.isFinite(n) ? null : Math.min(20, Math.max(1, Math.round(n)));
  }

  function newSection(kind, title) {
    var k = KINDS[kind] ? kind : 'scene';
    return { id: uid('s_'), kind: k, title: line(title == null ? 'New ' + KINDS[k].label.toLowerCase() : title, LIMITS.sectionTitle), playerText: '', dmNotes: '', fields: {}, images: [] };
  }
  function newChapter(title) {
    return { id: uid('c_'), title: line(title || 'New chapter', LIMITS.chapterTitle), summary: '', dmNotes: '', images: [], sections: [] };
  }
  function newAsset(type, title, extra) {
    var t = ASSET_TYPES[type] ? type : 'npc';
    return normalizeAsset(Object.assign({ id: uid('a_'), type: t, title: title == null ? 'New ' + ASSET_TYPES[t].label.toLowerCase() : title, printable: true, createdAt: new Date().toISOString() }, extra || {}));
  }
  function newAdventure(fields) {
    return normalize(Object.assign({ title: 'Untitled adventure', status: 'draft', content: { schema: 1, chapters: [] } }, fields || {}));
  }

  function normalizeImages(list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).filter(function (im) {
      if (!im || typeof im !== 'object' || typeof im.path !== 'string' || !IMAGE_PATH.test(im.path) || seen[im.path]) return false;
      seen[im.path] = true;
      return true;
    }).slice(0, LIMITS.images).map(function (im) {
      return { id: typeof im.id === 'string' && /^[\w-]{1,64}$/.test(im.id) ? im.id : uid('i_'), path: im.path, caption: line(im.caption, LIMITS.caption), handout: im.handout === true };
    });
  }
  function newImage(path, caption) {
    return normalizeImages([{ path: path, caption: caption || '' }])[0] || null;
  }
  /** Every image path used anywhere in the adventure (chapters, sections and assets). */
  function imagePaths(a) {
    var out = [];
    (a.content && a.content.chapters || []).forEach(function (c) {
      (c.images || []).forEach(function (im) { out.push(im.path); });
      (c.sections || []).forEach(function (sec) { (sec.images || []).forEach(function (im) { out.push(im.path); }); });
    });
    (a.content && a.content.assets || []).forEach(function (as) { (as.images || []).forEach(function (im) { out.push(im.path); }); });
    return out;
  }

  function normalizeFields(defs, src) {
    var fields = {};
    defs.forEach(function (f) {
      var v = src && src[f.key];
      if (v == null || v === '') return;
      fields[f.key] = f.options ? (f.options.indexOf(String(v)) >= 0 ? String(v) : '') : (f.multiline ? text(v, LIMITS.field) : line(v, LIMITS.field));
      if (!fields[f.key]) delete fields[f.key];
    });
    return fields;
  }

  /** One asset; `chapters` (normalized) lets a link to a removed chapter or section fall away. */
  function normalizeAsset(x, chapters) {
    x = x && typeof x === 'object' ? x : {};
    var type = ASSET_TYPES[x.type] ? x.type : 'npc';
    var link = null;
    if (x.link && typeof x.link === 'object' && typeof x.link.chapterId === 'string') {
      var ch = chapters ? chapters.filter(function (c) { return c.id === x.link.chapterId; })[0] : { sections: null };
      if (ch) {
        var sid = typeof x.link.sectionId === 'string' && x.link.sectionId ? x.link.sectionId : null;
        if (sid && ch.sections && !ch.sections.some(function (s) { return s.id === sid; })) sid = null;
        link = { chapterId: x.link.chapterId.slice(0, 64), sectionId: sid ? sid.slice(0, 64) : null };
      }
    }
    var ref = null;
    if (x.ref && typeof x.ref === 'object' && REF_SOURCES[x.ref.source] && line(x.ref.name, 120).trim()) ref = { source: x.ref.source, name: line(x.ref.name, 120).trim() };
    return {
      id: typeof x.id === 'string' && /^[\w-]{1,64}$/.test(x.id) ? x.id : uid('a_'),
      type: type,
      title: line(x.title, LIMITS.sectionTitle).trim() || ASSET_TYPES[type].label,
      summary: text(x.summary, LIMITS.summary),
      dmNotes: text(x.dmNotes, LIMITS.text),
      fields: normalizeFields(ASSET_TYPES[type].fields, x.fields),
      images: normalizeImages(x.images).slice(0, LIMITS.assetImages),
      link: link,
      ref: ref,
      printable: x.printable !== false,
      playerVisible: x.playerVisible === true,
      origin: x.origin === 'foggy' ? 'foggy' : 'manual',
      createdAt: typeof x.createdAt === 'string' && !isNaN(Date.parse(x.createdAt)) ? x.createdAt : null,
    };
  }
  function normalizeBook(b) {
    b = b && typeof b === 'object' ? b : {};
    return { pageSize: PAGE_SIZES.indexOf(b.pageSize) >= 0 ? b.pageSize : 'letter', appendix: b.appendix !== false, includeHandouts: b.includeHandouts !== false };
  }
  /** Assets linked to a chapter (and, when given, one of its sections). */
  function assetsFor(a, chapterId, sectionId) {
    return (a.content.assets || []).filter(function (x) { return x.link && x.link.chapterId === chapterId && (sectionId === undefined || x.link.sectionId === sectionId); });
  }

  function normalizeSection(s) {
    s = s && typeof s === 'object' ? s : {};
    var kind = KINDS[s.kind] ? s.kind : 'scene';
    var fields = normalizeFields(KINDS[kind].fields, s.fields);
    return {
      id: typeof s.id === 'string' && s.id ? s.id.slice(0, 64) : uid('s_'),
      kind: kind,
      title: line(s.title, LIMITS.sectionTitle) || KINDS[kind].label,
      playerText: text(s.playerText, LIMITS.text),
      dmNotes: text(s.dmNotes, LIMITS.text),
      fields: fields,
      images: normalizeImages(s.images),
    };
  }
  function normalizeChapter(c) {
    c = c && typeof c === 'object' ? c : {};
    return {
      id: typeof c.id === 'string' && c.id ? c.id.slice(0, 64) : uid('c_'),
      title: line(c.title, LIMITS.chapterTitle) || 'Untitled chapter',
      summary: text(c.summary, LIMITS.text),
      dmNotes: text(c.dmNotes, LIMITS.text),
      images: normalizeImages(c.images),
      sections: (Array.isArray(c.sections) ? c.sections : []).slice(0, LIMITS.sections).map(normalizeSection),
    };
  }
  function normalizeContent(content) {
    var chapters = (Array.isArray(content.chapters) ? content.chapters : []).slice(0, LIMITS.chapters).map(normalizeChapter);
    var seen = {};
    var assets = (Array.isArray(content.assets) ? content.assets : []).slice(0, LIMITS.assets).map(function (x) { return normalizeAsset(x, chapters); })
      .filter(function (x) { if (seen[x.id]) return false; seen[x.id] = true; return true; });
    return { schema: 1, chapters: chapters, assets: assets, book: normalizeBook(content.book) };
  }
  /** Cleans any adventure-shaped object into the model (lengths, kinds, ids, levels). */
  function normalize(a) {
    a = a && typeof a === 'object' ? a : {};
    var content = a.content && typeof a.content === 'object' ? a.content : {};
    var lmin = level(a.levelMin);
    var lmax = level(a.levelMax);
    if (lmin != null && lmax != null && lmin > lmax) { var t = lmin; lmin = lmax; lmax = t; }
    return {
      id: a.id || null,
      title: line(String(a.title == null ? '' : a.title).trim(), LIMITS.title).trim() || 'Untitled adventure',
      description: text(a.description, LIMITS.description),
      coverImage: typeof a.coverImage === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(a.coverImage) && a.coverImage.length <= 200000 ? a.coverImage : null,
      genre: line(a.genre, LIMITS.genre),
      theme: line(a.theme, LIMITS.theme),
      levelMin: lmin,
      levelMax: lmax,
      playtime: line(a.playtime, LIMITS.playtime),
      status: STATUSES.indexOf(a.status) >= 0 ? a.status : 'draft',
      notes: text(a.notes, LIMITS.notes),
      content: normalizeContent(content),
      version: a.version || null,
      createdAt: a.createdAt || null,
      updatedAt: a.updatedAt || null,
    };
  }

  /** Problems that block saving (the database enforces the same limits). */
  function validate(a) {
    var errors = [];
    if (!a.title || !a.title.trim()) errors.push('Give the adventure a title.');
    if (a.levelMin != null && a.levelMax != null && a.levelMin > a.levelMax) errors.push('The lowest level must not be higher than the highest level.');
    if (a.content.chapters.length > LIMITS.chapters) errors.push('An adventure can have at most ' + LIMITS.chapters + ' chapters.');
    a.content.chapters.forEach(function (c) {
      if (c.sections.length > LIMITS.sections) errors.push('“' + c.title + '” has more than ' + LIMITS.sections + ' sections.');
    });
    if ((a.content.assets || []).length > LIMITS.assets) errors.push('An adventure can have at most ' + LIMITS.assets + ' assets.');
    if (JSON.stringify(a.content).length > 1900000) errors.push('This adventure is too long to save (about 1.9 million characters at most). Split it into two adventures.');
    return errors;
  }

  function words(s) {
    var m = String(s || '').match(/[\p{L}\p{N}’']+/gu);
    return m ? m.length : 0;
  }
  function stats(a) {
    var sections = 0;
    var w = words(a.description) + words(a.notes);
    a.content.chapters.forEach(function (c) {
      sections += c.sections.length;
      w += words(c.title) + words(c.summary) + words(c.dmNotes);
      c.sections.forEach(function (s) {
        w += words(s.title) + words(s.playerText) + words(s.dmNotes);
        Object.keys(s.fields).forEach(function (k) { w += words(s.fields[k]); });
      });
    });
    (a.content.assets || []).forEach(function (x) {
      w += words(x.title) + words(x.summary) + words(x.dmNotes);
      Object.keys(x.fields).forEach(function (k) { w += words(x.fields[k]); });
    });
    return { chapters: a.content.chapters.length, sections: sections, words: w, assets: (a.content.assets || []).length };
  }

  /** A copy with fresh ids, as a new draft. */
  function duplicate(a, titlePrefix) {
    var copy = JSON.parse(JSON.stringify(normalize(a)));
    copy.id = null;
    copy.version = null;
    copy.createdAt = copy.updatedAt = null;
    copy.status = 'draft';
    copy.title = line((titlePrefix || 'Copy of ') + copy.title, LIMITS.title);
    var ids = {};
    copy.content.chapters.forEach(function (c) {
      var oldC = c.id;
      c.id = uid('c_');
      ids[oldC] = c.id;
      c.sections.forEach(function (s) { var oldS = s.id; s.id = uid('s_'); ids[oldC + '/' + oldS] = s.id; });
    });
    // Assets get new ids too, and their links follow the renamed chapters and sections.
    (copy.content.assets || []).forEach(function (x) {
      x.id = uid('a_');
      if (x.link) x.link = { chapterId: ids[x.link.chapterId], sectionId: x.link.sectionId ? ids[x.link.chapterId + '/' + x.link.sectionId] || null : null };
    });
    return copy;
  }

  /** Moves list[index] by delta (−1 up, +1 down) in place; returns the new index. */
  function move(list, index, delta) {
    var j = index + delta;
    if (index < 0 || index >= list.length || j < 0 || j >= list.length) return index;
    var x = list[index];
    list[index] = list[j];
    list[j] = x;
    return j;
  }

  function levelLabel(a) {
    if (a.levelMin == null && a.levelMax == null) return '';
    if (a.levelMin != null && a.levelMax != null) return a.levelMin === a.levelMax ? 'Level ' + a.levelMin : 'Levels ' + a.levelMin + '–' + a.levelMax;
    return 'Level ' + (a.levelMin != null ? a.levelMin + '+' : 'up to ' + a.levelMax);
  }

  global.FogAdventureModel = {
    LIMITS: LIMITS,
    STATUSES: STATUSES,
    STATUS_LABEL: STATUS_LABEL,
    GENRES: GENRES,
    KINDS: KINDS,
    KIND_ORDER: KIND_ORDER,
    newAdventure: newAdventure,
    newChapter: newChapter,
    newSection: newSection,
    normalize: normalize,
    validate: validate,
    stats: stats,
    duplicate: duplicate,
    move: move,
    levelLabel: levelLabel,
    words: words,
    newImage: newImage,
    imagePaths: imagePaths,
    ASSET_TYPES: ASSET_TYPES,
    ASSET_ORDER: ASSET_ORDER,
    REF_SOURCES: REF_SOURCES,
    PAGE_SIZES: PAGE_SIZES,
    newAsset: newAsset,
    normalizeAsset: normalizeAsset,
    assetsFor: assetsFor,
    IMAGE_PATH: IMAGE_PATH,
  };
})(typeof window !== 'undefined' ? window : globalThis);
