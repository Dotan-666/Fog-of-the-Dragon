/**
 * Character limit (server-side registry, migration 20261115120000_character_limit.sql).
 *
 * Characters live in this browser (character-store.js), but how many a user may have is decided by the database:
 * a new character needs a slot from register_character(), which refuses when the plan's limit is reached (Free: 3;
 * Dungeon Master and Fogger of the Dragons: unlimited, as on the pricing page). Deleting a character frees its slot.
 * The store refuses to save a NEW character that has no slot, so calling the store directly can't get around it either.
 *
 * FogCharacterRegistry.ready()       → Promise<usage>  loads the usage once (first visit registers existing characters)
 * FogCharacterRegistry.claim(id)     → Promise<{ ok, usage } | { ok:false, limitReached, message }>
 * FogCharacterRegistry.release(id)   → Promise        frees the slot of a deleted character
 * FogCharacterRegistry.usage()       → { plan, limit, count, ids } | null
 * FogCharacterRegistry.mayCreate(id) → boolean         used by the store before saving a character it doesn't know yet
 * FogCharacterRegistry.blockMessage()
 *
 * When Supabase isn't configured or the migration isn't applied yet, the limit can't be checked: creation is then
 * allowed (there is nothing to enforce against) and a warning is logged. Network failures refuse creation instead.
 */
(function (global) {
  'use strict';

  var state = { usage: null, granted: {}, mode: 'unknown', error: null, loading: null };
  var LIMIT_TEXT = 'You’ve reached the Free plan’s limit of 3 characters. Delete a character you no longer need, or upgrade to Dungeon Master or Fogger of the Dragons for unlimited characters.';

  function sb() { return global.FogSupabase && global.FogSupabase.client; }
  function signedIn() { return !!(global.FogAccount && global.FogAccount.getAccount && global.FogAccount.getAccount()); }
  function notSetUp(err) { return /function .* does not exist|Could not find the function|schema cache|relation .* does not exist/i.test((err && err.message) || ''); }
  function localIds() {
    try { return (global.FogCharacterStore ? global.FogCharacterStore.listSummaries() : []).map(function (s) { return s.id; }); } catch (e) { return []; }
  }

  function apply(usage) {
    state.usage = usage;
    state.granted = {};
    (usage.ids || []).forEach(function (id) { state.granted[id] = true; });
    state.mode = 'enforced';
    try { global.dispatchEvent(new CustomEvent('fog:characters-usage', { detail: usage })); } catch (e) { /* old browsers */ }
    return usage;
  }

  function ready() {
    if (state.loading) return state.loading;
    state.loading = (async function () {
      if (!sb() || !signedIn()) { state.mode = 'unenforced'; return null; }
      var res = await sb().rpc('sync_character_registry', { p_ids: localIds() });
      if (res.error) {
        if (notSetUp(res.error)) {
          console.warn('Character limit not enforced: run supabase/migrations/20261115120000_character_limit.sql.');
          state.mode = 'unenforced';
          return null;
        }
        state.mode = 'error';
        state.error = res.error.message;
        state.loading = null; // try again next time
        return null;
      }
      return apply(res.data);
    })();
    return state.loading;
  }

  async function claim(id) {
    await ready();
    if (state.mode === 'unenforced') return { ok: true, usage: null };
    if (state.mode === 'error') return { ok: false, message: 'The character limit could not be checked (' + (state.error || 'no connection') + '). Check your connection and try again.' };
    if (state.granted[id]) return { ok: true, usage: state.usage };
    var res = await sb().rpc('register_character', { p_id: id });
    if (res.error) {
      var limit = res.error.hint === 'character_limit' || /allows up to/.test(res.error.message || '');
      if (limit) await refresh();
      return { ok: false, limitReached: limit, message: limit ? LIMIT_TEXT : 'The character could not be created: ' + res.error.message };
    }
    apply(res.data);
    return { ok: true, usage: state.usage };
  }

  async function release(id) {
    if (state.mode !== 'enforced' || !sb()) return;
    var res = await sb().rpc('unregister_character', { p_id: id });
    if (!res.error) apply(res.data);
  }

  async function refresh() {
    if (!sb() || !signedIn()) return null;
    var res = await sb().rpc('character_usage');
    return res.error ? null : apply(res.data);
  }

  function atLimit() {
    var u = state.usage;
    return !!(u && u.limit != null && u.count >= u.limit);
  }

  global.FogCharacterRegistry = {
    ready: ready,
    claim: claim,
    release: release,
    refresh: refresh,
    usage: function () { return state.usage; },
    atLimit: atLimit,
    mode: function () { return state.mode; },
    mayCreate: function (id) { return state.mode === 'unenforced' || !!state.granted[id]; },
    blockMessage: function () { return atLimit() ? LIMIT_TEXT : 'This character has no slot on your account yet. Create it from the Characters page.'; },
    LIMIT_TEXT: LIMIT_TEXT,
  };
})(window);
