// src/routes/api/auth/seller/user/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import pkg from "jsonwebtoken";
const { verify } = pkg;
import { collections } from "$lib/server/database";
import { env } from "$env/dynamic/private";
import { ObjectId } from "mongodb";

export const GET: RequestHandler = async ({ request, cookies }) => {
	try {
		// 日志：处理程序被调用
		console.log("Handler for /api/auth/seller/user invoked");

		// 确认 cookies 是否被正确解构
		if (!cookies) {
			console.error("Cookies are undefined");
			return new Response(
				JSON.stringify({ error: "Internal Server Error: Cookies are undefined" }),
				{ status: 500 }
			);
		}

		// 获取 Authorization 头
		const authHeader = request.headers.get("Authorization");
		console.log("Authorization header:", authHeader);

		// 从 Authorization 头或 Cookie 中获取 JWT
		const token = authHeader?.split(" ")[1] || cookies.get("jwt");
		console.log("JWT token:", token);

		if (!token) {
			console.error("No token provided in Authorization header or cookies.");
			return new Response(JSON.stringify({ error: "未授权" }), { status: 401 });
		}

		const jwtSecret = env.JWT_SECRET;
		if (!jwtSecret) {
			console.error("JWT_SECRET is not defined in environment variables.");
			return new Response(JSON.stringify({ error: "未配置 JWT 密钥" }), { status: 500 });
		}

		let decoded: { userId: string; roles: string[] };
		try {
			decoded = verify(token, jwtSecret) as { userId: string; roles: string[] };
			console.log("Decoded JWT:", decoded);
		} catch (err) {
			console.error("JWT verification failed:", err);
			return new Response(JSON.stringify({ error: "无效的令牌" }), { status: 401 });
		}

		if (!decoded.roles || !decoded.roles.includes("seller")) {
			console.error("User does not have 'seller' role.");
			return new Response(JSON.stringify({ error: "无访问权限" }), { status: 403 });
		}

		let objectId: ObjectId;
		try {
			objectId = new ObjectId(decoded.userId);
		} catch (err) {
			console.error("Invalid userId in JWT:", err);
			return new Response(JSON.stringify({ error: "无效的用户 ID" }), { status: 400 });
		}

		const user = await collections.users.findOne({ _id: objectId });

		if (!user) {
			console.error("User not found for userId:", decoded.userId);
			return new Response(JSON.stringify({ error: "用户未找到" }), { status: 404 });
		}

		// 返回用户数据
		const userData = {
			id: user._id.toString(),
			username: user.username,
			name: user.name,
			email: user.email,
			avatarUrl: user.avatarUrl || null,
			points: user.points,
			code: user.referralCode,
			roles: user.roles,
			// 根据需要添加更多字段
		};

		console.log("User data fetched successfully:", userData);

		return new Response(JSON.stringify({ user: userData }), { status: 200 });
	} catch (err) {
		console.error("Unhandled error in /api/auth/seller/user:", err);
		return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
	}
};
