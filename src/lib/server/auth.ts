// src/lib/server/auth.ts

import {
	Issuer,
	custom,
	type BaseClient,
	type UserinfoResponse,
	type TokenSet,
} from "openid-client";
import { /*addHours,*/ addWeeks } from "date-fns";
import { env } from "$env/dynamic/private";
import { z } from "zod";
import { dev } from "$app/environment";
import type { Cookies } from "@sveltejs/kit";
import { collections } from "$lib/server/database";
import JSON5 from "json5";
//import { logger } from "$lib/server/logger";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { error } from "@sveltejs/kit";
import crypto from "crypto";
import type { User } from "$lib/types/User"; // 確保已正確導入

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

// 刷新会话 Cookie
export function refreshSessionCookie(cookies: Cookies, sessionId: string) {
	cookies.set(env.COOKIE_NAME, sessionId, {
		path: "/",
		sameSite: dev || env.ALLOW_INSECURE_COOKIES === "true" ? "lax" : "none",
		secure: !dev && !(env.ALLOW_INSECURE_COOKIES === "true"),
		httpOnly: true,
		expires: addWeeks(new Date(), 2),
	});
}

// 查找用户
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
 * 生成 OIDC 授权 URL，使用随机的 'state' 参数，并在服务器端存储
 */
export async function getOIDCAuthorizationUrl(
	settings: { redirectURI: string },
	params: { sessionId: string }
): Promise<string> {
	const client = await getOIDCClient(settings);

	// 生成随机 state
	const state = crypto.randomBytes(16).toString("hex");

	// 将 state 与 sessionId 存储在数据库中
	await collections.stateStore.insertOne({
		state,
		sessionId: params.sessionId,
		redirectUrl: settings.redirectURI,
		expiration: new Date(Date.now() + 10 * 60 * 1000), // 10 分钟有效期
	});

	return client.authorizationUrl({
		scope: OIDConfig.SCOPES,
		state,
		resource: OIDConfig.RESOURCE || undefined,
	});
}

/**
 * 获取 OIDC 客户端
 */
async function getOIDCClient(settings: { redirectURI: string }): Promise<BaseClient> {
	const issuer = await Issuer.discover(OIDConfig.PROVIDER_URL);

	return new issuer.Client({
		client_id: OIDConfig.CLIENT_ID,
		client_secret: OIDConfig.CLIENT_SECRET,
		redirect_uris: [settings.redirectURI],
		response_types: ["code"],
		[custom.clock_tolerance]: OIDConfig.TOLERANCE || undefined,
	});
}

/**
 * 获取 OIDC 用户数据
 */
export async function getOIDCUserData(
	settings: { redirectURI: string },
	code: string,
	iss?: string
): Promise<{ token: TokenSet; userData: UserinfoResponse }> {
	const client = await getOIDCClient(settings);
	const token = await client.callback(settings.redirectURI, { code, iss });
	const userData = await client.userinfo(token);

	return { token, userData };
}

/**
 * 验证并解析 'state' 参数（随机字符串）
 */
export async function validateAndParseCsrfToken(
	state: string
): Promise<{ sessionId: string; redirectUrl: string } | null> {
	try {
		// 从数据库中查找 state
		const record = await collections.stateStore.findOne({ state });

		if (!record) {
			console.error("Failed to validate CSRF token: state not found");
			return null;
		}

		if (record.expiration < new Date()) {
			console.error("Failed to validate CSRF token: state expired");
			// 删除过期的记录
			await collections.stateStore.deleteOne({ state });
			return null;
		}

		// 验证后删除记录，防止重用
		await collections.stateStore.deleteOne({ state });

		return {
			sessionId: record.sessionId,
			redirectUrl: record.redirectUrl,
		};
	} catch (err) {
		console.error("Failed to validate CSRF token:", err);
		return null;
	}
}

/**
 * 认证卖家用户，确保用户具有 'seller' 角色
 */
export async function authenticateSeller(request: Request): Promise<User> {
	const authHeader = request.headers.get("Authorization");
	const token = authHeader?.split(" ")[1] || null;

	if (!token) {
		throw error(401, "未授权");
	}

	const jwtSecret = env.JWT_SECRET;
	if (!jwtSecret) {
		throw error(500, "未配置 JWT 密钥");
	}

	try {
		const decoded = jwt.verify(token, jwtSecret) as { userId: string; roles: string[] };

		if (!decoded.roles.includes("seller")) {
			throw error(403, "无访问权限");
		}

		const user = (await collections.users.findOne({
			_id: new ObjectId(decoded.userId),
		})) as User | null;

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
export async function requireSeller(event: { request: Request; locals: App.Locals }) {
	const user = await authenticateSeller(event.request);
	return user;
}
