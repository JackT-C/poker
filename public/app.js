const socket = io();
let currentGame = null;
let currentRoom = null;
let playerName = '';
let playerChips = 1000;
let stripe = null;
let elements = null;
let selectedPackage = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    showLoadingScreen();
    
    setTimeout(() => {
        initializeEventListeners();
        loadPlayerData();
        
        // Initialize Stripe
        if (window.Stripe) {
            stripe = Stripe('pk_test_51SZsV8AOuELikwMgJJ9s11lkxtCaa19gBInvYx33SXtzTWTEEfkluMGAkiLtCCopQ9WpxUPtL4RwPNv4KsEMBUXX00mBF0Dseg');
        }
        
        hideLoadingScreen();
    }, 2000);
});

function showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingProgress = document.getElementById('loadingProgress');
    const loadingText = document.getElementById('loadingText');
    
    const messages = [
        'Loading games...',
        'Shuffling decks...',
        'Setting up tables...',
        'Preparing casino...',
        'Almost ready...'
    ];
    
    let progress = 0;
    let messageIndex = 0;
    
    const interval = setInterval(() => {
        progress += 20;
        loadingProgress.style.width = progress + '%';
        
        if (messageIndex < messages.length) {
            loadingText.textContent = messages[messageIndex];
            messageIndex++;
        }
        
        if (progress >= 100) {
            clearInterval(interval);
        }
    }, 400);
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 500);
}

function initializeEventListeners() {
    // Lobby
    document.querySelectorAll('.join-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gameCard = e.target.closest('.game-card');
            const game = gameCard.dataset.game;
            const roomInput = gameCard.querySelector('.room-input');
            const roomId = roomInput.value.trim() || generateRoomId();
            
            playerName = document.getElementById('playerName').value.trim() || 'Anonymous';
            joinGame(game, roomId);
        });
    });
    
    // Buy Chips
    document.getElementById('buyChipsBtn').addEventListener('click', openBuyChipsModal);
    document.querySelector('.close').addEventListener('click', closeBuyChipsModal);
    
    document.querySelectorAll('.select-package').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pkg = e.target.closest('.chip-package');
            selectedPackage = {
                amount: parseInt(pkg.dataset.amount),
                chips: parseInt(pkg.dataset.chips)
            };
            initializePayment();
        });
    });
    
    document.getElementById('submitPayment')?.addEventListener('click', handlePayment);
    
    // Poker Controls
    document.getElementById('leavePokerBtn').addEventListener('click', () => leaveGame());
    document.getElementById('startPokerBtn').addEventListener('click', () => {
        socket.emit('startPoker', currentRoom);
    });
    
document.getElementById('foldBtn').addEventListener('click', () => {
    playSound('fold');
    socket.emit('pokerAction', { roomId: currentRoom, action: 'fold' });
});document.getElementById('callBtn').addEventListener('click', () => {
    playSound('chip');
    socket.emit('pokerAction', { roomId: currentRoom, action: 'call' });
});    document.getElementById('raiseBtn').addEventListener('click', () => {
        const amount = parseInt(document.getElementById('raiseAmount').value) || 0;
        if (amount < 10) {
            showMessage('Minimum raise is $10', 'error');
            return;
        }
        socket.emit('pokerAction', { roomId: currentRoom, action: 'raise', amount });
    });
    
