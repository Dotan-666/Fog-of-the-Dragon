/**
 * In-session music controller used by the Campaign workspace's Music section (DM only). It is a view of the same FogMusicPlayer used by
 * the Music page: scenes are your playlists, plus now-playing controls and quick sound effect pads.
 *
 * FogSessionMusic.render()        → HTML for the card body
 * FogSessionMusic.mount(el)       → binds events and live updates; returns cleanup
 */
(function (global) {
  'use strict';

  var Player = function () { return global.FogMusicPlayer; };
  var Store = function () { return global.FogMusicStore; };
  var Cat = function () { return global.FogAudioCatalog; };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function body(snap) {
    var pls = Store().playlists();
    var cur = snap.current;
    var fx = Cat() ? Cat().list().filter(function (r) { return r.kind === 'sfx'; }).slice(0, 12) : [];
    return '<div class="sm-now">' +
      '<div class="sm-now-text"><strong>' + esc(cur ? cur.title : 'Nothing playing') + '</strong>' +
      '<small>' + esc(cur ? (snap.queue ? 'Scene: ' + snap.queue.name + ' (' + (snap.queue.index + 1) + '/' + snap.queue.items.length + ')' : 'Single track') + (snap.playing ? '' : ' · paused') : 'Pick a scene below') + '</small>' +
      (snap.error ? '<small class="sm-error" role="alert">' + esc(snap.error) + '</small>' : '') + '</div>' +
      '<div class="sm-controls">' +
      '<button type="button" class="btn btn-secondary btn-sm" data-sm="prev"' + (snap.queue ? '' : ' disabled') + '>Previous</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-sm="toggle"' + (cur ? '' : ' disabled') + '>' + (snap.playing ? 'Pause' : 'Play') + '</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-sm="next"' + (snap.queue ? '' : ' disabled') + '>Next</button>' +
      '<button type="button" class="btn btn-outline-crimson btn-sm" data-sm="stop"' + (cur ? '' : ' disabled') + '>Stop</button>' +
      '<label class="sm-vol">Volume <input type="range" min="0" max="100" value="' + snap.prefs.musicVolume + '" data-sm-vol aria-label="Music volume"></label>' +
      '</div></div>' +
      '<h3 class="sm-head">Scenes</h3>' +
      (pls.length ? '<div class="sm-scenes">' + pls.map(function (p) {
        var on = snap.queue && snap.queue.playlistId === p.id;
        return '<button type="button" class="sm-scene' + (on ? ' is-on' : '') + '" data-sm="scene" data-pl="' + esc(p.id) + '"' + (p.items.length ? '' : ' disabled') + '>' +
          '<strong>' + esc(p.name) + '</strong><small>' + p.items.length + ' item' + (p.items.length === 1 ? '' : 's') + (on ? ' · playing' : '') + '</small></button>';
      }).join('') + '</div>' : '<p class="cv-note">No playlists yet. Create scenes (for example “Tavern”, “Ambush”, “Dragon lair”) on the <a href="#music" data-fog-nav="#music">Music page</a>.</p>') +
      (fx.length ? '<h3 class="sm-head">Sound effects</h3><div class="sm-fx">' + fx.map(function (r) {
        return '<button type="button" class="sm-fx-btn" data-sm="fx" data-ref="rec:' + esc(r.id) + '">' + esc(r.name) + '</button>';
      }).join('') + '</div>' : '');
  }

  function mount(el) {
    if (!el || !Player()) return function () {};
    el.setAttribute('data-session-music', '');
    var lastKey = '';
    function draw(snap) {
      var key = JSON.stringify([snap.current && snap.current.ref, snap.playing, snap.queue && [snap.queue.playlistId, snap.queue.index], snap.error, snap.prefs.musicVolume, Store().playlists().map(function (p) { return p.id + p.items.length; })]);
      if (key === lastKey) return;
      lastKey = key;
      var vol = el.querySelector('[data-sm-vol]');
      if (vol && document.activeElement === vol) return; // don't redraw under the slider while dragging
      el.innerHTML = body(snap);
    }
    function onClick(e) {
      var b = e.target.closest('[data-sm]');
      if (!b || !el.contains(b)) return;
      var a = b.getAttribute('data-sm');
      if (a === 'toggle') Player().toggle();
      else if (a === 'next') Player().next();
      else if (a === 'prev') Player().prev();
      else if (a === 'stop') Player().stop();
      else if (a === 'fx') Player().playEffect(b.getAttribute('data-ref'));
      else if (a === 'scene') {
        var p = Store().getPlaylist(b.getAttribute('data-pl'));
        if (!p || !p.items.length) return;
        var i = Store().prefs().shuffle ? Math.floor(Math.random() * p.items.length) : 0;
        Player().play(p.items[i], { queue: { playlistId: p.id, name: p.name, items: p.items }, index: i });
      }
    }
    function onInput(e) {
      if (e.target.hasAttribute('data-sm-vol')) Player().setVolumes({ musicVolume: Number(e.target.value) });
    }
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    var unsub = Player().subscribe(draw);
    var unsubStore = Store().onChange(function () { draw(Player().state()); });
    draw(Player().state());
    if (Cat()) Cat().ready().then(function () { lastKey = ''; draw(Player().state()); });
    return function cleanup() {
      unsub();
      unsubStore();
      el.removeEventListener('click', onClick);
      el.removeEventListener('input', onInput);
      el.removeAttribute('data-session-music');
      Player().state(); // no-op; the mini player re-checks on the next update
    };
  }

  global.FogSessionMusic = { mount: mount };
})(window);
