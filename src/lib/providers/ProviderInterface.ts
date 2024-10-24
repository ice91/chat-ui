// src/lib/providers/ProviderInterface.ts

export interface CreateProductData {
	templateId: string;
	title: string;
	description: string;
	isVisibleInTheOnlineStore?: boolean;
	salesChannels?: string[];
	tags?: string[];
	variants?: VariantObject[];
	productType?: string;
	vendor?: string;
}

export interface VariantObject {
	templateVariantId: string;
	position?: number;
	imagePlaceholders?: ImagePlaceholderObject[];
}

export interface ImagePlaceholderObject {
	name: string;
	fileUrl: string;
	fitMethod?: string;
}

export interface CreateProductResponse {
	id: string;
	storeId: string;
	externalId?: string;
	title: string;
	description: string;
	previewUrl: string;
	status: string;
	tags?: string[];
	productType?: string;
	vendor?: string;
	publishedAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ProviderInterface {
	createProduct(data: CreateProductData): Promise<CreateProductResponse>;
	// 可根据需求添加更多方法，例如更新产品、删除产品等
}
