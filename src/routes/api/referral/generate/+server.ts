// src/routes/api/referral/generate/+server.ts
import { generateReferralCode } from "$lib/server/referral";
import type { RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ locals }) => {
	const { user } = locals;

	console.log(user);
	if (!user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	try {
		const code = await generateReferralCode(user._id);
		return new Response(JSON.stringify({ referralCode: code }), { status: 200 });
	} catch (err) {
		console.error(err);
		return new Response(JSON.stringify({ error: "Failed to generate referral code." }), {
			status: 500,
		});
	}
};
