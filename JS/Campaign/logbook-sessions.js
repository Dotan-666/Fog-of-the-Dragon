/**
 * Logbook → Sessions (#logbook/sessions): one record per game session, in order.
 *
 *   FogLogbookSessions.mount(host, ctx, { memories, meetings, canWrite, openEditor(preset|memory), reload }) → cleanup
 *
 * Everyone in the campaign sees: number, date, title, the linked meeting, the encounter results the players saw, and the
 * PUBLISHED player recap (a Logbook memory of kind "recap" linked to the session). The Dungeon Master also sees and edits the
 * session's private notes (campaign_session_notes: notes, events, locations, NPCs, encounters, decisions, rewards,
 * developments, mysteries, hooks, DM summary) — players never receive them (row-level security, not just hidden here).
 *
 * "Draft with Foggy+" (DM): Foggy writes a player recap, a DM summary, open threads and hooks from the DM's notes and the
 * encounter results. Nothing is saved until the DM reviews it: the recap goes in as a DRAFT memory (publish it like any other)
 * and the summary / threads / hooks go into the private notes.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  var B = function () { return global.FogBookRender; };
  function esc(s) { return UI().esc(s); }
  function para(t) { return String(t || '').split(/\n{2,}/).filter(Boolean).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function day(iso) { try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
  var NOTE_FIELDS = [['events', 'Key events'], ['locations', 'Locations visited'], ['npcs', 'NPCs met'], ['encounters', 'Monsters and encounters'], ['decisions', 'Player decisions'],
    ['rewards', 'Rewards and loot'], ['developments', 'Story developments'], ['mysteries', 'Unresolved mysteries'], ['hooks', 'Hooks for next time'], ['dmSummary', 'DM summary']];

  function mount(host, ctx, o) {
    var alive = true;
    var isDm = ctx.isDm;
    var sessions = [], notSetUp = false, error = '';
    var notes = {};       // sessionId → { notes, details } (DM; loaded when opened)
    var openId = null;
    var f = { q: '', status: '', recap: '', order: 'newest' };
    try { var sv = global.FogNav && global.FogNav.state('ls'); if (sv) f = Object.assign(f, sv); } catch (e) { /* preference */ }

    function recapsOf(s) { return o.memories.filter(function (m) { return m.kind === 'recap' && m.sessionId === s.id; }); }
    function meetingOf(s) { return s.meetingId ? o.meetings.find(function (m) { return m.id === s.meetingId; }) : null; }
    function hay(s) {
      var r = recapsOf(s).map(function (m) { return m.title + ' ' + m.content + ' ' + JSON.stringify(m.recap || {}); }).join(' ');
      var n = isDm && notes[s.id] ? notes[s.id].notes + ' ' + JSON.stringify(notes[s.id].details) : '';
      return (s.title + ' ' + r + ' ' + n + ' ' + s.results.map(function (x) { return x.title + ' ' + (x.defeated || []).join(' '); }).join(' ')).toLowerCase();
    }

    function sessionHtml(s) {
      var recaps = recapsOf(s);
      var pub = recaps.filter(function (m) { return m.status === 'published' && m.visibility === 'players'; });
      var mt = meetingOf(s);
      var open = openId === s.id;
      var head = '<header class="ls-head"><h3>Session ' + s.number + (s.title && s.title !== 'Session ' + s.number ? ': ' + esc(s.title) : '') + '</h3>' +
        '<span class="cw-muted">' + esc(day(s.startedAt)) + (s.endedAt ? '' : ' · <strong>in progress</strong>') + (mt ? ' · meeting "' + esc(mt.title) + '"' : '') + '</span>' +
        (pub.length ? '<span class="cw-pill cw-pill-done">Recap published</span>' : isDm ? '<span class="cw-pill cw-pill-warn">' + (recaps.length ? 'Recap in draft' : 'No recap yet') + '</span>' : '') + '</header>';
      var results = s.results.length ? '<h4 class="cv-subheading">Encounters</h4><ul class="ls-results">' + s.results.map(function (r) {
        return '<li><strong>' + esc(r.title) + '</strong> — ' + r.rounds + ' round' + (r.rounds === 1 ? '' : 's') + (r.defeated && r.defeated.length ? '; defeated: ' + esc(r.defeated.join(', ')) : '') + (r.survivors && r.survivors.length ? '; still standing: ' + esc(r.survivors.join(', ')) : '') + '</li>';
      }).join('') + '</ul>' : '';
      var recapHtml = (isDm ? recaps : pub).map(function (m) {
        return '<div class="ls-recap"><h4 class="cv-subheading">' + esc(m.title) + (isDm && m.status !== 'published' ? ' <span class="cw-muted">(draft)</span>' : '') + (isDm && m.visibility === 'dm' ? ' <span class="cw-muted">(DM only)</span>' : '') + '</h4>' +
          (m.content ? '<div class="cw-prose' + (global.FogLogbookEditor && global.FogLogbookEditor.isHtml(m.content) ? ' cw-rich-content' : '') + '">' + (global.FogLogbookEditor ? global.FogLogbookEditor.renderContent(m.content) : para(m.content)) + '</div>' : '') +
          (m.recap ? B().RECAP_SECTIONS.map(function (x) { return m.recap[x[0]] ? '<h5>' + x[1] + '</h5><div class="cw-prose">' + para(m.recap[x[0]]) + '</div>' : ''; }).join('') : '') +
          (isDm ? '<button type="button" class="cv-link-btn" data-ls="edit-recap" data-id="' + esc(m.id) + '">Edit</button>' : '') + '</div>';
      }).join('');
      var dm = '';
      if (isDm) {
        var n = notes[s.id];
        dm = '<details class="ls-dm" data-ls-dm="' + esc(s.id) + '"' + (open ? ' open' : '') + '><summary>🔒 DM notes <span class="cw-muted">(never shown to players)</span></summary>' +
          (!n ? '<p class="cw-loading">Loading…</p>' : '<form data-ls-form="' + esc(s.id) + '"><label class="cw-field"><span>Title</span><input class="form-control" name="title" maxlength="120" value="' + esc(s.title) + '"></label>' +
            '<label class="cw-field"><span>Notes</span><textarea class="form-control" name="notes" rows="4" maxlength="20000">' + esc(n.notes) + '</textarea></label>' +
            NOTE_FIELDS.map(function (x) { var v = n.details[x[0]]; return '<label class="cw-field"><span>' + x[1] + '</span><textarea class="form-control" name="d_' + x[0] + '" rows="2" maxlength="6000">' + esc(Array.isArray(v) ? v.join('\n') : v || '') + '</textarea></label>'; }).join('') +
            (n.details.combat ? '<details><summary>Combat logs (' + Object.keys(n.details.combat).length + ')</summary>' + Object.keys(n.details.combat).map(function (k) { var c = n.details.combat[k]; return '<h5>' + esc(c.title) + '</h5>' + (c.hidden && c.hidden.length ? '<p class="cw-muted">Hidden from players: ' + esc(c.hidden.join(', ')) + '</p>' : '') + '<ol class="cw-fine">' + (c.log || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ol>'; }).join('') + '</details>' : '') +
            '<div class="cw-actions"><button type="submit" class="btn btn-secondary btn-sm"' + (o.canWrite() ? '' : ' disabled') + '>Save notes</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-ls="recap" data-id="' + esc(s.id) + '"' + (o.canWrite() ? '' : ' disabled') + '>Write the player recap</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-ls="foggy" data-id="' + esc(s.id) + '"' + (o.canWrite() ? '' : ' disabled') + '>Draft with Foggy+</button>' +
            (s.status === 'active' ? '<button type="button" class="cv-link-btn" data-ls="end" data-id="' + esc(s.id) + '">End this session</button>' : '') + '</div></form>') + '</details>';
      }
      var body = recapHtml || (s.results.length ? '' : '<p class="cw-muted">' + (isDm ? 'Nothing recorded yet.' : 'No recap published yet.') + '</p>');
      return '<article class="cw-card ls-session' + (s.status === 'active' ? ' is-active' : '') + '" id="ls-' + esc(s.id) + '">' + head + results + body + dm + '</article>';
    }

    function draw() {
      if (!alive) return;
      if (notSetUp) { host.innerHTML = '<div class="cw-card cw-empty"><p>Sessions need the latest database update (migration 20261120120000_session_experience.sql).</p></div>'; return; }
      if (error) { host.innerHTML = '<div class="cw-card cw-empty"><p>' + esc(error) + '</p></div>'; return; }
      var q = f.q.trim().toLowerCase();
      var list = sessions.filter(function (s) {
        if (f.status && s.status !== f.status) return false;
        if (f.recap === 'yes' && !recapsOf(s).some(function (m) { return m.status === 'published'; })) return false;
        if (f.recap === 'no' && recapsOf(s).some(function (m) { return m.status === 'published'; })) return false;
        return !q || q.split(/\s+/).every(function (w) { return hay(s).indexOf(w) >= 0; });
      }).sort(function (a, b) { return f.order === 'oldest' ? a.number - b.number : b.number - a.number; });
      var tools = '<div class="ls-tools"><input class="form-control" type="search" data-ls-f="q" value="' + esc(f.q) + '" placeholder="Search sessions, recaps' + (isDm ? ', notes' : '') + '…" aria-label="Search sessions">' +
        '<select class="form-control" data-ls-f="status" aria-label="Status"><option value="">All sessions</option><option value="active"' + (f.status === 'active' ? ' selected' : '') + '>In progress</option><option value="ended"' + (f.status === 'ended' ? ' selected' : '') + '>Finished</option></select>' +
        '<select class="form-control" data-ls-f="recap" aria-label="Recap"><option value="">Any recap</option><option value="yes"' + (f.recap === 'yes' ? ' selected' : '') + '>With a published recap</option><option value="no"' + (f.recap === 'no' ? ' selected' : '') + '>Without a recap</option></select>' +
        '<select class="form-control" data-ls-f="order" aria-label="Order"><option value="newest">Newest first</option><option value="oldest"' + (f.order === 'oldest' ? ' selected' : '') + '>Oldest first</option></select></div>';
      host.innerHTML = tools + (sessions.length ? (list.length ? '<div class="cw-stack">' + list.map(sessionHtml).join('') + '</div>' : '<p class="cw-muted">No session matches.</p>')
        : '<div class="cw-card cw-empty"><p>' + (isDm ? 'No sessions yet. Start one from the Overview ("Start session"); it appears here with its encounters, your notes and the recap.' : 'No sessions recorded yet.') + '</p></div>');
    }

    async function loadNotes(id) {
      if (!isDm || notes[id]) return;
      var r = await D().getSessionNotes(id);
      if (!alive) return;
      notes[id] = r.ok ? r.notes : { notes: '', details: {}, error: r.message };
      draw();
    }
    async function load() {
      var r = await D().listSessions(ctx.id);
      if (!alive) return;
      notSetUp = !!(r.ok && r.notSetUp);
      error = r.ok ? '' : r.message;
      sessions = r.ok ? r.sessions : [];
      if (isDm && openId) loadNotes(openId);
      draw();
    }
    function saveFilter() { if (global.FogNav) global.FogNav.state('ls', f); }

    function collectNotes(form) {
      var details = Object.assign({}, (notes[form.getAttribute('data-ls-form')] || {}).details || {});
      NOTE_FIELDS.forEach(function (x) { var v = form['d_' + x[0]].value.trim(); if (v) details[x[0]] = v; else delete details[x[0]]; });
      return { notes: form.notes.value, details: details, title: form.title.value.trim() };
    }

    async function foggyDraft(s) {
      var form = host.querySelector('[data-ls-form="' + s.id + '"]');
      var cur = form ? collectNotes(form) : notes[s.id] || { notes: '', details: {} };
      var d = UI().dialog('<div class="cw-dialog-body"><h2 class="cw-dialog-title">Foggy\'s drafts for session ' + s.number + '</h2><p class="cw-loading" role="status">Foggy is reading your notes…</p></div>', { label: 'Foggy drafts' });
      var r = await global.FogFoggy.sessionRecap({ campaignId: ctx.id, session: { title: s.title, number: s.number, notes: cur.notes, details: cur.details, results: s.results } });
      if (!alive) { d.close(); return; }
      var box = d.el.querySelector('.cw-dialog-body');
      if (!r.ok) { box.innerHTML = '<h2 class="cw-dialog-title">Foggy couldn\'t draft this</h2><p>' + esc(r.message) + '</p><div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Close</button></div>'; return; }
      var res = r.result;
      box.innerHTML = '<h2 class="cw-dialog-title">Review Foggy\'s drafts</h2><p class="cw-muted">Edit anything. The player recap is saved as a <strong>draft</strong> (publish it when you\'re happy); the rest goes into your private notes. Nothing is saved if you cancel.</p>' +
        '<form class="cw-editor"><fieldset class="cw-fieldset"><legend>Player recap (players will see this once published)</legend>' + B().RECAP_SECTIONS.map(function (x) { return '<label class="cw-field"><span>' + x[1] + '</span><textarea class="form-control" name="r_' + x[0] + '" rows="3">' + esc(res.playerRecap[x[0]] || '') + '</textarea></label>'; }).join('') + '</fieldset>' +
        '<fieldset class="cw-fieldset"><legend>🔒 For you only</legend><label class="cw-field"><span>DM summary</span><textarea class="form-control" name="dmSummary" rows="3">' + esc(res.dmSummary || '') + '</textarea></label>' +
        '<label class="cw-field"><span>Unresolved threads</span><textarea class="form-control" name="threads" rows="3">' + esc((res.threads || []).join('\n')) + '</textarea></label>' +
        '<label class="cw-field"><span>Hooks for next time</span><textarea class="form-control" name="hooks" rows="3">' + esc((res.hooks || []).join('\n')) + '</textarea></label></fieldset>' +
        '<p class="cw-form-error" role="alert" hidden></p><div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Cancel</button><button type="submit" class="btn btn-primary btn-sm">Save recap draft and notes</button></div></form>';
      var fm = box.querySelector('form');
      fm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var rc = {};
        B().RECAP_SECTIONS.forEach(function (x) { var v = fm['r_' + x[0]].value.trim(); if (v) rc[x[0]] = v; });
        var errEl = fm.querySelector('.cw-form-error');
        var m = await D().saveMemory(ctx.id, { kind: 'recap', title: 'Recap: Session ' + s.number + (s.title && s.title !== 'Session ' + s.number ? ' — ' + s.title : ''), content: '', occurredOn: (s.startedAt || '').slice(0, 10) || null, meetingId: s.meetingId || null, subject: '', imagePath: null, recap: rc, visibility: 'players', status: 'draft', sessionId: s.id });
        if (!m.ok) { errEl.textContent = m.message; errEl.hidden = false; return; }
        var det = Object.assign({}, cur.details);
        if (fm.dmSummary.value.trim()) det.dmSummary = fm.dmSummary.value.trim();
        if (fm.threads.value.trim()) det.mysteries = [det.mysteries, fm.threads.value.trim()].filter(Boolean).join('\n');
        if (fm.hooks.value.trim()) det.hooks = [det.hooks, fm.hooks.value.trim()].filter(Boolean).join('\n');
        var sv = await D().saveSessionNotes(ctx.id, s.id, cur.notes, det);
        if (!sv.ok) { errEl.textContent = 'The recap draft was saved, but the notes weren\'t: ' + sv.message; errEl.hidden = false; return; }
        notes[s.id] = { notes: cur.notes, details: det };
        d.close();
        UI().notice('Recap saved as a draft. Publish it from this session when you\'re ready.');
        o.reload();
      });
    }

    host.addEventListener('toggle', function (e) {
      var dm = e.target.closest && e.target.closest('[data-ls-dm]');
      if (!dm || e.target !== dm) return;
      if (dm.open) { openId = dm.getAttribute('data-ls-dm'); loadNotes(openId); } else if (openId === dm.getAttribute('data-ls-dm')) openId = null;
    }, true);
    host.addEventListener('input', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-ls-f');
      if (k === 'q') { f.q = e.target.value; saveFilter(); var pos = e.target.selectionStart; draw(); var el = host.querySelector('[data-ls-f="q"]'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }
    });
    host.addEventListener('change', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-ls-f');
      if (k && k !== 'q') { f[k] = e.target.value; saveFilter(); draw(); }
    });
    host.addEventListener('submit', async function (e) {
      var form = e.target.closest('[data-ls-form]');
      if (!form) return;
      e.preventDefault();
      var id = form.getAttribute('data-ls-form');
      var s = sessions.find(function (x) { return x.id === id; });
      var v = collectNotes(form);
      var r = await D().saveSessionNotes(ctx.id, id, v.notes, v.details);
      if (r.ok && s && v.title && v.title !== s.title) { var u = await D().updateSession(id, { title: v.title }); if (!u.ok) r = u; }
      if (!alive) return;
      if (!r.ok) { UI().notice(r.message, 'error'); return; }
      notes[id] = { notes: v.notes, details: v.details };
      UI().notice('Session notes saved (only you can see them).');
      load();
    });
    host.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-ls]');
      if (!b) return;
      var a = b.getAttribute('data-ls');
      var s = sessions.find(function (x) { return x.id === b.getAttribute('data-id'); });
      if (a === 'edit-recap') { var m = o.memories.find(function (x) { return x.id === b.getAttribute('data-id'); }); if (m) o.openEditor(m); }
      else if (a === 'recap' && s) o.openEditor(null, { kind: 'recap', title: 'Recap: Session ' + s.number, meetingId: s.meetingId || '', occurredOn: (s.startedAt || '').slice(0, 10), visibility: 'players', sessionId: s.id });
      else if (a === 'foggy' && s) foggyDraft(s);
      else if (a === 'end' && s) {
        if (!(await UI().confirm({ title: 'End session ' + s.number + '?', message: 'It is marked as finished. Notes and the recap can still be written.', confirmLabel: 'End session' }))) return;
        var r = await D().endSession(s.id);
        if (!r.ok) UI().notice(r.message, 'error'); else load();
      }
    });

    draw();
    load();
    var off = ctx.on('session', load);
    return { cleanup: function () { alive = false; off(); }, refresh: function (memories, meetings) { o.memories = memories; o.meetings = meetings; draw(); } };
  }

  global.FogLogbookSessions = { mount: mount, NOTE_FIELDS: NOTE_FIELDS };
})(window);
