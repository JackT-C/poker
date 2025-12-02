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
    displayPlayerHand(data.hand);
});

socket.on('gameStart', (data) => {
    updatePokerRoom(data.room);
    showMessage('Game started! Good luck!', 'success');
});

socket.on('gameUpdate', (data) => {
    updatePokerRoom(data.room);
});

socket.on('roundAdvance', (data) => {
    updatePokerRoom(data.room);
    displayCommunityCards(data.room.communityCards);
});

socket.on('gameEnd', (data) => {
    showMessage(`${data.winner} wins the pot of $${data.pot}!`, 'success');
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

socket.on('gameReset', (data) => {
    if (currentGame === 'poker') {
        updatePokerRoom(data.room);
        document.getElementById('playerHand').innerHTML = '';
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

function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
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

// Window event handlers
window.onclick = function(event) {
    const modal = document.getElementById('buyChipsModal');
    if (event.target === modal) {
        closeBuyChipsModal();
    }
}
