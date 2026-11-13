/**
 * Loads the browser character scripts into a vm sandbox (fake window + localStorage),
 * and builds complete characters using only the options API (no hand-picked rules).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const ENGINE_SCRIPTS = [
  'JS/character-engine/data/srd-5.2.1-core.js',
  'JS/character-engine/data/srd-5.2.1-spells.js',
  'JS/character-engine/data/srd-5.2.1-glossary.js',
  'JS/character-engine/rules-api.js',
  'JS/character-engine/content-packs.js',
  'JS/character-engine/character-options.js',
  'JS/character-engine/derive-character.js',
  'JS/character-engine/validate-character.js',
  'JS/character-engine/guided-tips.js',
  'JS/character-engine/synergies.js',
  'JS/character-engine/character-guide.js',
  'JS/Dashboard/characters/character-store.js',
];

export function load(scripts = ENGINE_SCRIPTS) {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const window = { localStorage, console };
  const ctx = vm.createContext({ window, console, localStorage });
  scripts.filter((f) => fs.existsSync(path.join(ROOT, f))).forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  return { w: window, store };
}

export const J = (x) => JSON.parse(JSON.stringify(x));

const PRIMARY = {
  barbarian: ['str', 'con', 'dex'], bard: ['cha', 'dex', 'con'], cleric: ['wis', 'con', 'str'], druid: ['wis', 'con', 'dex'],
  fighter: ['str', 'con', 'dex'], monk: ['dex', 'wis', 'con'], paladin: ['str', 'cha', 'con'], ranger: ['dex', 'wis', 'con'],
  rogue: ['dex', 'con', 'int'], sorcerer: ['cha', 'con', 'dex'], warlock: ['cha', 'con', 'dex'], wizard: ['int', 'con', 'dex'],
};

/**
 * Fill every open choice with the first legal option, re-sanitizing in between, until the
 * character validates. Returns { doc, errors }.
 */
