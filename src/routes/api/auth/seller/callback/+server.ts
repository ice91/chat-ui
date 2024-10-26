// src/routes/api/auth/seller/callback/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { getOIDCUserData, validateAndParseCsrfToken } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { z } from "zod";
import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import jwt from "jsonwebtoken";
import type { User } from "$lib/types/User"; // 确保已正确导入

export const GET: RequestHandler = async ({ url /*, locals*/ }) => {
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

	const jwtSecret = env.JWT_SECRET;
	if (!jwtSecret) {
		throw error(500, "JWT secret not configured");
	}

	const tokenPayload = {
		userId: user._id.toString(),
		roles: user.roles,
	};

	const jwtToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "2h" });

	// 构建前端回调 URL，携带 JWT 令牌
	const frontendCallbackUrl = `${env.FRONTEND_BASE_URL}/auth/callback?token=${jwtToken}`;

	// 返回一个 HTML 页面，使用 JavaScript 重定向到前端并传递 token
	const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
        </head>
        <body>
          <p>Authentication successful, redirecting...</p>
          <script>
            window.location.href = '${frontendCallbackUrl}';
          </script>
        </body>
        </html>
    `;

	return new Response(html, {
		status: 200,
		headers: {
			"Content-Type": "text/html",
		},
	});
};
