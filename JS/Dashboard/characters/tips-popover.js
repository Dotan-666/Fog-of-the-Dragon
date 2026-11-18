/**
 * Guided-tip "?" buttons and their popover (creator, sheet and guide).
 *
 *   FogTips.button('armorClass', 'Armor Class')  → HTML for a small "?" button
 *   var off = FogTips.attach(rootElement)        → one delegated listener; call off() on page cleanup
 *
 * Accessible: real <button>s with aria-expanded/aria-controls; the popover is a labelled dialog that
 * takes focus, closes on Escape (focus returns to the button), outside click, or the close button.
 * Click/tap only (never hover-only). Positioned inside the viewport; a bottom sheet on narrow screens.
 */
(function (global) {
  'use strict';

  var esc = function (s) { return global.FogCharacterUI.escapeHtml(s); };
  var Tips = function () { return global.FogGuidedTips; };

  var POP_ID = 'fog-tip-popover';
  var uid = 0;

  function button(key, label) {
    if (!key) return '';
    return '<button type="button" class="fog-tip-btn" data-tip="' + esc(key) + '" aria-haspopup="dialog" aria-expanded="false" aria-label="Explain ' + esc(label || 'this') + '">?</button>';
  }

  function renderTip(tip) {
    var UI = global.FogCharacterUI;
    var html = '<div class="fog-tip-head"><h3 id="fog-tip-title">' + esc(tip.title) + '</h3>' +
      '<button type="button" class="fog-tip-close" data-tip-close aria-label="Close">×</button></div>' +
      '<div class="fog-tip-body">' +
      (tip.summary ? '<p class="fog-tip-summary">' + esc(tip.summary) + '</p>' : '') +
      (tip.example ? '<p class="fog-tip-example"><strong>Example:</strong> ' + esc(tip.example) + '</p>' : '');
    if (tip.rule) {
      var open = !tip.summary;
      html += '<details class="fog-tip-rule"' + (open ? ' open' : '') + '><summary>Official rule text</summary>' +
        '<div class="fog-tip-rule-text">' + UI.rulesText(tip.rule.text) + '</div>' +
        '<p class="fog-tip-source">' + esc(tip.rule.source) + '</p></details>';
    }
    if (tip.extraRule) {
      html += '<details class="fog-tip-rule"><summary>' + esc(tip.extraRule.title) + ' (Rules Glossary)</summary>' +
        '<div class="fog-tip-rule-text">' + UI.rulesText(tip.extraRule.text) + '</div><p class="fog-tip-source">' + esc(tip.extraRule.source) + '</p></details>';
    }
    html += '<p class="fog-tip-license">Rules text: 5e 2024 Rules, CC BY 4.0.</p></div>';
    return html;
  }

  function attach(root) {
    var pop = null;
    var opener = null;

    function close(returnFocus) {
      if (!pop) return;
      pop.remove();
      pop = null;
      if (opener) {
        opener.setAttribute('aria-expanded', 'false');
        if (returnFocus && document.contains(opener)) opener.focus();
      }
      opener = null;
    }

    function place() {
      if (!pop || !opener) return;
      var narrow = global.innerWidth < 600;
      pop.classList.toggle('is-sheet', narrow);
      if (narrow) {
        pop.style.left = '';
        pop.style.top = '';
        return;
      }
      var r = opener.getBoundingClientRect();
      var w = pop.offsetWidth;
      var h = pop.offsetHeight;
      var margin = 12;
      var left = Math.min(Math.max(margin, r.left + r.width / 2 - w / 2), global.innerWidth - w - margin);
      var below = r.bottom + 8;
      var top = below + h + margin <= global.innerHeight ? below : Math.max(margin, r.top - h - 8);
      pop.style.left = Math.round(left) + 'px';
      pop.style.top = Math.round(top) + 'px';
    }

    function open(btn) {
      var key = btn.getAttribute('data-tip');
      if (opener === btn) {
        close(true);
        return;
      }
      close(false);
      var tip = Tips() && Tips().get(key);
      if (!tip) return;
      opener = btn;
      pop = document.createElement('div');
      pop.id = POP_ID + '-' + (++uid);
      pop.className = 'fog-tip-popover';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-modal', 'false');
      pop.setAttribute('aria-labelledby', 'fog-tip-title');
      pop.tabIndex = -1;
      pop.innerHTML = renderTip(tip);
      document.body.appendChild(pop);
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-controls', pop.id);
      place();
      pop.focus({ preventScroll: true });
    }

    function onClick(e) {
      var btn = e.target.closest && e.target.closest('[data-tip]');
      if (btn && root.contains(btn)) {
        e.preventDefault();
        e.stopPropagation();
        open(btn);
        return;
      }
      if (pop && e.target.closest('[data-tip-close]') && pop.contains(e.target)) {
        close(true);
        return;
      }
      if (pop && !pop.contains(e.target)) close(false);
    }

    function onKey(e) {
      if (e.key === 'Escape' && pop) {
        e.stopPropagation();
        close(true);
      }
      if (e.key === 'Tab' && pop && pop.contains(document.activeElement)) {
        // Keep focus inside while open
        var items = pop.querySelectorAll('button, summary, a[href]');
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === pop)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function onMove() {
      if (pop) place();
    }

    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    global.addEventListener('resize', onMove);
    global.addEventListener('scroll', onMove, true);

    return function detach() {
      close(false);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      global.removeEventListener('resize', onMove);
      global.removeEventListener('scroll', onMove, true);
    };
  }

  global.FogTips = { button: button, attach: attach };
})(window);
