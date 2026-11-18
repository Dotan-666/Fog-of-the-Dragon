/**
 * Character importer: import characters from JSON files (FOD native, D&D Beyond export,
 * Foundry VTT actor) or structured Markdown. Opens a modal with file picker, format
 * detection, preview and validation.
 */
(function (global) {
  'use strict';

  var Store = function () { return global.FogCharacterStore; };
  var Options = function () { return global.FogCharacterOptions; };
  var Registry = function () { return global.FogCharacterRegistry; };
  var UI = function () { return global.FogCharacterUI; };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function uid() {
    return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(Number(n)) || lo)); }

  // ---------------------------------------------------------------------------
  // Format detection and parsing
  // ---------------------------------------------------------------------------

  function detectFormat(text, fileName) {
    text = text.trim();
    if (text.charAt(0) === '{' || text.charAt(0) === '[') {
      try {
        var obj = JSON.parse(text);
        if (obj.schemaVersion && obj.choices) return { format: 'fod', data: obj };
        if (obj.data && obj.data.name && (obj.data.race || obj.data.classes)) return { format: 'beyond', data: obj };
        if (obj.type === 'character' && obj.system) return { format: 'foundry', data: obj };
        if (obj.name && (obj.classId || obj.speciesId || obj.choices)) return { format: 'fod', data: obj };
        return { format: 'json-unknown', data: obj };
      } catch (e) {
        return { format: 'error', error: 'Invalid JSON: ' + e.message };
      }
    }
    if (text.charAt(0) === '#' || /^---\n/.test(text)) return { format: 'markdown', data: text };
    return { format: 'unknown', error: 'Unrecognized file format. Supported: JSON (FOD, D&D Beyond, Foundry VTT) or Markdown.' };
  }

  function parseFod(obj) {
    if (obj.schemaVersion === 2 && obj.choices) return { ok: true, character: obj, warnings: [] };
    var warnings = [];
    if (obj.schemaVersion && obj.schemaVersion !== 2) warnings.push('Schema version ' + obj.schemaVersion + ' will be migrated.');
    return { ok: true, character: obj, warnings: warnings };
  }

  function parseBeyond(obj) {
    var d = obj.data || obj;
    var warnings = [];
    var draft = Store().createDraft();
    draft.narrative.name = d.name || 'Imported Character';
    if (d.race && d.race.fullName) warnings.push('Species: ' + d.race.fullName + ' (choose manually in the creator).');
    if (d.classes && d.classes.length) {
      var cls = d.classes[0];
      warnings.push('Class: ' + (cls.definition ? cls.definition.name : 'unknown') + ' level ' + (cls.level || 1) + ' (choose manually).');
      draft.choices.level = clamp(d.classes.reduce(function (s, c) { return s + (c.level || 0); }, 0), 1, 20);
    }
    var stats = d.stats || d.abilities;
    if (Array.isArray(stats) && stats.length >= 6) {
      var order = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      stats.forEach(function (s, i) {
        if (i < 6 && s && s.value) draft.choices.abilityScoresBase[order[i]] = clamp(s.value, 1, 30);
      });
      draft.choices.abilityMethod = 'manual';
    }
    draft.narrative.alignment = d.alignmentId != null ? ['', 'Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'][d.alignmentId] || '' : '';
    if (d.traits) {
      if (d.traits.personalityTraits) draft.narrative.personalityTraits = d.traits.personalityTraits;
      if (d.traits.ideals) draft.narrative.ideals = d.traits.ideals;
      if (d.traits.bonds) draft.narrative.bonds = d.traits.bonds;
      if (d.traits.flaws) draft.narrative.flaws = d.traits.flaws;
      if (d.traits.appearance) draft.narrative.appearance = d.traits.appearance;
      if (d.traits.backstory) draft.narrative.backstory = d.traits.backstory;
    }
    warnings.push('Class, species, background and spells must be chosen manually in the character creator.');
    return { ok: true, character: draft, warnings: warnings };
  }

  function parseFoundry(obj) {
    var s = obj.system || {};
    var warnings = [];
    var draft = Store().createDraft();
    draft.narrative.name = obj.name || 'Imported Character';
    if (s.details) {
      if (s.details.alignment) draft.narrative.alignment = s.details.alignment;
      if (s.details.appearance) draft.narrative.appearance = s.details.appearance;
      if (s.details.biography && s.details.biography.value) {
        draft.narrative.backstory = s.details.biography.value.replace(/<[^>]+>/g, '').trim();
      }
      if (s.details.race) warnings.push('Species: ' + s.details.race + ' (choose manually).');
    }
    if (s.abilities) {
      var map = { str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };
      Object.keys(map).forEach(function (k) {
        if (s.abilities[k] && s.abilities[k].value) draft.choices.abilityScoresBase[map[k]] = clamp(s.abilities[k].value, 1, 30);
      });
      draft.choices.abilityMethod = 'manual';
    }
    if (s.details && s.details.level) draft.choices.level = clamp(s.details.level, 1, 20);
    warnings.push('Class, species, background and spells must be chosen manually in the character creator.');
    return { ok: true, character: draft, warnings: warnings };
  }

  function parseMarkdown(text) {
    var warnings = [];
    var draft = Store().createDraft();
    var nameMatch = text.match(/^#\s+(.+)/m);
    if (nameMatch) draft.narrative.name = nameMatch[1].trim();
    else draft.narrative.name = 'Imported Character';
    var sections = { backstory: '', appearance: '', personality: '', ideals: '', bonds: '', flaws: '' };
    var current = null;
    text.split('\n').forEach(function (line) {
      var heading = line.match(/^##\s+(.+)/);
      if (heading) {
        var h = heading[1].trim().toLowerCase();
        if (h.indexOf('backstory') >= 0 || h.indexOf('background') >= 0) current = 'backstory';
        else if (h.indexOf('appearance') >= 0) current = 'appearance';
        else if (h.indexOf('personality') >= 0) current = 'personality';
        else if (h.indexOf('ideal') >= 0) current = 'ideals';
        else if (h.indexOf('bond') >= 0) current = 'bonds';
        else if (h.indexOf('flaw') >= 0) current = 'flaws';
        else current = null;
        return;
      }
      if (current && line.trim()) sections[current] += (sections[current] ? '\n' : '') + line;
    });
    if (sections.backstory) draft.narrative.backstory = sections.backstory;
    if (sections.appearance) draft.narrative.appearance = sections.appearance;
    if (sections.personality) draft.narrative.personalityTraits = sections.personality;
    if (sections.ideals) draft.narrative.ideals = sections.ideals;
    if (sections.bonds) draft.narrative.bonds = sections.bonds;
    if (sections.flaws) draft.narrative.flaws = sections.flaws;
    var levelMatch = text.match(/level\s*:?\s*(\d+)/i);
    if (levelMatch) draft.choices.level = clamp(levelMatch[1], 1, 20);
    warnings.push('Narrative fields imported. Class, species, background, abilities and spells must be chosen in the creator.');
    return { ok: true, character: draft, warnings: warnings };
  }

  function parseFile(text, fileName) {
    var detected = detectFormat(text, fileName);
    if (detected.error) return { ok: false, error: detected.error };
    if (detected.format === 'fod') return parseFod(detected.data);
    if (detected.format === 'beyond') return parseBeyond(detected.data);
    if (detected.format === 'foundry') return parseFoundry(detected.data);
    if (detected.format === 'markdown') return parseMarkdown(detected.data);
    if (detected.format === 'json-unknown') {
      var obj = detected.data;
      if (obj.name) {
        var draft = Store().createDraft();
        draft.narrative.name = obj.name;
        if (obj.level) draft.choices.level = clamp(obj.level, 1, 20);
        return { ok: true, character: draft, warnings: ['Generic JSON detected. Only the name and level were imported. Use the creator to set up the full character.'] };
      }
    }
    return { ok: false, error: detected.error || 'Could not parse this file.' };
  }

  // ---------------------------------------------------------------------------
  // Modal UI
  // ---------------------------------------------------------------------------

  function openModal(onImported) {
    var overlay = document.createElement('div');
    overlay.className = 'fog-modal-overlay';
    overlay.innerHTML =
      '<div class="fog-modal import-modal">' +
      '<header class="fog-modal-header"><h2>Import Character</h2><button type="button" class="fog-modal-close" aria-label="Close">&times;</button></header>' +
      '<div class="fog-modal-body">' +
      '<p>Upload a character file to import it. Supported formats:</p>' +
      '<ul class="import-formats"><li><strong>Fog of the Dragon</strong> JSON export</li><li><strong>D&amp;D Beyond</strong> JSON export</li><li><strong>Foundry VTT</strong> actor JSON</li><li><strong>Markdown</strong> with headings for Backstory, Appearance, etc.</li></ul>' +
      '<div class="import-drop" id="import-drop">' +
      '<input type="file" id="import-file" accept=".json,.md,.txt,.markdown" hidden>' +
      '<p>Drop a file here or <button type="button" class="link-btn" id="import-browse">browse</button></p>' +
      '</div>' +
      '<div id="import-result" hidden></div>' +
      '</div>' +
      '<footer class="fog-modal-footer">' +
      '<button type="button" class="btn btn-secondary" id="import-cancel">Cancel</button>' +
      '<button type="button" class="btn btn-primary" id="import-confirm" disabled>Import Character</button>' +
      '</footer></div>';

    document.body.appendChild(overlay);
    var parsed = null;

    function close() { overlay.remove(); }
    overlay.querySelector('.fog-modal-close').addEventListener('click', close);
    overlay.querySelector('#import-cancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    function showResult(result) {
      var el = overlay.querySelector('#import-result');
      el.hidden = false;
      if (!result.ok) {
        el.innerHTML = '<div class="import-error"><strong>Error:</strong> ' + esc(result.error) + '</div>';
        overlay.querySelector('#import-confirm').disabled = true;
        parsed = null;
        return;
      }
      parsed = result.character;
      var name = (parsed.narrative && parsed.narrative.name) || 'Unnamed';
      var level = (parsed.choices && parsed.choices.level) || 1;
      var html = '<div class="import-preview"><h3>' + esc(name) + '</h3><p>Level ' + level + '</p>';
      if (result.warnings && result.warnings.length) {
        html += '<ul class="import-warnings">' + result.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
      }
      html += '</div>';
      el.innerHTML = html;
      overlay.querySelector('#import-confirm').disabled = false;
    }

    function handleFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { showResult(parseFile(reader.result, file.name)); };
      reader.onerror = function () { showResult({ ok: false, error: 'Could not read the file.' }); };
      reader.readAsText(file);
    }

    overlay.querySelector('#import-browse').addEventListener('click', function () {
      overlay.querySelector('#import-file').click();
    });
    overlay.querySelector('#import-file').addEventListener('change', function (e) {
      handleFile(e.target.files[0]);
    });

    var drop = overlay.querySelector('#import-drop');
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-dragover'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-dragover'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      drop.classList.remove('is-dragover');
      handleFile(e.dataTransfer.files[0]);
    });

    overlay.querySelector('#import-confirm').addEventListener('click', async function () {
      if (!parsed) return;
      parsed.id = uid();
      parsed.status = 'draft';
      parsed.meta = parsed.meta || {};
      parsed.meta.updatedAt = new Date().toISOString();
      if (!parsed.meta.createdAt) parsed.meta.createdAt = parsed.meta.updatedAt;
      if (Registry()) {
        var slot = await Registry().claim(parsed.id);
        if (!slot.ok) {
          showResult({ ok: false, error: slot.message || 'Character limit reached. Delete a character or upgrade your plan.' });
          return;
        }
      }
      var res = Store().save(parsed);
      if (!res.ok) {
        showResult({ ok: false, error: res.message || 'Could not save the character.' });
        return;
      }
      close();
      if (onImported) onImported(parsed);
    });
  }

  global.FogCharacterImport = { open: openModal, parseFile: parseFile };
})(typeof window !== 'undefined' ? window : globalThis);
