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

let currentThreadId = null; 

//new code
document.addEventListener('click', function(event) {
  console.log('Clicked element:', event.target);  // Log the clicked element
  if (event.target && event.target.matches('span[role="link"].ams.bkH') || event.target.textContent.trim() === 'Reply') {
    console.log("Reply button clicked, using currentThreadId:", currentThreadId);

    if (currentThreadId) {
      // Send the current threadId to the background script to generate the response
      chrome.runtime.sendMessage({
        action: 'getThreadAndGenerateResponse',
        threadId: currentThreadId
      });
    } else {
      console.error("No thread ID found when replying.");
    }

  }
});

// Function to get thread ID from the clicked email element
function getThreadIdFromEmail(emailElement) {
  const threadIdElement = emailElement.querySelector('[data-legacy-thread-id]');
  if (threadIdElement) {
    return threadIdElement.getAttribute('data-legacy-thread-id');
  }
  return null; // Return null if thread ID is not found
}

// Observer to track clicks on email rows
const emailobserver = new MutationObserver(() => {
  const emailRows = document.querySelectorAll('tr[jscontroller="ZdOxDb"]'); // Identifying email rows in Gmail

  // For each email row, attach a click event listener
  emailRows.forEach(row => {
    row.addEventListener('click', () => {
      const threadId = getThreadIdFromEmail(row);
      if (threadId && threadId !== currentThreadId) {
        currentThreadId = threadId;
        console.log('Updated currentThreadId:', currentThreadId);
      }
    });
  });
});

// Observe the DOM for changes to detect new emails being loaded or clicked
emailobserver.observe(document.body, { childList: true, subtree: true });



