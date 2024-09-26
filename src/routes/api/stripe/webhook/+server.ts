import { stripe } from "$lib/server/stripe";
import { collections } from "$lib/server/database";
import { text } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { User } from "$lib/types/User";

export const POST: RequestHandler = async ({ request }) => {
	const payload = await request.text();
	const sig = request.headers.get("stripe-signature");
	const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
	} catch (err: Error) {
		console.error(`⚠️  Webhook signature verification failed.`, err.message);
		return new Response(`Webhook Error: ${err.message}`, { status: 400 });
	}

	const { users } = collections;

	switch (event.type) {
		case "customer.subscription.created":
		case "customer.subscription.updated":
		case "customer.subscription.deleted": {
			const subscription = event.data.object as Stripe.Subscription;
			const customerId = subscription.customer as string;

			// 查找用户
			const user = (await users.findOne({ stripeCustomerId: customerId })) as User | null;

			if (user) {
				const subscriptionStatus = subscription.status;
				const subscriptionPlan = subscription.items.data[0].price.id;
				const subscriptionExpiry = new Date(subscription.current_period_end * 1000);

				// 更新用戶訂閱信息
				await users.updateOne(
					{ _id: user._id },
					{
						$set: {
							subscriptionStatus,
							subscriptionPlan,
							subscriptionExpiry,
						},
					}
				);
			}
			break;
		}
		// 處理其他事件類型...
		default:
			console.log(`Unhandled event type ${event.type}`);
	}

	return text("Webhook received", { status: 200 });
};
