/**
 * Profile page init (#profile): the signed-in user's profile from Supabase (public.profiles, own row only),
 * plus counts of the campaigns and characters stored in this browser.
 */
(function (global) {
  'use strict';

  const SYSTEMS = { dnd5e: 'D&D 5th Edition', pathfinder2e: 'Pathfinder 2e', callofcthulhu: 'Call of Cthulhu', other: 'Other TTRPG' };
  const ALIGNMENTS = {
    lg: 'Lawful Good', ng: 'Neutral Good', cg: 'Chaotic Good', ln: 'Lawful Neutral', tn: 'True Neutral',
    cn: 'Chaotic Neutral', le: 'Lawful Evil', ne: 'Neutral Evil', ce: 'Chaotic Evil',
  };

  function init(container) {
    const root = container.querySelector('.profile-wrapper');
    const account = global.FogAccount;

    function set(field, text) {
      root.querySelectorAll(`[data-field="${field}"]`).forEach((el) => { el.textContent = text; });
    }

    function render() {
      const acc = account.getAccount();
      if (!acc) return;
      const p = acc.profile;
      const plan = account.getPlan(acc);
      const notSet = 'Not set';
      set('displayName', p.displayName || notSet);
      set('username', p.username || notSet);
      set('usernameHandle', p.username ? '@' + p.username : '');
      set('email', p.email || notSet);
      set('bio', p.bio || 'No bio added yet.');
      set('bioPreview', p.bio || 'No bio added yet.');
      set('primarySystem', SYSTEMS[p.primarySystem] || notSet);
      set('favoriteClass', p.favoriteClass || notSet);
      set('alignment', ALIGNMENTS[p.alignment] || notSet);
      set('availability', p.availability || notSet);
      set('planBadge', `${plan.name} (${plan.priceLabel})`);
      set('planName', `${plan.name} (${plan.priceLabel})`);

      const avatar = root.querySelector('[data-field="avatar"]');
      if (account.isSafeAvatarUrl(p.avatarUrl)) {
        avatar.innerHTML = '';
        const img = document.createElement('img');
        img.src = p.avatarUrl;
        img.alt = `${p.displayName || 'Your'} avatar`;
        img.className = 'profile-avatar-img';
        avatar.appendChild(img);
      }

      const K = account.KEYS;
      // Campaigns live online: count the active ones you run or play in.
      set('statCampaigns', '…');
      if (global.FogCampaignStore) {
        global.FogCampaignStore.list('active').then((r) => set('statCampaigns', r.ok ? String(r.campaigns.length) : '—'));
      }
      set('statCharacters', String(account.countStored(K.characters, (c) => c.status === 'complete')));
      // Adventures live online (private to their owner): count yours.
      set('statAdventures', '…');
      const sbc = global.FogSupabase && global.FogSupabase.client;
      if (sbc && typeof sbc.from === 'function') {
        Promise.resolve(sbc.from('adventures').select('id', { count: 'exact', head: true }))
          .then((r) => set('statAdventures', r && !r.error && typeof r.count === 'number' ? String(r.count) : '—'))
          .catch(() => set('statAdventures', '—'));
      } else set('statAdventures', '—');

      // Profile couldn't be loaded from the database (e.g. migrations not applied yet): say so.
      let warning = root.querySelector('.profile-load-warning');
      if (acc.profileError) {
        if (!warning) {
          warning = document.createElement('p');
          warning.className = 'profile-load-warning';
          warning.setAttribute('role', 'alert');
          root.querySelector('.profile-main').prepend(warning);
        }
        warning.textContent = `Your saved profile couldn't be loaded (${acc.profileError}). Showing your account details only.`;
      } else if (warning) {
        warning.remove();
      }
    }

    root.querySelector('[data-action="logout"]').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      await account.signOut();
      global.location.replace('Auth/login.html?reason=signed-out');
    });

    render();
    global.addEventListener('fog:account', render);
    return function cleanup() {
      global.removeEventListener('fog:account', render);
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.profile = init;
})(window);
