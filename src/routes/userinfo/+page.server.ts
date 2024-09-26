// src/routes/userinfo/+page.server.ts
import { base } from "$app/paths";
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { collections } from "$lib/server/database";
import type { User } from "$lib/types/User";

export const load: PageServerLoad = async ({ locals }) => {
	const sessionId = locals.sessionId;

	console.log(sessionId);
	// Check for session ID
	if (!sessionId) {
		throw redirect(303, `${base}/`);
	}

	// Find session in the database
	const session = await collections.sessions.findOne({ sessionId });

	if (!session) {
		throw redirect(303, `${base}/`);
	}

	// Find user based on session
	const user = (await collections.users.findOne({ _id: session.userId })) as User | null;

	if (!user) {
		throw redirect(303, `${base}/`);
	}

	// Return the necessary user data to the frontend
	return {
		user: {
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
		},
	};
};
