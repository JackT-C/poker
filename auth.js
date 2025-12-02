const bcrypt = require('bcryptjs');

// In-memory user database (in production, use a real database)
const users = new Map();

// User model
class User {
    constructor(username, hashedPassword) {
        this.username = username;
        this.password = hashedPassword;
        this.chips = 1000;
        this.createdAt = new Date();
        this.lastLogin = new Date();
    }
}

// Register new user
function registerUser(username, password) {
    if (users.has(username.toLowerCase())) {
        return { success: false, message: 'Username already exists' };
    }
    
    if (username.length < 3) {
        return { success: false, message: 'Username must be at least 3 characters' };
    }
    
    if (password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters' };
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = new User(username, hashedPassword);
    users.set(username.toLowerCase(), user);
    
    return { success: true, message: 'Registration successful', user: { username: user.username, chips: user.chips } };
}

// Login user
function loginUser(username, password) {
    const user = users.get(username.toLowerCase());
    
    if (!user) {
        return { success: false, message: 'Invalid username or password' };
    }
    
    const passwordMatch = bcrypt.compareSync(password, user.password);
    
    if (!passwordMatch) {
        return { success: false, message: 'Invalid username or password' };
    }
    
    user.lastLogin = new Date();
    return { success: true, message: 'Login successful', user: { username: user.username, chips: user.chips } };
}

// Update user chips
function updateUserChips(username, chips) {
    const user = users.get(username.toLowerCase());
    if (user) {
        user.chips = chips;
        return true;
    }
    return false;
}

// Get user
function getUser(username) {
    const user = users.get(username.toLowerCase());
    if (user) {
        return { username: user.username, chips: user.chips };
    }
    return null;
}

module.exports = {
    registerUser,
    loginUser,
    updateUserChips,
    getUser
};
