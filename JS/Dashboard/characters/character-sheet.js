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

  function kv(label, value, note) {
    return '<div class="stat-box"><span class="stat-label">' + esc(label) + '</span><strong class="stat-value">' + esc(value) + '</strong>' +
      (note ? '<span class="stat-note">' + esc(note) + '</span>' : '') + '</div>';
  }

  function overviewPanel(doc, d) {
    var abilities = Api().rules().abilities;
    var html = '<div class="sheet-grid-abilities">' + abilities.map(function (ab) {
      var a = d.abilities[ab];
      return '<div class="ability-box" title="' + esc(a.breakdown.map(function (b) { return b.source + ' ' + (b.source === 'Base' ? b.value : '+' + b.value); }).join(', ')) + '">' +
        '<span class="ab-label">' + UI().abilityShort(ab) + '</span><span class="ab-score">' + a.score + '</span><span class="ab-mod">' + UI().signed(a.modifier) + '</span></div>';
    }).join('') + '</div>';

    html += '<div class="sheet-columns"><section><h3 class="sheet-section-title">Saving Throws</h3><ul class="sheet-list sheet-checklist">' +
      abilities.map(function (ab) {
        var s = d.savingThrows[ab];
        return '<li class="' + (s.proficient ? 'is-prof' : '') + '"><span class="prof-dot" aria-label="' + (s.proficient ? 'proficient' : 'not proficient') + '"></span>' +
          esc(UI().abilityName(ab)) + '<strong>' + UI().signed(s.modifier) + '</strong></li>';
      }).join('') + '</ul>' +
      '<h3 class="sheet-section-title">Senses</h3><ul class="sheet-list"><li>Passive Perception <strong>' + d.passivePerception + '</strong></li>' +
      (d.combat.darkvision ? '<li>Darkvision <strong>' + d.combat.darkvision + ' ft.</strong></li>' : '') + '</ul></section>' +
      '<section><h3 class="sheet-section-title">Skills</h3><ul class="sheet-list sheet-checklist">' +
      Object.values(d.skills).map(function (s) {
        return '<li class="' + (s.expertise ? 'is-expert' : s.proficient ? 'is-prof' : '') + '"><span class="prof-dot" aria-label="' + (s.expertise ? 'expertise' : s.proficient ? 'proficient' : 'not proficient') + '"></span>' +
          esc(s.name) + ' <span class="sheet-muted">(' + UI().abilityShort(s.ability) + ')</span><strong>' + UI().signed(s.modifier) + '</strong></li>';
      }).join('') + '</ul></section></div>';

    html += '<h3 class="sheet-section-title">Proficiencies</h3><ul class="sheet-list">' +
      '<li><strong>Armor</strong> ' + esc(d.proficiencies.armor.join(', ') || 'None') + '</li>' +
      '<li><strong>Weapons</strong> ' + esc(d.proficiencies.weapons.join('; ') || 'None') + '</li>' +
      '<li><strong>Tools</strong> ' + esc(d.proficiencies.tools.join(', ') || 'None') + '</li>' +
      '<li><strong>Languages</strong> ' + esc(d.proficiencies.languages.join(', ')) + '</li></ul>';
    return html;
  }

  function combatPanel(doc, d) {
    var st = doc.state || {};
    var cur = st.hpCurrent != null ? Math.min(st.hpCurrent, d.combat.hpMax) : d.combat.hpMax;
    var html = '<div class="stat-row">' +
      kv('Armor Class', d.combat.ac, d.combat.acBreakdown.join(', ')) +
      kv('Initiative', UI().signed(d.combat.initiative), d.combat.initiativeNote) +
      kv('Speed', d.combat.speed + ' ft.') +
      kv('Proficiency Bonus', UI().signed(d.proficiencyBonus)) +
      kv('Hit Dice', d.combat.hitDice || '—') +
      kv('Size', d.combat.size || '—') +
      '</div>';
    html += '<section class="hp-tracker"><h3 class="sheet-section-title">Hit Points</h3><div class="hp-fields">' +
      '<label>Current <input type="number" class="form-control-dark" min="0" max="' + d.combat.hpMax + '" value="' + cur + '" data-state="hpCurrent"></label>' +
      '<span class="hp-max">/ ' + d.combat.hpMax + ' max</span>' +
      '<label>Temporary <input type="number" class="form-control-dark" min="0" value="' + (st.hpTemp || 0) + '" data-state="hpTemp"></label></div>' +
      '<p class="sheet-muted">' + esc(d.combat.hpBreakdown.join(' · ')) + '</p></section>';
    if (d.attacks.length) {
      html += '<h3 class="sheet-section-title">Weapon Attacks</h3><div class="table-scroll"><table class="sheet-table"><thead><tr><th>Weapon</th><th>Attack</th><th>Damage</th><th>Mastery</th><th>Properties</th></tr></thead><tbody>' +
        d.attacks.map(function (a) {
          return '<tr><td>' + esc(a.name) + (a.proficient ? '' : ' <span class="sheet-muted">(not proficient)</span>') + '</td><td>' + UI().signed(a.attackBonus) + '</td><td>' + esc(a.damage) + '</td><td>' +
            (a.mastery ? esc(a.mastery) : '—') + '</td><td>' + esc(a.properties.join(', ') || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      if (d.critRange) html += '<p class="sheet-muted">Weapon attacks score a Critical Hit on ' + d.critRange + '–20.</p>';
    }
    if (d.sneakAttackDice) html += '<p><strong>Sneak Attack</strong> ' + esc(d.sneakAttackDice) + ' once per turn (see Features).</p>';
    if (d.spellcasting) {
      html += '<p><strong>Spell attack</strong> ' + UI().signed(d.spellcasting.attackBonus) + ' · <strong>Spell save DC</strong> ' + d.spellcasting.saveDC + '</p>';
    }
    return html;
  }

  function featuresPanel(d) {
    var groups = [
      ['Class & Subclass Features', d.features.filter(function (f) { return f.kind === 'class' || f.kind === 'subclass' || f.kind === 'choice'; }).sort(function (a, b) { return a.level - b.level; })],
      ['Species Traits', d.features.filter(function (f) { return f.kind === 'species'; })],
      ['Feats', d.features.filter(function (f) { return f.kind === 'feat'; })],
    ];
    return groups.map(function (g) {
      if (!g[1].length) return '';
      return '<h3 class="sheet-section-title">' + esc(g[0]) + '</h3><ul class="feature-list">' + g[1].map(function (f) {
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
      html += '<div class="stat-row">' + kv('Ability', UI().abilityName(sc.ability)) + kv('Save DC', sc.saveDC) + kv('Spell Attack', UI().signed(sc.attackBonus)) +
        kv('Prepared', sc.prepared.length + ' / ' + sc.spellsPrepared) + '</div>';
      html += '<div class="slot-row">' + sc.slots.map(function (n, i) {
        return n ? '<div class="slot-box"><span>Level ' + (i + 1) + '</span><strong>' + n + '</strong></div>' : '';
      }).join('') + '</div>';
      html += '<h3 class="sheet-section-title">Cantrips</h3><ul class="feature-list">' + sc.cantrips.map(function (id) { return spellRow(id); }).join('') + '</ul>';
      var always = sc.alwaysPrepared;
      html += '<h3 class="sheet-section-title">Prepared Spells</h3>' + groupedSpells(sc.prepared.concat(always.filter(function (id) { return sc.prepared.indexOf(id) < 0; })), function (id) {
        if (sc.spellMastery.indexOf(id) >= 0) return 'Spell Mastery';
        if (sc.signature.indexOf(id) >= 0) return 'Signature Spell';
        return always.indexOf(id) >= 0 ? 'Always prepared' : '';
      });
      if (sc.spellbook) html += '<h3 class="sheet-section-title">Spellbook</h3>' + groupedSpells(sc.spellbook);
    }
    if (d.otherSpells.length) {
      html += '<h3 class="sheet-section-title">Other Spells</h3><ul class="feature-list">' + d.otherSpells.map(function (o) {
        return spellRow(o.spellId, o.source + ' · ' + o.note + (o.ability ? ' · ' + UI().abilityShort(o.ability) + ', DC ' + o.saveDC + ', attack ' + UI().signed(o.attackBonus) : ''));
      }).join('') + '</ul>';
    }
    return html;
  }

  function inventoryPanel(d) {
    if (!d.inventory.length && !d.gold) return '<p class="sheet-muted">No starting equipment chosen.</p>';
    return '<ul class="sheet-list">' + d.inventory.map(function (i) {
      return '<li>' + (i.count > 1 ? '<strong>' + i.count + '×</strong> ' : '') + esc(i.name) + ' <span class="sheet-muted">' + esc(i.source) + '</span></li>';
    }).join('') + '</ul><p><strong>Gold</strong> ' + d.gold + ' GP</p>' +
      (d.weaponMasteries.length ? '<p><strong>Weapon Mastery</strong> ' + esc(d.weaponMasteries.map(function (id) { var w = Api().getWeapon(id); return w.name + ' (' + w.mastery + ')'; }).join(', ')) + '</p>' : '') +
      '<p class="sheet-muted">Equipment packs (such as a Dungeoneer’s Pack) are listed by name; their contents are in the SRD equipment chapter.</p>';
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
      root.querySelector('#sheet-hero').innerHTML = '<div><h1 class="page-title">Character not found</h1><p class="page-subtitle">This character doesn’t exist in this browser. It may have been deleted.</p></div>';
      return null;
    }
    if (doc.status !== 'complete') {
      global.FogDashboardRouter.navigateTo('#characters/new/' + doc.id, true);
      return null;
    }

    var d = doc.derived;
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    var sp = Api().getSpecies(c.speciesId);
    var bg = Api().getBackground(c.backgroundId);
    var saveTimer = null;

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
      '<span class="sheet-chip">Level ' + c.level + ' ' + esc(cls.name) + (c.subclassId ? ' (' + esc(cls.subclass.name) + ')' : '') + '</span>' +
      '<span class="sheet-chip">' + esc(sp.name) + '</span><span class="sheet-chip">' + esc(bg.name) + '</span>' +
      (doc.narrative.alignment ? '<span class="sheet-chip">' + esc(doc.narrative.alignment) + '</span>' : '') +
      '</div><div class="sheet-quick">' +
      '<span>HP <strong>' + d.combat.hpMax + '</strong></span><span>AC <strong>' + d.combat.ac + '</strong></span>' +
      '<span>Speed <strong>' + d.combat.speed + ' ft.</strong></span><span>Init. <strong>' + UI().signed(d.combat.initiative) + '</strong></span></div></div>' +
      '<div class="sheet-hero-actions">' +
      '<button type="button" class="btn btn-primary" data-fog-go="#characters/' + esc(doc.id) + '/edit">Edit character</button>' +
      '<button type="button" class="btn btn-outline-crimson btn-sm" data-sheet-delete>Delete</button></div>';

    var tabs = [
      ['overview', 'Overview', overviewPanel(doc, d)],
      ['combat', 'Combat', combatPanel(doc, d)],
      ['features', 'Features & Traits', featuresPanel(d)],
    ];
    if (d.spellcasting || d.otherSpells.length) tabs.push(['spells', 'Spells', spellsPanel(d)]);
    tabs.push(['inventory', 'Inventory', inventoryPanel(d)], ['story', 'Story', storyPanel(doc)]);

    var active = readTab();
    if (!tabs.some(function (t) { return t[0] === active; })) active = 'overview';
    root.querySelector('#sheet-tabs').innerHTML = tabs.map(function (t) {
      return '<button type="button" class="sheet-tab' + (t[0] === active ? ' is-active' : '') + '" role="tab" id="tab-' + t[0] + '" aria-controls="panel-' + t[0] + '" aria-selected="' + (t[0] === active) + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('');
    root.querySelector('#sheet-panels').innerHTML = tabs.map(function (t) {
      return '<section class="sheet-panel' + (t[0] === active ? ' is-active' : '') + '" role="tabpanel" id="panel-' + t[0] + '" aria-labelledby="tab-' + t[0] + '">' + t[2] + '</section>';
    }).join('') + '<footer class="sheet-attribution">' + UI().attributionHtml() + '</footer>';

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
      if (e.target.closest('[data-sheet-delete]') && confirm('Delete “' + doc.narrative.name + '” from this browser? This cannot be undone.')) {
        Store().remove(doc.id);
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
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.characterView = init;
})(window);
