(function (global) {
  'use strict';

  var UI = function () {
    return global.FogCharacterUI;
  };

  var Registry = function () { return global.FogCharacterRegistry; };

  /** New character: ask the server for a slot first (Free plan: 3), then create the draft and open the creator. */
  async function startCreate(container) {
    var draft = global.FogCharacterStore.createDraft();
    var btns = container.querySelectorAll('#btn-create-character, #btn-empty-create-character');
    btns.forEach(function (b) { b.setAttribute('aria-busy', 'true'); });
    var slot = Registry() ? await Registry().claim(draft.id) : { ok: true };
    btns.forEach(function (b) { b.removeAttribute('aria-busy'); });
    if (!slot.ok) {
      showLimit(container, slot.limitReached ? null : slot.message);
      return;
    }
    var res = global.FogCharacterStore.save(draft);
    if (!res.ok) {
      showLimit(container, res.code === 'character_limit' ? null : res.message);
      return;
    }
    global.FogDashboardRouter.navigateTo('#characters/new/' + draft.id);
  }

  function showLimit(container, message) {
    var box = container.querySelector('#characters-limit');
    var esc = UI().escapeHtml;
    box.innerHTML = message
      ? '<p>' + esc(message) + '</p>'
      : '<h3>You\'ve reached your character limit\'s 3 characters</h3><p>You can still open, edit, level up and delete the characters you have. To create more, delete one you no longer need, or upgrade: the Adventurer and Dungeon Master plans include <strong>unlimited characters</strong>.</p>' +
        '<div class="characters-limit-actions"><button type="button" class="btn btn-primary btn-sm" data-open="#upgrade">See the plans</button></div>';
    box.hidden = false;
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function usageText(u, localCount) {
    if (!u) return '';
    var plan = { free: 'Free', adventurer: 'Adventurer', 'dungeon-master': 'Dungeon Master', warlord: 'Free', 'fogger-of-the-dragons': 'Dungeon Master' }[u.plan] || u.plan;
    return u.limit != null ? u.count + ' / ' + u.limit + ' Characters' : u.count + ' Character' + (u.count === 1 ? '' : 's') + ' · unlimited on the ' + plan + ' plan';
  }

  function renderCard(summary) {
    var esc = UI().escapeHtml;
    var isDraft = summary.status === 'draft';
    var meta = ['Level ' + summary.level];
    if (summary.speciesName) meta.push(summary.speciesName);
    if (summary.className) meta.push(summary.className + (summary.subclassName ? ' (' + summary.subclassName + ')' : ''));
    if (!summary.className && !summary.speciesName) meta.push('Class and species not chosen yet');

    var actions = isDraft
      ? '<button type="button" class="btn btn-primary" data-open="#characters/new/' + esc(summary.id) + '">Continue</button>'
      : '<button type="button" class="btn btn-primary" data-open="#characters/' + esc(summary.id) + '">View</button>' +
        '<button type="button" class="btn btn-secondary" data-open="#characters/' + esc(summary.id) + '/edit">Edit</button>';

    return (
      '<article class="character-card" data-id="' + esc(summary.id) + '">' +
      '<div class="character-card-portrait">' + UI().portraitHtml(summary.portraitDataUrl) + '</div>' +
      '<div class="character-card-body">' +
      (isDraft ? '<span class="character-card-badge">Draft</span>' : '') +
      '<h3 class="character-card-name">' + esc(summary.name) + '</h3>' +
      '<p class="character-card-meta">' + esc(meta.join(' · ')) + '</p>' +
      (summary.migrationNotice ? '<p class="character-card-notice">' + esc(summary.migrationNotice) + '</p>' : '') +
      '<div class="character-card-actions">' + actions +
      '<button type="button" class="btn btn-outline-crimson btn-sm" data-delete="' + esc(summary.id) + '" data-name="' + esc(summary.name) + '">Delete</button>' +
      '</div></div></article>'
    );
  }

  // Elements characters.html must provide. A missing one means the fragment didn't arrive complete
  // (for example a dev server that truncates responses), so stop with a clear message instead of a TypeError.
  var REQUIRED = ['#characters-empty-state', '#characters-list-section', '#characters-grid', '#btn-create-character', '#btn-empty-create-character'];

  function init(container) {
    var missing = REQUIRED.filter(function (sel) { return !container.querySelector(sel); });
    if (missing.length) {
      console.error('Characters page: fragment is missing ' + missing.join(', ') + '. Pages/Dashboard/characters.html may have been served incomplete.');
      container.innerHTML =
        '<div class="dashboard-fragment page-error-panel"><h2>Characters page didn\'t load completely</h2>' +
        '<p>Reload the page. If this keeps happening, the development server may be cutting off the page file.</p></div>';
      return null;
    }

    var note = container.querySelector('#characters-srd-note');
    if (note) note.innerHTML = UI().attributionHtml();

    var empty = container.querySelector('#characters-empty-state');
    var section = container.querySelector('#characters-list-section');
    var grid = container.querySelector('#characters-grid');

    var usageEl = container.querySelector('#characters-usage');
    var elsewhereEl = container.querySelector('#characters-elsewhere');

    function drawUsage() {
      var u = Registry() && Registry().usage();
      var local = global.FogCharacterStore.listSummaries();
      usageEl.textContent = usageText(u, local.length);
      usageEl.hidden = !u;
      usageEl.classList.toggle('is-full', !!(u && u.limit != null && u.count >= u.limit));
      var full = !!(Registry() && Registry().atLimit());
      container.querySelectorAll('#btn-create-character, #btn-empty-create-character').forEach(function (b) {
        b.setAttribute('aria-disabled', String(full));
        b.classList.toggle('is-limit', full);
        b.title = full ? 'Free plan limit reached: 3 characters' : '';
      });
      // Slots used by characters that aren't in this browser (characters are stored per browser).
      var ids = (u && u.ids) || [];
      var away = ids.filter(function (id) { return !local.some(function (c) { return c.id === id; }); });
      elsewhereEl.hidden = !away.length || !u || u.limit == null;
      if (away.length && u && u.limit != null) {
        elsewhereEl.innerHTML = '<p>' + away.length + ' of your character slots ' + (away.length === 1 ? 'is' : 'are') + ' used by characters that aren\'t in this browser (made on another device, or removed when browser data was cleared).</p>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-free-slots>Free ' + (away.length === 1 ? 'this slot' : 'these slots') + '</button>';
      }
    }

    function refresh() {
      var list = global.FogCharacterStore.listSummaries();
      empty.hidden = list.length > 0;
      section.hidden = list.length === 0;
      grid.innerHTML = list.map(renderCard).join('');
      drawUsage();
    }

    // One delegated listener survives every re-render of the grid.
    grid.addEventListener('click', function (e) {
      var open = e.target.closest('[data-open]');
      if (open) {
        global.FogDashboardRouter.navigateTo(open.getAttribute('data-open'));
        return;
      }
      var del = e.target.closest('[data-delete]');
      if (del && confirm('Delete "' + del.getAttribute('data-name') + '" from this browser? This cannot be undone.')) {
        var id = del.getAttribute('data-delete');
        var res = global.FogCharacterStore.remove(id);
        if (!res.ok) alert(res.message);
        else if (Registry()) Registry().release(id).then(function () { container.querySelector('#characters-limit').hidden = true; refresh(); });
        refresh();
      }
    });

    container.querySelector('#btn-create-character').addEventListener('click', function () { startCreate(container); });
    var importBtn = container.querySelector('#btn-import-character');
    if (importBtn) importBtn.addEventListener('click', function () {
      if (global.FogCharacterImport) global.FogCharacterImport.open(function () { refresh(); });
    });
    container.querySelector('#btn-empty-create-character').addEventListener('click', function () { startCreate(container); });
    container.addEventListener('click', function (e) {
      var go = e.target.closest('#characters-limit [data-open]');
      if (go) { global.FogDashboardRouter.navigateTo(go.getAttribute('data-open')); return; }
      if (e.target.closest('[data-free-slots]')) {
        var u = Registry().usage();
        var local = global.FogCharacterStore.listSummaries().map(function (c) { return c.id; });
        var away = ((u && u.ids) || []).filter(function (id) { return local.indexOf(id) < 0; });
        if (!away.length || !confirm('Free ' + away.length + ' slot(s)? Only do this if those characters are gone; if they still exist in another browser, that browser keeps them but they stop counting until it is used again.')) return;
        Promise.all(away.map(function (id) { return Registry().release(id); })).then(refresh);
      }
    });
    var onUsage = function () { drawUsage(); };
    global.addEventListener('fog:characters-usage', onUsage);

    refresh();
    if (Registry()) Registry().ready().then(drawUsage);
    return function cleanup() { global.removeEventListener('fog:characters-usage', onUsage); };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.characters = init;
})(window);
