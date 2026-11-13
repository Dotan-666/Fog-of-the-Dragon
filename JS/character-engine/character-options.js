/**
 * Character options: what each choice may contain, given the character's other choices.
 * Shared by validation, sanitizing (dependent-choice pruning), derivation and the creator UI.
 * Everything here is computed from the rules data; the UI never decides what is legal.
 */
(function (global) {
  'use strict';

  var Api = function () {
    return global.FogRulesApi;
  };

  var ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var SPELL_LISTS = ['cleric', 'druid', 'wizard']; // Magic Initiate lists (SRD 5.2.1)

  /** Wizard step on which each kind of class choice is made. */
  var CHOICE_STEP = {
    option: 'class',
    skills: 'proficiencies',
    tools: 'proficiencies',
    languages: 'proficiencies',
    expertise: 'proficiencies',
    spells: 'spells',
    'multi-option': 'features',
    invocations: 'features',
  };

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
      spells: emptySpells(),
    };
  }

  function emptySpells() {
    return { cantrips: [], prepared: [], spellbook: [], spellMastery: [], signature: [], arcanum: {}, tome: { cantrips: [], rituals: [] } };
  }

  function level(doc) {
    return (doc.choices && doc.choices.level) || 1;
  }

  // ---------------------------------------------------------------------------
  // Backgrounds: the 4 SRD backgrounds, or a custom one built with the SRD's
  // "Parts of a Background" structure (3 abilities, 1 Origin feat, 2 skills, 1 tool,
  // 50 GP of equipment). Custom backgrounds are homebrew: the GM should approve them.
  // ---------------------------------------------------------------------------
  var CUSTOM_BACKGROUND = 'custom';
  var CUSTOM_BACKGROUND_GP = 50;

  function customBackground(cb) {
    cb = cb || {};
    var tool = cb.toolId ? Api().getTool(cb.toolId) : null;
    var feat = cb.featId ? Api().getFeat(cb.featId) : null;
    return {
      id: CUSTOM_BACKGROUND,
      custom: true,
      name: (typeof cb.name === 'string' && cb.name.trim()) || 'Custom background',
      abilities: Array.isArray(cb.abilities) ? cb.abilities.slice() : [],
      feat: { id: feat ? feat.id : null },
      skills: Array.isArray(cb.skills) ? cb.skills.slice() : [],
      tool: tool ? { name: tool.name } : { text: 'Choose one tool' },
      equipmentText: CUSTOM_BACKGROUND_GP + ' GP to spend on equipment',
      equipmentOptions: [{ id: 'B', label: CUSTOM_BACKGROUND_GP + ' GP', items: [], gp: CUSTOM_BACKGROUND_GP }],
    };
  }

  /** The character's background object (SRD or custom), or null. Use this instead of getBackground. */
  function backgroundOf(doc) {
    var c = doc.choices || {};
    if (c.backgroundId === CUSTOM_BACKGROUND) return customBackground(c.customBackground);
    return Api().getBackground(c.backgroundId);
  }

  function uniq(list) {
    return list.filter(function (x, i) { return list.indexOf(x) === i; });
  }

  // ---------------------------------------------------------------------------
  // Subclass and class choices available at the current level
  // ---------------------------------------------------------------------------
  function subclassAvailable(doc) {
    var cls = Api().getClass(doc.choices.classId);
    return !!cls && level(doc) >= cls.subclassLevel;
  }

  function currentSubclass(doc) {
    return Api().getSubclass(doc.choices.classId, doc.choices.subclassId);
  }

  /** Every class + subclass choice (any type) the character has at its level. */
  function allClassChoices(doc) {
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    if (!cls) return [];
    var sub = currentSubclass(doc);
    var list = (cls.choices || []).filter(function (ch) {
      return !ch.subclass || (sub && sub.id === cls.subclass.id);
    });
    if (sub && sub !== cls.subclass && sub.choices) {
      list = list.concat(sub.choices.map(function (ch) { return Object.assign({ subclass: true }, ch); }));
    }
    return list.filter(function (ch) { return ch.level <= level(doc); });
  }

  /** Class choices made directly (feat-type choices are feat slots instead). */
  function classChoices(doc) {
    return allClassChoices(doc).filter(function (ch) { return ch.type !== 'feat'; });
  }

  function choicesForStep(doc, step) {
    return classChoices(doc).filter(function (ch) { return CHOICE_STEP[ch.type] === step; });
  }

  function pickedOption(doc, ch) {
    var id = (doc.choices.classOptions || {})[ch.id];
    return ch.options ? ch.options.find(function (o) { return o.id === id; }) || null : null;
  }

  /** Benefits granted by picked class options (Divine Order, Primal Order). */
  function optionGrants(doc) {
    var g = {};
    classChoices(doc).forEach(function (ch) {
      if (ch.type !== 'option') return;
      var o = pickedOption(doc, ch);
      if (o && o.grants) Object.assign(g, o.grants);
    });
    return g;
  }

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------
  function stepsFor(doc) {
    var steps = ['level', 'class', 'background', 'species', 'abilities', 'proficiencies', 'feats', 'equipment'];
    if (Api().isSpellcaster(doc.choices.classId)) steps.push('spells');
    if (choicesForStep(doc, 'features').length) steps.push('features');
    steps.push('details', 'review', 'guide');
    return steps;
  }

  // ---------------------------------------------------------------------------
  // Feat slots
  // ---------------------------------------------------------------------------
  function featSlots(doc) {
    var c = doc.choices;
    var slots = [];
    var bg = backgroundOf(doc);
    if (bg && bg.feat.id) {
      slots.push({ key: 'background', label: bg.name + ' background feat', source: bg.name, fixedFeatId: bg.feat.id, fixedSpellList: bg.feat.spellList, step: 'feats' });
    }
    var sp = Api().getSpecies(c.speciesId);
    if (sp && sp.choices.some(function (ch) { return ch.id === 'feat'; })) {
      slots.push({ key: 'species', label: sp.name + ': Versatile (Origin feat)', source: sp.name, categories: ['origin'], step: 'feats' });
    }
    var cls = Api().getClass(c.classId);
    if (cls) {
      allClassChoices(doc).forEach(function (ch) {
        if (ch.type !== 'feat') return;
        slots.push({
          key: 'class-' + ch.id, label: ch.label + ' (' + cls.name + ' ' + ch.level + ')', source: cls.name,
          categories: [ch.featCategory], level: ch.level, alternative: ch.alternative ? ch.alternative.id : null, step: 'feats',
        });
      });
      cls.featLevels.forEach(function (fl) {
        if (fl.level > level(doc)) return;
        slots.push({
          key: 'level-' + fl.level,
          label: (fl.kind === 'epic-boon' ? 'Epic Boon' : 'Ability Score Improvement') + ' (' + cls.name + ' ' + fl.level + ')',
          source: cls.name,
          kind: fl.kind,
          level: fl.level,
          step: 'feats',
        });
      });
      // Lessons of the First Ones (Warlock invocation): one Origin feat per instance.
      var n = 0;
      invocationList(doc).forEach(function (inst) {
        var inv = Api().getInvocation(inst.id);
        if (!inv || !inv.pick || inv.pick.type !== 'feat') return;
        n += 1;
        slots.push({
          key: 'lessons-' + n, label: inv.name + (n > 1 ? ' #' + n : '') + ' (Origin feat)', source: inv.name,
          categories: [inv.pick.featCategory], level: inv.minLevel, step: 'features',
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

  /** Why a feat can't be taken in a slot (null when it can). Prerequisites come from the SRD feat text. */
  function featBlockReason(doc, slot, f, scores) {
    var c = doc.choices;
    if (f.minLevel && f.minLevel > level(doc)) return 'Requires level ' + f.minLevel + '+';
    if (f.id === 'grappler' && !(scores.str >= 13 || scores.dex >= 13)) return 'Requires Strength or Dexterity 13+';
    if (/Spellcasting Feature/.test(f.prerequisite || '') && !Api().hasFeature(c.classId, level(doc), 'Spellcasting')) return 'Requires the Spellcasting feature';
    if (f.category === 'fighting-style' && !f.alternative && !hasFightingStyleFeature(doc)) return 'Requires the Fighting Style feature';
    var taken = featTakenElsewhere(doc, f.id, slot.key);
    if (taken.length && !f.repeatable) return 'Already taken';
    if (f.id === 'magic-initiate' && taken.length >= SPELL_LISTS.length) return 'Already taken for every spell list';
    return null;
  }

  function hasFightingStyleFeature(doc) {
    return allClassChoices(doc).some(function (ch) { return ch.type === 'feat' && ch.featCategory === 'fighting-style'; });
  }

  function slotCategories(doc, slot) {
    if (slot.categories) return slot.categories;
    var cats = ['general', 'origin'];
    if (hasFightingStyleFeature(doc)) cats.push('fighting-style');
    if (slot.kind === 'epic-boon') cats.push('epic-boon');
    return cats;
  }

  function allowedFeats(doc, slot) {
    if (slot.fixedFeatId) return [Api().getFeat(slot.fixedFeatId)];
    var categories = slotCategories(doc, slot);
    var scores = abilityScores(doc, slot.key).scores;
    var list = Api().listFeats().filter(function (f) {
      return categories.indexOf(f.category) >= 0 && !featBlockReason(doc, slot, f, scores);
    });
    if (slot.alternative) list.push(Api().getFeat(slot.alternative));
    return list;
  }

  /** Feats in the slot's categories that the character can't take yet, with the reason (for the UI). */
  function blockedFeats(doc, slot) {
    if (slot.fixedFeatId) return [];
    var categories = slotCategories(doc, slot);
    var scores = abilityScores(doc, slot.key).scores;
    var out = [];
    Api().listFeats().forEach(function (f) {
      if (categories.indexOf(f.category) < 0) return;
      var why = featBlockReason(doc, slot, f, scores);
      if (why) out.push({ feat: f, reason: why });
    });
    return out;
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
    var bg = backgroundOf(doc);
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
   * Scores after base + background + feats (in slot order) + level 20 class capstones.
   * `stopBeforeSlot` returns the scores a feat in that slot sees (used for prerequisites).
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
    var bg = backgroundOf(doc);
    Object.keys(bgInc).forEach(function (a) {
      var next = Math.min(20, scores[a] + bgInc[a]);
      if (scores[a] + bgInc[a] > 20) overCap.push({ ability: a, source: 'Background' });
      breakdown[a].push({ source: bg.name + ' background', value: next - scores[a] });
      scores[a] = next;
    });
    var slots = featSlots(doc);
    var stopped = false;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (slot.key === stopBeforeSlot) {
        stopped = true;
        break;
      }
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
    var cls = Api().getClass(c.classId);
    var cap = cls && cls.capstoneIncrease;
    if (!stopped && cap && level(doc) >= cap.level) {
      cap.abilities.forEach(function (a) {
        var next = Math.min(cap.max, scores[a] + cap.amount);
        if (next > scores[a]) breakdown[a].push({ source: cap.source, value: next - scores[a] });
        scores[a] = Math.max(scores[a], next);
      });
    }
    return { scores: scores, breakdown: breakdown, overCap: overCap };
  }

  // ---------------------------------------------------------------------------
  // Skills, tools, languages
  // ---------------------------------------------------------------------------
  /**
   * Skill proficiencies from every source except `except` ('class' | 'background' | 'species' |
   * a feat slot key | 'choice:<id>'). The base class skill pick ignores later class choices, so
   * an extra skill choice never takes a skill away from the level 1 picks.
   */
  function skillSources(doc, except) {
    var c = doc.choices;
    var map = {};
    function add(id, src) {
      if (!id) return;
      (map[id] = map[id] || []).push(src);
    }
    var bg = backgroundOf(doc);
    if (bg && except !== 'background') bg.skills.forEach(function (s) { add(s, bg.name); });
    var sp = Api().getSpecies(c.speciesId);
    if (sp && except !== 'species' && c.speciesOptions && c.speciesOptions.skill) add(c.speciesOptions.skill, sp.name);
    if (except !== 'class') (c.skillProficiencies || []).forEach(function (s) { add(s, 'Class'); });
    if (except !== 'class') {
      classChoices(doc).forEach(function (ch) {
        if (ch.type !== 'skills' || except === 'choice:' + ch.id) return;
        ((c.classOptions || {})[ch.id] || []).forEach(function (s) { add(s, ch.label); });
      });
    }
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
    var bg = backgroundOf(doc);
    if (bg && except !== 'background') {
      if (bg.tool.name) add(toolIdByName(bg.tool.name), bg.name);
      else if (c.backgroundTool) add(c.backgroundTool, bg.name);
    }
    var cls = Api().getClass(c.classId);
    if (cls && cls.proficiencies) cls.proficiencies.tools.forEach(function (t) { add(toolIdByName(t), cls.name); });
    classChoices(doc).forEach(function (ch) {
      if (ch.type !== 'tools' || except === 'choice:' + ch.id) return;
      ((c.classOptions || {})[ch.id] || []).forEach(function (t) { add(t, ch.label); });
    });
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

  function allLanguageIds() {
    var L = Api().rules().languages;
    return L.standard.concat(L.rare).map(function (l) { return l.id; });
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
          from: allLanguageIds().filter(function (id) {
            return known.indexOf(id) < 0 && (doc.choices.languages || []).indexOf(id) < 0;
          }),
        }
        : null,
    };
  }

  /** Every language the character knows, in order: fixed, chosen, class extras, class language choices. */
  function knownLanguages(doc) {
    var c = doc.choices;
    var lo = languageOptions(doc);
    var out = lo.known.concat(c.languages || []);
    if (c.classOptions && c.classOptions.extraLanguage) out.push(c.classOptions.extraLanguage);
    classChoices(doc).forEach(function (ch) {
      if (ch.type === 'languages') out = out.concat((c.classOptions || {})[ch.id] || []);
    });
    return uniq(out);
  }

  /**
   * Options for a list-type class choice (skills, tools, languages, expertise, spells, multi-option):
   * { count, from }. `from` already excludes what other sources give.
   */
  function choiceOptions(doc, ch) {
    var c = doc.choices;
    switch (ch.type) {
      case 'expertise':
        return expertiseOptions(doc, ch);
      case 'skills': {
        var granted = skillSources(doc, 'choice:' + ch.id);
        return { count: ch.count, from: ch.from.filter(function (s) { return !granted[s]; }) };
      }
      case 'tools': {
        var have = toolSources(doc, 'choice:' + ch.id);
        return {
          count: ch.count,
          from: Api().rules().tools.filter(function (t) { return ch.families.indexOf(t.family) >= 0 && !have[t.id]; }).map(function (t) { return t.id; }),
        };
      }
      case 'languages': {
        var mine = languageOptions(doc).known.concat(c.languages || []);
        if (c.classOptions && c.classOptions.extraLanguage) mine.push(c.classOptions.extraLanguage);
        classChoices(doc).forEach(function (o) {
          if (o.type === 'languages' && o.id !== ch.id) mine = mine.concat((c.classOptions || {})[o.id] || []);
        });
        return { count: ch.count, from: allLanguageIds().filter(function (id) { return mine.indexOf(id) < 0; }) };
      }
      case 'spells': {
        var max = Api().maxSpellLevel(c.classId, level(doc));
        var fixed = alwaysPrepared(doc, ch.id);
        var from = [];
        ch.lists.forEach(function (list) {
          for (var s = 0; s <= max; s++) from = from.concat(Api().spellIdsForList(list, s));
        });
        return { count: ch.count, from: uniq(from).filter(function (id) { return fixed.indexOf(id) < 0; }) };
      }
      case 'multi-option': {
        var count = 0;
        Object.keys(ch.counts).forEach(function (l) { if (Number(l) <= level(doc)) count = ch.counts[l]; });
        var pool = ch.optionsFrom === 'metamagic' ? Api().listMetamagic() : [];
        return { count: count, from: pool.map(function (o) { return o.id; }) };
      }
      default:
        return null;
    }
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
  // Armor and weapons
  // ---------------------------------------------------------------------------
  function armorTraining(doc) {
    var cls = Api().getClass(doc.choices.classId);
    var t = Object.assign({}, cls ? cls.proficiencies.armor : {});
    var g = optionGrants(doc);
    if (g.heavyArmor) t.heavy = true;
    if (g.mediumArmor) t.medium = true;
    return t;
  }

  function weaponProficient(doc, weapon) {
    var cls = Api().getClass(doc.choices.classId);
    if (!cls || !weapon) return false;
    var p = cls.proficiencies.weapons;
    if (weapon.category === 'simple' && p.simple) return true;
    if (weapon.category === 'martial') {
      if (p.martial || optionGrants(doc).martialWeapons) return true;
      if (p.martialFinesseOrLight && (weapon.finesse || weapon.light)) return true;
      if (p.martialLight && weapon.light) return true;
    }
    return false;
  }

  function weaponMasteryOptions(doc) {
    var cls = Api().getClass(doc.choices.classId);
    if (!cls || !cls.weaponMastery) return null;
    var count = cls.weaponMastery.column ? cls.levels[level(doc)].weaponMastery : cls.weaponMastery.count;
    var all = Object.values(Api().rules().weapons);
    var eligible = cls.weaponMastery.eligible;
    var from = all.filter(function (w) {
      if (eligible === 'simple-or-martial') return true;
      if (eligible === 'melee') return w.kind === 'melee';
      return weaponProficient(doc, w);
    }).map(function (w) { return w.id; });
    return { count: count, from: from };
  }

  /** Monk Martial Arts weapons: Simple Melee weapons and Martial Melee weapons with the Light property. */
  function isMonkWeapon(weapon) {
    return !!weapon && weapon.kind === 'melee' && (weapon.category === 'simple' || (weapon.category === 'martial' && weapon.light));
  }

  // ---------------------------------------------------------------------------
  // Eldritch Invocations
  // ---------------------------------------------------------------------------
  function invocationChoice(doc) {
    return classChoices(doc).find(function (ch) { return ch.type === 'invocations'; }) || null;
  }

  function invocationList(doc) {
    var list = (doc.choices.classOptions || {}).invocations;
    return Array.isArray(list) ? list : [];
  }

  function invocationCount(doc) {
    var ch = invocationChoice(doc);
    if (!ch) return 0;
    var entry = Api().levelEntry(doc.choices.classId, level(doc));
    return (entry && entry[ch.column]) || 0;
  }

  function hasInvocation(doc, id, exceptIndex) {
    return invocationList(doc).some(function (x, i) { return i !== exceptIndex && x.id === id; });
  }

  /** Warlock cantrips the character knows: class cantrips plus Book of Shadows cantrips ("function as Warlock spells"). */
  function knownWarlockCantrips(doc) {
    var s = doc.choices.spells || {};
    var out = (s.cantrips || []).slice();
    if (hasInvocation(doc, 'pact-of-the-tome', -1)) out = out.concat((s.tome && s.tome.cantrips) || []);
    return uniq(out);
  }

  /** Cantrips an invocation instance may target (Agonizing Blast, Eldritch Spear, Repelling Blast). */
  function invocationCantripOptions(doc, inv, index) {
    if (!inv.pick || inv.pick.type !== 'cantrip') return [];
    var usedByOthers = invocationList(doc).filter(function (x, i) { return i !== index && x.id === inv.id; }).map(function (x) { return x.cantrip; });
    return knownWarlockCantrips(doc).filter(function (id) {
      var sp = Api().getSpell(id);
      if (!sp || sp.level !== 0 || !sp.dealsDamage) return false;
      if (inv.requiresCantrip === 'attack' && !sp.attackRoll) return false;
      if ((sp.rangeFeet || 0) < (inv.pick.rangeAtLeast || 0)) return false;
      return usedByOthers.indexOf(id) < 0;
    });
  }

  /** Why an invocation can't be taken as instance `index` (null when it can). */
  function invocationBlockReason(doc, inv, index) {
    if (inv.minLevel > level(doc)) return 'Requires Warlock level ' + inv.minLevel + '+';
    if (inv.requiresInvocation && !hasInvocation(doc, inv.requiresInvocation, index)) {
      var req = Api().getInvocation(inv.requiresInvocation);
      return 'Requires the ' + (req ? req.name : inv.requiresInvocation) + ' invocation';
    }
    if (!inv.repeatable && hasInvocation(doc, inv.id, index)) return 'Already chosen';
    if (inv.pick && inv.pick.type === 'cantrip' && !invocationCantripOptions(doc, inv, index).length) {
      if (inv.repeatable && hasInvocation(doc, inv.id, index) && !invocationCantripOptions(doc, inv, -1).length) return 'Every eligible cantrip already has it';
      return inv.requiresCantrip === 'attack'
        ? 'Needs a known Warlock cantrip that deals damage with an attack roll'
        : inv.pick.rangeAtLeast ? 'Needs a known Warlock damage cantrip with a range of ' + inv.pick.rangeAtLeast + '+ feet'
          : 'Needs a known Warlock cantrip that deals damage';
    }
    return null;
  }

  function invocationOptions(doc) {
    if (!invocationChoice(doc)) return null;
    var list = invocationList(doc);
    return {
      count: invocationCount(doc),
      picked: list,
      all: Api().listInvocations().map(function (inv) {
        return { invocation: inv, reason: invocationBlockReason(doc, inv, list.length) };
      }),
    };
  }

  function tomeOptions(doc) {
    if (!hasInvocation(doc, 'pact-of-the-tome', -1)) return null;
    var s = doc.choices.spells || {};
    var have = (s.cantrips || []).concat(s.prepared || [], alwaysPrepared(doc));
    var rituals = Api().spellIdsAnyList(1).filter(function (id) {
      var sp = Api().getSpell(id);
      return sp && sp.ritual && have.indexOf(id) < 0;
    });
    return {
      cantrips: { count: 3, from: Api().spellIdsAnyList(0).filter(function (id) { return have.indexOf(id) < 0; }) },
      rituals: { count: 2, from: rituals },
    };
  }

  // ---------------------------------------------------------------------------
  // Spells
  // ---------------------------------------------------------------------------
  function byLevelUpTo(table, lvl) {
    var out = [];
    Object.keys(table || {}).forEach(function (l) {
      if (Number(l) <= lvl) out = out.concat(table[l]);
    });
    return out;
  }

  /**
   * Spells the character always has prepared from class, subclass and class options
   * (and Magical Discoveries picks). `exceptChoiceId` leaves one choice's own picks out.
   */
  function alwaysPrepared(doc, exceptChoiceId) {
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    if (!cls) return [];
    var lvl = level(doc);
    var out = byLevelUpTo(cls.alwaysPrepared, lvl);
    var sub = currentSubclass(doc);
    if (sub && subclassAvailable(doc)) out = out.concat(byLevelUpTo(sub.alwaysPrepared, lvl));
    classChoices(doc).forEach(function (ch) {
      if (ch.type === 'option') {
        var o = pickedOption(doc, ch);
        if (o && o.alwaysPrepared) out = out.concat(byLevelUpTo(o.alwaysPrepared, lvl));
      } else if (ch.type === 'spells' && ch.alwaysPrepared && ch.id !== exceptChoiceId) {
        out = out.concat((c.classOptions || {})[ch.id] || []);
      }
    });
    return uniq(out);
  }

  function spellOptions(doc) {
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    if (!cls || !cls.spellcasting) return null;
    var lvl = level(doc);
    var entry = cls.levels[lvl];
    var maxLevel = Api().maxSpellLevel(cls.id, lvl);
    var extraCantrips = optionGrants(doc).extraCantrips || 0;
    var lists = cls.magicalSecrets && lvl >= cls.magicalSecrets.level ? cls.magicalSecrets.lists : [cls.id];
    var leveled = [];
    lists.forEach(function (list) {
      for (var s = 1; s <= maxLevel; s++) leveled = leveled.concat(Api().spellIdsForList(list, s));
    });
    leveled = uniq(leveled);
    var always = alwaysPrepared(doc);
    var spells = c.spells || {};
    var out = {
      ability: cls.spellcasting.ability,
      casterType: cls.spellcasting.type,
      maxSpellLevel: maxLevel,
      slots: Api().slotsAt(cls.id, lvl),
      pact: entry.pactSlots ? { count: entry.pactSlots, level: entry.pactSlotLevel } : null,
      lists: lists,
      cantrips: {
        count: (entry.cantrips || 0) + extraCantrips,
        from: Api().spellIdsForList(cls.id, 0).filter(function (id) { return always.indexOf(id) < 0; }),
      },
      alwaysPrepared: always,
      spellbook: null,
      spellMastery: null,
      signature: null,
      arcanum: [],
    };
    if (cls.mysticArcanum) {
      Object.keys(cls.mysticArcanum).forEach(function (l) {
        if (Number(l) > lvl) return;
        var sl = cls.mysticArcanum[l];
        out.arcanum.push({ spellLevel: sl, gainedAt: Number(l), from: Api().spellIdsForList(cls.id, sl) });
      });
    }
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
        count: entry.preparedSpells || 0,
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

  /** Cantrip options for a Fighting Style replacement (Blessed Warrior, Druidic Warrior). */
  function alternativeCantripOptions(featId) {
    var f = Api().getFeat(featId);
    if (!f || !f.alternative) return null;
    return { count: f.cantripCount, from: Api().spellIdsForList(f.cantripList, 0), ability: f.spellAbility, list: f.cantripList };
  }

  global.FogCharacterOptions = {
    ABILITIES: ABILITIES,
    SPELL_LISTS: SPELL_LISTS,
    CHOICE_STEP: CHOICE_STEP,
    defaultChoices: defaultChoices,
    CUSTOM_BACKGROUND: CUSTOM_BACKGROUND,
    backgroundOf: backgroundOf,
    customBackground: customBackground,
    emptySpells: emptySpells,
    stepsFor: stepsFor,
    allClassChoices: allClassChoices,
    classChoices: classChoices,
    choicesForStep: choicesForStep,
    choiceOptions: choiceOptions,
    pickedOption: pickedOption,
    optionGrants: optionGrants,
    subclassAvailable: subclassAvailable,
    currentSubclass: currentSubclass,
    featSlots: featSlots,
    slotByKey: slotByKey,
    allowedFeats: allowedFeats,
    blockedFeats: blockedFeats,
    magicInitiateLists: magicInitiateLists,
    magicInitiateSpellOptions: magicInitiateSpellOptions,
    alternativeCantripOptions: alternativeCantripOptions,
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
    knownLanguages: knownLanguages,
    skilledPickOptions: skilledPickOptions,
    armorTraining: armorTraining,
    weaponProficient: weaponProficient,
    weaponMasteryOptions: weaponMasteryOptions,
    isMonkWeapon: isMonkWeapon,
    invocationList: invocationList,
    invocationCount: invocationCount,
    invocationOptions: invocationOptions,
    invocationBlockReason: invocationBlockReason,
    invocationCantripOptions: invocationCantripOptions,
    knownWarlockCantrips: knownWarlockCantrips,
    tomeOptions: tomeOptions,
    alwaysPrepared: alwaysPrepared,
    spellOptions: spellOptions,
  };
})(window);
