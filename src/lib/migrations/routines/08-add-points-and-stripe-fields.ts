// src/lib/migrations/routines/08-add-points-and-stripe-fields.ts
import { ObjectId } from "mongodb";
import type { Migration } from ".";
import { collections } from "$lib/server/database";

const addPointsAndStripeFields: Migration = {
	_id: new ObjectId("64f0c0e0e0e0e0e0e0e0e0e0"), // 確保唯一性
	name: "Add points and Stripe subscription fields to users",
	up: async () => {
		const { users } = collections;

		// 步驟 1：刪除現有的唯一索引
		try {
			await users.dropIndex("stripeCustomerId_1");
			console.log("Dropped existing unique index on stripeCustomerId.");
		} catch (err) {
			if (err.codeName === "IndexNotFound") {
				console.log("Unique index on stripeCustomerId does not exist. Skipping drop.");
			} else {
				console.error("Error dropping existing stripeCustomerId index:", err);
				throw err; // 重新拋出錯誤以停止遷移
			}
		}

		// 步驟 2：添加新的字段，設置默認值，並清理相關欄位
		await users.updateMany(
			{},
			{
				$set: {
					points: 0,
					subscriptionStatus: "inactive",
					roles: ["seller"], // 新增預設角色
				},
				$unset: {
					stripeCustomerId: "",
					subscriptionPlan: "",
					subscriptionExpiry: "",
				},
			}
		);

		console.log(
			"Updated users with default points and subscriptionStatus, and unset stripeCustomerId, subscriptionPlan, subscriptionExpiry."
		);

		// 步驟 3：創建部分唯一索引
		await users.createIndex(
			{ stripeCustomerId: 1 },
			{
				unique: true,
				partialFilterExpression: {
					stripeCustomerId: { $exists: true, $ne: null },
				},
			}
		);

		console.log("Created partial unique index on stripeCustomerId.");

		// 創建其他必要的索引
		await users.createIndex({ subscriptionStatus: 1 });
		await users.createIndex({ points: 1 });

		console.log("Created additional indexes on subscriptionStatus and points.");

		return true;
	},
	down: async () => {
		const { users } = collections;

		// 步驟 1：刪除部分唯一索引
		await users.dropIndex("stripeCustomerId_1");
		console.log("Dropped partial unique index on stripeCustomerId.");

		// 步驟 2：刪除添加的字段
		await users.updateMany(
			{},
			{
				$unset: {
					points: "",
					stripeCustomerId: "",
					subscriptionStatus: "",
					subscriptionPlan: "",
					subscriptionExpiry: "",
				},
			}
		);

		console.log(
			"Unset points, stripeCustomerId, subscriptionStatus, subscriptionPlan, subscriptionExpiry from users."
		);

		// 步驟 3：刪除其他索引
		await users.dropIndex("subscriptionStatus_1");
		await users.dropIndex("points_1");

		console.log("Dropped indexes on subscriptionStatus and points.");

		return true;
	},
};

export default addPointsAndStripeFields;
