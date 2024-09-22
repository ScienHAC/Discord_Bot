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



const { Client, GatewayIntentBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
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
db.run(`CREATE TABLE IF NOT EXISTS channels (
    guildId TEXT,
    channelId TEXT,
    checkInterval INTEGER DEFAULT 24,
    deleteTime INTEGER DEFAULT 2160,
    UNIQUE(channelId)
)`);

// Login to Discord using your bot token
client.login(process.env.DISCORD_TOKEN);

// Ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Command Registration
const clientId = process.env.Client_Id; // Replace with your bot's client ID
const guildId = process.env.Guild_Id; // Replace with your server's (guild's) ID

const commands = [
    {
        name: 'add-gravbits',
        description: 'Add this channel for message deletion.'
    },
    {
        name: 'remove-gravbits',
        description: 'Remove this channel from the deletion list.'
    },
    {
        name: 'check-gravbits',
        description: 'Set the interval (in hours) for checking old messages.',
        options: [
            {
                name: 'hours',
                type: 'INTEGER',
                description: 'Interval in hours (default: 24)',
                required: false
            }
        ]
    },
    {
        name: 'deltime-gravbits',
        description: 'Set how old messages must be to delete (in hours, default: 2160 = 3 months).',
        options: [
            {
                name: 'hours',
                type: 'INTEGER',
                description: 'Delete messages older than this time (in hours)',
                required: false
            }
        ]
    },
    {
        name: 'status',
        description: 'Show the current deletion settings for each channel.'
    }
];

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// Command Logic: Add, Remove, Check, Deltime, and Status
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, guildId, channelId, options } = interaction;

    // Function to add or update a channel's settings in the database
    const addOrUpdateChannel = (guildId, channelId, checkInterval = 24, deleteTime = 2160) => {
        db.run(`
            INSERT INTO channels (guildId, channelId, checkInterval, deleteTime)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(channelId) DO UPDATE SET checkInterval = excluded.checkInterval, deleteTime = excluded.deleteTime;
        `, [guildId, channelId, checkInterval, deleteTime], function (err) {
            if (err) {
                return console.error('Error adding/updating channel:', err.message);
            }
            console.log(`Channel ${channelId} added/updated for guild ${guildId}.`);
        });
    };

    // Function to remove a channel from the database
    const removeChannel = (guildId, channelId) => {
        db.run(`DELETE FROM channels WHERE guildId = ? AND channelId = ?`, [guildId, channelId], function (err) {
            if (err) {
                return console.error('Error removing channel:', err.message);
            }
            console.log(`Channel ${channelId} removed from guild ${guildId}.`);
        });
    };

    if (commandName === 'add-gravbits') {
        addOrUpdateChannel(guildId, channelId);
        await interaction.reply(`Channel ${channelId} has been added for message deletion.`);
    } else if (commandName === 'remove-gravbits') {
        removeChannel(guildId, channelId);
        await interaction.reply(`Channel ${channelId} has been removed from the deletion list.`);
    } else if (commandName === 'check-gravbits') {
        const hours = options.getInteger('hours') || 24;
        addOrUpdateChannel(guildId, channelId, hours);
        await interaction.reply(`Check interval for channel ${channelId} has been set to ${hours} hours.`);
    } else if (commandName === 'deltime-gravbits') {
        const hours = options.getInteger('hours') || 2160;
        addOrUpdateChannel(guildId, channelId, undefined, hours);
        await interaction.reply(`Messages older than ${hours} hours will be deleted in channel ${channelId}.`);
    } else if (commandName === 'status') {
        db.all(`SELECT channelId, checkInterval, deleteTime FROM channels WHERE guildId = ?`, [guildId], (err, rows) => {
            if (err) {
                console.error('Error fetching status:', err.message);
                return interaction.reply('An error occurred while fetching the status.');
            }

            if (rows.length === 0) {
                return interaction.reply('No channels have been added for message deletion.');
            }

            let statusMessage = 'Current Settings:\n';

            rows.forEach(row => {
                const channel = client.channels.cache.get(row.channelId);
                if (channel) {
                    statusMessage += `Channel: ${channel.name}, Check Interval: ${row.checkInterval}h, Delete messages older than: ${row.deleteTime}h\n`;
                }
            });

            interaction.reply(statusMessage);
        });
    }
});

// Function to check and delete old messages in all stored channels
const checkOldMessages = async () => {
    const now = Date.now();

    db.each(`SELECT DISTINCT guildId, channelId, deleteTime FROM channels`, async (err, row) => {
        if (err) {
            return console.error('Error fetching channel data:', err.message);
        }

        const channel = await client.channels.fetch(row.channelId).catch(console.error);
        if (!channel) {
            console.error(`Channel not found: ${row.channelId}`);
            return;
        }

        const deleteTimeInMs = row.deleteTime * 60 * 60 * 1000; // Convert hours to milliseconds
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
        console.log(`Deleted ${deletedMessageCount} messages in channel: ${row.channelId}.`);

        if (deletedMessageCount > 0) {
            await channel.send(`🧹 I have deleted ${deletedMessageCount} messages older than ${row.deleteTime} hours.`);
        } else {
            await channel.send(`🔍 No messages older than ${row.deleteTime} hours were found.`);
        }
    });
};

