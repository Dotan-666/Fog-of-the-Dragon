/**
 * Adventures, stored in Supabase (table public.adventures, migration 20261109120000_adventures.sql).
 * Row Level Security keeps every adventure private to its author.
 *
 * Every method is async and resolves { ok, ... } or { ok: false, message } — it never reports success unless the
 * database confirmed the write. save() uses the version the editor loaded; when someone else (another tab or device)
 * saved in between, it returns { ok: false, conflict: true } instead of overwriting their work.
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogAdventureModel; };
  var SUMMARY = 'id, title, description, cover_image, genre, theme, level_min, level_max, playtime, status, chapter_count, section_count, version, created_at, updated_at';

  function sb() { return global.FogSupabase && global.FogSupabase.client; }
  function me() {
    var acc = global.FogAccount && global.FogAccount.getAccount();
    return acc ? acc.id : null;
  }
  function notReady() {
    if (!sb()) return { ok: false, message: (global.FogSupabase && global.FogSupabase.configError) || 'Supabase is not available, so adventures cannot be loaded or saved.' };
    if (!me()) return { ok: false, message: 'Sign in to use adventures.' };
    return null;
  }
  function fail(error, fallback) {
    var msg = error && error.message ? error.message : fallback;
    if (/Failed to fetch|NetworkError/i.test(msg || '')) msg = 'Can’t reach the server. Check your connection and try again.';
    if (/relation .* does not exist|column .* does not exist|Could not find the (table|function|column)|schema cache/i.test(msg || '')) {
      msg = 'The adventures database isn’t set up yet. The site owner needs to run supabase/migrations/20261109120000_adventures.sql once in Supabase → SQL Editor, then reload this page.';
    }
    if (/adventures_content_size/.test(msg || '')) msg = 'This adventure is too long to save. Split it into two adventures.';
    return { ok: false, message: msg || fallback || 'Something went wrong.' };
  }

  function fromRow(r) {
    var a = M().normalize({
      id: r.id, title: r.title, description: r.description, coverImage: r.cover_image, genre: r.genre, theme: r.theme,
      levelMin: r.level_min, levelMax: r.level_max, playtime: r.playtime, status: r.status, notes: r.notes,
      content: r.content || { schema: 1, chapters: [] }, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at,
    });
    a.chapterCount = r.chapter_count != null ? r.chapter_count : a.content.chapters.length;
    a.sectionCount = r.section_count != null ? r.section_count : M().stats(a).sections;
    return a;
  }
  function toRow(a) {
    return {
      title: a.title, description: a.description, cover_image: a.coverImage, genre: a.genre, theme: a.theme,
      level_min: a.levelMin, level_max: a.levelMax, playtime: a.playtime, status: a.status, notes: a.notes, content: a.content,
    };
  }

  async function list() {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('adventures').select(SUMMARY).order('updated_at', { ascending: false });
    if (res.error) return fail(res.error, 'Could not load your adventures.');
    return { ok: true, adventures: res.data.map(fromRow) };
  }

  async function get(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('adventures').select('*').eq('id', id).maybeSingle();
    if (res.error) return fail(res.error, 'Could not load the adventure.');
    if (!res.data) return { ok: false, notFound: true, message: 'This adventure doesn’t exist or isn’t yours.' };
    var links = await sb().from('campaigns').select('id, name, status').eq('adventure_id', id);
    return { ok: true, adventure: fromRow(res.data), campaigns: links.error ? [] : links.data };
  }

  async function create(fields) {
    var nr = notReady();
    if (nr) return nr;
    var a = M().newAdventure(fields);
    var errs = M().validate(a);
    if (errs.length) return { ok: false, message: errs[0] };
    var res = await sb().from('adventures').insert(toRow(a)).select('*').single();
    if (res.error) return fail(res.error, 'Could not create the adventure.');
    return { ok: true, adventure: fromRow(res.data) };
  }

  /** Saves the whole adventure if nobody saved a newer version in between. */
  async function save(adventure) {
    var nr = notReady();
    if (nr) return nr;
    var a = M().normalize(adventure);
    var errs = M().validate(a);
    if (errs.length) return { ok: false, message: errs[0] };
    var res = await sb().from('adventures').update(toRow(a)).eq('id', adventure.id).eq('version', adventure.version).select('version, updated_at, chapter_count, section_count');
    if (res.error) return fail(res.error, 'Could not save the adventure.');
    if (!res.data.length) {
      var still = await sb().from('adventures').select('version').eq('id', adventure.id).maybeSingle();
      if (!still.error && !still.data) return { ok: false, message: 'This adventure no longer exists (it may have been deleted).' };
      return { ok: false, conflict: true, message: 'This adventure was saved somewhere else (another tab or device) after you opened it. Reload to get the newest version; your text here is kept as a backup.' };
    }
    return { ok: true, version: res.data[0].version, updatedAt: res.data[0].updated_at };
  }

  async function setStatus(id, status) {
    var nr = notReady();
    if (nr) return nr;
    if (M().STATUSES.indexOf(status) < 0) return { ok: false, message: 'Unknown status.' };
    var res = await sb().from('adventures').update({ status: status }).eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not change the adventure.');
    if (!res.data.length) return { ok: false, message: 'This adventure doesn’t exist or isn’t yours.' };
    return { ok: true };
  }

  async function duplicate(id) {
    var cur = await get(id);
    if (!cur.ok) return cur;
    var copy = M().duplicate(cur.adventure);
    var res = await sb().from('adventures').insert(toRow(copy)).select('*').single();
    if (res.error) return fail(res.error, 'Could not duplicate the adventure.');
    var made = fromRow(res.data);
    // Images: the copy gets its own files, so deleting one adventure never breaks the other.
    var paths = M().imagePaths(made);
    if (paths.length) {
      var map = global.FogContentImages ? (await global.FogContentImages.copy(paths, 'adventures', made.id)).map || {} : {};
      made.content.chapters.forEach(function (c) {
        var fix = function (list) { return list.filter(function (im) { return map[im.path]; }).map(function (im) { return Object.assign({}, im, { path: map[im.path] }); }); };
        c.images = fix(c.images);
        c.sections.forEach(function (s) { s.images = fix(s.images); });
      });
      (made.content.assets || []).forEach(function (x) {
        x.images = x.images.filter(function (im) { return map[im.path]; }).map(function (im) { return Object.assign({}, im, { path: map[im.path] }); });
      });
      var upd = await sb().from('adventures').update({ content: made.content }).eq('id', made.id).select('version').single();
      if (!upd.error) made.version = upd.data.version;
    }
    return { ok: true, adventure: made };
  }

  async function remove(id) {
    var nr = notReady();
    if (nr) return nr;
    var res = await sb().from('adventures').delete().eq('id', id).select('id');
    if (res.error) return fail(res.error, 'Could not delete the adventure.');
    if (!res.data.length) return { ok: false, message: 'This adventure doesn’t exist or isn’t yours.' };
    if (global.FogContentImages) await global.FogContentImages.removeFolder('adventures', id); // its images go too
    return { ok: true };
  }

  global.FogAdventureStore = { list: list, get: get, create: create, save: save, setStatus: setStatus, duplicate: duplicate, remove: remove };
})(window);
