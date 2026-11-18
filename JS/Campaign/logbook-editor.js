/**
 * Rich text editor for the Logbook.
 *
 * FogLogbookEditor.create(container, { value, placeholder, maxLength, onChange }) → { getValue, setValue, focus, destroy }
 *
 * Uses contenteditable with a toolbar for fonts, colors, alignment, block types, and inline formatting.
 * Stores and returns sanitized HTML. Plain-text content from before the editor is auto-converted on load.
 */
(function (global) {
  'use strict';

  var FONTS = [
    ['inherit', 'Default'],
    ["'Cinzel', Georgia, serif", 'Cinzel'],
    ["'EB Garamond', Georgia, serif", 'EB Garamond'],
    ["'Lato', Helvetica, sans-serif", 'Lato'],
    ['Georgia, serif', 'Georgia'],
    ["'Courier New', monospace", 'Monospace'],
  ];

  var SIZES = [
    ['0.85rem', 'Small'],
    ['1rem', 'Normal'],
    ['1.2rem', 'Large'],
    ['1.5rem', 'X-Large'],
  ];

  var COLORS = [
    ['', 'Default'],
    ['#f6efe1', 'Parchment'],
    ['#c9b98a', 'Gold'],
    ['#8b1523', 'Blood Red'],
    ['#4a1a2e', 'Burgundy'],
    ['#1a3a1a', 'Forest'],
    ['#1a2a4a', 'Deep Blue'],
    ['#f5f5f5', 'White'],
    ['#999999', 'Gray'],
    ['#2a2118', 'Ink'],
  ];

  var HIGHLIGHTS = [
    ['', 'None'],
    ['rgba(139,21,35,0.15)', 'Red'],
    ['rgba(201,185,138,0.25)', 'Gold'],
    ['rgba(26,58,26,0.15)', 'Green'],
    ['rgba(26,42,74,0.15)', 'Blue'],
    ['rgba(74,26,46,0.15)', 'Purple'],
    ['rgba(246,239,225,0.3)', 'Parchment'],
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function isHtml(s) {
    return /<[a-z][\s\S]*>/i.test(s);
  }

  function plainToHtml(s) {
    if (!s) return '';
    return s.split(/\n{2,}/).filter(Boolean).map(function (p) {
      return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  var ALLOWED_TAGS = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'h3', 'h4', 'h5',
    'blockquote', 'ul', 'ol', 'li', 'hr', 'span', 'div', 'sub', 'sup', 'a', 'img', 'figure', 'figcaption'];
  var ALLOWED_ATTRS = ['style', 'class', 'href', 'target', 'src', 'alt'];

  function sanitize(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('script, iframe, object, embed, form, input, textarea, select, button, link, meta').forEach(function (el) { el.remove(); });
    tmp.querySelectorAll('*').forEach(function (el) {
      if (ALLOWED_TAGS.indexOf(el.tagName.toLowerCase()) < 0) {
        while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
        el.remove();
        return;
      }
      var attrs = Array.from(el.attributes);
      attrs.forEach(function (a) {
        if (ALLOWED_ATTRS.indexOf(a.name) < 0) el.removeAttribute(a.name);
      });
      if (el.hasAttribute('href')) {
        var href = el.getAttribute('href');
        if (!/^https?:\/\//i.test(href) && !/^#/.test(href)) el.removeAttribute('href');
      }
      if (el.hasAttribute('style')) {
        var st = el.style;
        var safe = '';
        ['font-family', 'font-size', 'color', 'background-color', 'background', 'text-align',
         'text-decoration', 'font-weight', 'font-style', 'margin', 'margin-left', 'padding',
         'border-left', 'line-height'].forEach(function (prop) {
          if (st.getPropertyValue(prop)) safe += prop + ':' + st.getPropertyValue(prop) + ';';
        });
        if (safe) el.setAttribute('style', safe); else el.removeAttribute('style');
      }
    });
    return tmp.innerHTML.trim();
  }

  function cmd(c, val) {
    document.execCommand(c, false, val || null);
  }

  function queryCmd(c) {
    return document.queryCommandState(c);
  }

  function create(container, opts) {
    opts = opts || {};
    var onChange = opts.onChange || function () {};
    var maxLen = opts.maxLength || 20000;

    var html = '<div class="le-wrap">' +
      '<div class="le-toolbar" role="toolbar" aria-label="Formatting">' +
        '<div class="le-group le-group-format">' +
          '<button type="button" class="le-btn" data-le="bold" title="Bold (Ctrl+B)"><b>B</b></button>' +
          '<button type="button" class="le-btn" data-le="italic" title="Italic (Ctrl+I)"><i>I</i></button>' +
          '<button type="button" class="le-btn" data-le="underline" title="Underline (Ctrl+U)"><u>U</u></button>' +
          '<button type="button" class="le-btn" data-le="strikeThrough" title="Strikethrough"><s>S</s></button>' +
        '</div>' +
        '<div class="le-sep"></div>' +
        '<div class="le-group">' +
          '<select class="le-select" data-le="font" title="Font" aria-label="Font">' +
            FONTS.map(function (f) { return '<option value="' + esc(f[0]) + '">' + esc(f[1]) + '</option>'; }).join('') +
          '</select>' +
          '<select class="le-select le-select-sm" data-le="size" title="Size" aria-label="Font size">' +
            SIZES.map(function (s) { return '<option value="' + esc(s[0]) + '"' + (s[0] === '1rem' ? ' selected' : '') + '>' + esc(s[1]) + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div class="le-sep"></div>' +
        '<div class="le-group">' +
          '<div class="le-dropdown">' +
            '<button type="button" class="le-btn le-btn-color" data-le="showColors" title="Text color"><span class="le-swatch" style="background:#2a2118"></span> A</button>' +
            '<div class="le-dropdown-menu le-colors" hidden>' +
              COLORS.map(function (c) { return '<button type="button" class="le-color-btn" data-le="foreColor" data-val="' + esc(c[0]) + '" title="' + esc(c[1]) + '"><span class="le-swatch" style="background:' + (c[0] || 'currentColor') + '"></span></button>'; }).join('') +
            '</div>' +
          '</div>' +
          '<div class="le-dropdown">' +
            '<button type="button" class="le-btn" data-le="showHighlight" title="Highlight"><span class="le-swatch le-swatch-hl" style="background:rgba(201,185,138,0.25)"></span></button>' +
            '<div class="le-dropdown-menu le-colors" hidden>' +
              HIGHLIGHTS.map(function (c) { return '<button type="button" class="le-color-btn" data-le="hiliteColor" data-val="' + esc(c[0]) + '" title="' + esc(c[1]) + '"><span class="le-swatch" style="background:' + (c[0] || 'transparent') + ';border:1px solid var(--cw-border)"></span></button>'; }).join('') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="le-sep"></div>' +
        '<div class="le-group">' +
          '<button type="button" class="le-btn le-align-l" data-le="justifyLeft" title="Align left"><span class="le-align-icon"></span></button>' +
          '<button type="button" class="le-btn le-align-c" data-le="justifyCenter" title="Align center"><span class="le-align-icon"></span></button>' +
          '<button type="button" class="le-btn le-align-r" data-le="justifyRight" title="Align right"><span class="le-align-icon"></span></button>' +
        '</div>' +
        '<div class="le-sep"></div>' +
        '<div class="le-group">' +
          '<button type="button" class="le-btn" data-le="insertUnorderedList" title="Bullet list">•</button>' +
          '<button type="button" class="le-btn" data-le="insertOrderedList" title="Numbered list">1.</button>' +
          '<button type="button" class="le-btn" data-le="blockquote" title="Quote">"</button>' +
          '<button type="button" class="le-btn" data-le="insertHorizontalRule" title="Divider">&mdash;</button>' +
        '</div>' +
        '<div class="le-sep"></div>' +
        '<div class="le-group">' +
          '<select class="le-select" data-le="block" title="Block type" aria-label="Block type">' +
            '<option value="p">Paragraph</option>' +
            '<option value="h3">Heading</option>' +
            '<option value="h4">Subheading</option>' +
            '<option value="h5">Small heading</option>' +
          '</select>' +
        '</div>' +
        '<div class="le-sep"></div>' +
        '<div class="le-group">' +
          '<button type="button" class="le-btn" data-le="layout-callout" title="Callout box">▣</button>' +
          '<button type="button" class="le-btn" data-le="layout-columns" title="Two columns">◫</button>' +
          '<button type="button" class="le-btn" data-le="insertImage" title="Insert image">🖼</button>' +
          '<button type="button" class="le-btn" data-le="removeFormat" title="Clear formatting">✘</button>' +
        '</div>' +
        '<div class="le-sep"></div>' +
        '<div class="le-group">' +
          '<button type="button" class="le-btn" data-le="undo" title="Undo (Ctrl+Z)">↩</button>' +
          '<button type="button" class="le-btn" data-le="redo" title="Redo (Ctrl+Y)">↪</button>' +
        '</div>' +
      '</div>' +
      '<div class="le-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="' + esc(opts.placeholder || 'Write your content here...') + '" data-placeholder="' + esc(opts.placeholder || 'Write your content here...') + '"></div>' +
      '<div class="le-footer"><span class="le-hint">Ctrl+B bold · Ctrl+I italic · Ctrl+U underline</span><span class="le-count"></span></div>' +
    '</div>';

    container.innerHTML = html;
    var wrap = container.querySelector('.le-wrap');
    var editable = container.querySelector('.le-body');
    var countEl = container.querySelector('.le-count');
    var toolbar = container.querySelector('.le-toolbar');

    var initialValue = opts.value || '';
    editable.innerHTML = isHtml(initialValue) ? initialValue : plainToHtml(initialValue);

    function textLen() { return (editable.textContent || '').length; }

    function updateCount() {
      var len = textLen();
      countEl.textContent = len + ' / ' + maxLen;
      countEl.classList.toggle('le-over', len > maxLen);
    }
    updateCount();

    function refocusEditor() {
      editable.focus();
      var sel = window.getSelection();
      if (!sel.rangeCount || !editable.contains(sel.anchorNode)) {
        var range = document.createRange();
        range.selectNodeContents(editable);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    function closeDropdowns() {
      toolbar.querySelectorAll('.le-dropdown-menu').forEach(function (m) { m.hidden = true; });
    }

    function wrapSelection(styleProp, val) {
      var sel = window.getSelection();
      if (!sel.rangeCount) return;
      var range = sel.getRangeAt(0);
      if (range.collapsed) return;
      var span = document.createElement('span');
      span.style[styleProp] = val;
      try {
        range.surroundContents(span);
      } catch (e) {
        span.appendChild(range.extractContents());
        range.insertNode(span);
      }
      sel.removeAllRanges();
      var nr = document.createRange();
      nr.selectNodeContents(span);
      sel.addRange(nr);
    }

    function applyFont(val) {
      if (val === 'inherit') { cmd('removeFormat'); return; }
      wrapSelection('fontFamily', val);
    }

    function applySize(val) {
      wrapSelection('fontSize', val);
    }

    function insertCallout() {
      var callout = document.createElement('div');
      callout.className = 'le-callout';
      callout.innerHTML = '<p>Write your callout here...</p>';
      cmd('insertHTML', callout.outerHTML);
    }

    function insertColumns() {
      var cols = document.createElement('div');
      cols.className = 'le-columns';
      cols.innerHTML = '<div class="le-col"><p>Left column</p></div><div class="le-col"><p>Right column</p></div>';
      cmd('insertHTML', cols.outerHTML);
    }

    function insertBlockquote() {
      var sel = window.getSelection();
      if (!sel.rangeCount) { cmd('insertHTML', '<blockquote><p>Quote text here...</p></blockquote>'); return; }
      cmd('formatBlock', 'blockquote');
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
          refocusEditor();
          cmd('insertHTML', '<img src="' + reader.result + '" alt="Inserted image" style="max-width:100%;border-radius:4px;margin:0.5rem 0;display:block">');
          updateCount();
          onChange(getValue());
        };
        reader.readAsDataURL(file);
      });
      input.click();
    }

    toolbar.addEventListener('mousedown', function (e) {
      if (e.target.closest('.le-dropdown-menu')) return;
      e.preventDefault();
    });

    toolbar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-le]');
      if (!btn) return;
      var action = btn.getAttribute('data-le');

      if (action === 'showColors' || action === 'showHighlight') {
        var menu = btn.closest('.le-dropdown').querySelector('.le-dropdown-menu');
        var wasHidden = menu.hidden;
        closeDropdowns();
        menu.hidden = !wasHidden;
        return;
      }

      if (action === 'foreColor' || action === 'hiliteColor') {
        var val = btn.getAttribute('data-val');
        refocusEditor();
        if (val) {
          cmd(action, val);
        } else if (action === 'hiliteColor') {
          cmd('hiliteColor', 'transparent');
        } else {
          cmd('removeFormat');
        }
        closeDropdowns();
        updateCount();
        onChange(getValue());
        return;
      }

      if (action === 'blockquote') { refocusEditor(); insertBlockquote(); updateCount(); onChange(getValue()); return; }
      if (action === 'layout-callout') { refocusEditor(); insertCallout(); updateCount(); onChange(getValue()); return; }
      if (action === 'layout-columns') { refocusEditor(); insertColumns(); updateCount(); onChange(getValue()); return; }
      if (action === 'insertImage') { insertImage(); return; }

      if (action === 'bold' || action === 'italic' || action === 'underline' || action === 'strikeThrough' ||
          action === 'justifyLeft' || action === 'justifyCenter' || action === 'justifyRight' ||
          action === 'insertUnorderedList' || action === 'insertOrderedList' ||
          action === 'insertHorizontalRule' || action === 'removeFormat' ||
          action === 'undo' || action === 'redo') {
        refocusEditor();
        cmd(action);
        updateCount();
        onChange(getValue());
        return;
      }
    });

    toolbar.addEventListener('change', function (e) {
      var sel = e.target;
      var action = sel.getAttribute('data-le');
      if (action === 'font') { refocusEditor(); applyFont(sel.value); }
      else if (action === 'size') { refocusEditor(); applySize(sel.value); }
      else if (action === 'block') { refocusEditor(); cmd('formatBlock', sel.value); }
      updateCount();
      onChange(getValue());
    });

    editable.addEventListener('input', function () {
      updateCount();
      onChange(getValue());
    });

    editable.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = e.clipboardData.getData('text/html');
      if (text) {
        cmd('insertHTML', sanitize(text));
      } else {
        text = e.clipboardData.getData('text/plain');
        cmd('insertText', text);
      }
      updateCount();
      onChange(getValue());
    });

    editable.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        cmd('insertHTML', '&emsp;');
      }
    });

    function docClick(e) {
      if (!e.target.closest('.le-dropdown')) closeDropdowns();
    }
    document.addEventListener('click', docClick);

    function getValue() {
      return sanitize(editable.innerHTML);
    }

    function setValue(val) {
      editable.innerHTML = isHtml(val) ? val : plainToHtml(val);
      updateCount();
    }

    return {
      getValue: getValue,
      setValue: setValue,
      focus: function () { editable.focus(); },
      destroy: function () { document.removeEventListener('click', docClick); container.innerHTML = ''; },
      el: wrap
    };
  }

  function renderContent(content) {
    if (!content) return '';
    if (isHtml(content)) return sanitize(content);
    return plainToHtml(content);
  }

  global.FogLogbookEditor = {
    create: create,
    renderContent: renderContent,
    isHtml: isHtml,
    sanitize: sanitize
  };
})(window);
