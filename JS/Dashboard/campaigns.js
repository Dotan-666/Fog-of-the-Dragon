/**
 * Campaigns page init (runs each time the router loads campaigns.html)
 */
(function (global) {
  'use strict';

  function init(container) {
    const modal = container.querySelector('#join-campaign-modal');
    const btnHeader = container.querySelector('#btn-join-campaign-header');
    const btnEmpty = container.querySelector('#btn-empty-join');
    const btnClose = container.querySelector('#modal-close-btn');
    const btnCancel = container.querySelector('#modal-cancel-btn');
    const codeInput = container.querySelector('#campaign-code-input');
    const btnCreate = container.querySelector('#btn-create-campaign-header');

    if (btnCreate) {
      btnCreate.addEventListener('click', () => global.FogDashboardRouter.navigateTo('#create-campaign'));
    }
    if (!modal) return null;

    function openModal() {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => codeInput && codeInput.focus(), 100);
    }

    function closeModal() {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      if (codeInput) codeInput.value = '';
    }

    // Open triggers
    if (btnHeader) btnHeader.addEventListener('click', openModal);
    if (btnEmpty) btnEmpty.addEventListener('click', openModal);

    // Close triggers
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Close on Escape key
    function onKeydown(e) {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
      }
    }
    document.addEventListener('keydown', onKeydown);

    return function cleanup() {
      document.removeEventListener('keydown', onKeydown);
    };
  }

  global.FogPageInits = global.FogPageInits || {};
  global.FogPageInits.campaigns = init;
})(window);
