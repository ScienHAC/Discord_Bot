const { Client, GatewayIntentBits } = require('discord.js');
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

    // Schedule the check every 1 minute (for testing purposes, 1 min = 60,000 milliseconds)
    setInterval(checkOldMessages, 60 * 1000); // 1 minute interval for testing
});

// Function to check and delete old messages
const checkOldMessages = async () => {
    const channelIds = ['1286709388077436950', '1286916622270861426']; // Replace with your channel IDs

    // Fetch messages in each channel and delete old ones
    const channelChecks = channelIds.map(async (channelId) => {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await deleteOldMessages(channel);
        } else {
            console.error(`Channel not found: ${channelId}`);
        }
    });

    // Await all channel checks to complete
    await Promise.all(channelChecks);
};

// Function to delete messages older than 1 minute (for testing)
const deleteOldMessages = async (channel) => {
    const messages = await channel.messages.fetch({ limit: 100 });
    const now = Date.now();
    const oneMinuteInMs = 1 * 60 * 1000; // 1 minute in milliseconds
    let deletedMessageCount = 0;

    const deletePromises = messages.map(message => {
        const messageAge = now - message.createdTimestamp;
        if (messageAge > oneMinuteInMs) {
            return message.delete()
                .then(() => deletedMessageCount++)
                .catch(console.error);
        }
    });

    // Wait for all delete promises to finish
    await Promise.all(deletePromises);

    // Notify the channel based on whether old messages were deleted
    if (deletedMessageCount > 0) {
        channel.send(`🧹 I have deleted ${deletedMessageCount} messages older than 1 minute.`);
    } else {
        channel.send("🔍 No messages older than 1 minute were found to delete.");
    }
};

// Error handling
client.on('error', console.error);
