/**
 * Meeting in the Fog — the call session, owned by the campaign shell (one per page). It survives moving between sections;
 * only Leave, the DM closing the room, losing access or leaving the workspace ends it.
 *
 *   var s = FogMeetingSession.create(ctx, { data: FogCampaignData, media: FogMedia, provider: 'livekit' })
 *   s.state()        → { status, room, error, notice, participants, mic, cam, devices, audioShare, hearMusic }
 *                       status: 'idle' | 'joining' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable' | 'error'
 *   s.subscribe(fn)  → unsubscribe
 *   s.join(roomId)   asks the server for a short-lived token (membership checked there), connects, then asks the
 *                    browser for the microphone (only now). Camera stays off until the person turns it on.
 *   s.leave()        disconnects, stops every track, tells the database
 *   s.toggleMic() / s.toggleCam() / s.setDevice(kind, id) / s.refreshDevices()
 *   s.roomChanged(room)   the shell forwards Realtime room updates (closed → disconnect; music commands → players)
 *   s.setAudioShare(on)   DM: share the music player's state with the room · s.setHearMusic(on) player: follow it or not
 *   s.attachVideo(id, el) / s.attachAudio(container)   for the meeting UI
 *   s.destroy()      page is going away: disconnect and record the leave without waiting
 */
