const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const session = require('express-session');
const auth = require('./auth');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'casino-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Game state
const pokerRooms = new Map();
const blackjackRooms = new Map();
const sumoRooms = new Map();
const pingpongRooms = new Map();
const fpsRooms = new Map();
const aimRooms = new Map();
const players = new Map();

// Card deck utilities
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
    const deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ rank, suit, value: getCardValue(rank) });
        }
    }
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getCardValue(rank) {
    if (rank === 'A') return 11;
    if (['K', 'Q', 'J'].includes(rank)) return 10;
    return parseInt(rank);
}

function calculateBlackjackScore(hand) {
    let score = 0;
    let aces = 0;
    
    for (let card of hand) {
        score += card.value;
        if (card.rank === 'A') aces++;
    }
    
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    
    return score;
}

// Poker hand evaluation
function evaluatePokerHand(cards) {
    if (!cards || cards.length < 5) {
        return { rank: -1, name: 'Not enough cards', description: '' };
    }
    
    const ranks = cards.map(c => c.rank);
    const suits = cards.map(c => c.suit);
    
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    
    const sortedRanks = ranks.map(r => rankValues[r]).sort((a, b) => b - a);
    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = sortedRanks.every((val, i) => i === 0 || val === sortedRanks[i - 1] - 1);
    
    // Get high card name
    const highCard = Object.keys(rankCounts).reduce((a, b) => rankValues[a] > rankValues[b] ? a : b);
    
    // Check for pairs/trips/quads
    const pairRanks = Object.keys(rankCounts).filter(r => rankCounts[r] === 2);
    const tripRank = Object.keys(rankCounts).find(r => rankCounts[r] === 3);
    const quadRank = Object.keys(rankCounts).find(r => rankCounts[r] === 4);
    
    if (isStraight && isFlush && sortedRanks[0] === 14) {
        return { rank: 9, name: 'Royal Flush', description: '🏆 ROYAL FLUSH! Best hand possible!' };
    }
    if (isStraight && isFlush) {
        return { rank: 8, name: 'Straight Flush', description: `💎 Straight Flush, ${highCard} high!` };
    }
    if (quadRank) {
        return { rank: 7, name: 'Four of a Kind', description: `🎯 Four ${quadRank}s!` };
    }
    if (tripRank && pairRanks.length >= 1) {
        return { rank: 6, name: 'Full House', description: `🏠 Full House: ${tripRank}s over ${pairRanks[0]}s` };
    }
    if (isFlush) {
        return { rank: 5, name: 'Flush', description: `✨ Flush, ${highCard} high!` };
    }
    if (isStraight) {
        return { rank: 4, name: 'Straight', description: `📊 Straight, ${highCard} high!` };
    }
    if (tripRank) {
        return { rank: 3, name: 'Three of a Kind', description: `🎲 Three ${tripRank}s` };
    }
    if (pairRanks.length >= 2) {
        return { rank: 2, name: 'Two Pair', description: `👥 Two Pair: ${pairRanks[0]}s and ${pairRanks[1]}s` };
    }
    if (pairRanks.length === 1) {
        return { rank: 1, name: 'Pair', description: `🎴 Pair of ${pairRanks[0]}s` };
    }
    
    return { rank: 0, name: 'High Card', description: `High card: ${highCard}` };
}

// Bot utilities
const botNames = ['Alice Bot', 'Bob Bot', 'Charlie Bot', 'Diana Bot', 'Eve Bot', 'Frank Bot'];
let botCounter = 0;

function generateBotId() {
    return `bot_${Math.random().toString(36).substr(2, 9)}`;
}

function getBotName() {
    const name = botNames[botCounter % botNames.length];
    botCounter++;
    return name;
}

function makeBotPokerDecision(room, botPlayer) {
    const currentBet = room.currentBet;
    const betDiff = currentBet - botPlayer.bet;
    
    // Simple AI logic
    const handStrength = evaluatePokerHand([...botPlayer.hand, ...room.communityCards]).rank;
    const randomFactor = Math.random();
    
    if (handStrength >= 5 || (handStrength >= 3 && randomFactor > 0.5)) {
        // Strong hand - raise
        const raiseAmount = currentBet + Math.floor(Math.random() * 50) + 20;
        return { action: 'raise', amount: raiseAmount };
    } else if (handStrength >= 1 || (randomFactor > 0.6)) {
        // Decent hand - call
        return { action: 'call' };
    } else {
        // Weak hand - fold if bet is high, otherwise call
        return betDiff > 50 ? { action: 'fold' } : { action: 'call' };
    }
}

function makeBotBlackjackDecision(botPlayer, dealerUpCard) {
    const score = botPlayer.score;
    const dealerValue = dealerUpCard.value;
    
    // Basic blackjack strategy
    if (score < 12) return 'hit';
    if (score >= 17) return 'stand';
    if (score >= 13 && score <= 16 && dealerValue <= 6) return 'stand';
    return 'hit';
}

function addBotToPokerRoom(roomId) {
    const room = pokerRooms.get(roomId);
    if (!room || room.players.length >= 6) return null;
    
    const botId = generateBotId();
    const bot = {
        id: botId,
        name: getBotName(),
        chips: 1000,
        hand: [],
        bet: 0,
        folded: false,
        isBot: true
    };
    
    room.players.push(bot);
    return bot;
}

