// src/lib/server/gelatoWebhookVerification.ts

import crypto from "crypto";

/**
 * 驗證 Gelato Webhook 請求
 * @param signature Webhook 的簽名
 * @param payload Webhook 的請求體
 * @param secret Webhook 的秘密金鑰
 * @returns 是否驗證通過
 */
export function verifyGelatoWebhookRequest(
	signature: string,
	payload: string,
	secret: string
): boolean {
	const hash = crypto.createHmac("sha256", secret).update(payload).digest("hex");
	return hash === signature;
}
