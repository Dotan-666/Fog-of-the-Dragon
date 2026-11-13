/**
 * Combat: an encounter tracker for the table (initiative, turn order, current turn, hit points, conditions).
 *
 * What it is: bookkeeping. It remembers numbers the Dungeon Master types or confirms; it does not roll attacks, apply
 * resistances or decide any rule (see combat-model.js for the few rules it does apply). Monster numbers come from the
 * SRD 5.2.1 stat blocks (or your homebrew) in the shared Monsters & Spells data.
 * Views: Basic (name, turn, hit points, conditions: what a new Dungeon Master needs at the table) and Detailed (adds Temporary Hit
 * Points, hiding creatures from players, initiative bonus and the event log). Both use the same tracker; this is a choice of how
 * much to show, not a rules mode. The pricing page also lists an "Advanced Combat Assistant" (recommendations, default actions):
 * that is NOT built yet.
 *
 * Layout (top to bottom), the same for the DM and the players so everyone reads the table the same way:
 *   1. Stage (.cw-turnbar)  whose turn it is, big: name, HP, AC, conditions; beside it the round, who is next and after.
 *   2. DM controls          (DM only, visibly separate and sticky) previous / NEXT TURN / pause / end.
 *   3. Initiative rail      the whole order at a glance; the current creature is highlighted; click to jump to its card.
 *   4. Setup checklist      (DM, before the start) add combatants → initiative → start.
 *   5. Combatant cards      initiative · who · vitals · DM actions.
 * Players additionally get "your turn" guidance (what you can do on a turn, and how many turns until yours).
 *
 * The DM edits the full encounter. Players see the public view (turn order, whose turn it is, party hit points, monster
 * condition such as Bloodied, conditions) and it updates live when Supabase Realtime is on.
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogCombatModel; };
  var Sess = function () { return global.FogCombatSession; };
  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };

  function esc(s) { return UI().esc(s); }
  function signed(n) { return (n >= 0 ? '+' : '') + n; }

  var KIND_LABEL = { pc: 'Player character', monster: 'Monster', npc: 'NPC' };
  var HEALTH_LABEL = { unhurt: 'Unhurt', bloodied: 'Bloodied', defeated: 'Defeated' };
  // What a creature can do on its turn (SRD 5.2.1, "Playing the Game": Your Turn). A reminder only: nothing is tracked.
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

  /** Armor Class as a small shield badge (nothing when unknown). */
  function acBadge(ac, big) {
    if (ac == null) return '';
    return '<span class="cw-ac' + (big ? ' is-big' : '') + '" title="Armor Class"><span class="cw-ac-l">AC</span><strong>' + ac + '</strong></span>';
  }

  /** How many turns from the current creature to another one in the order (0 = it is their turn). */
  function turnsUntil(orderIds, curId, targetId) {
    var n = orderIds.length;
    var a = orderIds.indexOf(curId);
    var b = orderIds.indexOf(targetId);
    if (a < 0 || b < 0 || !n) return null;
    return (b - a + n) % n;
  }

  async function render(host, ctx) {
    var alive = true;
    var isDm = ctx.isDm;
    var archived = ctx.campaign.status === 'archived';
    var enc = null;
    var version = null;
    var saveState = { status: 'idle', message: '' }; // idle | saving | saved | error | conflict
    var saving = false;
    var dirty = false;
    var conditions = [];
    var monsters = [];
    var pickerQuery = '';
    var loadError = null;
    var view = 'basic';
    var diceOpen = false;
    try { diceOpen = global.localStorage.getItem('fog_combat_dice_open') === '1'; } catch (e) { /* preference only */ }
    var checklist = { turn: null, done: {} }; // the player's own turn reminder (this browser only, resets every turn)
    try { view = global.localStorage.getItem('fog_combat_view') === 'detailed' ? 'detailed' : 'basic'; } catch (e) { /* preference only */ }

    host.innerHTML = '<div class="cw-page cw-combat"><header class="cw-page-head"><div><h2 class="cw-page-title">Combat</h2>' +
      '<p class="cw-page-sub">' + (isDm ? 'Track initiative, turns, hit points and conditions. You decide what happens; this keeps the numbers straight.' : 'The Dungeon Master’s encounter, as it stands. It updates when the DM changes it.') + '</p></div>' +
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

    // ---- Saving (DM) --------------------------------------------------------------------------------------------
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

    // ---- Shared pieces ------------------------------------------------------------------------------------------
    function conditionChips(c, editable) {
      return c.conditions.map(function (n) {
        var tip = Sess().conditionText(n);
        return '<span class="cw-cond" title="' + esc(tip.slice(0, 220)) + '">' + esc(n) + (editable ? '<button type="button" class="cw-cond-x" data-cb="cond" data-id="' + esc(c.id) + '" data-name="' + esc(n) + '" aria-label="Remove ' + esc(n) + ' from ' + esc(c.name) + '">×</button>' : '') + '</span>';
      }).join('');
    }

    /** The conditions of the creature on stage, with what each one does (first sentence of the SRD text). */
    function conditionHelp(c) {
      if (!c.conditions.length) return '';
      return '<details class="cw-stage-help"><summary>What ' + (c.conditions.length === 1 ? 'this condition does' : 'these conditions do') + '</summary><ul>' +
        c.conditions.map(function (n) { var t = Sess().conditionText(n) || ''; var dot = t.search(/\.\s/); var first = dot > 0 ? t.slice(0, dot + 1) : t; return '<li><strong>' + esc(n) + '.</strong> ' + esc(first.slice(0, 240)) + '</li>'; }).join('') + '</ul></details>';
    }

    function pausedRibbon() {
      return '<p class="cw-ribbon is-paused" role="alert"><strong>⏸ Combat paused.</strong> ' + (isDm ? 'Turns are frozen until you resume.' : 'The Dungeon Master paused the fight.') + '</p>';
    }
    function stateLabel(e) {
      return e.status === 'active' ? (e.paused ? '<span class="cw-state is-paused">Paused</span>' : '<span class="cw-state is-live">In progress</span>') : e.status === 'ended' ? '<span class="cw-state">Ended</span>' : '<span class="cw-state">Not started</span>';
    }

    /** Vitals as players may see them: exact numbers for the party, only "how hurt" for monsters. */
    function publicVitals(c, big) {
      if (c.kind === 'pc') {
        return '<span class="cw-hp' + (big ? ' is-big' : '') + '"><span class="cw-stat-l">HP</span><strong>' + c.hp + '</strong><span class="cw-hp-max"> / ' + c.hpMax + '</span>' + (c.tempHp ? ' <span class="cw-temp">+' + c.tempHp + ' temp</span>' : '') + '</span>' + hpBar(c, big ? 'is-big' : '') + acBadge(c.ac, big);
      }
      return '<span class="cv-pill ' + (c.health === 'unhurt' ? 'is-ok' : 'is-warn') + (big ? ' is-big' : '') + '">' + HEALTH_LABEL[c.health] + '</span>';
    }

    /** Initiative rail: everyone in order, current highlighted, next marked. Each chip jumps to the card. */
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
        return '<li class="cw-rail-item' + cls + '"' + (c.id === curId ? ' aria-current="true"' : '') + '><button type="button" data-jump="' + esc(c.id) + '" title="' + esc(c.name) + '">' +
          '<span class="cw-rail-init">' + (c.initiative == null ? '—' : c.initiative) + '</span><span class="cw-rail-name">' + esc(c.name) + (c.userId && c.userId === ctx.me.id ? ' (you)' : '') + '</span>' + life + mark + '</button></li>';
      }).join('') + '</ol><p class="cw-rail-legend" aria-hidden="true"><span class="is-now">Now</span><span class="is-next">Next</span><span class="is-out">Defeated</span>' + (isDm ? '<span class="is-hid">Hidden from players</span>' : '') + '<span>Tap a name to find its card</span></p></nav>';
    }

    // ---- DM view ------------------------------------------------------------------------------------------------
    function dmRow(c, active, order) {
      var current = enc.status === 'active' && enc.turnId === c.id;
      var upNext = enc.status === 'active' && M().nextUp(enc) && M().nextUp(enc).id === c.id;
      var defeated = M().isDefeated(c);
      var detailed = view === 'detailed';
      var free = conditions.filter(function (n) { return c.conditions.indexOf(n) < 0; });
      var pos = order.findIndex(function (x) { return x.id === c.id; });
      var tag = current ? '<span class="cw-tag is-now">Now</span>' : upNext ? '<span class="cw-tag is-next">Next</span>' : '';
      return '<li class="cw-row' + (current ? ' is-current' : '') + (upNext ? ' is-next' : '') + (defeated ? ' is-defeated' : '') + (c.hidden ? ' is-hidden' : '') + '" data-id="' + esc(c.id) + '" id="cb-row-' + esc(c.id) + '"' + (current ? ' aria-current="true"' : '') + '>' +
        '<div class="cw-row-init"><label class="cw-visually-hidden" for="ini-' + esc(c.id) + '">Initiative for ' + esc(c.name) + '</label>' +
        '<input id="ini-' + esc(c.id) + '" class="cw-num cw-init-input" type="number" inputmode="numeric" data-cb="init" data-id="' + esc(c.id) + '" value="' + (c.initiative == null ? '' : c.initiative) + '" placeholder="—" title="Initiative">' +
        '<button type="button" class="cw-mini-btn" data-cb="roll" data-id="' + esc(c.id) + '" title="Roll d20 ' + signed(c.initMod) + '">d20 ' + signed(c.initMod) + '</button></div>' +
        '<div class="cw-row-main"><div class="cw-row-name">' + tag + '<strong>' + esc(c.name) + '</strong>' +
        '<span class="cw-kind cw-kind-' + c.kind + '">' + KIND_LABEL[c.kind] + '</span>' + (c.hidden ? '<span class="cv-pill">Hidden from players</span>' : '') +
        (defeated ? '<span class="cv-pill is-warn">Defeated</span>' : (M().bloodied(c) ? '<span class="cv-pill is-warn">Bloodied</span>' : '')) +
        (detailed && active && pos >= 0 ? '<span class="cw-muted"> · #' + (pos + 1) + '</span>' : '') + '</div>' +
        '<div class="cw-row-conds">' + conditionChips(c, true) +
        (free.length ? '<select class="cw-select cw-cond-add" data-cb="addcond" data-id="' + esc(c.id) + '" aria-label="Add a condition to ' + esc(c.name) + '"><option value="">+ Condition…</option>' + free.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select>' : '') + '</div></div>' +
        '<div class="cw-row-vitals"><span class="cw-hp"><span class="cw-stat-l">HP</span><strong>' + c.hp + '</strong><span class="cw-hp-max"> / ' + c.hpMax + '</span>' + (c.tempHp ? ' <span class="cw-temp">+' + c.tempHp + ' temp</span>' : '') + '</span>' + hpBar(c) + acBadge(c.ac) + '</div>' +
        '<div class="cw-row-tools" aria-label="DM actions for ' + esc(c.name) + '"><span class="cw-tools-l" aria-hidden="true">DM</span><div class="cw-hpform"><label class="cw-visually-hidden" for="amt-' + esc(c.id) + '">Hit points to change for ' + esc(c.name) + '</label>' +
        '<input id="amt-' + esc(c.id) + '" class="cw-num" type="number" min="1" inputmode="numeric" placeholder="HP" data-amt="' + esc(c.id) + '">' +
        '<button type="button" class="cw-mini-btn is-dmg" data-cb="dmg" data-id="' + esc(c.id) + '">Damage</button><button type="button" class="cw-mini-btn is-heal" data-cb="heal" data-id="' + esc(c.id) + '">Heal</button></div>' +
        '<details class="cw-more"' + (detailed ? ' open' : '') + '><summary>More</summary><div class="cw-row-more">' +
        (detailed ? '<button type="button" class="cw-mini-btn" data-cb="temp" data-id="' + esc(c.id) + '" title="Set Temporary Hit Points to the amount typed in the HP box">Set temp HP</button><button type="button" class="cw-mini-btn" data-cb="hide" data-id="' + esc(c.id) + '">' + (c.hidden ? 'Reveal to players' : 'Hide from players') + '</button>' : '') +
        '<button type="button" class="cw-mini-btn is-dmg" data-cb="remove" data-id="' + esc(c.id) + '">Remove from combat</button></div></details></div></li>';
    }

    function pickerResults() {
      var q = pickerQuery.trim().toLowerCase();
      if (!q) return '<p class="cw-muted">Type a name to search the ' + monsters.length + ' monsters (SRD 5.2.1 and your homebrew).</p>';
      var hits = monsters.filter(function (m) { return m.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
      if (!hits.length) return '<p class="cw-muted">No monster matches “' + esc(pickerQuery) + '”.</p>';
      return '<ul class="cw-picker-list">' + hits.map(function (m) {
        return '<li><span><strong>' + esc(m.name) + '</strong> <span class="cw-muted">CR ' + esc(m.cr) + ' · HP ' + esc(m.hpAverage != null ? m.hpAverage : m.hp) + ' · AC ' + esc(m.ac) + (m.dataset && m.dataset.origin === 'homebrew' ? ' · Homebrew' : '') + '</span></span>' +
          '<span class="cw-picker-add"><input class="cw-num" type="number" min="1" max="20" value="1" aria-label="How many ' + esc(m.name) + '" data-count="' + esc(m.key) + '"><button type="button" class="btn btn-secondary btn-sm" data-cb="addmonster" data-key="' + esc(m.key) + '">Add</button></span></li>';
      }).join('') + '</ul>';
    }

    /** The big "whose turn is it" card for the DM, with quick actions on that creature. */
    function dmStage(order) {
      var cur = M().currentCombatant(enc);
      var up = M().nextUp(enc);
      var ids = order.map(function (c) { return c.id; });
      var after = up && ids.length > 2 ? order[(ids.indexOf(up.id) + 1) % ids.length] : null;
      if (after && cur && after.id === cur.id) after = null;
      var free = cur ? conditions.filter(function (n) { return cur.conditions.indexOf(n) < 0; }) : [];
      var now = cur
        ? '<div class="cw-stage-now"><span class="cw-eyebrow">Round ' + enc.round + ' ' + stateLabel(enc) + '</span>' +
          '<span class="cw-stage-label">Now acting</span><strong class="cw-turnname">' + esc(cur.name) + '</strong>' +
          '<span class="cw-stage-kind">' + KIND_LABEL[cur.kind] + (cur.hidden ? ' · hidden from players' : '') + (M().bloodied(cur) ? ' · <span class="cw-warn-text">Bloodied</span>' : '') + '</span>' +
          '<div class="cw-stage-vitals"><span class="cw-hp is-big"><span class="cw-stat-l">HP</span><strong>' + cur.hp + '</strong><span class="cw-hp-max"> / ' + cur.hpMax + '</span>' + (cur.tempHp ? ' <span class="cw-temp">+' + cur.tempHp + ' temp</span>' : '') + '</span>' + hpBar(cur, 'is-big') + acBadge(cur.ac, true) + '</div>' +
          (cur.conditions.length ? '<div class="cw-row-conds cw-stage-conds">' + conditionChips(cur, true) + '</div>' + conditionHelp(cur) : '<p class="cw-stage-none">No conditions.</p>') +
          (archived ? '' : '<div class="cw-stage-quick" aria-label="Quick actions for ' + esc(cur.name) + '"><div class="cw-hpform"><label class="cw-visually-hidden" for="samt-' + esc(cur.id) + '">Hit points to change for ' + esc(cur.name) + '</label>' +
            '<input id="samt-' + esc(cur.id) + '" class="cw-num" type="number" min="1" inputmode="numeric" placeholder="HP" data-amt="' + esc(cur.id) + '">' +
            '<button type="button" class="cw-mini-btn is-dmg" data-cb="dmg" data-id="' + esc(cur.id) + '">Damage</button><button type="button" class="cw-mini-btn is-heal" data-cb="heal" data-id="' + esc(cur.id) + '">Heal</button></div>' +
            (free.length ? '<select class="cw-select cw-cond-add" data-cb="addcond" data-id="' + esc(cur.id) + '" aria-label="Add a condition to ' + esc(cur.name) + '"><option value="">+ Condition…</option>' + free.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select>' : '') + '</div>') +
          '</div>'
        : '<div class="cw-stage-now"><span class="cw-eyebrow">Round ' + enc.round + ' ' + stateLabel(enc) + '</span><strong class="cw-turnname">Choose whose turn it is</strong><p class="cw-muted">Everyone in the order is defeated or removed. Add combatants or end the combat.</p></div>';
      var side = '<div class="cw-stage-side"><div class="cw-round"><span class="cw-round-l">Round</span><strong>' + enc.round + '</strong></div>' +
        (up ? '<div class="cw-stage-next"><span class="cw-upnext">Up next: <strong>' + esc(up.name) + '</strong></span><span class="cw-stage-mini">' + (up.ac != null ? 'AC ' + up.ac + ' · ' : '') + 'HP ' + up.hp + '/' + up.hpMax + '</span></div>' : '') +
        (after ? '<div class="cw-stage-after"><span class="cw-stage-l">Then</span> ' + esc(after.name) + '</div>' : '') + '</div>';
      return '<section class="cw-turnbar cw-stage' + (enc.paused ? ' is-paused' : '') + '" role="status" aria-label="Current turn">' + (enc.paused ? pausedRibbon() : '') + now + side + '</section>';
    }

    function dmControls() {
      return '<div class="cw-dmbar" role="toolbar" aria-label="Dungeon Master controls"><span class="cw-dmbar-l">DM controls</span>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-cb="prev"' + (enc.paused ? ' disabled' : '') + '>← Previous</button>' +
        '<button type="button" class="btn btn-primary cw-nextbtn" data-cb="next"' + (enc.paused ? ' disabled' : '') + '>Next turn →</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-cb="' + (enc.paused ? 'resume' : 'pause') + '">' + (enc.paused ? 'Resume' : 'Pause') + '</button>' +
        '<button type="button" class="btn btn-secondary btn-sm cw-dmbar-end" data-cb="end">End combat</button></div>';
    }

    function setupChecklist(party) {
      var inFight = enc.combatants.filter(function (c) { return !c.removed && !M().isDefeated(c); });
      var missing = M().missingInitiative(enc);
      var steps = [
        { done: inFight.length >= 1, label: inFight.length ? inFight.length + ' combatant' + (inFight.length === 1 ? '' : 's') + ' added' : 'Add the party and the monsters' },
        { done: inFight.length > 0 && !missing.length, label: !inFight.length ? 'Enter initiative' : missing.length ? 'Initiative missing for ' + missing.length + ': ' + missing.slice(0, 4).map(function (c) { return c.name; }).join(', ') + (missing.length > 4 ? '…' : '') : 'Everyone has initiative' },
        { done: false, label: 'Start combat' },
      ];
      var ready = steps[0].done && steps[1].done;
      var intro = inFight.length ? '' : '<div class="cw-howto"><strong>New to the tracker?</strong> 1. Add the party and the monsters below. 2. Type each initiative (players roll their own; use “Roll initiative for monsters & NPCs” for the rest). 3. Start combat, then press <em>Next turn</em> after each turn. You track damage and conditions; the tracker keeps the order and the numbers. It doesn’t roll attacks or apply rules for you.</div>';
      return '<section class="cw-card cw-setup-check" aria-label="Before you start">' + intro + '<ol class="cw-steps">' + steps.map(function (s, i) {
        var now = !s.done && steps.slice(0, i).every(function (x) { return x.done; });
        return '<li class="' + (s.done ? 'is-done' : now ? 'is-now' : '') + '"' + (now ? ' aria-current="step"' : '') + '><span class="cw-step-dot" aria-hidden="true">' + (s.done ? '✓' : i + 1) + '</span><span>' + esc(s.label) + '</span></li>';
      }).join('') + '</ol>' +
        '<div class="cw-actions"><button type="button" class="btn btn-primary" data-cb="start"' + (ready ? '' : ' aria-describedby="cb-start-why"') + '>Start combat</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-cb="rollall"' + (missing.some(function (c) { return c.kind !== 'pc'; }) ? '' : ' disabled') + '>Roll initiative for monsters &amp; NPCs</button>' +
        '<button type="button" class="cv-link-btn cv-danger" data-cb="clear">Discard encounter</button></div>' +
        (ready ? '' : '<p class="cw-muted cw-fine" id="cb-start-why">Player characters roll their own initiative at the table: type their results in the boxes on their cards.</p>') +
        '</section>';
    }

    function dmView() {
      if (!enc) {
        return '<div class="cw-card cw-empty cw-empty-lg"><h3>No encounter yet</h3><p>Set one up with the party and the monsters you need, enter initiative, then start combat.</p>' +
          (archived ? '<p class="cw-muted">This campaign is archived.</p>' : '<button type="button" class="btn btn-primary" data-cb="new">Set up an encounter</button>') + '</div>';
      }
      var order = M().turnOrder(enc);
      var active = enc.status === 'active';
      var setup = enc.status === 'setup';
      var ids = {};
      order.forEach(function (c) { ids[c.id] = 1; });
      var rest = enc.combatants.filter(function (c) { return !ids[c.id]; });
      var rows = order.concat(rest).map(function (c) { return dmRow(c, active, order); }).join('');
      var party = ctx.campaign.roster.filter(function (m) { return m.role === 'player' && m.character && !enc.combatants.some(function (c) { return c.kind === 'pc' && c.userId === m.userId; }); });
      var up = M().nextUp(enc);

      var phases = [['setup', 'Set up'], ['active', 'Fight'], ['ended', 'Ended']];
      var viewBar = '<div class="cw-viewbar"><ol class="cw-phase" aria-label="Encounter stage">' + phases.map(function (p) { return '<li class="' + (enc.status === p[0] ? 'is-on' : '') + '"' + (enc.status === p[0] ? ' aria-current="step"' : '') + '>' + p[1] + '</li>'; }).join('') + '</ol>' +
        '<div class="cw-modeswitch" role="group" aria-label="How much to show"><button type="button" class="cw-mode' + (view === 'basic' ? ' is-on' : '') + '" data-cb="view" data-view="basic" aria-pressed="' + (view === 'basic') + '">Basic</button>' +
        '<button type="button" class="cw-mode' + (view === 'detailed' ? ' is-on' : '') + '" data-cb="view" data-view="detailed" aria-pressed="' + (view === 'detailed') + '">Detailed</button></div>' +
        '<span class="cw-muted cw-viewhint">' + (view === 'basic' ? 'Turn, hit points and conditions.' : 'Adds temporary HP, hiding creatures, order numbers and the event log.') + '</span></div>';

      var stage = active ? dmStage(order) + (archived ? '' : dmControls())
        : enc.status === 'ended'
          ? '<section class="cw-turnbar cw-stage is-ended" role="status"><div class="cw-stage-now"><span class="cw-eyebrow">' + stateLabel(enc) + '</span><strong class="cw-turnname">Combat ended after ' + enc.round + ' round' + (enc.round === 1 ? '' : 's') + '</strong>' +
            '<p class="cw-muted">' + enc.combatants.filter(function (c) { return M().isDefeated(c); }).length + ' defeated. Hit points stay as they were for reference until you clear the encounter.</p></div></section>' +
            (archived ? '' : '<div class="cw-dmbar" role="toolbar" aria-label="Dungeon Master controls"><span class="cw-dmbar-l">DM controls</span><button type="button" class="btn btn-secondary btn-sm" data-cb="reopen">Back to setup</button><button type="button" class="btn btn-secondary btn-sm" data-cb="clear">Clear encounter</button></div>')
          : '';

      var setupPanel = setup ? setupChecklist(party) + '<section class="cw-card"><h3 class="cw-card-title">Add combatants</h3>' +
        '<div class="cw-setup-row"><button type="button" class="btn btn-secondary btn-sm" data-cb="addparty"' + (party.length ? '' : ' disabled') + '>Add the party (' + party.length + ')</button>' +
        '<form class="cw-custom" data-cb-form="custom"><input class="form-control" name="name" placeholder="Custom name" maxlength="80" required aria-label="Custom combatant name"><input class="cw-num" name="hp" type="number" min="1" placeholder="HP" aria-label="Hit points"><input class="cw-num" name="ac" type="number" min="0" placeholder="AC" aria-label="Armor Class"><input class="cw-num" name="mod" type="number" placeholder="Init ±" aria-label="Initiative modifier">' +
        '<select class="cw-select" name="kind" aria-label="Kind"><option value="monster">Monster</option><option value="npc">NPC</option></select><button type="submit" class="btn btn-secondary btn-sm">Add</button></form></div>' +
        '<label class="cw-field"><span>Monster from the bestiary</span><input class="form-control" type="search" id="cb-search" value="' + esc(pickerQuery) + '" placeholder="Search monsters…" autocomplete="off"></label>' +
        '<div id="cb-picker">' + pickerResults() + '</div></section>' : '';

      var railHtml = active ? rail(order.concat(rest.filter(function (c) { return !c.removed; })), enc.turnId, up && up.id, { defeated: M().isDefeated, exact: function () { return true; } }) : '';

      var log = view === 'detailed' && enc.log.length ? '<details class="cw-card cw-log"><summary>Event log (' + enc.log.length + ')</summary><ol>' + enc.log.slice().reverse().slice(0, 40).map(function (l) { return '<li><span class="cw-muted">R' + l.round + '</span> ' + esc(l.text) + '</li>'; }).join('') + '</ol></details>' : '';

      return viewBar + stage + railHtml + setupPanel +
        '<section class="cw-card cw-order"><h3 class="cw-card-title">' + esc(enc.name) + ' <span class="cw-muted">· ' + (active ? 'turn order' : 'combatants') + '</span></h3>' +
        (rows ? '<div class="cw-row-head" aria-hidden="true"><span>Initiative</span><span>Creature &amp; conditions</span><span>Vitals</span><span>DM actions</span></div><ol class="cw-rows">' + rows + '</ol>' : '<p class="cw-muted">Nobody yet. Add the party and some monsters.</p>') + '</section>' + log +
        '<p class="cw-muted cw-fine">Hit points here are for this encounter only; they are not written back to character sheets. Ties in initiative go to the higher modifier, then to whoever was added first; change the numbers to decide otherwise. A monster at 0 HP is marked defeated and skipped; player characters stay in the order. Enter in an HP box applies damage; Shift+Enter heals.</p>';
    }

    // ---- Player view --------------------------------------------------------------------------------------------
    function turnGuide(me) {
      if (checklist.turn !== enc.turnId + ':' + enc.round) checklist = { turn: enc.turnId + ':' + enc.round, done: {} };
      return '<div class="cw-turnguide"><span class="cw-stage-l">On your turn</span><ul>' + TURN_PARTS.map(function (p) {
        var hint = p.key === 'move' && me && me.speed ? 'Up to ' + me.speed + ' ft., split before and after your action if you like.' : p.hint;
        return '<li><label class="cw-check"><input type="checkbox" data-turnpart="' + p.key + '"' + (checklist.done[p.key] ? ' checked' : '') + '> <span><strong>' + p.label + '</strong> <span class="cw-muted">' + esc(hint) + '</span></span></label></li>';
      }).join('') + '</ul><p class="cw-muted cw-fine">A reminder for you only; the DM still runs the turn. You also have one Reaction per round (for example an Opportunity Attack).</p></div>';
    }

    function playerView() {
      if (!enc || !enc.combatants || !enc.combatants.length) {
        return '<div class="cw-card cw-empty cw-empty-lg"><h3>No encounter is running</h3><p>When the Dungeon Master starts combat, the turn order appears here.</p></div>';
      }
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
        var who = mine ? 'It’s your turn!' : cur ? esc(cur.name) + '’s turn' : 'Waiting…';
        var mineNote = mine ? '' : me && wait === 1 ? '<p class="cw-stage-you is-soon">You’re up next. Get ready.</p>' : me && wait != null ? '<p class="cw-stage-you">Your turn in ' + wait + ' turns.</p>' : '';
        stage = '<section class="cw-turnbar cw-stage' + (mine ? ' is-mine' : '') + (enc.paused ? ' is-paused' : '') + '" role="status" aria-label="Current turn">' + (enc.paused ? pausedRibbon() : '') + '<div class="cw-stage-now">' +
          '<span class="cw-eyebrow">Round ' + enc.round + ' ' + stateLabel(enc) + '</span><span class="cw-stage-label">' + (mine ? 'You are acting' : 'Now acting') + '</span><strong class="cw-turnname">' + who + '</strong>' +
          (cur ? '<span class="cw-stage-kind">' + KIND_LABEL[cur.kind] + '</span><div class="cw-stage-vitals">' + publicVitals(cur, true) + '</div>' +
            (cur.conditions.length ? '<div class="cw-row-conds cw-stage-conds">' + conditionChips(cur, false) + '</div>' + conditionHelp(cur) : '') : '') +
          mineNote + (mine && !enc.paused ? turnGuide(me) : '') + '</div>' +
          '<div class="cw-stage-side"><div class="cw-round"><span class="cw-round-l">Round</span><strong>' + enc.round + '</strong></div>' +
          (nextC ? '<div class="cw-stage-next"><span class="cw-upnext">Up next: <strong>' + esc(nextC.name) + (nextC.userId === ctx.me.id ? ' (you)' : '') + '</strong></span></div>' : '') + '</div></section>';
      } else {
        stage = '<section class="cw-turnbar cw-stage is-ended" role="status"><div class="cw-stage-now"><span class="cw-eyebrow">' + stateLabel(enc) + '</span><strong class="cw-turnname">' + (enc.status === 'ended' ? 'Combat has ended' : 'The encounter is being set up') + '</strong>' +
          (enc.status === 'ended' ? '' : '<p class="cw-muted">Roll initiative when the DM asks and tell them the result.</p>') + '</div></section>';
      }

      var rows = ordered.concat(unordered).map(function (c) {
        var current = enc.turnId === c.id;
        var isNext = enc.nextId === c.id;
        return '<li class="cw-row is-public' + (current ? ' is-current' : '') + (isNext ? ' is-next' : '') + (c.defeated ? ' is-defeated' : '') + (c.userId === ctx.me.id ? ' is-mine' : '') + '" id="cb-row-' + esc(c.id) + '"' + (current ? ' aria-current="true"' : '') + '>' +
          '<div class="cw-row-init"><span class="cw-initval" title="Initiative">' + (c.initiative == null ? '—' : c.initiative) + '</span></div>' +
          '<div class="cw-row-main"><div class="cw-row-name">' + (current ? '<span class="cw-tag is-now">Now</span>' : isNext ? '<span class="cw-tag is-next">Next</span>' : '') + '<strong>' + esc(c.name) + (c.userId === ctx.me.id ? ' (you)' : '') + '</strong><span class="cw-kind cw-kind-' + c.kind + '">' + KIND_LABEL[c.kind] + '</span></div>' +
          (c.conditions.length ? '<div class="cw-row-conds">' + conditionChips(c, false) + '</div>' : '') + '</div>' +
          '<div class="cw-row-vitals">' + publicVitals(c, false) + '</div></li>';
      }).join('');
      var railHtml = enc.status === 'active' ? rail(ordered, enc.turnId, enc.nextId, { defeated: function (c) { return c.defeated; }, exact: function (c) { return c.kind === 'pc'; } }) : '';
      return stage + railHtml + '<section class="cw-card cw-order"><h3 class="cw-card-title">' + esc(enc.name) + '</h3><ol class="cw-rows">' + rows + '</ol></section>' +
        '<p class="cw-muted cw-fine">Monsters show only how hurt they look. The Dungeon Master tracks their exact hit points.</p>';
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
    }

    // ---- Loading ------------------------------------------------------------------------------------------------
    async function load() {
      var res = await Sess().load(ctx);
      if (!alive) return;
      if (!res.ok) { loadError = res.message; draw(); return; }
      loadError = null;
      enc = res.encounter;
      version = res.version;
      saveState = { status: 'idle' };
      draw();
    }

    // ---- Events -------------------------------------------------------------------------------------------------
    var rollRng = null;
    function roll(c) { var r = M().rollInitiative(c, rollRng); M().setInitiative(enc, c.id, r.total); return r; }

    host.addEventListener('click', async function (e) {
      var jump = e.target.closest('[data-jump]');
      if (jump) {
        var row = host.querySelector('#cb-row-' + (global.CSS && CSS.escape ? CSS.escape(jump.getAttribute('data-jump')) : jump.getAttribute('data-jump')));
        if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.add('is-flash'); global.setTimeout(function () { row.classList.remove('is-flash'); }, 1200); }
        return;
      }
      var b = e.target.closest('[data-cb]');
      if (!b || !isDm && b.getAttribute('data-cb') !== 'reload') return;
      var a = b.getAttribute('data-cb');
      var id = b.getAttribute('data-id');
      // The amount box next to the button that was pressed (the stage and the card each have one for the same creature).
      var amt = function () { var box = b.closest('.cw-hpform'); var el = box ? box.querySelector('[data-amt]') : host.querySelector('[data-amt="' + id + '"]'); var v = el ? el.value : ''; if (el) el.value = ''; return v; };
      if (a === 'reload') { load(); return; }
      if (a === 'view') { view = b.getAttribute('data-view') === 'detailed' ? 'detailed' : 'basic'; try { global.localStorage.setItem('fog_combat_view', view); } catch (err) { /* preference only */ } draw(); return; }
      if (a === 'retry-save') { persist(); return; }
      if (archived) { UI().notice('This campaign is archived: restore it to run combat.', 'error'); return; }
      if (a === 'new') { enc = M().newEncounter('Encounter'); version = null; mutate(function () { return { ok: true }; }); }
      else if (a === 'addparty') {
        mutate(function (x) {
          ctx.campaign.roster.filter(function (m) { return m.role === 'player' && m.character; }).forEach(function (m) {
            if (!x.combatants.some(function (c) { return c.kind === 'pc' && c.userId === m.userId; })) M().addCombatant(x, Sess().pcCombatant(m, ctx.campaign));
          });
          return { ok: true };
        });
      }
      else if (a === 'addmonster') {
        var key = b.getAttribute('data-key');
        var entry = monsters.find(function (m) { return m.key === key; });
        var countEl = host.querySelector('[data-count="' + (global.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
        var n = Math.max(1, Math.min(20, Number(countEl && countEl.value) || 1));
        if (!entry) return;
        mutate(function (x) {
          var existing = x.combatants.filter(function (c) { return c.ref === entry.key; }).length;
          for (var i = 0; i < n; i++) {
            var r = M().addCombatant(x, Sess().monsterCombatant(entry, n > 1 || existing ? entry.name + ' ' + (existing + i + 1) : entry.name));
            if (!r.ok) return r;
          }
          return { ok: true };
        });
      }
      else if (a === 'roll') {
        var c1 = M().find(enc, id);
        if (!c1) return;
        var r1 = await global.FogDice.roll('d20', { label: c1.name + ' (d20)' });
        if (!r1.ok || !alive) return;
        mutate(function () {
          var total = r1.rolls[0] + c1.initMod;
          M().setInitiative(enc, id, total);
          UI().notice(c1.name + ' rolled ' + r1.rolls[0] + ' ' + signed(c1.initMod) + ' = ' + total + ' for initiative.');
          return { ok: true };
        });
      }
      else if (a === 'rollall') mutate(function () { enc.combatants.forEach(function (c) { if (c.kind !== 'pc' && c.initiative == null && !c.removed) roll(c); }); return { ok: true }; });
      else if (a === 'start') mutate(function () { return M().start(enc); });
      else if (a === 'next') mutate(function () { return M().nextTurn(enc); });
      else if (a === 'prev') mutate(function () { return M().previousTurn(enc); });
      else if (a === 'pause') mutate(function () { return M().pause(enc); });
      else if (a === 'resume') mutate(function () { return M().resume(enc); });
      else if (a === 'end') {
        var okEnd = await UI().confirm({ title: 'End combat?', message: 'The encounter stays visible as finished until you clear it.', confirmLabel: 'End combat' });
        if (okEnd) mutate(function () { M().end(enc); return { ok: true }; });
      }
      else if (a === 'reopen') mutate(function () { M().reopen(enc); return { ok: true }; });
      else if (a === 'clear') {
        var okClear = await UI().confirm({ title: 'Clear this encounter?', message: 'Everyone’s combat view is emptied. This can’t be undone.', confirmLabel: 'Clear encounter', danger: true });
        if (!okClear) return;
        var res = await D().clearCombat(ctx.id);
        if (!res.ok) { UI().notice(res.message, 'error'); return; }
        enc = null; version = null; saveState = { status: 'idle' }; draw();
      }
      else if (a === 'dmg') mutate(function () { return M().damage(enc, id, amt()); });
      else if (a === 'heal') mutate(function () { return M().heal(enc, id, amt()); });
      else if (a === 'temp') mutate(function () { return M().setTempHp(enc, id, amt()); });
      else if (a === 'cond') mutate(function () { return M().toggleCondition(enc, id, b.getAttribute('data-name'), conditions); });
      else if (a === 'hide') mutate(function () { var c = M().find(enc, id); c.hidden = !c.hidden; return { ok: true }; });
      else if (a === 'remove') {
        var c0 = M().find(enc, id);
        var okRm = await UI().confirm({ title: 'Remove ' + (c0 ? c0.name : 'this combatant') + '?', message: 'They leave the encounter.', confirmLabel: 'Remove', danger: true });
        if (okRm) mutate(function () { M().removeCombatant(enc, id); return { ok: true }; });
      }
    });

    host.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute && t.hasAttribute('data-turnpart')) { checklist.done[t.getAttribute('data-turnpart')] = t.checked; return; }
      if (!isDm || archived) return;
      var a = t.getAttribute && t.getAttribute('data-cb');
      if (a === 'init') mutate(function () { return M().setInitiative(enc, t.getAttribute('data-id'), t.value); });
      else if (a === 'addcond' && t.value) mutate(function () { return M().toggleCondition(enc, t.getAttribute('data-id'), t.value, conditions); });
    });

    host.addEventListener('input', function (e) {
      if (e.target.id === 'cb-search') {
        pickerQuery = e.target.value;
        host.querySelector('#cb-picker').innerHTML = pickerResults();
      }
    });

    host.addEventListener('keydown', function (e) {
      // Enter in an HP amount field applies damage; Shift+Enter heals (quick table use).
      if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-amt') && isDm && !archived) {
        e.preventDefault();
        var id = e.target.getAttribute('data-amt');
        var v = e.target.value;
        e.target.value = '';
        mutate(function () { return e.shiftKey ? M().heal(enc, id, v) : M().damage(enc, id, v); });
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

    // ---- Start --------------------------------------------------------------------------------------------------
    body.innerHTML = '<div class="cw-card cw-empty" aria-busy="true"><p class="cw-muted">Loading the encounter…</p></div>';
    await global.FogCompendium.ready();
    if (isDm) {
      if (global.FogCompendiumPage && global.FogCompendiumPage.loadHomebrew) await global.FogCompendiumPage.loadHomebrew();
      monsters = global.FogCompendium.monsters().filter(function (m) { return m.complete; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    }
    conditions = Sess().conditionNames();
    await load();

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
    return function cleanup() {
      alive = false;
      unmountDice();
      offs.forEach(function (off) { off(); });
    };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.combat = { render: render };
})(window);
