const observer = new MutationObserver(() => {
  const composeButton = document.querySelector('.T-I.T-I-KE.L3');

  if (composeButton && !composeButton.dataset.popupAttached) {
      composeButton.dataset.popupAttached = "true";
      composeButton.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'showPopupInCompose' });
      });
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages to fill in the email subject and body
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "fillEmail") {
      const subjectInput = document.querySelector('input[name="subjectbox"]');
      const bodyInput = document.querySelector('.editable[aria-label="Message Body"]');

      if (subjectInput && bodyInput) {
          subjectInput.value = request.subject;
          bodyInput.innerHTML = request.body;  // .innerHTML to handle HTML formatting if needed
      }
  }
});
