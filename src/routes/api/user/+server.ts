// src/routes/api/user/+server.ts
import { collections } from "$lib/server/database";
import type { RequestHandler } from "@sveltejs/kit";
import { ObjectId } from "mongodb";

export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.userId;

	if (!userId) {
		return new Response(JSON.stringify({ error: "未授權" }), { status: 401 });
	}

	try {
		const user = await collections.users.findOne({ _id: new ObjectId(userId) });

		if (!user) {
			return new Response(JSON.stringify({ error: "用戶未找到" }), { status: 404 });
		}

		return new Response(
			JSON.stringify({
				id: user._id.toString(),
				username: user.username,
				name: user.name,
				email: user.email,
				avatarUrl: user.avatarUrl || null,
				hfUserId: user.hfUserId || null,
				points: user.points || 0,
				subscriptionStatus: user.subscriptionStatus || "inactive",
				subscriptionPlan: user.subscriptionPlan || null,
				subscriptionExpiry: user.subscriptionExpiry ? user.subscriptionExpiry.toISOString() : null,
				referralCode: user.referralCode || null,
				stripeCustomerId: user.stripeCustomerId || null,
			}),
			{ status: 200 }
		);
	} catch (err) {
		console.error("Error fetching user data:", err);
		return new Response(JSON.stringify({ error: "無法獲取用戶數據" }), { status: 500 });
	}
};
