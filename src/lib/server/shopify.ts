// src/lib/server/shopify.ts

import axios from "axios";
import { env } from "$env/dynamic/private";
import type { Product } from "$lib/types/Product";

const shopifyApiVersion = "2024-10";
const shopifyAdminUrl = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${shopifyApiVersion}/graphql.json`;
const accessToken = env.SHOPIFY_ACCESS_TOKEN;

let hydrogenPublicationIds: string[] | null = null;

/**
 * 定義 Shopify Publication 的結構
 */
interface PublicationNode {
	id: string;
	name: string;
}

/**
 * 定義 Shopify GraphQL 查詢返回的 publications 結構
 */
interface PublicationsResponse {
	data: {
		publications: {
			edges: {
				node: PublicationNode;
			}[];
		};
	};
	errors?: Array<{
		message: string;
	}>;
}

/**
 * 定義 Shopify GraphQL Mutation 返回的產品發布結構
 */
interface ProductPublishResponse {
	data: {
		productPublish: {
			product: {
				id: string;
			};
			userErrors: Array<{
				field: string[];
				message: string;
			}>;
		};
	};
	errors?: Array<{
		message: string;
	}>;
}

/**
 * 定義 Shopify GraphQL Mutation 返回的產品創建結構
 */
interface ProductCreateResponse {
	data: {
		productCreate: {
			product: {
				id: string;
				handle: string;
			};
			userErrors: Array<{
				field: string[];
				message: string;
			}>;
		};
	};
	errors?: Array<{
		message: string;
	}>;
}

/**
 * 定義 Shopify GraphQL Mutation 返回的產品更新結構
 */
interface ProductUpdateResponse {
	data: {
		productUpdate: {
			product: {
				id: string;
				handle: string;
			};
			userErrors: Array<{
				field: string[];
				message: string;
			}>;
		};
	};
	errors?: Array<{
		message: string;
	}>;
}

/**
 * 定義 Shopify GraphQL Mutation 返回的產品刪除結構
 */
interface ProductDeleteResponse {
	data: {
		productDelete: {
			deletedProductId: string;
			userErrors: Array<{
				field: string[];
				message: string;
			}>;
		};
	};
	errors?: Array<{
		message: string;
	}>;
}

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
      publications(first: 50) { # 調整數量根據需要
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
		const response = await axios.post<PublicationsResponse>(
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
async function publishProductToHydrogenStore(productGID: string): Promise<void> {
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
		const response = await axios.post<ProductPublishResponse>(
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
 * 在 Shopify 上創建產品
 * @param productData 產品數據
 * @returns Shopify 的產品創建回應
 */
export async function createProductOnShopify(
	productData: Product
): Promise<{ id: string; handle: string }> {
	const mutation = `
    mutation createProduct($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

	const variables = {
		input: {
			title: productData.title,
			bodyHtml: productData.body_html,
			vendor: productData.vendor,
			productType: productData.product_type,
			tags: productData.tags.split(", ").filter((tag) => tag),
			images: productData.images.map((url: string) => ({ src: url })),
			variants: productData.variants.map((variant) => ({
				price: variant.price,
				sku: variant.sku,
				option1: variant.option1,
			})),
		},
	};

	try {
		const response = await axios.post<ProductCreateResponse>(
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
			console.error("創建產品時發生錯誤：", response.data.errors);
			throw new Error(`創建產品時發生錯誤：${response.data.errors[0].message}`);
		}

		const userErrors = response.data.data.productCreate.userErrors;
		if (userErrors.length > 0) {
			console.error("創建產品時的使用者錯誤：", userErrors);
			throw new Error(`創建產品時的使用者錯誤：${userErrors[0].message}`);
		}

		const createdProduct = response.data.data.productCreate.product;
		const productGID = createdProduct.id;

		// 將產品發布到 Hydrogen 商店
		await publishProductToHydrogenStore(productGID);

		console.log(`產品已成功創建並發布：${productGID}`);
		return {
			id: createdProduct.id,
			handle: createdProduct.handle,
		};
	} catch (error) {
		console.error("在 Shopify 創建產品時出錯：", (error as Error).message);
		throw error;
	}
}

/**
 * 在 Shopify 上更新產品
 * @param productId Shopify 的產品 ID
 * @param productData 更新的產品數據
 * @returns Shopify 的產品更新回應
 */
export async function updateProductOnShopify(
	productId: string,
	productData: Product
): Promise<{ id: string; handle: string }> {
	const mutation = `
    mutation updateProduct($id: ID!, $input: ProductInput!) {
      productUpdate(id: $id, input: $input) {
        product {
          id
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

	const variables = {
		id: productId,
		input: {
			title: productData.title,
			bodyHtml: productData.body_html,
			vendor: productData.vendor,
			productType: productData.product_type,
			tags: productData.tags.split(", ").filter((tag) => tag),
			images: productData.images.map((url: string) => ({ src: url })),
			variants: productData.variants.map((variant) => ({
				price: variant.price,
				sku: variant.sku,
				option1: variant.option1,
			})),
		},
	};

	try {
		const response = await axios.post<ProductUpdateResponse>(
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

		const updatedProduct = response.data.data.productUpdate.product;
		const productGID = updatedProduct.id;

		// 如果需要，可以再次發布產品到 Hydrogen 商店
		// await publishProductToHydrogenStore(productGID);

		console.log(`產品已成功更新：${productGID}`);
		return {
			id: updatedProduct.id,
			handle: updatedProduct.handle,
		};
	} catch (error) {
		console.error("在 Shopify 更新產品時出錯：", (error as Error).message);
		throw error;
	}
}

/**
 * 在 Shopify 上刪除產品
 * @param productId Shopify 的產品 ID
 */
export async function deleteProductOnShopify(productId: string): Promise<void> {
	const mutation = `
    mutation deleteProduct($id: ID!) {
      productDelete(id: $id) {
        deletedProductId
        userErrors {
          field
          message
        }
      }
    }
  `;

	const variables = {
		id: productId,
	};

	try {
		const response = await axios.post<ProductDeleteResponse>(
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

		console.log(`產品已成功刪除：${response.data.data.productDelete.deletedProductId}`);
	} catch (error) {
		console.error("在 Shopify 刪除產品時出錯：", (error as Error).message);
		throw error;
	}
}

/**
 * 獲取 Shopify 產品的 handle
 * @param productId Shopify 的產品 ID
 * @returns 產品的 handle
 */
export async function getShopifyProductHandle(productId: string): Promise<string> {
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
		const response = await axios.post<{
			data: { product: { handle: string } };
			errors?: Array<{ message: string }>;
		}>(
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
		console.error("在獲取產品 handle 時出錯：", (error as Error).message);
		throw error;
	}
}
