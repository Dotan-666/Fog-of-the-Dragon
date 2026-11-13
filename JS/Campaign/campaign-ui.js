/**
 * Small shared UI helpers for the Campaign workspace: dialogs (native <dialog>), confirmation, notices, time text.
 *
 * FogCampaignUI.confirm({ title, message, confirmLabel, danger, requireText }) → Promise<boolean>
 *     requireText: the person must type this text first (used before deleting a whole campaign)
 * FogCampaignUI.dialog(html, { label, onClose }) → { el, close() }   the caller binds events inside el
 * FogCampaignUI.notice(text, kind)                                    brief message (kind: 'ok' | 'error'), announced to screen readers
 * FogCampaignUI.reasonDialog({ title, message, extraHtml, confirmLabel }) → Promise<{ reason, form } | null>
 *     the DM's correction of something locked: a written reason (10+ characters) and an explicit acknowledgement that it is recorded
 * FogCampaignUI.countdown(iso) → "in 2 days, 3 hours" | "starting now" | "started 20 minutes ago"
 * FogCampaignUI.toLocalInput(iso) / fromLocalInput(value)             datetime-local <input> ⇄ ISO string
 */
(function (global) {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var live = null;
  function liveRegion() {
    if (!live) {
      live = document.createElement('div');
      live.className = 'cw-notices';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    return live;
  }

  function notice(text, kind) {
    var el = document.createElement('div');
    el.className = 'cw-notice' + (kind === 'error' ? ' is-error' : '');
    if (kind === 'error') el.setAttribute('role', 'alert');
    el.textContent = text;
    liveRegion().appendChild(el);
    setTimeout(function () { el.remove(); }, kind === 'error' ? 8000 : 4500);
  }

  function dialog(html, opts) {
    opts = opts || {};
    var el = document.createElement('dialog');
    el.className = 'cw-dialog';
    if (opts.label) el.setAttribute('aria-label', opts.label);
    el.innerHTML = html;
    document.body.appendChild(el);
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      try { el.close(); } catch (e) { /* already closed */ }
      el.remove();
      if (opts.onClose) opts.onClose();
    }
    el.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    el.addEventListener('click', function (e) { if (e.target === el) close(); }); // click on the backdrop
    el.addEventListener('click', function (e) { if (e.target.closest('[data-dialog-close]')) close(); });
    if (typeof el.showModal === 'function') el.showModal(); else el.setAttribute('open', '');
    return { el: el, close: close };
  }

  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var typed = o.requireText ? '<label class="cw-field"><span>Type <strong>' + esc(o.requireText) + '</strong> to confirm</span><input type="text" class="form-control" data-confirm-text autocomplete="off"></label>' : '';
      var d = dialog('<form method="dialog" class="cw-dialog-body" novalidate>' +
        '<h2 class="cw-dialog-title">' + esc(o.title || 'Are you sure?') + '</h2>' +
        '<p>' + esc(o.message || '') + '</p>' + typed +
        '<div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Cancel</button>' +
        '<button type="submit" class="btn btn-sm ' + (o.danger ? 'cw-btn-danger' : 'btn-primary') + '" data-confirm-ok' + (o.requireText ? ' disabled' : '') + '>' + esc(o.confirmLabel || 'Confirm') + '</button></div></form>', {
        label: o.title,
        onClose: function () { resolve(answer); },
      });
      var answer = false;
      var input = d.el.querySelector('[data-confirm-text]');
      var ok = d.el.querySelector('[data-confirm-ok]');
      if (input) input.addEventListener('input', function () { ok.disabled = input.value.trim() !== o.requireText; });
      d.el.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        if (input && input.value.trim() !== o.requireText) return;
        answer = true;
        d.close();
      });
      (input || ok).focus();
    });
  }

  function reasonDialog(o) {
    return new Promise(function (resolve) {
      var answer = null;
      var d = dialog('<form class="cw-dialog-body" novalidate><h2 class="cw-dialog-title">' + esc(o.title) + '</h2><p>' + esc(o.message || '') + '</p>' + (o.extraHtml || '') +
        '<label class="cw-field"><span>Why is this needed? (saved in the campaign history, visible to every member)</span><textarea class="form-control" name="reason" rows="3" maxlength="300" required></textarea></label>' +
        '<label class="cw-check"><input type="checkbox" name="ack"> I understand this changes something that was locked when the campaign started, and that it is recorded.</label>' +
        '<p class="cw-form-error" role="alert" hidden></p><div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Cancel</button>' +
        '<button type="submit" class="btn cw-btn-danger btn-sm" disabled>' + esc(o.confirmLabel || 'Apply correction') + '</button></div></form>', { label: o.title, onClose: function () { resolve(answer); } });
      var f = d.el.querySelector('form');
      var ok = f.querySelector('[type=submit]');
      function check() { ok.disabled = !(f.reason.value.trim().length >= 10 && f.ack.checked); }
      f.addEventListener('input', check);
      f.addEventListener('change', check);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (ok.disabled) return;
        answer = { reason: f.reason.value.trim(), form: f };
        d.close();
      });
      f.querySelector('[name=reason]').focus();
    });
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function countdown(iso, now) {
    var diff = new Date(iso).getTime() - (now || Date.now());
    var abs = Math.abs(diff);
    var min = Math.round(abs / 60000);
    var text;
    if (min < 1) return 'starting now';
    if (min < 60) text = plural(min, 'minute');
    else if (min < 60 * 24) {
      var h = Math.floor(min / 60);
      var m = min % 60;
      text = plural(h, 'hour') + (m ? ', ' + plural(m, 'minute') : '');
    } else {
      var days = Math.floor(min / 1440);
      var hours = Math.floor((min % 1440) / 60);
      text = plural(days, 'day') + (hours && days < 7 ? ', ' + plural(hours, 'hour') : '');
    }
    return diff > 0 ? 'in ' + text : 'started ' + text + ' ago';
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fromLocalInput(value) {
    if (!value) return null;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  global.FogCampaignUI = { confirm: confirmDialog, reasonDialog: reasonDialog, dialog: dialog, notice: notice, countdown: countdown, toLocalInput: toLocalInput, fromLocalInput: fromLocalInput, esc: esc };
})(window);
