import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  CacheType,
  MessageFlags,
} from 'discord.js';
import { fetchProducts } from '../utils/fetchProducts';

export const data = new SlashCommandBuilder()
  .setName('topup')
  .setDescription('Tampilkan daftar produk top-up');

const ITEMS_PER_PAGE = 20; // 4 baris @ 5 tombol = 20 item. Baris ke-5 untuk navigasi.
const MAX_BUTTONS_PER_ROW = 5;
const MAX_ITEM_ROWS = 4;

export const execute = async (
  interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>,
  requestedPage: number = 0
) => {
  try {
    let currentPage = requestedPage;
    if (interaction.isChatInputCommand()) {
      await interaction.deferReply({ ephemeral: true });
    } else if (interaction.isButton()) { // Tombol navigasi kategori
      const parts = interaction.customId.split('_');
      // Bisa jadi page_category_PAGE atau nav_categories_PAGE
      if ((parts[0] === 'page' || parts[0] === 'nav') && (parts[1] === 'category' || parts[1] === 'categories')) {
        currentPage = parseInt(parts[2], 10);
      } else {
        console.warn(`[execute] Unexpected button customId for category display: ${interaction.customId}`);
        await interaction.editReply({content: "Aksi tombol tidak valid.", components: []});
        return;
      }
      await interaction.deferUpdate();
    }

    const products = await fetchProducts();
    
    if (!products || products.length === 0) {
      await interaction.editReply({ content: 'Saat ini tidak ada produk yang tersedia.' });
      return;
    }

    // Ambil kategori unik
    const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(c => c))); // Filter null/undefined categories
    if (uniqueCategories.length === 0) {
      await interaction.editReply({ content: 'Tidak ada kategori produk yang tersedia saat ini.' });
      return;
    }

    const totalPages = Math.ceil(uniqueCategories.length / ITEMS_PER_PAGE);
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, uniqueCategories.length);
    const categoriesToShow = uniqueCategories.slice(startIndex, endIndex);

    const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentButtons: ButtonBuilder[] = [];

    for (let i = 0; i < categoriesToShow.length; i++) {
      if (actionRows.length >= MAX_ITEM_ROWS && currentButtons.length === 0) break;

      const categoryName = categoriesToShow[i];
      // Dapatkan original index dari uniqueCategories untuk customId
      const originalCategoryIndex = uniqueCategories.indexOf(categoryName); 
      const label = categoryName.slice(0, 80);

      currentButtons.push(
        new ButtonBuilder()
          .setCustomId(`category_${originalCategoryIndex}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Primary)
      );

      if (currentButtons.length === MAX_BUTTONS_PER_ROW || i === categoriesToShow.length - 1) {
        if (actionRows.length < MAX_ITEM_ROWS) {
          actionRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(currentButtons));
          currentButtons = [];
        } else {
          break; 
        }
      }
    }

    // Pagination Row
    const paginationRow = new ActionRowBuilder<ButtonBuilder>();
    let hasNavButtons = false;

    if (currentPage > 0) {
      paginationRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`page_category_${currentPage - 1}`)
          .setLabel('⬅️ Prev. Page')
          .setStyle(ButtonStyle.Secondary)
      );
      hasNavButtons = true;
    }
    if (currentPage < totalPages - 1) {
      paginationRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`page_category_${currentPage + 1}`)
          .setLabel('Next Brand ➡️')
          .setStyle(ButtonStyle.Secondary)
      );
      hasNavButtons = true;
    }

    // Hanya tambahkan baris navigasi jika ada tombol di dalamnya (misalnya, jika totalPages > 1)
    // atau jika kita ingin selalu menampilkan baris navigasi (misalnya untuk tombol "Kembali" di level lain)
    if (hasNavButtons) {
      actionRows.push(paginationRow);
    }

    const replyContent = `Silakan pilih kategori (Halaman ${currentPage + 1} dari ${totalPages}):`;
    if (interaction.isChatInputCommand() || (interaction.isButton() && interaction.deferred)) {
      await interaction.editReply({ content: replyContent, components: actionRows });
    } else if (interaction.isButton()) { // Fallback, seharusnya tidak terjadi jika deferUpdate digunakan
      await interaction.update({ content: replyContent, components: actionRows });
    }

  } catch (error) {
    console.error('Error executing topup command:', error);
    const errorContent = 'Gagal memuat produk. Coba lagi nanti.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorContent, components: [] });
    } else {
      await interaction.reply({ content: errorContent, flags: MessageFlags.Ephemeral, components: [] });
    }
  }
};

// Fungsi untuk menangani pemilihan kategori
export const handleCategorySelection = async (interaction: ButtonInteraction<CacheType>) => {
  try {
    let categoryIndex: number;
    let currentPage = 0; // Halaman untuk daftar brand

    if (interaction.customId.startsWith('category_')) { // Klik pada tombol kategori
      categoryIndex = Number(interaction.customId.split('_')[1]);
      await interaction.deferUpdate();
    } else if (interaction.customId.startsWith('page_brand_') || interaction.customId.startsWith('nav_brands_')) { 
      // Klik pada navigasi brand (page_brand_CATIDX_PAGE)
      // ATAU kembali ke daftar brand (nav_brands_CATIDX_PAGE)
      const parts = interaction.customId.split('_');
      categoryIndex = Number(parts[2]);
      currentPage = Number(parts[3]);
      await interaction.deferUpdate();
    } else {
      console.error(`[handleCategorySelection] Unknown customId: ${interaction.customId}`);
      await interaction.editReply({ content: 'Aksi tidak dikenali.', components: []});
      return;
    }
    
    const allProducts = await fetchProducts();
    const uniqueCategories = Array.from(new Set(allProducts.map(p => p.category).filter(c => c)));

    if (categoryIndex < 0 || categoryIndex >= uniqueCategories.length) {
      await interaction.editReply({ content: 'Indeks kategori tidak valid.', components: [] });
      return;
    }
    const selectedCategory = uniqueCategories[categoryIndex];

    const productsInCategory = allProducts.filter(p => p.category === selectedCategory);
    const uniqueBrandsInCategory = Array.from(new Set(productsInCategory.map(p => p.brand).filter(b => b)));

    if (uniqueBrandsInCategory.length === 0) {
      await interaction.editReply({
        content: `Tidak ada brand yang ditemukan untuk kategori: ${selectedCategory}`,
        components: [],
      });
      return;
    }

    const totalBrandPages = Math.ceil(uniqueBrandsInCategory.length / ITEMS_PER_PAGE);
    const brandStartIndex = currentPage * ITEMS_PER_PAGE;
    const brandEndIndex = Math.min(brandStartIndex + ITEMS_PER_PAGE, uniqueBrandsInCategory.length);
    const brandsToShow = uniqueBrandsInCategory.slice(brandStartIndex, brandEndIndex);

    const brandActionRows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentBrandButtons: ButtonBuilder[] = [];

    for (let i = 0; i < brandsToShow.length; i++) {
      if (brandActionRows.length >= MAX_ITEM_ROWS && currentBrandButtons.length === 0) break;

      const brandName = brandsToShow[i];
      const originalBrandIndex = uniqueBrandsInCategory.indexOf(brandName); // Index dalam uniqueBrandsInCategory
      const label = brandName.slice(0, 80);

      currentBrandButtons.push(
        new ButtonBuilder()
          .setCustomId(`brand_${categoryIndex}_${originalBrandIndex}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Primary)
      );

      if (currentBrandButtons.length === MAX_BUTTONS_PER_ROW || i === brandsToShow.length - 1) {
        if (brandActionRows.length < MAX_ITEM_ROWS) {
          brandActionRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(currentBrandButtons));
          currentBrandButtons = [];
        } else {
          break;
        }
      }
    }

    // Pagination and Navigation Row for Brands
    const navRowForBrands = new ActionRowBuilder<ButtonBuilder>();
    let hasBrandNavButtons = false;

    // Tombol "Kembali ke Kategori"
    navRowForBrands.addComponents(
      new ButtonBuilder()
        .setCustomId(`nav_categories_0`) // Kembali ke halaman 0 daftar kategori
        .setLabel('↩️ Ke Daftar Kategori')
        .setStyle(ButtonStyle.Primary) // Atau ButtonStyle.Danger
    );
    hasBrandNavButtons = true;

    if (currentPage > 0) {
      navRowForBrands.addComponents(
        new ButtonBuilder()
          .setCustomId(`page_brand_${categoryIndex}_${currentPage - 1}`)
          .setLabel('⬅️ Prev. Brand')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    if (currentPage < totalBrandPages - 1) {
      navRowForBrands.addComponents(
        new ButtonBuilder()
          .setCustomId(`page_brand_${categoryIndex}_${currentPage + 1}`)
          .setLabel('Next Brand➡️')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    if (hasBrandNavButtons || navRowForBrands.components.length > 1) { // Selalu tampilkan jika ada tombol kembali, atau jika ada tombol halaman
      brandActionRows.push(navRowForBrands);
    }

    const replyContent = `Kategori: ${selectedCategory} (Halaman Brand ${currentPage + 1} dari ${totalBrandPages})\nSilakan pilih brand:`;
    await interaction.editReply({
      content: replyContent,
      components: brandActionRows,
    });

  } catch (error) {
    console.error('Error handling category selection:', error);
    const errorContent = 'Gagal memuat brand berdasarkan kategori. Coba lagi nanti.';
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorContent, components: [] });
    } else { 
        await interaction.reply({ content: errorContent, flags: MessageFlags.Ephemeral, components: [] });
    }
  }
};

