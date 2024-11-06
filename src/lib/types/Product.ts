// src/lib/types/Product.ts

import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Timestamps";
import type { VariantObject } from "./ProductTemplate"; // 引用 ProductTemplate 中的 VariantObject

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
	templateId: string; // 關聯的模板 ID
	variants: VariantObject[]; // 使用與 ProductTemplate 相同的 VariantObject 類型
	tags?: string[];
	categories?: string[];
	status: "pending" | "active" | "failed"; // 新增狀態字段
	createdAt: Date;
	updatedAt: Date;
}
