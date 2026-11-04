/**
 * Shared rendering helpers for the character pages (home, creator, sheet)
 */
(function (global) {
  'use strict';

  var Api = function () {
    return global.FogRulesApi;
  };

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** SRD text uses light Markdown (**bold**, _italic_, "- " bullets). Escape first, then format. */
  function rulesText(text) {
    if (!text) return '';
    var blocks = escapeHtml(text).split(/\n{2,}|\n(?=[-•] )|\n/);
    var html = '';
    var inList = false;
    blocks.forEach(function (b) {
      var line = b.trim();
      if (!line || line.charAt(0) === '&' && /^&gt;\s*$/.test(line)) return;
      line = line.replace(/^&gt;\s?/, '');
      line = line
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>');
      if (/^[-•] /.test(line)) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += '<li>' + line.replace(/^[-•] /, '') + '</li>';
        return;
      }
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += '<p>' + line + '</p>';
    });
    if (inList) html += '</ul>';
    return html;
  }

  function signed(n) {
    if (n == null || isNaN(n)) return '—';
    return (n >= 0 ? '+' : '−') + Math.abs(n);
  }

  function abilityShort(ab) {
    return ab.toUpperCase();
  }

  function abilityName(ab) {
    return Api().rules().abilityNames[ab] || ab;
  }

  function ordinalLevel(spellLevel) {
    return spellLevel === 0 ? 'Cantrip' : 'Level ' + spellLevel;
  }

  function spellMeta(sp) {
    var tags = [];
    if (sp.concentration) tags.push('Concentration');
    if (sp.ritual) tags.push('Ritual');
    return (
      '<dl class="rules-meta">' +
      '<div><dt>Level</dt><dd>' + ordinalLevel(sp.level) + ' ' + escapeHtml(sp.school) + '</dd></div>' +
      '<div><dt>Casting Time</dt><dd>' + escapeHtml(sp.castingTime) + '</dd></div>' +
      '<div><dt>Range</dt><dd>' + escapeHtml(sp.range) + '</dd></div>' +
      '<div><dt>Components</dt><dd>' + escapeHtml(sp.components) + '</dd></div>' +
      '<div><dt>Duration</dt><dd>' + escapeHtml(sp.duration) + '</dd></div>' +
      (tags.length ? '<div><dt>Tags</dt><dd>' + tags.join(', ') + '</dd></div>' : '') +
      '</dl>'
    );
  }

  function spellDetail(id) {
    var sp = Api().getSpell(id);
    if (!sp) return '';
    return (
      '<h4>' + escapeHtml(sp.name) + '</h4>' +
      spellMeta(sp) +
      rulesText(sp.description) +
      (sp.higherLevels ? '<p><strong>' + (sp.level === 0 ? 'Cantrip Upgrade.' : 'Using a Higher-Level Spell Slot.') + '</strong> ' + escapeHtml(sp.higherLevels) + '</p>' : '')
    );
  }

  function featDetail(id) {
    var f = Api().getFeat(id);
    if (!f) return '';
    var cat = { origin: 'Origin Feat', general: 'General Feat', 'fighting-style': 'Fighting Style Feat', 'epic-boon': 'Epic Boon Feat' }[f.category];
    return (
      '<h4>' + escapeHtml(f.name) + '</h4>' +
      '<p class="rules-tag">' + cat + (f.prerequisite ? ' (Prerequisite: ' + escapeHtml(f.prerequisite) + ')' : '') + '</p>' +
      rulesText(f.description)
    );
  }

  function weaponSummary(w) {
    return escapeHtml(w.damage + ' ' + w.damageType + (w.properties.length ? ' · ' + w.properties.join(', ') : ''));
  }

  function masteryDetail(w) {
    var txt = Api().rules().masteryProperties[w.mastery] || '';
    return '<h4>' + escapeHtml(w.name) + ' — ' + escapeHtml(w.mastery) + '</h4>' +
      '<p class="rules-tag">' + weaponSummary(w) + '</p>' +
      '<p><strong>' + escapeHtml(w.mastery) + '.</strong> ' + escapeHtml(txt) + '</p>';
  }

  function portraitHtml(dataUrl, cls) {
    if (dataUrl && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      return '<img class="' + (cls || '') + '" src="' + dataUrl + '" alt="">';
    }
    return '<svg class="portrait-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  }

  function attributionHtml() {
    var m = Api().rules().meta;
    return '<p>' + escapeHtml(m.attribution) + '</p><p>' + escapeHtml(m.coverageNote) + '</p>';
  }

  global.FogCharacterUI = {
    escapeHtml: escapeHtml,
    rulesText: rulesText,
    signed: signed,
    abilityShort: abilityShort,
    abilityName: abilityName,
    ordinalLevel: ordinalLevel,
    spellDetail: spellDetail,
    spellMeta: spellMeta,
    featDetail: featDetail,
    weaponSummary: weaponSummary,
    masteryDetail: masteryDetail,
    portraitHtml: portraitHtml,
    attributionHtml: attributionHtml,
  };
})(window);
