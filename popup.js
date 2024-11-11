document.getElementById('generateEmail').addEventListener('click', async () => {
  const prompt = document.getElementById('prompt').value.trim();

  if (!prompt) {
     alert("Please enter a prompt!");
     return;
  }

  console.log("Sending generateEmail message with prompt:", prompt);
  
  chrome.runtime.sendMessage({
     action: "generateEmail",
     prompt: prompt
  }, (response) => {
     console.log("Response received in popup.js:", response);

     if (response && response.subject && response.body) {
        document.getElementById('subject').value = response.subject;
        document.getElementById('body').value = response.body;
        window.close();
     } else {
        alert("An error occurred while generating the email.");
     }
  });
});
