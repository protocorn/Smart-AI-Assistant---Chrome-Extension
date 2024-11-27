document.addEventListener("DOMContentLoaded", function () {
  chrome.identity.getAuthToken({ interactive: false }, function (token) {
    if (chrome.runtime.lastError || !token) {
      showAuthUI();
    } else {
      showMenu();
    }
  });
});

function showAuthUI() {
  const authContainer = document.createElement('div');
  authContainer.style.cssText = `
    display: grid;
    
    align-items: center;
    justify-content: center;
    width: 250px;
    background-color: #f5f5f5;
  `;

  const authCard = document.createElement('div');
  authCard.style.cssText = `
    background-color: #ffffff;
    border-radius: 8px;
    padding: 40px;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;

  const logo = document.createElement('img');
  logo.src = 'smart_assistant_icon.png';
  logo.alt = 'Extension Logo';
  logo.style.cssText = `
    width: 80px;
    height: 80px;
    margin-bottom: 20px;
  `;

  const title = document.createElement('h2');
  title.textContent = 'Authentication Required';
  title.style.cssText = `
    font-size: 24px;
    margin-bottom: 20px;
    color: #333333;
  `;

  const description = document.createElement('p');
  description.textContent = 'Please authenticate with Google to use this extension.';
  description.style.cssText = `
    font-size: 16px;
    margin-bottom: 30px;
    color: #666666;
  `;

  const authButton = document.createElement('button');
  authButton.textContent = 'Authenticate with Google';
  authButton.style.cssText = `
    background-color: #4285F4;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    padding: 12px 24px;
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.3s ease;
  `;
  authButton.addEventListener('mouseover', () => {
    authButton.style.backgroundColor = '#3367D6';
  });
  authButton.addEventListener('mouseout', () => {
    authButton.style.backgroundColor = '#4285F4';
  });
  authButton.addEventListener('click', function () {
    authButton.textContent = 'Authenticating...';
    authButton.disabled = true;
    chrome.identity.getAuthToken({ interactive: true }, function (token) {
      if (chrome.runtime.lastError || !token) {
        console.error('Authentication failed:', chrome.runtime.lastError);
        authButton.textContent = 'Authentication Failed. Try Again';
        authButton.disabled = false;
      } else {
        showMenu();
      }
    });
  });

  authCard.appendChild(logo);
  authCard.appendChild(title);
  authCard.appendChild(description);
  authCard.appendChild(authButton);
  authContainer.appendChild(authCard);

  document.body.innerHTML = '';
  document.body.appendChild(authContainer);
}

function showMenu() {
  const features = [
    "compose_email",
    "generate_reply",
    "refine_text",
    "summarize_thread",
    "highlight_phrase",
    "categorize_email",
  ];

  chrome.storage.sync.get(features, function (data) {
    features.forEach((feature) => {
      const toggleElement = document.getElementById(`${feature}-toggle`);
      if (toggleElement && data[feature] !== false) {
        toggleElement.classList.add("toggle-on");
      }
    });
  });

  features.forEach((feature) => {
    const toggleElement = document.getElementById(`${feature}-toggle`);
    if (toggleElement) {
      toggleElement.addEventListener("click", function () {
        const isOn = toggleElement.classList.toggle("toggle-on");
        chrome.storage.sync.set({ [feature]: isOn }, function () {
          console.log(`${feature} state saved: ${isOn}`);
        });
      });
    }
  });
}