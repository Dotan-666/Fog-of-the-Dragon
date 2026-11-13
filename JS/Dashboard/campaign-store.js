/**
 * Campaigns, stored in Supabase (tables public.campaigns and public.campaign_members).
 *
 * - You see campaigns you run (DM) and campaigns you joined (player). Row Level Security enforces this.
 * - Joining, setting a party character and starting a campaign go through database functions
 *   (join_campaign, set_member_character, start_campaign) that check who is asking.
 * - Every method is async and resolves { ok, ... } or { ok: false, message }.
 *
 * Campaigns from the old browser-only version are not migrated (they stay in this browser, unused).
 */
(function (global) {
  'use strict';

  var COVER_MAX_SIDE = 640;
  var COVER_BUCKET = 'campaign-covers';

  function sb() {
    return global.FogSupabase && global.FogSupabase.client;
  }

  function me() {
    var acc = global.FogAccount.getAccount();
    return acc ? acc.id : null;
  }

  function plan() {
    return global.FogAccount.getPlan();
  }

  function fail(error, fallback) {
    var msg = error && error.message ? error.message : fallback;
    if (/Failed to fetch|NetworkError/i.test(msg || '')) msg = 'Can’t reach the server. Check your connection and try again.';
    if (/adventure_id/.test(msg || '') && /does not exist|Could not find|schema cache/i.test(msg || '')) {
      msg = 'Campaigns now need an adventure, and the database isn’t updated yet. The site owner needs to run supabase/migrations/20261109120000_adventures.sql and 20261110120000_campaign_requires_adventure.sql in Supabase → SQL Editor.';
    } else if (/relation .* does not exist|column .* does not exist|function .* does not exist|Could not find the function/i.test(msg || '')) {
      msg = 'The campaign database isn’t set up yet. The site owner needs to run supabase/migrations/20261106120000_campaign_play.sql once in Supabase → SQL Editor, then reload this page.';
    }
    return { ok: false, message: msg || fallback || 'Something went wrong.' };
  }

  function notReady() {
    if (!sb()) return { ok: false, message: (global.FogSupabase && global.FogSupabase.configError) || 'Supabase is not available.' };
    if (!me()) return { ok: false, message: 'Sign in to use campaigns.' };
    return null;
  }

  function isSafeCoverUrl(url) {
    var cfg = global.FOG_SUPABASE_CONFIG;
    return typeof url === 'string' && !!cfg && url.indexOf(cfg.url + '/storage/v1/object/public/' + COVER_BUCKET + '/') === 0 && !/["'<>\s]/.test(url);
  }

  /** Database row (+ embedded members) → the shape the pages use. */
  function fromRow(r) {
    var members = (r.campaign_members || []).filter(function (m) { return m.status === 'active'; });
    var uid = me();
    return {
      id: r.id,
      ownerId: r.owner_id,
      role: r.owner_id === uid ? 'dm' : 'player',
      name: r.name,
      description: r.description || '',
      status: r.status,
      phase: r.phase || 'recruiting',
      source: r.content_source,
      startingLevel: r.starting_level,
      requiredPlayers: r.required_players,
      privacy: r.visibility,
      inviteCode: r.invite_code,
      coverUrl: isSafeCoverUrl(r.image_url) ? r.image_url : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      archivedAt: r.archived_at,
      startedAt: r.started_at || null,
      adventureId: r.adventure_id || null,
      memberCount: members.length,
      playersWithCharacters: members.filter(function (m) { return m.role === 'player' && m.character_name; }).length,
    };
  }

  var SELECT = '*, campaign_members(user_id, role, status, character_name)';

  async function list(status) {
    var nr = notReady();
    if (nr) return nr;
    var q = sb().from('campaigns').select(SELECT).order('updated_at', { ascending: false });
    if (status) q = q.eq('status', status);
    var res = await q;
    if (res.error) return fail(res.error, 'Could not load campaigns.');
    return { ok: true, campaigns: res.data.map(fromRow) };
  }

  async function get(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaigns').select(SELECT).eq('id', id).maybeSingle();
    if (res.error) return fail(res.error, 'Could not load the campaign.');
    if (!res.data) return { ok: false, notFound: true, message: 'This campaign doesn’t exist, or you aren’t part of it.' };
    var roster = await sb().rpc('campaign_roster', { target_campaign: id });
    if (roster.error) return fail(roster.error, 'Could not load the party.');
    var c = fromRow(res.data);
    c.roster = (roster.data || []).map(function (m) {
      return {
        userId: m.user_id, role: m.role, status: m.status, joinedAt: m.joined_at, isMe: m.user_id === me(),
        displayName: m.display_name, avatarUrl: global.FogAccount.isSafeAvatarUrl(m.avatar_url) ? m.avatar_url : null,
        character: m.character_data || null, characterName: m.character_name || null,
        characterBuiltBy: m.character_built_by || null, characterUpdatedAt: m.character_updated_at || null,
      };
    });
    return { ok: true, campaign: c };
  }

  /** Campaigns you run that are active (the plan limit counts only these). */
  async function ownedActiveCount() {
    var nr = notReady();
    if (nr) return 0;
    var res = await sb().from('campaigns').select('id', { count: 'exact', head: true }).eq('owner_id', me()).eq('status', 'active');
    return res.error ? 0 : res.count || 0;
  }

  async function canActivateAnother() {
    return (await ownedActiveCount()) < plan().activeCampaigns;
  }

  function limitMessage(verb) {
    var p = plan();
    return 'Your ' + p.name + ' plan allows ' + p.activeCampaigns + ' active campaign' + (p.activeCampaigns === 1 ? '' : 's') + ' that you run. ' + verb;
  }

  /** Validates editable fields. Returns an error message or null. */
  function validate(data) {
    if (!data.name || !String(data.name).trim()) return 'Give your campaign a name.';
    if (String(data.name).trim().length > 80) return 'Keep the campaign name under 80 characters.';
    if (String(data.description || '').length > 2000) return 'Keep the description under 2000 characters.';
    var lvl = Number(data.startingLevel);
    if (!(lvl >= 1 && lvl <= 20)) return 'Starting level must be between 1 and 20.';
    var players = Number(data.requiredPlayers);
    var max = plan().maxPeople;
    if (!(players >= 1)) return 'At least 1 person (the DM) is required.';
    if (players > max) return 'Your ' + plan().name + ' plan allows up to ' + max + ' people per campaign, including the DM.';
    if (['public', 'private'].indexOf(data.privacy) < 0) return 'Choose who can see the campaign.';
    return null;
  }

  function toRow(data) {
    return {
      name: String(data.name || '').trim(),
      description: String(data.description || '').trim(),
      content_source: data.source === 'existing' ? 'existing' : 'homebrew',
      starting_level: Number(data.startingLevel),
      required_players: Number(data.requiredPlayers),
      visibility: data.privacy,
    };
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(',');
    var mime = parts[0].match(/data:([^;]+)/)[1];
    var bin = atob(parts[1]);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  /** Uploads a compressed cover (data URL) to campaign-covers/<you>/<campaign>-<time>.jpg. */
  async function uploadCover(campaignId, dataUrl) {
    var path = me() + '/' + campaignId + '-' + Date.now() + '.jpg';
    var up = await sb().storage.from(COVER_BUCKET).upload(path, dataUrlToBlob(dataUrl), { contentType: 'image/jpeg', upsert: false, cacheControl: '60' });
    if (up.error) return fail(up.error, 'Could not upload the cover image.');
    await removeCovers(campaignId, path);
    return { ok: true, url: sb().storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl };
  }

  async function removeCovers(campaignId, keepPath) {
    var listed = await sb().storage.from(COVER_BUCKET).list(me());
    if (listed.error || !listed.data) return;
    var old = listed.data.map(function (f) { return me() + '/' + f.name; })
      .filter(function (p) { return p !== keepPath && p.indexOf(me() + '/' + campaignId + '-') === 0; });
    if (old.length) await sb().storage.from(COVER_BUCKET).remove(old);
  }

  async function create(data) {
    var nr = notReady();
    if (nr) return nr;
    var err = validate(data) || (data.adventureId ? null : 'Choose the adventure this campaign runs.');
    if (err) return { ok: false, message: err };
    if (!(await canActivateAnother())) return { ok: false, message: limitMessage('Archive one to make room, or upgrade your plan.') };
    var res = await sb().from('campaigns').insert(Object.assign(toRow(data), { adventure_id: data.adventureId })).select('id, name, invite_code').single();
    if (res.error) return fail(res.error, 'Could not create the campaign.');
    var id = res.data.id;
    var note = '';
    if (global.FogAccount.isSafeImageUrl(data.coverDataUrl)) {
      var up = await uploadCover(id, data.coverDataUrl);
      if (up.ok) await sb().from('campaigns').update({ image_url: up.url }).eq('id', id);
      else note = ' The cover image couldn’t be uploaded; add it from the campaign settings.';
    }
    global.FogNotifications.add({ kind: 'campaign', title: 'Campaign created: ' + res.data.name, message: 'Invite code ' + res.data.invite_code + '. Share it with your players so they can join.' + note, link: '#campaigns/' + id });
    return { ok: true, campaign: { id: id, inviteCode: res.data.invite_code }, warning: note || null };
  }

  /** patch: editable fields; coverDataUrl: undefined = unchanged, null = remove, data URL = new cover. */
  async function update(id, patch) {
    var nr = notReady();
    if (nr) return nr;
    var cur = await get(id);
    if (!cur.ok) return cur;
    var c = cur.campaign;
    if (c.role !== 'dm') return { ok: false, message: 'Only the Dungeon Master can change campaign settings.' };
    if (c.status === 'archived') return { ok: false, message: 'Restore the campaign before changing its settings.' };
    var merged = Object.assign({}, c, patch);
    var err = validate(merged);
    if (err) return { ok: false, message: err };
    if (Number(merged.requiredPlayers) < c.memberCount) return { ok: false, message: c.memberCount + ' people are already in this campaign; the number needed can’t be lower than that.' };
    var row = toRow(merged);
    if (patch.coverDataUrl === null) {
      row.image_url = null;
      await removeCovers(id, null);
    } else if (patch.coverDataUrl) {
      var up = await uploadCover(id, patch.coverDataUrl);
      if (!up.ok) return up;
      row.image_url = up.url;
    }
    var res = await sb().from('campaigns').update(row).eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not save the settings.');
    global.FogNotifications.add({ kind: 'campaign', title: 'Campaign settings saved: ' + row.name, link: '#campaigns/' + id });
    return { ok: true };
  }

  async function setStatus(id, status) {
    var nr = notReady();
    if (nr) return nr;
    if (status === 'active' && !(await canActivateAnother())) return { ok: false, message: limitMessage('Archive another campaign first, or upgrade your plan.') };
    var res = await sb().from('campaigns').update({ status: status }).eq('id', id).eq('owner_id', me()).select('name');
    if (res.error) return fail(res.error, 'Could not change the campaign.');
    if (!res.data.length) return { ok: false, message: 'Only the Dungeon Master can do that.' };
    var name = res.data[0].name;
    global.FogNotifications.add(status === 'archived'
      ? { kind: 'campaign', title: 'Campaign archived: ' + name, message: 'Its info and settings are kept in the Archive.', link: '#campaigns/' + id }
      : { kind: 'campaign', title: 'Campaign restored: ' + name, link: '#campaigns/' + id });
    return { ok: true };
  }

  async function remove(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaigns').delete().eq('id', id).eq('owner_id', me()).select('name');
    if (res.error) return fail(res.error, 'Could not delete the campaign.');
    if (!res.data.length) return { ok: false, message: 'Only the Dungeon Master can delete a campaign.' };
    await removeCovers(id, null);
    global.FogNotifications.add({ kind: 'campaign', title: 'Campaign deleted: ' + res.data[0].name });
    return { ok: true };
  }

  /** Deletes every campaign you run (Settings → Clear All Campaign Data). */
  async function removeAllOwned() {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaigns').delete().eq('owner_id', me()).select('id');
    if (res.error) return fail(res.error, 'Could not delete your campaigns.');
    var listed = await sb().storage.from(COVER_BUCKET).list(me());
    if (!listed.error && listed.data && listed.data.length) await sb().storage.from(COVER_BUCKET).remove(listed.data.map(function (f) { return me() + '/' + f.name; }));
    return { ok: true, count: res.data.length };
  }

  async function join(code) {
    var nr = notReady();
    if (nr) return nr;
    var clean = String(code || '').trim().toUpperCase();
    if (!/^FOD-\d{4}-[A-Z]{2}$/.test(clean)) return { ok: false, message: 'Invite codes look like FOD-1234-AB.' };
    var res = await sb().rpc('join_campaign', { code: clean });
    if (res.error) return fail(res.error, 'Could not join the campaign.');
    global.FogNotifications.add({ kind: 'campaign', title: 'Joined a campaign', message: 'Choose or build your character for it.', link: '#campaigns/' + res.data });
    return { ok: true, id: res.data };
  }

  /** DM only: use one of your adventures as this campaign's content (or null to unlink). Nothing is copied. */
  async function setAdventure(id, adventureId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaigns').update({ adventure_id: adventureId || null }).eq('id', id).eq('owner_id', me()).select('id');
    if (res.error) {
      if (/adventure_id/.test(res.error.message || '')) return { ok: false, message: 'Linking adventures needs the latest database update (supabase/migrations/20261109120000_adventures.sql).' };
      return fail(res.error, 'Could not change the adventure.');
    }
    if (!res.data.length) return { ok: false, message: 'Only the Dungeon Master can do that.' };
    return { ok: true };
  }

  /** A player leaves, or the DM removes a player (before the campaign starts). */
  async function removeMember(id, userId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_members').delete().eq('campaign_id', id).eq('user_id', userId).neq('role', 'owner').select('user_id');
    if (res.error) return fail(res.error, 'Could not remove that member.');
    if (!res.data.length) return { ok: false, message: 'That isn’t possible once the campaign has started.' };
    return { ok: true };
  }

  /** The part of a character document shared with the party (no derived numbers: they are recomputed). */
  function snapshot(doc) {
    return {
      schemaVersion: doc.schemaVersion,
      rules: doc.rules || null,
      sourceCharacterId: doc.id,
      choices: doc.choices,
      narrative: doc.narrative,
    };
  }

  async function setCharacter(id, userId, doc) {
    var nr = notReady();
    if (nr) return nr;
    var data = snapshot(doc);
    if (JSON.stringify(data).length > 380000) {
      data = Object.assign({}, data, { narrative: Object.assign({}, data.narrative, { portraitDataUrl: null }) });
    }
    var res = await sb().rpc('set_member_character', {
      target_campaign: id, target_user: userId, p_character: data, p_character_name: (doc.narrative && doc.narrative.name) || 'Unnamed character',
    });
    if (res.error) return fail(res.error, 'Could not set the character.');
    return { ok: true };
  }

  async function clearCharacter(id, userId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('clear_member_character', { target_campaign: id, target_user: userId });
    if (res.error) return fail(res.error, 'Could not clear the character.');
    return { ok: true };
  }


  /** After the start: one legitimate level at a time, for your own character (the database checks the rest). */
  async function levelUp(id, doc) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('level_up_member_character', { target_campaign: id, p_character: snapshot(doc) });
    if (res.error) return fail(res.error, 'Could not record the level-up.');
    return { ok: true, level: res.data };
  }

  /** The DM's logged correction of a locked setting. action: set_adventure | set_starting_level | replace_character | remove_member. */
  async function overrideLock(id, action, payload, reason) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('override_campaign_lock', { target_campaign: id, p_action: action, p_payload: payload || {}, p_reason: reason || '' });
    if (res.error) return fail(res.error, 'Could not apply the correction.');
    return { ok: true };
  }

  async function start(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('start_campaign', { target_campaign: id });
    if (res.error) return fail(res.error, 'Could not start the campaign.');
    global.FogNotifications.add({ kind: 'campaign', title: 'Campaign started', link: '#campaigns/' + id });
    return { ok: true };
  }

  function compressCover(file) {
    return global.FogAccount.compressImage(file, COVER_MAX_SIDE);
  }

  global.FogCampaignStore = {
    list: list,
    get: get,
    create: create,
    update: update,
    archive: function (id) { return setStatus(id, 'archived'); },
    restore: function (id) { return setStatus(id, 'active'); },
    remove: remove,
    removeAllOwned: removeAllOwned,
    join: join,
    setAdventure: setAdventure,
    PLAYER_CAMPAIGN_LIMIT: 3, // enforced by join_campaign (migration 20261107120000_player_campaign_limit.sql)
    removeMember: removeMember,
    setCharacter: setCharacter,
    clearCharacter: clearCharacter,
    start: start,
    levelUp: levelUp,
    overrideLock: overrideLock,
    snapshot: snapshot,
    ownedActiveCount: ownedActiveCount,
    canActivateAnother: canActivateAnother,
    validate: validate,
    compressCover: compressCover,
    isSafeCoverUrl: isSafeCoverUrl,
    plan: plan,
  };
})(window);
