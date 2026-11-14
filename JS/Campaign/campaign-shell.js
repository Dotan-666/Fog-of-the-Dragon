/**
 * Campaign workspace shell (Pages/campaign.html): sign-in guard, campaign loading, header, navigation, live updates.
 *
 * The campaign is identified by the address: campaign.html?c=<campaign id>. Before anything is shown the shell asks
 * the database for that campaign; Row Level Security answers only for the DM and active members, so another
 * campaign's id (typed into the address by hand) gives “not found” and loads nothing. The shell then builds `ctx`, the
 * one object every section page receives:
 *
 *   ctx.id          campaign id (fixed for the life of the page)
 *   ctx.campaign    the campaign with its roster (FogCampaignStore.get shape); replaced by ctx.reload()
 *   ctx.isDm        true for the Dungeon Master
 *   ctx.me          { id, name }
 *   ctx.reload()    reloads the campaign and redraws the header and navigation; resolves the new campaign (or null)
 *   ctx.on(name, fn) / ctx.emit(name, data)   small event bus: 'message', 'message-deleted', 'meeting', 'combat', 'reveal', 'campaign'
 *   ctx.go(section, rest)                     navigate inside the workspace
 *   ctx.goBack(section, rest, label)          navigate and show "← Back to <label>" there (FogCampaignReturn / FogNav)
 *   ctx.refLink(section, rest, label)         an in-app href (same tab) to referenced content, with the way back
 *   ctx.refHref(section, rest, label)         the same as a full URL, for an OPTIONAL "open in a new tab"
 *   ctx.dashboardUrl(hash)                    link to a Dashboard page (characters, adventures, …)
 *   ctx.esc(text)                             HTML escape
 *   ctx.meeting                               the Meeting in the Fog call session (one per page; survives section changes)
 *   ctx.meetingUI                             its panel / dock: ctx.meetingUI.open()
 */
