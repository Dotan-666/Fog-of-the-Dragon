/**
 * Map drawing tool — a canvas-based editor for creating battle maps from scratch.
 *
 * FogMapDraw.create(container, { onSave(dataUrl, title, grid) })
 *   Returns { destroy() }
 *
 * Features: grid toggle + size, background upload, freehand draw, shapes (rect, circle, line),
 * text labels, eraser, color picker, undo/redo.
 */
(function (global) {
  'use strict';

  var TOOLS = [
    { id: 'select', label: 'Select', icon: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z' },
    { id: 'pen', label: 'Draw', icon: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586' },
    { id: 'line', label: 'Line', icon: 'M5 19L19 5' },
    { id: 'rect', label: 'Rectangle', icon: 'M3 3h18v18H3z' },
    { id: 'circle', label: 'Circle', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z' },
    { id: 'text', label: 'Text', icon: 'M4 7V4h16v3M9 20h6M12 4v16' },
    { id: 'eraser', label: 'Eraser', icon: 'M20 20H7l-4-4a1 1 0 0 1 0-1.41l9.59-9.59a2 2 0 0 1 2.83 0l5.17 5.17a2 2 0 0 1 0 2.83L14 20' },
  ];

  var COLORS = ['#000000', '#ffffff', '#b3261e', '#2f7fd8', '#1b8a2e', '#f9a825', '#7b1fa2', '#ff6d00', '#795548', '#607d8b'];
  var SIZES = [2, 4, 8, 12, 20];

  function icon(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">' + '<path d="' + d + '"/></svg>';
  }

  function create(container, opts) {
    opts = opts || {};
    var state = {
      tool: 'pen',
      color: '#000000',
      size: 4,
      showGrid: true,
      gridCols: 20,
      gridRows: 20,
      bgImage: null,
      objects: [],
      undone: [],
      drawing: false,
      currentPath: null,
      startX: 0, startY: 0,
    };

    var W = 800, H = 800;

    container.innerHTML =
      '<div class="md-editor">' +
        '<div class="md-toolbar">' +
          '<div class="md-tools">' + TOOLS.map(function (t) {
            return '<button type="button" class="md-btn' + (t.id === state.tool ? ' is-active' : '') + '" data-md-tool="' + t.id + '" title="' + t.label + '">' + icon(t.icon) + '</button>';
          }).join('') + '</div>' +
          '<div class="md-sep"></div>' +
          '<div class="md-colors">' + COLORS.map(function (c) {
            return '<button type="button" class="md-swatch' + (c === state.color ? ' is-active' : '') + '" data-md-color="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
          }).join('') + '</div>' +
          '<div class="md-sep"></div>' +
          '<label class="md-field">Size <select class="md-select" data-md-size>' + SIZES.map(function (s) {
            return '<option value="' + s + '"' + (s === state.size ? ' selected' : '') + '>' + s + 'px</option>';
          }).join('') + '</select></label>' +
          '<div class="md-sep"></div>' +
          '<label class="md-check"><input type="checkbox" data-md-grid' + (state.showGrid ? ' checked' : '') + '> Grid</label>' +
          '<label class="md-field">Cols <input type="number" class="md-num" data-md-cols min="4" max="60" value="' + state.gridCols + '"></label>' +
          '<label class="md-field">Rows <input type="number" class="md-num" data-md-rows min="4" max="60" value="' + state.gridRows + '"></label>' +
          '<div class="md-sep"></div>' +
          '<button type="button" class="md-btn" data-md-bg title="Upload background">BG</button>' +
          '<button type="button" class="md-btn" data-md-undo title="Undo">↶</button>' +
          '<button type="button" class="md-btn" data-md-redo title="Redo">↷</button>' +
          '<button type="button" class="md-btn md-btn-clear" data-md-clear title="Clear all">Clear</button>' +
        '</div>' +
        '<div class="md-canvas-wrap"><canvas id="md-canvas" width="' + W + '" height="' + H + '"></canvas></div>' +
        '<div class="md-footer">' +
          '<label class="md-field">Title <input type="text" class="form-control md-title" data-md-title maxlength="120" placeholder="My battle map"></label>' +
          '<button type="button" class="btn btn-primary btn-sm" data-md-save>Save as map</button>' +
        '</div>' +
      '</div>';

    var canvas = container.querySelector('#md-canvas');
    var canvasCtx = canvas.getContext('2d');
    var drawLayer = document.createElement('canvas');
    drawLayer.width = W; drawLayer.height = H;
    var drawCtx = drawLayer.getContext('2d');

    function redraw() {
      drawCtx.clearRect(0, 0, W, H);
      state.objects.forEach(function (obj) { drawObject(drawCtx, obj); });
      if (state.currentPath) drawObject(drawCtx, state.currentPath);

      canvasCtx.clearRect(0, 0, W, H);
      canvasCtx.fillStyle = '#f5f0e6';
      canvasCtx.fillRect(0, 0, W, H);
      if (state.bgImage) canvasCtx.drawImage(state.bgImage, 0, 0, W, H);
      if (state.showGrid) drawGrid();
      canvasCtx.drawImage(drawLayer, 0, 0);
    }

    function drawGrid() {
      canvasCtx.save();
      canvasCtx.strokeStyle = 'rgba(0,0,0,0.15)';
      canvasCtx.lineWidth = 0.5;
      var cw = W / state.gridCols, ch = H / state.gridRows;
      for (var x = 0; x <= state.gridCols; x++) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(x * cw, 0);
        canvasCtx.lineTo(x * cw, H);
        canvasCtx.stroke();
      }
      for (var y = 0; y <= state.gridRows; y++) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, y * ch);
        canvasCtx.lineTo(W, y * ch);
        canvasCtx.stroke();
      }
      canvasCtx.restore();
    }

    function drawObject(c, obj) {
      c.save();
      c.strokeStyle = obj.color || '#000';
      c.fillStyle = obj.color || '#000';
      c.lineWidth = obj.size || 2;
      c.lineCap = 'round';
      c.lineJoin = 'round';

      if (obj.type === 'pen' && obj.points && obj.points.length) {
        c.beginPath();
        c.moveTo(obj.points[0][0], obj.points[0][1]);
        for (var i = 1; i < obj.points.length; i++) c.lineTo(obj.points[i][0], obj.points[i][1]);
        c.stroke();
      } else if (obj.type === 'eraser' && obj.points && obj.points.length) {
        c.globalCompositeOperation = 'destination-out';
        c.beginPath();
        c.moveTo(obj.points[0][0], obj.points[0][1]);
        for (var j = 1; j < obj.points.length; j++) c.lineTo(obj.points[j][0], obj.points[j][1]);
        c.lineWidth = (obj.size || 4) * 3;
        c.stroke();
        c.globalCompositeOperation = 'source-over';
      } else if (obj.type === 'line') {
        c.beginPath();
        c.moveTo(obj.x1, obj.y1);
        c.lineTo(obj.x2, obj.y2);
        c.stroke();
      } else if (obj.type === 'rect') {
        c.strokeRect(Math.min(obj.x1, obj.x2), Math.min(obj.y1, obj.y2), Math.abs(obj.x2 - obj.x1), Math.abs(obj.y2 - obj.y1));
      } else if (obj.type === 'circle') {
        var rx = Math.abs(obj.x2 - obj.x1) / 2, ry = Math.abs(obj.y2 - obj.y1) / 2;
        var cx = Math.min(obj.x1, obj.x2) + rx, cy = Math.min(obj.y1, obj.y2) + ry;
        c.beginPath();
        c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        c.stroke();
      } else if (obj.type === 'text') {
        c.font = (obj.size * 3 || 14) + 'px sans-serif';
        c.fillText(obj.text, obj.x, obj.y);
      }
      c.restore();
    }

    function canvasPos(e) {
      var r = canvas.getBoundingClientRect();
      return [
        (e.clientX - r.left) / r.width * W,
        (e.clientY - r.top) / r.height * H
      ];
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      var pos = canvasPos(e);
      state.drawing = true;
      state.startX = pos[0]; state.startY = pos[1];
      canvas.setPointerCapture(e.pointerId);

      if (state.tool === 'text') {
        var text = global.prompt('Enter text:');
        if (text) {
          state.objects.push({ type: 'text', text: text, x: pos[0], y: pos[1], color: state.color, size: state.size });
          state.undone = [];
          redraw();
        }
        state.drawing = false;
        return;
      }

      if (state.tool === 'pen' || state.tool === 'eraser') {
        state.currentPath = { type: state.tool, points: [pos], color: state.color, size: state.size };
      } else if (state.tool === 'line' || state.tool === 'rect' || state.tool === 'circle') {
        state.currentPath = { type: state.tool, x1: pos[0], y1: pos[1], x2: pos[0], y2: pos[1], color: state.color, size: state.size };
      }
    }

    function onPointerMove(e) {
      if (!state.drawing || !state.currentPath) return;
      var pos = canvasPos(e);
      if (state.currentPath.points) {
        state.currentPath.points.push(pos);
      } else {
        state.currentPath.x2 = pos[0];
        state.currentPath.y2 = pos[1];
      }
      redraw();
    }

    function onPointerUp() {
      if (!state.drawing) return;
      state.drawing = false;
      if (state.currentPath) {
        state.objects.push(state.currentPath);
        state.undone = [];
        state.currentPath = null;
      }
      redraw();
    }

    function onClick(e) {
      var el = e.target.closest('[data-md-tool]');
      if (el) {
        state.tool = el.getAttribute('data-md-tool');
        container.querySelectorAll('.md-btn[data-md-tool]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-md-tool') === state.tool); });
        return;
      }
      var sw = e.target.closest('[data-md-color]');
      if (sw) {
        state.color = sw.getAttribute('data-md-color');
        container.querySelectorAll('.md-swatch').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-md-color') === state.color); });
        return;
      }
      if (e.target.closest('[data-md-undo]')) {
        if (state.objects.length) { state.undone.push(state.objects.pop()); redraw(); }
        return;
      }
      if (e.target.closest('[data-md-redo]')) {
        if (state.undone.length) { state.objects.push(state.undone.pop()); redraw(); }
        return;
      }
      if (e.target.closest('[data-md-clear]')) {
        if (state.objects.length && global.confirm('Clear everything?')) {
          state.objects = []; state.undone = []; redraw();
        }
        return;
      }
      if (e.target.closest('[data-md-bg]')) {
        var inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.addEventListener('change', function () {
          var file = inp.files[0];
          if (!file) return;
          var img = new Image();
          img.onload = function () { state.bgImage = img; redraw(); };
          img.src = URL.createObjectURL(file);
        });
        inp.click();
        return;
      }
      if (e.target.closest('[data-md-save]')) {
        var title = container.querySelector('[data-md-title]').value.trim() || 'Drawn map';
        var dataUrl = canvas.toDataURL('image/png');
        if (opts.onSave) opts.onSave(dataUrl, title, { cols: state.gridCols, rows: state.gridRows });
        return;
      }
    }

    function onChange(e) {
      if (e.target.hasAttribute('data-md-grid')) {
        state.showGrid = e.target.checked; redraw();
      }
      if (e.target.hasAttribute('data-md-cols')) {
        state.gridCols = Math.max(4, Math.min(60, Number(e.target.value) || 20)); redraw();
      }
      if (e.target.hasAttribute('data-md-rows')) {
        state.gridRows = Math.max(4, Math.min(60, Number(e.target.value) || 20)); redraw();
      }
      if (e.target.hasAttribute('data-md-size')) {
        state.size = Number(e.target.value) || 4;
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    container.addEventListener('click', onClick);
    container.addEventListener('change', onChange);
    container.addEventListener('input', onChange);

    redraw();

    return {
      destroy: function () {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        container.removeEventListener('click', onClick);
        container.removeEventListener('change', onChange);
        container.removeEventListener('input', onChange);
      },
      getDataUrl: function () { return canvas.toDataURL('image/png'); },
      getGrid: function () { return { cols: state.gridCols, rows: state.gridRows }; },
    };
  }

  global.FogMapDraw = { create: create };
})(window);
