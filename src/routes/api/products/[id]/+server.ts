import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private";
import { verifyJWT } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { updateProductOnShopify, deleteProductOnShopify } from "$lib/server/shopify";
import uploadFileToGCS from "$lib/server/files/uploadFileToGCS";
import type { Product } from "$lib/types/Product";

export const GET: RequestHandler = async ({ params }) => {
	try {
		const productId = new ObjectId(params.id);

		// 從資料庫中查找產品
		const product = await collections.products.findOne({ _id: productId });

		if (!product) {
			return json({ error: "產品未找到" }, { status: 404 });
		}

		return json({ product }, { status: 200 });
	} catch (error) {
		console.error("獲取產品詳情時出錯：", error);
		return json({ error: "內部伺服器錯誤" }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
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

		// 解析 multipart/form-data
		const formData = await request.formData();
		const title = formData.get("title") as string;
		const price = parseFloat(formData.get("price") as string);
		const description = formData.get("description") as string;
		const tags = formData.get("tags") ? JSON.parse(formData.get("tags") as string) : [];
		const categoryIds = formData.get("categoryIds")
			? JSON.parse(formData.get("categoryIds") as string)
			: [];
		const existingImages = formData.getAll("existingImages") as string[];

		// 驗證必填字段
		if (!title || isNaN(price) || !description) {
			return json({ error: "標題、價格和描述為必填項" }, { status: 400 });
		}

		// 處理圖片上傳
		const newImages: string[] = [];

		// 處理新上傳的圖片
		const imageEntries = Array.from(formData.entries()).filter(([key]) =>
			key.startsWith("images[")
		);

		for (const [, value] of imageEntries) {
			const file = value as File;
			if (file && file.size > 0) {
				const imageUrl = await uploadFileToGCS(file, userId.toString());
				newImages.push(imageUrl);
			}
		}

		// 合併現有圖片和新上傳的圖片
		const updatedImages = [...existingImages, ...newImages];

		// 獲取要更新的產品
		const existingProduct = await collections.products.findOne({ _id: productId, userId });
		if (!existingProduct) {
			return json({ error: "產品未找到或無權限" }, { status: 404 });
		}

		// 更新 Shopify 產品
		const shopifyProductData = {
			title: title || existingProduct.title,
			body_html: description || existingProduct.description,
			vendor: existingProduct.provider,
			product_type: existingProduct.productType,
			tags: tags.length > 0 ? tags.join(", ") : existingProduct.tags?.join(", "),
			images: updatedImages.map((url: string) => ({ src: url })),
		};

		if (existingProduct.shopifyProductId) {
			await updateProductOnShopify(existingProduct.shopifyProductId, shopifyProductData);
		} else {
			return json({ error: "Shopify 產品 ID 不存在，無法更新產品" }, { status: 400 });
		}

		// 更新本地產品記錄
		const updateData: Partial<Product> = {
			title: title || existingProduct.title,
			description: description || existingProduct.description,
			images: updatedImages,
			price: price || existingProduct.price,
			productType: (formData.get("productType") as string) || existingProduct.productType,
			variants: formData.get("variants")
				? JSON.parse(formData.get("variants") as string)
				: existingProduct.variants,
			tags: tags.length > 0 ? tags : existingProduct.tags,
			categories:
				categoryIds.length > 0
					? categoryIds.map((id: string) => new ObjectId(id))
					: existingProduct.categories,
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
		return json({ error: error.message || "內部伺服器錯誤" }, { status: error.status || 500 });
	}
};

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
		return json({ error: error.message || "內部伺服器錯誤" }, { status: error.status || 500 });
	}
};
