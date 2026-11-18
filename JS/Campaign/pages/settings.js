/**
 * Campaign Settings: campaign information for everyone; for the Dungeon Master also name, description, cover image,
 * visibility, people needed, the adventure the campaign runs, plan features, archive/restore and delete.
 * Players can read the campaign information and leave the campaign (until it starts).
 *
 * Changes go through FogCampaignStore (the same code the Dashboard's campaign list uses); the database enforces who
 * may change what, so hiding a button here is a convenience and never the protection.
 */
(function (global) {
  'use strict';

  var P = function () { return global.FogCampaignParty; };
  var UI = function () { return global.FogCampaignUI; };
  var S = function () { return global.FogCampaignStore; };
  var SOURCE_NAMES = { homebrew: 'Homebrew campaign', existing: 'Existing (published) adventure' };

  function esc(s) { return UI().esc(s); }

  function card(title, desc, body, cls) {
    return '<section class="form-card cw-legacy-card' + (cls ? ' ' + cls : '') + '"><div class="card-header"><div><h2 class="card-title">' + title + '</h2>' +
      (desc ? '<p class="card-desc">' + desc + '</p>' : '') + '</div></div><div class="card-body">' + body + '</div></section>';
  }

  function infoCard(c, isDm) {
    var dm = c.roster.find(function (m) { return m.role === 'owner'; });
    var row = function (l, v) { return '<div class="cv-info-item"><dt>' + l + '</dt><dd>' + v + '</dd></div>'; };
    return card('Campaign information', 'Details recorded for this campaign.',
      '<dl class="cv-info-grid">' +
      row('Status', esc(P().statusLabel(c))) + row('Dungeon Master', esc(dm ? dm.displayName : '—') + (isDm ? ' (you)' : '')) +
      row('Game system', 'D&amp;D 5e (2024 rules)') + row('Content source', esc(SOURCE_NAMES[c.source] || c.source)) +
      row('Starting level', String(c.startingLevel)) + row('People needed to start', c.requiredPlayers + ' (including the DM)') +
      row('Visibility', c.privacy === 'public' ? 'Open to new players (join by code)' : 'Private — invite code only') +
      row('Created', esc(P().fmtDateTime(c.createdAt))) + (c.startedAt ? row('Started', esc(P().fmtDateTime(c.startedAt))) : '') + (c.archivedAt ? row('Archived', esc(P().fmtDateTime(c.archivedAt))) : '') +
      '</dl>' + (c.description ? '<h3 class="cv-subheading">Description</h3><p class="cv-description">' + esc(c.description) + '</p>' : ''));
  }

  function settingsCard(c, plan) {
    var ro = c.status === 'archived';
    var dis = ro ? ' disabled' : '';
    var locked = c.phase === 'started';
    var disLock = ro || locked ? ' disabled' : '';
    var maxPeople = Number.isFinite(plan.maxPeople) ? ' max="' + plan.maxPeople + '"' : '';
    var radio = function (value, label, desc) {
      return '<label class="access-option-card"><input type="radio" name="cvPrivacy" value="' + value + '" class="access-radio"' + (c.privacy === value ? ' checked' : '') + dis + '><div class="access-option-content"><div class="access-header"><span class="access-title">' + label + '</span></div><span class="access-desc">' + desc + '</span></div></label>';
    };
    var cover = c.coverUrl ? '<img class="cover-preview" src="' + esc(c.coverUrl) + '" alt="Current cover">' : '<p class="cv-note">No cover image.</p>';
    return card('Edit campaign', ro ? 'This campaign is archived. Restore it to change its settings.' : 'Change these any time.',
      '<form class="cv-settings-form" id="cs-form" novalidate><fieldset' + dis + ' class="cv-fieldset">' +
      '<div class="form-group"><label for="cs-name" class="form-label">Campaign name <span class="required-star">*</span></label><input type="text" id="cs-name" class="form-control" value="' + esc(c.name) + '" maxlength="80" required></div>' +
      '<div class="form-group"><label for="cs-description" class="form-label">Short description</label><textarea id="cs-description" class="form-control form-textarea" rows="3" maxlength="2000">' + esc(c.description) + '</textarea></div>' +
      '<div class="form-row"><div class="form-group col-half"><label for="cs-level" class="form-label">Starting level</label><input type="number" id="cs-level" class="form-control" min="1" max="20" value="' + c.startingLevel + '" required' + disLock + '>' + (locked ? '<span class="cv-note">Locked since the start.</span>' : '') + '</div>' +
      '<div class="form-group col-half"><label for="cs-players" class="form-label">People needed to start (incl. DM)</label><input type="number" id="cs-players" class="form-control" min="' + Math.max(1, c.roster.length) + '"' + maxPeople + ' value="' + c.requiredPlayers + '" required' + disLock + '>' +
      '<span class="cv-note">' + esc(plan.name) + ' plan: up to ' + (Number.isFinite(plan.maxPeople) ? plan.maxPeople : 'unlimited') + ' people.</span></div></div>' +
      '<div class="form-group"><span class="form-label">Visibility</span><div class="access-options-grid">' +
      radio('public', 'Open campaign', 'Marked as open to new players. Players still join with the invite code (there is no public list yet).') +
      radio('private', 'Private campaign', 'Invite-only. Players join with the invite code you share.') + '</div></div>' +
      '<div class="form-group"><span class="form-label">Cover image</span><div class="cv-cover" id="cs-cover">' + cover + '</div><div class="cv-cover-actions"><label class="btn btn-secondary btn-sm">Change cover<input type="file" id="cs-cover-input" accept="image/png,image/jpeg,image/webp,image/gif" hidden' + dis + '></label>' +
      (c.coverUrl ? '<button type="button" class="cv-link-btn" data-cs="remove-cover"' + dis + '>Remove cover</button>' : '') + '</div></div></fieldset>' +
      (ro ? '' : '<div class="form-actions-footer"><button type="submit" class="btn btn-primary">Save settings</button></div>') + '</form>');
  }

  function membersShortcut(c) {
    return card('Members & invitations', 'Who is in the campaign and how people join.',
      '<p>' + c.roster.length + ' of ' + c.requiredPlayers + ' people have joined.' + (c.phase === 'recruiting' && c.status === 'active' ? ' Invite code: <span class="cv-code">' + esc(c.inviteCode) + '</span>' : '') + '</p><a class="btn btn-secondary btn-sm" href="#members">Manage members</a>');
  }

  function lockCard(c, isDm) {
    if (c.phase !== 'started') return '';
    return card('Locked since the start', 'The campaign started ' + esc(P().fmtDateTime(c.startedAt)) + '. These can no longer be changed in the ordinary way, so nothing shifts under the players.',
      '<ul class="cw-plain-list"><li><strong>The adventure</strong> this campaign runs</li><li><strong>The party and their characters</strong> (no replacing, no removing)</li><li><strong>The starting setup</strong>: starting level, people needed, content source</li></ul>' +
      '<p class="cv-note">Still allowed: meetings, recaps, combat, name, description, cover and visibility, and characters gaining <strong>one level at a time</strong> (Characters → "Record level-up").</p>' +
      '<p class="cv-note">A mistake in the setup can be corrected by the Dungeon Master with a written reason. Every correction is saved in the campaign history for everyone to see.</p>' +
      (isDm && c.status === 'active' ? '<button type="button" class="btn btn-secondary btn-sm" data-cs="override-level">Correct the starting level…</button>' : ''), 'cw-lock-card');
  }

  function adventureCard() {
    return card('Adventure', 'Every campaign runs one of your adventures. It stays in Adventures, private to you; players never see it (only what you share from Campaign Content).',
      '<div id="cs-adventure" class="cv-adventure"><p class="cv-note">Loading your adventures…</p></div>', 'cv-adventure-card');
  }

  function featuresCard(plan) {
    var rows = [
      ['Meetings', 'Schedule sessions and run availability polls; the best times are worked out for you and everyone confirms.'],
      ['Meeting in the Fog', 'Voice and video for the campaign\'s members, opened by the Dungeon Master from the Campaign Feed.'],
      ['Music', 'The shared music player; in Meeting in the Fog the Dungeon Master can share what is playing.'],
      ['Combat', 'An encounter tracker with initiative, conditions and dice.'],
      ['Foggy', 'Campaign Foggy, the writing helper for this campaign, comes with the Dungeon Master plan.'],
    ];
    return card('Plan & features', 'The ' + esc(plan.name) + ' plan allows ' + (Number.isFinite(plan.activeCampaigns) ? plan.activeCampaigns : 'unlimited') + ' active campaign' + (plan.activeCampaigns === 1 ? '' : 's') + ' that you run and ' + (Number.isFinite(plan.maxPeople) ? 'up to ' + plan.maxPeople : 'any number of') + ' people per campaign.',
      '<ul class="cw-plain-list">' + rows.map(function (r) { return '<li><strong>' + r[0] + ':</strong> ' + r[1] + '</li>'; }).join('') + '</ul>' +
      '<p class="cv-note">Plans are managed on the Upgrade page of the Dashboard.</p>');
  }

  function actionsCard(c, isDm) {
    if (!isDm) {
      return c.phase === 'recruiting'
        ? card('Leave campaign', 'You can leave until the campaign starts.', '<button type="button" class="btn btn-danger-outline" data-cs="leave">Leave campaign</button>')
        : card('Leave campaign', 'The party is locked, so players can\'t leave once a campaign has started.', '');
    }
    var archived = c.status === 'archived';
    return card(archived ? 'Archive' : 'Campaign actions', archived ? 'Archived campaigns keep their info, party and history but don\'t use an active campaign slot.' : 'Archiving frees an active campaign slot and keeps everything about the campaign.',
      '<div class="cv-actions">' + (archived ? '<button type="button" class="btn btn-primary" data-cs="restore">Restore campaign</button>' : '<button type="button" class="btn btn-secondary" data-cs="archive">Archive campaign</button>') +
      '<button type="button" class="btn btn-danger-outline" data-cs="delete">Delete campaign</button></div>');
  }

  function render(host, ctx) {
    var alive = true;
    var busy = false;
    var pendingCover; // undefined = unchanged, null = removed, string = new data URL
    host.innerHTML = '<div class="cw-page cw-settings"><header class="cw-page-head"><div><h2 class="cw-page-title">Campaign Settings</h2>' +
      '<p class="cw-page-sub">' + (ctx.isDm ? 'Manage this campaign. Only you, its Dungeon Master, can change these.' : 'Information about this campaign.') + '</p></div></header>' +
      '<div class="create-campaign-wrapper campaign-view-page cw-legacy"><p class="create-campaign-message" id="cs-message" role="status" hidden></p><div id="cs-body"></div></div></div>';
    var body = host.querySelector('#cs-body');
    var message = host.querySelector('#cs-message');
    function say(t) { message.textContent = t; message.hidden = !t; }

    function draw() {
      if (!alive) return;
      var c = ctx.campaign;
      var plan = S().plan();
      body.innerHTML = lockCard(c, ctx.isDm) + infoCard(c, ctx.isDm) + (ctx.isDm ? settingsCard(c, plan) + membersShortcut(c) + adventureCard() + featuresCard(plan) : '') + actionsCard(c, ctx.isDm);
      pendingCover = undefined;
      if (ctx.isDm) fillAdventure(c);
    }

    async function fillAdventure(c) {
      var res = await global.FogAdventureStore.list();
      var el = host.querySelector('#cs-adventure');
      if (!alive || !el || ctx.campaign !== c) return;
      if (!res.ok) { el.innerHTML = '<p class="cv-note">' + esc(res.message) + '</p>'; return; }
      var linked = res.adventures.find(function (a) { return a.id === c.adventureId; });
      var choices = res.adventures.filter(function (a) { return a.status !== 'archived' || a.id === c.adventureId; });
      var ro = c.status === 'archived';
      if (c.phase === 'started') {
        el.innerHTML = (linked ? '<p class="cv-adventure-linked"><strong>' + esc(linked.title) + '</strong> <span class="cv-note">' + linked.chapterCount + ' chapters · ' + linked.sectionCount + ' sections · locked since the start</span> <a href="#content">Open Adventures</a></p>' : '<p class="cv-banner">The adventure this campaign used no longer exists.</p>') +
          (ro ? '' : '<p class="cv-note">The adventure can\'t be switched once the campaign has started.</p><button type="button" class="btn btn-secondary btn-sm" data-cs="override-adventure">Correct a mistake…</button>');
        return;
      }
      el.innerHTML = (linked
        ? '<p class="cv-adventure-linked"><strong>' + esc(linked.title) + '</strong> <span class="cv-note">' + linked.chapterCount + ' chapters · ' + linked.sectionCount + ' sections</span> <a href="#content">Open Adventures</a> · <a href="' + esc(ctx.dashboardUrl('#adventures/' + linked.id)) + '">Open in editor</a></p>'
        : '<p class="cv-banner"><strong>Choose an adventure.</strong> ' + (c.adventureId ? 'The adventure this campaign used no longer exists.' : 'This campaign has no adventure yet.') + ' It can\'t start until it has one.</p>') +
        (ro ? '' : (choices.length
          ? '<div class="cv-adventure-pick"><select class="form-control" id="cs-adventure-select" aria-label="Adventure">' + (linked ? '' : '<option value="">Choose an adventure…</option>') + choices.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === c.adventureId ? ' selected' : '') + '>' + esc(a.title) + '</option>'; }).join('') + '</select> <button type="button" class="btn btn-secondary btn-sm" data-cs="set-adventure">' + (linked ? 'Switch adventure' : 'Use this adventure') + '</button></div>'
          : '<p class="cv-note">You have no adventures yet. <a href="' + esc(ctx.dashboardUrl('#adventures')) + '">Write one in Adventures</a>.</p>'));
    }

    async function run(fn, okText) {
      if (busy) return;
      busy = true;
      say('Working…');
      try {
        var res = await fn();
        if (!alive) return;
        if (res && !res.ok) { say(res.message); return; }
        say(okText || '');
        await ctx.reload();
        draw();
      } finally { busy = false; }
    }

    host.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-cs]');
      if (!b) return;
      var c = ctx.campaign;
      var a = b.getAttribute('data-cs');
      if (a === 'set-adventure') {
        var pick = host.querySelector('#cs-adventure-select');
        if (!pick || !pick.value) { say('Choose one of your adventures first.'); return; }
        if (pick.value === c.adventureId) { say('That adventure is already used by this campaign.'); return; }
        var ok = await UI().confirm({ title: 'Switch adventure?', message: 'The campaign will run the selected adventure instead. Progress you recorded in Adventures refers to the old adventure\'s sections.', confirmLabel: 'Switch' });
        if (ok) run(function () { return S().setAdventure(c.id, pick.value); }, 'This campaign now runs the selected adventure.');
      } else if (a === 'override-adventure') {
        var lres = await global.FogAdventureStore.list();
        var opts = lres.ok ? lres.adventures.filter(function (x) { return x.status !== 'archived' && x.id !== c.adventureId; }) : [];
        if (!opts.length) { say(lres.ok ? 'You have no other adventure to switch to.' : lres.message); return; }
        var ans = await UI().reasonDialog({ title: 'Switch the campaign\'s adventure', message: 'The campaign has started, so the adventure is normally locked. Choose the adventure it should run from now on. Progress you recorded refers to the old adventure\'s sections.',
          extraHtml: '<label class="cw-field"><span>New adventure</span><select class="form-control" name="adv">' + opts.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.title) + '</option>'; }).join('') + '</select></label>' });
        if (ans) run(function () { return S().overrideLock(c.id, 'set_adventure', { adventure_id: ans.form.adv.value }, ans.reason); }, 'The adventure was changed and the correction is in the campaign history.');
      } else if (a === 'override-level') {
        var an2 = await UI().reasonDialog({ title: 'Correct the starting level', message: 'Only for a mistake in the setup: this does not change any character\'s level.',
          extraHtml: '<label class="cw-field"><span>Starting level</span><input class="form-control" type="number" min="1" max="20" name="lvl" value="' + c.startingLevel + '"></label>' });
        if (an2) run(function () { return S().overrideLock(c.id, 'set_starting_level', { level: Number(an2.form.lvl.value) }, an2.reason); }, 'The starting level was corrected and the correction is in the campaign history.');
      } else if (a === 'archive') {
        var okA = await UI().confirm({ title: 'Archive "' + c.name + '"?', message: 'It becomes read-only and frees an active campaign slot. You can restore it later.', confirmLabel: 'Archive' });
        if (okA) run(function () { return S().archive(c.id); }, 'Campaign archived. Its info, party and history are kept.');
      } else if (a === 'restore') run(function () { return S().restore(c.id); }, 'Campaign restored.');
      else if (a === 'delete') {
        var okD = await UI().confirm({ title: 'Delete "' + c.name + '" for everyone?', message: 'The campaign, its party, messages, meetings and encounter are removed for every member. This can\'t be undone. (Archive it instead to keep everything.)', confirmLabel: 'Delete forever', danger: true, requireText: c.name });
        if (!okD) return;
        var res = await S().remove(c.id);
        if (!res.ok) say(res.message); else global.location.href = ctx.dashboardUrl('#campaigns');
      } else if (a === 'leave') {
        var okL = await UI().confirm({ title: 'Leave "' + c.name + '"?', message: 'You can rejoin with the invite code while there is room.', confirmLabel: 'Leave campaign', danger: true });
        if (!okL) return;
        var r = await S().removeMember(c.id, ctx.me.id);
        if (!r.ok) say(r.message); else global.location.href = ctx.dashboardUrl('#campaigns');
      } else if (a === 'remove-cover') {
        pendingCover = null;
        host.querySelector('#cs-cover').innerHTML = '<p class="cv-note">Cover will be removed when you save.</p>';
      }
    });

    host.addEventListener('change', function (e) {
      if (e.target.id !== 'cs-cover-input' || !e.target.files[0]) return;
      S().compressCover(e.target.files[0]).then(function (url) {
        pendingCover = url;
        host.querySelector('#cs-cover').innerHTML = '<img class="cover-preview" src="' + url + '" alt="New cover (not saved yet)">';
        say('New cover selected. Save settings to keep it.');
      }).catch(function (err) { say(err.message); });
    });

    host.addEventListener('submit', function (e) {
      if (e.target.id !== 'cs-form') return;
      e.preventDefault();
      var f = e.target;
      if (!f.reportValidity()) return;
      var patch = {
        name: f.querySelector('#cs-name').value, description: f.querySelector('#cs-description').value,
        startingLevel: f.querySelector('#cs-level').value, requiredPlayers: f.querySelector('#cs-players').value,
        privacy: f.querySelector('[name="cvPrivacy"]:checked').value,
      };
      if (pendingCover !== undefined) patch.coverDataUrl = pendingCover;
      run(function () { return S().update(ctx.id, patch); }, 'Settings saved.');
    });

    draw();
    var off = ctx.on('campaign', function () { if (!busy) draw(); });
    return function cleanup() { alive = false; off(); };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.settings = { render: render };
})(window);
