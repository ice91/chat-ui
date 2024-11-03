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
	const storeProductId = event.storeProductId; // Gelato 的產品 ID
	let externalId = event.externalId; // Shopify 的產品 ID
	const previewUrl = event.previewUrl; // 產品預覽圖 URL

	// 根據 providerProductId 查找本地產品記錄
	const product = await collections.products.findOne({
		providerProductId: storeProductId,
		status: "pending",
	});

	if (!product) {
		console.error("未找到對應的產品記錄");
		return;
	}

	// 如果 externalId 為 null，調用 Gelato API 獲取最新的產品信息
	if (!externalId) {
		try {
			const productData = await getProductFromGelato(storeProductId);
			externalId = productData.externalId;
		} catch (error) {
			console.error("在獲取產品詳細信息時出錯：", error);
			// 可以選擇在此處重試或等待下一次 webhook 事件
		}
	}

	// 更新產品記錄，並使用具體的類型替代 any
	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (externalId) {
		updateData.shopifyProductId = externalId;
		updateData.status = "active"; // 更新狀態為 active
	} else {
		updateData.status = "creating"; // 狀態為 creating，等待 externalId 可用
	}

	if (previewUrl) {
		updateData.images = [previewUrl]; // 更新產品圖片
	}

	await collections.products.updateOne({ _id: product._id }, { $set: updateData });

	console.log(`產品記錄已更新：${product._id}`);
}

async function handleStoreProductUpdated(event: StoreProductUpdatedEvent) {
	const storeProductId = event.storeProductId; // Gelato 的產品 ID
	const externalId = event.externalId; // Shopify 的產品 ID

	// 根據 providerProductId 查找本地產品記錄，狀態可以是 pending 或 creating
	const product = await collections.products.findOne({
		providerProductId: storeProductId,
		status: { $in: ["pending", "creating"] },
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
				shopifyProductId: externalId,
				status: "active", // 更新狀態為 active
				updatedAt: new Date(),
			},
		}
	);

	console.log(`產品記錄已更新：${product._id}`);
}