function addBotToBlackjackRoom(roomId) {
    const room = blackjackRooms.get(roomId);
    if (!room || room.players.length >= 5) return null;
    
    const botId = generateBotId();
    const bot = {
        id: botId,
        name: getBotName(),
        chips: 1000,
        hand: [],
        bet: 0,
        score: 0,
        standing: false,
        isBot: true
    };
    
    room.players.push(bot);
    return bot;
}

function processBotPokerTurn(room, roomId) {
    const currentPlayer = room.players[room.currentPlayerIndex];
    
    if (!currentPlayer || !currentPlayer.isBot || currentPlayer.folded) {
        console.log('Bot turn skipped - not a bot or folded');
        return;
    }
    
    console.log(`Bot ${currentPlayer.name} is taking their turn`);
    
    setTimeout(() => {
        const decision = makeBotPokerDecision(room, currentPlayer);
        
        if (decision.action === 'fold') {
            currentPlayer.folded = true;
        } else if (decision.action === 'call') {
            const callAmount = room.currentBet - currentPlayer.bet;
            currentPlayer.chips -= callAmount;
            currentPlayer.bet += callAmount;
            room.pot += callAmount;
        } else if (decision.action === 'raise') {
            const raiseAmount = decision.amount - currentPlayer.bet;
            currentPlayer.chips -= raiseAmount;
            currentPlayer.bet = decision.amount;
            room.pot += raiseAmount;
            room.currentBet = decision.amount;
        }
        
        // Move to next player (skip folded players)
        do {
            room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
        } while (room.players[room.currentPlayerIndex].folded && room.players.filter(p => !p.folded).length > 1);
        
        // Check if round is over
        const activePlayers = room.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
            const winner = activePlayers[0];
            winner.chips += room.pot;
            
            // Prepare all players' hands for reveal
            const allHands = room.players.map(p => ({
                name: p.name,
                hand: p.hand,
                folded: p.folded
            }));
            
            io.to(roomId).emit('gameEnd', {
                winner: winner.name,
                pot: room.pot,
                allHands: allHands
            });
            room.gameStarted = false;
            
            // Auto-restart game after 3 seconds
            setTimeout(() => {
                resetPokerGame(room, roomId);
                setTimeout(() => startPokerGame(room, roomId), 500);
            }, 3000);
        } else if (room.players.every(p => p.folded || p.bet === room.currentBet)) {
            advancePokerRound(room, roomId);
        } else {
            io.to(roomId).emit('gameUpdate', { room });
            // Continue with next bot if applicable
            if (room.players[room.currentPlayerIndex].isBot) {
                processBotPokerTurn(room, roomId);
            }
        }
    }, 1500);
}

function processBotBlackjackTurns(room, roomId, dealerUpCard) {
    const bots = room.players.filter(p => p.isBot && p.bet > 0 && !p.standing);
    
    bots.forEach((bot, index) => {
        setTimeout(() => {
            while (!bot.standing && bot.score < 21) {
                const decision = makeBotBlackjackDecision(bot, dealerUpCard);
                
                if (decision === 'hit') {
                    bot.hand.push(room.deck.pop());
                    bot.score = calculateBlackjackScore(bot.hand);
                    
                    if (bot.score >= 21) {
                        bot.standing = true;
                    }
                } else {
                    bot.standing = true;
                }
                
                io.to(roomId).emit('playerUpdate', { player: bot });
            }
            
            // Check if all players are done
            if (room.players.every(p => p.standing || p.bet === 0)) {
                setTimeout(() => resolveBlackjackRound(room, roomId), 1000);
            }
        }, index * 2000);
    });
}

function startPokerGame(room, roomId) {
    if (!room || room.gameStarted || room.players.length < 2) return;
    
    room.gameStarted = true;
    room.deck = createDeck();
    room.communityCards = [];
    room.pot = 0;
    room.currentBet = 10;
    room.currentPlayerIndex = 0;
    room.round = 'preflop';
    
    // Deal cards
    room.players.forEach(player => {
        player.hand = [room.deck.pop(), room.deck.pop()];
        player.bet = 0;
        player.folded = false;
    });
    
    // Small and big blind
    room.players[0].chips -= 5;
    room.players[0].bet = 5;
    room.pot += 5;
    
    room.players[1].chips -= 10;
    room.players[1].bet = 10;
    room.pot += 10;
    
    room.players.forEach(player => {
        if (!player.isBot) {
            io.to(player.id).emit('dealCards', { hand: player.hand });
        }
    });
    
    io.to(roomId).emit('gameStart', { room });
    
    // Start bot turns if first player is bot
    if (room.players[room.currentPlayerIndex].isBot) {
        processBotPokerTurn(room, roomId);
    }
}

function resetPokerGame(room, roomId) {
    room.gameStarted = false;
    room.deck = createDeck();
    room.communityCards = [];
    room.pot = 0;
    room.currentBet = 0;
    room.currentPlayerIndex = 0;
    room.round = 'preflop';
    
    room.players.forEach(player => {
        player.hand = [];
        player.bet = 0;
        player.folded = false;
    });
    
    io.to(roomId).emit('gameReset', { room });
}

function resetBlackjackGame(room, roomId) {
    room.gameStarted = false;
    room.deck = createDeck();
    room.dealer = { hand: [], score: 0 };
    
    room.players.forEach(player => {
        player.hand = [];
        player.bet = 0;
        player.score = 0;
        player.standing = false;
        player.result = null;
    });
    
    io.to(roomId).emit('gameReset', { room });
}

