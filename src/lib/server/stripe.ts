// src/lib/server/stripe.ts
import Stripe from "stripe";
import { env } from "$env/dynamic/private";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
	apiVersion: "2022-11-15",
});
