/** Dashboard → Foggy (#foggy): standalone content. The interface itself is FogFoggyUI (foggy-ui.js). */
(function (global) {
  'use strict';
  function init(container) {
    var host = container.querySelector('#foggy-root');
    return global.FogFoggyUI.mount(host, { scope: 'dashboard', navigate: function (hash) { global.FogDashboardRouter.navigateTo(hash); } });
  }
  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.foggy = init;
})(window);