// Sumo game function
function startSumoGame(room, roomId) {
    // Reset click counts
    room.players.forEach(p => p.clicks = 0);
    
    // Countdown 3, 2, 1, GO
    let countdown = 3;
    const countdownInterval = setInterval(() => {
        if (countdown > 0) {
            io.to(roomId).emit('sumoCountdown', { count: countdown });
            countdown--;
        } else {
            clearInterval(countdownInterval);
            io.to(roomId).emit('sumoCountdown', { count: 0 }); // GO signal
            
            // End game after duration
            setTimeout(() => {
                endSumoGame(room, roomId);
            }, room.gameDuration);
        }
    }, 1000);
}

function endSumoGame(room, roomId) {
    room.gameStarted = false;
    
    // Find winner (most clicks)
    const winner = room.players.reduce((prev, current) => 
        (current.clicks > prev.clicks) ? current : prev
    );
    
    const winnings = 100;
    const cost = 50;
    
    io.to(roomId).emit('sumoEnd', {
        winner: winner,
        winnings: winnings,
        cost: cost
    });
    
    // Reset room
    room.ready = [];
    room.players.forEach(p => p.clicks = 0);
}

// Table Tennis game functions
function startPingPongGame(room, roomId) {
    // Notify players
    room.players.forEach(player => {
        io.to(player.id).emit('pingpongStart', {
            playerSide: player.side,
            player1Name: room.players[0]?.name || 'Player 1',
            player2Name: room.players[1]?.name || 'Player 2'
        });
    });
    
    // Reset ball
    resetPingPongBall(room);
    
    // Start game loop
    room.gameInterval = setInterval(() => {
        if (!room.gameStarted || !pingpongRooms.has(roomId)) {
            clearInterval(room.gameInterval);
            return;
        }
        
        updatePingPongBall(room);
        
        io.to(roomId).emit('pingpongUpdate', {
            ball: room.ball,
            paddle1Y: room.paddle1Y,
            paddle2Y: room.paddle2Y,
            score1: room.score1,
            score2: room.score2
        });
        
        // Check for win condition
        if (room.score1 >= 11 || room.score2 >= 11) {
            clearInterval(room.gameInterval);
            endPingPongGame(room, roomId);
        }
    }, 1000 / 60); // 60 FPS
}

function updatePingPongBall(room) {
    room.ball.x += room.ball.speedX;
    room.ball.y += room.ball.speedY;
    
    const ballRadius = 8;
    
    // Top/bottom wall collision
    if (room.ball.y - ballRadius <= 0) {
        room.ball.y = ballRadius;
        room.ball.speedY *= -1;
    }
    if (room.ball.y + ballRadius >= 500) {
        room.ball.y = 500 - ballRadius;
        room.ball.speedY *= -1;
    }
    
    // Paddle 1 collision (left paddle)
    if (room.ball.x - ballRadius <= 20 && 
        room.ball.x > 0 &&
        room.ball.y >= room.paddle1Y && 
        room.ball.y <= room.paddle1Y + 100) {
        room.ball.x = 20 + ballRadius;
        room.ball.speedX = Math.abs(room.ball.speedX) * 1.05; // Speed up slightly
        const relativeIntersectY = (room.paddle1Y + 50) - room.ball.y;
        room.ball.speedY = -relativeIntersectY * 0.1;
    }
    
    // Paddle 2 collision (right paddle)
    if (room.ball.x + ballRadius >= 780 && 
        room.ball.x < 800 &&
        room.ball.y >= room.paddle2Y && 
        room.ball.y <= room.paddle2Y + 100) {
        room.ball.x = 780 - ballRadius;
        room.ball.speedX = -Math.abs(room.ball.speedX) * 1.05; // Speed up slightly
        const relativeIntersectY = (room.paddle2Y + 50) - room.ball.y;
        room.ball.speedY = -relativeIntersectY * 0.1;
    }
    
    // Score points
    if (room.ball.x < 0) {
        room.score2++;
        resetPingPongBall(room);
    } else if (room.ball.x > 800) {
        room.score1++;
        resetPingPongBall(room);
    }
}

function resetPingPongBall(room) {
    room.ball.x = 400;
    room.ball.y = 250;
    room.ball.speedX = (Math.random() > 0.5 ? 5 : -5);
    room.ball.speedY = (Math.random() - 0.5) * 4;
}

