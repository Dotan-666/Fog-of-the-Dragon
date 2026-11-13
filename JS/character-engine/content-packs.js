/**
 * Content packs: a way to add licensed or user-provided rules content on top of the SRD 5.2.1 data
 * without editing the generated files. Nothing is registered by default.
 *
 *   FogContentPacks.register({
 *     id: 'my-homebrew', name: 'My Homebrew', version: '1.0.0',
 *     edition: '2024',                       // must match the core rules (no mixing 2014 and 2024)
 *     license: 'CC BY 4.0',                  // required: the terms you are using it under
 *     attribution: 'Text shown wherever this content is used',
 *     spells:      { 'spell-id': { name, level, school, classes: [...], castingTime, range, components, duration, description } },
 *     feats:       { 'feat-id': { name, category: 'origin'|'general'|'fighting-style'|'epic-boon', description, prerequisite?, minLevel?, repeatable? } },
 *     backgrounds: { 'bg-id': { name, abilities: [3 ids], feat: { id }, skills: [2 ids], tool: { name } | { choose, text }, equipmentOptions: [...] } },
 *     species:     { 'sp-id': { name, sizeOptions: [...], speed, traits: [{ name, description }], choices: [] } },
 *     subclasses:  { 'class-id': [{ id, name, tagline?, description, features: [{ level, name, description }], alwaysPrepared? }] },
 *   });
 *
 * Every entry is checked before anything is merged; a pack with any error is rejected as a whole.
 * Merged entries carry `pack: <id>` so the UI can show the pack's attribution next to them.
 */
