/** Browser test (see lib.mjs for setup): Foggy's studio tabs on the Dashboard (characters harness) with a stand-in for the
 * server (window.FogFoggyBackend) that follows the real contracts: chat with intents, a continuing conversation, approved
 * edits only, progressive adventure writing saved as new chapters, homebrew stat blocks, pictures and battle maps saved into
 * an adventure, and a music cue sheet that keeps only real catalog tracks. */
import { open, BASE, SHOTS } from './lib.mjs';
const { browser, page, errors } = await open({ w: 1366, h: 1000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const check = (name, cond, extra = '') => res.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra).slice(0, 300)]);
const run = async (name, fn) => { try { await fn(); } catch (e) { check(name + ' (crashed)', false, e.stack || e.message); } };
const outbound = [];
const dialogs = [];
page.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message()); try { await d.accept(); } catch (e) { /* already handled */ } });
page.on('request', (r) => { if (/generativelanguage|\/functions\/v1\//i.test(r.url())) outbound.push(r.url()); });

await page.evaluateOnNewDocument(() => {
  if (!/characters-harness/.test(location.pathname)) return;
  window.FogAccount = { getPlan: () => ({ id: 'fogger-of-the-dragons' }), getAccount: () => ({ id: 'u-studio-0000-4000-8000-000000000001', profile: {} }) };
  const chain = (rows) => { const q = { select() { return q; }, neq() { return q; }, order() { return q; }, limit() { return q; }, eq() { return q; }, update() { return q; }, then(ok) { return Promise.resolve({ data: rows, error: null }).then(ok); } }; return q; };
  window.FogSupabase = { client: {
    rpc: async (fn) => fn === 'foggy_access' ? { data: { plan: 'fogger-of-the-dragons', tier: 'foggie_plus', enabled: true, dashboard: true, campaign: false, canGenerate: true }, error: null } : { data: null, error: { message: 'unknown' } },
    from: () => chain([]),
    functions: { invoke: async () => ({ data: null, error: { message: 'should not be called' } }) },
  } };
  // The server stand-in (same contracts as supabase/functions/foggy-assistant and foggy-image)
  const store = () => JSON.parse(localStorage.getItem('__fs') || '{"threads":[],"messages":[],"images":[]}');
  const put = (s) => localStorage.setItem('__fs', JSON.stringify(s));
  const id = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
  window.__fsCalls = [];
  window.__fsInflight = 0;
  const backend = async (fn, body) => { window.__fsInflight++; try { return await answer(fn, body); } finally { setTimeout(() => { window.__fsInflight--; }, 50); } };
  const answer = async (fn, body) => {
    window.__fsCalls.push({ fn, body: JSON.parse(JSON.stringify(body)) });
    await new Promise((r) => setTimeout(r, 120));
    const s = store();
    let threadId = body.threadId;
    if (fn === 'foggy-assistant' && (body.action === 'chat' || body.action === 'adventure' || body.action === 'generate')) {
      if (!threadId) { threadId = id(); s.threads.unshift({ id: threadId, scope: 'dashboard', campaign_id: null, mode: body.action === 'adventure' ? 'adventure' : 'chat', title: (body.message || 'Adventure').slice(0, 40), workspace: null, updated_at: new Date().toISOString() }); }
    }
    let result = null, drafts = [];
    if (fn === 'foggy-assistant' && body.action === 'chat') {
      const history = s.messages.filter((m) => m.thread_id === threadId);
      const m = body.message.toLowerCase();
      if (/grappl/.test(m)) result = { intent: 'answer', reply: 'Grappling is an **official SRD 5.2.1 rule**: an Unarmed Strike option; the target makes a Strength or Dexterity save.', title: 'Grappling rules', artifacts: [], edits: [] };
      else if (/what did i ask/.test(m)) result = { intent: 'answer', reply: 'You asked about grappling (' + history.length + ' earlier messages in this conversation).', title: '', artifacts: [], edits: [] };
      else if (/villain|npc/.test(m)) { result = { intent: 'artifact', reply: 'Here is a villain.', title: '', artifacts: [{ kind: 'npc', title: 'Mother Brine', summary: 'A sea-hag who sells drowned memories.', dmNotes: 'She is the bell’s maker.', fields: { Role: 'Villain', Voice: 'Wet whisper' } }], edits: [] }; drafts = [{ id: id(), scope: 'dashboard', campaign_id: null, kind: 'npc', title: 'Mother Brine', body: { summary: 'A sea-hag who sells drowned memories.', dmNotes: 'She is the bell’s maker.', fields: { role: 'Villain' } }, status: 'draft', created_at: new Date().toISOString() }]; }
      else if (/rewrite/.test(m) && body.adventureId) {
        const a = (await FogAdventureStore.get(body.adventureId)).adventure;
        const sec = a.content.chapters[0].sections[0];
        result = { intent: 'edit', reply: 'Here is a darker opening.', title: '', artifacts: [], edits: [{ target: sec.id, field: 'playerText', newText: 'Black water laps at the steps. The bell tolls once, though no hand rings it.', why: 'Darker tone' }] };
      } else result = { intent: 'question', reply: 'How many players, and what level?', title: '', artifacts: [], edits: [] };
      s.messages.push({ id: id(), thread_id: threadId, role: 'user', content: body.message, data: {}, created_at: new Date().toISOString() });
      s.messages.push({ id: id(), thread_id: threadId, role: 'assistant', content: result.reply, data: { result }, created_at: new Date().toISOString() });
      if (result.title && s.threads[0].id === threadId) s.threads[0].title = result.title;
    } else if (fn === 'foggy-assistant' && body.action === 'adventure') {
      const step = body.step;
      if (step === 'questions') result = { questions: ['How many players and what level?', 'How long should it run?'] };
      else if (step === 'outline') result = { title: 'The Drowned Bell', pitch: 'A bell rings beneath a flooded village.', levelMin: 3, levelMax: 4, genre: 'Mystery', theme: 'Gothic', chapters: [
        { title: 'Arrival at Brinemoor', summary: 'The party reaches the village.', dmNotes: '', sections: [{ kind: 'scene', title: 'The tolling', summary: 'A bell under water' }, { kind: 'npc', title: 'Mayor Odile', summary: 'Lies' }] },
        { title: 'The Sunken Chapel', summary: 'Into the water.', dmNotes: '', sections: [{ kind: 'encounter', title: 'Drowned guards', summary: 'Zombies' }] },
      ], sideQuests: ['Find the lost child'], twists: ['The mayor rang it first'], endings: ['Silence the bell'] };
      else if (step === 'chapter') result = { title: 'Arrival at Brinemoor', summary: 'The party reaches the village.', dmNotes: 'Fog everywhere.', sections: [
        { kind: 'scene', title: 'The tolling', playerText: 'A bell tolls beneath the black water.', dmNotes: 'The bell is cursed.', fields: {} },
        { kind: 'npc', title: 'Mayor Odile', playerText: 'A nervous woman with salt-stained gloves.', dmNotes: 'She rang the bell first.', fields: { role: 'Mayor' } },
      ] };
      else result = { kind: 'scene', title: 'The tolling (expanded)', playerText: 'A bell tolls beneath the black water, slow as a heartbeat. Gulls fall silent.', dmNotes: 'The bell is cursed; DC 13 Wisdom save.', fields: {} };
      s.messages.push({ id: id(), thread_id: threadId, role: 'assistant', content: 'step ' + step, data: { result }, created_at: new Date().toISOString() });
    } else if (fn === 'foggy-assistant' && body.action === 'generate') {
      const hb = { kind: 'monster', name: 'Bell Wraith', summary: 'An echo of the drowned.', data: { description: 'A shape of fog and verdigris.', size: 'Medium', type: 'Undead', alignment: 'Neutral Evil', ac: 13, hitDice: 6, speed: '0 ft., fly 40 ft. (hover)', abilities: { str: 6, dex: 16, con: 12, int: 10, wis: 12, cha: 14 }, cr: '2', actions: [{ name: 'Toll', mode: 'save', save: 'wis', dcAbility: 'cha', targets: 'each creature within 20 feet', failure: '10 (3d6) Psychic damage.', success: 'Half damage.' }, { name: 'Chill Touch', mode: 'attack', attackType: 'melee', ability: 'dex', reach: 5, dice: 2, die: 6, damageType: 'Necrotic' }] } };
      result = hb.data; result.name = hb.name;
      drafts = [{ id: id(), scope: 'dashboard', campaign_id: null, kind: 'monster', title: 'Bell Wraith', body: { summary: hb.summary, dmNotes: '', fields: {}, homebrew: hb }, status: 'draft', created_at: new Date().toISOString() }];
    } else if (fn === 'foggy-assistant' && body.action === 'music_plan') {
      const a = (await FogAdventureStore.get(body.adventureId)).adventure;
      const real = body.payload.catalog.find((t) => t.kind === 'music' && t.category === 'combat');
      const story = body.payload.catalog.find((t) => t.kind === 'music' && t.category === 'story');
      result = { cues: [
        { id: 'cue1', moment: 'Arrival in the fog', when: 'start', ref: story.ref, chapterId: a.content.chapters[0].id, sectionId: '', keywords: ['fog', 'village'], note: '' },
        { id: 'cue2', moment: 'The drowned attack', when: 'change', ref: real.ref, chapterId: '', sectionId: '', keywords: ['attack', 'roll initiative'], note: '' },
        { id: 'cue3', moment: 'Made-up track', when: 'change', ref: 'rec:not-a-real-track', chapterId: '', sectionId: '', keywords: [], note: '' },
      ], dropped: 0 };
    } else if (fn === 'foggy-image') {
      const img = { id: id(), scope: 'dashboard', campaign_id: null, kind: body.kind, playable: /battle_map|dungeon_map/.test(body.kind), grid: body.grid, title: body.title || 'Picture', prompt: body.prompt, path: 'u/' + id() + '.png', mime: 'image/png', status: 'draft', saved_to: null, created_at: new Date().toISOString() };
      s.images.unshift(img); put(s);
      const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#334'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#aab'; for (let i = 0; i < 64; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
      window.__fsImg = window.__fsImg || {}; window.__fsImg[img.path] = c.toDataURL('image/png');
      return { ok: true, image: img, url: window.__fsImg[img.path] };
    }
    put(s);
    return { ok: true, threadId, result, drafts, remainingToday: 99 };
  };
  backend.threads = async (o) => ({ ok: true, threads: store().threads.filter((t) => !o.mode || t.mode === o.mode).map((t) => ({ id: t.id, scope: t.scope, campaignId: null, mode: t.mode, title: t.title, workspace: t.workspace, updatedAt: t.updated_at })) });
  backend.messages = async (tid) => ({ ok: true, messages: store().messages.filter((m) => m.thread_id === tid).map((m) => ({ id: m.id, role: m.role, content: m.content, data: m.data, createdAt: m.created_at })) });
  backend.saveWorkspace = async (tid, ws) => { const s = store(); const t = s.threads.find((x) => x.id === tid); if (t) t.workspace = ws; put(s); return { ok: true }; };
  backend.images = async () => ({ ok: true, images: store().images.map((r) => ({ id: r.id, scope: r.scope, campaignId: null, kind: r.kind, playable: r.playable, grid: r.grid, title: r.title, prompt: r.prompt, path: r.path, mime: r.mime, status: r.status, savedTo: r.saved_to, createdAt: r.created_at })) });
  backend.imageUrls = async (paths) => { const out = {}; paths.forEach((p) => { if (window.__fsImg && window.__fsImg[p]) out[p] = window.__fsImg[p]; }); return out; };
  backend.deleteImage = async (img) => { const s = store(); s.images = s.images.filter((x) => x.id !== img.id); put(s); return { ok: true }; };
  window.FogFoggyBackend = backend;
});

const H = (extra = '') => `${BASE}/tests/ui/characters-harness.html?mock=adventures&mock=homebrew${extra}#foggy`;
async function openFoggy(extra = '') {
  await page.goto('about:blank');
  await page.goto(H(extra), { waitUntil: 'load' });
  await page.waitForSelector('.fg-status:not(:has(.fg-spin))', { timeout: 10000 }); await sleep(700);
}
const txt = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' '));
const tab = async (name) => { await page.$eval(`[data-fg-tab="${name}"]`, (b) => b.click()); await sleep(500); };
const waitIdle = async () => { await page.waitForFunction(() => !window.__fsInflight && !document.querySelector('.fg-panel:not([hidden]) .fg-spin, .fg-bubble.is-pending'), { timeout: 10000 }).catch(() => {}); await sleep(200); };
let advId = null;

await run('setup', async () => {
  await page.goto(H(), { waitUntil: 'load' });
  advId = await page.evaluate(async () => {
    localStorage.removeItem('__fs'); localStorage.removeItem('__mock_adventures'); localStorage.removeItem('__mock_homebrew');
    const a = (await FogAdventureStore.create({ title: 'The Sunken Bell' })).adventure;
    a.content.chapters.push(FogAdventureModel.newChapter('Act I'));
    const s = FogAdventureModel.newSection('scene', 'The tolling'); s.playerText = 'A bell rings.'; a.content.chapters[0].sections.push(s);
    await FogAdventureStore.save(a);
    return a.id;
  });
  await openFoggy();
  check('Foggy opens on Chat, with tabs for writing, making, pictures and music (no Listen on the Dashboard)', /Chat/.test(await txt('.fg-tab.is-on')) && (await page.$$eval('.fg-tab', (l) => l.map((x) => x.textContent))).join('|') === 'Chat|Write an adventure|Make|Pictures & maps|Music plan');
});

await run('chat', async () => {
  await page.type('#fs-chatform textarea', 'How does grappling work?');
  await page.keyboard.press('Enter'); await sleep(400); await waitIdle();
  check('Chat: a rules question gets an answer (with the SRD noted), not an artifact', /official SRD 5\.2\.1 rule/.test(await txt('#fs-msgs')) && !(await page.$('#fs-msgs .fg-result')), await txt('#fs-msgs'));
  await page.type('#fs-chatform textarea', 'What did I ask?');
  await page.keyboard.press('Enter'); await sleep(400); await waitIdle();
  const calls = await page.evaluate(() => __fsCalls.filter((c) => c.body.action === 'chat'));
  check('Chat: the conversation continues (same thread, earlier messages known)', calls.length === 2 && calls[1].body.threadId && calls[1].body.threadId === (await page.evaluate(() => JSON.parse(localStorage.getItem('__fs')).threads[0].id)) && /2 earlier messages/.test(await txt('#fs-msgs')));
  check('Chat: the conversation is listed by its title', /Grappling rules/.test(await txt('#fs-threads')), await txt('#fs-threads'));
  await page.type('#fs-chatform textarea', 'Make me a villain NPC');
  await page.keyboard.press('Enter'); await sleep(400); await waitIdle();
  check('Chat: asking for something makes it (an NPC card with DM notes hidden) and keeps it in drafts', /Mother Brine/.test(await txt('#fs-msgs .fg-result')) && !!(await page.$('#fs-msgs .fg-result details.fg-dmnotes:not([open])')) && /Kept in your drafts/.test(await txt('#fs-msgs')));
  await page.$eval('[data-fs="asset"]', (b) => b.click()); await sleep(800);
  const assets = await page.evaluate((id) => FogAdventureStore.get(id).then((r) => r.adventure.content.assets.map((a) => a.title)), advId);
  check('Chat: the NPC is added to the chosen adventure only when asked', assets.includes('Mother Brine'), assets.join('|'));
  // an edit is a proposal until applied
  await page.select('#fs-chatform [name=adv]', advId);
  await page.type('#fs-chatform textarea', 'Rewrite the opening scene darker');
  await page.keyboard.press('Enter'); await sleep(400); await waitIdle();
  let text0 = await page.evaluate((id) => FogAdventureStore.get(id).then((r) => r.adventure.content.chapters[0].sections[0].playerText), advId);
  check('Chat: an edit is shown as a proposal; the adventure is unchanged until applied', /Proposed change/.test(await txt('#fs-msgs')) && text0 === 'A bell rings.', text0 + ' || ' + (await txt('#fs-msgs')).slice(-300));
  await page.$eval('[data-fs="apply-edit"]', (b) => b.click()); await sleep(900);
  text0 = await page.evaluate((id) => FogAdventureStore.get(id).then((r) => r.adventure.content.chapters[0].sections[0].playerText), advId);
  check('Chat: after confirming, only that section changes', /Black water laps/.test(text0) && /Applied to the adventure/.test(await txt('#fs-msgs')), text0);
  await openFoggy();
  await page.$eval('#fs-threads [data-fs="open"]', (b) => b.click()); await sleep(600);
  check('Chat: after a reload the conversation is still there', /Grappling|grappling/.test(await txt('#fs-msgs')));
});

await run('adventure', async () => {
  await tab('adventure');
  await page.type('#fs-idea', 'A drowned village where a bell rings by itself, for 4 players of level 3');
  await page.$eval('[data-fs="questions"]', (b) => b.click()); await sleep(500); await waitIdle();
  check('Writing: Foggy asks questions first when asked to', /How long should it run/.test(await txt('.fs-questions')));
  await page.type('#fs-answers', '4 players, two sessions');
  await page.$eval('[data-fs="outline"]', (b) => b.click()); await sleep(500); await waitIdle();
  check('Writing: an outline with chapters and planned sections, editable', (await page.$$('.fs-chapter')).length === 2 && /Mayor Odile/.test(await txt('.fs-outline')) && !!(await page.$('[data-fs-ch="title"]')));
  await page.$eval('[data-fs="write"][data-ci="0"]', (b) => b.click()); await sleep(500); await waitIdle();
  check('Writing: one chapter is written at a time, with read-aloud text and private DM notes', (await page.$$('.fs-section')).length === 2 && /bell tolls beneath/.test(await page.$eval('.fs-section textarea[data-fs-sec="playerText"]', (t) => t.value)));
  await page.$eval('[data-fs="sec"][data-how="expand"][data-key="0:0"]', (b) => b.click()); await sleep(500); await waitIdle();
  check('Writing: expanding a section shows Foggy’s version beside yours; yours stays until you choose', /Foggy’s new version/.test(await txt('.fs-proposal')) && /bell tolls beneath the black water\.$/.test(await page.$eval('.fs-section textarea[data-fs-sec="playerText"]', (t) => t.value)), await page.$eval('.fs-section textarea[data-fs-sec="playerText"]', (t) => t.value) + ' || ' + (await txt('.fs-adv')).slice(0, 200));
  await page.$eval('[data-fs="keep-new"]', (b) => b.click()); await sleep(300);
  check('Writing: “Use the new version” replaces only that section in the draft', /slow as a heartbeat/.test(await page.$eval('.fs-section textarea[data-fs-sec="playerText"]', (t) => t.value)));
  await page.$eval('.fs-section textarea[data-fs-sec="dmNotes"]', (t) => { t.value = 'My own note.'; t.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(900);
  const before = await page.evaluate(() => FogAdventureStore.list().then((r) => r.adventures.length));
  await page.select('#fs-target', '');
  await page.$eval('[data-fs="save"]', (b) => b.click()); await sleep(1200);
  const list = await page.evaluate(() => FogAdventureStore.list().then((r) => r.adventures));
  const made = list.find((a) => a.title === 'The Drowned Bell');
  const full = made && await page.evaluate((id) => FogAdventureStore.get(id).then((r) => r.adventure), made.id);
  check('Writing: saved as a NEW adventure with both chapters (written and planned), my edits included', list.length === before + 1 && full.content.chapters.length === 2 && full.content.chapters[0].sections[0].dmNotes === 'My own note.' && full.content.chapters[1].sections[0].title === 'Drowned guards', JSON.stringify(full && full.content.chapters.map((c) => c.sections.length)));
  const existing = await page.evaluate((id) => FogAdventureStore.get(id).then((r) => r.adventure.content.chapters.length), advId);
  await page.select('#fs-target', advId);
  await page.$eval('[data-fs="save"]', (b) => b.click()); await sleep(1200);
  const after = await page.evaluate((id) => FogAdventureStore.get(id).then((r) => r.adventure.content.chapters.map((c) => c.title)), advId);
  check('Writing: saving into an existing adventure ADDS chapters (after a confirmation); nothing is replaced', after.length === existing + 2 && after[0] === 'Act I', after.join('|'));
  await openFoggy(); await tab('adventure');
  check('Writing: the project (with its written chapter) is still there after a reload', /The Drowned Bell/.test(await txt('.fs-adv .fs-threads')));
});

await run('make', async () => {
  await tab('make');
  await page.select('#fg-form [name=kind]', 'monster');
  await page.type('#fg-form textarea', 'A ghost made of a drowned bell’s echo, CR 2');
  await page.click('#fg-send'); await sleep(300); await waitIdle();
  await page.waitForSelector('[data-panel="make"] .fg-result .fg-hb', { timeout: 5000 }).catch(() => {});
  check('Make: a monster comes back as a homebrew stat block (CR, AC, HP from the rules math, its actions), clearly homebrew', /Homebrew \(not an official SRD entry\)/.test(await txt('[data-panel="make"] .fg-result')) && /CR 2 · AC 13 · HP \d+ · Toll, Chill Touch/.test(await txt('[data-panel="make"] .fg-result')), await txt('[data-panel="make"] .fg-result'));
  await page.$eval('[data-fg="save-hb"]', (b) => b.click()); await sleep(900);
  const hb = await page.evaluate(() => FogHomebrewStore.list('monster').then((r) => r.entries.map((e) => ({ name: e.name, actions: (e.data.actions || []).map((a) => a.mode) }))));
  check('Make: saved to Homebrew as a real, usable entry (normalized; the attack and the save kept their shapes)', hb.some((e) => e.name === 'Bell Wraith' && e.actions.join(',') === 'save,attack') && /Saved to Homebrew/.test(await txt('[data-panel="make"] .fg-result')), JSON.stringify(hb));
});

await run('images', async () => {
  await tab('images');
  check('Pictures: playable battle maps are a separate choice from illustrations', /Battle map — playable/.test(await txt('#fs-imgform')) && /Regional map \(illustration\)/.test(await txt('#fs-imgform')) && !(await page.$eval('[data-fs-grid]', (e) => e.hidden)));
  await page.type('#fs-imgform [name=title]', 'Flooded crypt');
  await page.type('#fs-imgform [name=prompt]', 'A crypt half under water with broken sarcophagi');
  await page.$eval('#fs-imgform [name=cols]', (e) => { e.value = 24; });
  await page.$eval('#fs-imgform button[type=submit]', (b) => b.click()); await sleep(600); await waitIdle();
  const call = await page.evaluate(() => __fsCalls.filter((c) => c.fn === 'foggy-image').pop().body);
  check('Pictures: a battle map is asked for with its grid; it is labelled playable', call.kind === 'battle_map' && call.grid.cols === 24 && /Battle map · playable \(24×20\)/.test(await txt('.fs-gallery')), JSON.stringify(call.grid) + ' || ' + await txt('.fs-gallery'));
  await page.select('#fs-imgform [name=kind]', 'world_map'); await sleep(150);
  check('Pictures: illustrations have no grid', await page.$eval('[data-fs-grid]', (e) => e.hidden));
  await page.$eval('[data-fs="img-save"]', (b) => b.click()); await sleep(1500);
  const assets = await page.evaluate((id) => FogAdventureStore.get(id).then((r) => r.adventure.content.assets.filter((a) => a.type === 'map').map((a) => ({ t: a.title, img: a.images.length, s: a.summary }))), advId);
  check('Pictures: saved into the adventure as a map asset with the image (and “check the grid”)', assets.some((a) => a.t === 'Flooded crypt' && a.img === 1 && /Playable battle map/.test(a.s)) && /In an adventure/.test(await txt('.fs-gallery')), JSON.stringify(assets));
});

await run('music', async () => {
  await tab('music');
  await page.select('#fs-madv', advId); await sleep(800);
  await page.$eval('[data-fs="mplan"]', (b) => b.click()); await sleep(700); await waitIdle();
  const rows = await page.$$eval('.fs-cues tbody tr', (l) => l.map((r) => r.querySelector('[data-fs-cue="moment"]').value));
  check('Music: a cue sheet from the adventure, with real catalog tracks only (the made-up track was dropped)', rows.length === 2 && rows.includes('The drowned attack') && !rows.includes('Made-up track'), rows.join('|'));
  check('Music: the plan is a draft until saved; each cue can be edited', /Not saved yet/.test(await txt('.fs-music')) && !!(await page.$('[data-fs-cue="ref"]')));
  await page.$eval('[data-fs-cue="keywords"]', (e) => { e.value = 'fog, village, mist'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.$eval('[data-fs="msave"]', (b) => b.click()); await sleep(800);
  const saved = await page.evaluate((id) => FogAdventureStore.get(id).then((r) => r.adventure.content.musicCues), advId);
  check('Music: saved into the adventure (with the edit), every ref a real catalog track', saved.length === 2 && saved[0].keywords.includes('mist') && saved.every((c) => /^rec:/.test(c.ref)) && await page.evaluate((refs) => refs.every((r) => !!FogAudioCatalog.get(r.slice(4))), saved.map((c) => c.ref)));
});

await run('visual', async () => {
  await tab('chat');
  await page.screenshot({ path: SHOTS + '/foggy-chat.png', fullPage: true });
  await page.setViewport({ width: 390, height: 860 }); await sleep(300);
  for (const t of ['chat', 'adventure', 'images', 'music']) {
    await tab(t);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('Mobile: no sideways scrolling on ' + t, over <= 0, over);
  }
  await page.setViewport({ width: 1366, height: 1000 });
});

check('No request to an AI service or server function from the browser', outbound.length === 0, outbound.join(' | '));
console.log('DIALOGS:', dialogs);
console.log(res.map((r) => r[0] + ' ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
const bad = res.filter((r) => r[0] === 'FAIL').length;
console.log('\nFAILS: ' + bad + ' / ' + res.length);
console.log('JS ERRORS:', errors.filter((e) => !/404|Failed to load resource/.test(e)));
await browser.close();
process.exit(bad ? 1 : 0);
