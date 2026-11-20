/**
 * Route registry for the Campaign workspace (Pages/campaign.html). One entry per section.
 *
 * label    text in the navigation
 * icon     SVG markup (24x24, stroke) for the navigation
 * access   'all' (every member) or 'dm' (Dungeon Master only: players are told so instead of loading anything)
 * page     key in window.FogCampaignPages; the page object has render(root, ctx, params) → optional cleanup function
 * scripts  files under JS/ loaded once, in order, before the page renders
 * styles   stylesheets under Styles/ added while the route is active
 * nav      false for routes that are not in the section list (Settings has its own button in the header)
 *
 * The campaign itself is identified by the page address (campaign.html?c=<id>), never by the section.
 */
(function (global) {
  'use strict';

  var sets = global.FogScriptSets || { CHARACTER: [], MUSIC: [] };
  var CHAR = sets.CHARACTER;
  // campaign-party.js (avatars, character summaries) reads the character engine only when asked, so BASE can load it first.
  var BASE = ['Dashboard/campaign-store.js', 'Campaign/campaign-data.js', 'Campaign/campaign-party.js'];
  var PARTY = BASE.concat(CHAR);
  var ADMIN_STYLES = ['Dashboard/create-campaign.css', 'Dashboard/campaign-view.css'];
  var COMPENDIUM = [
    'character-engine/data/srd-5.2.1-core.js',
    'character-engine/data/srd-5.2.1-spells.js',
    'Dashboard/compendium/compendium-store.js',
    'Dashboard/compendium/compendium-render.js',
    'Dashboard/homebrew/homebrew-model.js',
    'Dashboard/homebrew/homebrew-store.js',
    'Dashboard/compendium/compendium-page.js', // also exposes FogCompendiumPage.loadHomebrew
  ];
  var COMBAT = ['character-engine/data/srd-5.2.1-glossary.js', 'Campaign/combat-model.js', 'Campaign/combat-session.js', 'Campaign/combat-actions.js', 'Campaign/combat-auto.js', 'Campaign/dice.js', 'Dashboard/foggy/foggy-service.js', 'Dashboard/music/audio-catalog.js'];
  var ADVENTURE = ['Dashboard/adventures/adventure-model.js', 'Dashboard/content-images.js', 'Dashboard/adventures/adventure-store.js'];

  function icon(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  // Sidebar sections, in order (the Dashboard's sidebar groups work the same way).
  global.FogCampaignNavGroups = ['Campaign', 'Play', 'Content'];
  // Old links and notifications that used the former section name.
  global.FogCampaignRouteAliases = { memories: 'logbook' };

  global.FogCampaignRoutes = {
    overview: {
      label: 'Overview', group: 'Campaign', access: 'all', page: 'overview',
      icon: icon('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
      scripts: PARTY.concat(ADVENTURE, ['Campaign/session-card.js', 'Campaign/pages/overview.js']),
      styles: [],
    },
    feed: {
      label: 'Campaign Feed', group: 'Campaign', access: 'all', page: 'feed',
      icon: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
      scripts: BASE.concat(['Campaign/pages/feed.js']),
      styles: [],
    },
    meetings: {
      label: 'Meetings', group: 'Campaign', access: 'all', page: 'meetings',
      icon: icon('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
      scripts: BASE.concat(['Campaign/schedule-model.js', 'Campaign/pages/scheduler-ui.js', 'Campaign/pages/meetings.js']),
      styles: ['Dashboard/campaign-view.css'],
    },
    members: {
      label: 'Members', group: 'Campaign', access: 'all', page: 'members',
      icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
      scripts: PARTY.concat(['Campaign/pages/members.js']),
      styles: ADMIN_STYLES,
    },
    characters: {
      label: 'Characters', group: 'Play', access: 'all', page: 'characters',
      icon: icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
      scripts: PARTY.concat(['Campaign/pages/characters.js']),
      styles: ADMIN_STYLES,
    },
    combat: {
      label: 'Combat', group: 'Play', access: 'all', page: 'combat', pro: true,
      icon: icon('<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M9.5 6.5L21 18v3h-3L6.5 9.5"/>'),
      scripts: PARTY.concat(COMPENDIUM, COMBAT, ['Campaign/pages/combat.js']),
      styles: [],
    },
    map: {
      label: 'Map', group: 'Play', access: 'all', page: 'map',
      icon: icon('<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16"/><path d="M16 6v16"/>'),
      scripts: BASE.concat(ADVENTURE, ['Campaign/campaign-maps.js', 'Campaign/map-draw.js', 'Campaign/pages/map.js']),
      styles: [],
    },
    music: {
      label: 'Music', group: 'Play', access: 'dm', page: 'music',
      icon: icon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
      scripts: sets.MUSIC.concat(['Dashboard/music/session-music.js', 'Campaign/pages/music.js']),
      styles: ['Dashboard/campaign-view.css'],
    },
    content: {
      label: 'Adventures', group: 'Content', access: 'dm', page: 'content',
      icon: icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
      // (the DM's encounter tools load their own scripts after the page appears: see pages/content.js)
      scripts: PARTY.concat(ADVENTURE, ['Dashboard/adventures/adventure-reader.js', 'Campaign/pages/content.js']),
      styles: ['Dashboard/adventure-reader.css'],
    },
    encounterBuilder: {
      label: 'Encounters', group: 'Play', access: 'dm', page: 'encounterBuilder', pro: true,
      icon: icon('<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>'),
      scripts: PARTY.concat(COMPENDIUM, ['Campaign/pages/encounter-builder.js']),
      styles: [],
    },
    bestiary: {
      label: 'Bestiary', group: 'Content', access: 'all', page: 'bestiary',
      icon: icon('<path d="M12 2l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z"/>'),
      scripts: BASE.concat(COMPENDIUM, COMBAT, ['Campaign/pages/bestiary.js']),
      styles: ['Dashboard/compendium.css'],
    },
    timeline: {
      label: 'Timeline', group: 'Content', access: 'all', page: 'timeline',
      icon: icon('<path d="M12 2v20"/><circle cx="12" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="18" r="2"/><path d="M14 6h4"/><path d="M6 12h6"/><path d="M14 18h4"/>'),
      scripts: BASE.concat(['Campaign/pages/timeline.js']),
      styles: [],
    },
    logbook: {
      label: 'Logbook', group: 'Content', access: 'all', page: 'memories',
      icon: icon('<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>'),
      scripts: BASE.concat(['fog-payments.js', 'Campaign/book-render.js', 'Campaign/book-editor.js', 'Dashboard/foggy/foggy-service.js', 'Campaign/logbook-editor.js', 'Campaign/logbook-sessions.js', 'Campaign/pages/memories.js']),
      styles: ['Dashboard/campaign-view.css'],
    },
    sessionPrep: {
      label: 'Session Prep', group: 'Content', access: 'dm', page: 'sessionPrep',
      icon: icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>'),
      scripts: BASE.concat(['Dashboard/foggy/foggy-service.js', 'Campaign/pages/session-prep-page.js']),
      styles: [],
    },
    // Campaign Foggy (Dungeon Master plan, the DM only). Infrastructure and visibility for now: nothing generates yet.
    foggy: {
      label: 'Foggy', group: 'Content', access: 'dm', page: 'foggy', pro: true,
      icon: icon('<path d="M3 15c3-4 6-4 9 0s6 4 9 0"/><path d="M3 9c3-4 6-4 9 0s6 4 9 0" opacity=".6"/>'),
      scripts: BASE.concat(ADVENTURE, ['Dashboard/homebrew/homebrew-model.js', 'Dashboard/homebrew/homebrew-store.js'], sets.MUSIC, ['Dashboard/foggy/foggy-service.js', 'Dashboard/foggy/foggy-studio.js', 'Dashboard/foggy/foggy-voice.js', 'Dashboard/foggy/foggy-ui.js', 'Campaign/session-prep.js', 'Campaign/pages/foggy.js']),
      styles: ['Dashboard/foggy.css'],
    },
    marketplace: {
      label: 'Marketplace', access: 'all', page: 'marketplace', nav: false,
      icon: icon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
      scripts: ['Dashboard/adventures/adventure-model.js', 'Dashboard/content-images.js', 'Dashboard/adventures/adventure-store.js', 'Dashboard/homebrew/homebrew-model.js', 'Dashboard/homebrew/homebrew-store.js',
        'Dashboard/marketplace/store-art.js', 'Dashboard/marketplace/market-service.js', 'Dashboard/marketplace/market-page.js', 'Campaign/pages/marketplace.js'],
      styles: ['Dashboard/marketplace.css'],
    },
    terms: {
      label: 'Terms of Service', access: 'all', page: 'legalTerms', nav: false,
      scripts: ['Campaign/pages/legal.js'],
      styles: ['Dashboard/legal.css'],
    },
    privacy: {
      label: 'Privacy Policy', access: 'all', page: 'legalPrivacy', nav: false,
      scripts: ['Campaign/pages/legal.js'],
      styles: ['Dashboard/legal.css'],
    },
    settings: {
      label: 'Campaign Settings', access: 'all', page: 'settings', nav: false, // opened from the Campaign Settings button in the campaign bar, not the sidebar
     
      icon: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
      scripts: PARTY.concat(ADVENTURE, ['Campaign/pages/settings.js']),
      styles: ADMIN_STYLES,
    },
  };

  global.FogCampaignDefaultRoute = 'overview';
})(window);
