/**
 * Guided Tips — beginner explanations for every choice and number in the character creator and sheet.
 *
 * Each tip has a short plain-language summary and example (written for this app) plus the official
 * rule text from SRD 5.2.1 (Rules Glossary entry, a chapter quote, or the item's own description).
 * The summaries only restate rules found in that text; nothing here adds or changes a rule.
 * No DOM code: the popover UI lives in JS/Dashboard/characters/tips-popover.js.
 */
(function (global) {
  'use strict';

  var Api = function () { return global.FogRulesApi; };

  function q(text, source) {
    return { text: text, source: source };
  }

  /** Official SRD 5.2.1 sentences for concepts that have no Rules Glossary entry (quoted verbatim). */
  var QUOTES = {
    spellSlots: q("Spellcasting is taxing, so a spellcaster can cast only a limited number of level 1+ spells before resting. Spell slots are the main way a spellcaster's magical potential is represented.\n\nWhen you cast a spell, you expend a slot of that spell's level or higher, effectively \"filling\" a slot with the spell.\n\nFinishing a Long Rest restores any expended spell slots.", 'Spells: Spell Slots'),
    higherSlot: q("When a spellcaster casts a spell using a slot that is of a higher level than the spell, the spell takes on the higher level for that casting.", 'Spells: Using a Higher-Level Spell Slot'),
    oneSlot: q("On a turn, you can expend only one spell slot to cast a spell. This rule means you can't, for example, cast a spell with a spell slot using the Magic action and another one using a Bonus Action on the same turn.", 'Spells: One Spell with a Spell Slot per Turn'),
    saveDC: q('Spell save DC = 8 + your spellcasting ability modifier + your Proficiency Bonus', 'Spells: Saving Throws'),
    spellAttack: q('Spell attack modifier = your spellcasting ability modifier + your Proficiency Bonus', 'Spells: Attack Rolls'),
    alwaysPrepared: q("Certain features might give you a spell that you always have prepared. If you also have a list of prepared spells that you can change, a spell that you always have prepared doesn't count against the number of spells on that list.", 'Spells: Always-Prepared Spells'),
    components: q("A spell's components are physical requirements the spellcaster must meet to cast the spell. Each spell's description indicates whether it requires Verbal (V), Somatic (S), or Material (M) components. If the spellcaster can't provide one or more of a spell's components, the spellcaster can't cast the spell.", 'Spells: Components'),
    range: q("A spell's range indicates how far from the spellcaster the spell's effect can originate, and the spell's description specifies which part of the effect is limited by the range.", 'Spells: Range'),
    duration: q("A spell's duration is the length of time the spell persists after it is cast. A duration typically takes one of the following forms: Concentration, Instantaneous, or a Time Span.", 'Spells: Duration'),
    castingTime: q('Most spells require the Magic action to cast, but some spells require a Bonus Action, a Reaction, or 1 minute or more. A spell\'s Casting Time entry specifies which of those is required.', 'Spells: Casting Time'),
    deathSaves: q("Whenever you start your turn with 0 Hit Points, you must make a Death Saving Throw to determine whether you creep closer to death or hang on to life.\n\nRoll 1d20. If the roll is 10 or higher, you succeed. Otherwise, you fail. On your third success, you become Stable. On your third failure, you die.\n\nWhen you roll a 1 on the d20 for a Death Saving Throw, you suffer two failures. If you roll a 20 on the d20, you regain 1 Hit Point.", 'Playing the Game: Death Saving Throws'),
    tools: q("If you have proficiency with a tool, you can add your Proficiency Bonus to any ability check you make that uses the tool. If you have proficiency in the skill that's also used with that check, you have Advantage on the check too.", 'Playing the Game: Equipment Proficiencies'),
    weaponProf: q('Anyone can wield a weapon, but proficiency makes you better at wielding it. If you have proficiency with a weapon, you add your Proficiency Bonus to attack rolls you make with it.', 'Playing the Game: Equipment Proficiencies'),
    savesPerClass: q('Each class gives proficiency in at least two saving throws, representing that class\'s training in evading or resisting certain threats.', 'Playing the Game: Saving Throws'),
    armorStrength: q("If the table shows a Strength score in the Strength column for an armor type, that armor reduces the wearer's speed by 10 feet unless the wearer has a Strength score equal to or higher than the listed score.", 'Equipment: Armor'),
    armorStealth: q('If the table shows "Disadvantage" in the Stealth column for an armor type, the wearer has Disadvantage on Dexterity (Stealth) checks.', 'Equipment: Armor'),
    higherLevels: q("Creating a higher-level character uses the same character-creation steps outlined in this chapter and the rules for advancing beyond level 1. The GM decides whether your character starts with more than the standard equipment for a level 1 character, possibly even one or more magic items.", 'Character Creation: Starting at Higher Levels'),
    hpLevelUp: q("Each time you gain a level, you gain an additional Hit Die. Roll that die, add your Constitution modifier to the roll, and add the total (minimum of 1) to your Hit Point maximum. Instead of rolling, you can use the fixed value shown in the Fixed Hit Points by Class table.", 'Character Creation: Gaining a Level'),
    classStep: q('Choose a class, and write it on your character sheet. The Class Overview table summarizes the classes. See "Classes" for the classes\' details.', 'Character Creation: Step 1'),
    classFeatures: q("Look at your class's feature table in \"Classes,\" and write down the level 1 features. The class features are detailed there too.\n\nSome class features offer choices. Make sure to read all your features and make any offered choices.", 'Character Creation: Record Class Features'),
    speciesStep: q("Choose a species for your character. Once you've chosen a species, write it on your character sheet. Then record your species' traits.\n\nYour character's size and Speed are determined by the character's species.", 'Character Creation: Choose a Species'),
    backgroundParts: q("A background lists three of your character's ability scores. Increase one by 2 and another one by 1, or increase all three by 1. None of these increases can raise a score above 20.\n\nA background gives your character a specified Origin feat (described in \"Feats\").\n\nA background gives your character proficiency in two specified skills.\n\nEach background gives a character proficiency with one tool—either a specific tool or one chosen from the Artisan's Tools category.", 'Character Origins: Parts of a Background'),
    bgAbilities: q("A background lists three of your character's ability scores. Increase one by 2 and another one by 1, or increase all three by 1. None of these increases can raise a score above 20.", 'Character Origins: Parts of a Background'),
    originFeat: q('A background gives your character a specified Origin feat (described in "Feats").', 'Character Origins: Parts of a Background'),
    generate: q('_Standard Array._ Use the following six scores for your abilities: 15, 14, 13, 12, 10, 8.\n\n_Random Generation._ Roll four d6s and record the total of the highest three dice. Do this five more times, so you have six numbers.\n\n_Point Cost._ You have 27 points to spend on your ability scores. The cost of each score is shown on the Ability Score Point Costs table. For example, a score of 14 costs 7 of your 27 points.', 'Character Creation: Generate Your Scores'),
    languages: q('Your character knows at least three languages: Common plus two languages you roll or choose from the Standard Languages table. Knowledge of a language means your character can communicate in it, read it, and write it. Your class and other features might also give you languages.', 'Character Creation: Choose Languages'),
    featParts: q("_Category._ A feat is a member of a category, which is noted in the feat. If you're instructed to choose a feat from a specific category, such as the Origin category, that category must appear under the feat's name. If you're instructed to choose a feat and no category is specified, you can choose from any category.\n\n_Prerequisite._ To take a feat, you must meet any prerequisite in its description unless a feature allows you to take the feat without the prerequisite.\n\n_Repeatable._ A feat can be taken only once unless its description states otherwise in a \"Repeatable\" subsection.", 'Feats: Parts of a Feat'),
    preparing: q('If you have a list of level 1+ spells you prepare, your spellcasting feature specifies when you can change the list and the number of spells you can change, as summarized in the Spell Preparation by Class table.\n\n- Bard — Gain a level — One\n- Cleric — Finish a Long Rest — Any\n- Druid — Finish a Long Rest — Any\n- Paladin — Finish a Long Rest — One\n- Ranger — Finish a Long Rest — One\n- Sorcerer — Gain a level — One\n- Warlock — Gain a level — One\n- Wizard — Finish a Long Rest — Any', 'Spells: Preparing Spells'),
    alignment: q("A creature's alignment broadly describes its ethical attitudes and ideals. Alignment is a combination of two factors: one identifies morality (good, evil, or neutral), and the other describes attitudes toward order (lawful, chaotic, or neutral).\n\nThe game assumes that player characters aren't of an evil alignment. Check with your GM before making an evil character.", 'Character Creation: Alignment'),
  };

  /**
   * Concept tips. t: title, s: summary, e: example, g: Rules Glossary id, r: quote key,
   * f: [classId, feature name] to show that class feature's own text as the rule.
   */
  var C = {
    levelUp: { t: 'Gaining a level', s: 'When your character gains a level you get one more Hit Die and its Hit Points (roll it or take the fixed value, plus your Constitution modifier), the class features of the new level, and any new choices: a subclass, a feat at levels 4, 8, 12, 16 and 19, more cantrips or prepared spells. Your Proficiency Bonus rises at levels 5, 9, 13 and 17.', e: 'A level 3 Fighter with Constitution +2 reaching level 4 gains 6 + 2 = 8 Hit Points (or rolls 1d10 + 2) and an Ability Score Improvement or another feat.', r: 'hpLevelUp' },
    level: { t: 'Character level', s: 'Your level (1–20) shows how experienced your character is. Every level adds Hit Points, and set levels add class features, feats and a bigger Proficiency Bonus.', e: 'At level 5, Barbarians, Fighters, Monks, Paladins and Rangers gain Extra Attack, and Bards, Clerics, Druids, Sorcerers, Warlocks and Wizards can cast level 3 spells.', r: 'higherLevels' },
    class: { t: 'Class', s: 'Your class is your main training: it sets your Hit Point Die, the saving throws and skills you are trained in, what armor and weapons you can use well, and the features you gain as you level up.', e: 'A Fighter gets a d10 Hit Die and heavy armor training; a Wizard gets a d6 Hit Die, no armor training and a spellbook.', r: 'classStep' },
    subclass: { t: 'Subclass', s: 'At level 3 every class chooses a subclass, a specialty that adds its own features at later levels. The free SRD 5.2.1 includes one subclass per class.', e: 'A level 3 Fighter can become a Champion, which makes Critical Hits happen on a 19 or 20.', f: ['fighter', 'Fighter Subclass'] },
    species: { t: 'Species', s: 'Your species sets your size, base speed and some special traits, such as Darkvision. In the 2024 rules species don’t change ability scores; your background does that.', e: 'A Dwarf has Darkvision and Dwarven Toughness, which adds 1 Hit Point per level.', r: 'speciesStep' },
    background: { t: 'Background', s: 'Your background is your life before adventuring. It gives you an Origin feat, two skill proficiencies, one tool proficiency, starting equipment, and the three abilities you can increase.', e: 'The Sage background gives Magic Initiate (Wizard), Arcana and History, and lets you raise Constitution, Intelligence or Wisdom.', r: 'backgroundParts' },
    customBackground: { t: 'Custom background', s: 'Build your own background with the same parts as the official ones: three abilities you can increase, one Origin feat, two skill proficiencies, one tool proficiency, and 50 GP for equipment. Ask your GM to approve it. If you own a book with a background you like, you can recreate it by entering its choices here.', e: 'A sailor-like background could raise Strength, Dexterity and Wisdom, give the Alert feat, Athletics and Perception, and Navigator’s Tools.', r: 'backgroundParts' },
    backgroundIncrease: { t: 'Background ability increases', s: 'Your background lists three abilities. Increase one by 2 and another by 1, or all three by 1. This can’t raise a score above 20.', e: 'A Soldier (Strength, Dexterity, Constitution) could take +2 Strength and +1 Constitution.', r: 'bgAbilities' },
    alignment: { t: 'Alignment', s: 'Alignment is a short description of your character’s ethics: good, neutral or evil, and lawful, neutral or chaotic. It has no rules effect in this creator and is optional.', e: 'A rebel who robs a cruel baron’s tax collectors to help the poor is probably Chaotic Good.', r: 'alignment' },
    abilityScores: { t: 'Ability scores', s: 'Six scores describe your character: Strength, Dexterity, Constitution, Intelligence, Wisdom and Charisma. Each score has a modifier that you add to rolls that use that ability.', e: 'A high Dexterity helps with ranged attacks, Stealth and Armor Class.', g: 'ability-score-and-modifier' },
    abilityModifier: { t: 'Ability modifier', s: 'The modifier is the number you actually add to rolls. It is (score − 10) ÷ 2, rounded down.', e: 'A score of 15 gives +2, 10 gives +0, and 8 gives −1.', g: 'ability-score-and-modifier' },
    standardArray: { t: 'Standard Array', s: 'Assign each of the scores 15, 14, 13, 12, 10 and 8 to a different ability. It is the quickest balanced option.', e: 'A Wizard might put 15 in Intelligence and 14 in Constitution.', r: 'generate' },
    pointBuy: { t: 'Point Cost (27 points)', s: 'Every score starts at 8. Spend 27 points to raise scores, up to 15 before background increases. Higher scores cost more points.', e: 'Raising a score from 13 to 14 costs 2 points, and from 14 to 15 costs another 2.', r: 'generate' },
    randomScores: { t: 'Random generation', s: 'Roll four six-sided dice, drop the lowest and add the rest, six times. Then assign the totals to your abilities. Results can be higher or lower than the other methods.', e: 'Rolling 6, 4, 3 and 1 gives 6 + 4 + 3 = 13.', r: 'generate' },
    proficiencyBonus: { t: 'Proficiency Bonus', s: 'A bonus you add to D20 Tests with things you are trained in: proficient skills, saving throws, weapons, tools and your spells. It depends only on your level: +2 at levels 1–4, +3 at 5–8, +4 at 9–12, +5 at 13–16 and +6 at 17–20.', e: 'A level 1 Rogue proficient in Stealth with Dexterity +3 rolls d20 + 3 + 2.', g: 'proficiency' },
    savingThrows: { t: 'Saving throws', s: 'A saving throw is a roll to resist a threat, like dodging a fireball (Dexterity) or shaking off poison (Constitution). Roll d20 + the ability modifier, plus your Proficiency Bonus if you are proficient in that save.', e: 'With Dexterity +2 and proficiency (+2), your Dexterity save is d20 + 4.', g: 'saving-throw', r: 'savesPerClass' },
    skills: { t: 'Skills', s: 'Skills are areas of training used for ability checks. Roll d20 + the skill’s ability modifier, plus your Proficiency Bonus if you are proficient in the skill.', e: 'Sneaking past a guard is a Dexterity (Stealth) check.', g: 'skill' },
    expertise: { t: 'Expertise', s: 'Expertise doubles your Proficiency Bonus for one skill you are already proficient in.', e: 'At level 1 (Proficiency Bonus +2), Expertise in Stealth adds +4 instead of +2.', g: 'expertise' },
    jackOfAllTrades: { t: 'Jack of All Trades', s: 'From Bard level 2, add half your Proficiency Bonus (rounded down) to ability checks with a skill you aren’t proficient in.', e: 'A level 2 Bard (Proficiency Bonus +2) adds +1 to every untrained skill.', f: ['bard', 'Jack of All Trades'] },
    passivePerception: { t: 'Passive Perception', s: 'How much your character notices without actively searching: 10 + your Wisdom (Perception) bonus. The GM compares it with hidden things and sneaking creatures.', e: 'Wisdom 14 (+2) and Perception proficiency (+2) give a Passive Perception of 14.', g: 'passive-perception' },
    armorTraining: { t: 'Armor training', s: 'Training lets you wear a category of armor without penalties. Without it you have Disadvantage on Strength and Dexterity rolls and can’t cast spells, and a Shield gives no AC.', e: 'A Wizard in Chain Mail couldn’t cast spells.', g: 'armor-training' },
    weaponProficiency: { t: 'Weapon proficiency', s: 'Anyone can use any weapon, but you add your Proficiency Bonus to the attack roll only with weapons you are proficient with.', e: 'A Wizard can swing a Longsword but doesn’t add the Proficiency Bonus to hit.', r: 'weaponProf' },
    tools: { t: 'Tool proficiency', s: 'Add your Proficiency Bonus to ability checks that use the tool. If a relevant skill also applies and you are proficient in it, you also get Advantage.', e: 'Picking a lock with Thieves’ Tools uses your tool proficiency.', r: 'tools' },
    languages: { t: 'Languages', s: 'Every character knows Common plus two standard languages. Some classes add more, like the Rogue’s Thieves’ Cant or the Druid’s Druidic.', e: 'A Dwarf adventurer might choose Dwarvish and Giant.', r: 'languages' },
    hitPoints: { t: 'Hit Points', s: 'Hit Points measure how much harm you can take. Damage lowers them; at 0 you fall Unconscious and start making Death Saving Throws. At level 1 you get your Hit Die’s maximum + Constitution modifier, then a fixed amount (or a roll) + Constitution modifier per level.', e: 'A level 1 Fighter with Constitution +2 has 10 + 2 = 12 Hit Points.', g: 'hit-points', r: 'hpLevelUp' },
    hitDice: { t: 'Hit Point Dice', s: 'You have one Hit Die per level. During a Short Rest you can spend them to heal: roll the die and add your Constitution modifier. A Long Rest restores all spent Hit Dice.', e: 'A level 3 Cleric has 3d8 Hit Dice and can spend two of them on a Short Rest.', g: 'hit-point-dice' },
    temporaryHp: { t: 'Temporary Hit Points', s: 'A buffer that is lost before your real Hit Points. They don’t stack with each other and can’t be healed back.', e: 'A Druid entering Wild Shape gains Temporary Hit Points equal to their Druid level.', g: 'temporary-hit-points' },
    armorClass: { t: 'Armor Class (AC)', s: 'The number an attack roll must reach to hit you. Without armor it is 10 + Dexterity modifier; armor, a Shield (+2) and some features change it. You use only one base calculation at a time.', e: 'Leather Armor (11) with Dexterity +3 gives AC 14, or 16 with a Shield.', g: 'armor-class' },
    initiative: { t: 'Initiative', s: 'When combat starts, everyone rolls Initiative (a Dexterity check) to decide turn order, highest first.', e: 'With Dexterity +3 you roll d20 + 3. The Alert feat adds your Proficiency Bonus too.', g: 'initiative' },
    speed: { t: 'Speed', s: 'How many feet you can move on your turn. You can split the movement before and after your action.', e: 'With Speed 30 you can move 15 feet, attack, then move 15 more.', g: 'speed' },
    size: { t: 'Size', s: 'Most species are Medium or Small. Size decides how much space you take up and which creatures you can grapple.', e: 'A Halfling is Small.', g: 'size' },
    darkvision: { t: 'Darkvision', s: 'Within the listed range you see in Dim Light as if it were Bright Light, and in Darkness as if it were Dim Light (in shades of gray).', e: 'With 60 feet of Darkvision you can see a goblin 50 feet away in a dark cave.', g: 'darkvision' },
    deathSaves: { t: 'Death Saving Throws', s: 'At 0 Hit Points you roll a d20 at the start of each turn: 10 or higher is a success. Three successes and you are Stable; three failures and you die. A 1 counts as two failures; a 20 brings you back with 1 Hit Point. Any healing gets you back up.', e: 'An ally casting Healing Word on you ends the Death Saving Throws at once.', r: 'deathSaves' },
    heroicInspiration: { t: 'Heroic Inspiration', s: 'Spend it to reroll any one die right after you roll it; you must use the new roll. Humans gain it whenever they finish a Long Rest.', e: 'You rolled a 3 on a saving throw: spend Heroic Inspiration and roll again.', g: 'heroic-inspiration' },
    features: { t: 'Features', s: 'Features are the special abilities your class and subclass give you at each level. Each one says when you can use it and how often.', e: 'Second Wind lets a Fighter heal as a Bonus Action, twice per Long Rest.', r: 'classFeatures' },
    traits: { t: 'Species traits', s: 'Traits are the special abilities your species gives you, such as Darkvision or resistance to a damage type.', e: 'Elves have Fey Ancestry: Advantage on saves against being Charmed.', r: 'speciesStep' },
    feats: { t: 'Feats', s: 'A feat is a special talent. You get an Origin feat from your background, and at certain class levels (usually 4, 8, 12, 16) you can take a General feat or the Ability Score Improvement feat. At level 19 you get an Epic Boon.', e: 'Alert adds your Proficiency Bonus to Initiative.', r: 'featParts' },
    originFeat: { t: 'Origin feat', s: 'A feat from your background (and, for Humans, one more from Versatile). Origin feats have no prerequisites.', e: 'The Soldier background gives Savage Attacker.', r: 'originFeat' },
    asi: { t: 'Ability Score Improvement', s: 'A General feat: increase one ability score by 2, or two scores by 1 each. It can’t raise a score above 20.', e: 'A Fighter with Strength 16 could take +2 Strength to reach 18.', ft: 'ability-score-improvement' },
    epicBoon: { t: 'Epic Boon', s: 'A powerful feat available at level 19. Each Epic Boon also increases one ability score by 1, up to 30.', e: 'Boon of Fate lets you roll 2d4 to raise or lower a D20 Test that you or a creature within 60 feet just made.', r: 'featParts' },
    fightingStyle: { t: 'Fighting Style', s: 'Fighters, Paladins and Rangers choose a Fighting Style feat that improves one way of fighting. Paladins and Rangers can instead learn two Cleric or Druid cantrips.', e: 'Defense gives +1 AC while you wear armor.', f: ['fighter', 'Fighting Style'] },
    weapons: { t: 'Weapons', s: 'Each weapon is Simple or Martial, melee or ranged, and lists its damage die, damage type and properties. Your attack roll is d20 + ability modifier + Proficiency Bonus (if proficient).', e: 'A Longsword deals 1d8 Slashing damage, or 1d10 with two hands (Versatile).', g: 'weapon' },
    weaponProperties: { t: 'Weapon properties', s: 'Properties are short rules on a weapon, such as Finesse (use Strength or Dexterity), Light (extra Bonus Action attack), Heavy, Reach or Thrown.', e: 'A Dagger is Finesse, Light and Thrown.', wp: true },
    damageTypes: { t: 'Damage types', s: 'Every damage roll has a type, like Slashing, Fire or Radiant. Types have no rules of their own, but Resistance halves damage of a type and Vulnerability doubles it.', e: 'A creature with Resistance to Fire takes 5 damage from a 10-damage Fire Bolt.', g: 'damage-types' },
    weaponMastery: { t: 'Weapon Mastery', s: 'Some classes can use the mastery property of a few kinds of weapons. Each mastery adds an effect when you attack with that weapon, like pushing or slowing the target. After a Long Rest you can change one of your choices.', e: 'With Greatsword mastery (Graze), a miss still deals damage equal to your Strength modifier.', f: ['fighter', 'Weapon Mastery'] },
    armor: { t: 'Armor', s: 'Light, Medium and Heavy armor set your base Armor Class. Medium armor adds at most +2 Dexterity, Heavy armor adds none, and some armor needs Strength or gives Disadvantage on Stealth.', e: 'Chain Mail is AC 16 and needs Strength 13.', r: 'armorStrength' },
    shield: { t: 'Shield', s: 'A Shield adds +2 to your Armor Class if you have Shield training. It takes one hand.', e: 'AC 16 armor plus a Shield gives AC 18.', g: 'armor-training' },
    startingEquipment: { t: 'Starting equipment', s: 'Your class and background each offer a package of items or gold instead. The sheet lists only what you choose here.', e: 'A Fighter can take a package with Chain Mail and a Greatsword, or 155 GP.', r: 'higherLevels' },
    attackBonus: { t: 'Attack bonus', s: 'What you add to the d20 when you attack: ability modifier (Strength for most melee, Dexterity for ranged and Finesse) + Proficiency Bonus if proficient. If the total equals or beats the target’s AC, you hit.', e: 'Strength +3 and proficiency +2 make a +5 attack.', g: 'attack-roll' },
    criticalHit: { t: 'Critical Hit', s: 'Rolling a 20 on an attack roll always hits, and you roll the attack’s damage dice twice.', e: 'A Longsword critical deals 2d8 + Strength modifier.', g: 'critical-hit' },
    unarmedStrike: { t: 'Unarmed Strike', s: 'Everyone can punch or kick: attack with Strength + Proficiency Bonus for 1 + Strength modifier Bludgeoning damage, or Grapple or Shove instead. Monks use their Martial Arts die.', e: 'Strength +2: +4 to hit, 3 damage.', g: 'unarmed-strike' },
    advantage: { t: 'Advantage and Disadvantage', s: 'With Advantage roll two d20s and use the higher; with Disadvantage use the lower. They never stack, and having both cancels them out.', e: 'Attacking a Prone enemy next to you gives Advantage.', g: 'advantage' },
    actions: { t: 'Actions on your turn', s: 'On your turn you can move, take one action (Attack, Magic, Dash, Dodge, Help, Hide and others), and take a Bonus Action only if a feature or spell gives you one. A Reaction can be used once per round, even on others’ turns.', e: 'A Rogue attacks with the Attack action, then uses Cunning Action to Hide as a Bonus Action.', g: 'action' },
    bonusAction: { t: 'Bonus Action', s: 'An extra, quick action you can take only when a feature or spell says so; one per turn.', e: 'Healing Word has a casting time of a Bonus Action.', g: 'bonus-action' },
    reaction: { t: 'Reaction', s: 'An instant response to a trigger, once per round, even on someone else’s turn. The Opportunity Attack is a Reaction everyone has.', e: 'The Shield spell is cast as a Reaction when you are hit.', g: 'reaction' },
    shortRest: { t: 'Short Rest', s: 'A 1-hour break. You can spend Hit Dice to heal, and some features recharge.', e: 'A Warlock regains all Pact Magic slots on a Short Rest.', g: 'short-rest' },
    longRest: { t: 'Long Rest', s: 'At least 8 hours of rest. You regain all Hit Points, all spent Hit Dice and all spell slots, and most features recharge.', e: 'A Wizard can change prepared spells after a Long Rest.', g: 'long-rest' },
    concentration: { t: 'Concentration', s: 'Some spells last only while you concentrate. You can concentrate on one at a time, and taking damage forces a Constitution save (DC 10 or half the damage, whichever is higher) to keep it.', e: 'Casting Bless while concentrating on Hunter’s Mark ends Hunter’s Mark.', g: 'concentration' },
    ritual: { t: 'Ritual casting', s: 'A spell with the Ritual tag can be cast as a Ritual: it takes 10 minutes longer but uses no spell slot. You must have it prepared (Wizards can cast rituals from their spellbook).', e: 'Detect Magic as a Ritual takes 10 minutes and 1 action, and costs no slot.', g: 'ritual' },
    components: { t: 'Spell components', s: 'V means you must speak, S means you need a free hand to gesture, and M means you need the listed material (a Spellcasting Focus or Component Pouch can replace materials that have no cost and aren’t consumed).', e: 'You can’t cast a V spell while gagged or in magical silence.', r: 'components' },
    range: { t: 'Range', s: 'How far away a spell’s effect can start: a distance in feet, Touch (someone within your reach) or Self.', e: 'Fire Bolt has a range of 120 feet.', r: 'range' },
    duration: { t: 'Duration', s: 'How long a spell lasts: Instantaneous, a set time (like 1 minute), or as long as you keep Concentration.', e: 'Mage Armor lasts 8 hours.', r: 'duration' },
    castingTime: { t: 'Casting time', s: 'Most spells take the Magic action. Some take a Bonus Action or Reaction, and some take a minute or more. You can expend only one spell slot per turn.', e: 'You can’t cast a level 1 spell with your action and another levelled spell as a Bonus Action on the same turn.', r: 'castingTime' },
    spellSlots: { t: 'Spell slots', s: 'Spell slots are your daily fuel for level 1+ spells. Casting a spell uses a slot of its level or higher; a Long Rest restores them. Cantrips need no slot.', e: 'A level 3 Wizard has four level 1 slots and two level 2 slots.', r: 'spellSlots' },
    upcasting: { t: 'Higher-level slots', s: 'You can cast a spell with a higher slot than its level; many spells get stronger when you do.', e: 'Cure Wounds cast with a level 2 slot heals an extra 2d8.', r: 'higherSlot' },
    spellcastingAbility: { t: 'Spellcasting ability', s: 'The ability your class uses for its spells: Intelligence for Wizards; Wisdom for Clerics, Druids and Rangers; Charisma for Bards, Paladins, Sorcerers and Warlocks. It sets your spell attack bonus and save DC.', e: 'A Cleric with Wisdom 16 (+3) uses +3 for spells.', r: 'saveDC' },
    spellAttack: { t: 'Spell attack bonus', s: 'What you add to the d20 for spells that make an attack roll: spellcasting ability modifier + Proficiency Bonus.', e: 'Charisma +3 and proficiency +2 give +5 for Eldritch Blast.', g: 'spell-attack', r: 'spellAttack' },
    saveDC: { t: 'Spell save DC', s: 'The number a target must roll to resist your spells: 8 + spellcasting ability modifier + Proficiency Bonus.', e: 'Intelligence +3 and proficiency +2 give DC 13.', g: 'difficulty-class', r: 'saveDC' },
    preparedSpells: { t: 'Prepared spells', s: 'Your list of level 1+ spells you can cast with your slots. Clerics, Druids and Wizards can change any of them after a Long Rest; Paladins and Rangers change one after a Long Rest; Bards, Sorcerers and Warlocks change one when they gain a level.', e: 'A level 1 Cleric prepares 4 spells from the Cleric list.', r: 'preparing' },
    knownSpells: { t: 'Spells you know', s: 'The 2024 rules have no separate “spells known” list: every class prepares spells. Bards, Sorcerers and Warlocks can swap only one spell when they gain a level, so their list works like the older “known spells”.', e: 'A level 2 Sorcerer can replace one prepared spell when reaching level 3.', r: 'preparing' },
    cantrips: { t: 'Cantrips', s: 'Level 0 spells you can cast at will, without a slot. Damage cantrips grow stronger at character levels 5, 11 and 17.', e: 'Fire Bolt deals 1d10 at level 1 and 2d10 at level 5.', g: 'cantrip' },
    alwaysPrepared: { t: 'Always prepared', s: 'Spells a feature gives you that are always ready and don’t count against your prepared spell number.', e: 'A Life Domain Cleric always has Bless and Cure Wounds prepared.', r: 'alwaysPrepared' },
    spellbook: { t: 'Spellbook', s: 'Wizards keep their spells in a spellbook: six level 1 spells at level 1, plus two per Wizard level, each of a level you can cast. You prepare spells from the book.', e: 'A level 3 Wizard has 10 spells in the book and prepares 6 of them.', f: ['wizard', 'Spellcasting'] },
    pactMagic: { t: 'Pact Magic', s: 'Warlocks have only a few spell slots, all of the same (highest) level, and they come back after a Short Rest as well as a Long Rest.', e: 'A level 5 Warlock has two level 3 slots; even Charm Person is cast at level 3.', f: ['warlock', 'Pact Magic'] },
    mysticArcanum: { t: 'Mystic Arcanum', s: 'From Warlock level 11, choose one spell of level 6 (then 7, 8 and 9 at levels 13, 15 and 17). Cast each once per Long Rest without a slot.', e: 'A level 11 Warlock might choose a level 6 spell such as Circle of Death.', f: ['warlock', 'Mystic Arcanum'] },
    invocations: { t: 'Eldritch Invocations', s: 'Warlock-only powers. Some are always on, some give spells, and some improve a damage cantrip. Many have prerequisites such as a Warlock level or another invocation.', e: 'Agonizing Blast adds your Charisma modifier to Eldritch Blast’s damage.', f: ['warlock', 'Eldritch Invocations'] },
    metamagic: { t: 'Metamagic', s: 'Sorcerers spend Sorcery Points to change how a spell works, like doubling its range or affecting a second target. You can usually use one Metamagic option per spell.', e: 'Quickened Spell turns an action spell into a Bonus Action spell.', f: ['sorcerer', 'Metamagic'] },
    magicalSecrets: { t: 'Magical Secrets', s: 'From Bard level 10, new prepared spells can come from the Bard, Cleric, Druid and Wizard lists.', e: 'A level 10 Bard can prepare Fireball.', f: ['bard', 'Magical Secrets'] },
    classResources: { t: 'Class resources', s: 'Numbers from your class table, such as Rages, Focus Points or Channel Divinity uses. Each feature says when they recharge.', e: 'A level 5 Barbarian can Rage 3 times per Long Rest (regaining one on a Short Rest).', g: 'short-rest' },
    rage: { t: 'Rage', s: 'A Bonus Action power while not in Heavy armor: Resistance to Bludgeoning, Piercing and Slashing damage, extra damage on Strength attacks, and Advantage on Strength checks and saves. You can’t cast spells or concentrate while raging.', e: 'At level 1 Rage adds +2 to each Strength-based weapon hit.', f: ['barbarian', 'Rage'] },
    sneakAttack: { t: 'Sneak Attack', s: 'Once per turn, deal extra damage when you hit with a Finesse or ranged weapon and either have Advantage or an ally next to the target (and no Disadvantage).', e: 'A level 1 Rogue adds 1d6; a level 5 Rogue adds 3d6.', f: ['rogue', 'Sneak Attack'] },
    martialArts: { t: 'Martial Arts', s: 'While unarmored and without a Shield, Monks can use Dexterity for Unarmed Strikes and Monk weapons, roll the Martial Arts die for damage, and make an Unarmed Strike as a Bonus Action.', e: 'A level 1 Monk’s punch deals 1d6 + Dexterity modifier.', f: ['monk', 'Martial Arts'] },
    unarmoredDefense: { t: 'Unarmored Defense', s: 'While wearing no armor, your base AC uses a second ability modifier as well as Dexterity: Constitution for Barbarians (Shield allowed), Wisdom for Monks (no Shield).', e: 'A Monk with Dexterity +3 and Wisdom +2 has AC 15 unarmored.', f: ['barbarian', 'Unarmored Defense'] },
    channelDivinity: { t: 'Channel Divinity', s: 'Clerics and Paladins channel divine energy for special effects, a few times per rest (regaining one use on a Short Rest).', e: 'Turn Undead makes nearby Undead flee.', f: ['cleric', 'Channel Divinity'] },
    wildShape: { t: 'Wild Shape', s: 'Druids can turn into a known Beast form as a Bonus Action, gaining Temporary Hit Points equal to their Druid level. You can’t cast spells while shape-shifted.', e: 'A level 2 Druid can become a Wolf to scout or fight.', f: ['druid', 'Wild Shape'] },
    bardicInspiration: { t: 'Bardic Inspiration', s: 'As a Bonus Action, give an ally a die (d6 at first). Once within an hour they can add it to a failed D20 Test. Uses equal your Charisma modifier (minimum 1) per Long Rest.', e: 'Your ally misses by 2; they roll your d6 and get a 4 — now it hits.', f: ['bard', 'Bardic Inspiration'] },
    layOnHands: { t: 'Lay on Hands', s: 'A pool of healing equal to five times your Paladin level. As a Bonus Action, touch a creature to restore any amount from the pool.', e: 'A level 3 Paladin has 15 points to share out.', f: ['paladin', 'Lay On Hands'] },
    auraOfProtection: { t: 'Aura of Protection', s: 'From Paladin level 6, you and allies within 10 feet add your Charisma modifier (minimum +1) to saving throws, unless you are Incapacitated.', e: 'Charisma +3: everyone nearby gets +3 on saves.', f: ['paladin', 'Aura of Protection'] },
    secondWind: { t: 'Second Wind', s: 'As a Bonus Action, a Fighter regains 1d10 + Fighter level Hit Points. A few uses per Long Rest, regaining one on a Short Rest.', e: 'A level 3 Fighter heals 1d10 + 3.', f: ['fighter', 'Second Wind'] },
    focusPoints: { t: 'Focus Points', s: 'Monks spend Focus Points for Flurry of Blows, Patient Defense and Step of the Wind. All points return on a Short or Long Rest.', e: 'Spend 1 point to make two Unarmed Strikes as a Bonus Action.', f: ['monk', 'Monk\'s Focus'] },
    sorceryPoints: { t: 'Sorcery Points', s: 'Sorcerers spend Sorcery Points on Metamagic and can trade them for spell slots (or slots for points). They return on a Long Rest.', e: 'Turn 2 Sorcery Points into a level 1 spell slot as a Bonus Action.', f: ['sorcerer', 'Font of Magic'] },
    favoredEnemy: { t: 'Favored Enemy', s: 'Rangers always have Hunter’s Mark prepared and can cast it a few times per Long Rest without a slot.', e: 'Mark a target and deal an extra 1d6 Force damage when you hit it.', f: ['ranger', 'Favored Enemy'] },
  };

  // ---------------------------------------------------------------------------
  function featureText(classId, name) {
    var cls = Api().getClass(classId);
    if (!cls) return null;
    var f = cls.features.find(function (x) { return x.name === name; });
    return f ? f.description : null;
  }

  function glossaryRule(id) {
    var g = Api().getGlossary(id);
    return g ? { title: g.name, text: g.text, source: 'SRD 5.2.1 Rules Glossary: ' + g.name } : null;
  }

  function conceptTip(key) {
    var c = C[key];
    if (!c) return null;
    var rule = null;
    if (c.f) {
      var text = featureText(c.f[0], c.f[1]);
      if (text) rule = { title: c.f[1], text: text, source: 'SRD 5.2.1 ' + Api().getClass(c.f[0]).name + ' feature' };
    }
    if (!rule && c.ft && Api().getFeat(c.ft)) rule = { title: Api().getFeat(c.ft).name, text: Api().getFeat(c.ft).description, source: 'SRD 5.2.1 feat' };
    if (!rule && c.wp && Api().rules().weaponRules) {
      var props = Api().rules().weaponRules.properties;
      rule = { title: 'Weapon properties', text: Object.keys(props).map(function (k) { return '**' + k + '.** ' + props[k]; }).join('\n\n'), source: 'SRD 5.2.1 Equipment: Properties' };
    }
    if (!rule && c.r && QUOTES[c.r]) rule = { title: c.t, text: QUOTES[c.r].text, source: 'SRD 5.2.1 ' + QUOTES[c.r].source };
    if (!rule && c.g) rule = glossaryRule(c.g);
    var extra = c.g && rule && rule.source.indexOf('Glossary') < 0 ? glossaryRule(c.g) : null;
    return { key: key, title: c.t, summary: c.s, example: c.e || null, rule: rule, extraRule: extra };
  }

  function signed(n) {
    return (n >= 0 ? '+' : '') + n;
  }

  function cap(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function abilityName(a) {
    return Api().rules().abilityNames[a] || a;
  }

  var CASTER_TEXT = { full: 'a full spellcaster (spell levels up to 9)', half: 'a half caster (spell levels up to 5)', pact: 'a Pact Magic caster (few slots that recharge on a Short Rest)' };

  /** Tips about one rules object, built from its data and its own SRD text. */
  var RESOLVERS = {
    class: function (id) {
      var cls = Api().getClass(id);
      if (!cls) return null;
      var bits = ['d' + cls.hitDie + ' Hit Die', 'primary ability ' + cls.primaryAbilityText, 'proficient in ' + cls.savingThrows.map(abilityName).join(' and ') + ' saving throws'];
      var cast = cls.spellcasting ? 'It is ' + CASTER_TEXT[cls.spellcasting.type] + ' using ' + abilityName(cls.spellcasting.ability) + '.' : 'It doesn’t cast spells.';
      return {
        title: cls.name, summary: cls.name + ': ' + bits.join(', ') + '. ' + cast + ' Subclass at level ' + cls.subclassLevel + ' (' + cls.subclass.name + ' in the SRD).',
        example: 'Level 1 features: ' + cls.features.filter(function (f) { return f.level === 1; }).map(function (f) { return f.name; }).join(', ') + '.',
        rule: { title: 'Armor and weapons', text: 'Weapons: ' + cls.weaponProficiencyText + '\nArmor training: ' + cls.armorTrainingText + (cls.toolProficiencyText ? '\nTools: ' + cls.toolProficiencyText : '') + '\nStarting equipment: ' + cls.equipmentText, source: 'SRD 5.2.1 ' + cls.name + ' core traits' },
      };
    },
    subclass: function (id) {
      var parts = id.split(':');
      var sub = Api().getSubclass(parts[0], parts[1]);
      if (!sub) return null;
      return {
        title: sub.name, summary: sub.tagline ? sub.tagline + '. ' : '',
        example: 'Features: ' + sub.features.map(function (f) { return f.name + ' (' + f.level + ')'; }).join(', ') + '.',
        rule: { title: sub.name, text: sub.description, source: 'SRD 5.2.1 subclass' },
      };
    },
    species: function (id) {
      var sp = Api().getSpecies(id);
      if (!sp) return null;
      return {
        title: sp.name, summary: sp.sizeOptions.join(' or ') + ', Speed ' + sp.speed + ' feet. Traits: ' + sp.traits.map(function (t) { return t.name; }).join(', ') + '.',
        example: null,
        rule: { title: sp.name + ' traits', text: sp.traits.map(function (t) { return '**' + t.name + '.** ' + t.description; }).join('\n\n'), source: 'SRD 5.2.1 species' },
      };
    },
    background: function (id) {
      if (id === 'custom') return conceptTip('customBackground');
      var bg = Api().getBackground(id);
      if (!bg) return null;
      var feat = Api().getFeat(bg.feat.id);
      return {
        title: bg.name,
        summary: 'Raise ' + bg.abilities.map(abilityName).join(', ') + '. Origin feat: ' + feat.name + (bg.feat.spellList ? ' (' + cap(bg.feat.spellList) + ')' : '') + '. Skills: ' + bg.skills.map(function (s) { return Api().getSkill(s).name; }).join(', ') + '. Tool: ' + (bg.tool.name || bg.tool.text) + '.',
        example: 'Equipment: ' + bg.equipmentText,
        rule: { title: feat.name, text: feat.description, source: 'SRD 5.2.1 feat' },
      };
    },
    feat: function (id) {
      var f = Api().getFeat(id);
      if (!f) return null;
      var cat = { origin: 'Origin feat', general: 'General feat', 'fighting-style': 'Fighting Style feat', 'epic-boon': 'Epic Boon feat' }[f.category] || 'Feat';
      return {
        title: f.name, summary: cat + (f.prerequisite ? ' (prerequisite: ' + f.prerequisite + ')' : '') + (f.repeatable ? '. You can take it more than once.' : '.'),
        example: null, rule: { title: f.name, text: f.description, source: f.alternative ? 'SRD 5.2.1 class feature' : 'SRD 5.2.1 feat' },
      };
    },
    spell: function (id) {
      var sp = Api().getSpell(id);
      if (!sp) return null;
      var tags = [];
      if (sp.concentration) tags.push('needs Concentration');
      if (sp.ritual) tags.push('can be cast as a Ritual');
      if (sp.attackRoll) tags.push('uses a spell attack roll');
      if (sp.savingThrow) tags.push('targets make a ' + sp.savingThrow + ' saving throw');
      if (sp.damageTypes && sp.damageTypes.length) tags.push('deals ' + sp.damageTypes.map(cap).join('/') + ' damage');
      if (sp.healing) tags.push('restores Hit Points');
      return {
        title: sp.name,
        summary: (sp.level === 0 ? sp.school + ' cantrip' : 'Level ' + sp.level + ' ' + sp.school) + '. Casting time ' + sp.castingTime + ', range ' + sp.range + ', components ' + sp.components + ', duration ' + sp.duration + '.' + (tags.length ? ' It ' + tags.join(', ') + '.' : ''),
        example: 'Classes: ' + sp.classes.map(cap).join(', ') + '.',
        rule: { title: sp.name, text: sp.description + (sp.higherLevels ? '\n\n' + (sp.level === 0 ? '_Cantrip Upgrade._ ' : '_Using a Higher-Level Spell Slot._ ') + sp.higherLevels : ''), source: 'SRD 5.2.1 spell' },
      };
    },
    weapon: function (id) {
      var w = Api().getWeapon(id);
      if (!w) return null;
      var props = Api().rules().weaponRules ? Api().rules().weaponRules.properties : {};
      var propText = w.properties.map(function (p) {
        var name = p.replace(/\s*\(.*$/, '');
        return props[name] ? '**' + p + '.** ' + props[name] : null;
      }).filter(Boolean);
      var mastery = Api().rules().masteryProperties[w.mastery];
      return {
        title: w.name,
        summary: cap(w.category) + ' ' + w.kind + ' weapon: ' + w.damage + ' ' + w.damageType + ' damage. Properties: ' + (w.properties.join(', ') || 'none') + '. Mastery: ' + w.mastery + '.',
        example: w.finesse ? 'Finesse: you can use Strength or Dexterity for its attack and damage rolls.' : w.kind === 'ranged' ? 'Ranged: attack and damage use Dexterity.' : 'Melee: attack and damage use Strength.',
        rule: { title: w.name, text: propText.concat(mastery ? ['**Mastery: ' + w.mastery + '.** ' + mastery] : []).join('\n\n'), source: 'SRD 5.2.1 Equipment' },
      };
    },
    armor: function (id) {
      var a = Api().getArmor(id);
      if (!a) return null;
      if (a.category === 'shield') return Object.assign(conceptTip('shield'), { title: a.name });
      var ac = a.baseAC + (a.addDex ? (a.maxDex != null ? ' + Dexterity modifier (max ' + a.maxDex + ')' : ' + Dexterity modifier') : '');
      var notes = [];
      if (a.strength) notes.push('Needs Strength ' + a.strength + ', or your Speed drops by 10 feet.');
      if (a.stealthDisadvantage) notes.push('Disadvantage on Dexterity (Stealth) checks.');
      return {
        title: a.name, summary: cap(a.category) + ' armor: AC ' + ac + '. ' + notes.join(' '), example: null,
        rule: { title: 'Armor', text: QUOTES.armorStrength.text + '\n\n' + QUOTES.armorStealth.text, source: 'SRD 5.2.1 Equipment: Armor' },
      };
    },
    mastery: function (name) {
      var text = Api().rules().masteryProperties[name];
      if (!text) return null;
      return { title: name + ' (Weapon Mastery)', summary: 'A mastery property: you can use it only with a kind of weapon you chose for Weapon Mastery.', example: null, rule: { title: name, text: text, source: 'SRD 5.2.1 Equipment: Mastery Properties' } };
    },
    property: function (name) {
      var props = Api().rules().weaponRules ? Api().rules().weaponRules.properties : {};
      var base = name.replace(/\s*\(.*$/, '');
      if (!props[base]) return null;
      return { title: name, summary: 'A weapon property.', example: null, rule: { title: base, text: props[base], source: 'SRD 5.2.1 Equipment: Properties' } };
    },
    skill: function (id) {
      var s = Api().getSkill(id);
      if (!s) return null;
      return { title: s.name + ' (' + abilityName(s.ability) + ')', summary: s.exampleUses || '', example: 'Roll d20 + ' + abilityName(s.ability) + ' modifier, plus your Proficiency Bonus if you are proficient.', rule: glossaryRule('skill') };
    },
    ability: function (id) {
      var d = Api().rules().abilityDescriptions || {};
      if (!d[id]) return null;
      return { title: abilityName(id), summary: abilityName(id) + ' measures: ' + d[id] + '.', example: 'Modifier = (score − 10) ÷ 2, rounded down.', rule: glossaryRule('ability-score-and-modifier') };
    },
    save: function (id) {
      var t = conceptTip('savingThrows');
      return Object.assign({}, t, { title: abilityName(id) + ' saving throw' });
    },
    invocation: function (id) {
      var inv = Api().getInvocation(id);
      if (!inv) return null;
      return { title: inv.name, summary: 'Eldritch Invocation' + (inv.prerequisite ? ' (prerequisite: ' + inv.prerequisite + ')' : '') + (inv.repeatable ? '. Repeatable.' : '.'), example: null, rule: { title: inv.name, text: inv.description, source: 'SRD 5.2.1 Warlock: Eldritch Invocation Options' } };
    },
    metamagic: function (id) {
      var m = Api().getMetamagic(id);
      if (!m) return null;
      return { title: m.name, summary: 'Metamagic option. Cost: ' + m.cost + '.', example: null, rule: { title: m.name, text: m.description, source: 'SRD 5.2.1 Sorcerer: Metamagic Options' } };
    },
    tool: function (id) {
      var t = Api().getTool(id);
      if (!t) return null;
      return Object.assign({}, conceptTip('tools'), { title: t.name });
    },
    language: function (id) {
      var l = Api().getLanguage(id);
      if (!l) return null;
      var standard = Api().rules().languages.standard.some(function (x) { return x.id === id; });
      return Object.assign({}, conceptTip('languages'), { title: l.name, summary: l.name + ' is a ' + (standard ? 'standard' : 'rare') + ' language. ' + C.languages.s });
    },
    feature: function (id) {
      var parts = id.split(':');
      var cls = Api().getClass(parts[0]);
      if (!cls) return null;
      var name = parts.slice(1).join(':');
      var f = cls.features.find(function (x) { return x.name === name; }) || listSubFeatures(cls).find(function (x) { return x.name === name; });
      if (!f) return null;
      return { title: f.name, summary: 'A level ' + f.level + ' ' + cls.name + ' feature.', example: null, rule: { title: f.name, text: f.description, source: 'SRD 5.2.1 ' + cls.name } };
    },
    glossary: function (id) {
      var r = glossaryRule(id);
      return r ? { title: r.title, summary: '', example: null, rule: r } : null;
    },
    damage: function (type) {
      var t = conceptTip('damageTypes');
      return Object.assign({}, t, { title: cap(type) + ' damage' });
    },
  };

  function listSubFeatures(cls) {
    return Api().listSubclasses(cls.id).reduce(function (all, s) { return all.concat(s.features); }, []);
  }

  /**
   * get('armorClass') → concept tip; get('spell:fire-bolt') → tip for that spell.
   * Returns { key, title, summary, example, rule: {title, text, source} | null } or null.
   */
  function get(key) {
    if (!key) return null;
    if (C[key]) return conceptTip(key);
    var i = key.indexOf(':');
    if (i < 0) return null;
    var kind = key.slice(0, i);
    var resolver = RESOLVERS[kind];
    if (!resolver) return null;
    var tip = resolver(key.slice(i + 1));
    if (!tip) return null;
    tip.key = key;
    return tip;
  }

  global.FogGuidedTips = {
    get: get,
    conceptKeys: function () { return Object.keys(C); },
    resolverKinds: function () { return Object.keys(RESOLVERS); },
    signed: signed,
  };
})(window);
