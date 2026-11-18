/**
 * Renders stat blocks, spells and other rules entries as HTML. Shared by Monsters & Spells and the Homebrew editor's
 * live preview, so an entry looks the same everywhere. Every value is escaped; descriptions support the SRD's
 * **bold** / _italic_ markup only.
 *
 * FogCompendiumRender.monster(m) / spell(s)          SRD-shaped entries (see compendium-store.js)
 * FogCompendiumRender.homebrew(entry)                any homebrew entry (FogHomebrewModel shape)
 */
(function (global) {
  'use strict';

  var ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var ORIGIN_LABEL = { 'official-srd': 'Official Rules', 'fod-original': 'Fog of the Dragon original', homebrew: 'Homebrew' };
  var HOMEBREW_SET = { origin: 'homebrew', name: 'Your homebrew', edition: '2024 rules format' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  /** SRD markdown-lite → HTML (escaped first; **bold**, _italic_, paragraphs and line breaks). */
  function rich(text) {
    return String(text || '').split(/\n{2,}/).map(function (p) {
      var h = esc(p.trim())
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(>])_([^_]+)_(?=[\s.,;:)!?<]|$)/g, '$1<em>$2</em>')
        .replace(/\n/g, '<br>');
      return h ? '<p>' + h + '</p>' : '';
    }).join('');
  }
  function className(id) {
    var c = global.FogRules && global.FogRules.classes && global.FogRules.classes[id];
    return c ? c.name : id.charAt(0).toUpperCase() + id.slice(1);
  }

  function sourceLine(e) {
    var d = e.dataset || HOMEBREW_SET;
    return '<p class="cmp-entry-source"><span class="cmp-badge">' + esc(ORIGIN_LABEL[d.origin] || d.origin) + '</span> ' + esc(d.name || d.source || '') +
      ' · ' + esc(d.edition) + (d.license ? ' · ' + (d.licenseUrl ? '<a href="' + esc(d.licenseUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(d.license) + '</a>' : esc(d.license)) : '') +
      (e.hbId ? ' · <a href="#grimoire/' + esc(e.hbId) + '" data-fog-nav="#grimoire/' + esc(e.hbId) + '">Edit in Homebrew</a>' : '') + '</p>';
  }

  function monsterBody(m) {
    var line = function (label, val) { return val ? '<p class="cmp-line"><strong>' + esc(label) + '</strong> ' + esc(val) + '</p>' : ''; };
    var section = function (title, list, intro) {
      if (!list.length && !intro) return '';
      return '<h3 class="cmp-section">' + esc(title) + '</h3>' + (intro ? '<div class="cmp-intro">' + rich(intro) + '</div>' : '') +
        list.map(function (x) { return '<div class="cmp-entry"><div class="cmp-entry-text">' + rich('**_' + x.name + '._** ' + x.text) + '</div></div>'; }).join('');
    };
    return '<div class="cmp-stats">' +
      '<div><span>Armor Class</span><strong>' + esc(m.ac) + '</strong></div>' +
      (m.initiative ? '<div><span>Initiative</span><strong>' + esc(m.initiative) + '</strong></div>' : '') +
      '<div><span>Hit Points</span><strong>' + esc(m.hp) + '</strong></div>' +
      '<div class="cmp-stat-wide"><span>Speed</span><strong>' + esc(m.speed) + '</strong></div></div>' +
      '<table class="cmp-abilities"><thead><tr><th></th>' + ABILS.map(function (a) { return '<th>' + a.toUpperCase() + '</th>'; }).join('') + '</tr></thead><tbody>' +
      '<tr><th>Score</th>' + ABILS.map(function (a) { return '<td>' + esc(m.abilities[a] ? m.abilities[a].score : '—') + '</td>'; }).join('') + '</tr>' +
      '<tr><th>Mod</th>' + ABILS.map(function (a) { return '<td>' + esc(m.abilities[a] ? m.abilities[a].mod : '—') + '</td>'; }).join('') + '</tr>' +
      '<tr><th>Save</th>' + ABILS.map(function (a) { return '<td>' + esc(m.abilities[a] && m.abilities[a].save ? m.abilities[a].save : '—') + '</td>'; }).join('') + '</tr></tbody></table>' +
      '<div class="cmp-lines">' +
      line('Skills', m.skills) + line('Vulnerabilities', m.vulnerabilities) + line('Resistances', m.resistances) +
      line('Immunities', m.immunities) + line('Gear', m.gear) + line('Senses', m.senses) + line('Languages', m.languages) +
      line('Challenge Rating', m.cr + (m.crDetails ? ' (' + m.crDetails + ')' : '')) + '</div>' +
      section('Traits', m.traits) + section('Actions', m.actions) + section('Bonus Actions', m.bonusActions) +
      section('Reactions', m.reactions) + section('Legendary Actions', m.legendaryActions, m.legendaryIntro);
  }

  function monster(m) {
    var portrait = m.imageUrl ? '<figure class="cmp-portrait"><img src="' + esc(m.imageUrl) + '" alt="' + esc(m.name) + '" loading="lazy" data-lightbox="' + esc(m.name) + '" style="cursor:zoom-in"></figure>' : '';
    return '<header class="cmp-head"><h2>' + esc(m.name) + '</h2>' +
      '<p class="cmp-sub">' + esc(m.size + ' ' + m.type + (m.typeTags ? ' (' + m.typeTags + ')' : '') + (m.alignment ? ', ' + m.alignment : '')) + '</p></header>' +
      portrait +
      monsterBody(m) +
      (m.description ? '<h3 class="cmp-section">Description</h3><div class="cmp-desc">' + rich(m.description) + '</div>' : '') +
      (m.dataNotes && m.dataNotes.length ? '<p class="cmp-note">Data note: ' + esc(m.dataNotes.join(' ')) + '</p>' : '') +
      (m.complete ? '' : '<p class="cmp-note">Some parts of this stat block could not be read from the source and are not shown.</p>') +
      sourceLine(m);
  }

  function spell(s) {
    var tags = [s.concentration ? 'Concentration' : null, s.ritual ? 'Ritual' : null].filter(Boolean);
    return '<header class="cmp-head"><h2>' + esc(s.name) + '</h2>' +
      '<p class="cmp-sub">' + esc(s.level === 0 ? s.school + ' Cantrip' : 'Level ' + s.level + ' ' + s.school) + (tags.length ? ' · ' + tags.map(function (t) { return '<span class="cmp-badge">' + esc(t) + '</span>'; }).join(' ') : '') + '</p></header>' +
      '<div class="cmp-stats">' +
      '<div><span>Casting Time</span><strong>' + esc(s.castingTime) + '</strong></div>' +
      '<div><span>Range</span><strong>' + esc(s.range) + '</strong></div>' +
      '<div class="cmp-stat-wide"><span>Components</span><strong>' + esc(s.components || '—') + '</strong></div>' +
      '<div class="cmp-stat-wide"><span>Duration</span><strong>' + esc(s.duration) + '</strong></div></div>' +
      '<p class="cmp-line"><strong>Classes</strong> ' + esc((s.classes || []).length ? s.classes.map(className).join(', ') : '—') + '</p>' +
      '<div class="cmp-desc">' + (s.description ? rich(s.description) : '<p class="cmp-note">No description yet.</p>') + '</div>' +
      (s.higherLevels ? '<div class="cmp-higher"><strong>' + (s.level === 0 ? 'Cantrip Upgrade.' : 'Using a Higher-Level Spell Slot.') + '</strong> ' + esc(s.higherLevels) + '</div>' : '') +
      (s.complete ? '' : '<p class="cmp-note">Some fields of this spell could not be read from the source.</p>') +
      sourceLine(s);
  }

  // ---------------------------------------------------------------------------
  // Homebrew-only kinds
  // ---------------------------------------------------------------------------
  function head(name, sub) {
    return '<header class="cmp-head"><h2>' + esc(name || 'Unnamed') + '</h2>' + (sub ? '<p class="cmp-sub">' + esc(sub) + '</p>' : '') + '</header>';
  }
  function desc(text, empty) {
    return '<div class="cmp-desc">' + (String(text || '').trim() ? rich(text) : '<p class="cmp-note">' + esc(empty || 'No description yet.') + '</p>') + '</div>';
  }

  function npc(e, M) {
    var d = e.data;
    var line = function (label, val) { return val ? '<p class="cmp-line"><strong>' + esc(label) + '</strong> ' + esc(val) + '</p>' : ''; };
    var m = d.hasStats ? M.toMonster(e) : null;
    return head(e.name, d.role || 'NPC') +
      '<div class="cmp-lines">' + line('Appearance', d.appearance) + line('Wants', d.motivation) + line('Voice & mannerisms', d.voice) + '</div>' +
      (d.personality ? '<h3 class="cmp-section">Personality</h3>' + desc(d.personality) : '') +
      (d.description ? '<h3 class="cmp-section">Background</h3>' + desc(d.description) : '') +
      (d.secrets ? '<h3 class="cmp-section">Secrets (DM only)</h3><div class="cmp-higher">' + rich(d.secrets) + '</div>' : '') +
      (m ? '<h3 class="cmp-section">Stat block</h3><p class="cmp-sub">' + esc(m.size + ' ' + m.type + (m.typeTags ? ' (' + m.typeTags + ')' : '') + (m.alignment ? ', ' + m.alignment : '')) + '</p>' + monsterBody(m)
        : '<p class="cmp-note">No combat stats. Tick "Give this NPC a stat block" to add them.</p>') +
      sourceLine({ hbId: null });
  }

  function magicItem(e, M) {
    var d = e.data;
    return head(e.name, M.itemLine(d)) +
      (d.charges ? '<div class="cmp-stats"><div><span>Charges</span><strong>' + esc(d.charges) + '</strong></div>' +
        (d.recharge ? '<div class="cmp-stat-wide"><span>Regains</span><strong>' + esc(d.recharge) + '</strong></div>' : '') + '</div>' : '') +
      desc(d.description) +
      (d.curse ? '<div class="cmp-higher"><strong>Curse.</strong> ' + esc(d.curse) + '</div>' : '') +
      sourceLine({ hbId: null });
  }

  function feat(e, M) {
    var d = e.data;
    return head(e.name, M.featLine(d)) +
      (d.abilityIncrease ? '<p class="cmp-line"><strong>Ability Score Increase.</strong> ' + esc(d.abilityIncrease) + '</p>' : '') +
      desc(d.description, 'Describe what the feat gives.') +
      sourceLine({ hbId: null });
  }

  function other(e) {
    return head(e.name, e.data.category) + desc(e.data.description) + sourceLine({ hbId: null });
  }

  function race(e, M) {
    var d = e.data;
    var r = M.toRace(e);
    return head(e.name, M.raceLine(d)) +
      '<div class="cmp-stats">' +
      '<div><span>Size</span><strong>' + esc(r.size) + '</strong></div>' +
      '<div><span>Speed</span><strong>' + r.speed + ' ft.</strong></div>' +
      (r.darkvision ? '<div><span>Darkvision</span><strong>' + r.darkvision + ' ft.</strong></div>' : '') +
      '</div>' +
      (r.abilityIncreases ? '<p class="cmp-line"><strong>Ability Score Increases.</strong> ' + esc(r.abilityIncreases) + '</p>' : '') +
      '<p class="cmp-line"><strong>Languages.</strong> ' + esc(r.languages.join(', ')) + '</p>' +
      (r.traits.length && r.traits[0].name ? '<h3 class="cmp-section">Traits</h3>' + r.traits.filter(function (t) { return t.name; }).map(function (t) {
        return '<p class="cmp-line"><strong>' + esc(t.name) + '.</strong> ' + (t.text ? rich(t.text) : '<em>No description.</em>') + '</p>';
      }).join('') : '') +
      desc(d.description, 'Add lore and flavor text.') +
      sourceLine({ hbId: null });
  }

  function cls(e, M) {
    var d = e.data;
    var c = M.toClass(e);
    return head(e.name, M.classLine(d)) +
      '<div class="cmp-stats">' +
      '<div><span>Hit Die</span><strong>d' + c.hitDie + '</strong></div>' +
      (c.savingThrows.length ? '<div class="cmp-stat-wide"><span>Saving Throws</span><strong>' + esc(c.savingThrows.map(function (a) { return M.ABIL_NAME[a]; }).join(', ')) + '</strong></div>' : '') +
      (c.skillChoices ? '<div class="cmp-stat-wide"><span>Skills</span><strong>Choose ' + c.skillChoices + (c.skillList.length ? ' from ' + esc(c.skillList.join(', ')) : '') + '</strong></div>' : '') +
      '</div>' +
      (c.proficiencies ? '<p class="cmp-line"><strong>Proficiencies.</strong> ' + esc(c.proficiencies) + '</p>' : '') +
      (c.equipment ? '<p class="cmp-line"><strong>Starting Equipment.</strong> ' + esc(c.equipment) + '</p>' : '') +
      (c.castingAbility ? '<p class="cmp-line"><strong>Spellcasting.</strong> ' + esc(c.castingAbility) + (c.castingType ? ' (' + c.castingType + ')' : '') + '</p>' : '') +
      '<p class="cmp-line"><strong>' + esc(c.subclassName) + '.</strong> Gained at level ' + c.subclassLevel + '.</p>' +
      (c.features.length && c.features[0].name ? '<h3 class="cmp-section">Features</h3>' + c.features.filter(function (f) { return f.name; }).sort(function (a, b) { return a.level - b.level; }).map(function (f) {
        return '<p class="cmp-line"><strong>' + esc(f.name) + ' (Level ' + f.level + ').</strong> ' + (f.text ? rich(f.text) : '<em>No description.</em>') + '</p>';
      }).join('') : '') +
      desc(d.description, 'Add lore and flavor text.') +
      sourceLine({ hbId: null });
  }

  /** opts.imageUrl: the entry's own picture (a signed URL), shown under the title. */
  function homebrew(entry, opts) {
    var M = global.FogHomebrewModel;
    var e = M.normalize(entry);
    var html;
    if (e.kind === 'monster') html = monster(Object.assign(M.toMonster(e), { hbId: null }));
    else if (e.kind === 'spell') html = spell(Object.assign(M.toSpell(e), { hbId: null }));
    else if (e.kind === 'npc') html = npc(e, M);
    else if (e.kind === 'magic-item') html = magicItem(e, M);
    else if (e.kind === 'feat') html = feat(e, M);
    else if (e.kind === 'race') html = race(e, M);
    else if (e.kind === 'class') html = cls(e, M);
    else html = other(e);
    var url = opts && opts.imageUrl;
    if (url && /^(https:|data:image\/|blob:)/.test(url)) {
      html = html.replace('</header>', '</header><figure class="cmp-portrait"><img src="' + esc(url) + '" alt="' + esc(e.name || 'Picture') + '" data-lightbox="' + esc(e.name || '') + '" style="cursor:zoom-in"></figure>');
    }
    return html;
  }

  global.FogCompendiumRender = { esc: esc, rich: rich, className: className, monster: monster, spell: spell, homebrew: homebrew, ORIGIN_LABEL: ORIGIN_LABEL };
})(typeof window !== 'undefined' ? window : globalThis);
