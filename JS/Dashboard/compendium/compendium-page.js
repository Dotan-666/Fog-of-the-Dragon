/**
 * Monsters & Spells page (#bestiary-spells): search, filters, list and full entry. Data comes from FogCompendium;
 * entries are drawn by FogCompendiumRender (shared with the Homebrew editor). When you are signed in, your homebrew
 * monsters, NPCs with stat blocks and spells are listed too, marked "Homebrew".
 *
 * Deep links: #bestiary-spells/monster/<key> and #bestiary-spells/spell/<key> open that entry (from an adventure's encounter,
 * for example; the router then shows "← Back to <where you came from>"). The tab, the selected entries, the search and the
 * filters are kept for this browser tab, so coming back finds the list as you left it.
 */
(function (global) {
  'use strict';

  var C = function () { return global.FogCompendium; };
  var R = function () { return global.FogCompendiumRender; };
  var TAB_KEY = 'fog_cmp_tab';
  var SEL_KEY = 'fog_cmp_selected';
  var FILTER_KEY = 'fog_cmp_filters';
  var HOMEBREW_SETS = { monster: 'homebrew-monsters', spell: 'homebrew-spells' };
  var SIZE_ORDER = ['Tiny', 'Small', 'Medium or Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

  function esc(s) { return R().esc(s); }
  function session(key, val) {
    try {
      if (val === undefined) return global.sessionStorage.getItem(key);
      global.sessionStorage.setItem(key, val);
    } catch (e) { /* preference only */ }
    return null;
  }
  function crSortValue(m) { return m.crValue == null ? -1 : m.crValue; }
  function levelLabel(sp) { return sp.level === 0 ? 'Cantrip' : 'Level ' + sp.level; }
  function isHomebrew(e) { return e.dataset && e.dataset.origin === 'homebrew'; }

  /** Your homebrew → compendium datasets (replaced on every visit, so edits show up). Errors are reported, never faked. */
  async function loadHomebrew() {
    var M = global.FogHomebrewModel;
    var S = global.FogHomebrewStore;
    if (!M || !S || !C().unregister) return null;
    var res = await S.list(['monster', 'npc', 'spell']);
    C().unregister(HOMEBREW_SETS.monster);
    C().unregister(HOMEBREW_SETS.spell);
    if (!res.ok) return /Sign in/.test(res.message) ? null : 'Your homebrew could not be loaded: ' + res.message;
    var meta = { origin: 'homebrew', name: 'Your homebrew', edition: '2024 rules format' };
    C().register({ meta: Object.assign({ id: HOMEBREW_SETS.monster, kind: 'monster' }, meta), entries: res.entries.filter(M.hasStatBlock).map(M.toMonster) });
    C().register({ meta: Object.assign({ id: HOMEBREW_SETS.spell, kind: 'spell' }, meta), entries: res.entries.filter(function (e) { return e.kind === 'spell'; }).map(M.toSpell) });
    return null;
  }

  function init(container, params) {
    params = params || {};
    var root = container.querySelector('#compendium-root');
    var $ = function (s) { return root.querySelector(s); };
    var tab = session(TAB_KEY) === 'spells' ? 'spells' : 'monsters';
    var filters = { monsters: { q: '', type: '', size: '', crMin: '', crMax: '', src: '', sort: 'name' }, spells: { q: '', level: '', school: '', cls: '', conc: '', ritual: '', src: '', sort: 'name' } };
    var selected = { monsters: null, spells: null };
    try { selected = Object.assign(selected, JSON.parse(session(SEL_KEY) || '{}')); } catch (e) { /* ignore */ }
    try {
      var savedF = JSON.parse(session(FILTER_KEY) || '{}');
      ['monsters', 'spells'].forEach(function (w) { if (savedF[w]) Object.keys(filters[w]).forEach(function (k) { if (typeof savedF[w][k] === 'string') filters[w][k] = savedF[w][k]; }); });
    } catch (e) { /* ignore */ }
    var deepLink = params.kind && params.key ? { tab: params.kind === 'spell' ? 'spells' : 'monsters', key: params.key } : null;
    if (deepLink) { tab = deepLink.tab; selected[tab] = deepLink.key; }
    function saveFilters() { session(FILTER_KEY, JSON.stringify(filters)); }
    function restoreFilterFields() {
      ['monsters', 'spells'].forEach(function (w) {
        var form = root.querySelector('#cmp-filters-' + w);
        if (!form) return;
        form.querySelectorAll('[data-cmp-filter]').forEach(function (el) { var v = filters[w][el.getAttribute('data-cmp-filter')]; if (v != null && v !== '') el.value = v; });
      });
    }
    var alive = true;
    var data = { monsters: [], spells: [] };

    function fillSelect(sel, values, label) {
      var el = root.querySelector(sel);
      el.innerHTML = '<option value="">' + esc(label) + '</option>' + values.map(function (v) { return '<option value="' + esc(v[0]) + '">' + esc(v[1]) + '</option>'; }).join('');
    }

    function setupFilters() {
      var types = {}, sizes = {}, crs = {};
      data.monsters.forEach(function (m) { types[m.type] = 1; sizes[m.size] = 1; crs[m.cr] = m.crValue; });
      fillSelect('#cmp-filters-monsters [data-cmp-filter=type]', Object.keys(types).sort().map(function (t) { return [t, t]; }), 'All types');
      fillSelect('#cmp-filters-monsters [data-cmp-filter=size]', Object.keys(sizes).sort(function (a, b) { return SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b); }).map(function (s) { return [s, s]; }), 'All sizes');
      var crList = Object.keys(crs).sort(function (a, b) { return crs[a] - crs[b]; }).map(function (c) { return [String(crs[c]), 'CR ' + c]; });
      fillSelect('#cmp-filters-monsters [data-cmp-filter=crMin]', crList, 'CR from');
      fillSelect('#cmp-filters-monsters [data-cmp-filter=crMax]', crList, 'CR to');
      var levels = {}, schools = {}, classes = {};
      data.spells.forEach(function (s) { levels[s.level] = 1; schools[s.school] = 1; (s.classes || []).forEach(function (c) { classes[c] = 1; }); });
      fillSelect('#cmp-filters-spells [data-cmp-filter=level]', Object.keys(levels).map(Number).sort(function (a, b) { return a - b; }).map(function (l) { return [String(l), l === 0 ? 'Cantrips' : 'Level ' + l]; }), 'All levels');
      fillSelect('#cmp-filters-spells [data-cmp-filter=school]', Object.keys(schools).sort().map(function (s) { return [s, s]; }), 'All schools');
      fillSelect('#cmp-filters-spells [data-cmp-filter=cls]', Object.keys(classes).sort().map(function (c) { return [c, R().className(c)]; }), 'All classes');
    }

    function matchesText(words, hay) {
      hay = hay.toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    }
    function matchesSource(f, e) {
      return !f.src || (f.src === 'homebrew') === isHomebrew(e);
    }

    /** With a search term: names starting with it first, then names containing it, then text-only matches. */
    function relevance(q, name) {
      if (!q) return 0;
      var n = name.toLowerCase();
      q = q.toLowerCase();
      return n.indexOf(q) === 0 ? 0 : n.indexOf(q) > 0 ? 1 : 2;
    }

    function filteredMonsters() {
      var f = filters.monsters;
      var words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      var min = f.crMin === '' ? -Infinity : Number(f.crMin);
      var max = f.crMax === '' ? Infinity : Number(f.crMax);
      return data.monsters.filter(function (m) {
        if (!matchesSource(f, m)) return false;
        if (f.type && m.type !== f.type) return false;
        if (f.size && m.size !== f.size) return false;
        if (m.crValue < min || m.crValue > max) return false;
        if (!words.length) return true;
        var names = m.traits.concat(m.actions, m.bonusActions, m.reactions, m.legendaryActions).map(function (x) { return x.name; }).join(' ');
        return matchesText(words, m.name + ' ' + m.type + ' ' + (m.typeTags || '') + ' ' + (m.group || '') + ' ' + names);
      }).sort(function (a, b) {
        return (relevance(f.q, a.name) - relevance(f.q, b.name)) || (f.sort === 'cr' ? crSortValue(a) - crSortValue(b) : 0) || a.name.localeCompare(b.name);
      });
    }

    function filteredSpells() {
      var f = filters.spells;
      var words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      return data.spells.filter(function (s) {
        if (!matchesSource(f, s)) return false;
        if (f.level !== '' && s.level !== Number(f.level)) return false;
        if (f.school && s.school !== f.school) return false;
        if (f.cls && (s.classes || []).indexOf(f.cls) < 0) return false;
        if (f.conc && !!s.concentration !== (f.conc === 'yes')) return false;
        if (f.ritual && !!s.ritual !== (f.ritual === 'yes')) return false;
        if (!words.length) return true;
        return matchesText(words, s.name + ' ' + s.school + ' ' + s.description + ' ' + (s.higherLevels || ''));
      }).sort(function (a, b) {
        return (relevance(f.q, a.name) - relevance(f.q, b.name)) || (f.sort === 'level' ? a.level - b.level : 0) || a.name.localeCompare(b.name);
      });
    }

    function badges(e) {
      return (isHomebrew(e) ? ' <span class="cmp-badge">Homebrew</span>' : '') + (e.complete ? '' : ' <span class="cmp-badge cmp-badge-warn">Incomplete data</span>');
    }
    function monsterRow(m) {
      return '<button type="button" role="option" class="cmp-row' + (selected.monsters === m.key ? ' is-selected' : '') + '" data-key="' + esc(m.key) + '" aria-selected="' + (selected.monsters === m.key) + '">' +
        '<span class="cmp-row-name">' + esc(m.name) + badges(m) + '</span>' +
        '<span class="cmp-row-meta">' + esc(m.size + ' ' + m.type) + '</span><span class="cmp-row-cr">CR ' + esc(m.cr) + '</span></button>';
    }
    function spellRow(s) {
      return '<button type="button" role="option" class="cmp-row' + (selected.spells === s.key ? ' is-selected' : '') + '" data-key="' + esc(s.key) + '" aria-selected="' + (selected.spells === s.key) + '">' +
        '<span class="cmp-row-name">' + esc(s.name) + badges(s) + '</span>' +
        '<span class="cmp-row-meta">' + esc(levelLabel(s) + ' · ' + s.school) + '</span>' +
        '<span class="cmp-row-tags">' + (s.concentration ? '<abbr class="cmp-tag" title="Concentration">C</abbr>' : '') + (s.ritual ? '<abbr class="cmp-tag" title="Ritual">R</abbr>' : '') + '</span></button>';
    }
    function detail(e) {
      return tab === 'monsters' ? R().monster(e) : R().spell(e);
    }

    function render() {
      root.querySelectorAll('[data-cmp-tab]').forEach(function (b) {
        var on = b.getAttribute('data-cmp-tab') === tab;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });
      $('#cmp-filters-monsters').hidden = tab !== 'monsters';
      $('#cmp-filters-spells').hidden = tab !== 'spells';
      $('#cmp-count-monsters').textContent = data.monsters.length ? '(' + data.monsters.length + ')' : '';
      $('#cmp-count-spells').textContent = data.spells.length ? '(' + data.spells.length + ')' : '';
      var list = tab === 'monsters' ? filteredMonsters() : filteredSpells();
      var all = data[tab];
      $('#cmp-count').textContent = list.length + ' of ' + all.length + (tab === 'monsters' ? ' monsters' : ' spells');
      $('#cmp-list').innerHTML = list.length ? list.slice(0, 400).map(tab === 'monsters' ? monsterRow : spellRow).join('') :
        '<p class="cmp-empty">' + (filters[tab].src === 'homebrew' ? 'No homebrew ' + tab + ' match. Create them under Homebrew.' : 'Nothing matches these filters.') + '</p>';
      var sel = all.filter(function (e) { return e.key === selected[tab]; })[0] || list[0];
      if (sel && selected[tab] !== sel.key) {
        selected[tab] = sel.key;
        var row = root.querySelector('.cmp-row[data-key="' + sel.key.replace(/"/g, '') + '"]');
        if (row) { row.classList.add('is-selected'); row.setAttribute('aria-selected', 'true'); }
      }
      $('#cmp-detail').innerHTML = sel ? detail(sel) : '<p class="cmp-empty">Select an entry.</p>';
    }

    function renderSources() {
      var metas = C().datasets().filter(function (d) { return d.origin !== 'homebrew'; });
      var hb = C().datasets().filter(function (d) { return d.origin === 'homebrew'; }).reduce(function (n, d) { return n + d.count; }, 0);
      $('#cmp-sources').innerHTML = '<h2>Sources and licenses</h2>' + metas.map(function (d) {
        return '<p><strong>' + esc(d.kind === 'monster' ? 'Monsters' : 'Spells') + ':</strong> ' + esc(d.name || d.source) + ' (' + esc(d.edition) + ', ' + esc(R().ORIGIN_LABEL[d.origin]) + '), ' + d.count + ' entries. ' + esc(d.attribution || '') + '</p>';
      }).join('') + (hb ? '<p><strong>Homebrew:</strong> ' + hb + ' of your own entries, private to you.</p>' : '') +
        '<p class="cmp-note">Only SRD content is included. Monster Manual and other sourcebook content is not part of the SRD and is not shown. Environments are not listed in the SRD 5.2.1 stat blocks.</p>';
    }

    function onClick(e) {
      var t = e.target.closest('[data-cmp-tab], .cmp-row, [data-cmp-reset]');
      if (!t || !root.contains(t)) return;
      if (t.hasAttribute('data-cmp-tab')) {
        tab = t.getAttribute('data-cmp-tab');
        session(TAB_KEY, tab);
        render();
        return;
      }
      if (t.hasAttribute('data-cmp-reset')) {
        var form = t.closest('form');
        form.querySelectorAll('[data-cmp-filter]').forEach(function (el) { el.value = el.getAttribute('data-cmp-filter') === 'sort' ? 'name' : ''; });
        Object.keys(filters[tab]).forEach(function (k) { filters[tab][k] = k === 'sort' ? 'name' : ''; });
        saveFilters();
        render();
        return;
      }
      selected[tab] = t.getAttribute('data-key');
      session(SEL_KEY, JSON.stringify(selected));
      root.querySelectorAll('.cmp-row.is-selected').forEach(function (r) { r.classList.remove('is-selected'); r.setAttribute('aria-selected', 'false'); });
      t.classList.add('is-selected');
      t.setAttribute('aria-selected', 'true');
      var entry = data[tab].filter(function (x) { return x.key === selected[tab]; })[0];
      var det = $('#cmp-detail');
      det.innerHTML = entry ? detail(entry) : '';
      if (global.matchMedia && global.matchMedia('(max-width: 900px)').matches) det.scrollIntoView({ block: 'start' });
    }

    function onFilter(e) {
      var el = e.target.closest('[data-cmp-filter]');
      if (!el) return;
      var which = el.closest('form').id === 'cmp-filters-spells' ? 'spells' : 'monsters';
      filters[which][el.getAttribute('data-cmp-filter')] = el.value.trim();
      saveFilters();
      render();
    }

    function onKey(e) {
      var row = e.target.closest && e.target.closest('.cmp-row');
      if (!row || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      var next = e.key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling;
      if (next && next.classList.contains('cmp-row')) { next.focus(); next.click(); }
    }

    root.addEventListener('click', onClick);
    root.addEventListener('input', onFilter);
    root.addEventListener('change', onFilter);
    root.addEventListener('keydown', onKey);
    $('#cmp-list').innerHTML = '<p class="cmp-empty">Loading the SRD data…</p>';
    C().ready().then(loadHomebrew).catch(function (e) { return 'Your homebrew could not be loaded: ' + (e && e.message); }).then(function (hbError) {
      if (!alive) return;
      data.monsters = C().monsters();
      data.spells = C().spells();
      var errs = C().errors().concat(hbError ? [hbError] : []);
      $('#cmp-status').textContent = errs.join(' ');
      $('#cmp-status').hidden = !errs.length;
      setupFilters();
      restoreFilterFields();
      renderSources();
      if (deepLink) {
        var found = data[deepLink.tab].some(function (x) { return x.key === deepLink.key; });
        if (found) {
          // make sure the linked entry is in the list even if saved filters would hide it
          var f = filters[deepLink.tab];
          Object.keys(f).forEach(function (k) { f[k] = k === 'sort' ? f[k] : ''; });
          root.querySelectorAll('#cmp-filters-' + deepLink.tab + ' [data-cmp-filter]').forEach(function (el) { el.value = el.getAttribute('data-cmp-filter') === 'sort' ? f.sort : ''; });
        } else {
          $('#cmp-status').textContent = ($('#cmp-status').textContent + ' That ' + (deepLink.tab === 'spells' ? 'spell' : 'monster') + ' isn’t in Monsters & Spells (it may have been removed).').trim();
          $('#cmp-status').hidden = false;
        }
      }
      render();
      if (deepLink) {
        var row = root.querySelector('.cmp-row.is-selected');
        if (row) row.scrollIntoView({ block: 'nearest' });
        if (global.matchMedia && global.matchMedia('(max-width: 900px)').matches) $('#cmp-detail').scrollIntoView({ block: 'start' });
      }
    });

    return function cleanup() {
      alive = false;
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.compendium = init;
  // The Campaign workspace (Bestiary, Combat) loads the same homebrew datasets.
  global.FogCompendiumPage = { loadHomebrew: loadHomebrew };
})(window);
