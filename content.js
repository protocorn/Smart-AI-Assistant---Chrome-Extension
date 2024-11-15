/*document.addEventListener('click', (event) => {
  if (event.target.closest('span[role="link"].ams.bkH') || event.target.textContent.trim() === 'Reply') {
    const threadId = getThreadIdFromGmail();
      if (replyBox) {
        if (threadId) {
          attachGenerateEmailButtonToReplyBox(threadId);
        }
      }
  }
});*/


let currentPopup = null; 
let obs = false;

// Observer for the compose button popup
const observer = new MutationObserver(() => {
  const composeButton = document.querySelector('.T-I.T-I-KE.L3');

  if (composeButton && !composeButton.dataset.popupAttached) {
      composeButton.dataset.popupAttached = "true";
      composeButton.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'showPopupInCompose' });

          setTimeout(attachRefineButton, 500);
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
          bodyInput.innerHTML = request.body;
      }
  } else if (request.action === "displaySummary" && request.summary) {
      displaySummaryPopup(request.summary);  // Call the popup display function for summaries
  }
});

let currentThreadId = null;

// Inject the "Summarize Thread" button
function injectSummarizeButton(threadId) {
  let summarizeButton = document.getElementById('summarize-thread-button');

  if (summarizeButton) {
      summarizeButton.remove();  // Clear the old button to avoid duplicates
  }

  summarizeButton = document.createElement('button');
  summarizeButton.id = 'summarize-thread-button';
  summarizeButton.textContent = 'Summarize Thread';
  summarizeButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 20px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      z-index: 1000;
  `;

  document.body.appendChild(summarizeButton);
  obs=true;

  summarizeButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'summarizeThread', threadId });
  });
}

// Display the summary popup with "Regenerate Summary" option
function displaySummaryPopup(summary) {
  if (currentPopup) {
    // If popup already exists, update the content
    currentPopup.querySelector('p').textContent = summary;
  } else {
    // Create a new popup if it doesn't exist
    currentPopup = document.createElement('div');
    currentPopup.id = 'summary-popup';
    currentPopup.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        padding: 15px;
        background-color: #fff;
        color: #333;
        border: 1px solid #ddd;
        border-radius: 5px;
        max-width: 300px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        z-index: 1000;
    `;

    currentPopup.innerHTML = `
        <h4>Thread Summary</h4>
        <p>${summary}</p>
        <button id="regenerate-summary">Regenerate Summary</button>
        <button id="close-summary-popup">Close</button>
    `;

  document.body.appendChild(currentPopup);

  // Event listener for the Regenerate Summary button
  document.getElementById('regenerate-summary').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'summarizeThread', threadId: currentThreadId });
  });

  // Event listener for the Close button
  document.getElementById('close-summary-popup').addEventListener('click', () => {
      document.body.removeChild(currentPopup);
      currentPopup = null; // Reset the currentPopup reference when closed
  });
}
}

// Remove the "Summarize Thread" button
function removeSummarizeButton() {
  const summarizeButton = document.getElementById('summarize-thread-button');
  if (summarizeButton) {
      summarizeButton.remove();
      obs=false;
  }
}

if(obs){
// Monitor changes in the page to detect navigation
const pageChangeObserver = new MutationObserver(() => {
  // Check if the "Summarize Thread" button is present
  const currentSummarizeButton = document.getElementById('summarize-thread-button');
  if (currentSummarizeButton) {
      removeSummarizeButton();  // Remove button if navigation occurs
  }
});
// Start observing for changes in the body of the document
pageChangeObserver.observe(document.body, { childList: true, subtree: true });
}

function attachGenerateEmailButtonToReplyBox(currentThreadId) {
  const replyBox = document.querySelector('.editable[aria-label="Message Body"]'); // Select the reply box

  if (replyBox) {
    // Ensure the button is added only once
    if (replyBox && !document.getElementById('generate-email-button')) {
      const generateButton = document.createElement('button');
      generateButton.id = 'generate-email-button';
      generateButton.textContent = 'Generate Email';
      generateButton.style.cssText = `
          position: sticky;
          top: ${replyBox.offsetTop + 5}px;
          left: ${replyBox.offsetLeft + replyBox.offsetWidth + 10}px;
          padding: 6px 12px;
          background-color: #1a73e8;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          z-index: 10000;
      `;

      // Append the button to the parent container
      replyBox.parentElement.style.position = 'relative'; // Ensure parent is positioned
      replyBox.parentElement.appendChild(generateButton);

      // Listener for "Generate Reply" button click
      generateButton.addEventListener('click', () => {
        // Send the body text to the Prompt API
        chrome.runtime.sendMessage({
            action: 'getThreadAndGenerateResponse',
            threadId: currentThreadId
        });
      });
    }
  } else {
    // If the reply box is not available yet, use a MutationObserver to detect when it appears
    const observer = new MutationObserver(() => {
      const replyBox = document.querySelector('.editable[aria-label="Message Body"]');
      if (replyBox) {
        attachGenerateEmailButtonToReplyBox(currentThreadId);
        observer.disconnect();  // Stop observing once the button is added
      }
    });

    // Start observing the DOM for changes
    observer.observe(document.body, { childList: true, subtree: true });
  }
}


