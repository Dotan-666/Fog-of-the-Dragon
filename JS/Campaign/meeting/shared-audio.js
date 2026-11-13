/**
 * Meeting in the Fog — shared audio model (pure: no network, no DOM) and the soundboard event schema.
 *
 * Shared music: the Dungeon Master's music player is the source. What travels is a small COMMAND, never audio:
 *   { action: 'select'|'play'|'pause'|'stop'|'volume'|'track', ref: 'rec:<catalog id>', title, playing, volume 0–1,
 *     position (seconds into the track when sent), seq, serverAt (set by the database) }
 * It is stored on the room (public.set_room_audio_state, ordered by seq so stale or repeated commands are ignored) and
 * reaches members through Realtime, so late joiners and reconnecting players read the current state. Every participant
 * plays the approved catalog recording LOCALLY with the existing FogMusicPlayer. Uploaded tracks (private files) are never
 * shared. Nothing is applied unless the person is connected to the meeting.
 *
 *   FogSharedAudio.fromPlayer(snapshot, prevCommand) → command | null    (null: nothing worth sending)
 *   FogSharedAudio.validate(command)                 → error text | null
 *   FogSharedAudio.plan(state, local, clockOffsetMs, now) → { op: 'none'|'play'|'pause'|'stop'|'seek', ref?, at? }
 *   FogSharedAudio.apply(state, player, clockOffsetMs) → Promise<op>     (uses FogMusicPlayer's own API)
 *   FogSharedAudio.nextSeq(lastSeq)                   monotonic across tabs (based on the clock)
 *
 * Soundboard (architecture only; no interface or sounds yet): the DM sends
 *   { type: 'soundboard.play', id, ref: 'rec:<catalog id>', volume, sentAt }   on the media data channel, topic 'fod.soundboard'
 * Only the DM's token may publish data. FogMeetingEvents.make / validate / seen (dedupe by id) are ready for that UI.
 */
(function (global) {
  'use strict';

  var ACTIONS = ['select', 'play', 'pause', 'stop', 'volume', 'track'];
  var REF = /^rec:[A-Za-z0-9_.-]{1,120}$/; // catalog recordings only (approved assets)
  var DRIFT_S = 2.5; // re-seek when a player is more than this far from the DM

  function num(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : null; }

  function validate(c) {
    if (!c || typeof c !== 'object') return 'Not a command.';
    if (ACTIONS.indexOf(c.action) < 0) return 'Unknown music command.';
    if (c.ref != null && c.ref !== '' && !REF.test(c.ref)) return 'Only tracks from the music catalog can be shared.';
    if ((c.action === 'play' || c.action === 'select' || c.action === 'track') && !c.ref) return 'Which track?';
    if (c.volume != null && num(c.volume, 0, 1) === null) return 'Invalid volume.';
    if (c.position != null && num(c.position, 0, 86400) === null) return 'Invalid position.';
    return null;
  }

  /** From the DM's FogMusicPlayer.state() to a command; null when there is nothing new to tell the room. */
  function fromPlayer(snap, prev) {
    if (!snap) return null;
    var cur = snap.current;
    var ref = cur && cur.ref;
    if (ref && !REF.test(ref)) {
      // an uploaded (private) file: tell the room the music stopped rather than leak or fake it
      return prev && prev.action === 'stop' ? null : { action: 'stop', ref: null, title: null, playing: false, position: 0 };
    }
    var cmd;
    if (!cur) cmd = { action: 'stop', ref: null, title: null, playing: false, position: 0 };
    else cmd = { action: snap.playing ? (prev && prev.ref === ref ? 'play' : 'track') : 'pause', ref: ref, title: String(cur.title || '').slice(0, 120), playing: !!snap.playing, position: Math.max(0, Math.round((snap.position || 0) * 10) / 10) };
    if (prev && prev.action === cmd.action && prev.ref === cmd.ref && prev.playing === cmd.playing) {
      // same track, same play state: only a big jump (the DM seeked) is worth sending
      if (!cmd.playing || Math.abs((cmd.position || 0) - expectedPosition(prev, 0, Date.now())) < DRIFT_S * 2) return null;
    }
    return cmd;
  }

  /** Where the DM's track is now, from a stored command (serverAt = when the server stored it). */
  function expectedPosition(st, offsetMs, now) {
    var base = st.position || 0;
    if (!st.playing || !st.serverAt) return base;
    var elapsed = ((now || Date.now()) + (offsetMs || 0) - new Date(st.serverAt).getTime()) / 1000;
    return base + Math.max(0, elapsed);
  }

  /** What a participant's player should do to match the room. local = FogMusicPlayer.state() (or null). */
  function plan(st, local, offsetMs, now) {
    if (!st || !st.action || validate(st)) return { op: 'none' };
    var cur = local && local.current;
    if (st.action === 'stop' || !st.ref) return cur ? { op: 'stop' } : { op: 'none' };
    if (!st.playing) return cur && cur.ref === st.ref && local.playing ? { op: 'pause' } : { op: 'none' };
    var at = expectedPosition(st, offsetMs, now);
    if (!cur || cur.ref !== st.ref) return { op: 'play', ref: st.ref, at: at };
    if (!local.playing) return { op: 'play', ref: st.ref, at: at, resume: true };
    if (local.duration && local.duration > 0) at = at % local.duration; // looping music
    return Math.abs((local.position || 0) - at) > DRIFT_S ? { op: 'seek', at: at } : { op: 'none' };
  }

  async function apply(st, player, offsetMs) {
    if (!player) return 'none';
    var p = plan(st, player.state(), offsetMs, Date.now());
    if (p.op === 'stop') player.stop();
    else if (p.op === 'pause') player.pause();
    else if (p.op === 'seek') player.seek(p.at);
    else if (p.op === 'play') {
      if (p.resume) player.resume();
      else { var ok = await player.play(p.ref); if (ok === false) return 'failed'; }
      if (p.at > 1) player.seek(p.at);
    }
    return p.op;
  }

  function nextSeq(last) { return Math.max((Number(last) || 0) + 1, Date.now()); }

  global.FogSharedAudio = { ACTIONS: ACTIONS, validate: validate, fromPlayer: fromPlayer, expectedPosition: expectedPosition, plan: plan, apply: apply, nextSeq: nextSeq };

  // ---------------------------------------------------------------------------------------------------------------
  // Soundboard events (prepared; no interface yet)
  // ---------------------------------------------------------------------------------------------------------------
  var TOPIC = 'fod.soundboard';
  function make(ref, volume) {
    var id = (global.crypto && global.crypto.randomUUID) ? global.crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    return { type: 'soundboard.play', id: id, ref: ref, volume: num(volume, 0, 1) === null ? 1 : volume, sentAt: Date.now() };
  }
  function validateEvent(e) {
    if (!e || e.type !== 'soundboard.play') return 'Unknown event.';
    if (typeof e.id !== 'string' || e.id.length < 8 || e.id.length > 64) return 'Missing id.';
    if (!REF.test(e.ref || '')) return 'Only catalog sounds can be played.';
    if (num(e.volume, 0, 1) === null) return 'Invalid volume.';
    return null;
  }
  /** Dedupe: true the first time an event id is seen (keeps the last 200 ids). */
  function seenTracker() {
    var ids = [];
    return function seen(id) {
      if (ids.indexOf(id) >= 0) return true;
      ids.push(id);
      if (ids.length > 200) ids.shift();
      return false;
    };
  }
  global.FogMeetingEvents = { SOUNDBOARD_TOPIC: TOPIC, make: make, validate: validateEvent, seenTracker: seenTracker };
})(typeof window !== 'undefined' ? window : globalThis);
