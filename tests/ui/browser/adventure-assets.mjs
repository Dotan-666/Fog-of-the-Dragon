/** Browser test (see lib.mjs for setup): adventure assets in the editor (harness with the in-memory adventure store). */
import { open, BASE, SHOTS } from './lib.mjs';
const { browser, page, errors } = await open({ w: 1366, h: 900 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (name, cond, extra = '') => res.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 300)]);
const H = (hash, q = '') => `${BASE}/tests/ui/characters-harness.html?mock=adventures${q}${hash}`;
const ready = async () => { await page.waitForFunction(() => window.__harnessReady > 0, { timeout: 10000 }); await sleep(500); };
const tap = (sel) => page.$eval(sel, (b) => b.click());
const main = () => page.$eval('#adv-main', (e) => e.innerText);
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('__mock_adventures') || '[]')[0]);

for (const theme of ['', '&theme=light']) {
  await page.goto(H('#adventures', theme), { waitUntil: 'load' }); await ready();
  await page.evaluate(() => localStorage.removeItem('__mock_adventures'));
  const id = await page.evaluate(async () => (await FogAdventureStore.create({ title: 'The Sunken Bell' })).adventure.id);
  await page.goto('about:blank');
  await page.goto(H('#adventures/' + id, theme), { waitUntil: 'load' }); await ready();
  await page.waitForSelector('#adv-outline .adv-ol-assets', { timeout: 8000 });
  const T = theme ? ' (light)' : '';
  check('Outline has an Assets & book entry' + T, /Assets & book/.test(await page.$eval('#adv-outline', (e) => e.innerText)));
  // a chapter with a section, then attach an NPC from the section
  await tap('[data-ed-act="add-chapter"]'); await sleep(300);
  await tap('.adv-add-kinds [data-ed-act="add-section"][data-kind="scene"]'); await sleep(300);
  check('Section shows "Assets used here" with one button per asset type' + T, /Assets used here/.test(await main()) && (await page.$$('.adv-linked-assets [data-ed-act="add-asset"]')).length === 8);
  await tap('.adv-linked-assets [data-ed-act="add-asset"][data-type="npc"]'); await sleep(300);
  check('Attaching from a section opens the new asset, placed in that section' + T, /NPC/.test(await main()) && /Chapter 1 › New scene/.test(await page.$eval('[data-bind="asset.link"]', (s) => s.options[s.selectedIndex].text)));
  await page.$eval('[data-bind="asset.title"]', (e) => { e.value = 'Mayor Odile'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('[data-bind="afield.role"]', (e) => { e.value = 'Mayor of Brinemoor'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('[data-bind="asset.dmNotes"]', (e) => { e.value = 'Made a deal with the sea hag.'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('[data-bind="asset.playerVisible"]', (e) => { e.checked = true; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('Asset page has images (4 max), book and player toggles' + T, /Images \(0 of 4\)/.test(await main()) && await page.$('[data-bind="asset.printable"]') !== null);
  // a magic item with a rules reference
  await tap('[data-ed-sel="assets"]'); await sleep(300);
  check('Assets & book: book settings say plainly that PDF export is not available yet' + T, /not available yet/.test(await main()) && /Coming later/i.test(await main()));
  await tap('.adv-panel > .adv-add-kinds [data-type="item"]'); await sleep(300);
  await page.select('[data-bind="afield.rarity"]', 'Rare'); await sleep(100);
  await page.select('[data-bind="asset.refSource"]', 'srd'); await sleep(100);
  await page.$eval('[data-bind="asset.refName"]', (e) => { e.value = 'Bag of Holding'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await tap('[data-ed-sel="assets"]'); await sleep(300);
  await page.select('[data-bind="book.pageSize"]', 'a4'); await sleep(100);
  const groups = await page.$$eval('.adv-asset-group h3', (h) => h.map((x) => x.innerText));
  check('Assets & book groups assets by type' + T, groups.length === 2 && /NPCs/.test(groups[0]) && /Magic items/.test(groups[1]), groups.join('|'));
  await page.screenshot({ path: SHOTS + '/assets' + (theme ? '-light' : '') + '.png', fullPage: true });
  await sleep(2200); // autosave
  const a = await stored();
  const [npc, item] = a.content.assets;
  check('Saved: the NPC with its fields, link, privacy flags' + T, npc && npc.title === 'Mayor Odile' && npc.fields.role === 'Mayor of Brinemoor' && npc.playerVisible === true && npc.printable === true && npc.link && npc.link.sectionId === a.content.chapters[0].sections[0].id, JSON.stringify(npc));
  check('Saved: the magic item with rarity and an SRD reference' + T, item && item.fields.rarity === 'Rare' && item.ref && item.ref.source === 'srd' && item.ref.name === 'Bag of Holding', JSON.stringify(item));
  check('Saved: book page size' + T, a.content.book.pageSize === 'a4');
  // the section lists the linked asset; deleting the section keeps the asset, unplaced
  await tap(`[data-ed-sel="section"]`); await sleep(300);
  check('The section lists the asset placed in it' + T, /Mayor Odile/.test(await page.$eval('.adv-linked-assets', (e) => e.innerText)));
  page.once('dialog', (d) => d.accept());
  await tap('.adv-panel-tools [data-ed-act="section-delete"]'); await sleep(2200);
  const b = await stored();
  check('Deleting the section keeps the asset but removes its section link' + T, b.content.assets.length === 2 && b.content.assets[0].link && b.content.assets[0].link.sectionId === null);
}
console.log(res.map((r) => r[0] + ' ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
const bad = res.filter((r) => r[0] === 'FAIL').length;
console.log('\nFAILS: ' + bad + ' / ' + res.length);
console.log('JS ERRORS:', errors.filter((e) => !/404|Failed to load resource/.test(e)));
await browser.close();
process.exit(bad ? 1 : 0);
