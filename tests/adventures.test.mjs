/**
 * Adventure data model (JS/Dashboard/adventures/adventure-model.js): structure, cleaning, limits, stats, duplicate.
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/sandbox.mjs';

const window = { console };
vm.runInContext(fs.readFileSync(path.join(ROOT, 'JS/Dashboard/adventures/adventure-model.js'), 'utf8'), vm.createContext({ window, console, crypto: globalThis.crypto }), { filename: 'adventure-model.js' });
const M = window.FogAdventureModel;
const J = (x) => JSON.parse(JSON.stringify(x));

function sample() {
  const a = M.newAdventure({ title: 'The Sunken Bell', genre: 'Mystery & investigation', levelMin: 3, levelMax: 5 });
  const c1 = M.newChapter('Act I: Arrival');
  const s1 = M.newSection('scene', 'The drowned village');
  s1.playerText = 'Mist curls over the black water. A bell tolls beneath the waves.';
  s1.dmNotes = 'The bell rings only when someone lies.';
  const npc = M.newSection('npc', 'Mayor Odile');
  npc.fields = { role: 'Mayor', motivation: 'Hide her deal with the hag', bogus: 'dropped' };
  c1.sections.push(s1, npc);
  a.content.chapters.push(c1, M.newChapter('Act II: The Bell Tower'));
  return M.normalize(a);
}

test('an adventure is structured data: chapters → sections with player text apart from DM notes', () => {
  const a = sample();
  assert.equal(a.content.schema, 1);
  assert.deepEqual(J(a.content.chapters.map((c) => c.title)), ['Act I: Arrival', 'Act II: The Bell Tower']);
  const [scene, npc] = a.content.chapters[0].sections;
  assert.equal(scene.kind, 'scene');
  assert.match(scene.playerText, /bell tolls/);
  assert.match(scene.dmNotes, /lies/);
  assert.deepEqual(J(npc.fields), { role: 'Mayor', motivation: 'Hide her deal with the hag' }, 'only the fields of the section kind are kept');
  assert.equal(M.levelLabel(a), 'Levels 3–5');
});

test('normalize cleans bad input: unknown kinds, lengths, levels, status, cover, HTML-ish text kept as plain text', () => {
  const a = M.normalize({
    title: '  ' + 'x'.repeat(300), status: 'published', levelMin: 12, levelMax: 4, coverImage: 'https://evil.example/a.png',
    content: { chapters: [{ title: '', sections: [{ kind: 'dragon', title: '<b>Hi</b>', playerText: 'Line 1\r\nLine 2' }, null] }] },
  });
  assert.equal(a.title.length, 100);
  assert.equal(a.status, 'draft');
  assert.deepEqual([a.levelMin, a.levelMax], [4, 12], 'levels are put in order');
  assert.equal(a.coverImage, null, 'only a JPEG data URL is accepted as cover');
  assert.equal(a.content.chapters[0].title, 'Untitled chapter');
  assert.equal(a.content.chapters[0].sections[0].kind, 'scene');
  assert.equal(a.content.chapters[0].sections[0].title, '<b>Hi</b>', 'stored as plain text; the editor escapes it');
  assert.equal(a.content.chapters[0].sections[0].playerText, 'Line 1\nLine 2');
  assert.equal(a.content.chapters[0].sections.length, 2);
});

test('validate reports problems that block saving; limits match the database', () => {
  const a = sample();
  assert.deepEqual(J(M.validate(a)), []);
  a.title = '   ';
  assert.match(M.validate(a)[0], /title/);
  const big = M.newAdventure({ title: 'Big' });
  for (let i = 0; i < 101; i++) big.content.chapters.push(M.newChapter('C' + i));
  assert.ok(M.validate(big).some((e) => /at most 100 chapters/.test(e)));
  assert.equal(M.LIMITS.chapters, 100);
  assert.equal(M.LIMITS.sections, 200);
});

test('stats count chapters, sections and words', () => {
  const st = M.stats(sample());
  assert.equal(st.chapters, 2);
  assert.equal(st.sections, 2);
  assert.ok(st.words > 20);
});

test('duplicate makes a new draft with fresh ids and the same content', () => {
  const a = sample();
  a.id = 'adv-1';
  a.status = 'ready';
  a.version = 7;
  const d = M.duplicate(a);
  assert.equal(d.id, null);
  assert.equal(d.version, null);
  assert.equal(d.status, 'draft');
  assert.equal(d.title, 'Copy of The Sunken Bell');
  assert.notEqual(d.content.chapters[0].id, a.content.chapters[0].id);
  assert.notEqual(d.content.chapters[0].sections[0].id, a.content.chapters[0].sections[0].id);
  assert.equal(d.content.chapters[0].sections[0].playerText, a.content.chapters[0].sections[0].playerText);
});

test('move reorders chapters and sections and stays within bounds', () => {
  const list = ['a', 'b', 'c'];
  assert.equal(M.move(list, 2, -1), 1);
  assert.deepEqual(list, ['a', 'c', 'b']);
  assert.equal(M.move(list, 0, -1), 0, 'cannot move above the top');
  assert.deepEqual(list, ['a', 'c', 'b']);
});

test('every section kind has a label, icon and only known field types', () => {
  for (const k of M.KIND_ORDER) {
    const kind = M.KINDS[k];
    assert.ok(kind.label && kind.icon && kind.hint, k);
    for (const f of kind.fields) assert.ok(f.key && f.label, k + '.' + f.key);
  }
});

test('images: chapters and sections keep well-formed image paths only (max 12, no duplicates), with caption and handout', () => {
  const ok = (n) => `u-1/adventures/adv1/img${n}.jpg`;
  const a = M.normalize({
    title: 'Pictures',
    content: { schema: 1, chapters: [{ title: 'C', images: [{ path: ok(1), caption: 'Map\nof the lake', handout: true }], sections: [{ kind: 'scene', title: 'S', images: [
      { path: ok(2), caption: 'x'.repeat(300) },
      { path: ok(2) }, // duplicate
      { path: 'https://evil.example/x.jpg' },
      { path: '../../etc/passwd' },
      { path: 'u-1/homebrew/hb1/x.jpg' }, // not an adventure image
      { path: ok(3), handout: 'yes' },
      ...Array.from({ length: 15 }, (_, i) => ({ path: ok(10 + i) })),
    ] }] }] },
  });
  const ch = a.content.chapters[0];
  assert.deepEqual(J(ch.images.map((i) => [i.path, i.caption, i.handout])), [[ok(1), 'Map of the lake', true]]);
  const imgs = ch.sections[0].images;
  assert.equal(imgs.length, 12, 'at most 12 per section');
  assert.equal(imgs[0].caption.length, 200);
  assert.equal(imgs[1].path, ok(3));
  assert.equal(imgs[1].handout, false, 'handout must be exactly true');
  assert.ok(imgs.every((i) => /^i_/.test(i.id)));
  assert.equal(M.imagePaths(a).length, 13);
  assert.equal(M.newImage('bad path'), null);
  assert.deepEqual(J(M.newSection('npc').images), []);
  assert.deepEqual(J(M.newChapter('X').images), []);
});

// ---------------------------------------------------------------------------
// Attached assets (NPCs, portraits, maps, locations, monsters, magic items, spells, handouts) and book settings
// ---------------------------------------------------------------------------
test('assets: every requested type exists, with its own fields, cleaned like sections', () => {
  assert.deepEqual(J(M.ASSET_ORDER), ['npc', 'portrait', 'map', 'location', 'monster', 'item', 'spell', 'handout']);
  const a = sample();
  const ch = a.content.chapters[0];
  a.content.assets.push(
    M.newAsset('npc', 'Mayor Odile', { summary: 'The mayor of Brinemoor.', fields: { role: 'Mayor', bogus: 'x' }, link: { chapterId: ch.id, sectionId: ch.sections[1].id } }),
    M.newAsset('item', 'Bell Clapper', { fields: { rarity: 'Rare', attunement: 'Maybe' } }),
    M.newAsset('monster', 'Drowned ones', { ref: { source: 'srd', name: 'Zombie' } }),
    { type: 'dragon', title: '' },
  );
  const n = M.normalize(J(a));
  const [npc, item, mon, odd] = n.content.assets;
  assert.deepEqual(J(npc.fields), { role: 'Mayor' }, 'unknown fields dropped');
  assert.deepEqual(J(npc.link), { chapterId: ch.id, sectionId: ch.sections[1].id });
  assert.equal(item.fields.rarity, 'Rare');
  assert.equal(item.fields.attunement, undefined, 'an option outside the list is dropped');
  assert.deepEqual(J(mon.ref), { source: 'srd', name: 'Zombie' }, 'a reference to Monsters & Spells instead of a copy');
  assert.deepEqual([odd.type, odd.title], ['npc', 'NPC'], 'an unknown type becomes an NPC with a default title');
  assert.deepEqual([npc.printable, npc.playerVisible, npc.origin], [true, false, 'manual'], 'printable by default, private by default');
  assert.deepEqual(J(M.assetsFor(n, ch.id).map((x) => x.title)), ['Mayor Odile']);
});

test('assets: links to a removed chapter or section fall away; bad refs, ids and too many images are cleaned', () => {
  const a = sample();
  const ch = a.content.chapters[0];
  a.content.assets = [
    { id: 'a1', type: 'map', title: 'Old map', link: { chapterId: 'gone' } },
    { id: 'a2', type: 'map', title: 'Tower map', link: { chapterId: ch.id, sectionId: 'gone' } },
    { id: 'a2', type: 'map', title: 'Duplicate id' },
    { id: 'bad id!', type: 'spell', ref: { source: 'nowhere', name: 'X' }, images: Array.from({ length: 6 }, (_, i) => ({ path: 'u1/adventures/adv1/img' + i + '.jpg' })) },
  ];
  const n = M.normalize(J(a));
  assert.equal(n.content.assets.length, 3, 'duplicate ids are dropped');
  assert.equal(n.content.assets[0].link, null);
  assert.deepEqual(J(n.content.assets[1].link), { chapterId: ch.id, sectionId: null }, 'a removed section leaves the chapter link');
  assert.notEqual(n.content.assets[2].id, 'bad id!');
  assert.equal(n.content.assets[2].ref, null);
  assert.equal(n.content.assets[2].images.length, M.LIMITS.assetImages);
  assert.ok(M.imagePaths(n).includes('u1/adventures/adv1/img0.jpg'), 'asset images count as images of the adventure (cleanup, duplicates)');
});

test('assets: Foggy origin is kept; duplicating gives new ids and links follow the copied chapters', () => {
  const a = sample();
  const ch = a.content.chapters[0];
  a.content.assets.push(M.newAsset('location', 'Bell tower', { origin: 'foggy', link: { chapterId: ch.id, sectionId: ch.sections[0].id } }));
  const n = M.normalize(J(a));
  assert.equal(n.content.assets[0].origin, 'foggy');
  const copy = M.duplicate(n);
  const cch = copy.content.chapters[0];
  assert.notEqual(copy.content.assets[0].id, n.content.assets[0].id);
  assert.deepEqual(J(copy.content.assets[0].link), { chapterId: cch.id, sectionId: cch.sections[0].id });
  assert.equal(M.stats(n).assets, 1);
});

test('book settings: page size and appendix choices for a future printable book (defaults, cleaning)', () => {
  const n = M.normalize({ title: 'X', content: { schema: 1, chapters: [] } });
  assert.deepEqual(J(n.content.book), { pageSize: 'letter', appendix: true, includeHandouts: true });
  assert.deepEqual(J(M.normalize({ title: 'X', content: { schema: 1, chapters: [], book: { pageSize: 'a4', appendix: false, includeHandouts: false } } }).content.book), { pageSize: 'a4', appendix: false, includeHandouts: false });
  assert.equal(M.normalize({ title: 'X', content: { schema: 1, chapters: [], book: { pageSize: 'tabloid' } } }).content.book.pageSize, 'letter');
  const big = M.normalize({ title: 'X', content: { schema: 1, chapters: [], assets: Array.from({ length: 250 }, () => ({ type: 'npc' })) } });
  assert.equal(big.content.assets.length, M.LIMITS.assets);
});
