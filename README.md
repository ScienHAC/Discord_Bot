# 🚀 GravBits - The Ultimate Message Management Bot

Welcome to the **GravBits** Discord bot repository! **GravBits** is designed to automate the process of monitoring and deleting old messages in specified channels. It supports PostgreSQL for data persistence and is equipped with several useful commands to manage message deletion intervals and aging. 

> **Note:** Only users with the `bot_cmd` role can access the bot's commands.

---

## 🌟 Key Features

- 🔐 **Role-Based Permissions**: Only users with the `bot_cmd` role can use the bot's commands, ensuring secure access.
- 🕒 **Custom Intervals**: Set custom scan intervals to check and delete messages older than a specified age.
- 📊 **Database Integration**: Uses PostgreSQL to store guild and channel-specific settings.
- 🧹 **Bulk Message Deletion**: Easily delete messages in bulk based on user-specified criteria.
- 🔄 **Automated Scanning**: Periodically scans channels and deletes messages older than the configured age.

---

## 🛠 Installation

To set up **GravBits** on your server, follow these steps:

1. **Clone the repository**:
    ```bash
    git clone git@github.com:ScienHAC/Discord_Bot.git
    ```

2. **Navigate to the bot directory**:
    ```bash
    cd Discord_Bot
    ```

3. **Install dependencies**:
    ```bash
    npm install
    ```

4. **Set up environment variables**:

   Create a `.env` file in the root directory with your credentials:
    ```env
    DISCORD_TOKEN=your_discord_token
    Client_Id=your_discord_client_id
    PGHOST=your_postgres_host
    PGDATABASE=your_postgres_database
    PGUSER=your_postgres_user
    PGPASSWORD=your_postgres_password
    PGPORT=your_postgres_port
    ```

5. **Start the bot**:
    ```bash
    npm start
    ```

---

## 🔧 Commands

**GravBits** offers several commands to help manage and automate message deletion. Here’s a quick guide:

| Command               | Description                                               | Example                               |
| --------------------- | --------------------------------------------------------- | ------------------------------------- |
| `/add-gravbits`       | Add the current channel for automatic message deletion.    | `/add-gravbits`                      |
| `/remove-gravbits`    | Remove the current channel from automatic deletion.        | `/remove-gravbits`                   |
| `/check-gravbits`     | Set the interval (in hours) for scanning this channel.     | `/check-gravbits interval:3`         |
| `/deltime-gravbits`   | Set the delete age (in hours) for messages.                | `/deltime-gravbits delete_age:48`    |
| `/delete-gravbits`    | Delete a specific number of messages from the channel.     | `/delete-gravbits count:50`          |
| `/scan`               | Display the list of channels currently being monitored.    | `/scan`                              |

**Note**: Make sure the user executing the commands has the `bot_cmd` role.

---

## 🏗 Database

GravBits uses **PostgreSQL** to store and manage channel-specific settings such as scan intervals and delete ages. Upon startup, the bot automatically creates the necessary tables if they don’t already exist.

### Database Schema:
- **Table Name**: `gravbits_channels`
    - `guild_id`: The ID of the Discord guild.
    - `channel_id`: The ID of the monitored channel.
    - `interval`: How often the bot scans the channel (in hours).
    - `delete_age`: The age of messages to be deleted (in hours).

---

## 🔄 Automated Message Deletion

**GravBits** automatically scans channels at the specified interval and deletes messages older than the `delete_age`. This process is managed using the following:

1. **Scanning and Deletion**: Channels added via `/add-gravbits` are periodically scanned, and messages older than the `delete_age` are removed.
2. **Customization**: Use `/check-gravbits` to adjust scan intervals and `/deltime-gravbits` to modify the age threshold for deletions.
3. **Manual Deletion**: You can also manually trigger message deletion with `/delete-gravbits`.

---

## 🧑‍💻 Contributing

We welcome contributions! Feel free to open issues or submit pull requests to help improve **GravBits**.

### To contribute:
1. Fork this repository.
2. Make your changes in a new branch.
3. Submit a pull request, and we’ll review it!

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

### 🌟 Show Your Support

If you find **GravBits** helpful, consider giving this repository a ⭐ to show your support!

