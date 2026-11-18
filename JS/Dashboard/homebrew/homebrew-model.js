/**
 * Homebrew data model (no UI code): kinds, fields, rules math, normalizing, validating and converting entries to the
 * shapes the Monsters & Spells renderer uses.
 *
 * An entry: { id, kind, name, summary, data: { schema: 1, ...fields of the kind }, version, createdAt, updatedAt }
 * Kinds: monster, npc (details plus an optional stat block), spell, magic-item, feat, other.
 *
 * Stat blocks follow the 2024 rules (SRD 5.2.1) format. Numbers the rules define are calculated, not typed:
 * ability modifiers, saving throws, skill bonuses, initiative, Passive Perception, hit points from Hit Dice,
 * proficiency bonus and XP from the Challenge Rating, attack bonuses, save DCs and average damage.
 * Text fields are plain text; **bold** and _italic_ are shown as such (the same markup the SRD data uses).
 */
(function (global) {
  'use strict';

  var LIMITS = { name: 100, summary: 300, line: 200, text: 8000, items: 40, itemName: 80 };
  var KIND_ORDER = ['monster', 'npc', 'spell', 'magic-item', 'feat', 'race', 'class', 'other'];
  var KINDS = {
    monster: { label: 'Monster', plural: 'Monsters', art: 'monster.svg', hint: 'A creature with a full stat block.' },
    npc: { label: 'NPC', plural: 'NPCs', art: 'npc.svg', hint: 'A character to meet: personality, plus optional combat stats.' },
    spell: { label: 'Spell', plural: 'Spells', art: 'spell.svg', hint: 'A new spell with level, school, casting details and effect.' },
    'magic-item': { label: 'Magic item', plural: 'Magic items', art: 'magic-item.svg', hint: 'An item with rarity, attunement and properties.' },
    feat: { label: 'Feat', plural: 'Feats', art: 'feat.svg', hint: 'An origin, general, fighting style or epic boon feat.' },
    race: { label: 'Race', plural: 'Races', art: 'race.svg', hint: 'A custom species or lineage for player characters.' },
    'class': { label: 'Class', plural: 'Classes', art: 'class.svg', hint: 'A custom class or archetype for player characters.' },
    other: { label: 'Other rule', plural: 'Other', art: 'other.svg', hint: 'Anything else: a condition, trap, hazard, poison or house rule.' },
  };
  // Type illustrations (Assets/Pictures/homebrew, see the ATTRIBUTION.md there). The folder is found from this script's URL.
  var script = typeof document !== 'undefined' && document.currentScript;
  var ART_BASE = script && script.src ? new URL('../../../Assets/Pictures/homebrew/', script.src).href : 'Assets/Pictures/homebrew/';
  function artUrl(kind) { return ART_BASE + (KINDS[kind] ? KINDS[kind].art : 'other.svg'); }
  // A picture of your own (optional): a file in the private "content-images" bucket (JS/Dashboard/content-images.js).
  var IMAGE_PATH = /^[\w-]{1,64}\/homebrew\/[\w-]{1,64}\/[\w-]{1,64}\.(jpg|png|webp)$/;

  var ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var ABIL_NAME = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  var SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
  var HIT_DIE = { Tiny: 4, Small: 6, Medium: 8, Large: 10, Huge: 12, Gargantuan: 20 };
  var TYPES = ['Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead'];
  var ALIGNMENTS = ['Unaligned', 'Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];
  var DIE_SIZES = [4, 6, 8, 10, 12, 20];
  var DAMAGE_TYPES = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
  var SKILLS = {
    acrobatics: ['Acrobatics', 'dex'], 'animal-handling': ['Animal Handling', 'wis'], arcana: ['Arcana', 'int'], athletics: ['Athletics', 'str'],
    deception: ['Deception', 'cha'], history: ['History', 'int'], insight: ['Insight', 'wis'], intimidation: ['Intimidation', 'cha'],
    investigation: ['Investigation', 'int'], medicine: ['Medicine', 'wis'], nature: ['Nature', 'int'], perception: ['Perception', 'wis'],
    performance: ['Performance', 'cha'], persuasion: ['Persuasion', 'cha'], religion: ['Religion', 'int'], 'sleight-of-hand': ['Sleight of Hand', 'dex'],
    stealth: ['Stealth', 'dex'], survival: ['Survival', 'wis'],
  };
  // Challenge Rating → XP (SRD 5.2.1). Proficiency bonus follows from the CR.
  var CR_LIST = ['0', '1/8', '1/4', '1/2'].concat(Array.from({ length: 30 }, function (_, i) { return String(i + 1); }));
  var CR_XP = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000 };
  var ACTION_LISTS = [
    { key: 'traits', label: 'Traits' },
    { key: 'actions', label: 'Actions' },
    { key: 'bonusActions', label: 'Bonus Actions' },
    { key: 'reactions', label: 'Reactions' },
    { key: 'legendaryActions', label: 'Legendary Actions' },
  ];
  var ITEM_MODES = { text: 'Description only', attack: 'Attack roll', save: 'Saving throw' };
  var ATTACK_TYPES = { melee: 'Melee', ranged: 'Ranged', both: 'Melee or Ranged' };

  var SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
  var SPELL_CLASSES = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'];
  var CASTING_TIMES = ['Action', 'Bonus Action', 'Reaction', '1 minute', '10 minutes', '1 hour', '8 hours', '12 hours', '24 hours'];

  var ITEM_CATEGORIES = ['Armor', 'Potion', 'Ring', 'Rod', 'Scroll', 'Staff', 'Wand', 'Weapon', 'Wondrous Item'];
  var RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];
  var FEAT_CATEGORIES = ['Origin', 'General', 'Fighting Style', 'Epic Boon'];
  var OTHER_CATEGORIES = ['House rule', 'Condition', 'Trap', 'Hazard', 'Poison', 'Disease', 'Curse', 'Lore', 'Other'];

  var RACE_SIZES = ['Small', 'Medium', 'Small or Medium'];
  var BASE_RACES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Elf', 'Half-Orc', 'Tiefling', 'Dragonborn', 'Orc', 'Goliath', 'Aasimar', 'Custom'];
  var LANGUAGES = ['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'];
  var BASE_CLASSES = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard', 'Custom'];
  var CLASS_HIT_DICE = [6, 8, 10, 12];
  var CASTING_ABILITIES = ['', 'int', 'wis', 'cha'];
  var CASTING_TYPES = ['', 'prepared', 'known', 'pact'];

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function uid(prefix) {
    var r = '';
    try {
      var a = new Uint8Array(5);
      (global.crypto || globalThis.crypto).getRandomValues(a);
      r = Array.prototype.map.call(a, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) {
      r = Math.random().toString(16).slice(2, 12);
    }
    return prefix + Date.now().toString(36) + r;
  }
  function text(v, max) {
    return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max || LIMITS.text);
  }
  function line(v, max) { return text(v, max || LIMITS.line).replace(/\n+/g, ' '); }
  function int(v, min, max, dflt) {
    var n = Math.round(Number(v));
    if (v === '' || v == null || !Number.isFinite(n)) return dflt;
    return Math.min(max, Math.max(min, n));
  }
  function pick(v, list, dflt) { return list.indexOf(v) >= 0 ? v : dflt; }
  function bool(v) { return v === true || v === 'true' || v === 1 || v === '1' || v === 'on'; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /** Signed modifier the way the SRD prints it: +3, +0, −1 (true minus sign). */
  function signed(n) { return n < 0 ? '−' + Math.abs(n) : '+' + n; }
  function mod(score) { return Math.floor((Number(score) - 10) / 2); }
  function crValue(cr) {
    if (cr === '1/8') return 0.125;
    if (cr === '1/4') return 0.25;
    if (cr === '1/2') return 0.5;
    return Number(cr);
  }
  function pbForCr(cr) {
    var v = crValue(cr);
    return v < 5 ? 2 : Math.min(9, 3 + Math.floor((v - 5) / 4));
  }
  function avgDice(count, die) { return Math.floor(count * (die + 1) / 2); }
  /** "5 (1d6 + 2)" — average and dice expression, with a minimum of 1 when there are dice. */
  function damageExpr(count, die, bonus) {
    var avg = Math.max(1, avgDice(count, die) + bonus);
    return avg + ' (' + count + 'd' + die + (bonus ? (bonus > 0 ? ' + ' + bonus : ' − ' + Math.abs(bonus)) : '') + ')';
  }

  // ---------------------------------------------------------------------------
  // Defaults per kind
  // ---------------------------------------------------------------------------
  function newStatBlock() {
    return {
      size: 'Medium', type: 'Humanoid', typeTags: '', alignment: 'Neutral',
      ac: 12, acNote: '', hitDice: 2, hpOverride: null, speed: '30 ft.',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      saves: [], skills: {}, initiativeProf: 0,
      vulnerabilities: '', resistances: '', immunities: '', gear: '', senses: '', languages: 'Common',
      cr: '1/4', legendaryUses: 3,
      traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [],
    };
  }
  function newData(kind) {
    var base = { schema: 1, description: '' };
    if (kind === 'monster') return Object.assign(base, newStatBlock(), { type: 'Monstrosity', alignment: 'Unaligned', languages: '' });
    if (kind === 'npc') return Object.assign(base, newStatBlock(), { role: '', appearance: '', personality: '', motivation: '', voice: '', secrets: '', hasStats: false });
    if (kind === 'spell') return Object.assign(base, { level: 1, school: 'Evocation', classes: [], castingTime: 'Action', ritual: false, range: '60 feet', verbal: true, somatic: true, material: false, materials: '', duration: 'Instantaneous', concentration: false, higherLevels: '' });
    if (kind === 'magic-item') return Object.assign(base, { category: 'Wondrous Item', baseItem: '', rarity: 'Uncommon', attunement: false, attunementBy: '', charges: null, recharge: '', curse: '' });
    if (kind === 'feat') return Object.assign(base, { category: 'General', prerequisite: '', repeatable: false, abilityIncrease: '' });
    if (kind === 'race') return Object.assign(base, { baseRace: 'Custom', size: 'Medium', speed: 30, darkvision: 0, abilityIncreases: '', languages: ['Common'], traits: [{ id: uid('t_'), name: '', text: '' }] });
    if (kind === 'class') return Object.assign(base, { baseClass: 'Custom', hitDie: 8, savingThrows: [], skillChoices: 2, skillList: [], proficiencies: '', equipment: '', subclassLevel: 3, subclassName: 'Subclass', castingAbility: '', castingType: '', features: [{ id: uid('f_'), level: 1, name: '', text: '' }] });
    return Object.assign(base, { category: 'House rule' });
  }
  function newItem(mode) {
    return {
      id: uid('a_'), name: '', mode: pick(mode, Object.keys(ITEM_MODES), 'text'), text: '',
      attackType: 'melee', ability: 'str', reach: 5, range: '', bonus: 0,
      dice: 1, die: 6, damageType: 'Slashing', extraDice: 0, extraDie: 6, extraType: '',
      save: 'dex', dcAbility: 'con', targets: '', failure: '', success: 'Half damage.', addMod: true,
    };
  }
  function newEntry(kind, name) {
    var k = KINDS[kind] ? kind : 'other';
    return { id: null, kind: k, name: line(name == null || !String(name).trim() ? 'New ' + KINDS[k].label.toLowerCase() : name, LIMITS.name).trim(), summary: '', data: newData(k), version: 0 };
  }

  // ---------------------------------------------------------------------------
  // Normalizing (anything stored or loaded goes through here)
  // ---------------------------------------------------------------------------
  function normItem(it) {
    var d = newItem();
    it = it && typeof it === 'object' ? it : {};
    return {
      id: typeof it.id === 'string' && /^[\w-]{1,40}$/.test(it.id) ? it.id : d.id,
      name: line(it.name, LIMITS.itemName),
      mode: pick(it.mode, Object.keys(ITEM_MODES), 'text'),
      text: text(it.text, 4000),
      attackType: pick(it.attackType, Object.keys(ATTACK_TYPES), 'melee'),
      ability: pick(it.ability, ABILS, 'str'),
      reach: int(it.reach, 5, 60, 5),
      range: line(it.range, 40),
      bonus: int(it.bonus, -5, 10, 0),
      dice: int(it.dice, 0, 40, 1),
      die: pick(Number(it.die), DIE_SIZES, 6),
      damageType: pick(it.damageType, DAMAGE_TYPES, 'Slashing'),
      extraDice: int(it.extraDice, 0, 40, 0),
      extraDie: pick(Number(it.extraDie), DIE_SIZES, 6),
      extraType: it.extraType ? pick(it.extraType, DAMAGE_TYPES, '') : '',
      save: pick(it.save, ABILS, 'dex'),
      dcAbility: pick(it.dcAbility, ABILS, 'con'),
      targets: line(it.targets, 200),
      failure: text(it.failure, 1000),
      success: text(it.success, 400),
      addMod: it.addMod !== false,
    };
  }
  function normStatBlock(src, out) {
    var d = newStatBlock();
    out.size = pick(src.size, SIZES, d.size);
    out.type = line(src.type, 40) || d.type;
    out.typeTags = line(src.typeTags, 60);
    out.alignment = line(src.alignment, 40);
    out.ac = int(src.ac, 1, 30, d.ac);
    out.acNote = line(src.acNote, 60);
    out.hitDice = int(src.hitDice, 1, 99, d.hitDice);
    out.hpOverride = src.hpOverride === '' || src.hpOverride == null ? null : int(src.hpOverride, 1, 999, null);
    out.speed = line(src.speed, 120) || d.speed;
    out.abilities = {};
    ABILS.forEach(function (a) { out.abilities[a] = int(src.abilities && src.abilities[a], 1, 30, 10); });
    out.saves = ABILS.filter(function (a) { return Array.isArray(src.saves) && src.saves.indexOf(a) >= 0; });
    out.skills = {};
    Object.keys(SKILLS).forEach(function (k) {
      var v = src.skills && src.skills[k];
      if (v === 1 || v === 2 || v === '1' || v === '2') out.skills[k] = Number(v);
    });
    out.initiativeProf = int(src.initiativeProf, 0, 2, 0);
    ['vulnerabilities', 'resistances', 'immunities', 'gear', 'senses', 'languages'].forEach(function (k) { out[k] = line(src[k], 200); });
    out.cr = pick(String(src.cr), CR_LIST, d.cr);
    out.legendaryUses = int(src.legendaryUses, 1, 9, 3);
    ACTION_LISTS.forEach(function (l) {
      out[l.key] = (Array.isArray(src[l.key]) ? src[l.key] : []).slice(0, LIMITS.items).map(normItem);
    });
  }

  function normalize(entry) {
    var e = entry && typeof entry === 'object' ? entry : {};
    var kind = KINDS[e.kind] ? e.kind : 'other';
    var src = e.data && typeof e.data === 'object' ? e.data : {};
    var data = { schema: 1, description: text(src.description, LIMITS.text) };
    data.image = src.image && typeof src.image.path === 'string' && IMAGE_PATH.test(src.image.path) ? { path: src.image.path } : null;
    if (kind === 'monster' || kind === 'npc') normStatBlock(src, data);
    if (kind === 'npc') {
      ['role', 'appearance', 'motivation', 'voice'].forEach(function (k) { data[k] = line(src[k], 200); });
      data.personality = text(src.personality, 2000);
      data.secrets = text(src.secrets, 4000);
      data.hasStats = bool(src.hasStats);
    }
    if (kind === 'spell') {
      data.level = int(src.level, 0, 9, 1);
      data.school = pick(src.school, SCHOOLS, 'Evocation');
      data.classes = SPELL_CLASSES.filter(function (c) { return Array.isArray(src.classes) && src.classes.indexOf(c) >= 0; });
      data.castingTime = line(src.castingTime, 80) || 'Action';
      data.ritual = bool(src.ritual);
      data.range = line(src.range, 80) || 'Self';
      data.verbal = bool(src.verbal);
      data.somatic = bool(src.somatic);
      data.material = bool(src.material);
      data.materials = line(src.materials, 200);
      data.duration = line(src.duration, 80) || 'Instantaneous';
      data.concentration = bool(src.concentration);
      data.higherLevels = text(src.higherLevels, 2000);
    }
    if (kind === 'magic-item') {
      data.category = pick(src.category, ITEM_CATEGORIES, 'Wondrous Item');
      data.baseItem = line(src.baseItem, 60);
      data.rarity = pick(src.rarity, RARITIES, 'Uncommon');
      data.attunement = bool(src.attunement);
      data.attunementBy = line(src.attunementBy, 80);
      data.charges = src.charges === '' || src.charges == null ? null : int(src.charges, 1, 99, null);
      data.recharge = line(src.recharge, 120);
      data.curse = text(src.curse, 2000);
    }
    if (kind === 'feat') {
      data.category = pick(src.category, FEAT_CATEGORIES, 'General');
      data.prerequisite = line(src.prerequisite, 120);
      data.repeatable = bool(src.repeatable);
      data.abilityIncrease = line(src.abilityIncrease, 200);
    }
    if (kind === 'race') {
      data.baseRace = pick(src.baseRace, BASE_RACES, 'Custom');
      data.size = pick(src.size, RACE_SIZES, 'Medium');
      data.speed = int(src.speed, 20, 60, 30);
      data.darkvision = int(src.darkvision, 0, 120, 0);
      data.abilityIncreases = line(src.abilityIncreases, 200);
      data.languages = (Array.isArray(src.languages) ? src.languages : []).filter(function (l) { return typeof l === 'string' && l.length <= 40; }).slice(0, 8);
      if (!data.languages.length) data.languages = ['Common'];
      data.traits = (Array.isArray(src.traits) ? src.traits : []).slice(0, LIMITS.items).map(function (t) {
        return { id: typeof t.id === 'string' && /^[\w-]{1,40}$/.test(t.id) ? t.id : uid('t_'), name: line(t.name, LIMITS.itemName), text: text(t.text, 4000) };
      });
    }
    if (kind === 'class') {
      data.baseClass = pick(src.baseClass, BASE_CLASSES, 'Custom');
      data.hitDie = pick(Number(src.hitDie), CLASS_HIT_DICE, 8);
      data.savingThrows = ABILS.filter(function (a) { return Array.isArray(src.savingThrows) && src.savingThrows.indexOf(a) >= 0; });
      data.skillChoices = int(src.skillChoices, 0, 6, 2);
      data.skillList = Object.keys(SKILLS).filter(function (k) { return Array.isArray(src.skillList) && src.skillList.indexOf(k) >= 0; });
      data.proficiencies = text(src.proficiencies, 1000);
      data.equipment = text(src.equipment, 1000);
      data.subclassLevel = int(src.subclassLevel, 1, 20, 3);
      data.subclassName = line(src.subclassName, 60) || 'Subclass';
      data.castingAbility = pick(src.castingAbility, CASTING_ABILITIES, '');
      data.castingType = pick(src.castingType, CASTING_TYPES, '');
      data.features = (Array.isArray(src.features) ? src.features : []).slice(0, LIMITS.items).map(function (f) {
        return { id: typeof f.id === 'string' && /^[\w-]{1,40}$/.test(f.id) ? f.id : uid('f_'), level: int(f.level, 1, 20, 1), name: line(f.name, LIMITS.itemName), text: text(f.text, 4000) };
      });
    }
    if (kind === 'other') data.category = line(src.category, 40) || 'House rule';
    return {
      id: e.id || null,
      kind: kind,
      name: line(e.name, LIMITS.name).trim(),
      summary: line(e.summary, LIMITS.summary),
      data: data,
      version: Number.isFinite(Number(e.version)) ? Number(e.version) : 0,
      createdAt: e.createdAt || null,
      updatedAt: e.updatedAt || null,
    };
  }

  function validate(entry) {
    var errs = [];
    if (!entry.name || !String(entry.name).trim()) errs.push('Give it a name.');
    if (String(entry.name || '').length > LIMITS.name) errs.push('Keep the name under ' + LIMITS.name + ' characters.');
    if (!KINDS[entry.kind]) errs.push('Unknown homebrew type.');
    var d = entry.data || {};
    if (entry.kind === 'monster' || (entry.kind === 'npc' && d.hasStats)) {
      ACTION_LISTS.forEach(function (l) {
        (d[l.key] || []).forEach(function (it, i) {
          if (!String(it.name || '').trim()) errs.push(l.label + ': entry ' + (i + 1) + ' needs a name.');
        });
      });
    }
    if (entry.kind === 'spell' && d.material && !String(d.materials || '').trim()) errs.push('Describe the Material component, or untick M.');
    if (JSON.stringify(d).length > 95000) errs.push('This entry is too long to save. Shorten the descriptions.');
    return errs;
  }

  // ---------------------------------------------------------------------------
  // Stat block math
  // ---------------------------------------------------------------------------
  function derive(d) {
    var pb = pbForCr(d.cr);
    var mods = {};
    ABILS.forEach(function (a) { mods[a] = mod(d.abilities[a]); });
    var hpAvg = Math.max(1, avgDice(d.hitDice, HIT_DIE[d.size] || 8) + d.hitDice * mods.con);
    var skillBonus = {};
    Object.keys(d.skills).forEach(function (k) { skillBonus[k] = mods[SKILLS[k][1]] + pb * d.skills[k]; });
    var initMod = mods.dex + pb * d.initiativeProf;
    var percep = skillBonus.perception != null ? skillBonus.perception : mods.wis;
    return {
      pb: pb, mods: mods, xp: CR_XP[d.cr],
      hp: d.hpOverride != null ? d.hpOverride : hpAvg,
      hpFormula: d.hitDice + 'd' + (HIT_DIE[d.size] || 8) + (d.hitDice * mods.con ? (d.hitDice * mods.con > 0 ? ' + ' : ' − ') + Math.abs(d.hitDice * mods.con) : ''),
      hpAvg: hpAvg,
      saves: ABILS.reduce(function (o, a) { o[a] = mods[a] + (d.saves.indexOf(a) >= 0 ? pb : 0); return o; }, {}),
      skillBonus: skillBonus, initMod: initMod, passivePerception: 10 + percep,
    };
  }

  function lowerName(name) { return 'the ' + String(name || 'creature').toLowerCase(); }

  /** The rules text of an action / trait item, generated from its fields when it is an attack or a saving throw. */
  function itemText(it, d, dv) {
    if (it.mode === 'attack') {
      var m = dv.mods[it.ability];
      var hit = m + dv.pb + it.bonus;
      var dmgBonus = (it.addMod ? m : 0) + it.bonus;
      var reach = 'reach ' + it.reach + ' ft.';
      var range = 'range ' + (it.range || '30/120') + ' ft.';
      var where = it.attackType === 'melee' ? reach : it.attackType === 'ranged' ? range : reach + ' or ' + range;
      var dmg = it.dice > 0 ? damageExpr(it.dice, it.die, dmgBonus) + ' ' + it.damageType + ' damage' : (Math.max(1, 1 + dmgBonus)) + ' ' + it.damageType + ' damage';
      if (it.extraDice > 0 && it.extraType) dmg += ' plus ' + damageExpr(it.extraDice, it.extraDie, 0) + ' ' + it.extraType + ' damage';
      var rider = String(it.text || '').trim();
      return '_' + ATTACK_TYPES[it.attackType] + ' Attack Roll:_ ' + signed(hit) + ', ' + where + ' _Hit:_ ' + dmg + (rider ? (/^[,.;]/.test(rider) ? '' : '. ') + rider : '.');
    }
    if (it.mode === 'save') {
      var dc = 8 + dv.pb + dv.mods[it.dcAbility];
      var fail = it.dice > 0 ? damageExpr(it.dice, it.die, 0) + ' ' + it.damageType + ' damage.' : '';
      var extra = String(it.failure || '').trim();
      var success = String(it.success || '').trim();
      return '_' + ABIL_NAME[it.save] + ' Saving Throw:_ DC ' + dc + ', ' + (it.targets || 'one creature within 5 feet').replace(/\.$/, '') + '.' +
        ' _Failure:_ ' + [fail, extra].filter(Boolean).join(' ') + (success ? ' _Success:_ ' + success : '') +
        (String(it.text || '').trim() ? '\n' + String(it.text).trim() : '');
    }
    return String(it.text || '');
  }

  function legendaryIntro(entry) {
    var n = lowerName(entry.name);
    return 'Legendary Action Uses: ' + entry.data.legendaryUses + '. Immediately after another creature\'s turn, ' + n + ' can expend a use to take one of the following actions. ' +
      n.charAt(0).toUpperCase() + n.slice(1) + ' regains all expended uses at the start of each of its turns.';
  }

  /** Monster / NPC stat block → the entry shape the Monsters & Spells page renders (same fields as the SRD data). */
  function toMonster(entry) {
    var e = normalize(entry);
    var d = e.data;
    var dv = derive(d);
    var skills = Object.keys(dv.skillBonus).sort().map(function (k) { return SKILLS[k][0] + ' ' + signed(dv.skillBonus[k]); }).join(', ');
    var senses = (d.senses ? d.senses.replace(/[;,\s]+$/, '') + '; ' : '') + 'Passive Perception ' + dv.passivePerception;
    var items = function (key) {
      return d[key].map(function (it) { return { name: it.name || 'Unnamed', text: itemText(it, d, dv) }; });
    };
    return {
      id: e.id || 'draft', hbId: e.id, name: e.name || 'Unnamed', group: e.kind === 'npc' ? 'NPC' : null, source: 'Homebrew',
      alignment: d.alignment, size: d.size, type: d.type, typeTags: d.typeTags || null,
      ac: String(d.ac) + (d.acNote ? ' (' + d.acNote + ')' : ''),
      initiative: signed(dv.initMod) + ' (' + (10 + dv.initMod) + ')',
      hp: dv.hp + (d.hpOverride != null ? '' : ' (' + dv.hpFormula + ')'), hpAverage: dv.hp,
      speed: d.speed,
      // The SRD's ability table prints minus as a plain hyphen (its Initiative line uses the true minus sign).
      abilities: ABILS.reduce(function (o, a) { o[a] = { score: d.abilities[a], mod: signed(dv.mods[a]).replace('−', '-'), save: signed(dv.saves[a]).replace('−', '-') }; return o; }, {}),
      skills: skills || null,
      vulnerabilities: d.vulnerabilities || null, resistances: d.resistances || null, immunities: d.immunities || null,
      gear: d.gear || null, senses: senses, languages: d.languages || 'None',
      cr: d.cr, crValue: crValue(d.cr), crDetails: 'XP ' + (d.cr === '0' ? '0 or 10' : dv.xp.toLocaleString('en-US')) + '; PB ' + signed(dv.pb),
      xp: dv.xp, proficiencyBonus: dv.pb,
      traits: items('traits'), actions: items('actions'), bonusActions: items('bonusActions'), reactions: items('reactions'),
      legendaryActions: items('legendaryActions'), legendaryIntro: d.legendaryActions.length ? legendaryIntro(e) : null,
      description: d.description, complete: true,
    };
  }

  /** Spell → the shape the Monsters & Spells page renders (same fields as the SRD spell data). */
  function toSpell(entry) {
    var e = normalize(entry);
    var d = e.data;
    var comps = [d.verbal ? 'V' : '', d.somatic ? 'S' : '', d.material ? 'M (' + (d.materials || '…') + ')' : ''].filter(Boolean).join(', ');
    return {
      id: e.id || 'draft', hbId: e.id, name: e.name || 'Unnamed', level: d.level, school: d.school, classes: d.classes.slice(),
      castingTime: d.castingTime + (d.ritual ? ' or Ritual' : ''), ritual: d.ritual, range: d.range, components: comps || 'None',
      duration: (d.concentration && !/^Concentration/i.test(d.duration) ? 'Concentration, up to ' : '') + d.duration, concentration: d.concentration,
      description: d.description, higherLevels: d.higherLevels || null, complete: true,
    };
  }

  /** One-line description for cards and lists. */
  function subtitle(entry) {
    var d = entry.data || {};
    if (entry.kind === 'monster' || (entry.kind === 'npc' && d.hasStats)) {
      return (entry.kind === 'npc' && d.role ? d.role + ' · ' : '') + d.size + ' ' + d.type + ' · CR ' + d.cr;
    }
    if (entry.kind === 'npc') return d.role || 'NPC (no combat stats)';
    if (entry.kind === 'spell') return (d.level === 0 ? d.school + ' cantrip' : 'Level ' + d.level + ' ' + d.school) + (d.concentration ? ' · Concentration' : '') + (d.ritual ? ' · Ritual' : '');
    if (entry.kind === 'magic-item') return itemLine(d);
    if (entry.kind === 'feat') return featLine(d);
    if (entry.kind === 'race') return raceLine(d);
    if (entry.kind === 'class') return classLine(d);
    return d.category || 'Other';
  }
  function itemLine(d) {
    return d.category + (d.baseItem ? ' (' + d.baseItem + ')' : '') + ', ' + d.rarity +
      (d.attunement ? ' (Requires Attunement' + (d.attunementBy ? ' by ' + d.attunementBy : '') + ')' : '');
  }
  function featLine(d) {
    return d.category + ' Feat' + (d.prerequisite ? ' (Prerequisite: ' + d.prerequisite + ')' : '') + (d.repeatable ? ' · Repeatable' : '');
  }

  function raceLine(d) {
    return d.size + ' · Speed ' + d.speed + ' ft.' + (d.darkvision ? ' · Darkvision ' + d.darkvision + ' ft.' : '') +
      (d.baseRace && d.baseRace !== 'Custom' ? ' (based on ' + d.baseRace + ')' : '');
  }
  function classLine(d) {
    return 'Hit Die d' + d.hitDie + (d.castingAbility ? ' · Spellcaster' : '') +
      (d.baseClass && d.baseClass !== 'Custom' ? ' (based on ' + d.baseClass + ')' : '');
  }

  function toRace(entry) {
    var e = normalize(entry);
    var d = e.data;
    return {
      id: e.id || 'draft', hbId: e.id, name: e.name || 'Unnamed', source: 'Homebrew',
      baseRace: d.baseRace, size: d.size, speed: d.speed, darkvision: d.darkvision,
      abilityIncreases: d.abilityIncreases, languages: d.languages.slice(),
      traits: d.traits.map(function (t) { return { name: t.name, text: t.text }; }),
      description: d.description,
    };
  }

  function toClass(entry) {
    var e = normalize(entry);
    var d = e.data;
    return {
      id: e.id || 'draft', hbId: e.id, name: e.name || 'Unnamed', source: 'Homebrew',
      baseClass: d.baseClass, hitDie: d.hitDie,
      savingThrows: d.savingThrows.slice(),
      skillChoices: d.skillChoices,
      skillList: d.skillList.map(function (k) { return SKILLS[k] ? SKILLS[k][0] : k; }),
      proficiencies: d.proficiencies, equipment: d.equipment,
      subclassLevel: d.subclassLevel, subclassName: d.subclassName,
      castingAbility: d.castingAbility ? ABIL_NAME[d.castingAbility] : null,
      castingType: d.castingType || null,
      features: d.features.map(function (f) { return { level: f.level, name: f.name, text: f.text }; }),
      description: d.description,
    };
  }

  function duplicate(entry) {
    var c = normalize(clone(entry));
    c.id = null;
    c.version = 0;
    c.name = (c.name + ' (copy)').slice(0, LIMITS.name);
    ['traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions'].forEach(function (k) {
      if (Array.isArray(c.data[k])) c.data[k].forEach(function (it) { it.id = uid('a_'); });
    });
    return c;
  }

  /** Sort key used by the library: CR for creatures, level for spells, rarity for items. */
  function rank(entry) {
    var d = entry.data || {};
    if (entry.kind === 'monster' || entry.kind === 'npc') return d.cr != null ? crValue(d.cr) : -1;
    if (entry.kind === 'spell') return d.level;
    if (entry.kind === 'magic-item') return RARITIES.indexOf(d.rarity);
    if (entry.kind === 'race') return d.speed || 30;
    if (entry.kind === 'class') return d.hitDie || 8;
    return 0;
  }

  global.FogHomebrewModel = {
    LIMITS: LIMITS, KINDS: KINDS, KIND_ORDER: KIND_ORDER, ABILS: ABILS, ABIL_NAME: ABIL_NAME, SIZES: SIZES, HIT_DIE: HIT_DIE,
    TYPES: TYPES, ALIGNMENTS: ALIGNMENTS, DIE_SIZES: DIE_SIZES, DAMAGE_TYPES: DAMAGE_TYPES, SKILLS: SKILLS, CR_LIST: CR_LIST, CR_XP: CR_XP,
    ACTION_LISTS: ACTION_LISTS, ITEM_MODES: ITEM_MODES, ATTACK_TYPES: ATTACK_TYPES, SCHOOLS: SCHOOLS, SPELL_CLASSES: SPELL_CLASSES,
    CASTING_TIMES: CASTING_TIMES, ITEM_CATEGORIES: ITEM_CATEGORIES, RARITIES: RARITIES, FEAT_CATEGORIES: FEAT_CATEGORIES,
    OTHER_CATEGORIES: OTHER_CATEGORIES, RACE_SIZES: RACE_SIZES, BASE_RACES: BASE_RACES, LANGUAGES: LANGUAGES,
    BASE_CLASSES: BASE_CLASSES, CLASS_HIT_DICE: CLASS_HIT_DICE, CASTING_ABILITIES: CASTING_ABILITIES, CASTING_TYPES: CASTING_TYPES,
    newEntry: newEntry, newItem: newItem, normalize: normalize, validate: validate, derive: derive, itemText: itemText,
    toMonster: toMonster, toSpell: toSpell, toRace: toRace, toClass: toClass,
    subtitle: subtitle, itemLine: itemLine, featLine: featLine, raceLine: raceLine, classLine: classLine, duplicate: duplicate, rank: rank,
    artUrl: artUrl, IMAGE_PATH: IMAGE_PATH,
    mod: mod, signed: signed, pbForCr: pbForCr, crValue: crValue, damageExpr: damageExpr, hasStatBlock: function (e) { return e.kind === 'monster' || (e.kind === 'npc' && !!(e.data && e.data.hasStats)); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
