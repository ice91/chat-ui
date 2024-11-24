// src/lib/server/tools/createProduct.ts

import type { ConfigTool, ToolContext } from "$lib/types/Tool";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private";
import axios from "axios";
import { downloadFile } from "../files/downloadFile";
import type { ImagePlaceholderObject, VariantObject } from "$lib/types//ProductTemplate"; // 引用 ProductTemplate 中的 VariantObject

// 定義輸入參數的類型
interface CreateProductParams {
	fileMessageIndex: number;
	fileIndex: number;
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
		"創建一個新的鋁製打印產品（Aluminum Print）。只需提供圖片所在的消息索引和文件索引，其餘資訊將自動從模板獲取。",
	color: "green",
	icon: "tools",
	displayName: "創建鋁製打印產品",
	name: "create_aluminum_print_product",
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
			const finalTitle = templateData.title || "Custom Aluminum Print";
			const finalDescription =
				templateData.description || "A custom Aluminum Print created using your image.";
			const finalTags = (templateData.tags || []).join(", ") || "custom,aluminum print,image";

			// 6. 獲取圖片佔位符名稱
			const placeholderNames = templateData.variants.flatMap((variant: VariantObject) =>
				variant.imagePlaceholders.map((p: ImagePlaceholderObject) => p.name)
			);

			if (placeholderNames.length === 0) {
				throw new Error("模板中未找到任何圖片佔位符。");
			}

			const placeholderName = placeholderNames[0]; // 假設只有一個佔位符

			// 7. 處理圖片文件
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

			// 8. 構建 FormData
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

			// 下載文件 Blob
			const fileData = await downloadFile(file.value, conv._id)
				.then((data) => fetch(`data:${file.mime};base64,${data.value}`))
				.then((res) => res.blob());

			// 將文件添加到 FormData 中
			formData.append(
				`images[${placeholderName}]`,
				new File([fileData], file.name, { type: file.mime })
			);

			// 9. 調用後端 API 創建產品
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

			// 10. 返回結果給用戶
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
