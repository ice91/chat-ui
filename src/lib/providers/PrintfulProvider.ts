// src/lib/providers/PrintfulProvider.ts

import { ProviderInterface, CreateProductData, CreateProductResponse } from "./ProviderInterface";
import { createProductOnPrintful } from "../server/printful";

export class PrintfulProvider implements ProviderInterface {
	async createProduct(data: CreateProductData): Promise<CreateProductResponse> {
		// 调用 Printful API 创建产品
		const response = await createProductOnPrintful(data);
		return response;
	}

	// 可实现其他方法，例如更新产品、删除产品等
}
