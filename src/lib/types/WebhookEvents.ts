// src/lib/types/WebhookEvents.ts

export interface GelatoWebhookEvent {
	id: string;
	event: string;
	orderId: string;
	storeId: string | null;
	orderReferenceId: string;
	fulfillmentStatus: string;
	items: GelatoWebhookEventItem[];
}

export interface GelatoWebhookEventItem {
	itemReferenceId: string;
	fulfillmentStatus: string;
	fulfillments?: GelatoFulfillment[];
}

export interface GelatoFulfillment {
	trackingCode: string;
	trackingUrl: string;
	shipmentMethodName: string;
	shipmentMethodUid: string;
	fulfillmentCountry: string;
	fulfillmentStateProvince: string;
	fulfillmentFacilityId: string;
}

export interface StoreProductUpdatedEvent {
	storeProductId: string;
	externalId: string;
	title: string;
	// 其他字段根据实际情况添加
}
