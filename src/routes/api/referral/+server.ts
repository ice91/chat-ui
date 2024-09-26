// src/routes/api/referral/+server.ts
import { collections } from "$lib/server/database";
import { addPoints } from "$lib/server/points";
import type { RequestHandler } from "@sveltejs/kit";
import { ObjectId } from "mongodb";

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.userId) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	const { code } = await request.json();
	const userId = new ObjectId(locals.userId);

	if (!code || typeof code !== "string") {
		return new Response(JSON.stringify({ error: "Invalid referral code." }), { status: 400 });
	}

	const referral = await collections.referralCodes.findOne({ code, usedBy: { $exists: false } });

	if (!referral) {
		return new Response(JSON.stringify({ error: "Invalid or already used referral code." }), {
			status: 400,
		});
	}

	// Update the referral code as used
	await collections.referralCodes.updateOne(
		{ _id: referral._id },
		{ $set: { usedBy: userId, usedAt: new Date() } }
	);

	// Award points to both the referrer and the user
	const pointsAwarded = referral.pointsAwarded || 10; // Default to 10 if not specified
	await addPoints(userId, pointsAwarded);
	await addPoints(new ObjectId(referral.createdBy), pointsAwarded);

	return new Response(JSON.stringify({ message: "Referral code applied successfully." }), {
		status: 200,
	});
};
