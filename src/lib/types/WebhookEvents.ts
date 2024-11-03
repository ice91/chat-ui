// src/lib/types/WebhookEvents.ts

export interface GelatoWebhookEvent {
	id: string;
	event: string;
	// 可以添加其他通用字段
}

export interface StoreProductCreatedEvent extends GelatoWebhookEvent {
	storeProductId: string; // Gelato 的產品 ID
	storeId: string;
	externalId: string; // Shopify 的產品 ID
	title: string;
	description: string;
	previewUrl: string;
	externalPreviewUrl: string;
	externalThumbnailUrl: string;
	publishingErrorCode: string | null;
	status: string;
	publishedAt: string;
	createdAt: string;
	updatedAt: string;
	variants: Array<{
		id: string;
		title: string;
		externalId: string;
		connectionStatus: string;
	}>;
	productVariantOptions: Array<{
		name: string;
		values: string[];
	}>;
}

export interface StoreProductUpdatedEvent extends GelatoWebhookEvent {
	storeProductId: string;
	externalId: string;
	title: string;
	// 根據實際情況添加其他字段
}
