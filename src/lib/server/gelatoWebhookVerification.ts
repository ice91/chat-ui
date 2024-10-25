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

	console.log(signature);
	console.log(webhookSecret);
	const signatureBuffer = Buffer.from(signature, "base64");
	const computedSignatureBuffer = Buffer.from(computedSignature, "base64");
	console.log(signatureBuffer);
	console.log(computedSignatureBuffer);

	if (signatureBuffer.length !== computedSignatureBuffer.length) {
		console.warn("签名长度不匹配");
		return false;
	}

	const isValid = crypto.timingSafeEqual(signatureBuffer, computedSignatureBuffer);
	if (!isValid) {
		console.warn("签名验证失败");
	}

	return isValid;
}
