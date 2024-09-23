
/*const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, GatewayIntentBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const clientId = process.env.Client_Id; // Replace with your bot's client ID
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

// Function to register commands for a specific guild
const registerCommandsForGuild = async (guildId) => {
    try {
        console.log(`Started refreshing application (/) commands for guild: ${guildId}`);
        
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: commands,
        });

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
};

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

// Listen for when the bot joins a new guild
client.on('guildCreate', (guild) => {
    console.log(`Joined a new guild: ${guild.name} (ID: ${guild.id})`);
    db.run(`INSERT OR IGNORE INTO channels (guildId) VALUES (?)`, [guild.id], function(err) {
        if (err) {
            console.error('Error adding new guild:', err.message);
        } else {
            console.log(`Added new guild to database: ${guild.id}`);
            registerCommandsForGuild(guild.id); // Register commands for the new guild
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
client.on('error', console.error);*/

const { Client } = require("pg");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { Client: DiscordClient, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const clientId = process.env.Client_Id;

// Use environment variables for PostgreSQL connection
const pgClient = new Client({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

// Connect to PostgreSQL and create table if it doesn't exist
pgClient
  .connect()
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
  .catch((err) => console.error("Connection error", err.stack));

// Command registration
const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);
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
    description: "Set the interval for message deletion (minutes).",
    options: [
      {
        name: "interval",
        type: 4,
        description: "Interval in minutes",
        required: false,
      },
    ],
  },
  {
    name: "deltime-gravbits",
    description: "Set the time for messages to be deleted (older than N minutes).",
    options: [
      {
        name: "delete_age",
        type: 4,
        description: "Delete messages older than N minutes",
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

// Function to register commands for a specific guild
const registerCommandsForGuild = async (guildId) => {
  try {
    console.log(`Started refreshing application (/) commands for guild: ${guildId}`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
};

// Initialize Discord bot
const bot = new DiscordClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Register commands when the bot is ready
bot.on("ready", async () => {
  console.log(`Logged in as ${bot.user.tag}`);
  const guilds = bot.guilds.cache.map(guild => guild.id);
  for (const guildId of guilds) {
    await registerCommandsForGuild(guildId);
  }

  // Start the periodic scanning for messages
  setInterval(scanAndDeleteMessages, 60000); // Run every minute
});

// Check if user has the bot_cmd role
const hasBotCmdRole = (member) => {
  return member.roles.cache.some(role => role.name === 'bot_cmd');
};

// Handle commands
bot.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, member } = interaction;

  if (!hasBotCmdRole(member)) {
    await interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
    return;
  }

  const guildId = interaction.guild.id;
  const channelId = interaction.channel.id;

  switch (commandName) {
    case "add-gravbits":
      await addOrUpdateChannel(guildId, channelId);
      await interaction.reply(`Channel added for monitoring: scanning every 1 minute.`);
      break;

    case "check-gravbits":
      const newInterval = interaction.options.getInteger("interval") || 1;
      await handleCheckGravbits(guildId, channelId, newInterval);
      await interaction.reply(`Scan interval updated to ${newInterval} minutes.`);
      break;

    case "deltime-gravbits":
      const newDeleteAge = interaction.options.getInteger("delete_age") || 1;
      await handleDeleteAge(guildId, channelId, newDeleteAge);
      await interaction.reply(`Delete age updated to ${newDeleteAge} minutes.`);
      break;

    case "delete-gravbits":
      const messageCount = interaction.options.getInteger("count") || 10;
      await handleDeleteGravbits(interaction, guildId, channelId, messageCount); // Pass interaction
      break;

    case "remove-gravbits":
      await handleRemoveGravbits(guildId, channelId);
      await interaction.reply(`Channel removed from monitoring.`);
      break;

    case "scan":
      await handleScan(interaction, guildId);
      break; // Handle scan reply inside the function
  }
});

// Function to add or update a channel for scanning
async function addOrUpdateChannel(guildId, channelId) {
  try {
    await pgClient.query(`
      INSERT INTO gravbits_channels (guild_id, channel_id, interval, delete_age)
      VALUES ($1, $2, 1, 1)
      ON CONFLICT (guild_id, channel_id) DO UPDATE
      SET interval = 1, delete_age = 1
    `, [guildId, channelId]);
    console.log(`Channel ${channelId} in guild ${guildId} added/updated for scanning.`);
  } catch (error) {
    console.error('Error adding/updating channel:', error);
  }
}

async function handleDeleteAge(guildId, channelId, newDeleteAge) {
  try {
    await pgClient.query(`
      UPDATE gravbits_channels
      SET delete_age = $3
      WHERE guild_id = $1 AND channel_id = $2
    `, [guildId, channelId, newDeleteAge]);
    console.log(`Updated delete age for channel ${channelId} in guild ${guildId} to ${newDeleteAge} minutes.`);
  } catch (error) {
    console.error('Error updating delete age:', error);
  }
}
// Function to handle /deltime-gravbits command
async function handleCheckGravbits(guildId, channelId, newInterval) {
  try {
    await pgClient.query(`
      UPDATE gravbits_channels
      SET interval = $3
      WHERE guild_id = $1 AND channel_id = $2
    `, [guildId, channelId, newInterval]);
    console.log(`Updated scan interval for channel ${channelId} in guild ${guildId} to ${newInterval} minutes.`);
  } catch (error) {
    console.error('Error updating interval:', error);
  }
}

//function delete message 
async function handleDeleteGravbits(interaction, guildId, channelId, messageCount) {
  const channel = bot.channels.cache.get(channelId);
  if (!channel) {
    console.log(`Channel with ID ${channelId} not found!`);
    return;
  }

  try {
    // Fetch and delete the most recent messages
    const fetchedMessages = await channel.messages.fetch({ limit: messageCount || 100 });
    // Filter out bot messages if necessary
    const messagesToDelete = fetchedMessages.filter(msg => !msg.author.bot);

    await channel.bulkDelete(messagesToDelete, true);
    console.log(`Deleted ${messagesToDelete.size} messages in ${channel.name}`);

    // Optional: Send a message to the channel after deletion
    await channel.send(`Deleted ${messagesToDelete.size} recent messages.`);
  } catch (error) {
    console.error(`Error deleting messages in ${channelId}:`, error);
  }
}


// Function to handle /scan command
async function handleScan(interaction, guildId) {
  try {
    const result = await pgClient.query(`
      SELECT channel_id, interval, delete_age FROM gravbits_channels
      WHERE guild_id = $1
    `, [guildId]);

    const channelList = await Promise.all(result.rows.map(async (row) => {
      const channel = bot.channels.cache.get(row.channel_id);
      return channel ? `${channel.name}: Interval - ${row.interval} min, Delete Age - ${row.delete_age} min` : `Channel ID ${row.channel_id} not found.`;
    }));

    const responseMessage = channelList.length > 0 ? channelList.join("\n") : "No channels monitored in this guild.";
    console.log(`Channels monitored in guild ${guildId}:`, channelList);

    // Send response back to the user
    await interaction.reply(responseMessage);
  } catch (error) {
    console.error('Error fetching channels:', error);
  }
}


// Function to handle /remove-gravbits command
async function handleRemoveGravbits(guildId, channelId) {
  try {
    await pgClient.query(`
      DELETE FROM gravbits_channels
      WHERE guild_id = $1 AND channel_id = $2
    `, [guildId, channelId]);
    console.log(`Channel ${channelId} removed from monitoring in guild ${guildId}.`);
  } catch (error) {
    console.error('Error removing channel:', error);
  }
}

// Function to periodically scan and delete messages
async function scanAndDeleteMessages() {
  try {
    const result = await pgClient.query(`
      SELECT channel_id, delete_age FROM gravbits_channels
    `);
    const currentTime = Date.now();

    for (const row of result.rows) {
      const channel = bot.channels.cache.get(row.channel_id);
      if (!channel || channel.type !== 'GUILD_TEXT') continue; // Ensure it's a text channel

      const deleteAgeInMillis = row.delete_age * 60 * 1000; // Convert minutes to milliseconds
      const messages = await channel.messages.fetch({ limit: 100 });

      const messagesToDelete = messages.filter(msg => (currentTime - msg.createdTimestamp) > deleteAgeInMillis);
      if (messagesToDelete.size > 0) {
        await channel.bulkDelete(messagesToDelete, true);
        console.log(`Deleted ${messagesToDelete.size} messages in channel ${row.channel_id}.`);
      }
    }
  } catch (error) {
    console.error('Error during periodic scanning and deletion:', error);
  }
}

// Log in to Discord
bot.login(process.env.DISCORD_TOKEN);

