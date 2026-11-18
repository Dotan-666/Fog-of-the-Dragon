/**
 * Product mockups for the official FOD store, drawn as SVG (original artwork, no image files, no official D&D art).
 * They are DEMO imagery: every picture carries a small "Demo mockup" label. FogStoreArt.svg(art, { large })
 *
 * art keys come from marketplace_store_products.art: 'd20', 'dice-set', 'chest', 'bag', 'tower', 'tray', 'screen', 'rings',
 * 'notebook', 'tee:TEXT', 'hoodie', 'cap', 'beanie', 'mug:TEXT', 'cup', 'poster', 'stickers', 'mat', 'spellbook'.
 */
(function (global) {
  'use strict';

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var RED = '#c8213a';
  var RED2 = '#7e1222';
  var GOLD = '#e0b25a';
  var INK = '#1b1214';

  // A small D20 face (used on many products).
  function d20(cx, cy, r, num, fill, stroke) {
    var pts = [];
    for (var i = 0; i < 6; i++) { var a = Math.PI / 6 + i * Math.PI / 3; pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
    var t = [cx + ',' + (cy - r * 0.62), (cx - r * 0.55).toFixed(1) + ',' + (cy + r * 0.34).toFixed(1), (cx + r * 0.55).toFixed(1) + ',' + (cy + r * 0.34).toFixed(1)];
    return '<g><polygon points="' + pts.join(' ') + '" fill="' + (fill || RED) + '" stroke="' + (stroke || RED2) + '" stroke-width="' + (r / 14).toFixed(1) + '"/>' +
      '<polygon points="' + t.join(' ') + '" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.35)" stroke-width="' + (r / 22).toFixed(1) + '"/>' +
      '<text x="' + cx + '" y="' + (cy + r * 0.17) + '" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="' + (r * 0.42).toFixed(1) + '" fill="#fff">' + esc(num) + '</text></g>';
  }
  function dragon(x, y, s, color) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="' + (color || RED) + '"><path d="M0 18c8-14 22-18 34-14 6-6 14-6 18 0-6 0-9 3-10 7 8 2 13 8 14 16-6-4-12-5-18-3 2 6 0 12-6 16 0-6-3-10-8-12-6 6-15 8-24 6 6-3 9-8 9-13-4 1-7 0-9-3z"/></g>';
  }
  function shirt(color, text) {
    return '<path d="M120 70l40-22h80l40 22 34 44-38 22-14-16v128H138V120l-14 16-38-22z" fill="' + color + '" stroke="rgba(0,0,0,.25)" stroke-width="2"/>' +
      '<path d="M170 48c8 14 52 14 60 0" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="3"/>' +
      d20(200, 140, 34, text === 'NAT 1 CLUB' ? '1' : '20') +
      '<text x="200" y="208" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="800" font-size="17" fill="#fff" letter-spacing="1">' + esc(text) + '</text>';
  }
  function mug(text) {
    return '<rect x="120" y="80" width="140" height="150" rx="12" fill="#f4efe8" stroke="rgba(0,0,0,.25)" stroke-width="2"/>' +
      '<path d="M260 112c40 0 40 76 0 76" fill="none" stroke="#f4efe8" stroke-width="16"/><path d="M260 112c40 0 40 76 0 76" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="2"/>' +
      '<ellipse cx="190" cy="82" rx="70" ry="9" fill="#5a3a22"/>' + dragon(150, 120, 1.6, RED) +
      '<text x="190" y="206" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="800" font-size="15" fill="' + INK + '">' + esc(text) + '</text>';
  }

  var DRAW = {
    d20: function () { return d20(200, 150, 92, '1') + '<text x="200" y="272" text-anchor="middle" font-size="15" font-style="italic" fill="#fff" opacity=".8">"It remembers."</text>'; },
    'dice-set': function () { return d20(130, 120, 52, '20', '#d9531e', '#7a2a0c') + d20(250, 110, 44, '12', '#e07b1a', '#7a3d0c') + d20(190, 205, 46, '8', '#c8213a') + d20(300, 205, 34, '6', '#b8401a'); },
    chest: function () { return '<rect x="110" y="130" width="180" height="100" rx="8" fill="#7a4a24" stroke="#3d2410" stroke-width="4"/><path d="M110 130c0-50 180-50 180 0z" fill="#8c5a2c" stroke="#3d2410" stroke-width="4"/>' +
      '<path d="M130 130l14 18 14-18 14 18 14-18 14 18 14-18 14 18 14-18 14 18 14-18" fill="#fff" stroke="#ccc"/><circle cx="170" cy="105" r="9" fill="#fff"/><circle cx="230" cy="105" r="9" fill="#fff"/><circle cx="172" cy="106" r="4" fill="' + INK + '"/><circle cx="232" cy="106" r="4" fill="' + INK + '"/><rect x="190" y="160" width="20" height="26" rx="3" fill="' + GOLD + '"/>'; },
    bag: function () { return '<path d="M140 110c-30 40-30 120 60 130 90-10 90-90 60-130z" fill="#5b1424" stroke="#2d0a12" stroke-width="3"/><path d="M140 110h120l-20-24h-80z" fill="#6e1a2c"/><path d="M150 100c30 14 70 14 100 0" fill="none" stroke="' + GOLD + '" stroke-width="5"/>' + dragon(165, 150, 1.7, GOLD); },
    tower: function () { return '<path d="M150 60h100v170H150z" fill="#b48a5a" stroke="#5e4224" stroke-width="4"/><path d="M150 60l10-20 10 20 10-20 10 20 10-20 10 20 10-20 10 20 10-20 10 20" fill="#b48a5a" stroke="#5e4224" stroke-width="3"/><rect x="180" y="190" width="40" height="40" rx="4" fill="#3d2a16"/><path d="M110 230h180v30H110z" fill="#8a6a42" stroke="#5e4224" stroke-width="4"/>' + d20(250, 245, 14, '20'); },
    tray: function () { return '<polygon points="200,70 320,130 320,210 200,270 80,210 80,130" fill="#2a1f22" stroke="#8a6a42" stroke-width="10"/>' + d20(170, 170, 32, '20') + d20(240, 190, 22, '7', '#4a69b0', '#22386a'); },
    screen: function () { return '<path d="M60 90l70-20v170l-70 20z M130 70l70 10v170l-70-10z M200 80l70-10v170l-70 10z M270 70l70 20v170l-70-20z" fill="#3a1820" stroke="#1b0b0f" stroke-width="3"/>' + dragon(150, 120, 2.3, RED) + '<text x="200" y="232" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="16" fill="' + GOLD + '">BEHIND THE FOG</text>'; },
    rings: function () { var c = ['#c8213a', '#3a9d63', '#4a69b0', '#e0b25a', '#8e44ad']; return c.map(function (col, i) { return '<circle cx="' + (110 + i * 45) + '" cy="' + (140 + (i % 2) * 40) + '" r="30" fill="none" stroke="' + col + '" stroke-width="10"/>'; }).join(''); },
    notebook: function () { return '<rect x="130" y="60" width="150" height="200" rx="6" fill="#2b1a1e" stroke="#120a0c" stroke-width="3"/><rect x="130" y="60" width="18" height="200" fill="#5b1424"/>' + d20(212, 140, 36, '20') + '<text x="212" y="214" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" fill="' + GOLD + '">SESSION LOG</text>'; },
    tee: function (text) { return shirt('#2a1d21', text || 'FOD'); },
    hoodie: function () { return '<path d="M120 80l40-30c10 20 70 20 80 0l40 30 34 60-36 16-14-20v124H136V136l-14 20-36-16z" fill="#3a1820" stroke="rgba(0,0,0,.3)" stroke-width="2"/><path d="M160 50c0 40 80 40 80 0" fill="#2a1016"/>' + dragon(165, 140, 2, RED) + '<rect x="160" y="230" width="80" height="26" rx="6" fill="rgba(0,0,0,.25)"/>'; },
    cap: function () { return '<path d="M110 180c0-80 180-80 180 0z" fill="#22171a" stroke="#000" stroke-width="2"/><path d="M110 180c40 10 100 14 200 0-20 30-140 34-200 0z" fill="#170f11"/>' + d20(200, 140, 30, '20'); },
    beanie: function () { return '<path d="M120 200c0-110 160-110 160 0z" fill="#5b1424"/><rect x="112" y="190" width="176" height="40" rx="10" fill="#7e1d30"/><circle cx="200" cy="82" r="18" fill="#7e1d30"/><text x="200" y="168" text-anchor="middle" font-size="34" fill="' + GOLD + '">z z z</text>'; },
    mug: function (text) { return mug(text || 'FOD'); },
    cup: function () { return '<path d="M150 70h100l-12 180h-76z" fill="#22171a" stroke="#000" stroke-width="2"/><rect x="146" y="58" width="108" height="20" rx="6" fill="#3a2a2e"/>' + d20(200, 160, 30, '20'); },
    poster: function () { return '<rect x="100" y="40" width="200" height="240" fill="#e9dcc0" stroke="#8a6a42" stroke-width="6"/><path d="M120 120c30-20 50 10 80-6s50 10 80-4M120 190c30-14 60 8 90-6s40 6 70-4" fill="none" stroke="#8a6a42" stroke-width="2" stroke-dasharray="4 4"/>' +
      ['DRAGON', 'DRAGON', 'MORE DRAGON', 'DRAGON?'].map(function (w, i) { return '<text x="' + (140 + (i % 2) * 70) + '" y="' + (100 + i * 45) + '" font-family="Cinzel, Georgia, serif" font-size="12" fill="' + RED2 + '">' + w + '</text>'; }).join('') + dragon(230, 230, 1.2, RED); },
    stickers: function () { return d20(130, 120, 40, '1') + '<circle cx="250" cy="110" r="42" fill="#3a9d63"/><text x="250" y="117" text-anchor="middle" font-size="18" font-weight="700" fill="#fff">OOPS</text><rect x="150" y="180" width="110" height="60" rx="14" fill="' + GOLD + '"/><text x="205" y="217" text-anchor="middle" font-size="15" font-weight="700" fill="' + INK + '">IT\'S FINE</text>'; },
    mat: function () { return '<rect x="40" y="100" width="320" height="120" rx="14" fill="#1e1416" stroke="#5b1424" stroke-width="4"/>' + [0, 1, 2, 3, 4].map(function (i) { return '<rect x="' + (60 + i * 60) + '" y="130" width="48" height="60" rx="6" fill="none" stroke="' + GOLD + '" stroke-width="2"/><text x="' + (84 + i * 60) + '" y="168" text-anchor="middle" font-size="16" fill="' + GOLD + '">' + (20 - i * 4) + '</text>'; }).join(''); },
    spellbook: function () { return '<rect x="120" y="60" width="160" height="200" rx="8" fill="#4a2a1a" stroke="#22120a" stroke-width="4"/><circle cx="200" cy="160" r="44" fill="none" stroke="' + GOLD + '" stroke-width="3"/><path d="M200 120l12 28 30 2-23 19 8 30-27-17-27 17 8-30-23-19 30-2z" fill="' + GOLD + '"/><rect x="270" y="140" width="16" height="40" rx="3" fill="' + GOLD + '"/>'; },
    book: function () { return '<rect x="130" y="50" width="140" height="200" rx="4" fill="#f4efe8" stroke="#8a6a42" stroke-width="3"/><rect x="126" y="54" width="8" height="192" rx="2" fill="#c8213a"/><text x="200" y="110" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="800" font-size="16" fill="' + INK + '">PLAYER\'S</text><text x="200" y="132" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="800" font-size="16" fill="' + INK + '">HANDBOOK</text>' + dragon(160, 150, 1.6, RED) + '<rect x="155" y="224" width="90" height="10" rx="2" fill="' + RED + '"/>'; },
    minis: function () { return '<circle cx="140" cy="200" r="14" fill="' + RED + '"/><rect x="134" y="140" width="12" height="60" rx="3" fill="' + RED + '"/><circle cx="140" cy="130" r="10" fill="' + RED + '"/><circle cx="200" cy="200" r="14" fill="' + GOLD + '"/><rect x="194" y="130" width="12" height="70" rx="3" fill="' + GOLD + '"/><circle cx="200" cy="120" r="10" fill="' + GOLD + '"/><path d="M200 140l8-14 4 10z" fill="' + GOLD + '"/><circle cx="260" cy="200" r="14" fill="#4a69b0"/><rect x="254" y="150" width="12" height="50" rx="3" fill="#4a69b0"/><circle cx="260" cy="140" r="10" fill="#4a69b0"/><rect x="256" y="150" width="20" height="4" rx="1" fill="#4a69b0"/><rect x="100" y="214" width="200" height="6" rx="3" fill="rgba(255,255,255,.15)"/>'; },
    template: function () { return '<path d="M200 80l80 140H120z" fill="none" stroke="' + RED + '" stroke-width="4" stroke-dasharray="8 4"/><circle cx="200" cy="170" r="60" fill="none" stroke="' + GOLD + '" stroke-width="3" stroke-dasharray="6 3"/><rect x="130" y="200" width="140" height="8" rx="2" fill="none" stroke="#4a69b0" stroke-width="3" stroke-dasharray="8 4"/><text x="200" y="260" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" fill="' + GOLD + '">AOE TEMPLATES</text>'; },
  };

  function svg(art, opts) {
    opts = opts || {};
    var key = String(art || '').split(':')[0];
    var text = String(art || '').split(':').slice(1).join(':');
    var body = DRAW[key] ? DRAW[key](text) : d20(200, 150, 80, '?');
    return '<svg class="mk-art" viewBox="0 0 400 300" role="img" aria-label="Demo product mockup" preserveAspectRatio="xMidYMid meet"' + (opts.large ? ' data-large="1"' : '') + '>' +
      '<defs><radialGradient id="mkbg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#3a2228"/><stop offset="1" stop-color="#120b0d"/></radialGradient></defs>' +
      '<rect width="400" height="300" fill="url(#mkbg)"/>' + body +
      '<g><rect x="8" y="8" width="104" height="20" rx="10" fill="rgba(0,0,0,.55)"/><text x="60" y="22" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#fff">Demo mockup</text></g></svg>';
  }

  global.FogStoreArt = { svg: svg, keys: Object.keys(DRAW) };
})(typeof window !== 'undefined' ? window : globalThis);
