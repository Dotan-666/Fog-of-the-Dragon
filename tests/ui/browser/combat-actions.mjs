/** Browser test (see lib.mjs for setup): the Combat redesign on the campaign harness — monster attacks from real stat blocks,
 * saves, critical hits, Play manually, Foggy suggestions (never applied by themselves), player attack requests the DM applies,
 * permissions, Basic/Advanced and DM-only information. */
import { open, go, A, SHOTS, text } from './lib.mjs';
const { browser, page, errors } = await open({ w: 1366, h: 1000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (name, cond, extra = '') => res.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 300)]);
const run = async (name, fn) => { try { await fn(); } catch (e) { check(name + ' (crashed)', false, e.stack || e.message); } };
const q = (as, extra = '') => `as=${as}&c=${A}${extra}`;
const has = (sel) => page.$(sel).then((x) => !!x);
const tap = async (sel, ms = 300) => { await page.$eval(sel, (b) => b.click()); await sleep(ms); };
const setVal = async (sel, v) => { await page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, String(v)); await sleep(250); };
const rowId = (name) => page.evaluate((n) => [...document.querySelectorAll('.cw-row[data-id]')].find((r) => r.innerText.includes(n)).dataset.id, name);
const hp = (id) => page.$eval(`.cw-row[data-id="${id}"] .cw-row-vitals .cw-hp strong`, (e) => Number(e.innerText));
const logText = () => text(page, '.cw-log').catch(() => '');
const enc = () => page.evaluate((A) => __mock.state().combats[A].state, A);

let ids = {};
await run('setup', async () => {
  await go(page, q('dm', '&reset=1&dmplan=fogger-of-the-dragons'), 'combat');
  await page.waitForSelector('[data-cb="new"]', { timeout: 15000 });
  await tap('[data-cb="new"]'); await tap('[data-cb="addparty"]');
  await page.type('#cb-search', 'goblin warrior'); await sleep(300); await tap('[data-cb="addmonster"]');
  await page.$eval('#cb-search', (e) => { e.value = ''; });
  await page.type('#cb-search', 'red dragon wyrmling'); await sleep(300); await tap('[data-cb="addmonster"]');
  for (const [n, v] of [['Goblin', 20], ['Wyrmling', 18], ['Brienne', 15], ['Tobias', 12]]) { const id = await rowId(n); ids[n] = id; await setVal(`#ini-${id}`, v); }
  await tap('[data-cb="start"]', 500);
  check('Setup: the goblin acts first and its panel shows ONLY its real attacks (Scimitar, Shortbow) as labelled buttons', /Goblin/.test(await text(page, '.cw-act-name')) && (await page.$$eval('.cw-act [data-cb="act"] strong', (l) => l.map((x) => x.innerText))).join(',') === 'Scimitar,Shortbow' && !(await has('[data-cb="dmg"]')));
  check('Setup: each action says how it works (bonus, reach, damage)', /\+4 to hit · reach 5 ft · 1d6\+2 Slashing/.test(await text(page, '.cw-act')));
});

