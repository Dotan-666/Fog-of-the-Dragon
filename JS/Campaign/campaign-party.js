/**
 * Party helpers shared by the Campaign workspace pages (Overview, Members, Characters, Combat, Settings).
 *
 * Characters are never copied into the campaign by these helpers: a campaign seat holds one shared snapshot
 * (campaign_members.character_data, written by FogCampaignStore.setCharacter) and this file only reads it with the
 * character rules engine (the same engine the Characters pages use), so numbers are always recomputed from the rules.
 */
(function (global) {
  'use strict';

  function esc(s) { return global.FogAccount.escapeHtml(s); }

  function fmtDateTime(iso) {
    return iso ? new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  }
  function fmtDate(iso) {
    return iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  }

  function docFromSnapshot(snap) {
    var Store = global.FogCharacterStore;
    var d = Store.createDraft();
    d.id = 'snap_' + (snap.sourceCharacterId || 'x');
    d.choices = Object.assign(d.choices, JSON.parse(JSON.stringify(snap.choices || {})));
    d.narrative = Object.assign(d.narrative, JSON.parse(JSON.stringify(snap.narrative || {})));
    return d;
  }

  /** One-line description, key numbers and rule errors of a shared character (or null when there is no character). */
  function summarize(snap, campaign) {
    if (!snap || !global.FogDeriveCharacter) return null;
    try {
      var doc = docFromSnapshot(snap);
      var errors = global.FogValidateCharacter.validateComplete(doc);
      var d = global.FogDeriveCharacter(doc);
      var A = global.FogRulesApi;
      var c = doc.choices;
      var cls = A.getClass(c.classId);
      var sub = global.FogCharacterOptions.subclassAvailable(doc) ? global.FogCharacterOptions.currentSubclass(doc) : null;
      var sp = A.getSpecies(c.speciesId);
      var bg = global.FogCharacterOptions.backgroundOf(doc);
      return {
        className: cls ? cls.name : '', speciesName: sp ? sp.name : '', subclassName: sub ? sub.name : '', backgroundName: bg ? bg.name : '',
        level: c.level,
        short: 'Level ' + c.level + ' ' + (cls ? cls.name : ''),
        line: 'Level ' + c.level + ' ' + [sp && sp.name, cls && cls.name].filter(Boolean).join(' ') + (sub ? ' (' + sub.name + ')' : '') + (bg ? ' · ' + bg.name : ''),
        stats: 'HP ' + (d.combat.hpMax != null ? d.combat.hpMax : '—') + ' · AC ' + d.combat.ac + ' · Speed ' + d.combat.speed + ' ft.',
        hpMax: d.combat.hpMax, ac: d.combat.ac, initMod: d.combat.initiative, speed: d.combat.speed,
        errors: errors,
        levelMismatch: campaign ? c.level !== campaign.startingLevel : false,
        derived: d,
        doc: doc,
      };
    } catch (e) {
      return { line: 'This character couldn\'t be read by the rules engine.', short: '', stats: '', errors: [{ message: e.message }], levelMismatch: false, hpMax: null, ac: null, initMod: 0 };
    }
  }

  function portraitOf(snap) {
    var url = snap && snap.narrative && snap.narrative.portraitDataUrl;
    return url && global.FogAccount.isSafeImageUrl(url) ? url : null;
  }

  function avatarHtml(m, cls) {
    return m.avatarUrl
      ? '<img class="' + (cls || 'cv-avatar') + '" src="' + esc(m.avatarUrl) + '" alt="">'
      : '<span class="' + (cls || 'cv-avatar') + ' cv-avatar-letter" aria-hidden="true">' + esc((m.displayName || '?').charAt(0).toUpperCase()) + '</span>';
  }

  /** What stops the DM from starting the campaign (empty list = ready). */
  function readiness(c) {
    var players = c.roster.filter(function (m) { return m.role === 'player'; });
    var issues = [];
    if (!c.adventureId) issues.push(c.role === 'dm' ? 'Choose the adventure this campaign runs (Campaign Settings → Adventure).' : 'The Dungeon Master needs to choose the adventure.');
    if (c.roster.length < c.requiredPlayers) {
      var n = c.requiredPlayers - c.roster.length;
      issues.push(n + ' more ' + (n === 1 ? 'person needs' : 'people need') + ' to join (' + c.roster.length + ' of ' + c.requiredPlayers + ', including the DM).');
    }
    players.forEach(function (m) {
      var s = summarize(m.character, c);
      if (!s) issues.push(m.displayName + ' needs a character.');
      else if (s.errors.length) issues.push(m.displayName + '\'s character "' + m.characterName + '" needs fixes.');
    });
    return issues;
  }

  function myCompleteCharacters() {
    return global.FogCharacterStore.listSummaries().filter(function (d) { return d.status === 'complete'; });
  }

  /** Creates a creator draft linked to this campaign seat and opens it in the Dashboard's character creator. */
  async function buildFor(ctx, member) {
    var Store = global.FogCharacterStore;
    var c = ctx.campaign;
    var d = Store.createDraft();
    var slot = global.FogCharacterRegistry ? await global.FogCharacterRegistry.claim(d.id) : { ok: true };
    if (!slot.ok) return slot;
    d.choices.level = c.startingLevel;
    d.meta.campaignLink = { campaignId: c.id, campaignName: c.name, userId: member.userId, forName: member.isMe ? null : member.displayName };
    global.FogValidateCharacter.sanitizeChoices(d);
    var res = Store.save(d);
    if (!res.ok) return res;
    global.location.href = ctx.dashboardUrl('#characters/new/' + d.id);
    return { ok: true };
  }

  /** Adds a copy of a shared character to this browser's roster. */
  async function importCopy(snap) {
    var Store = global.FogCharacterStore;
    var doc = docFromSnapshot(snap);
    doc.id = Store.createDraft().id;
    var slot = global.FogCharacterRegistry ? await global.FogCharacterRegistry.claim(doc.id) : { ok: true };
    if (!slot.ok) return slot;
    global.FogValidateCharacter.sanitizeChoices(doc);
    doc.status = global.FogValidateCharacter.validateComplete(doc).length ? 'draft' : 'complete';
    return Store.save(doc);
  }

  /** The player's own character in this browser, when the seat's snapshot came from one (to open its full sheet). */
  function localSheetId(snap) {
    var id = snap && snap.sourceCharacterId;
    return id && global.FogCharacterStore.get(id) ? id : null;
  }

  function statusLabel(c) {
    return c.status === 'archived' ? 'Archived' : c.phase === 'started' ? 'In progress' : 'Gathering party';
  }

  global.FogCampaignParty = {
    esc: esc, fmtDateTime: fmtDateTime, fmtDate: fmtDate,
    docFromSnapshot: docFromSnapshot, summarize: summarize, portraitOf: portraitOf, avatarHtml: avatarHtml,
    readiness: readiness, myCompleteCharacters: myCompleteCharacters, buildFor: buildFor, importCopy: importCopy,
    localSheetId: localSheetId, statusLabel: statusLabel,
  };
})(window);
