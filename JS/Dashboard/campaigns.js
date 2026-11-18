/**
 * Campaigns page init (runs each time the router loads campaigns.html).
 * Campaigns you run and campaigns you joined, the archive and the plan quota come from FogCampaignStore (Supabase).
 */
(function (global) {
  'use strict';

  const ICONS = {
    layers: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
    dots: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>',
    edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    archive: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    party: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M17 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path><path d="M21 21v-2a4 4 0 0 0-3-3.85"></path><path d="M11 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0z"></path><path d="M3 21v-2a4 4 0 0 1 5-3.87"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    archiveRow: '<svg class="icon text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>',
  };

  function esc(s) {
    return global.FogAccount.escapeHtml(s);
  }

  /** Address of a campaign's own workspace (Pages/campaign.html). The campaign id is in the address, so it survives a refresh. */
  function campaignUrl(id, section) {
    return 'campaign.html?c=' + encodeURIComponent(id) + '#' + section;
  }

  function dmName() {
    const acc = global.FogAccount.getAccount();
    return (acc && (acc.profile.displayName || acc.profile.email)) || 'You';
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }

  function artwork(c) {
    if (global.FogCampaignStore.isSafeCoverUrl(c.coverUrl)) {
      return `<img src="${c.coverUrl}" alt="" class="campaign-artwork-img">`;
    }
    const initial = (String(c.name || '').trim().replace(/^(the|a|an)\s+/i, '').charAt(0) || '?').toUpperCase();
    return `<div class="campaign-artwork-fallback" style="display: flex;" aria-hidden="true"><span class="fallback-title">${esc(initial)}</span></div>`;
  }

  function phaseLabel(c) {
    return c.phase === 'started' ? 'In progress' : 'Gathering party';
  }

  function renderCard(c) {
    const id = esc(c.id);
    const isDm = c.role === 'dm';
    return `
      <article class="campaign-card" data-id="${id}">
        <div class="campaign-artwork-wrap">
          ${artwork(c)}
          <span class="campaign-status-badge">${isDm ? 'DM' : 'Player'} · ${phaseLabel(c)}</span>
          ${isDm ? `<div class="campaign-card-menu">
            <button class="btn-card-menu-trigger" aria-label="Options for ${esc(c.name)}">${ICONS.dots}</button>
            <div class="card-dropdown-menu">
              <button class="dropdown-item" data-action="settings" data-id="${id}">${ICONS.edit}<span>Campaign Settings</span></button>
              <button class="dropdown-item" data-action="archive" data-id="${id}">${ICONS.archive}<span>Archive</span></button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item item-danger" data-action="delete" data-id="${id}">${ICONS.trash}<span>Delete</span></button>
            </div>
          </div>` : ''}
        </div>
        <div class="campaign-card-body">
          <h3 class="campaign-card-title">${esc(c.name)}</h3>
          <div class="campaign-card-meta">
            <div class="meta-row">${ICONS.user}<span>${isDm ? `DM: <strong class="meta-highlight">${esc(dmName())} (you)</strong>` : 'You are a <strong class="meta-highlight">player</strong>'}</span></div>
            <div class="meta-row">${ICONS.party}<span>${c.memberCount} / ${c.requiredPlayers} people joined (incl. DM) · ${c.playersWithCharacters || 0} character${c.playersWithCharacters === 1 ? "" : "s"} ready</span></div>
            <div class="meta-row">${ICONS.calendar}<span>Starting level <span class="meta-highlight">${c.startingLevel}</span></span></div>
          </div>
          <div class="campaign-card-footer">
            <button class="btn btn-primary btn-block" data-action="open" data-id="${id}">Open Campaign</button>
          </div>
        </div>
      </article>`;
  }

  function renderArchivedRow(c) {
    return `
      <article class="archived-row" data-id="${esc(c.id)}">
        <div class="archived-info">
          ${ICONS.archiveRow}
          <div>
            <h4 class="archived-title">${esc(c.name)}</h4>
            <div class="archived-meta-inline">
              <span>${c.role === 'dm' ? 'DM: ' + esc(dmName()) : 'Player'}</span>
              <span>•</span>
              <span>${c.requiredPlayers} ${c.requiredPlayers === 1 ? 'Person' : 'People'}</span>
              <span>•</span>
              <span>Archived ${esc(formatDate(c.archivedAt))}</span>
            </div>
          </div>
        </div>
        <div class="archived-actions">
          <button class="btn btn-ghost-dark btn-sm" data-action="open" data-id="${esc(c.id)}">View Archive</button>
        </div>
      </article>`;
  }

  const SORTS = {
    recent: (a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
    name: (a, b) => a.name.localeCompare(b.name),
    players: (a, b) => b.requiredPlayers - a.requiredPlayers || a.name.localeCompare(b.name),
  };

  function init(container) {
    const store = global.FogCampaignStore;
    const router = global.FogDashboardRouter;
    const grid = container.querySelector('#active-campaigns-grid');
    const activeSection = container.querySelector('#active-campaigns-section');
    const empty = container.querySelector('#campaigns-empty-state');
    const archivedSection = container.querySelector('#archived-campaigns-section');
    const archivedList = container.querySelector('#archived-campaigns-list');
    const sort = container.querySelector('#campaign-sort-select');
    const pageMessage = container.querySelector('#campaigns-page-message');
    const modal = container.querySelector('#join-campaign-modal');
    const codeInput = container.querySelector('#campaign-code-input');
    const joinStatus = container.querySelector('#join-campaign-status');

    function showMessage(text) {
      pageMessage.textContent = text;
      pageMessage.hidden = !text;
    }

    let campaigns = [];
    let alive = true;

    function renderQuota() {
      const plan = store.plan();
      const active = campaigns.filter((c) => c.role === 'dm' && c.status === 'active').length;
      const limit = plan.activeCampaigns;
      const finite = Number.isFinite(limit);
      container.querySelector('#campaign-quota-badge').textContent = finite ? `${active} / ${limit} Active` : `${active} Active`;
      const left = finite ? Math.max(0, limit - active) : Infinity;
      container.querySelector('#campaign-quota-description').textContent = !finite
        ? `Your ${plan.name} plan has no limit on active campaigns you run. Campaigns you join as a player don't count.`
        : left > 0
          ? `You have ${left} remaining campaign slot${left === 1 ? '' : 's'} on your ${plan.name} plan. Campaigns you join as a player don't count.`
          : `All campaign slots on your ${plan.name} plan are in use. Archive a campaign to make room, or upgrade.`;
      container.querySelector('#campaign-quota-fill').style.width = finite ? `${Math.min(100, (active / limit) * 100)}%` : '0%';
      const playing = playerCount();
      const pLimit = store.PLAYER_CAMPAIGN_LIMIT;
      container.querySelector('#campaign-player-quota').textContent = playing >= pLimit
        ? `As a player: ${playing} / ${pLimit} campaigns — the most you can join. Leave one (before it starts) or wait until one is archived to join another.`
        : `As a player: ${playing} / ${pLimit} campaigns. You can join ${pLimit - playing} more.`;
    }

    /** Active campaigns you joined as a player (the database allows at most PLAYER_CAMPAIGN_LIMIT). */
    function playerCount() {
      return campaigns.filter((c) => c.role === 'player' && c.status === 'active').length;
    }

    async function load() {
      const res = await store.list();
      if (!alive) return;
      if (!res.ok) {
        showMessage(res.message);
        campaigns = [];
      } else {
        campaigns = res.campaigns;
      }
      render();
    }

    function render() {
      const active = campaigns.filter((c) => c.status === 'active').sort(SORTS[sort.value] || SORTS.recent);
      const archived = campaigns.filter((c) => c.status === 'archived').sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
      grid.innerHTML = active.map(renderCard).join('');
      activeSection.hidden = active.length === 0;
      empty.hidden = active.length > 0;
      archivedList.innerHTML = archived.map(renderArchivedRow).join('');
      archivedSection.hidden = archived.length === 0;
      renderQuota();
    }

    function startCreate() {
      if (campaigns.filter((c) => c.role === 'dm' && c.status === 'active').length >= store.plan().activeCampaigns) {
        const plan = store.plan();
        showMessage(`Your ${plan.name} plan allows ${plan.activeCampaigns} active campaign${plan.activeCampaigns === 1 ? '' : 's'}. Archive a campaign to make room, or upgrade your plan.`);
        pageMessage.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      router.navigateTo('#create-campaign');
    }

    // Card, menu and archive buttons. One delegated listener on the fragment root (replaced on every visit,
    // unlike #page-content) survives re-renders without piling up.
    const root = container.querySelector('.campaigns-page-container');
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const campaign = campaigns.find((c) => c.id === id);
      if (!campaign) return;
      const action = btn.getAttribute('data-action');
      if (action === 'open') {
        // Opens the campaign's own workspace on its Overview (settings live inside the workspace).
        global.location.href = campaignUrl(id, 'overview');
      } else if (action === 'settings') {
        global.location.href = campaignUrl(id, 'settings');
      } else if (action === 'archive') {
        const res = await store.archive(id);
        showMessage(res.ok ? `"${campaign.name}" moved to the archive. Its info and settings are kept there.` : res.message);
        load();
      } else if (action === 'delete' && global.confirm(`Delete "${campaign.name}" for everyone in it? This can't be undone. (Archive it instead to keep its details.)`)) {
        const res = await store.remove(id);
        showMessage(res.ok ? `"${campaign.name}" was deleted.` : res.message);
        load();
      }
    });

    sort.addEventListener('change', render);
    container.querySelector('#btn-create-campaign-header').addEventListener('click', startCreate);
    container.querySelector('#btn-empty-create').addEventListener('click', startCreate);

    // Join modal: joins with the DM's invite code, then opens the campaign to choose a character.
    function openModal() {
      joinStatus.hidden = true;
      if (playerCount() >= store.PLAYER_CAMPAIGN_LIMIT) {
        joinStatus.textContent = `You are already a player in ${store.PLAYER_CAMPAIGN_LIMIT} active campaigns, the most allowed. Leave one before joining another.`;
        joinStatus.hidden = false;
      }
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => codeInput.focus(), 100);
    }

    function closeModal() {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      codeInput.value = '';
    }

    container.querySelector('#btn-join-campaign-header').addEventListener('click', openModal);
    container.querySelector('#btn-empty-join').addEventListener('click', openModal);
    container.querySelector('#modal-close-btn').addEventListener('click', closeModal);
    container.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    const joinForm = container.querySelector('#join-campaign-form');
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = joinForm.querySelector('[type=submit]');
      if (submit) submit.disabled = true;
      joinStatus.textContent = 'Joining…';
      joinStatus.hidden = false;
      const res = await store.join(codeInput.value);
      if (submit) submit.disabled = false;
      if (!alive) return;
      if (!res.ok) {
        joinStatus.textContent = res.message;
        return;
      }
      closeModal();
      global.location.href = campaignUrl(res.id, 'overview');
    });

    function onKeydown(e) {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    }
    document.addEventListener('keydown', onKeydown);

    render();
    load();
    return function cleanup() {
      alive = false;
      document.removeEventListener('keydown', onKeydown);
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.campaigns = init;
})(window);
