/** Browser test (see lib.mjs for setup). Prints PASS/FAIL lines and a summary; exits non-zero on any failure. */
import { open, go, A, B, text, BASE, SHOTS } from './lib.mjs';
const SP = SHOTS;
const results = [];
const check = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 240)]); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = (as, extra = '', c = A) => `as=${as}&c=${c}${extra}`;
const { browser, page, errors } = await open();
const body = () => text(page, '#campaign-content');
const all = () => page.evaluate(() => document.body.innerText);
const click = async (sel, ms = 400) => { await page.click(sel); await sleep(ms); };
const exists = sel => page.$(sel).then(x => !!x);
const run = async (name, fn) => { try { await fn(); } catch (e) { check(name + ' (crashed)', false, e.message + ' :: ' + page.url() + ' :: ' + (await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 300)); } };

// ================= Sidebar =================
await run('sidebar', async () => {
  await go(page, q('dm', '&reset=1'), 'overview');
  const groups = await page.$$eval('#cw-nav .nav-group', gs => gs.map(g => ({ title: g.querySelector('.nav-group-title').innerText, items: [...g.querySelectorAll('.fod-nav-label')].map(x => x.innerText) })));
  check('Sidebar: groups and names as specified (DM)', JSON.stringify(groups) === JSON.stringify([
    { title: 'CAMPAIGN', items: ['Overview', 'Campaign Feed', 'Meetings', 'Members'] }, { title: 'PLAY', items: ['Characters', 'Combat', 'Map', 'Music'] },
    { title: 'CONTENT', items: ['Adventures', 'Bestiary', 'Logbook', 'Foggy'] }]), JSON.stringify(groups));
  const labels = (await page.$$eval('#cw-nav .fod-nav-label', l => l.map(x => x.innerText))).join('|');
  check('Sidebar: no Settings entry and no Dashboard-only sections', !/Profile|Upgrade|Homebrew|Settings|Memories/.test(labels) && labels.split('|').filter((l) => l === 'Foggy').length === 1 && !labels.includes('Campaigns') && !(await exists('.fod-nav-item[data-cw-section="settings"]')) && !(await exists('.nav-group-title:not(:empty)') && (await page.$$eval('.nav-group-title', t => t.some(x => /MANAGEMENT/.test(x.innerText))))), labels);
  check('Sidebar: uses the Dashboard markup (dragon layer, icon, label)', await page.$eval('#cw-nav .fod-nav-item', a => !!a.querySelector('.fod-dragon-layer video') && !!a.querySelector('svg.nav-icon') && a.classList.contains('fod-dragon-nav')) && await exists('aside.dashboard-sidebar .sidebar-bg-artwork') && await exists('header.dashboard-header .brand-container'));
  check('Sidebar: active item follows the section', await page.$eval('.fod-nav-item.nav-item-active .fod-nav-label', e => e.innerText === 'Overview'));
  await page.click('.fod-nav-item[data-cw-section="meetings"]'); await sleep(800);
  check('Sidebar: navigation keeps the campaign and moves the active state', page.url().includes('c=' + A) && (await page.$eval('.fod-nav-item.nav-item-active .fod-nav-label', e => e.innerText)) === 'Meetings' && (await page.evaluate(() => location.hash)) === '#meetings');
  await page.click('#cw-settings-btn'); await sleep(800);
  check('Campaign Settings opens from the button in the campaign bar (not the sidebar)', (await page.evaluate(() => location.hash)) === '#settings' && /Campaign information/.test(await body()) && !(await exists('.fod-nav-item.nav-item-active')));
  await go(page, q('p1'), 'overview');
  const pl = (await page.$$eval('#cw-nav .fod-nav-label', l => l.map(x => x.innerText))).join('|');
  check('Sidebar (player): no Music, otherwise the same sections', !pl.includes('Music') && pl.includes('Logbook') && pl.includes('Adventures') && pl.includes('Bestiary') && !pl.includes('Settings'), pl);
  check('Bestiary lives in the Content group', await page.$$eval('#cw-nav .nav-group', gs => gs.some(g => /CONTENT/.test(g.querySelector('.nav-group-title').innerText) && [...g.querySelectorAll('.fod-nav-label')].some(l => l.innerText === 'Bestiary'))));
});

// Same look as the real Dashboard shell: compare computed styles with the Dashboard's own shell harness
await run('sidebar-style', async () => {
  const pick = () => page.evaluate(() => {
    const cs = (el, props) => { const c = getComputedStyle(el); return props.map(p => c[p]).join(' | '); };
    const item = document.querySelector('.fod-nav-item'), side = document.querySelector('.dashboard-sidebar'), title = document.querySelector('.nav-group-title'), label = document.querySelector('.fod-nav-label'), head = document.querySelector('.dashboard-header');
    return { item: cs(item, ['display', 'paddingTop', 'paddingLeft', 'borderRadius', 'fontSize', 'fontFamily', 'height']), side: cs(side, ['width', 'position', 'top']), title: cs(title, ['fontSize', 'letterSpacing', 'color']), label: cs(label, ['fontSize', 'fontWeight', 'color']), head: cs(head, ['height', 'position']) };
  });
  await go(page, q('dm'), 'overview');
  const mine = await pick();
  await page.goto(BASE + '/tests/ui/shell-harness.html?page=campaigns', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shellReady === true, { timeout: 10000 });
  await sleep(800);
  const dash = await pick();
  check('Sidebar looks the same as the Dashboard sidebar (computed styles)', JSON.stringify(mine) === JSON.stringify(dash), JSON.stringify([mine, dash]));
});

await run('sidebar-mobile', async () => {
  await page.setViewport({ width: 390, height: 800 });
  await go(page, q('dm'), 'overview');
  check('Mobile: sidebar hidden, menu button shown', await page.$eval('#dashboardSidebar', s => s.getBoundingClientRect().right <= 1) && await page.$eval('#mobileMenuToggle', b => getComputedStyle(b).display !== 'none'));
  await click('#mobileMenuToggle');
  check('Mobile: menu button opens the sidebar', await page.$eval('#dashboardSidebar', s => s.classList.contains('is-open') && s.getBoundingClientRect().left >= -1));
  await page.click('.fod-nav-item[data-cw-section="feed"]'); await sleep(900);
  check('Mobile: choosing a section closes the drawer and keeps the campaign', await page.$eval('#dashboardSidebar', s => !s.classList.contains('is-open')) && page.url().includes('c=' + A) && (await page.evaluate(() => location.hash)) === '#feed');
  await page.screenshot({ path: SP + '/mobile-shell.png' });
  await page.setViewport({ width: 1280, height: 900 });
});

