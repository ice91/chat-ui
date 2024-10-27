// src/routes/api/orders/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private";
import { verifyJWT } from "$lib/server/auth";
import { collections } from "$lib/server/database";

export const GET: RequestHandler = async ({ request, cookies }) => {
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

		console.log("query order");
		console.log(userId);
		// 获取分页参数
		const url = new URL(request.url);
		const page = parseInt(url.searchParams.get("page") || "1");
		const limit = parseInt(url.searchParams.get("limit") || "10");
		const offset = (page - 1) * limit;

		// 查询用户的订单
		const orders = await collections.orders.find({ userId }).skip(offset).limit(limit).toArray();
		const total = await collections.orders.countDocuments({ userId });

		return json({ orders, total }, { status: 200 });
	} catch (error) {
		console.error("获取订单列表时出错：", error);
		return json({ error: "内部服务器错误" }, { status: 500 });
	}
};
