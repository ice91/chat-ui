// src/routes/api/products/[id]/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private";
import { verifyJWT } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { updateProductOnShopify } from "$lib/server/shopify";

/**
 * 處理產品更新的 PUT 請求
 */
export const PUT: RequestHandler = async ({ params, request, cookies }) => {
	try {
		const productId = new ObjectId(params.id);

		const token = cookies.get(env.COOKIE_NAME);
		console.log("env.COOKIE_NAME:", env.COOKIE_NAME);
		console.log("JWT token:", token);
		if (!token) {
			return json({ error: "未授權" }, { status: 401 });
		}

		const jwtSecret = env.JWT_SECRET;
		const decoded = verifyJWT(token, jwtSecret);

		if (!decoded.roles.includes("seller")) {
			return json({ error: "禁止訪問" }, { status: 403 });
		}

		const userId = new ObjectId(decoded.userId);

		const data = await request.json();

		console.log("edit product");
		console.log(userId);
		// 獲取要更新的產品
		const existingProduct = await collections.products.findOne({ _id: productId, userId });
		if (!existingProduct) {
			return json({ error: "產品未找到或無權限" }, { status: 404 });
		}

		// 更新 Shopify 產品
		const shopifyProductData = {
			title: data.title || existingProduct.title,
			body_html: data.description || existingProduct.description,
			vendor: data.vendor || existingProduct.provider,
			product_type: data.productType || existingProduct.productType,
			tags: data.tags ? data.tags.join(", ") : existingProduct.tags?.join(", "),
			images: data.images
				? data.images.map((url: string) => ({ src: url }))
				: existingProduct.images.map((url: string) => ({ src: url })),
		};

		if (existingProduct.shopifyProductId) {
			await updateProductOnShopify(existingProduct.shopifyProductId, shopifyProductData);
		} else {
			return json({ error: "Shopify 產品 ID 不存在，無法更新產品" }, { status: 400 });
		}

		// 更新本地產品記錄
		const updateData: Partial<Product> = {
			...data,
			updatedAt: new Date(),
		};

		const result = await collections.products.updateOne(
			{ _id: productId, userId },
			{ $set: updateData }
		);

		if (result.matchedCount === 0) {
			return json({ error: "產品未找到或無權限" }, { status: 404 });
		}

		return json({ message: "產品更新成功" }, { status: 200 });
	} catch (error) {
		console.error("更新產品時出錯：", error);
		return json({ error: "內部伺服器錯誤" }, { status: 500 });
	}
};

/**
 * 處理產品刪除的 DELETE 請求
 */
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	try {
		const productId = new ObjectId(params.id);

		const token = cookies.get(env.COOKIE_NAME);
		if (!token) {
			return json({ error: "未授權" }, { status: 401 });
		}

		const jwtSecret = env.JWT_SECRET;
		const decoded = verifyJWT(token, jwtSecret);

		if (!decoded.roles.includes("seller")) {
			return json({ error: "禁止訪問" }, { status: 403 });
		}

		const userId = new ObjectId(decoded.userId);

		// 查找要刪除的產品
		const existingProduct = await collections.products.findOne({ _id: productId, userId });
		if (!existingProduct) {
			return json({ error: "產品未找到或無權限" }, { status: 404 });
		}

		// 刪除 Shopify 產品
		if (existingProduct.shopifyProductId) {
			await deleteProductOnShopify(existingProduct.shopifyProductId);
		} else {
			return json({ error: "Shopify 產品 ID 不存在，無法刪除產品" }, { status: 400 });
		}

		// 刪除本地產品記錄
		const result = await collections.products.deleteOne({ _id: productId, userId });

		if (result.deletedCount === 0) {
			return json({ error: "刪除產品失敗" }, { status: 500 });
		}

		return json({ message: "產品刪除成功" }, { status: 200 });
	} catch (error) {
		console.error("刪除產品時出錯：", error);
		return json({ error: "內部伺服器錯誤" }, { status: 500 });
	}
};
