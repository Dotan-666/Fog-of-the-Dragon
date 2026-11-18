/**
 * Book editor: adds a Canva-like editing overlay to the campaign book.
 *
 * FogBookEditor.attach(bookEl, campaignId) → { destroy }
 *
 * When the user clicks "Edit Book", the rendered book becomes contenteditable with a sticky
 * toolbar for fonts, colors, text size, alignment, and image insertion. Edits are saved to
 * localStorage so the DM's custom styling persists across visits. "Reset to default" discards
 * overrides and re-renders from campaign data.
 */
(function (global) {
  'use strict';

  var STORAGE_PREFIX = 'fog_book_custom_';

  var FONTS = [
    ['inherit', 'Default (EB Garamond)'],
    ["'Cinzel', Georgia, serif", 'Cinzel'],
    ["'EB Garamond', Georgia, serif", 'EB Garamond'],
    ["'Lato', Helvetica, sans-serif", 'Lato'],
    ['Georgia, serif', 'Georgia'],
    ["'Courier New', monospace", 'Monospace'],
    ["'Playfair Display', Georgia, serif", 'Playfair Display'],
  ];

  var SIZES = [
    ['0.85rem', 'Small'], ['1rem', 'Normal'], ['1.15rem', 'Medium'],
    ['1.3rem', 'Large'], ['1.6rem', 'X-Large'], ['2rem', 'Huge'],
  ];

  var COLORS = [
    ['', 'Default'], ['#2a2118', 'Ink'], ['#8b1523', 'Blood Red'],
    ['#4a1a2e', 'Burgundy'], ['#1a3a1a', 'Forest'], ['#1a2a4a', 'Deep Blue'],
    ['#c9b98a', 'Gold'], ['#f5f5f5', 'White'], ['#999999', 'Gray'],
    ['#d4a44c', 'Amber'], ['#5b4b3d', 'Sepia'],
  ];

  var BG_COLORS = [
    ['', 'None'], ['rgba(139,21,35,0.1)', 'Red tint'], ['rgba(201,185,138,0.2)', 'Gold tint'],
    ['rgba(26,58,26,0.1)', 'Green tint'], ['rgba(26,42,74,0.1)', 'Blue tint'],
    ['rgba(246,239,225,0.3)', 'Parchment'], ['rgba(0,0,0,0.05)', 'Subtle gray'],
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function cmd(c, val) { document.execCommand(c, false, val || null); }

  function storageKey(campaignId) { return STORAGE_PREFIX + campaignId; }

  function loadSaved(campaignId) {
    try { return localStorage.getItem(storageKey(campaignId)); } catch (e) { return null; }
  }

  function saveDraft(campaignId, html) {
    try { localStorage.setItem(storageKey(campaignId), html); } catch (e) { /* full */ }
  }

  function clearDraft(campaignId) {
    try { localStorage.removeItem(storageKey(campaignId)); } catch (e) { /* ignore */ }
  }

  function wrapSelection(styleProp, val) {
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    if (range.collapsed) return;
    var span = document.createElement('span');
    span.style[styleProp] = val;
    try { range.surroundContents(span); } catch (e) {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    sel.removeAllRanges();
    var nr = document.createRange();
    nr.selectNodeContents(span);
    sel.addRange(nr);
  }

  function buildToolbar() {
    var html = '<div class="bke-toolbar" role="toolbar" aria-label="Book editing tools">' +
      '<div class="bke-group">' +
        '<button type="button" class="bke-btn" data-bke="bold" title="Bold"><b>B</b></button>' +
        '<button type="button" class="bke-btn" data-bke="italic" title="Italic"><i>I</i></button>' +
        '<button type="button" class="bke-btn" data-bke="underline" title="Underline"><u>U</u></button>' +
      '</div>' +
      '<div class="bke-sep"></div>' +
      '<div class="bke-group">' +
        '<select class="bke-select" data-bke="font" title="Font" aria-label="Font">' +
          FONTS.map(function (f) { return '<option value="' + esc(f[0]) + '">' + esc(f[1]) + '</option>'; }).join('') +
        '</select>' +
        '<select class="bke-select bke-select-sm" data-bke="size" title="Size" aria-label="Font size">' +
          SIZES.map(function (s) { return '<option value="' + esc(s[0]) + '"' + (s[0] === '1rem' ? ' selected' : '') + '>' + esc(s[1]) + '</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<div class="bke-sep"></div>' +
      '<div class="bke-group">' +
        '<div class="bke-dropdown">' +
          '<button type="button" class="bke-btn" data-bke="showColors" title="Text color"><span class="bke-swatch" style="background:#2a2118"></span> A</button>' +
          '<div class="bke-dropdown-menu bke-colors" hidden>' +
            COLORS.map(function (c) { return '<button type="button" class="bke-color-btn" data-bke="foreColor" data-val="' + esc(c[0]) + '" title="' + esc(c[1]) + '"><span class="bke-swatch" style="background:' + (c[0] || 'currentColor') + '"></span></button>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div class="bke-dropdown">' +
          '<button type="button" class="bke-btn" data-bke="showBg" title="Highlight"><span class="bke-swatch" style="background:rgba(201,185,138,0.2);border:1px solid #b8a88f"></span></button>' +
          '<div class="bke-dropdown-menu bke-colors" hidden>' +
            BG_COLORS.map(function (c) { return '<button type="button" class="bke-color-btn" data-bke="hiliteColor" data-val="' + esc(c[0]) + '" title="' + esc(c[1]) + '"><span class="bke-swatch" style="background:' + (c[0] || 'transparent') + ';border:1px solid #b8a88f"></span></button>'; }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="bke-sep"></div>' +
      '<div class="bke-group">' +
        '<button type="button" class="bke-btn" data-bke="justifyLeft" title="Align left">⫷</button>' +
        '<button type="button" class="bke-btn" data-bke="justifyCenter" title="Align center">⫸</button>' +
        '<button type="button" class="bke-btn" data-bke="justifyRight" title="Align right">⫹</button>' +
      '</div>' +
      '<div class="bke-sep"></div>' +
      '<div class="bke-group">' +
        '<button type="button" class="bke-btn" data-bke="insertImage" title="Insert image">🖼</button>' +
        '<button type="button" class="bke-btn" data-bke="insertHorizontalRule" title="Divider">—</button>' +
        '<button type="button" class="bke-btn" data-bke="removeFormat" title="Clear formatting">✘</button>' +
      '</div>' +
      '<div class="bke-spacer"></div>' +
      '<div class="bke-group">' +
        '<button type="button" class="bke-btn bke-btn-save" data-bke="save" title="Save changes">Save</button>' +
        '<button type="button" class="bke-btn bke-btn-cancel" data-bke="cancel" title="Stop editing">Cancel</button>' +
      '</div>' +
    '</div>';
    return html;
  }

  function attach(bookEl, campaignId, onReset) {
    if (!bookEl) return null;
    var editing = false;
    var toolbar = null;
    var cleanups = [];

    var saved = loadSaved(campaignId);
    if (saved) bookEl.innerHTML = saved;

    function enterEdit() {
      if (editing) return;
      editing = true;
      bookEl.setAttribute('contenteditable', 'true');
      bookEl.classList.add('is-editing');

      var div = document.createElement('div');
      div.innerHTML = buildToolbar();
      toolbar = div.firstElementChild;
      bookEl.parentNode.insertBefore(toolbar, bookEl);

      toolbar.addEventListener('mousedown', function (e) {
        if (e.target.closest('.bke-dropdown-menu')) return;
        e.preventDefault();
      });

      toolbar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-bke]');
        if (!btn) return;
        var action = btn.getAttribute('data-bke');

        if (action === 'showColors' || action === 'showBg') {
          var menu = btn.closest('.bke-dropdown').querySelector('.bke-dropdown-menu');
          var wasHidden = menu.hidden;
          closeDropdowns();
          menu.hidden = !wasHidden;
          return;
        }

        if (action === 'foreColor' || action === 'hiliteColor') {
          var val = btn.getAttribute('data-val');
          bookEl.focus();
          if (val) cmd(action, val);
          else if (action === 'hiliteColor') cmd('hiliteColor', 'transparent');
          else cmd('removeFormat');
          closeDropdowns();
          return;
        }

        if (action === 'insertImage') {
          insertImage();
          return;
        }

        if (action === 'save') {
          saveAndExit();
          return;
        }

        if (action === 'cancel') {
          exitEdit(false);
          return;
        }

        if (['bold', 'italic', 'underline', 'justifyLeft', 'justifyCenter', 'justifyRight',
             'insertHorizontalRule', 'removeFormat'].indexOf(action) >= 0) {
          bookEl.focus();
          cmd(action);
          return;
        }
      });

      toolbar.addEventListener('change', function (e) {
        var sel = e.target;
        var action = sel.getAttribute('data-bke');
        bookEl.focus();
        if (action === 'font') {
          var val = sel.value;
          if (val === 'inherit') cmd('removeFormat');
          else wrapSelection('fontFamily', val);
        } else if (action === 'size') {
          wrapSelection('fontSize', sel.value);
        }
      });

      function docClick(e) {
        if (!e.target.closest('.bke-dropdown')) closeDropdowns();
      }
      document.addEventListener('click', docClick);
      cleanups.push(function () { document.removeEventListener('click', docClick); });
    }

    function closeDropdowns() {
      if (toolbar) toolbar.querySelectorAll('.bke-dropdown-menu').forEach(function (m) { m.hidden = true; });
    }

    function insertImage() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          bookEl.focus();
          var sel = window.getSelection();
          if (!sel.rangeCount || !bookEl.contains(sel.anchorNode)) {
            var range = document.createRange();
            range.selectNodeContents(bookEl);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          cmd('insertHTML', '<figure class="bk-figure"><img src="' + reader.result + '" alt="Inserted image" style="max-width:100%;max-height:420px;border-radius:4px"></figure>');
        };
        reader.readAsDataURL(file);
      });
      input.click();
    }

    function saveAndExit() {
      saveDraft(campaignId, bookEl.innerHTML);
      exitEdit(true);
      var UI = global.FogCampaignUI;
      if (UI) UI().notice('Book changes saved.');
    }

    function exitEdit(keepChanges) {
      if (!editing) return;
      editing = false;
      bookEl.removeAttribute('contenteditable');
      bookEl.classList.remove('is-editing');
      if (toolbar && toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
      toolbar = null;
      cleanups.forEach(function (fn) { fn(); });
      cleanups = [];
      if (!keepChanges) {
        var saved = loadSaved(campaignId);
        if (saved) {
          bookEl.innerHTML = saved;
        } else if (onReset) {
          onReset();
        }
      }
    }

    function resetToDefault() {
      clearDraft(campaignId);
      if (editing) exitEdit(false);
      if (onReset) onReset();
      var UI = global.FogCampaignUI;
      if (UI) UI().notice('Book reset to default.');
    }

    return {
      enterEdit: enterEdit,
      exitEdit: exitEdit,
      resetToDefault: resetToDefault,
      hasSaved: function () { return !!loadSaved(campaignId); },
      destroy: function () { if (editing) exitEdit(false); }
    };
  }

  global.FogBookEditor = { attach: attach };
})(window);
