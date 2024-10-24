// src/routes/api/gelato/webhooks/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
//import { json } from '@sveltejs/kit';
import type { GelatoWebhookEvent } from "$lib/types/WebhookEvents";
import { handleGelatoWebhookEvent } from "$lib/server/gelatoWebhookHandlers";
import { verifyGelatoWebhookRequest } from "$lib/server/gelatoWebhookVerification";

export const POST: RequestHandler = async ({ request }) => {
	try {
		const bodyText = await request.text();
		const isValid = await verifyGelatoWebhookRequest(request.clone());
		console.log(request.clone);
		if (!isValid) {
			console.warn("Webhook 请求验证失败。");
			console.log("Webhook verify fail!!");
			return new Response("Unauthorized", { status: 401 });
		}

		const event: GelatoWebhookEvent = JSON.parse(bodyText);

		// 处理事件
		await handleGelatoWebhookEvent(event);

		// 成功处理后返回 200 OK
		return new Response(null, { status: 200 });
	} catch (error) {
		console.error("处理 Gelato Webhook 时出错：", error);
		return new Response("Internal Server Error", { status: 500 });
	}
};
