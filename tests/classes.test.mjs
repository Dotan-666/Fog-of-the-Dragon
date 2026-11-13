/**
 * All 12 SRD 5.2.1 classes: every level is buildable and valid, and class mechanics match the SRD text.
 * Run with: node --test tests/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, autoBuild, J } from './helpers/sandbox.mjs';

const { w } = load();
const R = w.FogRules;
const A = w.FogRulesApi;
const O = w.FogCharacterOptions;
const V = w.FogValidateCharacter;
const derive = w.FogDeriveCharacter;
const CLASSES = R.meta.supportedClassIds;

test('every class at every level 1–20 can be completed with legal choices and derives without errors', () => {
  const failures = [];
  for (const cid of CLASSES) {
    for (let lvl = 1; lvl <= 20; lvl++) {
      const { doc, errors } = autoBuild(w, cid, lvl);
      if (errors.length) failures.push(`${cid} ${lvl}: ${errors.map((e) => e.message).join(' | ')}`);
      const d = derive(doc);
      assert.ok(d.combat.hpMax > 0 && d.combat.ac >= 10, `${cid} ${lvl} derived numbers`);
      // Sanitizing a valid character changes nothing
      const before = JSON.stringify(doc.choices);
      const notices = V.sanitizeChoices(doc);
      assert.equal(JSON.stringify(doc.choices), before, `${cid} ${lvl} sanitize is stable`);
      assert.deepEqual(J(notices), []);
    }
  }
  assert.deepEqual(failures, []);
});

test('subclasses are gated by level 3 for every class', () => {
  for (const cid of CLASSES) {
    const { doc } = autoBuild(w, cid, 3);
    assert.ok(doc.choices.subclassId, cid + ' has a subclass at 3');
    doc.choices.level = 2;
    const notes = V.sanitizeChoices(doc);
    assert.equal(doc.choices.subclassId, null, cid + ' loses subclass at 2');
    assert.ok(notes.some((n) => /Removed subclass/.test(n)), cid + ' explains why');
  }
});

test('spells: every chosen spell is on the class list and within slot level', () => {
  for (const cid of CLASSES.filter((c) => A.isSpellcaster(c))) {
    for (const lvl of [1, 3, 5, 9, 11, 17, 20]) {
      const { doc } = autoBuild(w, cid, lvl);
      const so = O.spellOptions(doc);
      const lists = so.lists;
      doc.choices.spells.prepared.forEach((id) => {
        const sp = A.getSpell(id);
        assert.ok(sp.level >= 1 && sp.level <= so.maxSpellLevel, `${cid} ${lvl}: ${id} level ${sp.level} ≤ ${so.maxSpellLevel}`);
        if (cid !== 'wizard') assert.ok(lists.some((l) => sp.classes.indexOf(l) >= 0), `${cid}: ${id} on ${lists}`);
      });
      doc.choices.spells.cantrips.forEach((id) => assert.ok(A.getSpell(id).level === 0 && A.getSpell(id).classes.indexOf(cid) >= 0, `${cid} cantrip ${id}`));
    }
  }
});

test('casting progressions: full, half and Pact Magic slots follow the class tables', () => {
  assert.deepEqual(J(A.slotsAt('paladin', 1)), [2, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(A.maxSpellLevel('paladin', 5), 2);
  assert.equal(A.maxSpellLevel('ranger', 17), 5);
  assert.equal(A.maxSpellLevel('bard', 17), 9);
  assert.deepEqual(J(A.slotsAt('warlock', 5)), [0, 0, 2, 0, 0, 0, 0, 0, 0]);
  assert.equal(A.maxSpellLevel('warlock', 11), 5);
  assert.equal(R.classes.warlock.levels[11].pactSlots, 3);
  const { doc } = autoBuild(w, 'warlock', 11);
  const so = O.spellOptions(doc);
  assert.deepEqual(J(so.pact), { count: 3, level: 5 });
  assert.deepEqual(J(so.arcanum.map((a) => a.spellLevel)), [6]);
  assert.ok(doc.choices.spells.arcanum[6] && A.getSpell(doc.choices.spells.arcanum[6]).level === 6);
  assert.equal(O.spellOptions(autoBuild(w, 'paladin', 1).doc).cantrips.count, 0);
});

test('Barbarian: Unarmored Defense, Fast Movement, Rage columns and Primal Champion', () => {
  const { doc } = autoBuild(w, 'barbarian', 5);
  const d = derive(doc);
  const dex = d.abilities.dex.modifier;
  const con = d.abilities.con.modifier;
  assert.equal(d.combat.ac, 10 + dex + con);
  assert.match(d.combat.acBreakdown.join(' '), /Unarmored Defense/);
  assert.equal(d.combat.speed, 40, 'Human 30 + Fast Movement 10');
  assert.deepEqual(J(d.classResources.filter((r) => /Rage/.test(r.label)).map((r) => r.value)), ['3', '+2']);
  const top = autoBuild(w, 'barbarian', 20).doc;
  const before = O.abilityScores(Object.assign({}, top, { choices: Object.assign({}, top.choices, { level: 19 }) })).scores;
  const after = derive(top).abilities;
  assert.equal(after.str.score, Math.min(25, before.str + 4));
  assert.equal(after.con.score, Math.min(25, before.con + 4));
});

test('Monk: Martial Arts die, Unarmored Movement, Disciplined Survivor and Body and Mind', () => {
  const d1 = derive(autoBuild(w, 'monk', 1).doc);
  const ua = d1.attacks.find((a) => a.name === 'Unarmed Strike');
  assert.match(ua.damage, /^1d6/);
  assert.equal(d1.combat.ac, 10 + d1.abilities.dex.modifier + d1.abilities.wis.modifier);
  assert.equal(d1.combat.speed, 30);
  const d5 = derive(autoBuild(w, 'monk', 5).doc);
  assert.match(d5.attacks.find((a) => a.name === 'Unarmed Strike').damage, /^1d8/);
  assert.equal(d5.combat.speed, 40);
  const spear = d5.attacks.find((a) => a.name === 'Spear');
  assert.match(spear.damage, /^1d8/, 'Monk weapon uses the larger Martial Arts die');
  const d14 = derive(autoBuild(w, 'monk', 14).doc);
  assert.ok(Object.values(d14.savingThrows).every((s) => s.proficient));
  const d13 = derive(autoBuild(w, 'monk', 13).doc);
  assert.ok(!d13.savingThrows.cha.proficient);
});

test('Bard: Jack of All Trades, Bardic Inspiration uses and Magical Secrets', () => {
  const d2 = derive(autoBuild(w, 'bard', 2).doc);
  const nonProf = Object.values(d2.skills).find((s) => !s.proficient);
  assert.equal(nonProf.modifier, d2.abilities[nonProf.ability].modifier + 1, 'half of +2');
  assert.ok(nonProf.jackOfAllTrades);
  const d1 = derive(autoBuild(w, 'bard', 1).doc);
  assert.ok(Object.values(d1.skills).every((s) => !s.jackOfAllTrades));
  assert.equal(d1.classResources.find((r) => r.key === 'bardicUses').value, String(Math.max(1, d1.abilities.cha.modifier)));
  const b9 = O.spellOptions(autoBuild(w, 'bard', 9).doc);
  const b10 = O.spellOptions(autoBuild(w, 'bard', 10).doc);
  assert.ok(b9.prepared.from.indexOf('fireball') < 0, 'Fireball is not a Bard spell');
  assert.ok(b10.prepared.from.indexOf('fireball') >= 0, 'Magical Secrets opens the Wizard list at 10');
  assert.ok(b10.cantrips.from.indexOf('fire-bolt') < 0, 'Magical Secrets is for prepared spells, not cantrips');
});

test('Bard College of Lore: Magical Discoveries are always prepared and from Cleric, Druid or Wizard lists', () => {
  const { doc } = autoBuild(w, 'bard', 6);
  const picks = doc.choices.classOptions.magicalDiscoveries;
  assert.equal(picks.length, 2);
  picks.forEach((id) => assert.ok(['cleric', 'druid', 'wizard'].some((l) => A.getSpell(id).classes.indexOf(l) >= 0)));
  assert.ok(picks.every((id) => O.alwaysPrepared(doc).indexOf(id) >= 0));
  assert.ok(picks.every((id) => O.spellOptions(doc).prepared.from.indexOf(id) < 0), 'not double-counted');
});

test('Druid: Druidic, Speak with Animals, Primal Order and land spells', () => {
  const { doc } = autoBuild(w, 'druid', 3, { choices: { classOptions: { primalOrder: 'warden', landType: 'arid' } } });
  const d = derive(doc);
  assert.ok(d.proficiencies.languages.indexOf('Druidic') >= 0);
  assert.ok(d.spellcasting.alwaysPrepared.indexOf('speak-with-animals') >= 0);
  assert.ok(d.spellcasting.alwaysPrepared.indexOf('fire-bolt') >= 0 && d.spellcasting.alwaysPrepared.indexOf('burning-hands') >= 0);
  assert.ok(d.proficiencies.armor.indexOf('Medium armor') >= 0, 'Warden: medium armor');
  assert.ok(O.weaponProficient(doc, A.getWeapon('longsword')), 'Warden: martial weapons');
  doc.choices.classOptions.primalOrder = 'magician';
  V.sanitizeChoices(doc);
  assert.equal(O.spellOptions(doc).cantrips.count, R.classes.druid.levels[3].cantrips + 1);
  assert.ok(!O.weaponProficient(doc, A.getWeapon('longsword')));
});

test('Paladin: Divine Smite, Aura of Protection and the Blessed Warrior alternative', () => {
  const { doc } = autoBuild(w, 'paladin', 6, { choices: { feats: { 'class-fightingStyle': { featId: 'blessed-warrior', cantrips: ['guidance', 'sacred-flame'] } } } });
  assert.deepEqual(J(V.validateComplete(doc)), []);
  const d = derive(doc);
  const aura = Math.max(1, d.abilities.cha.modifier);
  assert.equal(d.savingThrows.wis.modifier, d.abilities.wis.modifier + d.proficiencyBonus + aura);
  assert.equal(d.savingThrows.str.modifier, d.abilities.str.modifier + aura);
  assert.ok(d.spellcasting.alwaysPrepared.indexOf('divine-smite') >= 0);
  assert.deepEqual(J(d.otherSpells.filter((s) => s.source === 'Blessed Warrior').map((s) => [s.spellId, s.ability])), [['guidance', 'cha'], ['sacred-flame', 'cha']]);
  assert.equal(d.classResources.find((r) => r.key === 'layOnHands').value, '30 HP');
  // A Wizard cantrip is not a Cleric cantrip
  doc.choices.feats['class-fightingStyle'].cantrips = ['guidance', 'fire-bolt'];
  V.sanitizeChoices(doc);
  assert.deepEqual(J(doc.choices.feats['class-fightingStyle'].cantrips), ['guidance']);
  // Below level 2 there is no Fighting Style slot
  doc.choices.level = 1;
  V.sanitizeChoices(doc);
  assert.equal(doc.choices.feats['class-fightingStyle'], undefined);
});

test('Ranger: Hunter’s Mark, Deft Explorer languages and expertise', () => {
  const { doc } = autoBuild(w, 'ranger', 2);
  assert.ok(O.alwaysPrepared(doc).indexOf('hunters-mark') >= 0);
  assert.equal(doc.choices.classOptions.deftLanguages.length, 2);
  assert.equal(doc.choices.classOptions.deftExpertise.length, 1);
  const d = derive(doc);
  doc.choices.classOptions.deftLanguages.forEach((id) => assert.ok(d.proficiencies.languages.indexOf(A.getLanguage(id).name) >= 0));
  // Choosing a language already known is removed
  doc.choices.classOptions.deftLanguages = ['common', doc.choices.classOptions.deftLanguages[0]];
  V.sanitizeChoices(doc);
  assert.ok(doc.choices.classOptions.deftLanguages.indexOf('common') < 0);
});

test('Rogue: Slippery Mind adds Wisdom and Charisma saves at 15', () => {
  assert.ok(!derive(autoBuild(w, 'rogue', 14).doc).savingThrows.wis.proficient);
  const d = derive(autoBuild(w, 'rogue', 15).doc);
  assert.ok(d.savingThrows.wis.proficient && d.savingThrows.cha.proficient);
});

test('Sorcerer Draconic: HP bonus, draconic AC and Metamagic counts', () => {
  const d2 = derive(autoBuild(w, 'sorcerer', 2).doc);
  const d3 = derive(autoBuild(w, 'sorcerer', 3).doc);
  const conMod = d3.abilities.con.modifier;
  assert.equal(d3.combat.hpMax, 6 + conMod + 2 * (4 + conMod) + 3);
  assert.equal(d3.combat.ac, 10 + d3.abilities.dex.modifier + d3.abilities.cha.modifier);
  assert.ok(d2.combat.ac < d3.combat.ac || d3.abilities.cha.modifier <= 0);
  const counts = [2, 9, 10, 16, 17].map((l) => autoBuild(w, 'sorcerer', l).doc.choices.classOptions.metamagic.length);
  assert.deepEqual(counts, [2, 2, 4, 4, 6]);
  assert.ok(derive(autoBuild(w, 'sorcerer', 3).doc).spellcasting.alwaysPrepared.indexOf('chromatic-orb') >= 0);
});

test('Warlock invocations: prerequisites, cantrip picks, repeatable rules and sanitizing', () => {
  const { doc } = autoBuild(w, 'warlock', 5, { choices: { spells: { cantrips: ['mage-hand', 'prestidigitation', 'minor-illusion'] } } });
  const inv = (id) => A.getInvocation(id);
  // No damage cantrip → Agonizing Blast unavailable
  doc.choices.spells.cantrips = ['mage-hand', 'prestidigitation', 'minor-illusion'];
  doc.choices.classOptions.invocations = [];
  assert.match(O.invocationBlockReason(doc, inv('agonizing-blast'), 0), /cantrip that deals damage/);
  doc.choices.spells.cantrips = ['eldritch-blast', 'prestidigitation', 'mage-hand'];
  assert.equal(O.invocationBlockReason(doc, inv('agonizing-blast'), 0), null);
  assert.deepEqual(J(O.invocationCantripOptions(doc, inv('agonizing-blast'), 0)), ['eldritch-blast']);
  // Thirsting Blade needs Pact of the Blade; Devouring Blade needs level 12
  assert.match(O.invocationBlockReason(doc, inv('thirsting-blade'), 0), /Pact of the Blade/);
  doc.choices.classOptions.invocations = [{ id: 'pact-of-the-blade' }, { id: 'thirsting-blade' }, { id: 'agonizing-blast', cantrip: 'eldritch-blast' }];
  assert.equal(O.invocationBlockReason(doc, inv('thirsting-blade'), 1), null);
  assert.match(O.invocationBlockReason(doc, inv('devouring-blade'), 3), /level 12/);
  // Repeatable Agonizing Blast can't target the same cantrip twice
  assert.match(O.invocationBlockReason(doc, inv('agonizing-blast'), 3), /Every eligible cantrip|cantrip/);
  // Non-repeatable can't be taken twice
  assert.match(O.invocationBlockReason(doc, inv('pact-of-the-blade'), 3), /Already chosen/);
  // Dropping Pact of the Blade removes Thirsting Blade on sanitize
  doc.choices.classOptions.invocations = [{ id: 'thirsting-blade' }, { id: 'agonizing-blast', cantrip: 'eldritch-blast' }];
  const notes = V.sanitizeChoices(doc);
  assert.deepEqual(J(doc.choices.classOptions.invocations.map((x) => x.id)), ['agonizing-blast']);
  assert.ok(notes.some((n) => /Thirsting Blade/.test(n)));
  // Removing Eldritch Blast removes Agonizing Blast
  doc.choices.spells.cantrips = ['mage-hand', 'prestidigitation', 'minor-illusion'];
  V.sanitizeChoices(doc);
  assert.deepEqual(J(doc.choices.classOptions.invocations), []);
});

test('Warlock: Pact of the Tome picks and Lessons of the First Ones origin feat', () => {
  const { doc } = autoBuild(w, 'warlock', 2, { speciesId: 'dwarf', speciesOptions: {} });
  assert.ok(!O.allowedFeats(autoBuild(w, 'warlock', 2).doc, { key: 'lessons-x', categories: ['origin'] }).some((f) => f.id === 'alert'), 'Alert already taken by Human Versatile');
  doc.choices.classOptions.invocations = [{ id: 'pact-of-the-tome' }, { id: 'lessons-of-the-first-ones' }, { id: 'eldritch-mind' }];
  V.sanitizeChoices(doc);
  const to = O.tomeOptions(doc);
  assert.equal(to.cantrips.count, 3);
  assert.ok(to.rituals.from.every((id) => A.getSpell(id).ritual && A.getSpell(id).level === 1));
  assert.ok(O.featSlots(doc).some((s) => s.key === 'lessons-1' && s.step === 'features'));
  const errs = V.validateStep(doc, 'features').map((e) => e.message).join(' | ');
  assert.match(errs, /Book of Shadows cantrips/);
  assert.match(errs, /Lessons of the First Ones/);
  doc.choices.spells.tome = { cantrips: to.cantrips.from.slice(0, 3), rituals: to.rituals.from.slice(0, 2) };
  doc.choices.feats['lessons-1'] = { featId: 'alert' };
  assert.deepEqual(J(V.validateStep(doc, 'features')), []);
  assert.ok(derive(doc).combat.initiative === derive(doc).abilities.dex.modifier + 2, 'Alert from Lessons applies');
  // Removing the invocation removes its feat and tome spells
  doc.choices.classOptions.invocations = [{ id: 'eldritch-mind' }];
  V.sanitizeChoices(doc);
  assert.equal(doc.choices.feats['lessons-1'], undefined);
  assert.deepEqual(J(doc.choices.spells.tome), { cantrips: [], rituals: [] });
});

test('changing class from Warlock to Wizard clears warlock-only choices and keeps origin choices', () => {
  const { doc } = autoBuild(w, 'warlock', 5);
  const bg = doc.choices.backgroundId;
  doc.choices.classId = 'wizard';
  const notes = V.sanitizeChoices(doc);
  assert.equal(doc.choices.classOptions.invocations, undefined);
  assert.equal(doc.choices.backgroundId, bg);
  assert.ok(notes.length > 0);
});

test('feat prerequisites: Boon of Spell Recall needs the Spellcasting feature; Fighting Style feats need the feature', () => {
  const wiz = autoBuild(w, 'wizard', 19).doc;
  const war = autoBuild(w, 'warlock', 19).doc;
  const slot = (doc) => O.slotByKey(doc, 'level-19');
  assert.ok(O.allowedFeats(wiz, slot(wiz)).some((f) => f.id === 'boon-of-spell-recall'));
  assert.ok(!O.allowedFeats(war, slot(war)).some((f) => f.id === 'boon-of-spell-recall'), 'Warlock has Pact Magic, not Spellcasting');
  assert.ok(R.feats['boon-of-spell-recall'].abilityIncrease.from.indexOf('cha') >= 0, 'Int, Wis or Cha');
  const rogue = autoBuild(w, 'rogue', 4).doc;
  assert.ok(!O.allowedFeats(rogue, O.slotByKey(rogue, 'level-4')).some((f) => f.category === 'fighting-style'));
  const pal = autoBuild(w, 'paladin', 4).doc;
  assert.ok(O.allowedFeats(pal, O.slotByKey(pal, 'level-4')).some((f) => f.category === 'fighting-style'));
});

test('equipment names resolve to chosen tools and packs list their SRD contents', () => {
  const bard = derive(autoBuild(w, 'bard', 1).doc);
  const inst = bard.inventory.find((i) => i.source === 'Bard' && A.rules().tools.some((t) => t.name === i.name && t.family === 'musical-instrument'));
  assert.ok(inst, 'Musical Instrument of your choice → the first chosen instrument');
  const pack = bard.inventory.find((i) => i.name === "Entertainer's Pack");
  assert.ok(pack.contents && pack.contents.length > 3);
  const monk = derive(autoBuild(w, 'monk', 1).doc);
  assert.ok(!monk.inventory.some((i) => /chosen for the tool proficiency/.test(i.name)));
});
