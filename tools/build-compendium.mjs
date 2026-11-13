#!/usr/bin/env node
/**
 * Fog of the Dragon — SRD 5.2.1 monster data generator (Monsters & Spells page)
 *
 *   node tools/build-compendium.mjs --md <dir> [--json <file>]
 *
 * --md    Folder with the SRD 5.2.1 Markdown conversion (https://github.com/downfallx/dnd-5e-srd-markdown, CC BY 4.0):
 *         monsters-A-Z.md and animals.md are read. This is the primary source (official SRD text).
 * --json  Optional 5e-bits/5e-database `src/2024/en/5e-SRD-Monsters.json` (MIT code, SRD content). Used only as a
 *         cross-check of AC, HP, CR and ability scores; every disagreement is printed for review.
 *
 * Output: Assets/Data/srd-5.2.1-monsters.json
 * The source folders are only read as data; nothing from them is executed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = {
  markdown: 'downfallx/dnd-5e-srd-markdown@1b4b99dcb786cdd1a2fb26f8acec1551191f1ca4 (monsters-A-Z.md, animals.md)',
  json: '5e-bits/5e-database@a6212beb4b278917c2cff41c2b04c4ef4f3e0d6f (src/2024/en/5e-SRD-Monsters.json, cross-check only)',
};
const ATTRIBUTION =
  'This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, ' +
  'available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 ' +
  'International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const mdDir = opt('--md');
const jsonFile = opt('--json');
if (!mdDir) {
  console.error('Usage: node tools/build-compendium.mjs --md <srd-markdown-folder> [--json <5e-SRD-Monsters.json>]');
  process.exit(1);
}

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/** Markdown-lite text kept for display: <br>/&emsp; become line breaks, other HTML is removed. */
function cleanText(s) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&emsp;/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function crValue(cr) {
  if (/^\d+\/\d+$/.test(cr)) { const [a, b] = cr.split('/').map(Number); return a / b; }
  return Number(cr);
}

