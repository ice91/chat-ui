// src/routes/api/auth/seller/login/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { getOIDCAuthorizationUrl } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ locals }) => {
	// 生成回调 URI
	const redirectURI = `${import.meta.env.VITE_BASE_URL}/api/auth/seller/callback`;

	// 获取授权 URL
	const authorizationUrl = await getOIDCAuthorizationUrl(
		{ redirectURI },
		{ sessionId: locals.sessionId }
	);

	// 重定向用户至授权 URL
	throw redirect(302, authorizationUrl);
};
