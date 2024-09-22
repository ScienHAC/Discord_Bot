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

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const clientId = process.env.Client_Id; // Replace with your bot's client ID
const guildId = process.env.Guild_Id; // Replace with your server's (guild's) ID

const commands = [
    {
        name: 'add-gravbits',
        description: 'Add this channel for message deletion.',
    },
    {
        name: 'remove-gravbits',
        description: 'Remove this channel from the deletion list.',
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


const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const clientId = process.env.Client_Id; // Replace with your bot's client ID
const guildId = process.env.Guild_Id; // Replace with your server's (guild's) ID

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
        description: 'Manually trigger a check for old messages. Optionally specify in hours.',
        options: [
            {
                name: 'hours',
                type: 4, // INTEGER
                description: 'Number of hours after which to check for deletion. Defaults to 24 hours.',
                required: false
            }
        ]
    },
    {
        name: 'deltime-gravbits',
        description: 'Set the message deletion time limit in hours. Default is 3 months (2160 hours).',
        options: [
            {
                name: 'hours',
                type: 4, // INTEGER
                description: 'Number of hours to keep messages before deletion.',
                required: true
            }
        ]
    },
    {
        name: 'status',
        description: 'Get the current deletion settings and added channels.'
    }
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



const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
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
db.run(`CREATE TABLE IF NOT EXISTS channels (guildId TEXT, channelId TEXT, delInterval INTEGER DEFAULT 24, delAge INTEGER DEFAULT 2160)`);

// Login to Discord using your bot token
client.login(process.env.DISCORD_TOKEN);

// Ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Add a channel for deletion
const addChannel = (guildId, channelId, delInterval = 24, delAge = 2160) => {
    db.run(`INSERT INTO channels (guildId, channelId, delInterval, delAge) VALUES (?, ?, ?, ?)`, [guildId, channelId, delInterval, delAge], function(err) {
        if (err) {
            return console.error('Error adding channel:', err.message);
        }
        console.log(`Channel ${channelId} added for guild ${guildId} with interval ${delInterval} hours and delAge ${delAge} hours.`);
    });
};

// Fetch all channels for a specific guild
const getChannelsForGuild = (guildId) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT channelId, delInterval, delAge FROM channels WHERE guildId = ?`, [guildId], (err, rows) => {
            if (err) {
                reject('Error fetching channels:', err.message);
            } else {
                resolve(rows);
            }
        });
    });
};

// Slash command: Add gravbits to add a channel for deletion
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, guildId, channelId, user } = interaction;
    const memberRoles = interaction.member.roles.cache;

    if (!memberRoles.some(role => role.name === 'bot_cmd')) {
        return await interaction.reply('You do not have permission to use this command.');
    }

    if (commandName === 'add-gravbits') {
        addChannel(guildId, channelId);
        await interaction.reply(`Channel ${channelId} has been added for message deletion.`);
    } else if (commandName === 'check-gravbits') {
        const hours = interaction.options.getInteger('hours') || 24;
        addChannel(guildId, channelId, hours);
        await interaction.reply(`Check interval set to ${hours} hours for this channel.`);
    } else if (commandName === 'deltime-gravbits') {
        const delAge = interaction.options.getInteger('hours') || 2160;
        addChannel(guildId, channelId, 24, delAge);
        await interaction.reply(`Deletion threshold set to ${delAge} hours for this channel.`);
    } else if (commandName === 'status') {
        const channels = await getChannelsForGuild(guildId);
        const status = channels.map(row => `Channel: <#${row.channelId}>, Check Interval: ${row.delInterval}h, Delete messages older than: ${row.delAge}h`).join('\n');
        await interaction.reply(`**Current Settings:**\n${status}`);
    }
});

// Function to check and delete old messages in all stored channels
const checkOldMessages = async () => {
    const now = Date.now();

    db.each(`SELECT DISTINCT guildId, channelId, delAge FROM channels`, async (err, row) => {
        if (err) {
            return console.error('Error fetching channel data:', err.message);
        }

        const channel = await client.channels.fetch(row.channelId).catch(console.error);
        if (!channel) {
            console.error(`Channel not found: ${row.channelId}`);
            return;
        }

        let deletedMessageCount = 0;
        const delAgeInMs = row.delAge * 60 * 60 * 1000;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(console.error);

        if (messages.size === 0) {
            await channel.send(`🔍 No messages older than ${row.delAge} hours were found.`);
            return;
        }

        const deletePromises = messages.map(async (message) => {
            const messageAge = now - message.createdTimestamp;
            if (messageAge > delAgeInMs) {
                await message.delete();
                deletedMessageCount++;
            }
        });

        await Promise.all(deletePromises);

        if (deletedMessageCount > 0) {
            await channel.send(`🧹 I have deleted ${deletedMessageCount} messages older than ${row.delAge} hours.`);
        }
    });
};

// Schedule the check to run based on channel-specific intervals
setInterval(checkOldMessages, 24 * 60 * 60 * 1000); // Default 1 day interval

// Error handling
client.on('error', console.error);
*/


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
