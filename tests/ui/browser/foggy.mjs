/** Browser test (see lib.mjs for setup): Foggy on the Dashboard (characters harness) and Campaign Foggy (campaign harness). */
import { open, go, A, BASE, SHOTS, text } from './lib.mjs';
const { browser, page, errors } = await open({ w: 1366, h: 900 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (name, cond, extra = '') => res.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 300)]);
const outbound = [];
page.on('request', (r) => { if (/generativelanguage|gemini|\/functions\/v1\/foggy/i.test(r.url())) outbound.push(r.url()); });

// A stand-in for the account (plan) and for the database: foggy_access follows migration 20261116120000_foggy.sql
// (generation off), and foggy_content holds one test draft so saving into an adventure can be exercised.
await page.evaluateOnNewDocument(() => {
  if (!/characters-harness/.test(location.pathname)) return;
  const plan = () => localStorage.getItem('__plan') || 'warlord';
  window.FogAccount = { getPlan: () => ({ id: plan() }) };
  const drafts = () => JSON.parse(localStorage.getItem('__drafts') || '[]');
  const chain = (rows) => { const q = { _rows: rows, select() { return q; }, neq() { return q; }, order() { return q; }, limit() { return q; }, eq(k, v) { q._rows = q._rows.filter((r) => k !== 'scope' || r.scope === v); return q; }, then(ok) { return Promise.resolve({ data: q._rows, error: null }).then(ok); } }; return q; };
  window.FogSupabase = { client: {
    rpc: async (fn) => {
      if (fn !== 'foggy_access') return { data: null, error: { message: 'unknown' } };
      const p = plan(); const tier = p === 'dungeon-master' ? 'foggie' : p === 'fogger-of-the-dragons' ? 'foggie_plus' : null;
      const on = !!localStorage.getItem('__fon');
      return { data: { plan: p, tier, enabled: on, dashboard: !!tier, campaign: false, canGenerate: on && !!tier }, error: null };
    },
    from: () => ({
      select: () => chain(drafts()),
      delete: () => ({ eq: (k, id) => ({ select: async () => { localStorage.setItem('__drafts', JSON.stringify(drafts().filter((d) => d.id !== id))); return { data: [{ id }], error: null }; } }) }),
      update: (v) => ({ eq: async (k, id) => { localStorage.setItem('__drafts', JSON.stringify(drafts().map((d) => (d.id === id ? Object.assign(d, v) : d)))); return { error: null }; } }),
    }),
    functions: { invoke: async (fn, o) => {
      window.__invoked = true;
      const mode = localStorage.getItem('__fon');
      if (mode === 'nokey') return { data: null, error: { context: { json: async () => ({ error: 'Foggy has no AI key on the server yet. Nothing was generated.', code: 'not_configured' }) } } };
      if (mode !== 'on' || fn !== 'foggy-generate') return { data: null, error: { message: 'should not be called' } };
      await new Promise((r) => setTimeout(r, 400));
      const row = { id: 'g' + Date.now(), scope: 'dashboard', campaign_id: null, kind: o.body.kind, title: 'Keeper Ilse Varn', body: { summary: 'She keeps the light. And a secret.', dmNotes: 'She signals the smugglers.', fields: { role: 'Lighthouse keeper', voice: 'Whispers' } }, prompt: o.body.prompt, status: 'draft', saved_to: null, created_at: new Date().toISOString() };
      localStorage.setItem('__drafts', JSON.stringify([row].concat(drafts())));
      window.__lastInvoke = o.body;
      return { data: { generated: true, draft: row, remainingToday: 3 }, error: null };
    } },
  } };
});

const H = (q = '') => `${BASE}/tests/ui/characters-harness.html?mock=adventures${q}#foggy`;
const openFoggy = async (plan, q = '') => {
  await page.goto(H(q), { waitUntil: 'load' });
  await page.evaluate((p) => { localStorage.setItem('__plan', p); }, plan);
  await page.goto('about:blank'); await page.goto(H(q), { waitUntil: 'load' });
  await page.waitForSelector('.fg-status:not(:has(.fg-spin))', { timeout: 8000 }); await sleep(600);
  await page.$eval('[data-fg-tab="make"]', (b) => b.click()); await sleep(200); // the quick-draft composer is the Make tab
};

await openFoggy('warlord');
let st = await text(page, '#fg-status');
check('Dashboard Foggy (Free): says it is part of the paid plans, with a way to the plans', /part of the Dungeon Master plan/.test(st) && /Fogger of the Dragons/.test(st) && !!(await page.$('[data-fg="plans"]')), st);
check('Dashboard Foggy (Free): composer disabled', await page.$eval('#fg-send', (b) => b.disabled) && await page.$eval('#fg-form textarea', (t) => t.disabled));