document.getElementById('allInBtn').addEventListener('click', () => {
    playSound('allin');
    socket.emit('pokerAction', { roomId: currentRoom, action: 'allin' });
});    document.getElementById('addPokerBotBtn').addEventListener('click', () => {
        console.log('Adding poker bot to room:', currentRoom);
        socket.emit('addBot', { roomId: currentRoom, game: 'poker' });
    });
    
    document.getElementById('resetPokerBtn').addEventListener('click', () => {
        socket.emit('resetPoker', currentRoom);
    });
    
    // Blackjack Controls
    document.getElementById('leaveBlackjackBtn').addEventListener('click', () => leaveGame());
    document.getElementById('placeBetBtn').addEventListener('click', () => {
        const amount = parseInt(document.getElementById('betAmount').value) || 0;
        if (amount <= 0) {
            showMessage('Bet must be positive', 'error');
            return;
        }
        if (amount > playerChips) {
            showMessage('Not enough chips', 'error');
            return;
        }
        socket.emit('placeBet', { roomId: currentRoom, amount });
    });
    
    document.getElementById('startBlackjackBtn').addEventListener('click', () => {
        socket.emit('startBlackjack', currentRoom);
    });
    
    document.getElementById('hitBtn').addEventListener('click', () => {
        socket.emit('hit', currentRoom);
    });
    
    document.getElementById('standBtn').addEventListener('click', () => {
        socket.emit('stand', currentRoom);
    });
    
    document.getElementById('addBlackjackBotBtn').addEventListener('click', () => {
        console.log('Adding blackjack bot to room:', currentRoom);
        socket.emit('addBot', { roomId: currentRoom, game: 'blackjack' });
    });
    
    document.getElementById('resetBlackjackBtn').addEventListener('click', () => {
        socket.emit('resetBlackjack', currentRoom);
    });
    
    // Sumo Clicker Controls
    document.getElementById('leaveSumoBtn').addEventListener('click', () => leaveGame());
    document.getElementById('startSumoBtn').addEventListener('click', () => {
        socket.emit('sumoReady', currentRoom);
    });
    
    let sumoClickCount = 0;
    document.getElementById('sumoClickBtn').addEventListener('click', () => {
        if (!document.getElementById('sumoClickBtn').disabled) {
            sumoClickCount++;
            socket.emit('sumoClick', { roomId: currentRoom, clicks: sumoClickCount });
        }
    });
    
    // Table Tennis Controls
    document.getElementById('leavePingPongBtn').addEventListener('click', () => leaveGame());
    document.getElementById('startPingPongBtn').addEventListener('click', () => {
        // Request fullscreen for canvas container to show overlay
        const container = document.getElementById('pingpongCanvas').parentElement;
        if (container.requestFullscreen) {
            container.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
        
        socket.emit('pingpongReady', currentRoom);
    });
    
    // FPS Controls
    document.getElementById('leaveFPSBtn').addEventListener('click', () => leaveGame());
    document.getElementById('startFPSBtn').addEventListener('click', () => {
        // Request fullscreen for FPS canvas container to show overlay
        const container = document.getElementById('fpsCanvas').parentElement;
        if (container.requestFullscreen) {
            container.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
        
        socket.emit('fpsReady', currentRoom);
    });
    
    // Aim Battle Controls
    document.getElementById('leaveAimBtn').addEventListener('click', () => leaveGame());
    document.getElementById('startAimBtn').addEventListener('click', () => {
        // Request fullscreen for aim canvas container to show overlay
        const container = document.getElementById('aimCanvas').parentElement;
        if (container.requestFullscreen) {
            container.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
        
        socket.emit('aimReady', currentRoom);
    });
    
    // Chat Controls
    document.getElementById('toggleChat').addEventListener('click', toggleChat);
    document.getElementById('chatSend').addEventListener('click', sendChatMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
}

// Socket Event Handlers
socket.on('roomUpdate', (data) => {
    if (data.message) {
        showMessage(data.message, 'success');
    }
    
    if (currentGame === 'poker') {
        updatePokerRoom(data.room);
    } else if (currentGame === 'blackjack') {
        updateBlackjackRoom(data.room);
    }
});

socket.on('dealCards', (data) => {
    playerHand = data.hand;
    displayPlayerHand(data.hand);
    updateHandEvaluation();
});

socket.on('gameStart', (data) => {
    updatePokerRoom(data.room);
    communityCards = data.room.communityCards;
    displayCommunityCards(data.room.communityCards);
    updateHandEvaluation();
    showMessage('Game started! Good luck!', 'success');
});

socket.on('gameUpdate', (data) => {
    updatePokerRoom(data.room);
    communityCards = data.room.communityCards;
    displayCommunityCards(data.room.communityCards);
    updateHandEvaluation();
});

socket.on('roundAdvance', (data) => {
    playSound('card');
    updatePokerRoom(data.room);
    communityCards = data.room.communityCards;
    displayCommunityCards(data.room.communityCards);
    updateHandEvaluation();
});

socket.on('gameEnd', (data) => {
    // Determine if current player won or lost
    const currentPlayerData = data.allHands.find(p => p.id === socket.id);
    const isWinner = data.winner === currentPlayerData?.name;
    
    // Play sound and show result image
    if (isWinner) {
        playSound('win');
        showResultImage('win');
    } else {
        playSound('lose');
        showResultImage('lose');
    }
    
    showMessage(`${data.winner} wins the pot of $${data.pot}!`, 'success');
    
    // Display all players' hands
    if (data.allHands) {
        displayAllPlayerHands(data.allHands);
    }
    
    // Show reset button after game ends
    setTimeout(() => {
        document.getElementById('resetPokerBtn').style.display = 'inline-block';
    }, 1500);
});

socket.on('blackjackStart', (data) => {
    updateBlackjackRoom(data.room);
    displayDealerCard(data.dealerCard);
    showMessage('Round started!', 'success');
});

socket.on('playerUpdate', (data) => {
    updateBlackjackPlayer(data.player);
});

socket.on('bust', (data) => {
    showMessage(`Bust! Score: ${data.score}`, 'error');
});

socket.on('blackjackEnd', (data) => {
    displayDealerHand(data.dealerHand, data.dealerScore);
    updateBlackjackRoom(data.room);
    
    setTimeout(() => {
        showMessage('Round ended. Place your bets for the next round!', 'success');
        // Show reset button
        document.getElementById('resetBlackjackBtn').style.display = 'inline-block';
    }, 2000);
});

socket.on('error', (data) => {
    showMessage(data.message, 'error');
});

// Chat Socket Events
socket.on('chatMessage', (data) => {
    addChatMessage(data.sender, data.message, data.senderId === socket.id);
});

socket.on('chatSystem', (data) => {
    addChatSystemMessage(data.message);
});

socket.on('gameReset', (data) => {
    if (currentGame === 'poker') {
        playerHand = [];
        communityCards = [];
        updatePokerRoom(data.room);
        document.getElementById('playerHand').innerHTML = '';
        document.getElementById('handEvaluation').innerHTML = '';
        document.getElementById('communityCards').innerHTML = '';
        document.getElementById('allPlayerHands').style.display = 'none';
        document.getElementById('resetPokerBtn').style.display = 'none';
        showMessage('Game reset! Ready to start a new game.', 'success');
    } else if (currentGame === 'blackjack') {
        updateBlackjackRoom(data.room);
        document.getElementById('dealerHand').innerHTML = '';
        document.getElementById('dealerScore').textContent = '';
        document.getElementById('resetBlackjackBtn').style.display = 'none';
        showMessage('Round reset! Place your bets.', 'success');
    }
});

// Sumo Socket Events
socket.on('sumoUpdate', (data) => {
    updateSumoRoom(data);
});

socket.on('sumoCountdown', (data) => {
    const timerDiv = document.getElementById('sumoTimer');
    const btn = document.getElementById('sumoClickBtn');
    const status = document.getElementById('sumoStatus');
    
    if (data.count > 0) {
        timerDiv.textContent = data.count;
        status.textContent = 'Get ready...';
        btn.disabled = true;
        btn.querySelector('.btn-subtitle').textContent = `Starting in ${data.count}...`;
    } else {
        timerDiv.textContent = 'CLICK!';
        status.textContent = '⚡ CLICK AS FAST AS YOU CAN! ⚡';
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'CLICK ME!';
        btn.querySelector('.btn-subtitle').textContent = 'Click repeatedly!';
    }
});

socket.on('sumoProgress', (data) => {
    // Update both players' progress
    data.players.forEach((player, index) => {
        const playerDiv = document.getElementById(`sumoPlayer${index + 1}`);
        if (playerDiv) {
            playerDiv.querySelector('.player-name').textContent = player.name;
            playerDiv.querySelector('.click-count').textContent = `${player.clicks} clicks`;
            
            const maxClicks = Math.max(...data.players.map(p => p.clicks), 1);
            const percentage = (player.clicks / maxClicks) * 100;
            playerDiv.querySelector('.click-progress').style.width = `${percentage}%`;
            
            if (player.id === socket.id) {
                playerDiv.classList.add('active');
            }
        }
    });
});

socket.on('sumoEnd', (data) => {
    const btn = document.getElementById('sumoClickBtn');
    const resultDiv = document.getElementById('sumoResult');
    const status = document.getElementById('sumoStatus');
    
    btn.disabled = true;
    status.textContent = 'Battle Complete!';
    
    if (data.winner.id === socket.id) {
        resultDiv.innerHTML = `🏆 YOU WIN! 🏆<br>${data.winner.clicks} clicks<br>+${data.winnings} chips!`;
        resultDiv.className = 'sumo-result winner';
        playerChips += data.winnings;
        updatePlayerChips();
    } else {
        resultDiv.innerHTML = `You Lost!<br>${data.winner.name} won with ${data.winner.clicks} clicks<br>-${data.cost} chips`;
        resultDiv.className = 'sumo-result loser';
        playerChips -= data.cost;
        updatePlayerChips();
    }
    
    // Reset after 5 seconds
    setTimeout(() => {
        resultDiv.innerHTML = '';
        btn.disabled = false;
        btn.querySelector('.btn-subtitle').textContent = 'Wait for countdown...';
        document.getElementById('startSumoBtn').style.display = 'block';
    }, 5000);
});

// Game Functions
function joinGame(game, roomId) {
    currentGame = game;
    currentRoom = roomId;
    
    socket.emit('joinRoom', {
        roomId: roomId,
        game: game,
        playerName: playerName
    });
    
    // Switch screens
    document.getElementById('lobby').classList.remove('active');
    
    if (game === 'poker') {
        document.getElementById('pokerGame').classList.add('active');
        document.getElementById('pokerRoomId').textContent = roomId;
    } else if (game === 'blackjack') {
        document.getElementById('blackjackGame').classList.add('active');
        document.getElementById('blackjackRoomId').textContent = roomId;
    } else if (game === 'sumo') {
        document.getElementById('sumoGame').classList.add('active');
        document.getElementById('sumoRoomId').textContent = roomId;
    } else if (game === 'pingpong') {
        document.getElementById('pingpongGame').classList.add('active');
        document.getElementById('pingpongRoomId').textContent = roomId;
        initPingPongGame();
    } else if (game === 'fps') {
        document.getElementById('fpsGame').classList.add('active');
        document.getElementById('fpsRoomId').textContent = roomId;
        initFPSGame();
    } else if (game === 'aim') {
        document.getElementById('aimGame').classList.add('active');
        document.getElementById('aimRoomId').textContent = roomId;
        initAimGame();
    }
}

function leaveGame() {
    // Exit fullscreen if active
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
    } else if (document.webkitFullscreenElement) {
        document.webkitExitFullscreen();
    } else if (document.msFullscreenElement) {
        document.msExitFullscreen();
    }
    
    currentGame = null;
    currentRoom = null;
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('lobby').classList.add('active');
    
    location.reload();
}

function updatePokerRoom(room) {
    if (!room) return;
    
    // Update pot
    document.getElementById('pot').textContent = `$${room.pot || 0}`;
    
    // Update call button text
    const player = room.players.find(p => p.id === socket.id);
    if (player && room.gameStarted) {
        const callAmount = room.currentBet - player.bet;
        const callBtn = document.getElementById('callBtn');
        if (callAmount === 0) {
            callBtn.textContent = 'Check';
        } else {
            callBtn.textContent = `Call $${callAmount}`;
        }
    }
    
    // Update round info
    const roundDiv = document.getElementById('roundInfo');
    if (room.gameStarted) {
        const roundNames = {
            'preflop': '🎴 Pre-Flop',
            'flop': '🃏 Flop',
            'turn': '🎯 Turn',
            'river': '🌊 River'
        };
        roundDiv.innerHTML = `<div style="color: #d4af37; font-size: 1.2em; font-weight: bold; text-align: center; margin-bottom: 10px;">${roundNames[room.round] || room.round}</div>`;
    } else {
        roundDiv.innerHTML = '';
    }
    
    // Update turn indicator with action instructions
    const currentPlayer = room.players[room.currentPlayerIndex];
    const turnDiv = document.getElementById('currentTurn');
    if (currentPlayer && room.gameStarted) {
        const isYourTurn = currentPlayer.id === socket.id;
        if (isYourTurn) {
            const callAmount = room.currentBet - currentPlayer.bet;
            let actionText = '';
            if (callAmount === 0) {
                actionText = 'CHECK or RAISE to continue';
            } else {
                actionText = `CALL $${callAmount}, RAISE, or FOLD`;
            }
            turnDiv.innerHTML = `<div style="color: #2ecc71; font-size: 1.3em; font-weight: bold; animation: pulse 1.5s infinite;">🎯 YOUR TURN! ${actionText}</div>`;
        } else {
            const action = currentPlayer.isBot ? '🤖 Bot thinking...' : `⏳ Waiting for ${currentPlayer.name}`;
            turnDiv.innerHTML = `<div style="color: #f39c12; font-size: 1.1em;">${action}</div>`;
        }
    } else {
        turnDiv.innerHTML = '';
    }
    
    // Update community cards
    displayCommunityCards(room.communityCards);
    
    // Update players
    const playersContainer = document.getElementById('pokerPlayers');
    playersContainer.innerHTML = '';
    
    room.players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-spot';
        if (index === room.currentPlayerIndex) {
            playerDiv.classList.add('active');
        }
        if (player.folded) {
            playerDiv.classList.add('folded');
        }
        
        playerDiv.innerHTML = `
            <div class="player-name">${player.isBot ? '🤖 ' : ''}${player.name}</div>
            <div class="player-chips">$${player.chips}</div>
            <div class="player-bet">Bet: $${player.bet}</div>
        `;
        
        // Position players around the table
        const angle = (index / room.players.length) * 2 * Math.PI;
        const x = 50 + 35 * Math.cos(angle);
        const y = 50 + 35 * Math.sin(angle);
        playerDiv.style.left = `${x}%`;
        playerDiv.style.top = `${y}%`;
        playerDiv.style.transform = 'translate(-50%, -50%)';
        
        playersContainer.appendChild(playerDiv);
    });
}

