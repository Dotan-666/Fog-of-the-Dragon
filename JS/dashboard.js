/**
 * Fog of the Dragon — Dashboard Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  const mobileMenuToggle = document.getElementById("mobileMenuToggle");
  const dashboardSidebar = document.getElementById("dashboardSidebar");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  
  const userMenuTrigger = document.getElementById("userMenuTrigger");
  const userDropdown = document.getElementById("userDropdown");

  // ==================== 1. MOBILE SIDEBAR DRAWER ====================
  function toggleSidebar() {
    const isOpen = dashboardSidebar.classList.toggle("is-open");
    sidebarBackdrop.classList.toggle("is-active", isOpen);
  }

  function closeSidebar() {
    dashboardSidebar?.classList.remove("is-open");
    sidebarBackdrop?.classList.remove("is-active");
  }

  mobileMenuToggle?.addEventListener("click", toggleSidebar);
  sidebarBackdrop?.addEventListener("click", closeSidebar);

  // ==================== 2. USER PROFILE DROPDOWN ====================
  if (userMenuTrigger && userDropdown) {
    function toggleUserDropdown(e) {
      e.preventDefault();
      e.stopPropagation();
      const isExpanded = userMenuTrigger.getAttribute("aria-expanded") === "true";
      userMenuTrigger.setAttribute("aria-expanded", !isExpanded);
      userDropdown.classList.toggle("is-active", !isExpanded);
    }

    function closeUserDropdown() {
      userMenuTrigger.setAttribute("aria-expanded", "false");
      userDropdown.classList.remove("is-active");
    }

    userMenuTrigger.addEventListener("click", toggleUserDropdown);

    document.addEventListener("click", (e) => {
      if (!userDropdown.contains(e.target) && !userMenuTrigger.contains(e.target)) {
        closeUserDropdown();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeUserDropdown();
    });
  }

  // ==================== 3. NAVIGATION CLICK HANDLING ====================
  const dragonNavItems = document.querySelectorAll(".fod-dragon-nav");
  dragonNavItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      dragonNavItems.forEach((nav) => nav.classList.remove("nav-item-active"));
      this.classList.add("nav-item-active");

      if (window.innerWidth <= 992) {
        closeSidebar();
      }
    });
  });

  // ==================== 4. INITIALIZE DRAGON CONTROLLER ====================
  new FogDragonNavController();
});



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