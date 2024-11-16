// Retrieve the saved feature flags from Chrome storage on popup load
document.addEventListener("DOMContentLoaded", function () {
  const features = ["compose_email", "generate_reply", "refine_text", "summarize_thread", "highlight_phrase"];

  // Load saved states from chrome.storage.sync
  chrome.storage.sync.get(features, function (data) {
    features.forEach((feature) => {
      const toggleElement = document.getElementById(`${feature}-toggle`);
      if (data[feature]) {
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
      const isOn = toggleElement.classList.toggle("toggle-on");
      saveToggleState(feature, isOn);
    });
  });
});