function updateBlackjackRoom(room) {
    if (!room) return;
    
    // Update turn indicator
    const turnDiv = document.getElementById('blackjackTurn');
    if (room.gameStarted) {
        const activePlayers = room.players.filter(p => p.bet > 0 && !p.standing);
        if (activePlayers.length > 0) {
            const yourTurn = activePlayers.find(p => p.id === socket.id);
            turnDiv.innerHTML = yourTurn
                ? '<div style="color: #2ecc71; font-size: 1.3em; font-weight: bold; animation: pulse 1.5s infinite;">🎯 YOUR TURN! Hit or Stand?</div>'
                : `<div style="color: #f39c12; font-size: 1.1em;">Waiting for other players...</div>`;
        } else {
            turnDiv.innerHTML = '<div style="color: #95a5a6; font-size: 1.1em;">Round in progress...</div>';
        }
    } else {
        turnDiv.innerHTML = '';
    }
    
    const playersGrid = document.getElementById('blackjackPlayers');
    playersGrid.innerHTML = '';
    
    room.players.forEach(player => {
        const playerBox = document.createElement('div');
        playerBox.className = 'player-box';
        if (player.id === socket.id) {
            playerBox.classList.add('current');
        }
        
        playerBox.innerHTML = `
            <h4>${player.isBot ? '🤖 ' : ''}${player.name}</h4>
            <div class="hand">${renderHand(player.hand)}</div>
            <div class="score">${player.score > 0 ? 'Score: ' + player.score : ''}</div>
            <div class="player-chips">Chips: $${player.chips}</div>
            <div class="player-bet">Bet: $${player.bet}</div>
            ${player.result ? `<div class="result">${player.result}</div>` : ''}
        `;
        
        playersGrid.appendChild(playerBox);
    });
}

