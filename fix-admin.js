const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/gamingDB');

const userSchema = new mongoose.Schema({
    username: String,
    role: String
});

const User = mongoose.model('User', userSchema);

async function fix() {
    try {
        // Make pam admin
        await User.updateOne({ username: 'pam' }, { role: 'admin' });
        console.log('pam is now ADMIN');
        
        // Give default role to users without role
        await User.updateMany({ role: { $exists: false } }, { role: 'player' });
        console.log('Users without role set to player');
        
        // Verify
        const users = await User.find();
        console.log('\n📋 Updated Users:');
        users.forEach(u => {
            console.log(`   ${u.username} - Role: ${u.role || 'NO ROLE!'}`);
        });
        
    } catch (error) {
        console.log('Error:', error);
    }
    
    mongoose.disconnect();
}

fix();