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

// State to track if we're in active deletion mode
let isActiveDeletion = true;

// Ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Start in active deletion mode
    checkOldMessages();

    // Schedule the check every 1 minute initially
    setInterval(() => {
        if (isActiveDeletion) {
            checkOldMessages();
        }
    }, 60 * 1000); // 1 minute interval
});

// Function to check and delete old messages
const checkOldMessages = async () => {
    const channelIds = ['1286709388077436950', '1286916622270861426']; // Replace with your channel IDs

    let totalDeleted = 0; // Count total messages deleted

    for (const channelId of channelIds) {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            const deletedCount = await deleteOldMessages(channel);
            totalDeleted += deletedCount;
        } else {
            console.error(`Channel not found: ${channelId}`);
        }
    }

    // If we deleted messages, remain in active deletion mode; otherwise, switch to daily scan
    if (totalDeleted > 0) {
        console.log(`Total messages deleted: ${totalDeleted}`);
        channel.send(`🧹 I have deleted ${totalDeleted} messages older than 3 months.`);
    } else {
        console.log('No more old messages found. Switching to daily scan mode.');
        
        isActiveDeletion = false;

        // Switch to daily scan mode
        setInterval(checkOldMessages, 24 * 60 * 60 * 1000); // 1 day interval
    }
};

// Function to delete messages older than 3 months
const deleteOldMessages = async (channel) => {
    const now = Date.now();
    const threeMonthsInMs = 3 * 30 * 24 * 60 * 60 * 1000; // 3 months in milliseconds
    let deletedMessageCount = 0;

    // Fetch 100 messages at a time
    const messages = await channel.messages.fetch({ limit: 100 });

    // If no more messages are found, return
    if (messages.size === 0) return 0;

    // Filter and delete messages older than 3 months
    const deletePromises = messages.map(async (message) => {
        const messageAge = now - message.createdTimestamp;
        if (messageAge > threeMonthsInMs) {
            await message.delete(); // Await the delete operation
            deletedMessageCount++;
        }
    });

    // Wait for all delete promises to finish
    await Promise.all(deletePromises);

    console.log(`Deleted ${deletedMessageCount} messages in channel: ${channel.id}.`);

    return deletedMessageCount; // Return the count of deleted messages
};

// Error handling
client.on('error', console.error);
