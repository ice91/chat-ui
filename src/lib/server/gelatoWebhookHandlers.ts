// src/lib/server/gelatoWebhookHandlers.ts

import { collections } from "$lib/server/database";
import type { GelatoWebhookEvent } from "$lib/types/WebhookEvents";
//import type { OrderItemStatusUpdatedEvent } from '$lib/types/WebhookEvents';
//import { ObjectId } from 'mongodb';

export async function handleGelatoWebhookEvent(event: GelatoWebhookEvent) {
	switch (event.event) {
		case "order_status_updated":
			await handleOrderStatusUpdated(event);
			break;
		// 可以添加更多事件類型的處理
		default:
			console.warn(`未處理的事件類型：${event.event}`);
	}
}

// 處理 'order_status_updated' 事件
async function handleOrderStatusUpdated(event: GelatoWebhookEvent) {
	const { orderReferenceId, fulfillmentStatus, items } = event;

	const order = await collections.orders.findOne({ orderReferenceId });

	if (!order) {
		console.warn(`未找到對應的訂單，reference ID: ${orderReferenceId}`);
		return;
	}

	await collections.orders.updateOne(
		{ _id: order._id },
		{ $set: { fulfillmentStatus, updatedAt: new Date() } }
	);

	if (items && items.length > 0) {
		for (const item of items) {
			const { itemReferenceId, fulfillmentStatus: itemStatus, fulfillments } = item;

			const orderItem = await collections.orderItems.findOne({
				orderId: order._id,
				itemReferenceId,
			});

			if (!orderItem) {
				console.warn(`未找到對應的訂單項，itemReferenceId: ${itemReferenceId}`);
				continue;
			}

			const trackingCodes =
				fulfillments?.map((f) => ({
					code: f.trackingCode,
					url: f.trackingUrl,
					shipmentMethodName: f.shipmentMethodName,
					shipmentMethodUid: f.shipmentMethodUid,
					country: f.fulfillmentCountry,
					stateProvince: f.fulfillmentStateProvince,
					facilityId: f.fulfillmentFacilityId,
				})) || [];

			await collections.orderItems.updateOne(
				{ _id: orderItem._id },
				{
					$set: {
						fulfillmentStatus: itemStatus,
						trackingCodes,
						updatedAt: new Date(),
					},
				}
			);
		}
	}
}
