// src/routes/api/products/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private";
import { verifyJWT } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import type { Product } from "$lib/types/Product";
import { ProviderFactory } from "$lib/providers/ProviderFactory";

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

		if (!decoded.roles.includes("seller")) {
			return json({ error: "禁止访问" }, { status: 403 });
		}

		const userId = new ObjectId(decoded.userId);

		// 获取请求体
		const data = await request.json();

		// 基本数据验证
		if (!data.title || !data.price || !data.provider || !data.templateId) {
			return json({ error: "标题、价格、供应商和模板ID为必填项" }, { status: 400 });
		}

		// 创建供应商实例
		const provider = ProviderFactory.createProvider(data.provider);

		// 调用供应商的 createProduct 方法
		const providerResponse = await provider.createProduct(data);

		// 创建本地产品记录
		const product: Omit<Product, "_id"> = {
			userId,
			title: data.title,
			description: data.description || "",
			images: data.images || [],
			price: data.price,
			stock: data.stock || 0,
			provider: data.provider,
			providerProductId: providerResponse.id,
			productType: data.productType || "Unknown",
			variants: data.variants || [],
			tags: data.tags || [],
			categoryIds: data.categoryIds ? data.categoryIds.map((id: string) => new ObjectId(id)) : [],
			createdAt: new Date(),
			updatedAt: new Date(),
			previewUrl: providerResponse.previewUrl,
			status: providerResponse.status,
		};

		const result = await collections.products.insertOne(product);

		return json({ message: "产品创建成功", productId: result.insertedId }, { status: 201 });
	} catch (error) {
		console.error("创建产品时出错：", error);
		return json({ error: "内部服务器错误" }, { status: 500 });
	}
};
