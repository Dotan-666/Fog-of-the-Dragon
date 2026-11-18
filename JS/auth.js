/**
 * Fog of the Dragon — Log in, Create account, Forgot password and Choose a new password pages (Pages/Auth/)
 * Authentication is done by Supabase Auth through FogAccount (JS/fog-account.js).
 */
(function (global) {
  'use strict';

  // After signing in, return to the dashboard page the visitor asked for (?next=#characters), if valid.
  var params = new URLSearchParams(global.location.search);
  var next = params.get('next') || '';
  // A campaign workspace link looks like #campaign/<campaign id>/<section> and returns to Pages/campaign.html.
  var campaignNext = /^#campaign\/([0-9a-f-]{36})(?:\/([a-z-]+))?$/i.exec(next);
  var DASHBOARD = campaignNext
    ? '../campaign.html?c=' + campaignNext[1] + '#' + (campaignNext[2] || 'overview')
    : '../dashboard.html' + (/^#[a-z0-9\-/_]+$/i.test(next) ? next : '#campaigns');
  var esc = function (s) { return global.FogAccount.escapeHtml(s); };

  /** Error details Supabase puts in the URL when an email link is invalid or expired. */
  function urlError() {
    var hash = new URLSearchParams(global.location.hash.replace(/^#/, ''));
    var desc = hash.get('error_description') || params.get('error_description');
    var code = hash.get('error_code') || params.get('error_code');
    if (!desc && !code) return null;
    return { code: code, message: (desc || '').replace(/\+/g, ' ') };
  }

  /** Shows a message box at the top of the active card section (one per card, replaced each time). */
  function notice(card, html, kind) {
    var box = card.querySelector('.auth-notice');
    if (!box) {
      box = document.createElement('div');
      box.className = 'auth-notice';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      var header = card.querySelector('.auth-state:not(.hidden) .auth-header') || card.querySelector('.auth-header');
      header.parentNode.insertBefore(box, header.nextSibling);
    }
    box.className = 'auth-notice' + (kind ? ' auth-notice-' + kind : '');
    box.innerHTML = html;
    box.hidden = false;
    return box;
  }

  function clearNotice(card) {
    var box = card.querySelector('.auth-notice');
    if (box) box.hidden = true;
  }

  /** Disables a submit button while a request runs and shows a working label. */
  function busy(button, working) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = !!working;
    button.textContent = working || button.dataset.label;
    button.setAttribute('aria-busy', working ? 'true' : 'false');
  }

  /** Adds a "Resend confirmation email" action to a notice. */
  function addResend(box, getEmail) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'auth-notice-action';
    btn.textContent = 'Resend confirmation email';
    btn.addEventListener('click', async function () {
      var email = getEmail();
      if (!email) {
        btn.textContent = 'Enter your email above first';
        return;
      }
      busy(btn, 'Sending…');
      var res = await global.FogAccount.resendConfirmation(email);
      busy(btn, null);
      btn.textContent = res.ok ? 'Sent. Check your inbox (and spam folder).' : res.message;
      btn.disabled = res.ok;
    });
    box.appendChild(document.createElement('br'));
    box.appendChild(btn);
  }

  /**
   * "Continue with Google": Supabase sends the browser to Google and back to login.html, which opens the dashboard.
   * On the Create Account page the Terms must be accepted first (same as for an email sign-up).
   */
  function bindGoogle(card, form) {
    card.querySelectorAll('.auth-social').forEach(function (btn) {
      if (!/Google/.test(btn.textContent)) return;
      btn.addEventListener('click', async function () {
        clearNotice(card);
        var terms = form && form.querySelector('[name="accept_terms"]');
        if (terms && !terms.checked) {
          notice(card, 'Please accept the Terms of Service and Privacy Policy first, then continue with Google.', 'error');
          terms.focus();
          return;
        }
        var remember = form && form.querySelector('[name="remember_me"]');
        busy(btn, 'Opening Google…');
        var res = await global.FogAccount.signInWithGoogle(next, remember ? remember.checked : true);
        if (!res.ok) {
          busy(btn, null);
          notice(card, esc(res.message), res.disabled ? 'info' : 'error');
        }
        // On success the browser is already on its way to Google.
      });
    });
  }

  /** Coming back from Google with an error in the URL (cancelled, or the provider refused). */
  function googleReturnError(card) {
    var pending = global.FogAccount.takeOAuthPending && global.FogAccount.takeOAuthPending();
    var err = urlError();
    if (!pending || !err) return false;
    var cancelled = /access_denied|cancel/i.test((err.code || '') + ' ' + err.message + ' ' + (params.get('error') || ''));
    notice(card, cancelled
      ? 'Google sign-in was cancelled. You can try again, or use your email address.'
      : 'Google sign-in didn\'t work' + (err.message ? ' (' + esc(err.message) + ')' : '') + '. Try again, or use your email address.', cancelled ? 'info' : 'error');
    return true;
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  // ---------------------------------------------------------------------------
  // Log in
  // ---------------------------------------------------------------------------
  function initLogin(form, card) {
    bindGoogle(card, form);
    var forgot = card.querySelector('.auth-forgot');
    if (forgot) forgot.setAttribute('href', 'forgot-password.html');
    var email = form.querySelector('#login-email');
    var password = form.querySelector('#login-password');
    var submit = form.querySelector('.auth-submit');

    var linkErr = urlError();
    if (googleReturnError(card)) {
      // explained above
    } else if (linkErr) {
      var box = notice(card, 'That confirmation link is invalid or has expired' + (linkErr.message ? ' (' + esc(linkErr.message) + ')' : '') + '. Enter your email and request a new one.', 'error');
      addResend(box, function () { return email.value.trim(); });
    } else if (params.get('reason') === 'expired') {
      notice(card, 'Your session ended. Please log in again.', 'info');
    } else if (params.get('reason') === 'signed-out') {
      notice(card, 'You\'ve been logged out.', 'info');
    } else if (params.get('reason') === 'deleted') {
      notice(card, 'Your account was deleted.', 'info');
    } else if (params.get('reset') === 'done') {
      notice(card, 'Password updated. Log in with your new password.', 'success');
    }

    form.setAttribute('novalidate', '');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearNotice(card);
      if (!validEmail(email.value.trim())) {
        notice(card, 'Enter a valid email address.', 'error');
        email.focus();
        return;
      }
      if (!password.value) {
        notice(card, 'Enter your password.', 'error');
        password.focus();
        return;
      }
      busy(submit, 'Logging in…');
      var res = await global.FogAccount.signIn(email.value, password.value, form.querySelector('[name="remember_me"]').checked);
      if (!res.ok) {
        busy(submit, null);
        var box = notice(card, esc(res.message), 'error');
        if (res.unconfirmed) addResend(box, function () { return email.value.trim(); });
        return;
      }
      global.location.replace(DASHBOARD);
    });
  }

  // ---------------------------------------------------------------------------
  // Create account
  // ---------------------------------------------------------------------------
  function initRegister(form, card) {
    bindGoogle(card, form);
    var plan = params.get('plan');
    var plans = global.FogAccount.PLANS;
    if (plan && plans[plan] && plan !== 'free' && plan !== 'warlord') {
      notice(card, 'You picked the <strong>' + esc(plans[plan].name) + '</strong> plan. Paid plans can\'t be purchased yet, so your account will start on the Free plan.', 'info');
    } else if (plan === 'one-shot') {
      notice(card, 'One-Shot passes can\'t be purchased yet. Create a free account now; the pass will be available from your campaign once payments are set up.', 'info');
    }
    var links = card.querySelectorAll('.auth-inline-link');
    if (links[0]) links[0].setAttribute('href', '../Terms&Privacy/terms.html');
    if (links[1]) links[1].setAttribute('href', '../Terms&Privacy/privacy.html');
    links.forEach(function (a) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); });

    var username = form.querySelector('#register-username');
    var email = form.querySelector('#register-email');
    var pw = form.querySelector('#register-password');
    var confirm = form.querySelector('#register-confirm-password');
    var terms = form.querySelector('[name="accept_terms"]');
    var submit = form.querySelector('.auth-submit');
    form.setAttribute('novalidate', '');
    pw.setAttribute('minlength', '8');
    pw.setAttribute('placeholder', 'At least 8 characters');

    function problem() {
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username.value.trim())) return [username, 'Usernames are 3–24 letters, numbers or underscores.'];
      if (!validEmail(email.value.trim())) return [email, 'Enter a valid email address.'];
      if (pw.value.length < 8) return [pw, 'Use a password of at least 8 characters.'];
      if (pw.value !== confirm.value) return [confirm, 'The passwords don\'t match.'];
      if (!terms.checked) return [terms, 'Please accept the Terms of Service and Privacy Policy.'];
      return null;
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearNotice(card);
      var p = problem();
      if (p) {
        notice(card, esc(p[1]), 'error');
        p[0].focus();
        return;
      }
      busy(submit, 'Creating account…');
      var res = await global.FogAccount.register({ username: username.value.trim(), email: email.value.trim(), password: pw.value });
      busy(submit, null);
      if (!res.ok) {
        notice(card, esc(res.message), 'error');
        return;
      }
      if (res.signedIn) {
        global.location.replace(DASHBOARD);
        return;
      }
      // Email confirmation required: replace the form with instructions.
      var sentTo = email.value.trim();
      form.hidden = true;
      card.querySelectorAll('.auth-divider, .auth-social').forEach(function (el) { el.hidden = true; });
      card.querySelector('.auth-title').textContent = 'Check your email';
      card.querySelector('.auth-subtitle').textContent = 'One more step to begin your journey.';
      var box = notice(card, 'We sent a confirmation link to <strong>' + esc(sentTo) + '</strong>. Open it to activate your account, then log in.', 'success');
      addResend(box, function () { return sentTo; });
    });
  }

  // ---------------------------------------------------------------------------
  // Forgot password
  // ---------------------------------------------------------------------------
  function initForgot(form, card) {
    var request = card.querySelector('#reset-request-state');
    var success = card.querySelector('#reset-success-state');
    var email = form.querySelector('#reset-email');
    var submit = form.querySelector('.auth-submit');
    form.setAttribute('novalidate', '');
    var sentTo = '';

    async function send() {
      return global.FogAccount.requestPasswordReset(sentTo);
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearNotice(card);
      if (!validEmail(email.value.trim())) {
        notice(card, 'Enter a valid email address.', 'error');
        return;
      }
      sentTo = email.value.trim();
      busy(submit, 'Sending…');
      var res = await send();
      busy(submit, null);
      if (!res.ok) {
        notice(card, esc(res.message), 'error');
        return;
      }
      request.classList.add('hidden');
      success.classList.remove('hidden');
      success.querySelector('.auth-subtitle').innerHTML =
        'If an account exists for <strong>' + esc(sentTo) + '</strong>, a link to choose a new password is on its way. It expires after a while, so use it soon.';
    });

    var resend = success.querySelector('.auth-social');
    if (resend) {
      resend.addEventListener('click', async function () {
        busy(resend, 'Sending…');
        var res = await send();
        busy(resend, null);
        resend.textContent = res.ok ? 'Sent again' : res.message;
        resend.disabled = res.ok;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Choose a new password (landing page of the reset email)
  // ---------------------------------------------------------------------------
  function initResetPassword(card, auth) {
    var checking = card.querySelector('#reset-checking-state');
    var formState = card.querySelector('#new-password-state');
    var problem = card.querySelector('#reset-link-problem-state');
    var linkErr = urlError();
    checking.classList.add('hidden');
    if (linkErr || !auth.session) {
      problem.classList.remove('hidden');
      if (linkErr && linkErr.message) {
        card.querySelector('#reset-link-problem-text').textContent = 'This password reset link is invalid or has expired (' + linkErr.message + '). Request a new one.';
      }
      return;
    }
    formState.classList.remove('hidden');
    var form = formState.querySelector('form');
    var pw = form.querySelector('#new-password');
    var confirm = form.querySelector('#new-password-confirm');
    var submit = form.querySelector('.auth-submit');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearNotice(card);
      if (pw.value.length < 8) {
        notice(card, 'Use a password of at least 8 characters.', 'error');
        return;
      }
      if (pw.value !== confirm.value) {
        notice(card, 'The passwords don\'t match.', 'error');
        return;
      }
      busy(submit, 'Saving…');
      var res = await global.FogAccount.updatePassword(pw.value);
      if (!res.ok) {
        busy(submit, null);
        notice(card, esc(res.message), 'error');
        return;
      }
      if (global.FogNotifications) global.FogNotifications.add({ kind: 'account', title: 'Password changed' });
      busy(submit, 'Password saved');
      notice(card, 'Your password was updated. Taking you to your dashboard…', 'success');
      setTimeout(function () { global.location.replace('../dashboard.html#campaigns'); }, 1200);
    });
  }

  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async function () {
    var card = document.querySelector('.auth-card');
    if (!card) return;
    var login = document.querySelector('#login-email');
    var register = document.querySelector('#register-email');
    var forgot = document.querySelector('#reset-email');
    var reset = document.querySelector('#new-password-state');

    // Don't let the forms submit natively before the session check finishes.
    document.querySelectorAll('.auth-card form').forEach(function (f) {
      f.addEventListener('submit', function (e) { if (!f.dataset.ready) e.preventDefault(); });
    });

    var auth = await global.FogAccount.ready();
    if (auth.error && !global.FogSupabase.isConfigured) {
      notice(card, esc(auth.error), 'error');
      document.querySelectorAll('.auth-card form button, .auth-card form input').forEach(function (el) { el.disabled = true; });
      return;
    }

    if (reset) {
      initResetPassword(card, auth);
    } else if (auth.session && (login || register)) {
      // Already signed in (including arriving from an email confirmation link): go to the dashboard.
      global.location.replace(DASHBOARD);
      return;
    } else if (login) {
      initLogin(login.form, card);
    } else if (register) {
      initRegister(register.form, card);
    } else if (forgot) {
      initForgot(forgot.form, card);
    }
    document.querySelectorAll('.auth-card form').forEach(function (f) { f.dataset.ready = '1'; });
  });
})(window);
