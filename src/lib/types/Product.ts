// src/lib/types/Product.ts

import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Timestamps";

export interface Product extends Timestamps {
	_id: ObjectId;
	userId: ObjectId; // 賣家ID
	title: string;
	description: string;
	images: string[];
	price: number;
	provider: string; // 例如：'Gelato'
	providerProductId?: string; // Gelato 平台上的產品ID（storeProductId）
	shopifyProductId?: string; // Shopify 平台上的產品ID（externalId）
	productType: string; // 例如：'t-shirt'、'mug'
	variants?: Variant[]; // 產品變體
	tags?: string[];
	categories?: string[];
	status: "pending" | "active" | "failed"; // 新增狀態字段
	createdAt: Date;
	updatedAt: Date;
	gelatoCreateTaskId?: string; // 新增，用於關聯 Webhook 回調
}

export interface Variant {
	variantId?: string; // Gelato 或 Shopify 的變體 ID
	title: string;
	options: Record<string, string>; // 例如：{ Color: 'Red', Size: 'M' }
	imageUrl?: string;
	price?: number;
}
