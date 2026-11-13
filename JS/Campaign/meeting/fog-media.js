/**
 * Media provider boundary for Meeting in the Fog. The rest of the app talks to this interface only, never to a vendor SDK.
 *
 *   FogMedia.register(name, factory)   add a provider (the app registers 'livekit'; tests register their own)
 *   FogMedia.create(name?)             → adapter (default 'livekit')
 *
 * Adapter (every method is async unless noted; nothing pretends to be connected):
 *   load()                                   load the SDK (on demand, pinned version with Subresource Integrity)
 *   connect(url, token, events)              join the provider room with a short-lived token from the server
 *        events: onState(state, detail)      'connecting' | 'connected' | 'reconnecting' | 'disconnected'
 *                onParticipants()            someone joined/left, muted, turned the camera on, started speaking…
 *                onData(topic, payload, fromIdentity)
 *                onDeviceError(kind, error)
 *   disconnect()                             leave and stop every local track (camera light off)
 *   publishMicrophone(on, deviceId?) / publishCamera(on, deviceId?)   asks the browser for permission only here
 *   muteMicrophone() / disableCamera()
 *   getParticipants() (sync)                 → [{ id, name, isLocal, role, micOn, camOn, speaking, quality, hasVideo }]
 *   attachVideo(participantId, element) (sync) → true when a camera picture was attached
 *   listDevices(kind)                        kind 'audioinput' | 'videoinput' | 'audiooutput' → [{ deviceId, label }]
 *   switchDevice(kind, deviceId)
 *   publishData(topic, object)               small JSON messages (DM only; the server's token decides)
 *   handleConnectionState() (sync)           → current state
 * Room creation is not the client's job: rooms are opened in the database (FogCampaignData.openRoom) and the provider
 * room exists as soon as the first person connects with a server-issued token.
 */
