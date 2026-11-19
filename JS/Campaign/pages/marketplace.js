/**
 * Campaign Marketplace — thin wrapper that runs the Dashboard marketplace (FogPageInits.marketplace)
 * inside the Campaign SPA, so the user doesn't have to leave the campaign to browse the shop.
 *
 * Internal marketplace links use data-mk-nav="#marketplace/…"; the wrapper overrides the nav function
 * via container.__mkNav so those navigate within the campaign hash instead of the dashboard router.
 */
(function (global) {
  'use strict';

  function parseMarketParams(params) {
    var parts = (params && params.rest) || [];
    return { view: parts[0] || 'store', id: parts[1] || undefined };
  }

  async function render(host, ctx, params) {
    var alive = true;
    var mkParams = parseMarketParams(params);

    host.innerHTML = '<div class="dashboard-fragment marketplace-page"><div id="mk-root" aria-live="polite"></div></div>';
    var container = host.querySelector('.marketplace-page');
    var cleanup = null;

    container.__mkNav = function (h) {
      var sub = h.replace(/^#marketplace\/?/, '');
      var parts = sub.split('/').filter(Boolean);
      ctx.go('marketplace', parts);
    };

    var init = global.FogPageInits && global.FogPageInits.marketplace;
    if (!init) {
      host.querySelector('#mk-root').innerHTML = '<div class="cw-card cw-empty"><p>Marketplace scripts are still loading. Please try again.</p></div>';
      return function () { alive = false; };
    }

    cleanup = init(container, mkParams);

    return function () {
      alive = false;
      if (cleanup) cleanup();
    };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.marketplace = { render: render };
})(window);
