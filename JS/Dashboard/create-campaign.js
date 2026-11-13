/**
 * Create Campaign page init — creates the campaign online through FogCampaignStore (Supabase).
 */
(function (global) {
  'use strict';

  function init(container) {
    const store = global.FogCampaignStore;
    const form = container.querySelector('.create-campaign-form');
    const plan = store.plan();
    let coverDataUrl = null;

    // Message area just above the action buttons
    const message = document.createElement('p');
    message.className = 'create-campaign-message';
    message.setAttribute('role', 'alert');
    message.hidden = true;
    form.querySelector('.form-actions-footer').before(message);
    function showMessage(text) {
      message.textContent = text;
      message.hidden = !text;
      if (text) message.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    store.canActivateAnother().then((ok) => {
      if (!ok) showMessage(`Your ${plan.name} plan allows ${plan.activeCampaigns} active campaign${plan.activeCampaigns === 1 ? '' : 's'}, and it's in use. Archive a campaign or upgrade before creating a new one.`);
    });

    // Player limit follows the account plan
    const players = form.querySelector('#required-players');
    if (Number.isFinite(plan.maxPeople)) players.max = String(plan.maxPeople);
    else players.removeAttribute('max');

    // "Existing Campaign" options only make sense when that source is chosen
    const existingBox = form.querySelector('.existing-campaign-options');
    function syncSource() {
      existingBox.hidden = form.querySelector('[name="campaignSource"]:checked').value !== 'existing';
    }
    form.querySelectorAll('[name="campaignSource"]').forEach((r) => r.addEventListener('change', syncSource));
    syncSource();
    // Published adventures come from the Marketplace: My library adds them to Adventures, where this form picks them up.
    existingBox.querySelectorAll('a[data-existing]').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (!global.FogDashboardRouter) return;
        e.preventDefault();
        global.FogDashboardRouter.navigateTo(a.getAttribute('href'));
      });
    });

    // Adventure (required): one of your adventures, or a new empty draft created right here
    const advSelect = form.querySelector('#campaign-adventure');
    const advNewBox = form.querySelector('#campaign-adventure-new');
    const advToggle = form.querySelector('#campaign-adventure-new-toggle');
    const advTitle = form.querySelector('#campaign-adventure-new-title');
    const advCreate = form.querySelector('#campaign-adventure-new-create');
    const advMessage = form.querySelector('#campaign-adventure-message');
    const advStore = global.FogAdventureStore;
    let adventuresReady = false;
    function advNote(text) {
      advMessage.textContent = text || '';
      advMessage.hidden = !text;
    }
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function showNewBox(open) {
      advNewBox.hidden = !open;
      advToggle.setAttribute('aria-expanded', String(open));
      if (open) advTitle.focus();
    }
    function fillAdventures(list, selectId) {
      const usable = list.filter((a) => a.status !== 'archived');
      advSelect.innerHTML = (usable.length ? '<option value="">Choose an adventure…</option>' : '<option value="">You have no adventures yet. Create one →</option>') +
        usable.map((a) => `<option value="${esc(a.id)}"${a.id === selectId ? ' selected' : ''}>${esc(a.title)}${a.status === 'ready' ? ' (ready)' : ' (draft)'}</option>`).join('');
      advSelect.disabled = !usable.length;
      adventuresReady = true;
      if (!usable.length) showNewBox(true);
    }
    async function loadAdventures(selectId) {
      if (!advStore) {
        advSelect.innerHTML = '<option value="">Adventures are not available</option>';
        advNote('Adventures could not be loaded, so a campaign can’t be created right now. Reload the page.');
        return;
      }
      const res = await advStore.list();
      if (!res.ok) {
        advSelect.innerHTML = '<option value="">Adventures could not be loaded</option>';
        advToggle.disabled = true;
        advNote(res.message);
        return;
      }
      fillAdventures(res.adventures, selectId);
    }
    advToggle.addEventListener('click', () => showNewBox(advNewBox.hidden));
    advTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        advCreate.click();
      }
    });
    advCreate.addEventListener('click', async () => {
      const title = advTitle.value.trim();
      if (!title) {
        advNote('Give the new adventure a title.');
        advTitle.focus();
        return;
      }
      advCreate.disabled = true;
      advNote('Creating the adventure…');
      const res = await advStore.create({ title, levelMin: form.querySelector('#starting-level').value || null });
      advCreate.disabled = false;
      if (!res.ok) {
        advNote(res.message);
        return;
      }
      advTitle.value = '';
      showNewBox(false);
      await loadAdventures(res.adventure.id);
      advNote(`“${res.adventure.title}” was created in Adventures and selected.`);
    });
    advSelect.addEventListener('change', () => advNote(''));
    loadAdventures(null);

    // Privacy badge in the invite-code preview
    const privacyBadge = form.querySelector('.code-preview-box .badge-tag');
    function syncPrivacy() {
      privacyBadge.textContent = form.querySelector('[name="privacyMode"]:checked').value === 'public' ? 'Public' : 'Private';
    }
    form.querySelectorAll('[name="privacyMode"]').forEach((r) => r.addEventListener('change', syncPrivacy));
    syncPrivacy();

    // Cover image: click or drop a file; it's resized and kept as a data URL
    const fileInput = form.querySelector('#cover-image-upload');
    const dropzone = form.querySelector('.upload-dropzone');
    const title = dropzone.querySelector('.upload-title');
    fileInput.disabled = false;
    dropzone.setAttribute('role', 'button');
    dropzone.setAttribute('tabindex', '0');
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    dropzone.addEventListener('dragover', (e) => e.preventDefault());
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) useFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) useFile(fileInput.files[0]);
    });
    function useFile(file) {
      store.compressCover(file).then((url) => {
        coverDataUrl = url;
        let preview = dropzone.querySelector('.cover-preview');
        if (!preview) {
          preview = document.createElement('img');
          preview.className = 'cover-preview';
          preview.alt = 'Cover preview';
          dropzone.prepend(preview);
        }
        preview.src = url;
        title.textContent = `Cover selected: ${file.name} (click to change)`;
        showMessage('');
      }).catch((err) => showMessage(err.message));
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!advSelect.value) {
        advNote(adventuresReady ? 'Choose the adventure this campaign runs, or create a new one.' : (advMessage.textContent || 'Your adventures are still loading.'));
        (advSelect.disabled ? advToggle : advSelect).focus();
        advMessage.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      if (!form.reportValidity()) return;
      const submit = form.querySelector('[type=submit]');
      if (submit) submit.disabled = true;
      showMessage('Creating the campaign…');
      const res = await store.create({
        name: form.querySelector('#campaign-name').value,
        description: form.querySelector('#campaign-description').value,
        source: form.querySelector('[name="campaignSource"]:checked').value,
        startingLevel: form.querySelector('#starting-level').value,
        requiredPlayers: players.value,
        privacy: form.querySelector('[name="privacyMode"]:checked').value,
        adventureId: advSelect.value,
        coverDataUrl,
      });
      if (submit) submit.disabled = false;
      if (!res.ok) {
        showMessage(res.message);
        return;
      }
      global.FogDashboardRouter.navigateTo('#campaigns/' + res.campaign.id);
    });

    return null;
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.createCampaign = init;
})(window);
