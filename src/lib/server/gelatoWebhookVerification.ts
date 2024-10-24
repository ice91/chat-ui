// src/lib/server/gelatoWebhookVerification.ts

import { env } from "$env/dynamic/private";
import type { Request } from "@sveltejs/kit";
import crypto from "crypto";

/**
 * 验证 Gelato Webhook 请求的合法性
 */
export async function verifyGelatoWebhookRequest(request: Request): Promise<boolean> {
	const signature = request.headers.get("X-Gelato-Signature");
	if (!signature) {
		console.warn("缺少签名头部");
		return false;
	}

	const body = await request.text();

	const webhookSecret = env.GELATO_WEBHOOK_SECRET;
	if (!webhookSecret) {
		console.error("未配置 GELATO_WEBHOOK_SECRET");
		return false;
	}

	const hmac = crypto.createHmac("sha256", webhookSecret);
	hmac.update(body, "utf-8");
	const computedSignature = hmac.digest("hex");

	const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
	if (!isValid) {
		console.warn("签名验证失败");
	}

	return isValid;
}
