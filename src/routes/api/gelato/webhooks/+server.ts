// src/routes/api/gelato/webhooks/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { handleGelatoWebhookEvent } from "$lib/server/gelatoWebhookHandlers";
import { verifyGelatoWebhookRequest } from "$lib/server/gelatoWebhookVerification";
import { env } from "$env/dynamic/private";

export const POST: RequestHandler = async ({ request }) => {
	try {
		const signature = request.headers.get("X-Gelato-Signature");
		if (!signature) {
			console.warn("缺少 X-Gelato-Signature 標頭");
			return new Response("Unauthorized", { status: 401 });
		}

		const webhookSecret = env.GELATO_WEBHOOK_SECRET;
		if (!webhookSecret) {
			console.error("未配置 GELATO_WEBHOOK_SECRET");
			return new Response("Internal Server Error", { status: 500 });
		}

		// 讀取請求體
		const bodyText = await request.text();

		// 驗證 Webhook 請求
		const isValid = verifyGelatoWebhookRequest(signature, bodyText, webhookSecret);
		if (!isValid) {
			console.warn("Webhook 請求驗證失敗。");
			return new Response("Unauthorized", { status: 401 });
		}

		// 解析事件數據
		const event = JSON.parse(bodyText);

		// 處理事件
		await handleGelatoWebhookEvent(event);

		// 成功處理後返回 200 OK
		return new Response(null, { status: 200 });
	} catch (error) {
		console.error("處理 Gelato Webhook 時出錯：", error);
		return new Response("Internal Server Error", { status: 500 });
	}
};
