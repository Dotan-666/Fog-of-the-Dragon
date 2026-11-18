/**
 * Encounter Builder — CR-balanced encounter generator.
 *
 * Uses the 5e 2024 encounter-building guidelines: XP thresholds per character level,
 * difficulty tiers (Low / Moderate / High), and encounter multipliers for groups.
 * Pulls monsters from FogCompendium, filters by CR/type/environment, and lets the
 * DM drop a built encounter straight into Combat.
 */
(function (global) {
  'use strict';

  var Comp = function () { return global.FogCompendium; };
  var UI = function () { return global.FogCampaignUI; };
  function esc(s) { return UI().esc(s); }

  // 5e XP thresholds per character level: [Low, Moderate, High]
  var THRESHOLDS = {
    1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400],
    4: [250, 375, 500], 5: [500, 750, 1100], 6: [600, 1000, 1400],
    7: [750, 1300, 1700], 8: [1000, 1700, 2100], 9: [1300, 2000, 2600],
    10: [1600, 2300, 3100], 11: [1900, 2900, 4100], 12: [2200, 3700, 4700],
    13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800],
    16: [3800, 6100, 9800], 17: [4500, 7200, 11600], 18: [5000, 8700, 14200],
    19: [5500, 10700, 17200], 20: [6400, 13200, 22400],
  };

  // Encounter multiplier by number of monsters
  function encounterMultiplier(count) {
    if (count <= 1) return 1;
    if (count === 2) return 1.5;
    if (count <= 6) return 2;
    if (count <= 10) return 2.5;
    if (count <= 14) return 3;
    return 4;
  }

  // CR string to numeric value
  function crNum(cr) {
    if (cr === '1/8') return 0.125;
    if (cr === '1/4') return 0.25;
    if (cr === '1/2') return 0.5;
    return parseFloat(cr) || 0;
  }

  var TYPES = ['Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental',
    'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead'];

  function render(host, ctx) {
    var alive = true;
    var monsters = [];
    var partyLevel = 5, partySize = 4;
    var filterType = '', filterCrMin = '', filterCrMax = '';
    var built = []; // { monster, count }
    var suggestions = [];

    Comp().ready().then(function () {
      if (!alive) return;
      monsters = Comp().monsters().filter(function (m) { return m.complete; });
      draw();
    });

    function xpBudget(diff) {
      var t = THRESHOLDS[partyLevel] || THRESHOLDS[5];
      return t[diff] * partySize;
    }

    function builtXP() {
      var total = 0;
      built.forEach(function (b) { total += (b.monster.xp || 0) * b.count; });
      var count = built.reduce(function (s, b) { return s + b.count; }, 0);
      return { raw: total, adjusted: Math.round(total * encounterMultiplier(count)), count: count };
    }

    function difficulty(adjXP) {
      var low = xpBudget(0), mod = xpBudget(1), high = xpBudget(2);
      if (adjXP >= high) return { label: 'Deadly', cls: 'is-deadly' };
      if (adjXP >= mod) return { label: 'Hard', cls: 'is-hard' };
      if (adjXP >= low) return { label: 'Medium', cls: 'is-medium' };
      return { label: 'Easy', cls: 'is-easy' };
    }

    function suggest() {
      var budget = xpBudget(1); // target moderate
      var maxCR = partyLevel + 3;
      suggestions = monsters.filter(function (m) {
        var cr = crNum(m.cr);
        if (cr > maxCR) return false;
        if (filterType && m.type.toLowerCase().indexOf(filterType.toLowerCase()) < 0) return false;
        if (filterCrMin !== '' && cr < parseFloat(filterCrMin)) return false;
        if (filterCrMax !== '' && cr > parseFloat(filterCrMax)) return false;
        return (m.xp || 0) <= budget;
      }).sort(function (a, b) { return (b.xp || 0) - (a.xp || 0); }).slice(0, 40);
    }

    // Encounter library (localStorage)
    var LIB_KEY = 'fog_encounter_library';
    function getLibrary() { try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch (e) { return []; } }
    function saveLibrary(lib) { try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch (e) { /* ignore */ } }

    function saveToLibrary(name) {
      if (!built.length) return;
      var xp = builtXP();
      var enc = {
        name: name || 'Encounter (' + new Date().toLocaleDateString() + ')',
        monsters: built.map(function (b) { return { id: b.monster.id, name: b.monster.name, cr: b.monster.cr, xp: b.monster.xp || 0, count: b.count }; }),
        adjustedXP: xp.adjusted,
        rawXP: xp.raw,
        partyLevel: partyLevel,
        partySize: partySize,
        savedAt: new Date().toISOString()
      };
      var lib = getLibrary();
      lib.unshift(enc);
      if (lib.length > 50) lib = lib.slice(0, 50);
      saveLibrary(lib);
    }

    function loadFromLibrary(i) {
      var lib = getLibrary();
      var enc = lib[i];
      if (!enc) return;
      built = [];
      enc.monsters.forEach(function (m) {
        var found = monsters.find(function (x) { return x.id === m.id; });
        if (found) built.push({ monster: found, count: m.count });
        else built.push({ monster: { id: m.id, name: m.name, cr: m.cr, xp: m.xp, size: '', type: '' }, count: m.count });
      });
      draw();
    }

    async function saveToAdventure(ctx) {
      if (!built.length) return;
      var Store = global.FogAdventureStore;
      if (!Store) { UI().notice('Adventure module not loaded.', 'error'); return; }
      var r = await Store.list();
      if (!r.ok) { UI().notice(r.message, 'error'); return; }
      var advs = r.adventures;
      if (!advs.length) { UI().notice('You don\'t have any adventures yet. Create one from the Adventures page.', 'error'); return; }
      var options = advs.map(function (a) {
        return '<option value="' + esc(a.id) + '">' + esc(a.title) + '</option>';
      }).join('');
      var dlg = document.createElement('dialog');
      dlg.className = 'eb-save-dialog';
      dlg.innerHTML = '<form method="dialog"><h3>Save Encounter to Adventure</h3>' +
        '<label class="cw-field"><span>Adventure</span><select class="form-control" name="adv">' + options + '</select></label>' +
        '<label class="cw-field"><span>Encounter name</span><input class="form-control" name="name" value="Encounter" maxlength="120" required></label>' +
        '<p class="cw-muted">The encounter will be added to this adventure\'s encounter list.</p>' +
        '<div class="cw-actions"><button type="submit" class="btn btn-primary btn-sm" value="save">Save</button><button type="submit" class="btn btn-secondary btn-sm" value="cancel">Cancel</button></div></form>';
      host.appendChild(dlg);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      dlg.addEventListener('close', async function () {
        if (dlg.returnValue !== 'save') { dlg.remove(); return; }
        var form = dlg.querySelector('form');
        var advId = form.adv.value;
        var encName = form.name.value.trim() || 'Encounter';
        dlg.remove();
        var ag = await Store.get(advId);
        if (!ag.ok) { UI().notice(ag.message, 'error'); return; }
        var adv = ag.adventure;
        var Model = global.FogAdventureModel;
        if (!Model) { UI().notice('Adventure model not loaded.', 'error'); return; }
        var enc = Model.newEncounter(encName);
        enc.monsters = built.map(function (b) { return { ref: b.monster.id, name: b.monster.name, count: b.count }; });
        var xp = builtXP();
        var diff = difficulty(xp.adjusted);
        enc.difficulty = diff.label === 'Easy' ? '' : diff.label === 'Medium' ? 'Low' : diff.label === 'Hard' ? 'Moderate' : 'High';
        enc.dmNotes = xp.adjusted + ' adjusted XP (' + xp.raw + ' raw)';
        adv.content.encounters = (adv.content.encounters || []).concat([enc]);
        var sr = await Store.save(adv);
        if (!sr.ok) { UI().notice(sr.message, 'error'); return; }
        UI().notice('Encounter "' + encName + '" saved to "' + adv.title + '".');
      });
    }

    function addMonster(m) {
      var existing = built.find(function (b) { return b.monster.id === m.id; });
      if (existing) { existing.count++; } else { built.push({ monster: m, count: 1 }); }
      draw();
    }

    function removeMonster(id) {
      var i = built.findIndex(function (b) { return b.monster.id === id; });
      if (i >= 0) {
        built[i].count--;
        if (built[i].count <= 0) built.splice(i, 1);
      }
      draw();
    }

    function draw() {
      suggest();
      var xp = builtXP();
      var diff = difficulty(xp.adjusted);
      var low = xpBudget(0), mod = xpBudget(1), high = xpBudget(2);
      var pct = high > 0 ? Math.min(100, Math.round(xp.adjusted / high * 100)) : 0;

      host.innerHTML = '<div class="cw-page cw-encounter">' +
        '<header class="cw-page-head"><div><h2 class="cw-page-title">Encounter Builder</h2>' +
        '<p class="cw-page-sub">Build CR-balanced encounters for your party and drop them into combat.</p></div></header>' +

        // Party config
        '<section class="eb-config cw-card">' +
        '<h3 class="eb-config-title">Party</h3>' +
        '<div class="eb-party-fields">' +
        '<label class="cw-field"><span>Party size</span><input type="number" class="form-control cw-num" id="eb-size" min="1" max="10" value="' + partySize + '"></label>' +
        '<label class="cw-field"><span>Average level</span><input type="number" class="form-control cw-num" id="eb-level" min="1" max="20" value="' + partyLevel + '"></label>' +
        '</div>' +
        '<div class="eb-budget">' +
        '<span class="eb-budget-tier is-easy">Easy &lt; ' + low + ' XP</span>' +
        '<span class="eb-budget-tier is-medium">Medium ' + low + '–' + mod + '</span>' +
        '<span class="eb-budget-tier is-hard">Hard ' + mod + '–' + high + '</span>' +
        '<span class="eb-budget-tier is-deadly">Deadly &gt; ' + high + '</span>' +
        '</div></section>' +

        // Current encounter
        '<section class="eb-encounter cw-card">' +
        '<h3 class="eb-config-title">Current Encounter' +
        (xp.count > 0 ? ' <span class="eb-diff ' + diff.cls + '">' + diff.label + '</span>' : '') + '</h3>' +
        (built.length === 0
          ? '<p class="cw-muted">Add monsters from the list below to build your encounter.</p>'
          : '<div class="eb-built">' +
            built.map(function (b) {
              return '<div class="eb-built-row">' +
                (b.monster.imageUrl ? '<img class="eb-built-img" src="' + esc(b.monster.imageUrl) + '" alt="" loading="lazy">' : '<span class="eb-built-ph"></span>') +
                '<div class="eb-built-info"><strong>' + esc(b.monster.name) + '</strong><span class="cw-muted">CR ' + esc(b.monster.cr) + ' &middot; ' + (b.monster.xp || 0) + ' XP</span></div>' +
                '<span class="eb-built-count">&times;' + b.count + '</span>' +
                '<button type="button" class="btn btn-secondary btn-sm" data-eb-add="' + esc(b.monster.id) + '">+</button>' +
                '<button type="button" class="btn btn-secondary btn-sm" data-eb-remove="' + esc(b.monster.id) + '">&minus;</button>' +
                '</div>';
            }).join('') +
            '</div>' +
            '<div class="eb-xp-bar"><div class="eb-xp-fill" style="width:' + pct + '%"></div></div>' +
            '<p class="eb-xp-label"><strong>' + xp.adjusted + ' adjusted XP</strong> (' + xp.raw + ' raw, &times;' + encounterMultiplier(xp.count) + ' for ' + xp.count + ' creature' + (xp.count !== 1 ? 's' : '') + ')</p>'
        ) +
        (built.length > 0 && ctx.isDm ? '<div class="eb-actions"><button type="button" class="btn btn-primary btn-sm" data-eb="to-combat">Add to Combat</button><button type="button" class="btn btn-secondary btn-sm" data-eb="save-adventure">Save to Adventure</button><button type="button" class="btn btn-secondary btn-sm" data-eb="save-library">Save to Library</button><button type="button" class="btn btn-secondary btn-sm" data-eb="clear">Clear encounter</button></div>' : '') +
        '</section>' +

        // Saved encounter library
        '<section class="eb-library cw-card">' +
        '<h3 class="cw-card-title">Encounter Library</h3>' +
        (function () {
          var lib = getLibrary();
          if (!lib.length) return '<p class="cw-muted">Save encounters here to reuse them later. They\'re stored on this device.</p>';
          return '<div class="eb-saved-list">' + lib.map(function (enc, i) {
            var diff = difficulty(enc.adjustedXP || 0);
            return '<div class="eb-saved-row">' +
              '<div class="eb-saved-info"><strong>' + esc(enc.name) + '</strong>' +
              '<span class="cw-muted">' + enc.monsters.map(function (m) { return m.count + '× ' + esc(m.name); }).join(', ') +
              ' · ' + (enc.adjustedXP || 0) + ' XP <span class="eb-diff ' + diff.cls + '">' + diff.label + '</span></span></div>' +
              '<div class="eb-saved-actions">' +
              '<button type="button" class="btn btn-secondary btn-sm" data-eb="load-lib" data-i="' + i + '">Load</button>' +
              '<button type="button" class="btn btn-secondary btn-sm" data-eb="del-lib" data-i="' + i + '">Delete</button></div></div>';
          }).join('') + '</div>';
        })() +
        '</section>' +

        // Monster catalog
        '<section class="eb-catalog">' +
        '<h3 class="eb-config-title">Monster Catalog <span class="cw-muted">(' + monsters.length + ' creatures)</span></h3>' +
        '<div class="eb-filters">' +
        '<select class="form-control" id="eb-type"><option value="">All types</option>' +
        TYPES.map(function (t) { return '<option value="' + t + '"' + (filterType === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
        '</select>' +
        '<input type="number" class="form-control cw-num" id="eb-cr-min" placeholder="CR min" min="0" max="30" step="0.125" value="' + filterCrMin + '">' +
        '<input type="number" class="form-control cw-num" id="eb-cr-max" placeholder="CR max" min="0" max="30" step="0.125" value="' + filterCrMax + '">' +
        '</div>' +
        '<div class="eb-list">' +
        (suggestions.length === 0 ? '<p class="cw-muted">No monsters match your filters within budget.</p>' : suggestions.map(function (m) {
          return '<button type="button" class="eb-monster-row" data-eb-pick="' + esc(m.id) + '">' +
            (m.imageUrl ? '<img class="eb-row-img" src="' + esc(m.imageUrl) + '" alt="" loading="lazy">' : '<span class="eb-row-ph"></span>') +
            '<span class="eb-row-name">' + esc(m.name) + '</span>' +
            '<span class="eb-row-meta">' + esc(m.size + ' ' + m.type) + '</span>' +
            '<span class="eb-row-cr">CR ' + esc(m.cr) + '</span>' +
            '<span class="eb-row-xp">' + (m.xp || 0) + ' XP</span>' +
            '</button>';
        }).join('')) +
        '</div></section></div>';

      // Event listeners
      var page = host.querySelector('.cw-encounter');
      if (!page) return;

      page.querySelector('#eb-size').addEventListener('change', function () {
        partySize = Math.max(1, Math.min(10, parseInt(this.value) || 4));
        draw();
      });
      page.querySelector('#eb-level').addEventListener('change', function () {
        partyLevel = Math.max(1, Math.min(20, parseInt(this.value) || 5));
        draw();
      });
      page.querySelector('#eb-type').addEventListener('change', function () {
        filterType = this.value;
        draw();
      });
      var crMinEl = page.querySelector('#eb-cr-min');
      var crMaxEl = page.querySelector('#eb-cr-max');
      if (crMinEl) crMinEl.addEventListener('change', function () { filterCrMin = this.value; draw(); });
      if (crMaxEl) crMaxEl.addEventListener('change', function () { filterCrMax = this.value; draw(); });

      page.addEventListener('click', function (e) {
        var pick = e.target.closest('[data-eb-pick]');
        if (pick) {
          var m = monsters.find(function (x) { return x.id === pick.dataset.ebPick; });
          if (m) addMonster(m);
          return;
        }
        var add = e.target.closest('[data-eb-add]');
        if (add) {
          var ma = monsters.find(function (x) { return x.id === add.dataset.ebAdd; });
          if (ma) addMonster(ma);
          return;
        }
        var rm = e.target.closest('[data-eb-remove]');
        if (rm) { removeMonster(rm.dataset.ebRemove); return; }

        if (e.target.closest('[data-eb="clear"]')) { built = []; draw(); return; }

        if (e.target.closest('[data-eb="to-combat"]')) { addToCombat(ctx); return; }

        if (e.target.closest('[data-eb="save-library"]')) {
          var name = prompt('Name this encounter:');
          if (name !== null) { saveToLibrary(name || undefined); UI().notice('Encounter saved to library.'); draw(); }
          return;
        }

        if (e.target.closest('[data-eb="save-adventure"]')) { saveToAdventure(ctx); return; }

        var loadLib = e.target.closest('[data-eb="load-lib"]');
        if (loadLib) { loadFromLibrary(parseInt(loadLib.dataset.i)); return; }

        var delLib = e.target.closest('[data-eb="del-lib"]');
        if (delLib) {
          var lib = getLibrary();
          lib.splice(parseInt(delLib.dataset.i), 1);
          saveLibrary(lib);
          draw();
          return;
        }
      });
    }

    async function addToCombat(ctx) {
      if (!built.length) return;
      var session = global.FogCombatSession;
      if (!session) {
        UI().notice('Combat module not loaded. Navigate to Combat first, then come back.', 'error');
        return;
      }
      var total = 0;
      for (var i = 0; i < built.length; i++) {
        var b = built[i];
        var res = await session.addMonsters(ctx, b.monster, b.count);
        if (!res.ok) { UI().notice(res.message, 'error'); return; }
        total += res.count;
      }
      UI().notice(total + ' creature(s) added to Combat.');
    }

    draw();
    return function () { alive = false; };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.encounterBuilder = { render: render };
})(window);
