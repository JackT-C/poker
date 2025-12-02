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
    initializeEventListeners();
    loadPlayerData();
    
    // Initialize Stripe
    if (window.Stripe) {
        stripe = Stripe('pk_test_51SZsV8AOuELikwMgJJ9s11lkxtCaa19gBInvYx33SXtzTWTEEfkluMGAkiLtCCopQ9WpxUPtL4RwPNv4KsEMBUXX00mBF0Dseg');
    }
});

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
        socket.emit('pokerAction', { roomId: currentRoom, action: 'fold' });
    });
    
    document.getElementById('callBtn').addEventListener('click', () => {
        socket.emit('pokerAction', { roomId: currentRoom, action: 'call' });
    });
    
    document.getElementById('raiseBtn').addEventListener('click', () => {
        const amount = parseInt(document.getElementById('raiseAmount').value) || 0;
        socket.emit('pokerAction', { roomId: currentRoom, action: 'raise', amount });
    });
    
    document.getElementById('addPokerBotBtn').addEventListener('click', () => {
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
        if (amount > 0 && amount <= playerChips) {
            socket.emit('placeBet', { roomId: currentRoom, amount });
        } else {
            showMessage('Invalid bet amount', 'error');
        }
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
    updatePokerRoom(data.room);
    communityCards = data.room.communityCards;
    displayCommunityCards(data.room.communityCards);
    updateHandEvaluation();
});

socket.on('gameEnd', (data) => {
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
    }
}

function leaveGame() {
    currentGame = null;
    currentRoom = null;
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('lobby').classList.add('active');
    
    location.reload();
}

function updatePokerRoom(room) {
    if (!room) return;
    
    // Update pot
    document.getElementById('pot').textContent = `$${room.pot}`;
    
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

// Window event handlers
window.onclick = function(event) {
    const modal = document.getElementById('buyChipsModal');
    if (event.target === modal) {
        closeBuyChipsModal();
    }
}
