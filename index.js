// const { Client } = require("pg");
// const { REST } = require("@discordjs/rest");
// const { Routes } = require("discord-api-types/v9");
// const { Client: DiscordClient, GatewayIntentBits } = require("discord.js");
// require("dotenv").config();

// const clientId = process.env.Client_Id;

// // Use environment variables for PostgreSQL connection
// const pgClient = new Client({
//     host: process.env.PGHOST,
//     database: process.env.PGDATABASE,
//     user: process.env.PGUSER,
//     password: process.env.PGPASSWORD,
//     port: process.env.PGPORT,
// });

// // Connect to PostgreSQL and create table if it doesn't exist
// pgClient
//     .connect()
//     .then(() => {
//         console.log("Connected to PostgreSQL");
//         return pgClient.query(`
//       CREATE TABLE IF NOT EXISTS gravbits_channels (
//         guild_id VARCHAR(255),
//         channel_id VARCHAR(255),
//         interval INT DEFAULT 1,
//         delete_age INT DEFAULT 1,
//         PRIMARY KEY (guild_id, channel_id)
//       );
//     `);
//     })
//     .then(() => console.log("Table gravbits_channels is ready"))
//     .catch((err) => console.error("Connection error", err.stack));

// // Command registration
// const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);
// const commands = [
//     {
//         name: "add-gravbits",
//         description: "Add this channel for message deletion.",
//     },
//     {
//         name: "remove-gravbits",
//         description: "Remove this channel from the deletion list.",
//     },
//     {
//         name: "check-gravbits",
//         description: "Set the interval for message deletion (hours).",
//         options: [
//             {
//                 name: "interval",
//                 type: 4,
//                 description: "Interval in hours",
//                 required: false,
//             },
//         ],
//     },
//     {
//         name: "deltime-gravbits",
//         description: "Set the time for messages to be deleted (older than N hours).",
//         options: [
//             {
//                 name: "delete_age",
//                 type: 4,
//                 description: "Delete messages older than N hours",
//                 required: false,
//             },
//         ],
//     },
//     {
//         name: "delete-gravbits",
//         description: "Delete a specific number of messages from the current channel.",
//         options: [
//             {
//                 name: "count",
//                 type: 4,
//                 description: "Number of messages to delete",
//                 required: false,
//             },
//         ],
//     },
//     {
//         name: "scan",
//         description: "Show all channels being monitored in this guild.",
//     },
// ];

// // Function to register commands for a specific guild
// const registerCommandsForGuild = async (guildId) => {
//     try {
//         console.log(`Started refreshing application (/) commands for guild: ${guildId}`);
//         await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
//         console.log('Successfully reloaded application (/) commands.');
//     } catch (error) {
//         console.error('Error registering commands:', error);
//     }
// };

// // Initialize Discord bot
// const bot = new DiscordClient({
//     intents: [
//         GatewayIntentBits.Guilds,
//         GatewayIntentBits.GuildMessages,
//         GatewayIntentBits.MessageContent,
//     ],
// });

// // Register commands when the bot is ready
// bot.on("ready", async () => {
//     console.log(`Logged in as ${bot.user.tag}`);
//     const guilds = bot.guilds.cache.map(guild => guild.id);
//     for (const guildId of guilds) {
//         await registerCommandsForGuild(guildId);
//     }

//     // Start the periodic scanning for messages
//     //setInterval(scanAndDeleteMessages, 60000); // Run every minute
// });

// // Check if user has the bot_cmd role
// const hasBotCmdRole = (member) => {
//     return member.roles.cache.some(role => role.name === 'bot_cmd');
// };

// // Handle commands
// bot.on("interactionCreate", async (interaction) => {
//     if (!interaction.isCommand()) return;

//     const { commandName, member } = interaction;

//     if (!hasBotCmdRole(member)) {
//         await interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
//         return;
//     }

//     const guildId = interaction.guild.id;
//     const channelId = interaction.channel.id;

