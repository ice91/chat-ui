// src/routes/api/seller/stats/+server.ts

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

		const userId = new ObjectId(decoded.userId);

		// 获取总销售额
		const totalSalesResult = await collections.orders
			.aggregate([
				{ $match: { sellerId: userId } },
				{ $group: { _id: null, totalSales: { $sum: "$totalAmount" } } },
			])
			.toArray();

		const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;

		// 获取总订单数
		const totalOrders = await collections.orders.countDocuments({ sellerId: userId });

		// 获取总产品数
		const totalProducts = await collections.products.countDocuments({ userId });

		// 返回统计数据
		const stats = {
			totalSales,
			totalOrders,
			totalProducts,
		};

		return new Response(JSON.stringify({ stats }), { status: 200 });
	} catch (err) {
		console.error("Error in /api/seller/stats:", err);
		return new Response(JSON.stringify({ error: "内部服务器错误" }), { status: 500 });
	}
};
