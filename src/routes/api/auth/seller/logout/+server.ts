// src/routes/api/auth/seller/logout/+server.ts

import type { RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ cookies }) => {
	try {
		// 删除 JWT 令牌
		cookies.delete("jwt", { path: "/" });
		return new Response(JSON.stringify({ message: "退出登录成功" }), { status: 200 });
	} catch (err) {
		console.error("Error in /api/auth/seller/logout:", err);
		return new Response(JSON.stringify({ error: "内部服务器错误" }), { status: 500 });
	}
};
