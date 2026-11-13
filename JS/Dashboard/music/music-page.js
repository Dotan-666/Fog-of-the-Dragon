/**
 * Music tab (#music): library with search and categories, sound board, playlists, uploads and history.
 * Playback is done by FogMusicPlayer (it keeps playing after you leave this page); data by FogMusicStore.
 */
(function (global) {
  'use strict';

  var Store = function () { return global.FogMusicStore; };
  var Player = function () { return global.FogMusicPlayer; };
  var Cat = function () { return global.FogAudioCatalog; };
  var TAB_KEY = 'fog_music_tab';
  var PL_KEY = 'fog_music_playlist';
  var UPLOAD_CATEGORY = { id: 'mine', label: 'My music' };
  var KIND_LABEL = { music: 'Music', ambience: 'Ambience', sfx: 'Sound effect', upload: 'Upload' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function session(key, val) {
    try {
      if (val === undefined) return global.sessionStorage.getItem(key);
      global.sessionStorage.setItem(key, val);
    } catch (e) { /* preference only */ }
    return null;
  }
  function time(sec) {
    if (sec == null || !isFinite(sec)) return '–:––';
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function bytes(n) {
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  }
  function ago(iso) {
    if (global.FogAccount && global.FogAccount.relativeTime) return global.FogAccount.relativeTime(iso);
    return new Date(iso).toLocaleString();
  }
  function categoryLabel(id) {
    return id === UPLOAD_CATEGORY.id ? UPLOAD_CATEGORY.label : global.FogAudioCatalog.categoryLabel(id);
  }

  function libraryCategories() {
    return global.FogAudioCatalog ? global.FogAudioCatalog.categories() : [];
  }

  function init(container) {
    var root = container.querySelector('#music-root');
    var $ = function (sel) { return root.querySelector(sel); };
    var uploads = [];
    var filter = { q: '', kind: 'all', category: null, sort: 'az', mood: '', scene: '', intensity: '' };
    var alive = true;
    var snap = Player().state();

    // ---------------------------------------------------------------------------
    // Data
    // ---------------------------------------------------------------------------
    function allItems() {
      var rec = (Cat() ? Cat().list() : []).map(function (r) {
        return { ref: 'rec:' + r.id, name: r.name, kind: r.kind, category: r.category, tags: r.tags || [], moods: r.moods || [], scenes: r.scenes || [], intensity: r.intensity || null, description: r.duration ? time(r.duration) + (r.kind === 'sfx' ? '' : r.loop !== false ? ' · loops' : '') : '', source: 'rec', rec: r };
      });
      var ups = uploads.map(function (u) {
        return { ref: 'up:' + u.id, name: u.name, kind: 'upload', category: u.category, tags: u.tags || [], moods: [], scenes: [], intensity: null, description: (u.duration ? time(u.duration) + ' · ' : '') + bytes(u.size), source: 'up', upload: u };
      });
      return rec.concat(ups);
    }

    function filtered() {
      var favs = Store().favorites();
      var words = filter.q.toLowerCase().split(/\s+/).filter(Boolean);
      var hist = Store().history();
      var list = allItems().filter(function (it) {
        if (filter.kind === 'fav' && favs.indexOf(it.ref) < 0) return false;
        if (filter.kind !== 'all' && filter.kind !== 'fav' && it.kind !== filter.kind) return false;
        if (filter.category && it.category !== filter.category) return false;
        if (filter.mood && it.moods.indexOf(filter.mood) < 0) return false;
        if (filter.scene && it.scenes.indexOf(filter.scene) < 0) return false;
        if (filter.intensity && String(it.intensity) !== filter.intensity) return false;
        if (!words.length) return true;
        var C = Cat();
        var hay = (it.name + ' ' + it.description + ' ' + (it.rec ? it.rec.author + ' ' + it.rec.source : '') + ' ' + it.tags.join(' ') + ' ' + categoryLabel(it.category) + ' ' + (KIND_LABEL[it.kind] || '') + ' ' +
          (C ? it.moods.map(C.moodLabel).join(' ') + ' ' + it.scenes.map(C.sceneLabel).join(' ') : '')).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      });
      var lastPlayed = {};
      hist.forEach(function (h, i) { if (lastPlayed[h.ref] == null) lastPlayed[h.ref] = i; });
      list.sort(function (a, b) {
        if (filter.sort === 'category') return categoryLabel(a.category).localeCompare(categoryLabel(b.category)) || a.name.localeCompare(b.name);
        if (filter.sort === 'recent') {
          var x = lastPlayed[a.ref] == null ? 1e9 : lastPlayed[a.ref];
          var y = lastPlayed[b.ref] == null ? 1e9 : lastPlayed[b.ref];
          return x - y || a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
      });
      return list;
    }

    function loadUploads() {
      return Store().listUploads().then(function (list) {
        uploads = list;
        return Player().refreshUploads();
      }, function (e) {
        uploads = [];
        showUploadStatus(e.message);
      });
    }

    // ---------------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------------
    function isCurrent(ref) {
      return snap.current && snap.current.ref === ref;
    }

    function playlistPicker(ref) {
      var pls = Store().playlists();
      return '<select class="form-control-dark music-add" data-music-add="' + esc(ref) + '" aria-label="Add to playlist">' +
        '<option value="">+ Playlist</option>' +
        pls.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('') +
        '<option value="__new">New playlist…</option></select>';
    }

    function row(it, extra) {
      var favs = Store().favorites();
      var fav = favs.indexOf(it.ref) >= 0;
      var cur = isCurrent(it.ref);
      var playing = cur && snap.playing;
      var sfx = it.kind === 'sfx';
      return '<article class="music-item' + (cur ? ' is-current' : '') + '" data-ref="' + esc(it.ref) + '">' +
        '<button type="button" class="music-play' + (playing ? ' is-playing' : '') + '" data-music-act="' + (sfx ? 'effect' : playing ? 'pause' : 'play') + '" data-ref="' + esc(it.ref) + '" aria-label="' + (sfx ? 'Play effect ' : playing ? 'Pause ' : 'Play ') + esc(it.name) + '">' + (playing ? '❚❚' : '▶') + '</button>' +
        '<div class="music-item-body">' +
        '<h3 class="music-item-title">' + esc(it.name) + '</h3>' +
        '<p class="music-item-meta"><span class="music-badge music-badge-' + esc(it.kind) + '">' + esc(KIND_LABEL[it.kind] || it.kind) + '</span>' +
        '<button type="button" class="music-cat-link" data-music-cat="' + esc(it.category) + '">' + esc(categoryLabel(it.category)) + '</button>' +
        (it.tags.length ? '<span class="music-tags">' + it.tags.slice(0, 5).map(function (t) { return '#' + esc(t); }).join(' ') + '</span>' : '') + '</p>' +
        (it.moods.length || it.scenes.length ? '<p class="music-item-moods">' + it.moods.map(function (m) { return '<button type="button" class="music-mood" data-music-mood="' + esc(m) + '">' + esc(Cat().moodLabel(m)) + '</button>'; }).join('') +
          (it.intensity ? '<span class="music-intensity music-intensity-' + it.intensity + '" title="Intensity">' + esc(Cat().intensityLabel(it.intensity)) + ' intensity</span>' : '') +
          (it.scenes.length ? '<span class="music-scenes">' + it.scenes.map(function (s) { return esc(Cat().sceneLabel(s)); }).join(' · ') + '</span>' : '') + '</p>' : '') +
        (it.description ? '<p class="music-item-desc">' + esc(it.description) + '</p>' : '') +
        (it.rec ? '<p class="music-item-credit"><span class="music-src music-src-rec">' + esc(it.rec.license.replace('-1.0', '')) + '</span> by ' + esc(it.rec.author) + ' · <a href="' + esc(it.rec.sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(it.rec.source) + '</a></p>' : '') +
        '</div>' +
        '<div class="music-item-actions">' +
        '<button type="button" class="music-fav' + (fav ? ' is-fav' : '') + '" data-music-act="fav" data-ref="' + esc(it.ref) + '" aria-pressed="' + fav + '" aria-label="' + (fav ? 'Remove from favorites' : 'Add to favorites') + '">' + (fav ? '★' : '☆') + '</button>' +
        playlistPicker(it.ref) + (extra || '') +
        '</div></article>';
    }

    function renderCategories() {
      var used = {};
      allItems().forEach(function (it) { used[it.category] = (used[it.category] || 0) + 1; });
      var cats = libraryCategories().concat(used[UPLOAD_CATEGORY.id] ? [UPLOAD_CATEGORY] : []).filter(function (c) { return used[c.id]; });
      $('#music-categories').innerHTML = '<button type="button" class="music-chip' + (!filter.category ? ' is-active' : '') + '" data-music-cat="" aria-pressed="' + !filter.category + '">All</button>' +
        cats.map(function (c) {
          var on = filter.category === c.id;
          return '<button type="button" class="music-chip' + (on ? ' is-active' : '') + '" data-music-cat="' + esc(c.id) + '" aria-pressed="' + on + '">' + esc(c.label) + ' <span>' + used[c.id] + '</span></button>';
        }).join('');
    }

    function renderLibrary() {
      renderCategories();
      var list = filtered();
      var C = Cat();
      $('#music-count').textContent = list.length + (list.length === 1 ? ' result' : ' results') + (filter.q ? ' for “' + filter.q + '”' : '') + (filter.category ? ' in ' + categoryLabel(filter.category) : '') +
        (filter.mood && C ? ' · ' + C.moodLabel(filter.mood) : '') + (filter.scene && C ? ' · ' + C.sceneLabel(filter.scene) : '') + (filter.intensity && C ? ' · ' + C.intensityLabel(Number(filter.intensity)) + ' intensity' : '');
      $('#music-clear-filters').hidden = !(filter.mood || filter.scene || filter.intensity || filter.category || filter.q);
      $('#music-list').innerHTML = list.length ? list.map(function (it) { return row(it); }).join('') :
        '<div class="music-empty">Nothing matches. Try another word or category' + (filter.kind === 'fav' ? ', or add favorites with ☆' : '') + '.</div>';
    }

    function renderBoard() {
      function groupsHtml(list, prefix, extraClass) {
        var groups = {};
        list.forEach(function (m) { (groups[m.category] = groups[m.category] || []).push(m); });
        return libraryCategories().filter(function (c) { return groups[c.id]; }).map(function (c) {
          return '<section class="music-board-group"><h4>' + esc(c.label) + '</h4><div class="music-pads">' +
            groups[c.id].map(function (m) {
              return '<button type="button" class="music-pad' + extraClass + '" data-music-act="effect" data-ref="' + prefix + esc(m.id) + '" title="' + esc(m.description || (m.author + ' · ' + m.source)) + '">' + esc(m.name) + '</button>';
            }).join('') + '</div></section>';
        }).join('');
      }
      var rec = Cat() ? Cat().list().filter(function (m) { return m.kind === 'sfx'; }) : [];
      $('#music-board').innerHTML = rec.length
        ? '<div class="music-board-bar"><h3 class="music-board-head">' + rec.length + ' sound effects <small>CC0 · several can play at once, over the music</small></h3>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-music-act="stop-effects"' + (snap.effectsPlaying ? '' : ' disabled') + '>Stop all effects' + (snap.effectsPlaying ? ' (' + snap.effectsPlaying + ')' : '') + '</button></div>' +
          groupsHtml(rec, 'rec:', ' music-pad-rec')
        : '<div class="music-empty">The sound effects could not be loaded.</div>';
    }

    function renderCredits() {
      var list = Cat() ? Cat().list() : [];
      var err = Cat() && Cat().error();
      $('#music-credits').innerHTML = (err ? '<p class="music-status" role="alert">' + esc(err) + '</p>' : '') +
        '<p class="music-hint">Every recording below was checked on its source page. All are CC0 1.0 (public domain dedication) from OpenGameArt (including Kenney’s packs there): free for commercial use, hosting, streaming and redistribution, with no attribution required. Credit is given anyway; the full list with source links is in Assets/Audio/ATTRIBUTION.md. Your uploads are your responsibility.</p>' +
        '<div class="table-scroll"><table class="music-credits-table"><thead><tr><th>Track</th><th>Type</th><th>Author</th><th>Source</th><th>License</th><th>Attribution</th></tr></thead><tbody>' +
        list.map(function (r) {
          var lic = Cat().license(r.license) || {};
          return '<tr><td>' + esc(r.name) + '</td><td>' + esc(KIND_LABEL[r.kind]) + '</td><td>' + esc(r.author) + '</td><td><a href="' + esc(r.sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(r.source) + '</a></td>' +
            '<td><a href="' + esc(lic.url || '#') + '" target="_blank" rel="noopener noreferrer">' + esc(lic.name || r.license) + '</a></td><td>' + esc(r.attribution) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    function selectedPlaylistId() {
      var pls = Store().playlists();
      var id = session(PL_KEY);
      if (!pls.some(function (p) { return p.id === id; })) id = pls[0] ? pls[0].id : null;
      return id;
    }

    function renderPlaylists() {
      var pls = Store().playlists();
      var sel = selectedPlaylistId();
      $('#music-pl-list').innerHTML = pls.length ? pls.map(function (p) {
        var playingThis = snap.queue && snap.queue.playlistId === p.id;
        return '<button type="button" class="music-pl-item' + (p.id === sel ? ' is-active' : '') + '" data-music-pl="' + esc(p.id) + '">' +
          (playingThis ? '<span class="music-eq is-playing" aria-label="playing"><i></i><i></i><i></i></span>' : '') +
          '<span>' + esc(p.name) + '</span><small>' + p.items.length + '</small></button>';
      }).join('') : '<p class="music-hint">No playlists yet. Name one above, then add tracks from the Library with “+ Playlist”.</p>';
      var main = $('#music-pl-main');
      var p = sel && Store().getPlaylist(sel);
      if (!p) {
        main.innerHTML = '<div class="music-empty">Create a playlist for a scene, like “Tavern night” or “Dragon fight”, and add music, ambience and sound effects to it.</div>';
        return;
      }
      var pr = Store().prefs();
      main.innerHTML =
        '<div class="music-pl-head">' +
        '<input type="text" class="form-control-dark music-pl-rename" data-music-rename="' + esc(p.id) + '" value="' + esc(p.name) + '" maxlength="60" aria-label="Playlist name" />' +
        '<div class="music-pl-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-music-act="play-pl" data-pl="' + esc(p.id) + '"' + (p.items.length ? '' : ' disabled') + '>▶ Play</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-music-act="shuffle-pl" data-pl="' + esc(p.id) + '"' + (p.items.length ? '' : ' disabled') + '>Shuffle play</button>' +
        '<button type="button" class="btn btn-outline-crimson btn-sm" data-music-act="delete-pl" data-pl="' + esc(p.id) + '">Delete</button></div></div>' +
        '<p class="music-hint">In a playlist, music plays to its end and sound effects play once. Ambience loops, so each ambience plays for ' +
        '<select class="form-control-dark music-select music-mins" data-music-pref="generatedMinutes" aria-label="Minutes per ambience">' +
        [1, 2, 3, 5, 10, 15, 20, 30].map(function (m) { return '<option value="' + m + '"' + (pr.generatedMinutes === m ? ' selected' : '') + '>' + m + ' min</option>'; }).join('') +
        '</select> before the next item starts. Sound effects play once.</p>' +
        (p.items.length ? '<ol class="music-pl-items">' + p.items.map(function (ref, i) {
          var it = Player().info(ref);
          var cur = snap.queue && snap.queue.playlistId === p.id && snap.queue.index === i && snap.current;
          return '<li class="' + (cur ? 'is-current' : '') + (it.missing ? ' is-missing' : '') + '">' +
            '<button type="button" class="music-play' + (cur && snap.playing ? ' is-playing' : '') + '" data-music-act="play-pl-at" data-pl="' + esc(p.id) + '" data-i="' + i + '" aria-label="Play from here"' + (it.missing ? ' disabled' : '') + '>' + (cur && snap.playing ? '❚❚' : '▶') + '</button>' +
            '<span class="music-pl-title">' + esc(it.title) + '<small>' + esc(it.missing ? 'Missing' : (KIND_LABEL[it.kind] || '') + ' · ' + categoryLabel(it.category)) + '</small></span>' +
            '<span class="music-pl-move"><button type="button" data-music-act="pl-up" data-pl="' + esc(p.id) + '" data-i="' + i + '" aria-label="Move up"' + (i ? '' : ' disabled') + '>▲</button>' +
            '<button type="button" data-music-act="pl-down" data-pl="' + esc(p.id) + '" data-i="' + i + '" aria-label="Move down"' + (i < p.items.length - 1 ? '' : ' disabled') + '>▼</button>' +
            '<button type="button" data-music-act="pl-remove" data-pl="' + esc(p.id) + '" data-i="' + i + '" aria-label="Remove from playlist">✕</button></span></li>';
        }).join('') + '</ol>' : '<div class="music-empty">This playlist is empty. In the Library or My Uploads, use “+ Playlist” on a track to add it here.</div>');
    }

    function renderUploads() {
      var catSel = $('#music-upload-category');
      if (!catSel.options.length) {
        catSel.innerHTML = [UPLOAD_CATEGORY].concat(libraryCategories()).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>'; }).join('');
      }
      var total = uploads.reduce(function (s, u) { return s + (u.size || 0); }, 0);
      var max = Store().LIMITS.maxTotalBytes;
      $('#music-usage').innerHTML = '<div class="music-usage-bar"><span style="width:' + Math.min(100, (total / max) * 100).toFixed(1) + '%"></span></div>' +
        '<small>' + uploads.length + ' file' + (uploads.length === 1 ? '' : 's') + ' · ' + bytes(total) + ' of ' + bytes(max) + ' used in this browser</small>';
      $('#music-upload-list').innerHTML = uploads.length ? uploads.map(function (u) {
        var it = { ref: 'up:' + u.id, name: u.name, kind: 'upload', category: u.category, tags: u.tags || [], description: (u.duration ? time(u.duration) + ' · ' : '') + bytes(u.size) + ' · added ' + ago(u.createdAt), source: 'up' };
        var edit = '<details class="music-edit"><summary>Edit</summary><div class="music-edit-body">' +
          '<label>Name <input type="text" class="form-control-dark" data-music-up-name="' + esc(u.id) + '" value="' + esc(u.name) + '" maxlength="80"></label>' +
          '<label>Category <select class="form-control-dark" data-music-up-cat="' + esc(u.id) + '">' + [UPLOAD_CATEGORY].concat(libraryCategories()).map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === u.category ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('') + '</select></label>' +
          '<label>Tags <input type="text" class="form-control-dark" data-music-up-tags="' + esc(u.id) + '" value="' + esc((u.tags || []).join(', ')) + '" placeholder="comma, separated"></label>' +
          '<button type="button" class="btn btn-outline-crimson btn-sm" data-music-act="delete-upload" data-id="' + esc(u.id) + '">Delete file</button></div></details>';
        return row(it, edit);
      }).join('') : '<div class="music-empty">No uploads yet. Your files are stored only in this browser and appear in the Library under “My uploads”.</div>';
    }

    function renderHistory() {
      var hist = Store().history();
      $('#music-history').innerHTML = hist.length ? hist.map(function (h) {
        var it = Player().info(h.ref);
        return '<li><button type="button" class="music-play" data-music-act="' + (it.kind === 'sfx' ? 'effect' : 'play') + '" data-ref="' + esc(h.ref) + '" aria-label="Play again"' + (it.missing ? ' disabled' : '') + '>▶</button>' +
          '<span class="music-pl-title">' + esc(it.missing ? h.title : it.title) + '<small>' + esc((KIND_LABEL[h.kind] || h.kind || '') + (it.missing ? ' · no longer available' : '')) + '</small></span>' +
          '<time datetime="' + esc(h.at) + '">' + esc(ago(h.at)) + '</time></li>';
      }).join('') : '<li class="music-empty">Nothing played yet.</li>';
    }

    function renderPlayer() {
      var s = snap;
      var p = s.prefs;
      var cur = s.current;
      var el = $('#music-player');
      var repeatLabel = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' }[p.repeat];
      var progress;
      el.classList.toggle('is-idle', !cur);
      if (!cur) progress = '<span class="music-time music-idle-hint">Pick something to play. Shortcuts: Space play/pause · N next · P previous · S stop.</span>';
      else if (s.endless) progress = '<span class="music-time">Endless · ' + time(s.position) + '</span>';
      else progress = '<span class="music-time" data-music-pos>' + time(s.position) + '</span>' +
        '<input type="range" class="music-seek" data-music-seek min="0" max="' + Math.max(1, Math.round(s.duration || 1)) + '" value="' + Math.round(s.position) + '" aria-label="Position"' + (cur.source === 'up' ? '' : ' disabled') + '>' +
        '<span class="music-time">' + time(s.duration) + '</span>';
      el.innerHTML =
        '<div class="music-now">' +
        '<span class="music-eq' + (s.playing ? ' is-playing' : '') + '" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<div><strong>' + esc(cur ? cur.title : 'Nothing playing') + '</strong>' +
        '<small>' + esc(cur ? (KIND_LABEL[cur.kind] || '') + ' · ' + categoryLabel(cur.category) + (s.queue ? ' · ' + s.queue.name + ' (' + (s.queue.index + 1) + '/' + s.queue.items.length + ')' : '') : (s.lastEffect ? 'Last effect: ' + s.lastEffect.title : 'Library, playlists or uploads')) + '</small>' +
        (s.error ? '<small class="music-error" role="alert">' + esc(s.error) + '</small>' : '') + '</div></div>' +
        '<div class="music-controls">' +
        '<button type="button" data-music-act="shuffle" class="music-ctl' + (p.shuffle ? ' is-on' : '') + '" aria-pressed="' + p.shuffle + '" title="Shuffle playlists">⤮</button>' +
        '<button type="button" data-music-act="prev" class="music-ctl" aria-label="Previous"' + (cur ? '' : ' disabled') + '>⏮</button>' +
        '<button type="button" data-music-act="toggle" class="music-ctl music-ctl-main" aria-label="' + (s.playing ? 'Pause' : 'Play') + '"' + (cur ? '' : ' disabled') + '>' + (s.playing ? '❚❚' : '▶') + '</button>' +
        '<button type="button" data-music-act="next" class="music-ctl" aria-label="Next"' + (s.queue ? '' : ' disabled') + '>⏭</button>' +
        '<button type="button" data-music-act="stop" class="music-ctl" aria-label="Stop"' + (cur ? '' : ' disabled') + '>■</button>' +
        '<button type="button" data-music-act="repeat" class="music-ctl' + (p.repeat !== 'off' ? ' is-on' : '') + '" title="' + repeatLabel + '" aria-label="' + repeatLabel + '">' + (p.repeat === 'one' ? '↻1' : '↻') + '</button>' +
        '</div>' +
        '<div class="music-progress">' + progress + '</div>' +
        '<div class="music-volumes">' +
        '<label title="Music volume">♪ <input type="range" min="0" max="100" value="' + p.musicVolume + '" data-music-vol="musicVolume" aria-label="Music volume"></label>' +
        '<label title="Sound effects volume">✦ <input type="range" min="0" max="100" value="' + p.sfxVolume + '" data-music-vol="sfxVolume" aria-label="Sound effects volume"></label>' +
        '</div>';
    }

    /** Light update for the 500 ms ticks: only the position. */
    function tickPlayer() {
      var pos = root.querySelector('[data-music-pos]');
      var seek = root.querySelector('[data-music-seek]');
      if (pos) pos.textContent = time(snap.position);
      if (seek && document.activeElement !== seek) seek.value = Math.round(snap.position);
      var endless = root.querySelector('.music-progress .music-time');
      if (snap.endless && endless) endless.textContent = 'Endless · ' + time(snap.position);
    }

    function renderAll() {
      renderLibrary();
      renderBoard();
      renderPlaylists();
      renderUploads();
      renderHistory();
      renderCredits();
      renderPlayer();
    }

    // ---------------------------------------------------------------------------
    // Tabs
    // ---------------------------------------------------------------------------
    function showTab(id) {
      root.querySelectorAll('[data-music-tab]').forEach(function (b) {
        var on = b.getAttribute('data-music-tab') === id;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      root.querySelectorAll('.music-panel').forEach(function (p) { p.hidden = p.id !== 'music-panel-' + id; });
      session(TAB_KEY, id);
    }

    // ---------------------------------------------------------------------------
    // Uploads
    // ---------------------------------------------------------------------------
    function showUploadStatus(msg) {
      var s = $('#music-upload-status');
      s.textContent = msg || '';
      s.hidden = !msg;
    }
    function handleFiles(files) {
      var list = Array.prototype.slice.call(files || []);
      if (!list.length) return;
      var category = $('#music-upload-category').value || 'mine';
      var done = 0;
      var errors = [];
      showUploadStatus('Saving ' + list.length + ' file' + (list.length === 1 ? '' : 's') + '…');
      list.reduce(function (chain, f) {
        return chain.then(function () {
          return Store().addUpload(f, { category: category }).then(function (r) {
            if (r.ok) done++;
            else errors.push(r.message);
          });
        });
      }, Promise.resolve()).then(function () {
        return loadUploads();
      }).then(function () {
        if (!alive) return;
        showUploadStatus((done ? done + ' file' + (done === 1 ? '' : 's') + ' added.' : '') + (errors.length ? ' ' + errors.join(' ') : ''));
        renderAll();
      });
    }

    // ---------------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------------
    function playPlaylist(id, index, shuffle) {
      var p = Store().getPlaylist(id);
      if (!p || !p.items.length) return;
      if (shuffle != null) Player().setPrefs({ shuffle: shuffle });
      var i = index != null ? index : shuffle ? Math.floor(Math.random() * p.items.length) : 0;
      Player().play(p.items[i], { queue: { playlistId: p.id, name: p.name, items: p.items }, index: i });
    }

    function onClick(e) {
      var t = e.target.closest('[data-music-tab], [data-music-tab-go], [data-music-cat], [data-music-pl], [data-music-act], [data-music-mood], #music-clear-filters');
      if (!t || !root.contains(t)) return;
      if (t.hasAttribute('data-music-mood')) { filter.mood = t.getAttribute('data-music-mood'); $('#music-mood').value = filter.mood; renderLibrary(); return; }
      if (t.id === 'music-clear-filters') {
        filter.mood = filter.scene = filter.intensity = filter.q = '';
        filter.category = null;
        ['#music-mood', '#music-scene', '#music-intensity', '#music-search'].forEach(function (sel) { $(sel).value = ''; });
        renderLibrary();
        return;
      }
      if (t.hasAttribute('data-music-tab')) { showTab(t.getAttribute('data-music-tab')); return; }
      if (t.hasAttribute('data-music-tab-go')) { showTab(t.getAttribute('data-music-tab-go')); return; }
      if (t.hasAttribute('data-music-cat')) {
        var c = t.getAttribute('data-music-cat') || null;
        filter.category = filter.category === c && t.classList.contains('music-cat-link') ? filter.category : c;
        showTab('library');
        renderLibrary();
        return;
      }
      if (t.hasAttribute('data-music-pl')) {
        session(PL_KEY, t.getAttribute('data-music-pl'));
        renderPlaylists();
        return;
      }
      var act = t.getAttribute('data-music-act');
      var ref = t.getAttribute('data-ref');
      var pl = t.getAttribute('data-pl');
      var i = Number(t.getAttribute('data-i'));
      switch (act) {
        case 'play': Player().play(ref); break;
        case 'pause': Player().pause(); break;
        case 'effect':
          Player().playEffect(ref);
          t.classList.remove('is-hit');
          void t.offsetWidth;
          t.classList.add('is-hit');
          break;
        case 'fav': Store().toggleFavorite(ref); break;
        case 'toggle': Player().toggle(); break;
        case 'stop': Player().stop(); break;
        case 'next': Player().next(); break;
        case 'prev': Player().prev(); break;
        case 'shuffle': Player().setPrefs({ shuffle: !snap.prefs.shuffle }); break;
        case 'repeat': Player().setPrefs({ repeat: { off: 'all', all: 'one', one: 'off' }[snap.prefs.repeat] }); break;
        case 'play-pl': playPlaylist(pl, null, false); break;
        case 'shuffle-pl': playPlaylist(pl, null, true); break;
        case 'play-pl-at':
          if (snap.queue && snap.queue.playlistId === pl && snap.queue.index === i && snap.current) Player().toggle();
          else playPlaylist(pl, i);
          break;
        case 'pl-up': Store().moveInPlaylist(pl, i, -1); break;
        case 'pl-down': Store().moveInPlaylist(pl, i, 1); break;
        case 'pl-remove': Store().removeFromPlaylist(pl, i); break;
        case 'delete-pl': {
          var p = Store().getPlaylist(pl);
          if (p && confirm('Delete the playlist “' + p.name + '”? The tracks themselves are not deleted.')) {
            if (snap.queue && snap.queue.playlistId === pl) Player().stop();
            Store().deletePlaylist(pl);
          }
          break;
        }
        case 'delete-upload': {
          var u = uploads.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
          if (u && confirm('Delete “' + u.name + '” from this browser? It is also removed from your playlists.')) {
            if (snap.current && snap.current.ref === 'up:' + u.id) Player().stop();
            Store().deleteUpload(u.id).then(function () { return loadUploads(); }).then(function () { if (alive) renderAll(); });
          }
          break;
        }
        case 'stop-effects': Player().stopEffects(); break;
        case 'clear-history':
          if (confirm('Clear your play history?')) Store().clearHistory();
          break;
        default:
      }
    }

    function onChange(e) {
      var t = e.target;
      if (t.hasAttribute('data-music-add')) {
        var ref = t.getAttribute('data-music-add');
        var v = t.value;
        t.value = '';
        if (!v) return;
        if (v === '__new') {
          var name = prompt('Name the new playlist');
          if (!name) return;
          var cr = Store().createPlaylist(name);
          if (!cr.ok) { alert(cr.message); return; }
          v = cr.playlist.id;
        }
        var r = Store().addToPlaylist(v, ref);
        if (!r.ok) alert(r.message);
        else flash(t.closest('.music-item'), 'Added to “' + r.playlist.name + '”');
        return;
      }
      if (t.id === 'music-kind') { filter.kind = t.value; renderLibrary(); return; }
      if (t.id === 'music-sort') { filter.sort = t.value; renderLibrary(); return; }
      if (t.id === 'music-mood' || t.id === 'music-scene' || t.id === 'music-intensity') { filter[t.id.slice(6)] = t.value; renderLibrary(); return; }
      if (t.hasAttribute('data-music-pref')) { Player().setPrefs({ generatedMinutes: Number(t.value) }); return; }
      if (t.hasAttribute('data-music-rename')) {
        var rr = Store().renamePlaylist(t.getAttribute('data-music-rename'), t.value);
        if (!rr.ok) alert(rr.message);
        return;
      }
      if (t.hasAttribute('data-music-up-name') || t.hasAttribute('data-music-up-cat') || t.hasAttribute('data-music-up-tags')) {
        var id = t.getAttribute('data-music-up-name') || t.getAttribute('data-music-up-cat') || t.getAttribute('data-music-up-tags');
        var patch = t.hasAttribute('data-music-up-name') ? { name: t.value } : t.hasAttribute('data-music-up-cat') ? { category: t.value } : { tags: t.value.split(',') };
        Store().updateUpload(id, patch).then(function () { return loadUploads(); }).then(function () { if (alive) { renderLibrary(); renderPlaylists(); renderPlayer(); } });
        return;
      }
      if (t.id === 'music-file') { handleFiles(t.files); t.value = ''; }
    }

    function onInput(e) {
      var t = e.target;
      if (t.id === 'music-search') { filter.q = t.value.trim(); renderLibrary(); return; }
      if (t.hasAttribute('data-music-vol')) { var patch = {}; patch[t.getAttribute('data-music-vol')] = Number(t.value); Player().setVolumes(patch); return; }
      if (t.hasAttribute('data-music-seek')) Player().seek(Number(t.value));
    }

    function flash(el, text) {
      if (!el) return;
      var n = document.createElement('span');
      n.className = 'music-flash';
      n.setAttribute('role', 'status');
      n.textContent = text;
      el.appendChild(n);
      setTimeout(function () { n.remove(); }, 1800);
    }

    function onKey(e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      if (e.key === ' ' && tag !== 'button' && tag !== 'summary') { e.preventDefault(); Player().toggle(); }
      else if (e.key === 'n' || e.key === 'N') Player().next();
      else if (e.key === 'p' || e.key === 'P') Player().prev();
      else if (e.key === 's' || e.key === 'S') Player().stop();
    }

    var drop = $('#music-drop');
    drop.addEventListener('click', function () { $('#music-file').click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#music-file').click(); } });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-over'); handleFiles(e.dataTransfer && e.dataTransfer.files); });
    root.querySelector('#music-pl-new').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#music-pl-name');
      var r = Store().createPlaylist(input.value);
      if (!r.ok) { alert(r.message); return; }
      input.value = '';
      session(PL_KEY, r.playlist.id);
    });
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    document.addEventListener('keydown', onKey);

    var lastKey = '';
    var unsubPlayer = Player().subscribe(function (s) {
      snap = s;
      if (!alive) return;
      var key = (s.current ? s.current.ref : '') + '|' + s.playing + '|' + (s.queue ? s.queue.playlistId + ':' + s.queue.index : '') + '|' + s.error + '|' + JSON.stringify(s.prefs) + '|' + (s.lastEffect && s.lastEffect.at) + '|' + Math.round(s.duration || 0);
      if (key !== lastKey) {
        lastKey = key;
        renderPlayer();
        renderLibrary();
        renderPlaylists();
        renderUploads();
      } else {
        tickPlayer();
      }
      var stopFx = root.querySelector('[data-music-act="stop-effects"]');
      if (stopFx) {
        stopFx.disabled = !s.effectsPlaying;
        stopFx.textContent = 'Stop all effects' + (s.effectsPlaying ? ' (' + s.effectsPlaying + ')' : '');
      }
    });
    var unsubStore = Store().onChange(function () {
      if (!alive) return;
      renderLibrary();
      renderPlaylists();
      renderHistory();
      renderUploads();
    });

    var tab = session(TAB_KEY);
    showTab(['library', 'board', 'playlists', 'uploads', 'history', 'credits'].indexOf(tab) >= 0 ? tab : 'library');
    renderAll();
    function fillMoodFilters() {
      var C = Cat();
      if (!C) return;
      var fill = function (sel, first, list) { $(sel).innerHTML = '<option value="">' + first + '</option>' + list.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.label) + '</option>'; }).join(''); };
      fill('#music-mood', 'Any mood', C.moods());
      fill('#music-scene', 'Any scene', C.scenes());
      fill('#music-intensity', 'Any intensity', C.intensities());
    }
    Promise.all([loadUploads(), Cat() ? Cat().ready() : null]).then(function () {
      if (!alive) return;
      fillMoodFilters();
      renderAll();
    });

    return function cleanup() {
      alive = false;
      unsubPlayer();
      unsubStore();
      document.removeEventListener('keydown', onKey);
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.music = init;
})(window);
