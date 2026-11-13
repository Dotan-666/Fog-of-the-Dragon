/**
 * Character sheet → PDF download.
 *
 * Builds a printable, text-based PDF (selectable text, white background) from the same derived data the sheet
 * shows (FogDeriveCharacter); nothing is recomputed here. jsPDF (MIT) is loaded from jsDelivr only when the
 * player clicks "Export PDF", pinned to an exact version with Subresource Integrity.
 *
 * FogCharacterPdf.exportPdf(doc)        → Promise<{ ok, fileName } | { ok:false, message }>
 * FogCharacterPdf.build(doc, jsPDF, o)  → jsPDF document (used by exportPdf and by the tests)
 */
(function (global) {
  'use strict';

  var JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
  var JSPDF_SRI = 'sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/';
  var loading = null;

  var Api = function () { return global.FogRulesApi; };
  var UI = function () { return global.FogCharacterUI; };

  var C = { ink: [24, 20, 22], muted: [105, 98, 100], line: [200, 190, 192], accent: [139, 21, 35], fill: [247, 242, 242] };

  function loadJsPdf() {
    if (global.jspdf && global.jspdf.jsPDF) return Promise.resolve(global.jspdf.jsPDF);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = JSPDF_URL;
      s.integrity = JSPDF_SRI;
      s.crossOrigin = 'anonymous';
      s.onload = function () {
        if (global.jspdf && global.jspdf.jsPDF) resolve(global.jspdf.jsPDF);
        else reject(new Error('The PDF library did not load correctly.'));
      };
      s.onerror = function () {
        loading = null;
        reject(new Error('Could not download the PDF library. Check your connection and try again.'));
      };
      document.head.appendChild(s);
    });
    return loading;
  }

  /** The standard PDF fonts only cover Latin-1: replace typographic characters, drop the rest. */
  function clean(s) {
    return String(s == null ? '' : s)
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—−]/g, '-')
      .replace(/→/g, '->')
      .replace(/…/g, '...')
      .replace(/[•●]/g, '-')
      .replace(/ /g, ' ')
      .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, '');
  }

  /** SRD markdown → plain paragraphs (bold/italic markers removed, list items kept as "- "). */
  function plain(text) {
    return clean(text)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:)!?]|$)/gm, '$1$2')
      .replace(/^>\s?/gm, '')
      .split(/\n{2,}|\n(?=[-] )|\n/)
      .map(function (l) { return l.trim(); })
      .filter(Boolean);
  }

  function signed(n) {
    return clean(UI() ? UI().signed(n) : (n >= 0 ? '+' : '') + n); // the sheet uses a real minus sign (U+2212)
  }

  function build(doc, JsPDF, options) {
    var o = options || {};
    var d = global.FogDeriveCharacter(doc);
    var c = doc.choices;
    var n = doc.narrative || {};
    var cls = Api().getClass(c.classId);
    var sp = Api().getSpecies(c.speciesId);
    var bg = global.FogCharacterOptions.backgroundOf(doc);
    var sub = global.FogCharacterOptions.subclassAvailable(doc) ? global.FogCharacterOptions.currentSubclass(doc) : null;
    var abilities = Api().rules().abilities;

    var pdf = new JsPDF({ unit: 'pt', format: o.format || 'a4', compress: o.compress !== false });
    var W = pdf.internal.pageSize.getWidth();
    var H = pdf.internal.pageSize.getHeight();
    var M = 40;
    var CW = W - 2 * M;
    var y = M;
    var name = clean(n.name || 'Unnamed character');

    pdf.setProperties({ title: name + ' - Character Sheet', subject: 'D&D 5E (SRD 5.2.1) character', creator: 'Fog of the Dragon' });

    function color(rgb) { pdf.setTextColor(rgb[0], rgb[1], rgb[2]); }
    function font(style, size) { pdf.setFont('helvetica', style || 'normal'); pdf.setFontSize(size || 9.5); }
    function lineH(size) { return (size || 9.5) * 1.3; }

    function footer() {
      font('normal', 7.5);
      color(C.muted);
      pdf.text(name + ' - Level ' + c.level + ' ' + clean(cls.name), M, H - 22);
      pdf.text('Page ' + pdf.internal.getNumberOfPages(), W - M, H - 22, { align: 'right' });
    }
    function newPage() {
      footer();
      pdf.addPage();
      y = M;
    }
    function need(h) {
      if (y + h > H - M - 10) newPage();
    }
    function heading(text) {
      need(62); // keep a heading together with the start of its section
      y += 8;
      pdf.setFont('times', 'bold');
      pdf.setFontSize(13);
      color(C.accent);
      pdf.text(clean(text).toUpperCase(), M, y + 10);
      pdf.setDrawColor(C.accent[0], C.accent[1], C.accent[2]);
      pdf.setLineWidth(0.8);
      pdf.line(M, y + 15, M + CW, y + 15);
      y += 24;
    }
    /** Wrapped text at x with width w; breaks across pages. */
    function para(text, opt) {
      opt = opt || {};
      var size = opt.size || 9.5;
      var x = M + (opt.indent || 0);
      var w = opt.width || CW - (opt.indent || 0);
      font(opt.bold ? 'bold' : opt.italic ? 'italic' : 'normal', size);
      color(opt.color || C.ink);
      var lines = pdf.splitTextToSize(clean(text), w);
      lines.forEach(function (l) {
        need(lineH(size));
        pdf.text(l, x, y + size);
        y += lineH(size);
      });
      y += opt.after != null ? opt.after : 2;
    }
    /** "Label: value" with a bold label, wrapped. */
    function labelled(label, value, opt) {
      opt = opt || {};
      var size = opt.size || 9.5;
      font('bold', size);
      var lw = pdf.getTextWidth(clean(label) + ' ');
      font('normal', size);
      var lines = pdf.splitTextToSize(clean(value), CW - lw - (opt.indent || 0));
      need(lineH(size));
      font('bold', size);
      color(C.ink);
      pdf.text(clean(label), M + (opt.indent || 0), y + size);
      font('normal', size);
      lines.forEach(function (l, i) {
        if (i) need(lineH(size));
        pdf.text(l, M + (opt.indent || 0) + lw, y + size);
        y += lineH(size);
      });
      y += 1;
    }
    function rulesBlock(text, indent) {
      plain(text).forEach(function (p) { para(p, { size: 8.5, indent: indent || 10, color: [60, 54, 56], after: 1.5 }); });
    }
    function box(x, by, w, h, fill) {
      pdf.setDrawColor(C.line[0], C.line[1], C.line[2]);
      pdf.setLineWidth(0.6);
      if (fill) pdf.setFillColor(C.fill[0], C.fill[1], C.fill[2]);
      pdf.roundedRect(x, by, w, h, 4, 4, fill ? 'FD' : 'S');
    }

    // ---- Header -------------------------------------------------------------
    var portrait = n.portraitDataUrl;
    var imgW = 0;
    if (portrait && /^data:image\/(jpeg|png);base64,/.test(portrait)) {
      try {
        pdf.addImage(portrait, /png/.test(portrait.slice(0, 20)) ? 'PNG' : 'JPEG', M, y, 72, 72);
        imgW = 84;
      } catch (e) { imgW = 0; }
    }
    pdf.setFont('times', 'bold');
    pdf.setFontSize(22);
    color(C.ink);
    pdf.text(name, M + imgW, y + 22);
    font('normal', 10.5);
    color(C.muted);
    var idLine = 'Level ' + c.level + ' ' + cls.name + (sub ? ' (' + sub.name + ')' : '') + '  -  ' + sp.name + '  -  ' + bg.name + ' background' + (n.alignment ? '  -  ' + n.alignment : '');
    pdf.splitTextToSize(clean(idLine), CW - imgW).forEach(function (l, i) { pdf.text(l, M + imgW, y + 40 + i * 13); });
    font('normal', 8);
    pdf.text('D&D 5E 2024 rules (SRD 5.2.1) - exported ' + new Date().toISOString().slice(0, 10), M + imgW, y + 66);
    y += imgW ? 84 : 76;

    // ---- Core numbers ---------------------------------------------------------
    var stats = [
      ['Armor Class', String(d.combat.ac)], ['Hit Points', String(d.combat.hpMax)], ['Initiative', signed(d.combat.initiative)],
      ['Speed', d.combat.speed + ' ft.'], ['Proficiency', signed(d.proficiencyBonus)], ['Hit Dice', d.combat.hitDice || '-'],
      ['Passive Perc.', String(d.passivePerception)], ['Size', d.combat.size || '-'],
    ];
    var sw = CW / stats.length;
    stats.forEach(function (s, i) {
      var x = M + i * sw;
      box(x + 2, y, sw - 4, 44, true);
      font('normal', 6.5);
      color(C.muted);
      pdf.text(s[0].toUpperCase(), x + sw / 2, y + 12, { align: 'center' });
      font('bold', 14);
      color(C.ink);
      pdf.text(clean(s[1]), x + sw / 2, y + 33, { align: 'center' });
    });
    y += 56;

    // ---- Abilities + saves -------------------------------------------------------
    var aw = CW / 6;
    abilities.forEach(function (ab, i) {
      var a = d.abilities[ab];
      var s = d.savingThrows[ab];
      var x = M + i * aw;
      box(x + 3, y, aw - 6, 70);
      font('bold', 7.5);
      color(C.accent);
      pdf.text(clean(UI().abilityName(ab)).toUpperCase(), x + aw / 2, y + 12, { align: 'center' });
      font('bold', 18);
      color(C.ink);
      pdf.text(signed(a.modifier), x + aw / 2, y + 35, { align: 'center' });
      font('normal', 9);
      pdf.text('Score ' + a.score, x + aw / 2, y + 49, { align: 'center' });
      font(s.proficient ? 'bold' : 'normal', 7.5);
      color(s.proficient ? C.accent : C.muted);
      pdf.text('Save ' + signed(s.modifier) + (s.proficient ? ' (prof.)' : ''), x + aw / 2, y + 62, { align: 'center' });
    });
    y += 80;
    if (d.savingThrowNotes.length) para(d.savingThrowNotes.join(' '), { size: 8, color: C.muted });

    // ---- Skills (two columns) -----------------------------------------------------
    heading('Skills');
    var ids = Object.keys(d.skills);
    var half = Math.ceil(ids.length / 2);
    var colW = CW / 2;
    need(half * 13 + 6);
    ids.forEach(function (id, i) {
      var s = d.skills[id];
      var x = M + (i < half ? 0 : colW);
      var ry = y + (i % half) * 13 + 9;
      pdf.setDrawColor(C.accent[0], C.accent[1], C.accent[2]);
      if (s.proficient || s.expertise) pdf.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
      pdf.circle(x + 4, ry - 3, 3, s.proficient || s.expertise ? 'FD' : 'S');
      if (s.expertise) { pdf.setFillColor(255, 255, 255); pdf.circle(x + 4, ry - 3, 1.1, 'F'); }
      font(s.proficient ? 'bold' : 'normal', 9);
      color(C.ink);
      pdf.text(clean(s.name) + ' (' + UI().abilityShort(s.ability) + ')' + (s.expertise ? ' - Expertise' : ''), x + 12, ry);
      pdf.text(signed(s.modifier), x + colW - 16, ry, { align: 'right' });
    });
    y += half * 13 + 8;

    heading('Proficiencies & Languages');
    labelled('Armor:', d.proficiencies.armor.join(', ') || 'None');
    labelled('Weapons:', d.proficiencies.weapons.join('; ') || 'None');
    labelled('Tools:', d.proficiencies.tools.join(', ') || 'None');
    labelled('Languages:', d.proficiencies.languages.join(', ') || 'None');
    if (d.combat.darkvision) labelled('Darkvision:', d.combat.darkvision + ' ft.');

    // ---- Combat -----------------------------------------------------------------
    heading('Combat');
    labelled('Armor Class:', d.combat.ac + ' (' + d.combat.acBreakdown.join(', ') + ')');
    labelled('Hit Points:', d.combat.hpMax + ' max  (' + d.combat.hpBreakdown.join('; ') + ')');
    var st = doc.state || {};
    if (st.hpCurrent != null || st.hpTemp) labelled('Current:', (st.hpCurrent != null ? Math.min(st.hpCurrent, d.combat.hpMax) : d.combat.hpMax) + ' HP' + (st.hpTemp ? ', ' + st.hpTemp + ' temporary' : ''));
    if (d.spellcasting) labelled('Spellcasting:', UI().abilityName(d.spellcasting.ability) + ' - save DC ' + d.spellcasting.saveDC + ', spell attack ' + signed(d.spellcasting.attackBonus));
    if (d.sneakAttackDice) labelled('Sneak Attack:', d.sneakAttackDice + ' once per turn');
    if (d.classResources.length) labelled('Resources:', d.classResources.map(function (r) { return r.label + ' ' + r.value; }).join(' - '));
    if (d.attacks.length) {
      y += 4;
      var cols = [['Weapon', 0.3], ['Attack', 0.1], ['Damage', 0.22], ['Mastery', 0.13], ['Properties', 0.25]];
      need(18);
      pdf.setFillColor(C.fill[0], C.fill[1], C.fill[2]);
      pdf.rect(M, y, CW, 15, 'F');
      var cx = M;
      font('bold', 8);
      color(C.accent);
      cols.forEach(function (col) { pdf.text(col[0].toUpperCase(), cx + 4, y + 10.5); cx += col[1] * CW; });
      y += 17;
      d.attacks.forEach(function (a) {
        var cells = [a.name + (a.proficient ? '' : ' (not proficient)') + (a.notes ? ' - ' + a.notes : ''), signed(a.attackBonus), a.damage, a.mastery || '-', a.properties.join(', ') || '-'];
        font('normal', 8.5);
        var wrapped = cells.map(function (t, i) { return pdf.splitTextToSize(clean(t), cols[i][1] * CW - 8); });
        var rows = Math.max.apply(null, wrapped.map(function (w) { return w.length; }));
        need(rows * 11 + 4);
        color(C.ink);
        var x2 = M;
        wrapped.forEach(function (w, i) {
          w.forEach(function (l, k) { pdf.text(l, x2 + 4, y + 9 + k * 11); });
          x2 += cols[i][1] * CW;
        });
        y += rows * 11 + 3;
        pdf.setDrawColor(C.line[0], C.line[1], C.line[2]);
        pdf.setLineWidth(0.4);
        pdf.line(M, y, M + CW, y);
        y += 2;
      });
      if (d.critRange) para('Your weapon attacks score a Critical Hit on ' + d.critRange + '-20.', { size: 8, color: C.muted });
    }

    // ---- Features -------------------------------------------------------------------
    var groups = [
      ['Class & Subclass Features', d.features.filter(function (f) { return f.kind === 'class' || f.kind === 'subclass' || f.kind === 'choice'; }).sort(function (a, b) { return a.level - b.level; })],
      ['Eldritch Invocations', d.invocations.map(function (i) { return { name: i.name, source: i.prerequisite || '', description: i.description }; })],
      ['Metamagic', d.metamagic.map(function (m) { return { name: m.name, source: m.cost, description: m.description }; })],
      ['Species Traits', d.features.filter(function (f) { return f.kind === 'species'; })],
      ['Feats', d.features.filter(function (f) { return f.kind === 'feat'; })],
    ];
    groups.forEach(function (g) {
      if (!g[1].length) return;
      heading(g[0]);
      g[1].forEach(function (f) {
        need(30);
        para(f.name + (f.source ? '  (' + f.source + ')' : ''), { bold: true, size: 9.5, after: 1 });
        if (f.description) rulesBlock(f.description);
        y += 3;
      });
    });

    // ---- Spells -------------------------------------------------------------------
    var sc = d.spellcasting;
    function spellEntry(id, tag) {
      var s = Api().getSpell(id);
      if (!s) return;
      need(30);
      para(s.name + '  (' + (s.level === 0 ? 'Cantrip' : 'Level ' + s.level) + ' ' + s.school + (s.concentration ? ', Concentration' : '') + (s.ritual ? ', Ritual' : '') + (tag ? ', ' + tag : '') + ')', { bold: true, size: 9.5, after: 1 });
      para('Casting Time: ' + s.castingTime + '  -  Range: ' + s.range + '  -  Components: ' + s.components + '  -  Duration: ' + s.duration, { size: 8, indent: 10, color: C.muted, after: 1 });
      if (o.spellText !== false) {
        rulesBlock(s.description);
        if (s.higherLevels) para(s.higherLevels, { size: 8.5, indent: 10, italic: true, color: [60, 54, 56] });
      }
      y += 3;
    }
    if (sc || d.otherSpells.length) {
      heading('Spells');
      if (sc) {
        labelled('Spellcasting:', UI().abilityName(sc.ability) + ' - save DC ' + sc.saveDC + ', attack ' + signed(sc.attackBonus) + ' - prepared ' + sc.prepared.length + ' / ' + sc.spellsPrepared);
        labelled(sc.pact ? 'Pact slots:' : 'Spell slots:', sc.pact ? sc.pact.slots + ' of level ' + sc.pact.level + ' (Short or Long Rest)' : sc.slots.map(function (k, i) { return k ? 'L' + (i + 1) + ' x' + k : null; }).filter(Boolean).join('   ') || 'none');
        y += 4;
        if (sc.cantrips.length) {
          para('Cantrips', { bold: true, size: 10.5, color: C.accent });
          sc.cantrips.forEach(function (id) { spellEntry(id); });
        }
        var always = sc.alwaysPrepared;
        var prepared = sc.prepared.concat(always.filter(function (id) { return sc.prepared.indexOf(id) < 0; }));
        if (prepared.length) {
          para('Prepared spells', { bold: true, size: 10.5, color: C.accent });
          prepared.slice().sort(function (a, b) { return (Api().getSpell(a) || {}).level - (Api().getSpell(b) || {}).level; }).forEach(function (id) {
            spellEntry(id, sc.spellMastery.indexOf(id) >= 0 ? 'Spell Mastery' : sc.signature.indexOf(id) >= 0 ? 'Signature Spell' : always.indexOf(id) >= 0 ? 'always prepared' : '');
          });
        }
        (sc.arcanum || []).forEach(function (a, i) {
          if (!i) para('Mystic Arcanum', { bold: true, size: 10.5, color: C.accent });
          spellEntry(a.spellId, 'once per Long Rest');
        });
        if (sc.spellbook && sc.spellbook.length) {
          para('Spellbook', { bold: true, size: 10.5, color: C.accent });
          para(sc.spellbook.map(function (id) { var s = Api().getSpell(id); return s ? s.name + ' (' + s.level + ')' : null; }).filter(Boolean).join(', '), { size: 9 });
        }
      }
      if (d.otherSpells.length) {
        para('Other spells', { bold: true, size: 10.5, color: C.accent });
        d.otherSpells.forEach(function (os) { spellEntry(os.spellId, os.source + (os.note ? ', ' + os.note : '')); });
      }
    }

    // ---- Equipment ---------------------------------------------------------------------
    heading('Equipment');
    if (!d.inventory.length && !d.gold) para('No starting equipment chosen.', { color: C.muted });
    d.inventory.forEach(function (i) {
      para('- ' + (i.count > 1 ? i.count + ' x ' : '') + i.name + (i.contents ? ' (contains: ' + i.contents.join(', ') + ')' : ''), { size: 9, after: 0.5 });
    });
    labelled('Gold:', d.gold + ' GP');
    if (d.weaponMasteries.length) labelled('Weapon Mastery:', d.weaponMasteries.map(function (id) { var w = Api().getWeapon(id); return w.name + ' (' + w.mastery + ')'; }).join(', '));

    // ---- Story --------------------------------------------------------------------------
    var story = [['Appearance', n.appearance], ['Personality traits', n.personalityTraits], ['Ideals', n.ideals], ['Bonds', n.bonds], ['Flaws', n.flaws], ['Backstory', n.backstory], ['Notes', n.notes]]
      .filter(function (s) { return s[1] && String(s[1]).trim(); });
    if (story.length) {
      heading('Story');
      story.forEach(function (s) {
        para(s[0], { bold: true, size: 9.5, after: 1 });
        String(s[1]).split(/\n+/).forEach(function (p) { if (p.trim()) para(p, { size: 9 }); });
        y += 3;
      });
    }

    // ---- Notes & attribution -----------------------------------------------------------------
    if (d.limitations.length) {
      heading('Notes');
      d.limitations.forEach(function (l) { para('- ' + l, { size: 8.5, color: C.muted }); });
    }
    // ---- Character Guide (rules-based, from the saved character; never depends on the optional AI wording) ----
    var guide = null;
    if (o.guide !== false && global.FogCharacterGuide) {
      try { guide = global.FogCharacterGuide.build(doc); } catch (e) { guide = null; }
    }
    if (guide) {
      newPage();
      pdf.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
      pdf.rect(M, y, CW, 34, 'F');
      pdf.setFont('times', 'bold');
      pdf.setFontSize(17);
      pdf.setTextColor(255, 255, 255);
      pdf.text('CHARACTER GUIDE', M + 12, y + 22);
      font('normal', 8.5);
      pdf.text(clean(name + ' - level ' + c.level + ' ' + cls.name), M + CW - 12, y + 21, { align: 'right' });
      y += 44;
      para('How to play this character, built from its saved choices and the SRD 5.2.1 rules. It is the same guide as the sheet\'s Character Guide tab.', { size: 8.5, color: C.muted });
      var bullets = function (list, opt) {
        (list || []).forEach(function (t) {
          need(lineH(9));
          font('normal', 9);
          color(C.accent);
          pdf.text('-', M + 5, y + 9);
          para(t, Object.assign({ size: 9, indent: 14, after: 1 }, opt || {}));
        });
      };
      var subhead = function (t) { need(28); y += 3; para(t, { bold: true, size: 10.5, color: C.accent, after: 2 }); };

      var gi = guide.identity;
      heading('1. Who Is This Character?');
      para(gi.headline, { bold: true, size: 10.5 });
      gi.paragraphs.forEach(function (p) { para(p, { size: 9 }); });
      if (gi.roles.length) labelled('Roles:', gi.roles.join(', '));
      if (gi.facts.length) labelled('At a glance:', gi.facts.map(function (f) { return f.label + ' ' + f.value; }).join('  -  '));
      bullets(gi.personal);

      heading('2. Understanding Your Abilities');
      guide.abilities.forEach(function (a) {
        need(26);
        var meta = [a.source, a.actionType, a.recharge, a.resource ? 'Now: ' + a.resource : null].filter(Boolean).join('  -  ');
        para(a.name + '   (' + meta + ')', { bold: true, size: 9.5, after: 1 });
        if (a.what && a.what.length <= 260) para(a.what, { size: 8.5, indent: 10, color: [60, 54, 56], after: 1 });
        else if (a.what) para('Full rules text: see “' + a.name + '” in the features section of the sheet.', { size: 8.5, indent: 10, italic: true, color: C.muted, after: 1 });
        if (a.limits.length && a.limits.join(' ').length <= 320) para('Limits: ' + a.limits.join(' '), { size: 8.5, indent: 10, color: [60, 54, 56], after: 1 });
        y += 2;
      });

      var ghp = guide.howToPlay;
      heading('3. How to Play');
      subhead('In combat');
      bullets(ghp.combat);
      subhead('Outside combat');
      bullets(ghp.outside);
      subhead('Priorities');
      bullets(ghp.priorities);
      subhead('Common beginner mistakes');
      bullets(ghp.mistakes);

      heading('4. Recommended Combos and Synergies');
      var labels = { now: 'Ready now', situational: 'Situational', option: 'Available now with a different choice', future: 'Future levels' };
      var anyCombo = false;
      ['now', 'situational', 'option', 'future'].forEach(function (k) {
        var list = guide.combos[k] || [];
        if (!list.length) return;
        anyCombo = true;
        subhead(labels[k]);
        list.forEach(function (cb) {
          need(30);
          para(cb.title + (cb.status === 'future' ? '  (level ' + cb.level + ')' : ''), { bold: true, size: 9.5, after: 1 });
          if (cb.why) para(cb.why, { size: 8.5, indent: 10, after: 1 });
          if (cb.how) para('How: ' + cb.how, { size: 8.5, indent: 10, after: 1 });
          if (cb.note) para(cb.note, { size: 8.5, indent: 10, italic: true, color: C.muted, after: 1 });
          if (cb.missing && cb.missing.length) para((cb.status === 'future' ? 'Needs: ' : 'Choose: ') + cb.missing.join('; '), { size: 8.5, indent: 10, color: C.muted, after: 1 });
          y += 2;
        });
      });
      if (!anyCombo) para('No catalogued combinations apply to this character yet.', { size: 9, color: C.muted });

      var gsw = guide.strengths;
      heading('5. Strengths and Weaknesses');
      subhead('Strengths');
      bullets(gsw.strengths);
      subhead('Weaknesses');
      bullets(gsw.weaknesses);
      if (gsw.roles.length) labelled('Party roles:', gsw.roles.join(', '));

      heading('6. Level Progression');
      if (!guide.progression.length) para('Level 20 is the highest level.', { size: 9, color: C.muted });
      guide.progression.forEach(function (p) {
        need(16);
        labelled('Level ' + p.level + ':', (p.gains.length ? p.gains.join(' - ') : 'More Hit Points') + '  (' + p.hp + ')', { size: 9 });
      });
    }

    y += 8;
    para(Api().rules().meta.attribution ||'This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, licensed under CC BY 4.0.', { size: 7, color: C.muted });
    footer();
    return pdf;
  }

  function fileNameFor(doc) {
    var base = clean((doc.narrative && doc.narrative.name) || 'character').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'character';
    return base + '-level-' + doc.choices.level + '.pdf';
  }

  function exportPdf(doc) {
    return loadJsPdf().then(function (JsPDF) {
      var pdf = build(doc, JsPDF);
      var fileName = fileNameFor(doc);
      pdf.save(fileName);
      return { ok: true, fileName: fileName };
    }).catch(function (e) {
      return { ok: false, message: e && e.message ? e.message : 'The PDF could not be created.' };
    });
  }

  global.FogCharacterPdf = { exportPdf: exportPdf, build: build, fileNameFor: fileNameFor, clean: clean };
})(typeof window !== 'undefined' ? window : globalThis);
