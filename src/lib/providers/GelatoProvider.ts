// src/lib/providers/GelatoProvider.ts

import { ProviderInterface, CreateProductData, CreateProductResponse } from "./ProviderInterface";
import { createProductOnGelato } from "../server/gelato";

export class GelatoProvider implements ProviderInterface {
	async createProduct(data: CreateProductData): Promise<CreateProductResponse> {
		// 调用 Gelato API 创建产品
		const response = await createProductOnGelato(data);
		return response;
	}

	// 可实现其他方法，例如更新产品、删除产品等
}
