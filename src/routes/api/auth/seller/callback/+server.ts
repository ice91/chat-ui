// src/routes/api/auth/seller/callback/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { getOIDCUserData, validateAndParseCsrfToken } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { z } from "zod";
import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import jwt from "jsonwebtoken";
import type { User } from "$lib/types/User"; // 确保已正确导入

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	const params = Object.fromEntries(url.searchParams.entries());

	// 验证回调参数
	const schema = z.object({
		code: z.string(),
		state: z.string(),
		iss: z.string().optional(),
	});

	// 生成 JWT
	const jwtSecret = env.JWT_SECRET;
	console.log("JWT_SECRET:", jwtSecret);
	// 构建前端回调 URL，不再包含 token 参数
	const frontendCallbackUrl = `${env.FRONTEND_BASE_URL}/auth/callback`;

	const result = schema.safeParse(params);
	if (!result.success) {
		throw error(400, "Invalid callback parameters");
	}

	const { code, state, iss } = result.data;

	console.log(`state: ${state}`);
	// 验证并解析 CSRF Token（state 参数）
	const validatedToken = await validateAndParseCsrfToken(state);

	console.log(`validateToken.sessionId: ${validatedToken?.sessionId}`);
	console.log(`validateToken.redirectUrl: ${validatedToken?.redirectUrl}`);
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

	if (!jwtSecret) {
		throw error(500, "JWT secret not configured");
	}

	const tokenPayload = {
		userId: user._id.toString(),
		roles: user.roles,
	};

	const jwtToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "2h" });

	// 设置 JWT 为 Cookie
	cookies.set("jwt", jwtToken, {
		httpOnly: true,
		secure: true, // 在 HTTPS 下设置为 true
		sameSite: "none", // 允许跨站点 Cookie
		path: "/", // Cookie 的有效路径
		maxAge: 60 * 60 * 2, // 2 小时（以秒为单位）
	});

	// 返回一个 HTML 页面，使用 JavaScript 重定向到前端
	const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Successful</title>
    </head>
    <body>
      <p>认证成功，正在跳转...</p>
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
