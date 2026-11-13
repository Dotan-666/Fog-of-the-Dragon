/**
 * Guided Tips, Character Guide, synergy catalog and content packs.
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, autoBuild, J } from './helpers/sandbox.mjs';

const { w } = load();
const R = w.FogRules;
const A = w.FogRulesApi;
const Tips = w.FogGuidedTips;
const Guide = w.FogCharacterGuide;
const V = w.FogValidateCharacter;
const derive = w.FogDeriveCharacter;

test('tips: every concept tip has a summary and official rule text', () => {
  for (const key of Tips.conceptKeys()) {
    const t = Tips.get(key);
    assert.ok(t && t.title && t.summary, key);
    assert.ok(t.rule && t.rule.text && t.rule.text.length > 20 && /SRD 5\.2\.1/.test(t.rule.source), key + ' has SRD rule text');
  }
});

test('tips: the creator and sheet topics required by the brief all exist', () => {
  const required = ['level', 'class', 'subclass', 'species', 'background', 'alignment', 'abilityScores', 'abilityModifier', 'proficiencyBonus',
    'savingThrows', 'skills', 'armorTraining', 'weaponProficiency', 'tools', 'languages', 'hitPoints', 'armorClass', 'initiative', 'speed', 'hitDice',
    'deathSaves', 'features', 'traits', 'feats', 'fightingStyle', 'weapons', 'armor', 'shield', 'weaponProperties', 'damageTypes', 'weaponMastery',
    'startingEquipment', 'spellSlots', 'spellcastingAbility', 'spellAttack', 'saveDC', 'preparedSpells', 'knownSpells', 'cantrips', 'concentration',
    'ritual', 'components', 'range', 'duration'];
  required.forEach((k) => assert.ok(Tips.get(k), 'missing tip ' + k));
});

test('tips: every rules object resolves to a tip with its own SRD text', () => {
  const keys = [];
  Object.keys(R.classes).forEach((id) => { keys.push('class:' + id, 'subclass:' + id + ':' + R.classes[id].subclass.id); R.classes[id].features.forEach((f) => keys.push('feature:' + id + ':' + f.name)); });
  A.listSpecies().forEach((s) => keys.push('species:' + s.id));
  A.listBackgrounds().forEach((b) => keys.push('background:' + b.id));
  Object.keys(R.feats).forEach((id) => keys.push('feat:' + id));
  Object.keys(R.spells).forEach((id) => keys.push('spell:' + id));
  Object.keys(R.weapons).forEach((id) => keys.push('weapon:' + id));
  Object.keys(R.armor).forEach((id) => keys.push('armor:' + id));
  Object.keys(R.masteryProperties).forEach((m) => keys.push('mastery:' + m));
  Object.keys(R.weaponRules.properties).forEach((p) => keys.push('property:' + p));
  R.skills.forEach((s) => keys.push('skill:' + s.id));
  R.abilities.forEach((a) => keys.push('ability:' + a, 'save:' + a));
  Object.keys(R.invocations).forEach((id) => keys.push('invocation:' + id));
  Object.keys(R.metamagic).forEach((id) => keys.push('metamagic:' + id));
  Object.keys(A.alternativeFeats()).forEach((id) => keys.push('feat:' + id));
  const missing = keys.filter((k) => { const t = Tips.get(k); return !t || !t.title || !t.rule || !t.rule.text; });
  assert.deepEqual(missing, []);
  assert.ok(keys.length > 600, 'covers ' + keys.length + ' rules objects');
  assert.equal(Tips.get('spell:not-a-spell'), null);
});

test('synergy catalog: every referenced id and feature name exists in the rules data', () => {
  const problems = [];
  const feat = (c, n) => R.classes[c] && R.classes[c].features.concat(R.classes[c].subclass.features).some((f) => f.name === n);
  const subIds = Object.values(R.classes).map((c) => c.subclass.id);
  for (const syn of w.FogSynergies.list()) {
    assert.ok(syn.id && syn.title && syn.why && syn.how && syn.requires.length, syn.id);
    for (const r of syn.requires) {
      if (r.class && !R.classes[r.class]) problems.push(syn.id + ': class ' + r.class);
      if (r.subclass && subIds.indexOf(r.subclass) < 0) problems.push(syn.id + ': subclass ' + r.subclass);
      if (r.feature && !feat(r.feature[0], r.feature[1])) problems.push(syn.id + ': feature ' + r.feature);
      [r.spell, r.otherSpell, r.cantrip].concat(r.spellAny || []).filter(Boolean).forEach((id) => { if (!R.spells[id]) problems.push(syn.id + ': spell ' + id); });
      if (r.invocation && !R.invocations[r.invocation]) problems.push(syn.id + ': invocation ' + r.invocation);
      if (r.metamagic && !R.metamagic[r.metamagic]) problems.push(syn.id + ': metamagic ' + r.metamagic);
      if (r.feat && !A.getFeat(r.feat)) problems.push(syn.id + ': feat ' + r.feat);
      if (r.mastery && !R.masteryProperties[r.mastery]) problems.push(syn.id + ': mastery ' + r.mastery);
      if (r.weaponProperty && !R.weaponRules.properties[r.weaponProperty]) problems.push(syn.id + ': property ' + r.weaponProperty);
      (r.weaponAny || []).forEach((id) => { if (!R.weapons[id]) problems.push(syn.id + ': weapon ' + id); });
      if (r.classOption) {
        const ch = Object.values(R.classes).flatMap((c) => c.choices).find((x) => x.id === r.classOption[0]);
        if (!ch || !ch.options.some((o) => o.id === r.classOption[1])) problems.push(syn.id + ': option ' + r.classOption);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('guide: builds for every class at levels 1, 3, 5, 11 and 20 using only the character’s data', () => {
  for (const cid of R.meta.supportedClassIds) {
    for (const lvl of [1, 3, 5, 11, 20]) {
      const { doc } = autoBuild(w, cid, lvl);
      const d = derive(doc);
      const g = Guide.build(doc, d);
      assert.match(g.identity.headline, new RegExp('level ' + lvl + ' .*' + R.classes[cid].name));
      assert.equal(g.identity.facts.find((f) => f.label === 'Hit Points').value, String(d.combat.hpMax));
      assert.equal(g.identity.facts.find((f) => f.label === 'Armor Class').value, String(d.combat.ac));
      // Every ability listed is a feature, invocation or metamagic the character actually has
      const names = new Set(d.features.map((f) => f.name).concat(d.invocations.map((i) => i.name), d.metamagic.map((m) => m.name)));
      g.abilities.forEach((a) => assert.ok(names.has(a.name), cid + ' ' + lvl + ': ' + a.name));
      // "What it does" text is verbatim SRD text from that feature
      g.abilities.filter((a) => a.kind === 'class').forEach((a) => {
        const plain = (f) => f.description.replace(/\*\*|_/g, '').replace(/\n+/g, ' ');
        // Some features share a name at different levels (Improved Brutal Strike at 13 and 17)
        assert.ok(d.features.filter((x) => x.name === a.name).some((f) => plain(f).indexOf(a.what.slice(0, 40)) >= 0), a.name + ' text is from the SRD');
      });
      // Advice is only about features the character has
      assert.ok(g.howToPlay.combat.length > 0, cid + ' ' + lvl + ' has combat advice');
      // Progression lists only later levels
      assert.ok(g.progression.every((p) => p.level > lvl && p.level <= 20));
      assert.equal(g.progression.length, 20 - lvl);
    }
  }
});

test('guide: level 1 Barbarian gets no advice about features it doesn’t have yet', () => {
  const { doc } = autoBuild(w, 'barbarian', 1);
  const g = Guide.build(doc);
  const all = g.howToPlay.combat.concat(g.howToPlay.mistakes, g.howToPlay.outside).join(' ');
  assert.ok(!/Reckless Attack|Extra Attack|Danger Sense/.test(all));
  assert.ok(/Rage/.test(all));
  const lv2 = g.progression.find((p) => p.level === 2);
  assert.ok(lv2.gains.indexOf('Reckless Attack') >= 0 && lv2.gains.indexOf('Danger Sense') >= 0);
  assert.ok(g.progression.find((p) => p.level === 5).gains.some((x) => /Proficiency Bonus becomes \+3/.test(x)));
});

test('combos: only legal combinations, split into now / another choice / future levels', () => {
  const lock2 = autoBuild(w, 'warlock', 2, { choices: { spells: { cantrips: ['eldritch-blast', 'prestidigitation'] } } }).doc;
  lock2.choices.classOptions.invocations = [{ id: 'agonizing-blast', cantrip: 'eldritch-blast' }, { id: 'eldritch-mind' }, { id: 'pact-of-the-chain' }];
  V.sanitizeChoices(lock2);
  assert.deepEqual(J(V.validateStep(lock2, 'features')), []);
  const g = Guide.build(lock2);
  const id = (list) => list.map((x) => x.id);
  assert.ok(id(g.combos.now).indexOf('agonizing-eldritch-blast') >= 0, 'Agonizing Blast is active now');
  assert.ok(id(g.combos.option).indexOf('hex-eldritch-blast') >= 0, 'Hex is preparable now');
  const blade = g.combos.future.find((x) => x.id === 'blade-pact-melee');
  assert.equal(blade.level, 5, 'Thirsting Blade needs level 5');
  // A Wizard never sees Warlock or Paladin combos
  const wiz = Guide.build(autoBuild(w, 'wizard', 5).doc);
  const all = [].concat(wiz.combos.now, wiz.combos.option, wiz.combos.future, wiz.combos.situational).map((x) => x.id);
  assert.ok(!all.some((x) => /eldritch|blade|smite|rage|sneak/.test(x)), all.join(','));
  assert.ok(all.indexOf('sculpt-fireball') >= 0 || all.indexOf('potent-cantrip') >= 0);
});

test('combos: Rogue Sneak Attack with Vex appears only when a Vex weapon is mastered', () => {
  const { doc } = autoBuild(w, 'rogue', 1);
  doc.choices.weaponMasteries = ['shortsword', 'dagger'];
  V.sanitizeChoices(doc);
  assert.ok(Guide.build(doc).combos.now.some((x) => x.id === 'sneak-attack-vex'));
  doc.choices.weaponMasteries = ['dagger', 'scimitar'];
  V.sanitizeChoices(doc);
  const g = Guide.build(doc);
  assert.ok(!g.combos.now.some((x) => x.id === 'sneak-attack-vex'));
  assert.ok(g.combos.option.some((x) => x.id === 'sneak-attack-vex'));
});

test('guide is recomputed from the current data: editing changes it and the hash', () => {
  const { doc } = autoBuild(w, 'fighter', 4);
  const g1 = Guide.build(doc);
  doc.choices.level = 5;
  V.sanitizeChoices(doc);
  const { doc: done } = autoBuild(w, 'fighter', 5, { choices: doc.choices });
  const g2 = Guide.build(done);
  assert.notEqual(g1.hash, g2.hash);
  assert.ok(g2.abilities.some((a) => a.name === 'Extra Attack'));
  assert.ok(!g1.abilities.some((a) => a.name === 'Extra Attack'));
});

test('content packs: validated, edition-locked, attributed, and merged into options', () => {
  const P = w.FogContentPacks;
  assert.equal(P.register({ id: 'x', name: 'X', edition: '2014', license: 'CC BY 4.0', attribution: 'x' }).ok, false, '2014 content is rejected');
  assert.ok(P.register({ id: 'y', name: 'Y', edition: '2024', license: 'CC', attribution: 'a', spells: { 'fire-bolt': { name: 'Dup' } } }).errors.some((e) => /already exists/.test(e)));
  assert.ok(P.register({ id: 'z', name: 'Z', edition: '2024', license: '', attribution: '' }).errors.length >= 2, 'license and attribution required');
  const res = P.register({
    id: 'test-pack', name: 'Test Pack', edition: '2024', license: 'CC BY 4.0', attribution: 'Test content by the Fog of the Dragon team.',
    spells: { 'test-spark': { name: 'Test Spark', level: 0, school: 'Evocation', classes: ['wizard'], castingTime: 'Action', range: '60 feet', components: 'V', duration: 'Instantaneous', description: 'A test cantrip.' } },
    subclasses: { fighter: [{ id: 'test-guardian', name: 'Test Guardian', description: 'A test subclass.', features: [{ level: 3, name: 'Test Ward', description: 'A test feature.' }] }] },
  });
  assert.deepEqual(J(res), { ok: true, errors: [] });
  assert.ok(A.spellIdsForList('wizard', 0).indexOf('test-spark') >= 0);
  assert.equal(A.listSubclasses('fighter').length, 2);
  assert.equal(A.getSpell('test-spark').pack, 'test-pack');
  assert.deepEqual(J(R.meta.contentPacks.map((p) => p.id)), ['test-pack']);
  const { doc } = autoBuild(w, 'fighter', 3, { choices: { subclassId: 'test-guardian' } });
  assert.equal(doc.choices.subclassId, 'test-guardian');
  assert.deepEqual(J(V.validateComplete(doc)), []);
  assert.ok(derive(doc).features.some((f) => f.name === 'Test Ward'));
});
