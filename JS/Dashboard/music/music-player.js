/**
 * Music player engine, shared by the Music page, the small floating player on other dashboard pages and the
 * campaign page's Session music card. It keeps playing while you move around the dashboard (scripts stay loaded).
 *
 * What it plays:
 * - Licensed recordings from the catalog (FogAudioCatalog, refs "rec:<id>") and uploaded files ("up:<id>").
 * - Background music and ambience use one <audio> element (one track at a time, seekable).
 *   On its own, a recording loops (unless Repeat is off); in a playlist, music plays to its end and ambience plays
 *   for prefs.generatedMinutes, then the next item starts.
 * - Sound effects use a fresh <audio> element each time, on their own volume, so several can overlap and they
 *   never interrupt the music.
 * - Files that can't be loaded are reported and skipped in playlists; they are never shown as playing.
 * While something plays here, the Settings background music (FogAudio) stays quiet.
 */
(function (global) {
  'use strict';

  var Store = function () { return global.FogMusicStore; };
  var Cat = function () { return global.FogAudioCatalog; };

  var audioEl = null;
  var objectUrl = null;
  var advanceTimer = null;
  var ticker = null;
  var listeners = [];
  var uploadMeta = {};
  var activeEffects = [];

  var state = {
    current: null, // { ref, title, kind, category, source }
    playing: false,
    queue: null, // { playlistId, name, items: [ref], index }
    error: null,
    failures: 0,
    lastEffect: null,
  };

  function prefs() { return Store().prefs(); }
  function curve(percent) { return Math.min(1, Math.pow(Math.max(0, percent) / 100, 1.6)); }

  function applyVolumes() {
    if (audioEl) audioEl.volume = curve(prefs().musicVolume);
    var fx = curve(prefs().sfxVolume);
    activeEffects.forEach(function (a) { a.volume = fx; });
  }

  function emit() {
    var snap = snapshot();
    listeners.slice().forEach(function (fn) { try { fn(snap); } catch (e) { /* ignore */ } });
    renderMini(snap);
  }

  function snapshot() {
    var cur = state.current;
    var pos = cur && audioEl ? audioEl.currentTime || 0 : 0;
    var dur = cur && audioEl && isFinite(audioEl.duration) ? audioEl.duration : null;
    return {
      current: cur ? Object.assign({}, cur) : null,
      playing: state.playing,
      queue: state.queue ? { playlistId: state.queue.playlistId, name: state.queue.name, items: state.queue.items.slice(), index: state.queue.index } : null,
      position: pos,
      duration: dur,
      endless: !!(cur && !state.queue && audioEl && audioEl.loop),
      looping: !!(cur && audioEl && audioEl.loop),
      elementVolume: audioEl ? audioEl.volume : null,
      effectsPlaying: activeEffects.length,
      error: state.error,
      lastEffect: state.lastEffect,
      prefs: prefs(),
    };
  }

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(function () { if (state.playing) emit(); }, 500);
  }
  function stopTicker() {
    clearInterval(ticker);
    ticker = null;
  }

  // ---------------------------------------------------------------------------
  // Resolving references
  // ---------------------------------------------------------------------------
  function refreshUploads() {
    return Store().listUploads().then(function (list) {
      uploadMeta = {};
      list.forEach(function (u) { uploadMeta[u.id] = u; });
      return uploadMeta;
    }, function () { return uploadMeta; });
  }

  /** Synchronous info for a reference ({ ref, title, kind, category, source, missing }). */
  function info(ref) {
    var parts = String(ref).split(':');
    if (parts[0] === 'rec') {
      var r = Cat() && Cat().get(parts[1]);
      return r ? { ref: ref, title: r.name, kind: r.kind, category: r.category, source: 'rec', author: r.author, license: r.license, duration: r.duration, description: r.author + ' · ' + r.source }
        : { ref: ref, title: 'Unavailable recording', missing: true, source: 'rec' };
    }
    if (parts[0] === 'up') {
      var u = uploadMeta[parts[1]];
      return u ? { ref: ref, title: u.name, kind: 'upload', category: u.category, source: 'up', duration: u.duration } : { ref: ref, title: 'Deleted upload', missing: true, source: 'up' };
    }
    return { ref: ref, title: 'Unavailable track', missing: true, source: 'unknown' };
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------
  function clearCurrent() {
    clearTimeout(advanceTimer);
    advanceTimer = null;
    if (audioEl) {
      audioEl.pause();
      audioEl.removeAttribute('src');
      audioEl.load();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function yieldBackground(on) {
    if (global.FogAudio && global.FogAudio.yieldTo) global.FogAudio.yieldTo(on);
  }

  function getAudioEl() {
    if (audioEl) return audioEl;
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.addEventListener('ended', function () { onEnded(); });
    audioEl.addEventListener('timeupdate', function () { if (state.current) emit(); });
    audioEl.addEventListener('playing', function () { state.failures = 0; });
    audioEl.addEventListener('error', function () {
      if (!state.current || !audioEl.getAttribute('src')) return;
      failed('"' + state.current.title + '" could not be loaded (the file is missing or this browser can\'t play it).');
    });
    return audioEl;
  }

  /** A track failed to load or play: say so, and in a playlist move on (giving up after every item failed). */
  function failed(message) {
    clearTimeout(advanceTimer);
    state.playing = false;
    state.error = message;
    state.failures = (state.failures || 0) + 1;
    var q = state.queue;
    if (q && state.failures < q.items.length) advanceTimer = setTimeout(function () { next(true); }, 800);
    else if (q) state.failures = 0;
    emit();
  }

  function scheduleAdvance(seconds) {
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(function () { onEnded(); }, Math.max(0.5, seconds) * 1000);
  }

  /** Starts a reference. opts: { queue: { playlistId, name, items }, index, resume, fromQueue } */
  function play(ref, opts) {
    opts = opts || {};
    if (typeof Audio === 'undefined') {
      state.error = 'This browser can\'t play audio.';
      emit();
      return Promise.resolve(false);
    }
    if (opts.queue) state.queue = { playlistId: opts.queue.playlistId || null, name: opts.queue.name || '', items: opts.queue.items.slice(), index: opts.index || 0 };
    else if (!opts.fromQueue) state.queue = null;
    return Promise.all([refreshUploads(), Cat() ? Cat().ready() : null]).then(function () {
      var it = info(ref);
      if (it.missing) {
        state.error = '"' + it.title + '" is no longer available; skipped.';
        var q = state.queue;
        if (q && (opts.skips || 0) < q.items.length) {
          q.index = (q.index + 1) % q.items.length;
          return play(q.items[q.index], { fromQueue: true, skips: (opts.skips || 0) + 1 });
        }
        if (q) stop();
        emit();
        return false;
      }
      if (it.kind === 'sfx' && !state.queue) {
        playEffect(ref);
        return true;
      }
      clearCurrent();
      // Keep the notice about a track that was just skipped; a manual choice clears it.
      if (!(opts.fromQueue && state.failures)) state.error = null;
      state.current = it;
      state.playing = true;
      yieldBackground(true);
      startTicker();
      if (!opts.resume) Store().addHistory({ ref: ref, title: it.title, kind: it.kind, playlistId: state.queue && state.queue.playlistId });

      if (it.source === 'rec') {
        var entry = Cat().get(ref.slice(4));
        if (entry.kind === 'sfx') {
          // A sound effect inside a playlist: play it once, then move on.
          var fx = playRecordedEffect(entry);
          fx.addEventListener('ended', function () { if (state.current && state.current.ref === ref) onEnded(); });
          fx.addEventListener('error', function () { if (state.current && state.current.ref === ref) failed('"' + entry.name + '" could not be loaded.'); });
          scheduleAdvance(Math.max(3, (entry.duration || 10) + 2));
          emit();
          return true;
        }
        var el = getAudioEl();
        var ambienceInQueue = !!state.queue && entry.kind === 'ambience';
        el.src = entry.url;
        el.loop = ambienceInQueue || (state.queue ? prefs().repeat === 'one' : (entry.loop !== false && prefs().repeat !== 'off'));
        if (ambienceInQueue) scheduleAdvance(prefs().generatedMinutes * 60);
        applyVolumes();
        return el.play().then(function () { emit(); return true; }, function (e) {
          if (e && e.name === 'NotAllowedError') {
            state.playing = false;
            state.error = 'Click play again to allow audio in this browser.';
            emit();
          } else if (state.current && state.current.ref === ref && state.playing) {
            failed('"' + entry.name + '" could not be played.');
          }
          return false;
        });
      }
      return Store().getUploadBlob(ref.slice(3)).then(function (blob) {
        if (!blob) throw new Error('missing');
        var uel = getAudioEl();
        objectUrl = URL.createObjectURL(blob);
        uel.src = objectUrl;
        uel.loop = !state.queue && prefs().repeat === 'one';
        applyVolumes();
        return uel.play().then(function () { emit(); return true; });
      }).catch(function (e) {
        state.playing = false;
        state.error = e && e.name === 'NotAllowedError' ? 'Click play again to allow audio in this browser.' : 'This upload could not be played.';
        emit();
        return false;
      });
    });
  }

  function onEnded() {
    if (!state.current) return;
    if (!state.queue) {
      if (prefs().repeat === 'one') { play(state.current.ref, { resume: true }); return; }
      stop();
      return;
    }
    if (prefs().repeat === 'one') { play(state.current.ref, { fromQueue: true, resume: true }); return; }
    next(true);
  }

  function next(auto) {
    var q = state.queue;
    if (!q || !q.items.length) { if (!auto) stop(); return Promise.resolve(false); }
    var p = prefs();
    var i;
    if (p.shuffle && q.items.length > 1) {
      do { i = Math.floor(Math.random() * q.items.length); } while (i === q.index);
    } else {
      i = q.index + 1;
      if (i >= q.items.length) {
        if (p.repeat === 'off' && auto) { stop(); return Promise.resolve(false); }
        i = 0;
      }
    }
    q.index = i;
    return play(q.items[i], { fromQueue: true });
  }

  function prev() {
    var q = state.queue;
    if (!q || snapshot().position > 4) {
      if (state.current) return play(state.current.ref, { fromQueue: !!q, resume: true });
      return Promise.resolve(false);
    }
    q.index = (q.index - 1 + q.items.length) % q.items.length;
    return play(q.items[q.index], { fromQueue: true });
  }

  function pause() {
    if (!state.current || !state.playing) return;
    state.playing = false;
    clearTimeout(advanceTimer);
    if (audioEl) audioEl.pause();
    yieldBackground(false);
    emit();
  }

  function resume() {
    if (!state.current) return Promise.resolve(false);
    if (audioEl && audioEl.getAttribute('src') && state.current.kind !== 'sfx') {
      state.playing = true;
      yieldBackground(true);
      startTicker();
      return audioEl.play().then(function () { emit(); return true; }, function () { state.playing = false; emit(); return false; });
    }
    return play(state.current.ref, { fromQueue: !!state.queue, resume: true });
  }

  function toggle() {
    return state.playing ? (pause(), Promise.resolve(true)) : resume();
  }

  function stop() {
    clearCurrent();
    state.playing = false;
    state.current = null;
    state.queue = null;
    stopTicker();
    yieldBackground(false);
    emit();
  }

  function seek(seconds) {
    if (state.current && audioEl && isFinite(audioEl.duration)) {
      audioEl.currentTime = Math.max(0, Math.min(audioEl.duration - 0.1, seconds));
      emit();
    }
  }

  /** Plays a recorded effect on its own element at the effects volume (several can overlap). */
  function playRecordedEffect(entry) {
    var a = new Audio(entry.url);
    a.volume = curve(prefs().sfxVolume);
    activeEffects.push(a);
    var done = function () {
      activeEffects = activeEffects.filter(function (x) { return x !== a; });
      emit();
    };
    a.addEventListener('ended', done);
    a.addEventListener('error', done);
    a.play().catch(function () { /* reported by the error event */ });
    return a;
  }

  /** One-shot sound effect on top of whatever is playing. */
  function playEffect(ref) {
    var entry = /^rec:/.test(String(ref)) && Cat() && Cat().get(String(ref).slice(4));
    if (!entry || entry.kind !== 'sfx') return false;
    var a = playRecordedEffect(entry);
    a.addEventListener('error', function () {
      state.error = '"' + entry.name + '" could not be loaded.';
      emit();
    });
    state.lastEffect = { ref: ref, title: entry.name, at: Date.now() };
    Store().addHistory({ ref: ref, title: entry.name, kind: 'sfx' });
    emit();
    return true;
  }

  /** Stops every sound effect that is still playing (the music keeps going). */
  function stopEffects() {
    activeEffects.slice().forEach(function (a) { a.pause(); });
    activeEffects = [];
    emit();
  }

  function setVolumes(patch) {
    Store().setPrefs(patch);
    applyVolumes();
    emit();
  }

  function setPrefs(patch) {
    Store().setPrefs(patch);
    if (audioEl && state.current) {
      var e = state.current.source === 'rec' && Cat() && Cat().get(state.current.ref.slice(4));
      if (!state.queue) audioEl.loop = e ? (e.loop !== false && prefs().repeat !== 'off') : prefs().repeat === 'one';
      else if (!(e && e.kind === 'ambience')) audioEl.loop = prefs().repeat === 'one';
    }
    emit();
  }

  // ---------------------------------------------------------------------------
  // Floating mini player (other dashboard pages)
  // ---------------------------------------------------------------------------
  var mini = null;
  function onMusicPage() {
    return /^#music(\/|$)/.test(global.location.hash || '');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function renderMini(snap) {
    if (typeof document === 'undefined') return;
    // Hidden on the Music page and where the campaign session controller is shown (same player, no duplicate controls).
    var show = !!snap.current && !onMusicPage() && !document.querySelector('[data-session-music]');
    if (!show) {
      if (mini) mini.hidden = true;
      return;
    }
    if (!mini) {
      mini = document.createElement('div');
      mini.className = 'fog-mini-player';
      mini.setAttribute('role', 'region');
      mini.setAttribute('aria-label', 'Music player');
      mini.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mini]');
        if (!b) return;
        var a = b.getAttribute('data-mini');
        if (a === 'toggle') toggle();
        else if (a === 'next') next(false);
        else if (a === 'stop') stop();
        else if (a === 'open' && global.FogDashboardRouter) global.FogDashboardRouter.navigateTo('#music');
      });
      document.body.appendChild(mini);
    }
    mini.hidden = false;
    var key = (snap.current ? snap.current.ref : '') + '|' + snap.playing + '|' + !!snap.queue;
    if (mini.getAttribute('data-key') === key) return;
    mini.setAttribute('data-key', key);
    mini.innerHTML =
      '<span class="fog-mini-eq' + (snap.playing ? ' is-playing' : '') + '" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<button type="button" class="fog-mini-title" data-mini="open" title="Open the Music tab">' + esc(snap.current.title) + (snap.queue ? '<small>' + esc(snap.queue.name) + '</small>' : '') + '</button>' +
      '<button type="button" class="fog-mini-btn" data-mini="toggle" aria-label="' + (snap.playing ? 'Pause' : 'Play') + '">' + (snap.playing ? '❚❚' : '▶') + '</button>' +
      (snap.queue ? '<button type="button" class="fog-mini-btn" data-mini="next" aria-label="Next track">⏭</button>' : '') +
      '<button type="button" class="fog-mini-btn" data-mini="stop" aria-label="Stop">■</button>';
  }
  if (typeof global.addEventListener === 'function') global.addEventListener('hashchange', function () { renderMini(snapshot()); });

  global.FogMusicPlayer = {
    play: play,
    playEffect: playEffect,
    stopEffects: stopEffects,
    toggle: toggle,
    pause: pause,
    resume: resume,
    stop: stop,
    next: function () { return next(false); },
    prev: prev,
    seek: seek,
    setVolumes: setVolumes,
    setPrefs: setPrefs,
    info: info,
    refreshUploads: refreshUploads,
    state: snapshot,
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
