#!/usr/bin/env node
/**
 * Fog of the Dragon — SRD 5.2.1 rules data generator
 *
 * Builds the character-engine data files from the System Reference Document 5.2.1.
 *
 *   node tools/build-srd-data.mjs --md <dir> [--json <dir>]
 *
 * --md   Folder with the SRD 5.2.1 Markdown conversion
 *        (https://github.com/downfallx/dnd-5e-srd-markdown, CC BY 4.0).
 *        This is the primary source: names, numbers and rules text come from here.
 * --json Optional folder with 5e-bits/5e-database `src/2024/en` JSON files (MIT code, SRD content).
 *        Used only as a cross-check; every disagreement is printed so it can be reviewed.
 *
 * Output:
 *   JS/character-engine/data/srd-5.2.1-core.js
 *   JS/character-engine/data/srd-5.2.1-spells.js
 *
 * The generator only reads the source folders as data; nothing from them is executed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCES = {
  markdown: 'downfallx/dnd-5e-srd-markdown@1b4b99dcb786cdd1a2fb26f8acec1551191f1ca4',
  json: '5e-bits/5e-database@a6212beb4b278917c2cff41c2b04c4ef4f3e0d6f (src/2024/en)',
};

const ATTRIBUTION =
  'This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, ' +
  'available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 ' +
  'International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';

const CLASS_NAMES = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
const SUPPORTED_CLASSES = CLASS_NAMES.map((n) => n.toLowerCase());

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const MD_DIR = arg('--md');
const JSON_DIR = arg('--json');
if (!MD_DIR) {
  console.error('Usage: node tools/build-srd-data.mjs --md <srd-markdown-dir> [--json <5e-database 2024/en dir>]');
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'JS', 'character-engine', 'data');

const readMd = (name) => fs.readFileSync(path.join(MD_DIR, name), 'utf8').replace(/\r\n/g, '\n');
const warnings = [];
const warn = (msg) => warnings.push(msg);
function assert(cond, msg) {
  if (!cond) throw new Error('Source check failed: ' + msg);
}

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------
const slug = (s) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ABILITY_BY_NAME = {
  strength: 'str', dexterity: 'dex', constitution: 'con',
  intelligence: 'int', wisdom: 'wis', charisma: 'cha',
};

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** Text between a heading line and the next heading of the same or higher level. */
function section(md, heading) {
  const level = heading.match(/^#+/)[0].length;
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+) /);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

/** All `#### Level N: Name` blocks inside a block of text. */
function levelFeatures(text) {
  const out = [];
  const re = /^#### Level (\d+): (.+)$/gm;
  const marks = [...text.matchAll(re)];
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    let body = text.slice(m.index + m[0].length, end);
    const nextHeading = body.search(/^#{2,3} /m);
    if (nextHeading >= 0) body = body.slice(0, nextHeading);
    out.push({ level: Number(m[1]), name: m[2].trim(), description: cleanBody(body) });
  });
  return out;
}

/** Rows (arrays of cell text) of the HTML table that follows `**Title**`. */
function tableAfter(text, title) {
  const i = text.indexOf(`**${title}**`);
  if (i < 0) return null;
  const end = text.indexOf('</table>', i);
  const t = text.slice(i, end);
  return [...t.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((x) => stripTags(x[1]))
  );
}

/** Rows of the first HTML table after a heading line. */
function tableAfterHeading(text, heading) {
  const i = text.indexOf(heading);
  if (i < 0) return null;
  const start = text.indexOf('<table>', i);
  const end = text.indexOf('</table>', start);
  const t = text.slice(start, end);
  return [...t.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((x) => stripTags(x[1]))
  );
}

/** A rules table inside a description (e.g. Prismatic Spray's rays) becomes a readable list, so no rules text is lost. */
function tableToText(table) {
  const cellText = (c) => c.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/(^|[\s(])\*([^*]+)\*(?=[\s.,;:)]|$)/g, '$1_$2_').trim();
  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((x) => cellText(x[1])));
  if (!rows.length) return '';
  const [head, ...data] = rows;
  return '_' + head.join(' — ') + '_\n' + data.map((r) => '- ' + r.join(' — ')).join('\n');
}

