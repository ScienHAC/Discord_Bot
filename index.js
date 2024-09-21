/*const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Login to Discord using your bot token
client.login(process.env.DISCORD_TOKEN);

// Ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Run the check immediately
    checkOldMessages();

    // Schedule the check every 5 days (5 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
    setInterval(checkOldMessages, 5 * 24 * 60 * 60 * 1000);
});

// Function to check and delete old messages
async function checkOldMessages() {
    const channelIds = ['1286709388077436950', '1286916622270861426'];// Replace with your channel IDs

    for (const channelId of channelIds) {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await deleteOldMessages(channel);
        } else {
            console.error(`Channel not found: ${channelId}`);
        }
    }
}

// Function to delete old messages
async function deleteOldMessages(channel) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const now = Date.now();
    const sixMonthsInMs = 180 * 24 * 60 * 60 * 1000;
    let deletedMessageCount = 0;

    messages.forEach(message => {
        const messageAge = now - message.createdTimestamp;
        if (messageAge > sixMonthsInMs) {
            message.delete().then(() => {
                deletedMessageCount++;
            }).catch(console.error);
        }
    });

    // Notify the channel based on whether old messages were deleted
    if (deletedMessageCount > 0) {
        channel.send(`🧹 I have deleted ${deletedMessageCount} messages older than 6 months.`);
    } else {
        channel.send("🔍 No messages older than 6 months were found to delete.");
    }
}

// Error handling
client.on('error', console.error);
*/



require('dotenv').config(); // This line ensures local .env use, but not needed on Railway
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log('Bot is online!');
});

client.login(process.env.DISCORD_TOKEN);

// console.log(process.env.DISCORD_TOKEN);

