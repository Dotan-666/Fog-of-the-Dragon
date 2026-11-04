(function (global) {
  'use strict';

  var UI = function () {
    return global.FogCharacterUI;
  };

  function startCreate() {
    var draft = global.FogCharacterStore.createDraft();
    var res = global.FogCharacterStore.save(draft);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    global.FogDashboardRouter.navigateTo('#characters/new/' + draft.id);
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

  function init(container) {
    var note = container.querySelector('#characters-srd-note');
    if (note) note.innerHTML = UI().attributionHtml();

    var empty = container.querySelector('#characters-empty-state');
    var section = container.querySelector('#characters-list-section');
    var grid = container.querySelector('#characters-grid');

    function refresh() {
      var list = global.FogCharacterStore.listSummaries();
      if (!grid) return;
      empty.hidden = list.length > 0;
      section.hidden = list.length === 0;
      grid.innerHTML = list.map(renderCard).join('');
    }

    // One delegated listener survives every re-render of the grid.
    grid.addEventListener('click', function (e) {
      var open = e.target.closest('[data-open]');
      if (open) {
        global.FogDashboardRouter.navigateTo(open.getAttribute('data-open'));
        return;
      }
      var del = e.target.closest('[data-delete]');
      if (del && confirm('Delete “' + del.getAttribute('data-name') + '” from this browser? This cannot be undone.')) {
        var res = global.FogCharacterStore.remove(del.getAttribute('data-delete'));
        if (!res.ok) alert(res.message);
        refresh();
      }
    });

    container.querySelector('#btn-create-character').addEventListener('click', startCreate);
    container.querySelector('#btn-empty-create-character').addEventListener('click', startCreate);

    refresh();
    return null;
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.characters = init;
})(window);
