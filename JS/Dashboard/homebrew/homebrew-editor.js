/**
 * Homebrew editor (#grimoire/<id>): a form for the entry's kind and a live preview drawn by FogCompendiumRender
 * (the same renderer Monsters & Spells uses).
 *
 * Stat blocks: you enter scores, Hit Dice, proficiencies, Challenge Rating and the parts of each attack or saving
 * throw; modifiers, saves, skills, initiative, hit points, Passive Perception, proficiency bonus, XP, attack bonuses,
 * save DCs and average damage are calculated (FogHomebrewModel).
 *
 * Saving: changes autosave about a second after you stop typing (or right away with Ctrl/Cmd+S or "Save now").
 * The status says "saved" only after the database confirmed the write; a stale tab gets a conflict, not an overwrite.
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogHomebrewModel; };
  var R = function () { return global.FogCompendiumRender; };
  var Store = function () { return global.FogHomebrewStore; };
  var AUTOSAVE_MS = 1200;
  var MARKUP_HINT = 'Use **bold** and _italic_; a blank line starts a new paragraph.';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function clock(d) { return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
  function idFor(path) { return 'hb-f-' + path.replace(/[^\w]/g, '-'); }
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setPath(obj, path, val) {
    var keys = path.split('.');
    var last = keys.pop();
    var o = keys.reduce(function (acc, k) { return acc[k]; }, obj);
    o[last] = val;
  }

  function init(container, params) {
    var root = container.querySelector('#homebrew-editor-root');
    var $ = function (s) { return root.querySelector(s); };
    var form = $('#hb-form');
    var id = params && params.id;

    var entry = null;
    var alive = true;
    var dirty = false;
    var saving = false;
    var againAfterSave = false;
    var saveTimer = null;
    var previewTimer = null;
    var lastSaved = null;
    var saveError = null;
    var conflict = false;
    var pictureUrl = null; // signed URL of entry.data.image
    var uploadingPicture = false;
    var pendingDeletes = []; // replaced or removed pictures, deleted after the next confirmed save

    // -------------------------------------------------------------------------
    // Field builders (every field is bound by data-path; values are always escaped)
    // -------------------------------------------------------------------------
    function wrap(label, inner, opts) {
      opts = opts || {};
      return '<div class="hb-field' + (opts.wide ? ' hb-field-wide' : '') + (opts.cls ? ' ' + opts.cls : '') + '">' +
        (label ? '<label class="hb-label" for="' + esc(opts.forId || '') + '">' + esc(label) + (opts.optional ? ' <em>(optional)</em>' : '') + '</label>' : '') +
        inner + (opts.help ? '<p class="hb-help">' + esc(opts.help) + '</p>' : '') + (opts.hint ? '<p class="hb-hint" data-hint="' + esc(opts.hint) + '"></p>' : '') + '</div>';
    }
    function attrs(path, type, extra) {
      return ' id="' + idFor(path) + '" data-path="' + esc(path) + '"' + (type ? ' data-type="' + type + '"' : '') + (extra || '');
    }
    function fText(path, label, opts) {
      opts = opts || {};
      var v = getPath(entry, path);
      return wrap(label, '<input type="text" class="form-control-dark"' + attrs(path, '', opts.list ? ' list="' + opts.list + '"' : '') + ' value="' + esc(v == null ? '' : v) + '" maxlength="' + (opts.max || 200) + '"' + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') + (opts.required ? ' required' : '') + '>',
        Object.assign({ forId: idFor(path) }, opts));
    }
    function fArea(path, label, opts) {
      opts = opts || {};
      var v = getPath(entry, path);
      return wrap(label, '<textarea class="form-control-dark hb-text" rows="' + (opts.rows || 4) + '"' + attrs(path) + ' maxlength="' + (opts.max || 8000) + '"' + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') + '>' + esc(v == null ? '' : v) + '</textarea>',
        Object.assign({ forId: idFor(path), wide: true }, opts));
    }
    function fNum(path, label, min, max, opts) {
      opts = opts || {};
      var v = getPath(entry, path);
      return wrap(label, '<input type="number" inputmode="numeric" class="form-control-dark hb-num"' + attrs(path, opts.nullable ? 'intnull' : 'int') + ' min="' + min + '" max="' + max + '" value="' + esc(v == null ? '' : v) + '"' + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') + '>',
        Object.assign({ forId: idFor(path) }, opts));
    }
    function fSelect(path, label, options, opts) {
      opts = opts || {};
      var v = String(getPath(entry, path));
      return wrap(label, '<select class="form-control-dark"' + attrs(path, opts.type || '', opts.rerender ? ' data-rerender' : '') + '>' +
        options.map(function (o) { var val = Array.isArray(o) ? o[0] : o; var lab = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(val) + '"' + (String(val) === v ? ' selected' : '') + '>' + esc(lab) + '</option>'; }).join('') + '</select>',
        Object.assign({ forId: idFor(path) }, opts));
    }
    function fCheck(path, label, opts) {
      opts = opts || {};
      return '<label class="hb-check' + (opts.wide ? ' hb-field-wide' : '') + '"><input type="checkbox"' + attrs(path, 'bool', opts.rerender ? ' data-rerender' : '') + (getPath(entry, path) ? ' checked' : '') + '> <span>' + esc(label) + '</span></label>';
    }
    function card(title, body, opts) {
      opts = opts || {};
      return '<fieldset class="hb-card"' + (opts.id ? ' id="' + opts.id + '"' : '') + '><legend class="hb-card-title">' + esc(title) + '</legend>' +
        (opts.intro ? '<p class="hb-help hb-card-intro">' + esc(opts.intro) + '</p>' : '') + '<div class="hb-fields">' + body + '</div></fieldset>';
    }
    function datalist(id, values) {
      return '<datalist id="' + id + '">' + values.map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join('') + '</datalist>';
    }
    function abilOptions() { return M().ABILS.map(function (a) { return [a, M().ABIL_NAME[a]]; }); }
    function dieOptions() { return M().DIE_SIZES.map(function (d) { return [String(d), 'd' + d]; }); }

    // -------------------------------------------------------------------------
    // Forms per kind
    // -------------------------------------------------------------------------
    function pictureBlock() {
      var has = !!(entry.data.image && entry.data.image.path);
      return '<div class="hb-picture hb-field-wide" data-hb-drop>' +
        '<div class="hb-picture-frame' + (uploadingPicture ? ' is-busy' : '') + '">' +
        (has && pictureUrl ? '<img src="' + esc(pictureUrl) + '" alt="Picture of ' + esc(entry.name) + '">'
          : '<img class="is-art" src="' + esc(M().artUrl(entry.kind)) + '" alt="">') +
        (uploadingPicture ? '<span class="hb-picture-spinner" aria-hidden="true"></span>' : '') + '</div>' +
        '<div class="hb-picture-actions"><span class="hb-label">Picture <em>(optional)</em></span>' +
        '<p class="hb-help">A portrait, token art or illustration of your own. It replaces the medallion on the card and appears in the preview. Choose a file, or drop or paste an image here. Resized to 1600 px in your browser; private to you.</p>' +
        '<div class="hb-picture-buttons"><label class="btn btn-secondary btn-sm hb-file-btn">' + (has ? 'Replace picture' : 'Choose picture') +
        '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-hb-file hidden></label>' +
        (has ? '<button type="button" class="btn btn-outline-crimson btn-sm" data-hb-act="remove-picture">Remove</button>' : '') + '</div>' +
        '<p class="hb-picture-error" id="hb-picture-error" role="alert" hidden></p></div></div>';
    }
    function refreshPicture() {
      var el = form.querySelector('.hb-picture');
      if (el) el.outerHTML = pictureBlock();
    }
    function pictureError(msg) {
      var el = form.querySelector('#hb-picture-error');
      if (!el) return;
      el.textContent = msg || '';
      el.hidden = !msg;
    }
    async function loadPictureUrl() {
      var p = entry.data.image && entry.data.image.path;
      if (!p || !global.FogContentImages) { pictureUrl = null; return; }
      var res = await global.FogContentImages.urls([p]);
      pictureUrl = (res.urls && res.urls[p]) || null;
      if (!pictureUrl && res.message) pictureError(res.message);
    }
    async function uploadPicture(file) {
      if (!entry || conflict || uploadingPicture) return;
      if (!global.FogContentImages) { pictureError('Pictures can\'t be added on this page.'); return; }
      if (!file || !file.type || file.type.indexOf('image/') !== 0) { pictureError('That isn\'t an image file.'); return; }
      uploadingPicture = true;
      refreshPicture();
      var res = await global.FogContentImages.upload('homebrew', entry.id, file);
      uploadingPicture = false;
      if (!alive) return;
      if (!res.ok) {
        refreshPicture();
        pictureError(res.message);
        return;
      }
      if (entry.data.image && entry.data.image.path) pendingDeletes.push(entry.data.image.path);
      entry.data.image = { path: res.path };
      await loadPictureUrl();
      if (!alive) return;
      refreshPicture();
      changed();
    }
    function flushDeletes() {
      if (!pendingDeletes.length || !global.FogContentImages) return;
      var keep = entry.data.image && entry.data.image.path;
      var gone = pendingDeletes.filter(function (p) { return p !== keep; });
      pendingDeletes = [];
      if (gone.length) global.FogContentImages.remove(gone);
    }

    function basics(extra) {
      return card('Basics', pictureBlock() + fText('name', 'Name', { max: 100, required: true }) +
        fText('summary', 'Library note', { max: 300, optional: true, placeholder: 'A short note shown on the card, e.g. "Boss of chapter 2"' }) + (extra || ''));
    }

    function statBlockForm() {
      var d = entry.data;
      var abil = M().ABILS.map(function (a) {
        var p = 'data.abilities.' + a;
        return '<div class="hb-abil"><label class="hb-abil-name" for="' + idFor(p) + '">' + a.toUpperCase() + '</label>' +
          '<input type="number" inputmode="numeric" class="form-control-dark hb-num"' + attrs(p, 'int') + ' min="1" max="30" value="' + esc(d.abilities[a]) + '">' +
          '<span class="hb-abil-mod" data-hint="mod-' + a + '"></span>' +
          '<label class="hb-abil-save"><input type="checkbox" data-save="' + a + '"' + (d.saves.indexOf(a) >= 0 ? ' checked' : '') + '> Save <span data-hint="save-' + a + '"></span></label></div>';
      }).join('');
      var skills = Object.keys(M().SKILLS).map(function (k) {
        var S = M().SKILLS[k];
        var v = d.skills[k] || 0;
        return '<label class="hb-skill"><span>' + esc(S[0]) + ' <em>' + S[1].toUpperCase() + '</em></span>' +
          '<select class="form-control-dark" data-skill="' + k + '" aria-label="' + esc(S[0]) + ' proficiency">' +
          [['0', '—'], ['1', 'Proficient'], ['2', 'Expertise']].map(function (o) { return '<option value="' + o[0] + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
          '</select><span class="hb-skill-bonus" data-hint="skill-' + k + '"></span></label>';
      }).join('');
      return card('Creature', fSelect('data.size', 'Size', M().SIZES, { rerender: false }) +
          fText('data.type', 'Creature type', { list: 'hb-types', max: 40 }) +
          fText('data.typeTags', 'Type tags', { optional: true, max: 60, placeholder: 'e.g. Goblinoid, Wizard' }) +
          fText('data.alignment', 'Alignment', { list: 'hb-aligns', max: 40 }) +
          fSelect('data.cr', 'Challenge Rating', M().CR_LIST.map(function (c) { return [c, 'CR ' + c]; }), { hint: 'cr' })) +
        card('Defense & movement', fNum('data.ac', 'Armor Class', 1, 30) +
          fText('data.acNote', 'Armor note', { optional: true, max: 60, placeholder: 'e.g. Leather Armor, Shield' }) +
          fNum('data.hitDice', 'Number of Hit Dice', 1, 99, { hint: 'hp' }) +
          fNum('data.hpOverride', 'Hit Points override', 1, 999, { nullable: true, optional: true, placeholder: 'Auto', help: 'Leave empty to use the Hit Dice average. Fill in only for a fixed number.' }) +
          fText('data.speed', 'Speed', { max: 120, placeholder: '30 ft., Fly 60 ft.' }) +
          fSelect('data.initiativeProf', 'Initiative', [['0', 'Dexterity modifier'], ['1', 'Proficient (+PB)'], ['2', 'Expertise (+2×PB)']], { type: 'int', hint: 'init' })) +
        card('Ability scores & saving throws', '<div class="hb-abils hb-field-wide">' + abil + '</div>', { intro: 'Tick "Save" for saving throws the creature is proficient in; its proficiency bonus is added.' }) +
        card('Skills', '<div class="hb-skills hb-field-wide">' + skills + '</div>', { intro: 'Proficient adds the proficiency bonus, Expertise adds it twice.' }) +
        card('Senses, languages & defenses',
          fText('data.senses', 'Senses', { optional: true, placeholder: 'e.g. Darkvision 60 ft.', hint: 'pp' }) +
          fText('data.languages', 'Languages', { optional: true, placeholder: 'e.g. Common, Draconic' }) +
          fText('data.vulnerabilities', 'Vulnerabilities', { optional: true, placeholder: 'e.g. Radiant' }) +
          fText('data.resistances', 'Resistances', { optional: true, placeholder: 'e.g. Cold, Necrotic' }) +
          fText('data.immunities', 'Immunities', { optional: true, placeholder: 'e.g. Poison; Exhaustion, Poisoned', help: 'Damage types, then a semicolon, then conditions.' }) +
          fText('data.gear', 'Gear', { optional: true, placeholder: 'e.g. Longsword, Shield' })) +
        M().ACTION_LISTS.map(function (l) { return itemList(l); }).join('');
    }

    function itemList(l) {
      var list = entry.data[l.key];
      var hints = { traits: 'Passive abilities, e.g. Pack Tactics or Legendary Resistance.', actions: 'Multiattack, weapon attacks, breath weapons, spellcasting…', bonusActions: 'Things it can do as a Bonus Action.', reactions: 'Triggered responses, e.g. Parry.', legendaryActions: 'Actions it can take after other creatures\' turns.' };
      var body = (l.key === 'legendaryActions' ? fNum('data.legendaryUses', 'Legendary Action uses per round', 1, 9) : '') +
        '<ol class="hb-items hb-field-wide">' + list.map(function (it, i) { return itemForm(l.key, it, i, list.length); }).join('') + '</ol>' +
        '<div class="hb-add-row hb-field-wide"><span class="hb-help">Add:</span>' +
        '<button type="button" class="hb-add" data-hb-act="add-item" data-list="' + l.key + '" data-mode="text">Description</button>' +
        (l.key === 'traits' ? '' : '<button type="button" class="hb-add" data-hb-act="add-item" data-list="' + l.key + '" data-mode="attack">Attack</button>' +
          '<button type="button" class="hb-add" data-hb-act="add-item" data-list="' + l.key + '" data-mode="save">Saving throw</button>') + '</div>';
      return card(l.label + ' (' + list.length + ')', body, { intro: hints[l.key], id: 'hb-list-' + l.key });
    }

    function itemForm(listKey, it, i, n) {
      var p = 'data.' + listKey + '.' + i + '.';
      var modes = Object.keys(M().ITEM_MODES).filter(function (m) { return listKey !== 'traits' || m === 'text' || m === it.mode; });
      var head = '<div class="hb-item-head">' +
        '<input type="text" class="form-control-dark hb-item-name"' + attrs(p + 'name') + ' value="' + esc(it.name) + '" maxlength="80" placeholder="Name, e.g. ' + (it.mode === 'attack' ? 'Claw' : it.mode === 'save' ? 'Fire Breath (Recharge 5–6)' : 'Multiattack') + '" aria-label="Name">' +
        '<select class="form-control-dark hb-item-mode"' + attrs(p + 'mode', '', ' data-rerender') + ' aria-label="Kind of entry">' + modes.map(function (m) { return '<option value="' + m + '"' + (m === it.mode ? ' selected' : '') + '>' + esc(M().ITEM_MODES[m]) + '</option>'; }).join('') + '</select>' +
        '<span class="hb-item-tools">' +
        '<button type="button" class="hb-icon-btn" data-hb-act="move-item" data-list="' + listKey + '" data-i="' + i + '" data-dir="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up" title="Move up">↑</button>' +
        '<button type="button" class="hb-icon-btn" data-hb-act="move-item" data-list="' + listKey + '" data-i="' + i + '" data-dir="1"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="Move down" title="Move down">↓</button>' +
        '<button type="button" class="hb-icon-btn" data-hb-act="remove-item" data-list="' + listKey + '" data-i="' + i + '" aria-label="Remove" title="Remove">✕</button></span></div>';
      var body = '';
      if (it.mode === 'text') {
        body = fArea(p + 'text', 'Rules text', { rows: 3, max: 4000, placeholder: 'e.g. The creature makes two Claw attacks.', help: MARKUP_HINT });
      } else if (it.mode === 'attack') {
        body = fSelect(p + 'attackType', 'Attack', Object.keys(M().ATTACK_TYPES).map(function (k) { return [k, M().ATTACK_TYPES[k]]; }), { rerender: true }) +
          fSelect(p + 'ability', 'Uses', abilOptions()) +
          (it.attackType !== 'ranged' ? fNum(p + 'reach', 'Reach (ft.)', 5, 60) : '') +
          (it.attackType !== 'melee' ? fText(p + 'range', 'Range (ft.)', { max: 40, placeholder: '80/320' }) : '') +
          diceFields(p, 'Damage', 'dice', 'die', 'damageType') +
          diceFields(p, 'Extra damage', 'extraDice', 'extraDie', 'extraType', true) +
          fNum(p + 'bonus', 'Magic bonus', -5, 10, { help: 'Added to the attack roll and damage, e.g. +1 weapon.' }) +
          fCheck(p + 'addMod', 'Add the ability modifier to damage') +
          fText(p + 'text', 'On a hit, also', { optional: true, wide: true, max: 4000, placeholder: 'e.g. If the target is a creature, it has the Prone condition.' });
      } else {
        body = fSelect(p + 'save', 'Saving throw', abilOptions()) +
          fSelect(p + 'dcAbility', 'DC based on', abilOptions(), { help: 'DC = 8 + proficiency bonus + this modifier.' }) +
          fText(p + 'targets', 'Who must save', { wide: true, max: 200, placeholder: 'each creature in a 15-foot Cone' }) +
          diceFields(p, 'Damage on a failure', 'dice', 'die', 'damageType', true) +
          fText(p + 'failure', 'Also on a failure', { optional: true, wide: true, max: 1000, placeholder: 'e.g. The target has the Frightened condition until the end of its next turn.' }) +
          fText(p + 'success', 'On a success', { optional: true, wide: true, max: 400, placeholder: 'Half damage.' }) +
          fArea(p + 'text', 'Notes after the effect', { optional: true, rows: 2, max: 4000 });
      }
      return '<li class="hb-item hb-item-' + it.mode + '">' + head + '<div class="hb-fields">' + body +
        (it.mode !== 'text' ? '<p class="hb-item-preview hb-field-wide" data-hint="item-' + listKey + '-' + i + '"></p>' : '') + '</div></li>';
    }

    function diceFields(p, label, countKey, dieKey, typeKey, optional) {
      var types = (optional && typeKey === 'extraType' ? [['', '— none —']] : []).concat(M().DAMAGE_TYPES.map(function (t) { return [t, t]; }));
      return '<div class="hb-field hb-field-wide"><span class="hb-label">' + esc(label) + (optional ? ' <em>(optional)</em>' : '') + '</span><div class="hb-dice">' +
        '<input type="number" inputmode="numeric" class="form-control-dark hb-num"' + attrs(p + countKey, 'int') + ' min="0" max="40" value="' + esc(getPath(entry, p + countKey)) + '" aria-label="' + esc(label) + ': number of dice">' +
        '<select class="form-control-dark"' + attrs(p + dieKey, 'int') + ' aria-label="' + esc(label) + ': die">' + dieOptions().map(function (o) { return '<option value="' + o[0] + '"' + (String(getPath(entry, p + dieKey)) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
        '<select class="form-control-dark"' + attrs(p + typeKey) + ' aria-label="' + esc(label) + ': damage type">' + types.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (getPath(entry, p + typeKey) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
        '</div>' + (optional && countKey !== 'extraDice' ? '<p class="hb-help">Set the number of dice to 0 for no damage.</p>' : '') + '</div>';
    }

    function npcForm() {
      var d = entry.data;
      return basics(fText('data.role', 'Role', { max: 200, placeholder: 'e.g. Innkeeper, cult leader, rival' })) +
        card('Personality', fText('data.appearance', 'Appearance', { optional: true, wide: true, placeholder: 'What the players notice first' }) +
          fText('data.motivation', 'Wants', { optional: true, placeholder: 'What drives them' }) +
          fText('data.voice', 'Voice & mannerisms', { optional: true, placeholder: 'How to play them at the table' }) +
          fArea('data.personality', 'Personality', { optional: true, rows: 3, max: 2000 }) +
          fArea('data.description', 'Background', { optional: true, rows: 4, help: MARKUP_HINT }) +
          fArea('data.secrets', 'Secrets (only for you)', { optional: true, rows: 3, max: 4000, cls: 'hb-dm' })) +
        card('Combat', fCheck('data.hasStats', 'Give this NPC a stat block', { rerender: true, wide: true }), { intro: 'Not every NPC needs one. Add it when the NPC may fight.' }) +
        (d.hasStats ? statBlockForm() : '');
    }

    function spellForm() {
      var d = entry.data;
      return basics() +
        card('Spell', fSelect('data.level', 'Level', [['0', 'Cantrip']].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return [String(n), 'Level ' + n]; })), { type: 'int', rerender: true }) +
          fSelect('data.school', 'School', M().SCHOOLS) +
          '<div class="hb-field hb-field-wide"><span class="hb-label">Spell lists</span><div class="hb-checks">' +
          M().SPELL_CLASSES.map(function (c) { return '<label class="hb-check"><input type="checkbox" data-class="' + c + '"' + (d.classes.indexOf(c) >= 0 ? ' checked' : '') + '> <span>' + esc(R().className(c)) + '</span></label>'; }).join('') + '</div></div>') +
        card('Casting', fText('data.castingTime', 'Casting time', { list: 'hb-cast', max: 80 }) +
          fText('data.range', 'Range', { max: 80, placeholder: 'e.g. 60 feet, Self, Touch' }) +
          fText('data.duration', 'Duration', { max: 80, placeholder: 'e.g. Instantaneous, 1 minute' }) +
          '<div class="hb-field hb-field-wide"><span class="hb-label">Components & tags</span><div class="hb-checks">' +
          fCheck('data.verbal', 'Verbal (V)') + fCheck('data.somatic', 'Somatic (S)') + fCheck('data.material', 'Material (M)', { rerender: true }) +
          fCheck('data.concentration', 'Concentration') + fCheck('data.ritual', 'Ritual') + '</div></div>' +
          (d.material ? fText('data.materials', 'Material component', { wide: true, max: 200, placeholder: 'e.g. a pinch of sulfur' }) : '')) +
        card('Effect', fArea('data.description', 'What the spell does', { rows: 6, help: MARKUP_HINT }) +
          fArea('data.higherLevels', d.level === 0 ? 'Cantrip upgrade' : 'Using a higher-level spell slot', { optional: true, rows: 2, max: 2000, placeholder: d.level === 0 ? 'e.g. The damage increases by 1d10 when you reach levels 5, 11 and 17.' : 'e.g. The damage increases by 1d6 for each spell slot level above 1.' }));
    }

    function itemFormKind() {
      var d = entry.data;
      return basics() +
        card('Item', fSelect('data.category', 'Category', M().ITEM_CATEGORIES) +
          fText('data.baseItem', 'Based on', { optional: true, max: 60, placeholder: 'e.g. Longsword, Any Armor' }) +
          fSelect('data.rarity', 'Rarity', M().RARITIES) +
          fCheck('data.attunement', 'Requires Attunement', { rerender: true }) +
          (d.attunement ? fText('data.attunementBy', 'Attunement by', { optional: true, max: 80, placeholder: 'e.g. a Wizard' }) : '') +
          fNum('data.charges', 'Charges', 1, 99, { nullable: true, optional: true }) +
          fText('data.recharge', 'Regains charges', { optional: true, max: 120, placeholder: 'e.g. 1d6 + 1 daily at dawn' })) +
        card('Properties', fArea('data.description', 'What the item does', { rows: 6, help: MARKUP_HINT }) +
          fArea('data.curse', 'Curse', { optional: true, rows: 2, max: 2000 }));
    }

    function featForm() {
      return basics() +
        card('Feat', fSelect('data.category', 'Category', M().FEAT_CATEGORIES) +
          fText('data.prerequisite', 'Prerequisite', { optional: true, max: 120, placeholder: 'e.g. Level 4+, Strength 13+' }) +
          fText('data.abilityIncrease', 'Ability Score Increase', { optional: true, wide: true, max: 200, placeholder: 'e.g. Increase your Strength or Constitution by 1, to a maximum of 20.' }) +
          fCheck('data.repeatable', 'Repeatable (can be taken more than once)', { wide: true }) +
          fArea('data.description', 'Benefits', { rows: 6, help: MARKUP_HINT }));
    }

    function otherForm() {
      return basics(fText('data.category', 'Category', { list: 'hb-other', max: 40 })) +
        card('Rules text', fArea('data.description', 'Text', { rows: 10, help: MARKUP_HINT }));
    }

    function raceForm() {
      var d = entry.data;
      var langChecks = M().LANGUAGES.map(function (l) {
        var checked = d.languages && d.languages.indexOf(l) >= 0;
        return '<label class="hb-check"><input type="checkbox" data-race-lang="' + esc(l) + '"' + (checked ? ' checked' : '') + '> <span>' + esc(l) + '</span></label>';
      }).join('');
      var traitItems = (d.traits || []).map(function (t, i) {
        return '<div class="hb-list-item" data-race-trait="' + i + '">' +
          fText('data.traits.' + i + '.name', 'Trait name', { max: 80, placeholder: 'e.g. Darkvision, Fey Ancestry' }) +
          fArea('data.traits.' + i + '.text', 'Effect', { rows: 2, max: 4000, help: MARKUP_HINT }) +
          '<button type="button" class="btn btn-sm btn-danger hb-remove" data-remove-trait="' + i + '">Remove</button></div>';
      }).join('');
      return basics(fSelect('data.baseRace', 'Based on', M().BASE_RACES, { rerender: true })) +
        card('Racial traits', fSelect('data.size', 'Size', M().RACE_SIZES) +
          fNum('data.speed', 'Speed (ft.)', 20, 60) +
          fNum('data.darkvision', 'Darkvision (ft.)', 0, 120) +
          fText('data.abilityIncreases', 'Ability Score Increases', { wide: true, max: 200, optional: true, placeholder: 'e.g. +2 Dexterity, +1 Wisdom' })) +
        card('Languages', '<div class="hb-field hb-field-wide"><div class="hb-checks">' + langChecks + '</div></div>') +
        card('Traits', traitItems +
          '<button type="button" class="btn btn-sm btn-secondary" data-add-trait>+ Add trait</button>') +
        card('Description', fArea('data.description', 'Lore & flavor', { optional: true, rows: 4, help: MARKUP_HINT }));
    }

    function classForm() {
      var d = entry.data;
      var saveChecks = M().ABILS.map(function (a) {
        var checked = d.savingThrows && d.savingThrows.indexOf(a) >= 0;
        return '<label class="hb-check"><input type="checkbox" data-class-save="' + a + '"' + (checked ? ' checked' : '') + '> <span>' + esc(M().ABIL_NAME[a]) + '</span></label>';
      }).join('');
      var skillChecks = Object.keys(M().SKILLS).map(function (k) {
        var checked = d.skillList && d.skillList.indexOf(k) >= 0;
        return '<label class="hb-check"><input type="checkbox" data-class-skill="' + k + '"' + (checked ? ' checked' : '') + '> <span>' + esc(M().SKILLS[k][0]) + '</span></label>';
      }).join('');
      var featureItems = (d.features || []).map(function (f, i) {
        return '<div class="hb-list-item" data-class-feature="' + i + '">' +
          fNum('data.features.' + i + '.level', 'Level', 1, 20) +
          fText('data.features.' + i + '.name', 'Feature name', { max: 80, placeholder: 'e.g. Rage, Sneak Attack' }) +
          fArea('data.features.' + i + '.text', 'Effect', { rows: 2, max: 4000, help: MARKUP_HINT }) +
          '<button type="button" class="btn btn-sm btn-danger hb-remove" data-remove-feature="' + i + '">Remove</button></div>';
      }).join('');
      return basics(fSelect('data.baseClass', 'Based on', M().BASE_CLASSES, { rerender: true })) +
        card('Hit Points & Saves', fSelect('data.hitDie', 'Hit Die', M().CLASS_HIT_DICE.map(function (d) { return [String(d), 'd' + d]; })) +
          '<div class="hb-field hb-field-wide"><span class="hb-label">Saving Throws</span><div class="hb-checks">' + saveChecks + '</div></div>') +
        card('Skills', fNum('data.skillChoices', 'Choose how many', 0, 6) +
          '<div class="hb-field hb-field-wide"><span class="hb-label">Skill list</span><div class="hb-checks">' + skillChecks + '</div></div>') +
        card('Proficiencies', fArea('data.proficiencies', 'Armor, weapons & tools', { optional: true, rows: 2, max: 1000 }) +
          fArea('data.equipment', 'Starting equipment', { optional: true, rows: 2, max: 1000 })) +
        card('Spellcasting', fSelect('data.castingAbility', 'Spellcasting ability', M().CASTING_ABILITIES.map(function (a) { return [a, a ? M().ABIL_NAME[a] : 'None']; })) +
          fSelect('data.castingType', 'Spell list type', M().CASTING_TYPES.map(function (t) { return [t, t || 'None']; }))) +
        card('Subclass', fNum('data.subclassLevel', 'Subclass at level', 1, 20) +
          fText('data.subclassName', 'Subclass name', { max: 60, placeholder: 'e.g. Martial Archetype, Primal Path' })) +
        card('Features', featureItems +
          '<button type="button" class="btn btn-sm btn-secondary" data-add-feature>+ Add feature</button>') +
        card('Description', fArea('data.description', 'Lore & flavor', { optional: true, rows: 4, help: MARKUP_HINT }));
    }

    function renderForm() {
      var k = entry.kind;
      var html = k === 'monster' ? basics() + statBlockForm() + card('Description', fArea('data.description', 'Lore & behavior', { optional: true, rows: 4, help: MARKUP_HINT }))
        : k === 'npc' ? npcForm() : k === 'spell' ? spellForm() : k === 'magic-item' ? itemFormKind() : k === 'feat' ? featForm() : k === 'race' ? raceForm() : k === 'class' ? classForm() : otherForm();
      form.innerHTML = html + datalist('hb-types', M().TYPES) + datalist('hb-aligns', M().ALIGNMENTS) + datalist('hb-cast', M().CASTING_TIMES) + datalist('hb-other', M().OTHER_CATEGORIES);
      refreshDerived();
    }

    // -------------------------------------------------------------------------
    // Calculated values next to the fields, and the preview
    // -------------------------------------------------------------------------
    function hint(key, textValue) {
      var el = form.querySelector('[data-hint="' + key + '"]');
      if (el) el.textContent = textValue;
    }
    function refreshDerived() {
      if (!M().hasStatBlock(entry)) return;
      var n = M().normalize(entry);
      var d = n.data;
      var dv = M().derive(d);
      var sg = M().signed;
      M().ABILS.forEach(function (a) { hint('mod-' + a, sg(dv.mods[a])); hint('save-' + a, sg(dv.saves[a])); });
      Object.keys(M().SKILLS).forEach(function (k) { hint('skill-' + k, dv.skillBonus[k] != null ? sg(dv.skillBonus[k]) : ''); });
      hint('cr', 'XP ' + (d.cr === '0' ? '0 or 10' : dv.xp.toLocaleString('en-US')) + ' · Proficiency bonus ' + sg(dv.pb));
      hint('hp', 'Hit Dice ' + dv.hpFormula + ' = ' + dv.hpAvg + ' HP on average (' + d.size + ' creatures use d' + M().HIT_DIE[d.size] + ', plus the Constitution modifier per die).');
      hint('init', 'Initiative ' + sg(dv.initMod) + ' (' + (10 + dv.initMod) + ')');
      hint('pp', 'Passive Perception ' + dv.passivePerception + ' is added automatically.');
      M().ACTION_LISTS.forEach(function (l) {
        d[l.key].forEach(function (it, i) { if (it.mode !== 'text') hint('item-' + l.key + '-' + i, '→ ' + M().itemText(it, d, dv).replace(/_/g, '')); });
      });
    }
    function renderPreview() {
      clearTimeout(previewTimer);
      $('#hb-preview').innerHTML = R().homebrew(entry, { imageUrl: entry.data.image ? pictureUrl : null });
      $('#hb-ed-title').textContent = entry.name || 'Unnamed';
    }
    function schedulePreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(renderPreview, 120);
    }

    // -------------------------------------------------------------------------
    // Save status and autosave
    // -------------------------------------------------------------------------
    function renderSave() {
      var el = $('#hb-save');
      var state = conflict ? 'error' : saving ? 'saving' : saveError ? 'error' : dirty ? 'unsaved' : 'saved';
      el.className = 'hb-save hb-save-' + state;
      if (state === 'saving') el.innerHTML = '<span class="hb-dot"></span>Saving…';
      else if (state === 'unsaved') el.innerHTML = '<span class="hb-dot"></span>Unsaved changes';
      else if (state === 'saved') el.innerHTML = '<span class="hb-dot"></span>' + (lastSaved ? 'All changes saved · ' + esc(clock(lastSaved)) : 'Saved');
      else el.innerHTML = '<span class="hb-dot"></span>Not saved: ' + esc(saveError || 'unknown error') +
        (conflict ? ' <button type="button" class="link-btn" data-hb-act="reload">Reload</button>' : ' <button type="button" class="link-btn" data-hb-act="retry">Retry</button>');
      $('#hb-save-now').disabled = !entry || saving || (!dirty && !saveError) || conflict;
    }

    function changed() {
      dirty = true;
      saveError = null;
      clearTimeout(saveTimer);
      if (!conflict) saveTimer = setTimeout(saveNow, AUTOSAVE_MS);
      renderSave();
      refreshDerived();
      schedulePreview();
    }

    async function saveNow() {
      clearTimeout(saveTimer);
      if (!entry || conflict) return;
      if (saving) { againAfterSave = true; return; }
      var errs = M().validate(M().normalize(entry));
      if (errs.length) {
        saveError = errs[0];
        renderSave();
        return;
      }
      saving = true;
      renderSave();
      var sent = JSON.stringify([entry.name, entry.summary, entry.data]);
      var res = await Store().save(entry);
      saving = false;
      if (res.ok) {
        flushDeletes();
        entry.version = res.version;
        entry.updatedAt = res.updatedAt;
        lastSaved = new Date();
        saveError = null;
        if (JSON.stringify([entry.name, entry.summary, entry.data]) === sent) dirty = false;
        else saveTimer = setTimeout(saveNow, AUTOSAVE_MS);
      } else {
        saveError = res.message;
        conflict = !!res.conflict;
      }
      if (!alive) {
        // The page was left while this save was running: send what was typed meanwhile.
        if (res.ok && dirty) Store().save(entry);
        return;
      }
      renderSave();
      if (againAfterSave) {
        againAfterSave = false;
        if (dirty) saveNow();
      }
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    function valueOf(el) {
      var t = el.getAttribute('data-type');
      if (t === 'bool') return el.checked;
      if (t === 'int' || t === 'intnull') {
        if (el.value === '') return t === 'intnull' ? null : '';
        var n = Number(el.value);
        return Number.isFinite(n) ? n : el.value;
      }
      return el.value;
    }

    function rerender(focusPath) {
      var scroll = global.scrollY;
      renderForm();
      global.scrollTo(0, scroll);
      if (focusPath) {
        var f = form.querySelector('[data-path="' + focusPath + '"]');
        if (f) f.focus({ preventScroll: true });
      }
    }

    function onInput(e) {
      var el = e.target;
      if (!entry || conflict) return;
      if (el.hasAttribute('data-hb-file')) {
        if (e.type === 'change' && el.files && el.files[0]) { var file = el.files[0]; el.value = ''; uploadPicture(file); }
        return;
      }
      if (el.hasAttribute('data-path')) {
        var path = el.getAttribute('data-path');
        setPath(entry, path, valueOf(el));
        if (e.type === 'change' && el.hasAttribute('data-rerender')) {
          entry = Object.assign(M().normalize(entry), { id: entry.id, version: entry.version, updatedAt: entry.updatedAt });
          rerender(path);
        }
        changed();
      } else if (el.hasAttribute('data-save')) {
        var a = el.getAttribute('data-save');
        var saves = entry.data.saves.filter(function (x) { return x !== a; });
        if (el.checked) saves.push(a);
        entry.data.saves = M().ABILS.filter(function (x) { return saves.indexOf(x) >= 0; });
        changed();
      } else if (el.hasAttribute('data-skill')) {
        var k = el.getAttribute('data-skill');
        if (el.value === '0') delete entry.data.skills[k];
        else entry.data.skills[k] = Number(el.value);
        changed();
      } else if (el.hasAttribute('data-class')) {
        var c = el.getAttribute('data-class');
        var cls = entry.data.classes.filter(function (x) { return x !== c; });
        if (el.checked) cls.push(c);
        entry.data.classes = M().SPELL_CLASSES.filter(function (x) { return cls.indexOf(x) >= 0; });
        changed();
      } else if (el.hasAttribute('data-race-lang')) {
        var lang = el.getAttribute('data-race-lang');
        var langs = (entry.data.languages || []).filter(function (x) { return x !== lang; });
        if (el.checked) langs.push(lang);
        entry.data.languages = M().LANGUAGES.filter(function (x) { return langs.indexOf(x) >= 0; });
        if (!entry.data.languages.length) entry.data.languages = ['Common'];
        changed();
      } else if (el.hasAttribute('data-class-save')) {
        var sa = el.getAttribute('data-class-save');
        var st = (entry.data.savingThrows || []).filter(function (x) { return x !== sa; });
        if (el.checked) st.push(sa);
        entry.data.savingThrows = M().ABILS.filter(function (x) { return st.indexOf(x) >= 0; });
        changed();
      } else if (el.hasAttribute('data-class-skill')) {
        var sk = el.getAttribute('data-class-skill');
        var sl = (entry.data.skillList || []).filter(function (x) { return x !== sk; });
        if (el.checked) sl.push(sk);
        entry.data.skillList = Object.keys(M().SKILLS).filter(function (x) { return sl.indexOf(x) >= 0; });
        changed();
      }
    }

    function onClick(e) {
      if (entry && !conflict) {
        var addTrait = e.target.closest('[data-add-trait]');
        if (addTrait) {
          if (!entry.data.traits) entry.data.traits = [];
          entry.data.traits.push({ id: 't_' + Date.now().toString(36), name: '', text: '' });
          rerender('data.traits.' + (entry.data.traits.length - 1) + '.name');
          changed();
          return;
        }
        var rmTrait = e.target.closest('[data-remove-trait]');
        if (rmTrait) {
          var ti = Number(rmTrait.getAttribute('data-remove-trait'));
          entry.data.traits.splice(ti, 1);
          rerender();
          changed();
          return;
        }
        var addFeat = e.target.closest('[data-add-feature]');
        if (addFeat) {
          if (!entry.data.features) entry.data.features = [];
          entry.data.features.push({ id: 'f_' + Date.now().toString(36), level: 1, name: '', text: '' });
          rerender('data.features.' + (entry.data.features.length - 1) + '.name');
          changed();
          return;
        }
        var rmFeat = e.target.closest('[data-remove-feature]');
        if (rmFeat) {
          var fi = Number(rmFeat.getAttribute('data-remove-feature'));
          entry.data.features.splice(fi, 1);
          rerender();
          changed();
          return;
        }
      }
      var t = e.target.closest('[data-hb-act]');
      if (!t || !root.contains(t)) return;
      var act = t.getAttribute('data-hb-act');
      if (act === 'retry') { saveNow(); return; }
      if (act === 'reload') { load(); return; }
      if (!entry || conflict) return;
      if (act === 'remove-picture') {
        if (!entry.data.image || !global.confirm('Remove the picture?')) return;
        pendingDeletes.push(entry.data.image.path);
        entry.data.image = null;
        pictureUrl = null;
        refreshPicture();
        changed();
        return;
      }
      var key = t.getAttribute('data-list');
      var list = key && entry.data[key];
      var i = Number(t.getAttribute('data-i'));
      if (act === 'add-item' && list) {
        if (list.length >= M().LIMITS.items) return;
        list.push(M().newItem(t.getAttribute('data-mode')));
        rerender('data.' + key + '.' + (list.length - 1) + '.name');
        changed();
      } else if (act === 'remove-item' && list) {
        var name = list[i] && list[i].name;
        if (name && !global.confirm('Remove "' + name + '"?')) return;
        list.splice(i, 1);
        rerender();
        changed();
      } else if (act === 'move-item' && list) {
        var j = i + Number(t.getAttribute('data-dir'));
        if (j < 0 || j >= list.length) return;
        var it = list.splice(i, 1)[0];
        list.splice(j, 0, it);
        rerender('data.' + key + '.' + j + '.name');
        changed();
      }
    }

    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (dirty || saveError) saveNow();
      }
    }
    function onBeforeUnload(e) {
      if (dirty || saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    }

    async function load() {
      conflict = false;
      saveError = null;
      dirty = false;
      var res = await Store().get(id);
      if (!alive) return;
      if (!res.ok) {
        $('#hb-ed-title').textContent = res.notFound ? 'Entry not found' : 'Homebrew';
        $('#hb-banner').innerHTML = '<p>' + esc(res.message) + '</p><p><a href="#grimoire" data-fog-nav="#grimoire">Back to Homebrew</a></p>';
        $('#hb-banner').hidden = false;
        $('#hb-ed-layout').hidden = true;
        renderSave();
        $('#hb-save').hidden = true;
        return;
      }
      entry = res.entry;
      await loadPictureUrl();
      if (!alive) return;
      $('#hb-banner').hidden = true;
      $('#hb-save').hidden = false;
      $('#hb-ed-kicker').textContent = 'Homebrew · ' + M().KINDS[entry.kind].label;
      $('#hb-ed-layout').hidden = false;
      renderForm();
      renderPreview();
      renderSave();
    }

    function onDragOver(e) {
      var z = e.target.closest && e.target.closest('[data-hb-drop]');
      if (!z || !e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') < 0) return;
      e.preventDefault();
      z.classList.add('is-dragover');
    }
    function onDragLeave(e) {
      var z = e.target.closest && e.target.closest('[data-hb-drop]');
      if (z && !z.contains(e.relatedTarget)) z.classList.remove('is-dragover');
    }
    function onDrop(e) {
      var z = e.target.closest && e.target.closest('[data-hb-drop]');
      if (!z) return;
      e.preventDefault();
      z.classList.remove('is-dragover');
      uploadPicture(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    }
    function onPaste(e) {
      if (!entry || !e.clipboardData) return;
      var file = Array.prototype.slice.call(e.clipboardData.files || []).filter(function (f) { return f.type && f.type.indexOf('image/') === 0; })[0];
      if (!file) return; // plain text pastes normally
      e.preventDefault();
      uploadPicture(file);
    }
    form.addEventListener('dragover', onDragOver);
    form.addEventListener('dragleave', onDragLeave);
    form.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);
    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    root.addEventListener('click', onClick);
    $('#hb-save-now').addEventListener('click', function () { saveNow(); });
    document.addEventListener('keydown', onKey);
    global.addEventListener('beforeunload', onBeforeUnload);
    renderSave();
    load();

    return function cleanup() {
      alive = false;
      clearTimeout(previewTimer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('paste', onPaste);
      global.removeEventListener('beforeunload', onBeforeUnload);
      // Leaving the page with pending changes: send them now (the result can't be shown any more).
      if (dirty && entry && !conflict && !saving) {
        clearTimeout(saveTimer);
        Store().save(entry);
      }
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.homebrewEditor = init;
})(window);
