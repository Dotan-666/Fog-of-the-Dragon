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
   "fighter",
   "rogue",
   "cleric",
   "wizard"
  ],
  "coverageNote": "Includes the Fighter, Rogue, Cleric and Wizard (levels 1–20) with their SRD subclasses, all 9 SRD species, all 4 SRD backgrounds, all SRD feats, and the complete SRD spell lists. The other 8 SRD classes and multiclassing are not supported yet."
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
 "skills": [
  {
   "id": "acrobatics",
   "name": "Acrobatics",
   "ability": "dex"
  },
  {
   "id": "animal-handling",
   "name": "Animal Handling",
   "ability": "wis"
  },
  {
   "id": "arcana",
   "name": "Arcana",
   "ability": "int"
  },
  {
   "id": "athletics",
   "name": "Athletics",
   "ability": "str"
  },
  {
   "id": "deception",
   "name": "Deception",
   "ability": "cha"
  },
  {
   "id": "history",
   "name": "History",
   "ability": "int"
  },
  {
   "id": "insight",
   "name": "Insight",
   "ability": "wis"
  },
  {
   "id": "intimidation",
   "name": "Intimidation",
   "ability": "cha"
  },
  {
   "id": "investigation",
   "name": "Investigation",
   "ability": "int"
  },
  {
   "id": "medicine",
   "name": "Medicine",
   "ability": "wis"
  },
  {
   "id": "nature",
   "name": "Nature",
   "ability": "int"
  },
  {
   "id": "perception",
   "name": "Perception",
   "ability": "wis"
  },
  {
   "id": "performance",
   "name": "Performance",
   "ability": "cha"
  },
  {
   "id": "persuasion",
   "name": "Persuasion",
   "ability": "cha"
  },
  {
   "id": "religion",
   "name": "Religion",
   "ability": "int"
  },
  {
   "id": "sleight-of-hand",
   "name": "Sleight of Hand",
   "ability": "dex"
  },
  {
   "id": "stealth",
   "name": "Stealth",
   "ability": "dex"
  },
  {
   "id": "survival",
   "name": "Survival",
   "ability": "wis"
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
   "name": "Alchemist's Supplies"
  },
  {
   "id": "brewers-supplies",
   "name": "Brewer's Supplies"
  },
  {
   "id": "calligraphers-supplies",
   "name": "Calligrapher's Supplies"
  },
  {
   "id": "carpenters-tools",
   "name": "Carpenter's Tools"
  },
  {
   "id": "cartographers-tools",
   "name": "Cartographer's Tools"
  },
  {
   "id": "cobblers-tools",
   "name": "Cobbler's Tools"
  },
  {
   "id": "cooks-utensils",
   "name": "Cook's Utensils"
  },
  {
   "id": "glassblowers-tools",
   "name": "Glassblower's Tools"
  },
  {
   "id": "jewelers-tools",
   "name": "Jeweler's Tools"
  },
  {
   "id": "leatherworkers-tools",
   "name": "Leatherworker's Tools"
  },
  {
   "id": "masons-tools",
   "name": "Mason's Tools"
  },
  {
   "id": "painters-supplies",
   "name": "Painter's Supplies"
  },
  {
   "id": "potters-tools",
   "name": "Potter's Tools"
  },
  {
   "id": "smiths-tools",
   "name": "Smith's Tools"
  },
  {
   "id": "tinkers-tools",
   "name": "Tinker's Tools"
  },
  {
   "id": "weavers-tools",
   "name": "Weaver's Tools"
  },
  {
   "id": "woodcarvers-tools",
   "name": "Woodcarver's Tools"
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
     "wis"
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
    ]
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
   }
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
   ]
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
      "description": "Your connection to this divine domain ensures you always have certain spells ready. When you reach a Cleric level specified in the Life Domain Spells table, you thereafter always have the listed spells prepared."
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
    "ritual": false
   }
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
    }
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
   }
  }
 },
 "extraSpellLists": {
  "druid": {
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
   ]
  }
 }
};
  Object.keys(core).forEach(function (k) { rules[k] = core[k]; });
})(window);