// Fungsi untuk menangani pemilihan brand (setelah kategori dipilih)
export const handleBrandSelection = async (interaction: ButtonInteraction<CacheType>) => {
  try {
    let categoryIndex: number;
    let brandIndexInCategory: number;
    let currentPage = 0; // Halaman untuk daftar produk

    if (interaction.customId.startsWith('brand_')) { // Klik pada tombol brand
      const parts = interaction.customId.split('_');
      categoryIndex = Number(parts[1]);
      brandIndexInCategory = Number(parts[2]);
      await interaction.deferUpdate();
    } else if (interaction.customId.startsWith('page_product_')) { // Klik pada navigasi produk
      const parts = interaction.customId.split('_');
      categoryIndex = Number(parts[2]);
      brandIndexInCategory = Number(parts[3]);
      currentPage = Number(parts[4]);
      await interaction.deferUpdate();
    } else {
      console.error(`[handleBrandSelection] Unknown customId: ${interaction.customId}`);
      await interaction.editReply({ content: 'Aksi tidak dikenali.', components: []});
      return;
    }

    const allProducts = await fetchProducts();
    const uniqueCategories = Array.from(new Set(allProducts.map(p => p.category).filter(c => c)));

    if (categoryIndex < 0 || categoryIndex >= uniqueCategories.length) {
      await interaction.editReply({ content: 'Indeks kategori tidak valid saat memilih brand.', components: [] });
      return;
    }
    const selectedCategory = uniqueCategories[categoryIndex];

    const productsInCategory = allProducts.filter(p => p.category === selectedCategory);
    const uniqueBrandsInCategory = Array.from(new Set(productsInCategory.map(p => p.brand).filter(b => b)));

    if (brandIndexInCategory < 0 || brandIndexInCategory >= uniqueBrandsInCategory.length) {
      await interaction.editReply({ content: 'Indeks brand tidak valid untuk kategori ini.', components: [] });
      return;
    }
    const selectedBrand = uniqueBrandsInCategory[brandIndexInCategory];

    let filteredProducts = productsInCategory.filter(p => p.brand === selectedBrand);
    filteredProducts.sort((a, b) => a.normal_price - b.normal_price);

    if (filteredProducts.length === 0) {
      await interaction.editReply({
        content: `Tidak ada produk yang ditemukan untuk Kategori: ${selectedCategory} - Brand: ${selectedBrand}`,
        components: [],
      });
      return;
    }

    const totalProductPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
    const productStartIndex = currentPage * ITEMS_PER_PAGE;
    const productEndIndex = Math.min(productStartIndex + ITEMS_PER_PAGE, filteredProducts.length);
    const productsToShow = filteredProducts.slice(productStartIndex, productEndIndex);

    const productActionRows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentProductButtons: ButtonBuilder[] = [];

    for (let i = 0; i < productsToShow.length; i++) {
      if (productActionRows.length >= MAX_ITEM_ROWS && currentProductButtons.length === 0) break;

      const product = productsToShow[i];
      // Dapatkan index produk dalam filteredProducts (yang sudah disortir)
      const originalProductIndexInBrand = filteredProducts.indexOf(product);
      const label = `${product.name} - Rp ${product.normal_price.toLocaleString('id-ID')}`.slice(0,80);

      currentProductButtons.push(
        new ButtonBuilder()
          .setCustomId(`produk_${categoryIndex}_${brandIndexInCategory}_${originalProductIndexInBrand}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Primary)
      );

      if (currentProductButtons.length === MAX_BUTTONS_PER_ROW || i === productsToShow.length - 1) {
        if (productActionRows.length < MAX_ITEM_ROWS) {
          productActionRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(currentProductButtons));
          currentProductButtons = [];
        } else {
          break;
        }
      }
    }

    // Pagination and Navigation Row for Products
    const navRowForProducts = new ActionRowBuilder<ButtonBuilder>();
    let hasProductNavButtons = false;

    // Tombol "Kembali ke Brand"
    navRowForProducts.addComponents(
      new ButtonBuilder()
        .setCustomId(`nav_brands_${categoryIndex}_0`) // Kembali ke halaman 0 daftar brand untuk kategori ini
        .setLabel('↩️ Ke Daftar Brand')
        .setStyle(ButtonStyle.Primary) // Atau ButtonStyle.Danger
    );
    hasProductNavButtons = true;

    if (currentPage > 0) {
      navRowForProducts.addComponents(
        new ButtonBuilder()
          .setCustomId(`page_product_${categoryIndex}_${brandIndexInCategory}_${currentPage - 1}`)
          .setLabel('⬅️ Prev. Produk')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    if (currentPage < totalProductPages - 1) {
      navRowForProducts.addComponents(
        new ButtonBuilder()
          .setCustomId(`page_product_${categoryIndex}_${brandIndexInCategory}_${currentPage + 1}`)
          .setLabel('Next Produk➡️')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    
    if (hasProductNavButtons || navRowForProducts.components.length > 1) { // Selalu tampilkan jika ada tombol kembali, atau jika ada tombol halaman
      productActionRows.push(navRowForProducts);
    }
    
    const replyContent = `Kategori: ${selectedCategory}\nBrand: ${selectedBrand} (Halaman Produk ${currentPage + 1} dari ${totalProductPages})\nSilakan pilih produk:`;
    await interaction.editReply({
      content: replyContent,
      components: productActionRows,
    });

  } catch (error) {
    console.error('Error handling brand selection:', error);
    const errorContent = 'Gagal memuat produk berdasarkan brand dan kategori. Coba lagi nanti.';
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorContent, components: [] });
    } else { 
        await interaction.reply({ content: errorContent, flags: MessageFlags.Ephemeral, components: [] });
    }
  }
};
