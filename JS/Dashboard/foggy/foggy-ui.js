/**
 * Foggy interface, shared by the Dashboard (#foggy, standalone content) and the Campaign workspace (#foggy, Campaign Foggy).
 *
 *   FogFoggyUI.mount(host, { scope: 'dashboard' | 'campaign', campaign: { id, name, adventureId, isDm } | null,
 *                            navigate: function (hash) }) → cleanup
 *
 * Access by plan (decided by the database), writing drafts through the server (FogFoggy.generate → Edge Function), the
 * drafts library with loading / empty / error states, saving a draft into an adventure's Assets, deleting drafts.
 * While Foggy is switched off the composer stays disabled and says so; the browser never contacts an AI service itself.
 */
(function (global) {
  'use strict';

  var F = function () { return global.FogFoggy; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function when(iso) { try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }

  var MARK = '<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 30c4-6 10-6 14 0s10 6 14 0"/><path d="M6 22c5-6 11-6 16 0s11 6 16 0" opacity=".65"/><path d="M10 38c4-4 9-4 13 0s9 4 13 0" opacity=".4"/><circle cx="34" cy="13" r="4"/></svg>';
  var SUGGEST = {
    dashboard: [['npc', 'A nervous lighthouse keeper who knows more than she says'], ['location', 'A sunken temple reachable only at low tide'], ['monster', 'An ambush by goblins on a rope bridge, party level 3'], ['item', 'A rare compass that points to what you fear most']],
    campaign: [['npc', 'A rival adventurer who keeps crossing the party’s path'], ['handout', 'A letter the party finds on the cult messenger'], ['location', 'A tavern where the next session starts'], ['outline', 'Three ways the next session could open']],
  };

  function mount(host, opts) {
    opts = opts || {};
    var scope = opts.scope === 'campaign' ? 'campaign' : 'dashboard';
    var campaign = opts.campaign || null;
    var alive = true;
    var acc = null;
    var drafts = { state: 'loading', list: [], message: '' };
    var adventures = [];
    var thread = [];
    var busy = false;
    var title = scope === 'campaign' ? 'Campaign Foggy' : 'Foggy';

    host.innerHTML = '<div class="fg" data-scope="' + scope + '">' +
      '<section class="fg-hero"><div class="fg-mark">' + MARK + '</div><div class="fg-hero-text"><p class="fg-kicker">' + (scope === 'campaign' ? 'For this campaign' : 'Writing helper') + '</p><h2 class="fg-title">' + title + '</h2>' +
      '<p class="fg-sub">' + (scope === 'campaign'
        ? 'Ideas for <strong>' + esc(campaign && campaign.name) + '</strong>: NPCs, places, handouts and session openers that fit what has happened so far. Drafts stay with this campaign until you save them into its adventure.'
        : 'Ask for NPCs, locations, encounters, magic items, spells and handouts. Foggy writes a draft; you decide what to keep and where it goes.') + '</p></div>' +
      '<span class="fg-tier" id="fg-tier" hidden></span></section>' +
      '<div class="fg-status" id="fg-status" role="status" aria-live="polite"><span class="fg-spin" aria-hidden="true"></span> Checking what your plan includes…</div>' +
      '<div class="fg-grid"><section class="fg-chat" aria-label="Conversation with ' + title + '"><div class="fg-thread" id="fg-thread"></div>' +
      '<form class="fg-composer" id="fg-form" novalidate><div class="fg-row">' +
      '<label class="fg-field"><span>Make</span><select name="kind">' + F().KINDS.map(function (k) { return '<option value="' + k + '">' + esc(F().KIND_LABEL[k]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fg-field"><span>Tone</span><select name="tone">' + F().TONES.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fg-field fg-field-sm"><span>Party level</span><select name="level"><option value="">Any</option>' + Array.from({ length: 20 }, function (_, i) { return '<option>' + (i + 1) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fg-field"><span>Save to</span><select name="target" id="fg-target"></select></label></div>' +
      '<label class="fg-field fg-field-wide"><span class="fg-vh">What should Foggy make?</span><textarea name="prompt" rows="3" maxlength="2000" placeholder="Describe what you need…"></textarea></label>' +
      '<div class="fg-send"><p class="fg-hint" id="fg-hint"></p><button type="submit" class="btn btn-primary btn-sm" id="fg-send" disabled>Ask Foggy</button></div></form></section>' +
      '<aside class="fg-side"><section class="fg-card" aria-labelledby="fg-dr-h"><h3 id="fg-dr-h">' + (scope === 'campaign' ? 'Campaign drafts' : 'Your drafts') + '</h3><div id="fg-drafts"></div></section>' +
      '<section class="fg-card" aria-labelledby="fg-pl-h"><h3 id="fg-pl-h">What your plan includes</h3><div id="fg-plans"></div></section>' +
      '<section class="fg-card" aria-labelledby="fg-wh-h"><h3 id="fg-wh-h">Where drafts go</h3><ul class="fg-list">' +
      '<li><strong>Standalone</strong> (Dashboard Foggy): kept in your Foggy library, not tied to any campaign. Save one into any of your adventures as an asset.</li>' +
      '<li><strong>Campaign</strong> (Campaign Foggy): kept with that campaign, for its Dungeon Master only. Save one into the campaign’s adventure.</li>' +
      '<li>Nothing is shared with players until you put it in an adventure and mark it as visible to them.</li></ul></section></aside></div></div>';

    var $ = function (s) { return host.querySelector(s); };
    var form = $('#fg-form');

    function drawThread() {
      var el = $('#fg-thread');
      var intro = '<div class="fg-msg is-foggy"><span class="fg-avatar" aria-hidden="true">' + MARK + '</span><div class="fg-bubble"><p>Hello! I’m ' + title + '. Tell me what you need and I’ll write a draft you can edit and keep.</p>' +
        '<p class="fg-muted">Try one of these:</p><div class="fg-chips">' + SUGGEST[scope].map(function (s) { return '<button type="button" class="fg-chip" data-fg-suggest="' + esc(s[0]) + '" data-text="' + esc(s[1]) + '">' + esc(s[1]) + '</button>'; }).join('') + '</div></div></div>';
      el.innerHTML = intro + thread.map(function (m) {
        return '<div class="fg-msg ' + (m.from === 'me' ? 'is-me' : 'is-foggy') + '">' + (m.from === 'me' ? '' : '<span class="fg-avatar" aria-hidden="true">' + MARK + '</span>') +
          '<div class="fg-bubble' + (m.note ? ' is-note' : '') + (m.pending ? ' is-pending' : '') + '">' + (m.pending ? '<p><span class="fg-spin" aria-hidden="true"></span> ' + esc(m.text) + '</p>' : '<p>' + esc(m.text) + '</p>') + (m.draft ? draftCard(m.draft) : '') + '</div></div>';
      }).join('');
      el.scrollTop = el.scrollHeight;
    }

    var FIELD_LABEL = { role: 'Role', appearance: 'Appearance', motivation: 'Motivation', voice: 'Voice', subject: 'Subject', scale: 'Scale', legend: 'Key', features: 'Features', creatures: 'Creatures', difficulty: 'Difficulty', tactics: 'Tactics', rarity: 'Rarity', attunement: 'Attunement', properties: 'Properties', level: 'Level', school: 'School', effect: 'Effect' };
    function para(t) { return esc(t).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>'); }
    function draftCard(d) {
      var b = d.body || {};
      var f = b.fields || {};
      var facts = Object.keys(f).map(function (k) { return '<div><dt>' + esc(FIELD_LABEL[k] || k) + '</dt><dd>' + para(f[k]) + '</dd></div>'; }).join('');
      return '<article class="fg-result"><p class="fg-kind">' + esc(F().KIND_LABEL[d.kind] || d.kind) + '</p><h4>' + esc(d.title) + '</h4>' +
        (b.summary ? '<p>' + para(b.summary) + '</p>' : '') + (facts ? '<dl class="fg-facts">' + facts + '</dl>' : '') +
        (b.dmNotes ? '<details class="fg-dmnotes"><summary>Dungeon Master notes</summary><p>' + para(b.dmNotes) + '</p></details>' : '') + '</article>';
    }

    function drawStatus() {
      var st = $('#fg-status');
      var tierEl = $('#fg-tier');
      var send = $('#fg-send');
      var hint = $('#fg-hint');
      if (!acc) return;
      if (!acc.ok) {
        st.className = 'fg-status is-error';
        st.innerHTML = esc(acc.message) + ' <button type="button" class="fg-link" data-fg="retry">Try again</button>';
        send.disabled = true;
        hint.textContent = '';
        return;
      }
      var a = acc.access;
      var T = a.tier && F().TIERS[a.tier];
      tierEl.hidden = !T;
      if (T) tierEl.textContent = T.name + ' · ' + T.line;
      var allowed = scope === 'campaign' ? a.campaign : a.dashboard;
      if (!allowed) {
        st.className = 'fg-status is-locked';
        st.innerHTML = scope === 'campaign'
          ? (campaign && !campaign.isDm ? 'Campaign Foggy is for the Dungeon Master of this campaign.' : '<strong>Campaign Foggy is part of the Fogger of the Dragons plan</strong> (“Foggie+”, for the Dungeon Master of an active campaign).' + (opts.navigate ? ' <button type="button" class="fg-link" data-fg="plans">See the plans</button>' : ''))
          : '<strong>Foggy is part of the Dungeon Master plan</strong> (“Foggie”) <strong>and the Fogger of the Dragons plan</strong> (“Foggie+”). <button type="button" class="fg-link" data-fg="plans">See the plans</button>';
      } else if (!a.enabled) {
        st.className = 'fg-status is-off';
        st.innerHTML = '<strong>' + title + ' isn’t switched on yet.</strong> Your plan includes it (' + esc(T ? T.name : '') + '), and you can look around and manage drafts. Writing new drafts will start once it is switched on; until then nothing is sent to any AI service.';
      } else {
        st.className = 'fg-status is-on';
        st.innerHTML = '<strong>' + title + ' is ready.</strong> Describe what you need; each draft is written on the server and kept in your library.';
      }
      send.disabled = !a.canGenerate || !allowed || busy;
      hint.textContent = send.disabled ? (allowed ? 'Not switched on yet: Foggy can’t write drafts today.' : 'Not included in your plan.') : 'Drafts are saved to your Foggy library first.';
      form.querySelectorAll('select, textarea').forEach(function (x) { x.disabled = !allowed; });
      host.querySelectorAll('[data-fg-suggest]').forEach(function (b) { b.disabled = !allowed; });
      $('#fg-plans').innerHTML = '<ul class="fg-tiers">' +
        '<li class="' + (a.plan === 'warlord' ? 'is-you' : '') + '"><strong>Warlord (Free)</strong><span>No Foggy</span></li>' +
        '<li class="' + (a.tier === 'foggie' ? 'is-you' : '') + '"><strong>Dungeon Master</strong><span>Foggie — Campaign Writing Helper</span></li>' +
        '<li class="' + (a.tier === 'foggie_plus' ? 'is-you' : '') + '"><strong>Fogger of the Dragons</strong><span>Foggie+ — Advanced AI Assistant, plus Campaign Foggy</span></li></ul>' +
        (acc.source === 'local' ? '<p class="fg-muted">Checked from your plan in this browser; the server will confirm once Foggy is set up there.</p>' : '');
    }

    function drawTargets() {
      var sel = $('#fg-target');
      var opts2 = scope === 'campaign'
        ? [['campaign', 'This campaign’s drafts']].concat(campaign && campaign.adventureId ? [['adv:' + campaign.adventureId, 'The campaign’s adventure (as an asset)']] : [])
        : [['library', 'My Foggy library (standalone)']].concat(adventures.map(function (x) { return ['adv:' + x.id, 'Adventure: ' + x.title]; }));
      sel.innerHTML = opts2.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
    }

    function drawDrafts() {
      var el = $('#fg-drafts');
      if (drafts.state === 'loading') { el.innerHTML = '<p class="fg-muted"><span class="fg-spin" aria-hidden="true"></span> Loading drafts…</p>'; return; }
      if (drafts.state === 'error') { el.innerHTML = '<p class="fg-error">' + esc(drafts.message) + '</p><button type="button" class="btn btn-secondary btn-sm" data-fg="reload-drafts">Try again</button>'; return; }
      if (!drafts.list.length) {
        el.innerHTML = '<div class="fg-empty"><p><strong>No drafts yet.</strong></p><p class="fg-muted">' + (drafts.notSetUp ? 'The Foggy library isn’t set up on the server yet.' : 'Drafts Foggy writes for you will appear here, ready to save into an adventure.') + '</p></div>';
        return;
      }
      var advOptions = scope === 'campaign'
        ? (campaign && campaign.adventureId ? [[campaign.adventureId, 'The campaign’s adventure']] : [])
        : adventures.map(function (x) { return [x.id, x.title]; });
      el.innerHTML = '<ul class="fg-drafts">' + drafts.list.map(function (d) {
        var canAsset = F().ASSET_KINDS.indexOf(d.kind) >= 0;
        return '<li class="fg-draft" data-id="' + esc(d.id) + '"><div class="fg-draft-head"><span class="fg-kind">' + esc(F().KIND_LABEL[d.kind] || d.kind) + '</span><strong>' + esc(d.title) + '</strong>' + (d.status === 'saved' ? '<span class="fg-saved">Saved</span>' : '') + '</div>' +
          '<p class="fg-muted">' + esc(((d.body && d.body.summary) || '').slice(0, 160)) + '</p><p class="fg-meta">' + esc(when(d.createdAt)) + '</p>' +
          '<div class="fg-draft-tools">' + (canAsset && advOptions.length ? '<select aria-label="Adventure to save into" data-fg-adv="' + esc(d.id) + '">' + advOptions.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select><button type="button" class="btn btn-secondary btn-sm" data-fg="save" data-id="' + esc(d.id) + '">Save as asset</button>' : '') +
          '<button type="button" class="fg-link" data-fg="delete" data-id="' + esc(d.id) + '">Delete</button></div></li>';
      }).join('') + '</ul>';
    }

    async function loadAccess() {
      acc = null;
      $('#fg-status').className = 'fg-status';
      $('#fg-status').innerHTML = '<span class="fg-spin" aria-hidden="true"></span> Checking what your plan includes…';
      var r = await F().access(campaign && campaign.id, { isCampaignDm: campaign && campaign.isDm });
      if (!alive) return;
      acc = r;
      drawStatus();
    }
    async function loadDrafts() {
      drafts = { state: 'loading', list: [] };
      drawDrafts();
      var r = await F().listDrafts({ scope: scope, campaignId: campaign && campaign.id });
      if (!alive) return;
      drafts = r.ok ? { state: 'ready', list: r.drafts, notSetUp: r.notSetUp } : { state: 'error', list: [], message: r.message };
      drawDrafts();
    }
    async function loadAdventures() {
      if (scope !== 'dashboard' || !global.FogAdventureStore) return;
      var r = await global.FogAdventureStore.list();
      if (!alive) return;
      adventures = r.ok ? r.adventures.filter(function (x) { return x.status !== 'archived'; }) : [];
      drawTargets();
      drawDrafts();
    }

    async function onSubmit(e) {
      e.preventDefault();
      if (busy) return;
      var prompt = form.prompt.value.trim();
      var target = form.target.value;
      var req = { kind: form.kind.value, scope: scope, campaignId: campaign && campaign.id, adventureId: /^adv:/.test(target) ? target.slice(4) : null, prompt: prompt, options: { tone: form.tone.value || null, level: form.level.value ? Number(form.level.value) : null } };
      var invalid = F().validate(req);
      if (invalid) { $('#fg-hint').textContent = invalid; return; }
      busy = true;
      $('#fg-send').disabled = true;
      $('#fg-send').textContent = 'Writing…';
      thread.push({ from: 'me', text: prompt });
      var pending = { from: 'foggy', pending: true, text: 'Writing your draft…' };
      thread.push(pending);
      drawThread();
      var res = await F().generate(req, acc && acc.ok ? acc.access : null);
      if (!alive) return;
      thread.splice(thread.indexOf(pending), 1);
      var msg = { from: 'foggy', note: !res.ok, text: res.ok ? 'Here is your draft. It is in your library.' : res.message, draft: res.ok ? res.draft : null };
      if (res.ok) {
        form.prompt.value = '';
        if (req.adventureId && F().ASSET_KINDS.indexOf(res.draft.kind) >= 0) {
          var saved = await F().saveToAdventure(res.draft, req.adventureId);
          if (!alive) return;
          msg.text = saved.ok ? 'Here is your draft. It is in your library and was added to the adventure’s Assets.' : 'Here is your draft. It is in your library, but it couldn’t be added to the adventure: ' + saved.message;
        } else if (req.adventureId) {
          msg.text = 'Here is your draft. It is in your library (this kind of draft isn’t an adventure asset, so copy what you need into a chapter).';
        }
        if (typeof res.remainingToday === 'number' && res.remainingToday <= 5) msg.text += ' ' + (res.remainingToday === 0 ? 'That was your last draft for today.' : res.remainingToday + ' drafts left today.');
      }
      thread.push(msg);
      busy = false;
      $('#fg-send').textContent = 'Ask Foggy';
      drawThread();
      drawStatus();
      if (res.ok) loadDrafts();
    }

    async function onClick(e) {
      var s = e.target.closest('[data-fg-suggest]');
      if (s) { form.kind.value = s.getAttribute('data-fg-suggest'); form.prompt.value = s.getAttribute('data-text'); form.prompt.focus(); return; }
      var b = e.target.closest('[data-fg]');
      if (!b) return;
      var a = b.getAttribute('data-fg');
      if (a === 'retry') loadAccess();
      else if (a === 'reload-drafts') loadDrafts();
      else if (a === 'plans' && opts.navigate) opts.navigate('#upgrade');
      else if (a === 'delete') {
        if (!global.confirm('Delete this draft? This cannot be undone.')) return;
        var r = await F().removeDraft(b.getAttribute('data-id'));
        if (!r.ok) { global.alert(r.message); return; }
        loadDrafts();
      } else if (a === 'save') {
        var id = b.getAttribute('data-id');
        var d = drafts.list.filter(function (x) { return x.id === id; })[0];
        var advSel = host.querySelector('[data-fg-adv="' + id + '"]');
        b.disabled = true;
        var res = await F().saveToAdventure(d, advSel && advSel.value);
        if (!alive) return;
        b.disabled = false;
        if (!res.ok) { global.alert(res.message); return; }
        d.status = 'saved';
        drawDrafts();
      }
    }

    form.addEventListener('submit', onSubmit);
    host.addEventListener('click', onClick);
    drawThread();
    drawTargets();
    drawDrafts();
    loadAccess();
    loadDrafts();
    loadAdventures();
    return function cleanup() { alive = false; form.removeEventListener('submit', onSubmit); host.removeEventListener('click', onClick); };
  }

  global.FogFoggyUI = { mount: mount };
})(window);