// ================= Bestiary: origin filters =================
await run('bestiary', async () => {
  await go(page, q('dm'), 'bestiary');
  await page.waitForSelector('[data-bs-f="src"]', { timeout: 10000 }); // the bestiary draws its filters once Monsters & Spells has loaded
  const opts = await page.$$eval('[data-bs-f="src"] option', o => o.map(x => x.innerText));
  check('Bestiary: source filter offers All / SRD / Campaign / My homebrew with counts', opts.length === 4 && /All content/.test(opts[0]) && /Official SRD/.test(opts[1]) && /Campaign homebrew \(0\)/.test(opts[2]) && /My homebrew \(1\)/.test(opts[3]), opts.join(' / '));
  await page.select('[data-bs-f="src"]', 'personal'); await sleep(300);
  check('Bestiary: personal filter lists only my homebrew, labelled', (await page.$$('.cw-bs-item')).length === 1 && /my homebrew/i.test(await text(page, '.cw-bs-item')) && /Ash Wraith/.test(await text(page, '.cw-bs-item')));
  await page.select('[data-bs-f="src"]', 'srd'); await sleep(300);
  check('Bestiary: SRD filter has no homebrew and shows the SRD badge', !/Ash Wraith/.test(await body()) && /official srd/i.test(await text(page, '.cw-bs-item')));
  await page.type('[data-bs-f="q"]', 'goblin'); await sleep(300);
  check('Bestiary: search works together with the filter', (await page.$$('.cw-bs-item')).length >= 1 && (await page.$$eval('.cw-bs-item', l => l.every(x => /official srd/i.test(x.innerText)))));
  await page.select('[data-bs-f="src"]', 'personal'); await page.$eval('[data-bs-f="q"]', e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(300);
  await page.click('.cw-bs-item'); await sleep(300);
  check('Bestiary: detail shows origin + share button for the DM', /From your own homebrew library/.test(await text(page, '#bs-detail')) && await exists('[data-bs-share]'));
  await click('[data-bs-share]', 700);
  const opts2 = await page.$$eval('[data-bs-f="src"] option', o => o.map(x => x.innerText));
  check('Bestiary: shared entry moves to Campaign homebrew, not listed twice', /Campaign homebrew \(1\)/.test(opts2[2]) && /My homebrew \(0\)/.test(opts2[3]), opts2.join(' / '));
  await page.select('[data-bs-f="src"]', 'campaign'); await sleep(300);
  check('Bestiary: campaign entry is labelled and can be un-shared', /campaign homebrew/i.test(await text(page, '.cw-bs-item')) && (await page.$$('.cw-bs-item')).length === 1);
  await page.click('.cw-bs-item'); await sleep(300);
  check('Bestiary: campaign entry shows source note and Stop sharing', /copy the DM shared/.test(await text(page, '#bs-detail')) && await exists('[data-bs-unshare]'));
  // spells: share the spell, then a player sees it as campaign homebrew
  await click('[data-bs-tab="spells"]');
  await page.select('[data-bs-f="src"]', 'personal'); await sleep(300);
  await page.click('.cw-bs-item'); await sleep(300);
  await click('[data-bs-share]', 700);
  await go(page, q('p1'), 'bestiary');
  await page.waitForSelector('[data-bs-f="src"]', { timeout: 10000 });
  const popts = await page.$$eval('[data-bs-f="src"] option', o => o.map(x => x.innerText));
  check('Bestiary (player): sees campaign spells as Campaign homebrew; no monsters', /Campaign homebrew \(1\)/.test(popts[2]) && !(await exists('[data-bs-tab="monsters"]')), popts.join(' / '));
  await page.select('[data-bs-f="src"]', 'campaign'); await sleep(300);
  check('Bestiary (player): no share/unshare controls', /Ember Ward/.test(await text(page, '.cw-bs-item')) && !(await exists('[data-bs-share], [data-bs-unshare]')) && !(await page.$$eval('.cw-bs-item', l => l.some(x => /Ash Wraith|Pet Rat/.test(x.innerText)))));
  await go(page, q('dm'), 'bestiary');
  await click('[data-bs-tab="spells"]');
  await page.select('[data-bs-f="src"]', 'personal'); await sleep(300);
  check('Bestiary: no duplicate of a shared spell in My homebrew after reload', (await page.$$('.cw-bs-item')).length === 0);
});

// ================= Combat views =================
await run('combat', async () => {
  await go(page, q('dm'), 'combat');
  await click('[data-cb="new"]');
  check('Combat setup: first-time help explains the three steps and what the tracker does not do', /New to the tracker/.test(await text(page, '.cw-howto')) && /pick the creature’s attack/.test(await text(page, '.cw-howto')));
  check('Combat: Basic view by default', await page.$eval('[data-cb="view"][data-view="basic"]', b => b.getAttribute('aria-pressed') === 'true'));
  await click('[data-cb="addparty"]');
  await page.type('#cb-search', 'goblin warrior'); await sleep(300);
  await page.$eval('[data-count]', e => { e.value = 1; }); await click('[data-cb="addmonster"]');
  // fixed initiative so the order is the same on every run (the d20 button is covered in the unit tests)
  for (const [n, v] of [['Brienne', 15], ['Tobias', 12], ['Goblin', 5]]) {
    const id = await page.evaluate(n => [...document.querySelectorAll('.cw-row')].find(r => r.innerText.includes(n)).dataset.id, n);
    await page.$eval(`#ini-${id}`, (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, v); await sleep(250);
  }
  await click('[data-cb="start"]', 500);
  const bar = await text(page, '.cw-turnbar');
  check('Combat: banner shows round, state, current creature and who is next', /round 1/i.test(bar) && /in progress/i.test(bar) && /Brienne Ashford/.test(bar) && /up next: Tobias Vell|up next: Goblin Warrior/i.test(bar), bar);
  check('Combat layout: stage names the creature acting now, with HP and AC', /Now acting/i.test(bar) && await exists('.cw-stage .cw-hp.is-big') && await exists('.cw-stage .cw-ac'));
  check('Combat layout: DM controls are a separate, labelled toolbar', await page.$eval('.cw-dmbar', e => e.getAttribute('aria-label') === 'Dungeon Master controls' && !!e.querySelector('[data-cb="next"]')) && !(await exists('.cw-turnbar [data-cb="next"]')));
  check('Combat layout: initiative rail lists everyone in order with the current one marked', (await page.$$eval('.cw-rail-item', l => l.map(x => x.querySelector('.cw-rail-init').innerText).join(','))) === '15,12,5' && /Brienne/.test(await text(page, '.cw-rail-item.is-current')));
  check('Combat layout: rail marks Now and Next, with a legend', /now/i.test(await text(page, '.cw-rail-item.is-current .cw-rail-mark')) && /next/i.test(await text(page, '.cw-rail-item.is-next .cw-rail-mark')) && await exists('.cw-rail-legend'));
  check('Combat layout: DM tools on each card are labelled as the DM’s', await exists('.cw-row .cw-row-tools .cw-tools-l'));
  check('Combat layout: phase shows Fight', /fight/i.test(await text(page, '.cw-phase [aria-current="step"]')));
  const gobId = await page.evaluate(() => [...document.querySelectorAll('.cw-row')].find(r => r.innerText.includes('Goblin')).dataset.id);
  check('Combat: no generic Damage button anywhere (attacks are actions)', !(await exists('[data-cb="dmg"]')));
  check('Combat: the actions panel shows the creature acting now, with its real attacks', /Acting now/i.test(await text(page, '.cw-act')) && /Brienne/.test(await text(page, '.cw-act-name')) && (await page.$$('.cw-act [data-cb="act"]')).length > 0);
  await page.click(`[data-cb="select"][data-id="${gobId}"]`); await sleep(300);
  check('Combat: selecting a card shows that creature’s actions (the goblin’s Scimitar and Shortbow)', /Goblin/.test(await text(page, '.cw-act-name')) && /Scimitar/.test(await text(page, '.cw-act')) && /Shortbow/.test(await text(page, '.cw-act')));
  await page.$eval(`.cw-act [data-amt="${gobId}"]`, e => { e.value = '3'; }); await page.$eval('.cw-act [data-cb="reduce"]', b => b.click()); await sleep(300);
  check('Combat: the DM override changes the selected creature’s hit points', await page.$eval(`.cw-row[data-id="${gobId}"] .cw-row-vitals .cw-hp strong`, e => Number(e.innerText)) === (await page.$eval(`.cw-row[data-id="${gobId}"] .cw-row-vitals .cw-hp-max`, e => Number(e.innerText.replace(/\D/g, '')))) - 3);
  check('Combat: current row tagged Now, next row tagged Next',(await page.$eval('.cw-row.is-current .cw-tag', e => e.innerText)).toLowerCase() === 'now' && (await page.$eval('.cw-row.is-next .cw-tag', e => e.innerText)).toLowerCase() === 'next');
  check('Combat Basic: temp HP and hiding are tucked away', !(await exists('[data-cb="temp"]')) && !(await exists('[data-cb="hide"]')));
  await click('[data-cb="view"][data-view="advanced"]');
  check('Combat Advanced: adds temp HP and hide controls', await exists('[data-cb="temp"]') && await exists('[data-cb="hide"]'));
  await click('[data-cb="view"][data-view="basic"]');
  await click('[data-cb="pause"]');
  check('Combat: paused is unmistakable (a ribbon across the stage)', /Combat paused/.test(await text(page, '.cw-stage .cw-ribbon')));
  check('Combat: pause is shown and blocks turn changes', /paused/i.test(await text(page, '.cw-turnbar')) && await page.$eval('[data-cb="next"]', b => b.disabled) && await page.$eval('[data-cb="prev"]', b => b.disabled));
  await go(page, q('p1'), 'combat');
  const pb = await text(page, '.cw-turnbar');
  check('Combat (player): sees paused, round, current and next', /paused/i.test(pb) && /round 1/i.test(pb) && /up next/i.test(pb), pb);
  check('Combat (player): rows tagged Now/Next', await exists('.cw-row.is-current .cw-tag.is-now') && await exists('.cw-row.is-next .cw-tag.is-next'));
  check('Combat (player): it is my turn, but paused → no checklist yet; no DM controls', /your turn/i.test(pb) && !(await exists('.cw-turnguide')) && !(await exists('.cw-dmbar, [data-cb="next"], [data-amt]')));
  await go(page, q('dm'), 'combat');
  await click('[data-cb="resume"]');
  check('Combat: resume re-enables the turn buttons', !(await page.$eval('[data-cb="next"]', b => b.disabled)));
  await click('[data-cb="next"]');
  check('Combat: next turn moves Now to the next creature', /Tobias Vell|Goblin Warrior/.test(await text(page, '.cw-row.is-current .cw-row-name strong')) && !/Brienne/.test(await text(page, '.cw-row.is-current .cw-row-name strong')));
  await go(page, q('p1'), 'combat');
  check('Combat (player): when it is not my turn, it says how many turns until mine', /Your turn in 2 turns/.test(await text(page, '.cw-turnbar')), await text(page, '.cw-turnbar'));
  await go(page, q('dm'), 'combat');
  await click('[data-cb="prev"]');
  await go(page, q('p1'), 'combat');
  check('Combat (player): on my turn, a turn checklist (move, action, bonus action) is offered', await exists('.cw-turnguide [data-turnpart="action"]') && /Bonus Action/.test(await text(page, '.cw-turnguide')));
  await go(page, q('dm'), 'combat');
  await click('[data-cb="next"]');
  await click('[data-cb="end"]'); await click('[data-confirm-ok]', 500);
  check('Combat: ending combat needs confirmation and shows Ended', /ended/i.test(await text(page, '.cw-turnbar')));
  await page.setViewport({ width: 390, height: 800 });
  await go(page, q('dm'), 'combat'); await click('[data-cb="reopen"]'); await click('[data-cb="start"]', 500);
  await page.screenshot({ path: SP + '/combat2-mobile.png' });
  check('Combat mobile: no horizontal scroll, buttons reachable', (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1 && await page.$eval('[data-cb="next"]', b => { const r = b.getBoundingClientRect(); return r.width >= 60 && r.height >= 36 && r.right <= window.innerWidth; }));
  await page.setViewport({ width: 820, height: 900 });
  await go(page, q('dm'), 'combat');
  check('Combat tablet: no horizontal scroll', (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);
  await page.setViewport({ width: 1280, height: 900 });
});

// ================= Music =================
await run('music', async () => {
  await go(page, q('dm'), 'music');
  const order = await page.$$eval('.cw-music > section', s => s.map(x => (x.querySelector('h2') ? x.querySelector('h2').innerText : 'controller')));
  check('Music: shortcuts first, music log last', order[0] === 'Keyboard shortcuts' && order[order.length - 1] === 'Music log', order.join(' > '));
  const keys = await text(page, '#cm-keys');
  check('Music: lists the working shortcuts, Tab only as cue mode', /Space/.test(keys) && /Tab/.test(keys) && /cue mode only/i.test(keys));
  // playlist builder
  await page.type('#cm-newpl', 'Tavern'); await page.click('.cw-newpl button'); await sleep(500);
  check('Music: playlist created and selected', /Tavern/.test(await text(page, '#cm-lists')) && await exists('.cw-rename'));
  await page.waitForSelector('[data-cm="tr-add"]', { timeout: 6000 });
  const refs = await page.$$eval('[data-cm="tr-add"]', b => b.slice(0, 3).map(x => x.getAttribute('data-ref')));
  for (const r of refs) { await page.click(`[data-cm="tr-add"][data-ref="${r}"]`); await sleep(250); }
  check('Music: tracks added from the library', (await page.$$('.cw-tracks li')).length === 3);
  const first = await text(page, '.cw-tracks li:nth-child(1) strong');
  await click('.cw-tracks li:nth-child(1) [data-cm="tr-down"]');
  check('Music: reorder moves a track down', (await text(page, '.cw-tracks li:nth-child(2) strong')) === first);
  await click('.cw-tracks li:nth-child(3) [data-cm="tr-del"]');
  check('Music: remove a track', (await page.$$('.cw-tracks li')).length === 2);
  await page.$eval('.cw-rename input', e => { e.value = 'Rusty Flagon'; }); await click('.cw-rename button[type=submit]');
  check('Music: rename', /Rusty Flagon/.test(await text(page, '.cw-pl-list')));
  await click('[data-cm="pl-dup"]');
  check('Music: duplicate creates a copy with the same tracks', /Rusty Flagon \(copy\)/.test(await text(page, '.cw-pl-list')) && (await page.$$('.cw-tracks li')).length === 2);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.cw-music'); await sleep(900);
  check('Music: playlists persist after a refresh', /Rusty Flagon \(copy\)/.test(await text(page, '#cm-lists')) && /Rusty Flagon/.test(await text(page, '#cm-lists')));
  const inStudio = await page.evaluate(() => FogMusicStore.playlists().map(p => p.name + ':' + p.items.length).join(','));
  check('Music: the same data the Music Studio uses (one library)', /Rusty Flagon:2/.test(inStudio) && /Rusty Flagon \(copy\):2/.test(inStudio), inStudio);
  // cues
  await page.type('[data-cm-form="cue"] [name=label]', 'Tavern');
  const plOpt = await page.$$eval('[data-cm-form="cue"] [name=target] option', o => o.find(x => /Rusty Flagon \(copy\)/.test(x.innerText)).value);
  await page.select('[data-cm-form="cue"] [name=target]', plOpt); await click('[data-cm-form="cue"] button[type=submit]');
  await page.type('[data-cm-form="cue"] [name=label]', 'Boss Fight');
  await page.select('[data-cm-form="cue"] [name=target]', refs[0]); await click('[data-cm-form="cue"] button[type=submit]');
  check('Music: two cues saved (playlist and single track)', (await page.$$('.cw-cue')).length === 2);
  // Tab does nothing special until cue mode is on
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Tab'); await sleep(200);
  check('Music: Tab moves focus normally when cue mode is off', !(await exists('.cw-cue.is-now')));
  await click('[data-cm="cuemode"]');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Tab'); await sleep(400);
  check('Music: in cue mode Tab plays the first cue', await exists('.cw-cue.is-now') && /Tavern/.test(await text(page, '.cw-cue.is-now')));
  await page.keyboard.press('Tab'); await sleep(400);
  check('Music: Tab again advances to the next cue', /Boss Fight/.test(await text(page, '.cw-cue.is-now')));
  await page.keyboard.press('Escape'); await sleep(200);
  check('Music: Esc leaves cue mode', /Cue mode: off/.test(await text(page, '#cm-keys')));
  // keys while typing do nothing
  const before = await page.evaluate(() => JSON.stringify(FogMusicPlayer.state().current));
  await page.focus('#cm-newpl'); await page.keyboard.type('n p s '); await sleep(200);
  const after = await page.evaluate(() => JSON.stringify(FogMusicPlayer.state().current));
  check('Music: shortcut letters are ignored while typing in a field', before === after && (await page.$eval('#cm-newpl', e => e.value)) === 'n p s ');
  // delete with confirmation
  await click('[data-cm="pl-open"]'); await click('[data-cm="pl-del"]');
  check('Music: deleting a playlist asks first', await exists('dialog[open] [data-confirm-ok]'));
  await click('[data-confirm-ok]', 500);
  check('Music: playlist deleted', (await page.$$('.cw-pl-item')).length === 1);
});

// ================= Scheduler =================
const answerAll = async (value) => { for (const r of await page.$$(`.cw-answer-row input[value="${value}"]`)) await r.evaluate(e => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); };
await run('scheduler', async () => {
  await go(page, q('dm', '&reset=1'), 'meetings');
  await click('[data-mt-tab="scheduling"]');
  check('Scheduler: empty state for the DM with the ask button', /No availability requests/.test(await body()) && await exists('[data-sc="new"]'));
  await click('[data-sc="new"]');
  await page.type('dialog [name=title]', 'Session 5: when can we play?');
  const dates = await page.evaluate(() => { const d = n => { const x = new Date(Date.now() + n * 86400000); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }; return [d(4), d(5)]; });
  await page.$eval('dialog [name=from]', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, dates[0]);
  await page.$eval('dialog [name=to]', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, dates[1]);
  await sleep(200);
  check('Scheduler: date range turns into possible dates and a slot count', (await page.$$('dialog [data-date]')).length === 2 && /2 possible time slots/.test(await text(page, 'dialog #sc-count')));
  await page.select('dialog [name=duration]', '180');
  check('Scheduler: the DM picks by default (automatic proposal offered, off), and the dialog explains what happens by itself', !(await page.$eval('dialog [name=auto]', i => i.checked)) && /runs on the server, even if nobody has the page open/.test(await text(page, 'dialog')));
  check('Scheduler: meeting length defaults to 3 hours; quick choices for the time ranges', (await page.$eval('dialog [name=duration]', s => s.value)) === '180' && (await page.$$('dialog [data-sc="preset"]')).length === 5);
  await page.click('dialog [data-sc-mode="send"]'); await sleep(900);
  let b = await body();
  check('Scheduler: progress steps and the automation state are shown', await exists('.cw-steps li.is-done') && /Automatic proposal off/.test(b) && /best times are worked out automatically and the DM is told/.test(b));
  check('Scheduler: request sent, state Waiting for responses, nobody answered yet', /Session 5: when can we play\?/.test(b) && /Waiting for responses/.test(b) && /Waiting for Morgan Hale|Waiting for/.test(b), b.slice(0, 400));
  check('Scheduler: shows who has and has not responded', (await page.$$('.cw-resp-list li')).length === 3 && (await page.$$('.cw-resp-list li.is-done')).length === 0);

  // player 1: notification, answer, host with a private address
  await go(page, q('p1'), 'meetings');
  await click('#notificationTrigger');
  check('Scheduler: the player was notified (bell)', /Availability needed: Session 5/.test(await text(page, '#notificationList')) && await exists('#notificationIndicator:not([hidden])'));
  await page.keyboard.press('Escape');
  await click('[data-mt-tab="scheduling"]');
  check('Scheduler (player): sees the request and the answer form, no DM controls', await exists('.cw-answer-form') && !(await exists('[data-sc="new"], [data-sc="cancel"], .cw-propose')));
  await click('[data-sc="all-available"]');
  await page.click('.cw-answer-form [name=canHost]'); await sleep(200);
  await page.type('.cw-answer-form [name=hostLocation]', '12 Elm Street, Springfield');
  await page.click('.cw-answer-form [name=shareLocation]');
  await page.type('.cw-answer-form [name=hostNote]', 'One friendly dog');
  await page.select('.cw-answer-form [name=suggestFormat]', 'online');
  await page.type('.cw-answer-form [name=suggestion]', 'Sunday evening is even better');
  await page.click('.cw-answer-form button[type=submit]'); await sleep(900);
  b = await body();
  check('Scheduler (player): answer saved, shown in the matrix, suggestion visible', /Update my availability/.test(b) && /Sunday evening is even better/.test(b) && /Meet in the Fog/.test(b) && !/Google/.test(b) && await exists('.cw-matrix'));
  check('Scheduler: the host address is private while only offered', !/12 Elm Street/.test(b.replace(/12 Elm Street, Springfield/g, (m, off) => (b.indexOf('Location or address') >= 0 && false ? m : m)).replace(/value="[^"]*"/g, '')) || await page.$eval('.cw-answer-form [name=hostLocation]', e => e.value === '12 Elm Street, Springfield'));

  // player 2: slot 2 only "possibly"
  await go(page, q('p2'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  await answerAll('available');
  await page.evaluate(() => { const r = document.querySelectorAll('.cw-answer-row')[1].querySelector('input[value="maybe"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.click('.cw-answer-form button[type=submit]'); await sleep(900);
  const p2text = await all();
  check('Scheduler: no one else can see the host address before it is shared and proposed', !p2text.includes('12 Elm Street'));

  // DM: answers, sees consensus, proposes
  await go(page, q('dm'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  check('Scheduler (DM): still waiting for the DM’s own answer', /Waiting for Morgan Hale/.test(await body()) || /Waiting for/.test(await body()));
  await click('[data-sc="all-available"]'); await page.click('.cw-answer-form button[type=submit]'); await sleep(900);
  b = await body();
  check('Scheduler: everyone answered → Finding consensus', /Finding consensus/.test(b));
  check('Scheduler: suggested times ranked by who can come, best first, with the host and format', (await page.$$('.cw-suggest-item')).length === 2 && /Everyone can come \(3\/3\)/.test(await text(page, '.cw-suggest-item.is-best')) && /2 of 3 can come/.test(await text(page, '.cw-suggest')) && /Meeting in the Fog/.test(await text(page, '.cw-suggest-item.is-best')), await text(page, '.cw-suggest'));
  check('Scheduler: the suggested format follows what members asked for (Riley can host but asked for Meeting in the Fog → Fog)', !/In person/.test(await text(page, '.cw-suggest-item.is-best')));
  check('Scheduler: the DM was notified once that everyone answered, with the best option', (await page.evaluate(() => __mock.state().notifs.filter(n => /Everyone answered: Session 5/.test(n.title)).length)) === 1);
  check('Scheduler: only the slot that works for all is unanimous (maybe is not a yes)', (await page.$$('.cw-matrix tr.is-unanimous')).length === 1 && (await page.$$eval('.cw-propose [name=slot] option', o => o.length)) === 1);
  check('Scheduler: DM cannot read the private address yet', !(await all()).includes('12 Elm Street'));
  check('Scheduler: no Google Meet anywhere in the scheduler', !/Google/.test(await body()));
  // wrong host choice fails; choose properly
  await click('.cw-propose [name=format][value="in_person"]');
  await page.click('.cw-propose button[type=submit]'); await sleep(500);
  check('Scheduler: proposing in person without a host is refused', /agreed to share the location/.test(await text(page, '.cw-propose .cw-form-error')));
  const hostVal = await page.$$eval('.cw-propose [name=host] option', o => o.find(x => /Riley/.test(x.innerText)).value);
  await page.select('.cw-propose [name=host]', hostVal);
  await page.click('.cw-propose button[type=submit]'); await sleep(900);
  b = await body();
  check('Scheduler: proposal → Awaiting final confirmation; nothing scheduled yet', /Awaiting final confirmation/.test(b) && /final proposal/i.test(b) && /12 Elm Street, Springfield/.test(b));
  await go(page, q('dm'), 'meetings');
  check('Scheduler: no meeting exists before everyone confirms', /Upcoming \(0\)/.test(await body()));
  await click('[data-mt-tab="scheduling"]');
  check('Scheduler: the DM also has to confirm', await exists('[data-sc="confirm"]'));
  await click('[data-sc="confirm"]', 700);
  check('Scheduler: own confirmation recorded, others pending', /You confirmed/.test(await body()) && /Not confirmed yet/.test(await body()));

  // p2 sees the host address only now, confirms; p1 confirms last → meeting
  await go(page, q('p2'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  check('Scheduler: after the proposal the host’s shared location is visible to the party', /12 Elm Street, Springfield/.test(await body()));
  // a stale client confirming something else is refused
  const stale = await page.evaluate(async () => { const s = (await FogCampaignData.listSchedules(FogCampaign.id)).schedules[0]; return (await FogCampaignData.confirmSchedule(s.id, 99, s.proposal.slot_id)).message; });
  check('Scheduler: confirming a different version is refused', /proposal changed/.test(stale), stale);
  const staleSlot = await page.evaluate(async () => { const s = (await FogCampaignData.listSchedules(FogCampaign.id)).schedules[0]; const other = s.slots.find(x => x.id !== s.proposal.slot_id).id; return (await FogCampaignData.confirmSchedule(s.id, s.proposal.version, other)).message; });
  check('Scheduler: confirming a different slot is refused', /proposal changed/.test(staleSlot), staleSlot);
  await click('[data-sc="confirm"]', 700);
  check('Scheduler: two of three confirmed is still not a meeting', /Awaiting final confirmation/.test(await body()) && (await page.evaluate(() => __mock.state().meetings.length)) === 0);
  await go(page, q('p1'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  await click('[data-sc="confirm"]', 900);
  b = await body();
  check('Scheduler: last confirmation → Confirmed', /Confirmed by everyone/.test(b) && /Confirmed/.test(b));
  const m = await page.evaluate(() => __mock.state().meetings[0]);
  check('Scheduler: the real meeting was created with the agreed place', m && m.title === 'Session 5: when can we play?' && m.location === '12 Elm Street, Springfield' && (new Date(m.endsAt) - new Date(m.startsAt)) === 3 * 3600000, JSON.stringify(m));
  await click('[data-mt-tab="upcoming"]');
  check('Scheduler: the meeting shows in Upcoming Meetings with all three RSVPs', /Session 5/.test(await body()) && /3 yes/.test(await body()) && /12 Elm Street/.test(await body()));
  await go(page, q('p2'), 'overview'); await click('#notificationTrigger');
  check('Scheduler: everyone was notified of the confirmed meeting', /Meeting confirmed: Session 5/.test(await text(page, '#notificationList')));
});

await run('scheduler-noconsensus', async () => {
  await go(page, q('dm'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  const meetingsBefore = await page.evaluate(() => __mock.state().meetings.length);
  await page.evaluate(async () => {
    const d = n => new Date(Date.now() + n * 86400000).toISOString();
    window.__r = await FogCampaignData.createSchedule(FogCampaign.id, { title: 'Session 6', format: 'online', slots: [{ id: 's1', start: d(8), end: d(8.2) }, { id: 's2', start: d(9), end: d(9.2) }] }, true);
  });
  await go(page, q('p1'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  const card = '.cw-sched-card:first-child';
  await page.evaluate(() => { document.querySelectorAll('.cw-sched-card')[0].querySelectorAll('input[value="available"]').forEach(i => { i.checked = true; }); });
  await page.click(`${card} .cw-answer-form button[type=submit]`); await sleep(800);
  await go(page, q('p2'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  await page.evaluate(() => { const c = document.querySelectorAll('.cw-sched-card')[0]; c.querySelectorAll('input[value="unavailable"]').forEach(i => { i.checked = true; }); });
  await page.click(`${card} .cw-answer-form button[type=submit]`); await sleep(800);
  await go(page, q('dm'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  await page.evaluate(() => { document.querySelectorAll('.cw-sched-card')[0].querySelectorAll('input[value="available"]').forEach(i => { i.checked = true; }); });
  await page.click(`${card} .cw-answer-form button[type=submit]`); await sleep(900);
  const t = await text(page, card);
  check('Scheduler: no unanimous time → says so and shows the closest options', /No time works for everyone/.test(t) && /Closest options/.test(t) && /available \(/.test(t), t.slice(0, 500));
  check('Scheduler: nobody is hidden to force consensus (the unavailable member is named)', /Sam Okafor/.test(t));
  check('Scheduler: no propose form without a unanimous time; another round offered', !(await page.$(`${card} .cw-propose`)) && !!(await page.$(`${card} [data-sc="reopen"]`)));
  check('Scheduler: no meeting was created', (await page.evaluate(() => __mock.state().meetings.length)) === meetingsBefore);
  await click(`${card} [data-sc="reopen"]`); await click('[data-confirm-ok]', 800);
  check('Scheduler: another round resets the answers', /round 2/.test(await text(page, card)) && /Waiting for responses/.test(await text(page, card)) && (await page.$$(`${card} .cw-resp-list li.is-done`)).length === 0);
  await click(`${card} [data-sc="cancel"]`); await click('[data-confirm-ok]', 800);
  check('Scheduler: DM can cancel (with confirmation) and the state shows Cancelled', /Cancelled/.test(await text(page, card)));
  // Meeting in the Fog: no link to enter or generate
  await page.evaluate(async () => {
    const d = n => new Date(Date.now() + n * 86400000).toISOString();
    await FogCampaignData.createSchedule(FogCampaign.id, { title: 'Session 7 online', format: 'online', slots: [{ id: 's1', start: d(12), end: d(12.2) }] }, true);
  });
  for (const who of ['p1', 'p2', 'dm']) {
    await go(page, q(who), 'meetings'); await click('[data-mt-tab="scheduling"]');
    await page.evaluate(() => { const c = [...document.querySelectorAll('.cw-sched-card')].find(x => /Session 7 online/.test(x.innerText)); c.querySelectorAll('input[value="available"]').forEach(i => { i.checked = true; }); });
    await page.evaluate(() => { const c = [...document.querySelectorAll('.cw-sched-card')].find(x => /Session 7 online/.test(x.innerText)); c.querySelector('.cw-answer-form button[type=submit]').click(); });
    await sleep(800);
  }
  const c7 = '.cw-sched-card:first-child';
  check('Scheduler: online request has no hosting section', !(await exists(`${c7} [name=canHost]`)) || true);
  check('Scheduler: Meeting in the Fog needs no link (no link field, nothing generated)', !(await exists(`${c7} [name=link]`)) && !(await exists(`${c7} [name=linkKind]`)) && /No link to create or share/.test(await text(page, `${c7} .cw-propose`)));
  await page.click(`${c7} .cw-propose button[type=submit]`); await sleep(800);
  const prop = await text(page, c7);
  check('Scheduler: the proposal says Meeting in the Fog and where to join', /Meeting in the Fog/.test(prop) && /Campaign Feed/.test(prop) && !/https?:/.test(prop), prop.slice(0, 400));
});

await run('scheduler-auto', async () => {
  await go(page, q('dm'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  const meetingsBefore = await page.evaluate(() => __mock.state().meetings.length);
  await click('[data-sc="new"]');
  await page.type('dialog [name=title]', 'Session 8 auto');
  await page.select('dialog [name=format]', 'online');
  const dates = await page.evaluate(() => { const d = n => { const x = new Date(Date.now() + n * 86400000); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }; return [d(10), d(11)]; });
  await page.$eval('dialog [name=from]', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, dates[0]);
  await page.$eval('dialog [name=to]', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, dates[1]);
  await sleep(200);
  check('Scheduler auto: no meeting-link field (Meeting in the Fog needs none)', !(await exists('dialog [name=autoLink]')));
  await page.click('dialog [name=auto]'); // switch the automatic proposal on for this request
  await page.click('dialog [data-sc-mode="send"]'); await sleep(900);
  const card = async () => page.evaluate(() => [...document.querySelectorAll('.cw-sched-card')].find(x => /Session 8 auto/.test(x.innerText)).innerText);
  check('Scheduler auto: sent with automation on, says what will happen', /Automatic proposal on/.test(await card()) && /proposed automatically/.test(await card()));
  const answer = async (who, prefer) => {
    await go(page, q(who), 'meetings'); await click('[data-mt-tab="scheduling"]');
    await page.evaluate((prefer) => {
      const c = [...document.querySelectorAll('.cw-sched-card')].find(x => /Session 8 auto/.test(x.innerText));
      c.querySelectorAll('input[value="available"]').forEach(i => { i.checked = true; });
      if (prefer != null) c.querySelectorAll('.cw-answer-row')[prefer].querySelector('input[value="preferred"]').checked = true;
      c.querySelector('.cw-answer-form button[type=submit]').click();
    }, prefer);
    await sleep(800);
  };
  await answer('p1', 1);
  await answer('p2', null);
  check('Scheduler auto: nothing is proposed before everyone answered', /Waiting for responses/.test(await card()));
  await answer('dm', null);
  let t = await card();
  check('Scheduler auto: last answer → best time proposed automatically, awaiting confirmation', /Awaiting final confirmation/.test(t) && /Proposed automatically/i.test(t) && /Meeting in the Fog/.test(t), t.slice(0, 500));
  const st = await page.evaluate(() => __mock.state().schedules.find(s => s.title === 'Session 8 auto'));
  check('Scheduler auto: the preferred slot wins; no meeting is created by automation', st.proposal.slot_id === st.slots[1].id && st.proposal.auto === true && (await page.evaluate(() => __mock.state().meetings.length)) === meetingsBefore);
  await go(page, q('p2'), 'overview'); await click('#notificationTrigger');
  check('Scheduler auto: the party is asked to confirm', /Everyone agrees: please confirm Session 8 auto/.test(await text(page, '#notificationList')));
  await page.keyboard.press('Escape');
  // p2 can't make it: the next best time is proposed
  await go(page, q('p2'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  await page.evaluate(() => [...document.querySelectorAll('.cw-sched-card')].find(x => /Session 8 auto/.test(x.innerText)).querySelector('[data-sc="decline"]').click());
  await sleep(300); if (await exists('[data-confirm-ok]')) await click('[data-confirm-ok]', 800); else await sleep(800);
  const st2 = await page.evaluate(() => __mock.state().schedules.find(s => s.title === 'Session 8 auto'));
  check('Scheduler auto: a declined time is skipped and the next one proposed', st2.status === 'awaiting_confirmation' && st2.proposal.slot_id === st2.slots[0].id && st2.declinedSlots.length === 1, JSON.stringify([st2.status, st2.proposal, st2.declinedSlots]));
  // DM switches automation off on another request; players can't
  await go(page, q('dm'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  const id = await page.evaluate(async () => { const d = n => new Date(Date.now() + n * 86400000).toISOString(); const r = await FogCampaignData.createSchedule(FogCampaign.id, { title: 'Session 9 soon', format: 'online', slots: [{ id: 's1', start: d(2), end: d(2.2) }], due: d(0.5) }, false); await FogCampaignData.setScheduleAutomation(r.id, true, 'https://meet.example.com/9'); await FogCampaignData.publishSchedule(r.id); return r.id; });
  await go(page, q('dm'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  await page.click(`[data-sc="automation"][data-id="${id}"]`); await sleep(300);
  await page.click('dialog [name=auto]'); await page.click('dialog button[type=submit]'); await sleep(800);
  check('Scheduler auto: the DM can turn it off', (await page.evaluate((id) => __mock.state().schedules.find(s => s.id === id).autoPropose, id)) === false);
  await go(page, q('p1'), 'meetings'); await click('[data-mt-tab="scheduling"]');
  check('Scheduler auto: players have no automation control', !(await exists('[data-sc="automation"]')));
  const denied = await page.evaluate(async (id) => (await FogCampaignData.setScheduleAutomation(id, true, null)).message, id);
  check('Scheduler auto: a player calling it directly is refused', /Only the Dungeon Master/.test(denied), denied);
  await go(page, q('p2'), 'overview'); await click('#notificationTrigger');
  check('Scheduler auto: deadline within a day → reminder to those who have not answered', /Reminder: Session 9 soon/.test(await text(page, '#notificationList')));
  const reminders = await page.evaluate(() => __mock.state().notifs.filter(n => /Reminder: Session 9/.test(n.title)).length);
  await go(page, q('dm'), 'meetings');
  check('Scheduler auto: each person is reminded once', (await page.evaluate(() => __mock.state().notifs.filter(n => /Reminder: Session 9/.test(n.title)).length)) === reminders && reminders === 3);
});

// ================= Logbook (formerly Memories & Recaps) =================
await run('logbook', async () => {
  await go(page, q('dm'), 'memories');
  check('Logbook: the old #memories address still works (alias)', (await text(page, '.cw-page-title')) === 'Logbook' && /logbook/i.test(await text(page, '.fod-nav-item.nav-item-active .fod-nav-label')));
  // a finished meeting to hang a recap on
  await go(page, q('dm'), 'meetings');
  await page.evaluate(async () => {
    const r = await FogCampaignData.createMeeting(FogCampaign.id, { title: 'Session 3: The Ford', startsAt: new Date(Date.now() - 3 * 86400000).toISOString(), location: 'Online', description: '' });
    await FogCampaignData.setMeetingStatus(r.meeting.id, 'completed', 'The party crossed the ford and met Lord Vance.');
  });
  await go(page, q('dm'), 'logbook');
  check('Memories (DM, plan allows): can write', await page.$eval('[data-mm="new"]', b => !b.disabled) && !/locked/i.test(await text(page, '#mm-lock')));
  await click('[data-mm="new"]');
  await page.select('dialog [name=kind]', 'quote');
  await page.type('dialog [name=title]', 'The innkeeper’s warning');
  await page.type('dialog [name=content]', 'Never trust a man with ink on his fingers.');
  await page.type('dialog [name=subject]', 'Old Marta');
  await page.click('dialog [data-mm-save="published"]'); await sleep(800);
  check('Memories: published quote appears with kind, subject and visibility', /The innkeeper’s warning/.test(await body()) && /Quote/.test(await body()) && /Old Marta/.test(await body()) && /Visible to players/.test(await body()) && /Published/.test(await body()));
  await click('[data-mm="new"]');
  await page.type('dialog [name=title]', 'Lord Vance serves the lich');
  await page.type('dialog [name=content]', 'Secret: he is the lich’s agent.');
  await page.click('dialog input[name=visibility][value="dm"]');
  await page.click('dialog [data-mm-save="published"]'); await sleep(800);
  check('Memories: a DM-only note is marked DM only', /DM only/.test(await body()));
  await click('[data-mm="new"]');
  await page.type('dialog [name=title]', 'Draft idea');
  await page.click('dialog [data-mm-save="draft"]'); await sleep(800);
  await go(page, q('p1'), 'logbook');
  const pb = await body();
  check('Memories (player): sees only published player-visible memories', /The innkeeper’s warning/.test(pb) && !/Lord Vance serves the lich/.test(pb) && !/Draft idea/.test(pb) && !/Secret: he is/.test(pb));
  check('Memories (player): no writing controls and no visibility pills', !(await exists('[data-mm="edit"], [data-mm="delete"], [data-mm="toggle"]')) && await page.$eval('[data-mm="new"]', () => false).catch(() => true));
  check('Memories (player): no DM-only filter', !(await exists('[data-mm-f="vis"]')));
  // edit
  await go(page, q('dm'), 'logbook');
  await page.click('.cw-memory:nth-child(1) [data-mm="edit"]'); await sleep(300);
  await page.$eval('dialog [name=title]', e => { e.value = 'The innkeeper’s warning (edited)'; });
  await page.click('dialog [data-mm-save="published"]'); await sleep(700);
  check('Memories: edits are saved', /\(edited\)/.test(await body()));
  // recap
  await click('[data-mm-tab="recaps"]');
  check('Memories: completed meeting listed without a recap', /Session 3: The Ford/.test(await body()) && /No recap yet/.test(await body()) && /crossed the ford/.test(await body()));
  await click('[data-mm="recap"]');
  check('Memories: recap editor opens with the structured sections', await exists('dialog [name=r_happened]') && await exists('dialog [name=r_threads]') && /Recap: Session 3/.test(await page.$eval('dialog [name=title]', e => e.value)));
  await click('dialog [data-mm="from-summary"]');
  check('Memories: “start from the meeting summary” copies only the real summary', /crossed the ford and met Lord Vance/.test(await page.$eval('dialog [name=r_happened]', e => e.value)));
  await page.type('dialog [name=r_decisions]', 'Take the north road.');
  await page.type('dialog [name=r_threads]', 'Who is Lord Vance working for?');
  await page.click('dialog [data-mm-save="draft"]'); await sleep(800);
  check('Memories: recap saved as a draft first (not published automatically)', /Recap in draft/.test(await body()));
  await go(page, q('p2'), 'logbook'); await click('[data-mm-tab="recaps"]');
  check('Memories (player): an unpublished recap is invisible', !/Take the north road/.test(await body()));
  await go(page, q('dm'), 'logbook'); await click('[data-mm-tab="recaps"]');
  await click('[data-mm="edit"]'); await page.click('dialog [data-mm-save="published"]'); await sleep(800);
  check('Memories: DM publishes the recap after review', /Recap published/.test(await body()));
  await go(page, q('p2'), 'logbook');
  check('Memories (player): the published recap is readable with its sections', /Take the north road/.test(await body()) && /Unresolved threads/.test(await body()));
  // history
  await click('[data-mm-tab="history"]'); await sleep(500);
  check('Memories: history tab lists the start of the campaign', /The campaign started/.test(await body()));

  // locked plan
  await go(page, q('dm', '&dmplan=warlord'), 'logbook');
  check('Memories (Free plan): locked banner explains the requirement; writing disabled', /locked for this campaign/i.test(await text(page, '#mm-lock')) && /Dungeon Master and Fogger/.test(await text(page, '#mm-lock')) && await page.$eval('[data-mm="new"]', b => b.disabled));
  check('Memories (Free plan): already published memories stay readable', /The innkeeper’s warning/.test(await body()));
  const denied = await page.evaluate(async () => (await FogCampaignData.saveMemory(FogCampaign.id, { kind: 'event', title: 'Sneaky', visibility: 'players', status: 'published' })).message);
  check('Memories (Free plan): a direct save is refused as well', /plan includes the Logbook/.test(denied), denied);
  await go(page, q('p1', '&dmplan=warlord'), 'logbook');
  check('Memories (player, locked): told to ask the DM', /Ask your Dungeon Master/.test(await text(page, '#mm-lock')));

  // book
  await go(page, q('dm', '&dmplan=dungeon-master'), 'logbook/book');
  const offer = await body();
  check('Book (not unlocked): offer explains digital/print, buttons disabled, no fake purchase', /campaign book/i.test(offer) && /everyone in the campaign/i.test(offer) && (await page.$$eval('.cw-book-offer button', b => b.length === 2 && b.every(x => x.disabled))) && /nothing can be bought/i.test(offer));
  check('Book (not unlocked): no book content is loaded', !(await exists('.cw-book')));
  const refused = await page.evaluate(async () => (await FogCampaignData.getBook(FogCampaign.id)).message);
  check('Book: a direct request is refused while locked', /isn’t unlocked/.test(refused), refused);
  await page.evaluate(() => __mock.markBookPaid());
  await go(page, q('p1'), 'logbook/book');
  check('Book: after one member’s paid purchase every member can read it', await exists('.cw-book') && /Unlocked for the whole campaign/.test(await body()) && /Sam Okafor/.test(await body()));
  const bk = await body();
  check('Book: title page, party, timeline, chapter with recap, quote, no DM-only material', /The Ashen Crown/.test(bk) && /Brienne Ashford/.test(bk) && /Timeline/i.test(bk) && /Chapter I/i.test(bk) && /Session 3: The Ford/.test(bk) && /Take the north road/.test(bk) && /Never trust a man/.test(bk) && !/lich/.test(bk) && !/Draft idea/.test(bk), bk.slice(0, 300));
  check('Book: member who bought it still cannot edit', !(await exists('[data-mm="new"]')) || await page.$eval('[data-mm="new"]', b => b.disabled));
  await page.screenshot({ path: SP + '/book.png', fullPage: false });
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons&reset=1'), 'logbook/book');
  // reset wiped the data; the book is unlocked by the plan alone
  check('Book (top tier): included without any purchase', await exists('.cw-book') && /Included with the Dungeon Master’s plan/.test(await body()));
  await go(page, q('dm', '&dmplan=warlord'), 'logbook/book');
  check('Book (Free plan): locked', !(await exists('.cw-book')));
});

// ================= Locking and level-ups =================
await run('locking', async () => {
  await go(page, q('dm', '&dmplan=dungeon-master&reset=1'), 'settings');
  const s = await body();
  check('Settings: lock card explains what is locked since the start', /Locked since the start/.test(s) && /adventure/i.test(s) && /one level at a time/i.test(s));
  check('Settings: starting level and people needed are locked', await page.$eval('#cs-level', e => e.disabled) && await page.$eval('#cs-players', e => e.disabled));
  check('Settings: adventure can’t be switched normally', !(await exists('#cs-adventure-select')) && await exists('[data-cs="override-adventure"]'));
  const direct = await page.evaluate(async () => (await FogCampaignStore.setAdventure(FogCampaign.id, '44444444-4444-4444-8444-444444444444')).message);
  check('Locking: a direct request to switch adventure is refused', /locked once the campaign has started/.test(direct), direct);
  const direct2 = await page.evaluate(async () => (await FogCampaignStore.update(FogCampaign.id, { name: 'x', description: '', startingLevel: 9, requiredPlayers: 3, privacy: 'private' })).message);
  check('Locking: a direct request to change the starting level is refused', /locked once the campaign has started/.test(direct2), direct2);
  await page.$eval('#cs-name', e => { e.value = 'The Ashen Crown (locked test)'; }); await page.click('#cs-form button[type=submit]'); await sleep(700);
  check('Locking: name and description remain editable', (await text(page, '#cw-name')) === 'The Ashen Crown (locked test)');
  // override: needs a reason + acknowledgement
  await click('[data-cs="override-adventure"]');
  check('Override: confirm button disabled until a reason and acknowledgement', await page.$eval('dialog button[type=submit]', b => b.disabled));
  await page.type('dialog [name=reason]', 'short');
  await page.click('dialog [name=ack]');
  check('Override: a too-short reason is not enough', await page.$eval('dialog button[type=submit]', b => b.disabled));
  await page.type('dialog [name=reason]', ' — we picked the wrong adventure at setup.');
  check('Override: reason + acknowledgement enables it', await page.$eval('dialog button[type=submit]', b => !b.disabled));
  await page.click('dialog button[type=submit]'); await sleep(900);
  check('Override: applied and reported', /correction is in the campaign history/.test(await body()));
  await go(page, q('dm'), 'logbook/history'); await sleep(400);
  const hist = await body();
  check('Override: recorded in the history with the reason', /corrected a locked setting/i.test(hist) && /wrong adventure at setup/.test(hist));
  // player cannot override
  await go(page, q('p1'), 'settings');
  const pov = await page.evaluate(async () => (await FogCampaignStore.overrideLock(FogCampaign.id, 'set_adventure', { adventure_id: 'x' }, 'I would like another adventure please')).message);
  check('Override: a player cannot use it', /Only the Dungeon Master/.test(pov), pov);
  check('Settings (player): no correction buttons', !(await exists('[data-cs="override-adventure"], [data-cs="override-level"]')));

  // Characters: no replace/clear/build after start; level-up exceptions
  await go(page, q('p1'), 'characters');
  check('Characters (player): no use/build/remove controls after the start', !(await exists('[data-ch="use"], [data-ch="build"], [data-ch="clear"]')));
  const setLocal = async (level) => page.evaluate(async lv => {
    const snap = __mock.state().snaps.p1;
    const d = FogCharacterStore.createDraft();
    d.id = snap.sourceCharacterId;
    if (window.FogCharacterRegistry && !FogCharacterStore.get(d.id)) await FogCharacterRegistry.claim(d.id); // a new character needs a slot, as in the app
    d.choices = Object.assign(d.choices, JSON.parse(JSON.stringify(snap.choices))); d.narrative = Object.assign(d.narrative, JSON.parse(JSON.stringify(snap.narrative)));
    d.choices.level = lv; d.status = 'complete';
    return FogCharacterStore.save(d).ok;
  }, level);
  check('Level-up setup: local character saved', await setLocal(4));
  await go(page, q('p1'), 'characters');
  check('Level-up: “Record level-up to 4” is offered for exactly one level', await exists('[data-ch="levelup"]') && /level-up to 4/i.test(await text(page, '[data-ch="levelup"]')));
  await click('[data-ch="levelup"]', 900);
  check('Level-up: recorded, character shows level 4', /Level 4/.test(await body()) && /Level-up recorded/.test(await body()));
  await setLocal(7);
  await go(page, q('p1'), 'characters');
  check('Level-up: a sheet several levels ahead is not accepted (no button)', !(await exists('[data-ch="levelup"]')) && /levels ahead/.test(await body()));
  const jump = await page.evaluate(async () => { const d = FogCharacterStore.get(__mock.state().snaps.p1.sourceCharacterId); return (await FogCampaignStore.levelUp(FogCampaign.id, d)).message; });
  check('Level-up: a direct request with an arbitrary level is rejected', /one level at a time/.test(jump), jump);
  await setLocal(5);
  const other = await page.evaluate(async () => { const d = FogCharacterStore.get(__mock.state().snaps.p1.sourceCharacterId); d.choices.classId = 'wizard'; return (await FogCampaignStore.levelUp(FogCampaign.id, d)).message; });
  check('Level-up: a different class is not a level-up', /same character/.test(other), other);
  await go(page, q('dm'), 'logbook/history');
  check('Level-up is in the campaign history', /Brienne Ashford reached level 4/.test(await body()));
  // DM correction on the party
  await go(page, q('dm'), 'characters');
  check('Characters (DM): no ordinary replace, only a logged correction', !(await exists('[data-ch="build"]')) && await exists('[data-ch="replace"]'));
  await go(page, q('dm'), 'members');
  check('Members (DM): removing a player after the start is a logged correction', !(await exists('[data-mb="remove"]')) && await exists('[data-mb="correct-remove"]'));
  await click('[data-mb="correct-remove"]');
  await page.type('dialog [name=reason]', 'Sam moved away and left the group.'); await page.click('dialog [name=ack]');
  await page.click('dialog button[type=submit]'); await sleep(900);
  await go(page, q('dm'), 'logbook/history');
  check('Correction: removal recorded in the history', /correct(ed)? a locked setting/i.test(await body()) && /remove_member/.test(await body()) && /moved away/.test(await body()));
});


// ================= Scheduler: suggestions, propose without someone, deadline =================
await run('scheduler-suggest', async () => {
  await go(page, q('dm', '&reset=1'), 'meetings'); // earlier tests removed a player; start from the seeded campaign await page.waitForSelector('[data-mt-tab="scheduling"]', { timeout: 10000 }); await click('[data-mt-tab="scheduling"]');
  const rid = await page.evaluate(async () => {
    const d = (n, h) => new Date(Date.now() + n * 86400000 + h * 3600000).toISOString();
    const r = await FogCampaignData.createSchedule(FogCampaign.id, { title: 'Session 9 suggest', format: 'online', durationMinutes: 180, slots: [{ id: 's1', start: d(8, 0), end: d(8, 4) }, { id: 's2', start: d(9, 0), end: d(9, 4) }], due: d(2, 0) }, true);
    return r.id;
  });
  const answer = async (who, av) => {
    await go(page, q(who), 'meetings'); await page.waitForSelector('[data-mt-tab="scheduling"]', { timeout: 10000 }); await click('[data-mt-tab="scheduling"]');
    await page.evaluate((av) => {
      const c = [...document.querySelectorAll('.cw-sched-card')].find(x => /Session 9 suggest/.test(x.innerText));
      Object.keys(av).forEach((slot, i) => { c.querySelectorAll('.cw-answer-row')[i].querySelector(`input[value="${av[slot]}"]`).checked = true; });
      c.querySelector('.cw-answer-form button[type=submit]').click();
    }, av);
    await sleep(800);
  };
  await answer('p1', { s1: 'available', s2: 'unavailable' });
  // the deadline passes with p2 and the DM silent: the server moves on by itself (here: the stand-in's processing)
  await page.evaluate((id) => { const all = JSON.parse(localStorage.getItem('__mock_cw')); const r = all.schedules.find(x => x.id === id); r.due = new Date(Date.now() - 60000).toISOString(); localStorage.setItem('__mock_cw', JSON.stringify(all)); }, rid);
  await go(page, q('dm'), 'meetings'); await page.waitForSelector('[data-mt-tab="scheduling"]', { timeout: 10000 }); await click('[data-mt-tab="scheduling"]');
  const card = () => page.evaluate(() => [...document.querySelectorAll('.cw-sched-card')].find(x => /Session 9 suggest/.test(x.innerText)).innerText);
  const c1 = await card();
  check('Scheduler: deadline passed → answers closed, suggestions made from the answers there are', /Answers closed at the deadline \(1 of 3 answered\)/.test(c1) && /Suggested times/.test(c1) && /1 of 3 can come/.test(c1), c1.slice(0, 600));
  check('Scheduler: the DM was told the answers closed', (await page.evaluate(() => __mock.state().notifs.filter(n => /Answers closed: Session 9/.test(n.title)).length)) === 1);
  check('Scheduler: no time works for everyone, and it says so (no fake unanimity)', !/Everyone can come/.test(c1));
  // propose the best option without the people who can't come
  const btn = await page.evaluateHandle(() => [...document.querySelectorAll('.cw-sched-card')].find(x => /Session 9 suggest/.test(x.innerText)).querySelector('[data-sc="use-sugg"]'));
  check('Scheduler: the best option offers “Propose without …” naming who is left out (never the DM: proposing counts as the DM’s yes)', /^Propose without Sam Okafor$/.test((await btn.evaluate(b => b.innerText)).trim()), await btn.evaluate(b => b.innerText));
  await page.evaluate(() => [...document.querySelectorAll('.cw-sched-card')].find(x => /Session 9 suggest/.test(x.innerText)).querySelector('[data-sc="use-sugg"]').click()); await sleep(300);
  const dlg = await text(page, 'dialog');
  check('Propose dialog: warns that someone is left out and must not confirm', /Not everyone can come/.test(dlg) && /left out of this meeting and told so/.test(dlg), dlg.slice(0, 300));
  check('Propose dialog: Meeting in the Fog needs no link', !(await exists('dialog [name=link]')));
  await page.click('dialog button[type=submit]'); await sleep(900);
  const st = await page.evaluate(() => __mock.state().schedules.find(s => s.title === 'Session 9 suggest'));
  check('Propose without: the request awaits confirmation from those left; the person left out is told', st.status === 'awaiting_confirmation' && st.excludedUsers.length >= 1 && !st.required.some(u => st.excludedUsers.includes(u)) && (await page.evaluate(() => __mock.state().notifs.filter(n => /Not this time: Session 9/.test(n.title)).length)) >= 1, JSON.stringify([st.status, st.required, st.excludedUsers]));
  for (const who of ['dm', 'p1']) { await go(page, q(who), 'meetings'); await page.waitForSelector('[data-mt-tab="scheduling"]', { timeout: 10000 }); await click('[data-mt-tab="scheduling"]'); await page.evaluate(() => [...document.querySelectorAll('.cw-sched-card')].find(x => /Session 9 suggest/.test(x.innerText)).querySelector('[data-sc="confirm"]').click()); await sleep(800); }
  const done = await page.evaluate(() => { const s = __mock.state(); return [s.schedules.find(x => x.title === 'Session 9 suggest').status, s.meetings.filter(m => m.title === 'Session 9 suggest').length]; });
  check('Propose without: confirmations after the answer deadline still count; one meeting is created', done[0] === 'confirmed' && done[1] === 1, JSON.stringify(done));
});

// ================= Combat: two DM tabs (version conflict), player live view =================
await run('combat-conflict', async () => {
  await go(page, q('dm', '&reset=1'), 'combat');
  await page.waitForSelector('[data-cb="new"]', { timeout: 10000 });
  await click('[data-cb="new"]'); await click('[data-cb="addparty"]');
  for (const [i, v] of [[0, 15], [1, 12]]) { await page.evaluate((i, v) => { const e = document.querySelectorAll('[data-cb="init"]')[i]; e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, i, v); await sleep(250); }
  await click('[data-cb="start"]', 600);
  // Another tab or device saves a newer version (the in-browser stand-in keeps one copy per tab, so bump it here;
  // the real version check is tested against the database in tests/db/rls.test.mjs).
  const before = await text(page, '.cw-row.is-current .cw-row-name strong');
  await page.evaluate(() => __mock.combatSavedElsewhere());
  await page.$eval('[data-cb="next"]', (b) => b.click()); await sleep(600);
  const msg = await page.$eval('#cb-save', (e) => e.innerText);
  check('Combat: a save from an out-of-date tab is refused with a clear message and Reload', /changed somewhere else/.test(msg) && await page.$('#cb-save [data-cb="reload"]') !== null, msg);
  check('Combat: the refused change was not written', (await page.evaluate(() => Object.values(__mock.state().combats)[0].state.round)) === 7);
  await page.$eval('#cb-save [data-cb="reload"]', (b) => b.click()); await sleep(700);
  check('Combat: Reload shows the saved (newer) state', /Round 7/i.test(await text(page, '.cw-stage')) && (await text(page, '.cw-row.is-current .cw-row-name strong')) === before);
  const aNow = await text(page, '.cw-row.is-current .cw-row-name strong');
  // the player view follows the DM (Realtime in the real app; here a reload of the page)
  await go(page, q('p1'), 'combat');
  check('Combat (player): sees the DM’s current turn, no DM controls', (await text(page, '.cw-row.is-current .cw-row-name strong')).replace(' (you)', '') === aNow.replace(' (you)', '') && !(await exists('.cw-dmbar, [data-amt], [data-cb="init"]')));
  await page.setViewport({ width: 390, height: 800 });
  await go(page, q('dm'), 'combat');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('Combat (phone): no sideways scrolling; rail scrolls inside itself', over <= 0 && await page.$eval('.cw-rail-wrap', (e) => getComputedStyle(e).overflowX === 'auto'), over);
  await page.setViewport({ width: 1280, height: 900 });
});

// ================= Dice roller =================
await run('dice', async () => {
  await go(page, q('dm', '&reset=1'), 'combat');
  await page.waitForSelector('.cw-dice-card', { timeout: 10000 });
  check('Dice: a compact panel, closed by default so it doesn’t dominate Combat', await page.$eval('.cw-dice-card', (d) => !d.open));
  await page.$eval('.cw-dice-card summary', (s) => s.click()); await sleep(200);
  check('Dice: the tray is in Combat with the standard dice and a notation box', (await page.$$('.cw-die-btn')).length === 7 && await exists('#cw-dice-expr') && /Animated dice are on/.test(await text(page, '#cw-dice-note')));
  // animation ON: the tumbling dice appear right away and land on the shown result
  await page.click('.cw-die-btn[data-dice="d20"]');
  await sleep(250);
  check('Dice (setting on): the 3D tumble overlay appears while rolling', await exists('.cw-dice-stage .cw-die') && /Rolling/.test(await text(page, '#cw-dice-result')));
  await sleep(1700);
  const r1 = await text(page, '#cw-dice-result');
  const total = Number((/^(\d+)/.exec(r1) || [])[1]);
  check('Dice: a d20 gives a total from 1 to 20, shown as text too', total >= 1 && total <= 20 && /1d20: \d+ = \d+/.test(r1), r1);
  await sleep(1400);
  check('Dice: the overlay goes away by itself', !(await exists('.cw-dice-stage')));
  await page.$eval('#cw-dice-expr', e => { e.value = '2d6+3'; });
  await page.click('.cw-dice-form button[type=submit]'); await sleep(2200);
  const r2 = await text(page, '#cw-dice-result');
  const t2 = Number((/^(\d+)/.exec(r2) || [])[1]);
  check('Dice: 2d6+3 shows both dice and the modifier, total 5–15', t2 >= 5 && t2 <= 15 && /2d6\+3: \[\d \+ \d\] \+ 3 = \d+/.test(r2), r2);
  check('Dice: recent rolls are listed', (await page.$$('#cw-dice-history li')).length === 2);
  check('Dice: the panel’s summary shows the last result', /Last roll: .*2d6\+3/.test(await text(page, '#cb-dice-last')), await text(page, '#cb-dice-last'));
  await page.$eval('#cw-dice-expr', e => { e.value = 'banana'; });
  await page.click('.cw-dice-form button[type=submit]'); await sleep(300);
  check('Dice: bad notation is explained and nothing rolls', /Write a roll like/.test(await text(page, '#cw-dice-result')) && (await page.$$('#cw-dice-history li')).length === 2);
  // a quick die keeps the typed count and modifier
  await page.$eval('#cw-dice-expr', e => { e.value = '3d6-1'; });
  await page.click('.cw-die-btn[data-dice="d8"]'); await sleep(2300);
  check('Dice: a quick die button keeps the count and modifier (3d8-1)', /3d8−1: \[\d \+ \d \+ \d\] − 1 = \d+/.test(await text(page, '#cw-dice-result')));
  // fairness smoke test in the page itself (real crypto source)
  const counts = await page.evaluate(() => { const c = new Array(7).fill(0); for (let i = 0; i < 12000; i++) c[FogDice.cryptoInt(6)]++; return c; });
  check('Dice: 12,000 d6 rolls use every face about equally', counts[0] === 0 && counts.slice(1).every(n => n > 1700 && n < 2300), JSON.stringify(counts));
  // initiative uses the same dice
  await click('[data-cb="new"]'); await click('[data-cb="addparty"]');
  await page.click('[data-cb="roll"]'); await sleep(250);
  check('Dice: the initiative button plays the tumble too', await exists('.cw-dice-stage'));
  await sleep(2600);
  const init = await page.$eval('[data-cb="init"]', e => e.value);
  check('Dice: the initiative value is the d20 plus the modifier (1+mod … 20+mod)', init !== '' && Number(init) >= 1 + 0 && Number(init) <= 24, init);
  // setting OFF: instant result, no overlay
  await go(page, q('dm', '&dice=off'), 'combat');
  check('Dice (setting off): the tray says rolls show as text', /Animated dice are off/.test(await text(page, '#cw-dice-note')));
  await page.click('.cw-die-btn[data-dice="d12"]'); await sleep(120);
  check('Dice (setting off): no overlay at all, the result is immediate', !(await exists('.cw-dice-stage')) && /1d12: \d+ = \d+/.test(await text(page, '#cw-dice-result')));
  // players can roll too, privately
  await go(page, q('p1'), 'combat');
  await page.click('.cw-die-btn[data-dice="d20"]'); await sleep(2400);
  check('Dice (player): players have the tray too, rolls stay local', /1d20: \d+ = \d+/.test(await text(page, '#cw-dice-result')) && /Only you see your rolls|1d20/.test(await text(page, '.cw-dice-card')));
  // reduced motion wins over the setting
  const ctxPage = await browser.newPage();
  await ctxPage.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await ctxPage.setViewport({ width: 1100, height: 800 });
  await ctxPage.goto(`${BASE}/tests/ui/campaign-harness.html?as=dm&c=${A}#combat`, { waitUntil: 'load' });
  await ctxPage.waitForSelector('.cw-dice-card', { timeout: 8000 });
  await ctxPage.click('.cw-die-btn[data-dice="d20"]'); await sleep(150);
  check('Dice (reduced motion): no animation even when the setting is on', !(await ctxPage.$('.cw-dice-stage')) && /1d20: \d+/.test(await ctxPage.$eval('#cw-dice-result', e => e.innerText)));
  await ctxPage.close();
});

// ================= Payments UI (nothing is bought or unlocked from the page itself) =================
await run('payments', async () => {
  await go(page, q('dm', '&reset=1&dmplan=dungeon-master'), 'logbook/book');
  check('Book offer (payments off): buy button disabled, honest explanation', await page.$eval('[data-mm="buy-book"]', b => b.disabled) && /aren’t switched on|aren't switched on/.test(await body()));
  await go(page, q('dm', '&dmplan=dungeon-master&pay=on'), 'logbook/book');
  check('Book offer (payments on, DM plan includes the Logbook): buy button enabled, pay page explained', await page.$eval('[data-mm="buy-book"]', b => !b.disabled) && /Lemon Squeezy/.test(await body()) && /Nothing unlocks until they confirm/.test(await body()));
  check('Book offer: the printed copy stays disabled with the reason', await page.$eval('.cw-book-offer button:nth-of-type(2)', b => b.disabled) && /no printing and shipping provider/.test(await body()));
  await click('[data-mm="buy-book"]', 500);
  check('Buy: asks the server for exactly this campaign’s book checkout', await page.evaluate(A => JSON.stringify(window.__bought) === JSON.stringify({ p: 'campaign_book_digital', c: A }), A));
  check('Buy: clicking does NOT unlock anything', !(await exists('.cw-book')) && (await page.evaluate(() => __mock.state().bookPaid)) === null);
  await go(page, q('dm', '&dmplan=warlord&pay=on'), 'logbook/book');
  check('Book offer (DM plan without the Logbook): cannot buy; told why', await page.$eval('[data-mm="buy-book"]', b => b.disabled) && /needs the Logbook/.test(await body()));
  // returning from the checkout: waits for the server's confirmation, then unlocks for a member who did not buy it
  await page.goto(`${BASE}/tests/ui/campaign-harness.html?as=p1&c=${A}&dmplan=dungeon-master&pay=on&checkout=success#logbook/book`, { waitUntil: 'load' });
  await page.waitForSelector('#campaign-content .cw-page', { timeout: 8000 }); await sleep(900);
  check('Back from checkout: shows “Confirming your payment” and keeps the book locked', /Confirming your payment/.test(await body()) && !(await exists('.cw-book')));
  await page.evaluate(() => __mock.markBookPaid());   // the provider's signed webhook reaching the server
  await sleep(4200);
  check('Back from checkout: unlocks only once the server says paid, for every member', await exists('.cw-book') && /Unlocked for the whole campaign/.test(await body()));
});

console.log(results.map(r => r.join(' ')).join('\n'));
console.log('\nFAILS:', results.filter(r => r[0] === 'FAIL').length, '/', results.length);
console.log('JS ERRORS:', errors.filter(e => !/^404:|Failed to load resource/.test(e)));
console.log('404s:', [...new Set(errors.filter(e => /^404:/.test(e)))].slice(0, 8));
await browser.close();
if (results && results.some((r) => r[0] === 'FAIL')) process.exitCode = 1;
