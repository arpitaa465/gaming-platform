const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Cookie Session
app.use(session({
    secret: 'gaming-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// MongoDB Connection
mongoose.connect('mongodb+srv://arpita:<db_password>@cluster0.sv40ki4.mongodb.net/?appName=Cluster0')
    .then(() => console.log(' MongoDB Connected'))
    .catch(err => console.log(' MongoDB Error:', err));

   // ========== SCHEMAS ==========
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    totalScore: { type: Number, default: 0 },
    role: { type: String, enum: ['player', 'reviewer', 'organiser', 'admin'], default: 'player' },
    resetToken: String,
    resetTokenExpiry: Date,
    lastPlayed: { type: Date, default: null },  // ← ADD THIS
    createdAt: { type: Date, default: Date.now }
});

const gameSchema = new mongoose.Schema({
    title: String,
    genre: String,
    imageUrl: String,
    plays: { type: Number, default: 0 },
    gameUrl: { type: String, default: "" }  
});

const scoreSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    gameId: mongoose.Schema.Types.ObjectId,
    score: Number,
    date: { type: Date, default: Date.now }
});

const reviewSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    gameId: mongoose.Schema.Types.ObjectId,
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: { type: Date, default: Date.now }
});

const tournamentSchema = new mongoose.Schema({
    name: String,
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
    startDate: Date,
    endDate: Date,
    prizePool: String,
    description: String,
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'upcoming' },
    createdAt: { type: Date, default: Date.now }
});

// ========== MODELS ==========
const User = mongoose.model('User', userSchema);
const Game = mongoose.model('Game', gameSchema);
const Score = mongoose.model('Score', scoreSchema);
const Review = mongoose.model('Review', reviewSchema);
const Tournament = mongoose.model('Tournament', tournamentSchema);

