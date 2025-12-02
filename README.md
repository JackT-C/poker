# 🎰 Royal Casino - Poker & Blackjack

A real-time multiplayer casino gaming platform featuring Texas Hold'em Poker and Blackjack with a beautiful casino-themed interface.

## 🎮 Features

### Games

- **Texas Hold'em Poker**: Play with up to 6 players with full poker mechanics
- **Blackjack**: Classic 21 game against the dealer with up to 5 players

### Multiplayer

- Real-time gameplay using Socket.io
- Create or join private rooms with friends
- Live updates and game state synchronization
- Player presence and chat notifications

### Payment Integration

- Stripe payment gateway (free test mode)
- Buy chips with secure payment processing
- Multiple chip packages available
- Test cards supported for development

### User Experience

- Clean, modern casino-themed UI
- Responsive design for mobile and desktop
- Smooth animations and transitions
- Real-time game state updates
- Persistent player data (localStorage)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Stripe account (free) for payment processing
- Heroku CLI (for deployment)

### Installation

1. **Clone or navigate to the project**

```bash
cd poker
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
# Copy the example env file
copy .env.example .env

# Edit .env and add your Stripe keys
# Get keys from: https://dashboard.stripe.com/test/apikeys
```

4. **Update Stripe Publishable Key**
   Open `public/app.js` and replace line 15 with your Stripe publishable key:

```javascript
stripe = Stripe("pk_test_YOUR_PUBLISHABLE_KEY_HERE");
```

5. **Run the application**

```bash
npm start
```

6. **Open your browser**

```
http://localhost:3000
```

## 📝 How to Play

### Poker

1. Enter your name and join a poker room
2. Wait for at least 2 players
3. Click "Start Game" to deal cards
4. Use Fold, Call, or Raise buttons to play
5. Winner takes the pot!

### Blackjack

1. Enter your name and join a blackjack room
2. Place your bet
3. Click "Start Round" when ready
4. Use Hit or Stand to play your hand
5. Try to beat the dealer!

## 🌐 Deploy to Heroku

### Step 1: Create Heroku App

```bash
# Install Heroku CLI first: https://devcenter.heroku.com/articles/heroku-cli

# Login to Heroku
heroku login

# Create a new app
heroku create your-casino-app-name

# Or use an existing app
heroku git:remote -a your-casino-app-name
```

### Step 2: Set Environment Variables

```bash
# Set your Stripe keys
heroku config:set STRIPE_SECRET_KEY=sk_test_your_secret_key
heroku config:set STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Set Node environment
heroku config:set NODE_ENV=production
```

### Step 3: Deploy

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Deploy to Heroku
git push heroku main

# Open your app
heroku open
```

### Step 4: Update Stripe Key in Frontend

After deployment, update `public/app.js` line 15 with your Stripe key and redeploy:

```bash
git add .
git commit -m "Update Stripe key"
git push heroku main
```

## 🔧 Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `STRIPE_SECRET_KEY`: Stripe secret key for backend
- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key for frontend

### Stripe Setup

See [PAYMENT_SETUP.md](PAYMENT_SETUP.md) for detailed Stripe integration guide.

## 🎯 Game Rules

### Texas Hold'em Poker

- Each player receives 2 hole cards
- 5 community cards dealt in stages (flop, turn, river)
- Best 5-card hand wins
- Betting rounds between each stage
- Small blind: $5, Big blind: $10

### Blackjack

- Goal: Get closer to 21 than the dealer without going over
- Face cards = 10, Ace = 1 or 11
- Dealer stands on 17
- Blackjack (21 with 2 cards) pays 2:1
- Bust (over 21) loses the bet

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io
- **Payment**: Stripe API
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Deployment**: Heroku

## 📦 Project Structure

```
poker/
├── server.js           # Express server & Socket.io logic
├── package.json        # Dependencies and scripts
├── Procfile           # Heroku configuration
├── .env.example       # Environment variables template
├── public/            # Frontend files
│   ├── index.html     # Main HTML file
│   ├── styles.css     # Casino-themed styles
│   └── app.js         # Client-side game logic
└── README.md          # This file
```

## 🎨 Customization

### Changing Game Settings

Edit `server.js`:

- Starting chips: Line 12 (`chips: 1000`)
- Poker blinds: Line 119-127
- Maximum players: Lines 111 and 156

### Styling

Edit `public/styles.css`:

- Colors: CSS variables at the top
- Table appearance: `.poker-table` and `.blackjack-table`
- Card styling: `.card` class

### Chip Packages

Edit `public/index.html` lines 103-123 to add/modify chip packages.

## 🔒 Security Notes

- Never commit `.env` file with real keys
- Use test mode for development
- Enable Stripe Radar for fraud detection
- Implement rate limiting for production
- Add user authentication for real money games

## 🐛 Troubleshooting

**Port already in use:**

```bash
# Change PORT in .env file
PORT=3001
```

**Socket.io connection failed:**

- Check firewall settings
- Ensure WebSocket support enabled
- Try different browser

**Payment not working:**

- Verify Stripe keys are correct
- Check browser console for errors
- Use Stripe test cards only in test mode

## 📄 License

MIT License - Feel free to use this project for learning or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests

## 📞 Support

For issues or questions:

- Check [Stripe Documentation](https://stripe.com/docs)
- Review [Socket.io Docs](https://socket.io/docs/)
- Check [Heroku Dev Center](https://devcenter.heroku.com/)

## 🎉 Enjoy!

Have fun playing poker and blackjack with your friends! 🃏🎲
