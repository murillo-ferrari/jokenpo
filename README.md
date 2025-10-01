# 🎮 Online Jokenpo

A real-time multiplayer Rock-Paper-Scissors game built with vanilla JavaScript and Firebase Realtime Database. Play with friends from anywhere using simple room codes!

## ✨ Features

- **Real-time Multiplayer**: Play with anyone by sharing a simple 4-character room code
- **Live Score Tracking**: Automatic score calculation with round and tie statistics
- **Reset Functionality**: Request game resets with opponent approval system
- **Smart Room Management**: Automatic cleanup when players leave, allowing rooms to be reused
- **Leave Confirmation**: Browser warns before accidentally leaving an active game
- **Graceful Error Handling**: User-friendly error messages with automatic UI recovery
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Accessibility First**: Full ARIA support and keyboard navigation
- **Toast Notifications**: Non-intrusive feedback for game events
- **Copy to Clipboard**: One-click room code sharing with fallback support
- **Secure Config**: Environment-based Firebase configuration for deployment

## 🚀 Live Demo

Visit the live application: [https://murillo-ferrari.github.io/jokenpo](https://murillo-ferrari.github.io/jokenpo)

## 🎯 How to Play

1. **Create a Room**: Click "Create New Room" to generate a unique 4-character room code
2. **Share the Code**: Copy and share your room code with a friend
3. **Join the Game**: Your friend enters the code and clicks "Join Room"
4. **Make Your Move**: Choose Rock (✊), Paper (✋), or Scissors (✌️)
5. **See Results**: Results appear automatically when both players have chosen
6. **Track Progress**: View your scores, total rounds, and ties in real-time

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+ modules)
- **Database**: Firebase Realtime Database
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions
- **Styling**: Pure CSS with custom properties and responsive design

## 📁 Project Structure

```
jokenpo/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deployment pipeline
├── assets/
│   ├── css/
│   │   └── styles.css          # Main stylesheet with responsive design
│   └── js/
│       ├── elements.js         # DOM element references
│       ├── firebaseConfig.js   # Firebase initialization
│       ├── gameLogic.js        # Core game logic and Firebase interactions
│       ├── localConfig.js      # Local development config (gitignored)
│       ├── main.js             # Application entry point
│       ├── scripts.js          # Legacy script
│       └── state.js            # Application state management
├── .gitignore                  # Git ignore rules
├── index.html                  # Main HTML file
└── README.md                   # This file
```

## 🔧 Local Development

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- A Firebase project with Realtime Database enabled
- Git (for version control)

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/murillo-ferrari/jokenpo.git
   cd jokenpo
   ```

2. **Configure Firebase** (for local testing):
   
   Create `assets/js/localConfig.js` with your Firebase credentials:
   ```javascript
   (function setLocalFirebaseConfig() {
     if (typeof window === "undefined") {
       return;
     }

     window.__LOCAL_FIREBASE_CONFIG__ = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_AUTH_DOMAIN",
       databaseURL: "YOUR_DATABASE_URL",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_STORAGE_BUCKET",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       appId: "YOUR_APP_ID",
       measurementId: "YOUR_MEASUREMENT_ID"
     };
   })();
   ```

   > **Note**: This file is already in `.gitignore` and won't be committed.

3. **Serve locally**:
   
   Use any local web server. For example:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js http-server
   npx http-server -p 8000
   
   # Using PHP
   php -S localhost:8000
   ```

4. **Open in browser**:
   ```
   http://localhost:8000
   ```

## 🚢 Deployment

The project uses GitHub Actions for automated deployment to GitHub Pages.

### Required GitHub Secrets

Configure these secrets in your repository settings (`Settings > Secrets and variables > Actions`):

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

### Deploy Process

1. Push to the `main` branch:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

2. GitHub Actions will automatically:
   - Inject Firebase configuration from secrets
   - Build the deployment package
   - Deploy to GitHub Pages

3. Your site will be live at: `https://[your-username].github.io/jokenpo`

## 🎨 Key Features Explained

### Real-time Synchronization

The game uses Firebase Realtime Database listeners to synchronize game state between players instantly. When one player makes a move, the other player sees it in real-time without refreshing.

### Score Calculation

Scores are calculated server-side using Firebase transactions to prevent race conditions and ensure consistency between players.

### Reset System

The reset functionality uses a request-approval pattern:
1. One player requests a reset
2. The opponent receives a modal dialog to accept or decline
3. If accepted, both players' scores and game state reset
4. If declined, the requester is notified via toast

### Room Cleanup and Session Management

The game automatically handles player disconnections and departures:

- **Leave Confirmation**: When a player tries to close or refresh the page during an active game, the browser shows a warning dialog to prevent accidental exits
- **Automatic Cleanup**: When Player 2 leaves a room, they are automatically removed and Player 1 returns to the waiting screen, allowing the room to accept a new Player 2
- **Room Deletion**: If Player 1 leaves, the entire room is deleted from the database, freeing up the room code for reuse
- **Smooth Transitions**: All state changes happen smoothly without page reloads, providing a seamless user experience
- **Error Recovery**: If a room becomes full or is deleted while someone tries to join, they receive a helpful toast message and are returned to the home screen

> **Note**: The browser's leave confirmation message is generic (e.g., "Leave site? Changes you made may not be saved") and cannot be customized for security reasons. This is a browser security feature to prevent malicious sites from showing fake messages.

### Accessibility

- Semantic HTML5 elements
- ARIA labels and live regions
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Reduced motion support

## 🐛 Known Issues

- Room codes must be exactly 4 characters (enforced by validation)
- Maximum 2 players per room (attempts to join full rooms are handled gracefully)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**Murillo Ferrari**

- GitHub: [@murillo-ferrari](https://github.com/murillo-ferrari)
- Project: [jokenpo](https://github.com/murillo-ferrari/jokenpo)

## 🙏 Acknowledgments

- Firebase for real-time database infrastructure
- GitHub Pages for free hosting
- The open-source community for inspiration and tools