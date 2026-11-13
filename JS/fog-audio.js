/**
 * Background music and sound effects, generated in the browser with the Web Audio API.
 * No audio files are downloaded: the music is an original ambient piece synthesized live
 * (slow minor-key pad chords with a soft filter sweep, occasional bell notes and an echo).
 *
 *   FogAudio.apply(settings)   — called by FogSettings.apply (musicOn, musicVolume, sfxVolume)
 *   FogAudio.sfx('notify' | 'success' | 'error' | 'click')
 *   FogAudio.preview()         — plays a few seconds of music (Settings page)
 *
 * Browsers only allow sound after the user interacts with the page, so music that is switched on
 * starts on the next click or key press.
 */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var musicBus = null;
  var sfxBus = null;
  var echo = null;
  var musicTimer = null;
  var bellTimer = null;
  var playing = false;
  var wantMusic = false;
  var musicVolume = 0.65;
  var sfxVolume = 0.8;
  var unlockBound = false;
  var previewTimer = null;
  var yielded = false; // the Music tab player is playing: the background music stays quiet

  // D minor progression (MIDI notes): Dm – B♭ – F – C – Gm – A
  var CHORDS = [
    [38, 50, 57, 62, 65],
    [34, 46, 53, 58, 62],
    [41, 48, 53, 57, 60],
    [36, 48, 55, 60, 64],
    [43, 50, 55, 58, 62],
    [45, 52, 57, 61, 64],
  ];
  var BELLS = [74, 76, 77, 79, 81, 84, 86]; // D minor pentatonic-ish, high register
  var CHORD_SECONDS = 9;

  function hz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function supported() {
    return !!(global.AudioContext || global.webkitAudioContext);
  }

  function ensure() {
    if (ctx || !supported()) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -18;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVolume;
    sfxBus.connect(master);
    // Echo for space: delay with feedback, low-passed.
    var delay = ctx.createDelay(2);
    delay.delayTime.value = 0.42;
    var fb = ctx.createGain();
    fb.gain.value = 0.38;
    var damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2200;
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    var wet = ctx.createGain();
    wet.gain.value = 0.35;
    damp.connect(wet);
    wet.connect(musicBus);
    echo = delay;
    musicBus.connect(master);
    return ctx;
  }

  function bindUnlock() {
    if (unlockBound) return;
    unlockBound = true;
    var unlock = function () {
      if (!wantMusic) return;
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      startMusic();
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  // ---------------------------------------------------------------------------
  // Music
  // ---------------------------------------------------------------------------
  function padChord(notes, when, length) {
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(500, when);
    filter.frequency.linearRampToValueAtTime(1300, when + length * 0.5);
    filter.frequency.linearRampToValueAtTime(600, when + length);
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.18, when + 3);
    env.gain.setValueAtTime(0.18, when + length - 2);
    env.gain.exponentialRampToValueAtTime(0.0001, when + length + 2.5);
    filter.connect(env);
    env.connect(musicBus);
    env.connect(echo);
    notes.forEach(function (n, i) {
      [-6, 6].forEach(function (cents) {
        var o = ctx.createOscillator();
        o.type = i === 0 ? 'triangle' : 'sawtooth';
        o.frequency.value = hz(n);
        o.detune.value = cents;
        var g = ctx.createGain();
        g.gain.value = (i === 0 ? 0.5 : 0.16) / notes.length;
        o.connect(g);
        g.connect(filter);
        o.start(when);
        o.stop(when + length + 3);
      });
    });
  }

  function bell(when) {
    var n = BELLS[Math.floor(Math.random() * BELLS.length)];
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz(n);
    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = hz(n) * 2.01;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.07, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 3.5);
    var g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(musicBus);
    g.connect(echo);
    o.start(when);
    o2.start(when);
    o.stop(when + 4);
    o2.stop(when + 4);
  }

  function startMusic() {
    if (playing || yielded || !ensure()) return;
    playing = true;
    var i = 0;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(musicVolume * 0.6, ctx.currentTime, 1.5);
    var next = function () {
      if (!playing) return;
      padChord(CHORDS[i % CHORDS.length], ctx.currentTime + 0.05, CHORD_SECONDS);
      i++;
      musicTimer = setTimeout(next, CHORD_SECONDS * 1000);
    };
    next();
    var ring = function () {
      if (!playing) return;
      if (Math.random() < 0.7) bell(ctx.currentTime + 0.05);
      bellTimer = setTimeout(ring, 2500 + Math.random() * 4000);
    };
    bellTimer = setTimeout(ring, 3000);
  }

  function stopMusic() {
    if (!playing) return;
    playing = false;
    clearTimeout(musicTimer);
    clearTimeout(bellTimer);
    if (ctx) {
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
    }
  }

  // ---------------------------------------------------------------------------
  // Sound effects
  // ---------------------------------------------------------------------------
  function tone(freq, start, dur, type, peak) {
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak || 0.25, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(sfxBus);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  var SFX = {
    notify: function (t) { tone(hz(81), t, 0.5); tone(hz(86), t + 0.12, 0.7); },
    success: function (t) { tone(hz(74), t, 0.35, 'triangle'); tone(hz(78), t + 0.09, 0.35, 'triangle'); tone(hz(81), t + 0.18, 0.6, 'triangle'); },
    error: function (t) { tone(hz(45), t, 0.35, 'square', 0.12); tone(hz(44), t + 0.12, 0.4, 'square', 0.1); },
    click: function (t) { tone(hz(96), t, 0.06, 'sine', 0.12); },
  };

  function sfx(name) {
    if (sfxVolume <= 0 || !SFX[name] || !supported()) return;
    // Sound effects follow a user action, so the context may be created here.
    if (!ensure()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(function () { SFX[name](ctx.currentTime + 0.01); }, function () {});
      return;
    }
    SFX[name](ctx.currentTime + 0.01);
  }

  // ---------------------------------------------------------------------------
  function apply(s) {
    musicVolume = Math.max(0, Math.min(1, (Number(s.musicVolume) || 0) / 100));
    sfxVolume = Math.max(0, Math.min(1, (Number(s.sfxVolume) || 0) / 100));
    wantMusic = !!s.musicOn && musicVolume > 0;
    if (ctx) {
      sfxBus.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.05);
      if (playing) musicBus.gain.setTargetAtTime(musicVolume * 0.6, ctx.currentTime, 0.3);
    }
    if (wantMusic) {
      bindUnlock();
      if (ctx && ctx.state === 'running') startMusic();
    } else if (!previewTimer) {
      stopMusic();
    }
  }

  /** Plays ~8 seconds of music (called from a click, so it may start the audio context). */
  function preview(volumePercent) {
    if (!ensure()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    if (volumePercent != null) musicVolume = Math.max(0, Math.min(1, volumePercent / 100));
    var wasPlaying = playing;
    startMusic();
    musicBus.gain.setTargetAtTime(musicVolume * 0.6, ctx.currentTime, 0.2);
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      previewTimer = null;
      if (!wasPlaying && !wantMusic) stopMusic();
    }, 8000);
    return true;
  }

  global.FogAudio = {
    apply: apply,
    sfx: sfx,
    preview: preview,
    supported: supported,
    isPlaying: function () { return playing; },
    stop: stopMusic,
    /** The Music tab calls this while it plays something, so the two never play over each other. */
    yieldTo: function (on) {
      yielded = !!on;
      if (yielded) stopMusic();
      else if (wantMusic && ctx && ctx.state === 'running') startMusic();
    },
  };
})(window);
