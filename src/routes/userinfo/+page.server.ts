import { base } from "$app/paths";
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit"; // Removed unused 'error' import
import { collections } from "$lib/server/database";
import type { User } from "$lib/types/User";
import { stripe } from "$lib/server/stripe";

export const load: PageServerLoad = async ({ locals, url }) => {
	const sessionId = locals.sessionId;

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

	// Handle query parameters
	const success = url.searchParams.get("success");
	const canceled = url.searchParams.get("canceled");
	const stripeSessionId = url.searchParams.get("session_id");

	let message = null;
	let errorMessage = null;

	if (success === "true" && stripeSessionId) {
		try {
			// Retrieve the Checkout Session from Stripe
			const stripeSession = await stripe.checkout.sessions.retrieve(stripeSessionId as string, {
				expand: ["subscription"],
			});

			if (stripeSession.subscription) {
				const subscription = stripeSession.subscription as Stripe.Subscription;

				// Update user subscription status in the database
				await collections.users.updateOne(
					{ _id: user._id },
					{
						$set: {
							subscriptionStatus: subscription.status,
							subscriptionPlan: subscription.items.data[0].price.id,
							subscriptionExpiry: new Date(subscription.current_period_end * 1000),
						},
					}
				);

				message = "訂閱成功！感謝您的支持。";
			} else {
				errorMessage = "訂閱信息未找到。";
			}
		} catch (err) {
			console.error("Error retrieving Stripe session:", err);
			errorMessage = "訂閱確認時出錯。請稍後再試。";
		}
	}

	if (canceled === "true") {
		message = "您的訂閱已取消。";
	}

	// Return user data and messages
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
		message,
		errorMessage,
	};
};