(function (global) {
  'use strict';

  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var STATUS = { archived: 'Archived', started: 'In progress', recruiting: 'Gathering party' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** roster = active members only (so every count is right); campaign.invited = people who were invited but haven't joined. */
  function normalize(c) {
    c.invited = c.roster.filter(function (m) { return m.status !== 'active'; });
    c.roster = c.roster.filter(function (m) { return m.status === 'active'; });
    return c;
  }

  function statusOf(c) { return c.status === 'archived' ? 'archived' : c.phase === 'started' ? 'started' : 'recruiting'; }

  function goToLogin(reason) {
    var id = new URLSearchParams(global.location.search).get('c') || '';
    var section = (global.location.hash || '').replace(/^#/, '').split('/')[0].replace(/[^a-z-]/gi, '');
    var next = UUID.test(id) ? '#campaign/' + id + (section ? '/' + section : '') : '#campaigns';
    global.location.replace('Auth/login.html?next=' + encodeURIComponent(next) + (reason ? '&reason=' + reason : ''));
  }

  /** Full-screen message instead of the workspace (no campaign, no access, no database…). */
  function blocked(title, message) {
    $('cw-name').textContent = title;
    $('dashboardSidebar').hidden = true;
    var main = $('campaign-content');
    main.innerHTML = '<div class="cw-page"><div class="cw-empty cw-empty-lg"><h2>' + esc(title) + '</h2><p>' + esc(message) + '</p>' +
      '<a class="btn btn-primary" href="dashboard.html#campaigns">Back to the Dashboard</a></div></div>';
    document.title = title + ' — Fog of the Dragon';
  }

  /** The Dashboard sidebar's markup for one item (dragon animation layer, icon, label), pointing at a campaign section. */
  function navItem(key, r, active, badge) {
    var dragon = '<div class="fod-dragon-layer"><img src="../Assets/Pictures/fog-dragon-frames/start.png" class="fod-dragon-frame fod-dragon-idle" alt="" />' +
      '<video class="fod-dragon-video" muted playsinline preload="auto"><source src="../Assets/Videos/dragonV.mp4" type="video/mp4"></video>' +
      '<img src="../Assets/Pictures/fog-dragon-frames/end.png" class="fod-dragon-frame fod-dragon-final" alt="" /><div class="fod-dragon-mask"></div></div>';
    return '<a href="#' + key + '" class="fod-nav-item fod-dragon-nav' + (active ? ' nav-item-active' : '') + '" data-cw-section="' + key + '"' + (active ? ' aria-current="page"' : '') + '>' +
      dragon + r.icon.replace('<svg ', '<svg class="icon nav-icon" ') + '<span class="fod-nav-label">' + esc(r.label) + '</span>' + badge + '</a>';
  }

  function buildNav(ctx, unread) {
    var routes = global.FogCampaignRoutes;
    var nav = $('cw-nav');
    var active = global.FogCampaignRouter.parseHash().name;
    var groups = (global.FogCampaignNavGroups || []).map(function (g) {
      var items = Object.keys(routes).filter(function (k) {
        var r = routes[k];
        return r.group === g && (r.access !== 'dm' || ctx.isDm);
      });
      if (!items.length) return '';
      return '<div class="nav-group"><span class="nav-group-title">' + esc(g.toUpperCase()) + '</span>' + items.map(function (k) {
        var badge = k === 'feed' && unread > 0 ? '<span class="cw-badge" aria-label="' + unread + ' new messages">' + (unread > 9 ? '9+' : unread) + '</span>' : '';
        return navItem(k, routes[k], k === active, badge);
      }).join('') + '</div>';
    }).filter(Boolean);
    nav.innerHTML = groups.join('<div class="nav-separator"></div>');
    // The Dashboard's dragon hover animation, on the freshly drawn items.
    if (typeof FogDragonNavController === 'function') new FogDragonNavController();
  }

  function drawHeader(ctx) {
    var c = ctx.campaign;
    $('cw-name').textContent = c.name;
    document.title = c.name + ' — Fog of the Dragon';
    var st = $('cw-status');
    st.hidden = false;
    st.textContent = STATUS[statusOf(c)];
    st.className = 'cw-pill cw-pill-' + statusOf(c);
    var role = $('cw-role');
    role.hidden = false;
    role.textContent = ctx.isDm ? 'Dungeon Master' : 'Player';
    $('cw-settings-btn').hidden = false;
  }

  /** Header user menu, notification bell and mobile drawer: the Dashboard's own markup, so only the content differs. */
  function wireShell() {
    var acc = global.FogAccount.getAccount();
    var plan = global.FogAccount.getPlan(acc);
    $('user-name').textContent = (acc.profile && (acc.profile.displayName || acc.profile.email)) || 'Adventurer';
    $('user-plan').textContent = plan.name + ' plan';
    $('user-email').textContent = (acc.profile && acc.profile.email) || '';
    $('user-avatar').src = global.FogAccount.isSafeAvatarUrl(acc.profile.avatarUrl) ? acc.profile.avatarUrl : '../Assets/Pictures/FOD.jpg';
    var trigger = $('userMenuTrigger');
    var dd = $('userDropdown');
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!open));
      dd.classList.toggle('is-active', !open);
    });
    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target) && !trigger.contains(e.target)) { trigger.setAttribute('aria-expanded', 'false'); dd.classList.remove('is-active'); }
    });
    $('logoutLink').addEventListener('click', function (e) {
      e.preventDefault();
      global.FogAccount.signOut().then(function () { global.location.replace('Auth/login.html?reason=signed-out'); });
    });
    var side = $('dashboardSidebar');
    var backdrop = $('sidebarBackdrop');
    function toggle(open) {
      var o = typeof open === 'boolean' ? open : !side.classList.contains('is-open');
      side.classList.toggle('is-open', o);
      backdrop.classList.toggle('is-active', o);
    }
    $('mobileMenuToggle').addEventListener('click', function () { toggle(); });
    backdrop.addEventListener('click', function () { toggle(false); });
    $('cw-nav').addEventListener('click', function (e) {
      var a = e.target.closest('a[data-cw-section]');
      if (!a) return;
      if (global.innerWidth <= 992) toggle(false);
      if (global.location.hash === '#' + a.getAttribute('data-cw-section')) { e.preventDefault(); global.FogCampaignRouter.reload(); }
    });
    if (typeof global.initNotifications === 'function') global.initNotifications();
    if (global.FogCampaignNotifications) { global.FogCampaignNotifications.sync(); global.FogCampaignNotifications.watch(); }
  }

  async function boot() {
    var auth = global.FogAccount ? await global.FogAccount.ready() : { session: null };
    if (!auth.session) { goToLogin(); return; }
    document.documentElement.classList.remove('fog-auth-pending');

    var loggingOut = false;
    global.addEventListener('fog:auth', function (e) {
      if (e.detail && e.detail.event === 'SIGNED_OUT' && !loggingOut) goToLogin('expired');
    });
    global.addEventListener('pageshow', function (e) {
      if (e.persisted && global.FogAccount && !global.FogAccount.hasStoredSession()) goToLogin();
    });

    var id = new URLSearchParams(global.location.search).get('c');
    if (!id || !UUID.test(id)) {
      blocked('No campaign selected', 'Open a campaign from the Campaigns page of the Dashboard.');
      return;
    }

    // Everything the shell and the sections need to talk to the database for this campaign.
    await global.FogCampaignRouter.loadScripts(['Dashboard/campaign-store.js', 'Campaign/campaign-data.js', 'fog-nav.js', 'Campaign/campaign-return.js']);
    var first = await global.FogCampaignStore.get(id);
    if (!first.ok) {
      blocked(first.notFound ? 'Campaign not found' : 'Could not open the campaign', first.message);
      return;
    }
    var acc = global.FogAccount.getAccount();
    var mine = first.campaign.roster.find(function (m) { return m.isMe && m.status === 'active'; });
    normalize(first.campaign);
    if (!mine) {
      blocked('Campaign not found', 'This campaign doesn’t exist, or you aren’t part of it yet. Join with the invite code from the Campaigns page.');
      return;
    }

    var handlers = Object.create(null);
    var unread = 0;
    var ctx = {
      id: id,
      campaign: first.campaign,
      isDm: first.campaign.role === 'dm',
      me: { id: acc.id, name: (acc.profile && (acc.profile.displayName || acc.profile.email)) || 'You' },
      esc: esc,
      on: function (name, fn) {
        (handlers[name] = handlers[name] || []).push(fn);
        return function () { handlers[name] = (handlers[name] || []).filter(function (f) { return f !== fn; }); };
      },
      emit: function (name, data) {
        (handlers[name] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } });
      },
      go: function (section, rest) { global.FogCampaignRouter.navigateTo(section, rest); },
      goBack: function (section, rest, label) { if (global.FogCampaignReturn) global.FogCampaignReturn.go(section, rest, label); else global.FogCampaignRouter.navigateTo(section, rest); },
      refLink: function (section, rest, label) { return global.FogCampaignReturn ? global.FogCampaignReturn.link(section, rest, label) : global.FogCampaignRouter.hrefFor(section, rest); },
      refHref: function (section, rest, label) { return global.FogCampaignReturn ? global.FogCampaignReturn.href(section, rest, label) : global.FogCampaignRouter.hrefFor(section, rest); },
      dashboardUrl: function (hash) { return 'dashboard.html' + (hash || '#campaigns'); },
      reload: async function () {
        var res = await global.FogCampaignStore.get(id);
        if (!res.ok) {
          if (res.notFound) { blocked('Campaign not found', res.message); return null; }
          return ctx.campaign; // keep what we have; the caller shows its own error
        }
        ctx.campaign = normalize(res.campaign);
        ctx.isDm = res.campaign.role === 'dm';
        drawHeader(ctx);
        buildNav(ctx, unread);
        ctx.emit('campaign', ctx.campaign);
        return ctx.campaign;
      },
    };

    wireShell();
    drawHeader(ctx);
    buildNav(ctx, 0);
    global.FogCampaignRouter.onRoute(function (name) {
      if (name === 'feed') unread = 0;
      buildNav(ctx, unread);
    });

    // Live updates (Supabase Realtime). Pages listen through ctx.on(...). The Feed badge counts messages from others.
    var stop = global.FogCampaignData.subscribe(id, {
      onMessage: function (m) {
        if (m.authorId !== ctx.me.id && global.FogCampaignRouter.parseHash().name !== 'feed') { unread += 1; buildNav(ctx, unread); }
        ctx.emit('message', m);
      },
      onMessageDeleted: function (mid) { ctx.emit('message-deleted', mid); },
      onMeeting: function () { ctx.emit('meeting'); },
      onCombat: function () { ctx.emit('combat'); },
      onReveal: function () { ctx.emit('reveal'); },
      onSchedule: function () { ctx.emit('schedule'); },
      onCombatRequest: function (r) { ctx.emit('combat-request', r); },
      onSession: function () { ctx.emit('session'); },
      onMap: function (m) { ctx.emit('map', m); },
      onRoom: function (room) { if (room && ctx.meeting) ctx.meeting.roomChanged(room); ctx.emit('meeting-room', room); },
      onMemory: function () { ctx.emit('memory'); },
      onStatus: function (s) { ctx.realtime = s; ctx.emit('realtime', s); },
    });
    global.addEventListener('pagehide', stop);

    // Meeting in the Fog: the call lives here, at shell level, so moving between sections never drops it.
    try {
      await global.FogCampaignRouter.loadScripts(['Campaign/meeting/fog-media.js', 'Campaign/meeting/shared-audio.js', 'Campaign/meeting/meeting-session.js', 'Campaign/meeting/meeting-ui.js', 'Campaign/meeting/meeting-card.js']);
      ctx.meeting = global.FogMeetingSession.create(ctx, { provider: global.FogMeetingProvider || 'livekit' });
      ctx.meetingUI = global.FogMeetingUI.mount(ctx, ctx.meeting);
      global.addEventListener('pagehide', function () { ctx.meeting.destroy(); });
    } catch (e) {
      console.error('Meeting in the Fog could not start', e); // the rest of the workspace keeps working
      ctx.meeting = null;
    }

    if (global.FogCampaignReturn) global.FogCampaignRouter.onRendered(function (route) { global.FogCampaignReturn.update(route); });
    global.FogCampaign = ctx;
    await global.FogCampaignRouter.init(ctx, $('campaign-content'));
  }

  function start() {
    boot().catch(function (err) {
      console.error('Campaign workspace failed to start', err);
      document.documentElement.classList.remove('fog-auth-pending');
      blocked('Could not open the campaign', 'Something went wrong while starting the workspace. Reload the page to try again.');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
