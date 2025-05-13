const express = require("express");
const { Client: PgClient } = require("pg");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { Client: DiscordClient, GatewayIntentBits, Collection } = require("discord.js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL client setup
const pgClient = new PgClient({
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    ssl: {
        rejectUnauthorized: false,
    },
});

// Connect to PostgreSQL and ensure table exists
pgClient.connect()
    .then(() => {
        console.log("Connected to PostgreSQL");
        return pgClient.query(`
            CREATE TABLE IF NOT EXISTS gravbits_channels (
                guild_id VARCHAR(255),
                channel_id VARCHAR(255),
                interval INT DEFAULT 1,
                delete_age INT DEFAULT 1,
                PRIMARY KEY (guild_id, channel_id)
            );
        `);
    })
    .then(() => console.log("Table gravbits_channels is ready"))
    .catch(err => console.error("PostgreSQL connection error:", err));

// Discord bot setup
const discordBot = new DiscordClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const rest = new REST({ version: "9" }).setToken(process.env.DISCORD_TOKEN);
const commands = [
    {
        name: "add-gravbits",
        description: "Add this channel for message deletion.",
    },
    {
        name: "remove-gravbits",
        description: "Remove this channel from the deletion list.",
    },
    {
        name: "check-gravbits",
        description: "Set the interval for message deletion (hours).",
        options: [
            {
                name: "interval",
                type: 4,
                description: "Interval in hours",
                required: false,
            },
        ],
    },
    {
        name: "deltime-gravbits",
        description: "Set the time for messages to be deleted (older than N hours).",
        options: [
            {
                name: "delete_age",
                type: 4,
                description: "Delete messages older than N hours",
                required: false,
            },
        ],
    },
    {
        name: "delete-gravbits",
        description: "Delete a specific number of messages from the current channel.",
        options: [
            {
                name: "count",
                type: 4,
                description: "Number of messages to delete",
                required: false,
            },
        ],
    },
    {
        name: "scan",
        description: "Show all channels being monitored in this guild.",
    },
];

// Store registered guilds to prevent duplicate registrations
const registeredGuilds = new Set();

// Register commands for a guild
const registerCommandsForGuild = async (guildId) => {
    // Skip if we've already registered commands for this guild
    if (registeredGuilds.has(guildId)) {
        console.log(`Commands already registered for guild: ${guildId}`);
        return;
    }

    try {
        console.log(`Registering commands for guild: ${guildId}`);
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commands });
        console.log(`Commands registered successfully for guild: ${guildId}`);

        // Mark this guild as registered
        registeredGuilds.add(guildId);
    } catch (error) {
        console.error(`Error registering commands for guild ${guildId}:`, error);
    }
};

// Track active intervals
const activeIntervals = new Map();

