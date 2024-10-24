// src/lib/server/gelatoWebhookEventHandlers.ts

import type {
	OrderStatusUpdatedEvent,
	OrderItemStatusUpdatedEvent,
} from "$lib/types/WebhookEvents";
import { collections } from "$lib/server/database";
//import { ObjectId } from 'mongodb';

// 处理 'order_status_updated' 事件
export async function handleOrderStatusUpdated(event: OrderStatusUpdatedEvent) {
	const { orderReferenceId, fulfillmentStatus, items } = event;

	// 查找订单
	const order = await collections.orders.findOne({ orderReferenceId });

	if (!order) {
		console.warn(`未找到对应的订单，reference ID: ${orderReferenceId}`);
		return;
	}

	// 更新订单状态
	await collections.orders.updateOne(
		{ _id: order._id },
		{ $set: { fulfillmentStatus, updatedAt: new Date() } }
	);

	// 更新订单项
	for (const item of items) {
		const { itemReferenceId, fulfillmentStatus } = item;

		const orderItem = await collections.orderItems.findOne({ orderId: order._id, itemReferenceId });

		if (!orderItem) {
			console.warn(`未找到对应的订单项，itemReferenceId: ${itemReferenceId}`);
			continue;
		}

		await collections.orderItems.updateOne(
			{ _id: orderItem._id },
			{ $set: { fulfillmentStatus, updatedAt: new Date() } }
		);
	}
}

// 处理 'order_item_status_updated' 事件
export async function handleOrderItemStatusUpdated(event: OrderItemStatusUpdatedEvent) {
	const { orderReferenceId, itemReferenceId, status } = event;

	const order = await collections.orders.findOne({ orderReferenceId });

	if (!order) {
		console.warn(`未找到对应的订单，reference ID: ${orderReferenceId}`);
		return;
	}

	const orderItem = await collections.orderItems.findOne({ orderId: order._id, itemReferenceId });

	if (!orderItem) {
		console.warn(`未找到对应的订单项，itemReferenceId: ${itemReferenceId}`);
		return;
	}

	await collections.orderItems.updateOne(
		{ _id: orderItem._id },
		{ $set: { fulfillmentStatus: status, updatedAt: new Date() } }
	);
}
