// src/routes/api/products/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private";
import { verifyJWT } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { createProductOnGelato } from "$lib/server/gelato";

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		// 获取 JWT Token
		const token = cookies.get("jwt");
		if (!token) {
			return json({ error: "未授权" }, { status: 401 });
		}

		// 验证 JWT
		const jwtSecret = env.JWT_SECRET;
		const decoded = verifyJWT(token, jwtSecret);

		if (!decoded.roles.includes("user")) {
			return json({ error: "禁止访问" }, { status: 403 });
		}

		const userId = new ObjectId(decoded.userId);

		const data = await request.json();

		// 基本数据验证
		if (!data.title || !data.price || !data.templateId) {
			return json({ error: "标题、价格和模板ID为必填项" }, { status: 400 });
		}

		// 在 Gelato 上创建产品
		const providerResponse = await createProductOnGelato(data);

		// 创建本地产品记录
		const product = {
			userId,
			title: data.title,
			description: data.description || "",
			images: data.images || [],
			price: data.price,
			provider: "Gelato",
			providerProductId: providerResponse.productUid,
			shopifyProductId: providerResponse.shopifyProductId, // 假设返回了 Shopify 的产品 ID
			productType: data.productType || "Unknown",
			variants: data.variants || [],
			tags: data.tags || [],
			categories: data.categoryIds ? data.categoryIds.map((id: string) => new ObjectId(id)) : [],
			status: "published",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const result = await collections.products.insertOne(product);

		return json({ message: "产品创建成功", productId: result.insertedId }, { status: 201 });
	} catch (error) {
		console.error("创建产品时出错：", error);
		return json({ error: "内部服务器错误" }, { status: 500 });
	}
};
