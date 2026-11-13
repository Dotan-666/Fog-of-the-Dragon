/** Browser test (see lib.mjs for setup): adventure assets in the Reader — placed in context, DM/Player visibility,
 * map enlarge, missing-image fallback and the print copy (also saved as a real PDF via Chrome's print engine). */
import fs from 'node:fs';
import { open, BASE, SHOTS } from './lib.mjs';
const { browser, page, errors } = await open({ w: 1366, h: 900 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (name, cond, extra = '') => res.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 300)]);
const H = (hash, q = '') => `${BASE}/tests/ui/characters-harness.html?mock=adventures${q}${hash}`;
const ready = async () => { await page.waitForFunction(() => window.__harnessReady > 0, { timeout: 10000 }); await sleep(700); };

await page.goto(H('#adventures'), { waitUntil: 'load' }); await ready();
const PNG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#7a5a3a"/><text x="300" y="210" font-size="48" text-anchor="middle" fill="#fff">MAP</text></svg>');
const id = await page.evaluate(async (png) => {
  localStorage.removeItem('__mock_adventures');
  const M = FogAdventureModel;
  const a = (await FogAdventureStore.create({ title: 'The Sunken Bell' })).adventure;
  const ch = M.newChapter('Act I: Brinemoor');
  const town = M.newSection('location', 'The drowned village'); town.playerText = 'Mist over black water.';
  const inn = M.newSection('npc', 'Mayor Odile'); inn.playerText = 'A nervous smile.'; inn.dmNotes = 'She made a deal with the hag.';
  const fight = M.newSection('encounter', 'Drowned ones'); fight.playerText = 'Shapes rise from the lake.';
  ch.sections.push(town, inn, fight);
  a.content.chapters.push(ch);
  const img = (n) => ({ id: 'i' + n, path: 'u-test/adventures/' + a.id + '/img' + n + '.png', caption: 'Picture ' + n });
  const store = {};
  [1, 2, 3, 4, 5].forEach((n) => { store['u-test/adventures/' + a.id + '/img' + n + '.png'] = { url: png, bytes: 100, type: 'image/svg+xml' }; });
  localStorage.setItem('__mock_images', JSON.stringify(store)); // img9 is deliberately missing
  a.content.assets = [
    M.newAsset('map', 'Map of Brinemoor', { summary: 'The village, half under water.', fields: { legend: '1. Bell tower (secret door)' }, images: [img(1)], link: { chapterId: ch.id, sectionId: null }, playerVisible: false }),
    M.newAsset('npc', 'Mayor Odile', { summary: 'Silver hair, wet shoes.', dmNotes: 'Lies about the bell.', fields: { motivation: 'Keep the deal secret' }, images: [img(2)], link: { chapterId: ch.id, sectionId: inn.id }, playerVisible: true }),
    M.newAsset('monster', 'Drowned One', { summary: 'A bloated corpse that walks.', ref: { source: 'srd', name: 'Zombie' }, images: [img(3)], link: { chapterId: ch.id, sectionId: fight.id }, playerVisible: false }),
    M.newAsset('item', 'Bell Clapper', { summary: 'A heavy bronze clapper, warm to the touch.', fields: { rarity: 'Rare' }, images: [img(4)], link: { chapterId: ch.id, sectionId: fight.id }, playerVisible: true, printable: false }),
    M.newAsset('location', 'The Bell Tower', { summary: 'Leaning, green with algae.', images: [{ id: 'i9', path: 'u-test/adventures/' + a.id + '/img9.png', caption: 'Broken' }], link: { chapterId: ch.id, sectionId: town.id }, playerVisible: true }),
    M.newAsset('handout', 'The Mayor’s letter', { summary: 'Meet me at the tower at midnight. Tell no one.', link: { chapterId: ch.id, sectionId: inn.id }, playerVisible: true }),
    M.newAsset('spell', 'Drowning Hex', { summary: 'A curse spoken underwater.', playerVisible: false }),
  ];
  const n = M.normalize(Object.assign({}, a, { content: a.content }));
  n.id = a.id; n.version = a.version;
  await FogAdventureStore.save(n);
  return a.id;
}, PNG);
await page.goto('about:blank');
await page.goto(H('#adventures/' + id + '/read'), { waitUntil: 'load' }); await ready();
await page.$eval('[data-rd-mode="dm"]', (b) => b.click()); await sleep(300);
await page.$eval('[data-rd-page="1"]', (b) => b.click()); await sleep(800);
const where = (assetTitle) => page.evaluate((t) => { const a = [...document.querySelectorAll('#rd-page .rd-asset')].find((x) => x.querySelector('.rd-asset-title').innerText.includes(t)); if (!a) return null; const sec = a.closest('.rd-section'); return sec ? sec.querySelector('.rd-section-title').innerText : 'chapter'; }, assetTitle);
check('DM: the map appears in its chapter', (await where('Map of Brinemoor')) === 'chapter');
check('DM: the NPC portrait appears beside the NPC section', (await where('Mayor Odile')) === 'Mayor Odile' && await page.$('#rd-page .rd-asset-npc.is-side .rd-asset-pic img') !== null);
check('DM: the monster appears in its encounter, with its rules reference', (await where('Drowned One')) === 'Drowned ones' && /Rules: Zombie \(SRD 5\.2\.1\)/.test(await page.$eval('#rd-page .rd-asset-monster', (e) => e.innerText)));
check('DM: the magic item appears in its section with rarity', (await where('Bell Clapper')) === 'Drowned ones' && /Rarity/i.test(await page.$eval('#rd-page .rd-asset-item', (e) => e.innerText)));
check('DM: the location illustration appears in its location section', (await where('The Bell Tower')) === 'The drowned village');
check('DM: the handout appears where it is revealed', (await where('The Mayor’s letter')) === 'Mayor Odile' && /Meet me at the tower/.test(await page.$eval('#rd-page .rd-asset-handout', (e) => e.innerText)));
check('DM: DM-only notes and fields are shown to the DM, marked', /Lies about the bell/.test(await page.$eval('#rd-page .rd-asset-npc', (e) => e.innerText)) && /DM only/i.test(await page.$eval('#rd-page .rd-asset-map', (e) => e.innerText)) && /secret door/.test(await page.$eval('#rd-page .rd-asset-map', (e) => e.innerText)));
await sleep(600);
check('Images load in place; a missing picture shows a fallback, not a broken image', await page.$eval('#rd-page .rd-asset-npc .rd-plate', (p) => p.classList.contains('is-loaded')) && await page.$eval('#rd-page .rd-asset-location .rd-plate', (p) => p.classList.contains('is-missing')));
await page.$eval('#rd-page [data-rd-zoom]', (b) => b.click()); await sleep(300);
check('The map opens larger', await page.$('.rd-lightbox img[src]') !== null);
await page.keyboard.press('Escape'); await sleep(150);
check('…and closes with Escape', !(await page.$('.rd-lightbox')));
await page.screenshot({ path: SHOTS + '/reader-assets-dm.png', fullPage: true });
check('Unplaced assets go to an Appendix page, not mixed into chapters', /Appendix/.test(await page.$eval('#rd-toc', (e) => e.innerText)));

