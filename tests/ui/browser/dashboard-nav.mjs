/** Browser test (see lib.mjs for setup): contextual Back in the Dashboard (real router.js + fog-nav.js on tests/ui/nav-harness.html):
 * a page's own Back button follows where you came from, a detail page gets the shared Back bar, browser Back/Forward work,
 * scroll comes back, and a direct link falls back to the parent section. */
import { open, BASE } from './lib.mjs';
const { browser, page, errors } = await open({ w: 1200, h: 800 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (name, cond, extra = '') => res.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 300)]);
const hash = () => page.evaluate(() => decodeURIComponent(location.hash));
const barText = () => page.$eval('.dash-back', (e) => (e.hidden ? '' : e.innerText)).catch(() => '');
const H = BASE + '/tests/ui/nav-harness.html';

await page.goto(H + '#campaigns', { waitUntil: 'load' }); await sleep(600);
check('Top-level page: no Back bar', !(await barText()));
await page.evaluate(() => window.scrollTo(0, 900)); await sleep(200);
await page.$eval('#to-adv', (a) => a.click()); await sleep(700); // (a DOM click: puppeteer's own click would scroll first)
check('Detail opened from Campaigns carries the origin in the address', (await hash()) === '#adventures/a1?from=campaigns&label=your campaigns', await hash());
check('The page’s own Back button now says “Back to your campaigns” (no second bar)', /Back to your campaigns/.test(await page.$eval('.btn-back', (b) => b.innerText)) && !(await barText()));
await page.click('.btn-back'); await sleep(900);
check('Back returns to Campaigns (not the static “Adventures”)', (await hash()) === '#campaigns', await hash());
check('… at the same scroll position', Math.abs((await page.evaluate(() => window.scrollY)) - 900) < 60, await page.evaluate(() => window.scrollY));
await page.goForward(); await sleep(900);
check('Browser Forward returns to the adventure with its contextual Back', /^#adventures\/a1\?from=campaigns/.test(await hash()) && /Back to your campaigns/.test(await page.$eval('.btn-back', (b) => b.innerText)), await hash());
await page.click('#to-monster'); await sleep(800);
check('Monster details from the adventure: shared bar “← Back to The Keep”', /^#bestiary-spells\/monster\/goblin\?from=adventures\/a1/.test(await hash()) && /Back to The Keep/.test(await barText()) && /Detail: monster goblin/.test(await page.$eval('#detail', (e) => e.innerText)), await hash() + ' | ' + await barText());
await page.click('.dash-back [data-fog-back]'); await sleep(800);
check('Back returns to the exact adventure', /^#adventures\/a1/.test(await hash()) && /Adventure a1/.test(await page.$eval('h1', (e) => e.innerText)), await hash());
await page.goBack(); await sleep(800);
check('Browser Back works through the same history (Back used history.back, so no A→B→A loop)', (await hash()) === '#campaigns', await hash());

const p2 = await browser.newPage();
await p2.goto(H + '#bestiary-spells/monster/goblin', { waitUntil: 'load' }); await sleep(700);
const bar2 = await p2.$eval('.dash-back', (e) => (e.hidden ? '' : e.innerText)).catch(() => '');
check('Direct link / bookmark: fallback “← Back to Monsters & Spells”', /Back to Monsters & Spells/.test(bar2), bar2);
await p2.click('.dash-back [data-fog-back]'); await sleep(700);
check('Fallback Back goes to the list, not to the Dashboard home', (await p2.evaluate(() => location.hash)) === '#bestiary-spells');
await p2.goto(H + '#adventures/a1', { waitUntil: 'load' }); await sleep(700);
check('Without an origin the page keeps its own static Back (“Adventures”)', /Adventures/.test(await p2.$eval('.btn-back', (b) => b.innerText)) && (await p2.$eval('.btn-back', (b) => b.getAttribute('href'))) === '#adventures');

const bad = errors.filter((e) => !/favicon|Failed to load resource/.test(e));
check('No page errors', !bad.length, bad.join(' | '));
for (const r of res) console.log(r[0], r[1], r[2]);
const fails = res.filter((r) => r[0] === 'FAIL').length;
console.log('FAILS:', fails, '/', res.length);
await browser.close();
process.exit(fails ? 1 : 0);
