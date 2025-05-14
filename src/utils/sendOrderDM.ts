// src/utils/sendOrderDM.ts

import { Client, EmbedBuilder, DiscordAPIError } from 'discord.js';

interface OrderData {
  discordId: string;
  trxId: string;
  product: string;
  target: string;
  price: number; // Specific to initial order request
}

// Interface for status update payload
interface OrderStatusData {
  discordId: string;
  trxId: string;
  product: string; // Product and target might be useful for context in the DM
  target: string;
  status: 'sukses' | 'gagal' | 'pending';
}

export const handleOrderRequest = (client: Client) => async (req: any, res: any) => {
  const {
discordId,
trxId,
product,
target,
price 
}: OrderData = req.body;

  // Basic validation
  if (!discordId || !trxId || !product || !target || price === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required fields: discordId, trxId, product, target, price' });
  }
  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({ success: false, error: 'Invalid price value' });
  }

  try {
    const user = await client.users.fetch(discordId);

    const embed = new EmbedBuilder()
      .setTitle('⏳ Pesanan Anda Dalam Proses')
      .setColor(0xFFA500) // Orange color for "processing"
      .addFields({
        name: '🛒 Detail Pesanan',
        value: [
          `> 🆔 Trx ID: \`${trxId}\``,
          `> 📦 Produk: ${product}`,
          `> 🏠 Tujuan: ${target}`,
          `> 💰 Harga: Rp ${price.toLocaleString('id-ID')}`,
        ].join('\n'),
        inline: false,
      });

    await user.send({ embeds: [embed] });

    res.status(200).json({ success: true, message: 'DM sent for order processing' });

  } catch (err) {
    console.error('Error in handleOrderRequest:', err);
    if (err instanceof DiscordAPIError && err.code === 10013) { // Unknown User
        return res.status(404).json({ success: false, error: 'Discord user not found' });
    }
    res.status(500).json({ success: false, error: 'Failed to send DM' });
  }
};

// Renamed and refactored sendOrderStatusDM to be an Express handler factory
export const handleOrderStatusUpdate = (client: Client) => async (req: any, res: any) => {
  const {
    discordId,
    trxId,
    product,
    target,
    status
  }: OrderStatusData = req.body;

  // Basic validation
  if (!discordId || !trxId || !product || !target || !status) {
    return res.status(400).json({ success: false, error: 'Missing required fields: discordId, trxId, product, target, status' });
  }
  if (!['sukses', 'gagal', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, error: "Invalid status value. Must be 'sukses', 'gagal', or 'pending'." });
  }

  try {
    const user = await client.users.fetch(discordId);
    const isSuccess = status === 'sukses';
    const isPending = status === 'pending';

    const embed = new EmbedBuilder()
      .setTitle(isSuccess ? '✅️ Pesanan Berhasil' : isPending ? '⏳ Pesanan Dalam Proses' : '❌ Pesanan Gagal')
      .setColor(isSuccess ? 0x00FF00 : isPending ? 0xFFA500 : 0xFF0000) // Green for success, Orange for pending, Red for failed
      .addFields({
        name: '🛒 Detail Pesanan',
        value: [
          `> 🆔 Trx ID: \`${trxId}\``,
          `> 📦 Produk: ${product}`, // Kept for context
          `> 🏠 Tujuan: ${target}`,   // Kept for context
          `> 📊 Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`, // Capitalized status
        ].join('\n'),
        inline: false,
      });

    await user.send({ embeds: [embed] });
    res.status(200).json({ success: true, message: `Order status DM sent for status: ${status}` });

  } catch (err) {
    console.error('Error in handleOrderStatusUpdate:', err);
    if (err instanceof DiscordAPIError && err.code === 10013) { // Unknown User
        return res.status(404).json({ success: false, error: 'Discord user not found' });
    }
    res.status(500).json({ success: false, error: 'Failed to send status DM' });
  }
};