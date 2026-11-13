/**
 * Campaign Content: the written adventure this campaign runs, and what the players have been shown.
 *
 * An adventure is written content owned by the DM (Dashboard → Adventures); a campaign is the game. This page only
 * REFERENCES the DM's adventure (campaigns.adventure_id), reads it live, and records campaign-specific progress
 * (campaign_progress: current section, finished sections). Nothing of the adventure is copied into the campaign except
 * what the DM explicitly shares: “Share with players” stores the section's player-facing text in campaign_reveals.
 * Players cannot read the adventure itself (database policy) and never receive DM notes.
 *
 * Reading Mode is the default and is the Dashboard's own adventure reader (the parchment book from Adventures → Read: same
 * code, same look, DM view / Player view, text size, full screen, print), mounted here. It is a way of presenting content, not
 * a permission: players get the same reader built only from what the DM shared (no DM notes exist in it). The DM can switch to
 * Editing Mode for the running tools (progress, sharing, the editor); that switch changes nothing about who may do what, which
 * the database decides.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  var AM = function () { return global.FogAdventureModel; };

  function esc(s) { return UI().esc(s); }
  function paragraphs(t) { return String(t || '').split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function kindLabel(k) { var K = AM() && AM().KINDS[k]; return K ? K.label : 'Scene'; }
  function kindIcon(k) { var K = AM() && AM().KINDS[k]; return K ? K.icon : '✦'; }

  // ---------------------------------------------------------------------------------------------------------------
  // The Dashboard's reader, mounted in the page
  // ---------------------------------------------------------------------------------------------------------------
  var fragment = null;
  async function mountReader(el, params, ctx) {
    if (!fragment) {
      var res = await fetch('Dashboard/adventure-reader.html');
      if (!res.ok) throw new Error('The reader could not be loaded.');
      fragment = await res.text();
    }
    el.innerHTML = fragment;
    // The reader links back to the adventure editor, which lives in the Dashboard.
    global.FogDashboardRouter = global.FogDashboardRouter || { navigateTo: function (h) { global.location.href = ctx.dashboardUrl(h); } };
    return global.FogPageInits.adventureReader(el, params);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Players: what the DM has shared
  // ---------------------------------------------------------------------------------------------------------------
  /** A book made only of what the DM shared: chapters by the chapter each scene came from, the player-facing text only. */
  function sharedBook(ctx, reveals) {
    var chapters = [];
    reveals.slice().reverse().forEach(function (r, i) {
      var key = r.chapterTitle || 'Shared with the party';
      var ch = chapters.find(function (c) { return c.title === key; });
      if (!ch) { ch = { id: 'sh' + chapters.length, title: key, summary: '', dmNotes: '', images: [], sections: [] }; chapters.push(ch); }
      ch.sections.push({ id: 'r' + i, kind: r.kind, title: r.title, playerText: r.body, dmNotes: '', fields: {}, images: [] });
    });
    return AM().normalize({ id: 'shared-' + ctx.id, title: ctx.campaign.name, description: 'Scenes, places and clues your Dungeon Master has shared with the party.', theme: 'Shared with the party', content: { schema: 1, chapters: chapters } });
  }

  async function renderPlayer(host, ctx) {
    var alive = true;
    var readerCleanup = null;
    host.innerHTML = '<div class="cw-page cw-content"><header class="cw-page-head"><div><h2 class="cw-page-title">Adventures</h2>' +
      '<p class="cw-page-sub">Scenes, places and clues your Dungeon Master has shared with the party, in Reading mode.</p></div></header><div id="ct-body"></div></div>';
    var body = host.querySelector('#ct-body');
    async function load() {
      var res = await D().listReveals(ctx.id);
      if (!alive) return;
      if (readerCleanup) { readerCleanup(); readerCleanup = null; }
      if (!res.ok) { body.innerHTML = '<div class="cw-empty"><p>' + esc(res.message) + '</p></div>'; return; }
      if (!res.reveals.length) { body.innerHTML = '<div class="cw-card cw-empty cw-empty-lg"><h3>Nothing shared yet</h3><p>When your Dungeon Master reveals a scene, place or handout, it appears here.</p></div>'; return; }
      try {
        readerCleanup = await mountReader(body, { id: 'shared-' + ctx.id, adventure: sharedBook(ctx, res.reveals), playersOnly: true }, ctx);
      } catch (e) { body.innerHTML = '<div class="cw-empty"><p>' + esc(e.message) + '</p></div>'; }
    }
    await load();
    var off = ctx.on('reveal', load);
    return function () { alive = false; off(); if (readerCleanup) readerCleanup(); };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // DM: the adventure with progress and sharing
  // ---------------------------------------------------------------------------------------------------------------
  async function renderDm(host, ctx, params) {
    var alive = true;
    var c = ctx.campaign;
    var archived = c.status === 'archived';
    host.innerHTML = '<div class="cw-page cw-content"><header class="cw-page-head"><div><h2 class="cw-page-title">Adventures</h2>' +
      '<p class="cw-page-sub">The adventure this campaign runs. Only you can see it; share parts with the players when the story gets there.</p></div><div class="cw-head-actions" id="ct-head"></div></header><div id="ct-body"></div></div>';
    var body = host.querySelector('#ct-body');

    if (!c.adventureId) {
      body.innerHTML = '<div class="cw-card cw-empty cw-empty-lg"><h3>No adventure chosen</h3><p>Every campaign runs one of your adventures. Choose one in Campaign Settings, or write one in Adventures.</p>' +
        '<a class="btn btn-primary" href="#settings">Choose an adventure</a> <a class="btn btn-secondary" href="' + esc(ctx.dashboardUrl('#adventures')) + '">Open Adventures</a></div>';
      return null;
    }

    body.innerHTML = '<p class="cw-loading" role="status">Loading the adventure…</p>';
    var results = await Promise.all([global.FogAdventureStore.get(c.adventureId), D().getProgress(ctx.id), D().listReveals(ctx.id)]);
    if (!alive) return null;
    var advRes = results[0];
    if (!advRes.ok) {
      body.innerHTML = '<div class="cw-card cw-empty cw-empty-lg"><h3>The adventure could not be opened</h3><p>' + esc(advRes.message) + '</p><a class="btn btn-secondary" href="#settings">Campaign Settings</a></div>';
      return null;
    }
    var adv = advRes.adventure;
    var progress = results[1].ok ? results[1].progress : { currentSection: null, completed: [] };
    var progressError = results[1].ok ? null : results[1].message;
    var reveals = results[2].ok ? results[2].reveals : [];
    var chapters = adv.content.chapters;
    var kindFilter = '';
    var mode = 'reading'; // opening an adventure always starts in Reading Mode
    var readerCleanup = null;
    var readerToken = 0;
    var selected = params.rest[0] || progress.currentSection || (chapters[0] && chapters[0].sections[0] && chapters[0].sections[0].id) || null;

    function findSection(id) {
      for (var i = 0; i < chapters.length; i++) {
        for (var j = 0; j < chapters[i].sections.length; j++) if (chapters[i].sections[j].id === id) return { chapter: chapters[i], section: chapters[i].sections[j] };
      }
      return null;
    }
    function totalSections() { return chapters.reduce(function (n, ch) { return n + ch.sections.length; }, 0); }
    function doneCount() { return progress.completed.filter(function (id) { return !!findSection(id); }).length; }
    function revealOf(id) { return reveals.find(function (r) { return r.sectionId === id; }); }

    function modeBar() {
      return '<div class="cw-modebar"><div class="cw-modeswitch" role="group" aria-label="Mode">' +
        '<button type="button" class="cw-mode' + (mode === 'reading' ? ' is-on' : '') + '" data-ct-mode="reading" aria-pressed="' + (mode === 'reading') + '">Reading mode</button>' +
        '<button type="button" class="cw-mode' + (mode === 'editing' ? ' is-on' : '') + '" data-ct-mode="editing" aria-pressed="' + (mode === 'editing') + '">Editing mode</button></div>' +
        '<p class="cw-muted">' + (mode === 'reading' ? 'Reading: the adventure as a book, exactly as in Adventures → Read (DM view shows your private notes; Player view hides them). Switch to Editing mode for progress, sharing and the editor.' : 'Editing: tools to run the campaign and edit the adventure. Players see only what you share.') + '</p></div>';
    }

    host.querySelector('#ct-head').innerHTML = '<a class="btn btn-secondary btn-sm" href="' + esc(ctx.dashboardUrl('#adventures/' + adv.id + '/read')) + '">Open in the Reader</a> <a class="btn btn-secondary btn-sm" href="' + esc(ctx.dashboardUrl('#adventures/' + adv.id)) + '">Edit adventure</a>';

    function outline() {
      if (!chapters.length) return '<p class="cw-muted">This adventure has no chapters yet. Write some in the editor.</p>';
      return chapters.map(function (ch, i) {
        var sections = ch.sections.filter(function (s) { return !kindFilter || s.kind === kindFilter; });
        if (!sections.length && kindFilter) return '';
        return '<div class="cw-ol-chapter"><h4>' + (i + 1) + '. ' + esc(ch.title) + '</h4><ul>' + sections.map(function (s) {
          var done = progress.completed.indexOf(s.id) >= 0;
          var cur = progress.currentSection === s.id;
          return '<li><button type="button" class="cw-ol-item' + (selected === s.id ? ' is-active' : '') + (done ? ' is-done' : '') + '" data-ct-pick="' + esc(s.id) + '"' + (selected === s.id ? ' aria-current="true"' : '') + '>' +
            '<span class="cw-ol-mark" aria-hidden="true">' + (done ? '✔' : cur ? '▶' : kindIcon(s.kind)) + '</span><span class="cw-ol-title">' + esc(s.title || 'Untitled') + '</span>' +
            (cur ? '<span class="cw-sr">(current)</span>' : '') + (revealOf(s.id) ? '<span class="cw-ol-shared" title="Shared with players">shared</span>' : '') + '</button></li>';
        }).join('') + '</ul></div>';
      }).join('');
    }

    function detail() {
      var hit = selected && findSection(selected);
      if (!hit) return '<div class="cw-empty"><p>Choose a section from the outline.</p></div>';
      var s = hit.section;
      var K = AM().KINDS[s.kind] || AM().KINDS.scene;
      var done = progress.completed.indexOf(s.id) >= 0;
      var cur = progress.currentSection === s.id;
      var shared = revealOf(s.id);
      var fields = (K.fields || []).map(function (f) { var v = s.fields && s.fields[f.key]; return v ? '<div><dt>' + esc(f.label) + '</dt><dd>' + esc(v) + '</dd></div>' : ''; }).join('');
      var imgs = (s.images || []).length;
      return '<header class="cw-sec-head"><span class="cw-kind">' + K.icon + ' ' + esc(K.label) + '</span><span class="cw-muted">' + esc(hit.chapter.title) + '</span></header><h3>' + esc(s.title || 'Untitled') + '</h3>' +
        (s.kind === 'encounter' ? '<p class="cw-muted">Creatures are listed below. Add them from <a href="#bestiary">Bestiary &amp; Spells</a>, then run the fight in <a href="#combat">Combat</a>.</p>' : '') +
        '<h4 class="cv-subheading">For the players</h4>' + (s.playerText ? '<div class="cw-prose">' + paragraphs(s.playerText) + '</div>' : '<p class="cw-muted">No player-facing text.</p>') +
        (s.dmNotes ? '<div class="cw-dmnote"><h4><span aria-hidden="true">🔒</span> DM notes <span class="cw-muted">(only you)</span></h4><div class="cw-prose">' + paragraphs(s.dmNotes) + '</div></div>' : '') +
        (fields ? '<dl class="cw-facts cw-facts-wide">' + fields + '</dl>' : '') +
        (imgs ? '<p class="cw-muted">' + imgs + ' image' + (imgs === 1 ? '' : 's') + ' attached; open the section in the Reader to see them.</p>' : '') +
        '<div class="cw-actions">' +
        '<button type="button" class="btn ' + (cur ? 'btn-secondary' : 'btn-primary') + ' btn-sm" data-ct="current" data-id="' + esc(s.id) + '"' + (archived ? ' disabled' : '') + '>' + (cur ? 'This is the current section' : 'Set as current section') + '</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-ct="done" data-id="' + esc(s.id) + '"' + (archived ? ' disabled' : '') + '>' + (done ? 'Mark as not done' : 'Mark as done') + '</button>' +
        (shared
          ? '<button type="button" class="btn btn-secondary btn-sm" data-ct="unshare" data-id="' + esc(shared.id) + '"' + (archived ? ' disabled' : '') + '>Hide from players</button>'
          : '<button type="button" class="btn btn-secondary btn-sm" data-ct="share" data-id="' + esc(s.id) + '"' + (archived || !s.playerText ? ' disabled' : '') + (s.playerText ? '' : ' title="Add player-facing text in the editor first"') + '>Share with players</button>') + '</div>' +
        (shared ? '<p class="cw-muted cw-fine">Shared with the players on ' + esc(new Date(shared.createdAt).toLocaleDateString()) + '. They see the text above under “For the players”, never the DM notes.</p>' : '');
    }

    function draw() {
      if (!alive) return;
      host.querySelector('#ct-head').hidden = mode === 'reading';
      if (readerCleanup) { readerCleanup(); readerCleanup = null; }
      if (mode === 'reading') {
        if (!chapters.length) { body.innerHTML = modeBar() + '<div class="cw-card cw-empty cw-empty-lg"><h3>This adventure has no chapters yet</h3><p>Write some in the editor.</p><a class="btn btn-primary" href="' + esc(ctx.dashboardUrl('#adventures/' + adv.id)) + '">Edit adventure</a></div>'; return; }
        body.innerHTML = modeBar() + '<div id="ct-reader"></div>';
        var token = ++readerToken;
        mountReader(body.querySelector('#ct-reader'), { id: adv.id, adventure: adv }, ctx).then(function (cleanup) {
          if (!alive || token !== readerToken || mode !== 'reading') { if (cleanup) cleanup(); return; }
          readerCleanup = cleanup;
        }).catch(function (e) { body.querySelector('#ct-reader').innerHTML = '<div class="cw-empty"><p>' + esc(e.message) + '</p></div>'; });
        return;
      }
      var total = totalSections();
      var done = doneCount();
      var pct = total ? Math.round((done / total) * 100) : 0;
      var curHit = progress.currentSection && findSection(progress.currentSection);
      var kinds = AM().KIND_ORDER.filter(function (k) { return chapters.some(function (ch) { return ch.sections.some(function (s) { return s.kind === k; }); }); });
      body.innerHTML = modeBar() + '<section class="cw-card cw-progress"><div><h3 class="cw-card-title">' + esc(adv.title) + '</h3>' +
        '<p class="cw-muted">' + chapters.length + ' chapter' + (chapters.length === 1 ? '' : 's') + ' · ' + total + ' section' + (total === 1 ? '' : 's') + ' · Level ' + esc(adv.levelMin || '?') + '–' + esc(adv.levelMax || '?') + '</p></div>' +
        '<div class="cw-progress-bar"><div class="cw-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '" aria-label="Sections finished"><span style="width:' + pct + '%"></span></div>' +
        '<p class="cw-muted">' + done + ' of ' + total + ' finished' + (curHit ? ' · now at <strong>' + esc(curHit.section.title || 'Untitled') + '</strong>' : '') + '</p></div>' +
        (progressError ? '<p class="cw-banner">Progress can’t be saved right now: ' + esc(progressError) + '</p>' : '') + '</section>' +
        '<div class="cw-content-grid"><nav class="cw-card cw-outline" aria-label="Adventure outline">' +
        (kinds.length > 1 ? '<label class="cw-field"><span>Show</span><select class="cw-select" data-ct-filter aria-label="Filter by section type"><option value="">Everything</option>' + kinds.map(function (k) { return '<option value="' + k + '"' + (kindFilter === k ? ' selected' : '') + '>' + esc(kindLabel(k)) + (k === 'npc' ? 's' : k === 'location' ? 's' : k === 'encounter' ? 's' : '') + '</option>'; }).join('') + '</select></label>' : '') +
        outline() + '</nav><article class="cw-card cw-section" id="ct-detail" tabindex="-1">' + detail() + '</article></div>';
    }

    async function saveProgress() {
      if (archived) return;
      var res = await D().saveProgress(ctx.id, progress);
      if (!res.ok) UI().notice(res.message, 'error');
    }

    host.addEventListener('click', async function (e) {
      var md = e.target.closest('[data-ct-mode]');
      if (md) { mode = md.getAttribute('data-ct-mode'); draw(); return; }
      var pick = e.target.closest('[data-ct-pick]');
      if (pick) { selected = pick.getAttribute('data-ct-pick'); history.replaceState(null, '', '#content/' + encodeURIComponent(selected)); draw(); host.querySelector('#ct-detail').focus({ preventScroll: true }); return; }
      var b = e.target.closest('[data-ct]');
      if (!b) return;
      var a = b.getAttribute('data-ct');
      var id = b.getAttribute('data-id');
      if (a === 'current') { progress.currentSection = id; draw(); saveProgress(); }
      else if (a === 'done') {
        var i = progress.completed.indexOf(id);
        if (i >= 0) progress.completed.splice(i, 1); else progress.completed.push(id);
        draw(); saveProgress();
      } else if (a === 'share') {
        var hit = findSection(id);
        if (!hit) return;
        var ok = await UI().confirm({ title: 'Share “' + (hit.section.title || 'Untitled') + '” with the players?', message: 'Every player in the campaign will be able to read its “For the players” text. Your DM notes and other private fields stay hidden.', confirmLabel: 'Share' });
        if (!ok || !alive) return;
        var res = await D().addReveal(ctx.id, { sectionId: id, kind: hit.section.kind, title: hit.section.title || 'Untitled', chapterTitle: hit.chapter.title, body: hit.section.playerText });
        if (!res.ok) { UI().notice(res.message, 'error'); return; }
        reveals.unshift(res.reveal);
        UI().notice('Shared with the players.');
        draw();
      } else if (a === 'unshare') {
        var res2 = await D().removeReveal(id);
        if (!res2.ok) { UI().notice(res2.message, 'error'); return; }
        reveals = reveals.filter(function (r) { return r.id !== id; });
        UI().notice('Hidden from the players again.');
        draw();
      }
    });
    host.addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-ct-filter')) { kindFilter = e.target.value; draw(); }
    });

    draw();
    return function () { alive = false; if (readerCleanup) readerCleanup(); };
  }

  function render(host, ctx, params) {
    return ctx.isDm ? renderDm(host, ctx, params) : renderPlayer(host, ctx, params);
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.content = { render: render };
})(window);
