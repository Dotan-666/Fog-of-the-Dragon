/**
 * Global footer injected into Dashboard and Campaign shells.
 * The landing page (index.html) has its own static footer with the same structure.
 */
(function (global) {
  'use strict';

  var PREFIX = '';
  if (location.pathname.indexOf('/Pages/') !== -1) PREFIX = '../';

  var isSPA = /\/(dashboard|campaign)\.html/.test(location.pathname);
  var termsHref = isSPA ? '#terms' : PREFIX + 'Pages/Terms&Privacy/terms.html';
  var privacyHref = isSPA ? '#privacy' : PREFIX + 'Pages/Terms&Privacy/privacy.html';

  function footerHTML() {
    return '<footer class="site-footer">' +
      '<div class="container footer-container">' +
        '<div class="footer-brand">' +
          '<a href="' + PREFIX + 'index.html" class="brand-logo" aria-label="Fog of the Dragon Home">' +
            '<svg class="brand-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M16 3L4 9L16 15L28 9L16 3Z" stroke="currentColor" stroke-width="2"/>' +
              '<path d="M4 17L16 23L28 17" stroke="currentColor" stroke-width="2"/>' +
              '<path d="M4 23L16 29L28 23" stroke="#d62839" stroke-width="2"/>' +
            '</svg>' +
            '<span class="brand-name">FOG OF THE DRAGON</span>' +
          '</a>' +
          '<p class="footer-tagline">"Make the table better."</p>' +
          '<p class="copyright">&copy; 2026 Fog of the Dragon. All rights reserved.</p>' +
        '</div>' +
        '<div class="footer-nav">' +
          '<div class="footer-col">' +
            '<h4>Platform</h4>' +
            '<a href="' + PREFIX + 'Pages/dashboard.html#marketplace">Marketplace</a>' +
            '<a href="' + PREFIX + 'Pages/dashboard.html#bestiary-spells">Bestiary</a>' +
            '<a href="' + PREFIX + 'index.html#pricing">Pricing</a>' +
            '<a href="' + PREFIX + 'index.html#features">Meeting in the Fog</a>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h4>Creators</h4>' +
            '<a href="' + PREFIX + 'Pages/creators.html">Become a Creator</a>' +
            '<a href="' + PREFIX + 'Pages/creators.html#guidelines">Creator Guidelines</a>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h4>Legal &amp; Support</h4>' +
            '<a href="' + termsHref + '">Terms of Service</a>' +
            '<a href="' + privacyHref + '">Privacy Policy</a>' +
            '<a href="' + PREFIX + 'Pages/contact.html">Contact &amp; Support</a>' +
            '<a href="' + PREFIX + 'Pages/about.html">About Us</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="container footer-bottom">' +
        '<p class="footer-attribution">Game rules content is available under the <a href="https://opengamefoundation.org/ogl/ogl-1-0a/" target="_blank" rel="noopener">Open Game License v1.0a</a> and <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">Creative Commons Attribution 4.0</a>. Copyright/DMCA inquiries: <span class="footer-email">support&#64;fogofthedragon.com</span></p>' +
      '</div>' +
    '</footer>';
  }

  function inject() {
    if (document.querySelector('.site-footer')) return;
    var main = document.querySelector('main.dashboard-content') || document.querySelector('main');
    if (!main) return;
    main.insertAdjacentHTML('afterend', footerHTML());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  global.FogFooter = { inject: inject };
})(window);
