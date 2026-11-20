/**
 * Campaign SPA — Legal pages (Terms of Service, Privacy Policy).
 * Fetches the same HTML fragments the Dashboard uses and renders them inside the campaign shell.
 */
(function (global) {
  'use strict';

  var cache = {};

  function makePage(fragment) {
    return {
      render: async function (host, ctx, params) {
        host.innerHTML = '<div class="dashboard-fragment legal-spa-page" style="text-align:center;padding:3rem">Loading…</div>';
        try {
          if (!cache[fragment]) {
            var res = await fetch('Dashboard/' + fragment);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            cache[fragment] = await res.text();
          }
          host.innerHTML = cache[fragment];
          // Rewrite footer links to use campaign hash routing
          host.querySelectorAll('.legal-spa-footer a[href^="#"]').forEach(function (a) {
            var target = a.getAttribute('href').replace('#', '');
            a.addEventListener('click', function (e) {
              e.preventDefault();
              ctx.go(target);
            });
          });
          // Change "Back to Dashboard" to "Back to Campaign"
          var back = host.querySelector('.legal-spa-back');
          if (back) {
            back.textContent = '← Back to Campaign';
            back.addEventListener('click', function (e) {
              e.preventDefault();
              ctx.go('overview');
            });
          }
        } catch (err) {
          host.innerHTML = '<div class="dashboard-fragment legal-spa-page"><p>Could not load the page. Please try again.</p></div>';
        }
        return null;
      },
    };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.legalTerms = makePage('legal-terms.html');
  global.FogCampaignPages.legalPrivacy = makePage('legal-privacy.html');
})(window);
