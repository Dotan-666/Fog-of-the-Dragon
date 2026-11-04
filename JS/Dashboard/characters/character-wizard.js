/**
 * Guided character creator (and editor) — D&D 5E 2024 rules, SRD 5.2.1
 *
 * Create mode: #characters/new/<draftId>  — every change is saved to the draft.
 * Edit mode:   #characters/<id>/edit      — changes are kept in doc.editDraft until "Save changes",
 *                                            so the saved character stays valid while you edit.
 */
(function (global) {
  'use strict';

  var Api = function () { return global.FogRulesApi; };
  var Opt = function () { return global.FogCharacterOptions; };
  var Val = function () { return global.FogValidateCharacter; };
  var Store = function () { return global.FogCharacterStore; };
  var UI = function () { return global.FogCharacterUI; };
  var esc = function (s) { return global.FogCharacterUI.escapeHtml(s); };

  var TIPS_KEY = 'fog_wizard_tips';

  var STEP_INFO = {
    level: { title: 'Level', intro: 'Choose the level your character starts at. Level sets your Proficiency Bonus, Hit Points, class features, feats and spell slots.', tip: 'New players usually start at level 1. Your Dungeon Master may ask you to start higher.' },
    class: { title: 'Class', intro: 'Your class is your character’s main training. It sets Hit Points, proficiencies, and the features you gain at each level.', tip: 'Fighters and Rogues have no spells and are the simplest to play. Clerics and Wizards have many spell choices.' },
    background: { title: 'Background', intro: 'Your background is where you came from. It gives two skills, a tool, an Origin feat, starting equipment, and decides which three abilities you can increase.', tip: 'Pick a background whose abilities include your class’s main ability.' },
    species: { title: 'Species', intro: 'Your species gives your size, speed and special traits.', tip: 'Species no longer change ability scores in the 2024 rules; that comes from your background.' },
    abilities: { title: 'Ability Scores', intro: 'Generate your six ability scores, then apply your background’s increases.', tip: 'Put your highest score in your class’s primary ability.' },
    proficiencies: { title: 'Skills & Languages', intro: 'Choose your class skills, any Expertise, and your languages. Skills you already have from your background or species are shown as granted.', tip: 'Every character knows Common plus two standard languages.' },
    feats: { title: 'Feats', intro: 'Feats from your background, species, class, and the Ability Score Improvement levels you have reached.', tip: 'Most players take the Ability Score Improvement feat at level 4.' },
    equipment: { title: 'Equipment', intro: 'Choose your class and background starting equipment, and your Weapon Mastery if your class has it.', tip: 'Gold-only options let you buy equipment yourself; the sheet only lists what you choose here.' },
    spells: { title: 'Spells', intro: 'Choose your cantrips and prepared spells. Only spells of a level you have slots for can be chosen.', tip: 'You can change prepared spells after every Long Rest, so don’t worry about getting it perfect.' },
    details: { title: 'Details', intro: 'Name your character and describe who they are.', tip: 'Only the name is required. You can fill in the rest later.' },
    review: { title: 'Review', intro: 'Check your character. Every step must be complete before you can save.', tip: '' },
  };

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  function setPath(obj, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (o, k) {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
      return o[k];
    }, obj);
    target[last] = value;
  }

  function readTips() {
    try {
      return global.localStorage.getItem(TIPS_KEY) !== 'off';
    } catch (e) {
      return true;
    }
  }

  function writeTips(on) {
    try {
      global.localStorage.setItem(TIPS_KEY, on ? 'on' : 'off');
    } catch (e) { /* preference only */ }
  }

  // ---------------------------------------------------------------------------
  // Small HTML builders
  // ---------------------------------------------------------------------------
  function card(opts) {
    return (
      '<button type="button" class="option-card' + (opts.selected ? ' is-selected' : '') + '"' +
      ' data-act="' + opts.act + '" data-key="' + esc(opts.key || '') + '" data-val="' + esc(opts.val) + '"' +
      (opts.slot ? ' data-slot="' + esc(opts.slot) + '"' : '') +
      ' aria-pressed="' + (opts.selected ? 'true' : 'false') + '">' +
      '<h3>' + esc(opts.title) + '</h3>' +
      (opts.sub ? '<p class="option-sub">' + esc(opts.sub) + '</p>' : '') +
      (opts.body ? '<p>' + esc(opts.body) + '</p>' : '') +
      '</button>'
    );
  }

  function pickItem(opts) {
    // opts: list (path), val, label, meta, checked, disabled, note, detailKind, max, slot, act
    var id = 'pk-' + (opts.list + '-' + opts.val).replace(/[^a-z0-9-]/gi, '-');
    return (
      '<div class="spell-pick-item' + (opts.disabled ? ' is-disabled' : '') + (opts.checked ? ' is-checked' : '') + '" data-filter-text="' + esc((opts.label + ' ' + (opts.meta || '')).toLowerCase()) + '">' +
      '<input type="' + (opts.radio ? 'radio' : 'checkbox') + '" id="' + id + '"' + (opts.checked ? ' checked' : '') + (opts.disabled ? ' disabled' : '') +
      ' data-act="' + (opts.act || 'toggle') + '" data-list="' + esc(opts.list) + '" data-val="' + esc(opts.val) + '"' +
      (opts.max != null ? ' data-max="' + opts.max + '"' : '') + (opts.slot ? ' data-slot="' + esc(opts.slot) + '"' : '') +
      (opts.type ? ' data-type="' + esc(opts.type) + '"' : '') + (opts.radio ? ' name="' + esc(opts.list + (opts.slot || '')) + '"' : '') + '>' +
      '<label for="' + id + '"><span class="pick-name">' + esc(opts.label) + '</span>' +
      (opts.meta ? ' <span class="pick-meta">' + esc(opts.meta) + '</span>' : '') +
      (opts.note ? ' <span class="pick-note">' + esc(opts.note) + '</span>' : '') + '</label>' +
      (opts.detailKind ? '<button type="button" class="pick-detail-btn" data-act="detail" data-kind="' + opts.detailKind + '" data-id="' + esc(opts.val) + '" aria-expanded="false">Details</button><div class="inline-detail" hidden></div>' : '') +
      '</div>'
    );
  }

  function countBadge(n, of) {
    return '<span class="count-badge' + (n === of ? ' is-complete' : '') + '">' + n + ' / ' + of + '</span>';
  }

  function section(title, inner, extra) {
    return '<section class="wizard-section"><h3 class="wizard-section-title">' + esc(title) + (extra || '') + '</h3>' + inner + '</section>';
  }

  function abilitySelect(act, attrs, value, options, placeholder) {
    return '<select class="form-select-dark" data-act="' + act + '" ' + attrs + '>' +
      '<option value="">' + esc(placeholder || 'Choose…') + '</option>' +
      options.map(function (ab) {
        return '<option value="' + ab + '"' + (value === ab ? ' selected' : '') + '>' + esc(UI().abilityName(ab)) + '</option>';
      }).join('') + '</select>';
  }

  function featureList(features) {
    return '<ul class="feature-list">' + features.map(function (f) {
      return '<li><details><summary><span class="feature-level">' + (f.level ? 'Level ' + f.level : '') + '</span> ' + esc(f.name) + '</summary>' + UI().rulesText(f.description) + '</details></li>';
    }).join('') + '</ul>';
  }

  // ---------------------------------------------------------------------------
  // Step renderers
  // ---------------------------------------------------------------------------
  function renderLevel(doc) {
    var c = doc.choices;
    var buttons = '';
    for (var l = 1; l <= 20; l++) {
      buttons += '<button type="button" class="level-btn' + (c.level === l ? ' is-selected' : '') + '" data-act="pick" data-key="level" data-val="' + l + '" aria-pressed="' + (c.level === l) + '">' + l + '</button>';
    }
    var cls = Api().getClass(c.classId);
    var detail = '<h4>Level ' + c.level + '</h4><dl class="rules-meta">' +
      '<div><dt>Proficiency Bonus</dt><dd>' + UI().signed(Api().proficiencyBonus(c.level)) + '</dd></div>';
    if (cls) {
      var e = cls.levels[c.level];
      detail += '<div><dt>' + esc(cls.name) + ' features at this level</dt><dd>' + esc(e.features.join(', ') || '—') + '</dd></div>';
      detail += '<div><dt>Hit Dice</dt><dd>' + c.level + 'd' + cls.hitDie + '</dd></div>';
    }
    detail += '</dl><p>Raising or lowering the level keeps every choice that is still allowed and tells you about anything it had to remove.</p>';
    return '<div class="level-grid" role="group" aria-label="Character level">' + buttons + '</div><div class="option-detail">' + detail + '</div>';
  }

  function classCard(cls, c) {
    return card({
      act: 'pick', key: 'classId', val: cls.id, selected: c.classId === cls.id, title: cls.name,
      sub: 'd' + cls.hitDie + ' Hit Die · ' + cls.primaryAbilityText,
      body: 'Saves: ' + cls.savingThrows.map(UI().abilityName).join(', '),
    });
  }

  function renderClass(doc) {
    var c = doc.choices;
    var html = '<div class="option-grid">' + Api().listClasses().map(function (cls) { return classCard(cls, c); }).join('') + '</div>';
    html += '<p class="wizard-note">The SRD also includes Barbarian, Bard, Druid, Monk, Paladin, Ranger, Sorcerer and Warlock. They aren’t supported by this creator yet.</p>';
    var cls = Api().getClass(c.classId);
    if (!cls) return html;

    html += '<div class="option-detail"><h4>' + esc(cls.name) + '</h4><dl class="rules-meta">' +
      '<div><dt>Hit Point Die</dt><dd>d' + cls.hitDie + ' (level 1: ' + cls.hitDie + ' + Con; later levels: ' + cls.fixedHpPerLevel + ' + Con)</dd></div>' +
      '<div><dt>Saving Throws</dt><dd>' + cls.savingThrows.map(UI().abilityName).join(', ') + '</dd></div>' +
      '<div><dt>Skills</dt><dd>Choose ' + cls.skillChoices.count + ': ' + cls.skillChoices.from.map(function (s) { return Api().getSkill(s).name; }).join(', ') + '</dd></div>' +
      '<div><dt>Weapons</dt><dd>' + esc(cls.weaponProficiencyText) + '</dd></div>' +
      '<div><dt>Armor Training</dt><dd>' + esc(cls.armorTrainingText) + '</dd></div>' +
      (cls.toolProficiencyText ? '<div><dt>Tools</dt><dd>' + esc(cls.toolProficiencyText) + '</dd></div>' : '') +
      '</dl><h4>Features up to level ' + c.level + '</h4>' +
      featureList(cls.features.filter(function (f) { return f.level <= c.level; })) + '</div>';

    if (Opt().subclassAvailable(doc)) {
      var sub = cls.subclass;
      html += section(cls.name + ' Subclass (level ' + cls.subclassLevel + ')',
        '<div class="option-grid">' + card({ act: 'pick', key: 'subclassId', val: sub.id, selected: c.subclassId === sub.id, title: sub.name, sub: sub.tagline }) + '</div>' +
        '<p class="wizard-note">The SRD includes one subclass per class.</p>' +
        (c.subclassId === sub.id ? '<div class="option-detail">' + UI().rulesText(sub.description) + featureList(sub.features.filter(function (f) { return f.level <= c.level; })) + '</div>' : ''));
    } else {
      html += '<p class="wizard-note">You choose a ' + esc(cls.name) + ' subclass at level ' + cls.subclassLevel + '.</p>';
    }

    Opt().classChoices(doc).forEach(function (ch) {
      if (ch.type !== 'option') return;
      var picked = c.classOptions[ch.id];
      html += section(ch.label + ' (level ' + ch.level + ')',
        '<div class="option-grid">' + ch.options.map(function (o) {
          return card({ act: 'classOpt', key: ch.id, val: o.id, selected: picked === o.id, title: o.name, body: o.description });
        }).join('') + '</div>');
    });
    return html;
  }

  function renderBackground(doc) {
    var c = doc.choices;
    var html = '<div class="option-grid">' + Api().listBackgrounds().map(function (bg) {
      return card({
        act: 'pick', key: 'backgroundId', val: bg.id, selected: c.backgroundId === bg.id, title: bg.name,
        sub: 'Abilities: ' + bg.abilities.map(UI().abilityShort).join(', '),
        body: 'Feat: ' + Api().getFeat(bg.feat.id).name + (bg.feat.spellList ? ' (' + bg.feat.spellList.charAt(0).toUpperCase() + bg.feat.spellList.slice(1) + ')' : '') +
          ' · Skills: ' + bg.skills.map(function (s) { return Api().getSkill(s).name; }).join(', '),
      });
    }).join('') + '</div>';
    var bg = Api().getBackground(c.backgroundId);
    if (!bg) return html;
    html += '<div class="option-detail"><h4>' + esc(bg.name) + '</h4><dl class="rules-meta">' +
      '<div><dt>Ability Scores</dt><dd>' + bg.abilities.map(UI().abilityName).join(', ') + ' (+2/+1 or +1/+1/+1, chosen on the Ability Scores step)</dd></div>' +
      '<div><dt>Skill Proficiencies</dt><dd>' + bg.skills.map(function (s) { return Api().getSkill(s).name; }).join(', ') + '</dd></div>' +
      '<div><dt>Tool Proficiency</dt><dd>' + esc(bg.tool.name || bg.tool.text) + '</dd></div>' +
      '<div><dt>Equipment</dt><dd>' + esc(bg.equipmentText) + '</dd></div>' +
      '</dl>' + UI().featDetail(bg.feat.id) + '</div>';
    if (bg.tool.choose) {
      var tools = Api().rules().tools.filter(function (t) { return t.family === bg.tool.choose; });
      html += section('Gaming Set proficiency', '<select class="form-select-dark" data-act="set" data-path="choices.backgroundTool">' +
        '<option value="">Choose a Gaming Set…</option>' + tools.map(function (t) {
          return '<option value="' + t.id + '"' + (c.backgroundTool === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>';
        }).join('') + '</select>');
    }
    return html;
  }

  function renderSpecies(doc) {
    var c = doc.choices;
    var html = '<div class="option-grid">' + Api().listSpecies().map(function (sp) {
      return card({
        act: 'pick', key: 'speciesId', val: sp.id, selected: c.speciesId === sp.id, title: sp.name,
        sub: sp.sizeOptions.join(' or ') + ' · Speed ' + sp.speed + ' ft.',
        body: sp.traits.map(function (t) { return t.name; }).join(', '),
      });
    }).join('') + '</div>';
    var sp = Api().getSpecies(c.speciesId);
    if (!sp) return html;
    html += '<div class="option-detail"><h4>' + esc(sp.name) + '</h4><dl class="rules-meta"><div><dt>Size</dt><dd>' + esc(sp.sizeText) + '</dd></div><div><dt>Speed</dt><dd>' + sp.speed + ' feet</dd></div></dl>' +
      sp.traits.map(function (t) { return '<p><strong>' + esc(t.name) + '.</strong></p>' + UI().rulesText(t.description); }).join('') + '</div>';

    var so = c.speciesOptions || {};
    sp.choices.forEach(function (ch) {
      if (ch.id === 'feat') {
        html += section(ch.label, '<p class="wizard-note">You choose this Origin feat on the Feats step.</p>');
      } else if (ch.options) {
        html += section(ch.label, '<div class="option-grid">' + ch.options.map(function (o) {
          return card({ act: 'speciesOpt', key: ch.id, val: o.id, selected: so[ch.id] === o.id, title: o.name, body: o.description });
        }).join('') + '</div>' + (function () {
          var o = ch.options.find(function (x) { return x.id === so[ch.id]; });
          if (!o || !o.spells) return '';
          return '<p class="wizard-note">Spells: ' + [3, 5].map(function (l) { return 'level ' + l + ': ' + esc((Api().getSpell(o.spells[l]) || {}).name); }).join('; ') + ' (character level).</p>';
        })());
      } else if (ch.abilities) {
        html += section(ch.label, abilitySelect('speciesOpt', 'data-key="' + ch.id + '"', so[ch.id], ch.abilities));
      } else if (ch.skills) {
        html += section(ch.label, '<select class="form-select-dark" data-act="speciesOpt" data-key="' + ch.id + '"><option value="">Choose a skill…</option>' +
          ch.skills.map(function (s) { return '<option value="' + s + '"' + (so[ch.id] === s ? ' selected' : '') + '>' + esc(Api().getSkill(s).name) + '</option>'; }).join('') + '</select>');
      } else if (ch.sizes) {
        html += section(ch.label, '<div class="option-grid">' + ch.sizes.map(function (s) {
          return card({ act: 'speciesOpt', key: ch.id, val: s, selected: so[ch.id] === s, title: s });
        }).join('') + '</div>');
      }
    });
    return html;
  }

  function renderAbilities(doc) {
    var c = doc.choices;
    var methods = Api().rules().abilityMethods;
    var abilities = Api().rules().abilities;
    var base = c.abilityScoresBase;
    var html = '<div class="option-grid">' + Object.values(methods).map(function (m) {
      return card({ act: 'pick', key: 'abilityMethod', val: m.id, selected: c.abilityMethod === m.id, title: m.label, body: m.description });
    }).join('') + '</div>';
    var m = methods[c.abilityMethod];
    if (m) {
      var rows = abilities.map(function (ab) {
        var control;
        if (m.id === 'standard-array') {
          var used = abilities.filter(function (x) { return x !== ab; }).map(function (x) { return base[x]; });
          control = '<select class="form-select-dark" data-act="score" data-ab="' + ab + '"><option value="">—</option>' +
            m.scores.map(function (s) {
              var taken = used.indexOf(s) >= 0 && m.scores.filter(function (v) { return v === s; }).length <= used.filter(function (v) { return v === s; }).length;
              return '<option value="' + s + '"' + (base[ab] === s ? ' selected' : '') + (taken ? ' disabled' : '') + '>' + s + (taken ? ' (used)' : '') + '</option>';
            }).join('') + '</select>';
        } else if (m.id === 'point-buy') {
          var v = typeof base[ab] === 'number' ? base[ab] : 8;
          control = '<div class="stepper"><button type="button" class="btn-icon-sm" data-act="pb" data-ab="' + ab + '" data-delta="-1" aria-label="Decrease ' + ab + '"' + (v <= m.min ? ' disabled' : '') + '>−</button>' +
            '<span class="stepper-value">' + v + '</span>' +
            '<button type="button" class="btn-icon-sm" data-act="pb" data-ab="' + ab + '" data-delta="1" aria-label="Increase ' + ab + '"' + (v >= m.max ? ' disabled' : '') + '>+</button>' +
            '<span class="stepper-cost">cost ' + m.costs[v] + '</span></div>';
        } else {
          control = '<input type="number" class="form-control-dark score-input" min="' + m.min + '" max="' + m.max + '" data-act="score" data-ab="' + ab + '" value="' + (typeof base[ab] === 'number' ? base[ab] : '') + '" aria-label="' + esc(UI().abilityName(ab)) + ' score">';
        }
        return '<div class="ability-assign"><label>' + esc(UI().abilityName(ab)) + '</label>' + control + '</div>';
      }).join('');
      var extra = '';
      if (m.id === 'point-buy') {
        var spent = abilities.reduce(function (sum, ab) { return sum + (m.costs[typeof base[ab] === 'number' ? base[ab] : 8] || 0); }, 0);
        extra = '<p class="wizard-note">Points spent: <strong>' + spent + ' / ' + m.budget + '</strong></p>';
      }
      if (m.id === 'random') {
        extra = '<p><button type="button" class="btn btn-secondary btn-sm" data-act="roll">Roll 4d6 (drop lowest) for all six</button> <span class="wizard-note">Rolls fill Strength to Charisma in order; you can edit any value.</span></p>';
      }
      html += section('Base scores', extra + '<div class="ability-assign-grid">' + rows + '</div>');
    }

    var bg = Api().getBackground(c.backgroundId);
    if (bg) {
      var bi = c.backgroundIncrease || {};
      var inc = '<div class="option-grid">' +
        card({ act: 'bgMode', val: '2-1', selected: bi.mode === '2-1', title: '+2 and +1', body: 'Increase one of ' + bg.abilities.map(UI().abilityName).join(', ') + ' by 2 and another by 1.' }) +
        card({ act: 'bgMode', val: '1-1-1', selected: bi.mode === '1-1-1', title: '+1 to all three', body: 'Increase ' + bg.abilities.map(UI().abilityName).join(', ') + ' by 1 each.' }) +
        '</div>';
      if (bi.mode === '2-1') {
        inc += '<div class="inline-fields"><label>+2 ' + abilitySelect('bgInc', 'data-which="plus2"', bi.plus2, bg.abilities) + '</label>' +
          '<label>+1 ' + abilitySelect('bgInc', 'data-which="plus1"', bi.plus1, bg.abilities.filter(function (a) { return a !== bi.plus2; })) + '</label></div>';
      }
      html += section(bg.name + ' background increases', inc + '<p class="wizard-note">None of these increases can raise a score above 20.</p>');
    } else {
      html += '<p class="wizard-note">Choose a background to apply its ability score increases.</p>';
    }

    var sc = Opt().abilityScores(doc);
    html += section('Result', '<table class="ability-table"><thead><tr><th>Ability</th><th>Base</th><th>Increases</th><th>Score</th><th>Modifier</th></tr></thead><tbody>' +
      abilities.map(function (ab) {
        var bd = sc.breakdown[ab];
        var incs = bd.slice(1).map(function (b) { return '+' + b.value + ' ' + b.source; }).join(', ');
        return '<tr><th scope="row">' + esc(UI().abilityName(ab)) + '</th><td>' + (typeof base[ab] === 'number' ? base[ab] : '—') + '</td><td>' + esc(incs || '—') + '</td><td>' + sc.scores[ab] + '</td><td>' + UI().signed(Api().abilityModifier(sc.scores[ab])) + '</td></tr>';
      }).join('') + '</tbody></table><p class="wizard-note">Increases from feats are chosen on the Feats step and show up here.</p>');
    return html;
  }

  function renderProficiencies(doc) {
    var c = doc.choices;
    var o = Opt();
    var html = '';
    var cso = o.classSkillOptions(doc);
    if (cso) {
      var picked = c.skillProficiencies;
      html += section('Class skills', '<div class="spell-pick-list two-col">' + cso.from.map(function (s) {
        var granted = cso.granted[s];
        return pickItem({
          list: 'skillProficiencies', val: s, label: Api().getSkill(s).name, meta: UI().abilityShort(Api().getSkill(s).ability),
          checked: granted || picked.indexOf(s) >= 0, disabled: !!granted, note: granted ? 'from ' + granted.join(', ') : '', max: cso.count,
        });
      }).join('') + '</div>', countBadge(picked.length, cso.count));
    } else {
      html += '<p class="wizard-note">Choose a class first.</p>';
    }

    o.classChoices(doc).forEach(function (ch) {
      if (ch.type !== 'expertise') return;
      var eo = o.expertiseOptions(doc, ch);
      var cur = c.classOptions[ch.id] || [];
      html += section(ch.label, '<p class="wizard-note">Expertise doubles your Proficiency Bonus for that skill.</p>' +
        (eo.from.length ? '<div class="spell-pick-list two-col">' + eo.from.map(function (s) {
          return pickItem({ list: 'classOptions.' + ch.id, val: s, label: Api().getSkill(s).name, checked: cur.indexOf(s) >= 0, max: ch.count });
        }).join('') + '</div>' : '<p class="wizard-note">Choose skill proficiencies first.</p>'), countBadge(cur.length, ch.count));
    });

    var lo = o.languageOptions(doc);
    html += section('Languages', '<p class="wizard-note">Known: ' + lo.known.map(function (id) { return esc(Api().getLanguage(id).name); }).join(', ') + '</p>' +
      '<div class="spell-pick-list two-col">' + lo.from.map(function (id) {
        return pickItem({ list: 'languages', val: id, label: Api().getLanguage(id).name, checked: c.languages.indexOf(id) >= 0, max: lo.count });
      }).join('') + '</div>', countBadge(c.languages.length, lo.count));
    if (lo.extra) {
      html += section('Extra language (' + lo.extra.source + ': Thieves’ Cant)',
        '<select class="form-select-dark" data-act="classOpt" data-key="extraLanguage"><option value="">Choose a language…</option>' +
        lo.extra.from.map(function (id) {
          return '<option value="' + id + '"' + (c.classOptions.extraLanguage === id ? ' selected' : '') + '>' + esc(Api().getLanguage(id).name) + '</option>';
        }).join('') + '</select>');
    }

    var tools = Object.keys(o.toolSources(doc, null)).map(function (id) { return Api().getTool(id).name; });
    if (tools.length) html += section('Tool proficiencies', '<p>' + esc(tools.join(', ')) + '</p>');
    return html;
  }

  function renderFeatOptions(doc, slot, inst) {
    var o = Opt();
    var html = '';
    var rule = o.featIncreaseRule(inst.featId);
    var key = esc(slot.key);
    if (rule && inst.featId === 'ability-score-improvement') {
      var mode = inst.asiMode || (inst.abilityIncrease && Object.keys(inst.abilityIncrease).filter(function (a) { return inst.abilityIncrease[a]; }).length === 2 ? 'split' : 'single');
      var inc = inst.abilityIncrease || {};
      var chosen = Object.keys(inc).filter(function (a) { return inc[a]; });
      html += '<div class="inline-fields"><label>Increase <select class="form-select-dark" data-act="asiMode" data-slot="' + key + '">' +
        '<option value="single"' + (mode === 'single' ? ' selected' : '') + '>One ability by 2</option>' +
        '<option value="split"' + (mode === 'split' ? ' selected' : '') + '>Two abilities by 1</option></select></label>';
      if (mode === 'single') {
        html += '<label>+2 ' + abilitySelect('asiAb', 'data-slot="' + key + '" data-idx="0"', chosen[0], rule.from) + '</label>';
      } else {
        html += '<label>+1 ' + abilitySelect('asiAb', 'data-slot="' + key + '" data-idx="0"', chosen[0], rule.from) + '</label>' +
          '<label>+1 ' + abilitySelect('asiAb', 'data-slot="' + key + '" data-idx="1"', chosen[1], rule.from.filter(function (a) { return a !== chosen[0]; })) + '</label>';
      }
      html += '</div><p class="wizard-note">This feat can’t raise a score above 20.</p>';
    } else if (rule) {
      var cur = Object.keys(inst.abilityIncrease || {})[0];
      html += '<div class="inline-fields"><label>+1 ' + abilitySelect('asiAb', 'data-slot="' + key + '" data-idx="0" data-single="1"', cur, rule.from) + '</label></div>' +
        '<p class="wizard-note">Maximum ' + rule.max + '.</p>';
    }
    if (inst.featId === 'magic-initiate') {
      var lists = o.magicInitiateLists(doc, slot);
      if (!slot.fixedSpellList) {
        html += '<div class="inline-fields"><label>Spell list <select class="form-select-dark" data-act="featOpt" data-slot="' + key + '" data-key="spellList"><option value="">Choose…</option>' +
          lists.map(function (l) { return '<option value="' + l + '"' + (inst.spellList === l ? ' selected' : '') + '>' + l.charAt(0).toUpperCase() + l.slice(1) + '</option>'; }).join('') + '</select></label></div>';
      }
      html += '<div class="inline-fields"><label>Spellcasting ability ' + abilitySelect('featOpt', 'data-slot="' + key + '" data-key="spellAbility"', inst.spellAbility, ['int', 'wis', 'cha']) + '</label></div>';
      if (inst.spellList) {
        var mo = o.magicInitiateSpellOptions(inst.spellList);
        var cs = inst.cantrips || [];
        html += '<h4 class="wizard-subtitle">Cantrips ' + countBadge(cs.length, 2) + '</h4><div class="spell-pick-list two-col">' + mo.cantrips.from.map(function (id) {
          return pickItem({ act: 'featToggle', list: 'cantrips', slot: slot.key, val: id, label: Api().getSpell(id).name, meta: Api().getSpell(id).school, checked: cs.indexOf(id) >= 0, max: 2, detailKind: 'spell' });
        }).join('') + '</div><h4 class="wizard-subtitle">Level 1 spell</h4><div class="spell-pick-list two-col">' + mo.spell1.from.map(function (id) {
          return pickItem({ act: 'featOpt', list: 'spell1', slot: slot.key, val: id, label: Api().getSpell(id).name, meta: Api().getSpell(id).school, checked: inst.spell1 === id, radio: true, detailKind: 'spell' });
        }).join('') + '</div>';
      }
    }
    if (inst.featId === 'skilled') {
      var po = o.skilledPickOptions(doc, slot.key);
      var picks = inst.picks || [];
      var has = function (type, id) { return picks.some(function (p) { return p.type === type && p.id === id; }); };
      html += '<h4 class="wizard-subtitle">Skills or tools ' + countBadge(picks.length, 3) + '</h4><div class="spell-pick-list two-col">' +
        po.skills.map(function (id) { return pickItem({ act: 'featPick', type: 'skill', list: 'picks', slot: slot.key, val: id, label: Api().getSkill(id).name, meta: 'Skill', checked: has('skill', id), max: 3 }); }).join('') +
        po.tools.map(function (id) { return pickItem({ act: 'featPick', type: 'tool', list: 'picks', slot: slot.key, val: id, label: Api().getTool(id).name, meta: 'Tool', checked: has('tool', id), max: 3 }); }).join('') +
        '</div>';
    }
    return html;
  }

  function renderFeats(doc) {
    var c = doc.choices;
    var o = Opt();
    var slots = o.featSlots(doc);
    if (!slots.length) return '<p class="wizard-note">Choose a class and background first.</p>';
    return slots.map(function (slot) {
      var inst = c.feats[slot.key] || {};
      var inner = '';
      if (slot.fixedFeatId) {
        inner += '<p class="wizard-note">Granted by your background.</p>';
      } else {
        var allowed = o.allowedFeats(doc, slot);
        inner += '<select class="form-select-dark feat-select" data-act="feat" data-slot="' + esc(slot.key) + '"><option value="">Choose a feat…</option>' +
          ['general', 'origin', 'fighting-style', 'epic-boon'].map(function (cat) {
            var group = allowed.filter(function (f) { return f.category === cat; });
            if (!group.length) return '';
            var label = { general: 'General feats', origin: 'Origin feats', 'fighting-style': 'Fighting Style feats', 'epic-boon': 'Epic Boons' }[cat];
            return '<optgroup label="' + label + '">' + group.map(function (f) {
              return '<option value="' + f.id + '"' + (inst.featId === f.id ? ' selected' : '') + '>' + esc(f.name) + '</option>';
            }).join('') + '</optgroup>';
          }).join('') + '</select>';
      }
      if (inst.featId) {
        inner += '<div class="option-detail">' + UI().featDetail(inst.featId) + '</div>' + renderFeatOptions(doc, slot, inst);
      }
      return section(slot.label, inner);
    }).join('');
  }

  function equipmentCards(options, selected, act, key) {
    return '<div class="option-grid">' + options.map(function (opt) {
      var items = opt.items.map(function (it) { return (it.count > 1 ? it.count + ' ' : '') + it.name; });
      if (opt.gp) items.push(opt.gp + ' GP');
      return card({ act: act, key: key, val: opt.id, selected: selected === opt.id, title: opt.label, body: items.join(', ') });
    }).join('') + '</div>';
  }

  function renderEquipment(doc) {
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    var bg = Api().getBackground(c.backgroundId);
    var html = '';
    if (cls) html += section(cls.name + ' starting equipment', equipmentCards(cls.equipmentOptions, c.classEquipment, 'pick', 'classEquipment'));
    if (bg) html += section(bg.name + ' background equipment', equipmentCards(bg.equipmentOptions, c.backgroundEquipment, 'pick', 'backgroundEquipment'));
    var wm = Opt().weaponMasteryOptions(doc);
    if (wm) {
      html += section('Weapon Mastery', '<p class="wizard-note">You can use the mastery property of these kinds of weapons. You can change them after a Long Rest.</p><div class="spell-pick-list two-col">' +
        wm.from.map(function (id) {
          var w = Api().getWeapon(id);
          return pickItem({ list: 'weaponMasteries', val: id, label: w.name, meta: w.mastery + ' · ' + w.damage + ' ' + w.damageType, checked: c.weaponMasteries.indexOf(id) >= 0, max: wm.count, detailKind: 'weapon' });
        }).join('') + '</div>', countBadge(c.weaponMasteries.length, wm.count));
    }
    if (!cls && !bg) html = '<p class="wizard-note">Choose a class and background first.</p>';
    return html;
  }

  function spellListByLevel(ids, render) {
    var byLevel = {};
    ids.forEach(function (id) {
      var sp = Api().getSpell(id);
      if (sp) (byLevel[sp.level] = byLevel[sp.level] || []).push(sp);
    });
    return Object.keys(byLevel).sort(function (a, b) { return a - b; }).map(function (l) {
      return '<h4 class="wizard-subtitle">' + UI().ordinalLevel(Number(l)) + '</h4><div class="spell-pick-list two-col">' +
        byLevel[l].sort(function (a, b) { return a.name.localeCompare(b.name); }).map(render).join('') + '</div>';
    }).join('');
  }

  function spellMetaShort(sp) {
    return sp.school + (sp.concentration ? ' · C' : '') + (sp.ritual ? ' · R' : '');
  }

  function renderSpells(doc) {
    var c = doc.choices;
    var so = Opt().spellOptions(doc);
    if (!so) return '<p class="wizard-note">Your class doesn’t cast spells.</p>';
    var d = global.FogDeriveCharacter(doc);
    var s = c.spells;
    var slotText = so.slots.map(function (n, i) { return n ? 'L' + (i + 1) + ': ' + n : null; }).filter(Boolean).join(' · ');
    var html = '<div class="option-detail"><dl class="rules-meta">' +
      '<div><dt>Spellcasting ability</dt><dd>' + esc(UI().abilityName(so.ability)) + '</dd></div>' +
      '<div><dt>Spell save DC</dt><dd>' + d.spellcasting.saveDC + '</dd></div>' +
      '<div><dt>Spell attack</dt><dd>' + UI().signed(d.spellcasting.attackBonus) + '</dd></div>' +
      '<div><dt>Spell slots</dt><dd>' + esc(slotText) + '</dd></div></dl></div>' +
      '<input type="search" class="form-control-dark spell-filter" placeholder="Filter spells by name or school…" aria-label="Filter spells">';

    html += section('Cantrips', '<div class="spell-pick-list two-col">' + so.cantrips.from.map(function (id) {
      var sp = Api().getSpell(id);
      return pickItem({ list: 'spells.cantrips', val: id, label: sp.name, meta: spellMetaShort(sp), checked: s.cantrips.indexOf(id) >= 0, max: so.cantrips.count, detailKind: 'spell' });
    }).join('') + '</div>', countBadge(s.cantrips.length, so.cantrips.count));

    if (so.spellbook) {
      var limits = so.spellbook.limits.map(function (l) { return 'at most ' + l.max + ' of level ' + l.spellLevel + '+'; }).join(', ');
      html += section('Spellbook', '<p class="wizard-note">Your spellbook starts with six level 1 spells and gains two spells per Wizard level, each of a level you had slots for. ' +
        (limits ? 'At level ' + c.level + ' that means ' + esc(limits) + '.' : '') + '</p>' +
        spellListByLevel(so.spellbook.from, function (sp) {
          return pickItem({ list: 'spells.spellbook', val: sp.id, label: sp.name, meta: spellMetaShort(sp), checked: s.spellbook.indexOf(sp.id) >= 0, max: so.spellbook.count, detailKind: 'spell' });
        }), countBadge(s.spellbook.length, so.spellbook.count));
      if (so.spellMastery) {
        html += section('Spell Mastery (level 18)', '<p class="wizard-note">One level 1 and one level 2 spell from your spellbook with a casting time of an action. Always prepared; cast at their lowest level without a slot.</p>' +
          (so.spellMastery.from.length ? spellListByLevel(so.spellMastery.from, function (sp) {
            return pickItem({ list: 'spells.spellMastery', val: sp.id, label: sp.name, meta: spellMetaShort(sp), checked: s.spellMastery.indexOf(sp.id) >= 0, max: 2, detailKind: 'spell' });
          }) : '<p class="wizard-note">Add level 1 and 2 spells with a casting time of an action to your spellbook first.</p>'), countBadge(s.spellMastery.length, 2));
      }
      if (so.signature) {
        html += section('Signature Spells (level 20)', '<p class="wizard-note">Two level 3 spells from your spellbook. Always prepared; each can be cast once at level 3 without a slot per Short or Long Rest.</p>' +
          (so.signature.from.length ? spellListByLevel(so.signature.from, function (sp) {
            return pickItem({ list: 'spells.signature', val: sp.id, label: sp.name, meta: spellMetaShort(sp), checked: s.signature.indexOf(sp.id) >= 0, max: so.signature.count, detailKind: 'spell' });
          }) : '<p class="wizard-note">Add level 3 spells to your spellbook first.</p>'), countBadge(s.signature.length, so.signature.count));
      }
    }

    if (so.alwaysPrepared.length) {
      html += section('Always prepared', '<p class="wizard-note">Granted by your subclass; they don’t count against your prepared spells.</p><p>' +
        esc(so.alwaysPrepared.map(function (id) { return Api().getSpell(id).name; }).join(', ')) + '</p>');
    }

    html += section('Prepared spells', so.prepared.from.length
      ? spellListByLevel(so.prepared.from, function (sp) {
        return pickItem({ list: 'spells.prepared', val: sp.id, label: sp.name, meta: spellMetaShort(sp), checked: s.prepared.indexOf(sp.id) >= 0, max: so.prepared.count, detailKind: 'spell' });
      })
      : '<p class="wizard-note">Add spells to your spellbook first.</p>', countBadge(s.prepared.length, so.prepared.count));
    return html;
  }

  function renderDetails(doc) {
    var n = doc.narrative;
    var field = function (key, label, rows, hint) {
      return '<label class="form-label" for="nar-' + key + '">' + esc(label) + '</label>' +
        (rows ? '<textarea id="nar-' + key + '" class="form-control-dark" rows="' + rows + '" data-narr="' + key + '">' + esc(n[key]) + '</textarea>'
          : '<input id="nar-' + key + '" type="text" class="form-control-dark" maxlength="80" data-narr="' + key + '" value="' + esc(n[key]) + '">') +
        (hint ? '<p class="wizard-note">' + esc(hint) + '</p>' : '');
    };
    return (
      '<div class="details-grid"><div class="details-portrait">' +
      '<div class="portrait-frame">' + UI().portraitHtml(n.portraitDataUrl) + '</div>' +
      '<label class="btn btn-secondary btn-sm portrait-upload">Upload portrait<input type="file" accept="image/png,image/jpeg,image/webp" data-act="portrait" hidden></label>' +
      (n.portraitDataUrl ? '<button type="button" class="btn-back" data-act="portrait-remove">Remove portrait</button>' : '') +
      '<p class="wizard-note">Resized to 256px and stored in this browser.</p><p class="wizard-note portrait-error" role="alert" hidden></p></div>' +
      '<div class="details-fields">' +
      field('name', 'Character name (required)') +
      '<label class="form-label" for="nar-alignment">Alignment</label><select id="nar-alignment" class="form-select-dark" data-narr="alignment"><option value="">Not chosen</option>' +
      Api().rules().alignments.map(function (a) { return '<option' + (n.alignment === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select>' +
      field('appearance', 'Appearance', 3) +
      field('personalityTraits', 'Personality traits', 2) +
      field('ideals', 'Ideals', 2) +
      field('bonds', 'Bonds', 2) +
      field('flaws', 'Flaws', 2) +
      field('backstory', 'Backstory', 6) +
      '</div></div>'
    );
  }

  function renderReview(doc, steps) {
    var c = doc.choices;
    var d = global.FogDeriveCharacter(doc);
    var errors = Val().validateComplete(doc);
    var cls = Api().getClass(c.classId);
    var sp = Api().getSpecies(c.speciesId);
    var bg = Api().getBackground(c.backgroundId);
    var html = '';
    if (errors.length) {
      html += '<div class="wizard-errors"><strong>Before you can save:</strong><ul>' + errors.map(function (e) {
        return '<li><button type="button" class="link-btn" data-act="goto" data-step="' + e.step + '">' + esc(STEP_INFO[e.step].title) + '</button>: ' + esc(e.message) + '</li>';
      }).join('') + '</ul></div>';
    } else {
      html += '<div class="wizard-success">Everything is complete. Save to add this character to your roster.</div>';
    }
    var row = function (label, value, step) {
      return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value || '—') + (step ? ' <button type="button" class="link-btn" data-act="goto" data-step="' + step + '">Change</button>' : '') + '</dd></div>';
    };
    html += '<dl class="rules-meta review-list">' +
      row('Name', doc.narrative.name, 'details') +
      row('Level', String(c.level), 'level') +
      row('Class', cls ? cls.name + (c.subclassId ? ' (' + cls.subclass.name + ')' : '') : null, 'class') +
      row('Background', bg && bg.name, 'background') +
      row('Species', sp && sp.name, 'species') +
      row('Abilities', Api().rules().abilities.map(function (a) { return UI().abilityShort(a) + ' ' + d.abilities[a].score; }).join(' · '), 'abilities') +
      row('Hit Points', d.combat.hpMax != null ? String(d.combat.hpMax) : null) +
      row('Armor Class', String(d.combat.ac)) +
      row('Skills', Object.values(d.skills).filter(function (s) { return s.proficient; }).map(function (s) { return s.name + (s.expertise ? ' (Expertise)' : ''); }).join(', '), 'proficiencies') +
      row('Languages', d.proficiencies.languages.join(', '), 'proficiencies') +
      row('Feats', Opt().featSlots(doc).map(function (s) { var f = c.feats[s.key]; return f && Api().getFeat(f.featId) ? Api().getFeat(f.featId).name : null; }).filter(Boolean).join(', '), 'feats') +
      row('Equipment', d.inventory.map(function (i) { return (i.count > 1 ? i.count + ' ' : '') + i.name; }).concat(d.gold ? [d.gold + ' GP'] : []).join(', '), 'equipment') +
      (d.spellcasting ? row('Spells', d.spellcasting.cantrips.length + ' cantrips, ' + d.spellcasting.prepared.length + ' prepared', 'spells') : '') +
      '</dl>';
    if (d.limitations.length) {
      html += '<div class="wizard-note-box"><strong>Notes</strong><ul>' + d.limitations.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>';
    }
    html += '<div class="review-actions"><button type="button" class="btn btn-primary" data-act="save"' + (errors.length ? ' disabled' : '') + '>Save character</button></div>';
    void steps;
    return html;
  }

  function renderPreview(doc) {
    var d = global.FogDeriveCharacter(doc);
    var c = doc.choices;
    var cls = Api().getClass(c.classId);
    var sp = Api().getSpecies(c.speciesId);
    var bg = Api().getBackground(c.backgroundId);
    return (
      '<div class="preview-portrait">' + UI().portraitHtml(doc.narrative.portraitDataUrl) + '</div>' +
      '<h3>' + esc(doc.narrative.name || 'Unnamed character') + '</h3>' +
      '<p class="preview-sub">Level ' + c.level + (cls ? ' ' + esc(cls.name) : '') + (sp ? ' · ' + esc(sp.name) : '') + (bg ? ' · ' + esc(bg.name) : '') + '</p>' +
      '<dl class="preview-stats">' +
      '<div><dt>HP</dt><dd>' + (d.combat.hpMax != null ? d.combat.hpMax : '—') + '</dd></div>' +
      '<div><dt>AC</dt><dd>' + d.combat.ac + '</dd></div>' +
      '<div><dt>Speed</dt><dd>' + d.combat.speed + ' ft.</dd></div>' +
      '<div><dt>Prof.</dt><dd>' + UI().signed(d.proficiencyBonus) + '</dd></div>' +
      '<div><dt>Init.</dt><dd>' + UI().signed(d.combat.initiative) + '</dd></div>' +
      (d.spellcasting ? '<div><dt>Spell DC</dt><dd>' + d.spellcasting.saveDC + '</dd></div>' : '') +
      '</dl><div class="preview-abilities">' + Api().rules().abilities.map(function (a) {
        return '<div><span>' + UI().abilityShort(a) + '</span><strong>' + d.abilities[a].score + '</strong><em>' + UI().signed(d.abilities[a].modifier) + '</em></div>';
      }).join('') + '</div>'
    );
  }

  var RENDERERS = {
    level: renderLevel, class: renderClass, background: renderBackground, species: renderSpecies,
    abilities: renderAbilities, proficiencies: renderProficiencies, feats: renderFeats,
    equipment: renderEquipment, spells: renderSpells, details: renderDetails, review: renderReview,
  };

  // ---------------------------------------------------------------------------
  // Controller
  // ---------------------------------------------------------------------------
  function start(container, params, mode) {
    var root = container.querySelector('#character-wizard-root');
    var stored = mode === 'edit' ? Store().get(params.id) : Store().get(params.draftId);

    if (!stored) {
      root.innerHTML = '<div class="page-error-panel"><h2>Character not found</h2><p>This character doesn’t exist in this browser. It may have been deleted.</p>' +
        '<button type="button" class="btn btn-primary" data-act="exit">Back to Characters</button></div>';
      root.querySelector('[data-act="exit"]').addEventListener('click', function () { global.FogDashboardRouter.navigateTo('#characters'); });
      return null;
    }
    if (mode === 'create' && stored.status === 'complete') {
      global.FogDashboardRouter.navigateTo('#characters/' + stored.id + '/edit', true);
      return null;
    }
    if (mode === 'edit' && stored.status !== 'complete') {
      global.FogDashboardRouter.navigateTo('#characters/new/' + stored.id, true);
      return null;
    }

    // Working document: drafts are edited directly; saved characters through an edit copy.
    var doc = clone(stored);
    var notices = [];
    if (mode === 'edit') {
      if (stored.editDraft) {
        doc.choices = clone(stored.editDraft.choices);
        doc.narrative = clone(stored.editDraft.narrative);
        notices.push('Resumed your unsaved edits. Save changes to apply them, or Discard edits to go back to the saved character.');
      }
      root.querySelector('.page-title').textContent = 'Edit Character';
      root.querySelector('#wizard-exit').textContent = 'Back to sheet';
      root.querySelector('#wizard-exit').setAttribute('data-fog-nav', '#characters/' + stored.id);
    }
    if (doc.migrationNotice) notices.push(doc.migrationNotice);
    notices = notices.concat(Val().sanitizeChoices(doc));

    var stepList = root.querySelector('#wizard-step-list');
    var body = root.querySelector('#wizard-step-body');
    var errorsEl = root.querySelector('#wizard-errors');
    var preview = root.querySelector('#wizard-preview');
    var btnBack = root.querySelector('#wizard-back');
    var btnNext = root.querySelector('#wizard-next');
    var tipsToggle = root.querySelector('#wizard-guided-mode');
    var tips = readTips();
    tipsToggle.checked = tips;

    var steps = Opt().stepsFor(doc);
    var current = Math.max(0, steps.indexOf(doc.wizard && doc.wizard.currentStepId));
    var saveTimer = null;
    var saveError = null;

    function persist() {
      doc.wizard = doc.wizard || {};
      doc.wizard.currentStepId = steps[current];
      var res;
      if (mode === 'edit') {
        var latest = Store().get(stored.id);
        if (!latest) return;
        latest.editDraft = { choices: doc.choices, narrative: doc.narrative, updatedAt: new Date().toISOString() };
        res = Store().save(latest);
      } else {
        res = Store().save(doc);
      }
      saveError = res.ok ? null : res.message;
    }

    function persistSoon() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        persist();
        renderPreviewOnly();
      }, 400);
    }

    function reachable(i) {
      for (var k = 0; k < i; k++) {
        if (steps[k] !== 'review' && Val().validateStep(doc, steps[k]).length) return false;
      }
      return true;
    }

    function renderSteps() {
      stepList.innerHTML = steps.map(function (id, i) {
        var done = Val().validateStep(doc, id).length === 0 && id !== 'review';
        var can = i <= current || reachable(i);
        return '<button type="button" class="wizard-step-item' + (i === current ? ' is-current' : '') + (done ? ' is-done' : '') + '"' +
          ' data-act="goto" data-step="' + id + '"' + (can ? '' : ' disabled') + (i === current ? ' aria-current="step"' : '') + '>' +
          '<span class="step-num">' + (i + 1) + '</span> ' + esc(STEP_INFO[id].title) + (done ? ' <span class="step-check" aria-label="complete">✓</span>' : '') + '</button>';
      }).join('');
    }

    function renderPreviewOnly() {
      preview.innerHTML = renderPreview(doc) + (saveError ? '<p class="wizard-save-error" role="alert">' + esc(saveError) + '</p>' : '');
    }

    function render(keepScroll) {
      steps = Opt().stepsFor(doc);
      if (current >= steps.length) current = steps.length - 1;
      var id = steps[current];
      var info = STEP_INFO[id];
      var scrollY = global.scrollY;
      body.innerHTML =
        '<h2>' + esc(info.title) + '</h2><p class="wizard-step-intro">' + esc(info.intro) + '</p>' +
        (tips && info.tip ? '<div class="wizard-guided-tip">' + esc(info.tip) + '</div>' : '') +
        (notices.length ? '<div class="wizard-notices" role="status"><ul>' + notices.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul><button type="button" class="link-btn" data-act="dismiss">Dismiss</button></div>' : '') +
        RENDERERS[id](doc, steps);
      errorsEl.hidden = true;
      btnBack.disabled = current === 0;
      btnNext.hidden = id === 'review';
      btnNext.textContent = current === steps.length - 2 ? 'Review' : 'Continue';
      btnBack.textContent = 'Back';
      if (mode === 'edit' && id === 'review') {
        var save = body.querySelector('[data-act="save"]');
        if (save) {
          save.textContent = 'Save changes';
          save.insertAdjacentHTML('afterend', ' <button type="button" class="btn btn-secondary" data-act="discard">Discard edits</button>');
        }
      }
      renderSteps();
      renderPreviewOnly();
      if (keepScroll) global.scrollTo(0, scrollY);
    }

    function showErrors(list) {
      if (!list.length) {
        errorsEl.hidden = true;
        return;
      }
      errorsEl.innerHTML = '<ul>' + list.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>';
      errorsEl.hidden = false;
    }

    /** Apply a change, re-validate dependent choices, save, re-render the current step. */
    function change(fn) {
      fn(doc.choices);
      var removed = Val().sanitizeChoices(doc);
      notices = removed;
      persist();
      render(true);
    }

    function goTo(i) {
      current = Math.max(0, Math.min(steps.length - 1, i));
      notices = [];
      persist();
      render(false);
      global.scrollTo(0, 0);
      var h = body.querySelector('h2');
      if (h) {
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    }

    function toggleIn(listPath, val, max, radio) {
      change(function (c) {
        var list = (getPath(c, listPath) || []).slice();
        var i = list.indexOf(val);
        if (i >= 0) list.splice(i, 1);
        else if (radio || max === 1) list = [val];
        else if (max == null || list.length < max) list.push(val);
        else {
          notices = ['You can choose ' + max + '. Remove one first.'];
          return;
        }
        setPath(c, listPath, list);
      });
    }

    function featInst(c, slot) {
      c.feats[slot] = c.feats[slot] || {};
      return c.feats[slot];
    }

    function onClick(e) {
      var t = e.target.closest('[data-act]');
      if (!t || !root.contains(t) || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'button')) return;
      var act = t.getAttribute('data-act');
      var key = t.getAttribute('data-key');
      var val = t.getAttribute('data-val');
      var slot = t.getAttribute('data-slot');
      switch (act) {
        case 'pick':
          change(function (c) {
            var v = key === 'level' ? Number(val) : val;
            c[key] = c[key] === v && key !== 'level' && key !== 'abilityMethod' ? (key === 'subclassId' ? null : v) : v;
            if (key === 'abilityMethod' && val === 'point-buy') {
              Api().rules().abilities.forEach(function (ab) {
                if (typeof c.abilityScoresBase[ab] !== 'number' || c.abilityScoresBase[ab] < 8 || c.abilityScoresBase[ab] > 15) c.abilityScoresBase[ab] = 8;
              });
            }
          });
          break;
        case 'classOpt':
          change(function (c) { c.classOptions[key] = val; });
          break;
        case 'speciesOpt':
          change(function (c) { c.speciesOptions[key] = val; });
          break;
        case 'bgMode':
          change(function (c) { c.backgroundIncrease = { mode: val, plus2: c.backgroundIncrease.plus2 || null, plus1: c.backgroundIncrease.plus1 || null }; });
          break;
        case 'pb':
          change(function (c) {
            var m = Api().rules().abilityMethods['point-buy'];
            var ab = t.getAttribute('data-ab');
            var v = (typeof c.abilityScoresBase[ab] === 'number' ? c.abilityScoresBase[ab] : 8) + Number(t.getAttribute('data-delta'));
            c.abilityScoresBase[ab] = Math.max(m.min, Math.min(m.max, v));
          });
          break;
        case 'roll':
          change(function (c) {
            Api().rules().abilities.forEach(function (ab) {
              var dice = [0, 0, 0, 0].map(function () { return 1 + Math.floor(Math.random() * 6); }).sort(function (a, b) { return a - b; });
              c.abilityScoresBase[ab] = dice[1] + dice[2] + dice[3];
            });
          });
          break;
        case 'goto':
          var idx = steps.indexOf(t.getAttribute('data-step'));
          if (idx >= 0) goTo(idx);
          break;
        case 'detail':
          var holder = t.nextElementSibling;
          var open = holder.hidden;
          if (open && !holder.innerHTML) {
            var kind = t.getAttribute('data-kind');
            var id = t.getAttribute('data-id');
            holder.innerHTML = kind === 'spell' ? UI().spellDetail(id) : kind === 'weapon' ? UI().masteryDetail(Api().getWeapon(id)) : '';
          }
          holder.hidden = !open;
          t.setAttribute('aria-expanded', String(open));
          t.textContent = open ? 'Hide' : 'Details';
          break;
        case 'dismiss':
          notices = [];
          render(true);
          break;
        case 'portrait-remove':
          Store().setPortrait(doc, null);
          persist();
          render(true);
          break;
        case 'save':
          saveCharacter();
          break;
        case 'discard':
          if (confirm('Discard your unsaved edits?')) {
            var latest = Store().get(stored.id);
            delete latest.editDraft;
            Store().save(latest);
            global.FogDashboardRouter.navigateTo('#characters/' + stored.id);
          }
          break;
        default:
          void key;
          void slot;
      }
    }

    function onChange(e) {
      var t = e.target;
      var act = t.getAttribute('data-act');
      if (!act && !t.hasAttribute('data-narr')) return;
      var slot = t.getAttribute('data-slot');
      var v = t.value;
      if (t.hasAttribute('data-narr')) {
        doc.narrative[t.getAttribute('data-narr')] = v;
        persist();
        renderSteps();
        renderPreviewOnly();
        return;
      }
      switch (act) {
        case 'toggle':
          toggleIn(t.getAttribute('data-list'), t.getAttribute('data-val'), t.hasAttribute('data-max') ? Number(t.getAttribute('data-max')) : null);
          break;
        case 'set':
          change(function () { setPath(doc, t.getAttribute('data-path'), v || null); });
          break;
        case 'classOpt':
          change(function (c) { if (v) c.classOptions[t.getAttribute('data-key')] = v; else delete c.classOptions[t.getAttribute('data-key')]; });
          break;
        case 'speciesOpt':
          change(function (c) { if (v) c.speciesOptions[t.getAttribute('data-key')] = v; else delete c.speciesOptions[t.getAttribute('data-key')]; });
          break;
        case 'score':
          change(function (c) {
            var n = parseInt(v, 10);
            c.abilityScoresBase[t.getAttribute('data-ab')] = isNaN(n) ? null : n;
          });
          break;
        case 'bgInc':
          change(function (c) {
            c.backgroundIncrease[t.getAttribute('data-which')] = v || null;
            if (c.backgroundIncrease.plus1 === c.backgroundIncrease.plus2) c.backgroundIncrease.plus1 = null;
          });
          break;
        case 'feat':
          change(function (c) {
            if (!v) delete c.feats[slot];
            else c.feats[slot] = { featId: v };
          });
          break;
        case 'asiMode':
          change(function (c) {
            var inst = featInst(c, slot);
            inst.asiMode = v;
            inst.abilityIncrease = {};
          });
          break;
        case 'asiAb':
          change(function (c) {
            var inst = featInst(c, slot);
            var single = t.hasAttribute('data-single');
            var mode = single ? 'boon' : inst.asiMode || 'single';
            var chosen = Object.keys(inst.abilityIncrease || {}).filter(function (a) { return inst.abilityIncrease[a]; });
            chosen[Number(t.getAttribute('data-idx'))] = v;
            chosen = chosen.filter(Boolean);
            inst.abilityIncrease = {};
            if (mode === 'single' || single) {
              if (v) inst.abilityIncrease[v] = single ? 1 : 2;
            } else {
              chosen.filter(function (a, i) { return chosen.indexOf(a) === i; }).slice(0, 2).forEach(function (a) { inst.abilityIncrease[a] = 1; });
            }
          });
          break;
        case 'featOpt':
          change(function (c) {
            var inst = featInst(c, slot);
            var k = t.getAttribute('data-key') || t.getAttribute('data-list');
            inst[k] = t.type === 'radio' ? t.getAttribute('data-val') : v || null;
            if (k === 'spellList') {
              inst.cantrips = [];
              inst.spell1 = null;
            }
          });
          break;
        case 'featToggle':
          change(function (c) {
            var inst = featInst(c, slot);
            var list = (inst.cantrips || []).slice();
            var id = t.getAttribute('data-val');
            var i = list.indexOf(id);
            if (i >= 0) list.splice(i, 1);
            else if (list.length < 2) list.push(id);
            else notices = ['Magic Initiate gives exactly two cantrips. Remove one first.'];
            inst.cantrips = list;
          });
          break;
        case 'featPick':
          change(function (c) {
            var inst = featInst(c, slot);
            var picks = (inst.picks || []).slice();
            var type = t.getAttribute('data-type');
            var id = t.getAttribute('data-val');
            var i = picks.findIndex(function (p) { return p.type === type && p.id === id; });
            if (i >= 0) picks.splice(i, 1);
            else if (picks.length < 3) picks.push({ type: type, id: id });
            else notices = ['Skilled gives three proficiencies. Remove one first.'];
            inst.picks = picks;
          });
          break;
        case 'portrait':
          var file = t.files && t.files[0];
          if (!file) return;
          var errEl = body.querySelector('.portrait-error');
          Store().compressPortrait(file).then(function (url) {
            var res = Store().setPortrait(doc, url);
            if (!res.ok) throw new Error(res.message);
            persist();
            render(true);
          }).catch(function (err) {
            if (errEl) {
              errEl.textContent = err.message;
              errEl.hidden = false;
            }
          });
          break;
        default:
      }
    }

    function onInput(e) {
      var t = e.target;
      if (t.classList.contains('spell-filter')) {
        var q = t.value.trim().toLowerCase();
        body.querySelectorAll('.spell-pick-item').forEach(function (item) {
          item.hidden = q && item.getAttribute('data-filter-text').indexOf(q) < 0;
        });
        return;
      }
      if (t.hasAttribute('data-narr') && t.tagName !== 'SELECT') {
        doc.narrative[t.getAttribute('data-narr')] = t.value;
        persistSoon();
      }
    }

    function saveCharacter() {
      clearTimeout(saveTimer);
      var errors = Val().validateComplete(doc);
      if (errors.length) {
        render(true);
        return;
      }
      var res;
      if (mode === 'edit') {
        var latest = Store().get(stored.id);
        latest.choices = doc.choices;
        latest.narrative = doc.narrative;
        delete latest.editDraft;
        delete latest.migrationNotice;
        latest.status = 'complete';
        res = Store().save(latest);
      } else {
        doc.status = 'complete';
        delete doc.migrationNotice;
        doc.wizard.completedStepIds = steps.slice();
        res = Store().save(doc);
      }
      if (!res.ok) {
        if (mode !== 'edit') doc.status = 'draft';
        showErrors([{ message: res.message }]);
        return;
      }
      global.FogDashboardRouter.navigateTo('#characters/' + stored.id);
    }

    btnBack.addEventListener('click', function () { goTo(current - 1); });
    btnNext.addEventListener('click', function () {
      var errs = Val().validateStep(doc, steps[current]);
      if (errs.length) {
        showErrors(errs);
        errorsEl.scrollIntoView({ block: 'nearest' });
        return;
      }
      goTo(current + 1);
    });
    tipsToggle.addEventListener('change', function () {
      tips = tipsToggle.checked;
      writeTips(tips);
      render(true);
    });
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);

    persist();
    render(false);

    return function cleanup() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        persist();
      }
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.characterCreate = function (container, params) { return start(container, params, 'create'); };
  global.FogPageInits.characterEdit = function (container, params) { return start(container, params, 'edit'); };
})(window);