await page.$eval('[data-rd-mode="players"]', (b) => b.click()); await sleep(300);
await page.$eval('[data-rd-page="1"]', (b) => b.click()); await sleep(800);
const pv = await page.$eval('#rd-page', (e) => e.innerText);
check('Player view: player-visible assets shown in place (NPC, handout, item, location)', /Mayor Odile/.test(pv) && /Meet me at the tower/.test(pv) && /Bell Clapper/.test(pv) && /The Bell Tower/.test(pv));
check('Player view: the unrevealed map and the DM-only monster are not shown', !/Map of Brinemoor/.test(pv) && !/Drowned One\b/.test(pv) && !(await page.$('#rd-page .rd-asset-map, #rd-page .rd-asset-monster')));
check('Player view: no DM notes, secret fields or rules references leak', !/Lies about the bell|She made a deal|secret door|Keep the deal secret|Rules: Zombie|Rarity/i.test(pv));
check('Player view: no Appendix (its only asset is DM-only)', !/Appendix/.test(await page.$eval('#rd-toc', (e) => e.innerText)));
await page.screenshot({ path: SHOTS + '/reader-assets-players.png', fullPage: true });

// print copy: DM view, assets in place, "not in the book" asset left out
await page.$eval('[data-rd-mode="dm"]', (b) => b.click()); await sleep(300);
await page.emulateMediaType('print');
await page.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await sleep(900);
const pr = await page.$eval('#rd-print', (e) => e.innerText);
check('Print: assets printed in their places (map, NPC, monster, handout)', /Map of Brinemoor/.test(pr) && /Mayor Odile/.test(pr) && /Drowned One/.test(pr) && /Meet me at the tower/.test(pr));
check('Print: an asset not marked “In the book” is left out', !/Bell Clapper/.test(pr));
const maxH = await page.$$eval('#rd-print .rd-asset img', (imgs) => Math.max(...imgs.map((i) => i.getBoundingClientRect().height)));
check('Print: asset pictures are limited in size (no page overflow)', maxH > 0 && maxH < 14 * 38, maxH);
const pdf = await page.pdf({ format: 'A4', printBackground: true });
fs.writeFileSync(SHOTS + '/reader-assets.pdf', pdf);
check('Print: Chrome produces a PDF of the book with the assets', pdf.length > 20000 && Buffer.from(pdf).subarray(0, 5).toString() === '%PDF-', pdf.length);
await page.emulateMediaType(null);

console.log(res.map((r) => r[0] + ' ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
const bad = res.filter((r) => r[0] === 'FAIL').length;
console.log('\nFAILS: ' + bad + ' / ' + res.length);
console.log('JS ERRORS:', errors.filter((e) => !/404|Failed to load resource/.test(e)));
await browser.close();
process.exit(bad ? 1 : 0);