(function (global) {
  'use strict';

  var registered = [];
  var ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var FEAT_CATEGORIES = ['origin', 'general', 'fighting-style', 'epic-boon'];
  var ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function R() {
    return global.FogRules;
  }

  function coreEdition() {
    return /2024/.test(R().meta.edition) ? '2024' : '2014';
  }

  function str(x) {
    return typeof x === 'string' && x.trim().length > 0;
  }

  function validatePack(pack) {
    var errors = [];
    var e = function (m) { errors.push(m); };
    if (!pack || typeof pack !== 'object') return ['A content pack must be an object.'];
    if (!str(pack.id) || !ID.test(pack.id)) e('Pack id must be lowercase letters, digits and dashes.');
    if (!str(pack.name)) e('Pack name is required.');
    if (pack.edition !== coreEdition()) e('Pack edition "' + pack.edition + '" does not match the core rules (' + coreEdition() + '). Editions can’t be mixed.');
    if (!str(pack.license)) e('Pack license is required.');
    if (!str(pack.attribution)) e('Pack attribution text is required.');
    if (registered.some(function (p) { return p.id === pack.id; })) e('A pack with id "' + pack.id + '" is already registered.');

    var skills = R().skills.map(function (s) { return s.id; });
    var classIds = Object.keys(R().classes);

    function eachEntry(map, kind, existing, check) {
      if (map == null) return;
      if (typeof map !== 'object' || Array.isArray(map)) {
        e(kind + ' must be an object keyed by id.');
        return;
      }
      Object.keys(map).forEach(function (id) {
        var x = map[id];
        if (!ID.test(id)) e(kind + ' "' + id + '": invalid id.');
        if (existing && existing[id]) e(kind + ' "' + id + '" already exists in the core rules.');
        if (!x || !str(x.name)) e(kind + ' "' + id + '": name is required.');
        else check(id, x);
      });
    }

    eachEntry(pack.spells, 'Spell', R().spells, function (id, s) {
      if (!(s.level >= 0 && s.level <= 9 && Math.floor(s.level) === s.level)) e('Spell "' + id + '": level must be 0–9.');
      ['school', 'castingTime', 'range', 'components', 'duration', 'description'].forEach(function (k) { if (!str(s[k])) e('Spell "' + id + '": ' + k + ' is required.'); });
      if (!Array.isArray(s.classes) || !s.classes.length || s.classes.some(function (c) { return classIds.indexOf(c) < 0; })) e('Spell "' + id + '": classes must list existing class ids.');
    });
    eachEntry(pack.feats, 'Feat', R().feats, function (id, f) {
      if (FEAT_CATEGORIES.indexOf(f.category) < 0) e('Feat "' + id + '": category must be one of ' + FEAT_CATEGORIES.join(', ') + '.');
      if (!str(f.description)) e('Feat "' + id + '": description is required.');
      if (f.abilityIncrease && (!Array.isArray(f.abilityIncrease.from) || f.abilityIncrease.from.some(function (a) { return ABILITIES.indexOf(a) < 0; }))) e('Feat "' + id + '": abilityIncrease.from must list ability ids.');
    });
    eachEntry(pack.backgrounds, 'Background', R().backgrounds, function (id, b) {
      if (!Array.isArray(b.abilities) || b.abilities.length !== 3 || b.abilities.some(function (a) { return ABILITIES.indexOf(a) < 0; })) e('Background "' + id + '": abilities must be three ability ids.');
      var featOk = b.feat && (R().feats[b.feat.id] || (pack.feats && pack.feats[b.feat.id]));
      if (!featOk) e('Background "' + id + '": feat.id must be an existing feat.');
      if (!Array.isArray(b.skills) || b.skills.length !== 2 || b.skills.some(function (s) { return skills.indexOf(s) < 0; })) e('Background "' + id + '": skills must be two skill ids.');
      if (!b.tool || !(str(b.tool.name) || str(b.tool.choose))) e('Background "' + id + '": tool is required.');
      if (!Array.isArray(b.equipmentOptions) || !b.equipmentOptions.length) e('Background "' + id + '": equipmentOptions are required.');
    });
    eachEntry(pack.species, 'Species', R().species, function (id, s) {
      if (!Array.isArray(s.sizeOptions) || !s.sizeOptions.length) e('Species "' + id + '": sizeOptions are required.');
      if (!(s.speed > 0)) e('Species "' + id + '": speed is required.');
      if (!Array.isArray(s.traits)) e('Species "' + id + '": traits must be a list.');
      if (!Array.isArray(s.choices)) e('Species "' + id + '": choices must be a list (use []).');
    });
    if (pack.subclasses != null) {
      Object.keys(pack.subclasses).forEach(function (cid) {
        var cls = R().classes[cid];
        if (!cls) {
          e('Subclasses: unknown class "' + cid + '".');
          return;
        }
        (pack.subclasses[cid] || []).forEach(function (sub) {
          if (!sub || !str(sub.id) || !ID.test(sub.id) || !str(sub.name)) {
            e('Subclass for ' + cid + ': id and name are required.');
            return;
          }
          var all = [cls.subclass].concat(cls.extraSubclasses || []);
          if (all.some(function (s) { return s.id === sub.id; })) e('Subclass "' + sub.id + '" already exists for ' + cid + '.');
          if (!Array.isArray(sub.features) || sub.features.some(function (f) { return !str(f.name) || !(f.level >= cls.subclassLevel && f.level <= 20); })) {
            e('Subclass "' + sub.id + '": features need a name and a level from ' + cls.subclassLevel + ' to 20.');
          }
        });
      });
    }
    return errors;
  }

  function register(pack) {
    var errors = validatePack(pack);
    if (errors.length) return { ok: false, errors: errors };
    var tag = function (x) { return Object.assign({}, x, { pack: pack.id }); };
    Object.keys(pack.spells || {}).forEach(function (id) {
      var s = tag(pack.spells[id]);
      s.id = id;
      s.ritual = !!s.ritual;
      s.concentration = /^Concentration/.test(s.duration);
      s.rangeFeet = /^(\d+) feet/.test(s.range) ? Number(/^(\d+)/.exec(s.range)[1]) : 0;
      s.damageTypes = s.damageTypes || [];
      s.dealsDamage = !!s.dealsDamage;
      s.attackRoll = !!s.attackRoll;
      R().spells[id] = s;
      s.classes.forEach(function (cid) {
        var cls = R().classes[cid];
        if (!cls.spellList) return;
        (cls.spellList[s.level] = cls.spellList[s.level] || []).push(id);
      });
    });
    Object.keys(pack.feats || {}).forEach(function (id) {
      R().feats[id] = Object.assign({ prerequisite: null, minLevel: null, repeatable: false, abilityIncrease: null }, tag(pack.feats[id]), { id: id });
    });
    Object.keys(pack.backgrounds || {}).forEach(function (id) { R().backgrounds[id] = Object.assign(tag(pack.backgrounds[id]), { id: id }); });
    Object.keys(pack.species || {}).forEach(function (id) { R().species[id] = Object.assign({ sizeText: pack.species[id].sizeOptions.join(' or ') }, tag(pack.species[id]), { id: id }); });
    Object.keys(pack.subclasses || {}).forEach(function (cid) {
      var cls = R().classes[cid];
      cls.extraSubclasses = (cls.extraSubclasses || []).concat(pack.subclasses[cid].map(function (s) { return Object.assign({ alwaysPrepared: {} }, tag(s)); }));
    });
    registered.push({ id: pack.id, name: pack.name, version: pack.version || null, license: pack.license, attribution: pack.attribution });
    R().meta.contentPacks = registered.slice();
    return { ok: true, errors: [] };
  }

  global.FogContentPacks = {
    register: register,
    validate: validatePack,
    list: function () { return registered.slice(); },
  };
})(window);
