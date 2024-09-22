const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, GatewayIntentBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const clientId = process.env.Client_Id; // Replace with your bot's client ID
const commands = [
    { name: 'add-gravbits', description: 'Add this channel for message deletion.' },
    { name: 'remove-gravbits', description: 'Remove this channel from the deletion list.' },
    { name: 'check-gravbits', description: 'Set the interval for message deletion (hours).', options: [{ name: 'interval', type: 4, description: 'Interval in hours (e.g., 24 for 1 day)', required: false }] },
    { name: 'deltime-gravbits', description: 'Set the time for messages to be deleted (older than N hours).', options: [{ name: 'delete_age', type: 4, description: 'Delete messages older than N hours', required: false }] },
    { name: 'delete-gravbits', description: 'Delete the last 10 messages from the current channel.' },
    { name: 'status', description: 'Show the current settings for all added channels' },
];

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

// Initialize Discord bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Initialize SQLite Database
const db = new sqlite3.Database('./channels.db', (err) => {
    if (err) console.error('Error opening database:', err.message);
});

// Create table to store channels if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS channels (guildId TEXT, channelId TEXT, checkInterval INTEGER, deleteTime INTEGER)`);

// Function to register commands for a specific guild
const registerCommandsForGuild = async (guildId) => {
    try {
        console.log(`Started refreshing application (/) commands for guild: ${guildId}`);
        
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log('Successfully reloaded application (/) commands for guild:', guildId);
    } catch (error) {
        console.error('Error registering commands:', error);
    }
};

// Listen for when the bot joins a new guild
client.on('guildCreate', async (guild) => {
    console.log(`Joined a new guild: ${guild.name} (ID: ${guild.id})`);
    db.run(`INSERT OR IGNORE INTO channels (guildId) VALUES (?)`, [guild.id], function(err) {
        if (err) {
            console.error('Error adding new guild:', err.message);
        } else {
            console.log(`Added new guild to database: ${guild.id}`);
            await registerCommandsForGuild(guild.id); // Register commands for the new guild
        }
    });
});

// Login to Discord using your bot token
client.login(process.env.DISCORD_TOKEN);

// Ready event
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Register commands for each guild the bot is in
    const guilds = await client.guilds.fetch();
    guilds.forEach(guild => {
        registerCommandsForGuild(guild.id);
    });
});

// Helper functions (upsertChannel, removeChannel, getChannelsForGuild, fetchChannelName) remain unchanged...

// Slash command: Handle interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const guildId = interaction.guildId; // Automatically detects the guild ID
    const { commandName, channelId } = interaction;
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

// Function to check and delete old messages in all stored channels remains unchanged...

// Error handling
client.on('error', console.error);
