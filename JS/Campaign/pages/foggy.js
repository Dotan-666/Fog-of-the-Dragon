/**
 * Campaign workspace → Foggy (Campaign Foggy): the Dungeon Master's AI helper for this campaign (Fogger of the Dragons).
 * Infrastructure and visibility only for now: the shared Foggy interface (JS/Dashboard/foggy/foggy-ui.js) with the
 * campaign's own drafts; generation stays off until Foggy is switched on (see foggy-service.js).
 */
(function (global) {
  'use strict';
  async function render(host, ctx) {
    host.innerHTML = '<div class="cw-page cw-foggy"><div id="cw-foggy-root"></div></div>';
    var c = ctx.campaign;
    return global.FogFoggyUI.mount(host.querySelector('#cw-foggy-root'), {
      scope: 'campaign',
      campaign: { id: ctx.id, name: c.name, adventureId: c.adventureId || null, isDm: ctx.isDm && c.status !== 'archived' },
      navigate: function (hash) { global.location.href = ctx.dashboardUrl(hash); },
    });
  }
  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.foggy = { render: render };
})(window);