function updateBlackjackPlayer(player) {
    const playerBoxes = document.querySelectorAll('.player-box');
    playerBoxes.forEach(box => {
        if (box.querySelector('h4').textContent === player.name) {
            box.querySelector('.hand').innerHTML = renderHand(player.hand);
            box.querySelector('.score').textContent = player.score > 0 ? 'Score: ' + player.score : '';
        }
    });
}

function displayPlayerHand(hand) {
    const handDiv = document.getElementById('playerHand');
    handDiv.innerHTML = renderHand(hand);
}

function displayCommunityCards(cards) {
    const cardsDiv = document.getElementById('communityCards');
    cardsDiv.innerHTML = renderHand(cards);
}

function displayDealerCard(card) {
    const dealerHand = document.getElementById('dealerHand');
    dealerHand.innerHTML = renderCard(card) + '<div class="card">🂠</div>';
}

function displayDealerHand(hand, score) {
    const dealerHand = document.getElementById('dealerHand');
    const dealerScore = document.getElementById('dealerScore');
    dealerHand.innerHTML = renderHand(hand);
    dealerScore.textContent = `Score: ${score}`;
}

function renderHand(cards) {
    if (!cards || cards.length === 0) return '';
    return cards.map(card => renderCard(card)).join('');
}

function renderCard(card) {
    const isRed = card.suit === '♥' || card.suit === '♦';
    return `
        <div class="card ${isRed ? 'red' : 'black'}">
            <div class="rank">${card.rank}</div>
            <div class="suit">${card.suit}</div>
        </div>
    `;
}

// Poker hand evaluation (client-side)
let playerHand = [];
let communityCards = [];

