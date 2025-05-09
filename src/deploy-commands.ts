import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { data as produkCommand } from './commands/products';

// Memuat variabel environment dari file .env
config();

const commands = [produkCommand.toJSON()];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN_DISCORD!);

(async () => {
  try {
    console.log('🚀 Registering commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!), // untuk global
      { body: commands },
    );    
    console.log('✅ Commands registered.');
  } catch (err) {
    console.error(err);
  }
})();
