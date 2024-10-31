// src/routes/api/orders/mine/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import pkg from "jsonwebtoken";
const { verify } = pkg;
import { collections } from "$lib/server/database";
import { env } from "$env/dynamic/private";
import { ObjectId } from "mongodb";

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		// 获取 JWT 令牌
		const token = cookies.get("jwt");
		if (!token) {
			return new Response(JSON.stringify({ error: "未授权" }), { status: 401 });
		}

		const jwtSecret = env.JWT_SECRET;
		if (!jwtSecret) {
			console.error("JWT_SECRET is not defined in environment variables.");
			return new Response(JSON.stringify({ error: "未配置 JWT 密钥" }), { status: 500 });
		}

		// 验证 JWT
		let decoded: { userId: string; roles: string[] };
		try {
			decoded = verify(token, jwtSecret) as { userId: string; roles: string[] };
		} catch (err) {
			console.error("JWT verification failed:", err);
			return new Response(JSON.stringify({ error: "无效的令牌" }), { status: 401 });
		}

		// 检查用户是否具有 'seller' 角色
		if (!decoded.roles || !decoded.roles.includes("seller")) {
			console.error("User does not have 'seller' role.");
			return new Response(JSON.stringify({ error: "无访问权限" }), { status: 403 });
		}

		const sellerId = new ObjectId(decoded.userId);

		// 获取订单列表
		const orders = await collections.orders.find({ sellerId }).toArray();

		return new Response(JSON.stringify({ orders }), { status: 200 });
	} catch (err) {
		console.error("Error in /api/orders/mine:", err);
		return new Response(JSON.stringify({ error: "内部服务器错误" }), { status: 500 });
	}
};