await run('monster-attack', async () => {
  const before = await hp(ids.Brienne);
  await tap('.cw-act [data-cb="act"]');
  check('Attack workflow: 1. target 2. attack roll, with the attack’s text', await has('.cw-act.is-flow [data-cb="target"]') && /Scimitar/.test(await text(page, '.cw-flow-title')) && await has('[data-cb="roll-attack"]'));
  check('Attack workflow: Apply stays disabled until it is resolved', await page.$eval('[data-cb="apply"]', (b) => b.disabled));
  await page.$eval(`[data-cb="target"][value="${ids.Brienne}"]`, (e) => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(250);
  await setVal('[data-cb="d20"]', 15);
  const step = await text(page, '.cw-act');
  check('Attack: 15 + 4 = 19 to hit, compared with Brienne’s AC 16 → Hit', /19.*to hit/.test(step) && (await page.$eval(`[data-cb="hitsel"][data-target="${ids.Brienne}"]`, (s) => s.value)) === '1', step.slice(0, 400));
  check('Attack: damage dice from the stat block (1d6+2 + 1d4)', /Roll 1d6\+2 \+ 1d4/.test(step));
  await setVal('[data-cb="dmgtotal"]', 6);
  await tap('[data-cb="apply"]', 400);
  check('Attack applied: Brienne loses 6 hit points', (await hp(ids.Brienne)) === before - 6, await hp(ids.Brienne));
  check('Attack applied: the log says who attacked whom, the roll vs AC, hit and damage', /Goblin Warrior attacks Brienne Ashford with Scimitar: 19 vs AC 16 — hit, 6 Slashing damage./.test(await logText()), await logText());
  // a miss
  await tap('.cw-act [data-cb="act"]');
  await page.$eval(`[data-cb="target"][value="${ids.Tobias}"]`, (e) => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(250);
  await setVal('[data-cb="d20"]', 3);
  check('Miss: 7 vs AC 12 is a miss, chosen automatically', (await page.$eval(`[data-cb="hitsel"][data-target="${ids.Tobias}"]`, (s) => s.value)) === '0');
  const t0 = await hp(ids.Tobias);
  await setVal('[data-cb="dmgtotal"]', 5);
  await tap('[data-cb="apply"]', 400);
  check('Miss: no damage applied, and the log says miss', (await hp(ids.Tobias)) === t0 && /Tobias Vell with Scimitar: 7 vs AC 12 — miss/.test(await logText()));
  // a critical hit doubles the dice
  await tap('.cw-act [data-cb="act"]');
  await page.$eval(`[data-cb="target"][value="${ids.Tobias}"]`, (e) => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(250);
  await setVal('[data-cb="d20"]', 20);
  const crit = await text(page, '.cw-act');
  check('Critical hit on a natural 20: labelled, damage dice doubled (2d6+2 + 2d4)', /critical hit/i.test(crit) && /Roll 2d6\+2 \+ 2d4/.test(crit), crit.slice(0, 400));
  await tap('[data-cb="flow-cancel"]');
  check('Cancel: nothing changed', (await hp(ids.Tobias)) === t0);
});

await run('manual', async () => {
  await tap('.cw-act [data-cb="manual"]');
  check('Play manually: action, targets, an optional roll, result, condition, note', await has('[data-cb="man-action"]') && await has('[data-cb="man-dice"]') && await has('[data-cb="man-amount"]') && await has('[data-cb="man-cond"]'));
  await page.type('[data-cb="man-name"]', 'Shove');
  await page.$eval(`[data-cb="target"][value="${ids.Tobias}"]`, (e) => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(250);
  await page.select('[data-cb="man-cond"]', 'Prone'); await sleep(100);
  await page.type('[data-cb="man-note"]', 'Tobias falls over');
  await tap('[data-cb="man-apply-end"]', 500);
  const e = await enc();
  const tob = e.combatants.find((c) => c.id === ids.Tobias);
  check('Play manually: the condition is applied, the log records it, and the turn ends', tob.conditions.includes('Prone') && /Goblin Warrior uses Shove on Tobias Vell — Tobias falls over/.test(await logText()) && e.turnId === ids.Wyrmling, JSON.stringify([tob.conditions, e.turnId]));
});

await run('save', async () => {
  check('Next up: the wyrmling, with its Rend attack and Fire Breath save', /Wyrmling/.test(await text(page, '.cw-act-name')) && /Fire Breath/.test(await text(page, '.cw-act')) && /DC 13 Dexterity save/.test(await text(page, '.cw-act')));
  const b0 = await hp(ids.Brienne), t0 = await hp(ids.Tobias);
  await tap('.cw-act [data-cb="act"][data-action*="fire-breath"]');
  check('Area save: several targets can be chosen (checkboxes)', (await page.$eval('[data-cb="target"]', (e) => e.type)) === 'checkbox');
  for (const id of [ids.Brienne, ids.Tobias]) await page.$eval(`[data-cb="target"][value="${id}"]`, (e) => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(300);
  await setVal(`[data-cb="save"][data-target="${ids.Brienne}"]`, 9);
  await setVal(`[data-cb="save"][data-target="${ids.Tobias}"]`, 16);
  check('Saves: failure and success shown against DC 13', /Failure/.test(await text(page, '.cw-act')) && /Success/.test(await text(page, '.cw-act')));
  await setVal('[data-cb="dmgtotal"]', 20);
  check('Saves: full damage on a failure, half on a success (from the stat block)', (await page.$eval(`[data-cb="pertarget"][data-target="${ids.Brienne}"]`, (e) => e.value)) === '20' && (await page.$eval(`[data-cb="pertarget"][data-target="${ids.Tobias}"]`, (e) => e.value)) === '10');
  await tap('[data-cb="apply"]', 400);
  check('Saves applied to both targets and logged', (await hp(ids.Brienne)) === Math.max(0, b0 - 20) && (await hp(ids.Tobias)) === t0 - 10 && /Tobias Vell succeeds on a DC 13 Dexterity save \(16\)/.test(await logText()));
});

await run('foggy', async () => {
  const before = JSON.stringify((await enc()).combatants.map((c) => c.hp));
  const logBefore = (await enc()).log.length;
  await tap('.cw-act [data-cb="ask-foggy"]', 600);
  const adv = await text(page, '.cw-advice');
  check('Ask Foggy: a suggestion using the creature’s real action and a real target', /Foggy suggests: Rend → (Brienne Ashford|Tobias Vell)/.test(adv), adv);
  const sent = await page.evaluate(() => __foggyCalls[__foggyCalls.length - 1].body.payload.state);
  check('Ask Foggy: only this creature’s actions and the visible combat were sent (the server checks again)', sent.actor.actions.some((a) => a.name === 'Rend') && sent.others.length >= 3 && !JSON.stringify(sent).includes('dmNotes'));
  check('Ask Foggy: nothing was applied by asking', JSON.stringify((await enc()).combatants.map((c) => c.hp)) === before && (await enc()).log.length === logBefore);
  await tap('[data-cb="use-advice"]', 400);
  check('Prepare this action: the workflow opens with Foggy’s action and target pre-filled; the DM still rolls and applies', /Rend/.test(await text(page, '.cw-flow-title')) && (await page.$$('[data-cb="target"]:checked')).length === 1 && await page.$eval('[data-cb="apply"]', (b) => b.disabled));
  await tap('[data-cb="flow-cancel"]');
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons&foggy=invent'), 'combat');
  await page.waitForSelector('.cw-act', { timeout: 15000 });
  await tap('.cw-act [data-cb="ask-foggy"]', 600);
  check('An invented ability is ignored and said so; nothing to prepare', /doesn’t have, so it was ignored/.test(await text(page, '.cw-advice')) && !(await has('[data-cb="use-advice"]')));
});

await run('advanced', async () => {
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'combat');
  await page.waitForSelector('.cw-act', { timeout: 15000 });
  const basicLines = await page.$$eval('.cw-log li', (l) => l.length);
  await tap('[data-cb="view"][data-view="advanced"]');
  const advLines = await page.$$eval('.cw-log li', (l) => l.length);
  check('Basic shows the last few log lines; Advanced the whole log, temp HP and hiding; same encounter', basicLines <= 4 && advLines > basicLines && await has('[data-cb="temp"]') && await has('[data-cb="hide"]'));
  await tap('[data-cb="view"][data-view="basic"]');
  // move to Brienne's turn for the player test
  await tap('.cw-act [data-cb="next"]', 500);
  check('End turn from the actions panel moves to Brienne', (await enc()).turnId === ids.Brienne);
});

await run('player', async () => {
  await go(page, q('p1'), 'combat');
  await page.waitForSelector('.cw-act', { timeout: 15000 });
  const panel = await text(page, '.cw-act');
  check('Player: on their turn, their own attacks from the character sheet', /Brienne/.test(await text(page, '.cw-act-name')) && /Greatsword/.test(panel) && !(await page.$eval('.cw-act [data-cb="act"]', (b) => b.disabled)));
  check('Player: no DM overrides, no monster stat blocks', !(await has('[data-cb="reduce"]')) && !/Scimitar|Fire Breath/.test(panel));
  await tap('.cw-act [data-cb="act"]');
  const flowText = await text(page, '.cw-act');
  check('Player: targets show no monster AC or hit points (DM-only)', !/AC 15|AC 17/.test(flowText) && !/10 \/ 10|75/.test(flowText), flowText.slice(0, 300));
  await page.$eval(`[data-cb="target"][value="${ids.Goblin}"]`, (e) => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(250);
  await setVal('[data-cb="d20"]', 12);
  await setVal('[data-cb="dmgtotal"]', 9);
  check('Player: the hit is decided by the DM (AC hidden)', /The DM checks it against the AC/.test(await text(page, '.cw-act')));
  await tap('[data-cb="send"]', 500);
  const reqs = await page.evaluate(() => __fogCombatMock.requests());
  check('Player: the attack is SENT to the DM (a request), not applied', reqs.length === 1 && reqs[0].status === 'pending' && reqs[0].action.attackTotal === 17 && /Waiting for the DM/.test(await text(page, '.cw-act')));
  // a duplicate (same client key) is not created twice; another character can't be used; out of turn is refused
  const dup = await page.evaluate((r) => FogCampaignData.submitCombatRequest(r.campaignId, { clientKey: r.clientKey, attackerId: r.attackerId, targetIds: r.targetIds, action: r.action }), reqs[0]);
  const other = await page.evaluate((ids) => FogCampaignData.submitCombatRequest(window.FogCampaign.id, { clientKey: 'abcdefgh12345', attackerId: ids.Tobias, targetIds: [ids.Goblin], action: { name: 'Sneaky' } }), ids);
  check('Player: duplicate sends make one request; another player’s character is refused', dup.ok && (await page.evaluate(() => __fogCombatMock.requests().length)) === 1 && !other.ok && /your own character/.test(other.message));
  // DM applies
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons'), 'combat');
  await page.waitForSelector('.cw-requests', { timeout: 15000 });
  const g0 = await hp(ids.Goblin);
  check('DM: the request is waiting, flagged in the DM toolbar, with the roll pre-checked against the AC (17 vs 15 → hit)', /1 player attack waiting/.test(await text(page, '.cw-dmbar')) && /Brienne Ashford uses Greatsword on Goblin Warrior/.test(await text(page, '.cw-requests')) && (await page.$eval(`[data-req-hit="${ids.Goblin}"]`, (s) => s.value)) === '1');
  await tap('[data-cb="req-apply"]', 500);
  check('DM applied it: the goblin takes the 9 damage and the log says it came from the player', (await enc()).combatants.find((c) => c.id === ids.Goblin).hp === Math.max(0, g0 - 9) && /\(sent by the player\)/.test(await logText()) && !(await has('.cw-requests')));
  const again = await page.evaluate((id) => FogCampaignData.decideCombatRequest(id, 'applied'), reqs[0].id);
  check('Applying twice (another tab) does nothing the second time', again.ok && again.status === 'applied' && (await enc()).combatants.find((c) => c.id === ids.Goblin).hp === Math.max(0, g0 - 9));
  await go(page, q('p1'), 'combat');
  await page.waitForSelector('.cw-act', { timeout: 15000 });
  check('Player: sees that the DM applied it', /Applied/.test(await text(page, '.cw-myreqs')));
  await go(page, q('p2'), 'combat');
  await page.waitForSelector('.cw-act', { timeout: 15000 });
  const btn = await page.$eval('.cw-act [data-cb="act"]', (b) => b.disabled).catch(() => true);
  const out = await page.evaluate((ids) => FogCampaignData.submitCombatRequest(window.FogCampaign.id, { clientKey: 'zzzzzzzz99999', attackerId: ids.Tobias, targetIds: [ids.Wyrmling], action: { name: 'Rapier' } }), ids);
  check('Not your turn: buttons locked and the server refuses', btn === true && !out.ok && /Wait for your turn/.test(out.message));
  await page.setViewport({ width: 390, height: 860 }); await sleep(300);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('Mobile: actions above the list, no sideways scrolling', over <= 0, over);
  await page.screenshot({ path: SHOTS + '/combat-mobile.png', fullPage: true });
  await page.setViewport({ width: 1366, height: 1000 });
});

await run('light', async () => {
  await go(page, q('dm', '&dmplan=fogger-of-the-dragons&theme=light'), 'combat');
  await page.waitForSelector('.cw-act', { timeout: 15000 });
  await page.screenshot({ path: SHOTS + '/combat-light.png', fullPage: true });
  check('Light theme renders the new layout', await has('.cw-combat-grid .cw-act'));
});

console.log(res.map((r) => r[0] + ' ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
const bad = res.filter((r) => r[0] === 'FAIL').length;
console.log('\nFAILS: ' + bad + ' / ' + res.length);
console.log('JS ERRORS:', errors.filter((e) => !/404|Failed to load resource/.test(e)));
await browser.close();
process.exit(bad ? 1 : 0);