// Function to set up message deletion interval for a channel
async function setupChannelInterval(guildId, channelId, intervalHours, deleteAgeHours) {
    // Clear any existing interval for this channel
    if (activeIntervals.has(channelId)) {
        clearInterval(activeIntervals.get(channelId));
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;

    const intervalId = setInterval(async () => {
        try {
            await deleteOldMessages(channelId, deleteAgeHours);
        } catch (error) {
            console.error(`Error in deletion interval for channel ${channelId}:`, error);
        }
    }, intervalMs);

    activeIntervals.set(channelId, intervalId);
    console.log(`Set up interval for channel ${channelId}: check every ${intervalHours} hours, delete after ${deleteAgeHours} hours`);
}

// Function to delete old messages
async function deleteOldMessages(channelId, deleteAgeHours) {
    try {
        const channel = await discordBot.channels.fetch(channelId);
        if (!channel) {
            console.log(`Channel ${channelId} not found.`);
            return;
        }

        const now = Date.now();
        const deleteBeforeTimestamp = now - (deleteAgeHours * 60 * 60 * 1000);
        console.log(`Deleting messages in ${channel.name} older than ${new Date(deleteBeforeTimestamp).toLocaleString()}`);

        // Fetch messages in batches
        let deletedCount = 0;
        let lastId = null;
        let batch;

        do {
            const options = { limit: 100 };
            if (lastId) options.before = lastId;

            batch = await channel.messages.fetch(options);

            if (batch.size === 0) break;

            const messagesToDelete = batch.filter(msg => msg.createdTimestamp < deleteBeforeTimestamp);
            lastId = batch.lastKey();

            if (messagesToDelete.size > 0) {
                // Try bulk delete for messages less than 14 days old
                const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);

                const recentMessages = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
                const oldMessages = messagesToDelete.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

                if (recentMessages.size > 0) {
                    await channel.bulkDelete(recentMessages);
                    deletedCount += recentMessages.size;
                }

                // Delete older messages one by one
                for (const message of oldMessages.values()) {
                    await message.delete();
                    deletedCount++;

                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } while (batch.size >= 100);

        if (deletedCount > 0) {
            console.log(`Deleted ${deletedCount} messages from channel ${channel.name}`);
            await channel.send(`Deleted ${deletedCount} messages older than ${deleteAgeHours} hours.`)
                .then(msg => {
                    // Delete the notification after 5 seconds
                    setTimeout(() => msg.delete().catch(() => { }), 5000);
                });
        }
    } catch (error) {
        console.error(`Error deleting messages in channel ${channelId}:`, error);
    }
}

// Function to initialize all channel intervals from the database
async function setupAllIntervals() {
    try {
        // Clear all existing intervals first
        activeIntervals.forEach(intervalId => clearInterval(intervalId));
        activeIntervals.clear();

        // Get settings from database
        const result = await pgClient.query(`
            SELECT guild_id, channel_id, interval, delete_age 
            FROM gravbits_channels
        `);

        // Setup each channel's interval
        for (const row of result.rows) {
            await setupChannelInterval(
                row.guild_id,
                row.channel_id,
                row.interval,
                row.delete_age
            );
        }

        console.log(`Set up intervals for ${result.rows.length} channels`);
    } catch (error) {
        console.error("Error setting up intervals:", error);
    }
}

// Helper functions for database operations
async function addOrUpdateChannel(guildId, channelId, intervalHours = 1, deleteAgeHours = 1) {
    try {
        await pgClient.query(`
            INSERT INTO gravbits_channels (guild_id, channel_id, interval, delete_age)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (guild_id, channel_id) DO UPDATE
            SET interval = $3, delete_age = $4
        `, [guildId, channelId, intervalHours, deleteAgeHours]);

        // Update the interval for this channel
        await setupChannelInterval(guildId, channelId, intervalHours, deleteAgeHours);

        console.log(`Channel ${channelId} added/updated for guild ${guildId}`);
        return true;
    } catch (error) {
        console.error("Error adding/updating channel:", error);
        return false;
    }
}

async function removeChannel(guildId, channelId) {
    try {
        await pgClient.query(`
            DELETE FROM gravbits_channels
            WHERE guild_id = $1 AND channel_id = $2
        `, [guildId, channelId]);

        // Clear the interval for this channel
        if (activeIntervals.has(channelId)) {
            clearInterval(activeIntervals.get(channelId));
            activeIntervals.delete(channelId);
        }

        console.log(`Channel ${channelId} removed from guild ${guildId}`);
        return true;
    } catch (error) {
        console.error("Error removing channel:", error);
        return false;
    }
}

async function updateInterval(guildId, channelId, newInterval) {
    try {
        const result = await pgClient.query(`
            UPDATE gravbits_channels
            SET interval = $3
            WHERE guild_id = $1 AND channel_id = $2
            RETURNING delete_age
        `, [guildId, channelId, newInterval]);

        if (result.rows.length === 0) {
            return false;
        }

        // Update the interval for this channel
        const deleteAge = result.rows[0].delete_age;
        await setupChannelInterval(guildId, channelId, newInterval, deleteAge);

        console.log(`Updated interval for channel ${channelId} to ${newInterval} hours`);
        return true;
    } catch (error) {
        console.error("Error updating interval:", error);
        return false;
    }
}

async function updateDeleteAge(guildId, channelId, newDeleteAge) {
    try {
        const result = await pgClient.query(`
            UPDATE gravbits_channels
            SET delete_age = $3
            WHERE guild_id = $1 AND channel_id = $2
            RETURNING interval
        `, [guildId, channelId, newDeleteAge]);

        if (result.rows.length === 0) {
            return false;
        }

        // Update the interval for this channel
        const interval = result.rows[0].interval;
        await setupChannelInterval(guildId, channelId, interval, newDeleteAge);

        console.log(`Updated delete age for channel ${channelId} to ${newDeleteAge} hours`);
        return true;
    } catch (error) {
        console.error("Error updating delete age:", error);
        return false;
    }
}

async function listChannels(guildId) {
    try {
        const result = await pgClient.query(`
            SELECT channel_id, interval, delete_age 
            FROM gravbits_channels
            WHERE guild_id = $1
        `, [guildId]);

        return result.rows;
    } catch (error) {
        console.error("Error listing channels:", error);
        return [];
    }
}

// Check if user has the bot_cmd role
const hasBotCmdRole = (member) => {
    return member.roles.cache.some(role => role.name === 'bot_cmd');
};

// Discord bot event handlers
discordBot.on("ready", async () => {
    console.log(`Logged in as ${discordBot.user.tag}`);

    // Register commands for all guilds
    discordBot.guilds.cache.forEach(guild => {
        registerCommandsForGuild(guild.id);
    });

    // Set up deletion intervals
    await setupAllIntervals();
});

discordBot.on("guildCreate", async (guild) => {
    console.log(`Bot joined a new guild: ${guild.name}`);
    await registerCommandsForGuild(guild.id);
});

discordBot.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, member, guild } = interaction;
    const guildId = guild.id;
    const channelId = interaction.channel.id;

    // Check for the bot_cmd role
    if (!hasBotCmdRole(member)) {
        await interaction.reply({
            content: "You don't have permission to use this command. You need the 'bot_cmd' role.",
            ephemeral: true
        });
        return;
    }

    // Defer the reply to prevent "This interaction failed" errors
    await interaction.deferReply();

    try {
        switch (commandName) {
            case "add-gravbits": {
                const success = await addOrUpdateChannel(guildId, channelId);
                if (success) {
                    await interaction.editReply(`Channel **${interaction.channel.name}** added for monitoring. Messages will be checked every 1 hour and deleted if older than 1 hour.`);
                } else {
                    await interaction.editReply("Failed to add channel. Please try again.");
                }
                break;
            }

            case "remove-gravbits": {
                const success = await removeChannel(guildId, channelId);
                if (success) {
                    await interaction.editReply(`Channel **${interaction.channel.name}** removed from monitoring.`);
                } else {
                    await interaction.editReply("Failed to remove channel. Please try again.");
                }
                break;
            }

            case "check-gravbits": {
                const newInterval = interaction.options.getInteger("interval") || 1;
                if (newInterval < 1) {
                    await interaction.editReply("Interval must be at least 1 hour.");
                    return;
                }

                const success = await updateInterval(guildId, channelId, newInterval);
                if (success) {
                    await interaction.editReply(`Scan interval updated to ${newInterval} hour(s) for channel **${interaction.channel.name}**.`);
                } else {
                    await interaction.editReply("Failed to update interval. Make sure this channel is being monitored first with /add-gravbits.");
                }
                break;
            }

            case "deltime-gravbits": {
                const newDeleteAge = interaction.options.getInteger("delete_age") || 1;
                if (newDeleteAge < 1) {
                    await interaction.editReply("Delete age must be at least 1 hour.");
                    return;
                }

                const success = await updateDeleteAge(guildId, channelId, newDeleteAge);
                if (success) {
                    await interaction.editReply(`Delete age updated to ${newDeleteAge} hour(s) for channel **${interaction.channel.name}**.`);
                } else {
                    await interaction.editReply("Failed to update delete age. Make sure this channel is being monitored first with /add-gravbits.");
                }
                break;
            }

            case "delete-gravbits": {
                const messageCount = interaction.options.getInteger("count") || 100;
                if (messageCount < 1 || messageCount > 100) {
                    await interaction.editReply("Count must be between 1 and 100.");
                    return;
                }

                const channel = interaction.channel;

                try {
                    // Get messages to delete
                    const fetchedMessages = await channel.messages.fetch({ limit: messageCount });

                    if (fetchedMessages.size === 0) {
                        await interaction.editReply("No messages found to delete.");
                        return;
                    }

                    // Separate messages by age (Discord API limitation)
                    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
                    const recentMessages = fetchedMessages.filter(msg => msg.createdTimestamp > twoWeeksAgo);
                    const oldMessages = fetchedMessages.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

                    let deletedCount = 0;

                    // Bulk delete recent messages
                    if (recentMessages.size > 0) {
                        await channel.bulkDelete(recentMessages);
                        deletedCount += recentMessages.size;
                    }

                    // Delete old messages one by one
                    for (const message of oldMessages.values()) {
                        await message.delete();
                        deletedCount++;

                        // Add a small delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                    await interaction.editReply(`Successfully deleted ${deletedCount} message(s).`);
                } catch (error) {
                    console.error("Error deleting messages:", error);
                    await interaction.editReply("Failed to delete messages. I might be missing permissions or the messages are too old.");
                }
                break;
            }

            case "scan": {
                const channels = await listChannels(guildId);

                if (channels.length === 0) {
                    await interaction.editReply("No channels are currently being monitored in this server.");
                    return;
                }

                const channelList = await Promise.all(channels.map(async row => {
                    try {
                        const channel = await guild.channels.fetch(row.channel_id);
                        return `• #${channel.name}: Checked every ${row.interval} hour(s), deleting messages older than ${row.delete_age} hour(s)`;
                    } catch {
                        return `• Channel ID ${row.channel_id} (not found)`;
                    }
                }));

                await interaction.editReply(`**Monitored Channels in ${guild.name}:**\n${channelList.join('\n')}`);
                break;
            }
        }
    } catch (error) {
        console.error(`Error handling command ${commandName}:`, error);
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply("An error occurred while processing your command. Please try again.");
        }
    }
});

// Express routes
app.get("/", (req, res) => {
    res.send('Hello, the bot is running and ready to serve your commands!');
});

app.get("/status", (req, res) => {
    res.send({
        status: "OK",
        bot: discordBot.user?.tag || "Disconnected",
        monitoredChannels: activeIntervals.size
    });
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // Login to Discord
    discordBot.login(process.env.DISCORD_TOKEN)
        .catch(error => console.error("Failed to login to Discord:", error));
});

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});
