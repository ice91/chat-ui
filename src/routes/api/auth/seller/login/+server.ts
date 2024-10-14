// src/routes/api/auth/seller/login/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { getOIDCAuthorizationUrl } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";
import { base } from "$app/paths";

export const GET: RequestHandler = async ({ url, locals, request }) => {
	// 生成回调 URI
	//const redirectURI = `${import.meta.env.VITE_BASE_URL}/api/auth/seller/callback`;

	const referer = request.headers.get("referer");
	const redirectURI = `${
		(referer ? new URL(referer) : url).origin
	}${base}/api/auth/seller/callback`;
	console.log(redirectURI);
	// 获取授权 URL
	const authorizationUrl = await getOIDCAuthorizationUrl(
		{ redirectURI },
		{ sessionId: locals.sessionId }
	);
	console.log(authorizationUrl);

	// 重定向用户至授权 URL
	throw redirect(302, authorizationUrl);
};
