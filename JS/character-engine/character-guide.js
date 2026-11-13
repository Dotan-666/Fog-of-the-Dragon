/**
 * Character Guide — a deterministic, rules-based guide built from a character's actual data.
 *
 * Mechanics come only from the rules engine (FogDeriveCharacter, FogCharacterOptions) and the
 * SRD 5.2.1 text of each feature. Advice (how to play, mistakes) is written per class and shown only
 * for features the character actually has. No AI is involved; the optional AI layer (guide-ai.js)
 * may only rephrase this output and is validated against it.
 */
(function (global) {
  'use strict';

  var Api = function () { return global.FogRulesApi; };
  var Opt = function () { return global.FogCharacterOptions; };

  var GUIDE_VERSION = 1;

  // ---------------------------------------------------------------------------
  // Class profiles: roles and advice. `f` = feature name the character must have; `s` = spell id.
  // ---------------------------------------------------------------------------
  var PROFILES = {
    barbarian: {
      roles: ['Frontline defender', 'Melee damage'],
      identity: 'A Barbarian is a fierce warrior powered by Rage, with the largest Hit Die in the game (d12).',
      combat: [
        { f: 'Rage', t: 'Enter Rage as a Bonus Action at the start of a fight, then attack. Keep it going each turn by attacking an enemy, forcing a saving throw, or using a Bonus Action to extend it.' },
        { f: 'Reckless Attack', t: 'Attack recklessly when hitting matters most. Enemies also get Advantage against you until your next turn, so do it while raging.' },
        { f: 'Extra Attack', t: 'You attack twice whenever you take the Attack action.' },
        { f: 'Weapon Mastery', t: 'Your mastered weapons add their mastery effect on every attack, so fight with them.' },
        { t: 'Stand in front of your allies: your Hit Points and Rage’s damage Resistance let you take hits they can’t.' },
        { f: 'Danger Sense', t: 'Danger Sense gives you Advantage on Dexterity saving throws, so area spells and traps are less scary for you.' },
      ],
      outside: [
        { t: 'Use Strength (Athletics) for climbing, jumping, swimming and shoving things around.' },
        { f: 'Primal Knowledge', t: 'While raging you can make Acrobatics, Intimidation, Perception, Stealth or Survival checks as Strength checks.' },
      ],
      priorities: ['Strength first, then Constitution.', 'Dexterity also adds to your Unarmored Defense AC.'],
      mistakes: [
        { f: 'Rage', t: 'You can’t enter Rage in Heavy armor, and you can’t cast spells or keep Concentration while raging.' },
        { f: 'Rage', t: 'Rage damage only applies to attacks that use Strength, not to Dexterity-based attacks.' },
        { f: 'Rage', t: 'Rage ends at the end of your next turn unless you extend it, so keep attacking or use a Bonus Action to extend it.' },
      ],
      strengths: ['The most Hit Points of any class', 'Resistance to Bludgeoning, Piercing and Slashing damage while raging', 'Strong, simple melee damage'],
      weaknesses: ['Few ranged options', 'No spellcasting'],
    },
    bard: {
      roles: ['Support', 'Face (social encounters)', 'Utility caster'],
      identity: 'A Bard is a performer whose words and music carry magic, inspiring allies and casting spells with Charisma.',
      combat: [
        { f: 'Bardic Inspiration', t: 'As a Bonus Action, give an ally your Bardic Inspiration die before a hard roll; they can add it to a failed D20 Test within the next hour.' },
        { f: 'Cutting Words', t: 'Use Cutting Words as a Reaction to subtract your Bardic Inspiration die from an enemy’s damage roll or successful attack roll or ability check.' },
        { s: 'healing-word', t: 'Keep a slot for Healing Word: a Bonus Action that brings a fallen ally back from 0 Hit Points.' },
        { s: 'vicious-mockery', t: 'Vicious Mockery is a damage cantrip that also gives the target Disadvantage on its next attack.' },
        { t: 'Your best turns usually use a spell that controls or weakens enemies rather than raw damage.' },
      ],
      outside: [
        { t: 'You are the party’s natural speaker: Charisma checks such as Persuasion, Deception and Performance are your strength.' },
        { f: 'Jack of All Trades', t: 'Jack of All Trades adds half your Proficiency Bonus to every skill check you aren’t proficient in.' },
        { f: 'Expertise', t: 'Your Expertise skills double your Proficiency Bonus; use them whenever they apply.' },
      ],
      priorities: ['Charisma first.', 'Then Dexterity (AC and Dexterity saves) and Constitution (Hit Points and Concentration).'],
      mistakes: [
        { f: 'Bardic Inspiration', t: 'Bardic Inspiration is given to another creature, not to yourself.' },
        { t: 'You change prepared spells only one at a time when you gain a level, so choose them carefully.' },
      ],
      strengths: ['Very flexible skills', 'Support and healing magic', 'Social encounters'],
      weaknesses: ['Light armor and a d8 Hit Die', 'Relies on allies for heavy damage at low levels'],
    },
    cleric: {
      roles: ['Healer', 'Support', 'Frontline caster'],
      identity: 'A Cleric channels divine power to heal, protect and strike, with Wisdom-based spells and Channel Divinity.',
      combat: [
        { s: 'bless', t: 'Bless (Concentration) lets up to three creatures add 1d4 to their attack rolls and saving throws; cast it early in a fight.' },
        { s: 'spirit-guardians', t: 'Spirit Guardians damages and slows enemies around you every turn; move close to them while you concentrate.' },
        { s: 'healing-word', t: 'Use Healing Word (Bonus Action, 60 feet) to bring a downed ally back, then still use your action.' },
        { f: 'Channel Divinity', t: 'Channel Divinity: Divine Spark heals or deals Necrotic or Radiant damage; Turn Undead makes Undead flee.' },
        { s: 'sacred-flame', t: 'Sacred Flame is a ranged damage cantrip; the target gets no benefit from Half or Three-Quarters Cover against it.' },
      ],
      outside: [
        { s: 'guidance', t: 'Guidance lets an ally add 1d4 to ability checks with one skill you choose; cast it before an important check.' },
        { t: 'Change any of your prepared spells after a Long Rest to fit the day’s plans.' },
        { t: 'Wisdom checks such as Insight and Medicine, and Intelligence (Religion) for lore, suit you well.' },
      ],
      priorities: ['Wisdom first.', 'Then Constitution, to keep Concentration and to survive.', 'Strength or Dexterity for your armor and weapon.'],
      mistakes: [
        { t: 'Healing every scratch in combat uses slots quickly; stopping damage with Bless or control spells often helps more, and any healing gets a fallen ally back up.' },
        { t: 'After casting a slot spell as a Bonus Action (like Healing Word), your action can’t be another slot spell; a cantrip is still fine.' },
      ],
      strengths: ['Healing and support magic', 'Medium armor and Shield training', 'Strong Wisdom saving throws'],
      weaknesses: ['Few ranged damage options at low levels', 'Many strong spells compete for Concentration'],
    },
    druid: {
      roles: ['Controller', 'Healer', 'Shapeshifter'],
      identity: 'A Druid draws on nature: Wisdom-based spells, the secret Druidic language and, from level 2, Wild Shape.',
      combat: [
        { f: 'Wild Shape', t: 'Wild Shape (Bonus Action) turns you into a known Beast form and gives Temporary Hit Points equal to your Druid level. You can’t cast spells while shape-shifted.' },
        { s: 'entangle', t: 'Entangle can Restrain enemies in an area; good at the start of a fight.' },
        { s: 'shillelagh', t: 'Shillelagh makes your Quarterstaff or Club use Wisdom and a d8 damage die for melee attacks.' },
        { s: 'healing-word', t: 'Healing Word is a Bonus Action that picks up a fallen ally from 60 feet away.' },
      ],
      outside: [
        { f: 'Wild Shape', t: 'Use a small or fast Beast form to scout ahead.' },
        { t: 'You always have Speak with Animals prepared, which is great for gathering information in the wild.' },
        { t: 'Change any of your prepared spells after a Long Rest.' },
      ],
      priorities: ['Wisdom first.', 'Then Constitution and Dexterity.'],
      mistakes: [
        { f: 'Wild Shape', t: 'Cast a Concentration spell before you Wild Shape: you can’t cast spells in Beast form, but shifting doesn’t end Concentration.' },
      ],
      strengths: ['Battlefield control spells', 'Healing', 'Flexible Beast forms'],
      weaknesses: ['A d8 Hit Die and limited armor (unless Warden)', 'Few weapon options'],
    },
    fighter: {
      roles: ['Frontline', 'Weapon damage'],
      identity: 'A Fighter is a master of weapons and armor, with more feats than any other class, Second Wind and Action Surge.',
      combat: [
        { f: 'Weapon Mastery', t: 'Use your mastered weapons: Graze and Cleave reward big weapons, Topple and Push control enemies, Vex and Sap help you and your allies hit.' },
        { f: 'Second Wind', t: 'Second Wind (Bonus Action) heals 1d10 + your Fighter level; it partly recharges on a Short Rest.' },
        { f: 'Action Surge', t: 'Action Surge gives one extra action on your turn (not the Magic action). Use it for a second Attack action on an important turn.' },
        { f: 'Extra Attack', t: 'You attack more than once whenever you take the Attack action.' },
        { t: 'Protect softer allies by standing between them and enemies.' },
      ],
      outside: [
        { t: 'Strength (Athletics) is useful for climbing, swimming and grappling.' },
        { f: 'Tactical Mind', t: 'When you fail an ability check, you can spend a Second Wind use to add 1d10; it isn’t spent if you still fail.' },
      ],
      priorities: ['Strength (or Dexterity for ranged or Finesse fighters) first.', 'Then Constitution.'],
      mistakes: [
        { f: 'Action Surge', t: 'Action Surge can’t be used for the Magic action.' },
        { t: 'Heavy weapons give Disadvantage on attacks if your Strength is below 13 (Dexterity for Heavy ranged weapons).' },
      ],
      strengths: ['Every armor and weapon training', 'The most feats and Ability Score Improvements', 'Reliable damage every turn'],
      weaknesses: ['Few tools outside combat', 'No spellcasting'],
    },
    monk: {
      roles: ['Skirmisher', 'Mobile striker'],
      identity: 'A Monk fights without armor, using Unarmed Strikes, simple weapons and Focus Points.',
      combat: [
        { f: 'Martial Arts', t: 'Take the Attack action, then make an Unarmed Strike as a Bonus Action with your Martial Arts die.' },
        { f: 'Monk\'s Focus', t: 'Flurry of Blows (1 Focus Point) makes two Unarmed Strikes as a Bonus Action; Patient Defense and Step of the Wind help you defend or escape.' },
        { f: 'Deflect Attacks', t: 'When an attack hits you with Bludgeoning, Piercing or Slashing damage, use Deflect Attacks (Reaction) to reduce the damage.' },
        { f: 'Stunning Strike', t: 'Once per turn after a hit, spend 1 Focus Point for Stunning Strike against a dangerous enemy.' },
        { t: 'Use your speed to reach enemy spellcasters and archers.' },
      ],
      outside: [
        { t: 'Dexterity (Acrobatics, Stealth) and Strength (Athletics) checks suit you.' },
        { f: 'Slow Fall', t: 'Slow Fall reduces falling damage as a Reaction.' },
      ],
      priorities: ['Dexterity and Wisdom (both raise your AC).', 'Then Constitution.'],
      mistakes: [
        { f: 'Martial Arts', t: 'Wearing armor or using a Shield turns off Martial Arts, Unarmored Defense and Unarmored Movement.' },
        { f: 'Monk\'s Focus', t: 'Focus Points come back on a Short Rest, so ask the party for Short Rests.' },
      ],
      strengths: ['Fast and mobile', 'Several attacks every turn', 'Good saving throws, all of them from level 14'],
      weaknesses: ['A d8 Hit Die for a melee character', 'Depends on Focus Points'],
    },
    paladin: {
      roles: ['Frontline', 'Burst damage', 'Support'],
      identity: 'A Paladin is a holy warrior bound by an oath, with heavy armor, Lay on Hands and divine magic.',
      combat: [
        { s: 'divine-smite', t: 'Cast Divine Smite as a Bonus Action right after you hit with a melee weapon for extra Radiant damage; you choose after you know you hit.' },
        { f: 'Lay On Hands', t: 'Lay on Hands (Bonus Action) restores Hit Points from a pool of five times your Paladin level.' },
        { f: 'Aura of Protection', t: 'Stay within 10 feet of your allies so they add your Charisma modifier to their saving throws.' },
        { f: 'Extra Attack', t: 'You attack twice with the Attack action, which means two chances to smite.' },
        { s: 'bless', t: 'Bless (Concentration) helps the whole front line hit and save.' },
      ],
      outside: [
        { t: 'Charisma (Persuasion) and Wisdom (Insight) help you lead conversations.' },
      ],
      priorities: ['Strength and Charisma.', 'Then Constitution.'],
      mistakes: [
        { s: 'divine-smite', t: 'Divine Smite is a spell that uses a slot (plus one free casting per Long Rest), so you can’t cast another slot spell on the same turn.' },
        { t: 'Your spell slots are limited (half caster); spread them over the adventuring day.' },
      ],
      strengths: ['Heavy armor and Shield training', 'Healing with Lay on Hands', 'A party-wide saving throw bonus from level 6'],
      weaknesses: ['Few ranged options', 'Fewer and lower-level spell slots than full casters'],
    },
    ranger: {
      roles: ['Ranged damage', 'Scout', 'Tracker'],
      identity: 'A Ranger is a hunter and explorer who mixes weapons with nature magic and Hunter’s Mark.',
      combat: [
        { s: 'hunters-mark', t: 'Cast Hunter’s Mark (Bonus Action, Concentration) on your main target; Favored Enemy gives you free casts.' },
        { f: 'Extra Attack', t: 'You attack twice with the Attack action, and each hit adds Hunter’s Mark damage.' },
        { f: 'Weapon Mastery', t: 'Use your mastered weapons, for example Vex on a Shortbow or Slow on a Longbow.' },
        { t: 'Stay at range when you can.' },
      ],
      outside: [
        { t: 'Survival, Perception and Stealth make you the party’s guide and scout.' },
        { f: 'Deft Explorer', t: 'Deft Explorer gives you Expertise in one skill and two extra languages.' },
        { f: 'Roving', t: 'Roving raises your Speed by 10 feet (not in Heavy armor) and gives you Climb and Swim Speeds.' },
      ],
      priorities: ['Dexterity first.', 'Then Wisdom and Constitution.'],
      mistakes: [
        { t: 'Ranged attacks have Disadvantage when an enemy that can see you is within 5 feet of you.' },
        { s: 'hunters-mark', t: 'Hunter’s Mark needs Concentration, so another Concentration spell ends it.' },
      ],
      strengths: ['Strong ranged weapon damage', 'Exploration and tracking', 'Useful nature spells'],
      weaknesses: ['Half caster: fewer spell slots', 'Hunter’s Mark competes for Concentration'],
    },
    rogue: {
      roles: ['Skill expert', 'Single-target damage', 'Scout'],
      identity: 'A Rogue relies on skill, stealth and one precise strike per turn with Sneak Attack.',
      combat: [
        { f: 'Sneak Attack', t: 'Once per turn, add Sneak Attack damage when you hit with a Finesse or ranged weapon and have Advantage, or an ally is within 5 feet of the target (and you don’t have Disadvantage).' },
        { f: 'Cunning Action', t: 'Cunning Action lets you Dash, Disengage or Hide as a Bonus Action: attack, then get to safety.' },
        { f: 'Steady Aim', t: 'If you haven’t moved, Steady Aim (Bonus Action) gives Advantage on your next attack this turn.' },
        { f: 'Uncanny Dodge', t: 'Uncanny Dodge (Reaction) halves the damage of an attack that hits you.' },
        { f: 'Cunning Strike', t: 'Cunning Strike lets you trade Sneak Attack dice for effects such as poisoning or tripping the target.' },
      ],
      outside: [
        { f: 'Expertise', t: 'Use your Expertise skills whenever they fit; you are the party’s specialist.' },
        { t: 'Thieves’ Tools let you pick locks and disarm traps.' },
        { f: 'Reliable Talent', t: 'Reliable Talent treats any d20 roll of 9 or lower as 10 for your proficient checks.' },
      ],
      priorities: ['Dexterity first.', 'Then Constitution, and a mental ability that fits your skills.'],
      mistakes: [
        { f: 'Sneak Attack', t: 'Sneak Attack works only once per turn and only with Finesse or ranged weapons.' },
        { t: 'Ranged attacks have Disadvantage when an enemy that can see you is within 5 feet of you.' },
      ],
      strengths: ['Expertise in key skills', 'Big single hits with Sneak Attack', 'Many ways to avoid damage'],
      weaknesses: ['Light armor and a d8 Hit Die', 'Depends on Advantage or allies for Sneak Attack'],
    },
    sorcerer: {
      roles: ['Blaster', 'Controller'],
      identity: 'A Sorcerer has magic in the blood, casting with Charisma and reshaping spells with Metamagic.',
      combat: [
        { f: 'Innate Sorcery', t: 'Innate Sorcery (Bonus Action, twice per Long Rest) gives Advantage on Sorcerer spell attacks and +1 to their save DC for 1 minute.' },
        { f: 'Metamagic', t: 'Spend Sorcery Points on Metamagic to change spells, for example casting an action spell as a Bonus Action with Quickened Spell.' },
        { f: 'Font of Magic', t: 'Convert Sorcery Points into spell slots (or slots into points) when you run low.' },
        { t: 'Stay behind your allies and use a damage cantrip on turns you don’t need a slot.' },
      ],
      outside: [
        { t: 'Charisma checks such as Persuasion and Deception suit you.' },
      ],
      priorities: ['Charisma first.', 'Then Constitution (Hit Points and Concentration) and Dexterity.'],
      mistakes: [
        { t: 'You can expend only one spell slot per turn; Quickened Spell doesn’t let you cast two slot spells.' },
        { t: 'You change prepared spells only one at a time when you gain a level.' },
      ],
      strengths: ['Flexible spells thanks to Metamagic', 'Strong damage spells', 'Constitution saving throw proficiency for Concentration'],
      weaknesses: ['Low Hit Points (d6)', 'No armor training'],
    },
    warlock: {
      roles: ['Ranged damage', 'Utility'],
      identity: 'A Warlock gains magic from a pact with an otherworldly patron and customizes it with Eldritch Invocations.',
      combat: [
        { s: 'eldritch-blast', t: 'Eldritch Blast is your reliable attack every turn; it fires more beams at levels 5, 11 and 17.' },
        { s: 'hex', t: 'Hex (Bonus Action, Concentration) adds 1d6 Necrotic damage to every hit on its target.' },
        { f: 'Pact Magic', t: 'You have few slots, but they are all your highest level and come back on a Short Rest; spend them freely between rests.' },
      ],
      outside: [
        { f: 'Eldritch Invocations', t: 'Some invocations, like Mask of Many Faces or Misty Visions, are great utility outside combat.' },
        { f: 'Magical Cunning', t: 'Magical Cunning restores some Pact Magic slots after a 1-minute rite, once per Long Rest.' },
      ],
      priorities: ['Charisma first.', 'Then Constitution and Dexterity.'],
      mistakes: [
        { f: 'Pact Magic', t: 'Pact Magic slots return on a Short Rest, so ask the party for Short Rests.' },
        { f: 'Pact Magic', t: 'Every spell you cast with a slot is cast at your slot level, even level 1 spells.' },
      ],
      strengths: ['Reliable at-will damage', 'Slots recharge on a Short Rest', 'Highly customizable'],
      weaknesses: ['Very few spell slots', 'Light armor only'],
    },
    wizard: {
      roles: ['Controller', 'Utility', 'Blaster'],
      identity: 'A Wizard studies arcane magic from a spellbook and has the largest spell list in the game.',
      combat: [
        { s: 'shield', t: 'Keep a slot for Shield: +5 AC as a Reaction when you are hit.' },
        { s: 'magic-missile', t: 'Magic Missile always hits and is good for finishing weakened enemies.' },
        { t: 'Control spells (like Sleep or Web) that stop several enemies often matter more than damage.' },
        { t: 'Stay behind your allies and use a cantrip when you don’t need a slot.' },
      ],
      outside: [
        { f: 'Ritual Adept', t: 'Ritual Adept lets you cast Ritual spells from your spellbook without preparing them and without a slot.' },
        { f: 'Arcane Recovery', t: 'Arcane Recovery restores some spell slots after a Short Rest, once per Long Rest.' },
        { t: 'Intelligence checks such as Arcana, History and Investigation suit you.' },
      ],
      priorities: ['Intelligence first.', 'Then Constitution and Dexterity.'],
      mistakes: [
        { t: 'You have no armor training: wearing armor stops you from casting spells.' },
        { t: 'You can prepare only spells that are in your spellbook.' },
      ],
      strengths: ['The largest spell selection', 'Rituals without spending slots', 'Strong Intelligence and Wisdom saves'],
      weaknesses: ['Low Hit Points (d6)', 'No armor training'],
    },
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function signed(n) {
    return (n >= 0 ? '+' : '') + n;
  }

  function cap(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function abilityName(a) {
    return Api().rules().abilityNames[a] || a;
  }

  /** A short, stable hash of the character's rules-relevant content (for cache keys and staleness). */
  function contentHash(doc) {
    var str = JSON.stringify({ c: doc.choices, n: doc.narrative && doc.narrative.name, v: GUIDE_VERSION, r: Api().rules().meta.id });
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  /** Split SRD text into sentences (keeps the official wording). */
  function sentences(text) {
    return String(text || '').replace(/\*\*|_/g, '').replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+(?=[A-Z])/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function firstSentences(text, n) {
    return sentences(text).slice(0, n || 2).join(' ');
  }

  /** How a feature is used, read from its SRD text. */
  function actionType(text) {
    var t = String(text || '');
    if (/\b[Aa]s a Bonus Action\b|\btake a Bonus Action\b|\buse a Bonus Action\b/.test(t)) return 'Bonus Action';
    if (/\btake a Reaction\b|\bas a Reaction\b|\bReaction to\b/i.test(t)) return 'Reaction';
    if (/\bAs a Magic action\b|\bMagic action\b/.test(t) && !/except the Magic action/.test(t)) return 'Action (Magic)';
    if (/\bAttack action\b/.test(t)) return 'Part of the Attack action';
    if (/no action required/i.test(t)) return 'No action';
    return 'Always on';
  }

  function recharge(text) {
    // Only wording about regaining uses counts ("you regain …", "can't … again until you finish …").
    var t = sentences(text).filter(function (s) { return /\bregain|again until you finish|expended uses?\b|unavailable until|replenishes/.test(s); }).join(' ');
    var either = /Short or Long Rest/.test(t);
    var short = either || /Short Rest/.test(t);
    var long = /Long Rest/.test(t);
    if (either && !/\bShort Rest\b(?! or)/.test(t.replace(/Short or Long Rest/g, ''))) return 'Recharges on a Short or Long Rest';
    if (short && long) return 'Recharges partly on a Short Rest, fully on a Long Rest (see text)';
    if (short) return 'Recharges on a Short Rest';
    if (long) return 'Recharges on a Long Rest';
    if (/[Oo]nce per turn|Once on each of your turns/.test(String(text || ''))) return 'Once per turn';
    return null;
  }

  /** Sentences from the SRD text that state limits (verbatim). */
  function limitsOf(text, skip) {
    return sentences(text).slice(skip || 0).filter(function (s) {
      return /\b(can't|cannot|can’t|only|once per|until you finish|must|unless|ends early|no more than|up to)\b/i.test(s);
    }).slice(0, 2);
  }

  var RESOURCE_FOR_FEATURE = {
    Rage: 'rages', 'Second Wind': 'secondWind', 'Channel Divinity': 'channelDivinity', 'Wild Shape': 'wildShape',
    'Bardic Inspiration': 'bardicUses', 'Monk\'s Focus': 'focusPoints', 'Font of Magic': 'sorceryPoints', 'Favored Enemy': 'favoredEnemy',
    'Lay On Hands': 'layOnHands', 'Sneak Attack': 'sneakAttack', 'Martial Arts': 'martialArts', 'Eldritch Invocations': 'invocations',
  };

  // ---------------------------------------------------------------------------
  // Facts about the character used by gating and synergies
  // ---------------------------------------------------------------------------
  function facts(doc, d) {
    var c = doc.choices;
    var o = Opt();
    var lvl = c.level || 1;
    var sub = o.subclassAvailable(doc) ? o.currentSubclass(doc) : null;
    var featureNames = {};
    d.features.forEach(function (f) { featureNames[f.name] = true; });
    var spells = {};
    var addSpell = function (id) { if (id) spells[id] = true; };
    if (d.spellcasting) {
      d.spellcasting.cantrips.concat(d.spellcasting.prepared, d.spellcasting.alwaysPrepared).forEach(addSpell);
      (d.spellcasting.spellbook || []).forEach(addSpell);
      (d.spellcasting.arcanum || []).forEach(function (a) { addSpell(a.spellId); });
    }
    d.otherSpells.forEach(function (s) { addSpell(s.spellId); });
    var feats = {};
    o.featSlots(doc).forEach(function (slot) {
      var inst = (c.feats || {})[slot.key];
      if (inst && inst.featId) feats[inst.featId] = true;
    });
    var invocations = o.invocationList(doc);
    var masteries = {};
    (c.weaponMasteries || []).forEach(function (id) {
      var w = Api().getWeapon(id);
      if (w) masteries[w.mastery] = true;
    });
    var weapons = d.attacks.filter(function (a) { return a.weaponId; }).map(function (a) { return Api().getWeapon(a.weaponId); }).filter(Boolean);
    return {
      doc: doc, d: d, lvl: lvl, cls: Api().getClass(c.classId), sub: sub, featureNames: featureNames, spells: spells, feats: feats,
      invocations: invocations, masteries: masteries, weapons: weapons, metamagic: (c.classOptions || {}).metamagic || [],
    };
  }

  function hasFeature(F, name) {
    return !!F.featureNames[name];
  }

  function gate(F, item) {
    if (item.f && !hasFeature(F, item.f)) return false;
    if (item.s && !F.spells[item.s]) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Synergy evaluation: now / available with another choice / future level / never
  // ---------------------------------------------------------------------------
  function classFeatureLevel(cls, sub, name) {
    var f = cls.features.find(function (x) { return x.name === name; });
    if (f) return f.level;
    var s = (sub || cls.subclass).features.find(function (x) { return x.name === name; });
    return s ? s.level : null;
  }

  /** First class level at which the class can have this spell (its list, always-prepared tables or Magical Secrets). */
  function spellReachLevel(cls, sub, spellId) {
    var sp = Api().getSpell(spellId);
    if (!sp || !cls) return null;
    var best = null;
    function consider(l) { if (l != null && (best == null || l < best)) best = l; }
    function byTable(table) {
      Object.keys(table || {}).forEach(function (l) { if (table[l].indexOf(spellId) >= 0) consider(Number(l)); });
    }
    byTable(cls.alwaysPrepared);
    byTable((sub || cls.subclass).alwaysPrepared);
    if (cls.spellcasting) {
      var onList = sp.classes.indexOf(cls.id) >= 0;
      var secrets = cls.magicalSecrets && cls.magicalSecrets.lists.some(function (l) { return sp.classes.indexOf(l) >= 0; });
      for (var L = 1; L <= 20; L++) {
        var entry = cls.levels[L];
        var ok = sp.level === 0 ? (entry.cantrips || 0) > 0 : Api().maxSpellLevel(cls.id, L) >= sp.level;
        if (ok && (onList || (secrets && L >= cls.magicalSecrets.level && sp.level > 0))) {
          consider(L);
          break;
        }
      }
    }
    return best;
  }

  /** Returns { met, reach } — reach is the lowest class level at which the requirement can be met (null: never). */
  function checkRequirement(F, r) {
    var cls = F.cls;
    var c = F.doc.choices;
    var o = Opt();
    if (!cls) return { met: false, reach: null };
    var sub = F.sub || null;
    var subForReach = sub || (Api().listSubclasses(cls.id).length === 1 ? cls.subclass : null);
    if (r.class) return { met: cls.id === r.class, reach: cls.id === r.class ? 1 : null };
    if (r.subclass) {
      if (sub) return { met: sub.id === r.subclass, reach: sub.id === r.subclass ? cls.subclassLevel : null };
      var possible = Api().listSubclasses(cls.id).some(function (s) { return s.id === r.subclass; });
      return { met: false, reach: possible ? cls.subclassLevel : null };
    }
    if (r.feature) {
      if (r.feature[0] !== cls.id) return { met: false, reach: null };
      var fl = classFeatureLevel(cls, subForReach, r.feature[1]);
      return { met: hasFeature(F, r.feature[1]), reach: fl };
    }
    if (r.spell) return { met: !!F.spells[r.spell], reach: spellReachLevel(cls, subForReach, r.spell) };
    if (r.otherSpell) return { met: F.d.otherSpells.some(function (s) { return s.spellId === r.otherSpell; }), reach: null };
    if (r.spellAny) {
      var any = r.spellAny.some(function (id) { return F.spells[id]; });
      var reaches = r.spellAny.map(function (id) { return spellReachLevel(cls, subForReach, id); }).filter(function (x) { return x != null; });
      return { met: any, reach: reaches.length ? Math.min.apply(null, reaches) : null };
    }
    if (r.invocation) {
      var inst = F.invocations.find(function (x) { return x.id === r.invocation && (!r.cantrip || x.cantrip === r.cantrip); });
      var inv = Api().getInvocation(r.invocation);
      if (!inv || cls.id !== 'warlock') return { met: false, reach: null };
      var reach = inv.minLevel;
      if (inv.requiresInvocation) reach = Math.max(reach, Api().getInvocation(inv.requiresInvocation).minLevel);
      if (r.cantrip) {
        var cr = spellReachLevel(cls, subForReach, r.cantrip);
        reach = cr == null ? null : Math.max(reach, cr);
      }
      return { met: !!inst, reach: reach };
    }
    if (r.metamagic) {
      var mm = (cls.choices || []).find(function (ch) { return ch.type === 'multi-option' && ch.optionsFrom === 'metamagic'; });
      return { met: F.metamagic.indexOf(r.metamagic) >= 0, reach: mm ? mm.level : null };
    }
    if (r.feat) {
      var feat = Api().getFeat(r.feat);
      if (!feat) return { met: false, reach: null };
      var featReach = null;
      if (feat.alternative) {
        var altCh = (cls.choices || []).find(function (ch) { return ch.alternative && ch.alternative.id === feat.id; });
        featReach = altCh ? altCh.level : null;
      } else if (feat.category === 'fighting-style') {
        var fs = (cls.choices || []).find(function (ch) { return ch.type === 'feat' && ch.featCategory === 'fighting-style'; });
        featReach = fs ? fs.level : null;
      } else if (feat.category === 'epic-boon') {
        featReach = 19;
      } else {
        var bgHas = Api().listBackgrounds().some(function (b) { return b.feat.id === feat.id; });
        featReach = bgHas ? 1 : cls.featLevels[0].level;
      }
      return { met: !!F.feats[r.feat], reach: featReach };
    }
    if (r.mastery) {
      var wm = o.weaponMasteryOptions(F.doc);
      var eligible = cls.weaponMastery && Object.values(Api().rules().weapons).some(function (w) {
        return w.mastery === r.mastery && (!wm || wm.from.indexOf(w.id) >= 0);
      });
      return { met: !!F.masteries[r.mastery], reach: eligible ? 1 : null };
    }
    if (r.weaponProperty) {
      var have = F.weapons.some(function (w) { return w.properties.some(function (p) { return p.indexOf(r.weaponProperty) === 0; }) && o.weaponProficient(F.doc, w); });
      var can = Object.values(Api().rules().weapons).some(function (w) { return w.properties.some(function (p) { return p.indexOf(r.weaponProperty) === 0; }) && o.weaponProficient(F.doc, w); });
      return { met: have, reach: can ? 1 : null };
    }
    if (r.weaponAny) {
      return { met: F.weapons.some(function (w) { return r.weaponAny.indexOf(w.id) >= 0; }), reach: 1 };
    }
    if (r.classOption) {
      var ch = (cls.choices || []).find(function (x) { return x.id === r.classOption[0]; });
      if (!ch || (ch.subclass && !subForReach)) return { met: false, reach: null };
      return { met: (c.classOptions || {})[r.classOption[0]] === r.classOption[1], reach: ch.subclass ? Math.max(ch.level, cls.subclassLevel) : ch.level };
    }
    if (r.affinitySpell) {
      var type = (c.classOptions || {}).elementalAffinity;
      var met = !!type && Object.keys(F.spells).some(function (id) { var sp = Api().getSpell(id); return sp && sp.damageTypes && sp.damageTypes.indexOf(type) >= 0; });
      return { met: met, reach: classFeatureLevel(cls, subForReach, 'Elemental Affinity') };
    }
    if (r.concentrationSpell) {
      return { met: Object.keys(F.spells).some(function (id) { var sp = Api().getSpell(id); return sp && sp.concentration; }), reach: cls.spellcasting ? 1 : null };
    }
    if (r.damageCantrip) {
      return { met: Object.keys(F.spells).some(function (id) { var sp = Api().getSpell(id); return sp && sp.level === 0 && sp.dealsDamage; }), reach: cls.spellcasting ? 1 : null };
    }
    if (r.noArmor) return { met: !F.d.combat.acArmor, reach: 1 };
    return { met: false, reach: null };
  }

  function evaluateSynergies(F) {
    var out = { now: [], option: [], future: [], situational: [] };
    (global.FogSynergies ? global.FogSynergies.list() : []).forEach(function (syn) {
      var results = syn.requires.map(function (r) { return checkRequirement(F, r); });
      if (results.some(function (x) { return !x.met && x.reach == null; })) return;
      var allMet = results.every(function (x) { return x.met; });
      var reach = Math.max.apply(null, results.map(function (x) { return x.met ? 1 : x.reach; }));
      var entry = { id: syn.id, title: syn.title, why: syn.why, how: syn.how, note: syn.note || null, situational: !!syn.situational };
      if (allMet) entry.status = 'now';
      else if (reach <= F.lvl) entry.status = 'option';
      else {
        entry.status = 'future';
        entry.level = reach;
      }
      if (entry.status !== 'now') entry.missing = syn.requires.filter(function (r, i) { return !results[i].met; }).map(describeRequirement);
      if (syn.situational && entry.status === 'now') out.situational.push(entry);
      else out[entry.status].push(entry);
    });
    out.future.sort(function (a, b) { return a.level - b.level; });
    return out;
  }

  function describeRequirement(r) {
    if (r.spell || r.otherSpell) return 'the ' + (Api().getSpell(r.spell || r.otherSpell) || {}).name + ' spell';
    if (r.spellAny) return 'one of: ' + r.spellAny.map(function (id) { return (Api().getSpell(id) || {}).name; }).filter(Boolean).join(', ');
    if (r.invocation) return 'the ' + Api().getInvocation(r.invocation).name + ' invocation' + (r.cantrip ? ' on ' + Api().getSpell(r.cantrip).name : '');
    if (r.metamagic) return Api().getMetamagic(r.metamagic).name + ' (Metamagic)';
    if (r.feat) return 'the ' + Api().getFeat(r.feat).name + ' feat';
    if (r.feature) return r.feature[1] + ' (' + Api().getClass(r.feature[0]).name + ' feature)';
    if (r.mastery) return 'Weapon Mastery with a ' + r.mastery + ' weapon';
    if (r.weaponProperty) return 'a ' + r.weaponProperty + ' weapon you are proficient with';
    if (r.weaponAny) return 'one of: ' + r.weaponAny.map(function (id) { return Api().getWeapon(id).name; }).join(', ');
    if (r.classOption) return 'the ' + r.classOption[1].replace(/-/g, ' ') + ' option';
    if (r.subclass) return 'the ' + r.subclass.replace(/-/g, ' ') + ' subclass';
    if (r.affinitySpell) return 'a spell that deals your Elemental Affinity damage type';
    if (r.concentrationSpell) return 'a Concentration spell';
    if (r.damageCantrip) return 'a damage cantrip';
    if (r.noArmor) return 'not wearing armor';
    return 'another choice';
  }

  // ---------------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------------
  function identitySection(doc, d, F) {
    var c = doc.choices;
    var cls = F.cls;
    var sp = Api().getSpecies(c.speciesId);
    var bg = Opt().backgroundOf(doc);
    var prof = cls ? PROFILES[cls.id] : null;
    var abilities = Api().rules().abilities.slice().sort(function (a, b) { return d.abilities[b].score - d.abilities[a].score; });
    var paragraphs = [];
    if (prof) paragraphs.push(prof.identity);
    if (F.sub) paragraphs.push('As ' + (/^[AEIOU]/.test(F.sub.name) ? 'an ' : 'a ') + F.sub.name + (F.sub.tagline ? ' (' + F.sub.tagline.replace(/\.$/, '') + ')' : '') + ', you gain ' + F.sub.features.filter(function (f) { return f.level <= F.lvl; }).map(function (f) { return f.name; }).join(', ') + '.');
    if (sp) paragraphs.push('Your ' + sp.name + ' heritage gives you ' + sp.traits.map(function (t) { return t.name; }).join(', ') + '.');
    if (bg) {
      var feat = bg.feat.id ? Api().getFeat(bg.feat.id) : null;
      var bgSkills = bg.skills.map(function (s) { return Api().getSkill(s); }).filter(Boolean).map(function (s) { return s.name; });
      paragraphs.push('Your ' + bg.name + (bg.custom ? ' (custom)' : '') + ' background trained you in ' + (bgSkills.join(' and ') || 'two skills') + (feat ? ' and gave you the ' + feat.name + ' feat.' : '.'));
    }
    var n = doc.narrative || {};
    return {
      headline: (n.name || 'This character') + ': level ' + F.lvl + ' ' + [sp && sp.name, cls && cls.name].filter(Boolean).join(' ') + (F.sub ? ' (' + F.sub.name + ')' : '') + (bg ? ', ' + bg.name + ' background' : ''),
      paragraphs: paragraphs,
      roles: prof ? prof.roles.slice() : [],
      facts: [
        { label: 'Hit Points', value: String(d.combat.hpMax), tip: 'hitPoints' },
        { label: 'Armor Class', value: String(d.combat.ac), tip: 'armorClass' },
        { label: 'Speed', value: d.combat.speed + ' ft.', tip: 'speed' },
        { label: 'Initiative', value: signed(d.combat.initiative), tip: 'initiative' },
        { label: 'Best abilities', value: abilities.slice(0, 2).map(function (a) { return abilityName(a) + ' ' + d.abilities[a].score; }).join(', '), tip: 'abilityScores' },
        { label: 'Proficient saves', value: Object.keys(d.savingThrows).filter(function (a) { return d.savingThrows[a].proficient; }).map(abilityName).join(', '), tip: 'savingThrows' },
      ].concat(d.spellcasting ? [{ label: 'Spell save DC / attack', value: d.spellcasting.saveDC + ' / ' + signed(d.spellcasting.attackBonus), tip: 'saveDC' }] : []),
      personal: [n.alignment ? 'Alignment: ' + n.alignment : null, n.personalityTraits ? 'Personality: ' + n.personalityTraits : null, n.ideals ? 'Ideals: ' + n.ideals : null].filter(Boolean),
    };
  }

  function abilitiesSection(doc, d, F) {
    var resources = {};
    d.classResources.forEach(function (r) { resources[r.key] = r.value; });
    var out = [];
    d.features.forEach(function (f) {
      if (/Subclass$|^Ability Score Improvement$|^Epic Boon$/.test(f.name) || f.kind === 'choice' && !f.description) return;
      var key = f.kind === 'feat' ? 'feat' : f.kind;
      var resKey = RESOURCE_FOR_FEATURE[f.name];
      out.push({
        name: f.name,
        source: f.source,
        kind: key,
        actionType: actionType(f.description),
        recharge: recharge(f.description),
        resource: resKey && resources[resKey] ? resources[resKey] : null,
        what: firstSentences(f.description, 2),
        limits: limitsOf(f.description, 2),
        tip: f.kind === 'class' || f.kind === 'subclass' ? 'feature:' + F.cls.id + ':' + f.name : f.kind === 'feat' ? null : null,
      });
    });
    d.invocations.forEach(function (inv) {
      out.push({ name: inv.name, source: 'Eldritch Invocation', kind: 'invocation', actionType: actionType(inv.description), recharge: recharge(inv.description), resource: null, what: firstSentences(inv.description, 2), limits: limitsOf(inv.description, 2), tip: 'invocation:' + inv.id });
    });
    d.metamagic.forEach(function (m) {
      out.push({ name: m.name, source: 'Metamagic (' + m.cost + ')', kind: 'metamagic', actionType: 'When you cast a spell', recharge: 'Costs Sorcery Points', resource: null, what: firstSentences(m.description, 2), limits: limitsOf(m.description, 2), tip: 'metamagic:' + m.id });
    });
    return out;
  }

  function howToPlaySection(doc, d, F) {
    var prof = F.cls ? PROFILES[F.cls.id] : null;
    var pick = function (list) { return (list || []).filter(function (x) { return gate(F, x); }).map(function (x) { return x.t; }); };
    var combat = prof ? pick(prof.combat) : [];
    var outside = prof ? pick(prof.outside) : [];
    var mistakes = prof ? pick(prof.mistakes) : [];
    var priorities = prof ? prof.priorities.slice() : [];

    // From the character's own numbers
    var best = d.attacks.filter(function (a) { return a.weaponId && a.proficient; }).sort(function (a, b) { return b.attackBonus - a.attackBonus; })[0];
    if (best) combat.push('Your most accurate weapon attack is ' + best.name + ' (' + signed(best.attackBonus) + ' to hit, ' + best.damage + ')' + (best.mastery ? ', with the ' + best.mastery + ' mastery' : '') + '.');
    if (d.spellcasting && d.spellcasting.cantrips.length) {
      var dmgCantrips = d.spellcasting.cantrips.map(Api().getSpell).filter(function (s) { return s && s.dealsDamage; });
      if (dmgCantrips.length) combat.push('Damage cantrips you can cast every turn without a slot: ' + dmgCantrips.map(function (s) { return s.name; }).join(', ') + '.');
    }
    var conc = Object.keys(F.spells).map(Api().getSpell).filter(function (s) { return s && s.concentration && s.level > 0; });
    if (conc.length > 1) mistakes.push('You have several Concentration spells (' + conc.slice(0, 4).map(function (s) { return s.name; }).join(', ') + (conc.length > 4 ? '…' : '') + '). Only one can be active at a time.');
    var heavy = F.weapons.filter(function (w) { return w.properties.indexOf('Heavy') >= 0; });
    heavy.forEach(function (w) {
      var need = w.kind === 'ranged' ? 'dex' : 'str';
      if (d.abilities[need].score < 13) mistakes.push(w.name + ' is Heavy: with ' + abilityName(need) + ' ' + d.abilities[need].score + ' (below 13) you have Disadvantage on attacks with it.');
    });
    var bonusSlot = Object.keys(F.spells).map(Api().getSpell).filter(function (s) { return s && s.level > 0 && /^Bonus Action/.test(s.castingTime); });
    if (bonusSlot.length && d.spellcasting) mistakes.push('If you cast ' + bonusSlot[0].name + ' with a slot as a Bonus Action, your action that turn can’t also cast a spell with a slot (a cantrip is fine).');
    if (d.limitations.some(function (l) { return /Speed is reduced/.test(l); })) mistakes.push(d.limitations.find(function (l) { return /Speed is reduced/.test(l); }));

    // Outside combat: top skills
    var skills = Object.values(d.skills).filter(function (s) { return s.proficient; }).sort(function (a, b) { return b.modifier - a.modifier; }).slice(0, 4);
    skills.forEach(function (s) {
      var sk = Api().rules().skills.find(function (x) { return x.name === s.name; });
      outside.push(s.name + ' ' + signed(s.modifier) + (s.expertise ? ' (Expertise)' : '') + ': ' + (sk && sk.exampleUses ? sk.exampleUses : ''));
    });
    if (d.spellcasting) {
      var rituals = Object.keys(F.spells).map(Api().getSpell).filter(function (s) { return s && s.ritual; });
      if (rituals.length) outside.push('Ritual spells you can cast without a slot (10 minutes longer): ' + rituals.map(function (s) { return s.name; }).join(', ') + '.');
    }
    // Priorities from the actual scores
    if (F.cls) {
      var primary = F.cls.spellcasting ? F.cls.spellcasting.ability : null;
      if (primary && d.abilities[primary].score < 16) priorities.push('Your spellcasting ability (' + abilityName(primary) + ' ' + d.abilities[primary].score + ') sets your spell attack and save DC; raising it is a strong choice at your next Ability Score Improvement.');
      if (d.abilities.con.modifier < 1) priorities.push('Constitution ' + d.abilities.con.score + ' gives few Hit Points; play carefully or raise it later.');
    }
    return { combat: combat, outside: outside, priorities: priorities, mistakes: mistakes };
  }

  function strengthsSection(doc, d, F) {
    var prof = F.cls ? PROFILES[F.cls.id] : null;
    var strengths = prof ? prof.strengths.slice() : [];
    var weaknesses = prof ? prof.weaknesses.slice() : [];
    var roles = prof ? prof.roles.slice() : [];
    if (d.combat.ac >= 18) strengths.push('High Armor Class (' + d.combat.ac + ')');
    else if (d.combat.ac <= 12) weaknesses.push('Low Armor Class (' + d.combat.ac + ')');
    if (d.combat.speed >= 40) strengths.push('Fast (Speed ' + d.combat.speed + ' feet)');
    if (d.passivePerception >= 15) strengths.push('Hard to surprise (Passive Perception ' + d.passivePerception + ')');
    Object.keys(d.savingThrows).forEach(function (a) {
      var s = d.savingThrows[a];
      if (!s.proficient && s.modifier < 0) weaknesses.push('Weak ' + abilityName(a) + ' saving throws (' + signed(s.modifier) + ')');
    });
    var healing = Object.keys(F.spells).map(Api().getSpell).filter(function (s) { return s && s.healing; });
    if (healing.length && roles.indexOf('Healer') < 0) roles.push('Backup healer');
    var ranged = d.attacks.some(function (a) { var w = a.weaponId && Api().getWeapon(a.weaponId); return w && (w.kind === 'ranged' || w.properties.some(function (p) { return /^Thrown/.test(p); })); })
      || Object.keys(F.spells).some(function (id) { var s = Api().getSpell(id); return s && s.dealsDamage && s.rangeFeet >= 30; });
    if (!ranged) weaknesses.push('No ranged attack in your current equipment or spells');
    if (d.skills.persuasion.proficient && d.abilities.cha.modifier >= 2 && roles.indexOf('Face (social encounters)') < 0) roles.push('Face (social encounters)');
    if (d.skills.stealth.proficient && d.abilities.dex.modifier >= 2 && roles.indexOf('Scout') < 0) roles.push('Scout');
    var expertise = Object.values(d.skills).filter(function (s) { return s.expertise; }).length;
    if (expertise >= 2 && roles.indexOf('Skill expert') < 0) roles.push('Skill expert');
    return { strengths: strengths, weaknesses: weaknesses, roles: roles };
  }

  function progressionSection(doc, d, F) {
    var cls = F.cls;
    if (!cls) return [];
    var out = [];
    var sub = F.sub || (Api().listSubclasses(cls.id).length === 1 ? cls.subclass : null);
    for (var L = F.lvl + 1; L <= 20; L++) {
      var gains = [];
      var prev = cls.levels[L - 1];
      var entry = cls.levels[L];
      cls.features.filter(function (f) { return f.level === L; }).forEach(function (f) {
        if (/Subclass$/.test(f.name)) gains.push('Choose your subclass' + (sub ? ' (' + sub.name + ')' : ''));
        else if (f.name !== 'Ability Score Improvement' && f.name !== 'Epic Boon') gains.push(f.name);
      });
      if (sub) sub.features.filter(function (f) { return f.level === L; }).forEach(function (f) { gains.push(f.name + ' (' + sub.name + ')'); });
      cls.featLevels.filter(function (fl) { return fl.level === L; }).forEach(function (fl) { gains.push(fl.kind === 'epic-boon' ? 'Epic Boon feat' : 'Ability Score Improvement or a feat'); });
      // New class choices at this level (e.g. Rogue Expertise at 6, Fighter Additional Fighting Style at 7)
      (cls.choices || []).forEach(function (ch) {
        if (ch.level !== L || (ch.subclass && !(sub && sub.id === cls.subclass.id))) return;
        var label = 'Choose: ' + ch.label.replace(/ \(level \d+\)$/, '');
        if (gains.indexOf(label) < 0 && gains.indexOf(ch.label) < 0) gains.push(label);
      });
      if (Api().proficiencyBonus(L) > Api().proficiencyBonus(L - 1)) gains.push('Proficiency Bonus becomes ' + signed(Api().proficiencyBonus(L)));
      if (cls.spellcasting) {
        var m0 = Api().maxSpellLevel(cls.id, L - 1);
        var m1 = Api().maxSpellLevel(cls.id, L);
        if (m1 > m0) gains.push('Level ' + m1 + ' spells');
        if ((entry.cantrips || 0) > (prev.cantrips || 0)) gains.push('+' + (entry.cantrips - prev.cantrips) + ' cantrip');
        if ((entry.preparedSpells || 0) > (prev.preparedSpells || 0)) gains.push('+' + (entry.preparedSpells - prev.preparedSpells) + ' prepared spell' + (entry.preparedSpells - prev.preparedSpells > 1 ? 's' : ''));
      }
      if (cls.mysticArcanum && cls.mysticArcanum[L]) gains.push('Mystic Arcanum (level ' + cls.mysticArcanum[L] + ' spell)');
      ['invocations', 'weaponMastery', 'rages', 'sorceryPoints'].forEach(function (k) {
        if (entry[k] && prev[k] !== undefined && entry[k] > prev[k]) gains.push({ invocations: 'Eldritch Invocations', weaponMastery: 'Weapon Mastery', rages: 'Rages', sorceryPoints: 'Sorcery Points' }[k] + ' ' + prev[k] + ' → ' + entry[k]);
      });
      ['sneakAttack', 'martialArts', 'bardicDie', 'rageDamage'].forEach(function (k) {
        if (entry[k] && prev[k] && String(entry[k]) !== String(prev[k])) gains.push({ sneakAttack: 'Sneak Attack', martialArts: 'Martial Arts die', bardicDie: 'Bardic Inspiration die', rageDamage: 'Rage Damage' }[k] + ' ' + (k === 'rageDamage' ? signed(entry[k]) : entry[k]));
      });
      if ([5, 11, 17].indexOf(L) >= 0 && d.spellcasting && d.spellcasting.cantrips.some(function (id) { var s = Api().getSpell(id); return s && s.dealsDamage; })) gains.push('Damage cantrips get stronger');
      out.push({ level: L, gains: gains, hp: '+' + Math.max(1, cls.fixedHpPerLevel + d.abilities.con.modifier) + ' Hit Points (fixed value)' });
    }
    return out;
  }

  /**
   * Build the guide. Returns a plain object: { version, hash, generatedAt, identity, abilities,
   * howToPlay, combos, strengths, progression, sources }.
   */
  function buildGuide(doc, derived) {
    var d = derived || global.FogDeriveCharacter(doc);
    var F = facts(doc, d);
    return {
      version: GUIDE_VERSION,
      hash: contentHash(doc),
      rulesVersion: Api().rules().meta.id,
      identity: identitySection(doc, d, F),
      abilities: abilitiesSection(doc, d, F),
      howToPlay: howToPlaySection(doc, d, F),
      combos: evaluateSynergies(F),
      strengths: strengthsSection(doc, d, F),
      progression: progressionSection(doc, d, F),
      sources: Api().rules().meta.attribution,
    };
  }

  global.FogCharacterGuide = {
    VERSION: GUIDE_VERSION,
    PROFILES: PROFILES,
    build: buildGuide,
    contentHash: contentHash,
    checkRequirement: function (doc, derived, r) { return checkRequirement(facts(doc, derived || global.FogDeriveCharacter(doc)), r); },
    describeRequirement: describeRequirement,
  };
})(window);
