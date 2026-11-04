/**
 * Character options: what each choice may contain, given the character's other choices.
 * Shared by validation, sanitizing (dependent-choice pruning), derivation and the creator UI.
 */
(function (global) {
  'use strict';

  var Api = function () {
    return global.FogRulesApi;
  };

  var ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var SPELL_LISTS = ['cleric', 'druid', 'wizard'];

  function defaultChoices() {
    return {
      level: 1,
      classId: null,
      subclassId: null,
      classOptions: {},
      backgroundId: null,
      backgroundTool: null,
      backgroundIncrease: { mode: null, plus2: null, plus1: null },
      speciesId: null,
      speciesOptions: {},
      abilityMethod: null,
      abilityScoresBase: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
      skillProficiencies: [],
      languages: [],
      feats: {},
      classEquipment: null,
      backgroundEquipment: null,
      weaponMasteries: [],
      spells: { cantrips: [], prepared: [], spellbook: [], spellMastery: [], signature: [] },
    };
  }

  function level(doc) {
    return (doc.choices && doc.choices.level) || 1;
  }

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------
  function stepsFor(doc) {
    var steps = ['level', 'class', 'background', 'species', 'abilities', 'proficiencies', 'feats', 'equipment'];
    if (Api().isSpellcaster(doc.choices.classId)) steps.push('spells');
    steps.push('details', 'review');
    return steps;
  }

  // ---------------------------------------------------------------------------
  // Class choices available at the current level
  // ---------------------------------------------------------------------------
  function classChoices(doc) {
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    if (!cls) return [];
    return (cls.choices || []).filter(function (ch) {
      if (ch.level > level(doc)) return false;
      if (ch.type === 'feat') return false; // handled as feat slots
      if (ch.subclass && !c.subclassId) return false;
      return true;
    });
  }

  function subclassAvailable(doc) {
    var cls = Api().getClass(doc.choices.classId);
    return !!cls && level(doc) >= cls.subclassLevel;
  }

  // ---------------------------------------------------------------------------
  // Feat slots
  // ---------------------------------------------------------------------------
  function featSlots(doc) {
    var c = doc.choices;
    var slots = [];
    var bg = Api().getBackground(c.backgroundId);
    if (bg) {
      slots.push({ key: 'background', label: bg.name + ' background feat', source: bg.name, fixedFeatId: bg.feat.id, fixedSpellList: bg.feat.spellList });
    }
    var sp = Api().getSpecies(c.speciesId);
    if (sp && sp.choices.some(function (ch) { return ch.id === 'feat'; })) {
      slots.push({ key: 'species', label: sp.name + ': Versatile (Origin feat)', source: sp.name, categories: ['origin'] });
    }
    var cls = Api().getClass(c.classId);
    if (cls) {
      (cls.choices || []).forEach(function (ch) {
        if (ch.type !== 'feat' || ch.level > level(doc)) return;
        if (ch.subclass && !c.subclassId) return;
        slots.push({ key: 'class-' + ch.id, label: ch.label + ' (' + cls.name + ' ' + ch.level + ')', source: cls.name, categories: [ch.featCategory], level: ch.level });
      });
      cls.featLevels.forEach(function (fl) {
        if (fl.level > level(doc)) return;
        slots.push({
          key: 'level-' + fl.level,
          label: (fl.kind === 'epic-boon' ? 'Epic Boon' : 'Ability Score Improvement') + ' (' + cls.name + ' ' + fl.level + ')',
          source: cls.name,
          kind: fl.kind,
          level: fl.level,
        });
      });
    }
    return slots;
  }

  function slotByKey(doc, key) {
    return featSlots(doc).find(function (s) { return s.key === key; }) || null;
  }

  function featTakenElsewhere(doc, featId, exceptKey) {
    var feats = doc.choices.feats || {};
    return Object.keys(feats).filter(function (k) {
      return k !== exceptKey && feats[k] && feats[k].featId === featId && slotByKey(doc, k);
    }).map(function (k) { return feats[k]; });
  }

  function allowedFeats(doc, slot) {
    if (slot.fixedFeatId) return [Api().getFeat(slot.fixedFeatId)];
    var c = doc.choices;
    var categories = slot.categories;
    if (!categories) {
      categories = ['general', 'origin'];
      if (Api().hasFeature(c.classId, level(doc), 'Fighting Style')) categories.push('fighting-style');
      if (slot.kind === 'epic-boon') categories.push('epic-boon');
    }
    var scores = abilityScores(doc, slot.key).scores;
    return Api().listFeats().filter(function (f) {
      if (categories.indexOf(f.category) < 0) return false;
      if (f.minLevel && f.minLevel > (slot.level || level(doc))) return false;
      if (f.id === 'grappler' && !(scores.str >= 13 || scores.dex >= 13)) return false;
      var taken = featTakenElsewhere(doc, f.id, slot.key);
      if (taken.length && !f.repeatable) return false;
      if (f.id === 'magic-initiate' && taken.length >= SPELL_LISTS.length) return false;
      return true;
    });
  }

  /** Spell lists still free for a Magic Initiate instance in this slot. */
  function magicInitiateLists(doc, slot) {
    if (slot.fixedSpellList) return [slot.fixedSpellList];
    var used = featTakenElsewhere(doc, 'magic-initiate', slot.key).map(function (f) { return f.spellList; });
    return SPELL_LISTS.filter(function (l) { return used.indexOf(l) < 0; });
  }

  // ---------------------------------------------------------------------------
  // Ability scores
  // ---------------------------------------------------------------------------
  function backgroundIncreases(doc) {
    var c = doc.choices;
    var bg = Api().getBackground(c.backgroundId);
    var inc = {};
    var bi = c.backgroundIncrease || {};
    if (!bg || !bi.mode) return inc;
    if (bi.mode === '1-1-1') {
      bg.abilities.forEach(function (a) { inc[a] = 1; });
    } else if (bi.mode === '2-1') {
      if (bi.plus2 && bg.abilities.indexOf(bi.plus2) >= 0) inc[bi.plus2] = 2;
      if (bi.plus1 && bi.plus1 !== bi.plus2 && bg.abilities.indexOf(bi.plus1) >= 0) inc[bi.plus1] = 1;
    }
    return inc;
  }

  function featIncreaseRule(featId) {
    if (featId === 'ability-score-improvement') return { total: 2, perAbility: 2, from: ABILITIES, max: 20 };
    var f = Api().getFeat(featId);
    if (f && f.abilityIncrease) return { total: f.abilityIncrease.amount, perAbility: 1, from: f.abilityIncrease.from, max: f.abilityIncrease.max };
    return null;
  }

  /**
   * Scores after base + background + feats, in slot order. `stopBeforeSlot` returns the scores
   * a feat in that slot sees (used for prerequisites). Breakdown lists every increase.
   */
  function abilityScores(doc, stopBeforeSlot) {
    var c = doc.choices;
    var base = c.abilityScoresBase || {};
    var scores = {};
    var breakdown = {};
    var overCap = [];
    ABILITIES.forEach(function (a) {
      scores[a] = typeof base[a] === 'number' ? base[a] : 10;
      breakdown[a] = [{ source: 'Base', value: scores[a] }];
    });
    var bgInc = backgroundIncreases(doc);
    var bg = Api().getBackground(c.backgroundId);
    Object.keys(bgInc).forEach(function (a) {
      var next = Math.min(20, scores[a] + bgInc[a]);
      if (scores[a] + bgInc[a] > 20) overCap.push({ ability: a, source: 'Background' });
      breakdown[a].push({ source: bg.name + ' background', value: next - scores[a] });
      scores[a] = next;
    });
    var slots = featSlots(doc);
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (slot.key === stopBeforeSlot) break;
      var inst = (c.feats || {})[slot.key];
      if (!inst || !inst.featId) continue;
      var rule = featIncreaseRule(inst.featId);
      if (!rule || !inst.abilityIncrease) continue;
      Object.keys(inst.abilityIncrease).forEach(function (a) {
        var amt = inst.abilityIncrease[a];
        if (rule.from.indexOf(a) < 0 || !amt) return;
        var next = Math.min(rule.max, scores[a] + amt);
        if (scores[a] + amt > rule.max) overCap.push({ ability: a, source: Api().getFeat(inst.featId).name, max: rule.max });
        breakdown[a].push({ source: Api().getFeat(inst.featId).name, value: next - scores[a] });
        scores[a] = next;
      });
    }
    return { scores: scores, breakdown: breakdown, overCap: overCap };
  }

  // ---------------------------------------------------------------------------
  // Skills, tools, languages
  // ---------------------------------------------------------------------------
  /** Skill proficiencies from every source except the given one ('class' | slot key). */
  function skillSources(doc, except) {
    var c = doc.choices;
    var map = {};
    function add(id, src) {
      if (!id) return;
      (map[id] = map[id] || []).push(src);
    }
    var bg = Api().getBackground(c.backgroundId);
    if (bg && except !== 'background') bg.skills.forEach(function (s) { add(s, bg.name); });
    var sp = Api().getSpecies(c.speciesId);
    if (sp && except !== 'species' && c.speciesOptions && c.speciesOptions.skill) add(c.speciesOptions.skill, sp.name);
    if (except !== 'class') (c.skillProficiencies || []).forEach(function (s) { add(s, 'Class'); });
    var feats = c.feats || {};
    featSlots(doc).forEach(function (slot) {
      var inst = feats[slot.key];
      if (slot.key === except || !inst || inst.featId !== 'skilled') return;
      (inst.picks || []).forEach(function (p) { if (p.type === 'skill') add(p.id, 'Skilled'); });
    });
    return map;
  }

  function toolSources(doc, except) {
    var c = doc.choices;
    var map = {};
    function add(id, src) {
      if (!id) return;
      (map[id] = map[id] || []).push(src);
    }
    var bg = Api().getBackground(c.backgroundId);
    if (bg && except !== 'background') {
      if (bg.tool.name) add(toolIdByName(bg.tool.name), bg.name);
      else if (c.backgroundTool) add(c.backgroundTool, bg.name);
    }
    var cls = Api().getClass(c.classId);
    if (cls && cls.proficiencies) cls.proficiencies.tools.forEach(function (t) { add(toolIdByName(t), cls.name); });
    var feats = c.feats || {};
    featSlots(doc).forEach(function (slot) {
      var inst = feats[slot.key];
      if (slot.key === except || !inst || inst.featId !== 'skilled') return;
      (inst.picks || []).forEach(function (p) { if (p.type === 'tool') add(p.id, 'Skilled'); });
    });
    return map;
  }

  function toolIdByName(name) {
    var t = Api().rules().tools.find(function (x) { return x.name === name; });
    return t ? t.id : null;
  }

  function classSkillOptions(doc) {
    var cls = Api().getClass(doc.choices.classId);
    if (!cls) return null;
    var granted = skillSources(doc, 'class');
    return {
      count: cls.skillChoices.count,
      from: cls.skillChoices.from,
      granted: granted,
      selectable: cls.skillChoices.from.filter(function (s) { return !granted[s]; }),
    };
  }

  function proficientSkills(doc) {
    return Object.keys(skillSources(doc, null));
  }

  /** Skills an Expertise choice may pick: proficient skills not already taken by an earlier Expertise choice. */
  function expertiseOptions(doc, choice) {
    var others = [];
    var choices = classChoices(doc).filter(function (ch) { return ch.type === 'expertise'; });
    for (var i = 0; i < choices.length && choices[i].id !== choice.id; i++) {
      others = others.concat(doc.choices.classOptions[choices[i].id] || []);
    }
    var prof = proficientSkills(doc);
    var from = (choice.from || prof).filter(function (s) { return prof.indexOf(s) >= 0 && others.indexOf(s) < 0; });
    return { count: choice.count, from: from };
  }

  function languageOptions(doc) {
    var L = Api().rules().languages;
    var cls = Api().getClass(doc.choices.classId);
    var known = ['common'];
    if (cls && cls.knownLanguages) {
      cls.knownLanguages.forEach(function (n) {
        var lang = L.standard.concat(L.rare).find(function (l) { return l.name === n; });
        if (lang) known.push(lang.id);
      });
    }
    var extra = cls && cls.extraLanguages ? cls.extraLanguages : 0;
    return {
      known: known,
      count: 2,
      from: L.standard.map(function (l) { return l.id; }).filter(function (id) { return known.indexOf(id) < 0; }),
      extra: extra
        ? {
          count: extra,
          source: cls.name,
          from: L.standard.concat(L.rare).map(function (l) { return l.id; }).filter(function (id) {
            return known.indexOf(id) < 0 && (doc.choices.languages || []).indexOf(id) < 0;
          }),
        }
        : null,
    };
  }

  function skilledPickOptions(doc, slotKey) {
    var skills = skillSources(doc, slotKey);
    var tools = toolSources(doc, slotKey);
    return {
      count: 3,
      skills: Api().rules().skills.map(function (s) { return s.id; }).filter(function (s) { return !skills[s]; }),
      tools: Api().rules().tools.map(function (t) { return t.id; }).filter(function (t) { return !tools[t]; }),
    };
  }

  // ---------------------------------------------------------------------------
  // Weapons
  // ---------------------------------------------------------------------------
  function weaponProficient(doc, weapon) {
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    if (!cls || !weapon) return false;
    var p = cls.proficiencies.weapons;
    if (weapon.category === 'simple' && p.simple) return true;
    if (weapon.category === 'martial') {
      if (p.martial) return true;
      if (cls.id === 'cleric' && c.classOptions && c.classOptions.divineOrder === 'protector') return true;
      if (p.martialFinesseOrLight && (weapon.finesse || weapon.light)) return true;
    }
    return false;
  }

  function weaponMasteryOptions(doc) {
    var cls = Api().getClass(doc.choices.classId);
    if (!cls || !cls.weaponMastery) return null;
    var count = cls.weaponMastery.column ? cls.levels[level(doc)].weaponMastery : cls.weaponMastery.count;
    var all = Object.values(Api().rules().weapons);
    var from = all.filter(function (w) {
      return cls.weaponMastery.eligible === 'simple-or-martial' ? true : weaponProficient(doc, w);
    }).map(function (w) { return w.id; });
    return { count: count, from: from };
  }

  // ---------------------------------------------------------------------------
  // Spells
  // ---------------------------------------------------------------------------
  function alwaysPrepared(doc) {
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    var out = [];
    if (cls && c.subclassId && cls.subclass.id === c.subclassId && cls.subclass.alwaysPrepared) {
      Object.keys(cls.subclass.alwaysPrepared).forEach(function (lvl) {
        if (Number(lvl) <= level(doc)) out = out.concat(cls.subclass.alwaysPrepared[lvl]);
      });
    }
    return out;
  }

  function spellOptions(doc) {
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    if (!cls || !cls.spellcasting) return null;
    var lvl = level(doc);
    var entry = cls.levels[lvl];
    var maxLevel = Api().maxSpellLevel(cls.id, lvl);
    var extraCantrips = cls.id === 'cleric' && c.classOptions && c.classOptions.divineOrder === 'thaumaturge' ? 1 : 0;
    var leveled = [];
    for (var s = 1; s <= maxLevel; s++) leveled = leveled.concat(Api().spellIdsForList(cls.id, s));
    var always = alwaysPrepared(doc);
    var spells = c.spells || {};
    var out = {
      ability: cls.spellcasting.ability,
      maxSpellLevel: maxLevel,
      slots: entry.slots,
      cantrips: { count: entry.cantrips + extraCantrips, from: Api().spellIdsForList(cls.id, 0) },
      alwaysPrepared: always,
      spellbook: null,
      spellMastery: null,
      signature: null,
    };
    if (cls.spellcasting.spellbook) {
      var sb = cls.spellcasting.spellbook;
      out.spellbook = { count: sb.initial + sb.perLevel * (lvl - 1), from: leveled, limits: spellbookLimits(cls, lvl) };
      var book = spells.spellbook || [];
      if (cls.spellMastery && lvl >= cls.spellMastery.level) {
        out.spellMastery = {
          levels: cls.spellMastery.spellLevels,
          from: book.filter(function (id) {
            var sp = Api().getSpell(id);
            return sp && cls.spellMastery.spellLevels.indexOf(sp.level) >= 0 && sp.castingTime === cls.spellMastery.castingTime;
          }),
        };
      }
      if (cls.signatureSpells && lvl >= cls.signatureSpells.level) {
        out.signature = {
          count: cls.signatureSpells.count,
          from: book.filter(function (id) {
            var sp = Api().getSpell(id);
            return sp && sp.level === cls.signatureSpells.spellLevel;
          }),
        };
      }
      var fixed = (spells.spellMastery || []).concat(spells.signature || []);
      out.prepared = {
        count: entry.preparedSpells,
        from: book.filter(function (id) { return fixed.indexOf(id) < 0; }),
      };
    } else {
      out.prepared = {
        count: entry.preparedSpells,
        from: leveled.filter(function (id) { return always.indexOf(id) < 0; }),
      };
    }
    return out;
  }

  /**
   * A Wizard adds two spells per level, each of a level they had slots for when they gained it.
   * For each spell level k, at most `max` spellbook spells may be of level k or higher.
   */
  function spellbookLimits(cls, lvl) {
    var limits = [];
    for (var k = 2; k <= 9; k++) {
      var first = null;
      for (var L = 1; L <= lvl; L++) {
        if (cls.levels[L].slots[k - 1] > 0) {
          first = L;
          break;
        }
      }
      if (first === null) continue;
      limits.push({ spellLevel: k, max: cls.spellcasting.spellbook.perLevel * (lvl - first + 1) });
    }
    return limits;
  }

  /** Cantrip and level 1 options for a Magic Initiate instance. */
  function magicInitiateSpellOptions(listId) {
    return {
      cantrips: { count: 2, from: Api().spellIdsForList(listId, 0) },
      spell1: { from: Api().spellIdsForList(listId, 1) },
    };
  }

  global.FogCharacterOptions = {
    ABILITIES: ABILITIES,
    SPELL_LISTS: SPELL_LISTS,
    defaultChoices: defaultChoices,
    stepsFor: stepsFor,
    classChoices: classChoices,
    subclassAvailable: subclassAvailable,
    featSlots: featSlots,
    slotByKey: slotByKey,
    allowedFeats: allowedFeats,
    magicInitiateLists: magicInitiateLists,
    magicInitiateSpellOptions: magicInitiateSpellOptions,
    featIncreaseRule: featIncreaseRule,
    backgroundIncreases: backgroundIncreases,
    abilityScores: abilityScores,
    skillSources: skillSources,
    toolSources: toolSources,
    toolIdByName: toolIdByName,
    classSkillOptions: classSkillOptions,
    proficientSkills: proficientSkills,
    expertiseOptions: expertiseOptions,
    languageOptions: languageOptions,
    skilledPickOptions: skilledPickOptions,
    weaponProficient: weaponProficient,
    weaponMasteryOptions: weaponMasteryOptions,
    alwaysPrepared: alwaysPrepared,
    spellOptions: spellOptions,
  };
})(window);
