/**
 * Campaign Timeline — visual timeline of campaign events auto-populated from the logbook.
 *
 * Shows sessions, key battles, NPC meetings, quest milestones, and other events along a
 * vertical timeline. Each entry can include the monster artwork for encounters. Zoomable
 * between session-level and event-level views.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  function esc(s) { return UI().esc(s); }

  var KIND_ICONS = {
    battle: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/>',
    quote: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    event: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    npc: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    session: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>',
    map: '<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/>',
    milestone: '<path d="M12 2l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z"/>',
  };

  var KIND_COLORS = {
    battle: 'var(--lp-ember-text, #e85a6a)',
    quote: 'var(--lp-ash, #a89688)',
    note: 'var(--lp-bone, #eee7dd)',
    event: 'var(--lp-brass, #d4a853)',
    npc: 'var(--lp-arcane, #4fc2b0)',
    session: 'var(--lp-mist, #a68ae0)',
    map: 'var(--lp-brass, #d4a853)',
    milestone: 'var(--lp-brass, #d4a853)',
  };

  function kindIcon(kind) {
    var paths = KIND_ICONS[kind] || KIND_ICONS.event;
    var color = KIND_COLORS[kind] || KIND_COLORS.event;
    return '<svg class="tl-icon" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }

  function formatDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; }
  }

  function render(host, ctx) {
    var alive = true;
    var memories = [], sessions = [];
    var view = 'all'; // 'all', 'sessions', 'battles', 'npcs'
    var expanded = {};

    host.innerHTML = '<div class="cw-page cw-campaign-tl"><header class="cw-page-head"><div><h2 class="cw-page-title">Campaign Timeline</h2>' +
      '<p class="cw-page-sub">A living chronicle of your campaign\'s story, auto-populated from the logbook.</p></div></header>' +
      '<div id="tl-body"><div class="cw-state"><span class="mk-spin"></span> Building timeline…</div></div></div>';

    var body = host.querySelector('#tl-body');

    Promise.all([
      D().listMemories(ctx.id).catch(function () { return { ok: false }; }),
      D().listSessions ? D().listSessions(ctx.id).catch(function () { return { ok: false }; }) : Promise.resolve({ ok: true, sessions: [] }),
    ]).then(function (results) {
      if (!alive) return;
      memories = ((results[0] && results[0].memories) || []).sort(function (a, b) {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });
      sessions = ((results[1] && results[1].sessions) || []).sort(function (a, b) {
        return new Date(a.scheduledFor || a.created_at || 0) - new Date(b.scheduledFor || b.created_at || 0);
      });
      draw();
    }).catch(function () {
      if (!alive) return;
      draw();
    });

    function getEvents() {
      var events = [];

      // Add sessions as timeline events
      sessions.forEach(function (s, i) {
        events.push({
          kind: 'session',
          title: s.title || ('Session ' + (i + 1)),
          text: s.summary || s.notes || '',
          date: s.scheduled_for || s.created_at,
          sessionIndex: i + 1,
          isSession: true,
        });
      });

      // Add logbook memories
      memories.forEach(function (m) {
        var kind = m.kind || 'note';
        events.push({
          kind: kind,
          title: m.title || (kind.charAt(0).toUpperCase() + kind.slice(1)),
          text: m.text || m.content || '',
          date: m.created_at,
          imageUrl: m.imageUrl || '',
          speaker: m.speaker || '',
        });
      });

      // Sort chronologically
      events.sort(function (a, b) {
        return new Date(a.date || 0) - new Date(b.date || 0);
      });

      // Filter by view
      if (view === 'sessions') events = events.filter(function (e) { return e.isSession; });
      if (view === 'battles') events = events.filter(function (e) { return e.kind === 'battle'; });
      if (view === 'npcs') events = events.filter(function (e) { return e.kind === 'npc' || e.kind === 'quote'; });

      return events;
    }

    function draw() {
      var events = getEvents();

      // Stats
      var battles = memories.filter(function (m) { return m.kind === 'battle'; }).length;
      var quotes = memories.filter(function (m) { return m.kind === 'quote'; }).length;

      body.innerHTML =
        '<div class="tl-stats cw-card">' +
        '<div class="prep-stat"><strong>' + sessions.length + '</strong><span>Sessions</span></div>' +
        '<div class="prep-stat"><strong>' + memories.length + '</strong><span>Events</span></div>' +
        '<div class="prep-stat"><strong>' + battles + '</strong><span>Battles</span></div>' +
        '<div class="prep-stat"><strong>' + quotes + '</strong><span>Quotes</span></div>' +
        '</div>' +

        '<div class="tl-filters">' +
        '<button class="btn btn-sm ' + (view === 'all' ? 'btn-primary' : 'btn-secondary') + '" data-tl-view="all">All events</button>' +
        '<button class="btn btn-sm ' + (view === 'sessions' ? 'btn-primary' : 'btn-secondary') + '" data-tl-view="sessions">Sessions</button>' +
        '<button class="btn btn-sm ' + (view === 'battles' ? 'btn-primary' : 'btn-secondary') + '" data-tl-view="battles">Battles</button>' +
        '<button class="btn btn-sm ' + (view === 'npcs' ? 'btn-primary' : 'btn-secondary') + '" data-tl-view="npcs">NPCs & Quotes</button>' +
        '</div>' +

        (events.length === 0
          ? '<div class="cw-card"><p class="cw-muted">No timeline events yet. Events appear here as you add logbook entries, run sessions, and play through encounters.</p></div>'
          : '<div class="tl-track">' + events.map(function (e, i) {
              var isExpanded = expanded[i];
              var text = e.text || '';
              var shortText = text.length > 160 ? text.substring(0, 160) + '…' : text;
              return '<div class="tl-event tl-kind-' + esc(e.kind) + (e.isSession ? ' tl-session' : '') + '">' +
                '<div class="tl-dot">' + kindIcon(e.kind) + '</div>' +
                '<div class="tl-content">' +
                '<time class="tl-date">' + formatDate(e.date) + '</time>' +
                '<h4 class="tl-title">' + esc(e.title) +
                (e.speaker ? ' <span class="tl-speaker">— ' + esc(e.speaker) + '</span>' : '') + '</h4>' +
                (e.imageUrl ? '<img class="tl-img" src="' + esc(e.imageUrl) + '" alt="" loading="lazy">' : '') +
                (text ? '<p class="tl-text">' + esc(isExpanded ? text : shortText) + '</p>' : '') +
                (text.length > 160 ? '<button class="tl-expand" data-tl-expand="' + i + '">' + (isExpanded ? 'Show less' : 'Read more') + '</button>' : '') +
                '</div></div>';
            }).join('') + '</div>');

      // Event delegation
      body.addEventListener('click', function handler(e) {
        var viewBtn = e.target.closest('[data-tl-view]');
        if (viewBtn) {
          view = viewBtn.dataset.tlView;
          draw();
          return;
        }
        var expandBtn = e.target.closest('[data-tl-expand]');
        if (expandBtn) {
          var idx = parseInt(expandBtn.dataset.tlExpand);
          expanded[idx] = !expanded[idx];
          draw();
        }
      }, { once: true });
    }

    return function () { alive = false; };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.timeline = { render: render };
})(window);
