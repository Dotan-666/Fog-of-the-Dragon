/* ==========================================================================
   FOG OF THE DRAGON — EDIT PROFILE INTERACTION SCRIPT
   Path: Scripts/Dashboard/edit-profile.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('btn-save-profile');
  const dragonVideo = document.getElementById('dragon-video');
  const btnText = saveBtn ? saveBtn.querySelector('.btn-text') : null;
  const saveIcon = saveBtn ? saveBtn.querySelector('.save-icon') : null;

  if (!saveBtn || !dragonVideo) return;

  // Ensure video playback
  dragonVideo.play().catch(() => {
    // Autoplay fallback handling
  });

  // Speed up video animation on button hover for responsive feedback
  saveBtn.addEventListener('mouseenter', () => {
    dragonVideo.playbackRate = 1.4;
  });

  saveBtn.addEventListener('mouseleave', () => {
    dragonVideo.playbackRate = 1.0;
  });

  // Simulated Save Handler with UI feedback
  saveBtn.addEventListener('click', (e) => {
    e.preventDefault();

    // Trigger rapid video burst effect
    dragonVideo.playbackRate = 2.5;

    if (btnText) btnText.textContent = 'Saving Realm Data...';
    saveBtn.style.pointerEvents = 'none';
    saveBtn.style.opacity = '0.9';

    // Simulate save duration
    setTimeout(() => {
      if (btnText) btnText.textContent = 'Saved!';
      if (saveIcon) {
        saveIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
      }

      // Return to Profile page
      setTimeout(() => {
        window.location.href = '../dashboard.html#profile';
      }, 600);
    }, 1000);
  });
});