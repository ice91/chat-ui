// src/lib/types/Order.ts

import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Timestamps";

export interface Order extends Timestamps {
	_id: ObjectId;
	sellerId: ObjectId; // 卖家ID
	shopifyOrderId: string; // Shopify 订单 ID
	gelatoOrderId?: string; // Gelato 订单 ID
	totalAmount: number;
	currency: string;
	items: OrderItem[];
	fulfillmentStatus: string; // 例如：'pending'、'fulfilled'
	createdAt: Date;
	updatedAt: Date;
}

export interface OrderItem {
	productId: ObjectId; // 关联到 Product._id
	variantId?: string; // Gelato 或 Shopify 的变体 ID
	quantity: number;
	price: number;
	gelatoItemId?: string; // Gelato 的订单项 ID
}
