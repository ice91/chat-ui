// src/lib/types/ProductTemplate.ts

import type { ObjectId } from "mongodb";

export interface ProductTemplate {
	_id: ObjectId; // 本地資料庫的 ID
	templateId: string; // Gelato 的模板 ID
	templateName: string;
	title: string;
	description: string;
	previewUrl: string;
	productType?: string;
	vendor?: string;
	variants: VariantObject[];
	createdAt: Date;
	updatedAt: Date;
}

export interface VariantObject {
	id: string; // 模板變體 ID（templateVariantId）
	title: string;
	productUid: string;
	variantOptions: VariantOptionObject[];
	imagePlaceholders: ImagePlaceholderObject[];
	textPlaceholders?: TextPlaceholderObject[];
}

export interface VariantOptionObject {
	name: string;
	value: string;
}

export interface ImagePlaceholderObject {
	name: string;
	printArea: string;
	height: number;
	width: number;
}

export interface TextPlaceholderObject {
	name: string;
	text: string;
}
