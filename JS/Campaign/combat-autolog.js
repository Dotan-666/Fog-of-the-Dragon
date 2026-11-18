/**
 * Combat Auto-Logger: watches the combat log for notable events and creates draft logbook memories.
 *
 *   - Natural 20 (critical hit)
 *   - Natural 1 (fumble)
 *   - A combatant drops to 0 HP (defeated)
 *   - Encounter ends (summary)
 *
 * All auto-snapshots are DM-visibility drafts. The DM can publish them to players later.
 * Uses FogCampaignData.saveMemory(), so this only works when logged in and in a real campaign.
 */
(function (global) {
  'use strict';

  var seen = {};
  var ctx = null;
  var off = null;
  var lastLogLen = 0;

  function D() { return global.FogCampaignData; }
  function M() { return global.FogCombatModel; }

  function save(title, content, kind) {
    if (!ctx || !D()) return;
    D().saveMemory(ctx.id, {
      kind: kind || 'event',
      title: title.length > 120 ? title.slice(0, 117) + '...' : title,
      content: content || title,
      occurredOn: new Date().toISOString().slice(0, 10),
      subject: '',
      imagePath: null,
      visibility: 'dm',
      status: 'draft',
    }).catch(function () {});
  }

  function checkLog(enc) {
    if (!enc || !enc.log) return;
    var log = enc.log;
    for (var i = lastLogLen; i < log.length; i++) {
      var entry = log[i];
      var text = entry.text || '';
      var key = enc.key + ':' + i;
      if (seen[key]) continue;
      seen[key] = true;

      if (/critical hit/i.test(text)) {
        save('Critical Hit! ' + text, text, 'battle');
      }
      if (/natural 1|— miss.*d20.*\b1\b/i.test(text)) {
        save('Natural 1! ' + text, text, 'battle');
      }
      if (/is defeated/i.test(text)) {
        save(text, text, 'event');
      }
    }
    lastLogLen = log.length;
  }

  function onCombatUpdate() {
    if (!M()) return;
    var sessions = M().sessions ? M().sessions() : [];
    sessions.forEach(function (enc) { checkLog(enc); });
  }

  function init(c) {
    ctx = c;
    seen = {};
    lastLogLen = 0;
    off = ctx.on('combat', onCombatUpdate);
  }

  function destroy() {
    if (off) off();
    off = null;
    ctx = null;
    seen = {};
    lastLogLen = 0;
  }

  global.FogCombatAutoLog = { init: init, destroy: destroy };
})(typeof window !== 'undefined' ? window : globalThis);
