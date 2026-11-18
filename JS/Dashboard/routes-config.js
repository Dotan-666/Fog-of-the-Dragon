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
    'character-engine/content-packs.js',
    'character-engine/character-options.js',
    'character-engine/derive-character.js',
    'character-engine/validate-character.js',
    'Dashboard/characters/character-store.js',
    'Dashboard/characters/character-registry.js', // the plan's character limit (decided by the database)
    'Dashboard/characters/character-ui.js',
  ];

  // Creator and sheet also load the rules glossary, Guided Tips and the Character Guide.
  var CHARACTER_GUIDE_SCRIPTS = CHARACTER_SCRIPTS.concat([
    'character-engine/data/srd-5.2.1-glossary.js',
    'character-engine/guided-tips.js',
    'character-engine/synergies.js',
    'character-engine/character-guide.js',
    'Dashboard/characters/tips-popover.js',
    'Dashboard/characters/guide-ai.js',
    'Dashboard/characters/guide-view.js',
    'Dashboard/campaign-store.js', // characters built for a campaign seat are sent to it on save
  ]);

  // Shared music engine (the Music page and the Campaign workspace's Music section use the same player).
  var MUSIC_SCRIPTS = ['Dashboard/music/audio-catalog.js', 'Dashboard/music/music-store.js', 'Dashboard/music/music-player.js'];

  // Homebrew (sidebar: Homebrew → #grimoire). The renderer is shared with Monsters & Spells.
  var HOMEBREW_SCRIPTS = ['character-engine/data/srd-5.2.1-core.js', 'Dashboard/compendium/compendium-render.js', 'Dashboard/homebrew/homebrew-model.js', 'Dashboard/content-images.js', 'Dashboard/homebrew/homebrew-store.js'];

  // Script sets the Campaign workspace (Pages/campaign.html) reuses, so the lists exist once.
  global.FogScriptSets = { CHARACTER: CHARACTER_SCRIPTS, MUSIC: MUSIC_SCRIPTS };

  global.FogDashboardRoutes = {
    campaigns: {
      fragment: 'campaigns.html',
      styles: ['campaigns.css'],
      scripts: ['Dashboard/campaign-store.js', 'Dashboard/campaigns.js'],
      initName: 'campaigns',
    },
    'create-campaign': {
      fragment: 'create-campaign.html',
      styles: ['create-campaign.css'],
      // Every campaign runs one of the DM's adventures (chosen or created on this page).
      scripts: ['Dashboard/adventures/adventure-model.js', 'Dashboard/adventures/adventure-store.js', 'Dashboard/campaign-store.js', 'Dashboard/create-campaign.js'],
      initName: 'createCampaign',
      nav: 'campaigns',
      alwaysReload: true,
    },
    // A campaign opens in its own workspace (Pages/campaign.html), not in the Dashboard. Old links and
    // notifications (#campaigns/<id>) land on the campaign's Overview.
    'campaign-view': {
      external: function (params) { return 'campaign.html?c=' + encodeURIComponent(params.id) + '#overview'; },
    },
    characters: {
      fragment: 'characters.html',
      styles: ['characters.css'],
      scripts: CHARACTER_SCRIPTS.concat(['Dashboard/characters/character-import.js', 'Dashboard/characters/characters-home.js']),
      initName: 'characters',
    },
    'character-create': {
      fragment: 'character-wizard.html',
      styles: ['character-shared.css', 'character-wizard.css', 'character-guide.css'],
      scripts: CHARACTER_GUIDE_SCRIPTS.concat(['Dashboard/characters/character-wizard.js']),
      initName: 'characterCreate',
      nav: 'characters',
      alwaysReload: true,
    },
    'character-edit': {
      fragment: 'character-wizard.html',
      styles: ['character-shared.css', 'character-wizard.css', 'character-guide.css'],
      scripts: CHARACTER_GUIDE_SCRIPTS.concat(['Dashboard/characters/character-wizard.js']),
      initName: 'characterEdit',
      nav: 'characters',
      alwaysReload: true,
    },
    'character-levelup': {
      fragment: 'character-wizard.html',
      styles: ['character-shared.css', 'character-wizard.css', 'character-guide.css'],
      scripts: CHARACTER_GUIDE_SCRIPTS.concat(['Dashboard/characters/character-wizard.js']),
      initName: 'characterLevelUp',
      nav: 'characters',
      alwaysReload: true,
    },
    'character-view': {
      fragment: 'character-sheet.html',
      styles: ['character-shared.css', 'character-sheet.css', 'character-guide.css'],
      scripts: CHARACTER_GUIDE_SCRIPTS.concat(['Dashboard/characters/character-pdf.js', 'Dashboard/characters/character-sheet.js']),
      initName: 'characterView',
      nav: 'characters',
      alwaysReload: true,
    },
    profile: {
      fragment: 'profile.html',
      styles: ['profile.css'],
      scripts: ['Dashboard/campaign-store.js', 'Dashboard/profile.js'],
      initName: 'profile',
      alwaysReload: true,
    },
    upgrade: {
      fragment: 'upgrade.html',
      styles: ['upgrade.css'],
      scripts: ['fog-payments.js', 'Dashboard/upgrade.js'],
      initName: 'upgrade',
    },
    // Billing: the real plan, plus clearly labelled demo data from the mock Lemon Squeezy store when FOG_DEMO_BILLING=true.
    billing: {
      fragment: 'billing.html',
      styles: ['billing.css'],
      scripts: ['fog-payments.js', 'Dashboard/billing/mock-lemonsqueezy.js', 'Dashboard/billing/billing-page.js'],
      initName: 'billing',
      nav: 'upgrade',
      alwaysReload: true,
    },
    'billing-revenue': {
      fragment: 'billing.html',
      styles: ['billing.css'],
      scripts: ['fog-payments.js', 'Dashboard/billing/mock-lemonsqueezy.js', 'Dashboard/billing/billing-page.js'],
      initName: 'billing',
      nav: 'upgrade',
      alwaysReload: true,
    },
    settings: {
      fragment: 'settings.html',
      styles: ['settings.css'],
      scripts: ['Dashboard/campaign-store.js', 'Dashboard/settings.js'],
      initName: 'settings',
      alwaysReload: true,
    },
    music: {
      fragment: 'music.html',
      styles: ['music.css'],
      // The player keeps playing after you leave the page (these scripts stay loaded).
      scripts: MUSIC_SCRIPTS.concat(['Dashboard/music/music-page.js']),
      initName: 'music',
      alwaysReload: true,
    },
    'bestiary-spells': {
      fragment: 'bestiary-spells.html',
      styles: ['compendium.css'],
      // SRD 5.2.1 spells come from the character engine data (one copy in the project); monsters from Assets/Data;
      // the user's homebrew monsters and spells from Supabase (homebrew store).
      scripts: ['character-engine/data/srd-5.2.1-core.js', 'character-engine/data/srd-5.2.1-spells.js', 'Dashboard/compendium/compendium-store.js', 'Dashboard/compendium/compendium-render.js', 'Dashboard/homebrew/homebrew-model.js', 'Dashboard/homebrew/homebrew-store.js', 'Dashboard/compendium/compendium-page.js'],
      initName: 'compendium',
      alwaysReload: true,
    },
    adventures: {
      fragment: 'adventures.html',
      styles: ['adventures.css'],
      scripts: ['Dashboard/adventures/adventure-model.js', 'Dashboard/content-images.js', 'Dashboard/adventures/adventure-store.js', 'Dashboard/adventures/adventures-library.js'],
      initName: 'adventures',
      alwaysReload: true,
    },
    'adventure-edit': {
      fragment: 'adventure-editor.html',
      styles: ['adventures.css'],
      scripts: ['Dashboard/adventures/adventure-model.js', 'Dashboard/content-images.js', 'Dashboard/adventures/adventure-store.js', 'Dashboard/compendium/compendium-store.js', 'Dashboard/music/audio-catalog.js', 'Dashboard/adventures/adventure-encounters.js', 'Dashboard/adventures/adventure-editor.js'],
      initName: 'adventureEditor',
      nav: 'adventures',
      alwaysReload: true,
    },
    grimoire: {
      fragment: 'homebrew.html',
      styles: ['compendium.css', 'homebrew.css'],
      scripts: HOMEBREW_SCRIPTS.concat(['Dashboard/homebrew/homebrew-library.js']),
      initName: 'homebrew',
      alwaysReload: true,
    },
    'homebrew-edit': {
      fragment: 'homebrew-editor.html',
      styles: ['compendium.css', 'homebrew.css'],
      scripts: HOMEBREW_SCRIPTS.concat(['Dashboard/homebrew/homebrew-editor.js']),
      initName: 'homebrewEditor',
      nav: 'grimoire',
      alwaysReload: true,
    },
    // Reading view: the adventure as a parchment book (DM view or Player view).
    'adventure-read': {
      fragment: 'adventure-reader.html',
      styles: ['adventure-reader.css'],
      scripts: ['Dashboard/adventures/adventure-model.js', 'Dashboard/content-images.js', 'Dashboard/adventures/adventure-store.js', 'Dashboard/adventures/adventure-reader.js'],
      initName: 'adventureReader',
      nav: 'adventures',
      alwaysReload: true,
    },
    // Marketplace (header icon, not a sidebar tab): official store (demo merchandise), community content, cart and checkout.
    marketplace: {
      fragment: 'marketplace.html',
      styles: ['marketplace.css'],
      scripts: ['Dashboard/adventures/adventure-model.js', 'Dashboard/content-images.js', 'Dashboard/adventures/adventure-store.js', 'Dashboard/homebrew/homebrew-model.js', 'Dashboard/homebrew/homebrew-store.js',
        'Dashboard/marketplace/store-art.js', 'Dashboard/marketplace/market-service.js', 'Dashboard/marketplace/market-page.js'],
      initName: 'marketplace',
      alwaysReload: true,
    },
    // Foggy: the AI assistant (chat, adventure writing, stat blocks, pictures and maps, music plans). AI runs only in the
    // Edge Functions; everything it makes is saved only when the user approves (JS/Dashboard/foggy/foggy-service.js).
    foggy: {
      fragment: 'foggy.html',
      styles: ['foggy.css'],
      scripts: ['Dashboard/adventures/adventure-model.js', 'Dashboard/content-images.js', 'Dashboard/adventures/adventure-store.js', 'Dashboard/homebrew/homebrew-model.js', 'Dashboard/homebrew/homebrew-store.js']
        .concat(MUSIC_SCRIPTS, ['Dashboard/foggy/foggy-service.js', 'Dashboard/foggy/foggy-studio.js', 'Dashboard/foggy/foggy-ui.js', 'Dashboard/foggy/foggy-page.js']),
      initName: 'foggy',
      alwaysReload: true,
    },
    'edit-profile': {
      external: 'Dashboard/edit-profile.html',
    },
  };

  // Sidebar sections that exist but aren't built yet: shown as "not set up yet" instead of 404.
  global.FogDashboardPlannedPages = [];

  // Shown for unknown routes and missing fragments (relative to Pages/dashboard.html).
  global.FogDashboardNotFoundPage = '404.html';
})(window);
