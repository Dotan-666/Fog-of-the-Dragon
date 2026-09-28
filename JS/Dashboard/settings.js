// 1. Accordions Logic
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('open');
      });
    });

    // 2. Dynamic Sliders Logic
    function updateSliderValue(slider, targetId) {
      document.getElementById(targetId).textContent = slider.value + '%';
    }

    // 3. Delete Confirmation Modal Logic
    let currentDeleteAction = null;
    const modal = document.getElementById('delete-modal');
    const confirmInput = document.getElementById('confirm-input');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const modalTitle = document.getElementById('modal-title');

    function openDeleteModal(actionType) {
      currentDeleteAction = actionType;
      confirmInput.value = '';
      confirmBtn.disabled = true;

      if (actionType === 'account') {
        modalTitle.textContent = 'Delete Entire Account?';
      } else {
        modalTitle.textContent = 'Clear All Campaign Data?';
      }

      modal.classList.add('active');
      confirmInput.focus();
    }

    function closeDeleteModal() {
      modal.classList.remove('active');
    }

    confirmInput.addEventListener('input', (e) => {
      confirmBtn.disabled = e.target.value.trim() !== 'DELETE';
    });

    function executeDeletion() {
      if (confirmInput.value.trim() === 'DELETE') {
        alert(currentDeleteAction === 'account' ? 'Account Deleted.' : 'Campaign Data Cleared.');
        closeDeleteModal();
      }
    }