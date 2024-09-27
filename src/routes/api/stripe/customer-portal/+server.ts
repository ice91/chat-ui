// src/routes/api/stripe/customer-portal/+server.ts

import { stripe } from "$lib/server/stripe";
import { collections } from "$lib/server/database";
import type { RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { ObjectId } from "mongodb";

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.userId) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	const userId = new ObjectId(locals.userId);

	// Fetch the user from the database
	const user = await collections.users.findOne({ _id: userId });

	if (!user || !user.stripeCustomerId) {
		return new Response(JSON.stringify({ error: "用戶未找到或未綁定 Stripe 客戶 ID。" }), {
			status: 400,
		});
	}

	try {
		const portalSession = await stripe.billingPortal.sessions.create({
			customer: user.stripeCustomerId,
			return_url: `${env.STRIPE_BILLING_PORTAL}`, // Replace with your actual return URL
		});

		return new Response(JSON.stringify({ url: portalSession.url }), { status: 200 });
	} catch (err: Error) {
		console.error("Error creating Stripe Billing Portal Session:", err);
		return new Response(JSON.stringify({ error: "無法創建客戶門戶會話。" }), { status: 500 });
	}
};