// Observe clicks to detect reply actions
document.addEventListener('click', function(event) {
  console.log('Clicked element:', event.target);  // Log the clicked element
  if (event.target && (event.target.matches('span[role="link"].ams.bkH') || event.target.textContent.trim() === 'Reply')) {
    console.log("Reply button clicked, using currentThreadId:", currentThreadId);
    // Observe for the reply box to dynamically inject the button
    //const observer2 = new MutationObserver(() => {
      //const replyBox = document.querySelector('.editable[aria-label="Message Body"]');
    if (currentThreadId) {
        attachGenerateEmailButtonToReplyBox(currentThreadId);
    } 
    else {
      console.error("No thread ID found when replying.");
    }
    //});

    // Start observing for changes in the DOM
    //observer2.observe(document.body, { childList: true, subtree: true });
  }
});


// Extract the thread ID from email element
function getThreadIdFromEmail(emailElement) {
  const threadIdElement = emailElement.querySelector('[data-legacy-thread-id]');
  if (threadIdElement) {
    return threadIdElement.getAttribute('data-legacy-thread-id');
  }
  return null;
}

// Observer to track clicks on email rows
const emailobserver = new MutationObserver(() => {
  const emailRows = document.querySelectorAll('tr[jscontroller="ZdOxDb"]');

  emailRows.forEach(row => {
    row.addEventListener('click', () => {
      const threadId = getThreadIdFromEmail(row);
      if (threadId && threadId !== currentThreadId) {
        currentThreadId = threadId;
        console.log('Updated currentThreadId:', currentThreadId);

        injectSummarizeButton(currentThreadId);  // Inject with new thread ID
      }
    });
  });
});

emailobserver.observe(document.body, { childList: true, subtree: true });

// Function to attach the Refine button in the compose box
function attachRefineButton() {
  const composeBox = document.querySelector('.editable[aria-label="Message Body"]');
  const subjectInput = document.querySelector('input[name="subjectbox"]');

  if (composeBox && !document.getElementById('refine-buttons-container')) {
    const buttonsContainer = document.createElement('div');
    buttonsContainer.id = 'refine-buttons-container';
    buttonsContainer.style.cssText = `
        position: sticky;  /* Fixed position relative to the compose box */
        top: 10px;  /* Adjust to desired position */
        right: 10px;
        display: flex;  /* Use flexbox for side-by-side layout */
        gap: 10px;  /* Add spacing between buttons */
        z-index: 10000;  /* High z-index to ensure visibility */
    `;

      const refineButton = document.createElement('button');
      refineButton.id = 'refine-body-button';
      refineButton.textContent = 'Refine Body';
      refineButton.style.cssText = `
        padding: 6px 12px;
        background-color: #1a73e8 !important;
        color: white !important;
        border: 1px solid #ccc !important;
        border-radius: 5px !important;
        cursor: pointer !important;
      `;

      // Listener for Refine button click
      refineButton.addEventListener('click', () => {
        const bodyText = composeBox.innerText;
        if (bodyText) {
            // Send the body text to the Prompt API
            chrome.runtime.sendMessage({
                action: 'refineBodyText',
                text: bodyText
            });
        }
      });

    const refineButton2 = document.createElement('button');
    refineButton2.id = 'refine-subject-button';
    refineButton2.textContent = 'Refine Subject';
    refineButton2.style.cssText = `
       padding: 6px 12px;
       margin-left: 10px;
        background-color: #1a73e8 !important;
        color: white !important;
        border: 1px solid #ccc !important;
        border-radius: 5px !important;
        cursor: pointer !important;
    `;
    composeBox.parentElement.style.position = 'relative'; // Ensure parent is positioned
    composeBox.parentElement.appendChild(buttonsContainer);
    composeBox.appendChild(refineButton);
    composeBox.appendChild(refineButton2);

    // Listener for Refine button click
    refineButton2.addEventListener('click', () => {
      const subText = subjectInput.value;
          if (subText) {
              // Send the body text to the Prompt API
              chrome.runtime.sendMessage({
                  action: 'refineSubjectText',
                  text: subText
              });
          }
    });
  }
}

// Listen for refined text from the background script
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "fillRefinedText" && request.refinedText) {
      const composeBox = document.querySelector('.editable[aria-label="Message Body"]');
      if (composeBox) {
          composeBox.innerHTML = request.refinedText; // Replace with refined content
          attachRefineButton()
      }
  }
  else if(request.action === "fillRefinedSub" && request.refinedText) {
    const subjectInput = document.querySelector('input[name="subjectbox"]');
    if (subjectInput) {
        subjectInput.value = request.refinedText; // Replace with refined content
        attachRefineButton()
    }
}
});