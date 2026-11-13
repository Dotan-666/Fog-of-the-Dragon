/*
 * Example only. The real file, JS/config/supabase-config.js, is git-ignored and generated from .env:
 *
 *   cp .env.example .env        (fill in SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY)
 *   node tools/write-supabase-config.mjs
 *
 * On a host without Node (for example GitHub Pages), create JS/config/supabase-config.js with this shape
 * in your deployment step. Only ever use the publishable (anon) key here, never a secret/service_role key.
 */
window.FOG_SUPABASE_CONFIG = {
  url: 'https://your-project-ref.supabase.co',
  publishableKey: 'sb_publishable_your_key_here',
};
