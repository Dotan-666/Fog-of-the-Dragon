/**
 * Synergy catalog for the Character Guide: combinations of SRD 5.2.1 features, spells, feats and
 * weapon masteries that work together under the rules as written.
 *
 * Every entry names its parts with machine-checkable requirements; the guide engine shows an entry
 * only when every requirement is met now, can be met with a different legal choice now, or becomes
 * reachable at a later level of the character's class. tests/guide.test.mjs checks that every id and
 * feature name referenced here exists in the rules data.
 *
 * Requirement kinds:
 *   class, subclass, feature [classId, name], spell, invocation (+ cantrip), metamagic, feat,
 *   mastery (a Weapon Mastery property chosen), weaponProperty (a proficient weapon in the inventory),
 *   classOption [choiceId, optionId], affinitySpell (spell matching Elemental Affinity), concentrationSpell,
 *   noArmor (fighting without armor or Shield), otherSpell, spellAny, weaponAny, damageCantrip.
 */
(function (global) {
  'use strict';

  var SYNERGIES = [
    {
      id: 'agonizing-eldritch-blast', title: 'Agonizing Blast on Eldritch Blast',
      requires: [{ class: 'warlock' }, { spell: 'eldritch-blast' }, { invocation: 'agonizing-blast', cantrip: 'eldritch-blast' }],
      why: 'Agonizing Blast adds your Charisma modifier to the damage of the cantrip you chose. Eldritch Blast makes more beams at higher levels, and each beam that hits adds the bonus.',
      how: 'Use Eldritch Blast as your default attack every turn you aren’t casting a slot spell.',
    },
    {
      id: 'hex-eldritch-blast', title: 'Hex with Eldritch Blast',
      requires: [{ spell: 'hex' }, { spell: 'eldritch-blast' }],
      why: 'Hex adds 1d6 Necrotic damage every time you hit the cursed target with an attack roll, and each Eldritch Blast beam is its own attack roll.',
      how: 'Cast Hex (a Bonus Action, Concentration) on a tough enemy, then fire Eldritch Blast at it. If it drops, move Hex with a Bonus Action on a later turn.',
      note: 'Hex needs Concentration and uses a Pact Magic slot; casting it means no other slot spell that turn.',
    },
    {
      id: 'repelling-eldritch-blast', title: 'Repelling Blast control', situational: true,
      requires: [{ spell: 'eldritch-blast' }, { invocation: 'repelling-blast', cantrip: 'eldritch-blast' }],
      why: 'Each Eldritch Blast beam that hits a Large or smaller creature can push it up to 10 feet away from you.',
      how: 'Push enemies away from you or your allies, or out of a doorway. Best when the terrain or an ally’s spell makes the push matter.',
    },
    {
      id: 'blade-pact-melee', title: 'Pact of the Blade melee Warlock',
      requires: [{ invocation: 'pact-of-the-blade' }, { invocation: 'thirsting-blade' }],
      why: 'Pact of the Blade lets you use Charisma for attacks with your pact weapon, and Thirsting Blade gives you Extra Attack with it.',
      how: 'Summon your pact weapon as a Bonus Action and attack twice with the Attack action.',
    },
    {
      id: 'eldritch-smite-blade', title: 'Eldritch Smite burst',
      requires: [{ invocation: 'pact-of-the-blade' }, { invocation: 'eldritch-smite' }],
      why: 'Once per turn, after a pact-weapon hit, spend a Pact Magic slot to add Force damage (1d8 plus 1d8 per slot level) and possibly knock the target Prone.',
      how: 'Save it for a hit on a priority target; your slots come back on a Short Rest.',
    },
    {
      id: 'devils-sight-darkness', title: 'Devil’s Sight inside Darkness', situational: true,
      requires: [{ invocation: 'devils-sight' }, { spell: 'darkness' }],
      why: 'Darkness creates magical Darkness that Darkvision can’t see through, while Devil’s Sight lets you see normally in magical Darkness within 120 feet.',
      how: 'Cast Darkness where enemies can’t see you but you can still see them. Warn your allies: they are blinded in it too.',
      note: 'Darkness needs Concentration.',
    },
    {
      id: 'sneak-attack-vex', title: 'Vex sets up Sneak Attack',
      requires: [{ feature: ['rogue', 'Sneak Attack'] }, { mastery: 'Vex' }],
      why: 'A Vex weapon hit gives you Advantage on your next attack against that creature before the end of your next turn, and Advantage is one way to enable Sneak Attack.',
      how: 'Attack with a Shortsword, Rapier, Shortbow or other Vex weapon you mastered; your next attack on the same target has Advantage.',
    },
    {
      id: 'steady-aim-sneak-attack', title: 'Steady Aim for Sneak Attack',
      requires: [{ feature: ['rogue', 'Sneak Attack'] }, { feature: ['rogue', 'Steady Aim'] }],
      why: 'Steady Aim gives Advantage on your next attack this turn as a Bonus Action, which enables Sneak Attack even without an ally next to the target.',
      how: 'Use it when you haven’t moved yet and don’t need to; your Speed becomes 0 for the rest of the turn.',
    },
    {
      id: 'nick-two-weapons', title: 'Nick and Two-Weapon Fighting',
      requires: [{ mastery: 'Nick' }, { feat: 'two-weapon-fighting' }, { weaponProperty: 'Light' }],
      why: 'The Light property gives an extra attack with a second Light weapon; Nick lets you make it as part of the Attack action (keeping your Bonus Action free), and Two-Weapon Fighting adds your ability modifier to its damage.',
      how: 'Wield two Light weapons, at least one with Nick (Dagger, Light Hammer, Sickle or Scimitar).',
    },
    {
      id: 'great-weapon-fighting', title: 'Great Weapon Fighting with a two-handed weapon',
      requires: [{ feat: 'great-weapon-fighting' }, { weaponProperty: 'Two-Handed' }],
      why: 'Great Weapon Fighting treats any 1 or 2 on a damage die as a 3 for melee weapons you hold in two hands with the Two-Handed or Versatile property.',
      how: 'Fight with a Greatsword, Greataxe, Maul or similar weapon in both hands.',
    },
    {
      id: 'savage-attacker-big-dice', title: 'Savage Attacker with big weapon dice',
      requires: [{ feat: 'savage-attacker' }, { weaponProperty: 'Heavy' }],
      why: 'Once per turn, Savage Attacker lets you roll a weapon’s damage dice twice and use either roll; it gains the most on weapons with large dice, like Heavy weapons.',
      how: 'Apply it to your first hit each turn.',
    },
    {
      id: 'topple-team', title: 'Topple for your team', situational: true,
      requires: [{ mastery: 'Topple' }],
      why: 'A Topple hit forces a Constitution save or the target falls Prone, and attack rolls against a Prone creature from within 5 feet have Advantage.',
      how: 'Topple an enemy early in your turn so you and melee allies attack it with Advantage.',
    },
    {
      id: 'reckless-rage', title: 'Reckless Attack while raging',
      requires: [{ feature: ['barbarian', 'Rage'] }, { feature: ['barbarian', 'Reckless Attack'] }],
      why: 'Reckless Attack gives Advantage on Strength attacks, but attacks against you also gain Advantage; Rage’s Resistance to Bludgeoning, Piercing and Slashing damage halves much of that extra punishment, and Rage adds damage to every Strength hit.',
      how: 'Rage first (Bonus Action), then attack recklessly when hitting matters more than not being hit.',
    },
    {
      id: 'action-surge-extra-attack', title: 'Action Surge with Extra Attack',
      requires: [{ feature: ['fighter', 'Action Surge'] }, { feature: ['fighter', 'Extra Attack'] }],
      why: 'Action Surge gives one additional action on your turn (not the Magic action), so you can take the Attack action twice and make all your Extra Attack attacks twice.',
      how: 'Use it on the turn you can finish a dangerous enemy; it recharges on a Short or Long Rest.',
    },
    {
      id: 'champion-crits', title: 'Champion critical hits', situational: true,
      requires: [{ subclass: 'champion' }, { weaponProperty: 'Heavy' }],
      why: 'Improved Critical makes 19 and 20 Critical Hits, and a Critical Hit rolls the attack’s damage dice twice, so weapons with large damage dice gain the most.',
      how: 'Make many attacks per turn (Extra Attack, Action Surge) for more chances to crit.',
    },
    {
      id: 'open-hand-flurry', title: 'Open Hand Technique on Flurry of Blows',
      requires: [{ subclass: 'warrior-of-the-open-hand' }, { feature: ['monk', 'Monk\'s Focus'] }],
      why: 'Every Flurry of Blows hit can Addle, Push (Strength save) or Topple (Dexterity save) the target.',
      how: 'Topple a target with Flurry so you and your allies have Advantage against it, or Push it away from a wounded ally.',
    },
    {
      id: 'stunning-strike-team', title: 'Stunning Strike for the party', situational: true,
      requires: [{ feature: ['monk', 'Stunning Strike'] }],
      why: 'A failed Constitution save leaves the target Stunned until the start of your next turn; even on a success its Speed is halved and the next attack against it has Advantage.',
      how: 'Use it on a dangerous enemy before your allies’ turns; it costs 1 Focus Point and works once per turn.',
    },
    {
      id: 'disciple-of-life-healing', title: 'Disciple of Life healing',
      requires: [{ subclass: 'life-domain' }, { spellAny: ['healing-word', 'cure-wounds', 'mass-healing-word', 'aid'] }],
      why: 'When a spell you cast with a slot restores Hit Points, the creature regains an extra 2 + the slot’s level.',
      how: 'Healing Word (a Bonus Action at 60 feet) gets the bonus too, which makes it a strong way to pick up a fallen ally.',
    },
    {
      id: 'healing-word-pickup', title: 'Healing Word to stop Death Saving Throws', situational: true,
      requires: [{ spell: 'healing-word' }],
      why: 'Any healing brings a creature at 0 Hit Points back to consciousness, and Healing Word is a Bonus Action with a 60-foot range.',
      how: 'When an ally drops to 0, cast Healing Word on your turn and still use your action.',
      note: 'If you cast Healing Word with a slot, you can’t cast another slot spell that turn; a cantrip is still allowed.',
    },
    {
      id: 'protector-spirit-guardians', title: 'Armored Spirit Guardians Cleric',
      requires: [{ classOption: ['divineOrder', 'protector'] }, { spell: 'spirit-guardians' }],
      why: 'Protector gives Heavy armor training, so you can stand next to enemies while Spirit Guardians halves their Speed and damages them each time they enter or end their turn in the aura.',
      how: 'Cast Spirit Guardians, then move into the enemy group. Keep Concentration by having a good Constitution save.',
    },
    {
      id: 'sculpt-fireball', title: 'Sculpt Spells with area evocations',
      requires: [{ subclass: 'evoker' }, { feature: ['wizard', 'Sculpt Spells'] }, { spellAny: ['fireball', 'lightning-bolt', 'burning-hands', 'thunderwave'] }],
      why: 'Sculpt Spells lets up to 1 + the spell’s level creatures you choose automatically succeed and take no damage from your Evocation spell.',
      how: 'Drop Fireball on a crowd that includes your allies and protect them.',
    },
    {
      id: 'potent-cantrip', title: 'Potent Cantrip on damage cantrips',
      requires: [{ subclass: 'evoker' }, { feature: ['wizard', 'Potent Cantrip'] }, { spellAny: ['fire-bolt', 'ray-of-frost', 'shocking-grasp', 'acid-splash', 'poison-spray', 'chill-touch'] }],
      why: 'When your damaging cantrip misses or the target succeeds on its save, the target still takes half the cantrip’s damage.',
      how: 'Your cantrips always do something, so they are reliable when you save slots.',
    },
    {
      id: 'ritual-adept', title: 'Ritual Adept utility',
      requires: [{ feature: ['wizard', 'Ritual Adept'] }, { spellAny: ['detect-magic', 'identify', 'find-familiar', 'comprehend-languages', 'alarm', 'unseen-servant'] }],
      why: 'You can cast Ritual spells from your spellbook without preparing them and without a slot, taking 10 minutes longer.',
      how: 'Put utility rituals in your spellbook and prepare combat spells instead.',
    },
    {
      id: 'shield-mage-armor', title: 'Mage Armor plus Shield', situational: true,
      requires: [{ spell: 'mage-armor' }, { spell: 'shield' }, { noArmor: true }],
      why: 'Mage Armor sets your base AC to 13 + Dexterity modifier for 8 hours; Shield adds +5 AC as a Reaction when you are hit.',
      how: 'Cast Mage Armor at the start of the day; keep a level 1 slot for Shield.',
    },
    {
      id: 'quickened-cantrip', title: 'Quickened Spell plus a cantrip',
      requires: [{ metamagic: 'quickened-spell' }, { damageCantrip: true }],
      why: 'Quickened Spell changes an action spell to a Bonus Action. You can’t cast a level 1+ spell after quickening one on the same turn, but a cantrip with your action is still allowed.',
      how: 'Quicken your big spell, then use your action for a damage cantrip.',
    },
    {
      id: 'twinned-hold-person', title: 'Twinned Spell on Hold Person',
      requires: [{ metamagic: 'twinned-spell' }, { spell: 'hold-person' }],
      why: 'Hold Person targets one more Humanoid per slot level above 2; Twinned Spell raises the spell’s effective level by 1 for 1 Sorcery Point.',
      how: 'Paralyze two Humanoids with one level 2 slot.',
      note: 'Hold Person needs Concentration.',
    },
    {
      id: 'careful-area', title: 'Careful Spell protects allies', situational: true,
      requires: [{ metamagic: 'careful-spell' }, { spellAny: ['fireball', 'lightning-bolt', 'burning-hands', 'thunderwave', 'sleet-storm', 'cone-of-cold'] }],
      why: 'Careful Spell lets up to your Charisma modifier (minimum one) creatures automatically succeed on the spell’s save.',
      how: 'Use it when allies are inside your area spell.',
    },
    {
      id: 'elemental-affinity', title: 'Elemental Affinity damage',
      requires: [{ subclass: 'draconic-sorcery' }, { feature: ['sorcerer', 'Elemental Affinity'] }, { affinitySpell: true }],
      why: 'When a spell deals your chosen dragon damage type, add your Charisma modifier to one damage roll of it; you also resist that type.',
      how: 'Prepare spells that deal your affinity type.',
    },
    {
      id: 'innate-sorcery-attacks', title: 'Innate Sorcery for spell attacks',
      requires: [{ feature: ['sorcerer', 'Innate Sorcery'] }, { spellAny: ['fire-bolt', 'scorching-ray', 'chromatic-orb', 'ray-of-frost', 'shocking-grasp', 'sorcerous-burst'] }],
      why: 'For 1 minute, Innate Sorcery gives Advantage on attack rolls of your Sorcerer spells and +1 to their save DC.',
      how: 'Activate it (Bonus Action) at the start of a hard fight before your attack spells.',
    },
    {
      id: 'colossus-slayer-mark', title: 'Colossus Slayer with Hunter’s Mark',
      requires: [{ classOption: ['huntersPrey', 'colossus-slayer'] }, { spell: 'hunters-mark' }],
      why: 'Hunter’s Mark adds 1d6 Force damage to every hit on the marked target, and Colossus Slayer adds 1d8 once per turn once the target is missing Hit Points.',
      how: 'Mark the biggest enemy and focus it.',
      note: 'Hunter’s Mark needs Concentration.',
    },
    {
      id: 'mark-extra-attack', title: 'Hunter’s Mark with Extra Attack',
      requires: [{ spell: 'hunters-mark' }, { feature: ['ranger', 'Extra Attack'] }],
      why: 'Hunter’s Mark adds its damage to every hit, so two attacks per turn means two chances for the extra 1d6 Force damage.',
      how: 'Use your free Favored Enemy casts so you don’t spend slots on it.',
    },
    {
      id: 'blessed-warrior-sacred-flame', title: 'Sacred Flame for range',
      requires: [{ feat: 'blessed-warrior' }, { otherSpell: 'sacred-flame' }],
      why: 'Blessed Warrior gives you Cleric cantrips cast with Charisma, so Sacred Flame gives a ranged option when you can’t reach the enemy.',
      how: 'Use it against flying or distant enemies.',
    },
    {
      id: 'sacred-weapon-accuracy', title: 'Sacred Weapon accuracy',
      requires: [{ subclass: 'oath-of-devotion' }, { feature: ['paladin', 'Sacred Weapon'] }],
      why: 'Sacred Weapon adds your Charisma modifier (minimum +1) to attack rolls with the weapon for 10 minutes and lets its hits deal Radiant damage.',
      how: 'Use a Channel Divinity on it at the start of a long fight; you activate it when you take the Attack action.',
    },
    {
      id: 'smite-after-hit', title: 'Divine Smite after you hit', situational: true,
      requires: [{ spell: 'divine-smite' }],
      why: 'Divine Smite is cast as a Bonus Action immediately after you hit with a melee weapon or Unarmed Strike, so you never waste it on a miss. It deals extra Radiant damage, more against Fiends and Undead.',
      how: 'Smite important hits. It uses a spell slot, so you can’t cast another slot spell that turn.',
    },
    {
      id: 'shillelagh-wisdom', title: 'Shillelagh melee Druid',
      requires: [{ spell: 'shillelagh' }, { weaponAny: ['quarterstaff', 'club'] }],
      why: 'Shillelagh lets you use your spellcasting ability instead of Strength for a Club or Quarterstaff and makes its damage die a d8.',
      how: 'Cast it (a Bonus Action) and fight with your quarterstaff using Wisdom.',
    },
    {
      id: 'wild-shape-concentration', title: 'Concentrate, then Wild Shape', situational: true,
      requires: [{ feature: ['druid', 'Wild Shape'] }, { concentrationSpell: true }],
      why: 'You can’t cast spells while shape-shifted, but shapeshifting doesn’t break your Concentration on a spell you already cast.',
      how: 'Cast your Concentration spell first, then take a Beast form; the Temporary Hit Points help you keep it going.',
    },
    {
      id: 'dark-ones-blessing-blast', title: 'Dark One’s Blessing while finishing foes',
      requires: [{ subclass: 'fiend-patron' }, { spell: 'eldritch-blast' }],
      why: 'Whenever you (or someone else, within 10 feet of you) reduce an enemy to 0 Hit Points, you gain Temporary Hit Points equal to your Charisma modifier + Warlock level.',
      how: 'Aim Eldritch Blast at nearly defeated enemies to keep your buffer up.',
    },
  ];

  global.FogSynergies = { list: function () { return SYNERGIES.slice(); } };
})(window);
