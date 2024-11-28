// src/lib/server/tools/productMappings.ts

export const productNameToTemplateId: Record<string, string> = {
	"t-shirt": "5e134c9c-9c1b-446a-99db-7c75729feae1", // Heavyweight Unisex Crewneck T-shirt
	"aluminum print": "fadf6eb1-a041-4837-bc05-585745ade6ea", // Aluminum Print
	"flexi case": "381bdedb-28fe-4976-9d9d-b63f63cdd677", // Flex Case
	"greeting cards": "fc3ed724-30aa-4b1e-9fea-e5f603c1d16f", //Greeting Card
	// 可以在此處添加更多產品映射
};

// 定義標準化產品名稱的函式
export function normalizeProductName(input: string): string | null {
	const normalizedInput = input.trim().toLowerCase();

	// 嘗試完全匹配
	if (productNameToTemplateId[normalizedInput]) {
		return normalizedInput;
	}

	// 嘗試部分匹配
	const matches = Object.keys(productNameToTemplateId).find((name) =>
		normalizedInput.includes(name)
	);

	return matches ?? null;
}
