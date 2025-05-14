// src/server.ts (atau nama file server utama Anda)
import express, { Request, Response, Router } from 'express'; // Tambahkan Router
import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import { handleOrderRequest } from './utils/sendOrderDM'; // Sesuaikan path jika perlu
import { setupBotHandlers } from './bot'; // Impor fungsi setup dari bot.ts

dotenv.config();

const app = express();
// Gunakan variabel environment yang lebih spesifik atau default ke 3001 untuk server HTTP Discord Bot
const discordHttpPort = process.env.DISCORD_HTTP_PORT || 3001;

// Inisialisasi Discord Client
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,    // Diperlukan oleh logika di bot.ts
    GatewayIntentBits.MessageContent,   // Diperlukan oleh logika di bot.ts
    // untuk fetchUser, biasanya tidak memerlukan intent khusus jika bot sudah ada di server bersama user.
    // Jika ada masalah, GatewayIntentBits.GuildMembers mungkin diperlukan.
  ],
});

// Middleware untuk parsing JSON body
app.use(express.json());

// Buat router baru untuk endpoint yang terkait dengan Discord
const discordApiRouter = Router();

// Pastikan router menangani path relatif terhadap /discord
discordApiRouter.post('/send-dm', handleOrderRequest(discordClient));
discordApiRouter.post('/send-order-status', handleOrderRequest(discordClient)); //
discordApiRouter.get('/', (req: Request, res: Response) => {
  res.send('Discord Bot HTTP Server - Discord specific endpoints are active!');
});

// Gunakan router ini dengan awalan /discord
app.use('/discord', discordApiRouter);

// Setup event handlers untuk Discord bot
setupBotHandlers(discordClient);

// Login ke Discord dan jalankan server HTTP
const startServer = async () => {
  try {
    if (!process.env.TOKEN_DISCORD) {
      console.error('TOKEN_DISCORD tidak ditemukan di .env file!');
      process.exit(1);
    }
    await discordClient.login(process.env.TOKEN_DISCORD);
    console.log(`Logged in to Discord as ${discordClient.user?.tag}!`);

    app.listen(Number(discordHttpPort), () => { // Pastikan port adalah angka
      console.log(`HTTP server listening on port ${discordHttpPort}`);
      console.log(`Discord API endpoints available under /discord/`);
      console.log(`  -> POST /discord/send-dm siap menerima permintaan.`);
    });
  } catch (error) {
    console.error('Gagal memulai server atau login ke Discord:', error);
  }
};

// Panggil fungsi untuk memulai server
startServer();

// Pastikan Anda memiliki file .env dengan TOKEN_DISCORD
// Contoh .env:
// TOKEN_DISCORD=token_bot_discord_anda
// DISCORD_HTTP_PORT=3001 (opsional, jika tidak di-set akan default ke 3001 dari kode)
// PUBLIC_URL=http://localhost:3000 (atau URL publik Anda jika di-deploy)