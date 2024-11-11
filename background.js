chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showPopupInCompose') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url.includes("https://mail.google.com/")) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: injectComposeUI
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to inject content script:", chrome.runtime.lastError);
            sendResponse({ error: "Failed to inject content script." });
          } else {
            sendResponse({ success: true });
          }
        });
      } else {
        console.error("No active Gmail tab found.");
        sendResponse({ error: "No active Gmail tab found." });
      }
    });
    return true; // Keeps sendResponse valid for async use
  }

  if (request.action === "generateEmail") {
    const prompt = "First line would be the Subject and rest would be the body. " +
                   "Strictly follow this format and no other text before the subject should be present." + 
                   request.prompt;

    (async () => {
      try {
        console.log("Creating language model session...");
        const session = await ai.languageModel.create();

        console.log("Sending prompt:", prompt);
        const response = await session.prompt(prompt);

        // Split the response into subject and body
        const subject = response.split("\n")[0];
        const body = response.split("\n").slice(1).join("\n");

        // Send subject and body back to content.js for direct insertion
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "fillEmail", subject, body });
          }
        });

        sendResponse({ success: true });
      } catch (error) {
        console.error("Error generating email:", error);
        sendResponse({ error: "Failed to generate email." });
      }
    })();

    return true;
  }
});

function injectComposeUI() {
  const composeWindow = document.querySelector('.T-I.T-I-KE.L3');

  if (!composeWindow) return;

  if (document.getElementById('compose-ui-container')) {
    // If already injected, do nothing
    return;
  }

  const uiContainer = document.createElement('div');
  uiContainer.id = 'compose-ui-container';
  uiContainer.innerHTML = `
    <div style="position: absolute; top: 50px; left: 20px; background-color: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); z-index: 10000;">
      <h4>Generate Email</h4>
      <button id="closePopup" style="position: absolute; top: 5px; right: 5px; background: none; border: none; font-size: 16px; cursor: pointer;">✖</button>
      <input type="text" id="prompt" placeholder="Enter prompt for email" style="width: 100%; margin-bottom: 10px; padding: 8px;" />
      <button id="generateEmail" style="width: 100%; padding: 10px; background-color: #4CAF50; color: white; font-size: 14px; border: none; cursor: pointer;">Generate Email</button>
    </div>
  `;

  document.body.appendChild(uiContainer);

  // Close button functionality
  document.getElementById('closePopup').addEventListener('click', () => {
    uiContainer.remove();
  });

  const generateButton = document.getElementById('generateEmail');
  const promptInput = document.getElementById('prompt');

  generateButton.addEventListener('click', () => {
    const prompt = promptInput.value.trim();

    if (!prompt) {
      alert("Please enter a prompt!");
      return;
    }

    // Show generating text and disable button
    generateButton.textContent = "Generating...";
    generateButton.disabled = true;

    // Call background to generate email
    chrome.runtime.sendMessage({ action: "generateEmail", prompt: prompt }, (response) => {
      if (response && response.success) {
        // Reset button text and clear prompt
        generateButton.textContent = "Generate Email";
        generateButton.disabled = false;
        promptInput.value = ""; // Clear the prompt
        //uiContainer.remove(); // Close the popup after generating
      } else {
        alert("An error occurred while generating the email.");
        generateButton.textContent = "Generate Email";
        generateButton.disabled = false;
      }
    });
  });
}
