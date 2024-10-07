// src/lib/types/ReferralCode.ts
import type { ObjectId } from "mongodb";

export interface ReferralCode {
	_id: ObjectId;
	code: string;
	createdBy: ObjectId; // 創建者的用戶 ID
	usedBy?: ObjectId; // 使用者的用戶 ID（可選）
	usedAt?: Date; // 使用時間（可選）
	pointsAwarded: number; // 獎勵的積分數
	productId?: ObjectId; // 關聯的產品 ID
}
