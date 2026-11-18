/**
 * Combat: the encounter tracker for the table (initiative, turns, hit points, conditions) with real actions.
 *
 * Layout (the same structure for the DM and the players):
 *   1. Status       the stage: encounter, round, whose turn it is (name, HP, AC, conditions), who is next.
 *   2. DM controls  (DM only, a labelled toolbar) previous / NEXT TURN / pause / end, and waiting player attacks.
 *   3. Initiative   the rail: the whole order at a glance.
 *   4. Combatants   cards (initiative · who · vitals); click a card to select it.
 *   5. Actions      only the selected combatant's actions: its real attacks and saves (from its stat block or character
 *                   sheet), "Play manually", "Ask Foggy", and (DM) hit point overrides.
 *   6. Log          attacks, rolls, damage, healing, conditions and turns.
 *
 * An attack is a workflow, not a damage box: choose the attack → the target(s) → roll (or type) the attack / the saves →
 * hit or miss → roll (or type) the damage → apply. Players run the same workflow for their own character on their turn and
 * SEND it to the Dungeon Master, who applies or rejects it (players never change the encounter). Foggy only suggests: its
 * suggestion pre-fills the workflow and nothing happens until someone applies it.
 * Basic shows what a new table needs; Advanced adds temporary HP, hiding, order numbers and the full log. Same encounter.
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogCombatModel; };
  var Sess = function () { return global.FogCombatSession; };
  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  var A = function () { return global.FogCombatActions; };

  function esc(s) { return UI().esc(s); }
  function signed(n) { return (n >= 0 ? '+' : '') + n; }
  function key() { return (global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40); }

  var KIND_LABEL = { pc: 'Player character', monster: 'Monster', npc: 'NPC' };
  var HEALTH_LABEL = { unhurt: 'Unhurt', bloodied: 'Bloodied', defeated: 'Defeated' };
  var MODE_NAME = { manual: 'Manual', assist: 'Foggy Assist', auto: 'Full Auto' };
  var GROUP_LABEL = { action: 'Actions', bonus: 'Bonus actions', reaction: 'Reactions', legendary: 'Legendary actions', spell: 'Spells' };
  var TURN_PARTS = [
    { key: 'move', label: 'Move', hint: 'Up to your Speed, split before and after your action if you like.' },
    { key: 'action', label: 'Action', hint: 'Attack, Cast a Spell (Magic), Dash, Disengage, Dodge, Help, Hide, Ready, Search, Study, Utilize…' },
    { key: 'bonus', label: 'Bonus Action', hint: 'Only if a feature, spell or item gives you one.' },
    { key: 'object', label: 'Interact with one object', hint: 'Draw a weapon, open a door… as part of a move or action.' },
  ];

  function hpBar(c, cls) {
    if (!c.hpMax) return '';
    var pct = Math.max(0, Math.min(100, Math.round((c.hp / c.hpMax) * 100)));
    return '<span class="cw-hpbar' + (cls ? ' ' + cls : '') + '" role="img" aria-label="' + c.hp + ' of ' + c.hpMax + ' hit points"><span class="cw-hpfill' + (pct <= 50 ? ' is-low' : '') + (pct <= 25 ? ' is-crit' : '') + '" style="width:' + pct + '%"></span></span>';
  }
  function acBadge(ac, big) {
    if (ac == null) return '';
    return '<span class="cw-ac' + (big ? ' is-big' : '') + '" title="Armor Class"><span class="cw-ac-l">AC</span><strong>' + ac + '</strong></span>';
  }
  function turnsUntil(orderIds, curId, targetId) {
    var n = orderIds.length, a = orderIds.indexOf(curId), b = orderIds.indexOf(targetId);
    if (a < 0 || b < 0 || !n) return null;
    return (b - a + n) % n;
  }
  function dmgTypes(a) { return (a.damage || []).map(function (d) { return d.type; }).filter(function (t, i, l) { return l.indexOf(t) === i; }).join('/'); }
  function actionLine(a) {
    if (a.type === 'attack') return signed(a.bonus) + ' to hit' + (a.reach ? ' · ' + a.reach : '') + (a.damage.length ? ' · ' + a.damage.map(function (d) { return d.dice + ' ' + d.type; }).join(' + ') : '');
    if (a.type === 'save') return 'DC ' + a.dc + ' ' + a.abilityName + ' save' + (a.area ? ' · ' + a.area : '') + (a.damage.length ? ' · ' + a.damage.map(function (d) { return d.dice + ' ' + d.type; }).join(' + ') : '') + (a.half ? ' (half on a success)' : '');
    return '';
  }

  async function render(host, ctx) {
    var alive = true;
    var isDm = ctx.isDm;
    var archived = ctx.campaign.status === 'archived';
    var enc = null, version = null;
    var saveState = { status: 'idle', message: '' };
    var saving = false, dirty = false;
    var conditions = [], monsters = [];
    var pickerQuery = '';
    var loadError = null;
    var view = 'basic';
    var selectedId = null;     // the combatant whose actions are shown (default: whose turn it is)
    var flow = null;           // the attack / manual workflow in progress
    var advice = null;         // Foggy's last answer { loading, reply, action, targetIds, reason, error }
    var requests = [];         // player attack requests (DM: pending ones; players: their own)
    var foggyOk = false;
    var autoRun = null;        // Full Auto: { key, id, stop, status } while Foggy plays a monster's turn
    var assistFor = null;      // Foggy Assist: the turn a suggestion was already asked for
    var advCache = null;       // cached adventure for "Load from adventure"
    var advLoading = false;
    function advEncounters() { return advCache && advCache.content && advCache.content.encounters ? advCache.content.encounters : []; }
    function hasAdventure() { return !!ctx.campaign.adventureId; }
    var diceOpen = false;
    try { diceOpen = global.localStorage.getItem('fog_combat_dice_open') === '1'; } catch (e) { /* preference only */ }
    var checklist = { turn: null, done: {} };
    try { var v0 = global.localStorage.getItem('fog_combat_view'); view = v0 === 'advanced' || v0 === 'detailed' ? 'advanced' : 'basic'; } catch (e) { /* preference only */ }

    host.innerHTML = '<div class="cw-page cw-combat"><header class="cw-page-head"><div><h2 class="cw-page-title">Combat</h2>' +
      '<p class="cw-page-sub">' + (isDm ? 'Run turns, attacks and effects. Rolls and results go through you; the tracker keeps the numbers and the log.' : 'The Dungeon Master\'s encounter. On your turn, pick an attack and send it to the DM.') + '</p></div>' +
      '<p class="cw-live" id="cb-save" aria-live="polite"></p></header>' +
      '<div id="cb-body"></div>' +
      '<details class="cw-card cw-dice-card"' + (diceOpen ? ' open' : '') + '><summary><span class="cw-card-title">🎲 Dice</span> <span class="cw-muted cw-dice-sum" id="cb-dice-last">roll for anything at the table (rolls are private to you)</span></summary><div id="cb-dice"></div></details></div>';
    var body = host.querySelector('#cb-body');
    var saveEl = host.querySelector('#cb-save');

    function drawSave() {
      var s = saveState;
      saveEl.className = 'cw-live' + (s.status === 'saved' ? ' is-on' : '') + (s.status === 'error' || s.status === 'conflict' ? ' is-error' : '');
      saveEl.innerHTML = s.status === 'saving' ? 'Saving…' : s.status === 'saved' ? '● Saved' :
        s.status === 'error' ? 'Not saved: ' + esc(s.message) + ' <button type="button" class="cv-link-btn" data-cb="retry-save">Retry</button>' :
        s.status === 'conflict' ? esc(s.message) + ' <button type="button" class="cv-link-btn" data-cb="reload">Reload</button>' : '';
    }

    async function persist() {
      if (!isDm || !enc) return;
      if (saving) { dirty = true; return; }
      saving = true;
      do {
        dirty = false;
        saveState = { status: 'saving' };
        drawSave();
        var res = await D().saveCombat(ctx.id, M().clone(enc), version);
        if (!alive) { saving = false; return; }
        if (res.ok) { version = res.version; saveState = { status: 'saved' }; }
        else { saveState = res.conflict ? { status: 'conflict', message: res.message } : { status: 'error', message: res.message }; dirty = false; }
      } while (dirty);
      saving = false;
      drawSave();
    }
    function mutate(fn) {
      var res = fn(enc);
      if (res && res.ok === false) { UI().notice(res.message, 'error'); return res; }
      draw();
      persist();
      return res;
    }

    // ---- shared pieces ------------------------------------------------------------------------------------------
    function conditionChips(c, editable) {
      return c.conditions.map(function (n) {
        var tip = Sess().conditionText(n);
        return '<span class="cw-cond" title="' + esc(tip.slice(0, 220)) + '">' + esc(n) + (editable ? '<button type="button" class="cw-cond-x" data-cb="cond" data-id="' + esc(c.id) + '" data-name="' + esc(n) + '" aria-label="Remove ' + esc(n) + ' from ' + esc(c.name) + '">×</button>' : '') + '</span>';
      }).join('');
    }
    function conditionHelp(c) {
      if (!c.conditions.length) return '';
      return '<details class="cw-stage-help"><summary>What ' + (c.conditions.length === 1 ? 'this condition does' : 'these conditions do') + '</summary><ul>' +
        c.conditions.map(function (n) { var t = Sess().conditionText(n) || ''; var dot = t.search(/\.\s/); var first = dot > 0 ? t.slice(0, dot + 1) : t; return '<li><strong>' + esc(n) + '.</strong> ' + esc(first.slice(0, 240)) + '</li>'; }).join('') + '</ul></details>';
    }
    function pausedRibbon() { return '<p class="cw-ribbon is-paused" role="alert"><strong>⏸ Combat paused.</strong> ' + (isDm ? 'Turns are frozen until you resume.' : 'The Dungeon Master paused the fight.') + '</p>'; }
    function stateLabel(e) {
      return e.status === 'active' ? (e.paused ? '<span class="cw-state is-paused">Paused</span>' : '<span class="cw-state is-live">In progress</span>') : e.status === 'ended' ? '<span class="cw-state">Ended</span>' : '<span class="cw-state">Not started</span>';
    }
    function publicVitals(c, big) {
      if (c.kind === 'pc') return '<span class="cw-hp' + (big ? ' is-big' : '') + '"><span class="cw-stat-l">HP</span><strong>' + c.hp + '</strong><span class="cw-hp-max"> / ' + c.hpMax + '</span>' + (c.tempHp ? ' <span class="cw-temp">+' + c.tempHp + ' temp</span>' : '') + '</span>' + hpBar(c, big ? 'is-big' : '') + acBadge(c.ac, big);
      return '<span class="cv-pill ' + (c.health === 'unhurt' ? 'is-ok' : 'is-warn') + (big ? ' is-big' : '') + '">' + HEALTH_LABEL[c.health] + '</span>';
    }
    function rail(list, curId, nextId, opts) {
      if (!list.length) return '';
      var turn = 0;
      return '<nav class="cw-rail-wrap" aria-label="Initiative order"><ol class="cw-rail">' + list.map(function (c) {
        var dead = opts.defeated(c);
        if (!dead && c.initiative != null) turn += 1;
        var cls = (c.id === curId ? ' is-current' : '') + (c.id === nextId ? ' is-next' : '') + (dead ? ' is-defeated' : '') + (c.hidden ? ' is-hidden' : '') + (c.userId && c.userId === ctx.me.id ? ' is-mine' : '');
        var mark = c.id === curId ? '<span class="cw-rail-mark is-now">Now</span>' : c.id === nextId ? '<span class="cw-rail-mark is-next">Next</span>' : dead ? '<span class="cw-rail-mark">Out</span>' : c.hidden ? '<span class="cw-rail-mark" title="Hidden from players">Hidden</span>' : '<span class="cw-rail-mark is-pos">' + (c.initiative == null ? '' : '#' + turn) + '</span>';
        var pct = c.hpMax ? Math.max(0, Math.min(100, Math.round((c.hp / c.hpMax) * 100))) : null;
        var life = opts.exact(c) && pct != null ? '<span class="cw-rail-hp" aria-hidden="true"><i class="' + (pct <= 50 ? 'is-low' : '') + '" style="width:' + pct + '%"></i></span>' : '<span class="cw-rail-health">' + (c.health ? HEALTH_LABEL[c.health] : '') + '</span>';
        return '<li class="cw-rail-item' + cls + '"' + (c.id === curId ? ' aria-current="true"' : '') + '><button type="button" data-jump="' + esc(c.id) + '" title="Select ' + esc(c.name) + '">' +
          '<span class="cw-rail-init">' + (c.initiative == null ? '—' : c.initiative) + '</span><span class="cw-rail-name">' + esc(c.name) + (c.userId && c.userId === ctx.me.id ? ' (you)' : '') + '</span>' + life + mark + '</button></li>';
      }).join('') + '</ol><p class="cw-rail-legend" aria-hidden="true"><span class="is-now">Now</span><span class="is-next">Next</span><span class="is-out">Defeated</span>' + (isDm ? '<span class="is-hid">Hidden from players</span>' : '') + '<span>Tap a name to select it</span></p></nav>';
    }

    function logCard() {
      if (!enc || !enc.log || !enc.log.length) return '';
      var lines = enc.log.slice().reverse();
      var show = view === 'advanced' ? lines.slice(0, 60) : lines.slice(0, 4);
      return '<section class="cw-card cw-log" aria-label="Combat log"><h3 class="cw-card-title">Combat log <span class="cw-muted">· ' + enc.log.length + ' entries</span></h3><ol>' +
        show.map(function (l) { return '<li><span class="cw-muted">R' + l.round + '</span> ' + esc(l.text) + '</li>'; }).join('') + '</ol>' +
        (view === 'basic' && lines.length > 4 ? '<p class="cw-muted cw-fine">Switch to Advanced to see the whole log.</p>' : '') + '</section>';
    }

    // ---- the actions panel ---------------------------------------------------------------------------------------
    function inFightList() { return enc.combatants.filter(function (c) { return !c.removed && !(isDm ? M().isDefeated(c) : c.defeated); }); }
    function selected() {
      if (!enc) return null;
      var pool = enc.combatants;
      var s = selectedId && pool.find(function (c) { return c.id === selectedId; });
      if (s) return s;
      if (!isDm) return pool.find(function (c) { return c.userId === ctx.me.id; }) || null;
      return M().currentCombatant(enc) || inFightList()[0] || null;
    }
    function actionsOf(c) { try { return A().forCombatant(c, ctx); } catch (e) { return []; } }
    function monsterEntry(c) { return c && c.ref && global.FogCompendium ? global.FogCompendium.monsters().find(function (m) { return m.key === c.ref; }) : null; }
    function saveBonus(c, ability) {
      if (c && c.kind === 'pc') return pcSaveBonus(c, ability);
      var e = monsterEntry(c);
      var v = e && e.abilities && e.abilities[ability] ? parseInt(String(e.abilities[ability].save || e.abilities[ability].mod || '0').replace('−', '-'), 10) : null;
      return isFinite(v) ? v : null;
    }
    /** A character's saving throw modifier from the shared sheet (rules engine), or null when it can't be read. */
    function pcSaveBonus(c, ability) {
      var m = ctx.campaign.roster.find(function (r) { return r.userId === c.userId; });
      var s = m && m.character && global.FogCampaignParty ? global.FogCampaignParty.summarize(m.character, ctx.campaign) : null;
      var st = s && s.derived && s.derived.savingThrows && s.derived.savingThrows[ability];
      return st && isFinite(st.modifier) ? st.modifier : null;
    }
    var X = function () { return global.FogCombatAuto; };
    /** Damage defenses: from the stat block for monsters; characters' resistances aren't on the shared sheet (null). */
    function defensesOf(c) { return c && c.kind !== 'pc' && X() ? X().defenses(monsterEntry(c)) : null; }

    function actionPanel() {
      var c = selected();
      if (!c) return '<section class="cw-card cw-act" aria-label="Actions"><p class="cw-muted">Select a combatant to see what it can do.</p></section>';
      var mine = !isDm && c.userId === ctx.me.id;
      var canAct = isDm ? !archived : mine;
      var head = '<header class="cw-act-head"><div><span class="cw-eyebrow">' + (enc.turnId === c.id ? 'Acting now' : 'Selected') + '</span><h3 class="cw-act-name">' + esc(c.name) + (mine ? ' (you)' : '') + '</h3>' +
        '<span class="cw-muted">' + KIND_LABEL[c.kind] + '</span></div><div class="cw-act-vitals">' + (isDm || c.kind === 'pc' ? publicVitals(isDm ? Object.assign({}, c, { kind: 'pc' }) : c, false) : publicVitals(c, false)) + '</div></header>' +
        (c.conditions.length ? '<div class="cw-row-conds">' + conditionChips(c, isDm && !archived) + '</div>' : '');
      if (!canAct) return '<section class="cw-card cw-act" aria-label="Actions for ' + esc(c.name) + '">' + head + '<p class="cw-muted">' + (isDm ? 'This campaign is archived.' : 'You can act only with your own character.') + '</p></section>';
      if (flow && flow.attackerId === c.id) return '<section class="cw-card cw-act is-flow" aria-label="Action in progress">' + head + flowHtml(c) + '</section>';
      var acts = actionsOf(c);
      var playable = acts.filter(function (a) { return a.type !== 'text'; });
      var other = acts.filter(function (a) { return a.type === 'text'; });
      var myTurn = enc.status === 'active' && enc.turnId === c.id && !enc.paused;
      var groups = {};
      playable.forEach(function (a) { (groups[a.group] = groups[a.group] || []).push(a); });
      var list = Object.keys(groups).map(function (g) {
        return '<div class="cw-act-group"><h4>' + esc(GROUP_LABEL[g] || g) + '</h4><div class="cw-act-btns">' + groups[g].map(function (a) {
          return '<button type="button" class="cw-actbtn is-' + a.type + '" data-cb="act" data-action="' + esc(a.id) + '" data-id="' + esc(c.id) + '"' + (!isDm && !myTurn ? ' disabled' : '') + ' title="' + esc(a.text.slice(0, 300)) + '"><strong>' + esc(a.name) + '</strong><span>' + esc(actionLine(a)) + '</span></button>';
        }).join('') + '</div></div>';
      }).join('');
      var others = other.length ? '<details class="cw-act-more"><summary>Other abilities (' + other.length + ')</summary><ul>' + other.map(function (a) {
        return '<li><strong>' + esc(a.name) + '.</strong> ' + esc(a.text.slice(0, 500)) + (isDm ? ' <button type="button" class="cv-link-btn" data-cb="use-text" data-action="' + esc(a.id) + '" data-id="' + esc(c.id) + '">Use (log it)</button>' : '') + '</li>';
      }).join('') + '</ul></details>' : '';
      var empty = !acts.length ? '<p class="cw-muted">' + (c.kind === 'pc' ? 'No attacks found on this character sheet.' : c.ref ? 'No actions in this stat block.' : 'A custom combatant has no stat block: use Play manually.') + '</p>' : '';
      var waitNote = !isDm && !myTurn ? '<p class="cw-muted cw-fine">Your actions unlock on your turn.</p>' : '';
      var mineReq = !isDm ? requests.filter(function (r) { return r.attackerId === c.id; }).slice(-3).reverse() : [];
      var reqHtml = mineReq.length ? '<div class="cw-myreqs"><h4>Sent to the DM</h4><ul>' + mineReq.map(function (r) {
        return '<li><strong>' + esc(r.action.name || 'Attack') + '</strong> → ' + esc(r.targetIds.map(nameOf).join(', ')) + ' <span class="cw-reqstate is-' + r.status + '">' + ({ pending: 'Waiting for the DM', applied: 'Applied', rejected: 'Rejected', cancelled: 'Cancelled' }[r.status] || r.status) + '</span>' + (r.note ? ' <span class="cw-muted">' + esc(r.note) + '</span>' : '') + (r.status === 'pending' ? ' <button type="button" class="cv-link-btn" data-cb="req-cancel" data-req="' + esc(r.id) + '">Cancel</button>' : '') + '</li>';
      }).join('') + '</ul></div>' : '';
      return '<section class="cw-card cw-act" aria-label="Actions for ' + esc(c.name) + '">' + head + empty + list + others + waitNote +
        '<div class="cw-act-tools">' + (isDm || myTurn ? '<button type="button" class="btn btn-secondary btn-sm" data-cb="manual" data-id="' + esc(c.id) + '">Play manually</button>' : '') +
        (foggyOk ? '<button type="button" class="btn btn-secondary btn-sm" data-cb="ask-foggy" data-id="' + esc(c.id) + '">Ask Foggy</button>' : '') +
        (isDm && enc.status === 'active' && enc.turnId === c.id ? '<button type="button" class="btn btn-primary btn-sm" data-cb="next">End turn</button>' : '') + '</div>' +
        adviceHtml(c) + reqHtml + (isDm ? overrides(c) : '') + '</section>';
    }
    function nameOf(id) { var c = enc && enc.combatants.find(function (x) { return x.id === id; }); return c ? c.name : 'someone'; }

    function overrides(c) {
      return '<details class="cw-act-override"' + (view === 'advanced' ? ' open' : '') + '><summary>Adjust hit points (DM override)</summary><div class="cw-hpform cw-override"><label class="cw-visually-hidden" for="ov-' + esc(c.id) + '">Amount for ' + esc(c.name) + '</label>' +
        '<input id="ov-' + esc(c.id) + '" class="cw-num" type="number" min="1" inputmode="numeric" placeholder="HP" data-amt="' + esc(c.id) + '">' +
        '<button type="button" class="cw-mini-btn is-heal" data-cb="heal" data-id="' + esc(c.id) + '">Heal</button><button type="button" class="cw-mini-btn is-dmg" data-cb="reduce" data-id="' + esc(c.id) + '" title="Take hit points away without an attack (falling, traps, corrections)">Reduce HP</button>' +
        (view === 'advanced' ? '<button type="button" class="cw-mini-btn" data-cb="temp" data-id="' + esc(c.id) + '" title="Set Temporary Hit Points to the amount typed">Set temp HP</button>' : '') + '</div>' +
        '<p class="cw-muted cw-fine">For healing and corrections. Attacks go through the action buttons above so the roll and the result are logged. Enter heals; Shift+Enter reduces.</p></details>';
    }

    function adviceHtml(c) {
      if (!advice || advice.forId !== c.id) return '';
      if (advice.loading) return '<div class="cw-advice" role="status"><span class="cw-spin" aria-hidden="true"></span> Foggy is thinking…</div>';
      if (advice.error) return '<div class="cw-advice is-error" role="alert">' + esc(advice.error) + '</div>';
      return '<div class="cw-advice" role="status"><p class="cw-advice-h"><strong>Foggy suggests</strong>' + (advice.action ? ': ' + esc(advice.action) + (advice.targetIds.length ? ' → ' + esc(advice.targetIds.map(nameOf).join(', ')) : '') : '') + '</p>' +
        '<p>' + esc(advice.reply) + '</p>' + (advice.reason ? '<p class="cw-muted">' + esc(advice.reason) + '</p>' : '') +
        (advice.invented ? '<p class="cw-muted cw-fine">Foggy named an ability this creature doesn\'t have, so it was ignored.</p>' : '') +
        '<div class="cw-actions">' + (advice.action ? '<button type="button" class="btn btn-primary btn-sm" data-cb="use-advice" data-id="' + esc(c.id) + '">Prepare this action</button>' : '') +
        '<button type="button" class="cv-link-btn" data-cb="dismiss-advice">Dismiss</button></div><p class="cw-muted cw-fine">A suggestion only: nothing happens until you roll and apply it.</p></div>';
    }

    // ---- the workflow ----
    function startFlow(c, action, targets) {
      flow = { mode: action ? 'attack' : 'manual', attackerId: c.id, actionId: action ? action.id : '', action: action || null, targets: targets || [], rollMode: 'normal', d20: [], attackTotal: null, hit: {}, saves: {}, damage: null, damageText: '', perTarget: {}, manual: { name: '', roll: '', rollText: '', amount: '', condition: '', note: '' } };
    }
    function targetPool(attacker) {
      var list = isDm ? inFightList() : enc.combatants.filter(function (c) { return !c.defeated; });
      return list.filter(function (c) { return c.id !== attacker.id || (flow && flow.mode === 'manual'); });
    }
    function flowHtml(c) {
      var f = flow;
      var a = f.action;
      var multi = !a || a.type === 'save' && a.multi || f.mode === 'manual';
      var pool = targetPool(c);
      var targetsHtml = '<fieldset class="cw-flow-step"><legend>1. Target' + (multi ? 's' : '') + '</legend><div class="cw-targets">' + (pool.length ? pool.map(function (t) {
        var on = f.targets.indexOf(t.id) >= 0;
        return '<label class="cw-target' + (on ? ' is-on' : '') + '"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="cb-target" data-cb="target" value="' + esc(t.id) + '"' + (on ? ' checked' : '') + '> ' + esc(t.name) +
          (isDm && t.ac != null ? ' <span class="cw-muted">AC ' + t.ac + '</span>' : '') + (t.kind === 'pc' || isDm ? '' : ' <span class="cw-muted">' + esc(HEALTH_LABEL[t.health] || '') + '</span>') + '</label>';
      }).join('') : '<p class="cw-muted">Nobody to target.</p>') + '</div></fieldset>';
      var title = '<div class="cw-flow-title"><strong>' + esc(a ? a.name : 'Play manually') + '</strong>' + (a ? ' <span class="cw-muted">' + esc(actionLine(a)) + '</span>' : '') + '<button type="button" class="cv-link-btn" data-cb="flow-cancel">Cancel</button></div>' + (a && a.text ? '<p class="cw-muted cw-fine">' + esc(a.text.slice(0, 400)) + '</p>' : '');
      if (f.mode === 'manual') return title + manualHtml(c, targetsHtml);
      var steps = '';
      if (a.type === 'attack') {
        var r = f.d20.length ? A().resolveAttack({ action: a, d20: f.d20, mode: f.rollMode, ac: null }) : null;
        var sugg = X() && f.targets.length === 1 ? X().rollModeFor(c, M().find(enc, f.targets[0]), a.attackKind) : null;
        steps += '<fieldset class="cw-flow-step"><legend>2. Attack roll</legend>' + (sugg && sugg.why.length ? '<p class="cw-muted cw-fine">' + (sugg.mode === 'normal' ? 'Advantage and disadvantage cancel out' : 'Suggested: <strong>' + sugg.mode + '</strong>') + ' (' + esc(sugg.why.join('; ')) + ').</p>' : '') + '<div class="cw-flow-row"><select class="cw-select" data-cb="rollmode" aria-label="Advantage or disadvantage"><option value="normal"' + (f.rollMode === 'normal' ? ' selected' : '') + '>Normal</option><option value="advantage"' + (f.rollMode === 'advantage' ? ' selected' : '') + '>Advantage</option><option value="disadvantage"' + (f.rollMode === 'disadvantage' ? ' selected' : '') + '>Disadvantage</option></select>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-cb="roll-attack">Roll d20 ' + signed(a.bonus) + '</button><label class="cw-inline">or the d20 rolled at the table <input class="cw-num" type="number" min="1" max="20" data-cb="d20" value="' + (f.d20.length === 1 && f.manualD20 ? f.d20[0] : '') + '" aria-label="The d20 result"></label></div>' +
          (r && !r.needsRoll ? '<p class="cw-flow-result">' + (f.d20.length > 1 ? 'Rolled ' + f.d20.join(' and ') + ', took ' + r.nat + ': ' : 'Rolled ' + r.nat + ': ') + '<strong>' + r.total + '</strong> to hit' + (r.crit ? ' — <strong class="cw-crit">critical hit!</strong>' : r.nat === 1 ? ' — natural 1, a miss' : '') + '</p>' : '') + '</fieldset>';
        if (r && !r.needsRoll && f.targets.length) {
          steps += '<fieldset class="cw-flow-step"><legend>3. Hit or miss</legend>' + f.targets.map(function (id) {
            var t = enc.combatants.find(function (x) { return x.id === id; });
            var auto = A().resolveAttack({ action: a, d20: f.d20, mode: f.rollMode, ac: isDm && t ? t.ac : null });
            var val = f.hit[id] != null ? f.hit[id] : auto.hit;
            if (f.hit[id] == null && auto.hit != null) f.hit[id] = auto.hit;
            return '<div class="cw-flow-row"><span>' + esc(t ? t.name : id) + (isDm && t && t.ac != null ? ' (AC ' + t.ac + ')' : '') + '</span>' +
              (isDm ? '<select class="cw-select" data-cb="hitsel" data-target="' + esc(id) + '"><option value="">Decide…</option><option value="1"' + (val === true ? ' selected' : '') + '>Hit</option><option value="0"' + (val === false ? ' selected' : '') + '>Miss</option></select>' : '<span class="cw-muted">The DM checks it against the AC.</span>') + '</div>';
          }).join('') + '</fieldset>';
        }
      } else if (a.type === 'save') {
        steps += '<fieldset class="cw-flow-step"><legend>2. Saving throws (DC ' + a.dc + ' ' + esc(a.abilityName) + ')</legend>' + (f.targets.length ? f.targets.map(function (id) {
          var t = enc.combatants.find(function (x) { return x.id === id; });
          var bonus = isDm && t && t.kind !== 'pc' ? saveBonus(t, a.ability) : null;
          var s = f.saves[id];
          return '<div class="cw-flow-row"><span>' + esc(t ? t.name : id) + '</span><input class="cw-num" type="number" data-cb="save" data-target="' + esc(id) + '" value="' + (s == null ? '' : s) + '" placeholder="Total" aria-label="Saving throw total for ' + esc(t ? t.name : id) + '">' +
            (bonus != null ? '<button type="button" class="cw-mini-btn" data-cb="roll-save" data-target="' + esc(id) + '" data-bonus="' + bonus + '">Roll d20 ' + signed(bonus) + '</button>' : '<span class="cw-muted cw-fine">' + (t && t.kind === 'pc' ? 'the player rolls' : 'type the result') + '</span>') +
            (s != null ? '<span class="' + (s >= a.dc ? 'cw-ok' : 'cw-warn-text') + '">' + (s >= a.dc ? 'Success' : 'Failure') + '</span>' : '') + '</div>';
        }).join('') : '<p class="cw-muted">Choose the targets first.</p>') + '</fieldset>';
      }
      var ready = f.targets.length && (a.type === 'attack' ? f.d20.length : f.targets.every(function (id) { return f.saves[id] != null; }));
      if (ready && a.damage.length) {
        var anyCrit = a.type === 'attack' && A().resolveAttack({ action: a, d20: f.d20, mode: f.rollMode }).crit;
        var dice = A().damageDice(a, anyCrit).join(' + ');
        steps += '<fieldset class="cw-flow-step"><legend>' + (a.type === 'attack' ? '4' : '3') + '. Damage</legend><div class="cw-flow-row"><button type="button" class="btn btn-secondary btn-sm" data-cb="roll-damage">Roll ' + esc(dice) + (anyCrit ? ' (critical: dice doubled)' : '') + '</button>' +
          '<label class="cw-inline">or the total <input class="cw-num" type="number" min="0" data-cb="dmgtotal" value="' + (f.damage == null ? '' : f.damage) + '" aria-label="Damage total"></label>' + (f.damageText ? '<span class="cw-muted">' + esc(f.damageText) + '</span>' : '') + '</div>' +
          (f.damage != null && isDm ? f.targets.map(function (id) {
            var t = enc.combatants.find(function (x) { return x.id === id; });
            var amount = amountFor(id);
            var dn = flow.perTarget[id] != null ? 'your amount' : defenseFor(id).note;
            return '<div class="cw-flow-row"><span>' + esc(t ? t.name : id) + '</span><input class="cw-num" type="number" min="0" data-cb="pertarget" data-target="' + esc(id) + '" value="' + amount + '" aria-label="Damage to ' + esc(t ? t.name : id) + '"> <span class="cw-muted">' + esc(a.damage.map(function (d) { return d.type; }).join(' + ')) + (dn ? ' · ' + esc(dn) : '') + '</span></div>';
          }).join('') : '') + '</fieldset>';
      }
      var fc = isDm ? flowConditions() : [];
      if (ready && fc.length) {
        if (f.applyCond == null) f.applyCond = true;
        steps += '<fieldset class="cw-flow-step"><legend>Conditions</legend><label class="cw-check"><input type="checkbox" data-cb="applycond"' + (f.applyCond ? ' checked' : '') + '> On a ' + (a.type === 'attack' ? 'hit' : 'failed save') + ', also apply: <strong>' + esc(fc.join(', ')) + '</strong></label>' +
          '<p class="cw-muted cw-fine">Read from the ability text. Escape DCs and durations stay as written there; creatures immune to a condition are skipped.</p></fieldset>';
      }
      var canApply = ready && (!a.damage.length || f.damage != null) && (a.type !== 'attack' || !isDm || f.targets.every(function (id) { return f.hit[id] != null; }));
      var canAuto = isDm && f.targets.length && (a.type === 'attack' || f.targets.every(function (id) { var t = M().find(enc, id); return f.saves[id] != null || (t && saveBonus(t, a.ability) != null); }));
      return title + targetsHtml + steps +
        '<div class="cw-actions">' + (isDm && !canApply && canAuto ? '<button type="button" class="btn btn-secondary btn-sm" data-cb="auto-resolve" title="Roll everything that is still missing and check it against AC / DC">⚡ Roll &amp; resolve</button>' : '') + (isDm ? '<button type="button" class="btn btn-primary btn-sm" data-cb="apply"' + (canApply ? '' : ' disabled') + '>Apply</button>' : '<button type="button" class="btn btn-primary btn-sm" data-cb="send"' + (ready && (!a.damage.length || f.damage != null) ? '' : ' disabled') + '>Send to the DM</button>') +
        '<button type="button" class="btn btn-secondary btn-sm" data-cb="flow-cancel">Cancel</button></div>';
    }
    function rawAmountFor(id) {
      var f = flow, a = f.action;
      if (f.damage == null) return 0;
      if (a.type === 'attack') return f.hit[id] === false ? 0 : f.damage;
      var res = A().resolveAttack({ action: a, saveTotal: f.saves[id], damageRolled: f.damage });
      return res.damage || 0;
    }
    /** Damage for one target after immunity / resistance / vulnerability (monsters), unless the DM typed an override. */
    function defenseFor(id) {
      var t = M().find(enc, id);
      var raw = rawAmountFor(id);
      if (!X() || !t) return { amount: raw, note: '' };
      if (t.kind === 'pc') return { amount: raw, note: raw ? 'character resistances aren\'t on the shared sheet: adjust if needed' : '' };
      return X().adjust(raw, (flow.action.damage || []).map(function (d) { return d.type; }), defensesOf(t));
    }
    function amountFor(id) {
      if (flow.perTarget[id] != null) return flow.perTarget[id];
      return defenseFor(id).amount;
    }
    /** Conditions the action imposes on a hit / failed save (from its text), minus the target's condition immunities. */
    function flowConditions() { return flow && flow.action && X() ? X().conditionsIn(flow.action.type === 'attack' ? flow.action.onHit : flow.action.onFail).filter(function (cn) { return conditions.indexOf(cn) >= 0; }) : []; }
    function affected(id) { var f = flow; return f.action.type === 'attack' ? f.hit[id] === true : f.saves[id] != null && f.saves[id] < f.action.dc; }
    function manualHtml(c, targetsHtml) {
      var f = flow, m = f.manual;
      var acts = actionsOf(c);
      var free = conditions;
      return '<fieldset class="cw-flow-step"><legend>What</legend><div class="cw-flow-row"><select class="cw-select" data-cb="man-action" aria-label="Action"><option value="">Other (type a name)</option>' +
        acts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (f.actionId === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select>' +
        (f.actionId ? '' : '<input class="form-control cw-man-name" data-cb="man-name" maxlength="80" placeholder="Action name" value="' + esc(m.name) + '" aria-label="Action name">') + '</div></fieldset>' +
        targetsHtml +
        '<fieldset class="cw-flow-step"><legend>Roll (optional)</legend><div class="cw-flow-row"><input class="form-control cw-man-dice" data-cb="man-dice" placeholder="e.g. d20+5 or 2d6+3" value="' + esc(m.roll) + '" aria-label="Dice to roll"><button type="button" class="btn btn-secondary btn-sm" data-cb="man-roll">Roll</button>' + (m.rollText ? '<span class="cw-flow-result">' + esc(m.rollText) + '</span>' : '') + '</div></fieldset>' +
        '<fieldset class="cw-flow-step"><legend>Result</legend><div class="cw-flow-row"><label class="cw-inline">Damage to each target <input class="cw-num" type="number" min="0" data-cb="man-amount" value="' + esc(m.amount) + '"></label>' +
        (isDm ? '<select class="cw-select" data-cb="man-cond" aria-label="Condition to apply"><option value="">No condition</option>' + free.map(function (n) { return '<option' + (m.condition === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' : '') + '</div>' +
        '<input class="form-control" data-cb="man-note" maxlength="160" placeholder="Note for the log (optional)" value="' + esc(m.note) + '" aria-label="Note"></fieldset>' +
        '<div class="cw-actions">' + (isDm ? '<button type="button" class="btn btn-primary btn-sm" data-cb="man-apply">Apply</button>' + (enc.status === 'active' && enc.turnId === c.id ? '<button type="button" class="btn btn-secondary btn-sm" data-cb="man-apply-end">Apply and end turn</button>' : '') : '<button type="button" class="btn btn-primary btn-sm" data-cb="man-send">Send to the DM</button>') +
        '<button type="button" class="btn btn-secondary btn-sm" data-cb="flow-cancel">Cancel</button></div>';
    }

    // ---- DM: player requests ----
    function requestsPanel() {
      var pending = requests.filter(function (r) { return r.status === 'pending'; });
      if (!pending.length) return '';
      return '<section class="cw-card cw-requests" aria-label="Player attacks waiting"><h3 class="cw-card-title">Player attacks waiting <span class="cv-pill is-warn">' + pending.length + '</span></h3><ul>' + pending.map(function (r) {
        var a = r.action || {};
        var attacker = nameOf(r.attackerId);
        return '<li class="cw-request" data-req="' + esc(r.id) + '"><p><strong>' + esc(attacker) + '</strong> uses <strong>' + esc(a.name || 'an attack') + '</strong> on ' + esc(r.targetIds.map(nameOf).join(', ')) + '</p>' +
          '<p class="cw-muted">' + (a.attackTotal != null ? 'Attack ' + a.attackTotal + (a.d20 ? ' (d20 ' + esc(String(a.d20)) + ' ' + signed(a.bonus || 0) + ')' : '') + (a.crit ? ', critical hit' : '') + '. ' : '') + (a.damage != null ? 'Damage ' + a.damage + (a.damageType ? ' ' + esc(a.damageType) : '') + (a.damageText ? ' (' + esc(a.damageText) + ')' : '') + '. ' : '') + (a.note ? esc(a.note) : '') + '</p>' +
          r.targetIds.map(function (id) {
            var t = enc && enc.combatants.find(function (x) { return x.id === id; });
            var hit = a.attackTotal == null ? true : a.crit ? true : t && t.ac != null ? a.attackTotal >= t.ac : true;
            return '<div class="cw-flow-row"><span>' + esc(t ? t.name : 'Gone') + (t && t.ac != null ? ' (AC ' + t.ac + ')' : '') + '</span><select class="cw-select" data-req-hit="' + esc(id) + '"><option value="1"' + (hit ? ' selected' : '') + '>Hit</option><option value="0"' + (hit ? '' : ' selected') + '>Miss</option></select>' +
              '<input class="cw-num" type="number" min="0" data-req-dmg="' + esc(id) + '" value="' + (a.damage != null ? (hit ? a.damage : 0) : 0) + '" aria-label="Damage to ' + esc(t ? t.name : id) + '"></div>';
          }).join('') +
          '<div class="cw-actions"><button type="button" class="btn btn-primary btn-sm" data-cb="req-apply" data-req="' + esc(r.id) + '">Apply</button><button type="button" class="btn btn-secondary btn-sm" data-cb="req-reject" data-req="' + esc(r.id) + '">Reject</button></div></li>';
      }).join('') + '</ul></section>';
    }

    // ---- DM view ------------------------------------------------------------------------------------------------
    function dmRow(c, active, order) {
      var current = enc.status === 'active' && enc.turnId === c.id;
      var upNext = enc.status === 'active' && M().nextUp(enc) && M().nextUp(enc).id === c.id;
      var defeated = M().isDefeated(c);
      var adv = view === 'advanced';
      var free = conditions.filter(function (n) { return c.conditions.indexOf(n) < 0; });
      var pos = order.findIndex(function (x) { return x.id === c.id; });
      var sel = selected();
      var tag = current ? '<span class="cw-tag is-now">Now</span>' : upNext ? '<span class="cw-tag is-next">Next</span>' : '';
      return '<li class="cw-row' + (current ? ' is-current' : '') + (upNext ? ' is-next' : '') + (defeated ? ' is-defeated' : '') + (c.hidden ? ' is-hidden' : '') + (sel && sel.id === c.id ? ' is-selected' : '') + '" data-id="' + esc(c.id) + '" id="cb-row-' + esc(c.id) + '"' + (current ? ' aria-current="true"' : '') + '>' +
        '<div class="cw-row-init"><label class="cw-visually-hidden" for="ini-' + esc(c.id) + '">Initiative for ' + esc(c.name) + '</label>' +
        '<input id="ini-' + esc(c.id) + '" class="cw-num cw-init-input" type="number" inputmode="numeric" data-cb="init" data-id="' + esc(c.id) + '" value="' + (c.initiative == null ? '' : c.initiative) + '" placeholder="—" title="Initiative">' +
        '<button type="button" class="cw-mini-btn" data-cb="roll" data-id="' + esc(c.id) + '" title="Roll initiative: d20 ' + signed(c.initMod) + '">d20 ' + signed(c.initMod) + '</button></div>' +
        '<div class="cw-row-main"><div class="cw-row-name">' + tag + '<strong>' + esc(c.name) + '</strong>' +
        '<span class="cw-kind cw-kind-' + c.kind + '">' + KIND_LABEL[c.kind] + '</span>' + (c.hidden ? '<span class="cv-pill">Hidden from players</span>' : '') +
        (defeated ? '<span class="cv-pill is-warn">Defeated</span>' : (M().bloodied(c) ? '<span class="cv-pill is-warn">Bloodied</span>' : '')) +
        (adv && active && pos >= 0 ? '<span class="cw-muted"> · #' + (pos + 1) + '</span>' : '') + '</div>' +
        '<div class="cw-row-conds">' + conditionChips(c, true) +
        (free.length ? '<select class="cw-select cw-cond-add" data-cb="addcond" data-id="' + esc(c.id) + '" aria-label="Add a condition to ' + esc(c.name) + '"><option value="">+ Condition…</option>' + free.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select>' : '') + '</div></div>' +
        '<div class="cw-row-vitals"><span class="cw-hp"><span class="cw-stat-l">HP</span><strong>' + c.hp + '</strong><span class="cw-hp-max"> / ' + c.hpMax + '</span>' + (c.tempHp ? ' <span class="cw-temp">+' + c.tempHp + ' temp</span>' : '') + '</span>' + hpBar(c) + acBadge(c.ac) + '</div>' +
        '<div class="cw-row-tools" aria-label="DM actions for ' + esc(c.name) + '"><span class="cw-tools-l" aria-hidden="true">DM</span>' +
        '<button type="button" class="cw-mini-btn is-act" data-cb="select" data-id="' + esc(c.id) + '" title="Show what ' + esc(c.name) + ' can do">Actions</button>' +
        '<details class="cw-more"' + (adv ? ' open' : '') + '><summary>More</summary><div class="cw-row-more">' +
        (adv ? '<button type="button" class="cw-mini-btn" data-cb="hide" data-id="' + esc(c.id) + '">' + (c.hidden ? 'Reveal to players' : 'Hide from players') + '</button>' : '') +
        '<button type="button" class="cw-mini-btn is-dmg" data-cb="remove" data-id="' + esc(c.id) + '">Remove from combat</button></div></details></div></li>';
    }
    function pickerResults() {
      var q = pickerQuery.trim().toLowerCase();
      if (!q) return '<p class="cw-muted">Type a name to search ' + monsters.length + ' monsters (official rules and your homebrew).</p>';
      var hits = monsters.filter(function (m) { return m.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
      if (!hits.length) return '<p class="cw-muted">No monster matches "' + esc(pickerQuery) + '".</p>';
      return '<ul class="cw-picker-list">' + hits.map(function (m) {
        return '<li><span><strong>' + esc(m.name) + '</strong> <span class="cw-muted">CR ' + esc(m.cr) + ' · HP ' + esc(m.hpAverage != null ? m.hpAverage : m.hp) + ' · AC ' + esc(m.ac) + (m.dataset && m.dataset.origin === 'homebrew' ? ' · Homebrew' : '') + '</span></span>' +
          '<span class="cw-picker-add"><input class="cw-num" type="number" min="1" max="20" value="1" aria-label="How many ' + esc(m.name) + '" data-count="' + esc(m.key) + '"><button type="button" class="btn btn-secondary btn-sm" data-cb="addmonster" data-key="' + esc(m.key) + '">Add</button></span></li>';
      }).join('') + '</ul>';
    }
    function dmStage(order) {
      var cur = M().currentCombatant(enc);
      var up = M().nextUp(enc);
      var ids = order.map(function (c) { return c.id; });
      var after = up && ids.length > 2 ? order[(ids.indexOf(up.id) + 1) % ids.length] : null;
      if (after && cur && after.id === cur.id) after = null;
      var now = cur
        ? '<div class="cw-stage-now"><span class="cw-eyebrow">' + esc(enc.name) + ' · Round ' + enc.round + ' ' + stateLabel(enc) + '</span>' +
          '<span class="cw-stage-label">Now acting</span><strong class="cw-turnname">' + esc(cur.name) + '</strong>' +
          '<span class="cw-stage-kind">' + KIND_LABEL[cur.kind] + (cur.hidden ? ' · hidden from players' : '') + (M().bloodied(cur) ? ' · <span class="cw-warn-text">Bloodied</span>' : '') + '</span>' +
          '<div class="cw-stage-vitals"><span class="cw-hp is-big"><span class="cw-stat-l">HP</span><strong>' + cur.hp + '</strong><span class="cw-hp-max"> / ' + cur.hpMax + '</span>' + (cur.tempHp ? ' <span class="cw-temp">+' + cur.tempHp + ' temp</span>' : '') + '</span>' + hpBar(cur, 'is-big') + acBadge(cur.ac, true) + '</div>' +
          (cur.conditions.length ? '<div class="cw-row-conds cw-stage-conds">' + conditionChips(cur, true) + '</div>' + conditionHelp(cur) : '<p class="cw-stage-none">No conditions.</p>') +
          (archived ? '' : '<div class="cw-stage-quick"><button type="button" class="btn btn-secondary btn-sm" data-cb="select" data-id="' + esc(cur.id) + '">Show ' + esc(cur.name) + '\'s actions</button></div>') + '</div>'
        : '<div class="cw-stage-now"><span class="cw-eyebrow">Round ' + enc.round + ' ' + stateLabel(enc) + '</span><strong class="cw-turnname">Choose whose turn it is</strong><p class="cw-muted">Everyone in the order is defeated or removed. Add combatants or end the combat.</p></div>';
      var side = '<div class="cw-stage-side"><div class="cw-round"><span class="cw-round-l">Round</span><strong>' + enc.round + '</strong></div>' +
        (up ? '<div class="cw-stage-next"><span class="cw-upnext">Up next: <strong>' + esc(up.name) + '</strong></span><span class="cw-stage-mini">' + (up.ac != null ? 'AC ' + up.ac + ' · ' : '') + 'HP ' + up.hp + '/' + up.hpMax + '</span></div>' : '') +
        (after ? '<div class="cw-stage-after"><span class="cw-stage-l">Then</span> ' + esc(after.name) + '</div>' : '') + '</div>';
      return '<section class="cw-turnbar cw-stage' + (enc.paused ? ' is-paused' : '') + '" role="status" aria-label="Current turn">' + (enc.paused ? pausedRibbon() : '') + now + side + '</section>';
    }
    function dmControls() {
      var pending = requests.filter(function (r) { return r.status === 'pending'; }).length;
      return '<div class="cw-dmbar" role="toolbar" aria-label="Dungeon Master controls"><span class="cw-dmbar-l">DM controls</span>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-cb="prev"' + (enc.paused ? ' disabled' : '') + ' title="Go back one turn">← Previous</button>' +
        '<button type="button" class="btn btn-primary cw-nextbtn" data-cb="next"' + (enc.paused ? ' disabled' : '') + ' title="End this turn and move to the next creature">Next turn →</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-cb="' + (enc.paused ? 'resume' : 'pause') + '">' + (enc.paused ? 'Resume' : 'Pause') + '</button>' +
        (pending ? '<a class="cv-pill is-warn cw-dmbar-req" href="#cb-requests" data-cb="goto-req">' + pending + ' player attack' + (pending === 1 ? '' : 's') + ' waiting</a>' : '') +
        '<button type="button" class="btn btn-secondary btn-sm cw-dmbar-end" data-cb="end">End combat</button></div>';
    }
    function setupChecklist() {
      var inFight = enc.combatants.filter(function (c) { return !c.removed && !M().isDefeated(c); });
      var missing = M().missingInitiative(enc);
      var steps = [
        { done: inFight.length >= 1, label: inFight.length ? inFight.length + ' combatant' + (inFight.length === 1 ? '' : 's') + ' added' : 'Add the party and the monsters' },
        { done: inFight.length > 0 && !missing.length, label: !inFight.length ? 'Enter initiative' : missing.length ? 'Initiative missing for ' + missing.length + ': ' + missing.slice(0, 4).map(function (c) { return c.name; }).join(', ') + (missing.length > 4 ? '…' : '') : 'Everyone has initiative' },
        { done: false, label: 'Start combat' },
      ];
      var ready = steps[0].done && steps[1].done;
      var intro = inFight.length ? '' : '<div class="cw-howto"><strong>New to the tracker?</strong> 1. Add the party and the monsters below. 2. Type each initiative (players roll their own; use "Roll initiative for monsters &amp; NPCs" for the rest). 3. Start combat. On each turn, pick the creature\'s attack, its target, roll, and apply; then press <em>Next turn</em>.</div>';
      return '<section class="cw-card cw-setup-check" aria-label="Before you start">' + intro + '<ol class="cw-steps">' + steps.map(function (s, i) {
        var now = !s.done && steps.slice(0, i).every(function (x) { return x.done; });
        return '<li class="' + (s.done ? 'is-done' : now ? 'is-now' : '') + '"' + (now ? ' aria-current="step"' : '') + '><span class="cw-step-dot" aria-hidden="true">' + (s.done ? '✓' : i + 1) + '</span><span>' + esc(s.label) + '</span></li>';
      }).join('') + '</ol>' +
        '<div class="cw-actions"><button type="button" class="btn btn-primary" data-cb="start"' + (ready ? '' : ' aria-describedby="cb-start-why"') + '>Start combat</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-cb="rollall"' + (missing.some(function (c) { return c.kind !== 'pc'; }) ? '' : ' disabled') + '>Roll initiative for monsters &amp; NPCs</button>' +
        '<button type="button" class="cv-link-btn cv-danger" data-cb="clear">Discard encounter</button></div>' +
        (ready ? '' : '<p class="cw-muted cw-fine" id="cb-start-why">Player characters roll their own initiative at the table: type their results in the boxes on their cards.</p>') + '</section>';
    }
    /** Where the encounter came from, its music and map, and who plays the monsters' turns (DM). */
    function encBanner() {
      if (!enc) return '';
      var src = enc.source;
      var Cat = global.FogAudioCatalog;
      var track = enc.music && Cat && Cat.get ? Cat.get(String(enc.music).replace(/^rec:/, '')) : null;
      var mode = enc.autoMode || 'manual';
      var running = autoRun && !autoRun.stop;
      return '<section class="cw-card cw-encbanner" aria-label="Encounter">' +
        '<div class="cw-encbanner-row">' + (src && src.adventureTitle ? '<span>From <a href="' + esc('#content' + (src.sectionId ? '/' + encodeURIComponent(src.sectionId) : '')) + '">' + esc(src.adventureTitle) + '</a></span>' : '<span class="cw-muted">Encounter</span>') +
        (enc.music ? '<button type="button" class="btn btn-secondary btn-sm" data-cb="enc-music">▶ Play the encounter music' + (track ? ': ' + esc(track.name) : '') + '</button>' : '') +
        '<a class="btn btn-secondary btn-sm" href="#map">Map</a>' +
        '<label class="cw-inline cw-automode"><span>Monster turns</span><select class="cw-select" data-cb="automode"' + (archived ? ' disabled' : '') + '>' + ['manual', 'assist', 'auto'].map(function (k) { return '<option value="' + k + '"' + (mode === k ? ' selected' : '') + '>' + MODE_NAME[k] + '</option>'; }).join('') + '</select></label></div>' +
        (mode === 'auto' ? '<p class="cw-muted cw-fine">Full Auto: on a monster\'s or NPC\'s turn Foggy picks one of its real actions' + (foggyOk ? ' (asking Foggy, checked against the stat block)' : ' (its strongest action against the most wounded character; Foggy\'s own choice needs Foggy+)') + ', rolls, checks AC or the save DC, applies damage, resistances and conditions, logs it and moves on. Player characters are never played. Movement and positions aren\'t simulated.</p>' : '') +
        (mode === 'assist' ? '<p class="cw-muted cw-fine">Foggy Assist: ' + (foggyOk ? 'on each monster\'s turn Foggy suggests an action; you prepare, roll and apply it.' : 'needs Foggy+ for suggestions; you can still play every turn yourself.') + '</p>' : '') +
        (running ? '<div class="cw-autorun" role="status"><span class="cw-spin" aria-hidden="true"></span> <strong>' + esc(autoRun.status) + '</strong> <button type="button" class="btn btn-secondary btn-sm" data-cb="auto-stop">Stop — I\'ll play this turn</button></div>' : '') +
        '</section>';
    }
    function dmView() {
      if (!enc) {
        var advEnc = advEncounters();
        var advBtn = '';
        if (!archived && hasAdventure()) {
          if (advEnc.length) {
            advBtn = '<details class="cw-adv-enc"><summary class="btn btn-secondary">Load from adventure (' + advEnc.length + ')</summary><ul class="cw-enc-pick">' +
              advEnc.map(function (e) { return '<li><button type="button" class="cw-enc-pick-btn" data-cb="load-enc" data-enc-id="' + esc(e.id) + '"><strong>' + esc(e.name) + '</strong>' + (e.difficulty ? ' <span class="cw-muted">· ' + esc(e.difficulty) + '</span>' : '') + (e.monsters.length ? '<br><span class="cw-muted">' + e.monsters.map(function (m) { return m.count + '× ' + esc(m.name); }).join(', ') + '</span>' : '') + '</button></li>'; }).join('') +
              '</ul></details>';
          } else if (!advCache) {
            advBtn = '<button type="button" class="btn btn-secondary" data-cb="load-adv"' + (advLoading ? ' disabled' : '') + '>' + (advLoading ? 'Loading adventure…' : 'Load from adventure') + '</button>';
          }
        }
        return '<div class="cw-card cw-empty cw-empty-lg"><h3>No encounter yet</h3><p>Set one up with the party and the monsters you need, enter initiative, then start combat.</p>' +
          (archived ? '<p class="cw-muted">This campaign is archived.</p>' : '<button type="button" class="btn btn-primary" data-cb="new">Set up an encounter</button>' + advBtn) + '</div>';
      }
      var order = M().turnOrder(enc);
      var active = enc.status === 'active', setup = enc.status === 'setup';
      var ids = {};
      order.forEach(function (c) { ids[c.id] = 1; });
      var rest = enc.combatants.filter(function (c) { return !ids[c.id]; });
      var rows = order.concat(rest).map(function (c) { return dmRow(c, active, order); }).join('');
      var party = ctx.campaign.roster.filter(function (m) { return m.role === 'player' && m.character && !enc.combatants.some(function (c) { return c.kind === 'pc' && c.userId === m.userId; }); });
      var up = M().nextUp(enc);
      var phases = [['setup', 'Set up'], ['active', 'Fight'], ['ended', 'Ended']];
      var viewBar = '<div class="cw-viewbar"><ol class="cw-phase" aria-label="Encounter stage">' + phases.map(function (p) { return '<li class="' + (enc.status === p[0] ? 'is-on' : '') + '"' + (enc.status === p[0] ? ' aria-current="step"' : '') + '>' + p[1] + '</li>'; }).join('') + '</ol>' +
        '<div class="cw-modeswitch" role="group" aria-label="How much to show"><button type="button" class="cw-mode' + (view === 'basic' ? ' is-on' : '') + '" data-cb="view" data-view="basic" aria-pressed="' + (view === 'basic') + '">Basic</button>' +
        '<button type="button" class="cw-mode' + (view === 'advanced' ? ' is-on' : '') + '" data-cb="view" data-view="advanced" aria-pressed="' + (view === 'advanced') + '">Advanced</button></div>' +
        '<span class="cw-muted cw-viewhint">' + (view === 'basic' ? 'Turns, actions, hit points and conditions.' : 'Adds temporary HP, hiding creatures, order numbers, HP overrides and the full log.') + '</span></div>';
      var stage = active ? dmStage(order) + (archived ? '' : dmControls())
        : enc.status === 'ended'
          ? '<section class="cw-turnbar cw-stage is-ended" role="status"><div class="cw-stage-now"><span class="cw-eyebrow">' + stateLabel(enc) + '</span><strong class="cw-turnname">Combat ended after ' + enc.round + ' round' + (enc.round === 1 ? '' : 's') + '</strong>' +
            '<p class="cw-muted">' + enc.combatants.filter(function (c) { return M().isDefeated(c); }).length + ' defeated. Hit points stay as they were for reference until you clear the encounter.</p></div></section>' +
            (archived ? '' : '<div class="cw-dmbar" role="toolbar" aria-label="Dungeon Master controls"><span class="cw-dmbar-l">DM controls</span>' + (enc.source && enc.source.adventureId ? '<button type="button" class="btn btn-primary btn-sm" data-cb="back-to-adv">← Back to the adventure</button>' : '') + '<button type="button" class="btn btn-secondary btn-sm" data-cb="reopen">Back to setup</button><button type="button" class="btn btn-secondary btn-sm" data-cb="clear">Clear encounter</button></div>')
          : '';
      var setupPanel = setup ? setupChecklist() + '<section class="cw-card"><h3 class="cw-card-title">Add combatants</h3>' +
        '<div class="cw-setup-row"><button type="button" class="btn btn-secondary btn-sm" data-cb="addparty"' + (party.length ? '' : ' disabled') + '>Add the party (' + party.length + ')</button>' +
        '<form class="cw-custom" data-cb-form="custom"><input class="form-control" name="name" placeholder="Custom name" maxlength="80" required aria-label="Custom combatant name"><input class="cw-num" name="hp" type="number" min="1" placeholder="HP" aria-label="Hit points"><input class="cw-num" name="ac" type="number" min="0" placeholder="AC" aria-label="Armor Class"><input class="cw-num" name="mod" type="number" placeholder="Init ±" aria-label="Initiative modifier">' +
        '<select class="cw-select" name="kind" aria-label="Kind"><option value="monster">Monster</option><option value="npc">NPC</option></select><button type="submit" class="btn btn-secondary btn-sm">Add</button></form></div>' +
        '<label class="cw-field"><span>Monster from the bestiary</span><input class="form-control" type="search" id="cb-search" value="' + esc(pickerQuery) + '" placeholder="Search monsters…" autocomplete="off"></label>' +
        '<div id="cb-picker">' + pickerResults() + '</div></section>' +
        (hasAdventure() && enc.combatants.some(function (c) { return c.kind === 'monster'; }) ? '<p class="cw-muted cw-fine"><button type="button" class="cv-link-btn" data-cb="save-to-adv">Save this encounter to the adventure</button></p>' : '') : '';
      var railHtml = active ? rail(order.concat(rest.filter(function (c) { return !c.removed; })), enc.turnId, up && up.id, { defeated: M().isDefeated, exact: function () { return true; } }) : '';
      return encBanner() + viewBar + stage + railHtml + setupPanel + '<div id="cb-requests">' + requestsPanel() + '</div>' +
        '<div class="cw-combat-grid"><section class="cw-card cw-order"><h3 class="cw-card-title">' + esc(enc.name) + ' <span class="cw-muted">· ' + (active ? 'turn order' : 'combatants') + '</span></h3>' +
        (rows ? '<div class="cw-row-head" aria-hidden="true"><span>Initiative</span><span>Creature &amp; conditions</span><span>Vitals</span><span>DM</span></div><ol class="cw-rows">' + rows + '</ol>' : '<p class="cw-muted">Nobody yet. Add the party and some monsters.</p>') + '</section>' +
        (enc.combatants.length ? actionPanel() : '') + '</div>' + logCard() +
        '<p class="cw-muted cw-fine">Hit points here are for this encounter only; they are not written back to character sheets. Ties in initiative go to the higher modifier, then to whoever was added first. A monster at 0 HP is marked defeated and skipped; player characters stay in the order.</p>';
    }

    // ---- player view --------------------------------------------------------------------------------------------
    function turnGuide(me) {
      if (checklist.turn !== enc.turnId + ':' + enc.round) checklist = { turn: enc.turnId + ':' + enc.round, done: {} };
      return '<div class="cw-turnguide"><span class="cw-stage-l">On your turn</span><ul>' + TURN_PARTS.map(function (p) {
        var hint = p.key === 'move' && me && me.speed ? 'Up to ' + me.speed + ' ft., split before and after your action if you like.' : p.hint;
        return '<li><label class="cw-check"><input type="checkbox" data-turnpart="' + p.key + '"' + (checklist.done[p.key] ? ' checked' : '') + '> <span><strong>' + p.label + '</strong> <span class="cw-muted">' + esc(hint) + '</span></span></label></li>';
      }).join('') + '</ul><p class="cw-muted cw-fine">A reminder for you only; the DM still runs the turn. You also have one Reaction per round (for example an Opportunity Attack).</p></div>';
    }
    function playerView() {
      if (!enc || !enc.combatants || !enc.combatants.length) return '<div class="cw-card cw-empty cw-empty-lg"><h3>No encounter is running</h3><p>When the Dungeon Master starts combat, the turn order appears here.</p></div>';
      var byId = {};
      enc.combatants.forEach(function (c) { byId[c.id] = c; });
      var orderIds = enc.order || [];
      var ordered = orderIds.map(function (id) { return byId[id]; }).filter(Boolean);
      var unordered = enc.combatants.filter(function (c) { return orderIds.indexOf(c.id) < 0; });
      var cur = enc.turnId ? byId[enc.turnId] : null;
      var mine = cur && cur.userId === ctx.me.id;
      var nextC = enc.nextId ? byId[enc.nextId] : null;
      var me = enc.combatants.find(function (c) { return c.userId === ctx.me.id; });
      var wait = me && cur ? turnsUntil(orderIds, cur.id, me.id) : null;
      var stage;
      if (enc.status === 'active') {
        var who = mine ? 'It\'s your turn!' : cur ? esc(cur.name) + '\'s turn' : 'Waiting…';
        var mineNote = mine ? '' : me && wait === 1 ? '<p class="cw-stage-you is-soon">You\'re up next. Get ready.</p>' : me && wait != null ? '<p class="cw-stage-you">Your turn in ' + wait + ' turns.</p>' : '';
        stage = '<section class="cw-turnbar cw-stage' + (mine ? ' is-mine' : '') + (enc.paused ? ' is-paused' : '') + '" role="status" aria-label="Current turn">' + (enc.paused ? pausedRibbon() : '') + '<div class="cw-stage-now">' +
          '<span class="cw-eyebrow">' + esc(enc.name) + ' · Round ' + enc.round + ' ' + stateLabel(enc) + '</span><span class="cw-stage-label">' + (mine ? 'You are acting' : 'Now acting') + '</span><strong class="cw-turnname">' + who + '</strong>' +
          (cur ? '<span class="cw-stage-kind">' + KIND_LABEL[cur.kind] + '</span><div class="cw-stage-vitals">' + publicVitals(cur, true) + '</div>' + (cur.conditions.length ? '<div class="cw-row-conds cw-stage-conds">' + conditionChips(cur, false) + '</div>' + conditionHelp(cur) : '') : '') +
          mineNote + (mine && !enc.paused ? turnGuide(me) : '') + '</div>' +
          '<div class="cw-stage-side"><div class="cw-round"><span class="cw-round-l">Round</span><strong>' + enc.round + '</strong></div>' +
          (nextC ? '<div class="cw-stage-next"><span class="cw-upnext">Up next: <strong>' + esc(nextC.name) + (nextC.userId === ctx.me.id ? ' (you)' : '') + '</strong></span></div>' : '') + '</div></section>';
      } else {
        stage = '<section class="cw-turnbar cw-stage is-ended" role="status"><div class="cw-stage-now"><span class="cw-eyebrow">' + stateLabel(enc) + '</span><strong class="cw-turnname">' + (enc.status === 'ended' ? 'Combat has ended' : 'The encounter is being set up') + '</strong>' +
          (enc.status === 'ended' ? '' : '<p class="cw-muted">Roll initiative when the DM asks and tell them the result.</p>') + '</div></section>';
      }
      var rows = ordered.concat(unordered).map(function (c) {
        var current = enc.turnId === c.id, isNext = enc.nextId === c.id;
        return '<li class="cw-row is-public' + (current ? ' is-current' : '') + (isNext ? ' is-next' : '') + (c.defeated ? ' is-defeated' : '') + (c.userId === ctx.me.id ? ' is-mine' : '') + '" id="cb-row-' + esc(c.id) + '"' + (current ? ' aria-current="true"' : '') + '>' +
          '<div class="cw-row-init"><span class="cw-initval" title="Initiative">' + (c.initiative == null ? '—' : c.initiative) + '</span></div>' +
          '<div class="cw-row-main"><div class="cw-row-name">' + (current ? '<span class="cw-tag is-now">Now</span>' : isNext ? '<span class="cw-tag is-next">Next</span>' : '') + '<strong>' + esc(c.name) + (c.userId === ctx.me.id ? ' (you)' : '') + '</strong><span class="cw-kind cw-kind-' + c.kind + '">' + KIND_LABEL[c.kind] + '</span></div>' +
          (c.conditions.length ? '<div class="cw-row-conds">' + conditionChips(c, false) + '</div>' : '') + '</div>' +
          '<div class="cw-row-vitals">' + publicVitals(c, false) + '</div></li>';
      }).join('');
      var railHtml = enc.status === 'active' ? rail(ordered, enc.turnId, enc.nextId, { defeated: function (c) { return c.defeated; }, exact: function (c) { return c.kind === 'pc'; } }) : '';
      var panel = me && enc.status === 'active' ? actionPanel() : '';
      return stage + railHtml + '<div class="cw-combat-grid"><section class="cw-card cw-order"><h3 class="cw-card-title">' + esc(enc.name) + '</h3><ol class="cw-rows">' + rows + '</ol></section>' + panel + '</div>' +
        '<p class="cw-muted cw-fine">Monsters show only how hurt they look. The Dungeon Master tracks their exact hit points and applies every attack.</p>';
    }

    function draw() {
      if (!alive) return;
      var focus = document.activeElement && document.activeElement.id;
      var scrollY = global.scrollY;
      if (loadError) body.innerHTML = '<div class="cw-card cw-empty"><p>' + esc(loadError) + '</p><button type="button" class="btn btn-secondary btn-sm" data-cb="reload">Try again</button></div>';
      else body.innerHTML = isDm ? dmView() : playerView();
      drawSave();
      if (focus && focus !== 'cb-search') { var el = host.querySelector('#' + focus); if (el) el.focus(); }
      global.scrollTo(0, scrollY);
      maybeAuto();
    }

    // ---- Foggy Assist / Full Auto ---------------------------------------------------------------------------------
    function maybeAuto() {
      if (!isDm || archived || !enc || enc.status !== 'active' || enc.paused || !X()) return;
      var cur = M().currentCombatant(enc);
      if (!cur || cur.kind === 'pc') return;
      var k = X().turnKey(enc);
      if (enc.autoMode === 'assist') {
        if (foggyOk && assistFor !== k && !flow && !(advice && advice.forId === cur.id)) { assistFor = k; askFoggy(cur); }
        return;
      }
      if (enc.autoMode !== 'auto' || autoRun || enc.autoRanFor === k) return;
      autoRun = { key: k, id: cur.id, stop: false, status: 'Foggy will play ' + cur.name + '\'s turn…' };
      setTimeout(runAuto, 1200); // a moment to press Stop before anything happens
      setTimeout(draw, 0);
    }
    async function runAuto() {
      var run = autoRun;
      if (!alive || !run) return;
      if (run.stop || !enc || X().turnKey(enc) !== run.key || enc.status !== 'active' || enc.paused) { autoRun = null; draw(); return; }
      enc.autoRanFor = run.key; // claimed before anything happens: this turn is never played twice (also after a reload)
      persist();
      var cur = M().find(enc, run.id);
      var acts = actionsOf(cur);
      X().startOfTurn(enc, cur, acts).forEach(function (l) { M().log(enc, l); });
      var adv = null;
      if (foggyOk && global.FogFoggy && global.FogFoggy.combatAdvice) {
        run.status = 'Foggy is choosing ' + cur.name + '\'s action…'; draw();
        var r = await global.FogFoggy.combatAdvice({ campaignId: ctx.id, state: combatStateFor(cur), question: 'Choose this creature\'s action for this turn.' });
        if (!alive) return;
        if (r.ok && r.result) adv = r.result;
      }
      if (run.stop) { M().log(enc, '🤖 Stopped by the Dungeon Master before ' + cur.name + ' acted.'); autoRun = null; draw(); persist(); return; }
      var p = X().plan({ enc: enc, actor: cur, actions: acts, entry: monsterEntry(cur), advice: adv });
      if (!p.ok) {
        M().log(enc, '🤖 ' + p.reason + ' Over to you.');
        UI().notice(p.reason + ' Over to you.', 'error');
        autoRun = null; draw(); persist(); return;
      }
      run.status = 'Foggy is playing ' + cur.name + '\'s turn…'; draw();
      var res = await X().execute({ enc: enc, actor: cur, plan: p, M: M(), dice: global.FogDice, saveBonus: saveBonus, defensesOf: defensesOf, conditionNames: conditions,
        shouldStop: function () { return run.stop || !alive; }, onStep: function () { draw(); persist(); }, delayMs: 900 });
      if (!alive) return;
      if (!res.stopped && enc.status === 'active' && enc.turnId === cur.id && !enc.paused) {
        var nt = M().nextTurn(enc);
        if (nt.ok) M().log(enc, 'Turn: ' + nt.combatant.name + '.');
      }
      autoRun = null;
      selectedId = null;
      draw(); persist();
    }
    async function askFoggy(c2) {
      advice = { forId: c2.id, loading: true };
      draw();
      var r2 = await global.FogFoggy.combatAdvice({ campaignId: ctx.id, state: combatStateFor(c2), question: '' });
      if (!alive) return;
      advice = r2.ok ? Object.assign({ forId: c2.id }, r2.result || {}) : { forId: c2.id, error: r2.message };
      if (advice.targetIds == null) advice.targetIds = [];
      draw();
    }

    /** The finished fight goes into the active session's record (Logbook), once per encounter. */
    async function recordResult() {
      if (!D().listSessions || !enc) return;
      var ses = await D().listSessions(ctx.id);
      var active = ses.ok ? ses.sessions.find(function (s) { return s.status === 'active'; }) : null;
      if (!active) return;
      if (!enc.key) { enc.key = 'cb' + Date.now().toString(36); persist(); }
      // The session row is readable by the players: only what they saw goes there (no hidden creatures, no DM log).
      var shown = enc.combatants.filter(function (c) { return !c.removed && !c.hidden; });
      var result = {
        combatKey: enc.key, encounterId: enc.source ? enc.source.encounterId : null, adventureId: enc.source ? enc.source.adventureId : null, title: enc.name, rounds: enc.round,
        defeated: shown.filter(function (c) { return M().isDefeated(c); }).map(function (c) { return c.name; }),
        survivors: shown.filter(function (c) { return c.kind !== 'pc' && !M().isDefeated(c); }).map(function (c) { return c.name; }),
        party: shown.filter(function (c) { return c.kind === 'pc'; }).map(function (c) { return { name: c.name, hp: c.hp, hpMax: c.hpMax }; }),
      };
      var u = await D().updateSession(active.id, { result: result });
      // The full picture (hidden creatures, the end of the log) goes into the DM-only session notes.
      if (u.ok && D().getSessionNotes) {
        var nt = await D().getSessionNotes(active.id);
        if (nt.ok) {
          var det = nt.notes.details || {};
          det.combat = det.combat || {};
          det.combat[enc.key] = { title: enc.name, hidden: enc.combatants.filter(function (c) { return c.hidden && !c.removed; }).map(function (c) { return c.name + (M().isDefeated(c) ? ' (defeated)' : ''); }), log: enc.log.slice(-12).map(function (l) { return l.text; }) };
          var keys = Object.keys(det.combat);
          if (keys.length > 20) delete det.combat[keys[0]];
          await D().saveSessionNotes(ctx.id, active.id, nt.notes.notes, det);
        }
      }
      if (alive) UI().notice(u.ok ? 'The result was added to session ' + active.number + ' in the Logbook.' : 'The result couldn\'t be added to the session: ' + u.message, u.ok ? undefined : 'error');
    }

    async function load() {
      var res = await Sess().load(ctx);
      if (!alive) return;
      if (!res.ok) { loadError = res.message; draw(); return; }
      loadError = null;
      enc = res.encounter;
      version = res.version;
      saveState = { status: 'idle' };
      if (flow && enc && !enc.combatants.some(function (c) { return c.id === flow.attackerId; })) flow = null;
      draw();
    }
    async function loadRequests() {
      if (!D().listCombatRequests) return;
      var r = await D().listCombatRequests(ctx.id, isDm ? ['pending'] : null);
      if (!alive || !r.ok) return;
      requests = r.requests;
      draw();
    }

    // ---- applying -----------------------------------------------------------------------------------------------
    function applyFlow(endTurn) {
      var f = flow, a = f.action;
      var attacker = M().find(enc, f.attackerId);
      if (!attacker || !f.targets.length) { UI().notice('Choose a target first.', 'error'); return; }
      mutate(function () {
        f.targets.forEach(function (id) {
          var t = M().find(enc, id);
          if (!t) return;
          var amount = amountFor(id);
          var part;
          if (a.type === 'attack') {
            var r = A().resolveAttack({ action: a, d20: f.d20, mode: f.rollMode, ac: t.ac });
            part = attacker.name + ' attacks ' + t.name + ' with ' + a.name + ': ' + r.total + (t.ac != null ? ' vs AC ' + t.ac : '') + ' — ' + (f.hit[id] ? (r.crit ? 'critical hit' : 'hit') : 'miss') + (f.hit[id] && amount ? ', ' + amount + ' ' + dmgTypes(a) + ' damage' : '') + '.';
          } else {
            var ok = f.saves[id] >= a.dc;
            part = t.name + ' ' + (ok ? 'succeeds' : 'fails') + ' on a DC ' + a.dc + ' ' + a.abilityName + ' save (' + f.saves[id] + ') against ' + attacker.name + '\'s ' + a.name + (amount ? ': ' + amount + ' ' + dmgTypes(a) + ' damage' : '') + '.';
          }
          var dn = f.perTarget[id] != null ? '' : defenseFor(id).note;
          if (dn && amount !== rawAmountFor(id)) part = part.replace(/\.$/, '') + ' (' + dn + ').';
          M().log(enc, part);
          if (amount > 0) M().damage(enc, id, amount);
          if (f.applyCond && affected(id)) {
            var def = defensesOf(t);
            flowConditions().forEach(function (cn) {
              if (def && def.condImmune.indexOf(cn) >= 0) { M().log(enc, t.name + ' is immune to ' + cn + '.'); return; }
              if (t.conditions.indexOf(cn) < 0) { M().toggleCondition(enc, id, cn, conditions); M().log(enc, t.name + ' has the ' + cn + ' condition (from ' + a.name + ').'); }
            });
          }
        });
        flow = null;
        if (endTurn && enc.status === 'active' && enc.turnId === attacker.id) { M().nextTurn(enc); selectedId = null; }
        return { ok: true };
      });
    }
    function applyManual(endTurn) {
      var f = flow, m = f.manual;
      var attacker = M().find(enc, f.attackerId);
      var action = f.actionId ? actionsOf(attacker).find(function (x) { return x.id === f.actionId; }) : null;
      var name = action ? action.name : (m.name.trim() || 'an action');
      var amount = parseInt(m.amount, 10);
      mutate(function () {
        M().log(enc, attacker.name + ' uses ' + name + (f.targets.length ? ' on ' + f.targets.map(nameOf).join(', ') : '') + (m.rollText ? ' (' + m.rollText + ')' : '') + (m.note ? ' — ' + m.note : '') + '.');
        f.targets.forEach(function (id) {
          if (amount > 0) M().damage(enc, id, amount);
          var t = M().find(enc, id);
          if (m.condition && t && t.conditions.indexOf(m.condition) < 0) M().toggleCondition(enc, id, m.condition, conditions);
        });
        flow = null;
        if (endTurn && enc.status === 'active' && enc.turnId === attacker.id) { M().nextTurn(enc); selectedId = null; }
        return { ok: true };
      });
    }
    async function sendRequest(manual) {
      var f = flow;
      var me = M().find ? enc.combatants.find(function (c) { return c.id === f.attackerId; }) : null;
      if (!me || !f.targets.length) { UI().notice('Choose a target first.', 'error'); return; }
      var a = f.action;
      var payload;
      if (manual) {
        var act = f.actionId ? actionsOf(me).find(function (x) { return x.id === f.actionId; }) : null;
        payload = { name: act ? act.name : (f.manual.name.trim() || 'Action'), note: [f.manual.rollText, f.manual.note].filter(Boolean).join(' — ').slice(0, 300), damage: f.manual.amount === '' ? null : Number(f.manual.amount) };
      } else {
        var r = a.type === 'attack' ? A().resolveAttack({ action: a, d20: f.d20, mode: f.rollMode }) : null;
        payload = { name: a.name, type: a.type, bonus: a.bonus, d20: f.d20.join('/'), mode: f.rollMode, attackTotal: r ? r.total : null, crit: r ? r.crit : false, damage: f.damage, damageText: f.damageText, damageType: dmgTypes(a) };
      }
      var res = await D().submitCombatRequest(ctx.id, { clientKey: f.key || (f.key = key()), attackerId: me.id, targetIds: f.targets, action: payload });
      if (!alive) return;
      if (!res.ok) { UI().notice(res.message, 'error'); return; }
      flow = null;
      UI().notice('Sent to the Dungeon Master.');
      loadRequests();
    }
    async function applyRequest(id) {
      var r = requests.find(function (x) { return x.id === id; });
      var li = host.querySelector('[data-req="' + id + '"]');
      if (!r || !li) return;
      var picks = r.targetIds.map(function (t) {
        var hitSel = li.querySelector('[data-req-hit="' + t + '"]');
        var dmgIn = li.querySelector('[data-req-dmg="' + t + '"]');
        return { id: t, hit: hitSel ? hitSel.value === '1' : true, dmg: dmgIn ? Math.max(0, parseInt(dmgIn.value, 10) || 0) : 0 };
      });
      var d = await D().decideCombatRequest(id, 'applied');
      if (!alive) return;
      if (!d.ok) { UI().notice(d.message, 'error'); return; }
      if (d.status !== 'applied') { UI().notice('That request was already answered.'); loadRequests(); return; }
      mutate(function () {
        var a = r.action || {};
        picks.forEach(function (p) {
          var t = M().find(enc, p.id);
          if (!t) return;
          M().log(enc, nameOf(r.attackerId) + ' → ' + t.name + ' with ' + (a.name || 'an attack') + (a.attackTotal != null ? ': ' + a.attackTotal + (t.ac != null ? ' vs AC ' + t.ac : '') : '') + ' — ' + (p.hit ? (a.crit ? 'critical hit' : 'hit') : 'miss') + (p.hit && p.dmg ? ', ' + p.dmg + (a.damageType ? ' ' + a.damageType : '') + ' damage' : '') + '. (sent by the player)');
          if (p.hit && p.dmg > 0) M().damage(enc, p.id, p.dmg);
        });
        requests = requests.filter(function (x) { return x.id !== id; });
        return { ok: true };
      });
    }

    function combatStateFor(c) {
      var acts = actionsOf(c).map(function (a) { return { name: a.name, text: a.text.slice(0, 700) }; });
      var others = enc.combatants.filter(function (o) { return o.id !== c.id && !o.removed; }).map(function (o) {
        return { id: o.id, name: o.name, kind: o.kind, health: isDm ? (M().isDefeated(o) ? 'defeated' : M().bloodied(o) ? 'bloodied' : 'unhurt') + ' (' + o.hp + '/' + o.hpMax + ' HP)' : (o.kind === 'pc' ? o.hp + '/' + o.hpMax + ' HP' : o.health || ''), conditions: o.conditions, ac: isDm ? o.ac : (o.kind === 'pc' ? o.ac : null) };
      });
      return { round: enc.round, actor: { id: c.id, name: c.name, kind: c.kind, hp: isDm || c.kind === 'pc' ? c.hp : null, hpMax: isDm || c.kind === 'pc' ? c.hpMax : null, conditions: c.conditions, actions: acts }, others: others };
    }

    // ---- events -------------------------------------------------------------------------------------------------
    var rollRng = null;
    async function rollAttack() {
      var r3 = await global.FogDice.roll(flow.rollMode === 'normal' ? 'd20' : '2d20', { label: flow.action.name });
      if (!r3.ok || !alive || !flow) return false;
      flow.d20 = flow.rollMode === 'normal' ? [r3.rolls[0]] : r3.rolls.slice(0, 2);
      flow.manualD20 = false;
      flow.hit = {};
      return true;
    }
    async function rollSave(targetId, bonus) {
      var r4 = await global.FogDice.roll('d20', { label: 'Saving throw' });
      if (!r4.ok || !alive || !flow) return false;
      flow.saves[targetId] = r4.rolls[0] + (Number(bonus) || 0);
      flow.perTarget = {};
      return true;
    }
    async function rollDamage() {
      var crit = flow.action.type === 'attack' && A().resolveAttack({ action: flow.action, d20: flow.d20, mode: flow.rollMode }).crit;
      var parts = A().damageDice(flow.action, crit);
      var total = 0, texts = [];
      for (var i = 0; i < parts.length; i++) {
        var rr = /d/.test(parts[i]) ? await global.FogDice.roll(parts[i], { label: flow.action.name + ' damage' }) : { ok: true, total: Number(parts[i]), text: parts[i] };
        if (!rr.ok || !alive || !flow) return false;
        total += rr.total; texts.push(rr.text);
      }
      flow.damage = total; flow.damageText = texts.join(' + '); flow.perTarget = {};
      return true;
    }
    function roll(c) { var r = M().rollInitiative(c, rollRng); M().setInitiative(enc, c.id, r.total); return r; }

    host.addEventListener('click', async function (e) {
      var jump = e.target.closest('[data-jump]');
      if (jump) {
        selectedId = jump.getAttribute('data-jump');
        draw();
        var row = host.querySelector('#cb-row-' + (global.CSS && CSS.escape ? CSS.escape(selectedId) : selectedId));
        if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.add('is-flash'); global.setTimeout(function () { row.classList.remove('is-flash'); }, 1200); }
        return;
      }
      var b = e.target.closest('[data-cb]');
      if (!b) {
        var card = e.target.closest('.cw-row[data-id]');
        if (card && isDm && !e.target.closest('input, select, button, details, a')) { selectedId = card.getAttribute('data-id'); draw(); }
        return;
      }
      var a = b.getAttribute('data-cb');
      var id = b.getAttribute('data-id');
      if (a === 'reload') { load(); return; }
      if (a === 'view') { view = b.getAttribute('data-view') === 'advanced' ? 'advanced' : 'basic'; try { global.localStorage.setItem('fog_combat_view', view); } catch (err) { /* preference only */ } draw(); return; }
      if (a === 'retry-save') { persist(); return; }
      // workflow (DM and players)
      if (a === 'select') { selectedId = id; flow = null; draw(); var p = host.querySelector('.cw-act'); if (p && p.scrollIntoView) p.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
      if (a === 'act') {
        var c0 = enc.combatants.find(function (x) { return x.id === id; });
        var act = actionsOf(c0).find(function (x) { return x.id === b.getAttribute('data-action'); });
        if (c0 && act) { selectedId = id; startFlow(c0, act, []); draw(); }
        return;
      }
      if (a === 'manual') { var c1 = enc.combatants.find(function (x) { return x.id === id; }); if (c1) { selectedId = id; startFlow(c1, null, []); draw(); } return; }
      if (a === 'flow-cancel') { flow = null; draw(); return; }
      if (a === 'dismiss-advice') { advice = null; draw(); return; }
      if (a === 'ask-foggy') {
        var c2 = enc.combatants.find(function (x) { return x.id === id; });
        if (c2) await askFoggy(c2);
        return;
      }
      if (a === 'auto-stop') { if (autoRun) { autoRun.stop = true; autoRun.status = 'Stopping…'; } draw(); return; }
      if (a === 'enc-music' && enc && enc.music) {
        try { if (!global.FogMusicPlayer && global.FogScriptSets) await global.FogCampaignRouter.loadScripts(global.FogScriptSets.MUSIC); } catch (err) { /* reported below */ }
        if (!global.FogMusicPlayer) { UI().notice('The music player couldn\'t be loaded.', 'error'); return; }
        var okm = await global.FogMusicPlayer.play(enc.music);
        if (okm === false) UI().notice((global.FogMusicPlayer.state().error || 'That track couldn\'t be played.'), 'error');
        else UI().notice('Playing the encounter music' + (ctx.meeting && ctx.meeting.state().audioShare ? ' for everyone in the call.' : '. Share it in Meeting in the Fog so the players hear it.'));
        return;
      }
      if (a === 'use-advice' && advice && advice.action) {
        var c3 = enc.combatants.find(function (x) { return x.id === id; });
        var act3 = actionsOf(c3).find(function (x) { return x.name === advice.action; });
        if (act3) { startFlow(c3, act3.type === 'text' ? null : act3, advice.targetIds.slice()); if (act3.type === 'text') flow.actionId = act3.id; advice = null; draw(); }
        return;
      }
      if (a === 'roll-attack' && flow) { if (await rollAttack()) draw(); return; }
      if (a === 'roll-save' && flow) { if (await rollSave(b.getAttribute('data-target'), Number(b.getAttribute('data-bonus')))) draw(); return; }
      if (a === 'roll-damage' && flow) { if (await rollDamage()) draw(); return; }
      if (a === 'auto-resolve' && flow && isDm) {
        // One click: roll what's missing, compare with AC / DC, roll damage when something was hit or failed. Nothing is applied
        // until the DM presses Apply (the numbers stay editable).
        var fa = flow.action;
        if (fa.type === 'attack' && !flow.d20.length && !(await rollAttack())) return;
        if (fa.type === 'attack') flow.targets.forEach(function (tid) { var tt = M().find(enc, tid); var rs = A().resolveAttack({ action: fa, d20: flow.d20, mode: flow.rollMode, ac: tt ? tt.ac : null }); if (flow.hit[tid] == null && rs.hit != null) flow.hit[tid] = rs.hit; });
        if (fa.type === 'save') {
          for (var si = 0; si < flow.targets.length; si++) {
            var tid2 = flow.targets[si];
            if (flow.saves[tid2] != null) continue;
            var bn = saveBonus(M().find(enc, tid2), fa.ability);
            if (bn == null || !(await rollSave(tid2, bn))) { draw(); return; }
          }
        }
        var need = (fa.damage || []).length && flow.damage == null && flow.targets.some(function (tid) { return fa.type === 'save' ? true : flow.hit[tid] === true; });
        if (need && !(await rollDamage())) return;
        draw();
        return;
      }
      if (a === 'man-roll' && flow) {
        var spec = flow.manual.roll.trim() || 'd20';
        var r5 = await global.FogDice.roll(spec, { label: 'Manual roll' });
        if (!alive || !flow) return;
        if (!r5.ok) { UI().notice(r5.error || 'Write a roll like d20+5 or 2d6+3.', 'error'); return; }
        flow.manual.rollText = r5.text;
        draw();
        return;
      }
      if (a === 'send' && flow) { sendRequest(false); return; }
      if (a === 'man-send' && flow) { sendRequest(true); return; }
      if (a === 'req-cancel') { var rc = await D().decideCombatRequest(b.getAttribute('data-req'), 'cancelled'); if (!rc.ok) UI().notice(rc.message, 'error'); loadRequests(); return; }
      if (a === 'goto-req') { e.preventDefault(); var rq = host.querySelector('#cb-requests'); if (rq) rq.scrollIntoView({ behavior: 'smooth' }); return; }
      if (!isDm) return;
      if (archived) { UI().notice('This campaign is archived: restore it to run combat.', 'error'); return; }
      var amt = function () { var box = b.closest('.cw-hpform'); var el = box ? box.querySelector('[data-amt]') : host.querySelector('[data-amt="' + id + '"]'); var v = el ? el.value : ''; if (el) el.value = ''; return v; };
      if (a === 'apply' && flow) applyFlow(false);
      else if (a === 'man-apply' && flow) applyManual(false);
      else if (a === 'man-apply-end' && flow) applyManual(true);
      else if (a === 'req-apply') applyRequest(b.getAttribute('data-req'));
      else if (a === 'req-reject') {
        var rj = await D().decideCombatRequest(b.getAttribute('data-req'), 'rejected', 'The DM rejected this attack.');
        if (!rj.ok) UI().notice(rj.message, 'error');
        loadRequests();
      }
      else if (a === 'use-text') {
        var c4 = M().find(enc, id);
        var act4 = actionsOf(c4).find(function (x) { return x.id === b.getAttribute('data-action'); });
        if (c4 && act4) mutate(function () { return M().log(enc, c4.name + ' uses ' + act4.name + '.'); });
      }
      else if (a === 'new') { enc = M().newEncounter('Encounter'); version = null; mutate(function () { return { ok: true }; }); }
      else if (a === 'save-to-adv') {
        if (!hasAdventure() || !enc) return;
        var scripts2 = ['Dashboard/adventures/adventure-model.js', 'Dashboard/content-images.js', 'Dashboard/adventures/adventure-store.js'];
        try { await global.FogCampaignRouter.loadScripts(scripts2); } catch (err) { UI().notice('Could not load the adventure tools.', 'error'); return; }
        var advRes2 = advCache ? { ok: true, adventure: advCache } : await global.FogAdventureStore.get(ctx.campaign.adventureId);
        if (!advRes2.ok) { UI().notice(advRes2.message || 'Could not load the adventure.', 'error'); return; }
        var adv2 = advRes2.adventure;
        advCache = adv2;
        var AM2 = global.FogAdventureModel;
        var ne = AM2.newEncounter(enc.name || 'Encounter');
        enc.combatants.filter(function (c) { return c.kind === 'monster' && c.ref; }).forEach(function (c) {
          var have = ne.monsters.find(function (m) { return m.ref === c.ref; });
          if (have) have.count = Math.min(20, have.count + 1);
          else ne.monsters.push({ ref: c.ref, name: c.name.replace(/ \d+$/, ''), count: 1 });
        });
        if (!adv2.content.encounters) adv2.content.encounters = [];
        adv2.content.encounters.push(ne);
        var saveRes = await global.FogAdventureStore.save(adv2);
        if (!alive) return;
        if (saveRes.ok) { adv2.version = saveRes.version != null ? saveRes.version : adv2.version; UI().notice('Saved "' + ne.name + '" to the adventure encounters.'); }
        else UI().notice(saveRes.message || 'Could not save to the adventure.', 'error');
      }
      else if (a === 'load-adv') {
        if (advLoading || advCache) return;
        advLoading = true; draw();
        try {
          var scripts = ['Dashboard/adventures/adventure-model.js', 'Dashboard/content-images.js', 'Dashboard/adventures/adventure-store.js', 'Campaign/encounter-launcher.js', 'Campaign/campaign-maps.js'];
          await global.FogCampaignRouter.loadScripts(scripts);
          var advRes = await global.FogAdventureStore.get(ctx.campaign.adventureId);
          if (!alive) return;
          if (advRes.ok) advCache = advRes.adventure;
          else UI().notice(advRes.message || 'Could not load the adventure.', 'error');
        } catch (err) { if (alive) UI().notice('Could not load the adventure.', 'error'); }
        advLoading = false; draw();
      }
      else if (a === 'load-enc') {
        var encId = b.getAttribute('data-enc-id');
        var ae = advEncounters().find(function (x) { return x.id === encId; });
        if (!ae || !advCache) return;
        if (!global.FogEncounterLauncher) {
          try { await global.FogCampaignRouter.loadScripts(['Campaign/encounter-launcher.js', 'Campaign/campaign-maps.js']); } catch (err) { UI().notice('Could not load the encounter launcher.', 'error'); return; }
        }
        var r2 = await global.FogEncounterLauncher.start(ctx, advCache, ae);
        if (r2 && r2.ok) { await load(); draw(); }
        else if (r2 && !r2.ok && !r2.cancelled) UI().notice(r2.message, 'error');
      }
      else if (a === 'addparty') {
        mutate(function (x) {
          ctx.campaign.roster.filter(function (m) { return m.role === 'player' && m.character; }).forEach(function (m) {
            if (!x.combatants.some(function (c) { return c.kind === 'pc' && c.userId === m.userId; })) M().addCombatant(x, Sess().pcCombatant(m, ctx.campaign));
          });
          return { ok: true };
        });
      }
      else if (a === 'addmonster') {
        var mk = b.getAttribute('data-key');
        var entry = monsters.find(function (m) { return m.key === mk; });
        var countEl = host.querySelector('[data-count="' + (global.CSS && CSS.escape ? CSS.escape(mk) : mk) + '"]');
        var n = Math.max(1, Math.min(20, Number(countEl && countEl.value) || 1));
        if (!entry) return;
        mutate(function (x) {
          var existing = x.combatants.filter(function (c) { return c.ref === entry.key; }).length;
          for (var j = 0; j < n; j++) {
            var r = M().addCombatant(x, Sess().monsterCombatant(entry, n > 1 || existing ? entry.name + ' ' + (existing + j + 1) : entry.name));
            if (!r.ok) return r;
          }
          return { ok: true };
        });
      }
      else if (a === 'roll') {
        var c5 = M().find(enc, id);
        if (!c5) return;
        var r6 = await global.FogDice.roll('d20', { label: c5.name + ' (d20)' });
        if (!r6.ok || !alive) return;
        mutate(function () {
          var t = r6.rolls[0] + c5.initMod;
          M().setInitiative(enc, id, t);
          UI().notice(c5.name + ' rolled ' + r6.rolls[0] + ' ' + signed(c5.initMod) + ' = ' + t + ' for initiative.');
          return { ok: true };
        });
      }
      else if (a === 'rollall') mutate(function () { enc.combatants.forEach(function (c) { if (c.kind !== 'pc' && c.initiative == null && !c.removed) roll(c); }); return { ok: true }; });
      else if (a === 'start') mutate(function () { return M().start(enc); });
      else if (a === 'next') { flow = null; advice = null; selectedId = null; mutate(function () { var r = M().nextTurn(enc); if (r.ok) M().log(enc, 'Turn: ' + r.combatant.name + '.'); return r; }); }
      else if (a === 'prev') { flow = null; selectedId = null; mutate(function () { return M().previousTurn(enc); }); }
      else if (a === 'pause') mutate(function () { return M().pause(enc); });
      else if (a === 'resume') mutate(function () { return M().resume(enc); });
      else if (a === 'end') {
        var okEnd = await UI().confirm({ title: 'End combat?', message: 'The encounter stays visible as finished until you clear it.', confirmLabel: 'End combat' });
        if (okEnd) { flow = null; if (autoRun) autoRun.stop = true; mutate(function () { M().end(enc); return { ok: true }; }); recordResult(); }
      }
      else if (a === 'back-to-adv') {
        if (enc && enc.source && enc.source.adventureId) {
          var sid = enc.source.sectionId;
          if (global.FogCampaignReturn) global.FogCampaignReturn.go('content', sid ? [sid] : [], 'Combat');
          else global.FogCampaignRouter.navigateTo('content', sid ? [sid] : []);
        }
      }
      else if (a === 'reopen') mutate(function () { M().reopen(enc); return { ok: true }; });
      else if (a === 'clear') {
        var okClear = await UI().confirm({ title: 'Clear this encounter?', message: 'Everyone\'s combat view is emptied. This can\'t be undone.', confirmLabel: 'Clear encounter', danger: true });
        if (!okClear) return;
        var res = await D().clearCombat(ctx.id);
        if (!res.ok) { UI().notice(res.message, 'error'); return; }
        enc = null; version = null; flow = null; saveState = { status: 'idle' }; draw();
      }
      else if (a === 'reduce') mutate(function () { var v = amt(); var r = M().damage(enc, id, v); if (r.ok) M().log(enc, '(DM adjustment)'); return r; });
      else if (a === 'heal') mutate(function () { return M().heal(enc, id, amt()); });
      else if (a === 'temp') mutate(function () { return M().setTempHp(enc, id, amt()); });
      else if (a === 'cond') mutate(function () { return M().toggleCondition(enc, id, b.getAttribute('data-name'), conditions); });
      else if (a === 'hide') mutate(function () { var c = M().find(enc, id); c.hidden = !c.hidden; return { ok: true }; });
      else if (a === 'remove') {
        var c6 = M().find(enc, id);
        var okRm = await UI().confirm({ title: 'Remove ' + (c6 ? c6.name : 'this combatant') + '?', message: 'They leave the encounter.', confirmLabel: 'Remove', danger: true });
        if (okRm) mutate(function () { M().removeCombatant(enc, id); return { ok: true }; });
      }
    });

    host.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute && t.hasAttribute('data-turnpart')) { checklist.done[t.getAttribute('data-turnpart')] = t.checked; return; }
      var a = t.getAttribute && t.getAttribute('data-cb');
      if (flow) {
        if (a === 'target') {
          var multi = !flow.action || flow.mode === 'manual' || (flow.action.type === 'save' && flow.action.multi);
          if (multi) flow.targets = [].slice.call(host.querySelectorAll('[data-cb="target"]:checked')).map(function (x) { return x.value; });
          else flow.targets = [t.value];
          flow.hit = {}; flow.perTarget = {};
          // the conditions' advantage / disadvantage, preselected (the DM can change it before rolling)
          if (flow.action && flow.action.type === 'attack' && !flow.d20.length && flow.targets.length === 1 && X()) {
            flow.rollMode = X().rollModeFor(M().find(enc, flow.attackerId), M().find(enc, flow.targets[0]), flow.action.attackKind).mode;
          }
          draw(); return;
        }
        if (a === 'rollmode') { flow.rollMode = t.value; flow.d20 = []; flow.hit = {}; draw(); return; }
        if (a === 'd20') { var n = parseInt(t.value, 10); flow.d20 = n >= 1 && n <= 20 ? [n] : []; flow.manualD20 = true; flow.hit = {}; draw(); return; }
        if (a === 'hitsel') { flow.hit[t.getAttribute('data-target')] = t.value === '' ? null : t.value === '1'; flow.perTarget = {}; draw(); return; }
        if (a === 'save') { var s = parseInt(t.value, 10); flow.saves[t.getAttribute('data-target')] = isFinite(s) ? s : null; if (!isFinite(s)) delete flow.saves[t.getAttribute('data-target')]; flow.perTarget = {}; draw(); return; }
        if (a === 'dmgtotal') { var d = parseInt(t.value, 10); flow.damage = isFinite(d) && d >= 0 ? d : null; flow.damageText = ''; flow.perTarget = {}; draw(); return; }
        if (a === 'pertarget') { var pt = parseInt(t.value, 10); flow.perTarget[t.getAttribute('data-target')] = isFinite(pt) && pt >= 0 ? pt : 0; return; }
        if (a === 'man-action') { flow.actionId = t.value; draw(); return; }
        if (a === 'man-cond') { flow.manual.condition = t.value; return; }
        if (a === 'applycond') { flow.applyCond = t.checked; return; }
      }
      if (!isDm || archived) return;
      if (a === 'automode' && enc) { var mv = t.value; mutate(function () { enc.autoMode = ['manual', 'assist', 'auto'].indexOf(mv) >= 0 ? mv : 'manual'; M().log(enc, 'Monster turns: ' + MODE_NAME[enc.autoMode] + '.'); return { ok: true }; }); return; }
      if (a === 'init') mutate(function () { return M().setInitiative(enc, t.getAttribute('data-id'), t.value); });
      else if (a === 'addcond' && t.value) mutate(function () { return M().toggleCondition(enc, t.getAttribute('data-id'), t.value, conditions); });
    });

    host.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'cb-search') { pickerQuery = t.value; host.querySelector('#cb-picker').innerHTML = pickerResults(); return; }
      if (!flow) return;
      var a = t.getAttribute && t.getAttribute('data-cb');
      if (a === 'man-name') flow.manual.name = t.value;
      else if (a === 'man-dice') flow.manual.roll = t.value;
      else if (a === 'man-amount') flow.manual.amount = t.value;
      else if (a === 'man-note') flow.manual.note = t.value;
    });

    host.addEventListener('keydown', function (e) {
      // In the DM override box: Enter heals, Shift+Enter reduces (corrections only; attacks go through actions).
      if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-amt') && isDm && !archived) {
        e.preventDefault();
        var id = e.target.getAttribute('data-amt');
        var v = e.target.value;
        e.target.value = '';
        mutate(function () { return e.shiftKey ? M().damage(enc, id, v) : M().heal(enc, id, v); });
      }
    });

    host.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-cb-form="custom"]');
      if (!f || !isDm) return;
      e.preventDefault();
      mutate(function (x) {
        var r = M().addCombatant(x, { kind: f.kind.value, name: f.name.value, hpMax: f.hp.value || 1, hp: f.hp.value || 1, ac: f.ac.value, initMod: f.mod.value });
        if (r.ok) f.reset();
        return r;
      });
    });

    // ---- start --------------------------------------------------------------------------------------------------
    body.innerHTML = '<div class="cw-card cw-empty" aria-busy="true"><p class="cw-muted">Loading the encounter…</p></div>';
    await global.FogCompendium.ready();
    if (isDm) {
      if (global.FogCompendiumPage && global.FogCompendiumPage.loadHomebrew) await global.FogCompendiumPage.loadHomebrew();
      monsters = global.FogCompendium.monsters().filter(function (m) { return m.complete; }).sort(function (x, y) { return x.name.localeCompare(y.name); });
    }
    conditions = Sess().conditionNames();
    if (global.FogFoggy && global.FogFoggy.access) {
      try { var acc = await global.FogFoggy.access(null); foggyOk = !!(acc.ok && acc.access && acc.access.dashboard && (acc.source === 'local' || acc.access.enabled)); } catch (err) { foggyOk = false; }
    }
    await load();
    loadRequests();

    var offs = [];
    var unmountDice = global.FogDice ? global.FogDice.mountTray(host.querySelector('#cb-dice')) : function () {};
    var diceCard = host.querySelector('.cw-dice-card');
    diceCard.addEventListener('toggle', function () { try { global.localStorage.setItem('fog_combat_dice_open', diceCard.open ? '1' : '0'); } catch (e) { /* preference only */ } });
    var diceWatch = new MutationObserver(function () {
      var r = host.querySelector('#cw-dice-result');
      var t = r ? r.textContent.trim() : '';
      if (t && !/Rolling/.test(t)) host.querySelector('#cb-dice-last').textContent = 'Last roll: ' + t.slice(0, 60);
    });
    diceWatch.observe(host.querySelector('#cb-dice'), { childList: true, subtree: true, characterData: true });
    offs.push(function () { diceWatch.disconnect(); });
    if (!isDm) offs.push(ctx.on('combat', load));
    offs.push(ctx.on('combat-request', function () { loadRequests(); }));
    return function cleanup() {
      alive = false;
      unmountDice();
      offs.forEach(function (off) { off(); });
    };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.combat = { render: render };
})(window);
