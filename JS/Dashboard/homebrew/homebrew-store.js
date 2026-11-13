/**
 * Homebrew entries, stored in Supabase (table public.homebrew, migration 20261110120100_homebrew.sql).
 * Row Level Security keeps every entry private to its author.
 *
 * Every method is async and resolves { ok, ... } or { ok: false, message }; it never reports success unless the
 * database confirmed the write. save() uses the version the editor loaded; when another tab or device saved in
 * between, it returns { ok: false, conflict: true } instead of overwriting that work.
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogHomebrewModel; };

  function sb() { return global.FogSupabase && global.FogSupabase.client; }
  function me() {
    var acc = global.FogAccount && global.FogAccount.getAccount();
    return acc ? acc.id : null;
  }
  function notReady() {
    if (!sb()) return { ok: false, message: (global.FogSupabase && global.FogSupabase.configError) || 'Supabase is not available, so homebrew cannot be loaded or saved.' };
    if (!me()) return { ok: false, message: 'Sign in to use homebrew.' };
    return null;
  }
  function fail(error, fallback) {
    var msg = error && error.message ? error.message : fallback;
    if (/Failed to fetch|NetworkError/i.test(msg || '')) msg = 'Can’t reach the server. Check your connection and try again.';
    if (/relation .* does not exist|Could not find the table|schema cache/i.test(msg || '')) {
      msg = 'The homebrew database isn’t set up yet. The site owner needs to run supabase/migrations/20261110120100_homebrew.sql once in Supabase → SQL Editor, then reload this page.';
    }
    if (/homebrew_data_size/.test(msg || '')) msg = 'This entry is too long to save. Shorten the descriptions.';
    return { ok: false, message: msg || fallback || 'Something went wrong.' };
  }

  function fromRow(r) {
    return M().normalize({ id: r.id, kind: r.kind, name: r.name, summary: r.summary, data: r.data, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at });
  }
  function toRow(e) {
    return { name: e.name, summary: e.summary, data: e.data };
  }

  /** All your entries (optionally only some kinds), newest first. */
  async function list(kinds) {
    var nr = notReady();
    if (nr) return nr;
    var q = sb().from('homebrew').select('*').order('updated_at', { ascending: false });
    if (kinds && kinds.length) q = q.in('kind', kinds);
    var res = await q;
    if (res.error) return fail(res.error, 'Could not load your homebrew.');
    return { ok: true, entries: res.data.map(fromRow) };
  }

  async function get(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('homebrew').select('*').eq('id', id).maybeSingle();
    if (res.error) return fail(res.error, 'Could not load this entry.');
    if (!res.data) return { ok: false, notFound: true, message: 'This homebrew entry doesn’t exist or isn’t yours.' };
    return { ok: true, entry: fromRow(res.data) };
  }

  async function create(kind, name) {
    var nr = notReady();
    if (nr) return nr;
    var e = M().newEntry(kind, name);
    var errs = M().validate(e);
    if (errs.length) return { ok: false, message: errs[0] };
    var res = await sb().from('homebrew').insert(Object.assign({ kind: e.kind }, toRow(e))).select('*').single();
    if (res.error) return fail(res.error, 'Could not create the entry.');
    return { ok: true, entry: fromRow(res.data) };
  }

  /** Saves the whole entry if nobody saved a newer version in between. */
  async function save(entry) {
    var nr = notReady();
    if (nr) return nr;
    var e = M().normalize(entry);
    var errs = M().validate(e);
    if (errs.length) return { ok: false, message: errs[0] };
    var res = await sb().from('homebrew').update(toRow(e)).eq('id', entry.id).eq('version', entry.version).select('version, updated_at');
    if (res.error) return fail(res.error, 'Could not save the entry.');
    if (!res.data.length) {
      var still = await sb().from('homebrew').select('version').eq('id', entry.id).maybeSingle();
      if (!still.error && !still.data) return { ok: false, message: 'This entry no longer exists (it may have been deleted).' };
      return { ok: false, conflict: true, message: 'This entry was saved somewhere else (another tab or device) after you opened it. Reload to get the newest version.' };
    }
    return { ok: true, version: res.data[0].version, updatedAt: res.data[0].updated_at };
  }

  async function duplicate(id) {
    var cur = await get(id);
    if (!cur.ok) return cur;
    var copy = M().duplicate(cur.entry);
    var picture = copy.data.image && copy.data.image.path;
    copy.data.image = null; // the copy gets its own file (below), so deleting one never breaks the other
    var res = await sb().from('homebrew').insert(Object.assign({ kind: copy.kind }, toRow(copy))).select('*').single();
    if (res.error) return fail(res.error, 'Could not duplicate the entry.');
    var made = fromRow(res.data);
    if (picture && global.FogContentImages) {
      var cp = await global.FogContentImages.copy([picture], 'homebrew', made.id);
      if (cp.map && cp.map[picture]) {
        made.data.image = { path: cp.map[picture] };
        var upd = await sb().from('homebrew').update({ data: made.data }).eq('id', made.id).select('version').single();
        if (!upd.error) made.version = upd.data.version;
      }
    }
    return { ok: true, entry: made };
  }

  async function remove(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('homebrew').delete().eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not delete the entry.');
    if (!res.data.length) return { ok: false, message: 'This homebrew entry doesn’t exist or isn’t yours.' };
    if (global.FogContentImages) await global.FogContentImages.removeFolder('homebrew', id); // its picture goes too
    return { ok: true };
  }

  global.FogHomebrewStore = { list: list, get: get, create: create, save: save, duplicate: duplicate, remove: remove };
})(window);