//     switch (commandName) {
//         case "add-gravbits":
//             await addOrUpdateChannel(guildId, channelId);
//             await interaction.reply(`Channel added for monitoring: scanning every 1 hours.`);
//             await setupIntervals();
//             break;

//         case "check-gravbits":
//             const newInterval = interaction.options.getInteger("interval") || 1;
//             await handleCheckGravbits(guildId, channelId, newInterval);
//             await interaction.reply(`Scan interval updated to ${newInterval} hours.`);
//             await setupIntervals();
//             break;

//         case "deltime-gravbits":
//             const newDeleteAge = interaction.options.getInteger("delete_age") || 1;
//             await handleDeleteAge(guildId, channelId, newDeleteAge);
//             await interaction.reply(`Delete age updated to ${newDeleteAge} hours.`);
//             await setupIntervals();
//             break;

//         case "delete-gravbits":
//             const messageCount = interaction.options.getInteger("count") || 10;
//             await handleDeleteGravbits(interaction, guildId, channelId, messageCount); // Pass interaction
//             break;

//         case "remove-gravbits":
//             await handleRemoveGravbits(guildId, channelId);
//             await interaction.reply(`Channel removed from monitoring.`);
//             break;

//         case "scan":
//             await handleScan(interaction, guildId);
//             break; // Handle scan reply inside the function
//     }
// });

// // Function to add or update a channel for scanning
// async function addOrUpdateChannel(guildId, channelId) {
//     try {
//         await pgClient.query(`
//       INSERT INTO gravbits_channels (guild_id, channel_id, interval, delete_age)
//       VALUES ($1, $2, 1, 1)
//       ON CONFLICT (guild_id, channel_id) DO UPDATE
//       SET interval = 1, delete_age = 1
//     `, [guildId, channelId]);
//         console.log(`Channel ${channelId} in guild ${guildId} added/updated for scanning.`);
//     } catch (error) {
//         console.error('Error adding/updating channel:', error);
//     }
// }

// async function handleDeleteAge(guildId, channelId, newDeleteAge) {
//     try {
//         await pgClient.query(`
//       UPDATE gravbits_channels
//       SET delete_age = $3
//       WHERE guild_id = $1 AND channel_id = $2
//     `, [guildId, channelId, newDeleteAge]);
//         console.log(`Updated delete age for channel ${channelId} in guild ${guildId} to ${newDeleteAge} hours.`);
//     } catch (error) {
//         console.error('Error updating delete age:', error);
//     }
// }
// // Function to handle /deltime-gravbits command
// async function handleCheckGravbits(guildId, channelId, newInterval) {
//     try {
//         await pgClient.query(`
//       UPDATE gravbits_channels
//       SET interval = $3
//       WHERE guild_id = $1 AND channel_id = $2
//     `, [guildId, channelId, newInterval]);
//         console.log(`Updated scan interval for channel ${channelId} in guild ${guildId} to ${newInterval} hours.`);
//     } catch (error) {
//         console.error('Error updating interval:', error);
//     }
// }

// //function delete message 
// async function handleDeleteGravbits(interaction, guildId, channelId, messageCount) {
//     const channel = bot.channels.cache.get(channelId);
//     if (!channel) {
//         console.log(`Channel with ID ${channelId} not found!`);
//         await interaction.reply("Channel not found!");
//         return;
//     }

//     try {
//         // Fetch messages (default to 100 if messageCount is not provided)
//         const fetchedMessages = await channel.messages.fetch({ limit: messageCount || 100 });

//         if (fetchedMessages.size === 0) {
//             console.log("No messages found to delete.");
//             await interaction.reply("No messages found to delete.");
//             return;
//         }

//         // Now delete all messages, including bot's own messages
//         await channel.bulkDelete(fetchedMessages, true);
//         console.log(`Deleted ${fetchedMessages.size} messages in ${channel.name}`);

