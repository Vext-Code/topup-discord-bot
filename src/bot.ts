import { Client, GatewayIntentBits, Events, Interaction, ButtonInteraction, CacheType, ChatInputCommandInteraction, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { fetchProducts } from './utils/fetchProducts';
import { execute as executeTopUp, handleCategorySelection, handleBrandSelection } from './commands/products';
import axios from 'axios'; // Pastikan axios diimpor

export function setupBotHandlers(client: Client): void {
  client.once(Events.ClientReady, () => {
    // Menggunakan client.user dari instance yang di-pass
    console.log(`Bot aktif sebagai ${client.user?.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      // Logika penanganan interaksi tetap sama,
      // interaction.client akan merujuk pada instance client yang benar.

    // Menangani interaksi tombol (button interaction)
    if (interaction.isButton()) {
      const { customId } = interaction;

      if (customId.startsWith('page_category_') || customId.startsWith('nav_categories_')) {
        await executeTopUp(interaction as ButtonInteraction); // executeTopUp akan menangani parsing halaman
      } else if (customId.startsWith('category_') || customId.startsWith('page_brand_') || customId.startsWith('nav_brands_')) {
        // Menangani pemilihan kategori (category_CATIDX)
        // ATAU navigasi halaman brand (page_brand_CATIDX_PAGE)
        // ATAU kembali ke daftar brand (nav_brands_CATIDX_PAGE)
        await handleCategorySelection(interaction as ButtonInteraction);
      } else if (customId.startsWith('brand_') || customId.startsWith('page_product_')) {
        // Menangani pemilihan brand (brand_CATIDX_BRANDIDX) ATAU navigasi halaman produk (page_product_CATIDX_BRANDIDX_PAGE)
        await handleBrandSelection(interaction as ButtonInteraction);
      }
      else if (customId.startsWith('produk_')) {
        // Pengguna memilih produk, tampilkan Modal untuk target
        const ids = interaction.customId.split('_');
        const categoryIndex = parseInt(ids[1], 10);
        const brandIndexInCategory = parseInt(ids[2], 10);
        const productRelativeIndex = parseInt(ids[3], 10);

        const modalCustomId = `modal_target_${categoryIndex}_${brandIndexInCategory}_${productRelativeIndex}`;
        const modal = new ModalBuilder()
          .setCustomId(modalCustomId)
          .setTitle('Masukkan Nomor Tujuan/ID Game'); // Judul disesuaikan

        const targetInput = new TextInputBuilder()
          .setCustomId('targetInput')
          .setLabel('Nomor Tujuan/ID Game')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Contoh: 08123456789 atau 123456781234 (ID+Server)');
        const firstActionRowModal = new ActionRowBuilder<TextInputBuilder>().addComponents(targetInput);
        modal.addComponents(firstActionRowModal);

        await (interaction as ButtonInteraction).showModal(modal);

      } else if (customId.startsWith('order_final_')) {
        // Pengguna mengklik tombol "Order Sekarang"
        await interaction.deferUpdate(); // Acknowledge button press
        const parts = customId.split('_'); // order_final_cat_brand_prod_target
        // Indeks parts disesuaikan karena email tidak lagi ada di customId
        const categoryIndex = parseInt(parts[2], 10);
        const brandIndexInCategory = parseInt(parts[3], 10);
        const productRelativeIndex = parseInt(parts[4], 10);
        const target = decodeURIComponent(parts[5]);
        // const email = decodeURIComponent(parts[6]); // Dihapus karena email tidak lagi dipassing

        const allProducts = await fetchProducts();
        const uniqueCategories = Array.from(new Set(allProducts.map(p => p.category).filter(c => c)));
        let selectedProduct: any = null;

        if (categoryIndex >= 0 && categoryIndex < uniqueCategories.length) {
          const productsInCategory = allProducts.filter(p => p.category === uniqueCategories[categoryIndex]);
          const uniqueBrandsInCategory = Array.from(new Set(productsInCategory.map(p => p.brand).filter(b => b)));
          if (brandIndexInCategory >= 0 && brandIndexInCategory < uniqueBrandsInCategory.length) {
            let productsInBrandAndCategory = productsInCategory.filter(p => p.brand === uniqueBrandsInCategory[brandIndexInCategory]);
            productsInBrandAndCategory.sort((a, b) => a.normal_price - b.normal_price);
            if (productRelativeIndex >= 0 && productRelativeIndex < productsInBrandAndCategory.length) {
              selectedProduct = productsInBrandAndCategory[productRelativeIndex];
            }
          }
        }

        if (!selectedProduct) {
          console.error(`[OrderFinal] Could not find product for customId: ${customId}`);
          await interaction.editReply({ content: '❌ Gagal menemukan detail produk untuk pesanan ini.', components: [] });
          return;
        }

        // Persiapan data untuk dikirim ke backend Anda
        const paymentAmount = selectedProduct.normal_price;
        // merchantOrderId akan dibuat di backend
        const productDetails = selectedProduct.name;
        const customerVaName = interaction.user.username; // Menggunakan username Discord
        // email tidak lagi dikirim dari bot

        const callbackUrl = process.env.DUITKU_CALLBACK_URL;
        // Untuk returnUrl, kita akan bahas lebih lanjut. Untuk sekarang, kita tetap kirim apa yang ada di .env
        // Jika returnUrl akan digunakan untuk mengarahkan ke DM, itu perlu penanganan khusus di backend/frontend web.
        // Untuk saat ini, kita asumsikan returnUrl adalah halaman web biasa.
        
        // Jika DUITKU_RETURN_URL di .env kosong, gunakan link DM Discord pengguna sebagai fallback
        const returnUrl = process.env.DUITKU_RETURN_URL || `https://discord.com/channels/@me/${interaction.user.id}`;

        if (!callbackUrl || !returnUrl) {
            console.error("DUITKU_CALLBACK_URL atau DUITKU_RETURN_URL tidak diset di .env");
            await interaction.editReply({ content: '❌ Konfigurasi pembayaran server tidak lengkap. Silakan hubungi admin.', components: [] });
            return;
        }

        const duitkuPayload = {
            paymentAmount,
            // merchantOrderId: DIHAPUS, akan dibuat backend
            productDetails,
            customerVaName,
            // email: DIHAPUS
            callbackUrl,
            returnUrl,
            productSku: selectedProduct.sku, // Tambahkan SKU produk
            // Tambahkan userId Discord agar backend bisa mengirim notifikasi DM jika diperlukan
            discordUserId: interaction.user.id,
            target: target // Tambahkan target untuk diteruskan ke backend
        };        

        try {
            const backendApiUrl = process.env.PUBLIC_URL;
            if (!backendApiUrl) {
                console.error("BACKEND_API_URL is not set in .env");
                await interaction.editReply({ content: '❌ Konfigurasi server backend tidak ditemukan. Pembayaran tidak dapat diproses.', components: [] });
                return;
            }

            const response = await axios.post(`${backendApiUrl}/api/duitku/create-invoice`, duitkuPayload);

            if (response.data && response.data.paymentUrl) {
                const paymentUrl = response.data.paymentUrl;
                // Pesan tidak lagi menyertakan email
                const successMessage = `✅ Invoice berhasil dibuat!\n\n- Produk: ${selectedProduct.name}\n- Harga: Rp ${selectedProduct.normal_price.toLocaleString('id-ID')}\n- Tujuan: ${target}\n\nSilakan lanjutkan pembayaran melalui link berikut: ${paymentUrl}\n\nRekap juga dikirim ke DM Anda.`;
                
                const dmRecap = `📝 Rekap Pesanan Anda:\n\n- Kategori: ${selectedProduct.category}\n- Brand: ${selectedProduct.brand}\n- Produk: ${selectedProduct.name}\n- Harga: Rp ${selectedProduct.normal_price.toLocaleString('id-ID')}\n- Tujuan: ${target}\n\n🔗 Link Pembayaran: ${paymentUrl}`;

                try {
                    await interaction.user.send(dmRecap);
                } catch (dmError) {
                    console.warn("Tidak dapat mengirim DM untuk link pembayaran:", dmError);
                }
                await interaction.editReply({
                    content: successMessage,
                    components: [] 
                });

            } else {
                console.error("Gagal membuat invoice Duitku dari backend:", response.data);
                await interaction.editReply({ content: `❌ Gagal membuat link pembayaran: ${response.data?.statusMessage || 'Error tidak diketahui dari server.'}`, components: [] });
            }

        } catch (error: any) {
            console.error('Error memanggil backend untuk membuat invoice Duitku:', error.response?.data || error.message);
            let backendErrorMessage = 'Terjadi kesalahan saat menghubungi server pembayaran.';
            if (error.response?.data?.message) { 
                backendErrorMessage = `Gagal membuat invoice: ${error.response.data.message}`;
            } else if (error.response?.data?.statusMessage) { 
                backendErrorMessage = `Gagal membuat invoice: ${error.response.data.statusMessage}`;
            }
            await interaction.editReply({ content: `❌ ${backendErrorMessage}`, components: [] });
        }
      }
    }

    // Menangani command /topup (ChatInputCommandInteraction)
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'topup') {
        await executeTopUp(interaction as ChatInputCommandInteraction<CacheType>);
      }
    }

    // Menangani Modal Submission
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('modal_target_')) {
        await interaction.deferUpdate(); // Acknowledge modal submission

        const ids = interaction.customId.split('_'); // modal_target_cat_brand_prod
        const categoryIndex = parseInt(ids[2], 10);
        const brandIndexInCategory = parseInt(ids[3], 10);
        const productRelativeIndex = parseInt(ids[4], 10);
        const target = interaction.fields.getTextInputValue('targetInput');

        // Fetch product details (mirip dengan logika di atas)
        const allProducts = await fetchProducts();
        const uniqueCategories = Array.from(new Set(allProducts.map(p => p.category).filter(c => c)));
        let selectedProduct: any = null;

        if (categoryIndex >= 0 && categoryIndex < uniqueCategories.length) {
          const productsInCategory = allProducts.filter(p => p.category === uniqueCategories[categoryIndex]);
          const uniqueBrandsInCategory = Array.from(new Set(productsInCategory.map(p => p.brand).filter(b => b)));
          if (brandIndexInCategory >= 0 && brandIndexInCategory < uniqueBrandsInCategory.length) {
            let productsInBrandAndCategory = productsInCategory.filter(p => p.brand === uniqueBrandsInCategory[brandIndexInCategory]);
            productsInBrandAndCategory.sort((a, b) => a.normal_price - b.normal_price);
            if (productRelativeIndex >= 0 && productRelativeIndex < productsInBrandAndCategory.length) {
              selectedProduct = productsInBrandAndCategory[productRelativeIndex];
            }
          }
        }

        if (!selectedProduct) {
          console.error(`[ModalSubmit] Could not find product for customId: ${interaction.customId}`);
          // Balas ke interaksi modal
          await interaction.editReply({ content: '❌ Gagal menemukan detail produk. Silakan coba lagi.', components: [] });
          return;
        }

        const orderButtonCustomId = `order_final_${categoryIndex}_${brandIndexInCategory}_${productRelativeIndex}_${encodeURIComponent(target)}`;
        const orderButton = new ButtonBuilder()
          .setCustomId(orderButtonCustomId)
          .setLabel('🛒 Order Sekarang')
          .setStyle(ButtonStyle.Success);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(orderButton);

        // Balas ke interaksi modal, ini akan menjadi pesan baru (atau update jika di-deferReply)
        await interaction.editReply({
          content: `Konfirmasi Pesanan:\n\n- Produk: ${selectedProduct.category} - ${selectedProduct.brand} - ${selectedProduct.name}\n- Harga: Rp ${selectedProduct.normal_price.toLocaleString('id-ID')}\n- Tujuan: ${target}\n\nTekan tombol di bawah untuk menyelesaikan pesanan.`,
          components: [row],
          // ephemeral: true, // Anda bisa set ephemeral jika mau
        });
      }
    }
  } catch (error) {
    console.error('Error during interaction handling:', error);
    if (interaction.isRepliable()) {
      try {
        const errorMessage = 'Terjadi kesalahan saat memproses permintaan Anda.';
        if (interaction.deferred || interaction.replied) {
          // Untuk deferUpdate, editReply adalah yang tepat. Untuk deferReply, juga editReply.
          // followUp digunakan jika Anda ingin mengirim pesan baru setelah reply/editReply awal.
          await interaction.editReply({ content: errorMessage, components: [] });
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral, components: [] });
        }
      } catch (e) {
        console.error("Error sending error reply:", e);
      }
    }
  }
  });
}