function endPingPongGame(room, roomId) {
    room.gameStarted = false;
    const winner = room.score1 > room.score2 ? 1 : 2;
    const winnings = 100;
    const cost = 50;
    
    io.to(roomId).emit('pingpongEnd', {
        winner: winner,
        score1: room.score1,
        score2: room.score2,
        winnings: winnings,
        cost: cost
    });
    
    // Reset room
    room.ready = [];
    room.score1 = 0;
    room.score2 = 0;
    resetPingPongBall(room);
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    players.set(socket.id, {
        id: socket.id,
        name: '',
        chips: 1000,
        currentRoom: null
    });
    
    // Join game room
    socket.on('joinRoom', ({ roomId, game, playerName }) => {
        const player = players.get(socket.id);
        player.name = playerName || `Player ${socket.id.slice(0, 4)}`;
        
        socket.join(roomId);
        player.currentRoom = roomId;
        
        if (game === 'poker') {
            if (!pokerRooms.has(roomId)) {
                pokerRooms.set(roomId, {
                    id: roomId,
                    players: [],
                    deck: createDeck(),
                    communityCards: [],
                    pot: 0,
                    currentBet: 0,
                    currentPlayerIndex: 0,
                    gameStarted: false,
                    round: 'preflop'
                });
            }
            
            const room = pokerRooms.get(roomId);
            if (room.players.length < 6) {
                room.players.push({
                    id: socket.id,
                    name: player.name,
                    chips: player.chips,
                    hand: [],
                    bet: 0,
                    folded: false
                });
                
                io.to(roomId).emit('roomUpdate', {
                    room: room,
                    message: `${player.name} joined the table`
                });
                
                io.to(roomId).emit('chatSystem', {
                    message: `${player.name} joined the table`
                });
            }
        } else if (game === 'blackjack') {
            if (!blackjackRooms.has(roomId)) {
                blackjackRooms.set(roomId, {
                    id: roomId,
                    players: [],
                    dealer: { hand: [], score: 0 },
                    deck: createDeck(),
                    gameStarted: false
                });
            }
            
            const room = blackjackRooms.get(roomId);
            if (room.players.length < 5) {
                room.players.push({
                    id: socket.id,
                    name: player.name,
                    chips: player.chips,
                    hand: [],
                    bet: 0,
                    score: 0,
                    standing: false
                });
                
                io.to(roomId).emit('roomUpdate', {
                    room: room,
                    message: `${player.name} joined the table`
                });
                
                io.to(roomId).emit('chatSystem', {
                    message: `${player.name} joined the table`
                });
            }
        } else if (game === 'sumo') {
            if (!sumoRooms.has(roomId)) {
                sumoRooms.set(roomId, {
                    id: roomId,
                    players: [],
                    ready: [],
                    gameStarted: false,
                    gameDuration: 10000 // 10 seconds
                });
            }
            
            const room = sumoRooms.get(roomId);
            if (room.players.length < 2) {
                room.players.push({
                    id: socket.id,
                    name: player.name,
                    clicks: 0
                });
                
                io.to(roomId).emit('sumoUpdate', {
                    players: room.players,
                    ready: room.ready
                });
                
                io.to(roomId).emit('roomUpdate', {
                    message: `${player.name} entered the arena`
                });
                
                io.to(roomId).emit('chatSystem', {
                    message: `${player.name} entered the arena`
                });
            }
        } else if (game === 'pingpong') {
            if (!pingpongRooms.has(roomId)) {
                pingpongRooms.set(roomId, {
                    id: roomId,
                    players: [],
                    ready: [],
                    gameStarted: false,
                    ball: { x: 400, y: 250, speedX: 5, speedY: 3 },
                    paddle1Y: 200,
                    paddle2Y: 200,
                    score1: 0,
                    score2: 0
                });
            }
            
            const room = pingpongRooms.get(roomId);
            if (room.players.length < 2) {
                room.players.push({
                    id: socket.id,
                    name: player.name,
                    side: room.players.length + 1
                });
                
                io.to(roomId).emit('roomUpdate', {
                    message: `${player.name} entered the match`
                });
                
                io.to(roomId).emit('chatSystem', {
                    message: `${player.name} entered the match`
                });
            }
        } else if (game === 'fps') {
            if (!fpsRooms.has(roomId)) {
                fpsRooms.set(roomId, {
                    id: roomId,
                    players: [],
                    gameActive: false,
                    bullets: [],
                    pot: 100,
                    gameLoop: null
                });
            }
            
            const room = fpsRooms.get(roomId);
            if (room.players.length < 4) {
                // Set spawn positions for up to 4 players
                const spawnPositions = [
                    { x: 100, y: 100 },
                    { x: 700, y: 500 },
                    { x: 700, y: 100 },
                    { x: 100, y: 500 }
                ];
                const spawnPos = spawnPositions[room.players.length];
                
                room.players.push({
                    id: socket.id,
                    name: player.name,
                    x: spawnPos.x,
                    y: spawnPos.y,
                    angle: 0,
                    health: 100,
                    kills: 0,
                    deaths: 0,
                    ready: false
                });
                
                io.to(roomId).emit('roomUpdate', {
                    message: `${player.name} entered the arena`
                });
                
                io.to(roomId).emit('chatSystem', {
                    message: `${player.name} entered the arena`
                });
            }
        } else if (game === 'aim') {
            if (!aimRooms.has(roomId)) {
                aimRooms.set(roomId, {
                    id: roomId,
                    players: [],
                    gameActive: false,
                    pot: 100,
                    gameLoop: null,
                    timeLeft: 30
                });
            }
            
            const room = aimRooms.get(roomId);
            if (room.players.length < 2) {
                room.players.push({
                    id: socket.id,
                    name: player.name,
                    hits: 0,
                    times: [],
                    ready: false
                });
                
                io.to(roomId).emit('roomUpdate', {
                    message: `${player.name} entered the challenge`
                });
                
                io.to(roomId).emit('chatSystem', {
                    message: `${player.name} entered the challenge`
                });
            }
        }
    });
    
    // Add bot to room
    socket.on('addBot', ({ roomId, game }) => {
        console.log(`Adding bot to ${game} room ${roomId}`);
        let bot = null;
        
        if (game === 'poker') {
            const room = pokerRooms.get(roomId);
            console.log('Poker room exists:', !!room);
            if (!room) {
                console.log('Poker room not found');
                socket.emit('error', { message: 'Room not found' });
                return;
            }
            console.log('Current players:', room.players.length);
            bot = addBotToPokerRoom(roomId);
            if (bot) {
                console.log('Bot added:', bot.name);
                io.to(roomId).emit('roomUpdate', {
                    room: pokerRooms.get(roomId),
                    message: `${bot.name} joined the table`
                });
            } else {
                console.log('Cannot add bot - room full');
                socket.emit('error', { message: 'Cannot add more bots (max 6 players)' });
            }
        } else if (game === 'blackjack') {
            const room = blackjackRooms.get(roomId);
            console.log('Blackjack room exists:', !!room);
            if (!room) {
                console.log('Blackjack room not found');
                socket.emit('error', { message: 'Room not found' });
                return;
            }
            console.log('Current players:', room.players.length);
            bot = addBotToBlackjackRoom(roomId);
            if (bot) {
                console.log('Bot added:', bot.name);
                io.to(roomId).emit('roomUpdate', {
                    room: blackjackRooms.get(roomId),
                    message: `${bot.name} joined the table`
                });
            } else {
                console.log('Cannot add bot - room full');
                socket.emit('error', { message: 'Cannot add more bots (max 5 players)' });
            }
        }
    });
    
    // Start poker game
    socket.on('startPoker', (roomId) => {
        const room = pokerRooms.get(roomId);
        startPokerGame(room, roomId);
    });
    
    // Reset poker game
    socket.on('resetPoker', (roomId) => {
        const room = pokerRooms.get(roomId);
        if (room) {
            resetPokerGame(room, roomId);
        }
    });
    
    // Poker actions
    socket.on('pokerAction', ({ roomId, action, amount }) => {
        const room = pokerRooms.get(roomId);
        if (!room || !room.gameStarted) return;
        
        const player = room.players[room.currentPlayerIndex];
        if (player.id !== socket.id) return;
        
        if (action === 'fold') {
            player.folded = true;
        } else if (action === 'call') {
            const callAmount = room.currentBet - player.bet;
            if (callAmount < 0 || player.chips < callAmount) return;
            player.chips -= callAmount;
            player.bet += callAmount;
            room.pot += callAmount;
        } else if (action === 'raise') {
            if (!amount || amount < 10) return;
            const raiseAmount = amount;
            const totalAmount = raiseAmount - player.bet;
            if (totalAmount < 0 || player.chips < totalAmount) return;
            player.chips -= totalAmount;
            player.bet = raiseAmount;
            room.pot += totalAmount;
            room.currentBet = raiseAmount;
        }
        
        // Move to next player (skip folded players)
        do {
            room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
        } while (room.players[room.currentPlayerIndex].folded && room.players.filter(p => !p.folded).length > 1);
        
        // Check if round is over
        const activePlayers = room.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
            // Winner by fold
            const winner = activePlayers[0];
            winner.chips += room.pot;
            
            // Prepare all players' hands for reveal
            const allHands = room.players.map(p => ({
                name: p.name,
                hand: p.hand,
                folded: p.folded
            }));
            
            io.to(roomId).emit('gameEnd', {
                winner: winner.name,
                pot: room.pot,
                allHands: allHands
            });
            room.gameStarted = false;
            
            // Auto-restart game after 3 seconds
            setTimeout(() => {
                resetPokerGame(room, roomId);
                setTimeout(() => startPokerGame(room, roomId), 500);
            }, 3000);
            return;
        } else if (room.players.every(p => p.folded || p.bet === room.currentBet)) {
            // Move to next round
            advancePokerRound(room, roomId);
            return;
        }
        
        io.to(roomId).emit('gameUpdate', { room });
        
        // Check if next player is bot
        if (room.players[room.currentPlayerIndex].isBot) {
            processBotPokerTurn(room, roomId);
        }
    });
    
    // Start blackjack game
    socket.on('startBlackjack', (roomId) => {
        const room = blackjackRooms.get(roomId);
        if (!room || room.gameStarted) return;
        
        room.gameStarted = true;
        room.deck = createDeck();
        room.dealer.hand = [room.deck.pop(), room.deck.pop()];
        room.dealer.score = calculateBlackjackScore(room.dealer.hand);
        
        // Bots place random bets
        room.players.forEach(player => {
            if (player.isBot && player.bet === 0) {
                const botBet = Math.floor(Math.random() * 200) + 50;
                player.bet = Math.min(botBet, player.chips);
                player.chips -= player.bet;
            }
        });
        
        room.players.forEach(player => {
            if (player.bet > 0) {
                player.hand = [room.deck.pop(), room.deck.pop()];
                player.score = calculateBlackjackScore(player.hand);
                player.standing = false;
            }
        });
        
        io.to(roomId).emit('blackjackStart', {
            room,
            dealerCard: room.dealer.hand[0]
        });
        
        // Start bot turns
        setTimeout(() => {
            processBotBlackjackTurns(room, roomId, room.dealer.hand[0]);
        }, 1000);
    });
    
    // Blackjack bet
    socket.on('placeBet', ({ roomId, amount }) => {
        const room = blackjackRooms.get(roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player && player.chips >= amount) {
            player.bet = amount;
            player.chips -= amount;
            io.to(roomId).emit('roomUpdate', { room });
        }
    });
    
    // Blackjack hit
    socket.on('hit', (roomId) => {
        const room = blackjackRooms.get(roomId);
        if (!room || !room.gameStarted) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player && !player.standing) {
            player.hand.push(room.deck.pop());
            player.score = calculateBlackjackScore(player.hand);
            
            if (player.score > 21) {
                player.standing = true;
                io.to(socket.id).emit('bust', { score: player.score });
            }
            
            io.to(roomId).emit('playerUpdate', { player });
        }
    });
    
    // Blackjack stand
    socket.on('stand', (roomId) => {
        const room = blackjackRooms.get(roomId);
        if (!room || !room.gameStarted) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.standing = true;
            
            // Check if all players are standing
            if (room.players.every(p => p.standing || p.bet === 0)) {
                resolveBlackjackRound(room, roomId);
            }
            
            io.to(roomId).emit('playerUpdate', { player });
        }
    });
    
    // Reset blackjack game
    socket.on('resetBlackjack', (roomId) => {
        const room = blackjackRooms.get(roomId);
        if (room) {
            resetBlackjackGame(room, roomId);
        }
    });
    
    // Chat handler
    socket.on('chatMessage', ({ roomId, message, sender }) => {
        if (!roomId || !message || message.length > 200) return;
        
        // Broadcast message to all players in the room
        io.to(roomId).emit('chatMessage', {
            sender: sender,
            message: message,
            senderId: socket.id,
            timestamp: Date.now()
        });
    });
    
    // Sumo Clicker handlers
    socket.on('sumoReady', (roomId) => {
        const room = sumoRooms.get(roomId);
        if (!room || room.gameStarted) return;
        
        if (!room.ready.includes(socket.id)) {
            room.ready.push(socket.id);
        }
        
        io.to(roomId).emit('sumoUpdate', {
            players: room.players,
            ready: room.ready
        });
        
        // Start game when both players are ready
        if (room.ready.length === 2 && room.players.length === 2) {
            room.gameStarted = true;
            startSumoGame(room, roomId);
        }
    });
    
    socket.on('sumoClick', ({ roomId, clicks }) => {
        const room = sumoRooms.get(roomId);
        if (!room || !room.gameStarted) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.clicks = clicks;
            
            io.to(roomId).emit('sumoProgress', {
                players: room.players
            });
        }
    });
    
    // Table Tennis handlers
    socket.on('pingpongReady', (roomId) => {
        const room = pingpongRooms.get(roomId);
        if (!room || room.gameStarted) return;
        
        if (!room.ready.includes(socket.id)) {
            room.ready.push(socket.id);
        }
        
        // Start game when both players are ready
        if (room.ready.length === 2 && room.players.length === 2) {
            room.gameStarted = true;
            startPingPongGame(room, roomId);
        }
    });
    
    socket.on('pingpongPaddle', ({ roomId, y }) => {
        const room = pingpongRooms.get(roomId);
        if (!room || !room.gameStarted) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            if (player.side === 1) {
                room.paddle1Y = y;
            } else {
                room.paddle2Y = y;
            }
        }
    });
    
    // FPS Events
    socket.on('fpsReady', (roomId) => {
        const room = fpsRooms.get(roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.ready = true;
        }
        
        if (room.players.every(p => p.ready)) {
            startFPSGame(room, roomId);
        }
    });
    
    socket.on('fpsMove', ({ roomId, x, y, angle }) => {
        const room = fpsRooms.get(roomId);
        if (!room || !room.gameActive) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.x = x;
            player.y = y;
            player.angle = angle;
        }
    });
    
    socket.on('fpsShoot', ({ roomId, x, y, angle }) => {
        const room = fpsRooms.get(roomId);
        if (!room || !room.gameActive) return;
        
        room.bullets.push({
            x: x,
            y: y,
            angle: angle,
            shooter: socket.id
        });
    });
    
    // Aim Battle Events
    socket.on('aimReady', (roomId) => {
        const room = aimRooms.get(roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.ready = true;
        }
        
        if (room.players.every(p => p.ready)) {
            startAimGame(room, roomId);
        }
    });
    
    socket.on('aimHit', ({ roomId, time }) => {
        const room = aimRooms.get(roomId);
        if (!room || !room.gameActive) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.hits++;
            player.times.push(time);
            
            // Send update to both players
            room.players.forEach(p => {
                const opponent = room.players.find(op => op.id !== p.id);
                const playerAvgTime = p.times.length > 0 ? p.times.reduce((a, b) => a + b, 0) / p.times.length : 0;
                const opponentAvgTime = opponent.times.length > 0 ? opponent.times.reduce((a, b) => a + b, 0) / opponent.times.length : 0;
                
                io.to(p.id).emit('aimUpdate', {
                    playerHits: p.hits,
                    opponentHits: opponent.hits,
                    playerAvgTime: playerAvgTime,
                    opponentAvgTime: opponentAvgTime
                });
            });
            
            // Check win condition
            if (player.hits >= 20) {
                endAimGame(room, roomId, socket.id);
                return;
            }
            
            // Spawn new target
            spawnAimTarget(room, roomId);
        }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        const player = players.get(socket.id);
        if (player && player.currentRoom) {
            const roomId = player.currentRoom;
            
            // Remove from poker room
            if (pokerRooms.has(roomId)) {
                const room = pokerRooms.get(roomId);
                room.players = room.players.filter(p => p.id !== socket.id);
                io.to(roomId).emit('roomUpdate', {
                    room,
                    message: `${player.name} left the table`
                });
                
                io.to(roomId).emit('chatSystem', {
                    message: `${player.name} left the table`
                });
            }
            
            // Remove from blackjack room
            if (blackjackRooms.has(roomId)) {
                const room = blackjackRooms.get(roomId);
                room.players = room.players.filter(p => p.id !== socket.id);
                io.to(roomId).emit('roomUpdate', {
                    room,
                    message: `${player.name} left the table`
                });
                
                io.to(roomId).emit('chatSystem', {
                    message: `${player.name} left the table`
                });
            }
            
            // Remove from sumo room
            if (sumoRooms.has(roomId)) {
                const room = sumoRooms.get(roomId);
                room.players = room.players.filter(p => p.id !== socket.id);
                room.ready = room.ready.filter(id => id !== socket.id);
                io.to(roomId).emit('roomUpdate', {
                    message: `${player.name} left the arena`
                });
                
                io.to(roomId).emit('chatSystem', {
                    message: `${player.name} left the arena`
                });
            }
            
            // Remove from pingpong room
            if (pingpongRooms.has(roomId)) {
                const room = pingpongRooms.get(roomId);
                room.players = room.players.filter(p => p.id !== socket.id);
                room.ready = room.ready.filter(id => id !== socket.id);
                room.gameStarted = false;
                io.to(roomId).emit('roomUpdate', {
                    message: `${player.name} left the match`
                });
                
                io.to(roomId).emit('chatSystem', {
                    message: `${player.name} left the match`
                });
            }
        }
        
        players.delete(socket.id);
    });
});

