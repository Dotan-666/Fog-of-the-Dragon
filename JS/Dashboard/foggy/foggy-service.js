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
    foggie: { name: 'Foggie', line: 'Campaign Writing Helper', plan: 'Dungeon Master' },
    foggie_plus: { name: 'Foggie+', line: 'Advanced AI Assistant', plan: 'Fogger of the Dragons' },
  };

  function sb() { return global.FogSupabase && global.FogSupabase.client; }
  function notSetUp(err) { return /function .* does not exist|Could not find the function|schema cache|relation .* does not exist|foggy_content/i.test((err && err.message) || ''); }

  /** The same rules as private.foggy_access, for when the database can't be asked (generation always off then). */
  function localAccess(campaignId, isCampaignDm) {
    var plan = (global.FogAccount && global.FogAccount.getPlan && global.FogAccount.getPlan() || {}).id || 'warlord';
    var tier = plan === 'dungeon-master' ? 'foggie' : plan === 'fogger-of-the-dragons' ? 'foggie_plus' : null;
    var campaign = !!campaignId && plan === 'fogger-of-the-dragons' && !!isCampaignDm;
    return { plan: plan, tier: tier, enabled: false, dashboard: !!tier, campaign: campaign, canGenerate: false };
  }

  async function access(campaignId, opts) {
    opts = opts || {};
    var client = sb();
    if (!client || typeof client.rpc !== 'function') return { ok: true, access: localAccess(campaignId, opts.isCampaignDm), source: 'local' };
    try {
      var res = await client.rpc('foggy_access', { p_campaign: campaignId || null });
      if (res.error) {
        if (notSetUp(res.error)) return { ok: true, access: localAccess(campaignId, opts.isCampaignDm), source: 'local' };
        return { ok: false, message: 'Foggy’s access could not be checked (' + res.error.message + ').' };
      }
      return { ok: true, access: res.data, source: 'server' };
    } catch (e) {
      return { ok: false, message: 'Foggy’s access could not be checked. Check your connection and try again.' };
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
    if (request.scope === 'campaign' ? !a.campaign : !a.dashboard) return { ok: false, code: 'plan', message: request.scope === 'campaign' ? 'Campaign Foggy is part of the Fogger of the Dragons plan.' : 'Foggy is part of the Dungeon Master and Fogger of the Dragons plans.' };
    if (!a.canGenerate) return { ok: false, code: 'not_enabled', message: 'Foggy isn’t switched on yet, so nothing was generated and nothing was sent anywhere.' };
    // Switched on: the Edge Function decides the rest (AI key present, daily cap) and writes the draft.
    var client = sb();
    if (!client || !client.functions) return { ok: false, code: 'error', message: 'Foggy can’t reach the server.' };
    var res = await client.functions.invoke('foggy-generate', { body: { kind: request.kind, scope: request.scope, campaignId: request.campaignId || null, adventureId: request.adventureId || null, prompt: request.prompt, options: request.options || {} } });
    if (res.error) {
      var msg = 'Foggy couldn’t make that.';
      var code = 'error';
      try { if (res.error.context && res.error.context.json) { var j = await res.error.context.json(); msg = j.error || msg; code = j.code || code; } } catch (e) { /* keep generic */ }
      if (code === 'error' && /Failed to send|fetch|network/i.test(String(res.error.message || ''))) msg = 'Foggy can’t reach the server. If this keeps happening, the foggy-generate function may not be deployed yet.';
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
    if (!asset) return { ok: false, message: 'This kind of draft can’t be added as an adventure asset.' };
    if (!Store) return { ok: false, message: 'Adventures aren’t available here.' };
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

  global.FogFoggy = {
    KINDS: KINDS, KIND_LABEL: KIND_LABEL, ASSET_KINDS: ASSET_KINDS, TONES: TONES, TIERS: TIERS,
    access: access, localAccess: localAccess, validate: validate, generate: generate,
    listDrafts: listDrafts, removeDraft: removeDraft, toAsset: toAsset, saveToAdventure: saveToAdventure,
  };
})(typeof window !== 'undefined' ? window : globalThis);
