/**
 * Foggy listening (advanced, Foggie+ / the campaign's DM): the Dungeon Master's voice → music cues.
 *
 * Privacy and control: the microphone is opened ONLY when the DM presses "Start listening" (never on entering a campaign),
 * a red "Foggy is listening" bar with an immediate Stop stays on screen while it is on (in every section), audio is kept in
 * memory only as the current few seconds, sent once to the server (Edge Function foggy-listen) and dropped. Nothing is
 * recorded or stored, on the device or the server. The DM can pause automatic music, play cues by hand, or stop at any time.
 *
 *   FogVoicePolicy.create(opts) → decide({ cueId, confidence, at }) → { play: cue | null, reason }   (pure; unit-tested)
 *       same cue: not again within cueCooldownMs; any cue: at least minGapMs apart; below minConfidence: ignored;
 *       the cue that is already playing: ignored; paused: nothing plays.
 *   FogVoiceRecorder  microphone → 16 kHz mono WAV chunks (base64) every chunkMs; no MediaRecorder files
 *   FogVoiceDirector.start({ campaignId, cues, onState }) / stop() / pause(bool) / state()   (one per page)
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------------------------------------------
  // Policy (pure)
  // ---------------------------------------------------------------------------------------------------------------
  function createPolicy(o) {
    o = o || {};
    var cues = o.cues || [];
    var cueCooldown = o.cueCooldownMs != null ? o.cueCooldownMs : 120000;
    var minGap = o.minGapMs != null ? o.minGapMs : 20000;
    var minConf = o.minConfidence != null ? o.minConfidence : 0.6;
    var lastAt = -Infinity, lastCue = null, paused = false;
    var played = {};
    return {
      setPaused: function (p) { paused = !!p; },
      isPaused: function () { return paused; },
      current: function () { return lastCue; },
      recent: function () { return Object.keys(played).sort(function (a, b) { return played[b] - played[a]; }).slice(0, 5); },
      /** Called when the DM plays something by hand: counts as the current cue (so Foggy doesn't fight the DM). */
      manual: function (cueId, at) { lastCue = cueId; lastAt = at; if (cueId) played[cueId] = at; },
      decide: function (ev) {
        var at = ev.at != null ? ev.at : Date.now();
        if (paused) return { play: null, reason: 'paused' };
        if (!ev.cueId) return { play: null, reason: 'nothing recognised' };
        var cue = cues.find(function (c) { return c.id === ev.cueId; });
        if (!cue) return { play: null, reason: 'unknown cue' };
        if ((ev.confidence || 0) < minConf) return { play: null, reason: 'not sure enough' };
        if (lastCue === cue.id) return { play: null, reason: 'already playing' };
        if (played[cue.id] != null && at - played[cue.id] < cueCooldown) return { play: null, reason: 'played recently' };
        if (at - lastAt < minGap) return { play: null, reason: 'too soon after the last change' };
        lastCue = cue.id; lastAt = at; played[cue.id] = at;
        return { play: cue, reason: 'matched' };
      },
    };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // WAV encoding (pure)
  // ---------------------------------------------------------------------------------------------------------------
  function downsample(buf, from, to) {
    if (to >= from) return buf;
    var ratio = from / to, len = Math.floor(buf.length / ratio), out = new Float32Array(len);
    for (var i = 0; i < len; i++) {
      var s = Math.floor(i * ratio), e = Math.min(buf.length, Math.floor((i + 1) * ratio)), sum = 0;
      for (var j = s; j < e; j++) sum += buf[j];
      out[i] = sum / Math.max(1, e - s);
    }
    return out;
  }
  function encodeWav(samples, rate) {
    var buffer = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buffer);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, samples.length * 2, true);
    for (var i = 0, o = 44; i < samples.length; i++, o += 2) { var x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return new Uint8Array(buffer);
  }
  function toBase64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function rms(samples) { var s = 0; for (var i = 0; i < samples.length; i++) s += samples[i] * samples[i]; return Math.sqrt(s / Math.max(1, samples.length)); }

  // ---------------------------------------------------------------------------------------------------------------
  // Recorder (browser): chunks of speech as WAV, silence skipped (nothing is sent when nobody speaks)
  // ---------------------------------------------------------------------------------------------------------------
  function createRecorder(o) {
    var stream = null, ac = null, node = null, src = null, parts = [], total = 0, timer = null;
    var RATE = 16000, chunkMs = o.chunkMs || 8000;
    async function start() {
      stream = await global.navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      var AC = global.AudioContext || global.webkitAudioContext;
      ac = new AC();
      src = ac.createMediaStreamSource(stream);
      node = ac.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = function (e) { var d = e.inputBuffer.getChannelData(0); parts.push(new Float32Array(d)); total += d.length; };
      src.connect(node); node.connect(ac.destination);
      timer = global.setInterval(flush, chunkMs);
    }
    function flush() {
      if (!parts.length || !ac) return;
      var all = new Float32Array(total), off = 0;
      parts.forEach(function (p) { all.set(p, off); off += p.length; });
      parts = []; total = 0;
      if (rms(all) < (o.silence || 0.012)) return; // silence: nothing to send
      var wav = encodeWav(downsample(all, ac.sampleRate, RATE), RATE);
      o.onChunk(toBase64(wav)); // the chunk leaves memory once sent; nothing is kept
    }
    function stop() {
      if (timer) global.clearInterval(timer);
      timer = null; parts = []; total = 0;
      try { if (node) node.disconnect(); if (src) src.disconnect(); } catch (e) { /* already gone */ }
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); // the microphone light goes off
      if (ac && ac.close) ac.close();
      stream = ac = node = src = null;
    }
    return { start: start, stop: stop };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Director (one per page): listening state, the on-screen indicator, sending chunks, playing cues
  // ---------------------------------------------------------------------------------------------------------------
  var D = { status: 'off', campaignId: null, cues: [], policy: null, recorder: null, error: '', last: null, log: [], listeners: [], busy: false };
  function emit() { var s = state(); D.listeners.slice().forEach(function (fn) { try { fn(s); } catch (e) { /* listener */ } }); drawBar(); }
  function state() { return { status: D.status, error: D.error, last: D.last, log: D.log.slice(-8), paused: !!(D.policy && D.policy.isPaused()), cues: D.cues.length }; }

  var bar = null;
  function drawBar() {
    if (typeof document === 'undefined') return;
    var on = D.status === 'listening' || D.status === 'starting';
    if (!on) { if (bar) bar.hidden = true; return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'fv-bar';
      bar.setAttribute('role', 'status');
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-fv]');
        if (!b) return;
        if (b.getAttribute('data-fv') === 'stop') stop();
        else if (b.getAttribute('data-fv') === 'pause') pause(!D.policy.isPaused());
      });
      document.body.appendChild(bar);
    }
    bar.hidden = false;
    var paused = D.policy && D.policy.isPaused();
    bar.innerHTML = '<span class="fv-dot" aria-hidden="true"></span><strong>' + (D.status === 'starting' ? 'Starting the microphone…' : 'Foggy is listening') + '</strong>' +
      '<span class="fv-sub">' + (paused ? 'automatic music paused' : 'music follows the story') + '</span>' +
      '<button type="button" class="fv-btn" data-fv="pause">' + (paused ? 'Resume auto music' : 'Pause auto music') + '</button><button type="button" class="fv-btn is-stop" data-fv="stop">Stop listening</button>';
  }

  async function playCue(cue) {
    var P = global.FogMusicPlayer;
    if (!P) return false;
    if (cue.when === 'stop') { P.stop(); return true; }
    if (!cue.ref) return false;
    if (cue.when === 'sfx') return P.playEffect ? P.playEffect(cue.ref) : false;
    return P.play(cue.ref);
  }

  async function onChunk(b64) {
    if (D.status !== 'listening' || D.busy) return; // one request at a time: a slow answer never piles up
    D.busy = true;
    var r = await global.FogFoggy.listen({ campaignId: D.campaignId, audio: b64, cues: D.cues.map(function (c) { return { id: c.id, moment: c.moment, when: c.when, keywords: c.keywords }; }), recent: D.policy.recent() });
    D.busy = false;
    if (D.status !== 'listening') return;
    if (!r.ok) {
      if (r.code === 'daily_limit' || r.code === 'plan' || r.code === 'not_configured' || r.code === 'unavailable') { D.error = r.message; stop(true); return; }
      D.log.push({ at: Date.now(), text: 'Skipped a moment: ' + r.message });
      emit();
      return;
    }
    var d = D.policy.decide({ cueId: r.cueId, confidence: r.confidence, at: Date.now() });
    D.last = { heard: (r.transcript || '').slice(0, 160), cueId: r.cueId, reason: d.reason };
    if (d.play) {
      var ok = await playCue(d.play);
      D.log.push({ at: Date.now(), text: (ok ? '▶ ' : 'Couldn’t play ') + d.play.moment });
    }
    emit();
  }

  async function start(o) {
    if (D.status === 'listening' || D.status === 'starting') return { ok: true };
    var cues = (o.cues || []).filter(function (c) { return c.ref || c.when === 'stop'; });
    if (!cues.length) return { ok: false, message: 'Make a music plan for this campaign’s adventure first (Foggy → Music plan).' };
    if (!global.navigator || !global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) return { ok: false, message: 'This browser can’t use a microphone here.' };
    D.campaignId = o.campaignId; D.cues = cues; D.error = ''; D.log = []; D.last = null;
    D.policy = createPolicy({ cues: cues });
    D.status = 'starting'; emit();
    D.recorder = (global.FogVoiceRecorderFactory || createRecorder)({ chunkMs: o.chunkMs || 8000, onChunk: onChunk });
    try {
      await D.recorder.start();
    } catch (e) {
      D.recorder = null;
      D.status = 'off';
      D.error = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'Microphone permission was denied. Foggy isn’t listening. Allow the microphone in the address bar to try again.'
        : e && e.name === 'NotFoundError' ? 'No microphone was found. Foggy isn’t listening.' : 'The microphone couldn’t be started. Foggy isn’t listening.';
      emit();
      return { ok: false, message: D.error };
    }
    D.status = 'listening'; emit();
    return { ok: true };
  }
  function stop(keepError) {
    if (D.recorder) D.recorder.stop();
    D.recorder = null;
    D.status = 'off';
    if (!keepError) D.error = '';
    emit();
  }
  function pause(p) { if (D.policy) { D.policy.setPaused(p); emit(); } }
  function manual(cue) { if (D.policy) D.policy.manual(cue.id, Date.now()); return playCue(cue); }

  if (typeof global.addEventListener === 'function') global.addEventListener('pagehide', function () { stop(); });

  global.FogVoicePolicy = { create: createPolicy };
  global.FogVoiceAudio = { encodeWav: encodeWav, downsample: downsample, rms: rms, toBase64: toBase64 };
  global.FogVoiceDirector = {
    start: start, stop: function () { stop(); }, pause: pause, manual: manual, state: state,
    subscribe: function (fn) { D.listeners.push(fn); return function () { D.listeners = D.listeners.filter(function (x) { return x !== fn; }); }; },
    _chunk: onChunk, // tests: feed a chunk without a microphone
  };
})(typeof window !== 'undefined' ? window : globalThis);