function advancePokerRound(room, roomId) {
    if (room.round === 'preflop') {
        room.round = 'flop';
        room.communityCards = [room.deck.pop(), room.deck.pop(), room.deck.pop()];
    } else if (room.round === 'flop') {
        room.round = 'turn';
        room.communityCards.push(room.deck.pop());
    } else if (room.round === 'turn') {
        room.round = 'river';
        room.communityCards.push(room.deck.pop());
    } else if (room.round === 'river') {
        // Showdown
        const activePlayers = room.players.filter(p => !p.folded);
        let bestPlayer = activePlayers[0];
        let bestHand = evaluatePokerHand([...bestPlayer.hand, ...room.communityCards]);
        
        activePlayers.forEach(player => {
            const hand = evaluatePokerHand([...player.hand, ...room.communityCards]);
            if (hand.rank > bestHand.rank) {
                bestPlayer = player;
                bestHand = hand;
            }
        });
        
        bestPlayer.chips += room.pot;
        
        // Prepare all players' hands with evaluations for reveal
        const allHands = room.players.map(p => ({
            name: p.name,
            hand: p.hand,
            folded: p.folded,
            evaluation: p.folded ? null : evaluatePokerHand([...p.hand, ...room.communityCards])
        }));
        
        io.to(roomId).emit('gameEnd', {
            winner: bestPlayer.name,
            hand: bestHand.name,
            pot: room.pot,
            allHands: allHands
        });
        
        room.gameStarted = false;
        
        // Auto-restart game after 3 seconds
        setTimeout(() => {
            resetPokerGame(room, roomId);
            setTimeout(() => startPokerGame(room, roomId), 500);
        }, 3000);
        return;
    }
    
    room.currentBet = 0;
    room.players.forEach(p => p.bet = 0);
    room.currentPlayerIndex = 0;
    
    io.to(roomId).emit('roundAdvance', { room });
    
    // Check if first player in new round is a bot
    setTimeout(() => {
        if (room.players[room.currentPlayerIndex].isBot) {
            processBotPokerTurn(room, roomId);
        }
    }, 500);
}

