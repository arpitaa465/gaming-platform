const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/gamingDB');

const gameSchema = new mongoose.Schema({
    title: String,
    genre: String,
    plays: Number
});

const Game = mongoose.model('Game', gameSchema);

async function addGames() {
    try {
        await Game.insertMany([
            { title: "Space Shooter", genre: "Arcade", plays: 0 },
            { title: "Racing Fury", genre: "Racing", plays: 0 },
            { title: "Puzzle Master", genre: "Puzzle", plays: 0 },
            { title: "Battle Arena", genre: "Action", plays: 0 },
            { title: "Sports Champion", genre: "Sports", plays: 0 }
        ]);
        console.log("5 Games added successfully!");
        mongoose.disconnect();
    } catch (error) {
        console.log("Error:", error);
    }
}

addGames();