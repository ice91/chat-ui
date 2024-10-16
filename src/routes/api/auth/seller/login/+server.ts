// src/routes/api/auth/seller/login/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { getOIDCAuthorizationUrl } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";

export const GET: RequestHandler = async ({ locals }) => {
	// 使用后端的 BASE_URL 构建 redirectURI
	const redirectURI = `${env.BACKEND_BASE_URL}/api/auth/seller/callback`;

	// 确保环境变量已正确设置
	if (!env.BACKEND_BASE_URL) {
		console.error("BACKEND_BASE_URL 未在环境变量中设置");
		throw new Error("Server configuration error: BACKEND_BASE_URL is not set");
	}

	console.log("Redirect URI:", redirectURI);

	// 获取授权 URL，包含 sessionId 在 state 中
	const authorizationUrl = await getOIDCAuthorizationUrl(
		{ redirectURI },
		{ sessionId: locals.sessionId }
	);

	console.log("Authorization URL:", authorizationUrl);

	// 重定向用户至授权 URL
	throw redirect(302, authorizationUrl);
};
