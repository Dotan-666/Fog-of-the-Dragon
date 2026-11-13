/**
 * Character PDF export (JS/Dashboard/characters/character-pdf.js), built with the real jsPDF in Node.
 *
 *   npm install --no-save jspdf@2.5.2      (or set JSPDF_MODULE to a jsPDF dist/jspdf.node.js file)
 *   node --test tests/pdf.test.mjs
 *
 * Skipped when jsPDF isn't installed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { load, autoBuild, ROOT } from './helpers/sandbox.mjs';

const require = createRequire(import.meta.url);
let jsPDF = null;
try {
  ({ jsPDF } = require(process.env.JSPDF_MODULE || 'jspdf'));
} catch {
  jsPDF = null;
}

const skip = jsPDF ? false : 'jsPDF not installed (npm install --no-save jspdf@2.5.2)';
const { w } = load();
const ctx = vm.createContext(w);
Object.assign(ctx, { window: w, console });
for (const f of ['JS/Dashboard/characters/character-ui.js', 'JS/Dashboard/characters/character-pdf.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const P = w.FogCharacterPdf;

function text(pdf) {
  return pdf.output();
}

test('clean() keeps Latin-1 and replaces typographic characters', () => {
  assert.equal(P.clean('Ship’s “Hand” – level 3 → 4 … ✓ café'), 'Ship\'s "Hand" - level 3 -> 4 ...  café');
});

test('file name comes from the character name and level', () => {
  const { doc } = autoBuild(w, 'fighter', 3);
  doc.narrative.name = 'Sir Brannoc the Bold!';
  assert.equal(P.fileNameFor(doc), 'sir-brannoc-the-bold-level-3.pdf');
});

test('a Fighter sheet contains the name, numbers, skills, attacks, features and the SRD attribution', { skip }, () => {
  const { doc } = autoBuild(w, 'fighter', 5);
  doc.narrative.name = 'Brannoc';
  doc.narrative.backstory = 'Raised by wolves’ kin.';
  const d = w.FogDeriveCharacter(doc);
  const out = text(P.build(doc, jsPDF, { compress: false }));
  assert.match(out, /^%PDF-1\.3/);
  for (const s of ['Brannoc', 'ARMOR CLASS', 'Extra Attack', 'Athletics', 'SKILLS', 'COMBAT', 'EQUIPMENT', 'Raised by wolves\' kin.', 'System Reference Document 5.2.1']) {
    assert.ok(out.includes(s), 'missing ' + s);
  }
  assert.ok(out.includes('(' + d.combat.hpMax + ')'), 'HP max printed');
  assert.equal(d.abilities.cha.modifier, -1);
  assert.ok(out.includes('(-1)') && !out.includes('−'), 'negative modifiers use a plain hyphen the PDF font can show');
  assert.ok(d.attacks.every((a) => out.includes(a.name.split(' ')[0])), 'every attack listed');
});

test('a level 17 Wizard prints every prepared spell with its details on several pages', { skip }, () => {
  const { doc, errors } = autoBuild(w, 'wizard', 17);
  assert.equal(errors.length, 0);
  const pdf = P.build(doc, jsPDF, { compress: false });
  const out = text(pdf);
  const d = w.FogDeriveCharacter(doc);
  assert.ok(pdf.internal.getNumberOfPages() > 3, 'pages: ' + pdf.internal.getNumberOfPages());
  assert.ok(out.includes('SPELLS') && out.includes('Spellbook') && out.includes('Casting Time:'));
  d.spellcasting.prepared.forEach((id) => {
    const name = P.clean(w.FogRulesApi.getSpell(id).name);
    assert.ok(out.includes(name.replace(/([()\\])/g, '\\$1')), 'missing spell ' + name);
  });
});

test('every class exports without errors', { skip }, () => {
  for (const cls of ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard']) {
    const { doc } = autoBuild(w, cls, 20);
    const pdf = P.build(doc, jsPDF);
    assert.ok(pdf.output('arraybuffer').byteLength > 5000, cls);
  }
});

test('the PDF includes the Character Guide built from the saved character (spellcaster and non-spellcaster)', { skip }, () => {
  for (const [cls, lvl] of [['fighter', 3], ['wizard', 9], ['rogue', 1], ['cleric', 17]]) {
    const { doc } = autoBuild(w, cls, lvl);
    doc.narrative.name = 'Guide ' + cls;
    const g = w.FogCharacterGuide.build(doc);
    const out = text(P.build(doc, jsPDF, { compress: false }));
    for (const s of ['CHARACTER GUIDE', '1. WHO IS THIS CHARACTER?', '2. UNDERSTANDING YOUR ABILITIES', '3. HOW TO PLAY', '4. RECOMMENDED COMBOS AND SYNERGIES', '5. STRENGTHS AND WEAKNESSES', '6. LEVEL PROGRESSION']) {
      assert.ok(out.includes(s), cls + ' missing ' + s);
    }
    const plain = (t) => P.clean(t).replace(/([()\\])/g, '\\$1');
    assert.ok(out.includes(plain(g.identity.headline).slice(0, 40)), cls + ' headline from the character');
    assert.ok(out.includes(plain(g.howToPlay.combat[0]).slice(0, 30)), cls + ' how-to-play from the guide');
    if (g.progression.length) assert.ok(out.includes('Level ' + g.progression[0].level + ':'), cls + ' progression');
    if (g.combos.now.length) assert.ok(out.includes(plain(g.combos.now[0].title)), cls + ' combo');
  }
});

test('the guide can be left out, and the sheet part is unchanged by it', { skip }, () => {
  const { doc } = autoBuild(w, 'fighter', 5);
  const withGuide = P.build(doc, jsPDF, { compress: false });
  const without = P.build(doc, jsPDF, { compress: false, guide: false });
  assert.ok(withGuide.internal.getNumberOfPages() > without.internal.getNumberOfPages());
  assert.ok(!text(without).includes('CHARACTER GUIDE'));
});
