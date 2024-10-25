// src/lib/types/Product.ts

import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Timestamps";

export interface Product extends Timestamps {
	_id: ObjectId;
	userId: ObjectId; // 卖家ID
	title: string;
	description: string;
	images: string[];
	price: number;
	provider: string; // 例如：'Gelato'
	providerProductId?: string; // Gelato 平台上的产品ID
	shopifyProductId?: string; // Shopify 平台上的产品ID
	productType: string; // 例如：'t-shirt'、'mug'
	variants?: Variant[]; // 产品变体
	tags?: string[];
	categories?: string[];
	status: "draft" | "published";
	createdAt: Date;
	updatedAt: Date;
}

export interface Variant {
	variantId?: string; // Gelato 或 Shopify 的变体 ID
	title: string;
	options: Record<string, string>; // 例如：{ Color: 'Red', Size: 'M' }
	imageUrl?: string;
	price?: number;
}
