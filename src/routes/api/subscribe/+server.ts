// src/routes/api/subscribe/+server.ts

import { stripe } from "$lib/server/stripe";
import { collections } from "$lib/server/database";
import type { RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { ObjectId } from "mongodb";

export const POST: RequestHandler = async ({ request, locals }) => {
	const { returnUrl } = await request.json();

	if (!locals.userId) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	const userId = new ObjectId(locals.userId);

	// Fetch the user from the database
	const user = await collections.users.findOne({ _id: userId });

	if (!user) {
		return new Response(JSON.stringify({ error: "User not found." }), { status: 404 });
	}

	try {
		// Create a Stripe Checkout Session
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ["card"],
			mode: "subscription",
			customer: user.stripeCustomerId || undefined, // If customer exists, reuse
			line_items: [
				{
					price: env.STRIPE_PRICE_ID, // Replace with your actual Price ID
					quantity: 1,
				},
			],
			success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${returnUrl}?canceled=true`,
			client_reference_id: userId.toString(),
		});

		// If the user doesn't have a Stripe Customer ID, update it
		if (!user.stripeCustomerId) {
			// Optionally, you might want to create a customer if not already done
			const customer = await stripe.customers.create({
				email: user.email,
				name: user.name,
			});

			await collections.users.updateOne(
				{ _id: userId },
				{ $set: { stripeCustomerId: customer.id } }
			);
		}

		return new Response(JSON.stringify({ url: session.url }), { status: 200 });
	} catch (err: Error) {
		console.error("Error creating Stripe Checkout Session:", err);
		return new Response(JSON.stringify({ error: "訂閱流程無法開始。" }), { status: 500 });
	}
};
