chrome.runtime.onInstalled.addListener(function(details) {
  const defaultFeatures = {
    "compose_email": true,
    "generate_reply": true,
    "refine_text": true,
    "summarize_thread": true,
    "highlight_phrase": true,
    "translation_api": true,
   //"preferred_language": "en" // Default to English
  };

  chrome.storage.sync.get(Object.keys(defaultFeatures), function(items) {
    let newItems = {};
    for (let key in defaultFeatures) {
      if (items[key] === undefined) {
        newItems[key] = defaultFeatures[key];
      }
    }
    if (Object.keys(newItems).length > 0) {
      chrome.storage.sync.set(newItems);
    }
  });
});

function setCachedData(key, data, expirationMinutes) {
  try {
    const expirationMS = expirationMinutes * 60 * 1000;
    const item = {
      value: data,
      timestamp: Date.now(),
      expiration: expirationMS
    };
    chrome.storage.local.set({ [key]: item });
  } catch (error) {
    console.error("Error in setCachedData:", error);
  }
}

function getCachedData(key, fetchFunction, expirationMinutes) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], async function (result) {
      try {
        const item = result[key];
        const now = Date.now();
        if (item && now - item.timestamp < item.expiration) {
          resolve(item.value);
        } else {
          const data = await fetchFunction();
          setCachedData(key, data, expirationMinutes);
          resolve(data);
        }
      } catch (error) {
        console.error("Error in getCachedData:", error);
        reject(error);
      }
    });
  });
}

// In your background.js file

async function summarizeThread(threadId) {
  const cacheKey = `summary_${threadId}`;
  const expirationMinutes = 60; // Cache summaries for 1 hour

  try {
    const summary = await getCachedData(cacheKey, async () => {
      // This function will be called if the cache is invalid or missing
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });

      const messages = await getEmailThread(token, threadId);
      const emailContent = messages.map(msg =>
        `${msg.sender.senderName} (${msg.sender.senderEmail}): ${msg.snippet}`
      ).join("\n");

      const prompt = `Summarize the following email thread. Focus on: 
        - Actionable points 
        - Key decisions or next steps 
        - Important questions asked or information provided: ${emailContent}`;

      const summarizer = await ai.summarizer.create();
      const summary = await summarizer.summarize(prompt);
      summarizer.destroy();

      return summary;
    }, expirationMinutes);

    return summary;
  } catch (error) {

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "changeSummaryButton",
        });
      }
    });

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon1.jpg",
      title: "Smart Gmail Assistant",
      message: "Failed to Summarize the thread",
      priority: 2
    });

    console.error("Error in summarizeThread:", error);
    throw new Error("Failed to summarize the thread. Please try again.");
  }
}