function resolveBlackjackRound(room, roomId) {
    // Dealer draws
    while (room.dealer.score < 17) {
        room.dealer.hand.push(room.deck.pop());
        room.dealer.score = calculateBlackjackScore(room.dealer.hand);
    }
    
    // Resolve each player
    room.players.forEach(player => {
        if (player.bet === 0) return;
        
        if (player.score > 21) {
            // Player bust
            player.result = 'Bust';
        } else if (room.dealer.score > 21 || player.score > room.dealer.score) {
            // Player wins
            player.chips += player.bet * 2;
            player.result = 'Win';
        } else if (player.score === room.dealer.score) {
            // Push
            player.chips += player.bet;
            player.result = 'Push';
        } else {
            // Dealer wins
            player.result = 'Loss';
        }
        
        player.bet = 0;
    });
    
    io.to(roomId).emit('blackjackEnd', {
        room,
        dealerHand: room.dealer.hand,
        dealerScore: room.dealer.score
    });
    
    room.gameStarted = false;
}

// Authentication endpoints
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const result = auth.registerUser(username, password);
    
    if (result.success) {
        req.session.user = result.user;
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const result = auth.loginUser(username, password);
    
    if (result.success) {
        req.session.user = result.user;
        res.json(result);
    } else {
        res.status(401).json(result);
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/user', (req, res) => {
    if (req.session.user) {
        const user = auth.getUser(req.session.user.username);
        res.json({ success: true, user });
    } else {
        res.json({ success: false, user: null });
    }
});

