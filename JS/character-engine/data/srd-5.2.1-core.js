/**
 * GENERATED FILE — do not edit by hand. Rebuild with tools/build-srd-data.mjs.
 * SRD 5.2.1 core character rules (classes, species, backgrounds, feats, equipment).
 *
 * This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
 */
(function (global) {
  'use strict';
  var rules = global.FogRules = global.FogRules || {};
  var core = {
 "meta": {
  "id": "srd-5.2.1",
  "edition": "D&D 5E (2024 rules)",
  "source": "System Reference Document 5.2.1",
  "license": "CC BY 4.0",
  "attribution": "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.",
  "generatedFrom": {
   "markdown": "downfallx/dnd-5e-srd-markdown@1b4b99dcb786cdd1a2fb26f8acec1551191f1ca4",
   "json": "5e-bits/5e-database@a6212beb4b278917c2cff41c2b04c4ef4f3e0d6f (src/2024/en)"
  },
  "maxLevel": 20,
  "supportedClassIds": [
   "barbarian",
   "bard",
   "cleric",
   "druid",
   "fighter",
   "monk",
   "paladin",
   "ranger",
   "rogue",
   "sorcerer",
   "warlock",
   "wizard"
  ],
  "coverageNote": "Includes all 12 SRD classes (levels 1–20) with their SRD subclass each, all 9 SRD species, all 4 SRD backgrounds, all SRD feats, Metamagic options and Eldritch Invocations, and every SRD spell. Multiclassing is not supported yet."
 },
 "abilities": [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha"
 ],
 "abilityNames": {
  "str": "Strength",
  "dex": "Dexterity",
  "con": "Constitution",
  "int": "Intelligence",
  "wis": "Wisdom",
  "cha": "Charisma"
 },
 "abilityDescriptions": {
  "str": "Physical might",
  "dex": "Agility, reflexes, and balance",
  "con": "Health and stamina",
  "int": "Reasoning and memory",
  "wis": "Perceptiveness and mental fortitude",
  "cha": "Confidence, poise, and charm"
 },
 "skills": [
  {
   "id": "acrobatics",
   "name": "Acrobatics",
   "ability": "dex",
   "exampleUses": "Stay on your feet in a tricky situation, or perform an acrobatic stunt."
  },
  {
   "id": "animal-handling",
   "name": "Animal Handling",
   "ability": "wis",
   "exampleUses": "Calm or train an animal, or get an animal to behave in a certain way."
  },
  {
   "id": "arcana",
   "name": "Arcana",
   "ability": "int",
   "exampleUses": "Recall lore about spells, magic items, and the planes of existence."
  },
  {
   "id": "athletics",
   "name": "Athletics",
   "ability": "str",
   "exampleUses": "Jump farther than normal, stay afloat in rough water, or break something."
  },
  {
   "id": "deception",
   "name": "Deception",
   "ability": "cha",
   "exampleUses": "Tell a convincing lie, or wear a disguise convincingly."
  },
  {
   "id": "history",
   "name": "History",
   "ability": "int",
   "exampleUses": "Recall lore about historical events, people, nations, and cultures."
  },
  {
   "id": "insight",
   "name": "Insight",
   "ability": "wis",
   "exampleUses": "Discern a person's mood and intentions."
  },
  {
   "id": "intimidation",
   "name": "Intimidation",
   "ability": "cha",
   "exampleUses": "Awe or threaten someone into doing what you want."
  },
  {
   "id": "investigation",
   "name": "Investigation",
   "ability": "int",
   "exampleUses": "Find obscure information in books, or deduce how something works."
  },
  {
   "id": "medicine",
   "name": "Medicine",
   "ability": "wis",
   "exampleUses": "Diagnose an illness, or determine what killed the recently slain."
  },
  {
   "id": "nature",
   "name": "Nature",
   "ability": "int",
   "exampleUses": "Recall lore about terrain, plants, animals, and weather."
  },
  {
   "id": "perception",
   "name": "Perception",
   "ability": "wis",
   "exampleUses": "Using a combination of senses, notice something that's easy to miss."
  },
  {
   "id": "performance",
   "name": "Performance",
   "ability": "cha",
   "exampleUses": "Act, tell a story, perform music, or dance."
  },
  {
   "id": "persuasion",
   "name": "Persuasion",
   "ability": "cha",
   "exampleUses": "Honestly and graciously convince someone of something."
  },
  {
   "id": "religion",
   "name": "Religion",
   "ability": "int",
   "exampleUses": "Recall lore about gods, religious rituals, and holy symbols."
  },
  {
   "id": "sleight-of-hand",
   "name": "Sleight of Hand",
   "ability": "dex",
   "exampleUses": "Pick a pocket, conceal a handheld object, or perform legerdemain."
  },
  {
   "id": "stealth",
   "name": "Stealth",
   "ability": "dex",
   "exampleUses": "Escape notice by moving quietly and hiding behind things."
  },
  {
   "id": "survival",
   "name": "Survival",
   "ability": "wis",
   "exampleUses": "Follow tracks, forage, find a trail, or avoid natural hazards."
  }
 ],
 "languages": {
  "standard": [
   {
    "id": "common",
    "name": "Common"
   },
   {
    "id": "common-sign-language",
    "name": "Common Sign Language"
   },
   {
    "id": "draconic",
    "name": "Draconic"
   },
   {
    "id": "dwarvish",
    "name": "Dwarvish"
   },
   {
    "id": "elvish",
    "name": "Elvish"
   },
   {
    "id": "giant",
    "name": "Giant"
   },
   {
    "id": "gnomish",
    "name": "Gnomish"
   },
   {
    "id": "goblin",
    "name": "Goblin"
   },
   {
    "id": "halfling",
    "name": "Halfling"
   },
   {
    "id": "orc",
    "name": "Orc"
   }
  ],
  "rare": [
   {
    "id": "abyssal",
    "name": "Abyssal"
   },
   {
    "id": "celestial",
    "name": "Celestial"
   },
   {
    "id": "deep-speech",
    "name": "Deep Speech"
   },
   {
    "id": "druidic",
    "name": "Druidic"
   },
   {
    "id": "infernal",
    "name": "Infernal"
   },
   {
    "id": "primordial",
    "name": "Primordial"
   },
   {
    "id": "sylvan",
    "name": "Sylvan"
   },
   {
    "id": "thieves-cant",
    "name": "Thieves' Cant"
   },
   {
    "id": "undercommon",
    "name": "Undercommon"
   }
  ]
 },
 "abilityMethods": {
  "standard-array": {
   "id": "standard-array",
   "label": "Standard Array",
   "description": "Assign each of these six scores to a different ability: 15, 14, 13, 12, 10, 8.",
   "scores": [
    15,
    14,
    13,
    12,
    10,
    8
   ]
  },
  "point-buy": {
   "id": "point-buy",
   "label": "Point Cost (27 points)",
   "description": "Spend 27 points. Every score starts at 8 and can be raised to at most 15 before background increases.",
   "min": 8,
   "max": 15,
   "budget": 27,
   "costs": {
    "8": 0,
    "9": 1,
    "10": 2,
    "11": 3,
    "12": 4,
    "13": 5,
    "14": 7,
    "15": 9
   }
  },
  "random": {
   "id": "random",
   "label": "Random Generation",
   "description": "Roll four d6 and add the highest three, six times, then assign the totals to your abilities. You can roll here or enter scores you rolled at the table (3–18).",
   "min": 3,
   "max": 18
  }
 },
 "alignments": [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil"
 ],
 "tools": [
  {
   "id": "alchemists-supplies",
   "name": "Alchemist's Supplies",
   "family": "artisan"
  },
  {
   "id": "brewers-supplies",
   "name": "Brewer's Supplies",
   "family": "artisan"
  },
  {
   "id": "calligraphers-supplies",
   "name": "Calligrapher's Supplies",
   "family": "artisan"
  },
  {
   "id": "carpenters-tools",
   "name": "Carpenter's Tools",
   "family": "artisan"
  },
  {
   "id": "cartographers-tools",
   "name": "Cartographer's Tools",
   "family": "artisan"
  },
  {
   "id": "cobblers-tools",
   "name": "Cobbler's Tools",
   "family": "artisan"
  },
  {
   "id": "cooks-utensils",
   "name": "Cook's Utensils",
   "family": "artisan"
  },
  {
   "id": "glassblowers-tools",
   "name": "Glassblower's Tools",
   "family": "artisan"
  },
  {
   "id": "jewelers-tools",
   "name": "Jeweler's Tools",
   "family": "artisan"
  },
  {
   "id": "leatherworkers-tools",
   "name": "Leatherworker's Tools",
   "family": "artisan"
  },
  {
   "id": "masons-tools",
   "name": "Mason's Tools",
   "family": "artisan"
  },
  {
   "id": "painters-supplies",
   "name": "Painter's Supplies",
   "family": "artisan"
  },
  {
   "id": "potters-tools",
   "name": "Potter's Tools",
   "family": "artisan"
  },
  {
   "id": "smiths-tools",
   "name": "Smith's Tools",
   "family": "artisan"
  },
  {
   "id": "tinkers-tools",
   "name": "Tinker's Tools",
   "family": "artisan"
  },
  {
   "id": "weavers-tools",
   "name": "Weaver's Tools",
   "family": "artisan"
  },
  {
   "id": "woodcarvers-tools",
   "name": "Woodcarver's Tools",
   "family": "artisan"
  },
  {
   "id": "disguise-kit",
   "name": "Disguise Kit"
  },
  {
   "id": "forgery-kit",
   "name": "Forgery Kit"
  },
  {
   "id": "herbalism-kit",
   "name": "Herbalism Kit"
  },
  {
   "id": "navigators-tools",
   "name": "Navigator's Tools"
  },
  {
   "id": "poisoners-kit",
   "name": "Poisoner's Kit"
  },
  {
   "id": "thieves-tools",
   "name": "Thieves' Tools"
  },
  {
   "id": "gaming-set-dice",
   "name": "Gaming Set (Dice)",
   "family": "gaming-set"
  },
  {
   "id": "gaming-set-dragonchess",
   "name": "Gaming Set (Dragonchess)",
   "family": "gaming-set"
  },
  {
   "id": "gaming-set-playing-cards",
   "name": "Gaming Set (Playing cards)",
   "family": "gaming-set"
  },
  {
   "id": "gaming-set-three-dragon-ante",
   "name": "Gaming Set (Three-dragon ante)",
   "family": "gaming-set"
  },
  {
   "id": "musical-instrument-bagpipes",
   "name": "Musical Instrument (Bagpipes)",
   "family": "musical-instrument"
  },
  {
   "id": "musical-instrument-drum",
   "name": "Musical Instrument (Drum)",
   "family": "musical-instrument"
  },
  {
   "id": "musical-instrument-dulcimer",
   "name": "Musical Instrument (Dulcimer)",
   "family": "musical-instrument"
  },
  {
   "id": "musical-instrument-flute",
   "name": "Musical Instrument (Flute)",
   "family": "musical-instrument"
  },
  {
   "id": "musical-instrument-horn",
   "name": "Musical Instrument (Horn)",
   "family": "musical-instrument"
  },
  {
   "id": "musical-instrument-lute",
   "name": "Musical Instrument (Lute)",
   "family": "musical-instrument"
  },
  {
   "id": "musical-instrument-lyre",
   "name": "Musical Instrument (Lyre)",
   "family": "musical-instrument"
  },
  {
   "id": "musical-instrument-pan-flute",
   "name": "Musical Instrument (Pan flute)",
   "family": "musical-instrument"
  },
  {
   "id": "musical-instrument-shawm",
   "name": "Musical Instrument (Shawm)",
   "family": "musical-instrument"
  },
  {
   "id": "musical-instrument-viol",
   "name": "Musical Instrument (Viol)",
   "family": "musical-instrument"
  }
 ],
 "weapons": {
  "club": {
   "id": "club",
   "name": "Club",
   "category": "simple",
   "kind": "melee",
   "damage": "1d4",
   "damageType": "Bludgeoning",
   "properties": [
    "Light"
   ],
   "finesse": false,
   "light": true,
   "mastery": "Slow"
  },
  "dagger": {
   "id": "dagger",
   "name": "Dagger",
   "category": "simple",
   "kind": "melee",
   "damage": "1d4",
   "damageType": "Piercing",
   "properties": [
    "Finesse",
    "Light",
    "Thrown (Range 20/60)"
   ],
   "finesse": true,
   "light": true,
   "mastery": "Nick"
  },
  "greatclub": {
   "id": "greatclub",
   "name": "Greatclub",
   "category": "simple",
   "kind": "melee",
   "damage": "1d8",
   "damageType": "Bludgeoning",
   "properties": [
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Push"
  },
  "handaxe": {
   "id": "handaxe",
   "name": "Handaxe",
   "category": "simple",
   "kind": "melee",
   "damage": "1d6",
   "damageType": "Slashing",
   "properties": [
    "Light",
    "Thrown (Range 20/60)"
   ],
   "finesse": false,
   "light": true,
   "mastery": "Vex"
  },
  "javelin": {
   "id": "javelin",
   "name": "Javelin",
   "category": "simple",
   "kind": "melee",
   "damage": "1d6",
   "damageType": "Piercing",
   "properties": [
    "Thrown (Range 30/120)"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Slow"
  },
  "light-hammer": {
   "id": "light-hammer",
   "name": "Light Hammer",
   "category": "simple",
   "kind": "melee",
   "damage": "1d4",
   "damageType": "Bludgeoning",
   "properties": [
    "Light",
    "Thrown (Range 20/60)"
   ],
   "finesse": false,
   "light": true,
   "mastery": "Nick"
  },
  "mace": {
   "id": "mace",
   "name": "Mace",
   "category": "simple",
   "kind": "melee",
   "damage": "1d6",
   "damageType": "Bludgeoning",
   "properties": [],
   "finesse": false,
   "light": false,
   "mastery": "Sap"
  },
  "quarterstaff": {
   "id": "quarterstaff",
   "name": "Quarterstaff",
   "category": "simple",
   "kind": "melee",
   "damage": "1d6",
   "damageType": "Bludgeoning",
   "properties": [
    "Versatile (1d8)"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Topple"
  },
  "sickle": {
   "id": "sickle",
   "name": "Sickle",
   "category": "simple",
   "kind": "melee",
   "damage": "1d4",
   "damageType": "Slashing",
   "properties": [
    "Light"
   ],
   "finesse": false,
   "light": true,
   "mastery": "Nick"
  },
  "spear": {
   "id": "spear",
   "name": "Spear",
   "category": "simple",
   "kind": "melee",
   "damage": "1d6",
   "damageType": "Piercing",
   "properties": [
    "Thrown (Range 20/60)",
    "Versatile (1d8)"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Sap"
  },
  "dart": {
   "id": "dart",
   "name": "Dart",
   "category": "simple",
   "kind": "ranged",
   "damage": "1d4",
   "damageType": "Piercing",
   "properties": [
    "Finesse",
    "Thrown (Range 20/60)"
   ],
   "finesse": true,
   "light": false,
   "mastery": "Vex"
  },
  "light-crossbow": {
   "id": "light-crossbow",
   "name": "Light Crossbow",
   "category": "simple",
   "kind": "ranged",
   "damage": "1d8",
   "damageType": "Piercing",
   "properties": [
    "Ammunition (Range 80/320; Bolt)",
    "Loading",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Slow"
  },
  "shortbow": {
   "id": "shortbow",
   "name": "Shortbow",
   "category": "simple",
   "kind": "ranged",
   "damage": "1d6",
   "damageType": "Piercing",
   "properties": [
    "Ammunition (Range 80/320; Arrow)",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Vex"
  },
  "sling": {
   "id": "sling",
   "name": "Sling",
   "category": "simple",
   "kind": "ranged",
   "damage": "1d4",
   "damageType": "Bludgeoning",
   "properties": [
    "Ammunition (Range 30/120; Bullet)"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Slow"
  },
  "battleaxe": {
   "id": "battleaxe",
   "name": "Battleaxe",
   "category": "martial",
   "kind": "melee",
   "damage": "1d8",
   "damageType": "Slashing",
   "properties": [
    "Versatile (1d10)"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Topple"
  },
  "flail": {
   "id": "flail",
   "name": "Flail",
   "category": "martial",
   "kind": "melee",
   "damage": "1d8",
   "damageType": "Bludgeoning",
   "properties": [],
   "finesse": false,
   "light": false,
   "mastery": "Sap"
  },
  "glaive": {
   "id": "glaive",
   "name": "Glaive",
   "category": "martial",
   "kind": "melee",
   "damage": "1d10",
   "damageType": "Slashing",
   "properties": [
    "Heavy",
    "Reach",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Graze"
  },
  "greataxe": {
   "id": "greataxe",
   "name": "Greataxe",
   "category": "martial",
   "kind": "melee",
   "damage": "1d12",
   "damageType": "Slashing",
   "properties": [
    "Heavy",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Cleave"
  },
  "greatsword": {
   "id": "greatsword",
   "name": "Greatsword",
   "category": "martial",
   "kind": "melee",
   "damage": "2d6",
   "damageType": "Slashing",
   "properties": [
    "Heavy",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Graze"
  },
  "halberd": {
   "id": "halberd",
   "name": "Halberd",
   "category": "martial",
   "kind": "melee",
   "damage": "1d10",
   "damageType": "Slashing",
   "properties": [
    "Heavy",
    "Reach",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Cleave"
  },
  "lance": {
   "id": "lance",
   "name": "Lance",
   "category": "martial",
   "kind": "melee",
   "damage": "1d10",
   "damageType": "Piercing",
   "properties": [
    "Heavy",
    "Reach",
    "Two-Handed (unless mounted)"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Topple"
  },
  "longsword": {
   "id": "longsword",
   "name": "Longsword",
   "category": "martial",
   "kind": "melee",
   "damage": "1d8",
   "damageType": "Slashing",
   "properties": [
    "Versatile (1d10)"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Sap"
  },
  "maul": {
   "id": "maul",
   "name": "Maul",
   "category": "martial",
   "kind": "melee",
   "damage": "2d6",
   "damageType": "Bludgeoning",
   "properties": [
    "Heavy",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Topple"
  },
  "morningstar": {
   "id": "morningstar",
   "name": "Morningstar",
   "category": "martial",
   "kind": "melee",
   "damage": "1d8",
   "damageType": "Piercing",
   "properties": [],
   "finesse": false,
   "light": false,
   "mastery": "Sap"
  },
  "pike": {
   "id": "pike",
   "name": "Pike",
   "category": "martial",
   "kind": "melee",
   "damage": "1d10",
   "damageType": "Piercing",
   "properties": [
    "Heavy",
    "Reach",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Push"
  },
  "rapier": {
   "id": "rapier",
   "name": "Rapier",
   "category": "martial",
   "kind": "melee",
   "damage": "1d8",
   "damageType": "Piercing",
   "properties": [
    "Finesse"
   ],
   "finesse": true,
   "light": false,
   "mastery": "Vex"
  },
  "scimitar": {
   "id": "scimitar",
   "name": "Scimitar",
   "category": "martial",
   "kind": "melee",
   "damage": "1d6",
   "damageType": "Slashing",
   "properties": [
    "Finesse",
    "Light"
   ],
   "finesse": true,
   "light": true,
   "mastery": "Nick"
  },
  "shortsword": {
   "id": "shortsword",
   "name": "Shortsword",
   "category": "martial",
   "kind": "melee",
   "damage": "1d6",
   "damageType": "Piercing",
   "properties": [
    "Finesse",
    "Light"
   ],
   "finesse": true,
   "light": true,
   "mastery": "Vex"
  },
  "trident": {
   "id": "trident",
   "name": "Trident",
   "category": "martial",
   "kind": "melee",
   "damage": "1d8",
   "damageType": "Piercing",
   "properties": [
    "Thrown (Range 20/60)",
    "Versatile (1d10)"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Topple"
  },
  "warhammer": {
   "id": "warhammer",
   "name": "Warhammer",
   "category": "martial",
   "kind": "melee",
   "damage": "1d8",
   "damageType": "Bludgeoning",
   "properties": [
    "Versatile (1d10)"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Push"
  },
  "war-pick": {
   "id": "war-pick",
   "name": "War Pick",
   "category": "martial",
   "kind": "melee",
   "damage": "1d8",
   "damageType": "Piercing",
   "properties": [
    "Versatile (1d10)"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Sap"
  },
  "whip": {
   "id": "whip",
   "name": "Whip",
   "category": "martial",
   "kind": "melee",
   "damage": "1d4",
   "damageType": "Slashing",
   "properties": [
    "Finesse",
    "Reach"
   ],
   "finesse": true,
   "light": false,
   "mastery": "Slow"
  },
  "blowgun": {
   "id": "blowgun",
   "name": "Blowgun",
   "category": "martial",
   "kind": "ranged",
   "damage": "1",
   "damageType": "Piercing",
   "properties": [
    "Ammunition (Range 25/100; Needle)",
    "Loading"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Vex"
  },
  "hand-crossbow": {
   "id": "hand-crossbow",
   "name": "Hand Crossbow",
   "category": "martial",
   "kind": "ranged",
   "damage": "1d6",
   "damageType": "Piercing",
   "properties": [
    "Ammunition (Range 30/120; Bolt)",
    "Light",
    "Loading"
   ],
   "finesse": false,
   "light": true,
   "mastery": "Vex"
  },
  "heavy-crossbow": {
   "id": "heavy-crossbow",
   "name": "Heavy Crossbow",
   "category": "martial",
   "kind": "ranged",
   "damage": "1d10",
   "damageType": "Piercing",
   "properties": [
    "Ammunition (Range 100/400; Bolt)",
    "Heavy",
    "Loading",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Push"
  },
  "longbow": {
   "id": "longbow",
   "name": "Longbow",
   "category": "martial",
   "kind": "ranged",
   "damage": "1d8",
   "damageType": "Piercing",
   "properties": [
    "Ammunition (Range 150/600; Arrow)",
    "Heavy",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Slow"
  },
  "musket": {
   "id": "musket",
   "name": "Musket",
   "category": "martial",
   "kind": "ranged",
   "damage": "1d12",
   "damageType": "Piercing",
   "properties": [
    "Ammunition (Range 40/120; Bullet)",
    "Loading",
    "Two-Handed"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Slow"
  },
  "pistol": {
   "id": "pistol",
   "name": "Pistol",
   "category": "martial",
   "kind": "ranged",
   "damage": "1d10",
   "damageType": "Piercing",
   "properties": [
    "Ammunition (Range 30/90; Bullet)",
    "Loading"
   ],
   "finesse": false,
   "light": false,
   "mastery": "Vex"
  }
 },
 "armor": {
  "padded-armor": {
   "id": "padded-armor",
   "name": "Padded Armor",
   "category": "light",
   "baseAC": 11,
   "addDex": true,
   "maxDex": null,
   "strength": null,
   "stealthDisadvantage": true
  },
  "leather-armor": {
   "id": "leather-armor",
   "name": "Leather Armor",
   "category": "light",
   "baseAC": 11,
   "addDex": true,
   "maxDex": null,
   "strength": null,
   "stealthDisadvantage": false
  },
  "studded-leather-armor": {
   "id": "studded-leather-armor",
   "name": "Studded Leather Armor",
   "category": "light",
   "baseAC": 12,
   "addDex": true,
   "maxDex": null,
   "strength": null,
   "stealthDisadvantage": false
  },
  "hide-armor": {
   "id": "hide-armor",
   "name": "Hide Armor",
   "category": "medium",
   "baseAC": 12,
   "addDex": true,
   "maxDex": 2,
   "strength": null,
   "stealthDisadvantage": false
  },
  "chain-shirt": {
   "id": "chain-shirt",
   "name": "Chain Shirt",
   "category": "medium",
   "baseAC": 13,
   "addDex": true,
   "maxDex": 2,
   "strength": null,
   "stealthDisadvantage": false
  },
  "scale-mail": {
   "id": "scale-mail",
   "name": "Scale Mail",
   "category": "medium",
   "baseAC": 14,
   "addDex": true,
   "maxDex": 2,
   "strength": null,
   "stealthDisadvantage": true
  },
  "breastplate": {
   "id": "breastplate",
   "name": "Breastplate",
   "category": "medium",
   "baseAC": 14,
   "addDex": true,
   "maxDex": 2,
   "strength": null,
   "stealthDisadvantage": false
  },
  "half-plate-armor": {
   "id": "half-plate-armor",
   "name": "Half Plate Armor",
   "category": "medium",
   "baseAC": 15,
   "addDex": true,
   "maxDex": 2,
   "strength": null,
   "stealthDisadvantage": true
  },
  "ring-mail": {
   "id": "ring-mail",
   "name": "Ring Mail",
   "category": "heavy",
   "baseAC": 14,
   "addDex": false,
   "maxDex": null,
   "strength": null,
   "stealthDisadvantage": true
  },
  "chain-mail": {
   "id": "chain-mail",
   "name": "Chain Mail",
   "category": "heavy",
   "baseAC": 16,
   "addDex": false,
   "maxDex": null,
   "strength": 13,
   "stealthDisadvantage": true
  },
  "splint-armor": {
   "id": "splint-armor",
   "name": "Splint Armor",
   "category": "heavy",
   "baseAC": 17,
   "addDex": false,
   "maxDex": null,
   "strength": 15,
   "stealthDisadvantage": true
  },
  "plate-armor": {
   "id": "plate-armor",
   "name": "Plate Armor",
   "category": "heavy",
   "baseAC": 18,
   "addDex": false,
   "maxDex": null,
   "strength": 15,
   "stealthDisadvantage": true
  },
  "shield": {
   "id": "shield",
   "name": "Shield",
   "category": "shield",
   "acBonus": 2
  }
 },
 "masteryProperties": {
  "Cleave": "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn.",
  "Graze": "If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.",
  "Nick": "When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.",
  "Push": "If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.",
  "Sap": "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  "Slow": "If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn't exceed 10 feet.",
  "Topple": "If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.",
  "Vex": "If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn."
 },
 "weaponRules": {
  "properties": {
   "Ammunition": "You can use a weapon that has the Ammunition property to make a ranged attack only if you have ammunition to fire from it. The type of ammunition required is specified with the weapon's range. Each attack expends one piece of ammunition. Drawing the ammunition is part of the attack (you need a free hand to load a one-handed weapon). After a fight, you can spend 1 minute to recover half the ammunition (round down) you used in the fight; the rest is lost.",
   "Finesse": "When making an attack with a Finesse weapon, use your choice of your Strength or Dexterity modifier for the attack and damage rolls. You must use the same modifier for both rolls.",
   "Heavy": "You have Disadvantage on attack rolls with a Heavy weapon if it's a Melee weapon and your Strength score isn't at least 13 or if it's a Ranged weapon and your Dexterity score isn't at least 13.",
   "Light": "When you take the Attack action on your turn and attack with a Light weapon, you can make one extra attack as a Bonus Action later on the same turn. That extra attack must be made with a different Light weapon, and you don't add your ability modifier to the extra attack's damage unless that modifier is negative. For example, you can attack with a Shortsword in one hand and a Dagger in the other using the Attack action and a Bonus Action, but you don't add your Strength or Dexterity modifier to the damage roll of the Bonus Action unless that modifier is negative.",
   "Loading": "You can fire only one piece of ammunition from a Loading weapon when you use an action, a Bonus Action, or a Reaction to fire it, regardless of the number of attacks you can normally make.",
   "Range": "A Range weapon has a range in parentheses after the Ammunition or Thrown property. The range lists two numbers. The first is the weapon's normal range in feet, and the second is the weapon's long range. When attacking a target beyond normal range, you have Disadvantage on the attack roll. You can't attack a target beyond the long range.",
   "Reach": "A Reach weapon adds 5 feet to your reach when you attack with it, as well as when determining your reach for Opportunity Attacks with it.",
   "Thrown": "If a weapon has the Thrown property, you can throw the weapon to make a ranged attack, and you can draw that weapon as part of the attack. If the weapon is a Melee weapon, use the same ability modifier for the attack and damage rolls that you use for a melee attack with that weapon.",
   "Two-Handed": "A Two-Handed weapon requires two hands when you attack with it.",
   "Versatile": "A Versatile weapon can be used with one or two hands. A damage value in parentheses appears with the property. The weapon deals that damage when used with two hands to make a melee attack."
  },
  "proficiency": "Anyone can wield a weapon, but you must have proficiency with it to add your Proficiency Bonus to an attack roll you make with it. A player character's features can provide weapon proficiencies. A monster is proficient with any weapon in its stat block."
 },
 "feats": {
  "alert": {
   "id": "alert",
   "name": "Alert",
   "category": "origin",
   "prerequisite": null,
   "minLevel": null,
   "repeatable": false,
   "description": "You gain the following benefits.\n\n_Initiative Proficiency._ When you roll Initiative, you can add your Proficiency Bonus to the roll.\n\n_Initiative Swap._ Immediately after you roll Initiative, you can swap your Initiative with the Initiative of one willing ally in the same combat. You can't make this swap if you or the ally has the Incapacitated condition.",
   "abilityIncrease": null
  },
  "magic-initiate": {
   "id": "magic-initiate",
   "name": "Magic Initiate",
   "category": "origin",
   "prerequisite": null,
   "minLevel": null,
   "repeatable": true,
   "description": "You gain the following benefits.\n\n_Two Cantrips._ You learn two cantrips of your choice from the Cleric, Druid, or Wizard spell list. Intelligence, Wisdom, or Charisma is your spellcasting ability for this feat's spells (choose when you select this feat).\n\n_Level 1 Spell._ Choose a level 1 spell from the same list you selected for this feat's cantrips. You always have that spell prepared. You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a Long Rest. You can also cast the spell using any spell slots you have.\n\n_Spell Change._ Whenever you gain a new level, you can replace one of the spells you chose for this feat with a different spell of the same level from the chosen spell list.\n\n_Repeatable._ You can take this feat more than once, but you must choose a different spell list each time.",
   "abilityIncrease": null
  },
  "savage-attacker": {
   "id": "savage-attacker",
   "name": "Savage Attacker",
   "category": "origin",
   "prerequisite": null,
   "minLevel": null,
   "repeatable": false,
   "description": "You've trained to deal particularly damaging strikes. Once per turn when you hit a target with a weapon, you can roll the weapon's damage dice twice and use either roll against the target.",
   "abilityIncrease": null
  },
  "skilled": {
   "id": "skilled",
   "name": "Skilled",
   "category": "origin",
   "prerequisite": null,
   "minLevel": null,
   "repeatable": true,
   "description": "You gain proficiency in any combination of three skills or tools of your choice.\n\n_Repeatable._ You can take this feat more than once.",
   "abilityIncrease": null
  },
  "ability-score-improvement": {
   "id": "ability-score-improvement",
   "name": "Ability Score Improvement",
   "category": "general",
   "prerequisite": "Level 4+",
   "minLevel": 4,
   "repeatable": true,
   "description": "Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1. This feat can't increase an ability score above 20.\n\n_Repeatable._ You can take this feat more than once.",
   "abilityIncrease": null
  },
  "grappler": {
   "id": "grappler",
   "name": "Grappler",
   "category": "general",
   "prerequisite": "Level 4+, Strength or Dexterity 13+",
   "minLevel": 4,
   "repeatable": false,
   "description": "You gain the following benefits.\n\n_Ability Score Increase._ Increase your Strength or Dexterity score by 1, to a maximum of 20.\n\n_Punch and Grab._ When you hit a creature with an Unarmed Strike as part of the Attack action on your turn, you can use both the Damage and the Grapple option. You can use this benefit only once per turn.\n\n_Attack Advantage._ You have Advantage on attack rolls against a creature Grappled by you.\n\n_Fast Wrestler._ You don't have to spend extra movement to move a creature Grappled by you if the creature is your size or smaller.",
   "abilityIncrease": {
    "amount": 1,
    "from": [
     "str",
     "dex"
    ],
    "max": 20
   }
  },
  "archery": {
   "id": "archery",
   "name": "Archery",
   "category": "fighting-style",
   "prerequisite": "Fighting Style Feature",
   "minLevel": null,
   "repeatable": false,
   "description": "You gain a +2 bonus to attack rolls you make with Ranged weapons.",
   "abilityIncrease": null
  },
  "defense": {
   "id": "defense",
   "name": "Defense",
   "category": "fighting-style",
   "prerequisite": "Fighting Style Feature",
   "minLevel": null,
   "repeatable": false,
   "description": "While you're wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class.",
   "abilityIncrease": null
  },
  "great-weapon-fighting": {
   "id": "great-weapon-fighting",
   "name": "Great Weapon Fighting",
   "category": "fighting-style",
   "prerequisite": "Fighting Style Feature",
   "minLevel": null,
   "repeatable": false,
   "description": "When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.",
   "abilityIncrease": null
  },
  "two-weapon-fighting": {
   "id": "two-weapon-fighting",
   "name": "Two-Weapon Fighting",
   "category": "fighting-style",
   "prerequisite": "Fighting Style Feature",
   "minLevel": null,
   "repeatable": false,
   "description": "When you make an extra attack as a result of using a weapon that has the Light property, you can add your ability modifier to the damage of that attack if you aren't already adding it to the damage.",
   "abilityIncrease": null
  },
  "boon-of-combat-prowess": {
   "id": "boon-of-combat-prowess",
   "name": "Boon of Combat Prowess",
   "category": "epic-boon",
   "prerequisite": "Level 19+",
   "minLevel": 19,
   "repeatable": false,
   "description": "You gain the following benefits.\n\n_Ability Score Increase._ Increase one ability score of your choice by 1, to a maximum of 30.\n\n_Peerless Aim._ When you miss with an attack roll, you can hit instead. Once you use this benefit, you can't use it again until the start of your next turn.",
   "abilityIncrease": {
    "amount": 1,
    "from": [
     "str",
     "dex",
     "con",
     "int",
     "wis",
     "cha"
    ],
    "max": 30
   }
  },
  "boon-of-dimensional-travel": {
   "id": "boon-of-dimensional-travel",
   "name": "Boon of Dimensional Travel",
   "category": "epic-boon",
   "prerequisite": "Level 19+",
   "minLevel": 19,
   "repeatable": false,
   "description": "You gain the following benefits.\n\n_Ability Score Increase._ Increase one ability score of your choice by 1, to a maximum of 30.\n\n_Blink Steps._ Immediately after you take the Attack action or the Magic action, you can teleport up to 30 feet to an unoccupied space you can see.",
   "abilityIncrease": {
    "amount": 1,
    "from": [
     "str",
     "dex",
     "con",
     "int",
     "wis",
     "cha"
    ],
    "max": 30
   }
  },
  "boon-of-fate": {
   "id": "boon-of-fate",
   "name": "Boon of Fate",
   "category": "epic-boon",
   "prerequisite": "Level 19+",
   "minLevel": 19,
   "repeatable": false,
   "description": "You gain the following benefits.\n\n_Ability Score Increase._ Increase one ability score of your choice by 1, to a maximum of 30.\n\n_Improve Fate._ When you or another creature within 60 feet of you succeeds on or fails a D20 Test, you can roll 2d4 and apply the total rolled as a bonus or penalty to the d20 roll. Once you use this benefit, you can't use it again until you roll Initiative or finish a Short or Long Rest.",
   "abilityIncrease": {
    "amount": 1,
    "from": [
     "str",
     "dex",
     "con",
     "int",
     "wis",
     "cha"
    ],
    "max": 30
   }
  },
  "boon-of-irresistible-offense": {
   "id": "boon-of-irresistible-offense",
   "name": "Boon of Irresistible Offense",
   "category": "epic-boon",
   "prerequisite": "Level 19+",
   "minLevel": 19,
   "repeatable": false,
   "description": "You gain the following benefits.\n\n_Ability Score Increase._ Increase your Strength or Dexterity score by 1, to a maximum of 30.\n\n_Overcome Defenses._ The Bludgeoning, Piercing, and Slashing damage you deal always ignores Resistance.\n\n_Overwhelming Strike._ When you roll a 20 on the d20 for an attack roll, you can deal extra damage to the target equal to the ability score increased by this feat. The extra damage's type is the same as the attack's type.",
   "abilityIncrease": {
    "amount": 1,
    "from": [
     "str",
     "dex"
    ],
    "max": 30
   }
  },
  "boon-of-spell-recall": {
   "id": "boon-of-spell-recall",
   "name": "Boon of Spell Recall",
   "category": "epic-boon",
   "prerequisite": "Level 19+, Spellcasting Feature",
   "minLevel": 19,
   "repeatable": false,
   "description": "You gain the following benefits.\n\n_Ability Score Increase._ Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 30.\n\n_Free Casting._ Whenever you cast a spell with a level 1–4 spell slot, roll 1d4. If the number you roll is the same as the slot's level, the slot isn't expended.",
   "abilityIncrease": {
    "amount": 1,
    "from": [
     "int",
     "wis",
     "cha"
    ],
    "max": 30
   }
  },
  "boon-of-the-night-spirit": {
   "id": "boon-of-the-night-spirit",
   "name": "Boon of the Night Spirit",
   "category": "epic-boon",
   "prerequisite": "Level 19+",
   "minLevel": 19,
   "repeatable": false,
   "description": "You gain the following benefits.\n\n_Ability Score Increase._ Increase one ability score of your choice by 1, to a maximum of 30.\n\n_Merge with Shadows._ While within Dim Light or Darkness, you can give yourself the Invisible condition as a Bonus Action. The condition ends on you immediately after you take an action, a Bonus Action, or a Reaction.\n\n_Shadowy Form._ While within Dim Light or Darkness, you have Resistance to all damage except Psychic and Radiant.",
   "abilityIncrease": {
    "amount": 1,
    "from": [
     "str",
     "dex",
     "con",
     "int",
     "wis",
     "cha"
    ],
    "max": 30
   }
  },
  "boon-of-truesight": {
   "id": "boon-of-truesight",
   "name": "Boon of Truesight",
   "category": "epic-boon",
   "prerequisite": "Level 19+",
   "minLevel": 19,
   "repeatable": false,
   "description": "You gain the following benefits.\n\n_Ability Score Increase._ Increase one ability score of your choice by 1, to a maximum of 30.\n\n_Truesight._ You have Truesight with a range of 60 feet.",
   "abilityIncrease": {
    "amount": 1,
    "from": [
     "str",
     "dex",
     "con",
     "int",
     "wis",
     "cha"
    ],
    "max": 30
   }
  }
 },
 "backgrounds": {
  "acolyte": {
   "id": "acolyte",
   "name": "Acolyte",
   "abilities": [
    "int",
    "wis",
    "cha"
   ],
   "feat": {
    "id": "magic-initiate",
    "spellList": "cleric"
   },
   "skills": [
    "insight",
    "religion"
   ],
   "tool": {
    "name": "Calligrapher's Supplies"
   },
   "equipmentText": "(A) Calligrapher's Supplies, Book (prayers), Holy Symbol, Parchment (10 sheets), Robe, 8 GP; or (B) 50 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Calligrapher's Supplies",
       "count": 1
      },
      {
       "name": "Book (prayers)",
       "count": 1
      },
      {
       "name": "Holy Symbol",
       "count": 1
      },
      {
       "name": "Parchment (10 sheets)",
       "count": 1
      },
      {
       "name": "Robe",
       "count": 1
      }
     ],
     "gp": 8
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 50
    }
   ]
  },
  "criminal": {
   "id": "criminal",
   "name": "Criminal",
   "abilities": [
    "dex",
    "con",
    "int"
   ],
   "feat": {
    "id": "alert",
    "spellList": null
   },
   "skills": [
    "sleight-of-hand",
    "stealth"
   ],
   "tool": {
    "name": "Thieves' Tools"
   },
   "equipmentText": "(A) 2 Daggers, Thieves' Tools, Crowbar, 2 Pouches, Traveler's Clothes, 16 GP; or (B) 50 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Daggers",
       "count": 2,
       "weaponId": "dagger"
      },
      {
       "name": "Thieves' Tools",
       "count": 1
      },
      {
       "name": "Crowbar",
       "count": 1
      },
      {
       "name": "Pouches",
       "count": 2
      },
      {
       "name": "Traveler's Clothes",
       "count": 1
      }
     ],
     "gp": 16
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 50
    }
   ]
  },
  "sage": {
   "id": "sage",
   "name": "Sage",
   "abilities": [
    "con",
    "int",
    "wis"
   ],
   "feat": {
    "id": "magic-initiate",
    "spellList": "wizard"
   },
   "skills": [
    "arcana",
    "history"
   ],
   "tool": {
    "name": "Calligrapher's Supplies"
   },
   "equipmentText": "(A) Quarterstaff, Calligrapher's Supplies, Book (history), Parchment (8 sheets), Robe, 8 GP; or (B) 50 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Quarterstaff",
       "count": 1,
       "weaponId": "quarterstaff"
      },
      {
       "name": "Calligrapher's Supplies",
       "count": 1
      },
      {
       "name": "Book (history)",
       "count": 1
      },
      {
       "name": "Parchment (8 sheets)",
       "count": 1
      },
      {
       "name": "Robe",
       "count": 1
      }
     ],
     "gp": 8
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 50
    }
   ]
  },
  "soldier": {
   "id": "soldier",
   "name": "Soldier",
   "abilities": [
    "str",
    "dex",
    "con"
   ],
   "feat": {
    "id": "savage-attacker",
    "spellList": null
   },
   "skills": [
    "athletics",
    "intimidation"
   ],
   "tool": {
    "choose": "gaming-set",
    "text": "Choose one kind of Gaming Set (see \"Equipment\")"
   },
   "equipmentText": "(A) Spear, Shortbow, 20 Arrows, Gaming Set (same as above), Healer's Kit, Quiver, Traveler's Clothes, 14 GP; or (B) 50 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Spear",
       "count": 1,
       "weaponId": "spear"
      },
      {
       "name": "Shortbow",
       "count": 1,
       "weaponId": "shortbow"
      },
      {
       "name": "Arrows",
       "count": 20
      },
      {
       "name": "Gaming Set (same as above)",
       "count": 1
      },
      {
       "name": "Healer's Kit",
       "count": 1
      },
      {
       "name": "Quiver",
       "count": 1
      },
      {
       "name": "Traveler's Clothes",
       "count": 1
      }
     ],
     "gp": 14
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 50
    }
   ]
  },
  "intro": "A background includes the following parts.\n\n#### Ability Scores\n\nA background lists three of your character's ability scores. Increase one by 2 and another one by 1, or increase all three by 1. None of these increases can raise a score above 20.\n\n#### Feat\n\nA background gives your character a specified Origin feat (described in \"Feats\").\n\n#### Skill Proficiencies\n\nA background gives your character proficiency in two specified skills.\n\n#### Tool Proficiency\n\nEach background gives a character proficiency with one tool—either a specific tool or one chosen from the Artisan's Tools category. Tools are detailed in \"Equipment.\"\n\n#### Equipment\n\nEach background offers a choice between a package of equipment and 50 GP."
 },
 "species": {
  "dragonborn": {
   "id": "dragonborn",
   "name": "Dragonborn",
   "creatureType": "Humanoid",
   "sizeText": "Medium (about 5–7 feet tall)",
   "sizeOptions": [
    "Medium"
   ],
   "speed": 30,
   "traits": [
    {
     "name": "Draconic Ancestry",
     "description": "Your lineage stems from a dragon progenitor. Choose the kind of dragon from the Draconic Ancestors table. Your choice affects your Breath Weapon and Damage Resistance traits as well as your appearance."
    },
    {
     "name": "Breath Weapon",
     "description": "When you take the Attack action on your turn, you can replace one of your attacks with an exhalation of magical energy in either a 15-foot Cone or a 30-foot Line that is 5 feet wide (choose the shape each time). Each creature in that area must make a Dexterity saving throw (DC 8 plus your Constitution modifier and Proficiency Bonus). On a failed save, a creature takes 1d10 damage of the type determined by your Draconic Ancestry trait. On a successful save, a creature takes half as much damage. This damage increases by 1d10 when you reach character levels 5 (2d10), 11 (3d10), and 17 (4d10).\nYou can use this Breath Weapon a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest."
    },
    {
     "name": "Damage Resistance",
     "description": "You have Resistance to the damage type determined by your Draconic Ancestry trait."
    },
    {
     "name": "Darkvision",
     "description": "You have Darkvision with a range of 60 feet."
    },
    {
     "name": "Draconic Flight",
     "description": "When you reach character level 5, you can channel draconic magic to give yourself temporary flight. As a Bonus Action, you sprout spectral wings on your back that last for 10 minutes or until you retract the wings (no action required) or have the Incapacitated condition. During that time, you have a Fly Speed equal to your Speed. Your wings appear to be made of the same energy as your Breath Weapon. Once you use this trait, you can't use it again until you finish a Long Rest."
    }
   ],
   "choices": [
    {
     "id": "ancestry",
     "label": "Draconic Ancestor",
     "required": true,
     "options": [
      {
       "id": "black",
       "name": "Black Dragon",
       "damageType": "Acid",
       "description": "Breath Weapon and Damage Resistance use Acid damage."
      },
      {
       "id": "gold",
       "name": "Gold Dragon",
       "damageType": "Fire",
       "description": "Breath Weapon and Damage Resistance use Fire damage."
      },
      {
       "id": "blue",
       "name": "Blue Dragon",
       "damageType": "Lightning",
       "description": "Breath Weapon and Damage Resistance use Lightning damage."
      },
      {
       "id": "green",
       "name": "Green Dragon",
       "damageType": "Poison",
       "description": "Breath Weapon and Damage Resistance use Poison damage."
      },
      {
       "id": "brass",
       "name": "Brass Dragon",
       "damageType": "Fire",
       "description": "Breath Weapon and Damage Resistance use Fire damage."
      },
      {
       "id": "red",
       "name": "Red Dragon",
       "damageType": "Fire",
       "description": "Breath Weapon and Damage Resistance use Fire damage."
      },
      {
       "id": "bronze",
       "name": "Bronze Dragon",
       "damageType": "Lightning",
       "description": "Breath Weapon and Damage Resistance use Lightning damage."
      },
      {
       "id": "silver",
       "name": "Silver Dragon",
       "damageType": "Cold",
       "description": "Breath Weapon and Damage Resistance use Cold damage."
      },
      {
       "id": "copper",
       "name": "Copper Dragon",
       "damageType": "Acid",
       "description": "Breath Weapon and Damage Resistance use Acid damage."
      },
      {
       "id": "white",
       "name": "White Dragon",
       "damageType": "Cold",
       "description": "Breath Weapon and Damage Resistance use Cold damage."
      }
     ]
    }
   ],
   "darkvision": 60
  },
  "dwarf": {
   "id": "dwarf",
   "name": "Dwarf",
   "creatureType": "Humanoid",
   "sizeText": "Medium (about 4–5 feet tall)",
   "sizeOptions": [
    "Medium"
   ],
   "speed": 30,
   "traits": [
    {
     "name": "Darkvision",
     "description": "You have Darkvision with a range of 120 feet."
    },
    {
     "name": "Dwarven Resilience",
     "description": "You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition."
    },
    {
     "name": "Dwarven Toughness",
     "description": "Your Hit Point maximum increases by 1, and it increases by 1 again whenever you gain a level."
    },
    {
     "name": "Stonecunning",
     "description": "As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes. You must be on a stone surface or touching a stone surface to use this Tremorsense. The stone can be natural or worked.\nYou can use this Bonus Action a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest."
    }
   ],
   "choices": [],
   "hpPerLevel": 1,
   "darkvision": 120
  },
  "elf": {
   "id": "elf",
   "name": "Elf",
   "creatureType": "Humanoid",
   "sizeText": "Medium (about 5–6 feet tall)",
   "sizeOptions": [
    "Medium"
   ],
   "speed": 30,
   "traits": [
    {
     "name": "Darkvision",
     "description": "You have Darkvision with a range of 60 feet."
    },
    {
     "name": "Elven Lineage",
     "description": "You are part of a lineage that grants you supernatural abilities. Choose a lineage from the Elven Lineages table. You gain the level 1 benefit of that lineage.\nWhen you reach character levels 3 and 5, you learn a higher-level spell, as shown on the table. You always have that spell prepared. You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a Long Rest. You can also cast the spell using any spell slots you have of the appropriate level.\nIntelligence, Wisdom, or Charisma is your spellcasting ability for the spells you cast with this trait (choose the ability when you select the lineage)."
    },
    {
     "name": "Fey Ancestry",
     "description": "You have Advantage on saving throws you make to avoid or end the Charmed condition."
    },
    {
     "name": "Keen Senses",
     "description": "You have proficiency in the Insight, Perception, or Survival skill."
    },
    {
     "name": "Trance",
     "description": "You don't need to sleep, and magic can't put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness."
    }
   ],
   "choices": [
    {
     "id": "lineage",
     "label": "Elven Lineage",
     "required": true,
     "options": [
      {
       "id": "drow",
       "name": "Drow",
       "level1": "The range of your Darkvision increases to 120 feet. You also know the Dancing Lights cantrip.",
       "spells": {
        "3": "faerie-fire",
        "5": "darkness"
       },
       "cantrip": "dancing-lights",
       "description": "The range of your Darkvision increases to 120 feet. You also know the Dancing Lights cantrip."
      },
      {
       "id": "high-elf",
       "name": "High Elf",
       "level1": "You know the Prestidigitation cantrip. Whenever you finish a Long Rest, you can replace that cantrip with a different cantrip from the Wizard spell list.",
       "spells": {
        "3": "detect-magic",
        "5": "misty-step"
       },
       "cantrip": "prestidigitation",
       "description": "You know the Prestidigitation cantrip. Whenever you finish a Long Rest, you can replace that cantrip with a different cantrip from the Wizard spell list."
      },
      {
       "id": "wood-elf",
       "name": "Wood Elf",
       "level1": "Your Speed increases to 35 feet. You also know the Druidcraft cantrip.",
       "spells": {
        "3": "longstrider",
        "5": "pass-without-trace"
       },
       "cantrip": "druidcraft",
       "description": "Your Speed increases to 35 feet. You also know the Druidcraft cantrip."
      }
     ]
    },
    {
     "id": "spellAbility",
     "label": "Lineage spellcasting ability",
     "required": true,
     "abilities": [
      "int",
      "wis",
      "cha"
     ]
    },
    {
     "id": "skill",
     "label": "Keen Senses skill",
     "required": true,
     "skills": [
      "insight",
      "perception",
      "survival"
     ]
    }
   ],
   "darkvision": 60
  },
  "gnome": {
   "id": "gnome",
   "name": "Gnome",
   "creatureType": "Humanoid",
   "sizeText": "Small (about 3–4 feet tall)",
   "sizeOptions": [
    "Small"
   ],
   "speed": 30,
   "traits": [
    {
     "name": "Darkvision",
     "description": "You have Darkvision with a range of 60 feet."
    },
    {
     "name": "Gnomish Cunning",
     "description": "You have Advantage on Intelligence, Wisdom, and Charisma saving throws."
    },
    {
     "name": "Gnomish Lineage",
     "description": "You are part of a lineage that grants you supernatural abilities. Choose one of the following options; whichever one you choose, Intelligence, Wisdom, or Charisma is your spellcasting ability for the spells you cast with this trait (choose the ability when you select the lineage):\n**Forest Gnome.** You know the _Minor Illusion_ cantrip. You also always have the _Speak with Animals_ spell prepared. You can cast it without a spell slot a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. You can also use any spell slots you have to cast the spell.\n**Rock Gnome.** You know the _Mending_ and _Prestidigitation_ cantrips. In addition, you can spend 10 minutes casting _Prestidigitation_ to create a Tiny clockwork device (AC 5, 1 HP), such as a toy, fire starter, or music box. When you create the device, you determine its function by choosing one effect from _Prestidigitation_; the device produces that effect whenever you or another creature takes a Bonus Action to activate it with a touch. If the chosen effect has options within it, you choose one of those options for the device when you create it. For example, if you choose the spell's ignite-extinguish effect, you determine whether the device ignites or extinguishes fire; the device doesn't do both. You can have three such devices in existence at a time, and each falls apart 8 hours after its creation or when you dismantle it with a touch as a Utilize action."
    }
   ],
   "choices": [
    {
     "id": "lineage",
     "label": "Gnomish Lineage",
     "required": true,
     "options": [
      {
       "id": "forest-gnome",
       "name": "Forest Gnome",
       "description": "You know the _Minor Illusion_ cantrip. You also always have the _Speak with Animals_ spell prepared. You can cast it without a spell slot a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. You can also use any spell slots you have to cast the spell.",
       "cantrips": [
        "minor-illusion"
       ]
      },
      {
       "id": "rock-gnome",
       "name": "Rock Gnome",
       "description": "You know the _Mending_ and _Prestidigitation_ cantrips. In addition, you can spend 10 minutes casting _Prestidigitation_ to create a Tiny clockwork device (AC 5, 1 HP), such as a toy, fire starter, or music box. When you create the device, you determine its function by choosing one effect from _Prestidigitation_; the device produces that effect whenever you or another creature takes a Bonus Action to activate it with a touch. If the chosen effect has options within it, you choose one of those options for the device when you create it. For example, if you choose the spell's ignite-extinguish effect, you determine whether the device ignites or extinguishes fire; the device doesn't do both. You can have three such devices in existence at a time, and each falls apart 8 hours after its creation or when you dismantle it with a touch as a Utilize action.",
       "cantrips": [
        "mending",
        "prestidigitation"
       ]
      }
     ]
    },
    {
     "id": "spellAbility",
     "label": "Lineage spellcasting ability",
     "required": true,
     "abilities": [
      "int",
      "wis",
      "cha"
     ]
    }
   ],
   "darkvision": 60
  },
  "goliath": {
   "id": "goliath",
   "name": "Goliath",
   "creatureType": "Humanoid",
   "sizeText": "Medium (about 7–8 feet tall)",
   "sizeOptions": [
    "Medium"
   ],
   "speed": 35,
   "traits": [
    {
     "name": "Giant Ancestry",
     "description": "You are descended from Giants. Choose one of the following benefits—a supernatural boon from your ancestry; you can use the chosen benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest:\n**Cloud's Jaunt (Cloud Giant).** As a Bonus Action, you magically teleport up to 30 feet to an unoccupied space you can see.\n**Fire's Burn (Fire Giant).** When you hit a target with an attack roll and deal damage to it, you can also deal 1d10 Fire damage to that target.\n**Frost's Chill (Frost Giant).** When you hit a target with an attack roll and deal damage to it, you can also deal 1d6 Cold damage to that target and reduce its Speed by 10 feet until the start of your next turn.\n**Hill's Tumble (Hill Giant).** When you hit a Large or smaller creature with an attack roll and deal damage to it, you can give that target the Prone condition.\n**Stone's Endurance (Stone Giant).** When you take damage, you can take a Reaction to roll 1d12. Add your Constitution modifier to the number rolled and reduce the damage by that total.\n**Storm's Thunder (Storm Giant).** When you take damage from a creature within 60 feet of you, you can take a Reaction to deal 1d8 Thunder damage to that creature."
    },
    {
     "name": "Large Form",
     "description": "Starting at character level 5, you can change your size to Large as a Bonus Action if you're in a big enough space. This transformation lasts for 10 minutes or until you end it (no action required). For that duration, you have Advantage on Strength checks, and your Speed increases by 10 feet. Once you use this trait, you can't use it again until you finish a Long Rest."
    },
    {
     "name": "Powerful Build",
     "description": "You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity."
    }
   ],
   "choices": [
    {
     "id": "ancestry",
     "label": "Giant Ancestry",
     "required": true,
     "options": [
      {
       "id": "clouds-jaunt",
       "name": "Cloud's Jaunt (Cloud Giant)",
       "description": "As a Bonus Action, you magically teleport up to 30 feet to an unoccupied space you can see."
      },
      {
       "id": "fires-burn",
       "name": "Fire's Burn (Fire Giant)",
       "description": "When you hit a target with an attack roll and deal damage to it, you can also deal 1d10 Fire damage to that target."
      },
      {
       "id": "frosts-chill",
       "name": "Frost's Chill (Frost Giant)",
       "description": "When you hit a target with an attack roll and deal damage to it, you can also deal 1d6 Cold damage to that target and reduce its Speed by 10 feet until the start of your next turn."
      },
      {
       "id": "hills-tumble",
       "name": "Hill's Tumble (Hill Giant)",
       "description": "When you hit a Large or smaller creature with an attack roll and deal damage to it, you can give that target the Prone condition."
      },
      {
       "id": "stones-endurance",
       "name": "Stone's Endurance (Stone Giant)",
       "description": "When you take damage, you can take a Reaction to roll 1d12. Add your Constitution modifier to the number rolled and reduce the damage by that total."
      },
      {
       "id": "storms-thunder",
       "name": "Storm's Thunder (Storm Giant)",
       "description": "When you take damage from a creature within 60 feet of you, you can take a Reaction to deal 1d8 Thunder damage to that creature."
      }
     ]
    }
   ]
  },
  "halfling": {
   "id": "halfling",
   "name": "Halfling",
   "creatureType": "Humanoid",
   "sizeText": "Small (about 2–3 feet tall)",
   "sizeOptions": [
    "Small"
   ],
   "speed": 30,
   "traits": [
    {
     "name": "Brave",
     "description": "You have Advantage on saving throws you make to avoid or end the Frightened condition."
    },
    {
     "name": "Halfling Nimbleness",
     "description": "You can move through the space of any creature that is a size larger than you, but you can't stop in the same space."
    },
    {
     "name": "Luck",
     "description": "When you roll a 1 on the d20 of a D20 Test, you can reroll the die, and you must use the new roll."
    },
    {
     "name": "Naturally Stealthy",
     "description": "You can take the Hide action even when you are obscured only by a creature that is at least one size larger than you."
    }
   ],
   "choices": []
  },
  "human": {
   "id": "human",
   "name": "Human",
   "creatureType": "Humanoid",
   "sizeText": "Medium (about 4–7 feet tall) or Small (about 2–4 feet tall), chosen when you select this species",
   "sizeOptions": [
    "Medium",
    "Small"
   ],
   "speed": 30,
   "traits": [
    {
     "name": "Resourceful",
     "description": "You gain Heroic Inspiration whenever you finish a Long Rest."
    },
    {
     "name": "Skillful",
     "description": "You gain proficiency in one skill of your choice."
    },
    {
     "name": "Versatile",
     "description": "You gain an Origin feat of your choice (see \"Feats\"). Skilled is recommended."
    }
   ],
   "choices": [
    {
     "id": "size",
     "label": "Size",
     "required": true,
     "sizes": [
      "Medium",
      "Small"
     ]
    },
    {
     "id": "skill",
     "label": "Skillful",
     "required": true,
     "skills": [
      "acrobatics",
      "animal-handling",
      "arcana",
      "athletics",
      "deception",
      "history",
      "insight",
      "intimidation",
      "investigation",
      "medicine",
      "nature",
      "perception",
      "performance",
      "persuasion",
      "religion",
      "sleight-of-hand",
      "stealth",
      "survival"
     ]
    },
    {
     "id": "feat",
     "label": "Versatile (Origin feat)",
     "required": true,
     "featCategory": "origin"
    }
   ]
  },
  "orc": {
   "id": "orc",
   "name": "Orc",
   "creatureType": "Humanoid",
   "sizeText": "Medium (about 6–7 feet tall)",
   "sizeOptions": [
    "Medium"
   ],
   "speed": 30,
   "traits": [
    {
     "name": "Adrenaline Rush",
     "description": "You can take the Dash action as a Bonus Action. When you do so, you gain a number of Temporary Hit Points equal to your Proficiency Bonus.\nYou can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Short or Long Rest."
    },
    {
     "name": "Darkvision",
     "description": "You have Darkvision with a range of 120 feet."
    },
    {
     "name": "Relentless Endurance",
     "description": "When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can't do so again until you finish a Long Rest."
    }
   ],
   "choices": [],
   "darkvision": 120
  },
  "tiefling": {
   "id": "tiefling",
   "name": "Tiefling",
   "creatureType": "Humanoid",
   "sizeText": "Medium (about 4–7 feet tall) or Small (about 3–4 feet tall), chosen when you select this species",
   "sizeOptions": [
    "Medium",
    "Small"
   ],
   "speed": 30,
   "traits": [
    {
     "name": "Darkvision",
     "description": "You have Darkvision with a range of 60 feet."
    },
    {
     "name": "Fiendish Legacy",
     "description": "You are the recipient of a legacy that grants you supernatural abilities. Choose a legacy from the Fiendish Legacies table. You gain the level 1 benefit of the chosen legacy.\nWhen you reach character levels 3 and 5, you learn a higher-level spell, as shown on the table. You always have that spell prepared. You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a Long Rest. You can also cast the spell using any spell slots you have of the appropriate level.\nIntelligence, Wisdom, or Charisma is your spellcasting ability for the spells you cast with this trait (choose the ability when you select the legacy)."
    },
    {
     "name": "Otherworldly Presence",
     "description": "You know the _Thaumaturgy_ cantrip. When you cast it with this trait, the spell uses the same spellcasting ability you use for your Fiendish Legacy trait."
    }
   ],
   "choices": [
    {
     "id": "size",
     "label": "Size",
     "required": true,
     "sizes": [
      "Medium",
      "Small"
     ]
    },
    {
     "id": "lineage",
     "label": "Fiendish Legacy",
     "required": true,
     "options": [
      {
       "id": "abyssal",
       "name": "Abyssal",
       "level1": "You have Resistance to Poison damage. You also know the Poison Spray cantrip.",
       "spells": {
        "3": "ray-of-sickness",
        "5": "hold-person"
       },
       "cantrip": "poison-spray",
       "description": "You have Resistance to Poison damage. You also know the Poison Spray cantrip."
      },
      {
       "id": "chthonic",
       "name": "Chthonic",
       "level1": "You have Resistance to Necrotic damage. You also know the Chill Touch cantrip.",
       "spells": {
        "3": "false-life",
        "5": "ray-of-enfeeblement"
       },
       "cantrip": "chill-touch",
       "description": "You have Resistance to Necrotic damage. You also know the Chill Touch cantrip."
      },
      {
       "id": "infernal",
       "name": "Infernal",
       "level1": "You have Resistance to Fire damage. You also know the Fire Bolt cantrip.",
       "spells": {
        "3": "hellish-rebuke",
        "5": "darkness"
       },
       "cantrip": "fire-bolt",
       "description": "You have Resistance to Fire damage. You also know the Fire Bolt cantrip."
      }
     ]
    },
    {
     "id": "spellAbility",
     "label": "Legacy spellcasting ability",
     "required": true,
     "abilities": [
      "int",
      "wis",
      "cha"
     ]
    }
   ],
   "cantrips": [
    "thaumaturgy"
   ],
   "darkvision": 60
  },
  "intro": "A species includes the following parts.\n\n#### Creature Type\n\nA character's species determines the character's creature type, which is described in \"Rules Glossary.\" Every species in \"Character Origins\" is Humanoid; playable non-Humanoid species appear in other books.\n\n#### Size\n\nYour character's species determines the character's size. Individuals within a species cover a wide range of heights, and some species include such diversity of size that you can choose whether your character is Small or Medium.\n\n#### Speed\n\nYour character's species determines the character's Speed.\n\n#### Special Traits\n\nEach species gives a character special traits—unique characteristics based on the species' physiology or magical nature. When you choose a species, your character gets all the special traits listed for it. Some traits involve making a choice from a handful of options."
 },
 "classes": {
  "barbarian": {
   "id": "barbarian",
   "name": "Barbarian",
   "primaryAbilityText": "Strength",
   "hitDie": 12,
   "fixedHpPerLevel": 7,
   "savingThrows": [
    "str",
    "con"
   ],
   "skillChoices": {
    "count": 2,
    "from": [
     "animal-handling",
     "athletics",
     "intimidation",
     "nature",
     "perception",
     "survival"
    ]
   },
   "casterType": null,
   "weaponProficiencyText": "Simple and Martial weapons",
   "armorTrainingText": "Light and Medium armor and Shields",
   "toolProficiencyText": null,
   "equipmentText": "(A) Greataxe, 4 Handaxes, Explorer's Pack, and 15 GP; or (B) 75 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Greataxe",
       "count": 1,
       "weaponId": "greataxe"
      },
      {
       "name": "Handaxes",
       "count": 4,
       "weaponId": "handaxe"
      },
      {
       "name": "Explorer's Pack",
       "count": 1
      }
     ],
     "gp": 15
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 75
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Rage",
      "Unarmored Defense",
      "Weapon Mastery"
     ],
     "rages": 2,
     "rageDamage": 2,
     "weaponMastery": 2
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Danger Sense",
      "Reckless Attack"
     ],
     "rages": 2,
     "rageDamage": 2,
     "weaponMastery": 2
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Barbarian Subclass",
      "Primal Knowledge"
     ],
     "rages": 3,
     "rageDamage": 2,
     "weaponMastery": 2
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "rages": 3,
     "rageDamage": 2,
     "weaponMastery": 3
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Extra Attack",
      "Fast Movement"
     ],
     "rages": 3,
     "rageDamage": 2,
     "weaponMastery": 3
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Subclass feature"
     ],
     "rages": 4,
     "rageDamage": 2,
     "weaponMastery": 3
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [
      "Feral Instinct",
      "Instinctive Pounce"
     ],
     "rages": 4,
     "rageDamage": 2,
     "weaponMastery": 3
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "rages": 4,
     "rageDamage": 2,
     "weaponMastery": 3
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [
      "Brutal Strike"
     ],
     "rages": 4,
     "rageDamage": 3,
     "weaponMastery": 3
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Subclass feature"
     ],
     "rages": 4,
     "rageDamage": 3,
     "weaponMastery": 4
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [
      "Relentless Rage"
     ],
     "rages": 4,
     "rageDamage": 3,
     "weaponMastery": 4
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "rages": 5,
     "rageDamage": 3,
     "weaponMastery": 4
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [
      "Improved Brutal Strike"
     ],
     "rages": 5,
     "rageDamage": 3,
     "weaponMastery": 4
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Subclass feature"
     ],
     "rages": 5,
     "rageDamage": 3,
     "weaponMastery": 4
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [
      "Persistent Rage"
     ],
     "rages": 5,
     "rageDamage": 3,
     "weaponMastery": 4
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "rages": 5,
     "rageDamage": 4,
     "weaponMastery": 4
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [
      "Improved Brutal Strike"
     ],
     "rages": 6,
     "rageDamage": 4,
     "weaponMastery": 4
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [
      "Indomitable Might"
     ],
     "rages": 6,
     "rageDamage": 4,
     "weaponMastery": 4
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "rages": 6,
     "rageDamage": 4,
     "weaponMastery": 4
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Primal Champion"
     ],
     "rages": 6,
     "rageDamage": 4,
     "weaponMastery": 4
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Rage",
     "description": "You can imbue yourself with a primal power called Rage, a force that grants you extraordinary might and resilience. You can enter it as a Bonus Action if you aren't wearing Heavy armor.\n\nYou can enter your Rage the number of times shown for your Barbarian level in the Rages column of the Barbarian Features table. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest.\n\nWhile active, your Rage follows the rules below.\n\n_Damage Resistance._ You have Resistance to Bludgeoning, Piercing, and Slashing damage.\n\n_Rage Damage._ When you make an attack using Strength—with either a weapon or an Unarmed Strike—and deal damage to the target, you gain a bonus to the damage that increases as you gain levels as a Barbarian, as shown in the Rage Damage column of the Barbarian Features table.\n\n_Strength Advantage._ You have Advantage on Strength checks and Strength saving throws.\n\n_No Concentration or Spells._ You can't maintain Concentration, and you can't cast spells.\n\n_Duration._ The Rage lasts until the end of your next turn, and it ends early if you don Heavy armor or have the Incapacitated condition. If your Rage is still active on your next turn, you can extend the Rage for another round by doing one of the following:\n\n- Make an attack roll against an enemy.\n- Force an enemy to make a saving throw.\n- Take a Bonus Action to extend your Rage.\n\nEach time the Rage is extended, it lasts until the end of your next turn. You can maintain a Rage for up to 10 minutes."
    },
    {
     "level": 1,
     "name": "Unarmored Defense",
     "description": "While you aren't wearing any armor, your base Armor Class equals 10 plus your Dexterity and Constitution modifiers. You can use a Shield and still gain this benefit."
    },
    {
     "level": 1,
     "name": "Weapon Mastery",
     "description": "Your training with weapons allows you to use the mastery properties of two kinds of Simple or Martial Melee weapons of your choice, such as Greataxes and Handaxes. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices.\n\nWhen you reach certain Barbarian levels, you gain the ability to use the mastery properties of more kinds of weapons, as shown in the Weapon Mastery column of the Barbarian Features table."
    },
    {
     "level": 2,
     "name": "Danger Sense",
     "description": "You gain an uncanny sense of when things aren't as they should be, giving you an edge when you dodge perils. You have Advantage on Dexterity saving throws unless you have the Incapacitated condition."
    },
    {
     "level": 2,
     "name": "Reckless Attack",
     "description": "You can throw aside all concern for defense to attack with increased ferocity. When you make your first attack roll on your turn, you can decide to attack recklessly. Doing so gives you Advantage on attack rolls using Strength until the start of your next turn, but attack rolls against you have Advantage during that time."
    },
    {
     "level": 3,
     "name": "Barbarian Subclass",
     "description": "You gain a Barbarian subclass of your choice. The Path of the Berserker subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Barbarian levels. For the rest of your career, you gain each of your subclass's features that are of your Barbarian level or lower."
    },
    {
     "level": 3,
     "name": "Primal Knowledge",
     "description": "You gain proficiency in another skill of your choice from the skill list available to Barbarians at level 1.\n\nIn addition, while your Rage is active, you can channel primal power when you attempt certain tasks; whenever you make an ability check using one of the following skills, you can make it as a Strength check even if it normally uses a different ability: Acrobatics, Intimidation, Perception, Stealth, or Survival. When you use this ability, your Strength represents primal power coursing through you, honing your agility, bearing, and senses."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Barbarian levels 8, 12, and 16."
    },
    {
     "level": 5,
     "name": "Extra Attack",
     "description": "You can attack twice instead of once whenever you take the Attack action on your turn."
    },
    {
     "level": 5,
     "name": "Fast Movement",
     "description": "Your speed increases by 10 feet while you aren't wearing Heavy armor."
    },
    {
     "level": 7,
     "name": "Feral Instinct",
     "description": "Your instincts are so honed that you have Advantage on Initiative rolls."
    },
    {
     "level": 7,
     "name": "Instinctive Pounce",
     "description": "As part of the Bonus Action you take to enter your Rage, you can move up to half your Speed."
    },
    {
     "level": 9,
     "name": "Brutal Strike",
     "description": "If you use Reckless Attack, you can forgo any Advantage on one Strength-based attack roll of your choice on your turn. The chosen attack roll mustn't have Disadvantage. If the chosen attack roll hits, the target takes an extra 1d10 damage of the same type dealt by the weapon or Unarmed Strike, and you can cause one Brutal Strike effect of your choice. You have the following effect options.\n\n_Forceful Blow._ The target is pushed 15 feet straight away from you. You can then move up to half your Speed straight toward the target without provoking Opportunity Attacks.\n_Hamstring Blow._ The target's Speed is reduced by 15 feet until the start of your next turn. A target can be affected by only one Hamstring Blow at a time—the most recent one."
    },
    {
     "level": 11,
     "name": "Relentless Rage",
     "description": "Your Rage can keep you fighting despite grievous wounds. If you drop to 0 Hit Points while your Rage is active and don't die outright, you can make a DC 10 Constitution saving throw. If you succeed, your Hit Points instead change to a number equal to twice your Barbarian level.\n\nEach time you use this feature after the first, the DC increases by 5. When you finish a Short or Long Rest, the DC resets to 10."
    },
    {
     "level": 13,
     "name": "Improved Brutal Strike",
     "description": "You have honed new ways to attack furiously. The following effects are now among your Brutal Strike options.\n\n_Staggering Blow._ The target has Disadvantage on the next saving throw it makes, and it can't make Opportunity Attacks until the start of your next turn.\n\n_Sundering Blow._ Before the start of your next turn, the next attack roll made by another creature against the target gains a +5 bonus to the roll. An attack roll can gain only one Sundering Blow bonus."
    },
    {
     "level": 15,
     "name": "Persistent Rage",
     "description": "When you roll Initiative, you can regain all expended uses of Rage. After you regain uses of Rage in this way, you can't do so again until you finish a Long Rest.\n\nIn addition, your Rage is so fierce that it now lasts for 10 minutes without you needing to do anything to extend it from round to round. Your Rage ends early if you have the Unconscious condition (not just the Incapacitated condition) or don Heavy armor."
    },
    {
     "level": 17,
     "name": "Improved Brutal Strike",
     "description": "The extra damage of your Brutal Strike increases to 2d10. In addition, you can use two different Brutal Strike effects whenever you use your Brutal Strike feature."
    },
    {
     "level": 18,
     "name": "Indomitable Might",
     "description": "If your total for a Strength check or Strength saving throw is less than your Strength score, you can use that score in place of the total."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Irresistible Offense is recommended."
    },
    {
     "level": 20,
     "name": "Primal Champion",
     "description": "You embody primal power. Your Strength and Constitution scores increase by 4, to a maximum of 25."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "path-of-the-berserker",
    "name": "Path of the Berserker",
    "tagline": "Channel Rage into Violent Fury",
    "description": "_Channel Rage into Violent Fury_\n\nBarbarians who walk the Path of the Berserker direct their Rage primarily toward violence. Their path is one of untrammeled fury, and they thrill in the chaos of battle as they allow their Rage to seize and empower them.",
    "features": [
     {
      "level": 3,
      "name": "Frenzy",
      "description": "If you use Reckless Attack while your Rage is active, you deal extra damage to the first target you hit on your turn with a Strength-based attack. To determine the extra damage, roll a number of d6s equal to your Rage Damage bonus, and add them together. The damage has the same type as the weapon or Unarmed Strike used for the attack."
     },
     {
      "level": 6,
      "name": "Mindless Rage",
      "description": "You have Immunity to the Charmed and Frightened conditions while your Rage is active. If you're Charmed or Frightened when you enter your Rage, the condition ends on you."
     },
     {
      "level": 10,
      "name": "Retaliation",
      "description": "When you take damage from a creature that is within 5 feet of you, you can take a Reaction to make one melee attack against that creature, using a weapon or an Unarmed Strike."
     },
     {
      "level": 14,
      "name": "Intimidating Presence",
      "description": "As a Bonus Action, you can strike terror into others with your menacing presence and primal power. When you do so, each creature of your choice in a 30-foot Emanation originating from you must make a Wisdom saving throw (DC 8 plus your Strength modifier and Proficiency Bonus). On a failed save, a creature has the Frightened condition for 1 minute. At the end of each of the Frightened creature's turns, the creature repeats the save, ending the effect on itself on a success.\n\nOnce you use this feature, you can't use it again until you finish a Long Rest unless you expend a use of your Rage (no action required) to restore your use of it."
     }
    ]
   },
   "spellList": null,
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true,
     "martial": true
    },
    "armor": {
     "light": true,
     "medium": true,
     "shield": true
    },
    "tools": []
   },
   "weaponMastery": {
    "column": "weaponMastery",
    "eligible": "melee"
   },
   "unarmoredDefense": {
    "ability": "con",
    "shield": true
   },
   "speedBonus": {
    "level": 5,
    "amount": 10,
    "unless": "heavy-armor",
    "source": "Fast Movement"
   },
   "capstoneIncrease": {
    "level": 20,
    "abilities": [
     "str",
     "con"
    ],
    "amount": 4,
    "max": 25,
    "source": "Primal Champion"
   },
   "initiativeAdvantage": {
    "level": 7,
    "source": "Feral Instinct"
   },
   "choices": [
    {
     "id": "primalKnowledge",
     "level": 3,
     "label": "Primal Knowledge (extra skill)",
     "type": "skills",
     "count": 1,
     "from": [
      "animal-handling",
      "athletics",
      "intimidation",
      "nature",
      "perception",
      "survival"
     ]
    }
   ],
   "alwaysPrepared": {}
  },
  "bard": {
   "id": "bard",
   "name": "Bard",
   "primaryAbilityText": "Charisma",
   "hitDie": 8,
   "fixedHpPerLevel": 5,
   "savingThrows": [
    "dex",
    "cha"
   ],
   "skillChoices": {
    "count": 3,
    "from": [
     "acrobatics",
     "animal-handling",
     "arcana",
     "athletics",
     "deception",
     "history",
     "insight",
     "intimidation",
     "investigation",
     "medicine",
     "nature",
     "perception",
     "performance",
     "persuasion",
     "religion",
     "sleight-of-hand",
     "stealth",
     "survival"
    ]
   },
   "casterType": "full",
   "weaponProficiencyText": "Simple weapons",
   "armorTrainingText": "Light armor",
   "toolProficiencyText": "Choose 3 Musical Instruments (see Equipment)",
   "equipmentText": "(A) Leather Armor, 2 Daggers, Musical Instrument of your choice, Entertainer's Pack, and 19 GP; or (B) 90 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Leather Armor",
       "count": 1,
       "armorId": "leather-armor"
      },
      {
       "name": "Daggers",
       "count": 2,
       "weaponId": "dagger"
      },
      {
       "name": "Musical Instrument of your choice",
       "count": 1
      },
      {
       "name": "Entertainer's Pack",
       "count": 1
      }
     ],
     "gp": 19
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 90
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Bardic Inspiration",
      "Spellcasting"
     ],
     "bardicDie": "d6",
     "cantrips": 2,
     "preparedSpells": 4,
     "slots": [
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Expertise",
      "Jack of All Trades"
     ],
     "bardicDie": "d6",
     "cantrips": 2,
     "preparedSpells": 5,
     "slots": [
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Bard Subclass"
     ],
     "bardicDie": "d6",
     "cantrips": 2,
     "preparedSpells": 6,
     "slots": [
      4,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "bardicDie": "d6",
     "cantrips": 3,
     "preparedSpells": 7,
     "slots": [
      4,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Font of Inspiration"
     ],
     "bardicDie": "d8",
     "cantrips": 3,
     "preparedSpells": 9,
     "slots": [
      4,
      3,
      2,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Subclass feature"
     ],
     "bardicDie": "d8",
     "cantrips": 3,
     "preparedSpells": 10,
     "slots": [
      4,
      3,
      3,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [
      "Countercharm"
     ],
     "bardicDie": "d8",
     "cantrips": 3,
     "preparedSpells": 11,
     "slots": [
      4,
      3,
      3,
      1,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "bardicDie": "d8",
     "cantrips": 3,
     "preparedSpells": 12,
     "slots": [
      4,
      3,
      3,
      2,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [
      "Expertise"
     ],
     "bardicDie": "d8",
     "cantrips": 3,
     "preparedSpells": 14,
     "slots": [
      4,
      3,
      3,
      3,
      1,
      0,
      0,
      0,
      0
     ]
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Magical Secrets"
     ],
     "bardicDie": "d10",
     "cantrips": 4,
     "preparedSpells": 15,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      0,
      0,
      0,
      0
     ]
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [],
     "bardicDie": "d10",
     "cantrips": 4,
     "preparedSpells": 16,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      0,
      0,
      0
     ]
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "bardicDie": "d10",
     "cantrips": 4,
     "preparedSpells": 16,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      0,
      0,
      0
     ]
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [],
     "bardicDie": "d10",
     "cantrips": 4,
     "preparedSpells": 17,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      0,
      0
     ]
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Subclass feature"
     ],
     "bardicDie": "d10",
     "cantrips": 4,
     "preparedSpells": 17,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      0,
      0
     ]
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [],
     "bardicDie": "d12",
     "cantrips": 4,
     "preparedSpells": 18,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      0
     ]
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "bardicDie": "d12",
     "cantrips": 4,
     "preparedSpells": 18,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      0
     ]
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [],
     "bardicDie": "d12",
     "cantrips": 4,
     "preparedSpells": 19,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      1
     ]
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [
      "Superior Inspiration"
     ],
     "bardicDie": "d12",
     "cantrips": 4,
     "preparedSpells": 20,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      1,
      1,
      1,
      1
     ]
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "bardicDie": "d12",
     "cantrips": 4,
     "preparedSpells": 21,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      2,
      1,
      1,
      1
     ]
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Words of Creation"
     ],
     "bardicDie": "d12",
     "cantrips": 4,
     "preparedSpells": 22,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      2,
      2,
      1,
      1
     ]
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Bardic Inspiration",
     "description": "You can supernaturally inspire others through words, music, or dance. This inspiration is represented by your Bardic Inspiration die, which is a d6.\n\n_Using Bardic Inspiration._ As a Bonus Action, you can inspire another creature within 60 feet of yourself who can see or hear you. That creature gains one of your Bardic Inspiration dice. A creature can have only one Bardic Inspiration die at a time.\n\nOnce within the next hour when the creature fails a D20 Test, the creature can roll the Bardic Inspiration die and add the number rolled to the d20, potentially turning the failure into a success. A Bardic Inspiration die is expended when it's rolled.\n\n_Number of Uses._ You can confer a Bardic Inspiration die a number of times equal to your Charisma modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.\n\n_At Higher Levels._ Your Bardic Inspiration die changes when you reach certain Bard levels, as shown in the Bardic Die column of the Bard Features table. The die becomes a d8 at level 5, a d10 at level 10, and a d12 at level 15."
    },
    {
     "level": 1,
     "name": "Spellcasting",
     "description": "You have learned to cast spells through your bardic arts. See \"Spells\" for the rules on spellcasting. The information below details how you use those rules with Bard spells, which appear in the Bard spell list later in the class's description.\n\n_Cantrips._ You know two cantrips of your choice from the Bard spell list. _Dancing Lights_ and _Vicious Mockery_ are recommended.\n\nWhenever you gain a Bard level, you can replace one of your cantrips with another cantrip of your choice from the Bard spell list.\n\nWhen you reach Bard levels 4 and 10, you learn another cantrip of your choice from the Bard spell list, as shown in the Cantrips column of the Bard Features table.\n\n_Spell Slots._ The Bard Features table shows how many spell slots you have to cast your level 1+ spells. You regain all expended slots when you finish a Long Rest.\n\n_Prepared Spells of Level 1+._ You prepare the list of level 1+ spells that are available for you to cast with this feature. To start, choose four level 1 spells from the Bard spell list. _Charm Person_, _Color Spray_, _Dissonant Whispers_, and _Healing Word_ are recommended.\n\nThe number of spells on your list increases as you gain Bard levels, as shown in the Prepared Spells column of the Bard Features table. Whenever that number increases, choose additional spells from the Bard spell list until the number of spells on your list matches the number on the table. The chosen spells must be of a level for which you have spell slots. For example, if you're a level 3 Bard, your list of prepared spells can include six spells of levels 1 and 2 in any combination.\n\nIf another Bard feature gives you spells that you always have prepared, those spells don't count against the number of spells you can prepare with this feature, but those spells otherwise count as Bard spells for you.\n\n_Changing Your Prepared Spells._ Whenever you gain a Bard level, you can replace one spell on your list with another Bard spell for which you have spell slots.\n\n_Spellcasting Ability._ Charisma is your spellcasting ability for your Bard spells.\n\n_Spellcasting Focus._ You can use a Musical Instrument as a Spellcasting Focus for your Bard spells."
    },
    {
     "level": 2,
     "name": "Expertise",
     "description": "You gain Expertise (see \"Rules Glossary\") in two of your skill proficiencies of your choice. Performance and Persuasion are recommended if you have proficiency in them.\n\nAt Bard level 9, you gain Expertise in two more of your skill proficiencies of your choice."
    },
    {
     "level": 2,
     "name": "Jack of All Trades",
     "description": "You can add half your Proficiency Bonus (round down) to any ability check you make that uses a skill proficiency you lack and that doesn't otherwise use your Proficiency Bonus.\n\nFor example, if you make a Strength (Athletics) check and lack Athletics proficiency, you can add half your Proficiency Bonus to the check."
    },
    {
     "level": 3,
     "name": "Bard Subclass",
     "description": "You gain a Bard subclass of your choice. The College of Lore subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Bard levels. For the rest of your career, you gain each of your subclass's features that are of your Bard level or lower."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Bard levels 8, 12, and 16."
    },
    {
     "level": 5,
     "name": "Font of Inspiration",
     "description": "You now regain all your expended uses of Bardic Inspiration when you finish a Short or Long Rest.\n\nIn addition, you can expend a spell slot (no action required) to regain one expended use of Bardic Inspiration."
    },
    {
     "level": 7,
     "name": "Countercharm",
     "description": "You can use musical notes or words of power to disrupt mind-influencing effects. If you or a creature within 30 feet of you fails a saving throw against an effect that applies the Charmed or Frightened condition, you can take a Reaction to cause the save to be rerolled, and the new roll has Advantage."
    },
    {
     "level": 10,
     "name": "Magical Secrets",
     "description": "You've learned secrets from various magical traditions. Whenever you reach a Bard level (including this level) and the Prepared Spells number in the Bard Features table increases, you can choose any of your new prepared spells from the Bard, Cleric, Druid, and Wizard spell lists, and the chosen spells count as Bard spells for you (see a class's section for its spell list). In addition, whenever you replace a spell prepared for this class, you can replace it with a spell from those lists."
    },
    {
     "level": 18,
     "name": "Superior Inspiration",
     "description": "When you roll Initiative, you regain expended uses of Bardic Inspiration until you have two if you have fewer than that."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Spell Recall is recommended."
    },
    {
     "level": 20,
     "name": "Words of Creation",
     "description": "You have mastered two of the Words of Creation: the words of life and death. You therefore always have the _Power Word Heal_ and _Power Word Kill_ spells prepared. When you cast either spell, you can target a second creature with it if that creature is within 10 feet of the first target."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "college-of-lore",
    "name": "College of Lore",
    "tagline": "Plumb the Depths of Magical Knowledge",
    "description": "_Plumb the Depths of Magical Knowledge_\n\nBards of the College of Lore collect spells and secrets from diverse sources, such as scholarly tomes, mystical rites, and peasant tales. The college's members gather in libraries and universities to share their lore with one another. They also meet at festivals or affairs of state, where they can expose corruption, unravel lies, and poke fun at self-important figures of authority.",
    "features": [
     {
      "level": 3,
      "name": "Bonus Proficiencies",
      "description": "You gain proficiency with three skills of your choice."
     },
     {
      "level": 3,
      "name": "Cutting Words",
      "description": "You learn to use your wit to supernaturally distract, confuse, and otherwise sap the confidence and competence of others. When a creature that you can see within 60 feet of yourself makes a damage roll or succeeds on an ability check or attack roll, you can take a Reaction to expend one use of your Bardic Inspiration; roll your Bardic Inspiration die, and subtract the number rolled from the creature's roll, reducing the damage or potentially turning the success into a failure."
     },
     {
      "level": 6,
      "name": "Magical Discoveries",
      "description": "You learn two spells of your choice. These spells can come from the Cleric, Druid, or Wizard spell list or any combination thereof (see a class's section for its spell list). A spell you choose must be a cantrip or a spell for which you have spell slots, as shown in the Bard Features table.\n\nYou always have the chosen spells prepared, and whenever you gain a Bard level, you can replace one of the spells with another spell that meets these requirements."
     },
     {
      "level": 14,
      "name": "Peerless Skill",
      "description": "When you make an ability check or attack roll and fail, you can expend one use of Bardic Inspiration; roll the Bardic Inspiration die, and add the number rolled to the d20, potentially turning a failure into a success. On a failure, the Bardic Inspiration isn't expended."
     }
    ]
   },
   "spellList": {
    "0": [
     "dancing-lights",
     "light",
     "mage-hand",
     "mending",
     "message",
     "minor-illusion",
     "prestidigitation",
     "starry-wisp",
     "true-strike",
     "vicious-mockery"
    ],
    "1": [
     "animal-friendship",
     "bane",
     "charm-person",
     "color-spray",
     "command",
     "comprehend-languages",
     "cure-wounds",
     "detect-magic",
     "disguise-self",
     "dissonant-whispers",
     "faerie-fire",
     "feather-fall",
     "healing-word",
     "heroism",
     "hideous-laughter",
     "identify",
     "illusory-script",
     "longstrider",
     "silent-image",
     "sleep",
     "speak-with-animals",
     "thunderwave",
     "unseen-servant"
    ],
    "2": [
     "aid",
     "animal-messenger",
     "blindness-deafness",
     "calm-emotions",
     "detect-thoughts",
     "enhance-ability",
     "enlarge-reduce",
     "enthrall",
     "heat-metal",
     "hold-person",
     "invisibility",
     "knock",
     "lesser-restoration",
     "locate-animals-or-plants",
     "locate-object",
     "magic-mouth",
     "mirror-image",
     "phantasmal-force",
     "see-invisibility",
     "shatter",
     "silence",
     "suggestion",
     "zone-of-truth"
    ],
    "3": [
     "bestow-curse",
     "clairvoyance",
     "dispel-magic",
     "fear",
     "glyph-of-warding",
     "hypnotic-pattern",
     "major-image",
     "mass-healing-word",
     "nondetection",
     "plant-growth",
     "sending",
     "slow",
     "speak-with-dead",
     "speak-with-plants",
     "stinking-cloud",
     "tiny-hut",
     "tongues"
    ],
    "4": [
     "charm-monster",
     "compulsion",
     "confusion",
     "dimension-door",
     "freedom-of-movement",
     "greater-invisibility",
     "hallucinatory-terrain",
     "locate-creature",
     "phantasmal-killer",
     "polymorph"
    ],
    "5": [
     "animate-objects",
     "awaken",
     "dominate-person",
     "dream",
     "geas",
     "greater-restoration",
     "hold-monster",
     "legend-lore",
     "mass-cure-wounds",
     "mislead",
     "modify-memory",
     "planar-binding",
     "raise-dead",
     "scrying",
     "seeming",
     "telepathic-bond",
     "teleportation-circle"
    ],
    "6": [
     "eyebite",
     "find-the-path",
     "guards-and-wards",
     "heroes-feast",
     "irresistible-dance",
     "mass-suggestion",
     "programmed-illusion",
     "true-seeing"
    ],
    "7": [
     "arcane-sword",
     "etherealness",
     "forcecage",
     "magnificent-mansion",
     "mirage-arcane",
     "prismatic-spray",
     "project-image",
     "regenerate",
     "resurrection",
     "symbol",
     "teleport"
    ],
    "8": [
     "antipathy-sympathy",
     "befuddlement",
     "dominate-monster",
     "glibness",
     "mind-blank",
     "power-word-stun"
    ],
    "9": [
     "foresight",
     "power-word-heal",
     "power-word-kill",
     "prismatic-wall",
     "true-polymorph"
    ]
   },
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true
    },
    "armor": {
     "light": true
    },
    "tools": []
   },
   "spellcasting": {
    "ability": "cha",
    "focus": "Musical Instrument",
    "ritual": false,
    "type": "full"
   },
   "jackOfAllTrades": {
    "level": 2
   },
   "bardicInspiration": {
    "usesAbility": "cha",
    "min": 1
   },
   "magicalSecrets": {
    "level": 10,
    "lists": [
     "bard",
     "cleric",
     "druid",
     "wizard"
    ]
   },
   "choices": [
    {
     "id": "instruments",
     "level": 1,
     "label": "Musical Instruments (tool proficiencies)",
     "type": "tools",
     "count": 3,
     "families": [
      "musical-instrument"
     ]
    },
    {
     "id": "expertise2",
     "level": 2,
     "label": "Expertise (level 2)",
     "type": "expertise",
     "count": 2
    },
    {
     "id": "expertise9",
     "level": 9,
     "label": "Expertise (level 9)",
     "type": "expertise",
     "count": 2
    },
    {
     "id": "loreSkills",
     "level": 3,
     "subclass": true,
     "label": "Bonus Proficiencies (College of Lore)",
     "type": "skills",
     "count": 3,
     "from": [
      "acrobatics",
      "animal-handling",
      "arcana",
      "athletics",
      "deception",
      "history",
      "insight",
      "intimidation",
      "investigation",
      "medicine",
      "nature",
      "perception",
      "performance",
      "persuasion",
      "religion",
      "sleight-of-hand",
      "stealth",
      "survival"
     ]
    },
    {
     "id": "magicalDiscoveries",
     "level": 6,
     "subclass": true,
     "label": "Magical Discoveries (College of Lore)",
     "type": "spells",
     "count": 2,
     "lists": [
      "cleric",
      "druid",
      "wizard"
     ],
     "alwaysPrepared": true
    }
   ],
   "alwaysPrepared": {}
  },
  "cleric": {
   "id": "cleric",
   "name": "Cleric",
   "primaryAbilityText": "Wisdom",
   "hitDie": 8,
   "fixedHpPerLevel": 5,
   "savingThrows": [
    "wis",
    "cha"
   ],
   "skillChoices": {
    "count": 2,
    "from": [
     "history",
     "insight",
     "medicine",
     "persuasion",
     "religion"
    ]
   },
   "casterType": "full",
   "weaponProficiencyText": "Simple weapons",
   "armorTrainingText": "Light and Medium armor and Shields",
   "toolProficiencyText": null,
   "equipmentText": "(A) Chain Shirt, Shield, Mace, Holy Symbol, Priest's Pack, and 7 GP; or (B) 110 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Chain Shirt",
       "count": 1,
       "armorId": "chain-shirt"
      },
      {
       "name": "Shield",
       "count": 1,
       "armorId": "shield"
      },
      {
       "name": "Mace",
       "count": 1,
       "weaponId": "mace"
      },
      {
       "name": "Holy Symbol",
       "count": 1
      },
      {
       "name": "Priest's Pack",
       "count": 1
      }
     ],
     "gp": 7
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 110
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Spellcasting",
      "Divine Order"
     ],
     "channelDivinity": 0,
     "cantrips": 3,
     "preparedSpells": 4,
     "slots": [
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Channel Divinity"
     ],
     "channelDivinity": 2,
     "cantrips": 3,
     "preparedSpells": 5,
     "slots": [
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Cleric Subclass"
     ],
     "channelDivinity": 2,
     "cantrips": 3,
     "preparedSpells": 6,
     "slots": [
      4,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "channelDivinity": 2,
     "cantrips": 4,
     "preparedSpells": 7,
     "slots": [
      4,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Sear Undead"
     ],
     "channelDivinity": 2,
     "cantrips": 4,
     "preparedSpells": 9,
     "slots": [
      4,
      3,
      2,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Subclass feature"
     ],
     "channelDivinity": 3,
     "cantrips": 4,
     "preparedSpells": 10,
     "slots": [
      4,
      3,
      3,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [
      "Blessed Strikes"
     ],
     "channelDivinity": 3,
     "cantrips": 4,
     "preparedSpells": 11,
     "slots": [
      4,
      3,
      3,
      1,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "channelDivinity": 3,
     "cantrips": 4,
     "preparedSpells": 12,
     "slots": [
      4,
      3,
      3,
      2,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [],
     "channelDivinity": 3,
     "cantrips": 4,
     "preparedSpells": 14,
     "slots": [
      4,
      3,
      3,
      3,
      1,
      0,
      0,
      0,
      0
     ]
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Divine Intervention"
     ],
     "channelDivinity": 3,
     "cantrips": 5,
     "preparedSpells": 15,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      0,
      0,
      0,
      0
     ]
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [],
     "channelDivinity": 3,
     "cantrips": 5,
     "preparedSpells": 16,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      0,
      0,
      0
     ]
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "channelDivinity": 3,
     "cantrips": 5,
     "preparedSpells": 16,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      0,
      0,
      0
     ]
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [],
     "channelDivinity": 3,
     "cantrips": 5,
     "preparedSpells": 17,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      0,
      0
     ]
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Improved Blessed Strikes"
     ],
     "channelDivinity": 3,
     "cantrips": 5,
     "preparedSpells": 17,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      0,
      0
     ]
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [],
     "channelDivinity": 3,
     "cantrips": 5,
     "preparedSpells": 18,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      0
     ]
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "channelDivinity": 3,
     "cantrips": 5,
     "preparedSpells": 18,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      0
     ]
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [
      "Subclass feature"
     ],
     "channelDivinity": 3,
     "cantrips": 5,
     "preparedSpells": 19,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      1
     ]
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [],
     "channelDivinity": 4,
     "cantrips": 5,
     "preparedSpells": 20,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      1,
      1,
      1,
      1
     ]
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "channelDivinity": 4,
     "cantrips": 5,
     "preparedSpells": 21,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      2,
      1,
      1,
      1
     ]
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Greater Divine Intervention"
     ],
     "channelDivinity": 4,
     "cantrips": 5,
     "preparedSpells": 22,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      2,
      2,
      1,
      1
     ]
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Spellcasting",
     "description": "You have learned to cast spells through prayer and meditation. See \"Spells\" for the rules on spellcasting. The information below details how you use those rules with Cleric spells, which appear on the Cleric spell list later in the class's description.\n\n_Cantrips._ You know three cantrips of your choice from the Cleric spell list. _Guidance_, _Sacred Flame_, and _Thaumaturgy_ are recommended.\n\nWhenever you gain a Cleric level, you can replace one of your cantrips with another cantrip of your choice from the Cleric spell list.\n\nWhen you reach Cleric levels 4 and 10, you learn another cantrip of your choice from the Cleric spell list, as shown in the Cantrips column of the Cleric Features table.\n\n_Spell Slots._ The Cleric Features table shows how many spell slots you have to cast your level 1+ spells. You regain all expended slots when you finish a Long Rest.\n\n_Prepared Spells of Level 1+._ You prepare the list of level 1+ spells that are available for you to cast with this feature. To start, choose four level 1 spells from the Cleric spell list. _Bless_, _Cure Wounds_, _Guiding Bolt_, and _Shield of Faith_ are recommended.\n\nThe number of spells on your list increases as you gain Cleric levels, as shown in the Prepared Spells column of the Cleric Features table. Whenever that number increases, choose additional spells from the Cleric spell list until the number of spells on your list matches the number on the table. The chosen spells must be of a level for which you have spell slots. For example, if you're a level 3 Cleric, your list of prepared spells can include six spells of levels 1 and 2 in any combination.\n\nIf another Cleric feature gives you spells that you always have prepared, those spells don't count against the number of spells you can prepare with this feature, but those spells otherwise count as Cleric spells for you.\n\n_Changing Your Prepared Spells._ Whenever you finish a Long Rest, you can change your list of prepared spells, replacing any of the spells there with other Cleric spells for which you have spell slots.\n\n_Spellcasting Ability._ Wisdom is your spellcasting ability for your Cleric spells.\n\n_Spellcasting Focus._ You can use a Holy Symbol as a Spellcasting Focus for your Cleric spells."
    },
    {
     "level": 1,
     "name": "Divine Order",
     "description": "You have dedicated yourself to one of the following sacred roles of your choice.\n\n_Protector._ Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor.\n\n_Thaumaturge._ You know one extra cantrip from the Cleric spell list. In addition, your mystical connection to the divine gives you a bonus to your Intelligence (Arcana or Religion) checks. The bonus equals your Wisdom modifier (minimum of +1)."
    },
    {
     "level": 2,
     "name": "Channel Divinity",
     "description": "You can channel divine energy directly from the Outer Planes to fuel magical effects. You start with two such effects: Divine Spark and Turn Undead, each of which is described below. Each time you use this class's Channel Divinity, choose which Channel Divinity effect from this class to create. You gain additional effect options at higher Cleric levels.\n\nYou can use this class's Channel Divinity twice. You regain one of its expended uses when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest. You gain additional uses when you reach certain Cleric levels, as shown in the Channel Divinity column of the Cleric Features table.\n\nIf a Channel Divinity effect requires a saving throw, the DC equals the spell save DC from this class's Spellcasting feature.\n\n_Divine Spark._ As a Magic action, you point your Holy Symbol at another creature you can see within 30 feet of yourself and focus divine energy at it. Roll 1d8 and add your Wisdom modifier. You either restore Hit Points to the creature equal to that total or force the creature to make a Constitution saving throw. On a failed save, the creature takes Necrotic or Radiant damage (your choice) equal to that total. On a successful save, the creature takes half as much damage (round down).\n\nYou roll an additional d8 when you reach Cleric levels 7 (2d8), 13 (3d8), and 18 (4d8).\n\n_Turn Undead._ As a Magic action, you present your Holy Symbol and censure Undead creatures. Each Undead of your choice within 30 feet of you must make a Wisdom saving throw. If the creature fails its save, it has the Frightened and Incapacitated conditions for 1 minute. For that duration, it tries to move as far from you as it can on its turns. This effect ends early on the creature if it takes any damage, if you have the Incapacitated condition, or if you die."
    },
    {
     "level": 3,
     "name": "Cleric Subclass",
     "description": "You gain a Cleric subclass of your choice. The Life Domain subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Cleric levels. For the rest of your career, you gain each of your subclass's features that are of your Cleric level or lower."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Cleric levels 8, 12, and 16."
    },
    {
     "level": 5,
     "name": "Sear Undead",
     "description": "Whenever you use Turn Undead, you can roll a number of d8s equal to your Wisdom modifier (minimum of 1d8) and add the rolls together. Each Undead that fails its saving throw against that use of Turn Undead takes Radiant damage equal to the roll's total. This damage doesn't end the turn effect."
    },
    {
     "level": 7,
     "name": "Blessed Strikes",
     "description": "Divine power infuses you in battle. You gain one of the following options of your choice (if you get either option from a Cleric subclass in an older book, use only the option you choose for this feature).\n\n_Divine Strike._ Once on each of your turns when you hit a creature with an attack roll using a weapon, you can cause the target to take an extra 1d8 Necrotic or Radiant damage (your choice).\n\n_Potent Spellcasting._ Add your Wisdom modifier to the damage you deal with any Cleric cantrip."
    },
    {
     "level": 10,
     "name": "Divine Intervention",
     "description": "You can call on your deity or pantheon to intervene on your behalf. As a Magic action, choose any Cleric spell of level 5 or lower that doesn't require a Reaction to cast. As part of the same action, you cast that spell without expending a spell slot or needing Material components. You can't use this feature again until you finish a Long Rest."
    },
    {
     "level": 14,
     "name": "Improved Blessed Strikes",
     "description": "The option you chose for Blessed Strikes grows more powerful.\n\n_Divine Strike._ The extra damage of your Divine Strike increases to 2d8.\n\n_Potent Spellcasting._ When you cast a Cleric cantrip and deal damage to a creature with it, you can give vitality to yourself or another creature within 60 feet of yourself, granting a number of Temporary Hit Points equal to twice your Wisdom modifier."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Fate is recommended."
    },
    {
     "level": 20,
     "name": "Greater Divine Intervention",
     "description": "You can call on even more powerful divine intervention. When you use your Divine Intervention feature, you can choose _Wish_ when you select a spell. If you do so, you can't use Divine Intervention again until you finish 2d4 Long Rests."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "life-domain",
    "name": "Life Domain",
    "tagline": "Soothe the Hurts of the World",
    "description": "_Soothe the Hurts of the World_\n\nThe Life Domain focuses on the positive energy that helps sustain all life in the multiverse. Clerics who tap into this domain are masters of healing, using that life force to cure many hurts.\n\nExistence itself relies on the positive energy associated with this domain, so a Cleric of almost any religious tradition might choose it. This domain is particularly associated with agricultural deities, gods of healing or endurance, and gods of home and community. Religious orders of healing also seek the magic of this domain.",
    "features": [
     {
      "level": 3,
      "name": "Disciple of Life",
      "description": "When a spell you cast with a spell slot restores Hit Points to a creature, that creature regains additional Hit Points on the turn you cast the spell. The additional Hit Points equal 2 plus the spell slot's level."
     },
     {
      "level": 3,
      "name": "Life Domain Spells",
      "description": "Your connection to this divine domain ensures you always have certain spells ready. When you reach a Cleric level specified in the Life Domain Spells table, you thereafter always have the listed spells prepared.\n\n**Life Domain Spells**\n\n_Cleric Level — Prepared Spells_\n- 3 — Aid, Bless, Cure Wounds, Lesser Restoration\n- 5 — Mass Healing Word, Revivify\n- 7 — Aura of Life, Death Ward\n- 9 — Greater Restoration, Mass Cure Wounds"
     },
     {
      "level": 3,
      "name": "Preserve Life",
      "description": "As a Magic action, you present your Holy Symbol and expend a use of your Channel Divinity to evoke healing energy that can restore a number of Hit Points equal to five times your Cleric level. Choose Bloodied creatures within 30 feet of yourself (which can include you), and divide those Hit Points among them. This feature can restore a creature to no more than half its Hit Point maximum."
     },
     {
      "level": 6,
      "name": "Blessed Healer",
      "description": "The healing spells you cast on others heal you as well. Immediately after you cast a spell with a spell slot that restores Hit Points to one or more creatures other than yourself, you regain Hit Points equal to 2 plus the spell slot's level."
     },
     {
      "level": 17,
      "name": "Supreme Healing",
      "description": "When you would normally roll one or more dice to restore Hit Points to a creature with a spell or Channel Divinity, don't roll those dice for the healing; instead use the highest number possible for each die. For example, instead of restoring 2d6 Hit Points to a creature with a spell, you restore 12."
     }
    ],
    "alwaysPrepared": {
     "3": [
      "aid",
      "bless",
      "cure-wounds",
      "lesser-restoration"
     ],
     "5": [
      "mass-healing-word",
      "revivify"
     ],
     "7": [
      "aura-of-life",
      "death-ward"
     ],
     "9": [
      "greater-restoration",
      "mass-cure-wounds"
     ]
    }
   },
   "spellList": {
    "0": [
     "guidance",
     "light",
     "mending",
     "resistance",
     "sacred-flame",
     "spare-the-dying",
     "thaumaturgy"
    ],
    "1": [
     "bane",
     "bless",
     "command",
     "create-or-destroy-water",
     "cure-wounds",
     "detect-evil-and-good",
     "detect-magic",
     "detect-poison-and-disease",
     "guiding-bolt",
     "healing-word",
     "inflict-wounds",
     "protection-from-evil-and-good",
     "purify-food-and-drink",
     "sanctuary",
     "shield-of-faith"
    ],
    "2": [
     "aid",
     "augury",
     "blindness-deafness",
     "calm-emotions",
     "continual-flame",
     "enhance-ability",
     "find-traps",
     "gentle-repose",
     "hold-person",
     "lesser-restoration",
     "locate-object",
     "prayer-of-healing",
     "protection-from-poison",
     "silence",
     "spiritual-weapon",
     "warding-bond",
     "zone-of-truth"
    ],
    "3": [
     "animate-dead",
     "beacon-of-hope",
     "bestow-curse",
     "clairvoyance",
     "create-food-and-water",
     "daylight",
     "dispel-magic",
     "glyph-of-warding",
     "magic-circle",
     "mass-healing-word",
     "meld-into-stone",
     "protection-from-energy",
     "remove-curse",
     "revivify",
     "sending",
     "speak-with-dead",
     "spirit-guardians",
     "tongues",
     "water-walk"
    ],
    "4": [
     "aura-of-life",
     "banishment",
     "control-water",
     "death-ward",
     "divination",
     "freedom-of-movement",
     "guardian-of-faith",
     "locate-creature",
     "stone-shape"
    ],
    "5": [
     "commune",
     "contagion",
     "dispel-evil-and-good",
     "flame-strike",
     "geas",
     "greater-restoration",
     "hallow",
     "insect-plague",
     "legend-lore",
     "mass-cure-wounds",
     "planar-binding",
     "raise-dead",
     "scrying"
    ],
    "6": [
     "blade-barrier",
     "create-undead",
     "find-the-path",
     "forbiddance",
     "harm",
     "heal",
     "heroes-feast",
     "planar-ally",
     "sunbeam",
     "true-seeing",
     "word-of-recall"
    ],
    "7": [
     "conjure-celestial",
     "divine-word",
     "etherealness",
     "fire-storm",
     "plane-shift",
     "regenerate",
     "resurrection",
     "symbol"
    ],
    "8": [
     "antimagic-field",
     "control-weather",
     "earthquake",
     "holy-aura",
     "sunburst"
    ],
    "9": [
     "astral-projection",
     "gate",
     "mass-heal",
     "power-word-heal",
     "true-resurrection"
    ]
   },
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true
    },
    "armor": {
     "light": true,
     "medium": true,
     "shield": true
    },
    "tools": []
   },
   "choices": [
    {
     "id": "divineOrder",
     "level": 1,
     "label": "Divine Order",
     "type": "option",
     "options": [
      {
       "id": "protector",
       "name": "Protector",
       "description": "Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor.",
       "grants": {
        "martialWeapons": true,
        "heavyArmor": true
       }
      },
      {
       "id": "thaumaturge",
       "name": "Thaumaturge",
       "description": "You know one extra cantrip from the Cleric spell list. In addition, your mystical connection to the divine gives you a bonus to your Intelligence (Arcana or Religion) checks. The bonus equals your Wisdom modifier (minimum of +1).",
       "grants": {
        "extraCantrips": 1,
        "arcanaReligionWisBonus": true
       }
      }
     ]
    },
    {
     "id": "blessedStrikes",
     "level": 7,
     "label": "Blessed Strikes",
     "type": "option",
     "options": [
      {
       "id": "divine-strike",
       "name": "Divine Strike",
       "description": "Once on each of your turns when you hit a creature with an attack roll using a weapon, you can cause the target to take an extra 1d8 Necrotic or Radiant damage (your choice)."
      },
      {
       "id": "potent-spellcasting",
       "name": "Potent Spellcasting",
       "description": "Add your Wisdom modifier to the damage you deal with any Cleric cantrip."
      }
     ]
    }
   ],
   "spellcasting": {
    "ability": "wis",
    "focus": "Holy Symbol",
    "ritual": false,
    "type": "full"
   },
   "alwaysPrepared": {}
  },
  "druid": {
   "id": "druid",
   "name": "Druid",
   "primaryAbilityText": "Wisdom",
   "hitDie": 8,
   "fixedHpPerLevel": 5,
   "savingThrows": [
    "int",
    "wis"
   ],
   "skillChoices": {
    "count": 2,
    "from": [
     "animal-handling",
     "arcana",
     "insight",
     "medicine",
     "nature",
     "perception",
     "religion",
     "survival"
    ]
   },
   "casterType": "full",
   "weaponProficiencyText": "Simple weapons",
   "armorTrainingText": "Light armor and Shields",
   "toolProficiencyText": "Herbalism Kit",
   "equipmentText": "(A) Leather Armor, Shield, Sickle, Druidic Focus (Quarterstaff), Explorer's Pack, Herbalism Kit, and 9 GP; or (B) 50 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Leather Armor",
       "count": 1,
       "armorId": "leather-armor"
      },
      {
       "name": "Shield",
       "count": 1,
       "armorId": "shield"
      },
      {
       "name": "Sickle",
       "count": 1,
       "weaponId": "sickle"
      },
      {
       "name": "Druidic Focus (Quarterstaff)",
       "count": 1,
       "weaponId": "quarterstaff"
      },
      {
       "name": "Explorer's Pack",
       "count": 1
      },
      {
       "name": "Herbalism Kit",
       "count": 1
      }
     ],
     "gp": 9
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 50
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Spellcasting",
      "Druidic",
      "Primal Order"
     ],
     "wildShape": 0,
     "cantrips": 2,
     "preparedSpells": 4,
     "slots": [
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Wild Shape",
      "Wild Companion"
     ],
     "wildShape": 2,
     "cantrips": 2,
     "preparedSpells": 5,
     "slots": [
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Druid Subclass"
     ],
     "wildShape": 2,
     "cantrips": 2,
     "preparedSpells": 6,
     "slots": [
      4,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "wildShape": 2,
     "cantrips": 3,
     "preparedSpells": 7,
     "slots": [
      4,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Wild Resurgence"
     ],
     "wildShape": 2,
     "cantrips": 3,
     "preparedSpells": 9,
     "slots": [
      4,
      3,
      2,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Subclass feature"
     ],
     "wildShape": 3,
     "cantrips": 3,
     "preparedSpells": 10,
     "slots": [
      4,
      3,
      3,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [
      "Elemental Fury"
     ],
     "wildShape": 3,
     "cantrips": 3,
     "preparedSpells": 11,
     "slots": [
      4,
      3,
      3,
      1,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "wildShape": 3,
     "cantrips": 3,
     "preparedSpells": 12,
     "slots": [
      4,
      3,
      3,
      2,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [],
     "wildShape": 3,
     "cantrips": 3,
     "preparedSpells": 14,
     "slots": [
      4,
      3,
      3,
      3,
      1,
      0,
      0,
      0,
      0
     ]
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Subclass feature"
     ],
     "wildShape": 3,
     "cantrips": 4,
     "preparedSpells": 15,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      0,
      0,
      0,
      0
     ]
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [],
     "wildShape": 3,
     "cantrips": 4,
     "preparedSpells": 16,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      0,
      0,
      0
     ]
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "wildShape": 3,
     "cantrips": 4,
     "preparedSpells": 16,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      0,
      0,
      0
     ]
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [],
     "wildShape": 3,
     "cantrips": 4,
     "preparedSpells": 17,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      0,
      0
     ]
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Subclass feature"
     ],
     "wildShape": 3,
     "cantrips": 4,
     "preparedSpells": 17,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      0,
      0
     ]
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [
      "Improved Elemental Fury"
     ],
     "wildShape": 3,
     "cantrips": 4,
     "preparedSpells": 18,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      0
     ]
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "wildShape": 3,
     "cantrips": 4,
     "preparedSpells": 18,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      0
     ]
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [],
     "wildShape": 4,
     "cantrips": 4,
     "preparedSpells": 19,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      1
     ]
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [
      "Beast Spells"
     ],
     "wildShape": 4,
     "cantrips": 4,
     "preparedSpells": 20,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      1,
      1,
      1,
      1
     ]
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "wildShape": 4,
     "cantrips": 4,
     "preparedSpells": 21,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      2,
      1,
      1,
      1
     ]
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Archdruid"
     ],
     "wildShape": 4,
     "cantrips": 4,
     "preparedSpells": 22,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      2,
      2,
      1,
      1
     ]
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Spellcasting",
     "description": "You have learned to cast spells through studying the mystical forces of nature. See \"Spells\" for the rules on spellcasting. The information below details how you use those rules with Druid spells, which appear on the Druid spell list later in the class's description.\n\n_Cantrips._ You know two cantrips of your choice from the Druid spell list. _Druidcraft_ and _Produce Flame_ are recommended.\n\nWhenever you gain a Druid level, you can replace one of your cantrips with another cantrip of your choice from the Druid spell list.\n\nWhen you reach Druid levels 4 and 10, you learn another cantrip of your choice from the Druid spell list, as shown in the Cantrips column of the Druid Features table.\n\n_Spell Slots._ The Druid Features table shows how many spell slots you have to cast your level 1+ spells. You regain all expended slots when you finish a Long Rest.\n\n_Prepared Spells of Level 1+._ You prepare the list of level 1+ spells that are available for you to cast with this feature. To start, choose four level 1 spells from the Druid spell list. _Animal Friendship, Cure Wounds, Faerie Fire,_ and _Thunderwave_ are recommended.\n\nThe number of spells on your list increases as you gain Druid levels, as shown in the Prepared Spells column of the Druid Features table. Whenever that number increases, choose additional spells from the Druid spell list until the number of spells on your list matches the number on the table. The chosen spells must be of a level for which you have spell slots. For example, if you're a level 3 Druid, your list of prepared spells can include six spells of levels 1 and 2 in any combination.\n\nIf another Druid feature gives you spells that you always have prepared, those spells don't count against the number of spells you can prepare with this feature, but those spells otherwise count as Druid spells for you.\n\n_Changing Your Prepared Spells._ Whenever you finish a Long Rest, you can change your list of prepared spells, replacing any of the spells with other Druid spells for which you have spell slots.\n\n_Spellcasting Ability._ Wisdom is your spellcasting ability for your Druid spells.\n\n_Spellcasting Focus._ You can use a Druidic Focus as a Spellcasting Focus for your Druid spells."
    },
    {
     "level": 1,
     "name": "Druidic",
     "description": "You know Druidic, the secret language of Druids. While learning this ancient tongue, you also unlocked the magic of communicating with animals; you always have the _Speak with Animals_ spell prepared.\n\nYou can use Druidic to leave hidden messages. You and others who know Druidic automatically spot such a message. Others spot the message's presence with a successful DC 15 Intelligence (Investigation) check but can't decipher it without magic."
    },
    {
     "level": 1,
     "name": "Primal Order",
     "description": "You have dedicated yourself to one of the following sacred roles of your choice.\n\n_Magician._ You know one extra cantrip from the Druid spell list. In addition, your mystical connection to nature gives you a bonus to your Intelligence (Arcana or Nature) checks. The bonus equals your Wisdom modifier (minimum bonus of +1).\n\n_Warden._ Trained for battle, you gain proficiency with Martial weapons and training with Medium armor."
    },
    {
     "level": 2,
     "name": "Wild Shape",
     "description": "The power of nature allows you to assume the form of an animal. As a Bonus Action, you shape-shift into a Beast form that you have learned for this feature (see \"Known Forms\" below). You stay in that form for a number of hours equal to half your Druid level or until you use Wild Shape again, have the Incapacitated condition, or die. You can also leave the form early as a Bonus Action.\n\n_Number of Uses._ You can use Wild Shape twice. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest.\n\nYou gain additional uses when you reach certain Druid levels, as shown in the Wild Shape column of the Druid Features table.\n\n_Known Forms._ You know four Beast forms for this feature, chosen from among Beast stat blocks that have a maximum Challenge Rating of 1/4 and that lack a Fly Speed (see \"Animals\" in \"Monsters\" for stat block options). The **Rat**, **Riding Horse**, **Spider**, and **Wolf** are recommended. Whenever you finish a Long Rest, you can replace one of your known forms with another eligible form.\n\nWhen you reach certain Druid levels, your number of known forms and the maximum Challenge Rating for those forms increases, as shown in the Beast Shapes table. In addition, starting at level 8, you can adopt a form that has a Fly Speed.\n\nWhen choosing known forms, you may look in other sources for eligible Beasts if the Game Master permits you to do so.\n\n**Beast Shapes**\n\n_Druid Level — Known Forms — Max CR — Fly Speed_\n- 2 — 4 — 1/4 — No\n- 4 — 6 — 1/2 — No\n- 8 — 8 — 1 — Yes\n\n**Rules While Shape-Shifted.** While in a form, you retain your personality, memories, and ability to speak, and the following rules apply:\n\n**Temporary Hit Points.** When you assume a Wild Shape form, you gain a number of Temporary Hit Points equal to your Druid level.\n\n**Game Statistics.** Your game statistics are replaced by the Beast's stat block, but you retain your creature type; Hit Points; Hit Point Dice; Intelligence, Wisdom, and Charisma scores; class features; languages; and feats. You also retain your skill and saving throw proficiencies and use your Proficiency Bonus for them, in addition to gaining the proficiencies of the creature. If a skill or saving throw modifier in the Beast's stat block is higher than yours, use the one in the stat block.\n\n**No Spellcasting.** You can't cast spells, but shapeshifting doesn't break your Concentration or otherwise interfere with a spell you've already cast.\n\n**Objects.** Your ability to handle objects is determined by the form's limbs rather than your own. In addition, you choose whether your equipment falls in your space, merges into your new form, or is worn by it. Worn equipment functions as normal, but the GM decides whether it's practical for the new form to wear a piece of equipment based on the creature's size and shape. Your equipment doesn't change size or shape to match the new form, and any equipment that the new form can't wear must either fall to the ground or merge with the form. Equipment that merges with the form has no effect while you're in that form."
    },
    {
     "level": 2,
     "name": "Wild Companion",
     "description": "You can summon a nature spirit that assumes an animal form to aid you. As a Magic action, you can expend a spell slot or a use of Wild Shape to cast the _Find Familiar_ spell without Material components.\n\nWhen you cast the spell in this way, the familiar is Fey and disappears when you finish a Long Rest."
    },
    {
     "level": 3,
     "name": "Druid Subclass",
     "description": "You gain a Druid subclass of your choice. The Circle of the Land subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Druid levels. For the rest of your career, you gain each of your subclass's features that are of your Druid level or lower."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Druid levels 8, 12, and 16."
    },
    {
     "level": 5,
     "name": "Wild Resurgence",
     "description": "Once on each of your turns, if you have no uses of Wild Shape left, you can give yourself one use by expending a spell slot (no action required).\n\nIn addition, you can expend one use of Wild Shape (no action required) to give yourself a level 1 spell slot, but you can't do so again until you finish a Long Rest."
    },
    {
     "level": 7,
     "name": "Elemental Fury",
     "description": "The might of the elements flows through you. You gain one of the following options of your choice.\n\n_Potent Spellcasting._ Add your Wisdom modifier to the damage you deal with any Druid cantrip.\n\n_Primal Strike._ Once on each of your turns when you hit a creature with an attack roll using a weapon or a Beast form's attack in Wild Shape, you can cause the target to take an extra 1d8 Cold, Fire, Lightning, or Thunder damage (choose when you hit)."
    },
    {
     "level": 15,
     "name": "Improved Elemental Fury",
     "description": "The option you chose for Elemental Fury grows more powerful, as detailed below.\n\n_Potent Spellcasting._ When you cast a Druid cantrip with a range of 10 feet or greater, the spell's range increases by 300 feet.\n\n_Primal Strike._ The extra damage of your Primal Strike increases to 2d8."
    },
    {
     "level": 18,
     "name": "Beast Spells",
     "description": "While using Wild Shape, you can cast spells in Beast form, except for any spell that has a Material component with a cost specified or that consumes its Material component."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Dimensional Travel is recommended."
    },
    {
     "level": 20,
     "name": "Archdruid",
     "description": "The vitality of nature constantly blooms within you, granting you the following benefits.\n\n_Evergreen Wild Shape._ Whenever you roll Initiative and have no uses of Wild Shape left, you regain one expended use of it.\n\n_Nature Magician._ You can convert uses of Wild Shape into a spell slot (no action required). Choose a number of your unexpended uses of Wild Shape and convert them into a single spell slot, with each use contributing 2 spell levels. For example, if you convert two uses of Wild Shape, you produce a level 4 spell slot. Once you use this benefit, you can't do so again until you finish a Long Rest.\n\n_Longevity._ The primal magic that you wield causes you to age more slowly. For every ten years that pass, your body ages only one year."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "circle-of-the-land",
    "name": "Circle of the Land",
    "tagline": "Celebrate Connection to the Natural World",
    "description": "_Celebrate Connection to the Natural World_\n\nThe Circle of the Land comprises mystics and sages who safeguard ancient knowledge and rites. These Druids meet within sacred circles of trees or standing stones to whisper primal secrets in Druidic. The circle's wisest members preside as the chief priests of their communities.",
    "features": [
     {
      "level": 3,
      "name": "Circle of the Land Spells",
      "description": "Whenever you finish a Long Rest, choose one type of land: arid, polar, temperate, or tropical. Consult the table below that corresponds to the chosen type; you have the spells listed for your Druid level and lower prepared.\n\n**Arid Land**\n\n_Druid Level — Circle Spells_\n- 3 — Blur, Burning Hands, Fire Bolt\n- 5 — Fireball\n- 7 — Blight\n- 9 — Wall of Stone\n\n**Polar Land**\n\n_Druid Level — Circle Spells_\n- 3 — Fog Cloud, Hold Person, Ray of Frost\n- 5 — Sleet Storm\n- 7 — Ice Storm\n- 9 — Cone of Cold\n\n**Temperate Land**\n\n_Druid Level — Circle Spells_\n- 3 — Misty Step, Shocking Grasp, Sleep\n- 5 — Lightning Bolt\n- 7 — Freedom of Movement\n- 9 — Tree Stride\n\n**Tropical Land**\n\n_Druid Level — Circle Spells_\n- 3 — Acid Splash, Ray of Sickness, Web\n- 5 — Stinking Cloud\n- 7 — Polymorph\n- 9 — Insect Plague"
     },
     {
      "level": 3,
      "name": "Land's Aid",
      "description": "As a Magic action, you can expend a use of your Wild Shape and choose a point within 60 feet of yourself. Vitality-giving flowers and life-draining thorns appear for a moment in a 10-foot-radius Sphere centered on that point. Each creature of your choice in the Sphere must make a Constitution saving throw against your spell save DC, taking 2d6 Necrotic damage on a failed save or half as much damage on a successful one. One creature of your choice in that area regains 2d6 Hit Points.\n\nThe damage and healing increase by 1d6 when you reach Druid levels 10 (3d6) and 14 (4d6)."
     },
     {
      "level": 6,
      "name": "Natural Recovery",
      "description": "You can cast one of the level 1+ spells that you have prepared from your Circle Spells feature without expending a spell slot, and you must finish a Long Rest before you do so again.\n\nIn addition, when you finish a Short Rest, you can choose expended spell slots to recover. The spell slots can have a combined level that is equal to or less than half your Druid level (round up), and none of them can be level 6+. For example, if you're a level 6 Druid, you can recover up to three levels' worth of spell slots. You can recover a level 3 spell slot, a level 2 and a level 1 spell slot, or three level 1 spell slots. Once you recover spell slots with this feature, you can't do so again until you finish a Long Rest."
     },
     {
      "level": 10,
      "name": "Nature's Ward",
      "description": "You are immune to the Poisoned condition, and you have Resistance to a damage type associated with your current land choice in the Circle Spells feature, as shown in the Nature's Ward table.\n\n**Nature's Ward**\n\n_Land Type — Resistance — Land Type — Resistance_\n- Arid — Fire — Temperate — Lightning\n- Polar — Cold — Tropical — Poison"
     },
     {
      "level": 14,
      "name": "Nature's Sanctuary",
      "description": "As a Magic action, you can expend a use of your Wild Shape and cause spectral trees and vines to appear in a 15-foot Cube on the ground within 120 feet of yourself. They last there for 1 minute or until you have the Incapacitated condition or die. You and your allies have Half Cover while in that area, and your allies gain the current Resistance of your Nature's Ward while there.\n\nAs a Bonus Action, you can move the Cube up to 60 feet to ground within 120 feet of yourself."
     }
    ]
   },
   "spellList": {
    "0": [
     "druidcraft",
     "elementalism",
     "guidance",
     "mending",
     "message",
     "poison-spray",
     "produce-flame",
     "resistance",
     "shillelagh",
     "spare-the-dying",
     "starry-wisp"
    ],
    "1": [
     "animal-friendship",
     "charm-person",
     "create-or-destroy-water",
     "cure-wounds",
     "detect-magic",
     "detect-poison-and-disease",
     "entangle",
     "faerie-fire",
     "fog-cloud",
     "goodberry",
     "healing-word",
     "ice-knife",
     "jump",
     "longstrider",
     "protection-from-evil-and-good",
     "purify-food-and-drink",
     "speak-with-animals",
     "thunderwave"
    ],
    "2": [
     "aid",
     "animal-messenger",
     "augury",
     "barkskin",
     "continual-flame",
     "darkvision",
     "enhance-ability",
     "enlarge-reduce",
     "find-traps",
     "flame-blade",
     "flaming-sphere",
     "gust-of-wind",
     "heat-metal",
     "hold-person",
     "lesser-restoration",
     "locate-animals-or-plants",
     "locate-object",
     "moonbeam",
     "pass-without-trace",
     "protection-from-poison",
     "spike-growth"
    ],
    "3": [
     "call-lightning",
     "conjure-animals",
     "daylight",
     "dispel-magic",
     "meld-into-stone",
     "plant-growth",
     "protection-from-energy",
     "revivify",
     "sleet-storm",
     "speak-with-plants",
     "water-breathing",
     "water-walk",
     "wind-wall"
    ],
    "4": [
     "blight",
     "charm-monster",
     "confusion",
     "conjure-minor-elementals",
     "conjure-woodland-beings",
     "control-water",
     "divination",
     "dominate-beast",
     "fire-shield",
     "freedom-of-movement",
     "giant-insect",
     "hallucinatory-terrain",
     "ice-storm",
     "locate-creature",
     "polymorph",
     "stone-shape",
     "stoneskin",
     "wall-of-fire"
    ],
    "5": [
     "antilife-shell",
     "awaken",
     "commune-with-nature",
     "cone-of-cold",
     "conjure-elemental",
     "contagion",
     "geas",
     "greater-restoration",
     "insect-plague",
     "mass-cure-wounds",
     "planar-binding",
     "reincarnate",
     "scrying",
     "tree-stride",
     "wall-of-stone"
    ],
    "6": [
     "conjure-fey",
     "find-the-path",
     "flesh-to-stone",
     "heal",
     "heroes-feast",
     "move-earth",
     "sunbeam",
     "transport-via-plants",
     "wall-of-thorns",
     "wind-walk"
    ],
    "7": [
     "fire-storm",
     "mirage-arcane",
     "plane-shift",
     "regenerate",
     "reverse-gravity",
     "symbol"
    ],
    "8": [
     "animal-shapes",
     "antipathy-sympathy",
     "befuddlement",
     "control-weather",
     "earthquake",
     "incendiary-cloud",
     "sunburst",
     "tsunami"
    ],
    "9": [
     "foresight",
     "shapechange",
     "storm-of-vengeance",
     "true-resurrection"
    ]
   },
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true
    },
    "armor": {
     "light": true,
     "shield": true
    },
    "tools": [
     "Herbalism Kit"
    ]
   },
   "spellcasting": {
    "ability": "wis",
    "focus": "Druidic Focus",
    "ritual": false,
    "type": "full"
   },
   "knownLanguages": [
    "Druidic"
   ],
   "alwaysPrepared": {
    "1": [
     "speak-with-animals"
    ]
   },
   "choices": [
    {
     "id": "primalOrder",
     "level": 1,
     "label": "Primal Order",
     "type": "option",
     "options": [
      {
       "id": "magician",
       "name": "Magician",
       "description": "You know one extra cantrip from the Druid spell list. In addition, your mystical connection to nature gives you a bonus to your Intelligence (Arcana or Nature) checks. The bonus equals your Wisdom modifier (minimum bonus of +1).",
       "grants": {
        "extraCantrips": 1
       }
      },
      {
       "id": "warden",
       "name": "Warden",
       "description": "Trained for battle, you gain proficiency with Martial weapons and training with Medium armor.",
       "grants": {
        "martialWeapons": true,
        "mediumArmor": true
       }
      }
     ]
    },
    {
     "id": "elementalFury",
     "level": 7,
     "label": "Elemental Fury",
     "type": "option",
     "options": [
      {
       "id": "potent-spellcasting",
       "name": "Potent Spellcasting",
       "description": "Add your Wisdom modifier to the damage you deal with any Druid cantrip."
      },
      {
       "id": "primal-strike",
       "name": "Primal Strike",
       "description": "Once on each of your turns when you hit a creature with an attack roll using a weapon or a Beast form's attack in Wild Shape, you can cause the target to take an extra 1d8 Cold, Fire, Lightning, or Thunder damage (choose when you hit)."
      }
     ]
    },
    {
     "id": "landType",
     "level": 3,
     "subclass": true,
     "label": "Land type (Circle of the Land)",
     "type": "option",
     "note": "You can choose a different land type each time you finish a Long Rest.",
     "options": [
      {
       "id": "arid",
       "name": "Arid Land",
       "description": "Circle spells: level 3: blur, burning-hands, fire-bolt; level 5: fireball; level 7: blight; level 9: wall-of-stone",
       "alwaysPrepared": {
        "3": [
         "blur",
         "burning-hands",
         "fire-bolt"
        ],
        "5": [
         "fireball"
        ],
        "7": [
         "blight"
        ],
        "9": [
         "wall-of-stone"
        ]
       }
      },
      {
       "id": "polar",
       "name": "Polar Land",
       "description": "Circle spells: level 3: fog-cloud, hold-person, ray-of-frost; level 5: sleet-storm; level 7: ice-storm; level 9: cone-of-cold",
       "alwaysPrepared": {
        "3": [
         "fog-cloud",
         "hold-person",
         "ray-of-frost"
        ],
        "5": [
         "sleet-storm"
        ],
        "7": [
         "ice-storm"
        ],
        "9": [
         "cone-of-cold"
        ]
       }
      },
      {
       "id": "temperate",
       "name": "Temperate Land",
       "description": "Circle spells: level 3: misty-step, shocking-grasp, sleep; level 5: lightning-bolt; level 7: freedom-of-movement; level 9: tree-stride",
       "alwaysPrepared": {
        "3": [
         "misty-step",
         "shocking-grasp",
         "sleep"
        ],
        "5": [
         "lightning-bolt"
        ],
        "7": [
         "freedom-of-movement"
        ],
        "9": [
         "tree-stride"
        ]
       }
      },
      {
       "id": "tropical",
       "name": "Tropical Land",
       "description": "Circle spells: level 3: acid-splash, ray-of-sickness, web; level 5: stinking-cloud; level 7: polymorph; level 9: insect-plague",
       "alwaysPrepared": {
        "3": [
         "acid-splash",
         "ray-of-sickness",
         "web"
        ],
        "5": [
         "stinking-cloud"
        ],
        "7": [
         "polymorph"
        ],
        "9": [
         "insect-plague"
        ]
       }
      }
     ]
    }
   ]
  },
  "fighter": {
   "id": "fighter",
   "name": "Fighter",
   "primaryAbilityText": "Strength or Dexterity",
   "hitDie": 10,
   "fixedHpPerLevel": 6,
   "savingThrows": [
    "str",
    "con"
   ],
   "skillChoices": {
    "count": 2,
    "from": [
     "acrobatics",
     "animal-handling",
     "athletics",
     "history",
     "insight",
     "intimidation",
     "persuasion",
     "perception",
     "survival"
    ]
   },
   "casterType": null,
   "weaponProficiencyText": "Simple and Martial weapons",
   "armorTrainingText": "Light, Medium, and Heavy armor and Shields",
   "toolProficiencyText": null,
   "equipmentText": "(A) Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer's Pack, and 4 GP; (B) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Dungeoneer's Pack, and 11 GP; or (C) 155 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Chain Mail",
       "count": 1,
       "armorId": "chain-mail"
      },
      {
       "name": "Greatsword",
       "count": 1,
       "weaponId": "greatsword"
      },
      {
       "name": "Flail",
       "count": 1,
       "weaponId": "flail"
      },
      {
       "name": "Javelins",
       "count": 8,
       "weaponId": "javelin"
      },
      {
       "name": "Dungeoneer's Pack",
       "count": 1
      }
     ],
     "gp": 4
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [
      {
       "name": "Studded Leather Armor",
       "count": 1,
       "armorId": "studded-leather-armor"
      },
      {
       "name": "Scimitar",
       "count": 1,
       "weaponId": "scimitar"
      },
      {
       "name": "Shortsword",
       "count": 1,
       "weaponId": "shortsword"
      },
      {
       "name": "Longbow",
       "count": 1,
       "weaponId": "longbow"
      },
      {
       "name": "Arrows",
       "count": 20
      },
      {
       "name": "Quiver",
       "count": 1
      },
      {
       "name": "Dungeoneer's Pack",
       "count": 1
      }
     ],
     "gp": 11
    },
    {
     "id": "C",
     "label": "Option C",
     "items": [],
     "gp": 155
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Fighting Style",
      "Second Wind",
      "Weapon Mastery"
     ],
     "secondWind": 2,
     "weaponMastery": 3
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Action Surge (one use)",
      "Tactical Mind"
     ],
     "secondWind": 2,
     "weaponMastery": 3
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Fighter Subclass"
     ],
     "secondWind": 2,
     "weaponMastery": 3
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "secondWind": 3,
     "weaponMastery": 4
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Extra Attack",
      "Tactical Shift"
     ],
     "secondWind": 3,
     "weaponMastery": 4
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "secondWind": 3,
     "weaponMastery": 4
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [
      "Subclass feature"
     ],
     "secondWind": 3,
     "weaponMastery": 4
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "secondWind": 3,
     "weaponMastery": 4
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [
      "Indomitable (one use)",
      "Tactical Master"
     ],
     "secondWind": 3,
     "weaponMastery": 4
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Subclass feature"
     ],
     "secondWind": 4,
     "weaponMastery": 5
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [
      "Two Extra Attacks"
     ],
     "secondWind": 4,
     "weaponMastery": 5
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "secondWind": 4,
     "weaponMastery": 5
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [
      "Indomitable (two uses)",
      "Studied Attacks"
     ],
     "secondWind": 4,
     "weaponMastery": 5
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "secondWind": 4,
     "weaponMastery": 5
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [
      "Subclass feature"
     ],
     "secondWind": 4,
     "weaponMastery": 5
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "secondWind": 4,
     "weaponMastery": 6
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [
      "Action Surge (two uses)",
      "Indomitable (three uses)"
     ],
     "secondWind": 4,
     "weaponMastery": 6
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [
      "Subclass feature"
     ],
     "secondWind": 4,
     "weaponMastery": 6
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "secondWind": 4,
     "weaponMastery": 6
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Three Extra Attacks"
     ],
     "secondWind": 4,
     "weaponMastery": 6
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Fighting Style",
     "description": "You have honed your martial prowess and gain a Fighting Style feat of your choice (see \"Feats\"). Defense is recommended.\n\nWhenever you gain a Fighter level, you can replace the feat you chose with a different Fighting Style feat."
    },
    {
     "level": 1,
     "name": "Second Wind",
     "description": "You have a limited well of physical and mental stamina that you can draw on. As a Bonus Action, you can use it to regain Hit Points equal to 1d10 plus your Fighter level.\n\nYou can use this feature twice. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest.\n\nWhen you reach certain Fighter levels, you gain more uses of this feature, as shown in the Second Wind column of the Fighter Features table."
    },
    {
     "level": 1,
     "name": "Weapon Mastery",
     "description": "Your training with weapons allows you to use the mastery properties of three kinds of Simple or Martial weapons of your choice. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices.\n\nWhen you reach certain Fighter levels, you gain the ability to use the mastery properties of more kinds of weapons, as shown in the Weapon Mastery column of the Fighter Features table."
    },
    {
     "level": 2,
     "name": "Action Surge",
     "description": "You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action, except the Magic action.\n\nOnce you use this feature, you can't do so again until you finish a Short or Long Rest. Starting at level 17, you can use it twice before a rest but only once on a turn."
    },
    {
     "level": 2,
     "name": "Tactical Mind",
     "description": "You have a mind for tactics on and off the battlefield. When you fail an ability check, you can expend a use of your Second Wind to push yourself toward success. Rather than regaining Hit Points, you roll 1d10 and add the number rolled to the ability check, potentially turning it into a success. If the check still fails, this use of Second Wind isn't expended."
    },
    {
     "level": 3,
     "name": "Fighter Subclass",
     "description": "You gain a Fighter subclass of your choice. The Champion subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Fighter levels. For the rest of your career, you gain each of your subclass's features that are of your Fighter level or lower."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Fighter levels 6, 8, 12, 14, and 16."
    },
    {
     "level": 5,
     "name": "Extra Attack",
     "description": "You can attack twice instead of once whenever you take the Attack action on your turn."
    },
    {
     "level": 5,
     "name": "Tactical Shift",
     "description": "Whenever you activate your Second Wind with a Bonus Action, you can move up to half your Speed without provoking Opportunity Attacks."
    },
    {
     "level": 9,
     "name": "Indomitable",
     "description": "If you fail a saving throw, you can reroll it with a bonus equal to your Fighter level. You must use the new roll, and you can't use this feature again until you finish a Long Rest.\n\nYou can use this feature twice before a Long Rest starting at level 13 and three times before a Long Rest starting at level 17."
    },
    {
     "level": 9,
     "name": "Tactical Master",
     "description": "When you attack with a weapon whose mastery property you can use, you can replace that property with the Push, Sap, or Slow property for that attack."
    },
    {
     "level": 11,
     "name": "Two Extra Attacks",
     "description": "You can attack three times instead of once whenever you take the Attack action on your turn."
    },
    {
     "level": 13,
     "name": "Studied Attacks",
     "description": "You study your opponents and learn from each attack you make. If you make an attack roll against a creature and miss, you have Advantage on your next attack roll against that creature before the end of your next turn."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Combat Prowess is recommended."
    },
    {
     "level": 20,
     "name": "Three Extra Attacks",
     "description": "You can attack four times instead of once whenever you take the Attack action on your turn."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "champion",
    "name": "Champion",
    "tagline": "Pursue Physical Excellence in Combat",
    "description": "_Pursue Physical Excellence in Combat_\n\nA Champion focuses on the development of martial prowess in a relentless pursuit of victory. Champions combine rigorous training with physical excellence to deal devastating blows, withstand peril, and garner glory. Whether in athletic contests or bloody battle, Champions strive for the crown of the victor.",
    "features": [
     {
      "level": 3,
      "name": "Improved Critical",
      "description": "Your attack rolls with weapons and Unarmed Strikes can score a Critical Hit on a roll of 19 or 20 on the d20."
     },
     {
      "level": 3,
      "name": "Remarkable Athlete",
      "description": "Thanks to your athleticism, you have Advantage on Initiative rolls and Strength (Athletics) checks.\n\nIn addition, immediately after you score a Critical Hit, you can move up to half your Speed without provoking Opportunity Attacks."
     },
     {
      "level": 7,
      "name": "Additional Fighting Style",
      "description": "You gain another Fighting Style feat of your choice."
     },
     {
      "level": 10,
      "name": "Heroic Warrior",
      "description": "The thrill of battle drives you toward victory. During combat, you can give yourself Heroic Inspiration whenever you start your turn without it."
     },
     {
      "level": 15,
      "name": "Superior Critical",
      "description": "Your attack rolls with weapons and Unarmed Strikes can now score a Critical Hit on a roll of 18–20 on the d20."
     },
     {
      "level": 18,
      "name": "Survivor",
      "description": "You attain the pinnacle of resilience in battle, giving you these benefits.\n\n_Defy Death._ You have Advantage on Death Saving Throws. Moreover, when you roll 18–20 on a Death Saving Throw, you gain the benefit of rolling a 20 on it.\n\n_Heroic Rally._ At the start of each of your turns, you regain Hit Points equal to 5 plus your Constitution modifier if you are Bloodied and have at least 1 Hit Point."
     }
    ],
    "initiativeAdvantage": {
     "level": 3,
     "source": "Remarkable Athlete"
    }
   },
   "spellList": null,
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 6,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 14,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true,
     "martial": true
    },
    "armor": {
     "light": true,
     "medium": true,
     "heavy": true,
     "shield": true
    },
    "tools": []
   },
   "choices": [
    {
     "id": "fightingStyle",
     "level": 1,
     "label": "Fighting Style",
     "type": "feat",
     "featCategory": "fighting-style"
    },
    {
     "id": "additionalFightingStyle",
     "level": 7,
     "subclass": true,
     "label": "Additional Fighting Style",
     "type": "feat",
     "featCategory": "fighting-style"
    }
   ],
   "weaponMastery": {
    "column": "weaponMastery",
    "eligible": "simple-or-martial"
   },
   "critRange": {
    "3": 19,
    "15": 18
   },
   "alwaysPrepared": {}
  },
  "monk": {
   "id": "monk",
   "name": "Monk",
   "primaryAbilityText": "Dexterity and Wisdom",
   "hitDie": 8,
   "fixedHpPerLevel": 5,
   "savingThrows": [
    "str",
    "dex"
   ],
   "skillChoices": {
    "count": 2,
    "from": [
     "acrobatics",
     "athletics",
     "history",
     "insight",
     "religion",
     "stealth"
    ]
   },
   "casterType": null,
   "weaponProficiencyText": "Simple weapons and Martial weapons that have the Light property",
   "armorTrainingText": "None",
   "toolProficiencyText": "Choose one type of Artisan's Tools or Musical Instrument (see Equipment)",
   "equipmentText": "(A) Spear, 5 Daggers, Artisan's Tools or Musical Instrument chosen for the tool proficiency above, Explorer's Pack, and 11 GP; or (B) 50 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Spear",
       "count": 1,
       "weaponId": "spear"
      },
      {
       "name": "Daggers",
       "count": 5,
       "weaponId": "dagger"
      },
      {
       "name": "Artisan's Tools or Musical Instrument chosen for the tool proficiency above",
       "count": 1
      },
      {
       "name": "Explorer's Pack",
       "count": 1
      }
     ],
     "gp": 11
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 50
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Martial Arts",
      "Unarmored Defense"
     ],
     "martialArts": "1d6",
     "focusPoints": 0,
     "unarmoredMovement": 0
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Monk's Focus",
      "Unarmored Movement",
      "Uncanny Metabolism"
     ],
     "martialArts": "1d6",
     "focusPoints": 2,
     "unarmoredMovement": 10
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Deflect Attacks",
      "Monk Subclass"
     ],
     "martialArts": "1d6",
     "focusPoints": 3,
     "unarmoredMovement": 10
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement",
      "Slow Fall"
     ],
     "martialArts": "1d6",
     "focusPoints": 4,
     "unarmoredMovement": 10
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Extra Attack",
      "Stunning Strike"
     ],
     "martialArts": "1d8",
     "focusPoints": 5,
     "unarmoredMovement": 10
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Empowered Strikes",
      "Subclass feature"
     ],
     "martialArts": "1d8",
     "focusPoints": 6,
     "unarmoredMovement": 15
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [
      "Evasion"
     ],
     "martialArts": "1d8",
     "focusPoints": 7,
     "unarmoredMovement": 15
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "martialArts": "1d8",
     "focusPoints": 8,
     "unarmoredMovement": 15
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [
      "Acrobatic Movement"
     ],
     "martialArts": "1d8",
     "focusPoints": 9,
     "unarmoredMovement": 15
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Heightened Focus",
      "Self-Restoration"
     ],
     "martialArts": "1d8",
     "focusPoints": 10,
     "unarmoredMovement": 20
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [
      "Subclass feature"
     ],
     "martialArts": "1d10",
     "focusPoints": 11,
     "unarmoredMovement": 20
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "martialArts": "1d10",
     "focusPoints": 12,
     "unarmoredMovement": 20
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [
      "Deflect Energy"
     ],
     "martialArts": "1d10",
     "focusPoints": 13,
     "unarmoredMovement": 20
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Disciplined Survivor"
     ],
     "martialArts": "1d10",
     "focusPoints": 14,
     "unarmoredMovement": 25
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [
      "Perfect Focus"
     ],
     "martialArts": "1d10",
     "focusPoints": 15,
     "unarmoredMovement": 25
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "martialArts": "1d10",
     "focusPoints": 16,
     "unarmoredMovement": 25
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [
      "Subclass feature"
     ],
     "martialArts": "1d12",
     "focusPoints": 17,
     "unarmoredMovement": 25
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [
      "Superior Defense"
     ],
     "martialArts": "1d12",
     "focusPoints": 18,
     "unarmoredMovement": 30
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "martialArts": "1d12",
     "focusPoints": 19,
     "unarmoredMovement": 30
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Body and Mind"
     ],
     "martialArts": "1d12",
     "focusPoints": 20,
     "unarmoredMovement": 30
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Martial Arts",
     "description": "Your practice of martial arts gives you mastery of combat styles that use your Unarmed Strike and Monk weapons, which are the following:\n\n- Simple Melee weapons\n- Martial Melee weapons that have the Light property\n\nYou gain the following benefits while you are unarmed or wielding only Monk weapons and you aren't wearing armor or wielding a Shield.\n\n_Bonus Unarmed Strike._ You can make an Unarmed Strike as a Bonus Action.\n\n_Martial Arts Die._ You can roll 1d6 in place of the normal damage of your Unarmed Strike or Monk weapons. This die changes as you gain Monk levels, as shown in the Martial Arts column of the Monk Features table.\n\n_Dexterous Attacks._ You can use your Dexterity modifier instead of your Strength modifier for the attack and damage rolls of your Unarmed Strikes and Monk weapons. In addition, when you use the Grapple or Shove option of your Unarmed Strike, you can use your Dexterity modifier instead of your Strength modifier to determine the save DC."
    },
    {
     "level": 1,
     "name": "Unarmored Defense",
     "description": "While you aren't wearing armor or wielding a Shield, your base Armor Class equals 10 plus your Dexterity and Wisdom modifiers."
    },
    {
     "level": 2,
     "name": "Monk's Focus",
     "description": "Your focus and martial training allow you to harness a well of extraordinary energy within yourself. This energy is represented by Focus Points. Your Monk level determines the number of points you have, as shown in the Focus Points column of the Monk Features table.\n\nYou can expend these points to enhance or fuel certain Monk features. You start knowing three such features: Flurry of Blows, Patient Defense, and Step of the Wind, each of which is detailed below.\n\nWhen you expend a Focus Point, it is unavailable until you finish a Short or Long Rest, at the end of which you regain all your expended points.\n\nSome features that use Focus Points require your target to make a saving throw. The save DC equals 8 plus your Wisdom modifier and Proficiency Bonus.\n\n**_Flurry of Blows._** You can expend 1 Focus Point to make two Unarmed Strikes as a Bonus Action.\n\n**_Patient Defense._** You can take the Disengage action as a Bonus Action. Alternatively, you can\nexpend 1 Focus Point to take both the Disengage and the Dodge actions as a Bonus Action.\n\n**_Step of the Wind._** You can take the Dash action as a Bonus Action. Alternatively, you can expend 1 Focus Point to take both the Disengage and Dash actions as a Bonus Action, and your jump distance is doubled for the turn."
    },
    {
     "level": 2,
     "name": "Unarmored Movement",
     "description": "Your speed increases by 10 feet while you aren't wearing armor or wielding a Shield. This bonus increases when you reach certain Monk levels, as shown on the Monk Features table."
    },
    {
     "level": 2,
     "name": "Uncanny Metabolism",
     "description": "When you roll Initiative, you can regain all expended Focus Points. When you do so, roll your Martial Arts die, and regain a number of Hit Points equal to your Monk level plus the number rolled.\n\nOnce you use this feature, you can't use it again until you finish a Long Rest."
    },
    {
     "level": 3,
     "name": "Deflect Attacks",
     "description": "When an attack roll hits you and its damage includes Bludgeoning, Piercing, or Slashing damage, you can take a Reaction to reduce the attack's total damage against you. The reduction equals 1d10 plus your Dexterity modifier and Monk level.\n\nIf you reduce the damage to 0, you can expend 1 Focus Point to redirect some of the attack's force. If you do so, choose a creature you can see within 5 feet of yourself if the attack was a melee attack or a creature you can see within 60 feet of yourself that isn't behind Total Cover if the attack was a ranged attack. That creature must succeed on a Dexterity saving throw or take damage equal to two rolls of your Martial Arts die plus your Dexterity modifier. The damage is the same type dealt by the attack."
    },
    {
     "level": 3,
     "name": "Monk Subclass",
     "description": "You gain a Monk subclass of your choice. The Warrior of the Open Hand subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Monk levels. For the rest of your career, you gain each of your subclass's features that are of your Monk level or lower."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Monk levels 8, 12, and 16."
    },
    {
     "level": 4,
     "name": "Slow Fall",
     "description": "You can take a Reaction when you fall to reduce any damage you take from the fall by an amount equal to five times your Monk level."
    },
    {
     "level": 5,
     "name": "Extra Attack",
     "description": "You can attack twice instead of once whenever you take the Attack action on your turn."
    },
    {
     "level": 5,
     "name": "Stunning Strike",
     "description": "Once per turn when you hit a creature with a Monk weapon or an Unarmed Strike, you can expend 1 Focus Point to attempt a stunning strike. The target must make a Constitution saving throw. On a failed save, the target has the Stunned condition until the start of your next turn. On a successful save, the target's Speed is halved until the start of your next turn, and the next attack roll made against the target before then has Advantage."
    },
    {
     "level": 6,
     "name": "Empowered Strikes",
     "description": "Whenever you deal damage with your Unarmed Strike, it can deal your choice of Force damage or its normal damage type."
    },
    {
     "level": 7,
     "name": "Evasion",
     "description": "When you're subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw and only half damage if you fail.\n\nYou don't benefit from this feature if you have the Incapacitated condition."
    },
    {
     "level": 9,
     "name": "Acrobatic Movement",
     "description": "While you aren't wearing armor or wielding a Shield, you gain the ability to move along vertical surfaces and across liquids on your turn without falling during the movement."
    },
    {
     "level": 10,
     "name": "Heightened Focus",
     "description": "Your Flurry of Blows, Patient Defense, and Step of the Wind gain the following benefits.\n\n**_Flurry of Blows._** You can expend 1 Focus Point to use Flurry of Blows and make three Unarmed Strikes with it instead of two.\n\n**_Patient Defense._** When you expend a Focus Point to use Patient Defense, you gain a number of Temporary Hit Points equal to two rolls of your Martial Arts die.\n\n**_Step of the Wind._** When you expend a Focus Point to use Step of the Wind, you can choose a willing creature within 5 feet of yourself that is Large or smaller. You move the creature with you until the end of your turn. The creature's movement doesn't provoke Opportunity Attacks."
    },
    {
     "level": 10,
     "name": "Self-Restoration",
     "description": "Through sheer force of will, you can remove one of the following conditions from yourself at the end of each of your turns: Charmed, Frightened, or Poisoned.\n\nIn addition, forgoing food and drink doesn't give you levels of Exhaustion."
    },
    {
     "level": 13,
     "name": "Deflect Energy",
     "description": "You can now use your Deflect Attacks feature against attacks that deal any damage type, not just Bludgeoning, Piercing, or Slashing."
    },
    {
     "level": 14,
     "name": "Disciplined Survivor",
     "description": "Your physical and mental discipline grant you proficiency in all saving throws.\n\nAdditionally, whenever you make a saving throw and fail, you can expend 1 Focus Point to reroll it, and you must use the new roll."
    },
    {
     "level": 15,
     "name": "Perfect Focus",
     "description": "When you roll Initiative and don't use Uncanny Metabolism, you regain expended Focus Points until you have 4 if you have 3 or fewer."
    },
    {
     "level": 18,
     "name": "Superior Defense",
     "description": "At the start of your turn, you can expend 3 Focus Points to bolster yourself against harm for 1 minute or until you have the Incapacitated condition. During that time, you have Resistance to all damage except Force damage."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Irresistible Offense is recommended."
    },
    {
     "level": 20,
     "name": "Body and Mind",
     "description": "You have developed your body and mind to new heights. Your Dexterity and Wisdom scores increase by 4, to a maximum of 25."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "warrior-of-the-open-hand",
    "name": "Warrior of the Open Hand",
    "tagline": "Master Unarmed Combat Techniques",
    "description": "_Master Unarmed Combat Techniques_\n\nWarriors of the Open Hand are masters of unarmed combat. They learn techniques to push and trip their opponents and manipulate their own energy to protect themselves from harm.",
    "features": [
     {
      "level": 3,
      "name": "Open Hand Technique",
      "description": "Whenever you hit a creature with an attack granted by your Flurry of Blows, you can impose one of the following effects on that target.\n\n**Addle.** The target can't make Opportunity Attacks until the start of its next turn.\n\n**Push.** The target must succeed on a Strength saving throw or be pushed up to 15 feet away from you.\n\n**Topple.** The target must succeed on a Dexterity saving throw or have the Prone condition."
     },
     {
      "level": 6,
      "name": "Wholeness of Body",
      "description": "You gain the ability to heal yourself. As a Bonus Action, you can roll your Martial Arts die. You regain a number of Hit Points equal to the number rolled plus your Wisdom modifier (minimum of 1 Hit Point regained).\n\nYou can use this feature a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest."
     },
     {
      "level": 11,
      "name": "Fleet Step",
      "description": "When you take a Bonus Action other than Step of the Wind, you can also use Step of the Wind immediately after that Bonus Action."
     },
     {
      "level": 17,
      "name": "Quivering Palm",
      "description": "You gain the ability to set up lethal vibrations in someone's body. When you hit a creature with an Unarmed Strike, you can expend 4 Focus Points to start these imperceptible vibrations, which last for a number of days equal to your Monk level. The vibrations are harmless unless you take an action to end them. Alternatively, when you take the Attack action on your turn, you can forgo one of the attacks to end the vibrations. To end them, you and the target must be on the same plane of existence. When you end them, the target must make a Constitution saving throw, taking 10d12 Force damage on a failed save or half as much damage on a successful one.\n\nYou can have only one creature under the effect of this feature at a time. You can end the vibrations harmlessly (no action required)."
     }
    ]
   },
   "spellList": null,
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true,
     "martialLight": true
    },
    "armor": {},
    "tools": []
   },
   "martialArts": {
    "column": "martialArts",
    "weapons": "simple-melee-or-martial-light-melee",
    "requiresNoArmorNoShield": true
   },
   "unarmoredDefense": {
    "ability": "wis",
    "shield": false
   },
   "speedBonus": {
    "column": "unarmoredMovement",
    "unless": "armor-or-shield",
    "source": "Unarmored Movement"
   },
   "allSavesAt": 14,
   "capstoneIncrease": {
    "level": 20,
    "abilities": [
     "dex",
     "wis"
    ],
    "amount": 4,
    "max": 25,
    "source": "Body and Mind"
   },
   "choices": [
    {
     "id": "monkTool",
     "level": 1,
     "label": "Artisan's Tools or Musical Instrument",
     "type": "tools",
     "count": 1,
     "families": [
      "artisan",
      "musical-instrument"
     ]
    }
   ],
   "alwaysPrepared": {}
  },
  "paladin": {
   "id": "paladin",
   "name": "Paladin",
   "primaryAbilityText": "Strength and Charisma",
   "hitDie": 10,
   "fixedHpPerLevel": 6,
   "savingThrows": [
    "wis",
    "cha"
   ],
   "skillChoices": {
    "count": 2,
    "from": [
     "athletics",
     "insight",
     "intimidation",
     "medicine",
     "persuasion",
     "religion"
    ]
   },
   "casterType": "half",
   "weaponProficiencyText": "Simple and Martial weapons",
   "armorTrainingText": "Light, Medium, and Heavy armor and Shields",
   "toolProficiencyText": null,
   "equipmentText": "(A) Chain Mail, Shield, Longsword, 6 Javelins, Holy Symbol, Priest's Pack, and 9 GP; or (B) 150 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Chain Mail",
       "count": 1,
       "armorId": "chain-mail"
      },
      {
       "name": "Shield",
       "count": 1,
       "armorId": "shield"
      },
      {
       "name": "Longsword",
       "count": 1,
       "weaponId": "longsword"
      },
      {
       "name": "Javelins",
       "count": 6,
       "weaponId": "javelin"
      },
      {
       "name": "Holy Symbol",
       "count": 1
      },
      {
       "name": "Priest's Pack",
       "count": 1
      }
     ],
     "gp": 9
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 150
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Lay On Hands",
      "Spellcasting",
      "Weapon Mastery"
     ],
     "channelDivinity": 0,
     "preparedSpells": 2,
     "slots": [
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Fighting Style",
      "Paladin's Smite"
     ],
     "channelDivinity": 0,
     "preparedSpells": 3,
     "slots": [
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Channel Divinity",
      "Paladin Subclass"
     ],
     "channelDivinity": 2,
     "preparedSpells": 4,
     "slots": [
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "channelDivinity": 2,
     "preparedSpells": 5,
     "slots": [
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Extra Attack",
      "Faithful Steed"
     ],
     "channelDivinity": 2,
     "preparedSpells": 6,
     "slots": [
      4,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Aura of Protection"
     ],
     "channelDivinity": 2,
     "preparedSpells": 6,
     "slots": [
      4,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [
      "Subclass feature"
     ],
     "channelDivinity": 2,
     "preparedSpells": 7,
     "slots": [
      4,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "channelDivinity": 2,
     "preparedSpells": 7,
     "slots": [
      4,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [
      "Abjure Foes"
     ],
     "channelDivinity": 2,
     "preparedSpells": 9,
     "slots": [
      4,
      3,
      2,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Aura of Courage"
     ],
     "channelDivinity": 2,
     "preparedSpells": 9,
     "slots": [
      4,
      3,
      2,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [
      "Radiant Strikes"
     ],
     "channelDivinity": 3,
     "preparedSpells": 10,
     "slots": [
      4,
      3,
      3,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "channelDivinity": 3,
     "preparedSpells": 10,
     "slots": [
      4,
      3,
      3,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [],
     "channelDivinity": 3,
     "preparedSpells": 11,
     "slots": [
      4,
      3,
      3,
      1,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Restoring Touch"
     ],
     "channelDivinity": 3,
     "preparedSpells": 11,
     "slots": [
      4,
      3,
      3,
      1,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [
      "Subclass feature"
     ],
     "channelDivinity": 3,
     "preparedSpells": 12,
     "slots": [
      4,
      3,
      3,
      2,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "channelDivinity": 3,
     "preparedSpells": 12,
     "slots": [
      4,
      3,
      3,
      2,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [],
     "channelDivinity": 3,
     "preparedSpells": 14,
     "slots": [
      4,
      3,
      3,
      3,
      1,
      0,
      0,
      0,
      0
     ]
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [
      "Aura Expansion"
     ],
     "channelDivinity": 3,
     "preparedSpells": 14,
     "slots": [
      4,
      3,
      3,
      3,
      1,
      0,
      0,
      0,
      0
     ]
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "channelDivinity": 3,
     "preparedSpells": 15,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      0,
      0,
      0,
      0
     ]
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Subclass feature"
     ],
     "channelDivinity": 3,
     "preparedSpells": 15,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      0,
      0,
      0,
      0
     ]
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Lay On Hands",
     "description": "Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you finish a Long Rest. With that pool, you can restore a total number of Hit Points equal to five times your Paladin level.\n\nAs a Bonus Action, you can touch a creature (which could be yourself) and draw power from the pool of healing to restore a number of Hit Points to that creature, up to the maximum amount remaining in the pool.\n\nYou can also expend 5 Hit Points from the pool of healing power to remove the Poisoned condition from the creature; those points don't also restore Hit Points to the creature."
    },
    {
     "level": 1,
     "name": "Spellcasting",
     "description": "You have learned to cast spells through prayer and meditation. See \"Spells\" for the rules on spellcasting. The information below details how you use those rules with Paladin spells, which appear in the Paladin spell list later in the class's description.\n\n**Spell Slots.** The Paladin Features table shows how many spell slots you have to cast your level 1+ spells. You regain all expended slots when you finish a Long Rest.\n\n**Prepared Spells of Level 1+.** You prepare the list of level 1+ spells that are available for you to cast with this feature. To start, choose two level 1 Paladin spells. _Heroism_ and _Searing Smite_ are recommended.\n\nThe number of spells on your list increases as you gain Paladin levels, as shown in the Prepared Spells column of the Paladin Features table. Whenever that number increases, choose additional Paladin spells until the number of spells on your list matches the number in the Paladin Features table. The chosen spells must be of a level for which you have spell slots. For example, if you're a level 5 Paladin, your list of prepared spells can include six Paladin spells of level 1 or 2 in any combination.\n\nIf another Paladin feature gives you spells that you always have prepared, those spells don't count against the number of spells you can prepare with this feature, but those spells otherwise count as Paladin spells for you.\n\n**Changing Your Prepared Spells.** Whenever you finish a Long Rest, you can replace one spell on your list with another Paladin spell for which you have spell slots.\n\n**Spellcasting Ability.** Charisma is your spellcasting ability for your Paladin spells.\n\n**Spellcasting Focus.** You can use a Holy Symbol as a Spellcasting Focus for your Paladin spells."
    },
    {
     "level": 1,
     "name": "Weapon Mastery",
     "description": "Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Longswords and Javelins.\n\nWhenever you finish a Long Rest, you can change the kinds of weapons you chose. For example, you could switch to using the mastery properties of Halberds and Flails."
    },
    {
     "level": 2,
     "name": "Fighting Style",
     "description": "You gain a Fighting Style feat of your choice (see \"Feats\" for feats). Instead of choosing one of those feats, you can choose the option below.\n\n**Blessed Warrior.** You learn two Cleric cantrips of your choice (see the Cleric class's section for a list of Cleric spells). _Guidance_ and _Sacred Flame_ are recommended. The chosen cantrips count as Paladin spells for you, and Charisma is your spellcasting ability for them. Whenever you gain a Paladin level, you can replace one of these cantrips with another Cleric cantrip."
    },
    {
     "level": 2,
     "name": "Paladin's Smite",
     "description": "You always have the _Divine Smite_ spell prepared. In addition, you can cast it without expending a spell slot, but you must finish a Long Rest before you can cast it in this way again."
    },
    {
     "level": 3,
     "name": "Channel Divinity",
     "description": "You can channel divine energy directly from the Outer Planes, using it to fuel magical effects. You start with one such effect: Divine Sense, which is described below. Other Paladin features give additional Channel Divinity effect options. Each time you use this class's Channel Divinity, you choose which effect from this class to create.\n\nYou can use this class's Channel Divinity twice. You regain one of its expended uses when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest. You gain an additional use when you reach Paladin level 11.\n\n> ### Breaking Your Oath\n>\n> A Paladin tries to hold to the highest standards of conduct, but even the most dedicated are fallible. Sometimes a Paladin transgresses their oath.\n>\n> A Paladin who has broken a vow typically seeks absolution, spending an all-night vigil as a sign of penitence or undertaking a fast. After a rite of forgiveness, the Paladin starts fresh.\n>\n> If your Paladin unrepentantly violates their oath, talk to your GM. Your Paladin should probably take a more appropriate subclass or even abandon the class and adopt another one.\n> If a Channel Divinity effect requires a saving throw, the DC equals the spell save DC from this class's Spellcasting feature.\n\n_Divine Sense._ As a Bonus Action, you can open your awareness to detect Celestials, Fiends, and Undead. For the next 10 minutes or until you have the Incapacitated condition, you know the location of any creature of those types within 60 feet of yourself, and you know its creature type. Within the same radius, you also detect the presence of any place or object that has been consecrated or desecrated, as with the _Hallow_ spell."
    },
    {
     "level": 3,
     "name": "Paladin Subclass",
     "description": "You gain a Paladin subclass of your choice. The Oath of Devotion subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Paladin levels. For the rest of your career, you gain each of your subclass's features that are of your Paladin level or lower."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Paladin levels 8, 12, and 16."
    },
    {
     "level": 5,
     "name": "Extra Attack",
     "description": "You can attack twice instead of once whenever you take the Attack action on your turn."
    },
    {
     "level": 5,
     "name": "Faithful Steed",
     "description": "You can call on the aid of an otherworldly steed. You always have the _Find Steed_ spell prepared.\n\nYou can also cast the spell once without expending a spell slot, and you regain the ability to do so when you finish a Long Rest."
    },
    {
     "level": 6,
     "name": "Aura of Protection",
     "description": "You radiate a protective, unseeable aura in a 10-foot Emanation that originates from you. The aura is inactive while you have the Incapacitated condition.\n\nYou and your allies in the aura gain a bonus to saving throws equal to your Charisma modifier (minimum bonus of +1).\n\nIf another Paladin is present, a creature can benefit from only one Aura of Protection at a time; the creature chooses which aura while in them."
    },
    {
     "level": 9,
     "name": "Abjure Foes",
     "description": "As a Magic action, you can expend one use of this class's Channel Divinity to overwhelm foes with awe. As you present your Holy Symbol or weapon, you can target a number of creatures equal to your Charisma modifier (minimum of one creature) that you can see within 60 feet of yourself. Each target must succeed on a Wisdom saving throw or have the Frightened condition for 1 minute or until it takes any damage. While Frightened in this way, a target can do only one of the following on its turns: move, take an action, or take a Bonus Action."
    },
    {
     "level": 10,
     "name": "Aura of Courage",
     "description": "You and your allies have Immunity to the Frightened condition while in your Aura of Protection. If a Frightened ally enters the aura, that condition has no effect on that ally while there."
    },
    {
     "level": 11,
     "name": "Radiant Strikes",
     "description": "Your strikes now carry supernatural power. When you hit a target with an attack roll using a Melee weapon or an Unarmed Strike, the target takes an extra 1d8 Radiant damage."
    },
    {
     "level": 14,
     "name": "Restoring Touch",
     "description": "When you use Lay On Hands on a creature, you can also remove one or more of the following conditions from the creature: Blinded, Charmed, Deafened, Frightened, Paralyzed, or Stunned. You must expend 5 Hit Points from the healing pool of Lay On Hands for each of these conditions you remove; those points don't also restore Hit Points to the creature."
    },
    {
     "level": 18,
     "name": "Aura Expansion",
     "description": "Your Aura of Protection is now a 30-foot Emanation."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Truesight is recommended."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "oath-of-devotion",
    "name": "Oath of Devotion",
    "tagline": "Uphold the Ideals of Justice and Order",
    "description": "_Uphold the Ideals of Justice and Order_\n\nThe Oath of Devotion binds Paladins to the ideals of justice and order. These Paladins meet the archetype of the knight in shining armor. They hold themselves to the highest standards of conduct, and some—for better or worse—hold the rest of the world to the same standards.\n\nMany who swear this oath are devoted to gods of law and good and use their gods' tenets as the measure of personal devotion. Others hold angels as their ideals and incorporate images of angelic wings into their helmets or coats of arms.\n\nThese paladins share the following tenets:\n\n- Let your word be your promise.\n- Protect the weak and never fear to act.\n- Let your honorable deeds be an example.",
    "features": [
     {
      "level": 3,
      "name": "Oath of Devotion Spells",
      "description": "The magic of your oath ensures you always have certain spells ready; when you reach a Paladin level specified in the Oath of Devotion Spells table, you thereafter always have the listed spells prepared.\n\n**Oath of Devotion Spells**\n\n_Paladin Level — Spells_\n- 3 — Protection from Evil and Good, Shield of Faith\n- 5 — Aid, Zone of Truth\n- 9 — Beacon of Hope, Dispel Magic\n- 13 — Freedom of Movement, Guardian of Faith\n- 17 — Commune, Flame Strike"
     },
     {
      "level": 3,
      "name": "Sacred Weapon",
      "description": "When you take the Attack action, you can expend one use of your Channel Divinity to imbue one Melee weapon that you are holding with positive energy. For 10 minutes or until you use this feature again, you add your Charisma modifier to attack rolls you make with that weapon (minimum bonus of +1), and each time you hit with it, you cause it to deal its normal damage type or Radiant damage.\n\nThe weapon also emits Bright Light in a 20-foot radius and Dim Light 20 feet beyond that.\n\nYou can end this effect early (no action required). This effect also ends if you aren't carrying the weapon."
     },
     {
      "level": 7,
      "name": "Aura of Devotion",
      "description": "You and your allies have Immunity to the Charmed condition while in your Aura of Protection. If a Charmed ally enters the aura, that condition has no effect on that ally while there."
     },
     {
      "level": 15,
      "name": "Smite of Protection",
      "description": "Your magical smite now radiates protective energy. Whenever you cast _Divine Smite_, you and your allies have Half Cover while in your Aura of Protection. The aura has this benefit until the start of your next turn."
     },
     {
      "level": 20,
      "name": "Holy Nimbus",
      "description": "As a Bonus Action, you can imbue your Aura of Protection with holy power, granting the benefits below for 10 minutes or until you end them (no action required). Once you use this feature, you can't use it again until you finish a Long Rest. You can also restore your use of it by expending a level 5 spell slot (no action required).\n\n_Holy Ward._ You have Advantage on any saving throw you are forced to make by a Fiend or an Undead.\n\n_Radiant Damage._ Whenever an enemy starts its turn in the aura, that creature takes Radiant damage equal to your Charisma modifier plus your Proficiency Bonus.\n\n_Sunlight._ The aura is filled with Bright Light that is sunlight."
     }
    ],
    "alwaysPrepared": {
     "3": [
      "protection-from-evil-and-good",
      "shield-of-faith"
     ],
     "5": [
      "aid",
      "zone-of-truth"
     ],
     "9": [
      "beacon-of-hope",
      "dispel-magic"
     ],
     "13": [
      "freedom-of-movement",
      "guardian-of-faith"
     ],
     "17": [
      "commune",
      "flame-strike"
     ]
    }
   },
   "spellList": {
    "0": [],
    "1": [
     "bless",
     "command",
     "cure-wounds",
     "detect-evil-and-good",
     "detect-magic",
     "detect-poison-and-disease",
     "divine-favor",
     "divine-smite",
     "heroism",
     "protection-from-evil-and-good",
     "purify-food-and-drink",
     "searing-smite",
     "shield-of-faith"
    ],
    "2": [
     "aid",
     "find-steed",
     "gentle-repose",
     "lesser-restoration",
     "locate-object",
     "magic-weapon",
     "prayer-of-healing",
     "protection-from-poison",
     "shining-smite",
     "warding-bond",
     "zone-of-truth"
    ],
    "3": [
     "create-food-and-water",
     "daylight",
     "dispel-magic",
     "magic-circle",
     "remove-curse",
     "revivify"
    ],
    "4": [
     "aura-of-life",
     "banishment",
     "death-ward",
     "locate-creature"
    ],
    "5": [
     "dispel-evil-and-good",
     "geas",
     "greater-restoration",
     "raise-dead"
    ],
    "6": [],
    "7": [],
    "8": [],
    "9": []
   },
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true,
     "martial": true
    },
    "armor": {
     "light": true,
     "medium": true,
     "heavy": true,
     "shield": true
    },
    "tools": []
   },
   "spellcasting": {
    "ability": "cha",
    "focus": "Holy Symbol",
    "ritual": false,
    "type": "half"
   },
   "weaponMastery": {
    "count": 2,
    "eligible": "proficient"
   },
   "alwaysPrepared": {
    "2": [
     "divine-smite"
    ]
   },
   "auraOfProtection": {
    "level": 6,
    "ability": "cha",
    "min": 1
   },
   "layOnHands": {
    "perLevel": 5
   },
   "choices": [
    {
     "id": "fightingStyle",
     "level": 2,
     "label": "Fighting Style",
     "type": "feat",
     "featCategory": "fighting-style",
     "alternative": {
      "id": "blessed-warrior",
      "name": "Blessed Warrior",
      "description": "You learn two Cleric cantrips of your choice (see the Cleric class's section for a list of Cleric spells). _Guidance_ and _Sacred Flame_ are recommended. The chosen cantrips count as Paladin spells for you, and Charisma is your spellcasting ability for them. Whenever you gain a Paladin level, you can replace one of these cantrips with another Cleric cantrip.",
      "cantripList": "cleric",
      "count": 2,
      "ability": "cha"
     }
    }
   ]
  },
  "ranger": {
   "id": "ranger",
   "name": "Ranger",
   "primaryAbilityText": "Dexterity and Wisdom",
   "hitDie": 10,
   "fixedHpPerLevel": 6,
   "savingThrows": [
    "str",
    "dex"
   ],
   "skillChoices": {
    "count": 3,
    "from": [
     "animal-handling",
     "athletics",
     "insight",
     "investigation",
     "nature",
     "perception",
     "stealth",
     "survival"
    ]
   },
   "casterType": "half",
   "weaponProficiencyText": "Simple and Martial weapons",
   "armorTrainingText": "Light and Medium armor and Shields",
   "toolProficiencyText": null,
   "equipmentText": "(A) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Druidic Focus (sprig of mistletoe), Explorer's Pack, and 7 GP; or (B) 150 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Studded Leather Armor",
       "count": 1,
       "armorId": "studded-leather-armor"
      },
      {
       "name": "Scimitar",
       "count": 1,
       "weaponId": "scimitar"
      },
      {
       "name": "Shortsword",
       "count": 1,
       "weaponId": "shortsword"
      },
      {
       "name": "Longbow",
       "count": 1,
       "weaponId": "longbow"
      },
      {
       "name": "Arrows",
       "count": 20
      },
      {
       "name": "Quiver",
       "count": 1
      },
      {
       "name": "Druidic Focus (sprig of mistletoe)",
       "count": 1
      },
      {
       "name": "Explorer's Pack",
       "count": 1
      }
     ],
     "gp": 7
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 150
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Spellcasting",
      "Favored Enemy",
      "Weapon Mastery"
     ],
     "favoredEnemy": 2,
     "preparedSpells": 2,
     "slots": [
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Deft Explorer",
      "Fighting Style"
     ],
     "favoredEnemy": 2,
     "preparedSpells": 3,
     "slots": [
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Ranger Subclass"
     ],
     "favoredEnemy": 2,
     "preparedSpells": 4,
     "slots": [
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "favoredEnemy": 2,
     "preparedSpells": 5,
     "slots": [
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Extra Attack"
     ],
     "favoredEnemy": 3,
     "preparedSpells": 6,
     "slots": [
      4,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Roving"
     ],
     "favoredEnemy": 3,
     "preparedSpells": 6,
     "slots": [
      4,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [
      "Subclass feature"
     ],
     "favoredEnemy": 3,
     "preparedSpells": 7,
     "slots": [
      4,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "favoredEnemy": 3,
     "preparedSpells": 7,
     "slots": [
      4,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [
      "Expertise"
     ],
     "favoredEnemy": 4,
     "preparedSpells": 9,
     "slots": [
      4,
      3,
      2,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Tireless"
     ],
     "favoredEnemy": 4,
     "preparedSpells": 9,
     "slots": [
      4,
      3,
      2,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [
      "Subclass feature"
     ],
     "favoredEnemy": 4,
     "preparedSpells": 10,
     "slots": [
      4,
      3,
      3,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "favoredEnemy": 4,
     "preparedSpells": 10,
     "slots": [
      4,
      3,
      3,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [
      "Relentless Hunter"
     ],
     "favoredEnemy": 5,
     "preparedSpells": 11,
     "slots": [
      4,
      3,
      3,
      1,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Nature’s Veil"
     ],
     "favoredEnemy": 5,
     "preparedSpells": 11,
     "slots": [
      4,
      3,
      3,
      1,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [
      "Subclass feature"
     ],
     "favoredEnemy": 5,
     "preparedSpells": 12,
     "slots": [
      4,
      3,
      3,
      2,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "favoredEnemy": 5,
     "preparedSpells": 12,
     "slots": [
      4,
      3,
      3,
      2,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [
      "Precise Hunter"
     ],
     "favoredEnemy": 6,
     "preparedSpells": 14,
     "slots": [
      4,
      3,
      3,
      3,
      1,
      0,
      0,
      0,
      0
     ]
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [
      "Feral Senses"
     ],
     "favoredEnemy": 6,
     "preparedSpells": 14,
     "slots": [
      4,
      3,
      3,
      3,
      1,
      0,
      0,
      0,
      0
     ]
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "favoredEnemy": 6,
     "preparedSpells": 15,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      0,
      0,
      0,
      0
     ]
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Foe Slayer"
     ],
     "favoredEnemy": 6,
     "preparedSpells": 15,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      0,
      0,
      0,
      0
     ]
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Spellcasting",
     "description": "You have learned to channel the magical essence of nature to cast spells. See \"Spells\" for the rules on spellcasting. The information below details how you use those rules with Ranger spells, which appear in the Ranger spell list later in the class's description.\n\n_Spell Slots._ The Ranger Features table shows how many spell slots you have to cast your level 1+ spells. You regain all expended slots when you finish a Long Rest.\n\n_Prepared Spells of Level 1+._ You prepare the list of level 1+ spells that are available for you to cast with this feature. To start, choose two level 1 Ranger spells. _Cure Wounds_ and _Ensnaring Strike_ are recommended.\n\nThe number of spells on your list increases as you gain Ranger levels, as shown in the Prepared Spells column of the Ranger Features table. Whenever that number increases, choose additional Ranger spells until the number of spells on your list matches the number in the Ranger Features table. The chosen spells must be of a level for which you have spell slots. For example, if you're a level 5 Ranger, your list of prepared spells can include six Ranger spells of level 1 or 2 in any combination.\n\nIf another Ranger feature gives you spells that you always have prepared, those spells don't count against the number of spells you can prepare with this feature, but those spells otherwise count as Ranger spells for you.\n\n_Changing Your Prepared Spells._ Whenever you finish a Long Rest, you can replace one spell on your list with another Ranger spell for which you have spell slots.\n\n_Spellcasting Ability._ Wisdom is your spellcasting ability for your Ranger spells.\n\n_Spellcasting Focus._ You can use a Druidic Focus as a Spellcasting Focus for your Ranger spells."
    },
    {
     "level": 1,
     "name": "Favored Enemy",
     "description": "You always have the _Hunter's Mark_ spell prepared. You can cast it twice without expending a spell slot, and you regain all expended uses of this ability when you finish a Long Rest.\n\nThe number of times you can cast the spell without a spell slot increases when you reach certain Ranger levels, as shown in the Favored Enemy column of the Ranger Features table."
    },
    {
     "level": 1,
     "name": "Weapon Mastery",
     "description": "Your training with weapons allows you to use the mastery properties of two kinds of weapons of your\nchoice with which you have proficiency, such as Longbows and Shortswords.\n\nWhenever you finish a Long Rest, you can change the kinds of weapons you chose. For example, you could switch to using the mastery properties of Scimitars and Longswords."
    },
    {
     "level": 2,
     "name": "Deft Explorer",
     "description": "Thanks to your travels, you gain the following benefits.\n\n_Expertise._ Choose one of your skill proficiencies with which you lack Expertise. You gain Expertise in that skill.\n\n_Languages._ You know two languages of your choice from the language tables in \"Character Creation.\""
    },
    {
     "level": 2,
     "name": "Fighting Style",
     "description": "You gain a Fighting Style feat of your choice (see \"Feats\"). Instead of choosing one of those feats, you can choose the option below.\n\n_Druidic Warrior._ You learn two Druid cantrips of your choice (see the Druid class's section for a list of Druid spells). _Guidance_ and _Starry Wisp_ are recommended. The chosen cantrips count as Ranger spells for you, and Wisdom is your spellcasting ability for them. Whenever you gain a Ranger level, you can replace one of these cantrips with another Druid cantrip."
    },
    {
     "level": 3,
     "name": "Ranger Subclass",
     "description": "You gain a Ranger subclass of your choice. The Hunter subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Ranger levels. For the rest of your career, you gain each of your subclass's features that are of your Ranger level or lower."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Ranger levels 8, 12, and 16."
    },
    {
     "level": 5,
     "name": "Extra Attack",
     "description": "You can attack twice instead of once whenever you take the Attack action on your turn."
    },
    {
     "level": 6,
     "name": "Roving",
     "description": "Your Speed increases by 10 feet while you aren't wearing Heavy armor. You also have a Climb Speed and a Swim Speed equal to your Speed."
    },
    {
     "level": 9,
     "name": "Expertise",
     "description": "Choose two of your skill proficiencies with which you lack Expertise. You gain Expertise in those skills."
    },
    {
     "level": 10,
     "name": "Tireless",
     "description": "Primal forces now help fuel you on your journeys, granting you the following benefits.\n\n_Temporary Hit Points._ As a Magic action, you can give yourself a number of Temporary Hit Points equal to 1d8 plus your Wisdom modifier (minimum of 1). You can use this action a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.\n\n_Decrease Exhaustion._ Whenever you finish a Short Rest, your Exhaustion level, if any, decreases by 1."
    },
    {
     "level": 13,
     "name": "Relentless Hunter",
     "description": "Taking damage can't break your Concentration on _Hunter's Mark_."
    },
    {
     "level": 14,
     "name": "Nature's Veil",
     "description": "You invoke spirits of nature to magically hide yourself. As a Bonus Action, you can give yourself the Invisible condition until the end of your next turn. You can use this feature a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest."
    },
    {
     "level": 17,
     "name": "Precise Hunter",
     "description": "You have Advantage on attack rolls against the creature currently marked by your _Hunter's Mark_."
    },
    {
     "level": 18,
     "name": "Feral Senses",
     "description": "Your connection to the forces of nature grants you Blindsight with a range of 30 feet."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Dimensional Travel is recommended."
    },
    {
     "level": 20,
     "name": "Foe Slayer",
     "description": "The damage die of your _Hunter's Mark_ is a d10 rather than a d6."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "hunter",
    "name": "Hunter",
    "tagline": "Protect Nature and People from Destruction",
    "description": "_Protect Nature and People from Destruction_\n\nYou stalk prey in the wilds and elsewhere, using your abilities as a Hunter to protect nature and people everywhere from forces that would destroy them.",
    "features": [
     {
      "level": 3,
      "name": "Hunter's Lore",
      "description": "You can call on the forces of nature to reveal certain strengths and weaknesses of your prey. While a creature is marked by your _Hunter's Mark_, you know whether that creature has any Immunities, Resistances, or Vulnerabilities, and if the creature has any, you know what they are."
     },
     {
      "level": 3,
      "name": "Hunter's Prey",
      "description": "You gain one of the following feature options of your choice. Whenever you finish a Short or Long Rest, you can replace the chosen option with the other one.\n\n_Colossus Slayer._ Your tenacity can wear down even the most resilient foes. When you hit a creature with a weapon, the weapon deals an extra 1d8 damage to the target if it's missing any of its Hit Points. You can deal this extra damage only once per turn.\n\n_Horde Breaker._ Once on each of your turns when you make an attack with a weapon, you can make another attack with the same weapon against a different creature that is within 5 feet of the original target, that is within the weapon's range, and that you haven't attacked this turn."
     },
     {
      "level": 7,
      "name": "Defensive Tactics",
      "description": "You gain one of the following feature options of your choice. Whenever you finish a Short or Long Rest, you can replace the chosen option with the other one.\n\n_Escape the Horde._ Opportunity Attacks have Disadvantage against you.\n\n_Multiattack Defense._ When a creature hits you with an attack roll, that creature has Disadvantage on all other attack rolls against you this turn."
     },
     {
      "level": 11,
      "name": "Superior Hunter's Prey",
      "description": "Once per turn when you deal damage to a creature marked by your _Hunter's Mark_, you can also deal that spell's extra damage to a different creature that you can see within 30 feet of the first creature."
     },
     {
      "level": 15,
      "name": "Superior Hunter's Defense",
      "description": "When you take damage, you can take a Reaction to give yourself Resistance to that damage and any other damage of the same type until the end of the current turn."
     }
    ]
   },
   "spellList": {
    "0": [],
    "1": [
     "alarm",
     "animal-friendship",
     "cure-wounds",
     "detect-magic",
     "detect-poison-and-disease",
     "ensnaring-strike",
     "entangle",
     "fog-cloud",
     "goodberry",
     "hunters-mark",
     "jump",
     "longstrider",
     "speak-with-animals"
    ],
    "2": [
     "aid",
     "animal-messenger",
     "barkskin",
     "darkvision",
     "enhance-ability",
     "find-traps",
     "gust-of-wind",
     "lesser-restoration",
     "locate-animals-or-plants",
     "locate-object",
     "magic-weapon",
     "pass-without-trace",
     "protection-from-poison",
     "silence",
     "spike-growth"
    ],
    "3": [
     "conjure-animals",
     "daylight",
     "dispel-magic",
     "meld-into-stone",
     "nondetection",
     "plant-growth",
     "protection-from-energy",
     "revivify",
     "speak-with-plants",
     "water-breathing",
     "water-walk",
     "wind-wall"
    ],
    "4": [
     "conjure-woodland-beings",
     "dominate-beast",
     "freedom-of-movement",
     "locate-creature",
     "stoneskin"
    ],
    "5": [
     "commune-with-nature",
     "greater-restoration",
     "tree-stride"
    ],
    "6": [],
    "7": [],
    "8": [],
    "9": []
   },
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true,
     "martial": true
    },
    "armor": {
     "light": true,
     "medium": true,
     "shield": true
    },
    "tools": []
   },
   "spellcasting": {
    "ability": "wis",
    "focus": "Druidic Focus",
    "ritual": false,
    "type": "half"
   },
   "alwaysPrepared": {
    "1": [
     "hunters-mark"
    ]
   },
   "weaponMastery": {
    "count": 2,
    "eligible": "proficient"
   },
   "speedBonus": {
    "level": 6,
    "amount": 10,
    "unless": "heavy-armor",
    "source": "Roving"
   },
   "choices": [
    {
     "id": "deftExpertise",
     "level": 2,
     "label": "Deft Explorer (Expertise)",
     "type": "expertise",
     "count": 1
    },
    {
     "id": "deftLanguages",
     "level": 2,
     "label": "Deft Explorer (two languages)",
     "type": "languages",
     "count": 2
    },
    {
     "id": "fightingStyle",
     "level": 2,
     "label": "Fighting Style",
     "type": "feat",
     "featCategory": "fighting-style",
     "alternative": {
      "id": "druidic-warrior",
      "name": "Druidic Warrior",
      "description": "You learn two Druid cantrips of your choice (see the Druid class's section for a list of Druid spells). _Guidance_ and _Starry Wisp_ are recommended. The chosen cantrips count as Ranger spells for you, and Wisdom is your spellcasting ability for them. Whenever you gain a Ranger level, you can replace one of these cantrips with another Druid cantrip.",
      "cantripList": "druid",
      "count": 2,
      "ability": "wis"
     }
    },
    {
     "id": "expertise9",
     "level": 9,
     "label": "Expertise (level 9)",
     "type": "expertise",
     "count": 2
    },
    {
     "id": "huntersPrey",
     "level": 3,
     "subclass": true,
     "label": "Hunter's Prey",
     "type": "option",
     "note": "You can swap this option after a Short or Long Rest.",
     "options": [
      {
       "id": "colossus-slayer",
       "name": "Colossus Slayer",
       "description": "Your tenacity can wear down even the most resilient foes. When you hit a creature with a weapon, the weapon deals an extra 1d8 damage to the target if it's missing any of its Hit Points. You can deal this extra damage only once per turn."
      },
      {
       "id": "horde-breaker",
       "name": "Horde Breaker",
       "description": "Once on each of your turns when you make an attack with a weapon, you can make another attack with the same weapon against a different creature that is within 5 feet of the original target, that is within the weapon's range, and that you haven't attacked this turn."
      }
     ]
    },
    {
     "id": "defensiveTactics",
     "level": 7,
     "subclass": true,
     "label": "Defensive Tactics",
     "type": "option",
     "note": "You can swap this option after a Short or Long Rest.",
     "options": [
      {
       "id": "escape-the-horde",
       "name": "Escape the Horde",
       "description": "Opportunity Attacks have Disadvantage against you."
      },
      {
       "id": "multiattack-defense",
       "name": "Multiattack Defense",
       "description": "When a creature hits you with an attack roll, that creature has Disadvantage on all other attack rolls against you this turn."
      }
     ]
    }
   ]
  },
  "rogue": {
   "id": "rogue",
   "name": "Rogue",
   "primaryAbilityText": "Dexterity",
   "hitDie": 8,
   "fixedHpPerLevel": 5,
   "savingThrows": [
    "dex",
    "int"
   ],
   "skillChoices": {
    "count": 4,
    "from": [
     "acrobatics",
     "athletics",
     "deception",
     "insight",
     "intimidation",
     "investigation",
     "perception",
     "persuasion",
     "sleight-of-hand",
     "stealth"
    ]
   },
   "casterType": null,
   "weaponProficiencyText": "Simple weapons and Martial weapons that have the Finesse or Light property",
   "armorTrainingText": "Light armor",
   "toolProficiencyText": "Thieves' Tools",
   "equipmentText": "(A) Leather Armor, 2 Daggers, Shortsword, Shortbow, 20 Arrows, Quiver, Thieves' Tools, Burglar's Pack, and 8 GP; or (B) 100 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Leather Armor",
       "count": 1,
       "armorId": "leather-armor"
      },
      {
       "name": "Daggers",
       "count": 2,
       "weaponId": "dagger"
      },
      {
       "name": "Shortsword",
       "count": 1,
       "weaponId": "shortsword"
      },
      {
       "name": "Shortbow",
       "count": 1,
       "weaponId": "shortbow"
      },
      {
       "name": "Arrows",
       "count": 20
      },
      {
       "name": "Quiver",
       "count": 1
      },
      {
       "name": "Thieves' Tools",
       "count": 1
      },
      {
       "name": "Burglar's Pack",
       "count": 1
      }
     ],
     "gp": 8
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 100
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Expertise",
      "Sneak Attack",
      "Thieves' Cant",
      "Weapon Mastery"
     ],
     "sneakAttack": "1d6"
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Cunning Action"
     ],
     "sneakAttack": "1d6"
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Rogue Subclass",
      "Steady Aim"
     ],
     "sneakAttack": "2d6"
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "sneakAttack": "2d6"
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Cunning Strike",
      "Uncanny Dodge"
     ],
     "sneakAttack": "3d6"
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Expertise"
     ],
     "sneakAttack": "3d6"
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [
      "Evasion",
      "Reliable Talent"
     ],
     "sneakAttack": "4d6"
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "sneakAttack": "4d6"
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [
      "Subclass feature"
     ],
     "sneakAttack": "5d6"
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "sneakAttack": "5d6"
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [
      "Improved Cunning Strike"
     ],
     "sneakAttack": "6d6"
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "sneakAttack": "6d6"
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [
      "Subclass feature"
     ],
     "sneakAttack": "7d6"
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Devious Strikes"
     ],
     "sneakAttack": "7d6"
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [
      "Slippery Mind"
     ],
     "sneakAttack": "8d6"
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "sneakAttack": "8d6"
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [
      "Subclass feature"
     ],
     "sneakAttack": "9d6"
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [
      "Elusive"
     ],
     "sneakAttack": "9d6"
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "sneakAttack": "10d6"
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Stroke of Luck"
     ],
     "sneakAttack": "10d6"
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Expertise",
     "description": "You gain Expertise in two of your skill proficiencies of your choice. Sleight of Hand and Stealth are recommended if you have proficiency in them.\n\nAt Rogue level 6, you gain Expertise in two more of your skill proficiencies of your choice."
    },
    {
     "level": 1,
     "name": "Sneak Attack",
     "description": "You know how to strike subtly and exploit a foe's distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack roll if you have Advantage on the roll and the attack uses a Finesse or a Ranged weapon. The extra damage's type is the same as the weapon's type.\n\nYou don't need Advantage on the attack roll if at least one of your allies is within 5 feet of the target, the ally doesn't have the Incapacitated condition, and you don't have Disadvantage on the attack roll. The extra damage increases as you gain Rogue levels, as shown in the Sneak Attack column of the Rogue Features table."
    },
    {
     "level": 1,
     "name": "Thieves' Cant",
     "description": "You picked up various languages in the communities where you plied your roguish talents. You know Thieves' Cant and one other language of your choice, which you choose from the language tables in \"Character Creation.\""
    },
    {
     "level": 1,
     "name": "Weapon Mastery",
     "description": "Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Daggers and Shortbows.\n\nWhenever you finish a Long Rest, you can change the kinds of weapons you chose. For example, you could switch to using the mastery properties of Scimitars and Shortswords."
    },
    {
     "level": 2,
     "name": "Cunning Action",
     "description": "Your quick thinking and agility allow you to move and act quickly. On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide."
    },
    {
     "level": 3,
     "name": "Rogue Subclass",
     "description": "You gain a Rogue subclass of your choice. The Thief subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Rogue levels. For the rest of your career, you gain each of your subclass's features that are of your Rogue level or lower."
    },
    {
     "level": 3,
     "name": "Steady Aim",
     "description": "As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven't moved during this turn, and after you use it, your Speed is 0 until the end of the current turn."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Rogue levels 8, 10, 12, and 16."
    },
    {
     "level": 5,
     "name": "Cunning Strike",
     "description": "You've developed cunning ways to use your Sneak Attack. When you deal Sneak Attack damage, you can add one of the following Cunning Strike effects. Each effect has a die cost, which is the number of Sneak Attack damage dice you must forgo to add the effect. You remove the die before rolling, and the effect occurs immediately after the attack's damage is dealt. For example, if you add the Poison effect, remove 1d6 from the Sneak Attack's damage before rolling.\n\nIf a Cunning Strike effect requires a saving throw, the DC equals 8 plus your Dexterity modifier and Proficiency Bonus.\n\n_Poison (Cost: 1d6)._ You add a toxin to your strike, forcing the target to make a Constitution saving throw. On a failed save, the target has the Poisoned condition for 1 minute. At the end of each of its turns, the Poisoned target repeats the save, ending the effect on itself on a success.\n\nTo use this effect, you must have a Poisoner's Kit on your person.\n\n_Trip (Cost: 1d6)._ If the target is Large or smaller, it must succeed on a Dexterity saving throw or have the Prone condition.\n\n_Withdraw (Cost: 1d6)._ Immediately after the attack, you move up to half your Speed without provoking Opportunity Attacks."
    },
    {
     "level": 5,
     "name": "Uncanny Dodge",
     "description": "When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack's damage against you (round down)."
    },
    {
     "level": 7,
     "name": "Evasion",
     "description": "You can nimbly dodge out of the way of certain dangers. When you're subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw and only half damage if you fail. You can't use this feature if you have the Incapacitated condition."
    },
    {
     "level": 7,
     "name": "Reliable Talent",
     "description": "Whenever you make an ability check that uses one of your skill or tool proficiencies, you can treat a d20 roll of 9 or lower as a 10."
    },
    {
     "level": 11,
     "name": "Improved Cunning Strike",
     "description": "You can use up to two Cunning Strike effects when you deal Sneak Attack damage, paying the die cost for each effect."
    },
    {
     "level": 14,
     "name": "Devious Strikes",
     "description": "You've practiced new ways to use your Sneak Attack deviously. The following effects are now among your Cunning Strike options.\n\n_Daze (Cost: 2d6)._ The target must succeed on a Constitution saving throw, or on its next turn, it can do only one of the following: move or take an action or a Bonus Action.\n\n_Knock Out (Cost: 6d6)._ The target must succeed on a Constitution saving throw, or it has the Unconscious condition for 1 minute or until it takes any damage. The Unconscious target repeats the save at the end of each of its turns, ending the effect on itself on a success.\n\n_Obscure (Cost: 3d6)._ The target must succeed on a Dexterity saving throw, or it has the Blinded condition until the end of its next turn."
    },
    {
     "level": 15,
     "name": "Slippery Mind",
     "description": "Your cunning mind is exceptionally difficult to control. You gain proficiency in Wisdom and Charisma saving throws."
    },
    {
     "level": 18,
     "name": "Elusive",
     "description": "You're so evasive that attackers rarely gain the upper hand against you. No attack roll can have Advantage against you unless you have the Incapacitated condition."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of the Night Spirit is recommended."
    },
    {
     "level": 20,
     "name": "Stroke of Luck",
     "description": "You have a marvelous knack for succeeding when you need to. If you fail a D20 Test, you can turn the roll into a 20.\n\nOnce you use this feature, you can't use it again until you finish a Short or Long Rest."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "thief",
    "name": "Thief",
    "tagline": "Hunt for Treasure as a Classic Adventurer",
    "description": "_Hunt for Treasure as a Classic Adventurer_\n\nA mix of burglar, treasure hunter, and explorer, you are the epitome of an adventurer. In addition to improving your agility and stealth, you gain abilities useful for delving into ruins and getting maximum benefit from the magic items you find there.",
    "features": [
     {
      "level": 3,
      "name": "Fast Hands",
      "description": "As a Bonus Action, you can do one of the following.\n\n_Sleight of Hand._ Make a Dexterity (Sleight of Hand) check to pick a lock or disarm a trap with Thieves' Tools or to pick a pocket.\n\n_Use an Object._ Take the Utilize action, or take the Magic action to use a magic item that requires that action."
     },
     {
      "level": 3,
      "name": "Second-Story Work",
      "description": "You've trained to get into especially hard-to-reach places, granting you these benefits.\n\n_Climber._ You gain a Climb Speed equal to your Speed.\n\n_Jumper._ You can determine your jump distance using your Dexterity rather than your Strength."
     },
     {
      "level": 9,
      "name": "Supreme Sneak",
      "description": "You gain the following Cunning Strike option.\n\n_Stealth Attack (Cost: 1d6)._ If you have the Hide action's Invisible condition, this attack doesn't end that condition on you if you end the turn behind Three-Quarters Cover or Total Cover."
     },
     {
      "level": 13,
      "name": "Use Magic Device",
      "description": "You've learned how to maximize use of magic items, granting you the following benefits.\n\n_Attunement._ You can attune to up to four magic items at once.\n\n_Charges._ Whenever you use a magic item property that expends charges, roll 1d6. On a roll of 6, you use the property without expending the charges.\n\n_Scrolls._ You can use any _Spell Scroll_, using Intelligence as your spellcasting ability for the spell. If the spell is a cantrip or a level 1 spell, you can cast it reliably. If the scroll contains a higher-level spell, you must first succeed on an Intelligence (Arcana) check (DC 10 plus the spell's level). On a successful check, you cast the spell from the scroll. On a failed check, the scroll disintegrates."
     },
     {
      "level": 17,
      "name": "Thief's Reflexes",
      "description": "You are adept at laying ambushes and quickly escaping danger. You can take two turns during the first round of any combat. You take your first turn at your normal Initiative and your second turn at your Initiative minus 10."
     }
    ]
   },
   "spellList": null,
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 10,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true,
     "martialFinesseOrLight": true
    },
    "armor": {
     "light": true
    },
    "tools": [
     "Thieves' Tools"
    ]
   },
   "choices": [
    {
     "id": "expertise1",
     "level": 1,
     "label": "Expertise (level 1)",
     "type": "expertise",
     "count": 2
    },
    {
     "id": "expertise6",
     "level": 6,
     "label": "Expertise (level 6)",
     "type": "expertise",
     "count": 2
    }
   ],
   "weaponMastery": {
    "count": 2,
    "eligible": "proficient"
   },
   "extraLanguages": 1,
   "knownLanguages": [
    "Thieves' Cant"
   ],
   "extraSaves": {
    "level": 15,
    "abilities": [
     "wis",
     "cha"
    ],
    "source": "Slippery Mind"
   },
   "alwaysPrepared": {}
  },
  "sorcerer": {
   "id": "sorcerer",
   "name": "Sorcerer",
   "primaryAbilityText": "Charisma",
   "hitDie": 6,
   "fixedHpPerLevel": 4,
   "savingThrows": [
    "con",
    "cha"
   ],
   "skillChoices": {
    "count": 2,
    "from": [
     "arcana",
     "deception",
     "insight",
     "intimidation",
     "persuasion",
     "religion"
    ]
   },
   "casterType": "full",
   "weaponProficiencyText": "Simple weapons",
   "armorTrainingText": "None",
   "toolProficiencyText": null,
   "equipmentText": "(A) Spear, 2 Daggers, Arcane Focus (crystal), Dungeoneer's Pack, and 28 GP; or (B) 50 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Spear",
       "count": 1,
       "weaponId": "spear"
      },
      {
       "name": "Daggers",
       "count": 2,
       "weaponId": "dagger"
      },
      {
       "name": "Arcane Focus (crystal)",
       "count": 1
      },
      {
       "name": "Dungeoneer's Pack",
       "count": 1
      }
     ],
     "gp": 28
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 50
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Spellcasting",
      "Innate Sorcery"
     ],
     "sorceryPoints": 0,
     "cantrips": 4,
     "preparedSpells": 2,
     "slots": [
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Font of Magic",
      "Metamagic"
     ],
     "sorceryPoints": 2,
     "cantrips": 4,
     "preparedSpells": 4,
     "slots": [
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Sorcerer Subclass"
     ],
     "sorceryPoints": 3,
     "cantrips": 4,
     "preparedSpells": 6,
     "slots": [
      4,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "sorceryPoints": 4,
     "cantrips": 5,
     "preparedSpells": 7,
     "slots": [
      4,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Sorcerous Restoration"
     ],
     "sorceryPoints": 5,
     "cantrips": 5,
     "preparedSpells": 9,
     "slots": [
      4,
      3,
      2,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Subclass feature"
     ],
     "sorceryPoints": 6,
     "cantrips": 5,
     "preparedSpells": 10,
     "slots": [
      4,
      3,
      3,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [
      "Sorcery Incarnate"
     ],
     "sorceryPoints": 7,
     "cantrips": 5,
     "preparedSpells": 11,
     "slots": [
      4,
      3,
      3,
      1,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "sorceryPoints": 8,
     "cantrips": 5,
     "preparedSpells": 12,
     "slots": [
      4,
      3,
      3,
      2,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [],
     "sorceryPoints": 9,
     "cantrips": 5,
     "preparedSpells": 14,
     "slots": [
      4,
      3,
      3,
      3,
      1,
      0,
      0,
      0,
      0
     ]
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Metamagic"
     ],
     "sorceryPoints": 10,
     "cantrips": 6,
     "preparedSpells": 15,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      0,
      0,
      0,
      0
     ]
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [],
     "sorceryPoints": 11,
     "cantrips": 6,
     "preparedSpells": 16,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      0,
      0,
      0
     ]
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "sorceryPoints": 12,
     "cantrips": 6,
     "preparedSpells": 16,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      0,
      0,
      0
     ]
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [],
     "sorceryPoints": 13,
     "cantrips": 6,
     "preparedSpells": 17,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      0,
      0
     ]
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Subclass feature"
     ],
     "sorceryPoints": 14,
     "cantrips": 6,
     "preparedSpells": 17,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      0,
      0
     ]
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [],
     "sorceryPoints": 15,
     "cantrips": 6,
     "preparedSpells": 18,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      0
     ]
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "sorceryPoints": 16,
     "cantrips": 6,
     "preparedSpells": 18,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      0
     ]
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [
      "Metamagic"
     ],
     "sorceryPoints": 17,
     "cantrips": 6,
     "preparedSpells": 19,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      1
     ]
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [
      "Subclass feature"
     ],
     "sorceryPoints": 18,
     "cantrips": 6,
     "preparedSpells": 20,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      1,
      1,
      1,
      1
     ]
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "sorceryPoints": 19,
     "cantrips": 6,
     "preparedSpells": 21,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      2,
      1,
      1,
      1
     ]
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Arcane Apotheosis"
     ],
     "sorceryPoints": 20,
     "cantrips": 6,
     "preparedSpells": 22,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      2,
      2,
      1,
      1
     ]
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Spellcasting",
     "description": "Drawing from your innate magic, you can cast spells. See \"Spells\" for the rules on spellcasting. The information below details how you use those rules with Sorcerer spells, which appear in the Sorcerer spell list later in the class's description.\n\n_Cantrips._ You know four Sorcerer cantrips of your choice. _Light_, _Prestidigitation_, _Shocking Grasp_, and _Sorcerous Burst_ are recommended. Whenever you gain a Sorcerer level, you can replace one of your cantrips from this feature with another Sorcerer cantrip of your choice.\n\nWhen you reach Sorcerer levels 4 and 10, you learn another Sorcerer cantrip of your choice, as shown in the Cantrips column of the Sorcerer Features table.\n\n_Spell Slots._ The Sorcerer Features table shows how many spell slots you have to cast your level 1+ spells. You regain all expended slots when you finish a Long Rest.\n\n_Prepared Spells of Level 1+._ You prepare the list of level 1+ spells that are available for you to cast with this feature. To start, choose two level 1 Sorcerer spells. _Burning Hands_ and _Detect Magic_ are recommended.\n\nThe number of spells on your list increases as you gain Sorcerer levels, as shown in the Prepared Spells column of the Sorcerer Features table. Whenever that number increases, choose additional Sorcerer spells until the number of spells on your list matches the number in the Sorcerer Features table. The chosen spells must be of a level for which you have spell slots. For example, if you're a level 3 Sorcerer, your list of prepared spells can include six Sorcerer spells of level 1 or 2 in any combination.\n\nIf another Sorcerer feature gives you spells that you always have prepared, those spells don't count against the number of spells you can prepare with this feature, but those spells otherwise count as Sorcerer spells for you.\n\n_Changing Your Prepared Spells._ Whenever you gain a Sorcerer level, you can replace one spell on your list with another Sorcerer spell for which you have spell slots.\n\n_Spellcasting Ability._ Charisma is your spellcasting ability for your Sorcerer spells.\n\n_Spellcasting Focus._ You can use an Arcane Focus as a Spellcasting Focus for your Sorcerer spells."
    },
    {
     "level": 1,
     "name": "Innate Sorcery",
     "description": "An event in your past left an indelible mark on you, infusing you with simmering magic. As a Bonus Action, you can unleash that magic for 1 minute, during which you gain the following benefits:\n• The spell save DC of your Sorcerer spells increases by 1.\n• You have Advantage on the attack rolls of Sorcerer spells you cast.\n\nYou can use this feature twice, and you regain all expended uses of it when you finish a Long Rest."
    },
    {
     "level": 2,
     "name": "Font of Magic",
     "description": "You can tap into the wellspring of magic within yourself. This wellspring is represented by Sorcery Points, which allow you to create a variety of magical effects.\n\nYou have 2 Sorcery Points, and you gain more as you reach higher levels, as shown in the Sorcery Points column of the Sorcerer Features table. You can't have more Sorcery Points than the number shown in the table for your level. You regain all expended Sorcery Points when you finish a Long Rest.\n\nYou can use your Sorcery Points to fuel the options below, along with other features, such as Metamagic, that use those points.\n\n_Converting Spell Slots to Sorcery Points._ You can expend a spell slot to gain a number of Sorcery Points equal to the slot's level (no action required).\n\n_Creating Spell Slots._ As a Bonus Action, you can transform unexpended Sorcery Points into one spell slot. The Creating Spell Slots table shows the cost of creating a spell slot of a given level, and it lists the minimum Sorcerer level you must be to create a slot. You can create a spell slot no higher than level 5.\n\nAny spell slot you create with this feature vanishes when you finish a Long Rest.\n\n**Creating Spell Slots**\n\n_Spell Slot Level — Sorcery Point Cost — Min. Sorcerer Level_\n- 1 — 2 — 2\n- 2 — 3 — 3\n- 3 — 5 — 5\n- 4 — 6 — 7\n- 5 — 7 — 9"
    },
    {
     "level": 2,
     "name": "Metamagic",
     "description": "Because your magic flows from within, you can alter your spells to suit your needs; you gain two Metamagic options of your choice from \"Metamagic Options\" later in this class's description. You use the chosen options to temporarily modify spells you cast. To use an option, you must spend the number of Sorcery Points that it costs.\n\nYou can use only one Metamagic option on a spell when you cast it unless otherwise noted in one of those options.\n\nWhenever you gain a Sorcerer level, you can replace one of your Metamagic options with one you don't know. You gain two more options at Sorcerer level 10 and two more at Sorcerer level 17."
    },
    {
     "level": 3,
     "name": "Sorcerer Subclass",
     "description": "You gain a Sorcerer subclass of your choice. The Draconic Sorcery subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Sorcerer levels. For the rest of your career, you gain each of your subclass's features that are of your Sorcerer level or lower."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Sorcerer levels 8, 12, and 16."
    },
    {
     "level": 5,
     "name": "Sorcerous Restoration",
     "description": "When you finish a Short Rest, you can regain expended Sorcery Points, but no more than a number equal to half your Sorcerer level (round down). Once you use this feature, you can't do so again until you finish a Long Rest."
    },
    {
     "level": 7,
     "name": "Sorcery Incarnate",
     "description": "If you have no uses of Innate Sorcery left, you can use it if you spend 2 Sorcery Points when you take the Bonus Action to activate it.\n\nIn addition, while your Innate Sorcery feature is active, you can use up to two of your Metamagic options on each spell you cast."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Dimensional Travel is recommended."
    },
    {
     "level": 20,
     "name": "Arcane Apotheosis",
     "description": "While your Innate Sorcery feature is active, you can use one Metamagic option on each of your turns without spending Sorcery Points on it."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "draconic-sorcery",
    "name": "Draconic Sorcery",
    "tagline": "Breathe the Magic of Dragons",
    "description": "_Breathe the Magic of Dragons_\n\nYour innate magic comes from the gift of a dragon. Perhaps an ancient dragon facing death bequeathed some of its magical power to you or your ancestor. You might have absorbed magic from a site infused with dragons' power. Or perhaps you handled a treasure taken from a dragon's hoard that was steeped in draconic power. Or you might have a dragon for an ancestor.",
    "features": [
     {
      "level": 3,
      "name": "Draconic Resilience",
      "description": "The magic in your body manifests physical traits of your draconic gift. Your Hit Point maximum increases by 3, and it increases by 1 whenever you gain another Sorcerer level.\n\nParts of you are also covered by dragon-like scales. While you aren't wearing armor, your base Armor Class equals 10 plus your Dexterity and Charisma modifiers."
     },
     {
      "level": 3,
      "name": "Draconic Spells",
      "description": "When you reach a Sorcerer level specified in the Draconic Spells table, you thereafter always have the listed spells prepared.\n\n**Draconic Spells**\n\n_Sorcerer Level — Spells_\n- 3 — Alter Self, Chromatic Orb, Command, Dragon's Breath\n- 5 — Fear, Fly\n- 7 — Arcane Eye, Charm Monster\n- 9 — Legend Lore, Summon Dragon"
     },
     {
      "level": 6,
      "name": "Elemental Affinity",
      "description": "Your draconic magic has an affinity with a damage type associated with dragons. Choose one of those types: Acid, Cold, Fire, Lightning, or Poison.\n\nYou have Resistance to that damage type, and when you cast a spell that deals damage of that type, you can add your Charisma modifier to one damage roll of that spell."
     },
     {
      "level": 14,
      "name": "Dragon Wings",
      "description": "As a Bonus Action, you can cause draconic wings to appear on your back. The wings last for 1 hour or until you dismiss them (no action required). For the duration, you have a Fly Speed of 60 feet.\n\nOnce you use this feature, you can't use it again until you finish a Long Rest unless you spend 3 Sorcery Points (no action required) to restore your use of it."
     },
     {
      "level": 18,
      "name": "Dragon Companion",
      "description": "You can cast _Summon Dragon_ without a Material component. You can also cast it once without a spell slot, and you regain the ability to cast it in this way when you finish a Long Rest.\n\nWhenever you start casting the spell, you can modify it so that it doesn't require Concentration. If you do so, the spell's duration becomes 1 minute for that casting."
     }
    ],
    "hpBonus": {
     "level": 3,
     "perClassLevel": 1,
     "source": "Draconic Resilience"
    },
    "unarmoredDefense": {
     "level": 3,
     "ability": "cha",
     "shield": true
    },
    "alwaysPrepared": {
     "3": [
      "alter-self",
      "chromatic-orb",
      "command",
      "dragons-breath"
     ],
     "5": [
      "fear",
      "fly"
     ],
     "7": [
      "arcane-eye",
      "charm-monster"
     ],
     "9": [
      "legend-lore",
      "summon-dragon"
     ]
    }
   },
   "spellList": {
    "0": [
     "acid-splash",
     "chill-touch",
     "dancing-lights",
     "elementalism",
     "fire-bolt",
     "light",
     "mage-hand",
     "mending",
     "message",
     "minor-illusion",
     "poison-spray",
     "prestidigitation",
     "ray-of-frost",
     "shocking-grasp",
     "sorcerous-burst",
     "true-strike"
    ],
    "1": [
     "burning-hands",
     "charm-person",
     "chromatic-orb",
     "color-spray",
     "comprehend-languages",
     "detect-magic",
     "disguise-self",
     "expeditious-retreat",
     "false-life",
     "feather-fall",
     "fog-cloud",
     "grease",
     "ice-knife",
     "jump",
     "mage-armor",
     "magic-missile",
     "ray-of-sickness",
     "shield",
     "silent-image",
     "sleep",
     "thunderwave"
    ],
    "2": [
     "alter-self",
     "blindness-deafness",
     "blur",
     "darkness",
     "darkvision",
     "detect-thoughts",
     "dragons-breath",
     "enhance-ability",
     "enlarge-reduce",
     "flame-blade",
     "flaming-sphere",
     "gust-of-wind",
     "hold-person",
     "invisibility",
     "knock",
     "levitate",
     "magic-weapon",
     "mind-spike",
     "mirror-image",
     "misty-step",
     "phantasmal-force",
     "scorching-ray",
     "see-invisibility",
     "shatter",
     "spider-climb",
     "suggestion",
     "web"
    ],
    "3": [
     "blink",
     "clairvoyance",
     "counterspell",
     "daylight",
     "dispel-magic",
     "fear",
     "fireball",
     "fly",
     "gaseous-form",
     "haste",
     "hypnotic-pattern",
     "lightning-bolt",
     "major-image",
     "protection-from-energy",
     "sleet-storm",
     "slow",
     "stinking-cloud",
     "tongues",
     "vampiric-touch",
     "water-breathing",
     "water-walk"
    ],
    "4": [
     "banishment",
     "blight",
     "charm-monster",
     "confusion",
     "dimension-door",
     "dominate-beast",
     "fire-shield",
     "greater-invisibility",
     "ice-storm",
     "polymorph",
     "stoneskin",
     "vitriolic-sphere",
     "wall-of-fire"
    ],
    "5": [
     "animate-objects",
     "arcane-hand",
     "cloudkill",
     "cone-of-cold",
     "creation",
     "dominate-person",
     "hold-monster",
     "insect-plague",
     "seeming",
     "telekinesis",
     "teleportation-circle",
     "wall-of-stone"
    ],
    "6": [
     "chain-lightning",
     "circle-of-death",
     "disintegrate",
     "eyebite",
     "flesh-to-stone",
     "freezing-sphere",
     "globe-of-invulnerability",
     "mass-suggestion",
     "move-earth",
     "sunbeam",
     "true-seeing"
    ],
    "7": [
     "delayed-blast-fireball",
     "etherealness",
     "finger-of-death",
     "fire-storm",
     "plane-shift",
     "prismatic-spray",
     "reverse-gravity",
     "teleport"
    ],
    "8": [
     "demiplane",
     "dominate-monster",
     "earthquake",
     "incendiary-cloud",
     "power-word-stun",
     "sunburst"
    ],
    "9": [
     "gate",
     "meteor-swarm",
     "power-word-kill",
     "time-stop",
     "wish"
    ]
   },
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true
    },
    "armor": {},
    "tools": []
   },
   "spellcasting": {
    "ability": "cha",
    "focus": "Arcane Focus",
    "ritual": false,
    "type": "full"
   },
   "choices": [
    {
     "id": "metamagic",
     "level": 2,
     "label": "Metamagic options",
     "type": "multi-option",
     "counts": {
      "2": 2,
      "10": 4,
      "17": 6
     },
     "optionsFrom": "metamagic"
    },
    {
     "id": "elementalAffinity",
     "level": 6,
     "subclass": true,
     "label": "Elemental Affinity",
     "type": "option",
     "options": [
      {
       "id": "acid",
       "name": "Acid",
       "description": "Resistance to Acid damage; add your Charisma modifier to one damage roll of a spell that deals Acid damage."
      },
      {
       "id": "cold",
       "name": "Cold",
       "description": "Resistance to Cold damage; add your Charisma modifier to one damage roll of a spell that deals Cold damage."
      },
      {
       "id": "fire",
       "name": "Fire",
       "description": "Resistance to Fire damage; add your Charisma modifier to one damage roll of a spell that deals Fire damage."
      },
      {
       "id": "lightning",
       "name": "Lightning",
       "description": "Resistance to Lightning damage; add your Charisma modifier to one damage roll of a spell that deals Lightning damage."
      },
      {
       "id": "poison",
       "name": "Poison",
       "description": "Resistance to Poison damage; add your Charisma modifier to one damage roll of a spell that deals Poison damage."
      }
     ]
    }
   ],
   "alwaysPrepared": {}
  },
  "warlock": {
   "id": "warlock",
   "name": "Warlock",
   "primaryAbilityText": "Charisma",
   "hitDie": 8,
   "fixedHpPerLevel": 5,
   "savingThrows": [
    "wis",
    "cha"
   ],
   "skillChoices": {
    "count": 2,
    "from": [
     "arcana",
     "deception",
     "history",
     "intimidation",
     "investigation",
     "nature",
     "religion"
    ]
   },
   "casterType": "pact",
   "weaponProficiencyText": "Simple weapons",
   "armorTrainingText": "Light armor",
   "toolProficiencyText": null,
   "equipmentText": "(A) Leather Armor, Sickle, 2 Daggers, Arcane Focus (orb), Book (occult lore), Scholar's Pack, and 15 GP; or (B) 100 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Leather Armor",
       "count": 1,
       "armorId": "leather-armor"
      },
      {
       "name": "Sickle",
       "count": 1,
       "weaponId": "sickle"
      },
      {
       "name": "Daggers",
       "count": 2,
       "weaponId": "dagger"
      },
      {
       "name": "Arcane Focus (orb)",
       "count": 1
      },
      {
       "name": "Book (occult lore)",
       "count": 1
      },
      {
       "name": "Scholar's Pack",
       "count": 1
      }
     ],
     "gp": 15
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 100
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Eldritch Invocations",
      "Pact Magic"
     ],
     "invocations": 1,
     "cantrips": 2,
     "preparedSpells": 2,
     "pactSlots": 1,
     "pactSlotLevel": 1
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Magical Cunning"
     ],
     "invocations": 3,
     "cantrips": 2,
     "preparedSpells": 3,
     "pactSlots": 2,
     "pactSlotLevel": 1
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Warlock Subclass"
     ],
     "invocations": 3,
     "cantrips": 2,
     "preparedSpells": 4,
     "pactSlots": 2,
     "pactSlotLevel": 2
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "invocations": 3,
     "cantrips": 3,
     "preparedSpells": 5,
     "pactSlots": 2,
     "pactSlotLevel": 2
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [],
     "invocations": 5,
     "cantrips": 3,
     "preparedSpells": 6,
     "pactSlots": 2,
     "pactSlotLevel": 3
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Subclass feature"
     ],
     "invocations": 5,
     "cantrips": 3,
     "preparedSpells": 7,
     "pactSlots": 2,
     "pactSlotLevel": 3
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [],
     "invocations": 6,
     "cantrips": 3,
     "preparedSpells": 8,
     "pactSlots": 2,
     "pactSlotLevel": 4
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "invocations": 6,
     "cantrips": 3,
     "preparedSpells": 9,
     "pactSlots": 2,
     "pactSlotLevel": 4
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [
      "Contact Patron"
     ],
     "invocations": 7,
     "cantrips": 3,
     "preparedSpells": 10,
     "pactSlots": 2,
     "pactSlotLevel": 5
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Subclass feature"
     ],
     "invocations": 7,
     "cantrips": 4,
     "preparedSpells": 10,
     "pactSlots": 2,
     "pactSlotLevel": 5
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [
      "Mystic Arcanum (level 6 spell)"
     ],
     "invocations": 7,
     "cantrips": 4,
     "preparedSpells": 11,
     "pactSlots": 3,
     "pactSlotLevel": 5
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "invocations": 8,
     "cantrips": 4,
     "preparedSpells": 11,
     "pactSlots": 3,
     "pactSlotLevel": 5
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [
      "Mystic Arcanum (level 7 spell)"
     ],
     "invocations": 8,
     "cantrips": 4,
     "preparedSpells": 12,
     "pactSlots": 3,
     "pactSlotLevel": 5
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Subclass feature"
     ],
     "invocations": 8,
     "cantrips": 4,
     "preparedSpells": 12,
     "pactSlots": 3,
     "pactSlotLevel": 5
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [
      "Mystic Arcanum (level 8 spell)"
     ],
     "invocations": 9,
     "cantrips": 4,
     "preparedSpells": 13,
     "pactSlots": 3,
     "pactSlotLevel": 5
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "invocations": 9,
     "cantrips": 4,
     "preparedSpells": 13,
     "pactSlots": 3,
     "pactSlotLevel": 5
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [
      "Mystic Arcanum (level 9 spell)"
     ],
     "invocations": 9,
     "cantrips": 4,
     "preparedSpells": 14,
     "pactSlots": 4,
     "pactSlotLevel": 5
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [],
     "invocations": 10,
     "cantrips": 4,
     "preparedSpells": 14,
     "pactSlots": 4,
     "pactSlotLevel": 5
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "invocations": 10,
     "cantrips": 4,
     "preparedSpells": 15,
     "pactSlots": 4,
     "pactSlotLevel": 5
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Eldritch Master"
     ],
     "invocations": 10,
     "cantrips": 4,
     "preparedSpells": 15,
     "pactSlots": 4,
     "pactSlotLevel": 5
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Eldritch Invocations",
     "description": "You have unearthed Eldritch Invocations, pieces of forbidden knowledge that imbue you with an abiding magical ability or other lessons. You gain one invocation of your choice, such as Pact of the Tome. Invocations are described in the \"Eldritch Invocation Options\" section later in this class's description.\n\n_Prerequisites._ If an invocation has a prerequisite, you must meet it to learn that invocation. For example, if an invocation requires you to be a level 5+ Warlock, you can select the invocation once you reach Warlock level 5.\n\n_Replacing and Gaining Invocations._ Whenever you gain a Warlock level, you can replace one of your invocations with another one for which you qualify. You can't replace an invocation if it's a prerequisite for another invocation that you have.\n\nWhen you gain certain Warlock levels, you gain more invocations of your choice, as shown in the Invocations column of the Warlock Features table.\n\nYou can't pick the same invocation more than once unless its description says otherwise."
    },
    {
     "level": 1,
     "name": "Pact Magic",
     "description": "Through occult ceremony, you have formed a pact with a mysterious entity to gain magical powers. The entity is a voice in the shadows—its identity unclear—but its boon to you is concrete: the ability to cast spells. See \"Spells\" for the rules on spellcasting. The information below details how you use those rules with Warlock spells, which appear in the Warlock spell list later in the class's description.\n\n_Cantrips._ You know two Warlock cantrips of your choice. _Eldritch Blast_ and _Prestidigitation_ are recommended. Whenever you gain a Warlock level, you can replace one of your cantrips from this feature with another Warlock cantrip of your choice.\n\nWhen you reach Warlock levels 4 and 10, you learn another Warlock cantrip of your choice, as shown in the Cantrips column of the Warlock Features table.\n\n_Spell Slots._ The Warlock Features table shows how many spell slots you have to cast your Warlock spells of levels 1–5. The table also shows the level of those slots, all of which are the same level. You regain all expended Pact Magic spell slots when you finish a Short or Long Rest.\n\nFor example, when you're a level 5 Warlock, you have two level 3 spell slots. To cast the level 1 spell _Charm Person_, you must spend one of those slots, and you cast it as a level 3 spell.\n\n_Prepared Spells of Level 1+._ You prepare the list of level 1+ spells that are available for you to cast with this feature. To start, choose two level 1 Warlock spells. _Charm Person_ and _Hex_ are recommended.\n\nThe number of spells on your list increases as you gain Warlock levels, as shown in the Prepared Spells column of the Warlock Features table. Whenever that number increases, choose additional Warlock spells until the number of spells on your list matches the number in the table. The chosen spells must be of a level no higher than what's shown in the table's Slot Level column for your level. When you reach level 6, for example, you learn a new Warlock spell, which can be of levels 1–3.\n\nIf another Warlock feature gives you spells that you always have prepared, those spells don't count against the number of spells you can prepare with this feature, but those spells otherwise count as Warlock spells for you.\n\n_Changing Your Prepared Spells._ Whenever you gain a Warlock level, you can replace one spell on your list with another Warlock spell of an eligible level.\n\n_Spellcasting Ability._ Charisma is the spellcasting ability for your Warlock spells.\n\n_Spellcasting Focus._ You can use an Arcane Focus as a Spellcasting Focus for your Warlock spells."
    },
    {
     "level": 2,
     "name": "Magical Cunning",
     "description": "You can perform an esoteric rite for 1 minute. At the end of it, you regain expended Pact Magic spell slots but no more than a number equal to half your maximum (round up). Once you use this feature, you can't do so again until you finish a Long Rest."
    },
    {
     "level": 3,
     "name": "Warlock Subclass",
     "description": "You gain a Warlock subclass of your choice. The Fiend Patron subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Warlock levels. For the rest of your career, you gain each of your subclass's features that are of your Warlock level or lower."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Warlock levels 8, 12, and 16."
    },
    {
     "level": 9,
     "name": "Contact Patron",
     "description": "In the past, you usually contacted your patron through intermediaries. Now you can communicate directly; you always have the _Contact Other Plane_ spell prepared. With this feature, you can cast the spell without expending a spell slot to contact your patron, and you automatically succeed on the spell's saving throw.\n\nOnce you cast the spell with this feature, you can't do so in this way again until you finish a Long Rest."
    },
    {
     "level": 11,
     "name": "Mystic Arcanum",
     "description": "Your patron grants you a magical secret called an arcanum. Choose one level 6 Warlock spell as this arcanum.\n\nYou can cast your arcanum spell once without expending a spell slot, and you must finish a Long Rest before you can cast it in this way again.\n\nAs shown in the Warlock Features table, you gain another Warlock spell of your choice that can be cast in this way when you reach Warlock levels 13 (level 7 spell), 15 (level 8 spell), and 17 (level 9 spell). You regain all uses of your Mystic Arcanum when you finish a Long Rest.\n\nWhenever you gain a Warlock level, you can replace one of your arcanum spells with another Warlock spell of the same level."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Fate is recommended."
    },
    {
     "level": 20,
     "name": "Eldritch Master",
     "description": "When you use your Magical Cunning feature, you regain all your expended Pact Magic spell slots."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "fiend-patron",
    "name": "Fiend Patron",
    "tagline": "Make a Deal with the Lower Planes",
    "description": "_Make a Deal with the Lower Planes_\n\nYour pact draws on the Lower Planes, the realms of perdition. You might forge a bargain with a demon lord, an archdevil, or another fiend that is especially mighty. That patron's aims are evil—the corruption or destruction of all things, ultimately including you—and your path is defined by the extent to which you strive against those aims.",
    "features": [
     {
      "level": 3,
      "name": "Dark One's Blessing",
      "description": "When you reduce an enemy to 0 Hit Points, you gain Temporary Hit Points equal to your Charisma modifier plus your Warlock level (minimum of 1 Temporary Hit Point). You also gain this benefit if someone else reduces an enemy within 10 feet of you to 0 Hit Points."
     },
     {
      "level": 3,
      "name": "Fiend Spells",
      "description": "The magic of your patron ensures you always have certain spells ready; when you reach a Warlock level specified in the Fiend Spells table, you thereafter always have the listed spells prepared.\n\n**Fiend Spells**\n\n_Warlock Level — Spells_\n- 3 — Burning Hands, Command, Scorching Ray, Suggestion\n- 5 — Fireball, Stinking Cloud\n- 7 — Fire Shield, Wall of Fire\n- 9 — Geas, Insect Plague"
     },
     {
      "level": 6,
      "name": "Dark One's Own Luck",
      "description": "You can call on your fiendish patron to alter fate in your favor. When you make an ability check or a saving throw, you can use this feature to add 1d10 to your roll. You can do so after seeing the roll but before any of the roll's effects occur.\n\nYou can use this feature a number of times equal to your Charisma modifier (minimum of once), but you can use it no more than once per roll. You regain all expended uses when you finish a Long Rest."
     },
     {
      "level": 10,
      "name": "Fiendish Resilience",
      "description": "Choose one damage type, other than Force, whenever you finish a Short or Long Rest. You have Resistance to that damage type until you choose a different one with this feature."
     },
     {
      "level": 14,
      "name": "Hurl Through Hell",
      "description": "Once per turn when you hit a creature with an attack roll, you can try to instantly transport the target through the Lower Planes. The target must succeed on a Charisma saving throw against your spell save DC, or the target disappears and hurtles through a nightmare landscape. The target takes 8d10 Psychic damage if it isn't a Fiend, and it has the Incapacitated condition until the end of your next turn, when it returns to the space it previously occupied or the nearest unoccupied space.\n\nOnce you use this feature, you can't use it again until you finish a Long Rest unless you expend a Pact Magic spell slot (no action required) to restore your use of it."
     }
    ],
    "alwaysPrepared": {
     "3": [
      "burning-hands",
      "command",
      "scorching-ray",
      "suggestion"
     ],
     "5": [
      "fireball",
      "stinking-cloud"
     ],
     "7": [
      "fire-shield",
      "wall-of-fire"
     ],
     "9": [
      "geas",
      "insect-plague"
     ]
    }
   },
   "spellList": {
    "0": [
     "chill-touch",
     "eldritch-blast",
     "mage-hand",
     "minor-illusion",
     "poison-spray",
     "prestidigitation",
     "true-strike"
    ],
    "1": [
     "bane",
     "charm-person",
     "comprehend-languages",
     "detect-magic",
     "expeditious-retreat",
     "hellish-rebuke",
     "hex",
     "hideous-laughter",
     "illusory-script",
     "protection-from-evil-and-good",
     "speak-with-animals",
     "unseen-servant"
    ],
    "2": [
     "darkness",
     "enthrall",
     "hold-person",
     "invisibility",
     "mind-spike",
     "mirror-image",
     "misty-step",
     "ray-of-enfeeblement",
     "spider-climb",
     "suggestion"
    ],
    "3": [
     "counterspell",
     "dispel-magic",
     "fear",
     "fly",
     "gaseous-form",
     "hypnotic-pattern",
     "magic-circle",
     "major-image",
     "remove-curse",
     "tongues",
     "vampiric-touch"
    ],
    "4": [
     "banishment",
     "blight",
     "charm-monster",
     "dimension-door",
     "hallucinatory-terrain"
    ],
    "5": [
     "contact-other-plane",
     "dream",
     "hold-monster",
     "mislead",
     "planar-binding",
     "scrying",
     "teleportation-circle"
    ],
    "6": [
     "circle-of-death",
     "create-undead",
     "eyebite",
     "true-seeing"
    ],
    "7": [
     "etherealness",
     "finger-of-death",
     "forcecage",
     "plane-shift"
    ],
    "8": [
     "befuddlement",
     "demiplane",
     "dominate-monster",
     "glibness",
     "power-word-stun"
    ],
    "9": [
     "astral-projection",
     "foresight",
     "gate",
     "imprisonment",
     "power-word-kill",
     "true-polymorph",
     "weird"
    ]
   },
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true
    },
    "armor": {
     "light": true
    },
    "tools": []
   },
   "spellcasting": {
    "ability": "cha",
    "focus": "Arcane Focus",
    "ritual": false,
    "type": "pact"
   },
   "mysticArcanum": {
    "11": 6,
    "13": 7,
    "15": 8,
    "17": 9
   },
   "choices": [
    {
     "id": "invocations",
     "level": 1,
     "label": "Eldritch Invocations",
     "type": "invocations",
     "column": "invocations"
    }
   ],
   "alwaysPrepared": {}
  },
  "wizard": {
   "id": "wizard",
   "name": "Wizard",
   "primaryAbilityText": "Intelligence",
   "hitDie": 6,
   "fixedHpPerLevel": 4,
   "savingThrows": [
    "int",
    "wis"
   ],
   "skillChoices": {
    "count": 2,
    "from": [
     "arcana",
     "history",
     "insight",
     "investigation",
     "medicine",
     "nature",
     "religion"
    ]
   },
   "casterType": "full",
   "weaponProficiencyText": "Simple weapons",
   "armorTrainingText": "None",
   "toolProficiencyText": null,
   "equipmentText": "(A) 2 Daggers, Arcane Focus (Quarterstaff), Robe, Spellbook, Scholar's Pack, and 5 GP; or (B) 55 GP",
   "equipmentOptions": [
    {
     "id": "A",
     "label": "Option A",
     "items": [
      {
       "name": "Daggers",
       "count": 2,
       "weaponId": "dagger"
      },
      {
       "name": "Arcane Focus (Quarterstaff)",
       "count": 1,
       "weaponId": "quarterstaff"
      },
      {
       "name": "Robe",
       "count": 1
      },
      {
       "name": "Spellbook",
       "count": 1
      },
      {
       "name": "Scholar's Pack",
       "count": 1
      }
     ],
     "gp": 5
    },
    {
     "id": "B",
     "label": "Option B",
     "items": [],
     "gp": 55
    }
   ],
   "levels": {
    "1": {
     "proficiencyBonus": 2,
     "features": [
      "Spellcasting",
      "Ritual Adept",
      "Arcane Recovery"
     ],
     "cantrips": 3,
     "preparedSpells": 4,
     "slots": [
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "2": {
     "proficiencyBonus": 2,
     "features": [
      "Scholar"
     ],
     "cantrips": 3,
     "preparedSpells": 5,
     "slots": [
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "3": {
     "proficiencyBonus": 2,
     "features": [
      "Wizard Subclass"
     ],
     "cantrips": 3,
     "preparedSpells": 6,
     "slots": [
      4,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "4": {
     "proficiencyBonus": 2,
     "features": [
      "Ability Score Improvement"
     ],
     "cantrips": 4,
     "preparedSpells": 7,
     "slots": [
      4,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "5": {
     "proficiencyBonus": 3,
     "features": [
      "Memorize Spell"
     ],
     "cantrips": 4,
     "preparedSpells": 9,
     "slots": [
      4,
      3,
      2,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "6": {
     "proficiencyBonus": 3,
     "features": [
      "Subclass feature"
     ],
     "cantrips": 4,
     "preparedSpells": 10,
     "slots": [
      4,
      3,
      3,
      0,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "7": {
     "proficiencyBonus": 3,
     "features": [],
     "cantrips": 4,
     "preparedSpells": 11,
     "slots": [
      4,
      3,
      3,
      1,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "8": {
     "proficiencyBonus": 3,
     "features": [
      "Ability Score Improvement"
     ],
     "cantrips": 4,
     "preparedSpells": 12,
     "slots": [
      4,
      3,
      3,
      2,
      0,
      0,
      0,
      0,
      0
     ]
    },
    "9": {
     "proficiencyBonus": 4,
     "features": [],
     "cantrips": 4,
     "preparedSpells": 14,
     "slots": [
      4,
      3,
      3,
      3,
      1,
      0,
      0,
      0,
      0
     ]
    },
    "10": {
     "proficiencyBonus": 4,
     "features": [
      "Subclass feature"
     ],
     "cantrips": 5,
     "preparedSpells": 15,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      0,
      0,
      0,
      0
     ]
    },
    "11": {
     "proficiencyBonus": 4,
     "features": [],
     "cantrips": 5,
     "preparedSpells": 16,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      0,
      0,
      0
     ]
    },
    "12": {
     "proficiencyBonus": 4,
     "features": [
      "Ability Score Improvement"
     ],
     "cantrips": 5,
     "preparedSpells": 16,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      0,
      0,
      0
     ]
    },
    "13": {
     "proficiencyBonus": 5,
     "features": [],
     "cantrips": 5,
     "preparedSpells": 17,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      0,
      0
     ]
    },
    "14": {
     "proficiencyBonus": 5,
     "features": [
      "Subclass feature"
     ],
     "cantrips": 5,
     "preparedSpells": 18,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      0,
      0
     ]
    },
    "15": {
     "proficiencyBonus": 5,
     "features": [],
     "cantrips": 5,
     "preparedSpells": 19,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      0
     ]
    },
    "16": {
     "proficiencyBonus": 5,
     "features": [
      "Ability Score Improvement"
     ],
     "cantrips": 5,
     "preparedSpells": 21,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      0
     ]
    },
    "17": {
     "proficiencyBonus": 6,
     "features": [],
     "cantrips": 5,
     "preparedSpells": 22,
     "slots": [
      4,
      3,
      3,
      3,
      2,
      1,
      1,
      1,
      1
     ]
    },
    "18": {
     "proficiencyBonus": 6,
     "features": [
      "Spell Mastery"
     ],
     "cantrips": 5,
     "preparedSpells": 23,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      1,
      1,
      1,
      1
     ]
    },
    "19": {
     "proficiencyBonus": 6,
     "features": [
      "Epic Boon"
     ],
     "cantrips": 5,
     "preparedSpells": 24,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      2,
      1,
      1,
      1
     ]
    },
    "20": {
     "proficiencyBonus": 6,
     "features": [
      "Signature Spells"
     ],
     "cantrips": 5,
     "preparedSpells": 25,
     "slots": [
      4,
      3,
      3,
      3,
      3,
      2,
      2,
      1,
      1
     ]
    }
   },
   "features": [
    {
     "level": 1,
     "name": "Spellcasting",
     "description": "As a student of arcane magic, you have learned to cast spells. See \"Spells\" for the rules on spellcasting. The information below details how you use those rules with Wizard spells, which appear in the Wizard spell list later in the class's description.\n\n_Cantrips._ You know three Wizard cantrips of your choice. _Light_, _Mage Hand_, and _Ray of Frost_ are recommended. Whenever you finish a Long Rest, you can replace one of your cantrips from this feature with another Wizard cantrip of your choice.\n\nWhen you reach Wizard levels 4 and 10, you learn another Wizard cantrip of your choice, as shown in the Cantrips column of the Wizard Features table.\n\n_Spellbook._ Your wizardly apprenticeship culminated in the creation of a unique book: your spellbook. It is a Tiny object that weighs 3 pounds, contains 100 pages, and can be read only by you or someone casting _Identify_. You determine the book's appearance and materials, such as a gilt-edged tome or a collection of vellum bound with twine.\n\nThe book contains the level 1+ spells you know. It starts with six level 1 Wizard spells of your choice. _Detect Magic_, _Feather Fall_, _Mage Armor_, _Magic Missile_, _Sleep_, and _Thunderwave_ are recommended.\n\nWhenever you gain a Wizard level after 1, add two Wizard spells of your choice to your spellbook. Each of these spells must be of a level for which you have spell slots, as shown in the Wizard Features table. The spells are the culmination of arcane research you do regularly.\n\n_Spell Slots._ The Wizard Features table shows how many spell slots you have to cast your level 1+ spells. You regain all expended slots when you finish a Long Rest.\n\n_Prepared Spells of Level 1+._ You prepare the list of level 1+ spells that are available for you to cast with this feature. To do so, choose four spells from your spellbook. The chosen spells must be of a level for which you have spell slots.\n\nThe number of spells on your list increases as you gain Wizard levels, as shown in the Prepared Spells column of the Wizard Features table. Whenever that number increases, choose additional Wizard spells until the number of spells on your list matches the number in the table. The chosen spells must be of a level for which you have spell slots. For example, if you're a level 3 Wizard, your list of prepared spells can include six spells of levels 1 and 2 in any combination, chosen from your spellbook.\n\nIf another Wizard feature gives you spells that you always have prepared, those spells don't count against the number of spells you can prepare with this feature, but those spells otherwise count as Wizard spells for you.\n\n_Changing Your Prepared Spells._ Whenever you finish a Long Rest, you can change your list of prepared spells, replacing any of the spells there with spells from your spellbook.\n\n_Spellcasting Ability._ Intelligence is your spellcasting ability for your Wizard spells.\n\n_Spellcasting Focus._ You can use an Arcane Focus or your spellbook as a Spellcasting Focus for your Wizard spells."
    },
    {
     "level": 1,
     "name": "Ritual Adept",
     "description": "You can cast any spell as a Ritual if that spell has the Ritual tag and the spell is in your spellbook. You needn't have the spell prepared, but you must read from the book to cast a spell in this way."
    },
    {
     "level": 1,
     "name": "Arcane Recovery",
     "description": "You can regain some of your magical energy by studying your spellbook. When you finish a Short Rest, you can choose expended spell slots to recover. The spell slots can have a combined level equal to no more than half your Wizard level (round up), and none of the slots can be level 6 or higher. For example, if you're a level 4 Wizard, you can recover up to two levels' worth of spell slots, regaining either one level 2 spell slot or two level 1 spell slots.\n\nOnce you use this feature, you can't do so again until you finish a Long Rest."
    },
    {
     "level": 2,
     "name": "Scholar",
     "description": "While studying magic, you also specialized in another field of study. Choose one of the following skills in which you have proficiency: Arcana, History, Investigation, Medicine, Nature, or Religion. You have Expertise in the chosen skill."
    },
    {
     "level": 3,
     "name": "Wizard Subclass",
     "description": "You gain a Wizard subclass of your choice. The Evoker subclass is detailed after this class's description. A subclass is a specialization that grants you features at certain Wizard levels. For the rest of your career, you gain each of your subclass's features that are of your Wizard level or lower.\n\n> **Expanding and Replacing a Spellbook**\n>\n> The spells you add to your spellbook as you gain levels reflect your ongoing magical research, but you might find other spells during your adventures that you can add to the book. You could discover a Wizard spell on a _Spell Scroll_, for example, and then copy it into your spellbook.\n>\n> _Copying a Spell into the Book._ When you find a level 1+ Wizard spell, you can copy it into your spellbook if it's of a level you can prepare and if you have time to copy it. For each level of the spell, the transcription takes 2 hours and costs 50 GP. Afterward you can prepare the spell like the other spells in your spellbook.\n>\n> _Copying the Book._ You can copy a spell from your spellbook into another book. This is like copying a new spell into your spellbook but faster, since you already know how to cast the spell. You need spend only 1 hour and 10 GP for each level of the copied spell.\n>\n> If you lose your spellbook, you can use the same procedure to transcribe the Wizard spells that you have prepared into a new spellbook. Filling out the remainder of the new book requires you to find new spells to do so. For this reason, many wizards keep a backup spellbook."
    },
    {
     "level": 4,
     "name": "Ability Score Improvement",
     "description": "You gain the Ability Score Improvement feat (see \"Feats\") or another feat of your choice for which you qualify. You gain this feature again at Wizard levels 8, 12, and 16."
    },
    {
     "level": 5,
     "name": "Memorize Spell",
     "description": "Whenever you finish a Short Rest, you can study your spellbook and replace one of the level 1+ Wizard spells you have prepared for your Spellcasting feature with another level 1+ spell from the book."
    },
    {
     "level": 18,
     "name": "Spell Mastery",
     "description": "You have achieved such mastery over certain spells that you can cast them at will. Choose a level 1 and a level 2 spell in your spellbook that have a casting time of an action. You always have those spells prepared, and you can cast them at their lowest level without expending a spell slot. To cast either spell at a higher level, you must expend a spell slot.\n\nWhenever you finish a Long Rest, you can study your spellbook and replace one of those spells with an eligible spell of the same level from the book."
    },
    {
     "level": 19,
     "name": "Epic Boon",
     "description": "You gain an Epic Boon feat (see \"Feats\") or another feat of your choice for which you qualify. Boon of Spell Recall is recommended."
    },
    {
     "level": 20,
     "name": "Signature Spells",
     "description": "Choose two level 3 spells in your spellbook as your signature spells. You always have these spells prepared, and you can cast each of them once at level 3 without expending a spell slot. When you do so, you can't cast them in this way again until you finish a Short or Long Rest. To cast either spell at a higher level, you must expend a spell slot."
    }
   ],
   "subclassLevel": 3,
   "subclass": {
    "id": "evoker",
    "name": "Evoker",
    "tagline": "Create Explosive Elemental Effects",
    "description": "_Create Explosive Elemental Effects_\n\nYour studies focus on magic that creates powerful elemental effects such as bitter cold, searing flame, rolling thunder, crackling lightning, and burning acid. Some Evokers find employment in military forces, serving as artillery to blast armies from afar. Others use their power to protect others, while some seek their own gain.",
    "features": [
     {
      "level": 3,
      "name": "Evocation Savant",
      "description": "Choose two Wizard spells from the Evocation school, each of which must be no higher than level 2, and add them to your spellbook for free.\n\nIn addition, whenever you gain access to a new level of spell slots in this class, you can add one Wizard spell from the Evocation school to your spellbook for free. The chosen spell must be of a level for which you have spell slots."
     },
     {
      "level": 3,
      "name": "Potent Cantrip",
      "description": "Your damaging cantrips affect even creatures that avoid the brunt of the effect. When you cast a cantrip at a creature and you miss with the attack roll or the target succeeds on a saving throw against the cantrip, the target takes half the cantrip's damage (if any) but suffers no additional effect from the cantrip."
     },
     {
      "level": 6,
      "name": "Sculpt Spells",
      "description": "You can create pockets of relative safety within the effects of your evocations. When you cast an Evocation spell that affects other creatures that you can see, you can choose a number of them equal to 1 plus the spell's level. The chosen creatures automatically succeed on their saving throws against the spell, and they take no damage if they would normally take half damage on a successful save."
     },
     {
      "level": 10,
      "name": "Empowered Evocation",
      "description": "Whenever you cast a Wizard spell from the Evocation school, you can add your Intelligence modifier to one damage roll of that spell."
     },
     {
      "level": 14,
      "name": "Overchannel",
      "description": "You can increase the power of your spells. When you cast a Wizard spell with a spell slot of levels 1–5 that deals damage, you can deal maximum damage with that spell on the turn you cast it.\n\nThe first time you do so, you suffer no adverse effect. If you use this feature again before you finish a Long Rest, you take 2d12 Necrotic damage for each level of the spell slot immediately after you cast it. This damage ignores Resistance and Immunity.\n\nEach time you use this feature again before finishing a Long Rest, the Necrotic damage per spell level increases by 1d12."
     }
    ]
   },
   "spellList": {
    "0": [
     "acid-splash",
     "chill-touch",
     "dancing-lights",
     "elementalism",
     "fire-bolt",
     "light",
     "mage-hand",
     "mending",
     "message",
     "minor-illusion",
     "poison-spray",
     "prestidigitation",
     "ray-of-frost",
     "shocking-grasp",
     "true-strike"
    ],
    "1": [
     "alarm",
     "burning-hands",
     "charm-person",
     "chromatic-orb",
     "color-spray",
     "comprehend-languages",
     "detect-magic",
     "disguise-self",
     "expeditious-retreat",
     "false-life",
     "feather-fall",
     "find-familiar",
     "floating-disk",
     "fog-cloud",
     "grease",
     "hideous-laughter",
     "ice-knife",
     "identify",
     "illusory-script",
     "jump",
     "longstrider",
     "mage-armor",
     "magic-missile",
     "protection-from-evil-and-good",
     "ray-of-sickness",
     "shield",
     "silent-image",
     "sleep",
     "thunderwave",
     "unseen-servant"
    ],
    "2": [
     "acid-arrow",
     "alter-self",
     "arcane-lock",
     "arcanists-magic-aura",
     "augury",
     "blindness-deafness",
     "blur",
     "continual-flame",
     "darkness",
     "darkvision",
     "detect-thoughts",
     "dragons-breath",
     "enhance-ability",
     "enlarge-reduce",
     "flaming-sphere",
     "gentle-repose",
     "gust-of-wind",
     "hold-person",
     "invisibility",
     "knock",
     "levitate",
     "locate-object",
     "magic-mouth",
     "magic-weapon",
     "mind-spike",
     "mirror-image",
     "misty-step",
     "phantasmal-force",
     "ray-of-enfeeblement",
     "rope-trick",
     "scorching-ray",
     "see-invisibility",
     "shatter",
     "spider-climb",
     "suggestion",
     "web"
    ],
    "3": [
     "animate-dead",
     "bestow-curse",
     "blink",
     "clairvoyance",
     "counterspell",
     "dispel-magic",
     "fear",
     "fireball",
     "fly",
     "gaseous-form",
     "glyph-of-warding",
     "haste",
     "hypnotic-pattern",
     "lightning-bolt",
     "magic-circle",
     "major-image",
     "nondetection",
     "phantom-steed",
     "protection-from-energy",
     "remove-curse",
     "sending",
     "sleet-storm",
     "slow",
     "speak-with-dead",
     "stinking-cloud",
     "tiny-hut",
     "tongues",
     "vampiric-touch",
     "water-breathing"
    ],
    "4": [
     "arcane-eye",
     "banishment",
     "black-tentacles",
     "blight",
     "charm-monster",
     "confusion",
     "conjure-minor-elementals",
     "control-water",
     "dimension-door",
     "divination",
     "fabricate",
     "faithful-hound",
     "fire-shield",
     "greater-invisibility",
     "hallucinatory-terrain",
     "ice-storm",
     "locate-creature",
     "phantasmal-killer",
     "polymorph",
     "private-sanctum",
     "resilient-sphere",
     "secret-chest",
     "stone-shape",
     "stoneskin",
     "vitriolic-sphere",
     "wall-of-fire"
    ],
    "5": [
     "animate-objects",
     "arcane-hand",
     "cloudkill",
     "cone-of-cold",
     "conjure-elemental",
     "contact-other-plane",
     "creation",
     "dominate-person",
     "dream",
     "geas",
     "hold-monster",
     "legend-lore",
     "mislead",
     "modify-memory",
     "passwall",
     "planar-binding",
     "scrying",
     "seeming",
     "summon-dragon",
     "telekinesis",
     "telepathic-bond",
     "teleportation-circle",
     "wall-of-force",
     "wall-of-stone"
    ],
    "6": [
     "chain-lightning",
     "circle-of-death",
     "contingency",
     "create-undead",
     "disintegrate",
     "eyebite",
     "flesh-to-stone",
     "freezing-sphere",
     "globe-of-invulnerability",
     "guards-and-wards",
     "instant-summons",
     "irresistible-dance",
     "magic-jar",
     "mass-suggestion",
     "move-earth",
     "programmed-illusion",
     "sunbeam",
     "true-seeing",
     "wall-of-ice"
    ],
    "7": [
     "arcane-sword",
     "delayed-blast-fireball",
     "etherealness",
     "finger-of-death",
     "forcecage",
     "magnificent-mansion",
     "mirage-arcane",
     "plane-shift",
     "prismatic-spray",
     "project-image",
     "reverse-gravity",
     "sequester",
     "simulacrum",
     "symbol",
     "teleport"
    ],
    "8": [
     "antimagic-field",
     "antipathy-sympathy",
     "befuddlement",
     "clone",
     "control-weather",
     "demiplane",
     "dominate-monster",
     "incendiary-cloud",
     "maze",
     "mind-blank",
     "power-word-stun",
     "sunburst"
    ],
    "9": [
     "astral-projection",
     "foresight",
     "gate",
     "imprisonment",
     "meteor-swarm",
     "power-word-kill",
     "prismatic-wall",
     "shapechange",
     "time-stop",
     "true-polymorph",
     "weird",
     "wish"
    ]
   },
   "featLevels": [
    {
     "level": 4,
     "kind": "asi"
    },
    {
     "level": 8,
     "kind": "asi"
    },
    {
     "level": 12,
     "kind": "asi"
    },
    {
     "level": 16,
     "kind": "asi"
    },
    {
     "level": 19,
     "kind": "epic-boon"
    }
   ],
   "proficiencies": {
    "weapons": {
     "simple": true
    },
    "armor": {},
    "tools": []
   },
   "choices": [
    {
     "id": "scholar",
     "level": 2,
     "label": "Scholar (Expertise)",
     "type": "expertise",
     "count": 1,
     "from": [
      "arcana",
      "history",
      "investigation",
      "medicine",
      "nature",
      "religion"
     ]
    }
   ],
   "spellcasting": {
    "ability": "int",
    "focus": "Arcane Focus or spellbook",
    "ritual": true,
    "spellbook": {
     "initial": 6,
     "perLevel": 2
    },
    "type": "full"
   },
   "spellMastery": {
    "level": 18,
    "spellLevels": [
     1,
     2
    ],
    "castingTime": "Action"
   },
   "signatureSpells": {
    "level": 20,
    "count": 2,
    "spellLevel": 3
   },
   "alwaysPrepared": {}
  }
 },
 "metamagic": {
  "careful-spell": {
   "id": "careful-spell",
   "name": "Careful Spell",
   "cost": "1 Sorcery Point",
   "description": "When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell's full force. To do so, spend 1 Sorcery Point and choose a number of those creatures up to your Charisma modifier (minimum of one creature). A chosen creature automatically succeeds on its saving throw against the spell, and"
  },
  "distant-spell": {
   "id": "distant-spell",
   "name": "Distant Spell",
   "cost": "1 Sorcery Point",
   "description": "When you cast a spell that has a range of at least 5 feet, you can spend 1 Sorcery Point to double the spell's range. Or when you cast a spell that has a range of Touch, you can spend 1 Sorcery Point to make the spell's range 30 feet."
  },
  "empowered-spell": {
   "id": "empowered-spell",
   "name": "Empowered Spell",
   "cost": "1 Sorcery Point",
   "description": "When you roll damage for a spell, you can spend 1 Sorcery Point to reroll a number of the damage dice up to your Charisma modifier (minimum of one), and you must use the new rolls."
  },
  "extended-spell": {
   "id": "extended-spell",
   "name": "Extended Spell",
   "cost": "1 Sorcery Point",
   "description": "When you cast a spell that has a duration of 1 minute or longer, you can spend 1 Sorcery Point to double its duration to a maximum duration of 24 hours."
  },
  "heightened-spell": {
   "id": "heightened-spell",
   "name": "Heightened Spell",
   "cost": "2 Sorcery Points",
   "description": "When you cast a spell that forces a creature to make a saving throw, you can spend 2 Sorcery Points to give one target of the spell Disadvantage on saves against the spell."
  },
  "quickened-spell": {
   "id": "quickened-spell",
   "name": "Quickened Spell",
   "cost": "2 Sorcery Points",
   "description": "When you cast a spell that has a casting time of an action, you can spend 2 Sorcery Points to change the casting time to a Bonus Action for this casting. You can't modify a spell in this way if you've already cast a level 1+ spell on the current turn, nor can you cast a level 1+ spell on this turn after modifying a spell in this way."
  },
  "seeking-spell": {
   "id": "seeking-spell",
   "name": "Seeking Spell",
   "cost": "1 Sorcery Point",
   "description": "If you make an attack roll for a spell and miss, you can spend 1 Sorcery Point to reroll the d20, and you must use the new roll."
  },
  "subtle-spell": {
   "id": "subtle-spell",
   "name": "Subtle Spell",
   "cost": "1 Sorcery Point",
   "description": "When you cast a spell, you can spend 1 Sorcery Point to cast it without any Verbal, Somatic, or Material components, except Material components that are consumed by the spell or that have a cost specified in the spell."
  },
  "transmuted-spell": {
   "id": "transmuted-spell",
   "name": "Transmuted Spell",
   "cost": "1 Sorcery Point",
   "description": "When you cast a spell that deals a type of damage from the following list, you can spend 1 Sorcery Point to change that damage type to one of the other listed types: Acid, Cold, Fire, Lightning, Poison, Thunder."
  },
  "twinned-spell": {
   "id": "twinned-spell",
   "name": "Twinned Spell",
   "cost": "1 Sorcery Point",
   "description": "When you cast a spell, such as _Charm Person_, that can be cast with a higher-level spell slot to target an additional creature, you can spend 1 Sorcery Point to increase the spell's effective level by 1."
  }
 },
 "invocations": {
  "agonizing-blast": {
   "id": "agonizing-blast",
   "name": "Agonizing Blast",
   "prerequisite": "Level 2+ Warlock, a Warlock Cantrip That Deals Damage",
   "description": "Choose one of your known Warlock cantrips that deals damage. You can add your Charisma modifier to that spell's damage rolls.\n\n_Repeatable._ You can gain this invocation more than once. Each time you do so, choose a different eligible cantrip.",
   "minLevel": 2,
   "requiresInvocation": null,
   "requiresCantrip": "damage",
   "repeatable": true,
   "pick": {
    "type": "cantrip",
    "rangeAtLeast": 0
   }
  },
  "armor-of-shadows": {
   "id": "armor-of-shadows",
   "name": "Armor of Shadows",
   "prerequisite": null,
   "description": "You can cast _Mage Armor_ on yourself without expending a spell slot.",
   "minLevel": 1,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "ascendant-step": {
   "id": "ascendant-step",
   "name": "Ascendant Step",
   "prerequisite": "Level 5+ Warlock",
   "description": "You can cast _Levitate_ on yourself without expending a spell slot.",
   "minLevel": 5,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "devils-sight": {
   "id": "devils-sight",
   "name": "Devil's Sight",
   "prerequisite": "Level 2+ Warlock",
   "description": "You can see normally in Dim Light and Darkness—both magical and nonmagical—within 120 feet of yourself.",
   "minLevel": 2,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "devouring-blade": {
   "id": "devouring-blade",
   "name": "Devouring Blade",
   "prerequisite": "Level 12+ Warlock, Thirsting Blade Invocation",
   "description": "The Extra Attack of your Thirsting Blade invocation confers two extra attacks rather than one.",
   "minLevel": 12,
   "requiresInvocation": "thirsting-blade",
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "eldritch-mind": {
   "id": "eldritch-mind",
   "name": "Eldritch Mind",
   "prerequisite": null,
   "description": "You have Advantage on Constitution saving throws that you make to maintain Concentration.",
   "minLevel": 1,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "eldritch-smite": {
   "id": "eldritch-smite",
   "name": "Eldritch Smite",
   "prerequisite": "Level 5+ Warlock, Pact of the Blade Invocation",
   "description": "Once per turn when you hit a creature with your pact weapon, you can expend a Pact Magic spell slot to deal an extra 1d8 Force damage to the target,\nplus another 1d8 per level of the spell slot, and you can give the target the Prone condition if it is Huge or smaller.",
   "minLevel": 5,
   "requiresInvocation": "pact-of-the-blade",
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "eldritch-spear": {
   "id": "eldritch-spear",
   "name": "Eldritch Spear",
   "prerequisite": "Level 2+ Warlock, a Warlock Cantrip That Deals Damage",
   "description": "Choose one of your known Warlock cantrips that deals damage and has a range of 10+ feet. When you cast that spell, its range increases by a number of feet equal to 30 times your Warlock level.\n\n_Repeatable._ You can gain this invocation more than once. Each time you do so, choose a different eligible cantrip.",
   "minLevel": 2,
   "requiresInvocation": null,
   "requiresCantrip": "damage",
   "repeatable": true,
   "pick": {
    "type": "cantrip",
    "rangeAtLeast": 10
   }
  },
  "fiendish-vigor": {
   "id": "fiendish-vigor",
   "name": "Fiendish Vigor",
   "prerequisite": "Level 2+ Warlock",
   "description": "You can cast _False Life_ on yourself without expending a spell slot. When you cast the spell with this feature, you don't roll the die for the Temporary Hit Points; you automatically get the highest number on the die.",
   "minLevel": 2,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "gaze-of-two-minds": {
   "id": "gaze-of-two-minds",
   "name": "Gaze of Two Minds",
   "prerequisite": "Level 5+ Warlock",
   "description": "You can use a Bonus Action to touch a willing creature and perceive through its senses until the end of your next turn. As long as the creature is on the same plane of existence as you, you can take a Bonus Action on subsequent turns to maintain this connection, extending the duration until the end of your next turn. The connection ends if you don't maintain it in this way.\n\nWhile perceiving through the other creature's senses, you benefit from any special senses possessed by that creature, and you can cast spells as if you were in your space or the other creature's space if the two of you are within 60 feet of each other.",
   "minLevel": 5,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "gift-of-the-depths": {
   "id": "gift-of-the-depths",
   "name": "Gift of the Depths",
   "prerequisite": "Level 5+ Warlock",
   "description": "You can breathe underwater, and you gain a Swim Speed equal to your Speed.\n\nYou can also cast _Water Breathing_ once without expending a spell slot. You regain the ability to cast it in this way again when you finish a Long Rest.",
   "minLevel": 5,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "gift-of-the-protectors": {
   "id": "gift-of-the-protectors",
   "name": "Gift of the Protectors",
   "prerequisite": "Level 9+ Warlock, Pact of the Tome Invocation",
   "description": "A new page appears in your _Book of Shadows_ when you conjure it. With your permission, a creature can take an action to write its name on that page, which can contain a number of names equal to your Charisma modifier (minimum of one name).\n\nWhen any creature whose name is on the page is reduced to 0 Hit Points but not killed outright, the creature magically drops to 1 Hit Point instead. Once this magic is triggered, no creature can benefit from it until you finish a Long Rest.\n\nAs a Magic action, you can erase a name on the page by touching it.",
   "minLevel": 9,
   "requiresInvocation": "pact-of-the-tome",
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "investment-of-the-chain-master": {
   "id": "investment-of-the-chain-master",
   "name": "Investment of the Chain Master",
   "prerequisite": "Level 5+ Warlock, Pact of the Chain Invocation",
   "description": "When you cast _Find Familiar_, you infuse the summoned familiar with a measure of your eldritch power, granting the creature the following benefits.\n\n_Aerial or Aquatic._ The familiar gains either a Fly Speed or a Swim Speed (your choice) of 40 feet.\n\n_Quick Attack._ As a Bonus Action, you can command the familiar to take the Attack action.\n\n_Necrotic or Radiant Damage._ Whenever the familiar deals Bludgeoning, Piercing, or Slashing damage, you can make it deal Necrotic or Radiant damage instead.\n\n_Your Save DC._ If the familiar forces a creature to make a saving throw, it uses your spell save DC.\n\n_Resistance._ When the familiar takes damage, you can take a Reaction to grant it Resistance against that damage.",
   "minLevel": 5,
   "requiresInvocation": "pact-of-the-chain",
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "lessons-of-the-first-ones": {
   "id": "lessons-of-the-first-ones",
   "name": "Lessons of the First Ones",
   "prerequisite": "Level 2+ Warlock",
   "description": "You have received knowledge from an elder entity of the multiverse, allowing you to gain one Origin feat of your choice (see \"Feats\").\n\n_Repeatable._ You can gain this invocation more than once. Each time you do so, choose a different Origin feat.",
   "minLevel": 2,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": true,
   "pick": {
    "type": "feat",
    "featCategory": "origin"
   }
  },
  "lifedrinker": {
   "id": "lifedrinker",
   "name": "Lifedrinker",
   "prerequisite": "Level 9+ Warlock, Pact of the Blade Invocation",
   "description": "Once per turn when you hit a creature with your pact weapon, you can deal an extra 1d6 Necrotic, Psychic, or Radiant damage (your choice) to the creature, and you can expend one of your Hit Point Dice to roll it and regain a number of Hit Points equal to the roll plus your Constitution modifier (minimum of 1 Hit Point).",
   "minLevel": 9,
   "requiresInvocation": "pact-of-the-blade",
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "mask-of-many-faces": {
   "id": "mask-of-many-faces",
   "name": "Mask of Many Faces",
   "prerequisite": "Level 2+ Warlock",
   "description": "You can cast _Disguise Self_ without expending a spell slot.",
   "minLevel": 2,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "master-of-myriad-forms": {
   "id": "master-of-myriad-forms",
   "name": "Master of Myriad Forms",
   "prerequisite": "Level 5+ Warlock",
   "description": "You can cast _Alter Self_ without expending a spell slot.",
   "minLevel": 5,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "misty-visions": {
   "id": "misty-visions",
   "name": "Misty Visions",
   "prerequisite": "Level 2+ Warlock",
   "description": "You can cast _Silent Image_ without expending a spell slot.",
   "minLevel": 2,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "one-with-shadows": {
   "id": "one-with-shadows",
   "name": "One with Shadows",
   "prerequisite": "Level 5+ Warlock",
   "description": "While you're in an area of Dim Light or Darkness, you can cast _Invisibility_ on yourself without expending a spell slot.",
   "minLevel": 5,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "otherworldly-leap": {
   "id": "otherworldly-leap",
   "name": "Otherworldly Leap",
   "prerequisite": "Level 2+ Warlock",
   "description": "You can cast _Jump_ on yourself without expending a spell slot.",
   "minLevel": 2,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "pact-of-the-blade": {
   "id": "pact-of-the-blade",
   "name": "Pact of the Blade",
   "prerequisite": null,
   "description": "As a Bonus Action, you can conjure a pact weapon in your hand—a Simple or Martial Melee weapon of your choice with which you bond—or create a bond with a magic weapon you touch; you can't bond with a magic weapon if someone else is attuned to it or another Warlock is bonded with it. Until the bond ends, you have proficiency with the weapon, and you can use it as a Spellcasting Focus.\n\nWhenever you attack with the bonded weapon, you can use your Charisma modifier for the attack and damage rolls instead of using Strength or Dexterity; and you can cause the weapon to deal Necrotic, Psychic, or Radiant damage or its normal damage type.\n\nYour bond with the weapon ends if you use this feature's Bonus Action again, if the weapon is more than 5 feet away from you for 1 minute or more, or if you die. A conjured weapon disappears when the bond ends.",
   "minLevel": 1,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "pact-of-the-chain": {
   "id": "pact-of-the-chain",
   "name": "Pact of the Chain",
   "prerequisite": null,
   "description": "You learn the _Find Familiar_ spell and can cast it as a Magic action without expending a spell slot.\n\nWhen you cast the spell, you choose one of the normal forms for your familiar or one of the following special forms: **Imp, Pseudodragon, Quasit, Skeleton, Sphinx of Wonder, Sprite,** or **Venomous Snake** (see \"Monsters\" for the familiar's stat block).\n\nAdditionally, when you take the Attack action, you can forgo one of your own attacks to allow your familiar to make one attack of its own with its Reaction.",
   "minLevel": 1,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "pact-of-the-tome": {
   "id": "pact-of-the-tome",
   "name": "Pact of the Tome",
   "prerequisite": null,
   "description": "Stitching together strands of shadow, you conjure forth a book in your hand at the end of a Short or Long Rest. This _Book of Shadows_ (you determine its appearance) contains eldritch magic that only you can access, granting you the benefits below. The book disappears if you conjure another book with this feature or if you die.\n\n_Cantrips and Rituals._ When the book appears, choose three cantrips, and choose two level 1 spells that have the Ritual tag. The spells can be from any class's spell list, and they must be spells you don't already have prepared. While the book is on your person, you have the chosen spells prepared, and they function as Warlock spells for you.\n\n_Spellcasting Focus._ You can use the book as a Spellcasting Focus.",
   "minLevel": 1,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": {
    "type": "tome",
    "cantrips": 3,
    "rituals": 2
   }
  },
  "repelling-blast": {
   "id": "repelling-blast",
   "name": "Repelling Blast",
   "prerequisite": "Level 2+ Warlock, a Warlock Cantrip That Deals Damage via an Attack Roll",
   "description": "Choose one of your known Warlock cantrips that requires an attack roll. When you hit a Large or smaller creature with that cantrip, you can push the creature up to 10 feet straight away from you.\n\n_Repeatable._ You can gain this invocation more than once. Each time you do so, choose a different eligible cantrip.",
   "minLevel": 2,
   "requiresInvocation": null,
   "requiresCantrip": "attack",
   "repeatable": true,
   "pick": {
    "type": "cantrip",
    "rangeAtLeast": 0
   }
  },
  "thirsting-blade": {
   "id": "thirsting-blade",
   "name": "Thirsting Blade",
   "prerequisite": "Level 5+ Warlock, Pact of the Blade Invocation",
   "description": "You gain the Extra Attack feature for your pact weapon only. With that feature, you can attack twice with the weapon instead of once when you take the Attack action on your turn.",
   "minLevel": 5,
   "requiresInvocation": "pact-of-the-blade",
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "visions-of-distant-realms": {
   "id": "visions-of-distant-realms",
   "name": "Visions of Distant Realms",
   "prerequisite": "Level 9+ Warlock",
   "description": "You can cast _Arcane Eye_ without expending a spell slot.",
   "minLevel": 9,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "whispers-of-the-grave": {
   "id": "whispers-of-the-grave",
   "name": "Whispers of the Grave",
   "prerequisite": "Level 7+ Warlock",
   "description": "You can cast _Speak with Dead_ without expending a spell slot.",
   "minLevel": 7,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  },
  "witch-sight": {
   "id": "witch-sight",
   "name": "Witch Sight",
   "prerequisite": "Level 15+ Warlock",
   "description": "You have Truesight with a range of 30 feet.",
   "minLevel": 15,
   "requiresInvocation": null,
   "requiresCantrip": null,
   "repeatable": false,
   "pick": null
  }
 },
 "gear": {
  "acid": {
   "id": "acid",
   "name": "Acid",
   "cost": "25 GP",
   "description": "When you take the Attack action, you can replace one of your attacks with throwing a vial of Acid. Target one creature or object you can see within 20 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or take 2d6 Acid damage.",
   "contents": null
  },
  "alchemists-fire": {
   "id": "alchemists-fire",
   "name": "Alchemist's Fire",
   "cost": "50 GP",
   "description": "When you take the Attack action, you can replace one of your attacks with throwing a flask of Alchemist's Fire. Target one creature or object you can see within 20 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or take 1d4 Fire damage and start burning (see \"Rules Glossary\").",
   "contents": null
  },
  "ammunition": {
   "id": "ammunition",
   "name": "Ammunition",
   "cost": "Varies",
   "description": "Ammunition is required by a weapon that has the Ammunition property. A weapon's description specifies the type of ammunition used by the weapon. The Ammunition table lists the different types and the amount you get when you buy them. The table also lists the item that is typically used to store each type; storage must be bought separately.\n\n**Adventuring Gear**\n\n_Item — Weight — Cost_\n- Acid — 1 lb. — 25 GP\n- Alchemist's Fire — 1 lb. — 50 GP\n- Ammunition — Varies — Varies\n- Antitoxin — — — 50 GP\n- Arcane Focus — Varies — Varies\n- Backpack — 5 lb. — 2 GP\n- Ball Bearings — 2 lb. — 1 GP\n- Barrel — 70 lb. — 2 GP\n- Basket — 2 lb. — 4 SP\n- Bedroll — 7 lb. — 1 GP\n- Bell — — — 1 GP\n- Blanket — 3 lb. — 5 SP\n- Block and Tackle — 5 lb. — 1 GP\n- Book — 5 lb. — 25 GP\n- Bottle, Glass — 2 lb. — 2 GP\n- Bucket — 2 lb. — 5 CP\n- Burglar's Pack — 42 lb. — 16 GP\n- Caltrops — 2 lb. — 1 GP\n- Candle — — — 1 CP\n- Case, Crossbow Bolt — 1 lb. — 1 GP\n- Case, Map or Scroll — 1 lb. — 1 GP\n- Chain — 10 lb. — 5 GP\n- Chest — 25 lb. — 5 GP\n- Climber's Kit — 12 lb. — 25 GP\n- Clothes, Fine — 6 lb. — 15 GP\n- Clothes, Traveler's — 4 lb. — 2 GP\n- Component Pouch — 2 lb. — 25 GP\n- Costume — 4 lb. — 5 GP\n- Crowbar — 5 lb. — 2 GP\n- Diplomat's Pack — 39 lb. — 39 GP\n- Druidic Focus — Varies — Varies\n- Dungeoneer's Pack — 55 lb. — 12 GP\n- Entertainer's Pack — 58½ lb. — 40 GP\n- Explorer's Pack — 55 lb. — 10 GP\n- Flask — 1 lb. — 2 CP\n- Grappling Hook — 4 lb. — 2 GP\n- Healer's Kit — 3 lb. — 5 GP\n- Holy Symbol — Varies — Varies\n- Holy Water — 1 lb. — 25 GP\n- Hunting Trap — 25 lb. — 5 GP\n- Ink — — — 10 GP\n- Ink Pen — — — 2 CP\n- Jug — 4 lb. — 2 CP\n- Ladder — 25 lb. — 1 SP\n- Lamp — 1 lb. — 5 SP\n- Lantern, Bullseye — 2 lb. — 10 GP\n- Lantern, Hooded — 2 lb. — 5 GP\n- Lock — 1 lb. — 10 GP\n- Magnifying Glass — — — 100 GP\n- Manacles — 6 lb. — 2 GP\n- Map — — — 1 GP\n- Mirror — 1/2 lb. — 5 GP\n- Net — 3 lb. — 1 GP\n- Oil — 1 lb. — 1 SP\n- Paper — — — 2 SP\n- Parchment — — — 1 SP\n- Perfume — — — 5 GP\n- Poison, Basic — — — 100 GP\n- Pole — 7 lb. — 5 CP\n- Pot, Iron — 10 lb. — 2 GP\n- Potion of Healing — 1/2 lb. — 50 GP\n- Pouch — 1 lb. — 5 SP\n- Priest's Pack — 29 lb. — 33 GP\n- Quiver — 1 lb. — 1 GP\n- Ram, Portable — 35 lb. — 4 GP\n- Rations — 2 lb. — 5 SP\n- Robe — 4 lb. — 1 GP\n- Rope — 5 lb. — 1 GP\n- Sack — 1/2 lb. — 1 CP\n- Scholar's Pack — 22 lb. — 40 GP\n- Shovel — 5 lb. — 2 GP\n- Signal Whistle — — — 5 CP\n- Spell Scroll (Cantrip) — — — 30 GP\n- Spell Scroll (Level 1) — — — 50 GP\n- Spikes, Iron — 5 lb. — 1 GP\n- Spyglass — 1 lb. — 1,000 GP\n- String — — — 1 SP\n- Tent — 20 lb. — 2 GP\n- Tinderbox — 1 lb. — 5 SP\n- Torch — 1 lb. — 1 CP\n- Vial — — — 1 GP\n- Waterskin — 5 lb. (full) — 2 SP\n\n**Ammunition**\n\n_Type — Amount — Storage — Weight — Cost_\n- Arrows — 20 — Quiver — 1 lb. — 1 GP\n- Bolts — 20 — Case — 1½ lb. — 1 GP\n- Bullets, Firearm — 10 — Pouch — 2 lb. — 3 GP\n- Bullets, Sling — 20 — Pouch — 1½ lb. — 4 CP\n- Needles — 50 — Pouch — 1 lb. — 1 GP",
   "contents": null
  },
  "antitoxin": {
   "id": "antitoxin",
   "name": "Antitoxin",
   "cost": "50 GP",
   "description": "As a Bonus Action, you can drink a vial of Antitoxin to gain Advantage on saving throws to avoid or end the Poisoned condition for 1 hour.",
   "contents": null
  },
  "arcane-focus": {
   "id": "arcane-focus",
   "name": "Arcane Focus",
   "cost": "Varies",
   "description": "An Arcane Focus takes one of the forms in the Arcane Focuses table and is bejeweled or carved to channel arcane magic. A Sorcerer, Warlock, or Wizard can use such an item as a Spellcasting Focus.\n\n**Arcane Focuses**\n\n_Focus — Weight — Cost_\n- Crystal — 1 lb. — 10 GP\n- Orb — 3 lb. — 20 GP\n- Rod — 2 lb. — 10 GP\n- Staff (also a Quarterstaff) — 4 lb. — 5 GP\n- Wand — 1 lb. — 10 GP",
   "contents": null
  },
  "backpack": {
   "id": "backpack",
   "name": "Backpack",
   "cost": "2 GP",
   "description": "A Backpack holds up to 30 pounds within 1 cubic foot. It can also serve as a saddlebag.",
   "contents": null
  },
  "ball-bearings": {
   "id": "ball-bearings",
   "name": "Ball Bearings",
   "cost": "1 GP",
   "description": "As a Utilize action, you can spill Ball Bearings from their pouch. They spread to cover a level, 10-foot-square area within 10 feet of yourself. A creature that enters this area for the first time on a turn must succeed on a DC 10 Dexterity saving throw or have the Prone condition. It takes 10 minutes to recover the Ball Bearings.",
   "contents": null
  },
  "barrel": {
   "id": "barrel",
   "name": "Barrel",
   "cost": "2 GP",
   "description": "A Barrel holds up to 40 gallons of liquid or up to 4 cubic feet of dry goods.",
   "contents": null
  },
  "basket": {
   "id": "basket",
   "name": "Basket",
   "cost": "4 SP",
   "description": "A Basket holds up to 40 pounds within 2 cubic feet.",
   "contents": null
  },
  "bedroll": {
   "id": "bedroll",
   "name": "Bedroll",
   "cost": "1 GP",
   "description": "A Bedroll sleeps one Small or Medium creature. While in a Bedroll, you automatically succeed on saving throws against extreme cold (see \"Gameplay Toolbox\").",
   "contents": null
  },
  "bell": {
   "id": "bell",
   "name": "Bell",
   "cost": "1 GP",
   "description": "When rung as a Utilize action, a Bell produces a sound that can be heard up to 60 feet away.",
   "contents": null
  },
  "blanket": {
   "id": "blanket",
   "name": "Blanket",
   "cost": "5 SP",
   "description": "While wrapped in a blanket, you have Advantage on saving throws against extreme cold (see \"Gameplay Toolbox\").",
   "contents": null
  },
  "block-and-tackle": {
   "id": "block-and-tackle",
   "name": "Block and Tackle",
   "cost": "1 GP",
   "description": "A Block and Tackle allows you to hoist up to four times the weight you can normally lift.",
   "contents": null
  },
  "book": {
   "id": "book",
   "name": "Book",
   "cost": "25 GP",
   "description": "A Book contains fiction or nonfiction. If you consult an accurate nonfiction Book about its topic, you gain a +5 bonus to Intelligence (Arcana, History, Nature, or Religion) checks you make about that topic.",
   "contents": null
  },
  "bottle-glass": {
   "id": "bottle-glass",
   "name": "Bottle, Glass",
   "cost": "2 GP",
   "description": "A Glass Bottle holds up to 1½ pints.",
   "contents": null
  },
  "bucket": {
   "id": "bucket",
   "name": "Bucket",
   "cost": "5 CP",
   "description": "A Bucket holds up to half a cubic foot of contents.",
   "contents": null
  },
  "burglars-pack": {
   "id": "burglars-pack",
   "name": "Burglar's Pack",
   "cost": "16 GP",
   "description": "A Burglar's Pack contains the following items: Backpack, Ball Bearings, Bell, 10 Candles, Crowbar, Hooded Lantern, 7 flasks of Oil, 5 days of Rations, Rope, Tinderbox, and Waterskin.",
   "contents": [
    "Backpack",
    "Ball Bearings",
    "Bell",
    "10 Candles",
    "Crowbar",
    "Hooded Lantern",
    "7 flasks of Oil",
    "5 days of Rations",
    "Rope",
    "Tinderbox",
    "Waterskin"
   ]
  },
  "caltrops": {
   "id": "caltrops",
   "name": "Caltrops",
   "cost": "1 GP",
   "description": "As a Utilize action, you can spread Caltrops from their bag to cover a 5-foot-square area within 5 feet of yourself. A creature that enters this area for the first time on a turn must succeed on a DC 15 Dexterity saving throw or take 1 Piercing damage and have its Speed reduced to 0 until the start of its next turn. It takes 10 minutes to recover the Caltrops.",
   "contents": null
  },
  "candle": {
   "id": "candle",
   "name": "Candle",
   "cost": "1 CP",
   "description": "For 1 hour, a lit Candle sheds Bright Light in a 5-foot radius and Dim Light for an additional 5 feet.",
   "contents": null
  },
  "case-crossbow-bolt": {
   "id": "case-crossbow-bolt",
   "name": "Case, Crossbow Bolt",
   "cost": "1 GP",
   "description": "A Crossbow Bolt Case holds up to 20 Bolts.",
   "contents": null
  },
  "case-map-or-scroll": {
   "id": "case-map-or-scroll",
   "name": "Case, Map or Scroll",
   "cost": "1 GP",
   "description": "A Map or Scroll Case holds up to 10 sheets of paper or 5 sheets of parchment.",
   "contents": null
  },
  "chain": {
   "id": "chain",
   "name": "Chain",
   "cost": "5 GP",
   "description": "As a Utilize action, you can wrap a Chain around an unwilling creature within 5 feet of yourself that has the Grappled, Incapacitated, or Restrained condition if you succeed on a DC 13 Strength (Athletics) check. If the creature's legs are bound, the creature has the Restrained condition until it escapes. Escaping the Chain requires the creature to make a successful DC 18 Dexterity (Acrobatics) check as an action. Bursting the Chain requires a successful DC 20 Strength (Athletics) check as an action.",
   "contents": null
  },
  "chest": {
   "id": "chest",
   "name": "Chest",
   "cost": "5 GP",
   "description": "A Chest holds up to 12 cubic feet of contents.",
   "contents": null
  },
  "climbers-kit": {
   "id": "climbers-kit",
   "name": "Climber's Kit",
   "cost": "25 GP",
   "description": "A Climber's Kit includes boot tips, gloves, pitons, and a harness. As a Utilize action, you can use the Climber's Kit to anchor yourself; when you do, you can't fall more than 25 feet from the anchor point, and you can't move more than 25 feet from there without undoing the anchor as a Bonus Action.",
   "contents": null
  },
  "clothes-fine": {
   "id": "clothes-fine",
   "name": "Clothes, Fine",
   "cost": "15 GP",
   "description": "Fine Clothes are made of expensive fabrics and adorned with expertly crafted details. Some events and locations admit only people wearing these clothes.",
   "contents": null
  },
  "clothes-travelers": {
   "id": "clothes-travelers",
   "name": "Clothes, Traveler's",
   "cost": "2 GP",
   "description": "Traveler's Clothes are resilient garments designed for travel in various environments.",
   "contents": null
  },
  "component-pouch": {
   "id": "component-pouch",
   "name": "Component Pouch",
   "cost": "25 GP",
   "description": "A Component Pouch is watertight and filled with compartments that hold all the free Material components of your spells.",
   "contents": null
  },
  "costume": {
   "id": "costume",
   "name": "Costume",
   "cost": "5 GP",
   "description": "While wearing a Costume, you have Advantage on any ability check you make to impersonate the person or type of person it represents.",
   "contents": null
  },
  "crowbar": {
   "id": "crowbar",
   "name": "Crowbar",
   "cost": "2 GP",
   "description": "Using a Crowbar gives you Advantage on Strength checks where the Crowbar's leverage can be applied.",
   "contents": null
  },
  "diplomats-pack": {
   "id": "diplomats-pack",
   "name": "Diplomat's Pack",
   "cost": "39 GP",
   "description": "A Diplomat's Pack contains the following items: Chest, Fine Clothes, Ink, 5 Ink Pens, Lamp, 2 Map or Scroll Cases, 4 flasks of Oil, 5 sheets of Paper, 5 sheets of Parchment, Perfume, and Tinderbox.",
   "contents": [
    "Chest",
    "Fine Clothes",
    "Ink",
    "5 Ink Pens",
    "Lamp",
    "2 Map or Scroll Cases",
    "4 flasks of Oil",
    "5 sheets of Paper",
    "5 sheets of Parchment",
    "Perfume",
    "Tinderbox"
   ]
  },
  "druidic-focus": {
   "id": "druidic-focus",
   "name": "Druidic Focus",
   "cost": "Varies",
   "description": "A Druidic Focus takes one of the forms in the Druidic Focuses table and is carved, tied with ribbon, or painted to channel primal magic. A Druid or Ranger can use such an object as a Spellcasting Focus.\n\n**Druidic Focuses**\n\n_Focus — Weight — Cost_\n- Sprig of mistletoe — — — 1 GP\n- Wooden staff (also a Quarterstaff) — 4 lb. — 5 GP\n- Yew wand — 1 lb. — 10 GP",
   "contents": null
  },
  "dungeoneers-pack": {
   "id": "dungeoneers-pack",
   "name": "Dungeoneer's Pack",
   "cost": "12 GP",
   "description": "A Dungeoneer's Pack contains the following items: Backpack, Caltrops, Crowbar, 2 flasks of Oil, 10 days of Rations, Rope, Tinderbox, 10 Torches, and Waterskin.",
   "contents": [
    "Backpack",
    "Caltrops",
    "Crowbar",
    "2 flasks of Oil",
    "10 days of Rations",
    "Rope",
    "Tinderbox",
    "10 Torches",
    "Waterskin"
   ]
  },
  "entertainers-pack": {
   "id": "entertainers-pack",
   "name": "Entertainer's Pack",
   "cost": "40 GP",
   "description": "An Entertainer's Pack contains the following items: Backpack, Bedroll, Bell, Bullseye Lantern, 3 Costumes, Mirror, 8 flasks of Oil, 9 days of Rations, Tinderbox, and Waterskin.",
   "contents": [
    "Backpack",
    "Bedroll",
    "Bell",
    "Bullseye Lantern",
    "3 Costumes",
    "Mirror",
    "8 flasks of Oil",
    "9 days of Rations",
    "Tinderbox",
    "Waterskin"
   ]
  },
  "explorers-pack": {
   "id": "explorers-pack",
   "name": "Explorer's Pack",
   "cost": "10 GP",
   "description": "An Explorer's Pack contains the following items: Backpack, Bedroll, 2 flasks of Oil, 10 days of Rations, Rope, Tinderbox, 10 Torches, and Waterskin.",
   "contents": [
    "Backpack",
    "Bedroll",
    "2 flasks of Oil",
    "10 days of Rations",
    "Rope",
    "Tinderbox",
    "10 Torches",
    "Waterskin"
   ]
  },
  "flask": {
   "id": "flask",
   "name": "Flask",
   "cost": "2 CP",
   "description": "A Flask holds up to 1 pint.",
   "contents": null
  },
  "grappling-hook": {
   "id": "grappling-hook",
   "name": "Grappling Hook",
   "cost": "2 GP",
   "description": "As a Utilize action, you can throw the Grappling Hook at a railing, a ledge, or another catch within 50 feet of yourself, and the hook catches on if you succeed on a DC 13 Dexterity (Acrobatics) check. If you tied a Rope to the hook, you can then climb it.",
   "contents": null
  },
  "healers-kit": {
   "id": "healers-kit",
   "name": "Healer's Kit",
   "cost": "5 GP",
   "description": "A Healer's Kit has ten uses. As a Utilize action, you can expend one of its uses to stabilize an Unconscious creature that has 0 Hit Points without needing to make a Wisdom (Medicine) check.",
   "contents": null
  },
  "holy-symbol": {
   "id": "holy-symbol",
   "name": "Holy Symbol",
   "cost": "Varies",
   "description": "A Holy Symbol takes one of the forms in the Holy Symbol table and is bejeweled or painted to channel divine magic. A Cleric or Paladin can use a Holy Symbol as a Spellcasting Focus.\n\nThe table indicates whether a Holy Symbol needs to be held, worn, or borne on fabric (such as a tabard or banner) or a Shield.\n\n**Holy Symbols**\n\n_Symbol — Weight — Cost_\n- Amulet (worn or held) — 1 lb. — 5 GP\n- Emblem (borne on fabric or a Shield) — — — 5 GP\n- Reliquary (held) — 2 lb. — 5 GP",
   "contents": null
  },
  "holy-water": {
   "id": "holy-water",
   "name": "Holy Water",
   "cost": "25 GP",
   "description": "When you take the Attack action, you can replace one of your attacks with throwing a flask of Holy Water. Target one creature you can see within 20 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or take 2d8 Radiant damage if it is a Fiend or an Undead.",
   "contents": null
  },
  "hunting-trap": {
   "id": "hunting-trap",
   "name": "Hunting Trap",
   "cost": "5 GP",
   "description": "As a Utilize action, you can set a Hunting Trap, which is a sawtooth steel ring that snaps shut when a creature steps on a pressure plate in the center.\n\nThe trap is affixed by a heavy chain to an immobile object, such as a tree or a spike driven into the ground. A creature that steps on the plate must succeed on a DC 13 Dexterity saving throw or take 1d4 Piercing damage and have its Speed reduced to 0 until the start of its next turn. Thereafter, until the creature breaks free of the trap, its movement is limited by the length of the chain (typically 3 feet). A creature can use its action to make a DC 13 Strength (Athletics) check, freeing itself or another creature within its reach on a success. Each failed check deals 1 Piercing damage to the trapped creature.",
   "contents": null
  },
  "ink": {
   "id": "ink",
   "name": "Ink",
   "cost": "10 GP",
   "description": "Ink comes in a 1-ounce bottle, which provides enough ink to write about 500 pages.",
   "contents": null
  },
  "ink-pen": {
   "id": "ink-pen",
   "name": "Ink Pen",
   "cost": "2 CP",
   "description": "Using Ink, an Ink Pen is used to write or draw.",
   "contents": null
  },
  "jug": {
   "id": "jug",
   "name": "Jug",
   "cost": "2 CP",
   "description": "A Jug holds up to 1 gallon.",
   "contents": null
  },
  "ladder": {
   "id": "ladder",
   "name": "Ladder",
   "cost": "1 SP",
   "description": "A Ladder is 10 feet tall. You must climb to move up or down it.",
   "contents": null
  },
  "lamp": {
   "id": "lamp",
   "name": "Lamp",
   "cost": "5 SP",
   "description": "A Lamp burns Oil as fuel to cast Bright Light in a 15-foot radius and Dim Light for an additional 30 feet.",
   "contents": null
  },
  "lantern-bullseye": {
   "id": "lantern-bullseye",
   "name": "Lantern, Bullseye",
   "cost": "10 GP",
   "description": "A Bullseye Lantern burns Oil as fuel to cast Bright Light in a 60-foot Cone and Dim Light for an additional 60 feet.",
   "contents": null
  },
  "lantern-hooded": {
   "id": "lantern-hooded",
   "name": "Lantern, Hooded",
   "cost": "5 GP",
   "description": "A Hooded Lantern burns Oil as fuel to cast Bright Light in a 30-foot radius and Dim Light for an additional 30 feet. As a Bonus Action, you can lower the hood, reducing the light to Dim Light in a 5-foot radius, or raise it again.",
   "contents": null
  },
  "lock": {
   "id": "lock",
   "name": "Lock",
   "cost": "10 GP",
   "description": "A Lock comes with a key. Without the key, a creature can use Thieves' Tools to pick this Lock with a successful DC 15 Dexterity (Sleight of Hand) check.",
   "contents": null
  },
  "magnifying-glass": {
   "id": "magnifying-glass",
   "name": "Magnifying Glass",
   "cost": "100 GP",
   "description": "A Magnifying Glass grants Advantage on any ability check made to appraise or inspect a highly detailed item. Lighting a fire with a Magnifying Glass requires light as bright as sunlight to focus, tinder to ignite, and about 5 minutes for the fire to ignite.",
   "contents": null
  },
  "manacles": {
   "id": "manacles",
   "name": "Manacles",
   "cost": "2 GP",
   "description": "As a Utilize action, you can use Manacles to bind an unwilling Small or Medium creature within 5 feet of yourself that has the Grappled, Incapacitated, or Restrained condition if you succeed on a DC 13 Dexterity (Sleight of Hand) check. While bound, a creature has Disadvantage on attack rolls, and the creature is Restrained if the Manacles are attached to a chain or hook that is fixed in place. Escaping the Manacles requires a successful DC 20 Dexterity (Sleight of Hand) check as an action. Bursting them requires a successful DC 25 Strength (Athletics) check as an action.\n\nEach set of Manacles comes with a key. Without the key, a creature can use Thieves' Tools to pick the Manacles' lock with a successful DC 15 Dexterity (Sleight of Hand) check.",
   "contents": null
  },
  "map": {
   "id": "map",
   "name": "Map",
   "cost": "1 GP",
   "description": "If you consult an accurate Map, you gain a +5 bonus to Wisdom (Survival) checks you make to find your way in the place represented on it.",
   "contents": null
  },
  "mirror": {
   "id": "mirror",
   "name": "Mirror",
   "cost": "5 GP",
   "description": "A handheld steel Mirror is useful for personal cosmetics but also for peeking around corners and reflecting light as a signal.",
   "contents": null
  },
  "net": {
   "id": "net",
   "name": "Net",
   "cost": "1 GP",
   "description": "When you take the Attack action, you can replace one of your attacks with throwing a Net. Target a creature you can see within 15 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or have the Restrained condition until it escapes. The target succeeds automatically if it is Huge or larger.\n\nTo escape, the target or a creature within 5 feet of it must take an action to make a DC 10 Strength (Athletics) check, freeing the Restrained creature on a success. Destroying the Net (AC 10; 5 HP; Immunity to Bludgeoning, Poison, and Psychic damage) also frees the target, ending the effect.",
   "contents": null
  },
  "oil": {
   "id": "oil",
   "name": "Oil",
   "cost": "1 SP",
   "description": "You can douse a creature, object, or space with Oil or use it as fuel, as detailed below.\n\n_Dousing a Creature or an Object._ When you take the Attack action, you can replace one of your attacks with throwing an Oil flask. Target one creature or object within 20 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or be covered in oil. If the target takes Fire damage before the oil dries (after 1 minute), the target takes an extra 5 Fire damage from burning oil.\n\n_Dousing a Space._ You can take the Utilize action to pour an Oil flask on level ground to cover a 5-foot-square area within 5 feet of yourself. If lit, the oil burns until the end of the turn 2 rounds from when the oil was lit (or 12 seconds) and deals 5 Fire damage to any creature that enters the area or ends its turn there. A creature can take this damage only once per turn.\n\n_Fuel._ Oil serves as fuel for Lamps and Lanterns. Once lit, a flask of Oil burns for 6 hours in a Lamp or Lantern. That duration doesn't need to be consecutive; you can extinguish the burning Oil (as a Utilize action) and rekindle it again until it has burned for a total of 6 hours.",
   "contents": null
  },
  "paper": {
   "id": "paper",
   "name": "Paper",
   "cost": "2 SP",
   "description": "One sheet of Paper can hold about 250 handwritten words.",
   "contents": null
  },
  "parchment": {
   "id": "parchment",
   "name": "Parchment",
   "cost": "1 SP",
   "description": "One sheet of Parchment can hold about 250 handwritten words.",
   "contents": null
  },
  "perfume": {
   "id": "perfume",
   "name": "Perfume",
   "cost": "5 GP",
   "description": "Perfume comes in a 4-ounce vial. For 1 hour after applying Perfume to yourself, you have Advantage on Charisma (Persuasion) checks made to influence an Indifferent Humanoid within 5 feet of yourself.",
   "contents": null
  },
  "poison-basic": {
   "id": "poison-basic",
   "name": "Poison, Basic",
   "cost": "100 GP",
   "description": "As a Bonus Action, you can use a vial of Basic Poison to coat one weapon or up to three pieces of ammunition. A creature that takes Piercing or Slashing damage from the poisoned weapon or ammunition takes an extra 1d4 Poison damage. Once applied, the poison retains potency for 1 minute or until its damage is dealt, whichever comes first.",
   "contents": null
  },
  "pole": {
   "id": "pole",
   "name": "Pole",
   "cost": "5 CP",
   "description": "A Pole is 10 feet long. You can use it to touch something up to 10 feet away. If you must make a Strength (Athletics) check as part of a High or Long Jump, you can use the Pole to vault, giving yourself Advantage on the check.",
   "contents": null
  },
  "pot-iron": {
   "id": "pot-iron",
   "name": "Pot, Iron",
   "cost": "2 GP",
   "description": "An Iron Pot holds up to 1 gallon.",
   "contents": null
  },
  "potion-of-healing": {
   "id": "potion-of-healing",
   "name": "Potion of Healing",
   "cost": "50 GP",
   "description": "This potion is a magic item. As a Bonus Action, you can drink it or administer it to another creature within 5 feet of yourself. The creature that drinks the magical red fluid in this vial regains 2d4 + 2 Hit Points.",
   "contents": null
  },
  "pouch": {
   "id": "pouch",
   "name": "Pouch",
   "cost": "5 SP",
   "description": "A Pouch holds up to 6 pounds within one-fifth of a cubic foot.",
   "contents": null
  },
  "priests-pack": {
   "id": "priests-pack",
   "name": "Priest's Pack",
   "cost": "33 GP",
   "description": "A Priest's Pack contains the following items: Backpack, Blanket, Holy Water, Lamp, 7 days of Rations, Robe, and Tinderbox.",
   "contents": [
    "Backpack",
    "Blanket",
    "Holy Water",
    "Lamp",
    "7 days of Rations",
    "Robe",
    "Tinderbox"
   ]
  },
  "quiver": {
   "id": "quiver",
   "name": "Quiver",
   "cost": "1 GP",
   "description": "A Quiver holds up to 20 Arrows.",
   "contents": null
  },
  "ram-portable": {
   "id": "ram-portable",
   "name": "Ram, Portable",
   "cost": "4 GP",
   "description": "You can use a Portable Ram to break down doors. When doing so, you gain a +4 bonus to the Strength check. One other character can help you use the ram, giving you Advantage on this check.",
   "contents": null
  },
  "rations": {
   "id": "rations",
   "name": "Rations",
   "cost": "5 SP",
   "description": "Rations consist of travel-ready food, including jerky, dried fruit, hardtack, and nuts. See \"Malnutrition\" in \"Rules Glossary\" for the risks of not eating.",
   "contents": null
  },
  "robe": {
   "id": "robe",
   "name": "Robe",
   "cost": "1 GP",
   "description": "A Robe has vocational or ceremonial significance. Some events and locations admit only people wearing a Robe bearing certain colors or symbols.",
   "contents": null
  },
  "rope": {
   "id": "rope",
   "name": "Rope",
   "cost": "1 GP",
   "description": "As a Utilize action, you can tie a knot with Rope if you succeed on a DC 10 Dexterity (Sleight of Hand) check. The Rope can be burst with a successful DC 20 Strength (Athletics) check.\n\nYou can bind an unwilling creature with the Rope only if the creature has the Grappled, Incapacitated, or Restrained condition. If the creature's legs are bound, the creature has the Restrained condition until it escapes. Escaping the Rope requires the creature to make a successful DC 15 Dexterity (Acrobatics) check as an action.",
   "contents": null
  },
  "sack": {
   "id": "sack",
   "name": "Sack",
   "cost": "1 CP",
   "description": "A Sack holds up to 30 pounds within 1 cubic foot.",
   "contents": null
  },
  "scholars-pack": {
   "id": "scholars-pack",
   "name": "Scholar's Pack",
   "cost": "40 GP",
   "description": "A Scholar's Pack contains the following items: Backpack, Book, Ink, Ink Pen, Lamp, 10 flasks of Oil, 10 sheets of Parchment, and Tinderbox.",
   "contents": [
    "Backpack",
    "Book",
    "Ink",
    "Ink Pen",
    "Lamp",
    "10 flasks of Oil",
    "10 sheets of Parchment",
    "Tinderbox"
   ]
  },
  "shovel": {
   "id": "shovel",
   "name": "Shovel",
   "cost": "2 GP",
   "description": "Working for 1 hour, you can use a Shovel to dig a hole that is 5 feet on each side in soil or similar material.",
   "contents": null
  },
  "signal-whistle": {
   "id": "signal-whistle",
   "name": "Signal Whistle",
   "cost": "5 CP",
   "description": "When blown as a Utilize action, a Signal Whistle produces a sound that can be heard up to 600 feet away.",
   "contents": null
  },
  "spell-scroll": {
   "id": "spell-scroll",
   "name": "Spell Scroll",
   "cost": "Cantrip, 30 GP; Level 1, 50 GP",
   "description": "A _Spell Scroll_ (Cantrip) or _Spell Scroll_ (Level 1) is a magic item that bears the words of a cantrip or level 1 spell, respectively, determined by the scroll's creator. If the spell is on your class's spell list, you can read the scroll and cast the spell using its normal casting time and without providing any Material components.\n\nIf the spell requires a saving throw or an attack roll, the spell save DC is 13, and the attack bonus is +5. The scroll disintegrates when the casting is completed.",
   "contents": null
  },
  "spikes-iron": {
   "id": "spikes-iron",
   "name": "Spikes, Iron",
   "cost": "1 GP",
   "description": "Iron Spikes come in bundles of ten. As a Utilize action, you can use a blunt object, such as a Light Hammer, to hammer a spike into wood, earth, or a similar material. You can do so to jam a door shut or to then tie a Rope or Chain to the Spike.",
   "contents": null
  },
  "spyglass": {
   "id": "spyglass",
   "name": "Spyglass",
   "cost": "1,000 GP",
   "description": "Objects viewed through a Spyglass are magnified to twice their size.",
   "contents": null
  },
  "string": {
   "id": "string",
   "name": "String",
   "cost": "1 SP",
   "description": "String is 10 feet long. You can tie a knot in it as a Utilize action.",
   "contents": null
  },
  "tent": {
   "id": "tent",
   "name": "Tent",
   "cost": "2 GP",
   "description": "A Tent sleeps up to two Small or Medium creatures.",
   "contents": null
  },
  "tinderbox": {
   "id": "tinderbox",
   "name": "Tinderbox",
   "cost": "5 SP",
   "description": "A Tinderbox is a small container holding flint, fire steel, and tinder (usually dry cloth soaked in light oil) used to kindle a fire. Using it to light a Candle, Lamp, Lantern, or Torch—or anything else with exposed fuel—takes a Bonus Action. Lighting any other fire takes 1 minute.",
   "contents": null
  },
  "torch": {
   "id": "torch",
   "name": "Torch",
   "cost": "1 CP",
   "description": "A Torch burns for 1 hour, casting Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. When you take the Attack action, you can attack with the Torch, using it as a Simple Melee weapon. On a hit, the target takes 1 Fire damage.",
   "contents": null
  },
  "vial": {
   "id": "vial",
   "name": "Vial",
   "cost": "1 GP",
   "description": "A Vial holds up to 4 ounces.",
   "contents": null
  },
  "waterskin": {
   "id": "waterskin",
   "name": "Waterskin",
   "cost": "2 SP",
   "description": "A Waterskin holds up to 4 pints. If you don't drink sufficient water, you risk dehydration (see \"Rules Glossary\").",
   "contents": null
  }
 }
};
  Object.keys(core).forEach(function (k) { rules[k] = core[k]; });
})(window);
