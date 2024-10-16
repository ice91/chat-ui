// src/routes/api/auth/seller/login/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { getOIDCAuthorizationUrl } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";
//import { base } from "$app/paths";
import { env } from "$env/dynamic/private";

export const GET: RequestHandler = async ({ /*url,*/ locals /*, request*/ }) => {
	// 生成回调 URI
	//const referer = request.headers.get("referer");
	const redirectURI = `${env.PUBLIC_ORIGIN}/api/auth/seller/callback`;
	/*const redirectURI = `${
		referer ? new URL(referer).origin : url.origin
	}${base}/api/auth/seller/callback`;*/

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
