// src/routes/api/gelato/webhooks/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import type { GelatoWebhookEvent } from "$lib/types/WebhookEvents";
import { handleGelatoWebhookEvent } from "$lib/server/gelatoWebhookHandlers";
import { verifyGelatoWebhookRequest } from "$lib/server/gelatoWebhookVerification";

export const POST: RequestHandler = async ({ request }) => {
	try {
		// 克隆請求，以便在驗證和解析時不會消耗請求的流
		const requestClone1 = request.clone();
		const requestClone2 = request.clone();

		// 驗證 webhook 請求
		const isValid = await verifyGelatoWebhookRequest(requestClone1);
		if (!isValid) {
			console.warn("Webhook 請求驗證失敗。");
			return new Response("Unauthorized", { status: 401 });
		}

		// 解析事件數據
		const bodyText = await requestClone2.text();
		const event: GelatoWebhookEvent = JSON.parse(bodyText);

		// 處理事件
		await handleGelatoWebhookEvent(event);

		// 成功處理後返回 200 OK
		return new Response(null, { status: 200 });
	} catch (error) {
		console.error("處理 Gelato Webhook 時出錯：", error);
		return new Response("Internal Server Error", { status: 500 });
	}
};
