/** Browser test (see lib.mjs for setup): Marketplace, cart, demo checkout and the test-tier switch, on the characters harness
 * with the in-memory marketplace (tests/ui/mock-marketplace.js, same rules as the migration). */
import { open, BASE, SHOTS } from './lib.mjs';
const { browser, page, errors } = await open({ w: 1366, h: 900 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (name, cond, extra = '') => res.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 400)]);
const run = async (name, fn) => { try { await fn(); } catch (e) { check(name + ' (crashed)', false, e.stack || e.message); } };
const outbound = [];
page.on('request', (r) => { if (/lemonsqueezy\.com|stripe\.com|paddle\.com|\/functions\/v1\/|generativelanguage/i.test(r.url())) outbound.push(r.url()); });
page.on('console', (m) => { const t = m.text(); if (/4242|4000000000000002/.test(t)) outbound.push('console leaked card: ' + t); });

const H = (as, hash, extra = '') => `${BASE}/tests/ui/characters-harness.html?mock=adventures&mock=homebrew&market=1&as=${as}${extra}${hash}`;
async function go(as, hash, extra = '') {
  await page.goto('about:blank');
  await page.goto(H(as, hash, extra), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__harnessReady > 0, { timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector('#mk-root .mk-spin, #bl-body:empty'), { timeout: 10000 }).catch(() => {});
  await sleep(400);
}
const txt = (sel) => page.$eval(sel, (e) => e.innerText);
const tap = (sel) => page.$eval(sel, (b) => b.click());
const state = () => page.evaluate(() => window.__market.state());
const cartItems = () => page.evaluate(() => FogCart.items());

await run('store', async () => {
  await go('buyer', '#marketplace', '&mreset=1');
  await page.evaluate(() => { Object.keys(localStorage).filter((k) => k.startsWith('fog_cart_v1_')).forEach((k) => localStorage.removeItem(k)); sessionStorage.clear(); });
  await go('buyer', '#marketplace');
  check('Store: products with art, name, price, category and both actions', (await page.$$('.mk-product')).length === 8 && (await page.$$('.mk-product svg.mk-art')).length === 8 && /\$12\.99/.test(await txt('#mk-store-grid')) && (await page.$$('[data-mk="buy-store"]')).length === 8);
  check('Store: real product photos load (7 of 8 have one) with the print design inset; a product without a photo shows its design', await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.mk-product img.mk-photo')];
    await Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((ok) => { i.onload = i.onerror = ok; })));
    return imgs.length === 7 && imgs.every((i) => i.naturalWidth > 100) && document.querySelectorAll('.mk-product .mk-print svg').length === 7 &&
      !document.querySelector('[data-sku="stickers-crit-fails"] img') && !!document.querySelector('[data-sku="stickers-crit-fails"] .mk-card-art > svg');
  }));
  check('Store: clearly marked as a demo store with mockup images', /Demo store/.test(await txt('.mk-banner')) && /Demo mockup/.test(await page.$eval('.mk-product svg', (s) => s.textContent)));
  await tap('[data-mk-cat="clothing"]'); await sleep(150);
  check('Store: category filter', (await page.$$('.mk-product')).length === 2);
  await tap('[data-mk-cat=""]');
  await page.type('#mk-store-q', 'mug'); await sleep(150);
  check('Store: search', (await page.$$('.mk-product')).length === 1);
  await page.$eval('#mk-store-q', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await tap('[data-mk="product"][data-sku="tee-nat1-club"]'); await sleep(300);
  check('Store: product details modal with size and quantity', await page.$('dialog.mk-modal [name=choice]') !== null && /Nat 1 Club/.test(await txt('dialog.mk-modal')));
  check('Store: the details show the photo, the print design and the photo credit with its source link', await page.$('dialog.mk-modal .mk-detail-photo img') !== null && await page.$('dialog.mk-modal .mk-detail-print svg') !== null &&
    /Test Photographer, CC BY 4\.0/.test(await txt('dialog.mk-modal .mk-fine')) && (await page.$eval('dialog.mk-modal .mk-fine a', (a) => a.href)).startsWith('https://commons.wikimedia.org/'));
  await page.select('dialog.mk-modal [name=choice]', 'XL');
  await page.$eval('dialog.mk-modal [name=qty]', (e) => { e.value = '2'; });
  await tap('dialog.mk-modal [data-act="add"]'); await sleep(300);
  let c = await cartItems();
  check('Cart: added with the chosen size and quantity', c.length === 1 && c[0].quantity === 2 && c[0].options.size === 'XL', JSON.stringify(c));
  await tap('[data-mk="add-store"][data-sku="mug-tavern"]'); await sleep(200);
  await tap('[data-mk="add-store"][data-sku="mug-tavern"]'); await sleep(200);
  c = await cartItems();
  check('Cart: adding again increases the quantity', c.find((i) => i.ref === 'mug-tavern').quantity === 2);
  await go('buyer', '#marketplace/cart');
  check('Cart: persists across pages and reloads', (await page.$$('.mk-cart-row')).length === 2);
  check('Cart: store items show their product photo', (await page.$$('.mk-cart-row .mk-thumb img')).length === 2);
  check('Cart: subtotal', /\$89\.96/.test(await txt('.mk-sum')), await txt('.mk-sum'));
  await tap('[data-mk="qty"][data-k="store:mug-tavern"][data-d="-1"]'); await sleep(200);
  check('Cart: change quantity', (await cartItems()).find((i) => i.ref === 'mug-tavern').quantity === 1 && /\$72\.97/.test(await txt('.mk-sum')));
  await tap('[data-mk="rm-cart"][data-k="store:mug-tavern"]'); await sleep(200);
  check('Cart: remove', (await page.$$('.mk-cart-row')).length === 1);
});

