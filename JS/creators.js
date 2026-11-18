/**
 * Creator Program application page (Pages/creators.html).
 * Submits applications to the `creator_applications` table via Supabase.
 */
(function () {
  'use strict';

  var form = document.getElementById('creator-form');
  if (!form) return;

  var err = form.querySelector('.cr-form-error');
  var status = form.querySelector('.cr-form-status');

  function showError(msg) {
    err.textContent = msg;
    err.hidden = false;
    status.hidden = true;
  }
  function showSuccess(msg) {
    status.textContent = msg;
    status.hidden = false;
    err.hidden = true;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.hidden = true;
    status.hidden = true;

    var fullName = form.full_name.value.trim();
    var email = form.email.value.trim();
    var portfolioUrl = form.portfolio_url.value.trim();
    var pitch = form.sample_pitch.value.trim();
    var agreed = form.agreed_to_terms.checked;

    var types = [];
    form.querySelectorAll('input[name="content_types"]:checked').forEach(function (cb) {
      types.push(cb.value);
    });

    if (!fullName) return showError('Please enter your name.');
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return showError('Please enter a valid email address.');
    if (types.length === 0) return showError('Select at least one content type.');
    if (!pitch) return showError('Tell us about your first listing.');
    if (!agreed) return showError('You must agree to the Terms of Service and Creator Guidelines.');

    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    try {
      var sb = window.FogSupabase && window.FogSupabase.client();
      if (!sb) throw new Error('Could not connect to the server. Please try again later.');

      var session = (await sb.auth.getSession()).data.session;
      var userId = session ? session.user.id : null;

      var row = {
        full_name: fullName,
        email: email,
        portfolio_url: portfolioUrl || null,
        content_types: types,
        sample_pitch: pitch,
        agreed_to_terms: true,
        status: 'pending',
      };
      if (userId) row.user_id = userId;

      var res = await sb.from('creator_applications').insert(row);
      if (res.error) throw new Error(res.error.message || 'Submission failed.');

      form.reset();
      form.hidden = true;
      showSuccess('Application submitted! We\'ll review it within 5 business days and email you at ' + email + '.');
    } catch (ex) {
      showError(ex.message || 'Something went wrong. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Application';
    }
  });
})();
