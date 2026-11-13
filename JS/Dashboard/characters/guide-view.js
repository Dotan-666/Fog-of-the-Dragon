/**
 * Renders the Character Guide (FogCharacterGuide.build) for the creator's last step and the sheet tab.
 * Always rebuilt from the character's current data, so it never goes stale after an edit.
 */
(function (global) {
  'use strict';

  var esc = function (s) { return global.FogCharacterUI.escapeHtml(s); };
  var tip = function (k, l) { return global.FogTips ? global.FogTips.button(k, l) : ''; };

  var STATUS_LABEL = { now: 'Ready now', option: 'Available now with a different choice', future: 'Future levels', situational: 'Situational' };

  function list(items, cls) {
    if (!items || !items.length) return '<p class="guide-empty">Nothing to add here yet.</p>';
    return '<ul class="' + (cls || 'guide-list') + '">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
  }

  var SECTIONS = [
    ['who', 'Who'], ['abilities', 'Abilities'], ['howToPlay', 'How to play'],
    ['combos', 'Combos'], ['strengths', 'Strengths'], ['progression', 'Progression'],
  ];
  var COLLAPSE_KEY = 'fog_guide_collapsed';

  function readCollapsed() {
    try {
      var v = JSON.parse(global.localStorage.getItem(COLLAPSE_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function writeCollapsed(list) {
    try { global.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(list)); } catch (e) { /* preference only */ }
  }

  /** A collapsible section: the header is a real button (aria-expanded); the "?" sits beside it. */
  function section(id, n, title, body, tipKey) {
    var closed = readCollapsed().indexOf(id) >= 0;
    return '<section class="guide-section' + (closed ? ' is-collapsed' : '') + '" id="guide-' + id + '" aria-labelledby="guide-h-' + id + '">' +
      '<h3 class="guide-section-title" id="guide-h-' + id + '">' +
      '<button type="button" class="guide-toggle" data-guide-toggle="' + id + '" aria-expanded="' + (!closed) + '" aria-controls="guide-b-' + id + '">' +
      '<span class="guide-num">' + n + '</span> ' + esc(title) + '<span class="guide-chevron" aria-hidden="true"></span></button>' +
      (tipKey ? tip(tipKey, title) : '') + '</h3>' +
      '<div class="guide-section-body" id="guide-b-' + id + '"' + (closed ? ' hidden' : '') + '>' +
      '<div class="guide-ai-slot" data-ai-section="' + id + '"></div>' + body + '</div></section>';
  }

  function toolbar() {
    return '<nav class="guide-toolbar" aria-label="Character Guide sections">' +
      '<span class="guide-toolbar-label">Jump to:</span>' +
      SECTIONS.map(function (s, i) { return '<button type="button" class="guide-jump" data-guide-jump="' + s[0] + '">' + (i + 1) + '. ' + esc(s[1]) + '</button>'; }).join('') +
      '<span class="guide-toolbar-actions"><button type="button" class="guide-jump" data-guide-all="collapse">Collapse all</button>' +
      '<button type="button" class="guide-jump" data-guide-all="expand">Expand all</button></span></nav>';
  }

  function comboCard(c) {
    return '<article class="guide-combo is-' + c.status + '">' +
      '<h4>' + esc(c.title) + (c.status === 'future' ? ' <span class="guide-badge">Level ' + c.level + '</span>' : '') + '</h4>' +
      '<p>' + esc(c.why) + '</p><p class="guide-how"><strong>How:</strong> ' + esc(c.how) + '</p>' +
      (c.note ? '<p class="guide-note">' + esc(c.note) + '</p>' : '') +
      (c.missing && c.missing.length ? '<p class="guide-missing"><strong>' + (c.status === 'future' ? 'Needs' : 'Choose') + ':</strong> ' + esc(c.missing.join('; ')) + '</p>' : '') +
      '</article>';
  }

  function render(doc, derived) {
    var g = global.FogCharacterGuide.build(doc, derived);
    var id = g.identity;
    var html = '<div class="character-guide" data-guide-hash="' + esc(g.hash) + '">';
    html += '<p class="guide-intro">This guide is generated from your character’s actual choices and the SRD 5.2.1 rules. It updates whenever you edit the character. Click a section title to fold it away.</p>';
    html += toolbar();
    if (global.FogGuideAI && global.FogGuideAI.enabled()) {
      html += '<div class="guide-ai-panel"><button type="button" class="btn btn-secondary btn-sm" data-guide-ai>Explain in plain words (AI)</button>' +
        '<p class="guide-ai-status" role="status" aria-live="polite"></p></div>';
    }

    // 1. Who is this character?
    html += section('who', 1, 'Who Is This Character?',
      '<p class="guide-headline">' + esc(id.headline) + '</p>' +
      id.paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      (id.roles.length ? '<p class="guide-roles">' + id.roles.map(function (r) { return '<span class="guide-chip">' + esc(r) + '</span>'; }).join('') + '</p>' : '') +
      '<dl class="guide-facts">' + id.facts.map(function (f) { return '<div><dt>' + esc(f.label) + ' ' + tip(f.tip, f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>'; }).join('') + '</dl>' +
      (id.personal.length ? list(id.personal) : ''), 'class');

    // 2. Abilities
    html += section('abilities', 2, 'Understanding Your Abilities',
      '<div class="guide-abilities">' + g.abilities.map(function (a) {
        return '<article class="guide-ability"><h4>' + esc(a.name) + (a.tip ? ' ' + tip(a.tip, a.name) : '') + '</h4>' +
          '<p class="guide-meta"><span>' + esc(a.source) + '</span><span>' + esc(a.actionType) + '</span>' +
          (a.recharge ? '<span>' + esc(a.recharge) + '</span>' : '') + (a.resource ? '<span>Now: ' + esc(a.resource) + '</span>' : '') + '</p>' +
          '<p>' + esc(a.what) + '</p>' +
          (a.limits.length ? '<p class="guide-limits"><strong>Limits:</strong> ' + esc(a.limits.join(' ')) + '</p>' : '') + '</article>';
      }).join('') + '</div><p class="guide-note">“What it does” and “Limits” quote the SRD text of each feature.</p>', 'features');

    // 3. How to play
    var h = g.howToPlay;
    html += section('howToPlay', 3, 'How to Play',
      '<div class="guide-columns"><div><h4>In combat ' + tip('actions', 'Actions on your turn') + '</h4>' + list(h.combat) + '</div>' +
      '<div><h4>Outside combat ' + tip('skills', 'Skills') + '</h4>' + list(h.outside) + '</div></div>' +
      '<h4>Priorities</h4>' + list(h.priorities) +
      '<h4>Common beginner mistakes</h4>' + list(h.mistakes, 'guide-list guide-warn'), null);

    // 4. Combos
    var co = g.combos;
    var groups = ['now', 'situational', 'option', 'future'].filter(function (k) { return co[k].length; });
    html += section('combos', 4, 'Recommended Combos and Synergies',
      (groups.length ? groups.map(function (k) {
        return '<h4 class="guide-combo-group">' + esc(STATUS_LABEL[k]) + '</h4><div class="guide-combos">' + co[k].map(comboCard).join('') + '</div>';
      }).join('') : '<p class="guide-empty">No catalogued combinations apply to this character yet.</p>') +
      '<p class="guide-note">Only combinations that are legal for this character’s class are shown; each lists what it needs.</p>', null);

    // 5. Strengths and weaknesses
    var s = g.strengths;
    html += section('strengths', 5, 'Strengths and Weaknesses',
      '<div class="guide-columns"><div><h4>Strengths</h4>' + list(s.strengths, 'guide-list guide-good') + '</div>' +
      '<div><h4>Weaknesses</h4>' + list(s.weaknesses, 'guide-list guide-warn') + '</div></div>' +
      '<h4>Party roles</h4><p class="guide-roles">' + s.roles.map(function (r) { return '<span class="guide-chip">' + esc(r) + '</span>'; }).join('') + '</p>', null);

    // 6. Level progression
    html += section('progression', 6, 'Level Progression',
      g.progression.length ? '<ol class="guide-progression">' + g.progression.map(function (p, i) {
        return '<li class="' + (i < 3 ? 'is-near' : '') + '"><strong>Level ' + p.level + '</strong> <span class="guide-hp">' + esc(p.hp) + '</span>' +
          (p.gains.length ? '<span class="guide-gains">' + esc(p.gains.join(' · ')) + '</span>' : '<span class="guide-gains guide-muted">More Hit Points</span>') + '</li>';
      }).join('') + '</ol>' : '<p class="guide-empty">Level 20 is the highest level.</p>', 'level');

    html += '<p class="guide-source">' + esc(g.sources) + '</p></div>';
    return { html: html, guide: g };
  }

  /** Section folding, "Jump to" and Collapse/Expand all. Returns a cleanup function. */
  function bindSections(container) {
    function setOpen(id, open) {
      var sec = container.querySelector('#guide-' + id);
      if (!sec) return;
      sec.classList.toggle('is-collapsed', !open);
      sec.querySelector('.guide-section-body').hidden = !open;
      sec.querySelector('[data-guide-toggle]').setAttribute('aria-expanded', String(open));
    }
    function save() {
      writeCollapsed(SECTIONS.map(function (s) { return s[0]; }).filter(function (id) {
        var sec = container.querySelector('#guide-' + id);
        return sec && sec.classList.contains('is-collapsed');
      }));
    }
    function onClick(e) {
      var t = e.target.closest('[data-guide-toggle], [data-guide-jump], [data-guide-all]');
      if (!t || !container.contains(t)) return;
      if (t.hasAttribute('data-guide-toggle')) {
        var id = t.getAttribute('data-guide-toggle');
        setOpen(id, t.getAttribute('aria-expanded') !== 'true');
        save();
      } else if (t.hasAttribute('data-guide-jump')) {
        var target = t.getAttribute('data-guide-jump');
        setOpen(target, true);
        save();
        var sec = container.querySelector('#guide-' + target);
        if (sec) {
          sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          sec.querySelector('[data-guide-toggle]').focus({ preventScroll: true });
        }
      } else {
        var open = t.getAttribute('data-guide-all') === 'expand';
        SECTIONS.forEach(function (s) { setOpen(s[0], open); });
        save();
      }
    }
    container.addEventListener('click', onClick);
    return function () { container.removeEventListener('click', onClick); };
  }

  /** Wire the guide's controls (folding, jump links, optional AI). Returns a cleanup function. */
  function bindAi(container, doc, derived, guide) {
    var offSections = container ? bindSections(container) : function () {};
    var off = bindAiButton(container, doc, derived, guide);
    return function () {
      offSections();
      off();
    };
  }

  function bindAiButton(container, doc, derived, guide) {
    var btn = container && container.querySelector('[data-guide-ai]');
    if (!btn || !global.FogGuideAI) return function () {};
    var status = container.querySelector('.guide-ai-status');
    var alive = true;
    function show(res) {
      container.querySelectorAll('.guide-ai-slot').forEach(function (slot) { slot.innerHTML = ''; });
      res.sections.forEach(function (s) {
        var slot = container.querySelector('[data-ai-section="' + s.id + '"]');
        if (slot) slot.innerHTML = '<div class="guide-ai-text"><span class="guide-ai-label">AI explanation (checked against the rules data)</span>' + s.paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
      });
      status.textContent = (res.cached ? 'Showing saved AI explanation. ' : '') + (res.dropped ? res.dropped + ' AI sentence(s) were removed because they mentioned rules or numbers not in your character’s data.' : 'AI text passed the rules check.');
    }
    var cached = global.FogGuideAI.readCache(doc.id, guide.hash);
    if (cached) show(Object.assign({ cached: true }, cached));
    function onClick() {
      btn.disabled = true;
      status.textContent = 'Asking the AI…';
      global.FogGuideAI.request(doc, guide, derived).then(function (res) {
        if (alive) show(res);
      }).catch(function (e) {
        if (alive) status.textContent = e.message;
      }).then(function () {
        if (alive) btn.disabled = false;
      });
    }
    btn.addEventListener('click', onClick);
    return function () {
      alive = false;
      btn.removeEventListener('click', onClick);
    };
  }

  global.FogGuideView = { render: render, bindAi: bindAi };
})(window);
