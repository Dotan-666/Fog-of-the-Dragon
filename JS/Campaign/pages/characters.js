/**
 * Characters: the party's characters in this campaign.
 *
 * A campaign seat holds ONE shared snapshot of a character (campaign_members.character_data); nothing is duplicated
 * into a second table. Characters themselves are created and kept in the Character System (Dashboard → Characters);
 * here a player chooses one of theirs (or builds a new one with the Dashboard's creator) until the campaign starts, and
 * anyone can read the shared character. The numbers are recomputed with the same rules engine as the character sheet.
 */
(function (global) {
  'use strict';

  var P = function () { return global.FogCampaignParty; };
  var UI = function () { return global.FogCampaignUI; };
  var S = function () { return global.FogCampaignStore; };

  function esc(s) { return UI().esc(s); }

  function signed(n) { return n == null ? '—' : (n >= 0 ? '+' : '') + n; }

  /** Spells of the character, each a link to its full text in the Bestiary (same tab, "← Back to <character>" there). */
  function spellLinks(m, d, ctx) {
    var sc = d.spellcasting;
    var Api = global.FogRulesApi;
    if (!sc || !Api || !global.FogNav || !global.FogCampaignRouter) return '';
    var ids = [].concat(sc.cantrips || [], sc.prepared || [], sc.alwaysPrepared || [], sc.spellbook || []);
    var seen = {};
    var items = ids.filter(function (id) { if (!id || seen[id]) return false; seen[id] = 1; return true; }).map(function (id) { var sp = Api.getSpell(id); return sp ? { id: id, name: sp.name, level: sp.level } : null; }).filter(Boolean)
      .sort(function (a, b) { return (a.level - b.level) || a.name.localeCompare(b.name); });
    if (!items.length) return '';
    var from = 'characters/' + encodeURIComponent(m.userId);
    return '<h3 class="cv-subheading">Spells</h3><ul class="cw-plain-list cw-cols">' + items.slice(0, 40).map(function (sp) {
      var href = global.FogNav.link(global.FogCampaignRouter.hrefFor('bestiary', ['spell', sp.id]), m.characterName, { from: from });
      return '<li><a class="cw-ref-in" href="' + esc(href) + '">' + esc(sp.name) + '</a> <span class="cw-muted">' + (sp.level ? 'L' + sp.level : 'cantrip') + '</span></li>';
    }).join('') + '</ul>';
  }

  function detailHtml(m, s, ctx) {
    var d = s.derived;
    var abil = Object.keys(d.abilities || {}).map(function (k) {
      var a = d.abilities[k];
      return '<div class="cw-abil"><span>' + esc(k.toUpperCase()) + '</span><strong>' + esc(a.score != null ? a.score : '—') + '</strong><em>' + signed(a.modifier) + '</em></div>';
    }).join('');
    var attacks = (d.attacks || []).slice(0, 8).map(function (a) {
      return '<li><strong>' + esc(a.name) + '</strong>' + (a.attackBonus != null ? ' ' + signed(a.attackBonus) + ' to hit' : (a.bonus != null ? ' ' + esc(String(a.bonus)) : '')) + (a.damage ? ' · ' + esc(a.damage) : '') + '</li>';
    }).join('');
    var features = (d.features || []).slice(0, 14).map(function (f) { return '<li>' + esc(f.name || f.title || String(f)) + '</li>'; }).join('');
    return '<div class="cw-detail"><header><h2 class="cw-dialog-title">' + esc(m.characterName) + '</h2><p class="cw-muted">' + esc(s.line) + ' · played by ' + esc(m.displayName) + '</p></header>' +
      '<div class="cw-abilities">' + abil + '</div>' +
      '<dl class="cw-facts"><div><dt>Hit points</dt><dd>' + esc(d.combat.hpMax != null ? d.combat.hpMax : '—') + '</dd></div><div><dt>Armor Class</dt><dd>' + esc(d.combat.ac) + '</dd></div>' +
      '<div><dt>Initiative</dt><dd>' + signed(d.combat.initiative) + '</dd></div><div><dt>Speed</dt><dd>' + esc(d.combat.speed) + ' ft.</dd></div>' +
      '<div><dt>Proficiency</dt><dd>' + signed(d.proficiencyBonus) + '</dd></div><div><dt>Passive Perception</dt><dd>' + esc(d.passivePerception != null ? d.passivePerception : '—') + '</dd></div></dl>' +
      (attacks ? '<h3 class="cv-subheading">Attacks</h3><ul class="cw-plain-list">' + attacks + '</ul>' : '') +
      (features ? '<h3 class="cv-subheading">Features</h3><ul class="cw-plain-list cw-cols">' + features + '</ul>' : '') +
      spellLinks(m, d, ctx) +
      '<p class="cv-note">Computed from the shared character with the 5e 2024 rules engine.</p></div>';
  }

  function render(host, ctx, params) {
    var alive = true;
    var busy = false;
    host.innerHTML = '<div class="cw-page cw-characters"><header class="cw-page-head"><div><h2 class="cw-page-title">Characters</h2>' +
      '<p class="cw-page-sub">The party\'s characters. They come from the Character System; this page shows the version shared with the campaign.</p></div></header>' +
      '<div class="create-campaign-wrapper campaign-view-page cw-legacy"><p class="create-campaign-message" id="ch-message" role="status" hidden></p><div id="ch-body"></div></div></div>';
    var body = host.querySelector('#ch-body');
    var message = host.querySelector('#ch-message');
    function say(t) { message.textContent = t; message.hidden = !t; }

    function seatCard(c, m) {
      var recruiting = c.phase === 'recruiting' && c.status === 'active';
      var s = P().summarize(m.character, c);
      var portrait = P().portraitOf(m.character);
      var head = '<div class="cw-char-head">' + (portrait ? '<img class="cw-portrait" src="' + esc(portrait) + '" alt="Portrait of ' + esc(m.characterName) + '">' : '<span class="cw-portrait cw-portrait-empty" aria-hidden="true">' + esc((m.characterName || m.displayName || '?').charAt(0).toUpperCase()) + '</span>') +
        '<div><h3>' + esc(s ? m.characterName : 'No character yet') + '</h3><p class="cw-muted">Player: ' + esc(m.displayName) + (m.isMe ? ' (you)' : '') + '</p></div></div>';
      var info = '';
      if (s) {
        var ok = !s.errors.length;
        info = '<p class="cw-char-line">' + esc(s.line) + '</p><p class="cw-char-line cw-muted">' + esc(s.stats) + '</p><div class="cw-pills">' +
          '<span class="cv-pill ' + (ok ? 'is-ok' : 'is-warn') + '">' + (ok ? 'Ready' : 'Needs fixes') + '</span>' +
          (m.characterBuiltBy === 'dm' ? '<span class="cv-pill">Built by the DM</span>' : '') +
          (s.levelMismatch && c.phase !== 'started' ? '<span class="cv-pill is-warn">Level ' + s.level + '; campaign starts at ' + c.startingLevel + '</span>' : '') + '</div>' +
          (ok ? '' : '<details class="cv-errors"><summary>What needs fixing</summary><ul>' + s.errors.slice(0, 8).map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul></details>');
      }
      var actions = [];
      if (s) {
        actions.push('<button type="button" class="btn btn-secondary btn-sm" data-ch="details" data-user="' + esc(m.userId) + '">View details</button>');
        var local = m.isMe ? P().localSheetId(m.character) : null;
        if (local) actions.push('<a class="btn btn-secondary btn-sm" href="' + esc(ctx.dashboardUrl('#characters/' + local)) + '">Open character sheet</a>');
        if (m.isMe || ctx.isDm) actions.push('<button type="button" class="cv-link-btn" data-ch="copy" data-user="' + esc(m.userId) + '">Add a copy to my characters</button>');
      }
      var started = c.phase === 'started' && c.status === 'active';
      if (started && s && m.isMe) {
        var lid = P().localSheetId(m.character);
        var local = lid ? global.FogCharacterStore.get(lid) : null;
        var lv = local && local.choices ? local.choices.level : null;
        if (!local) actions.push('<p class="cv-note">To record a level-up, open this character on the device where you made it.</p>');
        else if (lv === s.level + 1) actions.push('<button type="button" class="btn btn-primary btn-sm" data-ch="levelup" data-user="' + esc(m.userId) + '">Record level-up to ' + lv + '</button>');
        else if (lv > s.level + 1) actions.push('<p class="cv-note">Your character sheet is ' + (lv - s.level) + ' levels ahead. Level-ups are recorded one level at a time, so ask your DM to correct it.</p>');
        else actions.push('<p class="cv-note">When you level up on your <a href="' + esc(ctx.dashboardUrl('#characters/' + lid + '/levelup')) + '">character sheet</a>, record it here. Characters gain one level at a time.</p>');
      }
      if (started && ctx.isDm && !m.isMe && s) actions.push('<button type="button" class="cv-link-btn cv-danger" data-ch="replace" data-user="' + esc(m.userId) + '">Correct: replace this character…</button>');
      if (recruiting && m.isMe) {
        var mine = P().myCompleteCharacters();
        actions.push('<div class="cv-choose"><label class="cv-note" for="ch-pick-' + esc(m.userId) + '">Use one of your characters</label><div class="cv-choose-row"><select id="ch-pick-' + esc(m.userId) + '" class="form-control" data-pick-for="' + esc(m.userId) + '">' +
          '<option value="">' + (mine.length ? 'Choose a character…' : 'You have no finished characters yet') + '</option>' +
          mine.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + ' — level ' + d.level + ' ' + esc(d.className || '') + (d.level !== c.startingLevel ? ' (campaign starts at ' + c.startingLevel + ')' : '') + '</option>'; }).join('') +
          '</select><button type="button" class="btn btn-secondary btn-sm" data-ch="use" data-user="' + esc(m.userId) + '">Use</button></div></div>');
        actions.push('<button type="button" class="btn btn-primary btn-sm" data-ch="build" data-user="' + esc(m.userId) + '">Build a new character (level ' + c.startingLevel + ')</button>');
      }
      if (recruiting && ctx.isDm && !m.isMe) actions.push('<button type="button" class="btn btn-secondary btn-sm" data-ch="build" data-user="' + esc(m.userId) + '">' + (s ? 'Build a replacement' : 'Build a character for ' + esc(m.displayName)) + '</button>');
      if (recruiting && s && (m.isMe || ctx.isDm)) actions.push('<button type="button" class="cv-link-btn cv-danger" data-ch="clear" data-user="' + esc(m.userId) + '">Remove from campaign</button>');
      return '<article class="cw-card cw-char">' + head + info + (actions.length ? '<div class="cv-member-actions cw-char-actions">' + actions.join('') + '</div>' : '') + '</article>';
    }

    function draw() {
      if (!alive) return;
      var c = ctx.campaign;
      var players = c.roster.filter(function (m) { return m.role === 'player'; });
      var note = c.phase === 'recruiting' && c.status === 'active'
        ? '<p class="cw-muted">Characters can be chosen, built or replaced until the DM starts the campaign. After that the party is locked.</p>'
        : '<p class="cw-muted">The party is locked: characters can\'t be swapped or removed. They can gain one level at a time, and the DM can correct a mistake with a written reason (recorded in the campaign history).</p>';
      body.innerHTML = note + (players.length
        ? '<div class="cw-grid cw-grid-cards">' + players.map(function (m) { return seatCard(c, m); }).join('') + '</div>'
        : '<div class="cw-empty cw-empty-lg"><h3>No players yet</h3><p>Share the invite code from <a href="#members">Members</a>. Characters appear here once players join.</p></div>');
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
      var b = e.target.closest('[data-ch]');
      if (!b) return;
      var c = ctx.campaign;
      var member = c.roster.find(function (m) { return m.userId === b.getAttribute('data-user'); });
      if (!member) return;
      var a = b.getAttribute('data-ch');
      if (a === 'details') {
        var s = P().summarize(member.character, c);
        if (s && s.derived) { var d = UI().dialog('<div class="cw-dialog-body">' + detailHtml(member, s, ctx) + '<div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Close</button></div></div>', { label: member.characterName }); d.el.querySelector('button').focus();
          // following a spell link leaves the page: close the dialog first (the way back reopens it via #characters/<id>)
          d.el.addEventListener('click', function (ev) { if (ev.target.closest('a.cw-ref-in')) d.close(); }); }
        else say('This character couldn\'t be read by the rules engine.');
      } else if (a === 'use') {
        var sel = host.querySelector('[data-pick-for="' + member.userId + '"]');
        var doc = sel && sel.value ? global.FogCharacterStore.get(sel.value) : null;
        if (!doc) { say('Choose one of your characters first.'); return; }
        run(function () { return S().setCharacter(c.id, member.userId, doc); }, '"' + doc.narrative.name + '" is now your character in this campaign.');
      } else if (a === 'build') {
        var res = await P().buildFor(ctx, member);
        if (!res.ok) say(res.message);
      } else if (a === 'clear') {
        var ok = await UI().confirm({ title: 'Remove ' + (member.isMe ? 'your' : member.displayName + '\'s') + ' character?', message: 'The character leaves this campaign. The copy in the Characters list is kept.', confirmLabel: 'Remove', danger: true });
        if (ok) run(function () { return S().clearCharacter(c.id, member.userId); }, 'Character removed from the campaign.');
      } else if (a === 'levelup') {
        var lid2 = P().localSheetId(member.character);
        var ldoc = lid2 ? global.FogCharacterStore.get(lid2) : null;
        if (!ldoc) { say('Open the character on the device where you made it.'); return; }
        run(function () { return S().levelUp(c.id, ldoc); }, 'Level-up recorded: ' + member.characterName + ' is now level ' + ldoc.choices.level + '.');
      } else if (a === 'replace') {
        var mine2 = P().myCompleteCharacters();
        if (!mine2.length) { say('You have no finished character of your own to use as the replacement. Build one in Characters first.'); return; }
        var ans = await UI().reasonDialog({ title: 'Replace ' + member.displayName + '\'s character', message: 'The party is locked, so this is a correction, not a normal change. Choose which of YOUR finished characters takes the seat (it is copied; your own copy stays).',
          extraHtml: '<label class="cw-field"><span>Replacement</span><select class="form-control" name="doc">' + mine2.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + ' — level ' + d.level + ' ' + esc(d.className || '') + '</option>'; }).join('') + '</select></label>' });
        if (!ans) return;
        var rdoc = global.FogCharacterStore.get(ans.form.doc.value);
        if (!rdoc) { say('That character could not be read.'); return; }
        run(function () { return S().overrideLock(c.id, 'replace_character', { user_id: member.userId, name: (rdoc.narrative && rdoc.narrative.name) || 'Unnamed character', character: S().snapshot(rdoc) }, ans.reason); }, 'The character was replaced and the correction is in the campaign history.');
      } else if (a === 'copy') {
        var r = await P().importCopy(member.character);
        say(r.ok ? 'A copy of "' + member.characterName + '" was added to your Characters.' : r.message);
      }
    });

    draw();
    // Deep link: #characters/<user id> opens that character's details (from an encounter, Foggy, the map…)
    if (params && params.rest && params.rest[0]) {
      var dl = host.querySelector('[data-ch="details"][data-user="' + (global.CSS && CSS.escape ? CSS.escape(params.rest[0]) : params.rest[0]) + '"]');
      if (dl) dl.click();
    }
    var off = ctx.on('campaign', draw);
    return function cleanup() { alive = false; off(); };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.characters = { render: render };
})(window);
