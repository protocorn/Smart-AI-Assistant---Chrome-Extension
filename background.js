chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  
  console.log('Received message:', request);
  chrome.storage.sync.get(["compose_email", "generate_reply", "refine_text", "summarize_thread", "highlight_phrase"], function(data) {
    const flagComposeEmail = data.compose_email !== false;
    const flagGenerateReply = data.generate_reply !== false;
    const flagRefineText = data.refine_text !== false;
    const flagSummarizeThread = data.summarize_thread !== false;
    const flagHighlightPhrase = data.highlight_phrase !== false;

  //------------------------------------------------------------------------//
  //--------------------GENERATE A REPLY FOR A THREAD-----------------------//
  //------------------------------------------------------------------------//

  if (request.action === 'getThreadAndGenerateResponse' && flagGenerateReply) {
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
          const prompt = `See the following thread, and write a reply email in ENGLISH from my side. This should strictly contain only the body of the mail:
          ${emailContent}`;

          console.log("Prompt being sent to AI model: ", prompt);

          processPrompt(prompt, 'Generate Email').then(response => {
            const subject = response.split("\n")[0];
            const body = response.split("\n").slice(1).join("\n");
            // Send subject and body back to content.js for direct insertion
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
          })();
        });

    });

    // Return true to indicate we're sending a response asynchronously
    return true;
  }

  //------------------------------------------------------------------------//
  //-----------------------------SUMMARIZE A THREAD-------------------------//
  //------------------------------------------------------------------------//

  else if (request.action === 'summarizeThread' && flagSummarizeThread) {
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
          const prompt = `Summarize this:
          ${emailContent}`;

          console.log("Prompt being sent to AI model: ", prompt);

          (async () => {
            try {
              console.log("Creating language model session...");
              summarizer = await ai.summarizer.create();

              console.log("Sending prompt:",);
              const result2 = await summarizer.summarize(prompt);

              console.log(result2)

              // Send the summary back to content.js
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                  chrome.tabs.sendMessage(tabs[0].id, { action: "displaySummary", summary: result2 });
                  summarizer.destroy();
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

  //------------------------------------------------------------------------//
  //--------------OPENING A POP ON CLICKING COMPOSE BUTTON------------------//
  //------------------------------------------------------------------------//

  else if (request.action === 'showPopupInCompose' && flagComposeEmail) {
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

  //------------------------------------------------------------------------//
  //-------------------GENERATE AN EMAIL BASED ON PROMPT--------------------//
  //------------------------------------------------------------------------//

  else if (request.action === "generateEmail" && flagComposeEmail) {
    const prompt = `Compose an email using the following context. The first line should be the subject, followed by the body text. Do not include any additional text or format deviations before or after the subject line. 

Context:
${request.prompt}`;
    processPrompt(prompt, 'Generate Email').then(response => {
      const subject = response.split("\n")[0];
      const body = response.split("\n").slice(1).join("\n");
      // Send subject and body back to content.js for direct insertion
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "fillEmail", subject, body });
        }
      });

      sendResponse({ success: true });
    });

    return true;
  }

  //------------------------------------------------------------------------//
  //---------------------REFINE BODY TEXT OF AN EMAIL-----------------------//
  //------------------------------------------------------------------------//

  else if (request.action === "refineBodyText" && flagRefineText) {
    const prompt = `Refine the following email for me. This should striclty contain the body of the email and other additional details are not needed. Not even the subject.:
Email:
${request.text}`;

    processPrompt(prompt, 'Refine Body').then(response => {
      // Send subject and body back to content.js for direct insertion
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "fillRefinedText", refinedText: response });
        }

      });

      sendResponse({ success: true });
    });


    return true;
  }

  //------------------------------------------------------------------------//
  //--------------------REFINE SUBJECT TEXT OF AN EMAIL---------------------//
  //------------------------------------------------------------------------//

  else if (request.action === "refineSubjectText" && flagRefineText) {
    const prompt = `Refine the following subject of an email for me. This should striclty contain only the subject of the email, any other text is prohibited :
Subject of Email:
${request.text}`;
    processPrompt(prompt, 'Refine Subject').then(response => {
      // Send subject and body back to content.js for direct insertion
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "fillRefinedSub", refinedText: response });
        }

      });

      sendResponse({ success: true });
    });

    return true;
  }

  //------------------------------------------------------------------------//
  //----------------HIGHLIGHT IMPORTANT PHRASES IN AN EMAILL----------------//
  //------------------------------------------------------------------------//

  else if (request.action === 'highlightPhrases' && flagHighlightPhrase) {
    const threadId = request.threadId;

    // Get the OAuth token (you might already have it)
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error("Authentication failed:", chrome.runtime.lastError);
        sendResponse({ error: "Authentication failed" });
        return;
      }

      // Call Gmail API to get the thread
      getEmailMessage(token, threadId)
        .then((messages) => {
          // Generate a response based on the thread content
          const emailContent = messages.map(msg => {
            // Include both the message snippet and the sender context
            return `${msg.sender.senderName} (${msg.sender.senderEmail}): ${msg.snippet}`;
          }).join("\n");

          // Add more details to the prompt for clarity and context
          const prompt = `Analyze the following email and identify the key phrases (word-for-word) that you believe are most important for highlighting. Return the results in the following format:

          1. [Important phrase 1]  
          2. [Important phrase 2]  
          ...  
          (Include only the top 5-10 phrases that you consider highly important based on the content of the email.)

          Here is the email content:
          ${emailContent}`;

          console.log("Prompt being sent to AI model: ", prompt);

          processPrompt(prompt, 'Highlight Phrases').then(response => {
            console.log(response)

            const phrases = response
              .split("\n") // Split response by lines
              .map(line => line.trim()) // Trim each line to avoid leading/trailing spaces
              .filter(line => line.match(/^\d+\.\s+/)) // Match lines that start with "1." or "2." etc.
              .map(line => {
                // Remove the number and period (e.g., "1." -> "")
                return line.replace(/^\d+\.\s*/, "").trim();
              });

            console.log(phrases)

            // Send subject and body back to content.js for direct insertion
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs.length > 0) {
                const tab = tabs[0];
                if (tab.url && tab.url.includes("https://mail.google.com/")) {
                  chrome.tabs.sendMessage(tab.id, { action: "highlight", phrase: phrases, email: emailContent });
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
          });
        });

    });

    // Return true to indicate we're sending a response asynchronously
    return true;
  }
});
});

