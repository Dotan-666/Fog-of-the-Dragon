/**
 * Route registry for dashboard fragments
 *
 * fragment  HTML file in Pages/Dashboard/
 * styles    page stylesheets in Styles/Dashboard/ (added while the route is active)
 * scripts   files under JS/ loaded once, in order, before the page init runs
 * initName  key in window.FogPageInits
 * nav       sidebar item to highlight (defaults to the route name)
 * external  full-page URL (relative to Pages/dashboard.html) for pages that are not fragments
 */
(function (global) {
  'use strict';

  var CHARACTER_SCRIPTS = [
    'character-engine/data/srd-5.2.1-core.js',
    'character-engine/data/srd-5.2.1-spells.js',
    'character-engine/rules-api.js',
    'character-engine/character-options.js',
    'character-engine/derive-character.js',
    'character-engine/validate-character.js',
    'Dashboard/characters/character-store.js',
    'Dashboard/characters/character-ui.js',
  ];

  global.FogDashboardRoutes = {
    campaigns: {
      fragment: 'campaigns.html',
      styles: ['campaigns.css'],
      scripts: ['Dashboard/campaigns.js'],
      initName: 'campaigns',
    },
    'create-campaign': {
      fragment: 'create-campaign.html',
      styles: ['create-campaign.css'],
      initName: null,
      nav: 'campaigns',
    },
    characters: {
      fragment: 'characters.html',
      styles: ['characters.css'],
      scripts: CHARACTER_SCRIPTS.concat(['Dashboard/characters/characters-home.js']),
      initName: 'characters',
    },
    'character-create': {
      fragment: 'character-wizard.html',
      styles: ['character-shared.css', 'character-wizard.css'],
      scripts: CHARACTER_SCRIPTS.concat(['Dashboard/characters/character-wizard.js']),
      initName: 'characterCreate',
      nav: 'characters',
      alwaysReload: true,
    },
    'character-edit': {
      fragment: 'character-wizard.html',
      styles: ['character-shared.css', 'character-wizard.css'],
      scripts: CHARACTER_SCRIPTS.concat(['Dashboard/characters/character-wizard.js']),
      initName: 'characterEdit',
      nav: 'characters',
      alwaysReload: true,
    },
    'character-view': {
      fragment: 'character-sheet.html',
      styles: ['character-shared.css', 'character-sheet.css'],
      scripts: CHARACTER_SCRIPTS.concat(['Dashboard/characters/character-sheet.js']),
      initName: 'characterView',
      nav: 'characters',
      alwaysReload: true,
    },
    profile: {
      fragment: 'profile.html',
      styles: ['profile.css'],
      initName: null,
    },
    upgrade: {
      fragment: 'upgrade.html',
      styles: [],
      scripts: ['Dashboard/upgrade.js'],
      initName: 'upgrade',
    },
    settings: {
      external: 'Dashboard/settings.html',
    },
    'edit-profile': {
      external: 'Dashboard/edit-profile.html',
    },
  };

  // Sidebar sections that exist but aren't built yet: shown as "not set up yet" instead of 404.
  global.FogDashboardPlannedPages = ['music', 'adventures', 'bestiary-spells', 'grimoire', 'foggy'];

  // Shown for unknown routes and missing fragments (relative to Pages/dashboard.html).
  global.FogDashboardNotFoundPage = '404.html';
})(window);
