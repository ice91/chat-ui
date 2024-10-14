// src/routes/api/auth/seller/callback/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { getOIDCUserData, validateAndParseCsrfToken } from "$lib/server/auth";
import { collections } from "$lib/server/database";
//import { ObjectId } from 'mongodb';
import { z } from "zod";
import jwt from "jsonwebtoken";
import { env } from "$env/dynamic/private";
import { error, redirect } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url, locals /*, request*/ }) => {
	const params = Object.fromEntries(url.searchParams.entries());

	// 验证回调参数
	const schema = z.object({
		code: z.string(),
		state: z.string(),
		iss: z.string().optional(),
	});

	const result = schema.safeParse(params);
	if (!result.success) {
		throw error(400, "Invalid callback parameters");
	}

	const { code, state, iss } = result.data;

	// 解析并验证 CSRF Token
	const csrfToken = Buffer.from(state, "base64").toString("utf-8");
	const validatedToken = await validateAndParseCsrfToken(csrfToken, locals.sessionId);

	if (!validatedToken) {
		throw error(403, "Invalid or expired CSRF token");
	}

	// 获取用户数据
	const { userData } = await getOIDCUserData(
		{ redirectURI: validatedToken.redirectUrl },
		code,
		iss
	);

	const email = userData.email;
	if (!email) {
		throw error(400, "Email not provided by OIDC provider");
	}

	// 查找或创建用户，并赋予 'seller' 角色
	let user = await collections.users.findOne({ email });

	if (!user) {
		const newUser = {
			username: userData.preferred_username || email,
			name: userData.name,
			email,
			roles: ["seller"], // 赋予 'seller' 角色
			avatarUrl: userData.picture || "",
			hfUserId: userData.sub,
			points: 0,
			subscriptionStatus: "inactive",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const insertResult = await collections.users.insertOne(newUser);
		user = { ...newUser, _id: insertResult.insertedId };
	} else {
		// 更新现有用户信息
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
	}

	// 生成 JWT
	const jwtSecret = env.JWT_SECRET;
	if (!jwtSecret) {
		throw error(500, "JWT secret not configured");
	}

	const tokenPayload = {
		userId: user._id.toString(),
		roles: user.roles,
	};

	const jwtToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "2h" });

	// 构建前端回调 URL，包含 JWT 作为查询参数
	const frontendCallbackUrl = `${env.PUBLIC_FRONTEND_BASE_URL}/auth/callback?token=${jwtToken}`;

	// 重定向到前端回调 URL
	throw redirect(302, frontendCallbackUrl);
};