// Schedule the check to run once per day (default 24 hours)
setInterval(checkOldMessages, 24 * 60 * 60 * 1000); // 1 day interval

// Error handling
client.on('error', console.error);
*/



const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, GatewayIntentBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const clientId = process.env.Client_Id; // Replace with your bot's client ID
//const guildId = process.env.Guild_Id; // Replace with your server's (guild's) ID
const guildId = '773810493717479434';
const commands = [
    {
        name: 'add-gravbits',
        description: 'Add this channel for message deletion.',
    },
    {
        name: 'remove-gravbits',
        description: 'Remove this channel from the deletion list.',
    },
    {
        name: 'check-gravbits',
        description: 'Set the interval for message deletion (hours).',
        options: [
            {
                name: 'interval',
                type: 4, // INTEGER
                description: 'Interval in hours (e.g., 24 for 1 day)',
                required: false,
            },
        ],
    },
    {
        name: 'deltime-gravbits',
        description: 'Set the time for messages to be deleted (older than N hours).',
        options: [
            {
                name: 'delete_age',
                type: 4, // INTEGER
                description: 'Delete messages older than N hours',
                required: false,
            },
        ],
    },
    {
        name: 'delete-gravbits',
        description: 'Delete the last 10 messages from the current channel.',
    },
    {
        name: 'status',
        description: 'Show the current settings for all added channels',
    },
];

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: commands,
        });

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// Initialize Discord bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Initialize SQLite Database
const db = new sqlite3.Database('./channels.db');

// Create table to store channels if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS channels (guildId TEXT, channelId TEXT, checkInterval INTEGER, deleteTime INTEGER)`);

// Login to Discord using your bot token
client.login(process.env.DISCORD_TOKEN);

// Ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Helper function to add/update channel settings
const upsertChannel = (guildId, channelId, checkInterval, deleteTime) => {
    db.run(
        `INSERT OR REPLACE INTO channels (guildId, channelId, checkInterval, deleteTime) VALUES (?, ?, ?, ?)`,
        [guildId, channelId, checkInterval, deleteTime],
        function (err) {
            if (err) {
                console.error('Error adding/updating channel:', err.message);
            } else {
                console.log(`Channel ${channelId} added/updated for guild ${guildId}.`);
            }
        }
    );
};

// Helper function to remove channel settings
const removeChannel = (guildId, channelId) => {
    db.run(`DELETE FROM channels WHERE guildId = ? AND channelId = ?`, [guildId, channelId], function (err) {
        if (err) {
            console.error('Error removing channel:', err.message);
        } else {
            console.log(`Channel ${channelId} removed from guild ${guildId}.`);
        }
    });
};

// Helper function to fetch all channels and their settings
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
    const channel = await client.channels.fetch(channelId);
    return channel ? channel.name : 'Unknown Channel';
};

// Slash command: Handle interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, guildId, channelId } = interaction;
    let checkInterval = 24; // Default check interval in hours (1 day)
    let deleteTime = 2160; // Default delete time in hours (3 months)

    if (commandName === 'add-gravbits') {
        upsertChannel(guildId, channelId, checkInterval, deleteTime);
        await interaction.reply(`Channel ${await fetchChannelName(channelId)} has been added for message deletion.`);
    } else if (commandName === 'remove-gravbits') {
        removeChannel(guildId, channelId);
        await interaction.reply(`Channel ${await fetchChannelName(channelId)} has been removed from the deletion list.`);
    } else if (commandName === 'check-gravbits') {
        checkInterval = interaction.options.getInteger('interval') || 24; // Use provided interval or default
        upsertChannel(guildId, channelId, checkInterval, deleteTime);
        await interaction.reply(`Check interval for channel ${await fetchChannelName(channelId)} has been set to ${checkInterval} hours.`);
    } else if (commandName === 'deltime-gravbits') {
        deleteTime = interaction.options.getInteger('delete_age') || 2160; // Use provided delete time or default
        upsertChannel(guildId, channelId, checkInterval, deleteTime);
        await interaction.reply(`Messages older than ${deleteTime} hours will be deleted in channel ${await fetchChannelName(channelId)}.`);
    } else if (commandName === 'delete-gravbits') {
        const messages = await interaction.channel.messages.fetch({ limit: 10 });
        const deletePromises = messages.map(msg => msg.delete());

        await Promise.all(deletePromises);
        await interaction.reply(`Deleted the last 10 messages in this channel.`);
    } else if (commandName === 'status') {
        const channels = await getChannelsForGuild(guildId);
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

    db.each(`SELECT DISTINCT guildId, channelId, checkInterval, deleteTime FROM channels`, async (err, row) => {
        if (err) {
            console.error('Error fetching channel data:', err.message);
            return;
        }

        const deleteTimeInMs = row.deleteTime * 60 * 60 * 1000; // Convert hours to milliseconds
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
    });
};

// Schedule the check to run once per day
setInterval(checkOldMessages, 24 * 60 * 60 * 1000); // 1 day interval

// Error handling
client.on('error', console.error);

