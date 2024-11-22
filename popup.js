// Retrieve the saved feature flags from Chrome storage on popup load
document.addEventListener("DOMContentLoaded", function () {
  const features = [
    "compose_email",
    "generate_reply",
    "refine_text",
    "summarize_thread",
    "highlight_phrase",
   //"translation_api",
  ];

  // Load saved states from chrome.storage.sync
  chrome.storage.sync.get(features.concat("preferred_language"), function (data) {
    features.forEach((feature) => {
      const toggleElement = document.getElementById(`${feature}-toggle`);
      if (data[feature]!=false) {
        toggleElement.classList.add("toggle-on");
      }
    });

    // Set the saved preferred language in the input field
    const languageInput = document.getElementById("language-search");
    if (data.preferred_language) {
      languageInput.value = data.preferred_language;
    } else {
      languageInput.placeholder = "Select a language...";
    }
  });

  // Function to save the toggle state to chrome.storage.sync
  function saveToggleState(feature, isOn) {
    chrome.storage.sync.set({ [feature]: isOn }, function () {
      console.log(`${feature} state saved: ${isOn}`);
    });
  }

  // Function to save the preferred language to chrome.storage.sync
  function savePreferredLanguage(language) {
    chrome.storage.sync.set({ preferred_language: language }, function () {
      console.log(`Preferred language saved: ${language}`);
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

  // Language dropdown functionality
  const languageSearch = document.getElementById("language-search");
  const languageOptions = document.getElementById("language-options");

  // Populate the dropdown with languages
  const languagePairs = [
    { name: "Arabic", code: "ar" },
    { name: "Bengali", code: "bn" },
    { name: "German", code: "de" },
    { name: "Spanish", code: "es" },
    { name: "English", code: "en" },
    { name: "French", code: "fr" },
    { name: "Hindi", code: "hi" },
    { name: "Italian", code: "it" },
    { name: "Japanese", code: "ja" },
    { name: "Korean", code: "ko" },
    { name: "Dutch", code: "nl" },
    { name: "Polish", code: "pl" },
    { name: "Portuguese", code: "pt" },
    { name: "Russian", code: "ru" },
    { name: "Thai", code: "th" },
    { name: "Turkish", code: "tr" },
    { name: "Vietnamese", code: "vi" },
    { name: "Chinese (Simplified)", code: "zh" },
    { name: "Chinese (Traditional)", code: "zh-Hant" },
  ];

  function populateLanguages(filter = "") {
    languageOptions.innerHTML = ""; // Clear existing options
    languagePairs
      .filter((pair) =>
        pair.name.toLowerCase().includes(filter.toLowerCase())
      )
      .forEach((pair) => {
        const option = document.createElement("div");
        option.textContent = `${pair.name} (${pair.code})`; // Show language name and code
        option.addEventListener("click", () => {
          languageSearch.value = pair.name; // Display the name in the input field
          savePreferredLanguage(pair.code); // Save the language code
          languageOptions.style.display = "none"; // Hide dropdown
        });
        languageOptions.appendChild(option);
      });
  }

  // Initial population
  populateLanguages("");

  // Filter languages as user types
  languageSearch.addEventListener("input", (e) => {
    populateLanguages(e.target.value);
  });

  // Toggle dropdown visibility on focus
  languageSearch.addEventListener("focus", () => {
    populateLanguages(languageSearch.value); // Ensure filter is applied
    languageOptions.style.display = "block";
  });

  // Hide dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#language-dropdown")) {
      languageOptions.style.display = "none";
    }
  });
});
