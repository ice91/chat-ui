// src/lib/server/referral.ts
import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";

export async function generateReferralCode(userId: ObjectId): Promise<string> {
	const { referralCodes, users } = collections;

	// 生成唯一的推荐码
	const code = `REF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

	// 插入推荐码到 referralCodes 集合
	await referralCodes.insertOne({
		_id: new ObjectId(),
		code,
		createdBy: userId,
		pointsAwarded: 100, // 奖励的积分数，可以根据需求调整
	});

	// 更新用户的 referralCode 字段
	await users.updateOne({ _id: userId }, { $set: { referralCode: code } });

	return code;
}
