/**
 * Foggy service layer (browser) — shared by the Dashboard's Foggy page and Campaign Foggy.
 *
 * The browser never talks to an AI service and never holds an AI key. Generation happens only in the Edge Function
 * supabase/functions/foggy-generate (server side; the Gemini key is a Supabase secret), which checks the plan, the owner's
 * switch (public.app_flags 'foggy') and a daily fair-use cap, writes the draft and stores it in public.foggy_content.
 *
 * FogFoggy.access(campaignId?)      → { ok, access: { plan, tier, enabled, dashboard, campaign, canGenerate }, source }
 *                                     decided by the database (public.foggy_access); if that isn't set up yet, the same rules
 *                                     are applied to the known plan with generation OFF (source 'local')
 * FogFoggy.generate(request)        → { ok:true, draft, remainingToday } or { ok:false, code, message }
 *                                     (does not call the server at all while the database says generation is off)
 * FogFoggy.listDrafts(opts)         → { ok, drafts, notSetUp? }   opts: { scope: 'dashboard'|'campaign', campaignId }
 * FogFoggy.removeDraft(id)          → { ok }
 * FogFoggy.toAsset(draft)           → an adventure asset (FogAdventureModel) marked origin "foggy", or null
 * FogFoggy.saveToAdventure(draft, adventureId) → { ok, assetId } adds the draft to the adventure's Assets and marks it saved
 */