function evaluatePokerHand(cards) {
    if (!cards || cards.length < 5) {
        return { rank: -1, name: '', description: '' };
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
    
    const highCard = Object.keys(rankCounts).reduce((a, b) => rankValues[a] > rankValues[b] ? a : b);
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

function displayAllPlayerHands(allHands) {
    const container = document.getElementById('allPlayerHands');
    if (!container) return;
    
    container.innerHTML = '<h3>Final Hands:</h3>';
    
    allHands.forEach(playerData => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-final-hand';
        
        let handHTML = `<div class="player-hand-name">${playerData.name}:</div>`;
        
        if (playerData.folded) {
            handHTML += '<div class="folded-text">Folded</div>';
        } else {
            handHTML += '<div class="final-cards">';
            playerData.hand.forEach(card => {
                const color = (card.suit === '♥' || card.suit === '♦') ? 'red' : 'black';
                handHTML += `<div class="card" style="color: ${color}">${card.rank}${card.suit}</div>`;
            });
            handHTML += '</div>';
            
            if (playerData.evaluation) {
                const colors = ['#666', '#2196F3', '#4CAF50', '#FF9800', '#FF5722', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#FFD700'];
                const color = colors[playerData.evaluation.rank];
                handHTML += `<div class="hand-eval" style="color: ${color}; font-weight: bold;">${playerData.evaluation.name}</div>`;
            }
        }
        
        playerDiv.innerHTML = handHTML;
        container.appendChild(playerDiv);
    });
    
    container.style.display = 'block';
}

function updateHandEvaluation() {
    const evalDiv = document.getElementById('handEvaluation');
    if (!evalDiv) return;
    
    const allCards = [...playerHand, ...communityCards];
    if (allCards.length >= 5) {
        const evaluation = evaluatePokerHand(allCards);
        if (evaluation.rank >= 0) {
            const color = evaluation.rank >= 4 ? '#2ecc71' : evaluation.rank >= 1 ? '#f39c12' : '#95a5a6';
            evalDiv.innerHTML = `<div style="color: ${color}; font-weight: bold; font-size: 1.2em; margin-top: 10px;">${evaluation.description}</div>`;
        }
    } else if (playerHand.length > 0) {
        evalDiv.innerHTML = '<div style="color: #95a5a6; font-size: 1em; margin-top: 10px;">Waiting for community cards...</div>';
    } else {
        evalDiv.innerHTML = '';
    }
}

// Payment Functions
function openBuyChipsModal() {
    document.getElementById('buyChipsModal').classList.add('active');
}

function closeBuyChipsModal() {
    document.getElementById('buyChipsModal').classList.remove('active');
    if (elements) {
        elements.destroy();
        elements = null;
    }
    document.getElementById('paymentElement').innerHTML = '';
    document.getElementById('submitPayment').style.display = 'none';
}

async function initializePayment() {
    if (!stripe || !selectedPackage) return;
    
    try {
        const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: selectedPackage.amount })
        });
        
        const { clientSecret } = await response.json();
        
        elements = stripe.elements({ clientSecret });
        const paymentElement = elements.create('payment');
        paymentElement.mount('#paymentElement');
        
        document.getElementById('submitPayment').style.display = 'block';
    } catch (error) {
        showMessage('Payment initialization failed', 'error');
        console.error(error);
    }
}

async function handlePayment() {
    if (!stripe || !elements) return;
    
    const submitBtn = document.getElementById('submitPayment');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    
    try {
        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href,
            },
            redirect: 'if_required'
        });
        
        if (error) {
            showMessage(error.message, 'error');
        } else {
            // Payment successful
            playerChips += selectedPackage.chips;
            updatePlayerChips();
            savePlayerData();
            showMessage(`Successfully purchased ${selectedPackage.chips} chips!`, 'success');
            closeBuyChipsModal();
        }
    } catch (error) {
        showMessage('Payment failed', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Complete Purchase';
    }
}

// Utility Functions
function generateRoomId() {
    return 'room_' + Math.random().toString(36).substr(2, 9);
}

function updateSumoRoom(data) {
    const { players, ready } = data;
    
    // Update player displays
    players.forEach((player, index) => {
        const playerDiv = document.getElementById(`sumoPlayer${index + 1}`);
        if (playerDiv) {
            playerDiv.querySelector('.player-name').textContent = player.name;
            playerDiv.querySelector('.click-count').textContent = '0 clicks';
            playerDiv.querySelector('.click-progress').style.width = '0%';
        }
    });
    
    // Update status
    const status = document.getElementById('sumoStatus');
    if (ready.length === 2) {
        status.textContent = 'Both players ready! Starting soon...';
        document.getElementById('startSumoBtn').style.display = 'none';
    } else if (ready.length === 1) {
        status.textContent = 'Waiting for opponent to ready up...';
    } else {
        status.textContent = 'Waiting for players...';
    }
}

function showMessage(text, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    
    const container = document.getElementById('messageContainer');
    container.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 4000);
}

function updatePlayerChips() {
    document.getElementById('playerChips').textContent = playerChips;
}

function showResultImage(result) {
    const overlay = document.createElement('div');
    overlay.className = 'result-overlay';
    
    const img = document.createElement('img');
    if (result === 'win') {
        img.src = '/imgs/Win screeen img.jpg';
        img.alt = 'You Win!';
    } else {
        img.src = '/imgs/lose screen.png';
        img.alt = 'You Lost';
    }
    img.className = 'result-image';
    
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    
    // Fade in
    setTimeout(() => overlay.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 500);
    }, 3000);
}

function savePlayerData() {
    localStorage.setItem('playerChips', playerChips);
    localStorage.setItem('playerName', playerName);
}

function loadPlayerData() {
    const savedChips = localStorage.getItem('playerChips');
    const savedName = localStorage.getItem('playerName');
    
    if (savedChips) {
        playerChips = parseInt(savedChips);
        updatePlayerChips();
    }
    
    if (savedName) {
        document.getElementById('playerName').value = savedName;
    }
}

// Chat Functions
function toggleChat() {
    const chatWidget = document.getElementById('chatWidget');
    const toggleBtn = document.getElementById('toggleChat');
    
    chatWidget.classList.toggle('minimized');
    toggleBtn.textContent = chatWidget.classList.contains('minimized') ? '+' : '−';
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || !currentRoom) return;
    
    socket.emit('chatMessage', {
        roomId: currentRoom,
        message: message,
        sender: playerName || 'Anonymous'
    });
    
    input.value = '';
}

function addChatMessage(sender, message, isOwn) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own' : 'other'}`;
    
    if (!isOwn) {
        const senderSpan = document.createElement('div');
        senderSpan.className = 'chat-sender';
        senderSpan.textContent = sender;
        messageDiv.appendChild(senderSpan);
    }
    
    const textDiv = document.createElement('div');
    textDiv.className = 'chat-text';
    textDiv.textContent = message;
    messageDiv.appendChild(textDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addChatSystemMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message system';
    messageDiv.textContent = message;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Table Tennis Game Logic
let pingpongGame = null;

function initPingPongGame() {
    const canvas = document.getElementById('pingpongCanvas');
    const ctx = canvas.getContext('2d');
    
    pingpongGame = {
        canvas: canvas,
        ctx: ctx,
        ball: { x: 400, y: 250, radius: 8, speedX: 0, speedY: 0 },
        paddle1: { x: 10, y: 200, width: 10, height: 100 },
        paddle2: { x: 780, y: 200, width: 10, height: 100 },
        score1: 0,
        score2: 0,
        playerSide: null,
        isPlaying: false,
        keys: {}
    };
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (currentGame === 'pingpong') {
            pingpongGame.keys[e.key] = true;
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (currentGame === 'pingpong') {
            pingpongGame.keys[e.key] = false;
        }
    });
    
    drawPingPongGame();
}

