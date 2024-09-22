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

// State to track if we're in active deletion mode
let isActiveDeletion = true;

// Ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Start the initial check for old messages
    checkOldMessages();
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

            // If we deleted messages, send a notification
            if (deletedCount > 0) {
                console.log(`Total messages deleted: ${deletedCount}`);
                await channel.send(`🧹 I have deleted ${deletedCount} messages older than 3 months.`);
            } else {
                console.log('No more old messages found. Sending notification.');
                await channel.send("🔍 No messages older than 3 months were found.");
            }
        } else {
            console.error(`Channel not found: ${channelId}`);
        }
    }

    // If no messages were deleted in any channel, switch to daily scan mode
    if (totalDeleted === 0) {
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
*/

const { Client, GatewayIntentBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

// Initialize Discord bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize SQLite Database
const db = new sqlite3.Database('./channels.db');

// Create table to store channels if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS channels (guildId TEXT, channelId TEXT)`);

// Login to Discord using your bot token
client.login(process.env.DISCORD_TOKEN);

// Ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Add a channel to be monitored for deletion in a specific server (guild)
const addChannel = (guildId, channelId) => {
    db.run(`INSERT INTO channels (guildId, channelId) VALUES (?, ?)`, [guildId, channelId], function(err) {
        if (err) {
            return console.error('Error adding channel:', err.message);
        }
        console.log(`Channel ${channelId} added for guild ${guildId}.`);
    });
};

// Remove a channel from the list for a specific server (guild)
const removeChannel = (guildId, channelId) => {
    db.run(`DELETE FROM channels WHERE guildId = ? AND channelId = ?`, [guildId, channelId], function(err) {
        if (err) {
            return console.error('Error removing channel:', err.message);
        }
        console.log(`Channel ${channelId} removed from guild ${guildId}.`);
    });
};

// Fetch all channels for a specific guild
const getChannelsForGuild = (guildId) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT channelId FROM channels WHERE guildId = ?`, [guildId], (err, rows) => {
            if (err) {
                reject('Error fetching channels:', err.message);
            } else {
                resolve(rows.map(row => row.channelId));
            }
        });
    });
};

// Slash command: /add-gravbits to add a channel for deletion
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, guildId, channelId } = interaction;

    if (commandName === 'add-gravbits') {
        addChannel(guildId, channelId);
        await interaction.reply(`Channel ${channelId} has been added for message deletion.`);
    } else if (commandName === 'remove-gravbits') {
        removeChannel(guildId, channelId);
        await interaction.reply(`Channel ${channelId} has been removed from the deletion list.`);
    }
});

// Function to check and delete old messages in all stored channels
const checkOldMessages = async () => {
    const now = Date.now();
    const threeMonthsInMs = 3 * 30 * 24 * 60 * 60 * 1000; // 3 months in milliseconds

    db.each(`SELECT DISTINCT guildId, channelId FROM channels`, async (err, row) => {
        if (err) {
            return console.error('Error fetching channel data:', err.message);
        }

        const channel = await client.channels.fetch(row.channelId).catch(console.error);
        if (!channel) {
            console.error(`Channel not found: ${row.channelId}`);
            return;
        }

        let deletedMessageCount = 0;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(console.error);

        if (messages.size === 0) return;

        const deletePromises = messages.map(async (message) => {
            const messageAge = now - message.createdTimestamp;
            if (messageAge > threeMonthsInMs) {
                await message.delete();
                deletedMessageCount++;
            }
        });

        await Promise.all(deletePromises);
        console.log(`Deleted ${deletedMessageCount} messages in channel: ${row.channelId}.`);

        if (deletedMessageCount > 0) {
            await channel.send(`🧹 I have deleted ${deletedMessageCount} messages older than 3 months.`);
        } else {
            await channel.send(`🔍 No messages older than 3 months were found.`);
        }
    });
};

// Schedule the check to run once per day
setInterval(checkOldMessages, 24 * 60 * 60 * 1000); // 1 day interval

// Error handling
client.on('error', console.error);
