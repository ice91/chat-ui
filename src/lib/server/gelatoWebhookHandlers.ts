// src/lib/server/gelatoWebhookHandlers.ts

import { collections } from "$lib/server/database";
import { getProductFromGelato } from "$lib/server/gelato";
import type {
	GelatoWebhookEvent,
	StoreProductCreatedEvent,
	StoreProductUpdatedEvent,
} from "$lib/types/WebhookEvents";

export async function handleGelatoWebhookEvent(event: GelatoWebhookEvent) {
	const eventType = event.event;

	if (eventType === "store_product_created") {
		await handleStoreProductCreated(event as StoreProductCreatedEvent);
	} else if (eventType === "store_product_updated") {
		await handleStoreProductUpdated(event as StoreProductUpdatedEvent);
	} else {
		console.log(`忽略未處理的事件類型：${eventType}`);
	}
}

async function handleStoreProductCreated(event: StoreProductCreatedEvent) {
	const storeProductId = event.storeProductId;
	let externalId = event.externalId;
	let previewUrl = event.previewUrl;

	const product = await collections.products.findOne({
		providerProductId: storeProductId,
		status: "pending",
	});

	if (!product) {
		console.error("未找到對應的產品記錄");
		return;
	}

	if (!externalId) {
		try {
			const productData = await getProductFromGelato(storeProductId);
			externalId = productData.externalId;
			previewUrl = productData.previewUrl;
		} catch (error) {
			console.error("在獲取產品詳細信息時出錯：", error);
		}
	}

	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (externalId) {
		updateData.shopifyProductId = externalId;
		updateData.status = "active";
	} else {
		updateData.status = "creating";
	}

	if (previewUrl) {
		updateData.images = [previewUrl];
	}

	await collections.products.updateOne({ _id: product._id }, { $set: updateData });

	console.log(`(StoreProductCreated)產品記錄已更新：${product._id}`);
}

async function handleStoreProductUpdated(event: StoreProductUpdatedEvent) {
	const storeProductId = event.storeProductId;
	const externalId = event.externalId;
	const externalPreviewUrl = event.externalPreviewUrl;

	const product = await collections.products.findOne({
		providerProductId: storeProductId,
		status: { $in: ["pending", "creating"] },
	});

	if (!product) {
		console.error("未找到對應的產品記錄");
		return;
	}

	const updateData: Record<string, unknown> = {
		shopifyProductId: externalId,
		status: "active",
		updatedAt: new Date(),
	};

	// 更新圖片
	if (externalPreviewUrl) {
		updateData.images = [externalPreviewUrl];
	}

	await collections.products.updateOne({ _id: product._id }, { $set: updateData });

	console.log(`(StoreProductUpdated)產品記錄已更新：${product._id}`);
}
