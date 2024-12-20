// src/lib/server/gelatoWebhookHandlers.ts

import { collections } from "$lib/server/database";
//import type { Product } from "$lib/types/Product";
import type { GelatoWebhookEvent, StoreProductUpdatedEvent } from "$lib/types/WebhookEvents";

/**
 * 處理 Gelato 的 Webhook 事件
 * @param event Webhook 事件數據
 */
export async function handleGelatoWebhookEvent(event: GelatoWebhookEvent) {
	const eventType = event.event;

	if (eventType === "store_product_updated") {
		await handleStoreProductUpdated(event);
	} else {
		console.log(`忽略未處理的事件類型：${eventType}`);
	}
}

/**
 * 處理 store_product_updated 事件
 * @param event store_product_updated 事件數據
 */
async function handleStoreProductUpdated(event: StoreProductUpdatedEvent) {
	const storeProductId = event.storeProductId; // Gelato 的產品 ID
	const externalId = event.externalId; // Shopify 的產品 ID
	//const title = event.title;

	// 根據 storeProductId 找到對應的產品記錄
	const product = await collections.products.findOne({
		providerProductId: storeProductId,
		status: "pending",
	});

	if (!product) {
		console.error("未找到對應的產品記錄");
		return;
	}

	// 更新產品記錄
	await collections.products.updateOne(
		{ _id: product._id },
		{
			$set: {
				providerProductId: storeProductId,
				shopifyProductId: externalId,
				status: "active", // 更新狀態為 active
				updatedAt: new Date(),
			},
		}
	);

	console.log(`產品記錄已更新：${product._id}`);
}
