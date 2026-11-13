/**
 * Logbook (formerly Memories & Recaps): the campaign's long-term archive, meeting recaps, the history log and the campaign book.
 *
 * Plan gate: writing needs the campaign DM's plan to include the Logbook (Dungeon Master or Fogger of the Dragons);
 * the database refuses writes otherwise (and says so here). Reading what was published for players is always allowed.
 * Visibility: each memory is "players" or "DM only"; players only ever receive published player-visible ones.
 * Recaps are written by the DM (optionally starting from the meeting's own summary). No AI writes or publishes anything.
 * The book: unlocked by a paid campaign-wide purchase or the top plan (checked by the database, see campaign_book()).
 * Payments and printing aren't connected, so there is nothing to buy yet: the page says so instead of pretending.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  var P = function () { return global.FogCampaignParty; };
  var B = function () { return global.FogBookRender; };

  var KINDS = [
    ['recap', 'Meeting recap'], ['event', 'Important event'], ['character', 'Character moment'], ['npc', 'Important NPC'], ['quote', 'Quote'],
    ['location', 'Location'], ['discovery', 'Discovery'], ['decision', 'Important decision'], ['battle', 'Major battle'], ['milestone', 'Campaign milestone'],
    ['map', 'Map'], ['image', 'Image'], ['note', 'DM note'],
  ];
  var PLAN_NAME = { warlord: 'Warlord (Free)', 'dungeon-master': 'Dungeon Master', 'fogger-of-the-dragons': 'Fogger of the Dragons' };

  function esc(s) { return UI().esc(s); }
  function kindLabel(k) { var f = KINDS.find(function (x) { return x[0] === k; }); return f ? f[1] : 'Memory'; }
  function para(t) { return String(t || '').split(/\n{2,}/).filter(Boolean).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }

  async function render(host, ctx, params) {
    var alive = true;
    var isDm = ctx.isDm;
    var archived = ctx.campaign.status === 'archived';
    var tab = params.rest[0] === 'book' ? 'book' : params.rest[0] === 'history' ? 'history' : params.rest[0] === 'recaps' ? 'recaps' : 'archive';
    var access = null;
    var memories = [];
    var meetings = [];
    var urls = {};
    var filter = { q: '', kind: '', vis: '' };
    var loadError = null;
    var confirming = false;
    var watchTimer = null;

    host.innerHTML = '<div class="cw-page cw-memories compendium-page"><header class="cw-page-head"><div><h2 class="cw-page-title">Logbook</h2>' +
      '<p class="cw-page-sub">The story of this campaign so far: recaps of each meeting, the moments worth keeping, and a book to read them in.</p></div>' +
      (isDm ? '<div class="cw-head-actions" id="mm-actions"></div>' : '') + '</header>' +
      '<div class="cw-tabs" role="tablist"><button type="button" role="tab" class="cw-tab" data-mm-tab="archive">Archive</button><button type="button" role="tab" class="cw-tab" data-mm-tab="recaps">Recaps</button>' +
      '<button type="button" role="tab" class="cw-tab" data-mm-tab="book">Campaign book</button><button type="button" role="tab" class="cw-tab" data-mm-tab="history">History</button></div>' +
      '<div id="mm-lock"></div><div id="mm-body" role="tabpanel"></div></div>';
    var body = host.querySelector('#mm-body');

    function canWrite() { return isDm && access && access.memories && !archived; }

    function drawLock() {
      var el = host.querySelector('#mm-lock');
      if (!access || access.memories) { el.innerHTML = ''; return; }
      el.innerHTML = '<div class="cw-banner"><strong>The Logbook is locked for this campaign.</strong> It comes with the Dungeon Master and Fogger of the Dragons plans (this campaign’s Dungeon Master is on <strong>' + esc(PLAN_NAME[access.ownerPlan] || access.ownerPlan) + '</strong>). ' +
        (isDm ? '<a href="' + esc(ctx.dashboardUrl('#upgrade')) + '">See the plans</a>. ' : 'Ask your Dungeon Master. ') + 'Anything already published stays readable' + (memories.length ? '' : '; nothing has been published yet') + '.</div>';
    }

    // ---- Archive ------------------------------------------------------------------------------------------------
    function memoryCard(m) {
      var img = m.imagePath && urls[m.imagePath] ? '<figure class="cw-mem-img"><img src="' + esc(urls[m.imagePath]) + '" alt="' + esc(m.title) + '"></figure>' : '';
      var recap = m.recap ? B().RECAP_SECTIONS.map(function (s) { return m.recap[s[0]] ? '<h4 class="cv-subheading">' + s[1] + '</h4><div class="cw-prose">' + para(m.recap[s[0]]) + '</div>' : ''; }).join('') : '';
      var meeting = m.meetingId ? meetings.find(function (x) { return x.id === m.meetingId; }) : null;
      var actions = canWrite() ? '<div class="cw-actions"><button type="button" class="btn btn-secondary btn-sm" data-mm="edit" data-id="' + esc(m.id) + '">Edit</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-mm="toggle" data-id="' + esc(m.id) + '">' + (m.status === 'published' ? 'Unpublish' : 'Publish') + '</button>' +
        '<button type="button" class="cv-link-btn cv-danger" data-mm="delete" data-id="' + esc(m.id) + '">Delete</button></div>'
        : (isDm && !archived ? '<div class="cw-actions"><button type="button" class="cv-link-btn cv-danger" data-mm="delete" data-id="' + esc(m.id) + '">Delete</button></div>' : '');
      return '<article class="cw-card cw-memory" data-id="' + esc(m.id) + '"><header><div><h3>' + esc(m.title) + '</h3><p class="cw-muted">' + esc(kindLabel(m.kind)) +
        (m.occurredOn ? ' · ' + esc(new Date(m.occurredOn + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })) : '') +
        (m.subject ? ' · ' + esc(m.subject) : '') + (meeting ? ' · ' + esc(meeting.title) : '') + '</p></div>' +
        '<div class="cw-pills">' + (isDm ? '<span class="cw-pill ' + (m.visibility === 'dm' ? 'cw-pill-warn' : 'cw-pill-role') + '">' + (m.visibility === 'dm' ? 'DM only' : 'Visible to players') + '</span>' +
          '<span class="cw-pill ' + (m.status === 'published' ? 'cw-pill-done' : 'cw-pill-none') + '">' + (m.status === 'published' ? 'Published' : 'Draft') + '</span>' : '') + '</div></header>' +
        img + (m.content ? '<div class="cw-prose">' + (m.kind === 'quote' ? '<blockquote class="cw-quote-block">' + para(m.content) + '</blockquote>' : para(m.content)) + '</div>' : '') + recap + actions + '</article>';
    }

    function drawArchive() {
      var q = filter.q.trim().toLowerCase();
      var items = memories.filter(function (m) {
        if (filter.kind && m.kind !== filter.kind) return false;
        if (filter.vis && (filter.vis === 'dm' ? m.visibility !== 'dm' : m.status !== 'draft' ? m.visibility !== 'players' : true)) return false;
        if (q && (m.title + ' ' + m.content + ' ' + m.subject).toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      body.innerHTML = '<div class="cw-filters"><input class="form-control" type="search" data-mm-f="q" value="' + esc(filter.q) + '" placeholder="Search memories…" aria-label="Search memories">' +
        '<select class="form-control" data-mm-f="kind" aria-label="Kind"><option value="">All kinds</option>' + KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (filter.kind === k[0] ? ' selected' : '') + '>' + esc(k[1]) + '</option>'; }).join('') + '</select>' +
        (isDm ? '<select class="form-control" data-mm-f="vis" aria-label="Visibility"><option value="">Everything</option><option value="players"' + (filter.vis === 'players' ? ' selected' : '') + '>Visible to players</option><option value="dm"' + (filter.vis === 'dm' ? ' selected' : '') + '>DM only</option></select>' : '') + '</div>' +
        (items.length ? '<div class="cw-stack">' + items.map(memoryCard).join('') + '</div>'
          : '<div class="cw-card cw-empty cw-empty-lg"><h3>' + (memories.length ? 'Nothing matches' : 'No memories yet') + '</h3><p>' + (memories.length ? 'Try other filters.' : (isDm ? (access && access.memories ? 'Write the first memory or a recap of your last meeting.' : 'The Logbook is locked for this campaign.') : 'Your Dungeon Master hasn’t published any memories yet.')) + '</p></div>');
    }

    // ---- Recaps -------------------------------------------------------------------------------------------------
    function drawRecaps() {
      var done = meetings.filter(function (m) { return m.status === 'completed'; }).sort(function (a, b) { return new Date(b.startsAt) - new Date(a.startsAt); });
      if (!done.length) { body.innerHTML = '<div class="cw-card cw-empty cw-empty-lg"><h3>No completed meetings yet</h3><p>Recaps belong to meetings that happened. Mark a meeting as completed in <a href="#meetings">Meetings</a>.</p></div>'; return; }
      body.innerHTML = '<div class="cw-stack">' + done.map(function (m) {
        var recaps = memories.filter(function (x) { return x.kind === 'recap' && x.meetingId === m.id; });
        return '<article class="cw-card"><header class="cw-meeting-head"><div><h3>' + esc(m.title) + '</h3><p class="cw-muted">' + esc(new Date(m.startsAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })) + '</p></div>' +
          '<span class="cw-pill ' + (recaps.some(function (r) { return r.status === 'published'; }) ? 'cw-pill-done' : 'cw-pill-warn') + '">' + (recaps.some(function (r) { return r.status === 'published'; }) ? 'Recap published' : recaps.length ? 'Recap in draft' : 'No recap yet') + '</span></header>' +
          (m.summary ? '<div class="cw-summary"><h4>Meeting summary</h4><p>' + esc(m.summary) + '</p></div>' : '') +
          (isDm ? '<div class="cw-actions">' + (recaps.length ? recaps.map(function (r) { return '<button type="button" class="btn btn-secondary btn-sm" data-mm="edit" data-id="' + esc(r.id) + '">Edit recap' + (recaps.length > 1 ? ' “' + esc(r.title) + '”' : '') + '</button>'; }).join('') : '<button type="button" class="btn btn-primary btn-sm" data-mm="recap" data-meeting="' + esc(m.id) + '"' + (canWrite() ? '' : ' disabled') + '>Write a recap</button>') + '</div>' : '') + '</article>';
      }).join('') + '</div>';
    }

    // ---- History ------------------------------------------------------------------------------------------------
    async function drawHistory() {
      body.innerHTML = '<p class="cw-loading" role="status">Loading…</p>';
      var res = await D().listHistory(ctx.id);
      if (!alive || tab !== 'history') return;
      if (!res.ok) { body.innerHTML = '<div class="cw-empty"><p>' + esc(res.message) + '</p></div>'; return; }
      body.innerHTML = '<div class="cw-card"><h3 class="cw-card-title">Campaign history</h3><p class="cw-muted">Automatic record of changes that matter: the start, level-ups and any DM correction of locked settings.</p>' +
        (res.history.length ? '<ol class="cw-history">' + res.history.map(function (h) { return '<li class="cw-hist-' + esc(h.kind) + '"><time datetime="' + esc(h.at) + '">' + esc(new Date(h.at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</time><span>' + esc(h.summary) + '</span></li>'; }).join('') + '</ol>' : '<p class="cw-muted">Nothing yet.</p>') + '</div>';
    }

    // Back from the payment page: poll the database for the unlock (never assume it from the redirect).
    function watchCheckout() {
      if (watchTimer) return;
      confirming = true;
      var tries = 0;
      watchTimer = global.setInterval(async function () {
        tries += 1;
        var r = await D().featureAccess(ctx.id);
        if (!alive) { global.clearInterval(watchTimer); return; }
        if (r.ok && r.access.bookUnlocked) {
          global.clearInterval(watchTimer); watchTimer = null; confirming = false;
          access = r.access;
          UI().notice('Payment confirmed: the book is unlocked for everyone in the campaign.');
          draw();
        } else if (tries >= 20) {
          global.clearInterval(watchTimer); watchTimer = null; confirming = false;
          UI().notice('The payment hasn’t been confirmed yet. It can take a minute: reload this page shortly. If it never unlocks, contact support with your receipt.', 'error');
          if (tab === 'book') draw();
        }
      }, 3000);
      if (tab === 'book') host.querySelector('[data-mm="buy-book"]') && (host.querySelector('[data-mm="buy-book"]').disabled = true);
    }

    // ---- Book ---------------------------------------------------------------------------------------------------
    async function drawBook() {
      if (!access.bookUnlocked) {
        // Back from the payment page: start waiting for the server's confirmation before drawing, so the banner is there at once.
        if (location.search.indexOf('checkout=success') >= 0) watchCheckout();
        var live = global.FogPayments && global.FogPayments.enabled();
        var demoPay = !live && global.FogPayments && global.FogPayments.demo && (await global.FogPayments.demo()).demoPayments;
        if (!alive || tab !== 'book') return;
        var canBuy = (live || demoPay) && access.memories;
        body.innerHTML = '<div class="cw-card cw-book-offer"><h3 class="cw-card-title">The campaign book</h3><p>Your recaps, memories, quotes, maps and timeline, bound into a chronicle you can read on screen or print. One purchase unlocks it for <strong>everyone in the campaign</strong>.</p>' +
          '<ul class="cw-plain-list"><li><strong>Digital book:</strong> included free when the campaign’s Dungeon Master is on <em>Fogger of the Dragons</em>; otherwise one member can buy it for the whole campaign.</li>' +
          '<li><strong>Printed book:</strong> offered separately, at production and delivery cost.</li></ul>' +
          (confirming ? '<p class="cw-banner" role="status"><strong>Confirming your payment…</strong> This usually takes a few seconds. The book unlocks for everyone as soon as the payment provider confirms it.</p>' : '') +
          '<div class="cw-actions"><button type="button" class="btn btn-primary btn-sm" data-mm="buy-book"' + (canBuy && !confirming ? '' : ' disabled') + '>Buy the digital book for the campaign</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" disabled>Order a printed copy</button></div>' +
          '<p class="cw-muted cw-fine">' +
          (!access.memories ? 'The book needs the Logbook, which comes with the Dungeon Master and Fogger of the Dragons plans.'
            : demoPay ? 'Demo payments are on: checkout simulates the payment with a test card (no money moves), and the book unlocks for everyone as it will with a real payment.'
            : live ? 'You will pay on the payment provider’s secure page (Lemon Squeezy, which also handles sales tax). Nothing unlocks until they confirm the payment to our server; being sent back here is not enough. The price is shown at checkout.'
              : 'Payments aren’t switched on for this site yet, so nothing can be bought, and no purchase is ever recorded from this page.') +
          ' Printed books aren’t available yet: no printing and shipping provider is connected.</p></div>';
        return;
      }
      body.innerHTML = '<p class="cw-loading" role="status">Opening the book…</p>';
      var res = await D().getBook(ctx.id);
      if (!alive || tab !== 'book') return;
      if (!res.ok) { body.innerHTML = '<div class="cw-card cw-empty"><p>' + esc(res.message) + '</p></div>'; return; }
      var paths = res.book.memories.map(function (m) { return m.image_path; }).filter(Boolean);
      var imgUrls = await D().memoryImageUrls(paths);
      if (!alive || tab !== 'book') return;
      body.innerHTML = '<div class="cw-book-bar"><p class="cw-muted">' + (access.bookIncludedByPlan ? 'Included with the Dungeon Master’s plan.' : 'Unlocked for the whole campaign' + (access.bookPurchasedBy ? ' by ' + esc(access.bookPurchasedBy) : '') + '.') + ' Everyone in the campaign can read it.</p>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-mm="print">Print or save as PDF</button></div>' + B().render(res.book, imgUrls);
    }

    function draw() {
      if (!alive) return;
      host.querySelectorAll('[data-mm-tab]').forEach(function (b) { var on = b.getAttribute('data-mm-tab') === tab; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); });
      var act = host.querySelector('#mm-actions');
      if (act) act.innerHTML = '<button type="button" class="btn btn-primary btn-sm" data-mm="new"' + (canWrite() ? '' : ' disabled title="The Logbook is locked for this campaign"') + '>New memory</button>';
      drawLock();
      if (loadError) { body.innerHTML = '<div class="cw-card cw-empty"><p>' + esc(loadError) + '</p><button type="button" class="btn btn-secondary btn-sm" data-mm="reload">Try again</button></div>'; return; }
      if (tab === 'archive') drawArchive(); else if (tab === 'recaps') drawRecaps(); else if (tab === 'history') drawHistory(); else drawBook();
    }

    // ---- Editor -------------------------------------------------------------------------------------------------
    function editor(existing, preset) {
      var m = Object.assign({ kind: 'event', title: '', content: '', occurredOn: '', meetingId: '', subject: '', imagePath: null, recap: null, visibility: 'players', status: 'draft' }, existing || preset || {});
      var recap = m.recap || {};
      var pendingImage = { path: m.imagePath, uploaded: null, removed: false };
      var done = meetings.filter(function (x) { return x.status === 'completed'; });
      var d = UI().dialog('<form class="cw-dialog-body cw-editor" novalidate><h2 class="cw-dialog-title">' + (existing ? 'Edit memory' : 'New memory') + '</h2>' +
        '<div class="cw-field-row"><label class="cw-field"><span>Kind</span><select class="form-control" name="kind">' + KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (m.kind === k[0] ? ' selected' : '') + '>' + esc(k[1]) + '</option>'; }).join('') + '</select></label>' +
        '<label class="cw-field"><span>Date it happened (in the story or at the table)</span><input class="form-control" type="date" name="occurredOn" value="' + esc(m.occurredOn || '') + '"></label></div>' +
        '<label class="cw-field"><span>Title</span><input class="form-control" name="title" maxlength="160" required value="' + esc(m.title) + '"></label>' +
        '<div class="cw-field-row"><label class="cw-field"><span>Meeting (optional)</span><select class="form-control" name="meetingId"><option value="">Not tied to a meeting</option>' + done.map(function (x) { return '<option value="' + esc(x.id) + '"' + (m.meetingId === x.id ? ' selected' : '') + '>' + esc(x.title) + '</option>'; }).join('') + '</select></label>' +
        '<label class="cw-field"><span>Character, NPC or place (optional)</span><input class="form-control" name="subject" maxlength="120" value="' + esc(m.subject) + '"></label></div>' +
        '<label class="cw-field"><span id="mm-content-label">' + (m.kind === 'quote' ? 'The words, exactly as said at the table' : 'Content') + '</span><textarea class="form-control" name="content" rows="5" maxlength="20000">' + esc(m.content) + '</textarea></label>' +
        '<div data-recap' + (m.kind === 'recap' ? '' : ' hidden') + '><p class="cw-muted">Fill in what applies. <button type="button" class="cv-link-btn" data-mm="from-summary">Start from the meeting’s own summary</button> (copies the summary the DM wrote when completing the meeting; nothing is invented).</p>' +
        B().RECAP_SECTIONS.map(function (s) { return '<label class="cw-field"><span>' + s[1] + '</span><textarea class="form-control" name="r_' + s[0] + '" rows="3" maxlength="6000">' + esc(recap[s[0]] || '') + '</textarea></label>'; }).join('') + '</div>' +
        '<fieldset class="cw-fieldset"><legend>Image or map (optional)</legend><div id="mm-img"></div><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" name="image"></fieldset>' +
        '<fieldset class="cw-fieldset"><legend>Who can read it</legend><label class="cw-check"><input type="radio" name="visibility" value="players"' + (m.visibility === 'players' ? ' checked' : '') + '> Players (once published)</label>' +
        '<label class="cw-check"><input type="radio" name="visibility" value="dm"' + (m.visibility === 'dm' ? ' checked' : '') + '> DM only (private notes: never shown to players or in the book)</label></fieldset>' +
        '<p class="cw-form-error" role="alert" hidden></p><div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Cancel</button><button type="submit" class="btn btn-secondary btn-sm" data-mm-save="draft">Save draft</button>' +
        '<button type="submit" class="btn btn-primary btn-sm" data-mm-save="published">Save and publish</button></div></form>', { label: 'Memory' });
      var f = d.el.querySelector('form');
      var err = f.querySelector('.cw-form-error');
      var mode = 'draft';
      f.querySelectorAll('[data-mm-save]').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-mm-save'); }); });
      async function showImage() {
        var el = f.querySelector('#mm-img');
        var path = pendingImage.removed ? null : (pendingImage.uploaded || pendingImage.path);
        if (!path) { el.innerHTML = '<p class="cw-muted">No image.</p>'; return; }
        var u = await D().memoryImageUrls([path]);
        el.innerHTML = (u[path] ? '<img class="cw-mem-thumb" src="' + esc(u[path]) + '" alt="Attached image">' : '<p class="cw-muted">Image attached.</p>') + ' <button type="button" class="cv-link-btn" data-mm="drop-image">Remove image</button>';
      }
      showImage();
      f.addEventListener('change', async function (e) {
        if (e.target.name === 'kind') {
          f.querySelector('[data-recap]').hidden = e.target.value !== 'recap';
          f.querySelector('#mm-content-label').textContent = e.target.value === 'quote' ? 'The words, exactly as said at the table' : 'Content';
        } else if (e.target.name === 'image' && e.target.files[0]) {
          err.hidden = true;
          var vis = f.querySelector('input[name=visibility]:checked').value;
          var up = await D().uploadMemoryImage(ctx.id, vis, e.target.files[0]);
          if (!up.ok) { err.textContent = up.message; err.hidden = false; return; }
          if (pendingImage.uploaded) D().removeMemoryImage(pendingImage.uploaded);
          pendingImage.uploaded = up.path; pendingImage.removed = false; pendingImage.visibilityAtUpload = vis;
          showImage();
        }
      });
      f.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mm]');
        if (!b) return;
        if (b.getAttribute('data-mm') === 'drop-image') { pendingImage.removed = true; showImage(); }
        else if (b.getAttribute('data-mm') === 'from-summary') {
          var t = meetings.find(function (x) { return x.id === f.meetingId.value; });
          if (!t || !t.summary) { err.textContent = 'Choose a meeting that has a summary first.'; err.hidden = false; return; }
          err.hidden = true;
          if (!f.r_happened.value.trim() || global.confirm('Replace “What happened” with the meeting summary?')) f.r_happened.value = t.summary;
        }
      });
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var vis = f.querySelector('input[name=visibility]:checked').value;
        var imagePath = pendingImage.removed ? null : (pendingImage.uploaded || pendingImage.path);
        // The image lives in the folder that matches who may see it; moving a memory between audiences needs a fresh upload.
        if (imagePath && imagePath.split('/')[1] !== (vis === 'players' ? 'players' : 'dm')) { err.textContent = 'This image was uploaded for the other audience. Remove it and add it again after choosing who can read the memory.'; err.hidden = false; return; }
        var kind = f.kind.value;
        var rc = null;
        if (kind === 'recap') { rc = {}; B().RECAP_SECTIONS.forEach(function (s) { if (f['r_' + s[0]].value.trim()) rc[s[0]] = f['r_' + s[0]].value.trim(); }); }
        var res = await D().saveMemory(ctx.id, {
          id: existing && existing.id, kind: kind, title: f.title.value, content: f.content.value, occurredOn: f.occurredOn.value || null, meetingId: f.meetingId.value || null,
          subject: f.subject.value, imagePath: imagePath, recap: rc, visibility: vis, status: mode,
        });
        if (!res.ok) { err.textContent = res.message; err.hidden = false; return; }
        if (existing && existing.imagePath && existing.imagePath !== imagePath) D().removeMemoryImage(existing.imagePath);
        d.close();
        UI().notice(mode === 'published' ? (vis === 'players' ? 'Published to the archive.' : 'Saved as a DM-only note.') : 'Draft saved.');
        load();
      });
      f.title.focus();
    }

    // ---- Events -------------------------------------------------------------------------------------------------
    host.addEventListener('click', async function (e) {
      var t = e.target.closest('[data-mm-tab]');
      if (t) { tab = t.getAttribute('data-mm-tab'); history.replaceState(null, '', '#logbook' + (tab === 'archive' ? '' : '/' + tab)); draw(); return; }
      var b = e.target.closest('[data-mm]');
      if (!b) return;
      var a = b.getAttribute('data-mm');
      var m = memories.find(function (x) { return x.id === b.getAttribute('data-id'); });
      if (a === 'new') editor(null);
      else if (a === 'reload') load();
      else if (a === 'buy-book') {
        b.disabled = true;
        if (!global.FogPayments.enabled() && global.FogPayments.demo && (await global.FogPayments.demo()).demoPayments) {
          var dm = global.FogPayments.buyWithDemoCheckout({ type: 'campaign_book', ref: ctx.id, title: 'Campaign Book (digital): ' + ctx.campaign.name, unitCents: 499, kindLabel: 'Digital, for the whole campaign' }, 'dashboard.html');
          if (!dm.ok) { b.disabled = false; UI().notice(dm.message, 'error'); }
          return;
        }
        var bought = await global.FogPayments.buy('campaign_book_digital', ctx.id);
        if (!bought.ok) { b.disabled = false; UI().notice(bought.message, 'error'); }
      }
      else if (a === 'print') { document.body.classList.add('cw-print-book'); global.print(); setTimeout(function () { document.body.classList.remove('cw-print-book'); }, 500); }
      else if (a === 'edit' && m) editor(m);
      else if (a === 'recap') {
        var mt = meetings.find(function (x) { return x.id === b.getAttribute('data-meeting'); });
        editor(null, { kind: 'recap', title: 'Recap: ' + (mt ? mt.title : ''), meetingId: mt ? mt.id : '', occurredOn: mt ? mt.startsAt.slice(0, 10) : '', visibility: 'players' });
      } else if (a === 'toggle' && m) {
        var publish = m.status !== 'published';
        if (publish && m.visibility === 'dm' && !(await UI().confirm({ title: 'Publish a DM-only note?', message: 'It stays hidden from players and from the book. Only the DM sees it as “published”.', confirmLabel: 'Publish' }))) return;
        var res = await D().saveMemory(ctx.id, Object.assign({}, m, { status: publish ? 'published' : 'draft' }));
        if (!res.ok) UI().notice(res.message, 'error'); else { UI().notice(publish ? 'Published.' : 'Back to draft: players no longer see it.'); load(); }
      } else if (a === 'delete' && m) {
        if (!(await UI().confirm({ title: 'Delete “' + m.title + '”?', message: 'It is removed from the archive and from the book. This can’t be undone.', confirmLabel: 'Delete', danger: true }))) return;
        var res2 = await D().deleteMemory(m.id);
        if (!res2.ok) { UI().notice(res2.message, 'error'); return; }
        if (m.imagePath) D().removeMemoryImage(m.imagePath);
        UI().notice('Memory deleted.');
        load();
      }
    });
    host.addEventListener('input', function (e) {
      var f = e.target.getAttribute && e.target.getAttribute('data-mm-f');
      if (f && e.target.tagName === 'INPUT') { filter[f] = e.target.value; var pos = e.target.selectionStart; drawArchive(); var el = host.querySelector('[data-mm-f="q"]'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }
    });
    host.addEventListener('change', function (e) {
      var f = e.target.getAttribute && e.target.getAttribute('data-mm-f');
      if (f && e.target.tagName === 'SELECT') { filter[f] = e.target.value; drawArchive(); }
    });

    async function load() {
      var res = await Promise.all([D().featureAccess(ctx.id), D().listMemories(ctx.id), D().listMeetings(ctx.id)]);
      if (!alive) return;
      var bad = res.find(function (r) { return !r.ok; });
      if (bad) { loadError = bad.message; draw(); return; }
      loadError = null;
      access = res[0].access; memories = res[1].memories; meetings = res[2].meetings;
      urls = await D().memoryImageUrls(memories.map(function (m) { return m.imagePath; }));
      if (!alive) return;
      draw();
    }

    await load();
    var offs = [ctx.on('memory', load)];
    return function cleanup() { alive = false; if (watchTimer) global.clearInterval(watchTimer); offs.forEach(function (off) { off(); }); };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.memories = { render: render };
})(window);
