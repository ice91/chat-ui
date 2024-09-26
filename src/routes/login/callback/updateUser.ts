import { refreshSessionCookie } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";
import { DEFAULT_SETTINGS } from "$lib/types/Settings";
import { z } from "zod";
import type { UserinfoResponse } from "openid-client";
import { error, type Cookies } from "@sveltejs/kit";
import crypto from "crypto";
import { sha256 } from "$lib/utils/sha256";
import { addWeeks } from "date-fns";
import { OIDConfig } from "$lib/server/auth";
import { env } from "$env/dynamic/private";
import { logger } from "$lib/server/logger";
import type { User } from "$lib/types/User"; // 確保正確導入用戶類型

export async function updateUser(params: {
	userData: UserinfoResponse;
	locals: App.Locals;
	cookies: Cookies;
	userAgent?: string;
	ip?: string;
}) {
	const { userData, locals, cookies, userAgent, ip } = params;

	// 使用提供者提供的用戶數據進行解析
	const {
		username,
		name,
		email,
		picture: avatarUrl,
		sub: hfUserId,
		orgs,
	} = z
		.object({
			preferred_username: z.string().optional(),
			name: z.string(),
			picture: z.string().optional(),
			sub: z.string(),
			email: z.string().email().optional(),
			orgs: z
				.array(
					z.object({
						sub: z.string(),
						name: z.string(),
						picture: z.string(),
						preferred_username: z.string(),
						isEnterprise: z.boolean(),
					})
				)
				.optional(),
		})
		.setKey(OIDConfig.NAME_CLAIM, z.string())
		.refine((data) => data.preferred_username || data.email, {
			message: "Either preferred_username or email must be provided by the provider.",
		})
		.transform((data) => ({
			...data,
			username: data.preferred_username || data.email || data.name,
			name: data[OIDConfig.NAME_CLAIM],
		}))
		.parse(userData);

	// 檢查是否具有管理員和早期訪問權限
	const isAdmin = (env.HF_ORG_ADMIN && orgs?.some((org) => org.sub === env.HF_ORG_ADMIN)) || false;
	const isEarlyAccess =
		(env.HF_ORG_EARLY_ACCESS && orgs?.some((org) => org.sub === env.HF_ORG_EARLY_ACCESS)) || false;

	// 記錄登錄行為
	logger.info(
		{
			login_username: username,
			login_name: name,
			login_email: email,
			login_orgs: orgs?.map((el) => el.sub),
		},
		"user login"
	);

	// 查找現有的用戶
	const existingUser = await collections.users.findOne({ hfUserId });
	let userId = existingUser?._id;

	// 生成新的 session ID
	const previousSessionId = locals.sessionId;
	const secretSessionId = crypto.randomUUID();
	const sessionId = await sha256(secretSessionId);

	if (await collections.sessions.findOne({ sessionId })) {
		throw error(500, "Session ID collision");
	}

	locals.sessionId = sessionId;

	// 準備更新的用戶字段
	let updateFields: Partial<User> = {
		username,
		name,
		avatarUrl,
		isAdmin,
		isEarlyAccess,
		updatedAt: new Date(),
	};

	if (!existingUser) {
		// 新用戶創建
		updateFields = {
			...updateFields,
			email,
			hfUserId,
			points: 0, // 初始積分
			subscriptionStatus: "inactive", // 初始訂閱狀態
			subscriptionPlan: null,
			subscriptionExpiry: null,
			referralCode: null, // 如果需要推薦碼
		};

		// 創建新用戶
		const { insertedId } = await collections.users.insertOne({
			_id: new ObjectId(),
			createdAt: new Date(),
			...updateFields,
		});

		userId = insertedId;

		// 創建新會話
		await collections.sessions.insertOne({
			_id: new ObjectId(),
			sessionId: locals.sessionId,
			userId: insertedId,
			createdAt: new Date(),
			updatedAt: new Date(),
			userAgent,
			ip,
			expiresAt: addWeeks(new Date(), 2),
		});

		// 遷移設置
		const { matchedCount } = await collections.settings.updateOne(
			{ sessionId: previousSessionId },
			{
				$set: { userId: insertedId, updatedAt: new Date() },
				$unset: { sessionId: "" },
			}
		);

		// 如果沒有預設設置，則創建默認設置
		if (!matchedCount) {
			await collections.settings.insertOne({
				userId: insertedId,
				ethicsModalAcceptedAt: new Date(),
				updatedAt: new Date(),
				createdAt: new Date(),
				...DEFAULT_SETTINGS,
			});
		}
	} else {
		// 更新現有用戶
		const newStripeCustomerId: string | undefined = existingUser.stripeCustomerId;

		updateFields = {
			...updateFields,
			points: existingUser.points, // 保留現有積分
			subscriptionStatus: existingUser.subscriptionStatus,
			subscriptionPlan: existingUser.subscriptionPlan,
			subscriptionExpiry: existingUser.subscriptionExpiry,
		};

		const updateOperation: { $set: Partial<User> } = { $set: updateFields };

		// 如果有新的 stripeCustomerId，則設置它
		if (newStripeCustomerId) {
			updateOperation.$set.stripeCustomerId = newStripeCustomerId;
		}

		await collections.users.updateOne({ _id: existingUser._id }, updateOperation);

		// 刪除之前的會話，插入新會話
		await collections.sessions.deleteOne({ sessionId: previousSessionId });
		await collections.sessions.insertOne({
			_id: new ObjectId(),
			sessionId: locals.sessionId,
			userId: existingUser._id,
			createdAt: new Date(),
			updatedAt: new Date(),
			userAgent,
			ip,
			expiresAt: addWeeks(new Date(), 2),
		});
	}

	// 刷新會話 cookie
	refreshSessionCookie(cookies, secretSessionId);

	// 遷移之前的對話
	await collections.conversations.updateMany(
		{ sessionId: previousSessionId },
		{
			$set: { userId },
			$unset: { sessionId: "" },
		}
	);
}
