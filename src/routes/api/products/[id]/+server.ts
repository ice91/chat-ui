// src/routes/api/products/[id]/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private";
import { verifyJWT } from "$lib/server/auth";
import { collections } from "$lib/server/database";

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
	try {
		const productId = new ObjectId(params.id);

		const token = cookies.get("jwt");
		if (!token) {
			return json({ error: "未授权" }, { status: 401 });
		}

		const jwtSecret = env.JWT_SECRET;
		const decoded = verifyJWT(token, jwtSecret);

		if (!decoded.roles.includes("seller")) {
			return json({ error: "禁止访问" }, { status: 403 });
		}

		const userId = new ObjectId(decoded.userId);

		const data = await request.json();

		console.log("edit product");
		console.log(userId);
		// 获取要更新的产品
		const existingProduct = await collections.products.findOne({ _id: productId, userId });
		if (!existingProduct) {
			return json({ error: "产品未找到或无权限" }, { status: 404 });
		}

		// 更新本地产品记录
		const updateData: Partial<Product> = {
			...data,
			updatedAt: new Date(),
		};

		const result = await collections.products.updateOne(
			{ _id: productId, userId },
			{ $set: updateData }
		);

		if (result.matchedCount === 0) {
			return json({ error: "产品未找到或无权限" }, { status: 404 });
		}

		return json({ message: "产品更新成功" }, { status: 200 });
	} catch (error) {
		console.error("更新产品时出错：", error);
		return json({ error: "内部服务器错误" }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	try {
		const productId = new ObjectId(params.id);

		const token = cookies.get("jwt");
		if (!token) {
			return json({ error: "未授权" }, { status: 401 });
		}

		const jwtSecret = env.JWT_SECRET;
		const decoded = verifyJWT(token, jwtSecret);

		if (!decoded.roles.includes("seller")) {
			return json({ error: "禁止访问" }, { status: 403 });
		}

		const userId = new ObjectId(decoded.userId);

		// 查找要删除的产品
		const existingProduct = await collections.products.findOne({ _id: productId, userId });
		if (!existingProduct) {
			return json({ error: "产品未找到或无权限" }, { status: 404 });
		}

		// 根据供应商删除产品（可选实现）
		// 例如，如果使用 Gelato 或 Shopify API 删除产品，可以在此处调用相应的删除方法

		// 删除本地产品记录
		const result = await collections.products.deleteOne({ _id: productId, userId });

		if (result.deletedCount === 0) {
			return json({ error: "删除产品失败" }, { status: 500 });
		}

		return json({ message: "产品删除成功" }, { status: 200 });
	} catch (error) {
		console.error("删除产品时出错：", error);
		return json({ error: "内部服务器错误" }, { status: 500 });
	}
};
