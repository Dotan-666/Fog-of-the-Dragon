/** Browser test (see lib.mjs for setup). Prints PASS/FAIL lines and a summary; exits non-zero on any failure. */
import { open, go, A, SHOTS } from './lib.mjs';
const SP = SHOTS;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { browser, page, errors } = await open({ w: 390, h: 800 });
const res = [];
const over = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const q = (as, extra = '') => `as=${as}&c=${A}${extra}`;
// seed some state: a running combat and a scheduling request
await go(page, q('dm', '&reset=1'), 'combat');
await page.waitForSelector('[data-cb="new"]', { timeout: 10000 }); await page.click('[data-cb="new"]'); await sleep(300); await page.click('[data-cb="addparty"]'); await sleep(300);
for (let i = 0; i < 2; i++) {
  await page.evaluate(i => { const e = document.querySelectorAll('[data-cb="init"]')[i]; e.value = 15 - i; e.dispatchEvent(new Event('change', { bubbles: true })); }, i);
  await sleep(300);
} await page.click('[data-cb="start"]'); await sleep(500);
await page.screenshot({ path: SP + '/m-combat.png' });
res.push(['combat banner height', await page.$eval('.cw-turnbar', e => Math.round(e.getBoundingClientRect().height)), 'overflow', await over()]);
await page.evaluate(async () => {
  const d = n => new Date(Date.now() + n * 86400000).toISOString();
  await FogCampaignData.createSchedule(FogCampaign.id, { title: 'Session 5', format: 'either', slots: [{ id: 's1', start: d(5), end: d(5.2) }, { id: 's2', start: d(6), end: d(6.2) }] }, true);
});
await go(page, q('p1'), 'meetings');
await page.click('[data-mt-tab="scheduling"]'); await sleep(600);
await page.screenshot({ path: SP + '/m-sched.png', fullPage: true });
res.push(['scheduler overflow', await over()]);
for (const s of ['memories', 'memories/book', 'music', 'bestiary', 'content', 'settings', 'members', 'characters', 'feed', 'overview']) {
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), s); await sleep(500);
  res.push([s, 'overflow', await over()]);
}
await go(page, q('dm'), 'music'); await sleep(800); await page.screenshot({ path: SP + '/m-music.png', fullPage: true });
console.log(res.map(r => r.join(' ')).join('\n'));
console.log('bad:', res.filter(r => r[r.length - 1] > 1).length);
console.log('errors', errors.filter(e => !/404|Failed to load/.test(e)));
await browser.close();
