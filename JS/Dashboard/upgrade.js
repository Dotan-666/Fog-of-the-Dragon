/**
 * Upgrade page init — pricing tabs and fade-in sections inside the dashboard.
 * Same behaviour as switchPricingTab() and the fade-in observer in landing.js, scoped to the fragment.
 */
(function (global) {
  'use strict';

  function init(container) {
    const monthlyView = container.querySelector('#monthlyView');
    const yearlyView = container.querySelector('#yearlyView');
    const monthlyBtn = container.querySelector('#tabMonthlyBtn');
    const yearlyBtn = container.querySelector('#tabYearlyBtn');

    function switchTab(category) {
      if (!monthlyView || !yearlyView || !monthlyBtn || !yearlyBtn) return;
      const yearly = category === 'yearly';
      yearlyView.classList.toggle('active', yearly);
      monthlyView.classList.toggle('active', !yearly);
      yearlyBtn.classList.toggle('active', yearly);
      monthlyBtn.classList.toggle('active', !yearly);
    }

    // The fragment's inline onclick handlers call a landing-page global that the dashboard doesn't load.
    [[monthlyBtn, 'monthly'], [yearlyBtn, 'yearly']].forEach(([btn, category]) => {
      if (!btn) return;
      btn.removeAttribute('onclick');
      btn.addEventListener('click', () => switchTab(category));
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    container.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

    return function cleanup() {
      observer.disconnect();
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.upgrade = init;
})(window);