await openFoggy('dungeon-master');
st = await text(page, '#fg-status');
check('Dashboard Foggy (Dungeon Master): Foggie, included but not switched on yet', /isn’t switched on yet/.test(st) && /Foggie/.test(await text(page, '#fg-tier')) && /Campaign Writing Helper/.test(await text(page, '#fg-tier')));
check('Dashboard Foggy: chat structure — intro, suggestions, composer with kind, tone, level and target', !!(await page.$('.fg-thread .fg-msg.is-foggy')) && (await page.$$('[data-fg-suggest]')).length === 4 && !!(await page.$('#fg-form [name=kind]')) && !!(await page.$('#fg-form [name=tone]')) && !!(await page.$('#fg-target')));
check('Dashboard Foggy: Ask button disabled while off, and it says why', await page.$eval('#fg-send', (b) => b.disabled) && /Not switched on yet/.test(await text(page, '#fg-hint')));
await page.$eval('[data-fg-suggest]', (b) => b.click()); await sleep(150);
check('Dashboard Foggy: a suggestion fills the composer', (await page.$eval('#fg-form textarea', (t) => t.value)).length > 10);
await page.$eval('#fg-form', (f) => f.requestSubmit ? (f.querySelector('#fg-send').disabled = false, f.requestSubmit()) : f.submit()); await sleep(500);
check('Dashboard Foggy: even forced, a request is answered "not switched on" and nothing is sent anywhere', /isn’t switched on yet/.test(await text(page, '.fg-thread')) && (await page.evaluate(() => window.__invoked)) !== true && outbound.length === 0, outbound.join(','));
check('Dashboard Foggy: empty drafts state', /No drafts yet/.test(await text(page, '#fg-drafts')));
check('Dashboard Foggy: plan list marks your plan', /your plan/i.test(await page.$eval('.fg-tiers li.is-you', (e) => getComputedStyle(e.querySelector('strong'), '::after').content)));

// a draft in the library (as the server would write it) can be saved into an adventure as an asset
const advId = await page.evaluate(async () => {
  localStorage.removeItem('__mock_adventures');
  const id = (await FogAdventureStore.create({ title: 'The Sunken Bell' })).adventure.id;
  localStorage.setItem('__drafts', JSON.stringify([{ id: 'd1', scope: 'dashboard', campaign_id: null, kind: 'npc', title: 'Mayor Odile', body: { summary: 'The mayor of Brinemoor.', dmNotes: 'A deal with the hag.', fields: { role: 'Mayor' } }, status: 'draft', created_at: new Date().toISOString() }]));
  return id;
});
await openFoggy('fogger-of-the-dragons');
check('Dashboard Foggy (Fogger): Foggie+', /Foggie\+/.test(await text(page, '#fg-tier')) && /Advanced AI Assistant/.test(await text(page, '#fg-tier')));
await page.waitForSelector('.fg-draft [data-fg="save"]', { timeout: 5000 }).catch(() => {});
check('Dashboard Foggy: the draft is listed with "Save as asset" and the adventure choice', /Mayor Odile/.test(await text(page, '#fg-drafts')) && !!(await page.$(`[data-fg-adv="d1"] option[value="${advId}"]`)));
await page.$eval('.fg-draft [data-fg="save"]', (b) => b.click()); await sleep(800);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('__mock_adventures'))[0].content.assets[0]);
check('Dashboard Foggy: saved into the adventure as an NPC asset marked "from Foggy"', saved && saved.title === 'Mayor Odile' && saved.origin === 'foggy' && saved.fields.role === 'Mayor', JSON.stringify(saved));
check('Dashboard Foggy: the draft shows Saved', /Saved/.test(await text(page, '#fg-drafts')));

