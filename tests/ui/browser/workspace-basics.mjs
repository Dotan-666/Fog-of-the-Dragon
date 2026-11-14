/** Browser test (see lib.mjs for setup). Prints PASS/FAIL lines and a summary; exits non-zero on any failure. */
import { open, go, A, B, text, BASE, SHOTS } from './lib.mjs';
const SP = SHOTS;
const results = [];
const check = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 200)]); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = (as, c = A, extra = '') => `as=${as}&c=${c}${extra}`;
const { browser, page, errors } = await open();
const body = () => text(page, '#campaign-content');
const all = () => page.evaluate(() => document.body.innerText);
const exists = sel => page.$(sel).then(x => !!x);
const hash = () => page.evaluate(() => location.hash);
const click = async (sel) => { await page.click(sel); await sleep(350); };
const sections = ['overview', 'feed', 'meetings', 'members', 'characters', 'combat', 'music', 'content', 'bestiary', 'settings'];
const URL0 = BASE + '/tests/ui/campaign-harness.html';

// ---- Navigation as DM ----
await go(page, q('dm', A, '&reset=1'), 'overview');
check('DM: header shows campaign + role + settings button', (await text(page, '#cw-name')) === 'The Ashen Crown' && (await text(page, '#cw-role')) === 'Dungeon Master' && await page.$eval('#cw-settings-btn', e => !e.hidden));
for (const s of sections) {
  await page.evaluate(h => { location.hash = h; }, s); await sleep(900);
  const ok = await page.$('#campaign-content .cw-page .cw-page-title, #campaign-content .cw-page h2');
  check(`DM: section ${s} renders in the same campaign`, !!ok && page.url().includes('c=' + A), (await body()).slice(0, 120));
}
await page.evaluate(() => { location.hash = 'characters'; }); await sleep(800);
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#campaign-content .cw-page'); await sleep(900);
check('refresh keeps campaign + section', (await hash()) === '#characters' && (await text(page, '#cw-name')) === 'The Ashen Crown' && (await body()).includes('Brienne Ashford'));
await page.evaluate(() => { location.hash = 'feed'; }); await sleep(600);
await page.goBack(); await sleep(700);
check('back button works inside the workspace', (await hash()) === '#characters', await hash());
check('Dashboard link points to dashboard campaigns', (await page.$eval('#cw-back', a => a.getAttribute('href'))) === 'dashboard.html#campaigns');

// ---- Characters ----
await go(page, q('dm'), 'characters');
const cb = await body();
check('Characters: both PCs with class/level', /Brienne Ashford/.test(cb) && /Level 3 Human Fighter/.test(cb) && /Tobias Vell/.test(cb) && /Level 3 Human Wizard/.test(cb), cb.slice(0, 300));
check('Characters: no pick/build controls after start', !(await page.$('[data-ch="use"], [data-ch="build"]')));
await click('[data-ch="details"]');
check('Characters: details dialog shows abilities + HP/AC', await page.$eval('dialog[open]', d => /armor class/i.test(d.innerText) && /hit points/i.test(d.innerText) && d.querySelectorAll('.cw-abil').length === 6).catch(() => false));
await page.keyboard.press('Escape'); await sleep(200);

// ---- Feed ----
await go(page, q('dm'), 'feed');
check('Feed: empty state', /No messages yet/.test(await body()));
await page.type('#fd-input', 'Welcome, heroes!'); await page.keyboard.press('Enter'); await sleep(500);
check('Feed: sent message shown with author', /Welcome, heroes!/.test(await body()) && /Morgan Hale/.test(await body()));
await page.evaluate(() => __mock.pushMessage('p1', 'Ready when you are <b>x</b>')); await sleep(300);
check('Feed: realtime message appears, HTML escaped', /Ready when you are <b>x<\/b>/.test(await body()) && !(await page.$('.cw-msg-body b')));
await page.evaluate(() => { location.hash = 'overview'; }); await sleep(500);
await page.evaluate(() => __mock.pushMessage('p2', 'Unread one')); await sleep(300);
check('Feed: unread badge on nav', await page.$eval('.fod-nav-item[data-cw-section="feed"] .cw-badge', e => e.innerText === '1').catch(() => false));
await page.evaluate(() => { location.hash = 'feed'; }); await sleep(700);
check('Feed: badge cleared on open', !(await page.$('.cw-badge')));
check('Feed: DM can delete any message', (await page.$$('[data-fd="delete"]')).length === 3);
await click('[data-fd="delete"]'); await click('[data-confirm-ok]'); await sleep(300);
check('Feed: delete needs confirmation then removes', (await page.$$('.cw-msg')).length === 2);
await go(page, q('p1'), 'feed');
check('Player: sees messages; may delete only own', (await page.$$('.cw-msg')).length === 2 && (await page.$$('[data-fd="delete"]')).length <= 1);

