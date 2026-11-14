/** Browser test (see lib.mjs for setup): advanced Foggy listening on the campaign harness — never on without the DM, a
 * visible indicator with an immediate Stop in every section, microphone denial, no duplicate music triggers, DM override.
 * The microphone is a stand-in (window.FogVoiceRecorderFactory) and the server is window.FogFoggyBackend. */
import { open, go, A, SHOTS, text } from './lib.mjs';
const { browser, page, errors } = await open({ w: 1366, h: 900 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (name, cond, extra = '') => res.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 300)]);
const run = async (name, fn) => { try { await fn(); } catch (e) { check(name + ' (crashed)', false, e.stack || e.message); } };
const q = (as, extra = '') => `as=${as}&c=${A}${extra}`;

await page.evaluateOnNewDocument(() => {
  window.__mic = { starts: 0, stops: 0, deny: /mic=deny/.test(location.search) };
  window.FogVoiceRecorderFactory = (o) => ({
    start: async () => { window.__mic.starts++; if (window.__mic.deny) { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; } window.__mic.onChunk = o.onChunk; },
    stop: () => { window.__mic.stops++; window.__mic.onChunk = null; },
  });
  window.__heard = [];
});

async function openListen(extra = '') {
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons&foggyaccess=plus' + extra), 'foggy');
  await page.waitForSelector('[data-fg-tab="listen"]', { timeout: 15000 });
  await page.evaluate(() => {
    // the campaign's adventure carries a saved music plan
    const store = window.FogAdventureStore;
    if (!store.__patched) {
      const get = store.get;
      store.get = async (id) => { const r = await get(id); if (r.ok) r.adventure.content.musicCues = [
        { id: 'fight', moment: 'Combat begins', when: 'change', ref: 'rec:battle-theme-a', keywords: ['attack'], chapterId: '', sectionId: '', note: '' },
        { id: 'boss', moment: 'The dragon wakes', when: 'change', ref: 'rec:battle-theme-a', keywords: ['dragon'], chapterId: '', sectionId: '', note: '' },
      ]; return r; };
      store.__patched = true;
    }
    window.__played = [];
    const P = window.FogMusicPlayer;
    P.play = (ref) => { window.__played.push(ref); return Promise.resolve(true); };
    P.stop = () => { window.__played.push('stop'); };
  });
  await page.$eval('[data-fg-tab="listen"]', (b) => b.click());
  await page.waitForSelector('.fs-listen', { timeout: 8000 }); await sleep(800);
}

await run('consent', async () => {
  await go(page, q('dm', '&reset=1&dmplan=fogger-of-the-dragons'), 'overview');
  check('Entering the campaign never opens the microphone', (await page.evaluate(() => window.__mic.starts)) === 0 && !(await page.$('.fv-bar:not([hidden])')));
  await openListen();
  const t = await text(page, '.fs-listen');
  check('Listen explains privacy (nothing recorded or stored) and how repeats are avoided', /Nothing is recorded or stored/.test(t) && /not repeated within two minutes/.test(t));
  check('Still off until the DM presses Start listening', (await page.evaluate(() => window.__mic.starts)) === 0 && !!(await page.$('[data-fs="lstart"]')));
});

await run('denied', async () => {
  await openListen('&mic=deny');
  await page.$eval('[data-fs="lstart"]', (b) => b.click()); await sleep(500);
  check('Microphone denied: a clear message, not listening, no indicator', /permission was denied/.test(await text(page, '.fs-listen')) && (await page.evaluate(() => FogVoiceDirector.state().status)) === 'off' && !(await page.$('.fv-bar:not([hidden])')));
});

await run('listening', async () => {
  await openListen();
  await page.$eval('[data-fs="lstart"]', (b) => b.click()); await sleep(400);
  check('Listening: the red indicator with Stop is on screen', /Foggy is listening/.test(await text(page, '.fv-bar')) && !!(await page.$('.fv-bar [data-fv="stop"]')));
  const feed = async (say) => { await page.evaluate((say) => { window.__say = say; return window.__mic.onChunk && window.__mic.onChunk('UklGR' + 'A'.repeat(300)); }, say); await sleep(300); };
  await feed({ cueId: 'fight', confidence: 0.92, transcript: 'The goblins suddenly attack!' });
  check('“The goblins attack!” → the combat cue plays once (from the existing music player)', (await page.evaluate(() => window.__played)).join() === 'rec:battle-theme-a');
  check('Only the cue sheet is sent with the audio (2 cues)', (await page.evaluate(() => window.__heard)).join() === '2');
  await feed({ cueId: 'fight', confidence: 0.95, transcript: 'They attack again' });
  await feed({ cueId: 'boss', confidence: 0.9, transcript: 'A dragon raises its head' });
  await feed({ cueId: 'boss', confidence: 0.3, transcript: 'maybe a dragon?' });
  check('No duplicates: the same cue again, a change seconds later, and an unsure match are all ignored', (await page.evaluate(() => window.__played)).length === 1, await page.evaluate(() => JSON.stringify(window.__played)));
  await page.$eval('.fv-bar [data-fv="pause"]', (b) => b.click()); await sleep(200);
  check('Pause automatic music: listening stays on, nothing plays', /automatic music paused/.test(await text(page, '.fv-bar')));
  await page.$eval('[data-fg-tab="listen"]', (b) => b.click()); await sleep(200);
  await page.evaluate(() => { const d = document.querySelector('.fs-listen details'); if (d) d.open = true; });
  await page.$eval('[data-fs="lcue"][data-id="boss"]', (b) => b.click()); await sleep(200);
  check('The DM can play a cue by hand at any time', (await page.evaluate(() => window.__played)).length === 2);
  await page.evaluate(() => { location.hash = '#combat'; }); await sleep(1500);
  check('The indicator stays while moving to another section (listening continues until stopped)', /Foggy is listening/.test(await text(page, '.fv-bar')) && (await page.evaluate(() => FogVoiceDirector.state().status)) === 'listening');
  await page.screenshot({ path: SHOTS + '/foggy-listening.png' });
  await page.$eval('.fv-bar [data-fv="stop"]', (b) => b.click()); await sleep(300);
  check('Stop listening: microphone released at once, indicator gone', (await page.evaluate(() => window.__mic.stops)) === 1 && (await page.evaluate(() => FogVoiceDirector.state().status)) === 'off' && !(await page.$('.fv-bar:not([hidden])')));
});

await run('player', async () => {
  await go(page, q('p1'), 'overview');
  const nav = await page.$$eval('#cw-nav .fod-nav-label', (l) => l.map((x) => x.innerText));
  check('Players have no Foggy section, so no listening', !nav.includes('Foggy'));
});

console.log(res.map((r) => r[0] + ' ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
const bad = res.filter((r) => r[0] === 'FAIL').length;
console.log('\nFAILS: ' + bad + ' / ' + res.length);
console.log('JS ERRORS:', errors.filter((e) => !/404|Failed to load resource/.test(e)));
await browser.close();
process.exit(bad ? 1 : 0);
