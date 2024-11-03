// src/lib/types/WebhookEvents.ts

export interface GelatoWebhookEvent {
	id: string;
	event: string;
	// 可以添加其他通用字段
}

export interface StoreProductCreatedEvent extends GelatoWebhookEvent {
	storeProductId: string; // Gelato 的產品 ID
	storeId: string;
	externalId: string | null; // Shopify 的產品 ID，可能為 null
	title: string;
	description: string;
	previewUrl: string;
	externalPreviewUrl: string;
	externalThumbnailUrl: string;
	publishingErrorCode: string | null;
	status: string;
	publishedAt: string | null;
	createdAt: string;
	updatedAt: string;
	// 根據實際情況添加其他字段
}

export interface StoreProductUpdatedEvent extends GelatoWebhookEvent {
	storeProductId: string;
	externalId: string;
	title: string;
	// 根據實際情況添加其他字段
}
