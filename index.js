const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, GatewayIntentBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const clientId = process.env.Client_Id;
const commands = [
    // Commands remain the same
];

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

// Initialize SQLite Database
const db = new sqlite3.Database('./channels.db');

// Function to create the `channels` table if it doesn't exist
const createTable = () => {
    db.run(`CREATE TABLE IF NOT EXISTS channels (
        guildId TEXT,
        channelId TEXT,
        checkInterval INTEGER,
        deleteTime INTEGER,
        PRIMARY KEY (guildId, channelId)
    );`, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Table created or already exists.');
        }
    });
};

// Initialize Discord bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Function to upsert (insert or update) channel settings
const upsertChannel = (guildId, channelId, checkInterval, deleteTime) => {
    const query = `
        INSERT INTO channels (guildId, channelId, checkInterval, deleteTime)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(guildId, channelId) 
        DO UPDATE SET checkInterval = excluded.checkInterval, deleteTime = excluded.deleteTime;
    `;

    db.run(query, [guildId, channelId, checkInterval, deleteTime], function (err) {
        if (err) {
            console.error('Error upserting channel:', err.message);
        } else {
            console.log(`Channel ${channelId} added/updated for guild ${guildId}.`);
        }
    });
};

// Function to fetch all channels and their settings for a guild
const getChannelsForGuild = (guildId) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT channelId, checkInterval, deleteTime FROM channels WHERE guildId = ?`, [guildId], (err, rows) => {
            if (err) {
                reject('Error fetching channels:', err.message);
            } else {
                resolve(rows);
            }
        });
    });
};

// Helper function to fetch a channel name
const fetchChannelName = async (channelId) => {
    try {
        const channel = await client.channels.fetch(channelId);
        return channel ? channel.name : 'Unknown Channel';
    } catch (error) {
        console.error(`Error fetching channel name for ${channelId}:`, error);
        return 'Unknown Channel';
    }
};

// Slash command: Handle interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const guildId = interaction.guildId;
    const { commandName, channelId } = interaction;
    let checkInterval = 24; // Default check interval in hours (1 day)
    let deleteTime = 2160; // Default delete time in hours (3 months)

    if (commandName === 'add-gravbits') {
        await upsertChannel(guildId, channelId, checkInterval, deleteTime);
        await interaction.reply(`Channel ${await fetchChannelName(channelId)} has been added for message deletion.`);
    } else if (commandName === 'status') {
        const channels = await getChannelsForGuild(guildId);
        if (channels.length === 0) {
            await interaction.reply('No channels found for this guild.');
            return;
        }

        let statusMessage = 'Current Settings:\n';
        for (const row of channels) {
            const channelName = await fetchChannelName(row.channelId);
            statusMessage += `Channel: ${channelName}, Check Interval: ${row.checkInterval}h, Delete messages older than: ${row.deleteTime}h\n`;
        }

        await interaction.reply(statusMessage);
    }
});

// Function to check and delete old messages in all stored channels
const checkOldMessages = async () => {
    const now = Date.now();

    db.all(`SELECT DISTINCT guildId, channelId, checkInterval, deleteTime FROM channels`, async (err, rows) => {
        if (err) {
            console.error('Error fetching channel data:', err.message);
            return;
        }

        for (const row of rows) {
            const deleteTimeInMs = row.deleteTime * 60 * 60 * 1000; // Convert hours to milliseconds
            const channel = await client.channels.fetch(row.channelId).catch(console.error);
            if (!channel) {
                console.error(`Channel not found: ${row.channelId}`);
                continue;
            }

            let deletedMessageCount = 0;
            const messages = await channel.messages.fetch({ limit: 100 }).catch(console.error);

            if (messages.size === 0) return;

            const deletePromises = messages.map(async (message) => {
                const messageAge = now - message.createdTimestamp;
                if (messageAge > deleteTimeInMs) {
                    await message.delete();
                    deletedMessageCount++;
                }
            });

            await Promise.all(deletePromises);

            if (deletedMessageCount > 0) {
                await channel.send(`🧹 I have deleted ${deletedMessageCount} messages older than ${row.deleteTime} hours.`);
            } else {
                await channel.send(`🔍 No messages older than ${row.deleteTime} hours were found.`);
            }
        }
    });
};

// Schedule the check to run once per day
setInterval(checkOldMessages, 24 * 60 * 60 * 1000); // 1 day interval

// Create the table at the start if it doesn't exist
createTable();

// Login to Discord bot
client.login(process.env.DISCORD_TOKEN);

// Listen for when the bot joins a new guild
client.on('guildCreate', (guild) => {
    console.log(`Joined a new guild: ${guild.name} (ID: ${guild.id})`);
    createTable(); // Ensure the table exists when joining a new guild
    // Register commands for the new guild if needed
});
