// src/lib/server/gelatoWebhookVerification.ts

export function verifyGelatoWebhookRequest(
	signature: string,
	body: string,
	webhookSecret: string
): boolean {
	// 直接比较 signature 和 webhookSecret
	console.log(signature);
	console.log(webhookSecret);
	if (signature === webhookSecret) {
		return true;
	} else {
		console.warn("签名验证失败");
		return false;
	}
}
