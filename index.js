const { Client: PgClient } = require('pg');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const clientId = process.env.Client_Id; // Bot's client ID
const pgClient = new PgClient({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // Required if Railway enforces SSL
    },
});

// Connect to PostgreSQL
pgClient.connect().then(() => console.log('Connected to PostgreSQL')).catch(console.error);

const commands = [
    { name: 'add-gravbits', description: 'Add this channel for message deletion.' },
    { name: 'remove-gravbits', description: 'Remove this channel from the deletion list.' },
    {
        name: 'check-gravbits',
        description: 'Set the interval for message deletion (hours).',
        options: [{ name: 'interval', type: 4, description: 'Interval in hours', required: false }],
    },
    {
        name: 'deltime-gravbits',
        description: 'Set the time for messages to be deleted (older than N hours).',
        options: [{ name: 'delete_age', type: 4, description: 'Delete messages older than N hours', required: false }],
    },
    { name: 'delete-gravbits', description: 'Delete the last 10 messages from the current channel.' },
    { name: 'status', description: 'Show the current settings for all added channels' },
];

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

// Register commands
const registerCommandsForGuild = async (guildId) => {
    try {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log(`Registered commands for guild: ${guildId}`);
    } catch (error) {
        console.error(error);
    }
};

// Initialize Discord client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Listen for new guilds and add them to PostgreSQL
client.on('guildCreate', (guild) => {
    const query = `INSERT INTO channels (guildId) VALUES ($1) ON CONFLICT DO NOTHING`;
    pgClient.query(query, [guild.id], (err) => {
        if (err) {
            console.error('Error adding guild:', err.message);
        } else {
            registerCommandsForGuild(guild.id);
            console.log(`Added guild to database: ${guild.id}`);
        }
    });
});

// Helper to insert or update channel settings
const upsertChannel = async (guildId, channelId, checkInterval, deleteTime) => {
    const query = `
        INSERT INTO channels (guildId, channelId, checkInterval, deleteTime)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guildId, channelId) DO UPDATE SET
        checkInterval = EXCLUDED.checkInterval,
        deleteTime = EXCLUDED.deleteTime
    `;
    try {
        await pgClient.query(query, [guildId, channelId, checkInterval, deleteTime]);
        console.log(`Channel ${channelId} added/updated for guild ${guildId}.`);
    } catch (err) {
        console.error('Error upserting channel:', err.message);
    }
};

// Remove a channel from PostgreSQL
const removeChannel = async (guildId, channelId) => {
    const query = `DELETE FROM channels WHERE guildId = $1 AND channelId = $2`;
    try {
        await pgClient.query(query, [guildId, channelId]);
        console.log(`Channel ${channelId} removed from guild ${guildId}.`);
    } catch (err) {
        console.error('Error removing channel:', err.message);
    }
};

// Fetch all channels for a guild
const getChannelsForGuild = async (guildId) => {
    const query = `SELECT channelId, checkInterval, deleteTime FROM channels WHERE guildId = $1`;
    try {
        const res = await pgClient.query(query, [guildId]);
        return res.rows;
    } catch (err) {
        console.error('Error fetching channels:', err.message);
    }
    return [];
};

// Fetch channel name
const fetchChannelName = async (channelId) => {
    const channel = await client.channels.fetch(channelId);
    return channel ? channel.name : 'Unknown Channel';
};

// Handle interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const guildId = interaction.guildId;
    const { commandName, channelId } = interaction;
    let checkInterval = 24;
    let deleteTime = 2160;

    if (commandName === 'add-gravbits') {
        await upsertChannel(guildId, channelId, checkInterval, deleteTime);
        await interaction.reply(`Channel ${await fetchChannelName(channelId)} added for deletion.`);
    } else if (commandName === 'remove-gravbits') {
        await removeChannel(guildId, channelId);
        await interaction.reply(`Channel ${await fetchChannelName(channelId)} removed.`);
    } else if (commandName === 'check-gravbits') {
        checkInterval = interaction.options.getInteger('interval') || checkInterval;
        await upsertChannel(guildId, channelId, checkInterval, deleteTime);
        await interaction.reply(`Check interval set to ${checkInterval} hours.`);
    } else if (commandName === 'deltime-gravbits') {
        deleteTime = interaction.options.getInteger('delete_age') || deleteTime;
        await upsertChannel(guildId, channelId, checkInterval, deleteTime);
        await interaction.reply(`Messages older than ${deleteTime} hours will be deleted.`);
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

// Function to check and delete old messages
const checkOldMessages = async () => {
    const now = Date.now();
    const query = `SELECT guildId, channelId, checkInterval, deleteTime FROM channels`;
    const res = await pgClient.query(query);

    res.rows.forEach(async (row) => {
        const deleteTimeInMs = row.deleteTime * 60 * 60 * 1000;
        const channel = await client.channels.fetch(row.channelId).catch(console.error);
        if (!channel) return;

        let deletedCount = 0;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(console.error);

        const deletePromises = messages.map((msg) => {
            if (now - msg.createdTimestamp > deleteTimeInMs) {
                return msg.delete().then(() => deletedCount++);
            }
        });

        await Promise.all(deletePromises);

        if (deletedCount > 0) {
            channel.send(`Deleted ${deletedCount} messages older than ${row.deleteTime} hours.`);
        } else {
            channel.send(`No messages older than ${row.deleteTime} hours found.`);
        }
    });
};

// Run message deletion once per day
setInterval(checkOldMessages, 24 * 60 * 60 * 1000);

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);
