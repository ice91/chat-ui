// src/lib/server/tools/createProduct.ts

import type { ConfigTool, ToolContext } from "$lib/types/Tool";
import { ObjectId } from "mongodb";
import axios from "axios";
import { downloadFile } from "../files/downloadFile";
import { uploadFileToGCS } from "../files/uploadFileToGCS";
import { collections } from "$lib/server/database";
import { env } from "$env/dynamic/private";
import type { VariantObject, ImagePlaceholderObject } from "$lib/types/ProductTemplate";

interface CreateProductParams {
	templateId: string;
	fileMessageIndex: number;
	fileIndex: number;
}

const createProductTool: ConfigTool = {
	_id: new ObjectId("00000000000000000000000D"), // 確保使用唯一的 ObjectId
	type: "config",
	description:
		"使用對話中的圖片，根據指定的模板 ID，在 Gelato 平臺上創建產品，並將產品資訊記錄到本地資料庫。只需提供模板 ID、圖片所在的消息索引和文件索引，其餘資訊將自動從模板獲取。",
	color: "green",
	icon: "tools",
	displayName: "創建產品",
	name: "create_product",
	endpoint: null,
	inputs: [
		{
			name: "templateId",
			type: "str",
			description: "產品模板的 ID",
			paramType: "required",
		},
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
			const imageUrl = await uploadFileToGCS(imageFile);

			// 6. 構建 Gelato API 請求資料
			const productData = {
				templateId: template.templateId,
				title: template.title || "Custom Product",
				description: template.description || "A custom product created using your image.",
				isVisibleInTheOnlineStore: true,
				salesChannels: ["web"],
				tags: template.tags || [],
				variants: template.variants.map((variant: VariantObject) => ({
					templateVariantId: variant.id,
					imagePlaceholders: variant.imagePlaceholders.map(
						(placeholder: ImagePlaceholderObject) => ({
							name: placeholder.name,
							fileUrl: imageUrl,
						})
					),
					// 如果有文字佔位符，可以在此處添加
				})),
				productType: template.productType || "Custom Product",
				vendor: template.vendor || "Gelato",
			};

			// 7. 調用 Gelato API 創建產品
			const gelatoHeaders = {
				Accept: "application/json",
				"Content-Type": "application/json",
				"X-API-KEY": apiKey,
			};

			const createUrl = `https://apis.gelato.com/v3/stores/${storeId}/products:create-from-template`;
			const gelatoResponse = await axios.post(createUrl, productData, {
				headers: gelatoHeaders,
			});

			if (gelatoResponse.status !== 200) {
				throw new Error(`創建產品失敗：${gelatoResponse.statusText}`);
			}

			const gelatoProductId = gelatoResponse.data.id;

			// 8. 將產品資訊記錄到 MongoDB
			const newProduct = {
				_id: new ObjectId(),
				userId: new ObjectId(userId),
				title: productData.title,
				description: productData.description,
				images: [imageUrl],
				provider: "Gelato",
				productType: productData.productType,
				templateId: template.templateId,
				variants: productData.variants,
				tags: productData.tags,
				categories: template.categories || [],
				status: "active",
				createdAt: new Date(),
				updatedAt: new Date(),
				providerProductId: gelatoProductId,
			};

			await collections.products.insertOne(newProduct);

			// 9. 返回結果給使用者
			yield {
				outputs: [
					{
						create_product: `產品已成功創建，產品 ID：${gelatoProductId}`,
					},
				],
				display: true,
			};
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
