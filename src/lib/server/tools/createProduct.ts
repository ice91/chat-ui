// src/lib/server/tools/createProduct.ts

import type { ConfigTool, ToolContext } from "$lib/types/Tool";
import { ObjectId } from "mongodb";
import { downloadFile } from "../files/downloadFile";
import { uploadFileToGCS } from "../files/uploadFileToGCS";
import { collections } from "$lib/server/database";
import { env } from "$env/dynamic/private";
import type { VariantObject, ImagePlaceholderObject } from "$lib/types/ProductTemplate";
import { createProductOnGelato } from "$lib/server/gelato";
import type { Product } from "$lib/types/Product";

interface CreateProductParams {
	fileMessageIndex: number;
	fileIndex: number;
}

const createProductTool: ConfigTool = {
	_id: new ObjectId("00000000000000000000000D"), // 確保使用唯一的 ObjectId
	type: "config",
	description:
		"使用對話中的圖片，根據指定的模板 ID，在 Gelato 平臺上創建產品，並將產品資訊記錄到本地資料庫。只需提供圖片所在的消息索引和文件索引，其餘資訊將自動從模板獲取。",
	color: "green",
	icon: "tools",
	displayName: "創建產品",
	name: "create_product",
	endpoint: null,
	inputs: [
		{
			name: "fileMessageIndex",
			type: "number",
			description: "包含圖片的消息索引",
			paramType: "required",
		},
		{
			name: "fileIndex",
			type: "number",
			description: "圖片文件在消息中的索引",
			paramType: "required",
		},
	],
	outputComponent: null,
	outputComponentIdx: null,
	showOutput: true,
	async *call(
		{ fileMessageIndex, fileIndex }: CreateProductParams,
		{ conv, messages }: ToolContext
	) {
		try {
			// 0. 固定的模板 ID，對應 Aluminum Print
			const templateId = "fadf6eb1-a041-4837-bc05-585745ade6ea";
			// 1. 從環境變數中獲取 Gelato API 配置
			const apiKey = env.GELATO_API_KEY;
			const storeId = env.GELATO_STORE_ID;
			if (!apiKey || !storeId) {
				throw new Error("未配置 Gelato API 密鑰或商店 ID");
			}

			// 2. 獲取使用者 ID
			const userId = conv.userId;
			if (!userId) {
				throw new Error("未找到使用者 ID");
			}

			// 3. 從 MongoDB 中取得模板資訊
			const template = await collections.productTemplates.findOne({ templateId });
			if (!template) {
				throw new Error(`未找到模板，模板 ID：${templateId}`);
			}
			console.log("Find template ID:", template.templateId);

			// 4. 處理對話中的圖片文件
			const message = messages[fileMessageIndex];
			if (!message) {
				throw new Error(`未找到消息，索引：${fileMessageIndex}`);
			}

			const files = message.files || [];
			if (fileIndex >= files.length) {
				throw new Error(`文件索引超出範圍：${fileIndex}`);
			}

			const file = files[fileIndex];
			if (!file.mime.startsWith("image/")) {
				throw new Error(`文件不是圖片類型：${file.name}`);
			}

			// 5. 下載並上傳圖片，獲取 URL
			const fileData = await downloadFile(file.value, conv._id).then((data) =>
				Buffer.from(data.value, "base64")
			);

			// 創建 Blob 對象
			const blob = new Blob([fileData], { type: file.mime });
			const imageFile = new File([blob], file.name, { type: file.mime });

			// 上傳文件到 GCS，獲取公開的 URL
			const GCSimageUrl = await uploadFileToGCS(imageFile);

			// 6. 定義缺少的變數
			const title = template.title || "Custom Product";
			const description = template.description || "A custom product created using your image.";
			const tags = template.tags || [];
			const productType = template.productType || "Custom Product";
			const sellerId = userId; // 假設 sellerId 即為 userId
			const categoryIds = template.categories || [];

			// 7. 構建 imageFiles
			const imageFiles: Record<string, File> = {};

			// 獲取所有佔位符名稱
			const placeholderNames = template.variants.flatMap((variant: VariantObject) =>
				variant.imagePlaceholders.map((placeholder: ImagePlaceholderObject) => placeholder.name)
			);

			for (const placeholderName of placeholderNames) {
				imageFiles[placeholderName] = imageFile; // 使用上傳的圖片文件
			}

			// 8. 檢查是否所有佔位符都有對應的圖片
			for (const variant of template.variants) {
				console.log(`variant.id: ${variant.id}, imagePlaceholders:`, variant.imagePlaceholders);
				for (const placeholder of variant.imagePlaceholders) {
					if (!imageFiles[placeholder.name]) {
						throw new Error(`缺少佔位符 "${placeholder.name}" 的圖片文件。`);
					}
				}
			}

			// 9. 構建 imageUrls
			const imageUrls: Record<string, string> = {};
			for (const placeholderName in imageFiles) {
				imageUrls[placeholderName] = GCSimageUrl;
				console.log(`上傳圖片佔位符 "${placeholderName}"，獲取的 URL：${GCSimageUrl}`);
			}

			// 10. 構建 Gelato API 的變體資料
			const gelatoVariants: VariantObject[] = template.variants.map((variant) => ({
				templateVariantId: variant.id,
				imagePlaceholders: variant.imagePlaceholders.map((placeholder) => {
					const fileUrl = imageUrls[placeholder.name];
					if (!fileUrl) {
						throw new Error(`缺少佔位符 "${placeholder.name}" 的圖片文件。`);
					}
					return {
						name: placeholder.name,
						fileUrl,
					};
				}),
				// 如果需要，添加 textPlaceholders
			}));

			//console.log("構建的 gelatoVariants：", JSON.stringify(gelatoVariants, null, 2));
			console.log("構建的 gelatoVariants");

			// 11. 在 Gelato 上創建產品
			const providerResponse = await createProductOnGelato({
				templateId,
				title,
				description,
				isVisibleInTheOnlineStore: true,
				salesChannels: ["global"],
				tags,
				variants: gelatoVariants,
				productType,
				vendor: template.vendor || "Gelato",
			});
			console.log("call Gelato API!");

			// 12. 創建本地產品記錄
			const newProduct: Product = {
				_id: new ObjectId(),
				userId: new ObjectId(sellerId),
				title,
				description: description || "",
				images: Object.values(imageUrls),
				provider: "Gelato",
				productType,
				templateId,
				variants: gelatoVariants,
				tags,
				categories: categoryIds ? categoryIds.map((id: string) => new ObjectId(id)) : [],
				status: "pending", // 初始狀態為 pending
				createdAt: new Date(),
				updatedAt: new Date(),
				providerProductId: providerResponse.id, // Gelato 的 storeProductId
			};
			console.log("create Database record!");

			// 13. 保存產品到資料庫
			await collections.products.insertOne(newProduct);

			console.log("store Database!");

			// 14. 返回結果給使用者
			yield {
				outputs: [
					{
						create_product: `產品創建請求已提交，正在處理中`,
					},
				],
				display: true,
			};
			console.log("return result!");
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "未知錯誤";
			yield {
				outputs: [{ create_product: `創建產品時出錯：${errorMessage}` }],
				display: true,
			};
		}
	},
};

export default createProductTool;
