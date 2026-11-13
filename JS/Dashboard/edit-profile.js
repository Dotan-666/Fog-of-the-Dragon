/* ==========================================================================
   FOG OF THE DRAGON — EDIT PROFILE SCRIPT (Pages/Dashboard/edit-profile.html)
   Loads and saves the signed-in user's profile in Supabase (public.profiles, own row only).
   The photo is uploaded to Supabase Storage (avatars/<user id>/).
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const account = window.FogAccount;
  const auth = account ? await account.ready() : { session: null };
  if (!auth.session) {
    window.location.replace('../Auth/login.html?next=' + encodeURIComponent('#edit-profile'));
    return;
  }
  document.documentElement.classList.remove('fog-auth-pending');
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && !account.hasStoredSession()) window.location.replace('../Auth/login.html?next=%23edit-profile');
  });
  window.addEventListener('fog:auth', (e) => {
    if (e.detail && e.detail.event === 'SIGNED_OUT') window.location.replace('../Auth/login.html?next=%23edit-profile&reason=expired');
  });

  const form = document.getElementById('edit-profile-form');
  const saveBtn = document.getElementById('btn-save-profile');
  const dragonVideo = document.getElementById('dragon-video');
  const btnText = saveBtn ? saveBtn.querySelector('.btn-text') : null;
  const saveIcon = saveBtn ? saveBtn.querySelector('.save-icon') : null;
  const acc = account.getAccount();
  if (!form || !saveBtn || !acc) return;

  // ---- Status message above the action bar
  const status = document.createElement('p');
  status.className = 'edit-profile-status';
  status.setAttribute('role', 'alert');
  status.hidden = true;
  form.querySelector('.form-actions-bar').before(status);
  function showStatus(text) {
    status.textContent = text;
    status.hidden = !text;
    if (text) status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  if (acc.profileError) showStatus(`Your saved profile couldn't be loaded (${acc.profileError}). Saving may not work until the database is set up.`);

  // ---- Prefill from the saved profile
  const p = acc.profile;
  const fields = {
    displayName: document.getElementById('display-name'),
    username: document.getElementById('username'),
    bio: document.getElementById('bio'),
    primarySystem: document.getElementById('primary-system'),
    favoriteClass: document.getElementById('favorite-class'),
    alignment: document.getElementById('preferred-alignment'),
    availability: document.getElementById('session-availability'),
  };
  Object.keys(fields).forEach((key) => {
    if (fields[key] && p[key]) fields[key].value = p[key];
  });
  fields.displayName.required = true;
  fields.displayName.maxLength = 40;
  fields.username.maxLength = 24;
  fields.username.pattern = '[A-Za-z0-9_]{3,24}';
  fields.username.title = '3–24 letters, numbers or underscores (saved in lowercase)';
  fields.bio.maxLength = 500;
  fields.favoriteClass.maxLength = 60;
  fields.availability.maxLength = 120;

  // ---- Avatar: choose, preview, remove (uploaded on save)
  let avatarUrl = account.isSafeAvatarUrl(p.avatarUrl) ? p.avatarUrl : null;
  let pendingAvatar; // undefined = unchanged, null = remove, data URL = new photo
  const previewBox = document.querySelector('.avatar-preview-box');
  const placeholderIcon = previewBox.innerHTML;
  const controls = document.querySelector('.avatar-controls');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
  fileInput.hidden = true;
  controls.appendChild(fileInput);
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-link-remove';
  removeBtn.textContent = 'Remove photo';
  controls.appendChild(removeBtn);
  const hint = controls.querySelector('.upload-hint');
  if (hint) hint.textContent = 'PNG, JPG, WEBP or GIF. It’s resized to 256px and stored as a JPEG.';

  function renderAvatar() {
    const shown = pendingAvatar !== undefined ? pendingAvatar : avatarUrl;
    if (shown) {
      previewBox.innerHTML = '';
      const img = document.createElement('img');
      img.src = shown;
      img.alt = 'Profile photo preview';
      previewBox.appendChild(img);
    } else {
      previewBox.innerHTML = placeholderIcon;
    }
    removeBtn.hidden = !shown;
  }
  renderAvatar();

  document.querySelector('.btn-upload-demo').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    account.compressImage(file).then((url) => {
      pendingAvatar = url;
      renderAvatar();
      showStatus('');
    }).catch((err) => showStatus(err.message));
    fileInput.value = '';
  });
  removeBtn.addEventListener('click', () => {
    pendingAvatar = null;
    renderAvatar();
  });

  // ---- Dragon button animation (unchanged behaviour)
  if (dragonVideo) {
    dragonVideo.play().catch(() => { /* autoplay may be blocked */ });
    saveBtn.addEventListener('mouseenter', () => { dragonVideo.playbackRate = 1.4; });
    saveBtn.addEventListener('mouseleave', () => { dragonVideo.playbackRate = 1.0; });
  }

  function setSaving(saving) {
    saveBtn.disabled = saving;
    saveBtn.style.pointerEvents = saving ? 'none' : '';
    saveBtn.style.opacity = saving ? '0.9' : '';
    if (btnText) btnText.textContent = saving ? 'Saving Realm Data...' : 'Save Changes';
    if (dragonVideo) dragonVideo.playbackRate = saving ? 2.5 : 1.0;
  }

  // ---- Save
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    showStatus('');
    setSaving(true);

    let newAvatarUrl = avatarUrl;
    if (pendingAvatar) {
      const up = await account.uploadAvatar(pendingAvatar);
      if (!up.ok) {
        setSaving(false);
        showStatus(up.message);
        return;
      }
      newAvatarUrl = up.url;
    } else if (pendingAvatar === null) {
      await account.removeAvatarFiles(null);
      newAvatarUrl = null;
    }

    const res = await account.saveProfile({
      displayName: fields.displayName.value,
      username: fields.username.value,
      bio: fields.bio.value,
      primarySystem: fields.primarySystem.value,
      favoriteClass: fields.favoriteClass.value,
      alignment: fields.alignment.value,
      availability: fields.availability.value,
      avatarUrl: newAvatarUrl,
    });
    if (!res.ok) {
      setSaving(false);
      showStatus(res.message);
      return;
    }
    avatarUrl = newAvatarUrl;
    pendingAvatar = undefined;
    window.FogNotifications.add({ kind: 'account', title: 'Profile updated', link: '#profile' });

    if (btnText) btnText.textContent = 'Saved!';
    if (saveIcon) saveIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
    setTimeout(() => {
      window.location.href = '../dashboard.html#profile';
    }, 600);
  });
});
