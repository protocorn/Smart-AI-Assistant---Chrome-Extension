// Retrieve the saved feature flags from Chrome storage on popup load
document.addEventListener("DOMContentLoaded", function () {
  chrome.identity.getAuthToken({ interactive: false }, function (token) {
    if (chrome.runtime.lastError || !token) {
      const authButton = document.createElement('button');
      authButton.textContent = 'Authenticate with Google';
      authButton.addEventListener('click', function () {
        chrome.identity.getAuthToken({ interactive: true }, function (token) {
          if (chrome.runtime.lastError || !token) {
            console.error('Authentication failed:', chrome.runtime.lastError);
          } else {
            showMenu();
          }
        });
      });

      document.body.innerHTML = '';
      document.body.appendChild(authButton);
    } else {
      const features = [
        "compose_email",
        "generate_reply",
        "refine_text",
        "summarize_thread",
        "highlight_phrase",
        "categorize_email",
      ];

      // Load saved states from chrome.storage.sync
      chrome.storage.sync.get(features, function (data) {
        features.forEach((feature) => {
          const toggleElement = document.getElementById(`${feature}-toggle`);
          if (data[feature] != false) {
            toggleElement.classList.add("toggle-on");
          }
        });
      });

      // Function to save the toggle state to chrome.storage.sync
      function saveToggleState(feature, isOn) {
        chrome.storage.sync.set({ [feature]: isOn }, function () {
          console.log(`${feature} state saved: ${isOn}`);
        });
      }

      // Add click event listeners to the toggles
      features.forEach((feature) => {
        const toggleElement = document.getElementById(`${feature}-toggle`);
        toggleElement.addEventListener("click", function () {
          if (feature == 'categorize_email') {
            saveToggleState(feature, true);
          }
          const isOn = toggleElement.classList.toggle("toggle-on");
          saveToggleState(feature, isOn);
        });
      });
    }
  });
});