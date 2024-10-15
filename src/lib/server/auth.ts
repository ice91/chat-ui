// src/lib/server/auth.ts

import {
	Issuer,
	type BaseClient,
	type UserinfoResponse,
	type TokenSet,
	custom,
} from "openid-client";
import { addHours, addWeeks } from "date-fns";
import { env } from "$env/dynamic/private";
import { sha256 } from "$lib/utils/sha256";
import { z } from "zod";
import { dev } from "$app/environment";
import type { Cookies } from "@sveltejs/kit";
import { collections } from "$lib/server/database";
import JSON5 from "json5";
import { logger } from "$lib/server/logger";
import jwt from "jsonwebtoken";
const { verify } = jwt;

export interface OIDCSettings {
	redirectURI: string;
}

export interface OIDCUserInfo {
	token: TokenSet;
	userData: UserinfoResponse;
}

const stringWithDefault = (value: string) =>
	z
		.string()
		.default(value)
		.transform((el) => (el ? el : value));

export const OIDConfig = z
	.object({
		CLIENT_ID: stringWithDefault(env.OPENID_CLIENT_ID),
		CLIENT_SECRET: stringWithDefault(env.OPENID_CLIENT_SECRET),
		PROVIDER_URL: stringWithDefault(env.OPENID_PROVIDER_URL),
		SCOPES: stringWithDefault(env.OPENID_SCOPES),
		NAME_CLAIM: stringWithDefault(env.OPENID_NAME_CLAIM).refine(
			(el) => !["preferred_username", "email", "picture", "sub"].includes(el),
			{ message: "nameClaim cannot be one of the restricted keys." }
		),
		TOLERANCE: stringWithDefault(env.OPENID_TOLERANCE),
		RESOURCE: stringWithDefault(env.OPENID_RESOURCE),
	})
	.parse(JSON5.parse(env.OPENID_CONFIG));

export const requiresUser = !!OIDConfig.CLIENT_ID && !!OIDConfig.CLIENT_SECRET;

export function refreshSessionCookie(cookies: Cookies, sessionId: string) {
	cookies.set(env.COOKIE_NAME, sessionId, {
		path: "/",
		// So that it works inside the space's iframe
		sameSite: dev || env.ALLOW_INSECURE_COOKIES === "true" ? "lax" : "none",
		secure: !dev && !(env.ALLOW_INSECURE_COOKIES === "true"),
		httpOnly: true,
		expires: addWeeks(new Date(), 2),
	});
}

export async function findUser(sessionId: string) {
	const session = await collections.sessions.findOne({ sessionId });

	if (!session) {
		return null;
	}

	return await collections.users.findOne({ _id: session.userId });
}
export const authCondition = (locals: App.Locals) => {
	return locals.user
		? { userId: locals.user._id }
		: { sessionId: locals.sessionId, userId: { $exists: false } };
};

/**
 * Generates a CSRF token using the user sessionId. Note that we don't need a secret because sessionId is enough.
 */
export async function generateCsrfToken(sessionId: string, redirectUrl: string): Promise<string> {
	const data = {
		expiration: addHours(new Date(), 1).getTime(),
		redirectUrl,
	};

	return Buffer.from(
		JSON.stringify({
			data,
			signature: await sha256(JSON.stringify(data) + "##" + sessionId),
		})
	).toString("base64");
}

async function getOIDCClient(settings: OIDCSettings): Promise<BaseClient> {
	const issuer = await Issuer.discover(OIDConfig.PROVIDER_URL);

	return new issuer.Client({
		client_id: OIDConfig.CLIENT_ID,
		client_secret: OIDConfig.CLIENT_SECRET,
		redirect_uris: [settings.redirectURI],
		response_types: ["code"],
		[custom.clock_tolerance]: OIDConfig.TOLERANCE || undefined,
	});
}

export async function getOIDCAuthorizationUrl(
	settings: OIDCSettings,
	params: { sessionId: string }
): Promise<string> {
	const client = await getOIDCClient(settings);
	const csrfToken = await generateCsrfToken(params.sessionId, settings.redirectURI);

	return client.authorizationUrl({
		scope: OIDConfig.SCOPES,
		state: csrfToken,
		resource: OIDConfig.RESOURCE || undefined,
	});
}

export async function getOIDCUserData(
	settings: OIDCSettings,
	code: string,
	iss?: string
): Promise<OIDCUserInfo> {
	const client = await getOIDCClient(settings);
	const token = await client.callback(settings.redirectURI, { code, iss });
	const userData = await client.userinfo(token);

	return { token, userData };
}

export async function validateAndParseCsrfToken(
	token: string,
	sessionId: string
): Promise<{
	/** This is the redirect url that was passed to the OIDC provider */
	redirectUrl: string;
} | null> {
	try {
		const { data, signature } = z
			.object({
				data: z.object({
					expiration: z.number().int(),
					redirectUrl: z.string().url(),
				}),
				signature: z.string().length(64),
			})
			.parse(JSON.parse(token));
		const reconstructSign = await sha256(JSON.stringify(data) + "##" + sessionId);

		if (data.expiration > Date.now() && signature === reconstructSign) {
			return { redirectUrl: data.redirectUrl };
		}
	} catch (e) {
		logger.error(e);
	}
	return null;
}

export async function validateAndParseCsrfToken_seller(
	state: string
): Promise<{ sessionId: string; redirectUrl: string } | null> {
	try {
		const decoded = jwt.verify(state, env.JWT_SECRET) as {
			sessionId: string;
			redirectUrl: string;
			expiration: number;
		};

		if (decoded.expiration < Date.now()) {
			return null;
		}

		return {
			sessionId: decoded.sessionId,
			redirectUrl: decoded.redirectUrl,
		};
	} catch (err) {
		console.error("Failed to validate CSRF token:", err);
		return null;
	}
}

export function extractRedirectUrl(token: string): string | null {
	try {
		const parsedToken = JSON.parse(token); // 解析 token 字串
		if (parsedToken && parsedToken.data && parsedToken.data.redirectUrl) {
			return parsedToken.data.redirectUrl; // 直接提取 redirectUrl
		}
	} catch (e) {
		console.error("Invalid token format:", e);
	}
	return null; // 如果解析失敗或找不到 redirectUrl，回傳 null
}

/**
 * 验证并解析 JWT，确保用户具有 'seller' 角色
 */
export async function authenticateSeller(request: Request): Promise<User> {
	const authHeader = request.headers.get("Authorization");
	const token = authHeader?.split(" ")[1] || request.cookies.get("jwt");

	if (!token) {
		throw error(401, "未授权");
	}

	const jwtSecret = env.JWT_SECRET;
	if (!jwtSecret) {
		throw error(500, "未配置JWT密钥");
	}

	try {
		const decoded = verify(token, jwtSecret) as { userId: string; roles: string[] };

		if (!decoded.roles.includes("seller")) {
			throw error(403, "无访问权限");
		}

		const user = await collections.users.findOne({ _id: new ObjectId(decoded.userId) });

		if (!user) {
			throw error(404, "用户未找到");
		}

		return user;
	} catch (err) {
		console.error("Authentication error:", err);
		throw error(401, "无效的令牌");
	}
}

/**
 * 中间件函数，确保用户具有 'seller' 角色
 */
export async function requireSeller(event: { request: Request; locals: User }) {
	const user = await authenticateSeller(event.request);
	return user;
}
