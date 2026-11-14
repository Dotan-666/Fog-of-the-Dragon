/** Browser test (see lib.mjs for setup): the session experience on the campaign harness — contextual Back (in-app links,
 * browser Back/Forward, direct-URL fallbacks, preserved state), Start/Continue session, encounters → Combat, automatic
 * resolution and Full Auto monster turns, results in the Logbook (players never see DM notes), the shared map with token
 * permissions, and Foggy+ session preparation (only real resources; tabs from one click). */
import { open, go, A, SHOTS, text } from './lib.mjs';
const { browser, page, errors } = await open({ w: 1366, h: 1000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (name, cond, extra = '') => res.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 300)]);
const run = async (name, fn) => { try { await fn(); } catch (e) { check(name + ' (crashed)', false, e.stack || e.message); } };
const q = (as, extra = '') => `as=${as}&c=${A}${extra}`;
const has = (sel) => page.$(sel).then((x) => !!x);
const tap = async (sel, ms = 350) => { await page.$eval(sel, (b) => b.click()); await sleep(ms); };
const hash = () => page.evaluate(() => decodeURIComponent(location.hash));
const state = () => page.evaluate(() => __mock.state());
const bar = () => page.$eval('.cw-return', (e) => (e.hidden ? '' : e.innerText)).catch(() => '');
const waitHash = (re, t = 6000) => page.waitForFunction((s) => new RegExp(s).test(decodeURIComponent(location.hash)), { timeout: t }, re.source);
const setVal = async (sel, v) => { await page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, String(v)); await sleep(250); };

// Seed an encounter in the adventure (stored by the adventure stand-in) before the first load.
const seedEncounter = () => page.evaluate(() => __mock.setAdventureContent({ encounters: [{ id: 'e1', name: 'Ambush at the ford', intro: 'Arrows from the reeds!', description: '', difficulty: 'Low', monsters: [{ ref: 'srd:goblin-warrior', name: 'Goblin Warrior', count: 2 }], npcs: [], mapAssetId: null, musicRef: null, rewards: '12 gp', dmNotes: 'The leader flees at half HP.', triggers: '', chapterId: 'ch1', sectionId: 's3', autoMode: 'auto' }] }));

// ------------------------------------------------------------------------------------------------------------------------
await run('nav: adventure → monster → back', async () => {
  await go(page, q('dm', '&reset=1&dmplan=fogger-of-the-dragons'), 'content/s3');
  await seedEncounter();
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'content/s3');
  await page.waitForSelector('#ct-enc .enc-item', { timeout: 15000 });
  check('Encounters: the adventure’s encounter is listed with Start encounter (DM)', /Ambush at the ford/.test(await text(page, '#ct-enc')) && await has('[data-enc-act="start"]'));
  check('Referenced monster: an in-app link (same tab) plus an OPTIONAL ↗ new-tab link', await has('#ct-enc a.cw-ref-in') && await page.$eval('#ct-enc a.cw-ref-in', (a) => !a.target) && await page.$eval('#ct-enc a.cw-newtab', (a) => a.target === '_blank' && /tab=1/.test(a.href)));
  await page.evaluate(() => window.scrollTo(0, 200));
  await tap('#ct-enc a.cw-ref-in', 900);
  await waitHash(/^#bestiary\/monster\//);
  check('Monster opens in the Bestiary of the same tab, with the origin in the address', /from=content\/s3/.test(await hash()), await hash());
  check('“← Back to The Drowned Keep” is shown', /Back to The Drowned Keep/.test(await bar()), await bar());
  check('The monster’s stat block is shown', /Goblin Warrior/.test(await text(page, '#bs-detail')));
  await tap('.cw-return [data-fog-back]', 1200);
  check('Back returns to the exact adventure section', (await hash()) === '#content/s3', await hash());
  await page.waitForSelector('#ct-enc .enc-item', { timeout: 15000 });
  check('… with the Encounters card still open', await page.$eval('#ct-enc-card', (d) => d.open));
  await page.goForward(); await sleep(1200);
  check('Browser Forward goes to the monster again (with its Back bar)', /^#bestiary\/monster\//.test(await hash()) && /Back to The Drowned Keep/.test(await bar()), await hash());
  await page.goBack(); await sleep(1200);
  check('Browser Back returns to the adventure', (await hash()) === '#content/s3', await hash());
});

await run('nav: direct URL fallback', async () => {
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'bestiary/monster/does-not-exist');
  check('Direct link: sensible fallback “← Back to Monsters & Spells”', /Back to Monsters & Spells/.test(await bar()), await bar());
  check('Direct link to a missing monster says so (nothing invented)', /isn’t in the bestiary/.test(await text(page, '#bs-status')));
  await tap('.cw-return [data-fog-back]', 900);
  check('Fallback Back goes to the Bestiary list', (await hash()) === '#bestiary', await hash());
  await go(page, q('dm'), 'overview');
  check('Top-level sections have no Back bar', !(await bar()));
});

