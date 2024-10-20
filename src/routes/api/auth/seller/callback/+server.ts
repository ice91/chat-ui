// src/routes/api/auth/seller/callback/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { getOIDCUserData, validateAndParseCsrfToken } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { z } from "zod";
import { error, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import jwt from "jsonwebtoken";

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	const params = Object.fromEntries(url.searchParams.entries());

	// 驗證回調參數
	const schema = z.object({
		code: z.string(),
		state: z.string(),
		iss: z.string().optional(),
	});

	// 生成 JWT
	const jwtSecret = env.JWT_SECRET;
	console.log(env.JWT_SECRET);
	// 構建前端回調 URL，不再包含 token 參數
	const frontendCallbackUrl = `${env.FRONTEND_BASE_URL}/auth/callback`;

	const result = schema.safeParse(params);
	if (!result.success) {
		throw error(400, "Invalid callback parameters");
	}

	const { code, state, iss } = result.data;

	console.log(`state:${state}`);
	// 驗證並解析 CSRF Token（state 參數）
	const validatedToken = await validateAndParseCsrfToken(state);

	console.log(`validateToken.sessionId:${validatedToken?.sessionId}`);
	console.log(`validateToken.redirectUrl:${validatedToken?.redirectUrl}`);
	if (!validatedToken) {
		throw error(403, "Invalid or expired CSRF token");
	}

	// 將 sessionId 設置到 locals 中
	locals.sessionId = validatedToken.sessionId;

	// 獲取用戶數據
	const { userData } = await getOIDCUserData(
		{ redirectURI: validatedToken.redirectUrl },
		code,
		iss
	);

	const email = userData.email;
	if (!email) {
		throw error(400, "Email not provided by OIDC provider");
	}

	// 查找或創建用戶，並賦予 'seller' 角色
	let user = await collections.users.findOne({ email });

	if (!user) {
		const newUser: Partial<User> = {
			username: userData.preferred_username || email,
			name: userData.name,
			email,
			roles: ["seller"], // 賦予 'seller' 角色
			avatarUrl: userData.picture || "",
			hfUserId: userData.sub,
			points: 0,
			subscriptionStatus: "inactive",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const insertResult = await collections.users.insertOne(newUser);
		user = { ...newUser, _id: insertResult.insertedId } as User;
	} else {
		// 更新現有用戶信息
		await collections.users.updateOne(
			{ _id: user._id },
			{
				$set: {
					username: userData.preferred_username || user.email,
					name: userData.name,
					avatarUrl: userData.picture || user.avatarUrl,
					updatedAt: new Date(),
				},
			}
		);

		user.roles = user.roles || [];
		if (!user.roles.includes("seller")) {
			user.roles.push("seller");
			await collections.users.updateOne({ _id: user._id }, { $set: { roles: user.roles } });
		}
	}

	if (!jwtSecret) {
		throw error(500, "JWT secret not configured");
	}

	const tokenPayload = {
		userId: user._id.toString(),
		roles: user.roles,
	};

	const jwtToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "2h" });

	// 設置 JWT 為 Cookie
	cookies.set("jwt", jwtToken, {
		httpOnly: true,
		secure: true, // 在 HTTPS 下設置為 true
		sameSite: "none", // 允許跨站點 Cookie
		path: "/", // Cookie 的有效路徑
		maxAge: 60 * 60 * 2, // 2 小時（以秒為單位）
	});

	// 重定向到前端回調 URL，不再包含 JWT
	throw redirect(302, frontendCallbackUrl);
};
