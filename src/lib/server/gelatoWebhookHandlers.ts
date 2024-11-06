// src/lib/server/gelatoWebhookHandlers.ts

import { collections } from "$lib/server/database";
import { getTemplateFromGelato, getProductFromGelato } from "$lib/server/gelato"; // 實作調用 Gelato Get Template API 的函數
import type {
	GelatoWebhookEvent,
	StoreProductTemplateCreatedEvent,
	StoreProductTemplateUpdatedEvent,
	StoreProductTemplateDeletedEvent,
	StoreProductCreatedEvent,
	StoreProductUpdatedEvent,
} from "$lib/types/WebhookEvents";

export async function handleGelatoWebhookEvent(event: GelatoWebhookEvent) {
	const eventType = event.event;

	if (eventType === "store_product_template_created") {
		await handleStoreProductTemplateCreated(event as StoreProductTemplateCreatedEvent);
	} else if (eventType === "store_product_template_updated") {
		await handleStoreProductTemplateUpdated(event as StoreProductTemplateUpdatedEvent);
	} else if (eventType === "store_product_template_deleted") {
		await handleStoreProductTemplateDeleted(event as StoreProductTemplateDeletedEvent);
	} else if (eventType === "store_product_created") {
		await handleStoreProductCreated(event as StoreProductCreatedEvent);
	} else if (eventType === "store_product_updated") {
		await handleStoreProductUpdated(event as StoreProductUpdatedEvent);
	} else {
		console.log(`忽略未處理的事件類型：${eventType}`);
	}
}

async function handleStoreProductTemplateCreated(event: StoreProductTemplateCreatedEvent) {
	const templateId = event.storeProductTemplateId;

	// 調用 Gelato API 獲取模板詳細資訊
	const templateData = await getTemplateFromGelato(templateId);

	if (!templateData) {
		console.error(`未能獲取模板資料：${templateId}`);
		return;
	}

	// 將模板資料存儲到資料庫
	await collections.productTemplates.insertOne({
		...templateData,
		templateId: templateData.templateId,
		createdAt: templateData.createdAt,
		updatedAt: templateData.updatedAt,
	});

	console.log(`模板已創建並存儲：${templateId}`);
}

async function handleStoreProductTemplateUpdated(event: StoreProductTemplateUpdatedEvent) {
	const templateId = event.storeProductTemplateId;

	// 調用 Gelato API 獲取模板詳細資訊
	const templateData = await getTemplateFromGelato(templateId);

	if (!templateData) {
		console.error(`未能獲取模板資料：${templateId}`);
		return;
	}

	// 更新資料庫中的模板資料
	await collections.productTemplates.updateOne(
		{ templateId },
		{
			$set: {
				...templateData,
				updatedAt: templateData.updatedAt,
			},
		},
		{ upsert: true } // 如果模板不存在，則插入
	);

	console.log(`模板已更新：${templateId}`);
}

async function handleStoreProductTemplateDeleted(event: StoreProductTemplateDeletedEvent) {
	const templateId = event.storeProductTemplateId;

	// 從資料庫中刪除模板
	await collections.productTemplates.deleteOne({ templateId });

	console.log(`模板已刪除：${templateId}`);
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
		} catch (error: unknown) {
			if (error instanceof Error) {
				console.error("在獲取產品詳細信息時出錯：", error.message);
			} else {
				console.error("在獲取產品詳細信息時出錯：未知錯誤");
			}
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
