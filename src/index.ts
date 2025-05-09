import * as dotenv from 'dotenv';
dotenv.config(); // Memuat variabel environment dari file .env

import { Client, GatewayIntentBits } from "discord.js";

const client = new Client ({
    intents:
    [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
})

const TOKEN = process.env.TOKEN_DISCORD;

client.on("ready", () => {
    console.log(`Logged in as ${client.user?.tag}`);
})

client.on("messageCreate", (message) => {
    if (message.content === "ping") {
        message.reply("pong");
    }
})

client.login(TOKEN);