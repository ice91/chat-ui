// src/lib/server/tools/createProduct.ts

import type { ConfigTool, ToolContext } from "$lib/types/Tool";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private";
import axios from "axios";
import { downloadFile } from "../files/downloadFile";

// 定義輸入參數的類型
interface CreateProductParams {
	title?: string;
	description?: string;
	tags?: string;
	categoryIds?: string;
	imagePlaceholders: string; // JSON 格式的字符串，例如：{"Image 4": {"fileMessageIndex": 1, "fileIndex": 0}}
}

// 定義後端 API 返回的響應類型
interface CreateProductResponse {
	message: string; // 根據後端返回的結構，這裡假設是 message
	productId?: string; // 可能包含產品 ID
}

const createProductTool: ConfigTool = {
	_id: new ObjectId("00000000000000000000000D"), // 確保使用唯一的 ObjectId
	type: "config",
	description:
		"創建一個新的鋁製打印產品（Aluminum Print）。請提供產品信息，以及對話中圖片的位置。如果未提供某些字段，將使用默認值。",
	color: "green",
	icon: "tools",
	displayName: "創建鋁製打印產品",
	name: "create_aluminum_print_product",
	endpoint: null,
	inputs: [
		{
			name: "title",
			type: "str",
			description: "產品標題",
			paramType: "optional",
		},
		{
			name: "description",
			type: "str",
			description: "產品描述",
			paramType: "optional",
		},
		{
			name: "tags",
			type: "str",
			description: "產品標籤，用逗號分隔",
			paramType: "optional",
		},
		{
			name: "categoryIds",
			type: "str",
			description: "產品類別 ID，用逗號分隔",
			paramType: "optional",
		},
		{
			name: "imagePlaceholders",
			type: "json",
			description:
				'圖片佔位符與文件位置的對應關係，JSON 格式，例如：{"Image 4": {"fileMessageIndex": 1, "fileIndex": 0}}',
			paramType: "required",
		},
	],
	outputComponent: null,
	outputComponentIdx: null,
	showOutput: true,
	async *call(
		{ title, description, tags, categoryIds, imagePlaceholders }: CreateProductParams,
		{ conv, messages, cookies }: ToolContext
	) {
		try {
			// 1. 固定的模板 ID，對應 Aluminum Print
			const templateId = "fadf6eb1-a041-4837-bc05-585745ade6ea";

			// 2. 從 Cookies 中取得 JWT Token
			const COOKIE_NAME = env.COOKIE_NAME; // 從環境變量取得 Cookie 名稱
			const authToken = cookies[COOKIE_NAME];
			if (!authToken) {
				throw new Error("未找到身份驗證令牌，請確保已登入。");
			}

			// 3. 構建 Headers，手動添加 Cookie
			const headers = {
				Cookie: `${COOKIE_NAME}=${authToken}`,
			};

			// 4. 獲取模板數據
			const templateResponse = await axios.get(
				`${env.BACKEND_API_URL}/api/templates/${templateId}`,
				{
					headers,
				}
			);

			if (!templateResponse.data.template) {
				throw new Error(`模板未找到：${templateId}`);
			}

			const templateData = templateResponse.data.template;

			// 5. 填充默認值
			const finalTitle = title || templateData.title;
			const finalDescription = description || templateData.description;
			const finalTags = tags || templateData.tags;
			const finalCategoryIds = categoryIds || templateData.categoryIds;

			// 6. 確定需要的圖片佔位符名稱
			const placeholderNames = ["Image 3"]; // 對於這個模板，我們需要的圖片佔位符名稱

			// 7. 解析 imagePlaceholders 參數
			const imageMappings: Record<string, { fileMessageIndex: number; fileIndex: number }> =
				JSON.parse(imagePlaceholders);
			// 例如：{ "Image 4": { "fileMessageIndex": 1, "fileIndex": 0 } }

			// 8. 檢查是否所有佔位符都有對應的文件
			for (const placeholderName of placeholderNames) {
				if (!imageMappings[placeholderName]) {
					throw new Error(`缺少佔位符 "${placeholderName}" 的圖片文件位置。`);
				}
			}

			// 9. 處理圖片上傳
			const formData = new FormData();
			formData.append("templateId", templateId);
			formData.append("title", finalTitle);
			formData.append("description", finalDescription);
			formData.append(
				"tags",
				JSON.stringify(
					finalTags
						.split(",")
						.map((tag) => tag.trim())
						.filter((tag) => tag !== "")
				)
			);
			formData.append(
				"categoryIds",
				JSON.stringify(
					finalCategoryIds
						.split(",")
						.map((id) => id.trim())
						.filter((id) => id !== "")
				)
			);

			for (const placeholderName of placeholderNames) {
				const { fileMessageIndex, fileIndex } = imageMappings[placeholderName];

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

				// 下載文件 Blob
				const fileData = await downloadFile(file.value, conv._id)
					.then((data) => fetch(`data:${file.mime};base64,${data.value}`))
					.then((res) => res.blob());

				// 將文件添加到 FormData 中
				formData.append(
					`images[${placeholderName}]`,
					new File([fileData], file.name, { type: file.mime })
				);
			}

			// 10. 調用後端 API 創建產品
			const response = await axios.post(`${env.BACKEND_API_URL}/api/products`, formData, {
				headers: {
					...headers,
					"Content-Type": "multipart/form-data",
				},
			});

			if (![200, 202].includes(response.status)) {
				throw new Error(`創建產品失敗：${response.statusText}`);
			}

			const result: CreateProductResponse = response.data;

			// 11. 返回結果給用戶
			yield {
				outputs: [
					{
						create_product: `產品已成功創建，狀態：${result.message}${
							result.productId ? `，ID：${result.productId}` : ""
						}`,
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