function drawPingPongGame() {
    if (!pingpongGame || currentGame !== 'pingpong') return;
    
    const { ctx, canvas, ball, paddle1, paddle2 } = pingpongGame;
    
    // Clear canvas
    ctx.fillStyle = '#0a3d0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw center line
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw paddles
    ctx.fillStyle = '#fff';
    ctx.fillRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height);
    ctx.fillRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height);
    
    // Draw ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    
    requestAnimationFrame(drawPingPongGame);
}

function updatePingPongPaddle() {
    if (!pingpongGame || !pingpongGame.isPlaying) return;
    
    const paddle = pingpongGame.playerSide === 1 ? pingpongGame.paddle1 : pingpongGame.paddle2;
    const speed = 12;
    
    if (pingpongGame.keys['ArrowUp'] && paddle.y > 0) {
        paddle.y -= speed;
    }
    if (pingpongGame.keys['ArrowDown'] && paddle.y < pingpongGame.canvas.height - paddle.height) {
        paddle.y += speed;
    }
    
    // Emit paddle position
    socket.emit('pingpongPaddle', {
        roomId: currentRoom,
        y: paddle.y
    });
}

// Ping Pong Socket Events
socket.on('pingpongStart', (data) => {
    if (!pingpongGame) return;
    
    pingpongGame.isPlaying = true;
    pingpongGame.playerSide = data.playerSide;
    pingpongGame.score1 = 0;
    pingpongGame.score2 = 0;
    
    // Update player names on scoreboard
    document.querySelector('#player1Score .score-name').textContent = data.player1Name || 'Player 1';
    document.querySelector('#player2Score .score-name').textContent = data.player2Name || 'Player 2';
    
    document.getElementById('pingpongStatus').textContent = `You are Player ${data.playerSide}`;
    document.getElementById('startPingPongBtn').style.display = 'none';
    
    // Show overlay for fullscreen
    document.getElementById('pingpongScoreOverlay').classList.add('active');
    
    // Start sending paddle updates
    if (!pingpongGame.updateInterval) {
        pingpongGame.updateInterval = setInterval(updatePingPongPaddle, 16); // 60 FPS
    }
});

socket.on('pingpongUpdate', (data) => {
    if (!pingpongGame) return;
    
    // Update ball position
    pingpongGame.ball.x = data.ball.x;
    pingpongGame.ball.y = data.ball.y;
    pingpongGame.ball.speedX = data.ball.speedX;
    pingpongGame.ball.speedY = data.ball.speedY;
    
    // Update paddle positions
    pingpongGame.paddle1.y = data.paddle1Y;
    pingpongGame.paddle2.y = data.paddle2Y;
    
    // Update scores
    pingpongGame.score1 = data.score1;
    pingpongGame.score2 = data.score2;
    
    // Update scoreboard
    document.querySelector('#player1Score .score-value').textContent = data.score1;
    document.querySelector('#player2Score .score-value').textContent = data.score2;
    
    // Update overlay scores for fullscreen
    document.getElementById('overlayScore1').textContent = data.score1;
    document.getElementById('overlayScore2').textContent = data.score2;
});

socket.on('pingpongEnd', (data) => {
    if (!pingpongGame) return;
    
    pingpongGame.isPlaying = false;
    
    // Stop update interval
    if (pingpongGame.updateInterval) {
        clearInterval(pingpongGame.updateInterval);
        pingpongGame.updateInterval = null;
    }
    
    const resultDiv = document.getElementById('pingpongResult');
    const isWinner = data.winner === pingpongGame.playerSide;
    
    if (isWinner) {
        resultDiv.innerHTML = `🏆 YOU WIN! 🏆<br>Score: ${data.score1} - ${data.score2}<br>+${data.winnings} chips!`;
        resultDiv.className = 'pingpong-result winner';
        playerChips += data.winnings;
    } else {
        resultDiv.innerHTML = `You Lost!<br>Score: ${data.score1} - ${data.score2}<br>-${data.cost} chips`;
        resultDiv.className = 'pingpong-result loser';
        playerChips -= data.cost;
    }
    
    updatePlayerChips();
    
    setTimeout(() => {
        resultDiv.innerHTML = '';
        document.getElementById('startPingPongBtn').style.display = 'block';
        document.getElementById('pingpongStatus').textContent = 'Waiting for opponent...';
    }, 5000);
});

// FPS Game Logic
let fpsGame = null;

function initFPSGame() {
    const canvas = document.getElementById('fpsCanvas');
    const ctx = canvas.getContext('2d');
    
    fpsGame = {
        canvas: canvas,
        ctx: ctx,
        player: { x: 100, y: 100, angle: 0, health: 100, kills: 0, deaths: 0 },
        opponents: [],
        bullets: [],
        keys: {},
        mouse: { x: 0, y: 0 },
        isPlaying: false,
        ammo: 30
    };
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (currentGame === 'fps') {
            fpsGame.keys[e.key.toLowerCase()] = true;
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (currentGame === 'fps') {
            fpsGame.keys[e.key.toLowerCase()] = false;
        }
    });
    
    // Mouse controls
    canvas.addEventListener('mousemove', (e) => {
        if (currentGame === 'fps' && fpsGame.isPlaying) {
            const rect = canvas.getBoundingClientRect();
            fpsGame.mouse.x = e.clientX - rect.left;
            fpsGame.mouse.y = e.clientY - rect.top;
            
            // Calculate angle
            fpsGame.player.angle = Math.atan2(
                fpsGame.mouse.y - fpsGame.player.y,
                fpsGame.mouse.x - fpsGame.player.x
            );
        }
    });
    
    canvas.addEventListener('click', () => {
        if (currentGame === 'fps' && fpsGame.isPlaying && fpsGame.ammo > 0) {
            shoot();
        }
    });
    
    drawFPSGame();
}

