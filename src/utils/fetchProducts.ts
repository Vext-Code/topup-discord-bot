// utils/fetchProducts.ts
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config(); // Memuat variabel environment dari file .env

export interface Product {
  name: string;
  category: string; // Tambahkan field category
  brand: string;
  normal_price: number;
}

export const fetchProducts = async (): Promise<Product[]> => {
  const apiUrl = `${process.env.PUBLIC_URL}/api/products`;
  // console.log(`[fetchProducts] Attempting to fetch products from: ${apiUrl}`);
  try {
    const res = await axios.get<Product[]>(apiUrl);
    // console.log(`[fetchProducts] Successfully fetched ${res.data.length} products.`);
    return res.data;
  } catch (error) {
    console.error(`[fetchProducts] Error fetching products from ${apiUrl}:`);
    // Mencetak detail error dari axios jika tersedia
    if (axios.isAxiosError(error)) {
      console.error('[fetchProducts] Axios error details:', { message: error.message, code: error.code, config: error.config?.url, responseStatus: error.response?.status, responseData: error.response?.data });
    } else {
      console.error('[fetchProducts] Non-Axios error:', error);
    }
    throw error; // Lempar kembali error agar bisa ditangkap oleh pemanggil (fungsi execute)
  }
};
