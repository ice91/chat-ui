// src/lib/providers/ProviderFactory.ts

import { ProviderInterface } from "./ProviderInterface";
import { GelatoProvider } from "./GelatoProvider";
import { PrintfulProvider } from "./PrintfulProvider";

export class ProviderFactory {
	static createProvider(providerName: string): ProviderInterface {
		switch (providerName.toLowerCase()) {
			case "gelato":
				return new GelatoProvider();
			case "printful":
				return new PrintfulProvider();
			default:
				throw new Error(`未知的供应商：${providerName}`);
		}
	}
}