(function (global) {
  'use strict';

  var providers = Object.create(null);
  function register(name, factory) { providers[name] = factory; }
  function create(name) {
    var f = providers[name || 'livekit'];
    if (!f) throw new Error('Unknown media provider: ' + name);
    return f();
  }

  /** Turns browser media errors into words a player understands. */
  function explainDeviceError(kind, err) {
    var what = kind === 'camera' ? 'camera' : 'microphone';
    var n = err && (err.name || '');
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Your browser blocked the ' + what + '. Allow it in the address bar (the camera/lock icon), then try again.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No ' + what + ' was found. You can still ' + (kind === 'camera' ? 'join without video' : 'listen and watch') + '.';
    if (n === 'NotReadableError' || n === 'AbortError') return 'The ' + what + ' is busy (another app may be using it). Close that app and try again.';
    return 'The ' + what + ' could not be started' + (err && err.message ? ' (' + err.message + ')' : '') + '.';
  }

  // ---------------------------------------------------------------------------------------------------------------
  // LiveKit (SFU). Uses the official client SDK; the server issues tokens (Edge Function meeting-fog).
  // ---------------------------------------------------------------------------------------------------------------
  var LK_SRC = 'https://cdn.jsdelivr.net/npm/livekit-client@2.23.0/dist/livekit-client.umd.js';
  var LK_SRI = 'sha384-HkA7rQNo8H04l1p4zoXX1Cy+h9YoYp8LvKt4vfMFhv4KFk07UkrNwIUnyBum8Pw6';
  var lkLoading = null;
  function loadLiveKit() {
    if (global.LivekitClient) return Promise.resolve(global.LivekitClient);
    if (lkLoading) return lkLoading;
    lkLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = LK_SRC;
      s.integrity = LK_SRI;
      s.crossOrigin = 'anonymous';
      s.onload = function () { global.LivekitClient ? resolve(global.LivekitClient) : reject(new Error('The video library did not load.')); };
      s.onerror = function () { lkLoading = null; reject(new Error('The video library could not be downloaded. Check your connection.')); };
      document.head.appendChild(s);
    });
    return lkLoading;
  }

  function liveKitAdapter() {
    var LK = null;
    var room = null;
    var state = 'disconnected';
    var events = {};
    var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    var dec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

    function setState(s, detail) { state = s; if (events.onState) events.onState(s, detail); }
    function changed() { if (events.onParticipants) events.onParticipants(); }
    function roleOf(p) { try { return JSON.parse(p.metadata || '{}').role === 'dm' ? 'dm' : 'player'; } catch (e) { return 'player'; } }
    function pub(p, source) { return p.getTrackPublication ? p.getTrackPublication(source) : null; }
    function snapshot(p, isLocal) {
      var mic = pub(p, LK.Track.Source.Microphone);
      var cam = pub(p, LK.Track.Source.Camera);
      return {
        id: p.identity, name: p.name || 'Adventurer', isLocal: !!isLocal, role: roleOf(p),
        micOn: !!(mic && !mic.isMuted && (isLocal ? p.isMicrophoneEnabled : true)),
        camOn: !!(cam && !cam.isMuted && cam.track),
        hasVideo: !!(cam && cam.track && !cam.isMuted),
        speaking: !!p.isSpeaking,
        quality: String(p.connectionQuality || 'unknown'),
      };
    }

    return {
      name: 'livekit',
      load: function () { return loadLiveKit().then(function (x) { LK = x; return true; }); },
      connect: async function (url, token, ev) {
        if (!LK) await this.load();
        events = ev || {};
        room = new LK.Room({ adaptiveStream: true, dynacast: true, stopLocalTrackOnUnpublish: true });
        var E = LK.RoomEvent;
        room.on(E.ConnectionStateChanged, function (s) {
          var map = { connecting: 'connecting', connected: 'connected', reconnecting: 'reconnecting', signalReconnecting: 'reconnecting', disconnected: 'disconnected' };
          if (map[s] && map[s] !== 'disconnected') setState(map[s]);
        });
        room.on(E.Reconnecting, function () { setState('reconnecting'); });
        room.on(E.Reconnected, function () { setState('connected'); changed(); });
        room.on(E.Disconnected, function (reason) { setState('disconnected', { reason: reason }); });
        [E.ParticipantConnected, E.ParticipantDisconnected, E.TrackSubscribed, E.TrackUnsubscribed, E.TrackMuted, E.TrackUnmuted,
          E.LocalTrackPublished, E.LocalTrackUnpublished, E.ActiveSpeakersChanged, E.ConnectionQualityChanged, E.ParticipantMetadataChanged]
          .forEach(function (name) { if (name) room.on(name, changed); });
        room.on(E.MediaDevicesError, function (err) { if (events.onDeviceError) events.onDeviceError('device', err); });
        room.on(E.DataReceived, function (payload, participant, kind, topic) {
          if (!events.onData) return;
          try { events.onData(topic || '', JSON.parse(dec ? dec.decode(payload) : String(payload)), participant ? participant.identity : null); } catch (e) { /* not ours */ }
        });
        setState('connecting');
        await room.connect(url, token, { autoSubscribe: true });
        setState('connected');
        changed();
        return true;
      },
      disconnect: async function () {
        if (!room) return;
        var r = room;
        room = null;
        try { await r.disconnect(true); } catch (e) { /* already gone */ }
        setState('disconnected', { reason: 'left' });
      },
      publishMicrophone: async function (on, deviceId) {
        if (!room) return false;
        await room.localParticipant.setMicrophoneEnabled(!!on, deviceId ? { deviceId: deviceId } : undefined);
        changed();
        return room.localParticipant.isMicrophoneEnabled;
      },
      publishCamera: async function (on, deviceId) {
        if (!room) return false;
        await room.localParticipant.setCameraEnabled(!!on, deviceId ? { deviceId: deviceId, resolution: LK.VideoPresets.h540.resolution } : { resolution: LK.VideoPresets.h540.resolution });
        changed();
        return room.localParticipant.isCameraEnabled;
      },
      muteMicrophone: function () { return this.publishMicrophone(false); },
      disableCamera: function () { return this.publishCamera(false); },
      getParticipants: function () {
        if (!room) return [];
        var list = [snapshot(room.localParticipant, true)];
        room.remoteParticipants.forEach(function (p) { list.push(snapshot(p, false)); });
        return list;
      },
      attachVideo: function (participantId, el) {
        if (!room) return false;
        var p = room.localParticipant.identity === participantId ? room.localParticipant : room.remoteParticipants.get(participantId);
        var cam = p && pub(p, LK.Track.Source.Camera);
        if (!cam || !cam.track || cam.isMuted) return false;
        cam.track.attach(el);
        return true;
      },
      /** Remote audio plays through elements LiveKit creates; this keeps them in the page (hidden). */
      attachAudio: function (container) {
        if (!room) return;
        room.remoteParticipants.forEach(function (p) {
          var mic = pub(p, LK.Track.Source.Microphone);
          if (mic && mic.track && !container.querySelector('[data-audio="' + p.identity + '"]')) {
            var a = mic.track.attach();
            a.setAttribute('data-audio', p.identity);
            container.appendChild(a);
          }
        });
        container.querySelectorAll('[data-audio]').forEach(function (a) { if (!room.remoteParticipants.get(a.getAttribute('data-audio'))) a.remove(); });
      },
      startAudio: function () { return room && room.startAudio ? room.startAudio() : Promise.resolve(); },
      listDevices: async function (kind) {
        if (!LK) await this.load();
        try { return (await LK.Room.getLocalDevices(kind, false)).map(function (d) { return { deviceId: d.deviceId, label: d.label || (kind === 'videoinput' ? 'Camera' : 'Microphone') }; }); } catch (e) { return []; }
      },
      switchDevice: async function (kind, deviceId) { if (room) await room.switchActiveDevice(kind, deviceId); return true; },
      publishData: async function (topic, obj) {
        if (!room || !enc) return false;
        await room.localParticipant.publishData(enc.encode(JSON.stringify(obj)), { reliable: true, topic: topic });
        return true;
      },
      handleConnectionState: function () { return state; },
    };
  }

  register('livekit', liveKitAdapter);
  global.FogMedia = { register: register, create: create, explainDeviceError: explainDeviceError, LIVEKIT: { src: LK_SRC, integrity: LK_SRI } };
})(typeof window !== 'undefined' ? window : globalThis);