async function highlightPhrases(threadId) {
  const cacheKey = `highlight_${threadId}`;
  const expirationMinutes = 60; // Cache highlights for 1 hour

  try {
    const phrases = await getCachedData(cacheKey, async () => {
      // This function will be called if the cache is invalid or missing
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });

      const messages = await getEmailMessage(token, threadId);
      const emailContent = messages.map(msg =>
        `${msg.sender.senderName} (${msg.sender.senderEmail}): ${msg.snippet}`
      ).join("\n");

      const prompt = `Give the following result only in English and ignore terms you dont understand. Analyze the following email and identify the key phrases (word-for-word) that you believe are most important for highlighting. Return the results in the following format only:
        1. Important phrase 1
        2. Important phrase 2
        ... (Include only the top 5-10 phrases that you consider highly important based on the content of the email.)
        Here is the email content: ${emailContent}`;

      const response = await processPrompt(prompt, 'Highlight Phrases');
      const phrases = response
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.match(/^\d+\.\s+/))
        .map(line => line.replace(/^\d+\.\s*/, "").trim());

      return phrases;
    }, expirationMinutes);

    return phrases;
  } catch (error) {
    console.error("Error in highlightPhrases:", error);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {


  console.log('Received message:', request);

  try {
    chrome.storage.sync.get(["compose_email", "generate_reply", "refine_text", "summarize_thread", "highlight_phrase"], async function (data) {
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

      if (request.action === 'summarizeThread' && flagSummarizeThread) {
        const threadId = request.threadId;

        // Get the OAuth token (you might already have it)
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError || !token) {
            console.error("Authentication failed:", chrome.runtime.lastError);
            sendResponse({ error: "Authentication failed" });
            return;
          }

        });

        summarizeThread(threadId)
          .then(summary => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "displaySummary", summary: summary });
              }
            });
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error("Error:", error);
            sendResponse({ error: "Failed to summarize thread." });
          });
        return true; // Indicates an asynchronous response
      }

      if (request.action === 're-summarizeThread' && flagSummarizeThread) {
        const threadId = request.threadId;

        // Get the OAuth token (you might already have it)
        chrome.identity.getAuthToken({ interactive: true }, async (token) => {
          if (chrome.runtime.lastError || !token) {
            console.error("Authentication failed:", chrome.runtime.lastError);
            sendResponse({ error: "Authentication failed" });
            return;
          }
          const messages = await getEmailThread(token, threadId);
          const emailContent = messages.map(msg =>
            `${msg.sender.senderName} (${msg.sender.senderEmail}): ${msg.snippet}`
          ).join("\n");

          const prompt = `Summarize the following email thread. Focus on: 
        - Actionable points 
        - Key decisions or next steps 
        - Important questions asked or information provided: ${emailContent}`;

          const summarizer = await ai.summarizer.create();
          const summary = await summarizer.summarize(prompt);
          summarizer.destroy();

          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "displaySummary", summary: summary });
            }
          });
          sendResponse({ success: true });
        });
        return true; // Indicates an asynchronous response
      }
      //------------------------------------------------------------------------//
      //--------------OPENING A POP ON CLICKING COMPOSE BUTTON------------------//
      //------------------------------------------------------------------------//

      if (request.action === 'showPopupInCompose' && flagComposeEmail) {

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

      if (request.action === "generateEmail" && flagComposeEmail) {
        const prompt = `Compose an email using the following context. The first line should be the subject, followed by the body text. Do not include any additional text or format deviations before or after the subject line.
        If you think that the following context is unethical or not related to the task just strictly just say "Not allowed" and nothing else.

    Here is the Context:
    ${request.prompt}`;
        processPrompt(prompt, 'Generate Email').then(response => {
          if (response.localeCompare("not allowed", undefined, { sensitivity: 'base' }) === 0) {
            chrome.notifications.create({
              type: "basic",
              iconUrl: "icon1.jpg",
              title: "Smart Gmail Assistant",
              message: "Cannot process the prompt as it is out of context",
              priority: 2
            });
          }
          else {
            const subject = response.split("\n")[0];
            const body = response.split("\n").slice(1).join("\n");
            // Send subject and body back to content.js for direct insertion
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "fillEmail", subject, body });
              }
            });
          }

          sendResponse({ success: true });
        });

        return true;
      }

      //------------------------------------------------------------------------//
      //---------------------REFINE BODY TEXT OF AN EMAIL-----------------------//
      //------------------------------------------------------------------------//

      if (request.action === "refineBodyText" && flagRefineText) {
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

      if (request.action === "refineSubjectText" && flagRefineText) {
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

      if (request.action === 'highlightPhrases' && flagHighlightPhrase) {
        const threadId = request.threadId;

        highlightPhrases(threadId)
          .then(phrases => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "highlight", phrase: phrases });
              }
            });
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error("Error:", error);
            sendResponse({ error: "Failed to highlight phrases." });
            chrome.notifications.create({
              type: "basic",
              iconUrl: "icon1.jpg",
              title: "Smart Gmail Assistant",
              message: "Failed to highlight phrases",
              priority: 2
            });
          });
        return true; // Indicates an asynchronous response
      }
    });
  } catch (error) {
    console.error("Runtime error in message listener:", error);
    sendResponse({ error: "An unexpected error occurred. Please try again." });
  }
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

  // Helper to decode a part
  function decodePart(part, isHtml = false) {
    if (!part.body?.data) return null;
    try {
      const decodedData = decodeBase64(part.body.data);
      return isHtml ? htmlToPlainText(decodedData) : decodedData;
    } catch (e) {
      console.error(`Failed to decode ${isHtml ? 'HTML' : 'plain text'}:`, e);
      return null;
    }
  }

  // Recursive function to traverse parts
  function traverseParts(parts) {
    for (let part of parts) {
      if (part.mimeType === 'text/plain') {
        const text = decodePart(part);
        if (text) return text; // Return immediately if plain text is found
      } else if (part.mimeType === 'text/html') {
        const text = decodePart(part, true);
        if (text) return text; // Return HTML if no plain text is found
      } else if (part.parts) {
        // Handle nested parts
        const nestedText = traverseParts(part.parts);
        if (nestedText) return nestedText;
      }
    }
    return null;
  }

  // Extract text from parts
  messageText = traverseParts(parts);
  return messageText || 'No message content found.';
}

function decodeBase64(data) {
  return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
}

function htmlToPlainText(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.innerText || tempDiv.textContent;
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
      } else {
        alert("An error occurred while generating the email.");
        generateButton.textContent = "Generate Email";
        generateButton.disabled = false;
      }
    });
  });
}