//         // Optional: Send a message to the channel after deletion
//         await interaction.reply(`Deleted ${fetchedMessages.size} messages.`);
//     } catch (error) {
//         console.error(`Error deleting messages in ${channelId}:`, error);
//         await interaction.reply("There was an error trying to delete messages.");
//     }
// }




// // Function to handle /scan command
// async function handleScan(interaction, guildId) {
//     try {
//         const result = await pgClient.query(`
//       SELECT channel_id, interval, delete_age FROM gravbits_channels
//       WHERE guild_id = $1
//     `, [guildId]);

//         const channelList = await Promise.all(result.rows.map(async (row) => {
//             const channel = bot.channels.cache.get(row.channel_id);
//             return channel ? `${channel.name}: Interval - ${row.interval} hour, Delete Age - ${row.delete_age} hour` : `Channel ID ${row.channel_id} not found.`;
//         }));

//         const responseMessage = channelList.length > 0 ? channelList.join("\n") : "No channels monitored in this guild.";
//         console.log(`Channels monitored in guild ${guildId}:`, channelList);

//         // Send response back to the user
//         await interaction.reply(responseMessage);
//     } catch (error) {
//         console.error('Error fetching channels:', error);
//     }
// }


// // Function to handle /remove-gravbits command
// async function handleRemoveGravbits(guildId, channelId) {
//     try {
//         await pgClient.query(`
//       DELETE FROM gravbits_channels
//       WHERE guild_id = $1 AND channel_id = $2
//     `, [guildId, channelId]);
//         console.log(`Channel ${channelId} removed from monitoring in guild ${guildId}.`);
//     } catch (error) {
//         console.error('Error removing channel:', error);
//     }
// }

// // Function to periodically scan and delete messages
// async function scanAndDeleteMessages() {
//     try {
//         const result = await pgClient.query(`
//       SELECT channel_id, delete_age FROM gravbits_channels
//     `);
//         const currentTime = Date.now();

//         for (const row of result.rows) {
//             const channel = bot.channels.cache.get(row.channel_id);
//             if (!channel || channel.type !== 'GUILD_TEXT') continue; // Ensure it's a text channel

//             const deleteAgeInMillis = row.delete_age * 60 * 60 * 1000; // Convert hours to milliseconds
//             const messages = await channel.messages.fetch({ limit: 100 });

//             const messagesToDelete = messages.filter(msg => (currentTime - msg.createdTimestamp) > deleteAgeInMillis);
//             if (messagesToDelete.size > 0) {
//                 await channel.bulkDelete(messagesToDelete, true);
//                 console.log(`Deleted ${messagesToDelete.size} messages in channel ${row.channel_id}.`);
//             }
//         }
//     } catch (error) {
//         console.error('Error during periodic scanning and deletion:', error);
//     }
// }

// // New added code 
// // Function to get channel intervals and delete_age from the database
// async function fetchChannelSettings() {
//     const query = `SELECT guild_id, channel_id, interval, delete_age FROM gravbits_channels`;
//     const res = await pgClient.query(query);
//     return res.rows;
// }

// // Function to delete old messages
// async function deleteOldMessages(channelId, deleteAgehours) {
//     const channel = await bot.channels.fetch(channelId);
//     const now = Date.now();
//     const deleteBefore = now - deleteAgehours * 60 * 60 * 1000;

//     let deletedCount = 0;

//     try {
//         // Fetch messages from the channel
//         const messages = await channel.messages.fetch({ limit: 100 });
//         messages.forEach(async (message) => {
//             if (message.createdTimestamp < deleteBefore) {
//                 await message.delete();
//                 deletedCount++;
//             }
//         });

//         // Log how many messages were deleted
//         if (deletedCount > 0) {
//             setTimeout(() => {
//                 channel.send(`${deletedCount} messages were deleted.`);
//             }, 100);
//         } else {
//             channel.send(`No older messages to delete.`);
//         }
//     } catch (err) {
//         console.error(`Error deleting messages in channel ${channelId}:`, err);
//     }
// }

