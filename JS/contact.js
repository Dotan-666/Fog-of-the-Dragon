/**
 * Contact page: there is no message backend yet, so "Send Message" opens the visitor's email app
 * with the message addressed to the support address shown on the page.
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('contact-status');
  const supportEmail = 'support@fogofthedragon.com';

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const topic = document.getElementById('contact-subject');
      const message = document.getElementById('contact-message').value.trim();
      const subject = `[${topic.options[topic.selectedIndex].text}] Message from ${name}`;
      const body = `${message}\n\n— ${name} (${email})`;
      window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      if (status) {
        status.textContent = `Your email app should open with this message addressed to ${supportEmail}. If nothing happens, email us directly.`;
        status.hidden = false;
      }
    });
  }

  const discord = document.querySelector('.community-btn');
  if (discord) {
    discord.addEventListener('click', (e) => {
      e.preventDefault();
      if (status) {
        status.textContent = 'The community Discord server isn’t open yet. Use the form or email us in the meantime.';
        status.hidden = false;
        status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }
});
