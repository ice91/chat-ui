// src/routes/api/auth/seller/user/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { verify } from "jsonwebtoken";
import { collections } from "$lib/server/database";
import { env } from "$env/dynamic/private";
import { ObjectId } from "mongodb";
//import { error } from '@sveltejs/kit';
//import type { User } from '$lib/types/User';

export const GET: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get("Authorization");
	const token = authHeader?.split(" ")[1] || request.cookies.get("jwt");

	if (!token) {
		return new Response(JSON.stringify({ error: "未授权" }), { status: 401 });
	}

	const jwtSecret = env.JWT_SECRET;
	if (!jwtSecret) {
		return new Response(JSON.stringify({ error: "未配置JWT密钥" }), { status: 500 });
	}

	try {
		const decoded = verify(token, jwtSecret) as { userId: string; roles: string[] };

		if (!decoded.roles.includes("seller")) {
			return new Response(JSON.stringify({ error: "无访问权限" }), { status: 403 });
		}

		const user = await collections.users.findOne({ _id: new ObjectId(decoded.userId) });

		if (!user) {
			return new Response(JSON.stringify({ error: "用户未找到" }), { status: 404 });
		}

		// 返回用户数据
		const userData = {
			id: user._id.toString(),
			username: user.username,
			name: user.name,
			email: user.email,
			avatarUrl: user.avatarUrl || null,
			roles: user.roles,
			// 可根据需求添加更多字段
		};

		return new Response(JSON.stringify({ user: userData }), { status: 200 });
	} catch (err) {
		console.error("JWT verification error:", err);
		return new Response(JSON.stringify({ error: "无效的令牌" }), { status: 401 });
	}
};
