// src/lib/server/gelato.ts

import axios from "axios";
import { env } from "$env/dynamic/private";
import type { CreateProductData, CreateProductResponse } from "../providers/ProviderInterface";

const GELATO_API_BASE_URL = "https://ecommerce.gelatoapis.com/v1";
const GELATO_API_KEY = env.GELATO_API_KEY;
const GELATO_STORE_ID = env.GELATO_STORE_ID;

// 创建 Gelato API 客户端
const gelatoClient = axios.create({
	baseURL: GELATO_API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
		"X-API-KEY": GELATO_API_KEY,
	},
});

// 创建产品的函数
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
				isVisibleInTheOnlineStore: data.isVisibleInTheOnlineStore || false,
				salesChannels: data.salesChannels || ["web"],
				tags: data.tags || [],
				variants: data.variants,
				productType: data.productType || "Printable Material",
				vendor: data.vendor || "Gelato",
			}
		);

		// 返回完整的响应数据
		return response.data as CreateProductResponse;
	} catch (error) {
		console.error("在 Gelato 创建产品时出错：", error.response?.data || error.message);
		throw new Error("无法在 Gelato 上创建产品");
	}
}
