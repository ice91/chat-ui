// src/lib/types/WebhookEvents.ts

export interface GelatoWebhookEvent {
	id: string;
	event: string;
	timestamp: string; // 事件的時間戳
	// 可以添加其他通用字段
}

// 模板創建事件
export interface StoreProductTemplateCreatedEvent extends GelatoWebhookEvent {
	storeProductTemplateId: string;
	storeId: string;
	templateName: string;
	// 根據實際情況添加其他字段
}

// 模板更新事件
export interface StoreProductTemplateUpdatedEvent extends GelatoWebhookEvent {
	storeProductTemplateId: string;
	storeId: string;
	templateName: string;
	// 根據實際情況添加其他字段
}

// 模板刪除事件
export interface StoreProductTemplateDeletedEvent extends GelatoWebhookEvent {
	storeProductTemplateId: string;
	storeId: string;
	// 根據實際情況添加其他字段
}

// 產品創建事件
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

// 產品更新事件
export interface StoreProductUpdatedEvent extends GelatoWebhookEvent {
	storeProductId: string;
	storeId: string;
	externalId: string | null;
	title: string;
	description: string;
	previewUrl: string;
	externalPreviewUrl: string;
	externalThumbnailUrl: string;
	publishingErrorCode: string | null;
	status: string;
	publishedAt: string | null;
	updatedAt: string;
	// 根據實際情況添加其他字段
}

// 產品刪除事件
export interface StoreProductDeletedEvent extends GelatoWebhookEvent {
	storeProductId: string;
	storeId: string;
	// 根據實際情況添加其他字段
}

// 根據需要，定義其他事件接口
