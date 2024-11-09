// src/lib/server/shopify.ts

import axios from "axios";
import { env } from "$env/dynamic/private";
import type { Product } from "$lib/types/Product";

const shopifyApiVersion = "2024-10";
const shopifyBaseUrl = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${shopifyApiVersion}`;

let hydrogenPublicationIds: string | null = null;

/**
 * 獲取 Hydrogen 店面的所有 publicationIds，並緩存
 * @returns Hydrogen 店面的 publicationIds
 */
async function getHydrogenPublicationIds(): Promise<string[]> {
	if (hydrogenPublicationIds) {
		return hydrogenPublicationIds;
	}

	const query = `
	  query {
		publications(first: 30) { # 調整數量根據需要
		  edges {
			node {
			  id
			  name
			}
		  }
		}
	  }
	`;

	try {
		const response = await axios.post(
			shopifyBaseUrl,
			{ query },
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

		const publications = response.data.data.publications.edges;
		const targetPublicationNames = ["CanvasTalk Art Store", "畫語空間"]; // 根據您的需求調整

		const hydrogenPublications = publications.filter((edge) =>
			targetPublicationNames.includes(edge.node.name)
		);

		if (hydrogenPublications.length === 0) {
			throw new Error("未能找到指定的 Hydrogen 商店的 publicationIds");
		}

		hydrogenPublicationIds = hydrogenPublications.map((pub) => pub.node.id);
		return hydrogenPublicationIds;
	} catch (error) {
		console.error("在獲取 Hydrogen publicationIds 時出錯：", (error as Error).message);
		throw error;
	}
}

/**
 * 將產品發布到 Hydrogen 商店
 * @param productGID 產品的全局 ID（GID）
 */
export async function publishProductToHydrogenStore(productGID: string): Promise<void> {
	// 獲取 Hydrogen 的所有 publicationIds
	const hydrogenPublicationIds = await getHydrogenPublicationIds();

	const mutation = `
	  mutation publishProduct($id: ID!, $productPublications: [ProductPublicationInput!]!) {
		productPublish(input: { id: $id, productPublications: $productPublications }) {
		  product {
			id
		  }
		  userErrors {
			field
			message
		  }
		}
	  }
	`;

	const variables = {
		id: productGID,
		productPublications: hydrogenPublicationIds.map((pubId) => ({
			publicationId: pubId,
		})),
	};

	try {
		const response = await axios.post(
			shopifyBaseUrl,
			{ query: mutation, variables },
			{
				headers: {
					"Content-Type": "application/json",
					"X-Shopify-Access-Token": accessToken,
				},
			}
		);

		if (response.data.errors) {
			console.error("發布產品時發生錯誤：", response.data.errors);
			throw new Error(`發布產品時發生錯誤：${response.data.errors[0].message}`);
		}

		const userErrors = response.data.data.productPublish.userErrors;
		if (userErrors.length > 0) {
			console.error("發布產品時的使用者錯誤：", userErrors);
			throw new Error(`發布產品時的使用者錯誤：${userErrors[0].message}`);
		}

		console.log(`產品已成功發布到 Hydrogen 商店：${productGID}`);
	} catch (error) {
		console.error("在發布產品到 Hydrogen 商店時出錯：", (error as Error).message);
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

/**
 * 獲取 Shopify 產品的 handle
 * @param productId Shopify 的產品 ID
 * @returns 產品的 handle
 */
export async function getShopifyProductHandle(productId: string): Promise<string> {
	const shopifyAdminUrl = `${shopifyBaseUrl}/graphql.json`;
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

	try {
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
	} catch (error) {
		console.error("在獲取產品 handle 時出錯：", error.response?.data || error.message);
		throw error;
	}
}
