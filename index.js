/*const { Client } = require("pg");
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

        // Fetch existing commands in the guild
        const existingCommands = await rest.get(
            Routes.applicationGuildCommands(clientId, guildId)
        );

        const existingCommandNames = existingCommands.map(command => command.name);

        // Filter out commands that are already registered
        const newCommands = commands.filter(
            command => !existingCommandNames.includes(command.name)
        );

        if (newCommands.length > 0) {
            // Register only new commands
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: newCommands }
            );
            console.log('Successfully registered new application (/) commands.');
        } else {
            console.log('No new commands to register.');
        }
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
  //setInterval(scanAndDeleteMessages, 60000); // Run every minute
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
    await interaction.reply("Channel not found!");
    return;
  }

  try {
    // Fetch messages (default to 100 if messageCount is not provided)
    const fetchedMessages = await channel.messages.fetch({ limit: messageCount || 100 });

    if (fetchedMessages.size === 0) {
      console.log("No messages found to delete.");
      await interaction.reply("No messages found to delete.");
      return;
    }

    // Now delete all messages, including bot's own messages
    await channel.bulkDelete(fetchedMessages, true);
    console.log(`Deleted ${fetchedMessages.size} messages in ${channel.name}`);

    // Optional: Send a message to the channel after deletion
    await interaction.reply(`Deleted ${fetchedMessages.size} messages.`);
  } catch (error) {
    console.error(`Error deleting messages in ${channelId}:`, error);
    await interaction.reply("There was an error trying to delete messages.");
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

// New added code 
// Function to get channel intervals and delete_age from the database
async function fetchChannelSettings() {
  const query = `SELECT guild_id, channel_id, interval, delete_age FROM gravbits_channels`;
  const res = await pgClient.query(query);
  return res.rows;
}

// Function to delete old messages
async function deleteOldMessages(channelId, deleteAgeMinutes) {
  const channel = await bot.channels.fetch(channelId);
  const now = Date.now();
  const deleteBefore = now - deleteAgeMinutes * 60 * 1000;

  let deletedCount = 0;

  try {
    // Fetch messages from the channel
    const messages = await channel.messages.fetch({ limit: 100 });
    messages.forEach(async (message) => {
      if (message.createdTimestamp < deleteBefore) {
        await message.delete();
        deletedCount++;
      }
    });

    // Log how many messages were deleted
    if (deletedCount > 0) {
      channel.send(`${deletedCount} messages were deleted.`);
    } else {
      channel.send(`No older messages to delete.`);
    }
  } catch (err) {
    console.error(`Error deleting messages in channel ${channelId}:`, err);
  }
}

// Function to handle intervals for each channel
async function setupIntervals() {
  const settings = await fetchChannelSettings();

  settings.forEach((setting) => {
    const { guild_id, channel_id, interval, delete_age } = setting;

    // Convert interval from minutes to milliseconds
    const intervalMs = interval * 60 * 1000;

    // Set up setInterval for each channel
    setInterval(async () => {
      await deleteOldMessages(channel_id, delete_age);
    }, intervalMs);

    console.log(
      `Set up interval for Guild ${guild_id}, Channel ${channel_id} to check every ${interval} minutes and delete messages older than ${delete_age} minutes.`
    );
  });
}

// Once the bot is ready, set up the intervals
bot.on("ready", async () => {
  console.log(`Logged in as ${bot.user.tag}!`);
  await setupIntervals(); // Fetch settings and start intervals
});


//end

// Log in to Discord
bot.login(process.env.DISCORD_TOKEN);

*/

