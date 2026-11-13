/**
 * Test-only stand-ins for the signed-in account and the Supabase-backed campaign store, used by
 * tests/ui/characters-harness.html?mock=campaign. The in-memory store follows the same rules as the
 * database functions (seats, who may set characters, start conditions) so the campaign page can be
 * exercised as the DM and as a player without a live server. Switch user with window.__mockAs('dm' | 'p1' | 'p2').
 */
(function (global) {
  'use strict';

  var USERS = {
    dm: { id: 'u-dm', name: 'Morgan (DM)' },
    p1: { id: 'u-p1', name: 'Riley' },
    p2: { id: 'u-p2', name: 'Sam' },
  };
  var who = 'dm';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  global.FogAccount = {
    escapeHtml: esc,
    getAccount: function () { return { id: USERS[who].id, profile: { displayName: USERS[who].name } }; },
    getPlan: function () { return { id: 'warlord', name: 'Warlord', activeCampaigns: 1, maxPeople: 5 }; },
    isSafeAvatarUrl: function () { return false; },
    isSafeImageUrl: function (u) { return typeof u === 'string' && /^data:image\//.test(u); },
    compressImage: function () { return Promise.reject(new Error('Not available in the test harness.')); },
  };
  var notes = [];
  global.FogNotifications = { add: function (n) { notes.push(n); }, list: function () { return notes; } };
  // Settings stub (stored in localStorage like the real one) so the Settings page can be shown in the harness.
  var SETTINGS_DEFAULTS = { theme: 'dark', musicOn: false, textSize: 'medium', musicVolume: 65, sfxVolume: 80, fogOpacity: 40, dice3d: true, autosave: '5' };
  global.FogSettings = {
    TEXT_SIZES: { small: '14px', medium: '', large: '18px' },
    get: function () { try { return Object.assign({}, SETTINGS_DEFAULTS, JSON.parse(localStorage.getItem('fog_settings_v1') || '{}')); } catch (e) { return Object.assign({}, SETTINGS_DEFAULTS); } },
    save: function (s) { localStorage.setItem('fog_settings_v1', JSON.stringify(s)); return { ok: true }; },
    apply: function (s) { s = s || this.get(); document.documentElement.setAttribute('data-theme', s.theme === 'light' ? 'light' : 'dark'); },
  };

  var campaign = {
    id: 'cmp-test', ownerId: USERS.dm.id, name: 'The Ashen Crown', description: 'A test campaign.', status: 'active', phase: 'recruiting',
    source: 'homebrew', startingLevel: 3, requiredPlayers: 3, privacy: 'private', inviteCode: 'FOD-1234-AB', coverUrl: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: null, startedAt: null,
  };
  var created = [];
  var members = [{ userId: USERS.dm.id, role: 'owner', character: null, characterName: null, characterBuiltBy: null }];

  function view() {
    var me = USERS[who].id;
    var mine = members.some(function (m) { return m.userId === me; });
    if (!mine) return null;
    var c = JSON.parse(JSON.stringify(campaign));
    c.role = campaign.ownerId === me ? 'dm' : 'player';
    c.memberCount = members.length;
    c.roster = members.map(function (m) {
      var u = Object.values(USERS).find(function (x) { return x.id === m.userId; });
      return {
        userId: m.userId, role: m.role, status: 'active', isMe: m.userId === me, displayName: u.name, avatarUrl: null,
        character: m.character, characterName: m.characterName, characterBuiltBy: m.characterBuiltBy,
      };
    });
    return c;
  }

  function ok(x) { return Promise.resolve(Object.assign({ ok: true }, x || {})); }
  function no(msg) { return Promise.resolve({ ok: false, message: msg }); }

  global.FogCampaignStore = {
    plan: function () { return global.FogAccount.getPlan(); },
    isSafeCoverUrl: function () { return false; },
    compressCover: function () { return Promise.reject(new Error('Not available in the test harness.')); },
    get: function () { var c = view(); return c ? ok({ campaign: c }) : no('Not a member.'); },
    list: function () { var c = view(); return ok({ campaigns: c ? [c] : [] }); },
    PLAYER_CAMPAIGN_LIMIT: 3,
    join: function (code) {
      var me = USERS[who].id;
      if (code !== campaign.inviteCode) return no('No campaign has that invite code.');
      if (members.some(function (m) { return m.userId === me; })) return ok({ id: campaign.id });
      if (campaign.phase !== 'recruiting') return no('This campaign has already started.');
      if (members.length >= campaign.requiredPlayers) return no('This campaign is full.');
      members.push({ userId: me, role: 'player', character: null, characterName: null, characterBuiltBy: null });
      return ok({ id: campaign.id });
    },
    setCharacter: function (id, userId, doc) {
      var me = USERS[who].id;
      var m = members.find(function (x) { return x.userId === userId && x.role === 'player'; });
      if (!m) return no('That player isn’t in this campaign.');
      if (!(me === userId || me === campaign.ownerId)) return no('Only the player or the Dungeon Master can set this character.');
      if (campaign.phase !== 'recruiting') return no('Characters can only be changed before the campaign starts.');
      m.character = JSON.parse(JSON.stringify(global.FogCampaignStore.snapshot(doc)));
      m.characterName = doc.narrative.name;
      m.characterBuiltBy = me === campaign.ownerId ? 'dm' : 'player';
      return ok();
    },
    snapshot: function (doc) { return { schemaVersion: doc.schemaVersion, sourceCharacterId: doc.id, choices: doc.choices, narrative: doc.narrative }; },
    clearCharacter: function (id, userId) {
      var m = members.find(function (x) { return x.userId === userId; });
      if (m) { m.character = null; m.characterName = null; m.characterBuiltBy = null; }
      return ok();
    },
    removeMember: function (id, userId) {
      if (campaign.phase === 'started') return no('That isn’t possible once the campaign has started.');
      members = members.filter(function (m) { return m.userId !== userId || m.role === 'owner'; });
      return ok();
    },
    start: function () {
      if (USERS[who].id !== campaign.ownerId) return no('Only the Dungeon Master can start this campaign.');
      if (!campaign.adventureId) return no('Choose the adventure this campaign runs before starting it.');
      if (members.length < campaign.requiredPlayers) return no('Waiting for players: ' + members.length + ' of ' + campaign.requiredPlayers + ' people have joined.');
      var missing = members.filter(function (m) { return m.role === 'player' && !m.character; }).length;
      if (missing) return no(missing + ' player(s) still need a character.');
      campaign.phase = 'started';
      campaign.startedAt = new Date().toISOString();
      return ok();
    },
    update: function () { return ok(); },
    // Create Campaign page: same checks as the database (an adventure is required)
    plan: function () { return global.FogAccount.getPlan(); },
    canActivateAnother: function () { return Promise.resolve(true); },
    compressCover: function () { return Promise.reject(new Error('Not available in the test harness.')); },
    create: function (data) {
      if (!data.name || !String(data.name).trim()) return no('Give your campaign a name.');
      if (!data.adventureId) return no('Choose the adventure this campaign runs.');
      created.push(JSON.parse(JSON.stringify(data)));
      return Promise.resolve({ ok: true, campaign: { id: 'cmp-new-' + created.length, inviteCode: 'FOD-0000-NE' } });
    },
    setAdventure: function (id, adventureId) {
      if (USERS[who].id !== campaign.ownerId) return no('Only the Dungeon Master can do that.');
      if (!adventureId) return no('A campaign needs an adventure. Choose another adventure instead of removing it.');
      campaign.adventureId = adventureId;
      return ok();
    },
    archive: function () { return ok(); },
    restore: function () { return ok(); },
    remove: function () { return ok(); },
  };

  global.__mockAs = function (name) { who = name; };
  global.__mockState = function () { return { campaign: campaign, members: members, notes: notes, created: created }; };
})(window);
