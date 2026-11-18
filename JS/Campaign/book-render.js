/**
 * Campaign book: turns the data returned by the database function campaign_book() into the pages of a printed-style
 * chronicle (title page, the party, timeline, one chapter per played meeting, then the campaign's memorable people,
 * places, quotes and decisions). It only formats what it is given: the database already limits that to published,
 * player-visible memories, completed meetings and public history, so DM-only notes can't appear here.
 * All text is escaped. The digital book is this HTML (read on screen or printed to PDF with the browser's Print).
 */
(function (global) {
  'use strict';

  var KIND_LABEL = {
    recap: 'Recap', event: 'Event', character: 'Character moment', npc: 'Important NPC', quote: 'Quote', location: 'Location', discovery: 'Discovery',
    decision: 'Decision', battle: 'Battle', milestone: 'Milestone', map: 'Map', image: 'Image', note: 'Note',
  };
  var RECAP_SECTIONS = [
    ['happened', 'What happened'], ['decisions', 'Important decisions'], ['changes', 'What changed in the campaign'],
    ['moments', 'Character moments'], ['discoveries', 'New discoveries'], ['threads', 'Unresolved threads'],
  ];
  // Memories that aren't tied to a meeting are grouped like this at the back of the book.
  var GROUPS = [
    ['npc', 'Important people'], ['location', 'Places'], ['map', 'Maps'], ['discovery', 'Discoveries'], ['decision', 'Decisions'], ['battle', 'Battles'],
    ['character', 'Character moments'], ['quote', 'Memorable words'], ['milestone', 'Milestones'], ['event', 'Events'], ['image', 'Images'], ['note', 'Notes'],
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function para(t) { return String(t || '').split(/\n{2,}/).filter(Boolean).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function date(d) {
    if (!d) return '';
    var x = new Date(String(d).length <= 10 ? d + 'T12:00:00' : d);
    return isNaN(x) ? '' : x.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }
  function roman(n) { var r = ''; [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } }); return r; }

  function richContent(text) {
    if (!text) return '';
    var LE = window.FogLogbookEditor;
    if (LE && LE.isHtml(text)) return '<div class="cw-rich-content">' + LE.sanitize(text) + '</div>';
    return para(text);
  }

  function memoryHtml(m, urls) {
    var img = m.image_path && urls[m.image_path] ? '<figure class="bk-figure"><img src="' + esc(urls[m.image_path]) + '" alt="' + esc(m.title) + '">' + (m.kind === 'map' || m.kind === 'image' ? '<figcaption>' + esc(m.title) + '</figcaption>' : '') + '</figure>' : '';
    if (m.kind === 'quote') return '<blockquote class="bk-quote">' + richContent(m.content) + (m.subject ? '<cite>' + esc(m.subject) + '</cite>' : '') + '</blockquote>' + img;
    var recap = m.recap ? RECAP_SECTIONS.map(function (s) { return m.recap[s[0]] ? '<h5>' + s[1] + '</h5>' + para(m.recap[s[0]]) : ''; }).join('') : '';
    return '<section class="bk-memory"><h4>' + esc(m.title) + '</h4><p class="bk-meta">' + esc(KIND_LABEL[m.kind] || 'Memory') + (m.subject ? ' · ' + esc(m.subject) : '') + (m.occurred_on ? ' · ' + esc(date(m.occurred_on)) : '') + '</p>' + img + richContent(m.content) + recap + '</section>';
  }

  function timeline(book) {
    var items = [];
    (book.history || []).forEach(function (h) { items.push({ at: h.at, text: h.summary }); });
    (book.meetings || []).forEach(function (m) { items.push({ at: m.starts_at, text: 'Session: ' + m.title }); });
    (book.memories || []).forEach(function (m) { if (m.occurred_on && ['milestone', 'battle', 'decision', 'discovery', 'event'].indexOf(m.kind) >= 0) items.push({ at: m.occurred_on, text: m.title }); });
    items.sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
    return items.length ? '<ol class="bk-timeline">' + items.map(function (i) { return '<li><time>' + esc(date(i.at)) + '</time><span>' + esc(i.text) + '</span></li>'; }).join('') + '</ol>' : '<p class="bk-muted">The timeline fills in as the campaign is played.</p>';
  }

  /** @param book the object returned by campaign_book(); @param urls map of image path → signed URL */
  function render(book, urls) {
    urls = urls || {};
    var c = book.campaign || {};
    var memories = book.memories || [];
    var byMeeting = {};
    memories.forEach(function (m) { if (m.meeting_id) (byMeeting[m.meeting_id] = byMeeting[m.meeting_id] || []).push(m); });
    var chapters = (book.meetings || []).map(function (t, i) {
      var tied = byMeeting[t.id] || [];
      var recaps = tied.filter(function (m) { return m.kind === 'recap'; });
      var rest = tied.filter(function (m) { return m.kind !== 'recap'; });
      return '<section class="bk-chapter"><p class="bk-chapter-no">Chapter ' + roman(i + 1) + '</p><h3>' + esc(t.title) + '</h3><p class="bk-meta">' + esc(date(t.starts_at)) + '</p>' +
        (recaps.length ? recaps.map(function (m) { return memoryHtml(m, urls); }).join('') : (t.summary ? para(t.summary) : '<p class="bk-muted">No recap was written for this session.</p>')) +
        (recaps.length && t.summary && !recaps.some(function (m) { return m.recap || m.content; }) ? para(t.summary) : '') +
        rest.map(function (m) { return memoryHtml(m, urls); }).join('') + '</section>';
    }).join('');
    var loose = memories.filter(function (m) { return !m.meeting_id || !(book.meetings || []).some(function (t) { return t.id === m.meeting_id; }); });
    var back = GROUPS.map(function (g) {
      var items = loose.filter(function (m) { return m.kind === g[0]; });
      return items.length ? '<section class="bk-group"><h3>' + g[1] + '</h3>' + items.map(function (m) { return memoryHtml(m, urls); }).join('') + '</section>' : '';
    }).join('');
    var recapsLoose = loose.filter(function (m) { return m.kind === 'recap'; });
    return '<article class="cw-book" aria-label="Campaign book">' +
      '<section class="bk-title-page">' + (c.cover_url ? '<img class="bk-cover" src="' + esc(c.cover_url) + '" alt="">' : '<div class="bk-ornament" aria-hidden="true">✦</div>') +
      '<h1>' + esc(c.name) + '</h1><p class="bk-sub">A chronicle of the campaign</p>' + (book.dm ? '<p class="bk-by">Told at the table of ' + esc(book.dm) + ', Dungeon Master</p>' : '') +
      (c.description ? '<div class="bk-desc">' + para(c.description) + '</div>' : '') + '</section>' +
      '<section class="bk-page"><h2>The Party</h2>' + ((book.party || []).length ? '<ul class="bk-party">' + book.party.map(function (p) { return '<li><strong>' + esc(p.character || 'Unnamed character') + '</strong><span>played by ' + esc(p.player) + '</span></li>'; }).join('') + '</ul>' : '<p class="bk-muted">No party yet.</p>') + '</section>' +
      '<section class="bk-page"><h2>Timeline</h2>' + timeline(book) + '</section>' +
      '<section class="bk-page"><h2>The Story So Far</h2>' + (chapters || '<p class="bk-muted">Chapters appear as sessions are completed.</p>') + recapsLoose.map(function (m) { return memoryHtml(m, urls); }).join('') + '</section>' +
      (back ? '<section class="bk-page"><h2>Remembered</h2>' + back + '</section>' : '') +
      '<footer class="bk-foot">Made with Fog of the Dragon · D&amp;D 5e 2024 rules content (CC BY 4.0)</footer></article>';
  }

  global.FogBookRender = { render: render, RECAP_SECTIONS: RECAP_SECTIONS, KIND_LABEL: KIND_LABEL, esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
