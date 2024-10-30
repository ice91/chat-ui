// src/routes/api/products/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private";
import { verifyJWT } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { createProductOnGelato } from "$lib/server/gelato";
import { uploadFileToGCS } from "$lib/server/files/uploadFileToGCS";

/**
 * 處理產品創建的 POST 請求
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get(env.COOKIE_NAME);
		if (!token) {
			return json({ error: "未授權" }, { status: 401 });
		}

		const jwtSecret = env.JWT_SECRET;
		const decoded = verifyJWT(token, jwtSecret);

		if (!decoded.roles.includes("seller")) {
			return json({ error: "禁止訪問" }, { status: 403 });
		}

		const sellerId = decoded.userId; // 假設 userId 是賣家的唯一標識

		// 解析 multipart/form-data
		const formData = await request.formData();
		const title = formData.get("title") as string;
		const price = parseFloat(formData.get("price") as string);
		const description = formData.get("description") as string;
		const templateId = formData.get("templateId") as string;
		const tags = formData.get("tags") ? JSON.parse(formData.get("tags") as string) : [];
		const categoryIds = formData.get("categoryIds")
			? JSON.parse(formData.get("categoryIds") as string)
			: [];

		// 驗證必填字段
		if (!title || !price || !templateId) {
			return json({ error: "標題、價格和模板ID為必填項" }, { status: 400 });
		}

		// 處理圖片上傳
		const files: File[] = [];
		formData.forEach((value, key) => {
			if (key.startsWith("images[")) {
				const file = value as File;
				if (file) files.push(file);
			}
		});

		const imageUrls: string[] = [];
		for (const file of files) {
			const imageUrl = await uploadFileToGCS(file, sellerId);
			imageUrls.push(imageUrl);
		}

		// 在 Gelato 上創建產品
		const providerResponse = await createProductOnGelato({
			title,
			price,
			description,
			templateId,
			images: imageUrls,
			tags,
			categoryIds,
		});

		// 創建本地產品記錄
		const product = {
			userId: new ObjectId(sellerId),
			title,
			description: description || "",
			images: imageUrls,
			price,
			provider: "Gelato",
			providerProductId: providerResponse.productUid,
			shopifyProductId: providerResponse.shopifyProductId, // 假設返回了 Shopify 的產品 ID
			productType: formData.get("productType") || "Unknown",
			variants: formData.get("variants") ? JSON.parse(formData.get("variants") as string) : [],
			tags,
			categories: categoryIds ? categoryIds.map((id: string) => new ObjectId(id)) : [],
			status: "published",
			createdAt: new Date(),
			updatedAt: new Date(),
			expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 例如：30天後自動刪除
		};

		const result = await collections.products.insertOne(product);

		return json({ message: "產品創建成功", productId: result.insertedId }, { status: 201 });
	} catch (error) {
		console.error("創建產品時出錯：", error);
		return json({ error: "內部伺服器錯誤" }, { status: 500 });
	}
};
