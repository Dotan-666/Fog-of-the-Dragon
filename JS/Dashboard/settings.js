/**
 * Settings page init (#settings). Values are stored with FogSettings (JS/fog-account.js).
 * "Save Settings" stores them, applies what works today (text size) and returns to Campaigns.
 */
(function (global) {
  'use strict';

  function init(container) {
    const root = container.querySelector('.settings-page');
    const settings = global.FogSettings.get();
    const $ = (sel) => root.querySelector(sel);
    const status = $('#settings-status');

    // 1. Accordions
    root.querySelectorAll('.accordion-header').forEach((header) => {
      header.setAttribute('aria-expanded', String(header.parentElement.classList.contains('open')));
      header.addEventListener('click', () => {
        const open = header.parentElement.classList.toggle('open');
        header.setAttribute('aria-expanded', String(open));
      });
    });

    // 2. Current values + live slider labels
    const sliders = [
      ['#bg-music-slider', '#music-val', 'musicVolume'],
      ['#sfx-slider', '#sfx-val', 'sfxVolume'],
      ['#fog-opacity-slider', '#fog-val', 'fogOpacity'],
    ];
    sliders.forEach(([input, label, key]) => {
      const el = $(input);
      el.value = settings[key];
      const update = () => { $(label).textContent = el.value + '%'; };
      el.addEventListener('input', update);
      update();
    });
    $('#text-size-select').value = settings.textSize;
    $('#theme-select').value = settings.theme || 'dark';
    $('#music-toggle').checked = !!settings.musicOn;
    document.getElementById('3d-dice-toggle').checked = !!settings.dice3d;
    $('#autosave-select').value = settings.autosave;

    // Preview theme and text size immediately; they're only kept if saved.
    const preview = () => global.FogSettings.apply(Object.assign(global.FogSettings.get(), {
      textSize: $('#text-size-select').value,
      theme: $('#theme-select').value,
    }));
    $('#text-size-select').addEventListener('change', preview);
    $('#theme-select').addEventListener('change', preview);

    // Sound: preview music for a few seconds, test the effects at the chosen volume.
    const soundStatus = (text) => {
      status.textContent = text;
      status.hidden = !text;
    };
    $('#music-preview-btn').addEventListener('click', () => {
      if (!global.FogAudio || !global.FogAudio.supported()) {
        soundStatus('This browser can’t play generated audio.');
        return;
      }
      global.FogAudio.preview(Number($('#bg-music-slider').value));
      soundStatus('Playing a short preview…');
      setTimeout(() => soundStatus(''), 8000);
    });
    $('#sfx-test-btn').addEventListener('click', () => {
      if (!global.FogAudio) return;
      global.FogAudio.apply(Object.assign(global.FogSettings.get(), { sfxVolume: Number($('#sfx-slider').value) }));
      global.FogAudio.sfx('success');
    });

    // 3. Save
    let saved = false;
    $('#settings-save-btn').addEventListener('click', () => {
      const res = global.FogSettings.save({
        textSize: $('#text-size-select').value,
        theme: $('#theme-select').value,
        musicOn: $('#music-toggle').checked,
        musicVolume: Number($('#bg-music-slider').value),
        sfxVolume: Number($('#sfx-slider').value),
        fogOpacity: Number($('#fog-opacity-slider').value),
        dice3d: document.getElementById('3d-dice-toggle').checked,
        autosave: $('#autosave-select').value,
      });
      if (!res.ok) {
        status.textContent = res.message;
        status.hidden = false;
        return;
      }
      saved = true;
      global.FogNotifications.add({ kind: 'settings', title: 'Settings saved', link: '#settings' });
      global.FogDashboardRouter.navigateTo('#campaigns');
    });

    // 4. Danger zone (typed confirmation)
    const modal = $('#delete-modal');
    const confirmInput = $('#confirm-input');
    const confirmBtn = $('#confirm-delete-btn');
    let action = null;

    function openModal(type) {
      action = type;
      confirmInput.value = '';
      confirmBtn.disabled = true;
      $('#modal-title').textContent = type === 'account' ? 'Delete Entire Account?' : 'Clear All Campaign Data?';
      $('#modal-description').innerHTML = (type === 'account'
        ? 'This permanently deletes your Fog of the Dragon account and profile, and removes your campaigns, characters, settings and notifications from this browser.'
        : 'This permanently deletes every campaign you run as Dungeon Master (active and archived), for everyone in them. Campaigns you joined as a player and your characters are kept.') +
        ' It can’t be undone. Type <strong class="highlight-text">DELETE</strong> below to confirm.';
      modal.classList.add('active');
      confirmInput.focus();
    }

    function closeModal() {
      modal.classList.remove('active');
      action = null;
    }

    root.querySelectorAll('[data-danger]').forEach((btn) => {
      btn.addEventListener('click', () => openModal(btn.getAttribute('data-danger')));
    });
    $('#cancel-delete-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    confirmInput.addEventListener('input', () => {
      confirmBtn.disabled = confirmInput.value.trim() !== 'DELETE';
    });
    confirmBtn.addEventListener('click', async () => {
      if (confirmInput.value.trim() !== 'DELETE') return;
      if (action === 'account') {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting…';
        const res = await global.FogAccount.deleteAccount();
        if (!res.ok) {
          confirmBtn.textContent = 'Confirm Action';
          closeModal();
          status.textContent = res.message;
          status.hidden = false;
          return;
        }
        global.location.replace('Auth/login.html?reason=deleted');
        return;
      }
      confirmBtn.disabled = true;
      const res = global.FogCampaignStore ? await global.FogCampaignStore.removeAllOwned() : { ok: false, message: 'Campaigns are unavailable.' };
      try {
        global.localStorage.removeItem(global.FogAccount.KEYS.campaigns); // data left by the old browser-only version
      } catch (e) { /* ignore */ }
      closeModal();
      if (!res.ok) {
        status.textContent = res.message;
        status.hidden = false;
        return;
      }
      global.FogNotifications.add({ kind: 'campaign', title: 'Your campaigns were deleted', message: res.count + ' campaign(s) you ran were removed.', link: '#campaigns' });
      status.textContent = res.count + ' campaign(s) you ran were deleted.';
      status.hidden = false;
    });

    function onKeydown(e) {
      if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    }
    document.addEventListener('keydown', onKeydown);

    return function cleanup() {
      document.removeEventListener('keydown', onKeydown);
      // Leaving without saving drops the text-size preview.
      if (!saved) global.FogSettings.apply();
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.settings = init;
})(window);
