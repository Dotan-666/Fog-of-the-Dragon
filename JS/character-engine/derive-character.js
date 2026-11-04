/**
 * Derive display statistics from character choices + SRD 5.2.1 rules
 */
(function (global) {
  'use strict';

  var Api = function () {
    return global.FogRulesApi;
  };
  var Opt = function () {
    return global.FogCharacterOptions;
  };

  function signed(n) {
    return (n >= 0 ? '+' : '') + n;
  }

  function emptyDerived() {
    return {
      computedAt: new Date().toISOString(),
      rulesVersion: Api().rules().meta.id,
      limitations: [],
      proficiencyBonus: 0,
      abilities: {},
      savingThrows: {},
      skills: {},
      passivePerception: null,
      combat: { ac: null, acBreakdown: [], hpMax: null, hpBreakdown: [], initiative: null, speed: null, hitDice: null, size: null, darkvision: null },
      attacks: [],
      proficiencies: { armor: [], weapons: [], tools: [], languages: [] },
      features: [],
      spellcasting: null,
      otherSpells: [],
      inventory: [],
      gold: 0,
      weaponMasteries: [],
      sneakAttackDice: null,
    };
  }

  function speciesOption(species, choiceId, optionId) {
    var ch = species && species.choices.find(function (x) { return x.id === choiceId; });
    return ch && ch.options ? ch.options.find(function (o) { return o.id === optionId; }) || null : null;
  }

  // ---------------------------------------------------------------------------
  // Equipment and armor class
  // ---------------------------------------------------------------------------
  function collectInventory(c, cls, bg) {
    var items = [];
    var gold = 0;
    function addOption(options, id, source) {
      var opt = (options || []).find(function (o) { return o.id === id; });
      if (!opt) return;
      gold += opt.gp;
      opt.items.forEach(function (it) {
        var name = it.name;
        if (/^Gaming Set/.test(name) && c.backgroundTool) {
          var tool = Api().getTool(c.backgroundTool);
          if (tool) name = tool.name;
        }
        items.push({ name: name, count: it.count, weaponId: it.weaponId || null, armorId: it.armorId || null, source: source });
      });
    }
    if (cls) addOption(cls.equipmentOptions, c.classEquipment, cls.name);
    if (bg) addOption(bg.equipmentOptions, c.backgroundEquipment, bg.name);
    return { items: items, gold: gold };
  }

  function armorTraining(c, cls) {
    var t = Object.assign({}, cls ? cls.proficiencies.armor : {});
    if (cls && cls.id === 'cleric' && c.classOptions && c.classOptions.divineOrder === 'protector') t.heavy = true;
    return t;
  }

  function computeAC(derived, inventory, training, hasDefense) {
    var dex = derived.abilities.dex.modifier;
    var best = { ac: 10 + dex, parts: ['10 base', signed(dex) + ' Dex'], armor: null };
    inventory.forEach(function (it) {
      var a = Api().getArmor(it.armorId);
      if (!a || a.category === 'shield' || !training[a.category]) return;
      var dexPart = a.addDex ? (a.maxDex != null ? Math.min(dex, a.maxDex) : dex) : 0;
      var ac = a.baseAC + dexPart;
      if (ac > best.ac) {
        best = { ac: ac, parts: [a.name + ' ' + a.baseAC].concat(a.addDex ? [signed(dexPart) + ' Dex' + (a.maxDex != null ? ' (max ' + a.maxDex + ')' : '')] : []), armor: a };
      }
    });
    var shield = inventory.find(function (it) {
      var a = Api().getArmor(it.armorId);
      return a && a.category === 'shield';
    });
    if (shield && training.shield) {
      best.ac += 2;
      best.parts.push('+2 Shield');
    }
    if (hasDefense && best.armor) {
      best.ac += 1;
      best.parts.push('+1 Defense');
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Main
  // ---------------------------------------------------------------------------
  function deriveCharacter(doc) {
    var derived = emptyDerived();
    var c = doc.choices || {};
    var lvl = c.level || 1;
    var cls = Api().getClass(c.classId);
    var species = Api().getSpecies(c.speciesId);
    var bg = Api().getBackground(c.backgroundId);
    var opts = Opt();
    var featsByKey = c.feats || {};
    var slots = opts.featSlots(doc);
    var featIds = slots.map(function (s) { return featsByKey[s.key] && featsByKey[s.key].featId; }).filter(Boolean);
    function hasFeat(id) {
      return featIds.indexOf(id) >= 0;
    }

    var pb = Api().proficiencyBonus(lvl);
    derived.proficiencyBonus = pb;

    // Abilities
    var sc = opts.abilityScores(doc);
    Api().rules().abilities.forEach(function (ab) {
      derived.abilities[ab] = { score: sc.scores[ab], modifier: Api().abilityModifier(sc.scores[ab]), breakdown: sc.breakdown[ab] };
    });

    // Saving throws
    Api().rules().abilities.forEach(function (ab) {
      var prof = !!cls && cls.savingThrows.indexOf(ab) >= 0;
      derived.savingThrows[ab] = { proficient: prof, modifier: derived.abilities[ab].modifier + (prof ? pb : 0) };
    });

    // Skills
    var sources = opts.skillSources(doc, null);
    var expertise = [];
    opts.classChoices(doc).forEach(function (ch) {
      if (ch.type === 'expertise') expertise = expertise.concat((c.classOptions || {})[ch.id] || []);
    });
    Api().rules().skills.forEach(function (s) {
      var prof = !!sources[s.id];
      var exp = prof && expertise.indexOf(s.id) >= 0;
      derived.skills[s.id] = {
        name: s.name,
        ability: s.ability,
        proficient: prof,
        expertise: exp,
        sources: sources[s.id] || [],
        modifier: derived.abilities[s.ability].modifier + (exp ? pb * 2 : prof ? pb : 0),
      };
    });
    derived.passivePerception = 10 + derived.skills.perception.modifier;

    // Proficiencies
    var training = armorTraining(c, cls);
    if (cls) {
      derived.proficiencies.armor = ['light', 'medium', 'heavy'].filter(function (k) { return training[k]; })
        .map(function (k) { return k.charAt(0).toUpperCase() + k.slice(1) + ' armor'; })
        .concat(training.shield ? ['Shields'] : []);
      derived.proficiencies.weapons = [cls.weaponProficiencyText];
      if (cls.id === 'cleric' && c.classOptions.divineOrder === 'protector') derived.proficiencies.weapons.push('Martial weapons (Protector)');
    }
    derived.proficiencies.tools = Object.keys(opts.toolSources(doc, null)).map(function (id) {
      var t = Api().getTool(id);
      return t ? t.name : id;
    });
    var langOpts = opts.languageOptions(doc);
    derived.proficiencies.languages = langOpts.known.concat(c.languages || [])
      .concat(c.classOptions && c.classOptions.extraLanguage ? [c.classOptions.extraLanguage] : [])
      .map(function (id) {
        var l = Api().getLanguage(id);
        return l ? l.name : id;
      });

    // Features
    if (cls) {
      cls.features.forEach(function (f) {
        if (f.level <= lvl) derived.features.push({ name: f.name, description: f.description, source: cls.name + ' ' + f.level, level: f.level, kind: 'class' });
      });
      if (c.subclassId && cls.subclass.id === c.subclassId) {
        cls.subclass.features.forEach(function (f) {
          if (f.level <= lvl) derived.features.push({ name: f.name, description: f.description, source: cls.subclass.name + ' ' + f.level, level: f.level, kind: 'subclass' });
        });
      }
      opts.classChoices(doc).forEach(function (ch) {
        if (ch.type !== 'option') return;
        var picked = ch.options.find(function (o) { return o.id === (c.classOptions || {})[ch.id]; });
        if (picked) derived.features.push({ name: ch.label + ': ' + picked.name, description: picked.description, source: cls.name + ' ' + ch.level, level: ch.level, kind: 'choice' });
      });
    }
    if (species) {
      species.traits.forEach(function (t) {
        derived.features.push({ name: t.name, description: t.description, source: species.name, level: 0, kind: 'species' });
      });
      species.choices.forEach(function (ch) {
        var o = speciesOption(species, ch.id, (c.speciesOptions || {})[ch.id]);
        if (o) derived.features.push({ name: ch.label + ': ' + o.name, description: o.description, source: species.name, level: 0, kind: 'species' });
      });
    }
    slots.forEach(function (slot) {
      var inst = featsByKey[slot.key];
      var feat = inst && Api().getFeat(inst.featId);
      if (feat) derived.features.push({ name: feat.name, description: feat.description, source: slot.label, level: slot.level || 0, kind: 'feat' });
    });

    // Hit points (fixed values: max die at level 1, then the class's fixed value per level)
    var conMod = derived.abilities.con.modifier;
    if (cls) {
      var first = cls.hitDie + conMod;
      var later = Math.max(1, cls.fixedHpPerLevel + conMod);
      var hp = Math.max(1, first) + later * (lvl - 1);
      derived.combat.hpBreakdown = ['Level 1: d' + cls.hitDie + ' max (' + cls.hitDie + ') ' + signed(conMod) + ' Con'];
      if (lvl > 1) derived.combat.hpBreakdown.push('Levels 2–' + lvl + ': ' + (lvl - 1) + ' × (' + cls.fixedHpPerLevel + ' ' + signed(conMod) + ' Con)');
      if (species && species.hpPerLevel) {
        hp += species.hpPerLevel * lvl;
        derived.combat.hpBreakdown.push('Dwarven Toughness: +' + species.hpPerLevel * lvl);
      }
      derived.combat.hpMax = hp;
      derived.combat.hitDice = lvl + 'd' + cls.hitDie;
    } else {
      derived.limitations.push('Hit points require a class.');
    }
    var state = doc.state || {};
    derived.combat.hpCurrent = state.hpCurrent != null && derived.combat.hpMax != null ? Math.min(state.hpCurrent, derived.combat.hpMax) : derived.combat.hpMax;

    // Inventory, AC, speed
    var inv = collectInventory(c, cls, bg);
    derived.inventory = inv.items;
    derived.gold = inv.gold;
    var acRes = computeAC(derived, inv.items, training, hasFeat('defense'));
    derived.combat.ac = acRes.ac;
    derived.combat.acBreakdown = acRes.parts;
    derived.combat.size = (c.speciesOptions && c.speciesOptions.size) || (species ? species.sizeOptions[0] : null);
    var speed = species ? species.speed : 30;
    var lineage = speciesOption(species, 'lineage', (c.speciesOptions || {}).lineage);
    if (lineage && lineage.speed) speed = lineage.speed;
    if (acRes.armor && acRes.armor.strength && derived.abilities.str.score < acRes.armor.strength) {
      speed -= 10;
      derived.limitations.push(acRes.armor.name + ' needs Strength ' + acRes.armor.strength + '; your Speed is reduced by 10 feet while wearing it.');
    }
    derived.combat.speed = speed;
    derived.combat.darkvision = (lineage && lineage.darkvision) || (species && species.darkvision) || null;
    derived.combat.initiative = derived.abilities.dex.modifier + (hasFeat('alert') ? pb : 0);
    derived.combat.initiativeNote = hasFeat('alert') ? 'Includes Proficiency Bonus from Alert.' : null;

    // Attacks with weapons in the inventory
    derived.weaponMasteries = (c.weaponMasteries || []).slice();
    var seen = {};
    inv.items.forEach(function (it) {
      var w = Api().getWeapon(it.weaponId);
      if (!w || seen[w.id]) return;
      seen[w.id] = true;
      var str = derived.abilities.str.modifier;
      var dex = derived.abilities.dex.modifier;
      var mod = w.kind === 'ranged' ? dex : w.finesse ? Math.max(str, dex) : str;
      var prof = opts.weaponProficient(doc, w);
      var bonus = mod + (prof ? pb : 0) + (w.kind === 'ranged' && hasFeat('archery') ? 2 : 0);
      derived.attacks.push({
        name: w.name,
        attackBonus: bonus,
        damage: w.damage + (mod !== 0 ? ' ' + signed(mod) : '') + ' ' + w.damageType,
        properties: w.properties,
        mastery: derived.weaponMasteries.indexOf(w.id) >= 0 ? w.mastery : null,
        proficient: prof,
        notes: w.kind === 'ranged' && hasFeat('archery') ? 'Includes +2 from Archery.' : null,
      });
    });

    // Rogue Sneak Attack, Fighter crit range
    if (cls && cls.id === 'rogue') derived.sneakAttackDice = cls.levels[lvl].sneakAttack;
    if (cls && cls.critRange && c.subclassId) {
      Object.keys(cls.critRange).forEach(function (l) {
        if (lvl >= Number(l)) derived.critRange = cls.critRange[l];
      });
    }

    // Spellcasting
    var so = opts.spellOptions(doc);
    if (so) {
      var abMod = derived.abilities[so.ability].modifier;
      var s = c.spells || {};
      derived.spellcasting = {
        ability: so.ability,
        abilityMod: abMod,
        saveDC: 8 + pb + abMod,
        attackBonus: pb + abMod,
        cantripsKnown: so.cantrips.count,
        spellsPrepared: so.prepared.count,
        maxSpellLevel: so.maxSpellLevel,
        slots: so.slots,
        cantrips: (s.cantrips || []).slice(),
        prepared: (s.prepared || []).slice(),
        alwaysPrepared: so.alwaysPrepared.concat(s.spellMastery || [], s.signature || []),
        spellbook: so.spellbook ? (s.spellbook || []).slice() : null,
        spellMastery: (s.spellMastery || []).slice(),
        signature: (s.signature || []).slice(),
      };
    }

    // Spells from species and feats (each with its own spellcasting ability)
    var spAbility = (c.speciesOptions || {}).spellAbility;
    function addOther(spellId, source, note, ability) {
      if (!Api().getSpell(spellId)) return;
      var mod = ability ? derived.abilities[ability].modifier : null;
      derived.otherSpells.push({
        spellId: spellId, source: source, note: note, ability: ability || null,
        saveDC: ability ? 8 + pb + mod : null, attackBonus: ability ? pb + mod : null,
      });
    }
    if (lineage) {
      var cantrips = lineage.cantrips || (lineage.cantrip ? [lineage.cantrip] : []);
      cantrips.forEach(function (id) { addOther(id, species.name + ' (' + lineage.name + ')', 'Cantrip', spAbility); });
      if (lineage.spells) {
        Object.keys(lineage.spells).forEach(function (l) {
          if (lvl >= Number(l) && lineage.spells[l]) addOther(lineage.spells[l], species.name + ' (' + lineage.name + ')', 'Always prepared; once per Long Rest without a slot (from level ' + l + ')', spAbility);
        });
      }
    }
    if (species && species.cantrips) {
      species.cantrips.forEach(function (id) { addOther(id, species.name, 'Cantrip', spAbility); });
    }
    slots.forEach(function (slot) {
      var inst = featsByKey[slot.key];
      if (!inst || inst.featId !== 'magic-initiate') return;
      (inst.cantrips || []).forEach(function (id) { addOther(id, 'Magic Initiate (' + cap(inst.spellList) + ')', 'Cantrip', inst.spellAbility); });
      if (inst.spell1) addOther(inst.spell1, 'Magic Initiate (' + cap(inst.spellList) + ')', 'Always prepared; once per Long Rest without a slot', inst.spellAbility);
    });

    // What the sheet shows as text only
    if (!c.classId) derived.limitations.push('Class not selected: combat and class features are incomplete.');
    if (!c.speciesId) derived.limitations.push('Species not selected: speed and species traits may be missing.');
    if (derived.inventory.length) {
      derived.limitations.push('Armor Class assumes you wear the best armor (and shield) from your starting equipment that you are trained with.');
    }
    var applied = ['alert', 'defense', 'archery', 'ability-score-improvement', 'magic-initiate', 'skilled'];
    if (featIds.some(function (id) { return applied.indexOf(id) < 0; })) {
      derived.limitations.push('Some feat benefits (beyond ability increases, proficiencies, spells, Alert, Archery and Defense) are shown as rules text and not applied to the numbers.');
    }

    return derived;
  }

  function cap(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  global.FogDeriveCharacter = deriveCharacter;
})(window);
