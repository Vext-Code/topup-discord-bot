// src/utils/sendOrderDM.ts

import { Client, TextChannel } from 'discord.js';

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

    const message = [
      '🛒 Pesanan diproses',
      '',
      '> ```',
      `> No. Invoice : ${trxId}`,
      `> Product     : ${product}`,
      `> Tujuan     : ${target}`,
      `> Harga      : Rp ${price.toLocaleString('id-ID')}`,
      '> ```',
    ].join('\n');

    await user.send(message);

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

    const statusText = status === 'success' ? '✅ Pesanan berhasil!' : '❌ Pesanan gagal diproses.';
    const message = [
      statusText,
      '',
      '> ```',
      `> No. Invoice : ${trxId}`,
      `> Status      : ${status === 'success' ? 'Sukses' : 'Gagal'}`,
      '> ```',
    ].join('\n');

    await user.send(message);
  } catch (err) {
    console.error(`Gagal kirim status DM:`, err);
  }
};