(function (global) {
  'use strict';

  var HEARTBEAT_MS = 60000;

  function create(ctx, deps) {
    deps = deps || {};
    var D = function () { return deps.data || global.FogCampaignData; };
    var M = function () { return deps.media || global.FogMedia; };
    var provider = deps.provider || 'livekit';
    var listeners = [];
    var adapter = null;
    var beat = null;
    var joinSeq = 0;
    var clockOffset = 0;
    var audioUnsub = null;
    var lastSent = null;
    var lastSeq = 0;
    var S = { status: 'idle', room: null, error: '', notice: '', participants: [], mic: false, cam: false, devices: { audioinput: [], videoinput: [] }, audioShare: false, hearMusic: true, lastAudio: null };

    function emit() { var snap = state(); listeners.slice().forEach(function (fn) { try { fn(snap); } catch (e) { console.error(e); } }); }
    function set(patch) { Object.assign(S, patch); emit(); }
    function state() { return Object.assign({}, S, { participants: S.participants.slice(), devices: { audioinput: S.devices.audioinput.slice(), videoinput: S.devices.videoinput.slice() } }); }
    function inCall() { return S.status === 'connected' || S.status === 'reconnecting'; }
    function refreshParticipants() { if (adapter) set({ participants: adapter.getParticipants() }); }

    function stopTimers() { if (beat) { clearInterval(beat); beat = null; } if (audioUnsub) { audioUnsub(); audioUnsub = null; } }

    async function teardown(status, notice, opts) {
      opts = opts || {};
      var room = S.room;
      stopTimers();
      var a = adapter;
      adapter = null;
      if (a) { try { await a.disconnect(); } catch (e) { /* already gone */ } }
      if (room && !opts.skipLeave) { try { await D().leaveRoom(room.id); } catch (e) { /* the heartbeat timeout covers it */ } }
      set({ status: status, notice: notice || '', error: opts.error || '', participants: [], mic: false, cam: false, audioShare: false, room: opts.keepRoom ? room : null });
    }

    async function join(roomId) {
      if (inCall() && S.room && S.room.id === roomId) return { ok: true };
      if (inCall() || S.status === 'joining') await teardown('idle');
      var my = ++joinSeq;
      set({ status: 'joining', error: '', notice: '', room: { id: roomId, title: 'Meeting in the Fog' } });
      var tok = await D().joinRoom(roomId);
      if (my !== joinSeq) return { ok: false };
      if (!tok.ok) {
        var unavailable = tok.code === 'not_configured';
        set({ status: unavailable ? 'unavailable' : 'error', room: null, error: unavailable ? 'Video meetings aren’t set up on the server yet. The site owner needs to add the LiveKit settings.' : tok.message });
        return { ok: false, message: tok.message };
      }
      try {
        adapter = M().create(provider);
        await adapter.connect(tok.url, tok.token, {
          onState: function (st, detail) {
            if (my !== joinSeq) return;
            if (st === 'reconnecting') set({ status: 'reconnecting', notice: 'Connection lost. Reconnecting…' });
            else if (st === 'connected') { set({ status: 'connected', notice: '' }); refreshParticipants(); }
            else if (st === 'disconnected' && adapter && !(detail && detail.reason === 'left')) {
              teardown('disconnected', 'You were disconnected from Meeting in the Fog.', { keepRoom: true });
            }
          },
          onParticipants: function () { if (my === joinSeq) refreshParticipants(); },
          onDeviceError: function (kind, err) { set({ notice: M().explainDeviceError(kind === 'device' ? 'microphone' : kind, err) }); },
          onData: function () { /* soundboard events arrive here once that interface exists (FogMeetingEvents) */ },
        });
      } catch (e) {
        if (my !== joinSeq) return { ok: false };
        await teardown('error', '', { error: 'Could not connect to the call: ' + (e && e.message ? e.message : 'unknown error') + '.', skipLeave: false });
        return { ok: false };
      }
      if (my !== joinSeq) return { ok: false };
      set({ status: 'connected', room: tok.room || { id: roomId, title: 'Meeting in the Fog' } });
      D().rememberSession && D().rememberSession();
      beat = setInterval(async function () {
        if (!S.room) return;
        var h = await D().heartbeat(S.room.id);
        if (h.ok && h.stillOpen === false && inCall()) teardown('idle', 'The Dungeon Master closed the room.', { skipLeave: true });
      }, HEARTBEAT_MS);
      var off = await D().serverClockOffset();
      if (off && off.ok) clockOffset = off.offset;
      // Microphone: asked for now, because the person chose to join. Failure keeps them in the call, listening.
      try { set({ mic: !!(await adapter.publishMicrophone(true)) }); }
      catch (e) { set({ mic: false, notice: M().explainDeviceError('microphone', e) }); }
      refreshDevices();
      refreshParticipants();
      // Late joiner: apply the room's current music (players who follow it).
      var r = await D().getRoom(roomId);
      if (r.ok && my === joinSeq) roomChanged(r.room);
      return { ok: true };
    }

    async function leave() { joinSeq++; await teardown('idle', 'You left Meeting in the Fog.'); }

    async function toggleMic() {
      if (!adapter || !inCall()) return;
      try { set({ mic: !!(await adapter.publishMicrophone(!S.mic)), notice: '' }); }
      catch (e) { set({ mic: false, notice: M().explainDeviceError('microphone', e) }); }
    }
    async function toggleCam() {
      if (!adapter || !inCall()) return;
      try { set({ cam: !!(await adapter.publishCamera(!S.cam)), notice: '' }); refreshDevices(); }
      catch (e) { set({ cam: false, notice: M().explainDeviceError('camera', e) }); }
    }
    async function refreshDevices() {
      if (!adapter) return;
      var a = await adapter.listDevices('audioinput');
      var v = await adapter.listDevices('videoinput');
      set({ devices: { audioinput: a, videoinput: v } });
    }
    async function setDevice(kind, id) {
      if (!adapter) return;
      try { await adapter.switchDevice(kind, id); set({ notice: '' }); }
      catch (e) { set({ notice: M().explainDeviceError(kind === 'videoinput' ? 'camera' : 'microphone', e) }); }
    }

    // ---- room updates from Realtime (forwarded by the shell) ----
    function roomChanged(room) {
      if (!room || !S.room || room.id !== S.room.id) return;
      if (room.status === 'closed' && inCall()) { teardown('idle', 'The Dungeon Master closed the room.', { skipLeave: true }); return; }
      S.room = Object.assign({}, S.room, { title: room.title || S.room.title });
      var st = room.audioState || {};
      if (!ctx.isDm && inCall() && S.hearMusic && st.seq && (!S.lastAudio || st.seq > S.lastAudio.seq)) {
        S.lastAudio = st;
        followMusic(st);
      }
      emit();
    }
    async function followMusic(st) {
      var player = global.FogMusicPlayer;
      if (!player && global.FogCampaignRouter && global.FogScriptSets) {
        try { await global.FogCampaignRouter.loadScripts(global.FogScriptSets.MUSIC); } catch (e) { return; }
        player = global.FogMusicPlayer;
      }
      if (!player || !global.FogSharedAudio) return;
      var op = await global.FogSharedAudio.apply(st, player, clockOffset);
      if (op === 'failed') set({ notice: 'The Dungeon Master’s music couldn’t be played here.' });
    }
    function setHearMusic(on) {
      set({ hearMusic: !!on });
      if (!on && global.FogMusicPlayer && S.lastAudio && S.lastAudio.playing) global.FogMusicPlayer.pause();
      if (on && S.lastAudio) followMusic(S.lastAudio);
    }

    // ---- DM: share the music player's state ----
    async function publishAudio(snap) {
      if (!S.room || !inCall() || !global.FogSharedAudio) return;
      var cmd = global.FogSharedAudio.fromPlayer(snap, lastSent);
      if (!cmd || global.FogSharedAudio.validate(cmd) && cmd.action !== 'stop') return;
      lastSeq = global.FogSharedAudio.nextSeq(lastSeq);
      var r = await D().setRoomAudio(S.room.id, lastSeq, cmd);
      if (r.ok) lastSent = Object.assign({}, cmd, { serverAt: new Date(Date.now() + clockOffset).toISOString() });
      else set({ notice: r.message });
    }
    function setAudioShare(on) {
      if (!ctx.isDm) return;
      if (audioUnsub) { audioUnsub(); audioUnsub = null; }
      if (on && !global.FogMusicPlayer) { set({ audioShare: false, notice: 'Open Music and choose a track first; then share it with the room.' }); return; }
      set({ audioShare: !!on, notice: '' });
      if (on) {
        lastSent = null;
        audioUnsub = global.FogMusicPlayer.subscribe(function (snap) { publishAudio(snap); });
        publishAudio(global.FogMusicPlayer.state());
      } else if (S.room) {
        lastSeq = global.FogSharedAudio.nextSeq(lastSeq);
        D().setRoomAudio(S.room.id, lastSeq, { action: 'stop', playing: false, position: 0 });
      }
    }

    function destroy() {
      joinSeq++;
      var room = S.room;
      stopTimers();
      if (adapter) { try { adapter.disconnect(); } catch (e) { /* page is closing */ } adapter = null; }
      if (room && inCall()) D().leaveRoomOnUnload(room.id);
      S.status = 'idle';
    }

    return {
      state: state,
      subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
      join: join, leave: leave, toggleMic: toggleMic, toggleCam: toggleCam, setDevice: setDevice, refreshDevices: refreshDevices,
      roomChanged: roomChanged, setAudioShare: setAudioShare, setHearMusic: setHearMusic, destroy: destroy, inCall: inCall,
      attachVideo: function (id, el) { return adapter ? adapter.attachVideo(id, el) : false; },
      attachAudio: function (container) { if (adapter && adapter.attachAudio) adapter.attachAudio(container); },
      startAudio: function () { return adapter && adapter.startAudio ? adapter.startAudio() : Promise.resolve(); },
      dismissNotice: function () { set({ notice: '' }); },
    };
  }

  global.FogMeetingSession = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
