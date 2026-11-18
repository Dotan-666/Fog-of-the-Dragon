/**
 * Character validation (creation + completion) and dependent-choice sanitizing.
 * Legality is decided here and in character-options.js only, never in the UI or by AI.
 */
(function (global) {
  'use strict';

  var Api = function () {
    return global.FogRulesApi;
  };
  var Opt = function () {
    return global.FogCharacterOptions;
  };

  function nameOf(kind, id) {
    var a = Api();
    var x = kind === 'skill' ? a.getSkill(id) : kind === 'spell' ? a.getSpell(id) : kind === 'feat' ? a.getFeat(id)
      : kind === 'weapon' ? a.getWeapon(id) : kind === 'language' ? a.getLanguage(id) : kind === 'tool' ? a.getTool(id)
        : kind === 'invocation' ? a.getInvocation(id) : kind === 'metamagic' ? a.getMetamagic(id) : null;
    return x ? x.name : id;
  }

  /** Kind of item a list-type class choice holds (for names in messages). */
  function kindOfChoice(ch) {
    return ch.type === 'skills' || ch.type === 'expertise' ? 'skill' : ch.type === 'tools' ? 'tool' : ch.type === 'languages' ? 'language'
      : ch.type === 'spells' ? 'spell' : ch.type === 'multi-option' ? 'metamagic' : null;
  }

  function abilityName(ab) {
    return Api().rules().abilityNames[ab] || ab;
  }

  function err(field, message) {
    return { field: field, message: message };
  }

  function countError(field, picked, count, what) {
    if (picked.length === count) return null;
    return err(field, 'Choose ' + count + ' ' + what + ' (' + picked.length + ' selected).');
  }

  /** Every pick must be allowed and the number must match exactly. */
  function listErrors(field, picked, opts, what, kind) {
    var errors = [];
    picked = picked || [];
    var bad = picked.filter(function (id) { return opts.from.indexOf(id) < 0; });
    if (bad.length) errors.push(err(field, bad.map(function (id) { return nameOf(kind, id); }).join(', ') + ' can\'t be chosen for ' + what + '.'));
    var e = countError(field, picked, opts.count, what);
    if (e) errors.push(e);
    return errors;
  }

  // ---------------------------------------------------------------------------
  // Step validation
  // ---------------------------------------------------------------------------
  function validateAbilityScores(doc) {
    var errors = [];
    var c = doc.choices;
    var methods = Api().rules().abilityMethods;
    var method = methods[c.abilityMethod];
    var base = c.abilityScoresBase || {};
    var abilities = Api().rules().abilities;

    if (!method) return [err('abilityMethod', 'Choose how to generate your ability scores.')];

    abilities.forEach(function (ab) {
      if (typeof base[ab] !== 'number') errors.push(err('abilityScoresBase.' + ab, 'Assign a score to ' + abilityName(ab) + '.'));
    });
    if (errors.length) return errors;

    if (method.id === 'standard-array') {
      var expected = method.scores.slice().sort(function (a, b) { return a - b; });
      var got = abilities.map(function (ab) { return base[ab]; }).sort(function (a, b) { return a - b; });
      if (expected.join() !== got.join()) errors.push(err('abilityScoresBase', 'Use each Standard Array score (' + method.scores.join(', ') + ') exactly once.'));
    } else if (method.id === 'point-buy') {
      var spent = 0;
      abilities.forEach(function (ab) {
        var s = base[ab];
        if (s < method.min || s > method.max) errors.push(err('abilityScoresBase.' + ab, abilityName(ab) + ' must be between ' + method.min + ' and ' + method.max + '.'));
        else spent += method.costs[s];
      });
      if (spent > method.budget) errors.push(err('abilityScoresBase', 'You spent ' + spent + ' of ' + method.budget + ' points.'));
    } else {
      abilities.forEach(function (ab) {
        if (base[ab] < method.min || base[ab] > method.max) errors.push(err('abilityScoresBase.' + ab, abilityName(ab) + ' must be between ' + method.min + ' and ' + method.max + '.'));
      });
    }

    var bg = Opt().backgroundOf(doc);
    var bi = c.backgroundIncrease || {};
    if (!bg) {
      errors.push(err('backgroundIncrease', 'Choose a background first; it determines your ability score increases.'));
    } else if (bi.mode === '2-1') {
      if (!bi.plus2 || !bi.plus1 || bi.plus2 === bi.plus1) errors.push(err('backgroundIncrease', 'Choose one ability for +2 and a different one for +1.'));
      else if (bg.abilities.indexOf(bi.plus2) < 0 || bg.abilities.indexOf(bi.plus1) < 0) errors.push(err('backgroundIncrease', 'Background increases must use ' + bg.abilities.map(abilityName).join(', ') + '.'));
    } else if (bi.mode !== '1-1-1') {
      errors.push(err('backgroundIncrease', 'Choose how to apply your background\'s ability score increases.'));
    }
    Opt().abilityScores(doc).overCap.forEach(function (o) {
      if (o.source === 'Background') errors.push(err('backgroundIncrease', 'The background increase can\'t raise ' + abilityName(o.ability) + ' above 20.'));
    });
    return errors;
  }

  function validateClass(doc) {
    var errors = [];
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    if (!cls) return [err('classId', 'Select a class.')];
    if (Opt().subclassAvailable(doc) && !Api().getSubclass(cls.id, c.subclassId)) {
      errors.push(err('subclassId', 'Select a ' + cls.name + ' subclass (gained at level ' + cls.subclassLevel + ').'));
    }
    Opt().choicesForStep(doc, 'class').forEach(function (ch) {
      if (!Opt().pickedOption(doc, ch)) errors.push(err('classOptions.' + ch.id, 'Choose your ' + ch.label + '.'));
    });
    return errors;
  }

  function validateSpecies(doc) {
    var c = doc.choices;
    var sp = Api().getSpecies(c.speciesId);
    if (!sp) return [err('speciesId', 'Select a species.')];
    var errors = [];
    sp.choices.forEach(function (ch) {
      if (ch.id === 'feat') return; // chosen on the Feats step
      if (ch.required && !(c.speciesOptions || {})[ch.id]) errors.push(err('speciesOptions.' + ch.id, 'Choose your ' + ch.label + '.'));
    });
    return errors;
  }

  function validateBackground(doc) {
    var c = doc.choices;
    var bg = Opt().backgroundOf(doc);
    if (!bg) return [err('backgroundId', 'Select a background.')];
    if (bg.custom) return validateCustomBackground(c.customBackground || {});
    if (bg.tool.choose && !c.backgroundTool) return [err('backgroundTool', 'Choose the kind of Gaming Set you are proficient with.')];
    return [];
  }

  /** Custom background = the SRD "Parts of a Background": 3 abilities, an Origin feat, 2 skills, 1 tool. */
  function validateCustomBackground(cb) {
    var errors = [];
    var A = Api();
    var abilities = Array.isArray(cb.abilities) ? cb.abilities : [];
    var skills = Array.isArray(cb.skills) ? cb.skills : [];
    var name = typeof cb.name === 'string' ? cb.name.trim() : '';
    if (!name || name.length > 40) errors.push(err('customBackground.name', 'Give your background a name (up to 40 characters).'));
    if (abilities.length !== 3 || abilities.some(function (a, i) { return A.rules().abilities.indexOf(a) < 0 || abilities.indexOf(a) !== i; })) {
      errors.push(err('customBackground.abilities', 'Choose 3 different abilities your background can increase (' + abilities.length + ' selected).'));
    }
    var feat = cb.featId && A.getFeat(cb.featId);
    if (!feat || feat.category !== 'origin') errors.push(err('customBackground.featId', 'Choose an Origin feat.'));
    if (skills.length !== 2 || skills.some(function (s, i) { return !A.getSkill(s) || skills.indexOf(s) !== i; })) {
      errors.push(err('customBackground.skills', 'Choose 2 different skill proficiencies (' + skills.length + ' selected).'));
    }
    if (!cb.toolId || !A.getTool(cb.toolId)) errors.push(err('customBackground.toolId', 'Choose a tool proficiency.'));
    return errors;
  }

  function validateProficiencies(doc) {
    var errors = [];
    var c = doc.choices;
    var o = Opt();
    var cso = o.classSkillOptions(doc);
    if (cso) errors = errors.concat(listErrors('skillProficiencies', c.skillProficiencies, { count: cso.count, from: cso.selectable }, 'class skill proficiencies', 'skill'));
    o.choicesForStep(doc, 'proficiencies').forEach(function (ch) {
      errors = errors.concat(listErrors('classOptions.' + ch.id, (c.classOptions || {})[ch.id], o.choiceOptions(doc, ch), ch.label, kindOfChoice(ch)));
    });
    var lo = o.languageOptions(doc);
    errors = errors.concat(listErrors('languages', c.languages, lo, 'standard languages', 'language'));
    if (lo.extra && !(c.classOptions || {}).extraLanguage) errors.push(err('classOptions.extraLanguage', 'Choose the extra language from ' + lo.extra.source + ' (Thieves\' Cant).'));
    return errors;
  }

  function validateFeatInstance(doc, slot, inst) {
    var errors = [];
    var o = Opt();
    var field = 'feats.' + slot.key;
    if (!inst || !inst.featId) return [err(field, 'Choose a feat for ' + slot.label + '.')];
    var feat = Api().getFeat(inst.featId);
    var allowed = o.allowedFeats(doc, slot).map(function (f) { return f.id; });
    if (!feat || allowed.indexOf(feat.id) < 0) return [err(field, nameOf('feat', inst.featId) + ' isn\'t available for ' + slot.label + '.')];

    var rule = o.featIncreaseRule(feat.id);
    if (rule) {
      var inc = inst.abilityIncrease || {};
      var total = 0;
      var bad = false;
      Object.keys(inc).forEach(function (a) {
        if (!inc[a]) return;
        total += inc[a];
        if (rule.from.indexOf(a) < 0 || inc[a] > rule.perAbility) bad = true;
      });
      if (bad || total !== rule.total) {
        errors.push(err(field, feat.id === 'ability-score-improvement'
          ? slot.label + ': increase one ability by 2, or two abilities by 1.'
          : slot.label + ': choose ' + rule.from.map(abilityName).join(' or ') + ' to increase by 1.'));
      }
      o.abilityScores(doc).overCap.forEach(function (x) {
        if (x.source === feat.name && x.max) errors.push(err(field, feat.name + ' can\'t raise ' + abilityName(x.ability) + ' above ' + x.max + '.'));
      });
    }

    if (feat.id === 'magic-initiate') {
      var lists = o.magicInitiateLists(doc, slot);
      if (lists.indexOf(inst.spellList) < 0) errors.push(err(field, 'Magic Initiate: choose a spell list (' + lists.join(', ') + ').'));
      else {
        var mo = o.magicInitiateSpellOptions(inst.spellList);
        var cs = (inst.cantrips || []).filter(function (id) { return mo.cantrips.from.indexOf(id) >= 0; });
        if (cs.length !== 2) errors.push(err(field, 'Magic Initiate: choose 2 cantrips from the ' + inst.spellList + ' list.'));
        if (!inst.spell1 || mo.spell1.from.indexOf(inst.spell1) < 0) errors.push(err(field, 'Magic Initiate: choose a level 1 ' + inst.spellList + ' spell.'));
      }
      if (['int', 'wis', 'cha'].indexOf(inst.spellAbility) < 0) errors.push(err(field, 'Magic Initiate: choose Intelligence, Wisdom or Charisma as its spellcasting ability.'));
    }

    if (feat.alternative) {
      var ao = o.alternativeCantripOptions(feat.id);
      errors = errors.concat(listErrors(field, inst.cantrips, ao, feat.name + ' cantrips (' + ao.list + ' list)', 'spell'));
    }

    if (feat.id === 'skilled') {
      var po = o.skilledPickOptions(doc, slot.key);
      var picks = (inst.picks || []).filter(function (p) {
        return (p.type === 'skill' && po.skills.indexOf(p.id) >= 0) || (p.type === 'tool' && po.tools.indexOf(p.id) >= 0);
      });
      if (picks.length !== 3) errors.push(err(field, 'Skilled: choose 3 skills or tools (' + picks.length + ' selected).'));
    }
    return errors;
  }

  function validateFeatSlots(doc, step) {
    var errors = [];
    Opt().featSlots(doc).forEach(function (slot) {
      if (slot.step !== step) return;
      errors = errors.concat(validateFeatInstance(doc, slot, (doc.choices.feats || {})[slot.key]));
    });
    return errors;
  }

  function validateEquipment(doc) {
    var errors = [];
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    var bg = Opt().backgroundOf(doc);
    if (cls && !cls.equipmentOptions.some(function (o) { return o.id === c.classEquipment; })) errors.push(err('classEquipment', 'Choose your ' + cls.name + ' starting equipment.'));
    if (bg && !bg.equipmentOptions.some(function (o) { return o.id === c.backgroundEquipment; })) errors.push(err('backgroundEquipment', 'Choose your ' + bg.name + ' background equipment.'));
    var wm = Opt().weaponMasteryOptions(doc);
    if (wm) errors = errors.concat(listErrors('weaponMasteries', c.weaponMasteries, wm, 'kinds of weapons for Weapon Mastery', 'weapon'));
    return errors;
  }

  function validateSpells(doc) {
    var o = Opt();
    var so = o.spellOptions(doc);
    if (!so) return [];
    var errors = [];
    var s = doc.choices.spells || {};
    var e;
    errors = errors.concat(listErrors('spells.cantrips', s.cantrips, so.cantrips, 'cantrips', 'spell'));
    if (so.spellbook) {
      errors = errors.concat(listErrors('spells.spellbook', s.spellbook, so.spellbook, 'spells for your spellbook', 'spell'));
      so.spellbook.limits.forEach(function (lim) {
        var n = (s.spellbook || []).filter(function (id) { var sp = Api().getSpell(id); return sp && sp.level >= lim.spellLevel; }).length;
        if (n > lim.max) {
          errors.push(err('spells.spellbook', 'At this level your spellbook can hold at most ' + lim.max + ' spells of level ' + lim.spellLevel + ' or higher (you have ' + n + '). Wizards add two spells per level, of a level they have slots for.'));
        }
      });
      if (so.spellMastery) {
        var sm = s.spellMastery || [];
        var levels = sm.map(function (id) { return (Api().getSpell(id) || {}).level; }).sort();
        if (sm.length !== 2 || levels.join() !== so.spellMastery.levels.join()) errors.push(err('spells.spellMastery', 'Spell Mastery: choose one level 1 and one level 2 spell from your spellbook with a casting time of an action.'));
      }
      if (so.signature && (e = countError('spells.signature', s.signature || [], so.signature.count, 'level 3 spells as Signature Spells'))) errors.push(e);
    }
    errors = errors.concat(listErrors('spells.prepared', s.prepared, so.prepared, 'prepared spells', 'spell'));
    so.arcanum.forEach(function (arc) {
      var pick = (s.arcanum || {})[arc.spellLevel];
      if (!pick || arc.from.indexOf(pick) < 0) errors.push(err('spells.arcanum.' + arc.spellLevel, 'Mystic Arcanum: choose one level ' + arc.spellLevel + ' Warlock spell.'));
    });
    o.choicesForStep(doc, 'spells').forEach(function (ch) {
      errors = errors.concat(listErrors('classOptions.' + ch.id, (doc.choices.classOptions || {})[ch.id], o.choiceOptions(doc, ch), ch.label, 'spell'));
    });
    return errors;
  }

  function validateFeatures(doc) {
    var o = Opt();
    var c = doc.choices;
    var errors = [];
    o.choicesForStep(doc, 'features').forEach(function (ch) {
      if (ch.type === 'multi-option') {
        errors = errors.concat(listErrors('classOptions.' + ch.id, (c.classOptions || {})[ch.id], o.choiceOptions(doc, ch), ch.label, 'metamagic'));
      }
    });
    var io = o.invocationOptions(doc);
    if (io) {
      var list = o.invocationList(doc);
      if (list.length !== io.count) errors.push(err('classOptions.invocations', 'Choose ' + io.count + ' Eldritch Invocations (' + list.length + ' selected).'));
      list.forEach(function (inst, i) {
        var inv = Api().getInvocation(inst.id);
        if (!inv) {
          errors.push(err('classOptions.invocations', 'Unknown invocation.'));
          return;
        }
        var why = o.invocationBlockReason(doc, inv, i);
        if (why) errors.push(err('classOptions.invocations', inv.name + ': ' + why + '.'));
        else if (inv.pick && inv.pick.type === 'cantrip' && o.invocationCantripOptions(doc, inv, i).indexOf(inst.cantrip) < 0) {
          errors.push(err('classOptions.invocations', inv.name + ': choose the cantrip it improves.'));
        }
      });
      var to = o.tomeOptions(doc);
      if (to) {
        var tome = (c.spells && c.spells.tome) || {};
        errors = errors.concat(listErrors('spells.tome.cantrips', tome.cantrips, to.cantrips, 'Book of Shadows cantrips', 'spell'));
        errors = errors.concat(listErrors('spells.tome.rituals', tome.rituals, to.rituals, 'Book of Shadows level 1 rituals', 'spell'));
      }
    }
    return errors.concat(validateFeatSlots(doc, 'features'));
  }

  function validateStep(doc, stepId) {
    var c = doc.choices || {};
    switch (stepId) {
      case 'level':
        return !c.level || c.level < 1 || c.level > 20 ? [err('level', 'Choose a level between 1 and 20.')] : [];
      case 'class': return validateClass(doc);
      case 'background': return validateBackground(doc);
      case 'species': return validateSpecies(doc);
      case 'abilities': return validateAbilityScores(doc);
      case 'proficiencies': return validateProficiencies(doc);
      case 'feats': return validateFeatSlots(doc, 'feats');
      case 'equipment': return validateEquipment(doc);
      case 'spells': return validateSpells(doc);
      case 'features': return validateFeatures(doc);
      case 'details':
        return !doc.narrative || !doc.narrative.name || !doc.narrative.name.trim() ? [err('narrative.name', 'Enter a character name.')] : [];
      default:
        return [];
    }
  }

  function validateComplete(doc) {
    var errors = [];
    Opt().stepsFor(doc).forEach(function (step) {
      if (step === 'review' || step === 'guide') return;
      validateStep(doc, step).forEach(function (e) {
        e.step = step;
        errors.push(e);
      });
    });
    return errors;
  }

  // ---------------------------------------------------------------------------
  // Sanitizing: keep every choice that is still valid, drop the rest, report what changed
  // ---------------------------------------------------------------------------
  function keepIn(list, allowed, max) {
    var kept = [];
    (Array.isArray(list) ? list : []).forEach(function (id) {
      if (allowed.indexOf(id) >= 0 && kept.indexOf(id) < 0 && (max == null || kept.length < max)) kept.push(id);
    });
    return kept;
  }

  function dropped(before, after) {
    return (Array.isArray(before) ? before : []).filter(function (id) { return after.indexOf(id) < 0; });
  }

  function sanitizeOnce(doc, notices) {
    var c = doc.choices;
    var o = Opt();
    var a = Api();
    var lvl;
    function note(msg) {
      if (notices.indexOf(msg) < 0) notices.push(msg);
    }
    function trimList(list, allowed, max, kind, why) {
      var after = keepIn(list, allowed, max);
      var gone = dropped(list, after);
      if (gone.length) note('Removed ' + gone.map(function (id) { return nameOf(kind, id); }).join(', ') + ' (' + why + ').');
      return after;
    }

    c.level = Math.min(20, Math.max(1, Number(c.level) || 1));
    lvl = c.level;
    var cls = a.getClass(c.classId);
    if (c.classId && !cls) {
      c.classId = null;
      note('Removed an unsupported class.');
    }
    if (c.hpRolls != null) {
      // Recorded Hit Die rolls only count for levels the character has, with the current class's die.
      var keptRolls = {};
      var rollSrc = typeof c.hpRolls === 'object' && !Array.isArray(c.hpRolls) ? c.hpRolls : {};
      Object.keys(rollSrc).forEach(function (k) {
        var r = rollSrc[k];
        var n = Number(k);
        if (cls && Number.isInteger(n) && n >= 2 && n <= lvl && r && r.die === cls.hitDie && Number.isInteger(r.value) && r.value >= 1 && r.value <= r.die) {
          keptRolls[n] = { die: r.die, value: r.value };
        }
      });
      if (Object.keys(keptRolls).length) c.hpRolls = keptRolls;
      else delete c.hpRolls;
    }
    if (c.subclassId && (!cls || !a.getSubclass(cls.id, c.subclassId) || !o.subclassAvailable(doc))) {
      var oldSub = cls && a.getSubclass(cls.id, c.subclassId);
      note('Removed subclass ' + (oldSub ? oldSub.name : '') + (cls ? ' (subclasses start at level ' + cls.subclassLevel + ')' : '') + '.');
      c.subclassId = null;
    }

    // Class options: drop choices that no longer exist; option-type picks must be one of the options
    var available = o.classChoices(doc);
    var opts = c.classOptions && typeof c.classOptions === 'object' ? c.classOptions : {};
    Object.keys(opts).forEach(function (k) {
      if (k === 'extraLanguage') return;
      var ch = available.find(function (x) { return x.id === k; });
      if (!ch) {
        var label = (o.allClassChoices({ choices: Object.assign({}, c, { level: 20 }) }).find(function (x) { return x.id === k; }) || {}).label;
        delete opts[k];
        note('Cleared ' + (label || k) + ' (not available at level ' + lvl + ' with these choices).');
      } else if (ch.type === 'option' && !o.pickedOption({ choices: Object.assign({}, c, { classOptions: opts }) }, ch)) {
        delete opts[k];
      }
    });
    c.classOptions = opts;

    // Background / species sub-choices
    // Custom background: keep only well-formed parts (it exists only while "custom" is chosen)
    if (c.backgroundId === o.CUSTOM_BACKGROUND) {
      var cb = c.customBackground && typeof c.customBackground === 'object' ? c.customBackground : {};
      var uniqIn = function (list, ok, max) {
        return (Array.isArray(list) ? list : []).filter(function (x, i, arr) { return ok(x) && arr.indexOf(x) === i; }).slice(0, max);
      };
      cb.name = typeof cb.name === 'string' ? cb.name.slice(0, 40) : '';
      cb.abilities = uniqIn(cb.abilities, function (x) { return a.rules().abilities.indexOf(x) >= 0; }, 3);
      cb.skills = uniqIn(cb.skills, function (x) { return !!a.getSkill(x); }, 2);
      var cf = cb.featId && a.getFeat(cb.featId);
      if (!cf || cf.category !== 'origin') cb.featId = null;
      if (cb.toolId && !a.getTool(cb.toolId)) cb.toolId = null;
      c.customBackground = cb;
    } else if (c.customBackground) {
      delete c.customBackground;
    }
    var bg = o.backgroundOf(doc);
    if (c.backgroundId && !bg) c.backgroundId = null;
    if (c.backgroundTool) {
      var tool = a.getTool(c.backgroundTool);
      if (!bg || !bg.tool.choose || !tool || tool.family !== bg.tool.choose) c.backgroundTool = null;
    }
    var bi = c.backgroundIncrease || { mode: null };
    if (bg) {
      if (bi.plus2 && bg.abilities.indexOf(bi.plus2) < 0) bi.plus2 = null;
      if (bi.plus1 && bg.abilities.indexOf(bi.plus1) < 0) bi.plus1 = null;
    }
    c.backgroundIncrease = bi;

    var sp = a.getSpecies(c.speciesId);
    if (c.speciesId && !sp) c.speciesId = null;
    var so = c.speciesOptions || {};
    Object.keys(so).forEach(function (k) {
      var ch = sp && sp.choices.find(function (x) { return x.id === k; });
      var ok = ch && (ch.options ? ch.options.some(function (x) { return x.id === so[k]; })
        : ch.abilities ? ch.abilities.indexOf(so[k]) >= 0
          : ch.skills ? ch.skills.indexOf(so[k]) >= 0
            : ch.sizes ? ch.sizes.indexOf(so[k]) >= 0 : false);
      if (!ok) delete so[k];
    });
    c.speciesOptions = so;

    // Class skills (skills granted by background/species can't be picked again)
    var cso = o.classSkillOptions(doc);
    c.skillProficiencies = cso
      ? trimList(c.skillProficiencies, cso.selectable, cso.count, 'skill', 'not a class skill choice or already granted elsewhere')
      : [];

    // Extra skill and tool choices (Primal Knowledge, College of Lore, Musical Instruments, Monk tool)
    available.forEach(function (ch) {
      if (ch.type !== 'skills' && ch.type !== 'tools') return;
      var co = o.choiceOptions(doc, ch);
      c.classOptions[ch.id] = trimList(c.classOptions[ch.id], co.from, co.count, kindOfChoice(ch), ch.label + ': already proficient or not allowed');
    });

    // Feats
    var slots = o.featSlots(doc);
    var feats = c.feats || {};
    Object.keys(feats).forEach(function (key) {
      var slot = slots.find(function (s) { return s.key === key; });
      if (!slot) {
        if (feats[key] && feats[key].featId) note('Removed ' + nameOf('feat', feats[key].featId) + ' (that feat slot isn\'t available any more).');
        delete feats[key];
      }
    });
    slots.forEach(function (slot) {
      var inst = feats[slot.key];
      if (slot.fixedFeatId) {
        if (!inst || inst.featId !== slot.fixedFeatId) inst = feats[slot.key] = { featId: slot.fixedFeatId };
        if (slot.fixedSpellList) inst.spellList = slot.fixedSpellList;
      }
      if (!inst || !inst.featId) return;
      var allowed = o.allowedFeats(doc, slot).map(function (f) { return f.id; });
      if (allowed.indexOf(inst.featId) < 0) {
        note('Removed ' + nameOf('feat', inst.featId) + ' from ' + slot.label + ' (no longer qualifies).');
        delete feats[slot.key];
        return;
      }
      var rule = o.featIncreaseRule(inst.featId);
      if (!rule) delete inst.abilityIncrease;
      else if (inst.abilityIncrease) {
        Object.keys(inst.abilityIncrease).forEach(function (ab) {
          if (rule.from.indexOf(ab) < 0) delete inst.abilityIncrease[ab];
        });
      }
      var feat = a.getFeat(inst.featId);
      if (inst.featId === 'magic-initiate') {
        if (o.magicInitiateLists(doc, slot).indexOf(inst.spellList) < 0) {
          inst.spellList = null;
          inst.cantrips = [];
          inst.spell1 = null;
        } else {
          var mo = o.magicInitiateSpellOptions(inst.spellList);
          inst.cantrips = keepIn(inst.cantrips, mo.cantrips.from, 2);
          if (inst.spell1 && mo.spell1.from.indexOf(inst.spell1) < 0) inst.spell1 = null;
        }
      } else if (feat && feat.alternative) {
        var ao = o.alternativeCantripOptions(feat.id);
        inst.cantrips = keepIn(inst.cantrips, ao.from, ao.count);
        delete inst.spellList;
        delete inst.spell1;
        delete inst.spellAbility;
      } else {
        delete inst.spellList;
        delete inst.cantrips;
        delete inst.spell1;
        delete inst.spellAbility;
      }
      if (inst.featId === 'skilled') {
        var po = o.skilledPickOptions(doc, slot.key);
        var before = inst.picks || [];
        inst.picks = before.filter(function (p, i) {
          var pool = p.type === 'skill' ? po.skills : po.tools;
          return pool.indexOf(p.id) >= 0 && before.findIndex(function (q) { return q.type === p.type && q.id === p.id; }) === i;
        }).slice(0, 3);
        if (inst.picks.length < before.length) note('Skilled: removed picks that are already granted elsewhere.');
      } else {
        delete inst.picks;
      }
    });
    c.feats = feats;

    // Expertise (must be proficient skills)
    o.classChoices(doc).forEach(function (ch) {
      if (ch.type !== 'expertise') return;
      var eo = o.expertiseOptions(doc, ch);
      c.classOptions[ch.id] = trimList(c.classOptions[ch.id], eo.from, ch.count, 'skill', ch.label + ' needs a skill you are proficient in');
    });

    // Languages
    var lo = o.languageOptions(doc);
    c.languages = trimList(c.languages, lo.from, lo.count, 'language', 'not a choosable standard language');
    if (c.classOptions.extraLanguage && (!lo.extra || lo.extra.from.indexOf(c.classOptions.extraLanguage) < 0)) {
      delete c.classOptions.extraLanguage;
    }
    o.classChoices(doc).forEach(function (ch) {
      if (ch.type !== 'languages') return;
      var lc = o.choiceOptions(doc, ch);
      c.classOptions[ch.id] = trimList(c.classOptions[ch.id], lc.from, lc.count, 'language', ch.label + ': already known');
    });

    // Metamagic
    o.classChoices(doc).forEach(function (ch) {
      if (ch.type !== 'multi-option') return;
      var mc = o.choiceOptions(doc, ch);
      c.classOptions[ch.id] = trimList(c.classOptions[ch.id], mc.from, mc.count, 'metamagic', ch.label + ' limit at level ' + lvl);
    });

    // Equipment
    if (c.classEquipment && !(cls && cls.equipmentOptions.some(function (x) { return x.id === c.classEquipment; }))) c.classEquipment = null;
    if (c.backgroundEquipment && !(bg && bg.equipmentOptions.some(function (x) { return x.id === c.backgroundEquipment; }))) c.backgroundEquipment = null;
    // Only one option (custom background: 50 GP): nothing to choose.
    if (bg && bg.equipmentOptions.length === 1 && !c.backgroundEquipment) c.backgroundEquipment = bg.equipmentOptions[0].id;
    var wm = o.weaponMasteryOptions(doc);
    c.weaponMasteries = wm
      ? trimList(c.weaponMasteries, wm.from, wm.count, 'weapon', 'Weapon Mastery limit at level ' + lvl)
      : [];

    // Spells
    var s = c.spells = Object.assign(o.emptySpells(), c.spells || {});
    if (!s.arcanum || typeof s.arcanum !== 'object' || Array.isArray(s.arcanum)) s.arcanum = {};
    if (!s.tome || typeof s.tome !== 'object') s.tome = { cantrips: [], rituals: [] };
    var spo = o.spellOptions(doc);
    if (!spo) {
      if (s.cantrips.length || s.prepared.length || s.spellbook.length) note('Cleared spell selections (the class doesn\'t cast spells).');
      c.spells = o.emptySpells();
    } else {
      s.cantrips = trimList(s.cantrips, spo.cantrips.from, spo.cantrips.count, 'spell', 'cantrip limit at level ' + lvl);
      if (spo.spellbook) {
        s.spellbook = trimList(s.spellbook, spo.spellbook.from, spo.spellbook.count, 'spell', 'spellbook size or spell level at level ' + lvl);
        var after = o.spellOptions(doc);
        s.spellMastery = after.spellMastery ? keepIn(s.spellMastery, after.spellMastery.from, 2) : trimList(s.spellMastery, [], 0, 'spell', 'Spell Mastery starts at level 18');
        s.signature = after.signature ? keepIn(s.signature, after.signature.from, after.signature.count) : trimList(s.signature, [], 0, 'spell', 'Signature Spells start at level 20');
      } else {
        s.spellbook = [];
        s.spellMastery = [];
        s.signature = [];
      }
      var prep = o.spellOptions(doc).prepared;
      s.prepared = trimList(s.prepared, prep.from, prep.count, 'spell', 'prepared spell limit or spell level at level ' + lvl);
      // Mystic Arcanum: one spell per unlocked arcanum level
      var arcByLevel = {};
      spo.arcanum.forEach(function (arc) { arcByLevel[arc.spellLevel] = arc; });
      Object.keys(s.arcanum).forEach(function (k) {
        var arc = arcByLevel[k];
        if (!arc || arc.from.indexOf(s.arcanum[k]) < 0) {
          if (s.arcanum[k]) note('Removed ' + nameOf('spell', s.arcanum[k]) + ' (Mystic Arcanum for level ' + k + ' spells isn\'t available at level ' + lvl + ').');
          delete s.arcanum[k];
        }
      });
      // Spells from class choices (Magical Discoveries)
      o.classChoices(doc).forEach(function (ch) {
        if (ch.type !== 'spells') return;
        var sc = o.choiceOptions(doc, ch);
        c.classOptions[ch.id] = trimList(c.classOptions[ch.id], sc.from, sc.count, 'spell', ch.label + ': spell level or list not allowed');
      });
    }

    // Eldritch Invocations (after spells: some need a known damage cantrip)
    if (c.classOptions.invocations !== undefined) {
      var count = o.invocationCount(doc);
      var list = (Array.isArray(c.classOptions.invocations) ? c.classOptions.invocations : [])
        .map(function (x) { return typeof x === 'string' ? { id: x } : x; })
        .filter(function (x) { return x && a.getInvocation(x.id); });
      var keep = list.map(function (inst, i) {
        var why = o.invocationBlockReason({ choices: Object.assign({}, c, { classOptions: Object.assign({}, c.classOptions, { invocations: list }) }) }, a.getInvocation(inst.id), i);
        if (why) note('Removed invocation ' + nameOf('invocation', inst.id) + ' (' + why.charAt(0).toLowerCase() + why.slice(1) + ').');
        return !why;
      });
      list = list.filter(function (x, i) { return keep[i]; });
      if (list.length > count) {
        note('Removed ' + list.slice(count).map(function (x) { return nameOf('invocation', x.id); }).join(', ') + ' (only ' + count + ' invocations at level ' + lvl + ').');
        list = list.slice(0, count);
      }
      c.classOptions.invocations = list;
      list.forEach(function (inst, i) {
        var inv = a.getInvocation(inst.id);
        if (inv.pick && inv.pick.type === 'cantrip') {
          if (inst.cantrip && o.invocationCantripOptions(doc, inv, i).indexOf(inst.cantrip) < 0) inst.cantrip = null;
        } else {
          delete inst.cantrip;
        }
      });
    }
    var to = o.tomeOptions(doc);
    if (!to) {
      if (c.spells.tome && ((c.spells.tome.cantrips || []).length || (c.spells.tome.rituals || []).length)) note('Cleared Book of Shadows spells (Pact of the Tome isn\'t chosen).');
      c.spells.tome = { cantrips: [], rituals: [] };
    } else {
      c.spells.tome.cantrips = trimList(c.spells.tome.cantrips, to.cantrips.from, to.cantrips.count, 'spell', 'Book of Shadows cantrips must be new to you');
      c.spells.tome.rituals = trimList(c.spells.tome.rituals, to.rituals.from, to.rituals.count, 'spell', 'Book of Shadows needs level 1 Ritual spells you don\'t already have prepared');
    }
  }

  /**
   * Bring every choice in line with the rest of the character. Valid selections are kept as-is.
   * Returns human-readable notices for anything that was removed.
   */
  function sanitizeChoices(doc) {
    var notices = [];
    var before = null;
    for (var i = 0; i < 6; i++) {
      var snapshot = JSON.stringify(doc.choices);
      if (snapshot === before) break;
      before = snapshot;
      sanitizeOnce(doc, notices);
    }
    return notices;
  }

  global.FogValidateCharacter = {
    validateStep: validateStep,
    validateComplete: validateComplete,
    validateFeatInstance: validateFeatInstance,
    sanitizeChoices: sanitizeChoices,
  };
})(window);
