/**
 * Campaign workspace data (tables from supabase/migrations/20261112120000_campaign_workspace.sql).
 *
 * Messages, meetings and RSVPs, combat, adventure progress, revealed content and invite codes for the campaign
 * that is open in the Campaign SPA. Campaigns and members themselves stay in FogCampaignStore.
 *
 * Every method is async and resolves { ok, ... } or { ok: false, message }; nothing reports success unless the
 * database confirmed it. Row Level Security decides who can read or write: these methods only ask.
 */
(function (global) {
  'use strict';

  var PAGE = 30;

  function sb() { return global.FogSupabase && global.FogSupabase.client; }
  function me() {
    var acc = global.FogAccount && global.FogAccount.getAccount();
    return acc ? acc.id : null;
  }
  function notReady() {
    if (!sb()) return { ok: false, message: (global.FogSupabase && global.FogSupabase.configError) || 'Supabase is not available.' };
    if (!me()) return { ok: false, message: 'Sign in to use campaigns.' };
    return null;
  }
  function fail(error, fallback) {
    var msg = error && error.message ? error.message : fallback;
    if (/Failed to fetch|NetworkError/i.test(msg || '')) msg = 'Can’t reach the server. Check your connection and try again.';
    else if (/relation .* does not exist|function .* does not exist|Could not find the (table|function)|schema cache/i.test(msg || '')) {
      msg = 'The campaign workspace database isn’t set up yet. The site owner needs to run supabase/migrations/20261112120000_campaign_workspace.sql once in Supabase → SQL Editor, then reload this page.';
    } else if (/row-level security/i.test(msg || '')) {
      msg = 'You don’t have permission to do that in this campaign.';
    }
    return { ok: false, message: msg || fallback || 'Something went wrong.' };
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  function messageFromRow(r) {
    return { id: r.id, campaignId: r.campaign_id, authorId: r.author_id, body: r.body, createdAt: r.created_at };
  }

  /** The newest page of messages (oldest first). Pass before = createdAt of the oldest loaded message for earlier ones. */
  async function listMessages(campaignId, before) {
    var nr = notReady();
    if (nr) return nr;
    var q = sb().from('campaign_messages').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(PAGE + 1);
    if (before) q = q.lt('created_at', before);
    var res = await q;
    if (res.error) return fail(res.error, 'Could not load the messages.');
    var more = res.data.length > PAGE;
    var rows = res.data.slice(0, PAGE).reverse();
    return { ok: true, messages: rows.map(messageFromRow), hasMore: more };
  }

  async function sendMessage(campaignId, body) {
    var nr = notReady();
    if (nr) return nr;
    var text = String(body || '').trim();
    if (!text) return { ok: false, message: 'Write a message first.' };
    if (text.length > 2000) return { ok: false, message: 'Messages can be up to 2000 characters.' };
    var res = await sb().from('campaign_messages').insert({ campaign_id: campaignId, body: text }).select('*').single();
    if (res.error) return fail(res.error, 'Could not send the message.');
    return { ok: true, message: messageFromRow(res.data) };
  }

  async function deleteMessage(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_messages').delete().eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not delete the message.');
    if (!res.data.length) return { ok: false, message: 'You can only delete your own messages.' };
    return { ok: true };
  }

  /**
   * Live updates through Supabase Realtime (postgres_changes; the database policies decide who receives what).
   * handlers: { onMessage(msg), onMessageDeleted(id), onMeeting(), onCombat(), onReveal(), onRoom(room|null), onStatus(status) }
   * Returns a function that stops listening. If Realtime isn't enabled for the project, onStatus reports it.
   */
  function subscribe(campaignId, handlers) {
    var client = sb();
    if (!client || !client.channel) return function () {};
    var filter = 'campaign_id=eq.' + campaignId;
    var ch = client.channel('campaign:' + campaignId);
    function on(table, event, cb) {
      ch.on('postgres_changes', { event: event, schema: 'public', table: table, filter: filter }, cb);
    }
    if (handlers.onMessage) on('campaign_messages', 'INSERT', function (p) { handlers.onMessage(messageFromRow(p.new)); });
    // Deletes carry only the primary key (no campaign filter is possible), so listen unfiltered; RLS still applies.
    if (handlers.onMessageDeleted) {
      ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'campaign_messages' }, function (p) { if (p.old && p.old.id) handlers.onMessageDeleted(p.old.id); });
    }
    if (handlers.onMeeting) on('campaign_meetings', '*', function () { handlers.onMeeting(); });
    if (handlers.onCombat) on('campaign_combat_public', '*', function () { handlers.onCombat(); });
    if (handlers.onReveal) on('campaign_reveals', '*', function () { handlers.onReveal(); });
    if (handlers.onSchedule) {
      on('campaign_schedule_requests', '*', function () { handlers.onSchedule(); });
      // Answers and confirmations carry no campaign id, so listen unfiltered (the database only sends what this person may read).
      ['campaign_schedule_responses', 'campaign_schedule_confirmations'].forEach(function (t) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, function () { handlers.onSchedule(); });
      });
    }
    if (handlers.onMemory) on('campaign_memories', '*', function () { handlers.onMemory(); });
    if (handlers.onRoom) {
      on('meeting_rooms', '*', function (p) { handlers.onRoom(p.new && p.new.id ? roomFromRow(p.new) : null); });
      on('meeting_room_participants', '*', function () { handlers.onRoom(null); });
    }
    ch.subscribe(function (status) { if (handlers.onStatus) handlers.onStatus(status); });
    return function () { client.removeChannel(ch); };
  }

  // ---------------------------------------------------------------------------
  // Meetings
  // ---------------------------------------------------------------------------
  function meetingFromRow(r) {
    return {
      id: r.id, campaignId: r.campaign_id, createdBy: r.created_by, title: r.title, startsAt: r.starts_at, endsAt: r.ends_at,
      location: r.location || '', description: r.description || '', status: r.status, summary: r.summary || '', venue: r.venue || null,
      completedAt: r.completed_at, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  function validateMeeting(m) {
    if (!m.title || !String(m.title).trim()) return 'Give the meeting a title.';
    if (String(m.title).trim().length > 120) return 'Keep the title under 120 characters.';
    if (!m.startsAt || isNaN(new Date(m.startsAt).getTime())) return 'Choose a date and time.';
    if (m.endsAt && new Date(m.endsAt) <= new Date(m.startsAt)) return 'The meeting must end after it starts.';
    if (String(m.location || '').length > 200) return 'Keep the location under 200 characters.';
    if (String(m.description || '').length > 2000) return 'Keep the description under 2000 characters.';
    return null;
  }

  var DEFAULT_MEETING_LENGTH_MS = 3 * 3600 * 1000;

  /** A meeting is "past" when it was completed or cancelled, or when its end (or start + 3 hours) has gone by. */
  function meetingIsPast(m, now) {
    var end = new Date(m.endsAt || new Date(m.startsAt).getTime() + DEFAULT_MEETING_LENGTH_MS).getTime();
    return m.status !== 'scheduled' || end < (now || Date.now());
  }

  async function listMeetings(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_meetings').select('*').eq('campaign_id', campaignId).order('starts_at', { ascending: true });
    if (res.error) return fail(res.error, 'Could not load the meetings.');
    var meetings = res.data.map(meetingFromRow);
    var rs = meetings.length ? await sb().from('campaign_meeting_rsvps').select('meeting_id, user_id, response').in('meeting_id', meetings.map(function (m) { return m.id; })) : { data: [] };
    if (rs.error) return fail(rs.error, 'Could not load the answers.');
    meetings.forEach(function (m) {
      m.rsvps = rs.data.filter(function (r) { return r.meeting_id === m.id; }).map(function (r) { return { userId: r.user_id, response: r.response }; });
    });
    return { ok: true, meetings: meetings };
  }

  function meetingRow(m) {
    var row = {
      title: String(m.title).trim(),
      starts_at: new Date(m.startsAt).toISOString(),
      ends_at: m.endsAt ? new Date(m.endsAt).toISOString() : null,
      location: String(m.location || '').trim(),
      description: String(m.description || '').trim(),
    };
    // Where it happens ('fog' gets a Meeting in the Fog room). Only sent when the form says so (older databases lack the column).
    if (m.venue !== undefined) row.venue = m.venue === 'fog' || m.venue === 'in_person' ? m.venue : null;
    return row;
  }

  async function createMeeting(campaignId, m) {
    var nr = notReady();
    if (nr) return nr;
    var err = validateMeeting(m);
    if (err) return { ok: false, message: err };
    var res = await sb().from('campaign_meetings').insert(Object.assign({ campaign_id: campaignId }, meetingRow(m))).select('*').single();
    if (res.error) return fail(res.error, 'Could not schedule the meeting.');
    return { ok: true, meeting: meetingFromRow(res.data) };
  }

  async function updateMeeting(id, m) {
    var nr = notReady();
    if (nr) return nr;
    var err = validateMeeting(m);
    if (err) return { ok: false, message: err };
    var res = await sb().from('campaign_meetings').update(meetingRow(m)).eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not save the meeting.');
    if (!res.data.length) return { ok: false, message: 'Only the Dungeon Master can change meetings, and not in an archived campaign.' };
    return { ok: true };
  }

  /** status: 'scheduled' | 'completed' | 'cancelled'. Completing may carry the summary of what happened. */
  async function setMeetingStatus(id, status, summary) {
    var nr = notReady();
    if (nr) return nr;
    var patch = { status: status };
    if (summary !== undefined) {
      if (String(summary).length > 8000) return { ok: false, message: 'Keep the summary under 8000 characters.' };
      patch.summary = String(summary).trim();
    }
    var res = await sb().from('campaign_meetings').update(patch).eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not change the meeting.');
    if (!res.data.length) return { ok: false, message: 'Only the Dungeon Master can change meetings, and not in an archived campaign.' };
    return { ok: true };
  }

  async function deleteMeeting(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_meetings').delete().eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not delete the meeting.');
    if (!res.data.length) return { ok: false, message: 'Completed meetings stay in the campaign history, and only the Dungeon Master can delete the others.' };
    return { ok: true };
  }

  async function setRsvp(meetingId, response) {
    var nr = notReady();
    if (nr) return nr;
    if (['yes', 'maybe', 'no'].indexOf(response) < 0) return { ok: false, message: 'Choose Yes, Maybe or No.' };
    // Update first, insert when there is no answer yet (an upsert would also write the key columns, which are not writable).
    var upd = await sb().from('campaign_meeting_rsvps').update({ response: response }).eq('meeting_id', meetingId).eq('user_id', me()).select('meeting_id');
    if (upd.error) return fail(upd.error, 'Could not save your answer.');
    if (upd.data.length) return { ok: true };
    var ins = await sb().from('campaign_meeting_rsvps').insert({ meeting_id: meetingId, response: response }).select('meeting_id');
    if (ins.error) return fail(ins.error, 'Could not save your answer.');
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Combat (the DM reads the full state; everyone reads the public one)
  // ---------------------------------------------------------------------------
  async function getCombat(campaignId, asDm) {
    var nr = notReady();
    if (nr) return nr;
    if (asDm) {
      var full = await sb().from('campaign_combats').select('state, version').eq('campaign_id', campaignId).maybeSingle();
      if (full.error) return fail(full.error, 'Could not load the encounter.');
      return { ok: true, encounter: full.data ? full.data.state : null, version: full.data ? full.data.version : null };
    }
    var pub = await sb().from('campaign_combat_public').select('state').eq('campaign_id', campaignId).maybeSingle();
    if (pub.error) return fail(pub.error, 'Could not load the encounter.');
    return { ok: true, encounter: pub.data ? pub.data.state : null };
  }

  /** Saves the full encounter and the player view together; expectedVersion guards against another tab's changes. */
  async function saveCombat(campaignId, encounter, expectedVersion) {
    var nr = notReady();
    if (nr) return nr;
    var model = global.FogCombatModel;
    var res = await sb().rpc('save_campaign_combat', {
      target_campaign: campaignId, p_state: encounter, p_public: model.publicView(encounter), expected_version: expectedVersion == null ? null : expectedVersion,
    });
    if (res.error) {
      var out = fail(res.error, 'Could not save the encounter.');
      if (/changed somewhere else/.test(out.message)) out.conflict = true;
      return out;
    }
    return { ok: true, version: res.data };
  }

  async function clearCombat(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('clear_campaign_combat', { target_campaign: campaignId });
    if (res.error) return fail(res.error, 'Could not clear the encounter.');
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Adventure progress (DM) and revealed content (everyone)
  // ---------------------------------------------------------------------------
  async function getProgress(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_progress').select('current_section, completed_sections, updated_at').eq('campaign_id', campaignId).maybeSingle();
    if (res.error) return fail(res.error, 'Could not load the progress.');
    return { ok: true, progress: res.data ? { currentSection: res.data.current_section, completed: res.data.completed_sections || [], updatedAt: res.data.updated_at } : { currentSection: null, completed: [], updatedAt: null } };
  }

  async function saveProgress(campaignId, progress) {
    var nr = notReady();
    if (nr) return nr;
    var row = { current_section: progress.currentSection || null, completed_sections: progress.completed || [] };
    var upd = await sb().from('campaign_progress').update(row).eq('campaign_id', campaignId).select('campaign_id');
    if (upd.error) return fail(upd.error, 'Could not save the progress.');
    if (upd.data.length) return { ok: true };
    var ins = await sb().from('campaign_progress').insert(Object.assign({ campaign_id: campaignId }, row)).select('campaign_id');
    if (ins.error) return fail(ins.error, 'Could not save the progress.');
    return { ok: true };
  }

  function revealFromRow(r) {
    return { id: r.id, sectionId: r.section_id, kind: r.kind, title: r.title, chapterTitle: r.chapter_title || '', body: r.body || '', createdAt: r.created_at };
  }

  async function listReveals(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_reveals').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false });
    if (res.error) return fail(res.error, 'Could not load the shared content.');
    return { ok: true, reveals: res.data.map(revealFromRow) };
  }

  /** Shares the player-facing text of one adventure section. DM notes are never part of this. */
  async function addReveal(campaignId, r) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_reveals').insert({
      campaign_id: campaignId, section_id: r.sectionId, kind: r.kind || 'scene', title: r.title, chapter_title: r.chapterTitle || '', body: String(r.body || '').slice(0, 6000),
    }).select('*').single();
    if (res.error) {
      if (/duplicate key/i.test(res.error.message || '')) return { ok: false, message: 'Already shared with the players.' };
      return fail(res.error, 'Could not share this with the players.');
    }
    return { ok: true, reveal: revealFromRow(res.data) };
  }

  async function removeReveal(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_reveals').delete().eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not hide this again.');
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Invitations
  // ---------------------------------------------------------------------------
  async function regenerateInviteCode(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('regenerate_invite_code', { target_campaign: campaignId });
    if (res.error) return fail(res.error, 'Could not change the invite code.');
    return { ok: true, code: res.data };
  }


  // ---------------------------------------------------------------------------
  // Availability scheduler (functions in the refinements migration enforce every rule)
  // ---------------------------------------------------------------------------
  function scheduleFromRow(r) {
    return {
      id: r.id, campaignId: r.campaign_id, createdBy: r.created_by, title: r.title, notes: r.notes || '', format: r.format,
      durationMinutes: r.duration_minutes, slots: r.slots || [], due: r.responses_due, status: r.status, round: r.round,
      required: r.required_users || [], proposal: r.proposal || null, meetingId: r.meeting_id, createdAt: r.created_at,
      autoPropose: !!r.auto_propose, defaultLink: r.default_link || null, declinedSlots: r.declined_slots || [], remindedAt: r.reminded_at || null,
      // Ranked options made by the database when answering ended (migration 20261117120100_scheduler_background.sql).
      suggestions: Array.isArray(r.suggestions) ? r.suggestions.map(function (x) { return { slotId: x.slot_id, start: x.start, end: x.end, yes: x.yes, total: x.total, preferred: x.preferred, maybe: x.maybe, everyone: !!x.everyone, missing: x.missing || [], hosts: x.hosts || [], fits: x.fits !== false, format: x.format }; }) : null,
      answersClosed: !!r.answers_closed, excludedUsers: r.excluded_users || [],
    };
  }

  async function listSchedules(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    // Reminders before the deadline and expiry after it (any member's visit does it; running it twice changes nothing).
    var processed = await sb().rpc('process_schedule_requests', { target_campaign: campaignId });
    if (processed.error) await sb().rpc('expire_schedule_requests', { target_campaign: campaignId }); // older database
    var res = await sb().from('campaign_schedule_requests').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false });
    if (res.error) return fail(res.error, 'Could not load the scheduling requests.');
    var reqs = res.data.map(scheduleFromRow);
    if (!reqs.length) return { ok: true, schedules: [] };
    var ids = reqs.map(function (r) { return r.id; });
    var parts = await Promise.all([
      sb().from('campaign_schedule_responses').select('*').in('request_id', ids),
      sb().from('campaign_schedule_confirmations').select('*').in('request_id', ids),
      sb().from('campaign_schedule_hosts').select('*').in('request_id', ids),
    ]);
    for (var i = 0; i < parts.length; i++) if (parts[i].error) return fail(parts[i].error, 'Could not load the answers.');
    reqs.forEach(function (r) {
      r.responses = parts[0].data.filter(function (x) { return x.request_id === r.id && x.round === r.round; }).map(function (x) {
        return { userId: x.user_id, availability: x.availability || {}, canHost: x.can_host, hostNote: x.host_note || '', suggestFormat: x.suggest_format, suggestion: x.suggestion || '', updatedAt: x.updated_at };
      });
      r.confirmations = parts[1].data.filter(function (x) { return x.request_id === r.id && x.round === r.round; }).map(function (x) { return { userId: x.user_id, version: x.proposal_version }; });
      // Only the rows the database lets this person see: their own address, or the proposed host's once shared.
      r.hosts = parts[2].data.filter(function (x) { return x.request_id === r.id && x.round === r.round; }).map(function (x) { return { userId: x.user_id, location: x.location, share: x.share_with_party }; });
    });
    return { ok: true, schedules: reqs };
  }

  async function createSchedule(campaignId, o, publish) {
    var nr = notReady();
    if (nr) return nr;
    if (!String(o.title || '').trim()) return { ok: false, message: 'Give the request a title.' };
    if (!o.slots || !o.slots.length) return { ok: false, message: 'Pick at least one date and time range.' };
    var res = await sb().rpc('create_schedule_request', {
      target_campaign: campaignId, p_title: o.title, p_notes: o.notes || '', p_format: o.format, p_duration: o.durationMinutes || null,
      p_slots: o.slots, p_due: o.due || null, p_publish: !!publish,
    });
    if (res.error) return fail(res.error, 'Could not create the request.');
    return { ok: true, id: res.data };
  }

  function rpcOk(name, args, fallback) {
    return async function () {
      var nr = notReady();
      if (nr) return nr;
      var res = await sb().rpc(name, args.apply(null, arguments));
      if (res.error) return fail(res.error, fallback);
      return { ok: true, data: res.data };
    };
  }

  var publishSchedule = rpcOk('publish_schedule_request', function (id) { return { rid: id }; }, 'Could not send the request.');
  var cancelSchedule = rpcOk('cancel_schedule', function (id) { return { rid: id }; }, 'Could not cancel the request.');
  var declineSchedule = rpcOk('decline_schedule', function (id) { return { rid: id }; }, 'Could not decline.');
  var setScheduleAutomation = rpcOk('set_schedule_automation', function (id, auto, link) { return { rid: id, p_auto: !!auto, p_link: link || null }; }, 'Could not change the automatic proposal.');
  var reopenSchedule = rpcOk('reopen_schedule', function (id, slots, due) { return { rid: id, p_slots: slots || null, p_due: due || null }; }, 'Could not start another round.');
  var confirmSchedule = rpcOk('confirm_schedule', function (id, version, slot) { return { rid: id, p_version: version, p_slot: slot }; }, 'Could not confirm.');
  var proposeSchedule = rpcOk('propose_schedule', function (id, o) { return { rid: id, p_slot: o.slotId, p_format: o.format, p_host: o.hostId || null, p_link: o.link || null, p_link_kind: o.linkKind || null }; }, 'Could not propose that time.');
  // A suggested time, optionally leaving named people out of this meeting (they are told; everyone else confirms).
  var proposeScheduleOption = rpcOk('propose_schedule_option', function (id, o) { return { rid: id, p_slot: o.slotId, p_format: o.format, p_host: o.hostId || null, p_link: o.link || null, p_link_kind: o.linkKind || null, p_without: o.without || [] }; }, 'Could not propose that time.');
  var submitAvailability = rpcOk('submit_schedule_response', function (id, o) {
    return { rid: id, p_availability: o.availability, p_can_host: !!o.canHost, p_host_location: o.hostLocation || null, p_share_location: !!o.shareLocation, p_host_note: o.hostNote || null, p_suggest_format: o.suggestFormat || null, p_suggestion: o.suggestion || null };
  }, 'Could not save your answer.');

  // ---------------------------------------------------------------------------
  // Campaign homebrew (the DM's copy shared with the campaign)
  // ---------------------------------------------------------------------------
  async function listCampaignHomebrew(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_homebrew').select('*').eq('campaign_id', campaignId).order('name');
    if (res.error) return fail(res.error, 'Could not load the campaign homebrew.');
    return { ok: true, entries: res.data.map(function (r) { return { id: r.id, sourceId: r.source_id, kind: r.kind, name: r.name, data: r.data, sharedBy: r.shared_by, createdAt: r.created_at }; }) };
  }

  /** Shares (or refreshes) one of the DM's own homebrew entries: the old shared copy is replaced, never duplicated. */
  async function shareHomebrew(campaignId, entry) {
    var nr = notReady();
    if (nr) return nr;
    await sb().from('campaign_homebrew').delete().eq('campaign_id', campaignId).eq('source_id', entry.id);
    var res = await sb().from('campaign_homebrew').insert({ campaign_id: campaignId, source_id: entry.id, kind: entry.kind, name: entry.name, data: entry.data }).select('id');
    if (res.error) return fail(res.error, 'Could not share this with the campaign.');
    return { ok: true };
  }

  async function unshareHomebrew(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_homebrew').delete().eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not stop sharing.');
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Memories & Recaps, entitlements, history, the book
  // ---------------------------------------------------------------------------
  var MEMORY_BUCKET = 'campaign-memories';

  function memoryFromRow(r) {
    return {
      id: r.id, campaignId: r.campaign_id, kind: r.kind, title: r.title, content: r.content || '', occurredOn: r.occurred_on, meetingId: r.meeting_id,
      subject: r.subject || '', imagePath: r.image_path, recap: r.recap || null, visibility: r.visibility, status: r.status,
      createdAt: r.created_at, updatedAt: r.updated_at, publishedAt: r.published_at,
    };
  }

  async function featureAccess(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('campaign_feature_access', { target_campaign: campaignId });
    if (res.error) return fail(res.error, 'Could not check this campaign’s features.');
    var a = res.data || {};
    return { ok: true, access: { ownerPlan: a.owner_plan, memories: !!a.memories, bookUnlocked: !!a.book_unlocked, bookIncludedByPlan: !!a.book_included_by_plan, bookPurchased: !!a.book_purchased, bookPurchasedBy: a.book_purchased_by || null } };
  }

  async function listMemories(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_memories').select('*').eq('campaign_id', campaignId).order('occurred_on', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    if (res.error) return fail(res.error, 'Could not load the memories.');
    return { ok: true, memories: res.data.map(memoryFromRow) };
  }

  function memoryRow(m) {
    return {
      kind: m.kind, title: String(m.title || '').trim(), content: m.content || '', occurred_on: m.occurredOn || null, meeting_id: m.meetingId || null,
      subject: m.subject || '', image_path: m.imagePath || null, recap: m.recap || null, visibility: m.visibility, status: m.status,
    };
  }

  async function saveMemory(campaignId, m) {
    var nr = notReady();
    if (nr) return nr;
    if (!String(m.title || '').trim()) return { ok: false, message: 'Give the memory a title.' };
    var res = m.id
      ? await sb().from('campaign_memories').update(memoryRow(m)).eq('id', m.id).select('*')
      : await sb().from('campaign_memories').insert(Object.assign({ campaign_id: campaignId }, memoryRow(m))).select('*');
    if (res.error) return fail(res.error, 'Could not save the memory.');
    if (!res.data.length) return { ok: false, message: 'Only the Dungeon Master can change memories, and only while the campaign is active and the plan includes the Logbook.' };
    return { ok: true, memory: memoryFromRow(res.data[0]) };
  }

  async function deleteMemory(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_memories').delete().eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not delete the memory.');
    if (!res.data.length) return { ok: false, message: 'Only the Dungeon Master can delete memories.' };
    return { ok: true };
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(',');
    var bin = atob(parts[1]);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'image/jpeg' });
  }

  /** Resizes in the browser and stores in the private bucket: <campaign>/<players|dm>/<id>.jpg. Returns the path. */
  async function uploadMemoryImage(campaignId, visibility, file) {
    var nr = notReady();
    if (nr) return nr;
    var dataUrl;
    try { dataUrl = await global.FogAccount.compressImage(file, 1400); } catch (e) { return { ok: false, message: e.message || 'That file is not a readable image.' }; }
    var id = (global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    var path = campaignId + '/' + (visibility === 'players' ? 'players' : 'dm') + '/' + id + '.jpg';
    var up = await sb().storage.from(MEMORY_BUCKET).upload(path, dataUrlToBlob(dataUrl), { contentType: 'image/jpeg', upsert: false });
    if (up.error) return fail(up.error, 'Could not upload the image.');
    return { ok: true, path: path };
  }

  async function removeMemoryImage(path) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().storage.from(MEMORY_BUCKET).remove([path]);
    return res.error ? fail(res.error, 'Could not remove the image.') : { ok: true };
  }

  var urlCache = {};
  async function memoryImageUrls(paths) {
    var out = {};
    var want = (paths || []).filter(Boolean);
    var need = want.filter(function (p) { if (urlCache[p] && urlCache[p].until > Date.now()) { out[p] = urlCache[p].url; return false; } return true; });
    if (need.length && sb()) {
      var res = await sb().storage.from(MEMORY_BUCKET).createSignedUrls(need, 3600);
      if (!res.error) (res.data || []).forEach(function (r) { if (r.signedUrl) { out[r.path] = r.signedUrl; urlCache[r.path] = { url: r.signedUrl, until: Date.now() + 3000000 }; } });
    }
    return out;
  }

  async function getBook(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('campaign_book', { target_campaign: campaignId });
    if (res.error) return fail(res.error, 'Could not open the campaign book.');
    return { ok: true, book: res.data };
  }

  async function listHistory(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('campaign_history').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(100);
    if (res.error) return fail(res.error, 'Could not load the campaign history.');
    return { ok: true, history: res.data.map(function (h) { return { id: h.id, kind: h.kind, summary: h.summary, details: h.details || {}, at: h.created_at }; }) };
  }


  // ---------------------------------------------------------------------------
  // Meeting in the Fog (supabase/migrations/20261118120300_meeting_in_the_fog.sql + Edge Function meeting-fog)
  // Room metadata and permissions live in the database; audio and video go through the media provider only.
  // ---------------------------------------------------------------------------
  var CONNECTED_WITHIN_MS = 150000; // a participant whose browser hasn't checked in for 2.5 minutes is no longer "connected"
  function roomFromRow(r) {
    return { id: r.id, campaignId: r.campaign_id, meetingId: r.meeting_id || null, status: r.status, title: r.title, createdBy: r.created_by,
      createdAt: r.created_at, openedAt: r.opened_at, closedAt: r.closed_at, provider: r.provider, audioState: r.audio_state || {}, audioSeq: Number(r.audio_seq || 0) };
  }
  function participantFromRow(p) {
    return { userId: p.user_id, role: p.role, status: p.status, joinedAt: p.joined_at, leftAt: p.left_at, lastSeenAt: p.last_seen_at };
  }
  function connectedNow(list, now) {
    var t = now || Date.now();
    return list.filter(function (p) { return p.status === 'joined' && t - new Date(p.lastSeenAt).getTime() < CONNECTED_WITHIN_MS; });
  }
  function roomsNotSetUp(err) { return /meeting_rooms|meeting_room_participants|open_meeting_room|does not exist|schema cache|Could not find the (table|function)/i.test((err && err.message) || ''); }

  /** The campaign's open room (or null), the waiting rooms of upcoming Fog meetings, and who is in the open room. */
  async function getRooms(campaignId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('meeting_rooms').select('*').eq('campaign_id', campaignId).in('status', ['open', 'scheduled']).order('created_at', { ascending: false }).limit(20);
    if (res.error) return roomsNotSetUp(res.error) ? { ok: true, open: null, scheduled: [], participants: [], notSetUp: true } : fail(res.error, 'Could not load Meeting in the Fog.');
    var rooms = res.data.map(roomFromRow);
    var open = rooms.filter(function (r) { return r.status === 'open'; })[0] || null;
    var participants = [];
    if (open) {
      var p = await sb().from('meeting_room_participants').select('*').eq('room_id', open.id);
      if (!p.error) participants = p.data.map(participantFromRow);
    }
    return { ok: true, open: open, scheduled: rooms.filter(function (r) { return r.status === 'scheduled'; }), participants: participants };
  }
  async function getRoom(roomId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('meeting_rooms').select('*').eq('id', roomId).maybeSingle();
    if (res.error) return fail(res.error, 'Could not load the room.');
    return res.data ? { ok: true, room: roomFromRow(res.data) } : { ok: false, message: 'Room not found.' };
  }
  async function openRoom(campaignId, meetingId, title) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('open_meeting_room', { p_campaign: campaignId, p_meeting: meetingId || null, p_title: title || null });
    if (res.error) return roomsNotSetUp(res.error) ? { ok: false, notSetUp: true, message: 'Meeting in the Fog isn’t set up in the database yet (migration 20261118120300_meeting_in_the_fog.sql).' } : fail(res.error, 'Could not open the room.');
    return { ok: true, roomId: res.data };
  }
  /** Calls the meeting-fog Edge Function. Resolves { ok, data } or { ok:false, code, message } (never throws). */
  async function meetingFn(body) {
    var c = sb();
    if (!c || !c.functions) return { ok: false, code: 'unavailable', message: 'The meeting service can’t be reached.' };
    try {
      var res = await c.functions.invoke('meeting-fog', { body: body });
      if (res.error) {
        var msg = 'The meeting service couldn’t answer.'; var code = 'error';
        try { if (res.error.context && res.error.context.json) { var j = await res.error.context.json(); msg = j.error || msg; code = j.code || code; } } catch (e) { /* keep generic */ }
        if (code === 'error' && /Failed to send|fetch|network|not found/i.test(String(res.error.message || ''))) { code = 'not_configured'; msg = 'Video meetings aren’t set up on the server yet.'; }
        return { ok: false, code: code, message: msg };
      }
      return { ok: true, data: res.data || {} };
    } catch (e) {
      return { ok: false, code: 'unavailable', message: 'The meeting service can’t be reached.' };
    }
  }
  /** Whether video meetings are configured on the server (cached for the page). */
  var mediaStatusCache = null;
  async function mediaStatus(force) {
    if (mediaStatusCache && !force) return mediaStatusCache;
    var r = await meetingFn({ action: 'status' });
    mediaStatusCache = r.ok ? { ok: true, configured: !!r.data.configured } : { ok: true, configured: false, reason: r.code };
    return mediaStatusCache;
  }
  /** A short-lived join token for an open room (checked on the server: membership, active campaign, open room). */
  async function joinRoom(roomId) {
    var r = await meetingFn({ action: 'join', roomId: roomId });
    if (!r.ok) { if (r.code === 'not_configured') mediaStatusCache = { ok: true, configured: false, reason: 'not_configured' }; return r; }
    if (!r.data.token || !r.data.url) return { ok: false, code: 'error', message: 'The meeting service answered without a token.' };
    return { ok: true, token: r.data.token, url: r.data.url, expiresAt: r.data.expiresAt, room: r.data.room };
  }
  /** Closes the room: through the Edge Function (which also ends the call for everyone) when it exists, else in the database. */
  async function closeRoom(roomId) {
    var nr = notReady();
    if (nr) return nr;
    var st = await mediaStatus();
    if (st.configured) {
      var r = await meetingFn({ action: 'close', roomId: roomId });
      if (r.ok) return { ok: true };
      if (r.code !== 'not_configured') return { ok: false, message: r.message };
    }
    var res = await sb().rpc('close_meeting_room', { p_room: roomId });
    return res.error ? fail(res.error, 'Could not close the room.') : { ok: true };
  }
  var lastAccessToken = null;
  async function rememberSession() {
    try { var s = await sb().auth.getSession(); lastAccessToken = s && s.data && s.data.session ? s.data.session.access_token : lastAccessToken; } catch (e) { /* keep the previous one */ }
  }
  async function leaveRoom(roomId) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('leave_meeting_room', { p_room: roomId });
    return res.error ? fail(res.error, 'Could not leave the room.') : { ok: true };
  }
  /** For page close: a request the browser finishes after the page is gone (no waiting). The heartbeat covers failures. */
  function leaveRoomOnUnload(roomId) {
    var c = sb();
    var url = c && (c.supabaseUrl || (c.rest && c.rest.url && c.rest.url.replace(/\/rest\/v1\/?$/, '')));
    var key = c && c.supabaseKey;
    if (!url || !key || !lastAccessToken || typeof fetch !== 'function') return false;
    try {
      fetch(url + '/rest/v1/rpc/leave_meeting_room', { method: 'POST', keepalive: true, headers: { apikey: key, Authorization: 'Bearer ' + lastAccessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_room: roomId }) });
      return true;
    } catch (e) { return false; }
  }
  async function heartbeat(roomId) {
    var nr = notReady();
    if (nr) return nr;
    rememberSession();
    var res = await sb().rpc('meeting_heartbeat', { p_room: roomId });
    return res.error ? fail(res.error, 'Could not reach the server.') : { ok: true, stillOpen: res.data === true };
  }
  async function setRoomAudio(roomId, seq, state) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().rpc('set_room_audio_state', { p_room: roomId, p_seq: seq, p_state: state });
    return res.error ? fail(res.error, 'Could not share the music.') : { ok: true, seq: Number(res.data) };
  }
  /** Server clock minus this device's clock, in ms (to line up music positions). */
  async function serverClockOffset() {
    var nr = notReady();
    if (nr) return nr;
    var t0 = Date.now();
    var res = await sb().rpc('meeting_now');
    var t1 = Date.now();
    if (res.error) return { ok: false, message: res.error.message };
    return { ok: true, offset: new Date(res.data).getTime() - (t0 + t1) / 2 };
  }

  global.FogCampaignData = {
    PAGE: PAGE,
    listMessages: listMessages,
    sendMessage: sendMessage,
    deleteMessage: deleteMessage,
    subscribe: subscribe,
    listMeetings: listMeetings,
    createMeeting: createMeeting,
    updateMeeting: updateMeeting,
    setMeetingStatus: setMeetingStatus,
    deleteMeeting: deleteMeeting,
    setRsvp: setRsvp,
    validateMeeting: validateMeeting,
    meetingIsPast: meetingIsPast,
    getCombat: getCombat,
    saveCombat: saveCombat,
    clearCombat: clearCombat,
    getProgress: getProgress,
    saveProgress: saveProgress,
    listReveals: listReveals,
    addReveal: addReveal,
    removeReveal: removeReveal,
    regenerateInviteCode: regenerateInviteCode,
    listSchedules: listSchedules, createSchedule: createSchedule, publishSchedule: publishSchedule, cancelSchedule: cancelSchedule,
    declineSchedule: declineSchedule, reopenSchedule: reopenSchedule, setScheduleAutomation: setScheduleAutomation, confirmSchedule: confirmSchedule, proposeSchedule: proposeSchedule, proposeScheduleOption: proposeScheduleOption,
    submitAvailability: submitAvailability,
    listCampaignHomebrew: listCampaignHomebrew, shareHomebrew: shareHomebrew, unshareHomebrew: unshareHomebrew,
    featureAccess: featureAccess, listMemories: listMemories, saveMemory: saveMemory, deleteMemory: deleteMemory,
    uploadMemoryImage: uploadMemoryImage, removeMemoryImage: removeMemoryImage, memoryImageUrls: memoryImageUrls,
    getBook: getBook, listHistory: listHistory,
    getRooms: getRooms, getRoom: getRoom, openRoom: openRoom, closeRoom: closeRoom, joinRoom: joinRoom, leaveRoom: leaveRoom, leaveRoomOnUnload: leaveRoomOnUnload,
    heartbeat: heartbeat, rememberSession: rememberSession, setRoomAudio: setRoomAudio, serverClockOffset: serverClockOffset, mediaStatus: mediaStatus, connectedNow: connectedNow,
    roomFromRow: roomFromRow,
  };
})(window);
