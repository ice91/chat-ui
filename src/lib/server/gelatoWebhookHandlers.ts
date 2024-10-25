// src/lib/server/gelatoWebhookHandlers.ts

import type { GelatoWebhookEvent } from "$lib/types/WebhookEvents";
import { collections } from "$lib/server/database";

export async function handleGelatoWebhookEvent(event: GelatoWebhookEvent) {
	switch (event.event) {
		case "order_status_updated":
			await handleOrderStatusUpdated(event);
			break;
		// 如果需要，可以添加其他事件类型的处理
		default:
			console.warn(`未处理的事件类型：${event.event}`);
	}
}

async function handleOrderStatusUpdated(event: GelatoWebhookEvent) {
	const { orderReferenceId, fulfillmentStatus } = event;

	const order = await collections.orders.findOne({ shopifyOrderId: orderReferenceId });

	if (!order) {
		console.warn(`未找到对应的订单，reference ID: ${orderReferenceId}`);
		return;
	}

	await collections.orders.updateOne(
		{ _id: order._id },
		{ $set: { fulfillmentStatus, updatedAt: new Date() } }
	);
}
