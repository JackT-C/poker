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
            player.chips -= callAmount;
            player.bet += callAmount;
            room.pot += callAmount;
        } else if (action === 'raise') {
            const raiseAmount = amount || room.currentBet * 2;
            const totalAmount = raiseAmount - player.bet;
            player.chips -= totalAmount;
            player.bet = raiseAmount;
            room.pot += totalAmount;
            room.currentBet = raiseAmount;
        }
        
        // Move to next player
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
        
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

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
