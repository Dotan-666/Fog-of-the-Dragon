/**
 * Fog of the Dragon — Dashboard Controller
 */

function goToLogin(reason) {
  const next = encodeURIComponent(window.location.hash || "#campaigns");
  window.location.replace(`Auth/login.html?next=${next}${reason ? `&reason=${reason}` : ""}`);
}

// Back/forward can restore this page from the browser's cache after logging out; re-check on show.
window.addEventListener("pageshow", (e) => {
  if (e.persisted && window.FogAccount && !window.FogAccount.hasStoredSession()) goToLogin();
});

document.addEventListener("DOMContentLoaded", async () => {
  // Protected page: restore the Supabase session first. The page stays hidden (html.fog-auth-pending)
  // until we know, so a refresh never flashes content or redirects while the session is still loading.
  const auth = window.FogAccount ? await window.FogAccount.ready() : { session: null };
  if (!auth.session) {
    goToLogin();
    return;
  }
  document.documentElement.classList.remove("fog-auth-pending");

  // Session ended while the page was open (logged out in another tab, revoked, refresh token expired).
  let loggingOut = false;
  window.addEventListener("fog:auth", (e) => {
    if (e.detail?.event === "SIGNED_OUT" && !loggingOut) goToLogin("expired");
  });

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

    // Close the menu once an item is chosen (the router handles the navigation itself).
    userDropdown.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", closeUserDropdown);
    });
  }

  // ==================== 2b. SIGNED-IN USER IN THE HEADER ====================
  function renderAccountHeader() {
    const acc = window.FogAccount?.getAccount();
    if (!acc) return;
    const plan = window.FogAccount.getPlan(acc);
    const name = acc.profile.displayName || acc.profile.email || "Adventurer";
    document.getElementById("user-name").textContent = name;
    document.getElementById("user-plan").textContent = `${plan.name} plan`;
    document.getElementById("user-email").textContent = acc.profile.email;
    const avatar = document.getElementById("user-avatar");
    avatar.src = window.FogAccount.isSafeAvatarUrl(acc.profile.avatarUrl)
      ? acc.profile.avatarUrl
      : "../Assets/Pictures/FOD.jpg";
    avatar.alt = `${name}'s avatar`;
  }
  renderAccountHeader();
  window.addEventListener("fog:account", renderAccountHeader);

  document.getElementById("logoutLink")?.addEventListener("click", async (e) => {
    e.preventDefault();
    loggingOut = true;
    await window.FogAccount.signOut();
    window.location.replace("Auth/login.html?reason=signed-out");
  });

  // ==================== 2c. NOTIFICATIONS PANEL ====================
  initNotifications();
  window.FogCampaignNotifications?.sync(); // campaign notifications (availability requests, confirmed meetings…)

  // ==================== 3. NAVIGATION (router.js handles clicks + active item) ====================
  window.__fogCloseSidebar = closeSidebar;

  // ==================== 4. INITIALIZE DRAGON CONTROLLER ====================
  new FogDragonNavController();

  // ==================== 5. START PAGE ROUTER ====================
  window.FogDashboardRouter?.init();
});
