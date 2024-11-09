// src/lib/server/shopify.ts

import axios from "axios";
import { env } from "$env/dynamic/private";
import type { Product } from "$lib/types/Product";

const shopifyApiVersion = "2024-10";
const shopifyBaseUrl = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${shopifyApiVersion}`;

let hydrogenPublicationIds: string[] | null = null;

/**
 * 獲取 Hydrogen 店面的所有 publicationIds，並緩存
 * @returns Hydrogen 店面的 publicationIds
 */
async function getHydrogenPublicationIds(): Promise<string[]> {
	const shopifyAdminUrl = `${shopifyBaseUrl}/graphql.json`;
	const accessToken = env.SHOPIFY_ACCESS_TOKEN;
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
			shopifyAdminUrl,
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
	const shopifyAdminUrl = `${shopifyBaseUrl}/graphql.json`;
	const accessToken = env.SHOPIFY_ACCESS_TOKEN;
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
			shopifyAdminUrl,
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
 * 建立更新產品的 GraphQL 輸入物件，只包含有列出的欄位
 * @param productData 要更新的產品數據
 * @returns 更新產品的輸入物件
 */
function buildProductUpdateInput(productData: Product) {
	const input = {
		id: `gid://shopify/Product/${productData.shopifyProductId}`, // 使用 shopifyProductId 作為 GID
	};

	// 動態添加需要更新的欄位
	if (productData.title) {
		input.title = productData.title;
	}

	if (productData.description) {
		input.descriptionHtml = productData.description;
	}

	if (productData.productType) {
		input.productType = productData.productType;
	}

	if (productData.tags) {
		input.tags = productData.tags.join(", "); // Shopify 的 tags 需要以逗號分隔的字串
	}

	return input;
}

/**
 * 在 Shopify 上更新產品
 * @param productId Shopify 的產品 ID
 * @param productData 更新的產品數據
 * @returns Shopify 的產品更新回應
 */
export async function updateProductOnShopify(productId: string, productData: Product) {
	const shopifyAdminUrl = `${shopifyBaseUrl}/graphql.json`;
	const accessToken = env.SHOPIFY_ACCESS_TOKEN;

	// 建立只包含需要更新的欄位的輸入物件
	const input = buildProductUpdateInput(productData);

	const mutation = `
      mutation updateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            descriptionHtml
            productType
            tags
            # 根據需要添加更多字段
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

	const variables = {
		input,
	};

	try {
		const response = await axios.post(
			shopifyAdminUrl,
			{ query: mutation, variables },
			{
				headers: {
					"Content-Type": "application/json",
					"X-Shopify-Access-Token": accessToken,
				},
			}
		);

		if (response.data.errors) {
			console.error("更新產品時發生錯誤：", response.data.errors);
			throw new Error(`更新產品時發生錯誤：${response.data.errors[0].message}`);
		}

		const userErrors = response.data.data.productUpdate.userErrors;
		if (userErrors.length > 0) {
			console.error("更新產品時的使用者錯誤：", userErrors);
			throw new Error(`更新產品時的使用者錯誤：${userErrors[0].message}`);
		}

		console.log(`產品已成功更新：${productId}`);
		return response.data.data.productUpdate.product;
	} catch (error) {
		console.error("在更新 Shopify 產品時出錯：", (error as Error).message);
		throw error;
	}
}

/**
 * 在 Shopify 上刪除產品
 * @param productId Shopify 的產品 ID
 */
export async function deleteProductOnShopify(productId: string) {
	const shopifyAdminUrl = `${shopifyBaseUrl}/graphql.json`;
	const accessToken = env.SHOPIFY_ACCESS_TOKEN;

	const mutation = `
      mutation deleteProduct($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors {
            field
            message
          }
        }
      }
    `;

	const variables = {
		input: {
			id: `gid://shopify/Product/${productId}`,
		},
	};

	try {
		const response = await axios.post(
			shopifyAdminUrl,
			{ query: mutation, variables },
			{
				headers: {
					"Content-Type": "application/json",
					"X-Shopify-Access-Token": accessToken,
				},
			}
		);

		if (response.data.errors) {
			console.error("刪除產品時發生錯誤：", response.data.errors);
			throw new Error(`刪除產品時發生錯誤：${response.data.errors[0].message}`);
		}

		const userErrors = response.data.data.productDelete.userErrors;
		if (userErrors.length > 0) {
			console.error("刪除產品時的使用者錯誤：", userErrors);
			throw new Error(`刪除產品時的使用者錯誤：${userErrors[0].message}`);
		}

		console.log(`產品已成功刪除：${productId}`);
	} catch (error) {
		console.error("在刪除 Shopify 產品時出錯：", (error as Error).message);
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
