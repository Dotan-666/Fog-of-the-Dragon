/**
 * Dice roller for the Combat section (and the initiative buttons).
 *
 * Rolls are fair: random numbers come from the browser's crypto generator, using rejection sampling so no number is
 * favoured. Nothing is sent anywhere: a roll is private to the person who made it (the table's physical dice stay the
 * table's). Notation: NdS+M, for example d20, 2d6+3, 4d8-1, d% (a percentile die).
 *
 * Animation: when Dashboard → Settings → “3D Animated Dice” is on (FogSettings.get().dice3d), each roll plays a short CSS
 * 3D tumble of the dice that lands on the real result. It is a stylised tumble, not a physics simulation, and it is skipped
 * when the setting is off or the visitor prefers reduced motion; the result is always written out as text as well.
 *
 * FogDice.parse(text) → { count, sides, modifier } | { error }
 * FogDice.rollSpec(spec, rng?) → { ok, spec, rolls, modifier, total, text }   (rng is injectable for tests: returns [0,1))
 * FogDice.roll(text, opts?) → Promise<result>                                   rolls, then animates when the setting is on
 * FogDice.animationOn() → boolean
 * FogDice.mountTray(el) → cleanup                                               the dice tray UI
 */
(function (global) {
  'use strict';

  var MAX_DICE = 20;
  var SIDES_MIN = 2;
  var SIDES_MAX = 1000;
  var QUICK = [4, 6, 8, 10, 12, 20, 100];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** Uniform integer in 1..sides using crypto, rejecting values that would bias the result. */
  function cryptoInt(sides) {
    var c = global.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (!c || !c.getRandomValues) return Math.floor(Math.random() * sides) + 1;
    var limit = Math.floor(4294967296 / sides) * sides;
    var buf = new Uint32Array(1);
    do { c.getRandomValues(buf); } while (buf[0] >= limit);
    return (buf[0] % sides) + 1;
  }

  function parse(text) {
    var m = /^\s*(\d{0,2})\s*d\s*(\d{1,4}|%)\s*(?:([+-])\s*(\d{1,3}))?\s*$/i.exec(String(text || ''));
    if (!m) return { error: 'Write a roll like d20, 2d6+3 or d% (up to ' + MAX_DICE + ' dice).' };
    var count = m[1] === '' ? 1 : Number(m[1]);
    var sides = m[2] === '%' ? 100 : Number(m[2]);
    if (count < 1 || count > MAX_DICE) return { error: 'Roll between 1 and ' + MAX_DICE + ' dice at a time.' };
    if (sides < SIDES_MIN || sides > SIDES_MAX) return { error: 'A die needs between ' + SIDES_MIN + ' and ' + SIDES_MAX + ' sides.' };
    var mod = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
    return { count: count, sides: sides, modifier: mod };
  }

  function label(spec) { return spec.count + 'd' + spec.sides + (spec.modifier ? (spec.modifier > 0 ? '+' : '−') + Math.abs(spec.modifier) : ''); }

  function rollSpec(spec, rng) {
    var rolls = [];
    for (var i = 0; i < spec.count; i++) {
      rolls.push(rng ? Math.floor(rng() * spec.sides) + 1 : cryptoInt(spec.sides));
    }
    var sum = rolls.reduce(function (a, b) { return a + b; }, 0);
    var total = sum + spec.modifier;
    return {
      ok: true, spec: spec, rolls: rolls, modifier: spec.modifier, total: total,
      text: label(spec) + ': ' + (rolls.length > 1 ? '[' + rolls.join(' + ') + ']' : rolls[0]) + (spec.modifier ? (spec.modifier > 0 ? ' + ' : ' − ') + Math.abs(spec.modifier) : '') + ' = ' + total,
    };
  }

  function animationOn() {
    try {
      var s = global.FogSettings && global.FogSettings.get();
      var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return !!(s && s.dice3d) && !reduced;
    } catch (e) { return false; }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The tumble
  // ---------------------------------------------------------------------------------------------------------------
  var SHAPE = { 4: 'tri', 6: 'sq', 8: 'dia', 10: 'kite', 12: 'pent', 20: 'hex', 100: 'circ' };

  function animate(result, opts) {
    return new Promise(function (resolve) {
      var stage = document.createElement('div');
      stage.className = 'cw-dice-stage';
      stage.setAttribute('aria-hidden', 'true');
      var sides = result.spec.sides;
      var shown = result.rolls.slice(0, 8);
      stage.innerHTML = shown.map(function (v, i) {
        return '<div class="cw-die cw-die-' + (SHAPE[sides] || 'sq') + '" style="--i:' + i + '"><div class="cw-die-body"><span class="cw-die-face">' + (opts && opts.hideFaces ? '' : '?') + '</span></div></div>';
      }).join('') + '<div class="cw-dice-total" hidden></div>';
      document.body.appendChild(stage);
      var faces = [].slice.call(stage.querySelectorAll('.cw-die-face'));
      var spin = setInterval(function () { faces.forEach(function (f) { f.textContent = cryptoInt(sides); }); }, 70);
      var settle = 1150 + shown.length * 90;
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        clearInterval(spin);
        stage.remove();
        resolve();
      }
      setTimeout(function () {
        clearInterval(spin);
        faces.forEach(function (f, i) { f.textContent = shown[i]; });
        var t = stage.querySelector('.cw-dice-total');
        t.hidden = false;
        t.textContent = (opts && opts.label ? opts.label + ': ' : '') + result.total;
        stage.classList.add('is-settled');
        resolve(); // the result is known as soon as the dice land; the overlay lingers a moment more
        setTimeout(finish, 1100);
      }, settle);
      stage.addEventListener('click', finish);
    });
  }

  /** Rolls and (when the setting is on) shows the tumble; resolves with the result once the dice have landed. */
  async function roll(text, opts) {
    var spec = typeof text === 'string' ? parse(text) : text;
    if (spec.error) return { ok: false, message: spec.error };
    var result = rollSpec(spec);
    if (animationOn() && !(opts && opts.instant)) await animate(result, opts);
    return result;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The tray
  // ---------------------------------------------------------------------------------------------------------------
  function mountTray(el) {
    var history = [];
    var busy = false;
    el.innerHTML = '<div class="cw-dice-tray"><div class="cw-dice-quick" role="group" aria-label="Roll one die">' +
      QUICK.map(function (s) { return '<button type="button" class="cw-die-btn" data-dice="d' + s + '" aria-label="Roll a d' + s + '">d' + s + '</button>'; }).join('') + '</div>' +
      '<form class="cw-dice-form" novalidate><label class="cw-visually-hidden" for="cw-dice-expr">Dice to roll</label>' +
      '<input id="cw-dice-expr" class="form-control" name="expr" value="d20" maxlength="14" autocomplete="off" spellcheck="false" placeholder="2d6+3">' +
      '<button type="submit" class="btn btn-primary btn-sm">Roll</button></form>' +
      '<p class="cw-dice-result" id="cw-dice-result" role="status" aria-live="polite"><span class="cw-muted">Only you see your rolls.</span></p>' +
      '<ol class="cw-dice-history" id="cw-dice-history" aria-label="Recent rolls"></ol>' +
      '<p class="cw-muted cw-fine" id="cw-dice-note"></p></div>';
    var out = el.querySelector('#cw-dice-result');
    var hist = el.querySelector('#cw-dice-history');
    var note = el.querySelector('#cw-dice-note');
    function drawNote() { note.textContent = animationOn() ? 'Animated dice are on (Dashboard → Settings → 3D Animated Dice).' : 'Animated dice are off, so rolls show as text (turn them on in Dashboard → Settings).'; }
    drawNote();
    async function run(text) {
      if (busy) return;
      busy = true;
      out.innerHTML = '<span class="cw-muted">Rolling…</span>';
      var r = await roll(text);
      busy = false;
      if (!r.ok) { out.innerHTML = '<span class="cw-dice-error">' + esc(r.message) + '</span>'; return; }
      out.innerHTML = '<strong class="cw-dice-big">' + r.total + '</strong> <span class="cw-muted">' + esc(r.text) + '</span>' + (r.spec.sides === 20 && r.spec.count === 1 ? (r.rolls[0] === 20 ? ' <span class="cw-pill cw-pill-done">Natural 20</span>' : r.rolls[0] === 1 ? ' <span class="cw-pill cw-pill-cancelled">Natural 1</span>' : '') : '');
      history.unshift(r.text);
      history = history.slice(0, 8);
      hist.innerHTML = history.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('');
    }
    function onClick(e) {
      var b = e.target.closest('[data-dice]');
      if (!b) return;
      var form = el.querySelector('.cw-dice-form');
      // a quick die keeps the typed count and modifier ("2d6+3" then the d8 button gives 2d8+3)
      var cur = parse(form.expr.value);
      var spec = cur.error ? { count: 1, modifier: 0 } : cur;
      var text = (spec.count > 1 ? spec.count : '') + b.getAttribute('data-dice') + (spec.modifier ? (spec.modifier > 0 ? '+' : '-') + Math.abs(spec.modifier) : '');
      form.expr.value = text;
      run(text);
    }
    function onSubmit(e) {
      if (!e.target.classList.contains('cw-dice-form')) return;
      e.preventDefault();
      run(e.target.expr.value);
    }
    el.addEventListener('click', onClick);
    el.addEventListener('submit', onSubmit);
    var onSettings = function () { drawNote(); };
    global.addEventListener('fog:settings', onSettings);
    return function cleanup() { el.removeEventListener('click', onClick); el.removeEventListener('submit', onSubmit); global.removeEventListener('fog:settings', onSettings); };
  }

  global.FogDice = { parse: parse, rollSpec: rollSpec, roll: roll, animationOn: animationOn, mountTray: mountTray, cryptoInt: cryptoInt };
})(typeof window !== 'undefined' ? window : globalThis);