export function autoBuild(w, classId, level, overrides = {}) {
  const { FogCharacterStore: Store, FogValidateCharacter: V, FogCharacterOptions: O, FogRulesApi: A } = w;
  const d = Store.createDraft();
  const order = PRIMARY[classId];
  const array = [15, 14, 13, 12, 10, 8];
  const rest = ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter((a) => order.indexOf(a) < 0);
  const base = {};
  order.concat(rest).forEach((a, i) => { base[a] = array[i]; });
  Object.assign(d.choices, {
    level, classId,
    backgroundId: overrides.backgroundId || 'soldier',
    backgroundTool: 'gaming-set-dice',
    speciesId: overrides.speciesId || 'human',
    speciesOptions: overrides.speciesOptions || { size: 'Medium', skill: 'insight' },
    abilityMethod: 'standard-array',
    abilityScoresBase: base,
    classEquipment: 'A',
    backgroundEquipment: 'A',
  });
  d.narrative.name = 'Auto ' + classId + ' ' + level;
  Object.assign(d.choices, overrides.choices || {});
  const bg = O.backgroundOf(d);
  if (!(overrides.choices && overrides.choices.backgroundIncrease)) {
    const p2 = bg.abilities.find((a) => a === order[0]) || bg.abilities[0];
    const p1 = bg.abilities.find((a) => a !== p2 && order.indexOf(a) >= 0) || bg.abilities.find((a) => a !== p2);
    d.choices.backgroundIncrease = { mode: '2-1', plus2: p2, plus1: p1 };
  }

  const first = (list, n) => list.slice(0, n);
  for (let pass = 0; pass < 8; pass++) {
    V.sanitizeChoices(d);
    const c = d.choices;
    const cls = A.getClass(c.classId);
    if (O.subclassAvailable(d) && !c.subclassId) c.subclassId = A.listSubclasses(classId)[0].id;
    O.classChoices(d).forEach((ch) => {
      const cur = c.classOptions[ch.id];
      if (ch.type === 'option') {
        if (!cur) c.classOptions[ch.id] = ch.options[0].id;
      } else if (ch.type === 'invocations') {
        // handled below
      } else {
        const co = O.choiceOptions(d, ch);
        const have = Array.isArray(cur) ? cur.filter((x) => co.from.indexOf(x) >= 0) : [];
        c.classOptions[ch.id] = have.concat(co.from.filter((x) => have.indexOf(x) < 0)).slice(0, co.count);
      }
    });
    const cso = O.classSkillOptions(d);
    if (cso && c.skillProficiencies.length < cso.count) c.skillProficiencies = first(cso.selectable, cso.count);
    const lo = O.languageOptions(d);
    if (c.languages.length < lo.count) c.languages = first(lo.from, lo.count);
    if (lo.extra && !c.classOptions.extraLanguage) c.classOptions.extraLanguage = lo.extra.from[0];

    O.featSlots(d).forEach((slot) => {
      let inst = c.feats[slot.key];
      if (!inst || !inst.featId) {
        const allowed = O.allowedFeats(d, slot);
        const pref = allowed.find((f) => f.id === 'ability-score-improvement') || allowed.find((f) => f.id === 'alert') || allowed[0];
        if (!pref) return;
        inst = c.feats[slot.key] = { featId: pref.id };
      }
      const rule = O.featIncreaseRule(inst.featId);
      if (rule && !inst.abilityIncrease) {
        const scores = O.abilityScores(d, slot.key).scores;
        const pick = order.concat(rest).filter((a) => rule.from.indexOf(a) >= 0 && scores[a] + rule.total <= rule.max)[0]
          || order.concat(rest).filter((a) => rule.from.indexOf(a) >= 0 && scores[a] < rule.max)[0];
        inst.abilityIncrease = { [pick]: rule.total };
        if (rule.total === 2 && scores[pick] + 2 > rule.max) {
          const second = order.concat(rest).find((a) => a !== pick && scores[a] < rule.max);
          inst.abilityIncrease = { [pick]: 1, [second]: 1 };
        }
      }
      if (inst.featId === 'magic-initiate') {
        if (!inst.spellList) inst.spellList = O.magicInitiateLists(d, slot)[0];
        const mo = O.magicInitiateSpellOptions(inst.spellList);
        if (!inst.cantrips || inst.cantrips.length < 2) inst.cantrips = first(mo.cantrips.from, 2);
        if (!inst.spell1) inst.spell1 = mo.spell1.from[0];
        if (!inst.spellAbility) inst.spellAbility = 'wis';
      }
      const alt = O.alternativeCantripOptions(inst.featId);
      if (alt && (!inst.cantrips || inst.cantrips.length < alt.count)) inst.cantrips = first(alt.from, alt.count);
      if (inst.featId === 'skilled' && (!inst.picks || inst.picks.length < 3)) {
        inst.picks = first(O.skilledPickOptions(d, slot.key).skills, 3).map((id) => ({ type: 'skill', id }));
      }
    });

    const wm = O.weaponMasteryOptions(d);
    if (wm && c.weaponMasteries.length < wm.count) c.weaponMasteries = first(wm.from, wm.count);

    const so = O.spellOptions(d);
    if (so) {
      const s = c.spells;
      // Damage cantrips first (so invocations that need one can be taken)
      const cantrips = so.cantrips.from.slice().sort((x, y) => Number(!!A.getSpell(y).dealsDamage) - Number(!!A.getSpell(x).dealsDamage));
      if (s.cantrips.length < so.cantrips.count) s.cantrips = first(cantrips, so.cantrips.count);
      if (so.spellbook && s.spellbook.length < so.spellbook.count) {
        const byLevel = so.spellbook.from.slice().sort((x, y) => A.getSpell(x).level - A.getSpell(y).level);
        const needSig = level >= 20 ? byLevel.filter((id) => A.getSpell(id).level === 3).slice(0, 2) : [];
        s.spellbook = needSig.concat(byLevel.filter((id) => needSig.indexOf(id) < 0)).slice(0, so.spellbook.count);
      }
      const after = O.spellOptions(d);
      if (after.spellMastery && s.spellMastery.length < 2) {
        const l1 = after.spellMastery.from.find((id) => A.getSpell(id).level === 1);
        const l2 = after.spellMastery.from.find((id) => A.getSpell(id).level === 2);
        s.spellMastery = [l1, l2].filter(Boolean);
      }
      if (after.signature && s.signature.length < after.signature.count) s.signature = first(after.signature.from, after.signature.count);
      const prep = O.spellOptions(d).prepared;
      if (s.prepared.length < prep.count) s.prepared = s.prepared.concat(prep.from.filter((id) => s.prepared.indexOf(id) < 0)).slice(0, prep.count);
      so.arcanum.forEach((arc) => { if (!s.arcanum[arc.spellLevel]) s.arcanum[arc.spellLevel] = arc.from[0]; });
    }

    const io = O.invocationOptions(d);
    if (io) {
      const list = O.invocationList(d).slice();
      c.classOptions.invocations = list;
      for (const inv of A.listInvocations()) {
        if (list.length >= io.count) break;
        if (O.invocationBlockReason(d, inv, list.length)) continue;
        const inst = { id: inv.id };
        if (inv.pick && inv.pick.type === 'cantrip') inst.cantrip = O.invocationCantripOptions(d, inv, list.length)[0];
        list.push(inst);
      }
      list.forEach((inst, i) => {
        const inv = A.getInvocation(inst.id);
        if (inv && inv.pick && inv.pick.type === 'cantrip' && !inst.cantrip) inst.cantrip = O.invocationCantripOptions(d, inv, i)[0];
      });
      const to = O.tomeOptions(d);
      if (to) {
        if (c.spells.tome.cantrips.length < 3) c.spells.tome.cantrips = first(to.cantrips.from, 3);
        if (c.spells.tome.rituals.length < 2) c.spells.tome.rituals = first(to.rituals.from, 2);
      }
    }
    V.sanitizeChoices(d);
    if (V.validateComplete(d).length === 0) break;
  }
  return { doc: d, errors: V.validateComplete(d) };
}
