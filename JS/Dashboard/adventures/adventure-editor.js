/**
 * Adventure editor (#adventures/<id>): details, chapters and sections with player-facing text kept apart from
 * private DM notes.
 *
 * Saving: changes autosave about a second after you stop typing (and immediately with Ctrl/Cmd+S or "Save now").
 * The status only says "Saved" after the database confirmed the write. Until then every change is also kept as a
 * local backup in this browser, so leaving the page, a failed save or a closed tab doesn't lose work: the next time the
 * adventure opens, the editor offers to restore it.
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogAdventureModel; };
  var Store = function () { return global.FogAdventureStore; };
  var AUTOSAVE_MS = 1200;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function clock(d) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function uidOfUser() {
    var acc = global.FogAccount && global.FogAccount.getAccount && global.FogAccount.getAccount();
    return acc ? acc.id : 'local';
  }

  function init(container, params) {
    var root = container.querySelector('#adventure-editor-root');
    var $ = function (s) { return root.querySelector(s); };
    var router = global.FogDashboardRouter;
    var id = params && params.id;
    var BACKUP_KEY = 'fog_adv_backup_' + uidOfUser() + '_' + id;
    var SEL_KEY = 'fog_adv_sel_' + id;

    var doc = null;
    var campaigns = [];
    var sel = { type: 'details' };
    var alive = true;
    var dirty = false;
    var saving = false;
    var againAfterSave = false;
    var saveTimer = null;
    var backupTimer = null;
    var outlineTimer = null;
    var lastSaved = null;
    var saveError = null;
    var conflict = false;
    var uploads = []; // images being uploaded: { hostId, name }
    var pendingDeletes = []; // removed image files, deleted from storage after the next confirmed save

    // -------------------------------------------------------------------------
    // Lookup helpers
    // -------------------------------------------------------------------------
    function chapterById(cid) { return doc.content.chapters.filter(function (c) { return c.id === cid; })[0] || null; }
    function sectionRef(cid, sid) {
      var c = chapterById(cid);
      var s = c && c.sections.filter(function (x) { return x.id === sid; })[0];
      return s ? { chapter: c, section: s, index: c.sections.indexOf(s) } : null;
    }
    function assetById(aid) { return (doc.content.assets || []).filter(function (x) { return x.id === aid; })[0] || null; }
    function validSel(s) {
      if (!s || s.type === 'details') return { type: 'details' };
      if (s.type === 'assets') return s;
      if (s.type === 'asset' && assetById(s.id)) return s;
      if (s.type === 'chapter' && chapterById(s.id)) return s;
      if (s.type === 'section' && sectionRef(s.chapterId, s.id)) return s;
      return { type: 'details' };
    }

    // -------------------------------------------------------------------------
    // Save status, autosave and backup
    // -------------------------------------------------------------------------
    function renderSave() {
      var el = $('#adv-save');
      var state = conflict ? 'error' : saving ? 'saving' : saveError ? 'error' : dirty ? 'unsaved' : 'saved';
      el.className = 'adv-save adv-save-' + state;
      if (state === 'saving') el.innerHTML = '<span class="adv-dot"></span>Saving…';
      else if (state === 'unsaved') el.innerHTML = '<span class="adv-dot"></span>Unsaved changes';
      else if (state === 'saved') el.innerHTML = '<span class="adv-dot"></span>' + (lastSaved ? 'All changes saved · ' + esc(clock(lastSaved)) : 'Saved');
      else el.innerHTML = '<span class="adv-dot"></span>Not saved: ' + esc(saveError || 'unknown error') +
        (conflict ? ' <button type="button" class="link-btn" data-ed-act="reload">Reload</button>' : ' <button type="button" class="link-btn" data-ed-act="retry">Retry</button>');
      $('#adv-save-now').disabled = !doc || saving || (!dirty && !saveError) || conflict;
    }

    function writeBackup() {
      clearTimeout(backupTimer);
      backupTimer = setTimeout(function () {
        try {
          global.localStorage.setItem(BACKUP_KEY, JSON.stringify({ doc: doc, baseVersion: doc.version, at: new Date().toISOString() }));
        } catch (e) { /* storage full or blocked: the save still goes to the server */ }
      }, 300);
    }
    function clearBackup() {
      clearTimeout(backupTimer);
      try { global.localStorage.removeItem(BACKUP_KEY); } catch (e) { /* ignore */ }
    }
    function readBackup() {
      try { return JSON.parse(global.localStorage.getItem(BACKUP_KEY) || 'null'); } catch (e) { return null; }
    }

    function changed() {
      dirty = true;
      saveError = null;
      writeBackup();
      clearTimeout(saveTimer);
      if (!conflict) saveTimer = setTimeout(saveNow, AUTOSAVE_MS);
      renderSave();
    }

    async function saveNow() {
      clearTimeout(saveTimer);
      if (!doc || conflict) return;
      if (saving) { againAfterSave = true; return; }
      var errs = M().validate(doc);
      if (errs.length) {
        saveError = errs[0];
        renderSave();
        return;
      }
      saving = true;
      renderSave();
      var sent = JSON.stringify(doc);
      var res = await Store().save(doc);
      saving = false;
      if (res.ok) {
        flushDeletes();
        doc.version = res.version;
        doc.updatedAt = res.updatedAt;
        lastSaved = new Date();
        saveError = null;
        if (JSON.stringify(Object.assign({}, doc, { version: JSON.parse(sent).version, updatedAt: JSON.parse(sent).updatedAt })) === sent) {
          dirty = false;
          clearBackup();
        } else {
          writeBackup();
          saveTimer = setTimeout(saveNow, AUTOSAVE_MS);
        }
      } else {
        saveError = res.message;
        conflict = !!res.conflict;
        writeBackup();
      }
      if (alive) renderSave();
      if (againAfterSave && alive) {
        againAfterSave = false;
        if (dirty) saveNow();
      }
    }

    function flushDeletes() {
      if (!pendingDeletes.length || !global.FogContentImages) return;
      var used = M().imagePaths(doc);
      var gone = pendingDeletes.filter(function (p) { return used.indexOf(p) < 0; });
      pendingDeletes = [];
      if (gone.length) global.FogContentImages.remove(gone);
    }

    // -------------------------------------------------------------------------
    // Outline
    // -------------------------------------------------------------------------
    function renderOutline() {
      var st = M().stats(doc);
      var cur = sel;
      var html = '<button type="button" class="adv-ol-item adv-ol-details' + (cur.type === 'details' ? ' is-current' : '') + '" data-ed-sel="details"' + (cur.type === 'details' ? ' aria-current="true"' : '') + '>' +
        '<span class="adv-ol-icon" aria-hidden="true">❖</span><span class="adv-ol-text">Adventure details</span></button>' +
        '<div class="adv-ol-head"><span>Chapters</span><span class="adv-ol-count">' + st.chapters + '</span></div>';
      if (!doc.content.chapters.length) html += '<p class="adv-ol-empty">No chapters yet.</p>';
      html += '<ol class="adv-ol-chapters">' + doc.content.chapters.map(function (c, ci) {
        var open = (cur.type === 'chapter' && cur.id === c.id) || (cur.type === 'section' && cur.chapterId === c.id);
        return '<li class="adv-ol-chapter' + (open ? ' is-open' : '') + '">' +
          '<button type="button" class="adv-ol-item' + (cur.type === 'chapter' && cur.id === c.id ? ' is-current' : '') + '" data-ed-sel="chapter" data-cid="' + esc(c.id) + '"' + (cur.type === 'chapter' && cur.id === c.id ? ' aria-current="true"' : '') + '>' +
          '<span class="adv-ol-num">' + (ci + 1) + '</span><span class="adv-ol-text">' + esc(c.title) + '</span><span class="adv-ol-count">' + c.sections.length + '</span></button>' +
          (c.sections.length ? '<ol class="adv-ol-sections">' + c.sections.map(function (s) {
            var on = cur.type === 'section' && cur.id === s.id;
            return '<li><button type="button" class="adv-ol-item adv-ol-section' + (on ? ' is-current' : '') + '" data-ed-sel="section" data-cid="' + esc(c.id) + '" data-sid="' + esc(s.id) + '"' + (on ? ' aria-current="true"' : '') + '>' +
              '<span class="adv-ol-icon" aria-hidden="true" title="' + esc(M().KINDS[s.kind].label) + '">' + esc(M().KINDS[s.kind].icon) + '</span><span class="adv-ol-text">' + esc(s.title) + '</span></button></li>';
          }).join('') + '</ol>' : '') + '</li>';
      }).join('') + '</ol>' +
        '<button type="button" class="btn btn-secondary btn-sm adv-ol-add" data-ed-act="add-chapter"' + (doc.content.chapters.length >= M().LIMITS.chapters ? ' disabled' : '') + '>+ Add chapter</button>' +
        '<div class="adv-ol-head"><span>Assets</span><span class="adv-ol-count">' + doc.content.assets.length + '</span></div>' +
        '<button type="button" class="adv-ol-item adv-ol-assets' + (cur.type === 'assets' ? ' is-current' : '') + '" data-ed-sel="assets"' + (cur.type === 'assets' ? ' aria-current="true"' : '') + '><span class="adv-ol-icon" aria-hidden="true">▤</span><span class="adv-ol-text">Assets &amp; book</span></button>' +
        (doc.content.assets.length ? '<ol class="adv-ol-sections adv-ol-assetlist">' + doc.content.assets.map(function (x) {
          var on = cur.type === 'asset' && cur.id === x.id;
          return '<li><button type="button" class="adv-ol-item adv-ol-section' + (on ? ' is-current' : '') + '" data-ed-sel="asset" data-aid="' + esc(x.id) + '"' + (on ? ' aria-current="true"' : '') + '>' +
            '<span class="adv-ol-icon" aria-hidden="true" title="' + esc(M().ASSET_TYPES[x.type].label) + '">' + esc(M().ASSET_TYPES[x.type].icon) + '</span><span class="adv-ol-text">' + esc(x.title) + '</span></button></li>';
        }).join('') + '</ol>' : '') +
        '<p class="adv-ol-stats">' + st.chapters + ' chapter' + (st.chapters === 1 ? '' : 's') + ' · ' + st.sections + ' section' + (st.sections === 1 ? '' : 's') + ' · ' + st.words.toLocaleString() + ' words</p>';
      $('#adv-outline').innerHTML = html;
    }
    function outlineSoon() {
      clearTimeout(outlineTimer);
      outlineTimer = setTimeout(function () { if (alive) renderOutline(); }, 250);
    }

    // -------------------------------------------------------------------------
    // Main panel
    // -------------------------------------------------------------------------
    function input(bind, value, label, opts) {
      opts = opts || {};
      return '<label class="adv-field' + (opts.wide ? ' adv-field-wide' : '') + '"><span class="adv-label">' + esc(label) + '</span>' +
        '<input type="text" class="form-control-dark" data-bind="' + bind + '" value="' + esc(value) + '" maxlength="' + (opts.max || 200) + '"' + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') + (opts.required ? ' required' : '') + '></label>';
    }
    function area(bind, value, label, opts) {
      opts = opts || {};
      return '<label class="adv-field adv-field-wide ' + (opts.cls || '') + '"><span class="adv-label">' + (opts.icon ? '<span aria-hidden="true">' + opts.icon + '</span> ' : '') + esc(label) + (opts.hint ? ' <em>' + esc(opts.hint) + '</em>' : '') + '</span>' +
        '<textarea class="form-control-dark adv-text" data-bind="' + bind + '" rows="' + (opts.rows || 4) + '" maxlength="' + (opts.max || M().LIMITS.text) + '"' + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') + '>' + esc(value) + '</textarea></label>';
    }
    function select(bind, value, label, options) {
      return '<label class="adv-field"><span class="adv-label">' + esc(label) + '</span><select class="form-control-dark" data-bind="' + bind + '">' +
        options.map(function (o) { var v = Array.isArray(o) ? o[0] : o; var t = Array.isArray(o) ? o[1] : (o || '—'); return '<option value="' + esc(v) + '"' + (String(v) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>';
    }
    function levelOptions() {
      return [['', '—']].concat(Array.from({ length: 20 }, function (_, i) { return [String(i + 1), String(i + 1)]; }));
    }

    function detailsPanel() {
      var genres = M().GENRES.slice();
      if (doc.genre && genres.indexOf(doc.genre) < 0) genres.unshift(doc.genre);
      return '<section class="adv-panel"><header class="adv-panel-head"><div><p class="adv-crumb">Adventure details</p><h2>' + esc(doc.title) + '</h2></div></header>' +
        '<div class="adv-cover-edit">' +
        '<div class="adv-cover-preview">' + (doc.coverImage ? '<img src="' + esc(doc.coverImage) + '" alt="Cover">' : '<span class="adv-cover-placeholder" aria-hidden="true">' + esc((doc.title || '?').charAt(0).toUpperCase()) + '</span>') + '</div>' +
        '<div class="adv-cover-actions"><span class="adv-label">Cover image</span>' +
        '<label class="btn btn-secondary btn-sm adv-file-btn">Choose image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-ed-file="cover" hidden></label>' +
        (doc.coverImage ? ' <button type="button" class="link-btn" data-ed-act="remove-cover">Remove</button>' : '') +
        '<p class="adv-help">Resized to 640 px and stored with the adventure (JPEG, up to about 150 KB).</p><p class="adv-form-error" id="adv-cover-error" role="alert" hidden></p></div></div>' +
        '<div class="adv-fields">' +
        input('adv.title', doc.title, 'Title', { max: 100, wide: true, required: true }) +
        area('adv.description', doc.description, 'Short description', { rows: 3, max: 1000, placeholder: 'A one-paragraph pitch: what the adventure is about.' }) +
        select('adv.genre', doc.genre, 'Genre', [''].concat(genres)) +
        input('adv.theme', doc.theme, 'Theme', { max: 80, placeholder: 'e.g. betrayal, a cursed bell, survival' }) +
        '<div class="adv-field"><span class="adv-label">Recommended party level</span><div class="adv-level-pair">' +
        '<select class="form-control-dark" data-bind="adv.levelMin" aria-label="Lowest level">' + levelOptions().map(function (o) { return '<option value="' + o[0] + '"' + (String(doc.levelMin == null ? '' : doc.levelMin) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select><span>to</span>' +
        '<select class="form-control-dark" data-bind="adv.levelMax" aria-label="Highest level">' + levelOptions().map(function (o) { return '<option value="' + o[0] + '"' + (String(doc.levelMax == null ? '' : doc.levelMax) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>' +
        input('adv.playtime', doc.playtime, 'Estimated playtime', { max: 40, placeholder: 'e.g. 2–3 sessions, about 8 hours' }) +
        area('adv.notes', doc.notes, 'General notes', { rows: 6, max: M().LIMITS.notes, cls: 'adv-dm', icon: '🔒', hint: 'only you see these', placeholder: 'Themes to hit, the big secret, how it can end, prep reminders…' }) +
        '</div>' +
        '<section class="adv-linked"><h3>Campaigns using this adventure</h3>' + (campaigns.length
          ? '<ul>' + campaigns.map(function (c) { return '<li><a href="#campaigns/' + esc(c.id) + '" data-fog-go="#campaigns/' + esc(c.id) + '">' + esc(c.name) + '</a>' + (c.status === 'archived' ? ' <span class="adv-muted">(archived)</span>' : '') + '</li>'; }).join('') + '</ul>'
          : '<p class="adv-help">None yet. To run it, open one of your campaigns and choose this adventure in its Settings. The adventure stays here; nothing is copied.</p>') + '</section>' +
        '<div class="adv-next"><button type="button" class="btn btn-primary" data-ed-act="add-chapter">' + (doc.content.chapters.length ? '+ Add another chapter' : '+ Add the first chapter') + '</button></div></section>';
    }

    function chapterPanel(c) {
      var ci = doc.content.chapters.indexOf(c);
      var n = doc.content.chapters.length;
      return '<section class="adv-panel"><header class="adv-panel-head"><div><p class="adv-crumb">Chapter ' + (ci + 1) + ' of ' + n + '</p><h2>' + esc(c.title) + '</h2></div>' +
        '<div class="adv-panel-tools">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-ed-act="chapter-up"' + (ci === 0 ? ' disabled' : '') + ' aria-label="Move chapter up">▲ Up</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-ed-act="chapter-down"' + (ci === n - 1 ? ' disabled' : '') + ' aria-label="Move chapter down">▼ Down</button>' +
        '<button type="button" class="btn btn-outline-crimson btn-sm" data-ed-act="chapter-delete">Delete chapter</button></div></header>' +
        '<div class="adv-fields">' +
        input('chapter.title', c.title, 'Chapter title', { max: 100, wide: true }) +
        area('chapter.summary', c.summary, 'Overview', { rows: 4, hint: 'what happens in this chapter', placeholder: 'The situation, the goal, how it starts and how it can end.' }) +
        area('chapter.dmNotes', c.dmNotes, 'DM notes', { rows: 4, cls: 'adv-dm', icon: '🔒', hint: 'only you see these', placeholder: 'Pacing, branches, what to prepare…' }) +
        '</div>' + imagesBlock(c) + linkedAssetsBlock(c.id) +
        '<section class="adv-sections"><div class="adv-sections-head"><h3>Sections <span class="adv-muted">(' + c.sections.length + ')</span></h3></div>' +
        (c.sections.length ? '<ol class="adv-section-list">' + c.sections.map(function (s, si) {
          var fieldText = Object.keys(s.fields).map(function (k) { return s.fields[k]; }).join(' · ');
          var preview = (s.playerText || s.dmNotes || fieldText || '').replace(/\s+/g, ' ').slice(0, 160);
          return '<li class="adv-section-card"><button type="button" class="adv-section-open" data-ed-sel="section" data-cid="' + esc(c.id) + '" data-sid="' + esc(s.id) + '">' +
            '<span class="adv-kind adv-kind-' + esc(s.kind) + '"><span aria-hidden="true">' + esc(M().KINDS[s.kind].icon) + '</span> ' + esc(M().KINDS[s.kind].label) + '</span>' +
            '<strong>' + esc(s.title) + '</strong>' + (preview ? '<span class="adv-section-preview">' + esc(preview) + (preview.length >= 160 ? '…' : '') + '</span>' : '<span class="adv-section-preview adv-muted">Empty</span>') + '</button>' +
            '<span class="adv-section-tools">' +
            '<button type="button" class="adv-icon-btn" data-ed-act="section-up" data-sid="' + esc(s.id) + '"' + (si === 0 ? ' disabled' : '') + ' aria-label="Move ' + esc(s.title) + ' up">▲</button>' +
            '<button type="button" class="adv-icon-btn" data-ed-act="section-down" data-sid="' + esc(s.id) + '"' + (si === c.sections.length - 1 ? ' disabled' : '') + ' aria-label="Move ' + esc(s.title) + ' down">▼</button>' +
            '<button type="button" class="adv-icon-btn" data-ed-act="section-delete" data-sid="' + esc(s.id) + '" aria-label="Delete ' + esc(s.title) + '">✕</button></span></li>';
        }).join('') + '</ol>' : '<p class="adv-help">This chapter has no sections yet. Add the scenes, places, people and fights the players will meet.</p>') +
        '<div class="adv-add-kinds" role="group" aria-label="Add a section">' + M().KIND_ORDER.map(function (k) {
          return '<button type="button" class="adv-add-kind" data-ed-act="add-section" data-kind="' + k + '" title="' + esc(M().KINDS[k].hint) + '"' + (c.sections.length >= M().LIMITS.sections ? ' disabled' : '') + '><span aria-hidden="true">' + esc(M().KINDS[k].icon) + '</span> ' + esc(M().KINDS[k].label) + '</button>';
        }).join('') + '</div></section></section>';
    }

    // -------------------------------------------------------------------------
    // Assets (content.assets) and book layout settings (content.book)
    // -------------------------------------------------------------------------
    function linkLabel(x) {
      if (!x.link) return 'Not placed in a chapter';
      var c = chapterById(x.link.chapterId);
      var sec = x.link.sectionId && c ? c.sections.filter(function (y) { return y.id === x.link.sectionId; })[0] : null;
      return c ? c.title + (sec ? ' › ' + sec.title : '') : 'Not placed in a chapter';
    }
    function assetChips(list) {
      if (!list.length) return '';
      return '<ul class="adv-asset-chips">' + list.map(function (x) {
        return '<li><button type="button" class="adv-asset-chip" data-ed-sel="asset" data-aid="' + esc(x.id) + '"><span aria-hidden="true">' + esc(M().ASSET_TYPES[x.type].icon) + '</span> ' + esc(x.title) + ' <span class="adv-muted">' + esc(M().ASSET_TYPES[x.type].label) + '</span></button></li>';
      }).join('') + '</ul>';
    }
    /** Linked assets shown on a chapter or section, with a quick way to attach a new one there. */
    function linkedAssetsBlock(chapterId, sectionId) {
      var list = M().assetsFor(doc, chapterId, sectionId === undefined ? undefined : sectionId);
      var full = doc.content.assets.length >= M().LIMITS.assets;
      return '<section class="adv-linked-assets" aria-label="Assets used here"><div class="adv-images-head"><span class="adv-label">Assets used here <em>(' + list.length + ')</em></span>' +
        '<span class="adv-help">NPCs, maps, handouts and other things this ' + (sectionId === undefined ? 'chapter' : 'section') + ' uses. They live in the adventure’s Assets, so you can reuse them.</span></div>' +
        assetChips(list) +
        '<div class="adv-add-kinds" role="group" aria-label="Attach a new asset here">' + M().ASSET_ORDER.map(function (k) {
          return '<button type="button" class="adv-add-kind" data-ed-act="add-asset" data-type="' + k + '" data-link-cid="' + esc(chapterId) + '"' + (sectionId ? ' data-link-sid="' + esc(sectionId) + '"' : '') + ' title="' + esc(M().ASSET_TYPES[k].hint) + '"' + (full ? ' disabled' : '') + '><span aria-hidden="true">' + esc(M().ASSET_TYPES[k].icon) + '</span> ' + esc(M().ASSET_TYPES[k].label) + '</button>';
        }).join('') + '</div></section>';
    }

    function assetsPanel() {
      var list = doc.content.assets;
      var book = doc.content.book;
      var full = list.length >= M().LIMITS.assets;
      var groups = M().ASSET_ORDER.map(function (t) {
        var items = list.filter(function (x) { return x.type === t; });
        if (!items.length) return '';
        return '<section class="adv-asset-group"><h3><span aria-hidden="true">' + esc(M().ASSET_TYPES[t].icon) + '</span> ' + esc(M().ASSET_TYPES[t].plural) + ' <span class="adv-muted">(' + items.length + ')</span></h3><ul class="adv-asset-list">' + items.map(function (x) {
          return '<li class="adv-asset-card"><button type="button" class="adv-section-open" data-ed-sel="asset" data-aid="' + esc(x.id) + '"><strong>' + esc(x.title) + '</strong>' +
            '<span class="adv-section-preview">' + esc((x.summary || x.dmNotes || '').replace(/\s+/g, ' ').slice(0, 140) || 'Empty') + '</span>' +
            '<span class="adv-asset-meta">' + esc(linkLabel(x)) + (x.images.length ? ' · ' + x.images.length + ' image' + (x.images.length === 1 ? '' : 's') : '') + (x.printable ? ' · in the book' : '') + (x.playerVisible ? ' · players may see it' : '') + (x.origin === 'foggy' ? ' · <span class="adv-from-foggy">from Foggy</span>' : '') + '</span></button></li>';
        }).join('') + '</ul></section>';
      }).join('');
      return '<section class="adv-panel"><header class="adv-panel-head"><div><p class="adv-crumb">Adventure</p><h2>Assets &amp; book</h2></div></header>' +
        '<p class="adv-help">Everything the adventure carries besides its text: NPCs, portraits, maps, locations, monsters and encounters, magic items, spells and handouts. Place each one in a chapter or section, and choose what goes into the book.</p>' +
        '<div class="adv-add-kinds" role="group" aria-label="Add an asset">' + M().ASSET_ORDER.map(function (k) {
          return '<button type="button" class="adv-add-kind" data-ed-act="add-asset" data-type="' + k + '" title="' + esc(M().ASSET_TYPES[k].hint) + '"' + (full ? ' disabled' : '') + '><span aria-hidden="true">' + esc(M().ASSET_TYPES[k].icon) + '</span> ' + esc(M().ASSET_TYPES[k].label) + '</button>';
        }).join('') + '</div>' +
        (groups || '<p class="adv-empty-assets">No assets yet. Add an NPC, a map or a handout above, or from any chapter or section.</p>') +
        (full ? '<p class="adv-help">This adventure has the maximum of ' + M().LIMITS.assets + ' assets.</p>' : '') +
        '<section class="adv-book" aria-labelledby="adv-book-h"><h3 id="adv-book-h">Printable book <span class="adv-soon">Coming later</span></h3>' +
        '<p class="adv-help">These choices prepare the layout of a printable book of this adventure. <strong>Printing or exporting an adventure to PDF is not available yet</strong>; nothing is generated from these settings today.</p>' +
        '<div class="adv-fields">' +
        select('book.pageSize', book.pageSize, 'Page size', [['letter', 'US Letter'], ['a4', 'A4']]) +
        '<label class="adv-check"><input type="checkbox" data-bind="book.appendix"' + (book.appendix ? ' checked' : '') + '> Add an appendix with the assets marked “In the book”</label>' +
        '<label class="adv-check"><input type="checkbox" data-bind="book.includeHandouts"' + (book.includeHandouts ? ' checked' : '') + '> Add handouts as separate pages to cut out</label>' +
        '</div><p class="adv-help">In the book: ' + list.filter(function (x) { return x.printable; }).length + ' of ' + list.length + ' assets.</p></section></section>';
    }

    function assetPanel(x) {
      var T = M().ASSET_TYPES[x.type];
      var idx = doc.content.assets.indexOf(x);
      var linkOptions = [['', 'Not placed in a chapter']];
      doc.content.chapters.forEach(function (c) {
        linkOptions.push([c.id + '|', c.title]);
        c.sections.forEach(function (sec) { linkOptions.push([c.id + '|' + sec.id, '\u00a0\u00a0\u00a0' + c.title + ' › ' + sec.title]); });
      });
      var linkVal = x.link ? x.link.chapterId + '|' + (x.link.sectionId || '') : '';
      var fields = T.fields.map(function (f) {
        var v = x.fields[f.key] || '';
        if (f.options) return select('afield.' + f.key, v, f.label, f.options.map(function (o) { return [o, o || '—']; }));
        return f.multiline ? area('afield.' + f.key, v, f.label, { rows: 3, max: M().LIMITS.field, placeholder: f.placeholder }) : input('afield.' + f.key, v, f.label, { max: M().LIMITS.field, placeholder: f.placeholder });
      }).join('');
      var refBlock = x.type === 'monster' || x.type === 'spell' || x.type === 'item'
        ? '<div class="adv-field adv-field-wide"><span class="adv-label">Rules reference <em>a stat block or spell in Monsters &amp; Spells, instead of copying it</em></span><div class="adv-ref-row">' +
          '<select class="form-control-dark" data-bind="asset.refSource" aria-label="Where the rules are"><option value="">—</option>' + Object.keys(M().REF_SOURCES).map(function (k) { return '<option value="' + k + '"' + (x.ref && x.ref.source === k ? ' selected' : '') + '>' + esc(M().REF_SOURCES[k]) + '</option>'; }).join('') + '</select>' +
          '<input type="text" class="form-control-dark" data-bind="asset.refName" value="' + esc(x.ref ? x.ref.name : '') + '" maxlength="120" placeholder="Name, e.g. Goblin Boss" aria-label="Name in that book"></div></div>'
        : '';
      return '<section class="adv-panel"><header class="adv-panel-head"><div>' +
        '<p class="adv-crumb"><button type="button" class="link-btn" data-ed-sel="assets">Assets</button> › ' + esc(T.label) + (x.origin === 'foggy' ? ' · <span class="adv-from-foggy">saved from Foggy</span>' : '') + '</p>' +
        '<h2><span aria-hidden="true">' + esc(T.icon) + '</span> ' + esc(x.title) + '</h2></div>' +
        '<div class="adv-panel-tools">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-ed-act="asset-up"' + (idx === 0 ? ' disabled' : '') + ' aria-label="Move asset up">▲</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-ed-act="asset-down"' + (idx === doc.content.assets.length - 1 ? ' disabled' : '') + ' aria-label="Move asset down">▼</button>' +
        '<button type="button" class="btn btn-outline-crimson btn-sm" data-ed-act="asset-delete">Delete</button></div></header>' +
        '<div class="adv-fields">' +
        select('asset.type', x.type, 'Type', M().ASSET_ORDER.map(function (k) { return [k, M().ASSET_TYPES[k].label]; })) +
        input('asset.title', x.title, 'Name', { max: 120 }) +
        select('asset.link', linkVal, 'Used in', linkOptions) +
        fields + refBlock +
        area('asset.summary', x.summary, 'Description', { rows: 5, max: M().LIMITS.summary, cls: 'adv-player', icon: '📜', hint: 'what players may see or hear', placeholder: 'How it looks, what is written on it, what the players learn…' }) +
        area('asset.dmNotes', x.dmNotes, 'DM only', { rows: 5, cls: 'adv-dm', icon: '🔒', hint: 'never shown to players', placeholder: 'Secrets, stats, how to use it at the table…' }) +
        '<label class="adv-check"><input type="checkbox" data-bind="asset.printable"' + (x.printable ? ' checked' : '') + '> In the book (appendix of the future printable book)</label>' +
        '<label class="adv-check"><input type="checkbox" data-bind="asset.playerVisible"' + (x.playerVisible ? ' checked' : '') + '> Players may see the description and pictures</label>' +
        '</div>' + imagesBlock(x) + '</section>';
    }

    function sectionPanel(ref) {
      var c = ref.chapter;
      var s = ref.section;
      var kind = M().KINDS[s.kind];
      var all = [];
      doc.content.chapters.forEach(function (ch) { ch.sections.forEach(function (x) { all.push({ cid: ch.id, sid: x.id, title: x.title }); }); });
      var pos = all.findIndex(function (x) { return x.sid === s.id; });
      var prev = all[pos - 1];
      var next = all[pos + 1];
      var fields = kind.fields.map(function (f) {
        var v = s.fields[f.key] || '';
        if (f.options) return select('field.' + f.key, v, f.label, f.options.map(function (o) { return [o, o || '—']; }));
        return f.multiline ? area('field.' + f.key, v, f.label, { rows: 3, max: M().LIMITS.field, placeholder: f.placeholder }) : input('field.' + f.key, v, f.label, { max: M().LIMITS.field, placeholder: f.placeholder });
      }).join('');
      return '<section class="adv-panel"><header class="adv-panel-head"><div>' +
        '<p class="adv-crumb"><button type="button" class="link-btn" data-ed-sel="chapter" data-cid="' + esc(c.id) + '">' + esc(c.title) + '</button> › ' + esc(kind.label) + ' ' + (ref.index + 1) + ' of ' + c.sections.length + '</p>' +
        '<h2><span class="adv-kind adv-kind-' + esc(s.kind) + '" aria-hidden="true">' + esc(kind.icon) + '</span> ' + esc(s.title) + '</h2></div>' +
        '<div class="adv-panel-tools">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-ed-act="section-up" data-sid="' + esc(s.id) + '"' + (ref.index === 0 ? ' disabled' : '') + ' aria-label="Move section up">▲</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-ed-act="section-down" data-sid="' + esc(s.id) + '"' + (ref.index === c.sections.length - 1 ? ' disabled' : '') + ' aria-label="Move section down">▼</button>' +
        '<button type="button" class="btn btn-outline-crimson btn-sm" data-ed-act="section-delete" data-sid="' + esc(s.id) + '">Delete</button></div></header>' +
        '<div class="adv-fields">' +
        select('section.kind', s.kind, 'Type', M().KIND_ORDER.map(function (k) { return [k, M().KINDS[k].label]; })) +
        input('section.title', s.title, 'Title', { max: 120 }) +
        fields +
        area('section.playerText', s.playerText, 'For the players', { rows: 8, cls: 'adv-player', icon: '📜', hint: 'read aloud or share', placeholder: s.kind === 'npc' ? 'What the NPC says or what the players see…' : 'Boxed text: what the players see, hear and feel.' }) +
        area('section.dmNotes', s.dmNotes, 'DM only', { rows: 8, cls: 'adv-dm', icon: '🔒', hint: 'secrets, clues, tactics — never shown to players', placeholder: 'What is really going on, checks and DCs, what happens next…' }) +
        '</div>' + imagesBlock(s) + linkedAssetsBlock(c.id, s.id) +
        '<div class="adv-add-after"><span class="adv-label">Add after this</span><div class="adv-add-kinds" role="group" aria-label="Add a section after this one">' + M().KIND_ORDER.map(function (k) {
          return '<button type="button" class="adv-add-kind" data-ed-act="add-section" data-kind="' + k + '" title="' + esc(M().KINDS[k].hint) + '"' + (c.sections.length >= M().LIMITS.sections ? ' disabled' : '') + '><span aria-hidden="true">' + esc(M().KINDS[k].icon) + '</span> ' + esc(M().KINDS[k].label) + '</button>';
        }).join('') + '</div></div>' +
        '<nav class="adv-pager" aria-label="Sections">' +
        (prev ? '<button type="button" class="btn btn-secondary btn-sm" data-ed-sel="section" data-cid="' + esc(prev.cid) + '" data-sid="' + esc(prev.sid) + '">← ' + esc(prev.title) + '</button>' : '<span></span>') +
        '<span class="adv-muted">' + M().words(s.playerText + ' ' + s.dmNotes).toLocaleString() + ' words</span>' +
        (next ? '<button type="button" class="btn btn-secondary btn-sm" data-ed-sel="section" data-cid="' + esc(next.cid) + '" data-sid="' + esc(next.sid) + '">' + esc(next.title) + ' →</button>' : '<button type="button" class="btn btn-secondary btn-sm" data-ed-act="add-section" data-kind="scene">+ Add a scene</button>') +
        '</nav></section>';
    }

    // -------------------------------------------------------------------------
    // Images (chapters and sections): stored in the private "content-images" bucket, shown with signed URLs
    // -------------------------------------------------------------------------
    function imageHost() {
      if (sel.type === 'chapter') return chapterById(sel.id);
      if (sel.type === 'section') { var r = sectionRef(sel.chapterId, sel.id); return r && r.section; }
      if (sel.type === 'asset') return assetById(sel.id);
      return null;
    }
    function imageLimit(host) { return host && host.type && M().ASSET_TYPES[host.type] && host.fields && !host.sections ? M().LIMITS.assetImages : M().LIMITS.images; }
    function imagesBlock(host) {
      var list = host.images || [];
      var max = imageLimit(host);
      var full = list.length >= max;
      var busy = uploads.filter(function (u) { return u.hostId === host.id; });
      return '<section class="adv-images" aria-label="Images">' +
        '<div class="adv-images-head"><span class="adv-label">Images <em>(' + list.length + ' of ' + max + ')</em></span>' +
        '<span class="adv-help">Maps, portraits, scenes and handouts. Tick “Player handout” for pictures you may show the players.</span></div>' +
        (list.length || busy.length ? '<ul class="adv-image-grid">' + list.map(function (im, i) {
          return '<li class="adv-image' + (im.handout ? ' is-handout' : '') + '" data-img-id="' + esc(im.id) + '">' +
            '<button type="button" class="adv-image-frame" data-ed-act="img-view" data-img-id="' + esc(im.id) + '" aria-label="View image larger"><img data-img-path="' + esc(im.path) + '" alt="' + esc(im.caption || 'Adventure image') + '"><span class="adv-image-loading" aria-hidden="true"></span>' +
            (im.handout ? '<span class="adv-image-badge">Handout</span>' : '') + '</button>' +
            '<input type="text" class="form-control-dark adv-image-caption" data-img-caption="' + esc(im.id) + '" value="' + esc(im.caption) + '" maxlength="' + M().LIMITS.caption + '" placeholder="Caption" aria-label="Caption">' +
            '<div class="adv-image-row"><label class="adv-image-handout"><input type="checkbox" data-img-handout="' + esc(im.id) + '"' + (im.handout ? ' checked' : '') + '> Player handout</label>' +
            '<span class="adv-image-tools">' +
            '<button type="button" class="adv-icon-btn" data-ed-act="img-move" data-dir="-1" data-img-id="' + esc(im.id) + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move left">◀</button>' +
            '<button type="button" class="adv-icon-btn" data-ed-act="img-move" data-dir="1" data-img-id="' + esc(im.id) + '"' + (i === list.length - 1 ? ' disabled' : '') + ' aria-label="Move right">▶</button>' +
            '<button type="button" class="adv-icon-btn" data-ed-act="img-remove" data-img-id="' + esc(im.id) + '" aria-label="Remove image">✕</button></span></div></li>';
        }).join('') + busy.map(function (u) {
          return '<li class="adv-image is-uploading"><div class="adv-image-frame"><span class="adv-image-spinner" aria-hidden="true"></span></div><p class="adv-help">Uploading ' + esc(u.name) + '…</p></li>';
        }).join('') + '</ul>' : '') +
        (full ? '<p class="adv-help">This has the maximum of ' + max + ' images.</p>'
          : '<label class="adv-dropzone" tabindex="0" data-dropzone><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple data-ed-file="images" hidden>' +
            '<span class="adv-dropzone-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5.5-5.5L5 20"/></svg></span>' +
            '<span><strong>Drop images here</strong>, paste them, or <span class="adv-dropzone-link">choose files</span></span>' +
            '<span class="adv-help">JPG, PNG, WEBP or GIF. Resized to 1600 px in your browser, private to you.</span></label>') +
        '<p class="adv-form-error" id="adv-img-error" role="alert" hidden></p></section>';
    }
    function refreshImages() {
      var host = imageHost();
      var block = $('#adv-main .adv-images');
      if (!host || !block) return;
      block.outerHTML = imagesBlock(host);
      hydrateImages();
    }
    function imageError(msg) {
      var el = $('#adv-img-error');
      if (!el) return;
      el.textContent = msg || '';
      el.hidden = !msg;
    }
    async function hydrateImages() {
      var imgs = Array.prototype.slice.call(root.querySelectorAll('img[data-img-path]'));
      if (!imgs.length || !global.FogContentImages) return;
      var res = await global.FogContentImages.urls(imgs.map(function (i) { return i.getAttribute('data-img-path'); }));
      if (!alive) return;
      imgs.forEach(function (img) {
        var url = res.urls && res.urls[img.getAttribute('data-img-path')];
        var frame = img.parentNode;
        if (url) {
          img.onload = function () { frame.classList.add('is-loaded'); };
          img.onerror = function () { frame.classList.add('is-missing'); };
          img.src = url;
        } else {
          frame.classList.add('is-missing');
        }
      });
      if (!res.ok) imageError(res.message);
    }
    async function addImages(files) {
      var host = imageHost();
      if (!host || !doc || conflict) return;
      if (!global.FogContentImages) { imageError('Images can’t be added on this page.'); return; }
      files = Array.prototype.slice.call(files || []).filter(function (f) { return f && f.type && f.type.indexOf('image/') === 0; });
      if (!files.length) { imageError('That isn’t an image file.'); return; }
      var max = imageLimit(host);
      var room = max - host.images.length - uploads.filter(function (u) { return u.hostId === host.id; }).length;
      if (room <= 0) { imageError('This already has the maximum of ' + max + ' images.'); return; }
      var skipped = Math.max(0, files.length - room);
      files = files.slice(0, room);
      imageError('');
      var jobs = files.map(function (f) { var u = { hostId: host.id, name: f.name || 'image' }; uploads.push(u); return { file: f, job: u }; });
      refreshImages();
      var errors = [];
      for (var i = 0; i < jobs.length; i++) {
        var res = await global.FogContentImages.upload('adventures', doc.id, jobs[i].file);
        uploads.splice(uploads.indexOf(jobs[i].job), 1);
        if (!alive) return;
        if (res.ok) {
          host.images.push(M().newImage(res.path, ''));
          changed();
        } else {
          errors.push(res.message);
        }
        if (imageHost() === host) refreshImages();
      }
      if (skipped) errors.push(skipped + ' image' + (skipped === 1 ? ' was' : 's were') + ' not added (at most ' + max + ').');
      if (errors.length && imageHost() === host) imageError(errors.join(' '));
    }
    function imageById(host, imgId) {
      return (host && host.images || []).filter(function (im) { return im.id === imgId; })[0] || null;
    }
    function viewImage(im) {
      var img = root.querySelector('img[data-img-path="' + im.path + '"]');
      if (!img || !img.src) return;
      var box = document.createElement('div');
      box.className = 'adv-lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', im.caption || 'Image');
      box.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure><button type="button" class="adv-lightbox-close" aria-label="Close">✕</button>';
      box.querySelector('img').src = img.src;
      box.querySelector('img').alt = im.caption || 'Adventure image';
      box.querySelector('figcaption').textContent = im.caption || '';
      var close = function () { box.remove(); document.removeEventListener('keydown', esc_); };
      var esc_ = function (e) { if (e.key === 'Escape') close(); };
      box.addEventListener('click', function (e) { if (e.target === box || e.target.closest('.adv-lightbox-close')) close(); });
      document.addEventListener('keydown', esc_);
      root.appendChild(box);
      box.querySelector('.adv-lightbox-close').focus();
    }

    function renderMain(focusFirst) {
      sel = validSel(sel);
      try { global.sessionStorage.setItem(SEL_KEY, JSON.stringify(sel)); } catch (e) { /* preference only */ }
      var main = $('#adv-main');
      if (sel.type === 'chapter') main.innerHTML = chapterPanel(chapterById(sel.id));
      else if (sel.type === 'section') main.innerHTML = sectionPanel(sectionRef(sel.chapterId, sel.id));
      else if (sel.type === 'assets') main.innerHTML = assetsPanel();
      else if (sel.type === 'asset') main.innerHTML = assetPanel(assetById(sel.id));
      else main.innerHTML = detailsPanel();
      main.querySelectorAll('textarea.adv-text').forEach(grow);
      hydrateImages();
      if (focusFirst) {
        var f = main.querySelector('[data-bind$=".title"]');
        if (f) { f.focus(); f.select(); }
      }
    }
    function grow(t) {
      t.style.height = 'auto';
      t.style.height = Math.min(t.scrollHeight + 2, 1400) + 'px';
    }
    function renderAll(focusFirst) {
      $('#adv-ed-title').textContent = doc.title;
      $('#adv-ed-status').value = doc.status;
      renderOutline();
      renderMain(focusFirst);
      renderSave();
    }
    function select_(s, focusFirst) {
      sel = s;
      renderOutline();
      renderMain(focusFirst);
      var main = $('#adv-main');
      if (!focusFirst) main.focus({ preventScroll: true });
      // Bring the top of the panel into view below the sticky headers, but only when it is above the screen.
      var head = $('.adv-ed-header');
      var offset = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0) + (head ? head.offsetHeight : 0) + 12;
      var top = main.getBoundingClientRect().top - offset;
      if (top < 0) global.scrollBy({ top: top, behavior: 'instant' });
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    function onInput(e) {
      var t = e.target;
      var capId = t.getAttribute && t.getAttribute('data-img-caption');
      if (capId && doc) {
        var capImg = imageById(imageHost(), capId);
        if (capImg) { capImg.caption = t.value.slice(0, M().LIMITS.caption); changed(); }
        return;
      }
      var bind = t.getAttribute && t.getAttribute('data-bind');
      if (!bind || !doc) return;
      var v = t.value;
      var parts = bind.split('.');
      var titleChanged = false;
      if (parts[0] === 'book') {
        doc.content.book[parts[1]] = t.type === 'checkbox' ? t.checked : v;
        changed();
        return;
      }
      if (parts[0] === 'asset' || parts[0] === 'afield') {
        var x = assetById(sel.id);
        if (!x) return;
        if (parts[0] === 'afield') x.fields[parts[1]] = v;
        else if (parts[1] === 'printable' || parts[1] === 'playerVisible') { x[parts[1]] = t.checked; changed(); return; }
        else if (parts[1] === 'type') {
          x.type = v;
          var keepA = {};
          M().ASSET_TYPES[v].fields.forEach(function (f) { if (x.fields[f.key]) keepA[f.key] = x.fields[f.key]; });
          x.fields = keepA;
          if (x.type !== 'monster' && x.type !== 'spell' && x.type !== 'item') x.ref = null;
          changed(); renderOutline(); renderMain(false);
          return;
        } else if (parts[1] === 'link') {
          var lp = v.split('|');
          x.link = lp[0] ? { chapterId: lp[0], sectionId: lp[1] || null } : null;
        } else if (parts[1] === 'refSource' || parts[1] === 'refName') {
          var src = parts[1] === 'refSource' ? v : (x.ref ? x.ref.source : '');
          var nm = parts[1] === 'refName' ? v : (x.ref ? x.ref.name : '');
          if (parts[1] === 'refName' && !src) { var srcSel = root.querySelector('[data-bind="asset.refSource"]'); src = srcSel ? srcSel.value : ''; }
          x.ref = src || nm ? { source: src || 'other', name: nm } : null;
        } else x[parts[1]] = v;
        titleChanged = parts[1] === 'title';
        if (t.tagName === 'TEXTAREA') grow(t);
        changed();
        outlineSoon();
        return;
      }
      if (parts[0] === 'adv') {
        if (parts[1] === 'levelMin' || parts[1] === 'levelMax') doc[parts[1]] = v === '' ? null : Number(v);
        else doc[parts[1]] = v;
        if (parts[1] === 'title') { $('#adv-ed-title').textContent = v.trim() || 'Untitled adventure'; titleChanged = true; }
      } else if (parts[0] === 'chapter') {
        var c = chapterById(sel.id);
        c[parts[1]] = v;
        titleChanged = parts[1] === 'title';
      } else if (parts[0] === 'section' || parts[0] === 'field') {
        var ref = sectionRef(sel.chapterId, sel.id);
        if (parts[0] === 'field') ref.section.fields[parts[1]] = v;
        else if (parts[1] === 'kind') {
          ref.section.kind = v;
          var keep = {};
          M().KINDS[v].fields.forEach(function (f) { if (ref.section.fields[f.key]) keep[f.key] = ref.section.fields[f.key]; });
          ref.section.fields = keep;
          changed();
          renderOutline();
          renderMain(false);
          return;
        } else ref.section[parts[1]] = v;
        titleChanged = parts[1] === 'title';
      }
      if (t.tagName === 'TEXTAREA') grow(t);
      if (titleChanged) {
        var h = $('#adv-main .adv-panel-head h2');
        if (h && sel.type !== 'section') h.textContent = v;
      }
      changed();
      outlineSoon();
    }

    function confirmDelete(what) {
      return global.confirm('Delete ' + what + '? This cannot be undone once it is saved.');
    }

    function onClick(e) {
      var go = e.target.closest('[data-fog-go]');
      if (go && root.contains(go)) {
        e.preventDefault();
        router.navigateTo(go.getAttribute('data-fog-go'));
        return;
      }
      var s = e.target.closest('[data-ed-sel]');
      if (s && root.contains(s) && doc) {
        var type = s.getAttribute('data-ed-sel');
        select_(type === 'details' ? { type: 'details' } : type === 'assets' ? { type: 'assets' } : type === 'asset' ? { type: 'asset', id: s.getAttribute('data-aid') } : type === 'chapter' ? { type: 'chapter', id: s.getAttribute('data-cid') } : { type: 'section', chapterId: s.getAttribute('data-cid'), id: s.getAttribute('data-sid') }, false);
        return;
      }
      var a = e.target.closest('[data-ed-act]');
      if (!a || !root.contains(a)) return;
      var act = a.getAttribute('data-ed-act');
      if (act === 'retry') { saveNow(); return; }
      if (act === 'reload') { reload(); return; }
      if (act === 'restore-backup' || act === 'discard-backup') { handleBackup(act === 'restore-backup'); return; }
      if (!doc) return;
      var chapters = doc.content.chapters;
      if (act === 'add-chapter') {
        if (chapters.length >= M().LIMITS.chapters) return;
        var ch = M().newChapter('Chapter ' + (chapters.length + 1));
        chapters.push(ch);
        changed();
        select_({ type: 'chapter', id: ch.id }, true);
      } else if (act === 'chapter-up' || act === 'chapter-down') {
        var i = chapters.indexOf(chapterById(sel.id));
        M().move(chapters, i, act === 'chapter-up' ? -1 : 1);
        changed();
        renderOutline();
        renderMain(false);
      } else if (act === 'chapter-delete') {
        var cd = chapterById(sel.id);
        if (!confirmDelete('the chapter “' + cd.title + '” and its ' + cd.sections.length + ' section' + (cd.sections.length === 1 ? '' : 's'))) return;
        var idx = chapters.indexOf(cd);
        chapters.splice(idx, 1);
        doc.content.assets.forEach(function (x) { if (x.link && x.link.chapterId === cd.id) x.link = null; }); // the assets stay, unplaced
        changed();
        var after = chapters[idx] || chapters[idx - 1];
        select_(after ? { type: 'chapter', id: after.id } : { type: 'details' }, false);
      } else if (act === 'add-section') {
        var host = sel.type === 'chapter' ? chapterById(sel.id) : sel.type === 'section' ? chapterById(sel.chapterId) : null;
        if (!host || host.sections.length >= M().LIMITS.sections) return;
        var ns = M().newSection(a.getAttribute('data-kind'));
        var at = sel.type === 'section' ? host.sections.indexOf(sectionRef(host.id, sel.id).section) + 1 : host.sections.length;
        host.sections.splice(at, 0, ns);
        changed();
        select_({ type: 'section', chapterId: host.id, id: ns.id }, true);
      } else if (act === 'section-up' || act === 'section-down' || act === 'section-delete') {
        var cid = sel.type === 'section' ? sel.chapterId : sel.id;
        var ref = sectionRef(cid, a.getAttribute('data-sid'));
        if (!ref) return;
        if (act === 'section-delete') {
          if (!confirmDelete('“' + ref.section.title + '”')) return;
          ref.chapter.sections.splice(ref.index, 1);
          doc.content.assets.forEach(function (x) { if (x.link && x.link.sectionId === ref.section.id) x.link.sectionId = null; });
          changed();
          if (sel.type === 'section') select_({ type: 'chapter', id: ref.chapter.id }, false);
          else { renderOutline(); renderMain(false); }
          return;
        }
        M().move(ref.chapter.sections, ref.index, act === 'section-up' ? -1 : 1);
        changed();
        renderOutline();
        renderMain(false);
      } else if (act === 'img-view' || act === 'img-move' || act === 'img-remove') {
        var ih = imageHost();
        var im = imageById(ih, a.getAttribute('data-img-id'));
        if (!im) return;
        if (act === 'img-view') { viewImage(im); return; }
        var ii = ih.images.indexOf(im);
        if (act === 'img-move') {
          M().move(ih.images, ii, Number(a.getAttribute('data-dir')));
        } else {
          if (!global.confirm('Remove this image' + (im.caption ? ' (“' + im.caption + '”)' : '') + '?')) return;
          ih.images.splice(ii, 1);
          pendingDeletes.push(im.path);
        }
        changed();
        refreshImages();
      } else if (act === 'add-asset') {
        if (doc.content.assets.length >= M().LIMITS.assets) return;
        var lcid = a.getAttribute('data-link-cid');
        var na = M().newAsset(a.getAttribute('data-type'), null, lcid ? { link: { chapterId: lcid, sectionId: a.getAttribute('data-link-sid') || null } } : null);
        if (lcid) na.link = { chapterId: lcid, sectionId: a.getAttribute('data-link-sid') || null };
        doc.content.assets.push(na);
        changed();
        select_({ type: 'asset', id: na.id }, true);
      } else if (act === 'asset-up' || act === 'asset-down') {
        var ai = doc.content.assets.indexOf(assetById(sel.id));
        M().move(doc.content.assets, ai, act === 'asset-up' ? -1 : 1);
        changed();
        renderOutline();
        renderMain(false);
      } else if (act === 'asset-delete') {
        var ad = assetById(sel.id);
        if (!ad || !confirmDelete('the ' + M().ASSET_TYPES[ad.type].label.toLowerCase() + ' “' + ad.title + '”')) return;
        doc.content.assets.splice(doc.content.assets.indexOf(ad), 1);
        ad.images.forEach(function (im) { pendingDeletes.push(im.path); });
        changed();
        select_({ type: 'assets' }, false);
      } else if (act === 'remove-cover') {
        doc.coverImage = null;
        changed();
        renderMain(false);
      }
    }

    function onChange(e) {
      var t = e.target;
      if (t.id === 'adv-ed-status' && doc) {
        doc.status = t.value;
        changed();
        return;
      }
      var hoId = t.getAttribute('data-img-handout');
      if (hoId && doc) {
        var hoImg = imageById(imageHost(), hoId);
        if (hoImg) { hoImg.handout = t.checked; changed(); refreshImages(); }
        return;
      }
      if (t.getAttribute('data-ed-file') === 'images' && t.files && t.files.length) {
        var picked = Array.prototype.slice.call(t.files);
        t.value = '';
        addImages(picked);
        return;
      }
      if (t.getAttribute('data-ed-file') === 'cover' && t.files && t.files[0]) {
        var err = $('#adv-cover-error');
        global.FogAccount.compressImage(t.files[0], 640).then(function (dataUrl) {
          if (!/^data:image\/jpeg/.test(dataUrl) || dataUrl.length > 200000) throw new Error('That image is too large even after resizing. Try a smaller one.');
          doc.coverImage = dataUrl;
          changed();
          renderMain(false);
        }).catch(function (x) {
          if (!err) return;
          err.textContent = x.message || 'The image could not be used.';
          err.hidden = false;
        });
        t.value = '';
      }
      // Other fields (including selects, which also fire "input") are handled by onInput.
    }

    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveNow();
      }
    }
    function onBeforeUnload(e) {
      if (dirty || saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    }

    // -------------------------------------------------------------------------
    // Loading, backups, reload
    // -------------------------------------------------------------------------
    function banner(html) {
      $('#adv-banner').innerHTML = html || '';
      $('#adv-banner').hidden = !html;
    }

    function handleBackup(restore) {
      var b = readBackup();
      if (restore && b && b.doc) {
        var keepVersion = doc.version;
        doc = M().normalize(b.doc);
        doc.id = id;
        doc.version = keepVersion;
        conflict = false;
        banner('');
        renderAll(false);
        changed();
      } else {
        clearBackup();
        banner('');
      }
    }

    async function load() {
      var res = await Store().get(id);
      if (!alive) return;
      if (!res.ok) {
        $('#adv-ed-title').textContent = res.notFound ? 'Adventure not found' : 'Adventure';
        banner('<p>' + esc(res.message) + '</p><p><a href="#adventures" data-fog-go="#adventures">Back to Adventures</a></p>');
        $('#adv-save').textContent = '';
        return;
      }
      doc = res.adventure;
      campaigns = res.campaigns || [];
      try { sel = JSON.parse(global.sessionStorage.getItem(SEL_KEY) || 'null') || { type: 'details' }; } catch (e) { sel = { type: 'details' }; }
      $('#adv-ed-layout').hidden = false;
      $('#adv-ed-status').disabled = false;
      $('#adv-read').hidden = false;
      $('#adv-read').setAttribute('href', '#adventures/' + encodeURIComponent(doc.id) + '/read');
      $('#adv-read').setAttribute('data-fog-go', '#adventures/' + encodeURIComponent(doc.id) + '/read');
      lastSaved = doc.updatedAt ? new Date(doc.updatedAt) : null;
      renderAll(false);
      var b = readBackup();
      if (b && b.doc && JSON.stringify(M().normalize(Object.assign({}, b.doc, { version: null, updatedAt: null, createdAt: null }))) !== JSON.stringify(M().normalize(Object.assign({}, doc, { version: null, updatedAt: null, createdAt: null })))) {
        var newer = b.baseVersion !== doc.version;
        banner('<p><strong>Unsaved changes were found</strong> from ' + esc(new Date(b.at).toLocaleString()) + ' in this browser. ' +
          (newer ? 'The adventure was saved again after that (another tab or device); restoring will replace that newer version.' : 'They were never saved to your account.') + '</p>' +
          '<p><button type="button" class="btn btn-primary btn-sm" data-ed-act="restore-backup">Restore my unsaved changes</button> ' +
          '<button type="button" class="btn btn-secondary btn-sm" data-ed-act="discard-backup">Discard them</button></p>');
      } else if (b) {
        clearBackup();
      }
    }

    async function reload() {
      if (dirty && !global.confirm('Reload the saved version? Your unsaved text stays in the local backup, and you can restore it afterwards.')) return;
      conflict = false;
      saveError = null;
      dirty = false;
      await load();
    }

    function onDragOver(e) {
      var z = e.target.closest && e.target.closest('.adv-images');
      if (!z || !e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') < 0) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      z.classList.add('is-dragover');
    }
    function onDragLeave(e) {
      var z = e.target.closest && e.target.closest('.adv-images');
      if (z && !z.contains(e.relatedTarget)) z.classList.remove('is-dragover');
    }
    function onDrop(e) {
      var z = e.target.closest && e.target.closest('.adv-images');
      if (!z) return;
      e.preventDefault();
      z.classList.remove('is-dragover');
      addImages(e.dataTransfer && e.dataTransfer.files);
    }
    function onPaste(e) {
      if (!doc || !imageHost() || !e.clipboardData) return;
      var files = Array.prototype.slice.call(e.clipboardData.files || []).filter(function (f) { return f.type && f.type.indexOf('image/') === 0; });
      if (!files.length) return; // plain text pastes normally
      e.preventDefault();
      addImages(files);
    }
    function onZoneKey(e) {
      var z = e.target.closest && e.target.closest('[data-dropzone]');
      if (z && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); z.querySelector('input[type=file]').click(); }
    }
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('dragleave', onDragLeave);
    root.addEventListener('drop', onDrop);
    root.addEventListener('keydown', onZoneKey);
    document.addEventListener('paste', onPaste);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('click', onClick);
    $('#adv-save-now').addEventListener('click', function () { saveNow(); });
    document.addEventListener('keydown', onKey);
    global.addEventListener('beforeunload', onBeforeUnload);
    load();

    return function cleanup() {
      alive = false;
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('paste', onPaste);
      global.removeEventListener('beforeunload', onBeforeUnload);
      clearTimeout(outlineTimer);
      if (dirty && !conflict) {
        // Leaving the editor: write the backup now and save in the background. If the save fails,
        // the backup is offered the next time this adventure opens.
        try { global.localStorage.setItem(BACKUP_KEY, JSON.stringify({ doc: doc, baseVersion: doc.version, at: new Date().toISOString() })); } catch (e) { /* ignore */ }
        alive = true; // let the background save finish its bookkeeping
        saveNow().then(function () { alive = false; });
      }
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.adventureEditor = init;
})(window);
