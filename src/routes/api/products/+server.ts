// src/routes/api/products/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private";
import { verifyJWT } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { createProductOnShopify } from "$lib/server/shopify";
import { createProductOnGelato } from "$lib/server/gelato";
import uploadFileToGCS from "$lib/server/files/uploadFileToGCS"; // 引入上傳函數
import type { Product, VariantObject } from "$lib/types/Product"; // 移除未使用的類型

/**
 * 處理產品創建的 POST 請求
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get(env.COOKIE_NAME);
		console.log("創建產品時獲取的 token:", token);
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
		//const price = parseFloat(formData.get("price") as string);
		const description = formData.get("description") as string;
		const templateId = formData.get("templateId") as string;
		const tags = formData.get("tags") ? JSON.parse(formData.get("tags") as string) : [];
		const categoryIds = formData.get("categoryIds")
			? JSON.parse(formData.get("categoryIds") as string)
			: [];
		const productType = (formData.get("productType") as string) || "Unknown";

		console.log("templateId:", templateId);
		// 驗證必填字段
		if (!title || !templateId) {
			return json({ error: "標題和模板 ID 為必填項" }, { status: 400 });
		}

		// 從資料庫中獲取模板資料
		const template = await collections.productTemplates.findOne({ templateId });

		if (!template) {
			return json({ error: "無效的模板 ID" }, { status: 400 });
		}

		// 處理圖片上傳
		const imageFiles: Record<string, File> = {};
		formData.forEach((value, key) => {
			if (key.startsWith("images[")) {
				const file = value as File;
				if (file) {
					// 從鍵名中提取佔位符名稱，例如 images[FrontImage]
					const match = /images\[(.+)\]/.exec(key);
					if (match && match[1]) {
						const placeholderName = match[1];
						imageFiles[placeholderName] = file;
						console.log(`找到圖片佔位符 "${placeholderName}" 對應的文件: ${file.name}`);
					}
				}
			}
		});

		// 檢查是否所有佔位符都有對應的圖片
		for (const variant of template.variants) {
			for (const placeholder of variant.imagePlaceholders) {
				if (!imageFiles[placeholder.name]) {
					throw new Error(`缺少佔位符 "${placeholder.name}" 的圖片文件。`);
				}
			}
		}

		// 將圖片上傳並獲取 URL
		const imageUrls: Record<string, string> = {};
		for (const placeholderName in imageFiles) {
			const file = imageFiles[placeholderName];
			const imageUrl = await uploadFileToGCS(file, sellerId);
			console.log(`上傳圖片佔位符 "${placeholderName}"，獲取的 URL：${imageUrl}`);
			imageUrls[placeholderName] = imageUrl;
		}

		// 準備 Gelato API 的變體資料
		const gelatoVariants: VariantObject[] = template.variants.map((variant) => ({
			templateVariantId: variant.id,
			imagePlaceholders: variant.imagePlaceholders.map((placeholder) => {
				const fileUrl = imageUrls[placeholder.name];
				if (!fileUrl) {
					throw new Error(`缺少佔位符 "${placeholder.name}" 的圖片文件。`);
				}
				return {
					name: placeholder.name,
					fileUrl,
				};
			}),
			// 如果需要，添加 textPlaceholders
		}));

		console.log("構建的 gelatoVariants：", JSON.stringify(gelatoVariants, null, 2));

		// 在 Gelato 上創建產品
		const providerResponse = await createProductOnGelato({
			templateId,
			title,
			description,
			isVisibleInTheOnlineStore: true,
			salesChannels: ["web"],
			tags,
			variants: gelatoVariants,
			productType,
			vendor: template.vendor || "Gelato",
		});

		// 準備 Shopify 產品數據
		const shopifyProductData: Product = {
			title,
			body_html: description || "",
			vendor: template.vendor || "Gelato",
			product_type: productType,
			tags: tags.join(", "),
			images: Object.values(imageUrls).map((url) => ({ src: url })),
			variants: gelatoVariants.map((variant) => ({
				price: "0.00", // 根據您的需求設置價格
				sku: variant.templateVariantId,
				option1: variant.templateVariantId, // 或其他適當的選項
			})),
		};

		// 在 Shopify 創建產品並發布到 Hydrogen 商店
		const createdShopifyProduct = await createProductOnShopify(shopifyProductData);

		// 創建本地產品記錄
		const newProduct: Product = {
			_id: new ObjectId(),
			userId: new ObjectId(sellerId),
			title,
			description: description || "",
			images: Object.values(imageUrls),
			provider: "Gelato",
			productType,
			templateId,
			variants: gelatoVariants,
			tags,
			categories: categoryIds ? categoryIds.map((id: string) => new ObjectId(id)) : [],
			status: "active", // 因為已經發布
			createdAt: new Date(),
			updatedAt: new Date(),
			providerProductId: providerResponse.id, // Gelato 的 storeProductId
			shopifyProductId: createdShopifyProduct.id, // Shopify 的 product ID
			handle: createdShopifyProduct.handle, // Shopify 的產品 handle
		};

		// 保存產品到資料庫
		await collections.products.insertOne(newProduct);

		return json({ message: "產品創建並發布成功" }, { status: 201 });
	} catch (error: unknown) {
		// 使用 unknown 代替 any，並進行類型檢查
		console.error("創建產品時出錯：", error instanceof Error ? error.message : "未知錯誤");
		return json(
			{ error: error instanceof Error ? error.message : "內部伺服器錯誤" },
			{ status: 500 }
		);
	}
};
