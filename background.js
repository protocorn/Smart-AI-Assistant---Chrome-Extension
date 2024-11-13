chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  if (request.action === 'getThreadAndGenerateResponse') {
    const threadId = request.threadId;

    // Get the OAuth token (you might already have it)
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error("Authentication failed:", chrome.runtime.lastError);
        sendResponse({ error: "Authentication failed" });
        return;
      }

      // Call Gmail API to get the thread
      getEmailThread(token, threadId)
        .then((messages) => {
          // Generate a response based on the thread content
          const emailContent = messages.map(msg => {
            // Include both the message snippet and the sender context
            return `${msg.sender.senderName} (${msg.sender.senderEmail}): ${msg.snippet}`;
          }).join("\n");
          
          // Add more details to the prompt for clarity and context
          const prompt = `See the following thread, and write a reply email in ENGLISH from my side for the last email sent by them. This should strictly contain only the body of the mail:
          ${emailContent}`;

          console.log("Prompt being sent to AI model: ", prompt);

          (async () => {
            try {
              console.log("Creating language model session...");
              const session = await ai.languageModel.create();
      
              console.log("Sending prompt:", );
              const response = await session.prompt(prompt);
              console.log(response)
      
              // Split the response into subject and body
              const subject = response.split("\n")[0];
              const body = response.split("\n").slice(1).join("\n");
      
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                  const tab = tabs[0];
                  if (tab.url && tab.url.includes("https://mail.google.com/")) {
                    chrome.tabs.sendMessage(tab.id, { action: "fillEmail", subject, body });
                  } else {
                    console.error("No active Gmail tab found.");
                    sendResponse({ error: "No active Gmail tab found." });
                  }
                } else {
                  console.error("No active tabs found.");
                  sendResponse({ error: "No active tabs found." });
                }
              });
      
              sendResponse({ success: true });
            } catch (error) {
              console.error("Error generating email:", error);
              sendResponse({ error: "Failed to generate email." });
            }
          })();
        });
    });

    // Return true to indicate we're sending a response asynchronously
    return true;
  }
  else if (request.action === 'showPopupInCompose') {
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

  else if (request.action === "generateEmail") {
    const prompt = "You have to compose an email for me.First line would be the Subject and rest would be the body. " +
                   "Strictly follow this format and no other text before the subject should be present. This is some reference for you: " + 
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

chrome.runtime.onInstalled.addListener(() => {
  // Attempt to get the OAuth token when the extension is installed or launched
  getOAuthToken();
});

function getOAuthToken() {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError || !token) {
      console.error("Failed to get the auth token:", chrome.runtime.lastError);
      return;
    }

    // Token is retrieved; check if it needs to be refreshed
    const expiresIn = 3600; // Example value, you'll want to use actual expiration data
    if (isTokenExpired(token, expiresIn)) {
      // Refresh token logic
      refreshOAuthToken(token);
    } else {
      console.log("Authenticated! Token:", token);
    }
  });
}

function isTokenExpired(token, expiresIn) {
  const expirationTime = Date.now() / 1000 + expiresIn; // Convert expiresIn to seconds and compare
  return expirationTime < Date.now() / 1000;
}

// Refresh token (force=true forces a new token)
function refreshOAuthToken(currentToken) {
  chrome.identity.getAuthToken({ force: true }, (newToken) => {
    if (chrome.runtime.lastError || !newToken) {
      console.error("Failed to refresh the auth token:", chrome.runtime.lastError);
      return;
    }

    console.log("Refreshed token:", newToken);
  });
}

async function getEmailThread(token, threadId) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`;


  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch thread');
  }

  const data = await response.json();
  const messages = data.messages.map(msg => {
    const sender = extractSenderInfo(msg);
    const snippet = getMessageText(msg);
    return { sender, snippet };
  });
  return messages; // This will return an array of messages in the thread
}

function extractSenderInfo(message) {
  const headers = message.payload.headers;
  let senderName = '';
  let senderEmail = '';

  // Look through headers to find the 'From' field
  headers.forEach(header => {
    if (header.name === 'From') {
      const from = header.value;
      const matches = from.match(/(.+?) <(.+)>/); // Regex to extract name and email
      if (matches) {
        senderName = matches[1];
        senderEmail = matches[2];
      } else {
        // If no angle brackets, it's just the email address
        senderName = from;
      }
    }
  });

  return { senderName, senderEmail };
}

function getMessageText(message) {
  const parts = message.payload.parts;
  let messageText = '';

  // Iterate through parts and find the plain text version
  parts.forEach(part => {
    if (part.mimeType === 'text/plain') {
      messageText = part.body.data ? atob(part.body.data.replace(/_/g, '/').replace(/-/g, '+')) : '';
    }
  });

  return messageText || 'No message content found.';
}

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
