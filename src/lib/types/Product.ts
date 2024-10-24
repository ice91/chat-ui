// src/lib/types/Product.ts

import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Order";

export interface Product extends Timestamps {
	_id: ObjectId;
	userId: ObjectId; // 卖家ID，关联到 User._id
	title: string;
	description: string;
	images: string[];
	stock: number;
	price: number;
	provider: string; // 供应商名称，如 'Gelato'
	providerProductId: string; // 供应商平台上的产品ID
	productType: string;
	variants: Variant[];
	tags?: string[];
	categoryIds?: ObjectId[];
	previewUrl?: string;
	status?: string;
	stockAvailability?: Record<string, string>; // 如 { "EU": "in-stock" }
}

export interface Variant {
	templateVariantId: string;
	position?: number;
	imagePlaceholders?: ImagePlaceholder[];
}

export interface ImagePlaceholder {
	name: string;
	fileUrl: string;
	fitMethod?: string;
}
