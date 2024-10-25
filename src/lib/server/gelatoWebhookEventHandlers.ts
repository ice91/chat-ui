// src/lib/server/gelatoWebhookHandlers.ts

import type { GelatoWebhookEvent } from "$lib/types/WebhookEvents";
import { collections } from "$lib/server/database";
//import { ObjectId } from 'mongodb';

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
	const { orderReferenceId, fulfillmentStatus, items } = event;

	// 假设 orderReferenceId 对应于 Shopify 的 shopifyOrderId
	const order = await collections.orders.findOne({ shopifyOrderId: orderReferenceId });

	if (!order) {
		console.warn(`未找到对应的订单，reference ID: ${orderReferenceId}`);
		return;
	}

	// 更新订单状态
	await collections.orders.updateOne(
		{ _id: order._id },
		{ $set: { fulfillmentStatus, updatedAt: new Date() } }
	);

	// 更新订单项的状态和跟踪信息
	if (items && items.length > 0) {
		for (const item of items) {
			const { itemReferenceId, fulfillmentStatus: itemStatus, fulfillments } = item;

			const orderItem = await collections.orders.findOne(
				{ _id: order._id, "items.gelatoItemId": itemReferenceId },
				{ projection: { "items.$": 1 } }
			);

			if (!orderItem || !orderItem.items || orderItem.items.length === 0) {
				console.warn(`未找到对应的订单项，itemReferenceId: ${itemReferenceId}`);
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

			await collections.orders.updateOne(
				{ _id: order._id, "items.gelatoItemId": itemReferenceId },
				{
					$set: {
						"items.$.fulfillmentStatus": itemStatus,
						"items.$.trackingCodes": trackingCodes,
						"items.$.updatedAt": new Date(),
					},
				}
			);
		}
	}
}