function slug(s) {
  return s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseFile(file, sourceLabel) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const monsters = [];
  let group = null;
  for (let i = 0; i < lines.length; i++) {
    const h = /^#{2,4} (.+)$/.exec(lines[i]);
    if (!h) continue;
    // A stat block: heading, then an italic "_Size Type, Alignment_" line, then **AC**.
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    const typeLine = /^_(.+)_\s*$/.exec(lines[j] || '');
    if (!typeLine || !SIZES.some((sz) => typeLine[1].startsWith(sz))) {
      if (/^## /.test(lines[i])) group = h[1].trim(); // a group heading (e.g. “Dragons, Chromatic”)
      continue;
    }
    let k = j + 1;
    while (k < lines.length && !lines[k].trim()) k++;
    if (!/^\*\*AC\*\*/.test(lines[k] || '')) continue;

    const name = h[1].trim();
    const m = { id: slug(name), name, group: group && group !== name ? group : null, source: sourceLabel };
    const tl = typeLine[1];
    const lastComma = tl.lastIndexOf(',');
    const left = lastComma > 0 ? tl.slice(0, lastComma) : tl;
    m.alignment = lastComma > 0 ? tl.slice(lastComma + 1).trim() : null;
    const sizeMatch = /^((?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?: or (?:Tiny|Small|Medium|Large|Huge|Gargantuan))?)\s+(.+)$/.exec(left);
    m.size = sizeMatch ? sizeMatch[1] : left;
    const typeFull = sizeMatch ? sizeMatch[2] : '';
    const tag = /\(([^)]+)\)/.exec(typeFull);
    m.type = typeFull.replace(/\s*\([^)]*\)/, '').trim();
    m.typeTags = tag ? tag[1] : null;

    // Header lines until the ability table
    let p = k;
    const header = [];
    while (p < lines.length && !/^<table/.test(lines[p])) { header.push(lines[p]); p++; }
    const hdr = header.join(' ');
    const ac = /\*\*AC\*\*\s*([^*<]+?)\s*(?:\*\*Initiative\*\*|<br>|$)/.exec(hdr);
    const ini = /\*\*Initiative\*\*\s*([^<]+?)\s*<br>/.exec(hdr);
    const hp = /\*\*HP\*\*\s*([^<]+?)\s*<br>/.exec(hdr);
    const spd = /\*\*Speed\*\*\s*([^<]+?)\s*(?:<br>|$)/.exec(hdr);
    m.ac = ac ? ac[1].trim() : null;
    m.initiative = ini ? ini[1].trim() : null;
    m.hp = hp ? hp[1].trim() : null;
    m.hpAverage = hp ? Number((/^(\d+)/.exec(hp[1]) || [])[1]) : null;
    m.speed = spd ? spd[1].trim() : null;

    // Ability table: name, score, mod, save
    const tableEnd = lines.indexOf('</table>', p);
    const cells = lines.slice(p, tableEnd).join('\n').match(/<td>(.*?)<\/td>/g) || [];
    // Tokens instead of fixed cells: a few source tables have shifted cells (e.g. “+10 +10” in one cell).
    const toks = cells.map((c) => c.replace(/<\/?td>|<\/?strong>/g, ' ')).join(' ').replace(/−/g, '-').split(/\s+/).filter(Boolean);
    m.abilities = {};
    for (let t = 0; t + 3 < toks.length; t++) {
      const ab = toks[t].toUpperCase();
      if (!ABILITIES.includes(ab) || m.abilities[ab.toLowerCase()]) continue;
      const score = Number(toks[t + 1]);
      if (!/^\d+$/.test(toks[t + 1]) || !/^[+-]\d+$/.test(toks[t + 2])) continue;
      if (Number(toks[t + 2]) !== Math.floor((score - 10) / 2)) continue; // the modifier must match the score
      const saveOk = /^[+-]\d+$/.test(toks[t + 3] || '');
      m.abilities[ab.toLowerCase()] = { score, mod: toks[t + 2], save: saveOk ? toks[t + 3] : null };
      t += saveOk ? 3 : 2;
    }

    // Detail lines (**Skills** … **CR**) and sections (#### Traits / Actions / …)
    let q = tableEnd + 1;
    const details = {};
    while (q < lines.length && !/^#{2,4} /.test(lines[q])) {
      const ln = lines[q].trim();
      let dm;
      const re = /\*\*([A-Za-z ]+)\*\*\s*([^*]+?)(?=\s*(?:<br>|\*\*[A-Z]|$))/g;
      while ((dm = re.exec(ln))) details[dm[1].trim()] = cleanText(dm[2]).replace(/<br>$/, '').trim();
      q++;
    }
    m.skills = details.Skills || null;
    m.vulnerabilities = details.Vulnerabilities || null;
    m.resistances = details.Resistances || null;
    m.immunities = details.Immunities || null; // 2024 stat blocks list damage and condition immunities together ("Fire; Poisoned")
    m.gear = details.Gear || null;
    m.senses = details.Senses || null;
    m.languages = details.Languages || null;
    const cr = /^([\d/]+)\s*(?:\((.*)\))?/.exec(details.CR || '');
    m.cr = cr ? cr[1] : null;
    m.crValue = cr ? crValue(cr[1]) : null;
    m.crDetails = cr && cr[2] ? cr[2] : null;
    const xp = /XP ([\d,]+)|([\d,]+) XP/.exec(details.CR || ''); // the source writes both “XP 700” and “2,300 XP”
    m.xp = xp ? Number((xp[1] || xp[2]).replace(/,/g, '')) : null;
    const pb = /PB \+(\d+)/.exec(details.CR || '');
    m.proficiencyBonus = pb ? Number(pb[1]) : null;

    const sections = {};
    let current = null;
    // Section headings (Traits, Actions…) are one level below the monster's heading (#### in Monsters A–Z, ### in Animals).
    const depth = /^#+/.exec(lines[i])[0].length;
    for (; q < lines.length; q++) {
      const ln = lines[q];
      const hd = /^(#+) (.+)$/.exec(ln);
      if (hd && hd[1].length <= depth) break; // next monster or group
      const sec = hd && hd[1].length === depth + 1 ? [null, hd[2]] : null;
      if (hd && !sec) break;
      if (sec) {
        const key = { Traits: 'traits', Actions: 'actions', 'Bonus Actions': 'bonusActions', Reactions: 'reactions', 'Legendary Actions': 'legendaryActions' }[sec[1].trim()];
        if (!key) break; // a new stat block one level down
        current = sections[key] = { intro: null, entries: [] };
        continue;
      }
      if (!current || !ln.trim() || /^<hr>/.test(ln.trim())) continue;
      const entry = /^\*\*_(.+?)\._\*\*\s*(.*)$/.exec(ln.trim());
      if (entry) current.entries.push({ name: entry[1].trim(), text: cleanText(entry[2]) });
      else if (current.entries.length) current.entries[current.entries.length - 1].text += '\n' + cleanText(ln);
      else current.intro = (current.intro ? current.intro + '\n' : '') + cleanText(ln).replace(/^_(.*)_$/, '$1');
    }
    m.traits = sections.traits ? sections.traits.entries : [];
    m.actions = sections.actions ? sections.actions.entries : [];
    m.bonusActions = sections.bonusActions ? sections.bonusActions.entries : [];
    m.reactions = sections.reactions ? sections.reactions.entries : [];
    m.legendaryActions = sections.legendaryActions ? sections.legendaryActions.entries : [];
    m.legendaryIntro = sections.legendaryActions ? sections.legendaryActions.intro : null;
    monsters.push(m);
    i = q - 1;
  }
  return monsters;
}

const monsters = parseFile(path.join(mdDir, 'monsters-A-Z.md'), 'SRD 5.2.1 — Monsters A–Z')
  .concat(parseFile(path.join(mdDir, 'animals.md'), 'SRD 5.2.1 — Animals'));

// Unique ids
const seen = {};
monsters.forEach((m) => { if (seen[m.id]) m.id = m.id + '-' + (++seen[m.id]); else seen[m.id] = 1; });

