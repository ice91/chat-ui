// src/lib/server/gelatoWebhookVerification.ts

import crypto from "crypto";
import { env } from "$env/dynamic/private";

export async function verifyGelatoWebhookRequest(request: Request): Promise<boolean> {
	const signature = request.headers.get("X-Gelato-Signature");
	if (!signature) {
		console.warn("缺少 X-Gelato-Signature 標頭");
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
		console.warn("簽名驗證失敗");
	}

	return isValid;
}
