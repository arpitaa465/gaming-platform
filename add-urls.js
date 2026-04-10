const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/gamingDB');

const gameSchema = new mongoose.Schema({
    title: String,
    gameUrl: String
});

const Game = mongoose.model('Game', gameSchema);

const gameUrls = {
    "Space Shooter": "https://www.crazygames.com/game/space-shooter",
    "Racing Fury": "https://www.crazygames.com/game/racing-fury",
    "Puzzle Master": "https://www.crazygames.com/game/puzzle-master",
    "Battle Arena": "https://www.crazygames.com/game/battle-arena",
    "Sports Champion": "https://www.crazygames.com/game/sports-champions",
    "Cyber Warrior": "https://www.crazygames.com/game/cyber-warrior",
    "Magic Quest": "https://www.crazygames.com/game/magic-quest",
    "Speed Demon": "https://www.crazygames.com/game/speed-demon",
    "Zombie Survival": "https://www.crazygames.com/game/zombie-survival",
    "Chess Master": "https://www.crazygames.com/game/chess",
    "Portal": "https://www.crazygames.com/game/portal-the-flash-version",
    "Run 3": "https://www.coolmathgames.com/0-run-3",
    "Shell Shockers": "https://shellshock.io",
    "Slope": "https://www.crazygames.com/game/slope",
    "Paper.io 2": "https://paper-io.com"
};

async function addUrls() {
    console.log('Starting to add URLs...');
    
    for (const [title, url] of Object.entries(gameUrls)) {
        const result = await Game.updateOne(
            { title: title }, 
            { $set: { gameUrl: url } }
        );
        if (result.modifiedCount > 0) {
            console.log(` Updated: ${title}`);
        } else {
            console.log(` Game not found: ${title}`);
        }
    }
        mongoose.disconnect();
}

addUrls();