// src/routes/api/referral/get-referral-code/+server.ts
import { collections } from "$lib/server/database";
import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = locals;

	if (!user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	const { users } = collections;

	const updatedUser = await users.findOne({ _id: user._id });

	if (!updatedUser || !updatedUser.referralCode) {
		return new Response(JSON.stringify({ error: "Referral code not found" }), { status: 404 });
	}

	return new Response(JSON.stringify({ referralCode: updatedUser.referralCode }), { status: 200 });
};
