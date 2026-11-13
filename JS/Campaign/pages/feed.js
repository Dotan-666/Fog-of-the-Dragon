/**
 * Feed: the campaign's message board. Messages live in public.campaign_messages; only the DM and active members can
 * read or write them (Row Level Security). New messages from other members arrive through Supabase Realtime when it is
 * enabled for the project; otherwise the page says so and offers a Refresh button. Nothing here is simulated.
 * At the top: the Meeting in the Fog card (JS/Campaign/meeting/meeting-card.js); the call itself lives in the shell.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  var MAX = 2000;

  function esc(s) { return UI().esc(s); }

  function dayLabel(iso) {
    var d = new Date(iso);
    var today = new Date();
    var yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  function timeLabel(iso) { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }

  function render(root, ctx) {
    var alive = true;
    var messages = []; // oldest first
    var hasMore = false;
    var loadingOlder = false;
    var campaignId = ctx.id;
    var archived = ctx.campaign.status === 'archived';

    root.innerHTML =
      '<div class="cw-page cw-feed"><header class="cw-page-head"><div><h2 class="cw-page-title">Feed</h2>' +
      '<p class="cw-page-sub">Messages between the Dungeon Master and the party. Only people in this campaign can read them.</p></div>' +
      '<p class="cw-live" id="fd-live" hidden></p></header>' +
      '<section class="cw-card mf-card" id="fd-fog" aria-labelledby="fd-fog-h" aria-live="polite"><p class="cw-loading">Loading Meeting in the Fog…</p></section>' +
      '<section class="cw-card cw-chat"><div class="cw-chat-scroll" id="fd-scroll" tabindex="0" aria-label="Messages" role="log" aria-live="polite"><div id="fd-list"></div></div>' +
      '<form class="cw-composer" id="fd-form" novalidate>' +
      '<label class="cw-visually-hidden" for="fd-input">Write a message</label>' +
      '<textarea id="fd-input" class="form-control" rows="2" maxlength="' + MAX + '" placeholder="' + (archived ? 'This campaign is archived: the feed is read-only.' : 'Write a message… (Enter sends, Shift+Enter adds a line)') + '"' + (archived ? ' disabled' : '') + '></textarea>' +
      '<div class="cw-composer-row"><span class="cw-muted" id="fd-count">0 / ' + MAX + '</span><button type="submit" class="btn btn-primary btn-sm" id="fd-send"' + (archived ? ' disabled' : '') + '>Send</button></div>' +
      '</form></section></div>';

    var scroll = root.querySelector('#fd-scroll');
    var list = root.querySelector('#fd-list');
    var form = root.querySelector('#fd-form');
    var input = root.querySelector('#fd-input');
    var send = root.querySelector('#fd-send');
    var live = root.querySelector('#fd-live');

    function author(id) {
      var m = ctx.campaign.roster.find(function (x) { return x.userId === id; });
      return m || { displayName: 'Former member', role: 'player', avatarUrl: null, userId: id };
    }

    function draw(keepScroll) {
      var nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
      var prevHeight = scroll.scrollHeight;
      var html = '';
      if (hasMore) html += '<div class="cw-chat-more"><button type="button" class="btn btn-secondary btn-sm" data-fd="older"' + (loadingOlder ? ' disabled' : '') + '>' + (loadingOlder ? 'Loading…' : 'Load earlier messages') + '</button></div>';
      if (!messages.length) {
        html += '<div class="cw-empty"><p><strong>No messages yet.</strong></p><p class="cw-muted">Say hello to the party: the first message starts the campaign’s feed.</p></div>';
      }
      var lastDay = '';
      var lastAuthor = null;
      var lastAt = 0;
      messages.forEach(function (m) {
        var day = new Date(m.createdAt).toDateString();
        if (day !== lastDay) {
          html += '<div class="cw-day" role="separator"><span>' + esc(dayLabel(m.createdAt)) + '</span></div>';
          lastDay = day;
          lastAuthor = null;
        }
        var a = author(m.authorId);
        var mine = m.authorId === ctx.me.id;
        var grouped = lastAuthor === m.authorId && new Date(m.createdAt).getTime() - lastAt < 5 * 60000;
        var canDelete = !archived && (mine || ctx.isDm);
        html += '<article class="cw-msg' + (mine ? ' is-mine' : '') + (grouped ? ' is-grouped' : '') + '" data-id="' + esc(m.id) + '">' +
          (grouped ? '<span class="cw-msg-gutter"></span>' : global.FogCampaignParty.avatarHtml(a, 'cw-avatar')) +
          '<div class="cw-msg-main">' + (grouped ? '' : '<header class="cw-msg-head"><strong>' + esc(a.displayName) + (mine ? ' (you)' : '') + '</strong>' +
            (a.role === 'owner' ? '<span class="cw-pill cw-pill-role">DM</span>' : '') + '<time datetime="' + esc(m.createdAt) + '">' + esc(timeLabel(m.createdAt)) + '</time></header>') +
          '<p class="cw-msg-body">' + esc(m.body) + '</p></div>' +
          (canDelete ? '<button type="button" class="cw-icon-btn" data-fd="delete" data-id="' + esc(m.id) + '" aria-label="Delete this message" title="Delete">✕</button>' : '') + '</article>';
        lastAuthor = m.authorId;
        lastAt = new Date(m.createdAt).getTime();
      });
      list.innerHTML = html;
      if (keepScroll === 'older') scroll.scrollTop = scroll.scrollHeight - prevHeight;
      else if (keepScroll === 'bottom' || nearBottom) scroll.scrollTop = scroll.scrollHeight;
    }

    function add(m) {
      if (messages.some(function (x) { return x.id === m.id; })) return;
      messages.push(m);
      messages.sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
    }

    async function loadFirst() {
      list.innerHTML = '<p class="cw-loading" role="status">Loading messages…</p>';
      var res = await D().listMessages(campaignId);
      if (!alive) return;
      if (!res.ok) {
        list.innerHTML = '<div class="cw-empty"><p>' + esc(res.message) + '</p><button type="button" class="btn btn-secondary btn-sm" data-fd="retry">Try again</button></div>';
        return;
      }
      messages = res.messages;
      hasMore = res.hasMore;
      draw('bottom');
    }

    async function loadOlder() {
      if (loadingOlder || !messages.length) return;
      loadingOlder = true;
      draw();
      var res = await D().listMessages(campaignId, messages[0].createdAt);
      loadingOlder = false;
      if (!alive) return;
      if (!res.ok) { UI().notice(res.message, 'error'); draw(); return; }
      res.messages.forEach(add);
      hasMore = res.hasMore;
      draw('older');
    }

    function setLive(status) {
      if (status === 'SUBSCRIBED') { live.hidden = false; live.textContent = '● Live: new messages appear as they are sent.'; live.className = 'cw-live is-on'; }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        live.hidden = false;
        live.className = 'cw-live';
        live.innerHTML = 'Live updates are not connected. <button type="button" class="cw-link-btn" data-fd="retry">Refresh</button>';
      }
    }

    root.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-fd]');
      if (!b) return;
      var a = b.getAttribute('data-fd');
      if (a === 'older') loadOlder();
      else if (a === 'retry') loadFirst();
      else if (a === 'delete') {
        var ok = await UI().confirm({ title: 'Delete this message?', message: 'It disappears for everyone in the campaign.', confirmLabel: 'Delete', danger: true });
        if (!ok || !alive) return;
        var res = await D().deleteMessage(b.getAttribute('data-id'));
        if (!res.ok) { UI().notice(res.message, 'error'); return; }
        messages = messages.filter(function (m) { return m.id !== b.getAttribute('data-id'); });
        draw();
      }
    });

    input.addEventListener('input', function () { root.querySelector('#fd-count').textContent = input.value.length + ' / ' + MAX; });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || send.disabled) return;
      send.disabled = true;
      var res = await D().sendMessage(campaignId, text);
      send.disabled = archived;
      if (!alive) return;
      if (!res.ok) { UI().notice(res.message, 'error'); return; }
      input.value = '';
      root.querySelector('#fd-count').textContent = '0 / ' + MAX;
      add(res.message);
      draw('bottom');
      input.focus();
    });

    var offs = [
      ctx.on('message', function (m) { add(m); draw(); }),
      ctx.on('message-deleted', function (id) { messages = messages.filter(function (m) { return m.id !== id; }); draw(); }),
      ctx.on('realtime', setLive),
      ctx.on('campaign', function () { /* roster changes: names are looked up on draw */ draw(); }),
    ];
    if (ctx.realtime) setLive(ctx.realtime);
    var fogOff = global.FogMeetingCard ? global.FogMeetingCard.mount(root.querySelector('#fd-fog'), ctx) : function () {};
    if (!global.FogMeetingCard) root.querySelector('#fd-fog').hidden = true;

    return loadFirst().then(function () {
      return function cleanup() {
        alive = false;
        offs.forEach(function (off) { off(); });
        fogOff();
      };
    });
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.feed = { render: render };
})(window);
