/**
 * Optional AI wording for the Character Guide (Gemini through the Supabase Edge Function
 * "character-guide-ai"). Off unless FOG_SUPABASE_CONFIG.aiGuide is true and the user is signed in.
 *
 * - Sends only facts already produced by the rules engine (never the API key: it lives on the server).
 * - Every returned paragraph is checked against the SRD dataset: a paragraph that names a spell, feature,
 *   feat, invocation or Metamagic option the character doesn't have, or a number/dice expression that is
 *   not in the facts, is dropped and counted. The deterministic guide is always shown regardless.
 * - Results are cached per character by the guide's content hash, so edits never show stale text.
 */
(function (global) {
  'use strict';

  var Api = function () { return global.FogRulesApi; };
  var CACHE_PREFIX = 'fog_guide_ai_';

  function enabled() {
    var cfg = global.FOG_SUPABASE_CONFIG;
    return !!(cfg && cfg.aiGuide === true && global.FogSupabase && global.FogSupabase.functions);
  }

  /** The verified facts sent to the server (a subset of the deterministic guide). */
  function factsFrom(guide, derived) {
    var g = guide;
    return {
      rulesVersion: g.rulesVersion,
      hash: g.hash,
      headline: g.identity.headline,
      identity: g.identity.paragraphs.slice(0, 8),
      roles: g.strengths.roles.slice(0, 8),
      numbers: g.identity.facts.reduce(function (o, f) { o[f.label] = f.value; return o; }, { 'Proficiency Bonus': (derived.proficiencyBonus >= 0 ? '+' : '') + derived.proficiencyBonus }),
      abilities: g.abilities.slice(0, 60).map(function (a) { return { name: a.name, actionType: a.actionType, what: a.what.slice(0, 700) }; }),
      combat: g.howToPlay.combat.slice(0, 20),
      outside: g.howToPlay.outside.slice(0, 20),
      mistakes: g.howToPlay.mistakes.slice(0, 20),
      combos: [].concat(g.combos.now, g.combos.situational, g.combos.option, g.combos.future).slice(0, 40).map(function (c) {
        return { title: c.title, why: c.why, status: c.status === 'future' ? 'level ' + c.level : c.status };
      }),
      strengths: g.strengths.strengths.slice(0, 20),
      weaknesses: g.strengths.weaknesses.slice(0, 20),
    };
  }

  var namesCache = null;
  /** Every rules name in the dataset that an AI paragraph could mention. */
  function allRuleNames() {
    if (namesCache) return namesCache;
    var R = Api().rules();
    var names = [];
    Object.values(R.spells).forEach(function (s) { names.push(s.name); });
    Object.values(R.feats).forEach(function (f) { names.push(f.name); });
    Object.values(R.invocations || {}).forEach(function (i) { names.push(i.name); });
    Object.values(R.metamagic || {}).forEach(function (m) { names.push(m.name); });
    Object.values(R.classes).forEach(function (c) {
      c.features.concat(c.subclass.features).forEach(function (f) { if (f.name.length > 4 && !/Subclass$|Ability Score Improvement|Epic Boon|Spellcasting|Expertise/.test(f.name)) names.push(f.name); });
    });
    namesCache = names.filter(function (n, i) { return names.indexOf(n) === i; }).sort(function (a, b) { return b.length - a.length; });
    return namesCache;
  }

  /**
   * Keep only paragraphs whose rules names and numbers all appear in the verified facts.
   * Returns { sections, dropped }.
   */
  function validate(sections, facts, guide) {
    var factText = JSON.stringify(facts);
    var allowed = {};
    guide.abilities.forEach(function (a) { allowed[a.name] = true; });
    [].concat(guide.combos.now, guide.combos.option, guide.combos.future, guide.combos.situational).forEach(function (c) { allowed[c.title] = true; });
    var names = allRuleNames();
    var dropped = 0;
    var out = [];
    (sections || []).forEach(function (s) {
      if (!s || ['who', 'howToPlay', 'combos', 'strengths'].indexOf(s.id) < 0 || !Array.isArray(s.paragraphs)) return;
      var kept = s.paragraphs.filter(function (p) {
        if (typeof p !== 'string' || !p.trim() || p.length > 900) {
          dropped++;
          return false;
        }
        var bad = names.some(function (n) {
          return new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(p) && !allowed[n] && factText.indexOf(n) < 0;
        });
        var nums = p.match(/\b\d+d\d+\b|[+−-]\d+\b|\bDC \d+\b|\b\d+ (?:feet|ft\.?|Hit Points|HP)\b/g) || [];
        var badNum = nums.some(function (n) { return factText.indexOf(n.replace('−', '-')) < 0 && factText.indexOf(n) < 0; });
        if (bad || badNum) {
          dropped++;
          return false;
        }
        return true;
      });
      if (kept.length) out.push({ id: s.id, paragraphs: kept });
    });
    return { sections: out, dropped: dropped };
  }

  function readCache(charId, hash) {
    try {
      var c = JSON.parse(global.localStorage.getItem(CACHE_PREFIX + charId) || 'null');
      return c && c.hash === hash ? c : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(charId, entry) {
    try {
      global.localStorage.setItem(CACHE_PREFIX + charId, JSON.stringify(entry));
    } catch (e) { /* cache only */ }
  }

  /** Ask the server. Resolves { sections, dropped, model, cached } or rejects with a readable message. */
  function request(doc, guide, derived) {
    if (!enabled()) return Promise.reject(new Error('AI explanations are turned off.'));
    var cached = readCache(doc.id, guide.hash);
    if (cached) return Promise.resolve(Object.assign({ cached: true }, cached));
    var facts = factsFrom(guide, derived);
    return global.FogSupabase.functions.invoke('character-guide-ai', { body: { facts: facts } }).then(function (res) {
      if (res.error) {
        var status = res.error.context && res.error.context.status;
        throw new Error(status === 429 ? 'The AI service is busy or you asked too often. Try again in a minute.'
          : status === 401 ? 'Sign in to use AI explanations.'
            : status === 503 ? 'AI explanations aren\'t set up on the server yet.'
              : 'The AI explanation couldn\'t be loaded. The guide above is complete without it.');
      }
      var data = res.data || {};
      if (data.hash !== guide.hash) throw new Error('The AI answer was for an older version of this character, so it was discarded.');
      var v = validate(data.sections, facts, guide);
      if (!v.sections.length) throw new Error('The AI answer didn\'t pass the rules check, so it isn\'t shown.');
      var entry = { hash: guide.hash, model: data.model || null, sections: v.sections, dropped: v.dropped, at: new Date().toISOString() };
      writeCache(doc.id, entry);
      return Object.assign({ cached: false }, entry);
    });
  }

  function clear(charId) {
    try { global.localStorage.removeItem(CACHE_PREFIX + charId); } catch (e) { /* ignore */ }
  }

  global.FogGuideAI = { enabled: enabled, request: request, validate: validate, factsFrom: factsFrom, readCache: readCache, clear: clear };
})(window);
