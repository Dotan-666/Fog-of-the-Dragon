/**
 * Fog of the Dragon — account (Supabase Auth + profiles), settings and notifications
 *
 * Authentication and the user's profile come from Supabase (JS/supabase-client.js). Passwords are handled
 * entirely by Supabase Auth; this file never sees or stores them beyond passing them to the client.
 *
 * Campaigns, characters, settings and notifications are still stored in this browser (not in Supabase yet).
 * They are kept per user: when someone else signs in on the same browser, the previous user's local data is
 * set aside and restored when that user signs in again.
 *
 * Loaded on the auth pages, the dashboard shell and the standalone Edit Profile page.
 */
(function (global) {
  'use strict';

  var KEYS = {
    settings: 'fog_settings_v1',
    notifications: 'fog_notifications_v1',
    campaigns: 'fog_campaigns_v1',
    characters: 'fog_characters_v1',
    music: 'fog_music_v1', // Music tab: playlists, favorites, history (uploaded files are in IndexedDB)
  };
  var LOCAL_USER_KEYS = [KEYS.campaigns, KEYS.characters, KEYS.notifications, KEYS.settings, KEYS.music];
  var LOCAL_OWNER_KEY = 'fog_local_owner';
  var LOCAL_BUNDLE_PREFIX = 'fog_local_bundle_';
  var EPHEMERAL_KEY = 'fog_session_ephemeral'; // "Remember me" was off
  var SESSION_FLAG = 'fog_session_active'; // set in sessionStorage by the tab session that signed in
  var LEGACY_PROTOTYPE_KEY = 'fog_account_v1';
  var MAX_NOTIFICATIONS = 50;
  var AVATAR_MAX_SIDE = 256;
  var AVATAR_MAX_CHARS = 120000;

  // Plan limits from the pricing page (Pages/Dashboard/upgrade.html). An account is on the free Warlord plan unless
  // public.account_plans (filled by the payment webhook) says otherwise.
  var PLANS = {
    warlord: { id: 'warlord', name: 'Warlord', priceLabel: 'Free', activeCampaigns: 1, maxPeople: 5 },
    'dungeon-master': { id: 'dungeon-master', name: 'Dungeon Master', priceLabel: '$3.99 / month', activeCampaigns: 3, maxPeople: 7 },
    'fogger-of-the-dragons': { id: 'fogger-of-the-dragons', name: 'Fogger of the Dragons', priceLabel: '$5.99 / month', activeCampaigns: Infinity, maxPeople: Infinity },
  };

  function read(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (e) {
      return { ok: false, message: 'Could not save: browser storage is full or unavailable.' };
    }
  }

  function storageGet(store, key) {
    try { return global[store].getItem(key); } catch (e) { return null; }
  }

  function storageSet(store, key, value) {
    try {
      if (value == null) global[store].removeItem(key);
      else global[store].setItem(key, value);
    } catch (e) { /* storage unavailable */ }
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function emit(name, detail) {
    try {
      global.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* old browsers: ignore */ }
  }

  function sb() {
    return global.FogSupabase && global.FogSupabase.client;
  }

  // ---------------------------------------------------------------------------
  // Error messages people can act on
  // ---------------------------------------------------------------------------
  function friendlyAuthError(error) {
    if (!error) return 'Something went wrong. Please try again.';
    var code = error.code || '';
    var msg = error.message || '';
    if (code === 'invalid_credentials' || /Invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
    if (code === 'email_not_confirmed' || /Email not confirmed/i.test(msg)) return 'Please confirm your email address first. Check your inbox for the confirmation link.';
    if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'An account with this email already exists. Log in, or reset your password.';
    if (code === 'weak_password' || /Password should/i.test(msg)) return msg || 'That password is too weak. Use at least 8 characters.';
    if (code === 'same_password') return 'Your new password must be different from the old one.';
    if (/rate limit|too many/i.test(msg) || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Too many attempts. Please wait a few minutes and try again.';
    if (code === 'signup_disabled') return 'New sign-ups are currently disabled.';
    if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) return 'That email address isn’t valid.';
    if (/fetch|network|Failed to fetch|NetworkError/i.test(msg) || error.status === 0) return 'Can’t reach the server. Check your connection and try again.';
    return msg || 'Something went wrong. Please try again.';
  }

  // ---------------------------------------------------------------------------
  // Per-user local data (campaigns, characters, settings, notifications)
  // ---------------------------------------------------------------------------
  function stashLocalData(ownerId) {
    var bundle = {};
    LOCAL_USER_KEYS.forEach(function (k) {
      var v = storageGet('localStorage', k);
      if (v != null) bundle[k] = v;
      storageSet('localStorage', k, null);
    });
    if (Object.keys(bundle).length) storageSet('localStorage', LOCAL_BUNDLE_PREFIX + ownerId, JSON.stringify(bundle));
  }

  function restoreLocalData(userId) {
    var raw = storageGet('localStorage', LOCAL_BUNDLE_PREFIX + userId);
    if (!raw) return;
    try {
      var bundle = JSON.parse(raw);
      Object.keys(bundle).forEach(function (k) {
        if (LOCAL_USER_KEYS.indexOf(k) >= 0) storageSet('localStorage', k, bundle[k]);
      });
    } catch (e) { /* corrupt bundle: ignore */ }
    storageSet('localStorage', LOCAL_BUNDLE_PREFIX + userId, null);
  }

  /** Makes the local data in place belong to this user (sets aside another user's, restores this user's). */
  function useLocalDataOf(userId) {
    var owner = storageGet('localStorage', LOCAL_OWNER_KEY);
    if (owner === userId) return;
    if (owner) stashLocalData(owner);
    restoreLocalData(userId); // with no owner yet, data already in place (from before accounts existed) is kept
    storageSet('localStorage', LOCAL_OWNER_KEY, userId);
  }

  function setAsideLocalData() {
    var owner = storageGet('localStorage', LOCAL_OWNER_KEY);
    if (owner) stashLocalData(owner);
    storageSet('localStorage', LOCAL_OWNER_KEY, null);
  }

  // ---------------------------------------------------------------------------
  // Session and profile state
  // ---------------------------------------------------------------------------
  var state = { session: null, user: null, profile: null, profileError: null };
  var readyPromise = null;
  var listening = false;

  function profileFromRow(row, user) {
    var meta = (user && user.user_metadata) || {};
    row = row || {};
    return {
      displayName: row.display_name || meta.display_name || meta.username || (user && user.email ? user.email.split('@')[0] : ''),
      username: row.username || '',
      email: (user && user.email) || '',
      bio: row.bio || '',
      primarySystem: row.primary_system || '',
      favoriteClass: row.favorite_class || '',
      alignment: row.alignment || '',
      availability: row.availability || '',
      avatarUrl: row.avatar_url || null,
      updatedAt: row.updated_at || null,
    };
  }

  async function loadProfile() {
    var client = sb();
    var res = await client.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
    if (res.error) {
      state.profileError = res.error;
      console.error('Could not load profile:', res.error.message);
      state.profile = profileFromRow(null, state.user);
      return;
    }
    var row = res.data;
    if (!row) {
      // Normally created by the sign-up trigger; create it now for accounts that predate it.
      var meta = state.user.user_metadata || {};
      var created = await client.from('profiles')
        .insert({ id: state.user.id, display_name: (meta.display_name || meta.username || state.user.email.split('@')[0]).slice(0, 40) })
        .select('*').maybeSingle();
      if (created.error) {
        state.profileError = created.error;
        console.error('Could not create profile:', created.error.message);
      }
      row = created.data;
    }
    state.profileError = null;
    state.profile = profileFromRow(row, state.user);
  }

  function isAuthFailure(error) {
    return !!error && (error.status === 401 || error.status === 403 || error.name === 'AuthSessionMissingError' ||
      error.code === 'session_not_found' || error.code === 'user_not_found' || error.code === 'bad_jwt');
  }

  /** One auth listener for the whole page (never registered twice). */
  function listen() {
    if (listening || !sb()) return;
    listening = true;
    sb().auth.onAuthStateChange(function (event, session) {
      // Keep this callback synchronous; Supabase recommends deferring further client calls.
      state.session = session;
      if (session) state.user = session.user;
      if (event === 'SIGNED_OUT') {
        state.user = null;
        state.profile = null;
        emit('fog:auth', { event: event });
      } else if (event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED' || event === 'SIGNED_IN') {
        emit('fog:auth', { event: event });
      }
    });
  }

  /**
   * Resolves once the session has been restored and checked with the server:
   *   { session, user, profile, error }   (session is null when signed out)
   * Safe to call many times; the work happens once per page.
   */
  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = (async function () {
      storageSet('localStorage', LEGACY_PROTOTYPE_KEY, null); // the old browser-only prototype account
      var client = sb();
      if (!client) return { session: null, error: (global.FogSupabase && global.FogSupabase.configError) || 'Supabase is not available.' };
      listen();

      // "Remember me" was off and this is a new browser session: end it.
      if (storageGet('localStorage', EPHEMERAL_KEY) === '1' && storageGet('sessionStorage', SESSION_FLAG) !== '1') {
        await client.auth.signOut({ scope: 'local' });
        storageSet('localStorage', EPHEMERAL_KEY, null);
      }

      var got = await client.auth.getSession(); // refreshes an expired access token when possible
      var session = got.data && got.data.session;
      if (session) {
        // Ask the server whether the session is still valid (deleted users, revoked sessions...).
        var check = await client.auth.getUser();
        if (check.error && isAuthFailure(check.error)) {
          await client.auth.signOut({ scope: 'local' });
          session = null;
        } else if (check.data && check.data.user) {
          session.user = check.data.user;
        } // a network error keeps the stored session: being offline shouldn't log you out
      }

      state.session = session || null;
      state.user = session ? session.user : null;
      if (state.user) {
        useLocalDataOf(state.user.id);
        await loadProfile();
        await loadPlan();
      }
      return { session: state.session, user: state.user, profile: state.profile, error: got.error ? friendlyAuthError(got.error) : null };
    })();
    return readyPromise;
  }

  function isSignedIn() {
    return !!state.session;
  }

  /**
   * Quick synchronous hint: does this browser hold a stored Supabase session at all?
   * Used only to decide when to bounce to Login (e.g. after Back into a cached page); never as proof of auth.
   */
  function hasStoredSession() {
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        if (/^sb-.+-auth-token$/.test(global.localStorage.key(i))) return true;
      }
    } catch (e) { /* storage unavailable */ }
    return false;
  }

  function getAccount() {
    if (!state.user) return null;
    return {
      id: state.user.id,
      plan: planId(),
      createdAt: state.user.created_at,
      profile: state.profile || profileFromRow(null, state.user),
      profileError: state.profileError ? state.profileError.message : null,
    };
  }

  // The plan comes from public.account_plans, which only the payment webhook can write. No row, an unknown plan or a
  // lapsed subscription means the free Warlord plan. (A cancelled subscription keeps its plan until the paid period ends.)
  function planIsActive(row) {
    var end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
    if (row.status === 'active') return end == null || end > Date.now();
    if (row.status === 'canceled' || row.status === 'past_due') return end != null && end > Date.now();
    return false;
  }

  function planId() {
    return state.plan && PLANS[state.plan.id] ? state.plan.id : 'warlord';
  }

  async function loadPlan() {
    state.plan = null;
    var client = sb();
    if (!client || !state.user) return;
    try {
      var res = await client.from('account_plans').select('plan_id, status, current_period_end, portal_url').eq('user_id', state.user.id).maybeSingle();
      if (!res.error && res.data && planIsActive(res.data)) {
        state.plan = { id: res.data.plan_id, status: res.data.status, periodEnd: res.data.current_period_end, portalUrl: res.data.portal_url || null };
      }
    } catch (e) { /* the table may not exist yet (migration not applied): stay on the free plan */ }
  }

  /** Re-reads the plan (for example after returning from a checkout) and tells the page. */
  async function refreshPlan() {
    await loadPlan();
    emit('fog:account', {});
    return getPlan();
  }

  function getPlan() {
    return PLANS[planId()];
  }

  /** { status, periodEnd, portalUrl } of a paid plan, or null on the free plan: lets the Upgrade page offer “Manage subscription”. */
  function getPlanInfo() {
    return state.plan ? { status: state.plan.status, periodEnd: state.plan.periodEnd, portalUrl: state.plan.portalUrl } : null;
  }

  // ---------------------------------------------------------------------------
  // Auth actions (all handled by Supabase Auth)
  // ---------------------------------------------------------------------------
  function notConfigured() {
    return { ok: false, message: (global.FogSupabase && global.FogSupabase.configError) || 'Supabase is not available.' };
  }

  async function register(data) {
    var client = sb();
    if (!client) return notConfigured();
    var username = String(data.username || '').trim();
    var res = await client.auth.signUp({
      email: String(data.email || '').trim(),
      password: data.password,
      options: {
        data: { username: username.toLowerCase(), display_name: username },
        emailRedirectTo: global.FogSupabase.pageUrl('Pages/Auth/login.html?confirmed=1'),
      },
    });
    if (res.error) return { ok: false, message: friendlyAuthError(res.error) };
    // With email confirmation on, an already-registered email returns a user with no identities.
    if (res.data.user && Array.isArray(res.data.user.identities) && res.data.user.identities.length === 0) {
      return { ok: false, message: friendlyAuthError({ code: 'user_already_exists' }) };
    }
    if (res.data.session) {
      storageSet('sessionStorage', SESSION_FLAG, '1');
      return { ok: true, signedIn: true };
    }
    return { ok: true, needsConfirmation: true };
  }

  async function signIn(email, password, remember) {
    var client = sb();
    if (!client) return notConfigured();
    var res = await client.auth.signInWithPassword({ email: String(email || '').trim(), password: password });
    if (res.error) {
      return { ok: false, message: friendlyAuthError(res.error), unconfirmed: res.error.code === 'email_not_confirmed' || /Email not confirmed/i.test(res.error.message || '') };
    }
    storageSet('sessionStorage', SESSION_FLAG, '1');
    storageSet('localStorage', EPHEMERAL_KEY, remember === false ? '1' : null);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Google sign-in (Supabase Auth → Google provider). Nothing about Google is configured in this code: the Google
  // OAuth client is set up in Google Cloud and entered in Supabase → Authentication → Providers → Google.
  // ---------------------------------------------------------------------------
  var OAUTH_PENDING = 'fog_oauth_pending';

  /** Asks Supabase whether the Google provider is switched on: { enabled: true|false } or { enabled: null } if unknown. */
  async function googleStatus() {
    var cfg = global.FOG_SUPABASE_CONFIG;
    if (!sb() || !cfg) return { enabled: false, message: notConfigured().message };
    try {
      var res = await global.fetch(cfg.url + '/auth/v1/settings', { headers: { apikey: cfg.publishableKey } });
      if (!res.ok) return { enabled: null };
      var json = await res.json();
      return { enabled: !!(json && json.external && json.external.google) };
    } catch (e) {
      return { enabled: null, offline: true };
    }
  }

  /**
   * Sends the browser to Google and back to Pages/Auth/login.html (which then opens the dashboard).
   * next: dashboard route to open afterwards (e.g. "#characters"); remember: false = end the session with the browser.
   * Resolves { ok: true, redirecting: true } or { ok: false, message }.
   */
  async function signInWithGoogle(next, remember) {
    var client = sb();
    if (!client) return notConfigured();
    var st = await googleStatus();
    if (st.offline) return { ok: false, message: 'Can’t reach the server. Check your connection and try again.' };
    if (st.enabled === false) {
      return { ok: false, disabled: true, message: 'Google sign-in isn’t switched on for this site yet. Use your email address for now. (Site owner: enable Google in Supabase → Authentication → Providers.)' };
    }
    var back = 'Pages/Auth/login.html' + (/^#[a-z0-9_\/-]+$/i.test(next || '') ? '?next=' + encodeURIComponent(next) : '');
    storageSet('sessionStorage', SESSION_FLAG, '1'); // this tab comes back signed in
    storageSet('localStorage', EPHEMERAL_KEY, remember === false ? '1' : null);
    storageSet('sessionStorage', OAUTH_PENDING, 'google');
    var res = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: global.FogSupabase.pageUrl(back), queryParams: { prompt: 'select_account' } },
    });
    if (res.error) {
      storageSet('sessionStorage', OAUTH_PENDING, null);
      return { ok: false, message: friendlyAuthError(res.error) };
    }
    return { ok: true, redirecting: true };
  }

  /** True once after returning from a Google sign-in attempt (used to explain errors in the URL). */
  function takeOAuthPending() {
    var v = storageGet('sessionStorage', OAUTH_PENDING);
    storageSet('sessionStorage', OAUTH_PENDING, null);
    return v;
  }

  async function resendConfirmation(email) {
    var client = sb();
    if (!client) return notConfigured();
    var res = await client.auth.resend({
      type: 'signup',
      email: String(email || '').trim(),
      options: { emailRedirectTo: global.FogSupabase.pageUrl('Pages/Auth/login.html?confirmed=1') },
    });
    return res.error ? { ok: false, message: friendlyAuthError(res.error) } : { ok: true };
  }

  async function requestPasswordReset(email) {
    var client = sb();
    if (!client) return notConfigured();
    var res = await client.auth.resetPasswordForEmail(String(email || '').trim(), {
      redirectTo: global.FogSupabase.pageUrl('Pages/Auth/reset-password.html'),
    });
    return res.error ? { ok: false, message: friendlyAuthError(res.error) } : { ok: true };
  }

  async function updatePassword(password) {
    var client = sb();
    if (!client) return notConfigured();
    var res = await client.auth.updateUser({ password: password });
    return res.error ? { ok: false, message: friendlyAuthError(res.error) } : { ok: true };
  }

  async function signOut() {
    setAsideLocalData();
    storageSet('localStorage', EPHEMERAL_KEY, null);
    storageSet('sessionStorage', SESSION_FLAG, null);
    var client = sb();
    if (client) await client.auth.signOut({ scope: 'local' });
    state.session = null;
    state.user = null;
    state.profile = null;
  }

  // ---------------------------------------------------------------------------
  // Profile (public.profiles, own row only — enforced by RLS)
  // ---------------------------------------------------------------------------
  var PROFILE_COLUMNS = {
    displayName: 'display_name', username: 'username', bio: 'bio', primarySystem: 'primary_system',
    favoriteClass: 'favorite_class', alignment: 'alignment', availability: 'availability', avatarUrl: 'avatar_url',
  };

  async function saveProfile(patch) {
    var client = sb();
    if (!client || !state.user) return { ok: false, message: 'Sign in first.' };
    var row = {};
    Object.keys(patch).forEach(function (k) {
      if (!PROFILE_COLUMNS[k]) return;
      var v = patch[k];
      if (typeof v === 'string') v = v.trim();
      row[PROFILE_COLUMNS[k]] = v === '' ? null : v;
    });
    if (row.username) row.username = row.username.toLowerCase();
    var res = await client.from('profiles').update(row).eq('id', state.user.id).select('*').maybeSingle();
    if (res.error) {
      var m = res.error.message || '';
      if (res.error.code === '23505' && /username/.test(m)) return { ok: false, message: 'That username is already taken.' };
      if (res.error.code === '23514') return { ok: false, message: 'Some profile values aren’t allowed. Usernames use 3–24 lowercase letters, numbers or underscores.' };
      return { ok: false, message: friendlyAuthError(res.error) };
    }
    if (!res.data) return { ok: false, message: 'Your profile could not be found. Try signing out and in again.' };
    state.profile = profileFromRow(res.data, state.user);
    emit('fog:account');
    return { ok: true, profile: state.profile };
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(',');
    var mime = parts[0].match(/data:([^;]+)/)[1];
    var bin = atob(parts[1]);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  /** Uploads a (compressed) image to avatars/<user id>/ and returns its public URL. Older avatars are removed. */
  async function uploadAvatar(dataUrl) {
    var client = sb();
    if (!client || !state.user) return { ok: false, message: 'Sign in first.' };
    var folder = state.user.id;
    var path = folder + '/avatar-' + Date.now() + '.jpg';
    // Short CDN lifetime: each upload has a unique name, and a deleted photo should stop being served soon.
    var up = await client.storage.from('avatars').upload(path, dataUrlToBlob(dataUrl), { contentType: 'image/jpeg', upsert: false, cacheControl: '60' });
    if (up.error) return { ok: false, message: 'Could not upload the photo: ' + up.error.message };
    await removeAvatarFiles(path);
    return { ok: true, url: client.storage.from('avatars').getPublicUrl(path).data.publicUrl };
  }

  /** Deletes the user's avatar files except `keepPath`. Best effort. */
  async function removeAvatarFiles(keepPath) {
    var client = sb();
    if (!client || !state.user) return;
    var listed = await client.storage.from('avatars').list(state.user.id);
    if (listed.error || !listed.data) return;
    var old = listed.data.map(function (f) { return state.user.id + '/' + f.name; }).filter(function (p) { return p !== keepPath; });
    if (old.length) await client.storage.from('avatars').remove(old);
  }

  /** Permanently deletes the signed-in account (profile, campaigns, memberships cascade). */
  async function deleteAccount() {
    var client = sb();
    if (!client || !state.user) return { ok: false, message: 'Sign in first.' };
    await removeAvatarFiles(null);
    var res = await client.rpc('delete_own_account');
    if (res.error) return { ok: false, message: 'Could not delete the account: ' + (res.error.message || 'unknown error') };
    var id = state.user.id;
    deleteAllLocalData();
    storageSet('localStorage', LOCAL_BUNDLE_PREFIX + id, null);
    try { if (global.indexedDB) global.indexedDB.deleteDatabase('fog_music_uploads_' + id); } catch (e) { /* nothing stored */ }
    await signOut();
    return { ok: true };
  }

  /** Removes this user's data stored in this browser (campaigns, characters, settings, notifications). */
  function deleteAllLocalData() {
    LOCAL_USER_KEYS.forEach(function (k) { storageSet('localStorage', k, null); });
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  var DEFAULT_SETTINGS = {
    theme: 'dark', // 'dark' | 'light' | 'system'
    musicOn: false,
    textSize: 'medium',
    musicVolume: 65,
    sfxVolume: 80,
    fogOpacity: 40,
    dice3d: true,
    autosave: '5',
  };
  var TEXT_SIZES = { small: '90%', medium: '100%', large: '110%' };

  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {}));
  }

  function saveSettings(values) {
    var next = Object.assign(getSettings(), values);
    var res = write(KEYS.settings, next);
    if (res.ok) applySettings(next);
    return res;
  }

  var THEMES = ['dark', 'light', 'system'];
  var systemThemeQuery = null;

  function resolveTheme(theme) {
    if (theme === 'system') {
      try {
        return global.matchMedia && global.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      } catch (e) {
        return 'dark';
      }
    }
    return theme === 'light' ? 'light' : 'dark';
  }

  /** Applies theme, text size and sound settings to the page. */
  function applySettings(s) {
    s = s || getSettings();
    document.documentElement.style.fontSize = TEXT_SIZES[s.textSize] || '';
    document.documentElement.setAttribute('data-theme', resolveTheme(THEMES.indexOf(s.theme) >= 0 ? s.theme : 'dark'));
    // Follow the device setting live while 'Match my device' is chosen.
    if (!systemThemeQuery && global.matchMedia) {
      try {
        systemThemeQuery = global.matchMedia('(prefers-color-scheme: light)');
        systemThemeQuery.addEventListener('change', function () {
          if (getSettings().theme === 'system') applySettings();
        });
      } catch (e) { /* old browsers */ }
    }
    if (global.FogAudio) global.FogAudio.apply(s);
  }

  // ---------------------------------------------------------------------------
  // Notifications (events that happened in this browser)
  // ---------------------------------------------------------------------------
  function listNotifications() {
    var list = read(KEYS.notifications, []);
    return Array.isArray(list) ? list : [];
  }

  function addNotification(n) {
    var list = listNotifications();
    // A notification that came from the server carries its own id and is added only once.
    if (n.id && list.some(function (x) { return x.id === n.id; })) return;
    list.unshift({
      id: n.id || uid('n_'),
      kind: n.kind || 'info',
      title: String(n.title || ''),
      message: String(n.message || ''),
      link: n.link || null,
      createdAt: n.createdAt || new Date().toISOString(),
      read: !!n.read,
    });
    write(KEYS.notifications, list.slice(0, MAX_NOTIFICATIONS));
    emit('fog:notifications');
    if (global.FogAudio) global.FogAudio.sfx('notify');
  }

  function markNotificationRead(id) {
    var list = listNotifications();
    list.forEach(function (n) { if (!id || n.id === id) n.read = true; });
    write(KEYS.notifications, list);
    emit('fog:notifications');
  }

  function clearNotifications() {
    write(KEYS.notifications, []);
    emit('fog:notifications');
  }

  function unreadCount() {
    return listNotifications().filter(function (n) { return !n.read; }).length;
  }

  // ---------------------------------------------------------------------------
  // Helpers shared by the pages
  // ---------------------------------------------------------------------------
  function countStored(key, filter) {
    var list = read(key, []);
    if (!Array.isArray(list)) return 0;
    return filter ? list.filter(filter).length : list.length;
  }

  /** Resizes an image File and re-encodes it as a JPEG data URL small enough for localStorage / upload. */
  function compressImage(file, maxSide) {
    maxSide = maxSide || AVATAR_MAX_SIDE;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
        reject(new Error('Choose a PNG, JPG, WEBP or GIF image.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That file is not a readable image.')); };
        img.onload = function () {
          var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#100a0c';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var quality = 0.85;
          var url = canvas.toDataURL('image/jpeg', quality);
          while (url.length > AVATAR_MAX_CHARS && quality > 0.4) {
            quality -= 0.15;
            url = canvas.toDataURL('image/jpeg', quality);
          }
          if (url.length > AVATAR_MAX_CHARS) reject(new Error('That image is too large to store. Try a smaller one.'));
          else resolve(url);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isSafeImageUrl(url) {
    return typeof url === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url);
  }

  /** Avatar URLs: an uploaded image in this project's public avatars bucket (or a data URL preview). */
  function isSafeAvatarUrl(url) {
    if (isSafeImageUrl(url)) return true;
    var cfg = global.FOG_SUPABASE_CONFIG;
    return typeof url === 'string' && !!cfg && url.indexOf(cfg.url + '/storage/v1/object/public/avatars/') === 0 && !/["'<>\s]/.test(url);
  }

  function relativeTime(iso) {
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h ago';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' d ago';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Keep pages in sync when another tab changes the data.
  global.addEventListener('storage', function (e) {
    if (e.key === KEYS.notifications) emit('fog:notifications');
    if (e.key === KEYS.settings) applySettings();
  });

  applySettings();

  global.FogAccount = {
    KEYS: KEYS,
    PLANS: PLANS,
    ready: ready,
    getAccount: getAccount,
    isSignedIn: isSignedIn,
    hasStoredSession: hasStoredSession,
    register: register,
    signIn: signIn,
    signInWithGoogle: signInWithGoogle,
    googleStatus: googleStatus,
    takeOAuthPending: takeOAuthPending,
    signOut: signOut,
    resendConfirmation: resendConfirmation,
    requestPasswordReset: requestPasswordReset,
    updatePassword: updatePassword,
    saveProfile: saveProfile,
    uploadAvatar: uploadAvatar,
    removeAvatarFiles: removeAvatarFiles,
    deleteAccount: deleteAccount,
    getPlan: getPlan,
    getPlanInfo: getPlanInfo,
    refreshPlan: refreshPlan,
    deleteAllLocalData: deleteAllLocalData,
    countStored: countStored,
    compressImage: compressImage,
    escapeHtml: escapeHtml,
    isSafeImageUrl: isSafeImageUrl,
    isSafeAvatarUrl: isSafeAvatarUrl,
    relativeTime: relativeTime,
    friendlyAuthError: friendlyAuthError,
  };
  global.FogSettings = { get: getSettings, save: saveSettings, apply: applySettings, TEXT_SIZES: TEXT_SIZES };
  global.FogNotifications = {
    list: listNotifications,
    add: addNotification,
    markRead: markNotificationRead,
    clear: clearNotifications,
    unreadCount: unreadCount,
  };
})(window);
