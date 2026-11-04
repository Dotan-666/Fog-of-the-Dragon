/**
 * Character validation (creation + completion) and dependent-choice sanitizing
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
      : kind === 'weapon' ? a.getWeapon(id) : kind === 'language' ? a.getLanguage(id) : kind === 'tool' ? a.getTool(id) : null;
    return x ? x.name : id;
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

    var bg = Api().getBackground(c.backgroundId);
    var bi = c.backgroundIncrease || {};
    if (!bg) {
      errors.push(err('backgroundIncrease', 'Choose a background first; it determines your ability score increases.'));
    } else if (bi.mode === '2-1') {
      if (!bi.plus2 || !bi.plus1 || bi.plus2 === bi.plus1) errors.push(err('backgroundIncrease', 'Choose one ability for +2 and a different one for +1.'));
      else if (bg.abilities.indexOf(bi.plus2) < 0 || bg.abilities.indexOf(bi.plus1) < 0) errors.push(err('backgroundIncrease', 'Background increases must use ' + bg.abilities.map(abilityName).join(', ') + '.'));
    } else if (bi.mode !== '1-1-1') {
      errors.push(err('backgroundIncrease', 'Choose how to apply your background’s ability score increases.'));
    }
    Opt().abilityScores(doc).overCap.forEach(function (o) {
      if (o.source === 'Background') errors.push(err('backgroundIncrease', 'The background increase can’t raise ' + abilityName(o.ability) + ' above 20.'));
    });
    return errors;
  }

  function validateClass(doc) {
    var errors = [];
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    if (!cls) return [err('classId', 'Select a class.')];
    if (Opt().subclassAvailable(doc) && c.subclassId !== cls.subclass.id) {
      errors.push(err('subclassId', 'Select a ' + cls.name + ' subclass (gained at level ' + cls.subclassLevel + ').'));
    }
    Opt().classChoices(doc).forEach(function (ch) {
      if (ch.type === 'option' && !(c.classOptions || {})[ch.id]) errors.push(err('classOptions.' + ch.id, 'Choose your ' + ch.label + '.'));
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
    var bg = Api().getBackground(c.backgroundId);
    if (!bg) return [err('backgroundId', 'Select a background.')];
    if (bg.tool.choose && !c.backgroundTool) return [err('backgroundTool', 'Choose the kind of Gaming Set you are proficient with.')];
    return [];
  }

  function validateProficiencies(doc) {
    var errors = [];
    var c = doc.choices;
    var o = Opt();
    var cso = o.classSkillOptions(doc);
    if (cso) {
      var e = countError('skillProficiencies', c.skillProficiencies || [], cso.count, 'class skill proficiencies');
      if (e) errors.push(e);
    }
    o.classChoices(doc).forEach(function (ch) {
      if (ch.type !== 'expertise') return;
      var picked = (c.classOptions || {})[ch.id] || [];
      var e2 = countError('classOptions.' + ch.id, picked, ch.count, 'skills for ' + ch.label);
      if (e2) errors.push(e2);
    });
    var lo = o.languageOptions(doc);
    var e3 = countError('languages', c.languages || [], lo.count, 'standard languages');
    if (e3) errors.push(e3);
    if (lo.extra && !(c.classOptions || {}).extraLanguage) errors.push(err('classOptions.extraLanguage', 'Choose the extra language from ' + lo.extra.source + ' (Thieves’ Cant).'));
    return errors;
  }

  function validateFeatInstance(doc, slot, inst) {
    var errors = [];
    var o = Opt();
    var field = 'feats.' + slot.key;
    if (!inst || !inst.featId) return [err(field, 'Choose a feat for ' + slot.label + '.')];
    var feat = Api().getFeat(inst.featId);
    var allowed = o.allowedFeats(doc, slot).map(function (f) { return f.id; });
    if (!feat || allowed.indexOf(feat.id) < 0) return [err(field, nameOf('feat', inst.featId) + ' isn’t available for ' + slot.label + '.')];

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
        if (x.source === feat.name && x.max) errors.push(err(field, feat.name + ' can’t raise ' + abilityName(x.ability) + ' above ' + x.max + '.'));
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

    if (feat.id === 'skilled') {
      var po = o.skilledPickOptions(doc, slot.key);
      var picks = (inst.picks || []).filter(function (p) {
        return (p.type === 'skill' && po.skills.indexOf(p.id) >= 0) || (p.type === 'tool' && po.tools.indexOf(p.id) >= 0);
      });
      if (picks.length !== 3) errors.push(err(field, 'Skilled: choose 3 skills or tools (' + picks.length + ' selected).'));
    }
    return errors;
  }

  function validateFeats(doc) {
    var errors = [];
    Opt().featSlots(doc).forEach(function (slot) {
      errors = errors.concat(validateFeatInstance(doc, slot, (doc.choices.feats || {})[slot.key]));
    });
    return errors;
  }

  function validateEquipment(doc) {
    var errors = [];
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    var bg = Api().getBackground(c.backgroundId);
    if (cls && !cls.equipmentOptions.some(function (o) { return o.id === c.classEquipment; })) errors.push(err('classEquipment', 'Choose your ' + cls.name + ' starting equipment.'));
    if (bg && !bg.equipmentOptions.some(function (o) { return o.id === c.backgroundEquipment; })) errors.push(err('backgroundEquipment', 'Choose your ' + bg.name + ' background equipment.'));
    var wm = Opt().weaponMasteryOptions(doc);
    if (wm) {
      var e = countError('weaponMasteries', c.weaponMasteries || [], wm.count, 'kinds of weapons for Weapon Mastery');
      if (e) errors.push(e);
    }
    return errors;
  }

  function validateSpells(doc) {
    var so = Opt().spellOptions(doc);
    if (!so) return [];
    var errors = [];
    var s = doc.choices.spells || {};
    var e;
    if ((e = countError('spells.cantrips', s.cantrips || [], so.cantrips.count, 'cantrips'))) errors.push(e);
    if (so.spellbook) {
      if ((e = countError('spells.spellbook', s.spellbook || [], so.spellbook.count, 'spells for your spellbook'))) errors.push(e);
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
    if ((e = countError('spells.prepared', s.prepared || [], so.prepared.count, 'prepared spells'))) errors.push(e);
    return errors;
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
      case 'feats': return validateFeats(doc);
      case 'equipment': return validateEquipment(doc);
      case 'spells': return validateSpells(doc);
      case 'details':
        return !doc.narrative || !doc.narrative.name || !doc.narrative.name.trim() ? [err('narrative.name', 'Enter a character name.')] : [];
      default:
        return [];
    }
  }

  function validateComplete(doc) {
    var errors = [];
    Opt().stepsFor(doc).forEach(function (step) {
      if (step === 'review') return;
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
    (list || []).forEach(function (id) {
      if (allowed.indexOf(id) >= 0 && kept.indexOf(id) < 0 && (max == null || kept.length < max)) kept.push(id);
    });
    return kept;
  }

  function dropped(before, after) {
    return (before || []).filter(function (id) { return after.indexOf(id) < 0; });
  }

  function sanitizeOnce(doc, notices) {
    var c = doc.choices;
    var o = Opt();
    var a = Api();
    var lvl = c.level;
    function note(msg) {
      if (notices.indexOf(msg) < 0) notices.push(msg);
    }
    function trimList(path, list, allowed, max, kind, why) {
      var after = keepIn(list, allowed, max);
      var gone = dropped(list, after);
      if (gone.length) note('Removed ' + gone.map(function (id) { return nameOf(kind, id); }).join(', ') + ' (' + why + ').');
      return after;
    }

    c.level = Math.min(20, Math.max(1, Number(c.level) || 1));
    var cls = a.getClass(c.classId);
    if (c.classId && !cls) {
      c.classId = null;
      note('Removed an unsupported class.');
    }
    if (c.subclassId && (!cls || c.subclassId !== cls.subclass.id || !o.subclassAvailable(doc))) {
      note('Removed subclass ' + (cls ? cls.subclass.name : '') + ' (subclasses start at level ' + (cls ? cls.subclassLevel : 3) + ').');
      c.subclassId = null;
    }

    // Class options
    var available = o.classChoices(doc);
    var opts = c.classOptions || {};
    Object.keys(opts).forEach(function (k) {
      if (k === 'extraLanguage') return;
      var ch = available.find(function (x) { return x.id === k; });
      if (!ch) {
        delete opts[k];
        note('Cleared ' + k.replace(/([A-Z])/g, ' $1').replace(/\d+$/, '').toLowerCase().trim() + ' (no longer available at level ' + lvl + ').');
      } else if (ch.type === 'option' && !ch.options.some(function (x) { return x.id === opts[k]; })) {
        delete opts[k];
      }
    });
    c.classOptions = opts;

    // Background / species sub-choices
    var bg = a.getBackground(c.backgroundId);
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
      ? trimList('skillProficiencies', c.skillProficiencies, cso.selectable, cso.count, 'skill', 'not a class skill choice or already granted elsewhere')
      : [];

    // Feats
    var slots = o.featSlots(doc);
    var feats = c.feats || {};
    Object.keys(feats).forEach(function (key) {
      var slot = slots.find(function (s) { return s.key === key; });
      if (!slot) {
        if (feats[key] && feats[key].featId) note('Removed ' + nameOf('feat', feats[key].featId) + ' (that feat slot isn’t available any more).');
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
      c.classOptions[ch.id] = trimList(ch.id, c.classOptions[ch.id], eo.from, ch.count, 'skill', ch.label + ' needs a skill you are proficient in');
    });

    // Languages
    var lo = o.languageOptions(doc);
    c.languages = trimList('languages', c.languages, lo.from, lo.count, 'language', 'not a choosable standard language');
    if (c.classOptions.extraLanguage && (!lo.extra || lo.extra.from.indexOf(c.classOptions.extraLanguage) < 0)) {
      delete c.classOptions.extraLanguage;
    }

    // Equipment
    if (c.classEquipment && !(cls && cls.equipmentOptions.some(function (x) { return x.id === c.classEquipment; }))) c.classEquipment = null;
    if (c.backgroundEquipment && !(bg && bg.equipmentOptions.some(function (x) { return x.id === c.backgroundEquipment; }))) c.backgroundEquipment = null;
    var wm = o.weaponMasteryOptions(doc);
    c.weaponMasteries = wm
      ? trimList('weaponMasteries', c.weaponMasteries, wm.from, wm.count, 'weapon', 'Weapon Mastery limit at level ' + lvl)
      : [];

    // Spells
    var s = c.spells = Object.assign({ cantrips: [], prepared: [], spellbook: [], spellMastery: [], signature: [] }, c.spells || {});
    var spo = o.spellOptions(doc);
    if (!spo) {
      if (s.cantrips.length || s.prepared.length || s.spellbook.length) note('Cleared spell selections (the class doesn’t cast spells).');
      c.spells = { cantrips: [], prepared: [], spellbook: [], spellMastery: [], signature: [] };
      return;
    }
    s.cantrips = trimList('cantrips', s.cantrips, spo.cantrips.from, spo.cantrips.count, 'spell', 'cantrip limit at level ' + lvl);
    if (spo.spellbook) {
      s.spellbook = trimList('spellbook', s.spellbook, spo.spellbook.from, spo.spellbook.count, 'spell', 'spellbook size or spell level at level ' + lvl);
      var after = o.spellOptions(doc);
      s.spellMastery = after.spellMastery ? keepIn(s.spellMastery, after.spellMastery.from, 2) : trimList('m', s.spellMastery, [], 0, 'spell', 'Spell Mastery starts at level 18');
      s.signature = after.signature ? keepIn(s.signature, after.signature.from, after.signature.count) : trimList('sg', s.signature, [], 0, 'spell', 'Signature Spells start at level 20');
    } else {
      s.spellbook = [];
      s.spellMastery = [];
      s.signature = [];
    }
    var prep = o.spellOptions(doc).prepared;
    s.prepared = trimList('prepared', s.prepared, prep.from, prep.count, 'spell', 'prepared spell limit or spell level at level ' + lvl);
  }

  /**
   * Bring every choice in line with the rest of the character. Valid selections are kept as-is.
   * Returns human-readable notices for anything that was removed.
   */
  function sanitizeChoices(doc) {
    var notices = [];
    var before = null;
    for (var i = 0; i < 4; i++) {
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
