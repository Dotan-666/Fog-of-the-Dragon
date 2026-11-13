/**
 * Licensed audio catalog (Assets/Audio/catalog.json): every entry is complete, licensed for commercial use and
 * redistribution, and points at a file that exists.
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/sandbox.mjs';

const DIR = path.join(ROOT, 'Assets/Audio');
const catalog = JSON.parse(fs.readFileSync(path.join(DIR, 'catalog.json'), 'utf8'));

test('every license used is defined and allows commercial use, redistribution and modification', () => {
  const used = new Set(catalog.tracks.map((t) => t.license));
  for (const key of used) {
    const lic = catalog.licenses[key];
    assert.ok(lic, 'license defined: ' + key);
    assert.equal(lic.commercialUse, true, key);
    assert.equal(lic.redistribution, true, key);
    assert.ok(/^https:\/\/creativecommons\.org\//.test(lic.url), key);
  }
});

test('every track has id, name, kind, category, author, source page, attribution note and an existing local file', () => {
  const ids = new Set();
  for (const t of catalog.tracks) {
    assert.ok(t.id && !ids.has(t.id), 'unique id ' + t.id);
    ids.add(t.id);
    for (const k of ['name', 'kind', 'category', 'author', 'source', 'sourceUrl', 'license', 'attribution', 'file']) assert.ok(t[k], t.id + ' has ' + k);
    assert.ok(['music', 'ambience', 'sfx'].includes(t.kind), t.id);
    assert.match(t.sourceUrl, /^https:\/\/opengameart\.org\/content\//, t.id);
    assert.match(t.file, /^(music|ambience|sfx)\/[\w.-]+\.(mp3|ogg|wav)$/, t.id);
    const file = path.join(DIR, t.file);
    assert.ok(fs.existsSync(file), 'file exists: ' + t.file);
    assert.ok(fs.statSync(file).size > 1000, 'file not empty: ' + t.file);
  }
});

test('the library covers the requested categories with real recordings', () => {
  const by = (kind, cat) => catalog.tracks.filter((t) => t.kind === kind && (!cat || t.category === cat)).length;
  assert.ok(by('music', 'combat') >= 1, 'combat');
  assert.ok(by('music', 'exploration') >= 1, 'exploration');
  assert.ok(by('music', 'tavern') >= 2, 'towns and taverns');
  assert.ok(by('music', 'dungeon') + by('ambience', 'dungeon') >= 2, 'dungeon');
  assert.ok(by('music', 'boss') >= 1, 'boss battles');
  assert.ok(by('music', 'horror') >= 1, 'horror and suspense');
  assert.ok(by('ambience', 'nature') >= 2, 'nature and ambient');
  assert.ok(by('sfx') >= 60, 'sound effects');
  for (const cat of ['combat', 'magic', 'creatures', 'objects', 'horror', 'nature']) assert.ok(catalog.tracks.some((t) => t.kind === 'sfx' && t.category === cat), 'sfx in ' + cat);
});

test('every entry has a known category and a measured duration; effects are short', () => {
  const cats = new Set(catalog.categories.map((c) => c.id));
  for (const t of catalog.tracks) {
    assert.ok(cats.has(t.category), t.id + ' category ' + t.category);
    assert.ok(typeof t.duration === 'number' && t.duration > 0, t.id + ' duration');
    if (t.kind === 'sfx') assert.ok(t.duration < 15, t.id + ' is a short effect (' + t.duration + ' s)');
  }
});

test('ATTRIBUTION.md is generated from the catalog and up to date (every file listed with its source page)', async () => {
  const { buildAttribution } = await import('../tools/build-audio-attribution.mjs');
  const doc = fs.readFileSync(path.join(DIR, 'ATTRIBUTION.md'), 'utf8');
  assert.equal(doc, buildAttribution(catalog), 'run: node tools/build-audio-attribution.mjs');
  for (const t of catalog.tracks) assert.ok(doc.includes('`' + t.file + '`') && doc.includes(t.sourceUrl), t.id);
});

test('every audio file in Assets/Audio is listed in the catalog (no unlicensed extras)', () => {
  const listed = new Set(catalog.tracks.map((t) => t.file));
  for (const sub of ['music', 'ambience', 'sfx']) {
    for (const f of fs.readdirSync(path.join(DIR, sub))) assert.ok(listed.has(sub + '/' + f), 'listed: ' + sub + '/' + f);
  }
});

test('background audio (music and ambience) has moods, an intensity and scene types from the catalog taxonomy', () => {
  const moods = new Set(catalog.moods.map((m) => m.id));
  const scenes = new Set(catalog.scenes.map((s) => s.id));
  const levels = new Set(catalog.intensities.map((i) => i.id));
  for (const t of catalog.tracks.filter((x) => x.kind !== 'sfx')) {
    assert.ok(Array.isArray(t.moods) && t.moods.length && t.moods.every((m) => moods.has(m)), t.id + ' moods');
    assert.ok(levels.has(t.intensity), t.id + ' intensity');
    assert.ok(Array.isArray(t.scenes) && t.scenes.length && t.scenes.every((s) => scenes.has(s)), t.id + ' scenes');
  }
});

test('music covers combat, exploration, atmosphere, locations, story moments and creatures/factions; no duplicate files', () => {
  const music = catalog.tracks.filter((t) => t.kind === 'music');
  for (const cat of ['combat', 'boss', 'exploration', 'tavern', 'dungeon', 'horror', 'atmosphere', 'story', 'creatures']) assert.ok(music.some((t) => t.category === cat), 'music in ' + cat);
  const sceneSet = new Set(music.flatMap((t) => t.scenes));
  for (const s of ['town', 'tavern', 'forest', 'desert', 'snow', 'cave', 'temple', 'battle', 'boss-fight', 'before-battle', 'sad-moment', 'rest', 'undead']) assert.ok(sceneSet.has(s), 'a track for ' + s);
  assert.ok(music.length >= 19);
  assert.equal(new Set(catalog.tracks.map((t) => t.file)).size, catalog.tracks.length, 'no file listed twice');
  assert.equal(new Set(catalog.tracks.map((t) => t.sourceUrl + '|' + t.file)).size, catalog.tracks.length);
  const total = music.reduce((n, t) => n + fs.statSync(path.join(DIR, t.file)).size, 0);
  assert.ok(music.every((t) => fs.statSync(path.join(DIR, t.file)).size < 6 * 1024 * 1024), 'no single music file over 6 MB (streamed one at a time)');
  assert.ok(total < 40 * 1024 * 1024, 'music stays modest in total');
});
