/**
 * Upgrade page init — pricing tabs and fade-in sections inside the dashboard.
 * Same behaviour as switchPricingTab() and the fade-in observer in landing.js, scoped to the fragment.
 */
(function (global) {
  'use strict';

  function init(container) {
    const cleanupTimers = [];
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

    // Plan buttons. With payments switched on (FOG_PAYMENTS) a paid plan opens Lemon Squeezy's checkout; the plan is
    // activated only when the provider's signed webhook reaches the server, never by this button.
    const status = document.createElement('p');
    status.className = 'upgrade-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    container.querySelector('.pricing-tabs').after(status);
    const account = global.FogAccount;
    const payments = global.FogPayments && global.FogPayments.enabled();
    const say = (text) => { status.textContent = text; status.hidden = false; status.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
    const planIds = { Warlord: 'warlord', 'Dungeon Master': 'dungeon-master', 'Fogger of the Dragons': 'fogger-of-the-dragons' };
    const productFor = { 'dungeon-master': 'dm', 'fogger-of-the-dragons': 'fogger' };

    function describe() {
      const current = account.getPlan();
      const info = account.getPlanInfo && account.getPlanInfo();
      container.querySelectorAll('.card-btn').forEach((btn) => {
        let card = btn.parentElement;
        while (card && !card.querySelector('.plan-name')) card = card.parentElement;
        const planName = card ? card.querySelector('.plan-name').textContent.trim() : '';
        const planId = planIds[planName];
        const yearly = !!btn.closest('#yearlyView');
        btn.dataset.planId = planId || '';
        btn.dataset.period = yearly ? 'yearly' : 'monthly';
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        if (planId === current.id) {
          btn.textContent = info && info.portalUrl ? 'Manage Subscription' : 'Your Current Plan';
          btn.setAttribute('aria-disabled', info && info.portalUrl ? 'false' : 'true');
        } else {
          btn.textContent = btn.dataset.label;
          btn.removeAttribute('aria-disabled');
        }
      });
    }
    describe();
    global.addEventListener('fog:account', describe);

    container.querySelectorAll('.card-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const current = account.getPlan();
        const info = account.getPlanInfo && account.getPlanInfo();
        const planId = btn.dataset.planId;
        const planName = Object.keys(planIds).find((k) => planIds[k] === planId) || 'This plan';
        if (planId === current.id) {
          if (info && info.portalUrl) global.open(info.portalUrl, '_blank', 'noopener');
          else say(`You're already on the ${current.name} plan.`);
          return;
        }
        if (productFor[planId] && !payments) {
          // Demo checkout: only test owners may "buy" a plan with simulated payments (the server checks this too).
          const d = await global.FogPayments.demo();
          if (d.demoPayments && d.testOwner) {
            const product = 'plan_' + productFor[planId] + '_' + btn.dataset.period;
            const prices = { plan_dm_monthly: 399, plan_dm_yearly: 4549, plan_fogger_monthly: 599, plan_fogger_yearly: 6829 };
            global.FogPayments.buyWithDemoCheckout({ type: 'plan', ref: product, title: planName + (btn.dataset.period === 'yearly' ? ' (yearly)' : ' (monthly)'), unitCents: prices[product], kindLabel: 'Plan (test owner, demo payment)' });
            return;
          }
          // Say exactly what is missing for a demo purchase.
          if (d.notSetUp) { say(`${planName} can't be bought with demo payments yet: the demo checkout isn't set up on the server. Run supabase/migrations/20261117120000_marketplace.sql in the SQL Editor.`); return; }
          if (d.demoPayments && !d.testOwner) { say(`Demo payments are on, but only configured test owners can buy plans with them (so nobody gives themselves a plan for free). Add your user id to public.dev_test_owners, then reload this page.`); return; }
          if (!d.demoPayments && d.testOwner) { say(`You're a test owner, but demo payments are switched off. Turn them on: update public.app_flags set enabled = true where key = 'demo_payments'; then reload this page.`); return; }
        }
        if (!productFor[planId] || !payments) {
          say(productFor[planId]
            ? `${planName} can't be purchased yet because payments aren't set up. You're on the ${current.name} plan (${current.priceLabel}) in the meantime.`
            : 'Passes and the free plan have no checkout here yet.');
          return;
        }
        btn.setAttribute('aria-busy', 'true');
        say(`Opening the secure checkout for ${planName}…`);
        const res = await global.FogPayments.buy('plan_' + productFor[planId] + '_' + btn.dataset.period);
        btn.removeAttribute('aria-busy');
        if (!res.ok) say(res.message);
      });
    });

    // Back from the checkout: the plan appears once the provider's webhook has arrived (a few seconds). Poll, don't assume.
    if (/[?&]checkout=success/.test(global.location.search)) {
      say('Thank you! Confirming your payment with the provider…');
      let tries = 0;
      const timer = global.setInterval(async () => {
        tries += 1;
        const plan = await account.refreshPlan();
        if (plan.id !== 'warlord') { global.clearInterval(timer); say(`Your ${plan.name} plan is active. Enjoy!`); }
        else if (tries >= 20) { global.clearInterval(timer); say('The payment hasn’t been confirmed yet. It can take a minute: reload this page shortly. If your plan still doesn’t appear, contact support with your receipt.'); }
      }, 3000);
      cleanupTimers.push(() => global.clearInterval(timer));
    }

    return function cleanup() {
      observer.disconnect();
      global.removeEventListener('fog:account', describe);
      cleanupTimers.forEach((fn) => fn());
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.upgrade = init;
})(window);
