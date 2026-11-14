/**
 * "← Back to …" in the Campaign workspace: a thin layer over FogNav (JS/fog-nav.js), the same mechanism the Dashboard uses.
 *
 *   FogCampaignReturn.link(section, rest, label)    '#section/rest?from=<here>&label=…' for an in-app <a href> (same tab;
 *                                                   the normal way to open referenced content: a monster, spell, character…)
 *   FogCampaignReturn.go(section, rest, label)      the same, navigating now (after an action, e.g. Start encounter → Combat)
 *   FogCampaignReturn.href(section, rest, label)    a full URL for an OPTIONAL "open in a new tab" (reference material the DM
 *                                                   wants to keep open during a session). The new tab loads the workspace
 *                                                   normally (sign-in and campaign access are checked again there).
 *   FogCampaignReturn.update(route)                 the shell calls it after each section renders (draws the bar)
 *
 * The origin is part of the address, so the browser's Back/Forward and reloads keep it. Pages opened without one (bookmark,
 * typed address) fall back to their parent section: a monster → Monsters & Spells, a character → Characters, a track → Music.
 * Small interactions (initiative entries, tabs, filters) don't use this.
 */
(function (global) {
  'use strict';

  var R = function () { return global.FogCampaignRouter; };
  var N = function () { return global.FogNav; };
  function campaignId() { return new URLSearchParams(global.location.search).get('c'); }

  var FALLBACK = [
    [/^bestiary\/(monster|spell)\//, '#bestiary', 'Monsters & Spells'],
    [/^characters\/[^/]+/, '#characters', 'Characters'],
    [/^music\/track\//, '#music', 'Music'],
  ];
  var configured = false;
  function setup() {
    if (configured || !global.FogNav) return;
    configured = true;
    global.FogNav.configure({
      fallback: function (path) {
        for (var i = 0; i < FALLBACK.length; i++) if (FALLBACK[i][0].test(path)) return { hash: FALLBACK[i][1], label: FALLBACK[i][2] };
        return null;
      },
    });
  }
  setup();

  function link(section, rest, label) { setup(); return N().link(R().hrefFor(section, rest), label); }
  function go(section, rest, label) { global.location.hash = link(section, rest, label).slice(1); }
  function href(section, rest, label) {
    return 'campaign.html?c=' + encodeURIComponent(campaignId() || '') + link(section, rest, label) + (link(section, rest, label).indexOf('?') >= 0 ? '&' : '?') + 'tab=1';
  }

  var bar = null;
  function ensureBar() {
    if (bar && bar.isConnected) return bar;
    var main = document.getElementById('campaign-content');
    if (!main) return null;
    bar = document.createElement('nav');
    bar.className = 'cw-return fog-back';
    bar.setAttribute('aria-label', 'Return');
    bar.hidden = true;
    main.parentNode.insertBefore(bar, main);
    return bar;
  }
  function update() { setup(); if (N()) N().rendered(ensureBar()); }

  global.FogCampaignReturn = { link: link, go: go, href: href, update: update };
})(window);
