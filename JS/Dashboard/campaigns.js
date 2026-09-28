document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('join-campaign-modal');
  const btnHeader = document.getElementById('btn-join-campaign-header');
  const btnEmpty = document.getElementById('btn-empty-join');
  const btnClose = document.getElementById('modal-close-btn');
  const btnCancel = document.getElementById('modal-cancel-btn');
  const codeInput = document.getElementById('campaign-code-input');

  function openModal() {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => codeInput.focus(), 100);
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    codeInput.value = '';
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
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
});