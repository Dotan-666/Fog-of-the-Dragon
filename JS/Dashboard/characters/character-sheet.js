/**
 * Character sheet — #characters/<id>
 * Every number shown comes from FogDeriveCharacter (doc.derived); nothing is typed in by hand
 * except current/temporary Hit Points and the story fields.
 */
(function (global) {
  'use strict';

  var Api = function () { return global.FogRulesApi; };
  var Store = function () { return global.FogCharacterStore; };
  var UI = function () { return global.FogCharacterUI; };
  var esc = function (s) { return global.FogCharacterUI.escapeHtml(s); };

  var TAB_KEY = 'fog_sheet_tab';

  function readTab() {
    try { return global.sessionStorage.getItem(TAB_KEY); } catch (e) { return null; }
  }

  function writeTab(id) {
    try { global.sessionStorage.setItem(TAB_KEY, id); } catch (e) { /* preference only */ }
  }

  function tip(key, label) {
    return global.FogTips ? global.FogTips.button(key, label) : '';
  }

  function kv(label, value, note, tipKey) {
    return '<div class="stat-box"><span class="stat-label">' + esc(label) + (tipKey ? tip(tipKey, label) : '') + '</span><strong class="stat-value">' + esc(value) + '</strong>' +
      (note ? '<span class="stat-note">' + esc(note) + '</span>' : '') + '</div>';
  }

  function title(text, tipKey) {
    return '<h3 class="sheet-section-title">' + esc(text) + (tipKey ? tip(tipKey, text) : '') + '</h3>';
  }

  function overviewPanel(doc, d) {
    var abilities = Api().rules().abilities;
    var html = title('Ability Scores', 'abilityScores') + '<div class="sheet-grid-abilities">' + abilities.map(function (ab) {
      var a = d.abilities[ab];
      return '<div class="ability-box" title="' + esc(a.breakdown.map(function (b) { return b.source + ' ' + (b.source === 'Base' ? b.value : '+' + b.value); }).join(', ')) + '">' +
        '<span class="ab-label">' + UI().abilityShort(ab) + tip('ability:' + ab, UI().abilityName(ab)) + '</span><span class="ab-score">' + a.score + '</span><span class="ab-mod">' + UI().signed(a.modifier) + '</span></div>';
    }).join('') + '</div>' + '<p class="sheet-muted">The small number is the modifier you add to rolls.' + tip('abilityModifier', 'Ability modifier') + '</p>';

    html += '<div class="sheet-columns"><section>' + title('Saving Throws', 'savingThrows') + '<ul class="sheet-list sheet-checklist">' +
      abilities.map(function (ab) {
        var s = d.savingThrows[ab];
        return '<li class="' + (s.proficient ? 'is-prof' : '') + '"><span class="prof-dot" aria-label="' + (s.proficient ? 'proficient' : 'not proficient') + '"></span>' +
          esc(UI().abilityName(ab)) + '<strong>' + UI().signed(s.modifier) + '</strong></li>';
      }).join('') + '</ul>' +
      (d.savingThrowNotes.length ? '<p class="sheet-muted">' + esc(d.savingThrowNotes.join(' ')) + '</p>' : '') +
      title('Senses') + '<ul class="sheet-list"><li>Passive Perception' + tip('passivePerception', 'Passive Perception') + ' <strong>' + d.passivePerception + '</strong></li>' +
      (d.combat.darkvision ? '<li>Darkvision' + tip('darkvision', 'Darkvision') + ' <strong>' + d.combat.darkvision + ' ft.</strong></li>' : '') + '</ul></section>' +
      '<section>' + title('Skills', 'skills') + '<ul class="sheet-list sheet-checklist">' +
      Object.keys(d.skills).map(function (id) {
        var s = d.skills[id];
        return '<li class="' + (s.expertise ? 'is-expert' : s.proficient ? 'is-prof' : '') + '"><span class="prof-dot" aria-label="' + (s.expertise ? 'expertise' : s.proficient ? 'proficient' : 'not proficient') + '"></span>' +
          esc(s.name) + tip('skill:' + id, s.name) + ' <span class="sheet-muted">(' + UI().abilityShort(s.ability) + (s.jackOfAllTrades ? ', Jack of All Trades' : '') + ')</span><strong>' + UI().signed(s.modifier) + '</strong></li>';
      }).join('') + '</ul>' +
      (Object.values(d.skills).some(function (s) { return s.expertise; }) ? '<p class="sheet-muted">Filled marker: Expertise' + tip('expertise', 'Expertise') + '</p>' : '') +
      (Object.values(d.skills).some(function (s) { return s.jackOfAllTrades; }) ? '<p class="sheet-muted">Includes Jack of All Trades' + tip('jackOfAllTrades', 'Jack of All Trades') + '</p>' : '') +
      '</section></div>';

    html += title('Proficiencies', 'proficiencyBonus') + '<ul class="sheet-list">' +
      '<li><strong>Armor</strong>' + tip('armorTraining', 'Armor training') + ' ' + esc(d.proficiencies.armor.join(', ') || 'None') + '</li>' +
      '<li><strong>Weapons</strong>' + tip('weaponProficiency', 'Weapon proficiency') + ' ' + esc(d.proficiencies.weapons.join('; ') || 'None') + '</li>' +
      '<li><strong>Tools</strong>' + tip('tools', 'Tools') + ' ' + esc(d.proficiencies.tools.join(', ') || 'None') + '</li>' +
      '<li><strong>Languages</strong>' + tip('languages', 'Languages') + ' ' + esc(d.proficiencies.languages.join(', ')) + '</li></ul>';
    return html;
  }

  function combatPanel(doc, d) {
    var st = doc.state || {};
    var cur = st.hpCurrent != null ? Math.min(st.hpCurrent, d.combat.hpMax) : d.combat.hpMax;
    var ds = st.deathSaves || { successes: 0, failures: 0 };
    var html = '<div class="stat-row">' +
      kv('Armor Class', d.combat.ac, d.combat.acBreakdown.join(', '), 'armorClass') +
      kv('Initiative', UI().signed(d.combat.initiative), d.combat.initiativeNote, 'initiative') +
      kv('Speed', d.combat.speed + ' ft.', d.combat.speedBreakdown.length > 1 ? d.combat.speedBreakdown.join(', ') : null, 'speed') +
      kv('Proficiency Bonus', UI().signed(d.proficiencyBonus), null, 'proficiencyBonus') +
      kv('Hit Dice', d.combat.hitDice || '—', null, 'hitDice') +
      kv('Size', d.combat.size || '—', null, 'size') +
      '</div>';
    html += '<section class="hp-tracker">' + title('Hit Points', 'hitPoints') + '<div class="hp-fields">' +
      '<label>Current <input type="number" class="form-control-dark" min="0" max="' + d.combat.hpMax + '" value="' + cur + '" data-state="hpCurrent"></label>' +
      '<span class="hp-max">/ ' + d.combat.hpMax + ' max</span>' +
      '<label>Temporary <input type="number" class="form-control-dark" min="0" value="' + (st.hpTemp || 0) + '" data-state="hpTemp"></label>' + tip('temporaryHp', 'Temporary Hit Points') + '</div>' +
      '<p class="sheet-muted">' + esc(d.combat.hpBreakdown.join(' · ')) + '</p></section>';
    html += '<section>' + title('Death Saving Throws', 'deathSaves') + '<div class="death-saves">' +
      ['successes', 'failures'].map(function (kind) {
        var n = ds[kind] || 0;
        return '<fieldset><legend>' + (kind === 'successes' ? 'Successes' : 'Failures') + '</legend>' + [1, 2, 3].map(function (i) {
          return '<input type="checkbox" data-death="' + kind + '" data-n="' + i + '"' + (n >= i ? ' checked' : '') + ' aria-label="' + (kind === 'successes' ? 'Success ' : 'Failure ') + i + '">';
        }).join('') + '</fieldset>';
      }).join('') + '<button type="button" class="link-btn" data-death-reset>Reset</button></div>' +
      '<p class="sheet-muted">Roll a d20 at the start of each turn at 0 Hit Points: 10 or higher is a success. Three successes: Stable. Three failures: dead. Any healing ends them.</p></section>';

    if (d.classResources.length) {
      html += title('Class Resources', 'classResources') + '<div class="resource-row">' + d.classResources.map(function (r) {
        var key = { rages: 'rage', rageDamage: 'rage', sneakAttack: 'sneakAttack', martialArts: 'martialArts', focusPoints: 'focusPoints', sorceryPoints: 'sorceryPoints', channelDivinity: 'channelDivinity', wildShape: 'wildShape', secondWind: 'secondWind', favoredEnemy: 'favoredEnemy', bardicDie: 'bardicInspiration', bardicUses: 'bardicInspiration', layOnHands: 'layOnHands', aura: 'auraOfProtection', invocations: 'invocations', weaponMastery: 'weaponMastery', pact: 'pactMagic', unarmoredMovement: 'speed' }[r.key];
        return kv(r.label, r.value, null, key);
      }).join('') + '</div>';
    }
    if (d.attacks.length) {
      html += title('Attacks', 'attackBonus') + '<div class="table-scroll"><table class="sheet-table"><thead><tr><th>Weapon</th><th>Attack</th><th>Damage</th><th>Mastery' + tip('weaponMastery', 'Weapon Mastery') + '</th><th>Properties' + tip('weaponProperties', 'Weapon properties') + '</th></tr></thead><tbody>' +
        d.attacks.map(function (a) {
          return '<tr><td>' + esc(a.name) + tip(a.weaponId ? 'weapon:' + a.weaponId : 'unarmedStrike', a.name) + (a.proficient ? '' : ' <span class="sheet-muted">(not proficient)</span>') +
            (a.notes ? '<br><span class="sheet-muted">' + esc(a.notes) + '</span>' : '') + '</td><td>' + UI().signed(a.attackBonus) + '</td><td>' + esc(a.damage) + '</td><td>' +
            (a.mastery ? esc(a.mastery) + tip('mastery:' + a.mastery, a.mastery) : '—') + '</td><td>' + esc(a.properties.join(', ') || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      html += '<p class="sheet-muted">A 20 on the attack roll is a Critical Hit' + tip('criticalHit', 'Critical Hit') + (d.critRange ? '; your weapon attacks also crit on ' + d.critRange + '–20' : '') + '. Damage types' + tip('damageTypes', 'Damage types') + ' matter for Resistance.</p>';
    }
    if (d.sneakAttackDice) html += '<p><strong>Sneak Attack</strong>' + tip('sneakAttack', 'Sneak Attack') + ' ' + esc(d.sneakAttackDice) + ' once per turn (see Features).</p>';
    if (d.spellcasting) {
      html += '<p><strong>Spell attack</strong>' + tip('spellAttack', 'Spell attack') + ' ' + UI().signed(d.spellcasting.attackBonus) + ' · <strong>Spell save DC</strong>' + tip('saveDC', 'Spell save DC') + ' ' + d.spellcasting.saveDC + '</p>';
    }
    html += '<p class="sheet-muted">On your turn: move, take one action, and a Bonus Action if something gives you one.' + tip('actions', 'Actions on your turn') + '</p>';
    return html;
  }

  function featuresPanel(d) {
    var groups = [
      ['Class & Subclass Features', 'features', d.features.filter(function (f) { return f.kind === 'class' || f.kind === 'subclass' || f.kind === 'choice'; }).sort(function (a, b) { return a.level - b.level; })],
      ['Eldritch Invocations', 'invocations', d.invocations.map(function (i) { return { name: i.name, source: i.prerequisite || 'No prerequisite', description: i.description }; })],
      ['Metamagic', 'metamagic', d.metamagic.map(function (m) { return { name: m.name, source: m.cost, description: m.description }; })],
      ['Species Traits', 'traits', d.features.filter(function (f) { return f.kind === 'species'; })],
      ['Feats', 'feats', d.features.filter(function (f) { return f.kind === 'feat'; })],
    ];
    return groups.map(function (g) {
      if (!g[2].length) return '';
      return title(g[0], g[1]) + '<ul class="feature-list">' + g[2].map(function (f) {
        return '<li><details><summary>' + esc(f.name) + ' <span class="sheet-muted">' + esc(f.source) + '</span></summary>' + UI().rulesText(f.description) + '</details></li>';
      }).join('') + '</ul>';
    }).join('');
  }

  function spellRow(id, tag) {
    var sp = Api().getSpell(id);
    if (!sp) return '';
    return '<li><details><summary>' + esc(sp.name) + ' <span class="sheet-muted">' + esc(sp.school + (sp.concentration ? ' · Concentration' : '') + (sp.ritual ? ' · Ritual' : '') + (tag ? ' · ' + tag : '')) + '</span></summary>' +
      UI().spellMeta(sp) + UI().rulesText(sp.description) + (sp.higherLevels ? '<p><em>' + esc(sp.higherLevels) + '</em></p>' : '') + '</details></li>';
  }

  function groupedSpells(ids, tagFor) {
    var byLevel = {};
    ids.forEach(function (id) {
      var sp = Api().getSpell(id);
      if (sp) (byLevel[sp.level] = byLevel[sp.level] || []).push(id);
    });
    return Object.keys(byLevel).sort(function (a, b) { return a - b; }).map(function (l) {
      return '<h4 class="sheet-subtitle">' + UI().ordinalLevel(Number(l)) + '</h4><ul class="feature-list">' +
        byLevel[l].map(function (id) { return spellRow(id, tagFor ? tagFor(id) : ''); }).join('') + '</ul>';
    }).join('');
  }

  function spellsPanel(d) {
    var html = '';
    var sc = d.spellcasting;
    if (sc) {
      html += '<div class="stat-row">' + kv('Ability', UI().abilityName(sc.ability), null, 'spellcastingAbility') + kv('Save DC', sc.saveDC, null, 'saveDC') + kv('Spell Attack', UI().signed(sc.attackBonus), null, 'spellAttack') +
        kv('Prepared', sc.prepared.length + ' / ' + sc.spellsPrepared, null, 'preparedSpells') + '</div>';
      html += title(sc.pact ? 'Pact Magic slots' : 'Spell slots', sc.pact ? 'pactMagic' : 'spellSlots') + '<div class="slot-row">' + sc.slots.map(function (n, i) {
        return n ? '<div class="slot-box"><span>Level ' + (i + 1) + '</span><strong>' + n + '</strong></div>' : '';
      }).join('') + '</div>' +
        (sc.pact ? '<p class="sheet-muted">All Pact Magic slots are level ' + sc.pact.level + ' and come back on a Short or Long Rest.</p>' : '') +
        '<p class="sheet-muted">Tags: Concentration' + tip('concentration', 'Concentration') + ' · Ritual' + tip('ritual', 'Ritual') + ' · open a spell for its components' + tip('components', 'Components') + ', range' + tip('range', 'Range') + ' and duration' + tip('duration', 'Duration') + '.</p>';
      if (sc.cantrips.length) html += title('Cantrips', 'cantrips') + '<ul class="feature-list">' + sc.cantrips.map(function (id) { return spellRow(id); }).join('') + '</ul>';
      var always = sc.alwaysPrepared;
      html += title('Prepared Spells', 'preparedSpells') + groupedSpells(sc.prepared.concat(always.filter(function (id) { return sc.prepared.indexOf(id) < 0; })), function (id) {
        if (sc.spellMastery.indexOf(id) >= 0) return 'Spell Mastery';
        if (sc.signature.indexOf(id) >= 0) return 'Signature Spell';
        return always.indexOf(id) >= 0 ? 'Always prepared' : '';
      });
      if (sc.arcanum && sc.arcanum.length) {
        html += title('Mystic Arcanum', 'mysticArcanum') + '<ul class="feature-list">' + sc.arcanum.map(function (a) { return spellRow(a.spellId, 'Once per Long Rest without a slot'); }).join('') + '</ul>';
      }
      if (sc.spellbook) html += title('Spellbook', 'spellbook') + groupedSpells(sc.spellbook);
    }
    if (d.otherSpells.length) {
      html += title('Other Spells') + '<ul class="feature-list">' + d.otherSpells.map(function (o) {
        return spellRow(o.spellId, o.source + ' · ' + o.note + (o.ability ? ' · ' + UI().abilityShort(o.ability) + ', DC ' + o.saveDC + ', attack ' + UI().signed(o.attackBonus) : ''));
      }).join('') + '</ul>';
    }
    return html;
  }

  function inventoryPanel(d) {
    if (!d.inventory.length && !d.gold) return '<p class="sheet-muted">No starting equipment chosen.</p>';
    return title('Equipment', 'startingEquipment') + '<ul class="sheet-list">' + d.inventory.map(function (i) {
      var key = i.weaponId ? 'weapon:' + i.weaponId : i.armorId ? 'armor:' + i.armorId : null;
      return '<li>' + (i.count > 1 ? '<strong>' + i.count + '×</strong> ' : '') + esc(i.name) + (key ? tip(key, i.name) : '') + ' <span class="sheet-muted">' + esc(i.source) + '</span>' +
        (i.contents ? '<br><span class="sheet-muted">Contains: ' + esc(i.contents.join(', ')) + '</span>' : '') + '</li>';
    }).join('') + '</ul><p><strong>Gold</strong> ' + d.gold + ' GP</p>' +
      (d.weaponMasteries.length ? '<p><strong>Weapon Mastery</strong>' + tip('weaponMastery', 'Weapon Mastery') + ' ' + esc(d.weaponMasteries.map(function (id) { var w = Api().getWeapon(id); return w.name + ' (' + w.mastery + ')'; }).join(', ')) + '</p>' : '');
  }

  function storyPanel(doc) {
    var n = doc.narrative;
    var field = function (key, label, rows) {
      return '<label class="form-label" for="story-' + key + '">' + esc(label) + '</label><textarea id="story-' + key + '" class="form-control-dark" rows="' + rows + '" data-narr="' + key + '">' + esc(n[key]) + '</textarea>';
    };
    return '<form class="sheet-edit-form" onsubmit="return false">' +
      '<p class="sheet-muted">Changes here are saved automatically.</p>' +
      '<p><strong>Alignment</strong> ' + esc(n.alignment || 'Not chosen') + '</p>' +
      field('appearance', 'Appearance', 3) + field('personalityTraits', 'Personality traits', 2) + field('ideals', 'Ideals', 2) +
      field('bonds', 'Bonds', 2) + field('flaws', 'Flaws', 2) + field('backstory', 'Backstory', 6) + field('notes', 'Notes', 4) +
      '<p class="sheet-muted save-status" aria-live="polite"></p></form>';
  }

  function init(container, params) {
    var root = container.querySelector('#character-sheet-root');
    var doc = Store().get(params.id);
    if (!doc) {
      root.querySelector('#sheet-hero').innerHTML = '<div><h1 class="page-title">Character not found</h1><p class="page-subtitle">This character doesn\'t exist in this browser. It may have been deleted.</p></div>';
      return null;
    }
    if (doc.status !== 'complete') {
      global.FogDashboardRouter.navigateTo('#characters/new/' + doc.id, true);
      return null;
    }

    // Always recompute from the saved choices so numbers and the guide follow the current rules engine.
    var d = doc.derived = global.FogDeriveCharacter(doc);
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    var sp = Api().getSpecies(c.speciesId);
    var bg = global.FogCharacterOptions.backgroundOf(doc);
    var sub = global.FogCharacterOptions.subclassAvailable(doc) ? global.FogCharacterOptions.currentSubclass(doc) : null;
    var saveTimer = null;
    var tipsOff = global.FogTips ? global.FogTips.attach(root) : function () {};
    var aiOff = function () {};

    var limits = root.querySelector('#sheet-limitations');
    var notes = [];
    if (doc.editDraft) {
      notes.push('<p>You have unsaved edits to this character. <button type="button" class="link-btn" data-fog-go="#characters/' + esc(doc.id) + '/edit">Continue editing</button></p>');
    }
    if (d.limitations.length) {
      notes.push('<p><strong>About these numbers</strong></p><ul>' + d.limitations.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>');
    }
    limits.innerHTML = notes.join('');
    limits.hidden = notes.length === 0;

    root.querySelector('#sheet-hero').innerHTML =
      '<div class="sheet-portrait">' + UI().portraitHtml(doc.narrative.portraitDataUrl) + '</div>' +
      '<div class="sheet-identity"><h1>' + esc(doc.narrative.name) + '</h1>' +
      '<div class="sheet-chips">' +
      '<span class="sheet-chip">Level ' + c.level + ' ' + esc(cls.name) + (sub ? ' (' + esc(sub.name) + ')' : '') + tip('class:' + cls.id, cls.name) + '</span>' +
      '<span class="sheet-chip">' + esc(sp.name) + tip('species:' + sp.id, sp.name) + '</span><span class="sheet-chip">' + esc(bg.name) + tip('background:' + bg.id, bg.name) + '</span>' +
      (doc.narrative.alignment ? '<span class="sheet-chip">' + esc(doc.narrative.alignment) + '</span>' : '') +
      '</div><div class="sheet-quick">' +
      '<span>HP <strong>' + d.combat.hpMax + '</strong></span><span>AC <strong>' + d.combat.ac + '</strong></span>' +
      '<span>Speed <strong>' + d.combat.speed + ' ft.</strong></span><span>Init. <strong>' + UI().signed(d.combat.initiative) + '</strong></span></div></div>' +
      '<div class="sheet-hero-actions">' +
      (c.level < 20
        ? '<button type="button" class="btn btn-primary sheet-levelup-btn" data-fog-go="#characters/' + esc(doc.id) + '/levelup"' + (doc.editDraft ? ' disabled title="Save or discard your unsaved edits first"' : '') + '>Level up to ' + (c.level + 1) + '</button>'
        : '<span class="sheet-chip">Maximum level</span>') +
      '<button type="button" class="btn btn-secondary" data-fog-go="#characters/' + esc(doc.id) + '/edit">Edit character</button>' +
      '<button type="button" class="btn btn-secondary" data-sheet-pdf>Export PDF</button>' +
      '<button type="button" class="btn btn-outline-crimson btn-sm" data-sheet-delete>Delete</button>' +
      '<p class="sheet-pdf-status sheet-muted" role="status" hidden></p></div>';

    var tabs = [
      ['overview', 'Overview', overviewPanel(doc, d)],
      ['combat', 'Combat', combatPanel(doc, d)],
      ['features', 'Features & Traits', featuresPanel(d)],
    ];
    if (d.spellcasting || d.otherSpells.length) tabs.push(['spells', 'Spells', spellsPanel(d)]);
    tabs.push(['inventory', 'Inventory', inventoryPanel(d)], ['story', 'Story', storyPanel(doc)]);
    var guideView = global.FogGuideView ? global.FogGuideView.render(doc, d) : null;
    if (guideView) tabs.push(['guide', 'Character Guide', guideView.html]);

    var active = readTab();
    if (!tabs.some(function (t) { return t[0] === active; })) active = 'overview';
    root.querySelector('#sheet-tabs').innerHTML = tabs.map(function (t) {
      return '<button type="button" class="sheet-tab' + (t[0] === active ? ' is-active' : '') + '" role="tab" id="tab-' + t[0] + '" aria-controls="panel-' + t[0] + '" aria-selected="' + (t[0] === active) + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('');
    root.querySelector('#sheet-panels').innerHTML = tabs.map(function (t) {
      return '<section class="sheet-panel' + (t[0] === active ? ' is-active' : '') + '" role="tabpanel" id="panel-' + t[0] + '" aria-labelledby="tab-' + t[0] + '">' + t[2] + '</section>';
    }).join('') + '<footer class="sheet-attribution">' + UI().attributionHtml() + '</footer>';
    if (guideView) aiOff = global.FogGuideView.bindAi(root.querySelector('#panel-guide'), doc, d, guideView.guide);

    function selectTab(id) {
      root.querySelectorAll('.sheet-tab').forEach(function (b) {
        var on = b.getAttribute('data-tab') === id;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });
      root.querySelectorAll('.sheet-panel').forEach(function (p) { p.classList.toggle('is-active', p.id === 'panel-' + id); });
      writeTab(id);
    }

    function saveNow() {
      var res = Store().save(doc);
      var status = root.querySelector('.save-status');
      if (status) status.textContent = res.ok ? 'Saved.' : res.message;
    }

    root.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-tab]');
      if (tab) {
        selectTab(tab.getAttribute('data-tab'));
        return;
      }
      var go = e.target.closest('[data-fog-go]');
      if (go) {
        global.FogDashboardRouter.navigateTo(go.getAttribute('data-fog-go'));
        return;
      }
      if (e.target.closest('[data-death-reset]')) {
        doc.state = doc.state || {};
        doc.state.deathSaves = { successes: 0, failures: 0 };
        root.querySelectorAll('[data-death]').forEach(function (cb) { cb.checked = false; });
        saveNow();
        return;
      }
      var pdfBtn = e.target.closest('[data-sheet-pdf]');
      if (pdfBtn && global.FogCharacterPdf) {
        var status = root.querySelector('.sheet-pdf-status');
        pdfBtn.disabled = true;
        pdfBtn.textContent = 'Creating PDF…';
        status.hidden = true;
        global.FogCharacterPdf.exportPdf(doc).then(function (r) {
          pdfBtn.disabled = false;
          pdfBtn.textContent = 'Export PDF';
          status.textContent = r.ok ? 'Downloaded ' + r.fileName + '.' : r.message;
          status.hidden = false;
        });
        return;
      }
      if (e.target.closest('[data-sheet-delete]') && confirm('Delete "' + doc.narrative.name + '" from this browser? This cannot be undone.')) {
        Store().remove(doc.id);
        if (global.FogCharacterRegistry) global.FogCharacterRegistry.release(doc.id); // the slot is free again
        global.FogDashboardRouter.navigateTo('#characters');
      }
    });

    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-narr')) {
        doc.narrative[t.getAttribute('data-narr')] = t.value;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, 500);
      }
    });

    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-death')) {
        var kind = t.getAttribute('data-death');
        var n = Number(t.getAttribute('data-n'));
        doc.state = doc.state || {};
        var ds = doc.state.deathSaves = doc.state.deathSaves || { successes: 0, failures: 0 };
        ds[kind] = t.checked ? n : n - 1;
        root.querySelectorAll('[data-death="' + kind + '"]').forEach(function (cb) { cb.checked = Number(cb.getAttribute('data-n')) <= ds[kind]; });
        saveNow();
        return;
      }
      if (!t.hasAttribute('data-state')) return;
      var n = parseInt(t.value, 10);
      if (isNaN(n) || n < 0) n = 0;
      if (t.getAttribute('data-state') === 'hpCurrent') n = Math.min(n, d.combat.hpMax);
      t.value = n;
      doc.state = doc.state || {};
      doc.state[t.getAttribute('data-state')] = n;
      saveNow();
    });

    return function cleanup() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveNow();
      }
      aiOff();
      tipsOff();
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.characterView = init;
})(window);
