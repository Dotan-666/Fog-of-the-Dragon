/**
 * Fog of the Dragon — Dashboard Controller
 * Handles mobile sidebar drawer, restored profile dropdown menu,
 * and dragon navigation hover/active interactions.
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
    dashboardSidebar.classList.remove("is-open");
    sidebarBackdrop.classList.remove("is-active");
  }

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener("click", toggleSidebar);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", closeSidebar);
  }

  // ==================== 2. RESTORED USER PROFILE DROPDOWN ====================
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

    // Toggle on trigger click
    userMenuTrigger.addEventListener("click", toggleUserDropdown);

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!userDropdown.contains(e.target) && !userMenuTrigger.contains(e.target)) {
        closeUserDropdown();
      }
    });

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeUserDropdown();
      }
    });
  }

  // ==================== 3. DRAGON NAVIGATION INTERACTION ====================
  const dragonNavItems = document.querySelectorAll(".fod-dragon-nav");

  dragonNavItems.forEach((item) => {
    // Mouseenter & Mouseleave state handling for CSS transforms
    item.addEventListener("mouseenter", () => {
      item.classList.add("is-hovered");
    });

    item.addEventListener("mouseleave", () => {
      item.classList.remove("is-hovered");
    });

    // Active item selection toggle
    item.addEventListener("click", function (e) {
      e.preventDefault();

      dragonNavItems.forEach((nav) => nav.classList.remove("nav-item-active"));
      this.classList.add("nav-item-active");

      if (window.innerWidth <= 992) {
        closeSidebar();
      }
    });
  });
});

/**
 * Fog of the Dragon - Interactive Dragon Navigation Controller
 */
class FogDragonNavController {
    constructor() {
        this.PLAYBACK_RATE = 0.35; // Deliberate speed between 0.3x and 0.5x
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
            isHovered: false
        };

        this.navItems.push(data);
        this.setState(data, 'idle');

        // Configure video element settings
        video.playbackRate = this.PLAYBACK_RATE;

        // Video completion handler -> Freeze on final frame looking at user
        video.addEventListener('ended', () => {
            if (data.isHovered) {
                this.setState(data, 'finished');
            }
        });

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
        this.setState(data, 'playing');

        try {
            data.video.currentTime = 0;
            data.video.playbackRate = this.PLAYBACK_RATE;
            
            const playPromise = data.video.play();
            if (playPromise !== undefined) {
                await playPromise;
            }
        } catch (err) {
            // In case of interrupted playback or browser restriction, freeze cleanly on final frame
            if (data.isHovered) {
                this.setState(data, 'finished');
            }
        }
    }

    handleHoverEnd(data) {
        data.isHovered = false;

        // Reset playback and return instantly to idle resting state
        data.video.pause();
        data.video.currentTime = 0;
        this.setState(data, 'idle');
    }
}

// Initialize once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new FogDragonNavController();
});