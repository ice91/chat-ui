// src/routes/api/gelato/webhooks/+server.ts

import type { RequestHandler } from "@sveltejs/kit";
import { handleGelatoWebhookEvent } from "$lib/server/gelatoWebhookHandlers";
import { verifyGelatoWebhookRequest } from "$lib/server/gelatoWebhookVerification";
import { env } from "$env/dynamic/private";

export const POST: RequestHandler = async ({ request }) => {
	try {
		const signature = request.headers.get("X-Gelato-Signature");
		if (!signature) {
			console.warn("缺少 X-Gelato-Signature 标头");
			return new Response("Unauthorized", { status: 401 });
		}

		const webhookSecret = env.GELATO_WEBHOOK_SECRET;
		if (!webhookSecret) {
			console.error("未配置 GELATO_WEBHOOK_SECRET");
			return new Response("Internal Server Error", { status: 500 });
		}

		const bodyText = await request.text();

		// 验证 Webhook 请求
		const isValid = verifyGelatoWebhookRequest(signature, bodyText, webhookSecret);
		if (!isValid) {
			console.warn("Webhook 请求验证失败。");
			return new Response("Unauthorized", { status: 401 });
		}

		// 解析事件数据
		const event = JSON.parse(bodyText);

		// 处理事件
		await handleGelatoWebhookEvent(event);

		// 成功处理后返回 200 OK
		return new Response(null, { status: 200 });
	} catch (error) {
		console.error("处理 Gelato Webhook 时出错：", error);
		return new Response("Internal Server Error", { status: 500 });
	}
};
