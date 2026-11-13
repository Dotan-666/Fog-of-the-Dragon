/** Browser test (see lib.mjs for setup). Prints PASS/FAIL lines and a summary; exits non-zero on any failure. */
import { open, BASE, SHOTS } from './lib.mjs';
const { browser, page, errors } = await open();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stub = `
(function (g) {
  var notes = [];
  function emit() { g.dispatchEvent(new CustomEvent('fog:notifications')); }
  g.FogSupabase = { client: null, configError: 'stubbed' };
  g.FogAccount = {
    ready: function () { return Promise.resolve({ session: { user: { id: 'u1' } } }); },
    hasStoredSession: function () { return true; },
    escapeHtml: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    getAccount: function () { return { id: 'u1', profile: { displayName: 'Tester', email: 't@example.com', avatarUrl: null } }; },
    getPlan: function () { return { id: 'warlord', name: 'Warlord', activeCampaigns: 1, maxPeople: 5 }; },
    isSafeAvatarUrl: function () { return false; }, isSafeImageUrl: function () { return false; },
    relativeTime: function (iso) { return 'just now'; }, signOut: function () { return Promise.resolve(); },
    getPlanInfo: function () { return null; }, refreshPlan: function () { return Promise.resolve(g.FogAccount.getPlan()); },
  };
  g.FogNotifications = {
    add: function (n) { if (n.id && notes.some(function (x) { return x.id === n.id; })) return; notes.unshift({ id: n.id || 'n' + notes.length, title: n.title, message: n.message || '', link: n.link || null, createdAt: new Date().toISOString(), read: !!n.read }); emit(); },
    list: function () { return notes; }, markRead: function (id) { notes.forEach(function (x) { if (!id || x.id === id) x.read = true; }); emit(); }, clear: function () { notes = []; emit(); },
  };
  g.FogSettings = { get: function () { return { theme: 'dark' }; }, apply: function () {} };
  g.FogNotifications.add({ id: 'srv_1', title: 'Availability needed: Session 5', message: 'Tell the party when you can play.', link: 'campaign.html?c=11111111-1111-4111-8111-111111111111#meetings' });
})(window);`;
await page.setCacheEnabled(false); // so the stubbed scripts are really requested every time
await page.setRequestInterception(true);
page.on('request', r => {
  const u = r.url();
  if (payOn && /\/JS\/fog-payments\.js$/.test(u)) return r.respond({ status: 200, contentType: 'application/javascript', body: payStub });
  if (/\/JS\/fog-account\.js$/.test(u)) return r.respond({ status: 200, contentType: 'application/javascript', body: stub + (regOn ? regStub : '') });
  if (/\/JS\/config\/supabase-config\.js$/.test(u)) return r.respond({ status: 200, contentType: 'application/javascript', body: billingCfg ? 'window.FOG_SUPABASE_CONFIG = ' + JSON.stringify(billingCfg) + ';' : '' });
  if (/\/JS\/supabase-client\.js$|supabase\.js$|\/JS\/fog-audio\.js$/.test(u)) return r.respond({ status: 200, contentType: 'application/javascript', body: '' });
  if (/lemonsqueezy\.com|\/functions\/v1\//i.test(u)) outbound.push(u);
  r.continue();
});
const payStub = `window.FogPayments = { enabled: function () { return true; }, buy: function (p) { window.__bought = p; return Promise.resolve({ ok: true }); } };`;
let payOn = false;
let regOn = false;
let billingCfg = null; // the demo billing switch (FOG_DEMO_BILLING) as the config script would carry it
const outbound = [];  // any request to Lemon Squeezy or a Supabase function would land here
// A stand-in for the database's character registry (same rules as migration 20261115120000_character_limit.sql:
// Free = 3 live characters, paid = unlimited, deleted ones don't count, the first visit adopts existing characters).
const regStub = `
(function (g) {
  function db() { try { return JSON.parse(localStorage.getItem('__reg') || '{"rows":{},"adopted":false}'); } catch (e) { return { rows: {}, adopted: false }; } }
  function put(d) { localStorage.setItem('__reg', JSON.stringify(d)); }
  function plan() { return localStorage.getItem('__plan') || 'warlord'; }
  function usage(d) { var ids = Object.keys(d.rows).filter(function (k) { return !d.rows[k].deleted; }); return { plan: plan(), limit: plan() === 'warlord' ? 3 : null, count: ids.length, ids: ids, adopted: d.adopted }; }
  g.FogSupabase = { client: { rpc: function (fn, a) {
    var d = db();
    if (fn === 'sync_character_registry') { if (!d.adopted) { (a.p_ids || []).forEach(function (id) { d.rows[id] = { deleted: false }; }); d.adopted = true; put(d); } return Promise.resolve({ data: usage(d), error: null }); }
    if (fn === 'character_usage') return Promise.resolve({ data: usage(d), error: null });
    if (fn === 'register_character') {
      var u = usage(d);
      if (!(d.rows[a.p_id] && !d.rows[a.p_id].deleted) && u.limit != null && u.count >= u.limit) return Promise.resolve({ data: null, error: { message: 'Your Free plan allows up to 3 characters.', hint: 'character_limit' } });
      d.rows[a.p_id] = { deleted: false }; put(d); return Promise.resolve({ data: usage(d), error: null });
    }
    if (fn === 'unregister_character') { if (d.rows[a.p_id]) d.rows[a.p_id].deleted = true; put(d); return Promise.resolve({ data: usage(d), error: null }); }
    return Promise.resolve({ data: null, error: { message: 'unknown function ' + fn } });
  } } };
})(window);`;
const res = [];
await page.goto(BASE + '/Pages/dashboard.html#characters', { waitUntil: 'load' });
await sleep(1800);
res.push(['dashboard shows (not redirected)', page.url().includes('dashboard.html')]);
res.push(['sidebar items present', (await page.$$('.fod-dragon-nav')).length >= 8]);
res.push(['dragon controller initialised every item', await page.$$eval('.fod-dragon-nav', l => l.every(x => /state-(idle|playing|finished)/.test(x.className)))]);
res.push(['header user name', (await page.$eval('#user-name', e => e.innerText)) === 'Tester']);
await page.click('#notificationTrigger'); await sleep(300);
res.push(['notification bell opens with the campaign notification', /Availability needed/.test(await page.$eval('#notificationList', e => e.innerText))]);
res.push(['bell shows an unread indicator', await page.$eval('#notificationIndicator', e => !e.hidden)]);
res.push(['router loaded the characters page', await page.$eval('#page-content', e => e.innerHTML.length > 100)]);
await page.keyboard.press('Escape');
await page.click('.fod-dragon-nav[data-page="music"]'); await sleep(1200);
res.push(['sidebar navigation still routes (music)', (await page.evaluate(() => location.hash)) === '#music']);
// a campaign link in the bell goes to the workspace
const link = await page.$eval('.notification-item-btn', b => b.dataset.link);
res.push(['campaign notification link kept', /^campaign\.html\?c=/.test(link)]);
await page.evaluate(() => FogNotifications.add({ id: 'srv_mk', title: 'Published: Ash Wraith', message: 'Your listing passed review.', link: 'dashboard.html#marketplace/creator' }));
await page.click('#notificationTrigger'); await sleep(300);
await page.$eval('.notification-item-btn[data-id="srv_mk"]', (b) => b.click()); await sleep(1200);
res.push(['an account notification (dashboard.html#…) opens that Dashboard page', (await page.evaluate(() => location.hash)) === '#marketplace/creator', await page.evaluate(() => location.hash)]);
res.push(['header: Marketplace and cart icons next to the bell; Marketplace marked active on its page', !!(await page.$('.header-right #marketplaceLink')) && !!(await page.$('.header-right #cartLink')) && await page.$eval('#marketplaceLink', (a) => a.classList.contains('is-active'))]);
res.push(['#campaigns/<id> redirects to the workspace Overview', await (async () => {
  await page.evaluate(() => { location.hash = '#campaigns/11111111-1111-4111-8111-111111111111'; });
  // the hash changes first (same document), then the browser loads the workspace: wait for the real address
  for (let i = 0; i < 50 && !/campaign\.html\?c=/.test(page.url()); i++) await sleep(100);
  return /campaign\.html\?c=11111111-1111-4111-8111-111111111111#overview/.test(page.url());
})()]);

// ---- Upgrade page ----
const planButton = (view, plan) => page.evaluateHandle((view, plan) => {
  return [...document.querySelectorAll('#' + view + ' .card-btn')].find((b) => { let c = b.parentElement; while (c && !c.querySelector('.plan-name')) c = c.parentElement; return c && c.querySelector('.plan-name').textContent.trim() === plan; });
}, view, plan);
await page.goto(BASE + '/Pages/dashboard.html#upgrade', { waitUntil: 'load' });
await page.waitForSelector('#monthlyView .card-btn', { timeout: 8000 }); await sleep(600);
let b = await planButton('monthlyView', 'Warlord');
res.push(['Upgrade: the current (free) plan button says so', (await b.evaluate((e) => e.textContent.trim())) === 'Your Current Plan' && (await b.evaluate((e) => e.getAttribute('aria-disabled'))) === 'true']);
b = await planButton('monthlyView', 'Dungeon Master'); await b.evaluate((e) => e.click()); await sleep(300);
res.push(['Upgrade (payments off): a paid plan explains that payments are not set up, nothing opens', /payments aren.t set up/.test(await page.$eval('.upgrade-status', (e) => e.innerText)) && (await page.evaluate(() => window.__bought)) === undefined]);

payOn = true;
await page.goto('about:blank'); // a hash-only navigation would not reload the page, and the scripts would stay as they were
await page.goto(BASE + '/Pages/dashboard.html#upgrade', { waitUntil: 'load' });
await page.waitForSelector('#monthlyView .card-btn', { timeout: 8000 }); await sleep(600);
b = await planButton('monthlyView', 'Dungeon Master'); await b.evaluate((e) => e.click()); await sleep(300);
res.push(['Upgrade (payments on): Dungeon Master monthly starts that checkout', (await page.evaluate(() => window.__bought)) === 'plan_dm_monthly']);
await page.click('#tabYearlyBtn'); await sleep(200);
b = await planButton('yearlyView', 'Fogger of the Dragons'); await b.evaluate((e) => e.click()); await sleep(300);
res.push(['Upgrade (payments on): Fogger yearly starts the yearly checkout', (await page.evaluate(() => window.__bought)) === 'plan_fogger_yearly']);
b = await planButton('yearlyView', 'Warlord'); await b.evaluate((e) => e.click()); await sleep(200);
res.push(['Upgrade: the free plan has no checkout', (await page.evaluate(() => window.__bought)) === 'plan_fogger_yearly' && /already on the Warlord plan/.test(await page.$eval('.upgrade-status', (e) => e.innerText))]);
// back from a checkout: waits for the server (the plan is still free here), never assumes
await page.goto(BASE + '/Pages/dashboard.html?checkout=success#upgrade', { waitUntil: 'load' });
await page.waitForSelector('.upgrade-status', { timeout: 8000 }); await sleep(900);
res.push(['Upgrade: back from checkout it waits to confirm and does not claim the plan', /Confirming your payment/.test(await page.$eval('.upgrade-status', (e) => e.innerText))]);

// ---- Character limit (Free plan: 3; the registry decides) ----
regOn = true;
const clearReg = () => page.evaluate(() => { localStorage.removeItem('__reg'); localStorage.removeItem('__plan'); localStorage.removeItem('fog_characters_v1'); });
const reloadChars = async () => { await page.goto('about:blank'); await page.goto(BASE + '/Pages/dashboard.html#characters', { waitUntil: 'load' }); await page.waitForSelector('#btn-create-character', { timeout: 8000 }); await sleep(900); };
await reloadChars(); await clearReg(); await reloadChars();
const usageText = () => page.$eval('#characters-usage', e => e.hidden ? '' : e.innerText.trim());
res.push(['Characters: counter shows 0 / 3 on the Free plan', /^0 \/ 3 characters$/i.test(await usageText()), await usageText()]);
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('#btn-create-character, #btn-empty-create-character')].find(x => x.offsetParent); b.click(); });
  await sleep(1000);
  await reloadChars();
}
res.push(['Characters: three created, counter 3 / 3, create marked as at the limit', /^3 \/ 3 characters$/i.test(await usageText()) && (await page.$eval('#btn-create-character', b => b.getAttribute('aria-disabled'))) === 'true', await usageText()]);
await page.$eval('#btn-create-character', b => b.click()); await sleep(900);
res.push(['Characters: a 4th is refused with the limit message and an upgrade button', page.url().endsWith('#characters') && /reached the Free plan.s 3 characters/i.test(await page.$eval('#characters-limit', e => e.hidden ? '' : e.innerText)) && !!(await page.$('#characters-limit [data-open="#upgrade"]'))]);
res.push(['Characters: still 3 stored after the refusal', (await page.evaluate(() => JSON.parse(localStorage.getItem('fog_characters_v1')).length)) === 3]);
const bypass = await page.evaluate(() => FogCharacterStore.save(FogCharacterStore.createDraft()));
res.push(['Characters: calling the store directly cannot create a 4th', !bypass.ok && bypass.code === 'character_limit', JSON.stringify(bypass)]);
res.push(['Characters: asking the registry directly for a 4th slot is refused', (await page.evaluate(async () => (await FogCharacterRegistry.claim('c_direct_x')).ok)) === false]);
const edit = await page.evaluate(() => { const l = FogCharacterStore.listSummaries(); const d = FogCharacterStore.get(l[0].id); d.narrative.name = 'Edited at the limit'; return FogCharacterStore.save(d).ok; });
res.push(['Characters: editing an existing character is still allowed at the limit', edit]);
page.once('dialog', d => d.accept());
await page.click('[data-delete]'); await sleep(1000);
res.push(['Characters: deleting frees a slot (2 / 3, create enabled again)', /^2 \/ 3 characters$/i.test(await usageText()) && (await page.$eval('#btn-create-character', b => b.getAttribute('aria-disabled'))) === 'false', await usageText()]);
await page.$eval('#btn-create-character', b => b.click()); await sleep(1000); // a DOM click: the fixed header can cover the button after scrolling
res.push(['Characters: after deleting, a new one can be created', /#characters\/new\//.test(page.url()), page.url()]);
await page.evaluate(() => localStorage.setItem('__plan', 'dungeon-master'));
await reloadChars();
res.push(['Characters: a paid plan shows unlimited and never blocks', /unlimited on the Dungeon Master plan/i.test(await usageText()) && (await page.$eval('#btn-create-character', b => b.getAttribute('aria-disabled'))) === 'false', await usageText()]);
await clearReg();
regOn = false;


// ---- Music: moods, scenes, intensity, search, playlists and playback of the new tracks ----
await page.goto('about:blank');
await page.goto(BASE + '/Pages/dashboard.html#music', { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelectorAll('#music-mood option').length > 5, { timeout: 10000 });
await sleep(400);
const names = () => page.$$eval('#music-list .music-item-title', (h) => h.map((x) => x.innerText));
await page.select('#music-mood', 'sad'); await sleep(250);
let ns = await names();
res.push(['Music: mood "Sad" lists the sad tracks only', ns.includes('Lament for a Warrior’s Soul') && ns.includes('Eye of the Storm') && !ns.includes('Battle Theme B'), ns.join('|')]);
await page.select('#music-mood', ''); await page.select('#music-scene', 'desert'); await sleep(250);
ns = await names();
res.push(['Music: scene "Desert" finds the desert track', ns.length >= 1 && ns.includes('Desert Theme (Caravan)'), ns.join('|')]);
await page.select('#music-scene', ''); await page.select('#music-intensity', '3'); await sleep(250);
ns = await names();
res.push(['Music: high intensity lists battle music, not lullabies', ns.includes('Battle Theme B') && ns.includes('Zombies Are Coming') && !ns.includes('Happy Lullaby'), ns.join('|')]);
await page.select('#music-intensity', '');
await page.$eval('#music-search', (e) => { e.value = 'undead'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(300);
ns = await names();
res.push(['Music: search matches scene labels (undead)', ns.includes('Zombies Are Coming'), ns.join('|')]);
res.push(['Music: each background track shows its moods, intensity and scenes', await page.$$eval('#music-list .music-item', (l) => { const z = l.find((x) => /Zombies Are Coming/.test(x.innerText)); return !!z && /High intensity/i.test(z.innerText) && /Dark/.test(z.innerText) && /Undead/.test(z.innerText); })]);
await page.$eval('#music-clear-filters', (b) => b.click()); await sleep(250);
res.push(['Music: clear filters shows the whole library again', (await names()).length >= 100, (await names()).length]);
await page.$eval('#music-search', (e) => { e.value = 'snowfall'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(300);
await page.$eval('#music-list .music-play', (b) => b.click()); await sleep(1500);
const st = await page.evaluate(() => { const s = FogMusicPlayer.state(); return { ref: s.current && s.current.ref, playing: s.playing }; });
res.push(['Music: a new track plays from the library', st.ref === 'rec:snowfall', JSON.stringify(st)]);
await page.evaluate(() => FogMusicPlayer.stop && FogMusicPlayer.stop());
const pl = await page.evaluate(() => { const r = FogMusicStore.createPlaylist('Winter journey'); FogMusicStore.addToPlaylist(r.playlist.id, 'rec:snowfall'); FogMusicStore.addToPlaylist(r.playlist.id, 'rec:desert-caravan'); const again = FogMusicStore.addToPlaylist(r.playlist.id, 'rec:snowfall'); const p = FogMusicStore.getPlaylist(r.playlist.id); FogMusicStore.deletePlaylist(r.playlist.id); return { n: p.items.length, again }; });
res.push(['Music: new tracks go into playlists (the store’s duplicate rule applies)', pl.n >= 2, JSON.stringify(pl)]);
payOn = false;
// ---- Billing: real plan always; demo data only with the demo switch; demo actions never unlock anything ----
const openBilling = async (hash = '#billing') => { await page.goto('about:blank'); await page.goto(BASE + '/Pages/dashboard.html' + hash, { waitUntil: 'load' }); await page.waitForSelector('#bl-body .bl-card', { timeout: 8000 }); await sleep(400); };
await openBilling();
let bt = await page.$eval('#bl-body', e => e.innerText);
res.push(['Billing (demo off): shows the real plan and no sample data', /Warlord \(free\)/.test(bt) && /Not set up yet/.test(bt) && !/Demo mode/.test(bt) && !(await page.$('[data-bl-sim]')), bt.slice(0, 300)]);
billingCfg = { demoBilling: true, demoBillingOwner: 'u1' };
await openBilling();
bt = await page.$eval('#bl-body', e => e.innerText);
res.push(['Billing (demo on): every demo block is labelled as demo', /Demo mode — sample data/.test(bt) && (await page.$$eval('.bl-demo', l => l.every(x => !!x.querySelector('.bl-demo-tag'))))]);
res.push(['Billing (demo on): subscription, one-time purchases, campaign upgrade and history shown', /Dungeon Master/.test(bt) && /One-Shot/.test(bt) && /The Ashen Crown \(demo\)/.test(bt) && /Payment history/.test(bt) && /example\.com/.test(bt)]);
res.push(['Billing (demo on): the real account section is still the real plan', /Your account/.test(bt) && (await page.$eval('#bl-real-plan', e => e.innerText)) === 'Warlord (free)']);
const planBefore = await page.evaluate(() => JSON.stringify([FogAccount.getPlan(), FogAccount.getPlanInfo()]));
for (const k of ['one_shot', 'campaign_book', 'failed_payment', 'refund', 'cancel']) { await page.$eval(`[data-bl-sim="${k}"]`, b => b.click()); await sleep(150); }
const planAfter = await page.evaluate(() => JSON.stringify([FogAccount.getPlan(), FogAccount.getPlanInfo()]));
res.push(['Billing demo actions: plan unchanged, no checkout started, no request to Lemon Squeezy or a server function', planBefore === planAfter && (await page.evaluate(() => window.__bought)) === undefined && outbound.length === 0, planAfter + ' ' + outbound.join(',')]);
res.push(['Billing demo actions: they say plainly that nothing was charged or unlocked', /Your real plan did not change/.test(await page.$eval('#bl-sim-note', e => e.innerText)) && (await page.$eval('#bl-real-plan', e => e.innerText)) === 'Warlord (free)']);
res.push(['Billing (owner): link to the Revenue view', !!(await page.$('a[href="#billing/revenue"]'))]);
await openBilling('#billing/revenue');
bt = await page.$eval('#bl-body', e => e.innerText);
res.push(['Revenue (owner, demo): summary tiles, plans, transactions, customers', (await page.$$('.bl-tile')).length === 6 && /Monthly recurring/i.test(bt) && /Subscriptions by plan/i.test(bt) && /Customers & campaigns/i.test(bt) && /Demo mode/.test(bt), (await page.$$('.bl-tile')).length + ' ' + bt.slice(0, 400)]);
await page.click('[data-bl-filter="failed"]'); await sleep(200);
res.push(['Revenue: filter shows only failed payments', (await page.$$eval('#bl-tx tbody tr', rows => rows.length > 0 && rows.every(r => /Failed/.test(r.innerText))))]);
billingCfg = { demoBilling: true, demoBillingOwner: '00000000-0000-4000-8000-000000000000' };
await openBilling('#billing/revenue');
res.push(['Revenue: someone who is not the owner sees "Not available" and no figures', /Not available/.test(await page.$eval('#bl-body', e => e.innerText)) && !(await page.$('.bl-tile'))]);
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); billingCfg = { demoBilling: true, demoBillingOwner: 'u1' };
await openBilling();
await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); }); await sleep(200);
await page.screenshot({ path: SHOTS + '/billing-light.png', fullPage: true });
res.push(['Billing (light theme): text stays readable on the cards', await page.$eval('.bl-card', e => getComputedStyle(e).color !== getComputedStyle(e).backgroundColor)]);
billingCfg = null;
console.log(res.map(r => (r[1] ? 'PASS ' : 'FAIL ') + r[0] + (!r[1] && r[2] !== undefined ? '  → ' + r[2] : '')).join('\n'));
console.log('JS errors:', errors.filter(e => !/404|Failed to load resource|ERR_/.test(e)));
await browser.close();