function shoot() {
    if (!fpsGame || fpsGame.ammo <= 0) return;
    
    fpsGame.ammo--;
    document.getElementById('ammoCount').textContent = fpsGame.ammo;
    document.getElementById('overlayAmmo').textContent = fpsGame.ammo;
    
    socket.emit('fpsShoot', {
        roomId: currentRoom,
        x: fpsGame.player.x,
        y: fpsGame.player.y,
        angle: fpsGame.player.angle
    });
    
    // Auto reload
    if (fpsGame.ammo === 0) {
        setTimeout(() => {
            fpsGame.ammo = 30;
            document.getElementById('ammoCount').textContent = fpsGame.ammo;
            document.getElementById('overlayAmmo').textContent = fpsGame.ammo;
        }, 2000);
    }
}

function drawFPSGame() {
    if (!fpsGame || currentGame !== 'fps') return;
    
    const { ctx, canvas, player, opponents, bullets } = fpsGame;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    // Draw all opponents
    opponents.forEach(opponent => {
        if (opponent.health > 0) {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(opponent.x, opponent.y, 20, 0, Math.PI * 2);
            ctx.fill();
            
            // Opponent health bar
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(opponent.x - 25, opponent.y - 35, 50 * (opponent.health / 100), 5);
            
            // Opponent name
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(opponent.name || 'Player', opponent.x, opponent.y - 45);
        }
    });
    
    // Draw player
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw player direction
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(
        player.x + Math.cos(player.angle) * 30,
        player.y + Math.sin(player.angle) * 30
    );
    ctx.stroke();
    
    // Draw bullets
    bullets.forEach(bullet => {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    
    requestAnimationFrame(drawFPSGame);
}

function updateFPSPlayer() {
    if (!fpsGame || !fpsGame.isPlaying) return;
    
    const speed = 3;
    let moved = false;
    
    if (fpsGame.keys['w'] && fpsGame.player.y > 20) {
        fpsGame.player.y -= speed;
        moved = true;
    }
    if (fpsGame.keys['s'] && fpsGame.player.y < fpsGame.canvas.height - 20) {
        fpsGame.player.y += speed;
        moved = true;
    }
    if (fpsGame.keys['a'] && fpsGame.player.x > 20) {
        fpsGame.player.x -= speed;
        moved = true;
    }
    if (fpsGame.keys['d'] && fpsGame.player.x < fpsGame.canvas.width - 20) {
        fpsGame.player.x += speed;
        moved = true;
    }
    
    if (moved) {
        socket.emit('fpsMove', {
            roomId: currentRoom,
            x: fpsGame.player.x,
            y: fpsGame.player.y,
            angle: fpsGame.player.angle
        });
    }
}

// FPS Socket Events
socket.on('fpsStart', (data) => {
    if (!fpsGame) return;
    
    fpsGame.isPlaying = true;
    fpsGame.player.health = 100;
    fpsGame.opponents = [];
    fpsGame.ammo = 30;
    
    document.getElementById('fpsStatus').textContent = 'FIGHT!';
    document.getElementById('startFPSBtn').style.display = 'none';
    document.getElementById('playerHealth').textContent = '100';
    document.getElementById('healthFill').style.width = '100%';
    document.getElementById('ammoCount').textContent = '30';
    
    // Show overlay for fullscreen
    document.getElementById('fpsScoreOverlay').classList.add('active');
    document.getElementById('overlayHealth').textContent = '100';
    document.getElementById('overlayKills').textContent = '0';
    document.getElementById('overlayDeaths').textContent = '0';
    document.getElementById('overlayAmmo').textContent = '30';
    
    if (!fpsGame.updateInterval) {
        fpsGame.updateInterval = setInterval(updateFPSPlayer, 16);
    }
});

socket.on('fpsUpdate', (data) => {
    if (!fpsGame) return;
    
    fpsGame.opponents = data.opponents || [];
    fpsGame.player.health = data.playerHealth;
    fpsGame.bullets = data.bullets || [];
    
    // Update HUD
    document.getElementById('playerHealth').textContent = fpsGame.player.health;
    document.getElementById('healthFill').style.width = `${fpsGame.player.health}%`;
    document.getElementById('playerKills').textContent = data.playerKills;
    document.getElementById('playerDeaths').textContent = data.playerDeaths;
    
    // Update overlay for fullscreen
    document.getElementById('overlayHealth').textContent = fpsGame.player.health;
    document.getElementById('overlayKills').textContent = data.playerKills;
    document.getElementById('overlayDeaths').textContent = data.playerDeaths;
});

socket.on('fpsEnd', (data) => {
    if (!fpsGame) return;
    
    fpsGame.isPlaying = false;
    
    if (fpsGame.updateInterval) {
        clearInterval(fpsGame.updateInterval);
        fpsGame.updateInterval = null;
    }
    
    const resultDiv = document.getElementById('fpsResult');
    const isWinner = data.winner === socket.id;
    
    if (isWinner) {
        resultDiv.innerHTML = `🏆 VICTORY! 🏆<br>Kills: ${data.kills}<br>+${data.winnings} chips!`;
        resultDiv.className = 'fps-result winner';
        playerChips += data.winnings;
    } else {
        resultDiv.innerHTML = `DEFEATED!<br>Kills: ${data.kills}<br>-${data.cost} chips`;
        resultDiv.className = 'fps-result loser';
        playerChips -= data.cost;
    }
    
    updatePlayerChips();
    
    setTimeout(() => {
        resultDiv.innerHTML = '';
        document.getElementById('startFPSBtn').style.display = 'block';
        document.getElementById('fpsStatus').textContent = 'Waiting for opponent...';
    }, 5000);
});

// Aim Battle Game Logic
let aimGame = null;

function initAimGame() {
    const canvas = document.getElementById('aimCanvas');
    const ctx = canvas.getContext('2d');
    
    aimGame = {
        canvas: canvas,
        ctx: ctx,
        targets: [],
        playerHits: 0,
        opponentHits: 0,
        playerTimes: [],
        opponentTimes: [],
        isPlaying: false,
        timeLeft: 30,
        lastTargetTime: 0
    };
    
    // Click handler for targets
    canvas.addEventListener('click', (e) => {
        if (!aimGame || !aimGame.isPlaying) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicked on a target
        for (let i = aimGame.targets.length - 1; i >= 0; i--) {
            const target = aimGame.targets[i];
            const dx = x - target.x;
            const dy = y - target.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < target.radius) {
                const hitTime = Date.now() - aimGame.lastTargetTime;
                socket.emit('aimHit', { roomId: currentRoom, time: hitTime });
                aimGame.targets.splice(i, 1);
                break;
            }
        }
    });
    
    drawAimGame();
}

function drawAimGame() {
    if (!aimGame || currentGame !== 'aim') return;
    
    const { ctx, canvas, targets } = aimGame;
    
    // Clear canvas
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid pattern
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    // Draw targets
    targets.forEach(target => {
        // Outer ring
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3366';
        ctx.fill();
        
        // Middle ring
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // Center
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3366';
        ctx.fill();
    });
    
    requestAnimationFrame(drawAimGame);
}

// Aim Battle Socket Events
socket.on('aimStart', (data) => {
    if (!aimGame) return;
    
    aimGame.isPlaying = true;
    aimGame.playerHits = 0;
    aimGame.opponentHits = 0;
    aimGame.playerTimes = [];
    aimGame.opponentTimes = [];
    aimGame.timeLeft = 30;
    aimGame.lastTargetTime = Date.now();
    
    document.getElementById('aimStatus').textContent = 'SHOOT!';
    document.getElementById('startAimBtn').style.display = 'none';
    document.getElementById('aimTimer').classList.add('active');
    document.getElementById('aimScoreOverlay').classList.add('active');
    
    // Initialize overlay scores
    document.getElementById('overlayPlayerHits').textContent = '0';
    document.getElementById('overlayOppHits').textContent = '0';
    document.getElementById('overlayPlayerTime').textContent = '0';
    document.getElementById('overlayOppTime').textContent = '0';
    document.getElementById('overlayTimer').textContent = '30';
    
    // Timer countdown
    const timerInterval = setInterval(() => {
        aimGame.timeLeft--;
        document.getElementById('aimTimer').textContent = aimGame.timeLeft;
        document.getElementById('overlayTimer').textContent = aimGame.timeLeft;
        
        if (aimGame.timeLeft <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);
    
    aimGame.timerInterval = timerInterval;
});

socket.on('aimTarget', (data) => {
    if (!aimGame) return;
    
    aimGame.targets = [{
        x: data.x,
        y: data.y,
        radius: data.radius
    }];
    aimGame.lastTargetTime = Date.now();
});

socket.on('aimUpdate', (data) => {
    if (!aimGame) return;
    
    aimGame.playerHits = data.playerHits;
    aimGame.opponentHits = data.opponentHits;
    
    const playerAvg = data.playerAvgTime || 0;
    const opponentAvg = data.opponentAvgTime || 0;
    
    document.getElementById('playerHits').textContent = data.playerHits;
    document.getElementById('opponentHits').textContent = data.opponentHits;
    document.getElementById('playerAvgTime').textContent = Math.round(playerAvg);
    document.getElementById('opponentAvgTime').textContent = Math.round(opponentAvg);
    
    document.getElementById('overlayPlayerHits').textContent = data.playerHits;
    document.getElementById('overlayOppHits').textContent = data.opponentHits;
    document.getElementById('overlayPlayerTime').textContent = Math.round(playerAvg);
    document.getElementById('overlayOppTime').textContent = Math.round(opponentAvg);
});

socket.on('aimEnd', (data) => {
    if (!aimGame) return;
    
    aimGame.isPlaying = false;
    aimGame.targets = [];
    
    if (aimGame.timerInterval) {
        clearInterval(aimGame.timerInterval);
    }
    
    document.getElementById('aimTimer').classList.remove('active');
    
    const resultDiv = document.getElementById('aimResult');
    const isWinner = data.winner === socket.id;
    
    if (isWinner) {
        resultDiv.innerHTML = `🎯 VICTORY! 🎯<br>Hits: ${data.hits} | Avg: ${Math.round(data.avgTime)}ms<br>+${data.winnings} chips!`;
        resultDiv.className = 'aim-result winner';
        playerChips += data.winnings;
    } else {
        resultDiv.innerHTML = `Target Missed!<br>Hits: ${data.hits} | Avg: ${Math.round(data.avgTime)}ms<br>-${data.cost} chips`;
        resultDiv.className = 'aim-result loser';
        playerChips -= data.cost;
    }
    
    resultDiv.style.display = 'block';
    updatePlayerChips();
    
    setTimeout(() => {
        resultDiv.style.display = 'none';
        document.getElementById('startAimBtn').style.display = 'block';
        document.getElementById('aimStatus').textContent = 'Waiting for opponent...';
    }, 5000);
});

// Window event handlers
window.onclick = function(event) {
    const modal = document.getElementById('buyChipsModal');
    if (event.target === modal) {
        closeBuyChipsModal();
    }
}
