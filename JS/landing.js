/* ==========================================================================
   FOG OF THE DRAGON - Interactive Logic (landing.js) - landing page
   File: JD/landing.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Menu Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      const expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
      mobileToggle.setAttribute('aria-expanded', !expanded);
      navLinks.classList.toggle('active');
    });
  }

  // FAQ Accordion Interactivity
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all items
      faqItems.forEach(i => {
        i.classList.remove('open');
        const btn = i.querySelector('.faq-trigger');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });

      // Toggle current item if it wasn't open
      if (!isOpen) {
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Scroll Intersection Observer for smooth Fade-in Animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
});

// Pricing Tab Switcher Function
function switchPricingTab(category) {
  const subView = document.getElementById('subscriptionsView');
  const passView = document.getElementById('passesView');
  const subBtn = document.getElementById('tabSubscriptionsBtn');
  const passBtn = document.getElementById('tabPassesBtn');

  if (category === 'subscriptions') {
    subView.classList.add('active');
    passView.classList.remove('active');
    subBtn.classList.add('active');
    passBtn.classList.remove('active');
  } else {
    passView.classList.add('active');
    subView.classList.remove('active');
    passBtn.classList.add('active');
    subBtn.classList.remove('active');
  }
}