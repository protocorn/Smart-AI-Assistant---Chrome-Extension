# Smart AI Assistant - Chrome Extension

Smart AI Assistant is a powerful Chrome extension that enhances your Gmail experience with AI-powered features for email composition, refinement, and management.

## Features
- **AI-Powered Email Composition**: Generate entire emails based on prompts.
- **Email Refinement**: Refine body and subject of emails with AI assistance.
- **Smart Reply Generation**: Automatically generate responses based on email thread context.
- **Thread Summarization**: Quickly summarize email threads for efficient communication.
- **Important Phrase Highlighting**: Automatically highlight key phrases in emails.
- **Email Categorization**: Categorize emails as "Urgent" or "Not Urgent" with automatic labeling.

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/protocorn/Smart-AI-Assistant---Chrome-Extension.git
2. Open Chrome and navigate to chrome://extensions/.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the cloned repository folder.
5. Configure Google Cloud credentials:
 - Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
 - Generate OAuth 2.0 credentials for your extension
 ![image](https://github.com/user-attachments/assets/b713b6ae-e785-4b5f-a3a7-7b23b1eb1f84)
 - Note: Use the Item ID from the "Manage Extension" section in Chrome for configuration.
 ![image](https://github.com/user-attachments/assets/f4c46e9f-a02f-4605-a025-25c67ac82937)

6. Update the manifest.json file:
 - Replace the placeholder Client ID with your newly created OAuth 2.0 Client ID.


## Security and Privacy
- The extension uses OAuth 2.0 for authentication with Gmail.
- Implements content filtering to prevent processing of potentially unethical prompts.
- Uses local storage for caching to reduce API calls and improve performance.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License.

## Contact
For any queries or suggestions, please open an issue in the GitHub repository or contact me through my [email](mailto:chordiasahil24@gmail.com).