chrome.runtime.onInstalled.addListener(() => {
  // Attempt to get the OAuth token when the extension is installed or launched
  getOAuthToken();
});

//------------------------------------------------------------------------//
//---------------------FUCNTION TO PROCESS THE PROMPT---------------------//
//------------------------------------------------------------------------//

async function processPrompt(prompt, actionType) {
  try {
    console.log(`Creating session for action: ${actionType}`);
    const session = await ai.languageModel.create();
    console.log("Sending prompt:", prompt);
    const response = await session.prompt(prompt);
    session.destroy(); // Clean up session after use
    return response;
  } catch (error) {
    console.error(`Error in ${actionType}:`, error);
    throw error;
  }
}

//------------------------------------------------------------------------//
//---------------------FUCNTIONS FOR OAUTH.20 TOKENS----------------------//
//------------------------------------------------------------------------//


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
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch thread');
    const data = await response.json();
    return data.messages.map(msg => ({
      sender: extractSenderInfo(msg),
      snippet: getMessageText(msg)
    }));
  } catch (error) {
    console.error("Error fetching thread:", error);
    throw error;
  }
}

async function getEmailMessage(token, threadId) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to fetch thread');
    const data = await response.json();
    console.log(data);

    // Return only the snippet of each message
    return data.messages.map(msg => ({
      sender: extractSenderInfo(msg),
      snippet: getMessageText(msg)
    }));

  } catch (error) {
    console.error("Error fetching thread:", error);
    throw error;
  }
}

//------------------------------------------------------------------------//
//-------------------FUCNTION TO GET SENDER INFORMATION-------------------//
//------------------------------------------------------------------------//


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

//------------------------------------------------------------------------//
//----------------FUCNTION TO GET PLAIN TEXT FROM THE EMAIL---------------//
//------------------------------------------------------------------------//


function getMessageText(message) {
  const parts = message.payload.parts || [];
  let messageText = '';

  // Iterate through parts and find the plain text version
  for (let part of parts) {
    // Check for plain text MIME type
    if (part.mimeType === 'text/plain') {
      // Extract the body data and decode it
      if (part.body.data) {
        try {
          messageText = atob(part.body.data.replace(/_/g, '/').replace(/-/g, '+'));
        } catch (e) {
          console.error('Failed to decode message content:', e);
          messageText = 'Error decoding message content.';
        }
      }
      break; // Only get the first text/plain part
    }
  }

  return messageText || 'No message content found.';
}

//------------------------------------------------------------------------//
//---------------------------UI OF COMPOSE POPUP--------------------------//
//------------------------------------------------------------------------//


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
      <input type="text" id="prompt" placeholder="Enter prompt for email" style="width: 94%; margin-bottom: 10px; padding: 8px;" />
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
