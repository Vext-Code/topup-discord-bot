// src/utils/sendOrderDM.ts

import { Client, EmbedBuilder } from 'discord.js';

interface OrderData {
  discordId: string;
  trxId: string;
  product: string;
  target: string;
  price: number;
}

export const handleOrderRequest = (client: Client) => async (req: any, res: any) => {
  const {
discordId,
trxId,
product,
target,
price 
}: OrderData = req.body;

  try {
    const user = await client.users.fetch(discordId);

    const embed = new EmbedBuilder()
      .setTitle('⏳ Pesanan Anda Dalam Proses')
      .setColor(0xFFA500) // Orange color for "processing"
      .addFields({
        name: '🛒 Detail Pesanan',
        value: [
          `> 🆔 Trx ID : \`${trxId}\``,
          `> 📦 Produk     : ${product}`,
          `> 🏠 Tujuan     : ${target}`,
          `> 💰 Harga      : Rp ${price.toLocaleString('id-ID')}`,
        ].join('\n'),
        inline: false,
      });

    await user.send({ embeds: [embed] });

    res.status(200).json({ success: true, message: 'DM sent' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to send DM' });
  }
};

export const sendOrderStatusDM = async (
  client: Client,
  discordId: string,
  trxId: string,
  status: 'success' | 'failed'
) => {
  try {
    const user = await client.users.fetch(discordId);
    const isSuccess = status === 'success';

    const embed = new EmbedBuilder()
      .setTitle(isSuccess ? '✅️ Pesanan Berhasil' : '❌ Pesanan Gagal')
      .setColor(isSuccess ? 0x00FF00 : 0xFF0000) // Green (65280) for success, Red for failed
      .addFields({
        name: '🛒 Detail Pesanan', // Matching field name from example
        value: [
          `> 🆔 Trx ID : \`${trxId}\``,
          `> 📊 Status      : ${isSuccess ? 'Sukses' : 'Gagal'}`,
        ].join('\n'),
        inline: false,
      });

    await user.send({ embeds: [embed] });

  } catch (err) {
    console.error(`Gagal kirim status DM:`, err);
  }
};