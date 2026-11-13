/**
 * Derive display statistics from character choices + SRD 5.2.1 rules.
 * Every number here comes from the rules data; anything not computed is listed in `limitations`.
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

  function cap(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  /** Class table columns shown as class resources (labels follow the SRD class tables). */
  var RESOURCE_COLUMNS = [
    ['rages', 'Rages'],
    ['rageDamage', 'Rage Damage', function (v) { return signed(v); }],
    ['bardicDie', 'Bardic Inspiration die'],
    ['channelDivinity', 'Channel Divinity'],
    ['wildShape', 'Wild Shape'],
    ['secondWind', 'Second Wind'],
    ['martialArts', 'Martial Arts die'],
    ['focusPoints', 'Focus Points'],
    ['unarmoredMovement', 'Unarmored Movement', function (v) { return '+' + v + ' ft.'; }],
    ['sorceryPoints', 'Sorcery Points'],
    ['invocations', 'Eldritch Invocations'],
    ['favoredEnemy', 'Favored Enemy'],
    ['sneakAttack', 'Sneak Attack'],
    ['weaponMastery', 'Weapon Mastery'],
  ];

  function emptyDerived() {
    return {
      computedAt: new Date().toISOString(),
      rulesVersion: Api().rules().meta.id,
      limitations: [],
      proficiencyBonus: 0,
      abilities: {},
      savingThrows: {},
      savingThrowNotes: [],
      skills: {},
      passivePerception: null,
      combat: { ac: null, acBreakdown: [], hpMax: null, hpBreakdown: [], initiative: null, speed: null, speedBreakdown: [], hitDice: null, size: null, darkvision: null },
      attacks: [],
      proficiencies: { armor: [], weapons: [], tools: [], languages: [] },
      features: [],
      classResources: [],
      spellcasting: null,
      otherSpells: [],
      invocations: [],
      metamagic: [],
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

  function dieSides(dmg) {
    var m = /d(\d+)/.exec(dmg || '');
    return m ? Number(m[1]) : 0;
  }

  // ---------------------------------------------------------------------------
  // Equipment and armor class
  // ---------------------------------------------------------------------------
  function collectInventory(c, cls, bg) {
    var items = [];
    var gold = 0;
    var co = c.classOptions || {};
    function toolName(id) {
      var t = id && Api().getTool(id);
      return t ? t.name : null;
    }
    function addOption(options, id, source) {
      var opt = (options || []).find(function (o) { return o.id === id; });
      if (!opt) return;
      gold += opt.gp;
      opt.items.forEach(function (it) {
        var name = it.name;
        if (/^Gaming Set/.test(name) && c.backgroundTool) name = toolName(c.backgroundTool) || name;
        // "Musical Instrument of your choice" / the Monk's chosen tool: use the tool proficiency picked earlier.
        if (/^Musical Instrument of your choice/.test(name) && (co.instruments || []).length) name = toolName(co.instruments[0]) || name;
        if (/chosen for the tool proficiency above/.test(name) && (co.monkTool || []).length) name = toolName(co.monkTool[0]) || name;
        var gear = !it.weaponId && !it.armorId ? Api().gearByName(name) : null;
        items.push({
          name: name, count: it.count, weaponId: it.weaponId || null, armorId: it.armorId || null,
          gearId: gear ? gear.id : null, contents: gear && gear.contents ? gear.contents.slice() : null, source: source,
        });
      });
    }
    if (cls) addOption(cls.equipmentOptions, c.classEquipment, cls.name);
    if (bg) addOption(bg.equipmentOptions, c.backgroundEquipment, bg.name);
    return { items: items, gold: gold };
  }

  /**
   * Best Armor Class from the starting equipment the character is trained with, or an
   * Unarmored Defense formula when that is higher.
   */
  function computeAC(derived, inventory, training, hasDefense, unarmored) {
    var dex = derived.abilities.dex.modifier;
    var armors = [null];
    var hasShield = false;
    inventory.forEach(function (it) {
      var a = Api().getArmor(it.armorId);
      if (!a) return;
      if (a.category === 'shield') {
        if (training.shield) hasShield = true;
      } else if (training[a.category]) {
        armors.push(a);
      }
    });
    var best = null;
    armors.forEach(function (a) {
      [false, true].forEach(function (shield) {
        if (shield && !hasShield) return;
        var options = [];
        if (a) {
          var dexPart = a.addDex ? (a.maxDex != null ? Math.min(dex, a.maxDex) : dex) : 0;
          options.push({ ac: a.baseAC + dexPart, parts: [a.name + ' ' + a.baseAC].concat(a.addDex ? [signed(dexPart) + ' Dex' + (a.maxDex != null ? ' (max ' + a.maxDex + ')' : '')] : []) });
        } else {
          options.push({ ac: 10 + dex, parts: ['10 base', signed(dex) + ' Dex'] });
          unarmored.forEach(function (u) {
            if (shield && !u.shield) return;
            var m = derived.abilities[u.ability].modifier;
            options.push({ ac: 10 + dex + m, parts: ['10 base', signed(dex) + ' Dex', signed(m) + ' ' + cap(u.ability) + ' (' + u.source + ')'], unarmored: u.source });
          });
        }
        options.forEach(function (o) {
          var ac = o.ac;
          var parts = o.parts.slice();
          if (shield) {
            ac += 2;
            parts.push('+2 Shield');
          }
          if (hasDefense && a) {
            ac += 1;
            parts.push('+1 Defense');
          }
          if (!best || ac > best.ac) best = { ac: ac, parts: parts, armor: a, shield: shield, unarmored: o.unarmored || null };
        });
      });
    });
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
    var opts = Opt();
    var sub = opts.subclassAvailable(doc) ? opts.currentSubclass(doc) : null;
    var species = Api().getSpecies(c.speciesId);
    var bg = Opt().backgroundOf(doc);
    var co = c.classOptions || {};
    var featsByKey = c.feats || {};
    var slots = opts.featSlots(doc);
    var featIds = slots.map(function (s) { return featsByKey[s.key] && featsByKey[s.key].featId; }).filter(Boolean);
    function hasFeat(id) {
      return featIds.indexOf(id) >= 0;
    }
    var entry = cls ? cls.levels[lvl] : null;

    var pb = Api().proficiencyBonus(lvl);
    derived.proficiencyBonus = pb;

    // Abilities
    var sc = opts.abilityScores(doc);
    Api().rules().abilities.forEach(function (ab) {
      derived.abilities[ab] = { score: sc.scores[ab], modifier: Api().abilityModifier(sc.scores[ab]), breakdown: sc.breakdown[ab] };
    });

    // Saving throws: class proficiencies, Disciplined Survivor (Monk 14), Slippery Mind (Rogue 15), Aura of Protection
    var extraSaves = cls && cls.extraSaves && lvl >= cls.extraSaves.level ? cls.extraSaves.abilities : [];
    var allSaves = !!(cls && cls.allSavesAt && lvl >= cls.allSavesAt);
    var aura = cls && cls.auraOfProtection && lvl >= cls.auraOfProtection.level
      ? Math.max(cls.auraOfProtection.min, derived.abilities[cls.auraOfProtection.ability].modifier) : 0;
    Api().rules().abilities.forEach(function (ab) {
      var prof = !!cls && (cls.savingThrows.indexOf(ab) >= 0 || allSaves || extraSaves.indexOf(ab) >= 0);
      derived.savingThrows[ab] = { proficient: prof, modifier: derived.abilities[ab].modifier + (prof ? pb : 0) + aura };
    });
    if (allSaves) derived.savingThrowNotes.push('Disciplined Survivor: proficient in all saving throws.');
    if (extraSaves.length) derived.savingThrowNotes.push(cls.extraSaves.source + ': proficient in ' + extraSaves.map(function (a) { return Api().rules().abilityNames[a]; }).join(' and ') + ' saving throws.');
    if (aura) derived.savingThrowNotes.push('Includes ' + signed(aura) + ' from Aura of Protection (inactive while you are Incapacitated).');

    // Skills (Jack of All Trades adds half the Proficiency Bonus to skills you lack)
    var sources = opts.skillSources(doc, null);
    var expertise = [];
    opts.classChoices(doc).forEach(function (ch) {
      if (ch.type === 'expertise') expertise = expertise.concat(co[ch.id] || []);
    });
    var joat = cls && cls.jackOfAllTrades && lvl >= cls.jackOfAllTrades.level ? Math.floor(pb / 2) : 0;
    Api().rules().skills.forEach(function (s) {
      var prof = !!sources[s.id];
      var exp = prof && expertise.indexOf(s.id) >= 0;
      derived.skills[s.id] = {
        name: s.name,
        ability: s.ability,
        proficient: prof,
        expertise: exp,
        jackOfAllTrades: !prof && joat > 0,
        sources: sources[s.id] || [],
        modifier: derived.abilities[s.ability].modifier + (exp ? pb * 2 : prof ? pb : joat),
      };
    });
    derived.passivePerception = 10 + derived.skills.perception.modifier;

    // Proficiencies
    var training = opts.armorTraining(doc);
    var grants = opts.optionGrants(doc);
    if (cls) {
      derived.proficiencies.armor = ['light', 'medium', 'heavy'].filter(function (k) { return training[k]; })
        .map(function (k) { return k.charAt(0).toUpperCase() + k.slice(1) + ' armor'; })
        .concat(training.shield ? ['Shields'] : []);
      derived.proficiencies.weapons = [cls.weaponProficiencyText];
      if (grants.martialWeapons && !cls.proficiencies.weapons.martial) {
        var giver = opts.classChoices(doc).map(function (ch) { return opts.pickedOption(doc, ch); }).find(function (o) { return o && o.grants && o.grants.martialWeapons; });
        derived.proficiencies.weapons.push('Martial weapons (' + (giver ? giver.name : 'class option') + ')');
      }
    }
    derived.proficiencies.tools = Object.keys(opts.toolSources(doc, null)).map(function (id) {
      var t = Api().getTool(id);
      return t ? t.name : id;
    });
    derived.proficiencies.languages = opts.knownLanguages(doc).map(function (id) {
      var l = Api().getLanguage(id);
      return l ? l.name : id;
    });

    // Features
    if (cls) {
      cls.features.forEach(function (f) {
        if (f.level <= lvl) derived.features.push({ name: f.name, description: f.description, source: cls.name + ' ' + f.level, level: f.level, kind: 'class' });
      });
      if (sub) {
        sub.features.forEach(function (f) {
          if (f.level <= lvl) derived.features.push({ name: f.name, description: f.description, source: sub.name + ' ' + f.level, level: f.level, kind: 'subclass' });
        });
      }
      opts.classChoices(doc).forEach(function (ch) {
        if (ch.type !== 'option') return;
        var picked = opts.pickedOption(doc, ch);
        if (picked) {
          derived.features.push({
            name: ch.label + ': ' + picked.name, description: [picked.description, ch.note].filter(Boolean).join('\n\n'),
            source: cls.name + ' ' + ch.level, level: ch.level, kind: 'choice',
          });
        }
      });
      opts.classChoices(doc).forEach(function (ch) {
        if (ch.type !== 'multi-option') return;
        (co[ch.id] || []).forEach(function (id) {
          var m = Api().getMetamagic(id);
          if (m) derived.metamagic.push({ id: m.id, name: m.name, cost: m.cost, description: m.description });
        });
      });
      opts.invocationList(doc).forEach(function (inst) {
        var inv = Api().getInvocation(inst.id);
        if (!inv) return;
        var target = inst.cantrip ? Api().getSpell(inst.cantrip) : null;
        derived.invocations.push({ id: inv.id, name: inv.name + (target ? ' (' + target.name + ')' : ''), description: inv.description, prerequisite: inv.prerequisite, cantrip: inst.cantrip || null });
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
      var hp = Math.max(1, first);
      derived.combat.hpBreakdown = ['Level 1: d' + cls.hitDie + ' max (' + cls.hitDie + ') ' + signed(conMod) + ' Con'];
      // Later levels: the class's fixed value, or the Hit Die roll recorded when the character levelled up (SRD: roll or fixed).
      var rolls = c.hpRolls || {};
      var fixedLevels = 0;
      var rolled = [];
      for (var hl = 2; hl <= lvl; hl++) {
        var r = rolls[hl];
        if (r && r.die === cls.hitDie && r.value >= 1 && r.value <= cls.hitDie) {
          hp += Math.max(1, r.value + conMod);
          rolled.push('level ' + hl + ': rolled ' + r.value);
        } else {
          hp += Math.max(1, cls.fixedHpPerLevel + conMod);
          fixedLevels++;
        }
      }
      if (fixedLevels) derived.combat.hpBreakdown.push(fixedLevels + ' level' + (fixedLevels > 1 ? 's' : '') + ' × fixed (' + cls.fixedHpPerLevel + ' ' + signed(conMod) + ' Con)');
      if (rolled.length) derived.combat.hpBreakdown.push('Hit Die rolls (d' + cls.hitDie + ' ' + signed(conMod) + ' Con each): ' + rolled.join(', '));
      if (species && species.hpPerLevel) {
        hp += species.hpPerLevel * lvl;
        derived.combat.hpBreakdown.push('Dwarven Toughness: +' + species.hpPerLevel * lvl);
      }
      if (sub && sub.hpBonus && lvl >= sub.hpBonus.level) {
        hp += sub.hpBonus.perClassLevel * lvl;
        derived.combat.hpBreakdown.push(sub.hpBonus.source + ': +' + sub.hpBonus.perClassLevel * lvl);
      }
      derived.combat.hpMax = hp;
      derived.combat.hitDice = lvl + 'd' + cls.hitDie;
    } else {
      derived.limitations.push('Hit points require a class.');
    }
    var state = doc.state || {};
    derived.combat.hpCurrent = state.hpCurrent != null && derived.combat.hpMax != null ? Math.min(state.hpCurrent, derived.combat.hpMax) : derived.combat.hpMax;

    // Inventory and AC
    var inv = collectInventory(c, cls, bg);
    derived.inventory = inv.items;
    derived.gold = inv.gold;
    var unarmored = [];
    if (cls && cls.unarmoredDefense) unarmored.push(Object.assign({ source: 'Unarmored Defense' }, cls.unarmoredDefense));
    if (sub && sub.unarmoredDefense && lvl >= (sub.unarmoredDefense.level || 1)) {
      var udName = (sub.features.find(function (f) { return /Resilience|Unarmored/.test(f.name); }) || {}).name || sub.name;
      unarmored.push(Object.assign({ source: udName }, sub.unarmoredDefense));
    }
    var acRes = computeAC(derived, inv.items, training, hasFeat('defense'), unarmored);
    derived.combat.ac = acRes.ac;
    derived.combat.acBreakdown = acRes.parts;
    derived.combat.acArmor = acRes.armor ? acRes.armor.name : null;
    derived.combat.acShield = acRes.shield;

    // Speed (species, armor Strength requirement, Fast Movement / Unarmored Movement)
    derived.combat.size = (c.speciesOptions && c.speciesOptions.size) || (species ? species.sizeOptions[0] : null);
    var speed = species ? species.speed : 30;
    var lineage = speciesOption(species, 'lineage', (c.speciesOptions || {}).lineage);
    if (lineage && lineage.speed) speed = lineage.speed;
    derived.combat.speedBreakdown.push((species ? species.name : 'Base') + ': ' + speed + ' ft.');
    if (acRes.armor && acRes.armor.strength && derived.abilities.str.score < acRes.armor.strength) {
      speed -= 10;
      derived.combat.speedBreakdown.push('−10 ft. (' + acRes.armor.name + ' needs Strength ' + acRes.armor.strength + ')');
      derived.limitations.push(acRes.armor.name + ' needs Strength ' + acRes.armor.strength + '; your Speed is reduced by 10 feet while wearing it.');
    }
    var sb = cls && cls.speedBonus;
    if (sb) {
      var amount = sb.column ? (entry[sb.column] || 0) : lvl >= sb.level ? sb.amount : 0;
      var blocked = sb.unless === 'heavy-armor' ? !!(acRes.armor && acRes.armor.category === 'heavy')
        : sb.unless === 'armor-or-shield' ? !!(acRes.armor || acRes.shield) : false;
      if (amount && !blocked) {
        speed += amount;
        derived.combat.speedBreakdown.push('+' + amount + ' ft. (' + sb.source + ')');
      }
    }
    derived.combat.speed = speed;
    derived.combat.darkvision = (lineage && lineage.darkvision) || (species && species.darkvision) || null;
    derived.combat.initiative = derived.abilities.dex.modifier + (hasFeat('alert') ? pb : 0);
    var initNotes = [];
    if (hasFeat('alert')) initNotes.push('Includes Proficiency Bonus from Alert.');
    [cls && cls.initiativeAdvantage, sub && sub.initiativeAdvantage].forEach(function (ia) {
      if (ia && lvl >= ia.level) initNotes.push('Advantage on Initiative rolls (' + ia.source + ').');
    });
    derived.combat.initiativeAdvantage = initNotes.some(function (n) { return /Advantage/.test(n); });
    derived.combat.initiativeNote = initNotes.join(' ') || null;

    // Attacks with weapons in the inventory, plus the Unarmed Strike everyone has
    derived.weaponMasteries = (c.weaponMasteries || []).slice();
    var str = derived.abilities.str.modifier;
    var dex = derived.abilities.dex.modifier;
    var martialArts = cls && cls.martialArts && !acRes.armor && !acRes.shield ? entry[cls.martialArts.column] : null;
    var seen = {};
    inv.items.forEach(function (it) {
      var w = Api().getWeapon(it.weaponId);
      if (!w || seen[w.id]) return;
      seen[w.id] = true;
      var monk = !!martialArts && opts.isMonkWeapon(w);
      var mod = w.kind === 'ranged' ? dex : w.finesse || monk ? Math.max(str, dex) : str;
      var prof = opts.weaponProficient(doc, w);
      var archery = w.kind === 'ranged' && hasFeat('archery');
      var die = w.damage;
      if (monk && dieSides(martialArts) > dieSides(w.damage)) die = martialArts;
      var notes = [];
      if (archery) notes.push('Includes +2 from Archery.');
      if (monk) notes.push('Monk weapon: Martial Arts lets you use Dexterity and the ' + martialArts + ' Martial Arts die.');
      derived.attacks.push({
        name: w.name,
        weaponId: w.id,
        attackBonus: mod + (prof ? pb : 0) + (archery ? 2 : 0),
        damage: die + (mod !== 0 ? ' ' + signed(mod) : '') + ' ' + w.damageType,
        properties: w.properties,
        mastery: derived.weaponMasteries.indexOf(w.id) >= 0 ? w.mastery : null,
        proficient: prof,
        notes: notes.join(' ') || null,
      });
    });
    var uMod = martialArts ? Math.max(str, dex) : str;
    derived.attacks.push({
      name: 'Unarmed Strike',
      weaponId: null,
      attackBonus: uMod + pb,
      damage: martialArts ? martialArts + (uMod !== 0 ? ' ' + signed(uMod) : '') + ' Bludgeoning' : Math.max(0, 1 + str) + ' Bludgeoning',
      properties: [],
      mastery: null,
      proficient: true,
      notes: martialArts ? 'Martial Arts: ' + martialArts + ' die, Dexterity allowed; you can also make one as a Bonus Action.' : 'Damage is 1 + your Strength modifier. You can Grapple or Shove instead.',
    });

    // Class resources from the class table
    if (cls) {
      RESOURCE_COLUMNS.forEach(function (rc) {
        var v = entry[rc[0]];
        if (v === undefined || v === null || v === 0 || v === '') return;
        derived.classResources.push({ key: rc[0], label: rc[1], value: rc[2] ? rc[2](v) : String(v) });
      });
      if (cls.bardicInspiration) {
        var uses = Math.max(cls.bardicInspiration.min, derived.abilities[cls.bardicInspiration.usesAbility].modifier);
        derived.classResources.push({ key: 'bardicUses', label: 'Bardic Inspiration uses', value: String(uses) });
      }
      if (cls.layOnHands) derived.classResources.push({ key: 'layOnHands', label: 'Lay on Hands pool', value: cls.layOnHands.perLevel * lvl + ' HP' });
      if (aura) derived.classResources.push({ key: 'aura', label: 'Aura of Protection', value: signed(aura) + ' to saves' });
      if (entry.pactSlots) derived.classResources.push({ key: 'pact', label: 'Pact Magic slots', value: entry.pactSlots + ' × level ' + entry.pactSlotLevel });
    }

    // Rogue Sneak Attack, Champion crit range
    if (cls && entry && entry.sneakAttack) derived.sneakAttackDice = entry.sneakAttack;
    if (cls && cls.critRange && sub && sub.id === cls.subclass.id) {
      Object.keys(cls.critRange).forEach(function (l) {
        if (lvl >= Number(l)) derived.critRange = cls.critRange[l];
      });
    }

    // Spellcasting
    var so = opts.spellOptions(doc);
    if (so) {
      var abMod = derived.abilities[so.ability].modifier;
      var s = c.spells || {};
      var arcanum = [];
      so.arcanum.forEach(function (arc) {
        var id = (s.arcanum || {})[arc.spellLevel];
        if (id) arcanum.push({ spellLevel: arc.spellLevel, spellId: id });
      });
      derived.spellcasting = {
        ability: so.ability,
        abilityMod: abMod,
        casterType: so.casterType,
        saveDC: 8 + pb + abMod,
        attackBonus: pb + abMod,
        cantripsKnown: so.cantrips.count,
        spellsPrepared: so.prepared.count,
        maxSpellLevel: so.maxSpellLevel,
        slots: so.slots,
        pact: so.pact,
        lists: so.lists,
        cantrips: (s.cantrips || []).slice(),
        prepared: (s.prepared || []).slice(),
        alwaysPrepared: so.alwaysPrepared.concat(s.spellMastery || [], s.signature || []),
        spellbook: so.spellbook ? (s.spellbook || []).slice() : null,
        spellMastery: (s.spellMastery || []).slice(),
        signature: (s.signature || []).slice(),
        arcanum: arcanum,
        ritualCasting: !!cls.spellcasting.ritual,
      };
    }

    // Spells from species, feats, Fighting Style replacements and the Book of Shadows (each with its own ability)
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
      if (!inst) return;
      var feat = Api().getFeat(inst.featId);
      if (inst.featId === 'magic-initiate') {
        (inst.cantrips || []).forEach(function (id) { addOther(id, 'Magic Initiate (' + cap(inst.spellList) + ')', 'Cantrip', inst.spellAbility); });
        if (inst.spell1) addOther(inst.spell1, 'Magic Initiate (' + cap(inst.spellList) + ')', 'Always prepared; once per Long Rest without a slot', inst.spellAbility);
      } else if (feat && feat.alternative) {
        (inst.cantrips || []).forEach(function (id) { addOther(id, feat.name, 'Cantrip; counts as a ' + cls.name + ' spell', feat.spellAbility); });
      }
    });
    if (so && c.spells && c.spells.tome && opts.tomeOptions(doc)) {
      (c.spells.tome.cantrips || []).forEach(function (id) { addOther(id, 'Book of Shadows', 'Cantrip; prepared while the book is on you', so.ability); });
      (c.spells.tome.rituals || []).forEach(function (id) { addOther(id, 'Book of Shadows', 'Level 1 Ritual; prepared while the book is on you', so.ability); });
    }

    // What the sheet shows as text only
    if (!c.classId) derived.limitations.push('Class not selected: combat and class features are incomplete.');
    if (!c.speciesId) derived.limitations.push('Species not selected: speed and species traits may be missing.');
    if (derived.inventory.length) {
      derived.limitations.push('Armor Class assumes you wear the best armor (and shield) from your starting equipment that you are trained with, or use Unarmored Defense when that is higher.');
    }
    var applied = ['alert', 'defense', 'archery', 'ability-score-improvement', 'magic-initiate', 'skilled', 'blessed-warrior', 'druidic-warrior'];
    if (featIds.some(function (id) { return applied.indexOf(id) < 0; })) {
      derived.limitations.push('Some feat benefits (beyond ability increases, proficiencies, spells, Alert, Archery and Defense) are shown as rules text and not applied to the numbers.');
    }
    if (derived.invocations.length || derived.metamagic.length) {
      derived.limitations.push('Eldritch Invocations and Metamagic are listed with their rules text; their effects (for example Agonizing Blast damage) are not added to the numbers.');
    }

    return derived;
  }

  global.FogDeriveCharacter = deriveCharacter;
})(window);
