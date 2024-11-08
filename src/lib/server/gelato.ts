// src/lib/server/gelato.ts

import axios from "axios";
import { env } from "$env/dynamic/private";
import type {
	CreateProductData,
	CreateProductResponse,
	GetProductResponse,
} from "../providers/ProviderInterface";
import type { ProductTemplate, VariantObject } from "$lib/types/ProductTemplate";
import { ObjectId } from "mongodb";

const GELATO_API_BASE_URL = "https://ecommerce.gelatoapis.com/v1";
const GELATO_API_KEY = env.GELATO_API_KEY;
const GELATO_STORE_ID = env.GELATO_STORE_ID;

const gelatoClient = axios.create({
	baseURL: GELATO_API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
		"X-API-KEY": GELATO_API_KEY,
	},
});

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
				isVisibleInTheOnlineStore: data.isVisibleInTheOnlineStore ?? true,
				salesChannels: data.salesChannels ?? ["web"],
				tags: data.tags ?? [],
				variants: data.variants,
				productType: data.productType ?? "Printable Material",
				vendor: data.vendor ?? "Gelato",
			}
		);

		return response.data as CreateProductResponse;
	} catch (error: unknown) {
		if (axios.isAxiosError(error) && error.response) {
			console.error("在 Gelato 創建產品時出錯：", error.response.data);
			throw new Error("無法在 Gelato 上創建產品");
		} else {
			throw new Error(error instanceof Error ? error.message : "未知錯誤");
		}
	}
}

export async function getProductFromGelato(storeProductId: string): Promise<GetProductResponse> {
	try {
		const response = await gelatoClient.get(
			`/stores/${GELATO_STORE_ID}/products/${storeProductId}`
		);
		return response.data as GetProductResponse;
	} catch (error: unknown) {
		if (axios.isAxiosError(error) && error.response) {
			console.error("在 Gelato 獲取產品時出錯：", error.response.data);
			throw new Error("無法在 Gelato 上獲取產品");
		} else {
			throw new Error(error instanceof Error ? error.message : "未知錯誤");
		}
	}
}

export async function getTemplateFromGelato(templateId: string): Promise<ProductTemplate> {
	try {
		const response = await gelatoClient.get(`/templates/${templateId}`);
		const templateData = response.data;

		const template: ProductTemplate = {
			_id: new ObjectId(),
			templateId: templateData.id,
			templateName: templateData.templateName,
			title: templateData.title,
			description: templateData.description,
			previewUrl: templateData.previewUrl,
			productType: templateData.productType,
			vendor: templateData.vendor,
			variants: templateData.variants.map((variant: VariantObject) => ({
				id: variant.id,
				title: variant.title,
				productUid: variant.productUid,
				variantOptions: variant.variantOptions,
				imagePlaceholders: variant.imagePlaceholders,
				textPlaceholders: variant.textPlaceholders || [],
			})),
			createdAt: new Date(templateData.createdAt),
			updatedAt: new Date(templateData.updatedAt),
		};

		return template;
	} catch (error: unknown) {
		if (axios.isAxiosError(error) && error.response) {
			console.error("在 Gelato 獲取模板時出錯：", error.response.data);
			throw new Error("無法在 Gelato 上獲取模板");
		} else {
			throw new Error(error instanceof Error ? error.message : "未知錯誤");
		}
	}
}
