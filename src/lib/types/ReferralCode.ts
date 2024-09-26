// src/lib/types/ReferralCode.ts
import type { ObjectId } from "mongodb";

export interface ReferralCode {
	_id: ObjectId;
	code: string;
	createdBy: ObjectId; // 创建者的用户 ID
	usedBy?: ObjectId; // 使用者的用户 ID（可选）
	usedAt?: Date; // 使用时间（可选）
	pointsAwarded: number; // 奖励的积分数
}
