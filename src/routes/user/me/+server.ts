// src/routes/user/me/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { requireSeller } from "$lib/server/auth";
//import { collections } from "$lib/server/database";

export const GET: RequestHandler = async ({ request }) => {
	// 认证并获取用户
	const user = await requireSeller({ request, locals: {} });

	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}

	// 返回用户信息（根据需要选择返回的字段）
	const userInfo = {
		id: user._id.toString(),
		name: user.name,
		email: user.email,
		avatarUrl: user.avatarUrl,
		roles: user.roles,
	};

	return new Response(JSON.stringify(userInfo), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
		},
	});
};