// A few source tables have typos (a missing score or an unsigned save). Fill only those gaps from the 5e-database
// copy of the same SRD stat block, and record it on the entry.
if (jsonFile) {
  const db = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const norm = (n) => n.toLowerCase().replace(/[’']/g, "'");
  const byName = {};
  db.forEach((x) => { byName[norm(x.name)] = x; });
  const FULL = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' };
  monsters.forEach((m) => {
    const x = byName[norm(m.name)];
    if (!x) return;
    Object.keys(FULL).forEach((k) => {
      const a = m.abilities[k];
      if (a && a.save) return;
      const score = x[FULL[k]];
      const mod = Math.floor((score - 10) / 2);
      const prof = (x.proficiencies || []).find((p) => p.proficiency && p.proficiency.index === 'saving-throw-' + k);
      const save = prof ? prof.value : mod;
      const sgn = (n) => (n >= 0 ? '+' : '-') + Math.abs(n);
      m.abilities[k] = { score: a ? a.score : score, mod: sgn(mod), save: sgn(save) };
      (m.dataNotes = m.dataNotes || []).push((a ? 'Saving throw' : 'Score') + ' for ' + k.toUpperCase() + ' taken from 5e-database (the SRD markdown table has a typo).');
    });
  });
}

// Completeness: a stat block must have these to be offered as fully supported.
const problems = [];
monsters.forEach((m) => {
  const missing = ['ac', 'hp', 'speed', 'cr', 'size', 'type'].filter((k) => !m[k]);
  if (Object.keys(m.abilities).length !== 6) missing.push('abilities');
  if (!m.actions.length && !m.traits.length && !m.bonusActions.length && !m.reactions.length) missing.push('traits/actions');
  m.complete = missing.length === 0;
  if (missing.length) problems.push(m.name + ': missing ' + missing.join(', '));
});

// Cross-check with 5e-database
let compared = 0;
const diffs = [];
if (jsonFile) {
  const db = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const byName = {};
  const norm = (n) => n.toLowerCase().replace(/[’']/g, "'");
  db.forEach((x) => { byName[norm(x.name)] = x; });
  monsters.forEach((m) => {
    const x = byName[norm(m.name)];
    if (!x) { diffs.push(m.name + ': not in 5e-database'); return; }
    compared++;
    const acNum = Number((/^(\d+)/.exec(m.ac || '') || [])[1]);
    if (x.armor_class && x.armor_class[0] && x.armor_class[0].value !== acNum) diffs.push(m.name + ': AC ' + m.ac + ' vs ' + x.armor_class[0].value);
    if (x.hit_points !== m.hpAverage) diffs.push(m.name + ': HP ' + m.hpAverage + ' vs ' + x.hit_points);
    if (Math.abs(x.challenge_rating - m.crValue) > 0.001) diffs.push(m.name + ': CR ' + m.cr + ' vs ' + x.challenge_rating);
    ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].forEach((ab) => {
      const k = ab.slice(0, 3);
      if (m.abilities[k] && m.abilities[k].score !== x[ab]) diffs.push(m.name + ': ' + k.toUpperCase() + ' ' + m.abilities[k].score + ' vs ' + x[ab]);
    });
  });
  const mdNames = new Set(monsters.map((m) => norm(m.name)));
  // 5e-database splits shape-changers into one entry per form (“Werewolf, Wolf Form”); the SRD has one stat block.
  db.forEach((x) => { if (!mdNames.has(norm(x.name)) && !/, .+ Form$/.test(x.name)) diffs.push(x.name + ': in 5e-database but not parsed from the SRD markdown'); });
}

monsters.sort((a, b) => a.name.localeCompare(b.name));
const out = {
  meta: {
    id: 'srd-5.2.1-monsters',
    kind: 'monster',
    edition: '2024 (SRD 5.2.1)',
    source: 'System Reference Document 5.2.1',
    origin: 'official-srd',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    attribution: ATTRIBUTION,
    generatedFrom: SOURCES,
    count: monsters.length,
    complete: monsters.filter((m) => m.complete).length,
    notes: 'Environment is not part of the SRD 5.2.1 stat blocks, so it is not included.',
  },
  monsters,
};
const outFile = path.join(ROOT, 'Assets/Data/srd-5.2.1-monsters.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out));

console.log('Monsters parsed:', monsters.length, '(complete:', out.meta.complete + ')');
const byType = {};
monsters.forEach((m) => { byType[m.type] = (byType[m.type] || 0) + 1; });
console.log('By type:', JSON.stringify(byType));
if (problems.length) console.log('Incomplete stat blocks:\n  ' + problems.join('\n  '));
if (jsonFile) console.log('Cross-checked with 5e-database:', compared, 'monsters;', diffs.length, 'differences' + (diffs.length ? ':\n  ' + diffs.join('\n  ') : ''));
console.log('Wrote', path.relative(ROOT, outFile), Math.round(fs.statSync(outFile).size / 1024) + ' KB');
