/**
 * Campaign workspace → Foggy (Campaign Foggy): the Dungeon Master's AI helper for this campaign (Dungeon Master plan).
 * Infrastructure and visibility only for now: the shared Foggy interface (JS/Dashboard/foggy/foggy-ui.js) with the
 * campaign's own drafts; generation stays off until Foggy is switched on (see foggy-service.js).
 */
(function (global) {
  'use strict';
  async function render(host, ctx, params) {
    var c = ctx.campaign;
    // #foggy/prepare: Foggy+ session preparation (DM)
    if (params && params.rest && params.rest[0] === 'prepare' && global.FogSessionPrep) {
      host.innerHTML = '<div class="cw-page cw-foggy cw-prep"><header class="cw-page-head"><div><h2 class="cw-page-title">Prepare the next session</h2>' +
        '<p class="cw-page-sub">What\'s ready, what\'s missing, and the pages to have open. Nothing starts and nothing is changed until you choose.</p></div><a class="btn btn-secondary btn-sm" href="#foggy">Foggy</a></header><div id="cw-prep-root"></div></div>';
      return global.FogSessionPrep.mount(host.querySelector('#cw-prep-root'), ctx);
    }
    host.innerHTML = '<div class="cw-page cw-foggy">' + (ctx.isDm && c.status !== 'archived' ? '<p class="cw-foggy-prep-link"><a class="btn btn-secondary btn-sm" href="#foggy/prepare">🗒 Prepare the next session</a></p>' : '') + '<div id="cw-foggy-root"></div></div>';
    return global.FogFoggyUI.mount(host.querySelector('#cw-foggy-root'), {
      scope: 'campaign',
      campaign: { id: ctx.id, name: c.name, adventureId: c.adventureId || null, isDm: ctx.isDm && c.status !== 'archived' },
      navigate: function (hash) { global.location.href = ctx.dashboardUrl(hash); },
    });
  }
  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.foggy = { render: render };
})(window);
