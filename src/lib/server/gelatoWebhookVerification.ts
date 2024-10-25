// src/lib/server/gelatoWebhookVerification.ts

import crypto from "crypto";

export function verifyGelatoWebhookRequest(
	signature: string,
	body: string,
	webhookSecret: string
): boolean {
	const hmac = crypto.createHmac("sha1", webhookSecret);
	hmac.update(body, "utf8");
	const computedSignature = hmac.digest("base64");

	try {
		const isValid = crypto.timingSafeEqual(
			Buffer.from(signature, "base64"),
			Buffer.from(computedSignature, "base64")
		);
		if (!isValid) {
			console.warn("签名验证失败");
		}
		return isValid;
	} catch (error) {
		console.warn("签名验证出错", error);
		return false;
	}
}
