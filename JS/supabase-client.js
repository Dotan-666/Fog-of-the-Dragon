/**
 * Fog of the Dragon — the one shared Supabase client.
 *
 * Load order on a page:
 *   1. supabase-js UMD build (pinned + integrity-checked <script> from jsDelivr) → window.supabase
 *   2. JS/config/supabase-config.js (generated from .env, git-ignored)            → window.FOG_SUPABASE_CONFIG
 *   3. this file                                                                   → window.FogSupabase
 *
 * Only the publishable (anon) key is ever used here. Data access is protected by Row Level Security.
 */
(function (global) {
  'use strict';

  var config = global.FOG_SUPABASE_CONFIG;
  var lib = global.supabase;
  var client = null;
  var configError = null;

  if (!lib || typeof lib.createClient !== 'function') {
    configError = 'The Supabase library could not be loaded. Check your internet connection and reload.';
  } else if (!config || !config.url || !config.publishableKey || /your-project-ref|your_key_here/.test(config.url + config.publishableKey)) {
    configError = 'Supabase isn’t configured yet. Create JS/config/supabase-config.js (see JS/config/supabase-config.example.js).';
  } else if (/^sb_secret_/.test(config.publishableKey)) {
    configError = 'A secret Supabase key was found in browser configuration. Replace it with the publishable key.';
  } else {
    client = lib.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true, // session survives reloads (stored by supabase-js in localStorage)
        autoRefreshToken: true,
        detectSessionInUrl: true, // picks up email-confirmation and password-reset links
      },
    });
  }

  /** Absolute URL of a page in this site, e.g. pageUrl('Pages/Auth/login.html'), for auth email redirects. */
  function pageUrl(relativeFromRoot) {
    // This file lives at <site root>/JS/supabase-client.js; derive the site root from its own URL.
    var script = document.currentScript || document.querySelector('script[src*="supabase-client.js"]');
    var root = new URL('..', script ? script.src : global.location.href);
    return new URL(relativeFromRoot, root).href;
  }

  var siteRootUrl = pageUrl('');

  global.FogSupabase = {
    client: client,
    configError: configError,
    isConfigured: !!client,
    pageUrl: function (relativeFromRoot) {
      return new URL(relativeFromRoot, siteRootUrl).href;
    },
  };
})(window);