// ========== AUTH ROUTES ==========
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;  
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields required' });
        }
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const userCount = await User.countDocuments();
       
        const userRole = userCount === 0 ? 'admin' : (role || 'player');
        
        const user = new User({ username, email, password: hashedPassword, role: userRole });
        await user.save();
        
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.role = user.role;
        
        res.json({ success: true, username: user.username, role: user.role });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt for email:', email);
        
        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('User found:', user.username, 'Role in DB:', user.role);
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            console.log('Invalid password');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
      
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.role = user.role;
        
        console.log('Session set with role:', req.session.role);
        
        res.json({ success: true, username: user.username, role: user.role });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/check-session', (req, res) => {
    console.log('Check session - Role in session:', req.session.role);
    
    if (req.session.userId) {
        res.json({ 
            loggedIn: true, 
            username: req.session.username, 
            role: req.session.role,
            userId: req.session.userId 
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// ========== GAME API ROUTES ==========
app.get('/api/games', async (req, res) => {
    const games = await Game.find();
    res.json(games);
});

app.post('/api/score', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Login required' });
    }
    const { gameId, score } = req.body;
    const newScore = new Score({ userId: req.session.userId, gameId, score, date: new Date() });
    await newScore.save();
    await User.findByIdAndUpdate(req.session.userId, { 
        $inc: { totalScore: score },
        lastPlayed: new Date()  
    });
    await Game.findByIdAndUpdate(gameId, { $inc: { plays: 1 } });
    res.json({ success: true });
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        // Get top 10 users by score
        const leaders = await User.find()
            .select('username totalScore')
            .sort('-totalScore')
            .limit(10);
        
        // For each user, get the games they played
        const leaderboardWithGames = [];
        
        for (const user of leaders) {
            // Find all scores by this user
            const scores = await Score.find({ userId: user._id });
            
            // Get unique game titles by fetching each game
            const uniqueGameTitles = [];
            for (const score of scores) {
                const game = await Game.findById(score.gameId);
                if (game && game.title && !uniqueGameTitles.includes(game.title)) {
                    uniqueGameTitles.push(game.title);
                }
            }
            
            const gamesPlayed = uniqueGameTitles.slice(0, 3);
            
            leaderboardWithGames.push({
                username: user.username,
                totalScore: user.totalScore,
                gamesPlayed: gamesPlayed.length > 0 ? gamesPlayed : ['No games yet']
            });
        }
        
        res.json(leaderboardWithGames);
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ========== REVIEW API ROUTES ==========
app.post('/api/reviews', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Login required' });
        }
        const { gameId, rating, comment } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be 1-5' });
        }
        if (!comment || comment.length < 2) {
            return res.status(400).json({ error: 'Comment too short' });
        }
        const review = new Review({ userId: req.session.userId, gameId, rating, comment });
        await review.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/reviews/:gameId', async (req, res) => {
    try {
        const reviews = await Review.find({ gameId: req.params.gameId }).populate('userId', 'username').sort({ createdAt: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== TOURNAMENT API ROUTES ==========
app.get('/api/tournaments', async (req, res) => {
    try {
        const tournaments = await Tournament.find().populate('gameId', 'title').populate('participants', 'username').populate('winner', 'username').sort({ createdAt: -1 });
        res.json(tournaments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tournaments/create', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Login required' });
        }
        const { name, gameId, startDate, endDate, prizePool, description } = req.body;
        if (!name || !gameId || !startDate || !endDate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const tournament = new Tournament({
            name, gameId, startDate: new Date(startDate), endDate: new Date(endDate),
            prizePool, description, participants: [req.session.userId]
        });
        await tournament.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tournaments/join', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Login required' });
        }
        const { tournamentId } = req.body;
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }
        if (tournament.participants.includes(req.session.userId)) {
            return res.status(400).json({ error: 'Already registered' });
        }
        tournament.participants.push(req.session.userId);
        await tournament.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ADMIN ROUTES ==========
function isAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Login required' });
    }
    User.findById(req.session.userId).then(user => {
        if (user && user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    });
}

app.get('/api/admin/stats', isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalGames = await Game.countDocuments();
        const totalScores = await Score.countDocuments();
        const totalTournaments = await Tournament.countDocuments();
        res.json({ totalUsers, totalGames, totalScores, totalTournaments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/api/user/profile', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
    
    try {
        const user = await User.findById(req.session.userId).select('-password');
        
        // Get scores and manually populate game titles
        const scores = await Score.find({ userId: req.session.userId }).sort('-date').limit(10);
        
        // Get game titles for each score
        const userScores = [];
        for (const score of scores) {
            const game = await Game.findById(score.gameId);
            userScores.push({
                score: score.score,
                date: score.date,
                gameId: {
                    title: game ? game.title : 'Unknown Game'
                }
            });
        }
        
        // Send user data including lastPlayed
        res.json({ 
            user: {
                username: user.username,
                email: user.email,
                role: user.role,
                totalScore: user.totalScore,
                lastPlayed: user.lastPlayed || null
            }, 
            userScores 
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user/reviews', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
    
    try {
        const reviews = await Review.find({ userId: req.session.userId }).sort('-createdAt');
        
        // Get game titles for each review
        const reviewsWithGames = [];
        for (const review of reviews) {
            const game = await Game.findById(review.gameId);
            reviewsWithGames.push({
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt,
                gameId: {
                    title: game ? game.title : 'Unknown Game'
                }
            });
        }
        
        res.json(reviewsWithGames);
    } catch (error) {
        console.error('Reviews error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/add-game', isAdmin, async (req, res) => {
    try {
        const { title, genre, imageUrl, description } = req.body;
        const game = new Game({ title, genre, imageUrl, description });
        await game.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== FORGOT PASSWORD ROUTES ==========
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, error: 'Email not found' });
    
    // Generate reset token (simple for demo)
    const resetToken = Math.random().toString(36).substring(2, 15);
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // In production, send email. For demo, return token
    res.json({ success: true, message: `Reset token: ${resetToken}` });
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
    if (!user) return res.json({ success: false, error: 'Invalid or expired token' });
    
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();
    res.json({ success: true });
});

// ========== AI RECOMMENDATIONS ROUTE ==========
app.get('/api/recommendations', async (req, res) => {
    try {
        if (!req.session.userId) {
            // Not logged in - show popular games
            const popularGames = await Game.find().sort('-plays').limit(6);
            return res.json(popularGames);
        }
        
        // Get user's played games
        const userScores = await Score.find({ userId: req.session.userId });
        const playedGameIds = userScores.map(s => s.gameId.toString());
        
        if (playedGameIds.length === 0) {
            // User hasn't played any games - show popular games
            const popularGames = await Game.find().sort('-plays').limit(6);
            return res.json(popularGames);
        }
        
        // Get user's favorite genres
        const playedGames = await Game.find({ _id: { $in: playedGameIds } });
        const favoriteGenres = [...new Set(playedGames.map(g => g.genre).filter(g => g))];
        
        // Find unplayed games with matching genres
        let recommendations = [];
        if (favoriteGenres.length > 0) {
            recommendations = await Game.find({
                _id: { $nin: playedGameIds },
                genre: { $in: favoriteGenres }
            }).limit(6);
        }
        
        // If not enough, add popular unplayed games
        if (recommendations.length < 6) {
            const moreGames = await Game.find({
                _id: { $nin: playedGameIds.concat(recommendations.map(r => r._id)) }
            }).sort('-plays').limit(6 - recommendations.length);
            recommendations = [...recommendations, ...moreGames];
        }
        
        res.json(recommendations);
    } catch (error) {
        console.error('Recommendation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

app.delete('/api/admin/delete-game', isAdmin, async (req, res) => {
    try {
        const { gameId } = req.body;
        await Game.findByIdAndDelete(gameId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/edit-game', isAdmin, async (req, res) => {
    try {
        const { gameId, title } = req.body;
        await Game.findByIdAndUpdate(gameId, { title });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/change-role', isAdmin, async (req, res) => {
    try {
        const { userId, role } = req.body;
        await User.findByIdAndUpdate(userId, { role });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/delete-user', isAdmin, async (req, res) => {
    try {
        const { userId } = req.body;
        await User.findByIdAndDelete(userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== HTML ROUTES ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/games', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'games.html'));
});

app.get('/game-reviews', (req, res) => {
    console.log(' Reviews route was called!');
    res.sendFile(path.join(__dirname, 'public', 'reviews.html'));
});

app.get('/game-tournaments', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tournaments.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/cookie-info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cookie-info.html'));
});

// ========== START SERVER ==========
const PORT = 3000;
app.listen(PORT, () => {
    console.log(` Server running at http://localhost:${PORT}`);
});