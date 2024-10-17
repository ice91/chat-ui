// src/routes/api/auth/seller/callback/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { getOIDCUserData, validateAndParseCsrfToken } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { z } from "zod";
import { error, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import jwt from "jsonwebtoken";

export const GET: RequestHandler = async ({ url, locals }) => {
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

	// 验证并解析 CSRF Token（state 参数）
	const validatedToken = await validateAndParseCsrfToken(state);

	if (!validatedToken) {
		throw error(403, "Invalid or expired CSRF token");
	}

	// 将 sessionId 设置到 locals 中
	locals.sessionId = validatedToken.sessionId;

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
		const newUser: Partial<User> = {
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
		user = { ...newUser, _id: insertResult.insertedId } as User;
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
		if (!user.roles.includes("seller")) {
			user.roles.push("seller");
			await collections.users.updateOne({ _id: user._id }, { $set: { roles: user.roles } });
		}
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
	//const frontendCallbackUrl = env.PUBLIC_FRONTEND_BASE_URL+`/auth/callback?token=${jwtToken}`;
	const frontendCallbackUrl = `https://01jacs2zqp1jj1qfrn04ee70h7-021ec2cdd6d2ef3c559d.myshopify.dev/auth/callback?token=${jwtToken}`;
	//const frontendCallbackUrl = `https://hydrogen-storefront-021ec2cdd6d2ef3c559d.o2.myshopify.dev/auth/callback?token=${jwtToken}`;

	// 重定向到前端回调 URL
	throw redirect(302, frontendCallbackUrl);
};