await run('nav: bestiary filters survive', async () => {
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'bestiary');
  await page.type('#bs-filters [data-bs-f="q"]', 'dragon'); await sleep(300);
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'overview');
  await page.evaluate(() => { location.hash = 'bestiary'; }); await sleep(1500);
  check('Bestiary: the search is still there after leaving and coming back', (await page.$eval('#bs-filters [data-bs-f="q"]', (e) => e.value)) === 'dragon');
});

await run('nav: character → spell → back', async () => {
  await go(page, q('dm'), 'characters');
  const btns = await page.$$('[data-ch="details"]');
  let found = false;
  for (const b of btns) {
    await b.click(); await sleep(400);
    if (await has('dialog[open] a.cw-ref-in')) { found = true; break; }
    await page.keyboard.press('Escape'); await sleep(200);
  }
  check('Character details list the spells as links', found);
  if (found) {
    const who = await page.$eval('dialog[open] .cw-dialog-title', (e) => e.innerText);
    await tap('dialog[open] a.cw-ref-in', 1200);
    check('Spell opens in the Bestiary with “← Back to <character>”', /^#bestiary\/spell\//.test(await hash()) && new RegExp('Back to ' + who).test(await bar()), (await hash()) + ' | ' + (await bar()));
    await tap('.cw-return [data-fog-back]', 1500);
    check('Back returns to that character with the details open again', /^#characters\//.test(await hash()) && await has('dialog[open]'), await hash());
    await page.keyboard.press('Escape'); await sleep(200);
  }
});

await run('nav: music → track → back', async () => {
  await go(page, q('dm'), 'music');
  await page.evaluate(() => { const r = FogMusicStore.createPlaylist('Session test'); return r; });
  await go(page, q('dm'), 'music');
  await tap('[data-cm="pl-open"]', 400);
  await page.type('#cm-search', 'tavern'); await sleep(400);
  const link = await has('.cw-lib a.cw-ref-in');
  check('Music library: tracks link to their details', link);
  if (link) {
    await tap('.cw-lib a.cw-ref-in', 1200);
    check('Track details: license and source, “← Back to Music”', /^#music\/track\//.test(await hash()) && /license/i.test(await text(page, '#campaign-content')) && /Back to Music/.test(await bar()), await hash());
    await tap('.cw-return [data-fog-back]', 1500);
    check('Back to Music keeps the open playlist and the search', (await hash()) === '#music' && (await page.$eval('#cm-search', (e) => e.value).catch(() => '')) === 'tavern');
  }
});

// ------------------------------------------------------------------------------------------------------------------------
await run('session: start / continue', async () => {
  await go(page, q('p1'), 'overview');
  check('Players: no session controls on the Overview', !(await has('.cw-session-card')));
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'overview');
  await page.waitForSelector('.cw-session-card [data-ss="start"]', { timeout: 8000 });
  check('Nothing is created when the Overview loads', (await state()).sessions.length === 0);
  check('DM: “Start session 1”, Foggy+ preparation and Meeting in the Fog', /Start session 1/.test(await text(page, '.cw-session-card')) && await has('.cw-session-card a[href="#foggy/prepare"]') && await has('.cw-session-card [data-ss="feed"]'));
  await tap('.cw-session-card [data-ss="start"]', 1500);
  check('Start opens the adventure with “← Back to the Overview”', /^#content/.test(await hash()) && /Back to the Overview/.test(await bar()), await hash());
  check('One active session exists', (await state()).sessions.filter((s) => s.status === 'active').length === 1);
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'overview');
  await page.waitForSelector('.cw-session-card [data-ss="continue"]', { timeout: 8000 });
  check('Overview now offers “Continue the session” (no duplicate)', /Continue the session/.test(await text(page, '.cw-session-card')));
  const again = await page.evaluate(async (A) => (await FogCampaignData.startSession(A, null, null)).id, A);
  check('Starting again resumes the same session', again === (await state()).sessions[0].id && (await state()).sessions.length === 1);
});

// ------------------------------------------------------------------------------------------------------------------------
await run('encounter → combat → full auto', async () => {
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'content/s3');
  await page.waitForSelector('[data-enc-act="start"]', { timeout: 15000 });
  await tap('[data-enc-act="start"]', 2500);
  check('Start encounter goes to Combat with “← Back to the adventure”', /^#combat/.test(await hash()) && /Back to the adventure/.test(await bar()), await hash());
  const e0 = (await state()).combats[A].state;
  check('Combat is prepared: the party and 2 Goblin Warriors from the stat block; the source is remembered', e0.combatants.filter((c) => /Goblin Warrior/.test(c.name)).length === 2 && e0.combatants.some((c) => c.kind === 'pc') && e0.source && e0.source.encounterId === 'e1' && e0.autoMode === 'auto');
  check('Session position follows the encounter', (await state()).sessions[0].position.encounterId === 'e1');
  check('Banner: from the adventure, a Map button and the monster-turn mode (Full Auto)', /From The Drowned Keep/.test(await text(page, '.cw-encbanner')) && await has('.cw-encbanner a[href="#map"]') && (await page.$eval('[data-cb="automode"]', (s) => s.value)) === 'auto');
  // initiative: goblins first, then the party
  const ids = await page.evaluate(() => [...document.querySelectorAll('.cw-row[data-id]')].map((r) => [r.dataset.id, r.innerText.split('\n')[0]]));
  for (const [id] of ids) { const isGob = (await state()).combats[A].state.combatants.find((c) => c.id === id).kind === 'monster'; await setVal(`#ini-${id}`, isGob ? 20 : 5); }
  await tap('[data-cb="start"]', 600);
  await page.waitForFunction(() => /Foggy plays/.test(document.querySelector('.cw-log') ? document.querySelector('.cw-log').innerText : ''), { timeout: 12000 }).catch(() => {});
  await sleep(4500);
  const e1 = (await state()).combats[A].state;
  const logs = e1.log.map((l) => l.text).join('\n');
  check('Full Auto: Foggy played the goblin’s turn from its real actions, against AC or a save DC', /🤖 Foggy plays Goblin Warrior/.test(logs) && /(vs AC \d+|DC \d+)/.test(logs), logs.slice(-600));
  check('Full Auto: each turn is claimed once (no duplicate attacks)', (logs.match(/🤖 Foggy plays Goblin Warrior 1/g) || []).length === 1);
  const cur = e1.combatants.find((c) => c.id === e1.turnId);
  check('Full Auto: stops at a player character’s turn (never plays PCs)', cur && cur.kind === 'pc', cur && cur.name);
});

await run('auto resolve + end → result in the session', async () => {
  // The DM resolves a PC attack with one click (AC check), then ends the combat.
  await tap('.cw-act [data-cb="act"]', 300).catch(() => {});
  if (await has('.cw-act.is-flow [data-cb="target"]')) {
    const tid = await page.$eval('.cw-act.is-flow [data-cb="target"]', (e) => e.value);
    await page.$eval(`[data-cb="target"][value="${tid}"]`, (e) => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(300);
    if (await has('[data-cb="auto-resolve"]')) {
      await tap('[data-cb="auto-resolve"]', 3500);
      check('Roll & resolve: the d20 is rolled and hit/miss decided against the AC (DM can still edit)', /to hit/.test(await text(page, '.cw-act')) && await page.$$eval('[data-cb="hitsel"]', (l) => l.every((s) => s.value !== '')));
    }
    await tap('[data-cb="flow-cancel"]').catch(() => {});
  }
  await page.evaluate(() => { window.__confirmYes = true; });
  await tap('[data-cb="end"]', 400);
  await tap('dialog[open] [data-confirm-ok]', 2000);
  const s = (await state()).sessions[0];
  check('End combat records the result in the active session', s.results.length === 1 && s.results[0].encounterId === 'e1' && s.results[0].rounds >= 1, JSON.stringify(s.results));
  check('The player-readable result has no DM log or hidden creatures', !('logTail' in s.results[0]) && !JSON.stringify(s.results[0]).includes('🤖'));
  const notes = (await state()).sessionNotes[s.id];
  check('The combat log goes to the DM-only session notes', notes && notes.details.combat && Object.values(notes.details.combat)[0].log.length > 0);
});

// ------------------------------------------------------------------------------------------------------------------------
await run('logbook sessions + foggy recap', async () => {
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'logbook/sessions');
  await page.waitForSelector('.ls-session', { timeout: 8000 });
  check('Logbook → Sessions: session 1 with its encounter result', /Session 1/.test(await text(page, '.ls-session')) && /Ambush at the ford/.test(await text(page, '.ls-session')));
  await page.$eval('.ls-dm', (d) => { d.open = true; d.dispatchEvent(new Event('toggle')); }); await sleep(800);
  await page.waitForSelector('[data-ls-form] textarea[name="notes"]', { timeout: 5000 });
  await page.type('[data-ls-form] textarea[name="notes"]', 'The party crossed the ford. Secret: the leader works for Vance.');
  await page.type('[data-ls-form] textarea[name="d_npcs"]', 'Mara the ferrywoman');
  await tap('[data-ls-form] button[type="submit"]', 800);
  const s = (await state()).sessions[0];
  check('DM notes are saved privately (session notes)', /crossed the ford/.test((await state()).sessionNotes[s.id].notes) && (await state()).sessionNotes[s.id].details.npcs === 'Mara the ferrywoman');
  await page.$eval('.ls-dm', (d) => { d.open = true; d.dispatchEvent(new Event('toggle')); }); await sleep(500);
  await tap('[data-ls="foggy"]', 1500);
  check('Foggy drafts are shown for review first (nothing saved yet)', await has('dialog[open] textarea[name="r_happened"]') && !(await state()).memories.some((m) => m.sessionId === s.id));
  await tap('dialog[open] button[type="submit"]', 1200);
  const mem = (await state()).memories.find((m) => m.sessionId === s.id);
  check('After approval: the player recap is a DRAFT memory linked to the session; DM summary in the notes', mem && mem.status === 'draft' && mem.kind === 'recap' && /DM view/.test((await state()).sessionNotes[s.id].details.dmSummary || ''));
  await go(page, q('p1'), 'logbook/sessions');
  await page.waitForSelector('.ls-session', { timeout: 8000 });
  const pv = await text(page, '#campaign-content');
  check('Players see the session and its result', /Session 1/.test(pv) && /Ambush at the ford/.test(pv));
  check('Players never see DM notes, the draft recap or secrets', !/DM notes/.test(pv) && !/Secret/.test(pv) && !/From the notes/.test(pv) && !(await has('.ls-dm')));
});

// ------------------------------------------------------------------------------------------------------------------------
await run('map: share, tokens, permissions', async () => {
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'map');
  const pub = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 240; const g = c.getContext('2d'); g.fillStyle = '#4a6'; g.fillRect(0, 0, 400, 240);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'ford.png', { type: 'image/png' });
    const cb = await FogCampaignData.getCombat(FogCampaign.id, true);
    return FogCampaignMaps.publishFile({ id: FogCampaign.id }, file, { key: 'test-ford', title: 'The ford', grid: { cols: 10, rows: 6 }, combat: cb.encounter, show: true });
  });
  check('DM: a map is shared with tokens from Combat and shown to everyone', pub.ok && (await state()).maps.length === 1 && (await state()).maps[0].tokens.length >= 3, JSON.stringify(pub));
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'map');
  check('DM view: board with grid and tokens; “On screen for everyone”', await has('#mp-board .mp-grid') && (await page.$$('.mp-token')).length >= 3 && /On screen for everyone/.test(await text(page, '.mp-tools')));
  // hide a goblin
  const gob = await page.$$eval('.mp-token.is-monster', (l) => l[0].dataset.token);
  await page.$eval(`.mp-token[data-token="${gob}"]`, (b) => { b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 5, clientY: 5 })); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 5, clientY: 5 })); });
  await sleep(400);
  await tap('dialog[open] [data-tk="toggle"]', 900);
  check('DM: a hidden token moves to the DM-only list', (await state()).mapHidden[(await state()).maps[0].id].some((t) => t.id === gob));
  await go(page, q('p1'), 'map');
  await page.waitForSelector('#mp-board', { timeout: 6000 });
  check('Player: sees the shown map and the visible tokens, not the hidden one', (await page.$$('.mp-token')).length >= 2 && !(await has(`.mp-token[data-token="${gob}"]`)));
  check('Player: cannot move tokens until the DM allows it', !(await has('.mp-token.is-movable')) && /Dungeon Master moves the tokens/.test(await text(page, '#campaign-content')));
  const denied = await page.evaluate(async () => { const m = (await FogCampaignData.getMaps(FogCampaign.id)).maps[0]; const t = m.tokens.find((x) => x.userId === 'u-p1'); return FogCampaignData.moveToken(m.id, t.id, 3, 3); });
  check('Player: moving is refused by the data layer too', !denied.ok);
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'map');
  await page.$eval('[data-mp="players-move"]', (e) => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(600);
  await go(page, q('p1'), 'map');
  await page.waitForSelector('.mp-token.is-mine', { timeout: 6000 });
  check('Player: only their own token is movable once allowed', (await page.$$('.mp-token.is-movable')).length === 1 && await has('.mp-token.is-mine.is-movable'));
  const box = await page.$eval('#mp-board', (b) => { const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const tk = await page.$eval('.mp-token.is-mine', (b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(tk.x, tk.y); await page.mouse.down(); await page.mouse.move(box.x + box.w * 0.55, box.y + box.h * 0.55, { steps: 6 }); await page.mouse.up(); await sleep(900);
  const mine = (await state()).maps[0].tokens.find((t) => t.userId === 'u-p1');
  check('Player: dragging their token moves it (snapped to the grid) for everyone', mine.x === 5 && mine.y === 3, JSON.stringify(mine));
  const other = await page.evaluate(async () => { const m = (await FogCampaignData.getMaps(FogCampaign.id)).maps[0]; const t = m.tokens.find((x) => x.kind === 'monster'); return FogCampaignData.moveToken(m.id, t.id, 1, 1); });
  check('Player: moving someone else’s token is refused', !other.ok);
});

// ------------------------------------------------------------------------------------------------------------------------
await run('foggy+ prepare', async () => {
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons&foggyaccess=plus'), 'foggy/prepare');
  await page.waitForSelector('[data-sp="ask"]', { timeout: 15000 });
  const t0 = await text(page, '#cw-prep-root');
  check('Prepare: where the adventure stands, what was found, what is missing', /Where the adventure stands/.test(t0) && /Ambush at the ford/.test(t0) && /Missing or worth preparing/.test(t0) && /has no map/.test(t0));
  await tap('[data-sp="ask"]', 1500);
  const t1 = await text(page, '#cw-prep-root');
  check('Foggy’s summary is shown; an invented resource was dropped (and said so)', /Foggy’s summary/.test(t1) && /don’t exist in your campaign/.test(t1) && !/beholder/i.test(t1));
  await page.evaluate(() => { window.__opened = []; let n = 0; window.open = (u) => { window.__opened.push(u); n++; return n === 2 ? null : { opener: 1 }; }; });
  await tap('[data-sp="open"]', 600);
  const opened = await page.evaluate(() => window.__opened);
  check('Open in tabs: one click, each page once, campaign links with a way back', opened.length >= 2 && new Set(opened).size === opened.length && opened.every((u) => /campaign\.html\?c=/.test(u) && /from=foggy/.test(u)), opened.join(' '));
  check('A blocked tab is listed to open by hand', /blocked 1/.test(await text(page, '#cw-prep-root')));
  check('Preparing started nothing (no new session, no combat change)', (await state()).sessions.length === 1);
});

await page.screenshot({ path: SHOTS + '/session-experience.png' });
const bad = errors.filter((e) => !/favicon|FOD\.jpg|Failed to load resource/.test(e));
check('No page errors', !bad.length, bad.join(' | '));
for (const r of res) console.log(r[0], r[1], r[2]);
const fails = res.filter((r) => r[0] === 'FAIL').length;
console.log('FAILS:', fails, '/', res.length);
await browser.close();
process.exit(fails ? 1 : 0);