(function (global) {
  'use strict';

  var KINDS = ['npc', 'location', 'monster', 'item', 'spell', 'handout', 'map', 'portrait', 'outline'];
  var KIND_LABEL = { npc: 'NPC', location: 'Location', monster: 'Monster / encounter', item: 'Magic item', spell: 'Spell', handout: 'Handout', map: 'Map description', portrait: 'Portrait description', outline: 'Adventure outline', text: 'Text' };
  var ASSET_KINDS = ['npc', 'portrait', 'map', 'location', 'monster', 'item', 'spell', 'handout'];
  var TONES = [['', 'Any tone'], ['classic', 'Classic fantasy'], ['grim', 'Grim'], ['heroic', 'Heroic'], ['eerie', 'Eerie'], ['whimsical', 'Whimsical']];
  // What each plan includes (from the pricing page; no new tiers).
  var TIERS = {
    foggie: { name: 'Foggie', line: 'Campaign Writing Helper', plan: 'Adventurer' },
    foggie_plus: { name: 'Foggie+', line: 'Advanced AI Assistant', plan: 'Dungeon Master' },
  };

  function sb() { return global.FogSupabase && global.FogSupabase.client; }
  function notSetUp(err) { return /function .* does not exist|Could not find the function|schema cache|relation .* does not exist|foggy_content/i.test((err && err.message) || ''); }

  /** The same rules as private.foggy_access, for when the database can't be asked (generation always off then). */
  function localAccess(campaignId, isCampaignDm) {
    var plan = (global.FogAccount && global.FogAccount.getPlan && global.FogAccount.getPlan() || {}).id || 'free';
    var tier = plan === 'adventurer' ? 'foggie' : plan === 'dungeon-master' ? 'foggie_plus' : null;
    var campaign = !!campaignId && plan === 'dungeon-master' && !!isCampaignDm;
    return { plan: plan, tier: tier, enabled: false, dashboard: !!tier, campaign: campaign, canGenerate: false };
  }

  async function access(campaignId, opts) {
    opts = opts || {};
    if (global.FogFoggyBackend && typeof global.FogFoggyBackend.access === 'function') return global.FogFoggyBackend.access(campaignId, opts); // tests
    var client = sb();
    if (!client || typeof client.rpc !== 'function') return { ok: true, access: localAccess(campaignId, opts.isCampaignDm), source: 'local' };
    try {
      var res = await client.rpc('foggy_access', { p_campaign: campaignId || null });
      if (res.error) {
        if (notSetUp(res.error)) return { ok: true, access: localAccess(campaignId, opts.isCampaignDm), source: 'local' };
        return { ok: false, message: 'Foggy\'s access could not be checked (' + res.error.message + ').' };
      }
      return { ok: true, access: res.data, source: 'server' };
    } catch (e) {
      return { ok: false, message: 'Foggy\'s access could not be checked. Check your connection and try again.' };
    }
  }

  function validate(r) {
    if (!r || KINDS.indexOf(r.kind) < 0) return 'Choose what Foggy should make.';
    var p = String(r.prompt || '').trim();
    if (p.length < 3) return 'Describe what you want (at least a few words).';
    if (p.length > 2000) return 'The description is too long (2000 characters at most).';
    if (r.scope === 'campaign' && !r.campaignId) return 'Campaign Foggy needs a campaign.';
    return null;
  }

  /** Asks the server to write a draft. Sends nothing while the plan or the owner's switch says no. */
  async function generate(request, accessInfo) {
    var invalid = validate(request);
    if (invalid) return { ok: false, code: 'bad_request', message: invalid };
    var a = accessInfo;
    if (!a) { var got = await access(request.campaignId); if (!got.ok) return { ok: false, code: 'error', message: got.message }; a = got.access; }
    if (request.scope === 'campaign' ? !a.campaign : !a.dashboard) return { ok: false, code: 'plan', message: request.scope === 'campaign' ? 'Campaign Foggy is part of the Dungeon Master plan.' : 'Foggy is part of the Adventurer and Dungeon Master plans.' };
    if (!a.canGenerate) return { ok: false, code: 'not_enabled', message: 'Foggy isn\'t switched on yet, so nothing was generated and nothing was sent anywhere.' };
    // Switched on: the Edge Function decides the rest (AI key present, daily cap) and writes the draft.
    var client = sb();
    if (!client || !client.functions) return { ok: false, code: 'error', message: 'Foggy can\'t reach the server.' };
    var res = await client.functions.invoke('foggy-generate', { body: { kind: request.kind, scope: request.scope, campaignId: request.campaignId || null, adventureId: request.adventureId || null, prompt: request.prompt, options: request.options || {} } });
    if (res.error) {
      var msg = 'Foggy couldn\'t make that.';
      var code = 'error';
      try { if (res.error.context && res.error.context.json) { var j = await res.error.context.json(); msg = j.error || msg; code = j.code || code; } } catch (e) { /* keep generic */ }
      if (code === 'error' && /Failed to send|fetch|network/i.test(String(res.error.message || ''))) msg = 'Foggy can\'t reach the server. If this keeps happening, the foggy-generate function may not be deployed yet.';
      return { ok: false, code: code, message: msg };
    }
    var d = res.data && res.data.draft;
    if (!d || !d.id) return { ok: false, code: 'error', message: 'Foggy answered without a draft. Try again.' };
    return { ok: true, draft: fromRow(d), remainingToday: res.data.remainingToday };
  }

  function fromRow(r) {
    return { id: r.id, scope: r.scope, campaignId: r.campaign_id, kind: r.kind, title: r.title, body: r.body || {}, prompt: r.prompt || '', status: r.status, savedTo: r.saved_to || null, createdAt: r.created_at };
  }

  async function listDrafts(opts) {
    opts = opts || {};
    var client = sb();
    if (!client || typeof client.from !== 'function') return { ok: true, drafts: [], notSetUp: true };
    try {
      var q = client.from('foggy_content').select('id, scope, campaign_id, kind, title, body, prompt, status, saved_to, created_at').neq('status', 'discarded').order('created_at', { ascending: false }).limit(50);
      q = opts.scope === 'campaign' ? q.eq('scope', 'campaign').eq('campaign_id', opts.campaignId) : q.eq('scope', 'dashboard');
      var res = await q;
      if (res.error) return notSetUp(res.error) ? { ok: true, drafts: [], notSetUp: true } : { ok: false, message: 'Your Foggy drafts could not be loaded (' + res.error.message + ').' };
      return { ok: true, drafts: (res.data || []).map(fromRow) };
    } catch (e) {
      return { ok: false, message: 'Your Foggy drafts could not be loaded. Check your connection.' };
    }
  }

  async function removeDraft(id) {
    var client = sb();
    if (!client) return { ok: false, message: 'Not connected.' };
    var res = await client.from('foggy_content').delete().eq('id', id).select('id');
    return res.error ? { ok: false, message: res.error.message } : { ok: true };
  }

  function toAsset(d) {
    var M = global.FogAdventureModel;
    if (!M || !d || ASSET_KINDS.indexOf(d.kind) < 0) return null;
    var b = d.body || {};
    return M.newAsset(d.kind, d.title, { summary: b.summary || '', dmNotes: b.dmNotes || '', fields: b.fields || {}, origin: 'foggy' });
  }

  async function saveToAdventure(d, adventureId) {
    var Store = global.FogAdventureStore;
    var asset = toAsset(d);
    if (!asset) return { ok: false, message: 'This kind of draft can\'t be added as an adventure asset.' };
    if (!Store) return { ok: false, message: 'Adventures aren\'t available here.' };
    var got = await Store.get(adventureId);
    if (!got.ok) return { ok: false, message: got.message };
    var a = got.adventure;
    if (a.content.assets.length >= global.FogAdventureModel.LIMITS.assets) return { ok: false, message: 'That adventure already has the maximum number of assets.' };
    a.content.assets.push(asset);
    var saved = await Store.save(a);
    if (!saved.ok) return { ok: false, message: saved.message };
    var client = sb();
    if (client && d.id) await client.from('foggy_content').update({ status: 'saved', saved_to: { adventureId: adventureId, assetId: asset.id } }).eq('id', d.id);
    return { ok: true, assetId: asset.id };
  }


  // ===================================================================================================================
  // Foggy assistant (Edge Functions foggy-assistant, foggy-image, foggy-listen). The browser holds no AI key; everything
  // Foggy proposes is applied only when the user saves or approves it, through the existing stores.
  // ===================================================================================================================
  /** Calls one of Foggy's server functions. Tests can stand in with window.FogFoggyBackend(fn, body). Never throws. */
  async function invoke(fn, body) {
    if (typeof global.FogFoggyBackend === 'function') return global.FogFoggyBackend(fn, body);
    var client = sb();
    if (!client || !client.functions) return { ok: false, code: 'unavailable', message: 'Foggy can\'t reach the server.' };
    try {
      var res = await client.functions.invoke(fn, { body: body });
      if (res.error) {
        var msg = 'Foggy couldn\'t answer.'; var code = 'error';
        try { if (res.error.context && res.error.context.json) { var j = await res.error.context.json(); msg = j.error || msg; code = j.code || code; } } catch (e) { /* keep generic */ }
        if (code === 'error' && /Failed to send|fetch|network/i.test(String(res.error.message || ''))) { code = 'unavailable'; msg = 'Foggy can\'t reach the server (the ' + fn + ' function may not be deployed yet).'; }
        return { ok: false, code: code, message: msg };
      }
      return Object.assign({ ok: true }, res.data || {});
    } catch (e) {
      return { ok: false, code: 'unavailable', message: 'Foggy can\'t reach the server.' };
    }
  }
  function chat(o) { return invoke('foggy-assistant', { action: 'chat', scope: o.scope, campaignId: o.campaignId || null, threadId: o.threadId || null, adventureId: o.adventureId || null, message: o.message }); }
  function adventureStep(o) { return invoke('foggy-assistant', { action: 'adventure', step: o.step, scope: o.scope, campaignId: o.campaignId || null, threadId: o.threadId || null, adventureId: o.adventureId || null, payload: o.payload || {} }); }
  function generateEntity(o) { return invoke('foggy-assistant', { action: 'generate', scope: o.scope, campaignId: o.campaignId || null, threadId: o.threadId || null, message: o.message, payload: { kind: o.kind } }); }
  async function musicPlan(o) {
    var Cat = global.FogAudioCatalog;
    if (!Cat) return { ok: false, message: 'The music library isn\'t loaded.' };
    await Cat.ready();
    var catalog = Cat.list().map(function (t) { return { ref: 'rec:' + t.id, name: t.name, kind: t.kind, category: t.category, moods: t.moods || [], scenes: t.scenes || [], tags: t.tags || [] }; });
    var r = await invoke('foggy-assistant', { action: 'music_plan', scope: o.scope, campaignId: o.campaignId || null, adventureId: o.adventureId, payload: { catalog: catalog } });
    if (!r.ok) return r;
    // Checked again here: only tracks that exist in this library (and only places in the adventure) are kept.
    var cues = ((r.result && r.result.cues) || []).filter(function (c) { return !c.ref || (/^rec:/.test(c.ref) && Cat.get(c.ref.slice(4))); });
    return { ok: true, cues: cues, dropped: (r.result && r.result.dropped) || 0 };
  }
  function combatAdvice(o) { return invoke('foggy-assistant', { action: 'combat', scope: 'campaign', campaignId: o.campaignId, message: o.question || '', payload: { state: o.state } }); }
  /** Session preparation (campaign DM): inventory = { items: [{ id, kind, title, note }], missing: [text], where } */
  function prepareSession(o) { return invoke('foggy-assistant', { action: 'prepare', scope: 'campaign', campaignId: o.campaignId, payload: { inventory: o.inventory } }); }
  /** Logbook drafts from a session (campaign DM): session = { title, number, notes, details, results } */
  function sessionRecap(o) { return invoke('foggy-assistant', { action: 'recap', scope: 'campaign', campaignId: o.campaignId, payload: { session: o.session } }); }
  function generateImage(o) { return invoke('foggy-image', { kind: o.kind, title: o.title, prompt: o.prompt, scope: o.scope, campaignId: o.campaignId || null, grid: o.grid || null, style: o.style || '' }); }
  function listen(o) { return invoke('foggy-listen', { campaignId: o.campaignId, audio: o.audio, cues: o.cues, recent: o.recent || [] }); }

  // ---- conversations ----
  function threadFromRow(r) { return { id: r.id, scope: r.scope, campaignId: r.campaign_id, mode: r.mode, title: r.title, workspace: r.workspace || null, updatedAt: r.updated_at }; }
  async function listThreads(opts) {
    opts = opts || {};
    if (global.FogFoggyBackend && global.FogFoggyBackend.threads) return global.FogFoggyBackend.threads(opts);
    var c = sb();
    if (!c || typeof c.from !== 'function') return { ok: true, threads: [], notSetUp: true };
    var q = c.from('foggy_threads').select('id, scope, campaign_id, mode, title, workspace, updated_at').order('updated_at', { ascending: false }).limit(30);
    q = opts.scope === 'campaign' ? q.eq('scope', 'campaign').eq('campaign_id', opts.campaignId) : q.eq('scope', 'dashboard');
    if (opts.mode) q = q.eq('mode', opts.mode);
    var res = await q;
    if (res.error) return notSetUp(res.error) || /foggy_threads/.test(res.error.message || '') ? { ok: true, threads: [], notSetUp: true } : { ok: false, message: res.error.message };
    return { ok: true, threads: res.data.map(threadFromRow) };
  }
  async function threadMessages(id) {
    if (global.FogFoggyBackend && global.FogFoggyBackend.messages) return global.FogFoggyBackend.messages(id);
    var c = sb();
    if (!c) return { ok: true, messages: [] };
    var res = await c.from('foggy_messages').select('id, role, content, data, created_at').eq('thread_id', id).order('created_at', { ascending: true }).limit(200);
    return res.error ? { ok: false, message: res.error.message } : { ok: true, messages: res.data.map(function (m) { return { id: m.id, role: m.role, content: m.content, data: m.data || {}, createdAt: m.created_at }; }) };
  }
  async function deleteThread(id) {
    if (global.FogFoggyBackend && global.FogFoggyBackend.deleteThread) return global.FogFoggyBackend.deleteThread(id);
    var res = await sb().from('foggy_threads').delete().eq('id', id).select('id');
    return res.error ? { ok: false, message: res.error.message } : { ok: true };
  }
  async function saveWorkspace(id, ws) {
    if (global.FogFoggyBackend && global.FogFoggyBackend.saveWorkspace) return global.FogFoggyBackend.saveWorkspace(id, ws);
    var res = await sb().from('foggy_threads').update({ workspace: ws }).eq('id', id).select('id');
    return res.error ? { ok: false, message: res.error.message } : { ok: true };
  }

  // ---- images ----
  function imageFromRow(r) { return { id: r.id, scope: r.scope, campaignId: r.campaign_id, kind: r.kind, playable: !!r.playable, grid: r.grid, title: r.title, prompt: r.prompt, path: r.path, mime: r.mime, status: r.status, savedTo: r.saved_to, createdAt: r.created_at }; }
  async function listImages(opts) {
    opts = opts || {};
    if (global.FogFoggyBackend && global.FogFoggyBackend.images) return global.FogFoggyBackend.images(opts);
    var c = sb();
    if (!c || typeof c.from !== 'function') return { ok: true, images: [], notSetUp: true };
    var q = c.from('foggy_images').select('*').order('created_at', { ascending: false }).limit(60);
    q = opts.scope === 'campaign' ? q.eq('scope', 'campaign').eq('campaign_id', opts.campaignId) : q.eq('scope', 'dashboard');
    var res = await q;
    if (res.error) return /foggy_images|schema cache|does not exist/i.test(res.error.message || '') ? { ok: true, images: [], notSetUp: true } : { ok: false, message: res.error.message };
    return { ok: true, images: res.data.map(imageFromRow) };
  }
  async function imageUrls(paths) {
    if (global.FogFoggyBackend && global.FogFoggyBackend.imageUrls) return global.FogFoggyBackend.imageUrls(paths);
    var out = {};
    if (!paths.length || !sb()) return out;
    var res = await sb().storage.from('foggy-images').createSignedUrls(paths, 3600);
    (res.data || []).forEach(function (x) { if (x.signedUrl) out[x.path] = x.signedUrl; });
    return out;
  }
  async function deleteImage(img) {
    if (global.FogFoggyBackend && global.FogFoggyBackend.deleteImage) return global.FogFoggyBackend.deleteImage(img);
    await sb().storage.from('foggy-images').remove([img.path]);
    var res = await sb().from('foggy_images').delete().eq('id', img.id).select('id');
    return res.error ? { ok: false, message: res.error.message } : { ok: true };
  }
  /** Copies a generated picture into an adventure (as a JPEG in its private image folder) and records where it went. */
  async function saveImageToAdventure(img, adventureId, where) {
    var Store = global.FogAdventureStore, Img = global.FogContentImages, M = global.FogAdventureModel;
    if (!Store || !Img || !M) return { ok: false, message: 'Adventures aren\'t available here.' };
    var urls = await imageUrls([img.path]);
    if (!urls[img.path]) return { ok: false, message: 'The picture couldn\'t be opened.' };
    var blob;
    try { blob = await (await fetch(urls[img.path])).blob(); } catch (e) { return { ok: false, message: 'The picture couldn\'t be downloaded.' }; }
    var up = await Img.upload('adventures', adventureId, new File([blob], 'foggy.png', { type: blob.type || 'image/png' }));
    if (!up.ok) return up;
    var got = await Store.get(adventureId);
    if (!got.ok) return got;
    var a = got.adventure;
    var image = { id: 'img' + Date.now().toString(36), path: up.path, caption: img.title + (img.playable ? ' (battle map)' : ''), handout: false };
    if (where === 'cover') a.coverImage = a.coverImage || null;
    var asset = M.newAsset(img.kind === 'portrait' || img.kind === 'villain' ? 'portrait' : /map/.test(img.kind) ? 'map' : img.kind === 'monster' ? 'monster' : img.kind === 'item' ? 'item' : img.kind === 'spell' ? 'spell' : img.kind === 'handout' ? 'handout' : 'location',
      img.title, { summary: img.playable ? 'Playable battle map (' + (img.grid ? img.grid.cols + '×' + img.grid.rows + ' squares' : 'grid') + '). Check the grid before play.' : '', origin: 'foggy' });
    asset.images = [image];
    if (a.content.assets.length >= M.LIMITS.assets) return { ok: false, message: 'That adventure already has the maximum number of assets.' };
    a.content.assets.push(asset);
    var saved = await Store.save(a);
    if (!saved.ok) return saved;
    if (!(global.FogFoggyBackend && global.FogFoggyBackend.images)) await sb().from('foggy_images').update({ status: 'saved', saved_to: { adventureId: adventureId, assetId: asset.id } }).eq('id', img.id);
    return { ok: true, assetId: asset.id };
  }

  // ---- saving what Foggy made ----
  /** A generated monster / NPC / spell / magic item → a real homebrew entry (normalized and validated by the homebrew model). */
  async function saveToHomebrew(hb, draftId) {
    var HM = global.FogHomebrewModel, HS = global.FogHomebrewStore;
    if (!HM || !HS) return { ok: false, message: 'Homebrew isn\'t available here.' };
    var entry = HM.normalize({ kind: hb.kind, name: hb.name, summary: hb.summary || '', data: Object.assign({}, hb.data, { schema: 1 }) });
    var errs = HM.validate(entry);
    if (errs.length) return { ok: false, message: errs[0] };
    var made = await HS.create(entry.kind, entry.name);
    if (!made.ok) return made;
    var saved = await HS.save(Object.assign({}, made.entry, { name: entry.name, summary: entry.summary, data: entry.data }));
    if (saved.ok && draftId && sb() && typeof sb().from === 'function') await sb().from('foggy_content').update({ status: 'saved', saved_to: { homebrewId: made.entry.id } }).eq('id', draftId);
    return saved.ok ? { ok: true, id: made.entry.id } : saved;
  }
  /** An approved outline + written chapters → a NEW adventure, or new chapters appended to an existing one (nothing replaced). */
  async function saveAdventureDraft(ws, targetId) {
    var Store = global.FogAdventureStore, M = global.FogAdventureModel;
    if (!Store || !M) return { ok: false, message: 'Adventures aren\'t available here.' };
    var chapters = (ws.chapters || []).map(function (c) {
      var ch = M.newChapter(c.title);
      ch.summary = c.summary || ''; ch.dmNotes = c.dmNotes || '';
      (c.sections || []).forEach(function (s) {
        var kind = { item: 'object', handout: 'clue' }[s.kind] || (M.KINDS[s.kind] ? s.kind : 'scene');
        var sec = M.newSection(kind, s.title);
        sec.playerText = s.playerText || s.summary || ''; sec.dmNotes = s.dmNotes || ''; sec.fields = Object.assign({}, s.fields || {});
        ch.sections.push(sec);
      });
      return ch;
    });
    var a;
    if (targetId) {
      var got = await Store.get(targetId);
      if (!got.ok) return got;
      a = got.adventure;
      a.content.chapters = a.content.chapters.concat(chapters);
    } else {
      var made = await Store.create({ title: ws.title || 'New adventure', description: ws.pitch || '', genre: ws.genre || '', theme: ws.theme || '', levelMin: ws.levelMin || null, levelMax: ws.levelMax || null });
      if (!made.ok) return made;
      a = made.adventure;
      a.content.chapters = chapters;
    }
    var saved = await Store.save(a);
    return saved.ok ? { ok: true, adventureId: a.id, chapters: chapters.length } : saved;
  }
  /** One approved edit (from chat) applied to a section of an adventure, with the adventure's version check. */
  async function applyEdit(adventureId, edit) {
    var Store = global.FogAdventureStore;
    var got = await Store.get(adventureId);
    if (!got.ok) return got;
    var a = got.adventure, hit = null;
    a.content.chapters.forEach(function (ch) { ch.sections.forEach(function (s) { if (s.id === edit.target) hit = s; }); });
    if (!hit) return { ok: false, message: 'That section isn\'t in the adventure any more.' };
    var field = ['playerText', 'dmNotes', 'title'].indexOf(edit.field) >= 0 ? edit.field : 'playerText';
    hit[field] = edit.newText;
    var saved = await Store.save(a);
    return saved.ok ? { ok: true } : saved;
  }
  /** A reviewed music cue sheet saved into the adventure (content.musicCues). */
  async function saveMusicPlan(adventureId, cues) {
    var Store = global.FogAdventureStore;
    var got = await Store.get(adventureId);
    if (!got.ok) return got;
    got.adventure.content.musicCues = cues;
    var saved = await Store.save(got.adventure);
    return saved.ok ? { ok: true } : saved;
  }

  global.FogFoggy = {
    KINDS: KINDS, KIND_LABEL: KIND_LABEL, ASSET_KINDS: ASSET_KINDS, TONES: TONES, TIERS: TIERS,
    access: access, localAccess: localAccess, validate: validate, generate: generate,
    listDrafts: listDrafts, removeDraft: removeDraft, toAsset: toAsset, saveToAdventure: saveToAdventure,
    fromRow: fromRow, invoke: invoke, chat: chat, adventureStep: adventureStep, generateEntity: generateEntity, musicPlan: musicPlan, combatAdvice: combatAdvice, prepareSession: prepareSession, sessionRecap: sessionRecap,
    generateImage: generateImage, listen: listen, listThreads: listThreads, threadMessages: threadMessages, deleteThread: deleteThread, saveWorkspace: saveWorkspace,
    listImages: listImages, imageUrls: imageUrls, deleteImage: deleteImage, saveImageToAdventure: saveImageToAdventure,
    saveToHomebrew: saveToHomebrew, saveAdventureDraft: saveAdventureDraft, applyEdit: applyEdit, saveMusicPlan: saveMusicPlan,
  };
})(typeof window !== 'undefined' ? window : globalThis);