await run('checkout', async () => {
  await go('buyer', '#marketplace/checkout');
  check('Checkout: order summary with images and prices', (await page.$$('.mk-sum-items li')).length === 1 && await page.$('.mk-sum-items .mk-thumb img[src*="Assets/Pictures/store/tee-nat1-club.jpg"]') !== null && /\$55\.98/.test(await txt('.mk-sum')));
  check('Checkout: payment clearly labelled as a demo', /DEMO — NO REAL PAYMENT/.test(await txt('.mk-demo-pay')) && (await page.$$('[data-mk="testcard"]')).length === 2);
  await page.type('[name=country]', 'Portugal'); await page.type('[name=city]', 'Lisbon'); await page.type('[name=address]', '1 Dragon Way');
  await page.type('[name=cardNumber]', '5555 5555 5555 4444'); await page.type('[name=exp]', '12/30'); await page.type('[name=cvc]', '123');
  await tap('#mk-pay'); await sleep(400);
  check('Checkout: a card that isn’t a test card is refused and cleared, nothing sent', /Only the demo test cards/.test(await txt('.mk-form-error')) && (await page.$eval('[name=cardNumber]', (e) => e.value)) === '' && (await state()).orders.length === 0);
  await tap('[data-mk="testcard"].is-decline');
  await tap('#mk-pay'); await sleep(700);
  check('Checkout: simulated decline shows an error and keeps the cart', /declined/i.test(await txt('.mk-form-error')) && (await cartItems()).length === 1);
  let s = await state();
  check('Checkout: the declined order is recorded as declined; no card data stored', s.orders.length === 1 && s.orders[0].status === 'declined' && !JSON.stringify(s.orders[0]).includes('4000000000000002') && !JSON.stringify(s.orders[0]).includes('cvc'), JSON.stringify(s.orders));
  await tap('[data-mk="testcard"]:not(.is-decline)');
  await tap('#mk-pay'); await sleep(900);
  check('Checkout: retry with the success card → confirmation page with reference', /Thank you/.test(await txt('.mk-confirm')) && /FOD-\d{6}-[A-Z0-9]{6}/.test(await txt('.mk-ref')) && /Demo payment — no money moved/i.test(await txt('.mk-confirm')), await txt('#mk-view'));
  check('Checkout: cart emptied after the purchase', (await cartItems()).length === 0);
  check('Checkout: merchandise marked as not shipped', /Not shipped \(demo store\)/.test(await txt('.mk-confirm')));
  await go('buyer', '#marketplace/orders');
  check('Orders: history shows the paid order and the declined attempt as one order', (await page.$$('.mk-myrow')).length === 1 && /Paid/.test(await txt('.mk-mylist')) && /demo payment/.test(await txt('.mk-mylist')));
  // buy now does not touch the cart
  await go('buyer', '#marketplace');
  await tap('[data-mk="add-store"][data-sku="d20-nat1-resin"]'); await sleep(150);
  await tap('[data-mk="buy-store"][data-sku="stickers-crit-fails"]'); await sleep(700);
  check('Buy now: straight to checkout with just that item', /#marketplace\/checkout/.test(page.url()) && (await page.$$('.mk-sum-items li')).length === 1 && /Sticker Pack/.test(await txt('.mk-sum-items')));
  await page.type('[name=country]', 'PT'); await page.type('[name=city]', 'Porto'); await page.type('[name=address]', '2 Rua');
  await tap('[data-mk="testcard"]:not(.is-decline)'); await tap('#mk-pay'); await sleep(900);
  check('Buy now: the cart still has the other item', (await cartItems()).length === 1 && (await cartItems())[0].ref === 'd20-nat1-resin');
  await go('buyer', '#marketplace/checkout', '&demopay=0');
  check('Checkout: says plainly when demo payments are switched off', /switched off/.test(await txt('.mk-sum')));
});

let paidId;
let freeId;
await run('creator', async () => {
  await page.evaluate(() => { localStorage.removeItem('__mock_adventures'); });
  await go('creator', '#marketplace/creator');
  await page.evaluate(async () => { const a = await FogAdventureStore.create({ title: 'The Sunken Bell' }); const adv = a.adventure; adv.content.chapters.push(FogAdventureModel.newChapter('Act I')); await FogAdventureStore.save(adv); });
  check('Creator: empty state and New listing', /haven’t listed anything/.test(await txt('#mk-view')) && await page.$('a[href="#marketplace/new"]') !== null);
  await go('creator', '#marketplace/new');
  await page.type('[name=title]', 'The Sunken Bell');
  await page.type('[name=summary]', 'A drowned-village mystery for levels 3–5.');
  await page.type('[name=description]', 'A complete three-act adventure: a cursed bell, a lying mayor and a hag under the lake.');
  await page.select('[name=pricing]', 'paid'); await page.$eval('[name=price]', (e) => { e.value = '6.00'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.select('[name=levelMin]', '3'); await page.select('[name=levelMax]', '5');
  await page.type('[name=tags]', 'mystery, horror, lake');
  const advOpt = await page.$$eval('[name=source] option', (o) => o.find((x) => /Adventure: The Sunken Bell/.test(x.innerText)).value);
  await page.select('[name=source]', advOpt);
  check('Editor: fee shown (10% to FOD, share for the creator)', /FOD keeps 10% \(\$0\.60\); your share is \$5\.40/.test(await txt('[data-ed="fee"]')));
  check('Editor: live preview card', /The Sunken Bell/.test(await txt('#mk-ed-card')) && /\$6\.00/.test(await txt('#mk-ed-card')));
  await tap('#mk-ed [data-act="save"]'); await sleep(900);
  let s = await state();
  paidId = s.listings[0] && s.listings[0].id;
  check('Editor: saved as a draft, with the adventure copied in', s.listings.length === 1 && s.listings[0].status === 'draft' && s.listings[0].content_kind === 'adventure' && s.listings[0].content.title === 'The Sunken Bell' && /#marketplace\/edit\//.test(page.url()));
  const bad = await page.evaluate((id) => FogMarket.upload(id, new File(['MZ'], 'run.exe', { type: 'application/x-msdownload' }), 'files'), paidId);
  check('Uploads: programs are refused before upload', !bad.ok && /Programs and archives are not allowed/.test(bad.message));
  const big = await page.evaluate((id) => FogMarket.upload(id, new File([new Uint8Array(6 * 1024 * 1024)], 'huge.png', { type: 'image/png' }), 'media'), paidId);
  check('Uploads: too large is refused', !big.ok && /too large/.test(big.message));
  const pdf = await page.evaluate((id) => FogMarket.upload(id, new File(['%PDF-1.4'], 'handouts.pdf', { type: 'application/pdf' }), 'files'), paidId);
  check('Uploads: a PDF into this listing’s folder', pdf.ok && pdf.path.endsWith('.pdf') && pdf.path.split('/')[1] === paidId);
  await tap('#mk-ed [data-act="submit"]'); await sleep(900);
  check('Submit: refused without the rights confirmation', /right to share/.test(await txt('.mk-form-error')));
  await page.$eval('[name=rights]', (e) => { e.checked = true; });
  await tap('#mk-ed [data-act="submit"]'); await sleep(900);
  s = await state();
  check('Submit: pending review, back on the creator dashboard', s.listings[0].status === 'pending_review' && /#marketplace\/creator/.test(page.url()) && /Pending review/.test(await txt('.mk-mylist')));
  // a free listing too
  await go('creator', '#marketplace/new');
  await page.type('[name=title]', 'Goblin Ambush Map');
  await page.type('[name=description]', 'A battle map of a rope bridge for a goblin ambush.');
  await page.select('[name=kind]', 'map');
  await page.$eval('[name=rights]', (e) => { e.checked = true; });
  await tap('#mk-ed [data-act="save"]'); await sleep(900);
  freeId = (await state()).listings.find((l) => l.title === 'Goblin Ambush Map').id;
  await page.evaluate((id) => FogMarket.upload(id, new File(['%PDF'], 'map.pdf', { type: 'application/pdf' }), 'files').then((r) => FogMarket.save(id, { files: [{ path: r.path, name: r.name, size: r.size, type: r.type }] })), freeId);
  await go('creator', '#marketplace/creator');
  await page.$eval(`[data-mk="submit"][data-id="${freeId}"]`, (b) => b.click()); await sleep(600);
  check('Creator dashboard: submit from the list', (await state()).listings.find((l) => l.id === freeId).status === 'pending_review');
  await go('buyer', '#marketplace/community');
  check('Community: pending listings are not public', /No community content yet/.test(await txt('#mk-view')));
});

await run('moderation', async () => {
  await go('buyer', '#marketplace/moderation');
  check('Moderation: not for ordinary users', /Only marketplace moderators/.test(await txt('#mk-view')) && !(await page.$('a[href="#marketplace/moderation"]')));
  await go('mod', '#marketplace/moderation');
  check('Moderation: the queue lists both', (await page.$$('.mk-myrow')).length === 2);
  await go('mod', '#marketplace/listing/' + paidId);
  await tap('[data-mk="mod"][data-decision="reject"]'); await sleep(400);
  check('Moderation: rejecting needs a reason', /why/.test(await txt('#mk-note')));
  await page.type('#mk-mod-note', 'Please add the attribution if any SRD monsters are used.');
  await tap('[data-mk="mod"][data-decision="reject"]'); await sleep(500);
  let s = await state();
  check('Moderation: rejected and the creator is told why', s.listings.find((l) => l.id === paidId).status === 'rejected' && s.notifs.some((n) => /Changes needed/.test(n.title)));
  await go('creator', '#marketplace/creator');
  check('Creator: sees “Changes needed” with the moderator’s note', /Changes needed/.test(await txt('.mk-mylist')) && /attribution/.test(await txt('.mk-modnote')));
  await page.$eval(`[data-mk="submit"][data-id="${paidId}"]`, (b) => b.click()); await sleep(500);
  for (const id of [paidId, freeId]) { await go('mod', '#marketplace/listing/' + id); await tap('[data-mk="mod"][data-decision="approve"]'); await sleep(500); }
  s = await state();
  check('Moderation: approved → published', s.listings.every((l) => l.status === 'published'));
});

await run('community', async () => {
  await go('buyer', '#marketplace/community');
  check('Community: published listings with creator, type, price and tags', (await page.$$('.mk-listing')).length === 2 && /by Mira Quill/.test(await txt('#mk-list-grid')) && /\$6\.00/.test(await txt('#mk-list-grid')) && /Free/.test(await txt('#mk-list-grid')) && /#mystery/.test(await txt('#mk-list-grid')));
  check('Community: not-endorsed disclaimer', /doesn’t endorse/.test(await txt('.mk-disclaimer')));
  await page.select('[data-cf="paid"]', 'free'); await sleep(150);
  check('Filter: free only', (await page.$$('.mk-listing')).length === 1);
  await page.select('[data-cf="paid"]', ''); await page.select('[data-cf="kind"]', 'g:adventure'); await sleep(150);
  check('Filter: adventure content', (await page.$$('.mk-listing')).length === 1);
  await page.select('[data-cf="kind"]', ''); await page.select('[data-cf="level"]', '8'); await sleep(150);
  check('Filter: party level 8 excludes the level 3–5 adventure', (await page.$$('.mk-listing')).length === 1);
  await tap('[data-mk="cf-clear"]'); await sleep(150);
  await page.type('[data-cf="min"]', '5'); await sleep(150);
  check('Filter: price range', (await page.$$('.mk-listing')).length === 1);
  await tap('[data-mk="cf-clear"]');
  await page.type('[data-cf="creator"]', 'mira'); await sleep(150);
  check('Filter: creator', (await page.$$('.mk-listing')).length === 2);
  await page.type('[data-cf="q"]', 'goblin'); await sleep(150);
  check('Search', (await page.$$('.mk-listing')).length === 1);
  // free → library
  await go('buyer', '#marketplace/listing/' + freeId);
  check('Listing page: what’s included, license, source, report', /map\.pdf/.test(await txt('.mk-included')) && /License/i.test(await txt('.mk-facts')) && await page.$('[data-mk="report"]') !== null, await txt('.mk-page'));
  await tap('[data-mk="claim"]'); await sleep(700);
  check('Free listing: added to the library', /In your library/.test(await txt('.mk-page')));
  // paid → cart → checkout → library → import
  await go('buyer', '#marketplace/listing/' + paidId);
  check('Paid listing: no access before buying', !(await page.evaluate(async (id) => (await FogMarket.content(id)).ok, paidId)));
  await tap('[data-mk="add-listing"]'); await sleep(300);
  await go('buyer', '#marketplace/checkout');
  await page.type('[name=country]', 'PT'); await page.type('[name=city]', 'Lisbon'); await page.type('[name=address]', '1 Way');
  await tap('[data-mk="testcard"]:not(.is-decline)'); await tap('#mk-pay'); await sleep(1000);
  check('Paid listing: checkout completes (with the D20 from the cart too)', /Thank you/.test(await txt('.mk-confirm')) && /The Sunken Bell/.test(await txt('.mk-confirm')) && /In your library/.test(await txt('.mk-confirm')));
  await go('buyer', '#marketplace/library');
  check('Library: both items, with downloads and import', (await page.$$('.mk-myrow')).length === 2 && /map\.pdf/.test(await txt('.mk-mylist')) && await page.$('[data-mk="import"]') !== null);
  page.once('dialog', (d) => d.dismiss());
  await tap('[data-mk="import"]'); await sleep(1200);
  const advs = await page.evaluate(() => JSON.parse(localStorage.getItem('__mock_adventures') || '[]').map((a) => a.title));
  check('Library: “Add to my Adventures” creates a copy in the buyer’s Adventures', advs.filter((t) => t === 'The Sunken Bell').length === 2, advs.join('|'));
  await go('creator', '#marketplace/creator');
  check('Creator dashboard: sales and downloads (demo-labelled, net after the fee)', /with demo payments/.test(await txt('.mk-tiles')) && /\$5\.40/.test(await txt('.mk-tiles')), await txt('.mk-tiles'));
});

await run('ownership', async () => {
  await go('buyer', '#marketplace/edit/' + paidId);
  check('Another user can’t open the editor', /Only the creator can edit/.test(await txt('#mk-view')));
  const direct = await page.evaluate((id) => FogMarket.save(id, { title: 'Hijacked' }), paidId);
  check('Another user can’t save it directly', !direct.ok && (await state()).listings.find((l) => l.id === paidId).title === 'The Sunken Bell');
  const del = await page.evaluate((id) => FogMarket.deleteDraft(id), paidId);
  check('Another user can’t delete it', !del.ok);
  const st = await page.evaluate((id) => FogMarket.remove(id), paidId);
  check('Another user can’t remove it', !st.ok);
  await go('buyer', '#marketplace/listing/' + paidId);
  await tap('[data-mk="report"]'); await sleep(300);
  await page.select('dialog [name=reason]', 'copyright');
  await tap('dialog button[type=submit]'); await sleep(500);
  check('Report: sent', (await state()).reports.length === 1 && /moderator will look/.test(await txt('#mk-note')));
  await go('creator', '#marketplace/edit/' + paidId);
  check('Editing a published listing warns it goes back to review', /back to review/.test(await txt('.mk-banner')));
  await page.$eval('[name=summary]', (e) => { e.value = 'Updated summary'; });
  await tap('#mk-ed [data-act="save"]'); await sleep(700);
  check('…and saving does send it back to review', (await state()).listings.find((l) => l.id === paidId).status === 'pending_review');
  await go('creator', '#marketplace/creator');
  page.once('dialog', (d) => d.accept());
  await page.$eval(`[data-mk="remove"][data-id="${freeId}"]`, (b) => b.click()); await sleep(600);
  check('Creator: remove an owned listing', (await state()).listings.find((l) => l.id === freeId).status === 'removed');
  await go('buyer', '#marketplace/library');
  check('Removed listing: buyers keep it', /no longer listed \(you keep it\)/.test(await txt('.mk-mylist')));
});

await run('tiers', async () => {
  await go('buyer', '#billing');
  await sleep(500);
  check('Tier simulator: hidden from ordinary users', !(await page.$('#bl-tiers')));
  const sneaky = await page.evaluate(() => FogSupabase.client.rpc('demo_set_plan', { p_plan: 'fogger-of-the-dragons' }));
  check('Tier simulator: an ordinary user calling it directly is refused', !!sneaky.error && /test owners/.test(sneaky.error.message));
  const planBuy = await page.evaluate(() => FogSupabase.client.rpc('create_order', { p_items: [{ type: 'plan', ref: 'plan_dm_monthly' }], p_customer: {} }));
  check('Plans: an ordinary user can’t buy one with demo payments', !!planBuy.error);
  await go('tester', '#billing');
  await page.waitForSelector('#bl-tiers', { timeout: 5000 });
  check('Tier simulator: shown to the test owner with the feature table', (await page.$$('[data-bl-tier]')).length === 3 && /Foggie\+ and Campaign Foggy/.test(await txt('#bl-tiers')));
  await tap('[data-bl-tier="fogger-of-the-dragons"]'); await sleep(800);
  check('Tier simulator: switches the plan and says a demo tier is active', /Demo tier active/.test(await txt('#bl-tiers')) && (await page.evaluate(() => FogAccount.getPlan().id)) === 'fogger-of-the-dragons');
  await tap('[data-bl-tier="warlord"]'); await sleep(800);
  check('Tier simulator: back to the free plan', (await page.evaluate(() => FogAccount.getPlan().id)) === 'warlord' && !(await page.$('.bl-demo-active')));
  await page.screenshot({ path: SHOTS + '/tiers.png', fullPage: true });
});

await run('upgrade-demo', async () => {
  const fogger = (view) => page.evaluateHandle((view) => [...document.querySelectorAll('#' + view + ' .card-btn')].find((b) => { let c = b.parentElement; while (c && !c.querySelector('.plan-name')) c = c.parentElement; return c && c.querySelector('.plan-name').textContent.trim() === 'Fogger of the Dragons'; }), view);
  await go('buyer', '#upgrade');
  await page.waitForSelector('#monthlyView .card-btn', { timeout: 8000 }); await sleep(400);
  await (await fogger('monthlyView')).evaluate((b) => b.click()); await sleep(600);
  check('Upgrade (ordinary user, demo payments on): explains only test owners can buy plans', /only configured test owners/.test(await txt('.upgrade-status')) && !/#marketplace\/checkout/.test(page.url()));
  await go('tester', '#upgrade');
  await page.waitForSelector('#monthlyView .card-btn', { timeout: 8000 }); await sleep(400);
  await (await fogger('monthlyView')).evaluate((b) => b.click()); await sleep(900);
  check('Upgrade (test owner): Fogger goes to the demo checkout with the right price', /#marketplace\/checkout/.test(page.url()) && /Fogger of the Dragons \(monthly\)/.test(await txt('.mk-sum')) && /\$5\.99/.test(await txt('.mk-sum')));
  await page.type('[name=country]', 'PT');
  await tap('[data-mk="testcard"]:not(.is-decline)'); await tap('#mk-pay'); await sleep(1000);
  check('Upgrade (test owner): the demo payment completes and the plan is now Fogger of the Dragons', /Thank you/.test(await txt('.mk-confirm')) && (await page.evaluate(() => FogAccount.getPlan().id)) === 'fogger-of-the-dragons');
  await go('tester', '#upgrade');
  await page.waitForSelector('#monthlyView .card-btn', { timeout: 8000 }); await sleep(400);
  check('Upgrade: the Fogger card now says it is the current plan', /Your Current Plan/.test(await (await fogger('monthlyView')).evaluate((b) => b.textContent)));
  await page.evaluate(() => FogSupabase.client.rpc('demo_set_plan', { p_plan: 'warlord' }));
  await go('tester', '#upgrade', '&demopay=0');
  await page.waitForSelector('#monthlyView .card-btn', { timeout: 8000 }); await sleep(400);
  await (await fogger('yearlyView')).evaluate((b) => b.click()); await sleep(600);
  check('Upgrade (test owner, demo payments off): says how to switch them on', /demo payments are switched off/.test(await txt('.upgrade-status')));
});

await run('ai-review', async () => {
  // Creates a free listing with a file and submits it as the creator (the app then asks the reviewer in the background).
  const submitNew = (title) => page.evaluate(async (title) => {
    const c = await FogMarket.create({ title, kind: 'encounter', description: 'An original encounter in a misty bog, in three phases.', rightsConfirmed: true });
    const up = await FogMarket.upload(c.listing.id, new File(['# notes'], 'notes.md', { type: 'text/markdown' }), 'files');
    await FogMarket.save(c.listing.id, { files: [{ path: up.path, name: up.name, size: up.size, type: up.type }] });
    const r = await FogMarket.submit(c.listing.id);
    const review = await r.review;
    return { id: c.listing.id, ok: r.ok, review };
  }, title);
  const L = (id) => state().then((s) => s.listings.find((l) => l.id === id));

  await go('creator', '#marketplace/creator', '&review=ai_assist');
  const a = await submitNew('Bog Witch Lair');
  check('AI review (assist): submitting asks the reviewer; the creator gets no verdict details; the listing waits for a moderator', a.ok && a.review.ok && a.review.reviewed && !a.review.review && (await L(a.id)).status === 'pending_review');
  check('AI review: creators can’t read verdicts', (await page.evaluate(() => FogSupabase.client.from('marketplace_ai_reviews').select('*').then((r) => r.data.length))) === 0);
  const bad = await submitNew('Copy of a Lost Mine');
  await go('mod', '#marketplace/moderation');
  check('AI review: the queue shows Gemini’s suggestion per listing', /Gemini suggests: publish · Low risk/.test(await txt('#mk-view')) && /Gemini suggests: ask for changes · High risk/.test(await txt('#mk-view')));
  await go('mod', '#marketplace/listing/' + a.id);
  await page.waitForSelector('#mk-ai .mk-ai', { timeout: 5000 }).catch(() => {});
  check('AI review: the moderator sees the verdict, the risk and what was checked', /Gemini suggests: publish/.test(await txt('#mk-ai')) && /Low risk/.test(await txt('#mk-ai')) && /Checked: listing text/.test(await txt('#mk-ai')));
  await go('mod', '#marketplace/listing/' + bad.id);
  await page.waitForSelector('#mk-ai .mk-ai', { timeout: 5000 }).catch(() => {});
  check('AI review: problems are listed with a suggested note', /copied/.test(await txt('#mk-ai')) && /Read-aloud text matches/.test(await txt('#mk-ai .mk-ai-reasons')));
  await tap('[data-mk="ai-use-note"]');
  check('AI review: “Use this note” fills the note to the creator', /replace the copied read-aloud text/.test(await page.$eval('#mk-mod-note', (t) => t.value)));
  check('AI review: the human still decides (the bad listing is not rejected by itself)', (await L(bad.id)).status === 'pending_review');
  await tap('[data-mk="mod"][data-decision="reject"]'); await sleep(500);
  check('AI review: the moderator rejects with the suggested note', (await L(bad.id)).status === 'rejected' && /replace the copied/.test((await L(bad.id)).moderation_note));
  await go('mod', '#marketplace/listing/' + a.id, '&aikey=0');
  await page.waitForSelector('#mk-ai .mk-ai', { timeout: 5000 }).catch(() => {});
  await tap('[data-mk="ai-again"]'); await sleep(700);
  check('AI review: “Ask Gemini again” without a key on the server explains it', /no Gemini key on the server/.test(await txt('#mk-ai')));

  await go('creator', '#marketplace/creator', '&review=ai_auto');
  const auto = await submitNew('Lantern Festival Night');
  const unsure = await submitNew('Unsure Tomb');
  const s = await state();
  check('AI review (auto): a low-risk approval of a fully checked listing is published automatically, and the creator is told', auto.review.autoPublished === true && (await L(auto.id)).status === 'published' && s.notifs.some((n) => n.user === s.listings.find((l) => l.id === auto.id).creator_id && /Published: Lantern Festival Night/.test(n.title)));
  check('AI review (auto): an unsure verdict (something not checked) waits for a moderator', unsure.review.autoPublished === false && (await L(unsure.id)).status === 'pending_review');
  await go('creator', '#marketplace/creator');
  const before = (await state()).listings.length;
  await page.evaluate((id) => FogMarket.submit(id).then(() => 0), a.id);
  await page.$eval(`[data-mk="submit"][data-id="${bad.id}"]`, (b) => b.click()); await sleep(600);
  check('AI review: the creator is told what happens next (automatic review first)', /automatic review checks it first/.test(await txt('#mk-note')), await txt('#mk-note'));
  check('AI review: nothing duplicated', (await state()).listings.length === before);
  await go('creator', '#marketplace/creator', '&review=manual');
  const man = await submitNew('Manual Mode Shrine');
  check('AI review (manual): nothing is sent to Gemini', man.review.ok && man.review.reviewed === false && (await L(man.id)).status === 'pending_review');
  // leave the shared state as the later checks expect
  await page.evaluate((ids) => { const S = window.__market.state(); S.listings = S.listings.filter((l) => !ids.includes(l.id)); S.aiReviews = []; window.__market.setReviewMode('ai_assist'); }, [a.id, bad.id, auto.id, unsure.id, man.id]);
});

await run('visual', async () => {
  for (const theme of ['', '&theme=light']) {
    await go('buyer', '#marketplace', theme); await page.screenshot({ path: SHOTS + '/mk-store' + (theme ? '-light' : '') + '.png', fullPage: true });
    await go('buyer', '#marketplace/community', theme); await page.screenshot({ path: SHOTS + '/mk-community' + (theme ? '-light' : '') + '.png', fullPage: true });
  }
  await go('buyer', '#marketplace'); await tap('[data-mk="add-store"][data-sku="hoodie-fog"]'); await sleep(200);
  await go('buyer', '#marketplace/cart'); await tap('a[href="#marketplace/checkout"]'); await sleep(600);
  await page.screenshot({ path: SHOTS + '/mk-checkout.png', fullPage: true });
  await page.setViewport({ width: 390, height: 800 });
  for (const h of ['#marketplace', '#marketplace/community', '#marketplace/cart', '#marketplace/checkout', '#marketplace/creator']) {
    await go('buyer', h);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('Mobile: no sideways scrolling on ' + h, over <= 0, over);
  }
  await page.screenshot({ path: SHOTS + '/mk-mobile.png', fullPage: true });
});

check('No request to any payment provider or server function, and card numbers never logged', outbound.length === 0, outbound.join(' | '));
console.log(res.map((r) => r[0] + ' ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
const bad = res.filter((r) => r[0] === 'FAIL').length;
console.log('\nFAILS: ' + bad + ' / ' + res.length);
console.log('JS ERRORS:', errors.filter((e) => !/404|Failed to load resource/.test(e)));
await browser.close();
process.exit(bad ? 1 : 0);
