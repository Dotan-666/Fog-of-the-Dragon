/**
 * Shopping cart (browser), shared by the Dashboard and the Campaign page so it survives navigation and reloads.
 *
 * Items: { type: 'store' | 'listing' | 'plan' | 'campaign_book', ref, title, unitCents, quantity, art?, photo? (store photo path), cover?, options? }
 * Prices here are only for display: the server prices every order again (public.create_order) and ignores these.
 * Kept per signed-in user in localStorage. "Buy now" keeps a one-item checkout apart from the cart (sessionStorage).
 *
 * FogCart.items() / add(item) / remove(key) / setQuantity(key, n) / clear(keys?) / count() / subtotal() / has(key)
 * FogCart.buyNow(item) / takeBuyNow() / peekBuyNow() / clearBuyNow();  key = type + ':' + ref
 * Fires 'fog:cart' on window after every change.
 */
(function (global) {
  'use strict';

  var MAX_QTY = 10;
  var MAX_ITEMS = 30;
  function uid() { var a = global.FogAccount && global.FogAccount.getAccount && global.FogAccount.getAccount(); return a ? a.id : 'guest'; }
  function storeKey() { return 'fog_cart_v1_' + uid(); }
  function keyOf(it) { return it.type + ':' + it.ref; }
  function digital(it) { return it.type !== 'store'; }

  function clean(it) {
    if (!it || ['store', 'listing', 'plan', 'campaign_book'].indexOf(it.type) < 0 || !it.ref) return null;
    var q = digital(it) ? 1 : Math.max(1, Math.min(MAX_QTY, Math.round(Number(it.quantity) || 1)));
    return {
      type: it.type, ref: String(it.ref).slice(0, 80), title: String(it.title || '').slice(0, 140), unitCents: Math.max(0, Math.round(Number(it.unitCents) || 0)),
      quantity: q, art: it.art ? String(it.art).slice(0, 60) : null, photo: /^Assets\/Pictures\/store\/[a-z0-9-]+\.(jpg|png|webp)$/.test(it.photo || '') ? it.photo : null, cover: it.cover ? String(it.cover).slice(0, 400) : null,
      options: it.options && typeof it.options === 'object' ? JSON.parse(JSON.stringify(it.options)) : {},
      kindLabel: it.kindLabel ? String(it.kindLabel).slice(0, 40) : '',
    };
  }
  function read() {
    try { var v = JSON.parse(global.localStorage.getItem(storeKey()) || '[]'); return Array.isArray(v) ? v.map(clean).filter(Boolean) : []; } catch (e) { return []; }
  }
  function write(list) {
    try { global.localStorage.setItem(storeKey(), JSON.stringify(list)); } catch (e) { /* storage full or blocked: the cart lasts for this page only */ }
    try { global.dispatchEvent(new CustomEvent('fog:cart')); } catch (e) { /* old browsers */ }
  }

  function add(item) {
    var it = clean(item);
    if (!it) return { ok: false, message: 'This item can’t be added to the cart.' };
    var list = read();
    var cur = list.filter(function (x) { return keyOf(x) === keyOf(it); })[0];
    if (cur) {
      if (digital(it)) return { ok: true, already: true };
      cur.quantity = Math.min(MAX_QTY, cur.quantity + it.quantity);
      cur.options = it.options;
    } else {
      if (list.length >= MAX_ITEMS) return { ok: false, message: 'The cart is full (30 items).' };
      list.push(it);
    }
    write(list);
    return { ok: true };
  }
  function remove(key) { write(read().filter(function (x) { return keyOf(x) !== key; })); }
  function setQuantity(key, n) {
    var list = read();
    list.forEach(function (x) { if (keyOf(x) === key && !digital(x)) x.quantity = Math.max(1, Math.min(MAX_QTY, Math.round(Number(n) || 1))); });
    write(list);
  }
  function clear(keys) { write(keys ? read().filter(function (x) { return keys.indexOf(keyOf(x)) < 0; }) : []); }
  function count() { return read().reduce(function (n, x) { return n + x.quantity; }, 0); }
  function subtotal(list) { return (list || read()).reduce(function (n, x) { return n + x.unitCents * x.quantity; }, 0); }

  function buyNow(item) {
    var it = clean(item);
    if (!it) return { ok: false, message: 'This item can’t be bought.' };
    try { global.sessionStorage.setItem('fog_buy_now', JSON.stringify([it])); } catch (e) { return { ok: false, message: 'Your browser blocked storage.' }; }
    return { ok: true };
  }
  function peekBuyNow() { try { var v = JSON.parse(global.sessionStorage.getItem('fog_buy_now') || 'null'); return Array.isArray(v) ? v.map(clean).filter(Boolean) : null; } catch (e) { return null; } }
  function clearBuyNow() { try { global.sessionStorage.removeItem('fog_buy_now'); } catch (e) { /* ignore */ } }

  function money(cents) {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100); } catch (e) { return '$' + ((cents || 0) / 100).toFixed(2); }
  }

  /** The header's cart badge (any page that has #cartCount). */
  function drawBadge() {
    var el = document.getElementById('cartCount');
    if (!el) return;
    var n = count();
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = n === 0;
    var link = document.getElementById('cartLink');
    if (link) link.setAttribute('aria-label', 'Cart' + (n ? ', ' + n + ' item' + (n === 1 ? '' : 's') : ', empty'));
  }
  if (typeof document !== 'undefined') {
    global.addEventListener('fog:cart', drawBadge);
    global.addEventListener('fog:account', drawBadge);
    global.addEventListener('storage', function (e) { if (e.key && e.key.indexOf('fog_cart_v1_') === 0) drawBadge(); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', drawBadge); else drawBadge();
  }

  global.FogCart = {
    items: read, add: add, remove: remove, setQuantity: setQuantity, clear: clear, count: count, subtotal: subtotal, has: function (k) { return read().some(function (x) { return keyOf(x) === k; }); },
    keyOf: keyOf, buyNow: buyNow, peekBuyNow: peekBuyNow, clearBuyNow: clearBuyNow, money: money, MAX_QTY: MAX_QTY,
  };
})(typeof window !== 'undefined' ? window : globalThis);