// ---- switched on: a draft is written by the server function and shown in the conversation ----
await page.evaluate(() => localStorage.setItem('__fon', 'on'));
await openFoggy('fogger-of-the-dragons');
check('Dashboard Foggy (on): ready, and the Ask button works', /is ready/.test(await text(page, '#fg-status')) && !(await page.$eval('#fg-send', (b) => b.disabled)));
await page.select('#fg-target', 'adv:' + advId);
await page.select('#fg-form [name=kind]', 'location'); // a quick draft (NPCs, monsters, spells and items become homebrew: foggy-studio.mjs)
await page.type('#fg-form textarea', 'A lighthouse keeper who knows more than she says');
await page.click('#fg-send'); await sleep(150);
check('Dashboard Foggy (on): while writing, a "Writing…" state and the button is disabled', /Writing your draft/.test(await text(page, '.fg-thread')) && await page.$eval('#fg-send', (b) => b.disabled));
await page.waitForSelector('.fg-result', { timeout: 5000 }).catch(() => {});
await sleep(500);
check('Dashboard Foggy (on): the draft appears in the conversation with its fields and hidden DM notes', /Keeper Ilse Varn/.test(await text(page, '.fg-result')) && /Lighthouse keeper/.test(await text(page, '.fg-result .fg-facts')) && !!(await page.$('.fg-result details.fg-dmnotes:not([open])')));
check('Dashboard Foggy (on): only our server function was asked, with the adventure', (await page.evaluate(() => window.__lastInvoke && window.__lastInvoke.adventureId)) === advId);
const assets = await page.evaluate(() => JSON.parse(localStorage.getItem('__mock_adventures'))[0].content.assets.map((a) => a.title));
check('Dashboard Foggy (on): saved to the chosen adventure’s Assets and listed in the library; remaining count shown', assets.includes('Keeper Ilse Varn') && /added to the adventure/.test(await text(page, '.fg-thread')) && /3 drafts left today/.test(await text(page, '.fg-thread')) && /Keeper Ilse Varn/.test(await text(page, '#fg-drafts')), assets.join('|'));
check('Dashboard Foggy (on): the composer is cleared and ready again', (await page.$eval('#fg-form textarea', (t) => t.value)) === '' && !(await page.$eval('#fg-send', (b) => b.disabled)));
await page.evaluate(() => localStorage.setItem('__fon', 'nokey'));
await openFoggy('fogger-of-the-dragons');
await page.select('#fg-form [name=kind]', 'location');
await page.type('#fg-form textarea', 'A sunken temple'); await page.click('#fg-send'); await sleep(600);
check('Dashboard Foggy (on, no key on the server): explains it, nothing saved', /no AI key on the server/.test(await text(page, '.fg-thread')) && !(await page.$('.fg-thread .fg-result')));
await page.evaluate(() => localStorage.removeItem('__fon'));
await page.screenshot({ path: SHOTS + '/foggy-dark.png', fullPage: true });
await openFoggy('fogger-of-the-dragons', '&theme=light');
await page.screenshot({ path: SHOTS + '/foggy-light.png', fullPage: true });
check('Dashboard Foggy (light): renders', /Foggy/.test(await text(page, '.fg-title')));
await page.evaluate(() => { localStorage.removeItem('__drafts'); localStorage.removeItem('__plan'); });

// ---- Campaign Foggy (campaign harness) ----
const q = (as, extra = '') => `as=${as}&c=${A}${extra}`;
await go(page, q('dm', '&reset=1&dmplan=fogger-of-the-dragons'), 'foggy');
await page.waitForSelector('.fg-status:not(:has(.fg-spin))', { timeout: 8000 }); await sleep(400);
await page.$eval('[data-fg-tab="make"]', (b) => b.click()); await sleep(200);
const navDm = await page.$$eval('#cw-nav .fod-nav-label', (l) => l.map((x) => x.innerText));
check('Campaign Foggy: in the DM’s sidebar (Content)', navDm.includes('Foggy'), navDm.join('|'));
st = await text(page, '#fg-status');
check('Campaign Foggy (Fogger DM): included, not switched on yet; campaign drafts empty', /Campaign Foggy isn’t switched on yet/.test(st) && /No drafts yet/.test(await text(page, '#fg-drafts')) && /The Ashen Crown/.test(await text(page, '.fg-sub')), st);
check('Campaign Foggy: saves only to this campaign or its adventure', (await page.$$eval('#fg-target option', (o) => o.map((x) => x.value))).every((v) => v === 'campaign' || v.startsWith('adv:')));
await go(page, q('dm', '&dmplan=dungeon-master'), 'foggy');
await page.waitForSelector('.fg-status:not(:has(.fg-spin))', { timeout: 8000 }); await sleep(400);
await page.$eval('[data-fg-tab="make"]', (b) => b.click()); await sleep(200);
check('Campaign Foggy (Dungeon Master plan): part of the Fogger plan, composer disabled', /part of the Fogger of the Dragons plan/.test(await text(page, '#fg-status')) && await page.$eval('#fg-send', (b) => b.disabled));
await go(page, q('p1'), 'overview');
const navP = await page.$$eval('#cw-nav .fod-nav-label', (l) => l.map((x) => x.innerText));
check('Campaign Foggy: not in a player’s sidebar', !navP.includes('Foggy'), navP.join('|'));
check('No request to an AI service at any point', outbound.length === 0, outbound.join(','));

console.log(res.map((r) => r[0] + ' ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
const bad = res.filter((r) => r[0] === 'FAIL').length;
console.log('\nFAILS: ' + bad + ' / ' + res.length);
console.log('JS ERRORS:', errors.filter((e) => !/404|Failed to load resource/.test(e)));
await browser.close();
process.exit(bad ? 1 : 0);