/** Feature/trait body: tables become lists, blank runs collapse; keep light Markdown. */
function cleanBody(body) {
  return body
    .replace(/<table>[\s\S]*?<\/table>/g, (t) => '\n' + tableToText(t) + '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();
}

const num = (s) => {
  const t = String(s).replace(/[+—–]/g, '').trim();
  return t === '' ? 0 : Number(t);
};

// ---------------------------------------------------------------------------
// Skills, languages, ability methods
// ---------------------------------------------------------------------------
const creationMd = readMd('character-creation.md');

const SKILLS = [
  ['Acrobatics', 'dex'], ['Animal Handling', 'wis'], ['Arcana', 'int'], ['Athletics', 'str'],
  ['Deception', 'cha'], ['History', 'int'], ['Insight', 'wis'], ['Intimidation', 'cha'],
  ['Investigation', 'int'], ['Medicine', 'wis'], ['Nature', 'int'], ['Perception', 'wis'],
  ['Performance', 'cha'], ['Persuasion', 'cha'], ['Religion', 'int'], ['Sleight of Hand', 'dex'],
  ['Stealth', 'dex'], ['Survival', 'wis'],
].map(([name, ability]) => ({ id: slug(name), name, ability }));
const SKILL_BY_NAME = Object.fromEntries(SKILLS.map((s) => [s.name.toLowerCase(), s.id]));

function parseLanguages() {
  const std = tableAfter(creationMd, 'Standard Languages').slice(1).map((r) => r[1]);
  // The Rare Languages table lists two languages per row; "*" marks a footnote.
  const rare = tableAfter(creationMd, 'Rare Languages').slice(1).flat().map((n) => n.replace(/\*$/, '')).filter(Boolean).sort();
  assert(rare.length === 9 && rare.includes('Infernal'), 'rare languages table');
  assert(std.includes('Common') && std.length >= 10, 'standard languages table');
  return {
    standard: std.map((name) => ({ id: slug(name), name })),
    rare: rare.map((name) => ({ id: slug(name), name })),
  };
}

function parseAbilityMethods() {
  const costs = {};
  tableAfter(creationMd, 'Ability Score Point Costs').slice(1).forEach((r) => {
    for (let i = 0; i < r.length; i += 2) costs[Number(r[i])] = Number(r[i + 1]);
  });
  assert(costs[8] === 0 && costs[15] === 9 && costs[14] === 7, 'point cost table');
  const arrayLine = creationMd.match(/_Standard Array\._[^\n]*?(\d+(?:, \d+){5})/);
  assert(arrayLine, 'standard array line');
  const budget = Number(creationMd.match(/You have (\d+) points to spend/)[1]);
  return {
    'standard-array': {
      id: 'standard-array',
      label: 'Standard Array',
      description: 'Assign each of these six scores to a different ability: ' + arrayLine[1] + '.',
      scores: arrayLine[1].split(', ').map(Number),
    },
    'point-buy': {
      id: 'point-buy',
      label: 'Point Cost (' + budget + ' points)',
      description:
        'Spend ' + budget + ' points. Every score starts at 8 and can be raised to at most 15 before background increases.',
      min: 8, max: 15, budget, costs,
    },
    random: {
      id: 'random',
      label: 'Random Generation',
      description:
        'Roll four d6 and add the highest three, six times, then assign the totals to your abilities. ' +
        'You can roll here or enter scores you rolled at the table (3–18).',
      min: 3, max: 18,
    },
  };
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------
const equipMd = readMd('equipment.md');

function parseWeapons() {
  const rows = tableAfter(equipMd, 'Weapons');
  const weapons = {};
  let category = null;
  rows.slice(1).forEach((r) => {
    if (r.length === 1) {
      category = r[0];
      return;
    }
    const [name, damage, props, mastery] = r;
    const dm = damage.match(/^(\d+d\d+|\d+) (\w+)$/);
    assert(dm, 'weapon damage ' + name);
    const properties = props === '—' ? [] : props.split(/, (?![^()]*\))/).map((p) => p.trim());
    const id = slug(name);
    weapons[id] = {
      id, name,
      category: /^Simple/.test(category) ? 'simple' : 'martial',
      kind: /Ranged/.test(category) ? 'ranged' : 'melee',
      damage: dm[1], damageType: dm[2],
      properties,
      finesse: properties.includes('Finesse'),
      light: properties.includes('Light'),
      mastery,
    };
  });
  assert(Object.keys(weapons).length >= 38, 'weapons table size');
  return weapons;
}

function parseArmor() {
  const rows = tableAfter(equipMd, 'Armor');
  const armor = {};
  let category = null;
  rows.slice(1).forEach((r) => {
    if (r.length === 1) {
      category = r[0].split(' ')[0].toLowerCase(); // light | medium | heavy | shield
      return;
    }
    const [name, ac, str, stealth] = r;
    const id = slug(name);
    if (category === 'shield') {
      armor[id] = { id, name, category: 'shield', acBonus: num(ac) };
      return;
    }
    const m = ac.match(/^(\d+)(?: \+ Dex modifier( \(max (\d)\))?)?$/);
    assert(m, 'armor AC ' + name);
    armor[id] = {
      id, name, category,
      baseAC: Number(m[1]),
      addDex: /Dex/.test(ac),
      maxDex: m[3] ? Number(m[3]) : null,
      strength: str === '—' ? null : Number(str.replace(/\D/g, '')),
      stealthDisadvantage: stealth === 'Disadvantage',
    };
  });
  assert(armor['chain-mail'] && armor['chain-mail'].baseAC === 16, 'chain mail AC');
  return armor;
}

function parseMasteryProperties() {
  const sec = section(equipMd, '### Mastery Properties');
  const out = {};
  for (const m of sec.matchAll(/^\*\*(\w+)\.\*\* (.+)$/gm)) out[m[1]] = m[2].trim();
  assert(Object.keys(out).length === 8, 'eight mastery properties');
  return out;
}

/** Weapon property definitions ("Finesse", "Heavy" …) and the weapon proficiency rule, from Equipment. */
function parseWeaponRules() {
  const sec = section(equipMd, '### Properties');
  const props = {};
  for (const m of sec.matchAll(/^\*\*([\w-]+)\.\*\*\s*\n*\s*(.+)$/gm)) props[m[1]] = m[2].trim();
  assert(['Ammunition', 'Finesse', 'Heavy', 'Light', 'Loading', 'Range', 'Reach', 'Thrown', 'Two-Handed', 'Versatile'].every((k) => props[k]), 'weapon properties');
  const prof = (section(equipMd, '### Weapon Proficiency') || '').split('\n').slice(1).join(' ').trim();
  assert(/must have proficiency with it to add your Proficiency Bonus to an attack roll/.test(prof), 'weapon proficiency rule');
  return { properties: props, proficiency: prof };
}

/** "The Six Abilities" descriptions and the Skills table example uses, from Playing the Game. */
function parseAbilityAndSkillText(skills) {
  const playMd = readMd('playing-the-game.md');
  const abil = tableAfter(playMd, 'Ability Descriptions').slice(1);
  const abilityDescriptions = {};
  abil.forEach(([name, measures]) => { abilityDescriptions[ABILITY_BY_NAME[name.toLowerCase()]] = measures; });
  assert(Object.keys(abilityDescriptions).length === 6 && abilityDescriptions.str === 'Physical might', 'ability descriptions');
  const rows = tableAfter(playMd, 'Skills').slice(1);
  rows.forEach(([name, , uses]) => {
    const s = skills.find((x) => x.name === name);
    assert(s, 'skill row ' + name);
    s.exampleUses = uses;
  });
  assert(skills.every((s) => s.exampleUses), 'every skill has example uses');
  return abilityDescriptions;
}

function parseTools() {
  const sec = section(equipMd, '## Tools');
  const artisanSec = section(sec, "#### Artisan's Tools") || '';
  const tools = [...sec.matchAll(/^\*\*([^*(]+?) \([\d,]+ [GSC]P\)\*\*$/gm)].map((m) => {
    const name = m[1].trim();
    return Object.assign({ id: slug(name), name }, artisanSec.indexOf(m[0]) >= 0 ? { family: 'artisan' } : {});
  });
  assert(tools.filter((t) => t.family === 'artisan').length === 17, "17 Artisan's Tools");
  // Gaming Set and Musical Instrument are families: one proficiency per variant.
  for (const m of sec.matchAll(/^\*\*([^*(]+?) \(Varies\)\*\*\n[\s\S]*?^\*\*Variants:\*\* (.+)$/gm)) {
    const family = m[1].trim();
    m[2].split(/,\s*(?![^()]*\))/).forEach((v) => {
      const variant = v.replace(/\s*\([^)]*\)\s*$/, '').trim();
      const name = family + ' (' + variant.charAt(0).toUpperCase() + variant.slice(1) + ')';
      tools.push({ id: slug(name), name, family: slug(family) });
    });
  }
  assert(tools.some((t) => t.name === "Thieves' Tools") && tools.filter((t) => t.family === 'gaming-set').length === 4, 'tools list');
  return tools;
}

/** "(A) Chain Mail, Greatsword, 8 Javelins, and 4 GP; (B) ...; or (C) 155 GP" */
function parseEquipmentOptions(text, weapons, armor) {
  const parts = text.split(/\(([A-C])\)\s*/).slice(1);
  const options = [];
  for (let i = 0; i < parts.length; i += 2) {
    const id = parts[i];
    const body = parts[i + 1].replace(/;?\s*(or\s*)?$/, '').replace(/;\s*$/, '');
    let gp = 0;
    const items = [];
    body.split(/,\s*(?:and\s+)?/).map((s) => s.replace(/^and\s+/, '').trim()).filter(Boolean).forEach((raw) => {
      const money = raw.match(/^(\d+) GP$/);
      if (money) {
        gp += Number(money[1]);
        return;
      }
      const cm = raw.match(/^(\d+) (.+)$/);
      const count = cm ? Number(cm[1]) : 1;
      const name = cm ? cm[2] : raw;
      items.push({ name, count, ...itemRef(name, weapons, armor) });
    });
    options.push({ id, label: 'Option ' + id, items, gp });
  }
  assert(options.length >= 2, 'equipment options in: ' + text);
  return options;
}

function singular(name) {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y');
  if (/Pouches$/.test(name)) return name.replace(/es$/, '');
  if (/(Daggers|Javelins|Arrows|Bolts|Darts|Handaxes|Shortswords)$/.test(name)) return name.replace(/s$/, '');
  return name;
}

function itemRef(name, weapons, armor) {
  // "Arcane Focus (Quarterstaff)" / "Druidic Focus (Quarterstaff)" are both a focus and a usable weapon.
  const focus = name.match(/^(?:Arcane|Druidic) Focus \((\w+)\)$/i);
  if (focus && weapons[slug(focus[1])]) return { weaponId: slug(focus[1]) };
  const base = singular(name.replace(/\s*\(.*\)$/, '')).replace(/^Pouche$/, 'Pouch');
  const id = slug(base);
  if (weapons[id]) return { weaponId: id };
  if (armor[id]) return { armorId: id };
  if (armor[id + '-armor']) return { armorId: id + '-armor' };
  return {};
}

// ---------------------------------------------------------------------------
// Feats
// ---------------------------------------------------------------------------
function parseFeats() {
  const md = readMd('feats.md');
  const feats = {};
  const re = /^#### (.+)$/gm;
  const marks = [...md.matchAll(re)];
  marks.forEach((m, i) => {
    const name = m[1].trim();
    const end = i + 1 < marks.length ? marks[i + 1].index : md.length;
    let body = md.slice(m.index + m[0].length, end);
    const cut = body.search(/^#{2,3} /m);
    if (cut >= 0) body = body.slice(0, cut);
    const header = body.trim().split('\n')[0];
    const hm = header.match(/^_(Origin|General|Fighting Style|Epic Boon) Feat(?: \(Prerequisite: ([^)]+)\))?_$/);
    assert(hm, 'feat header for ' + name + ': ' + header);
    const description = cleanBody(body.trim().split('\n').slice(1).join('\n'));
    const prereq = hm[2] || null;
    const id = slug(name);
    feats[id] = {
      id, name,
      category: slug(hm[1]),
      prerequisite: prereq,
      minLevel: prereq && /Level (\d+)\+/.test(prereq) ? Number(prereq.match(/Level (\d+)\+/)[1]) : null,
      repeatable: /_Repeatable\._/.test(description),
      description,
      abilityIncrease: parseFeatAbilityIncrease(description),
    };
  });
  return feats;
}

/** Reads "Increase your Strength or Dexterity score by 1, to a maximum of 20." style text. */
function parseFeatAbilityIncrease(text) {
  const any = text.match(/Increase one ability score of your choice by 1, to a maximum of (\d+)/);
  if (any) return { amount: 1, from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], max: Number(any[1]) };
  const some = text.match(/Increase your ([A-Za-z, ]+?) score by 1, to a maximum of (\d+)/);
  if (some) {
    const names = some[1].split(/,\s*(?:or\s+)?|\s+or\s+/).map((w) => w.trim().toLowerCase()).filter(Boolean);
    const from = names.map((w) => ABILITY_BY_NAME[w]);
    assert(from.every(Boolean), 'feat ability names: ' + some[1]);
    return { amount: 1, from, max: Number(some[2]) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Backgrounds and species
// ---------------------------------------------------------------------------
const originsMd = readMd('character-origins.md');

function parseBackgrounds(feats, weapons, armor) {
  const out = {};
  for (const name of ['Acolyte', 'Criminal', 'Sage', 'Soldier']) {
    const sec = section(originsMd, '#### ' + name);
    assert(sec, 'background ' + name);
    const field = (label) => {
      const m = sec.match(new RegExp('^\\*\\*' + label + ':\\*\\* (.+)$', 'm'));
      assert(m, name + ' ' + label);
      return m[1].trim();
    };
    const abilities = field('Ability Scores').split(', ').map((a) => ABILITY_BY_NAME[a.toLowerCase()]);
    const featText = field('Feat');
    const fm = featText.match(/^([A-Za-z' ]+?)(?: \(([A-Za-z]+)\))? \(see "Feats"\)$/);
    assert(fm && feats[slug(fm[1])], 'background feat ' + featText);
    const skills = field('Skill Proficiencies').split(' and ').map((s) => SKILL_BY_NAME[s.toLowerCase()]);
    const tool = field('Tool Proficiency').replace(/_/g, '');
    const equipText = field('Equipment').replace(/^_Choose A or B:_\s*/, '');
    const id = slug(name);
    out[id] = {
      id, name,
      abilities,
      feat: { id: slug(fm[1]), spellList: fm[2] ? fm[2].toLowerCase() : null },
      skills,
      tool: /Choose one kind of/.test(tool) ? { choose: 'gaming-set', text: tool } : { name: tool },
      equipmentText: equipText,
      equipmentOptions: parseEquipmentOptions(equipText, weapons, armor),
    };
    assert(abilities.length === 3 && abilities.every(Boolean), name + ' abilities');
    assert(skills.length === 2 && skills.every(Boolean), name + ' skills');
  }
  out.intro = cleanBody(section(originsMd, '### Parts of a Background'));
  return out;
}

/** Splits a species section into `_Trait._ text` blocks (continuation paragraphs stay with the trait). */
function speciesTraits(sec) {
  const body = sec.replace(/\*\*[^*\n]+\*\*\n+<table>[\s\S]*?<\/table>/g, '').replace(/<table>[\s\S]*?<\/table>/g, '');
  const lines = body.split('\n');
  const traits = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^_([^_]+)\._ (.*)$/);
    if (m) {
      cur = { name: m[1].trim(), description: m[2].trim() };
      traits.push(cur);
    } else if (cur && line.trim() && !/^\*\*(Creature Type|Size|Speed):/.test(line)) {
      cur.description += '\n' + line.trim();
    }
  }
  return traits;
}

function parseSpecies(spellIdByName) {
  const ids = ['Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Goliath', 'Halfling', 'Human', 'Orc', 'Tiefling'];
  const out = {};
  for (const name of ids) {
    const sec = section(originsMd, '#### ' + name);
    assert(sec, 'species ' + name);
    const size = sec.match(/^\*\*Size:\*\* (.+)$/m)[1];
    const speed = Number(sec.match(/^\*\*Speed:\*\* (\d+) feet/m)[1]);
    const sizeOptions = /or Small/.test(size) ? ['Medium', 'Small'] : [size.split(' ')[0]];
    out[slug(name)] = {
      id: slug(name), name, creatureType: 'Humanoid',
      sizeText: size, sizeOptions, speed,
      traits: speciesTraits(sec),
      choices: [],
    };
  }

  // --- Mechanics layer: the sub-choices each species asks for, checked against the parsed text.
  const lineageTable = (title) =>
    tableAfter(originsMd, title).slice(1).map(([lineage, l1, l3, l5]) => ({
      id: slug(lineage), name: lineage, level1: l1,
      spells: { 3: spellIdByName(l3), 5: spellIdByName(l5) },
      cantrip: spellIdByName((l1.match(/know the ([A-Z][A-Za-z ]+?) cantrip/) || [])[1]),
    }));

  const dragon = tableAfter(originsMd, 'Draconic Ancestors').slice(1).flatMap((r) => [[r[0], r[1]], [r[2], r[3]]]);
  out.dragonborn.choices.push({
    id: 'ancestry', label: 'Draconic Ancestor', required: true,
    options: dragon.map(([d, t]) => ({ id: slug(d), name: d + ' Dragon', damageType: t, description: 'Breath Weapon and Damage Resistance use ' + t + ' damage.' })),
  });

  const elven = lineageTable('Elven Lineages');
  assert(elven.length === 3 && elven.every((l) => l.spells[3] && l.spells[5] && l.cantrip), 'elven lineages');
  out.elf.choices.push(
    { id: 'lineage', label: 'Elven Lineage', required: true, options: elven.map((l) => ({ ...l, description: l.level1 })) },
    { id: 'spellAbility', label: 'Lineage spellcasting ability', required: true, abilities: ['int', 'wis', 'cha'] },
    { id: 'skill', label: 'Keen Senses skill', required: true, skills: ['insight', 'perception', 'survival'] }
  );
  // Drow Darkvision 120 ft, Wood Elf Speed 35 ft (Elven Lineages table, level 1 column).
  assert(/Darkvision increases to 120 feet/.test(elven.find((l) => l.id === 'drow').level1), 'drow darkvision');
  assert(/Speed increases to 35 feet/.test(elven.find((l) => l.id === 'wood-elf').level1), 'wood elf speed');
  elven.find((l) => l.id === 'drow').darkvision = 120;
  elven.find((l) => l.id === 'wood-elf').speed = 35;

  const gnomeSec = section(originsMd, '#### Gnome');
  const gnomeOpts = [...gnomeSec.matchAll(/^\*\*(Forest Gnome|Rock Gnome)\.\*\* (.+)$/gm)].map((m) => ({
    id: slug(m[1]), name: m[1], description: m[2].trim(),
    cantrips: [...m[2].matchAll(/_([A-Z][A-Za-z ]+?)_ (?:and _([A-Z][A-Za-z ]+?)_ )?cantrips?/g)].flatMap((x) => [x[1], x[2]]).filter(Boolean).map(spellIdByName),
  }));
  assert(gnomeOpts.length === 2, 'gnomish lineages');
  out.gnome.choices.push(
    { id: 'lineage', label: 'Gnomish Lineage', required: true, options: gnomeOpts },
    { id: 'spellAbility', label: 'Lineage spellcasting ability', required: true, abilities: ['int', 'wis', 'cha'] }
  );

  const goliathSec = section(originsMd, '#### Goliath');
  const giant = [...goliathSec.matchAll(/^\*\*([^*]+?) \(([^)]+)\)\.\*\* (.+)$/gm)].map((m) => ({
    id: slug(m[1]), name: m[1] + ' (' + m[2] + ')', description: m[3].trim(),
  }));
  assert(giant.length === 6, 'giant ancestry');
  out.goliath.choices.push({ id: 'ancestry', label: 'Giant Ancestry', required: true, options: giant });

  assert(/proficiency in one skill of your choice/.test(section(originsMd, '#### Human')), 'human skillful');
  out.human.choices.push(
    { id: 'size', label: 'Size', required: true, sizes: ['Medium', 'Small'] },
    { id: 'skill', label: 'Skillful', required: true, skills: SKILLS.map((s) => s.id) },
    { id: 'feat', label: 'Versatile (Origin feat)', required: true, featCategory: 'origin' }
  );

  const legacies = lineageTable('Fiendish Legacies');
  assert(legacies.length === 3 && legacies.every((l) => l.spells[3] && l.spells[5]), 'fiendish legacies');
  out.tiefling.choices.push(
    { id: 'size', label: 'Size', required: true, sizes: ['Medium', 'Small'] },
    { id: 'lineage', label: 'Fiendish Legacy', required: true, options: legacies.map((l) => ({ ...l, description: l.level1 })) },
    { id: 'spellAbility', label: 'Legacy spellcasting ability', required: true, abilities: ['int', 'wis', 'cha'] }
  );
  // Tiefling Otherworldly Presence: Thaumaturgy cantrip.
  const tiefSec = section(originsMd, '#### Tiefling');
  assert(/_Thaumaturgy_ cantrip/.test(tiefSec), 'tiefling thaumaturgy');
  out.tiefling.cantrips = [spellIdByName('Thaumaturgy')];

  // Numeric species effects used by the engine (each one asserted from the text).
  const dwarfSec = section(originsMd, '#### Dwarf');
  assert(/Hit Point maximum increases by 1, and it increases by 1 again whenever you gain a level/.test(dwarfSec), 'dwarven toughness');
  out.dwarf.hpPerLevel = 1;
  out.dwarf.darkvision = 120;
  assert(/Darkvision with a range of 120 feet/.test(dwarfSec), 'dwarf darkvision');
  out.orc.darkvision = 120;
  ['dragonborn', 'elf', 'gnome', 'tiefling'].forEach((s) => (out[s].darkvision = 60));
  out.intro = cleanBody(section(originsMd, '### Parts of a Species'));
  return out;
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
const classesMd = readMd('classes.md');

function parseClass(name, weapons, armor, spellIdByName) {
  const sec = section(classesMd, '## ' + name);
  assert(sec, 'class ' + name);
  const core = Object.fromEntries(tableAfter(sec, `Core ${name} Traits`).map((r) => [r[0], r[1]]));
  const hitDie = Number(core['Hit Point Die'].match(/D(\d+)/)[1]);
  const saves = core['Saving Throw Proficiencies'].split(' and ').map((a) => ABILITY_BY_NAME[a.toLowerCase()]);
  let skillCount, skillFrom;
  const anySkills = core['Skill Proficiencies'].match(/^Choose any (\d+) skills/);
  if (anySkills) {
    skillCount = Number(anySkills[1]);
    skillFrom = SKILLS.map((s) => s.id);
  } else {
    const sk = core['Skill Proficiencies'].match(/^Choose (\d+): (.+)$/);
    assert(sk, name + ' skill line');
    skillCount = Number(sk[1]);
    skillFrom = sk[2].replace(/,? or /, ', ').split(', ').map((s) => SKILL_BY_NAME[s.trim().toLowerCase()]);
  }
  assert(skillFrom.every(Boolean), name + ' skills');
  const equipText = core['Starting Equipment'].replace(/^Choose [A-C, or]+: /, '');

  // Level table. Column values are kept as numbers where the table shows numbers, and as text
  // where it shows dice (Bardic Die, Martial Arts, Sneak Attack).
  const COLUMN_KEYS = {
    'Channel Divinity': 'channelDivinity', Cantrips: 'cantrips', 'Prepared Spells': 'preparedSpells',
    'Second Wind': 'secondWind', 'Weapon Mastery': 'weaponMastery', 'Sneak Attack': 'sneakAttack',
    Rages: 'rages', 'Rage Damage': 'rageDamage', 'Bardic Die': 'bardicDie', 'Wild Shape': 'wildShape',
    'Martial Arts': 'martialArts', 'Focus Points': 'focusPoints', 'Unarmored Movement': 'unarmoredMovement',
    'Favored Enemy': 'favoredEnemy', 'Sorcery Points': 'sorceryPoints', 'Eldritch Invocations': 'invocations',
    'Spell Slots': 'pactSlots', 'Slot Level': 'pactSlotLevel',
  };
  const TEXT_COLUMNS = ['sneakAttack', 'bardicDie', 'martialArts'];
  const rows = tableAfter(sec, `${name} Features`);
  const header = rows[0];
  const dataRows = rows.filter((r) => /^\d+$/.test(r[0]));
  assert(dataRows.length === 20, name + ' level table rows');
  const slotStart = header.findIndex((h) => /Spell Slots per Spell Level/.test(h));
  const levels = {};
  dataRows.forEach((r) => {
    const lvl = Number(r[0]);
    const entry = { proficiencyBonus: num(r[1]), features: r[2] === '—' ? [] : r[2].split(', ') };
    header.forEach((h, i) => {
      if (i < 3 || (slotStart >= 0 && i >= slotStart)) return;
      const key = COLUMN_KEYS[h];
      assert(key, name + ' unknown column ' + h);
      if (TEXT_COLUMNS.indexOf(key) >= 0) entry[key] = r[i] === '—' ? null : r[i].toLowerCase();
      else entry[key] = num(String(r[i]).replace(/ ft\.$/, ''));
    });
    if (slotStart >= 0) {
      const slots = r.slice(slotStart).map(num);
      while (slots.length < 9) slots.push(0);
      entry.slots = slots.slice(0, 9);
    }
    levels[lvl] = entry;
  });
  // Half casters have 5 slot columns; Warlocks use Pact Magic (all slots of one level).
  const casterType = header.indexOf('Slot Level') >= 0 ? 'pact'
    : slotStart < 0 ? null
      : rows[1].slice(slotStart).filter((c) => /^\d$/.test(c)).length === 5 ? 'half' : 'full';

  const featuresSec = section(sec, `### ${name} Class Features`);
  const features = levelFeatures(featuresSec);

  // Subclass
  const subHeading = sec.match(new RegExp(`^### ${name} Subclass: (.+)$`, 'm'));
  const subSec = section(sec, subHeading[0]);
  const subLines = subSec.trim().split('\n');
  const tagline = subLines[0].replace(/^_|_$/g, '');
  const subDesc = cleanBody(subSec.slice(0, subSec.search(/^#### /m)).split('\n').slice(1).join('\n'));
  const subclass = {
    id: slug(subHeading[1]),
    name: subHeading[1],
    tagline,
    description: subDesc,
    features: levelFeatures(subSec),
  };

  // Spell list (half casters have no cantrips and stop at level 5)
  let spellList = null;
  const listSec = section(sec, `### ${name} Spell List`);
  if (listSec) {
    spellList = {};
    for (let lvl = 0; lvl <= 9; lvl++) {
      const heading = lvl === 0 ? `#### Cantrips (Level 0 ${name} Spells)` : `#### Level ${lvl} ${name} Spells`;
      if (listSec.indexOf(heading) < 0) {
        spellList[lvl] = [];
        continue;
      }
      const t = tableAfterHeading(listSec, heading);
      spellList[lvl] = t.slice(1).map((r) => spellIdByName(r[0]));
      assert(spellList[lvl].every(Boolean), name + ' spell list names level ' + lvl);
    }
    assert(Object.values(spellList).flat().length > 20, name + ' spell list');
  }

  return {
    id: slug(name), name,
    primaryAbilityText: core['Primary Ability'],
    hitDie,
    fixedHpPerLevel: hitDie / 2 + 1,
    savingThrows: saves,
    skillChoices: { count: skillCount, from: skillFrom },
    casterType: casterType,
    weaponProficiencyText: core['Weapon Proficiencies'],
    armorTrainingText: core['Armor Training'],
    toolProficiencyText: core['Tool Proficiencies'] || null,
    equipmentText: equipText,
    equipmentOptions: parseEquipmentOptions(equipText, weapons, armor),
    levels,
    features,
    subclassLevel: 3,
    subclass,
    spellList,
  };
}

/** Hand-written mechanics for each supported class. Every entry is checked against the SRD text. */
function addClassMechanics(classes, feats, spellIdByName) {
  const { fighter, rogue, cleric, wizard } = classes;
  const featureText = (cls, level, fname) => {
    const f = cls.features.concat(cls.subclass.features).find((x) => x.level === level && x.name === fname);
    assert(f, `${cls.name} feature ${level} ${fname}`);
    return f.description;
  };

  // Ability Score Improvement / Epic Boon levels come straight from the level table.
  Object.values(classes).forEach((cls) => {
    cls.featLevels = Object.entries(cls.levels)
      .filter(([, e]) => e.features.includes('Ability Score Improvement') || e.features.includes('Epic Boon'))
      .map(([lvl, e]) => ({ level: Number(lvl), kind: e.features.includes('Epic Boon') ? 'epic-boon' : 'asi' }));
    cls.subclassLevel = Number(Object.entries(cls.levels).find(([, e]) => e.features.includes(`${cls.name} Subclass`))[0]);
  });

  // Fighter
  assert(/simple-weapons|Simple and Martial/.test(fighter.weaponProficiencyText), 'fighter weapons');
  fighter.proficiencies = { weapons: { simple: true, martial: true }, armor: { light: true, medium: true, heavy: true, shield: true }, tools: [] };
  assert(/gain a Fighting Style feat of your choice/.test(featureText(fighter, 1, 'Fighting Style')), 'fighting style');
  assert(/three kinds of Simple or Martial weapons/.test(featureText(fighter, 1, 'Weapon Mastery')), 'fighter mastery');
  assert(/another Fighting Style feat/.test(featureText(fighter, 7, 'Additional Fighting Style')), 'champion style');
  fighter.choices = [
    { id: 'fightingStyle', level: 1, label: 'Fighting Style', type: 'feat', featCategory: 'fighting-style' },
    { id: 'additionalFightingStyle', level: 7, subclass: true, label: 'Additional Fighting Style', type: 'feat', featCategory: 'fighting-style' },
  ];
  fighter.weaponMastery = { column: 'weaponMastery', eligible: 'simple-or-martial' };
  fighter.critRange = { 3: 19, 15: 18 };
  const athlete = fighter.subclass.features.find((f) => f.name === 'Remarkable Athlete');
  assert(athlete && athlete.level === 3 && /you have Advantage on Initiative rolls and Strength \(Athletics\) checks/.test(athlete.description), 'remarkable athlete');
  fighter.subclass.initiativeAdvantage = { level: 3, source: 'Remarkable Athlete' };

  // Rogue
  assert(/Martial weapons that have the Finesse or Light property/.test(rogue.weaponProficiencyText), 'rogue weapons');
  rogue.proficiencies = { weapons: { simple: true, martialFinesseOrLight: true }, armor: { light: true }, tools: ["Thieves' Tools"] };
  assert(/Expertise in two of your skill proficiencies/.test(featureText(rogue, 1, 'Expertise')), 'rogue expertise 1');
  assert(/Thieves' Cant and one other language/.test(featureText(rogue, 1, "Thieves' Cant")), 'thieves cant');
  assert(/two kinds of weapons of your choice with which you have proficiency/.test(featureText(rogue, 1, 'Weapon Mastery')), 'rogue mastery');
  rogue.choices = [
    { id: 'expertise1', level: 1, label: 'Expertise (level 1)', type: 'expertise', count: 2 },
    { id: 'expertise6', level: 6, label: 'Expertise (level 6)', type: 'expertise', count: 2 },
  ];
  rogue.weaponMastery = { count: 2, eligible: 'proficient' };
  rogue.extraLanguages = 1;
  rogue.knownLanguages = ["Thieves' Cant"];
  assert(/You gain proficiency in Wisdom and Charisma saving throws/.test(featureText(rogue, 15, 'Slippery Mind')), 'slippery mind');
  rogue.extraSaves = { level: 15, abilities: ['wis', 'cha'], source: 'Slippery Mind' };

  // Cleric
  cleric.proficiencies = { weapons: { simple: true }, armor: { light: true, medium: true, shield: true }, tools: [] };
  const order = featureText(cleric, 1, 'Divine Order');
  assert(/_Protector\._ Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor/.test(order), 'protector');
  assert(/_Thaumaturge\._ You know one extra cantrip/.test(order), 'thaumaturge');
  const strikes = featureText(cleric, 7, 'Blessed Strikes');
  assert(/_Divine Strike\._/.test(strikes) && /_Potent Spellcasting\._/.test(strikes), 'blessed strikes');
  cleric.choices = [
    {
      id: 'divineOrder', level: 1, label: 'Divine Order', type: 'option',
      options: [
        { id: 'protector', name: 'Protector', description: order.match(/_Protector\._ ([^\n]+)/)[1], grants: { martialWeapons: true, heavyArmor: true } },
        { id: 'thaumaturge', name: 'Thaumaturge', description: order.match(/_Thaumaturge\._ ([^\n]+)/)[1], grants: { extraCantrips: 1, arcanaReligionWisBonus: true } },
      ],
    },
    {
      id: 'blessedStrikes', level: 7, label: 'Blessed Strikes', type: 'option',
      options: ['Divine Strike', 'Potent Spellcasting'].map((n) => ({ id: slug(n), name: n, description: strikes.match(new RegExp('_' + n + '\\._ ([^\\n]+)'))[1] })),
    },
  ];
  cleric.spellcasting = { ability: 'wis', focus: 'Holy Symbol', ritual: false };
  // Life Domain Spells table (always prepared, don't count against prepared spells).
  const lifeTable = tableAfter(section(classesMd, '### Cleric Subclass: Life Domain'), 'Life Domain Spells');
  assert(lifeTable, 'life domain spells table');
  cleric.subclass.alwaysPrepared = {};
  lifeTable.slice(1).forEach(([lvl, spells]) => {
    cleric.subclass.alwaysPrepared[Number(lvl)] = spells.split(', ').map((s) => {
      const id = spellIdByName(s);
      assert(id, 'life domain spell ' + s);
      return id;
    });
  });

  // Wizard
  wizard.proficiencies = { weapons: { simple: true }, armor: {}, tools: [] };
  const sc = featureText(wizard, 1, 'Spellcasting');
  assert(/It starts with six level 1 Wizard spells/.test(sc), 'spellbook start');
  assert(/add two Wizard spells of your choice to your spellbook/.test(sc), 'spellbook per level');
  const scholar = featureText(wizard, 2, 'Scholar');
  const scholarSkills = scholar.match(/proficiency: ([A-Za-z, ]+?)\. You have Expertise/)[1].replace(/,? or /, ', ').split(', ').map((s) => SKILL_BY_NAME[s.toLowerCase()]);
  assert(scholarSkills.length === 6 && scholarSkills.every(Boolean), 'scholar skills');
  assert(/Choose a level 1 and a level 2 spell in your spellbook that have a casting time of an action/.test(featureText(wizard, 18, 'Spell Mastery')), 'spell mastery');
  assert(/Choose two level 3 spells in your spellbook/.test(featureText(wizard, 20, 'Signature Spells')), 'signature spells');
  wizard.choices = [
    { id: 'scholar', level: 2, label: 'Scholar (Expertise)', type: 'expertise', count: 1, from: scholarSkills },
  ];
  wizard.spellcasting = { ability: 'int', focus: 'Arcane Focus or spellbook', ritual: true, spellbook: { initial: 6, perLevel: 2 } };
  wizard.spellMastery = { level: 18, spellLevels: [1, 2], castingTime: 'Action' };
  wizard.signatureSpells = { level: 20, count: 2, spellLevel: 3 };

  // Champion / Evoker numeric bits used by the sheet
  assert(/Critical Hit on a roll of 19 or 20/.test(featureText(fighter, 3, 'Improved Critical')), 'improved critical');
  assert(/18–20/.test(featureText(fighter, 15, 'Superior Critical')), 'superior critical');

  addMoreClassMechanics(classes, featureText, spellIdByName);
  void feats;
}

/** Spells listed in a subclass's "always prepared" table, keyed by class level. */
function subclassSpellTable(className, subclassName, tableTitle, spellIdByName) {
  const t = tableAfter(section(classesMd, `### ${className} Subclass: ${subclassName}`), tableTitle);
  assert(t, `${tableTitle} table`);
  const out = {};
  t.slice(1).forEach(([lvl, spells]) => {
    out[Number(lvl)] = spells.split(', ').map((s) => {
      const id = spellIdByName(s);
      assert(id, `${tableTitle}: unknown spell ${s}`);
      return id;
    });
  });
  return out;
}

/** "X is your spellcasting ability" from a Spellcasting / Pact Magic feature. */
function spellAbilityFrom(text) {
  const m = text.match(/(?:_|\*\*)Spellcasting Ability\.(?:_|\*\*) (\w+) is (?:your|the) spellcasting ability/);
  assert(m, 'spellcasting ability line');
  return ABILITY_BY_NAME[m[1].toLowerCase()];
}

/** Options written as "_Name._ text" (or "**Name.** text") inside a feature. */
function namedOptions(text, names) {
  return names.map((n) => {
    const m = text.match(new RegExp('(?:_|\\*\\*)' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.(?:_|\\*\\*) ([^\\n]+)'));
    assert(m, 'option ' + n);
    return { id: slug(n), name: n, description: m[1].trim() };
  });
}

/** Mechanics for Barbarian, Bard, Druid, Monk, Paladin, Ranger, Sorcerer and Warlock (checked against the SRD text). */
function addMoreClassMechanics(classes, featureText, spellIdByName) {
  const { barbarian, bard, druid, monk, paladin, ranger, sorcerer, warlock } = classes;
  const subFeature = (cls, level, fname) => {
    const f = cls.subclass.features.find((x) => x.level === level && x.name === fname);
    assert(f, `${cls.subclass.name} feature ${level} ${fname}`);
    return f.description;
  };

  // ---- Barbarian
  assert(/Simple and Martial/.test(barbarian.weaponProficiencyText), 'barbarian weapons');
  barbarian.proficiencies = { weapons: { simple: true, martial: true }, armor: { light: true, medium: true, shield: true }, tools: [] };
  assert(/two kinds of Simple or Martial Melee weapons/.test(featureText(barbarian, 1, 'Weapon Mastery')), 'barbarian mastery');
  barbarian.weaponMastery = { column: 'weaponMastery', eligible: 'melee' };
  assert(/base Armor Class equals 10 plus your Dexterity and Constitution modifiers\. You can use a Shield/.test(featureText(barbarian, 1, 'Unarmored Defense')), 'barbarian unarmored');
  barbarian.unarmoredDefense = { ability: 'con', shield: true };
  assert(/proficiency in another skill of your choice from the skill list available to Barbarians/.test(featureText(barbarian, 3, 'Primal Knowledge')), 'primal knowledge');
  assert(/speed increases by 10 feet while you aren't wearing Heavy armor/.test(featureText(barbarian, 5, 'Fast Movement')), 'fast movement');
  barbarian.speedBonus = { level: 5, amount: 10, unless: 'heavy-armor', source: 'Fast Movement' };
  assert(/Your Strength and Constitution scores increase by 4, to a maximum of 25/.test(featureText(barbarian, 20, 'Primal Champion')), 'primal champion');
  barbarian.capstoneIncrease = { level: 20, abilities: ['str', 'con'], amount: 4, max: 25, source: 'Primal Champion' };
  assert(/you have Advantage on Initiative rolls/.test(featureText(barbarian, 7, 'Feral Instinct')), 'feral instinct');
  barbarian.initiativeAdvantage = { level: 7, source: 'Feral Instinct' };
  barbarian.choices = [
    { id: 'primalKnowledge', level: 3, label: 'Primal Knowledge (extra skill)', type: 'skills', count: 1, from: barbarian.skillChoices.from },
  ];

  // ---- Bard
  bard.proficiencies = { weapons: { simple: true }, armor: { light: true }, tools: [] };
  const bardSc = featureText(bard, 1, 'Spellcasting');
  bard.spellcasting = { ability: spellAbilityFrom(bardSc), focus: 'Musical Instrument', ritual: false };
  assert(/Expertise[^\n]*in two of your skill proficiencies/.test(featureText(bard, 2, 'Expertise')), 'bard expertise');
  assert(/half your Proficiency Bonus \(round down\) to any ability check you make that uses a skill proficiency you lack/.test(featureText(bard, 2, 'Jack of All Trades')), 'jack of all trades');
  bard.jackOfAllTrades = { level: 2 };
  assert(/a number of times equal to your Charisma modifier \(minimum of once\)/.test(featureText(bard, 1, 'Bardic Inspiration')), 'bardic inspiration uses');
  bard.bardicInspiration = { usesAbility: 'cha', min: 1 };
  assert(/Bard, Cleric, Druid, and Wizard spell lists/.test(featureText(bard, 10, 'Magical Secrets')), 'magical secrets');
  bard.magicalSecrets = { level: 10, lists: ['bard', 'cleric', 'druid', 'wizard'] };
  assert(/proficiency with three skills of your choice/.test(subFeature(bard, 3, 'Bonus Proficiencies')), 'lore skills');
  assert(/two spells of your choice[^\n]*Cleric, Druid, or Wizard spell list/.test(subFeature(bard, 6, 'Magical Discoveries')), 'magical discoveries');
  bard.choices = [
    { id: 'instruments', level: 1, label: 'Musical Instruments (tool proficiencies)', type: 'tools', count: 3, families: ['musical-instrument'] },
    { id: 'expertise2', level: 2, label: 'Expertise (level 2)', type: 'expertise', count: 2 },
    { id: 'expertise9', level: 9, label: 'Expertise (level 9)', type: 'expertise', count: 2 },
    { id: 'loreSkills', level: 3, subclass: true, label: 'Bonus Proficiencies (College of Lore)', type: 'skills', count: 3, from: SKILLS.map((s) => s.id) },
    { id: 'magicalDiscoveries', level: 6, subclass: true, label: 'Magical Discoveries (College of Lore)', type: 'spells', count: 2, lists: ['cleric', 'druid', 'wizard'], alwaysPrepared: true },
  ];

  // ---- Druid
  druid.proficiencies = { weapons: { simple: true }, armor: { light: true, shield: true }, tools: ['Herbalism Kit'] };
  druid.spellcasting = { ability: spellAbilityFrom(featureText(druid, 1, 'Spellcasting')), focus: 'Druidic Focus', ritual: false };
  const druidic = featureText(druid, 1, 'Druidic');
  assert(/You know Druidic/.test(druidic) && /always have the _Speak with Animals_ spell prepared/.test(druidic), 'druidic');
  druid.knownLanguages = ['Druidic'];
  druid.alwaysPrepared = { 1: [spellIdByName('Speak with Animals')] };
  const primalOrder = featureText(druid, 1, 'Primal Order');
  assert(/_Magician\._ You know one extra cantrip/.test(primalOrder) && /_Warden\._ Trained for battle, you gain proficiency with Martial weapons and training with Medium armor/.test(primalOrder), 'primal order');
  const elementalFury = featureText(druid, 7, 'Elemental Fury');
  const lands = ['Arid', 'Polar', 'Temperate', 'Tropical'];
  const landSpells = {};
  lands.forEach((l) => { landSpells[slug(l)] = subclassSpellTable('Druid', 'Circle of the Land', `${l} Land`, spellIdByName); });
  assert(/choose one type of land: arid, polar, temperate, or tropical/.test(subFeature(druid, 3, 'Circle of the Land Spells')), 'land choice');
  druid.choices = [
    {
      id: 'primalOrder', level: 1, label: 'Primal Order', type: 'option',
      options: namedOptions(primalOrder, ['Magician', 'Warden']).map((o) => Object.assign(o, o.id === 'magician' ? { grants: { extraCantrips: 1 } } : { grants: { martialWeapons: true, mediumArmor: true } })),
    },
    { id: 'elementalFury', level: 7, label: 'Elemental Fury', type: 'option', options: namedOptions(elementalFury, ['Potent Spellcasting', 'Primal Strike']) },
    {
      id: 'landType', level: 3, subclass: true, label: 'Land type (Circle of the Land)', type: 'option',
      note: 'You can choose a different land type each time you finish a Long Rest.',
      options: lands.map((l) => ({ id: slug(l), name: l + ' Land', description: 'Circle spells: ' + Object.entries(landSpells[slug(l)]).map(([lv, ids]) => `level ${lv}: ${ids.join(', ')}`).join('; '), alwaysPrepared: landSpells[slug(l)] })),
    },
  ];

  // ---- Monk
  assert(/Martial weapons that have the Light property/.test(monk.weaponProficiencyText), 'monk weapons');
  monk.proficiencies = { weapons: { simple: true, martialLight: true }, armor: {}, tools: [] };
  const martialArts = featureText(monk, 1, 'Martial Arts');
  assert(/Simple Melee weapons/.test(martialArts) && /Martial Melee weapons that have the Light property/.test(martialArts) && /use your Dexterity modifier instead of your Strength modifier/.test(martialArts), 'martial arts');
  monk.martialArts = { column: 'martialArts', weapons: 'simple-melee-or-martial-light-melee', requiresNoArmorNoShield: true };
  assert(/While you aren't wearing armor or wielding a Shield, your base Armor Class equals 10 plus your Dexterity and Wisdom modifiers/.test(featureText(monk, 1, 'Unarmored Defense')), 'monk unarmored');
  monk.unarmoredDefense = { ability: 'wis', shield: false };
  assert(/speed increases by 10 feet while you aren't wearing armor or wielding a Shield/.test(featureText(monk, 2, 'Unarmored Movement')), 'unarmored movement');
  monk.speedBonus = { column: 'unarmoredMovement', unless: 'armor-or-shield', source: 'Unarmored Movement' };
  assert(/proficiency in all saving throws/.test(featureText(monk, 14, 'Disciplined Survivor')), 'disciplined survivor');
  monk.allSavesAt = 14;
  assert(/Your Dexterity and Wisdom scores increase by 4, to a maximum of 25/.test(featureText(monk, 20, 'Body and Mind')), 'body and mind');
  monk.capstoneIncrease = { level: 20, abilities: ['dex', 'wis'], amount: 4, max: 25, source: 'Body and Mind' };
  monk.choices = [
    { id: 'monkTool', level: 1, label: "Artisan's Tools or Musical Instrument", type: 'tools', count: 1, families: ['artisan', 'musical-instrument'] },
  ];

  // ---- Paladin
  paladin.proficiencies = { weapons: { simple: true, martial: true }, armor: { light: true, medium: true, heavy: true, shield: true }, tools: [] };
  paladin.spellcasting = { ability: spellAbilityFrom(featureText(paladin, 1, 'Spellcasting')), focus: 'Holy Symbol', ritual: false };
  assert(/two kinds of weapons of your choice with which you have proficiency/.test(featureText(paladin, 1, 'Weapon Mastery')), 'paladin mastery');
  paladin.weaponMastery = { count: 2, eligible: 'proficient' };
  const palStyle = featureText(paladin, 2, 'Fighting Style');
  assert(/\*\*Blessed Warrior\.\*\* You learn two Cleric cantrips/.test(palStyle) && /Charisma is your spellcasting ability for them/.test(palStyle), 'blessed warrior');
  assert(/always have the _Divine Smite_ spell prepared/.test(featureText(paladin, 2, "Paladin's Smite")), 'paladin smite');
  paladin.alwaysPrepared = { 2: [spellIdByName('Divine Smite')] };
  assert(/bonus to saving throws equal to your Charisma modifier \(minimum bonus of \+1\)/.test(featureText(paladin, 6, 'Aura of Protection')), 'aura of protection');
  paladin.auraOfProtection = { level: 6, ability: 'cha', min: 1 };
  assert(/restore a total number of Hit Points equal to five times your Paladin level/.test(featureText(paladin, 1, 'Lay On Hands')), 'lay on hands');
  paladin.layOnHands = { perLevel: 5 };
  paladin.subclass.alwaysPrepared = subclassSpellTable('Paladin', 'Oath of Devotion', 'Oath of Devotion Spells', spellIdByName);
  paladin.choices = [
    {
      id: 'fightingStyle', level: 2, label: 'Fighting Style', type: 'feat', featCategory: 'fighting-style',
      alternative: { id: 'blessed-warrior', name: 'Blessed Warrior', description: palStyle.match(/\*\*Blessed Warrior\.\*\* ([^\n]+)/)[1], cantripList: 'cleric', count: 2, ability: 'cha' },
    },
  ];

  // ---- Ranger
  ranger.proficiencies = { weapons: { simple: true, martial: true }, armor: { light: true, medium: true, shield: true }, tools: [] };
  ranger.spellcasting = { ability: spellAbilityFrom(featureText(ranger, 1, 'Spellcasting')), focus: 'Druidic Focus', ritual: false };
  assert(/always have the _Hunter's Mark_ spell prepared/.test(featureText(ranger, 1, 'Favored Enemy')), 'favored enemy');
  ranger.alwaysPrepared = { 1: [spellIdByName("Hunter's Mark")] };
  assert(/two kinds of weapons of your\s+choice with which you have proficiency/.test(featureText(ranger, 1, 'Weapon Mastery')), 'ranger mastery');
  ranger.weaponMastery = { count: 2, eligible: 'proficient' };
  assert(/Your Speed increases by 10 feet while you aren't wearing Heavy armor/.test(featureText(ranger, 6, 'Roving')), 'roving');
  ranger.speedBonus = { level: 6, amount: 10, unless: 'heavy-armor', source: 'Roving' };
  const deft = featureText(ranger, 2, 'Deft Explorer');
  assert(/Choose one of your skill proficiencies with which you lack Expertise/.test(deft) && /two languages of your choice/.test(deft), 'deft explorer');
  const rngStyle = featureText(ranger, 2, 'Fighting Style');
  assert(/_Druidic Warrior\._ You learn two Druid cantrips/.test(rngStyle) && /Wisdom is your spellcasting ability for them/.test(rngStyle), 'druidic warrior');
  assert(/Choose two of your skill proficiencies with which you lack Expertise/.test(featureText(ranger, 9, 'Expertise')), 'ranger expertise 9');
  ranger.choices = [
    { id: 'deftExpertise', level: 2, label: 'Deft Explorer (Expertise)', type: 'expertise', count: 1 },
    { id: 'deftLanguages', level: 2, label: 'Deft Explorer (two languages)', type: 'languages', count: 2 },
    {
      id: 'fightingStyle', level: 2, label: 'Fighting Style', type: 'feat', featCategory: 'fighting-style',
      alternative: { id: 'druidic-warrior', name: 'Druidic Warrior', description: rngStyle.match(/_Druidic Warrior\._ ([^\n]+)/)[1], cantripList: 'druid', count: 2, ability: 'wis' },
    },
    { id: 'expertise9', level: 9, label: 'Expertise (level 9)', type: 'expertise', count: 2 },
    { id: 'huntersPrey', level: 3, subclass: true, label: "Hunter's Prey", type: 'option', note: 'You can swap this option after a Short or Long Rest.', options: namedOptions(subFeature(ranger, 3, "Hunter's Prey"), ['Colossus Slayer', 'Horde Breaker']) },
    { id: 'defensiveTactics', level: 7, subclass: true, label: 'Defensive Tactics', type: 'option', note: 'You can swap this option after a Short or Long Rest.', options: namedOptions(subFeature(ranger, 7, 'Defensive Tactics'), ['Escape the Horde', 'Multiattack Defense']) },
  ];

  // ---- Sorcerer
  sorcerer.proficiencies = { weapons: { simple: true }, armor: {}, tools: [] };
  sorcerer.spellcasting = { ability: spellAbilityFrom(featureText(sorcerer, 1, 'Spellcasting')), focus: 'Arcane Focus', ritual: false };
  const meta = featureText(sorcerer, 2, 'Metamagic');
  assert(/you gain two Metamagic options of your choice/.test(meta) && /You gain two more options at Sorcerer level 10 and two more at Sorcerer level 17/.test(meta), 'metamagic counts');
  const resilience = subFeature(sorcerer, 3, 'Draconic Resilience');
  assert(/Hit Point maximum increases by 3, and it increases by 1 whenever you gain another Sorcerer level/.test(resilience), 'draconic hp');
  assert(/base Armor Class equals 10 plus your Dexterity and Charisma modifiers/.test(resilience), 'draconic ac');
  sorcerer.subclass.hpBonus = { level: 3, perClassLevel: 1, source: 'Draconic Resilience' }; // 3 at level 3, +1 each level after = class level
  sorcerer.subclass.unarmoredDefense = { level: 3, ability: 'cha', shield: true };
  sorcerer.subclass.alwaysPrepared = subclassSpellTable('Sorcerer', 'Draconic Sorcery', 'Draconic Spells', spellIdByName);
  const affinity = subFeature(sorcerer, 6, 'Elemental Affinity');
  const affinityTypes = affinity.match(/Choose one of those types: ([A-Za-z, ]+?)\./)[1].replace(/,? or /, ', ').split(', ');
  assert(affinityTypes.length === 5, 'elemental affinity types');
  sorcerer.choices = [
    { id: 'metamagic', level: 2, label: 'Metamagic options', type: 'multi-option', counts: { 2: 2, 10: 4, 17: 6 }, optionsFrom: 'metamagic' },
    {
      id: 'elementalAffinity', level: 6, subclass: true, label: 'Elemental Affinity', type: 'option',
      options: affinityTypes.map((t) => ({ id: slug(t), name: t, description: `Resistance to ${t} damage; add your Charisma modifier to one damage roll of a spell that deals ${t} damage.` })),
    },
  ];

  // ---- Warlock
  warlock.proficiencies = { weapons: { simple: true }, armor: { light: true }, tools: [] };
  warlock.spellcasting = { ability: spellAbilityFrom(featureText(warlock, 1, 'Pact Magic')), focus: 'Arcane Focus', ritual: false };
  const arcanum = featureText(warlock, 11, 'Mystic Arcanum');
  assert(/Choose one level 6 Warlock spell as this arcanum/.test(arcanum) && /levels 13 \(level 7 spell\), 15 \(level 8 spell\), and 17 \(level 9 spell\)/.test(arcanum), 'mystic arcanum');
  warlock.mysticArcanum = { 11: 6, 13: 7, 15: 8, 17: 9 };
  warlock.subclass.alwaysPrepared = subclassSpellTable('Warlock', 'Fiend Patron', 'Fiend Spells', spellIdByName);
  assert(/You can't pick the same invocation more than once unless its description says otherwise/.test(featureText(warlock, 1, 'Eldritch Invocations')), 'invocation rules');
  warlock.choices = [
    { id: 'invocations', level: 1, label: 'Eldritch Invocations', type: 'invocations', column: 'invocations' },
  ];

  // Every class: "always prepared" class spells default to none.
  Object.values(classes).forEach((cls) => {
    cls.alwaysPrepared = cls.alwaysPrepared || {};
    if (cls.spellcasting) cls.spellcasting.type = cls.casterType;
  });
}

/** Metamagic options (Sorcerer). */
function parseMetamagic() {
  const sec = section(section(classesMd, '## Sorcerer'), '### Metamagic Options');
  const out = {};
  for (const m of sec.matchAll(/^#### (.+)\n\n_Cost: ([^_]+)_\n\n([\s\S]*?)(?=\n#### |$)/gm)) {
    out[slug(m[1])] = { id: slug(m[1]), name: m[1].trim(), cost: m[2].trim(), description: cleanBody(m[3]) };
  }
  assert(Object.keys(out).length === 10, 'ten metamagic options, got ' + Object.keys(out).length);
  return out;
}

/** Eldritch Invocation options (Warlock), with machine-readable prerequisites. */
function parseInvocations() {
  const sec = section(section(classesMd, '## Warlock'), '### Eldritch Invocation Options');
  const out = {};
  const marks = [...sec.matchAll(/^#### (.+)$/gm)];
  marks.forEach((m, i) => {
    const name = m[1].trim();
    const body = sec.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : sec.length).trim();
    const pre = body.match(/^_Prerequisite: ([^_]+)_/);
    const prereqText = pre ? pre[1].trim() : null;
    const description = cleanBody(pre ? body.slice(pre[0].length) : body);
    const inv = {
      id: slug(name), name, prerequisite: prereqText, description,
      minLevel: prereqText && /Level (\d+)\+ Warlock/.test(prereqText) ? Number(prereqText.match(/Level (\d+)\+ Warlock/)[1]) : 1,
      requiresInvocation: prereqText && /([A-Z][A-Za-z' ]+?) Invocation/.test(prereqText) ? slug(prereqText.match(/,\s*([A-Z][A-Za-z' ]+?) Invocation/)[1]) : null,
      requiresCantrip: prereqText && /Warlock Cantrip That Deals Damage via an Attack Roll/.test(prereqText) ? 'attack'
        : prereqText && /Warlock Cantrip That Deals Damage/.test(prereqText) ? 'damage' : null,
      repeatable: /_Repeatable\._/.test(description),
      pick: null,
    };
    if (/^Choose one of your known Warlock cantrips/.test(description)) inv.pick = { type: 'cantrip', rangeAtLeast: /range of 10\+ feet/.test(description) ? 10 : 0 };
    if (inv.id === 'lessons-of-the-first-ones') {
      assert(/one Origin feat of your choice/.test(description), 'lessons');
      inv.pick = { type: 'feat', featCategory: 'origin' };
    }
    if (inv.id === 'pact-of-the-tome') {
      assert(/choose three cantrips, and choose two level 1 spells that have the Ritual tag\. The spells can be from any class's spell list/.test(description), 'tome');
      inv.pick = { type: 'tome', cantrips: 3, rituals: 2 };
    }
    out[inv.id] = inv;
  });
  assert(Object.keys(out).length === 28 && out['devouring-blade'].requiresInvocation === 'thirsting-blade' && out['eldritch-smite'].requiresInvocation === 'pact-of-the-blade', 'invocations parsed');
  return out;
}

/** Adventuring gear (incl. packs and their contents) for tooltips and inventory details. */
function parseGear() {
  const sec = section(equipMd, '## Adventuring Gear');
  const out = {};
  const marks = [...sec.matchAll(/^#### (.+?) \(([^)]+)\)$/gm)];
  marks.forEach((m, i) => {
    const body = sec.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : sec.length);
    const name = m[1].trim();
    const description = cleanBody(body.replace(/^#{1,3} [\s\S]*$/m, ''));
    const contents = description.match(/contains the following items: ([^\n]+?)\.?$/m);
    out[slug(name)] = { id: slug(name), name, cost: m[2].trim(), description, contents: contents ? contents[1].split(/, (?:and )?/) : null };
  });
  assert(out['burglars-pack'] && out['burglars-pack'].contents.length > 5, 'gear and packs');
  return out;
}

/** SRD Rules Glossary definitions (verbatim), used as the "official rule" behind Guided Tips. */
function parseGlossary() {
  const md = readMd('rules-glossary.md');
  const out = {};
  const marks = [...md.matchAll(/^#### (.+)$/gm)];
  marks.forEach((m, i) => {
    const raw = m[1].trim();
    const tag = (raw.match(/\[([^\]]+)\]$/) || [])[1] || null;
    const name = raw.replace(/\s*\[[^\]]+\]$/, '');
    let body = md.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : md.length);
    const cut = body.search(/^#{1,3} /m);
    if (cut >= 0) body = body.slice(0, cut);
    out[slug(name)] = { id: slug(name), name, tag, text: cleanBody(body) };
  });
  assert(Object.keys(out).length > 140 && out['proficiency'] && out['concentration'] && out['armor-class'], 'glossary');
  return out;
}

// ---------------------------------------------------------------------------
// Spells
// ---------------------------------------------------------------------------
function parseSpells() {
  const md = readMd('spells.md');
  const start = md.indexOf('## Spell Descriptions');
  const body = md.slice(start);
  const marks = [...body.matchAll(/^#### (.+)$/gm)];
  const spells = {};
  let previous = null;
  marks.forEach((m, i) => {
    const name = m[1].trim();
    const end = i + 1 < marks.length ? marks[i + 1].index : body.length;
    const block = body.slice(m.index + m[0].length, end).trim();
    const lines = block.split('\n');
    const tag = lines[0].match(/^_(?:Level (\d) (\w+)|(\w+) Cantrip) \(([^)]+)\)_$/);
    if (!tag) {
      // Stat blocks inside a spell (e.g. Animate Objects) use #### headings; keep them with that spell.
      assert(previous, 'heading before first spell: ' + name);
      previous.description += '\n\n**' + name + '**\n' + cleanBody(stripStatBlock(block));
      return;
    }
    const field = (label) => {
      const f = block.match(new RegExp('^\\*\\*' + label + ':\\*\\* (.+)$', 'm'));
      return f ? f[1].trim() : null;
    };
    const durationLine = block.match(/^\*\*Duration:\*\* .+$/m);
    const text = block.slice(durationLine.index + durationLine[0].length);
    const upgrade = text.match(/^_(?:Using a Higher-Level Spell Slot|Cantrip Upgrade)\._ (.+)$/m);
    const description = cleanBody(text.replace(/^_(?:Using a Higher-Level Spell Slot|Cantrip Upgrade)\._ .+$/m, '').replace(/^#{1,3} .+$/gm, (h) => '**' + h.replace(/^#+ /, '') + '**'));
    const castingTime = field('Casting Time');
    const duration = field('Duration');
    const range = field('Range');
    const id = slug(name);
    // Machine-readable facts read from the spell's own text (used by prerequisites and the Character Guide).
    const DMG = 'Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder';
    const damageTypes = [...new Set([...description.matchAll(new RegExp(`\\d+d\\d+(?:\\s*[+\\u2212-]\\s*\\d+)?(?: plus [^.)]*?)? (${DMG}) damage`, 'g'))].map((x) => x[1].toLowerCase()))];
    // Some spells let the caster pick the type ("1d8 damage of a type you choose"): still damage.
    const dealsDamage = damageTypes.length > 0 || /\d+d\d+(?:\s*[+−-]\s*\d+)? damage\b/.test(description);
    const rangeFeet = /^(\d+) feet/.test(range) ? Number(range.match(/^(\d+) feet/)[1]) : /^(\d+) miles?/.test(range) ? 5280 : 0;
    spells[id] = {
      id, name,
      level: tag[1] ? Number(tag[1]) : 0,
      school: tag[2] || tag[3],
      classes: tag[4].split(', ').map((c) => slug(c)),
      castingTime,
      ritual: /Ritual/.test(castingTime),
      range,
      rangeFeet,
      components: field('Components') || field('Component'), // 12 SRD spells use the singular label
      duration,
      concentration: /^Concentration/.test(duration),
      damageTypes,
      dealsDamage,
      attackRoll: /\b(?:ranged|melee) spell attack\b|\bspell attack roll\b/i.test(description),
      savingThrow: (description.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/) || [])[1] || null,
      healing: /\bregains? (?:a number of )?Hit Points\b|\brestores? \S* ?Hit Points\b/i.test(description),
      description,
      higherLevels: upgrade ? upgrade[1].trim() : null,
    };
    previous = spells[id];
  });
  return spells;
}

/** Stat blocks are HTML tables; flatten them to "Label Value" lines. */
function stripStatBlock(text) {
  return text
    .replace(/<tr>([\s\S]*?)<\/tr>/g, (_, row) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((x) => stripTags(x[1])).join(' ') + '\n')
    .replace(/<[^>]+>/g, '');
}

// ---------------------------------------------------------------------------
// JSON cross-check
// ---------------------------------------------------------------------------
function crossCheck(core, spells) {
  if (!JSON_DIR) {
    warn('No --json folder given; cross-check skipped.');
    return;
  }
  const load = (n) => JSON.parse(fs.readFileSync(path.join(JSON_DIR, `5e-SRD-${n}.json`), 'utf8'));
  const jLevels = load('Levels');
  for (const id of SUPPORTED_CLASSES) {
    const cls = core.classes[id];
    jLevels.filter((l) => l.class && l.class.index === id && !l.subclass).forEach((l) => {
      const ours = cls.levels[l.level];
      if (ours.proficiencyBonus !== l.prof_bonus) warn(`${id} ${l.level}: proficiency bonus text ${ours.proficiencyBonus} vs json ${l.prof_bonus}`);
      if (l.spellcasting) {
        const sc = l.spellcasting;
        if ((sc.cantrips_known || 0) !== (ours.cantrips || 0)) warn(`${id} ${l.level}: cantrips text ${ours.cantrips} vs json ${sc.cantrips_known}`);
        if (sc.prepared_spells !== ours.preparedSpells) warn(`${id} ${l.level}: prepared spells text ${ours.preparedSpells} vs json ${sc.prepared_spells} (text used)`);
        // Pact Magic: all slots are one level; compare against that single slot level.
        const slots = ours.slots || [1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => (s === ours.pactSlotLevel ? ours.pactSlots : 0));
        for (let s = 1; s <= 9; s++) {
          if (sc['spell_slots_level_' + s] !== slots[s - 1]) warn(`${id} ${l.level}: level ${s} slots text ${slots[s - 1]} vs json ${sc['spell_slots_level_' + s]}`);
        }
      }
      const cs = l.class_specific || {};
      const pairs = [
        ['rage_count', 'rages'], ['rage_damage_bonus', 'rageDamage'], ['wild_shape_uses', 'wildShape'], ['focus_points', 'focusPoints'],
        ['unarmored_movement_bonus', 'unarmoredMovement'], ['favored_enemies', 'favoredEnemy'], ['sorcery_points', 'sorceryPoints'],
        ['eldritch_invocations', 'invocations'], ['channel_divinity_charges', 'channelDivinity'], ['second_wind_uses', 'secondWind'],
      ];
      pairs.forEach(([jk, ok]) => {
        if (cs[jk] != null && (cs[jk] || 0) !== (ours[ok] || 0)) warn(`${id} ${l.level}: ${ok} text ${ours[ok]} vs json ${cs[jk]}`);
      });
      if (cs.bardic_inspiration_die && ours.bardicDie !== 'd' + cs.bardic_inspiration_die) warn(`${id} ${l.level}: bardic die text ${ours.bardicDie} vs json d${cs.bardic_inspiration_die}`);
      if (cs.martial_arts_die && ours.martialArts !== '1d' + cs.martial_arts_die) warn(`${id} ${l.level}: martial arts text ${ours.martialArts} vs json 1d${cs.martial_arts_die}`);
      if (l.class_specific && l.class_specific.weapon_mastery != null && l.class_specific.weapon_mastery !== ours.weaponMastery) {
        warn(`${id} ${l.level}: weapon mastery text ${ours.weaponMastery} vs json ${l.class_specific.weapon_mastery}`);
      }
      if (l.class_specific && l.class_specific.sneak_attack && `${l.class_specific.sneak_attack.dice_count}d6` !== ours.sneakAttack) {
        warn(`${id} ${l.level}: sneak attack text ${ours.sneakAttack} vs json`);
      }
    });
    const jClass = load('Classes').find((c) => c.index === id);
    const choice = jClass.proficiency_choices && jClass.proficiency_choices[0];
    if (choice && choice.from && choice.from.options) {
      const jSkills = choice.from.options.map((o) => o.item && o.item.index.replace(/^skill-/, '')).filter(Boolean).sort();
      const ourSkills = cls.skillChoices.from.slice().sort();
      if (jSkills.length && JSON.stringify(jSkills) !== JSON.stringify(ourSkills)) {
        warn(`${id}: class skill list text [${ourSkills}] vs json [${jSkills}] (text used)`);
      }
    }
    if (jClass.hit_die !== cls.hitDie) warn(`${id}: hit die mismatch`);
  }
  const jSpells = load('Spells');
  const byId = Object.fromEntries(jSpells.map((s) => [s.index, s]));
  Object.values(spells).forEach((s) => {
    const j = byId[s.id];
    if (!j) {
      warn('Spell missing from json: ' + s.name);
      return;
    }
    if (j.level !== s.level) warn(`Spell ${s.name}: level text ${s.level} vs json ${j.level}`);
    if (!!j.damage !== s.dealsDamage) warn(`Spell ${s.name}: deals damage text ${s.dealsDamage} vs json ${!!j.damage}`);
    if (!!j.attack_type !== s.attackRoll) warn(`Spell ${s.name}: attack roll text ${s.attackRoll} vs json ${j.attack_type || 'none'}`);
    const jc = j.classes.map((c) => c.index).sort().join(',');
    if (jc !== s.classes.slice().sort().join(',')) warn(`Spell ${s.name}: classes text [${s.classes}] vs json [${jc}]`);
  });
  if (jSpells.length !== Object.keys(spells).length) warn(`Spell count text ${Object.keys(spells).length} vs json ${jSpells.length}`);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
function build() {
  const spells = parseSpells();
  const nameIndex = Object.fromEntries(Object.values(spells).map((s) => [s.name.toLowerCase(), s.id]));
  const spellIdByName = (n) => (n ? nameIndex[n.trim().toLowerCase()] || null : null);

  const weapons = parseWeapons();
  const armor = parseArmor();
  const feats = parseFeats();
  const classes = {};
  CLASS_NAMES.forEach((n) => {
    classes[slug(n)] = parseClass(n, weapons, armor, spellIdByName);
  });
  addClassMechanics(classes, feats, spellIdByName);

  // Class spell lists must agree with the spell entries' own class tags. The SRD itself has one known gap
  // (Phantasmal Force is tagged Wizard in its entry but missing from the Wizard list table); the entry wins.
  Object.keys(classes).filter((cid) => classes[cid].spellList).forEach((cid) => {
    const list = classes[cid].spellList;
    const fromList = new Set(Object.values(list).flat());
    const fromTags = Object.values(spells).filter((s) => s.classes.includes(cid));
    fromList.forEach((id) => spells[id].classes.includes(cid) || warn(`${cid} list has ${id} but spell entry lacks the class tag`));
    fromTags.forEach((s) => {
      if (fromList.has(s.id)) return;
      warn(`${s.name} is tagged ${cid} in its spell entry but missing from the ${cid} list table; added to the list`);
      list[s.level].push(s.id);
      list[s.level].sort();
    });
  });

  const core = {
    meta: {
      id: 'srd-5.2.1',
      edition: 'D&D 5E (2024 rules)',
      source: 'System Reference Document 5.2.1',
      license: 'CC BY 4.0',
      attribution: ATTRIBUTION,
      generatedFrom: SOURCES,
      maxLevel: 20,
      supportedClassIds: SUPPORTED_CLASSES,
      coverageNote:
        'Includes all 12 SRD classes (levels 1–20) with their SRD subclass each, all 9 SRD species, all 4 SRD backgrounds, ' +
        'all SRD feats, Metamagic options and Eldritch Invocations, and every SRD spell. Multiclassing is not supported yet.',
    },
    abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    abilityNames: { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' },
    abilityDescriptions: parseAbilityAndSkillText(SKILLS),
    skills: SKILLS,
    languages: parseLanguages(),
    abilityMethods: parseAbilityMethods(),
    alignments: ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'],
    tools: parseTools(),
    weapons,
    armor,
    masteryProperties: parseMasteryProperties(),
    weaponRules: parseWeaponRules(),
    feats,
    backgrounds: parseBackgrounds(feats, weapons, armor),
    species: parseSpecies(spellIdByName),
    classes,
    metamagic: parseMetamagic(),
    invocations: parseInvocations(),
    gear: parseGear(),
  };
  const glossary = parseGlossary();
  const alignmentText = creationMd.match(/Lawful Good/);
  assert(alignmentText, 'alignments present in character creation');

  crossCheck(core, spells);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const banner = (what) =>
    `/**\n * GENERATED FILE — do not edit by hand. Rebuild with tools/build-srd-data.mjs.\n * ${what}\n *\n * ${ATTRIBUTION}\n */\n`;
  fs.writeFileSync(
    path.join(OUT_DIR, 'srd-5.2.1-core.js'),
    banner('SRD 5.2.1 core character rules (classes, species, backgrounds, feats, equipment).') +
      `(function (global) {\n  'use strict';\n  var rules = global.FogRules = global.FogRules || {};\n  var core = ${JSON.stringify(core, null, 1)};\n  Object.keys(core).forEach(function (k) { rules[k] = core[k]; });\n})(window);\n`
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'srd-5.2.1-glossary.js'),
    banner('SRD 5.2.1 Rules Glossary (verbatim definitions used by Guided Tips).') +
      `(function (global) {
  'use strict';
  var rules = global.FogRules = global.FogRules || {};
  rules.glossary = ${JSON.stringify(glossary)};
})(window);
`
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'srd-5.2.1-spells.js'),
    banner('SRD 5.2.1 spells (all spells in the document).') +
      `(function (global) {\n  'use strict';\n  var rules = global.FogRules = global.FogRules || {};\n  rules.spells = ${JSON.stringify(spells)};\n})(window);\n`
  );

  // Report
  const count = (list) => Object.entries(list).map(([l, ids]) => `${l}:${ids.length}`).join(' ');
  console.log('Spells:', Object.keys(spells).length);
  Object.keys(classes).filter((c) => classes[c].spellList).forEach((c) => console.log(`${classes[c].name} list (${classes[c].casterType}):`, count(classes[c].spellList)));
  console.log('Metamagic:', Object.keys(core.metamagic).length, '| Invocations:', Object.keys(core.invocations).length, '| Gear:', Object.keys(core.gear).length, '| Glossary:', Object.keys(glossary).length);
  console.log('Feats:', Object.keys(feats).length, '| Species:', Object.keys(core.species).length - 1, '| Backgrounds:', Object.keys(core.backgrounds).length - 1);
  SUPPORTED_CLASSES.forEach((c) => {
    const cls = classes[c];
    console.log(`${cls.name}: d${cls.hitDie}, subclass ${cls.subclass.name} @${cls.subclassLevel}, feats @${cls.featLevels.map((f) => f.level).join(',')}, ${cls.features.length}+${cls.subclass.features.length} features`);
  });
  if (warnings.length) {
    console.log(`\n${warnings.length} note(s) from the cross-check (Markdown SRD text is used where they differ):`);
    warnings.forEach((w) => console.log(' - ' + w));
  }
}

build();
