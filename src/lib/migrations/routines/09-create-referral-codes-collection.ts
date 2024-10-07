// src/lib/migrations/routines/09-create-referral-codes-collection.ts
import { ObjectId } from "mongodb";
import type { Migration } from ".";

const createReferralCodesCollection: Migration = {
	_id: new ObjectId("64f0c1f1f1f1f1f1f1f1f1f1"),
	name: "Create referralCodes collection",
	up: async (client) => {
		const db = client.db();
		const referralCodes = db.collection("referralCodes");

		// 创建索引
		await referralCodes.createIndex({ code: 1 }, { unique: true });
		await referralCodes.createIndex({ createdBy: 1 });
		await referralCodes.createIndex({ usedBy: 1 }, { sparse: true });

		// 如果需要，可以预填充一些推荐码
		// 示例：
		// await referralCodes.insertOne({
		//   _id: new ObjectId(),
		//   code: "WELCOME100",
		//   createdBy: new ObjectId("用户的ObjectId"),
		//   pointsAwarded: 100,
		// });

		return true;
	},
	down: async (client) => {
		const db = client.db();
		await db.collection("referralCodes").drop();
		return true;
	},
};

export default createReferralCodesCollection;