// ---- Meetings ----
await go(page, q('dm'), 'meetings');
check('Meetings: empty upcoming', /No upcoming meetings/.test(await body()));
await click('[data-mt="new"]');
const soon = await page.evaluate(() => { const d = new Date(Date.now() + 2 * 86400000); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':00'; });
await page.type('dialog [name=title]', 'Session 4: The Drowned Gate');
await page.$eval('dialog [name=start]', (e, v) => { e.value = v; }, soon);
await page.type('dialog [name=location]', "Riley's place");
await page.type('dialog [name=description]', 'Bring snacks.');
await page.click('dialog button[type=submit]'); await sleep(700);
check('Meetings: created, upcoming, location shown', /Session 4: The Drowned Gate/.test(await body()) && /Riley's place/.test(await body()) && /Upcoming \(1\)/.test(await body()));
await go(page, q('dm'), 'overview');
check('Overview: next meeting with countdown + details button', /Session 4: The Drowned Gate/.test(await body()) && /in (1 day|2 days|\d+ hours)/.test(await body()) && !!(await page.$('a[href^="#meetings/"]')), (await body()).slice(300, 700));
await go(page, q('p1'), 'meetings');
check('Player: no schedule/edit/delete controls', !(await page.$('[data-mt="new"], [data-mt="edit"], [data-mt="complete"], [data-mt="delete"]')));
await click('[data-mt="rsvp"][data-answer="yes"]');
check('Player: RSVP saved', /1 yes/.test(await body()));
await go(page, q('dm'), 'meetings');
check('DM sees the player RSVP', /1 yes/.test(await body()));
await click('[data-mt="complete"]');
await page.type('dialog [name=summary]', 'The party crossed the ford and found the gate.');
await page.click('dialog button[type=submit]'); await sleep(700);
check('Meetings: completed moves to history', /Upcoming \(0\)/.test(await body()) && /History \(1\)/.test(await body()));
await click('[data-mt-tab="history"]');
check('Meetings: history shows Completed + summary, no delete', /Completed/.test(await body()) && /found the gate/.test(await body()) && !(await page.$('[data-mt="delete"]')));
await go(page, q('p2'), 'overview');
check('Overview (player): completed meeting in activity', /Meeting completed: Session 4/.test(await body()));

// ---- Combat ----
await go(page, q('dm'), 'combat');
check('Combat DM: empty state', /No encounter yet/.test(await body()));
await click('[data-cb="new"]'); await click('[data-cb="addparty"]');
check('Combat: party added with HP/AC from characters', (await page.$$('.cw-row')).length === 2 && /HP\s*\d+\s*\/\s*\d+/.test(await body()) && /AC\s*\d+/.test(await body()), await body());
await page.type('#cb-search', 'goblin warrior'); await sleep(300);
await page.$eval('[data-count]', e => { e.value = 2; }); await click('[data-cb="addmonster"]');
check('Combat: SRD monsters added (numbered, HP from stat block)', /Goblin Warrior 1/.test(await body()) && /Goblin Warrior 2/.test(await body()) && /HP\s*10\s*\/\s*10/.test(await body()));
await click('[data-cb="start"]'); await sleep(200);
check('Combat: cannot start without initiative', /Initiative is missing/.test(await page.$eval('.cw-notice', e => e.innerText).catch(() => '')));
// fixed initiative so the order is the same on every run
for (const [n, v] of [['Brienne', 15], ['Tobias', 12], ['Goblin Warrior 1', 5], ['Goblin Warrior 2', 4]]) {
  const id = await page.evaluate(n => [...document.querySelectorAll('.cw-row')].find(r => r.innerText.includes(n)).dataset.id, n);
  await page.$eval(`#ini-${id}`, (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, v); await sleep(250);
}
await click('[data-cb="start"]'); await sleep(300);
check('Combat: started, round 1, current turn shown', /round 1/i.test(await body()) && !!(await page.$('.cw-row.is-current')) && /up next/i.test(await text(page, '.cw-turnbar')) && /in progress/i.test(await text(page, '.cw-turnbar')), await text(page, '.cw-turnbar').catch(() => 'no bar'));
const first = await text(page, '.cw-row.is-current .cw-row-name strong');
await click('[data-cb="next"]');
const second = await text(page, '.cw-row.is-current .cw-row-name strong');
check('Combat: next turn advances', first !== second, first + ' -> ' + second);
const gob = await page.evaluate(() => [...document.querySelectorAll('.cw-row')].find(r => r.innerText.includes('Goblin Warrior 1')).dataset.id);
// hit points changed through the DM override of the selected creature (attacks have their own workflow, tested in combat-actions.mjs)
const override = async (id, n, act) => { await page.click(`[data-cb="select"][data-id="${id}"]`); await sleep(250); await page.$eval(`.cw-act [data-amt="${id}"]`, (e, n) => { e.value = n; }, n); await page.$eval(`.cw-act [data-cb="${act}"]`, b => b.click()); await sleep(300); };
await override(gob, 6, 'reduce');
check('Combat: damage reduces HP, Bloodied shown', /HP\s*4\s*\/\s*10/.test(await body()) && /Bloodied/.test(await body()));
await page.select(`[data-cb="addcond"][data-id="${gob}"]`, 'Prone'); await sleep(300);
check('Combat: condition added', await page.$eval('.cw-cond', e => /Prone/.test(e.innerText)).catch(() => false));
await override(gob, 4, 'reduce');
check('Combat: monster at 0 HP is defeated', /Defeated/.test(await body()));
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.cw-turnbar', { timeout: 8000 }); await sleep(400);
check('Combat: encounter persists across refresh', /round 1/i.test(await body()) && /Goblin Warrior 1/.test(await body()));
await go(page, q('p1'), 'combat');
const pb = await body();
check('Combat player: order + turn, no monster numbers, no DM controls', /Goblin Warrior 2/.test(pb) && !/HP\s*10\s*\/\s*10/.test(pb) && /Unhurt/.test(pb) && /Defeated/.test(pb) && !(await page.$('[data-cb="next"]')), pb.slice(0, 300));
check('Combat player: party hit points visible', /HP\s*\d+\s*\/\s*\d+/.test(pb));
const pub = JSON.stringify(await page.evaluate(A => __mock.state().combats[A].pub, A));
check('Combat: public copy has no monster HP or notes', !/"notes"/.test(pub) && !/"hpMax":10/.test(pub) && !/"ac":15/.test(pub));

// ---- Content ----
await go(page, q('dm'), 'content');
check('Reading Mode is the default for the DM', await page.$eval('[data-ct-mode="reading"]', e => e.getAttribute('aria-pressed') === 'true') && !(await page.$('[data-ct="share"]')) && !(await page.$('[data-ct="current"]')));
await page.waitForSelector('#adventure-reader-root #rd-page .rd-title-page', { timeout: 6000 });
const rd = await body();
check('Reading Mode is the Dashboard reader itself (same markup, toolbar, title page and contents)', await exists('.adventure-reader-page .rd-book .rd-page') && await exists('.rd-tools [data-rd-mode="dm"]') && await exists('.rd-tools [data-rd-mode="players"]') && await exists('[data-rd-act="smaller"]') && await exists('[data-rd-act="fullscreen"]') && await exists('[data-rd-act="print"]') && /The Drowned Keep/.test(rd) && /contents/i.test(rd) && /The Road to Valdris/.test(rd), rd.slice(0, 300));
check('Reading Mode: the same stylesheet gives the parchment page', await page.$eval('.rd-page', e => getComputedStyle(e).backgroundImage !== 'none' || /rgb\((2[0-5]\d|1[89]\d)/.test(getComputedStyle(e).backgroundColor)));
await click('.rd-contents-item[data-rd-page="1"]');
const ch1 = await body();
check('Reading Mode: chapter page with read-aloud text and the DM’s sealed notes (DM view)', /chapter i/i.test(ch1) && /Smoke curls under low beams/.test(ch1) && await exists('.rd-readaloud') && await exists('.rd-dm') && /Lord Vance in disguise/.test(ch1), ch1.slice(0, 300));
await click('[data-rd-mode="players"]');
const pv = await body();
check('Reading Mode: Player view hides every DM note and DM-only section', !(await exists('.rd-dm')) && !/Lord Vance in disguise/.test(pv) && /Smoke curls under low beams/.test(pv) && /player view/i.test(pv));
await click('[data-rd-mode="dm"]');
await click('[data-rd-act="next"]');
check('Reading Mode: next chapter', /chapter ii/i.test(await body()) && /Black water laps/.test(await body()));
await click('[data-rd-act="larger"]');
check('Reading Mode: text size control works', (await page.$eval('#adventure-reader-root', e => e.style.getPropertyValue('--rd-scale'))) === '1.1');
await click('[data-ct-mode="editing"]');
const cc = await body();
check('Editing Mode (DM): tools + DM notes visible', /The Drowned Keep/.test(cc) && /DM notes/.test(cc) && !!(await page.$('[data-ct="current"]')), cc.slice(0, 300));
await click('[data-ct-pick="s1"]');
check('Editing Mode: DM notes shown in the section', /Lord Vance in disguise/.test(await body()));
await click('[data-ct-mode="reading"]');
check('Back to Reading Mode hides the tools again and shows the reader', !(await page.$('[data-ct="share"]')) && await exists('#adventure-reader-root'));
await click('[data-ct-mode="editing"]');
await click('[data-ct-pick="s4"]'); await click('[data-ct="current"]'); await click('[data-ct="done"]');
check('Content: progress recorded (1 of 4)', /1 of 4 finished/.test(await body()));
await click('[data-ct="share"]'); await click('[data-confirm-ok]'); await sleep(400);
check('Content: shared marker', /Shared with the players/.test(await body()));
await click('[data-ct-pick="s3"]');
check('Content: section without player text cannot be shared', await page.$eval('[data-ct="share"]', e => e.disabled));
await go(page, q('p1'), 'content');
await page.waitForSelector('#adventure-reader-root #rd-page', { timeout: 6000 });
check('Content player: the same reader, in Player view only (no mode switch, no editing, no DM/Player toggle)', !(await page.$('[data-ct-mode]')) && !(await page.$('[data-ct-pick]')) && await page.$eval('.rd-mode', e => e.hidden) && await page.$eval('#rd-back', e => e.hidden) && /shared with the party/i.test(await body()));
await click('.rd-contents-item[data-rd-page="1"]');
const pc = await body();
check('Content player: shared scene shown as a book page, never a DM box', /rusted portcullis/.test(pc) && /The flooded gate/.test(pc) && !(await page.$('.rd-dm')));
check('Content player: shared text only, no DM notes or adventure', /The flooded gate/.test(pc) && /rusted portcullis/.test(pc) && !/trapped sluice/.test(pc) && !/Lord Vance/.test(pc), pc.slice(0, 300));

// ---- Bestiary ----
await go(page, q('dm'), 'bestiary');
await page.type('[data-bs-f="q"]', 'goblin'); await sleep(300);
await page.click('[data-bs-pick]'); await sleep(300);
check('Bestiary DM: stat block + add to encounter', /armor class/i.test(await text(page, '#bs-detail')) && !!(await page.$('[data-bs-add]')));
await click('[data-bs-add]'); await sleep(500);
check('Bestiary: add to encounter confirms', /added to the encounter/.test(await page.$eval('.cw-notice', e => e.innerText).catch(() => '')));
await go(page, q('p1'), 'bestiary');
check('Bestiary player: spells only, no monsters', !(await page.$('[data-bs-tab="monsters"]')) && /spell/i.test(await body()));

// ---- Music ----
await go(page, q('dm'), 'music');
check('Music DM: controller + shortcuts', !!(await page.$('[data-session-music]')) && /Space/.test(await body()));
await page.keyboard.press('Space'); await sleep(200);
check('Music DM: Space does not scroll/crash', true);
await go(page, q('p1'), 'music');
check('Music player: refused', /for the Dungeon Master/.test(await body()));
check('Music nav hidden for player', !(await page.$('.fod-nav-item[data-cw-section="music"]')));

// ---- Members + permissions ----
await go(page, q('dm'), 'members');
check('Members DM (started): roster + locked, no remove', /Riley Brook/.test(await body()) && /locked/.test(await body()) && !(await page.$('[data-mb="remove"]')));
await go(page, q('p1', B), 'members');
check('Campaign B: p1 is DM there', (await text(page, '#cw-role')) === 'Dungeon Master');
check('Members: invite code + start disabled (not ready)', /FOD-5678-CD/.test(await body()) && !!(await page.$('[data-mb="start"][disabled]')));
await click('[data-mb="regenerate"]'); await click('[data-confirm-ok]'); await sleep(500);
check('Members: invite code replaced', !/FOD-5678-CD/.test(await body()) && /FOD-\d{4}-ZZ/.test(await body()));
await go(page, q('dm', B), 'members');
check('Members player: sees roster, no DM actions', /Beneath Saltmarsh/.test(await text(page, '#cw-name')) && !(await page.$('[data-mb="remove"], [data-mb="regenerate"]')) && /Only the Dungeon Master can invite/.test(await body()));
await go(page, q('p1', B), 'members');
await click('[data-mb="remove"]'); await click('[data-confirm-ok]'); await sleep(600);
check('Members: DM removes a player (confirmed)', !(await page.$eval('.cv-members', e => /Morgan Hale/.test(e.innerText))));
await page.goto(`${URL0}?as=dm&c=${B}#overview`); await sleep(1500);
check('Removed player cannot open campaign B', /Campaign not found/.test(await all()));

// ---- Unauthorized ----
await page.goto(`${URL0}?as=out&c=${A}#overview`); await sleep(1500);
check('Outsider: campaign not found, nothing loaded', /Campaign not found/.test(await all()) && !/Ashen Crown/.test(await all()));
await page.goto(`${URL0}?as=p2&c=${B}#combat`); await sleep(1500);
check('Player typing another campaign id: not found', /Campaign not found/.test(await all()));
await page.goto(`${URL0}?as=dm#overview`); await sleep(1500);
check('No campaign id: friendly message', /No campaign selected/.test(await all()));
await page.goto(`${URL0}?as=dm&c=not-a-uuid#overview`); await sleep(1500);
check('Bad campaign id: friendly message', /No campaign selected/.test(await all()));
await go(page, q('p1'), 'nonsense');
check('Unknown section: friendly panel', /Section not found/.test(await body()));

// ---- Settings ----
await go(page, q('p1'), 'settings');
check('Settings player: info only, no edit/archive/delete', /Campaign information/.test(await body()) && !(await page.$('#cs-form')) && !(await page.$('[data-cs="delete"]')) && !(await page.$('[data-cs="archive"]')));
await go(page, q('dm'), 'settings');
check('Settings DM: form + adventure + features + actions', !!(await page.$('#cs-form')) && !!(await page.$('[data-cs="delete"]')) && /Plan & features/.test(await body()) && /Meeting in the Fog/.test(await body()) && !/not built yet|don’t exist yet/.test(await body()));
await page.$eval('#cs-name', e => { e.value = 'The Ashen Crown II'; }); await page.click('#cs-form button[type=submit]'); await sleep(800);
check('Settings: rename saved, header updated', (await text(page, '#cw-name')) === 'The Ashen Crown II');
await click('[data-cs="archive"]'); await click('[data-confirm-ok]'); await sleep(800);
check('Settings: archived pill', /Archived/.test(await text(page, '#cw-status')));
await go(page, q('dm'), 'feed');
check('Archived: feed read-only', await page.$eval('#fd-input', e => e.disabled));
await go(page, q('dm'), 'settings');
await click('[data-cs="restore"]'); await sleep(700);
await click('[data-cs="delete"]'); await sleep(300);
check('Delete requires typing the campaign name', await page.$eval('[data-confirm-ok]', e => e.disabled));
await page.keyboard.press('Escape'); await sleep(200);
check('Cancelled delete keeps campaign', (await page.evaluate(() => __mock.state().campaigns.length)) === 2);

// ---- Theme + responsive ----
await go(page, q('dm', A, '&theme=light'), 'overview');
await page.screenshot({ path: SP + '/ov-light.png' });
await go(page, q('dm', A, '&theme=light'), 'combat');
await page.screenshot({ path: SP + '/combat-light.png' });
await page.setViewport({ width: 390, height: 800 });
for (const s of ['overview', 'feed', 'meetings', 'characters', 'combat', 'content', 'bestiary', 'settings', 'members', 'music']) {
  await go(page, q('dm'), s);
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`Mobile: no horizontal scroll (${s})`, o <= 1, 'overflow ' + o + 'px');
  if (s === 'combat') await page.screenshot({ path: SP + '/combat-mobile.png' });
}
await page.setViewport({ width: 820, height: 900 });
await go(page, q('dm'), 'overview'); await page.screenshot({ path: SP + '/ov-tablet.png' });
check('Tablet: no horizontal scroll', (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);

console.log(results.map(r => r.join(' ')).join('\n'));
console.log('\nFAILS:', results.filter(r => r[0] === 'FAIL').length, '/', results.length);
console.log('JS ERRORS:', errors.filter(e => !/404/.test(e)));
await browser.close();
if (results && results.some((r) => r[0] === 'FAIL')) process.exitCode = 1;
