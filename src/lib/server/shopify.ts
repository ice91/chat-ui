// src/lib/server/shopify.ts

import axios from "axios";
import { env } from "$env/dynamic/private";
import type { Product } from "$lib/types/Product";

const shopifyApiVersion = "2024-01";
const shopifyBaseUrl = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${shopifyApiVersion}`;

/**
 * 在 Shopify 上創建產品
 * @param productData 產品數據
 * @returns Shopify 的產品創建回應
 */
export async function createProductOnShopify(productData: Product) {
	try {
		const response = await axios.post(
			`${shopifyBaseUrl}/products.json`,
			{ product: productData },
			{
				headers: {
					"Content-Type": "application/json",
					"X-Shopify-Access-Token": env.SHOPIFY_ACCESS_TOKEN,
				},
			}
		);

		return response.data.product;
	} catch (error) {
		console.error("在 Shopify 創建產品時出錯：", error.response?.data || error.message);
		throw error;
	}
}

/**
 * 在 Shopify 上更新產品
 * @param productId Shopify 的產品 ID
 * @param productData 更新的產品數據
 * @returns Shopify 的產品更新回應
 */
export async function updateProductOnShopify(productId: string, productData: Product) {
	try {
		const response = await axios.put(
			`${shopifyBaseUrl}/products/${productId}.json`,
			{ product: productData },
			{
				headers: {
					"Content-Type": "application/json",
					"X-Shopify-Access-Token": env.SHOPIFY_ACCESS_TOKEN,
				},
			}
		);

		return response.data.product;
	} catch (error) {
		console.error("更新 Shopify 產品時出錯：", error.response?.data || error.message);
		throw error;
	}
}

/**
 * 在 Shopify 上刪除產品
 * @param productId Shopify 的產品 ID
 */
export async function deleteProductOnShopify(productId: string) {
	try {
		await axios.delete(`${shopifyBaseUrl}/products/${productId}.json`, {
			headers: {
				"X-Shopify-Access-Token": env.SHOPIFY_ACCESS_TOKEN,
			},
		});
	} catch (error) {
		console.error("刪除 Shopify 產品時出錯：", error.response?.data || error.message);
		throw error;
	}
}

export async function getShopifyProductHandle(productId: string): Promise<string> {
	const shopifyAdminUrl = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-07/graphql.json`;
	const accessToken = env.SHOPIFY_ACCESS_TOKEN;

	const query = `
	  query getProduct($id: ID!) {
		product(id: $id) {
		  handle
		}
	  }
	`;

	const variables = {
		id: `gid://shopify/Product/${productId}`,
	};

	const response = await axios.post(
		shopifyAdminUrl,
		{ query, variables },
		{
			headers: {
				"Content-Type": "application/json",
				"X-Shopify-Access-Token": accessToken,
			},
		}
	);

	if (response.data.errors) {
		throw new Error(`Shopify API 錯誤：${response.data.errors[0].message}`);
	}

	const handle = response.data.data.product.handle;
	if (!handle) {
		throw new Error("未能獲取產品的 handle");
	}

	return handle;
}