app.post('/api/save-chips', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    
    const { chips } = req.body;
    const success = auth.updateUserChips(req.session.user.username, chips);
    
    if (success) {
        req.session.user.chips = chips;
        res.json({ success: true, message: 'Chips saved' });
    } else {
        res.status(500).json({ success: false, message: 'Failed to save chips' });
    }
});

// Payment endpoint
app.post('/api/create-payment-intent', async (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    try {
        const { amount } = req.body;
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100, // Convert to cents
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
        });
        
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// FPS Game Functions
function startFPSGame(room, roomId) {
    room.gameActive = true;
    room.players[0].x = 100;
    room.players[0].y = 100;
    room.players[0].health = 100;
    room.players[0].kills = 0;
    room.players[0].deaths = 0;
    room.players[1].x = 700;
    room.players[1].y = 500;
    room.players[1].health = 100;
    room.players[1].kills = 0;
    room.players[1].deaths = 0;
    room.bullets = [];
    
    io.to(roomId).emit('fpsStart', { message: 'Fight!' });
    
    // Start game loop
    room.gameLoop = setInterval(() => {
        updateFPSGame(room, roomId);
    }, 16);
}

function updateFPSGame(room, roomId) {
    if (!room.gameActive) return;
    
    // Update bullets
    room.bullets = room.bullets.filter(bullet => {
        bullet.x += Math.cos(bullet.angle) * 10;
        bullet.y += Math.sin(bullet.angle) * 10;
        
        // Check bounds
        if (bullet.x < 0 || bullet.x > 800 || bullet.y < 0 || bullet.y > 600) {
            return false;
        }
        
        // Check hit on any opponent
        for (let opponent of room.players) {
            if (opponent.id === bullet.shooter) continue;
            
            const dx = bullet.x - opponent.x;
            const dy = bullet.y - opponent.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 20) {
                opponent.health -= 20;
                
                if (opponent.health <= 0) {
                    const shooter = room.players.find(p => p.id === bullet.shooter);
                    shooter.kills++;
                    opponent.deaths++;
                    
                    // Reset opponent position
                    opponent.x = Math.random() * 700 + 50;
                    opponent.y = Math.random() * 500 + 50;
                    opponent.health = 100;
                    
                    // Check win condition
                    if (shooter.kills >= 10) {
                        endFPSGame(room, roomId, shooter.id);
                        return false;
                    }
                }
                
                return false;
            }
        }
        
        return true;
    });
    
    // Emit state
    room.players.forEach(player => {
        const opponents = room.players.filter(p => p.id !== player.id).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            angle: p.angle,
            health: p.health,
            name: p.name
        }));
        
        io.to(player.id).emit('fpsUpdate', {
            opponents: opponents,
            playerHealth: player.health,
            playerKills: player.kills,
            playerDeaths: player.deaths,
            bullets: room.bullets
        });
    });
}

