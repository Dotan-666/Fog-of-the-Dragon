/**
 * Shell pieces shared by the Dashboard (Pages/dashboard.html) and the Campaign workspace (Pages/campaign.html):
 * the notification bell and the dragon navigation animation. Moved here unchanged from JS/dashboard.js so both pages
 * use the same code (plus campaign links in notifications).
 */

/**
 * Notification bell: a panel listing events from this browser (FogNotifications in fog-account.js).
 */
function initNotifications() {
  const trigger = document.getElementById("notificationTrigger");
  const panel = document.getElementById("notificationPanel");
  const list = document.getElementById("notificationList");
  const indicator = document.getElementById("notificationIndicator");
  const store = window.FogNotifications;
  if (!trigger || !panel || !list || !store) return;
  const esc = window.FogAccount.escapeHtml;

  function render() {
    const items = store.list();
    const unread = items.filter((n) => !n.read).length;
    indicator.hidden = unread === 0;
    trigger.setAttribute("aria-label", unread ? `Notifications (${unread} unread)` : "Notifications");
    document.getElementById("notificationMarkAll").disabled = unread === 0;
    document.getElementById("notificationClear").disabled = items.length === 0;
    list.innerHTML = items.length
      ? items.map((n) => `
          <li class="notification-item${n.read ? "" : " is-unread"}">
            <button type="button" class="notification-item-btn" data-id="${esc(n.id)}" data-link="${esc(n.link || "")}">
              <span class="notification-item-title">${esc(n.title)}</span>
              ${n.message ? `<span class="notification-item-message">${esc(n.message)}</span>` : ""}
              <span class="notification-item-time">${esc(window.FogAccount.relativeTime(n.createdAt))}</span>
            </button>
          </li>`).join("")
      : `<li class="notification-empty">No notifications yet. Updates about your campaigns, characters and account will appear here.</li>`;
  }

  function setOpen(open) {
    trigger.setAttribute("aria-expanded", String(open));
    panel.classList.toggle("is-active", open);
    if (open) render();
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(trigger.getAttribute("aria-expanded") !== "true");
  });
  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && !trigger.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("is-active")) {
      setOpen(false);
      trigger.focus();
    }
  });

  list.addEventListener("click", (e) => {
    const item = e.target.closest(".notification-item-btn");
    if (!item) return;
    store.markRead(item.dataset.id);
    const link = item.dataset.link;
    if (link && link.charAt(0) === "#") {
      setOpen(false);
      window.FogDashboardRouter?.navigateTo(link);
    } else if (link && /^dashboard\.html#[\w/-]+$/.test(link)) {
      // An account notification (for example the Marketplace review of your listing).
      setOpen(false);
      if (window.FogDashboardRouter) window.FogDashboardRouter.navigateTo(link.slice(link.indexOf("#")));
      else window.location.href = link;
    } else if (link && /^campaign\.html\?c=[0-9a-f-]{36}(#[\w/-]*)?$/i.test(link)) {
      // A campaign notification (in the Dashboard this opens the campaign workspace; inside it, the right section).
      setOpen(false);
      const here = window.location.pathname.split("/").pop() + window.location.search;
      if (link.split("#")[0] === here && window.FogCampaign) window.location.hash = link.split("#")[1] || "overview";
      else window.location.href = link;
    }
  });
  document.getElementById("notificationMarkAll").addEventListener("click", () => store.markRead());
  document.getElementById("notificationClear").addEventListener("click", () => store.clear());

  window.addEventListener("fog:notifications", render);
  render();
}



/**
 * Fog of the Dragon - Interactive Dragon Navigation Controller (Fixed Smooth Reverse)
 */
class FogDragonNavController {
  constructor() {
    this.PLAYBACK_RATE = 0.35;
    this.navItems = [];
    this.init();
  }

  init() {
    const items = document.querySelectorAll('.fod-dragon-nav');
    items.forEach(item => this.bindNavItem(item));
  }

  bindNavItem(item) {
    const video = item.querySelector('.fod-dragon-video');
    const idleFrame = item.querySelector('.fod-dragon-idle');
    const finalFrame = item.querySelector('.fod-dragon-final');

    if (!video) return;

    const data = {
      container: item,
      video: video,
      idleFrame: idleFrame,
      finalFrame: finalFrame,
      isHovered: false,
      reverseInterval: null
    };

    this.navItems.push(data);
    this.setState(data, 'idle');
    video.playbackRate = this.PLAYBACK_RATE;

    // Hover Listeners
    item.addEventListener('mouseenter', () => this.handleHoverStart(data));
    item.addEventListener('mouseleave', () => this.handleHoverEnd(data));

    // Touch device safety
    item.addEventListener('touchstart', () => this.handleHoverStart(data), { passive: true });
  }

  setState(data, state) {
    data.container.classList.remove('state-idle', 'state-playing', 'state-finished');
    data.container.classList.add(`state-${state}`);
  }

async handleHoverStart(data) {
    data.isHovered = true;

    // ביטול מאזין רוורס פעיל אם המשתמש החזיר את העכבר באמצע
    if (data.onSeeked) {
      data.video.removeEventListener('seeked', data.onSeeked);
      data.onSeeked = null;
    }

    this.setState(data, 'playing');

    try {
      data.video.playbackRate = this.PLAYBACK_RATE;
      const playPromise = data.video.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (err) {
      if (data.isHovered) {
        this.setState(data, 'finished');
      }
    }
  }

  handleHoverEnd(data) {
    data.isHovered = false;
    data.video.pause();

    const video = data.video;
    const stepSize = 0.05; // גודל הקפיצה אחורה בשניות בכל פריים

    // ניקוי מאזין קודם ליתר ביטחון
    if (data.onSeeked) {
      video.removeEventListener('seeked', data.onSeeked);
      data.onSeeked = null;
    }

    // הגדרת פונקציית הרוורס שממתינה לסיום רנדור כל פריים (seeked)
    data.onSeeked = () => {
      if (data.isHovered) {
        video.removeEventListener('seeked', data.onSeeked);
        data.onSeeked = null;
        return;
      }

      if (video.currentTime > stepSize) {
        video.currentTime -= stepSize;
      } else {
        // הגעה חזרה לתחילת הווידאו
        video.currentTime = 0;
        video.removeEventListener('seeked', data.onSeeked);
        data.onSeeked = null;
        this.setState(data, 'idle');
      }
    };

    // הרשמה לאירוע seeked המבטיח זרימה חלקה
    video.addEventListener('seeked', data.onSeeked);

    // התחלת שרשרת הרוורס (קפיצה ראשונה)
    if (video.currentTime > stepSize) {
      video.currentTime -= stepSize;
    } else {
      video.currentTime = 0;
      this.setState(data, 'idle');
    }
  }
}

/* ---- Global Image Lightbox ---- */
(function () {
  document.addEventListener('click', function (e) {
    var img = e.target.closest('[data-lightbox]');
    if (!img || !img.src) return;
    e.preventDefault();
    var overlay = document.createElement('div');
    overlay.className = 'fog-lightbox';
    overlay.innerHTML = '<button type="button" class="fog-lightbox-close" aria-label="Close">&times;</button>' +
      '<img src="' + img.src + '" alt="' + (img.alt || '') + '">' +
      (img.dataset.lightbox ? '<span class="fog-lightbox-name">' + img.dataset.lightbox + '</span>' : '');
    document.body.appendChild(overlay);
    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev) { if (ev.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay || ev.target.classList.contains('fog-lightbox-close')) close();
    });
  });
})();