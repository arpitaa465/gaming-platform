const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/gamingDB');

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    role: String
});

const User = mongoose.model('User', userSchema);

async function fixRoles() {
    try {
        // Make arpita admin
        await User.findByIdAndUpdate('69d6885298fbf08d0cdc3f82', { role: 'admin' });
        console.log(' arpita is now ADMIN!');
        
        // Update all users without role to player
        const result = await User.updateMany({ role: { $exists: false } }, { role: 'player' });
        console.log(` Updated ${result.modifiedCount} users to player role`);
        
        // Show all users with roles
        const users = await User.find();
        console.log('\n📋 All Users with Roles:\n');
        users.forEach(u => {
            console.log(`   ${u.username} - Role: ${u.role || 'NO ROLE!'}`);
        });
        
    } catch (error) {
        console.log('Error:', error);
    }
    
    mongoose.disconnect();
}

fixRoles();