function endFPSGame(room, roomId, winnerId) {
    room.gameActive = false;
    
    if (room.gameLoop) {
        clearInterval(room.gameLoop);
        room.gameLoop = null;
    }
    
    const winner = room.players.find(p => p.id === winnerId);
    const loser = room.players.find(p => p.id !== winnerId);
    
    const winnings = room.pot / 2;
    
    io.to(winnerId).emit('fpsEnd', {
        winner: winnerId,
        kills: winner.kills,
        winnings: winnings,
        cost: 0
    });
    
    io.to(loser.id).emit('fpsEnd', {
        winner: winnerId,
        kills: loser.kills,
        winnings: 0,
        cost: room.pot / 2
    });
}

// Aim Battle Game Functions
function startAimGame(room, roomId) {
    room.gameActive = true;
    room.timeLeft = 30;
    room.players.forEach(p => {
        p.hits = 0;
        p.times = [];
    });
    
    io.to(roomId).emit('aimStart', { message: 'Shoot!' });
    
    // Spawn first target
    spawnAimTarget(room, roomId);
    
    // Game timer
    room.gameLoop = setInterval(() => {
        room.timeLeft--;
        
        if (room.timeLeft <= 0) {
            endAimGameByTime(room, roomId);
        }
    }, 1000);
}

function spawnAimTarget(room, roomId) {
    if (!room.gameActive) return;
    
    const target = {
        x: Math.random() * 700 + 50, // 50-750
        y: Math.random() * 500 + 50, // 50-550
        radius: 30
    };
    
    io.to(roomId).emit('aimTarget', target);
}

function endAimGameByTime(room, roomId) {
    if (!room.gameActive) return;
    
    room.gameActive = false;
    
    if (room.gameLoop) {
        clearInterval(room.gameLoop);
        room.gameLoop = null;
    }
    
    // Determine winner by most hits
    const [player1, player2] = room.players;
    const winnerId = player1.hits > player2.hits ? player1.id : player2.id;
    
    endAimGame(room, roomId, winnerId);
}

function endAimGame(room, roomId, winnerId) {
    room.gameActive = false;
    
    if (room.gameLoop) {
        clearInterval(room.gameLoop);
        room.gameLoop = null;
    }
    
    const winner = room.players.find(p => p.id === winnerId);
    const loser = room.players.find(p => p.id !== winnerId);
    
    const winnings = room.pot / 2;
    const winnerAvg = winner.times.length > 0 ? winner.times.reduce((a, b) => a + b, 0) / winner.times.length : 0;
    const loserAvg = loser.times.length > 0 ? loser.times.reduce((a, b) => a + b, 0) / loser.times.length : 0;
    
    io.to(winnerId).emit('aimEnd', {
        winner: winnerId,
        hits: winner.hits,
        avgTime: winnerAvg,
        winnings: winnings,
        cost: 0
    });
    
    io.to(loser.id).emit('aimEnd', {
        winner: winnerId,
        hits: loser.hits,
        avgTime: loserAvg,
        winnings: 0,
        cost: room.pot / 2
    });
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
