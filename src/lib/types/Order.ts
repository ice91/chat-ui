// src/lib/types/Order.ts

import type { ObjectId } from "mongodb";

export interface Timestamps {
	createdAt: Date;
	updatedAt: Date;
}

export interface Order extends Timestamps {
	_id: ObjectId;
	userId: ObjectId; // 用户ID，关联到 User._id
	orderId: string; // Gelato 的订单ID
	storeId: string | null;
	orderReferenceId: string; // 系统内部的订单ID
	fulfillmentStatus: string;
	minDeliveryDate?: Date;
	maxDeliveryDate?: Date;
	items: OrderItem[];
}

export interface OrderItem extends Timestamps {
	_id: ObjectId;
	orderId: ObjectId; // 关联到 Order._id
	itemReferenceId: string; // Gelato 的订单项ID
	productId: ObjectId; // 关联到 Product._id
	fulfillmentStatus: string;
	trackingCodes: TrackingCode[];
	comment?: string;
}

export interface TrackingCode {
	code: string;
	url: string;
	shipmentMethodName: string;
	shipmentMethodUid: string;
	country: string;
	stateProvince: string;
	facilityId: string;
}
