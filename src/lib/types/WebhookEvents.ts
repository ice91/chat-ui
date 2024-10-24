// src/lib/types/WebhookEvents.ts

export type GelatoEventType =
	| "order_status_updated"
	| "order_item_status_updated"
	| "order_item_tracking_code_updated"
	| "order_delivery_estimate_updated"
	| "catalog_product_stock_availability_updated"
	| "store_product_created"
	| "store_product_updated"
	| "store_product_deleted"
	| "store_product_template_created"
	| "store_product_template_updated"
	| "store_product_template_deleted";

export interface BaseEvent {
	id: string;
	event: GelatoEventType;
}

// 定义各个事件的接口

export interface OrderStatusUpdatedEvent extends BaseEvent {
	event: "order_status_updated";
	orderId: string;
	storeId: string | null;
	orderReferenceId: string;
	fulfillmentStatus: string;
	items: OrderItemStatus[];
}

export interface OrderItemStatus {
	itemReferenceId: string;
	fulfillmentStatus: string;
	fulfillments: OrderItemFulfillment[];
}

export interface OrderItemFulfillment {
	trackingCode: string;
	trackingUrl: string;
	shipmentMethodName: string;
	shipmentMethodUid: string;
	fulfillmentCountry: string;
	fulfillmentStateProvince: string;
	fulfillmentFacilityId: string;
}

// 其他事件类型接口定义省略，详见之前讨论

export type GelatoWebhookEvent = OrderStatusUpdatedEvent;
// ...其他事件类型