const { Client } = require("pg"); 
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { Client: DiscordClient, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const clientId = process.env.Client_Id;
const existingIntervals = {}; // Store intervals for each channel

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

        // Fetch existing commands in the guild
        const existingCommands = await rest.get(
            Routes.applicationGuildCommands(clientId, guildId)
        );

        const existingCommandNames = existingCommands.map(command => command.name);

        // Filter out commands that are already registered
        const newCommands = commands.filter(
            command => !existingCommandNames.includes(command.name)
        );

        if (newCommands.length > 0) {
            // Register only new commands
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: newCommands }
            );
            console.log('Successfully registered new application (/) commands.');
        } else {
            console.log('No new commands to register.');
        }
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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
});

// Register commands when the bot is ready
bot.on("ready", async () => {
  console.log(`Logged in as ${bot.user.tag}`);
  const guilds = bot.guilds.cache.map(guild => guild.id);
  for (const guildId of guilds) {
    await registerCommandsForGuild(guildId);
  }

  await setupIntervals(); // Fetch settings and start intervals
});

// Check if user has the bot_cmd role
const hasBotCmdRole = (member) => {
  return member.roles.cache.some(role => role.name === 'bot_cmd');
};

// Handle commands
bot.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, member } = interaction;
  const guildId = interaction.guild.id;
  const channelId = interaction.channel.id;

  // Check if user has the required role
  if (!hasBotCmdRole(member)) {
    await interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
    return;
  }

  // Fetch current settings from the database (for interval and delete age)
  const fetchCurrentSettings = async () => {
    const result = await pgClient.query(
      `SELECT interval, delete_age FROM gravbits_channels WHERE guild_id = $1 AND channel_id = $2`,
      [guildId, channelId]
    );
    return result.rows[0] || { interval: 1, delete_age: 1 }; // Default to 1 if no row is found
  };

  // Fetch current settings once to avoid querying multiple times
  const currentSettings = await fetchCurrentSettings();
  let newInterval = currentSettings.interval;  // Default to current interval or 1
  let newDeleteAge = currentSettings.delete_age; // Default to current delete_age or 1

  // Handle commands
  switch (commandName) {
    case "add-gravbits":
      await addOrUpdateChannel(guildId, channelId);
      await interaction.reply(`Channel added for monitoring: scanning every 1 minute.`);
      break;

    case "check-gravbits":
      newInterval = interaction.options.getInteger("interval") || currentSettings.interval || 1;
      await updateChannelSettingsAndRestartInterval(guildId, channelId, newInterval, newDeleteAge);
      await interaction.reply(`Scan interval updated to ${newInterval} minutes.`);
      break;

    case "deltime-gravbits":
      newDeleteAge = interaction.options.getInteger("delete_age") || currentSettings.delete_age || 1;
      await updateChannelSettingsAndRestartInterval(guildId, channelId, newInterval, newDeleteAge);
      await interaction.reply(`Delete age updated to ${newDeleteAge} minutes.`);
      break;

    case "delete-gravbits":
      const messageCount = interaction.options.getInteger("count") || 10;
      await handleDeleteGravbits(interaction, guildId, channelId, messageCount);
      break;

    case "remove-gravbits":
      await handleRemoveGravbits(guildId, channelId);
      await interaction.reply(`Channel removed from monitoring.`);
      break;

    case "scan":
      await handleScan(interaction, guildId);
      break;
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

// Function to handle interval updates dynamically and restart the interval
async function updateChannelSettingsAndRestartInterval(guildId, channelId, newInterval, newDeleteAge) {
  try {
    // Fetch the current settings from the database
    const currentSettings = await pgClient.query(
      `SELECT interval, delete_age FROM gravbits_channels WHERE guild_id = $1 AND channel_id = $2`,
      [guildId, channelId]
    );

    // Default to 1 if no interval or delete age is provided by the user or in the database
    const intervalToUse = newInterval ?? currentSettings.rows[0]?.interval ?? 1;  // Use newInterval or current interval or default to 1
    const deleteAgeToUse = newDeleteAge ?? currentSettings.rows[0]?.delete_age ?? 1; // Use newDeleteAge or current delete age or default to 1

    // Update the database with the new values
    await pgClient.query(
      `UPDATE gravbits_channels SET interval = $3, delete_age = $4 WHERE guild_id = $1 AND channel_id = $2`,
      [guildId, channelId, intervalToUse, deleteAgeToUse]
    );

    // Clear any existing interval to avoid overlapping
    if (existingIntervals[channelId]) {
      clearInterval(existingIntervals[channelId]);
    }

    // Set up the new interval
    existingIntervals[channelId] = setInterval(async () => {
      await deleteOldMessages(channelId, deleteAgeToUse);
    }, intervalToUse * 60 * 1000); // Convert minutes to milliseconds

    console.log(`Interval updated for ${channelId}: every ${intervalToUse} minutes, delete age ${deleteAgeToUse} minutes.`);
  } catch (error) {
    console.error("Error updating settings and restarting interval:", error);
  }
}

//handle scan
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

//function delete message 
async function handleDeleteGravbits(interaction, guildId, channelId, messageCount) {
  const channel = bot.channels.cache.get(channelId);
  if (!channel) {
    console.log(`Channel with ID ${channelId} not found!`);
    await interaction.reply("Channel not found!");
    return;
  }

  try {
    // Fetch messages (default to 100 if messageCount is not provided)
    const fetchedMessages = await channel.messages.fetch({ limit: messageCount || 100 });

    if (fetchedMessages.size === 0) {
      console.log("No messages found to delete.");
      await interaction.reply("No messages found to delete.");
      return;
    }

    // Now delete all messages, including bot's own messages
    await channel.bulkDelete(fetchedMessages, true);
    console.log(`Deleted ${fetchedMessages.size} messages in ${channel.name}`);

    // Optional: Send a message to the channel after deletion
    await interaction.reply(`Deleted ${fetchedMessages.size} messages.`);
  } catch (error) {
    console.error(`Error deleting messages in ${channelId}:`, error);
    await interaction.reply("There was an error trying to delete messages.");
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

//ahndle delete age older
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

// Function to delete old messages
async function deleteOldMessages(channelId, deleteAgeMinutes) {
  const channel = await bot.channels.fetch(channelId);
  const now = Date.now();
  const deleteBefore = now - deleteAgeMinutes * 60 * 1000;

  let deletedCount = 0;

  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    messages.forEach(async (message) => {
      if (message.createdTimestamp < deleteBefore) {
        await message.delete();
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} messages in channel ${channelId}.`);
    }
  } catch (err) {
    console.error(`Error deleting messages in channel ${channelId}:`, err);
  }
}

// Fetch channel settings from the database
async function fetchChannelSettings() {
  const res = await pgClient.query(`SELECT guild_id, channel_id, interval, delete_age FROM gravbits_channels`);
  return res.rows;
}

// Setup intervals for each channel
async function setupIntervals() {
  const settings = await fetchChannelSettings();

  settings.forEach((setting) => {
    const { guild_id, channel_id, interval, delete_age } = setting;

    if (existingIntervals[channel_id]) {
      clearInterval(existingIntervals[channel_id]);
    }

    existingIntervals[channel_id] = setInterval(async () => {
      await deleteOldMessages(channel_id, delete_age);
    }, interval * 60 * 1000);

    console.log(`Set interval for channel ${channel_id}: ${interval} minutes, delete age: ${delete_age} minutes.`);
  });
}

// Function to remove a channel from monitoring
async function handleRemoveGravbits(guildId, channelId) {
  try {
    await pgClient.query(`DELETE FROM gravbits_channels WHERE guild_id = $1 AND channel_id = $2`, [guildId, channelId]);

    if (existingIntervals[channelId]) {
      clearInterval(existingIntervals[channelId]);
      delete existingIntervals[channelId];
    }

    console.log(`Channel ${channelId} removed from monitoring.`);
  } catch (error) {
    console.error(`Error removing channel ${channelId}:`, error);
  }
}

// Start the bot
bot.login(process.env.DISCORD_TOKEN);
