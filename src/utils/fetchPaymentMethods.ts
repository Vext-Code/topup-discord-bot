// /Users/fanfan/Sites/discord-bot/src/utils/fetchPaymentMethods.ts
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

export interface PaymentMethod {
  code: string; // e.g., "OVO", "VABCA", "QRIS" - assumed to not contain underscores
  name: string; // e.g., "OVO", "VA BCA", "QRIS MPM"
  // Add other relevant fields if any, e.g., fee, type, image_url
}

export const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const apiUrl = `${process.env.PUBLIC_URL}/api/duitku`;
  // console.log(`[fetchPaymentMethods] Attempting to fetch payment methods from: ${apiUrl}`);
  try {
    const res = await axios.get<any>(apiUrl); // Fetch as 'any' to inspect structure
    // PENTING: Jangan hapus log ini sampai masalah benar-benar selesai!
    console.log('[fetchPaymentMethods] Full API response data:', JSON.stringify(res.data, null, 2));

    let methods: PaymentMethod[] = [];
    let rawMethods: any[] = [];

    // SESUAIKAN BERDASARKAN LOG 'Full API response data' ANDA
    // Contoh jika array ada di res.data.paymentChannels dan fieldnya channelCode & channelName
    if (res.data && Array.isArray(res.data.paymentChannels)) {
      rawMethods = res.data.paymentChannels;
      // Kita map ke interface PaymentMethod kita.
      methods = rawMethods.map(m => ({
        code: m.channelCode, // Nama field kode dari API Anda
        name: m.channelName,   // Nama field nama dari API Anda
        // Anda bisa tambahkan field lain dari API jika perlu, contoh:
        // fee: m.totalFee,
        // imageUrl: m.paymentImage,
      })).filter(m => m.code && m.name); // Pastikan 'code' dan 'name' ada setelah mapping
    // Hapus blok if/else if lain jika tidak relevan dengan struktur API Anda
    // Jika tidak ada struktur yang cocok
    } else {
      console.error('[fetchPaymentMethods] Unexpected API response structure. Could not find a valid payment methods array in the response.');
      return []; // Kembalikan array kosong jika struktur tidak dikenali
    }

    if (methods.length > 0) {
      console.log(`[fetchPaymentMethods] Successfully processed ${methods.length} payment methods.`);
    } else {
      console.warn('[fetchPaymentMethods] No payment methods were successfully processed. Check the "Full API response data" log above and ensure parsing logic matches the API structure and field names.');
    }
    
    return methods;

  } catch (error) {
    console.error(`[fetchPaymentMethods] Error fetching payment methods from ${apiUrl}:`, error);
    return []; // Kembalikan array kosong jika terjadi error saat fetch
  }
};
