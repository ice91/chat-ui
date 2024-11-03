// src/lib/server/gelato.ts

import axios from "axios";
import { env } from "$env/dynamic/private";
import type {
	CreateProductData,
	CreateProductResponse,
	GetProductResponse,
} from "../providers/ProviderInterface";

const GELATO_API_BASE_URL = "https://ecommerce.gelatoapis.com/v1";
const GELATO_API_KEY = env.GELATO_API_KEY;
const GELATO_STORE_ID = env.GELATO_STORE_ID;

// 創建 Gelato API 客戶端
const gelatoClient = axios.create({
	baseURL: GELATO_API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
		"X-API-KEY": GELATO_API_KEY,
	},
});

// 創建產品的函數
export async function createProductOnGelato(
	data: CreateProductData
): Promise<CreateProductResponse> {
	try {
		const response = await gelatoClient.post(
			`/stores/${GELATO_STORE_ID}/products:create-from-template`,
			{
				templateId: data.templateId,
				title: data.title,
				description: data.description,
				isVisibleInTheOnlineStore: data.isVisibleInTheOnlineStore || true,
				salesChannels: data.salesChannels || ["web"],
				tags: data.tags || [],
				variants: data.variants,
				productType: data.productType || "Printable Material",
				vendor: data.vendor || "Gelato",
				// 移除 metadata 字段
			}
		);

		// 返回完整的響應數據
		return response.data as CreateProductResponse;
	} catch (error) {
		console.error("在 Gelato 創建產品時出錯：", error.response?.data || error.message);
		throw new Error("無法在 Gelato 上創建產品");
	}
}

// 獲取產品的函數
export async function getProductFromGelato(storeProductId: string): Promise<GetProductResponse> {
	try {
		const response = await gelatoClient.get(
			`/stores/${GELATO_STORE_ID}/products/${storeProductId}`
		);
		return response.data as GetProductResponse;
	} catch (error) {
		console.error("在 Gelato 獲取產品時出錯：", error.response?.data || error.message);
		throw new Error("無法在 Gelato 上獲取產品");
	}
}
