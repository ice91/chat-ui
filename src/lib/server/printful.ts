// src/lib/server/printful.ts

import axios from "axios";
import { env } from "$env/dynamic/private";
import type { CreateProductData, CreateProductResponse } from "../providers/ProviderInterface";

const PRINTFUL_API_BASE_URL = "https://api.printful.com";
const PRINTFUL_API_KEY = env.PRINTFUL_API_KEY;

// 創建 Printful API 客戶端
const printfulClient = axios.create({
	baseURL: PRINTFUL_API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
		Authorization: `Bearer ${PRINTFUL_API_KEY}`,
	},
});

// 創建產品的函數
export async function createProductOnPrintful(
	data: CreateProductData
): Promise<CreateProductResponse> {
	try {
		const response = await printfulClient.post(`/store/products`, {
			title: data.title,
			type: data.productType,
			template: {
				id: data.templateId,
			},
			variants: data.variants.map((variant) => ({
				variant_id: variant.templateVariantId,
				files: variant.imagePlaceholders.map((img) => ({
					type: img.name,
					url: img.fileUrl,
					fit_method: img.fitMethod || "slice",
				})),
			})),
			sync_product: true,
			visibility: data.isVisibleInTheOnlineStore ? "visible" : "draft",
			tags: data.tags || [],
		});

		return {
			id: response.data.result.id,
			// 根據 Printful 的回應填充其他字段
		};
	} catch (error) {
		console.error("在 Printful 創建產品時出錯：", error.response?.data || error.message);
		throw new Error("無法在 Printful 上創建產品");
	}
}
