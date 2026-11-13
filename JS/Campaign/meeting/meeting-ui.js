/**
 * Meeting in the Fog — the call interface, mounted once by the campaign shell (so it stays while sections change).
 *
 *   FogMeetingUI.mount(ctx, session) → { open(), minimize(), destroy() }
 *
 * A panel (video tiles, names, microphone / camera / connection state, controls, participant list, device choice) that
 * can be minimised to a small dock. Tiles show the real camera picture or a placeholder; nothing is simulated. The DM
 * also gets "Close the room for everyone" and "Share my music".
 */
(function (global) {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var I = {
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 9.3V6a3 3 0 0 0-5.7-1.3M9 9v3a3 3 0 0 0 5.1 2.1M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 11 5.7M12 18v3M3 3l18 18"/></svg>',
    cam: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>',
    camOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1M9 5h5a2 2 0 0 1 2 2v3l6-3v10M3 3l18 18"/></svg>',
    people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M22 20a6 6 0 0 0-4-5.6"/></svg>',
    leave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15c3-3 15-3 18 0l-2 3-4-1v-3a10 10 0 0 0-6 0v3l-4 1z"/></svg>',
    min: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    max: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  };
  var STATUS = { joining: 'Connecting…', connected: 'Connected', reconnecting: 'Reconnecting…', disconnected: 'Disconnected', unavailable: 'Not set up', error: 'Couldn’t connect', idle: '' };
  var QUALITY = { excellent: 'Excellent connection', good: 'Good connection', poor: 'Weak connection', lost: 'Connection lost', unknown: '' };

  function mount(ctx, session) {
    var panelOpen = false;
    var showPeople = false;
    var showDevices = false;
    var tiles = Object.create(null);

    var wrap = document.createElement('div');
    wrap.className = 'mf-root';
    wrap.innerHTML =
      '<section class="mf-panel" id="mf-panel" role="dialog" aria-modal="false" aria-labelledby="mf-title" hidden>' +
        '<header class="mf-head"><div><h2 class="mf-title" id="mf-title">Meeting in the Fog</h2><p class="mf-sub"><span class="mf-status" id="mf-status"></span> · <span id="mf-count"></span></p></div>' +
        '<button type="button" class="mf-icon" data-mf="minimize" aria-label="Minimise the call (it keeps going)" title="Minimise">' + I.min + '</button></header>' +
        '<p class="mf-notice" id="mf-notice" role="status" hidden></p>' +
        '<div class="mf-body"><div class="mf-grid" id="mf-grid" aria-label="Video"></div><aside class="mf-people" id="mf-people" hidden aria-label="People in the call"></aside></div>' +
        '<div class="mf-devices" id="mf-devices" hidden></div>' +
        '<footer class="mf-controls" id="mf-controls"></footer>' +
        '<div class="mf-audio" id="mf-audio" aria-hidden="true"></div>' +
      '</section>' +
      '<div class="mf-dock" id="mf-dock" role="region" aria-label="Meeting in the Fog" hidden></div>';
    document.body.appendChild(wrap);
    var $ = function (s) { return wrap.querySelector(s); };

    function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '?'; }

    function drawTiles(st) {
      var grid = $('#mf-grid');
      var seen = {};
      var waiting = grid.querySelector('.mf-empty');
      if (waiting && st.participants.length) waiting.remove();
      st.participants.forEach(function (p) {
        seen[p.id] = true;
        var t = tiles[p.id];
        if (!t) {
          t = document.createElement('figure');
          t.className = 'mf-tile';
          t.setAttribute('data-pid', p.id);
          t.innerHTML = '<video autoplay playsinline muted></video><div class="mf-ph" aria-hidden="true"><span></span></div><figcaption><span class="mf-name"></span><span class="mf-flags"></span></figcaption>';
          grid.appendChild(t);
          tiles[p.id] = t;
        }
        var v = t.querySelector('video');
        var attached = p.hasVideo && session.attachVideo(p.id, v);
        t.classList.toggle('has-video', !!attached);
        t.classList.toggle('is-speaking', !!p.speaking);
        t.classList.toggle('is-local', !!p.isLocal);
        t.querySelector('.mf-ph span').textContent = initials(p.name);
        t.querySelector('.mf-name').textContent = p.name + (p.isLocal ? ' (you)' : '') + (p.role === 'dm' ? ' · DM' : '');
        t.querySelector('.mf-flags').innerHTML = (p.micOn ? '' : '<span class="mf-flag" title="Microphone off">' + I.micOff + '<span class="cw-visually-hidden">Microphone off</span></span>') +
          (p.camOn ? '' : '<span class="mf-flag" title="Camera off">' + I.camOff + '<span class="cw-visually-hidden">Camera off</span></span>') +
          (p.quality === 'poor' || p.quality === 'lost' ? '<span class="mf-flag is-warn" title="' + esc(QUALITY[p.quality]) + '">!<span class="cw-visually-hidden">' + esc(QUALITY[p.quality]) + '</span></span>' : '');
      });
      Object.keys(tiles).forEach(function (id) { if (!seen[id]) { tiles[id].remove(); delete tiles[id]; } });
      grid.setAttribute('data-count', String(Math.min(st.participants.length, 9)));
      if (!st.participants.length) grid.innerHTML = st.status === 'joining' ? '<p class="mf-empty">Connecting to the call…</p>' : '';
    }

    function drawPeople(st) {
      var el = $('#mf-people');
      el.hidden = !showPeople;
      if (!showPeople) return;
      el.innerHTML = '<h3>In the call (' + st.participants.length + ')</h3><ul>' + st.participants.map(function (p) {
        return '<li><span class="mf-dot' + (p.speaking ? ' is-on' : '') + '"></span><span>' + esc(p.name) + (p.isLocal ? ' (you)' : '') + (p.role === 'dm' ? ' <em>DM</em>' : '') + '</span>' +
          '<span class="mf-li-flags">' + (p.micOn ? I.mic : I.micOff) + (p.camOn ? I.cam : I.camOff) + '</span></li>';
      }).join('') + '</ul>';
    }

    function drawDevices(st) {
      var el = $('#mf-devices');
      el.hidden = !showDevices;
      if (!showDevices) return;
      var sel = function (kind, label, list) {
        return '<label class="mf-field"><span>' + label + '</span><select data-mf-device="' + kind + '"' + (list.length ? '' : ' disabled') + '>' +
          (list.length ? list.map(function (d) { return '<option value="' + esc(d.deviceId) + '">' + esc(d.label) + '</option>'; }).join('') : '<option>None found</option>') + '</select></label>';
      };
      el.innerHTML = sel('audioinput', 'Microphone', st.devices.audioinput) + sel('videoinput', 'Camera', st.devices.videoinput) +
        '<p class="mf-fine">Device names appear after you allow the microphone or camera.</p>';
    }

    function drawControls(st) {
      var live = st.status === 'connected' || st.status === 'reconnecting';
      $('#mf-controls').innerHTML =
        '<button type="button" class="mf-btn' + (st.mic ? '' : ' is-off') + '" data-mf="mic" aria-pressed="' + st.mic + '"' + (live ? '' : ' disabled') + '>' + (st.mic ? I.mic : I.micOff) + '<span>' + (st.mic ? 'Mute' : 'Unmute') + '</span></button>' +
        '<button type="button" class="mf-btn' + (st.cam ? '' : ' is-off') + '" data-mf="cam" aria-pressed="' + st.cam + '"' + (live ? '' : ' disabled') + '>' + (st.cam ? I.cam : I.camOff) + '<span>' + (st.cam ? 'Stop video' : 'Start video') + '</span></button>' +
        '<button type="button" class="mf-btn" data-mf="devices" aria-expanded="' + showDevices + '"' + (live ? '' : ' disabled') + '>' + I.gear + '<span>Devices</span></button>' +
        '<button type="button" class="mf-btn" data-mf="people" aria-expanded="' + showPeople + '">' + I.people + '<span>People</span></button>' +
        (ctx.isDm ? '<label class="mf-switch"><input type="checkbox" data-mf="share-music"' + (st.audioShare ? ' checked' : '') + (live ? '' : ' disabled') + '> Share my music</label>'
          : '<label class="mf-switch"><input type="checkbox" data-mf="hear-music"' + (st.hearMusic ? ' checked' : '') + '> Hear the DM’s music</label>') +
        '<span class="mf-spacer"></span>' +
        (ctx.isDm && st.room ? '<button type="button" class="mf-btn is-danger-outline" data-mf="close-room"' + (live ? '' : ' disabled') + '><span>Close room</span></button>' : '') +
        (live || st.status === 'joining' ? '<button type="button" class="mf-btn is-danger" data-mf="leave">' + I.leave + '<span>Leave</span></button>'
          : '<button type="button" class="mf-btn" data-mf="minimize"><span>Close</span></button>');
    }

    function drawDock(st) {
      var dock = $('#mf-dock');
      var live = st.status === 'connected' || st.status === 'reconnecting' || st.status === 'joining';
      dock.hidden = !live || panelOpen;
      if (dock.hidden) return;
      dock.innerHTML = '<span class="mf-live' + (st.status === 'connected' ? ' is-on' : '') + '" aria-hidden="true"></span>' +
        '<button type="button" class="mf-dock-title" data-mf="open" title="Open the call">' + esc(st.room ? st.room.title : 'Meeting in the Fog') + '<small>' + esc(STATUS[st.status]) + ' · ' + st.participants.length + ' in the call</small></button>' +
        '<button type="button" class="mf-icon' + (st.mic ? '' : ' is-off') + '" data-mf="mic" aria-label="' + (st.mic ? 'Mute' : 'Unmute') + '">' + (st.mic ? I.mic : I.micOff) + '</button>' +
        '<button type="button" class="mf-icon' + (st.cam ? '' : ' is-off') + '" data-mf="cam" aria-label="' + (st.cam ? 'Stop video' : 'Start video') + '">' + (st.cam ? I.cam : I.camOff) + '</button>' +
        '<button type="button" class="mf-icon" data-mf="open" aria-label="Open the call">' + I.max + '</button>' +
        '<button type="button" class="mf-icon is-danger" data-mf="leave" aria-label="Leave the call">' + I.leave + '</button>';
    }

    function draw(st) {
      var panel = $('#mf-panel');
      panel.hidden = !panelOpen;
      document.documentElement.classList.toggle('mf-panel-open', panelOpen);
      if (panelOpen) {
        $('#mf-title').textContent = st.room ? st.room.title : 'Meeting in the Fog';
        var s = $('#mf-status');
        s.textContent = STATUS[st.status] || '';
        s.className = 'mf-status is-' + st.status;
        $('#mf-count').textContent = st.participants.length === 1 ? '1 person' : st.participants.length + ' people';
        var n = $('#mf-notice');
        var msg = st.error || st.notice;
        n.hidden = !msg;
        n.className = 'mf-notice' + (st.error ? ' is-error' : '');
        n.innerHTML = msg ? esc(msg) + (st.status === 'disconnected' && st.room ? ' <button type="button" class="mf-link" data-mf="rejoin">Reconnect</button>' : '') : '';
        drawTiles(st);
        drawPeople(st);
        drawDevices(st);
        drawControls(st);
        session.attachAudio($('#mf-audio'));
      } else if (st.status === 'connected' || st.status === 'reconnecting') {
        session.attachAudio($('#mf-audio')); // voices keep playing while minimised
      }
      drawDock(st);
    }

    async function onClick(e) {
      var b = e.target.closest('[data-mf]');
      if (!b || b.tagName === 'INPUT') return;
      var a = b.getAttribute('data-mf');
      var st = session.state();
      if (a === 'minimize') { panelOpen = false; if (st.status !== 'connected' && st.status !== 'reconnecting' && st.status !== 'joining') session.dismissNotice(); }
      else if (a === 'open') panelOpen = true;
      else if (a === 'mic') await session.toggleMic();
      else if (a === 'cam') await session.toggleCam();
      else if (a === 'people') showPeople = !showPeople;
      else if (a === 'devices') { showDevices = !showDevices; if (showDevices) session.refreshDevices(); }
      else if (a === 'leave') { panelOpen = false; await session.leave(); }
      else if (a === 'rejoin' && st.room) session.join(st.room.id);
      else if (a === 'close-room') {
        var ok = global.FogCampaignUI && global.FogCampaignUI.confirm ? await global.FogCampaignUI.confirm({ title: 'Close the room for everyone?', message: 'Everyone is disconnected. You can open a new room later.', confirmLabel: 'Close room', danger: true }) : global.confirm('Close the room for everyone?');
        if (!ok) return;
        var r = await global.FogCampaignData.closeRoom(st.room.id);
        if (!r.ok) { if (global.FogCampaignUI) global.FogCampaignUI.notice(r.message, 'error'); return; }
        panelOpen = false;
        await session.leave();
        ctx.emit('meeting-room', null);
      }
      draw(session.state());
    }
    function onChange(e) {
      var t = e.target;
      if (t.matches('[data-mf-device]')) session.setDevice(t.getAttribute('data-mf-device'), t.value);
      else if (t.matches('[data-mf="share-music"]')) session.setAudioShare(t.checked);
      else if (t.matches('[data-mf="hear-music"]')) session.setHearMusic(t.checked);
    }
    function onKey(e) { if (e.key === 'Escape' && panelOpen) { panelOpen = false; draw(session.state()); } }

    wrap.addEventListener('click', onClick);
    wrap.addEventListener('change', onChange);
    document.addEventListener('keydown', onKey);
    var unsub = session.subscribe(function (st) {
      if (st.status === 'joining') panelOpen = true;
      draw(st);
    });
    draw(session.state());

    return {
      open: function () { panelOpen = true; draw(session.state()); },
      minimize: function () { panelOpen = false; draw(session.state()); },
      destroy: function () { unsub(); document.removeEventListener('keydown', onKey); wrap.remove(); },
    };
  }

  global.FogMeetingUI = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
