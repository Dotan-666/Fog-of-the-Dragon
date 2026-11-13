/**
 * Availability scheduler (the "Availability polls" tab of Meetings).
 *
 * The DM asks the party when they can play; everyone answers per time slot (available / prefer / possibly / unavailable),
 * says whether they can host in person (the address stays private to the host until they agree to share it AND the DM
 * proposes them), and may suggest another format. When every required person is available for a slot, the DM proposes ONE
 * final option; nothing is scheduled until every person has confirmed that exact proposal. The database enforces all of
 * this (see migration 20261113120000_campaign_refinements.sql); this file only presents it.
 *
 * Formats: In person · Meeting in the Fog (the "online" format: voice and video inside the campaign, opened by the DM from
 * the Campaign Feed; no link is created, needed or generated) · Either. A link a DM saved before this change still works.
 * See migration 20261118120300_meeting_in_the_fog.sql.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  var M = function () { return global.FogScheduleModel; };
  var P = function () { return global.FogCampaignParty; };

  var FORMAT_LABEL = { in_person: 'In person', online: 'Meeting in the Fog', either: 'Either (in person or Meeting in the Fog)' };
  // google_meet is an older answer: shown as Meeting in the Fog, never offered again.
  var SUGGEST_LABEL = { in_person: 'Meet in person somewhere else', online: 'Meet in the Fog (video in the campaign)', google_meet: 'Meet in the Fog (video in the campaign)' };
  var SUGGEST_OPTIONS = ['in_person', 'online'];
  var MARK = { available: '✓', preferred: '★', maybe: '?', unavailable: '✗', none: '–' };

  function esc(s) { return UI().esc(s); }
  function slotLabel(slot) {
    var s = new Date(slot.start);
    var e = new Date(slot.end);
    return s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' +
      s.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + '–' + e.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function dateTimeLabel(iso) { return new Date(iso).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  function render(host, ctx, hooks) {
    var alive = true;
    var campaignId = ctx.id;
    var isDm = ctx.isDm;
    var archived = ctx.campaign.status === 'archived';
    var schedules = [];
    var error = null;
    var selected = hooks && hooks.selected;
    // A confirmation can create the real meeting: tell the Meetings page so its lists are current.
    function changed() { if (hooks && typeof hooks.onChanged === 'function') hooks.onChanged(); }

    host.innerHTML = '<div class="cw-sched"><div class="cw-sched-head"><p class="cw-muted">Ask the party for their availability. A meeting is only scheduled when everyone agrees on the same time and format and confirms it.</p>' +
      (isDm && !archived ? '<button type="button" class="btn btn-primary btn-sm" data-sc="new">Ask for availability</button>' : '') + '</div><div id="sc-list"></div></div>';
    var list = host.querySelector('#sc-list');

    function nameOf(uid) {
      var m = ctx.campaign.roster.find(function (x) { return x.userId === uid; });
      return m ? (m.isMe ? 'You' : m.displayName) : 'Former member';
    }

    // ---- Cards ------------------------------------------------------------------------------------------------
    function responders(r) {
      return '<ul class="cw-resp-list" aria-label="Who has answered">' + r.required.map(function (u) {
        var done = r.responses.some(function (x) { return x.userId === u; });
        var conf = r.status === 'awaiting_confirmation' || r.status === 'confirmed' ? r.confirmations.some(function (c) { return c.userId === u && c.version === (r.proposal && r.proposal.version); }) || r.status === 'confirmed' : null;
        return '<li class="' + (done ? 'is-done' : '') + '"><span aria-hidden="true">' + (done ? '✓' : '…') + '</span> ' + esc(nameOf(u)) +
          (conf === true ? ' <span class="cw-pill cw-pill-yes">Confirmed</span>' : conf === false ? ' <span class="cw-pill cw-pill-none">Not confirmed yet</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }

    function matrix(r, an) {
      return '<div class="cw-matrix-wrap"><table class="cw-matrix"><caption class="cw-visually-hidden">Availability of each person for each time slot</caption><thead><tr><th scope="col">Time</th>' +
        r.required.map(function (u) { return '<th scope="col">' + esc(nameOf(u)) + '</th>'; }).join('') + '<th scope="col">Everyone?</th></tr></thead><tbody>' +
        an.slots.map(function (s) {
          return '<tr class="' + (s.unanimous ? 'is-unanimous' : '') + '"><th scope="row">' + esc(slotLabel(s.slot)) + '</th>' + r.required.map(function (u) {
            var a = r.responses.some(function (x) { return x.userId === u; }) ? (r.responses.find(function (x) { return x.userId === u; }).availability[s.slot.id] || 'unavailable') : 'none';
            return '<td class="cw-m cw-m-' + a + '" title="' + esc(M().ANSWER_LABEL[a] || 'No answer yet') + '"><span aria-hidden="true">' + MARK[a] + '</span><span class="cw-visually-hidden">' + esc(M().ANSWER_LABEL[a] || 'No answer yet') + '</span></td>';
          }).join('') + '<td>' + (s.unanimous ? '<strong class="cw-ok">Yes</strong>' : s.yes + ' of ' + s.total) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="cw-muted cw-fine">✓ available · ★ prefer · ? possibly (not counted as a yes) · ✗ unavailable · – no answer yet</p>';
    }

    function answerForm(r) {
      var mine = r.responses.find(function (x) { return x.userId === ctx.me.id; }) || { availability: {}, canHost: false, hostNote: '', suggestFormat: '', suggestion: '' };
      var myHost = r.hosts.find(function (h) { return h.userId === ctx.me.id; });
      var rows = r.slots.map(function (s) {
        var cur = mine.availability[s.id] || '';
        return '<div class="cw-answer-row" role="radiogroup" aria-label="' + esc(slotLabel(s)) + '"><span class="cw-answer-slot">' + esc(slotLabel(s)) + '</span><span class="cw-answer-opts">' +
          M().ANSWERS.map(function (a) { return '<label class="cw-opt cw-opt-' + a + '"><input type="radio" name="av-' + esc(s.id) + '" value="' + a + '"' + (cur === a ? ' checked' : '') + '><span>' + esc(M().ANSWER_LABEL[a]) + '</span></label>'; }).join('') + '</span></div>';
      }).join('');
      var hostBlock = r.format === 'online' ? '' :
        '<fieldset class="cw-fieldset"><legend>Hosting</legend><label class="cw-check"><input type="checkbox" name="canHost"' + (mine.canHost ? ' checked' : '') + '> I can host an in-person session</label>' +
        '<div class="cw-host-fields"' + (mine.canHost ? '' : ' hidden') + '><label class="cw-field"><span>Location or address (private)</span><input class="form-control" name="hostLocation" maxlength="200" value="' + esc(myHost ? myHost.location : '') + '" placeholder="Street, city, or a description"></label>' +
        '<label class="cw-check"><input type="checkbox" name="shareLocation"' + (myHost && myHost.share ? ' checked' : '') + '> If I am chosen as the host, share this location with the whole party</label>' +
        '<p class="cw-muted cw-fine">Your address is visible only to you until you tick the box above <em>and</em> the DM proposes you as host. It is never shown to anyone else before that.</p>' +
        '<label class="cw-field"><span>Limitations (optional)</span><input class="form-control" name="hostNote" maxlength="500" value="' + esc(mine.hostNote) + '" placeholder="Pets, stairs, max people, parking…"></label></div></fieldset>';
      return '<form class="cw-answer-form" data-sc-form="answer" data-id="' + esc(r.id) + '" novalidate><h4>Your availability</h4>' +
        '<div class="cw-quick-row"><button type="button" class="cw-mini-btn" data-sc="all-available">Available for all</button><button type="button" class="cw-mini-btn" data-sc="all-unavailable">Unavailable for all</button></div>' + rows + hostBlock +
        '<fieldset class="cw-fieldset"><legend>Another idea? (optional)</legend><label class="cw-field"><span>Suggest a different format</span><select class="form-control" name="suggestFormat"><option value="">No suggestion</option>' +
        SUGGEST_OPTIONS.map(function (k) { return '<option value="' + k + '"' + (mine.suggestFormat === k || (k === 'online' && mine.suggestFormat === 'google_meet') ? ' selected' : '') + '>' + esc(SUGGEST_LABEL[k]) + '</option>'; }).join('') + '</select></label>' +
        '<label class="cw-field"><span>Alternative date, time or place</span><textarea class="form-control" name="suggestion" rows="2" maxlength="1000" placeholder="e.g. Sunday afternoon works better for me">' + esc(mine.suggestion) + '</textarea></label></fieldset>' +
        '<p class="cw-form-error" role="alert" hidden></p><button type="submit" class="btn btn-primary btn-sm">' + (r.responses.some(function (x) { return x.userId === ctx.me.id; }) ? 'Update my availability' : 'Send my availability') + '</button></form>';
    }

    function proposalPanel(r, an) {
      // The DM can't read other people's private addresses, so eligibility is "said they can host"; the database re-checks consent.
      var canHostUsers = r.responses.filter(function (x) { return x.canHost; }).map(function (x) { return x.userId; });
      var opts = an.unanimous.map(function (s) { return '<option value="' + esc(s.slot.id) + '">' + esc(slotLabel(s.slot)) + '</option>'; }).join('');
      if (!an.unanimous.length) {
        return '<div class="cw-banner"><strong>No time works for everyone.</strong> Nobody is left out to force an agreement. Closest options:<ul>' + an.closest.map(function (s) {
          var missing = s.by.unavailable.concat(s.by.maybe, s.by.none).map(nameOf);
          return '<li>' + esc(slotLabel(s.slot)) + ': ' + s.yes + ' of ' + s.total + ' available (' + esc(missing.join(', ')) + ' not a clear yes)</li>';
        }).join('') + '</ul>' + (isDm && !archived ? '<button type="button" class="btn btn-secondary btn-sm" data-sc="reopen" data-id="' + esc(r.id) + '">Start another round</button>' : '<p class="cw-muted">The DM can start another round.</p>') + '</div>';
      }
      if (!isDm) return '<div class="cw-banner is-ok"><strong>' + an.unanimous.length + ' time' + (an.unanimous.length === 1 ? '' : 's') + ' work for everyone.</strong> Waiting for the DM to propose the final one.</div>';
      if (archived) return '';
      var formats = r.format === 'either' ? ['in_person', 'online'] : [r.format];
      return '<form class="cw-propose" data-sc-form="propose" data-id="' + esc(r.id) + '" novalidate><h4>' + (r.status === 'awaiting_confirmation' ? 'Change the proposal' : 'Propose the final meeting') + '</h4><p class="cw-muted">' + (r.status === 'awaiting_confirmation' ? 'Everyone will have to confirm again. ' : '') + an.unanimous.length + ' time' + (an.unanimous.length === 1 ? ' works' : 's work') + ' for everyone. This only asks everyone to confirm; nothing is scheduled yet.</p>' +
        '<label class="cw-field"><span>Time</span><select class="form-control" name="slot">' + opts + '</select></label>' +
        '<div class="cw-field"><span>Format</span><div class="cw-opts-inline">' + formats.map(function (f, i) { return '<label class="cw-check"><input type="radio" name="format" value="' + f + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(FORMAT_LABEL[f]) + '</label>'; }).join('') + '</div></div>' +
        '<div data-sc-part="in_person"' + (formats[0] === 'in_person' ? '' : ' hidden') + '><label class="cw-field"><span>Host (only people who can host and agreed to share their location can be chosen)</span><select class="form-control" name="host"><option value="">Choose a host…</option>' +
        canHostUsers.map(function (u) { return '<option value="' + esc(u) + '">' + esc(nameOf(u)) + '</option>'; }).join('') + '</select></label>' +
        (canHostUsers.length ? '' : '<p class="cw-muted cw-fine">Nobody has offered to host yet.</p>') + '</div>' +
        '<div data-sc-part="online"' + (formats[0] === 'online' ? '' : ' hidden') + '><p class="cw-muted cw-fine">Meeting in the Fog: voice and video inside this campaign. You open the room at meeting time from the Campaign Feed and everyone gets a Join button. No link to create or share.</p></div>' +
        '<p class="cw-form-error" role="alert" hidden></p><button type="submit" class="btn btn-primary btn-sm">Ask everyone to confirm</button></form>';
    }

    /** The database's ranked options (made when everyone answered or the deadline passed). */
    function suggestionsBlock(r) {
      if (!r.suggestions || !r.suggestions.length) return '';
      var dmId = r.createdBy;
      return '<section class="cw-suggest" aria-label="Suggested times"><h4>Suggested times <span class="cw-muted">ranked by who can come' + (r.durationMinutes ? ', for a ' + (r.durationMinutes / 60) + '-hour meeting' : '') + '</span></h4><ol class="cw-suggest-list">' +
        r.suggestions.map(function (s, i) {
          var who = s.everyone ? '<strong class="cw-ok">Everyone can come (' + s.yes + '/' + s.total + ')</strong>' : '<strong>' + s.yes + ' of ' + s.total + ' can come</strong> <span class="cw-muted">· not a clear yes: ' + esc(s.missing.map(nameOf).join(', ')) + '</span>';
          var fmt = s.format === 'in_person' ? 'In person' + (s.hosts.length ? ', host: ' + esc(s.hosts.map(nameOf).join(' or ')) : '') : 'Meeting in the Fog';
          var others = s.missing.filter(function (u) { return u !== dmId; });
          var act = isDm && !archived && r.status === 'consensus' ? '<button type="button" class="btn btn-' + (i === 0 ? 'primary' : 'secondary') + ' btn-sm" data-sc="use-sugg" data-id="' + esc(r.id) + '" data-i="' + i + '">' + (!others.length ? 'Propose this' : 'Propose without ' + esc(others.map(nameOf).join(', '))) + '</button>' : '';
          return '<li class="cw-suggest-item' + (i === 0 ? ' is-best' : '') + (s.everyone ? ' is-all' : '') + '"><div class="cw-suggest-main"><span class="cw-suggest-when">' + (i === 0 ? '<span class="cw-tag is-now">Best</span> ' : '') + esc(dateTimeLabel(s.start)) + '</span>' + who +
            '<span class="cw-muted">' + fmt + (s.preferred ? ' · ' + s.preferred + ' prefer it' : '') + (s.maybe ? ' · ' + s.maybe + ' possibly' : '') + (s.fits ? '' : ' · <span class="cw-warn-text">shorter than the meeting</span>') + '</span></div>' + act + '</li>';
        }).join('') + '</ol>' + (isDm ? '' : '<p class="cw-muted cw-fine">The DM picks one; then everyone confirms it.</p>') + '</section>';
    }
    function proposeDialog(r, s) {
      var without = s.missing.filter(function (u) { return u !== r.createdBy; }); // proposing counts as the DM's own yes
      s = Object.assign({}, s, { everyone: !without.length, missing: without });
      var formats = r.format === 'either' ? (s.format === 'online' ? ['online', 'in_person'] : ['in_person', 'online']) : [r.format];
      var hosts = s.hosts.length ? s.hosts : r.responses.filter(function (x) { return x.canHost; }).map(function (x) { return x.userId; });
      var d = UI().dialog('<form class="cw-dialog-body" novalidate><h2 class="cw-dialog-title">Propose ' + esc(dateTimeLabel(s.start)) + '</h2>' +
        (s.everyone ? '<p>Everyone said they can come. Everyone will be asked to confirm this exact time.</p>'
          : '<p class="cw-banner"><strong>Not everyone can come.</strong> ' + esc(s.missing.map(nameOf).join(', ')) + (s.missing.length === 1 ? ' is' : ' are') + ' left out of this meeting and told so; everyone else must confirm. Nobody is removed from the campaign.</p>') +
        '<div class="cw-field"><span>Format</span><div class="cw-opts-inline">' + formats.map(function (f, i) { return '<label class="cw-check"><input type="radio" name="format" value="' + f + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(FORMAT_LABEL[f]) + (f === s.format ? ' (suggested)' : '') + '</label>'; }).join('') + '</div></div>' +
        '<div data-sc-part="in_person"><label class="cw-field"><span>Host</span><select class="form-control" name="host"><option value="">Choose a host…</option>' + hosts.map(function (u) { return '<option value="' + esc(u) + '"' + (s.hosts.length === 1 && s.hosts[0] === u ? ' selected' : '') + '>' + esc(nameOf(u)) + '</option>'; }).join('') + '</select></label></div>' +
        '<div data-sc-part="online"><p class="cw-muted cw-fine">Meeting in the Fog: you open the room at meeting time from the Campaign Feed; everyone gets a Join button. No link needed.</p></div>' +
        '<p class="cw-form-error" role="alert" hidden></p><div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Cancel</button><button type="submit" class="btn btn-primary btn-sm">Ask everyone to confirm</button></div></form>', { label: 'Propose a time' });
      var f = d.el.querySelector('form');
      var show = function () { var v = f.querySelector('[name=format]:checked').value; f.querySelector('[data-sc-part="in_person"]').hidden = v !== 'in_person'; f.querySelector('[data-sc-part="online"]').hidden = v !== 'online'; };
      show();
      f.addEventListener('change', show);
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fmt = f.querySelector('[name=format]:checked').value;
        var res = await D().proposeScheduleOption(r.id, { slotId: s.slotId, format: fmt, hostId: fmt === 'in_person' ? f.host.value : null, link: null, linkKind: null, without: s.everyone ? [] : s.missing });
        if (!res.ok) { var er = f.querySelector('.cw-form-error'); er.textContent = res.message; er.hidden = false; return; }
        d.close();
        UI().notice('Sent: ' + (s.everyone ? 'everyone' : 'the others') + ' were asked to confirm.');
        load(); changed();
      });
    }

    function confirmPanel(r) {
      var p = r.proposal;
      var slot = r.slots.find(function (s) { return s.id === p.slot_id; });
      var host = p.host_id ? r.hosts.find(function (h) { return h.userId === p.host_id; }) : null;
      var mineConfirmed = r.confirmations.some(function (c) { return c.userId === ctx.me.id && c.version === p.version; });
      var required = r.required.indexOf(ctx.me.id) >= 0;
      var where = p.format === 'in_person'
        ? 'In person, hosted by <strong>' + esc(nameOf(p.host_id)) + '</strong>' + (host ? ': ' + esc(host.location) : ' (location not shown)')
        : p.link ? 'Online: <a href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer">' + esc(p.link) + '</a> <span class="cw-pill">Link entered by hand</span>'
          : '<strong>Meeting in the Fog</strong>: voice and video in this campaign. Join from the Campaign Feed when the DM opens the room.';
      return '<div class="cw-proposal"><h4>Final proposal' + (p.auto ? ' <span class="cw-pill cw-pill-role">Proposed automatically</span>' : '') + '</h4><p class="cw-proposal-when">' + esc(dateTimeLabel(slot.start)) + (r.durationMinutes ? ' · ' + r.durationMinutes + ' min' : ' – ' + new Date(slot.end).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })) + '</p><p>' + where + '</p>' +
        (required && !archived ? (mineConfirmed
          ? '<p class="cw-ok"><strong>You confirmed.</strong> Waiting for the others.</p>'
          : '<div class="cw-actions"><button type="button" class="btn btn-primary btn-sm" data-sc="confirm" data-id="' + esc(r.id) + '" data-version="' + p.version + '" data-slot="' + esc(p.slot_id) + '">Confirm this exact time</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-sc="decline" data-id="' + esc(r.id) + '">I can’t make it</button></div>') : '') +
        '<p class="cw-muted cw-fine">The meeting is created only when all ' + r.required.length + ' people have confirmed this exact proposal. If the DM changes it, everyone must confirm again.</p></div>';
    }

    /** Where the request is, step by step, and what happens next by itself. */
    function progress(r, status, an) {
      var confirmed = r.proposal ? r.confirmations.filter(function (c) { return c.version === r.proposal.version; }).length : 0;
      var steps = [
        { key: 'ask', label: 'Asked', done: r.status !== 'draft' },
        { key: 'answers', label: 'Answers ' + an.answered.length + '/' + r.required.length, done: ['consensus', 'awaiting_confirmation', 'confirmed'].indexOf(status) >= 0 },
        { key: 'proposal', label: r.proposal && r.proposal.auto ? 'Best time proposed automatically' : 'Time proposed', done: ['awaiting_confirmation', 'confirmed'].indexOf(status) >= 0 },
        { key: 'confirm', label: 'Confirmed ' + (status === 'confirmed' ? r.required.length : confirmed) + '/' + r.required.length, done: status === 'confirmed' },
        { key: 'meeting', label: 'Meeting created', done: status === 'confirmed' },
      ];
      var current = steps.findIndex(function (s) { return !s.done; });
      var next = '';
      if (status === 'waiting' && r.due && new Date(r.due) < new Date()) next = 'The deadline has passed. The server is working out the best times from the answers it has (within a few minutes); the DM will be notified.';
      else if (status === 'waiting') next = r.autoPropose ? 'When everyone has answered, the best time for all of you is proposed automatically.' : 'When everyone has answered' + (r.due ? ' or the deadline passes' : '') + ', the best times are worked out automatically and the DM is told.';
      else if (status === 'consensus' && r.answersClosed) next = 'Answers closed at the deadline (' + an.answered.length + ' of ' + r.required.length + ' answered). The DM picks one of the suggested times.';
      else if (status === 'consensus') next = an.unanimous.length ? (r.autoPropose ? 'Automatic proposal needs the DM: choose the host below.' : 'The DM chooses one of the times that work for everyone.') : 'No time works for everyone: the DM can start another round.';
      else if (status === 'awaiting_confirmation') next = 'Everyone confirms the same time; the meeting is created by itself after the last confirmation.';
      var stepsHtml = '<ol class="cw-steps" aria-label="Progress">' + steps.map(function (s, i) {
        var cls = s.done ? 'is-done' : i === current && ['cancelled', 'expired'].indexOf(status) < 0 ? 'is-now' : '';
        return '<li class="' + cls + '"' + (i === current ? ' aria-current="step"' : '') + '><span class="cw-step-dot" aria-hidden="true">' + (s.done ? '✓' : i + 1) + '</span><span>' + esc(s.label) + '</span></li>';
      }).join('') + '</ol>';
      var auto = '<p class="cw-auto-line"><span class="cw-pill ' + (r.autoPropose ? 'cw-pill-role' : 'cw-pill-none') + '">' + (r.autoPropose ? 'Automatic proposal on' : 'Automatic proposal off') + '</span> ' +
        (next ? '<span class="cw-muted">' + esc(next) + '</span>' : '') +
        (isDm && !archived && ['draft', 'waiting', 'consensus'].indexOf(r.status) >= 0 ? ' <button type="button" class="cv-link-btn" data-sc="automation" data-id="' + esc(r.id) + '">' + (r.autoPropose ? 'Change' : 'Turn on') + '</button>' : '') + '</p>';
      return stepsHtml + auto;
    }

    function card(r) {
      var status = M().effectiveStatus(r);
      var an = M().analyze(r, r.responses);
      var required = r.required.indexOf(ctx.me.id) >= 0;
      var open = M().isOpenForAnswers(Object.assign({}, r, { status: r.status }));
      var body = '';
      if (r.status === 'draft') body = progress(r, status, an) + '<p class="cw-muted">Only you can see this draft.</p>';
      else {
        if (['cancelled', 'expired'].indexOf(status) < 0) body += progress(r, status, an);
        body += responders(r);
        if (open && required && !archived) body += answerForm(r);
        else if (open && !required) body += '<p class="cw-muted">You joined after this request was sent, so it isn’t waiting for your answer.</p>';
        if (r.responses.length) body += matrix(r, an);
        var sugg = r.responses.filter(function (x) { return x.suggestFormat || x.suggestion; });
        if (sugg.length) body += '<div class="cw-sugg"><h4>Suggestions</h4><ul>' + sugg.map(function (x) { return '<li><strong>' + esc(nameOf(x.userId)) + ':</strong> ' + (x.suggestFormat ? esc(SUGGEST_LABEL[x.suggestFormat]) + (x.suggestion ? '. ' : '') : '') + esc(x.suggestion) + '</li>'; }).join('') + '</ul></div>';
        var hostsInfo = r.responses.filter(function (x) { return x.canHost; });
        if (hostsInfo.length) body += '<p class="cw-muted cw-fine">Can host: ' + hostsInfo.map(function (x) { return esc(nameOf(x.userId)) + (x.hostNote ? ' (' + esc(x.hostNote) + ')' : ''); }).join(', ') + '. Addresses stay private until shared.</p>';
        if (status === 'awaiting_confirmation' && r.proposal) body += confirmPanel(r);
        if (status === 'consensus') body += suggestionsBlock(r);
        if ((r.excludedUsers || []).length) body += '<p class="cw-muted cw-fine">Not needed for this meeting: ' + esc(r.excludedUsers.map(nameOf).join(', ')) + '.</p>';
        if (status === 'consensus' || (status === 'awaiting_confirmation' && isDm)) body += proposalPanel(r, an);
        if (status === 'confirmed') body += '<p class="cw-ok"><strong>Confirmed by everyone.</strong> <a href="#meetings/' + esc(r.meetingId || '') + '">See the meeting</a></p>';
        if (status === 'waiting' && an.waiting.length) body += '<p class="cw-muted">Waiting for ' + an.waiting.map(function (u) { return esc(nameOf(u)); }).join(', ') + '.</p>';
        if (status === 'expired' || status === 'cancelled') body += '<p class="cw-muted">This request is ' + (status === 'expired' ? 'past its deadline' : 'cancelled') + '.</p>';
      }
      var actions = [];
      if (isDm && !archived) {
        if (r.status === 'draft') actions.push('<button type="button" class="btn btn-primary btn-sm" data-sc="publish" data-id="' + esc(r.id) + '">Send to the party</button>');
        if (['draft', 'waiting', 'consensus', 'awaiting_confirmation'].indexOf(r.status) >= 0) actions.push('<button type="button" class="cv-link-btn cv-danger" data-sc="cancel" data-id="' + esc(r.id) + '">Cancel request</button>');
        if (['consensus', 'awaiting_confirmation', 'cancelled', 'expired'].indexOf(status) >= 0 && r.status !== 'draft') actions.push('<button type="button" class="btn btn-secondary btn-sm" data-sc="reopen" data-id="' + esc(r.id) + '">Start another round</button>');
      }
      return '<article class="cw-card cw-sched-card' + (r.id === selected ? ' is-selected' : '') + '" id="sc-' + esc(r.id) + '"><header class="cw-meeting-head"><div><h3>' + esc(r.title) + '</h3>' +
        '<p class="cw-muted">' + esc(FORMAT_LABEL[r.format]) + (r.durationMinutes ? ' · ' + r.durationMinutes + ' min' : '') + ' · round ' + r.round + (r.due ? ' · answer by ' + esc(new Date(r.due).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) : '') + '</p></div>' +
        '<span class="cw-pill cw-pill-' + (status === 'confirmed' ? 'done' : status === 'cancelled' || status === 'expired' ? 'cancelled' : status === 'draft' ? 'none' : 'warn') + '">' + esc(M().STATE_LABEL[status]) + '</span></header>' +
        (r.notes ? '<p class="cw-description">' + esc(r.notes) + '</p>' : '') + body + (actions.length ? '<div class="cw-actions">' + actions.join('') + '</div>' : '') + '</article>';
    }

    function draw() {
      if (!alive) return;
      if (error) { list.innerHTML = '<div class="cw-empty"><p>' + esc(error) + '</p><button type="button" class="btn btn-secondary btn-sm" data-sc="retry">Try again</button></div>'; return; }
      if (!schedules.length) {
        list.innerHTML = '<div class="cw-empty cw-empty-lg"><h3>No availability requests</h3><p>' + (isDm ? (archived ? 'This campaign is archived.' : 'Ask the party when they can play. Everyone answers once and the best time shows itself.') : 'When the Dungeon Master asks for your availability, it appears here (you also get a notification).') + '</p></div>';
        return;
      }
      list.innerHTML = '<div class="cw-stack">' + schedules.map(card).join('') + '</div>';
    }

    var dirtyForm = false;
    async function load(keepForms) {
      var res = await D().listSchedules(campaignId);
      if (!alive) return;
      if (!res.ok) { error = res.message; draw(); return; }
      error = null;
      // Don't wipe an answer someone is typing when a live update arrives.
      if (keepForms && dirtyForm) { schedules = res.schedules; return; }
      schedules = res.schedules;
      draw();
      if (selected) { var el = host.querySelector('#sc-' + selected); if (el) el.scrollIntoView({ block: 'center' }); }
    }

    // ---- Create dialog ------------------------------------------------------------------------------------------
    function createDialog() {
      var today = new Date();
      var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      var from = new Date(today.getTime() + 2 * 86400000);
      var to = new Date(today.getTime() + 15 * 86400000);
      var d = UI().dialog('<form class="cw-dialog-body" novalidate><h2 class="cw-dialog-title">Ask for availability</h2>' +
        '<label class="cw-field"><span>Title</span><input class="form-control" name="title" maxlength="120" required placeholder="Session 5: when can we play?"></label>' +
        '<div class="cw-field-row"><label class="cw-field"><span>From</span><input class="form-control" type="date" name="from" value="' + iso(from) + '"></label><label class="cw-field"><span>To</span><input class="form-control" type="date" name="to" value="' + iso(to) + '"></label></div>' +
        '<fieldset class="cw-fieldset"><legend>Possible dates (untick the ones that are out)</legend><div class="cw-dates" id="sc-dates"></div></fieldset>' +
        '<fieldset class="cw-fieldset"><legend>Time ranges</legend><div class="cw-presets" role="group" aria-label="Quick choices"><button type="button" class="cw-mini-btn" data-sc="preset" data-p="evening">Evenings 18–22</button><button type="button" class="cw-mini-btn" data-sc="preset" data-p="afternoon">Afternoons 14–18</button><button type="button" class="cw-mini-btn" data-sc="preset" data-p="day">Whole day 10–22</button>' +
        '<button type="button" class="cw-mini-btn" data-sc="preset" data-p="weekends">Weekends only</button><button type="button" class="cw-mini-btn" data-sc="preset" data-p="weekdays">Weekdays only</button></div><div id="sc-ranges"></div><button type="button" class="cw-mini-btn" data-sc="add-range">Add a time range</button>' +
        '<p class="cw-muted cw-fine">Every ticked date × time range becomes a possible slot automatically; members just tick when they are free.</p></fieldset>' +
        '<div class="cw-field-row"><label class="cw-field"><span>Meeting length (optional)</span><select class="form-control" name="duration"><option value="">Use the time range</option>' + [60, 90, 120, 180, 240, 300, 360].map(function (m) { return '<option value="' + m + '"' + (m === 180 ? ' selected' : '') + '>' + (m / 60) + ' h</option>'; }).join('') + '</select></label>' +
        '<label class="cw-field"><span>Format</span><select class="form-control" name="format"><option value="either">Either (in person or Meeting in the Fog)</option><option value="in_person">In person</option><option value="online">Meeting in the Fog</option></select></label></div>' +
        '<label class="cw-field"><span>Answer by (optional)</span><input class="form-control" type="datetime-local" name="due"></label>' +
        '<label class="cw-field"><span>Notes (optional)</span><textarea class="form-control" name="notes" rows="2" maxlength="1000"></textarea></label>' +
        '<fieldset class="cw-fieldset"><legend>What happens automatically</legend><p class="cw-muted">Everyone is notified and reminded a day before the deadline. When all have answered (or the deadline passes) the best times are ranked by who can come, a host and format are suggested, and you are notified. You pick one; everyone confirms; the meeting is created after the last confirmation. This runs on the server, even if nobody has the page open.</p>' +
        '<label class="cw-check"><input type="checkbox" name="auto"> Also send the best time for confirmation by itself when it works for everyone (otherwise you pick).</label>' +
        '<p class="cw-muted cw-fine">Meeting in the Fog can always be proposed automatically. In person, only when exactly one person offered to host and agreed to share the location; otherwise you choose. People who haven’t answered get a reminder a day before the deadline.</p></fieldset>' +
        '<p class="cw-muted" id="sc-count"></p><p class="cw-form-error" role="alert" hidden></p>' +
        '<div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Cancel</button><button type="submit" class="btn btn-secondary btn-sm" data-sc-mode="draft">Save as draft</button><button type="submit" class="btn btn-primary btn-sm" data-sc-mode="send">Send to the party</button></div></form>', { label: 'Ask for availability' });
      var f = d.el.querySelector('form');
      var err = f.querySelector('.cw-form-error');
      var ranges = [{ from: '18:00', to: '22:00' }];
      function drawRanges() {
        f.querySelector('#sc-ranges').innerHTML = ranges.map(function (r, i) {
          return '<div class="cw-range"><input type="time" class="form-control" data-range="from" data-i="' + i + '" value="' + r.from + '" aria-label="Start time"> – <input type="time" class="form-control" data-range="to" data-i="' + i + '" value="' + r.to + '" aria-label="End time">' +
            (ranges.length > 1 ? '<button type="button" class="cw-icon-btn" data-sc="del-range" data-i="' + i + '" aria-label="Remove this time range">✕</button>' : '') + '</div>';
        }).join('');
      }
      function drawDates() {
        var keep = {};
        f.querySelectorAll('[data-date]').forEach(function (c) { keep[c.getAttribute('data-date')] = c.checked; });
        var dates = M().datesBetween(f.from.value, f.to.value);
        f.querySelector('#sc-dates').innerHTML = dates.length
          ? dates.map(function (dt) { var lab = new Date(dt + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); return '<label class="cw-datechip"><input type="checkbox" data-date="' + dt + '"' + (keep[dt] === false ? '' : ' checked') + '><span>' + esc(lab) + '</span></label>'; }).join('')
          : '<p class="cw-muted">Choose a start and end date (up to 60 days).</p>';
        count();
      }
      function slots() {
        var dates = [].map.call(f.querySelectorAll('[data-date]:checked'), function (c) { return c.getAttribute('data-date'); });
        return M().buildSlots(dates, ranges);
      }
      function count() { var n = slots().length; f.querySelector('#sc-count').textContent = n + ' possible time slot' + (n === 1 ? '' : 's') + (n > 60 ? ' (the most you can offer is 60)' : ''); }
      drawRanges(); drawDates();
      f.addEventListener('change', function (e) {
        if (e.target.name === 'from' || e.target.name === 'to') drawDates();
        else if (e.target.hasAttribute('data-date')) count();
        else if (e.target.hasAttribute('data-range')) { ranges[Number(e.target.getAttribute('data-i'))][e.target.getAttribute('data-range')] = e.target.value; count(); }
      });
      f.addEventListener('click', function (e) {
        var b = e.target.closest('[data-sc]');
        if (!b) return;
        if (b.getAttribute('data-sc') === 'add-range' && ranges.length < 4) { ranges.push({ from: '14:00', to: '18:00' }); drawRanges(); count(); }
        else if (b.getAttribute('data-sc') === 'preset') {
          var pr = b.getAttribute('data-p');
          if (pr === 'evening') ranges = [{ from: '18:00', to: '22:00' }];
          else if (pr === 'afternoon') ranges = [{ from: '14:00', to: '18:00' }];
          else if (pr === 'day') ranges = [{ from: '10:00', to: '22:00' }];
          else f.querySelectorAll('[data-date]').forEach(function (c) { var wd = new Date(c.getAttribute('data-date') + 'T12:00:00').getDay(); var weekend = wd === 0 || wd === 6; c.checked = pr === 'weekends' ? weekend : !weekend; });
          drawRanges(); count();
        }
        else if (b.getAttribute('data-sc') === 'del-range') { ranges.splice(Number(b.getAttribute('data-i')), 1); drawRanges(); count(); }
      });
      var mode = 'send';
      f.querySelectorAll('[data-sc-mode]').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-sc-mode'); }); });
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var s = slots();
        if (s.length > 60) { err.textContent = 'Offer at most 60 time slots: untick some dates.'; err.hidden = false; return; }
        // Created as a draft first, so the automation is set before anyone can answer; then sent.
        var res = await D().createSchedule(campaignId, {
          title: f.title.value, notes: f.notes.value, format: f.format.value, durationMinutes: f.duration.value ? Number(f.duration.value) : null,
          slots: s, due: UI().fromLocalInput(f.due.value),
        }, false);
        if (!res.ok) { err.textContent = res.message; err.hidden = false; return; }
        if (f.auto.checked) {
          var au = await D().setScheduleAutomation(res.id, true, null);
          if (!au.ok) { err.textContent = au.message; err.hidden = false; return; }
        }
        if (mode === 'send') {
          var pub = await D().publishSchedule(res.id);
          if (!pub.ok) { err.textContent = pub.message; err.hidden = false; return; }
        }
        d.close();
        UI().notice(mode === 'send' ? 'Request sent: the party was notified.' : 'Draft saved.');
        selected = res.id;
        load();
        changed();
      });
      f.title.focus();
    }

    // ---- Events -------------------------------------------------------------------------------------------------
    host.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-sc]');
      if (!b) return;
      var a = b.getAttribute('data-sc');
      var id = b.getAttribute('data-id');
      var r = schedules.find(function (x) { return x.id === id; });
      var done = function (res, msg) { if (!res.ok) UI().notice(res.message, 'error'); else { if (msg) UI().notice(msg); dirtyForm = false; load(); changed(); } };
      if (a === 'new') createDialog();
      else if (a === 'use-sugg' && r && r.suggestions) proposeDialog(r, r.suggestions[Number(b.getAttribute('data-i'))]);
      else if (a === 'automation' && r) {
        var dlg = UI().dialog('<form class="cw-dialog-body" novalidate><h2 class="cw-dialog-title">Automatic proposal</h2>' +
          '<label class="cw-check"><input type="checkbox" name="auto"' + (r.autoPropose ? ' checked' : '') + '> When everyone has answered, propose the best time automatically. Everyone still confirms it.</label>' +
          (r.format === 'in_person' ? '' : '<p class="cw-muted cw-fine">If it ends up as Meeting in the Fog, no link is needed.</p>') +
          '<p class="cw-form-error" role="alert" hidden></p><div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Cancel</button><button type="submit" class="btn btn-primary btn-sm">Save</button></div></form>', { label: 'Automatic proposal' });
        var af = dlg.el.querySelector('form');
        af.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var resA = await D().setScheduleAutomation(r.id, af.auto.checked, r.defaultLink || null);
          if (!resA.ok) { var er = af.querySelector('.cw-form-error'); er.textContent = resA.message; er.hidden = false; return; }
          dlg.close();
          UI().notice(af.auto.checked ? 'Automatic proposal is on.' : 'Automatic proposal is off.');
          load(); changed();
        });
      }
      else if (a === 'retry') load();
      else if (a === 'all-available' || a === 'all-unavailable') {
        b.closest('form').querySelectorAll('input[type=radio][value="' + (a === 'all-available' ? 'available' : 'unavailable') + '"]').forEach(function (i) { i.checked = true; });
        dirtyForm = true;
      } else if (a === 'publish') done(await D().publishSchedule(id), 'Request sent: the party was notified.');
      else if (a === 'cancel' && r) {
        if (await UI().confirm({ title: 'Cancel “' + r.title + '”?', message: 'Nothing is scheduled and the party is told the request was cancelled. You can start another round later.', confirmLabel: 'Cancel request', danger: true })) done(await D().cancelSchedule(id), 'Request cancelled.');
      } else if (a === 'reopen' && r) {
        if (await UI().confirm({ title: 'Start another round?', message: 'Everyone’s answers and any proposal are cleared and everyone is asked again for the same time slots.', confirmLabel: 'Start another round' })) done(await D().reopenSchedule(id), 'A new round started: the party was notified.');
      } else if (a === 'confirm') done(await D().confirmSchedule(id, Number(b.getAttribute('data-version')), b.getAttribute('data-slot')), 'Thanks: your confirmation is saved.');
      else if (a === 'decline') {
        if (await UI().confirm({ title: 'You can’t make this time?', message: 'The proposal is withdrawn for everyone and the DM is told. Nobody has to confirm a time that doesn’t work.', confirmLabel: 'I can’t make it' })) done(await D().declineSchedule(id), 'The DM was told.');
      }
    });

    host.addEventListener('change', function (e) {
      var form = e.target.closest('form[data-sc-form]');
      if (!form) return;
      dirtyForm = true;
      if (e.target.name === 'canHost') form.querySelector('.cw-host-fields').hidden = !e.target.checked;
      if (e.target.name === 'format') {
        form.querySelector('[data-sc-part="in_person"]').hidden = e.target.value !== 'in_person';
        form.querySelector('[data-sc-part="online"]').hidden = e.target.value !== 'online';
      }
    });
    host.addEventListener('input', function (e) { if (e.target.closest('form[data-sc-form]')) dirtyForm = true; });

    host.addEventListener('submit', async function (e) {
      var form = e.target.closest('form[data-sc-form]');
      if (!form) return;
      e.preventDefault();
      var err = form.querySelector('.cw-form-error');
      var id = form.getAttribute('data-id');
      var r = schedules.find(function (x) { return x.id === id; });
      var kind = form.getAttribute('data-sc-form');
      var res;
      if (kind === 'answer') {
        var av = {};
        r.slots.forEach(function (s) { var c = form.querySelector('input[name="av-' + s.id + '"]:checked'); if (c) av[s.id] = c.value; });
        if (Object.keys(av).length < r.slots.length && !(await UI().confirm({ title: 'Some slots have no answer', message: 'Unanswered slots count as “not available”. Send anyway?', confirmLabel: 'Send anyway' }))) return;
        var canHost = form.elements.canHost && form.elements.canHost.checked;
        res = await D().submitAvailability(id, {
          availability: av, canHost: canHost, hostLocation: canHost ? form.elements.hostLocation.value : '', shareLocation: canHost && form.elements.shareLocation.checked,
          hostNote: canHost ? form.elements.hostNote.value : '', suggestFormat: form.elements.suggestFormat.value, suggestion: form.elements.suggestion.value,
        });
        if (canHost && !form.elements.hostLocation.value.trim()) UI().notice('You said you can host but gave no location, so you are not offered as a host.');
      } else {
        var format = form.querySelector('input[name="format"]:checked').value;
        res = await D().proposeSchedule(id, { slotId: form.elements.slot.value, format: format, hostId: format === 'in_person' ? form.elements.host.value : null, link: null, linkKind: null });
      }
      if (!res.ok) { err.textContent = res.message; err.hidden = false; return; }
      dirtyForm = false;
      UI().notice(kind === 'answer' ? 'Your availability was saved.' : 'Sent: everyone was asked to confirm.');
      load();
      changed();
    });

    var offs = [ctx.on('schedule', function () { load(true); }), ctx.on('campaign', draw)];
    // Fallback when live updates aren't connected: look again every 30 seconds while this tab is visible.
    var poll = global.setInterval(function () { if (!document.hidden && ctx.realtime !== 'SUBSCRIBED') load(true); }, 30000);
    offs.push(function () { global.clearInterval(poll); });
    return load().then(function () {
      return function cleanup() { alive = false; offs.forEach(function (off) { off(); }); };
    });
  }

  global.FogCampaignScheduler = { render: render };
})(window);