// //array to keep track of all interval ids
// let intervalIds = [];

// // Function to handle intervals for each channel
// async function setupIntervals() {
//     const settings = await fetchChannelSettings();

//     settings.forEach((setting) => {
//         const { guild_id, channel_id, interval, delete_age } = setting;

//         // Convert interval from hours to milliseconds
//         const intervalMs = interval * 60 * 60 * 1000;

//         // Set up setInterval for each channel
//         const intervalId = setInterval(async () => {
//             await deleteOldMessages(channel_id, delete_age);
//         }, intervalMs);
//         intervalIds.push(intervalId);
//         for (let i = 0; i < intervalIds.length - 1; i++) {
//             clearInterval(intervalIds[i]);
//         }
//         console.log("All intervals cleared");
//         intervalIds = [intervalIds.at(-1)];

//         console.log(
//             `Set up interval for Guild ${guild_id}, Channel ${channel_id} to check every ${interval} hours and delete messages older than ${delete_age} hours.`
//         );
//     });
// }

// // Once the bot is ready, set up the intervals
// bot.once("ready", async () => {
//     console.log(`Logged in as ${bot.user.tag}!`);
//     await setupIntervals(); // Fetch settings and start intervals
// });


// //end

// // Log in to Discord
// bot.login(process.env.DISCORD_TOKEN);

const express = require("express");
const { Client: PgClient } = require("pg");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { Client: DiscordClient, GatewayIntentBits } = require("discord.js");
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

// Register commands for a guild
const registerCommandsForGuild = async (guildId) => {
    try {
        console.log(`Registering commands for guild: ${guildId}`);
        await rest.put(Routes.applicationGuildCommands(process.env.Client_Id, guildId), { body: commands });
        console.log("Commands registered successfully.");
    } catch (error) {
        console.error("Error registering commands:", error);
    }
};

// Discord bot event handlers
discordBot.on("ready", async () => {
    console.log(`Logged in as ${discordBot.user.tag}`);
    const guilds = discordBot.guilds.cache.map(guild => guild.id);
    for (const guildId of guilds) {
        await registerCommandsForGuild(guildId);
    }
});

discordBot.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, member } = interaction;
    const guildId = interaction.guild.id;
    const channelId = interaction.channel.id;

    switch (commandName) {
        case "add-gravbits":
            await addOrUpdateChannel(guildId, channelId);
            await interaction.reply("Channel added for monitoring.");
            break;

        case "remove-gravbits":
            await removeChannel(guildId, channelId);
            await interaction.reply("Channel removed from monitoring.");
            break;

        // Add other command handlers here...
    }
});

// Express routes
app.get("/status", (req, res) => {
    res.send({ status: "OK", bot: discordBot.user?.tag || "Disconnected" });
});

// Helper functions
const addOrUpdateChannel = async (guildId, channelId) => {
    try {
        await pgClient.query(`
            INSERT INTO gravbits_channels (guild_id, channel_id, interval, delete_age)
            VALUES ($1, $2, 1, 1)
            ON CONFLICT (guild_id, channel_id) DO UPDATE
            SET interval = 1, delete_age = 1
        `, [guildId, channelId]);
        console.log(`Channel ${channelId} added/updated for guild ${guildId}`);
    } catch (err) {
        console.error("Error adding/updating channel:", err);
    }
};

const removeChannel = async (guildId, channelId) => {
    try {
        await pgClient.query(`
            DELETE FROM gravbits_channels
            WHERE guild_id = $1 AND channel_id = $2
        `, [guildId, channelId]);
        console.log(`Channel ${channelId} removed from guild ${guildId}`);
    } catch (err) {
        console.error("Error removing channel:", err);
    }
};

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    discordBot.login(process.env.DISCORD_TOKEN);
});


app.get('/', (req, res) => {
    res.send('Hello, the bot is running and ready to server your commands!');
});
